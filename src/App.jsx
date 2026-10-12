import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Nav, Aurora, Icon } from './components/ui.jsx'
import { Link } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Install from './pages/Install.jsx'
import Interview from './pages/Interview.jsx'
import Report from './pages/Report.jsx'
import Login from './pages/Login.jsx'
import Practice from './pages/Practice.jsx'
import DashboardPage from './pages/Dashboard.jsx'
import Privacy from './pages/Privacy.jsx'
import History from './pages/History.jsx'
import Recruiter from './pages/Recruiter.jsx'
import RoleDetail from './pages/RoleDetail.jsx'
import Scorecard from './pages/Scorecard.jsx'
import Screen from './pages/Screen.jsx'
import Battle from './pages/Battle.jsx'
import {ArenaHome,ArenaRoom,ArenaTournament,ArenaShared} from './pages/Arena.jsx'
import Live from './pages/Live.jsx'
import { useMode, setMode } from './lib/mode.js'
import { api } from './lib/api.js'
import { initFx, countUp } from './lib/fx.js'

const SIDE = [['/', 'Home', 'layout'], ['/practice', 'Practice', 'mic'], ['/arena', 'Arena', 'bolt'], ['/dashboard', 'Dashboard', 'chart'], ['/history', 'History', 'replay'], ['/privacy', 'Privacy', 'shield'], ['/install', 'Install app', 'layout']]
const SIDE_HR = [['/', 'Home', 'layout'], ['/recruiter', 'Roles', 'users'], ['/privacy', 'Privacy', 'shield'], ['/install', 'Install app', 'layout']]
function SideRail({ path }) {
  const mode = useMode()
  const SIDE_ = mode === 'interviewer' ? SIDE_HR : SIDE
  return (
    <aside className="siderail" aria-label="Sections">
      <Link to="/" className="sr-logo" aria-label="SharpAI home"><svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="11" fill="#0d0f1a" stroke="rgba(196,181,253,.35)" /><path d="M29 12.5H17.5a4.5 4.5 0 0 0 0 9H22" fill="none" stroke="#c4b5fd" strokeWidth="4.2" strokeLinecap="round" /><path d="M11 27.5H22.5a4.5 4.5 0 0 0 0-9H18" fill="none" stroke="#2dd4bf" strokeWidth="4.2" strokeLinecap="round" /></svg></Link>
      <nav>{SIDE_.map(([to, label, ico]) => <Link key={to} to={to} className={path === to || (to !== '/' && path.startsWith(to)) ? 'on' : ''}><Icon name={ico} size={20} /><span>{label}</span></Link>)}</nav>
      {mode === 'interviewer' ? <Link to="/recruiter" className="sr-cta"><Icon name="spark" size={18} /><span>New role</span></Link> : <Link to="/practice" className="sr-cta"><Icon name="play" size={18} /><span>New interview</span></Link>}
    </aside>
  )
}

const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}` }
function RightRail() {
  const [list, setList] = useState(null)
  const [qotd, setQotd] = useState(null)
  useEffect(() => {
    api.history().then((h) => setList(h.sessions || [])).catch(() => setList([]))
    const today = dayKey(Date.now())
    try { const c = JSON.parse(localStorage.getItem('sharpai_qotd') || 'null'); if (c && c.day === today && c.q) { setQotd(c.q); return } } catch {}
    api.questions('general', 3).then((r) => { const q = (r.questions || []).find((x) => x.text && x.text.length > 25) || r.questions?.[0]; if (q) { setQotd(q); try { localStorage.setItem('sharpai_qotd', JSON.stringify({ day: today, q })) } catch {} } }).catch(() => {})
  }, [])
  const days = new Set((list || []).map((s) => dayKey(s.finishedAt)))
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { on: days.has(dayKey(d)), l: 'SMTWTFS'[d.getDay()] } })
  let streak = 0; { const d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); while (days.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1) } }
  const last = (list || [])[0]
  return (
    <aside className="rightrail" aria-label="Extras">
      <div className="rr-icons">
        <span title="Streak"><Icon name="bell" size={20} /></span><span title="Question of the day"><Icon name="bulb" size={20} /></span><span title="Shortcuts"><Icon name="compass" size={20} /></span>
      </div>
      <div className="rr-body">
        <section><small>PRACTICE STREAK</small><div className="rr-streak"><b>{streak}</b><span>{streak === 1 ? 'day' : 'days'} in a row</span></div>
          <div className="rr-week">{week.map((w, i) => <i key={i} className={w.on ? 'on' : ''}><em>{w.l}</em></i>)}</div></section>
        <section><small>QUESTION OF THE DAY</small>{qotd ? <><p className="rr-q">{qotd.text}</p>{qotd.tip && <p className="rr-tip">Tip: {qotd.tip}</p>}</> : <p className="rr-tip">Loading...</p>}
          <Link to="/practice" className="rr-link">Practise it out loud <Icon name="arrow" size={14} /></Link></section>
        {last && <section><small>LAST SESSION</small><div className="rr-last"><b>{last.overall != null ? (Math.round(last.overall * 10) / 10).toFixed(1) : '-'}</b><span>{last.headline || 'Open your report'}</span></div><Link to={`/report/${last.id}`} className="rr-link">Open report <Icon name="arrow" size={14} /></Link></section>}
        <section><small>SHORTCUTS</small>
          <Link to="/practice" className="rr-btn"><Icon name="file" size={16} /> Job description interview</Link>
          <Link to="/practice" className="rr-btn"><Icon name="user" size={16} /> Resume-based questions</Link>
          <Link to="/dashboard" className="rr-btn"><Icon name="chart" size={16} /> See my weakest skill</Link>
          <Link to="/privacy" className="rr-btn"><Icon name="shield" size={16} /> What is stored</Link></section>
      </div>
    </aside>
  )
}

function MobileTabs({ path }) {
  const mode = useMode()
  const items = mode === 'interviewer' ? SIDE_HR : SIDE.filter((x) => !['/privacy','/install'].includes(x[0]))
  return (
    <nav className="mtabs" aria-label="Sections">
      {items.map(([to, label, ico]) => <Link key={to} to={to} className={path === to || (to !== '/' && path.startsWith(to)) ? 'on' : ''}><Icon name={ico} size={20} /><span>{label}</span></Link>)}
    </nav>
  )
}

const NAMES = { '/': 'SharpAI', '/install': 'Install SharpAI', '/practice': 'Practice', '/dashboard': 'Dashboard', '/history': 'History', '/privacy': 'Privacy', '/login': 'Sign in', '/interview': 'Interview', '/report': 'Report', '/recruiter': 'Interviewer' }
// Interview flows stay plain: no cinematic transition into, out of, or inside them.
const quiet = (p) => p.startsWith('/interview') || p.startsWith('/screen/') || /^\/recruiter\/[^/]+\/live\//.test(p) || /^\/battle\/.+/.test(p) || /^\/arena\/.+/.test(p)

// Last pointer position: the portal opens from where the user tapped.
const lastTap = { x: null, y: null, t: 0 }
if (typeof window !== 'undefined' && !window.__tapTrack) {
  window.__tapTrack = true
  window.addEventListener('pointerdown', (e) => { lastTap.x = e.clientX; lastTap.y = e.clientY; lastTap.t = Date.now() }, { passive: true, capture: true })
}
function Curtain({ path }) {
  const key = '/' + (path.split('/')[1] || '')
  const name = NAMES[key] || 'SharpAI'
  const [done, setDone] = useState(false)
  useEffect(() => { const t = setTimeout(() => setDone(true), 1500); return () => clearTimeout(t) }, [])
  const [o] = useState(() => (Date.now() - lastTap.t < 1500 && lastTap.x != null ? { x: lastTap.x + 'px', y: lastTap.y + 'px' } : { x: '50vw', y: '50vh' }))
  if (done) return null
  return (
    <div className="cv" aria-hidden="true" style={{ '--ox': o.x, '--oy': o.y }}>
      <i className="cv-cover" />
      <div className="cv-stage">
        <span className="cv-mark"><i className="cv-ring" /><b>S</b></span>
        <span className="cv-word">{[...name].map((ch, i) => <span key={i} className="cv-l" style={{ '--k': i }}><span>{ch === ' ' ? '\u00a0' : ch}</span></span>)}</span>
        <span className="cv-line"><i /></span>
      </div>
      <i className="cv-open" />
    </div>
  )
}

export default function App() {
  const loc = useLocation()
  const tr = useRef({ path: loc.pathname, cine: false })
  if (tr.current.path !== loc.pathname) tr.current = { path: loc.pathname, cine: !quiet(tr.current.path) && !quiet(loc.pathname) }
  const cine = tr.current.cine
  useEffect(() => { initFx() }, [])
  useEffect(() => { window.scrollTo(0, 0); const t = setTimeout(() => countUp(), 500); return () => clearTimeout(t) }, [loc.pathname])
  // scroll-reveal: tag blocks, fade them in as they enter the viewport (skipped for reduced motion)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const root = document.documentElement
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.08, rootMargin: '0px 0px -4% 0px' })
    const t = setTimeout(() => {
      const els = document.querySelectorAll('.page section > .wrap > *, .page .grid > *, .page .card, .page .step, .page .stat, .page .sess, .page .feature')
      els.forEach((el, i) => { if (el.closest('.interview-room')) return; el.classList.add('rv'); el.style.setProperty('--rv-d', `${(i % 6) * 60}ms`); io.observe(el) })
      root.classList.add('js-rv')
    }, 60)
    return () => { clearTimeout(t); io.disconnect() }
  }, [loc.pathname])
  const immersive = loc.pathname.startsWith('/interview') || loc.pathname === '/login' || loc.pathname.startsWith('/screen/') || loc.pathname.startsWith('/battle') || loc.pathname.startsWith('/arena')
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false"><defs><linearGradient id="aurora-ico" gradientUnits="userSpaceOnUse" x1="2" y1="22" x2="22" y2="2"><stop offset="0" stopColor="#a78bfa" /><stop offset=".55" stopColor="#22d3ee" /><stop offset="1" stopColor="#5eead4" /></linearGradient></defs></svg>
      <Aurora />
      {cine && <Curtain key={loc.pathname} path={loc.pathname} />}
      {!immersive && <Nav />}
      {!immersive && loc.pathname !== '/' && <SideRail path={loc.pathname} />}
      {!immersive && loc.pathname !== '/' && <RightRail />}
      {!immersive && loc.pathname !== "/install" && <MobileTabs path={loc.pathname} />}
      <div key={loc.pathname} className={`page ${cine ? 'page-cine' : ''}`}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/install" element={<Install />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/login" element={<Login />} />
          <Route path="/history" element={<History />} />
          <Route path="/recruiter" element={<Recruiter />} />
          <Route path="/recruiter/:id" element={<RoleDetail />} />
          <Route path="/recruiter/:id/c/:cid" element={<Scorecard />} />
          <Route path="/recruiter/:id/live/:cid" element={<Live />} />
          <Route path="/screen/:token" element={<Screen />} />
          <Route path="/arena" element={<ArenaHome />} />
          <Route path="/arena/:token" element={<ArenaRoom />} />
          <Route path="/arena-tournament" element={<ArenaHome tournament />} />
          <Route path="/arena-tournament/:token" element={<ArenaTournament />} />
          <Route path="/arena-share/:share" element={<ArenaShared />} />
          <Route path="/battle" element={<Battle />} />
          <Route path="/battle/:token" element={<Battle />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </div>
    </>
  )
}
