import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from 'firebase/firestore'
import { auth, db } from '~/firebase/firebase'
import type { Patient } from '~/types/auth'

export function usePatients() {
  const { user } = useAuth()
  const patients = ref<Patient[]>([])
  const isLoading = ref(true)
  const error = ref<string | null>(null)
  const listening = ref(false)

  let unsubscribe: (() => void) | null = null

  function startListening() {
    if (!user.value || listening.value) return
    listening.value = true

    console.log('Starting Firestore listener for uid:', user.value.uid)

    const q = query(
      collection(db(), 'patients'),
      orderBy('createdAt', 'desc')
    )
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        console.log('Firestore snapshot received, docs:', snap.docs.length)
        patients.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Patient))
        isLoading.value = false
      },
      (err) => {
        console.error('Firestore listener error:', err)
        error.value = err.message
        isLoading.value = false
      }
    )
  }

  function stopListening() {
    unsubscribe?.()
    listening.value = false
  }

  // Watch for user to become available, then start the Firestore listener
  watch(() => user.value, (newUser) => {
    if (newUser) startListening()
  }, { immediate: true })

  onUnmounted(stopListening)

  async function createPatient(params: {
    displayName: string
    email: string
    temporaryPassword: string
    notes?: string
    dateOfBirth?: string
  }): Promise<{ uid: string; displayName: string }> {
    const current = auth().currentUser
    if (!current) throw new Error('Not signed in.')
    const token = await current.getIdToken()
    return await $fetch<{ uid: string; displayName: string }>('/api/createPatient', {
      method: 'POST',
      body: params,
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  return {
    patients: readonly(patients),
    isLoading: readonly(isLoading),
    error: readonly(error),
    createPatient,
  }
}