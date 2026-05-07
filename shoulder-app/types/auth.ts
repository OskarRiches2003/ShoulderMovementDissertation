export type UserRole = 'practitioner' | 'patient' | 'admin'

export interface UserProfile {
  uid: string
  role: UserRole
  displayName: string
  email: string
  createdAt: Date
}

export interface Patient {
  id: string
  uid: string                // Firebase Auth uid for the patient's account
  createdBy: string          // Practitioner's uid
  displayName: string
  dateOfBirth?: string
  notes?: string
  createdAt: Date
}

export interface SessionMovementResult {
  peakAngle: number
  readings: number[]
  completedAt: Date
}

export type SessionStatus = 'pending' | 'in-progress' | 'complete'

export interface Session {
  id: string
  patientId: string
  practitionerId: string
  movements: string[]          // ordered list of movement keys e.g. ['abduction', 'flexion']
  side: 'left' | 'right' | 'both'
  notes?: string
  results: Record<string, SessionMovementResult>
  status: SessionStatus
  createdAt: Date
  completedAt?: Date
}