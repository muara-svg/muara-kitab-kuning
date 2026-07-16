import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle,
  Sparkles,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  MinusCircle,
  Save,
  FileText,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestore } from '../../lib/firebaseConfig';
import { indexedDbService } from '../../lib/indexedDbService';
import { 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  onSnapshot,
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from '../../lib/customFirestore';
import { uploadToCloudinaryDirect } from '../../lib/cloudinaryConfig';
import KitabTextEditor from './editors/KitabTextEditor';

export interface KitabItem {
  id: string;
  title: string;
  arabicTitle?: string;
  category: string;
  author: string;
  isPremium: boolean;
  createdAt?: any;
  coverUrl?: string;
  sourceType: 'file' | 'text';
  pages: string[];
  textBody?: string;
  jenisKitab?: 'terjemah' | 'matan' | 'arab';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  direction?: 'ltr' | 'rtl' | 'auto';
  fontSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  lineHeight?: 'normal' | 'relaxed' | 'loose';
}

interface AdminKitabProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  refreshTrigger?: boolean;
}

export default function AdminKitab({ onSuccess, onError, refreshTrigger }: AdminKitabProps) {
  const [kitabsList, setKitabsList] = useState<KitabItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingKitab, setLoadingKitab] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [isKitabModalOpen, setIsKitabModalOpen] = useState(false);
  const [isEditingKitabId, setIsEditingKitabId] = useState<string | null>(null);

  // Form states
  const [kitabTitle, setKitabTitle] = useState('');
  const [kitabArabicTitle, setKitabArabicTitle] = useState('');
  const [kitabCategory, setKitabCategory] = useState('');
  const [kitabAuthor, setKitabAuthor] = useState('');
  const [kitabIsPremium, setKitabIsPremium] = useState(false);
  const [kitabSourceType, setKitabSourceType] = useState<'file' | 'text'>('file');
  const [kitabTextBody, setKitabTextBody] = useState('');
  const [kitabJenis, setKitabJenis] = useState<'terjemah' | 'matan' | 'arab'>('terjemah');
  
  // Confirmation for delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState<string>('');

  // Attachments
  const [kitabCoverFile, setKitabCoverFile] = useState<File | null>(null);
  const [kitabCoverPreview, setKitabCoverPreview] = useState('');

  // Splicer indicators
  const [pdfProcessingStatus, setPdfProcessingStatus] = useState<string>('');
  const [pdfUploadPercentage, setPdfUploadPercentage] = useState(0);

  // Confirmation overlay state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Word Editor states
  const [kitabPages, setKitabPages] = useState<string[]>([]);
  const [isWordEditorOpen, setIsWordEditorOpen] = useState(false);
  const [editorTextAlign, setEditorTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('justify');
  const [editorDirection, setEditorDirection] = useState<'ltr' | 'rtl' | 'auto'>('auto');
  const [editorFontSize, setEditorFontSize] = useState<'sm' | 'base' | 'lg' | 'xl' | '2xl'>('lg');
  const [editorLineHeight, setEditorLineHeight] = useState<'normal' | 'relaxed' | 'loose'>('relaxed');

  const isArabicText = (text: string): boolean => {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  };

  const convertTextToPages = (text: string): string[] => {
    if (!text) return [];
    
    // Split by custom page delimiters if present
    const pdfMarkerRegex = /---\s*Halaman\s+\d+\s*---/i;
    if (pdfMarkerRegex.test(text)) {
      const splitParts = text.split(/---\s*Halaman\s+\d+\s*---/i);
      return splitParts
        .map(part => part.trim())
        .filter(part => part.length > 0);
    }

    // Group text paragraphs to around 1500 characters per page
    const paragraphs = text.split('\n');
    const resultChunks: string[] = [];
    let currentBlock = '';
    
    paragraphs.forEach((p) => {
      if ((currentBlock + '\n' + p).length > 1500) {
        if (currentBlock.trim()) {
          resultChunks.push(currentBlock.trim());
        }
        currentBlock = p;
      } else {
        currentBlock += (currentBlock ? '\n' : '') + p;
      }
    });

    if (currentBlock.trim()) {
      resultChunks.push(currentBlock.trim());
    }

    return resultChunks.length > 0 ? resultChunks : [text];
  };

  // Memuat data kategori dan kitab secara realtime melalui Cloud Firestore Cache Pipeline
  useEffect(() => {
    setLoadingKitab(true);
    let isMounted = true;

    // 1. Subscribe Realtime ke Koleksi Categories Cloud
    const unsubscribeCats = onSnapshot(collection(firestore, 'categories'), (snapshot) => {
      const list: { id: string; name: string; createdAt?: string }[] = [];
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
        list.push({ id: d.id, name: data.name || '', createdAt: createdStr });
      });

      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

      if (isMounted) {
        setCategories(list);
      }
    }, (e) => {
      console.error('Gagal realtime sync kategori di AdminKitab:', e);
    });

    // 2. Subscribe Realtime ke Koleksi Kitabs Cloud (Memicu download background otomatis untuk user offline)
    const qKitabs = query(collection(firestore, 'kitabs'), orderBy('createdAt', 'desc'));
    const unsubscribeKitabs = onSnapshot(qKitabs, (snapshot) => {
      const items: KitabItem[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        let createdStr = '';
        if (d.createdAt) {
          if (typeof d.createdAt === 'string') {
            createdStr = d.createdAt;
          } else if (d.createdAt.toDate) {
            createdStr = d.createdAt.toDate().toISOString();
          }
        } else {
          createdStr = new Date().toISOString();
        }
        items.push({
          id: docSnap.id,
          title: d.title || '',
          arabicTitle: d.arabicTitle || '',
          category: d.category || '',
          author: d.author || '',
          isPremium: d.isPremium || false,
          coverUrl: d.coverUrl || '',
          sourceType: d.sourceType || 'text',
          pages: d.pages || [],
          textBody: d.textBody || '',
          jenisKitab: d.jenisKitab || 'terjemah',
          textAlign: d.textAlign || 'justify',
          direction: d.direction || 'auto',
          fontSize: d.fontSize || 'lg',
          lineHeight: d.lineHeight || 'relaxed',
          createdAt: createdStr
        });
      });

      items.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

      if (isMounted) {
        setKitabsList(items);
        setLoadingKitab(false);
      }
    }, (e) => {
      console.error('Gagal realtime sync repo kitab:', e);
      if (isMounted) {
        setLoadingKitab(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeCats();
      unsubscribeKitabs();
    };
  }, [refreshTrigger]);

  // Dynamic asset loader for PDF and Word parsing in-browser
  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = () => reject(new Error('Gagal memuat pustaka parser PDF dari CDN.'));
      document.head.appendChild(script);
    });
  };

  const loadMammothJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).mammoth) {
        resolve((window as any).mammoth);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).mammoth);
      script.onerror = () => reject(new Error('Gagal memuat pustaka parser Word (Mammoth.js) dari CDN.'));
      document.head.appendChild(script);
    });
  };

  const compressImageLocal = (file: File, maxWidth = 300, quality = 0.6): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            }, 'image/jpeg', quality);
          } else {
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const parsePdfToText = async (file: File): Promise<{ textBody: string; pages: string[] }> => {
    setPdfProcessingStatus('Memuat mesin pembaca teks PDF...');
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    
    setPdfProcessingStatus('Membaca katalog fisik PDF dengan filter bahasa Arab...');
    // Menambahkan cMapUrl dan cMapPacked agar pdf.js dapat mendeteksi dan mendekode karakter Arab (RTL non-latin) secara sempurna
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true
    }).promise;
    const totalPages = pdf.numPages;
    
    const pages: string[] = [];
    let textBody = '';
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      setPdfProcessingStatus(`Mengekstrak teks halaman ${pageNum} dari ${totalPages}...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      
      // Group items by vertical position to preserve exact lines and spatial layout
      const lines: { [key: number]: any[] } = {};
      const threshold = 5; // tolerance for same-line elements
      
      items.forEach((item) => {
        if (!item.str || item.str.trim() === '') return;
        const y = item.transform[5];
        
        let foundLineY = Object.keys(lines).find(key => Math.abs(Number(key) - y) < threshold);
        if (foundLineY) {
          lines[Number(foundLineY)].push(item);
        } else {
          lines[y] = [item];
        }
      });
      
      // Sort lines top-to-bottom (descending y)
      const sortedY = Object.keys(lines)
         .map(Number)
         .sort((a, b) => b - a);
         
      const sortedLines = sortedY.map(y => {
        const lineItems = lines[y];
        
        // Cek secara cerdas apakah potongan teks pada baris ini mengandung karakter Arab/RTL
        const isLineRtl = lineItems.some(item => item.dir === 'rtl' || isArabicText(item.str));
        
        if (isLineRtl) {
          // Untuk tulisan Arab, urutkan dari Kanan ke Kiri (koordinat X mengecil / descending)
          lineItems.sort((a, b) => b.transform[4] - a.transform[4]);
        } else {
          // Untuk tulisan Latin, urutkan dari Kiri ke Kanan (koordinat X membesar / ascending)
          lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
        }
        
        return lineItems.map(item => item.str).join(' ');
      });
      
      const pageText = sortedLines.join('\n').trim();
      pages.push(pageText);
      textBody += (textBody ? '\n\n' : '') + pageText;
    }
    
    setPdfProcessingStatus(`Selesai! Mengekstrak ${totalPages} halaman.`);
    return { textBody, pages };
  };

  const parseDocxToText = async (file: File): Promise<{ textBody: string; pages: string[] }> => {
    setPdfProcessingStatus('Memuat mesin pembaca berkas Word...');
    const mammoth = await loadMammothJs();
    const arrayBuffer = await file.arrayBuffer();
    
    setPdfProcessingStatus('Mengonversi berkas Word (.docx) ke HTML...');
    // Map Word page breaks to explicit <br class="pagebreak" />
    const htmlResult = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: [
          "br[type='page'] => br.pagebreak"
        ]
      }
    );
    const htmlContent = htmlResult.value;
    
    setPdfProcessingStatus('Memproses halaman dokumen secara akurat...');
    const parser = new DOMParser();
    const docObj = parser.parseFromString(htmlContent, 'text/html');
    
    // Check if the document has explicit page breaks
    const hasPageBreaks = docObj.querySelector('br.pagebreak') !== null;
    const pages: string[] = [];
    
    if (hasPageBreaks) {
      // Traverse the DOM to separate text by the page break indicators
      let currentPageText = '';
      
      const traverseNodes = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.tagName === 'BR' && el.classList.contains('pagebreak')) {
            if (currentPageText.trim()) {
              pages.push(currentPageText.trim());
              currentPageText = '';
            }
            return;
          }
        }
        
        if (node.nodeType === Node.TEXT_NODE) {
          currentPageText += node.textContent || '';
        } else {
          const isBlock = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV'].includes((node as HTMLElement).tagName || '');
          if (isBlock && currentPageText.length > 0 && !currentPageText.endsWith('\n')) {
            currentPageText += '\n';
          }
          
          node.childNodes.forEach(traverseNodes);
          
          if (isBlock && currentPageText.length > 0 && !currentPageText.endsWith('\n')) {
            currentPageText += '\n';
          }
        }
      };
      
      docObj.body.childNodes.forEach(traverseNodes);
      
      if (currentPageText.trim()) {
        pages.push(currentPageText.trim());
      }
    } else {
      // If no explicit page breaks are found, preserve paragraphs but group logically to keep layouts aligned
      const paragraphs = Array.from(docObj.querySelectorAll('p, h1, h2, h3, h4, li'));
      let currentPageText = '';
      let currentWordCount = 0;
      const WORDS_PER_PAGE = 350; // Balanced size for typical A4/Legal page density
      
      paragraphs.forEach((p) => {
        const text = p.textContent?.trim() || '';
        if (!text) return;
        
        const words = text.split(/\s+/).filter(Boolean).length;
        
        if (currentWordCount + words > WORDS_PER_PAGE && currentPageText !== '') {
          pages.push(currentPageText.trim());
          currentPageText = text;
          currentWordCount = words;
        } else {
          currentPageText += (currentPageText ? '\n\n' : '') + text;
          currentWordCount += words;
        }
      });
      
      if (currentPageText.trim()) {
        pages.push(currentPageText.trim());
      }
    }
    
    const textBody = pages.join('\n\n');
    setPdfProcessingStatus('Konversi Word selesai!');
    return { textBody, pages };
  };

  const handleFileChangeForTextConversion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    setLoadingSubmit(true);
    setPdfProcessingStatus('Memulai pemrosesan berkas...');
    setPdfUploadPercentage(0);

    try {
      let result: { textBody: string; pages: string[] };
      if (extension === 'pdf') {
        result = await parsePdfToText(file);
      } else if (extension === 'docx' || extension === 'doc') {
        result = await parseDocxToText(file);
      } else {
        throw new Error('Format berkas tidak didukung. Unggah PDF atau Word (.docx).');
      }

      setKitabTextBody(result.textBody);
      setKitabPages(result.pages);

      // Auto detect Arabic content to set perfect defaults
      const isArabic = isArabicText(result.textBody);
      if (isArabic) {
        setEditorDirection('rtl');
        setEditorTextAlign('right');
        setEditorLineHeight('loose');
        setEditorFontSize('lg');
      } else {
        setEditorDirection('ltr');
        setEditorTextAlign('justify');
        setEditorLineHeight('relaxed');
        setEditorFontSize('base');
      }
      
      // Auto open word editor for immediate editing layout
      setIsWordEditorOpen(true);
      
      onSuccess(`Teks berkas berhasil dikonversi secara akurat sesuai halaman (${result.textBody.split(/\s+/).length} kata, terbagi dalam ${result.pages.length} halaman). Dialihkan langsung ke lembar edit teks.`);
    } catch (err: any) {
      console.error(err);
      onError(`Gagal mengonversi file: ${err.message}`);
    } finally {
      setLoadingSubmit(false);
      setPdfProcessingStatus('');
    }
  };

  const handleSubmitTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitabTitle.trim()) {
      onError('Harap isi judul kitab.');
      return;
    }
    if (!kitabCategory) {
      onError('Harap pilih kategori kitab.');
      return;
    }
    if (categories.length === 0) {
      onError('Kategori belum tersedia. Admin harus mengisi kategori baru terlebih dahulu.');
      return;
    }
    if (!kitabTextBody.trim()) {
      onError('Teks kitab atau lampiran file hasil ekstraksi kosong. Silakan unggah dokumen atau isi teks manual.');
      return;
    }

    setShowConfirmModal(true);
  };

  const executeSaveKitab = async () => {
    setShowConfirmModal(false);
    setLoadingSubmit(true);
    setPdfUploadPercentage(0);
    setPdfProcessingStatus('');

    let finalCoverUrl = kitabCoverPreview;
    
    // Use manually designed pages if available; else fallback to auto-split
    let finalPages = [...kitabPages];
    if (finalPages.length === 0 && kitabTextBody.trim()) {
      finalPages = convertTextToPages(kitabTextBody);
    }
    if (finalPages.length === 0) {
      finalPages = [kitabTextBody || 'Teks kosong atau kosong dalam proses.'];
    }

    try {
      if (kitabCoverFile) {
        setPdfProcessingStatus('Mengompresi gambar sampul s/d < 50KB...');
        const compressedFile = await compressImageLocal(kitabCoverFile);
        
        setPdfProcessingStatus('Mengunggah berkas sampul kitab ke Cloudinary...');
        finalCoverUrl = await uploadToCloudinaryDirect(compressedFile, {
          folder: 'muara_kitab_covers'
        });
      }

      setPdfProcessingStatus('Menyimpan perubahan metadata & teks lengkap ke Cloud...');
      const targetId = isEditingKitabId || `kitab-${Date.now()}`;
      const docRef = doc(firestore, 'kitabs', targetId);
      const contentRef = doc(firestore, 'kitab_contents', targetId);

      // Lightweight metadata to keep the query listings and sync fast
      const metadataPayload = {
        id: targetId,
        title: kitabTitle,
        arabicTitle: kitabArabicTitle || '',
        category: kitabCategory,
        author: kitabAuthor.trim() || 'Anonim',
        isPremium: kitabIsPremium,
        coverUrl: finalCoverUrl || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=300',
        sourceType: 'text',
        jenisKitab: kitabJenis,
        textAlign: editorTextAlign,
        direction: editorDirection,
        fontSize: editorFontSize,
        lineHeight: editorLineHeight,
        pages: [], // Keep empty in metadata to avoid Firestore 1MB limits
        textBody: '', // Keep empty in metadata to avoid Firestore 1MB limits
        createdAt: isEditingKitabId ? serverTimestamp() : new Date().toISOString(),
        adminBypassSecret: 'Santri255@'
      };

      // Determine size segmentation
      const PAGES_PER_CHUNK = 15;
      const totalPages = finalPages.length;
      
      let mainContentPayload: any = {};
      const chunkWrites: Promise<any>[] = [];
      let oldChunkCount = 0;

      // 1. Detect if old doc was segmented for cleanup
      try {
        const oldSnap = await getDoc(contentRef);
        if (oldSnap.exists()) {
          const oldData = oldSnap.data();
          if (oldData.isSegmented) {
            oldChunkCount = oldData.chunkCount || 0;
          }
        }
      } catch (e) {
        console.warn('Could not read old content info for cleanup:', e);
      }

      if (totalPages > PAGES_PER_CHUNK) {
        // Chunking/segmentation!
        const chunks: string[][] = [];
        for (let i = 0; i < totalPages; i += PAGES_PER_CHUNK) {
          chunks.push(finalPages.slice(i, i + PAGES_PER_CHUNK));
        }

        mainContentPayload = {
          id: targetId,
          isSegmented: true,
          chunkCount: chunks.length,
          totalPageCount: totalPages,
          pages: [], // Keep empty in the main document to ensure it remains well under 1MB
          textBody: '', // Keep empty in the main document to ensure it remains well under 1MB
          updatedAt: new Date().toISOString(),
          adminBypassSecret: 'Santri255@'
        };

        // Write chunk documents
        chunks.forEach((chunkPages, index) => {
          const chunkId = `${targetId}_chunk_${index}`;
          const chunkRef = doc(firestore, 'kitab_contents', chunkId);
          const chunkPayload = {
            id: chunkId,
            kitabId: targetId,
            chunkIndex: index,
            pages: chunkPages,
            updatedAt: new Date().toISOString(),
            adminBypassSecret: 'Santri255@'
          };
          chunkWrites.push(setDoc(chunkRef, chunkPayload, { merge: true }));
        });

        // Clean up any stale chunks if the new chunk count is less than the old chunk count
        if (oldChunkCount > chunks.length) {
          for (let i = chunks.length; i < oldChunkCount; i++) {
            const chunkId = `${targetId}_chunk_${i}`;
            chunkWrites.push(deleteDoc(doc(firestore, 'kitab_contents', chunkId)));
          }
        }
      } else {
        // Under threshold: Use single document (backward compatible)
        mainContentPayload = {
          id: targetId,
          isSegmented: false,
          chunkCount: 0,
          pages: finalPages,
          textBody: kitabTextBody,
          updatedAt: new Date().toISOString(),
          adminBypassSecret: 'Santri255@'
        };

        // Clean up all old chunk documents since the book is now unsegmented
        if (oldChunkCount > 0) {
          for (let i = 0; i < oldChunkCount; i++) {
            const chunkId = `${targetId}_chunk_${i}`;
            chunkWrites.push(deleteDoc(doc(firestore, 'kitab_contents', chunkId)));
          }
        }
      }

      // Optimize: Save metadata, main content, and any chunks concurrently!
      await Promise.all([
        setDoc(docRef, metadataPayload, { merge: true }),
        setDoc(contentRef, mainContentPayload, { merge: true }),
        ...chunkWrites
      ]);

      // Cache directly in IndexedDB for instantaneous offline sync on same/all clients
      try {
        const mergedCache = {
          ...metadataPayload,
          pages: finalPages,
          textBody: kitabTextBody,
          createdAt: new Date().toISOString()
        };
        await indexedDbService.saveKitab(mergedCache);
        console.log(`[IndexedDB Sync SUCCESS] Proactively cached "${kitabTitle}" to offline repository.`);
      } catch (cacheErr) {
        console.warn('Silent local caching warning:', cacheErr);
      }

      onSuccess(isEditingKitabId ? 'Metadata Kitab berhasil dikoreksi.' : 'Kitab baru sukses didaftarkan.');
      
      // Reset Form States
      setKitabTitle('');
      setKitabArabicTitle('');
      setKitabCategory('');
      setKitabAuthor('');
      setKitabIsPremium(false);
      setKitabSourceType('file');
      setKitabTextBody('');
      setKitabPages([]);
      setKitabJenis('terjemah');
      setEditorTextAlign('justify');
      setEditorDirection('auto');
      setEditorFontSize('lg');
      setEditorLineHeight('relaxed');
      setKitabCoverFile(null);
      setKitabCoverPreview('');
      setIsEditingKitabId(null);
      setIsKitabModalOpen(false);

    } catch (err: any) {
      console.error(err);
      onError(`Kendala saat menyimpan kitab: ${err.message}`);
    } finally {
      setLoadingSubmit(false);
      setPdfProcessingStatus('');
    }
  };

  const handleInitializeEditKitab = async (kitab: KitabItem) => {
    setIsEditingKitabId(kitab.id);
    setKitabTitle(kitab.title);
    setKitabArabicTitle(kitab.arabicTitle || '');
    setKitabCategory(kitab.category);
    setKitabAuthor(kitab.author);
    setKitabIsPremium(kitab.isPremium);
    setKitabSourceType('text');
    setKitabCoverPreview(kitab.coverUrl || '');
    setKitabCoverFile(null);
    setKitabJenis(kitab.jenisKitab || 'terjemah');
    setEditorTextAlign(kitab.textAlign || 'justify');
    setEditorDirection(kitab.direction || 'auto');
    setEditorFontSize(kitab.fontSize || 'lg');
    setEditorLineHeight(kitab.lineHeight || 'relaxed');
    setPdfUploadPercentage(0);
    setPdfProcessingStatus('Memuat detail teks kitab...');
    setIsKitabModalOpen(true);

    // Pre-emptively load from local IndexedDB cache if available
    try {
      const localData = await indexedDbService.getKitab(kitab.id);
      if (localData && (localData.textBody || (localData.pages && localData.pages.length > 0))) {
        setKitabTextBody(localData.textBody || (localData.pages ? localData.pages.join('\n\n') : ''));
        setKitabPages(localData.pages || []);
        setPdfProcessingStatus('');
        return;
      }
    } catch (localCheckErr) {
      console.warn('[AdminKitab Cache Check] Gagal memeriksa IndexedDB cache:', localCheckErr);
    }

    try {
      const contentSnap = await getDoc(doc(firestore, 'kitab_contents', kitab.id));
      if (contentSnap.exists()) {
        const cData = contentSnap.data();
        if (cData.isSegmented) {
          const chunkCount = cData.chunkCount || 0;
          const chunkPromises = [];
          for (let i = 0; i < chunkCount; i++) {
            chunkPromises.push(getDoc(doc(firestore, 'kitab_contents', `${kitab.id}_chunk_${i}`)));
          }
          const chunkSnaps = await Promise.all(chunkPromises);
          let allPages: string[] = [];
          for (const snap of chunkSnaps) {
            if (snap.exists()) {
              allPages = allPages.concat(snap.data().pages || []);
            }
          }
          const fullText = allPages.join('\n\n');
          setKitabTextBody(fullText);
          setKitabPages(allPages);
        } else {
          setKitabTextBody(cData.textBody || '');
          setKitabPages(cData.pages || []);
        }
      } else {
        const fallbackText = kitab.textBody || (kitab.pages ? kitab.pages.join('\n\n') : '');
        setKitabTextBody(fallbackText);
        setKitabPages(kitab.pages || (fallbackText ? convertTextToPages(fallbackText) : []));
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.toLowerCase().includes('offline') || err?.code === 'unavailable') {
        console.warn("[AdminKitab Offline Catch] Perangkat luring atau koneksi terputus saat memuat isi teks:", errMsg);
      } else {
        console.error('Gagal mengambil isi teks kitab:', err);
      }
      const fallbackText = kitab.textBody || (kitab.pages ? kitab.pages.join('\n\n') : '');
      setKitabTextBody(fallbackText);
      setKitabPages(kitab.pages || (fallbackText ? convertTextToPages(fallbackText) : []));
    } finally {
      setPdfProcessingStatus('');
    }
  };

  const initiateDeleteKitab = (id: string, title: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmTitle(title);
  };

  const executeDeleteKitab = async () => {
    if (!deleteConfirmId) return;
    const targetId = deleteConfirmId;
    setDeleteConfirmId(null);
    setDeleteConfirmTitle('');
    setLoadingSubmit(true);
    
    try {
      await deleteDoc(doc(firestore, 'kitabs', targetId));
      
      // Look up if old document was segmented to clean up chunks
      let chunkCount = 0;
      try {
        const contentSnap = await getDoc(doc(firestore, 'kitab_contents', targetId));
        if (contentSnap.exists()) {
          const cData = contentSnap.data();
          if (cData.isSegmented) {
            chunkCount = cData.chunkCount || 0;
          }
        }
      } catch (snapErr) {
        console.warn('Gagal membaca info chunk saat menghapus kitab:', snapErr);
      }

      const deleteOperations: Promise<any>[] = [];
      deleteOperations.push(deleteDoc(doc(firestore, 'kitab_contents', targetId)));

      if (chunkCount > 0) {
        for (let i = 0; i < chunkCount; i++) {
          deleteOperations.push(deleteDoc(doc(firestore, 'kitab_contents', `${targetId}_chunk_${i}`)));
        }
      }

      try {
        await Promise.all(deleteOperations);
      } catch (contentErr) {
        console.warn('Gagal menghapus content / chunk kitab dari Cloud:', contentErr);
      }
      onSuccess('Kitab berhasil dihapus dari repositori.');
    } catch (err: any) {
      console.error('Gagal menghapus kitab dari Firestore cloud:', err);
      onError(`Gagal menghapus dokumen kitab: ${err.message}`);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="font-extrabold text-[#064e3b] text-base">
            Pusat Repositori Kitab Kuning
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Daftarkan manuskrip, hadis, fadhilah, serta unggah PDF otomatis</p>
        </div>

        <button
          onClick={() => {
            setIsEditingKitabId(null);
            setKitabTitle('');
            setKitabArabicTitle('');
            setKitabCategory('');
            setKitabAuthor('');
            setKitabIsPremium(false);
            setKitabSourceType('file');
            setKitabTextBody('');
            setKitabJenis('terjemah');
            setKitabCoverFile(null);
            setKitabCoverPreview('');
            setPdfUploadPercentage(0);
            setPdfProcessingStatus('');
            setIsKitabModalOpen(true);
          }}
          className="flex items-center gap-1 bg-[#064e3b] hover:bg-emerald-805 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Tambah Kitab Baru
        </button>
      </div>

      {loadingKitab ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
          <p className="text-[11px] font-mono text-slate-400">Menghubungi Repositori Kitab...</p>
        </div>
      ) : kitabsList.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-205 rounded-2xl text-slate-400">
          <BookOpen className="h-10 w-10 mx-auto opacity-30 mb-2 text-emerald-600" />
          <p className="text-xs font-semibold text-slate-500">kitab belum tersedia jika admin belum menambahkan kitab baru</p>
          <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1">Gunakan tombol "Tambah Kitab Baru" di atas untuk mendaftarkan kitab.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-650 font-mono text-[10px]">
                <th className="p-3">Sampul</th>
                <th className="p-3">Judul Kitab / Pengarang</th>
                <th className="p-3">Kategori & Tipe</th>
                <th className="p-3">Akses VIP</th>
                <th className="p-3 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {kitabsList.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3">
                    <img 
                      src={item.coverUrl} 
                      alt={item.title} 
                      className="h-12 w-10 object-cover rounded-md border border-slate-200 shadow-3xs"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=150';
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      {item.title} {item.arabicTitle && <span className="text-slate-400 font-normal">({item.arabicTitle})</span>}
                    </p>
                    <p className="text-[10px] text-slate-450 mt-0.5">Oleh: {item.author}</p>
                  </td>
                  <td className="p-3">
                    <span className="bg-emerald-50 text-[#064e3b] px-2 py-0.5 rounded-md font-semibold text-[9.5px]">
                      {item.category}
                    </span>
                    <span className="ml-1.5 text-[9px] text-slate-400">
                      • {item.textBody ? `${item.textBody.split(/\s+/).length} Kata` : 'Teks Manual'}
                    </span>
                  </td>
                  <td className="p-3">
                    {item.isPremium ? (
                      <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[9px] flex items-center gap-0.5 w-fit">
                        <Sparkles className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Premium VIP
                      </span>
                    ) : (
                      <span className="text-slate-400 px-2 py-0.5 text-[9px]">Gratis Umum</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleInitializeEditKitab(item)}
                        className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-650 hover:text-[#064e3b] hover:bg-emerald-50 transition-colors flex items-center gap-0.5 cursor-pointer"
                      >
                        <Edit2 className="h-3 w-3" /> <span className="text-[10px] font-bold">Edit</span>
                      </button>
                      <button
                        onClick={() => initiateDeleteKitab(item.id, item.title)}
                        className="p-1 px-2.5 rounded-lg border border-red-100 text-red-650 hover:bg-red-50 transition-colors flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> <span className="text-[10px] font-bold">Hapus</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL WINDOW SYSTEM: FILE DAN METADATA KITAB */}
      {isKitabModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-205 w-full max-w-lg overflow-hidden shadow-2xl my-8">
            
            <div className="bg-[#064e3b] text-white p-4 font-bold flex items-center justify-between border-b pb-3.5">
              <h4 className="text-sm font-extrabold flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> 
                {isEditingKitabId ? 'Koreksi Data Manuskrip' : 'Registrasi Buku & Kitab Kuning'}
              </h4>
              <button
                onClick={() => setIsKitabModalOpen(false)}
                className="text-white hover:text-emerald-350 text-xs font-mono font-bold font-sans cursor-pointer"
              >
                [ Tutup ]
              </button>
            </div>

            <form onSubmit={handleSubmitTrigger} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto font-sans">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono">1. Nama Kitab (Indonesia)</label>
                  <input
                    type="text"
                    required
                    value={kitabTitle}
                    onChange={(e) => setKitabTitle(e.target.value)}
                    placeholder="Contoh: Riyadhus Shalihin"
                    className="w-full border p-2 rounded-xl text-slate-850"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono">2. Nama Arab (Opsional)</label>
                  <input
                    type="text"
                    value={kitabArabicTitle}
                    onChange={(e) => setKitabArabicTitle(e.target.value)}
                    placeholder="Contoh: رياض الصالحين"
                    className="w-full border p-2 rounded-xl text-right text-slate-850"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono">3. Penulis / Mushannif (Opsional)</label>
                  <input
                    type="text"
                    value={kitabAuthor}
                    onChange={(e) => setKitabAuthor(e.target.value)}
                    placeholder="Contoh: Imam An-Nawawi"
                    className="w-full border p-2 rounded-xl text-slate-850"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono">4. Kategori Kitab (Dinamis)</label>
                  <select
                    required
                    value={kitabCategory}
                    onChange={(e) => setKitabCategory(e.target.value)}
                    className="w-full border p-2 rounded-xl bg-white text-slate-850"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.length === 0 ? (
                      <option value="" disabled>⚠️ kategori belum tersedia</option>
                    ) : (
                      categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    )}
                  </select>
                  {categories.length === 0 && (
                    <p className="text-[9px] text-red-500 font-bold mt-1">⚠️ kategori belum tersedia</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono">5. Jenis Kitab</label>
                  <select
                    value={kitabJenis}
                    onChange={(e) => setKitabJenis(e.target.value as 'terjemah' | 'matan' | 'arab')}
                    className="w-full border p-2 rounded-xl bg-white text-slate-850"
                  >
                    <option value="terjemah">Terjemah</option>
                    <option value="matan">Matan</option>
                    <option value="arab">Arab</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono">6. Jenis Kepemilikan Akses</label>
                  <select
                    value={kitabIsPremium ? 'true' : 'false'}
                    onChange={(e) => setKitabIsPremium(e.target.value === 'true')}
                    className="w-full border p-2 rounded-xl bg-white text-slate-850"
                  >
                    <option value="false">Gratis untuk Umum</option>
                    <option value="true">Premium VIP Member</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[9px] mb-1 font-mono">7. Sumber Data Kitab</label>
                  <select
                    value={kitabSourceType}
                    onChange={(e) => setKitabSourceType(e.target.value as 'file' | 'text')}
                    className="w-full border p-2 rounded-xl bg-white text-slate-850"
                  >
                    <option value="file">Lampiran File (PDF, Word)</option>
                    <option value="text">Teks Utama / Manual</option>
                  </select>
                </div>
              </div>

              {/* COVER SECTION */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 uppercase text-[9px] font-mono">7. Sampul Rekomendasi (Gambar)</label>
                <div className="flex items-center gap-4">
                  {kitabCoverPreview && (
                    <img src={kitabCoverPreview} alt="Cover Preview" className="h-16 w-12 object-cover rounded border" referrerPolicy="no-referrer" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setKitabCoverFile(e.target.files[0]);
                        setKitabCoverPreview(URL.createObjectURL(e.target.files[0]));
                      }
                    }}
                    className="w-full border p-1 rounded-xl text-[11px]"
                  />
                </div>
              </div>

              {/* DYNAMIC BASED ON SOURCE TYPE */}
              {kitabSourceType === 'file' ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-2">
                  <label className="block font-bold text-slate-700 uppercase text-[9px] font-mono">8. Upload Dokumen PDF / DOCX Anda</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileChangeForTextConversion}
                    className="w-full border p-1.5 rounded-xl bg-white text-xs text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400">Pustaka pdf.js & Mammoth otomatis mengekstrak seluruh halaman/paragraf menjadi teks secara realtime tanpa batas ribuan kata.</p>
                  
                  {kitabTextBody.trim().length > 0 && (
                    <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-emerald-800 uppercase text-[9px] font-mono">Hasil Konversi Dokumen:</label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsWordEditorOpen(true);
                          }}
                          className="flex items-center gap-1 bg-[#064e3b] text-white px-2 py-1 rounded-lg font-bold hover:bg-emerald-900 transition-all text-[9.5px] cursor-pointer mb-0.5 shadow-2xs"
                        >
                          <Edit2 className="h-2.5 w-2.5" /> Edit Teks
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        readOnly
                        value={kitabTextBody}
                        placeholder="Hasil teks akan dirender di sini..."
                        className="w-full border p-2.5 rounded-xl text-slate-800 font-mono text-[10px] bg-slate-100 leading-relaxed cursor-not-allowed select-all"
                        title="Teks hasil konversi file (Gunakan tombol 'Edit Teks' di atas untuk menyunting per halaman)"
                      />
                      <p className="text-[9.5px] text-emerald-700 font-bold">✓ Berkas berhasil dikodekan. Klik tombol <span className="underline">Edit Teks</span> di atas untuk menyesuaikan, memilah, atau merapikan kata per halaman secara visual.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-[#064e3b] uppercase text-[9px] font-mono font-sans">8. Teks Utama / Manual (Ketik Bab)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsWordEditorOpen(true);
                      }}
                      className="flex items-center gap-1 bg-[#064e3b] text-white px-2 py-1 rounded-lg font-bold hover:bg-emerald-900 transition-all text-[9.5px] cursor-pointer mb-0.5 shadow-2xs"
                    >
                      <Edit2 className="h-2.5 w-2.5" /> Edit Teks
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    required
                    value={kitabTextBody}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKitabTextBody(val);
                      setKitabPages(convertTextToPages(val));
                    }}
                    placeholder="Tempel atau ketik naskah kitab kuning lengkap ribuan kalimat di sini..."
                    className="w-full border p-2 rounded-xl text-slate-800 font-mono text-[10.5px] leading-relaxed"
                  />
                </div>
              )}

              {/* PROCESS STATUS SPLITTING PDF */}
              {pdfProcessingStatus && (
                <div className="p-3 bg-slate-100 text-[#064e3b] rounded-xl border border-emerald-100 font-mono text-[10px] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                    <span className="font-bold uppercase">Proses Pemecahan PDF:</span>
                  </div>
                  <p className="text-slate-600 italic">{pdfProcessingStatus}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loadingSubmit}
                className="w-full flex items-center justify-center gap-1 py-3 px-4 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-750 transition-all cursor-pointer disabled:opacity-50 text-xs shadow-xs"
              >
                {loadingSubmit ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Simpan & Daftarkan Kitab
              </button>

            </form>

          </div>
        </div>
      )}

      {/* WORD EDITOR FULLSCREEN MODAL */}
      <KitabTextEditor
        isOpen={isWordEditorOpen}
        onClose={() => setIsWordEditorOpen(false)}
        kitabTitle={kitabTitle}
        kitabJenis={kitabJenis}
        initialPages={kitabPages}
        initialTextBody={kitabTextBody}
        initialTextAlign={editorTextAlign}
        initialDirection={editorDirection}
        initialFontSize={editorFontSize}
        initialLineHeight={editorLineHeight}
        onSave={(pages, textBody, styles) => {
          setKitabPages(pages);
          setKitabTextBody(textBody);
          if (styles) {
            setEditorTextAlign(styles.textAlign);
            setEditorDirection(styles.direction);
            setEditorFontSize(styles.fontSize);
            setEditorLineHeight(styles.lineHeight);
          }
          setIsWordEditorOpen(false);
        }}
        onSuccessMessage={(msg) => onSuccess(msg)}
      />

      {/* DIALOG KONFIRMASI KUSTOM SEBELUM MENYIMPAN */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-205 w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 text-center font-sans">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 border border-emerald-250 flex items-center justify-center text-emerald-600 shadow-inner">
                <BookOpen className="h-6 w-6" />
              </div>
              
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-800 text-sm">Konfirmasi Penyimpanan</h4>
                <p className="text-[11px] text-slate-505 leading-relaxed">
                  Apakah Anda benar-benar yakin ingin mendaftarkan atau merubah data kitab <strong>"{kitabTitle}"</strong> ini ke cloud database?
                </p>
              </div>

              <div className="p-3 bg-slate-50/80 rounded-xl text-left border border-slate-150 text-[10px] space-y-1 text-slate-650 font-mono">
                <p>• <strong>Judul:</strong> {kitabTitle} {kitabArabicTitle ? `(${kitabArabicTitle})` : ''}</p>
                <p>• <strong>Kategori:</strong> {kitabCategory}</p>
                <p>• <strong>Jenis:</strong> {kitabJenis.toUpperCase()}</p>
                <p>• <strong>Akses:</strong> {kitabIsPremium ? '💎 Premium VIP' : '🆓 Gratis Umum'}</p>
                <p>• <strong>Karakter Teks:</strong> {kitabTextBody.length.toLocaleString()} karakter (~{kitabTextBody.split(/\s+/).length} kata)</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loadingSubmit}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-250 hover:bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={loadingSubmit}
                  onClick={executeSaveKitab}
                  className="flex-1 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                >
                  {loadingSubmit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ya, Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG KONFIRMASI KUSTOM UNTUK MENGHAPUS KITAB */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-205 w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 text-center font-sans">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-650 shadow-inner">
                <Trash2 className="h-6 w-6" />
              </div>
              
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-800 text-sm">Konfirmasi Menghapus</h4>
                <p className="text-[11px] text-slate-505 leading-relaxed">
                  Apakah Anda benar-benar yakin ingin menghapus kitab <strong>"{deleteConfirmTitle}"</strong> secara permanen dari Cloud database dan local storage? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loadingSubmit}
                  onClick={() => {
                    setDeleteConfirmId(null);
                    setDeleteConfirmTitle('');
                  }}
                  className="flex-1 py-2 rounded-xl border border-slate-250 hover:bg-slate-100 text-slate-650 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={loadingSubmit}
                  onClick={executeDeleteKitab}
                  className="flex-1 py-2 rounded-xl bg-red-650 hover:bg-red-750 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                >
                  {loadingSubmit ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}