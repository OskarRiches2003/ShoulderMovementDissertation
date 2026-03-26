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
import { smoothAngle } from '~/utils/angleCalculations'

export function usePoseLandmarker(
  videoEl:      Ref<HTMLVideoElement | null>,
  canvasEl:     Ref<HTMLCanvasElement | null>,
  activeConfig: Ref<MovementConfig>,
) {
  // ── State ──────────────────────────────────────────────────────────────────
  const isLoading   = ref(false)
  const isRunning   = ref(false)
  const isRecording = ref(false)
  const error       = ref<string | null>(null)

  const angles        = ref<MovementAngles>({ left: null, right: null, timestamp: 0 })
  const sessionFrames = ref<SessionFrame[]>([])

  // ── Internals ──────────────────────────────────────────────────────────────
  let poseLandmarker:   any                = null
  let animationFrameId: number | null      = null
  let stream:           MediaStream | null = null

  let smoothedLeft:  number | null = null
  let smoothedRight: number | null = null

  // Reset smoothing when movement type switches so stale values don't bleed through
  function resetSmoothing() {
    smoothedLeft  = null
    smoothedRight = null
    angles.value  = { left: null, right: null, timestamp: 0 }
  }

  // ── Skeleton drawing ───────────────────────────────────────────────────────
  const CONNECTIONS: [number, number][] = [
    [11, 12],
    [11, 13], [13, 15],
    [12, 14], [14, 16],
    [11, 23], [12, 24],
    [23, 24],
  ]

  function drawSkeleton(lms: any[], ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth   = 2
    for (const [a, b] of CONNECTIONS) {
      if (!lms[a] || !lms[b]) continue
      ctx.beginPath()
      ctx.moveTo(lms[a].x * w, lms[a].y * h)
      ctx.lineTo(lms[b].x * w, lms[b].y * h)
      ctx.stroke()
    }
    const keyJoints = [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW,    PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_HIP,      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_WRIST,    PoseLandmark.RIGHT_WRIST,
    ]
    for (const idx of keyJoints) {
      const lm = lms[idx]
      if (!lm) continue
      const isShoulder = idx === PoseLandmark.LEFT_SHOULDER || idx === PoseLandmark.RIGHT_SHOULDER
      ctx.beginPath()
      ctx.arc(lm.x * w, lm.y * h, isShoulder ? 7 : 5, 0, 2 * Math.PI)
      ctx.fillStyle = isShoulder ? '#00e5ff' : 'rgba(255,255,255,0.7)'
      ctx.fill()
    }
  }

  function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
    ctx.font      = 'bold 15px monospace'
    const tw      = ctx.measureText(text).width
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x - 4, y - 17, tw + 8, 22)
    ctx.fillStyle = '#00e5ff'
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

    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -w, 0, w, h)
    ctx.restore()

    const result = poseLandmarker.detectForVideo(video, performance.now())

    if (result.landmarks?.length > 0) {
      const lms = result.landmarks[0].map((lm: any) => ({ ...lm, x: 1 - lm.x }))

      drawSkeleton(lms, ctx, w, h)

      const rawLeft  = config.calculate(lms, 'left')
      const rawRight = config.calculate(lms, 'right')

      smoothedLeft  = smoothAngle(smoothedLeft,  rawLeft)
      smoothedRight = smoothAngle(smoothedRight, rawRight)

      angles.value = { left: smoothedLeft, right: smoothedRight, timestamp: Date.now() }

      const fmt = (v: number | null) => v !== null ? `${Math.round(v)}°` : '—'
      const ls  = lms[PoseLandmark.LEFT_SHOULDER]
      const rs  = lms[PoseLandmark.RIGHT_SHOULDER]
      if (ls) drawLabel(ctx, ls.x * w,      ls.y * h - 24, `L: ${fmt(smoothedLeft)}`)
      if (rs) drawLabel(ctx, rs.x * w - 90, rs.y * h - 24, `R: ${fmt(smoothedRight)}`)

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
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )

      poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
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
      await new Promise<void>(resolve => { video.onloadedmetadata = () => { video.play(); resolve() } })

      const canvas  = canvasEl.value!
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight

      isRunning.value  = true
      animationFrameId = requestAnimationFrame(renderLoop)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to start camera or load model'
    } finally {
      isLoading.value = false
    }
  }

  function stop() {
    if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null }
    stream?.getTracks().forEach(t => t.stop())
    stream       = null
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