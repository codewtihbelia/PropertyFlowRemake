import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyBuWDUV1wuqmbtSZ2c4l1zwuASd9wOFkHM",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "splitzy-d429d.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    "splitzy-d429d",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "splitzy-d429d.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    "506286947370",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:506286947370:web:9a88634693baa2dbed9753",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const firestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_DATABASE_ID || "splitzy";

export const db = getFirestore(app, firestoreDatabaseId);
