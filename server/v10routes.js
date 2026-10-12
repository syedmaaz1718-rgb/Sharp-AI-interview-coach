// v10 routes: live recruiter copilot and Skill Passport.
import { svgToPng, scorePdf, brandSvg } from './raster.js'
import crypto from 'node:crypto'
import { ROLES } from './questions.js'
import { llmEnabled, allowLlmCall, llmCopilot } from './llm.js'
import { computeSharpScore, scoreCardSvg, authenticity } from './v8.js'
import { tokenize } from '../src/lib/analysis.js'
import { copilotRules, pillarCoverage, passportPayload, signPayload, verifyPayload } from './v10.js'

const now = () => new Date().toISOString()
const clip = (s, n) => String(s || '').trim().slice(0, n)
const rid = (n = 10) => crypto.randomBytes(n).toString('base64url')
const parse = (s, d) => { try { return JSON.parse(s) } catch { return d } }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function registerV10(app, { db, owner, llm = {} }) {
  const L = { copilot: llmCopilot, ...llm }
  const secret = () => {
    if (process.env.PASSPORT_SECRET) return process.env.PASSPORT_SECRET
    let r = db.get("SELECT v FROM meta WHERE k = 'passport_secret'")
    if (!r) { db.run("INSERT OR IGNORE INTO meta (k, v) VALUES ('passport_secret', ?)", crypto.randomBytes(32).toString('hex')); r = db.get("SELECT v FROM meta WHERE k = 'passport_secret'") }
    return r.v
  }

  // ------------------------------------------------ live copilot
  app.post('/api/hr/roles/:id/copilot', async (req, res) => {
    const c = owner(req, req.body?.clientId)
    if (!c) return res.status(400).json({ error: 'Invalid clientId' })
    const r = db.get('SELECT * FROM hr_roles WHERE id = ?', req.params.id)
    if (!r || r.client_id !== c) return res.status(404).json({ error: 'Role not found' })
    const questions = parse(r.questions, []); const rubric = parse(r.rubric, [])
    const q = questions.find((x) => x.id === req.body?.questionId)
    if (!q) return res.status(400).json({ error: 'Unknown question' })
    const transcript = clip(req.body?.transcript, 6000)
    const answered = (Array.isArray(req.body?.answeredIds) ? req.body.answeredIds : []).filter((x) => questions.some((k) => k.id === x))
    const pillar = rubric.find((p) => p.id === q.competency)?.name || ''
    const base = copilotRules({ question: q, transcript, role: r.title, looksFor: q.looksFor, redFlags: q.redFlags })
    let source = 'rules'; let out = { ...base }
    if (llmEnabled() && tokenize(transcript).length >= 8 && allowLlmCall(req.ip)) {
      const ai = await L.copilot({ question: q, transcript, role: r.title, looksFor: q.looksFor || [], redFlags: q.redFlags || [], pillar })
      if (ai) { source = 'ai'; out = { ...base, followUps: ai.followUps, probes: ai.probes.length ? ai.probes : base.probes, summary: ai.summary || base.summary } }
    }
    const ids = answered.includes(q.id) || tokenize(transcript).length < 15 ? answered : [...answered, q.id]
    res.json({
      ...out, source, pillar,
      authenticity: tokenize(transcript).length >= 25 ? authenticity({ transcript, input: req.body?.input === 'typed' ? 'typed' : 'speech', durationSec: Number(req.body?.durationSec) || undefined }) : null,
      coverage: pillarCoverage(rubric, questions, ids),
    })
  })

  // ------------------------------------------------ skill passport
  const sessionReport = (s) => parse(s.report, null)
  const labelOf = (s, rep) => rep.roleLabel || (s.role.startsWith('pack:') ? s.role.slice(5).replace(/^./, (x) => x.toUpperCase()) + ' style' : ROLES.find((x) => x.id === s.role)?.label || 'Mock interview')

  app.post('/api/sessions/:id/passport', (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s || s.status !== 'finished') return res.status(404).json({ error: 'Finish the interview first.' })
    if (owner(req, req.body?.clientId) !== s.client_id) return res.status(403).json({ error: 'Not your session' })
    const rep = sessionReport(s); const sc = rep && computeSharpScore({ ...rep, mode: s.mode })
    if (!sc) return res.status(404).json({ error: 'No score yet' })
    const name = clip(req.body?.name, 40).replace(/[<>]/g, '')
    if (name.length < 2) return res.status(400).json({ error: 'Enter the name to print on the passport.' })
    const existing = db.get('SELECT * FROM passports WHERE session_id = ?', s.id)
    const token = existing?.token || rid(12)
    const issuedAt = existing && !existing.revoked ? parse(existing.payload, {}).issuedAt : now()
    const payload = passportPayload({ id: token, name, report: rep, score: sc, roleLabel: labelOf(s, rep), issuedAt })
    const sig = signPayload(payload, secret())
    db.run('INSERT OR REPLACE INTO passports (token, session_id, payload, sig, issued_at, revoked) VALUES (?,?,?,?,?,0)', token, s.id, JSON.stringify(payload), sig, issuedAt)
    res.json({ token, path: '/p/' + token, payload })
  })
  app.get('/api/sessions/:id/passport', (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s || owner(req, req.query?.clientId) !== s.client_id) return res.status(404).json({ error: 'Not found' })
    const p = db.get('SELECT * FROM passports WHERE session_id = ? AND revoked = 0', s.id)
    res.json(p ? { token: p.token, path: '/p/' + p.token, payload: parse(p.payload, {}) } : { token: null })
  })
  app.delete('/api/sessions/:id/passport', (req, res) => {
    const s = db.get('SELECT * FROM sessions WHERE id = ?', req.params.id)
    if (!s) return res.status(404).json({ error: 'Not found' })
    if (owner(req, req.query?.clientId || req.body?.clientId) !== s.client_id) return res.status(403).json({ error: 'Not your session' })
    db.run('UPDATE passports SET revoked = 1 WHERE session_id = ?', s.id)
    res.json({ ok: true })
  })
  const load = (token) => {
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(String(token))) return null
    const p = db.get('SELECT * FROM passports WHERE token = ? AND revoked = 0', token)
    if (!p) return null
    const payload = parse(p.payload, null)
    return payload && { payload, verified: verifyPayload(payload, p.sig, secret()), issuedAt: p.issued_at }
  }
  app.get('/api/passport/:token', (req, res) => {
    const p = load(req.params.token)
    if (!p) return res.status(404).json({ error: 'This passport is not available.' })
    res.json(p)
  })
  app.get('/api/passport/:token/card.png', (req, res) => {
    const p = load(req.params.token)
    if (!p) return res.status(404).type('text/plain').send('Not found')
    const x = p.payload
    res.type('image/png').set('Cache-Control', 'public, max-age=300').send(svgToPng(scoreCardSvg({ score: x.score, band: x.band, dims: x.dims, name: x.name, role: x.role, mode: x.mode, lang: x.lang, strongest: x.strongest })))
  })
  app.get('/api/passport/:token/card.svg', (req, res) => {
    const p = load(req.params.token)
    if (!p) return res.status(404).type('text/plain').send('Not found')
    const x = p.payload
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=300').send(scoreCardSvg({ score: x.score, band: x.band, dims: x.dims, name: x.name, role: x.role, mode: x.mode, lang: x.lang, strongest: x.strongest }))
  })
  app.get('/p/:token', (req, res) => {
    const p = load(req.params.token)
    const shell = (body, title = 'SharpAI Skill Passport', og = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${og}<link rel="preconnect" href="https://fonts.googleapis.com"><style>${PASSPORT_CSS}</style></head><body>${body}</body></html>`
    if (!p) return res.status(404).type('html').send(shell('<main class="pp"><div class="card"><h1>This passport is not available</h1><p class="mut">It may have been turned off by its owner, or the link is wrong.</p><a class="cta" href="/">Go to SharpAI</a></div></main>'))
    const x = p.payload
    const origin = `${req.protocol}://${req.get('host')}`
    const title = `${x.name}: SharpAI Skill Passport, ${x.score}/100`
    const og = `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(x.role)} practice interview, AI-verified by SharpAI. Strongest: ${esc(x.strongest || 'n/a')}."><meta property="og:image" content="${esc(origin)}/api/passport/${esc(req.params.token)}/card.png"><meta name="twitter:card" content="summary_large_image">`
    const date = new Date(x.date || x.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const skills = x.skills.length ? x.skills.map((s) => `<li class="${s.level}"><b>${esc(s.skill)}</b><span>${s.level === 'demonstrated' ? 'Demonstrated' : 'Mentioned'}</span></li>`).join('') : '<li class="empty">No technical skills were detected in the answers.</li>'
    const dims = x.dims.map((d) => `<div class="row"><span>${esc(d.label)}</span><div class="bar"><i style="width:${d.score}%"></i></div><b>${d.score}</b></div>`).join('')
    res.type('html').send(shell(`<main class="pp"><div class="card">
<div class="top"><span class="logo">SharpAI</span><span class="seal ${p.verified ? 'ok' : 'bad'}">${p.verified ? 'Verified' : 'Could not verify'}</span></div>
<p class="eyebrow">SKILL PASSPORT</p><h1>${esc(x.name)}</h1><p class="mut">${esc(x.role)} · ${esc(date)}${x.mode === 'stress' ? ' · Stress mode' : ''}</p>
<div class="score"><b>${x.score}</b><span>/100</span><em>${esc(x.band)}</em></div>
<h2>Score breakdown</h2>${dims}
<h2>Skills in the answers</h2><ul class="sk">${skills}</ul>
<p class="note"><b>${p.verified ? 'Signature valid.' : 'Signature check failed.'}</b> Issued ${esc(new Date(p.issuedAt).toUTCString())}. ${esc(x.framing)} The passport shows no answers, video or audio. Demonstrated means the skill appeared in an answer that scored 6 out of 10 or more.</p>
<a class="cta" href="/">Get your own SharpAI score</a></div></main>`, title, og))
  })
}

const PASSPORT_CSS = `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0a0b14;color:#e8eaf2;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;background-image:radial-gradient(60% 45% at 15% 0%,rgba(139,92,246,.35),transparent),radial-gradient(50% 40% at 95% 100%,rgba(34,211,238,.22),transparent)}.pp{display:grid;place-items:start center;padding:32px 16px 60px}.card{width:100%;max-width:640px;padding:28px;border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.12);box-shadow:0 40px 100px -30px rgba(0,0,0,.7);backdrop-filter:blur(20px)}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.logo{font-weight:800;letter-spacing:-.02em;font-size:1.1rem}.seal{font-size:.75rem;font-weight:700;padding:6px 12px;border-radius:99px;letter-spacing:.04em}.seal.ok{background:rgba(52,211,153,.14);color:#34d399;border:1px solid rgba(52,211,153,.4)}.seal.bad{background:rgba(251,113,133,.14);color:#fb7185;border:1px solid rgba(251,113,133,.4)}.eyebrow{margin:0;font-size:.72rem;letter-spacing:.16em;color:#22d3ee;font-weight:700}h1{margin:6px 0 4px;font-size:clamp(1.9rem,6vw,2.6rem);letter-spacing:-.03em;line-height:1.05}h2{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#9aa3b2;margin:26px 0 10px}.mut{color:#9aa3b2;margin:0}.score{display:flex;align-items:baseline;gap:8px;margin:18px 0 0}.score b{font-size:4.2rem;line-height:1;font-weight:800;background:linear-gradient(135deg,#8b5cf6,#22d3ee,#34d399);-webkit-background-clip:text;background-clip:text;color:transparent}.score span{color:#9aa3b2}.score em{font-style:normal;margin-left:10px;font-weight:700;color:#34d399}.row{display:grid;grid-template-columns:150px 1fr 34px;gap:12px;align-items:center;margin:8px 0;font-size:.9rem}.bar{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}.bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#8b5cf6,#22d3ee)}.row b{text-align:right}.sk{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}.sk li{display:flex;gap:8px;align-items:center;padding:8px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);font-size:.88rem}.sk li span{font-size:.7rem;color:#9aa3b2}.sk li.demonstrated{border-color:rgba(52,211,153,.45)}.sk li.demonstrated span{color:#34d399}.sk .empty{color:#9aa3b2;border-style:dashed}.note{margin:26px 0 0;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-size:.8rem;color:#9aa3b2;line-height:1.55}.note b{color:#e8eaf2}.cta{display:inline-block;margin-top:22px;padding:13px 22px;border-radius:14px;background:linear-gradient(135deg,#8b5cf6,#22d3ee);color:#fff;text-decoration:none;font-weight:700;transition:transform .2s cubic-bezier(.34,1.56,.64,1)}.cta:active{transform:scale(.96)}@media(max-width:480px){.row{grid-template-columns:110px 1fr 30px}.card{padding:20px;border-radius:22px}}`
