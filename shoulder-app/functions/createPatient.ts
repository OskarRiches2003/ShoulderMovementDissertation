import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

interface CreatePatientData {
  displayName: string
  email: string
  temporaryPassword: string
  notes?: string
  dateOfBirth?: string
}

/**
 * createPatient — callable Cloud Function
 * Only practitioners (verified via their Auth token) can invoke this.
 * Creates a Firebase Auth account + Firestore patient doc atomically.
 */
export const createPatient = functions.https.onCall(async (data: CreatePatientData, context) => {
  // 1. Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.')
  }

  // 2. Verify caller is a practitioner
  const callerDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get()
  const callerRole = callerDoc.data()?.role
  if (callerRole !== 'practitioner' && callerRole !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only practitioners can create patients.')
  }

  // 3. Create Firebase Auth account for the patient
  let patientUser: admin.auth.UserRecord
  try {
    patientUser = await admin.auth().createUser({
      email: data.email,
      password: data.temporaryPassword,
      displayName: data.displayName,
    })
  } catch (err: any) {
    throw new functions.https.HttpsError('already-exists', err.message)
  }

  // 4. Write both documents in a batch (atomic)
  const batch = admin.firestore().batch()

  // users/{uid} — role profile
  batch.set(admin.firestore().doc(`users/${patientUser.uid}`), {
    uid: patientUser.uid,
    role: 'patient',
    displayName: data.displayName,
    email: data.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  // patients/{uid} — clinical record
  batch.set(admin.firestore().doc(`patients/${patientUser.uid}`), {
    uid: patientUser.uid,
    createdBy: context.auth.uid,
    displayName: data.displayName,
    email: data.email,
    notes: data.notes ?? '',
    dateOfBirth: data.dateOfBirth ?? '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  await batch.commit()

  return { uid: patientUser.uid, displayName: data.displayName }
})