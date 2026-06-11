import React, { useState, useEffect } from 'react';
import { Star, Sparkles, ExternalLink, AlertTriangle, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { listenToAppConfig, AppConfig, DEFAULT_APP_CONFIG } from '../../lib/appConfigService';

interface BeriRatingProps {
  onClose: () => void;
}

export default function BeriRating({ onClose }: BeriRatingProps) {
  const [activeConfig, setActiveConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = listenToAppConfig((cfg) => {
      setActiveConfig(cfg);
    });
    return () => unsubscribe();
  }, []);

  const hasLink = activeConfig.giveRating?.content && activeConfig.giveRating.content.trim().length > 0;
  const ratingLink = hasLink ? activeConfig.giveRating.content.trim() : '';
  const displayTitle = hasLink ? activeConfig.giveRating.title : 'Beri Rating Bintang 5';

  const handleRedirect = () => {
    if (ratingLink) {
      // Securely open in a new tab/window to respect iframe sandbox constraints
      window.open(ratingLink, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <div className="text-center py-6 px-4 font-sans text-slate-700 space-y-5 max-w-sm mx-auto">
      <motion.div
        animate={{ scale: [1, 1.12, 1], rotate: [0, 4, -4, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="mx-auto h-16 w-16 rounded-3xl bg-yellow-50 text-yellow-600 border border-yellow-200 flex items-center justify-center shadow-md shadow-yellow-500/5 animate-pulse"
      >
        <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
      </motion.div>

      <div className="space-y-3">
        <h3 className="font-extrabold text-slate-800 text-base md:text-lg tracking-tight">
          {displayTitle}
        </h3>

        {hasLink ? (
          <div className="space-y-4">
            {!showConfirm ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed text-center px-2">
                  Dukungan dan penilaian bintang 5 dari para penuntut ilmu sangat berarti bagi syiar dakwah digital tim kado santri Nusantara.
                </p>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg active:scale-97"
                >
                  <Star className="h-4 w-4 fill-white" />
                  <span>Mulai Beri Penilaian</span>
                </button>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl text-left space-y-3"
              >
                <div className="flex gap-2.5 items-start">
                  <ShieldAlert className="h-5 w-5 text-amber-650 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-extrabold text-amber-900 block">Konfirmasi Keluar Aplikasi</span>
                    <p className="text-[11px] text-amber-800 leading-normal mt-0.5 font-medium">
                      Apakah anda yakin ingin keluar dari aplikasi untuk memberikan rating?
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-2 text-center border bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRedirect}
                    className="flex-1 py-2 text-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Ya, Lanjutkan</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-teal-50 border border-teal-150 rounded-2xl max-w-xs mx-auto">
            <span className="flex items-center justify-center gap-1.5 text-xs text-teal-800 font-extrabold uppercase tracking-widest leading-none">
              <Sparkles className="h-4 w-4 text-teal-610" />
              Fitur Sedang Berada Dalam Proses Pengembangan
            </span>
            <p className="text-[10px] text-teal-700 font-sans font-semibold mt-1.5 uppercase tracking-wide">
              Umpan balik / Rating belum dikonfigurasi Admin
            </p>
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border transition-colors cursor-pointer"
        >
          Kembali ke Akun
        </button>
      </div>
    </div>
  );
}
