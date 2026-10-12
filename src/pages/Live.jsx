import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Icon, Spinner } from '../components/ui.jsx'
import { useDictate } from '../lib/dictate.js'
import LiveRoom from '../components/LiveRoom.jsx'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts.js'
import { speechLang } from '../lib/prefs.js'
import { AuthChip } from './RoleDetail.jsx'
import { setMode } from '../lib/mode.js'

const LABEL = { 1: 'Poor', 2: 'Weak', 3: 'Solid', 4: 'Strong', 5: 'Excellent' }
const VERDICT = { thin: ['Thin answer', 'low'], partial: ['Partly covered', 'mid'], ok: ['Reasonable', 'mid'], strong: ['Strong answer', 'good'] }
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)

export default function Live() {
  const { id, cid } = useParams()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [i, setI] = useState(0)
  const [ans, setAns] = useState({}) // qid -> { transcript, score, note, asked: [] }
  const [cp, setCp] = useState(null)
  const [thinking, setThinking] = useState(false)
  const baseRef = useRef(''); const qidRef = useRef(null)
  const dict = useDictate({ lang: speechLang(d?.role.lang), onText: (f, int) => qidRef.current && patch(qidRef.current, { transcript: baseRef.current + [f, int].filter(Boolean).join(' ') }) })
  const rec = dict.rec
  const [sugg, setSugg] = useState(null)
  const [saved, setSaved] = useState('')
  const t0 = useRef(0)
  const seq = useRef(0)
  const saveT = useRef(null)

  useEffect(() => { setMode('interviewer') }, [])
  useEffect(() => {
    api.hrCandidate(cid).then((x) => {
      setD(x)
      const a = {}
      for (const [qid, r] of Object.entries(x.candidate.ratings || {})) a[qid] = { transcript: r.transcript || '', score: r.auto ? undefined : r.score, note: r.note || '', asked: [] }
      setAns(a)
    }).catch((e) => setErr(e.message))
    return () => stopSpeaking()
  }, [cid])

  const q = d?.role.questions[i]
  const cur = (q && ans[q.id]) || { transcript: '', score: undefined, note: '', asked: [] }
  const answeredIds = d ? d.role.questions.filter((x) => words(ans[x.id]?.transcript || '') >= 15).map((x) => x.id) : []

  // persist ratings and transcripts as the interview goes
  const persist = useCallback((next) => {
    clearTimeout(saveT.current); setSaved('Saving...')
    saveT.current = setTimeout(async () => {
      const ratings = {}
      for (const [qid, a] of Object.entries(next)) {
        const e = {}
        if (a.transcript) e.transcript = a.transcript
        if (a.score) e.score = a.score
        const note = [a.note, ...(a.asked || []).map((t) => 'Follow-up asked: ' + t)].filter(Boolean).join('\n')
        if (note) e.note = note
        if (Object.keys(e).length) ratings[qid] = e
      }
      try { await api.hrUpdateCandidate(cid, { ratings }); setSaved('Saved'); setTimeout(() => setSaved(''), 1200) } catch { setSaved('Not saved') }
    }, 700)
  }, [cid])
  const patch = (qid, p) => setAns((a) => { const next = { ...a, [qid]: { ...(a[qid] || { transcript: '', asked: [] }), ...p } }; persist(next); return next })

  // the copilot listens: analyse the answer a moment after the text stops changing
  useEffect(() => {
    if (!q) return
    const text = cur.transcript
    if (words(text) < 10) { setCp(null); setSugg(null); return }
    const my = ++seq.current
    setThinking(true)
    const t = setTimeout(async () => {
      try {
        const [c, s] = await Promise.all([
          api.hrCopilot(id, { questionId: q.id, transcript: text, answeredIds, input: rec ? 'speech' : 'typed', durationSec: t0.current ? Math.round((performance.now() - t0.current) / 1000) : undefined }),
          api.hrSuggest(id, { questionId: q.id, transcript: text }).catch(() => null),
        ])
        if (my === seq.current) { setCp(c); setSugg(s); setErr('') }
      } catch (e) { if (my === seq.current) setErr(e.message) }
      if (my === seq.current) setThinking(false)
    }, 1600)
    return () => clearTimeout(t)
  }, [q?.id, cur.transcript])
  useEffect(() => { setCp(null); setSugg(null); if (dict.rec) dict.stop(); stopSpeaking() }, [i])

  const dictate = () => {
    if (!rec) { baseRef.current = cur.transcript ? cur.transcript.trim() + ' ' : ''; qidRef.current = q.id; t0.current = performance.now(); stopSpeaking() }
    dict.toggle()
  }
  const say = (text) => { stopSpeaking(); speak(text, { lang: d?.role.lang === 'hindi' ? 'hindi' : 'en' }) }
  const ask = (text) => { if (!(cur.asked || []).includes(text)) patch(q.id, { asked: [...(cur.asked || []), text] }) }

  if (err && !d) return <main className="narrow center"><div className="glass pad"><h2>Live interview not found</h2><p className="muted">The role or candidate may have been deleted, or the link is wrong.</p><Link className="btn btn-primary" to={`/recruiter/${id}`}>Back to role</Link></div></main>
  if (!d) return <main className="narrow"><Spinner text="Starting live interview..." /></main>
  const { role, candidate } = d
  const done = role.questions.filter((x) => ans[x.id]?.score).length
  const verdict = cp ? VERDICT[cp.verdict] : null
  const comp = role.rubric.find((c) => c.id === q.competency)
  const finish = async () => { clearTimeout(saveT.current); if (dict.rec) await dict.stop(); stopSpeaking(); await persistNow(); nav(`/recruiter/${role.id}/c/${candidate.id}`) }
  const persistNow = async () => {
    const ratings = {}
    for (const [qid, a] of Object.entries(ans)) { const e = {}; if (a.transcript) e.transcript = a.transcript; if (a.score) e.score = a.score; const note = [a.note, ...(a.asked || []).map((t) => 'Follow-up asked: ' + t)].filter(Boolean).join('\n'); if (note) e.note = note; if (Object.keys(e).length) ratings[qid] = e }
    try { await api.hrUpdateCandidate(cid, { ratings }) } catch {}
  }
  return (
    <main className="page-wide live">
      <header className="pg-head rd-head">
        <Link to={`/recruiter/${role.id}`} className="back"><Icon name="arrow" size={14} className="flip" /> {role.title}</Link>
        <span className="idx"><i className="live-dot" /> LIVE INTERVIEW</span>
        <h1 className="display sm">{candidate.name}</h1>
      </header>
      <div className="lv-steps" role="tablist">
        {role.questions.map((x, k) => <button key={x.id} role="tab" aria-selected={k === i} className={`lv-step ${k === i ? 'on' : ''} ${ans[x.id]?.score ? 'done' : words(ans[x.id]?.transcript || '') ? 'part' : ''}`} onClick={() => setI(k)}>{ans[x.id]?.score ? <Icon name="check" size={13} stroke={2.4} /> : k + 1}</button>)}
      </div>
      <div className="lv-grid">
        <section className="glass lv-main fade-up" key={q.id}>
          <div className="sc-qh"><span className="sc-n">{i + 1}</span><div><p className="sc-text">{q.text}</p><span className="tag">{comp?.name}</span></div>{ttsSupported() && <button className="icon-btn say" aria-label="Read the question aloud" title="Read the question aloud" onClick={() => say(q.text)}><Icon name="volume" size={16} /></button>}</div>
          <LiveRoom name={candidate.name} />
          {(cur.asked || []).length > 0 && <div className="lv-asked"><small>FOLLOW-UPS YOU ASKED</small>{cur.asked.map((t) => <p key={t}>{t}</p>)}</div>}
          <div className="lv-cap">
            <div className="lv-cap-h"><small>WHAT THE CANDIDATE SAID</small><span className={`lv-rec ${rec ? 'on' : ''}`}>{rec ? <>{dict.pending ? 'Transcribing' : 'Listening'} <span className="wave" aria-hidden="true"><i /><i /><i /><i /></span></> : dict.available ? 'Paused' : 'Typed mode'}</span></div>
            {!dict.available && !dict.loading && <div className="typed-note"><span className="tn-ico"><Icon name="file" size={18} /></span><div><b>Typed capture</b><p>Voice capture is not available in this browser right now. Type or paste what the candidate says and the copilot reads it the same way. Chrome and Edge support voice capture directly.</p></div></div>}
            {dict.err && <div className="alert soft" role="alert">{dict.err}</div>}
            <textarea className="ta big" rows={8} value={cur.transcript} onChange={(e) => patch(q.id, { transcript: e.target.value })} placeholder={dict.available ? 'Press Listen and let the candidate answer, or type notes of what they say. The copilot reads it as it comes in.' : 'Type or paste what the candidate says. The copilot reads it as it comes in.'} />
            <div className="lv-cap-b">
              {dict.available && <button className={`btn ${rec ? 'btn-danger' : 'btn-primary'}`} onClick={dictate}><Icon name="mic" size={16} /> {rec ? 'Stop listening' : 'Listen'}</button>}
              <span className="muted small">{words(cur.transcript)} words</span>
              {cp?.authenticity && <AuthChip a={cp.authenticity} />}
            </div>
          </div>
          <div className="rate" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={cur.score === n} className={`rate-btn ${cur.score === n ? 'on' : ''}`} onClick={() => patch(q.id, { score: cur.score === n ? undefined : n })}><b>{n}</b><small>{LABEL[n]}</small></button>)}
          </div>
          {sugg && !cur.score && <div className="sc-sug"><b>Hint: {sugg.suggested}/5</b> <span className="muted small">{sugg.reason}</span><button className="btn btn-sm btn-ghost" onClick={() => patch(q.id, { score: sugg.suggested })}>Use it</button></div>}
          <textarea className="ta note" rows={2} value={cur.note} onChange={(e) => patch(q.id, { note: e.target.value })} placeholder="Your notes" />
          <div className="lv-nav">
            <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
            <span className="muted small">{saved || `${done} of ${role.questions.length} rated`}</span>
            {i + 1 < role.questions.length ? <button className="btn btn-primary" onClick={() => setI(i + 1)}>Next question <Icon name="arrow" size={16} /></button> : <button className="btn btn-primary" onClick={finish}>Finish and open scorecard <Icon name="arrow" size={16} /></button>}
          </div>
        </section>

        <aside className="glass lv-cop">
          <div className="cop-h"><span className="cop-orb"><i /></span><div><b>Copilot</b><small>{thinking ? 'Reading the answer...' : cp ? (cp.source === 'ai' ? 'AI suggestions' : 'Rule-based suggestions (AI key off)') : 'Listening for an answer'}</small></div></div>
          {!cp && !thinking && <div className="cop-empty"><Icon name="spark" size={22} /><p>Start the answer. Follow-ups, probes and coverage appear here as soon as there is enough to read.</p></div>}
          {thinking && !cp && <div className="cop-skel"><i /><i /><i /></div>}
          {cp && (
            <div className={`cop-body ${thinking ? 'busy' : ''}`}>
              <div className="cop-sum"><span className={`tag dec ${verdict[1]}`}>{verdict[0]}</span><p>{cp.summary}</p></div>
              {cp.followUps.length > 0 && <div className="cop-sec"><small>ASK NEXT</small>
                {cp.followUps.map((f) => { const asked = (cur.asked || []).includes(f.text); return (
                  <div key={f.text} className={`cop-fu ${asked ? 'asked' : ''}`}><p>{f.text}</p><span>{f.why}</span>
                    <div className="cop-acts">{ttsSupported() && <button className="btn btn-sm btn-ghost" onClick={() => { say(f.text); ask(f.text) }}><Icon name="volume" size={14} /> Ask aloud</button>}<button className="btn btn-sm btn-ghost" disabled={asked} onClick={() => ask(f.text)}>{asked ? 'Asked' : 'Mark as asked'}</button></div></div>) })}
              </div>}
              {cp.probes.length > 0 && <div className="cop-sec"><small>DIG INTO</small>{cp.probes.map((p) => <div key={p.quote} className="cop-probe"><q>{p.quote}</q><span>{p.why}</span></div>)}</div>}
              {cp.lookFor.length > 0 && <div className="cop-sec"><small>EXPECTED POINTS (KEYWORD MATCH)</small><ul className="cop-chk">{cp.lookFor.map((x) => <li key={x.text} className={x.hit ? 'hit' : ''}><i>{x.hit && <Icon name="check" size={12} stroke={2.6} />}</i>{x.text}</li>)}</ul></div>}
              {cp.redFlags.length > 0 && <div className="cop-sec"><small>RED FLAGS HEARD</small><ul className="cop-flags">{cp.redFlags.map((x) => <li key={x.text}>{x.text}</li>)}</ul></div>}
            </div>
          )}
          <div className="cop-sec cov">
            <small>PILLAR COVERAGE</small>
            {(cp?.coverage?.rows || role.rubric.map((c) => ({ id: c.id, name: c.name, weight: c.weight, asked: role.questions.filter((x) => x.competency === c.id && words(ans[x.id]?.transcript || '') >= 15).length, of: role.questions.filter((x) => x.competency === c.id).length }))).map((r) => (
              <div key={r.id} className="lbp"><span>{r.name}</span><div className="bar"><i style={{ '--w': (r.of ? (r.asked / r.of) * 100 : 0) + '%' }} /></div><b>{r.asked}/{r.of}</b></div>
            ))}
            {cp?.coverage?.next && <button className="cop-next" onClick={() => setI(role.questions.findIndex((x) => x.id === cp.coverage.next.id))}><small>Least covered: {cp.coverage.next.pillar}</small><span>{cp.coverage.next.text}</span><Icon name="arrow" size={14} /></button>}
          </div>
          <p className="muted small">The copilot reads the answer text only. It suggests, you decide. It is a signal and can be wrong.</p>
          {err && <div className="alert">{err}</div>}
        </aside>
      </div>
    </main>
  )
}
