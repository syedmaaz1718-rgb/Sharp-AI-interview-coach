// Ambient motion: cursor spotlight, scroll progress, card tilt, hero count-up. All skipped for reduced motion.
export function initFx() {
  if (typeof window === 'undefined' || window.__fx) return
  window.__fx = true
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const bar = document.createElement('div'); bar.className = 'scroll-bar'; document.body.appendChild(bar)
  const onScroll = () => { const h = document.documentElement; const m = h.scrollHeight - h.clientHeight; bar.style.transform = `scaleX(${m > 0 ? h.scrollTop / m : 0})` }
  addEventListener('scroll', onScroll, { passive: true }); onScroll()
  if (reduce) return
  const spot = document.createElement('div'); spot.className = 'spotlight'; document.body.appendChild(spot)
  let tx = innerWidth / 2, ty = innerHeight / 3, x = tx, y = ty
  addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY })
  const loop = () => { x += (tx - x) * 0.08; y += (ty - y) * 0.08; spot.style.transform = `translate3d(${x - 300}px,${y - 300}px,0)`; requestAnimationFrame(loop) }
  loop()
  // 3D tilt on cards
  addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.hero-card, .step, .stat, .sess')
    if (!el) return
    const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5; const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-py * 6).toFixed(2)}deg`); el.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(0)}%`); el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(0)}%`)
  })
  addEventListener('pointerout', (e) => { const el = e.target.closest?.('.hero-card, .step, .stat, .sess'); if (el && !el.contains(e.relatedTarget)) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') } })
}
export function countUp(root = document) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  root.querySelectorAll('.hero-stats b').forEach((el) => {
    const m = /^(\d+)(.*)$/.exec(el.textContent.trim()); if (!m || el.dataset.cu) return
    el.dataset.cu = '1'; const end = +m[1], suf = m[2]; const t0 = performance.now()
    const step = (t) => { const k = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(step) }
    requestAnimationFrame(step)
  })
}
