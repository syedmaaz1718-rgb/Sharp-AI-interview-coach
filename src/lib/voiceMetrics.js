// Voice activity + energy from RMS samples taken ~10 times per second.
export const toDb = (rms) => 20 * Math.log10(Math.max(rms, 1e-5))

export class VoiceAccumulator {
  constructor() { this.dbs = [] }
  reset() { this.dbs = [] }
  add(rms) { this.dbs.push(toDb(rms)) }
  threshold() {
    if (!this.dbs.length) return -50
    const sorted = [...this.dbs].sort((a, b) => a - b)
    const floor = sorted[Math.floor(sorted.length * 0.05)]
    return Math.max(floor + 9, -50)
  }
  isSpeaking(db) { return db > this.threshold() }
  summary() {
    const thr = this.threshold()
    let first = this.dbs.findIndex((d) => d > thr)
    if (first < 0) return { frames: this.dbs.length, silenceRatio: 1, energyDbStd: 0, avgDb: -90 }
    let last = this.dbs.length - 1
    while (last > first && this.dbs[last] <= thr) last--
    const span = this.dbs.slice(first, last + 1)
    const speech = span.filter((d) => d > thr)
    const mean = speech.reduce((a, b) => a + b, 0) / speech.length
    const std = Math.sqrt(speech.reduce((a, b) => a + (b - mean) ** 2, 0) / speech.length)
    return { frames: span.length, silenceRatio: 1 - speech.length / span.length, energyDbStd: std, avgDb: mean }
  }
}
