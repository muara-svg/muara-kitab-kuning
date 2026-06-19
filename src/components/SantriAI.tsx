import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  BookOpen, 
  Lock, 
  Crown, 
  Minimize2, 
  Maximize2,
  Bookmark,
  ArrowRight,
  MessageSquareQuote,
  FlameKindling,
  ArrowUpRight,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { MOCK_KITABS } from '../data/mockData';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../lib/firebaseConfig';
import { indexedDbService } from '../lib/indexedDbService';
import BahtsulMasail from './BahtsulMasail';

// Helper to derive API URL for Capacitor or Web
const getApiUrl = (path: string): string => {
  const isCapacitor = typeof window !== 'undefined' && (
    !!(window as any).Capacitor || 
    window.location.protocol === 'capacitor:' || 
    (window.location.protocol === 'http:' && window.location.hostname === 'localhost' && !window.location.port)
  );
  
  if (isCapacitor) {
    const cachedUrl = localStorage.getItem('muara_api_server_url');
    const fallbackUrl = 'https://ais-pre-5nryvql223g2kompd5rosg-139765732384.asia-southeast1.run.app';
    return `${cachedUrl || fallbackUrl}${path}`;
  }
  return path;
};

interface SantriAIProps {
  userProfile: UserProfile;
  onOpenUpgradeModal: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface RelevantPassage {
  kitabTitle: string;
  author: string;
  babName: string;
  subName: string;
  content: string;
  pageIdx: number;
  score: number;
}

export default function SantriAI({ userProfile, onOpenUpgradeModal }: SantriAIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Assalamu'alaikum wr. wb. Saya **Santri AI**, asisten digital ahli kitab kuning dari aplikasi MUARA. Silakan tanyakan hal-hal keagamaan (fiqih, tasawuf, akidah, hadis, dll), saya akan merujuk langsung dari khazanah kitab-kitab salafiyah di dalam aplikasi MUARA saja.",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPremiumPromptOpen, setIsPremiumPromptOpen] = useState(false);
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [isBahtsulOpen, setIsBahtsulOpen] = useState(false);
  const [directProblemId, setDirectProblemId] = useState<string | null>(null);
  const [directProblemType, setDirectProblemType] = useState<string | null>(null);
  const [directCommentId, setDirectCommentId] = useState<string | null>(null);
  const [kitabCollection, setKitabCollection] = useState<any[]>([]);

  useEffect(() => {
    const handleBackButton = (e: any) => {
      if (isBahtsulOpen) {
        setIsBahtsulOpen(false);
        e.detail?.consume?.();
      } else if (isPremiumPromptOpen) {
        setIsPremiumPromptOpen(false);
        e.detail?.consume?.();
      } else if (isMenuDropdownOpen) {
        setIsMenuDropdownOpen(false);
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
  }, [isOpen, isBahtsulOpen, isPremiumPromptOpen, isMenuDropdownOpen]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const isPremiumUser = userProfile.isLoggedIn && (
    userProfile.membershipStatus === 'Premium Verified' || 
    (userProfile as any).isPremium === true ||
    userProfile.role === 'admin'
  );

  // Fetch fresh list of kitabs from firestore + local storage on-demand & live
  const fetchFreshKitabs = async () => {
    let list: any[] = [];
    try {
      const snap = await getDocs(collection(firestore, 'kitabs'));
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          title: data.title || '',
          author: data.author || '',
          sourceType: data.sourceType || 'text',
          pages: data.pages || [],
          textBody: data.textBody || '',
          chapters: []
        });
      });
    } catch (err) {
      console.warn('Santri AI RAG background loader skipped:', err);
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

    // Try local storage custom kitabs
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
              author: lk.author || '',
              sourceType: lk.sourceType || 'text',
              pages: lk.pages || [],
              textBody: lk.textBody || '',
              chapters: []
            });
          }
        });
      }
    } catch (e) {
      console.error(e);
    }

    // Deduplicate the merged kitab list by ID
    const seenMergedIds = new Set<string>();
    const merged: any[] = [];
    [...MOCK_KITABS, ...list].forEach(item => {
      if (item.id && !seenMergedIds.has(item.id)) {
        seenMergedIds.add(item.id);
        merged.push(item);
      }
    });
    setKitabCollection(merged);
    return merged;
  };

  // Keep state updated on mount
  useEffect(() => {
    fetchFreshKitabs();

    const handleOpenBahtsul = (event: Event) => {
      const customEvent = event as CustomEvent;
      const probId = customEvent.detail?.problemId;
      const actType = customEvent.detail?.type || 'comment';
      const commId = customEvent.detail?.commentId || null;

      setDirectProblemId(probId || null);
      setDirectProblemType(actType);
      setDirectCommentId(commId);
      setIsBahtsulOpen(true);
    };
    window.addEventListener('muara-open-bahtsul', handleOpenBahtsul);
    return () => {
      window.removeEventListener('muara-open-bahtsul', handleOpenBahtsul);
    };
  }, []);

  // Always scroll to bottom of chat
  useEffect(() => {
    if (isOpen && !isMinimized && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isLoading]);

  // Click on FAB to open chat
  const handleOpenClick = () => {
    if (!isPremiumUser) {
      setIsPremiumPromptOpen(true);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  // Perform Local Search & Build Context Prompt (RAG engine)
  const performRagSearch = (query: string, customCollection?: any[]): string => {
    const targetCollection = customCollection || kitabCollection;
    const stopwords = new Set([
      'dan', 'di', 'ke', 'dari', 'yang', 'adalah', 'ini', 'itu', 'saya', 'kamu', 'kita',
      'mereka', 'oleh', 'pada', 'atau', 'dengan', 'ada', 'bisa', 'akan', 'untuk', 'dalam',
      'tentang', 'bahwa', 'apa', 'bagaimana', 'mengapa', 'apakah', 'lah', 'kah', 'sih', 'kok', 'deh'
    ]);

    // Simple Indonesian stemming algorithm to retrieve root/base words
    const stemWord = (word: string): string => {
      let w = word.toLowerCase().trim();
      if (w.length <= 3) return w;

      // Remove prefix: mem-, men-, meny-, meng-, me-, ber-, di-, pe-, ter-
      if (w.startsWith('mem') && w.length > 5) w = w.substring(3);
      else if (w.startsWith('men') && w.length > 5) w = w.substring(3);
      else if (w.startsWith('meny') && w.length > 5) w = 's' + w.substring(4);
      else if (w.startsWith('meng') && w.length > 5) w = w.substring(4);
      else if (w.startsWith('me') && w.length > 4) w = w.substring(2);
      else if (w.startsWith('ber') && w.length > 5) w = w.substring(3);
      else if (w.startsWith('di') && w.length > 4) w = w.substring(2);
      else if (w.startsWith('pe') && w.length > 4) w = w.substring(2);
      else if (w.startsWith('ter') && w.length > 5) w = w.substring(3);
      else if (w.startsWith('se') && w.length > 4) w = w.substring(2);
      else if (w.startsWith('ke') && w.length > 4) w = w.substring(2);

      // Remove suffix: -nya, -kan, -an, -i, -lah, -kah
      if (w.endsWith('nya') && w.length > 5) w = w.substring(0, w.length - 3);
      if (w.endsWith('kan') && w.length > 5) w = w.substring(0, w.length - 3);
      if (w.endsWith('lah') && w.length > 5) w = w.substring(0, w.length - 3);
      if (w.endsWith('kah') && w.length > 5) w = w.substring(0, w.length - 3);
      if (w.endsWith('an') && w.length > 4) w = w.substring(0, w.length - 2);
      if (w.endsWith('i') && w.length > 3) w = w.substring(0, w.length - 1);
      
      return w;
    };

    // Split into keywords
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopwords.has(w));

    if (keywords.length === 0) return '';

    const wordStems = keywords.map(kw => ({
      original: kw,
      stemmed: stemWord(kw)
    }));

    const passages: RelevantPassage[] = [];

    targetCollection.forEach((kitab: any) => {
      // 1. Structured mock kitabs (with chapters and sections)
      if (Array.isArray(kitab.chapters) && kitab.chapters.length > 0) {
        kitab.chapters.forEach((ch: any, chIdx: number) => {
          if (Array.isArray(ch.sections)) {
            ch.sections.forEach((sec: any) => {
              const textToSearch = `${kitab.title} ${ch.title} ${sec.subTitle} ${sec.translatedText || ''} ${sec.explanation || ''}`.toLowerCase();
              let score = 0;
              let matchedCount = 0;

              wordStems.forEach(({ original, stemmed }) => {
                let matchType = 0; // 0 = none, 1 = stemmed match, 2 = exact match
                
                if (textToSearch.includes(original)) {
                  matchType = 2;
                } else if (stemmed !== original && textToSearch.includes(stemmed)) {
                  matchType = 1;
                }

                if (matchType > 0) {
                  matchedCount++;
                  // Base score
                  score += matchType === 2 ? 15 : 8;

                  // Frequency bonus
                  const searchPattern = matchType === 2 ? original : stemmed;
                  const regex = new RegExp(`\\b${searchPattern}\\b`, 'gi');
                  const count = (textToSearch.match(regex) || []).length;
                  score += count * (matchType === 2 ? 5 : 2);
                }
              });

              // Apply keyword density bonus (boost heavily if multiple words overlap in the same passage)
              if (matchedCount > 1) {
                score += matchedCount * 12;
              }

              if (score > 0) {
                passages.push({
                  kitabTitle: kitab.title,
                  author: kitab.author || 'Mufassir',
                  babName: ch.title || 'Bab Utama',
                  subName: sec.subTitle || 'Penjelasan',
                  content: `[Arab]: ${sec.arabicText || ''}\n[Terjemah]: ${sec.translatedText || ''}\n[Penjelasan]: ${sec.explanation || ''}`,
                  pageIdx: chIdx, // Chapter mapped to index
                  score: score
                });
              }
            });
          }
        });
      } 
      // 2. Text based kitabs (sourceType === 'text')
      else if (kitab.textBody) {
        const paragraphs = kitab.textBody.split('\n').map((p: string) => p.trim()).filter((p: string) => p.length > 10);
        paragraphs.forEach((para: string, paraIdx: number) => {
          const textToSearch = `${kitab.title} ${para}`.toLowerCase();
          let score = 0;
          let matchedCount = 0;

          wordStems.forEach(({ original, stemmed }) => {
            let matchType = 0;
            if (textToSearch.includes(original)) {
              matchType = 2;
            } else if (stemmed !== original && textToSearch.includes(stemmed)) {
              matchType = 1;
            }

            if (matchType > 0) {
              matchedCount++;
              score += matchType === 2 ? 15 : 8;
              const searchPattern = matchType === 2 ? original : stemmed;
              const count = (textToSearch.match(new RegExp(searchPattern, 'gi')) || []).length;
              score += count * (matchType === 2 ? 3 : 1);
            }
          });

          if (matchedCount > 1) {
            score += matchedCount * 10;
          }

          if (score > 0) {
            // Estimate virtual page number
            const charPosEstimate = paragraphs.slice(0, paraIdx).join('\n').length;
            const estimatedPageIdx = Math.floor(charPosEstimate / 1200);

            passages.push({
              kitabTitle: kitab.title,
              author: kitab.author || 'Anonim',
              babName: 'Pasal Utama',
              subName: `Paragraf ${paraIdx + 1}`,
              content: para,
              pageIdx: estimatedPageIdx,
              score: score
            });
          }
        });
      }
    });

    // Sort passages by score descending and take highest 6
    passages.sort((a, b) => b.score - a.score);
    const topPassages = passages.slice(0, 6);

    if (topPassages.length === 0) {
      return '';
    }

    // Build RAG formatted context
    let formattedContext = "=== ACUAN UTAMA DATASET MUARA ===\n";
    formattedContext += "Di bawah ini adalah kutipan resmi rujukan dari kitab kuning di Pustaka MUARA. Hubungkan data ini untuk merangkum jawaban Anda. Tuliskan perbandingannya jika ada di beberapa kitab bergantian:\n\n";
    
    topPassages.forEach((p, idx) => {
      const displayPageNum = p.pageIdx + 1;
      formattedContext += `--- KUTIPAN KE-${idx + 1} ---\n`;
      formattedContext += `Kitab Rujukan: ${p.kitabTitle}\n`;
      formattedContext += `Pengarang/Mushannif: ${p.author}\n`;
      formattedContext += `Halaman Buku: Halaman ${displayPageNum}\n`;
      formattedContext += `Bab/Pasal: ${p.babName} - ${p.subName}\n`;
      formattedContext += `Isi Teks:\n${p.content}\n`;
      formattedContext += `Saran Penulisan Referensi di Akhir Pembahasan Kitab Ini: [Buka: ${p.kitabTitle} - ${p.babName} - Halaman ${displayPageNum}]\n`;
      formattedContext += `------------------------------------\n\n`;
    });

    formattedContext += "=== SELESAI ACUAN UTAMA ===\n";
    formattedContext += "Ingat: Jika pertanyaan TIDAK terdapat sama sekali di dalam daftar kutipan di atas, Anda harus mematuhinya secara mutlak dan menjawab dengan jujur bahwa pustaka belum tersedia di Aplikasi MUARA.\n";

    return formattedContext;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setInputValue('');
    setIsLoading(true);

    // Append user message
    const userMsgId = 'user-' + Date.now();
    const newMessages = [...messages, {
      id: userMsgId,
      sender: 'user' as const,
      text: userText,
      timestamp: new Date()
    }];
    setMessages(newMessages);

    // --- SENSOR KATA KOTOR & AKHLAK MODERATION (Client-side fast feedback) ---
    const profanities = [
      'anjing', 'anjink', 'babi', 'bangsat', 'keparat', 'bajingan', 'kontol', 'memek', 'ngentot', 
      'tahi', 'peler', 'gigolo', 'jablay', 'goblok', 'tolol', 'bego', 'asu', 'dancok', 'jancok', 'jancuk',
      'anying', 'sia', 'bagong', 'monyet', 'jurig', 'kehed', 'belegug', 'gundal', 'raimu', 'matamu', 
      'mbokne', 'celeng', 'gatel', 'jaran', 'pekok'
    ];

    const hasProfanity = profanities.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(userText);
    });

    if (hasProfanity) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: 'moderated-' + Date.now(),
          sender: 'ai',
          text: "Astagfirullahal'adzim, yuk gunakan bahasa yang baik dan santun dalam menuntut ilmu, Kak. Semoga Allah memberkahi lisan kita. Silakan tanyakan kembali dengan tutur kata yang baik ya.",
          timestamp: new Date()
        }]);
        setIsLoading(false);
      }, 600);
      return;
    }

    try {
      // 1. Fetch fresh list of kitabs dynamically to support live admin additions instantly (Real-time update)
      const freshCollection = await fetchFreshKitabs();
      const latestKitabTitles = freshCollection.map((k: any) => k.title).filter(Boolean);

      // 2. Build context via RAG on the fresh list
      const ragContext = performRagSearch(userText, freshCollection);
      const combinedPrompt = ragContext 
        ? `${ragContext}\nPertanyaan Pengguna: ${userText}`
        : `Pertanyaan Pengguna: ${userText}\n\n(Catatan Sistem: Tidak ada kutipan kitab yang relevan ditemukan di sistem pustaka kami. Jawab dengan jujur bahwa pustaka belum tersedia di MUARA sesuai instruksi utama.)`;

      // 3. Prepare chat history in standard roles
      const messageHistory = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({
          role: m.sender === 'ai' ? 'model' as const : 'user' as const,
          parts: [{ text: m.text }]
        }));

      // 4. Request our full-stack Express API securely with dynamically updated context and retries
      let response: Response | null = null;
      let lastError: any = null;
      const targetUrl = getApiUrl('/api/gemini/santri-ai');
      
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1500;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[Santri AI Fetch] Menghubungi ${targetUrl} (Percobaan ${attempt}/${MAX_RETRIES})...`);
          response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt: combinedPrompt,
              history: messageHistory,
              latestKitabTitles: latestKitabTitles
            })
          });
          
          if (response.status === 503 && attempt < MAX_RETRIES) {
            console.warn(`[Santri AI Fetch] Mendapatkan status 503, mengulang dalam ${RETRY_DELAY_MS}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
          
          break;
        } catch (fetchErr: any) {
          lastError = fetchErr;
          console.warn(`[Santri AI Fetch] Kendala koneksi pada percobaan ${attempt}/${MAX_RETRIES}:`, fetchErr);
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }
      
      if (!response) {
        throw new Error("Koneksi ditolak. Server backend sedang offline atau belum di-restart.");
      }

      let resData;
      try {
        resData = await response.json();
      } catch (jsonErr: any) {
        throw new Error("Format respon server tidak valid (Unexpected end of JSON input). Hal ini terjadi karena Server belum di-restart setelah penambahan fitur Express, atau kunci GEMINI_API_KEY Anda belum dikonfigurasi.");
      }

      if (!response.ok) {
        const errorMsg = resData.error || "";
        if (response.status === 503 || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("503") || errorMsg.includes("high demand") || errorMsg.includes("temporary")) {
          throw new Error("maaf saat ini tidak bisa mengajukan pertanyaan silahkan coba lagi nanti");
        }
        throw new Error(resData.error || "Gagal menghubungi server Santri AI.");
      }

      // Append assistant answer
      setMessages(prev => [...prev, {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: resData.text || "Maaf, terjadi gangguan koneksi ke server asisten.",
        timestamp: new Date()
      }]);
    } catch (err: any) {
      console.error(err);
      const isJsonError = err.message.includes('JSON') || err.message.includes('JSON input');
      let explanation = err.message;

      if (err.message.includes("maaf saat ini tidak bisa mengajukan pertanyaan") || err.message.includes("high demand") || err.message.includes("UNAVAILABLE") || err.message.includes("503") || err.message.includes("temporary")) {
         explanation = "maaf saat ini tidak bisa mengajukan pertanyaan silahkan coba lagi nanti";
      } else if (isJsonError) {
        explanation = `**Gangguan Respon Server (Unexpected end of JSON input)**\n\nHal ini biasanya disebabkan oleh:\n1. **Kunci GEMINI_API_KEY belum dipasang**. Anda perlu menambahkannya di panel **Settings** AI Studio agar API Google Gemini dapat dipanggil di server backend.\n2. **Server belum aktif sepenuhnya**. Silakan beritahu asisten untuk me-restart server pembangunan agar rute Express terbaru aktif.`;
      }

      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        sender: 'ai',
        text: explanation,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Click on Interactive link source button inside chat bubble
  const handleReferenceClick = (kitabTitle: string, chapterDetail: string, pageIdx: number) => {
    // 1. Terminate or minimize AI chat modal
    setIsOpen(false);
    
    // 2. Notify the category search system to automatically highlight, load and open the requested book
    console.log(`[Santri AI Navigation] Dispatched muara-open-kitab event: "${kitabTitle}", page index: ${pageIdx}`);
    window.dispatchEvent(new CustomEvent('muara-open-kitab', {
      detail: {
        kitabTitle,
        chapterDetail,
        pageIdx
      }
    }));
  };

  // Message Bubble Parser (Renders Markdown text with clickable buttons)
  const renderMessageContent = (msg: Message) => {
    if (msg.sender === 'user') {
      return <p className="text-[#064e3b] text-xs sm:text-sm font-sans break-words">{msg.text}</p>;
    }

    // Markdown conversion (bold only for simplicity)
    const formattedText = msg.text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Parse specific link formatting: [Buka: Kitab Title - Bab/Section - Halaman Number]
    const regex = /\[Buka:\s*([^-]+?)\s*-\s*([^-]+?)\s*-\s*(?:Halaman\s*)?(\d+)\s*\]/gi;
    const segments = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(msg.text)) !== null) {
      // Push text segment before match
      if (match.index > lastIndex) {
        segments.push(
          <span 
            key={`text-${lastIndex}`}
            dangerouslySetInnerHTML={{ __html: formattedText.substring(lastIndex, match.index) }}
          />
        );
      }

      const fullMatchText = match[0];
      const kitabTitle = match[1].trim();
      const chapterDetail = match[2].trim();
      const pageNum = parseInt(match[3].trim(), 10);
      const pageIdx = pageNum > 0 ? pageNum - 1 : 0;

      // Render interactive button
      segments.push(
        <button
          key={`ref-btn-${match.index}`}
          onClick={() => handleReferenceClick(kitabTitle, chapterDetail, pageIdx)}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] sm:text-xs font-extrabold mx-1 my-1.5 shadow-3xs cursor-pointer select-auto transition-all duration-150 active:scale-95"
          style={{ userSelect: 'auto' }}
        >
          <BookOpen className="h-3.5 w-3.5 text-emerald-600 animate-pulse animate-duration-1000 shrink-0" />
          <span className="truncate max-w-[150px]">{kitabTitle} (Hal. {pageNum})</span>
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < msg.text.length) {
      segments.push(
        <span 
          key={`text-${lastIndex}`}
          dangerouslySetInnerHTML={{ __html: formattedText.substring(lastIndex) }}
        />
      );
    }

    return (
      <div className="text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-none font-sans">
        {segments.length > 0 ? segments : <span dangerouslySetInnerHTML={{ __html: formattedText }} />}
      </div>
    );
  };

  return (
    <>
      {/* -------------------- LUXURY MODAL DROPDOWN LIST -------------------- */}
      <AnimatePresence>
        {isMenuDropdownOpen && (
          <div className="fixed bottom-16 right-4 sm:bottom-22 sm:right-6 z-50 select-none">
            {/* Transparent click backdrop backdrop */}
            <div 
              className="fixed inset-0 bg-transparent z-0 cursor-default" 
              onClick={() => setIsMenuDropdownOpen(false)} 
            />
            
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative z-10 w-72 bg-[#064e3b] border border-emerald-700/60 rounded-2xl shadow-2xl p-4 space-y-3.5 overflow-hidden text-emerald-50"
            >
              {/* Premium Top Line Theme Indicator */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-yellow-400 to-amber-500" />
              
              {/* Dropdown Header */}
              <div className="flex items-center justify-between border-b border-emerald-800/50 pb-2">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Crown className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                  <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-amber-400">Khidmat Syariah MUARA</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsMenuDropdownOpen(false)}
                  className="text-emerald-100 hover:text-white transition-colors bg-transparent border-none p-1 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* LIST ITEMS */}
              <div className="space-y-2.5">
                {/* CHOICE 1: SANTRI AI */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuDropdownOpen(false);
                    if (!isPremiumUser) {
                      setIsPremiumPromptOpen(true);
                    } else {
                      setIsOpen(true);
                      setIsMinimized(false);
                    }
                  }}
                  className="w-full text-left bg-emerald-950/55 hover:bg-emerald-900/30 border border-emerald-800/50 hover:border-emerald-500/50 p-3 rounded-xl flex items-start gap-3 transition-colors cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-300 flex flex-col items-center justify-center border border-emerald-500/20 shadow-inner shrink-0 overflow-hidden">
                    {/* Handcrafted Kopiah Santri Icon Inside */}
                    <div className="w-3.5 h-1.5 bg-neutral-950 rounded-t-[1.5px] border border-neutral-800 z-10 -mb-[1px]" />
                    <div className="w-3 h-3 bg-amber-100 rounded-full border border-emerald-800/10 flex items-center justify-center overflow-hidden z-0">
                      <div className="w-1.5 h-0.5 border-b border-emerald-950/40 rounded-full mt-0.5" />
                    </div>
                    <div className="w-4 h-1 bg-emerald-50 border-t border-emerald-200 rounded-t-sm -mt-[1px] z-10" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-xs text-white">Santri AI</span>
                      <span className="bg-emerald-500/30 border border-emerald-500/25 text-emerald-300 text-[8px] font-bold font-mono px-1 py-0.5 rounded uppercase tracking-wider scale-90">PREMIUM</span>
                    </div>
                    <p className="text-[10px] text-emerald-200/90 mt-0.5 leading-snug">Rujukan mufashal literatur kitab kuning secara instan.</p>
                  </div>
                </button>

                {/* CHOICE 2: BAHTSUL MASAIL */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuDropdownOpen(false);
                    if (!isPremiumUser) {
                      setIsPremiumPromptOpen(true);
                    } else {
                      setIsBahtsulOpen(true);
                    }
                  }}
                  className="w-full text-left bg-emerald-950/55 hover:bg-emerald-900/30 border border-emerald-800/50 hover:border-emerald-500/50 p-3 rounded-xl flex items-start gap-3 transition-colors cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center p-1.5 border border-amber-500/20 shadow-inner shrink-0">
                    <Users className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-xs text-white">Bahtsul Masail</span>
                      <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[8px] font-bold font-mono px-1 py-0.5 rounded uppercase tracking-wider scale-90">PREMIUM</span>
                    </div>
                    <p className="text-[10px] text-emerald-200/90 mt-0.5 leading-snug">Musyawarah keabsahan hukum islam antar-anggota premium.</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- FLOATING SPARKLY ASSISTANT TRIGGER BUTTON -------------------- */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 select-none">
        <motion.button
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else if (isBahtsulOpen) {
              setIsBahtsulOpen(false);
            } else {
              setIsMenuDropdownOpen(!isMenuDropdownOpen);
            }
          }}
          className="relative h-11 w-11 sm:h-14 sm:w-14 rounded-full bg-gradient-to-tr from-emerald-800 via-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg cursor-pointer ring-4 ring-emerald-500/10 focus:outline-none border-none"
        >
          {/* Pulse ring indicating action state */}
          <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          
          {/* Modern directional arrow icon OR Close Indicator if active */}
          {isOpen || isBahtsulOpen ? (
            <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          ) : (
            <ArrowUpRight className="h-6 w-6 sm:h-7 sm:w-7 text-white animate-pulse" />
          )}
          
          {/* Tiny VIP Crown Floating Badge */}
          <span className="absolute -top-1 -right-1 bg-amber-500 border border-amber-300 text-[6px] sm:text-[8px] font-extrabold text-white px-1 py-0.5 rounded-full shadow-3xs flex items-center gap-0.5 font-sans scale-90">
            <Crown className="h-1.5 w-1.5 sm:h-2 sm:w-2" /> VIP
          </span>
        </motion.button>
      </div>

      {/* -------------------- PRE-CHECK CHAT GUARD (NON-PREMIUM POPUP) -------------------- */}
      <AnimatePresence>
        {isPremiumPromptOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl relative text-center overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500" />
              
              <button 
                type="button"
                onClick={() => setIsPremiumPromptOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer border-none bg-transparent"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-3 mt-2">
                <Crown className="h-6 w-6" />
              </div>

              <h3 className="font-extrabold text-slate-800 text-base">Fitur Khusus VIP Premium</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Layanan asisten pintar **Santri AI** dan **Forum Bahtsul Masail** dirancang khusus untuk riset syariah komprehensif bagi anggota premium terverifikasi.
              </p>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-left mt-4 text-[11px] text-slate-600 space-y-2">
                <div className="flex gap-2 items-start">
                  <FlameKindling className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                  <span>gabung bersama para member premium dalam menyelesaikan seluruh permasalah dengan sumber kitab yang jelas dan terintegrasi.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <MessageSquareQuote className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Kutipan teks arab beserta musyawarah santri luring-daring.</span>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPremiumPromptOpen(false);
                    onOpenUpgradeModal();
                  }}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs tracking-wide shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5 border-none"
                >
                  Langganan Premium Sekarang <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsPremiumPromptOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold text-xs cursor-pointer bg-white"
                >
                  Nanti Saja
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- INTERACTIVE EXPANDABLE CHAT DIALOGUE WINDOW -------------------- */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-45 flex flex-col justify-end p-0 sm:p-0">
            {/* Dark overlay backdrop for mobile screen sizing */}
            <div 
              className="fixed inset-0 bg-slate-900/15 backdrop-blur-2xs sm:hidden z-40"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="bg-white sm:rounded-3xl border border-slate-150 sm:shadow-2xl flex flex-col w-full h-[100dvh] sm:h-[550px] sm:w-[390px] relative z-50 overflow-hidden"
            >
              {/* HEADER BAR */}
              <div className="bg-gradient-to-r from-emerald-800 to-[#042f2e] text-white p-3 flex items-center justify-between select-none">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 relative border border-white/5 shadow-inner">
                    {/* Tiny Santri Header Icon */}
                    <div className="relative flex flex-col items-center justify-center h-6 w-6">
                      <div className="w-3.5 h-1.5 bg-neutral-900 rounded-t-[1.5px] border border-neutral-800 z-10 -mb-[1px]" />
                      <div className="w-3 h-3 bg-amber-100 rounded-full border border-emerald-800/10 flex items-center justify-center overflow-hidden z-0">
                        <div className="w-1.5 h-0.5 border-b border-emerald-950/40 rounded-full mt-0.5" />
                      </div>
                      <div className="w-4 h-1 bg-emerald-50 border-t border-emerald-200 rounded-t-sm -mt-[1px] z-10" />
                    </div>
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 border border-emerald-950" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm tracking-tight flex items-center gap-1.5 font-sans">
                      Santri AI
                      <span className="bg-amber-400/20 border border-amber-400/35 text-amber-300 text-[8px] px-1 py-0.5 rounded font-mono font-bold scale-95 uppercase">VIP</span>
                    </h4>
                    <p className="text-[9px] sm:text-[10px] text-emerald-200 font-sans">Asisten digital rujukan Kitab Kuning</p>
                  </div>
                </div>
                
                {/* WINDOW ACTION CONTROLS */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 transition-colors cursor-pointer border-none bg-transparent"
                    title="Minimize"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 transition-colors cursor-pointer border-none bg-transparent"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* MESSAGE AREA */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 shadow-3xs border ${
                        msg.sender === 'user'
                          ? 'bg-emerald-50 border-emerald-150 text-[#064e3b] rounded-tr-2xs'
                          : 'bg-white border-slate-150 text-slate-800 rounded-tl-2xs'
                      }`}
                    >
                      {renderMessageContent(msg)}
                      
                      {/* TIMESTAMP FOOTER */}
                      <span 
                        className={`text-[8px] font-semibold uppercase mt-1.5 block text-right select-none ${
                          msg.sender === 'user' ? 'text-emerald-600/60' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}

                {/* THINKING SPINNER INDICATOR */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-150 rounded-2xl rounded-tl-2xs p-3.5 shadow-3xs flex items-center gap-2.5 text-slate-500 text-xs sm:text-sm font-sans">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce animate-duration-1000" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce animate-duration-1000" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce animate-duration-1000" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="font-mono text-[10px] tracking-wide text-slate-400">Mutala'ah kitab kuning...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* PROMPT CHAT INPUT FORM */}
              <form 
                onSubmit={handleSendMessage}
                className="p-3 bg-white border-t border-slate-150 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isLoading}
                  placeholder="Tanyakan fiqih, zakat, adab dll..."
                  className="flex-1 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 transition-all font-sans"
                />
                
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className={`p-2.5 rounded-xl shrink-0 cursor-pointer shadow-3xs flex items-center justify-center transition-all border-none ${
                    inputValue.trim() && !isLoading
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed'
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- MINIMIZED FLOAT BAR (TAP TO RESUME OVERLAY) -------------------- */}
      <AnimatePresence>
        {isOpen && isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            onClick={() => setIsMinimized(false)}
            className="fixed bottom-6 right-24 z-45 bg-[#042f2e] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-800 cursor-pointer hover:bg-emerald-950 transition-colors select-none"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-xs font-sans">Sesi Chat Santri AI (Aktif)</span>
            <Maximize2 className="h-3.5 w-3.5 text-emerald-300 ml-1" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------- DYNAMIC MODALS AND OVERLAYS -------------------- */}
      <AnimatePresence>
        {isBahtsulOpen && (
          <BahtsulMasail
            userProfile={userProfile}
            isOpen={isBahtsulOpen}
            onClose={() => {
              setIsBahtsulOpen(false);
              setDirectProblemId(null);
              setDirectProblemType(null);
              setDirectCommentId(null);
            }}
            onOpenUpgradeModal={onOpenUpgradeModal}
            initialActiveProblemId={directProblemId || undefined}
            initialActiveProblemType={directProblemType || undefined}
            initialCommentId={directCommentId || undefined}
          />
        )}
      </AnimatePresence>
    </>
  );
}
