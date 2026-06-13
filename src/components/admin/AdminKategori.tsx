import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Plus, 
  Edit2, 
  Trash2, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestore } from '../../lib/firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot,
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { uploadToCloudinaryDirect } from '../../lib/cloudinaryConfig';
import { compressImage } from '../../lib/authService';

export interface CategoryItem {
  id: string;
  name: string;
  imageUrl: string;
  createdAt?: any;
}

interface AdminKategoriProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  refreshTrigger?: boolean;
}

export default function AdminKategori({ onSuccess, onError, refreshTrigger }: AdminKategoriProps) {
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  
  // Custom confirmation modal state
  const [categoryToConfirm, setCategoryToConfirm] = useState<{
    name: string;
    imageUrl: string;
    isEditingId: string | null;
  } | null>(null);
  
  // Form input states
  const [catNameInput, setCatNameInput] = useState('');
  const [catImageFile, setCatImageFile] = useState<File | null>(null);
  const [catImagePath, setCatImagePath] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  useEffect(() => {
    setLoadingCat(true);
    let isMounted = true;

    const q = query(collection(firestore, 'categories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: CategoryItem[] = [];
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
          name: d.name || '',
          imageUrl: d.imageUrl || '',
          createdAt: createdStr
        });
      });

      // Load local storage custom categories too
      try {
        const localCatsStr = localStorage.getItem('muara_custom_categories');
        if (localCatsStr) {
          const localCats = JSON.parse(localCatsStr);
          const existingIds = new Set(items.map(c => c.id));
          localCats.forEach((lc: any) => {
            if (!existingIds.has(lc.id)) {
              items.push(lc);
            }
          });
        }
      } catch (localErr) {
        console.warn('Gagal memuat kategori lokal:', localErr);
      }

      // Sort descending by createdAt
      items.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      
      if (isMounted) {
        setCategoriesList(items);
        setLoadingCat(false);
      }
    }, (error) => {
      console.warn('Gagal realtime sync kategori:', error);
      let fallbackItems: CategoryItem[] = [];
      try {
        const localCatsStr = localStorage.getItem('muara_custom_categories');
        if (localCatsStr) {
          fallbackItems = JSON.parse(localCatsStr);
        }
      } catch (e) {
        console.warn('Gagal load localStorage fallback:', e);
      }
      if (isMounted) {
        setCategoriesList(fallbackItems);
        setLoadingCat(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [refreshTrigger]);

  const fetchCategories = async () => {
    // Real-time synchronization is handled automatically by onSnapshot!
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameInput.trim()) {
      onError('Nama kategori mohon diisi lengkap.');
      return;
    }

    // Show beautiful confirmation notification dialog first
    setCategoryToConfirm({
      name: catNameInput.trim(),
      imageUrl: catImagePath || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200',
      isEditingId: isEditingId
    });
  };

  const confirmAndSaveCategory = async () => {
    if (!categoryToConfirm) return;
    setLoadingSubmit(true);
    let finalImageUrl = catImagePath;

    try {
      if (catImageFile) {
        setUploadProgress(10);
        try {
          const compressed = await compressImage(catImageFile, 0.75);
          setUploadProgress(20);
          finalImageUrl = await uploadToCloudinaryDirect(compressed, {
            folder: 'muara_category_icons',
            onProgress: (percent) => {
              const mapped = Math.round(20 + (percent * 0.8));
              setUploadProgress(mapped);
            }
          });
          setUploadProgress(100);
        } catch (uploadError: any) {
          console.error('Unggahan Cloudinary gagal, menggunakan data-uri fallback:', uploadError);
        }
      } else if (!finalImageUrl) {
        finalImageUrl = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200';
      }

      const catId = categoryToConfirm.isEditingId || `cat-${Date.now()}`;
      const payload = {
        name: categoryToConfirm.name,
        imageUrl: finalImageUrl,
        createdAt: new Date().toISOString()
      };

      // 1. Dual Write: Cloud Firestore
      try {
        const catDocRef = doc(firestore, 'categories', catId);
        await setDoc(catDocRef, payload, { merge: true });
      } catch (dbErr: any) {
        console.warn('Simpan ke Firestore ditolak/gagal, memfungsikan Local Fallback:', dbErr);
      }

      // 2. Dual Write: Local Storage Fallback
      try {
        const localCatsStr = localStorage.getItem('muara_custom_categories') || '[]';
        const localCats = JSON.parse(localCatsStr);
        const existingIdx = localCats.findIndex((lc: any) => lc.id === catId);
        const localPayload = {
          id: catId,
          name: payload.name,
          imageUrl: payload.imageUrl,
          createdAt: payload.createdAt
        };
        if (existingIdx > -1) {
          localCats[existingIdx] = localPayload;
        } else {
          localCats.push(localPayload);
        }
        localStorage.setItem('muara_custom_categories', JSON.stringify(localCats));
      } catch (localErr) {
        console.warn('Gagal cadangkan kategori ke localStorage:', localErr);
      }

      onSuccess(categoryToConfirm.isEditingId ? 'Kategori berhasil diperbarui!' : 'Kategori baru sukses didaftarkan.');
      
      setCatNameInput('');
      setCatImageFile(null);
      setCatImagePath('');
      setIsEditingId(null);
      setUploadProgress(0);
      setIsCatModalOpen(false);
      setCategoryToConfirm(null);
      
      await fetchCategories();
    } catch (err: any) {
      onError(`Gagal Menyimpan: ${err.message}`);
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleInitiateEdit = (cat: CategoryItem) => {
    setIsEditingId(cat.id);
    setCatNameInput(cat.name);
    setCatImagePath(cat.imageUrl);
    setCatImageFile(null);
    setUploadProgress(0);
    setIsCatModalOpen(true);
  };

  const performDeleteCategory = async (id: string) => {
    setLoadingSubmit(true);
    // Try firestore delete
    try {
      const docRef = doc(firestore, 'categories', id);
      await deleteDoc(docRef);
    } catch (err: any) {
      console.warn('Gagal menghapus dari Firestore:', err);
    }

    // Always delete from localStorage
    try {
      const localCatsStr = localStorage.getItem('muara_custom_categories');
      if (localCatsStr) {
        let localCats = JSON.parse(localCatsStr);
        localCats = localCats.filter((lc: any) => lc.id !== id);
        localStorage.setItem('muara_custom_categories', JSON.stringify(localCats));
      }
    } catch (localErr) {
      console.warn('Gagal menghapus dari local storage:', localErr);
    }

    onSuccess('Kategori berhasil dihapus secara permanen.');
    await fetchCategories();
    setCategoryToDelete(null);
    setLoadingSubmit(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="font-extrabold text-[#064e3b] text-base">
            Pusat Manajemen Kategori Kitab
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Tambah, ubah, atau hapus taksonomi bab kajian MUARA</p>
        </div>

        <button
          onClick={() => {
            setIsEditingId(null);
            setCatNameInput('');
            setCatImageFile(null);
            setCatImagePath('');
            setUploadProgress(0);
            setIsCatModalOpen(true);
          }}
          className="flex items-center gap-1 bg-[#064e3b] hover:bg-emerald-805 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Tambah Baru
        </button>
      </div>

      {loadingCat ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
          <p className="text-[11px] font-mono text-slate-400">Sinkronisasi draft kategori...</p>
        </div>
      ) : categoriesList.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-205 rounded-2xl text-slate-400">
          <Tag className="h-10 w-10 mx-auto opacity-30 mb-2 text-emerald-600" />
          <p className="text-xs font-semibold text-slate-500">Katalog Kategori Kosong</p>
          <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1">Harap daftarkan kategori perdana Anda di atas menggunakan tombol Tambah Baru.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-650 font-mono text-[10px]">
                <th className="p-3">Sampul / Ikon Gambar</th>
                <th className="p-3">Nama Klasifikasi Bab</th>
                <th className="p-3 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {categoriesList.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <img 
                        src={cat.imageUrl} 
                        alt={cat.name} 
                        className="h-10 w-10 object-cover rounded-lg border border-slate-200 shadow-3xs aspect-square" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=150';
                        }}
                      />
                      <span className="text-[9px] font-mono text-slate-350 select-all hidden sm:inline">ID: {cat.id}</span>
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-slate-800">
                    {cat.name}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleInitiateEdit(cat)}
                        className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-650 hover:text-[#064e3b] hover:bg-emerald-50 transition-colors flex items-center gap-0.5 cursor-pointer"
                        title="Edit Kategori"
                      >
                        <Edit2 className="h-3 w-3" /> <span className="text-[10px] font-bold">Edit</span>
                      </button>
                      <button
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-1 px-2.5 rounded-lg border border-red-100 text-red-650 hover:bg-red-50 transition-colors flex items-center gap-0.5 cursor-pointer"
                        title="Hapus Kategori"
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

      {/* MODAL WINDOW SYSTEM: TAMBAH / EDIT KATEGORI */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-205 w-full max-w-md overflow-hidden shadow-2xl">
            
            <div className="bg-[#064e3b] text-white p-4 font-bold flex items-center justify-between border-b pb-3.5">
              <h4 className="text-sm font-extrabold flex items-center gap-1.5">
                <Tag className="h-4 w-4" /> 
                {isEditingId ? 'Koreksi Bab Kategori' : 'Registrasi Kategori Baru'}
              </h4>
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="text-white hover:text-emerald-350 text-xs font-mono font-bold cursor-pointer"
              >
                [ Tutup ]
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-widest text-[10px] mb-1.5 font-mono">1. Nama Klasifikasi Kategori</label>
                <input
                  type="text"
                  required
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  placeholder="Masukkan nama klasifikasi (Bab Fiqih, Aqidah, dll)"
                  className="w-full border p-2.5 rounded-xl focus:border-emerald-500 focus:outline-hidden text-slate-800 font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 uppercase tracking-widest text-[10px] font-mono">2. Upload Ikon Gambar</label>
                
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-emerald-555 transition-colors bg-slate-50/50">
                  <input
                    type="file"
                    id="cat-file-upload-sub"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCatImageFile(e.target.files[0]);
                        setCatImagePath(URL.createObjectURL(e.target.files[0]));
                      }
                    }}
                  />

                  <label htmlFor="cat-file-upload-sub" className="cursor-pointer space-y-2 block">
                    {catImagePath ? (
                      <img 
                        src={catImagePath} 
                        alt="Draft" 
                        className="h-20 w-20 object-cover rounded-xl mx-auto border border-slate-150 shadow-2xs aspect-square" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}

                    <div className="text-slate-650">
                      <span className="font-bold text-emerald-750 underline">Pilih berkas foto</span> atau tarik ke area ini
                    </div>
                    <p className="text-[10px] text-slate-400">PNG, JPG, SVG maks 2MB, kompresi 70-80% otomatis</p>
                  </label>
                </div>

                {uploadProgress > 0 && (
                  <div className="space-y-1">
                     <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 font-mono">
                      <span>MENGIRIM FILE...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

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
                Simpan Perubahan Kategori
              </button>

            </form>

          </div>
        </div>
      )}

      {/* INTERACTIVE CONFIRMATION DIALOG FOR SAFE DELETIONS */}
      <AnimatePresence>
        {categoryToDelete && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-205 w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-4"
            >
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 text-red-650 flex items-center justify-center animate-bounce">
                <AlertTriangle className="h-6 w-6 text-red-650" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-800 text-sm">Hapus Kategori?</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus kategori <span className="font-bold text-slate-800">"{categoryToDelete.name}"</span>?
                </p>
                <p className="text-[10px] text-red-500 bg-red-50 p-2 rounded-xl border border-red-100">
                  Tindakan ini permanen. File gambar tetap aman tapi referensi kategori kitab ini akan dirubah.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 py-2.5 border hover:bg-slate-50 rounded-xl font-bold text-xs transition-colors cursor-pointer text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const idToDelete = categoryToDelete.id;
                    setCategoryToDelete(null);
                    await performDeleteCategory(idToDelete);
                  }}
                  className="flex-1 py-2.5 bg-red-650 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Hapus Permanen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- CONFIRMATION DIALOG BEFORE SAVING CATEGORY ----------------- */}
      <AnimatePresence>
        {categoryToConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-205 w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-4 text-slate-800"
            >
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-700" />
              </div>
              
              <div className="space-y-2">
                <h4 className="font-extrabold text-sm text-slate-800">
                  Konfirmasi Penambahan Kategori
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin data kategori ini sudah benar dan siap ditampilkan di Beranda serta katalog Kitab Kuning?
                </p>
                
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150 text-left space-y-2">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={categoryToConfirm.imageUrl} 
                      alt="Pratinjau Kategori" 
                      className="h-10 w-10 object-cover rounded-lg border border-slate-200 aspect-square" 
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Nama Kategori</p>
                      <p className="text-xs font-bold text-slate-700">{categoryToConfirm.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={loadingSubmit}
                  onClick={() => setCategoryToConfirm(null)}
                  className="flex-1 py-1.5 border hover:bg-slate-50 rounded-xl font-bold text-xs transition-colors cursor-pointer text-slate-650"
                >
                  Koreksi Lagi
                </button>
                <button
                  type="button"
                  disabled={loadingSubmit}
                  onClick={confirmAndSaveCategory}
                  className="flex-1 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  {loadingSubmit ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span>Ya, Daftarkan</span>
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
