import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestore } from '../../lib/firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot,
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { uploadToCloudinaryDirect } from '../../lib/cloudinaryConfig';

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

  const parsePdfToText = async (file: File): Promise<string> => {
    setPdfProcessingStatus('Memuat mesin pembaca teks PDF...');
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    
    setPdfProcessingStatus('Membaca katalog fisik PDF...');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    
    let compiledText = '';
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      setPdfProcessingStatus(`Mengekstrak teks halaman ${pageNum} dari ${totalPages}...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      compiledText += `\n\n--- Halaman ${pageNum} ---\n\n` + pageText;
    }
    
    setPdfProcessingStatus(`Selesai! Mengekstrak ${totalPages} halaman.`);
    return compiledText.trim();
  };

  const parseDocxToText = async (file: File): Promise<string> => {
    setPdfProcessingStatus('Memuat mesin pembaca berkas Word...');
    const mammoth = await loadMammothJs();
    const arrayBuffer = await file.arrayBuffer();
    
    setPdfProcessingStatus('Mengonversi berkas Word (.docx) ke teks...');
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    setPdfProcessingStatus('Konversi Word selesai!');
    return result.value.trim();
  };

  const handleFileChangeForTextConversion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    setLoadingSubmit(true);
    setPdfProcessingStatus('Memulai pemrosesan berkas...');
    setPdfUploadPercentage(0);

    try {
      let resultText = '';
      if (extension === 'pdf') {
        resultText = await parsePdfToText(file);
      } else if (extension === 'docx') {
        resultText = await parseDocxToText(file);
      } else {
        throw new Error('Format berkas tidak didukung. Unggah PDF atau Word (.docx).');
      }

      setKitabTextBody(resultText);
      onSuccess(`Teks berkas berhasil diimpor (${resultText.split(/\s+/).length} kata). Silakan periksa di kotak teks.`);
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
    const finalPages = kitabTextBody.split(/\n\s*\n/).filter(line => line.trim().length > 0);

    try {
      if (kitabCoverFile) {
        setPdfProcessingStatus('Mengompresi gambar sampul s/d < 50KB...');
        const compressedFile = await compressImageLocal(kitabCoverFile);
        
        setPdfProcessingStatus('Mengunggah berkas sampul kitab ke Cloudinary...');
        finalCoverUrl = await uploadToCloudinaryDirect(compressedFile, {
          folder: 'muara_kitab_covers'
        });
      }

      const targetId = isEditingKitabId || `kitab-${Date.now()}`;
      const docRef = doc(firestore, 'kitabs', targetId);

      const payload = {
        id: targetId,
        title: kitabTitle,
        arabicTitle: kitabArabicTitle || '',
        category: kitabCategory,
        author: kitabAuthor.trim() || 'Anonim',
        isPremium: kitabIsPremium,
        coverUrl: finalCoverUrl || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=300',
        sourceType: 'text',
        pages: finalPages,
        textBody: kitabTextBody,
        jenisKitab: kitabJenis,
        createdAt: isEditingKitabId ? serverTimestamp() : new Date().toISOString()
      };

      // Murni dilempar ke Cloud Firestore, Sinkronisasi cache offline ditangani penuh oleh SDK Firebase Auth & Database
      await setDoc(docRef, payload, { merge: true });

      onSuccess(isEditingKitabId ? 'Metadata Kitab berhasil dikoreksi.' : 'Kitab baru sukses didaftarkan.');
      
      // Reset Form States
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

  const handleInitializeEditKitab = (kitab: KitabItem) => {
    setIsEditingKitabId(kitab.id);
    setKitabTitle(kitab.title);
    setKitabArabicTitle(kitab.arabicTitle || '');
    setKitabCategory(kitab.category);
    setKitabAuthor(kitab.author);
    setKitabIsPremium(kitab.isPremium);
    setKitabSourceType('text');
    setKitabTextBody(kitab.textBody || (kitab.pages ? kitab.pages.join('\n\n') : ''));
    setKitabCoverPreview(kitab.coverUrl || '');
    setKitabCoverFile(null);
    setKitabJenis(kitab.jenisKitab || 'terjemah');
    setPdfUploadPercentage(0);
    setPdfProcessingStatus('');
    setIsKitabModalOpen(true);
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
                      <label className="block font-bold text-emerald-800 uppercase text-[9px] font-mono">Hasil Konversi Dokumen (Dapat diedit):</label>
                      <textarea
                        rows={6}
                        value={kitabTextBody}
                        onChange={(e) => setKitabTextBody(e.target.value)}
                        placeholder="Hasil teks akan dirender di sini..."
                        className="w-full border p-2 rounded-xl text-slate-800 font-mono text-[10px] bg-white leading-relaxed"
                      />
                      <p className="text-[9.5px] text-emerald-600 font-bold">✓ Berkas berhasil dikodekan ke dalam memori. Anda bisa merapikan format teks sebelum menyimpan.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block font-bold text-[#064e3b] uppercase text-[9px] font-mono">8. Salinan Kitab / Teks Manual (Ketik Bab)</label>
                  <textarea
                    rows={6}
                    required
                    value={kitabTextBody}
                    onChange={(e) => setKitabTextBody(e.target.value)}
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