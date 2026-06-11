import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Loader2, 
  UserCheck, 
  Clock, 
  AlertCircle, 
  ShieldAlert, 
  Mail, 
  Smartphone, 
  CheckCircle,
  FileCheck2,
  Trash2,
  ArrowRight,
  Eye,
  Calendar,
  AlertTriangle,
  Image as ImageIcon
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
  setDoc 
} from 'firebase/firestore';

interface AdminPengajuanProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

interface PurchaseRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  packageName: string;
  packageDuration?: string;
  price?: number;
  uniqueCode?: number;
  transferAmount?: number;
  paymentMethodName?: string;
  paymentMethodType?: string;
  proofUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  processedAt?: string;
}

export default function AdminPengajuan({ onSuccess, onError }: AdminPengajuanProps) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  // Requirement #4 - Detail Modal states
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);

  // Interactive Action Confirmations states
  const [confirmApproveTarget, setConfirmApproveTarget] = useState<PurchaseRequest | null>(null);
  const [confirmRejectTarget, setConfirmRejectTarget] = useState<PurchaseRequest | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setFetching(true);
    let list: PurchaseRequest[] = [];
    try {
      const querySnapshot = await getDocs(collection(firestore, 'membership_requests'));
      querySnapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as PurchaseRequest);
      });
    } catch (err: any) {
      console.warn("Firestore collection membership_requests bypassed. Using Local Storage records:", err.message);
    }

    // Merge/get from local storage for reliable sync
    try {
      const localStr = localStorage.getItem('muara_custom_membership_requests');
      if (localStr) {
        const localReqs = JSON.parse(localStr);
        const existingIds = new Set(list.map(r => r.id));
        localReqs.forEach((r: any) => {
          if (!existingIds.has(r.id)) {
            list.push(r);
          }
        });
      }
    } catch (localErr) {
      console.warn("Gagal membaca pendaftaran lokal di Admin:", localErr);
    }

    // Sort with Pending first, then newest createdAt
    list.sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Requirement #3 - Removed fake data from fallback, starting out 100% clean
    setRequests(list);
    setFetching(false);
  };

  // Requirement #5 - Automated Expiration Calculation from moment of approval
  const calculateExpiresAt = (duration?: string): string => {
    const now = new Date();
    const durLower = (duration || '1 Bulan').toLowerCase().trim();

    if (durLower.includes('6 bulan') || durLower.includes('6 bln') || durLower.includes('180')) {
      const expiry = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      return expiry.toISOString().split('T')[0];
    } else if (durLower.includes('1 tahun') || durLower.includes('1 thn') || durLower.includes('365')) {
      const expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      return expiry.toISOString().split('T')[0];
    } else if (durLower.includes('unlimitid') || durLower.includes('selamanya') || durLower.includes('unlimited')) {
      return 'unlimitid';
    } else {
      // Default: 1 Bulan (30 Days)
      const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return expiry.toISOString().split('T')[0];
    }
  };

  // Execute approval routine after confirmation
  const handleApprove = async (req: PurchaseRequest) => {
    setActionId(req.id);
    setLoading(true);
    try {
      // Calculate dynamic date according to plan duration starting from today (approval moment)
      const calculatedExpiry = calculateExpiresAt(req.packageDuration);

      // 1. Update status of the request
      try {
        const reqRef = doc(firestore, 'membership_requests', req.id);
        await updateDoc(reqRef, {
          status: 'Approved',
          processedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Firestore update req status skipped, executing cache backup logic.");
      }

      // 2. Update the user's document in Firestore (using setDoc with merge: true for robustness)
      try {
        const userRef = doc(firestore, 'users', req.userId);
        const currentSnap = await getDoc(userRef);
        const existingData = currentSnap.exists() ? currentSnap.data() : {};
        await setDoc(userRef, {
          ...existingData,
          uid: req.userId,
          name: existingData.name || req.userName || 'Anonymous Santri',
          email: existingData.email || req.userEmail || '',
          phone: existingData.phone || req.userPhone || '',
          role: existingData.role || 'user',
          createdAt: existingData.createdAt || new Date().toISOString(),
          isPremium: true,
          expiresAt: calculatedExpiry
        }, { merge: true });
        console.log('User status updated in Firestore collection successfully.');
      } catch (usrErr) {
        console.warn("Firestore user profile updates skipped. Make sure user state is in sync locally.");
      }

      // Sync status changes inside local storage
      try {
        const localStr = localStorage.getItem('muara_custom_membership_requests');
        if (localStr) {
          const list = JSON.parse(localStr);
          const found = list.find((item: any) => item.id === req.id || (item.createdAt === req.createdAt && item.userId === req.userId));
          if (found) {
            found.status = 'Approved';
            found.processedAt = new Date().toISOString();
            localStorage.setItem('muara_custom_membership_requests', JSON.stringify(list));
          }
        }
      } catch (localSetErr) {
        console.error(localSetErr);
      }

      // Sync with local users auth storage ('muara_users_db')
      try {
        const storedUsersStr = localStorage.getItem('muara_users_db');
        if (storedUsersStr) {
          const storedUsers = JSON.parse(storedUsersStr);
          const emailClean = (req.userEmail || '').trim().toLowerCase();
          if (emailClean && storedUsers[emailClean]) {
            storedUsers[emailClean].isPremium = true;
            storedUsers[emailClean].expiresAt = calculatedExpiry;
            localStorage.setItem('muara_users_db', JSON.stringify(storedUsers));
          }
        }
      } catch (dbErr) {}

      // Sync with custom users list cache ('muara_custom_users')
      try {
        const cachedUsersStr = localStorage.getItem('muara_custom_users') || '[]';
        let cachedUsers = JSON.parse(cachedUsersStr);
        cachedUsers = cachedUsers.map((u: any) => {
          if (u.id === req.userId || u.email === req.userEmail) {
            return { ...u, isPremium: true, expiresAt: calculatedExpiry };
          }
          return u;
        });
        localStorage.setItem('muara_custom_users', JSON.stringify(cachedUsers));
      } catch (cErr) {}

      // Sync user profile status in local storage if the logged-in user is the one approved
      try {
        const sessionKeys = ['muara_session', 'muara_current_session'];
        for (const key of sessionKeys) {
          const currentSessionStr = localStorage.getItem(key);
          if (currentSessionStr) {
            const session = JSON.parse(currentSessionStr);
            if (session.id === req.userId || session.email === req.userEmail) {
              session.isPremium = true;
              session.membershipStatus = 'Premium Verified';
              session.expiresAt = calculatedExpiry;
              localStorage.setItem(key, JSON.stringify(session));
            }
          }
        }
      } catch (sessionErr) {}

      onSuccess(`👑 Pengajuan premium "${req.userName}" sukses DISETUJUI! Masa aktif: ${calculatedExpiry === 'unlimitid' ? 'Selamanya (Unlimited)' : calculatedExpiry}.`);
      fetchRequests();
      setSelectedRequest(null);
    } catch (err: any) {
      onError(`Gagal menyetujui pengajuan: ${err.message}`);
    } finally {
      setLoading(false);
      setActionId(null);
    }
  };

  // Rejection logic execution
  const handleReject = async (req: PurchaseRequest) => {
    setActionId(req.id);
    setLoading(true);
    try {
      try {
        const reqRef = doc(firestore, 'membership_requests', req.id);
        await updateDoc(reqRef, {
          status: 'Rejected',
          processedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Firestore reject status sync skipped.");
      }

      // Sync status changes inside local storage
      try {
        const localStr = localStorage.getItem('muara_custom_membership_requests');
        if (localStr) {
          const list = JSON.parse(localStr);
          const found = list.find((item: any) => item.id === req.id || (item.createdAt === req.createdAt && item.userId === req.userId));
          if (found) {
            found.status = 'Rejected';
            found.processedAt = new Date().toISOString();
            localStorage.setItem('muara_custom_membership_requests', JSON.stringify(list));
          }
        }
      } catch (localSetErr) {}

      onSuccess(`❌ Pengajuan premium "${req.userName}" berhasil ditolak.`);
      fetchRequests();
      setSelectedRequest(null);
    } catch (err: any) {
      onError(`Gagal menolak pengajuan: ${err.message}`);
    } finally {
      setLoading(false);
      setActionId(null);
    }
  };

  // Delete log entry manually
  const handleDeleteRequestLog = async (id: string, name: string) => {
    if (!window.confirm(`Hapus log riwayat pengajuan atas nama "${name}"?`)) {
      return;
    }
    setLoading(true);
    try {
      try {
        await deleteDoc(doc(firestore, 'membership_requests', id));
      } catch (dbErr) {}

      // Delete from local storage fallbacks
      try {
        const localStr = localStorage.getItem('muara_custom_membership_requests');
        if (localStr) {
          const list = JSON.parse(localStr).filter((r: any) => r.id !== id);
          localStorage.setItem('muara_custom_membership_requests', JSON.stringify(list));
        }
      } catch (localSetErr) {}

      onSuccess(`🗑️ Log riwayat pengajuan "${name}" sukses dihapus.`);
      fetchRequests();
    } catch (err: any) {
      onError(`Gagal menghapus log: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      {/* HEADER PAGE */}
      <div className="border-b pb-4">
        <h3 className="font-extrabold text-[#064e3b] text-base flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-emerald-600 animate-pulse" />
          Sistem Approval Manual Pengajuan VIP Member
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Verifikasi slip transfer, setujui status premium VIP berbayar santri pondok, atau tolak pendaftaran bermasalah</p>
      </div>

      {fetching ? (
        <div className="py-20 flex flex-col justify-center items-center text-slate-400 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <p className="font-mono text-xs">Mengambil berkas pengajuan dari Firestore...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-16 text-center text-slate-400 bg-slate-50 border border-dashed rounded-3xl space-y-3">
          <SmileIcon className="h-10 w-10 text-emerald-650 mx-auto" />
          <h4 className="font-bold text-slate-700 text-xs">Arsip Pengajuan VIP Bersih</h4>
          <p className="text-[11px] text-slate-405 max-w-sm mx-auto leading-relaxed">
            Belum ada pengajuan pendaftaran baru yang perlu ditinjau. Pengajuan santri riil yang terkirim dari formulir checkout akan tampil di daftar ini secara langsung.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex bg-amber-50 p-3 rounded-xl border border-amber-200 text-slate-705 text-[11px] leading-relaxed items-start gap-2 max-w-xl">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Informasi Tindakan:</span> Klik tombol tanda panah (<ArrowRight className="h-3 w-3 inline" />) di pojok kanan untuk membuka pop up rincian lengkap berkas pembelian, memeriksa foto struk bukti, serta melakukan aksi setujui/tolak dengan aman.
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-3xs">
            <table className="w-full text-xs text-left text-slate-700 border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-mono tracking-wider border-b border-slate-205">
                <tr>
                  <th scope="col" className="p-4 py-3">Rincian Pemohon</th>
                  <th scope="col" className="p-4 py-3">Paket & Durasi</th>
                  <th scope="col" className="p-4 py-3 text-right">Jumlah Tagihan (Rp)</th>
                  <th scope="col" className="p-4 py-3 text-center">Status</th>
                  <th scope="col" className="p-4 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* User profile details */}
                    <td className="p-4 font-bold text-slate-800">
                      <div className="flex flex-col">
                        <span className="text-slate-850 font-extrabold">{req.userName}</span>
                        <span className="text-[10px] text-slate-400 font-normal font-mono flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 inline text-slate-300" /> {req.userEmail}
                        </span>
                        {req.userPhone && (
                          <span className="text-[10px] text-slate-400 font-normal font-mono flex items-center gap-1">
                            <Smartphone className="h-3 w-3 inline text-slate-300" /> {req.userPhone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Chosen package name */}
                    <td className="p-4 font-semibold text-emerald-805">
                      <div className="flex flex-col">
                        <span className="text-slate-800 font-bold block">{req.packageName}</span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">Masa aktif: {req.packageDuration || '1 Bulan'}</span>
                      </div>
                    </td>

                    {/* Amount value */}
                    <td className="p-4 text-right font-mono font-bold text-emerald-700">
                      Rp {req.transferAmount ? req.transferAmount.toLocaleString('id-ID') : (req.price || 0).toLocaleString('id-ID')}
                    </td>

                    {/* Status badge */}
                    <td className="p-4 text-center">
                      {req.status === 'Pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-100 uppercase text-[9px] font-mono">
                          <Clock className="h-3 w-3 text-amber-500 shrink-0" /> Pending Review
                        </span>
                      )}
                      {req.status === 'Approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-805 font-bold border border-emerald-100 uppercase text-[9px] font-mono">
                          ✓ Disetujui
                        </span>
                      )}
                      {req.status === 'Rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-100 uppercase text-[9px] font-mono">
                          ✗ Ditolak
                        </span>
                      )}
                    </td>

                    {/* Actions button - arrow right which launches modal */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="p-1 px-3 py-1.5 text-xs bg-emerald-50 hover:bg-emerald-100/75 border border-emerald-500/10 hover:border-emerald-500/30 text-emerald-850 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Tinjau Berkas Pengajuan"
                        >
                          Tinjau <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        {req.status !== 'Pending' && (
                          <button
                            onClick={() => handleDeleteRequestLog(req.id, req.userName)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-550 transition-colors cursor-pointer"
                            title="Hapus Log"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REQUIREMENT #4 - POLISHED DETAILS POP UP MODAL WINDOW */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-205 w-full max-w-lg overflow-hidden shadow-2xl p-6 text-slate-800 space-y-4 text-left"
            >
              
              {/* Header Box */}
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-1.5">
                  <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Berkas Pengajuan VIP</h4>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">ID REG: {selectedRequest.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                {/* Details Data Column */}
                <div className="space-y-3">
                  <div>
                    <span className="block text-[8px] font-mono uppercase text-slate-400 font-bold tracking-wider">Identitas Pemohon</span>
                    <p className="font-extrabold text-slate-805 text-xs">{selectedRequest.userName}</p>
                    <p className="font-mono text-slate-500 text-[10px]">{selectedRequest.userEmail}</p>
                    <p className="font-mono text-slate-500 text-[10px]">HP: {selectedRequest.userPhone || '-'}</p>
                  </div>

                  <div>
                    <span className="block text-[8px] font-mono uppercase text-slate-400 font-bold tracking-wider">Masa Aktif Pilihan</span>
                    <p className="font-bold text-slate-800">{selectedRequest.packageName}</p>
                    <p className="text-[10px] text-slate-500">Masa belajar yang diajukan: <span className="font-bold text-emerald-800">{selectedRequest.packageDuration || '1 Bulan'}</span></p>
                  </div>

                  <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-1">
                    <span className="block text-[8px] font-mono uppercase text-emerald-700 font-bold tracking-wider">Nominal Model Pembayaran</span>
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="text-slate-500">Kanal Transfer:</span>
                      <span className="font-bold text-slate-800">{selectedRequest.paymentMethodName || 'Metode Lain'} ({selectedRequest.paymentMethodType || 'Transfer'})</span>
                    </div>
                    <div className="flex justify-between items-center text-[10.5px] border-t pt-1 mt-1 border-emerald-100">
                      <span className="text-slate-505">Jumlah Bayar:</span>
                      <span className="font-mono font-extrabold text-[#064e3b]">Rp {selectedRequest.transferAmount ? selectedRequest.transferAmount.toLocaleString('id-ID') : (selectedRequest.price || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {selectedRequest.uniqueCode && (
                      <p className="text-[8.5px] text-red-500 font-semibold font-sans pt-0.5 text-right uppercase mt-0.5 leading-none">Termasuk kode pembeda +{selectedRequest.uniqueCode} rupiah</p>
                    )}
                  </div>

                  <div className="text-[10px] space-y-1 text-slate-500 bg-slate-50 p-2.5 rounded-xl border">
                    <p>📅 Diajukan: <span className="font-mono font-semibold">{new Date(selectedRequest.createdAt).toLocaleString('id-ID')}</span></p>
                    <p>⚙️ Status: <span className="font-bold uppercase tracking-wider">{selectedRequest.status}</span></p>
                  </div>
                </div>

                {/* Proof Image Upload Column */}
                <div className="space-y-2">
                  <span className="block text-[8px] font-mono uppercase text-slate-400 font-bold tracking-wider flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5 text-slate-400" /> Slip Bukti Transfer Asli
                  </span>
                  
                  {selectedRequest.proofUrl ? (
                    <div className="group relative border rounded-2xl overflow-hidden bg-slate-50 aspect-3/4 max-h-[190px] flex items-center justify-center">
                      <img 
                        src={selectedRequest.proofUrl} 
                        alt="Struk Transfer" 
                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => window.open(selectedRequest.proofUrl, '_blank')}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-900/40 text-center p-1 text-[8px] text-white">
                        Klik gambar untuk memperbesar
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed aspect-3/4 max-h-[190px] flex flex-col justify-center items-center text-slate-400 font-mono text-[10px] rounded-2xl bg-slate-50">
                      📂 File tidak ditemukan
                    </div>
                  )}
                </div>

              </div>

              {/* ACTION EXECUTION BUTTONS WITH SYSTEM CONFIRMATIONS */}
              <div className="pt-3 border-t flex flex-col gap-2">
                
                {selectedRequest.status === 'Pending' ? (
                  <>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setConfirmApproveTarget(selectedRequest)}
                        className="flex-1 py-2.5 bg-[#064e3b] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="h-4 w-4" /> Setujui Pengajuan VIP
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setConfirmRejectTarget(selectedRequest)}
                        className="flex-1 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <X className="h-4 w-4" /> Tolak & Batalkan
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-50 border p-3 rounded-2xl text-center text-[10px] font-semibold text-slate-500">
                    Pengajuan pendaftaran ini sudah selesai diproses pada tanggal {selectedRequest.processedAt ? new Date(selectedRequest.processedAt).toLocaleString('id-ID') : 'baru-baru ini'}.
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* APPROVAL INTERACTIVE CONFIRMATION SYSTEM */}
      <AnimatePresence>
        {confirmApproveTarget && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-205 w-full max-w-sm overflow-hidden shadow-2xl p-6 text-slate-800 space-y-4"
            >
              <div className="flex items-center gap-1.5 border-b pb-2 text-emerald-800 font-extrabold text-xs">
                <AlertTriangle className="h-4 w-4 text-emerald-650 animate-bounce" />
                CONVIRMATION: SETUJUI MEMBER VIP
              </div>
              <p className="text-xs text-slate-650 leading-relaxed text-left">
                Apakah Anda benar-benar yakin ingin <strong>menyetujui pengajuan premium</strong> atas nama <span className="font-bold text-slate-800">{confirmApproveTarget.userName}</span>?
              </p>
              <div className="p-3 bg-emerald-50 rounded-xl text-left text-[10px] space-y-1 font-mono">
                <p>👱 Santri: {confirmApproveTarget.userName}</p>
                <p>🎟️ Paket: {confirmApproveTarget.packageName}</p>
                <p>⌛ Durasi: {confirmApproveTarget.packageDuration || '1 Bulan'}</p>
                <p>📅 Durasi Masa Aktif dihitung otomatis terhitung sejak saat Anda menekan tombol Setujui.</p>
              </div>
              <div className="flex gap-2 text-xs font-bold pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmApproveTarget(null)}
                  className="flex-1 py-1.5 border hover:bg-slate-50 rounded-xl text-slate-500 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleApprove(confirmApproveTarget);
                    setConfirmApproveTarget(null);
                  }}
                  className="flex-1 py-1.5 bg-[#064e3b] hover:bg-emerald-800 text-white rounded-xl cursor-pointer"
                >
                  Ya, Setujui Sekarang
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REJECTION INTERACTIVE CONFIRMATION SYSTEM */}
      <AnimatePresence>
        {confirmRejectTarget && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-205 w-full max-w-sm overflow-hidden shadow-2xl p-6 text-slate-800 space-y-4"
            >
              <div className="flex items-center gap-1.5 border-b pb-2 text-red-800 font-extrabold text-xs">
                <AlertTriangle className="h-4 w-4 text-red-600 animate-bounce" />
                CONVIRMATION: TOLAK PENGAJUAN VIP
              </div>
              <p className="text-xs text-slate-650 leading-relaxed text-left">
                Apakah Anda yakin ingin <strong>menolak pengajuan pembayaran manual premium</strong> atas nama <span className="font-bold text-slate-800">{confirmRejectTarget.userName}</span>?
              </p>
              <div className="p-3 bg-red-50/50 rounded-xl text-left text-[10px] space-y-1 font-mono text-red-900 border border-red-100">
                <p>⚠️ Status santri pemohon akan terus ditetapkan gratis dan data yang diajukan akan ditolak.</p>
              </div>
              <div className="flex gap-2 text-xs font-bold pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmRejectTarget(null)}
                  className="flex-1 py-1.5 border hover:bg-slate-50 rounded-xl text-slate-500 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleReject(confirmRejectTarget);
                    setConfirmRejectTarget(null);
                  }}
                  className="flex-1 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-xl cursor-pointer"
                >
                  Ya, Tolak Pembayaran
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// Small helper smile icon
function SmileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
