import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Vite environment variables for Firebase Spark plan configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

// Check if actual configuration has been provided
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'YOUR_API_KEY'
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      // Analytics is optional: keep its SDK out of the initial download and
      // initialize after the page has loaded, during idle time when available.
      const initializeAnalytics = () => {
        void import('firebase/analytics').then(async ({ isSupported, getAnalytics }) => {
          if (app && await isSupported()) getAnalytics(app);
        }).catch(() => {});
      };
      const scheduleAnalytics = () => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(initializeAnalytics);
        } else {
          globalThis.setTimeout(initializeAnalytics, 1000);
        }
      };
      if (document.readyState === 'complete') scheduleAnalytics();
      else window.addEventListener('load', scheduleAnalytics, { once: true });
    }
    console.info('🌲 [Woodchuckers] Connected to Firebase Spark project:', firebaseConfig.projectId);
  } catch (error) {
    console.warn('⚠️ [Woodchuckers] Failed to initialize Firebase, falling back to local mode:', error);
  }
} else {
  console.info('🦫 [Woodchuckers] Running in Local Zero-Cost Mode (localStorage persistence). Connect free Firebase anytime!');
}

export { app, db, auth };
