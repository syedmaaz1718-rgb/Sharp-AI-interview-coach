import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useMode, setMode, homeFor } from '../lib/mode.js'
import { useCountUp, useMounted } from '../lib/hooks.js'
import { useAuth } from '../lib/auth.jsx'

export const tone = (s) => (s == null ? 'na' : s >= 7.5 ? 'great' : s >= 5.5 ? 'ok' : 'low')
const toneColor = { great: '#5eead4', ok: '#fbbf24', low: '#fb7185', na: '#475069' }
export const fmt = (s) => (s == null ? '-' : (Math.round(s * 10) / 10).toFixed(1))

export function Hello({ className = '' }) {
  const { user } = useAuth()
  const name = (user?.name || '').trim() || (user?.email || '').split('@')[0]
  if (!user || !name) return null
  return <p className={`hello ${className}`}>Hello! <b>{name}</b></p>
}

function AccountChip() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return <Link to="/login" className="nav-link">Sign in</Link>
  return (
    <div className="acct">
      <button className="acct-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account">
        {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span className="who-ph">{(user.name || user.email || '?')[0]}</span>}
      </button>
      {open && (
        <div className="acct-menu" role="menu" onMouseLeave={() => setOpen(false)}>
          <div className="acct-id"><b>{user.name}</b><span>{user.email}</span></div>
          <button role="menuitem" onClick={() => { setOpen(false); signOut() }}>Sign out</button>
        </div>
      )}
    </div>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="SharpAI home">
      <svg className="logo-svg" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <defs>
          <linearGradient id="lg1" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#c4b5fd" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
          <linearGradient id="lg2" x1="8" y1="36" x2="34" y2="10" gradientUnits="userSpaceOnUse"><stop stopColor="#2dd4bf" /><stop offset="1" stopColor="#67e8f9" /></linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="11" fill="#0d0f1a" stroke="rgba(196,181,253,.35)" />
        <path className="lm-a" d="M29 12.5H17.5a4.5 4.5 0 0 0 0 9H22" fill="none" stroke="url(#lg1)" strokeWidth="4.2" strokeLinecap="round" />
        <path className="lm-b" d="M11 27.5H22.5a4.5 4.5 0 0 0 0-9H18" fill="none" stroke="url(#lg2)" strokeWidth="4.2" strokeLinecap="round" />
        <circle className="lm-dot" cx="31" cy="29" r="2.3" fill="#fff" />
      </svg>
      <span className="logo-word">Sharp<b>AI</b></span>
    </Link>
  )
}

export function Nav() {
  const mode = useMode()
  const nav = useNavigate()
  const hr = mode === 'interviewer'
  const pick = (m) => { setMode(m); nav(homeFor(m)) }
  return (
    <header className="nav">
      <div className="nav-in">
        <Logo />
        <nav>
          <div className="mode-switch" role="radiogroup" aria-label="Mode">
            <button role="radio" aria-checked={!hr} className={!hr ? 'on' : ''} onClick={() => pick('candidate')}>Candidate</button>
            <button role="radio" aria-checked={hr} className={hr ? 'on' : ''} onClick={() => pick('interviewer')}>Interviewer</button>
          </div>
          {hr ? <NavLink to="/recruiter">Roles</NavLink> : (<><NavLink to="/practice">Practice</NavLink><NavLink to="/battle">Battle</NavLink><NavLink to="/dashboard">Dashboard</NavLink><NavLink to="/history">History</NavLink></>)}
          <Link to="/install" className="nav-link">Install app</Link>
          <AccountChip />
          {hr ? <Link to="/recruiter" className="btn btn-sm btn-primary">New role</Link> : <Link to="/practice" className="btn btn-sm btn-primary">Start interview</Link>}
        </nav>
      </div>
    </header>
  )
}

export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="orb o1" /><span className="orb o2" /><span className="orb o3" />
      <span className="grid-fade" />
    </div>
  )
}

export function Ring({ value, size = 160, stroke = 12, label, sub, delay = 0, big = false }) {
  const v = useCountUp(value, 1200, delay)
  const mounted = useMounted(60 + delay)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const t = tone(value)
  const id = 'g' + Math.round(size) + (label || '').replace(/\W/g, '') + delay
  return (
    <div className={`ring ${big ? 'ring-big' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={toneColor[t]} />
            <stop offset="100%" stopColor={t === 'low' ? '#f97316' : t === 'ok' ? '#f59e0b' : '#a78bfa'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={mounted && value != null ? c * (1 - value / 10) : c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: `stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1) ${delay}ms`, filter: `drop-shadow(0 0 8px ${toneColor[t]}66)` }}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-num">{value == null ? '-' : v.toFixed(1)}</div>
        {label && <div className="ring-label">{label}</div>}
        {sub && <div className="ring-sub">{sub}</div>}
      </div>
    </div>
  )
}

// Live metric icon. kind: blink (eye), ping (voice), flicker (energy), breathe (default). Animates transform/opacity only.
export function MetricIcon({ name, kind = 'breathe', on = true, size = 17, delay = 0 }) {
  return (
    <span className={`mico mico-${kind} ${on ? 'on' : 'off'}`} style={{ animationDelay: `${delay}ms`, '--d': `${delay}ms` }}>
      <Icon name={name} size={size} stroke={1.7} living={false} />
    </span>
  )
}

export function MetricBar({ label, value, hint, delay = 0, icon, kind }) {
  const mounted = useMounted(80 + delay)
  const t = tone(value)
  return (
    <div className={`mbar ${value == null ? 'is-na' : ''}`}>
      <div className="mbar-top">
        <span className="mbar-label">{icon && <MetricIcon name={icon} kind={kind} on={value != null} delay={delay} />}{label}</span>
        <b className={`t-${t}`}>{value == null ? 'not measured' : `${fmt(value)}/10`}</b>
      </div>
      <div className="mbar-track">
        <div className={`mbar-fill f-${t}`} style={{ width: mounted && value != null ? `${value * 10}%` : '0%', transitionDelay: `${delay}ms` }} />
      </div>
      {hint && <div className="mbar-hint">{hint}</div>}
    </div>
  )
}

// axes: [{label, value}] values 0-10 (null drawn as 0, dimmed label)
export function Radar({ axes, size = 300 }) {
  const mounted = useMounted(120)
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 52
  const n = axes.length
  const pt = (i, f) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]
  }
  const poly = (f) => axes.map((_, i) => pt(i, f).join(',')).join(' ')
  const data = axes.map((a, i) => pt(i, mounted ? (a.value ?? 0) / 10 : 0).join(',')).join(' ')
  return (
    <svg className="radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Skill radar chart">
      <defs>
        <linearGradient id="radfill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity=".55" /><stop offset="100%" stopColor="#22d3ee" stopOpacity=".35" /></linearGradient>
        <clipPath id="radclip"><polygon points={poly(1)} /></clipPath>
        <linearGradient id="radsweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0" /><stop offset="100%" stopColor="#22d3ee" stopOpacity=".34" /></linearGradient>
        <filter id="radblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(f)} className="radar-ring" />)}
      {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" /> })}
      <polygon points={data} className="radar-glow" filter="url(#radblur)" fill="#8b5cf6" style={{ transition: 'all 1.2s cubic-bezier(.2,.8,.2,1)' }} />
      <g clipPath="url(#radclip)" className="radar-sweep-clip">
        <g className="radar-sweep" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path d={`M${cx},${cy} L${cx + R},${cy} A${R},${R} 0 0 0 ${cx + R * Math.cos(-Math.PI / 4)},${cy + R * Math.sin(-Math.PI / 4)} Z`} fill="url(#radsweep)" />
          <path d={`M${cx},${cy} L${cx + R},${cy} A${R},${R} 0 0 0 ${cx + R * Math.cos(-Math.PI / 12)},${cy + R * Math.sin(-Math.PI / 12)} Z`} fill="url(#radsweep)" />
          <line x1={cx} y1={cy} x2={cx + R} y2={cy} className="radar-sweep-line" />
        </g>
      </g>
      <polygon points={data} className="radar-data" fill="url(#radfill)" style={{ transition: 'all 1.2s cubic-bezier(.2,.8,.2,1)' }} />
      <circle cx={cx} cy={cy} r={R} className="radar-ping" />
      <circle cx={cx} cy={cy} r={R} className="radar-ping p2" />
      {axes.map((a, i) => {
        if (a.value == null) return null
        const [x, y] = pt(i, mounted ? a.value / 10 : 0)
        const ang = (((360 * i) / n - 90) % 360 + 360) % 360
        return <circle key={'h' + i} cx={x} cy={y} r="5" className="radar-halo" style={{ animationDelay: `${(1.4 + (ang / 360) * 6).toFixed(2)}s`, transition: 'all 1.2s cubic-bezier(.2,.8,.2,1)' }} />
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, mounted ? (a.value ?? 0) / 10 : 0)
        return <circle key={i} cx={x} cy={y} r="4" className="radar-dot" style={{ transition: 'all 1.2s cubic-bezier(.2,.8,.2,1)' }} opacity={a.value == null ? 0.2 : 1} />
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.2)
        const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle'
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className={`radar-label ${a.value == null ? 'dim' : ''}`}>
            {a.label}
            <tspan x={x} dy="14" className="radar-val">{fmt(a.value)}</tspan>
          </text>
        )
      })}
    </svg>
  )
}

export function Sparkline({ values, height = 90 }) {
  const mounted = useMounted(100)
  if (!values.length) return null
  const w = 520
  const pad = 14
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  const pts = values.map((v, i) => [pad + i * step, height - pad - (v / 10) * (height - pad * 2)])
  const line = pts.map((p) => p.join(',')).join(' ')
  const area = `${pad},${height - pad} ${line} ${pts[pts.length - 1][0]},${height - pad}`
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Score trend">
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity=".4" /><stop offset="100%" stopColor="#a78bfa" stopOpacity="0" /></linearGradient>
      </defs>
      <polygon points={area} fill="url(#spk)" opacity={mounted ? 1 : 0} style={{ transition: 'opacity 1s' }} />
      <polyline points={line} fill="none" stroke="#c4b5fd" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray="1200" strokeDashoffset={mounted ? 0 : 1200} style={{ transition: 'stroke-dashoffset 1.4s ease' }} />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#0b0d14" stroke="#ddd6fe" strokeWidth="2" />)}
    </svg>
  )
}

// Live audio waveform: mirrored bars from the analyser.
export function Waveform({ meter, active, speaking }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let phase = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const n = 56
      const bars = meter && active ? meter.bars(n) : null
      const gap = 3
      if (w < n * 4) return
      const bw = (w - gap * (n - 1)) / n
      phase += 0.04
      const g = ctx.createLinearGradient(0, 0, w, 0)
      g.addColorStop(0, '#a78bfa'); g.addColorStop(0.5, '#22d3ee'); g.addColorStop(1, '#5eead4')
      ctx.fillStyle = g
      for (let i = 0; i < n; i++) {
        const idle = 0.04 + 0.025 * (Math.sin(phase + i * 0.5) + 1)
        const edge = Math.sin((i / (n - 1)) * Math.PI)
        const level = bars ? Math.min(1, bars[i] * 1.6) * (0.35 + 0.65 * edge) : idle
        const bh = Math.max(3, level * h)
        const x = i * (bw + gap)
        const r = Math.max(0, Math.min(bw / 2, 3))
        ctx.globalAlpha = bars ? 0.9 : 0.35
        ctx.beginPath()
        ctx.roundRect ? ctx.roundRect(x, (h - bh) / 2, bw, bh, r) : ctx.rect(x, (h - bh) / 2, bw, bh)
        ctx.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [meter, active])
  return <canvas ref={ref} className={`wave ${speaking ? 'is-speaking' : ''}`} />
}

export function Chip({ icon, label, value, state }) {
  return (
    <div className={`chip s-${state || 'idle'}`}>
      <span className="chip-ico">{icon}</span>
      <span className="chip-txt"><small>{label}</small><b>{value}</b></span>
    </div>
  )
}

export function Spinner({ text }) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner" />
      {text && <p>{text}</p>}
    </div>
  )
}

const ICONS = {
  smile: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01',
  gauge: 'M3.5 17a9 9 0 1117 0M12 14l4-4.5M12 14h.01',
  pause: 'M9 5v14M15 5v14',
  head: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 21a7 7 0 0114 0',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  data: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  layout: 'M3 5h18v14H3zM3 10h18M9 10v9',
  volume: 'M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12',
  volumeOff: 'M4 9v6h4l5 4V5L8 9H4zM17 9l5 6m0-6l-5 6',
  bell: 'M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 004 0',
  play: 'M7 4.5v15l12-7.5-12-7.5z',
  file: 'M6 3h8l5 5v13H6V3zM14 3v5h5M9 13h7M9 17h7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14m-6-6l6 6-6 6',
  replay: 'M4 12a8 8 0 108-8H7m0 0l3-3M7 4l3 3',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z',
  video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3',
  building: 'M5 21V4h9v17M14 9h5v12M9 8h1m-1 4h1m-1 4h1M5 21h14',
  chat: 'M4 5h16v11H9l-5 4V5z',
  bug: 'M9 9h6v8a3 3 0 01-6 0V9zM9 6a3 3 0 016 0v3H9V6zM4 11h5M15 11h5M4 17h5M15 17h5M5 6l3 2M19 6l-3 2',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zM9 12l2 2 4-4',
  pen: 'M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3',
  compass: 'M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5 5-2z',
  megaphone: 'M4 10v4h3l7 4V6L7 10H4zM17 9a4 4 0 010 6',
  phone: 'M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2',
  cloud: 'M7 18a4 4 0 01-.5-8A5.5 5.5 0 0117 8.5 4.8 4.8 0 0117 18H7z',
  server: 'M4 5h16v5H4V5zM4 14h16v5H4v-5zM8 7.5h.01M8 16.5h.01',
  fullstack: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  trophy: 'M7 4h10v4a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 13v4m-4 4h8M10 17h4',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20a7 7 0 0114 0M16 4.5a3.5 3.5 0 010 6.5M18 14a6 6 0 013 5.5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  share: 'M8 12l8-5M8 12l8 5M6 15a3 3 0 100-6 3 3 0 000 6zM18 9a3 3 0 100-6 3 3 0 000 6zM18 21a3 3 0 100-6 3 3 0 000 6z',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 17a5 5 0 100-10 5 5 0 000 10zM12 13a1 1 0 100-2 1 1 0 000 2z',
  scale: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0L5 7zM19 7l-3 7a3 3 0 006 0l-3-7z',
  trash: 'M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11v6m4-6v6',
}
// One living-icon system for every page. The glyph keeps its footprint and stays upright.
export function Icon({ name, size = 18, className = '', stroke = 1.5, living = true, active = true }) {
  const still = !active || name === 'volumeOff'
  const kind = name === 'eye' ? 'blink' : ['compass', 'replay', 'gauge'].includes(name) ? 'turn' : ['mic', 'volume', 'chat', 'bell', 'bolt'].includes(name) ? 'ping' : 'breathe'
  const offset = [...(name || '')].reduce((n, c) => n + c.charCodeAt(0), 0) % 17
  return (
    <svg className={`icon ${living ? `living-icon li-${kind}` : ''} ${still ? 'li-still' : ''} ${className}`} style={{ '--li-delay': `${-offset * .43}s` }} data-icon={name} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {living && !still && <g className="li-aura" strokeWidth=".8"><circle className="li-orbit" cx="12" cy="12" r="11" strokeDasharray="8 61" /><circle className="li-ping" cx="12" cy="12" r="10.5" /></g>}
      <path className="li-glyph" d={ICONS[name] || ICONS.spark} />
    </svg>
  )
}

export const ROLE_LABEL = { general: 'General / HR', sde: 'Software Engineer', data: 'Data / ML', frontend: 'Frontend / Web', backend: 'Backend', fullstack: 'Full Stack', android: 'Mobile (Android)', devops: 'DevOps / Cloud', qa: 'QA / Testing', security: 'Cybersecurity', design: 'UI/UX Designer', product: 'Product Manager', analyst: 'Business / Data Analyst', marketing: 'Marketing / Business' }
export const PACK_NAMES = { amazon: 'Amazon style', flipkart: 'Flipkart style', google: 'Google style', microsoft: 'Microsoft style', startup: 'Startup style' }
export const roleLabel = (r) => (r && r.startsWith('pack:') ? PACK_NAMES[r.slice(5)] || 'Company style' : ROLE_LABEL[r] || r)
