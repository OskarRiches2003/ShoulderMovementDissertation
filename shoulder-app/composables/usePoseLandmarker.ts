/**
 *
 * Handles the full MediaPipe lifecycle and uses reactive
 * angle data driven by whichever MovementConfig is currently active.
 *
 * The composable is movement-agnostic: it calls config.calculate() each
 * frame, so switching movements requires no changes here.
 * 
 */

import { ref, type Ref } from 'vue'
import type { MovementAngles, SessionFrame, MovementConfig } from '~/types/pose'
import { PoseLandmark } from '~/types/pose'
import { smoothAngle }  from '~/utils/angleCalculations'
import type { useMeasurement } from '~/composables/useMeasurement'
 
export function usePoseLandmarker(
  videoEl:      Ref<HTMLVideoElement | null>,
  canvasEl:     Ref<HTMLCanvasElement | null>,
  activeConfig: Ref<MovementConfig>,
  measurement:  ReturnType<typeof useMeasurement>,
) {
  const isLoading   = ref(false)
  const isRunning   = ref(false)
  const isRecording = ref(false)
  const error       = ref<string | null>(null)
 
  const angles        = ref<MovementAngles>({ left: null, right: null, timestamp: 0 })
  const sessionFrames = ref<SessionFrame[]>([])
 
  let poseLandmarker:   any                = null
  let animationFrameId: number | null      = null
  let stream:           MediaStream | null = null
  let smoothedLeft:     number | null      = null
  let smoothedRight:    number | null      = null
 
  function resetSmoothing() {
    smoothedLeft  = null
    smoothedRight = null
    angles.value  = { left: null, right: null, timestamp: 0 }
  }
 
  // ── Skeleton ───────────────────────────────────────────────────────────────
  const ALL_CONNECTIONS: [number, number][] = [
    [11, 12],
    [11, 13], [13, 15],
    [12, 14], [14, 16],
    [11, 23], [12, 24],
    [23, 24],
  ]
 
  // Joints belonging to each side (for dimming inactive side)
  const LEFT_JOINTS  = [PoseLandmark.LEFT_SHOULDER,  PoseLandmark.LEFT_ELBOW,  PoseLandmark.LEFT_WRIST,  PoseLandmark.LEFT_HIP]
  const RIGHT_JOINTS = [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST, PoseLandmark.RIGHT_HIP]
 
  // Connections that belong exclusively to one side
  const LEFT_CONNECTIONS:  [number, number][] = [[11, 13], [13, 15], [11, 23]]
  const RIGHT_CONNECTIONS: [number, number][] = [[12, 14], [14, 16], [12, 24]]
 
  function drawSkeleton(lms: any[], ctx: CanvasRenderingContext2D, w: number, h: number) {
    const active = activeConfig.value.activeSides
    const leftOn  = active.includes('left')
    const rightOn = active.includes('right')
 
    for (const [a, b] of ALL_CONNECTIONS) {
      if (!lms[a] || !lms[b]) continue
 
      // Dim connections that belong to the inactive side
      const isLeftConn  = LEFT_CONNECTIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
      const isRightConn = RIGHT_CONNECTIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
      const dimmed = (isLeftConn && !leftOn) || (isRightConn && !rightOn)
 
      ctx.strokeStyle = dimmed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)'
      ctx.lineWidth   = 2
      ctx.beginPath()
      ctx.moveTo(lms[a].x * w, lms[a].y * h)
      ctx.lineTo(lms[b].x * w, lms[b].y * h)
      ctx.stroke()
    }
 
    const allJoints = [...LEFT_JOINTS, ...RIGHT_JOINTS, PoseLandmark.NOSE]
    for (const idx of allJoints) {
      const lm = lms[idx]
      if (!lm) continue
 
      const isLeftJoint  = LEFT_JOINTS.includes(idx)
      const isRightJoint = RIGHT_JOINTS.includes(idx)
      const dimmed = (isLeftJoint && !leftOn) || (isRightJoint && !rightOn)
      const isShoulder = idx === PoseLandmark.LEFT_SHOULDER || idx === PoseLandmark.RIGHT_SHOULDER
 
      ctx.beginPath()
      ctx.arc(lm.x * w, lm.y * h, isShoulder ? 7 : 5, 0, 2 * Math.PI)
      ctx.fillStyle = dimmed
        ? 'rgba(255,255,255,0.12)'
        : isShoulder ? '#00e5ff' : 'rgba(255,255,255,0.7)'
      ctx.fill()
    }
  }
 
  function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, dimmed = false) {
    ctx.font = 'bold 15px monospace'
    const tw = ctx.measureText(text).width
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(x - 4, y - 17, tw + 8, 22)
    ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.25)' : '#00e5ff'
    ctx.fillText(text, x, y)
  }
 
  // ── Render loop ────────────────────────────────────────────────────────────
  function renderLoop() {
    const video  = videoEl.value
    const canvas = canvasEl.value
    if (!video || !canvas || !poseLandmarker) return
 
    const ctx = canvas.getContext('2d')
    if (!ctx) return
 
    const w      = canvas.width
    const h      = canvas.height
    const config = activeConfig.value
    const active = config.activeSides
 
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -w, 0, w, h)
    ctx.restore()
 
    const result = poseLandmarker.detectForVideo(video, performance.now())
 
    if (result.landmarks?.length > 0) {
      const lms = result.landmarks[0].map((lm: any) => ({ ...lm, x: 1 - lm.x }))
 
      drawSkeleton(lms, ctx, w, h)
 
      // Only calculate active sides — inactive sides stay null
      const rawLeft  = active.includes('left')  ? config.calculate(lms, 'left')  : null
      const rawRight = active.includes('right') ? config.calculate(lms, 'right') : null
 
      smoothedLeft  = active.includes('left')  ? smoothAngle(smoothedLeft,  rawLeft)  : null
      smoothedRight = active.includes('right') ? smoothAngle(smoothedRight, rawRight) : null
 
      angles.value = { left: smoothedLeft, right: smoothedRight, timestamp: Date.now() }
 
      // Feed measurement composable every frame
      measurement.update(smoothedLeft, smoothedRight, active, Date.now())
 
      // Draw on-canvas angle labels (dimmed for inactive side)
      const fmt = (v: number | null) => v !== null ? `${Math.round(v)}°` : '—'
      const ls  = lms[PoseLandmark.LEFT_SHOULDER]
      const rs  = lms[PoseLandmark.RIGHT_SHOULDER]
      if (ls) drawLabel(ctx, ls.x * w,      ls.y * h - 24, `L: ${fmt(smoothedLeft)}`,  !active.includes('left'))
      if (rs) drawLabel(ctx, rs.x * w - 90, rs.y * h - 24, `R: ${fmt(smoothedRight)}`, !active.includes('right'))
 
      if (isRecording.value) {
        sessionFrames.value.push({ movement: config.type, angles: { ...angles.value }, landmarks: lms })
      }
    }
 
    animationFrameId = requestAnimationFrame(renderLoop)
  }
 
  // ── Public API ─────────────────────────────────────────────────────────────
  async function start() {
    if (isRunning.value) return
    isLoading.value = true
    error.value     = null
 
    try {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
 
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      )
 
      poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'CPU',
        },
        runningMode:                'VIDEO',
        numPoses:                   1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence:  0.5,
        minTrackingConfidence:      0.5,
      })
 
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
 
      const video = videoEl.value!
      video.srcObject = stream
      await new Promise<void>(resolve => {
        video.onloadedmetadata = () => { video.play(); resolve() }
      })
 
      const canvas  = canvasEl.value!
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
 
      isRunning.value  = true
      animationFrameId = requestAnimationFrame(renderLoop)
    } catch (e: any) {
      console.error('Full error:', e)
      error.value = e?.message ?? 'Failed to start camera or load model'
    } finally {
      isLoading.value = false
    }
  }
 
  function stop() {
    if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null }
    stream?.getTracks().forEach(t => t.stop())
    stream          = null
    isRunning.value = false
    resetSmoothing()
  }
 
  function startRecording()                { sessionFrames.value = []; isRecording.value = true }
  function stopRecording(): SessionFrame[] { isRecording.value = false; return [...sessionFrames.value] }
 
  return {
    isLoading, isRunning, isRecording,
    angles, sessionFrames, error,
    start, stop, startRecording, stopRecording, resetSmoothing,
  }
}