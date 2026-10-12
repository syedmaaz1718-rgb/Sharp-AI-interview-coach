import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './index.js'
import { createDb } from './db.js'
import { COMPANIES, templateCompanyQuestions, companyById } from './companies.js'

test('company list: 500+ unique entries, India and global, every one has a style', () => {
  assert.ok(COMPANIES.length >= 500)
  assert.equal(new Set(COMPANIES.map((c) => c.id)).size, COMPANIES.length)
  assert.equal(new Set(COMPANIES.map((c) => c.name.toLowerCase())).size, COMPANIES.length)
  assert.ok(COMPANIES.filter((c) => c.region === 'India').length > 200)
  assert.ok(COMPANIES.filter((c) => c.region === 'Global').length > 200)
  for (const n of ['tcs', 'amazon', 'google', 'hdfc-bank', 'swiggy']) assert.ok(companyById(n), n)
  assert.equal(companyById('amazon').style, 'amazon')
  assert.equal(companyById('tcs').style, 'mass')
})

test('company fallback questions are role and company specific, at least 7', () => {
  for (const id of ['amazon', 'tcs', 'hdfc-bank', 'swiggy']) {
    const qs = templateCompanyQuestions(companyById(id), 'Data Analyst', 7)
    assert.equal(qs.length, 7)
    assert.ok(qs.some((q) => /Data Analyst/.test(q.text)))
    assert.ok(qs.some((q) => q.text.includes(companyById(id).name)))
  }
})

test('company questions route: validation, template fallback, AI path', async () => {
  let seen = null
  const app = createApp({ db: createDb(':memory:'), llm: { company: async (a) => { seen = a; return Array.from({ length: 7 }, (_, i) => ({ text: `AI question number ${i} for ${a.company}`, category: 'technical', keywords: ['x'] })) } } })
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)) })
  const base = `http://localhost:${srv.address().port}`
  const post = (b) => fetch(base + '/api/company-questions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })
  try {
    assert.equal((await post({ company: 'nope', role: 'SDE' })).status, 400)
    assert.equal((await post({ company: 'tcs', role: '' })).status, 400)
    const ok = await (await post({ company: 'tcs', role: 'Software Engineer' })).json()
    assert.equal(ok.questions.length, 7)
    assert.match(ok.disclaimer, /Not official/)
    assert.equal(ok.source, 'template')
    const list = await (await fetch(base + '/api/companies')).json()
    assert.ok(list.count >= 500)
    assert.equal((await fetch(base + '/api/companies/zzz')).status, 404)
    process.env.GROQ_API_KEY = 'k'
    const ai = await (await post({ company: 'amazon', role: 'SDE Intern' })).json()
    assert.equal(ai.source, 'ai'); assert.equal(seen.company, 'Amazon'); assert.equal(seen.role, 'SDE Intern')
    const s = await fetch(base + '/api/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'guestabc12345', role: 'general', custom: ai.questions }) })
    assert.equal(s.status, 200)
  } finally { srv.close(); delete process.env.GROQ_API_KEY }
})
