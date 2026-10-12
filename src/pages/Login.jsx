import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Logo, Icon } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { useAuth, loadGsi } from '../lib/auth.jsx'
import { useMode, setMode, homeFor } from '../lib/mode.js'

const getModeNow = () => { try { return localStorage.getItem('sharpai_mode') === 'interviewer' ? 'interviewer' : 'candidate' } catch { return 'candidate' } }
const SIDES = {
  candidate: { ico: 'user', name: 'Candidate', line: 'Practice interviews, get scored, share your SharpAI Score.', cta: 'Continue as candidate', pts: ['Voice interviews in English, Hinglish or Hindi', 'Stress mode and resume vs JD gap analysis', 'Shareable SharpAI Score badge'] },
  interviewer: { ico: 'building', name: 'Interviewer', line: 'Screen candidates with a link, score them on your pillars, shortlist the best.', cta: 'Continue as interviewer', pts: ['Paste a JD, get questions and a rubric', 'Async screening link, no scheduling', 'Ranked leaderboard with authenticity signals'] },
}
const POINTS = [
  ['replay', 'Your history follows you', 'Past reports and progress are saved to your account, on any device.'],
  ['video', 'Video stays on your device', 'Replays are recorded and stored in your browser. They are never uploaded.'],
  ['spark', 'No password to remember', 'Sign in with Google. We only read your name, email and photo.'],
]

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const { user, signIn, signOut } = useAuth()
  const [cfg, setCfg] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const btn = useRef(null)
  const mode = useMode()
  const dest = loc.state?.from || homeFor(mode)

  useEffect(() => { api.config().then(setCfg).catch(() => setCfg({})) }, [])

  useEffect(() => {
    if (!cfg?.googleClientId || user || !btn.current) return
    let dead = false
    loadGsi().then((google) => {
      if (dead) return
      google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: async (resp) => {
          setBusy(true); setErr('')
          try { await signIn(resp.credential); nav(loc.state?.from || homeFor(getModeNow()), { replace: true }) } catch (e) { setErr(e.message); setBusy(false) }
        },
        ux_mode: 'popup',
      })
      google.accounts.id.renderButton(btn.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 320, logo_alignment: 'left' })
    }).catch((e) => !dead && setErr(e.message))
    return () => { dead = true }
  }, [cfg, user, mode])

  return (
    <div className="login">
      <div className="login-side">
        <Logo />
        <div className="login-pitch">
          <h1>Practice like it counts.</h1>
          <p>Mock interviews that measure how you actually come across, and a record of how you improve.</p>
          <ul>
            {POINTS.map(([ico, t, d]) => (
              <li key={t}><span className="f-ico"><Icon name={ico} size={18} /></span><div><b>{t}</b><span>{d}</span></div></li>
            ))}
          </ul>
        </div>
        <small className="muted">Free to use. No card needed.</small>
      </div>
      <div className="login-main">
        <div className="login-card glass fade-up">
          <div className="mode-pick" role="radiogroup" aria-label="Sign in as">
            {Object.entries(SIDES).map(([k, v]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} className={`mode-opt ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>
                <span className="mo-ico"><Icon name={v.ico} size={22} /></span>
                <b>{v.name}</b>
                <small>{v.line}</small>
                <ul>{v.pts.map((p) => <li key={p}>{p}</li>)}</ul>
              </button>
            ))}
          </div>
          {user ? (
            <>
              <h2>You are signed in</h2>
              <p className="muted small">Mode: {SIDES[mode].name}. Switch above anytime.</p>
              <div className="who">
                {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span className="who-ph">{(user.name || user.email || '?')[0]}</span>}
                <div><b>{user.name || 'Signed in'}</b><span>{user.email}</span></div>
              </div>
              <button className="btn btn-primary btn-lg block" onClick={() => nav(dest, { replace: true })}>{SIDES[mode].cta} <Icon name="arrow" size={18} /></button>
              <button className="btn btn-ghost block" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <h2>{mode === 'interviewer' ? 'Sign in as interviewer' : 'Sign in as candidate'}</h2>
              <p className="muted">{mode === 'interviewer' ? 'Keep your roles, candidates and scorecards on your account.' : 'Save your reports and see your progress over time.'}</p>
              <div className="g-slot">
                {cfg == null && <span className="muted small">Loading...</span>}
                {cfg && cfg.googleClientId && <div ref={btn} className={busy ? 'is-busy' : ''} />}
                {cfg && !cfg.googleClientId && (
                  <div className="alert soft">Google sign-in is not switched on for this server yet. You can still practice as a guest, and your history stays in this browser.</div>
                )}
              </div>
              {err && <div className="alert">{err}</div>}
              <div className="or"><span>or</span></div>
              <Link to={dest} className="btn btn-ghost block">{SIDES[mode].cta} as guest</Link>
              <p className="muted small fine">As a guest, your history lives only in this browser. When you sign in later, this browser's past sessions are added to your account.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
