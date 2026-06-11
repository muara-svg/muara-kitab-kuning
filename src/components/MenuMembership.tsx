import React, { useState, useEffect } from 'react';
import { 
  Award, 
  ShieldAlert, 
  CheckCircle2, 
  LogIn,
  ArrowRight,
  ChevronLeft,
  Upload,
  Loader2,
  Landmark,
  Smartphone,
  QrCode,
  AlertTriangle,
  FileText,
  User,
  Phone,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from './Modal';
import { UserProfile, MembershipPlan } from '../types';
import { firestore } from '../lib/firebaseConfig';
import { doc, getDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { uploadToCloudinaryDirect } from '../lib/cloudinaryConfig';
import { compressImage } from '../lib/authService';

interface MenuMembershipProps {
  userProfile: UserProfile;
  onBuyMembership: (planName: string) => void;
  onLoginClick?: () => void;
}

export default function MenuMembership({
  userProfile,
  onBuyMembership,
  onLoginClick,
}: MenuMembershipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginWarning, setShowLoginWarning] = useState(false);
  
  // Package list catalog vs interactive Checkout view
  const [checkoutPlan, setCheckoutPlan] = useState<MembershipPlan | null>(null);

  // Dynamic system plans state
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  // Form states matching requirement #1
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [paymentType, setPaymentType] = useState<'Bank Transfer' | 'E-Wallet' | 'QRIS'>('Bank Transfer');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [randomCode, setRandomCode] = useState(0);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Check pending request status
  useEffect(() => {
    if (!userProfile.isLoggedIn) {
      setHasPendingRequest(false);
      return;
    }

    const checkPendingRequests = async () => {
      const uid = userProfile.id || (userProfile as any).uid;
      let isPending = false;

      // 1. Check local storage first
      try {
        const localRequestsStr = localStorage.getItem('muara_custom_membership_requests');
        if (localRequestsStr) {
          const localRequests = JSON.parse(localRequestsStr);
          isPending = localRequests.some((r: any) => 
            (r.userId === uid || r.userEmail === userProfile.email) && 
            r.status === 'Pending'
          );
        }
      } catch (e) {
        console.warn('Gagal membaca custom membership requests lokal:', e);
      }

      // 2. Check Firestore
      if (uid) {
        try {
          const q = query(
            collection(firestore, 'membership_requests'),
            where('userId', '==', uid),
            where('status', '==', 'Pending')
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            isPending = true;
          } else if (userProfile.email) {
            // Also check by email
            const qEmail = query(
              collection(firestore, 'membership_requests'),
              where('userEmail', '==', userProfile.email),
              where('status', '==', 'Pending')
            );
            const querySnapshotEmail = await getDocs(qEmail);
            if (!querySnapshotEmail.empty) {
              isPending = true;
            }
          }
        } catch (err) {
          console.warn('Gagal fetch pending requests dari Firestore:', err);
        }
      }

      setHasPendingRequest(isPending);
    };

    checkPendingRequests();
  }, [isOpen, userProfile.isLoggedIn, userProfile.id, userProfile.email]);

  useEffect(() => {
    const handleBackButton = (e: any) => {
      if (checkoutPlan) {
        setCheckoutPlan(null);
        e.detail?.consume?.();
      } else if (isOpen) {
        setIsOpen(false);
        e.detail?.consume?.();
      }
    };
    window.addEventListener('muara-hardware-back-button', handleBackButton);
    return () => {
      window.removeEventListener('muara-hardware-back-button', handleBackButton);
    };
  }, [isOpen, checkoutPlan]);

  useEffect(() => {
    const handleOpenMembershipEvent = () => {
      handleMembershipClick();
    };
    window.addEventListener('muara-open-membership', handleOpenMembershipEvent);
    return () => {
      window.removeEventListener('muara-open-membership', handleOpenMembershipEvent);
    };
  }, [userProfile]);

  const handleMembershipClick = () => {
    if (!userProfile.isLoggedIn) {
      setShowLoginWarning(true);
      setIsOpen(true);
    } else {
      setShowLoginWarning(false);
      setIsOpen(true);
    }
  };

  // Pre-fill fields on plan selection
  const initiateCheckout = (plan: MembershipPlan) => {
    // Call parent handler
    onBuyMembership(plan.name);

    setCheckoutPlan(plan);
    setCheckoutName(userProfile.name || '');
    setCheckoutPhone(userProfile.phone || '');
    setPaymentType('Bank Transfer');
    
    // Create random 3 digits to identify payments uniquely
    const code = Math.floor(Math.random() * 900) + 100;
    setRandomCode(code);

    // Reset attachments
    setProofFile(null);
    setProofPreview('');
    setIsCompressing(false);
    setUploadProgress(null);
    setShowConfirmModal(false);
    setSuccessInfo(null);
  };

  // Synchronize loading plans and payment methods whenever the modal is opened
  useEffect(() => {
    if (!isOpen) return;

    const fetchPlansAndPayments = async () => {
      setLoadingPlans(true);
      let loadedPlans: MembershipPlan[] = [];
      try {
        const configRef = doc(firestore, 'configs', 'membership');
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && Array.isArray(data.plans)) {
            loadedPlans = data.plans;
          }
        }
      } catch (err) {
        console.warn('Gagal sinkron paket membership dari firestore:', err);
      }

      // Merge with custom membership plans stored in local storage
      try {
        const localPlansStr = localStorage.getItem('muara_custom_membership_plans');
        if (localPlansStr) {
          const localPlans = JSON.parse(localPlansStr);
          const existingIds = new Set(loadedPlans.map(lp => lp.id));
          localPlans.forEach((lp: any) => {
            if (!existingIds.has(lp.id)) {
              loadedPlans.push(lp);
            }
          });
        }
      } catch (localErr) {
        console.warn('Gagal memuat paket lokal pada menu membership: ', localErr);
      }

      setPlans(loadedPlans);
      setLoadingPlans(false);

      // Fetch active dynamic payments too
      let loadedPayments: any[] = [];
      try {
        const payConfigRef = doc(firestore, 'configs', 'payments');
        const paySnap = await getDoc(payConfigRef);
        if (paySnap.exists()) {
          const payData = paySnap.data();
          if (payData && Array.isArray(payData.methods)) {
            loadedPayments = payData.methods;
          }
        }
      } catch (payErr) {
        console.warn('Gagal memuat metode pembayaran dari Firestore:', payErr);
      }

      // Local storage fallback for payments
      try {
        const localPayStr = localStorage.getItem('muara_custom_payment_methods');
        if (localPayStr) {
          const localPayments = JSON.parse(localPayStr);
          const existingPayIds = new Set(loadedPayments.map(p => p.id));
          localPayments.forEach((p: any) => {
            if (!existingPayIds.has(p.id)) {
              loadedPayments.push(p);
            }
          });
        }
      } catch (localPayErr) {
        console.warn('Gagal memuat pembayaran lokal:', localPayErr);
      }

      if (loadedPayments.length === 0) {
        loadedPayments = [
          { id: 'pay-1', name: 'Bank Syariah Indonesia (BSI)', type: 'Bank Transfer', accountNo: '7112024009', accountHolder: 'YAYASAN AL-MUARA DIGITAL' },
          { id: 'pay-2', name: 'GoPay Premium', type: 'E-Wallet', accountNo: '08123456789', accountHolder: 'Kiai Ahmad (Bendahara)' },
          { id: 'pay-3', name: 'QRIS Gopay/OVO/Dana', type: 'QRIS', accountNo: 'NMID: ID1024300455', accountHolder: 'MUARA SANTUNAN REKENING', imageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://ais-dev-5nryvql223g2kompd5rosg.asia-southeast1.run.app' }
        ];
      }

      setPaymentMethods(loadedPayments);
    };

    fetchPlansAndPayments();
  }, [isOpen]);

  // Derived filtered payment methods based on category dropdown selection
  const filteredPayments = paymentMethods.filter(p => p.type === paymentType);

  // Auto-select first matching payment method of selected type
  useEffect(() => {
    if (filteredPayments.length > 0) {
      setSelectedMethodId(filteredPayments[0].id);
    } else {
      setSelectedMethodId('');
    }
  }, [paymentType, paymentMethods]);

  // Selected object
  const activePaymentMethod = paymentMethods.find(pm => pm.id === selectedMethodId);

  // Image Upload handler with check and compression <= 2MB
  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject files above 2MB
    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > 2) {
      alert("⚠️ Ukuran berkas bukti pembayaran melebihi 2 MB. Silakan upload gambar yang lebih kecil.");
      e.target.value = '';
      return;
    }

    setIsCompressing(true);
    try {
      // Direct compression helper with 75% quality optimization
      const compressed = await compressImage(file, 0.75);
      setProofFile(compressed);
      
      // Update local blob UI viewport preview
      const previewUrl = URL.createObjectURL(compressed);
      setProofPreview(previewUrl);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal memampatkan gambar: ${err.message}`);
    } finally {
      setIsCompressing(false);
    }
  };

  // Pre-flight submission validation
  const handleSubmitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutName.trim()) {
      alert("Nama wajib diisi.");
      return;
    }
    if (!checkoutPhone.trim()) {
      alert("Nomor HP wajib diisi.");
      return;
    }
    if (filteredPayments.length === 0 || !selectedMethodId) {
      alert("Silakan pilih metode pembayaran dengan akun aktif terlebih dahulu.");
      return;
    }
    if (!proofFile) {
      alert("Silakan unggah foto bukti transfer pembayaran Anda.");
      return;
    }

    // Trigger confirmation overlay block
    setShowConfirmModal(true);
  };

  // Direct Firestore write and upload routine
  const executeBuyTransaction = async () => {
    if (!checkoutPlan || !proofFile) return;

    setSubmitting(true);
    setUploadProgress(15);

    try {
      // 1. Upload compressed photo directly to Cloudinary
      const proofUrl = await uploadToCloudinaryDirect(proofFile, {
        folder: 'muara_payment_proofs',
        onProgress: (percent) => {
          // Progress mapping scale
          const scale = Math.round(15 + (percent * 0.8));
          setUploadProgress(scale);
        }
      });

      setUploadProgress(95);

      // 2. Draft dynamic transaction record payload
      const exactAmount = checkoutPlan.price + randomCode;
      const requestPayload = {
        userId: userProfile.id || (userProfile as any).uid || 'guest-user',
        userName: (checkoutName || '').trim() || userProfile.name || 'Hamba Allah',
        userEmail: userProfile.email || 'anonymous@gmail.com',
        userPhone: (checkoutPhone || '').trim() || userProfile.phone || '',
        packageName: checkoutPlan.name || 'Paket Premium',
        packageDuration: checkoutPlan.duration || '30 Hari',
        price: checkoutPlan.price || 0,
        uniqueCode: randomCode || 0,
        transferAmount: exactAmount,
        paymentMethodName: activePaymentMethod ? activePaymentMethod.name : paymentType,
        paymentMethodType: paymentType,
        proofUrl: proofUrl || '',
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      // 3. Write directly to Firestore Collection 'membership_requests'
      try {
        await addDoc(collection(firestore, 'membership_requests'), requestPayload);
      } catch (dbErr) {
        console.warn("Firestore collection membership_requests bypassed. Local mock synchronization loaded:", dbErr);
      }

      // Sync dual writes to LocalStorage to support robust real-time fallback behavior 
      const existingStr = localStorage.getItem('muara_custom_membership_requests') || '[]';
      const list = JSON.parse(existingStr);
      list.push({ id: `req-${Date.now()}`, ...requestPayload });
      localStorage.setItem('muara_custom_membership_requests', JSON.stringify(list));

      setHasPendingRequest(true);

      setUploadProgress(100);
      setSuccessInfo(`✓ Pengajuan paket "${checkoutPlan.name}" berhasil diajukan dengan transfer Rp ${exactAmount.toLocaleString('id-ID')}! Mohon tunggu konfirmasi admin Pondok.`);
      
      // Cleanup checkout state after successful submit
      setTimeout(() => {
        setCheckoutPlan(null);
        setSuccessInfo(null);
      }, 5000);

    } catch (err: any) {
      console.error(err);
      alert(`Gagal mengirim pengajuan: ${err.message}`);
    } finally {
      setSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        id="menu-btn-membership"
        onClick={handleMembershipClick}
        className="flex flex-col items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-center transition-all bg-gradient-to-br from-slate-50 to-amber-50/20 border-amber-100 hover:border-amber-200 hover:shadow-md cursor-pointer"
      >
        <div className="flex items-center justify-center h-[42px] w-[42px] sm:h-12 sm:w-12 rounded-full bg-amber-100 text-amber-600 mb-1.5 sm:mb-2 relative shrink-0">
          <Award className="h-5 w-5 sm:h-6 sm:w-6" />
          {userProfile.membershipStatus === 'Premium Verified' && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-yellow-500 text-[6px] sm:text-[8px] text-white font-bold animate-pulse">✓</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[11px] sm:text-xs font-bold text-slate-800 truncate">Membership</span>
          <span className="text-[9px] sm:text-[10px] text-amber-650 font-bold flex items-center justify-center gap-0.5 truncate">
            👑 {userProfile.isLoggedIn ? 'VIP' : 'Upgrade'}
          </span>
        </div>
      </motion.button>

      <Modal 
        isOpen={isOpen} 
        onClose={() => {
          if (!submitting) {
            setIsOpen(false);
            setShowLoginWarning(false);
            setCheckoutPlan(null);
            setSuccessInfo(null);
          }
        }} 
        title={checkoutPlan ? `Checkout VIP: ${checkoutPlan.name}` : "Paket Premium MUARA"}
      >
        {/* Login alert disclaimer */}
        <AnimatePresence>
          {showLoginWarning && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              id="critical-membership-error-alert"
              className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 p-4 border border-red-150 text-red-800"
            >
              <ShieldAlert className="h-5 w-5 pt-0.5 shrink-0 text-red-600" />
              <div>
                <h4 className="font-bold text-xs">Pemberitahuan Tegas</h4>
                <p className="text-[11px] mt-0.5 leading-relaxed">
                  Anda harus login terlebih dahulu untuk membeli paket premium!
                </p>
                <button
                  type="button"
                  id="btn-redirect-login"
                  onClick={() => {
                    setShowLoginWarning(false);
                    setIsOpen(false);
                    if (onLoginClick) onLoginClick();
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  <LogIn className="h-3 w-3" /> Login Sekarang →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic checkout popup interface */}
        {checkoutPlan ? (
          <div className="space-y-4 text-xs">
            
            {successInfo ? (
              <div className="p-6 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-150 text-emerald-900">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="font-extrabold text-sm uppercase">Pengajuan Terkirim Berhasil!</h4>
                <p className="text-[11px] text-emerald-850 leading-relaxed font-semibold">
                  {successInfo}
                </p>
                <p className="text-[10px] text-emerald-600 leading-relaxed pt-1 font-mono">
                  Lencana VIP akan terbit pasca admin Pondok melakukan persetujuan digital di laman Admin Pengajuan VIP.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutPlan(null);
                    setSuccessInfo(null);
                  }}
                  className="mt-2 px-4 py-2 bg-[#064e3b] text-white rounded-xl font-bold cursor-pointer"
                >
                  Kembali ke Katalog Paket
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitPrompt} className="space-y-4">
                
                {/* Header Back */}
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutPlan(null)}
                    className="flex items-center gap-1 font-bold text-emerald-800 hover:underline cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" /> Kembali
                  </button>
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase">Formulir Pendaftaran VIP</span>
                </div>

                {/* Grid nama & hp - auto populated */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-450" /> Nama Lengkap (Otomatis)
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutName}
                      onChange={(e) => setCheckoutName(e.target.value)}
                      placeholder="Masukkan nama lengkap Anda"
                      className="w-full border p-2.5 rounded-xl bg-slate-50 focus:outline-hidden text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-450" /> Nomor Telepon (Otomatis)
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutPhone}
                      onChange={(e) => setCheckoutPhone(e.target.value)}
                      placeholder="Gunakan nomor telepon aktif"
                      className="w-full border p-2.5 rounded-xl bg-slate-50 focus:outline-hidden text-slate-800 font-bold font-mono"
                    />
                  </div>
                </div>

                {/* Dropdown pilihan metode pembayaran */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider">Kategori Metode Pembayaran</label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value as any)}
                      className="w-full border p-2.5 rounded-xl bg-white focus:outline-hidden text-slate-800 font-bold cursor-pointer select-custom"
                    >
                      <option value="Bank Transfer">Transfer Bank</option>
                      <option value="E-Wallet">E-Wallet (Gopay/OVO/Dana)</option>
                      <option value="QRIS">QRIS Code</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider">Pilih Akun Rekening Tujuan</label>
                    {filteredPayments.length === 0 ? (
                      <div className="w-full border border-red-200 bg-red-50 text-red-800 p-2.5 rounded-xl text-[10px] font-bold leading-tight">
                        ⚠️ pilihan bank belum tersedia silahkan pilih metode pembayaran bank yang lain
                      </div>
                    ) : (
                      <select
                        value={selectedMethodId}
                        onChange={(e) => setSelectedMethodId(e.target.value)}
                        className="w-full border p-2.5 rounded-xl bg-white focus:outline-hidden text-slate-805 font-bold cursor-pointer select-custom"
                      >
                        {filteredPayments.map((pm) => (
                          <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Rekening Tujuan Box Detail */}
                {activePaymentMethod && (
                  <div className="p-3.5 rounded-2xl bg-[#064e3b]/5 border border-emerald-500/10 space-y-2">
                    <p className="font-mono text-[8px] text-[#064e3b] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 animate-spin" /> Detail Tujuan Transfer Pembelian:
                    </p>
                    <div className="flex justify-between items-start gap-2 text-[11px]">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-800 text-[11px]">{activePaymentMethod.name}</p>
                        <p className="font-mono text-emerald-800 font-bold text-xs select-all bg-emerald-50 px-1 rounded inline-block">{activePaymentMethod.accountNo}</p>
                        <p className="text-[9px] text-slate-400">Atas Nama: <span className="font-bold text-slate-600 uppercase">{activePaymentMethod.accountHolder}</span></p>
                      </div>
                      
                      {activePaymentMethod.type === 'QRIS' && activePaymentMethod.imageUrl && (
                        <div className="text-center shrink-0">
                          <img 
                            src={activePaymentMethod.imageUrl} 
                            alt="QRIS Tujuan" 
                            className="h-16 w-16 border rounded bg-white object-contain aspect-square mx-auto pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-[8px] text-slate-400 font-mono tracking-widest mt-1 block">PINDAI QRIS</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Price to transfer + unique random 3 digits */}
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-700">Jumlah Transfer Nominal:</p>
                      <p className="text-[9px] text-slate-400">Kombinasi harga paket + kode acak pembeda admin</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-emerald-700 text-sm">
                        Rp {(checkoutPlan.price + randomCode).toLocaleString('id-ID')}
                      </p>
                      <p className="text-[9px] text-red-500 font-semibold uppercase tracking-wide">
                        Sudah termasuk +{randomCode} Kode Unik
                      </p>
                    </div>
                  </div>
                </div>

                {/* Photo receipt file selection & automatic compression limit to 2MB */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 uppercase text-[9px] font-mono tracking-wider">Unggah Foto Bukti Transfer Pajak (PNG / JPG, Maks 2MB)</label>
                  
                  <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 text-center bg-white hover:bg-emerald-50/10 cursor-pointer transition-all">
                    <input
                      type="file"
                      required
                      accept="image/*"
                      onChange={handleProofFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    {proofPreview ? (
                      <div className="space-y-1 bg-white p-1 rounded-xl flex items-center justify-center gap-3">
                        <img 
                          src={proofPreview} 
                          alt="Slip File Preview" 
                          className="h-12 w-12 object-contain rounded border pointer-events-none bg-slate-50"
                        />
                        <div className="text-left">
                          <p className="font-bold text-slate-700 text-[10px] truncate max-w-[150px]">{proofFile?.name}</p>
                          <p className="text-[8px] text-slate-405">Ukuran: {proofFile ? (proofFile.size / 1024).toFixed(1) : 0} KB (Berhasil Terkompresi)</p>
                          <span className="text-[9px] text-emerald-600 font-bold">✓ Bukti Transfer Siap Dikirim</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {isCompressing ? (
                          <div className="space-y-2">
                            <Loader2 className="h-5 w-5 mx-auto text-emerald-600 animate-spin" />
                            <p className="text-[9px] font-semibold text-slate-650">Mengompresi secara cerdas (Quality 75%)...</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-5 w-5 mx-auto text-slate-400" />
                            <p className="text-[10px] font-bold text-slate-700">Tekan untuk memilih gambar dari file galeri</p>
                            <p className="text-[8px] text-slate-400">Kompresi otomatis berjalan demi kelancaran unggahan</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="submit"
                  disabled={submitting || isCompressing || filteredPayments.length === 0}
                  className="w-full py-3 px-4 bg-[#064e3b] hover:bg-emerald-800 font-extrabold text-[#fff] text-xs uppercase cursor-pointer rounded-2xl transition-all tracking-wider disabled:opacity-40"
                >
                  Ajukan Status VIP Premium
                </button>

              </form>
            )}

          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 mb-2">
              Pilih paket belajar terbaik Anda. Semua pendapatan digunakan untuk pengembangan digitalisasi Kitab Kuning.
            </p>

            {loadingPlans ? (
              <div className="py-12 flex flex-col justify-center items-center text-slate-400 gap-2">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-mono">Memuat daftar paket premium...</p>
              </div>
            ) : plans.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-mono text-xs bg-slate-50 rounded-2xl border border-dashed">
                Belum ada paket premium yang aktif saat ini. Silakan hubungi pengelola pondok atau admin.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {plans.map((plan) => (
                  <div 
                    key={plan.id}
                    className={`relative rounded-2xl p-4 border transition-all ${
                      plan.popular 
                        ? 'border-emerald-500 bg-emerald-50/25 ring-1 ring-emerald-500/25' 
                        : 'border-slate-150 bg-white hover:border-slate-200'
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2.5 right-4 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                        PANITIA REKOMENDASI
                      </span>
                    )}
                    
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{plan.name}</h4>
                        <span className="text-[10px] text-slate-400">Durasi: {plan.duration}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        {plan.slashPrice && plan.slashPrice > 0 && (
                          <span className="text-[10px] text-red-500 line-through font-mono font-semibold">
                            Rp {plan.slashPrice.toLocaleString('id-ID')}
                          </span>
                        )}
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100/50 px-2.5 py-1 rounded-lg">
                          {plan.priceString}
                        </span>
                      </div>
                    </div>

                    <ul className="text-[11px] text-slate-500 space-y-1.5 mb-3.5 pl-1.5">
                      {plan.benefits.map((benefit, bIdx) => (
                        <li key={bIdx} className="flex items-center gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          {benefit}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      id={`btn-buy-plan-${plan.id}`}
                      disabled={hasPendingRequest || (userProfile.membershipStatus === 'Premium Verified' && userProfile.isLoggedIn)}
                      onClick={() => {
                        if (!userProfile.isLoggedIn) {
                          setShowLoginWarning(true);
                        } else {
                          initiateCheckout(plan);
                        }
                      }}
                      className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition-transform active:scale-95 text-center cursor-pointer ${
                        hasPendingRequest
                          ? 'bg-amber-100 text-amber-800 border border-amber-200 cursor-not-allowed'
                          : userProfile.membershipStatus === 'Premium Verified' && userProfile.isLoggedIn
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : plan.popular
                          ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {userProfile.membershipStatus === 'Premium Verified' && userProfile.isLoggedIn
                        ? 'Paket Anda Sedang Aktif'
                        : hasPendingRequest
                        ? 'Pembelian paket sedang di proses'
                        : 'Pilih Paket Ini'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* CONFIRMATION DIALOG MODAL MATCHING REQUIREMENT #1 & #6 */}
      <AnimatePresence>
        {showConfirmModal && checkoutPlan && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 text-slate-800 shadow-2xl relative"
            >
              <div className="flex items-center gap-2 border-b pb-3 text-emerald-805">
                <AlertTriangle className="h-5 w-5 text-amber-600 animate-pulse shrink-0" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider">Konfirmasi Bayar VIP</h4>
              </div>

              <div className="mt-3.5 text-xs text-slate-700 leading-relaxed space-y-3">
                <p className="font-semibold text-slate-600">
                  Mohon pastikan rincian pengajuan premium Anda telah sepenuhnya valid dan sesuai tata tertib Pondok:
                </p>

                <div className="p-3 bg-slate-50 border rounded-2xl text-[10px] space-y-1.5 font-mono">
                  <p>👱 Pemohon: <span className="font-bold text-slate-800">{checkoutName}</span></p>
                  <p>📞 No. HP: <span className="font-bold text-slate-800">{checkoutPhone}</span></p>
                  <p>🎟️ Paket: <span className="font-bold text-[#064e3b]">{checkoutPlan.name} ({checkoutPlan.duration})</span></p>
                  <p>🏦 Rekening: <span className="font-bold text-slate-700">{activePaymentMethod?.name}</span></p>
                  <p className="text-emerald-700 font-bold bg-emerald-100/40 p-1 rounded">
                    💰 Total: Rp {(checkoutPlan.price + randomCode).toLocaleString('id-ID')}
                  </p>
                </div>

                <div className="p-2.5 bg-amber-50 text-amber-900 rounded-xl text-[9px] border border-amber-200">
                  ⚠️ <strong>Saya menyatakan bahwa saya benar-benar sudah melakukan transfer</strong> ke rekening pondok dan gambar slip bukti yang saya lampirkan adalah valid.
                </div>
              </div>

              {submitting && uploadProgress !== null && (
                <div className="mt-4 space-y-1.5 text-center">
                  <div className="flex justify-between items-center text-[10px] font-mono text-emerald-800 font-bold">
                    <span>Mengunggah Bukti Pembayaran...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 border hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer text-slate-500 transition-colors"
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={executeBuyTransaction}
                  className="flex-1 py-2.5 bg-[#064e3b] hover:bg-emerald-800 text-white font-extrabold text-xs cursor-pointer rounded-xl flex items-center justify-center gap-1 transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <span>Ya, Saya Sudah Transfer</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

