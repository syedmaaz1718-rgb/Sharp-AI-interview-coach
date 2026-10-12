// Interviewer voice via the browser's speechSynthesis (free, offline-capable, quality depends on the device).
export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

export function scoreVoice(v, lang = 'en') {
  let s = 0
  const n = v.name || ''
  const lang_ = (v.lang || '').replace('_', '-')
  const want = lang === 'hindi' ? /^hi/i : /^en/i
  if (!want.test(lang_)) return lang === 'hinglish' && /^hi/i.test(lang_) ? -2 : -100
  if (/natural|neural|online/i.test(n)) s += 6
  if (/google/i.test(n)) s += 4
  if (/aria|jenny|guy|neerja|prabhat|libby|ryan|samantha|daniel|karen|moira|rishi/i.test(n)) s += 3
  if (lang_ === 'en-IN' || lang_ === 'hi-IN') s += 3
  else if (lang_ === 'en-US' || lang_ === 'en-GB') s += 2
  if (/compact|espeak|zira desktop|david desktop/i.test(n)) s -= 4
  if (v.localService === false) s += 1
  return s
}
export function pickVoice(voices, lang = 'en') {
  const ranked = [...voices].map((v) => [scoreVoice(v, lang), v]).filter(([s]) => s > -50).sort((a, b) => b[0] - a[0])
  return ranked.length ? ranked[0][1] : null
}

// voices load asynchronously in Chrome: wait for them (max ~1.5 s) once.
let voicesPromise = null
export function loadVoices() {
  if (!ttsSupported()) return Promise.resolve([])
  if (voicesPromise) return voicesPromise
  voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis
    const have = synth.getVoices()
    if (have.length) return resolve(have)
    const done = () => { const v = synth.getVoices(); if (!v.length) voicesPromise = null; resolve(v) } // don't cache an empty list: retry next time
    synth.addEventListener?.('voiceschanged', done, { once: true })
    setTimeout(done, 1500)
  })
  return voicesPromise
}

let current = null
export async function speak(text, { onStart, onEnd, rate = 0.97, lang = 'en' } = {}) {
  if (!ttsSupported()) { onEnd?.(false); return () => {} }
  const synth = window.speechSynthesis
  synth.cancel()
  const voices = await loadVoices()
  await new Promise((r) => setTimeout(r, 120)) // Chrome drops speak() issued right after cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice(voices, lang)
  if (v) { u.voice = v; u.lang = v.lang }
  else u.lang = lang === 'hindi' ? 'hi-IN' : 'en-IN'
  u.rate = rate
  u.pitch = 1
  let finished = false
  const end = (ok) => { if (finished) return; finished = true; clearInterval(keep); onEnd?.(ok) }
  u.onstart = () => onStart?.()
  u.onend = () => end(true)
  u.onerror = () => end(false)
  // Chrome sometimes pauses long utterances: nudge it.
  const keep = setInterval(() => { if (synth.speaking && synth.paused) synth.resume() }, 4000)
  current = u
  synth.speak(u)
  // some engines never fire events: fail open after a generous timeout
  setTimeout(() => end(false), Math.max(8000, text.length * 110))
  return () => { if (current === u) { synth.cancel() } end(false) }
}
export function stopSpeaking() { if (ttsSupported()) window.speechSynthesis.cancel() }
