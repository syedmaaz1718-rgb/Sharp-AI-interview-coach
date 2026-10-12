import { useEffect, useRef, useState } from 'react'

export function useCountUp(target, ms = 1100, delay = 0) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (target == null) return
    let raf
    const t0 = performance.now() + delay
    const tick = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / ms))
      const e = 1 - Math.pow(1 - p, 3)
      setV(target * e)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, delay])
  return v
}

export function useMounted(delay = 30) {
  const [m, setM] = useState(false)
  useEffect(() => { const t = setTimeout(() => setM(true), delay); return () => clearTimeout(t) }, [delay])
  return m
}

export function useInView() {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (!('IntersectionObserver' in window)) { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen]
}
