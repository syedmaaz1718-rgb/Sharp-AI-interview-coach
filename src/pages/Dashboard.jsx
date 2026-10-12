import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Sparkline, Spinner, Icon, fmt, Hello } from '../components/ui.jsx'
import { Dashboard as Skills } from './History.jsx'

export default function DashboardPage() {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.history().then((h) => setList(h.sessions)).catch((e) => setErr(e.message)) }, [])
  if (err) return <main className="page-wide"><div className="alert">{err}</div></main>
  if (!list) return <main className="page-wide"><Spinner text="Loading your progress..." /></main>
  const chrono = [...list].reverse()
  const first = chrono[0]?.overall
  const last = chrono[chrono.length - 1]?.overall
  const delta = chrono.length > 1 && first != null && last != null ? last - first : null
  return (
    <main className="page-wide">
      <header className="pg-head"><Hello /><span className="idx">DASHBOARD</span><h1 className="display">Your<br /><span className="dim">progress.</span></h1></header>
      {!list.length ? (
        <div className="glass pad center empty">
          <div className="empty-ico"><Icon name="chart" size={30} /></div>
          <h3>Nothing to chart yet</h3>
          <p className="muted">Finish one mock interview and your scores, strongest skills and the one thing to fix next appear here.</p>
          <Link className="btn btn-primary btn-lg" to="/practice">Start practising</Link>
        </div>
      ) : (
        <>
          <div className="pg"><div className="pg-main">
          <section className="glass pad">
            <div className="trend-head">
              <div><small className="muted">Overall score trend</small><div className="trend-num">{fmt(last)}<span>/10</span></div></div>
              {delta != null && <div className={`delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? 'Up ' : 'Down '}{Math.abs(delta).toFixed(1)} since first session</div>}
            </div>
            {chrono.length > 1 ? <Sparkline values={chrono.map((c) => c.overall ?? 0)} /> : <p className="muted small">Do a second session to see your trend line.</p>}
          </section>
          <Skills list={list} />
          </div>
          <aside className="rail">
            <div className="rail-card"><small>LATEST SCORE</small><div className="rail-num">{fmt(last)}<span>/10</span></div><p className="muted small">{list.length} {list.length === 1 ? 'session' : 'sessions'} saved</p></div>
            <div className="rail-card"><small>NEXT STEP</small><p>Practise again while the last answer is fresh. Pick the same role to see your deltas move.</p>
              <div className="btn-row" style={{ marginTop: 14 }}><Link className="btn btn-primary" to="/practice">Practise again</Link><Link className="btn btn-ghost" to="/history">All sessions</Link></div></div>
          </aside></div>
        </>
      )}
    </main>
  )
}
