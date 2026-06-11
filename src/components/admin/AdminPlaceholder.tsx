import React from 'react';
import { FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminPlaceholderProps {
  tabName: string;
}

export default function AdminPlaceholder({ tabName }: AdminPlaceholderProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
      <div className="p-4 rounded-full bg-slate-50 text-slate-400 border border-spaced border-slate-205">
        <FileText className="h-10 w-10 text-emerald-650" />
      </div>
      <div className="space-y-1">
        <h3 className="font-extrabold text-slate-700 capitalize">Modul Admin {tabName}</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Komponen menu ini saat ini dijadwalkan untuk tahap pengembangan berikutnya (Web Build S2-Ready).
        </p>
      </div>
      <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl max-w-sm text-[10px] text-left text-slate-500">
        <strong>Catatan Sistem:</strong> Sistem integrasi cloud basis data dan media penyimpanan aktif untuk melayani taksonomi Bab Kategori, Kitab serta siaran Notifikasi. Gunakan menu-menu tersebut untuk mengunggah media rujukan langsung ke media penyimpanan aman.
      </div>
    </motion.div>
  );
}
