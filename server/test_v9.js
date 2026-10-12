import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './index.js'
import { createDb } from './db.js'
import { judgeBattle, compareAttempts, biasAudit, nameCue } from './v9.js'
import { analyzeAnswer } from '../src/lib/analysis.js'

const CID = 'client_v9_test_1'
async function start() {
  const app = createApp({ db: createDb(':memory:') })
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  const base = `http://localhost:${server.address().port}`
  const call = async (method, url, body, raw) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
    return { status: res.status, json: raw ? null : await res.json().catch(() => null), text: raw ? await res.text() : null }
  }
  return { call, close: () => server.close() }
}
const GOOD = 'During my second year project we had a deadline in two weeks and our team hit a serious problem: the model accuracy was only 61 percent. I was responsible for the data pipeline, so I analyzed the logs, found that 12 percent of rows were duplicated, and rebuilt the cleaning step with pandas. As a result accuracy went to 78 percent and we delivered on time. I learned to check the data before the model.'
const WEAK = 'I worked in a team and it was fine.'

test('battle: two players, same questions, judged with a reason and a card', async () => {
  const s = await start()
  try {
    assert.equal((await s.call('POST', '/api/battles', { name: 'A' })).status, 400)
    const c = (await s.call('POST', '/api/battles', { name: 'Asha', role: 'general', count: 3 })).json
    assert.ok(c.token && c.key)
    const b = (await s.call('POST', `/api/battle/${c.token}/join`, { name: 'Kabir' })).json
    assert.equal((await s.call('POST', `/api/battle/${c.token}/join`, { name: 'Third' })).status, 409)
    const play = async (key, text) => {
      for (let i = 0; i < 3; i++) {
        const st = (await s.call('GET', `/api/battle/${c.token}?key=${key}`)).json
        assert.ok(st.me.next, 'next question')
        const r = await s.call('POST', `/api/battle/${c.token}/answer`, { key, questionId: st.me.next.id, transcript: text })
        assert.equal(r.status, 200)
      }
    }
    assert.equal((await s.call('GET', `/api/battle/${c.token}/result`)).json.ready, false)
    await play(c.key, GOOD)
    assert.equal((await s.call('GET', `/api/battle/${c.token}/result`)).json.ready, false)
    assert.equal((await s.call('POST', `/api/battle/${c.token}/answer`, { key: 'bad', questionId: 'x', transcript: GOOD })).status, 403)
    await play(b.key, WEAK + ' ' + WEAK)
    const r = (await s.call('GET', `/api/battle/${c.token}/result?key=${c.key}`)).json
    assert.equal(r.ready, true)
    assert.equal(r.winner, 'a')
    assert.equal(r.winnerName, 'Asha')
    assert.ok(r.scores.a > r.scores.b && r.rounds.length === 3 && /Asha/.test(r.reason))
    const card = await s.call('GET', `/api/battle/${c.token}/card.svg`, null, true)
    assert.equal(card.status, 200); assert.ok(/<svg/.test(card.text) && /Asha wins/.test(card.text))
    assert.equal((await s.call('GET', '/b/' + c.token, null, true)).status, 200)
  } finally { s.close() }
})

test('judgeBattle calls a tie when scores are close', () => {
  const qs = [{ id: 'q1', text: 'Q' }]
  const ans = { q1: { content: 7, words: 100, hit: 3, total: 5, nums: 1 } }
  assert.equal(judgeBattle(qs, { name: 'X', answers: ans }, { name: 'Y', answers: ans }).winner, 'tie')
})

test('rewind compares attempt 1 to attempt 2 with real deltas', async () => {
  const s = await start()
  try {
    const sess = (await s.call('POST', '/api/sessions', { clientId: CID, role: 'general', count: 7 })).json
    const q = sess.questions.find((x) => x.category !== 'followup')
    assert.equal((await s.call('POST', `/api/sessions/${sess.id}/rewind`, { clientId: CID, questionId: q.id, transcript: GOOD })).status, 409)
    await s.call('POST', `/api/sessions/${sess.id}/answers`, { clientId: CID, questionId: q.id, transcript: WEAK, wantFollowUp: false })
    assert.equal((await s.call('POST', `/api/sessions/${sess.id}/rewind`, { clientId: 'other_client_xx', questionId: q.id, transcript: GOOD })).status, 403)
    const r = await s.call('POST', `/api/sessions/${sess.id}/rewind`, { clientId: CID, questionId: q.id, transcript: GOOD })
    assert.equal(r.status, 200)
    assert.ok(r.json.after > r.json.before && r.json.delta > 0 && r.json.verdict === 'improved')
    assert.ok(r.json.gains.length >= 1 && r.json.attempt === 2)
    assert.ok(r.json.gains.every((g) => !/NaN|undefined|,/.test(g)), JSON.stringify(r.json.gains))
    const list = (await s.call('GET', `/api/sessions/${sess.id}/rewinds?clientId=${CID}`)).json
    assert.equal(list.rewinds.length, 1)
    // the original attempt is untouched
    const rep = await s.call('POST', `/api/sessions/${sess.id}/finish`, { clientId: CID })
    assert.equal(rep.status, 200)
  } finally { s.close() }
})

test('compareAttempts reports a decline honestly', () => {
  const q = { text: 'Tell me about a time you led', category: 'behavioral', keywords: ['led', 'team', 'result'] }
  const a = analyzeAnswer({ question: q, transcript: GOOD, durationSec: 60, input: 'typed', metrics: {} })
  const b = analyzeAnswer({ question: q, transcript: WEAK, durationSec: 10, input: 'typed', metrics: {} })
  const c = compareAttempts(a, b, { bText: GOOD, aText: WEAK })
  assert.equal(c.verdict, 'declined'); assert.ok(c.delta < 0)
})

test('bias audit: flags a real gap, stays quiet on small samples, ignores unknown names', () => {
  assert.equal(nameCue('Priya Nair'), 'female-coded'); assert.equal(nameCue('Rahul K'), 'male-coded'); assert.equal(nameCue('Zxq'), null)
  const mk = (name, rating, baseline) => ({ name, college: '', rating, baseline })
  const biased = []
  for (let i = 0; i < 8; i++) biased.push(mk('Rahul', 4.2 + (i % 2) * 0.2, 3 + (i % 3) * 0.1), mk('Priya', 2.6 + (i % 2) * 0.2, 3 + (i % 3) * 0.1))
  const a = biasAudit(biased)
  assert.equal(a.checks.find((c) => c.cue === 'name').status, 'flag')
  const fair = []
  for (let i = 0; i < 8; i++) fair.push(mk('Rahul', 3.2 + (i % 2) * 0.2, 3 + (i % 3) * 0.1), mk('Priya', 3.2 + (i % 2) * 0.2, 3 + (i % 3) * 0.1))
  assert.equal(biasAudit(fair).checks.find((c) => c.cue === 'name').status, 'clear')
  const small = biasAudit([mk('Rahul', 5, 3), mk('Priya', 1, 3)])
  assert.equal(small.checks.find((c) => c.cue === 'name').status, 'insufficient')
  assert.ok(a.method.length >= 4)
})

test('audit endpoint only uses completed screening candidates with human ratings', async () => {
  const s = await start()
  try {
    const r = (await s.call('GET', `/api/hr/audit?clientId=${CID}`)).json
    assert.equal(r.usable, 0); assert.equal(r.flags, 0)
    assert.equal((await s.call('GET', '/api/hr/audit?clientId=!!')).status, 400)
  } finally { s.close() }
})
