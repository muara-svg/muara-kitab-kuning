import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, Trash2, Clock, Calendar, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface RiwayatBacaProps {
  currentUser?: any;
  onClose: () => void;
}

export default function RiwayatBaca({ currentUser, onClose }: RiwayatBacaProps) {
  const [historyList, setHistoryList] = useState<any[]>([]);

  const getStorageKey = () => {
    if (currentUser?.uid) {
      return `muara_riwayat_baca_${currentUser.uid}`;
    }
    return 'muara_riwayat_baca';
  };

  const storageKey = getStorageKey();

  useEffect(() => {
    try {
      const historyRaw = localStorage.getItem(storageKey);
      if (historyRaw) {
        setHistoryList(JSON.parse(historyRaw));
      } else {
        setHistoryList([]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [storageKey]);

  const handleClearHistory = () => {
    if (window.confirm("Hapus seluruh catatan riwayat baca kitab kuning Anda?")) {
      localStorage.removeItem(storageKey);
      setHistoryList([]);
    }
  };

  const handleRemoveItem = (bookId: string) => {
    const updated = historyList.filter(item => item.bookId !== bookId);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setHistoryList(updated);
  };

  return (
    <div className="font-sans text-slate-700 p-2 space-y-4">
      <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/60 text-slate-800">
        <h3 className="font-extrabold text-emerald-900 text-xs sm:text-sm">Riwayat Muthala'ah Anda</h3>
        <p className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5">Daftar penanda halaman belajar kitab kuning yang disimpan.</p>
      </div>

      {historyList.length === 0 ? (
        <div className="text-center py-10 px-4 space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-205">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="mx-auto h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200"
          >
            <BookOpen className="h-5 w-5" />
          </motion.div>
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-slate-700">Belum Ada Catatan</h4>
            <p className="text-[9px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              Buka kitab kuning di perpustakaan, lalu klik tombol <strong className="text-emerald-800">Simpan Riwayat</strong> di pojok kanan atas untuk menandai letak halaman membaca Anda.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
          {historyList.map((item, index) => {
            const dateStr = item.timestamp 
              ? new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) 
              : '';
            
            return (
              <div 
                key={item.bookId || index} 
                className="bg-white border border-slate-100 px-3 py-2.5 rounded-xl hover:border-emerald-500/20 transition-all flex justify-between items-center"
              >
                <div className="space-y-1 flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="bg-emerald-50 text-emerald-800 font-extrabold text-[8px] px-1 py-0.5 rounded border border-emerald-100 uppercase tracking-wide">
                      HAL: {item.pageIdx + 1}
                    </span>
                    <span className="font-mono text-[8px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {dateStr}
                    </span>
                  </div>
                  
                  <div className="min-w-0">
                    <h5 className="font-extrabold text-xs text-slate-800 truncate leading-tight">{item.bookTitle}</h5>
                    <p className="text-[9px] text-slate-450 font-medium font-mono truncate">Oleh: {item.author}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleRemoveItem(item.bookId)}
                    className="p-1 px-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md border border-slate-100 transition-colors cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-1 flex gap-2">
        {historyList.length > 0 && (
          <button 
            type="button"
            onClick={handleClearHistory}
            className="flex-1 py-2 text-[11px] font-bold text-red-600 bg-red-50/40 hover:bg-red-50 rounded-lg border border-red-150 transition-colors"
          >
            Hapus Semua
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
