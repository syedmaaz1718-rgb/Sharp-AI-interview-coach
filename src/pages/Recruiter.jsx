import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Icon, Spinner, Hello } from '../components/ui.jsx'
import { LANGS } from '../lib/prefs.js'

const PRESETS = ['Ownership', 'Communication', 'Hustle', 'Craft', 'Customer focus', 'Integrity', 'Curiosity', 'Teamwork']
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago` }

export function PillarEditor({ pillars, setPillars }) {
  const [name, setName] = useState('')
  const add = (n) => {
    const v = (n ?? name).trim()
    if (v.length < 2 || pillars.some((p) => p.name.toLowerCase() === v.toLowerCase()) || pillars.length >= 7) return
    setPillars([...pillars, { name: v, weight: 20 }]); setName('')
  }
  return (
    <div className="pillars">
      <div className="pl-list">
        {pillars.map((p, i) => (
          <div key={p.name} className="pl-item">
            <b>{p.name}</b>
            <input type="range" min="5" max="60" step="5" value={p.weight} aria-label={`${p.name} weight`} onChange={(e) => setPillars(pillars.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} />
            <span>{p.weight}%</span>
            <button type="button" className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => setPillars(pillars.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          </div>
        ))}
        {!pillars.length && <p className="muted small">Optional. Without pillars, SharpAI builds a standard rubric from the job description.</p>}
      </div>
      <div className="pl-add">
        <input className="input" value={name} maxLength={50} placeholder="Add a company value, e.g. Ownership" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="btn btn-ghost" onClick={() => add()} disabled={name.trim().length < 2}>Add</button>
      </div>
      <div className="tags presets">{PRESETS.filter((p) => !pillars.some((x) => x.name === p)).map((p) => <button type="button" key={p} className="tag btn-tag" onClick={() => add(p)}>+ {p}</button>)}</div>
    </div>
  )
}

function NewRole({ onClose }) {
  const nav = useNavigate()
  const [f, setF] = useState({ title: '', company: '', jd: '', lang: 'en', count: 8 })
  const [pillars, setPillars] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const read = (file) => { if (!file) return; const r = new FileReader(); r.onload = () => set('jd', String(r.result).slice(0, 8000)); r.readAsText(file) }
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const r = await api.hrCreate({ ...f, pillars }); nav('/recruiter/' + r.id) } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <form className="glass new-role fade-up" onSubmit={go}>
      <div className="nr-head"><h2 className="h2 left">New interview kit</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button></div>
      <div className="nr-grid">
        <label><span>Role title</span><input className="input" required value={f.title} maxLength={100} onChange={(e) => set('title', e.target.value)} placeholder="Frontend Intern" /></label>
        <label><span>Company (shown to candidates)</span><input className="input" value={f.company} maxLength={80} onChange={(e) => set('company', e.target.value)} placeholder="Acme" /></label>
      </div>
      <label className="nr-jd"><span>Job description</span><textarea className="ta" rows={9} required value={f.jd} onChange={(e) => set('jd', e.target.value)} placeholder="Paste the full job description. SharpAI writes questions that test what this role really needs." /></label>
      <div className="nr-row">
        <label className="file-btn"><input type="file" accept=".txt,.md,text/plain" onChange={(e) => { read(e.target.files[0]); e.target.value = '' }} /> Upload .txt</label>
        <div className="lang-row"><span><Icon name="chat" size={15} /> Interview language</span><div className="seg">{LANGS.map(([k, l]) => <button type="button" key={k} className={f.lang === k ? 'on' : ''} onClick={() => set('lang', k)}>{l}</button>)}</div></div>
        <div className="lang-row"><span>Questions</span><div className="seg">{[6, 8, 10, 12].map((n) => <button type="button" key={n} className={f.count === n ? 'on' : ''} onClick={() => set('count', n)}>{n}</button>)}</div></div>
      </div>
      <div className="nr-pillars"><h3 className="h3"><Icon name="scale" size={16} /> Your evaluation pillars</h3><p className="muted small">Define what your company values. Questions and the scorecard adapt to them.</p><PillarEditor pillars={pillars} setPillars={setPillars} /></div>
      {err && <div className="alert">{err}</div>}
      <div className="start-foot"><button className="btn btn-primary btn-lg" disabled={busy || f.jd.trim().length < 60 || f.title.trim().length < 2}>{busy ? 'Building your kit...' : 'Generate interview kit'} <Icon name="spark" size={18} /></button></div>
    </form>
  )
}

export default function Recruiter() {
  const [roles, setRoles] = useState(null)
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { api.hrRoles().then((r) => { setRoles(r.roles); if (!r.roles.length) setAdding(true) }).catch((e) => setErr(e.message)) }, [])
  return (
    <main className="page-wide">
      <header className="pg-head"><Hello /><span className="idx">INTERVIEWER</span><h1 className="display">Hire with<br /><span className="dim">evidence.</span></h1><p className="muted lede">Paste a job description, send one screening link, and get every candidate scored on your pillars, ranked, with an honest authenticity signal.</p></header>
      <div className="rc-feats">
        {[['link', 'Async screening link', 'Candidates interview themselves. No scheduling.'], ['trophy', 'Auto-ranked leaderboard', 'Reasoned ranking and one-click shortlist.'], ['shield', 'Authenticity signal', 'Flags scripted or pasted answers. A signal, not a verdict.'], ['scale', 'Your pillars', 'The rubric follows your company values.']].map(([i, t, d]) => (
          <div key={t} className="rc-feat"><span className="f-ico"><Icon name={i} size={20} /></span><b>{t}</b><span>{d}</span></div>
        ))}
      </div>
      {err && <div className="alert">{err}</div>}
      {adding ? <NewRole onClose={() => setAdding(false)} /> : (
        <div className="rc-bar"><h2 className="h2 left">Your roles</h2><button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="spark" size={16} /> New role</button></div>
      )}
      {roles == null && !err && <Spinner text="Loading roles..." />}
      {roles && roles.length > 0 && (
        <div className="role-grid">
          {roles.map((r) => (
            <Link key={r.id} to={'/recruiter/' + r.id} className="role-card glass">
              <div className="rcd-top"><b>{r.title}</b>{r.screeningOpen ? <span className="tag ok">Link live</span> : <span className="tag">Link off</span>}</div>
              <small className="muted">{r.company || 'No company set'} · {ago(r.createdAt)}</small>
              <div className="rcd-stats">
                <div><b>{r.candidates}</b><span>candidates</span></div>
                <div><b>{r.completed}</b><span>completed</span></div>
                <div><b>{r.shortlisted}</b><span>shortlisted</span></div>
              </div>
              <span className="rcd-foot">{r.questions} questions · {r.pillars} pillars <Icon name="arrow" size={14} /></span>
            </Link>
          ))}
        </div>
      )}
      {roles && roles.length > 0 && <BiasAudit />}
    </main>
  )
}

export function BiasAudit() {
  const [a, setA] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async () => { setBusy(true); setErr(''); try { setA(await api.hrAudit()) } catch (e) { setErr(e.message) } setBusy(false) }
  return (
    <section className="glass pad audit">
      <div className="audit-h">
        <div><span className="eyebrow"><Icon name="scale" size={14} /> Responsible hiring</span><h3>Scorecard bias audit</h3>
          <p className="muted small">Checks whether your own ratings drift from answer quality for some groups. A signal to re-read ratings, never a verdict.</p></div>
        <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? 'Auditing...' : a ? 'Run again' : 'Run audit'}</button>
      </div>
      {err && <div className="alert">{err}</div>}
      {a && (
        <div className="fade-up">
          <p className="muted small">Used {a.usable} of {a.total} completed candidates (those from screening links with ratings you entered yourself).{a.agreement != null ? ` Your ratings track answer quality with a correlation of ${a.agreement}.` : ''}</p>
          {a.checks.map((c) => (
            <div key={c.title} className={`ck ${c.status}`}>
              <b>{c.title}</b><span className="tag">{c.status === 'flag' ? 'Worth reviewing' : c.status === 'clear' ? 'No pattern found' : 'Not enough data'}</span>
              <p>{c.text}</p>
              {c.groups?.length > 0 && <div className="grp">{c.groups.map((g) => <small key={g.label}>{g.label}: {g.n} candidates, avg rating {g.avgRating}, answer-quality baseline {g.avgBaseline}</small>)}</div>}
            </div>
          ))}
          <details><summary>How this works and its limits</summary><ul>{a.method.map((m, i) => <li key={i}>{m}</li>)}</ul></details>
        </div>
      )}
    </section>
  )
}
