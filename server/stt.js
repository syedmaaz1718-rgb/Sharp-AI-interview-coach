// Server-side speech to text via Groq Whisper (browser independent: works in Arc, Safari, Firefox, mobile).
// The browser records short audio segments with MediaRecorder and posts each one here. Audio is forwarded to
// Groq for transcription only and is never stored.
import { llmEnabled } from './llm.js'

const base = () => process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
const model = () => process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo'
export const sttEnabled = () => llmEnabled()

const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/m4a': 'm4a' }
export function audioKind(contentType) {
  const t = String(contentType || '').split(';')[0].trim().toLowerCase()
  return EXT[t] ? { type: t, ext: EXT[t] } : null
}

// Whisper sometimes invents text on silence. Drop segments it marks as no-speech, and the usual stock phrases.
const STOCK = /^(thank you\.?|thanks for watching\.?|thanks for watching!?|you\.?|bye\.?|\.+|धन्यवाद\.?)$/i
export function cleanTranscript(json) {
  if (!json) return ''
  const segs = Array.isArray(json.segments) ? json.segments : null
  let text
  if (segs && segs.length) {
    const keep = segs.filter((s) => !(Number(s.no_speech_prob) > 0.6 && Number(s.avg_logprob) < -0.8))
    text = keep.map((s) => String(s.text || '').trim()).filter(Boolean).join(' ')
  } else text = String(json.text || '')
  text = text.replace(/\s+/g, ' ').trim()
  return STOCK.test(text) ? '' : text
}

const hits = new Map()
let day = new Date().toDateString(); let dayCount = 0
export function allowStt(ip) {
  const today = new Date().toDateString()
  if (today !== day) { day = today; dayCount = 0 }
  if (dayCount >= Number(process.env.STT_DAILY_CAP || 4000)) return false
  const now = Date.now()
  const arr = (hits.get(ip) || []).filter((t) => now - t < 3600_000)
  if (arr.length >= Number(process.env.STT_HOURLY_PER_IP || 600)) return false
  arr.push(now); hits.set(ip, arr); dayCount++
  return true
}

export async function transcribe(buf, kind, lang = 'en', { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const fd = new FormData()
  fd.append('file', new Blob([buf], { type: kind.type }), `seg.${kind.ext}`)
  fd.append('model', model())
  fd.append('response_format', 'verbose_json')
  fd.append('temperature', '0')
  if (lang === 'hi' || lang === 'en') fd.append('language', lang)
  if (lang === 'hi') fd.append('prompt', 'Interview answer in Hindi and English (Hinglish). Technical words stay in English.')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(base() + '/audio/transcriptions', { method: 'POST', signal: ctrl.signal, headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: fd })
    if (!res.ok) throw new Error('stt http ' + res.status)
    return cleanTranscript(await res.json())
  } finally { clearTimeout(t) }
}
