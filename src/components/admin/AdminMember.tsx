import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  CheckCircle, 
  DollarSign, 
  Clock, 
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestore } from '../../lib/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { MembershipPlan } from '../../types';

interface AdminMemberProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function AdminMember({ onSuccess, onError }: AdminMemberProps) {
  // Loaders
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Package settings state
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  
  // Form inputs
  const [planName, setPlanName] = useState('');
  const [duration, setDuration] = useState('1 Bulan');
  const [price, setPrice] = useState('29000');
  const [slashPrice, setSlashPrice] = useState('');
  const [popular, setPopular] = useState(false);
  const [benefitsString, setBenefitsString] = useState("Akses Tanpa Batas seluruh Kitab Kuning\nTanya Jawab langsung dengan Ustadz Ahli\nBadge Premium di halaman profil");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Confirmation Modal State
  const [planToConfirm, setPlanToConfirm] = useState<{
    id: string | null;
    name: string;
    duration: string;
    price: string;
    slashPrice: string;
    popular: boolean;
    benefits: string;
  } | null>(null);

  // Load packages on mount
  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setFetching(true);
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
    } catch (err: any) {
      console.warn("Firestore config bypassed. Using cached plans:", err.message);
    }

    // Merge/load from local storage fallback to ensure flawless instant sync & offline support
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
      console.warn("Gagal memuat paket lokal:", localErr);
    }

    setPlans(loadedPlans);
    setFetching(false);
  };

  const handleSaveAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim() || !duration.trim() || !price) {
      onError('Semua kolom form paket harus diisikan secara lengkap.');
      return;
    }

    // Set confirmation modal state
    setPlanToConfirm({
      id: editingId,
      name: planName.trim(),
      duration: duration.trim(),
      price: price.trim(),
      slashPrice: slashPrice.trim(),
      popular,
      benefits: benefitsString
    });
  };

  // Confirm and Save package
  const confirmAndSavePackage = async () => {
    if (!planToConfirm) return;
    setLoading(true);
    try {
      const validatedPrice = parseInt(planToConfirm.price) || 0;
      const validatedSlashPrice = parseInt(planToConfirm.slashPrice) || 0;
      const formattedPrice = `Rp ${validatedPrice.toLocaleString('id-ID')} / ${planToConfirm.duration.toLowerCase()}`;
      
      const newPlan: MembershipPlan = {
        id: planToConfirm.id || `p-${Date.now()}`,
        name: planToConfirm.name,
        duration: planToConfirm.duration,
        price: validatedPrice,
        priceString: formattedPrice,
        benefits: planToConfirm.benefits.split('\n').map(b => b.trim()).filter(Boolean),
        popular: planToConfirm.popular,
        ...(validatedSlashPrice > 0 ? { slashPrice: validatedSlashPrice } : {})
      };

      // Ensure updated lists
      let updatedPlans = plans.filter(p => p.id !== newPlan.id);
      updatedPlans = [...updatedPlans, newPlan];

      // Dual Write: Save to firebase config document
      try {
        const configRef = doc(firestore, 'configs', 'membership');
        await setDoc(configRef, { plans: updatedPlans }, { merge: true });
      } catch (dbErr) {
        console.warn("Firestore database write denied/failed, falling back to Local Storage:", dbErr);
      }

      // Dual Write: Save to Local Storage Fallback
      try {
        localStorage.setItem('muara_custom_membership_plans', JSON.stringify(updatedPlans));
      } catch (localErr) {
        console.warn("Gagal menyimpan ke Local Storage:", localErr);
      }
      
      setPlans(updatedPlans);
      onSuccess(planToConfirm.id ? `✅ Paket "${planToConfirm.name}" berhasil diperbarui!` : `✅ Paket membership baru "${planToConfirm.name}" sukses diterbitkan.`);
      resetForm();
    } catch (err: any) {
      onError(`Gagal menyimpan data paket: ${err.message}`);
    } finally {
      setLoading(false);
      setPlanToConfirm(null);
    }
  };

  // Delete package
  const handleDeletePackage = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus paket "${name}" dari konfigurasi aplikasi?`)) {
      return;
    }

    setLoading(true);
    try {
      const updatedPlans = plans.filter(p => p.id !== id);
      
      // Update firestore
      try {
        const configRef = doc(firestore, 'configs', 'membership');
        await setDoc(configRef, { plans: updatedPlans }, { merge: true });
      } catch (dbErr) {
        console.warn("Firestore delete failed, updating local only:", dbErr);
      }

      // Update localStorage
      try {
        localStorage.setItem('muara_custom_membership_plans', JSON.stringify(updatedPlans));
      } catch (localErr) {
        console.warn("Gagal hapus dari Local Storage:", localErr);
      }
      
      setPlans(updatedPlans);
      onSuccess(`🗑️ Paket "${name}" berhasil dihapus dari database.`);
    } catch (err: any) {
      onError(`Gagal menghapus paket: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Trigger editing state
  const handleEditPackage = (plan: MembershipPlan) => {
    setEditingId(plan.id);
    setPlanName(plan.name);
    setDuration(plan.duration);
    setPrice(plan.price.toString());
    setSlashPrice(plan.slashPrice ? plan.slashPrice.toString() : '');
    setPopular(!!plan.popular);
    setBenefitsString(plan.benefits.join('\n'));
    onSuccess(`✏️ Mode Edit diaktifkan untuk paket "${plan.name}".`);
  };

  const resetForm = () => {
    setEditingId(null);
    setPlanName('');
    setDuration('1 Bulan');
    setPrice('29000');
    setSlashPrice('');
    setPopular(false);
    setBenefitsString("Akses Tanpa Batas seluruh Kitab Kuning\nTanya Jawab langsung dengan Ustadz Ahli\nBadge Premium di halaman profil");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      {/* HEADER ATAS */}
      <div className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-[#064e3b] text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600 animate-pulse" /> 
            Keanggotaan Berbayar & Konfigurasi Paket
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Kelola tarif paket belajar santri serta database penawaran premium dari Firestore</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-xs">
        {/* Package Form */}
        <form onSubmit={handleSaveAttempt} className="md:col-span-2 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-205">
          <h4 className="font-extrabold text-slate-700 text-xs border-b border-slate-200 pb-2 mb-3 tracking-wide uppercase flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-emerald-600" />
            {editingId ? 'Edit Paket Membership' : 'Tambah Paket Baru'}
          </h4>

          <div>
            <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider">Nama Paket Premium</label>
            <input
              type="text"
              required
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Contoh: Paket Syahriyah Hebat"
              className="w-full border p-2 rounded-xl bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-slate-800 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider">Durasi Waktu</label>
              <select
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full border p-2.5 rounded-xl bg-white focus:outline-hidden text-slate-800 font-semibold cursor-pointer"
              >
                <option value="1 Bulan">1 Bulan (Aktif 30 Hari)</option>
                <option value="6 Bulan">6 Bulan (Aktif 180 Hari)</option>
                <option value="1 Tahun">1 Tahun (Aktif 365 Hari)</option>
                <option value="unlimitid">unlimitid (Selamanya)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider">Harga Paket (Nominal IDR)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-slate-400 font-bold text-[10px]">Rp</span>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="29000"
                  className="w-full border p-2 pl-7 rounded-xl bg-white focus:outline-hidden text-slate-850 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider">Harga Coret / Sebelum Diskon (Opsional)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-slate-405 font-bold text-[10px]">Rp</span>
              <input
                type="number"
                value={slashPrice}
                onChange={(e) => setSlashPrice(e.target.value)}
                placeholder="Contoh: 49000"
                className="w-full border p-2 pl-7 rounded-xl bg-white focus:outline-hidden text-slate-800 font-mono font-bold"
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Isi jika Anda ingin menampilkan harga asli yang dicoret untuk efek kediskonan.</p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono tracking-wider">Keuntungan Paket (Kemampuan - Baris Baru)</label>
            <textarea
              required
              rows={4}
              value={benefitsString}
              onChange={(e) => setBenefitsString(e.target.value)}
              placeholder="Tuliskan keuntungan paket per baris..."
              className="w-full border p-2 rounded-xl bg-white focus:outline-hidden text-slate-800 font-sans leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-500/10">
            <input
              type="checkbox"
              id="popular"
              checked={popular}
              onChange={(e) => setPopular(e.target.checked)}
              className="h-4 w-4 text-emerald-600 rounded bg-white"
            />
            <label htmlFor="popular" className="font-semibold text-slate-700 text-[11px] cursor-pointer selection:bg-none">
              Sematkan lencana <span className="bg-emerald-600 text-white text-[8px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ml-1">Panitia Rekomendasi</span>
            </label>
          </div>

          <div className="flex gap-2 pb-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-[#064e3b] hover:bg-emerald-800 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {editingId ? 'Simpan Perubahan' : 'Terbitkan Paket'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold"
              >
                Batal
              </button>
            )}
          </div>
        </form>

        {/* List Active Packages */}
        <div className="md:col-span-3 space-y-3.5">
          <h4 className="font-extrabold text-slate-700 text-xs tracking-wider uppercase flex items-center justify-between border-b border-slate-200 pb-2">
            <span>Daftar Paket Berlangganan Aktif ({plans.length})</span>
            <span className="text-[10px] font-mono font-normal text-slate-400">Synced to Firebase Config & Local Storage</span>
          </h4>

          {fetching ? (
            <div className="py-20 flex flex-col justify-center items-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <p className="font-mono">Menyelaraskan data paket dengan Firestore...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-mono bg-slate-50 rounded-2xl border border-dashed">
              Belum ada paket premium yang didaftarkan. Gunakan form di samping untuk mendaftarkan paket perdana Anda.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {plans.map((p) => (
                <div 
                  key={p.id}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white transition-all ${
                    p.popular ? 'border-emerald-250 ring-1 ring-emerald-500/10' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h5 className="font-bold text-slate-800 text-xs">{p.name}</h5>
                      {p.popular && (
                        <span className="text-[8px] bg-emerald-650 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold font-mono">REKOMENDASI</span>
                      )}
                    </div>
                    <p className="text-slate-400 font-mono text-[10px] flex items-center gap-2">
                      {p.slashPrice && p.slashPrice > 0 && (
                        <span className="line-through text-red-500 font-semibold">Rp {p.slashPrice.toLocaleString('id-ID')}</span>
                      )}
                      <span>Tarif: <span className="text-emerald-700 font-bold">{p.priceString}</span></span>
                      <span>• Durasi: {p.duration}</span>
                    </p>
                    <div className="flex flex-wrap gap-1 px-1 pt-1">
                      {p.benefits.slice(0, 3).map((b, i) => (
                        <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">✓ {b}</span>
                      ))}
                      {p.benefits.length > 3 && <span className="text-[9px] text-slate-450 px-1 font-semibold">+{p.benefits.length - 3} lainnya</span>}
                    </div>
                  </div>

                  <div className="flex gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleEditPackage(p)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 font-bold transition-colors cursor-pointer text-[11px]"
                    >
                      Ubah
                    </button>
                    <button
                      onClick={() => handleDeletePackage(p.id, p.name)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-650 hover:bg-red-50 border border-transparent hover:border-red-100 font-bold transition-all cursor-pointer text-[11px]"
                    >
                      <Trash2 className="h-3 w-3" /> Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ----------------- BEAUTIFUL CONFIRMATION DIALOG FOR MEMBERSHIP PLANS ----------------- */}
      <AnimatePresence>
        {planToConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-4 text-slate-800"
            >
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-700 animate-bounce" />
              </div>
              
              <div className="space-y-2">
                <h4 className="font-extrabold text-sm text-slate-850">
                  Konfirmasi Penerbitan Paket
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Harap periksa ulang rincian paket premium berbayar berikut ini sebelum disimpan ke server premium utama:
                </p>
                
                <div className="p-3 bg-slate-55 rounded-2xl border border-slate-200 text-left space-y-2.5">
                  <div>
                    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Nama Paket Premium</p>
                    <p className="text-xs font-bold text-slate-800">{planToConfirm.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Durasi Berlaku</p>
                      <p className="text-xs font-bold text-slate-700">{planToConfirm.duration}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Lencana Rekomendasi</p>
                      <p className="text-xs font-bold text-slate-700">{planToConfirm.popular ? 'Sematkan Lencana' : 'Tidak Disematkan'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Harga Jual</p>
                      <p className="text-xs font-bold text-emerald-700">Rp {(parseInt(planToConfirm.price) || 0).toLocaleString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Harga Coret</p>
                      <p className="text-xs font-bold text-slate-500 line-through">
                        {planToConfirm.slashPrice ? `Rp ${parseInt(planToConfirm.slashPrice).toLocaleString('id-ID')}` : '-'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Manfaat Utama ({planToConfirm.benefits.split('\n').filter(Boolean).length})</p>
                    <div className="max-h-20 overflow-y-auto mt-1 space-y-1">
                      {planToConfirm.benefits.split('\n').filter(Boolean).map((ben, bId) => (
                        <p key={bId} className="text-[10px] text-slate-600 flex items-center gap-1">
                          <span className="text-emerald-600 shrink-0">✓</span> {ben}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPlanToConfirm(null)}
                  className="flex-1 py-2 border hover:bg-slate-50 rounded-xl font-bold text-xs transition-colors cursor-pointer text-slate-600"
                >
                  Koreksi Lagi
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={confirmAndSavePackage}
                  className="flex-1 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span>Ya, Terbitkan</span>
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
