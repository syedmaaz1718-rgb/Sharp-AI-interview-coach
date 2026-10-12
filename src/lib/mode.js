import { useSyncExternalStore } from 'react'
// Two-sided product: 'candidate' (practice) or 'interviewer' (recruiter tools). Chosen on the login screen, switchable anytime.
const KEY = 'sharpai_mode'
const subs = new Set()
export const getMode = () => { try { return localStorage.getItem(KEY) === 'interviewer' ? 'interviewer' : 'candidate' } catch { return 'candidate' } }
export const setMode = (m) => { try { localStorage.setItem(KEY, m) } catch {} subs.forEach((f) => f()) }
export function useMode() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, getMode, () => 'candidate')
}
export const homeFor = (m) => (m === 'interviewer' ? '/recruiter' : '/')
