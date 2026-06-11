/**
 * MUARA Offline-First IndexedDB Service
 * Built using native browser IndexedDB for high stability & fast compilation.
 */

const DB_NAME = 'MuaraOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_kitabs';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export const indexedDbService = {
  /**
   * Save a kitab object to local storage
   */
  async saveKitab(kitab: any): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const downloadDate = new Date().toISOString();
      const payload = {
        ...kitab,
        isOfflineSaved: true,
        downloadedAt: downloadDate
      };
      
      const request = store.put(payload);

      request.onsuccess = () => resolve();
      request.onerror = (e: any) => reject(e.target.error);
    });
  },

  /**
   * Fetch a single kitab from offline db cache
   */
  async getKitab(id: string): Promise<any | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = (event: any) => {
        resolve(event.target.result || null);
      };
      request.onerror = (e: any) => reject(e.target.error);
    });
  },

  /**
   * Get list of all saved kitabs
   */
  async getAllKitabs(): Promise<any[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event: any) => {
        resolve(event.target.result || []);
      };
      request.onerror = (e: any) => reject(e.target.error);
    });
  },

  /**
   * Delete static kitab from offline database cache
   */
  async deleteKitab(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = (e: any) => reject(e.target.error);
    });
  },

  /**
   * Check if a kitab is already saved locally
   */
  async isSaved(id: string): Promise<boolean> {
    const kitab = await this.getKitab(id);
    return !!kitab;
  }
};
