import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { markFillers } from '../lib/analysis.js'
import { Ring, MetricBar, MetricIcon, Radar, Spinner, Icon, fmt, tone, roleLabel } from '../components/ui.jsx'
import ScorePanel from '../components/ScorePanel.jsx'
import Replay from '../components/Replay.jsx'
import { deleteSessionReplays } from '../lib/replayStore.js'

const when = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function Report() {
  const { id } = useParams()
  const loc = useLocation()
  const nav = useNavigate()
  const [rep, setRep] = useState(loc.state?.report || null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(0)

  useEffect(() => {
    if (rep) return
    api.report(id).then(setRep).catch((e) => setErr(e.message))
  }, [id, rep])

  if (err) return <main className="narrow center"><div className="glass pad"><h2>Report not found</h2><p className="muted">It may have been deleted, or the free server restarted (history resets on redeploy).</p><Link className="btn btn-primary" to="/">Start a new interview</Link></div></main>
  if (!rep) return <main className="narrow"><Spinner text="Loading report..." /></main>

  const s = rep.scores
  const st = rep.stats
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + '/report/' + rep.id); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { window.prompt('Copy this link', window.location.origin + '/report/' + rep.id) }
  }
  const del = async () => {
    if (!confirm('Delete this session permanently?')) return
    try { await api.remove(rep.id); await deleteSessionReplays(rep.id); nav('/history') } catch (e) { alert(e.message) }
  }
  const noFace = s.face == null
  const noVoice = s.voice == null

  return (
    <main className="report">
      {rep.early && <div className="early-note" role="note"><Icon name="shield" size={18} /><span><b>Submitted early.</b> The interview was left before the last question, so this report covers the {rep.answered || rep.questions} {(rep.answered || rep.questions) === 1 ? 'answer' : 'answers'} given up to that point.</span></div>}
      <div className="report-head">
        <div>
          <span className="pill"><i className="dot" /> Interview report</span>
          <h1 className="h1">{roleLabel(rep.role)} <span className="muted">· {rep.questions} {rep.questions === 1 ? 'answer' : 'answers'}</span></h1>
          <p className="muted small">{when(rep.finishedAt)}</p>
        </div>
        <div className="head-actions no-print">
          <button className="btn btn-ghost" onClick={share}>{copied ? 'Link copied' : 'Copy share link'}</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Save as PDF</button>
          <Link className="btn btn-primary" to={rep.pack ? `/interview?pack=${rep.pack.id}&count=5` : `/interview?role=${rep.role}&count=5`}>Practice again</Link>
        </div>
      </div>

      <section className={`hero-report glass ${s.overall >= 6.5 ? "celebrate" : ""}`}>
        <div className="hr-ring">
          <Ring value={s.overall} size={230} stroke={16} big label="overall" sub={rep.grade} />
        </div>
        <div className="hr-body">
          <h2 className="hr-line">{rep.headline || 'Scored on your answers'}</h2>
          <div className="mini-rings">
            <Ring value={s.confidence} size={104} stroke={8} label="confidence" delay={150} />
            <Ring value={s.face} size={104} stroke={8} label="presence" delay={250} />
            <Ring value={s.voice} size={104} stroke={8} label="voice" delay={350} />
            <Ring value={s.answer} size={104} stroke={8} label="answers" delay={450} />
          </div>
          {(noFace || noVoice) && (
            <p className="note">{noFace && 'Face scores were not measured (camera off or no face detected). '}{noVoice && 'Voice scores were not measured (typed answers or no microphone). '}Overall is calculated from what was measured.</p>
          )}
        </div>
      </section>

      <ScorePanel id={rep.id} />

      {rep.mode === 'stress' && <div className="alert soft stress-note"><b>Stress mode:</b> a tough interviewer pushed back on your answers. The follow-up answers count extra, as composure under pressure.</div>}

      <div className="two">
        <section className="glass pad">
          <h3 className="h3">Skill radar</h3>
          <Radar axes={[
            { label: 'Eye contact', value: s.eye }, { label: 'Expression', value: s.expression }, { label: 'Pace', value: s.pace },
            { label: 'Fillers', value: s.filler }, { label: 'Energy', value: s.energy }, { label: 'Answers', value: s.answer },
          ]} />
        </section>
        <section className="glass pad">
          <h3 className="h3">By the numbers</h3>
          <div className="stats">
            <Stat label="Avg pace" icon="gauge" kind="ping" value={st.avgWpm ? `${st.avgWpm}` : '-'} unit="wpm" good={st.avgWpm && st.avgWpm >= 110 && st.avgWpm <= 170} hint="ideal 120 to 160" />
            <Stat label="Filler words" icon="chat" kind="ping" value={st.totalWords >= 8 ? st.totalFillers : '-'} unit={st.fillersPer100 != null ? `${st.fillersPer100}/100 words` : ''} good={st.fillersPer100 != null && st.fillersPer100 <= 3} hint="under 3 per 100 is great" />
            <Stat label="Eye contact" icon="eye" kind="blink" value={st.eyeContactPct != null ? `${st.eyeContactPct}%` : '-'} unit="estimated" good={st.eyeContactPct != null && st.eyeContactPct >= 70} hint="aim for 70%+" />
            <Stat label="Words spoken" icon="pen" value={st.totalWords} unit="total" good />
          </div>
          {Object.keys(st.fillerBreakdown).length > 0 && (
            <div className="fillers">
              <h4>Your filler words</h4>
              <div className="filler-chips">
                {Object.entries(st.fillerBreakdown).sort((a, b) => b[1] - a[1]).map(([w, n]) => <span key={w} className="fchip">"{w}" <b>{n}</b></span>)}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="glass pad">
        <h3 className="h3">{rep.coaching ? 'AI coach summary' : 'Your top fixes'}</h3>
        {rep.coaching && (
          <>
            <p className="coach-sum">{rep.coaching.summary}</p>
            {rep.coaching.nextSteps.length > 0 && <ul className="next-steps">{rep.coaching.nextSteps.map((t, i) => <li key={i}>{t}</li>)}</ul>}
            <h4 className="mt">From your answers</h4>
          </>
        )}
        {rep.tips.length ? rep.tips.map((t, i) => <p key={i} className={`tip-line a-${t.area}`}><span>{t.area}</span>{t.text}</p>) : <p className="muted">No major issues found. Keep practising for consistency.</p>}
      </section>

      {rep.pack && (
        <section className="glass pad">
          <h3 className="h3">{rep.pack.name}: how that lens read your answers</h3>
          <p className="muted small">{rep.pack.flavor}</p>
          <div className="lens-grid">
            {rep.pack.coverage.map((c) => (
              <div key={c.name} className={`lens-item ${c.hit ? 'hit' : 'miss'}`}>
                <span className="lens-ico"><Icon name={c.hit ? 'check' : 'x'} size={14} stroke={2.4} /></span>
                <div><b>{c.name}</b><span>{c.hit ? 'You showed this.' : c.lookFor}</span></div>
              </div>
            ))}
          </div>
          <p className="disclaimer">{rep.pack.disclaimer}</p>
        </section>
      )}

      <section className="glass pad">
        <h3 className="h3">Breakdown</h3>
        <div className="breakdown">
          <div>
            <h4>Presence</h4>
            <MetricBar label="Eye contact" icon="eye" kind="blink" value={s.eye} />
            <MetricBar label="Head steadiness" icon="head" value={s.steady} delay={60} />
            <MetricBar label="Expression" icon="smile" value={s.expression} delay={120} />
          </div>
          <div>
            <h4>Voice</h4>
            <MetricBar label="Pace" icon="gauge" kind="ping" value={s.pace} />
            <MetricBar label="Filler words" icon="chat" kind="ping" value={s.filler} delay={60} />
            <MetricBar label="Pauses" icon="pause" value={s.pauses} delay={120} />
            <MetricBar label="Vocal energy" icon="mic" kind="ping" value={s.energy} delay={180} />
          </div>
        </div>
        <p className="foot-note">Eye contact, steadiness and expression are estimates from a face-landmark model and a head-pose heuristic, not ground truth. Use them as a practice guide.</p>
      </section>

      <section>
        <h3 className="h3 pad-l">Question by question</h3>
        {rep.answers.map((a, i) => (
          <article key={i} className={`qa glass ${open === i ? 'open' : ''}`}>
            <button className="qa-head" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              <span className="qa-n">{i + 1}</span>
              {a.followUp && <span className="badge fu">follow-up</span>}
              <span className="qa-q">{a.question.text}</span>
              {rep.best === i && rep.answers.length > 1 && <span className="badge good">best</span>}
              {rep.worst === i && rep.answers.length > 1 && <span className="badge fix">work on this</span>}
              <span className={`qa-score t-${tone(a.score)}`}>{fmt(a.score)}</span>
              <span className="chev" aria-hidden>▾</span>
            </button>
            {open === i && (
              <div className="qa-body">
                <div className="qa-metrics">
                  <MiniStat label="Content" v={a.analysis.scores.content} />
                  <MiniStat label="Voice" v={a.analysis.scores.voice} />
                  <MiniStat label="Presence" v={a.analysis.scores.face} />
                  <MiniStat label="Pace" v={a.analysis.wpm} suffix=" wpm" plain />
                  <MiniStat label="Fillers" v={a.analysis.fillers.total} plain />
                </div>
                <h4>Replay</h4>
                <Replay sessionId={rep.id} questionId={a.question.id} />
                <h4>Your answer</h4>
                <p className="transcript">{markFillers(a.transcript).map((seg, k) => seg.f ? <mark key={k}>{seg.t}</mark> : <span key={k}>{seg.t}</span>)}</p>
                {a.llm && (
                  <div className="llm">
                    <div className="llm-h"><span><Icon name="spark" size={15} /> AI coach</span> <b>{a.llm.score}/10</b></div>
                    {a.llm.strengths.map((t, k) => <p key={k} className="good">+ {t}</p>)}
                    {a.llm.improvements.map((t, k) => <p key={k} className="fix">- {t}</p>)}
                    {a.llm.sample && <><h4>A stronger version</h4><blockquote>{a.llm.sample}</blockquote></>}
                  </div>
                )}
                {a.analysis.content.keywordsTotal > 0 && (
                  <p className="small muted">Key ideas covered: {a.analysis.content.keywordsHit.length}/{a.analysis.content.keywordsTotal}{a.analysis.content.keywordsHit.length ? ` (${a.analysis.content.keywordsHit.slice(0, 6).join(', ')})` : ''}</p>
                )}
                {a.analysis.tips.map((t, k) => <p key={k} className={`tip-line a-${t.area}`}><span>{t.area}</span>{t.text}</p>)}
              </div>
            )}
          </article>
        ))}
      </section>

      <div className="report-foot no-print">
        <button className="btn btn-ghost" onClick={del}>Delete this session</button>
        <Link className="btn btn-ghost" to="/history">All sessions</Link>
      </div>
    </main>
  )
}

function Stat({ label, value, unit, hint, good, icon, kind }) {
  return (
    <div className="stat">
      <small className="stat-l">{icon && <MetricIcon name={icon} kind={kind} on={value !== '-'} size={15} />}{label}</small>
      <b className={good ? 't-great' : 't-ok'}>{value}</b>
      <span>{unit}</span>
      {hint && <em>{hint}</em>}
    </div>
  )
}
function MiniStat({ label, v, suffix = '', plain }) {
  return (
    <div className="mini">
      <small>{label}</small>
      <b className={plain ? '' : `t-${tone(v)}`}>{v == null ? '-' : plain ? `${v}${suffix}` : fmt(v)}</b>
    </div>
  )
}
