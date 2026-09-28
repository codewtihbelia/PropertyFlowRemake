import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import Constants from "expo-constants";

const extraFirebase = (Constants.expoConfig?.extra as any)?.firebase || {};

const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    extraFirebase.apiKey ||
    "AIzaSyBuWDUV1wuqmbtSZ2c4l1zwuASd9wOFkHM",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    extraFirebase.authDomain ||
    "splitzy-d429d.firebaseapp.com",
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    extraFirebase.projectId ||
    "splitzy-d429d",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    extraFirebase.storageBucket ||
    "splitzy-d429d.firebasestorage.app",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    extraFirebase.messagingSenderId ||
    "506286947370",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    extraFirebase.appId ||
    "1:506286947370:web:9a88634693baa2dbed9753",
};

export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const firestoreDatabaseId =
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID ||
  extraFirebase.databaseId ||
  "splitzy";

export const db = getFirestore(app, firestoreDatabaseId);

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    try {
      return getAuth(app);
    } catch (err) {
      console.warn("[Firebase] Auth initialization fallback warning:", err);
      return { currentUser: null, signOut: async () => {} } as any;
    }
  }
})();

export const storage = (() => {
  try {
    return getStorage(app);
  } catch (err) {
    console.warn("[Firebase] Storage initialization fallback warning:", err);
    return {} as any;
  }
})();

export const functions = (() => {
  try {
    return getFunctions(app);
  } catch (err) {
    console.warn("[Firebase] Functions initialization fallback warning:", err);
    return {} as any;
  }
})();
