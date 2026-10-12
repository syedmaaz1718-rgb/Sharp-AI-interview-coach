import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Sparkline, Spinner, Icon, fmt, tone, roleLabel, Hello } from '../components/ui.jsx'

const SKILLS = [['answer', 'Answer quality', 'Use a clear story: situation, action, result, with a number.'], ['eye', 'Eye contact', 'Look at the lens when you speak, not at your own face.'], ['expression', 'Expression', 'Relax your brow and let a small smile show.'], ['pace', 'Speaking pace', 'Aim for 120 to 160 words per minute.'], ['filler', 'Filler words', 'Pause silently instead of saying um or like.'], ['energy', 'Vocal energy', 'Vary your pitch and volume on key points.'], ['steady', 'Head steadiness', 'Keep your head still and your shoulders square.']]
const avg = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null }

export function Dashboard({ list }) {
  const recent = list.slice(0, 5)
  const earlier = list.slice(5, 10)
  const rows = SKILLS.map(([k, label, tip]) => ({ k, label, tip, now: avg(recent.map((s) => s.scores?.[k])), before: avg(earlier.map((s) => s.scores?.[k])) })).filter((r) => r.now != null)
  const weakest = [...rows].sort((a, b) => a.now - b.now)[0]
  const best = Math.max(...list.map((s) => s.overall ?? 0))
  const mins = list.length
  return (
    <section className="glass pad dash">
      <div className="dash-top">
        <div className="dstat"><small>Sessions</small><b>{mins}</b></div>
        <div className="dstat"><small>Best score</small><b>{fmt(best)}</b></div>
        <div className="dstat"><small>Last 5 average</small><b>{fmt(avg(recent.map((s) => s.overall)))}</b></div>
        {weakest && <div className="dstat focus"><small>Work on this next</small><b>{weakest.label}</b></div>}
      </div>
      {weakest && <p className="dash-tip"><Icon name="bulb" size={15} /> {weakest.tip}</p>}
      <h3 className="h3">Skills across your last {recent.length} {recent.length === 1 ? 'session' : 'sessions'}</h3>
      <div className="skill-rows">
        {rows.map((r) => {
          const d = r.before != null ? r.now - r.before : null
          return (
            <div key={r.k} className={`skill-row ${weakest && r.k === weakest.k ? 'weak' : ''}`}>
              <span className="sk-name">{r.label}</span>
              <span className="sk-bar"><i style={{ width: `${r.now * 10}%` }} className={`t-${tone(r.now)}`} /></span>
              <span className="sk-val">{fmt(r.now)}</span>
              <span className={`sk-delta ${d == null ? '' : d >= 0.2 ? 'up' : d <= -0.2 ? 'down' : ''}`}>{d == null ? '' : d >= 0.2 ? `+${d.toFixed(1)}` : d <= -0.2 ? d.toFixed(1) : 'flat'}</span>
            </div>
          )
        })}
      </div>
      <p className="muted small">Averages only use sessions where that skill was measured. Face and voice need camera and mic on.</p>
    </section>
  )
}

export default function History() {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.history().then((h) => setList(h.sessions)).catch((e) => setErr(e.message)) }, [])

  if (err) return <main className="page-wide"><div className="alert">{err}</div></main>
  if (!list) return <main className="page-wide"><Spinner text="Loading your sessions..." /></main>


  return (
    <main className="page-wide">
      <header className="pg-head"><Hello /><span className="idx">HISTORY</span><h1 className="display">Session<br /><span className="dim">history.</span></h1></header>
      {!list.length ? (
        <div className="glass pad center empty">
          <div className="empty-ico"><Icon name="mic" size={30} /></div>
          <h3>No interviews yet</h3>
          <p className="muted">Your scores and progress over time will show up here after your first mock interview. Sessions are tied to this browser.</p>
          <Link className="btn btn-primary btn-lg" to="/">Start one</Link>
        </div>
      ) : (
        <>
          <div className="hist">
            {list.map((s, i) => (
              <Link key={s.id} to={`/report/${s.id}`} className="hist-item glass" style={{ animationDelay: `${i * 50}ms` }}>
                <div className={`hist-score t-${tone(s.overall)}`}>{fmt(s.overall)}</div>
                <div className="hist-main">
                  <b>{roleLabel(s.role)}</b>
                  <span>{new Date(s.finishedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {s.questions} questions</span>
                  <em>{s.headline}</em>
                </div>
                <span className="chev-r" aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
