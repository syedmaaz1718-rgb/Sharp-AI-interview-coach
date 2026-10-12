import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { scoreCardSvg } from '../lib/scoreCard.js'
import { Icon } from './ui.jsx'

function downloadPng(svg, name) {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = 1200; c.height = 630
    c.getContext('2d').drawImage(img, 0, 0, 1200, 630)
    c.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b); a.download = name; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    }, 'image/png')
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// The SharpAI Score badge: computed on the server from the real report, shareable as a public link and a PNG.
export default function ScorePanel({ id, owner = true }) {
  const [card, setCard] = useState(null)
  const [err, setErr] = useState('')
  const [actErr, setActErr] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const num = useRef(null)

  useEffect(() => { api.score(id).then((c) => { setCard(c); setName(c.name || '') }).catch((e) => setErr(e.message)) }, [id])
  useEffect(() => {
    if (!card || !num.current) return
    let raf; const t0 = performance.now()
    const tick = (t) => { const k = Math.min(1, (t - t0) / 1100); const e = 1 - Math.pow(1 - k, 3); if (num.current) num.current.textContent = Math.round(card.score * e); if (k < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [card?.score])

  if (err) return null
  if (!card) return <section className="score-panel glass"><div className="sp-skel" /></section>
  const url = card.token ? `${window.location.origin}/s/${card.token}` : ''
  const svg = scoreCardSvg({ ...card, name })
  const share = async (enable = true) => {
    setBusy(true)
    try { const r = await api.share(id, { enable, name }); setCard((c) => ({ ...c, shared: r.shared, token: r.token || null, name })) } catch (e) { setActErr(e.message) }
    setBusy(false)
  }
  const copy = async () => { try { await navigator.clipboard.writeText(url) } catch { window.prompt('Copy this link', url) } setCopied(true); setTimeout(() => setCopied(false), 1800) }
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  return (
    <section className="score-panel glass">
      <div className="sp-left">
        <span className="pill"><i className="dot" /> SharpAI Score</span>
        <div className="sp-num"><b ref={num}>0</b><span>/100</span></div>
        <div className="sp-band"><Icon name="star" size={18} /> {card.band}{card.mode === 'stress' && <em>Stress mode</em>}{card.lang !== 'en' && <em>{card.lang === 'hindi' ? 'हिन्दी' : 'Hinglish'}</em>}</div>
        <ul className="sp-dims">
          {card.dims.map((d) => <li key={d.key}><span>{d.label}</span><div className="bar"><i style={{ '--w': d.score + '%' }} /></div><b>{d.score}</b></li>)}
        </ul>
        <p className="muted small">Built from your real answers: content, voice, presence, consistency and how you handled follow-ups. Parts that were not measured are left out, not guessed.</p>
      </div>
      <div className="sp-right">
        <div className="sp-card" dangerouslySetInnerHTML={{ __html: svg }} />
        {owner && (
          <div className="sp-actions">
            <label className="sp-name"><span>Name on the card (optional)</span><input className="input" value={name} maxLength={40} placeholder="Your name" onChange={(e) => setName(e.target.value)} /></label>
            <div className="sp-btns">
              {!card.shared ? <button className="btn btn-primary" disabled={busy} onClick={() => share(true)}><Icon name="link" size={16} /> Create share link</button> : (
                <>
                  <button className="btn btn-primary" onClick={copy}><Icon name="link" size={16} /> {copied ? 'Copied' : 'Copy link'}</button>
                  <a className="btn btn-ghost" href={li} target="_blank" rel="noreferrer"><Icon name="share" size={16} /> Share on LinkedIn</a>
                  <button className="btn btn-ghost" disabled={busy} onClick={() => share(true)}>Update name</button>
                  <button className="btn btn-ghost" disabled={busy} onClick={() => share(false)}>Turn off link</button>
                </>
              )}
              <button className="btn btn-ghost" onClick={() => downloadPng(svg, 'sharpai-score.png')}><Icon name="file" size={16} /> Download PNG</button>
              <a className="btn btn-ghost" href={`/api/sessions/${id}/score.pdf${name.trim() ? '?name=' + encodeURIComponent(name.trim()) : ''}`} download="sharpai-score.pdf"><Icon name="file" size={16} /> Download PDF</a>
            </div>
            {actErr && <div className="alert">{actErr}</div>}
            {card.shared && <p className="muted small sp-url">{url}</p>}
            <p className="muted small">The link shows only the score, the five bars, your optional name and the role. Never your answers, video or audio.</p>
          </div>
        )}
      </div>
      <Passport id={id} defaultName={name} owner={owner} />
    </section>
  )
}

function Passport({ id, defaultName, owner }) {
  const [p, setP] = useState(undefined)
  const [name, setName] = useState(defaultName || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (owner) api.passportGet(id).then((r) => setP(r.token ? r : null)).catch(() => setP(null)) }, [id, owner])
  useEffect(() => { if (defaultName && !name) setName(defaultName) }, [defaultName])
  if (!owner || p === undefined) return null
  const url = p ? `${window.location.origin}${p.path}` : ''
  const issue = async () => { setBusy(true); setErr(''); try { setP(await api.passportIssue(id, name.trim())) } catch (e) { setErr(e.message) } setBusy(false) }
  const revoke = async () => { setBusy(true); try { await api.passportRevoke(id); setP(null) } catch (e) { setErr(e.message) } setBusy(false) }
  const copy = async () => { try { await navigator.clipboard.writeText(url) } catch { window.prompt('Copy this link', url) } setCopied(true); setTimeout(() => setCopied(false), 1800) }
  return (
    <div className="passport">
      <div className="pp-h"><span className="f-ico"><Icon name="shield" size={18} /></span>
        <div><b>Skill Passport</b><p className="muted small">A signed, timestamped page with your score, breakdown and skills. No answers, video or audio. It is an AI-verified practice interview, not an employer credential.</p></div></div>
      {!p ? (
        <div className="pp-form">
          <input className="input" value={name} maxLength={40} placeholder="Name to print on the passport" onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || name.trim().length < 2} onClick={issue}>{busy ? 'Issuing...' : 'Issue my passport'}</button>
        </div>
      ) : (
        <div className="pp-form">
          <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
          <button className="btn btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          <a className="btn btn-ghost" href={p.path} target="_blank" rel="noreferrer">Open</a>
          <button className="btn btn-ghost" disabled={busy} onClick={revoke}>Turn off</button>
        </div>
      )}
      {err && <div className="alert">{err}</div>}
    </div>
  )
}
