import { useState, useEffect } from 'react';
import { 
  Search, 
  BookOpen, 
  BookMarked, 
  Book, 
  MapPin, 
  Calendar, 
  User, 
  Volume2, 
  VolumeX, 
  Copy, 
  Share2, 
  ChevronRight, 
  ChevronDown,
  ArrowLeft,
  Feather,
  Sparkles,
  Award,
  Check,
  Lock,
  Loader2,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KitabKuning, QuranSurah, KamusTerm, HadisItem, UserProfile } from '../types';
import { MOCK_KITABS, MOCK_SURAHS, MOCK_KAMUS, MOCK_HADISES } from '../data/mockData';
import { firestore } from '../lib/firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';
import KitabReader from './KitabReader';

const getElegantMixBg = (id: string, index: number) => {
  const elegantBgs = [
    "bg-gradient-to-br from-emerald-50/50 via-teal-50/10 to-white/95 border-emerald-500/20 hover:border-emerald-500/40 shadow-xs",
    "bg-gradient-to-br from-amber-50/45 via-orange-50/10 to-white border-amber-500/20 hover:border-amber-500/40 shadow-xs",
    "bg-gradient-to-br from-slate-50 via-indigo-50/10 to-white/95 border-indigo-500/15 hover:border-indigo-500/40 shadow-xs",
    "bg-gradient-to-br from-teal-50/35 via-emerald-50/10 to-white border-teal-500/25 hover:border-teal-500/45 shadow-xs",
    "bg-gradient-to-br from-stone-50 via-cyan-50/10 to-white border-cyan-500/20 hover:border-cyan-500/40 shadow-xs"
  ];
  let hash = 0;
  if (id) {
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
  } else {
    hash = index;
  }
  const pos = Math.abs(hash) % elegantBgs.length;
  return elegantBgs[pos];
};

interface PencarianKategoriProps {
  userProfile: UserProfile;
  onOpenProfile: () => void;
  onOpenPrayerTimes: () => void;
}

export default function PencarianKategori({
  userProfile,
  onOpenProfile,
  onOpenPrayerTimes,
}: PencarianKategoriProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCustomCategory, setSelectedCustomCategory] = useState<any | null>(null);
  const [jenisFilter, setJenisFilter] = useState<'terjemah' | 'matan' | 'arab'>('terjemah');
  
  // Firestore dynamically added kitabs and categories state
  const [firestoreKitabs, setFirestoreKitabs] = useState<any[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<any[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  useEffect(() => {
    setLoadingCats(true);
    let isMounted = true;

    // 1. Listen to Categories collection in real-time
    const unsubscribeCats = onSnapshot(collection(firestore, 'categories'), (snapshot) => {
      const catList: any[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        let createdStr = '';
        if (data.createdAt) {
          if (typeof data.createdAt === 'string') {
            createdStr = data.createdAt;
          } else if (data.createdAt.toDate) {
            createdStr = data.createdAt.toDate().toISOString();
          }
        } else {
          createdStr = new Date().toISOString();
        }
        catList.push({
          id: d.id,
          name: data.name || '',
          imageUrl: data.imageUrl || '',
          createdAt: createdStr
        });
      });

      // Merge with custom categories stored in localStorage
      try {
        const localCatsStr = localStorage.getItem('muara_custom_categories');
        if (localCatsStr) {
          const localCats = JSON.parse(localCatsStr);
          const existingIds = new Set(catList.map(c => c.id));
          localCats.forEach((lc: any) => {
            if (!existingIds.has(lc.id)) {
              catList.push(lc);
            }
          });
        }
      } catch (localErr) {
        console.warn('Gagal memuat kategori lokal di user layout:', localErr);
      }

      // Sort custom categories by createdAt descending so newest is first
      catList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (isMounted) {
        setDynamicCategories(catList);
        setLoadingCats(false);
      }
    }, (err) => {
      console.warn('Gagal memuat kategori realtime dari Firestore:', err);
      let fallbackList: any[] = [];
      try {
        const localCatsStr = localStorage.getItem('muara_custom_categories');
        if (localCatsStr) {
          fallbackList = JSON.parse(localCatsStr);
        }
      } catch (e) {
        console.warn('Gagal loading local storage fallback:', e);
      }
      if (isMounted) {
        setDynamicCategories(fallbackList);
        setLoadingCats(false);
      }
    });

    // 2. Listen to Kitabs collection in real-time
    const unsubscribeKitabs = onSnapshot(collection(firestore, 'kitabs'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          title: data.title || '',
          arabicTitle: data.arabicTitle || '',
          category: data.category || '',
          author: data.author || '',
          description: data.sourceType === 'text'
            ? `${data.textBody?.substring(0, 115)}...`
            : `[Visual Halaman] Kitab komplit rujukan visual asli pesantren.`,
          difficulty: data.isPremium ? 'Tingkat Lanjut' : 'Menengah',
          isPremium: !!data.isPremium,
          sourceType: data.sourceType || 'text',
          pages: data.pages || [],
          textBody: data.textBody || '',
          coverUrl: data.coverUrl || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=300',
          jenisKitab: data.jenisKitab || 'terjemah',
          chapters: []
        });
      });

      // Merge with custom kitabs stored in localStorage
      try {
        const localKitabsStr = localStorage.getItem('muara_custom_kitabs');
        if (localKitabsStr) {
          const localKitabs = JSON.parse(localKitabsStr);
          const existingIds = new Set(list.map(k => k.id));
          localKitabs.forEach((lk: any) => {
            if (!existingIds.has(lk.id)) {
              list.push({
                id: lk.id,
                title: lk.title || '',
                arabicTitle: lk.arabicTitle || '',
                category: lk.category || '',
                author: lk.author || '',
                description: lk.sourceType === 'text'
                  ? `${lk.textBody?.substring(0, 115)}...`
                  : `[Visual Halaman] Kitab komplit rujukan visual asli pesantren.`,
                difficulty: lk.isPremium ? 'Tingkat Lanjut' : 'Menengah',
                isPremium: !!lk.isPremium,
                sourceType: lk.sourceType || 'text',
                pages: lk.pages || [],
                textBody: lk.textBody || '',
                coverUrl: lk.coverUrl || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=300',
                jenisKitab: lk.jenisKitab || 'terjemah',
                chapters: []
              });
            }
          });
        }
      } catch (localErr) {
        console.warn('Gagal memuat kitab lokal di user layout:', localErr);
      }

      if (isMounted) {
        setFirestoreKitabs(list);
      }
    }, (err) => {
      console.warn('Gagal memuat kitab realtime dari Firestore:', err);
      let fallbackList: any[] = [];
      try {
        const localKitabsStr = localStorage.getItem('muara_custom_kitabs');
        if (localKitabsStr) {
          fallbackList = JSON.parse(localKitabsStr);
        }
      } catch (e) {
        console.warn('Gagal loading local storage fallback:', e);
      }
      if (isMounted) {
        setFirestoreKitabs(fallbackList);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeCats();
      unsubscribeKitabs();
    };
  }, []);

  // Selection details state
  const [selectedKitab, setSelectedKitab] = useState<any | null>(null);
  const [selectedSurah, setSelectedSurah] = useState<QuranSurah | null>(null);

  useEffect(() => {
    const handleBackButton = (e: any) => {
      if (selectedKitab) {
        setSelectedKitab(null);
        e.detail?.consume?.();
      } else if (selectedSurah) {
        setSelectedSurah(null);
        e.detail?.consume?.();
      } else if (selectedCategory) {
        setSelectedCategory(null);
        e.detail?.consume?.();
      } else if (selectedCustomCategory) {
        setSelectedCustomCategory(null);
        e.detail?.consume?.();
      }
    };
    window.addEventListener('muara-hardware-back-button', handleBackButton);
    return () => {
      window.removeEventListener('muara-hardware-back-button', handleBackButton);
    };
  }, [selectedKitab, selectedSurah, selectedCategory, selectedCustomCategory]);

  // Audio state simulation for Quran
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioSurahNum, setAudioSurahNum] = useState<number | null>(null);
  const [audioSpeed, setAudioSpeed] = useState<'1x' | '1.25x' | '1.5x'>('1x');
  const [audioProgress, setAudioProgress] = useState(35);

  // General Actions state
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const triggerCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  // Merge and resolve premium status for mock kitabs and deduplicate by id
  const allKitabsCombined = (() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    MOCK_KITABS.forEach(k => {
      const item = {
        ...k,
        isPremium: k.id === 'kitab-1' || k.difficulty === 'Tingkat Lanjut',
        jenisKitab: (k as any).jenisKitab || 'terjemah'
      };
      if (item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push(item);
      }
    });

    firestoreKitabs.forEach(k => {
      const item = {
        ...k,
        jenisKitab: k.jenisKitab || 'terjemah'
      };
      if (item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push(item);
      }
    });

    return list;
  })();

  // Event subscriber to handle instant navigation requests from Santri AI
  useEffect(() => {
    const handleOpenKitabEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;
      const { kitabTitle, pageIdx } = customEvent.detail;
      
      const foundKitab = allKitabsCombined.find(k => 
        k.title.toLowerCase().includes(kitabTitle.toLowerCase()) || 
        kitabTitle.toLowerCase().includes(k.title.toLowerCase())
      );
      
      if (foundKitab) {
        setSelectedKitab({
          ...foundKitab,
          startWithPageIdx: pageIdx
        });
      } else {
        console.warn(`[Santri AI Navigation] Kitab "${kitabTitle}" tidak ditemukan di bibliografi lokal.`);
      }
    };

    window.addEventListener('muara-open-kitab', handleOpenKitabEvent);
    return () => window.removeEventListener('muara-open-kitab', handleOpenKitabEvent);
  }, [allKitabsCombined]);

  // Filtered queries across entire datasets
  const filteredKitabs = allKitabsCombined.filter(k => 
    k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSurahs = MOCK_SURAHS.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.englishNameTranslation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredKamus = MOCK_KAMUS.filter(t => 
    t.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.definition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHadis = MOCK_HADISES.filter(h => 
    h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.translatedText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasAnyResults = 
    filteredKitabs.length > 0 || 
    filteredSurahs.length > 0 || 
    filteredKamus.length > 0 || 
    filteredHadis.length > 0;

  const categories = [
    { id: 'surah', name: 'Daftar Surah', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100/70 border-emerald-100' },
    { id: 'tafsir', name: 'Tafsir Al Quran', icon: BookMarked, color: 'text-teal-600 bg-teal-50 hover:bg-teal-100/70 border-teal-100' },
    { id: 'kamus', name: 'Kamus Al Quran', icon: Book, color: 'text-sky-600 bg-sky-50 hover:bg-sky-100/70 border-sky-100' },
    { id: 'hadis', name: 'Hadis Pilihan', icon: Feather, color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 border-emerald-150' },
    { id: 'tematik', name: 'Index Tematik', icon: Sparkles, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100/70 border-indigo-150' },
    { id: 'jadwal', name: 'Jadwal Shalat', icon: MapPin, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100/70 border-amber-100' },
    { id: 'kalender', name: 'Kalender Hijriah', icon: Calendar, color: 'text-teal-650 bg-teal-50 hover:bg-teal-100/70 border-teal-150' },
    { id: 'akun', name: 'Akun', icon: User, color: 'text-slate-650 bg-slate-50 hover:bg-slate-100/70 border-slate-150' }
  ];

  const handleCategoryClick = (catId: string) => {
    if (catId === 'akun') {
      onOpenProfile();
    } else if (catId === 'jadwal') {
      onOpenPrayerTimes();
    } else {
      setSelectedCategory(catId);
    }
  };

  const simulateAudioPlay = (surahNum: number) => {
    if (audioSurahNum === surahNum) {
      setIsPlayingAudio(!isPlayingAudio);
    } else {
      setAudioSurahNum(surahNum);
      setIsPlayingAudio(true);
      setAudioProgress(10);
      const int = setInterval(() => {
        setAudioProgress(prev => {
          if (prev >= 100) {
            clearInterval(int);
            setIsPlayingAudio(false);
            return 100;
          }
          return prev + 5;
        });
      }, 1200);
    }
  };

  return (
    <div className="px-4 sm:px-6 pb-20">
      
      {/* ----------------- SEARCH BAR ----------------- */}
      <div id="search-container" className="mb-4 sm:mb-6 relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Cari kata terjemahan, latin, dan arab"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full placeholder-slate-450 rounded-2xl bg-slate-50 border border-slate-200 py-2.5 sm:py-3.5 pl-10 sm:pl-11 pr-4 text-slate-800 text-xs sm:text-sm focus:border-emerald-500 focus:bg-white focus:outline-hidden shadow-xs transition-all"
          />
          <Search className="absolute left-3.5 top-3 sm:top-3.5 h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-400" />
        </div>
      </div>

      {/* ----------------- VIEW 1: ACTIVE SEARCH OUTCOMES ----------------- */}
      {searchQuery && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="space-y-6"
        >
          <div className="flex justify-between items-center bg-slate-100/50 p-2.5 rounded-lg border border-slate-150">
            <span className="text-xs text-slate-450 font-bold uppercase tracking-wider">Hasil Pencarian Global</span>
            <button 
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-emerald-600 hover:underline"
            >
              Reset Cari
            </button>
          </div>

          {!hasAnyResults && (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-150 text-slate-400">
              <Search className="h-10 w-10 mx-auto opacity-30 label-indigo-500 mb-2" />
              <p className="text-xs">Materi "{searchQuery}" tidak ditemukan.</p>
              <p className="text-[10px] mt-1 text-slate-350">Silakan input suku kata fikh, hadis, atau tajwid alternatif.</p>
            </div>
          )}

          {/* Results: Kitab Kuning */}
          {filteredKitabs.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kumpulan Kitab Kuning ({filteredKitabs.length})</h3>
              <div className="grid grid-cols-1 gap-3">
                {filteredKitabs.map(kitab => (
                  <div 
                    key={kitab.id} 
                    onClick={() => {
                      setSelectedKitab(kitab);
                      setSearchQuery('');
                    }}
                    className="p-4 rounded-xl border border-slate-150 bg-white hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-slate-850 text-sm">{kitab.title}</h4>
                        {kitab.isPremium && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold shrink-0">
                            <Lock className="h-2.5 w-2.5" /> VIP
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{kitab.author}</p>
                      <p className="text-xs text-slate-550 mt-1 line-clamp-1">{kitab.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results: Surahs */}
          {filteredSurahs.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Surah Al-Quran ({filteredSurahs.length})</h3>
              <div className="grid grid-cols-1 gap-3">
                {filteredSurahs.map(surah => (
                  <div 
                    key={surah.number}
                    onClick={() => {
                      setSelectedSurah(surah);
                      setSelectedCategory('surah');
                      setSearchQuery('');
                    }}
                    className="p-4 rounded-xl border border-slate-150 bg-white hover:border-emerald-500 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-mono text-xs font-bold text-emerald-700">
                        {surah.number}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-850 text-sm">{surah.name}</h4>
                        <p className="text-[10px] text-slate-400">{surah.englishName} • {surah.numberOfAyahs} Ayat</p>
                      </div>
                    </div>
                    <span className="font-arabic text-lg text-emerald-700">{surah.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results: Kamus Terminology */}
          {filteredKamus.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Glossary Kamus Al-Quran ({filteredKamus.length})</h3>
              <div className="grid grid-cols-1 gap-3">
                {filteredKamus.map((term, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-150 bg-slate-50/50">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">{term.word}</span>
                      <span className="font-arabic text-sm text-slate-600">{term.arabic}</span>
                    </div>
                    <p className="text-xs text-slate-650 leading-relaxed">{term.definition}</p>
                    <div className="mt-2.5 border-t border-slate-200/60 pt-2 text-[11px] text-slate-450 italic">
                      Contoh: "{term.example}" → {term.exampleTranslation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ----------------- VIEW 2: CATEGORY GRID & PRIMARY SCREEN ----------------- */}
      {!searchQuery && !selectedCategory && !selectedCustomCategory && !selectedKitab && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 sm:space-y-8">
          
          {/* Section: Kategori Kitab Kuning (Dinamis dari Firestore) */}
          <div className="pt-2">
            <h2 className="text-xs sm:text-base font-extrabold text-[#064e3b] mb-3 sm:mb-4 tracking-wide flex items-center gap-1.5">
              <span className="h-3.5 sm:h-4.5 w-1 sm:w-1.5 bg-[#064e3b] rounded-full inline-block" />
              Kategori Kitab Kuning
            </h2>

            {loadingCats ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
              </div>
            ) : dynamicCategories.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-slate-400 space-y-2">
                <Tag className="h-7 w-7 text-emerald-600/35 mx-auto" />
                <p className="text-xs font-semibold text-slate-500">Kategori Kitab Belum Tersedia</p>
                <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Kategori dinamis akan otomatis tampil di sini saat admin menambahkannya di Dashboard Admin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:gap-4 justify-items-center">
                {dynamicCategories.map((cat) => (
                  <motion.button
                    key={cat.id}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedCustomCategory(cat)}
                    className="flex flex-col items-center justify-start text-center group cursor-pointer w-full font-sans"
                  >
                    <div className="relative flex items-center justify-center p-[1px] md:p-[1.5px] rounded-2xl overflow-hidden mb-2 shadow-xs transition-all ring-1 ring-slate-100 group-hover:ring-transparent h-[52px] w-[52px] sm:h-16 sm:w-16 aspect-square bg-white">
                      {/* Subtle elegant gradient background side-border */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/60 via-teal-400/70 to-amber-400/50" />
                      
                      {/* Inner image container */}
                      <div className="relative h-full w-full rounded-[14px] overflow-hidden bg-slate-50 z-10 flex items-center justify-center">
                        <img 
                          src={cat.imageUrl} 
                          alt={cat.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150';
                          }}
                        />
                        {/* Overlay with very soft shadow */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 pointer-events-none" />
                      </div>
                    </div>
                    
                    <span className="text-[10.5px] sm:text-[11px] font-extrabold text-slate-700 leading-tight tracking-tight min-h-[22px] px-0.5 transition-colors text-center group-hover:text-[#064e3b] line-clamp-2">
                      {cat.name}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

        </motion.div>
      )}

      {/* ----------------- SUB-VIEW: CUSTOM DYNAMIC CATEGORY BOOK SHELF ----------------- */}
      <AnimatePresence>
        {selectedCustomCategory && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0 }}
            className="space-y-4 max-w-5xl w-full mx-auto"
          >
            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-800 to-teal-900 p-2 rounded-2xl shadow-xs border border-emerald-700/20">
              <button 
                type="button"
                onClick={() => setSelectedCustomCategory(null)}
                className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-white bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 rounded-xl cursor-pointer transition-all shrink-0 uppercase tracking-wider"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali
              </button>

              {/* Luxury Styled Select Dropdown (Dropdown Mewah) */}
              <div className="relative shrink-0">
                <select
                  value={jenisFilter}
                  onChange={(e) => setJenisFilter(e.target.value as any)}
                  className="appearance-none font-sans font-black text-[10px] sm:text-xs tracking-widest uppercase bg-amber-500 hover:bg-amber-600 text-slate-900 border border-amber-300 shadow-xs pl-3 py-1.5 pr-7 rounded-xl cursor-pointer focus:outline-none transition-all duration-200"
                >
                  <option value="terjemah" className="text-slate-900 bg-white font-bold">📢 Terjemah</option>
                  <option value="matan" className="text-slate-900 bg-white font-bold">📖 Matan</option>
                  <option value="arab" className="text-slate-900 bg-white font-bold">🕌 Arab</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-900">
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-150">
              <div className="relative flex items-center justify-center p-[1px] rounded-xl overflow-hidden shrink-0 h-11 w-11 aspect-square bg-white shadow-xs">
                {/* Thin side gradient border */}
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/60 via-teal-400/70 to-amber-400/50" />
                <div className="relative h-full w-full rounded-[10px] overflow-hidden bg-slate-50 z-10">
                  <img 
                    src={selectedCustomCategory.imageUrl} 
                    alt={selectedCustomCategory.name} 
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150';
                    }}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-extrabold text-[#064e3b] truncate">Klasifikasi {selectedCustomCategory.name}</h2>
                <p className="text-[10px] text-slate-500 leading-tight">Pustaka salafiyah khas ({jenisFilter.toUpperCase()}) yang siap dibaca.</p>
              </div>
            </div>

            {/* List of kitabs matching this categories name or id and filtered by jenisKitab */}
            {(() => {
              const matchedKitabs = allKitabsCombined.filter(k => {
                const isCatMatch = k.category && (
                  k.category.toLowerCase().trim() === selectedCustomCategory.name.toLowerCase().trim() ||
                  k.category.toLowerCase().trim() === selectedCustomCategory.id.toLowerCase().trim()
                );
                const currentJenis = k.jenisKitab || 'terjemah';
                return isCatMatch && currentJenis === jenisFilter;
              });

              if (matchedKitabs.length === 0) {
                return (
                  <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 space-y-2 w-full">
                    <BookOpen className="h-8 w-8 text-emerald-600/35 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Pustaka "{jenisFilter.toUpperCase()}" Belum Tersedia</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Admin belum mendaftarkan kitab jenis <strong>{jenisFilter}</strong> di bawah kategori {selectedCustomCategory.name}.</p>
                  </div>
                );
              }

              return (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 mt-1">
                  {matchedKitabs.map((kitab, index) => (
                    <button
                      key={kitab.id}
                      onClick={() => setSelectedKitab(kitab)}
                      type="button"
                      className={`w-full p-2.5 sm:p-3.5 rounded-2xl border transition-all text-left relative flex items-center justify-between gap-2.5 sm:gap-4 shadow-3xs hover:-translate-y-0.5 duration-205 group cursor-pointer ${getElegantMixBg(kitab.id, index)}`}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                        {/* a. Gambar kitab - premium 3D book cover spine simulation */}
                        <div className="relative w-9 h-12 sm:w-11 sm:h-15 shrink-0 rounded-r-md rounded-l-xs overflow-hidden bg-white border-y border-r border-slate-200/90 shadow-[4px_4px_8px_rgba(0,0,0,0.12)] flex items-center justify-center pl-1 group-hover:shadow-[5px_5px_12px_rgba(0,0,0,0.18)] transition-all duration-300">
                          {/* Book spine line simulation */}
                          <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-r from-[#032e23]/35 to-transparent z-20 border-r border-[#032e23]/5" />
                          <div className="absolute top-0 bottom-0 left-1 w-[0.5px] bg-white/30 z-20" />

                          <img 
                            src={kitab.coverUrl} 
                            alt={kitab.title} 
                            className="w-full h-full object-cover transition-transform duration-550 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150';
                            }}
                          />
                          {/* Luxe shine effect */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                        </div>

                        {/* Text Info */}
                        <div className="min-w-0 flex-1">
                          {/* b. Nama kitab & Page Count Indicator */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-extrabold text-[#111827] text-[11px] sm:text-[12px] leading-tight line-clamp-1 group-hover:text-emerald-800 transition-colors">
                              {kitab.title}
                            </h4>
                            
                            {/* Physical Page Count bubble calculated dynamically for professional vibe */}
                            {(() => {
                              const pageCount = kitab.pages?.length || (kitab.textBody ? Math.ceil(kitab.textBody.length / 1500) : 1);
                              return (
                                <span className="inline-flex items-center gap-0.5 text-[7px] sm:text-[8px] font-mono font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200/60 shadow-5xs">
                                  📄 {pageCount} hal
                                </span>
                              );
                            })()}
                          </div>

                          {kitab.arabicTitle && (
                            <p className="font-arabic text-emerald-800 text-[10px] leading-none mt-1" dir="rtl">
                              {kitab.arabicTitle}
                            </p>
                          )}
                          
                          {/* c. Penulis & Format */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-[9px] text-slate-400 font-bold uppercase truncate tracking-wider max-w-[120px]">
                              Oleh: {kitab.author || 'Anonim'}
                            </p>
                            <span className="text-[8px] text-slate-350">•</span>
                            <span className="text-[8px] font-bold text-slate-450 uppercase tracking-widest bg-slate-100/60 px-1 rounded-sm border border-slate-150/50">
                              {kitab.jenisKitab || 'TERJEMAH'}
                            </span>
                          </div>

                          {/* d. Penanda Kitab Premium dan Gratis */}
                          <div className="mt-1.5">
                            {kitab.isPremium ? (
                              <span className="inline-flex items-center text-[7px] sm:text-[8px] font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-250 tracking-wider shadow-4xs">
                                💎 VIP Member
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[7px] sm:text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-150 tracking-wider shadow-4xs">
                                🆓 Gratis
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* e. Icon buka kitab */}
                      <div className="shrink-0 flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-emerald-700/5 group-hover:bg-emerald-700 text-emerald-700 group-hover:text-white border border-emerald-600/10 transition-all duration-300 shadow-4xs">
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 duration-200" />
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- VIEW 3: DETAIL SUB-CATEGORY VIEWERS ----------------- */}

      {/* CATEGORY: DAFTAR SURAH */}
      {selectedCategory === 'surah' && !selectedSurah && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <button 
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg mb-2"
          >
            <ArrowLeft className="h-4.5 w-4.5" /> Kembali Ke Menu
          </button>

          <h2 className="text-base font-extrabold text-slate-800">Daftar Surah Al-Quran</h2>

          <div className="grid grid-cols-1 gap-3">
            {MOCK_SURAHS.map(surah => (
              <div 
                key={surah.number}
                className="p-4 rounded-xl border border-slate-150 bg-white shadow-xs flex items-center justify-between"
              >
                <div 
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => setSelectedSurah(surah)}
                >
                  <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-mono text-xs font-bold text-emerald-700">
                    {surah.number}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-850 text-sm">{surah.name} (الْفَاتِحَة)</h4>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">{surah.englishNameTranslation} • {surah.numberOfAyahs} Ayat • {surah.revelationType}</p>
                  </div>
                </div>

                {/* Instant audio simulator */}
                <button
                  type="button"
                  onClick={() => simulateAudioPlay(surah.number)}
                  className={`p-2.5 rounded-full border transition-colors ${
                    audioSurahNum === surah.number && isPlayingAudio
                      ? 'bg-red-50 text-red-500 border-red-200 animate-pulse'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/50'
                  }`}
                  title="Putar Audio"
                >
                  {audioSurahNum === surah.number && isPlayingAudio ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Active audio controller strip */}
          {isPlayingAudio && audioSurahNum && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-4 p-4 rounded-2xl bg-slate-900 text-white shadow-xl flex flex-col gap-3"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">MEMUTAR AUDIO DAHSYAT</span>
                    <span className="text-xs font-bold font-sans">Surah {MOCK_SURAHS.find(s => s.number === audioSurahNum)?.name} - Murottal Syekh Mishary</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['1x', '1.25x', '1.5x'] as const).map(sp => (
                    <button
                      key={sp}
                      onClick={() => setAudioSpeed(sp)}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
                        audioSpeed === sp ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {sp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Slider */}
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-450">
                <span>01:14</span>
                <div className="h-1 flex-1 relative bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${audioProgress}%` }} />
                </div>
                <span>03:24</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* CATEGORY: TAFSIR AL QURAN */}
      {selectedCategory === 'tafsir' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 sm:space-y-4">
          <button 
            type="button"
            onClick={() => {
              setSelectedCategory(null);
              setSelectedSurah(null);
            }}
            className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali Ke Menu
          </button>

          <h2 className="text-sm sm:text-base font-extrabold text-slate-800">Tafsir Ringkas Al-Quran</h2>
          <p className="text-[11px] sm:text-xs text-slate-500">Pilih surah untuk menelaah tafsir lengkap per ayat dari mufassir Ahlussunnah wal Jama'ah.</p>

          {!selectedSurah ? (
            <div className="grid grid-cols-1 gap-2.5">
              {MOCK_SURAHS.map(surah => (
                <div 
                  key={surah.number}
                  onClick={() => setSelectedSurah(surah)}
                  className="p-3 sm:p-4 rounded-xl border border-slate-150 bg-white cursor-pointer hover:border-emerald-500 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-emerald-100/50 flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold text-emerald-700 shrink-0">
                      {surah.number}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-850 text-xs sm:text-sm">{surah.name}</h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-400">Tafsir Jalalain/Kemenag ({surah.numberOfAyahs} ayat)</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center border-b pb-2 sm:pb-3 border-slate-100">
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Surah {selectedSurah.name}</h3>
                <button onClick={() => setSelectedSurah(null)} className="text-[10px] sm:text-xs font-bold text-emerald-600 hover:underline">Ubah Surah</button>
              </div>

              <div className="space-y-3 sm:space-y-4 pt-2">
                {selectedSurah.verses.map(v => (
                  <div key={v.number} className="border-b border-dashed border-slate-100 pb-3 sm:pb-4 space-y-2.5 sm:space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-mono text-[9px] sm:text-[10px] font-bold text-emerald-700 shrink-0">{v.number}</span>
                      <p className="font-arabic text-lg sm:text-xl leading-relaxed text-right font-normal text-[#123e2b] max-w-[85%]">{v.text}</p>
                    </div>
                    <div className="pl-3 sm:pl-4 border-l-2 border-emerald-200 space-y-1">
                      <p className="text-[10px] sm:text-xs font-bold text-emerald-800">Tafsir:</p>
                      <p className="text-[11px] sm:text-xs text-slate-650 leading-relaxed font-sans">{v.tafsir}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* CATEGORY: KAMUS AL QURAN */}
      {selectedCategory === 'kamus' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 sm:space-y-4">
          <button 
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali Ke Menu
          </button>

          <h2 className="text-sm sm:text-base font-extrabold text-slate-800">Kamus Istilah Al-Quran</h2>
          <p className="text-[11px] sm:text-xs text-slate-500">Mempelajari makna mufradat kata kunci bahasa arab serta referensi ayatnya.</p>

          <div className="grid grid-cols-1 gap-3 mt-2">
            {MOCK_KAMUS.map((term, i) => (
              <div key={i} className="bg-white border rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border-slate-200">
                <div className="flex justify-between items-center mb-1.5 select-none">
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 sm:px-2.5 py-0.5 rounded-full">{term.word}</span>
                  <span className="font-arabic text-sm sm:text-base text-teal-700">{term.arabic}</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">{term.definition}</p>
                <div className="bg-slate-50/50 p-2 sm:p-2.5 rounded-xl border border-slate-100 mt-2 text-[10px] sm:text-[11px] text-slate-500 italic">
                  Referensi Ayat: "{term.example}" ➜ <span className="font-semibold text-emerald-700">{term.exampleTranslation}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* CATEGORY: HADIS PILIHAN */}
      {selectedCategory === 'hadis' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 sm:space-y-4">
          <button 
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali Ke Menu
          </button>

          <h2 className="text-sm sm:text-base font-extrabold text-slate-800">Hadis-hadis Tuntunan Akhlak</h2>

          <div className="space-y-3 sm:space-y-4">
            {MOCK_HADISES.map(hadis => (
              <div key={hadis.id} className="bg-white border rounded-xl sm:rounded-2xl p-4 sm:p-5 border-slate-200 space-y-2.5 sm:space-y-3">
                <div className="flex justify-between items-center border-b pb-1.5 sm:pb-2 border-slate-100">
                  <h4 className="font-bold text-slate-800 text-[11px] sm:text-xs">{hadis.title}</h4>
                  <span className="text-[9px] sm:text-[10px] text-emerald-600 font-semibold">{hadis.narrator}</span>
                </div>
                <p className="font-arabic text-base sm:text-lg text-right font-normal text-[#1a4a35] leading-relaxed">{hadis.arabicText}</p>
                <p className="text-[11px] sm:text-xs text-slate-650 leading-relaxed italic">" {hadis.translatedText} "</p>
                
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-150 text-[10px] sm:text-[11px] text-slate-500 space-y-1 leading-relaxed">
                  <span className="font-bold text-slate-700 block">Syarah Ringkas:</span>
                  {hadis.explanation}
                </div>

                {/* Util copy operations */}
                <div className="flex justify-end items-center gap-2 pt-1 border-t border-slate-100 select-none">
                  <button
                    onClick={() => triggerCopy(hadis.translatedText, hadis.id)}
                    className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md"
                  >
                    {copiedItem === hadis.id ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600" /> : <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                    {copiedItem === hadis.id ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* CATEGORY: INDEX TEMATIK */}
      {selectedCategory === 'tematik' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 sm:space-y-4">
          <button 
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali Ke Menu
          </button>

          <h2 className="text-sm sm:text-base font-extrabold text-slate-800">Index Tematik Kajian</h2>
          <p className="text-[11px] sm:text-xs text-slate-500">Materi kajian terstruktur memadukan ayat quran syarif & teks kitab kuning salafiyah.</p>

          <div className="space-y-2.5 sm:space-y-3">
            {[
              { theme: 'Akhlak kepada Orang Tua (Birrul Walidain)', ref: 'Mencakup QS. Al-Isra ayat 23 & Kitab Riyadhus Shalihin bab Adab.' },
              { theme: 'Adab Thaharah & Thariqah Wudhu', ref: 'Mencakup QS. Al-Maidah ayat 6 & Kitab Safinatun Najah Bab Syarat Wudhu.' },
              { theme: "Mengobati Penyakit Hati & Riya'", ref: 'Mencakup QS. Al-Baqarah ayat 264 & Kitab Al-Hikam Hikmah pertama.' },
              { theme: 'Kewajiban Shalat Berjamaah', ref: 'Mencakup QS. Al-Baqarah ayat 43 & Kitab Fathul Qorib Bab Jamaah.' }
            ].map((tem, idx) => (
              <div key={idx} className="p-3 sm:p-4 rounded-xl border border-slate-150 bg-white">
                <span className="text-[9px] sm:text-[10px] font-bold text-indigo-600 uppercase font-mono tracking-wider">TEMA {idx + 1}</span>
                <h4 className="font-bold text-slate-800 text-[11px] sm:text-xs mt-1">{tem.theme}</h4>
                <p className="text-[11px] sm:text-xs text-slate-550 mt-1 sm:mt-1.5 leading-relaxed bg-indigo-50/20 p-2 sm:p-2.5 rounded-lg border border-indigo-100/50">{tem.ref}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* CATEGORY: KALENDER HIJRIAH */}
      {selectedCategory === 'kalender' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 sm:space-y-4">
          <button 
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali Ke Menu
          </button>

          <h2 className="text-sm sm:text-base font-extrabold text-slate-800">Kalender Hijriah & Hari Besar</h2>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 text-center space-y-3 sm:space-y-4">
            <div className="bg-emerald-500/5 text-emerald-900 border border-emerald-100 p-2 sm:p-3 rounded-xl flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase tracking-wide">
              <span>◄ Muharram / Dzulhijjah</span>
              <span>Tahun Baru 1447 H / 2026 M</span>
              <span>►</span>
            </div>

            {/* Simulated mini hijri calendar block */}
            <div className="bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-150 text-slate-650 space-y-1.5 sm:space-y-2">
              <span className="font-bold text-[11px] sm:text-xs block text-left">Hari Besar Terdekat (Tahun 2026/1447H):</span>
              <ul className="text-left text-[11px] sm:text-xs divide-y divide-slate-100">
                <li className="py-2 flex justify-between items-center">
                  <span>Hari Arafah (9 Dzulhijjah 1447H)</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">Selasa, 26 Mei 2026</span>
                </li>
                <li className="py-2 flex justify-between items-center">
                  <span>Hari Raya Idul Adha (10 Dzulhijjah)</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">Rabu, 27 Mei 2026</span>
                </li>
                <li className="py-2 flex justify-between items-center">
                  <span>Tahun Baru Islam (1 Muharram 1448H)</span>
                  <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">Kamis, 16 Juni 2026</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}


      {/* ----------------- SEPARATE READER: KITAB KUNING VIEW - EXQUISITE ----------------- */}
      <AnimatePresence>
        {selectedKitab && (
          <KitabReader
            kitab={selectedKitab}
            userProfile={userProfile}
            initialPageIdx={selectedKitab.startWithPageIdx || 0}
            onClose={() => setSelectedKitab(null)}
            onTriggerUpgrade={() => {
              setSelectedKitab(null);
              onOpenProfile();
            }}
          />
        )}
      </AnimatePresence>

      {/* ----------------- SEPARATE READER: SURAH DETAILS VIEW ----------------- */}
      <AnimatePresence>
        {selectedSurah && selectedCategory === 'surah' && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed inset-0 z-45 bg-white overflow-y-auto pb-10"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between shadow-xs z-50">
              <button
                type="button"
                onClick={() => setSelectedSurah(null)}
                className="rounded-full p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200"
              >
                <ArrowLeft className="h-4 sm:h-5 w-4 sm:w-5" />
              </button>
              <h2 className="font-bold text-slate-800 text-xs sm:text-sm">Surah {selectedSurah.name}</h2>
              <span className="font-arabic text-sm sm:text-base pr-2 text-emerald-700">{selectedSurah.name}</span>
            </div>

            {/* Verses Container */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              
              {/* Bismillah banner */}
              <div className="p-3 sm:p-4 rounded-xl text-center bg-slate-50 border border-slate-150 relative">
                <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-mono block mb-1">BASMALAH PEMBUKA</span>
                <p className="font-arabic text-base sm:text-lg text-emerald-800">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
              </div>

              {/* Verses loop */}
              <div className="space-y-4 sm:space-y-6">
                {selectedSurah.verses.map((v) => (
                  <div key={v.number} className="border-b border-dashed border-slate-100 pb-3.5 sm:pb-5 space-y-2.5 sm:space-y-3">
                    <div className="flex justify-between items-start gap-3 sm:gap-4">
                      {/* Ayat counter number badge */}
                      <span className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold text-emerald-700 shrink-0">
                        {v.number}
                      </span>
                      {/* Arabic glyph */}
                      <p className="font-arabic text-lg sm:text-xl leading-loose text-right font-normal text-[#123e2b] max-w-[85%] select-all">
                        {v.text}
                      </p>
                    </div>

                    {/* Translation detail */}
                    <div className="pl-3 sm:pl-4 border-l border-emerald-300">
                      <p className="text-[9px] sm:text-[10px] text-slate-410 font-bold uppercase tracking-wider mb-1">Terjemahan</p>
                      <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed italic">{v.translation}</p>
                    </div>

                    {/* Tafsir box */}
                    <div className="bg-slate-50/50 p-2.5 sm:p-3.5 rounded-xl border border-slate-150">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wide">Tafsir Ringkas</span>
                      <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">{v.tafsir}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
