// Face metrics from MediaPipe Face Landmarker output. Pure functions, unit-tested.
const deg = (r) => (r * 180) / Math.PI

// matrix: 16 numbers, column-major 4x4 facial transformation matrix.
export function headPose(m) {
  if (!m || m.length < 16) return null
  const r02 = m[8]
  const r12 = m[9]
  const r22 = m[10]
  const yaw = deg(Math.atan2(r02, r22))
  const pitch = deg(Math.atan2(-r12, Math.sqrt(r02 * r02 + r22 * r22)))
  return { yaw, pitch }
}

// categories: [{categoryName, score}] -> map
export function blendMap(categories) {
  const o = {}
  for (const c of categories || []) o[c.categoryName] = c.score
  return o
}

export function gaze(b) {
  const g = (k) => b[k] || 0
  const gx = (g('eyeLookOutLeft') - g('eyeLookInLeft') + g('eyeLookInRight') - g('eyeLookOutRight')) / 2
  const gy = (g('eyeLookUpLeft') + g('eyeLookUpRight') - g('eyeLookDownLeft') - g('eyeLookDownRight')) / 2
  return { gx, gy }
}

export function frameFromMediaPipe(blend, matrix) {
  const b = blendMap(blend)
  const pose = headPose(matrix)
  if (!pose) return null
  const { gx, gy } = gaze(b)
  return {
    yaw: pose.yaw,
    pitch: pose.pitch,
    gx,
    gy,
    smile: ((b.mouthSmileLeft || 0) + (b.mouthSmileRight || 0)) / 2,
    brow: ((b.browDownLeft || 0) + (b.browDownRight || 0)) / 2,
  }
}

export function isLookingAtCamera(f) {
  return Math.abs(f.yaw) <= 22 && Math.abs(f.pitch) <= 20 && Math.abs(f.gx) <= 0.32 && Math.abs(f.gy) <= 0.3
}

export class FaceAccumulator {
  constructor() { this.reset() }
  reset() {
    this.total = 0
    this.detected = 0
    this.eye = 0
    this.smile = 0
    this.browSum = 0
    this.motion = 0
    this.motionTime = 0
    this.prev = null
  }
  // t in seconds; frame null when no face was found
  add(t, frame) {
    this.total++
    if (!frame) { this.prev = null; return }
    this.detected++
    if (isLookingAtCamera(frame)) this.eye++
    if (frame.smile > 0.3) this.smile++
    this.browSum += frame.brow
    if (this.prev) {
      const dt = t - this.prev.t
      if (dt > 0 && dt < 1) {
        const step = (a, b) => { const d = Math.abs(a - b); return d < 0.4 ? 0 : Math.min(d, 30) }
        this.motion += step(frame.yaw, this.prev.yaw) + step(frame.pitch, this.prev.pitch)
        this.motionTime += dt
      }
    }
    this.prev = { t, yaw: frame.yaw, pitch: frame.pitch }
  }
  summary() {
    const d = this.detected
    return {
      frames: this.total,
      detectedRatio: this.total ? d / this.total : 0,
      eyeContactRatio: d ? this.eye / d : 0,
      smileRatio: d ? this.smile / d : 0,
      browMean: d ? this.browSum / d : 0,
      headMotion: this.motionTime ? this.motion / this.motionTime : 0,
    }
  }
}
