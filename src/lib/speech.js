// Web Speech API wrapper (Chrome / Edge). Restarts itself because Chrome stops after silence.
export const speechSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition)

export class Speech {
  constructor({ onText, onError, lang = 'en-IN' }) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    this.rec = new SR()
    this.rec.continuous = true
    this.rec.interimResults = true
    this.rec.lang = lang
    this.finalText = ''
    this.active = false
    this.fatal = false
    this.rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) this.finalText += (this.finalText ? ' ' : '') + r[0].transcript.trim()
        else interim += r[0].transcript
      }
      onText?.(this.finalText, interim.trim())
    }
    this.rec.onerror = (e) => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'].includes(e.error)) {
        this.fatal = true
        onError?.(e.error)
      }
    }
    this.rec.onend = () => {
      if (!this.active || this.fatal) return
      // Chrome ends sessions on silence; restart, but give up (-> typing) if it keeps dying instantly.
      const now = Date.now()
      this.restarts = (this.restarts || []).filter((t) => now - t < 4000)
      this.restarts.push(now)
      if (this.restarts.length > 8) { this.fatal = true; onError?.('restart-loop'); return }
      setTimeout(() => { if (this.active && !this.fatal) { try { this.rec.start() } catch {} } }, 150)
    }
  }
  start() { this.finalText = ''; this.active = true; this.fatal = false; try { this.rec.start() } catch {} }
  stop() { this.active = false; try { this.rec.stop() } catch {} }
  get text() { return this.finalText }
}
