import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, Phone, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import Modal from './Modal';
import { UserProfile } from '../types';
import { renderUserAvatar } from './SatuPintuAuth';

interface MenuLoginAkunProps {
  userProfile: UserProfile;
  onLogin: (name: string, email: string, phone: string) => void;
  onLogout: () => void;
  onLoginClick?: () => void;
}

export default function MenuLoginAkun({
  userProfile,
  onLogin,
  onLogout,
  onLoginClick,
}: MenuLoginAkunProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');

  useEffect(() => {
    const handleBackButton = (e: any) => {
      if (isOpen) {
        setIsOpen(false);
        e.detail?.consume?.();
      }
    };
    window.addEventListener('muara-hardware-back-button', handleBackButton);
    return () => {
      window.removeEventListener('muara-hardware-back-button', handleBackButton);
    };
  }, [isOpen]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName || !loginEmail) return;
    onLogin(loginName, loginEmail, loginPhone || '081234567895');
    setLoginName('');
    setLoginEmail('');
    setLoginPhone('');
    setIsOpen(false);
  };

  const handleButtonClick = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        id="menu-btn-akun"
        onClick={handleButtonClick}
        className="flex flex-col items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-center transition-all bg-gradient-to-br from-slate-50 to-emerald-50/20 border-emerald-100 hover:border-emerald-200 hover:shadow-md cursor-pointer"
      >
        <div className="flex items-center justify-center h-[42px] w-[42px] sm:h-12 sm:w-12 rounded-full bg-emerald-100 text-emerald-600 mb-1.5 sm:mb-2 shrink-0">
          {userProfile.isLoggedIn ? (
            renderUserAvatar(userProfile.avatarUrl, userProfile.name, "h-8 w-8 sm:h-10 sm:w-10 text-xs sm:text-sm")
          ) : (
            <LogIn className="h-5 w-5 sm:h-6 sm:w-6" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[11px] sm:text-xs font-bold text-slate-800 truncate">
            {userProfile.isLoggedIn ? 'Profil Saya' : 'Login Akun'}
          </span>
          <span className="text-[9px] sm:text-[10px] text-slate-450 truncate max-w-[120px] block font-medium">
            {userProfile.isLoggedIn ? userProfile.name : 'Masuk Dashboard'}
          </span>
        </div>
      </motion.button>

      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title={userProfile.isLoggedIn ? "Profil Anggota MUARA" : "Masuk ke MUARA"}
      >
        {userProfile.isLoggedIn ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 p-4 rounded-2xl border border-emerald-100">
              {renderUserAvatar(userProfile.avatarUrl, userProfile.name, "h-16 w-16 text-lg")}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-base">{userProfile.name}</h3>
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
                    userProfile.membershipStatus === 'Premium Verified' 
                      ? 'bg-yellow-150 text-yellow-700 border border-yellow-300 shadow-xs' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {userProfile.membershipStatus === 'Premium Verified' ? '👑 Premium Verified' : 'Gratis'}
                  </span>
                </div>
                <p className="text-xs text-slate-450 italic mt-0.5">"{userProfile.bio}"</p>
                {userProfile.expiresAt && (
                  <p className="text-[10px] text-emerald-700 font-medium mt-1">Berlaku s/d: {userProfile.expiresAt}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3 text-slate-700">
                <div className="rounded-lg bg-white p-2 border border-slate-150 text-emerald-600">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Nomor HP</span>
                  <span className="text-xs font-mono font-semibold">{userProfile.phone}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-700 border-t border-slate-100 pt-3">
                <div className="rounded-lg bg-white p-2 border border-slate-150 text-emerald-600">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Alamat Email</span>
                  <span className="text-xs font-semibold">{userProfile.email}</span>
                </div>
              </div>
            </div>

            {/* Download App & Offline Kitab section */}
            <div className="space-y-2 bg-emerald-50/40 p-3 sm:p-4 rounded-xl border border-emerald-100 text-slate-800">
              <span className="block text-[11px] font-bold text-emerald-800 uppercase tracking-widest">
                📦 AKSES LURING & DUKUNGAN APLIKASI
              </span>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Anda dapat mengunduh file aplikasi format luring (.APK) untuk dipasang di perangkat seluler Android, atau memperbarui berkas untuk akses luar jaringan secara komprehensif.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                <a
                  href="https://github.com/firmanhusen255/muara-kuning/releases/download/v1.0.0/muara_santri_v1.apk"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold text-center transition-colors shadow-xs"
                >
                  Download APK
                </a>
                <button
                  type="button"
                  onClick={() => {
                    alert("Seluruh modul kitab kuning sedang dipre-load kembali ke database IndexedDB luring secara aman!");
                    window.dispatchEvent(new CustomEvent('muara-trigger-redownload'));
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-755 rounded-lg text-[10px] font-bold text-center transition-colors cursor-pointer"
                >
                  Reload Storage
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="btn-logout-submit"
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                <LogOut className="h-4.5 w-4.5" />
                Keluar Akun
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 mb-4 text-center leading-relaxed">
              Masuk untuk menyinkronkan riwayat hafalan Al-Quran, catatan kitab kuning, dan memesan paket belajar Premium.
            </p>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                placeholder="Masukkan nama lengkap Anda"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Aktif</label>
              <input
                type="email"
                required
                placeholder="nama@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp (Opsional)</label>
              <input
                type="tel"
                placeholder="081234567890"
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              id="btn-login-submit"
              className="w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white shadow-lg shadow-emerald-600/10 transition-transform active:scale-95"
            >
              Masuk Sekarang
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
