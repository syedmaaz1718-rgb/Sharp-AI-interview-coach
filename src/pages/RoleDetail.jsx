import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Icon, Spinner } from '../components/ui.jsx'

export const authTone = (a) => (a == null ? 'na' : a >= 70 ? 'good' : a >= 45 ? 'mid' : 'low')
export function AuthChip({ a, small }) {
  if (!a || a.score == null) return <span className="auth-chip na" title="Not enough text to judge">Authenticity: n/a</span>
  return <span className={`auth-chip ${authTone(a.score)}`} title="A signal built from wording, delivery and how the text was entered. Not proof."><Icon name="shield" size={13} /> {small ? a.score : `${a.score} · ${a.level}`}</span>
}
const dec = { 'Strong hire': 'good', Hire: 'good', Maybe: 'mid', 'No hire': 'low' }
const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')

function Compare({ list, onClose }) {
  const best = (get) => { const v = list.map(get).filter((x) => x != null); return v.length > 1 && Math.max(...v) !== Math.min(...v) ? Math.max(...v) : null }
  const comps = list[0].comps
  const bestOverall = best((c) => c.overall)
  return createPortal(
    <div className="cmp-back" role="dialog" aria-modal="true" aria-label="Compare candidates" onClick={onClose}>
      <div className="cmp glass" onClick={(e) => e.stopPropagation()}>
        <div className="cmp-head"><h3 className="h3">Compare candidates</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button></div>
        <div className="cmp-scroll">
          <table className="cmp-table" style={{ '--n': list.length }}>
            <thead><tr><th />{list.map((c) => <th key={c.id}><Link to={`/recruiter/${c.roleId}/c/${c.id}`}>{c.name}</Link>{(c.decision || c.recommendation) && <span className={`tag dec ${dec[c.decision || c.recommendation]}`}>{c.decision || c.recommendation}</span>}</th>)}</tr></thead>
            <tbody>
              <tr className="cmp-total"><td>Overall</td>{list.map((c) => <td key={c.id} className={bestOverall != null && c.overall === bestOverall ? 'win' : ''}><b>{c.overall ?? '-'}</b><small> / 5</small></td>)}</tr>
              {comps.map((p, i) => { const b = best((c) => c.comps[i]?.avg ?? null); return (
                <tr key={p.id}><td>{p.name}</td>{list.map((c) => { const v = c.comps[i]?.avg; return <td key={c.id} className={b != null && v === b ? 'win' : ''}><div className="bar"><i style={{ '--w': (v ? (v / 5) * 100 : 0) + '%' }} /></div><em>{v ?? '-'}</em></td> })}</tr>
              ) })}
              <tr><td>Questions rated</td>{list.map((c) => <td key={c.id}><em>{c.coverage}%</em></td>)}</tr>
              <tr><td>Authenticity signal</td>{list.map((c) => <td key={c.id}><AuthChip a={c.authenticity} small /></td>)}</tr>
              <tr><td>Similar answers</td>{list.map((c) => <td key={c.id}><em>{c.similar.length ? c.similar.length + ' flagged' : 'none'}</em></td>)}</tr>
              <tr className="cmp-why"><td>Why</td>{list.map((c) => <td key={c.id}><small>{c.reason}</small></td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">Highlighted cells are the highest score in that row. Scores come from your pillars. Authenticity is a signal for where to probe, never a reason to reject on its own.</p>
      </div>
    </div>,
    document.body
  )
}

function Leaderboard({ role, board, reload }) {
  const [pick, setPick] = useState([])
  const [cmpOpen, setCmpOpen] = useState(false)
  const toggle = (id) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]))
  const [only, setOnly] = useState(false)
  const [adding, setAdding] = useState('')
  const nav = useNavigate()
  const rows = board.candidates.filter((c) => !only || c.shortlisted)
  const star = async (c) => { await api.hrUpdateCandidate(c.id, { shortlisted: !c.shortlisted }); reload() }
  const add = async (e) => { e.preventDefault(); if (adding.trim().length < 2) return; const c = await api.hrAddCandidate(role.id, adding.trim()); nav(`/recruiter/${role.id}/live/${c.id}`) }
  const exportCsv = () => {
    const list = board.candidates.filter((c) => c.shortlisted)
    const out = csv([['Rank', 'Name', 'Score /5', 'Recommendation', 'Coverage %', 'Authenticity', 'Reasoning'], ...list.map((c) => [c.rank ?? '', c.name, c.overall ?? '', c.decision || c.recommendation || '', c.coverage, c.authenticity.score ?? '', c.reason])])
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv' })); a.download = `${role.title.replace(/\W+/g, '-')}-shortlist.csv`; a.click()
  }
  const sl = board.candidates.filter((c) => c.shortlisted).length
  return (
    <div className="lb">
      <div className="lb-bar">
        <div className="seg"><button className={!only ? 'on' : ''} onClick={() => setOnly(false)}>All ({board.candidates.length})</button><button className={only ? 'on' : ''} onClick={() => setOnly(true)}>Shortlist ({sl})</button></div>
        <button className="btn btn-primary btn-sm" disabled={pick.length < 2} onClick={() => setCmpOpen(true)} title="Tick 2 or 3 candidates"><Icon name="scale" size={14} /> Compare{pick.length ? ` (${pick.length})` : ''}</button>
        <button className="btn btn-ghost btn-sm" disabled={!sl} onClick={exportCsv}><Icon name="file" size={14} /> Export shortlist CSV</button>
        <form className="lb-add" onSubmit={add}><input className="input" value={adding} maxLength={80} placeholder="Start a live interview: candidate name" onChange={(e) => setAdding(e.target.value)} /><button className="btn btn-primary btn-sm"><Icon name="bolt" size={14} /> Go live</button></form>
      </div>
      {!board.candidates.length && (
        <div className="empty-lb glass"><span className="empty-ico"><Icon name="users" size={28} /></span><h3 className="h3">No candidates yet</h3><p className="muted">Turn on the screening link and send it, or add a candidate to score a live interview.</p></div>
      )}
      <div className="lb-list">
        {rows.map((c, i) => (
          <article key={c.id} className={`lb-row glass ${c.shortlisted ? 'sl' : ''}`} style={{ '--i': i }}>
            <label className="cmp-pick" title="Select to compare (up to 3)"><input type="checkbox" checked={pick.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`Compare ${c.name}`} /><i /></label>
            <div className="lb-rank">{c.rank ? <b>{c.rank}</b> : <span>-</span>}</div>
            <div className="lb-main">
              <div className="lb-name"><Link to={`/recruiter/${role.id}/c/${c.id}`}><b>{c.name}</b></Link>
                <span className={`tag ${c.status === 'complete' ? 'ok' : ''}`}>{c.status === 'complete' ? 'Completed' : c.source === 'link' ? 'In progress' : 'Live scorecard'}</span>
                {(c.decision || c.recommendation) && <span className={`tag dec ${dec[c.decision || c.recommendation]}`}>{c.decision || c.recommendation}</span>}
                <AuthChip a={c.authenticity} small />
                {c.similar.length > 0 && <span className="auth-chip low" title={c.similar.map((s) => `${s.similarity}% similar to ${s.with}`).join(', ')}>Similar answers</span>}
              </div>
              <p className="lb-reason">{c.reason}{c.reasonSource === 'ai' ? '' : ''}</p>
              <div className="lb-pillars">{c.comps.map((p) => <div key={p.id} className="lbp" title={`${p.name}: ${p.avg ?? 'not rated'}`}><span>{p.name}</span><div className="bar"><i style={{ '--w': (p.avg ? (p.avg / 5) * 100 : 0) + '%' }} /></div><em>{p.avg ?? '-'}</em></div>)}</div>
            </div>
            <div className="lb-score"><b>{c.overall ?? '-'}</b><small>/ 5</small><span className="muted small">{c.coverage}% rated</span></div>
            <button className={`star-btn ${c.shortlisted ? 'on' : ''}`} aria-pressed={c.shortlisted} aria-label={c.shortlisted ? 'Remove from shortlist' : 'Add to shortlist'} onClick={() => star(c)}><Icon name="star" size={20} /></button>
          </article>
        ))}
      </div>
      {cmpOpen && pick.length >= 2 && <Compare list={board.candidates.filter((c) => pick.includes(c.id)).map((c) => ({ ...c, roleId: role.id }))} onClose={() => setCmpOpen(false)} />}
      <p className="muted small lb-note">Ranking uses the score on your pillars. {board.aiReasons ? 'Reasoning is written by the AI from those numbers.' : 'Reasoning is generated from the scores, coverage and authenticity flags.'} Authenticity is a signal for where to probe, never a reason to reject on its own.</p>
    </div>
  )
}

function Kit({ role, reload }) {
  const [w, setW] = useState(() => Object.fromEntries(role.rubric.map((r) => [r.id, r.weight])))
  const [saved, setSaved] = useState(false)
  const save = async () => { await api.hrUpdateRole(role.id, { weights: role.rubric.map((r) => ({ id: r.id, weight: w[r.id] })) }); setSaved(true); setTimeout(() => setSaved(false), 1500); reload() }
  const dirty = role.rubric.some((r) => w[r.id] !== r.weight)
  return (
    <div className="kit">
      <section className="glass pad">
        <div className="kit-h"><h3 className="h3"><Icon name="scale" size={17} /> Rubric</h3><button className="btn btn-sm btn-primary" disabled={!dirty} onClick={save}>{saved ? 'Saved' : 'Save weights'}</button></div>
        <p className="muted small">{role.source === 'ai' ? 'Written by the AI from your job description.' : 'Built from your job description and pillars.'} Adjust the weights, the leaderboard updates.</p>
        {role.rubric.map((r) => (
          <div key={r.id} className="rub">
            <div className="rub-top"><b>{r.name}</b><input type="range" min="5" max="60" step="5" value={w[r.id]} onChange={(e) => setW({ ...w, [r.id]: Number(e.target.value) })} aria-label={`${r.name} weight`} /><span>{w[r.id]}%</span></div>
            <p className="muted small">{r.description}</p>
            <div className="anch"><span><em>1</em>{r.anchors[1]}</span><span><em>3</em>{r.anchors[3]}</span><span><em>5</em>{r.anchors[5]}</span></div>
          </div>
        ))}
      </section>
      <section className="glass pad">
        <h3 className="h3"><Icon name="chat" size={17} /> Questions ({role.questions.length})</h3>
        <ol className="kq">
          {role.questions.map((q) => (
            <li key={q.id}>
              <p>{q.text}</p>
              <span className="tag">{role.rubric.find((r) => r.id === q.competency)?.name || q.competency}</span>
              {q.looksFor?.length > 0 && <div className="lf"><small>LOOK FOR</small><ul>{q.looksFor.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              {q.redFlags?.length > 0 && <div className="lf red"><small>RED FLAGS</small><ul>{q.redFlags.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function Screening({ role, reload }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const s = role.screening
  const url = s.path ? window.location.origin + s.path : ''
  const toggle = async (open) => { setBusy(true); try { await api.hrScreening(role.id, open); await reload() } finally { setBusy(false) } }
  const copy = async () => { try { await navigator.clipboard.writeText(url) } catch { window.prompt('Copy this link', url) } setCopied(true); setTimeout(() => setCopied(false), 1800) }
  return (
    <div className="screening glass pad">
      <h3 className="h3"><Icon name="link" size={18} /> Async screening link</h3>
      <p className="muted">Send this link to any number of candidates. Each one takes the AI interview on their own time, by voice or typing{role.lang !== 'en' ? `, in ${role.lang === 'hindi' ? 'Hindi' : 'Hinglish'}` : ''}. You get a scored, ranked report. Candidates never see their scores or the questions in advance.</p>
      {s.path ? (
        <>
          <div className={`link-box ${s.open ? 'live' : ''}`}><Icon name="link" size={16} /><code>{url}</code><button className="btn btn-sm btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></div>
          <div className="link-state"><span className={`dot-live ${s.open ? 'on' : ''}`} /> {s.open ? 'Accepting candidates' : 'Closed. Candidates see a closed message.'}
            <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => toggle(!s.open)}>{s.open ? 'Close link' : 'Re-open link'}</button></div>
        </>
      ) : <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => toggle(true)}><Icon name="link" size={18} /> Create screening link</button>}
      <ul className="how">
        <li><b>1</b><span>Candidate opens the link, enters name, accepts the consent note.</span></li>
        <li><b>2</b><span>The interviewer asks your {role.questions.length} questions one at a time, with a follow-up when an answer is thin.</span></li>
        <li><b>3</b><span>You get transcripts, auto scores per pillar, authenticity signals, and a ranked leaderboard.</span></li>
      </ul>
    </div>
  )
}

export default function RoleDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('board')
  const reload = useCallback(() => api.hrRole(id).then(setData).catch((e) => setErr(e.message)), [id])
  useEffect(() => { reload(); const t = setInterval(reload, 15000); return () => clearInterval(t) }, [reload])
  if (err) return <main className="narrow center"><div className="glass pad"><h2>Role not found</h2><p className="muted">It may have been deleted, or the link is wrong. Your roles are on the Interviewer home.</p><Link className="btn btn-primary" to="/recruiter">Back to roles</Link></div></main>
  if (!data) return <main className="narrow"><Spinner text="Loading role..." /></main>
  const { role, board } = data
  const del = async () => { if (!confirm('Delete this role and all its candidates?')) return; await api.hrDeleteRole(role.id); nav('/recruiter') }
  const done = board.candidates.filter((c) => c.status === 'complete').length
  return (
    <main className="page-wide">
      <header className="pg-head rd-head">
        <Link to="/recruiter" className="back"><Icon name="arrow" size={14} className="flip" /> All roles</Link>
        <span className="idx">ROLE</span>
        <h1 className="display">{role.title}</h1>
        <p className="muted lede">{role.company ? role.company + ' · ' : ''}{role.questions.length} questions · {role.rubric.length} pillars · {board.candidates.length} candidates ({done} completed)</p>
      </header>
      <div className="tabs rd-tabs" role="tablist">
        {[['board', 'Leaderboard', 'trophy'], ['link', 'Screening link', 'link'], ['kit', 'Interview kit', 'scale']].map(([k, l, i]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon name={i} size={15} /> {l}</button>)}
      </div>
      {tab === 'board' && <Leaderboard role={role} board={board} reload={reload} />}
      {tab === 'link' && <Screening role={role} reload={reload} />}
      {tab === 'kit' && <Kit role={role} reload={reload} />}
      <div className="rd-foot"><button className="btn btn-ghost btn-sm" onClick={del}><Icon name="trash" size={14} /> Delete role</button></div>
    </main>
  )
}
