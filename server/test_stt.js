import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createApp } from './index.js'
import { createDb } from './db.js'
import { cleanTranscript, audioKind } from './stt.js'

async function start(llm) {
  const app = createApp({ db: createDb(':memory:'), llm })
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  return { base: `http://localhost:${server.address().port}`, close: () => server.close() }
}
const AUDIO = Buffer.alloc(4000, 7)
const post = (base, body, type = 'audio/webm;codecs=opus', q = '') => fetch(`${base}/api/stt${q}`, { method: 'POST', headers: { 'content-type': type }, body })

test('cleanTranscript drops no-speech segments and stock hallucinations', () => {
  assert.equal(cleanTranscript({ text: 'Thank you.' }), '')
  assert.equal(cleanTranscript({ segments: [{ text: ' I led the build. ', no_speech_prob: 0.01, avg_logprob: -0.2 }, { text: ' Thanks for watching', no_speech_prob: 0.9, avg_logprob: -1.5 }] }), 'I led the build.')
  assert.equal(cleanTranscript({ text: ' I   improved\nlatency by 40 percent. ' }), 'I improved latency by 40 percent.')
  assert.equal(audioKind('audio/webm;codecs=opus').ext, 'webm'); assert.equal(audioKind('text/plain'), null)
})

test('stt endpoint: off without a key, validates input', async () => {
  const saved = process.env.GROQ_API_KEY; delete process.env.GROQ_API_KEY
  const s = await start()
  try {
    const cfg = await (await fetch(s.base + '/api/config')).json()
    assert.equal(cfg.stt, false)
    const r = await post(s.base, AUDIO); assert.equal(r.status, 503); assert.equal((await r.json()).code, 'stt_off')
    process.env.GROQ_API_KEY = 'test'
    assert.equal((await post(s.base, AUDIO, 'text/plain')).status, 415)
    assert.equal((await post(s.base, Buffer.alloc(10))).status, 400)
  } finally { s.close(); if (saved) process.env.GROQ_API_KEY = saved; else delete process.env.GROQ_API_KEY }
})

test('stt endpoint: forwards the audio to the Whisper API and returns cleaned text', async () => {
  let seen = null
  const mock = http.createServer((req, res) => {
    const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
      seen = { url: req.url, auth: req.headers.authorization, ct: req.headers['content-type'], body: Buffer.concat(chunks).toString('latin1') }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ text: 'ignored', segments: [{ text: ' I rebuilt the cleaning step. ', no_speech_prob: 0.02, avg_logprob: -0.1 }] }))
    })
  })
  await new Promise((r) => mock.listen(0, r))
  const saved = { k: process.env.GROQ_API_KEY, u: process.env.GROQ_BASE_URL }
  process.env.GROQ_API_KEY = 'k_test'; process.env.GROQ_BASE_URL = `http://localhost:${mock.address().port}`
  const s = await start()
  try {
    assert.equal((await (await fetch(s.base + '/api/config')).json()).stt, true)
    const r = await post(s.base, AUDIO, 'audio/webm;codecs=opus', '?lang=hi-IN')
    assert.equal(r.status, 200); assert.equal((await r.json()).text, 'I rebuilt the cleaning step.')
    assert.equal(seen.url, '/audio/transcriptions'); assert.equal(seen.auth, 'Bearer k_test')
    assert.match(seen.ct, /multipart\/form-data/); assert.match(seen.body, /whisper-large-v3-turbo/); assert.match(seen.body, /name="language"\r\n\r\nhi/)
    assert.match(seen.body, /filename="seg\.webm"/)
  } finally {
    s.close(); mock.close()
    if (saved.k) process.env.GROQ_API_KEY = saved.k; else delete process.env.GROQ_API_KEY
    if (saved.u) process.env.GROQ_BASE_URL = saved.u; else delete process.env.GROQ_BASE_URL
  }
})

test('stt endpoint: upstream failure is a clean 502, not a crash', async () => {
  const saved = process.env.GROQ_API_KEY; process.env.GROQ_API_KEY = 'k'
  const s = await start({ transcribe: async () => { throw new Error('boom') } })
  try { const r = await post(s.base, AUDIO); assert.equal(r.status, 502); assert.equal((await r.json()).code, 'upstream') }
  finally { s.close(); if (saved) process.env.GROQ_API_KEY = saved; else delete process.env.GROQ_API_KEY }
})
