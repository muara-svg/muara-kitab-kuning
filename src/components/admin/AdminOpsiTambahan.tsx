import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Star, 
  Save, 
  RotateCcw, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAppConfig, saveAppConfig, AppConfig, DEFAULT_APP_CONFIG } from '../../lib/appConfigService';

interface AdminOpsiTambahanProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  initialTab?: 'tentang' | 'kebijakan' | 'rating';
}

export default function AdminOpsiTambahan({ onSuccess, onError, initialTab }: AdminOpsiTambahanProps) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [activeSubTab, setActiveSubTab] = useState<'tentang' | 'kebijakan' | 'rating'>('tentang');
  
  // React to parent sidebar selection changes
  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);
  
  // Form states matching active selection to prevent synchronization gaps
  const [aboutTitle, setAboutTitle] = useState('');
  const [aboutContent, setAboutContent] = useState('');
  
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyContent, setPolicyContent] = useState('');
  
  const [ratingTitle, setRatingTitle] = useState('');
  const [ratingContent, setRatingContent] = useState('');

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load configuration from database/local manifest on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const loadedConfig = await getAppConfig();
        setConfig(loadedConfig);
        
        // Initialize working inputs
        setAboutTitle(loadedConfig.aboutApp?.title || 'Tentang Aplikasi MUARA');
        setAboutContent(loadedConfig.aboutApp?.content || '');
        
        setPolicyTitle(loadedConfig.privacyPolicy?.title || 'Kebijakan Privasi');
        setPolicyContent(loadedConfig.privacyPolicy?.content || '');
        
        setRatingTitle(loadedConfig.giveRating?.title || 'Beri Rating MUARA');
        setRatingContent(loadedConfig.giveRating?.content || '');
      } catch (err: any) {
        console.error('Gagal meload konfigurasi aplikasi:', err);
        onError('Gagal memuat data konfigurasi aplikasi.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveActiveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedConfig: AppConfig = {
        aboutApp: {
          title: aboutTitle.trim() || 'Tentang Aplikasi MUARA',
          content: aboutContent.trim(),
          lastUpdated: new Date().toISOString()
        },
        privacyPolicy: {
          title: policyTitle.trim() || 'Kebijakan Privasi',
          content: policyContent.trim(),
          lastUpdated: new Date().toISOString()
        },
        giveRating: {
          title: ratingTitle.trim() || 'Beri Rating MUARA',
          content: ratingContent.trim(),
          lastUpdated: new Date().toISOString()
        }
      };

      await saveAppConfig(updatedConfig);
      setConfig(updatedConfig);
      onSuccess(`Konfigurasi ${activeSubTab === 'tentang' ? 'Tentang Aplikasi' : activeSubTab === 'kebijakan' ? 'Kebijakan Privasi' : 'Ulasan Rating'} berhasil disimpan dan disinkronkan ke seluruh pengguna!`);
    } catch (err: any) {
      console.error('Gagal menarget konfigurasi simpanan:', err);
      onError(err.message || 'Gagal menyimpan konfigurasi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInjectSample = (type: 'tentang' | 'kebijakan' | 'rating') => {
    if (type === 'tentang') {
      setAboutTitle('Tentang Aplikasi MUARA Digital');
      setAboutContent(`MUARA adalah ekosistem kajian kitab kuning digital terlengkap yang menyatukan literatur teologi klasik bercorak mazhab Syafi'i dengan kecerdasan buatan (Santri AI). 

Aplikasi ini bertujuan untuk memudahkan santri, asatidz, dan masyarakat umum dalam mempelajari teks kitab salaf secara tepat, mengkaji makhraj tajwid yang sah, mendaras keabsahan sanad riwayat, serta mendedikasikan sebagian rezeki melalui donasi sosial santunan satu pintu.`);
    } else if (type === 'kebijakan') {
      setPolicyTitle('Kebijakan Privasi & Jaminan Keamanan');
      setPolicyContent(`Tim Pengembang MUARA berkomitmen tinggi untuk melindungi keamanan data pribadi serta detail profil spiritual para pengguna.

Berikut adalah pilar proteksi kami:
1. Data login disimpan terenkripsi di dalam layanan terakreditasi Google Firebase Auth.
2. Kami tidak pernah memperjualbelikan nomor WhatsApp, email, ataupun kontak santri kepada pihak ketiga.
3. Seluruh rincian riwayat donasi atau muthala'ah tercatat secara privat dan hanya dapat dibaca oleh pemilik akun sah.`);
    } else if (type === 'rating') {
      setRatingTitle('Beri Rating MUARA Bintang 5');
      setRatingContent('https://play.google.com/store/apps/details?id=com.muara.app');
    }
    onSuccess('Contoh teks rekomendasi profesional berhasil disematkan. Silakan tekan Simpan Perubahan!');
  };

  const isConfigured = (content: string) => {
    return content.trim().length > 0;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3 font-sans text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-800 border-t-transparent" />
        <p className="text-xs font-semibold">Sedang memuat bumbu manifes konfigurasi tambahan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600 animate-pulse" />
            Konfigurasi Opsi Tambahan Aplikasi
          </h2>
          <p className="text-xs text-slate-500">Kelola informasi legalitas dan publikasi profil yang langsung sinkron ke menu akun di device pengguna.</p>
        </div>
      </div>

      {/* SUB MENU FILTER */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl max-w-lg mb-4 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('tentang')}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'tentang'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Tentang Aplikasi</span>
        </button>

        <button
          onClick={() => setActiveSubTab('kebijakan')}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'kebijakan'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Kebijakan Privasi</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rating')}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'rating'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Star className="h-4 w-4" />
          <span>Beri Rating</span>
        </button>
      </div>

      {/* FORM UTAMA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <form onSubmit={handleSaveActiveConfig} className="lg:col-span-2 space-y-5 bg-slate-50 p-5 rounded-2xl border">
          <AnimatePresence mode="wait">
            {activeSubTab === 'tentang' && (
              <motion.div
                key="about-fields"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Formulir Tentang Aplikasi</span>
                  <button
                    type="button"
                    onClick={() => handleInjectSample('tentang')}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                  >
                    💡 Gunakan Contoh Teks
                  </button>
                </div>

                {!isConfigured(aboutContent) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex gap-2.5 items-start">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">⚠️ Data belum diinput oleh Admin:</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                        Karena data kustom masih kosong, di sisi pengguna akan ditampilkan notifikasi default: <strong>"Fitur sedang berada dalam proses pengembangan..."</strong>
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Judul Menu Tampilan</label>
                  <input
                    type="text"
                    required
                    value={aboutTitle}
                    onChange={(e) => setAboutTitle(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                    placeholder="Contoh: Tentang Aplikasi MUARA"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Konten Penjelasan (Deskripsi / Syarat Lengkap)</label>
                    <span className="text-[10px] text-slate-400 font-mono">{aboutContent.length} karakter</span>
                  </div>
                  <textarea
                    rows={8}
                    required
                    value={aboutContent}
                    onChange={(e) => setAboutContent(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-3 text-xs focus:border-emerald-500 focus:outline-hidden bg-white leading-relaxed resize-y"
                    placeholder="Tuliskan ulasan mengenai perilis aplikasi, dewan syariah, dan misi pembinaan kitab kuning di sini..."
                  />
                </div>
              </motion.div>
            )}

            {activeSubTab === 'kebijakan' && (
              <motion.div
                key="policy-fields"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Formulir Kebijakan Privasi</span>
                  <button
                    type="button"
                    onClick={() => handleInjectSample('kebijakan')}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                  >
                    💡 Gunakan Contoh Teks
                  </button>
                </div>

                {!isConfigured(policyContent) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex gap-2.5 items-start">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">⚠️ Data belum diinput oleh Admin:</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                        Karena data kustom masih kosong, di sisi pengguna akan ditampilkan notifikasi default: <strong>"Fitur sedang berada dalam proses pengembangan..."</strong>
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Judul Menu Tampilan</label>
                  <input
                    type="text"
                    required
                    value={policyTitle}
                    onChange={(e) => setPolicyTitle(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                    placeholder="Contoh: Kebijakan Privasi & Keamanan"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Konten Kebijakan Privasi syariah</label>
                    <span className="text-[10px] text-slate-400 font-mono">{policyContent.length} karakter</span>
                  </div>
                  <textarea
                    rows={8}
                    required
                    value={policyContent}
                    onChange={(e) => setPolicyContent(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-3 text-xs focus:border-emerald-500 focus:outline-hidden bg-white leading-relaxed resize-y"
                    placeholder="Tuliskan komitmen perlindungan sandi, riwayat dana infaq sedekah, serta data muthalaah santri Anda..."
                  />
                </div>
              </motion.div>
            )}

            {activeSubTab === 'rating' && (
              <motion.div
                key="rating-fields"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Formulir Link Beri Rating App</span>
                  <button
                    type="button"
                    onClick={() => handleInjectSample('rating')}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                  >
                    💡 Gunakan Contoh Tautan
                  </button>
                </div>

                {!isConfigured(ratingContent) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex gap-2.5 items-start">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">⚠️ Tautan belum diinput oleh Admin:</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                        Karena tautan kustom masih kosong, di sisi pengguna akan ditampilkan notifikasi default: <strong>"Fitur sedang berada dalam proses pengembangan..."</strong>
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Judul Menu Tampilan</label>
                  <input
                    type="text"
                    required
                    value={ratingTitle}
                    onChange={(e) => setRatingTitle(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                    placeholder="Contoh: Beri Rating MUARA Bintang 5"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Tautan / URL Tujuan Rating (Redirect Link)</label>
                    <span className="text-[10px] text-slate-400 font-mono">Tautan Aktif</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={ratingContent}
                    onChange={(e) => setRatingContent(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white font-mono text-emerald-800"
                    placeholder="https://play.google.com/store/apps/details?id=com.muara.app"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Masukkan alamat Play Store, App Store, atau kuesioner rating eksternal. Penilaian langsung mengarahkan user setelah konfirmasi keluar.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-3 border-t flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-750 transition-colors shadow-lg shadow-emerald-600/10 active:scale-97 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>

        {/* PRAGMATIC LIVESTREAM PREVIEW IN DESKTOP RAIL */}
        <div className="space-y-4">
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-1.5 leading-none">
            <Info className="h-4 w-4 text-slate-450" /> Tinjauan Visual Langsung (User View)
          </span>

          <div className="border border-slate-200 rounded-3xl bg-white shadow-md overflow-hidden relative font-sans scale-95 origin-top">
            <div className="bg-gradient-to-r from-emerald-800 to-[#042f2e] text-white p-3 flex items-center justify-between select-none">
              <span className="font-extrabold text-[10.5px] uppercase tracking-wider">Antarmuka Aplikasi MUARA</span>
              <span className="text-[9px] font-mono opacity-60">Smartphone Emulation</span>
            </div>
            
            <div className="p-5 text-center min-h-[300px] flex flex-col justify-center items-center space-y-4 bg-slate-50/40">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-teal-50 text-emerald-700 border border-teal-150 flex items-center justify-center shadow-xs">
                {activeSubTab === 'tentang' && <FileText className="h-6 w-6 text-emerald-650" />}
                {activeSubTab === 'kebijakan' && <ShieldCheck className="h-6 w-6 text-emerald-650" />}
                {activeSubTab === 'rating' && <Star className="h-6 w-6 text-yellow-500 fill-yellow-405 animate-pulse" />}
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-800 text-sm">
                  {activeSubTab === 'tentang' ? aboutTitle : activeSubTab === 'kebijakan' ? policyTitle : ratingTitle}
                </h4>
                
                <div className="p-3 bg-white border border-slate-150 rounded-xl max-w-xs mx-auto text-left min-h-[140px] max-h-[180px] overflow-y-auto">
                  {activeSubTab === 'tentang' && (
                    aboutContent.trim() ? (
                      <p className="text-[11px] text-slate-500 whitespace-pre-wrap leading-relaxed">{aboutContent}</p>
                    ) : (
                      <div className="text-center py-6">
                        <span className="text-teal-800 text-xs font-extrabold uppercase tracking-widest block">Fitur Sedang Berada Dalam Proses Pengembangan</span>
                        <p className="text-[10px] text-slate-400 mt-1">Halaman profil pengembang dan manual instruksi lengkap dalam konstruksi.</p>
                      </div>
                    )
                  )}

                  {activeSubTab === 'kebijakan' && (
                    policyContent.trim() ? (
                      <p className="text-[11px] text-slate-500 whitespace-pre-wrap leading-relaxed">{policyContent}</p>
                    ) : (
                      <div className="text-center py-6">
                        <span className="text-teal-800 text-xs font-extrabold uppercase tracking-widest block">Fitur Sedang Berada Dalam Proses Pengembangan</span>
                        <p className="text-[10px] text-slate-400 mt-1">Pernyataan privasi legal lengkap sedang diformulasi tim syariah.</p>
                      </div>
                    )
                  )}

                  {activeSubTab === 'rating' && (
                    ratingContent.trim() ? (
                      <div className="text-center p-2 space-y-3">
                        <p className="text-[10px] text-slate-500 font-medium">Bantu kami thalabul ilmi dengan memberikan ulasan di:</p>
                        <div className="bg-emerald-50 text-emerald-800 text-[9px] font-mono p-2 rounded-lg border border-emerald-200 truncate">
                          {ratingContent}
                        </div>
                        <button
                          type="button"
                          className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-[10px] font-bold"
                          onClick={() => alert('Emulasi: Klik ini di sisi user akan memicu konfirmasi Keluar Aplikasi!')}
                        >
                          Beri Rating Sekarang
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <span className="text-teal-800 text-xs font-extrabold uppercase tracking-widest block">Fitur Sedang Berada Dalam Proses Pengembangan</span>
                        <p className="text-[10px] text-slate-400 mt-1">Umpan balik kepuasan Google Play Store / App Store mendatang.</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border"
                >
                  Kembali ke Akun
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
