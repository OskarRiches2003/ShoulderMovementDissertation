// types/session.ts

/**
 * One movement's result within a session.
 * leftAngle / rightAngle are peak angles recorded during capture.
 * null means that side was not measured (e.g. single-arm rotation).
 */
export interface MovementResult {
  movement: string      // matches movementConfigs key, e.g. 'abduction', 'flexion_right', 'rotation'
  label: string         // human-readable, e.g. 'Abduction', 'Flexion (Right-Facing)'
  leftAngle: number | null
  rightAngle: number | null
}

/**
 * A single completed assessment session.
 */
export interface SessionRecord {
  id: string
  patientId: string          // Firestore user UID
  date: Date
  movements: MovementResult[]
  notes?: string             // practitioner notes passed via URL param
}

/**
 * Firestore-compatible shape (dates as ISO strings).
 */
export interface SessionRecordRaw {
  patientId: string
  date: string               // ISO 8601
  movements: MovementResult[]
  notes?: string
}