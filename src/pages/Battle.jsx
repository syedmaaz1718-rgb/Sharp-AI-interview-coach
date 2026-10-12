import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Icon, Logo, Spinner } from '../components/ui.jsx'
import { useDictate } from '../lib/dictate.js'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts.js'

const keyOf = (t) => { try { return localStorage.getItem('battle_key_' + t) || '' } catch { return '' } }
const saveKey = (t, k) => { try { localStorage.setItem('battle_key_' + t, k) } catch {} }
const nameOf = () => { try { return localStorage.getItem('battle_name') || '' } catch { return '' } }
const saveName = (n) => { try { localStorage.setItem('battle_name', n) } catch {} }

export default function Battle() {
  const { token } = useParams()
  return (
    <div className="screen-pg">
      <header className="studio-top"><Logo /><Link to="/practice" className="muted small">Back to practice</Link></header>
      <div className="screen-wrap">{token ? <Room token={token} /> : <Create />}</div>
    </div>
  )
}

function Create() {
  const nav = useNavigate()
  const [cfg, setCfg] = useState(null)
  const [name, setName] = useState(nameOf())
  const [pick, setPick] = useState('role:general')
  const [count, setCount] = useState(5)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { api.config().then(setCfg).catch((e) => setErr(e.message)) }, [])
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const [kind, id] = pick.split(':')
      saveName(name.trim())
      const r = await api.battleCreate({ name: name.trim(), count, ...(kind === 'pack' ? { pack: id } : { role: id }) })
      saveKey(r.token, r.key); nav('/battle/' + r.token)
    } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <form className="glass screen-card fade-up" onSubmit={go}>
      <span className="pill"><Icon name="bolt" size={14} /> Peer battle</span>
      <h1 className="display sm">Challenge a friend.</h1>
      <p className="muted lede">You both answer the same questions. SharpAI scores both with the same analysis and declares a winner with the reasons.</p>
      <label><span>Your name</span><input className="input" required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label><span>Interview</span>
        <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
          <optgroup label="Company style (simulated)">{(cfg?.packs || []).map((p) => <option key={p.id} value={'pack:' + p.id}>{p.name}</option>)}</optgroup>
          <optgroup label="Role">{(cfg?.roles || []).map((r) => <option key={r.id} value={'role:' + r.id}>{r.label}</option>)}</optgroup>
        </select>
      </label>
      <label><span>Questions</span>
        <div className="seg">{[3, 5, 7].map((n) => <button type="button" key={n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>{n}</button>)}</div>
      </label>
      {err && <div className="alert">{err}</div>}
      <button className="btn btn-primary btn-lg block" disabled={busy || name.trim().length < 2}>{busy ? 'Creating...' : 'Create battle link'} <Icon name="arrow" size={18} /></button>
    </form>
  )
}

function Room({ token }) {
  const [key, setKey] = useState(keyOf(token))
  const [st, setSt] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState(null)
  const [name, setName] = useState(nameOf())
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try { const s = await api.battle(token, key); setSt(s); setErr(''); if (s.me?.next) setQ(s.me.next); return s } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [token, key])
  // while waiting for the other player or the result, check every few seconds
  useEffect(() => {
    if (!st || (st.me?.status === 'playing')) return
    if (st.finished) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [st?.finished, st?.me?.status, st?.players?.length, key])

  const join = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { saveName(name.trim()); const r = await api.battleJoin(token, name.trim()); saveKey(token, r.key); setKey(r.key) } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  if (err && !st) return <div className="glass pad center-card"><h2>Battle not found</h2><p className="muted">This link is not valid, or the battle was removed. Check the link with your friend, or start a new one.</p><Link className="btn btn-primary" to="/battle">Start a battle</Link></div>
  if (!st) return <Spinner text="Loading battle..." />
  if (!st.me) {
    if (st.finished) return <Result token={token} keyv="" />
    if (!st.open) return <div className="glass pad center-card"><h2>This battle is full</h2><p className="muted">Two players are already in. Ask for a new link, or <Link to="/battle">start your own battle</Link>.</p></div>
    const host = st.players[0]
    return (
      <form className="glass screen-card fade-up" onSubmit={join}>
        <span className="pill"><Icon name="bolt" size={14} /> Peer battle</span>
        <h1 className="display sm">{host?.name} challenged you.</h1>
        <p className="muted lede">{st.label} interview, {st.total} questions, same for both of you. Answer one at a time by voice or text. SharpAI judges both of you at the end.</p>
        <label><span>Your name</span><input className="input" required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label>
        {err && <div className="alert">{err}</div>}
        <button className="btn btn-primary btn-lg block" disabled={busy || name.trim().length < 2}>{busy ? 'Joining...' : 'Accept the battle'} <Icon name="arrow" size={18} /></button>
      </form>
    )
  }
  if (st.me.status === 'done') return <Waiting token={token} keyv={key} st={st} />
  return <Play token={token} keyv={key} q={q} total={st.total} label={st.label} onDone={load} onNext={setQ} />
}

function Play({ token, keyv, q, total, label, onDone, onNext }) {
  const [text, setText] = useState('')
  const dict = useDictate({ lang: 'en-IN', onText: (f, i) => setText([f, i].filter(Boolean).join(' ')) })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [voiceOn, setVoiceOn] = useState(true)
  const mode = useRef('typed'); const t0 = useRef(performance.now())
  useEffect(() => () => { stopSpeaking() }, [])
  useEffect(() => {
    if (!q) return
    setText(''); mode.current = 'typed'; t0.current = performance.now()
    if (!voiceOn || !ttsSupported()) return
    let cancel = () => {}
    const t = setTimeout(async () => { cancel = await speak(q.text, { lang: 'en' }) }, 400)
    return () => { clearTimeout(t); cancel() }
  }, [q?.id])
  if (!q) return <Spinner text="Loading question..." />
  const dictate = () => { if (!dict.rec) { stopSpeaking(); mode.current = 'speech' } dict.toggle() }
  const submit = async () => {
    const spoken = dict.rec ? await dict.stop() : ''
    const tx = (spoken || text).trim()
    stopSpeaking(); setBusy(true); setErr('')
    try {
      const r = await api.battleAnswer(token, { key: keyv, questionId: q.id, transcript: tx, input: mode.current, durationSec: Math.max(1, Math.round((performance.now() - t0.current) / 1000)) })
      if (r.done) await onDone(); else onNext(r.next)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  return (
    <section className="glass screen-card ask fade-up" key={q.id}>
      <div className="screen-prog"><div className="bar"><i style={{ '--w': Math.round((q.index / total) * 100) + '%' }} /></div><small>{label} · Question {q.index + 1} of {total}</small></div>
      <div className="ask-who"><b>Battle</b>
        {ttsSupported() && <button className="icon-btn" aria-label={voiceOn ? 'Mute' : 'Unmute'} onClick={() => { setVoiceOn(!voiceOn); stopSpeaking() }}><Icon name={voiceOn ? 'volume' : 'volumeOff'} size={16} /></button>}
      </div>
      <h2 className="hq-text">{q.text}</h2>
      <textarea className="ta big" rows={7} value={text} disabled={busy} onChange={(e) => { setText(e.target.value); if (mode.current === 'speech' && !dict.rec) mode.current = 'typed' }} placeholder="Answer in your own words. Be specific." />
      {err && <div className="alert">{err}</div>}
      <div className="ask-actions">
        {dict.available && <button className={`btn btn-lg ${dict.rec ? 'btn-danger' : 'btn-ghost'}`} onClick={dictate} disabled={busy}><Icon name="mic" size={18} /> {dict.rec ? 'Stop' : dict.pending ? 'Transcribing...' : 'Answer by voice'}</button>}
        {dict.err && <div className="alert soft" role="alert">{dict.err}</div>}
        <button className="btn btn-primary btn-lg" onClick={submit} disabled={busy || dict.pending || text.trim().length < 5}>{busy ? 'Sending...' : q.index + 1 >= total ? 'Submit final answer' : 'Submit answer'} <Icon name="arrow" size={18} /></button>
      </div>
    </section>
  )
}

function Waiting({ token, keyv, st }) {
  const [r, setR] = useState(null)
  useEffect(() => {
    let dead = false
    const tick = async () => { try { const x = await api.battleResult(token, keyv); if (!dead && x.ready) setR(x) } catch {} }
    tick(); const t = setInterval(tick, 4000)
    return () => { dead = true; clearInterval(t) }
  }, [token, keyv])
  const link = `${location.origin}/battle/${token}`
  const [copied, setCopied] = useState(false)
  if (r) return <ResultView r={r} token={token} />
  const other = st.players.find((p) => p.slot !== st.me.slot)
  return (
    <section className="glass screen-card done fade-up">
      <span className="done-ico"><Icon name="check" size={34} stroke={2} /></span>
      <h1 className="display sm">Your answers are in.</h1>
      {!other ? (
        <>
          <p className="muted lede">Send this link to your friend. When they finish, the verdict appears here.</p>
          <div className="share-row"><input className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600) }}>{copied ? 'Copied' : 'Copy link'}</button></div>
          <a className="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent('I challenge you to a SharpAI interview battle: ' + link)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
        </>
      ) : <p className="muted lede">Waiting for {other.name} to finish ({other.answered} of {st.total} answered). This page updates by itself.</p>}
    </section>
  )
}

function Result({ token, keyv }) {
  const [r, setR] = useState(null)
  useEffect(() => { api.battleResult(token, keyv).then((x) => x.ready && setR(x)) }, [token])
  return r ? <ResultView r={r} token={token} /> : <Spinner text="Loading result..." />
}

function ResultView({ r, token }) {
  const share = `${location.origin}/b/${token}`
  const [copied, setCopied] = useState(false)
  const mineWon = r.you && r.winner === r.you
  return (
    <section className="glass screen-card result fade-up">
      <span className="pill"><Icon name="trophy" size={14} /> {r.label}</span>
      <h1 className="display sm">{r.winner === 'tie' ? 'Dead heat.' : r.you ? (mineWon ? 'You win.' : `${r.winnerName} wins.`) : `${r.winnerName} wins.`}</h1>
      <div className="vs">
        <div className={r.winner === 'a' ? 'win' : ''}><b>{r.scores.a}</b><span>{r.names.a}</span></div>
        <i>vs</i>
        <div className={r.winner === 'b' ? 'win' : ''}><b>{r.scores.b}</b><span>{r.names.b}</span></div>
      </div>
      <p className="muted lede">{r.reason}</p>
      <div className="rounds-list">
        {r.rounds.map((x, i) => (
          <div key={x.id} className={`rd ${x.winner}`}>
            <small>Q{i + 1}</small><p>{x.text}</p>
            <span>{r.names.a} {x.a}</span><span>{r.names.b} {x.b}</span>
            {x.why && <em>{x.winner === 'tie' ? '' : (x.winner === 'a' ? r.names.a : r.names.b) + ': ' + x.why}</em>}
          </div>
        ))}
      </div>
      <p className="muted small">{r.note}</p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(share); setCopied(true); setTimeout(() => setCopied(false), 1600) }}><Icon name="link" size={16} /> {copied ? 'Copied' : 'Copy result link'}</button>
        <a className="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent('SharpAI battle result: ' + share)}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <Link className="btn btn-ghost" to="/battle">New battle</Link>
      </div>
    </section>
  )
}
