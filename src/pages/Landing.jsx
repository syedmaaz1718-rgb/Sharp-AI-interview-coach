import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Ring, Radar, Icon, Hello } from '../components/ui.jsx'
import { loadResume, saveResume, usePrefs, LANGS } from '../lib/prefs.js'
import { useInView, useMounted } from '../lib/hooks.js'

const FALLBACK_ROLES = [
  { id: 'general', label: 'General / HR', blurb: 'Behavioral questions every internship interview asks' },
  { id: 'sde', label: 'Software Engineer', blurb: 'DSA, OOP, projects, problem solving' },
  { id: 'data', label: 'Data / ML', blurb: 'ML basics, metrics, data cleaning, projects' },
  { id: 'frontend', label: 'Frontend / Web', blurb: 'React, browser, performance, APIs' },
]

const FEATURES = [
  { ico: 'eye', title: 'Eye contact and presence', text: 'A 478-point face mesh runs in your browser and estimates eye contact, head steadiness, smile and brow tension, frame by frame.' },
  { ico: 'mic', title: 'Voice and delivery', text: 'Words per minute, filler words, pauses and vocal energy, measured while you speak. A subtle alert flashes the moment you say "um".' },
  { ico: 'chat', title: 'A real interviewer', text: 'Questions are read aloud. With the AI coach on, it asks a follow-up about something specific you said, like a person would.' },
  { ico: 'video', title: 'Replay yourself', text: 'Every answer is saved on your device with a timeline of eye contact, energy and filler words, so you can watch what the interviewer saw.' },
]
const PLACEHOLDER = 'Projects\n- Zippy: quick commerce app built with React, Node and SQLite\n\nSkills\nJava, Python, React, SQL'
function CompanyRole({ cfg, count, resume, lang }) {
  const nav = useNavigate()
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(null)
  const [role, setRole] = useState('')
  const [useRes, setUseRes] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [hi, setHi] = useState(0)
  const [disc, setDisc] = useState('')
  useEffect(() => { api.companies().then((r) => { setList(r.companies); setDisc(r.disclaimer) }).catch(() => setErr('Could not load the company list. Check your connection.')) }, [])
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    const m = t ? list.filter((c) => c.name.toLowerCase().includes(t) || c.sector.toLowerCase().includes(t)) : list
    return m.sort((a, b) => (a.name.toLowerCase().startsWith(t) ? 0 : 1) - (b.name.toLowerCase().startsWith(t) ? 0 : 1)).slice(0, 60)
  }, [q, list])
  const pick = (c) => { setSel(c); setQ(''); setOpen(false); setErr('') }
  const hasRes = resume.trim().length >= 40
  const go = async () => {
    setBusy(true); setErr('')
    try {
      const g = await api.companyQuestions({ company: sel.id, role, count, lang, resume: useRes && hasRes ? resume : '' })
      nav('/interview?mode=company&role=general', { state: { custom: g.questions, label: `${sel.name} · ${role}` } })
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  const roleIdeas = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Analyst', 'Data Scientist', 'ML Engineer', 'DevOps Engineer', 'QA / Test Engineer', 'Cybersecurity Analyst', 'Mobile App Developer', 'Cloud Engineer', 'Product Manager', 'Business Analyst', 'UI/UX Designer', 'Graphic Designer', 'Digital Marketing Executive', 'Content Writer', 'Sales Executive', 'Business Development', 'Customer Support', 'HR Executive', 'Recruiter', 'Operations Manager', 'Supply Chain Analyst', 'Financial Analyst', 'Accountant', 'Investment Banking Analyst', 'Management Consultant', 'Management Trainee', 'Project Manager', 'Mechanical Engineer', 'Civil Engineer', 'Electrical Engineer']
  return (
    <>
      <p className="muted">Pick the company and the role you are interviewing for. The interviewer asks in the style that company is commonly reported to use.</p>
      <div className="co-field">
        <label htmlFor="co-q">Company <small>{list.length ? `${list.length}+ to choose from` : ''}</small></label>
        {sel && !open ? (
          <button type="button" className="co-sel" onClick={() => { setOpen(true); setQ('') }}><span className="mono">{sel.name[0]}</span><span><b>{sel.name}</b><small>{sel.sector} · {sel.region}</small></span><em>Change</em></button>
        ) : (
          <div className="co-combo">
            <input id="co-q" className="input" autoComplete="off" role="combobox" aria-expanded={open} aria-controls="co-list" placeholder="Search a company, e.g. TCS, Amazon, HDFC Bank, Swiggy" value={q}
              onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0) }}
              onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) } else if (e.key === 'Enter' && matches[hi]) { e.preventDefault(); pick(matches[hi]) } else if (e.key === 'Escape') setOpen(false) }} />
            {open && (
              <ul id="co-list" className="co-list" role="listbox">
                {matches.length === 0 && <li className="co-empty">No match. Try another spelling or pick a sector name.</li>}
                {matches.map((c, i) => (
                  <li key={c.id} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(c) }}>
                    <span className="mono">{c.name[0]}</span><span><b>{c.name}</b><small>{c.sector} · {c.region}</small></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="co-field">
        <label htmlFor="co-role">Job role</label>
        <input id="co-role" className="input" maxLength={80} placeholder="e.g. Data Analyst" value={role} onChange={(e) => setRole(e.target.value)} />
        <div className="co-ideas">{roleIdeas.map((r) => <button type="button" key={r} onClick={() => setRole(r)}>{r}</button>)}</div>
      </div>
      <label className="check"><input type="checkbox" checked={useRes && hasRes} onChange={(e) => setUseRes(e.target.checked)} disabled={!hasRes} /> Also use my saved resume{hasRes ? '' : ' (add it in the My resume tab first)'}</label>
      <p className="disclaimer">{disc || 'Based on commonly reported interview patterns. Not official company content.'}</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="start-foot"><button className="btn btn-primary btn-lg" disabled={busy || !sel || role.trim().length < 2} onClick={go}>{busy ? 'Preparing your interview...' : 'Start interview'} <Icon name="arrow" size={18} /></button></div>
    </>
  )
}

const TABS = [['role', 'By role'], ['co', 'Company + role'], ['company', 'Style packs'], ['jd', 'Job description'], ['resume', 'My resume']]
const JD_KEY = 'sharpai_jd'
const loadJd = () => { try { return localStorage.getItem(JD_KEY) || '' } catch { return '' } }
const readFile = (file, set) => { if (!file) return; if (file.size > 400000) return alert('That file is too big. Paste the text instead.'); if (!/\.(txt|md|text)$/i.test(file.name) && !file.type.startsWith('text/')) return alert('Upload a .txt file, or paste the text. PDFs are not read in the browser, so copy the text out of the PDF.'); const r = new FileReader(); r.onload = () => set(String(r.result || '').slice(0, 12000)); r.readAsText(file) }

function RolePicker({ roles, role, setRole }) {
  const [q, setQ] = useState('')
  const shown = roles.filter((r) => !q.trim() || (r.label + ' ' + r.blurb).toLowerCase().includes(q.trim().toLowerCase()))
  const groups = []
  shown.forEach((r) => { const g = r.group || 'Other'; let e = groups.find((x) => x[0] === g); if (!e) groups.push(e = [g, []]); e[1].push(r) })
  return (
    <div className="role-picker">
      <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles, e.g. backend, design, analyst" aria-label="Search roles" />
      <div className="role-scroll" role="radiogroup" aria-label="Role">
        {groups.map(([g, rs]) => (
          <div key={g} className="role-group">
            <div className="cn-eyebrow">{g}</div>
            <div className="roles">
              {rs.map((r) => (
                <button key={r.id} role="radio" aria-checked={role === r.id} className={`role ${role === r.id ? 'on' : ''}`} onClick={() => setRole(r.id)}>
                  <span className="role-ico"><Icon name={r.icon || 'user'} size={18} /></span>
                  <b>{r.label}</b>
                  <small>{r.blurb}</small>
                  <span className="role-check"><Icon name="check" size={13} stroke={2.6} /></span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <p className="muted small">No role matches "{q}". Try "General" if you are not sure, it works for any field.</p>}
      </div>
    </div>
  )
}

function GapReport({ g }) {
  const pct = g.matchPct ?? 0
  return (
    <div className="gap-report fade-up">
      <div className="gap-top">
        <div className="gap-ring" style={{ '--p': pct }}><b>{pct}%</b><small>match</small></div>
        <div><h4>Resume vs job description</h4><p className="muted">{g.summary}</p></div>
      </div>
      {g.matched.length > 0 && <div className="gap-have"><small>YOU ALREADY COVER</small><div className="tags">{g.matched.map((m) => <span key={m.skill} className="tag ok"><Icon name="check" size={13} /> {m.skill}</span>)}</div></div>}
      {g.missing.length > 0 && (
        <div className="gap-miss">
          <small>MISSING, AND HOW TO COVER IT</small>
          {g.missing.map((m) => (
            <div key={m.skill} className="gap-item">
              <div className="gi-head"><b>{m.skill}</b><span className={`tag ${m.importance === 'required' ? 'req' : 'nice'}`}>{m.importance === 'required' ? 'Required' : 'Nice to have'}</span></div>
              <ul>{m.how.map((h) => <li key={h}>{h}</li>)}</ul>
              <p className="muted small"><Icon name="target" size={13} /> Proof to show: {m.proof}</p>
            </div>
          ))}
          <p className="muted small">Your interview will ask about these gaps directly, so you can practise the honest answer.</p>
        </div>
      )}
    </div>
  )
}

export function StartCard({ cfg }) {
  const nav = useNavigate()
  const [prefs, setPref] = usePrefs()
  const [gap, setGap] = useState(null)
  const [gapBusy, setGapBusy] = useState(false)
  const runGap = async () => {
    setGapBusy(true); setErr('')
    try { setGap(await api.gap(jd, resume)) } catch (e) { setErr(e.message); setGap(null) }
    setGapBusy(false)
  }
  const [tab, setTab] = useState(() => (loadResume().trim().length >= 40 ? 'resume' : 'role'))
  const [role, setRole] = useState('sde')
  const [count, setCount] = useState(7)
  const [packId, setPackId] = useState('amazon')
  const [resume, setResume] = useState(loadResume())
  const [jd, setJd] = useState(loadJd())
  const [useRes, setUseRes] = useState(true)
  const [gen, setGen] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const roles = cfg?.roles || FALLBACK_ROLES
  const packs = cfg?.packs || []
  const pack = packs.find((p) => p.id === packId)

  // questions are written now but never shown: the interviewer reveals them one at a time, on the spot
  const startNow = async (mode) => {
    setBusy(true); setErr(''); saveResume(resume); try { localStorage.setItem(JD_KEY, jd) } catch {}
    try {
      const g = mode === 'jd' ? await api.tailoredQuestions({ jd, resume: useRes ? resume : '', role, count }) : await api.resumeQuestions(resume, role, count)
      nav(`/interview?mode=${mode}&role=${role}`, { state: { custom: g.questions } })
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <div className="start-card glass">
      <h2 className="h2 left">Set up your interview</h2>
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      <div className="mode-row">
        <div className="lang-row" role="radiogroup" aria-label="Interview language"><span><Icon name="chat" size={15} /> Language</span><div className="seg">{LANGS.map(([k, l]) => <button key={k} role="radio" aria-checked={prefs.lang === k} className={prefs.lang === k ? 'on' : ''} onClick={() => setPref('lang', k)}>{l}</button>)}</div></div>
        <button type="button" role="switch" aria-checked={prefs.stress} className={`stress-switch ${prefs.stress ? 'on' : ''}`} onClick={() => setPref('stress', !prefs.stress)}><Icon name="bolt" size={15} active={prefs.stress} /><span><b>Stress mode</b><small>{prefs.stress ? 'Pushback on every answer' : 'Off'}</small></span><i /></button>
      </div>
      {prefs.lang !== 'en' && <p className="muted small lang-note">The interviewer speaks and listens in {prefs.lang === 'hindi' ? 'Hindi' : 'Hinglish'}. Answer in the same way. {cfg && !cfg.llm ? 'Built-in questions are used. Resume and JD questions need the AI key to be translated.' : ''}</p>}

      {(
        <div className="count-row top">
          <span>Questions</span>
          <div className="seg">{[7, 9, 12].map((n) => <button key={n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>{n}</button>)}</div>
          <span className="muted small">about {count * 2 + 2} to {count * 3 + 3} minutes - minimum 7 questions, asked one at a time{tab === 'resume' || tab === 'jd' ? ', written for your resume and the job. You will not see them in advance' : ''}</span>
        </div>
      )}

      {tab === 'co' && <CompanyRole cfg={cfg} count={count} resume={resume} lang={prefs.lang} />}

      {tab === 'role' && (
        <>
          <p className="muted">Pick the kind of role you are preparing for.</p>
          <RolePicker roles={roles} role={role} setRole={setRole} />
          <div className="start-foot"><button className="btn btn-primary btn-lg" onClick={() => nav(`/interview?role=${role}&count=${count}`)}>Begin <Icon name="arrow" size={18} /></button></div>
        </>
      )}

      {tab === 'company' && (
        <>
          <p className="muted">Practice in the style of a company's interviews. Each set has its own questions and a "lens" that shows up in your report.</p>
          <div className="packs" role="radiogroup" aria-label="Company style">
            {packs.map((p) => (
              <button key={p.id} role="radio" aria-checked={packId === p.id} className={`pack ${packId === p.id ? 'on' : ''}`} onClick={() => setPackId(p.id)}>
                <span className="mono">{p.name[0]}</span>
                <span className="pack-t"><b>{p.name}</b><small>{p.tagline}</small></span>
              </button>
            ))}
          </div>
          {pack && (
            <div className="pack-detail fade-up" key={pack.id}>
              <p>{pack.flavor}</p>
              {pack.rounds?.length > 0 && (<><h4>Commonly reported rounds</h4><ol className="rounds">{pack.rounds.map((r, i) => <li key={r.name}><i>{i + 1}</i><span><b>{r.name}</b>{r.what}</span></li>)}</ol></>)}
              <h4>What this style looks for</h4>
              <ul className="lens">{pack.lens.map((l) => <li key={l.name}><b>{l.name}</b><span>{l.lookFor}</span></li>)}</ul>
              <p className="disclaimer">{cfg?.disclaimer}</p>
            </div>
          )}
          <div className="start-foot"><button className="btn btn-primary btn-lg" disabled={!pack} onClick={() => nav(`/interview?pack=${packId}&count=${count}`)}>Begin <Icon name="arrow" size={18} /></button></div>
        </>
      )}

      {tab === 'jd' && (
        <>
          <p className="muted">Paste any job posting. The interviewer asks what that role actually needs, and can pull in your resume too.</p>
          <textarea className="ta resume-ta" rows={9} value={jd} onChange={(e) => { setJd(e.target.value); setGen(null) }} placeholder={'Backend Intern\nWe are looking for someone who knows Node.js and PostgreSQL...'} />
          <div className="count-row">
            <label className="file-btn"><input type="file" accept=".txt,.md,text/plain" onChange={(e) => { readFile(e.target.files[0], (t) => { setJd(t); setGen(null) }); e.target.value = '' }} /> Upload .txt</label>
            <label className="check"><input type="checkbox" checked={useRes} onChange={(e) => { setUseRes(e.target.checked); setGen(null) }} disabled={resume.trim().length < 40} /> Also use my saved resume{resume.trim().length < 40 ? ' (add it in the My resume tab)' : ''}</label>
          </div>
          <p className="muted small privacy">Stored only in this browser. {cfg?.llm ? 'With the AI coach on, the text is sent to Groq once to write your questions.' : 'The AI coach is off, so questions are built locally from the skills found in the posting.'}</p>
          {err && <div className="alert">{err}</div>}
          {gap && <GapReport g={gap} />}
          <div className="start-foot">
            <button className="btn btn-ghost btn-lg" disabled={gapBusy || jd.trim().length < 40 || resume.trim().length < 40} title={resume.trim().length < 40 ? 'Add your resume in the Resume tab first' : ''} onClick={runGap}><Icon name="target" size={18} /> {gapBusy ? 'Analyzing...' : 'Analyze my gap'}</button>
            <button className="btn btn-primary btn-lg" disabled={busy || jd.trim().length < 60} onClick={() => startNow('jd')}>{busy ? 'Preparing your interview...' : 'Start interview'} <Icon name="arrow" size={18} /></button>
          </div>
        </>
      )}

      {tab === 'resume' && (
        <>
          <p className="muted">Paste your resume text (projects and skills matter most). You get questions about your own work, like "why did you choose SQLite for that project?".</p>
          <textarea className="ta resume-ta" rows={9} value={resume} onChange={(e) => { setResume(e.target.value); setGen(null) }} onBlur={() => saveResume(resume)} placeholder={PLACEHOLDER} />
          <div className="count-row">
            <label className="file-btn"><input type="file" accept=".txt,.md,text/plain" onChange={(e) => { readFile(e.target.files[0], (t) => { setResume(t); saveResume(t); setGen(null) }); e.target.value = '' }} /> Upload .txt</label>
            <span>Role focus</span>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role focus">{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
          </div>
          <p className="muted small privacy">Stored only in this browser. {cfg?.llm ? 'The AI coach is on, so the text is sent to Groq once to write your questions.' : 'The AI coach is off, so questions are built locally from the skills and projects found in your text.'}</p>
          {err && <div className="alert">{err}</div>}
          <div className="start-foot">
            <button className="btn btn-primary btn-lg" disabled={busy || resume.trim().length < 40} onClick={() => startNow('resume')}>{busy ? 'Preparing your interview...' : 'Start interview'} <Icon name="arrow" size={18} /></button>
          </div>
        </>
      )}
      <p className="muted small browser-note">
        Works best in Chrome or Edge on a laptop. Arc and Firefox cannot do speech to text, but you can type your answers.
        {cfg && (cfg.llm ? ' AI coach is on: your answer text (never video or audio) is sent to Groq for feedback.' : ' AI coach is off: scoring uses the built-in method.')}
      </p>
    </div>
  )
}

export default function Landing() {
  const nav = useNavigate()
  const [cfg, setCfg] = useState(null)
  useEffect(() => { api.config().then(setCfg).catch(() => {}) }, [])
  const roles = cfg?.roles || FALLBACK_ROLES
  const [fref, fseen] = useInView()
  const mounted = useMounted(50)

  return (
    <main>
      <section className="cine">
        <span className="rail-l" aria-hidden="true">SHARPAI / MOCK INTERVIEW LAB</span>
        <span className="rail-r" aria-hidden="true">SPEAK. MEASURE. IMPROVE.</span>
        <div className="cine-grid-lines" aria-hidden="true" />
        <div className={`cine-copy ${mounted ? 'in' : ''}`}>
          <Hello className="hello-xl" />
          <span className="cn-eyebrow"><i className="dot" /> Voice-first interview practice</span>
          <h1 className="mega">
            <span className="ln"><span>Interviews</span></span>
            <span className="ln"><span>get won in</span></span>
            <span className="ln"><span className="ital">the first</span> <span className="ul">answer.</span></span>
          </h1>
          <p className="lead">Talk to an interviewer that speaks, listens and scores your eye contact, pace and filler words, tailored to your resume or the exact job post.</p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={() => nav('/practice')}>Start mock interview <span aria-hidden>→</span></button>
            <a className="btn btn-ghost btn-lg" href="#how">See how it works</a>
          </div>
        </div>
        <div className={`orb-stage ${mounted ? 'in' : ''}`} aria-hidden="true">
          <div className="orb-ring r1" /><div className="orb-ring r2" /><div className="orb-ring r3" />
          <div className="orb-core"><div className="cn-wave">{Array.from({ length: 21 }).map((_, i) => <i key={i} style={{ animationDelay: `${-i * 0.11}s` }} />)}</div></div>
          <div className="orb-orbit">
            <div className="orb-chip c1"><small><Icon name="eye" size={13} /> EYE CONTACT</small><b>8.1</b></div>
            <div className="orb-chip c2"><small><Icon name="mic" size={13} /> PACE</small><b>138<em> wpm</em></b></div>
            <div className="orb-chip c3"><small><Icon name="chat" size={13} /> FILLERS</small><b>2</b></div>
            <div className="orb-chip c4"><small><Icon name="spark" size={13} /> ANSWER</small><b>7.8<em>/10</em></b></div>
          </div>
        </div>
        <div className="cine-foot">
          <div className="hero-stats">
            <div><b>160</b><span>practice questions</span></div>
            <div><b>14</b><span>roles + 5 company styles</span></div>
            <div><b>100%</b><span>video stays on device</span></div>
          </div>
          <a className="scroll-cue" href="#how"><i /> Scroll</a>
        </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="marquee-track">{[0, 1].map((k) => <span key={k}>Eye contact <i>/</i> Filler words <i>/</i> Speaking pace <i>/</i> STAR answers <i>/</i> Follow-ups <i>/</i> Your resume <i>/</i> Your job description <i>/</i> Real numbers <i>/</i></span>)}</div></div>

      <section id="how" className="wide-sec">
        <div className="sec-head"><span className="idx">01</span><h2 className="display">One loop.<br />Three signals.<br /><span className="dim">Real numbers.</span></h2></div>
        <div className="bento">
          <div className="bcell b-a"><span className="bn">01</span><h3>Pick the room</h3><p>A role, a company style, a pasted job post or your own resume. The questions are written for that, not pulled from a generic list.</p>
            <div className="mini-tabs"><span>By role</span><span>By company</span><span className="on">Job description</span><span>My resume</span></div></div>
          <div className="bcell b-b"><span className="bn">02</span><h3>Just talk</h3><p>The interviewer speaks. You answer out loud. It listens, and moves on when you stop.</p><div className="cn-wave sm">{Array.from({ length: 28 }).map((_, i) => <i key={i} style={{ animationDelay: `${-i * 0.09}s` }} />)}</div></div>
          <div className="bcell b-c"><span className="bn">03</span><h3>Get the report</h3><p>Radar, per-answer fixes, a stronger sample answer, saved to your progress.</p></div>
          <div className="bcell b-d"><div className="big-n">478</div><p>face points tracked in your browser for eye contact and steadiness. Nothing is uploaded.</p></div>
          <div className="bcell b-e"><div className="big-n teal">0</div><p>paid APIs. Works free, with an optional AI coach for sharper feedback.</p></div>
        </div>
      </section>

      <section className="wide-sec" ref={fref}>
        <div className="sec-head"><span className="idx">02</span><h2 className="display">What happens<br /><span className="dim">in a session.</span></h2></div>
        <div className="features2">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`f2 ${fseen ? 'in' : ''}`} style={{ transitionDelay: `${i * 110}ms` }}>
              <span className="f2-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="f-ico"><Icon name={f.ico} size={22} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="finale">
        <h2 className="mega sm">Ten minutes.<br /><span className="ital">One honest report.</span></h2>
        <div className="hero-cta center"><Link className="btn btn-primary btn-lg" to="/practice">Set up my interview <Icon name="arrow" size={18} /></Link><Link className="btn btn-ghost btn-lg" to="/privacy">What happens to my data</Link></div>
      </section>

      <footer className="footer">
        <p>Face and voice analysis run on your device. Only scores and your answer text are saved, and you can delete any session from History.</p>
        <p className="muted small"><Link to="/practice">Practice</Link> · <Link to="/dashboard">Dashboard</Link> · <Link to="/history">History</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/install">Install app</Link></p>
      </footer>
    </main>
  )
}
