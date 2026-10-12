import { useEffect, useRef } from 'react'

// While an interview is running: browser back is trapped and ends the interview (the answers so far are
// submitted), and reload/close shows the browser's leave prompt and sends the early finish when the page goes away.
export function useLeaveGuard({ active, onBack, beacon }) {
  const live = useRef({}); live.current = { onBack, beacon }
  const released = useRef(false)
  useEffect(() => {
    if (!active) return
    released.current = false
    history.pushState({ sharpTrap: 1 }, '', location.href)
    const pop = () => {
      if (released.current) return
      history.pushState({ sharpTrap: 1 }, '', location.href)
      live.current.onBack?.()
    }
    const before = (e) => { if (released.current) return; e.preventDefault(); e.returnValue = '' }
    const hide = () => {
      const b = live.current.beacon
      if (released.current || !b) return
      try { navigator.sendBeacon(b.url, new Blob([JSON.stringify(b.body)], { type: 'application/json' })) } catch {}
    }
    window.addEventListener('popstate', pop)
    window.addEventListener('beforeunload', before)
    window.addEventListener('pagehide', hide)
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('beforeunload', before); window.removeEventListener('pagehide', hide) }
  }, [active])
  return { release: () => { released.current = true } }
}
