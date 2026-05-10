import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '~/firebase/firebase'
import type { UserProfile, UserRole } from '~/types/auth'

const user = ref<User | null>(null)
const profile = ref<UserProfile | null>(null)
const isLoading = ref(true)
// Tracks whether the user explicitly just signed in (not a cached session restore)
const justSignedIn = ref(false)

let listenerRegistered = false

export function useAuth() {
  const router = useRouter()
  const route = useRoute()

  if (!listenerRegistered) {
    listenerRegistered = true

    onAuthStateChanged(auth, async (firebaseUser) => {
      user.value = firebaseUser

      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) {
          profile.value = { uid: firebaseUser.uid, ...snap.data() } as UserProfile
        }
      } else {
        profile.value = null
      }

      isLoading.value = false

      // Only redirect if the user explicitly triggered sign in — not on session restore
      if (firebaseUser && profile.value?.role && justSignedIn.value) {
        justSignedIn.value = false
        redirectByRole()
      }
    })
  }

  const role = computed<UserRole | null>(() => profile.value?.role ?? null)
  const isAuthenticated = computed(() => !!user.value)
  const isPractitioner = computed(() => role.value === 'practitioner')
  const isPatient = computed(() => role.value === 'patient')
  const isAdmin = computed(() => role.value === 'admin')

  async function signIn(email: string, password: string): Promise<void> {
    isLoading.value = true
    justSignedIn.value = true
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      isLoading.value = false
      justSignedIn.value = false
      throw err
    }
  }

  async function signOut(): Promise<void> {
    await firebaseSignOut(auth)
    router.push('/login')
  }

  function redirectByRole(): void {
    switch (role.value) {
      case 'practitioner': router.push('/practitioner'); break
      case 'patient':      router.push('/capture');      break
      case 'admin':        router.push('/admin');         break
      default:             router.push('/login');
    }
  }

  return {
    user: readonly(user),
    profile: readonly(profile),
    role,
    isLoading: readonly(isLoading),
    isAuthenticated,
    isPractitioner,
    isPatient,
    isAdmin,
    signIn,
    signOut,
    redirectByRole,
  }
}