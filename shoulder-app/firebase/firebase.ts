import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

// App is initialised by plugins/firebase.client.ts before any composable runs
export const auth      = () => getAuth(getApp())
export const db        = () => getFirestore(getApp())
export const functions = () => getFunctions(getApp())