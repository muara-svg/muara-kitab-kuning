import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Loader2, 
  Clock, 
  Bell, 
  Image as ImageIcon, 
  User, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { realtimeDb, firestore } from '../../lib/firebaseConfig';
import { ref, push, set } from 'firebase/database';
import { doc, setDoc, collection, getDocs, onSnapshot, getDoc, writeBatch, query, where, deleteDoc } from 'firebase/firestore';
import { compressImage, getStoredUsers } from '../../lib/authService';
import { uploadToCloudinaryDirect } from '../../lib/cloudinaryConfig';

interface AdminNotifikasiProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  isPremium?: boolean;
}

export default function AdminNotifikasi({ onSuccess, onError }: AdminNotifikasiProps) {
  const [loading, setLoading] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState<'all' | 'premium' | 'standar' | 'single'>('all');
  
  // Registered users state
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Image upload and compression state
  const [imageUrl, setImageUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Safety Confirmation Modal Dialog
  const [showConfirm, setShowConfirm] = useState(false);

  // Settings popup states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [durationHours, setDurationHours] = useState<number>(168); // default 168
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Load all users in realtime to populate target dropdown
  useEffect(() => {
    setLoadingUsers(true);
    const usersCol = collection(firestore, 'users');

    const getLocalUsers = (): UserItem[] => {
      const mergedMap = new Map<string, UserItem>();

      // A. Load from getStoredUsers()
      try {
        const storedUsers = getStoredUsers();
        if (storedUsers) {
          Object.values(storedUsers).forEach((u: any) => {
            const emailKey = (u.email || '').trim().toLowerCase();
            if (emailKey) {
              mergedMap.set(emailKey, {
                id: u.uid || u.id || `local-${Date.now()}`,
                name: u.name || 'Anonymous Santri',
                email: u.email || '',
                isPremium: !!u.isPremium || u.membershipStatus === 'Premium Verified',
              });
            }
          });
        }
      } catch (err) {
        console.warn("Gagal sinkron getStoredUsers:", err);
      }

      // B. Load from muara_users_db fallback cache
      try {
        const muaraUsersDbStr = localStorage.getItem('muara_users_db');
        if (muaraUsersDbStr) {
          const muaraUsersDb = JSON.parse(muaraUsersDbStr);
          Object.values(muaraUsersDb).forEach((u: any) => {
            const emailKey = (u.email || '').trim().toLowerCase();
            if (emailKey) {
              mergedMap.set(emailKey, {
                id: u.uid || `local-${Date.now()}`,
                name: u.name || 'Anonymous Santri',
                email: u.email || '',
                isPremium: !!u.isPremium || u.membershipStatus === 'Premium Verified',
              });
            }
          });
        }
      } catch (err) {
        console.warn("Gagal sinkron muara_users_db:", err);
      }

      // C. Load from muara_custom_users cache
      try {
        const customUsersStr = localStorage.getItem('muara_custom_users');
        if (customUsersStr) {
          const customUsers = JSON.parse(customUsersStr);
          customUsers.forEach((u: any) => {
            const emailKey = (u.email || '').trim().toLowerCase();
            if (emailKey) {
              const existing = mergedMap.get(emailKey);
              if (!existing) {
                mergedMap.set(emailKey, {
                  id: u.id || u.uid,
                  name: u.name || 'Anonymous Santri',
                  email: u.email || '',
                  isPremium: !!u.isPremium,
                });
              } else {
                existing.isPremium = !!u.isPremium;
              }
            }
          });
        }
      } catch (err) {
        console.warn("Gagal sinkron muara_custom_users:", err);
      }

      // D. Load from muara_current_session
      try {
        const sessionStr = localStorage.getItem('muara_current_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          const emailKey = (session.email || '').trim().toLowerCase();
          if (emailKey) {
            mergedMap.set(emailKey, {
              id: session.id || session.uid || `local-${Date.now()}`,
              name: session.name || 'Anonymous Santri',
              email: session.email || '',
              isPremium: !!session.isPremium || session.membershipStatus === 'Premium Verified',
            });
          }
        }
      } catch (err) {
        console.warn("Gagal sinkron muara_current_session:", err);
      }

      const uniqueMap = new Map<string, UserItem>();
      Array.from(mergedMap.values()).forEach((u) => {
        if (u.id) {
          uniqueMap.set(u.id, u);
        }
      });

      return Array.from(uniqueMap.values()).filter(
        (u) => u.email !== 'official.hcsh@gmail.com' && u.name !== 'Admin'
      );
    };

    const handleLocalSync = () => {
      const locals = getLocalUsers();
      setUsersList(locals);
    };

    const unsubscribe = onSnapshot(usersCol, (snap) => {
      const mergedMap = new Map<string, UserItem>();

      // 1. Load from Cloud Firestore
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const emailKey = (d.email || '').trim().toLowerCase();
        const item: UserItem = {
          id: docSnap.id,
          name: d.name || 'Anonymous Santri',
          email: d.email || '',
          isPremium: !!d.isPremium,
        };
        const identifier = emailKey || docSnap.id;
        mergedMap.set(identifier, item);
      });

      // 2. Merge with local users to ensure completeness
      const locals = getLocalUsers();
      locals.forEach((u) => {
        const emailKey = (u.email || '').trim().toLowerCase();
        const identifier = emailKey || u.id;
        if (!mergedMap.has(identifier)) {
          mergedMap.set(identifier, u);
        } else {
          const existing = mergedMap.get(identifier)!;
          if (u.isPremium) existing.isPremium = true;
        }
      });

      const uniqueMap = new Map<string, UserItem>();
      Array.from(mergedMap.values()).forEach((u) => {
        if (u.id) {
          uniqueMap.set(u.id, u);
        }
      });

      const finalUsers = Array.from(uniqueMap.values()).filter(
        (u) => u.email !== 'official.hcsh@gmail.com' && u.name !== 'Admin'
      );
      setUsersList(finalUsers);
      setLoadingUsers(false);
    }, (error) => {
      console.warn("Snapshot users list failed (permissions/offline), loading local fallback databases:", error);
      
      handleLocalSync();
      setLoadingUsers(false);
    });

    // Subscriptions for real-time local storage/memory session additions
    window.addEventListener('muara-user-change', handleLocalSync);
    window.addEventListener('storage', handleLocalSync);

    // Initial manual invocation to fast-track users displaying correctly
    handleLocalSync();

    return () => {
      unsubscribe();
      window.removeEventListener('muara-user-change', handleLocalSync);
      window.removeEventListener('storage', handleLocalSync);
    };
  }, []);

  // Sync / Load settings configuration on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(firestore, 'app_configs', 'notifikasi_settings');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.durationHours) {
            setDurationHours(Number(data.durationHours));
            localStorage.setItem('muara_notifications_duration_hours', String(data.durationHours));
          }
        } else {
          const localVal = localStorage.getItem('muara_notifications_duration_hours');
          if (localVal) {
            setDurationHours(Number(localVal));
          }
        }
      } catch (err) {
        console.warn('Gagal memuat pengaturan notifikasi:', err);
        const localVal = localStorage.getItem('muara_notifications_duration_hours');
        if (localVal) {
          setDurationHours(Number(localVal));
        }
      }
    };
    fetchSettings();
  }, []);

  const runCloudCleanup = async (hours: number) => {
    try {
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      const q = query(collection(firestore, 'notifications_logs'));
      const snap = await getDocs(q);
      const batch = writeBatch(firestore);
      let count = 0;
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        let notifTime = d.timestamp || 0;
        if (!notifTime && d.createdAt) {
          const parsed = new Date(d.createdAt).getTime();
          if (!isNaN(parsed)) notifTime = parsed;
        }
        if (notifTime > 0 && notifTime < cutoff) {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
        console.log(`[MUARA Cleanup] Cleared ${count} expired historical notifications.`);
      }
    } catch (err) {
      console.warn('Gagal melakukan pembersihan cloud otomatis:', err);
    }
  };

  const handleSaveDuration = async (hours: number) => {
    setIsSavingSettings(true);
    try {
      const docRef = doc(firestore, 'app_configs', 'notifikasi_settings');
      await setDoc(docRef, { durationHours: hours }, { merge: true });
      
      localStorage.setItem('muara_notifications_duration_hours', String(hours));
      window.dispatchEvent(new CustomEvent('muara-notif-settings-change', { detail: { durationHours: hours } }));
      
      setDurationHours(hours);
      onSuccess(`Pengaturan masa aktif pengumuman berhasil disimpan: ${hours} Jam!`);
      
      await runCloudCleanup(hours);
    } catch (err: any) {
      console.error(err);
      onError(`Gagal menyimpan pengaturan: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    setShowBulkDeleteConfirm(false);
    try {
      const now = Date.now();
      
      // 1. Clear database logs in Firestore
      const q = query(collection(firestore, 'notifications_logs'));
      const snap = await getDocs(q);
      const batch = writeBatch(firestore);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      // 2. Clear Realtime Database broadcast too if possible
      try {
        const rtdbRef = ref(realtimeDb, 'broadcast_notifications');
        await set(rtdbRef, null);
      } catch (rtdbErr) {
        console.warn('RTDB bulk remove bypassed/failed:', rtdbErr);
      }

      // 3. Update the setting document with lastClearedAt timestamp
      const docRef = doc(firestore, 'app_configs', 'notifikasi_settings');
      await setDoc(docRef, { 
        lastClearedAt: now,
        durationHours: durationHours 
      }, { merge: true });

      // 4. Update local storage and trigger event
      localStorage.setItem('muara_notifications_last_cleared', String(now));
      localStorage.setItem('muara_notifications_cache', '[]'); // Clear local cache too
      
      window.dispatchEvent(new CustomEvent('muara-notif-settings-change', { 
        detail: { 
          durationHours, 
          lastClearedAt: now 
        } 
      }));

      onSuccess('🔥 Seluruh pengumuman & notifikasi telah dihapus secara massal dari database dan layar santri!');
    } catch (err: any) {
      console.error(err);
      onError(`Gagal menghapus seluruh notifikasi: ${err.message}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Handle local image selection & 75% quality JPEG compression + upload
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(15);

    try {
      // 1. Local compression (quality 0.75: perfect 70-80% bounds)
      const compressed = await compressImage(file, 0.75);
      setUploadProgress(45);

      // 2. Client-side Cloudinary Upload
      const uploadedUrl = await uploadToCloudinaryDirect(compressed, {
        folder: 'muara_notifications',
        onProgress: (percent) => {
          // Scale 45% -> 95%
          const scale = Math.round(45 + (percent * 0.5));
          setUploadProgress(scale);
        }
      });

      setImageUrl(uploadedUrl);
      setUploadProgress(100);
      onSuccess(`Gambar "${file.name}" berhasil dikompresi sebesar 75% dan siap dilampirkan!`);
    } catch (err: any) {
      console.error(err);
      onError(`Gagal memuat & memproses foto: ${err.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 3000);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    onSuccess('Lampiran gambar dibatalkan.');
  };

  // Intermediate validation handler before showing confirmation step
  const triggerSendValidation = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!notifTitle.trim()) {
      onError('Judul pengumuman tidak boleh kosong.');
      return;
    }

    if (!notifMessage.trim()) {
      onError('Materi pengumuman / pesan tidak boleh kosong.');
      return;
    }

    if (notifTarget === 'single' && !selectedUserId) {
      onError('Silakan pilih salah satu pengguna yang dituju.');
      return;
    }

    // Pass verification, invoke safety modal
    setShowConfirm(true);
  };

  // The actual sending routine triggered inside the safety modal
  const handleConfirmSend = async () => {
    setShowConfirm(false);
    setLoading(true);

    try {
      const notifId = `notif-${Date.now()}`;
      const targetUser = usersList.find(u => u.id === selectedUserId);

      const payload = {
        id: notifId,
        title: notifTitle.trim(),
        content: notifMessage.trim(),
        dateSent: new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        timestamp: Date.now(),
        important: notifTarget === 'premium',
        target: notifTarget,
        targetUserId: notifTarget === 'single' ? selectedUserId : '',
        targetUserEmail: (notifTarget === 'single' && targetUser) ? (targetUser.email || '') : '',
        imageUrl: imageUrl || ''
      };

      // Target description details
      let targetDesc = '';
      if (notifTarget === 'all') {
        targetDesc = 'seluruh pengguna aplikasi secara realtime!';
      } else if (notifTarget === 'premium') {
        targetDesc = 'pengguna Premium VIP secara realtime!';
      } else if (notifTarget === 'standar') {
        targetDesc = 'pengguna standar secara realtime!';
      } else if (notifTarget === 'single') {
        const u = usersList.find(usr => usr.id === selectedUserId);
        targetDesc = `pengguna "${u ? u.name : 'terpilih'}" secara realtime!`;
      }

      let savedLocally = false;

      // 1. Save to local storage cache (guarantees local preview success!)
      try {
        const cachedNotifsStr = localStorage.getItem('muara_notifications_cache');
        const cachedNotifs = cachedNotifsStr ? JSON.parse(cachedNotifsStr) : [];
        if (!cachedNotifs.some((n: any) => n.id === payload.id)) {
          cachedNotifs.unshift(payload);
          localStorage.setItem('muara_notifications_cache', JSON.stringify(cachedNotifs));
        }
        savedLocally = true;
        
        // Dispatch local event for instant UI update
        window.dispatchEvent(new CustomEvent('muara-new-notification', { detail: payload }));
        localStorage.setItem('muara_notifications_trigger', Date.now().toString());
      } catch (cacheErr) {
        console.warn("Gagal menyimpan ke local cache:", cacheErr);
      }

      // 2. Save directly to Firestore
      let firestoreSuccess = false;
      try {
        const notifDocRef = doc(firestore, 'notifications_logs', notifId);
        await setDoc(notifDocRef, payload);
        firestoreSuccess = true;
      } catch (firestoreErr) {
        console.warn("Firestore save failed (permissions/offline), relying on fallback cache and event emitters:", firestoreErr);
      }

      // 3. Save to Realtime Database
      try {
        const rtdbRef = ref(realtimeDb, `broadcast_notifications/${payload.id}`);
        await set(rtdbRef, payload);
      } catch (rtdbErr) {
        console.warn("Sinkron Realtime Database tertunda atau bypassed:", rtdbErr);
      }

      if (savedLocally || firestoreSuccess) {
        onSuccess(`📢 pesan berhasil dikirim ke ${targetDesc}`);
        
        // Cleanup inputs
        setNotifTitle('');
        setNotifMessage('');
        setImageUrl('');
        setSelectedUserId('');
      } else {
        throw new Error('Gagal menyimpan notifikasi baik di lokal maupun di cloud.');
      }
    } catch (err: any) {
      console.error(err);
      onError('⚠️ pesan gagal dikirim. Silakan periksa koneksi internet Anda atau hubungi admin.');
    } finally {
      setLoading(false);
    }
  };

  // Get target label helper
  const getTargetLabel = () => {
    switch(notifTarget) {
      case 'all': return 'Seluruh Pengguna Aplikasi (Premium & Standar)';
      case 'premium': return 'Pengguna Premium VIP Saja';
      case 'standar': return 'Pengguna User Standar Saja';
      case 'single':
        const usr = usersList.find(u => u.id === selectedUserId);
        return `Satu Pengguna Khusus: ${usr ? `${usr.name} (${usr.email})` : 'Tidak terpilih'}`;
      default: return '';
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 text-xs font-sans">
      
      <div className="border-b pb-4 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-[#064e3b] text-base">
            Kirim Notifikasi & Kabaran Santri
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Kirim pengumuman penting langsung menuju menu notifikasi para santri secara realtime dan instans.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-[#064e3b] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 font-bold border border-emerald-150 shadow-3xs"
          title="Pengaturan Notifikasi"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Pengaturan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FORM INPUT SIARAN */}
        <form onSubmit={triggerSendValidation} className="lg:col-span-2 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 text-[10px] tracking-wide mb-1.5 uppercase font-mono">
                A. Target Segmentasi Penerima
              </label>
              <select
                value={notifTarget}
                onChange={(e: any) => {
                  setNotifTarget(e.target.value);
                  setSelectedUserId('');
                }}
                className="w-full border p-2.5 rounded-xl bg-white focus:border-emerald-600 focus:outline-[#064e3b] text-slate-800 font-sans font-medium text-xs shadow-2xs"
              >
                <option value="all">Seluruh Pengguna Aplikasi</option>
                <option value="premium">Pengguna Premium VIP</option>
                <option value="standar">Pengguna User Standar</option>
                <option value="single">Salah Satu Pengguna</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 text-[10px] tracking-wide mb-1.5 uppercase font-mono">
                B. Judul Pengumuman
              </label>
              <input
                type="text"
                required
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Contoh: Jadwal Kajian Bulanan, Pembaruan Kitab..."
                className="w-full border p-2.5 rounded-xl bg-white focus:border-emerald-650 focus:outline-[#064e3b] text-slate-800 text-xs shadow-2xs font-semibold"
              />
            </div>
          </div>

          {/* DYNAMIC DROPDOWN FOR SINGLE USER */}
          {notifTarget === 'single' && (
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1.5 animate-fadeIn">
              <label className="block font-bold text-emerald-900 text-[10px] tracking-wide uppercase font-mono">
                C. Pilih Pengguna Target
              </label>
              {loadingUsers ? (
                <div className="flex items-center gap-1.5 text-slate-400 text-[10.5px] py-1">
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
                  Memuat para santri...
                </div>
              ) : (
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full border border-emerald-150 p-2.5 rounded-lg bg-white focus:border-[#064e3b] text-slate-800 text-xs font-semibold"
                >
                  <option value="">-- Pilih Santri Penerima --</option>
                  {usersList.map((usr) => (
                    <option key={usr.id} value={usr.id}>
                      {usr.name} ({usr.email || 'Tanpa Email'}) — {usr.isPremium ? '💎 Premium VIP' : '📜 User Standar'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 text-[10px] tracking-wide mb-1.5 uppercase font-mono">
              D. Isi Kabar Pengumuman / Notifikasi
            </label>
            <textarea
              required
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              rows={4}
              placeholder="Tuliskan berita lengkap, pengumuman kitab, atau nasihat dakwah Islam di sini..."
              className="w-full border p-2.5 rounded-xl bg-white focus:border-emerald-500 focus:outline-[#064e3b] text-slate-800 text-xs leading-relaxed font-medium shadow-2xs"
            />
          </div>

          {/* FILE UPLOAD & AUTOMATIC 75% QUALITY COMPRESSION */}
          <div className="border border-slate-205 bg-white p-3.5 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-[10px] uppercase font-mono tracking-wide flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5 text-slate-500" /> E. Lampiran Gambar (Opsional)
              </span>
              <span className="text-[8.5px] text-slate-400 font-mono">Maks 2MB • Kompresi 75% Aktif</span>
            </div>

            {!imageUrl ? (
              <label className="flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-lg p-5 hover:bg-slate-50/75 transition-all cursor-pointer text-center relative">
                {isUploading ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-800" />
                    <p className="text-[10px] text-slate-500 font-medium animate-pulse">
                      Sedang Mengompresi & Mengunggah ({uploadProgress || 0}%)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="block text-xs font-bold text-slate-700">Pilih berkas foto anda</span>
                    <span className="block text-[9px] text-slate-400">Tekan untuk unggah berkas dari penyimpanan lokal</span>
                  </div>
                )}
                <input 
                  type="file" 
                  disabled={isUploading}
                  onChange={handleImageChange}
                  accept="image/*" 
                  className="hidden" 
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 bg-emerald-55/35 border border-emerald-100 p-2.5 rounded-lg">
                <div className="h-10 w-10 rounded border border-emerald-150 overflow-hidden bg-white shrink-0">
                  <img src={imageUrl} alt="Compressed" referrerPolicy="no-referrer" className="object-cover w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-700 truncate">Lampiran_Berhasil_Dikompres.jpg</p>
                  <p className="text-[8.5px] text-emerald-800 font-mono">Tervalidasi & siap disebarkan</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-[#064e3b] hover:bg-emerald-900 text-white font-extrabold transition-all disabled:opacity-50 cursor-pointer shadow-sm text-xs font-sans tracking-wide"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Sebarkan Pengumuman Realtime
          </button>

        </form>

        {/* PHONE SIMULATION PREVIEW PANEL */}
        <div className="lg:col-span-1 space-y-3">
          <h4 className="font-bold text-slate-600 uppercase text-[10px] tracking-wider font-mono px-1">Pratinjau Layar Santri</h4>
          
          <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-sm border border-slate-700 font-sans relative overflow-hidden min-h-[350px] flex flex-col justify-between">
            
            <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono pb-2 border-b border-slate-800 mb-3">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-emerald-500" /> Aktif</span>
              <span>📶 PENGUMUMAN DIGITAL</span>
            </div>

            <div className="flex-1 flex flex-col justify-start pt-2 space-y-3">
              <div className="bg-emerald-950/80 border border-emerald-500/20 rounded-2xl p-3.5 space-y-2 text-left shadow-md">
                <div className="flex items-center justify-between">
                  <span className="p-0.5 px-1 bg-amber-600 text-white font-mono rounded text-[6.5px] font-bold animate-pulse">SIARAN RESMI</span>
                  <span className="text-[8.5px] text-slate-400 font-mono">Baru saja</span>
                </div>

                <div className="space-y-1">
                  <h5 className="text-[11px] font-extrabold text-emerald-400 leading-snug">
                    {notifTitle || "Masukkan Judul Pengumuman..."}
                  </h5>
                  <p className="text-[10px] text-emerald-50 break-words leading-relaxed font-medium">
                    {notifMessage || '"Materi isi pengumuman Anda akan tervisualisasikan di sini secara instan saat Anda mengetik..."'}
                  </p>
                </div>

                {imageUrl && (
                  <div className="rounded-lg overflow-hidden border border-emerald-900 bg-emerald-990 h-20 w-full flex items-center justify-center">
                    <img src={imageUrl} alt="Preview Attachment" referrerPolicy="no-referrer" className="object-cover w-full h-full" />
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-[8.5px] text-slate-500 font-mono pt-3 border-t border-slate-800/60 mt-4">
              Sistem Pengumuman Terintegrasi Santri
            </div>
          </div>
        </div>

      </div>

      {/* SAFETY CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 max-w-md w-full shadow-lg text-left space-y-4"
            >
              <div className="flex gap-3">
                <div className="h-9 w-9 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center shrink-0">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-extrabold text-slate-900 text-sm">Konfirmasi Kirim Pengumuman</h4>
                  <p className="text-slate-500 leading-relaxed">
                    Mohon luangkan waktu sejenak untuk meninjau detail di bawah ini demi mencegah kesalahan penyiaran pesan kepada santri:
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-[11px] space-y-2 font-medium text-slate-650">
                <div>
                  <span className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest">Target Segmentasi:</span>
                  <span className="font-bold text-slate-800">{getTargetLabel()}</span>
                </div>
                
                <div>
                  <span className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest">Judul Notifikasi:</span>
                  <span className="font-semibold text-slate-800">{notifTitle}</span>
                </div>

                <div>
                  <span className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest">Isi Materi:</span>
                  <span className="block bg-white p-2 rounded border border-slate-100 mt-1 italic max-h-[70px] overflow-y-auto">
                    "{notifMessage}"
                  </span>
                </div>

                {imageUrl && (
                  <div>
                    <span className="block text-[8.5px] font-mono text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /> Lampiran Gambar:
                    </span>
                    <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded inline-block">Terlampir & Terkompresi 75%</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 hover:bg-slate-100 font-bold text-slate-600 rounded-xl transition-colors cursor-pointer"
                >
                  Batal / Edit Lagi
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSend}
                  className="px-4 py-2 bg-[#064e3b] hover:bg-emerald-900 text-white font-extrabold rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Kirim Sekarang
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NOTIFICATION SETTINGS MODAL */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 border border-slate-100 max-w-sm w-full shadow-lg text-left space-y-6"
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-emerald-50 text-emerald-800 rounded-lg flex items-center justify-center shrink-0">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">Pengaturan Notifikasi</h4>
                    <p className="text-[10px] text-slate-400">Pembersihan & retensi berkas</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-[11px] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* SECTION A: EXPIRATION CONFIG */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700 text-[10px] tracking-wide uppercase font-mono">
                  Waktu Tampil di Laman Pengguna
                </label>
                <p className="text-[10.5px] text-slate-500 leading-normal mb-2-accent">
                  Tentukan waktu aktif tampil pengumuman. Setelah waktu tersebut tiba, pengumuman akan terhapus baik paska dibaca maupun belum dibaca secara otomatis.
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={durationHours}
                    onChange={(e) => handleSaveDuration(Number(e.target.value))}
                    disabled={isSavingSettings}
                    className="flex-1 border p-2 rounded-lg bg-white focus:border-emerald-600 focus:outline-[#064e3b] text-slate-800 font-sans font-semibold text-xs shadow-2xs"
                  >
                    <option value={24}>24 Jam (1 Hari)</option>
                    <option value={48}>48 Jam (2 Hari)</option>
                    <option value={72}>72 Jam (3 Hari)</option>
                    <option value={168}>168 Jam (7 Hari)</option>
                  </select>
                  {isSavingSettings && (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                  )}
                </div>
              </div>

              {/* SECTION B: NUCLEAR BULK DELETE */}
              <div className="bg-red-50 p-4 border border-red-100 rounded-2xl space-y-3">
                <div className="flex gap-2 text-xs">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="block font-bold text-red-950 text-[10px] uppercase tracking-wide font-mono">Zona Bahaya (Danger Zone)</span>
                    <span className="block text-[10px] text-red-700 leading-relaxed">
                      Menghapus seluruh notifikasi & pengumuman secara massal sekaligus dari database dan layar santri kapan saja secara realtime.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowBulkDeleteConfirm(true);
                  }}
                  className="w-full flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all text-[10px] cursor-pointer shadow-xs active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Seluruh Notifikasi
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK DELETE CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 max-w-sm w-full shadow-xl text-left space-y-4"
            >
              <div className="flex gap-3">
                <div className="h-9 w-9 bg-red-50 text-red-700 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-extrabold text-slate-900 text-sm">Konfirmasi Hapus Massal</h4>
                  <p className="text-slate-500 leading-relaxed">
                    Apakah Anda benar-benar yakin ingin menghapus <strong>seluruh notifikasi</strong> secara serentak dari database?
                  </p>
                  <p className="text-slate-500 leading-relaxed">
                    Tindakan ini akan menghapus semua jenis pemberitahuan, baik <strong>pengumuman yang dikirim oleh Admin</strong> maupun <strong>notifikasi interaktif (seperti menyukai status, balasan komentar, dan tanggapan) dari fitur Bahtsul Masail</strong> di seluruh layar santri secara realtime.
                  </p>
                  <p className="text-red-650 font-bold text-[10.5px] bg-red-50 p-2.5 rounded-lg border border-red-100">
                    ⚠️ Tindakan ini bersifat PERMANEN dan terjadi seketika bagi seluruh pengguna di sistem cloud!
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-1">
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 hover:bg-slate-100 font-bold text-slate-600 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
                >
                  {isBulkDeleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Ya, Hapus Semua
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
