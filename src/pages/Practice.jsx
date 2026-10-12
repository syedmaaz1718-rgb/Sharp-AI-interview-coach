import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { StartCard } from './Landing.jsx'
import { Link } from 'react-router-dom'
import { Hello, Icon } from '../components/ui.jsx'

export default function Practice() {
  const [cfg, setCfg] = useState(null)
  useEffect(() => { api.config().then(setCfg).catch(() => {}) }, [])
  return (
    <main className="page-wide">
      <header className="pg-head"><Hello /><span className="idx">PRACTICE</span><Link className="btn btn-outline" to="/arena"><Icon name="bolt" size={18} /> Battle Arena · 2-8 players</Link><h1 className="display">Set up your<br /><span className="dim">interview.</span></h1><p className="muted lede">The interviewer speaks each question and listens while you answer. Say it out loud, like the real thing. Typing stays available as a fallback.</p></header>
      <div className="pg">
        <div className="pg-main"><StartCard cfg={cfg} /></div>
        <aside className="rail">
          <div className="rail-card"><small>WHAT YOU GET</small><ul><li>Questions spoken aloud, hands-free</li><li>Live eye contact, pace and filler meters</li><li>Per-answer feedback and a stronger sample</li><li>A report you can save as PDF</li></ul></div>
          <div className="rail-card tilt"><small>TIP</small><p>Use Chrome or Edge, allow the mic and camera, and sit facing a light. Paste a job post to get role-specific questions.</p></div>
        </aside>
      </div>
    </main>
  )
}
