import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './index.js'
import { createDb } from './db.js'
import { pickQuestions, QUESTIONS, ROLES } from './questions.js'
import { extractJson, normalizeAnswerFeedback } from './llm.js'

const CID = 'client_test_12345'
const GOOD = 'During my second year project we had a deadline in two weeks and our team hit a serious problem: the model accuracy was only 61 percent. I was responsible for the data pipeline, so I analyzed the errors, found that 30% of labels were wrong, and I fixed them with a small script. As a result accuracy improved to 84 percent and we delivered on time. I learned to check the data before the model.'
const face = { frames: 100, detectedRatio: 0.95, eyeContactRatio: 0.7, smileRatio: 0.3, browMean: 0.08, headMotion: 5 }
const voice = { frames: 300, silenceRatio: 0.2, energyDbStd: 6, avgDb: -30 }

async function start(opts) {
  const app = createApp({ db: createDb(':memory:'), ...opts })
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  const base = `http://localhost:${server.address().port}`
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    return { status: res.status, json: await res.json().catch(() => null) }
  }
  return { call, close: () => server.close() }
}

test('question bank sanity', () => {
  const ids = new Set(QUESTIONS.map((q) => q.id))
  assert.equal(ids.size, QUESTIONS.length)
  for (const r of ROLES) {
    const qs = pickQuestions(r.id, 5)
    assert.equal(qs.length, 5)
    assert.equal(qs[0].category, 'intro')
    assert.equal(new Set(qs.map((q) => q.id)).size, 5)
    if (r.id !== 'general') assert.ok(qs.some((q) => q.role === r.id))
  }
})

test('llm helpers parse messy output', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 })
  assert.equal(extractJson('no json'), null)
  const f = normalizeAnswerFeedback({ score: 14, strengths: ['a', 'b', 'c'], improvements: ['x'], sample_answer: 's' })
  assert.equal(f.score, 10)
  assert.equal(f.strengths.length, 3)
  assert.equal(normalizeAnswerFeedback({ score: 'abc' }), null)
})

test('full interview flow without LLM (heuristic mode)', async () => {
  delete process.env.GROQ_API_KEY
  const { call, close } = await start()
  try {
    const cfg = await call('GET', '/api/config')
    assert.equal(cfg.json.llm, false)

    assert.equal((await call('POST', '/api/sessions', { clientId: 'x', role: 'sde' })).status, 400)
    assert.equal((await call('POST', '/api/sessions', { clientId: CID, role: 'nope' })).status, 400)
    const s = await call('POST', '/api/sessions', { clientId: CID, role: 'sde', count: 4 })
    assert.equal(s.status, 200)
    assert.equal(s.json.questions.length, 4)
    const id = s.json.id

    // wrong client / foreign question rejected
    const q0 = s.json.questions[0].id
    assert.equal((await call('POST', `/api/sessions/${id}/answers`, { clientId: 'someone_else_1', questionId: q0, transcript: GOOD, durationSec: 40 })).status, 403)
    assert.equal((await call('POST', `/api/sessions/${id}/answers`, { clientId: CID, questionId: 'zzz', transcript: GOOD, durationSec: 40 })).status, 400)
    assert.equal((await call('POST', `/api/sessions/${id}/finish`, { clientId: CID })).status, 400)

    for (const [i, q] of s.json.questions.entries()) {
      const r = await call('POST', `/api/sessions/${id}/answers`, { clientId: CID, questionId: q.id, transcript: i === 0 ? GOOD : 'um so like it was fine you know', durationSec: 40, input: 'speech', metrics: { face, voice } })
      assert.equal(r.status, 200)
      assert.equal(r.json.llm, null)
      assert.ok(r.json.answerScore >= 0 && r.json.answerScore <= 10)
      if (i === 0) assert.ok(r.json.answerScore >= 5)
      assert.ok(r.json.analysis.measured.face)
    }
    const rep = await call('POST', `/api/sessions/${id}/finish`, { clientId: CID })
    assert.equal(rep.status, 200)
    assert.equal(rep.json.answers.length, 4)
    assert.ok(rep.json.scores.overall > 0)
    assert.equal(rep.json.llm, false)
    assert.equal(rep.json.coaching, null)
    assert.ok(rep.json.stats.totalFillers > 0)
    // finishing twice returns the same report; answering afterwards is rejected
    assert.equal((await call('POST', `/api/sessions/${id}/finish`, { clientId: CID })).json.finishedAt, rep.json.finishedAt)
    assert.equal((await call('POST', `/api/sessions/${id}/answers`, { clientId: CID, questionId: q0, transcript: GOOD, durationSec: 10 })).status, 409)

    // shareable report + history + delete
    assert.equal((await call('GET', `/api/sessions/${id}`)).json.id, id)
    const h = await call('GET', `/api/history?clientId=${CID}`)
    assert.equal(h.json.sessions.length, 1)
    assert.equal((await call('GET', '/api/history?clientId=short')).status, 400)
    assert.equal((await call('DELETE', `/api/sessions/${id}?clientId=other_client_1`)).status, 403)
    assert.equal((await call('DELETE', `/api/sessions/${id}?clientId=${CID}`)).status, 200)
    assert.equal((await call('GET', `/api/sessions/${id}`)).status, 404)
  } finally { close() }
})

test('LLM layer is used when key is set, and failures fall back gracefully', async () => {
  process.env.GROQ_API_KEY = 'test-key'
  try {
    let fail = false
    const llm = {
      answer: async () => (fail ? null : { score: 9, strengths: ['clear'], improvements: ['add more'], sample: 'x' }),
      summary: async () => (fail ? null : { summary: 'Nice work.', nextSteps: ['Practice STAR'] }),
    }
    const { call, close } = await start({ llm })
    try {
      assert.equal((await call('GET', '/api/config')).json.llm, true)
      const s = await call('POST', '/api/sessions', { clientId: CID, role: 'general', count: 3 })
      const [a, b] = s.json.questions
      const r1 = await call('POST', `/api/sessions/${s.json.id}/answers`, { clientId: CID, questionId: a.id, transcript: GOOD, durationSec: 40, input: 'typed' })
      assert.equal(r1.json.llm.score, 9)
      assert.ok(r1.json.answerScore > r1.json.analysis.scores.content)
      fail = true
      const r2 = await call('POST', `/api/sessions/${s.json.id}/answers`, { clientId: CID, questionId: b.id, transcript: GOOD, durationSec: 40, input: 'typed' })
      assert.equal(r2.json.llm, null)
      assert.equal(r2.json.answerScore, r2.json.analysis.scores.content)
      const rep = await call('POST', `/api/sessions/${s.json.id}/finish`, { clientId: CID })
      assert.equal(rep.status, 200)
      assert.equal(rep.json.llm, true)
      assert.equal(rep.json.coaching, null)
    } finally { close() }
  } finally { delete process.env.GROQ_API_KEY }
})

test('llm http layer: fetch failure and non-JSON never throw', async () => {
  process.env.GROQ_API_KEY = 'test-key'
  try {
    const { llmAnswerFeedback } = await import('./llm.js')
    const q = QUESTIONS[0]
    const boom = await llmAnswerFeedback({ question: q, transcript: GOOD, role: 'sde' }, { fetchImpl: async () => { throw new Error('net') } })
    assert.equal(boom, null)
    const junk = await llmAnswerFeedback({ question: q, transcript: GOOD, role: 'sde' }, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'sorry no' } }] }) }) })
    assert.equal(junk, null)
    const okRes = await llmAnswerFeedback({ question: q, transcript: GOOD, role: 'sde' }, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"score": 7.5, "strengths": ["a"], "improvements": ["b"], "sample_answer": "c"}' } }] }) }) })
    assert.equal(okRes.score, 7.5)
  } finally { delete process.env.GROQ_API_KEY }
})

import { PACKS, lensCoverage, pickPackQuestions } from './packs.js'
import { extractResumeFacts, templateQuestions, sanitizeCustomQuestions } from './resume.js'
import { analyzeAnswer } from '../src/lib/analysis.js'

const RESUME = 'Syed Maaz\nSkills: Java, C++, Python, React, Node, SQLite, DSA\nProjects\n- Zippy: a full-stack quick commerce app built with React, Node and SQLite\n- Traffic Signal AI project using machine learning and OpenCV'

test('company packs are well formed', () => {
  assert.ok(PACKS.length >= 5)
  const ids = new Set()
  for (const p of PACKS) {
    assert.ok(p.questions.length >= 8 && p.lens.length >= 4)
    assert.ok(p.flavor.length > 20)
    for (const q of p.questions) { assert.ok(!ids.has(q.id), 'dup ' + q.id); ids.add(q.id); assert.ok(q.keywords.length >= 4) }
    const qs = pickPackQuestions(p, { id: 'i1', category: 'intro', text: 'x' }, 5)
    assert.equal(qs.length, 5)
    assert.equal(qs[0].id, 'i1')
  }
  const cov = lensCoverage(PACKS[0], ['I owned the project and talked to the customer, then measured the result'])
  assert.ok(cov.find((c) => c.name === 'Ownership').hit)
  assert.ok(cov.find((c) => c.name === 'Customer obsession').hit)
  assert.ok(!cov.find((c) => c.name === 'Bias for action').hit)
})

test('resume helpers: facts, template questions, sanitising', () => {
  const f = extractResumeFacts(RESUME)
  assert.ok(f.skills.includes('React') && f.skills.includes('SQLite') && f.skills.includes('C++'))
  assert.ok(f.projects.some((p) => p.startsWith('Zippy')))
  const t = templateQuestions(RESUME, 4)
  assert.equal(t.length, 4)
  assert.ok(t[0].text.includes('Zippy'))
  const s = sanitizeCustomQuestions([{ text: 'short' }, { text: 'Why did you pick SQLite for Zippy instead of Postgres?', category: 'weird', keywords: ['sqlite', 'postgres'] }, null])
  assert.equal(s.length, 1)
  assert.equal(s[0].category, 'behavioral')
  assert.equal(s[0].id, 'r1')
  assert.deepEqual(sanitizeCustomQuestions('nope'), [])
})

test('followup category scores sensibly and is not forced into STAR', () => {
  const q = { id: 'fu_b1', category: 'followup', text: 'What was the hardest decision in the parser fix?', keywords: [] }
  const a = analyzeAnswer({ question: q, transcript: 'The hardest decision was whether to rewrite the parser or patch it because the deadline was close, so I patched it and added tests.', durationSec: 20, input: 'typed', metrics: {} })
  assert.ok(a.scores.content >= 4, 'content ' + a.scores.content)
  assert.ok(!a.tips.some((t) => /STAR/.test(t.text)))
})

test('company pack session, report lens and resume session (no key: template fallback + follow-up note)', async () => {
  delete process.env.GROQ_API_KEY
  const { call, close } = await start()
  try {
    const cfg = await call('GET', '/api/config')
    assert.equal(cfg.json.packs.length, PACKS.length)
    assert.match(cfg.json.disclaimer, /not official/)
    assert.equal((await call('POST', '/api/sessions', { clientId: CID, pack: 'nope' })).status, 400)
    const s = await call('POST', '/api/sessions', { clientId: CID, pack: 'amazon', count: 4 })
    assert.equal(s.status, 200)
    assert.equal(s.json.pack.id, 'amazon')
    assert.equal(s.json.questions.length, 4)
    const r1 = await call('POST', `/api/sessions/${s.json.id}/answers`, { clientId: CID, questionId: s.json.questions[1].id, transcript: GOOD, durationSec: 40, input: 'typed', wantFollowUp: true })
    // no AI key: the built-in interviewer still asks a follow-up that reacts to the answer
    assert.equal(r1.json.followUp.category, 'followup')
    assert.ok(r1.json.followUp.text.length > 20)
    const rep = await call('POST', `/api/sessions/${s.json.id}/finish`, { clientId: CID })
    assert.equal(rep.json.pack.id, 'amazon')
    assert.ok(rep.json.pack.coverage.length >= 4)
    assert.match(rep.json.pack.disclaimer, /not official/)

    const rq = await call('POST', '/api/resume-questions', { resume: RESUME, role: 'sde' })
    assert.equal(rq.status, 200)
    assert.equal(rq.json.source, 'template')
    assert.match(rq.json.note, /Groq/)
    assert.ok(rq.json.questions.length >= 3)
    assert.equal((await call('POST', '/api/resume-questions', { resume: 'too short' })).status, 400)
    const rs = await call('POST', '/api/sessions', { clientId: CID, role: 'sde', custom: rq.json.questions })
    assert.equal(rs.json.mode, 'resume')
    assert.equal(rs.json.questions[0].category, 'intro')
    assert.ok(rs.json.questions[1].text.includes('Zippy'))
    const ra = await call('POST', `/api/sessions/${rs.json.id}/answers`, { clientId: CID, questionId: rs.json.questions[1].id, transcript: GOOD, durationSec: 40, input: 'typed' })
    assert.equal(ra.status, 200)
    assert.equal((await call('POST', '/api/sessions', { clientId: CID, role: 'sde', custom: [{ text: 'x' }] })).status, 400)
  } finally { close() }
})

test('AI follow-up and AI resume questions (mocked LLM), follow-up is added to the session and reported', async () => {
  process.env.GROQ_API_KEY = 'test-key'
  try {
    const llm = {
      answer: async () => ({ score: 8, strengths: ['good'], improvements: ['more'], sample: 's' }),
      summary: async () => ({ summary: 'ok', nextSteps: [] }),
      followUp: async () => 'You said you fixed the parser bug. How did you find it was 30 percent of requests?',
      resumeQuestions: async () => [
        { text: 'Why did you choose SQLite for Zippy instead of Postgres?', category: 'technical', tip: 'Tradeoffs', keywords: ['sqlite', 'postgres', 'tradeoff'] },
        { text: 'How did you make the Zippy order tracking update live?', category: 'technical', tip: 'SSE', keywords: ['sse', 'events'] },
        { text: 'Tell me about the traffic signal project and the model you used.', category: 'behavioral', tip: 'Model', keywords: ['model', 'data'] },
      ],
    }
    const { call, close } = await start({ llm })
    try {
      const rq = await call('POST', '/api/resume-questions', { resume: RESUME, role: 'sde' })
      assert.equal(rq.json.source, 'ai')
      assert.equal(rq.json.note, '')
      const s = await call('POST', '/api/sessions', { clientId: CID, role: 'sde', custom: rq.json.questions })
      const qid = s.json.questions[1].id
      const a = await call('POST', `/api/sessions/${s.json.id}/answers`, { clientId: CID, questionId: qid, transcript: GOOD, durationSec: 40, input: 'typed', wantFollowUp: true })
      assert.equal(a.json.followUp.category, 'followup')
      assert.equal(a.json.followUp.id, 'fu_' + qid)
      assert.match(a.json.followUp.text, /parser/)
      // answering the follow-up works, does not spawn another follow-up
      const f = await call('POST', `/api/sessions/${s.json.id}/answers`, { clientId: CID, questionId: a.json.followUp.id, transcript: 'I grouped the logs by endpoint and counted the failing requests against the total, so the bug showed up in thirty percent of them.', durationSec: 15, input: 'typed', wantFollowUp: true })
      assert.equal(f.status, 200)
      assert.equal(f.json.followUp, null)
      // opting out of follow-ups
      const q2 = s.json.questions[2].id
      const n = await call('POST', `/api/sessions/${s.json.id}/answers`, { clientId: CID, questionId: q2, transcript: GOOD, durationSec: 40, input: 'typed', wantFollowUp: false })
      assert.equal(n.json.followUp, null)
      assert.equal(n.json.followUpNote, null)
      const rep = await call('POST', `/api/sessions/${s.json.id}/finish`, { clientId: CID })
      assert.equal(rep.json.answers.length, 3)
      assert.deepEqual(rep.json.answers.map((x) => x.followUp), [false, true, false])
    } finally { close() }
  } finally { delete process.env.GROQ_API_KEY }
})

test('every role has a full technical bank and picks unique questions', async () => {
  const { ROLES, QUESTIONS, pickQuestions } = await import('./questions.js')
  assert.ok(ROLES.length >= 14)
  for (const r of ROLES.filter((x) => x.id !== 'general')) {
    assert.ok(QUESTIONS.filter((q) => q.role === r.id).length >= 7, r.id)
    const ids = pickQuestions(r.id, 8).map((q) => q.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('google login: verified token creates a user session; sessions are tied to the account', async () => {
  const { verifyGoogleToken } = await import('./index.js')
  const ok = async () => ({ ok: true, json: async () => ({ aud: 'cid', iss: 'accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), email_verified: 'true', sub: '1234567890', email: 'a@b.com', name: 'A B' }) })
  assert.equal((await verifyGoogleToken('x'.repeat(30), 'cid', ok)).sub, '1234567890')
  assert.equal(await verifyGoogleToken('x'.repeat(30), 'other', ok), null) // wrong audience
  const expired = async () => ({ ok: true, json: async () => ({ aud: 'cid', iss: 'accounts.google.com', exp: '1', email_verified: 'true', sub: '1234567890' }) })
  assert.equal(await verifyGoogleToken('x'.repeat(30), 'cid', expired), null)
  assert.equal(await verifyGoogleToken('x'.repeat(30), 'cid', async () => ({ ok: false })), null)
})

test('auth endpoints: 503 without client id, guests cannot claim g_ ids, history follows the token', async () => {
  const http = await import('node:http')
  const fake = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    res.setHeader('content-type', 'application/json')
    if (u.searchParams.get('id_token') === 'g'.repeat(30)) return res.end(JSON.stringify({ aud: 'cid', iss: 'accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), email_verified: 'true', sub: '99887766', email: 'z@z.com', name: 'Z' }))
    res.statusCode = 400; res.end('{}')
  })
  await new Promise((r) => fake.listen(0, r))
  const app = createApp({ db: createDb(':memory:') })
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  const base = `http://localhost:${srv.address().port}`
  const post = (p, body, h = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) })
  try {
    delete process.env.GOOGLE_CLIENT_ID
    assert.equal((await post('/api/auth/google', { credential: 'g'.repeat(30) })).status, 503)
    process.env.GOOGLE_CLIENT_ID = 'cid'
    process.env.GOOGLE_TOKENINFO_URL = `http://localhost:${fake.address().port}/tokeninfo`
    assert.equal((await post('/api/auth/google', { credential: 'b'.repeat(30) })).status, 401)
    const guest = 'c_guestguestguest1'
    const gs = await (await post('/api/sessions', { clientId: guest, role: 'sde', count: 3 })).json()
    assert.ok(gs.id)
    assert.equal((await post('/api/sessions', { clientId: 'g_99887766', role: 'sde' })).status, 400)
    const login = await (await post('/api/auth/google', { credential: 'g'.repeat(30), guestClientId: guest })).json()
    assert.match(login.token, /^[a-f0-9]{64}$/)
    const auth = { authorization: 'Bearer ' + login.token }
    assert.equal((await (await fetch(base + '/api/auth/me', { headers: auth })).json()).user.email, 'z@z.com')
    const s2 = await post('/api/sessions', { role: 'sde', count: 3 }, auth)
    assert.equal(s2.status, 200)
    assert.equal((await post('/api/auth/logout', {}, auth)).status, 200)
    assert.equal((await fetch(base + '/api/auth/me', { headers: auth })).status, 401)
  } finally { srv.close(); fake.close(); delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_TOKENINFO_URL }
})

test('tailored questions: JD template fallback uses skills from the posting', async () => {
  const { templateJdQuestions } = await import('./resume.js')
  const jd = 'Backend Intern\nWe need someone who knows Node.js, PostgreSQL and Docker. You will build REST APIs and write tests.'
  const qs = templateJdQuestions(jd, 'Projects\n- Zippy: quick commerce app with Node.js and SQLite', 5)
  assert.ok(qs.length >= 3)
  assert.ok(qs.some((q) => /Node\.js|PostgreSQL|Docker/i.test(q.text)))
  const app = createApp({ db: createDb(':memory:'), llm: {} })
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  try {
    const base = `http://localhost:${srv.address().port}`
    const bad = await fetch(base + '/api/tailored-questions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jd: 'short' }) })
    assert.equal(bad.status, 400)
    const ok = await (await fetch(base + '/api/tailored-questions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jd }) })).json()
    assert.equal(ok.used.jd, true)
    assert.ok(ok.questions.length >= 3)
  } finally { srv.close() }
})

test('minimum 7 resume/JD questions, and the built-in interviewer follows up on what was said', async () => {
  const { templateQuestions, templateJdQuestions, templateFollowUp } = await import('./resume.js')
  const resume = 'Projects\n- Zippy: quick commerce app with Node.js and SQLite\n- Built a traffic dashboard in React\nSkills: Python, Java, SQL'
  const jd = 'Backend Intern\nWe need someone who knows Node.js, PostgreSQL and Docker. You will build REST APIs and write tests.'
  assert.equal(templateQuestions(resume, 7).length, 7)
  assert.equal(templateJdQuestions(jd, resume, 7).length, 7)
  assert.equal(new Set(templateJdQuestions(jd, resume, 7).map((q) => q.text)).size, 7)
  // thin input still reaches 7 questions that point back at the resume
  assert.equal(templateQuestions('Projects\n- Built a weather app with React', 7).length, 7)
  const fu = templateFollowUp({ question: { keywords: [] }, transcript: 'I built a parser fix that cut failing requests by 30 percent because I grouped the logs by endpoint and counted them first, then I traced the worst endpoint to a bad regex, rewrote it, and added a test so the bug could not come back later.' })
  assert.match(fu, /30 percent/)
  assert.match(templateFollowUp({ question: { text: 'Tell me about a project.', keywords: [] }, transcript: 'I do not know.' }), /did not get much/)
  assert.match(templateFollowUp({ question: { keywords: [] }, transcript: 'I made a small website for my class and it worked well for everyone there.' }), /brief/)
  const miss = templateFollowUp({ question: { keywords: ['docker'] }, transcript: 'I deployed my app on a cheap server and watched the logs every day for a week to find the crashes quickly, then I fixed the two worst ones by adding retries and a health check so the server restarted itself when it hung.' })
  assert.match(miss, /docker/i)
  const app = createApp({ db: createDb(':memory:'), llm: {} })
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  try {
    const base = `http://localhost:${srv.address().port}`
    const post = (u, b) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json())
    assert.ok((await post('/api/tailored-questions', { jd, resume })).questions.length >= 7)
    assert.equal((await post('/api/resume-questions', { resume })).questions.length, 7)
    assert.ok((await post('/api/resume-questions', { resume: resume + '\n- Machine learning classifier with scikit-learn and Flask\n- Chat app using Express and MongoDB' })).questions.length >= 7)
  } finally { srv.close() }
})
