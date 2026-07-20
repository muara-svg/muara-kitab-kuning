import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { uploadToCloudinaryDirect } from './cloudinaryConfig';
import { auth as firebaseAuth, firestore as firebaseDb } from './firebaseConfig';

// 1. Safe Firebase & Active Initializations
export const auth = firebaseAuth;
export const db = firebaseDb;

// Helper utility to make async requests fail-fast instead of lagging forever
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// 2. Local fallback storage key
const STORAGE_USERS_KEY = 'muara_users_db';
const SESSION_USER_KEY = 'muara_current_session';

export interface UserSchema {
  uid: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatarUrl: string;
  role: 'user' | 'admin';
  isPremium: boolean;
  createdAt: string;
  password?: string;
}

// 3. Password Validation Rules Check
export function validatePassword(password: string): { isValid: boolean; message: string } {
  if (password.length < 6) {
    return { isValid: false, message: 'Password minimal harus 6 karakter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password wajib mengandung minimal satu huruf KAPITAL (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password wajib mengandung minimal satu huruf kecil (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password wajib mengandung minimal satu angka (0-9).' };
  }
  const specialCharRegex = /[^A-Za-z0-9]/;
  if (!specialCharRegex.test(password)) {
    return { isValid: false, message: 'Password wajib mengandung minimal satu karakter spesial atau simbol (contoh: @, #, $, %, !).' };
  }
  return { isValid: true, message: 'Kombinasi password sudah memenuhi standar keamanan tinggi.' };
}

/**
 * Kompresi biner foto profile pengguna secara instan sebelum dikirim ke server.
 * Melakukan resize resolusi serta kompresi kualitas bumbu JPEG 70-80% ramah penyimpanan.
 */
export async function compressImage(file: File, quality: number = 0.75): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Optimalkan ukuran gambar profil maksimal 800px lebar/tinggi demi efisiensi optimal
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.substring(0, file.name.lastIndexOf('.')) + '.jpg', {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              console.log(`[MUARA Kompresi] Gambar tereduksi dari ${(file.size / 1024).toFixed(1)} KB menjadi ${(compressedFile.size / 1024).toFixed(1)} KB`);
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

// 4. Cloudinary Profile Photo Uploader Helper (Real Cloudinary direct client integration)
export async function uploadToCloudinary(file: File, onProgress?: (percent: number) => void): Promise<string> {
  // Kompresi biner otomatis 75% kualitas JPEG sebelum dikirim ke API Cloudinary
  const compressedFile = await compressImage(file, 0.75);
  return uploadToCloudinaryDirect(compressedFile, {
    folder: 'profile_photos',
    onProgress
  });
}

/**
 * Registrasi User Baru ke dalam Firebase Authentication & sinkron ke Firestore
 */
export async function registerFirebaseUser(
  userData: Omit<UserSchema, 'uid'>, 
  password: string
): Promise<UserSchema> {
  if (!auth) {
    throw new Error('Konfigurasi Firebase Authentication tidak aktif.');
  }

  let firebaseUser: any = null;

  try {
    // 1. Buat credential pengguna baru di Firebase Auth dengan timeout 4 detik agar tidak hang selamanya
    const userCredential = await withTimeout(
      createUserWithEmailAndPassword(auth, userData.email, password),
      4000,
      'Batas waktu pendaftaran (timeout) lewat koneksi internet tercapai.'
    );
    firebaseUser = userCredential.user;

    // 2. Berikan Display Name & Avatar URL di dalam profil metadata Firebase Auth
    try {
      await updateProfile(firebaseUser, {
        displayName: userData.name,
        photoURL: userData.avatarUrl
      });
    } catch (err) {
      console.warn('Gagal menempelkan profil meta ke Firebase Auth:', err);
    }
  } catch (err: any) {
    console.error('[MUARA Auth Error Detail]', err);
    const errString = String(err?.code || err?.message || err || '').toLowerCase();
    
    // Check if network is offline or Firebase identity toolkit is disabled/restricted
    const isFirebaseIssue = 
      errString.includes('identity-toolkit') || 
      errString.includes('not-used') || 
      errString.includes('restricted') || 
      errString.includes('operation-not-allowed') || 
      errString.includes('not-allowed') ||
      errString.includes('api-key-are-not-supported') ||
      errString.includes('timeout') ||
      errString.includes('network-request-failed');

    if (isFirebaseIssue) {
      console.warn('[MUARA Auth Fallback] Mendeteksi kendala pada Firebase Cloud. Mendaftarkan akun sebagai akun virtual lokal...');
      const virtualUid = `user-local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const completedUser: UserSchema = {
        ...userData,
        uid: virtualUid,
        password: password
      };
      
      // Save locally
      await saveUserToFirestore(completedUser, false);
      return completedUser;
    }

    if (errString.includes('operation-not-allowed') || errString.includes('not-allowed')) {
      throw new Error(
        'Pendaftaran gagal karena metode masuk Email/Password belum AKTIF di Firebase Console Anda.\n' +
        'Solusi: Silakan buka Firebase Console -> Build -> Authentication -> Sign-in method, lalu aktifkan opsi "Email/Password".'
      );
    }
    throw err;
  }

  // 3. Masukkan data profil lengkap ke skema terstruktur
  const completedUser: UserSchema = {
    ...userData,
    uid: firebaseUser.uid, // Ambil UID resmi hasil generator Firebase Auth
    password: password // Simpan password untuk validasi cadangan virtual
  };

  // 4. Sinkronisasikan data profil ke Cloud Firestore 'users' dengan throwOnFailure = true, tetapi robust fallback agar tidak menggagalkan pendaftaran jika terjadi limit/blok jaringan lokal
  try {
    await saveUserToFirestore(completedUser, true);
  } catch (fsErr: any) {
    console.warn('[MUARA Reg Resiliensi] Masalah saat menulis ke Firestore cloud langsung, menyimpan ke sandbox lokal:', fsErr);
    // Jalankan fallback local write (tidak throwOnFailure) agar pengguna tidak stuck saat mendaftar
    await saveUserToFirestore(completedUser, false);
  }

  return completedUser;
}

/**
 * Login akun pengguna via email sandi ke Firebase Authentication
 */
export async function loginFirebaseUser(email: string, password: string): Promise<UserSchema> {
  const emailClean = email.trim().toLowerCase();

  // Pemeriksaan Akun Admin Khusus Bypass untuk kedua super admin Resmi
  const isBypassEmail = 
    emailClean === 'official.hcsh@gmail.com' || 
    emailClean === 'official.hcsh@gmeil.com' || 
    emailClean === 'firmanhusen255@gmail.com' || 
    emailClean === 'firmanhusen255@gmeil.com';

  if (isBypassEmail && (password === 'Hcsh255@' || password === 'Santri255@')) {
    const isAdminHCSH = emailClean === 'official.hcsh@gmail.com' || emailClean === 'official.hcsh@gmeil.com';
    const adminUser: UserSchema = {
      uid: isAdminHCSH ? 'admin-official-hcsh' : 'admin-firman-husen',
      name: isAdminHCSH ? 'Official Admin MUARA (HCSH)' : 'Firman Husen (Developer)',
      email: emailClean,
      phone: isAdminHCSH ? '081122334455' : '081234567890',
      bio: isAdminHCSH ? 'Dewan Syuro Pendataan Kitab Kuning MUARA Digital' : 'Santri thalabul ilmi pencinta Kitab Kuning Digital',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=150',
      role: 'admin',
      isPremium: true,
      createdAt: new Date().toISOString(),
      password: password
    };

    // Hubungkan dengan autentikasi nyata di Firebase jika tersedia (Lakukan secara asynchronous background non-blocking)
    if (auth) {
      (async () => {
        try {
          console.log('[MUARA Admin Auth] Mencoba menyamakan sesi ke Firebase Auth (Background)...');
          let userCredential;
          try {
            userCredential = await signInWithEmailAndPassword(auth, emailClean, password);
          } catch (signInErr: any) {
            const errCode = signInErr?.code || '';
            const errMsg = String(signInErr?.message || '').toLowerCase();
            const isUserNotFound = errCode === 'auth/user-not-found' || 
                                   errCode === 'auth/invalid-credential' || 
                                   errMsg.includes('user-not-found') || 
                                   errMsg.includes('invalid-credential');
            
            if (isUserNotFound) {
              console.log('[MUARA Admin Auth Sync] Akun admin belum terdaftar di awan Firebase Auth. Mendaftarkan otomatis...');
              userCredential = await createUserWithEmailAndPassword(auth, emailClean, password);
            } else {
              throw signInErr;
            }
          }
          const realUid = userCredential.user.uid;
          
          if (db) {
            await setDoc(doc(db, 'users', realUid), {
              uid: realUid,
              name: adminUser.name,
              email: adminUser.email,
              phone: adminUser.phone,
              bio: adminUser.bio,
              avatarUrl: adminUser.avatarUrl,
              role: 'admin',
              isPremium: true,
              createdAt: adminUser.createdAt,
              password: adminUser.password,
              adminBypassSecret: adminUser.password
            });
            await setDoc(doc(db, 'admins', realUid), {
              uid: realUid,
              email: adminUser.email,
              adminBypassSecret: adminUser.password
            });
          }
        } catch (err: any) {
          console.warn('[MUARA Admin Auth Sync Background] Gagal sync admin ke cloud:', err.message);
        }
      })();
    }

    // Backup to local
    const users = getStoredUsers();
    users[emailClean] = adminUser;
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

    return adminUser;
  }

  // 1. Check local storage first for INSTANT matching (0ms) - completely immune to Firebase/Firestore hangs
  const localUsers = getStoredUsers();
  const localUser = localUsers[emailClean];
  if (localUser) {
    if (localUser.password === password) {
      console.log('[MUARA Auth] Menemukan kecocokan akun lokal sandbox. Login instan diaktifkan.');
      
      // Sync to Cloud in background if possible, so user doesn't wait
      if (auth && !localUser.uid.startsWith('user-local-')) {
        (async () => {
          try {
            await signInWithEmailAndPassword(auth, emailClean, password);
            await saveUserToFirestore(localUser, false);
          } catch (backgroundError) {
            console.warn('[MUARA Auth Sync Background] Gagal sinkronisasi sesi awan:', backgroundError);
          }
        })();
      }
      return localUser;
    } else {
      // User exists locally but entered a wrong password
      throw new Error('Kombinasi email atau password yang dimasukkan salah!');
    }
  }

  if (!auth) {
    throw new Error('Sistem penanganan login Firebase Auth tidak aktif.');
  }

  // 2. Melakukan Autentikasi Masuk via SDK Firebase dengan limit waktu (timeout) agar tidak loading selamanya
  let firebaseUser: any = null;
  try {
    console.log('[MUARA Auth] Mencoba autentikasi ke Firebase cloud...');
    const userCredential = await withTimeout(
      signInWithEmailAndPassword(auth, emailClean, password),
      4000,
      'Batas waktu autentikasi habis (timeout).'
    );
    firebaseUser = userCredential.user;
  } catch (err: any) {
    console.warn('[MUARA Auth] Percobaan login Firebase Auth berkendala:', err.code || err.message);
    const errString = String(err?.code || err?.message || err || '').toLowerCase();
    
    // Check if configuration issue or network is down
    const isFirebaseIssue = 
      errString.includes('identity-toolkit') || 
      errString.includes('not-used') || 
      errString.includes('restricted') || 
      errString.includes('operation-not-allowed') || 
      errString.includes('not-allowed') ||
      errString.includes('api-key-are-not-supported') ||
      errString.includes('timeout') ||
      errString.includes('network-request-failed');

    if (isFirebaseIssue) {
      console.warn('[MUARA Auth Fallback] Menemukan rintangan Firebase. Mencari di database users lokal...');
      if (localUser) {
        if (localUser.password === password) {
          return localUser;
        } else {
          throw new Error('Kombinasi email atau password yang dimasukkan salah!');
        }
      }
      throw new Error(
        'Rintangan Koneksi Firebase / Identity Toolkit API belum diaktifkan.\n\n' +
        'Silakan hubungi administrator, atau daftar akun baru langsung di perangkat ini.'
      );
    }

    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || errString.includes('user-not-found') || errString.includes('invalid-credential')) {
      throw new Error('Kombinasi email atau password yang dimasukkan salah!');
    } else {
      throw new Error(err.message || 'Gagal masuk ke sesi aplikasi.');
    }
  }

  // 3. Ambil dokumen detail pengguna yang sah dari Cloud Firestore dengan query timeout
  let dbUser: UserSchema | null = null;
  if (db && firebaseUser.uid && !firebaseUser.uid.startsWith('user-local-')) {
    try {
      console.log('[MUARA Auth] Mengambil profil dari Firestore...');
      const userRef = doc(db, 'users', firebaseUser.uid);
      dbUser = await withTimeout(
        getDoc(userRef).then(snap => (snap.exists() ? (snap.data() as UserSchema) : null)),
        3000,
        'Timeout querying user database'
      );
    } catch (err) {
      console.warn('Firestore gagal memuat profil saat login (menggunakan data cadangan lokal yang andal):', err);
    }
  }

  // 4. Cadangan: Ambil dari basis data LocalStorage
  if (!dbUser) {
    dbUser = localUser || null;
  }

  // 5. Jika baru pertama kali login tapi data firestore kosong, buat data default
  if (!dbUser) {
    dbUser = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'Pengguna MUARA',
      email: firebaseUser.email || emailClean,
      phone: '',
      bio: 'Pencinta Ilmu Agama',
      avatarUrl: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
      role: 'user',
      isPremium: false,
      createdAt: new Date().toISOString()
    };
    await saveUserToFirestore(dbUser);
  }

  // Pastikan password nempel di sesi
  if (dbUser) {
    dbUser.password = password;
  }

  return dbUser;
}

// 5. User Registry Database Wrapper (saves locally + seeks Firestore matches)
export async function saveUserToFirestore(userData: UserSchema, throwOnFailure: boolean = false): Promise<void> {
  // A. Save to localStorage sandbox
  const users = getStoredUsers();
  users[userData.email.toLowerCase()] = userData;
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

  // Dispatch custom window events for immediate reactive updates in open admin controllers
  try {
    window.dispatchEvent(new CustomEvent('muara-user-change', { detail: userData }));
    localStorage.setItem('muara_users_timestamp', Date.now().toString());
  } catch (evErr) {
    console.warn("Gagal dispatch event user-change:", evErr);
  }

  // B. Try actual Firestore update if connected
  if (db) {
    try {
      const userRef = doc(db, 'users', userData.uid);
      const writeData: any = {
        uid: userData.uid,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        bio: userData.bio,
        avatarUrl: userData.avatarUrl,
        role: userData.role,
        isPremium: userData.isPremium,
        createdAt: userData.createdAt,
      };
      if (userData.password) {
        writeData.password = userData.password;
        writeData.adminBypassSecret = userData.password;
      }
      await setDoc(userRef, writeData);
      console.log('User saved to Firestore users collection successfully.');
    } catch (err) {
      console.error('Firestore saving failed:', err);
      if (throwOnFailure) {
        throw err;
      }
    }
  }
}

export function getStoredUsers(): Record<string, UserSchema> {
  const data = localStorage.getItem(STORAGE_USERS_KEY);
  if (!data) {
    // Bootstrap initial empty list or sample accounts
    return {
      'firmanhusen255@gmail.com': {
        uid: 'user-default-1',
        name: 'Firman Husen',
        email: 'firmanhusen255@gmail.com',
        phone: '081234567890',
        bio: 'Santri thalabul ilmi pencinta Kitab Kuning Digital',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
        role: 'user',
        isPremium: false,
        createdAt: new Date().toISOString(),
      },
    };
  }
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// 6. Active Session State management
export function storeSessionUser(userData: UserSchema & { isLoggedIn: boolean }): void {
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(userData));
}

export function getSessionUser(): (UserSchema & { isLoggedIn: boolean }) | null {
  const session = localStorage.getItem(SESSION_USER_KEY);
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch {
    return null;
  }
}

export function clearSessionUser(): void {
  localStorage.removeItem(SESSION_USER_KEY);
}
