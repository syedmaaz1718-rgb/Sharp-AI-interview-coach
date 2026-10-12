import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Icon, Logo, Spinner } from '../components/ui.jsx'
import { useDictate } from '../lib/dictate.js'
import { useLeaveGuard } from '../lib/leaveGuard.js'
import LeaveDialog from '../components/LeaveDialog.jsx'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts.js'
import { speechLang } from '../lib/prefs.js'

const LANGNAME = { en: 'English', hinglish: 'Hinglish', hindi: 'हिन्दी' }

export default function Screen() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [phase, setPhase] = useState('intro') // intro | ask | sending | done
  const [form, setForm] = useState({ name: '', email: '', college: '', consent: false })
  const [sess, setSess] = useState(null)
  const [q, setQ] = useState(null)
  const [text, setText] = useState('')
  const dict = useDictate({ lang: speechLang(info?.lang), onText: (f, i) => setText([f, i].filter(Boolean).join(' ')) })
  const rec = dict.rec
  const answered = useRef(0)
  const [leaveAsk, setLeaveAsk] = useState(false)
  const [left, setLeft] = useState(false)
  const started = phase === 'ask' || phase === 'sending'
  const leaveRef = useRef(() => {})
  const guard = useLeaveGuard({ active: started, onBack: () => leaveRef.current(), beacon: sess && answered.current ? { url: `/api/screen/${token}/finish`, body: { candidateId: sess.candidateId, key: sess.key } } : null })
  leaveRef.current = async () => {
    if (!started) return
    setLeaveAsk(false); stopSpeaking(); if (dict.rec) dict.stop()
    guard.release()
    if (answered.current) { try { await api.screenFinish(token, { candidateId: sess.candidateId, key: sess.key }) } catch {} }
    else setLeft(true)
    setPhase('done')
  }
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const t0 = useRef(0)
  const meta = useRef({ pasted: false, typedMs: 0, keys: 0, firstKey: 0 })
  const recStart = useRef(0)
  const inputMode = useRef('typed')

  useEffect(() => { api.screenInfo(token).then(setInfo).catch((e) => setErr(e.message)) }, [token])
  useEffect(() => () => { stopSpeaking() }, [])

  useEffect(() => {
    if (phase !== 'ask' || !q) return
    meta.current = { pasted: false, typedMs: 0, keys: 0, firstKey: 0 }
    inputMode.current = 'typed'; setText(''); t0.current = performance.now()
    if (!voiceOn || !ttsSupported()) return
    let cancel = () => {}; let dead = false
    const t = setTimeout(async () => { cancel = await speak(q.text, { lang: info?.lang || 'en', onStart: () => !dead && setAsking(true), onEnd: () => !dead && setAsking(false) }) }, 400)
    return () => { dead = true; clearTimeout(t); cancel(); setAsking(false) }
  }, [phase, q?.id])

  const start = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const r = await api.screenStart(token, form); setSess(r); setQ(r.question); setPhase('ask') } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  const dictate = () => {
    if (!rec) { stopSpeaking(); setAsking(false); recStart.current = performance.now(); inputMode.current = 'speech' }
    dict.toggle()
  }
  const submit = async () => {
    const spoken = rec ? await dict.stop() : ''
    stopSpeaking()
    const transcript = (inputMode.current === 'speech' ? spoken || text : text).trim()
    if (transcript.length < 2) return
    setBusy(true); setErr('')
    const m = meta.current
    try {
      const r = await api.screenAnswer(token, {
        candidateId: sess.candidateId, key: sess.key, questionId: q.id, transcript, input: inputMode.current,
        durationSec: Math.max(1, Math.round((performance.now() - (inputMode.current === 'speech' ? recStart.current : t0.current)) / 1000)),
        meta: { pasted: m.pasted, keys: m.keys, typedMs: m.firstKey ? Math.round(performance.now() - m.firstKey) : 0 },
      })
      answered.current += 1
      if (r.done) { guard.release(); await api.screenFinish(token, { candidateId: sess.candidateId, key: sess.key }); setPhase('done') } else setQ(r.question)
    } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  const onKey = () => { const m = meta.current; if (!m.firstKey) m.firstKey = performance.now(); m.keys++ }

  const progress = q ? (q.index + (q.followUp ? 0.5 : 0)) / q.total : 0
  return (
    <div className="screen-pg">
      <LeaveDialog open={leaveAsk} answered={answered.current} onStay={() => setLeaveAsk(false)} onLeave={() => leaveRef.current()} />
      <header className="studio-top"><Logo /><span className="muted small">{info ? `${info.title}${info.company ? ' · ' + info.company : ''}` : ''}</span>{started && <button className="btn btn-sm btn-ghost" onClick={() => setLeaveAsk(true)}>Exit</button>}</header>
      <div className="screen-wrap">
        {!info && !err && <Spinner text="Loading..." />}
        {err && !info && <div className="glass pad center-card"><h2>Link not valid</h2><p className="muted">This screening link is not valid or has been closed. Ask the interviewer for a fresh link.</p></div>}
        {info && phase === 'intro' && (
          <form className="glass screen-card fade-up" onSubmit={start}>
            <span className="pill"><i className="dot" /> AI interview</span>
            <h1 className="display sm">{info.title}</h1>
            <p className="muted lede">{info.company ? `${info.company} invited you to a short interview.` : 'You were invited to a short interview.'} {info.questionCount} questions, one at a time, about {info.questionCount * 2 + 2} to {info.questionCount * 3 + 3} minutes. Language: {LANGNAME[info.lang]}.</p>
            {!info.open ? <div className="alert soft">This interview is closed. Ask the recruiter for a new link.</div> : (
              <>
                <label><span>Your name</span><input className="input" required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label><span>Email (optional)</span><input className="input" type="email" maxLength={120} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label><span>College (optional)</span><input className="input" maxLength={80} value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} /></label>
                <ul className="screen-notes">
                  <li><Icon name="mic" size={15} /> Answer by voice (Chrome or Edge) or type. Speak naturally.</li>
                  <li><Icon name="shield" size={15} /> The recruiter sees your answers and scores. Camera is not used. No video or audio is stored.</li>
                  <li><Icon name="bulb" size={15} /> Write in your own words. Answers are checked for how natural they read, and pasted text is noted.</li>
                </ul>
                <label className="check consent"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /> I agree that my answers are shared with the recruiter who sent this link.</label>
                {err && <div className="alert">{err}</div>}
                <button className="btn btn-primary btn-lg block" disabled={busy || !form.consent || form.name.trim().length < 2}>{busy ? 'Starting...' : 'Start interview'} <Icon name="arrow" size={18} /></button>
              </>
            )}
          </form>
        )}
        {phase === 'ask' && q && (
          <section className="glass screen-card ask fade-up" key={q.id}>
            <div className="screen-prog"><div className="bar"><i style={{ '--w': Math.round(progress * 100) + '%' }} /></div><small>{q.followUp ? 'Follow-up' : `Question ${q.index + 1} of ${q.total}`}</small></div>
            <div className="ask-who"><div className={`orb-ai ${asking ? 'talking' : ''} ${rec ? 'listening' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /></div><b>{q.followUp ? 'Follow-up' : 'Interviewer'}</b>
              {ttsSupported() && <button className="icon-btn" aria-label={voiceOn ? 'Mute interviewer' : 'Unmute interviewer'} onClick={() => { setVoiceOn(!voiceOn); stopSpeaking() }}><Icon name={voiceOn ? 'volume' : 'volumeOff'} size={16} /></button>}</div>
            <h2 className="hq-text">{q.text}</h2>
            <textarea className="ta big" rows={7} value={text} disabled={busy} onChange={(e) => { setText(e.target.value); if (inputMode.current === 'speech' && !rec) inputMode.current = 'typed' }} onKeyDown={onKey} onPaste={() => { meta.current.pasted = true }} placeholder={rec ? 'Listening... speak now' : 'Type your answer, or press the mic and speak'} />
            {err && <div className="alert">{err}</div>}
            <div className="ask-actions">
              {dict.available && <button className={`btn btn-lg ${rec ? 'btn-danger' : 'btn-ghost'}`} onClick={dictate} disabled={busy}><Icon name="mic" size={18} /> {rec ? 'Stop' : dict.pending ? 'Transcribing...' : 'Answer by voice'}</button>}
              {dict.err && <div className="alert soft" role="alert">{dict.err}</div>}
              <button className="btn btn-primary btn-lg" onClick={submit} disabled={busy || dict.pending || text.trim().length < 2}>{busy ? 'Sending...' : 'Submit answer'} <Icon name="arrow" size={18} /></button>
            </div>
          </section>
        )}
        {phase === 'done' && (
          <section className="glass screen-card done fade-up"><span className="done-ico"><Icon name="check" size={34} stroke={2} /></span><h1 className="display sm">{left ? 'Interview ended.' : `Thank you, ${form.name.split(' ')[0]}.`}</h1><p className="muted lede">{left ? 'You left before answering any question, so nothing was submitted. Ask the interviewer for a new link if you need another try.' : 'Your interview was submitted. The recruiter will review it. You can close this tab.'}</p></section>
        )}
      </div>
    </div>
  )
}
