import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

interface CreatePatientBody {
  displayName: string
  email: string
  temporaryPassword: string
  notes?: string
  dateOfBirth?: string
}

function ensureAdmin() {
  if (getApps().length) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Firebase Admin credentials missing (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).',
    })
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export default defineEventHandler(async (event) => {
  ensureAdmin()

  const authHeader = getHeader(event, 'authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Missing bearer token.' })
  }

  let callerUid: string
  try {
    const decoded = await getAuth().verifyIdToken(token)
    callerUid = decoded.uid
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid ID token.' })
  }

  const firestore = getFirestore()
  const callerDoc = await firestore.doc(`users/${callerUid}`).get()
  const callerRole = callerDoc.data()?.role
  if (callerRole !== 'practitioner' && callerRole !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only practitioners can create patients.' })
  }

  const body = await readBody<CreatePatientBody>(event)
  if (!body?.displayName || !body?.email || !body?.temporaryPassword) {
    throw createError({ statusCode: 400, statusMessage: 'displayName, email, and temporaryPassword are required.' })
  }

  let patientUser
  try {
    patientUser = await getAuth().createUser({
      email: body.email,
      password: body.temporaryPassword,
      displayName: body.displayName,
    })
  } catch (err: any) {
    throw createError({ statusCode: 409, statusMessage: err?.message ?? 'Failed to create auth user.' })
  }

  const batch = firestore.batch()

  batch.set(firestore.doc(`users/${patientUser.uid}`), {
    uid: patientUser.uid,
    role: 'patient',
    displayName: body.displayName,
    email: body.email,
    createdAt: FieldValue.serverTimestamp(),
  })

  batch.set(firestore.doc(`patients/${patientUser.uid}`), {
    uid: patientUser.uid,
    createdBy: callerUid,
    displayName: body.displayName,
    email: body.email,
    notes: body.notes ?? '',
    dateOfBirth: body.dateOfBirth ?? '',
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()

  return { uid: patientUser.uid, displayName: body.displayName }
})
