import type { MovementType, Side } from '~/types/pose'

export type UserRole = 'practitioner' | 'patient' | 'admin'

export interface UserProfile {
  uid: string
  role: UserRole
  displayName: string
  email: string
  createdAt: any
}

export interface Patient {
  id: string
  uid: string
  createdBy: string
  displayName: string
  email: string
  dateOfBirth?: string
  notes?: string
  createdAt: any
}

// ── Session types ─────────────────────────────────────────────────────────────

export interface SessionMovement {
  movementType: MovementType
  side: Side
}

export interface MovementResult {
  movementType: MovementType
  side: Side
  peakAngle: number
  readings: number[]
  completedAt: any
}

export type SessionStatus = 'pending' | 'in-progress' | 'awaiting-review' | 'complete'

export interface Session {
  id: string
  patientId: string
  practitionerId: string
  movements: SessionMovement[]
  notes?: string
  results: MovementResult[]
  status: SessionStatus
  createdAt: any
  startedAt?: any
  finishedAt?: any
  reviewedAt?: any
}