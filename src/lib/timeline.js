// Per-answer timeline sampled while recording: powers the replay overlay. Pure and unit-tested.
export class TimelineRecorder {
  constructor(stepSec = 0.25) { this.step = stepSec; this.reset() }
  reset() { this.samples = []; this.fillers = []; this.last = -1 }
  add(t, { detected, looking, smile = 0, level = 0 }) {
    if (t - this.last < this.step) return
    this.last = t
    this.samples.push({ t: +t.toFixed(2), d: detected ? 1 : 0, e: detected && looking ? 1 : 0, s: +Math.min(1, smile).toFixed(2), l: +Math.min(1, level).toFixed(3) })
  }
  addFiller(t, word) {
    const prev = this.fillers[this.fillers.length - 1]
    if (prev && t - prev.t < 0.4) return
    this.fillers.push({ t: +t.toFixed(2), w: word || 'filler' })
  }
  export(durationSec) { return { duration: +durationSec.toFixed(2), samples: this.samples, fillers: this.fillers } }
}

// Find the sample active at time t (binary search)
export function sampleAt(timeline, t) {
  const a = timeline?.samples
  if (!a || !a.length) return null
  let lo = 0
  let hi = a.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (a[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  return a[lo]
}

// Segments of continuous eye contact / away for the timeline strip
export function eyeSegments(timeline) {
  const out = []
  const a = timeline?.samples || []
  for (let i = 0; i < a.length; i++) {
    const kind = !a[i].d ? 'none' : a[i].e ? 'eye' : 'away'
    const end = i + 1 < a.length ? a[i + 1].t : timeline.duration
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.end = end
    else out.push({ kind, start: a[i].t, end })
  }
  return out
}

export function eyePercent(timeline) {
  const a = (timeline?.samples || []).filter((s) => s.d)
  return a.length ? Math.round((a.filter((s) => s.e).length / a.length) * 100) : null
}

// Which filler word did the live transcript just add? (compare byWord maps)
export function newFillerWord(prevByWord, nextByWord) {
  for (const [w, n] of Object.entries(nextByWord)) if (n > (prevByWord[w] || 0)) return w
  return null
}
