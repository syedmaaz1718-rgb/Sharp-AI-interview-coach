import { useEffect, useRef } from 'react'
import { Icon } from './ui.jsx'

export default function LeaveDialog({ open, answered, busy, onStay, onLeave }) {
  const stay = useRef(null)
  useEffect(() => {
    if (!open) return
    stay.current?.focus()
    const k = (e) => { if (e.key === 'Escape') onStay() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onStay])
  if (!open) return null
  return (
    <div className="leave-back" role="presentation" onClick={onStay}>
      <div className="leave-card glass" role="alertdialog" aria-modal="true" aria-labelledby="lv-t" aria-describedby="lv-d" onClick={(e) => e.stopPropagation()}>
        <span className="leave-ico"><Icon name="shield" size={22} /></span>
        <h3 id="lv-t">{answered ? 'Leave and submit your interview?' : 'Leave the interview?'}</h3>
        <p id="lv-d" className="muted">{answered
          ? `Leaving ends the interview. Your ${answered} answered question${answered > 1 ? 's are' : ' is'} submitted and scored. The answer you are giving right now is not counted, and you cannot come back to it.`
          : 'You have not answered a question yet, so there is nothing to score. Leaving ends this interview without a report.'}</p>
        <div className="btn-row">
          <button ref={stay} className="btn btn-primary" onClick={onStay} disabled={busy}>Keep going</button>
          <button className="btn btn-ghost" onClick={onLeave} disabled={busy}>{busy ? 'Submitting...' : answered ? 'Submit and leave' : 'Leave'}</button>
        </div>
      </div>
    </div>
  )
}
