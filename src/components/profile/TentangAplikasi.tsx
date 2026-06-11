import React, { useState, useEffect } from 'react';
import { Info, Sparkles, HelpCircle, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { listenToAppConfig, AppConfig, DEFAULT_APP_CONFIG } from '../../lib/appConfigService';

interface TentangAplikasiProps {
  onClose: () => void;
}

export default function TentangAplikasi({ onClose }: TentangAplikasiProps) {
  const [activeConfig, setActiveConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);

  useEffect(() => {
    // Listen to live config and auto-switch
    const unsubscribe = listenToAppConfig((cfg) => {
      setActiveConfig(cfg);
    });
    return () => unsubscribe();
  }, []);

  const hasContent = activeConfig.aboutApp?.content && activeConfig.aboutApp.content.trim().length > 0;
  const displayTitle = hasContent ? activeConfig.aboutApp.title : 'Tentang Aplikasi';
  const displayContent = hasContent ? activeConfig.aboutApp.content : '';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 z-[9999] overflow-y-auto font-sans flex flex-col"
    >
      {/* ELEGANT TOP HEADER */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between z-20">
        <button
          onClick={onClose}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="font-extrabold text-slate-800 text-xs md:text-sm tracking-widest uppercase">
          Informasi Aplikasi
        </h2>
        <div className="w-10 h-10" /> {/* Spacer */}
      </div>

      {/* BODY CONTENT */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 md:py-12 space-y-8 flex flex-col justify-start">
        <div className="text-center space-y-4">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="mx-auto h-20 w-20 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-lg shadow-emerald-500/5"
          >
            <Info className="h-10 w-10 text-[#064e3b]" />
          </motion.div>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-[#064e3b] tracking-tight">
              {displayTitle}
            </h1>
            <p className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-605 text-emerald-600">
              MUARA Digital Ecosystem
            </p>
          </div>
        </div>

        {hasContent ? (
          <div className="text-xs md:text-sm text-slate-650 leading-relaxed text-left whitespace-pre-wrap bg-white border border-slate-150 p-6 md:p-8 rounded-3xl shadow-xs space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 leading-relaxed">{displayContent}</div>
          </div>
        ) : (
          <div className="p-8 bg-teal-50 border border-teal-100 rounded-3xl text-center space-y-2">
            <span className="flex items-center justify-center gap-1.5 text-xs text-teal-800 font-extrabold uppercase tracking-widest leading-none">
              <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
              Proses Pembaruan
            </span>
            <p className="text-[11px] text-teal-700 font-sans font-semibold uppercase tracking-wide">
              Tentang aplikasi sedang dipersiapkan oleh administrator utama.
            </p>
          </div>
        )}
      </div>

      {/* FOOTER ACTION */}
      <div className="sticky bottom-0 bg-gradient-to-t from-slate-50 via-white to-transparent py-6 px-6 border-t border-slate-100 flex justify-center">
        <button
          onClick={onClose}
          className="w-full max-w-sm py-3.5 bg-[#064e3b] hover:bg-emerald-950 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/20 transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          Kembali ke Akun
        </button>
      </div>
    </motion.div>
  );
}
