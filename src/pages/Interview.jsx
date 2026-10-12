import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { api, clientId as getClientId } from '../lib/api.js'
import { FaceTracker, preloadFace } from '../lib/faceTracker.js'
import { AudioMeter } from '../lib/audioMeter.js'
import { useLeaveGuard } from '../lib/leaveGuard.js'
import LeaveDialog from '../components/LeaveDialog.jsx'
import { makeDictation, useDictate, useVoiceMode, voiceErrorText } from '../lib/dictate.js'
import { countFillers, tokenize } from '../lib/analysis.js'
import { usePrefs, LANGS, speechLang } from '../lib/prefs.js'
import { speak, stopSpeaking, ttsSupported, loadVoices } from '../lib/tts.js'
import { softTick } from '../lib/beep.js'
import { TimelineRecorder, newFillerWord } from '../lib/timeline.js'
import { startRecorder, saveReplay, pickMime } from '../lib/replayStore.js'
import { Logo, Ring, MetricBar, Waveform, Chip, Spinner, Icon, roleLabel } from '../components/ui.jsx'

const MAX_SEC = 120
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const FILLER_MODES = ['off', 'flash', 'beep']
const FILLER_LABEL = { off: 'Off', flash: 'Flash', beep: 'Flash + tick' }

export default function Interview() {
  const [params] = useSearchParams()
  const loc = useLocation()
  const nav = useNavigate()
  const role = params.get('role') || 'general'
  const pack = params.get('pack') || null
  const mode = params.get('mode') || (pack ? 'pack' : 'role')
  const custom = loc.state?.custom || null
  const count = Number(params.get('count')) || 7

  const [prefs, setPref] = usePrefs()
  const [phase, setPhase] = useState('setup') // setup | ready | countdown | recording | settling | review | analyzing | feedback | finishing
  const [error, setError] = useState('')
  const [cfg, setCfg] = useState(null)
  const [dev, setDev] = useState({ cam: 'idle', mic: 'idle' })
  const [stream, setStream] = useState(null)
  const [meter, setMeter] = useState(null)
  const vm = useVoiceMode()
  const [speechFailed, setSpeechFailed] = useState(false)
  const [sttState, setSttState] = useState('idle')
  const speechState = speechFailed ? 'failed' : vm.available ? 'ok' : 'unsupported'
  const [session, setSession] = useState(null)
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState([])
  const [live, setLive] = useState({ detected: false, looking: false, summary: null })
  const [speaking, setSpeaking] = useState(false)
  const [asking, setAsking] = useState(false) // interviewer voice active
  const [elapsed, setElapsed] = useState(0)
  const [count3, setCount3] = useState(3)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [replayNote, setReplayNote] = useState('')
  const [rewindOpen, setRewindOpen] = useState(false)
  const [flash, setFlash] = useState({ n: 0, word: '' })

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const trackerRef = useRef(null)
  const speechRef = useRef(null)
  const metricsRef = useRef({})
  const t0 = useRef(0)
  const recognized = useRef('')
  const liveRef = useRef({ detected: false, looking: false, smile: 0 })
  const tlRef = useRef(new TimelineRecorder())
  const recRef = useRef(null)
  const recPromise = useRef(null)
  const prevFillers = useRef({})
  const lastFlashAt = useRef(0)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  useEffect(() => { api.config().then(setCfg).catch(() => {}); preloadFace(); loadVoices() }, [])
  useEffect(() => { if ((mode === 'resume' || mode === 'jd' || mode === 'company') && !custom) nav('/', { replace: true }) }, [mode, custom, nav])

  // ---- devices ----
  const enableDevices = useCallback(async () => {
    setError('')
    let s = null
    let cam = 'ok'
    let mic = 'ok'
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch (e1) {
      try { s = await navigator.mediaDevices.getUserMedia({ audio: true }); cam = e1.name === 'NotAllowedError' ? 'denied' : 'off' } catch (e2) {
        try { s = await navigator.mediaDevices.getUserMedia({ video: true }); mic = e2.name === 'NotAllowedError' ? 'denied' : 'off' } catch { cam = 'denied'; mic = 'denied' }
      }
    }
    if (!s) { setDev({ cam, mic }); setError('Camera and microphone are blocked. Click the lock icon in the address bar, allow both, then press Enable again. You can also continue without them and type your answers.'); return }
    if (!s.getVideoTracks().length) cam = cam === 'ok' ? 'off' : cam
    if (!s.getAudioTracks().length) mic = mic === 'ok' ? 'off' : mic
    setStream(s)
    setDev({ cam, mic })
  }, [])

  useEffect(() => {
    if (!stream) return
    const v = videoRef.current
    if (v && stream.getVideoTracks().length) { v.srcObject = stream; v.play().catch(() => {}) }
    let m = null
    if (stream.getAudioTracks().length) { try { m = new AudioMeter(stream); setMeter(m) } catch {} }
    return () => { m?.close(); setMeter(null) }
  }, [stream])

  useEffect(() => {
    if (!stream || !stream.getVideoTracks().length) return
    const tr = new FaceTracker(videoRef.current, canvasRef.current, (f) => {
      liveRef.current = { detected: f.detected, looking: f.looking, smile: f.frame?.smile || 0 }
      setLive(f)
    })
    trackerRef.current = tr
    tr.start().catch(() => { setDev((d) => ({ ...d, cam: d.cam === 'ok' ? 'nomodel' : d.cam })) })
    return () => { tr.stop(); trackerRef.current = null }
  }, [stream])

  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); speechRef.current?.stop(); stopSpeaking() }, [stream])
  useEffect(() => () => stopSpeaking(), [])

  const skipDevices = () => { setDev({ cam: 'off', mic: 'off' }) }

  // ---- session ----
  const begin = async () => {
    setError('')
    try {
      const s = await api.startSession({ role, count, pack: pack || undefined, custom: mode === 'resume' || mode === 'jd' || mode === 'company' ? custom : undefined, lang: prefs.lang, stress: prefs.stress })
      setSession(s)
      setIdx(0)
      setResults([])
      setPhase('ready')
    } catch (e) { setError(e.message) }
  }

  const q = session?.questions[idx]
  const typedMode = prefs.typeOnly || speechState !== 'ok' || dev.mic !== 'ok'
  const hf = !typedMode && prefs.handsFree && prefs.voice && ttsSupported()
  const hfRef = useRef(false)
  hfRef.current = hf
  const lastVoice = useRef(0)
  const lastTextLen = useRef(0)
  const [holdAuto, setHoldAuto] = useState(false)
  const [fuSpoken, setFuSpoken] = useState('')
  const canRecordVideo = prefs.replay && !!stream && dev.cam === 'ok' && !!pickMime()

  // ---- interviewer voice ----
  useEffect(() => {
    if (phase !== 'ready' || !q) return
    if (!prefs.voice || !ttsSupported()) return
    // a follow-up that was already spoken the moment it appeared is not read twice
    if (q.id === fuSpoken) { const t0 = setTimeout(() => { if (hfRef.current) startRecording(true) }, 500); return () => clearTimeout(t0) }
    let cancel = () => {}
    let dead = false
    const t = setTimeout(async () => {
      cancel = await speak(q.text, { lang: session?.lang || 'en', onStart: () => !dead && setAsking(true), onEnd: (ok) => { if (dead) return; setAsking(false); if (ok && hfRef.current) startRecording(true) } })
    }, 450)
    return () => { dead = true; clearTimeout(t); cancel(); setAsking(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q?.id, prefs.voice])

  const replayQuestion = async () => { if (!q) return; stopSpeaking(); setAsking(true); await speak(q.text, { lang: session?.lang || 'en', onEnd: () => setAsking(false) }) }

  // ---- recording ----
  const startRecording = (instant = false) => {
    stopSpeaking(); setAsking(false)
    setFinalText(''); setInterim(''); recognized.current = ''; setElapsed(0); setCount3(instant === true ? 0 : 3); setPhase('countdown')
  }
  useEffect(() => {
    if (phase !== 'countdown') return
    if (count3 <= 0) { actuallyStart(); return }
    const t = setTimeout(() => setCount3((c) => c - 1), 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count3])

  const actuallyStart = () => {
    trackerRef.current?.beginRecording()
    meter?.beginRecording()
    tlRef.current.reset()
    prevFillers.current = {}
    if (canRecordVideo) recRef.current = startRecorder(stream)
    else recRef.current = null
    if (!typedMode) {
      setSpeechFailed(false)
      const sp = makeDictation(vm, {
        lang: speechLang(session?.lang || prefs.lang),
        stream,
        onText: (f, i) => { recognized.current = f; setFinalText(f); setInterim(i) },
        onError: () => setSpeechFailed(true),
        onState: setSttState,
      })
      speechRef.current = sp
      sp.start()
    }
    t0.current = performance.now()
    lastVoice.current = performance.now(); lastTextLen.current = 0
    setPhase('recording')
  }

  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => {
      const e = (performance.now() - t0.current) / 1000
      setElapsed(e)
      const level = meter ? meter.rms() : 0
      if (meter) setSpeaking(level > 0.012)
      tlRef.current.add(e, { ...liveRef.current, level: Math.min(1, level * 6) })
      if (e >= MAX_SEC) stopRecording()
      if (hfRef.current) {
        const nowMs = performance.now()
        const tl = recognized.current.length
        if (level > 0.02 || tl !== lastTextLen.current) { lastVoice.current = nowMs; lastTextLen.current = tl }
        const words = tokenize(recognized.current).length
        if (words >= 4 && nowMs - lastVoice.current > 3200) stopRecording()
        else if (words < 2 && e > 14) stopRecording()
      }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, meter])

  // live filler alert: fires only when the filler count goes UP, at most every 1.2 s
  const liveText = (finalText + ' ' + interim).trim()
  const liveFillerData = useMemo(() => countFillers(liveText), [liveText])
  useEffect(() => {
    if (phase !== 'recording') return
    const word = newFillerWord(prevFillers.current, liveFillerData.byWord)
    prevFillers.current = { ...liveFillerData.byWord }
    if (!word) return
    const e = (performance.now() - t0.current) / 1000
    tlRef.current.addFiller(e, word)
    const mode = prefsRef.current.fillerAlert
    const now = performance.now()
    if (mode === 'off' || now - lastFlashAt.current < 1200) return
    lastFlashAt.current = now
    setFlash((f) => ({ n: f.n + 1, word }))
    if (mode === 'beep') softTick()
  }, [liveFillerData, phase])

  const stopRecording = () => {
    const dur = Math.max(1, (performance.now() - t0.current) / 1000)
    const face = dev.cam === 'ok' ? trackerRef.current?.endRecording() : null
    const voice = meter ? meter.endRecording() : null
    speechRef.current?.stop()
    recPromise.current = recRef.current ? recRef.current.stop() : Promise.resolve(null)
    metricsRef.current = { durationSec: dur, face, voice, timeline: tlRef.current.export(dur) }
    setSpeaking(false)
    const sp = speechRef.current
    Promise.race([new Promise((r) => setTimeout(r, 450)), Promise.resolve()]).then(() => sp?.finish?.()).then(() => {
      const spoken = (sp?.text || recognized.current || '').trim()
      setReviewText((prev) => (spoken ? spoken : typedMode ? prev : ''))
      setPhase('review')
      if (hfRef.current && tokenize(spoken).length >= 4) submit(spoken)
    })
    setPhase('settling')
  }

  const submit = async (override) => {
    const text = (typeof override === 'string' ? override : reviewText).trim()
    if (tokenize(text).length < 3) { setError('Write or say at least a few words first.'); return }
    setError('')
    setPhase('analyzing')
    const spokenWords = tokenize(recognized.current).length
    const m = metricsRef.current
    try {
      const r = await api.answer(session.id, {
        questionId: q.id,
        transcript: text,
        durationSec: m.durationSec,
        input: spokenWords >= 5 ? 'speech' : 'typed',
        wantFollowUp: prefs.followUps,
        metrics: { face: m.face, voice: m.voice },
      })
      setLastResult(r)
      setResults((rs) => [...rs, { id: q.id, score: r.answerScore }])
      // keep the answer video locally for the replay view
      setReplayNote('')
      try {
        const rec = await recPromise.current
        if (rec?.blob && rec.blob.size > 2000) {
          const out = await saveReplay({ sessionId: session.id, questionId: q.id, blob: rec.blob, mime: rec.mime, timeline: m.timeline, question: q.text })
          setReplayNote(out.ok ? 'Replay saved on this device.' : `Replay not saved (${out.reason}).`)
        } else if (canRecordVideo) setReplayNote('Replay not saved (recording was empty).')
      } catch { setReplayNote('Replay not saved.') }
      recPromise.current = null
      setHoldAuto(false)
      setPhase('feedback')
    } catch (e) { setError(e.message); setPhase('review') }
  }

  // spoken conversation: after feedback the interviewer says a short line and moves on (unless held)
  useEffect(() => {
    if (phase !== 'feedback' || !hf || holdAuto || !lastResult) return
    const lastQ = !lastResult.followUp && idx + 1 >= session.questions.length
    let cancelled = false
    const fu = lastResult.followUp
    const voiceOn = prefs.voice && ttsSupported()
    if (fu && voiceOn && fuSpoken !== fu.id) return // wait until the follow-up has been spoken
    const line = lastQ ? 'That was my last question. Let me put your report together.' : fu ? '' : ['Got it, thanks.', 'Okay, noted.', 'Thanks, that is clear.'][idx % 3]
    if (line) speak(line, { lang: session?.lang || 'en' })
    const t = setTimeout(() => { if (!cancelled) next(true) }, lastQ ? 4200 : fu ? (voiceOn ? 700 : 4800) : 3600)
    return () => { cancelled = true; clearTimeout(t); if (!fu) stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hf, holdAuto, lastResult, fuSpoken])

  // the AI interviewer asks the follow-up out loud the moment it appears
  useEffect(() => {
    const fu = lastResult?.followUp
    if (phase !== 'feedback' || !fu || !prefs.voice || !ttsSupported()) return
    let dead = false
    speak(fu.text, { lang: session?.lang || 'en', onStart: () => !dead && setAsking(true), onEnd: (ok) => { if (dead) return; setAsking(false); if (ok) setFuSpoken(fu.id) } })
    const cap = setTimeout(() => { if (!dead) setFuSpoken(fu.id) }, 30000)
    return () => { dead = true; clearTimeout(cap); setAsking(false); if (fuSpokenRef.current !== fu.id) stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lastResult?.followUp?.id, prefs.voice])
  const fuSpokenRef = useRef(''); fuSpokenRef.current = fuSpoken

  const redo = () => { setReviewText(''); setFinalText(''); setInterim(''); recognized.current = ''; setPhase('ready'); setError('') }

  const next = async (takeFollowUp = true) => {
    setRewindOpen(false)
    if (takeFollowUp && lastResult?.followUp) {
      const fu = lastResult.followUp
      setSession((s) => ({ ...s, questions: [...s.questions.slice(0, idx + 1), fu, ...s.questions.slice(idx + 1).filter((x) => x.id !== fu.id)] }))
      setIdx(idx + 1); setLastResult(null); setPhase('ready'); return
    }
    if (idx + 1 < session.questions.length) { setIdx(idx + 1); setLastResult(null); setPhase('ready'); return }
    await finish()
  }
  // Leaving a running interview submits what was answered so far.
  const started = !!session && !['setup', 'finishing'].includes(phase)
  const [leaveAsk, setLeaveAsk] = useState(false)
  const guard = useLeaveGuard({ active: started, onBack: () => autoRef.current(), beacon: session && results.length ? { url: `/api/sessions/${session.id}/finish`, body: { clientId: getClientId(), early: true } } : null })
  const autoRef = useRef(() => {})
  autoRef.current = () => leaveNow()
  const phaseRef = useRef(phase); phaseRef.current = phase
  const resRef = useRef(0); resRef.current = results.length
  const leaveNow = async () => {
    if (!started) return
    setLeaveAsk(false)
    for (let n = 0; n < 40 && phaseRef.current === 'analyzing'; n++) await new Promise((r) => setTimeout(r, 200))
    speechRef.current?.stop(); stopSpeaking(); trackerRef.current?.stop?.()
    try { recRef.current?.stop() } catch {}
    if (!resRef.current) { guard.release(); stream?.getTracks().forEach((t) => t.stop()); nav('/', { replace: true }); return }
    await finish(true)
  }
  const finish = async (early = false) => {
    setPhase('finishing'); setError('')
    try {
      const rep = await api.finish(session.id, early === true)
      guard.release()
      stream?.getTracks().forEach((t) => t.stop())
      nav(`/report/${rep.id}`, { state: { report: rep, fresh: true } })
    } catch (e) { setError(e.message); setPhase('feedback') }
  }
  const skipQuestion = async () => {
    if (idx + 1 < session.questions.length) { setIdx(idx + 1); setPhase('ready') }
    else if (results.length) await finish()
    else setError('Answer at least one question to get a report.')
  }

  // ---- live HUD ----
  const liveWords = tokenize(liveText).length
  const wpm = elapsed > 8 && liveWords > 4 ? Math.round((liveWords / elapsed) * 60) : null
  const eyePct = live.summary ? Math.round(live.summary.eyeContactRatio * 100) : null
  const faceOn = dev.cam === 'ok' && stream
  const recording = phase === 'recording'
  const isFollowUp = q?.category === 'followup'
  const title = pack ? roleLabel('pack:' + pack) : mode === 'company' ? (loc.state?.label || 'Company interview') : mode === 'jd' ? 'Role-specific interview' : mode === 'resume' ? 'Resume interview' : roleLabel(role)

  return (
    <div className="studio">
      <LeaveDialog open={leaveAsk} answered={results.length} busy={phase === 'finishing'} onStay={() => setLeaveAsk(false)} onLeave={leaveNow} />
      <header className="studio-top">
        <Logo />
        {session && (
          <div className="progress" aria-label={`Question ${idx + 1} of ${session.questions.length}`}>
            {session.questions.map((x, i) => <span key={x.id} className={`pdot ${x.category === 'followup' ? 'fu' : ''} ${i < idx || (i === idx && ['feedback', 'finishing'].includes(phase)) ? 'done' : i === idx ? 'cur' : ''}`} />)}
            <b>{idx + 1}/{session.questions.length}</b>
          </div>
        )}
        {started ? <button className="btn btn-sm btn-ghost" onClick={() => setLeaveAsk(true)}>Exit</button> : <Link to="/" className="btn btn-sm btn-ghost">Exit</Link>}
      </header>

      {['ready', 'countdown', 'recording', 'settling', 'analyzing'].includes(phase) && q && (
        <section className={`hero-q ${asking ? 'speaking' : ''} ${phase === 'recording' ? 'listening' : ''} ${phase === 'analyzing' ? 'thinking' : ''} ${isFollowUp ? 'is-fu' : ''}`} key={'hq' + q.id} aria-live="polite">
          <div className="hq-meta">
            <div className={`orb-ai big ${asking ? 'talking' : ''} ${phase === 'recording' ? 'listening' : ''} ${phase === 'analyzing' ? 'thinking' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <div className="hq-who">
              <b>{isFollowUp ? (session?.stress ? 'Pushback' : 'Follow-up') : session?.stress ? 'Tough interviewer' : 'Interviewer'}</b>
              <small>{asking ? 'Speaking...' : phase === 'recording' ? 'Listening...' : phase === 'analyzing' ? 'Thinking about your answer...' : isFollowUp ? 'Digging into your last answer' : q.category}</small>
            </div>
            {session?.stress && <span className="stress-tag">Stress mode</span>}{session?.lang && session.lang !== 'en' && <span className="stress-tag lang">{session.lang === 'hindi' ? 'हिन्दी' : 'Hinglish'}</span>}
            <span className="hq-count">{isFollowUp ? 'Follow-up' : `Question ${session.questions.slice(0, idx + 1).filter((x) => x.category !== 'followup').length}`}</span>
            {phase === 'ready' && ttsSupported() && (
              <button className="icon-btn" onClick={replayQuestion} title="Hear the question again" aria-label="Hear the question again"><Icon name="volume" size={17} /></button>
            )}
          </div>
          <h2 className="hq-text">{q.text}</h2>
          {phase === 'ready' && <p className="hq-tip"><Icon name="bulb" size={15} /> {q.tip}</p>}
        </section>
      )}

      <div className="studio-grid">
        {/* ---------- stage ---------- */}
        <section className={`stage glass ${recording ? 'is-rec' : ''} ${faceOn && live.detected ? (live.looking ? 'eye-on' : 'eye-off') : ''}`}>
          <div className={`stage-video ${flash.n && recording ? 'flash-' + (flash.n % 2) : ''}`} data-flash={flash.n}>
            <video ref={videoRef} muted playsInline autoPlay className={faceOn ? 'show' : ''} />
            <canvas ref={canvasRef} className={faceOn ? 'show' : ''} />
            {!faceOn && (
              <div className="stage-empty">
                <div className={`avatar ${dev.cam === 'denied' ? 'is-bad' : ''}`}><Icon name={dev.cam === 'idle' ? 'video' : dev.cam === 'denied' ? 'shield' : 'eye'} size={34} active={dev.cam !== 'idle' && dev.cam !== 'denied'} /></div>
                <b className="se-title">{dev.cam === 'idle' ? 'Camera preview' : dev.cam === 'denied' ? 'Camera access is blocked' : dev.cam === 'nomodel' ? 'Face model unavailable' : 'Camera off'}</b>
                <p>{dev.cam === 'idle' ? 'Enable your camera to see yourself here. Nothing leaves your device.' : dev.cam === 'denied' ? 'Allow the camera from the lock icon in the address bar. You can also continue without it.' : dev.cam === 'nomodel' ? 'The face model could not load, so eye contact and expression scores are skipped. Answer scoring is unaffected.' : 'No camera found, so eye contact and expression scores are skipped. Answer scoring is unaffected.'}</p>
                {phase === 'setup' && !stream && dev.cam !== 'idle' && <button className="btn btn-ghost btn-sm" onClick={enableDevices}>Try again</button>}
              </div>
            )}
            {faceOn && !live.detected && phase !== 'finishing' && <div className="stage-warn">No face detected. Sit facing the light and the camera.</div>}
            {recording && <div className="rec-badge"><i /> REC {mmss(elapsed)} <small>/ {mmss(MAX_SEC)}</small>{recRef.current && <em title="Saving a replay on this device">replay</em>}</div>}
            {phase === 'countdown' && <div className="countdown" key={count3}>{count3 > 0 ? count3 : 'Go'}</div>}
            {faceOn && recording && (
              <div className="hud">
                <Chip icon={<Icon name="eye" size={16} />} label="Eye contact" value={eyePct == null ? '-' : `${eyePct}%`} state={!live.detected ? 'idle' : live.looking ? 'good' : 'warn'} />
                <Chip icon={<Icon name="user" size={16} />} label="Smile" value={live.summary ? `${Math.round(live.summary.smileRatio * 100)}%` : '-'} state="idle" />
              </div>
            )}
            {recording && (
              <div className="hud hud-r">
                <Chip icon={<Icon name="chart" size={16} />} label="Pace" value={wpm ? `${wpm} wpm` : '...'} state={wpm == null ? 'idle' : wpm > 175 || wpm < 95 ? 'warn' : 'good'} />
                <Chip icon={<Icon name="chat" size={16} />} label="Fillers" value={liveFillerData.total} state={liveFillerData.total > 3 ? 'warn' : 'idle'} />
              </div>
            )}
            {recording && flash.n > 0 && <div className="filler-toast" key={flash.n}>Filler: "{flash.word}"</div>}
          </div>
          <div className="stage-wave">
            <Waveform meter={meter} active={!!meter} speaking={speaking} />
            <div className="wave-meta">
              {dev.mic === 'ok' ? (recording ? (speaking ? 'Listening' : 'Quiet') : 'Mic ready') : 'Mic off'}
            </div>
          </div>
        </section>

        {/* ---------- side panel ---------- */}
        <aside className="side">
          {phase === 'setup' && (
            <div className="panel glass fade-up">
              <span className="eyebrow">{title} · {custom && (mode === 'resume' || mode === 'jd' || mode === 'company') ? custom.length + 1 : count} questions</span>
              <h2>Check your setup</h2>
              <ul className="checks">
                <li className={dev.cam === 'ok' ? 'ok' : dev.cam === 'idle' ? '' : 'bad'}><i />Camera {dev.cam === 'ok' ? (live.detected ? 'on, face detected' : 'on, looking for your face') : dev.cam === 'idle' ? 'not enabled yet' : dev.cam === 'denied' ? 'blocked in browser settings' : 'not found'}</li>
                <li className={dev.mic === 'ok' ? 'ok' : dev.mic === 'idle' ? '' : 'bad'}><i />Microphone {dev.mic === 'ok' ? 'on, say something to see the waveform' : dev.mic === 'idle' ? 'not enabled yet' : dev.mic === 'denied' ? 'blocked in browser settings' : 'not found'}</li>
                <li className={speechState === 'ok' ? 'ok' : 'warn'}><i />Speech to text {vm.loading ? 'checking...' : speechState === 'ok' ? (vm.mode === 'server' ? 'on, server transcription works in any browser' : 'on, browser dictation') : 'unavailable here, you will type'}</li>
                <li className={cfg?.llm ? 'ok' : 'neutral'}><i />AI coach {cfg == null ? '...' : cfg.llm ? 'on (answer text goes to Groq)' : 'off, built-in scoring only'}</li>
              </ul>
              {phase === 'setup' && (dev.cam !== 'idle' || speechState !== 'ok' || prefs.typeOnly) && typedMode && (
                <div className="typed-note"><span className="tn-ico"><Icon name="file" size={18} /></span><div><b>Typed interview mode</b><p>{dev.mic === 'denied' ? 'Microphone is blocked, so you will type your answers.' : speechState !== 'ok' ? 'Voice is not available in this browser, so you will type your answers.' : 'You will type your answers.'} Questions, follow-ups, scoring and the report work exactly the same. Voice delivery metrics are skipped. For spoken answers, open SharpAI in Chrome or Edge.</p></div></div>
              )}
              <div className="prefs">
                <div className="lang-row" role="radiogroup" aria-label="Interview language"><span><Icon name="chat" size={16} /> Interview language</span><div className="seg">{LANGS.map(([k, l]) => <button key={k} role="radio" aria-checked={prefs.lang === k} className={prefs.lang === k ? 'on' : ''} onClick={() => setPref('lang', k)}>{l}</button>)}</div></div>
                <Toggle icon="bolt" label="Stress mode" on={prefs.stress} onChange={(v) => setPref('stress', v)} hint="A tough interviewer pushes back on every answer. Stay calm and back your claims." />
                <Toggle icon="volume" label="Interviewer reads questions aloud" on={prefs.voice && ttsSupported()} disabled={!ttsSupported()} onChange={(v) => setPref('voice', v)} hint={ttsSupported() ? '' : 'Not supported in this browser'} />
                <Toggle icon="mic" label="Hands-free conversation" on={prefs.handsFree && !typedMode} disabled={!ttsSupported() || !prefs.voice || typedMode} onChange={(v) => setPref('handsFree', v)} hint={typedMode ? 'Needs a microphone and voice dictation' : 'I ask, you speak, and I move on when you pause'} />
                <Toggle icon="file" label="Type my answers instead" on={prefs.typeOnly} onChange={(v) => setPref('typeOnly', v)} hint="Voice is the default. Typing is a fallback." />
                <Toggle icon="chat" label="Follow-up questions" on={prefs.followUps} onChange={(v) => setPref('followUps', v)} hint={cfg && !cfg.llm ? 'Reacts to what you say. The AI coach (Groq key) makes them sharper.' : 'Reacts to what you just said'} />
                <Toggle icon="video" label="Save answer replays on this device" on={prefs.replay && !!pickMime()} disabled={!pickMime()} onChange={(v) => setPref('replay', v)} hint={pickMime() ? '' : 'Recording is not supported here'} />
                <div className="toggle">
                  <span className="t-ico"><Icon name="bell" size={16} /></span>
                  <span className="t-label">Live filler alert<small>Flashes when you say um, uh, like</small></span>
                  <div className="seg seg-sm" role="radiogroup" aria-label="Filler alert">
                    {FILLER_MODES.map((m) => <button key={m} role="radio" aria-checked={prefs.fillerAlert === m} className={prefs.fillerAlert === m ? 'on' : ''} onClick={() => { setPref('fillerAlert', m); if (m === 'beep') softTick() }}>{FILLER_LABEL[m]}</button>)}
                  </div>
                </div>
              </div>
              <div className="rules-note"><Icon name="shield" size={16} /><span><b>Once you start, you cannot go back.</b> Leaving, pressing back or closing the page submits the interview with the questions you have answered so far.</span></div>
              {error && <div className="alert">{error}</div>}
              <div className="btn-row">
                {!stream && dev.cam === 'idle' ? (
                  <>
                    <button className="btn btn-primary btn-lg" onClick={enableDevices}>Enable camera and mic</button>
                    <button className="btn btn-ghost" onClick={skipDevices}>Continue without</button>
                  </>
                ) : (
                  <button className="btn btn-primary btn-lg" onClick={begin}>Start interview <Icon name="arrow" size={18} /></button>
                )}
              </div>
              {!stream && dev.cam !== 'idle' && <button className="btn btn-ghost" onClick={enableDevices}>Try enabling again</button>}
            </div>
          )}

          {['ready', 'countdown', 'recording', 'settling'].includes(phase) && q && (
            <div className="panel glass fade-up" key={q.id}>

              {phase === 'ready' && (
                <>
                  {typedMode && <div className="alert soft">{speechState === 'ok' ? 'No microphone, ' : 'Speech to text is not available here, '}so you will type your answer. Face metrics still run while you type.</div>}
                  {error && <div className="alert">{error}</div>}
                  <div className="btn-row">
                    <button className="btn btn-primary btn-lg pulse" onClick={() => startRecording()}><span className="rdot" /> {typedMode ? 'Start answer' : 'Start answering'}</button>
                    <button className="btn btn-ghost" onClick={skipQuestion}>Skip</button>
                  </div>
                </>
              )}
              {phase === 'countdown' && <p className="muted">Get comfortable and look at the camera lens.</p>}
              {phase === 'recording' && (
                <>
                  {typedMode ? (
                    <textarea className="ta" autoFocus value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Type your answer here as if you were saying it out loud..." rows={7} />
                  ) : (
                    <div className="live-text" aria-live="polite">
                      {liveText ? <>{finalText}{interim && <span className="interim"> {interim}</span>}</> : <span className="muted">{vm.mode === 'server' ? 'Start talking. Your words appear every few seconds.' : 'Start talking and your words appear here.'}</span>}{vm.mode === 'server' && sttState === 'transcribing' && <span className="interim"> ...</span>}
                    </div>
                  )}
                  {speechState === 'failed' && <div className="alert soft">Speech recognition stopped working (browser or network). You can type your answer after you stop.</div>}
                  <div className="btn-row">
                    <button className="btn btn-danger btn-lg" onClick={stopRecording}><span className="sq" /> Done answering</button>
                  </div>
                </>
              )}
              {phase === 'settling' && <Spinner text="Wrapping up..." />}
            </div>
          )}

          {phase === 'review' && q && (
            <div className="panel glass fade-up">
              <span className="eyebrow">Review your answer</span>
              <h2 className="question sm">{q.text}</h2>
              <p className="muted small">{typedMode ? 'Check your answer before it is scored.' : 'Speech recognition makes mistakes, so fix anything that is wrong. Leave filler words in - they are counted from this text.'}</p>
              <textarea className="ta" value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={8} placeholder="Nothing was heard. Type your answer here." />
              <div className="muted small">{tokenize(reviewText).length} words · {Math.round(metricsRef.current.durationSec || 0)}s</div>
              {error && <div className="alert">{error}</div>}
              <div className="btn-row">
                <button className="btn btn-primary btn-lg" onClick={submit}>Score my answer</button>
                <button className="btn btn-ghost" onClick={redo}>Re-record</button>
              </div>
            </div>
          )}

          {phase === 'analyzing' && (
            <div className="panel glass fade-up center">
              <Thinking steps={prefs.followUps ? ['Reading your answer', 'Checking structure and detail', 'Looking for something to dig into', 'Writing a follow-up'] : ['Reading your answer', 'Checking structure and detail', 'Scoring']} />
            </div>
          )}

          {phase === 'feedback' && lastResult && (
            <Feedback onRewind={q.category !== 'followup' ? () => { setHoldAuto(true); setRewindOpen(true) } : null} r={lastResult} last={idx + 1 >= session.questions.length && !lastResult.followUp} onNext={() => next(true)} onSkipFollowUp={() => next(false)} error={error} replayNote={replayNote} followUpsOn={prefs.followUps} auto={hf && !holdAuto} onHold={() => setHoldAuto(true)} />
          )}

          {phase === 'feedback' && rewindOpen && <Rewind key={q.id} sessionId={session.id} q={q} lang={session.lang} onClose={() => setRewindOpen(false)} />}

          {phase === 'finishing' && (
            <div className="panel glass fade-up center"><Spinner text="Building your report..." /></div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Toggle({ icon, label, on, onChange, disabled, hint }) {
  return (
    <div className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <span className="t-ico"><Icon name={icon} size={16} active={on && !disabled} /></span>
      <span className="t-label">{label}{hint && <small>{hint}</small>}</span>
      <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}><i /></button>
    </div>
  )
}

function Thinking({ steps }) {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 1600); return () => clearInterval(t) }, [steps.length])
  return (
    <div className="thinking" role="status">
      <div className="dots"><i /><i /><i /></div>
      <p key={i} className="fade-up">{steps[i]}...</p>
    </div>
  )
}

function Feedback({ r, last, onNext, onSkipFollowUp, error, replayNote, followUpsOn, auto, onHold, onRewind }) {
  const a = r.analysis
  const s = a.scores
  const [open, setOpen] = useState(false)
  return (
    <div className="panel glass fade-up">
      <div className="fb-head">
        <Ring value={r.answerScore} size={108} stroke={9} label="answer" />
        <div>
          <h2>{r.answerScore >= 7.5 ? 'Strong answer' : r.answerScore >= 5.5 ? 'Decent, can be sharper' : 'Needs work'}</h2>
          <p className="muted small">{a.words} words{a.wpm ? ` · ${a.wpm} wpm` : ''}{a.fillers.total ? ` · ${a.fillers.total} filler${a.fillers.total === 1 ? '' : 's'}` : ' · no fillers'}</p>
          {replayNote && <p className="muted small"><Icon name="video" size={13} /> {replayNote}</p>}
        </div>
      </div>
      <div className="fb-bars">
        <MetricBar label="Delivery (voice)" value={s.voice} />
        <MetricBar label="Presence (face)" value={s.face} />
        <MetricBar label="Content" value={s.content} delay={80} />
      </div>
      {r.llm && (
        <div className="llm">
          <div className="llm-h"><span><Icon name="spark" size={15} /> AI coach</span> <b>{r.llm.score}/10</b></div>
          {r.llm.strengths.map((t, i) => <p key={i} className="good">+ {t}</p>)}
          {r.llm.improvements.map((t, i) => <p key={i} className="fix">- {t}</p>)}
          {r.llm.sample && (
            <>
              <button className="link" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} a stronger sample answer</button>
              {open && <blockquote>{r.llm.sample}</blockquote>}
            </>
          )}
        </div>
      )}
      {a.tips.slice(0, 3).map((t, i) => <p key={i} className={`tip-line a-${t.area}`}><span>{t.area}</span>{t.text}</p>)}
      {r.followUp && (
        <div className="fu-card">
          <span className="eyebrow">Interviewer has a follow-up</span>
          <p>"{r.followUp.text}"</p>
        </div>
      )}
      {!r.followUp && r.followUpNote && followUpsOn && <p className="muted small note-line">{r.followUpNote}</p>}
      {error && <div className="alert">{error}</div>}
      <div className="btn-row">
        {auto && <div className="auto-note"><span className="auto-bar" /> Moving on in a moment <button className="btn btn-ghost btn-sm" onClick={onHold}>Stay here</button></div>}
        <button className="btn btn-primary btn-lg" onClick={onNext}>{r.followUp ? 'Answer the follow-up' : last ? 'Finish and see report' : 'Next question'} <Icon name="arrow" size={18} /></button>
        {r.followUp && <button className="btn btn-ghost" onClick={onSkipFollowUp}>Skip follow-up</button>}
        {onRewind && <button className="btn btn-ghost" onClick={onRewind}><Icon name="replay" size={16} /> Try this again</button>}
      </div>
    </div>
  )
}

function Rewind({ sessionId, q, lang, onClose }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState(null)
  const dict = useDictate({ lang: speechLang(lang), onText: (f, i) => setText([f, i].filter(Boolean).join(' ')) })
  const rec = dict.rec
  const t0 = useRef(performance.now())
  const mode = useRef('typed')
  const dictate = () => { if (!rec) mode.current = 'speech'; dict.toggle() }
  const go = async () => {
    const spoken = rec ? await dict.stop() : ''
    setBusy(true); setErr('')
    try {
      setRes(await api.rewind(sessionId, { questionId: q.id, transcript: spoken || text, input: mode.current, durationSec: Math.max(1, Math.round((performance.now() - t0.current) / 1000)) }))
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  const again = () => { setRes(null); setText(''); mode.current = 'typed'; t0.current = performance.now() }
  return (
    <div className="panel glass fade-up rewind">
      <span className="eyebrow"><Icon name="replay" size={14} /> Rewind</span>
      <h3>{res ? 'Attempt ' + res.attempt + ' vs attempt 1' : 'Same question, second try'}</h3>
      {!res && (
        <>
          <p className="muted small">{q.text}</p>
          <textarea className="ta" rows={6} value={text} disabled={busy} placeholder="Answer it again, using the feedback above" onChange={(e) => { setText(e.target.value); if (mode.current === 'speech' && !rec) mode.current = 'typed' }} />
          {err && <div className="alert">{err}</div>}
          <div className="btn-row">
            {dict.available && <button className={`btn ${rec ? 'btn-danger' : 'btn-ghost'}`} onClick={dictate} disabled={busy}><Icon name="mic" size={16} /> {rec ? 'Stop' : dict.pending ? 'Transcribing...' : 'Answer by voice'}</button>}
            {dict.err && <div className="alert soft" role="alert">{dict.err}</div>}
            <button className="btn btn-primary" onClick={go} disabled={busy || text.trim().length < 5}>{busy ? 'Comparing...' : 'Compare with my first answer'}</button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
      {res && (
        <>
          <div className={`delta ${res.verdict === 'improved' ? 'up' : res.verdict === 'declined' ? 'down' : ''}`}>
            <span>{res.before}<small>/10</small></span><i><Icon name="arrow" size={22} /></i><span>{res.after}<small>/10</small></span>
            <b>{res.delta > 0 ? '+' : ''}{res.delta}</b>
          </div>
          <p className="muted">{res.summary}</p>
          {res.gains.map((t, i) => <p key={i} className="good">+ {t}</p>)}
          {res.losses.map((t, i) => <p key={i} className="fix">- {t}</p>)}
          {res.tips?.map((t, i) => <p key={i} className="tip-line"><span>{t.area}</span>{t.text}</p>)}
          <p className="muted small">Your interview score keeps your first attempt. This comparison is for practice.</p>
          <div className="btn-row"><button className="btn btn-primary" onClick={onClose}>Done</button><button className="btn btn-ghost" onClick={again}>Try once more</button></div>
        </>
      )}
    </div>
  )
}
