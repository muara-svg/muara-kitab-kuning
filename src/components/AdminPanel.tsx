import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Tag, 
  BookOpen, 
  Users, 
  CheckSquare, 
  Heart, 
  BellRing, 
  LogOut, 
  Loader2, 
  CheckCircle,
  FileText,
  QrCode,
  CreditCard,
  Sliders,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestore } from '../lib/firebaseConfig';

// Import modularized components
import AdminDashboard from './admin/AdminDashboard';
import AdminKategori from './admin/AdminKategori';
import AdminKitab from './admin/AdminKitab';
import AdminNotifikasi from './admin/AdminNotifikasi';
import AdminPlaceholder from './admin/AdminPlaceholder';
import AdminMember from './admin/AdminMember';
import AdminPengajuan from './admin/AdminPengajuan';
import AdminUserManagement from './admin/AdminUserManagement';
import AdminPayments from './admin/AdminPayments';
import AdminSedekah from './admin/AdminSedekah';
import AdminOpsiTambahan from './admin/AdminOpsiTambahan';
import AdminBahtsulMasail from './admin/AdminBahtsulMasail';
import RoleManagement from './admin/RoleManagement';

interface AdminPanelProps {
  onLogout: () => void;
}

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kategori' | 'notifikasi' | 'kitab' | 'users_management' | 'member' | 'pengajuan' | 'bahtsul_masail' | 'sedekah' | 'pembayaran' | 'opsi_tambahan' | 'role_management'>('dashboard');
  const [selectedSubOpsi, setSelectedSubOpsi] = useState<'tentang' | 'kebijakan' | 'rating'>('tentang');
  const [isDropdownOpsiOpen, setIsDropdownOpsiOpen] = useState(false);
  const [selectedSubBahtsul, setSelectedSubBahtsul] = useState<'postingan' | 'pengaturan'>('postingan');
  const [isDropdownBahtsulOpen, setIsDropdownBahtsulOpen] = useState(false);

  // Active admin session parsing & RBAC security helpers
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const sess = localStorage.getItem('muara_current_session');
      if (sess) {
        setCurrentUser(JSON.parse(sess));
      }
    } catch (e) {
      console.error("Error reading admin session:", e);
    }
  }, []);

  const isSuperAdmin = currentUser && (
    currentUser.email?.toLowerCase() === 'firmanhusen255@gmail.com' || 
    currentUser.email?.toLowerCase() === 'firmanhusen255@gmeil.com' || 
    currentUser.email?.toLowerCase() === 'official.hcsh@gmail.com' ||
    currentUser.email?.toLowerCase() === 'official.hcsh@gmeil.com'
  );

  const hasPermission = (featureKey: string) => {
    if (isSuperAdmin) return true;
    if (!currentUser) return false;
    const userPerms = currentUser.permissions || {};
    return !!userPerms[featureKey];
  };

  // Redirect if Active Tab is unpermitted on session loaded / changed
  useEffect(() => {
    if (currentUser) {
      const allowed = 
        activeTab === 'dashboard' || 
        (activeTab === 'role_management' && isSuperAdmin) || 
        hasPermission(activeTab);
        
      if (!allowed) {
        setActiveTab('dashboard');
      }
    }
  }, [activeTab, currentUser]);

  // Common notification feedback manager
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  // Auto timeout alerts
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  const handleSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setRefreshTrigger(prev => !prev);
  };

  const handleError = (msg: string) => {
    setErrorMsg(msg);
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col font-sans">
      {/* HEADER UTAMA ADMIN */}
      <div className="bg-[#064e3b] text-white py-4.5 px-6 shadow-md flex items-center justify-between border-b border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm md:text-base tracking-wide uppercase">
              MUARA Admin Panel
            </h1>
            <p className="text-[10px] text-emerald-200 font-medium">Sistem Manajemen Konten & Layanan Literasi Kitab Kuning</p>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-1 bg-red-650/40 hover:bg-red-600 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-red-500/10 text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Keluar Admin
        </button>
      </div>

      {/* FEEDBACK STATUS BAR */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-6 mt-4 p-3.5 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 text-xs font-bold shadow-xs flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-6 mt-4 p-3.5 rounded-xl border border-red-150 bg-red-50 text-red-800 text-xs font-bold shadow-xs flex items-center gap-2"
          >
            <span className="p-1 rounded-full bg-red-600 text-white font-bold text-[9px] w-4 h-4 flex items-center justify-center">X</span>
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BODY UTAMA LAYOUT */}
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-4 gap-6 self-stretch">
        
        {/* RESPONSIVE NAVIGATION LIST (SIDEBAR) */}
        <div className="md:col-span-1 space-y-1.5">
          <h2 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-2 font-mono">Daftar Modul Manajemen</h2>
          
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'dashboard' 
                  ? 'bg-emerald-800 text-white shadow-xs' 
                  : 'text-slate-650 hover:bg-slate-200'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>1. Dashboard (Statistik)</span>
            </button>

            {hasPermission('kategori') && (
              <button
                onClick={() => setActiveTab('kategori')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'kategori' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <Tag className="h-4 w-4 shrink-0" />
                <span>2. Kategori Kitab</span>
              </button>
            )}

            {hasPermission('notifikasi') && (
              <button
                onClick={() => setActiveTab('notifikasi')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'notifikasi' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <BellRing className="h-4 w-4 shrink-0" />
                <span>3. Kirim Notifikasi</span>
              </button>
            )}

            {hasPermission('kitab') && (
              <button
                onClick={() => setActiveTab('kitab')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'kitab' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span>4. Manajemen Kitab</span>
              </button>
            )}

            {hasPermission('users_management') && (
              <button
                onClick={() => setActiveTab('users_management')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'users_management' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">5. Manajemen Pengguna</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">New</span>
              </button>
            )}

            {hasPermission('member') && (
              <button
                onClick={() => setActiveTab('member')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'member' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">6. Basis Data Member</span>
              </button>
            )}

            {hasPermission('pengajuan') && (
              <button
                onClick={() => setActiveTab('pengajuan')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'pengajuan' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <CheckSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">7. Pengajuan VIP</span>
              </button>
            )}

            {/* 8. Manajemen Bahtsul Masail (Sub Menu Dropdown) */}
            {hasPermission('bahtsul_masail') && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownBahtsulOpen(!isDropdownBahtsulOpen);
                    setActiveTab('bahtsul_masail');
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    activeTab === 'bahtsul_masail' 
                      ? 'bg-emerald-800 text-white shadow-xs' 
                      : 'text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span>8. Bahtsul Masail Hub</span>
                  </div>
                  {isDropdownBahtsulOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 opacity-70" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  )}
                </button>

                <AnimatePresence>
                  {isDropdownBahtsulOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-emerald-100 ml-4.5 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('bahtsul_masail');
                          setSelectedSubBahtsul('postingan');
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-all ${
                          activeTab === 'bahtsul_masail' && selectedSubBahtsul === 'postingan'
                            ? 'bg-emerald-50 text-emerald-900 font-extrabold'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Manajemen Postingan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('bahtsul_masail');
                          setSelectedSubBahtsul('pengaturan');
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-all ${
                          activeTab === 'bahtsul_masail' && selectedSubBahtsul === 'pengaturan'
                            ? 'bg-emerald-50 text-emerald-900 font-extrabold'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Pengaturan Postingan</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {hasPermission('sedekah') && (
              <button
                onClick={() => setActiveTab('sedekah')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'sedekah' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <Heart className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">9. Santunan Sedekah</span>
              </button>
            )}

            {hasPermission('pembayaran') && (
              <button
                onClick={() => setActiveTab('pembayaran')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'pembayaran' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <QrCode className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">10. Sistem Pembayaran</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">New</span>
              </button>
            )}

            {/* 11. Opsi Tambahan (Sub Menu Dropdown) */}
            {hasPermission('opsi_tambahan') && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpsiOpen(!isDropdownOpsiOpen);
                    setActiveTab('opsi_tambahan');
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    activeTab === 'opsi_tambahan' 
                      ? 'bg-emerald-800 text-white shadow-xs' 
                      : 'text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="h-4 w-4 shrink-0 text-emerald-450" />
                    <span>11. Opsi Tambahan</span>
                  </div>
                  {isDropdownOpsiOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 opacity-70" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  )}
                </button>

                <AnimatePresence>
                  {isDropdownOpsiOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-emerald-100 ml-4.5 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('opsi_tambahan');
                          setSelectedSubOpsi('tentang');
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-all ${
                          activeTab === 'opsi_tambahan' && selectedSubOpsi === 'tentang'
                            ? 'bg-emerald-50 text-emerald-900 font-extrabold'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>About App / Tentang</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('opsi_tambahan');
                          setSelectedSubOpsi('kebijakan');
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-all ${
                          activeTab === 'opsi_tambahan' && selectedSubOpsi === 'kebijakan'
                            ? 'bg-emerald-50 text-emerald-900 font-extrabold'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Kebijakan Privasi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('opsi_tambahan');
                          setSelectedSubOpsi('rating');
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-all ${
                          activeTab === 'opsi_tambahan' && selectedSubOpsi === 'rating'
                            ? 'bg-emerald-50 text-emerald-900 font-extrabold'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Beri Rating</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('role_management')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTab === 'role_management' 
                    ? 'bg-emerald-800 text-white shadow-xs' 
                    : 'text-slate-650 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>12. Manajemen Role & Staff</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-650 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 text-left"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Keluar Sesi Admin</span>
            </button>
          </nav>
        </div>

        {/* DETAILS MENUS TARGETS DISPLAY */}
        <div className="md:col-span-3 bg-white border border-slate-205 rounded-3xl p-5 md:p-6 shadow-xs min-h-[460px]">
          {activeTab === 'dashboard' && (
            <AdminDashboard onRefreshTrigger={() => {}} />
          )}

          {activeTab === 'kategori' && (
            <AdminKategori 
              onSuccess={handleSuccess} 
              onError={handleError} 
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeTab === 'notifikasi' && (
            <AdminNotifikasi 
              onSuccess={handleSuccess} 
              onError={handleError} 
            />
          )}

          {activeTab === 'kitab' && (
            <AdminKitab 
              onSuccess={handleSuccess} 
              onError={handleError} 
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeTab === 'users_management' && (
            <AdminUserManagement />
          )}

          {activeTab === 'member' && (
            <AdminMember 
              onSuccess={handleSuccess} 
              onError={handleError} 
            />
          )}

          {activeTab === 'pengajuan' && (
            <AdminPengajuan 
              onSuccess={handleSuccess} 
              onError={handleError} 
            />
          )}

          {activeTab === 'bahtsul_masail' && (
            <AdminBahtsulMasail 
              onSuccess={handleSuccess} 
              onError={handleError} 
            />
          )}

          {activeTab === 'sedekah' && (
            <AdminSedekah 
              onSuccess={handleSuccess} 
              onError={handleError} 
            />
          )}

          {activeTab === 'pembayaran' && (
            <AdminPayments 
              onSuccess={handleSuccess} 
              onError={handleError} 
            />
          )}

          {activeTab === 'opsi_tambahan' && (
            <AdminOpsiTambahan 
              onSuccess={handleSuccess} 
              onError={handleError}
              initialTab={selectedSubOpsi}
            />
          )}

          {activeTab === 'role_management' && (
            <RoleManagement />
          )}
        </div>

      </div>
    </div>
  );
}
