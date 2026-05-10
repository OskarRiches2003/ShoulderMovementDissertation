import * as admin from 'firebase-admin'

// Must be called before any other Firebase admin usage
admin.initializeApp()

export { createPatient } from './createPatient'