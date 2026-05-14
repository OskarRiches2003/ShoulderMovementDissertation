import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '~/firebase/firebase'
import type { Session, SessionMovement, MovementResult } from '~/types/auth'

export function useSessions() {
  const { user } = useAuth()

  // ── Practitioner: create a new session for a patient ───────────────────────
  // Cancels any existing pending/in-progress sessions first (one active at a time)
  async function createSessionForPatient(params: {
    patientId: string
    movements: SessionMovement[]
    notes?: string
  }): Promise<string> {
    if (!user.value) throw new Error('Not signed in.')

    // Find any existing active sessions for this patient and cancel them
    const activeQ = query(
      collection(db(), 'sessions'),
      where('patientId', '==', params.patientId),
      where('status', 'in', ['pending', 'in-progress'])
    )
    const existing = await getDocs(activeQ)

    const batch = writeBatch(db())

    existing.forEach((d) => {
      batch.update(d.ref, { status: 'complete', finishedAt: serverTimestamp() })
    })

    // Create the new session as a doc ref in the same batch
    const newRef = doc(collection(db(), 'sessions'))
    batch.set(newRef, {
      patientId: params.patientId,
      practitionerId: user.value.uid,
      movements: params.movements,
      notes: params.notes ?? '',
      results: [],
      status: 'pending',
      createdAt: serverTimestamp(),
    })

    await batch.commit()
    return newRef.id
  }

  // ── Patient: watch for the current pending/in-progress session ─────────────
  function watchActiveSessionForPatient(
    patientId: string,
    onUpdate: (session: Session | null) => void
  ): Unsubscribe {
    const q = query(
      collection(db(), 'sessions'),
      where('patientId', '==', patientId),
      where('status', 'in', ['pending', 'in-progress']),
      orderBy('createdAt', 'desc'),
      limit(1)
    )
    return onSnapshot(q, (snap) => {
      if (snap.empty) {
        onUpdate(null)
      } else {
        const d = snap.docs[0]
        onUpdate({ id: d.id, ...d.data() } as Session)
      }
    })
  }

  // ── Patient: mark session as started ───────────────────────────────────────
  async function startSession(sessionId: string): Promise<void> {
    await updateDoc(doc(db(), 'sessions', sessionId), {
      status: 'in-progress',
      startedAt: serverTimestamp(),
    })
  }

  // ── Patient: append a movement result ──────────────────────────────────────
  async function appendMovementResult(
    sessionId: string,
    result: Omit<MovementResult, 'completedAt'>
  ): Promise<void> {
    const { getDoc } = await import('firebase/firestore')
    const ref = doc(db(), 'sessions', sessionId)
    const snap = await getDoc(ref)
    const existing = (snap.data()?.results ?? []) as MovementResult[]
    const updated = [
      ...existing,
      { ...result, completedAt: new Date() },
    ]
    await updateDoc(ref, { results: updated })
  }

  // ── Patient: mark session as awaiting practitioner review ──────────────────
  async function finishSession(sessionId: string): Promise<void> {
    await updateDoc(doc(db(), 'sessions', sessionId), {
      status: 'awaiting-review',
      finishedAt: serverTimestamp(),
    })
  }

  // ── Practitioner: mark a reviewed session complete ─────────────────────────
  async function markSessionReviewed(sessionId: string): Promise<void> {
    await updateDoc(doc(db(), 'sessions', sessionId), {
      status: 'complete',
      reviewedAt: serverTimestamp(),
    })
  }

  // ── Practitioner: watch all sessions for a given patient ───────────────────
  function watchSessionsForPatient(
    patientId: string,
    onUpdate: (sessions: Session[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db(), 'sessions'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session)))
    })
  }

  return {
    createSessionForPatient,
    watchActiveSessionForPatient,
    startSession,
    appendMovementResult,
    finishSession,
    markSessionReviewed,
    watchSessionsForPatient,
  }
}