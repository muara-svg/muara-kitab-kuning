import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  Search, 
  CheckCircle2, 
  X, 
  ZoomIn, 
  Check, 
  AlertTriangle, 
  ArrowLeft,
  QrCode,
  Smartphone,
  Landmark,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from './Modal';
import { SedekahCampaign } from '../types';
import { firestore } from '../lib/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

interface MenuSedekahProps {
  sedekahCampaigns: SedekahCampaign[];
  onDonate: (campaignId: string, amount: number) => void;
}

export default function MenuSedekah({ sedekahCampaigns, onDonate }: MenuSedekahProps) {
  // Navigation & UI control state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCamp, setSelectedCamp] = useState<SedekahCampaign | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isQrisZoomed, setIsQrisZoomed] = useState(false);

  // Forms / Input selections
  const [donateAmount, setDonateAmount] = useState<number>(50000);
  const [customAmountStr, setCustomAmountStr] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  // Confirmation overlay & feedback state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [donationSuccess, setDonationSuccess] = useState(false);
  const [lastDonationDetails, setLastDonationDetails] = useState<{
    campaignTitle: string;
    amount: number;
    paymentName: string;
    accountNo: string;
    accountHolder: string;
    type: string;
    qrisImageUrl?: string;
  } | null>(null);

  useEffect(() => {
    const handleBackButton = (e: any) => {
      if (isZoomed) {
        setIsZoomed(false);
        e.detail?.consume?.();
      } else if (isQrisZoomed) {
        setIsQrisZoomed(false);
        e.detail?.consume?.();
      } else if (showConfirmModal) {
        setShowConfirmModal(false);
        e.detail?.consume?.();
      } else if (donationSuccess) {
        setDonationSuccess(false);
        e.detail?.consume?.();
      } else if (selectedCamp) {
        setSelectedCamp(null);
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
  }, [isOpen, selectedCamp, isZoomed, isQrisZoomed, showConfirmModal, donationSuccess]);

  // Synchronously compute the channels for the active campaign (Backwards compatibility supported)
  const campChannels = selectedCamp
    ? selectedCamp.accounts && selectedCamp.accounts.length > 0
      ? selectedCamp.accounts
      : [
          selectedCamp.paymentType === 'QRIS Code'
            ? {
                id: 'legacy-qris',
                type: 'QRIS Code' as const,
                name: 'Dinamis QRIS Syariah',
                accountNo: 'Scan QRIS Langsung',
                accountHolder: selectedCamp.bankAccountHolder || 'YAYASAN AL-MUARA DIGITAL (QRIS)',
                qrisImageUrl: selectedCamp.qrisImageUrl
              }
            : {
                id: 'legacy-bank',
                type: 'Bank Transfer' as const,
                name: selectedCamp.bankName || 'Bank Syariah Indonesia (BSI)',
                accountNo: selectedCamp.bankAccountNo || '7112024009',
                accountHolder: selectedCamp.bankAccountHolder || 'YAYASAN AL-MUARA DIGITAL'
              }
        ]
    : [];

  const activeChannel = campChannels.find(ch => ch.id === selectedChannelId) || campChannels[0];

  useEffect(() => {
    if (selectedCamp && campChannels.length > 0) {
      setSelectedChannelId(campChannels[0].id);
    } else {
      setSelectedChannelId('');
    }
  }, [selectedCamp]);

  // Load payment methods directly from admin configs on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchPaymentMethods = async () => {
      setLoadingPayments(true);
      let loaded: any[] = [];

      // A. Try loading live from Cloud Firestore
      try {
        const docRef = doc(firestore, 'configs', 'payments');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          if (d && Array.isArray(d.methods)) {
            loaded = d.methods;
          }
        }
      } catch (err) {
        console.warn('Gagal fetch metode pembayaran dari Firestore:', err);
      }

      // B. Merge with muara_custom_payment_methods local cache
      try {
        const localStr = localStorage.getItem('muara_custom_payment_methods');
        if (localStr) {
          const localMethods = JSON.parse(localStr);
          const existingIds = new Set(loaded.map(p => p.id));
          localMethods.forEach((lm: any) => {
            if (!existingIds.has(lm.id)) {
              loaded.push(lm);
            }
          });
        }
      } catch (localErr) {
        console.warn('Gagal memuat metode pembayaran lokal:', localErr);
      }

      // C. Default fallback seed matching AdminPayments fallback if empty
      if (loaded.length === 0) {
        loaded = [
          { id: 'pay-1', name: 'Bank Syariah Indonesia (BSI)', type: 'Bank Transfer', accountNo: '7112024009', accountHolder: 'YAYASAN AL-MUARA DIGITAL' },
          { id: 'pay-2', name: 'Bank Central Asia (BCA)', type: 'Bank Transfer', accountNo: '1393005512', accountHolder: 'YAYASAN AL-MUARA DIGITAL' },
          { id: 'pay-3', name: 'Gopay / OVO / Dana', type: 'E-Wallet', accountNo: '081234567890', accountHolder: 'YAYASAN AL-MUARA DIGITAL' }
        ];
      }

      setPaymentMethods(loaded);
      if (loaded.length > 0) {
        setSelectedMethodId(loaded[0].id);
      }
      setLoadingPayments(false);
    };

    fetchPaymentMethods();
  }, [isOpen]);

  // Clean data-filtering based on Search Query
  const filteredCampaigns = sedekahCampaigns.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle final donation submission
  const triggerDonatePayment = () => {
    if (!selectedCamp) return;

    const finalAmount = customAmountStr ? parseInt(customAmountStr) : donateAmount;
    if (isNaN(finalAmount) || finalAmount <= 0) return;

    // Resolve campaign-specific payment settings dynamically using the selected channel
    const activeChannel = campChannels.find(ch => ch.id === selectedChannelId) || campChannels[0];
    if (!activeChannel) return;

    // Save success metadata for display
    setLastDonationDetails({
      campaignTitle: selectedCamp.title,
      amount: finalAmount,
      paymentName: activeChannel.name,
      accountNo: activeChannel.accountNo,
      accountHolder: activeChannel.accountHolder,
      type: activeChannel.type === 'QRIS Code' ? 'QRIS' : 'Bank Transfer',
      qrisImageUrl: activeChannel.type === 'QRIS Code' ? (activeChannel.qrisImageUrl || '') : ''
    });

    onDonate(selectedCamp.id, finalAmount);
    setDonationSuccess(true);
    setShowConfirmModal(false);

    // Reset inputs
    setCustomAmountStr('');
  };

  const activeMethodObj = paymentMethods.find(p => p.id === selectedMethodId);

  const qrisZoomUrl = donationSuccess 
    ? lastDonationDetails?.qrisImageUrl 
    : (activeChannel?.qrisImageUrl || selectedCamp?.qrisImageUrl);

  return (
    <>
      {/* Menu Action Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        id="menu-btn-sedekah"
        onClick={() => {
          setIsOpen(true);
          setDonationSuccess(false);
          setSelectedCamp(null);
        }}
        className="flex flex-col items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-center transition-all bg-gradient-to-br from-slate-50 to-teal-50/20 border-teal-100 hover:border-teal-200 hover:shadow-md cursor-pointer"
      >
        <div className="flex items-center justify-center h-[42px] w-[42px] sm:h-12 sm:w-12 rounded-full bg-teal-100 text-teal-600 mb-1.5 sm:mb-2 shrink-0">
          <HeartHandshake className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[11px] sm:text-xs font-bold text-slate-800 truncate">Sedekah Amal</span>
          <span className="text-[9px] sm:text-[10px] text-teal-650 font-bold block truncate">
            Saluran Berkah
          </span>
        </div>
      </motion.button>

      {/* MODAL 1: PRIMARY LISTING */}
      <Modal 
        isOpen={isOpen} 
        onClose={() => {
          setIsOpen(false);
          setDonationSuccess(false);
          setSelectedCamp(null);
        }} 
        title="Sedekah Amal Digital"
      >
        {/* Dynamic State Success Card Display */}
        {donationSuccess && lastDonationDetails && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-5 rounded-2xl bg-teal-50 p-4 border border-teal-200 text-teal-900 animate-fade-in"
          >
            <div className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 text-teal-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-sm text-teal-950">Infaq Sedekah Berhasil Terdaftar!</h4>
                <p className="text-xs text-teal-800 mt-1 leading-relaxed">
                  Jazakumullah Khairan Katsiran atas kebaikan Anda berpartisipasi dalam program: <strong>"{lastDonationDetails.campaignTitle}"</strong>.
                </p>

                {/* Conditional Success Instructions Card */}
                {lastDonationDetails.type === 'QRIS' ? (
                  <div className="mt-3 p-3.5 rounded-xl bg-white/85 border border-teal-150 space-y-2.5 text-xs text-slate-700 flex flex-col items-center">
                    <p className="font-bold text-[10px] text-teal-850 uppercase tracking-wider text-center">Silakan Pindai QRIS Berikut:</p>
                    {lastDonationDetails.qrisImageUrl ? (
                      <div className="flex flex-col items-center gap-1">
                        <div 
                          className="w-32 h-32 bg-white rounded-xl border border-slate-200 p-2 shadow-sm relative group overflow-hidden cursor-zoom-in hover:scale-105 transition-transform"
                          onClick={() => setIsQrisZoomed(true)}
                          title="Klik untuk memperbesar QRIS"
                        >
                          <img src={lastDonationDetails.qrisImageUrl} alt="QRIS" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ZoomIn className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold font-sans mt-0.5">Saran: Klik gambar untuk memperbesar</span>
                      </div>
                    ) : (
                      <span className="text-rose-500 text-[10px] font-bold bg-rose-50 px-2 py-1 rounded">Kode QRIS Belum Tersedia</span>
                    )}
                    <div className="text-center">
                      <p className="text-[11px] text-slate-500">Penerima: <strong>{lastDonationDetails.accountHolder}</strong></p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">Total Dana Berkah: <strong className="text-emerald-700 font-extrabold text-xs">Rp {lastDonationDetails.amount.toLocaleString('id-ID')}</strong></p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 p-3 rounded-xl bg-white/70 border border-teal-100 space-y-1.5 text-xs text-slate-700">
                    <p className="font-bold text-[10px] text-teal-850 uppercase tracking-wider">Silakan transfer simulasi ke rekening berikut:</p>
                    <p className="font-bold text-sm text-slate-900">{lastDonationDetails.paymentName}</p>
                    <div className="flex justify-between items-center bg-slate-100 px-2.5 py-1.5 rounded-lg select-all">
                      <span className="font-mono text-xs font-bold tracking-wider">{lastDonationDetails.accountNo}</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">SALIN REKENING</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Atas nama: <strong>{lastDonationDetails.accountHolder}</strong></p>
                    <p className="text-[11px] text-slate-500 font-mono">Total Dana Berkah: <strong className="text-emerald-700 font-extrabold text-xs">Rp {lastDonationDetails.amount.toLocaleString('id-ID')}</strong></p>
                  </div>
                )}

                <p className="text-[11px] text-teal-600 font-bold mt-2.5 flex items-center gap-1">
                  ✓ Kontribusi Anda telah dicatat ke dalam rincian program sedekah.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setDonationSuccess(false)}
              className="mt-3.5 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Kembali ke Program Sedekah
            </button>
          </motion.div>
        )}

        {/* Dynamic Detail Overlay Page inside main Modal */}
        {selectedCamp ? (
          <div className="space-y-4">
            {/* Header / Back Action */}
            <button
              onClick={() => {
                setSelectedCamp(null);
                setDonationSuccess(false);
              }}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-bold text-xs cursor-pointer group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Kembali ke Daftar Program
            </button>

            {/* Program poster and title */}
            <div className="space-y-3">
              {/* Poster container with Click to zoom overlay trigger */}
              <div className="relative rounded-2xl h-44 overflow-hidden border border-slate-100 group bg-slate-100 shadow-inner">
                <img 
                  src={selectedCamp.thumbnailUrl} 
                  alt={selectedCamp.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={() => setIsZoomed(true)}
                  className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-xl text-xs flex items-center gap-1 shadow-md transition-colors cursor-pointer"
                >
                  <ZoomIn className="h-4 w-4" /> Perbesar Banner
                </button>
              </div>

              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-snug">{selectedCamp.title}</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed text-justify bg-slate-50 p-3 rounded-xl border border-slate-100 max-h-32 overflow-y-auto">
                  {selectedCamp.description}
                </p>
              </div>

              {/* Progress and Goal values */}
              {(() => {
                const progressPct = Math.min(100, Math.round((selectedCamp.collectedAmount / selectedCamp.targetAmount) * 100));
                return (
                  <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600 font-mono">
                      <span>Terkumpul: Rp {selectedCamp.collectedAmount.toLocaleString('id-ID')}</span>
                      <span className="text-emerald-700">{progressPct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full animate-pulse" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{selectedCamp.donorCount} Donatur Berkah</span>
                      <span>Target: Rp {selectedCamp.targetAmount.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Donation Form inputs inside detailed page */}
            {!donationSuccess && (
              <div className="space-y-4 pt-3 border-t border-slate-100">
                {/* Nominal Preset Buttons */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-slate-700">Pilih Nominal Infaq</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10000, 25000, 50000, 100000].map((val) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => {
                          setDonateAmount(val);
                          setCustomAmountStr('');
                        }}
                        className={`py-2 px-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                          donateAmount === val && !customAmountStr
                            ? 'bg-teal-600 text-white border-teal-600 shadow-md scale-102 font-extrabold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Rp {(val / 1000)}K
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Nominal Text input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700">Kemampuan Khusus (Nominal Kustom)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">Rp</span>
                    <input
                      type="number"
                      placeholder="Masukkan nominal lainnya, contoh: 250000"
                      value={customAmountStr}
                      onChange={(e) => setCustomAmountStr(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>                {/* Kampanye-Specific Payment Configurations Block */}
                <div className="space-y-3">
                  <label className="block text-xs font-extrabold text-slate-700 flex items-center justify-between">
                    <span>Saluran Metode Pembayaran</span>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-sans font-bold uppercase">Dukungan Syariah</span>
                  </label>

                  {/* Channel selectors if multiple available */}
                  {campChannels.length > 1 && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        {campChannels.map((ch) => (
                          <button
                            type="button"
                            key={ch.id}
                            onClick={() => setSelectedChannelId(ch.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              selectedChannelId === ch.id
                                ? 'border-teal-500 bg-teal-50/20 ring-1 ring-teal-500'
                                : 'border-slate-200 bg-white hover:bg-slate-50/50'
                            }`}
                          >
                            <span className="block text-[11px] font-extrabold text-slate-800 leading-tight truncate">
                              {ch.name}
                            </span>
                            <span className="block text-[9px] text-slate-400 mt-0.5 truncate uppercase font-bold font-sans">
                              {ch.type === 'QRIS Code' ? 'QRIS Instan' : 'Transfer'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inside active channel details */}
                  {(() => {
                    const activeChannel = campChannels.find(ch => ch.id === selectedChannelId) || campChannels[0];
                    if (!activeChannel) return null;

                    return (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
                        {activeChannel.type === 'QRIS Code' ? (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium font-sans">Metode Penyaluran:</span>
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-sans">QRIS Instan</span>
                            </div>

                            {activeChannel.qrisImageUrl ? (
                              <div className="flex flex-col items-center py-2 space-y-2">
                                <div 
                                  className="w-32 h-32 rounded-xl border border-slate-200 shadow-xs p-1.5 bg-white cursor-zoom-in relative group overflow-hidden"
                                  onClick={() => setIsQrisZoomed(true)}
                                  title="Klik untuk memperbesar QRIS"
                                >
                                  <img src={activeChannel.qrisImageUrl} alt="QRIS Syariah" className="w-full h-full object-contain" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <ZoomIn className="h-5 w-5 text-white" />
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold font-sans">Klik gambar QRIS di atas untuk memperbesar</span>
                              </div>
                            ) : (
                              <div className="text-center p-4 border border-dashed rounded-lg text-rose-500 font-bold text-xs bg-rose-50/55">
                                ⚠️ Kode QRIS digital belum diunggah admin untuk program ini.
                              </div>
                            )}

                            <div className="p-2 bg-slate-50 rounded-lg text-[10px] leading-relaxed text-slate-500 text-center font-medium font-sans border border-slate-100">
                              Atas nama: <strong className="text-slate-700">{activeChannel.accountHolder}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium font-sans">Metode Penyaluran:</span>
                              <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-sans">Transfer Bank</span>
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-600 space-y-1.5 border border-slate-150">
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium font-sans">Penyaluran:</span>
                                <span className="font-extrabold text-slate-800 truncate max-w-[150px]">
                                  {activeChannel.name}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium font-sans">Nomor Rekening:</span>
                                <strong className="font-mono font-extrabold text-emerald-800 bg-white border border-slate-200 px-2 py-0.5 rounded select-all shadow-2xs font-sans">
                                  {activeChannel.accountNo}
                                </strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium font-sans">Atas Nama:</span>
                                <span className="font-extrabold text-slate-800 truncate max-w-[150px]">
                                  {activeChannel.accountHolder}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Action Submit */}
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-teal-600/10 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  Kirim Sedekah Berkah (Rp {customAmountStr ? parseInt(customAmountStr).toLocaleString('id-ID') : donateAmount.toLocaleString('id-ID')})
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search Input Filter */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Cari program sedekah santri pelosok..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-teal-500 focus:outline-hidden rounded-xl pl-10 pr-4 py-2.5 text-xs transition-colors"
              />
            </div>

            {/* Listing Grid */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {filteredCampaigns.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">Tidak ada penyaluran sedekah ditemukan</p>
                  <p className="text-[10px] text-slate-400 p-1">Coba bersihkan pencari atau masukkan kata kunci alternatif.</p>
                </div>
              ) : (
                filteredCampaigns.map((camp) => {
                  const progressPct = Math.min(100, Math.round((camp.collectedAmount / camp.targetAmount) * 100));
                  return (
                    <div
                      key={camp.id}
                      onClick={() => {
                        setSelectedCamp(camp);
                        setDonationSuccess(false);
                      }}
                      className="p-3 bg-white rounded-xl border border-slate-150 hover:border-teal-300 hover:shadow-xs transition-all cursor-pointer flex gap-3 group"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border bg-slate-100">
                        <img src={camp.thumbnailUrl} alt={camp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-800 group-hover:text-teal-700 transition-colors line-clamp-1">{camp.title}</h4>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{camp.description}</p>
                        </div>
                        
                        {/* Compact Stats with Target and Progress Bar */}
                        <div className="space-y-1 mt-1">
                          <div className="flex justify-between items-center text-[9px] font-bold text-slate-550">
                            <span>Terkumpul: <strong className="text-slate-800 font-mono text-[9px]">Rp {camp.collectedAmount.toLocaleString('id-ID')}</strong></span>
                            <span>Target: <strong className="text-slate-600 font-mono text-[9px]">Rp {camp.targetAmount.toLocaleString('id-ID')}</strong></span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden relative">
                            <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                          </div>
                          <div className="flex justify-between items-center text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                            <span>{camp.donorCount} Donatur</span>
                            <span className="text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">{progressPct}% Terpenuhi</span>
                          </div>
                        </div>
                      </div>
                      <div className="self-center text-slate-300 group-hover:text-teal-500 transition-colors px-1 shrink-0">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Seluruh infaq yang disalurkan bersifat sukarela. Semoga menjadi amal jariyah yang mengalir selamanya.
            </p>
          </div>
        )}
      </Modal>

      {/* ZOOM MODAL: FULL IMAGE PREVIEW */}
      <AnimatePresence>
        {isZoomed && selectedCamp && (
          <div 
            onClick={() => setIsZoomed(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl"
            >
              <img 
                src={selectedCamp.thumbnailUrl} 
                alt="Zoomed Campaign Banner" 
                className="w-full h-auto object-contain max-h-[80vh]"
              />
              <div className="p-3 bg-black/80 text-white text-xs font-bold text-center flex justify-between items-center">
                <span>{selectedCamp.title}</span>
                <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-md flex items-center gap-1">
                  Klik di mana saja untuk menutup
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION CONFIRM ACTION DIALOG */}
      <AnimatePresence>
        {showConfirmModal && selectedCamp && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-150">
                <HeartHandshake className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Pengiriman Infaq</h3>
                <p className="text-xs text-slate-500 leading-relaxed text-center">
                  Apakah Anda yakin ingin mengirimkan kontribusi sedekah senilai{' '}
                  <strong className="text-emerald-700 font-extrabold font-mono font-sans">
                    Rp {customAmountStr ? parseInt(customAmountStr).toLocaleString('id-ID') : donateAmount.toLocaleString('id-ID')}
                  </strong>{' '}
                  ke program <strong>"{selectedCamp.title}"</strong> menggunakan metode{' '}
                  <strong className="font-extrabold text-teal-700 font-sans">
                    {activeChannel?.name || 'Metode Pembayaran'}
                  </strong>?
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  onClick={triggerDonatePayment}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-md cursor-pointer"
                >
                  Ya, Kirim Sedekah!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ZOOM MODAL FOR QRIS SYARIAH */}
      <AnimatePresence>
        {isQrisZoomed && qrisZoomUrl && (
          <div 
            onClick={() => setIsQrisZoomed(false)}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md cursor-zoom-out animate-fade-in"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-sm w-full overflow-hidden rounded-2xl bg-white p-5 border border-slate-200 shadow-2xl flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsQrisZoomed(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 hover:text-slate-705 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-4 font-sans">Kode QRIS Penyaluran Sedekah</h4>
              <div className="w-full aspect-square bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-center justify-center shadow-inner">
                <img 
                  src={qrisZoomUrl} 
                  alt="QRIS Zoomed" 
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-4 font-medium leading-relaxed font-sans">
                Pindai QRIS di atas untuk menyelesaikan infaq Anda secara langsung.<br /> 
                Klik tombol silang atau di luar area gambar untuk menutup.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Custom Loader component helper
type Loader2Props = React.SVGProps<SVGSVGElement>;
function Loader2(props: Loader2Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
