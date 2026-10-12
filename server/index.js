import express from 'express'
import { svgToPng, scorePdf, brandSvg } from './raster.js'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from './db.js'
import { ROLES, QUESTIONS, pickQuestions, publicQuestion, byId } from './questions.js'
import { llmEnabled, allowLlmCall, llmAnswerFeedback, llmSummary, llmFollowUp, llmResumeQuestions, llmTailoredQuestions } from './llm.js'
import { PACKS, DISCLAIMER, packById, publicPack, lensCoverage, pickPackQuestions } from './packs.js'
import { templateQuestions, templateJdQuestions, templateFollowUp, sanitizeCustomQuestions } from './resume.js'
import { registerV8, cleanPillars } from './v8routes.js'
import { sttEnabled, allowStt, audioKind, transcribe } from './stt.js'
import { registerV9 } from './v9routes.js'
import { registerV10 } from './v10routes.js'
import { registerArena } from './arena.js'
import { cleanLang, pickLangQuestions, stressPushback, langFollowUp, gapAnalysis } from './v8.js'
import { llmTranslateQuestions, llmStressFollowUp, llmLangFollowUp, llmCompanyQuestions } from './llm.js'
import { COMPANIES, companyById, publicCompanies, cleanRole, styleOf, templateCompanyQuestions, COMPANY_DISCLAIMER, STYLES } from './companies.js'
import { analyzeAnswer, buildReport, num, round1, tokenize } from '../src/lib/analysis.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const now = () => new Date().toISOString()
const isClientId = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(s)

const GOOGLE_ISS = ['accounts.google.com', 'https://accounts.google.com']
const tokenHash = (t) => crypto.createHash('sha256').update(t).digest('hex')
const DAYS30 = 30 * 24 * 3600 * 1000

// Verify a Google ID token with Google's own tokeninfo endpoint (no extra dependency).
export async function verifyGoogleToken(credential, clientId, fetchImpl = fetch) {
  const base = process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo'
  const r = await fetchImpl(`${base}?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) return null
  const j = await r.json().catch(() => null)
  if (!j || j.aud !== clientId || !GOOGLE_ISS.includes(j.iss)) return null
  if (!(Number(j.exp) * 1000 > Date.now())) return null
  if (String(j.email_verified) !== 'true' || !j.sub || !/^[0-9]{5,30}$/.test(String(j.sub))) return null
  return { sub: String(j.sub), email: String(j.email || ''), name: String(j.name || '').slice(0, 80), picture: String(j.picture || '').slice(0, 300) }
}

function cleanFace(f) {
  if (!f || typeof f !== 'object') return null
  const frames = num(f.frames, 0, 100000, 0)
  const detectedFrames = frames * num(f.detectedRatio, 0, 1, 0)
  if (detectedFrames < 8) return null // face not visible long enough to judge anything
  return {
    frames,
    detectedRatio: num(f.detectedRatio, 0, 1, 0),
    eyeContactRatio: num(f.eyeContactRatio, 0, 1, 0),
    smileRatio: num(f.smileRatio, 0, 1, 0),
    browMean: num(f.browMean, 0, 1, 0),
    headMotion: num(f.headMotion, 0, 500, 0),
  }
}
function cleanVoice(v) {
  if (!v || typeof v !== 'object') return null
  const frames = num(v.frames, 0, 1e6, 0)
  if (frames < 10) return null
  return { frames, silenceRatio: num(v.silenceRatio, 0, 1, 0), energyDbStd: num(v.energyDbStd, 0, 60, 0), avgDb: num(v.avgDb, -120, 0, -60) }
}

// Session questions are stored as full objects (bank, pack, resume and follow-up questions).
// Older rows stored plain ids, so both shapes are read.
const sessionQuestions = (s) => JSON.parse(s.questions).map((x) => (typeof x === 'string' ? byId(x) : x)).filter(Boolean)

function topUp(primary, extra, count) {
  const seen = new Set(primary.map((q) => q.text))
  const out = [...primary]
  for (const q of extra) { if (out.length >= count) break; if (!seen.has(q.text)) { seen.add(q.text); out.push({ ...q, id: 'r' + (out.length + 1) }) } }
  return out
}

export function createApp({ db = createDb(), llm = {} } = {}) {
  llm = { translate: llmTranslateQuestions, stress: llmStressFollowUp, langFollowUp: llmLangFollowUp, answer: llmAnswerFeedback, summary: llmSummary, followUp: llmFollowUp, resumeQuestions: llmResumeQuestions, tailored: llmTailoredQuestions, company: llmCompanyQuestions, ...llm }
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json({ limit: '200kb' }))

  // Signed-in identity comes from the bearer token only. Anonymous ids can never claim a g_ identity.
  const authUser = (req) => {
    const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')
    if (!m) return null
    const row = db.get('SELECT u.* FROM auth_sessions a JOIN users u ON u.id = a.user_id WHERE a.token_hash = ? AND a.expires_at > ?', tokenHash(m[1]), now())
    return row || null
  }
  const owner = (req, supplied) => {
    const u = authUser(req)
    if (u) return 'g_' + u.id
    return isClientId(supplied) && !supplied.startsWith('g_') ? supplied : null
  }
  const publicUser = (u) => ({ name: u.name, email: u.email, picture: u.picture })

  app.post('/api/auth/google', async (req, res) => {
    const cid = process.env.GOOGLE_CLIENT_ID
    if (!cid) return res.status(503).json({ error: 'Google sign-in is not set up on this server yet.' })
    const credential = req.body?.credential
    if (typeof credential !== 'string' || credential.length < 20 || credential.length > 4000) return res.status(400).json({ error: 'Missing Google credential' })
    let info = null
    try { info = await verifyGoogleToken(credential, cid) } catch { return res.status(502).json({ error: 'Could not reach Google to verify the sign-in. Try again.' }) }
    if (!info) return res.status(401).json({ error: 'Google sign-in could not be verified.' })
    db.run('INSERT INTO users (id, email, name, picture, created_at, last_login) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, name=excluded.name, picture=excluded.picture, last_login=excluded.last_login', info.sub, info.email, info.name, info.picture, now(), now())
    // bring this browser's guest history into the account (the guest id is a private random value)
    const guest = req.body?.guestClientId
    if (isClientId(guest) && !guest.startsWith('g_')) db.run('UPDATE sessions SET client_id = ? WHERE client_id = ?', 'g_' + info.sub, guest)
    const token = crypto.randomBytes(32).toString('hex')
    db.run('INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)', tokenHash(token), info.sub, now(), new Date(Date.now() + DAYS30).toISOString())
    res.json({ token, user: publicUser(info) })
  })
  app.get('/api/auth/me', (req, res) => {
    const u = authUser(req)
    if (!u) return res.status(401).json({ error: 'Not signed in' })
    res.json({ user: publicUser(u) })
  })
  app.post('/api/auth/logout', (req, res) => {
    const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')
    if (m) db.run('DELETE FROM auth_sessions WHERE token_hash = ?', tokenHash(m[1]))
    res.json({ ok: true })
  })

  app.get('/api/config', (_req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null, llm: llmEnabled(), stt: sttEnabled(), roles: ROLES, packs: PACKS.map(publicPack), disclaimer: DISCLAIMER, questionCount: QUESTIONS.length + PACKS.reduce((a, p) => a + p.questions.length, 0) })
  })

  app.get('/api/questions', (req, res) => {
    const role = ROLES.some((r) => r.id === req.query.role) ? req.query.role : 'general'
    res.json({ questions: pickQuestions(role, Number(req.query.count) || 7).map(publicQuestion) })
  })

  // JD and/or resume tailored questions
  app.post('/api/tailored-questions', async (req, res) => {
    const jd = String(req.body?.jd || '').trim().slice(0, 8000)
    const resume = String(req.body?.resume || '').trim().slice(0, 8000)
    if (jd.length < 60 && resume.length < 40) return res.status(400).json({ error: 'Paste the job description (a few lines at least), your resume, or both.' })
    const useJd = jd.length >= 60
    const useResume = resume.length >= 40
    const role = ROLES.some((r) => r.id === req.body?.role) ? req.body.role : 'general'
    const count = Math.max(7, Math.min(12, Number(req.body?.count) || 7))
    let source = 'template'
    let note = llmEnabled() ? 'The AI could not generate questions right now, so these are built from the skills found in your text.' : 'AI question writing needs the free Groq key. These questions are built from the skills found in your text instead.'
    let questions = []
    if (llmEnabled() && allowLlmCall(req.ip)) {
      const raw = await llm.tailored({ resume: useResume ? resume : '', jd: useJd ? jd : '', role, count })
      questions = sanitizeCustomQuestions(raw, count)
      if (questions.length >= 3) { source = 'ai'; note = '' }
    }
    const tpl = () => sanitizeCustomQuestions(useJd ? templateJdQuestions(jd, useResume ? resume : '', count) : templateQuestions(resume, count), count)
    if (source === 'template') questions = tpl()
    else if (questions.length < count) questions = topUp(questions, tpl(), count)
    if (!questions.length) return res.status(422).json({ error: 'Could not find skills or projects in that text. Paste more of it.' })
    let gap = null
    if (useJd && useResume) {
      gap = gapAnalysis(jd, resume)
      const fq = sanitizeCustomQuestions(gap.focusQuestions, 2)
      if (fq.length && gap.missing.length) {
        const keep = questions.filter((q) => !/not on your resume|have not listed/i.test(q.text))
        questions = [...keep.slice(0, Math.max(5, count - fq.length)), ...fq].slice(0, count)
        while (questions.length < count && keep.length > questions.length - fq.length) questions.splice(questions.length - fq.length, 0, keep[questions.length - fq.length])
      }
      gap = { matchPct: gap.matchPct, missing: gap.missing.slice(0, 4).map((m) => m.skill), summary: gap.summary }
    }
    res.json({ source, used: { jd: useJd, resume: useResume }, note, gap, questions: questions.map(({ text, category, tip, keywords }) => ({ text, category, tip, keywords })) })
  })

  app.get('/api/companies', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600')
    res.json({ count: COMPANIES.length, disclaimer: COMPANY_DISCLAIMER, companies: publicCompanies() })
  })

  app.get('/api/companies/:id', (req, res) => {
    const c = companyById(String(req.params.id))
    if (!c) return res.status(404).json({ error: 'Unknown company' })
    const st = styleOf(c)
    res.json({ id: c.id, name: c.name, sector: c.sectorLabel, region: c.region, style: st.label, rounds: st.rounds, themes: st.themes, note: st.push, disclaimer: COMPANY_DISCLAIMER })
  })

  // Company + role practice: questions in the commonly reported style of that company
  app.post('/api/company-questions', async (req, res) => {
    const c = companyById(String(req.body?.company || ''))
    if (!c) return res.status(400).json({ error: 'Pick a company from the list.' })
    const role = cleanRole(req.body?.role)
    if (role.length < 2) return res.status(400).json({ error: 'Type the job role you are interviewing for, for example "Data Analyst".' })
    const resume = String(req.body?.resume || '').trim().slice(0, 6000)
    const useResume = resume.length >= 40
    const count = Math.max(7, Math.min(12, Number(req.body?.count) || 7))
    const lang = cleanLang(req.body?.lang)
    const st = styleOf(c)
    let source = 'template'
    let note = llmEnabled() ? 'The AI could not write questions right now, so these are built from the usual pattern for this kind of company.' : 'AI question writing needs the free Groq key. These questions are built from the usual pattern for this kind of company instead.'
    let questions = []
    if (llmEnabled() && allowLlmCall(req.ip)) {
      const raw = await llm.company({ company: c.name, sector: c.sectorLabel, region: c.region, role, style: st.label, rounds: st.rounds, themes: st.themes, resume: useResume ? resume : '', count, lang })
      questions = sanitizeCustomQuestions(raw, count)
      if (questions.length >= 4) { source = 'ai'; note = '' }
    }
    const tpl = () => sanitizeCustomQuestions(templateCompanyQuestions(c, role, count), count)
    if (source === 'template') questions = tpl()
    else if (questions.length < count) questions = topUp(questions, tpl(), count)
    res.json({ source, note, company: { id: c.id, name: c.name, style: st.label }, role, usedResume: useResume, disclaimer: COMPANY_DISCLAIMER, questions: questions.map(({ text, category, tip, keywords }) => ({ text, category, tip, keywords })) })
  })

  app.post('/api/resume-questions', async (req, res) => {
    const resume = String(req.body?.resume || '').trim()
    if (resume.length < 40) return res.status(400).json({ error: 'Paste at least a few lines of your resume.' })
    const role = ROLES.some((r) => r.id === req.body?.role) ? req.body.role : 'general'
    const count = Math.max(7, Math.min(12, Number(req.body?.count) || 7))
    let source = 'template'
    let note = llmEnabled() ? 'The AI could not generate questions right now, so these are built from the skills and projects found in your resume.' : 'AI question writing needs the free Groq key. These questions are built from the skills and projects found in your resume.'
    let questions = []
    if (llmEnabled() && allowLlmCall(req.ip)) {
      const raw = await llm.resumeQuestions({ resume, role, count })
      questions = sanitizeCustomQuestions(raw, count)
      if (questions.length >= 3) { source = 'ai'; note = '' }
    }
    if (source === 'template') questions = sanitizeCustomQuestions(templateQuestions(resume, count), count)
    else if (questions.length < count) questions = topUp(questions, sanitizeCustomQuestions(templateQuestions(resume, count), count), count)
    if (!questions.length) return res.status(422).json({ error: 'Could not find projects or skills in that text. Paste your projects and skills sections.' })
    res.json({ source, note, questions: questions.map(({ text, category, tip, keywords }) => ({ text, category, tip, keywords })) })
  })

  app.post('/api/sessions', async (req, res) => {
    const clientId = owner(req, req.body?.clientId)
    if (!clientId) return res.status(400).json({ error: 'Invalid clientId' })
    const count = Math.max(3, Math.min(12, Number(req.body.count) || 7))
    const pack = req.body.pack ? packById(req.body.pack) : null
    if (req.body.pack && !pack) return res.status(400).json({ error: 'Unknown company pack' })
    const custom = req.body.custom ? sanitizeCustomQuestions(req.body.custom, 12) : []
    if (req.body.custom && custom.length < 2) return res.status(400).json({ error: 'Not enough valid questions' })
    const role = pack ? 'pack:' + pack.id : custom.length ? (ROLES.some((r) => r.id === req.body.role) ? req.body.role : 'general') : req.body.role
    if (!pack && !ROLES.some((r) => r.id === role)) return res.status(400).json({ error: 'Unknown role' })
    const lang = cleanLang(req.body?.lang)
    const mode = req.body?.stress ? 'stress' : 'standard'
    let intro = pickQuestions('general', 3)[0]
    let langNote = null
    const translate = async (list) => {
      if (llmEnabled() && allowLlmCall(req.ip)) {
        const t = await llm.translate({ questions: list, lang })
        if (t) return list.map((q, i) => ({ ...q, text: t[i] }))
      }
      return null
    }
    let qs
    if (pack) { qs = pickPackQuestions(pack, intro, count); if (lang !== 'en') langNote = 'Company packs are English only, so the interviewer will ask in English. Speech recognition still follows your language.' }
    else if (custom.length) {
      if (lang !== 'en') {
        intro = pickLangQuestions(lang, 1)[0]
        const tr = await translate(custom)
        qs = [intro, ...(tr || custom)]
        if (!tr) langNote = 'Tailored questions need the AI key to be translated, so they stay in English. Your answers can still be in ' + (lang === 'hindi' ? 'Hindi' : 'Hinglish') + '.'
      } else qs = [intro, ...custom]
    } else if (lang !== 'en') {
      const tr = await translate(pickQuestions(role, count))
      qs = tr || pickLangQuestions(lang, count)
    } else qs = pickQuestions(role, count)
    const stored = qs.map((q) => ({ id: q.id, category: q.category, text: q.text, tip: q.tip, keywords: q.keywords || [] }))
    const id = crypto.randomBytes(9).toString('base64url')
    db.run('INSERT INTO sessions (id, client_id, role, questions, created_at, mode, lang) VALUES (?,?,?,?,?,?,?)', id, clientId, role, JSON.stringify(stored), now(), mode, lang)
    res.json({ id, role, pack: pack ? publicPack(pack) : null, mode: pack ? 'pack' : custom.length ? 'resume' : 'role', stress: mode === 'stress', lang, langNote, questions: stored.map(publicQuestion), llm: llmEnabled() })
  })

  app.post('/api/sessions/:id/answers', async (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s) return res.status(404).json({ error: 'Session not found' })
    if (s.status === 'finished') return res.status(409).json({ error: 'Session already finished' })
    const b = req.body || {}
    if (owner(req, b.clientId) !== s.client_id) return res.status(403).json({ error: 'Not your session' })
    const allowed = sessionQuestions(s)
    const q = allowed.find((x) => x.id === b.questionId)
    if (!q) return res.status(400).json({ error: 'Question not part of this session' })
    const transcript = String(b.transcript || '').replace(/\s+/g, ' ').trim().slice(0, 6000)
    const input = b.input === 'speech' ? 'speech' : 'typed'
    const durationSec = num(b.durationSec, 1, 900, 30)
    const metrics = { face: cleanFace(b.metrics?.face), voice: cleanVoice(b.metrics?.voice) }
    const lang = s.lang || 'en'
    const stress = s.mode === 'stress'
    const analysis = analyzeAnswer({ question: q, transcript, durationSec, input, metrics, lang })

    let feedback = null
    let followUp = null
    let followUpNote = null
    const wantFollowUp = (b.wantFollowUp !== false || stress) && q.category !== 'followup'
    const enough = tokenize(transcript).length >= 12
    if (llmEnabled() && enough) {
      const [fb, fu] = await Promise.all([
        allowLlmCall(req.ip) ? llm.answer({ question: q, transcript, role: s.role }) : null,
        wantFollowUp && tokenize(transcript).length >= 8 && allowLlmCall(req.ip)
          ? (stress ? llm.stress({ question: q, transcript, role: s.role, lang }) : lang !== 'en' ? llm.langFollowUp({ question: q, transcript, role: s.role, lang }) : llm.followUp({ question: q, transcript, role: s.role }))
          : null,
      ])
      feedback = fb
      if (fu) followUp = { id: 'fu_' + q.id, category: 'followup', text: fu, tip: 'Answer the follow-up directly with one concrete detail.', keywords: [] }
    }
    // no AI key (or the AI had nothing): the built-in interviewer still reacts to what was said
    if (wantFollowUp && !followUp) {
      const t = stress ? stressPushback({ question: q, transcript, lang })
        : lang !== 'en' ? (tokenize(transcript).length < 60 || (analysis.scores?.content ?? 10) < 7 ? langFollowUp({ question: q, transcript, lang }) : null)
        : templateFollowUp({ question: q, transcript, contentScore: analysis.scores?.content })
      if (t) followUp = { id: 'fu_' + q.id, category: 'followup', text: t, tip: stress ? 'Stay calm. Hold your position if you are right, concede if you are not, and back it with one fact.' : 'Answer the follow-up directly with one concrete detail.', keywords: [] }
    }
    if (followUp) {
      const list = [...allowed.filter((x) => x.id !== followUp.id), followUp]
      db.run('UPDATE sessions SET questions = ? WHERE id = ?', JSON.stringify(list.map(({ id, category, text, tip, keywords }) => ({ id, category, text, tip, keywords }))), s.id)
    } else if (wantFollowUp) followUpNote = 'No follow-up this time (there was nothing to dig into).'
    const position = allowed.findIndex((x) => x.id === q.id)
    db.run(
      `INSERT OR REPLACE INTO answers (session_id, question_id, position, transcript, duration_sec, input, metrics, analysis, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      s.id, q.id, position, transcript, durationSec, input, JSON.stringify(metrics), JSON.stringify({ analysis, llm: feedback }), now(),
    )
    const content = analysis.scores.content
    res.json({ analysis, llm: feedback, answerScore: feedback ? round1(0.4 * content + 0.6 * feedback.score) : content, followUp: followUp ? publicQuestion(followUp) : null, followUpNote })
  })

  app.post('/api/sessions/:id/finish', async (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s) return res.status(404).json({ error: 'Session not found' })
    if (owner(req, req.body?.clientId) !== s.client_id) return res.status(403).json({ error: 'Not your session' })
    if (s.status === 'finished') return res.json(JSON.parse(s.report))
    const rows = db.all('SELECT * FROM answers WHERE session_id = ? ORDER BY id', s.id)
    const qlist = sessionQuestions(s)
    if (!rows.length) return res.status(400).json({ error: 'Answer at least one question first' })
    const items = rows.map((r) => {
      const a = JSON.parse(r.analysis)
      const m = JSON.parse(r.metrics)
      return { question: qlist.find((x) => x.id === r.question_id) || byId(r.question_id), transcript: r.transcript, durationSec: r.duration_sec, input: r.input, analysis: a.analysis, llm: a.llm, metricsFace: m.face }
    })
    const summary = buildReport(items)
    let coaching = null
    if (llmEnabled() && allowLlmCall(req.ip)) coaching = await llm.summary({ role: s.role, items, scores: summary.scores })
    const pack = s.role.startsWith('pack:') ? packById(s.role.slice(5)) : null
    const early = req.body?.early === true
    const report = {
      early: early || undefined,
      answered: early ? rows.length : undefined,
      id: s.id,
      role: s.role,
      pack: pack ? { ...publicPack(pack), disclaimer: DISCLAIMER, coverage: lensCoverage(pack, items.map((i) => i.transcript)) } : null,
      createdAt: s.created_at,
      mode: s.mode || 'standard',
      lang: s.lang || 'en',
      finishedAt: now(),
      llm: !!items.some((i) => i.llm) || !!coaching,
      ...summary,
      coaching,
      answers: items.map((it, i) => ({
        position: i,
        question: publicQuestion(it.question),
        followUp: it.question.category === 'followup',
        transcript: it.transcript,
        durationSec: it.durationSec,
        input: it.input,
        face: it.metricsFace,
        analysis: it.analysis,
        llm: it.llm,
        score: it.llm ? round1(0.4 * it.analysis.scores.content + 0.6 * it.llm.score) : it.analysis.scores.content,
      })),
    }
    db.run(`UPDATE sessions SET status='finished', finished_at=?, overall=?, report=? WHERE id=?`, report.finishedAt, report.scores.overall, JSON.stringify(report), s.id)
    res.json(report)
  })

  // Reports are readable by anyone with the (unguessable) link so they can be shared on a resume.
  app.get('/api/sessions/:id', (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s || s.status !== 'finished') return res.status(404).json({ error: 'Report not found' })
    res.json(JSON.parse(s.report))
  })

  app.get('/api/history', (req, res) => {
    const me = owner(req, req.query.clientId)
    if (!me) return res.status(400).json({ error: 'Invalid clientId' })
    const rows = db.all(`SELECT id, role, created_at, finished_at, overall, report FROM sessions WHERE client_id = ? AND status = 'finished' ORDER BY finished_at DESC LIMIT 50`, me)
    res.json({
      sessions: rows.map((r) => {
        const rep = JSON.parse(r.report)
        return { id: r.id, role: r.role, finishedAt: r.finished_at, overall: r.overall, scores: rep.scores, questions: rep.questions, headline: rep.headline }
      }),
    })
  })

  app.delete('/api/sessions/:id', (req, res) => {
    const s = db.get('SELECT client_id FROM sessions WHERE id = ?', req.params.id)
    if (!s) return res.status(404).json({ error: 'Not found' })
    if (owner(req, req.query.clientId) !== s.client_id) return res.status(403).json({ error: 'Not your session' })
    db.run('DELETE FROM sessions WHERE id = ?', req.params.id)
    res.json({ ok: true })
  })

  registerV8(app, { db, owner, llm })
  // Server speech to text (Groq Whisper). The browser posts short audio segments; nothing is stored.
  app.post('/api/stt', express.raw({ type: () => true, limit: '3mb' }), async (req, res) => {
    if (!sttEnabled()) return res.status(503).json({ error: 'Server speech to text is not switched on for this deployment.', code: 'stt_off' })
    const kind = audioKind(req.headers['content-type'])
    if (!kind) return res.status(415).json({ error: 'Unsupported audio type' })
    const buf = req.body
    if (!Buffer.isBuffer(buf) || buf.length < 800) return res.status(400).json({ error: 'Audio too short' })
    if (!allowStt(req.ip)) return res.status(429).json({ error: 'Too many speech requests. Try again later or type your answer.', code: 'rate' })
    try {
      const lang = String(req.query.lang || 'en').slice(0, 2)
      res.json({ text: await (llm.transcribe || transcribe)(buf, kind, lang) })
    } catch { res.status(502).json({ error: 'Speech to text failed. Try again or type.', code: 'upstream' }) }
  })

  registerV9(app, { db, owner, sessionQuestions })
  registerV10(app, { db, owner, llm })
  registerArena(app, { db, authUser })

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

  const dist = path.join(here, '..', 'dist')
  if (fs.existsSync(dist)) {
    app.get('/og.png', (_req, res) => res.type('image/png').set('Cache-Control', 'public, max-age=86400').send(svgToPng(brandSvg())))
    app.use(express.static(dist, { index: false, setHeaders(res, file) {
      if (file.endsWith('/sw.js') || file.endsWith('/manifest.webmanifest') || file.endsWith('/offline.html')) res.setHeader('Cache-Control', 'no-cache')
      if (file.endsWith('/sw.js')) res.setHeader('Service-Worker-Allowed', '/')
    } }))
    // The app shell carries absolute Open Graph tags so any page link previews with the SharpAI card
    let shell = null
    app.use((req, res) => {
      if (shell === null) shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
      const origin = `${req.protocol}://${req.get('host')}`
      const tags = `<meta property="og:site_name" content="SharpAI"><meta property="og:type" content="website"><meta property="og:title" content="SharpAI - AI interviews by voice and video"><meta property="og:description" content="Practice with 1,300+ company styles, in English, Hinglish or Hindi. Recruiters screen and rank candidates with a live copilot."><meta property="og:url" content="${origin}${req.path === '/' ? '/' : req.path}"><meta property="og:image" content="${origin}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${origin}/og.png">`
      res.type('html').send(shell.replace('</head>', tags + '</head>'))
    })
  }
  app.use((err, _req, res, _next) => {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  })
  return app
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3001
  createApp().listen(PORT, () => console.log(`SharpAI on :${PORT} (LLM feedback: ${llmEnabled() ? 'on' : 'off, heuristic mode'})`))
}
