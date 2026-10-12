import { useEffect, useState } from 'react'

const KEY = 'coach_prefs_v2'
const DEFAULTS = { voice: true, handsFree: true, typeOnly: false, fillerAlert: 'beep', followUps: true, replay: true, lang: 'en', stress: false }

export function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...DEFAULTS } }
}
export function usePrefs() {
  const [prefs, setPrefs] = useState(loadPrefs)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch {} }, [prefs])
  const set = (k, v) => setPrefs((p) => ({ ...p, [k]: v }))
  return [prefs, set]
}

const RESUME_KEY = 'coach_resume_text'
export const loadResume = () => { try { return localStorage.getItem(RESUME_KEY) || '' } catch { return '' } }
export const saveResume = (t) => { try { t ? localStorage.setItem(RESUME_KEY, t) : localStorage.removeItem(RESUME_KEY) } catch {} }

export const LANGS = [['en', 'English'], ['hinglish', 'Hinglish'], ['hindi', 'हिन्दी']]
export const speechLang = (l) => (l === 'hindi' || l === 'hinglish' ? 'hi-IN' : 'en-IN')
