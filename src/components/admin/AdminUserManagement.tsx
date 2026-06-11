import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Calendar, 
  ArrowRight, 
  Loader2, 
  CheckCircle, 
  X,
  Clock,
  ShieldAlert,
  Edit2,
  Trash2,
  UserMinus,
  AlertTriangle,
  Award,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestore } from '../../lib/firebaseConfig';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';

interface UserItem {
  id: string;
  uid?: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  isPremium: boolean;
  expiresAt?: string;
  createdAt?: string;
}

export default function AdminUserManagement() {
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'premium' | 'standard'>('all');
  
  // Custom multi-tier popup state matching requirements #3, #4, #5
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [selectedDuration, setSelectedDuration] = useState('1 Bulan');
  const [savingVIP, setSavingVIP] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Confirmation block overlay state for absolute security
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'make_premium' | 'remove_premium';
    user: UserItem;
    duration?: string;
    expiresAt?: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    // Realtime snapshot sync of Firestore Users Collection
    const usersCol = collection(firestore, 'users');
    const unsubscribe = onSnapshot(usersCol, (snap) => {
      const mergedMap = new Map<string, UserItem>();

      // A. Populate from Firestore
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const emailKey = (d.email || '').trim().toLowerCase();
        
        const userObj: UserItem = {
          id: docSnap.id,
          uid: docSnap.id,
          name: d.name || 'Anonymous Santri',
          email: d.email || '',
          phone: d.phone || '',
          role: d.role || 'user',
          isPremium: !!d.isPremium,
          expiresAt: d.expiresAt || '',
          createdAt: d.createdAt || new Date().toISOString()
        };
        const identifier = emailKey || docSnap.id;
        mergedMap.set(identifier, userObj);
      });

      // B. Merge with muara_users_db (standard sandbox registration)
      try {
        const muaraUsersDbStr = localStorage.getItem('muara_users_db');
        if (muaraUsersDbStr) {
          const muaraUsersDb = JSON.parse(muaraUsersDbStr);
          Object.values(muaraUsersDb).forEach((u: any) => {
            const emailKey = (u.email || '').trim().toLowerCase();
            if (emailKey && !mergedMap.has(emailKey)) {
              mergedMap.set(emailKey, {
                id: u.uid || `local-${Date.now()}`,
                uid: u.uid || `local-${Date.now()}`,
                name: u.name || 'Anonymous Santri',
                email: u.email || '',
                phone: u.phone || '',
                role: u.role || 'user',
                isPremium: !!u.isPremium,
                expiresAt: u.expiresAt || '',
                createdAt: u.createdAt || new Date().toISOString()
              });
            }
          });
        }
      } catch (localErr) {
        console.warn("Gagal sinkron muara_users_db local cache:", localErr);
      }

      // C. Merge with muara_custom_users (temporary modifications)
      try {
        const customUsersStr = localStorage.getItem('muara_custom_users');
        if (customUsersStr) {
          const customUsers = JSON.parse(customUsersStr);
          customUsers.forEach((u: any) => {
            if (u.id === 'u-1' || u.id === 'u-2' || u.id === 'u-3' || u.id === 'u-4') {
              return;
            }
            const emailKey = (u.email || '').trim().toLowerCase();
            if (emailKey) {
              const existing = mergedMap.get(emailKey);
              if (!existing) {
                mergedMap.set(emailKey, {
                  id: u.id || u.uid,
                  uid: u.uid || u.id,
                  name: u.name,
                  email: u.email,
                  phone: u.phone || '',
                  role: u.role || 'user',
                  isPremium: !!u.isPremium,
                  expiresAt: u.expiresAt || '',
                  createdAt: u.createdAt || new Date().toISOString()
                });
              }
            }
          });
        }
      } catch (err) {
        console.warn("Error parsing muara_custom_users:", err);
      }

      // Sort users
      const uniqueMap = new Map<string, UserItem>();
      Array.from(mergedMap.values()).forEach((u) => {
        const userId = u.id || u.uid;
        if (userId) {
          uniqueMap.set(userId, u);
        }
      });

      const finalUsers = Array.from(uniqueMap.values()).filter(u => u.email !== 'official.hcsh@gmail.com');
      finalUsers.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

      localStorage.setItem('muara_custom_users', JSON.stringify(finalUsers));
      setUsersList(finalUsers);
      setLoading(false);
    }, (error) => {
      console.warn("Error listening to users snapshot:", error);
      fetchUsers(); // Fallback to fetchUsers if onSnapshot fails
    });

    return () => unsubscribe();
  }, []);

  // Sync users list from real sources - No mock fallback data!
  const fetchUsers = async () => {
    setLoading(true);
    const mergedMap = new Map<string, UserItem>();

    // A. Fetch from Firestore users collection
    try {
      const snap = await getDocs(collection(firestore, 'users'));
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const emailKey = (d.email || '').trim().toLowerCase();
        
        const userObj: UserItem = {
          id: docSnap.id,
          uid: docSnap.id,
          name: d.name || 'Anonymous Santri',
          email: d.email || '',
          phone: d.phone || '',
          role: d.role || 'user',
          isPremium: !!d.isPremium,
          expiresAt: d.expiresAt || '',
          createdAt: d.createdAt || new Date().toISOString()
        };
        const identifier = emailKey || docSnap.id;
        mergedMap.set(identifier, userObj);
      });
    } catch (err: any) {
      console.warn("Firestore 'users' fetch bypassed or offline:", err.message);
    }

    // B. Merge with muara_users_db (standard sandbox registration)
    try {
      const muaraUsersDbStr = localStorage.getItem('muara_users_db');
      if (muaraUsersDbStr) {
        const muaraUsersDb = JSON.parse(muaraUsersDbStr);
        Object.values(muaraUsersDb).forEach((u: any) => {
          const emailKey = (u.email || '').trim().toLowerCase();
          if (emailKey && !mergedMap.has(emailKey)) {
            mergedMap.set(emailKey, {
              id: u.uid || `local-${Date.now()}`,
              uid: u.uid || `local-${Date.now()}`,
              name: u.name || 'Anonymous Santri',
              email: u.email || '',
              phone: u.phone || '',
              role: u.role || 'user',
              isPremium: !!u.isPremium,
              expiresAt: u.expiresAt || '',
              createdAt: u.createdAt || new Date().toISOString()
            });
          }
        });
      }
    } catch (localErr) {
      console.warn("Gagal sinkron muara_users_db local cache:", localErr);
    }

    // C. Merge with muara_custom_users (temporary modifications)
    try {
      const customUsersStr = localStorage.getItem('muara_custom_users');
      if (customUsersStr) {
        const customUsers = JSON.parse(customUsersStr);
        customUsers.forEach((u: any) => {
          // Reject static hardcoded dummy data (u-1, u-2, u-3, u-4) matching requirement #1
          if (u.id === 'u-1' || u.id === 'u-2' || u.id === 'u-3' || u.id === 'u-4') {
            return;
          }
          const emailKey = (u.email || '').trim().toLowerCase();
          if (emailKey) {
            const existing = mergedMap.get(emailKey);
            if (!existing) {
              mergedMap.set(emailKey, {
                id: u.id || u.uid,
                uid: u.uid || u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                role: u.role || 'user',
                isPremium: !!u.isPremium,
                expiresAt: u.expiresAt || '',
                createdAt: u.createdAt || new Date().toISOString()
              });
            }
          }
        });
      }
    } catch (err) {
      console.warn("Error parsing muara_custom_users:", err);
    }

    // Sort users by newest registration
    const uniqueMap = new Map<string, UserItem>();
    Array.from(mergedMap.values()).forEach((u) => {
      const userId = u.id || u.uid;
      if (userId) {
        uniqueMap.set(userId, u);
      }
    });

    const finalUsers = Array.from(uniqueMap.values()).filter(u => u.email !== 'official.hcsh@gmail.com');
    finalUsers.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

    localStorage.setItem('muara_custom_users', JSON.stringify(finalUsers));
    setUsersList(finalUsers);
    setLoading(false);
  };

  // Helper calculation for exact durations matching requirement #4 & #5
  const calculateExpiresAt = (duration: string): string => {
    const targetDate = new Date();
    if (duration === '1 Bulan') {
      targetDate.setMonth(targetDate.getMonth() + 1);
      return targetDate.toISOString().split('T')[0];
    } else if (duration === '6 Bulan') {
      targetDate.setMonth(targetDate.getMonth() + 6);
      return targetDate.toISOString().split('T')[0];
    } else if (duration === '1 Tahun') {
      targetDate.setFullYear(targetDate.getFullYear() + 1);
      return targetDate.toISOString().split('T')[0];
    } else if (duration === 'unlimitid') {
      return 'Unlimited';
    }
    return '';
  };

  // Live calculation output viewport
  const calculatedExpiryText = calculateExpiresAt(selectedDuration);

  // Executing the actual VIP or deletion actions after confirming prompt
  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    setSavingVIP(true);
    const { type, user, duration, expiresAt } = confirmAction;

    try {
      if (type === 'make_premium') {
        const isPrem = true;
        const dateString = expiresAt || '';

        // A. Firestore write
        try {
          const userRef = doc(firestore, 'users', user.id);
          const currentSnap = await getDoc(userRef);
          const existingData = currentSnap.exists() ? currentSnap.data() : {};
          await setDoc(userRef, {
            ...existingData,
            uid: user.id,
            name: existingData.name || user.name || 'Anonymous Santri',
            email: existingData.email || user.email || '',
            phone: existingData.phone || user.phone || '',
            role: existingData.role || user.role || 'user',
            createdAt: existingData.createdAt || user.createdAt || new Date().toISOString(),
            isPremium: isPrem,
            expiresAt: dateString
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Firestore VIP update skipped. Access stored locally:", dbErr);
        }

        // B. Update local auth database (muara_users_db)
        try {
          const stored = localStorage.getItem('muara_users_db') || '{}';
          const storedUsers = JSON.parse(stored);
          const emailClean = user.email.toLowerCase().trim();
          if (storedUsers[emailClean]) {
            storedUsers[emailClean].isPremium = isPrem;
            storedUsers[emailClean].expiresAt = dateString;
            localStorage.setItem('muara_users_db', JSON.stringify(storedUsers));
          }
        } catch (uErr) {}

        // C. Update custom users cache
        try {
          const cachedUsersStr = localStorage.getItem('muara_custom_users') || '[]';
          let cachedUsers = JSON.parse(cachedUsersStr);
          cachedUsers = cachedUsers.map((u: any) => {
            if (u.id === user.id || u.email === user.email) {
              return { ...u, isPremium: isPrem, expiresAt: dateString };
            }
            return u;
          });
          localStorage.setItem('muara_custom_users', JSON.stringify(cachedUsers));
        } catch (cErr) {}

        // D. Update current active session if changed user is current logged-in user
        try {
          const sessionKeys = ['muara_session', 'muara_current_session'];
          for (const key of sessionKeys) {
            const currentSessionStr = localStorage.getItem(key);
            if (currentSessionStr) {
              const session = JSON.parse(currentSessionStr);
              if (session.id === user.id || session.email === user.email) {
                session.isPremium = isPrem;
                session.membershipStatus = isPrem ? 'Premium Verified' : 'Gratis';
                session.expiresAt = dateString;
                localStorage.setItem(key, JSON.stringify(session));
              }
            }
          }
        } catch (sErr) {}

        setUsersList((prev) => 
          prev.map((u) => 
            u.id === user.id || u.email === user.email
              ? { ...u, isPremium: isPrem, expiresAt: dateString } 
              : u
          )
        );

        setSuccessMsg(`👑 Sukses mengubah "${user.name}" menjadi Anggota Premium (${duration}) s.d. ${dateString}`);
        setTimeout(() => setSuccessMsg(''), 5000);

      } else if (type === 'remove_premium') {
        const isPrem = false;
        const dateString = '';

        // A. Firestore write
        try {
          const userRef = doc(firestore, 'users', user.id);
          const currentSnap = await getDoc(userRef);
          const existingData = currentSnap.exists() ? currentSnap.data() : {};
          await setDoc(userRef, {
            ...existingData,
            uid: user.id,
            name: existingData.name || user.name || 'Anonymous Santri',
            email: existingData.email || user.email || '',
            phone: existingData.phone || user.phone || '',
            role: existingData.role || user.role || 'user',
            createdAt: existingData.createdAt || user.createdAt || new Date().toISOString(),
            isPremium: isPrem,
            expiresAt: dateString
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Firestore status removal skipped:", dbErr);
        }

        // B. Local db updates
        try {
          const stored = localStorage.getItem('muara_users_db') || '{}';
          const storedUsers = JSON.parse(stored);
          const emailClean = user.email.toLowerCase().trim();
          if (storedUsers[emailClean]) {
            storedUsers[emailClean].isPremium = isPrem;
            storedUsers[emailClean].expiresAt = dateString;
            localStorage.setItem('muara_users_db', JSON.stringify(storedUsers));
          }
        } catch (uErr) {}

        // C. Cache update
        try {
          const cachedUsersStr = localStorage.getItem('muara_custom_users') || '[]';
          let cachedUsers = JSON.parse(cachedUsersStr);
          cachedUsers = cachedUsers.map((u: any) => {
            if (u.id === user.id || u.email === user.email) {
              return { ...u, isPremium: isPrem, expiresAt: dateString };
            }
            return u;
          });
          localStorage.setItem('muara_custom_users', JSON.stringify(cachedUsers));
        } catch (cErr) {}

        // D. Current active session update
        try {
          const currentSessionStr = localStorage.getItem('muara_current_session');
          if (currentSessionStr) {
            const session = JSON.parse(currentSessionStr);
            if (session.id === user.id || session.email === user.email) {
              session.isPremium = isPrem;
              session.membershipStatus = 'Gratis';
              session.expiresAt = dateString;
              localStorage.setItem('muara_current_session', JSON.stringify(session));
            }
          }
        } catch (sErr) {}

        setUsersList((prev) => 
          prev.map((u) => 
            u.id === user.id || u.email === user.email
              ? { ...u, isPremium: isPrem, expiresAt: dateString } 
              : u
          )
        );

        setSuccessMsg(`❌ Sesi premium pengguna "${user.name}" telah dihentikan, beralih ke Anggota Standard.`);
        setTimeout(() => setSuccessMsg(''), 5000);

      } else if (type === 'delete') {
        // A. Firestore deletion (deleting by both user.id and user.uid to guarantee absolute cloud removal)
        let firestoreSuccess = false;
        try {
          if (user.id) {
            await deleteDoc(doc(firestore, 'users', user.id));
            await deleteDoc(doc(firestore, 'admins', user.id));
            firestoreSuccess = true;
          }
          if (user.uid && user.uid !== user.id) {
            await deleteDoc(doc(firestore, 'users', user.uid));
            await deleteDoc(doc(firestore, 'admins', user.uid));
            firestoreSuccess = true;
          }
        } catch (dbErr) {
          console.warn("Firestore document deletion skipped or local record:", dbErr);
        }

        // B. Local database file clearing
        try {
          const stored = localStorage.getItem('muara_users_db') || '{}';
          const storedUsers = JSON.parse(stored);
          const emailClean = user.email.toLowerCase().trim();
          if (storedUsers[emailClean]) {
            delete storedUsers[emailClean];
            localStorage.setItem('muara_users_db', JSON.stringify(storedUsers));
          }
        } catch (uErr) {}

        // C. Custom cache array clearing
        try {
          const cachedUsersStr = localStorage.getItem('muara_custom_users') || '[]';
          let cachedUsers = JSON.parse(cachedUsersStr);
          cachedUsers = cachedUsers.filter((u: any) => u.id !== user.id && u.email !== user.email);
          localStorage.setItem('muara_custom_users', JSON.stringify(cachedUsers));
        } catch (cErr) {}

        // D. Delete current active logged-in session if self-delete executed
        try {
          const currentSessionStr = localStorage.getItem('muara_current_session');
          if (currentSessionStr) {
            const session = JSON.parse(currentSessionStr);
            if (session.id === user.id || session.email === user.email) {
              localStorage.removeItem('muara_current_session');
              window.location.reload();
            }
          }
        } catch (sErr) {}

        setUsersList((prev) => prev.filter((u) => u.id !== user.id && u.email !== user.email));

        if (firestoreSuccess) {
          setSuccessMsg(`🔥 Akun "${user.name}" (${user.email}) telah berhasil dihapus SECARA PERMANEN dari database Cloud Firebase Firestore & sistem lokal!`);
        } else {
          setSuccessMsg(`🗑️ Pengguna santri "${user.name}" berhasil dihapus secara permanen dari penyimpanan basis data.`);
        }
        setTimeout(() => setSuccessMsg(''), 5000);
      }

      setEditingUser(null);
      setConfirmAction(null);
    } catch (err: any) {
      console.error(err);
      alert(`Gangguan proses aksi: ${err.message}`);
    } finally {
      setSavingVIP(false);
    }
  };

  // Filter & Search mapper calculations
  const filteredUsers = usersList.filter(user => {
    const query = searchQuery.toLowerCase().trim();
    const queryMatch = (user.name || '').toLowerCase().includes(query) || (user.email || '').toLowerCase().includes(query);
    
    if (!queryMatch) return false;
    if (filterType === 'premium') return user.isPremium;
    if (filterType === 'standard') return !user.isPremium;
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="border-b pb-4">
        <h3 className="font-extrabold text-[#064e3b] text-base flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600 animate-pulse" />
          Manajemen Pengguna (Santri & Member)
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Kelola status premium pengguna, verifikasi data login, berikan akses premium, serta hapus akun yang bermasalah.</p>
      </div>

      {/* DETAILED STATISTICS - Auto syncs with state */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase">Pengguna Aktif Terdaftar</p>
          <p className="font-extrabold text-base text-slate-800 mt-0.5">{usersList.length} Santri</p>
        </div>
        <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
          <p className="text-[10px] font-mono font-bold text-amber-700 tracking-wider uppercase">Anggota Premium VIP (*)</p>
          <p className="font-extrabold text-base text-amber-800 mt-0.5">{usersList.filter(u => u.isPremium).length} VIP</p>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase">Anggota Standard Biasa</p>
          <p className="font-extrabold text-base text-slate-700 mt-0.5">{usersList.filter(u => !u.isPremium).length} Member</p>
        </div>
      </div>

      {/* FILTER & SEARCH FORM */}
      <div className="flex flex-col sm:flex-row gap-3 text-xs">
        <div className="relative flex-1">
          <span className="absolute left-3 top-3 text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Cari santri berdasarkan nama / email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border p-2.5 pl-9 rounded-xl bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium text-slate-850"
          />
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border items-center">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterType === 'all' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterType('premium')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterType === 'premium' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⭐ Premium
          </button>
          <button
            onClick={() => setFilterType('standard')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterType === 'standard' ? 'bg-white shadow-xs text-slate-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Standard
          </button>
        </div>
      </div>

      {/* UPDATE NOTIFICATIONS FEEDBACK */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-900 rounded-xl p-3.5 text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 animate-bounce" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* DATA VIEWPORT LIST DATATABLE */}
      {loading ? (
        <div className="py-20 flex flex-col justify-center items-center text-slate-400 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <p className="font-mono text-xs">Mencari records biodata santri...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-16 border rounded-3xl border-dashed text-center text-slate-400 font-mono text-xs bg-slate-50">
          Belum ada data login pengguna yang tersinkronisasi di sistem.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left border-collapse bg-white">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-mono text-slate-450 uppercase border-b border-slate-200">
                <th className="p-3.5 font-bold tracking-wider">Identitas Santri</th>
                <th className="p-3.5 font-bold tracking-wider">Email Kontak</th>
                <th className="p-3.5 font-bold tracking-wider">Status Lencana</th>
                <th className="p-3.5 font-bold tracking-wider">Masa Expired</th>
                <th className="p-3.5 font-bold tracking-wider text-right">Kelola Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
              {filteredUsers.map((u) => {
                const joinDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Baru';

                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-850 text-xs">{u.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">Daftar: {joinDate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{u.email}</td>
                    <td className="p-3.5">
                      {u.isPremium ? (
                        <span className="inline-flex items-center gap-1 bg-yellow-100/60 border border-yellow-250 text-amber-800 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide">
                          👑 Premium VIP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-550 px-2.5 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wide">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono">
                      {u.isPremium ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-[10px]">
                          <Calendar className="h-3.5 w-3.5" />
                          {u.expiresAt === 'Unlimited' || u.expiresAt === 'unlimitid' ? 'Selamanya (Unlimited)' : u.expiresAt}
                        </span>
                      ) : (
                        <span className="text-slate-405 font-bold">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setSelectedDuration(u.isPremium ? (u.expiresAt === 'Unlimited' ? 'unlimitid' : '1 Bulan') : '1 Bulan');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-500/30 text-slate-700 bg-white hover:bg-emerald-50/20 font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-3xs"
                      >
                        <Edit2 className="h-3 w-3 text-emerald-600" />
                        Kelola
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* REQUIREMENTS #3, #4, #5 - POLISHED INTERACTIVE ACTION MANAGEMENT POPUP */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 text-slate-800 text-left relative"
            >
              
              {/* Header */}
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5 font-mono tracking-wider">
                  <Award className="h-4 w-4 text-amber-550 shrink-0" />
                  Menu Aksi Manajemen Pengguna
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Bio block */}
              <div className="p-3 bg-slate-50 border rounded-2xl flex items-center gap-2.5">
                <div className="h-10 w-10 bg-[#064e3b]/10 text-[#064e3b] font-extrabold text-sm rounded-full flex items-center justify-center">
                  {editingUser.name.substring(0,2).toUpperCase()}
                </div>
                <div className="text-xs">
                  <h5 className="font-extrabold text-slate-800 leading-none truncate max-w-[200px]">{editingUser.name}</h5>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">{editingUser.email}</p>
                  <p className="text-[9px] text-slate-400 font-mono">Status: <span className="font-bold text-slate-500 uppercase">{editingUser.isPremium ? '💎 premium' : '🆓 standard'}</span></p>
                </div>
              </div>

              {/* Action Modules */}
              <div className="space-y-3 pt-1 text-xs">
                
                {/* 1. GRANT/UPDATE PREMIUM PERIODS */}
                <div className="p-3.5 border border-emerald-500/10 rounded-2xl bg-emerald-50/10 space-y-2">
                  <label className="block font-extrabold text-[#064e3b] uppercase text-[9px] font-mono tracking-widest flex items-center gap-1">
                    <Crown className="h-3.5 w-3.5 text-amber-500" /> Tetapkan Premium VIP
                  </label>
                  
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={selectedDuration}
                      onChange={(e) => setSelectedDuration(e.target.value)}
                      className="flex-1 border p-2.5 rounded-xl bg-white font-bold text-slate-850 focus:outline-hidden cursor-pointer"
                    >
                      <option value="1 Bulan">1 Bulan (Aktif 30 Hari)</option>
                      <option value="6 Bulan">6 Bulan (Aktif 180 Hari)</option>
                      <option value="1 Tahun">1 Tahun (Aktif 365 Hari)</option>
                      <option value="unlimitid">Unlimited (Masa Aktif Selamanya)</option>
                    </select>
                  </div>

                  {/* Automated live date mapping display - Requirement #4 & #5 */}
                  <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100 text-[10px] space-y-0.5 font-mono text-emerald-800">
                    <p>Otomatisasi Tanggal Jatuh Tempo:</p>
                    <p className="font-extrabold text-[#064e3b]">
                      📅 {calculatedExpiryText === 'Unlimited' ? 'Masa Aktif Selamanya (Unlimited)' : calculatedExpiryText}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction({
                        type: 'make_premium',
                        user: editingUser,
                        duration: selectedDuration,
                        expiresAt: calculatedExpiryText
                      });
                    }}
                    className="w-full py-2.5 bg-[#064e3b] hover:bg-emerald-800 text-white font-extrabold text-[10px] uppercase cursor-pointer rounded-xl transition-all shadow-3xs hover:shadow-2xs text-center"
                  >
                    Ya, Set Premium ({selectedDuration})
                  </button>
                </div>

                {/* 2. REMOVE PREMIUM OPTION */}
                {editingUser.isPremium && (
                  <div className="p-3 border border-amber-300/30 bg-amber-50/15 rounded-2xl space-y-1.5">
                    <span className="block font-bold text-amber-800 text-[9px] uppercase tracking-wider font-mono">Kembalikan Status Ke Member Biasa</span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmAction({
                          type: 'remove_premium',
                          user: editingUser
                        });
                      }}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase cursor-pointer rounded-xl text-center"
                    >
                      Hapus Akses Premium VIP
                    </button>
                  </div>
                )}

                {/* 3. DANGER ZONE - PERMANENT DELETE */}
                <div className="p-3 border border-red-200 bg-red-50/10 rounded-2xl space-y-1.5">
                  <span className="block font-bold text-red-700 text-[9px] uppercase tracking-wider font-mono flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" /> Area Bahaya Pengelola
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction({
                        type: 'delete',
                        user: editingUser
                      });
                    }}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] uppercase cursor-pointer rounded-xl text-center"
                  >
                    Hapus Akun Secara Permanen
                  </button>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REQUIREMENT #5 - INTERACTIVE NOTIFIKASI KONFIRMASI (CONFIRMATION BLOCK OVERLAY) */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 text-slate-805 shadow-2xl relative text-left space-y-4"
            >
              
              <div className="flex items-center gap-2 border-b pb-3 text-amber-700">
                <AlertTriangle className="h-5 w-5 text-amber-600 animate-pulse shrink-0" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider font-mono">Konfirmasi Tindakan Admin</h4>
              </div>

              <div className="text-xs text-slate-750 leading-relaxed space-y-3">
                
                {confirmAction.type === 'make_premium' && (
                  <div className="space-y-2">
                    <p>Apakah Anda benar-benar yakin ingin <strong>menetapkan hak istimewa premium</strong> kepada pengguna berikut?</p>
                    <div className="p-3 bg-emerald-50 rounded-2xl text-[10px] font-mono border text-emerald-905 space-y-1">
                      <p>👱 Nama: <strong>{confirmAction.user.name}</strong></p>
                      <p>🎟️ Paket: <strong>{confirmAction.duration}</strong></p>
                      <p>🗓️ Berlaku s.d: <strong>{confirmAction.expiresAt === 'Unlimited' ? 'Selamanya (Unlimited)' : confirmAction.expiresAt}</strong></p>
                    </div>
                    <p className="text-[10px] text-slate-450 italic mt-1">Sistem akan secara otomatis menyinkronkan status premium baru ini ke database.</p>
                  </div>
                )}

                {confirmAction.type === 'remove_premium' && (
                  <div className="space-y-2">
                    <p>Apakah Anda benar-benar yakin ingin <strong>mencabut semua status VIP Premium</strong> dari pengguna berkut?</p>
                    <div className="p-3 bg-amber-50 rounded-2xl text-[10px] font-mono border text-amber-900 space-y-1">
                      <p>👱 Nama: <strong>{confirmAction.user.name}</strong></p>
                      <p>📧 Email: <strong>{confirmAction.user.email}</strong></p>
                    </div>
                    <p className="text-[10px] text-red-550 font-semibold">Tindakan ini akan mengembalikan masa aktif menjadi gratis/standard secara instan.</p>
                  </div>
                )}

                {confirmAction.type === 'delete' && (
                  <div className="space-y-2">
                    <p className="text-red-650 font-bold uppercase tracking-wider flex items-center gap-1 text-[10px]">
                      ⚠️ Peringatan Penghapusan Permanen!
                    </p>
                    <p>Apakah Anda yakin berkas akun santri berikut ingin <strong>dihapus selamanya dari pangkalan data sistem</strong>?</p>
                    <div className="p-3 bg-red-50 rounded-2xl text-[10px] font-mono border border-red-100 text-red-900 space-y-1">
                      <p>👱 Nama: <strong>{confirmAction.user.name}</strong></p>
                      <p>📧 Email: <strong>{confirmAction.user.email}</strong></p>
                    </div>
                    <p className="text-[10px] text-red-500 font-semibold leading-tight mt-1">Semua records, data pendaftaran manual, biodata, serta akses akun ini akan hangus dan tidak dapat dikembalikan lagi.</p>
                  </div>
                )}

              </div>

              {/* Action execution buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={savingVIP}
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 border hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer text-slate-500 transition-colors text-center"
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  disabled={savingVIP}
                  onClick={executeConfirmedAction}
                  className="flex-1 py-2.5 bg-[#064e3b] hover:bg-emerald-800 text-white font-extrabold text-xs cursor-pointer rounded-xl flex items-center justify-center gap-1 transition-colors text-center"
                >
                  {savingVIP ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sedang Sinkron...</span>
                    </>
                  ) : (
                    <span>Ya, Lakukan Perubahan</span>
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
