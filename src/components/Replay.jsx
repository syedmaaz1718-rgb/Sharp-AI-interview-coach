import { useEffect, useMemo, useRef, useState } from 'react'
import { getReplay } from '../lib/replayStore.js'
import { sampleAt, eyeSegments, eyePercent } from '../lib/timeline.js'
import { Icon } from './ui.jsx'

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Replays are stored in this browser only (IndexedDB). Shows the recorded answer with a metrics timeline.
export default function Replay({ sessionId, questionId }) {
  const [state, setState] = useState('loading') // loading | missing | ready | error
  const [rec, setRec] = useState(null)
  const [url, setUrl] = useState('')
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const vref = useRef(null)
  const stripRef = useRef(null)

  useEffect(() => {
    let dead = false
    let u = ''
    getReplay(sessionId, questionId).then((r) => {
      if (dead) return
      if (!r) return setState('missing')
      u = URL.createObjectURL(r.blob)
      setRec(r); setUrl(u); setDur(r.timeline?.duration || 0); setState('ready')
    }).catch(() => !dead && setState('error'))
    return () => { dead = true; if (u) URL.revokeObjectURL(u) }
  }, [sessionId, questionId])

  // MediaRecorder webm has no duration header: force the browser to compute it so seeking works.
  const onMeta = () => {
    const v = vref.current
    if (v && v.duration === Infinity) {
      const fix = () => { v.removeEventListener('timeupdate', fix); v.currentTime = 0 }
      v.addEventListener('timeupdate', fix)
      v.currentTime = 1e101
    }
  }

  const tl = rec?.timeline
  const segs = useMemo(() => (tl ? eyeSegments(tl) : []), [tl])
  const total = dur || tl?.duration || 1
  const cur = tl ? sampleAt(tl, t) : null
  const recentFiller = tl?.fillers?.find((f) => t >= f.t && t - f.t < 1.2)
  const pct = tl ? eyePercent(tl) : null

  const seek = (e) => {
    const r = stripRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    if (vref.current) { vref.current.currentTime = x * total; setT(x * total) }
  }

  if (state === 'loading') return <div className="replay-note">Looking for the replay on this device...</div>
  if (state !== 'ready') return <div className="replay-note"><Icon name="video" size={15} /> No replay on this device. Replays are saved in the browser that recorded the answer and are never uploaded.</div>

  const W = 1000
  const H = 70
  const x = (s) => (s / total) * W
  const levelPath = (tl.samples || []).map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${(H - 8 - s.l * 34).toFixed(1)}`).join(' ')

  return (
    <div className="replay">
      <div className="replay-video">
        <video ref={vref} src={url} controls playsInline preload="metadata" onLoadedMetadata={onMeta} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />
        <div className="replay-hud">
          <span className={`rchip ${!cur || !cur.d ? 'idle' : cur.e ? 'good' : 'warn'}`}><Icon name="eye" size={13} /> {!cur || !cur.d ? 'No face' : cur.e ? 'Eye contact' : 'Looking away'}</span>
          {cur?.d ? <span className="rchip idle"><Icon name="user" size={13} /> Smile {Math.round(cur.s * 100)}%</span> : null}
        </div>
        {recentFiller && <div className="replay-filler">"{recentFiller.w}"</div>}
      </div>
      <div className="strip" ref={stripRef} onClick={seek} role="slider" aria-label="Timeline" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(t)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <rect x="0" y="0" width={W} height="22" rx="4" fill="rgba(255,255,255,0.04)" />
          {segs.map((s, i) => <rect key={i} x={x(s.start)} y="2" width={Math.max(1, x(s.end) - x(s.start))} height="18" rx="3" className={`seg-${s.kind}`} />)}
          <path d={levelPath} fill="none" stroke="rgba(130,150,255,0.8)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          {(tl.fillers || []).map((f, i) => <line key={i} x1={x(f.t)} x2={x(f.t)} y1="26" y2={H} className="filler-tick" vectorEffect="non-scaling-stroke" />)}
          <line x1={x(t)} x2={x(t)} y1="0" y2={H} className="playhead" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="strip-legend">
        <span><i className="lg eye" /> eye contact</span>
        <span><i className="lg away" /> looking away</span>
        <span><i className="lg lvl" /> voice level</span>
        <span><i className="lg fil" /> filler word</span>
        <span className="grow" />
        <span>{mmss(t)} / {mmss(total)}</span>
      </div>
      <p className="replay-sum">
        {pct != null ? `Eye contact ${pct}% of the time. ` : 'No face data for this answer. '}
        {tl.fillers?.length ? `${tl.fillers.length} filler word${tl.fillers.length === 1 ? '' : 's'} at ${tl.fillers.slice(0, 6).map((f) => mmss(f.t)).join(', ')}${tl.fillers.length > 6 ? '...' : ''}.` : 'No filler words caught live.'}
        {' '}Click the timeline to jump.
      </p>
    </div>
  )
}
