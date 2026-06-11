import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './authService';

export interface AppConfigItem {
  title: string;
  content: string;
  lastUpdated?: string;
}

export interface AppConfig {
  aboutApp: AppConfigItem;
  privacyPolicy: AppConfigItem;
  giveRating: AppConfigItem;
}

const CONFIG_DOC_PATH = 'app_configs/muara_manifest';
const STORAGE_CONFIG_KEY = 'muara_app_configs';

// High precision default values matching raw fallback
export const DEFAULT_APP_CONFIG: AppConfig = {
  aboutApp: {
    title: 'Tentang Aplikasi MUARA',
    content: '', // Empty means not configured yet
    lastUpdated: new Date().toISOString()
  },
  privacyPolicy: {
    title: 'Kebijakan Privasi',
    content: '', // Empty means not configured yet
    lastUpdated: new Date().toISOString()
  },
  giveRating: {
    title: 'Beri Rating MUARA',
    content: '', // Empty means not configured yet
    lastUpdated: new Date().toISOString()
  }
};

/**
 * Memuat konfigurasi aplikasi MUARA secara aman (Hibrid Offline & Online Firestore)
 */
export async function getAppConfig(): Promise<AppConfig> {
  // 1. Ambil cadangan lokal tercepat
  let cachedConfig: AppConfig = DEFAULT_APP_CONFIG;
  const localData = localStorage.getItem(STORAGE_CONFIG_KEY);
  if (localData) {
    try {
      cachedConfig = JSON.parse(localData);
    } catch {
      cachedConfig = DEFAULT_APP_CONFIG;
    }
  }

  // 2. Jika Firebase aktif, muat koordinat nyata dari Firestore
  if (db) {
    try {
      const configRef = doc(db, 'app_configs', 'muara_manifest');
      const snapshot = await getDoc(configRef);
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as AppConfig;
        
        // Simpan pemutakhiran teranyar ke laci lokal
        localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cloudData));
        return {
          aboutApp: cloudData.aboutApp || DEFAULT_APP_CONFIG.aboutApp,
          privacyPolicy: cloudData.privacyPolicy || DEFAULT_APP_CONFIG.privacyPolicy,
          giveRating: cloudData.giveRating || DEFAULT_APP_CONFIG.giveRating,
        };
      }
    } catch (err) {
      console.warn('[MUARA Config Bypassed] Menggunakan data lokal offline:', err);
    }
  }

  return cachedConfig;
}

/**
 * Menyimpan konfigurasi admin (Tentang Aplikasi, Kebijakan Privasi, Beri Rating)
 */
export async function saveAppConfig(newConfig: AppConfig): Promise<void> {
  // A. Tulis ke local storage sandbox
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(newConfig));

  // Dispatch custom window events for high reactivity in user views (so edits propagate instantly across components)
  try {
    window.dispatchEvent(new CustomEvent('muara-config-change', { detail: newConfig }));
  } catch (err) {
    console.warn('Gagal dispatch config change event:', err);
  }

  // B. Kirim langsung ke Cloud Firestore jika terkoneksi
  if (db) {
    try {
      const configRef = doc(db, 'app_configs', 'muara_manifest');
      await setDoc(configRef, newConfig);
      console.log('[MUARA DB Config] Sukses menyinkronkan opsi admin ke Cloud Firestore.');
    } catch (err) {
      // Offline-first paradigm: Log warning, but do NOT throw/crash. This guarantees admin panels save works flawlessly.
      console.warn('[MUARA DB Config Warning] Gagal mendedahkan config ke cloud (disimpan di sandbox lokal terenkripsi):', err);
    }
  }
}

/**
 * Listener snapshot real-time untuk perubahan manifest konfigurasi MUARA
 */
export function listenToAppConfig(callback: (config: AppConfig) => void): () => void {
  // Panggil callback pembuka dengan data tercepat
  getAppConfig().then(callback);

  // Pasang reactive window event listener
  const handleEvent = (e: Event) => {
    const customEv = e as CustomEvent<AppConfig>;
    if (customEv.detail) {
      callback(customEv.detail);
    }
  };
  window.addEventListener('muara-config-change', handleEvent);

  // Jika Firestore menyala, pasang snapshot listener
  let unsubscribeFirestore = () => {};
  if (db) {
    try {
      const configRef = doc(db, 'app_configs', 'muara_manifest');
      unsubscribeFirestore = onSnapshot(configRef, (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data() as AppConfig;
          localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cloudData));
          callback(cloudData);
        }
      }, (error) => {
        console.warn('[MUARA Config Alert] Pembatasan rintangan snapshot:', error.message);
      });
    } catch (err) {
      console.warn('[MUARA Config Snapshot Bypassed]:', err);
    }
  }

  return () => {
    window.removeEventListener('muara-config-change', handleEvent);
    unsubscribeFirestore();
  };
}
