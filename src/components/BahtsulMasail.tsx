import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  Send, 
  X, 
  Plus, 
  BookOpen, 
  Lock, 
  Crown, 
  User, 
  ChevronRight, 
  ChevronDown,
  Pin,
  AlertCircle,
  Clock,
  Heart,
  Share2,
  CornerDownRight,
  Sparkles,
  Users,
  MessageCircle,
  FileText,
  Bookmark,
  Edit,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  getDoc,
  onSnapshot, 
  query, 
  orderBy, 
  setDoc,
  getDocs,
  arrayUnion,
  arrayRemove,
  increment
} from '../lib/customfirestore';
import { firestore } from '../lib/firebaseConfig';
import { indexedDbService } from '../lib/indexedDbService';
import { MOCK_KITABS } from '../data/mockData';
import KitabReader from './KitabReader';
import BahtsulMasailMyPosts from './BahtsulMasailMyPosts';

// Helper to derive API URL for Capacitor or Web
const getApiUrl = (path: string): string => {
  const isCapacitor = typeof window !== 'undefined' && (
    !!(window as any).Capacitor || 
    window.location.protocol === 'capacitor:'
  );
  
  if (isCapacitor) {
    const cachedUrl = localStorage.getItem('muara_api_server_url');
    const fallbackUrl = 'https://ais-pre-5nryvql223g2kompd5rosg-139765732384.asia-southeast1.run.app';
    return `${cachedUrl || fallbackUrl}${path}`;
  }
  return path;
};

interface BahtsulMasailProps {
  userProfile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onOpenUpgradeModal: () => void;
  initialActiveProblemId?: string;
  initialActiveProblemType?: string;
  initialCommentId?: string;
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
  likedBy: string[]; // List of user IDs who liked
  commentsCount: number;
  createdAt: string;
  pinned?: boolean;
  pinnedUntil?: string | null;
  aiAutoReplied?: boolean;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userBio: string;
  text: string;
  createdAt: string;
  parentId: string | null; // For nested replies
  replyToName?: string; // e.g., "@Ahmad"
}

// 1. Error Handling Wrapper conform to Firestore integration skill
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, 
      email: null,
      emailVerified: null
    },
    operationType,
    path
  };
  console.error('Firestore Error Bahtsul Masail: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function BahtsulMasail({ 
  userProfile, 
  isOpen, 
  onClose, 
  onOpenUpgradeModal, 
  initialActiveProblemId,
  initialActiveProblemType,
  initialCommentId
}: BahtsulMasailProps) {
  const [problems, setProblems] = useState<MasailProblem[]>([]);
  const [activeProblemId, setActiveProblemId] = useState<string | null>(initialActiveProblemId || null);

  useEffect(() => {
    if (initialActiveProblemId) {
      setActiveProblemId(initialActiveProblemId);
    }
  }, [initialActiveProblemId]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [dynamicKitabs, setDynamicKitabs] = useState<any[]>([]);

  // Load dynamic list of kitabs from both MOCK_KITABS, firestore 'kitabs' collection, and localStorage 'muara_custom_kitabs'
  useEffect(() => {
    if (!isOpen) return;

    const loadAllKitabs = async () => {
      let list: any[] = [];
      
      // 1. Load mock kitabs
      const mockList = MOCK_KITABS.map(k => ({
        ...k,
        id: k.id,
        title: k.title,
        arabicTitle: k.arabicTitle || '',
        category: k.category || '',
        author: k.author || '',
        isPremium: k.id === 'kitab-1' || k.difficulty === 'Tingkat Lanjut',
        jenisKitab: (k as any).jenisKitab || 'terjemah',
        pages: (k as any).pages || [],
        chapters: (k as any).chapters || []
      }));
      list = [...mockList];

      // 2. Load Firestore kitabs
      try {
        const snap = await getDocs(collection(firestore, 'kitabs'));
        const existingIds = new Set(list.map(k => k.id));
        snap.forEach(d => {
          if (!existingIds.has(d.id)) {
            const data = d.data();
            list.push({
              id: d.id,
              title: data.title || '',
              arabicTitle: data.arabicTitle || '',
              category: data.category || '',
              author: data.author || '',
              isPremium: !!data.isPremium,
              sourceType: data.sourceType || 'text',
              pages: data.pages || [],
              textBody: data.textBody || '',
              coverUrl: data.coverUrl || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=300',
              jenisKitab: data.jenisKitab || 'terjemah',
              chapters: []
            });
          }
        });
      } catch (err) {
        console.warn('Firestore kitabs load bypass in BahtsulMasail:', err);
      }

      // Try merging offline-cached heavy kitabs from IndexedDB
      try {
        const offlineKitabs = await indexedDbService.getAllKitabs();
        if (offlineKitabs && offlineKitabs.length > 0) {
          list = list.map(item => {
            const offlineMatch = offlineKitabs.find((ok: any) => ok.id === item.id);
            if (offlineMatch) {
              return {
                ...item,
                pages: offlineMatch.pages || [],
                textBody: offlineMatch.textBody || ''
              };
            }
            return item;
          });
        }
      } catch (offlineErr) {
        console.warn('Gagal memuat offline kitabs untuk RAG:', offlineErr);
      }

      // 3. Merge with custom kitabs stored in localStorage
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
        console.warn('Local storage custom kitabs load fail:', localErr);
      }

      // Ensure that any dynamic kitab fetched from Firestore has its full content resolved if it is missing
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item.textBody && (!item.pages || item.pages.length === 0)) {
          try {
            console.log(`[Bahtsul Masail Dynamic Loader] Mengunduh konten teks lengkap secara langsung untuk RAG: ${item.title}...`);
            const contentSnap = await getDoc(doc(firestore, 'kitab_contents', item.id));
            if (contentSnap.exists()) {
              const cData = contentSnap.data();
              if (cData.isSegmented) {
                const chunkCount = cData.chunkCount || 0;
                const chunkPromises = [];
                for (let c = 0; c < chunkCount; c++) {
                  chunkPromises.push(getDoc(doc(firestore, 'kitab_contents', `${item.id}_chunk_${c}`)));
                }
                const chunkSnaps = await Promise.all(chunkPromises);
                let finalPages: string[] = [];
                for (const chunkSnap of chunkSnaps) {
                  if (chunkSnap.exists()) {
                    finalPages = finalPages.concat(chunkSnap.data().pages || []);
                  }
                }
                list[i].pages = finalPages;
                list[i].textBody = finalPages.join('\n\n');
              } else {
                list[i].pages = cData.pages || [];
                list[i].textBody = cData.textBody || '';
              }
            }
          } catch (fetchContentErr) {
            console.warn(`[Bahtsul Masail Dynamic Loader] Gagal mengunduh teks kitab "${item.title}":`, fetchContentErr);
          }
        }
      }

      setDynamicKitabs(list);
    };

    loadAllKitabs();
  }, [isOpen]);

  const getKitabTitles = () => {
    if (dynamicKitabs.length > 0) {
      return dynamicKitabs.map(k => k.title);
    }
    // Fallback if dynamic list is still loading
    return MOCK_KITABS.map(k => k.title);
  };
  
  // Custom Web Sub-View State
  const [currentSubView, setCurrentSubView] = useState<'feed' | 'my-posts'>('feed');
  const [editingProblem, setEditingProblem] = useState<MasailProblem | null>(null);
  const [deletingProblemId, setDeletingProblemId] = useState<string | null>(null);
  const [selectedReferencedKitab, setSelectedReferencedKitab] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Autocomplete / suggestions states
  const [referenceSuggestions, setReferenceSuggestions] = useState<string[]>([]);
  const [showRefSuggestions, setShowRefSuggestions] = useState(false);
  const [editRefSuggestions, setEditRefSuggestions] = useState<string[]>([]);
  const [showEditRefSuggestions, setShowEditRefSuggestions] = useState(false);

  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);

  // Reference tracker to prevent duplicate concurrent Santri AI triggers
  const triggeringRef = useRef<Set<string>>(new Set());

  // Bahtsul Masail settings & pagination state
  const [bmSettings, setBmSettings] = useState<{
    postsLimit: number;
    maxLifetimeHours: number;
    enableSantriAI: boolean;
    santriAIDelayMinutes: number;
  }>({
    postsLimit: 5,
    maxLifetimeHours: 0,
    enableSantriAI: true,
    santriAIDelayMinutes: 15
  });
  const [itemsToShow, setItemsToShow] = useState(5);

  // Helper trigger to write notifications to notifications_logs in Firebase & LocalStorage
  const sendAutomaticNotification = async (targetUserId: string, title: string, content: string, targetUserEmail: string = '', problemId: string = '') => {
    if (!targetUserId) return;
    
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const payload = {
      id: notifId,
      title: title,
      content: content,
      dateSent: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      important: false,
      target: 'single',
      targetUserId: targetUserId,
      targetUserEmail: targetUserEmail,
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150',
      category: 'bahtsul_masail',
      problemId: problemId
    };

    // 1. Save to local storage cache for local broadcast (realtime instant feedback)
    try {
      const cachedNotifsStr = localStorage.getItem('muara_notifications_cache');
      const cachedNotifs = cachedNotifsStr ? JSON.parse(cachedNotifsStr) : [];
      if (!cachedNotifs.some((n: any) => n.id === payload.id)) {
        cachedNotifs.unshift(payload);
        localStorage.setItem('muara_notifications_cache', JSON.stringify(cachedNotifs));
      }
      window.dispatchEvent(new CustomEvent('muara-new-notification', { detail: payload }));
      localStorage.setItem('muara_notifications_trigger', Date.now().toString());
    } catch (cacheErr) {
      console.warn("Gagal menyimpan ke local cache:", cacheErr);
    }

    // 2. Save directly to Firestore for global realtime updates
    try {
      const notifDocRef = doc(firestore, 'notifications_logs', notifId);
      await setDoc(notifDocRef, payload);
    } catch (firestoreErr) {
      console.warn("Firestore notification save failed:", firestoreErr);
    }
  };

  // Load Bahtsul Masail settings (Firestore + LocalStorage fallback)
  useEffect(() => {
    if (!isOpen) return;

    const ref = doc(firestore, 'settings', 'bahtsul_masail');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const postsLimit = Number(d.postsLimit) || 5;
        const maxLifetimeHours = Number(d.maxLifetimeHours) || 0;
        const enableSantriAI = d.enableSantriAI !== undefined ? !!d.enableSantriAI : true;
        const santriAIDelayMinutes = d.santriAIDelayMinutes !== undefined ? Number(d.santriAIDelayMinutes) : 15;
        setBmSettings({ postsLimit, maxLifetimeHours, enableSantriAI, santriAIDelayMinutes });
        setItemsToShow(postsLimit);
      } else {
        // Fallback local storage
        const local = localStorage.getItem('muara_bahtsul_settings');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            setBmSettings({
              postsLimit: parsed.postsLimit || 5,
              maxLifetimeHours: parsed.maxLifetimeHours || 0,
              enableSantriAI: parsed.enableSantriAI !== undefined ? !!parsed.enableSantriAI : true,
              santriAIDelayMinutes: parsed.santriAIDelayMinutes !== undefined ? Number(parsed.santriAIDelayMinutes) : 15
            });
            setItemsToShow(parsed.postsLimit || 5);
          } catch (e) {
            console.error(e);
          }
        }
      }
    }, (err) => {
      console.warn("Firestore settings bypass in BahtsulMasail user:", err);
      const local = localStorage.getItem('muara_bahtsul_settings');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setBmSettings({
            postsLimit: parsed.postsLimit || 5,
            maxLifetimeHours: parsed.maxLifetimeHours || 0,
            enableSantriAI: parsed.enableSantriAI !== undefined ? !!parsed.enableSantriAI : true,
            santriAIDelayMinutes: parsed.santriAIDelayMinutes !== undefined ? Number(parsed.santriAIDelayMinutes) : 15
          });
          setItemsToShow(parsed.postsLimit || 5);
        } catch (e) {
          console.error(e);
        }
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Show customized floating toast helper
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Modals / Creators states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{
    name: string;
    avatar: string;
    bio: string;
    isPremium: boolean;
  } | null>(null);

  // Floating Actions & Filters
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filterMyProblemsOnly, setFilterMyProblemsOnly] = useState(false);

  // Form Fields
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newReference, setNewReference] = useState('');

  // Comment Field
  const [commentText, setCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState<Comment | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const isPremiumUser = userProfile.isLoggedIn && (
    userProfile.membershipStatus === 'Premium Verified' || 
    (userProfile as any).isPremium === true ||
    userProfile.role === 'admin'
  );

  // 2. Realtime listener for Bahtsul Masail problems
  useEffect(() => {
    if (!isOpen || !isPremiumUser) return;

    const q = query(
      collection(firestore, 'bahtsul_masail'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MasailProblem[] = [];
      const expiredDocs: string[] = [];
      const nowMs = Date.now();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdStr = data.createdAt || new Date().toISOString();
        
        // Expiration check
        if (bmSettings.maxLifetimeHours > 0) {
          const ageHours = (nowMs - new Date(createdStr).getTime()) / (1000 * 3600);
          if (ageHours > bmSettings.maxLifetimeHours) {
            expiredDocs.push(docSnap.id);
            return; // skip parsing this item
          }
        }

        const isStillPinned = !!data.pinned && (!data.pinnedUntil || new Date(data.pinnedUntil).getTime() > nowMs);

        // Auto cleanse expired pinned on client read
        if (!!data.pinned && data.pinnedUntil && new Date(data.pinnedUntil).getTime() < nowMs) {
          updateDoc(doc(firestore, 'bahtsul_masail', docSnap.id), {
            pinned: false,
            pinnedUntil: null
          }).catch((err) => {});
        }

        list.push({
          id: docSnap.id,
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
          createdAt: createdStr,
          pinned: isStillPinned,
          pinnedUntil: data.pinnedUntil || null,
          aiAutoReplied: !!data.aiAutoReplied,
        });
      });

      // Background Prune Expired Posts to keep Firestore lightweight and lightning fast!
      if (expiredDocs.length > 0) {
        expiredDocs.forEach((id) => {
          deleteDoc(doc(firestore, 'bahtsul_masail', id)).catch((err) => {
            console.warn("Background cleanup of expired post failed:", id, err);
          });
        });
      }

      // Sort: pinned first, then createdAt desc
      const sorted = list.sort((a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setProblems(sorted);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(sorted));
    }, (error) => {
      console.warn("Realtime bahtsul_masail sync offline/bypassed:", error);
      // Fallback local storage mock problems
      try {
        const cached = localStorage.getItem('muara_bahtsul_cache');
        const nowMs = Date.now();
        if (cached) {
          const list: MasailProblem[] = JSON.parse(cached);
          // Apply client filtering here too
          const filtered = list.filter(p => {
            if (bmSettings.maxLifetimeHours > 0) {
              const ageHours = (nowMs - new Date(p.createdAt).getTime()) / (1000 * 3650);
              return ageHours <= bmSettings.maxLifetimeHours;
            }
            return true;
          });

          const sorted = filtered.sort((a, b) => {
            const pinA = a.pinned ? 1 : 0;
            const pinB = b.pinned ? 1 : 0;
            if (pinA !== pinB) return pinB - pinA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          setProblems(sorted);
        } else {
          // Default mock data to start with (since they are static, some might be "expired" if we don't watch it, but let's keep them)
          const defaultMocks: MasailProblem[] = [
            {
              id: 'sample-1',
              userId: 'user-admin',
              userName: 'Lajnah Bahtsul Masail LBM',
              userAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=150',
              userBio: 'Lembaga Bahtsul Masail Pusat Pendidikan Islam MUARA Syafiiyah',
              title: 'Hukum Investasi Cryptocurrency & Token Digital Terkini',
              content: 'Bagaimanakah hukum keabsahan kepemilikan aset kripto (cryptocurrency) di dalam timbangan fiqh muamalah madzhab asy-Syafi\'i? Mengingat potensi gharar yang dituduhkan serta posisi fisikal aset digital yang tidak memiliki wujud nyata (qabdhu lathifi). Mohon argumentasi mufashal beserta ta\'lil kitab salafi.',
              referenceKitab: 'Tuhfatul Muhtaj (Syarah Minhaj) Juz 4, Al-Fatawa Al-Kubra Al-Fiqhiyyah',
              likesCount: 12,
              likedBy: [],
              commentsCount: 2,
              createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
              pinned: true
            },
            {
              id: 'sample-2',
              userId: 'user-vip',
              userName: 'Kiai Shalahuddin Syarif',
              userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150',
              userBio: 'Khadimul Ma\'had Pondok Pesantren Giri Kediri • Senior VIP',
              title: 'Batasan Kebolehan Donor Organ Tubuh dalam Keadaan Koma',
              content: 'Kemajuan medis melahirkan opsi transplantasi donor kornea mata atau organ vital lainnya. Bagaimana keabsahan wasiat donor dari seseorang yang sedang dalam kondisi mati otak menurut syariat islam (hifdzan nafs)? Apakah murni dilarang keras karena merusak kehormatan jasat mukmin (kasri \'adzmihil mayyiti), atau ada rukhsah hajat maslahah?',
              referenceKitab: 'Nihayatul Muhtaj Juz 8, Bughyatul Mustarsyidin, I\'anatut Thalibin',
              likesCount: 8,
              likedBy: [],
              commentsCount: 0,
              createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
              pinned: false
            }
          ];
          setProblems(defaultMocks);
          localStorage.setItem('muara_bahtsul_cache', JSON.stringify(defaultMocks));
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => unsubscribe();
  }, [isOpen, isPremiumUser, bmSettings]);

  // Automated background check: Trigger Santri AI auto-responder for postings unanswered for >= admin delay minutes
  useEffect(() => {
    if (!isOpen || !bmSettings.enableSantriAI) return;

    const runBackgroundCheck = async () => {
      const nowMs = Date.now();
      const delayMin = bmSettings.santriAIDelayMinutes || 15;
      const unreplied = problems.filter(prob => {
        const ageMs = nowMs - new Date(prob.createdAt).getTime();
        const ageMin = ageMs / (1000 * 60);
        // Is it unanswered, older than configured minutes, and Santri AI hasn't replied to it yet?
        return ageMin >= delayMin && prob.commentsCount === 0 && !prob.aiAutoReplied;
      });

      if (unreplied.length === 0) return;

      for (const prob of unreplied) {
        if (triggeringRef.current.has(prob.id)) continue;
        triggeringRef.current.add(prob.id);

        try {
          console.log(`[MUARA background trigger check] Pertanyaan "${prob.title}" belum ada jawaban selama 30 menit. Santri AI merespon...`);
          
          const latestKitabTitles = getKitabTitles();
          const combinedPrompt = `Pemberitahuan: Di dalam kolom Musyawarah Bahtsul Masail, terdapat satu pertanyaan baru yang belum mendapatkan tanggapan dari asatidz atau anggota selama lebih dari 30 menit. Berikan jawaban awal ilmiah yang bermutu tinggi, ramah, dan menyejukkan sebagai asisten Santri AI.

Pertanyaan Pengguna:
Judul: "${prob.title}"
Deskripsi/Isi Pertanyaan: "${prob.content}"
Kitab Rujukan yang Ditanyakan: "${prob.referenceKitab || 'Tidak ada spesifik'}"

TATA TERTIB JAWABAN:
1. Berikan jawaban yang sejuk, ilmiah, terperinci dan berwibawa khas Santri AI.
2. Jelaskan permasalahan ini berdasarkan sudut pandang kitab-kitab salafiyah (kitab kuning) yang ada di aplikasi MUARA.
3. Pastikan Anda menyebutkan nama kitab khazanah klasik sebagai sandaran rujukan secara eksplisit dalam teks jawaban Anda, dengan cara WAJIB menggunakan awalan @ diikuti nama kitabnya (contoh: @Safinatun Najah, @Al-Hikam, @Riyadhus Shalihin, @Fathul Mu'in, @Nashaihul Ibad, @Arbain Nawawi, @Tafsir Jalalain) agar sistem aplikasi kami bisa otomatis membidani link pembukaan kitab tersebut bagi pembaca. Jangan gunakan tanda kurung, bintangi, atau titik setelah tanda @. Contoh: "...hal ini dijelaskan dalam kitab @Safinatun Najah pada bab..." sehingga kata @Safinatun Najah berdiri utuh dan persis sama dengan judul aslinya.`;

          // Request with retry and support for Capacitor server url
          let response: Response | null = null;
          const targetUrl = getApiUrl('/api/gemini/santri-ai');
          const MAX_RETRIES = 3;
          const RETRY_DELAY_MS = 1500;

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              console.log(`[Bahtsul Masail Bot Fetch] Menghubungi ${targetUrl} (Percobaan ${attempt}/${MAX_RETRIES})...`);
              response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  prompt: combinedPrompt,
                  latestKitabTitles: latestKitabTitles
                })
              });
              
              if (response.status === 503 && attempt < MAX_RETRIES) {
                console.warn(`[Bahtsul Masail Bot Fetch] Mendapatkan 503, mencoba lagi dalam ${RETRY_DELAY_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                continue;
              }
              
              break;
            } catch (err: any) {
              console.warn(`[Bahtsul Masail Bot Fetch] Percobaan ${attempt}/${MAX_RETRIES} gagal:`, err);
              if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
              }
            }
          }

          if (!response || !response.ok) {
            throw new Error(`API returned non-ok status or empty response`);
          }

          const resData = await response.json();
          const responseText = resData.reply || resData.text || '';
          
          if (!responseText) {
            throw new Error(`API returned empty reply`);
          }

          // Save comment to Firestore
          const commentPayload = {
            userId: 'santri-ai-bot',
            userName: 'Santri AI (Mutasyawir)',
            userAvatar: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?auto=format&fit=crop&q=80&w=150',
            userBio: 'Khadimul Ilmi Digital & Ahli Kitab MUARA',
            text: responseText,
            createdAt: new Date().toISOString(),
            parentId: null,
            replyToName: null
          };

          // 1. Write comment
          const commentRef = await addDoc(collection(firestore, 'bahtsul_masail', prob.id, 'comments'), commentPayload);
          
          // 2. Mark auto replied
          const probRef = doc(firestore, 'bahtsul_masail', prob.id);
          await updateDoc(probRef, {
            commentsCount: increment(1),
            aiAutoReplied: true
          });

          // 3. Send automatic notification to post owner
          if (prob.userId) {
            sendAutomaticNotification(
              prob.userId,
              "Jawaban Santri AI",
              `Santri AI (Mutasyawir) mengomentari status Anda`,
              '',
              prob.id
            );
          }

          console.log(`[MUARA background trigger check] Auto-reply sukses terposting untuk "${prob.title}" dengan comment ID:`, commentRef.id);
          
        } catch (err) {
          console.error("Gagal melakukan auto-reply Santri AI:", err);
          // Remove from triggering set to allow retry
          triggeringRef.current.delete(prob.id);
        }
      }
    };

    // Run check immediately on load
    runBackgroundCheck();

    // Check periodically every 15 seconds
    const timer = setInterval(() => {
      runBackgroundCheck();
    }, 15000);

    return () => clearInterval(timer);
  }, [isOpen, problems, bmSettings.enableSantriAI]);

  // 3. Realtime listener for active problem's comments
  useEffect(() => {
    if (!activeProblemId) {
      setComments([]);
      return;
    }

    const colRef = collection(firestore, 'bahtsul_masail', activeProblemId, 'comments');
    const q = query(colRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Comment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId || '',
          userName: data.userName || '',
          userAvatar: data.userAvatar || '',
          userBio: data.userBio || '',
          text: data.text || '',
          createdAt: data.createdAt || new Date().toISOString(),
          parentId: data.parentId || null,
          replyToName: data.replyToName || undefined,
        });
      });
      setComments(list);
    }, (error) => {
      console.warn("Comments fallback trigger:", error);
      // Local recovery
      try {
        const cachedCommentsStr = localStorage.getItem(`comments_${activeProblemId}`);
        if (cachedCommentsStr) {
          setComments(JSON.parse(cachedCommentsStr));
        } else {
          setComments([]);
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => unsubscribe();
  }, [activeProblemId]);

  // Smooth scroll comments window
  useEffect(() => {
    if (activeProblemId) {
      if (initialActiveProblemType === 'like') {
        const topEl = document.getElementById('bahtsul-detail-top');
        if (topEl) {
          topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (initialCommentId) {
        // Give a tiny timeout for DOM rendering
        setTimeout(() => {
          const commentEl = document.getElementById(`bahtsul-comment-${initialCommentId}`);
          if (commentEl) {
            commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a temporary subtle blink highlight class to make it stand out!
            commentEl.classList.add('ring-4', 'ring-amber-500', 'bg-amber-50/20');
            setTimeout(() => {
              commentEl.classList.remove('ring-4', 'ring-amber-500', 'bg-amber-50/20');
            }, 3000);
          } else {
            // Fallback to scrolling to bottom
            if (commentsEndRef.current) {
              commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }, 600);
      } else {
        if (commentsEndRef.current) {
          commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [comments, activeProblemId, initialActiveProblemType, initialCommentId]);

  // --- BAHTSUL MASAIL INTERACTIVE LOGIC (AUTO-SUGGEST & EDIT/DELETE HANDLERS) ---
  const getMatchingKitab = (titleStr: string) => {
    if (!titleStr) return null;
    const normalizedSearch = titleStr.toLowerCase();
    
    // Search in our fully loaded dynamic kitabs state first
    let matched = dynamicKitabs.find(k => 
      normalizedSearch.includes(k.title.toLowerCase()) || 
      k.title.toLowerCase().includes(normalizedSearch) ||
      (k.arabicTitle && k.arabicTitle.toLowerCase().includes(normalizedSearch))
    );

    // Fallback to MOCK_KITABS if dynamic list is still empty or loading
    if (!matched) {
      matched = MOCK_KITABS.find(k => 
        normalizedSearch.includes(k.title.toLowerCase()) || 
        k.title.toLowerCase().includes(normalizedSearch) ||
        (k.arabicTitle && k.arabicTitle.toLowerCase().includes(normalizedSearch))
      );
    }
    return matched || null;
  };

  const handleReferenceChange = (val: string) => {
    setNewReference(val);
    if (!val.trim()) {
      setReferenceSuggestions([]);
      setShowRefSuggestions(false);
      return;
    }
    const titles = getKitabTitles();
    const filtered = titles.filter(k => 
      k.toLowerCase().includes(val.toLowerCase())
    );
    setReferenceSuggestions(filtered);
    setShowRefSuggestions(filtered.length > 0);
  };

  const handleEditReferenceChange = (val: string) => {
    if (!editingProblem) return;
    setEditingProblem({ ...editingProblem, referenceKitab: val });
    if (!val.trim()) {
      setEditRefSuggestions([]);
      setShowEditRefSuggestions(false);
      return;
    }
    const titles = getKitabTitles();
    const filtered = titles.filter(k => 
      k.toLowerCase().includes(val.toLowerCase())
    );
    setEditRefSuggestions(filtered);
    setShowEditRefSuggestions(filtered.length > 0);
  };

  const handleCommentTextChange = (val: string) => {
    setCommentText(val);
    
    // Check if the user is currently writing a @ reference
    const words = val.split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    
    if (lastWord.startsWith('@')) {
      const queryStr = lastWord.substring(1).toLowerCase();
      const titles = getKitabTitles();
      const filtered = titles.filter(k => 
        k.toLowerCase().includes(queryStr)
      );
      setMentionSuggestions(filtered);
      setShowMentionSuggestions(filtered.length > 0);
    } else {
      setMentionSuggestions([]);
      setShowMentionSuggestions(false);
    }
  };

  const selectMentionKitab = (kitabTitle: string) => {
    const words = commentText.split(/\s+/);
    if (words.length > 0) {
      let lastIdx = -1;
      for (let i = words.length - 1; i >= 0; i--) {
        if (words[i].startsWith('@')) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx !== -1) {
        words[lastIdx] = `@${kitabTitle}`;
      } else {
        words.push(`@${kitabTitle}`);
      }
    }
    setCommentText(words.join(' ') + ' ');
    setMentionSuggestions([]);
    setShowMentionSuggestions(false);
  };

  const handleUpdateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProblem || !editingProblem.title.trim() || !editingProblem.content.trim()) return;

    try {
      const docRef = doc(firestore, 'bahtsul_masail', editingProblem.id);
      await updateDoc(docRef, {
        title: editingProblem.title,
        content: editingProblem.content,
        referenceKitab: editingProblem.referenceKitab
      });
      // Sync local state copy
      setProblems(prev => prev.map(p => p.id === editingProblem.id ? { ...p, title: editingProblem.title, content: editingProblem.content, referenceKitab: editingProblem.referenceKitab } : p));
      showToast('Berhasil menyimpan hasil pengeditan status!', 'success');
      setEditingProblem(null);
    } catch (err) {
      // Fallback local update
      const locally = problems.map(p => p.id === editingProblem.id ? { ...p, title: editingProblem.title, content: editingProblem.content, referenceKitab: editingProblem.referenceKitab } : p);
      setProblems(locally);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(locally));
      showToast('Hasil pengeditan berhasil disimpan (mode offline)!', 'success');
      setEditingProblem(null);
    }
  };

  const handleDeleteProblem = async (problemId: string) => {
    try {
      const docRef = doc(firestore, 'bahtsul_masail', problemId);
      await deleteDoc(docRef);
      // Synchronize state
      setProblems(prev => prev.filter(p => p.id !== problemId));
      showToast('Postingan Musyawarah berhasil dihapus!', 'success');
      setDeletingProblemId(null);
    } catch (err) {
      const locally = problems.filter(p => p.id !== problemId);
      setProblems(locally);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(locally));
      showToast('Postingan berhasil dihapus dari sistem lokal!', 'success');
      setDeletingProblemId(null);
    }
  };

  const renderCommentTextWithKitabLinks = (text: string) => {
    if (!text) return '';
    
    const titles = getKitabTitles();
    if (titles.length === 0) return text;
    
    // Capture all @ mentions with known kitabs (longer names matched first to prevent partial substring overlaps)
    const sortedTitles = [...titles].sort((a, b) => b.length - a.length);
    const titlesRegexStr = sortedTitles.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`@(${titlesRegexStr})`, 'gi');
    
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchedTitle = match[1];
      
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      
      // Look up and attach KitabKuning
      const matchedKitabObj = getMatchingKitab(matchedTitle);
      
      parts.push(
        <span 
          key={matchIndex}
          onClick={(e) => {
            e.stopPropagation();
            if (matchedKitabObj) {
              setSelectedReferencedKitab(matchedKitabObj);
            } else {
              showToast(`📖 "${matchedTitle}" belum didigitalisasi penuh. Silakan dukung donasi Muara!`, 'info');
            }
          }}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 bg-emerald-50 text-[#064e3b] font-extrabold hover:bg-emerald-100/80 transition-colors cursor-pointer text-[10px] sm:text-[11px] rounded font-mono border border-emerald-150 shadow-3xs"
        >
          <BookOpen className="h-2.5 w-2.5 text-emerald-600 inline shrink-0" />
          @{matchedTitle}
        </span>
      );
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  // 4. Create Problem Action
  const handleCreateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const payload = {
      id: `prob-local-${Date.now()}-${Math.random()}`,
      userId: userProfile.id || (userProfile as any).uid || 'guest-user',
      userName: userProfile.name || 'Anonymous',
      userAvatar: userProfile.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
      userBio: userProfile.bio || 'Santri Premium MUARA',
      title: newTitle,
      content: newContent,
      referenceKitab: newReference || 'Belum dicantumkan rujukan spesifik',
      likesCount: 0,
      likedBy: [],
      commentsCount: 0,
      createdAt: new Date().toISOString(),
    };

    const path = 'bahtsul_masail';
    try {
      await addDoc(collection(firestore, path), payload);
      
      // Reset
      setNewTitle('');
      setNewContent('');
      setNewReference('');
      setIsCreateOpen(false);
    } catch (err) {
      // Fallback offline storage if network fails
      try {
        const locally = [payload, ...problems];
        setProblems(locally as any);
        localStorage.setItem('muara_bahtsul_cache', JSON.stringify(locally));
        
        setNewTitle('');
        setNewContent('');
        setNewReference('');
        setIsCreateOpen(false);
      } catch (inner) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }
  };

  // 5. Like Toggle Action
  const handleLikeProblem = async (problemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const problem = problems.find(p => p.id === problemId);
    if (!problem) return;

    const hasLiked = problem.likedBy.includes(userProfile.id);
    const updatedLikedBy = hasLiked 
      ? problem.likedBy.filter(uid => uid !== userProfile.id)
      : [...problem.likedBy, userProfile.id];
    
    const diff = hasLiked ? -1 : 1;
    const path = `bahtsul_masail/${problemId}`;

    try {
      const docRef = doc(firestore, 'bahtsul_masail', problemId);
      await updateDoc(docRef, {
        likedBy: hasLiked ? arrayRemove(userProfile.id) : arrayUnion(userProfile.id),
        likesCount: increment(diff)
      });

      // Skenario LIKE: Jika User A menyukai status milik User B, kirim notifikasi ke User B
      if (diff === 1 && problem.userId && problem.userId !== userProfile.id) {
        sendAutomaticNotification(
          problem.userId,
          "Suka Baru di Bahtsul Masail",
          `${userProfile.name} menyukai status Anda`,
          '',
          problemId
        );
      }
    } catch (err) {
      // Local fallback sync
      const locally = problems.map(p => {
        if (p.id === problemId) {
          return {
            ...p,
            likedBy: updatedLikedBy,
            likesCount: p.likesCount + diff
          };
        }
        return p;
      });
      setProblems(locally);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(locally));
    }
  };

  // 6. Submit Comment Action
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeProblemId) return;

    const commentPayload = {
      userId: userProfile.id || (userProfile as any).uid || 'guest-user',
      userName: userProfile.name || 'Anonymous',
      userAvatar: userProfile.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
      userBio: userProfile.bio || 'Santri Premium MUARA',
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
      parentId: replyingToComment ? replyingToComment.id : null,
      replyToName: replyingToComment ? replyingToComment.userName : null
    };

    const path = `bahtsul_masail/${activeProblemId}/comments`;
    try {
      // 1. Add Commment
      await addDoc(collection(firestore, 'bahtsul_masail', activeProblemId, 'comments'), commentPayload);
      
      // 2. Increment Commments counter atomicity block
      const probRef = doc(firestore, 'bahtsul_masail', activeProblemId);
      await updateDoc(probRef, {
        commentsCount: increment(1)
      });

      // 3. Trigger automatic notifications
      const activeProblem = problems.find(p => p.id === activeProblemId);
      if (replyingToComment) {
        // Skenario BALASAN: Jika User A membalas komentar milik User C di dalam status User B, kirim notifikasi ke User C
        if (replyingToComment.userId && replyingToComment.userId !== userProfile.id) {
          sendAutomaticNotification(
            replyingToComment.userId,
            "Balasan Komentar Bahtsul Masail",
            `${userProfile.name} membalas komentar Anda di ruang Bahtsul Masail ${activeProblem ? activeProblem.userName : ''}`,
            '',
            activeProblemId
          );
        }
      } else {
        // Skenario KOMENTAR: Jika User A mengomentari status milik User B, kirim notifikasi ke User B
        if (activeProblem && activeProblem.userId && activeProblem.userId !== userProfile.id) {
          sendAutomaticNotification(
            activeProblem.userId,
            "Komentar Baru Bahtsul Masail",
            `${userProfile.name} mengomentari status Anda`,
            '',
            activeProblemId
          );
        }
      }

      // Clear states
      setCommentText('');
      setReplyingToComment(null);
    } catch (err) {
      // Offline local flow
      const mockId = `c-offline-${Date.now()}`;
      const fullComment: Comment = {
        id: mockId,
        ...commentPayload
      };
      
      const newComments = [...comments, fullComment];
      setComments(newComments);
      localStorage.setItem(`comments_${activeProblemId}`, JSON.stringify(newComments));

      // Update parent problem counts locally
      const updatedProblems = problems.map(p => {
        if (p.id === activeProblemId) {
          return {
            ...p,
            commentsCount: p.commentsCount + 1
          };
        }
        return p;
      });
      setProblems(updatedProblems);
      localStorage.setItem('muara_bahtsul_cache', JSON.stringify(updatedProblems));

      setCommentText('');
      setReplyingToComment(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex flex-col bg-[#011c14]/75 backdrop-blur-md">
      
      {/* BACKGROUND DISMISSAL LAYER */}
      <div className="absolute inset-0 z-10" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.98 }}
        className="relative z-25 bg-slate-50 text-slate-800 w-full h-full md:h-[90vh] max-w-[720px] mx-auto md:my-[5vh] md:rounded-3xl shadow-2xl flex flex-col border border-emerald-100/60 overflow-hidden font-sans"
        id="bahtsul_masail_panel"
      >
        
        {/* PREMIUM GOLD BADGE LINE */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-amber-500 shrink-0" />

        {/* HEADER BAR IN DYNAMIC GREEN AND WHITE APP COLOR COMBINED - Mobile optimized */}
        <div className="p-3 px-4 sm:p-4 sm:px-6 bg-gradient-to-r from-[#064e3b] to-emerald-900 text-white flex items-center justify-between shrink-0 select-none shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-white/10 border border-white/20 p-1.5 sm:p-2 text-white flex items-center justify-center shadow-inner shrink-0">
              <Users className="h-4.5 w-4.5 sm:h-6 sm:w-6 text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-extrabold text-xs sm:text-base tracking-tight font-sans text-amber-300 truncate">Bahtsul Masail</h3>
                <span className="bg-amber-400/20 text-amber-300 font-mono text-[7.5px] sm:text-[9px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded border border-amber-400/40 uppercase tracking-wide flex items-center gap-0.5 shrink-0">
                  <Crown className="h-1.5 w-1.5 sm:h-2 sm:w-2" /> VIP
                </span>
              </div>
              <p className="text-[9px] sm:text-[11px] text-emerald-100/95 font-medium font-mono truncate">Musyawarah & Fatwa Kitab Kuning</p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-none shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* MAIN BODY AREA WITH DUAL VIEWS ( timeline feed OR active comment system ) */}
        <div className="flex-1 overflow-hidden flex relative bg-slate-100/30">
          
          {!isPremiumUser ? (
            /* NON-PREMIUM BLOCK SHIELD GATING IN GREEN & WHITE PALETTE */
            <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 text-center space-y-5">
              <div className="h-16 w-16 bg-amber-100 border border-amber-300 rounded-3xl flex items-center justify-center text-amber-600 shadow-xl animate-pulse">
                <Crown className="h-9 w-9" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h4 className="font-extrabold text-lg text-[#064e3b]">Pintu Musyawarah Bahtsul Masail</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Halaman ini eksklusif hanya untuk <strong>Anggota Premium (VIP)</strong> guna bermusyawarah, mendiskusikan khazanah kitab kuning pondok pesantren, dan mencari resolusi fatwa keagamaan modern.
                </p>
              </div>
              
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-left text-[11px] text-emerald-800 space-y-2.5 max-w-sm">
                <div className="flex gap-2.5 items-start">
                  <Plus className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Kirim permasalahan bahtsul masail untuk ditanggapi Ulama & Santri.</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Saling balas komentar argumen dan bersilat ukhuwah luring-daring.</span>
                </div>
              </div>

              <div className="pt-2 w-full max-w-sm space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUpgradeModal();
                  }}
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs tracking-wider uppercase shadow-lg transition-colors cursor-pointer border-none"
                >
                  Dapatkan Akses Premium Sekarang
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer bg-white"
                >
                  Kembali ke Beranda
                </button>
              </div>
            </div>
          ) : null}

          {/* DUAL SCREEN FRAMEWORK */}
          <div className="flex-1 flex flex-col overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4 sm:space-y-5 bg-white/50">
            
            {activeProblemId === null ? (
              /* VIEW 1: TIMELINE PANEL (FEED VS MY PROBLEMS VIEW) */
              currentSubView === 'my-posts' ? (
                <BahtsulMasailMyPosts
                  problems={problems}
                  userProfile={userProfile}
                  setCurrentSubView={setCurrentSubView}
                  setEditingProblem={setEditingProblem}
                  setDeletingProblemId={setDeletingProblemId}
                  setActiveProblemId={setActiveProblemId}
                  getMatchingKitab={getMatchingKitab}
                  setSelectedReferencedKitab={setSelectedReferencedKitab}
                  showToast={showToast}
                />
              ) : (
                /* VIEW 1: GENERAL TIMELINE FEED */
                <>
                  {/* INVITATION & CREATE BUTTON (Facebook Status Input Trigger Style) */}
                  <div 
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2.5 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-100 shadow-xs cursor-pointer hover:border-emerald-300 transition-all group shrink-0"
                  >
                    <img 
                      src={userProfile.avatarUrl} 
                      alt={userProfile.name} 
                      className="h-8.5 w-8.5 sm:h-10 sm:w-10 rounded-full object-cover border border-emerald-500/25 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-full px-3.5 sm:px-4 py-2 sm:py-3 text-slate-400 text-[10px] sm:text-xs text-left select-none transition-colors truncate">
                      Muzakarah kitab apa hari ini, kiai?
                    </div>
                    <button
                      type="button"
                      className="p-2 sm:p-3 bg-emerald-100/60 hover:bg-emerald-200/60 text-[#064e3b] rounded-full shrink-0 transition-colors cursor-pointer border-none"
                    >
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>

                  {/* PROBLEMS LIST */}
                  <div className="space-y-3.5">
                    {(() => {
                      const sliced = problems.slice(0, itemsToShow);

                      if (sliced.length === 0) {
                        return (
                          <div className="p-8 sm:p-12 text-center text-slate-500 text-xs bg-white rounded-xl sm:rounded-2xl border border-slate-100/80">
                            <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 mx-auto text-emerald-600/60 mb-2 animate-bounce" />
                            <span>Tidak ada perbincangan bahtsul masail aktif saat ini.</span>
                          </div>
                        );
                      }

                      return sliced.map((prob, index) => {
                        const isLiked = prob.likedBy.includes(userProfile.id);
                        return (
                          <motion.div
                            key={prob.id || `prob-slice-${index}`}
                            layoutId={`card-${prob.id}`}
                            onClick={() => setActiveProblemId(prob.id)}
                            className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-50/40 border border-slate-200/50 hover:border-emerald-250 hover:shadow-lg transition-all duration-200 cursor-pointer space-y-3.5 group relative"
                          >
                            {/* USER PROFILE HEADER SECTION */}
                            <div className="flex items-center justify-between gap-2">
                              <div 
                                 className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-1 min-w-0"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedProfile({
                                     name: prob.userName,
                                     avatar: prob.userAvatar,
                                     bio: prob.userBio,
                                     isPremium: true
                                   });
                                 }}
                              >
                                <img 
                                  src={prob.userAvatar} 
                                  alt={prob.userName} 
                                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover border-2 border-amber-400 hover:scale-105 transition-transform shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-extrabold text-[11px] sm:text-xs text-slate-900 hover:text-emerald-800 transition-colors flex items-center gap-1">
                                    <span className="truncate">{prob.userName}</span>
                                    <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                                  </h5>
                                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate">{prob.userBio}</p>
                                </div>
                              </div>

                              {/* TIMEAGO */}
                              <span className="text-[8px] sm:text-[9px] font-mono font-bold text-slate-400 flex items-center gap-0.5 sm:gap-1 shrink-0 bg-slate-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-slate-100">
                                <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-400" />
                                <span className="hidden sm:inline">{new Date(prob.createdAt).toLocaleDateString()}</span>
                                <span className="inline sm:hidden">{new Date(prob.createdAt).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})}</span>
                              </span>
                            </div>

                            {/* BODY DESCRIPTION */}
                            <div className="space-y-1 pointer-events-none">
                              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-800 tracking-tight transition-colors line-clamp-2">
                                {prob.title}
                              </h4>
                              <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed line-clamp-3">
                                {prob.content}
                              </p>
                            </div>

                            {/* KITAB REFERENCE DECAL */}
                            <div className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100/50 rounded-lg sm:rounded-xl border border-emerald-100/60 text-[9px] sm:text-[10px] font-mono text-emerald-800 max-w-full truncate flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">Rujukan: <strong className="font-extrabold">{prob.referenceKitab}</strong></span>
                            </div>

                            {/* FOOTER CO-STATS BUTTONS */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 font-mono">
                              <div className="flex items-center gap-2 sm:gap-4">
                                {/* LIKE BUTTON */}
                                <button
                                  type="button"
                                  onClick={(e) => handleLikeProblem(prob.id, e)}
                                  className={`flex items-center gap-1 p-1 sm:p-1.5 px-2 sm:px-2.5 rounded-lg hover:bg-slate-50 cursor-pointer border-none bg-transparent transition-colors ${
                                    isLiked ? 'text-amber-500 font-bold bg-amber-50/20' : 'hover:text-slate-800'
                                  }`}
                                >
                                  <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-amber-500 text-amber-500' : ''}`} />
                                  <span>{prob.likesCount}</span>
                                </button>

                                {/* JAWABAN/COMMENT STATS */}
                                <div className="flex items-center gap-1 p-1 sm:p-1.5 px-2 sm:px-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                                  <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{prob.commentsCount} <span className="hidden sm:inline">Jawaban</span></span>
                                </div>
                              </div>

                              <span className="text-[9px] sm:text-[10px] text-emerald-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                                Musyawarah <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              </span>
                            </div>
                          </motion.div>
                        );
                      });
                    })()}
                  </div>

                  {/* LIHAT POSTINGAN LAINNYA TRIGGER BUTTON */}
                  {problems.length > itemsToShow && (
                    <button
                      type="button"
                      onClick={() => setItemsToShow(prev => prev + (bmSettings.postsLimit || 5))}
                      className="w-full py-3.5 text-center text-xs font-extrabold text-[#064e3b] bg-emerald-55 hover:bg-emerald-100/90 transition-all rounded-2xl border border-emerald-100 shadow-3xs cursor-pointer flex items-center justify-center gap-1.5 font-mono"
                    >
                      <ChevronDown className="h-4 w-4 shrink-0 animate-bounce" />
                      <span>Lihat Postingan Lainnya (Tersisa {problems.length - itemsToShow})</span>
                    </button>
                  )}
                </>
              )
            ) : (
              /* VIEW 2: ACTIVE QUESTION DETAILS WITH THREADED COMMENTS (MUSYAWARAH CHAT) */
              (() => {
                const activeProb = problems.find(p => p.id === activeProblemId);
                if (!activeProb) {
                  return (
                    <button 
                      onClick={() => setActiveProblemId(null)}
                      className="text-white bg-emerald-600 px-4 py-2"
                    >
                      Permasalahan Hilang, Klik Untuk Kembali
                    </button>
                  );
                }
                const isLiked = activeProb.likedBy.includes(userProfile.id);

                return (
                  <div id="bahtsul-detail-top" className="space-y-3.5 pb-20 select-none">
                    {/* BACK NAVIGATION AREA */}
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveProblemId(null);
                          setReplyingToComment(null);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-600 bg-white border border-slate-200/80 hover:bg-slate-50 px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl cursor-pointer shadow-3xs"
                      >
                        ← <span className="hidden sm:inline">Kembali ke Forum</span><span className="inline sm:hidden">Kembali</span>
                      </button>
                      <span className="text-[8px] sm:text-[10px] font-mono font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-2 sm:px-2.5 py-1 rounded-md border border-amber-200">
                        MUSYAWARAH AKTIF
                      </span>
                    </div>

                    {/* MAIN PROBLEM CARD STRETCHED */}
                    <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-emerald-100/80 space-y-3.5 shadow-sm">
                      {/* WRITTER CAP */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div 
                          className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-1 min-w-0"
                          onClick={() => setSelectedProfile({
                            name: activeProb.userName,
                            avatar: activeProb.userAvatar,
                            bio: activeProb.userBio,
                            isPremium: true
                          })}
                        >
                          <img 
                            src={activeProb.userAvatar} 
                            alt={activeProb.userName} 
                            className="h-8.5 w-8.5 sm:h-10 sm:w-10 rounded-full border border-emerald-500/30 object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <h5 className="font-extrabold text-[11px] sm:text-xs text-slate-900 flex items-center gap-1 hover:text-[#064e3b] truncate">
                              <span className="truncate">{activeProb.userName}</span>
                              <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                            </h5>
                            <p className="text-[9px] sm:text-[10px] text-slate-500 leading-tight truncate">{activeProb.userBio}</p>
                          </div>
                        </div>

                        <span className="text-[8px] sm:text-[9px] font-mono font-bold text-slate-400 bg-slate-50/85 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md border border-slate-100 shrink-0">
                          {new Date(activeProb.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* CONTENT DESCRIPTIVE */}
                      <div className="space-y-1.5 pt-1">
                        <h3 className="font-extrabold text-xs sm:text-sm md:text-base text-slate-900 tracking-tight leading-snug">
                          {activeProb.title}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-650 leading-relaxed bg-[#064e3b]/5 p-3 sm:p-3.5 rounded-xl border border-[#064e3b]/10 select-text">
                          {activeProb.content}
                        </p>
                      </div>

                      {/* KITAB ATTACHMENT */}
                      <div className="px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-emerald-50 rounded-lg sm:rounded-xl border border-emerald-100/80 text-[9px] sm:text-[11px] font-mono text-emerald-800 flex items-center gap-1.5 max-w-full truncate">
                        <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Rujukan: <strong className="font-extrabold">{activeProb.referenceKitab}</strong></span>
                      </div>

                      <div className="pt-1 border-t border-slate-50 flex items-center gap-4 sm:gap-6 text-[10px] sm:text-xs font-mono font-bold text-slate-500">
                        <button
                          type="button"
                          onClick={(e) => handleLikeProblem(activeProb.id, e)}
                          className={`flex items-center gap-1 hover:text-slate-800 transition-colors cursor-pointer border-none bg-transparent ${
                            isLiked ? 'text-amber-500 bg-amber-50/10 px-2 py-0.5 rounded' : ''
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLiked ? 'fill-amber-500 text-amber-500' : ''}`} />
                          <span>{activeProb.likesCount} <span className="hidden sm:inline">Suka</span></span>
                        </button>

                        <div className="flex items-center gap-1.5 text-emerald-750">
                          <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                          <span>{activeProb.commentsCount} <span className="hidden sm:inline">Tanggapan</span><span className="inline sm:hidden">Balasan</span></span>
                        </div>
                      </div>
                    </div>

                    {/* ARGUMENTS / COMMENTS HEADING */}
                    <div className="pt-3 pb-1 border-b border-slate-100">
                      <h4 className="font-extrabold text-[9px] sm:text-xs text-emerald-800 uppercase tracking-wider font-mono">Daftar Tanggapan Ilmiah (Ulama & Asatidz)</h4>
                    </div>

                    {/* COMMENTS THREAD VIEW */}
                    <div className="space-y-3">
                      {comments.length === 0 ? (
                        <div className="p-6 text-center bg-white rounded-xl sm:rounded-2xl border border-slate-200 text-slate-400 text-[11px] shadow-3xs">
                          Belum ada jawaban mufashal. Mari berikan ta'liq pertama!
                        </div>
                      ) : (
                        comments.filter(c => !c.parentId).map((mainComment) => (
                          <div key={mainComment.id} className="space-y-2.5">
                            
                            {/* MAIN LEVEL COMMENT */}
                            <div id={`bahtsul-comment-${mainComment.id}`} className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-2.5 shadow-3xs hover:bg-opacity-95 transition-colors border ${
                              mainComment.userId === 'santri-ai-bot'
                                ? 'bg-emerald-50/25 border-emerald-200 shadow-emerald-50 shadow-md'
                                : 'bg-white border-slate-200/85 hover:bg-slate-50/50'
                            }`}>
                              <div className="flex items-center justify-between gap-2">
                                <div 
                                  className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                                  onClick={() => setSelectedProfile({
                                    name: mainComment.userName,
                                    avatar: mainComment.userAvatar,
                                    bio: mainComment.userBio,
                                    isPremium: true
                                  })}
                                >
                                  {mainComment.userId === 'santri-ai-bot' ? (
                                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#064e3b] flex flex-col items-center justify-center shrink-0 overflow-hidden ring-2 ring-emerald-150 relative border border-emerald-400">
                                      {/* Kopiah/Peci Santri Black Cap */}
                                      <div className="w-3.5 h-1.5 bg-neutral-900 rounded-t-[1px] border border-neutral-950 z-10 -mb-[1px]" />
                                      {/* Face skin */}
                                      <div className="w-3.5 h-3 bg-amber-100/90 rounded-full flex items-center justify-center overflow-hidden z-0">
                                        {/* Smile mouth/eyes */}
                                        <div className="w-1.5 h-0.5 border-b border-emerald-950/40 rounded-full mt-0.5" />
                                      </div>
                                      {/* Green sarung collar */}
                                      <div className="w-4.5 h-1.5 bg-emerald-700 border-t border-emerald-600 rounded-t-sm -mt-[1px] z-10" />
                                    </div>
                                  ) : (
                                    <img 
                                      src={mainComment.userAvatar} 
                                      alt={mainComment.userName} 
                                      className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover shrink-0 border border-amber-400"
                                      referrerPolicy="no-referrer"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h6 className="font-extrabold text-[11px] sm:text-xs text-slate-900 flex items-center gap-1 hover:text-emerald-700 truncate">
                                      <span className="truncate">{mainComment.userName}</span>
                                      {mainComment.userId === 'santri-ai-bot' ? (
                                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 ml-0.5 bg-gradient-to-r from-emerald-600 to-amber-500 text-white font-black text-[7px] sm:text-[8px] tracking-wider uppercase rounded shadow-3xs scale-90 origin-left">
                                          <Sparkles className="h-2 w-2 shrink-0 animate-pulse animate-spin-slow" />
                                          <span>SANTRI AI</span>
                                        </span>
                                      ) : (
                                        <Crown className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                      )}
                                    </h6>
                                    <p className="text-[9px] text-slate-500 leading-none truncate">{mainComment.userBio}</p>
                                  </div>
                                </div>

                                <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
                                  {new Date(mainComment.createdAt).toLocaleDateString()}
                                </span>
                              </div>

                              <p className="text-[11px] sm:text-xs text-slate-705 leading-relaxed font-sans select-text pl-1 whitespace-pre-line">
                                {renderCommentTextWithKitabLinks(mainComment.text)}
                              </p>

                              <div className="pt-0.5 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setReplyingToComment(mainComment)}
                                  className="text-[8.5px] sm:text-[9px] font-bold font-mono text-emerald-700 hover:text-emerald-600 hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-none outline-none"
                                >
                                  <CornerDownRight className="h-3 w-3 shrink-0" /> Balas
                                </button>
                              </div>
                            </div>

                            {/* INDENT LEVEL REPLIES SUB-THREAD */}
                            {comments.filter(sub => sub.parentId === mainComment.id).map((subComment) => (
                              <div 
                                key={subComment.id} 
                                className="pl-4 sm:pl-8 flex gap-1.5"
                              >
                                <CornerDownRight className="h-3.5 w-3.5 text-emerald-700 shrink-0 mt-3" />
                                <div id={`bahtsul-comment-${subComment.id}`} className={`flex-1 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border space-y-1.5 transition-colors min-w-0 ${
                                  subComment.userId === 'santri-ai-bot'
                                    ? 'bg-emerald-50/20 border-emerald-150 shadow-emerald-50 shadow-xs'
                                    : 'bg-slate-50 border-slate-150 hover:bg-emerald-50/10'
                                }`}>
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div 
                                      className="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0"
                                      onClick={() => setSelectedProfile({
                                        name: subComment.userName,
                                        avatar: subComment.userAvatar,
                                        bio: subComment.userBio,
                                        isPremium: true
                                      })}
                                    >
                                      {subComment.userId === 'santri-ai-bot' ? (
                                        <div className="h-6 w-6 rounded-full bg-[#064e3b] flex flex-col items-center justify-center shrink-0 overflow-hidden ring-1 ring-emerald-150 relative border border-emerald-400">
                                          {/* Kopiah/Peci Santri Black Cap */}
                                          <div className="w-3 h-1 bg-neutral-900 rounded-t-[1px] border border-neutral-950 z-10 -mb-[1px] scale-90" />
                                          {/* Face skin */}
                                          <div className="w-3 h-2.5 bg-amber-100/90 rounded-full flex items-center justify-center overflow-hidden z-0 scale-90">
                                            {/* Smile mouth/eyes */}
                                            <div className="w-1 border-b border-emerald-950/40 rounded-full mt-0.5" />
                                          </div>
                                          {/* Green sarung collar */}
                                          <div className="w-4 h-1 bg-emerald-700 border-t border-emerald-600 rounded-t-sm -mt-[1px] z-10 scale-90" />
                                        </div>
                                      ) : (
                                        <img 
                                          src={subComment.userAvatar} 
                                          alt={subComment.userName} 
                                          className="h-6 w-6 rounded-full object-cover shrink-0 border border-amber-400"
                                          referrerPolicy="no-referrer"
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <h6 className="font-extrabold text-[10px] text-slate-900 hover:text-emerald-700 truncate flex items-center gap-1">
                                          <span>{subComment.userName}</span>
                                          {subComment.userId === 'santri-ai-bot' && (
                                            <Sparkles className="h-2.5 w-2.5 text-amber-500 shrink-0 animate-pulse" />
                                          )}
                                        </h6>
                                        <p className="text-[8px] text-slate-500 leading-none truncate">{subComment.userBio}</p>
                                      </div>
                                    </div>

                                    <span className="text-[8px] font-mono text-slate-400 shrink-0">
                                      {new Date(subComment.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>

                                  <p className="text-[10px] sm:text-[11px] text-slate-650 leading-relaxed pl-1">
                                    <span className="text-emerald-700 font-mono font-bold mr-1">{subComment.replyToName ? `@${subComment.replyToName}` : ''}</span>
                                    {renderCommentTextWithKitabLinks(subComment.text)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                    <div ref={commentsEndRef} />
                  </div>
                );
              })()
            )}

          </div>

          {/* FLOATING ACTION FLOATER MENU (Ditingkatkan secara mewah & modern) */}
          {activeProblemId === null && isPremiumUser && (
            <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 z-30 flex flex-col items-end gap-2 font-sans select-none">
              
              {/* DROPDOWN CARD */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 15 }}
                    className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-emerald-100/70 p-2.5 w-44 sm:w-52 mb-2 space-y-1 overflow-hidden"
                  >
                    <div className="border-b border-slate-100 pb-1.5 px-2 mb-1">
                      <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-widest block font-sans">Aksi Bahtsul Masail</span>
                    </div>

                    {/* MENU ITEM 1: CREATE PROBLEM */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateOpen(true);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between text-left p-1.5 hover:bg-slate-50 rounded-xl transition-all group border-none bg-transparent cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-emerald-50 text-[#064e3b] flex items-center justify-center p-1 border border-emerald-100 group-hover:scale-105 transition-transform shrink-0">
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                        </div>
                        <span className="text-[9px] sm:text-xs font-bold text-slate-700 group-hover:text-emerald-850 transition-colors">Tanya Masalah</span>
                      </div>
                      <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* MENU ITEM 2: MY PROBLEMS */}
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentSubView(currentSubView === 'feed' ? 'my-posts' : 'feed');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between text-left p-1.5 hover:bg-slate-50 rounded-xl transition-all group border-none bg-transparent cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center p-1 border border-amber-100 group-hover:scale-105 transition-transform shrink-0">
                          {currentSubView === 'my-posts' ? (
                            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : (
                            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                        </div>
                        <span className="text-[9px] sm:text-xs font-bold text-slate-700 group-hover:text-amber-805 transition-colors">
                          {currentSubView === 'my-posts' ? "Forum Utama" : "Postingan Saya"}
                        </span>
                      </div>
                      <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                  </motion.div>
                )}
              </AnimatePresence>

              {/* MAIN HERO FAB BUTTON */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`h-11 w-11 sm:h-13 sm:w-13 rounded-full flex items-center justify-center shadow-lg cursor-pointer border-none transition-all duration-300 relative ${
                  isDropdownOpen 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white scale-105 rotate-45' 
                    : 'bg-gradient-to-r from-emerald-600 to-[#064e3b] hover:from-emerald-700 hover:to-emerald-850 text-white hover:scale-105'
                }`}
              >
                {/* Micro reflection accent for prestige */}
                <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
                <Plus className="h-5.5 w-5.5 sm:h-6.5 sm:w-6.5 text-white" />
              </button>

            </div>
          )}

        </div>

        {/* PERSISTENT FLOATING REACTION WRITING FORM (Only visible during detail view) */}
        {activeProblemId !== null && isPremiumUser && (
          <div className="absolute bottom-0 inset-x-0 p-4 bg-white border-t border-slate-200 z-10 shadow-lg">
            
            {/* @ MENTION AUTOCOMPLETE SUGGESTIONS POPUP */}
            <AnimatePresence>
              {showMentionSuggestions && mentionSuggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-[66px] inset-x-4 bg-white border border-slate-200/80 rounded-xl shadow-xl p-2.5 max-h-36 overflow-y-auto z-40 space-y-1.5 select-none"
                >
                  <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest px-2 font-mono">Pilih Rujukan Kitab Kuning (@)</p>
                  <div className="flex flex-col">
                    {mentionSuggestions.map((title, index) => (
                      <button
                        key={`${title}-${index}`}
                        type="button"
                        onClick={() => selectMentionKitab(title)}
                        className="text-left px-2 py-1.5 hover:bg-emerald-50 rounded-lg text-[10.5px] font-serif font-bold text-slate-800 transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer w-full"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>@{title}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {replyingToComment && (
              <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl mb-2 flex items-center justify-between text-[11px] text-emerald-800">
                <div className="flex items-center gap-1.5 font-mono">
                  <CornerDownRight className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Membalas argumen ustadz: <strong>@{replyingToComment.userName}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToComment(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer border-none bg-transparent"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmitComment} className="flex gap-2.5">
              <input
                type="text"
                value={commentText}
                onChange={(e) => handleCommentTextChange(e.target.value)}
                placeholder="Ketikan argumen mufashal beserta thariqah rujukan kitab (gunakan @ untuk rujukan)..."
                className="flex-1 bg-slate-50 text-slate-800 text-xs px-4 py-3 rounded-xl border border-slate-250 focus:border-emerald-600 outline-none focus:bg-white transition-all font-sans"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className={`p-3 rounded-xl cursor-pointer flex items-center justify-center transition-colors border-none ${
                  commentText.trim() 
                    ? 'bg-emerald-700 hover:bg-emerald-850 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed'
                }`}
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </form>
          </div>
        )}

      </motion.div>

      {/* -------------------- INTERNAL CREATE PROBLEM MODAL OVERLAY (FACEBOOK / INSTAGRAM COMPOSER STYLE) -------------------- */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#011c14]/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 border border-slate-150 shadow-2xl max-w-lg w-full relative overflow-hidden text-slate-800 font-sans"
            >
              {/* Premium Top Line Accent */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />
              
              {/* Facebook Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                <span className="font-extrabold text-sm sm:text-base text-slate-900">Buat Masalah Bahasan (Post)</span>
                <button 
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Facebook Profile Row */}
              <div className="flex items-center gap-3 py-3.5">
                <img 
                  src={userProfile.avatarUrl} 
                  alt={userProfile.name} 
                  className="h-11 w-11 rounded-full object-cover border border-emerald-500/25 shadow-3xs"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1">
                    {userProfile.name}
                    <span className="bg-amber-100 border border-amber-300 text-amber-700 text-[8px] px-1 py-0.5 rounded font-mono font-extrabold scale-95 uppercase flex items-center gap-0.5">
                      <Crown className="h-1.5 w-1.5 text-amber-600" /> VIP
                    </span>
                  </h4>
                  {/* Scope privacy indicator pill */}
                  <div className="flex items-center gap-1 text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full mt-0.5 font-medium border border-slate-150 inline-block w-fit cursor-default select-none">
                    <Users className="h-3 w-3 text-slate-500" />
                    <span>👥 Publik Bahtsul Masail</span>
                  </div>
                </div>
              </div>

              {/* Post Inputs */}
              <form onSubmit={handleCreateProblem} className="space-y-4">
                
                {/* Title (Post Input Line) */}
                <div className="border-b border-slate-100 pb-1">
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Judul pokok permasalahan..."
                    className="w-full bg-transparent p-0 py-1.5 border-none ring-0 outline-none focus:outline-none focus:ring-0 text-[#064e3b] font-extrabold text-sm placeholder-slate-400"
                  />
                </div>

                {/* Content Area (Instagram Text Area) */}
                <div className="relative">
                  <textarea
                    required
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={`Apa permasalahan syariah yang ingin Anda musyawarahkan hari ini, ${userProfile.name}?`}
                    className="w-full bg-transparent p-0 border-none ring-0 outline-none focus:outline-none focus:ring-0 text-xs sm:text-sm text-slate-700 placeholder-slate-400 font-sans resize-none min-h-[110px]"
                  />
                </div>

                {/* Bottom Widget: Kitab kuning rujukan field designed like FB "Add to post" */}
                <div className="p-3 border border-slate-150 rounded-2xl bg-slate-50 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5 font-sans">
                      <BookOpen className="h-3.5 w-3.5 text-emerald-600" /> Rujukan Kitab Kuning
                    </span>
                    <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full uppercase tracking-wider scale-90 leading-none">
                      Opsional
                    </span>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      value={newReference}
                      onChange={(e) => handleReferenceChange(e.target.value)}
                      placeholder="Contoh: Majmu' Syarah Muhadzdzab Juz 3, Kasyifatus Saja"
                      className="w-full bg-white p-2 text-xs text-slate-705 outline-none rounded-xl border border-slate-200 focus:border-emerald-600 transition-colors font-sans shadow-3xs"
                    />

                    {/* AUTOCOMPLETE DROPDOWN */}
                    <AnimatePresence>
                      {showRefSuggestions && referenceSuggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-55 max-h-36 overflow-y-auto"
                        >
                          {referenceSuggestions.map((title, index) => (
                            <button
                              key={`${title}-${index}`}
                              type="button"
                              onClick={() => {
                                setNewReference(title);
                                setReferenceSuggestions([]);
                                setShowRefSuggestions(false);
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-emerald-50 rounded-lg text-[10.5px] sm:text-xs font-serif font-bold text-slate-800 transition-colors flex items-center gap-1.5 border-none bg-transparent cursor-pointer"
                            >
                              <BookOpen className="h-3 w-3 text-emerald-600" />
                              <span>{title}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-605 bg-gradient-to-r from-emerald-800 to-[#064e3b] hover:from-emerald-900 hover:to-emerald-950 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg cursor-pointer border-none"
                  >
                    Siarkan Ke Forum
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs transition-colors cursor-pointer bg-transparent"
                  >
                    Batalkan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- MEMBER SOCIAL PROFILE POPUP CARD (MATCHING GREEN & WHITE THEME) -------------------- */}
      <AnimatePresence>
        {selectedProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-xs w-full relative text-center overflow-hidden text-slate-800 font-sans"
            >
              {/* Premium Header Line Decorator */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 through-yellow-400 to-amber-500" />
              
              <button 
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer border-none bg-transparent"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="space-y-4 pt-4">
                {/* Big Avatar with Premium Ring */}
                <div className="relative inline-block">
                  {selectedProfile.name.toLowerCase().includes('santri ai') ? (
                    <div className="h-20 w-20 rounded-full mx-auto bg-[#064e3b] flex flex-col items-center justify-center shrink-0 overflow-hidden ring-4 ring-amber-400 relative border border-emerald-400 shadow-xl">
                      {/* Kopiah/Peci Santri Black Cap */}
                      <div className="w-8 h-3.5 bg-neutral-900 rounded-t-[2px] border border-neutral-950 z-10 -mb-[1px]" />
                      {/* Face skin */}
                      <div className="w-8 h-6 bg-amber-100/90 rounded-full flex items-center justify-center overflow-hidden z-0">
                        {/* Smile mouth/eyes */}
                        <div className="w-3.5 h-1 border-b border-emerald-950/40 rounded-full mt-1" />
                      </div>
                      {/* Green sarung collar */}
                      <div className="w-10 h-3 bg-emerald-700 border-t border-emerald-600 rounded-t-sm -mt-[1px] z-10" />
                    </div>
                  ) : (
                    <img 
                      src={selectedProfile.avatar} 
                      alt={selectedProfile.name} 
                      className="h-20 w-20 rounded-full mx-auto object-cover border-4 border-amber-400 shadow-xl"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 p-1 rounded-full border border-white text-white shadow-md">
                    <Crown className="h-4 w-4" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm tracking-tight text-slate-900 flex items-center justify-center gap-1 font-sans">
                    {selectedProfile.name}
                  </h4>
                  <span className="inline-block bg-amber-50 text-amber-700 border border-amber-250 rounded-full font-mono font-bold text-[9px] px-2.5 py-0.5 mt-1 uppercase scale-90">
                    SANTRI PREMIUM VIP
                  </span>
                </div>

                {/* BIO */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150 text-left">
                  <span className="block text-[8px] font-bold font-mono text-slate-400 uppercase tracking-widest mb-1">Riwayat Singkat (Bio)</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    {selectedProfile.bio}
                  </p>
                </div>

                {/* FOOTER METRIC BANNER */}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800 font-mono font-bold flex justify-center items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-600" /> Anggota Resmi Majelis MUARA
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-850 rounded-xl font-bold text-xs transition-colors cursor-pointer border-none"
                >
                  Tutup Profil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- INTERNAL EDIT PROBLEM MODAL OVERLAY -------------------- */}
      <AnimatePresence>
        {editingProblem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#011c14]/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 border border-slate-150 shadow-2xl max-w-lg w-full relative overflow-hidden text-slate-800 font-sans"
            >
              {/* Premium Top Line Accent */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                <span className="font-extrabold text-sm sm:text-base text-slate-900">Edit Masalah Bahasan (Post)</span>
                <button 
                  type="button"
                  onClick={() => setEditingProblem(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer border-none bg-transparent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateProblem} className="space-y-4 pt-4">
                {/* Title */}
                <div className="border-b border-slate-100 pb-1">
                  <label className="block text-[8px] sm:text-[9.5px] font-bold font-mono text-slate-400 uppercase tracking-widest mb-1">Judul Masalah</label>
                  <input
                    type="text"
                    required
                    value={editingProblem.title}
                    onChange={(e) => setEditingProblem({ ...editingProblem, title: e.target.value })}
                    placeholder="Judul pokok permasalahan..."
                    className="w-full bg-transparent p-0 py-1.5 border-none ring-0 outline-none focus:outline-none focus:ring-0 text-[#064e3b] font-extrabold text-sm placeholder-slate-400"
                  />
                </div>

                {/* Content Area */}
                <div>
                  <label className="block text-[8px] sm:text-[9.5px] font-bold font-mono text-slate-400 uppercase tracking-widest mb-1">Pertanyaan / Pembahasan</label>
                  <textarea
                    required
                    rows={4}
                    value={editingProblem.content}
                    onChange={(e) => setEditingProblem({ ...editingProblem, content: e.target.value })}
                    placeholder="Edit isi permasalahan keagamaan di sini..."
                    className="w-full bg-slate-50 rounded-xl p-3 border border-slate-150 ring-0 outline-none text-slate-700 placeholder-slate-400 font-sans text-xs sm:text-sm min-h-[110px]"
                  />
                </div>

                {/* Kitab kuning rujukan field */}
                <div className="p-3 border border-slate-150 rounded-2xl bg-slate-50 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5 font-sans">
                      <BookOpen className="h-3.5 w-3.5 text-emerald-600" /> Rujukan Kitab Kuning
                    </span>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      value={editingProblem.referenceKitab || ''}
                      onChange={(e) => handleEditReferenceChange(e.target.value)}
                      placeholder="Contoh: Majmu' Syarah Muhadzdzab Juz 3"
                      className="w-full bg-white p-2 text-xs text-slate-700 outline-none rounded-xl border border-slate-200 focus:border-emerald-600 transition-colors font-sans shadow-3xs"
                    />
                    
                    {/* AUTOCOMPLETE DROPDOWN */}
                    <AnimatePresence>
                      {showEditRefSuggestions && editRefSuggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-55 max-h-36 overflow-y-auto"
                        >
                          {editRefSuggestions.map((title, index) => (
                            <button
                              key={`${title}-${index}`}
                              type="button"
                              onClick={() => {
                                setEditingProblem({ ...editingProblem, referenceKitab: title });
                                setEditRefSuggestions([]);
                                setShowEditRefSuggestions(false);
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-emerald-50 rounded-lg text-[10.5px] sm:text-xs font-serif font-bold text-slate-800 transition-colors flex items-center gap-1.5 border-none bg-transparent cursor-pointer"
                            >
                              <BookOpen className="h-3 w-3 text-emerald-600" />
                              <span>{title}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-605 bg-gradient-to-r from-emerald-800 to-[#064e3b] hover:from-emerald-900 hover:to-emerald-950 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg cursor-pointer border-none"
                  >
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProblem(null)}
                    className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl font-bold text-xs transition-colors cursor-pointer bg-transparent"
                  >
                    Batalkan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- INTERNAL DELETE PROBLEM MODAL OVERLAY -------------------- */}
      <AnimatePresence>
        {deletingProblemId && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xl max-w-sm w-full relative text-center overflow-hidden text-slate-800 font-sans"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-600" />
              
              <div className="space-y-4 pt-4">
                <div className="h-12 w-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mx-auto border border-rose-100">
                  <AlertCircle className="h-6 w-6 stroke-[2.5]" />
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                    Konfirmasi Hapus Postingan
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    Apakah Anda bulat tekad ingin menghapus permasalahan bahtsul masail ini? Postingan dan seluruh komentar asatidz di dalamnya akan terhapus secara permanen.
                  </p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleDeleteProblem(deletingProblemId)}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition-colors shadow-sm cursor-pointer border-none"
                  >
                    Ya, Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingProblemId(null)}
                    className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-55 text-slate-500 rounded-xl font-bold text-xs transition-colors cursor-pointer bg-transparent"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- INTERIOR KITAB KUNING MULTI-DOC READER COVERAGE ----------------- */}
      <AnimatePresence>
        {selectedReferencedKitab && (
          <div className="fixed inset-0 z-58">
            <KitabReader
              kitab={selectedReferencedKitab}
              userProfile={userProfile}
              onClose={() => setSelectedReferencedKitab(null)}
              onTriggerUpgrade={onOpenUpgradeModal}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ----------------DIVERSIFIED FLOATING TOAST BANNER DISPLAY ------------- */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 max-w-sm w-[90%] border select-none ${
              toast.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-250 font-sans' 
                : toast.type === 'error' 
                  ? 'bg-rose-50 text-rose-800 border-rose-200 font-sans' 
                  : 'bg-emerald-50 text-emerald-900 border-emerald-150 font-sans'
            }`}
          >
            <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${
              toast.type === 'success' 
                ? 'bg-emerald-100 text-emerald-600' 
                : toast.type === 'error' 
                  ? 'bg-rose-100 text-rose-600' 
                  : 'bg-emerald-100/80 text-emerald-700'
            }`}>
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold leading-normal">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
