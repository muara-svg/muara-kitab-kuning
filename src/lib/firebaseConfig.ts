/**
 * @file firebaseConfig.ts
 * @description Inisialisasi dan Konfigurasi Firebase untuk Aplikasi MUARA (Hibrid & Offline-First)
 * 
 * Meliputi konfigurasi:
 * 1. Firebase Authentication: Untuk manajemen sesi masuk dan daftar pengguna.
 * 2. Cloud Firestore: Database dokumen primer dengan optimasi offline persistence (caching).
 * 3. Firebase Realtime Database: Khusus untuk sinkronisasi broadcast notifikasi massal secara instan.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import firebaseConfigData from '../../firebase-applet-config.json';

// 1. Definisikan Kredensial Firebase SDK dengan Aman, mendukung env-override agar deploys ke Vercel/Self-host bisa mengarah ke database asli pengguna
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId}-default-rtdb.firebaseio.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigData.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigData.measurementId || ""
};

// 2. Inisialisasi Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 3. Inisialisasi Firebase Authentication
export const auth = getAuth(app);

// 4. Inisialisasi Cloud Firestore dengan Kemampuan Offline-First (Caching Multi-Tab)
let db;
const customDbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
// Jika user mengaktifkan prod env/VITE_FIREBASE_PROJECT_ID, default ke "(default)" (tidak ber-ID custom) unless specified.
const activeDbId = customDbId !== undefined 
  ? (customDbId === "(default)" ? undefined : customDbId) 
  : (import.meta.env.VITE_FIREBASE_PROJECT_ID ? undefined : firebaseConfigData.firestoreDatabaseId);

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true
  }, activeDbId);
  console.log('MUARA Offline-First Firestore Caching diaktifkan dengan sukses.');
} catch (error) {
  // Jika inisialisasi ganda terjadi karena modul re-load, gunakan instansi default
  db = getFirestore(app, activeDbId);
}
export const firestore = db;

// 5. Inisialisasi Firebase Realtime Database
export const realtimeDb = getDatabase(app);

export default app;
