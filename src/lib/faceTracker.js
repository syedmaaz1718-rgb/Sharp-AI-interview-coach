import { FilesetResolver, FaceLandmarker, DrawingUtils } from '@mediapipe/tasks-vision'
import { frameFromMediaPipe, FaceAccumulator, isLookingAtCamera } from './faceMath.js'

let landmarkerPromise = null
async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      const make = (delegate) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        })
      try { return await make('GPU') } catch { return await make('CPU') }
    })().catch((e) => { landmarkerPromise = null; throw e })
  }
  return landmarkerPromise
}

export const preloadFace = () => getLandmarker().catch(() => {})

// Runs detection on a <video> at ~10 fps, draws a face mesh on the canvas, feeds an accumulator.
export class FaceTracker {
  constructor(video, canvas, onFrame) {
    this.video = video
    this.canvas = canvas
    this.onFrame = onFrame
    this.acc = new FaceAccumulator()
    this.recording = false
    this.running = false
    this.lastVideoTime = -1
    this.lastRun = 0
  }
  async start() {
    this.lm = await getLandmarker()
    this.running = true
    this.loop()
  }
  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    const ctx = this.canvas?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
  beginRecording() { this.acc.reset(); this.recording = true; this.t0 = performance.now() }
  endRecording() { this.recording = false; return this.acc.summary() }
  loop = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    const v = this.video
    const now = performance.now()
    if (!v || v.readyState < 2 || v.videoWidth === 0 || now - this.lastRun < 90 || v.currentTime === this.lastVideoTime) return
    this.lastRun = now
    this.lastVideoTime = v.currentTime
    let res
    try { res = this.lm.detectForVideo(v, now) } catch { return }
    const c = this.canvas
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight }
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    const lms = res.faceLandmarks?.[0]
    const frame = lms ? frameFromMediaPipe(res.faceBlendshapes?.[0]?.categories, res.facialTransformationMatrixes?.[0]?.data) : null
    if (lms) {
      const du = new DrawingUtils(ctx)
      const looking = frame && isLookingAtCamera(frame)
      const tint = looking ? '124,255,203' : '255,196,87'
      du.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: `rgba(${tint},0.16)`, lineWidth: 0.6 })
      du.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: `rgba(${tint},0.75)`, lineWidth: 1.6 })
      du.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: `rgba(${tint},0.9)`, lineWidth: 1.4 })
      du.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: `rgba(${tint},0.9)`, lineWidth: 1.4 })
      du.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: `rgba(${tint},0.7)`, lineWidth: 1.2 })
      du.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: 'rgba(120,200,255,0.95)', lineWidth: 1.4 })
      du.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: 'rgba(120,200,255,0.95)', lineWidth: 1.4 })
    }
    if (this.recording) this.acc.add((now - this.t0) / 1000, frame)
    this.onFrame?.({ detected: !!frame, frame, looking: frame ? isLookingAtCamera(frame) : false, summary: this.recording ? this.acc.summary() : null })
  }
}
