// Global tactile feedback: a pressed state and a soft ring at the touch point.
const SEL = 'button, a[href], [role="button"], [role="tab"], summary, label.switch, .clickable, input[type="checkbox"], input[type="radio"], select'
export function initFeel() {
  if (typeof document === 'undefined' || window.__feel) return
  window.__feel = true
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  let pressed = null
  const release = () => { if (pressed) { pressed.classList.remove('is-pressed'); pressed = null } }
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.(SEL)
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return
    pressed = el
    el.classList.add('is-pressed')
    if (reduce) return
    const r = document.createElement('span')
    r.className = 'tap-ring'
    r.style.left = e.clientX + 'px'
    r.style.top = e.clientY + 'px'
    document.body.appendChild(r)
    setTimeout(() => r.remove(), 600)
  }, { passive: true })
  ;['pointerup', 'pointercancel', 'dragend', 'blur'].forEach((t) => window.addEventListener(t, release, { passive: true }))
}
