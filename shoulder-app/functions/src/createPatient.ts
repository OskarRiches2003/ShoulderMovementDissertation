import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

interface CreatePatientData {
  displayName: string
  email: string
  temporaryPassword: string
  notes?: string
  dateOfBirth?: string
}

export const createPatient = onCall({ cors: true },
  // {
  //   cors: [
  //     'http://localhost:3000',
  //     'https://shoulder-movement-app.web.app',
  //     'https://shoulder-movement-app.firebaseapp.com',
  //   ],
  // },
  async (request) => {
    const data = request.data as CreatePatientData

    // 1. Verify caller is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.')
    }

    // 2. Verify caller is a practitioner
    const callerDoc = await admin.firestore().doc(`users/${request.auth.uid}`).get()
    const callerRole = callerDoc.data()?.role
    if (callerRole !== 'practitioner' && callerRole !== 'admin') {
      throw new HttpsError('permission-denied', 'Only practitioners can create patients.')
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
      throw new HttpsError('already-exists', err.message)
    }

    // 4. Write both documents in a batch (atomic)
    const batch = admin.firestore().batch()

    batch.set(admin.firestore().doc(`users/${patientUser.uid}`), {
      uid: patientUser.uid,
      role: 'patient',
      displayName: data.displayName,
      email: data.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    batch.set(admin.firestore().doc(`patients/${patientUser.uid}`), {
      uid: patientUser.uid,
      createdBy: request.auth.uid,
      displayName: data.displayName,
      email: data.email,
      notes: data.notes ?? '',
      dateOfBirth: data.dateOfBirth ?? '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    await batch.commit()

    return { uid: patientUser.uid, displayName: data.displayName }
  }
)