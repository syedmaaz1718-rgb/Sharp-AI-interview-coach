// v9 routes: peer battles, interview rewind, recruiter bias audit.
import { svgToPng, scorePdf, brandSvg } from './raster.js'
import crypto from 'node:crypto'
import { ROLES, pickQuestions } from './questions.js'
import { packById, pickPackQuestions } from './packs.js'
import { analyzeAnswer, tokenize, num } from '../src/lib/analysis.js'
import { judgeBattle, battleCardSvg, compareAttempts, biasAudit } from './v9.js'

const now = () => new Date().toISOString()
const clip = (s, n) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, n)
const rid = (n = 9) => crypto.randomBytes(n).toString('base64url')
const parse = (s, d) => { try { return JSON.parse(s) } catch { return d } }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const okTok = (t) => /^[A-Za-z0-9_-]{8,40}$/.test(String(t))

export function registerV9(app, { db, owner, sessionQuestions }) {
  // ------------------------------------------------ peer battle
  const battle = (token) => (okTok(token) ? db.get('SELECT * FROM battles WHERE token = ?', token) : null)
  const players = (b) => db.all('SELECT * FROM battle_players WHERE battle_id = ? ORDER BY slot', b.id)
  const qsOf = (b) => parse(b.questions, [])
  const pub = (p) => ({ slot: p.slot, name: p.name, status: p.status, answered: Object.keys(parse(p.answers, {})).length })
  const notFound = (res) => res.status(404).json({ error: 'This battle link is not valid.' })
  const find = (b, key) => (key ? players(b).find((p) => p.pkey === String(key)) : null)
  const nextQ = (b, p) => {
    const qs = qsOf(b); const ans = parse(p.answers, {})
    const i = qs.findIndex((q) => !ans[q.id])
    return i < 0 ? null : { id: qs[i].id, text: qs[i].text, tip: qs[i].tip || '', index: i, total: qs.length }
  }
  const result = (b) => {
    const ps = players(b)
    const A = ps.find((p) => p.slot === 'a'); const B = ps.find((p) => p.slot === 'b')
    if (!A || !B || A.status !== 'done' || B.status !== 'done') return null
    const qs = qsOf(b)
    return { label: b.label, ...judgeBattle(qs, { name: A.name, answers: parse(A.answers, {}) }, { name: B.name, answers: parse(B.answers, {}) }), names: { a: A.name, b: B.name } }
  }

  app.post('/api/battles', (req, res) => {
    const name = clip(req.body?.name, 40)
    if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' })
    const count = Math.max(3, Math.min(8, Number(req.body?.count) || 5))
    let qs; let label; let kind; let ref
    if (req.body?.pack) {
      const pack = packById(req.body.pack)
      if (!pack) return res.status(400).json({ error: 'Unknown company style' })
      qs = pickPackQuestions(pack, pickQuestions('general', 3)[0], count); label = pack.name; kind = 'pack'; ref = pack.id
    } else {
      const role = ROLES.find((r) => r.id === req.body?.role)
      if (!role) return res.status(400).json({ error: 'Pick a role' })
      qs = pickQuestions(role.id, count); label = role.label; kind = 'role'; ref = role.id
    }
    const stored = qs.map((q) => ({ id: q.id, text: q.text, tip: q.tip, keywords: q.keywords || [], category: q.category }))
    const id = rid(); const token = rid(12); const key = rid(16)
    db.run('INSERT INTO battles (id, token, label, kind, ref, questions, created_at) VALUES (?,?,?,?,?,?,?)', id, token, label, kind, ref, JSON.stringify(stored), now())
    db.run('INSERT INTO battle_players (id, battle_id, slot, name, pkey, created_at) VALUES (?,?,?,?,?,?)', rid(), id, 'a', name, key, now())
    res.json({ token, key, slot: 'a', path: '/battle/' + token })
  })

  app.get('/api/battle/:token', (req, res) => {
    const b = battle(req.params.token); if (!b) return notFound(res)
    const ps = players(b); const mine = find(b, req.query.key)
    const r = result(b)
    res.json({
      label: b.label, total: qsOf(b).length, players: ps.map(pub), open: ps.length < 2,
      me: mine ? { slot: mine.slot, name: mine.name, status: mine.status, next: mine.status === 'done' ? null : nextQ(b, mine) } : null,
      finished: !!r,
    })
  })

  app.post('/api/battle/:token/join', (req, res) => {
    const b = battle(req.params.token); if (!b) return notFound(res)
    const name = clip(req.body?.name, 40)
    if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' })
    if (players(b).length >= 2) return res.status(409).json({ error: 'This battle already has two players.' })
    const key = rid(16)
    try { db.run('INSERT INTO battle_players (id, battle_id, slot, name, pkey, created_at) VALUES (?,?,?,?,?,?)', rid(), b.id, 'b', name, key, now()) } catch { return res.status(409).json({ error: 'This battle already has two players.' }) }
    res.json({ key, slot: 'b' })
  })

  app.post('/api/battle/:token/answer', (req, res) => {
    const b = battle(req.params.token); if (!b) return notFound(res)
    const p = find(b, req.body?.key)
    if (!p) return res.status(403).json({ error: 'Session not found. Open the battle link again.' })
    if (p.status === 'done') return res.status(409).json({ error: 'You already finished.' })
    const qs = qsOf(b); const ans = parse(p.answers, {})
    const q = qs.find((x) => x.id === req.body?.questionId)
    if (!q) return res.status(400).json({ error: 'Unknown question' })
    if (ans[q.id]) return res.status(409).json({ error: 'Already answered' })
    const transcript = clip(req.body?.transcript, 6000)
    if (tokenize(transcript).length < 3) return res.status(400).json({ error: 'Write or say a bit more before submitting.' })
    const input = req.body?.input === 'speech' ? 'speech' : 'typed'
    const a = analyzeAnswer({ question: q, transcript, durationSec: num(req.body?.durationSec, 1, 900, 30), input, metrics: {}, lang: 'en' })
    ans[q.id] = { content: a.scores.content, words: a.words, hit: (a.content.keywordsHit || []).length, total: a.content.keywordsTotal || 0, nums: (transcript.match(/\d[\d,.]*%?/g) || []).length, at: now() }
    const done = qs.every((x) => ans[x.id])
    db.run('UPDATE battle_players SET answers = ?, status = ?, finished_at = ? WHERE id = ?', JSON.stringify(ans), done ? 'done' : 'playing', done ? now() : null, p.id)
    res.json({ done, next: done ? null : nextQ(b, { answers: JSON.stringify(ans) }) })
  })

  app.get('/api/battle/:token/result', (req, res) => {
    const b = battle(req.params.token); if (!b) return notFound(res)
    const r = result(b)
    if (!r) return res.json({ ready: false, players: players(b).map(pub), total: qsOf(b).length })
    res.json({ ready: true, ...r, you: find(b, req.query.key)?.slot || null })
  })
  const cardFor = (b) => { const r = result(b); return r && { role: r.label, aName: r.names.a, bName: r.names.b, aScore: r.scores.a, bScore: r.scores.b, winner: r.winner } }
  app.get('/api/battle/:token/card.png', (req, res) => {
    const b = battle(req.params.token); const c = b && cardFor(b)
    if (!c) return res.status(404).type('text/plain').send('Not ready')
    res.type('image/png').set('Cache-Control', 'public, max-age=300').send(svgToPng(battleCardSvg(c)))
  })
  app.get('/api/battle/:token/card.svg', (req, res) => {
    const b = battle(req.params.token); const c = b && cardFor(b)
    if (!c) return res.status(404).type('text/plain').send('Not ready')
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=300').send(battleCardSvg(c))
  })
  app.get('/b/:token', (req, res) => {
    const b = battle(req.params.token); const c = b && cardFor(b)
    if (!c) return res.redirect('/battle/' + encodeURIComponent(req.params.token))
    const origin = `${req.protocol}://${req.get('host')}`
    const title = c.winner === 'tie' ? `${c.aName} and ${c.bName} tied on SharpAI` : `${c.winner === 'a' ? c.aName : c.bName} won a SharpAI interview battle`
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(c.role)} battle: ${esc(c.aName)} ${c.aScore} vs ${esc(c.bName)} ${c.bScore}"><meta property="og:image" content="${esc(origin)}/api/battle/${esc(req.params.token)}/card.png"><meta name="twitter:card" content="summary_large_image">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0b14;color:#fff;font-family:Inter,system-ui,Arial,sans-serif}main{max-width:900px;padding:24px;text-align:center}img{width:100%;border-radius:20px}a{display:inline-block;margin-top:20px;padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#22d3ee);color:#fff;text-decoration:none;font-weight:700}</style></head>
<body><main><img src="/api/battle/${esc(req.params.token)}/card.svg" alt="${esc(title)}"><br><a href="/">Challenge a friend on SharpAI</a></main></body></html>`)
  })

  // ------------------------------------------------ interview rewind
  app.post('/api/sessions/:id/rewind', (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s) return res.status(404).json({ error: 'Session not found' })
    const b = req.body || {}
    if (owner(req, b.clientId) !== s.client_id) return res.status(403).json({ error: 'Not your session' })
    const q = sessionQuestions(s).find((x) => x.id === b.questionId)
    if (!q) return res.status(400).json({ error: 'Question not part of this session' })
    const first = db.get('SELECT * FROM answers WHERE session_id = ? AND question_id = ?', s.id, q.id)
    if (!first) return res.status(409).json({ error: 'Answer the question once before retrying it.' })
    const transcript = clip(b.transcript, 6000)
    if (tokenize(transcript).length < 5) return res.status(400).json({ error: 'Write or say a bit more before submitting.' })
    const lang = s.lang || 'en'
    const input = b.input === 'speech' ? 'speech' : 'typed'
    const after = analyzeAnswer({ question: q, transcript, durationSec: num(b.durationSec, 1, 900, 30), input, metrics: {}, lang })
    const before = parse(first.analysis, {}).analysis
    if (!before?.scores) return res.status(409).json({ error: 'First attempt has no analysis.' })
    const cmp = compareAttempts(before, after, { bText: first.transcript, aText: transcript })
    const attempt = (db.get('SELECT COUNT(*) c FROM rewinds WHERE session_id = ? AND question_id = ?', s.id, q.id)?.c || 0) + 2
    db.run('INSERT INTO rewinds (session_id, question_id, attempt, transcript, analysis, compare, created_at) VALUES (?,?,?,?,?,?,?)', s.id, q.id, attempt, transcript, JSON.stringify({ words: after.words, scores: after.scores, content: after.content }), JSON.stringify(cmp), now())
    res.json({ attempt, ...cmp, tips: (after.tips || []).slice(0, 2) })
  })
  app.get('/api/sessions/:id/rewinds', (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s) return res.status(404).json({ error: 'Session not found' })
    if (owner(req, req.query.clientId) !== s.client_id) return res.status(403).json({ error: 'Not your session' })
    const qs = sessionQuestions(s)
    const rows = db.all('SELECT question_id, attempt, compare FROM rewinds WHERE session_id = ? ORDER BY id', s.id)
    res.json({ rewinds: rows.map((r) => ({ questionId: r.question_id, question: qs.find((q) => q.id === r.question_id)?.text || '', attempt: r.attempt, ...parse(r.compare, {}) })) })
  })

  // ------------------------------------------------ recruiter bias audit
  app.get('/api/hr/audit', (req, res) => {
    const c = owner(req, req.query?.clientId)
    if (!c) return res.status(400).json({ error: 'Invalid clientId' })
    const roles = db.all('SELECT * FROM hr_roles WHERE client_id = ?', c).filter((r) => !req.query.roleId || r.id === req.query.roleId)
    const rows = []
    for (const r of roles) {
      const qs = parse(r.questions, [])
      for (const cand of db.all("SELECT * FROM hr_candidates WHERE role_id = ? AND status = 'complete'", r.id)) {
        const ratings = parse(cand.ratings, {}); const answers = parse(cand.answers, {})
        const ids = qs.map((q) => q.id).filter((id) => answers[id] && ratings[id]?.score && ratings[id].auto !== true)
        if (!ids.length) continue
        const base = ids.map((id) => 1 + ((answers[id].analysis?.content ?? 0) / 10) * 4)
        rows.push({ name: cand.name, college: cand.college || '', rating: ids.reduce((s, id) => s + ratings[id].score, 0) / ids.length, baseline: base.reduce((a, b) => a + b, 0) / base.length })
      }
    }
    const total = roles.reduce((n, r) => n + db.get("SELECT COUNT(*) c FROM hr_candidates WHERE role_id = ? AND status = 'complete'", r.id).c, 0)
    const out = biasAudit(rows)
    out.total = total
    res.json(out)
  })
}
