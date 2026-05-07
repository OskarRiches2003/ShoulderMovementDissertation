import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '~/firebase/firebase'
import type { Patient } from '~/types/auth'

export function usePatients() {
  const { user } = useAuth()
  const patients = ref<Patient[]>([])
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  // Real-time listener scoped to this practitioner's patients
  let unsubscribe: (() => void) | null = null

  function startListening() {
    if (!user.value) return
    const q = query(
      collection(db, 'patients'),
      where('createdBy', '==', user.value.uid),
      orderBy('createdAt', 'desc')
    )
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        patients.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Patient))
        isLoading.value = false
      },
      (err) => {
        error.value = err.message
        isLoading.value = false
      }
    )
  }

  function stopListening() {
    unsubscribe?.()
  }

  onMounted(startListening)
  onUnmounted(stopListening)

  // ── Create patient via Cloud Function ────────────────────────────────────────

  const functions = getFunctions()
  const createPatientFn = httpsCallable(functions, 'createPatient')

  async function createPatient(params: {
    displayName: string
    email: string
    temporaryPassword: string
    notes?: string
    dateOfBirth?: string
  }): Promise<{ uid: string; displayName: string }> {
    const result = await createPatientFn(params)
    return result.data as { uid: string; displayName: string }
  }

  return {
    patients: readonly(patients),
    isLoading: readonly(isLoading),
    error: readonly(error),
    createPatient,
  }
}