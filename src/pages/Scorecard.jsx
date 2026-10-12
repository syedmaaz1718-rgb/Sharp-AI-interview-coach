import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Icon, Spinner } from '../components/ui.jsx'
import { useDictate } from '../lib/dictate.js'
import { speechLang } from '../lib/prefs.js'
import { AuthChip } from './RoleDetail.jsx'

const DECISIONS = ['Strong hire', 'Hire', 'Maybe', 'No hire']
const LABEL = { 1: 'Poor', 2: 'Weak', 3: 'Solid', 4: 'Strong', 5: 'Excellent' }

function QuestionCard({ q, i, role, cand, r, auth, set, roleId }) {
  const dict = useDictate({ lang: speechLang(role.lang), onText: (f, int) => set(q.id, { transcript: [f, int].filter(Boolean).join(' ') }) })
  const rec = dict.rec
  const [sug, setSug] = useState(null)
  const [busy, setBusy] = useState(false)
  const ans = cand.answers[q.id]
  const comp = role.rubric.find((c) => c.id === q.competency)
  const dictate = () => dict.toggle()
  const suggest = async () => { setBusy(true); try { setSug(await api.hrSuggest(roleId, { questionId: q.id, transcript: r.transcript || ans?.transcript || '' })) } catch {} setBusy(false) }
  const text = r.transcript || ans?.transcript || ''
  return (
    <article className="sc-q glass">
      <div className="sc-qh"><span className="sc-n">{i + 1}</span><div><p className="sc-text">{q.text}</p><span className="tag">{comp?.name}</span></div></div>
      {(q.looksFor?.length > 0 || q.redFlags?.length > 0) && (
        <div className="sc-cheat">
          {q.looksFor?.length > 0 && <div><small>LOOK FOR</small><ul>{q.looksFor.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {q.redFlags?.length > 0 && <div className="red"><small>RED FLAGS</small><ul>{q.redFlags.map((x) => <li key={x}>{x}</li>)}</ul></div>}
        </div>
      )}
      {ans && (
        <div className="sc-ans">
          <div className="sc-ans-h"><small>CANDIDATE ANSWER</small><AuthChip a={auth} /></div>
          <p>{ans.transcript}</p>
          <div className="sc-meta muted small">{ans.input === 'speech' ? 'Spoken' : 'Typed'} · {ans.analysis?.words} words{ans.analysis?.wpm ? ` · ${ans.analysis.wpm} wpm` : ''}{ans.meta?.pasted ? ' · text was pasted' : ''}</div>
          {auth?.signals?.length > 0 && <ul className="signals">{auth.signals.map((s) => <li key={s.label} className={s.effect}><b>{s.label}</b> {s.detail}</li>)}</ul>}
          {ans.followUp && (
            <div className="sc-fu"><small>FOLLOW-UP ASKED</small><p><i>{ans.followUp.text}</i></p>{ans.followUp.answered ? <p>{ans.followUp.transcript}</p> : <p className="muted small">Not answered.</p>}</div>
          )}
        </div>
      )}
      {!ans && (
        <div className="sc-dict">
          <textarea className="ta" rows={3} value={r.transcript || ''} onChange={(e) => set(q.id, { transcript: e.target.value })} placeholder="Optional: dictate or paste the answer to get a rating hint and an authenticity signal" />
          <div className="sc-dict-b">
            {dict.available && <button className={`btn btn-sm ${rec ? 'btn-danger' : 'btn-ghost'}`} onClick={dictate}><Icon name="mic" size={14} /> {rec ? 'Stop dictation' : dict.pending ? 'Transcribing...' : `Dictate${role.lang !== 'en' ? (role.lang === 'hindi' ? ' (हिन्दी)' : ' (Hinglish)') : ''}`}</button>}
            <button className="btn btn-sm btn-ghost" disabled={busy || text.trim().split(/\s+/).length < 6} onClick={suggest}><Icon name="spark" size={14} /> Suggest rating</button>
            {auth && <AuthChip a={auth} />}
          </div>
          {sug && <div className="sc-sug"><b>Hint: {sug.suggested}/5</b> <span className="muted small">{sug.reason}</span><button className="btn btn-sm btn-ghost" onClick={() => set(q.id, { score: sug.suggested })}>Use it</button></div>}
        </div>
      )}
      <div className="rate" role="radiogroup" aria-label={`Rate answer ${i + 1}`}>
        {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={r.score === n} className={`rate-btn ${r.score === n ? 'on' : ''}`} onClick={() => set(q.id, { score: r.score === n ? undefined : n, auto: false })}><b>{n}</b><small>{LABEL[n]}</small></button>)}
        {r.auto && r.score && <span className="tag auto">Auto-scored, tap a rating to override</span>}
      </div>
      <textarea className="ta note" rows={2} value={r.note || ''} onChange={(e) => set(q.id, { note: e.target.value })} placeholder="Notes" />
    </article>
  )
}

export default function Scorecard() {
  const { id, cid } = useParams()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [ratings, setRatings] = useState({})
  const [meta, setMeta] = useState({ notes: '', decision: null, shortlisted: false })
  const [score, setScore] = useState(null)
  const [saving, setSaving] = useState('')
  const timer = useRef(null)
  const dirty = useRef(false)

  useEffect(() => {
    api.hrCandidate(cid).then((x) => { setD(x); setRatings(x.candidate.ratings); setScore(x.score); setMeta({ notes: x.candidate.notes, decision: x.candidate.decision, shortlisted: x.candidate.shortlisted }) }).catch((e) => setErr(e.message))
  }, [cid])

  const save = useCallback((rt, m) => {
    clearTimeout(timer.current); dirty.current = true; setSaving('Saving...')
    timer.current = setTimeout(async () => {
      try { const r = await api.hrUpdateCandidate(cid, { ratings: rt, notes: m.notes, decision: m.decision, shortlisted: m.shortlisted }); setScore(r.score); setSaving('Saved'); dirty.current = false; setTimeout(() => setSaving(''), 1200) } catch (e) { setSaving('Could not save: ' + e.message) }
    }, 500)
  }, [cid])
  const setQ = (qid, patch) => { const next = { ...ratings, [qid]: { ...(ratings[qid] || {}), ...patch } }; setRatings(next); save(next, meta) }
  const setM = (patch) => { const next = { ...meta, ...patch }; setMeta(next); save(ratings, next) }

  if (err) return <main className="narrow center"><div className="glass pad"><h2>Candidate not found</h2><p className="muted">They may have been removed from this role, or the link is wrong.</p><Link className="btn btn-primary" to={`/recruiter/${id}`}>Back to role</Link></div></main>
  if (!d) return <main className="narrow"><Spinner text="Loading scorecard..." /></main>
  const { role, candidate: cand } = d
  const sug = score?.recommendation
  return (
    <main className="page-wide">
      <header className="pg-head rd-head">
        <Link to={`/recruiter/${role.id}`} className="back"><Icon name="arrow" size={14} className="flip" /> {role.title}</Link>
        <span className="idx">{cand.source === 'link' ? 'SCREENING REPORT' : 'LIVE SCORECARD'}</span>
        <h1 className="display">{cand.name}</h1>
        <p className="muted lede">{cand.source === 'link' ? `Self-serve interview, ${cand.status === 'complete' ? 'completed' : 'in progress'}. Scores marked Auto come from the answer analysis. You can override any of them.` : 'Ask the questions, rate each answer, add notes. The summary updates as you go.'}</p>
      </header>
      <div className="sc-layout">
        <div className="sc-list">
          {role.questions.map((q, i) => <QuestionCard key={q.id} q={q} i={i} role={role} cand={cand} r={ratings[q.id] || {}} auth={d.authenticity[q.id]} set={setQ} roleId={role.id} />)}
        </div>
        <aside className="sc-side glass">
          <div className="sc-score"><b>{score?.overall ?? '-'}</b><span>/ 5</span></div>
          <div className="sc-sug-rec">{sug ? <span className={`tag dec ${{ 'Strong hire': 'good', Hire: 'good', Maybe: 'mid', 'No hire': 'low' }[sug]}`}>Suggested: {sug}</span> : <span className="muted small">Rate an answer to see the summary</span>}</div>
          <div className="sc-prog"><div className="bar"><i style={{ '--w': (score?.coverage || 0) + '%' }} /></div><small>{score?.rated || 0} of {score?.total} answers rated</small></div>
          <div className="sc-comps">
            {score?.comps.map((c) => <div key={c.id} className="lbp"><span>{c.name} <em>{c.weight}%</em></span><div className="bar"><i style={{ '--w': (c.avg ? (c.avg / 5) * 100 : 0) + '%' }} /></div><b>{c.avg ?? '-'}</b></div>)}
          </div>
          <h4>Your decision</h4>
          <div className="dec-btns">{DECISIONS.map((x) => <button key={x} className={`dec-btn ${meta.decision === x ? 'on' : ''}`} onClick={() => setM({ decision: meta.decision === x ? null : x })}>{x}</button>)}</div>
          <button className={`btn block ${meta.shortlisted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setM({ shortlisted: !meta.shortlisted })}><Icon name="star" size={16} /> {meta.shortlisted ? 'On the shortlist' : 'Add to shortlist'}</button>
          <textarea className="ta" rows={4} value={meta.notes} onChange={(e) => setM({ notes: e.target.value })} placeholder="Overall notes" />
          <p className="muted small sc-save">{saving || 'Changes save automatically'}</p>
          <p className="muted small">{d.disclaimer}</p>
        </aside>
      </div>
    </main>
  )
}
