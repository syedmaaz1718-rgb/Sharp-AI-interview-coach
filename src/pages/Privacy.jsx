import { Link } from 'react-router-dom'
import { Icon } from '../components/ui.jsx'

const ROWS = [
  ['video', 'Your video and audio', 'Never uploaded. Face tracking runs in your browser. Answer replays are recorded and kept in your browser storage, and you can delete them with the session.'],
  ['file', 'Your answers', 'The text of each answer, its scores and the report are saved on the server so you can open them later. Delete any session from History and it is removed.'],
  ['spark', 'The AI coach', 'When it is on, answer text (and resume or job description text if you use those modes) is sent to Groq to write feedback and questions. Video and audio are never sent.'],
  ['user', 'Sign-in', 'Google sign-in shares your name, email and photo. Without signing in, history is tied to a random id in this browser.'],
  ['chat', 'Speech', 'Speech to text uses your browser\'s built-in service when it has one (in Chrome that audio is processed by Google). In other browsers, such as Arc, Safari and Firefox, short audio clips are sent through our server to Groq Whisper for transcription and are not stored. Camera video never leaves your device. Typing avoids all of this.'],
]

export default function Privacy() {
  return (
    <main className="page-wide">
      <header className="pg-head"><span className="idx">PRIVACY</span><h1 className="display">What happens<br /><span className="dim">to your data.</span></h1><p className="muted lede">Short and specific. This is a practice tool, so we keep only what the report needs.</p></header>
      <div className="priv">
        {ROWS.map(([ico, t, d]) => (
          <div key={t} className="priv-row glass"><span className="f-ico"><Icon name={ico} size={20} /></span><div><b>{t}</b><p>{d}</p></div></div>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 22 }}><Link className="btn btn-primary" to="/practice">Start practising</Link></div>
    </main>
  )
}
