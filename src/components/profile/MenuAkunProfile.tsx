import React, { useState, useRef } from 'react';
import { User, Mail, Phone, Lock, FileText, AlertCircle, CheckCircle, HelpCircle, ShieldAlert, Camera, UploadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { db, auth, saveUserToFirestore, UserSchema, validatePassword, uploadToCloudinary } from '../../lib/authService';

interface MenuAkunProfileProps {
  currentUser: UserSchema & { isLoggedIn: boolean };
  onUpdateSuccess: (updatedUser: UserSchema) => void;
  onClose: () => void;
}

export default function MenuAkunProfile({
  currentUser,
  onUpdateSuccess,
  onClose,
}: MenuAkunProfileProps) {
  // Input fields state
  const [name, setName] = useState(currentUser.name || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordForReauth, setCurrentPasswordForReauth] = useState('');

  // Profile Photo Upload States
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadPercent, setPhotoUploadPercent] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setErrorMsg('⚠️ Berkas harus berupa file gambar (JPG, PNG, WEBP).');
        return;
      }
      setIsUploadingPhoto(true);
      setPhotoUploadPercent(0);
      setErrorMsg('');
      try {
        const url = await uploadToCloudinary(file, (percent) => {
          setPhotoUploadPercent(percent);
        });
        setAvatarUrl(url);
        setSuccessMsg('✓ Foto berhasil diunggah! Tekan "Simpan Perubahan" di bawah untuk mengonfirmasi.');
      } catch (err: any) {
        console.error('Gagal mengunggah gambar:', err);
        setErrorMsg(`⚠️ Gagal mengunggah foto profil: ${err.message || 'Error koneksi'}`);
      } finally {
        setIsUploadingPhoto(false);
        setPhotoUploadPercent(null);
      }
    }
  };

  // UI state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  const validateInputs = (): boolean => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('⚠️ Nama lengkap wajib diisi.');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('⚠️ Alamat email tidak valid.');
      return false;
    }
    if (!phone.trim()) {
      setErrorMsg('⚠️ Nomor WhatsApp wajib diisi.');
      return false;
    }

    if (showPasswordFields && newPassword) {
      if (newPassword !== confirmPassword) {
        setErrorMsg('⚠️ Konfirmasi password tidak cocok dengan password baru.');
        return false;
      }
      const pwdRes = validatePassword(newPassword);
      if (!pwdRes.isValid) {
        setErrorMsg(`⚠️ ${pwdRes.message}`);
        return false;
      }
    }
    return true;
  };

  const handleTriggerSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateInputs()) {
      setShowConfirmDialog(true);
    }
  };

  const executeProfileUpdate = async (reauthPassword?: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
      const authUser = auth?.currentUser;

      // 1. If email or password is being changed in Firebase auth, we might need reauthentication
      if (authUser && (email.toLowerCase().trim() !== authUser.email?.toLowerCase().trim() || (showPasswordFields && newPassword))) {
        if (!reauthPassword) {
          // Trigger password confirmation
          setShowReauthModal(true);
          setIsSubmitting(false);
          return;
        }

        // Reauthenticate
        const credential = EmailAuthProvider.credential(authUser.email || '', reauthPassword);
        await reauthenticateWithCredential(authUser, credential);

        // Update email if changed
        if (email.toLowerCase().trim() !== authUser.email?.toLowerCase().trim()) {
          await updateEmail(authUser, email.trim());
        }

        // Update password if present
        if (showPasswordFields && newPassword) {
          await updatePassword(authUser, newPassword);
        }
      }

      // 2. Update schema profile in Firestore & Local storage
      const updatedUser: UserSchema = {
        uid: currentUser.uid,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl, // Gunakan tautan foto profil teranyar
        role: currentUser.role || 'user',
        isPremium: currentUser.isPremium,
        createdAt: currentUser.createdAt || new Date().toISOString(),
      };

      await saveUserToFirestore(updatedUser);
      onUpdateSuccess(updatedUser);
      setSuccessMsg('✓ Profil Anda berhasil diperbarui dengan sukses!');
      
      // Reset password fields
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordFields(false);
      setShowReauthModal(false);
      setCurrentPasswordForReauth('');

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Gagal memperbarui profil: ', err);
      let errMsg = 'Terjadi kesalahan saat memperbarui akun Anda.';
      if (err.code === 'auth/wrong-password') {
        errMsg = 'Sandi saat ini salah. Reautentikasi gagal.';
      } else if (err.code === 'auth/requires-recent-login') {
        errMsg = 'Sesi Anda kedaluwarsa. Silakan simpan ulang dan masukkan sandi Anda.';
      } else if (err.message) {
        errMsg = err.message;
      }
      setErrorMsg(`⚠️ Gagal diperbarui: ${errMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 font-sans text-slate-700">
      <div className="bg-emerald-50 text-emerald-950 p-4 rounded-xl border border-emerald-150 text-center mb-2">
        <h3 className="font-bold text-sm text-emerald-900">Perbarui Detail Akun Anda</h3>
        <p className="text-[10px] text-emerald-850 mt-0.5">Suku cadang pembukuan teologis dan akun santri digital</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-red-800 text-xs flex gap-2 items-start animate-shake">
          <AlertCircle className="h-4 w-4 text-red-650 shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-xs flex gap-2 items-start">
          <CheckCircle className="h-4 w-4 text-emerald-605 shrink-0 mt-0.5" />
          <span className="font-semibold leading-relaxed">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleTriggerSave} className="space-y-4">
        {/* Profile Photo Uploader (Drag-and-Drop / Custom Trigger) */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50/70 border border-slate-150 rounded-2xl mb-2 text-center">
          <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5 justify-center">
            <Camera className="h-3.5 w-3.5 text-emerald-600" /> Foto Profil Anda
          </label>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative cursor-pointer group hover:scale-105 transition-all duration-150 inline-block"
          >
            <div className="h-20 w-20 rounded-full overflow-hidden border-4 border-emerald-500 shadow-md relative bg-slate-150">
              <img 
                src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                alt="Avatar" 
                className={`h-full w-full object-cover transition-all group-hover:brightness-90 ${
                  isUploadingPhoto ? 'opacity-40 animate-pulse' : ''
                }`}
                referrerPolicy="no-referrer"
              />
              
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-[10px] font-mono font-bold">
                  <span>{photoUploadPercent !== null ? `${photoUploadPercent}%` : '...'}</span>
                </div>
              )}
            </div>
            
            {!isUploadingPhoto && (
              <div className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full border border-white shadow-xs">
                <Camera className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
          
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/*"
            className="hidden"
          />
          <p className="text-[10px] text-slate-400 mt-2.5">Klik lingkaran foto untuk memilih berkas profil terbaru Anda (PNG, JPG, WEBP)</p>
        </div>
        {/* Name */}
        <div>
          <label className="block text-xs font-bold text-slate-750 mb-1 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-400" /> Nama Lengkap
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-205 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50 hover:bg-slate-50 transition-colors"
            placeholder="Ketik nama lengkap Anda"
          />
        </div>

        {/* Bio / Description */}
        <div>
          <label className="block text-xs font-bold text-slate-755 mb-1 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-400" /> Deskripsi / Bio Singkat
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-205 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50 hover:bg-slate-50 transition-colors resize-none"
            placeholder="Status atau deskripsi singkat..."
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-slate-750 mb-1 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-slate-400" /> Alamat Email Aktif
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-205 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50 hover:bg-slate-50 transition-colors"
            placeholder="nama@email.com"
          />
        </div>

        {/* WhatsApp Phone */}
        <div>
          <label className="block text-xs font-bold text-slate-750 mb-1 flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-slate-400" /> Nomor Wa / Handphone
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-205 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-slate-50/50 hover:bg-slate-50 transition-colors"
            placeholder="Contoh: 0812xxxxxxxx"
          />
        </div>

        {/* Password Security Accordion Toggle */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowPasswordFields(!showPasswordFields)}
            className="text-xs font-bold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 px-3.5 py-2.5 rounded-xl border border-emerald-100 flex items-center justify-between w-full cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-600" /> Atur Ulang Katasandi (Password)
            </span>
            <span className="text-emerald-500">{showPasswordFields ? '▲ Tutup' : '▼ Klik disini'}</span>
          </button>
        </div>

        {showPasswordFields && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4 border border-slate-150 p-4 rounded-xl bg-slate-50/30 overflow-hidden"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Katasandi Baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter, huruf besar/kecil, angka, simbol"
                className="w-full rounded-xl border border-slate-205 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Konfirmasi Katasandi Baru</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi katasandi baru Anda"
                className="w-full rounded-xl border border-slate-205 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
              />
            </div>
            <p className="text-[10px] text-slate-450 leading-relaxed italic">
              Saran: Kata sandi yang kuat melestarikan data dari ancaman peretasan.
            </p>
          </motion.div>
        )}

        <div className="flex gap-2.5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 bg-white text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/10 active:scale-97"
          >
            {isSubmitting ? 'Memproses...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>

      {/* CONFIRMATION POPUP MODAL (MUST PROMPT BEFORE COMMITTING CHANGES) */}
      <AnimatePresence>
        {showConfirmDialog && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center space-y-4"
            >
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-800">Konfirmasi Perubahan Akun</h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Apakah Anda benar-benar yakin ingin memperbarui detail informasi profil dan akun Anda sekarang?
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => executeProfileUpdate()}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/15"
                >
                  Ya, Ubah Sekarang
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REAUTHENTICATION BACK-GATES DIALOG FOR SENSITIVE CHANGES */}
      <AnimatePresence>
        {showReauthModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 border-b pb-3 border-slate-100">
                <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800">Verifikasi Sandi Anda</h4>
                  <p className="text-[10px] text-slate-450">Konfirmasi keamanan sandi saat ini</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda melakukan perubahan sensitif (Email atau Kata Sandi). Harap masukkan <strong className="text-slate-800">katasandi saat ini</strong> Anda untuk memproses:
              </p>
              <div>
                <input
                  type="password"
                  required
                  placeholder="Ketik kata sandi saat ini"
                  value={currentPasswordForReauth}
                  onChange={(e) => setCurrentPasswordForReauth(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-red-500 focus:outline-hidden"
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setShowReauthModal(false);
                    setCurrentPasswordForReauth('');
                  }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl font-bold text-xs text-slate-650 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (!currentPasswordForReauth) {
                      setErrorMsg('⚠️ Masukkan password reautentikasi Anda yang sah.');
                    } else {
                      executeProfileUpdate(currentPasswordForReauth);
                    }
                  }}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-colors shadow-lg shadow-red-500/10"
                >
                  Verifikasi & Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
