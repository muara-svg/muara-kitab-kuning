import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Lock, 
  RotateCcw, 
  Wifi, 
  WifiOff, 
  Download, 
  Check, 
  Unlock, 
  Smartphone, 
  BookOpen, 
  Type, 
  ZoomIn, 
  ZoomOut, 
  Info, 
  AlertCircle,
  HelpCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Image as ImageIcon,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { indexedDbService } from '../lib/indexedDbService';
import { UserProfile } from '../types';
import { firestore } from '../lib/firebaseConfig';
import { doc, getDoc } from '../lib/customFirestore';

interface KitabReaderProps {
  kitab: any; // Can be MOCK structured KitabKuning or Firestore KitabItem
  userProfile: UserProfile;
  initialPageIdx?: number;
  onClose: () => void;
  onTriggerUpgrade?: () => void;
}

export default function KitabReader({ 
  kitab, 
  userProfile, 
  initialPageIdx = 0,
  onClose,
  onTriggerUpgrade 
}: KitabReaderProps) {
  // State for security / access control
  const isPremiumBook = !!kitab.isPremium || kitab.difficulty === 'Tingkat Lanjut'; 
  const isUserPremium = userProfile.membershipStatus === 'Premium Verified';
  const hasAccess = !isPremiumBook || isUserPremium;

  // Font zoom controls
  const [fontSize, setFontSize] = useState<number>(14); // in pixels for content

  // Connectivity and Offline states
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [forceOfflineSimulation, setForceOfflineSimulation] = useState<boolean>(false);
  const [isSavedOffline, setIsSavedOffline] = useState<boolean>(false);
  const [savingOffline, setSavingOffline] = useState<boolean>(false);
  const [loadedFromLocal, setLoadedFromLocal] = useState<boolean>(false);
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [currentKitabData, setCurrentKitabData] = useState<any>(kitab);

  // Security Java instruction guide modal status
  const [showAndroidSecurityInfo, setShowAndroidSecurityInfo] = useState<boolean>(false);

  // Pagination & Lazy rendering states (memory-saver)
  const [currentPageIdx, setCurrentPageIdx] = useState<number>(initialPageIdx);
  const readerScrollContainerRef = useRef<HTMLDivElement>(null);

  // Reading history and Toast feedback state (New feature request 4)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  // New Copy text handler for Premium users
  const handleCopyPageText = () => {
    if (!isUserPremium) {
      setToastMessage("🔒 Fitur Salin Materi hanya tersedia untuk Anggota Premium MUARA!");
      if (onTriggerUpgrade) {
        setTimeout(onTriggerUpgrade, 1500);
      }
      return;
    }

    try {
      let copyText = '';
      if (isStructuredMock && currentKitabData.chapters) {
        const ch = currentKitabData.chapters[currentPageIdx];
        if (ch) {
          copyText += `=== ${currentKitabData.title} ===\n`;
          copyText += `Bab: ${ch.title}\n\n`;
          ch.sections?.forEach((sec: any) => {
            copyText += `📌 ${sec.subTitle}\n`;
            copyText += `Arab:\n${sec.arabicText}\n\n`;
            copyText += `Terjemahan:\n"${sec.translatedText}"\n\n`;
            if (sec.explanation) {
              copyText += `Penjelasan:\n${sec.explanation}\n\n`;
            }
            copyText += `------------------\n\n`;
          });
        }
      } else if (isFirestoreText) {
        copyText += `=== ${currentKitabData.title} ===\n`;
        copyText += `Halaman ${currentPageIdx + 1}\n\n`;
        copyText += textPages[currentPageIdx] || '';
      } else {
        copyText += `=== ${currentKitabData.title} ===\n`;
        copyText += `Halaman ${currentPageIdx + 1}\nLink: ${currentKitabData.pages?.[currentPageIdx]}\n`;
      }

      navigator.clipboard.writeText(copyText.trim());
      setToastMessage("📋 Berhasil menyalin seluruh materi halaman ini ke clipboard!");
    } catch (err) {
      console.error("Gagal menyalin teks:", err);
      setToastMessage("⚠️ Gagal menyalin teks secara otomatis.");
    }
  };

  // Auto-clear active toast notifications after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const getStorageKey = () => {
    if (userProfile && userProfile.isLoggedIn && userProfile.id) {
      return `muara_riwayat_baca_${userProfile.id}`;
    }
    return 'muara_riwayat_baca';
  };

  const storageKey = getStorageKey();

  // Read current bookmark state to synchronize button display
  useEffect(() => {
    try {
      const historyRaw = localStorage.getItem(storageKey);
      const historyList = historyRaw ? JSON.parse(historyRaw) : [];
      const exists = historyList.some((item: any) => 
        item.bookId === kitab.id && item.pageIdx === currentPageIdx
      );
      setIsBookmarked(exists);
    } catch (e) {
      console.error(e);
    }
  }, [kitab.id, currentPageIdx, storageKey]);

  const handleToggleBookmark = () => {
    try {
      const historyRaw = localStorage.getItem(storageKey);
      let historyList = historyRaw ? JSON.parse(historyRaw) : [];
      
      const existsIdx = historyList.findIndex((item: any) => 
        item.bookId === kitab.id && item.pageIdx === currentPageIdx
      );

      if (existsIdx > -1) {
        historyList.splice(existsIdx, 1);
        localStorage.setItem(storageKey, JSON.stringify(historyList));
        setIsBookmarked(false);
        setToastMessage("Informasi: Penanda riwayat baca dicabut.");
      } else {
        const newItem = {
          bookId: kitab.id,
          bookTitle: kitab.title,
          author: kitab.author || 'Mufassir',
          sourceType: kitab.sourceType || 'structured',
          pageIdx: currentPageIdx,
          timestamp: new Date().toISOString()
        };
        // Keep unique: filter out other pages of same book to track only the latest page progress
        historyList = historyList.filter((item: any) => item.bookId !== kitab.id);
        historyList.unshift(newItem);
        localStorage.setItem(storageKey, JSON.stringify(historyList));
        setIsBookmarked(true);
        setToastMessage(`Sukses mencatat riwayat baca di Halaman ${currentPageIdx + 1}!`);
      }
    } catch (e) {
      console.error(e);
      setToastMessage("Gagal menyimpan riwayat membaca.");
    }
  };

  // Connectivity listeners
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Initial check offline cache
    checkOfflineStatus();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [kitab.id]);

  // Reset active page index on book or initial offset changes
  useEffect(() => {
    setCurrentPageIdx(initialPageIdx);
  }, [kitab.id, initialPageIdx]);

  // Synchronize dynamic kitab prop updates from Firestore listener in real-time
  useEffect(() => {
    if (kitab) {
      setCurrentKitabData(prev => {
        return {
          ...prev,
          ...kitab,
          pages: prev?.pages?.length ? prev.pages : (kitab.pages || []),
          textBody: prev?.textBody ? prev.textBody : (kitab.textBody || '')
        };
      });
    }
  }, [kitab]);

  // Set default font size when book data loads to match admin's aesthetic design exactly
  useEffect(() => {
    if (currentKitabData?.fontSize) {
      const sizeMap: Record<string, number> = {
        sm: 13,
        base: 15,
        lg: 17,
        xl: 20,
        '2xl': 24,
      };
      const numericSize = sizeMap[currentKitabData.fontSize];
      if (numericSize) {
        setFontSize(numericSize);
      }
    }
  }, [currentKitabData?.id, currentKitabData?.fontSize]);

  // Scroll content to top on page change
  useEffect(() => {
    if (readerScrollContainerRef.current) {
      readerScrollContainerRef.current.scrollTop = 0;
    }
  }, [currentPageIdx]);

  // Handle Offline State Switch
  const activeOffline = forceOfflineSimulation || !isOnline;

  useEffect(() => {
    syncDataSrc();
  }, [activeOffline, kitab.id]);

  // FITUR OFFLINE OTOMATIS & SINKRONISASI REALTIME (Silent Ground Caching in background)
  // Ketika user sedang online dan membuka suatu kitab, Firebase / local cache 
  // secara otomatis mengunduh, menyelaraskan, dan menyimpan data halaman teraktual
  // serta preferensi visual (seperti rata tengah, ukuran font) di latar belakang.
  useEffect(() => {
    if (hasAccess && isOnline && !forceOfflineSimulation && currentKitabData && currentKitabData.id) {
      const runSilentAutoCache = async () => {
        try {
          // Selalu perbarui cache lokal agar format/desain teraktual tersinkron sempurna
          const isFullyLoaded = currentKitabData.textBody || (currentKitabData.pages && currentKitabData.pages.length > 0) || currentKitabData.chapters;
          if (isFullyLoaded) {
            console.log(`[Silent Caching] Menyelaraskan format & konten "${currentKitabData.title}" secara realtime ke offline storage...`);
            await indexedDbService.saveKitab(currentKitabData);
            setIsSavedOffline(true);
          }
        } catch (err) {
          console.warn('[Silent Caching] Gagal memperbarui cache otomatis:', err);
        }
      };
      // Delay sedikit agar tidak membebani UI thread saat rendering sedang aktif
      const timer = setTimeout(runSilentAutoCache, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentKitabData, isOnline, forceOfflineSimulation, hasAccess]);

  const checkOfflineStatus = async () => {
    const saved = await indexedDbService.isSaved(kitab.id);
    setIsSavedOffline(saved);
  };

  const syncDataSrc = async () => {
    if (activeOffline) {
      // Pull from IndexedDB as source
      const localData = await indexedDbService.getKitab(kitab.id);
      if (localData) {
        setCurrentKitabData(localData);
        setLoadedFromLocal(true);
      } else {
        // Not saved offline
        setLoadedFromLocal(false);
      }
    } else {
      // Online mode, fetch on-demand if the prop is lacking the full text
      const isMockOrLocalCustom = !kitab.id || !kitab.id.startsWith('kitab-');
      const needsCloudFetch = !isMockOrLocalCustom && !kitab.textBody && (!kitab.pages || kitab.pages.length === 0);

      if (needsCloudFetch) {
        setLoadingContent(true);
        // Pre-emptively load from local IndexedDB cache if available
        let hasLocalCache = false;
        try {
          const localData = await indexedDbService.getKitab(kitab.id);
          if (localData && (localData.textBody || (localData.pages && localData.pages.length > 0))) {
            console.log(`[MUARA Reader] Cache lokal terbaca untuk "${kitab.title}".`);
            setCurrentKitabData(localData);
            setLoadedFromLocal(true);
            setLoadingContent(false);
            hasLocalCache = true;
          }
        } catch (localCheckErr) {
          console.warn('[MUARA Reader Cache Check] Gagal memeriksa IndexedDB cache:', localCheckErr);
        }

        try {
          if (!hasLocalCache) {
            setLoadingContent(true);
          }
          const contentSnap = await getDoc(doc(firestore, 'kitab_contents', kitab.id));
          if (contentSnap.exists()) {
            const cData = contentSnap.data();
            let finalPages: string[] = [];
            let finalTextBody = '';

            if (cData.isSegmented) {
              const chunkCount = cData.chunkCount || 0;
              const chunkPromises = [];
              for (let i = 0; i < chunkCount; i++) {
                chunkPromises.push(getDoc(doc(firestore, 'kitab_contents', `${kitab.id}_chunk_${i}`)));
              }
              const chunkSnaps = await Promise.all(chunkPromises);
              for (const snap of chunkSnaps) {
                if (snap.exists()) {
                  finalPages = finalPages.concat(snap.data().pages || []);
                }
              }
              finalTextBody = finalPages.join('\n\n');
            } else {
              finalPages = cData.pages || [];
              finalTextBody = cData.textBody || '';
            }

            const merged = {
              ...kitab,
              textAlign: cData.textAlign || kitab.textAlign || 'justify',
              direction: cData.direction || kitab.direction || 'auto',
              fontSize: cData.fontSize || kitab.fontSize || 'lg',
              lineHeight: cData.lineHeight || kitab.lineHeight || 'relaxed',
              jenisKitab: cData.jenisKitab || kitab.jenisKitab || 'terjemah',
              pages: finalPages,
              textBody: finalTextBody
            };
            setCurrentKitabData(merged);
            setLoadedFromLocal(false);
            
            // Auto cache with heavy body to IndexedDB quietly for offline stability!
            try {
              console.log(`[Auto-Caching Merged Content] "${kitab.title}"...`);
              await indexedDbService.saveKitab(merged);
              setIsSavedOffline(true);
            } catch (cacheErr) {
              console.warn('[Auto-Caching Merged Content Error]:', cacheErr);
            }
          } else {
            if (!hasLocalCache) {
              setCurrentKitabData(kitab);
              setLoadedFromLocal(false);
            }
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          if (errMsg.toLowerCase().includes('offline') || err?.code === 'unavailable') {
            console.warn("[MUARA Reader Offline Catch] Perangkat luring atau koneksi terputus. Menggunakan data dasar:", errMsg);
          } else {
            console.error("Gagal mengambil isi teks kitab dari cloud:", err);
          }
          if (!hasLocalCache) {
            setCurrentKitabData(kitab);
            setLoadedFromLocal(false);
          }
        } finally {
          setLoadingContent(false);
        }
      } else {
        setCurrentKitabData(kitab);
        setLoadedFromLocal(false);
      }
    }
  };

  // Download / Save Offline Handler (Keep manual button as helper indicator but automate it)
  const handleSaveOffline = async () => {
    setSavingOffline(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      await indexedDbService.saveKitab(kitab);
      setIsSavedOffline(true);
    } catch (e: any) {
      console.error("Gagal mendownload offline:", e);
      alert("Terjadi kegagalan saat menyimpan data offline.");
    } finally {
      setSavingOffline(false);
    }
  };

  // Delete local copy
  const handleDeleteOffline = async () => {
    if (window.confirm("Hapus file simpanan offline untuk kitab ini dari memori HP?")) {
      await indexedDbService.deleteKitab(kitab.id);
      setIsSavedOffline(false);
      if (activeOffline) {
        setLoadedFromLocal(false);
      }
    }
  };

  // Font zoom triggers
  const handleZoomIn = () => setFontSize(prev => Math.min(prev + 2, 28));
  const handleZoomOut = () => setFontSize(prev => Math.max(prev - 2, 10));

  // Render variables
  const isStructuredMock = !kitab.sourceType && Array.isArray(kitab.chapters);
  const isFirestoreText = currentKitabData.sourceType === 'text';
  const isFirestorePages = currentKitabData.sourceType === 'file';

  // HELPER PAGINATION (Ubah paragraf panjang menjadi beberapa halaman visual virtual)
  const getPaginatedTextPages = (): string[] => {
    if (currentKitabData.pages && currentKitabData.pages.length > 0 && currentKitabData.sourceType !== 'file') {
      return currentKitabData.pages;
    }
    const fullText = currentKitabData.textBody || '';
    if (!fullText) return [''];
    
    // Pecah teks berdasarkan paragraf untuk membentuk "Halaman Buku" yang indah & ringan (~1200 karakter per halaman)
    const paragraphs = fullText.split('\n');
    const pagesList: string[] = [];
    let currentBlock = '';
    
    paragraphs.forEach((p) => {
      if ((currentBlock + '\n' + p).length > 1200) {
        if (currentBlock.trim()) {
          pagesList.push(currentBlock.trim());
        }
        currentBlock = p;
      } else {
        currentBlock += (currentBlock ? '\n' : '') + p;
      }
    });
    if (currentBlock.trim()) {
      pagesList.push(currentBlock.trim());
    }
    return pagesList.length > 0 ? pagesList : [fullText];
  };

  const textPages = getPaginatedTextPages();

  // Hitung jumlah halaman total bergantung jenis kitab untuk validasi navigasi
  let totalPages = 1;
  if (isStructuredMock && currentKitabData.chapters) {
    totalPages = currentKitabData.chapters.length; // Per bab sebagai satu halaman/tampilan
  } else if (isFirestoreText) {
    totalPages = textPages.length; // Per blok teks virtual
  } else if (isFirestorePages && currentKitabData.pages) {
    totalPages = currentKitabData.pages.length; // Per gambar halaman fisik
  }

  // Preload halaman berikutnya secara pasif di latar belakang demi user experience instan
  useEffect(() => {
    if (isFirestorePages && currentKitabData.pages && currentPageIdx + 1 < totalPages) {
      const nextImgUrl = currentKitabData.pages[currentPageIdx + 1];
      if (nextImgUrl) {
        const img = new Image();
        img.src = nextImgUrl;
      }
    }
  }, [currentPageIdx, isFirestorePages, currentKitabData.pages, totalPages]);

  // MainActivity.java instruction text
  const mainActivityJavaCode = `package id.muara.app;

import android.os.Bundle;
import android.view.WindowManager; // <-- SUNTIK BARIS INI
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // AREA KEAMANAN MUARA ANTI-SCREENSHOT/RECORD KREDENSIAL VIP
        // Mengaktifkan bendera FLAG_SECURE untuk melarang pengambilan tangkapan layar (Screenshot)
        // serta memblokir perekaman layar (Screen Recording) di seluruh siklus hidup aplikasi.
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-screen overflow-hidden text-slate-800"
    >
      {/* ---------------- BAR ATAS (HEADER NAVIGATION & UTILITY) ---------------- */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between shadow-2xs shrink-0 select-none">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4.5 w-4.5 text-slate-700" />
          </button>
          
          <div>
            <h2 className="font-extrabold text-slate-800 text-[11px] sm:text-xs md:text-sm tracking-tight flex items-center gap-1.5">
              {currentKitabData.title}
              {isPremiumBook && (
                <span className="bg-amber-100 text-amber-700 text-[7px] sm:text-[8px] font-bold px-1 py-0.5 rounded uppercase font-mono tracking-wider flex items-center gap-0.5 border border-amber-200 shadow-3xs">
                  👑 VIP
                </span>
              )}
            </h2>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-semibold font-mono">
              Karya: {currentKitabData.author || 'Mufassir'}
            </p>
          </div>
        </div>

        {/* RIGHT AREA: CONTROLS ZOOM & INDIKATOR SIMPAN RIWAYAT (Revisi Poin 2, 3, 4) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* SIZE ZOOM INTERFACE */}
          <div className="flex bg-slate-100 hover:bg-slate-150 border border-slate-200 p-0.5 rounded-lg sm:rounded-xl items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 text-slate-600 hover:bg-white rounded-md sm:rounded-lg transition-all cursor-pointer"
              title="Perkecil Kata"
            >
              <ZoomOut className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
            <span className="text-[10px] sm:text-xs font-extrabold px-1 text-slate-700 font-mono w-4 sm:w-6 text-center select-none">
              {fontSize}
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 text-slate-600 hover:bg-white rounded-md sm:rounded-lg transition-all cursor-pointer"
              title="Perbesar Kata"
            >
              <ZoomIn className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>

          {/* ICON SIMPAN RIWAYAT BACA KITAB (Bookmark) */}
          <button
            onClick={handleToggleBookmark}
            className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isBookmarked 
                ? 'bg-emerald-850 hover:bg-emerald-955 text-white border-transparent shadow-3xs' 
                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
            }`}
            title="Simpan Riwayat Baca Kitab"
          >
            <Bookmark className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform active:scale-90 ${isBookmarked ? 'fill-current text-amber-300' : ''}`} />
            <span className="hidden sm:inline font-sans text-[10px] font-bold">
              {isBookmarked ? 'Ditandai' : 'Simpan Riwayat'}
            </span>
          </button>
        </div>
      </div>

      {/* ---------------- PAYWALL GATE (ACCESS CONTROL BLOCK) ---------------- */}
      {!hasAccess ? (
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-slate-50 select-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-yellow-250 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-md text-center max-w-sm w-full space-y-4 sm:space-y-5"
          >
            <div className="mx-auto h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-amber-50 border border-amber-250 flex items-center justify-center text-amber-505 shadow-inner">
              <Lock className="h-5 w-5 sm:h-7 sm:w-7 text-amber-600 shrink-0" />
            </div>

            <div className="space-y-1">
              <span className="text-[8px] sm:text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                Materi VIP Berbayar
              </span>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base font-sans tracking-wide">
                Akses Kitab Terkunci
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed font-sans mt-0.5">
                Kitab <strong>"{kitab.title}"</strong> merupakan materi keilmuan premium yang memerlukan keanggotaan berbayar aktif untuk dipelajari.
              </p>
            </div>

            <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200 text-[10px] sm:text-[11px] text-amber-900 leading-relaxed font-semibold text-left space-y-1 font-sans">
              <p className="font-bold flex items-center gap-1 text-amber-805 uppercase font-mono text-[8px] tracking-wider">
                <Sparkles className="h-2.5 w-2.5 inline" /> Hak Istimewa Member VIP:
              </p>
              <ul className="space-y-0.5 text-slate-650 font-normal text-[9px] sm:text-[10px]">
                <li>• Akses materi puluhan Kitab Kuning komplit.</li>
                <li>• Download lokal tak terbatas untuk belajar offline.</li>
                <li>• Bebas konsultasi chat tanyakan nahwu/sharaf.</li>
              </ul>
            </div>

            <div className="pt-1 flex flex-col gap-1.5">
              <button
                onClick={onTriggerUpgrade}
                className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Unlock className="h-3 w-3" /> Buka Akses Sekarang
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-slate-555 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Kembali ke Katalog
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        /* ------------------ READER IS ACTIVE & GRANTED ------------------ */
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* TOAST NOTIFIKASI BOOKMARK / SIMPAN RIWAYAT BACA */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-900 border border-emerald-700 text-emerald-100 text-[11px] sm:text-xs font-bold px-3 py-2 text-center shadow-lg flex items-center justify-center gap-1.5 select-none z-20 shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PAGE INNER CONTAINER & MEMORY OPTIMIZATION */}
          <div ref={readerScrollContainerRef} className="flex-1 overflow-y-auto bg-slate-50/70">
            
            {loadingContent ? (
              <div className="flex flex-col items-center justify-center p-10 py-24 text-center space-y-4 max-w-sm mx-auto h-full">
                <Loader2 className="h-10 w-10 text-emerald-800 animate-spin shrink-0" />
                <h4 className="font-extrabold text-slate-800 text-sm">Memuat Isi Teks Kitab...</h4>
                <p className="text-xs text-slate-450 leading-relaxed font-sans">
                  Harap tunggu sejenak, data teks sedang diambil dengan aman dari cloud server MUARA.
                </p>
              </div>
            ) : activeOffline && !loadedFromLocal ? (
              <div className="flex flex-col items-center justify-center p-10 py-20 text-center space-y-4 max-w-sm mx-auto">
                <WifiOff className="h-14 w-14 text-slate-350" />
                <h4 className="font-extrabold text-slate-700 text-sm">Kitab Belum Tersedia Offline</h4>
                <p className="text-xs text-slate-450 leading-relaxed font-sans">
                  "<strong>{kitab.title}</strong>" belum tersedia di penyimpanan lokal. Silakan matikan simulasi/terhubung ke internet agar modul **Silent Caching** mengunduh halaman ini otomatis di latar belakang.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setForceOfflineSimulation(false)}
                    className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-950 transition-colors cursor-pointer"
                  >
                    Beralih Ke Online
                  </button>
                </div>
              </div>
            ) : (
              /* SECURE CONTAINER WITH ANTI-COPY / SELECT-NONE PROTECTION (DISABLED FOR PREMIUM USERS) */
              <div 
                className={`max-w-3xl mx-auto p-4 sm:p-6 md:p-8 space-y-8 pb-28 ${isUserPremium ? 'select-text' : 'select-none'}`}
                style={isUserPremium ? { userSelect: 'text', WebkitUserSelect: 'text', msUserSelect: 'text' } : { userSelect: 'none', WebkitUserSelect: 'none', msUserSelect: 'none' }}
                onContextMenu={isUserPremium ? undefined : (e) => e.preventDefault()}
              >
                
                {/* 1. STRUCTURAL MOCK MODE (Amiri Arabic with indonesian breakdown) */}
                {isStructuredMock && Array.isArray(currentKitabData.chapters) && (
                  <div className="space-y-6">
                    {(() => {
                      const ch = currentKitabData.chapters[currentPageIdx];
                      if (!ch) return <div className="text-center text-xs text-slate-400 py-10">Halaman Bab tidak ditemukan</div>;
                      return (
                        <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden transition-all duration-305">
                          
                          <div className={`bg-[#064e3b]/5 px-4.5 py-3 border-b border-emerald-500/10 flex justify-between items-center ${isUserPremium ? 'select-text' : 'select-none'}`}>
                            <div>
                              <span className="text-[9px] sm:text-[10px] text-emerald-700 font-extrabold font-mono tracking-widest uppercase">
                                BAB {currentPageIdx + 1} DARI {totalPages}
                              </span>
                              <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm md:text-base mt-2">{ch.title}</h4>
                            </div>
                            {ch.arabicTitle && (
                              <span className="font-arabic text-base sm:text-lg md:text-xl text-emerald-800 max-w-[50%] pr-1 text-right">{ch.arabicTitle}</span>
                            )}
                          </div>

                          <div className="p-4 sm:p-6 md:p-8 space-y-8">
                            {ch.sections?.map((sec: any) => (
                              <div key={sec.id} className="space-y-4 border-b border-dashed border-slate-100 last:border-0 pb-6 last:pb-0">
                                
                                <h5 className="font-bold text-xs sm:text-sm text-emerald-800 flex items-center gap-1.5 selection:bg-none">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                  {sec.subTitle}
                                </h5>

                                {/* TEXT ARABIC GLYPH with dynamic font zoom inside anti-copy box */}
                                <div className={`bg-[#f0fdf4]/30 p-5 rounded-xl border border-emerald-500/10 shadow-3xs ${isUserPremium ? 'select-text' : 'select-none'}`}>
                                  <p 
                                    className="font-arabic text-right leading-loose tracking-wide font-normal text-[#0f3a26]"
                                    style={{ fontSize: `${fontSize + 6}px`, userSelect: isUserPremium ? 'text' : 'none' }}
                                  >
                                    {sec.arabicText}
                                  </p>
                                </div>
 
                                {/* Translations */}
                                <div className={`pl-4 border-l-2 border-emerald-600 space-y-1 ${isUserPremium ? 'select-text' : 'select-none'}`}>
                                  <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Terjemahan Indonesia</span>
                                  <p 
                                    className="leading-relaxed text-slate-700 italic font-sans"
                                    style={{ fontSize: `${fontSize}px` }}
                                  >
                                    "{sec.translatedText}"
                                  </p>
                                </div>
 
                                {/* Explanation Syarah */}
                                {sec.explanation && (
                                  <div className={`bg-slate-50 border border-slate-205 p-4.5 rounded-xl space-y-1.5 text-justify ${isUserPremium ? 'select-text' : 'select-none'}`}>
                                    <span className="text-[9px] uppercase font-bold text-slate-405 tracking-wider flex items-center gap-1">
                                      💡 Pensyarahan (Keterangan)
                                    </span>
                                    <p 
                                      className="leading-relaxed text-slate-600 font-sans"
                                      style={{ fontSize: `${fontSize - 1}px` }}
                                    >
                                      {sec.explanation}
                                    </p>
                                  </div>
                                )}

                              </div>
                            ))}
                          </div>

                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 2. FIRESTORE TEXT MODE (sourceType text body - LOADED PAGE BY PAGE) (Revisi Poin 1 & 2) */}
                {isFirestoreText && (
                  <div className={`bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 md:p-9 shadow-xs ${isUserPremium ? 'select-text' : 'select-none'}`}>
                    {(() => {
                      const pageContent = textPages[currentPageIdx] || '';
                      
                      const isArabicText = (text: string): boolean => {
                        return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
                      };

                      const dbDirection = currentKitabData?.direction || 'auto';
                      const computedDirection = dbDirection === 'auto' 
                        ? (isArabicText(pageContent) ? 'rtl' : 'ltr') 
                        : dbDirection;
                      const isRtl = computedDirection === 'rtl';

                      const dbTextAlign = currentKitabData?.textAlign || 'justify';
                      const alignClass = dbTextAlign === 'left' ? 'text-left' :
                                         dbTextAlign === 'center' ? 'text-center' :
                                         dbTextAlign === 'right' ? 'text-right' : 'text-justify';

                      const dbLineHeight = currentKitabData?.lineHeight || 'relaxed';
                      const leadingClass = dbLineHeight === 'normal' ? 'leading-normal' :
                                           dbLineHeight === 'relaxed' ? 'leading-relaxed' : 'leading-loose';

                      const familyClass = isRtl ? 'font-arabic tracking-wide' : 'font-serif';
                      
                      const isHtml = /<[a-z][\s\S]*>/i.test(pageContent);
                      
                      if (isHtml) {
                        return (
                          <div dir={computedDirection}>
                            <style dangerouslySetInnerHTML={{ __html: `
                              .word-content table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-top: 14px;
                                margin-bottom: 14px;
                                font-size: 0.9em;
                              }
                              .word-content th, .word-content td {
                                border: 1.5px solid #cbd5e1;
                                padding: 10px 14px;
                                text-align: ${isRtl ? 'right' : 'left'};
                                vertical-align: middle;
                              }
                              .word-content th {
                                background-color: #f8fafc;
                                font-weight: 700;
                                color: #1e293b;
                              }
                              .word-content tr:nth-child(even) {
                                background-color: #f8fafc/50;
                              }
                              .word-content p {
                                margin-bottom: 10px;
                                text-align: inherit;
                              }
                              .word-content h1, .word-content h2, .word-content h3, .word-content h4 {
                                font-weight: 800;
                                color: #0f172a;
                                margin-top: 20px;
                                margin-bottom: 10px;
                                line-height: 1.3;
                              }
                              .word-content h1 { font-size: 1.6em; }
                              .word-content h2 { font-size: 1.4em; }
                              .word-content h3 { font-size: 1.2em; }
                              .word-content h4 { font-size: 1.1em; }
                              .word-content ul, .word-content ol {
                                margin-left: 24px;
                                margin-bottom: 14px;
                                list-style-position: outside;
                              }
                              .word-content ul { list-style-type: disc; }
                              .word-content ol { list-style-type: decimal; }
                              .word-content li {
                                margin-bottom: 6px;
                              }
                              .word-content blockquote {
                                border-left: 4px solid #10b981;
                                padding-left: 16px;
                                margin: 16px 0;
                                color: #475569;
                                font-style: italic;
                              }
                              .word-content hr {
                                border: 0;
                                border-top: 2px solid #e2e8f0;
                                margin: 20px 0;
                              }
                            `}} />
                            <div 
                              className={`text-slate-800 ${alignClass} ${leadingClass} ${familyClass}`}
                              style={{ fontSize: `${fontSize}px` }}
                              dangerouslySetInnerHTML={{ __html: pageContent }}
                            />
                          </div>
                        );
                      }

                      return (
                        <div 
                          dir={computedDirection}
                          className={`text-slate-800 whitespace-pre-line ${alignClass} ${leadingClass} ${familyClass}`}
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {pageContent || 'Selesai membaca.'}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 3. FIRESTORE FILE PAGES MODE (PDF image converter - SINGLE IMAGE AT A TIME FOR ZERO RAM LAG) */}
                {isFirestorePages && (
                  <div className="space-y-6 select-none">
                    <div className="bg-slate-100/80 p-3 sm:p-4 rounded-xl text-slate-550 text-[9px] sm:text-[10px] leading-relaxed flex items-center gap-2 max-w-sm mx-auto">
                      <Info className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Teknologi Penyelamat RAM:</strong> Kitab ini disajikan per satu halaman tunggal. Halaman lama segera dihapus dari memori untuk mencegah aplikasi force-close di HP Anda.
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      {currentKitabData.pages && currentKitabData.pages.length > 0 ? (
                        (() => {
                          const pageUrl = currentKitabData.pages[currentPageIdx];
                          if (!pageUrl) return <div className="text-slate-450 font-mono text-center text-xs py-8">Halaman tidak ditemukan</div>;
                          return (
                            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-205 max-w-lg w-full relative group overflow-hidden transition-all duration-300">
                              {/* Watermark to avoid photo screenshot reuse (HIDDEN FOR PREMIUM SESSIONS AS PER USER REQUEST POIN 1) */}
                              {!isUserPremium && (
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-12 text-center pointer-events-none opacity-4 flex flex-col items-center select-none">
                                  <span className="font-extrabold text-lg sm:text-xl md:text-2xl text-slate-905 tracking-widest uppercase font-mono">MUARA JALUR VIP</span>
                                  <span className="font-mono text-[8px] sm:text-[9px] text-slate-800">{userProfile.email}</span>
                                </div>
                              )}
 
                              <img 
                                src={pageUrl} 
                                alt={`Halaman Kitab ${currentPageIdx + 1}`}
                                referrerPolicy="no-referrer"
                                onContextMenu={isUserPremium ? undefined : (e) => e.preventDefault()}
                                className={`w-full h-auto object-contain rounded-xl ${isUserPremium ? 'select-text' : 'select-none'}`}
                              />
                              
                              <div className="absolute top-4 left-4 bg-emerald-950/80 backdrop-blur-xs text-white text-[9px] font-mono px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                HALAMAN {currentPageIdx + 1}
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="p-10 text-center font-mono text-slate-400 text-xs">
                          <ImageIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          Berkas halaman visual belum dimasukkan oleh admin perpustakaan.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer safe margin */}
                <div className="py-2" />

              </div>
            )}

          </div>

                {/* ---------------- BAR NAVIGASI BAWAH (FLOATING PAGINATION CONTROL PANEL) (Revisi Poin 5) ---------------- */}
          {hasAccess && (!activeOffline || loadedFromLocal) && (
            <div className="bg-white border-t border-slate-200 shadow-md px-2 py-1.5 sm:px-4 sm:py-2 shrink-0 flex items-center justify-between select-none z-10">
              
              {/* TOMBOL HALAMAN SEBELUMNYA */}
              <button
                onClick={() => setCurrentPageIdx(prev => Math.max(0, prev - 1))}
                disabled={currentPageIdx === 0}
                className="flex items-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-slate-605" />
                <span className="hidden xs:inline font-sans">Sblm</span>
              </button>
 
              {/* INDIKATOR TENGAH & JUMP TO PAGE FORM */}
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="flex items-center bg-slate-50 rounded-lg sm:rounded-xl px-1.5 py-1 sm:px-2 sm:py-1 border border-slate-150">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 mr-1 uppercase font-mono tracking-wider">
                    Hal:
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPageIdx + 1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPageIdx(val - 1);
                      }
                    }}
                    className="w-7 sm:w-10 bg-white text-center font-bold text-[10px] sm:text-xs text-slate-800 border border-slate-250 rounded-md py-0.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                  <span className="font-extrabold text-[10px] sm:text-xs text-slate-450 ml-1 sm:ml-1.5 font-mono">
                    / {totalPages}
                  </span>
                </div>
 
                {/* SELECT JUMP DROPDOWN FOR EASY INDEX */}
                {totalPages > 1 && (
                  <select
                    value={currentPageIdx}
                    onChange={(e) => setCurrentPageIdx(parseInt(e.target.value, 10))}
                    className="bg-white border border-slate-200 hover:border-slate-350 px-1 py-1 rounded-lg font-bold text-[8px] sm:text-[10px] text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 max-w-[85px] sm:max-w-[160px] cursor-pointer"
                  >
                    {isStructuredMock && currentKitabData.chapters ? (
                      currentKitabData.chapters.map((ch: any, i: number) => (
                        <option key={i} value={i}>
                          B.{i + 1}: {ch.title.substring(0, 15)}...
                        </option>
                      ))
                    ) : (
                      Array.from({ length: totalPages }).map((_, i) => (
                        <option key={i} value={i}>
                          Lomp. Hal {i + 1}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>
 
              {/* TOMBOL HALAMAN SELANJUTNYA */}
              <button
                onClick={() => setCurrentPageIdx(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPageIdx === totalPages - 1}
                className="flex items-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1.5 bg-[#064e3b] hover:bg-[#022c22] text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <span className="hidden xs:inline font-sans">Lanjut</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
 
            </div>
          )}

        </div>
      )}

      {/* ----------------- MODAL DIALOG: ANDROID REVENUE & SECURITY GUIDE ----------------- */}
      <AnimatePresence>
        {showAndroidSecurityInfo && (
          <div className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-slate-900 text-slate-100 p-5 md:p-6 rounded-3xl max-w-lg w-full shadow-xl space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Smartphone className="h-4.5 w-4.5 text-emerald-500 animate-pulse" />
                    MainActivity.java Integration Module (Capacitor)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Panduan integrasi Capacitor Android Studio agar aplikasi memblokir screenshot/record HP</p>
                </div>
                <button
                  onClick={() => setShowAndroidSecurityInfo(false)}
                  className="p-1 px-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg font-bold text-xs cursor-pointer"
                >
                  X
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Untuk mengaktifkan pengamanan tingkat tinggi di HP Android (mencegah pembajakan teks dan perekaman layar oleh user), sisipkan baris pengaturan <code>FLAG_SECURE</code> berikut ke file Java proyek Capacitor Anda:
                </p>

                <div className="p-3 bg-black/50 border border-slate-850 rounded-xl overflow-x-auto text-[10px] font-mono leading-relaxed text-emerald-400">
                  <pre className="whitespace-pre">{mainActivityJavaCode}</pre>
                </div>

                <div className="p-3.5 bg-emerald-500/10 text-emerald-355 border border-emerald-500/20 rounded-xl text-[10px] leading-relaxed">
                  <strong>Bagaimana mekanisme ini bekerja?</strong> Begitu baris kode di atas dikompilasi oleh Gradle, sistem Android OS secara native akan memblokir setiap upayan menekan tombol Screenshot atau perekaman layar pihak ketiga. Di layar recording, aplikasi MUARA hanya akan nampak sebagai kotak hitam kosong.
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mainActivityJavaCode);
                    alert("Berhasil menyalin instruksi Java!");
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Salin Kode Java
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// Simple loader inline component
function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      className={`animate-spin ${className}`} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
