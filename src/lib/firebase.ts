import AsyncStorage from '@react-native-async-storage/async-storage';
// Note: imported from '@firebase/auth' (not the 'firebase/auth' wrapper).
// The 'firebase' package's own exports map for './auth' has no "react-native"
// condition, so under Metro it resolves to the browser build and silently
// omits getReactNativePersistence. '@firebase/auth' declares that condition
// correctly, so this is what actually gets AsyncStorage-backed persistence.
import { type Auth, getAuth, getReactNativePersistence, initializeAuth } from '@firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Filled in from a Firebase project you create (Authentication -> Anonymous
// enabled, Firestore -> Native mode). See .env.example for the values to copy
// from Project Settings -> General -> "Your apps" -> SDK setup and config.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
try {
  // AsyncStorage persistence is what makes the anonymous uid (and therefore
  // the user's profile/history) survive an app restart. Without it, every
  // relaunch would silently create a brand-new anonymous user.
  auth = initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  // initializeAuth throws if called twice — happens routinely under Metro
  // Fast Refresh in development. Fall back to the already-initialized instance.
  auth = getAuth(firebaseApp);
}

export { auth };
export const db = getFirestore(firebaseApp);

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}
