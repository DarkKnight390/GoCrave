import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, setPersistence, inMemoryPersistence, browserLocalPersistence } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Vite/HMR safe: reuse existing app if it already exists
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const rtdb = db;
export const auth = getAuth(app);
export const secondaryAuth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
setPersistence(secondaryAuth, inMemoryPersistence);
export const functions = getFunctions(app);
export const storage = getStorage(app);
