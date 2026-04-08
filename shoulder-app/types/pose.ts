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
  ABDUCTION     = 'abduction',
  FLEXION_LEFT  = 'flexion-left',   // side-on: patient's left side faces camera
  FLEXION_RIGHT = 'flexion-right',  // side-on: patient's right side faces camera
  ROTATION      = 'rotation',
}

// ─── Side ─────────────────────────────────────────────────────────────────────
export type Side = 'left' | 'right' | 'both'

// ─── Landmark shape ───────────────────────────────────────────────────────────
export interface Landmark {
  x: number           // normalised 0–1 (image width)
  y: number           // normalised 0–1 (image height)
  z: number           // depth (normalised; noisy — use with caution)
  visibility?: number // 0–1 confidence
}

// ─── Per-frame angle output ───────────────────────────────────────────────────
export interface MovementAngles {
  left:      number | null
  right:     number | null
  timestamp: number
}

// ─── Movement config ──────────────────────────────────────────────────────────
export interface MovementConfig {
  type:         MovementType
  label:        string
  shortLabel:   string
  plane:        string
  cameraView:   'frontal' | 'side'
  instruction:  string
  normalRange:  [number, number]
  /** Which sides are meaningful for this movement (used in practitioner UI) */
  availableSides: Side[]
  calculate: (landmarks: Landmark[], side: 'left' | 'right') => number | null
}

// ─── Prescribed movement — one item in a practitioner-built session ───────────
export interface PrescribedMovement {
  movementType: MovementType
  side:         Side
}

// ─── Session config — built by practitioner, consumed by capture page ─────────
export interface SessionConfig {
  movements: PrescribedMovement[]
  notes:     string
}

// ─── URL encoding helpers ─────────────────────────────────────────────────────
// Encodes a SessionConfig into query params:
//   ?movements=abduction-both,flexion-left-left&notes=Focus+on+left+side
export function encodeSessionConfig(config: SessionConfig): URLSearchParams {
  const params = new URLSearchParams()
  params.set('movements', config.movements.map(m => `${m.movementType}__${m.side}`).join(','))
  if (config.notes) params.set('notes', config.notes)
  return params
}

export function decodeSessionConfig(params: URLSearchParams): SessionConfig | null {
  const raw = params.get('movements')
  if (!raw) return null

  const movements: PrescribedMovement[] = raw.split(',').flatMap(token => {
    const parts = token.split('__')
    if (parts.length !== 2) return []
    const [movementType, side] = parts
    if (!Object.values(MovementType).includes(movementType as MovementType)) return []
    return [{ movementType: movementType as MovementType, side: side as Side }]
  })

  return { movements, notes: params.get('notes') ?? '' }
}

// ─── Session data ─────────────────────────────────────────────────────────────
export interface SessionFrame {
  movement:  MovementType
  angles:    MovementAngles
  landmarks: Landmark[]
}

export interface RecordedSession {
  id:        string
  movement:  MovementType
  startedAt: number
  frames:    SessionFrame[]
  notes?:    string
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const MEASUREMENT_TOLERANCE_DEGREES = 5
export const VISIBILITY_THRESHOLD          = 0.5