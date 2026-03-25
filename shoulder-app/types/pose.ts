// Landmark indices used from MediaPipe Pose (33-point model)
export enum PoseLandmark {
  NOSE = 0,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
}

export interface Landmark {
  x: number // normalised 0–1
  y: number // normalised 0–1
  z: number // depth, normalised
  visibility?: number // 0–1 confidence
}

export interface ShoulderAngles {
  leftAbduction: number | null   // degrees, frontal plane
  rightAbduction: number | null  // degrees, frontal plane
  timestamp: number              // ms since epoch
}

export interface SessionFrame {
  angles: ShoulderAngles
  landmarks: Landmark[]
}

export interface RecordedSession {
  id: string
  startedAt: number
  frames: SessionFrame[]
  notes?: string
}

// The target and tolerance used for success feedback
export const ABDUCTION_TARGET_DEGREES = 180
export const MEASUREMENT_TOLERANCE_DEGREES = 5