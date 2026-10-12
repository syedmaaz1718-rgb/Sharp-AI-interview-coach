// v8 routes: gap analysis, SharpAI Score sharing, interviewer (HR) mode, async screening links.
import { svgToPng, scorePdf, brandSvg } from './raster.js'
import crypto from 'node:crypto'
import { ROLES } from './questions.js'
import { analyzeAnswer, scoreAnswerContent, tokenize, round1, num } from '../src/lib/analysis.js'
import { llmEnabled, allowLlmCall, llmHrPack, llmReasons, llmFollowUp, llmLangFollowUp } from './llm.js'
import { templateFollowUp } from './resume.js'
import {
  gapAnalysis, computeSharpScore, scoreCardSvg, normalizeHrPack, scoreCandidate, compareCandidates, suggestRating,
  authenticity, similarity, reasonFor, cleanLang, defaultRubric, extractSkills, langFollowUp, AUTH_DISCLAIMER,
} from './v8.js'

const now = () => new Date().toISOString()
const clip = (s, n) => String(s || '').trim().slice(0, n)
const rid = (n = 9) => crypto.randomBytes(n).toString('base64url')
const parse = (s, d) => { try { return JSON.parse(s) } catch { return d } }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function cleanPillars(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const p of list) {
    const name = clip(p?.name, 50)
    if (name.length < 2 || out.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue
    out.push({ name, description: clip(p?.description, 140), weight: Math.max(5, Math.min(60, Math.round(Number(p?.weight) || 20))) })
    if (out.length >= 7) break
  }
  return out
}

// A pack built around company pillars (no AI key): one question per pillar plus skill questions mapped onto pillars.
function pillarRubric(pillars) {
  return pillars.map((p, i) => ({
    id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'p' + i,
    name: p.name, weight: p.weight, description: p.description || `How strongly the candidate shows ${p.name}`,
    anchors: { 1: `No evidence of ${p.name}`, 3: `Some evidence of ${p.name}, not consistent`, 5: `Clear, repeated, specific evidence of ${p.name}` },
  }))
}

export function registerV8(app, { db, owner, llm = {} }) {
  const L = { reasons: llmReasons, hrPack: llmHrPack, followUp: llmFollowUp, langFollowUp: llmLangFollowUp, ...llm }
  const me = (req) => owner(req, req.body?.clientId || req.query?.clientId)
  const guard = (req, res) => { const c = me(req); if (!c) { res.status(400).json({ error: 'Invalid clientId' }); return null } return c }

  // ------------------------------------------------ gap analysis
  app.post('/api/gap', (req, res) => {
    const jd = clip(req.body?.jd, 8000)
    const resume = clip(req.body?.resume, 8000)
    if (jd.length < 40 || resume.length < 40) return res.status(400).json({ error: 'Paste both the job description and your resume (a few lines each).' })
    const g = gapAnalysis(jd, resume)
    if (!g.jdSkills) return res.status(400).json({ error: 'No recognizable skills found in the job description. Paste the requirements section.' })
    res.json(g)
  })

  // ------------------------------------------------ SharpAI Score
  const roleLabel = (s) => (s.role.startsWith('pack:') ? s.role.slice(5).replace(/^./, (c) => c.toUpperCase()) + ' style' : ROLES.find((r) => r.id === s.role)?.label || 'Mock interview')
  const cardOf = (s) => {
    const rep = parse(s.report, null)
    if (!rep) return null
    const sc = computeSharpScore({ ...rep, mode: s.mode })
    if (!sc) return null
    return { ...sc, name: s.share_name || '', role: rep.roleLabel || roleLabel(s), mode: s.mode, lang: s.lang, date: rep.finishedAt }
  }
  app.get('/api/sessions/:id/score', (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s || s.status !== 'finished') return res.status(404).json({ error: 'Report not found' })
    const c = cardOf(s)
    if (!c) return res.status(404).json({ error: 'No score yet' })
    res.json({ ...c, shared: !!s.share_token, token: s.share_token || null })
  })
  app.get('/api/sessions/:id/score.pdf', async (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s || s.status !== 'finished') return res.status(404).json({ error: 'Report not found' })
    const c = cardOf(s)
    if (!c) return res.status(404).json({ error: 'No score yet' })
    const name = String(req.query.name || c.name || '').replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 40)
    const card = { ...c, name }
    const pdf = await scorePdf(card, scoreCardSvg(card))
    res.type('application/pdf').set('Content-Disposition', 'attachment; filename="sharpai-score.pdf"').send(pdf)
  })
  app.post('/api/sessions/:id/share', (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s || s.status !== 'finished') return res.status(404).json({ error: 'Report not found' })
    if (owner(req, req.body?.clientId) !== s.client_id) return res.status(403).json({ error: 'Not your session' })
    if (req.body?.enable === false) {
      db.run('UPDATE sessions SET share_token = NULL WHERE id = ?', s.id)
      return res.json({ shared: false })
    }
    const token = s.share_token || rid(10)
    const name = clip(req.body?.name ?? s.share_name, 40).replace(/[<>]/g, '')
    db.run('UPDATE sessions SET share_token = ?, share_name = ? WHERE id = ?', token, name, s.id)
    res.json({ shared: true, token, path: '/s/' + token, name })
  })
  const byToken = (token) => (/^[A-Za-z0-9_-]{8,40}$/.test(token) ? db.get('SELECT * FROM sessions WHERE share_token = ? AND status = ?', token, 'finished') : null)
  app.get('/api/score/:token', (req, res) => {
    const s = byToken(req.params.token)
    const c = s && cardOf(s)
    if (!c) return res.status(404).json({ error: 'This score link is not available' })
    res.json(c)
  })
  app.get('/api/score/:token/card.svg', (req, res) => {
    const s = byToken(req.params.token)
    const c = s && cardOf(s)
    if (!c) return res.status(404).type('text/plain').send('Not found')
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=300').send(scoreCardSvg(c))
  })
  app.get('/api/score/:token/card.png', (req, res) => {
    const s = byToken(req.params.token)
    const c = s && cardOf(s)
    if (!c) return res.status(404).type('text/plain').send('Not found')
    res.type('image/png').set('Cache-Control', 'public, max-age=300').send(svgToPng(scoreCardSvg(c)))
  })
  app.get('/api/score/:token/card.pdf', async (req, res) => {
    const s = byToken(req.params.token)
    const c = s && cardOf(s)
    if (!c) return res.status(404).type('text/plain').send('Not found')
    const pdf = await scorePdf(c, scoreCardSvg(c))
    res.type('application/pdf').set('Content-Disposition', 'attachment; filename="sharpai-score.pdf"').set('Cache-Control', 'public, max-age=300').send(pdf)
  })
  // Public page with Open Graph tags so the link previews well when pasted into LinkedIn or WhatsApp.
  app.get('/s/:token', (req, res) => {
    const s = byToken(req.params.token)
    const c = s && cardOf(s)
    if (!c) return res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><title>SharpAI</title><body style="font-family:sans-serif;background:#0b1020;color:#fff;display:grid;place-items:center;height:100vh"><div><h1>This score link is not available</h1><p><a style="color:#2dd4bf" href="/">Practice with SharpAI</a></p></div>')
    const origin = `${req.protocol}://${req.get('host')}`
    const title = `${c.name ? c.name + ' scored ' : 'SharpAI Score: '}${c.score}/100 (${c.band}) on SharpAI`
    const desc = `${c.role} mock interview. Strongest: ${c.strongest || 'n/a'}. Scored from real answers: content, voice, presence and consistency.`
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${esc(origin + '/s/' + req.params.token)}"><meta property="og:image" content="${esc(origin + '/api/score/' + req.params.token + '/card.png')}"><meta name="twitter:card" content="summary_large_image">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#fff;font-family:Inter,system-ui,Arial,sans-serif;background-image:radial-gradient(60% 50% at 20% 10%,#2dd4bf33,transparent),radial-gradient(50% 50% at 90% 90%,#a78bfa33,transparent)}main{width:min(960px,92vw);text-align:center;padding:24px 0}img{width:100%;border-radius:22px;box-shadow:0 30px 80px #000a,0 0 0 1px #ffffff1f}a.b{display:inline-block;margin-top:26px;padding:14px 26px;border-radius:999px;background:linear-gradient(90deg,#2dd4bf,#a78bfa);color:#06101c;font-weight:700;text-decoration:none}p{color:#9fb0e8}</style></head>
<body><main><img src="/api/score/${esc(req.params.token)}/card.svg" alt="${esc(title)}"><p>${esc(desc)}</p><a class="b" href="/">Take your own SharpAI interview</a></main></body></html>`)
  })

  // ------------------------------------------------ interviewer (HR) roles
  const roleRow = (id) => db.get('SELECT * FROM hr_roles WHERE id = ?', id)
  const roleObj = (r) => ({ id: r.id, title: r.title, company: r.company, lang: r.lang, jd: r.jd, questions: parse(r.questions, []), rubric: parse(r.rubric, []), source: r.source, screening: { open: !!r.screen_open, token: r.screen_token || null, path: r.screen_token ? '/screen/' + r.screen_token : null }, createdAt: r.created_at })
  const mine = (req, res) => {
    const c = guard(req, res); if (!c) return null
    const r = roleRow(req.params.id)
    if (!r || r.client_id !== c) { res.status(404).json({ error: 'Role not found' }); return null }
    return r
  }

  app.post('/api/hr/roles', async (req, res) => {
    const c = guard(req, res); if (!c) return
    const title = clip(req.body?.title, 100)
    const jd = clip(req.body?.jd, 8000)
    if (title.length < 2) return res.status(400).json({ error: 'Give the role a title.' })
    if (jd.length < 60) return res.status(400).json({ error: 'Paste the job description (a few lines at least).' })
    const lang = cleanLang(req.body?.lang)
    const count = Math.max(6, Math.min(14, Number(req.body?.count) || 8))
    const pillars = cleanPillars(req.body?.pillars)
    let raw = null
    if (llmEnabled() && allowLlmCall(req.ip)) raw = await L.hrPack({ jd, title, count, lang, pillars })
    let pack = normalizeHrPack(raw, jd, count, lang)
    if (pillars.length) {
      const rubric = pillarRubric(pillars)
      if (pack.source === 'ai') {
        // keep AI questions but force them onto the company's pillars
        const ids = new Set(rubric.map((p) => p.id))
        const keepIds = pack.rubric.filter((p) => ids.has(p.id))
        pack = { ...pack, rubric: keepIds.length === rubric.length ? pack.rubric.map((p) => ({ ...p, weight: rubric.find((x) => x.id === p.id).weight })) : rubric, questions: pack.questions.map((q, i) => ({ ...q, competency: ids.has(q.competency) ? q.competency : rubric[i % rubric.length].id })) }
        if (keepIds.length !== rubric.length) pack.rubric = rubric
      } else {
        const base = pack.questions
        const hi = lang !== 'en'
        const qs = rubric.map((p) => ({
          competency: p.id,
          text: hi ? `Ek example do jab tumne "${p.name}" dikhaya. Situation kya thi, tumne kya kiya aur result kya raha?` : `Tell me about a time you showed ${p.name}. What was the situation, what did you do, and what was the result?`,
          looksFor: ['A specific situation, not a general claim', 'Clear personal actions', 'A result that can be checked', p.description].filter(Boolean),
          redFlags: ['Only "we", no personal role', 'Cannot give a concrete example'], followUps: [hi ? 'Dobara ho to kya alag karoge?' : 'What would you do differently next time?'],
        }))
        const tech = base.filter((q) => q.competency === 'technical').map((q, i) => ({ ...q, competency: rubric[i % rubric.length].id }))
        const rest = base.filter((q) => q.competency !== 'technical').map((q, i) => ({ ...q, competency: rubric[(i + 1) % rubric.length].id }))
        pack = { rubric, questions: [...qs, ...tech, ...rest].slice(0, Math.max(count, rubric.length)).map((q, i) => ({ ...q, id: 'q' + (i + 1) })), source: 'template' }
      }
    }
    const id = rid()
    db.run('INSERT INTO hr_roles (id, client_id, title, company, jd, lang, questions, rubric, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', id, c, title, clip(req.body?.company, 80), jd, lang, JSON.stringify(pack.questions), JSON.stringify(pack.rubric), pack.source, now())
    res.json(roleObj(roleRow(id)))
  })

  app.get('/api/hr/roles', (req, res) => {
    const c = guard(req, res); if (!c) return
    const rows = db.all('SELECT * FROM hr_roles WHERE client_id = ? ORDER BY created_at DESC LIMIT 100', c)
    res.json({ roles: rows.map((r) => {
      const cands = db.all('SELECT status, shortlisted FROM hr_candidates WHERE role_id = ?', r.id)
      return { id: r.id, title: r.title, company: r.company, lang: r.lang, questions: parse(r.questions, []).length, pillars: parse(r.rubric, []).length, screeningOpen: !!r.screen_open, candidates: cands.length, completed: cands.filter((x) => x.status === 'complete').length, shortlisted: cands.filter((x) => x.shortlisted).length, createdAt: r.created_at }
    }) })
  })

  const candRow = (c) => ({ id: c.id, name: c.name, email: c.email, college: c.college || '', source: c.source, status: c.status, ratings: parse(c.ratings, {}), answers: parse(c.answers, {}), notes: c.notes, decision: c.decision, shortlisted: !!c.shortlisted, createdAt: c.created_at, completedAt: c.completed_at })

  // authenticity per candidate: screening answers plus any transcripts dictated into a manual scorecard
  const candAuth = (cand) => {
    const out = {}
    for (const [qid, a] of Object.entries(cand.answers)) out[qid] = authenticity({ transcript: a.transcript, input: a.input, durationSec: a.durationSec, meta: a.meta })
    for (const [qid, r] of Object.entries(cand.ratings)) if (!out[qid] && r.transcript) out[qid] = authenticity({ transcript: r.transcript, input: 'speech', durationSec: r.durationSec || undefined })
    return out
  }
  const authSummary = (auth) => {
    const scored = Object.values(auth).filter((a) => a.score != null)
    return { score: scored.length ? Math.round(scored.reduce((x, a) => x + a.score, 0) / scored.length) : null, flagged: scored.filter((a) => a.score < 45).length, checked: scored.length }
  }

  const leaderboard = async (role, req) => {
    const cands = db.all('SELECT * FROM hr_candidates WHERE role_id = ?', role.id).map(candRow)
    const cmp = compareCandidates(role, cands.map((c) => ({ ...c, ratings: c.ratings })))
    const auth = Object.fromEntries(cands.map((c) => [c.id, candAuth(c)]))
    // cross-candidate similarity per question: identical wording between two candidates is a real signal
    const sims = {}
    for (const q of role.questions) {
      const texts = cands.map((c) => [c.id, c.answers[q.id]?.transcript || c.ratings[q.id]?.transcript || '']).filter(([, t]) => t)
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
        const s = similarity(texts[i][1], texts[j][1])
        if (s >= 0.4) for (const [a, b] of [[i, j], [j, i]]) (sims[texts[a][0]] ||= []).push({ questionId: q.id, with: cands.find((c) => c.id === texts[b][0])?.name, similarity: Math.round(s * 100) })
      }
    }
    for (const r of cmp.candidates) {
      const a = authSummary(auth[r.id])
      const c = cands.find((x) => x.id === r.id)
      r.authenticity = a
      r.flagged = a.flagged + (sims[r.id]?.length || 0)
      r.similar = sims[r.id] || []
      r.status = c.status
      r.shortlisted = c.shortlisted
      r.source = c.source
      r.reason = reasonFor(r)
    }
    let aiReasons = null
    const ranked = cmp.candidates.filter((r) => r.overall != null)
    if (ranked.length && llmEnabled() && allowLlmCall(req.ip)) aiReasons = await L.reasons({ role: role.title, rows: ranked })
    if (aiReasons) for (const r of ranked) if (typeof aiReasons[r.id] === 'string' && aiReasons[r.id].length > 10) { r.reason = clip(aiReasons[r.id], 400); r.reasonSource = 'ai' }
    return { ...cmp, aiReasons: !!aiReasons }
  }

  app.get('/api/hr/roles/:id', async (req, res) => {
    const r = mine(req, res); if (!r) return
    const role = roleObj(r)
    res.json({ role, board: await leaderboard(role, req), disclaimer: AUTH_DISCLAIMER })
  })
  app.put('/api/hr/roles/:id', (req, res) => {
    const r = mine(req, res); if (!r) return
    const role = roleObj(r)
    const title = clip(req.body?.title, 100) || role.title
    let rubric = role.rubric
    if (Array.isArray(req.body?.weights)) {
      rubric = rubric.map((c) => { const w = req.body.weights.find((x) => x.id === c.id); return w ? { ...c, weight: Math.max(5, Math.min(60, Math.round(Number(w.weight) || c.weight))) } : c })
    }
    db.run('UPDATE hr_roles SET title = ?, rubric = ?, company = ? WHERE id = ?', title, JSON.stringify(rubric), req.body?.company == null ? r.company : clip(req.body.company, 80), r.id)
    res.json(roleObj(roleRow(r.id)))
  })
  app.delete('/api/hr/roles/:id', (req, res) => {
    const r = mine(req, res); if (!r) return
    db.run('DELETE FROM hr_roles WHERE id = ?', r.id)
    res.json({ ok: true })
  })

  // async screening link
  app.post('/api/hr/roles/:id/screening', (req, res) => {
    const r = mine(req, res); if (!r) return
    const open = req.body?.open !== false
    const token = r.screen_token || rid(12)
    db.run('UPDATE hr_roles SET screen_token = ?, screen_open = ? WHERE id = ?', token, open ? 1 : 0, r.id)
    res.json({ open, token, path: '/screen/' + token })
  })

  app.post('/api/hr/roles/:id/candidates', (req, res) => {
    const r = mine(req, res); if (!r) return
    const name = clip(req.body?.name, 80)
    if (name.length < 2) return res.status(400).json({ error: 'Enter the candidate name.' })
    const id = rid()
    db.run('INSERT INTO hr_candidates (id, role_id, name, email, college, source, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', id, r.id, name, clip(req.body?.email, 120), clip(req.body?.college, 80), 'manual', 'in_progress', now(), now())
    res.json(candRow(db.get('SELECT * FROM hr_candidates WHERE id = ?', id)))
  })

  const myCand = (req, res) => {
    const c = guard(req, res); if (!c) return null
    const cand = db.get('SELECT * FROM hr_candidates WHERE id = ?', req.params.cid)
    const r = cand && roleRow(cand.role_id)
    if (!cand || !r || r.client_id !== c) { res.status(404).json({ error: 'Candidate not found' }); return null }
    return { cand, r }
  }
  app.get('/api/hr/candidates/:cid', (req, res) => {
    const x = myCand(req, res); if (!x) return
    const role = roleObj(x.r)
    const cand = candRow(x.cand)
    res.json({ role, candidate: cand, score: scoreCandidate(role.rubric, role.questions, cand.ratings), authenticity: candAuth(cand), disclaimer: AUTH_DISCLAIMER })
  })
  app.put('/api/hr/candidates/:cid', (req, res) => {
    const x = myCand(req, res); if (!x) return
    const role = roleObj(x.r)
    const cur = candRow(x.cand)
    const b = req.body || {}
    let ratings = cur.ratings
    if (b.ratings && typeof b.ratings === 'object') {
      ratings = {}
      for (const q of role.questions) {
        const v = b.ratings[q.id]
        if (!v) continue
        const score = Number(v.score)
        const entry = {}
        if (Number.isFinite(score) && score >= 1 && score <= 5) entry.score = Math.round(score)
        if (v.note) entry.note = clip(v.note, 600)
        if (v.transcript) entry.transcript = clip(v.transcript, 6000)
        if (v.auto && entry.score) entry.auto = true
        if (Object.keys(entry).length) ratings[q.id] = entry
      }
    }
    const decision = b.decision === undefined ? cur.decision : ['Strong hire', 'Hire', 'Maybe', 'No hire'].includes(b.decision) ? b.decision : null
    db.run('UPDATE hr_candidates SET ratings = ?, notes = ?, decision = ?, shortlisted = ?, name = ?, college = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(ratings), b.notes == null ? cur.notes : clip(b.notes, 4000), decision, b.shortlisted == null ? (cur.shortlisted ? 1 : 0) : b.shortlisted ? 1 : 0, clip(b.name, 80) || cur.name, b.college == null ? (cur.college || '') : clip(b.college, 80), now(), x.cand.id)
    const cand = candRow(db.get('SELECT * FROM hr_candidates WHERE id = ?', x.cand.id))
    res.json({ candidate: cand, score: scoreCandidate(role.rubric, role.questions, cand.ratings) })
  })
  app.delete('/api/hr/candidates/:cid', (req, res) => {
    const x = myCand(req, res); if (!x) return
    db.run('DELETE FROM hr_candidates WHERE id = ?', x.cand.id)
    res.json({ ok: true })
  })

  // suggestion for a dictated or pasted answer in the live scorecard
  app.post('/api/hr/roles/:id/suggest', (req, res) => {
    const r = mine(req, res); if (!r) return
    const role = roleObj(r)
    const q = role.questions.find((x) => x.id === req.body?.questionId)
    if (!q) return res.status(400).json({ error: 'Unknown question' })
    const transcript = clip(req.body?.transcript, 6000)
    const kws = [...new Set((q.looksFor || []).join(' ').toLowerCase().match(/[a-z]{5,}/g) || [])].slice(0, 8)
    const content = scoreAnswerContent({ ...q, category: q.competency === 'technical' ? 'technical' : 'behavioral', keywords: kws }, transcript, role.lang)
    res.json({ ...suggestRating({ question: q, transcript, content }), authenticity: authenticity({ transcript, input: 'speech', durationSec: Number(req.body?.durationSec) || undefined }), tips: content.tips.slice(0, 3).map((t) => t.text) })
  })

  app.get('/api/hr/roles/:id/leaderboard', async (req, res) => {
    const r = mine(req, res); if (!r) return
    res.json(await leaderboard(roleObj(r), req))
  })

  // ------------------------------------------------ public screening (candidate side, no account)
  const byScreen = (token) => (/^[A-Za-z0-9_-]{8,40}$/.test(token) ? db.get('SELECT * FROM hr_roles WHERE screen_token = ?', token) : null)
  const auto = (a) => Math.max(1, Math.min(5, Math.round(1 + (a / 10) * 4)))

  app.get('/api/screen/:token', (req, res) => {
    const r = byScreen(req.params.token)
    if (!r) return res.status(404).json({ error: 'This interview link is not valid.' })
    res.json({ title: r.title, company: r.company, lang: r.lang, open: !!r.screen_open, questionCount: parse(r.questions, []).length })
  })
  const screenCand = (req, res) => {
    const r = byScreen(req.params.token)
    if (!r) { res.status(404).json({ error: 'This interview link is not valid.' }); return null }
    const cand = db.get('SELECT * FROM hr_candidates WHERE id = ? AND role_id = ?', String(req.body?.candidateId || ''), r.id)
    if (!cand || !cand.cand_key || cand.cand_key !== String(req.body?.key || '')) { res.status(403).json({ error: 'Session not found. Please start again.' }); return null }
    return { r, cand }
  }
  const qPublic = (q, i, total) => ({ id: q.id, text: q.text, index: i, total, followUp: !!q.followUp })

  app.post('/api/screen/:token/start', (req, res) => {
    const r = byScreen(req.params.token)
    if (!r) return res.status(404).json({ error: 'This interview link is not valid.' })
    if (!r.screen_open) return res.status(403).json({ error: 'This interview is closed. Ask the recruiter for a new link.' })
    const name = clip(req.body?.name, 80)
    if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' })
    if (!req.body?.consent) return res.status(400).json({ error: 'Please accept the consent note to continue.' })
    const qs = parse(r.questions, [])
    const id = rid()
    const key = rid(16)
    db.run('INSERT INTO hr_candidates (id, role_id, name, email, source, status, cand_key, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', id, r.id, name, clip(req.body?.email, 120), 'link', 'in_progress', key, now(), now())
    if (req.body?.college) db.run('UPDATE hr_candidates SET college = ? WHERE id = ?', clip(req.body.college, 80), id)
    res.json({ candidateId: id, key, total: qs.length, question: qPublic(qs[0], 0, qs.length) })
  })

  app.post('/api/screen/:token/answer', async (req, res) => {
    const x = screenCand(req, res); if (!x) return
    if (x.cand.status === 'complete') return res.status(409).json({ error: 'Interview already submitted' })
    const qs = parse(x.r.questions, [])
    const answers = parse(x.cand.answers, {})
    const b = req.body || {}
    const isFu = /^fu_/.test(String(b.questionId))
    const baseId = isFu ? String(b.questionId).slice(3) : String(b.questionId)
    const q = qs.find((k) => k.id === baseId)
    if (!q) return res.status(400).json({ error: 'Unknown question' })
    const idx = qs.indexOf(q)
    if (!isFu && answers[q.id]) return res.status(409).json({ error: 'Already answered' })
    if (isFu && (!answers[q.id]?.followUp || answers[q.id].followUp.answered)) return res.status(409).json({ error: 'No follow-up pending' })
    const transcript = clip(b.transcript, 6000).replace(/\s+/g, ' ')
    const input = b.input === 'speech' ? 'speech' : 'typed'
    const durationSec = num(b.durationSec, 1, 900, 30)
    const meta = { pasted: !!b.meta?.pasted, typedMs: num(b.meta?.typedMs, 0, 3600000, 0), keys: num(b.meta?.keys, 0, 100000, 0) }
    const kws = [...new Set((q.looksFor || []).join(' ').toLowerCase().match(/[a-z]{5,}/g) || [])].slice(0, 8)
    const qq = { id: q.id, text: q.text, category: isFu ? 'followup' : q.competency === 'technical' ? 'technical' : 'behavioral', keywords: kws }
    const analysis = analyzeAnswer({ question: qq, transcript, durationSec, input, metrics: {}, lang: x.r.lang })
    const content = analysis.scores.content ?? 0
    const lens = tokenize(transcript).length

    if (isFu) {
      answers[q.id].followUp = { ...answers[q.id].followUp, answered: true, transcript, input, durationSec, meta, content }
      db.run('UPDATE hr_candidates SET answers = ?, updated_at = ? WHERE id = ?', JSON.stringify(answers), now(), x.cand.id)
    } else {
      let followUp = null
      const weak = content < 7 || lens < 40
      if (weak) {
        let t = null
        if (llmEnabled() && lens >= 8 && allowLlmCall(req.ip)) t = x.r.lang === 'en' ? await L.followUp({ question: q, transcript, role: x.r.title }) : await L.langFollowUp({ question: q, transcript, role: x.r.title, lang: x.r.lang })
        if (!t) t = x.r.lang === 'en' ? templateFollowUp({ question: qq, transcript, contentScore: content }) : langFollowUp({ question: q, transcript, lang: x.r.lang })
        if (t) followUp = { text: t, answered: false }
      }
      answers[q.id] = { transcript, input, durationSec, meta, analysis: { words: analysis.words, wpm: analysis.wpm, fillers: analysis.fillers, content, tips: (analysis.tips || []).slice(0, 3) }, followUp, createdAt: now() }
      db.run('UPDATE hr_candidates SET answers = ?, updated_at = ? WHERE id = ?', JSON.stringify(answers), now(), x.cand.id)
      if (followUp) return res.json({ done: false, question: { id: 'fu_' + q.id, text: followUp.text, index: idx, total: qs.length, followUp: true } })
    }
    const next = qs[idx + 1]
    if (next) return res.json({ done: false, question: qPublic(next, idx + 1, qs.length) })
    res.json({ done: true })
  })

  app.post('/api/screen/:token/finish', (req, res) => {
    const x = screenCand(req, res); if (!x) return
    const qs = parse(x.r.questions, [])
    const answers = parse(x.cand.answers, {})
    const ratings = {}
    for (const q of qs) {
      const a = answers[q.id]
      if (!a) continue
      const m = a.analysis?.content ?? 0
      const f = a.followUp?.answered ? a.followUp.content : null
      const blended = f == null ? m : 0.7 * m + 0.3 * f
      ratings[q.id] = { score: auto(blended), auto: true, note: '', transcript: a.transcript }
    }
    if (!Object.keys(answers).length) return res.status(400).json({ error: 'Answer at least one question first' })
    db.run("UPDATE hr_candidates SET status = 'complete', ratings = ?, completed_at = ?, updated_at = ? WHERE id = ?", JSON.stringify(ratings), now(), now(), x.cand.id)
    res.json({ ok: true })
  })
}
