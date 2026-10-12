import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './index.js'
import { createDb } from './db.js'
import { gapAnalysis, authenticity, computeSharpScore, scoreCandidate, compareCandidates, hrTemplateQuestions, normalizeHrPack, stressPushback, pickLangQuestions, similarity } from './v8.js'
import { countFillers, scoreAnswerContent, tokenize } from '../src/lib/analysis.js'

const CID = 'client_v8_test_1'
async function start(opts) {
  const app = createApp({ db: createDb(':memory:'), ...opts })
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  const base = `http://localhost:${server.address().port}`
  const call = async (method, url, body, raw) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    return { status: res.status, json: raw ? null : await res.json().catch(() => null), text: raw ? await res.text() : null }
  }
  return { call, close: () => server.close() }
}
const GOOD = 'During my second year project we had a deadline in two weeks and our team hit a serious problem: the model accuracy was only 61 percent. I was responsible for the data pipeline, so I analyzed the logs, found that 12 percent of rows were duplicated, and rebuilt the cleaning step. As a result accuracy went to 78 percent and we delivered on time. I learned to check the data before the model.'

test('gap analysis finds missing skills and says how to cover them', () => {
  const g = gapAnalysis('Backend Intern\nRequired: Node.js, PostgreSQL, Docker.\nNice to have: Kubernetes', 'Projects: built an API with Node.js and Express. Skills: Python, Git')
  assert.ok(g.matched.some((m) => m.skill === 'Node.js'))
  const docker = g.missing.find((m) => m.skill === 'Docker')
  assert.ok(docker && docker.how.length >= 1 && docker.proof)
  assert.equal(g.missing.find((m) => m.skill === 'Kubernetes').importance, 'nice')
  assert.ok(g.matchPct > 0 && g.matchPct < 100)
  assert.ok(g.focusQuestions.length >= 1 && /Docker|SQL/.test(g.focusQuestions[0].text))
})

test('gap endpoint validates and feeds question generation', async () => {
  const s = await start()
  try {
    assert.equal((await s.call('POST', '/api/gap', { jd: 'x', resume: 'y' })).status, 400)
    const jd = 'Backend Intern\nRequired: Node.js, PostgreSQL, Docker. You will build REST APIs and write tests.'
    const resume = 'Projects\n- Built a chat app with Node.js and Express\n- Weather dashboard with React\nSkills: Python, Git, JavaScript'
    const g = await s.call('POST', '/api/gap', { jd, resume })
    assert.equal(g.status, 200)
    assert.ok(g.json.missing.length >= 2)
    const t = await s.call('POST', '/api/tailored-questions', { jd, resume, count: 7 })
    assert.equal(t.json.questions.length, 7)
    assert.ok(t.json.gap.missing.length)
    assert.ok(t.json.questions.some((q) => /not on your resume/.test(q.text)))
  } finally { s.close() }
})

test('hindi / hinglish text is understood by the scorer', () => {
  assert.ok(tokenize('मैंने प्रोजेक्ट बनाया').length === 3)
  const f = countFillers('matlab basically maine ek project banaya matlab ye kaam kiya', 'hinglish')
  assert.equal(f.total, 3)
  assert.equal(countFillers('matlab basically', 'en').total, 1)
  const q = { category: 'behavioral', text: 'Apne project ke baare mein batao', keywords: ['project'] }
  const hi = 'Jab hum college mein the to ek project mein problem aayi. Maine data ko test kiya kyunki accuracy 60 percent thi. Maine banaya ek naya pipeline aur natija ye raha ki accuracy 80 percent ho gayi, maine isse bahut seekha.'
  assert.ok(scoreAnswerContent(q, hi, 'hinglish').parts.structure > scoreAnswerContent(q, hi, 'en').parts.structure)
  assert.ok(scoreAnswerContent({ ...q, keywords: [] }, 'मैंने प्रोजेक्ट बनाया क्योंकि समस्या थी और नतीजा अच्छा रहा। मैंने सीखा', 'hindi').words >= 8)
})

test('language banks and stress pushbacks', () => {
  for (const l of ['hinglish', 'hindi']) {
    const qs = pickLangQuestions(l, 7)
    assert.equal(qs.length, 7)
    assert.equal(qs[0].category, 'intro')
    assert.equal(new Set(qs.map((q) => q.text)).size, 7)
  }
  assert.match(stressPushback({ question: { id: 'x' }, transcript: 'I did it.', lang: 'en' }), /example|more than that|convince/i)
  assert.match(stressPushback({ question: { id: 'x' }, transcript: GOOD.replace(/\d/g, 'x'), lang: 'en' }), /proof|number/i)
  assert.ok(/[\u0900-\u097F]/.test(stressPushback({ question: { id: 'x' }, transcript: 'ok', lang: 'hindi' })))
})

test('stress + hinglish session: pushback every time, language stored, score and share link', async () => {
  const s = await start()
  try {
    const st = await s.call('POST', '/api/sessions', { clientId: CID, role: 'general', count: 7, lang: 'hinglish', stress: true })
    assert.equal(st.json.lang, 'hinglish')
    assert.equal(st.json.stress, true)
    assert.equal(st.json.questions.length, 7)
    assert.ok(/[a-z]/.test(st.json.questions[0].text) && !/Tell me about yourself/.test(st.json.questions[0].text))
    const id = st.json.id
    const q0 = st.json.questions[0]
    const a = await s.call('POST', `/api/sessions/${id}/answers`, { clientId: CID, questionId: q0.id, transcript: GOOD, durationSec: 55, input: 'typed', metrics: {} })
    assert.ok(a.json.followUp, 'stress mode always pushes back, even on a strong answer')
    const fu = await s.call('POST', `/api/sessions/${id}/answers`, { clientId: CID, questionId: a.json.followUp.id, transcript: GOOD, durationSec: 40, input: 'typed', metrics: {} })
    assert.equal(fu.status, 200)
    const rep = await s.call('POST', `/api/sessions/${id}/finish`, { clientId: CID })
    assert.equal(rep.json.mode, 'stress')
    const sc = await s.call('GET', `/api/sessions/${id}/score`)
    assert.ok(sc.json.score >= 0 && sc.json.score <= 100)
    assert.ok(sc.json.dims.some((d) => d.key === 'followups'))
    assert.equal((await s.call('POST', `/api/sessions/${id}/share`, { clientId: 'someone_else_123456', name: 'x' })).status, 403)
    const sh = await s.call('POST', `/api/sessions/${id}/share`, { clientId: CID, name: 'Asha <b>K</b>' })
    assert.ok(sh.json.token)
    assert.equal((await s.call('GET', `/api/score/${sh.json.token}`)).json.score, sc.json.score)
    const svg = await s.call('GET', `/api/score/${sh.json.token}/card.svg`, null, true)
    assert.match(svg.text, /<svg/)
    assert.ok(!svg.text.includes('<b>'))
    const page = await s.call('GET', `/s/${sh.json.token}`, null, true)
    assert.match(page.text, /og:title/)
    await s.call('POST', `/api/sessions/${id}/share`, { clientId: CID, enable: false })
    assert.equal((await s.call('GET', `/api/score/${sh.json.token}`)).status, 404)
  } finally { s.close() }
})

test('sharp score uses only real report data', () => {
  assert.equal(computeSharpScore(null), null)
  const rep = { scores: { answer: 8, voice: null, face: null }, answers: [{ score: 8 }, { score: 8 }, { score: 8, followUp: true }] }
  const sc = computeSharpScore(rep)
  assert.ok(sc.dims.every((d) => d.key !== 'communication'))
  assert.ok(sc.score >= 75 && sc.score <= 95)
})

test('authenticity flags pasted and stock-phrase answers, stays quiet on natural ones', () => {
  const ai = 'Furthermore, it is important to note that a robust and seamless approach plays a crucial role. Moreover, leveraging a holistic paradigm fosters synergy across teams in the ever-evolving landscape of software engineering today.'
  const bad = authenticity({ transcript: ai, input: 'typed', meta: { pasted: true } })
  assert.ok(bad.score < 45, 'score ' + bad.score)
  assert.equal(bad.level, 'Review suggested')
  assert.ok(bad.signals.some((s) => s.label === 'Text was pasted'))
  const good = authenticity({ transcript: GOOD, input: 'speech', durationSec: 60 })
  assert.ok(good.score >= 70, 'score ' + good.score)
  assert.equal(authenticity({ transcript: 'too short', input: 'typed' }).score, null)
  assert.match(good.disclaimer, /not proof/)
  assert.ok(similarity(GOOD, GOOD) > 0.9)
  assert.ok(similarity(GOOD, 'completely different words about cooking pasta with garlic and olive oil at home on a weekend') < 0.1)
})

test('HR scorecard math, pillars and comparison', () => {
  const qs = hrTemplateQuestions('React and Node.js developer. Must lead stakeholder meetings.', 8)
  assert.equal(qs.length, 8)
  assert.ok(qs.every((q) => q.looksFor.length && q.text.length > 15))
  const raw = normalizeHrPack(null, 'React and Node.js developer. Must lead stakeholder meetings and mentor others.', 8)
  assert.equal(raw.source, 'template')
  assert.ok(raw.rubric.some((c) => c.id === 'leadership'))
  const role = { rubric: raw.rubric, questions: raw.questions }
  const rate = (n) => Object.fromEntries(role.questions.map((q) => [q.id, { score: n }]))
  assert.equal(scoreCandidate(role.rubric, role.questions, rate(5)).recommendation, 'Strong hire')
  assert.equal(scoreCandidate(role.rubric, role.questions, rate(1)).recommendation, 'No hire')
  assert.equal(scoreCandidate(role.rubric, role.questions, {}).overall, null)
  const c = compareCandidates(role, [{ id: 'a', name: 'A', ratings: rate(3) }, { id: 'b', name: 'B', ratings: rate(5) }, { id: 'c', name: 'C', ratings: {} }])
  assert.deepEqual(c.candidates.map((x) => x.name), ['B', 'A', 'C'])
  assert.equal(c.candidates[2].rank, null)
})

test('interviewer mode end to end: custom pillars, screening link, authenticity, leaderboard, shortlist', async () => {
  const s = await start()
  try {
    const jd = 'Frontend Intern at Acme. You will build React interfaces, write tests and talk to designers. Required: React, JavaScript, Git.'
    assert.equal((await s.call('POST', '/api/hr/roles', { clientId: CID, title: 'FE', jd: 'short' })).status, 400)
    const pillars = [{ name: 'Ownership', weight: 40, description: 'Takes charge' }, { name: 'Hustle', weight: 30 }, { name: 'Craft', weight: 30 }]
    const role = (await s.call('POST', '/api/hr/roles', { clientId: CID, title: 'Frontend Intern', company: 'Acme', jd, count: 8, pillars })).json
    assert.deepEqual(role.rubric.map((r) => r.name), ['Ownership', 'Hustle', 'Craft'])
    assert.ok(role.questions.length >= 8)
    assert.ok(role.questions.every((q) => role.rubric.some((r) => r.id === q.competency)))
    assert.equal((await s.call('GET', `/api/hr/roles/${role.id}?clientId=other_client_9999`)).status, 404)
    // screening link
    const link = (await s.call('POST', `/api/hr/roles/${role.id}/screening`, { clientId: CID, open: true })).json
    assert.match(link.path, /^\/screen\//)
    const tok = link.path.split('/').pop()
    const pub = await s.call('GET', `/api/screen/${tok}`)
    assert.equal(pub.json.title, 'Frontend Intern')
    assert.ok(!JSON.stringify(pub.json).includes('Tell me about'), 'questions stay hidden before the interview')
    assert.equal((await s.call('POST', `/api/screen/${tok}/start`, { name: 'Ravi' })).status, 400)
    const run = async (name, texts, meta) => {
      const st = (await s.call('POST', `/api/screen/${tok}/start`, { name, consent: true })).json
      let q = st.question
      let i = 0
      while (q) {
        const r = (await s.call('POST', `/api/screen/${tok}/answer`, { candidateId: st.candidateId, key: st.key, questionId: q.id, transcript: texts[i % texts.length], durationSec: 60, input: 'typed', meta })).json
        i++
        q = r.done ? null : r.question
        assert.ok(i < 30)
      }
      assert.equal((await s.call('POST', `/api/screen/${tok}/answer`, { candidateId: st.candidateId, key: 'wrong', questionId: 'q1', transcript: 'x' })).status, 403)
      assert.equal((await s.call('POST', `/api/screen/${tok}/finish`, { candidateId: st.candidateId, key: st.key })).status, 200)
      return st.candidateId
    }
    const a = await run('Asha', [GOOD], { typedMs: 90000 })
    const b = await run('Ravi', ['Furthermore, it is important to note that a robust and seamless approach plays a crucial role. Moreover, leveraging a holistic paradigm fosters synergy across all of the teams in the ever-evolving software landscape, which underscores a comprehensive understanding.'], { pasted: true })
    const board = (await s.call('GET', `/api/hr/roles/${role.id}/leaderboard?clientId=${CID}`)).json
    assert.equal(board.candidates.length, 2)
    const ra = board.candidates.find((c) => c.id === a)
    const rb = board.candidates.find((c) => c.id === b)
    assert.ok(ra.overall > rb.overall)
    assert.equal(board.candidates[0].id, a)
    assert.ok(rb.authenticity.flagged >= 1, 'pasted stock-phrase answers are flagged')
    assert.ok(ra.authenticity.score > rb.authenticity.score)
    assert.ok(ra.reason.length > 20)
    // recruiter override + shortlist
    const det = (await s.call('GET', `/api/hr/candidates/${a}?clientId=${CID}`)).json
    assert.ok(Object.values(det.authenticity).length >= 1)
    const put = await s.call('PUT', `/api/hr/candidates/${a}`, { clientId: CID, shortlisted: true, decision: 'Hire', notes: 'Strong', ratings: { [role.questions[0].id]: { score: 2, note: 'weak' } } })
    assert.equal(put.json.candidate.shortlisted, true)
    assert.equal(put.json.score.rated, 1)
    assert.equal((await s.call('PUT', `/api/hr/candidates/${a}`, { clientId: 'intruder_client_1', shortlisted: false })).status, 404)
    // closed link
    await s.call('POST', `/api/hr/roles/${role.id}/screening`, { clientId: CID, open: false })
    assert.equal((await s.call('POST', `/api/screen/${tok}/start`, { name: 'Late', consent: true })).status, 403)
    // manual scorecard + suggestion
    const man = (await s.call('POST', `/api/hr/roles/${role.id}/candidates`, { clientId: CID, name: 'Walk-in' })).json
    const sug = (await s.call('POST', `/api/hr/roles/${role.id}/suggest`, { clientId: CID, questionId: role.questions[0].id, transcript: GOOD })).json
    assert.ok(sug.suggested >= 1 && sug.suggested <= 5)
    const list = (await s.call('GET', `/api/hr/roles?clientId=${CID}`)).json
    assert.equal(list.roles[0].candidates, 3)
    assert.ok(man.id)
    assert.equal((await s.call('DELETE', `/api/hr/roles/${role.id}?clientId=${CID}`)).status, 200)
  } finally { s.close() }
})
