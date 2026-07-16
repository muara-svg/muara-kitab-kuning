/**
 * @file customFirestore.ts
 * @description Transparant Firestore Interceptor & Compression Storage Router
 * 
 * Intercepts Firestore Web SDK calls to transparently bypass the 1MB document limit.
 * Operations on the collection 'kitab_contents' are intercepted and proxied to Node/Express REST endpoints.
 * All other collections are forwarded directly to the standard Firebase Client SDK untouched.
 */

import { 
  getFirestore as originalGetFirestore, 
  doc as originalDoc, 
  setDoc as originalSetDoc, 
  getDoc as originalGetDoc, 
  deleteDoc as originalDeleteDoc, 
  collection as originalCollection, 
  onSnapshot as originalOnSnapshot, 
  query as originalQuery, 
  orderBy as originalOrderBy, 
  limit as originalLimit, 
  where as originalWhere,
  serverTimestamp as originalServerTimestamp,
  connectFirestoreEmulator as originalConnectFirestoreEmulator,
  enableIndexedDbPersistence as originalEnableIndexedDbPersistence,
  initializeFirestore as originalInitializeFirestore,
  persistentLocalCache as originalPersistentLocalCache,
  persistentMultipleTabManager as originalPersistentMultipleTabManager,
  addDoc as originalAddDoc,
  updateDoc as originalUpdateDoc,
  getDocs as originalGetDocs,
  arrayUnion as originalArrayUnion,
  arrayRemove as originalArrayRemove,
  increment as originalIncrement,
  writeBatch as originalWriteBatch
} from 'firebase/firestore';

// Export everything required by standard Firestore clients
export const getFirestore = originalGetFirestore;
export const doc = originalDoc;
export const collection = originalCollection;
export const onSnapshot = originalOnSnapshot;
export const query = originalQuery;
export const orderBy = originalOrderBy;
export const limit = originalLimit;
export const where = originalWhere;
export const serverTimestamp = originalServerTimestamp;
export const connectFirestoreEmulator = originalConnectFirestoreEmulator;
export const enableIndexedDbPersistence = originalEnableIndexedDbPersistence;
export const initializeFirestore = originalInitializeFirestore;
export const persistentLocalCache = originalPersistentLocalCache;
export const persistentMultipleTabManager = originalPersistentMultipleTabManager;
export const addDoc = originalAddDoc;
export const updateDoc = originalUpdateDoc;
export const getDocs = originalGetDocs;
export const arrayUnion = originalArrayUnion;
export const arrayRemove = originalArrayRemove;
export const increment = originalIncrement;
export const writeBatch = originalWriteBatch;

// Helper to determine the target backend API URL
const getApiUrl = (subpath: string) => {
  // Use relative pathway to handle both local dev (port 3000), web previews, Vercel deployments, and Capacitor
  return subpath;
};

// Intercept setDoc to route heavy kitab text to Proxy Backend
export const setDoc = async (reference: any, data: any, options?: any) => {
  const isKitabContent = reference && reference.path && reference.path.includes('kitab_contents/');
  
  if (isKitabContent) {
    const id = reference.path.replace('kitab_contents/', '');
    console.log('[Firestore Interceptor] Intercepted setDoc for large kitab payload. Target ID:', id);
    
    const response = await fetch(getApiUrl('/api/kitab-contents'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: id,
        ...data
      })
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal menyimpan teks kitab panjang via Backend Proxy (HTTP: ${response.status})`);
    }
    
    return;
  }
  
  // Forward normal document writes to original Firestore SDK
  return originalSetDoc(reference, data, options);
};

// Intercept getDoc to retrieve decompressed kitab text from Proxy Backend
export const getDoc = async (reference: any) => {
  const isKitabContent = reference && reference.path && reference.path.includes('kitab_contents/');
  
  if (isKitabContent) {
    const id = reference.path.replace('kitab_contents/', '');
    console.log('[Firestore Interceptor] Intercepted getDoc for large kitab payload. Target ID:', id);
    
    try {
      const response = await fetch(getApiUrl(`/api/kitab-contents/${id}`));
      if (response.ok) {
        const payload = await response.json();
        
        // Return structured Mock DocumentSnapshot mimicking standard Firebase Web SDK interface
        return {
          exists: () => true,
          id: id,
          ref: reference,
          metadata: { fromCache: false, hasPendingWrites: false },
          data: () => payload
        };
      } else if (response.status === 404) {
        return {
          exists: () => false,
          id: id,
          ref: reference,
          metadata: { fromCache: false, hasPendingWrites: false },
          data: () => undefined
        };
      }
    } catch (apiErr) {
      console.warn('[Firestore Interceptor] Backend connection failed. Falling back to native Firestore local storage/cache stream:', apiErr);
    }
  }
  
  // Forward other reads to original Firestore SDK
  return originalGetDoc(reference);
};

// Intercept deleteDoc to clean up proxied texts
export const deleteDoc = async (reference: any) => {
  const isKitabContent = reference && reference.path && reference.path.includes('kitab_contents/');
  
  if (isKitabContent) {
    const id = reference.path.replace('kitab_contents/', '');
    console.log('[Firestore Interceptor] Intercepted deleteDoc for kitab_contents ID:', id);
    
    try {
      const response = await fetch(getApiUrl(`/api/kitab-contents/${id}`), {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Gagal menghapus content via Backend Proxy`);
      }
    } catch (err) {
      console.warn('[Firestore Interceptor] Call to delete API failed:', err);
      throw err;
    }
    return; // Selesai, server backend sudah menghapus dokumen. Jangan jalankan direct client delete.
  }
  
  return originalDeleteDoc(reference);
};
