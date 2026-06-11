import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Loader2, 
  Search, 
  Upload, 
  X, 
  AlertTriangle, 
  CheckCircle,
  Image as ImageIcon,
  HeartHandshake
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestore } from '../../lib/firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { compressImage } from '../../lib/authService';
import { uploadToCloudinaryDirect } from '../../lib/cloudinaryConfig';
import { SedekahCampaign } from '../../types';

// Let's import the default ones to use as structural initial seed if empty
import { INITIAL_SEDEKAH_CAMPAIGNS } from '../../data/mockData';

interface AdminSedekahProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function AdminSedekah({ onSuccess, onError }: AdminSedekahProps) {
  const [campaigns, setCampaigns] = useState<SedekahCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form / Modal visibility
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<SedekahCampaign | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState<number>(10000000);
  const [collectedAmount, setCollectedAmount] = useState<number>(0);
  const [donorCount, setDonorCount] = useState<number>(0);
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  // Payment Config Form Fields
  const [paymentType, setPaymentType] = useState<'Bank Transfer' | 'QRIS Code'>('Bank Transfer');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [qrisImageUrl, setQrisImageUrl] = useState('');
  const [qrisImageFile, setQrisImageFile] = useState<File | null>(null);

  // Compression & upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Multiple accounts list state (Requirement 2)
  const [accounts, setAccounts] = useState<{
    id: string;
    type: 'Bank Transfer' | 'QRIS Code';
    name: string;
    accountNo: string;
    accountHolder: string;
    qrisImageUrl?: string;
    file?: File;
  }[]>([]);

  // Sub-form for adding a single account
  const [newAccType, setNewAccType] = useState<'Bank Transfer' | 'QRIS Code'>('Bank Transfer');
  const [newAccName, setNewAccName] = useState('');
  const [newAccNo, setNewAccNo] = useState('');
  const [newAccHolder, setNewAccHolder] = useState('YAYASAN AL-MUARA DIGITAL');
  const [newAccQrisUrl, setNewAccQrisUrl] = useState('');
  const [newAccQrisFile, setNewAccQrisFile] = useState<File | null>(null);

  // Confirmation step modal
  const [campaignToConfirm, setCampaignToConfirm] = useState<{
    id?: string;
    title: string;
    description: string;
    targetAmount: number;
    collectedAmount: number;
    donorCount: number;
    thumbnailUrl: string;
    paymentType?: 'Bank Transfer' | 'QRIS Code';
    bankName?: string;
    bankAccountNo?: string;
    bankAccountHolder?: string;
    qrisImageUrl?: string;
    accounts?: any[];
    isEditing: boolean;
  } | null>(null);

  // Deletion step confirmation modal
  const [campaignToDelete, setCampaignToDelete] = useState<SedekahCampaign | null>(null);

  // Zoom state for admin QRIS preview
  const [zoomedAdminQrisUrl, setZoomedAdminQrisUrl] = useState<string | null>(null);

  // Fetch campaign list on mount
  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setFetching(true);
    let loaded: SedekahCampaign[] = [];

    // 1. Fetch from Firestore if available
    try {
      const colRef = collection(firestore, 'sedekah_campaigns');
      const snap = await getDocs(colRef);
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        loaded.push({
          id: docSnap.id,
          title: d.title || '',
          description: d.description || '',
          targetAmount: Number(d.targetAmount || 0),
          collectedAmount: Number(d.collectedAmount || 0),
          donorCount: Number(d.donorCount || 0),
          thumbnailUrl: d.thumbnailUrl || '',
          paymentType: d.paymentType || 'Bank Transfer',
          bankName: d.bankName || '',
          bankAccountNo: d.bankAccountNo || '',
          bankAccountHolder: d.bankAccountHolder || '',
          qrisImageUrl: d.qrisImageUrl || '',
          accounts: d.accounts || [],
        });
      });
    } catch (err: any) {
      console.warn("Firestore sedekah_campaigns. Loading cache:", err.message);
    }

    // 2. Fetch from local cache fallback
    try {
      const localStr = localStorage.getItem('muara_sedekah_cache');
      if (localStr) {
        const localList = JSON.parse(localStr);
        const existingIds = new Set(loaded.map(c => c.id));
        localList.forEach((c: any) => {
          if (!existingIds.has(c.id)) {
            loaded.push({
              id: c.id,
              title: c.title || '',
              description: c.description || '',
              targetAmount: Number(c.targetAmount || 0),
              collectedAmount: Number(c.collectedAmount || 0),
              donorCount: Number(c.donorCount || 0),
              thumbnailUrl: c.thumbnailUrl || '',
              paymentType: c.paymentType || 'Bank Transfer',
              bankName: c.bankName || '',
              bankAccountNo: c.bankAccountNo || '',
              bankAccountHolder: c.bankAccountHolder || '',
              qrisImageUrl: c.qrisImageUrl || '',
              accounts: c.accounts || [],
            });
          }
        });
      }
    } catch (localErr) {
      console.warn("Gagal memuat cache lokal kampanye sedekah:", localErr);
    }

    setCampaigns(loaded);
    setFetching(false);
  };

  // Triggers when "Tambah Program" is clicked or reset form
  const openNewForm = () => {
    setEditingCampaign(null);
    setTitle('');
    setDescription('');
    setTargetAmount(25000000);
    setCollectedAmount(0);
    setDonorCount(0);
    setThumbnailUrl('');
    setImageFile(null);
    setPaymentType('Bank Transfer');
    setBankName('Bank Syariah Indonesia (BSI)');
    setBankAccountNo('');
    setBankAccountHolder('YAYASAN AL-MUARA DIGITAL');
    setQrisImageUrl('');
    setQrisImageFile(null);
    setUploadProgress(null);
    
    // Set default initial bank channel
    setAccounts([
      { id: 'acc-bsi', type: 'Bank Transfer', name: 'Bank Syariah Indonesia (BSI)', accountNo: '7112024009', accountHolder: 'YAYASAN AL-MUARA DIGITAL' }
    ]);
    setNewAccType('Bank Transfer');
    setNewAccName('');
    setNewAccNo('');
    setNewAccHolder('YAYASAN AL-MUARA DIGITAL');
    setNewAccQrisUrl('');
    setNewAccQrisFile(null);

    setShowFormModal(true);
  };

  // Triggers when editing campaign
  const openEditForm = (camp: SedekahCampaign) => {
    setEditingCampaign(camp);
    setTitle(camp.title);
    setDescription(camp.description);
    setTargetAmount(camp.targetAmount);
    setCollectedAmount(camp.collectedAmount);
    setDonorCount(camp.donorCount);
    setThumbnailUrl(camp.thumbnailUrl);
    setPaymentType(camp.paymentType || 'Bank Transfer');
    setBankName(camp.bankName || 'Bank Syariah Indonesia (BSI)');
    setBankAccountNo(camp.bankAccountNo || '');
    setBankAccountHolder(camp.bankAccountHolder || 'YAYASAN AL-MUARA DIGITAL');
    setQrisImageUrl(camp.qrisImageUrl || '');
    setQrisImageFile(null);
    setImageFile(null);
    setUploadProgress(null);

    // Build modern account array (with backwards compatibility fallback conversion)
    let legacyAccounts = camp.accounts || [];
    if (legacyAccounts.length === 0) {
      if (camp.paymentType === 'QRIS Code') {
        legacyAccounts = [{
          id: 'acc-' + Date.now(),
          type: 'QRIS Code',
          name: 'QRIS Syariah Al-Muara',
          accountNo: 'Pindai Kode QRIS',
          accountHolder: camp.bankAccountHolder || 'YAYASAN AL-MUARA DIGITAL',
          qrisImageUrl: camp.qrisImageUrl
        }];
      } else if (camp.bankAccountNo) {
        legacyAccounts = [{
          id: 'acc-' + Date.now(),
          type: 'Bank Transfer',
          name: camp.bankName || 'Bank Syariah Indonesia (BSI)',
          accountNo: camp.bankAccountNo,
          accountHolder: camp.bankAccountHolder || 'YAYASAN AL-MUARA DIGITAL'
        }];
      }
    }
    setAccounts(legacyAccounts);
    setNewAccType('Bank Transfer');
    setNewAccName('');
    setNewAccNo('');
    setNewAccHolder('YAYASAN AL-MUARA DIGITAL');
    setNewAccQrisUrl('');
    setNewAccQrisFile(null);

    setShowFormModal(true);
  };

  // Add a new payment option account to the local accounts list
  const handleAddNewAccount = () => {
    if (newAccType === 'Bank Transfer') {
      if (!newAccName.trim() || !newAccNo.trim() || !newAccHolder.trim()) {
        onError('⚠️ Mohon isi Nama Bank/Dompet, Nomor Rekening, dan Atas Nama.');
        return;
      }
      
      const newAcc = {
        id: 'acc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        type: 'Bank Transfer' as const,
        name: newAccName.trim(),
        accountNo: newAccNo.trim(),
        accountHolder: newAccHolder.trim()
      };
      setAccounts([...accounts, newAcc]);
      
      // Reset subform input fields
      setNewAccName('');
      setNewAccNo('');
      setNewAccHolder('YAYASAN AL-MUARA DIGITAL');
    } else {
      if (!newAccHolder.trim() || (!newAccQrisUrl && !newAccQrisFile)) {
        onError('⚠️ Mohon isi Nama Pemilik QRIS dan unggah gambar QRIS Anda.');
        return;
      }
      
      const newAcc = {
        id: 'acc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        type: 'QRIS Code' as const,
        name: newAccName.trim() || 'QRIS Syariah Al-Muara',
        accountNo: 'Pindai QRIS',
        accountHolder: newAccHolder.trim(),
        qrisImageUrl: newAccQrisUrl,
        file: newAccQrisFile || undefined
      };
      setAccounts([...accounts, newAcc]);
      
      // Reset subform input fields
      setNewAccName('');
      setNewAccHolder('YAYASAN AL-MUARA DIGITAL');
      setNewAccQrisUrl('');
      setNewAccQrisFile(null);
    }
    onSuccess('✓ Rekening/QRIS berhasil ditambahkan ke daftar.');
  };

  // Selected image callback
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setThumbnailUrl(URL.createObjectURL(file));
    }
  };

  // Selected QRIS image callback
  const handleQrisImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrisImageFile(file);
      setQrisImageUrl(URL.createObjectURL(file));
    }
  };

  // Pre-save triggers confirmation popup to prevent user error
  const handlePreSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || targetAmount <= 0) {
      onError('⚠️ Mohon isi seluruh formulir dengan data yang valid.');
      return;
    }

    if (accounts.length === 0) {
      onError('⚠️ Mohon tambahkan minimal satu bank rekening atau e-wallet pada daftar konfigurasi di bawah.');
      return;
    }

    const firstAcc = accounts[0];
    setCampaignToConfirm({
      id: editingCampaign?.id,
      title: title.trim(),
      description: description.trim(),
      targetAmount,
      collectedAmount,
      donorCount,
      thumbnailUrl,
      paymentType: firstAcc ? firstAcc.type : 'Bank Transfer',
      bankName: firstAcc && firstAcc.type === 'Bank Transfer' ? firstAcc.name : '',
      bankAccountNo: firstAcc && firstAcc.type === 'Bank Transfer' ? firstAcc.accountNo : '',
      bankAccountHolder: firstAcc ? firstAcc.accountHolder : '',
      qrisImageUrl: firstAcc && firstAcc.type === 'QRIS Code' ? (firstAcc.qrisImageUrl || '') : '',
      accounts: accounts,
      isEditing: !!editingCampaign
    });
  };

  // Executed after confirmation modal is approved
  const executeSaveCampaign = async () => {
    if (!campaignToConfirm) return;
    setLoading(true);

    let finalImageUrl = campaignToConfirm.thumbnailUrl;

    try {
      // 1. Handle file compression and upload if a new banner is specified
      if (imageFile) {
        setUploadProgress(10);
        try {
          const compressed = await compressImage(imageFile, 0.75);
          setUploadProgress(35);

          finalImageUrl = await uploadToCloudinaryDirect(compressed, {
            folder: 'muara_sedekah_posters',
            onProgress: (percent) => {
              const mappedVal = Math.round(35 + (percent * 0.30));
              setUploadProgress(mappedVal);
            }
          });
          setUploadProgress(65);
        } catch (uploadErr) {
          console.warn("Gagal upload banner ke awan:", uploadErr);
        }
      }

      // 2. Handle compression and upload for each account's local file
      const uploadStepProgressStart = 65;
      const uploadedAccounts = [];
      const accList = campaignToConfirm.accounts || [];
      for (let i = 0; i < accList.length; i++) {
        const acc = accList[i];
        let qrisUrl = acc.qrisImageUrl || '';
        
        if (acc.file) {
          try {
            const compressedQris = await compressImage(acc.file, 0.75);
            qrisUrl = await uploadToCloudinaryDirect(compressedQris, {
              folder: 'muara_sedekah_qris'
            });
          } catch (qrisUploadErr) {
            console.warn("Gagal upload QRIS lokal dari daftar rekening ke awan:", qrisUploadErr);
          }
        }
        
        uploadedAccounts.push({
          id: acc.id,
          type: acc.type,
          name: acc.name,
          accountNo: acc.accountNo,
          accountHolder: acc.accountHolder,
          qrisImageUrl: qrisUrl
        });

        // increment upload bar
        const accProgress = Math.round(uploadStepProgressStart + (((i + 1) / accList.length) * 30));
        setUploadProgress(Math.min(95, accProgress));
      }

      setUploadProgress(100);

      // 3. Formulate target payload
      const campId = campaignToConfirm.id || `s-${Date.now()}`;
      const firstAcc = uploadedAccounts[0];
      const updatedItem: SedekahCampaign = {
        id: campId,
        title: campaignToConfirm.title,
        description: campaignToConfirm.description,
        targetAmount: Number(campaignToConfirm.targetAmount),
        collectedAmount: Number(campaignToConfirm.collectedAmount),
        donorCount: Number(campaignToConfirm.donorCount),
        thumbnailUrl: finalImageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400',
        paymentType: firstAcc ? firstAcc.type : 'Bank Transfer',
        bankName: firstAcc && firstAcc.type === 'Bank Transfer' ? firstAcc.name : '',
        bankAccountNo: firstAcc && firstAcc.type === 'Bank Transfer' ? firstAcc.accountNo : '',
        bankAccountHolder: firstAcc ? firstAcc.accountHolder : '',
        qrisImageUrl: firstAcc && firstAcc.type === 'QRIS Code' ? (firstAcc.qrisImageUrl || '') : '',
        accounts: uploadedAccounts
      };

      // 4. Save to Cloud Firestore
      try {
        const docRef = doc(firestore, 'sedekah_campaigns', campId);
        await setDoc(docRef, updatedItem);
      } catch (dbErr) {
        console.warn("Firestore sedekah_campaigns offline/bypassed:", dbErr);
      }

      // 5. Save to Local Cache and dispatch update event for instant user-facing client sync
      try {
        const localListStr = localStorage.getItem('muara_sedekah_cache') || '[]';
        let localListObj: SedekahCampaign[] = JSON.parse(localListStr);

        // Replace or prepend
        const existingIdx = localListObj.findIndex((item) => item.id === campId);
        if (existingIdx !== -1) {
          localListObj[existingIdx] = updatedItem;
        } else {
          localListObj.unshift(updatedItem);
        }

        localStorage.setItem('muara_sedekah_cache', JSON.stringify(localListObj));
        
        window.dispatchEvent(new CustomEvent('muara-sedekah-change', { detail: localListObj }));
        localStorage.setItem('muara_sedekah_trigger', Date.now().toString());
      } catch (cacheErr) {
        console.warn("Gagal menyimpan ke cache lokal:", cacheErr);
      }

      onSuccess(
        campaignToConfirm.isEditing 
          ? `✓ Program "${campaignToConfirm.title}" berhasil diperbarui!` 
          : `✓ Program "${campaignToConfirm.title}" berhasil ditambahkan!`
      );

      // Cleanup
      setCampaignToConfirm(null);
      setShowFormModal(false);
      fetchCampaigns(); // Refresh state list
    } catch (saveErr: any) {
      console.error(saveErr);
      onError(`⚠️ Gagal menyimpan program sedek5h: ${saveErr.message}`);
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  // Perform delete operation
  const executeDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    setLoading(true);

    try {
      // 1. Delete from Cloud Firestore
      try {
        const docRef = doc(firestore, 'sedekah_campaigns', campaignToDelete.id);
        await deleteDoc(docRef);
      } catch (dbErr) {
        console.warn("Firestore delete bypassed:", dbErr);
      }

      // 2. Delete from Local Cache & Emit event
      try {
        const localListStr = localStorage.getItem('muara_sedekah_cache') || '[]';
        let localListObj: SedekahCampaign[] = JSON.parse(localListStr);
        const filtered = localListObj.filter((item) => item.id !== campaignToDelete.id);
        localStorage.setItem('muara_sedekah_cache', JSON.stringify(filtered));

        // Dispatch instant event
        window.dispatchEvent(new CustomEvent('muara-sedekah-change', { detail: filtered }));
        localStorage.setItem('muara_sedekah_trigger', Date.now().toString());
      } catch (cacheErr) {
        console.warn("Gagal hapus dari cache lokal:", cacheErr);
      }

      onSuccess(`✓ Program "${campaignToDelete.title}" berhasil dihapus.`);
      setCampaignToDelete(null);
      fetchCampaigns();
    } catch (delErr: any) {
      console.error(delErr);
      onError(`⚠️ Gagal menghapus program: ${delErr.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtering campaigns with search bar
  const filteredCampaigns = campaigns.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-emerald-900 to-teal-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <HeartHandshake className="h-8 w-8 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans">Santunan Sedekah Amal</h2>
            <p className="text-sm text-emerald-200 mt-1">
              Atur dan kelola program sedekah digital santri untuk disajikan kepada publik real-time.
            </p>
          </div>
        </div>

        <button
          onClick={openNewForm}
          className="bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-sm py-3 px-5 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="h-4 w-4" /> Tambah Program Baru
        </button>
      </div>

      {/* Control Actions & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Cari program sedekah berdasarkan judul atau deskripsi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-emerald-500 focus:bg-white focus:outline-hidden transition-all text-slate-850"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-500 hover:text-slate-800 underline shrink-0 cursor-pointer"
          >
            Bersihkan Pencarian
          </button>
        )}
      </div>

      {/* Loader / Content Display */}
      {fetching ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs">
          <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-500">Memuat rincian database kampanye sedekah...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs">
          <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-850">Belum ada program</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Gunakan tombol "Tambah Program Baru" di atas untuk membuat penyaluran dana amal pertama Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCampaigns.map((camp) => {
            const progressPct = Math.min(100, Math.round((camp.collectedAmount / camp.targetAmount) * 100));
            return (
              <motion.div
                key={camp.id}
                layoutId={`camp-card-${camp.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col md:flex-row gap-4 hover:border-emerald-200 transition-all"
              >
                <div className="w-full md:w-36 h-36 rounded-xl overflow-hidden bg-slate-100 relative shrink-0 border border-slate-100">
                  <img
                    src={camp.thumbnailUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200'}
                    alt={camp.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 rounded-lg px-2 py-0.5 text-[9px] text-white font-bold font-mono">
                    {camp.donorCount} Donatur
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">{camp.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{camp.description}</p>
                  </div>

                  {/* Fund stats */}
                  <div className="space-y-1 mt-3">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 font-mono">
                      <span>Terkumpul: Rp {camp.collectedAmount.toLocaleString('id-ID')}</span>
                      <span className="text-emerald-700">{progressPct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" 
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                      Target penyaluran: <strong className="font-bold font-mono text-slate-700">Rp {camp.targetAmount.toLocaleString('id-ID')}</strong>
                    </p>
                  </div>

                  {/* Payment profile preview for Admin control verification */}
                  <div className="mt-2.5 p-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-650 font-sans space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Daftar Saluran Penyaluran ({camp.accounts?.length || 1}):</span>
                      <span className="text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase">
                        Aktif
                      </span>
                    </div>
                    <div className="space-y-1 max-h-[75px] overflow-y-auto pr-0.5">
                      {camp.accounts && camp.accounts.length > 0 ? (
                        camp.accounts.map((acc: any, aidx: number) => (
                          <div key={acc.id || aidx} className="flex justify-between items-center font-bold text-[9px] text-slate-755 font-sans border-b border-slate-100 pb-1 last:border-0 last:pb-0 pt-0.5 first:pt-0">
                            <span className="truncate max-w-[150px] text-slate-600 flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${acc.type === 'QRIS Code' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                              {acc.name}
                            </span>
                            <span className="font-mono bg-white border border-slate-150 px-1 py-0.2 rounded text-[8px] text-slate-600">
                              {acc.type === 'QRIS Code' ? (
                                <button
                                  type="button"
                                  onClick={() => setZoomedAdminQrisUrl(acc.qrisImageUrl || null)}
                                  className="text-emerald-700 hover:underline font-bold cursor-pointer"
                                  title="Klik untuk memperbesar QRIS"
                                >
                                  Pindai QRIS (Zoom)
                                </button>
                              ) : (
                                acc.accountNo
                              )}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between items-center font-mono font-bold text-[10px] text-slate-705">
                          <span className="truncate max-w-[130px]">{camp.bankName || 'BSI'}</span>
                          <span className="bg-slate-200/60 px-1 rounded text-slate-800">{camp.bankAccountNo || 'Rekening Kosong'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Controls Action (Update, Delete) */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-slate-50 self-end md:self-auto">
                    <button
                      onClick={() => openEditForm(camp)}
                      className="px-3.5 py-1.5 rounded-lg text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" /> Sunting
                    </button>
                    <button
                      onClick={() => setCampaignToDelete(camp)}
                      className="px-3.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CAMPAIGN FORM */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-emerald-600 animate-pulse" />
                  {editingCampaign ? 'Sunting Program Sedekah' : 'Tambah Program Sedekah'}
                </h3>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1 px-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handlePreSaveSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Visual Thumbnail Upload Area */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700">Gambar Banner Program Sedekah</label>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="w-24 h-24 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shrink-0 flex items-center justify-center relative">
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-slate-300" />
                      )}
                    </div>

                    <div className="flex-1 w-full relative">
                      <div className="border border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50/20 rounded-xl p-4 text-center cursor-pointer relative transition-all">
                        <Upload className="h-5 w-5 text-slate-400 mx-auto mb-1.5" />
                        <span className="block text-[11px] text-slate-500 font-bold">
                          {imageFile ? imageFile.name : 'Pilih file gambar atau drag ke sini'}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Format JPG/PNG terkompresi otomatis</span>
                        
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Judul Program */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">Judul Program Sedekah</label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    placeholder="Contoh: Sedekah Rutin Jumat Berkah untuk Sembako Dhuafa"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl px-3.5 py-2.5 text-xs bg-white text-slate-850"
                  />
                </div>

                {/* Deskripsi Program */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">Deskripsi Lengkap Kampanye</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tuliskan cerita, latar belakang, dan urgensi dari pendanaan sedekah ini sedetail mungkin agar memotivasi para donatur..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl px-3.5 py-2 py-2.5 text-xs bg-white text-slate-850 leading-relaxed"
                  />
                </div>

                {/* Grid inputs for financial target & collection */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Target Dana (Rp)</label>
                    <input
                      type="number"
                      required
                      min={1000}
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(Number(e.target.value))}
                      className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl px-3.5 py-2.5 text-xs bg-white text-slate-850 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-500">Terkumpul Awal (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={collectedAmount}
                      onChange={(e) => setCollectedAmount(Number(e.target.value))}
                      className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl px-3.5 py-2.5 text-xs bg-white text-slate-850 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-500">Jumlah Donatur</label>
                    <input
                      type="number"
                      min={0}
                      value={donorCount}
                      onChange={(e) => setDonorCount(Number(e.target.value))}
                      className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-xl px-3.5 py-2.5 text-xs bg-white text-slate-850 font-mono"
                    />
                  </div>
                </div>

                {/* Pengaturan Pembayaran Khusus Program */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-slate-800">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider font-sans">Konfigurasi Rekening & Pembayaran</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-extrabold uppercase">Multi-Account</span>
                  </div>

                  {/* List of configured accounts */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Daftar Rekening / QRIS yang Dikonfigurasi ({accounts.length})
                    </label>
                    {accounts.length === 0 ? (
                      <div className="text-center p-3 text-[11px] text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Belum ada rekening atau QRIS ditambahkan. Silakan tambahkan minimal satu di bawah.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                        {accounts.map((acc) => (
                          <div key={acc.id} className="p-2.5 rounded-xl border border-slate-150 bg-white flex items-start justify-between gap-3 text-xs">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex gap-1.5 items-center">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase font-sans ${
                                  acc.type === 'QRIS Code' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-blue-50 text-blue-700 border border-blue-150'
                                }`}>
                                  {acc.type === 'QRIS Code' ? 'QRIS Instan' : 'Transfer Bank'}
                                </span>
                                <strong className="text-slate-850 font-extrabold font-sans leading-none">{acc.name}</strong>
                              </div>
                              
                              <div className="text-[10px] text-slate-500 font-medium space-y-0.5 leading-snug">
                                <div>No. Rek: <strong className="text-slate-705 font-mono select-all font-bold">{acc.accountNo}</strong></div>
                                <div>Atas Nama: <strong className="text-slate-701">{acc.accountHolder}</strong></div>
                                {acc.type === 'QRIS Code' && (
                                  <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-bold">
                                    <span>(Gambar QRIS Tersedia)</span>
                                    {acc.qrisImageUrl && (
                                      <button
                                        type="button"
                                        onClick={() => setZoomedAdminQrisUrl(acc.qrisImageUrl || '')}
                                        className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer leading-tight transition-colors font-sans font-bold"
                                      >
                                        Perbesar
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setAccounts(accounts.filter(a => a.id !== acc.id))}
                              className="text-[11px] text-rose-550 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sub-form to Add New Account */}
                  <div className="p-3 bg-white border border-slate-205 rounded-xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Input Informasi Rekening & Pembayaran</span>
                      <span className="text-[10px] text-slate-400 font-sans font-bold">Atur Sesuka Hati</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="block text-[10px] font-bold text-slate-500">Pilih Tipe Pembayaran</label>
                        <select
                          value={newAccType}
                          onChange={(e) => {
                            const type = e.target.value as 'Bank Transfer' | 'QRIS Code';
                            setNewAccType(type);
                            if (type === 'QRIS Code') {
                              setNewAccName('QRIS Syariah Al-Muara');
                            } else {
                              setNewAccName('Bank Syariah Indonesia (BSI)');
                            }
                          }}
                          className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-lg px-2.5 py-2 text-[11px] bg-white text-slate-800 cursor-pointer font-semibold"
                        >
                          <option value="Bank Transfer">Transfer Rekening Bank / E-Wallet</option>
                          <option value="QRIS Code">Unggah QRIS Code</option>
                        </select>
                      </div>

                      <div className="space-y-0.5">
                        <label className="block text-[10px] font-bold text-slate-500">Nama Bank / E-Wallet / QRIS</label>
                        <input
                          type="text"
                          placeholder="Contoh: BSI, Mandiri, QRIS Syariah"
                          value={newAccName}
                          onChange={(e) => setNewAccName(e.target.value)}
                          className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-lg px-2.5 py-2 text-[11px] bg-white text-slate-800 font-semibold"
                        />
                      </div>
                    </div>

                    {newAccType === 'Bank Transfer' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="block text-[10px] font-bold text-slate-500">Nomor Rekening / No. HP</label>
                          <input
                            type="text"
                            placeholder="Contoh: 7112024009 atau 0812..."
                            value={newAccNo}
                            onChange={(e) => setNewAccNo(e.target.value)}
                            className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-lg px-2.5 py-2 text-[11px] bg-white text-slate-800 font-mono font-bold"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <label className="block text-[10px] font-bold text-slate-500">Nama Pemilik Rekening</label>
                          <input
                            type="text"
                            placeholder="Atas Nama"
                            value={newAccHolder}
                            onChange={(e) => setNewAccHolder(e.target.value)}
                            className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-lg px-2.5 py-2 text-[11px] bg-white text-slate-800 font-semibold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="space-y-0.5">
                          <label className="block text-[10px] font-bold text-slate-500">Nama Pemegang QRIS</label>
                          <input
                            type="text"
                            placeholder="Pemilik QRIS"
                            value={newAccHolder}
                            onChange={(e) => setNewAccHolder(e.target.value)}
                            className="w-full border border-slate-200 focus:border-emerald-500 focus:outline-hidden rounded-lg px-2.5 py-2 text-[11px] bg-white text-slate-800 font-semibold"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 items-center pt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                          <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0 flex items-center justify-center relative shadow-inner">
                            {newAccQrisUrl ? (
                              <img src={newAccQrisUrl} alt="QRIS preview" className="w-full h-full object-contain" />
                            ) : (
                              <div className="text-center p-1.5 text-[8px] text-slate-400 font-bold">No Image</div>
                            )}
                          </div>

                           <div className="flex-1 w-full relative">
                             <div className="border border-dashed border-slate-350 hover:border-emerald-450 bg-white hover:bg-emerald-50/10 rounded-xl p-2.5 text-center cursor-pointer relative transition-all">
                               <Upload className="h-3.5 w-3.5 text-slate-450 mx-auto mb-0.5" />
                               <span className="block text-[10px] text-slate-600 font-bold">
                                 {newAccQrisFile ? newAccQrisFile.name : 'Pilih File Gambar QRIS'}
                               </span>
                               <span className="block text-[8px] text-slate-400 mt-0.5 font-bold">Kompresi Otomatis 70-80%</span>
                               
                               <input
                                 type="file"
                                 accept="image/*"
                                 onChange={(e) => {
                                   const file = e.target.files?.[0];
                                   if (file) {
                                     setNewAccQrisFile(file);
                                     setNewAccQrisUrl(URL.createObjectURL(file));
                                   }
                                 }}
                                 className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                               />
                             </div>
                           </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddNewAccount}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-[11px] py-2 px-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      + Simpan Rekening Terpilih ke Daftar
                    </button>
                  </div>
                </div>

                {/* Footer submit actions inside form popup */}
                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-extrabold text-white text-xs shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="h-4 w-4" /> Simpan Program
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CONFIRM SAVE DIALOGUE */}
      <AnimatePresence>
        {campaignToConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            >
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle className="h-6 w-6 animate-bounce" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Penyimpanan Program
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menyimpan program sedekah <strong>"{campaignToConfirm.title}"</strong>? 
                  Data ini akan langsung terbit secara realtime pada laman dashboard pembaca.
                </p>
              </div>

              {/* Upload dynamic compress bar progress indicator */}
              {isUploading && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-600" /> Mengompres & mengunggah poster iklan...
                    </span>
                    <span>{uploadProgress || 10}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${uploadProgress || 10}%` }} />
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setCampaignToConfirm(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 border border-slate-200 cursor-pointer disabled:opacity-50"
                >
                  Sunting Kembali
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setIsUploading(true);
                    executeSaveCampaign().finally(() => setIsUploading(false));
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer min-w-28"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    'Ya, Simpan!'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: DELETE CONFIRMATION DIALOGUE */}
      <AnimatePresence>
        {campaignToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
            >
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-6 w-6 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Hapus Program Sedekah</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus permanen program <strong>"{campaignToDelete.title}"</strong>?<br />
                  Tindakan ini bersifat final dan tidak dapat dibatalkan.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setCampaignToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={executeDeleteCampaign}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ya, Hapus!'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: ZOOMED QRIS PREVIEW */}
      <AnimatePresence>
        {zoomedAdminQrisUrl && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-sm p-5 relative shadow-2xl flex flex-col items-center"
            >
              <button
                type="button"
                onClick={() => setZoomedAdminQrisUrl(null)}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-4 font-sans">Pratinjau QRIS Syariah Program</h4>
              <div className="w-full aspect-square max-w-[280px] bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex items-center justify-center">
                <img src={zoomedAdminQrisUrl} alt="Zoomed QRIS" className="w-full h-full object-contain" />
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-3 font-medium">
                Gambar terkompresi optimal 70-80% untuk kenyamanan akses aplikasi.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
