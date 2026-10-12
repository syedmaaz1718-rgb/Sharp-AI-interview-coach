// A very quiet two-note "tick" used by the live filler alert.
let ctx = null
export function softTick() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(660, t)
    o.frequency.setValueAtTime(880, t + 0.06)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.16)
  } catch {}
}
