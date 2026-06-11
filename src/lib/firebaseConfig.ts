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

// 1. Definisikan Kredensial Firebase SDK dengan Aman dari konfig resmi
const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  databaseURL: `https://${firebaseConfigData.projectId}-default-rtdb.firebaseio.com`,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
  measurementId: firebaseConfigData.measurementId || ""
};

// 2. Inisialisasi Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 3. Inisialisasi Firebase Authentication
export const auth = getAuth(app);

// 4. Inisialisasi Cloud Firestore dengan Kemampuan Offline-First (Caching Multi-Tab)
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true
  }, firebaseConfigData.firestoreDatabaseId);
  console.log('MUARA Offline-First Firestore Caching diaktifkan dengan sukses.');
} catch (error) {
  // Jika inisialisasi ganda terjadi karena modul re-load, gunakan instansi default
  db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);
}
export const firestore = db;

// 5. Inisialisasi Firebase Realtime Database
export const realtimeDb = getDatabase(app);

export default app;
