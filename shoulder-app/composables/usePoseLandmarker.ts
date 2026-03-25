/**
 * usePoseLandmarker.ts
 *
 * Composable that handles the full MediaPipe Tasks Vision lifecycle:
 *   1. Loading the WASM runtime + model
 *   2. Managing the webcam stream
 *   3. Running inference on each animation frame
 *   4. Exposing reactive angle data to the Vue component
 *
 * Usage:
 *   const { isLoading, isRunning, angles, error, start, stop } = usePoseLandmarker(videoRef, canvasRef)
 */

import { ref, type Ref } from 'vue'
import type { ShoulderAngles, SessionFrame } from '~/types/pose'
import { PoseLandmark } from '~/types/pose'
import { calculateAbductionAngle, smoothAngle } from '~/utils/angleCalculations'

export function usePoseLandmarker(
  videoEl: Ref<HTMLVideoElement | null>,
  canvasEl: Ref<HTMLCanvasElement | null>
) {
  // ── State ──────────────────────────────────────────────────────────────────
  const isLoading = ref(false)
  const isRunning = ref(false)
  const error = ref<string | null>(null)

  const angles = ref<ShoulderAngles>({
    leftAbduction: null,
    rightAbduction: null,
    timestamp: 0,
  })

  // Recorded frames for the current session
  const sessionFrames = ref<SessionFrame[]>([])
  const isRecording = ref(false)

  // ── Internals ──────────────────────────────────────────────────────────────
  let poseLandmarker: any = null
  let animationFrameId: number | null = null
  let stream: MediaStream | null = null

  // Smoothed angle state carried between frames
  let smoothedLeft: number | null = null
  let smoothedRight: number | null = null

  // ── Skeleton drawing ───────────────────────────────────────────────────────
  const CONNECTIONS: [number, number][] = [
    [11, 12], // shoulder to shoulder
    [11, 13], [13, 15], // left arm
    [12, 14], [14, 16], // right arm
    [11, 23], [12, 24], // torso sides
    [23, 24], // hips
  ]

  function drawSkeleton(landmarks: any[], ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Connections
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 2
    for (const [a, b] of CONNECTIONS) {
      const lA = landmarks[a]
      const lB = landmarks[b]
      if (!lA || !lB) continue
      ctx.beginPath()
      ctx.moveTo(lA.x * w, lA.y * h)
      ctx.lineTo(lB.x * w, lB.y * h)
      ctx.stroke()
    }

    // Key joint dots
    const keyPoints = [
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
    ]
    for (const idx of keyPoints) {
      const lm = landmarks[idx]
      if (!lm) continue
      ctx.beginPath()
      ctx.arc(lm.x * w, lm.y * h, 6, 0, 2 * Math.PI)
      ctx.fillStyle = idx === PoseLandmark.LEFT_SHOULDER || idx === PoseLandmark.RIGHT_SHOULDER
        ? '#00e5ff'
        : '#ffffff'
      ctx.fill()
    }
  }

  function drawAngleLabel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    label: string,
    value: number | null
  ) {
    const text = value !== null ? `${label}: ${Math.round(value)}°` : `${label}: —`
    ctx.font = 'bold 16px monospace'
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(x - 4, y - 18, ctx.measureText(text).width + 8, 24)
    ctx.fillStyle = '#00e5ff'
    ctx.fillText(text, x, y)
  }

  // ── Main inference loop ────────────────────────────────────────────────────
  function renderLoop() {
    const video = videoEl.value
    const canvas = canvasEl.value
    if (!video || !canvas || !poseLandmarker) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    // Draw mirrored video frame
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -w, 0, w, h)
    ctx.restore()

    // Run pose detection (VIDEO mode = per-frame timestamp)
    const result = poseLandmarker.detectForVideo(video, performance.now())

    if (result.landmarks && result.landmarks.length > 0) {
      const lms = result.landmarks[0]

      // Mirror x coordinates to match the flipped video
      const mirrored = lms.map((lm: any) => ({ ...lm, x: 1 - lm.x }))

      drawSkeleton(mirrored, ctx, w, h)

      // Calculate raw angles
      const rawLeft = calculateAbductionAngle(
        mirrored[PoseLandmark.LEFT_HIP],
        mirrored[PoseLandmark.LEFT_SHOULDER],
        mirrored[PoseLandmark.LEFT_ELBOW]
      )
      const rawRight = calculateAbductionAngle(
        mirrored[PoseLandmark.RIGHT_HIP],
        mirrored[PoseLandmark.RIGHT_SHOULDER],
        mirrored[PoseLandmark.RIGHT_ELBOW]
      )

      // Smooth
      smoothedLeft = smoothAngle(smoothedLeft, rawLeft)
      smoothedRight = smoothAngle(smoothedRight, rawRight)

      angles.value = {
        leftAbduction: smoothedLeft,
        rightAbduction: smoothedRight,
        timestamp: Date.now(),
      }

      // Overlay angle labels near shoulders
      const ls = mirrored[PoseLandmark.LEFT_SHOULDER]
      const rs = mirrored[PoseLandmark.RIGHT_SHOULDER]
      if (ls) drawAngleLabel(ctx, ls.x * w, ls.y * h - 20, 'L Abd', smoothedLeft)
      if (rs) drawAngleLabel(ctx, rs.x * w - 100, rs.y * h - 20, 'R Abd', smoothedRight)

      // Record frame if active
      if (isRecording.value) {
        sessionFrames.value.push({
          angles: { ...angles.value },
          landmarks: mirrored,
        })
      }
    }

    animationFrameId = requestAnimationFrame(renderLoop)
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  async function start() {
    if (isRunning.value) return
    isLoading.value = true
    error.value = null

    try {
      // Dynamic import keeps the heavy WASM out of the initial bundle
      const vision = await import('@mediapipe/tasks-vision')
      const { PoseLandmarker, FilesetResolver } = vision

      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )

      poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      // Request camera
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })

      const video = videoEl.value!
      video.srcObject = stream
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => { video.play(); resolve() }
      })

      // Match canvas to video dimensions
      const canvas = canvasEl.value!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      isRunning.value = true
      animationFrameId = requestAnimationFrame(renderLoop)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to start camera or load model'
    } finally {
      isLoading.value = false
    }
  }

  function stop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    stream?.getTracks().forEach(t => t.stop())
    stream = null
    isRunning.value = false
  }

  function startRecording() {
    sessionFrames.value = []
    isRecording.value = true
  }

  function stopRecording(): SessionFrame[] {
    isRecording.value = false
    return [...sessionFrames.value]
  }

  return {
    isLoading,
    isRunning,
    isRecording,
    angles,
    sessionFrames,
    error,
    start,
    stop,
    startRecording,
    stopRecording,
  }
}