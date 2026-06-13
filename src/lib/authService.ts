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
    // 1. Buat credential pengguna baru di Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
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
    if (errString.includes('operation-not-allowed') || errString.includes('not-allowed')) {
      console.error(
        `[MUARA Firebase Error] Pendaftaran gagal di Firebase Auth karena Email/Password provider belum diaktifkan di Firebase Console.\n` +
        `Solusi: Silakan kunjungi Firebase Console Anda -> Build -> Authentication -> Sign-in method, lalu AKTIFKAN pilihan 'Email/Password' (Email dan Kata Sandi).\n` +
        `Sistem akan menggunakan fallback sandbox lokal untuk pendaftaran ini agar aplikasi tetap berjalan.`
      );
      firebaseUser = {
        uid: 'user-local-' + Math.random().toString(36).substring(2, 11),
        displayName: userData.name,
        email: userData.email,
        photoURL: userData.avatarUrl
      };
    } else {
      throw err;
    }
  }

  // 3. Masukkan data profil lengkap ke skema terstruktur
  const completedUser: UserSchema = {
    ...userData,
    uid: firebaseUser.uid, // Ambil UID resmi hasil generator Firebase Auth
    password: password // Simpan password untuk validasi cadangan virtual
  };

  // 4. Sinkronisasikan data profil ke Cloud Firestore 'users'
  await saveUserToFirestore(completedUser);

  return completedUser;
}

/**
 * Login akun pengguna via email sandi ke Firebase Authentication
 */
export async function loginFirebaseUser(email: string, password: string): Promise<UserSchema> {
  const emailClean = email.trim().toLowerCase();

  // Pemeriksaan Akun Admin Khusus Bypass untuk kedua super admin Resmi
  if ((emailClean === 'official.hcsh@gmail.com' || emailClean === 'firmanhusen255@gmail.com') && (password === 'Hcsh255@' || password === 'Santri255@')) {
    const adminUser: UserSchema = {
      uid: emailClean === 'official.hcsh@gmail.com' ? 'admin-official-hcsh' : 'admin-firman-husen',
      name: emailClean === 'official.hcsh@gmail.com' ? 'Official Admin MUARA (HCSH)' : 'Firman Husen (Developer)',
      email: emailClean,
      phone: emailClean === 'official.hcsh@gmail.com' ? '081122334455' : '081234567890',
      bio: emailClean === 'official.hcsh@gmail.com' ? 'Dewan Syuro Pendataan Kitab Kuning MUARA Digital' : 'Santri thalabul ilmi pencinta Kitab Kuning Digital',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=150',
      role: 'admin',
      isPremium: true,
      createdAt: new Date().toISOString(),
      password: password
    };

    // Hubungkan dengan autentikasi nyata di Firebase jika tersedia
    if (auth) {
      try {
        console.log('[MUARA Admin Auth] Mencoba menyamakan sesi ke Firebase Auth...');
        const userCredential = await signInWithEmailAndPassword(auth, emailClean, password);
        adminUser.uid = userCredential.user.uid;
        console.log('[MUARA Admin Auth] Berhasil masuk ke sesi Firebase Auth asli. UID:', adminUser.uid);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          try {
            console.log('[MUARA Admin Auth] Admin belum terdaftar di Firebase Auth. Mendaftarkan user baru...');
            const userCredential = await createUserWithEmailAndPassword(auth, emailClean, password);
            adminUser.uid = userCredential.user.uid;
            console.log('[MUARA Admin Auth] Pendaftaran berhasil. UID:', adminUser.uid);
          } catch (createErr) {
            console.warn('[MUARA Admin Auth] Gagal menginisiasi user admin baru:', createErr);
          }
        } else if (err.code === 'auth/operation-not-allowed') {
          console.warn('[MUARA Admin Auth] Email/Password login tidak diizinkan di Firebase Console. Menggunakan UID admin bypass lokal.');
        } else {
          console.warn('[MUARA Admin Auth] Sinkronisasi sesi admin gagal, menggunakan fallback lokal:', err.message);
        }
      }

      // Pastikan data admin tertulis di Firestore ke koleksi /users dan /admins agar sesuai Security Rules
      if (db) {
        try {
          console.log('[MUARA Admin DB] Menulis dokumen user/admin...');
          await setDoc(doc(db, 'users', adminUser.uid), {
            uid: adminUser.uid,
            name: adminUser.name,
            email: adminUser.email,
            phone: adminUser.phone,
            bio: adminUser.bio,
            avatarUrl: adminUser.avatarUrl,
            role: 'admin',
            isPremium: true,
            createdAt: adminUser.createdAt,
            password: adminUser.password
          });
          // Set juga di /admins untuk rules 'exists'
          await setDoc(doc(db, 'admins', adminUser.uid), {
            uid: adminUser.uid,
            email: adminUser.email
          });
          console.log('[MUARA Admin DB] Berhasil mendaftarkan privilese admin resmi di Firestore.');
        } catch (dbErr) {
          console.warn('[MUARA Admin DB] Gagal sinkronisasi data Admin ke Firestore:', dbErr);
        }
      }
    }

    return adminUser;
  }

  if (!auth) {
    throw new Error('Sistem penanganan login Firebase Auth tidak aktif.');
  }

  // 1. Melakukan Autentikasi Masuk via SDK Firebase dengan penanganan fallback
  let firebaseUser: any = null;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, emailClean, password);
    firebaseUser = userCredential.user;
  } catch (err: any) {
    console.warn('[MUARA Auth] Percobaan login Firebase Auth berkendala:', err.code || err.message);
    
    // Check if fallback account exists in Cloud Firestore (local_auth_fallbacks database-backed bypass)
    let dbFallbackDoc = null;
    if (db) {
      try {
        dbFallbackDoc = await getDoc(doc(db, 'local_auth_fallbacks', emailClean));
      } catch (fsErr) {
        console.warn('[MUARA Auth] Gagal memuat database fallback dari Firestore:', fsErr);
      }
    }

    // Also check standard Firestore users collection as a fallback database check
    let dbUserDoc = null;
    if (db && !dbFallbackDoc?.exists()) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', emailClean));
        const qSnapshot = await getDocs(q);
        if (!qSnapshot.empty) {
          dbUserDoc = qSnapshot.docs[0];
        }
      } catch (fsErr) {
        console.warn('[MUARA Auth] Gagal memuat database users dari Firestore:', fsErr);
      }
    }

    if (dbFallbackDoc && dbFallbackDoc.exists()) {
      const fallbackData = dbFallbackDoc.data();
      if (fallbackData.password === password) {
        console.log('[MUARA Auth] Login berhasil menggunakan jalur bypass aman Cloud Database Core (local_auth_fallbacks).');
        firebaseUser = {
          uid: fallbackData.uid,
          displayName: fallbackData.name,
          email: fallbackData.email,
          photoURL: fallbackData.avatarUrl || ''
        };
      } else {
        throw new Error('Gagal masuk: Password yang Anda masukkan tidak cocok!');
      }
    } else if (dbUserDoc && dbUserDoc.exists()) {
      const userData = dbUserDoc.data();
      if (userData.password === password) {
        console.log('[MUARA Auth] Login berhasil menggunakan jalur bypass aman Cloud Database Core (users).');
        firebaseUser = {
          uid: userData.uid,
          displayName: userData.name,
          email: userData.email,
          photoURL: userData.avatarUrl || ''
        };
      } else {
        throw new Error('Gagal masuk: Password yang Anda masukkan tidak cocok!');
      }
    } else {
      // If no Cloud Fallback exists, run default handlers
      const errString = String(err?.code || err?.message || err || '');
      if (errString.includes('operation-not-allowed') || errString.includes('not-allowed')) {
        console.warn('[MUARA Auth Fallback] Email/Password provider isn\'t enabled on Firebase console. Falling back to local storage auth.');
        const localUsers = getStoredUsers();
        const localUser = localUsers[emailClean];
        if (localUser) {
          if (!localUser.password || localUser.password === password) {
            firebaseUser = {
              uid: localUser.uid,
              displayName: localUser.name,
              email: localUser.email,
              photoURL: localUser.avatarUrl
            };
          } else {
            throw new Error('Email atau password tidak sesuai. Silakan periksa kembali akun Anda.');
          }
        } else {
          throw new Error('Akun belum terdaftar. Silakan hubungi admin utama untuk membuatkan akun staff atau gunakan password superadmin.');
        }
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || errString.includes('user-not-found') || errString.includes('invalid-credential')) {
        throw new Error('Kombinasi email atau password yang dimasukkan salah!');
      } else {
        throw new Error(err.message || 'Gagal masuk ke sesi aplikasi.');
      }
    }
  }

  // 2. Ambil dokumen detail pengguna yang sah dari Cloud Firestore
  let dbUser: UserSchema | null = null;
  if (db && firebaseUser.uid && !firebaseUser.uid.startsWith('user-local-')) {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        dbUser = snapshot.data() as UserSchema;
      }
    } catch (err) {
      console.warn('Firestore gagal memuat profil saat login (menggunakan data cadangan lokal yang andal):', err);
    }
  }

  // 3. Cadangan: Ambil dari basis data LocalStorage
  if (!dbUser) {
    const localUsers = getStoredUsers();
    dbUser = localUsers[emailClean] || null;
  }

  // 4. Jika baru pertama kali login tapi data firestore kosong, buat data default
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

  // Ensure password is attached to session so that database operations can use fallback auth bypass when needed
  if (dbUser) {
    dbUser.password = password;
  }

  return dbUser;
}

// 5. User Registry Database Wrapper (saves locally + seeks Firestore matches)
export async function saveUserToFirestore(userData: UserSchema): Promise<void> {
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
      }
      await setDoc(userRef, writeData);
      console.log('User saved to Firestore users collection successfully.');
    } catch (err) {
      console.warn('Firestore saving bypassed or offline (relying on active local sandboxes):', err);
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
