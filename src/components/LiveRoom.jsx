import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui.jsx'
import { AudioMeter } from '../lib/audioMeter.js'
import { pickMime, startRecorder } from '../lib/replayStore.js'

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Camera and mic for the interviewer's room: self view, live level, and an optional recording that stays on this device.
export default function LiveRoom({ name }) {
  const [state, setState] = useState('idle') // idle | on | denied | none
  const [stream, setStream] = useState(null)
  const [rec, setRec] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [clip, setClip] = useState(null)
  const [levels, setLevels] = useState(new Array(24).fill(0))
  const vref = useRef(null); const rr = useRef(null); const meter = useRef(null); const t0 = useRef(0)

  const enable = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      setStream(s); setState('on')
    } catch (e) {
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); setStream(s); setState('on') } catch (e2) { setState(e?.name === 'NotAllowedError' || e2?.name === 'NotAllowedError' ? 'denied' : 'none') }
    }
  }
  useEffect(() => {
    if (!stream) return
    if (vref.current && stream.getVideoTracks().length) { vref.current.srcObject = stream; vref.current.play().catch(() => {}) }
    let m = null; let id = null
    try { m = new AudioMeter(stream); meter.current = m; id = setInterval(() => setLevels(m.bars(24)), 90) } catch {}
    return () => { clearInterval(id); m?.close(); meter.current = null }
  }, [stream])
  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()) }, [stream])
  useEffect(() => { if (!rec) return; const id = setInterval(() => setElapsed((performance.now() - t0.current) / 1000), 500); return () => clearInterval(id) }, [rec])
  useEffect(() => () => { if (clip?.url) URL.revokeObjectURL(clip.url) }, [clip])

  const start = () => {
    if (clip?.url) URL.revokeObjectURL(clip.url)
    setClip(null)
    rr.current = startRecorder(stream)
    if (!rr.current) return
    t0.current = performance.now(); setElapsed(0); setRec(true)
  }
  const stop = async () => {
    setRec(false)
    const r = await rr.current?.stop(); rr.current = null
    if (r) setClip({ url: URL.createObjectURL(r.blob), ext: r.mime.includes('mp4') ? 'mp4' : 'webm', size: r.blob.size })
  }
  const canRec = !!pickMime() && !!stream?.getVideoTracks().length
  const hasVideo = !!stream?.getVideoTracks().length

  return (
    <div className={`glass room ${rec ? 'is-rec' : ''}`}>
      <div className="room-view">
        <video ref={vref} muted playsInline autoPlay className={hasVideo ? 'show' : ''} />
        {!hasVideo && (
          <div className="stage-empty">
            <div className={`avatar ${state === 'denied' ? 'is-bad' : ''}`}><Icon name={state === 'denied' ? 'shield' : state === 'on' ? 'mic' : 'video'} size={28} /></div>
            <b className="se-title">{state === 'idle' ? 'Interview room' : state === 'denied' ? 'Camera and mic are blocked' : state === 'none' ? 'No camera or mic found' : 'Camera off, mic on'}</b>
            <p>{state === 'idle' ? 'Turn on the camera and mic to see the room and keep a recording for your notes. Nothing is uploaded.' : state === 'denied' ? 'Allow them from the lock icon in the address bar, then try again. You can still type notes.' : state === 'none' ? 'Plug in a camera or mic, or type what the candidate says.' : 'Voice capture still works without a camera.'}</p>
          </div>
        )}
        {rec && <div className="rec-badge"><i /> REC {mmss(elapsed)}</div>}
      </div>
      <div className="room-bar">
        <div className="room-lv" aria-hidden="true">{levels.map((v, k) => <i key={k} style={{ '--l': Math.min(1, v * 1.6).toFixed(2) }} />)}</div>
        <div className="room-btns">
          {state === 'idle' || state === 'denied' || state === 'none'
            ? <button className="btn btn-primary btn-sm" onClick={enable}><Icon name="video" size={15} /> {state === 'idle' ? 'Turn on camera and mic' : 'Try again'}</button>
            : rec ? <button className="btn btn-danger btn-sm" onClick={stop}>Stop recording</button>
              : <button className="btn btn-ghost btn-sm" onClick={start} disabled={!canRec} title={canRec ? '' : 'Recording needs a camera and browser support'}><Icon name="replay" size={15} /> Record this interview</button>}
          {clip && <a className="btn btn-ghost btn-sm" href={clip.url} download={`interview-${(name || 'candidate').replace(/\W+/g, '-').toLowerCase()}.${clip.ext}`}>Download ({(clip.size / 1048576).toFixed(1)} MB)</a>}
        </div>
      </div>
      {rec && <p className="muted small room-note">Recording stays on this device. Tell the candidate you are recording and get their consent first.</p>}
    </div>
  )
}
