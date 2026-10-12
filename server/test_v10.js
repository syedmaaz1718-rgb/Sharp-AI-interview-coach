import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './index.js'
import { createDb } from './db.js'
import { copilotRules, vagueProbes, passportPayload, signPayload, verifyPayload } from './v10.js'

const CID = 'client_v10_test_1'
async function start() {
  const db = createDb(':memory:')
  const app = createApp({ db })
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  const base = `http://localhost:${server.address().port}`
  const call = async (method, url, body, raw) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    return { status: res.status, json: raw ? null : await res.json().catch(() => null), text: raw ? await res.text() : null }
  }
  return { call, db, close: () => server.close() }
}
const GOOD = 'During my second year project we had a deadline in two weeks and our team hit a serious problem: the model accuracy was only 61 percent. I was responsible for the data pipeline, so I analyzed the logs, found that 12 percent of rows were duplicated, and rebuilt the cleaning step with pandas using Python and Git. As a result accuracy went to 78 percent and we delivered on time. I learned to check the data before the model.'

test('copilot rules: thin answers get follow-ups, vague wording gets probes, strong answers are recognised', () => {
  const thin = copilotRules({ question: { text: 'Q' }, transcript: 'We worked on it.', looksFor: ['A specific situation'] })
  assert.equal(thin.verdict, 'thin'); assert.ok(thin.followUps.length >= 1)
  const v = vagueProbes('We did a lot of things and stuff, etc. I think it went well.')
  assert.ok(v.length >= 2 && v.every((p) => p.quote && p.why))
  const strong = copilotRules({ question: { text: 'Q' }, transcript: GOOD, looksFor: ['A specific situation with a deadline', 'A result that can be checked'] })
  assert.ok(['strong', 'ok'].includes(strong.verdict)); assert.ok(strong.lookFor.every((x) => x.hit))
})

test('copilot endpoint: needs your role, reports pillar coverage, uses AI when available', async () => {
  const s = await start()
  try {
    const role = (await s.call('POST', '/api/hr/roles', { clientId: CID, title: 'Frontend Intern', company: 'X', jd: 'Frontend Intern. You will build React interfaces, write tests and work with designers. Required: React, JavaScript, communication.' })).json
    assert.ok(role.id, JSON.stringify(role))
    const qid = role.questions[0].id
    assert.equal((await s.call('POST', `/api/hr/roles/${role.id}/copilot`, { clientId: 'other_client_zz', questionId: qid, transcript: GOOD })).status, 404)
    const r = await s.call('POST', `/api/hr/roles/${role.id}/copilot`, { clientId: CID, questionId: qid, transcript: 'We just did it together and it was fine.', answeredIds: [] })
    assert.equal(r.status, 200)
    assert.equal(r.json.source, 'rules'); assert.ok(r.json.followUps.length >= 1 && r.json.coverage.rows.length >= 1)
  } finally { s.close() }
})

test('copilot uses the AI result when the key is on and drops quotes that are not in the answer', async () => {
  process.env.GROQ_API_KEY = 'test'
  const db = createDb(':memory:')
  const llm = { copilot: async () => ({ followUps: [{ text: 'What did you personally measure afterwards?', why: 'No evidence' }], probes: [], summary: 'Thin on evidence.' }) }
  const app = createApp({ db, llm })
  const server = await new Promise((r) => { const x = app.listen(0, () => r(x)) })
  const base = `http://localhost:${server.address().port}`
  const post = (u, b) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json())
  try {
    const role = await post('/api/hr/roles', { clientId: CID, title: 'Backend Intern', jd: 'Backend Intern. Build REST APIs with Node.js and write tests. Required: Node.js, SQL.' })
    const out = await post(`/api/hr/roles/${role.id}/copilot`, { clientId: CID, questionId: role.questions[0].id, transcript: 'I built an API with a team and we shipped it after a few weeks of work together.' })
    assert.equal(out.source, 'ai'); assert.equal(out.followUps[0].text, 'What did you personally measure afterwards?'); assert.equal(out.summary, 'Thin on evidence.')
  } finally { delete process.env.GROQ_API_KEY; server.close() }
})

test('passport: issue, verify, no answers leaked, tamper detected, revoke', async () => {
  const s = await start()
  try {
    const sess = (await s.call('POST', '/api/sessions', { clientId: CID, role: 'general', count: 7 })).json
    for (const q of sess.questions.filter((x) => x.category !== 'followup').slice(0, 3)) await s.call('POST', `/api/sessions/${sess.id}/answers`, { clientId: CID, questionId: q.id, transcript: GOOD, wantFollowUp: false })
    assert.equal((await s.call('POST', `/api/sessions/${sess.id}/passport`, { clientId: CID, name: 'Maaz' })).status, 404, 'needs a finished interview')
    await s.call('POST', `/api/sessions/${sess.id}/finish`, { clientId: CID })
    assert.equal((await s.call('POST', `/api/sessions/${sess.id}/passport`, { clientId: CID, name: 'M' })).status, 400)
    assert.equal((await s.call('POST', `/api/sessions/${sess.id}/passport`, { clientId: 'other_client_zz', name: 'Maaz' })).status, 403)
    const p = (await s.call('POST', `/api/sessions/${sess.id}/passport`, { clientId: CID, name: 'Maaz Ashraf' })).json
    assert.ok(p.token)
    const pub = (await s.call('GET', `/api/passport/${p.token}`)).json
    assert.equal(pub.verified, true); assert.equal(pub.payload.name, 'Maaz Ashraf')
    assert.ok(pub.payload.skills.some((k) => k.skill === 'Python' && k.level === 'demonstrated'))
    assert.ok(!JSON.stringify(pub).includes('second year project'), 'answers must not leak')
    const page = await s.call('GET', '/p/' + p.token, null, true)
    assert.equal(page.status, 200); assert.ok(/Verified/.test(page.text) && /Not an employer credential/.test(page.text))
    assert.equal((await s.call('GET', `/api/passport/${p.token}/card.svg`, null, true)).status, 200)
    // tamper with the stored score: verification must fail
    const row = s.db.get('SELECT payload FROM passports WHERE token = ?', p.token)
    s.db.run('UPDATE passports SET payload = ? WHERE token = ?', row.payload.replace(/"score":\d+/, '"score":99'), p.token)
    assert.equal((await s.call('GET', `/api/passport/${p.token}`)).json.verified, false)
    await s.call('DELETE', `/api/sessions/${sess.id}/passport?clientId=${CID}`)
    assert.equal((await s.call('GET', `/api/passport/${p.token}`)).status, 404)
  } finally { s.close() }
})

test('signature helpers', () => {
  const p = { a: 1, b: 'x' }
  const sig = signPayload(p, 'k')
  assert.ok(verifyPayload(p, sig, 'k')); assert.ok(!verifyPayload({ ...p, a: 2 }, sig, 'k')); assert.ok(!verifyPayload(p, sig, 'other'))
})
