// One dictation interface for every page. Browser speech (fast path) when the browser has it, otherwise
// server speech to text: the mic is recorded in short segments (MediaRecorder) and each segment is
// transcribed by the server (Groq Whisper). Works in Arc, Safari, Firefox and on phones.
import { useEffect, useRef, useState } from 'react'
import { Speech, speechSupported } from './speech.js'
import { api } from './api.js'

const SEG_MS = 7000
const MIN_LEVEL = 0.008
export const recorderSupported = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
export function pickAudioMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
}

let cfgP = null
const loadCfg = () => (cfgP ||= api.config().catch(() => { cfgP = null; return null }))

// -> { mode: 'browser' | 'server' | 'none', available, serverOk, loading }
export function useVoiceMode() {
  const [cfg, setCfg] = useState(undefined)
  useEffect(() => { let on = true; loadCfg().then((c) => on && setCfg(c)); return () => { on = false } }, [])
  const serverOk = !!(cfg?.stt && recorderSupported() && pickAudioMime())
  const browser = speechSupported()
  return { mode: browser ? 'browser' : serverOk ? 'server' : 'none', available: browser || serverOk, serverOk, loading: cfg === undefined }
}

class ServerSTT {
  constructor({ stream, lang, onText, onError, onState }) {
    Object.assign(this, { shared: stream || null, lang: (lang || 'en').slice(0, 2), onText, onError, onState })
    this.finalText = ''; this.active = false; this.fatal = false; this.chain = Promise.resolve(); this.inflight = 0
  }
  get text() { return this.finalText }
  async start(base = '') {
    this.finalText = base; this.active = true; this.fatal = false
    try {
      if (this.shared?.getAudioTracks().length) this.stream = new MediaStream(this.shared.getAudioTracks())
      else { this.own = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); this.stream = this.own }
    } catch (e) { this.active = false; this.fatal = true; this.onError?.(e?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture'); return }
    if (!this.active) { this.release(); return }
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      this.ctx = new AC(); this.an = this.ctx.createAnalyser(); this.an.fftSize = 1024
      this.ctx.createMediaStreamSource(this.stream).connect(this.an); this.buf = new Float32Array(this.an.fftSize)
    } catch { this.an = null }
    this.mime = pickAudioMime()
    this.segment()
  }
  level() { if (!this.an) return 1; this.an.getFloatTimeDomainData(this.buf); let s = 0; for (const v of this.buf) s += v * v; return Math.sqrt(s / this.buf.length) }
  segment() {
    if (!this.active || this.fatal) return
    let rec
    try { rec = new MediaRecorder(this.stream, { mimeType: this.mime, audioBitsPerSecond: 64000 }) } catch { this.fatal = true; this.onError?.('audio-capture'); return }
    const chunks = []; let peak = 0
    const meter = setInterval(() => { peak = Math.max(peak, this.level()) }, 120)
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    rec.onstop = () => {
      clearInterval(meter)
      const blob = new Blob(chunks, { type: this.mime || 'audio/webm' })
      if (peak >= MIN_LEVEL && blob.size > 1500) this.send(blob)
      if (this.active && !this.fatal) this.segment(); else this.release()
    }
    this.rec = rec; rec.start()
    this.timer = setTimeout(() => { try { rec.state === 'recording' && rec.stop() } catch {} }, SEG_MS)
  }
  send(blob) {
    this.inflight++; this.onState?.('transcribing')
    const lang = this.lang
    this.chain = this.chain.then(async () => {
      try {
        const res = await fetch(`/api/stt?lang=${lang}`, { method: 'POST', headers: { 'content-type': blob.type || 'audio/webm' }, body: blob })
        const j = await res.json().catch(() => ({}))
        if (res.status === 503) { this.fatal = true; this.onError?.('service-not-allowed') }
        else if (res.status === 429) { this.fatal = true; this.onError?.('rate-limited') }
        else if (res.ok && j.text) { this.finalText += (this.finalText ? ' ' : '') + j.text; this.onText?.(this.finalText, '') }
        else if (!res.ok) this.onState?.('retry')
      } catch { this.onState?.('retry') }
      finally { this.inflight--; if (!this.inflight) this.onState?.(this.active ? 'listening' : 'idle') }
    })
  }
  stop() {
    this.active = false; clearTimeout(this.timer)
    try { this.rec?.state === 'recording' ? this.rec.stop() : this.release() } catch { this.release() }
  }
  release() { try { this.own?.getTracks().forEach((t) => t.stop()) } catch {} try { this.ctx?.close() } catch {} this.own = null; this.ctx = null }
  // resolves when every segment has been transcribed (or after a timeout)
  finish(ms = 12000) { return Promise.race([new Promise((r) => setTimeout(r, 450)).then(() => this.chain), new Promise((r) => setTimeout(r, ms))]) }
}

// Same shape as Speech: start(), stop(), text. Plus finish() and onState('listening'|'transcribing'|'retry'|'idle').
class Dictation {
  constructor(vm, o) { this.vm = vm; this.o = o; this.base = ''; this.impl = null; this.t = '' }
  get text() { return this.t }
  emit(f, i) { this.t = f; this.o.onText?.(f, i) }
  start() {
    if (this.vm.mode === 'browser') {
      this.impl = new Speech({ lang: this.o.lang, onText: (f, i) => this.emit(f, i), onError: (e) => {
        if (this.vm.serverOk && !this.switched && e !== 'not-allowed') { this.switched = true; this.base = this.impl.text; try { this.impl.stop() } catch {} this.server() }
        else this.o.onError?.(e)
      } })
      this.impl.start()
    } else this.server()
  }
  server() {
    this.impl = new ServerSTT({ stream: this.o.stream, lang: this.o.lang, onText: (f, i) => this.emit(f, i), onError: (e) => this.o.onError?.(e), onState: (s) => this.o.onState?.(s) })
    this.o.onState?.('listening'); this.impl.start(this.base)
  }
  stop() { this.impl?.stop() }
  finish() { return this.impl?.finish ? this.impl.finish() : Promise.resolve() }
}
export const makeDictation = (vm, opts) => new Dictation(vm, { ...opts, lang: opts.lang || 'en-IN' })
export const voiceErrorText = (e) => e === 'not-allowed' || e === 'service-not-allowed' ? 'Microphone is blocked. Allow it from the lock icon in the address bar, or type.' : e === 'audio-capture' ? 'No microphone found. Type your answer instead.' : e === 'rate-limited' ? 'Too many voice requests for now. Type, or try again in a bit.' : 'Voice capture stopped. Your text is kept: type, or press the mic again.'

// Button-style dictation for the simple answer boxes. onText(fullText, interim) replaces the box text.
export function useDictate({ lang, onText, stream }) {
  const vm = useVoiceMode()
  const ref = useRef(null)
  const [rec, setRec] = useState(false)
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => () => ref.current?.stop(), [])
  const stop = async () => {
    const d = ref.current
    if (!d) return ''
    d.stop(); setRec(false); setPending(true)
    await d.finish(); setPending(false)
    return d.text
  }
  const start = () => {
    setErr('')
    const d = makeDictation(vm, { lang, stream, onText, onError: (e) => { setErr(voiceErrorText(e)); setRec(false); setPending(false) }, onState: (s) => { if (s === 'transcribing') setPending(true); else if (s !== 'retry') setPending(false) } })
    ref.current = d; d.start(); setRec(true)
  }
  return { ...vm, rec, pending, err, start, stop, toggle: () => (rec ? stop() : start()) }
}
