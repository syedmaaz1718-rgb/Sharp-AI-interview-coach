import { VoiceAccumulator } from './voiceMetrics.js'

// Wraps a MediaStream's audio in an analyser: live levels for the waveform + voice metrics while recording.
export class AudioMeter {
  constructor(stream) {
    const AC = window.AudioContext || window.webkitAudioContext
    this.ctx = new AC()
    this.src = this.ctx.createMediaStreamSource(stream)
    this.an = this.ctx.createAnalyser()
    this.an.fftSize = 1024
    this.an.smoothingTimeConstant = 0.75
    this.src.connect(this.an)
    this.time = new Float32Array(this.an.fftSize)
    this.freq = new Uint8Array(this.an.frequencyBinCount)
    this.acc = new VoiceAccumulator()
    this.recording = false
    this.timer = setInterval(() => { if (this.recording) this.acc.add(this.rms()) }, 100)
  }
  rms() {
    this.an.getFloatTimeDomainData(this.time)
    let s = 0
    for (let i = 0; i < this.time.length; i++) s += this.time[i] * this.time[i]
    return Math.sqrt(s / this.time.length)
  }
  bars(n = 48) {
    this.an.getByteFrequencyData(this.freq)
    const out = new Array(n)
    const usable = Math.floor(this.freq.length * 0.55)
    for (let i = 0; i < n; i++) {
      const a = Math.floor((i / n) * usable)
      const b = Math.max(a + 1, Math.floor(((i + 1) / n) * usable))
      let m = 0
      for (let j = a; j < b; j++) m += this.freq[j]
      out[i] = m / (b - a) / 255
    }
    return out
  }
  beginRecording() { this.acc.reset(); this.recording = true; this.ctx.state === 'suspended' && this.ctx.resume() }
  endRecording() { this.recording = false; return this.acc.summary() }
  close() { clearInterval(this.timer); try { this.src.disconnect(); this.ctx.close() } catch {} }
}
