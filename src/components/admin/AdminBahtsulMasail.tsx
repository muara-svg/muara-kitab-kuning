import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Trash2, 
  Clock, 
  Settings, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle, 
  Heart, 
  Sliders, 
  Pin, 
  ArrowUp,
  AlertTriangle,
  Loader2,
  Calendar,
  X,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestore } from '../../lib/firebaseConfig';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';

interface AdminBahtsulMasailProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

interface MasailProblem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userBio: string;
  title: string;
  content: string;
  referenceKitab: string;
  likesCount: number;
  likedBy: string[];
  commentsCount: number;
  createdAt: string;
  pinned?: boolean;
  pinnedUntil?: string | null;
  aiAutoReplied?: boolean;
}

export default function AdminBahtsulMasail({ onSuccess, onError }: AdminBahtsulMasailProps) {
  const [activeSubTab, setActiveSubTab] = useState<'postingan' | 'pengaturan'>('postingan');
  const [problems, setProblems] = useState<MasailProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    postsLimit: 5,
    maxLifetimeHours: 0,
    enableSantriAI: true,
    santriAIDelayMinutes: 15
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // States for confirmation dialogs
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<MasailProblem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [bumpConfirmTarget, setBumpConfirmTarget] = useState<MasailProblem | null>(null);
  const [isBumping, setIsBumping] = useState(false);

  const [pinConfirmTarget, setPinConfirmTarget] = useState<MasailProblem | null>(null);
  const [selectedPinDuration, setSelectedPinDuration] = useState<number>(72);
  const [isPinning, setIsPinning] = useState(false);

  // Load postings & settings
  useEffect(() => {
    // 1. Fetch settings
    const loadSettings = async () => {
      try {
        const ref = doc(firestore, 'settings', 'bahtsul_masail');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setSettings({
            postsLimit: Number(d.postsLimit) || 5,
            maxLifetimeHours: Number(d.maxLifetimeHours) || 0,
            enableSantriAI: d.enableSantriAI !== undefined ? !!d.enableSantriAI : true,
            santriAIDelayMinutes: Number(d.santriAIDelayMinutes) || 15
          });
        } else {
          // Check local storage fallback
          const localSettingsStr = localStorage.getItem('muara_bahtsul_settings');
          if (localSettingsStr) {
            const parsed = JSON.parse(localSettingsStr);
            setSettings({
              postsLimit: parsed.postsLimit || 5,
              maxLifetimeHours: parsed.maxLifetimeHours || 0,
              enableSantriAI: parsed.enableSantriAI !== undefined ? !!parsed.enableSantriAI : true,
              santriAIDelayMinutes: Number(parsed.santriAIDelayMinutes) || 15
            });
          }
        }
      } catch (err) {
        console.warn("Error loading settings Firestore:", err);
        const localSettingsStr = localStorage.getItem('muara_bahtsul_settings');
        if (localSettingsStr) {
          try {
            const parsed = JSON.parse(localSettingsStr);
            setSettings({
              postsLimit: parsed.postsLimit || 5,
              maxLifetimeHours: parsed.maxLifetimeHours || 0,
              enableSantriAI: parsed.enableSantriAI !== undefined ? !!parsed.enableSantriAI : true,
              santriAIDelayMinutes: Number(parsed.santriAIDelayMinutes) || 15
            });
          } catch (e) {
            console.error(e);
          }
        }
      }
    };

    loadSettings();

    // 2. Realtime listener for posts
    const unsub = onSnapshot(collection(firestore, 'bahtsul_masail'), (snap) => {
      const list: MasailProblem[] = [];
      const nowMs = Date.now();
      snap.forEach((d) => {
        const data = d.data();
        
        // Active pin check
        const isStillPinned = !!data.pinned && (!data.pinnedUntil || new Date(data.pinnedUntil).getTime() > nowMs);
        
        // If expired, clean up Firestore in the background
        if (!!data.pinned && data.pinnedUntil && new Date(data.pinnedUntil).getTime() < nowMs) {
          updateDoc(doc(firestore, 'bahtsul_masail', d.id), {
            pinned: false,
            pinnedUntil: null
          }).catch((err) => console.warn("Background auto-unpin failed:", err));
        }

        list.push({
          id: d.id,
          userId: data.userId || '',
          userName: data.userName || '',
          userAvatar: data.userAvatar || '',
          userBio: data.userBio || '',
          title: data.title || '',
          content: data.content || '',
          referenceKitab: data.referenceKitab || '',
          likesCount: Number(data.likesCount || 0),
          likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
          commentsCount: Number(data.commentsCount || 0),
          createdAt: data.createdAt || new Date().toISOString(),
          pinned: isStillPinned,
          pinnedUntil: data.pinnedUntil || null,
          aiAutoReplied: !!data.aiAutoReplied
        });
      });

      // Sort: pinned first, then createdAt desc
      const sorted = list.sort((a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setProblems(sorted);
      setLoading(false);
    }, (err) => {
      console.warn("Bypassing firestore live database in Admin BM:", err);
      // Fallback local storage
      const cached = localStorage.getItem('muara_bahtsul_cache');
      if (cached) {
        try {
          const list: MasailProblem[] = JSON.parse(cached);
          const sorted = list.sort((a, b) => {
            const pinA = a.pinned ? 1 : 0;
            const pinB = b.pinned ? 1 : 0;
            if (pinA !== pinB) return pinB - pinA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setProblems(sorted);
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Save Settings handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const ref = doc(firestore, 'settings', 'bahtsul_masail');
      await setDoc(ref, settings, { merge: true });
      localStorage.setItem('muara_bahtsul_settings', JSON.stringify(settings));
      onSuccess("Pengaturan Bahtsul Masail berhasil disimpan!");
    } catch (err: any) {
      console.error(err);
      localStorage.setItem('muara_bahtsul_settings', JSON.stringify(settings));
      onSuccess("Pengaturan disimpan ke Penyimpanan Lokal (Offline Fallback).");
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete posting handler
  const handleDeletePost = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeleting(true);
    try {
      // 1. Delete from Firestore
      await deleteDoc(doc(firestore, 'bahtsul_masail', deleteConfirmTarget.id));
      
      // 2. Also remove from local list state just in case
      const updated = problems.filter(p => p.id !== deleteConfirmTarget.id);
      setProblems(updated);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(updated));

      onSuccess(`Postingan " ${deleteConfirmTarget.title} " berhasil dihapus secara permanen.`);
      setDeleteConfirmTarget(null);
    } catch (err: any) {
      console.error("Failed to delete post:", err);
      onError("Gagal menghapus postingan: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Pin and Unpin post actions with custom duration
  const handlePinPost = async () => {
    if (!pinConfirmTarget) return;
    setIsPinning(true);
    try {
      const durationMs = selectedPinDuration * 60 * 60 * 1000;
      const pinnedUntil = new Date(Date.now() + durationMs).toISOString();

      await updateDoc(doc(firestore, 'bahtsul_masail', pinConfirmTarget.id), {
        pinned: true,
        pinnedUntil: pinnedUntil
      });

      const updated = problems.map(p => p.id === pinConfirmTarget.id ? { ...p, pinned: true, pinnedUntil } : p);
      setProblems(updated);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(updated));

      onSuccess(`Postingan "${pinConfirmTarget.title}" berhasil disematkan selama ${selectedPinDuration} jam!`);
      setPinConfirmTarget(null);
    } catch (err: any) {
      console.error("Failed to pin post:", err);
      onError("Gagal menyematkan postingan: " + err.message);
    } finally {
      setIsPinning(false);
    }
  };

  const handleUnpinPost = async () => {
    if (!pinConfirmTarget) return;
    setIsPinning(true);
    try {
      await updateDoc(doc(firestore, 'bahtsul_masail', pinConfirmTarget.id), {
        pinned: false,
        pinnedUntil: null
      });

      const updated = problems.map(p => p.id === pinConfirmTarget.id ? { ...p, pinned: false, pinnedUntil: null } : p);
      setProblems(updated);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(updated));

      onSuccess(`Penyematan postingan "${pinConfirmTarget.title}" berhasil dilepas.`);
      setPinConfirmTarget(null);
    } catch (err: any) {
      console.error("Failed to unpin post:", err);
      onError("Gagal melepas sematan postingan: " + err.message);
    } finally {
      setIsPinning(false);
    }
  };

  // Naikan Postingan (Bump) to top (using date renewal after confirmation)
  const handleBumpPost = async () => {
    if (!bumpConfirmTarget) return;
    setIsBumping(true);
    const updatedTime = new Date().toISOString();
    try {
      await updateDoc(doc(firestore, 'bahtsul_masail', bumpConfirmTarget.id), {
        createdAt: updatedTime
      });
      
      const updated = problems.map(p => p.id === bumpConfirmTarget.id ? { ...p, createdAt: updatedTime } : p);
      setProblems(updated);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(updated));

      onSuccess("Postingan berhasil dinaikkan ke urutan paling atas!");
      setBumpConfirmTarget(null);
    } catch (err: any) {
      console.error("Gagal menaikkan postingan:", err);
      onError("Gagal menaikkan postingan: " + err.message);
    } finally {
      setIsBumping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Accent */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 select-none">
        <div>
          <h3 className="text-base font-extrabold text-[#064e3b] flex items-center gap-1.5 font-sans">
            <BookOpen className="h-5 w-5 text-emerald-600" /> Manajemen Bahtsul Masail
          </h3>
          <p className="text-xs text-slate-500 mt-1">Mengelola postingan umat, membersihkan database, dan mengatur parameter limitasi feed secara hierarki.</p>
        </div>

        {/* Dynamic Dual Tab Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          <button
            onClick={() => setActiveSubTab('postingan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border-none cursor-pointer ${
              activeSubTab === 'postingan' 
                ? 'bg-[#064e3b] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-950 bg-transparent'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Manajemen Postingan</span>
          </button>
          <button
            onClick={() => setActiveSubTab('pengaturan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border-none cursor-pointer ${
              activeSubTab === 'pengaturan' 
                ? 'bg-[#064e3b] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-950 bg-transparent'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Pengaturan Postingan</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'postingan' ? (
        /* MANAJEMEN POSTINGAN WORKSPACE */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              Total Diskusi Bahtsul Masail ({problems.length})
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              <span className="text-xs font-medium font-mono">Sinkronisasi Basis Data...</span>
            </div>
          ) : problems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <AlertCircle className="h-8 w-8 mx-auto text-amber-500/60 mb-2" />
              <span>Tidak ada postingan bahtsul masail yang terdeteksi di database.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {problems.map((prob) => {
                const ageHours = (Date.now() - new Date(prob.createdAt).getTime()) / (1000 * 3600);
                return (
                  <div 
                    key={prob.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col lg:flex-row gap-4 items-start ${
                      prob.pinned 
                        ? 'bg-amber-50/45 border-amber-205 shadow-3xs' 
                        : 'bg-white border-slate-150 hover:bg-slate-50/30'
                    }`}
                  >
                    {/* User profile & Post metadata */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <img 
                        src={prob.userAvatar} 
                        alt={prob.userName} 
                        className="h-10 w-10 rounded-full object-cover shrink-0 border border-emerald-800/10"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            {prob.userName}
                          </span>
                          {prob.pinned && (
                            <span className="text-[8px] font-extrabold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 uppercase tracking-wide leading-none shrink-0 scale-90">
                              <Pin className="h-2 w-2 fill-current" /> Pinned
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(prob.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-sm">{prob.userBio}</p>
                        
                        {/* Title and content */}
                        <div className="pt-2">
                          <h4 className="font-extrabold text-xs sm:text-sm text-[#064e3b] leading-snug">{prob.title}</h4>
                          <p className="text-slate-650 text-xs mt-1.5 leading-relaxed line-clamp-3 whitespace-pre-line">{prob.content}</p>
                        </div>

                        {/* Reference check */}
                        {prob.referenceKitab && (
                          <div className="mt-2 text-[9.5px] font-mono text-emerald-800 font-bold bg-emerald-50 rounded-lg py-1 px-2.5 w-fit flex items-center gap-1.5">
                            <BookOpen className="h-3 w-3" />
                            <span>Rujukan: {prob.referenceKitab}</span>
                          </div>
                        )}

                        {/* Social metadata row */}
                        <div className="flex items-center gap-3.5 pt-1 text-[10px] font-bold text-slate-500 font-mono">
                          <span className="flex items-center gap-0.5">
                            <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500/10" />
                            {prob.likesCount} Suka
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                            {prob.commentsCount} Tanggapan
                          </span>
                          <span className="flex items-center gap-0.5 text-slate-450 text-[9px] font-normal">
                            <Clock className="h-3 w-3" />
                            Umur Post: {ageHours < 1 ? 'Baru saja' : `${Math.floor(ageHours)} jam lalu`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Left control actions block */}
                    <div className="flex items-center lg:flex-col gap-2 shrink-0 self-end lg:self-start w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-none border-slate-100 justify-end">
                      {/* Bump / Naikkan postingan ke paling atas */}
                      <button
                        type="button"
                        onClick={() => setBumpConfirmTarget(prob)}
                        title="Naikkan postingan ini agar berada di urutan teratas feed utama"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors border-none cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        <span>Naikkan</span>
                      </button>

                      {/* Pin Post */}
                      <button
                        type="button"
                        onClick={() => setPinConfirmTarget(prob)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold transition-all border-none cursor-pointer ${
                          prob.pinned 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                            : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                        }`}
                      >
                        <Pin className={`h-3.5 w-3.5 ${prob.pinned ? 'fill-current text-amber-800' : ''}`} />
                        <span>{prob.pinned ? 'Unpin' : 'Pin / Semat'}</span>
                      </button>

                      {/* Delete Post Trigger */}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmTarget(prob)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border-none cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* PENGATURAN POSTINGAN FORM/WORKSPACE */
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-5 border border-slate-150 space-y-6 max-w-xl">
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm text-[#064e3b] flex items-center gap-1">
              <Sliders className="h-4 w-4" /> Parameter Database & Lifetime Postingan
            </h4>
            <p className="text-xs text-slate-500 leading-normal">Gunakan pengaturan di bawah ini untuk mencegah ukuran database melambung tinggi dan menjaga performa aplikasi premium MUARA tetap lancar.</p>
          </div>

          <div className="space-y-4">
            {/* Setting 1: Post Lifetime Limit */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Waktu Terbit Postingan (Penghapusan Otomatis)</label>
              <select
                value={settings.maxLifetimeHours}
                onChange={(e) => setSettings({ ...settings, maxLifetimeHours: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-250 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 transition-colors cursor-pointer"
              >
                <option value={0}>Selamanya (Tidak Terhapus Otomatis)</option>
                <option value={12}>12 Jam (Dibersihkan Setelah Setengah Hari)</option>
                <option value={24}>24 Jam (Dibersihkan Setelah 1 Hari)</option>
                <option value={48}>48 Jam (Dibersihkan Setelah 2 Hari)</option>
                <option value={72}>72 Jam (3 Hari - Rekomendasi)</option>
                <option value={168}>168 Jam (Dibersihkan Setelah 1 Minggu)</option>
              </select>
              <p className="text-[10px] text-slate-450 leading-relaxed">
                Postingan yang berumur melebihi hitungan jam yang Anda pilih secara otomatis tidak akan muncul atau terhapus langsung demi menghemat alokasi database.
              </p>
            </div>

            {/* Setting 2: Posts limit display threshold */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Jumlah Postingan Maksimum Per Halaman</label>
              <select
                value={settings.postsLimit}
                onChange={(e) => setSettings({ ...settings, postsLimit: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-250 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 transition-colors cursor-pointer"
              >
                <option value={3}>Tampilkan 3 Postingan Teratas</option>
                <option value={5}>Tampilkan 5 Postingan Teratas (Standar)</option>
                <option value={10}>Tampilkan 10 Postingan Teratas</option>
                <option value={15}>Tampilkan 15 Postingan Teratas</option>
                <option value={20}>Tampilkan 20 Postingan Teratas</option>
                <option value={25}>Tampilkan 25 Postingan Teratas</option>
                <option value={30}>Tampilkan 30 Postingan Teratas</option>
              </select>
              <p className="text-[10px] text-slate-450 leading-relaxed">
                Menentukan seberapa banyak tumpukan postingan bahtsul masail yang dirender pertama kali oleh aplikasi. Jika melebihi limit ini, tombol <strong className="text-emerald-700 font-bold">"Lihat Postingan Lainnya"</strong> akan otomatis muncul di bagian paling bawah tampilan pengguna.
              </p>
            </div>

            {/* Setting 3: Auto-reply Santri AI Toggle */}
            <div className="space-y-1.5 font-sans">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span>Pengaktifan Santri AI (Auto-Reply) pada Postingan</span>
              </label>
              <select
                value={settings.enableSantriAI ? "aktif" : "nonaktif"}
                onChange={(e) => setSettings({ ...settings, enableSantriAI: e.target.value === "aktif" })}
                className="w-full bg-slate-50 border border-slate-250 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 transition-colors cursor-pointer"
              >
                <option value="aktif">Aktif (Automated AI Assistant Jawaban Awal)</option>
                <option value="nonaktif">Nonaktif (Gunakan Diskusi Manual Antar Anggota Saja)</option>
              </select>
              <p className="text-[10px] text-slate-450 leading-relaxed">
                Jika diaktifkan, program background check akan memindai pertanyaan baru. Jika tidak ada asatidz/pengguna lain yang menjawab dalam waktu <span className="font-bold text-emerald-800">{settings.santriAIDelayMinutes || 15} menit</span>, "Santri AI" (Gemini Pro API) otomatis ikut merumuskan kesimpulan awal berbasis database kitab suci salaf-muktabaroh, lengkap dengan rujukan kitab yang bisa diklik langsung.
              </p>
            </div>

            {settings.enableSantriAI && (
              <div className="space-y-1.5 pl-4 border-l-2 border-emerald-500/20 font-sans">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Waktu Jawaban Santri AI (Delay Deteksi)</span>
                </label>
                <select
                  value={settings.santriAIDelayMinutes}
                  onChange={(e) => setSettings({ ...settings, santriAIDelayMinutes: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 transition-colors cursor-pointer"
                >
                  <option value={1}>1 Menit (Untuk Pengujian Instan)</option>
                  <option value={5}>5 Menit (Respons Sangat Cepat)</option>
                  <option value={10}>10 Menit (Premium Terjadwal)</option>
                  <option value={15}>15 Menit (Rekomendasi Standar)</option>
                  <option value={30}>30 Menit (Mode Santai)</option>
                  <option value={60}>60 Menit (1 Jam - Terencana)</option>
                </select>
                <p className="text-[10px] text-slate-450 leading-relaxed font-sans">
                  Menentukan berapa lama Santri AI akan menunggu bagi asatidz/pengguna nyata untuk merespon permasalahan baru sebelum akhirnya ia mencetuskan rumusan jawaban otomatis.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="py-3 px-6 bg-[#064e3b] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border-none flex items-center gap-2"
            >
              {savingSettings ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Konfigurasi</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* LUXURIOUS DELETE, BUMP, AND PIN CONFIRMATION MODALS */}
      <AnimatePresence>
        {deleteConfirmTarget && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 border border-slate-205 shadow-2xl max-w-sm w-full relative text-center overflow-hidden text-slate-800 font-sans"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-600" />
              
              <div className="space-y-4 pt-4">
                <div className="h-12 w-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mx-auto border border-rose-100 animate-pulse">
                  <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                    Konfirmasi Hapus Postingan
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    Apakah Anda bulat tekad ingin menghapus postingan bahtsul masail ini? 
                  </p>
                  <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/50 text-left text-rose-900 font-bold font-serif text-[11px] max-h-24 overflow-y-auto mt-2">
                    "{deleteConfirmTarget.title}"
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">
                    Tindakan ini permanen dan menghapus seluruh komentar asatidz terkait.
                  </p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeletePost}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition-colors shadow-sm cursor-pointer border-none flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span>Ya, Hapus</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeleteConfirmTarget(null)}
                    className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs transition-colors cursor-pointer bg-transparent"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* LUXURIOUS BUMP CONFIRMATION MODAL OVERLAY */}
        {bumpConfirmTarget && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 border border-slate-205 shadow-2xl max-w-sm w-full relative text-center overflow-hidden text-slate-800 font-sans"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-600" />
              
              <div className="space-y-4 pt-4">
                <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto border border-emerald-100">
                  <ArrowUp className="h-6 w-6 stroke-[2.5]" />
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                    Konfirmasi Naikkan Postingan
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    Apakah Anda yakin ingin menaikkan postingan bahtsul masail ini ke urutan paling atas di feed teratas pengguna?
                  </p>
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50 text-left text-emerald-900 font-bold font-serif text-[11px] max-h-24 overflow-y-auto mt-2">
                    "{bumpConfirmTarget.title}"
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">
                    Urutan ini akan diperbarui secara otomatis secara real-time.
                  </p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={isBumping}
                    onClick={handleBumpPost}
                    className="flex-1 py-2.5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition-colors shadow-sm cursor-pointer border-none flex items-center justify-center gap-1.5"
                  >
                    {isBumping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span>Ya, Naikkan</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBumping}
                    onClick={() => setBumpConfirmTarget(null)}
                    className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs transition-colors cursor-pointer bg-transparent"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* LUXURIOUS PIN CONFIRMATION & SELECTION MODAL OVERLAY */}
         {pinConfirmTarget && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 border border-slate-205 shadow-2xl max-w-md w-full relative overflow-hidden text-slate-800 font-sans"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-500" />
              
              {pinConfirmTarget.pinned ? (
                <div className="space-y-4 pt-4 text-center">
                  <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto border border-amber-100">
                    <Pin className="h-6 w-6 stroke-[2.5]" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                      Konfirmasi Lepas Penyematan
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                      Apakah Anda yakin ingin melepas status prioritas semat (Pinned) dari postingan berikut?
                    </p>
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 text-left text-amber-900 font-bold font-serif text-[11px] max-h-24 overflow-y-auto mt-2">
                      "{pinConfirmTarget.title}"
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      disabled={isPinning}
                      onClick={handleUnpinPost}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition-colors shadow-sm cursor-pointer border-none flex items-center justify-center gap-1.5"
                    >
                      {isPinning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>Ya, Lepas Pin</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPinning}
                      onClick={() => setPinConfirmTarget(null)}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs transition-colors cursor-pointer bg-transparent"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-4 text-left">
                  <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto border border-amber-100">
                    <Pin className="h-6 w-6 stroke-[2.5] fill-current" />
                  </div>
                  
                  <div className="space-y-1.5 text-center">
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                      Konfirmasi Sematkan Postingan
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                      Pilih berapa lama postingan berikut akan disematkan di paling atas forum Bahtsul Masail:
                    </p>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-slate-900 font-bold font-serif text-[11px] max-h-20 overflow-y-auto mt-2">
                      "{pinConfirmTarget.title}"
                    </div>
                  </div>

                  {/* HIGH-END DROPDOWN SELECTION FOR EXPIRATION TIMES */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Pilih Durasi Semat (Rentang Waktu)</label>
                    <select
                      value={selectedPinDuration}
                      onChange={(e) => setSelectedPinDuration(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-250 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 transition-colors cursor-pointer"
                    >
                      <option value={1}>1 Jam (Uji Coba Cepat)</option>
                      <option value={24}>24 Jam (1 Hari)</option>
                      <option value={48}>48 Jam (2 Hari)</option>
                      <option value={72}>72 Jam (3 Hari - Standar Kiai)</option>
                      <option value={168}>168 Jam (1 Minggu / 7 Hari)</option>
                      <option value={720}>720 Jam (30 Hari / 1 Bulan)</option>
                      <option value={4320}>4320 Jam (180 Hari / 6 Bulan)</option>
                      <option value={8640}>8640 Jam (360 Hari / 1 Tahun)</option>
                    </select>
                    <span className="text-[10px] text-slate-450 leading-relaxed block">
                      * Setelah durasi waktu habis, postingan akan otomatis turun ke urutan biasa sesuai tanggal terbitnya secara mandiri.
                    </span>
                  </div>

                  <div className="pt-2 flex gap-3 text-center">
                    <button
                      type="button"
                      disabled={isPinning}
                      onClick={handlePinPost}
                      className="flex-1 py-2.5 bg-[#064e3b] hover:bg-emerald-900 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition-colors shadow-sm cursor-pointer border-none flex items-center justify-center gap-1.5"
                    >
                      {isPinning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>Ya, Sematkan</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPinning}
                      onClick={() => setPinConfirmTarget(null)}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs transition-colors cursor-pointer bg-transparent"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
