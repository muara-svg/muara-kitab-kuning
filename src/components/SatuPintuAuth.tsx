import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  LogIn, 
  UploadCloud, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Phone, 
  Mail, 
  FileText,
  Lock,
  Camera,
  LogOut,
  Settings,
  ShieldAlert,
  Menu,
  ChevronRight,
  Star,
  Info,
  BookOpen,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  validatePassword, 
  uploadToCloudinary, 
  saveUserToFirestore, 
  storeSessionUser, 
  getStoredUsers, 
  UserSchema,
  registerFirebaseUser,
  loginFirebaseUser,
  auth,
  db
} from '../lib/authService';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Modal from './Modal';
import MenuAkunProfile from './profile/MenuAkunProfile';
import RiwayatBaca from './profile/RiwayatBaca';
import TentangAplikasi from './profile/TentangAplikasi';
import KebijakanPrivasi from './profile/KebijakanPrivasi';
import BeriRating from './profile/BeriRating';

const getFriendlyErrorMessage = (err: any, fallbackMessage: string): string => {
  const errText = String(err?.code || err?.message || err || '').toLowerCase();
  if (
    !navigator.onLine ||
    err?.code === 'auth/network-request-failed' ||
    errText.includes('firebase') ||
    errText.includes('network') ||
    errText.includes('offline') ||
    errText.includes('fetch failed') ||
    errText.includes('network-request-failed')
  ) {
    return 'bro miskin ya,beli paketnya dulu dong baru lanjutkan,,!!';
  }
  return fallbackMessage;
};

interface SatuPintuAuthProps {
  onAuthSuccess: (user: UserSchema) => void;
  onLogout: () => void;
  currentUser: (UserSchema & { isLoggedIn: boolean }) | null;
  onNavigateToAdmin: () => void;
}

export default function SatuPintuAuth({
  onAuthSuccess,
  onLogout,
  currentUser,
  onNavigateToAdmin
}: SatuPintuAuthProps) {
  // Modal view states: 'login' or 'register' or 'forgot_password'
  const [activeSegment, setActiveSegment] = useState<'login' | 'register' | 'forgot_password'>('login');
  
  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  
  // Sub-menus modals state
  const [activeSubMenu, setActiveSubMenu] = useState<'info_akun' | 'riwayat_baca' | 'tentang' | 'kebijakan' | 'rating' | null>(null);
  
  // Login field credentials
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register state holders
  const [regPhoto, setRegPhoto] = useState<File | null>(null);
  const [regPhotoUrl, setRegPhotoUrl] = useState('');
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [regName, setRegName] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live password validation state checker
  const [pwdChecks, setPwdChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    symbol: false,
  });

  useEffect(() => {
    setPwdChecks({
      length: regPassword.length >= 6,
      upper: /[A-Z]/.test(regPassword),
      lower: /[a-z]/.test(regPassword),
      number: /[0-9]/.test(regPassword),
      symbol: /[^A-Za-z0-9]/.test(regPassword)
    });
  }, [regPassword]);

  // Admin and normal Login submissions handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const emailClean = loginEmail.trim().toLowerCase();
      const user = await loginFirebaseUser(emailClean, loginPassword);
      
      const loggedUser = { ...user, isLoggedIn: true };
      storeSessionUser(loggedUser);
      onAuthSuccess(user);
      
      if (user.role === 'admin') {
        onNavigateToAdmin();
      }
      
      setLoginEmail('');
      setLoginPassword('');
    } catch (err: any) {
      console.error('Error logging in:', err);
      let msg = 'Kredensial tidak valid. Silakan gunakan password yang kuat atau registrasikan akun baru Anda.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email atau password tidak sesuai. Silakan periksa kembali akun Anda.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Format alamat email tidak valid.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Gagal terhubung ke jaringan. Silakan periksa koneksi internet Anda.';
      } else if (err.message) {
        msg = err.message;
      }
      setLoginError(getFriendlyErrorMessage(err, msg));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Forgot password form submission handler
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setIsSendingForgot(true);

    try {
      const emailClean = forgotEmail.trim().toLowerCase();
      
      // 1. Check format first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailClean || !emailRegex.test(emailClean)) {
        setForgotError('Format email salah!');
        setIsSendingForgot(false);
        return;
      }

      // 2. Comprehensive check if email exists in either local or firestore
      let exists = false;

      // Local storage sandbox
      const localUsers = getStoredUsers();
      if (localUsers[emailClean]) {
        exists = true;
      }

      // Live Firestore search
      if (!exists && db) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', emailClean));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            exists = true;
          }
        } catch (dbErr) {
          console.warn('Gagal verifikasi email dari Cloud Firestore:', dbErr);
        }
      }

      // special check for bypass admin email
      if (emailClean === 'official.hcsh@gmail.com') {
        exists = true;
      }

      if (!exists) {
        setForgotError('Email tidak terdaftar!');
        setIsSendingForgot(false);
        return;
      }

      // 3. Trigger Firebase sendPasswordResetEmail
      if (auth) {
        await sendPasswordResetEmail(auth, emailClean);
        setForgotSuccess(
          'Link reset password telah dikirim ke email Anda. Silakan periksa kotak masuk atau folder spam Anda.'
        );
        setForgotEmail('');

        // Automatically return to Login screen in 3 seconds
        setTimeout(() => {
          setActiveSegment('login');
          setForgotSuccess('');
        }, 3000);
      } else {
        throw new Error('Sistem autentikasi Firebase sedang offline.');
      }
    } catch (err: any) {
      console.error('Error sending password reset:', err);
      let errMsg = 'Gagal mengirim link reset password. Silakan coba sesaat lagi.';
      if (err.code === 'auth/invalid-email') {
        errMsg = 'Format email salah!';
      } else if (err.code === 'auth/user-not-found') {
        errMsg = 'Email tidak terdaftar!';
      } else if (err.message) {
        errMsg = err.message;
      }
      setForgotError(getFriendlyErrorMessage(err, errMsg));
    } finally {
      setIsSendingForgot(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        await processPhotoFile(file);
      } else {
        setRegError('Berkas harus berupa gambar (JPG, PNG, WEBP).');
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processPhotoFile(e.target.files[0]);
    }
  };

  const processPhotoFile = async (file: File) => {
    setRegError('');
    setIsPhotoUploading(true);
    setRegPhoto(file);
    try {
      // Simulate/perform actual Cloudinary Upload with percentage updates
      const simulatedUrl = await uploadToCloudinary(file, (percent) => {
        setUploadPercent(percent);
      });
      setRegPhotoUrl(simulatedUrl);
    } catch (err: any) {
      setRegError(err.message || 'Gagal mengunggah foto profil.');
    } finally {
      setIsPhotoUploading(false);
      setUploadPercent(null);
    }
  };

  // Registration handler with 7 comprehensive validations
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess(false);

    // 1. Full validations
    if (!regPhotoUrl) {
      setRegError('Silakan unggah foto profil Anda terlebih dahulu.');
      return;
    }
    if (!regName.trim()) {
      setRegError('Nama Lengkap tidak boleh kosong.');
      return;
    }
    if (regName.trim().length < 3) {
      setRegError('Nama Lengkap wajib minimal 3 karakter.');
      return;
    }
    if (!regBio.trim()) {
      setRegError('Silakan ceritakan biografi singkat Anda.');
      return;
    }
    if (!regPhone.trim()) {
      setRegError('Nomor HP aktif wajib diisi.');
      return;
    }
    
    const emailClean = regEmail.trim().toLowerCase();
    if (!emailClean) {
      setRegError('Alamat email aktif wajib diisi.');
      return;
    }

    // 2. Strict Password Validation
    const pwdValidation = validatePassword(regPassword);
    if (!pwdValidation.isValid) {
      setRegError(pwdValidation.message);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Konfirmasi Password tidak sesuai dengan Password Baru Anda.');
      return;
    }

    // Save user profile details
    const pendingUser: Omit<UserSchema, 'uid'> = {
      name: regName.trim(),
      email: emailClean,
      phone: regPhone.trim(),
      bio: regBio.trim(),
      avatarUrl: regPhotoUrl,
      role: 'user', // Default is strictly user (anti-escalation)
      isPremium: false, // Default state
      createdAt: new Date().toISOString(),
    };

    setIsPhotoUploading(true);
    try {
      // Save directly to Firebase Auth & Firestore
      const newUser = await registerFirebaseUser(pendingUser, regPassword);
      
      setRegSuccess(true);
      storeSessionUser({ ...newUser, isLoggedIn: true });
      onAuthSuccess(newUser);
      
      // Clear registration form fields
      setRegName('');
      setRegBio('');
      setRegPhone('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegPhoto(null);
      setRegPhotoUrl('');

      // Auto redirect to login segment
      setTimeout(() => {
        setActiveSegment('login');
        setRegSuccess(false);
      }, 2500);

    } catch (err: any) {
      console.error('Error during registration:', err);
      let msg = err.message || 'Gagal menyimpan registrasi pengguna.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Alamat email ini sudah terdaftar. Silakan login atau gunakan email lain.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Kata sandi dianggap terlalu lemah oleh sistem keamanan.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Format alamat email tidak sah.';
      }
      setRegError(getFriendlyErrorMessage(err, msg));
    } finally {
      setIsPhotoUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm max-w-md mx-auto my-4">
      {/* 1. Header Banner */}
      <div className="text-center space-y-2 mb-6">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-inner">
          <ShieldCheck className="h-7 w-7 text-emerald-600 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold font-sans text-slate-800">Portal Akun MUARA</h2>
        <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
          Silakan masuk atau daftar baru untuk mengakses ekosistem digital Kitab Kuning MUARA
        </p>
      </div>

      {currentUser?.isLoggedIn ? (
        // ------------------ ALREADY LOGGED IN VIEW ------------------
        <div className="space-y-6">
          <div className="text-center p-4 bg-emerald-500/5 rounded-2xl border border-emerald-100 flex flex-col items-center">
            <div className="relative">
              <img 
                src={currentUser.avatarUrl} 
                alt="Profile Avatar" 
                className="h-20 w-20 rounded-full border-2 border-emerald-500 object-cover shadow-md"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-0 right-1 bg-emerald-600 p-1 rounded-full border border-white text-white shadow-xs">
                <Camera className="h-3 w-3" />
              </div>
            </div>
            
            <h3 className="mt-3 font-bold text-slate-800 text-lg leading-snug">{currentUser.name}</h3>
            
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                currentUser.role === 'admin' 
                  ? 'bg-red-100 text-red-700 border border-red-200' 
                  : currentUser.isPremium 
                  ? 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                Role: {currentUser.role}
              </span>
              <span className="text-slate-350">•</span>
              <span className="text-[10px] text-slate-450 font-mono">ID: {currentUser.uid}</span>
            </div>

            <p className="mt-3 text-xs text-slate-500 italic max-w-sm px-4">"{currentUser.bio}"</p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-slate-50/30">
            <div className="p-3.5 px-4 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2.5 text-slate-550">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>Alamat Email</span>
              </div>
              <span className="font-semibold text-slate-750 font-mono">{currentUser.email}</span>
            </div>
            
            <div className="p-3.5 px-4 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2.5 text-slate-550">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>No. WhatsApp</span>
              </div>
              <span className="font-semibold text-slate-750 font-mono">{currentUser.phone}</span>
            </div>

            <div className="p-3.5 px-4 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2.5 text-slate-550">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Status Membership</span>
              </div>
              <span className="font-extrabold text-emerald-700">
                {currentUser.isPremium ? '★ PREMIUM VIP' : 'Gratis / Standard'}
              </span>
            </div>
          </div>

          {/* GRUP MENU UTAMA PROFILE (6 MENU REQ INDEPENDEN) */}
          <div className="space-y-2.5 pt-2">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1 font-sans">
              Menu Layanan & Pengaturan
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. MENU AKUN */}
              <button
                type="button"
                onClick={() => setActiveSubMenu('info_akun')}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 bg-white hover:border-emerald-200 hover:bg-emerald-50/10 hover:shadow-xs transition-with duration-200 text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-100/50 transition-colors">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Menu Akun</span>
                    <span className="block text-[9px] text-slate-450">Ubah data profil & sandi</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-350 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 2. MEMBERSHIP */}
              <button
                type="button"
                onClick={() => {
                  const btn = document.getElementById('menu-btn-membership');
                  if (btn) {
                    btn.click();
                  } else {
                    alert('Silakan gunakan tombol Membership pada halaman Beranda utama.');
                  }
                }}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 bg-white hover:border-amber-200 hover:bg-amber-50/10 hover:shadow-xs transition-with duration-200 text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 group-hover:bg-amber-100/50 transition-colors">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Membership</span>
                    <span className="block text-[9px] text-slate-450">👑 Kelola paket premium</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-350 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 3. RIWAYAT BACA */}
              <button
                type="button"
                onClick={() => setActiveSubMenu('riwayat_baca')}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 bg-white hover:border-blue-200 hover:bg-blue-50/10 hover:shadow-xs transition-with duration-200 text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 group-hover:bg-blue-100/50 transition-colors">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Riwayat Baca</span>
                    <span className="block text-[9px] text-slate-450">Catatan muthala'ah Anda</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-350 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 4. TENTANG APLIKASI */}
              <button
                type="button"
                onClick={() => setActiveSubMenu('tentang')}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 bg-white hover:border-indigo-200 hover:bg-indigo-50/10 hover:shadow-xs transition-with duration-200 text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-100/50 transition-colors">
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Tentang Aplikasi</span>
                    <span className="block text-[9px] text-slate-450">Informasi ekosistem MUARA</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-350 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 5. KEBIJAKAN PRIVASI */}
              <button
                type="button"
                onClick={() => setActiveSubMenu('kebijakan')}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 bg-white hover:border-teal-200 hover:bg-teal-50/10 hover:shadow-xs transition-with duration-200 text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-50 text-teal-600 border border-teal-100 group-hover:bg-teal-100/50 transition-colors">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Kebijakan Privasi</span>
                    <span className="block text-[9px] text-slate-450">Keamanan data santri digital</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-350 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 6. BERI RATING */}
              <button
                type="button"
                onClick={() => setActiveSubMenu('rating')}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-150 bg-white hover:border-yellow-250 hover:bg-yellow-50/10 hover:shadow-xs transition-with duration-200 text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600 border border-yellow-100 group-hover:bg-yellow-100/50 transition-colors">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Beri Rating</span>
                    <span className="block text-[9px] text-slate-450">Apresiasi platform kami</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-350 group-hover:text-yellow-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            {currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-[#064e3b] text-white hover:bg-emerald-950 transition-colors shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2"
              >
                <Settings className="h-4 w-4 animate-spin-slow" />
                Masuk Dashboard Admin
              </button>
            )}

            <button
              onClick={() => {
                onLogout();
              }}
              className="w-full py-3 border border-red-200 bg-red-50 text-red-650 rounded-xl font-bold text-xs hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Tutup Sesi / Keluar Akun
            </button>
          </div>

          {/* LAYER MODAL DENGAN FILE KODE EKSTERNAL SEBAGAI REKUES KHUSUS */}
          <Modal
            isOpen={activeSubMenu === 'info_akun'}
            onClose={() => setActiveSubMenu(null)}
            title="Ubah Profil & Data Akun"
          >
            <MenuAkunProfile
              currentUser={currentUser}
              onUpdateSuccess={onAuthSuccess}
              onClose={() => setActiveSubMenu(null)}
            />
          </Modal>

          <Modal
            isOpen={activeSubMenu === 'riwayat_baca'}
            onClose={() => setActiveSubMenu(null)}
            title="Riwayat Baca Muthala'ah"
          >
            <RiwayatBaca currentUser={currentUser} onClose={() => setActiveSubMenu(null)} />
          </Modal>

          {activeSubMenu === 'tentang' && (
            <TentangAplikasi onClose={() => setActiveSubMenu(null)} />
          )}

          {activeSubMenu === 'kebijakan' && (
            <KebijakanPrivasi onClose={() => setActiveSubMenu(null)} />
          )}

          <Modal
            isOpen={activeSubMenu === 'rating'}
            onClose={() => setActiveSubMenu(null)}
            title="Beri Rating Bintang 5"
          >
            <BeriRating onClose={() => setActiveSubMenu(null)} />
          </Modal>
        </div>
      ) : (
        // ------------------ SEGMENT SWITCHER ------------------
        <div>
          {activeSegment !== 'forgot_password' && (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button 
                type="button"
                onClick={() => {
                  setActiveSegment('login');
                  setRegError('');
                  setLoginError('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors duration-200 ${
                  activeSegment === 'login' 
                    ? 'bg-white text-emerald-800 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Log In Pasuk
              </button>
              <button 
                type="button"
                onClick={() => {
                  setActiveSegment('register');
                  setRegError('');
                  setLoginError('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors duration-200 ${
                  activeSegment === 'register' 
                    ? 'bg-white text-emerald-800 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Registrasi Baru
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeSegment === 'login' ? (
              // ------------------ FORM LOGIN ------------------
              <motion.form
                key="login-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleLoginSubmit} 
                className="space-y-4"
              >
                {loginError && (
                  <div className="p-3.5 bg-red-50 border border-red-150 rounded-xl text-red-800 text-xs flex gap-2 items-start shrink-0">
                    <AlertCircle className="h-4 w-4 text-red-600 pt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Aktif</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="email"
                      required
                      placeholder="contoh@domain.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-205 pl-10 pr-4 py-3 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kata Sandi</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input 
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-205 pl-10 pr-10 py-3 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-3.5 text-slate-450 hover:text-slate-750 focus:outline-hidden"
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSegment('forgot_password');
                        setForgotError('');
                        setForgotSuccess('');
                      }}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors focus:outline-hidden cursor-pointer"
                    >
                      Lupa Kata Sandi?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-login-gate"
                  disabled={isLoggingIn}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3.5 font-bold text-white text-xs shadow-lg shadow-emerald-600/10 transition-transform active:scale-95 duration-100 flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Sedang Masuk...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>Masuk Halaman</span>
                    </>
                  )}
                </button>
              </motion.form>
            ) : activeSegment === 'register' ? (
              // ------------------ FORM REGISTRASI (7 FIELDS) ------------------
              <motion.form
                key="register-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleRegisterSubmit} 
                className="space-y-4"
              >
                {regError && (
                  <div className="p-3.5 bg-red-50 border border-red-150 rounded-xl text-red-800 text-xs flex gap-2 items-start shrink-0">
                    <AlertCircle className="h-4 w-4 text-red-600 pt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                {regSuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-850 text-xs flex gap-2.5 items-start">
                    <CheckCircle className="h-5 w-5 text-emerald-600 pt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Registrasi Berhasil!</p>
                      <p className="text-[11px] mt-0.5 opacity-90">Akun Anda telah terdaftar secara aman. Mengalihkan ke sistem masuk...</p>
                    </div>
                  </div>
                )}

                {/* FILE 1: PROFILE PHOTO UPLOADER (DRAG & DROP + CLICK) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Foto Profil Anda</label>
                  
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      isDragging 
                        ? 'border-emerald-600 bg-emerald-500/5' 
                        : regPhotoUrl 
                        ? 'border-emerald-500/40 bg-emerald-50/20' 
                        : 'border-slate-300 hover:border-slate-450 bg-slate-50/40'
                    }`}
                  >
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />

                    {isPhotoUploading ? (
                      // Uplading status
                      <div className="space-y-2 py-2">
                        <div className="inline-block animate-spin rounded-full h-7 w-7 border-4 border-emerald-500 border-t-transparent" />
                        <p className="text-xs font-bold text-emerald-800">
                          Sedang mengunggah foto profil...
                        </p>
                        {uploadPercent !== null && (
                          <div className="w-40 mx-auto bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-600 h-full transition-all duration-100" style={{ width: `${uploadPercent}%` }} />
                          </div>
                        )}
                      </div>
                    ) : regPhotoUrl ? (
                      // Success loaded preview
                      <div className="flex items-center justify-center gap-3">
                        <img 
                          src={regPhotoUrl} 
                          alt="preview" 
                          className="h-14 w-14 rounded-full object-cover border-2 border-emerald-500 shadow-xs" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="text-left">
                          <span className="block text-xs font-extrabold text-emerald-800">Berhasil diunggah (Terkompresi otomatis)</span>
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[180px] block">
                            {regPhoto?.name || 'photo_profile.jpg'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      // Empty state
                      <div className="space-y-1.5 py-1 text-slate-500">
                        <UploadCloud className="h-8 w-8 mx-auto text-slate-400" />
                        <p className="text-xs font-bold text-slate-700">Tarik gambar ke sini, atau klik untuk memilih</p>
                        <p className="text-[10px] text-slate-400">Pastikan format foto (JPG, PNG) di bawah 3MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* FIELD 2: FULL NAME */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
                  <input 
                    type="text"
                    required
                    placeholder="Nama lengkap sesuai syahadah/KTP"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full rounded-xl border border-slate-205 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                  />
                </div>

                {/* FIELD 3: BIO */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Riwayat Singkat (Bio Wisuda/Santri)</label>
                  <textarea 
                    rows={1}
                    required
                    maxLength={150}
                    placeholder="Saya pencinta ilmu fiqih, thalabul ilmi di..."
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    className="w-full rounded-xl border border-slate-205 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50 resize-y"
                  />
                </div>

                {/* FIELD 4: PHONE NUMBER */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor HP / WhatsApp Aktif</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input 
                      type="tel"
                      required
                      placeholder="081234567890"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-205 pl-10 pr-4 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* FIELD 5: ACTIVE EMAIL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Email Aktif</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input 
                      type="email"
                      required
                      placeholder="alamat@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-205 pl-10 pr-4 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* FIELD 6: NEW PASSWORD */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kata Sandi Baru</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input 
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimal 6 karakter"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-205 pl-10 pr-10 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-3 text-slate-450 hover:text-slate-750 focus:outline-hidden"
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* ACTIVE PASSWORD REQUIREMENTS CHECKLISTS */}
                  <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-150 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${pwdChecks.length ? 'bg-emerald-500' : 'bg-slate-305 bg-slate-300'}`} />
                      <span className={pwdChecks.length ? 'text-emerald-700 font-semibold' : ''}>Min 6 Karakter</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${pwdChecks.upper ? 'bg-emerald-500' : 'bg-slate-305 bg-slate-300'}`} />
                      <span className={pwdChecks.upper ? 'text-emerald-700 font-semibold' : ''}>Huruf Kapital (A-Z)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${pwdChecks.lower ? 'bg-emerald-500' : 'bg-slate-305 bg-slate-300'}`} />
                      <span className={pwdChecks.lower ? 'text-emerald-700 font-semibold' : ''}>Huruf Kecil (a-z)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${pwdChecks.number ? 'bg-emerald-500' : 'bg-slate-305 bg-slate-300'}`} />
                      <span className={pwdChecks.number ? 'text-emerald-700 font-semibold' : ''}>Kombinasi Angka</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${pwdChecks.symbol ? 'bg-emerald-500' : 'bg-slate-355 bg-slate-300'}`} />
                      <span className={pwdChecks.symbol ? 'text-emerald-700 font-semibold' : ''}>Karakter Spesial (!,@,#,$,...)</span>
                    </div>
                  </div>
                </div>

                {/* FIELD 7: CONFIRM NEW PASSWORD */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Konfirmasi Kata Sandi Baru</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input 
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Masukkan sandi kembali"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-205 pl-10 pr-4 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-register-gate"
                  disabled={isPhotoUploading || isPhotoUploading}
                  className="w-full rounded-xl bg-slate-800 hover:bg-slate-905 py-3 font-bold text-white text-xs shadow-md transition-transform active:scale-95 duration-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Kirim Registrasi Pengguna
                </button>
              </motion.form>
            ) : (
              // ------------------ FORM RESET PASSWORD ------------------
              <motion.form
                key="forgot-password-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleForgotSubmit} 
                className="space-y-4"
              >
                <div className="text-center pb-2">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Lupa Kata Sandi</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Masukkan email aktif Anda. Kami akan mengirimkan link untuk mengatur ulang kata sandi Anda.</p>
                </div>

                {forgotError && (
                  <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-red-850 text-xs flex gap-2 items-start shrink-0">
                    <AlertCircle className="h-4 w-4 text-red-650 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                {forgotSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-850 text-xs flex gap-2.5 items-start">
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-[#064e3b]">Berhasil Terkirim!</p>
                      <p className="text-[10.5px] mt-0.5 leading-relaxed">{forgotSuccess}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Aktif</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="email"
                      required
                      placeholder="Masukkan email aktif terdaftar"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-205 pl-10 pr-4 py-3 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSendingForgot}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3.5 font-bold text-white text-xs shadow-lg shadow-emerald-600/10 transition-transform active:scale-95 duration-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingForgot ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>Mengirim Link...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Kirim Link Reset</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveSegment('login');
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    className="w-full py-2.5 font-bold text-slate-500 hover:text-slate-750 text-[11px] text-center flex items-center justify-center gap-1.5 focus:outline-hidden cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Login
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
