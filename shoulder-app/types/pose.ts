// ─── Landmark indices (MediaPipe 33-point model) ──────────────────────────────
export enum PoseLandmark {
  NOSE           = 0,
  LEFT_SHOULDER  = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW     = 13,
  RIGHT_ELBOW    = 14,
  LEFT_WRIST     = 15,
  RIGHT_WRIST    = 16,
  LEFT_HIP       = 23,
  RIGHT_HIP      = 24,
}

// ─── Movement types ───────────────────────────────────────────────────────────
export enum MovementType {
  ABDUCTION = 'abduction',
  FLEXION   = 'flexion',
  ROTATION  = 'rotation',
}

// ─── Landmark shape ───────────────────────────────────────────────────────────
export interface Landmark {
  x: number          // normalised 0–1 (image width)
  y: number          // normalised 0–1 (image height)
  z: number          // depth (normalised; noisy — use with caution)
  visibility?: number // 0–1 confidence
}

// ─── Per-frame angle output (generic across all movements) ───────────────────
export interface MovementAngles {
  left:      number | null   // degrees
  right:     number | null   // degrees
  timestamp: number          // ms since epoch
}

// ─── Movement config — one object per movement type ──────────────────────────
export interface MovementConfig {
  type:        MovementType
  label:       string        // display name, e.g. "Abduction"
  shortLabel:  string        // tab label, e.g. "Abd"
  plane:       string        // anatomical plane description
  cameraView:  'frontal' | 'side'
  instruction: string        // shown to user before / during session
  normalRange: [number, number] // degrees: [min normal, max normal]
  /** Calculate angle for one side given the full landmark array */
  calculate: (landmarks: Landmark[], side: 'left' | 'right') => number | null
}

// ─── Session data ─────────────────────────────────────────────────────────────
export interface SessionFrame {
  movement:  MovementType
  angles:    MovementAngles
  landmarks: Landmark[]
}

export interface RecordedSession {
  id:          string
  movement:    MovementType
  startedAt:   number
  frames:      SessionFrame[]
  notes?:      string
}

// ─── Global constants ─────────────────────────────────────────────────────────
export const MEASUREMENT_TOLERANCE_DEGREES = 5
export const VISIBILITY_THRESHOLD          = 0.5