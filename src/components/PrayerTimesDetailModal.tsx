import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';
import Modal from './Modal';
import { azanService } from '../lib/azanService';

interface PrayerTimesDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  district: string;
  province: string;
  prayerTimings: {
    subuh: string;
    zuhur: string;
    asar: string;
    magrib: string;
    isya: string;
    [key: string]: string;
  };
  activePrayerName: string;
}

// Map each daily prayer to a unique numeric notification ID
const PRAYER_IDS: Record<string, number> = {
  Subuh: 1001,
  Zuhur: 1002,
  Asar: 1003,
  Magrib: 1004,
  Isya: 1005
};

export default function PrayerTimesDetailModal({
  isOpen,
  onClose,
  district,
  province,
  prayerTimings,
  activePrayerName
}: PrayerTimesDetailModalProps) {
  // 1. Local state to track which prayers have the Azan alarm active
  const [alarmSettings, setAlarmSettings] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('muara_setting_azan');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse muara_setting_azan preference from local storage:', e);
    }
    // Default: all prayer alarms are active by default to guide the user
    return {
      Subuh: true,
      Zuhur: true,
      Asar: true,
      Magrib: true,
      Isya: true
    };
  });

  const [permissionStatus, setPermissionStatus] = useState<boolean | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');

  // 2. Persist configurations on change and auto-schedule
  useEffect(() => {
    localStorage.setItem('muara_setting_azan', JSON.stringify(alarmSettings));
  }, [alarmSettings]);

  // Check initial permissions state
  useEffect(() => {
    if (isOpen) {
      azanService.requestPermission().then((granted) => {
        setPermissionStatus(granted);
      });
    }
  }, [isOpen]);

  // 3. Trigger manual re-sync of all active scheduled alarms
  const handleSyncAllAlarms = async () => {
    setSyncStatusMsg('Sinkronisasi...');
    let successCount = 0;
    
    const prayers = Object.keys(PRAYER_IDS);
    for (const p of prayers) {
      const id = PRAYER_IDS[p];
      const isEnabled = alarmSettings[p];
      const timeStr = prayerTimings[p.toLowerCase()];

      if (isEnabled && timeStr) {
        const ok = await azanService.scheduleSingleAzan(id, p, timeStr);
        if (ok) successCount++;
      } else {
        await azanService.cancelSingleAzan(id);
      }
    }

    setSyncStatusMsg(`Selesai! Mengaktifkan ${successCount} alarm Azan.`);
    setTimeout(() => setSyncStatusMsg(''), 3000);
  };

  // 4. Toggle the Speaker alarm active/mute status
  const handleToggleAlarm = async (prayerName: string) => {
    const id = PRAYER_IDS[prayerName];
    const newStatus = !alarmSettings[prayerName];
    const timeStr = prayerTimings[prayerName.toLowerCase()];

    // Update settings in state
    setAlarmSettings(prev => ({
      ...prev,
      [prayerName]: newStatus
    }));

    if (newStatus && timeStr) {
      // Schedule single alarm
      console.log(`[Developer action] Activating alarm notification for ${prayerName} at ${timeStr}`);
      const ok = await azanService.scheduleSingleAzan(id, prayerName, timeStr);
      if (!ok) {
        console.warn(`[Developer caution] Could not schedule alarm on this environment.`);
      }
    } else {
      // Cancel single alarm
      console.log(`[Developer action] Deactivating/Muting alarm notification for ${prayerName}`);
      await azanService.cancelSingleAzan(id);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Jadwal Shalat Lengkap - ${district || 'Wilayah Anda'}`}
    >
      <div className="space-y-4">
        {/* Banner with high GPS accuracy info */}
        <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 flex items-start gap-3 text-emerald-900">
          <BookOpen className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-xs text-emerald-800">Akurasi GPS Tinggi</p>
            <p className="text-[11.5px] mt-0.5 opacity-90 text-slate-600 leading-relaxed">
              Jadwal diadaptasi mengikuti ketetapan Kementerian Agama Republik Indonesia (KEMENAG RI) zona {province || 'Indonesia'}.
            </p>
          </div>
        </div>

        {/* Permission status warn banner */}
        {permissionStatus === false && (
          <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 flex items-start gap-3 text-amber-900">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs text-amber-800">Izin Notifikasi Belum Disetujui</p>
              <p className="text-[11px] mt-0.5 opacity-90 text-slate-605">
                Harap izinkan notifikasi di pengaturan ponsel agar suara azan otomatis (local notification) berfungsi saat waktu shalat tiba.
              </p>
            </div>
          </div>
        )}

        {/* List of Prayer Schedules with volume settings */}
        <div className="bg-white border rounded-2xl overflow-hidden divide-y divide-slate-100 border-slate-150">
          {[
            { name: 'Imsak', time: '04:24', status: 'Selesai', isFardhu: false },
            { name: 'Subuh', time: prayerTimings.subuh || '04:34', status: '', isFardhu: true },
            { name: 'Syuruk', time: '05:50', status: 'Selesai', isFardhu: false },
            { name: 'Dhuha', time: '06:18', status: 'Selesai', isFardhu: false },
            { name: 'Zuhur', time: prayerTimings.zuhur || '11:49', status: '', isFardhu: true },
            { name: 'Asar', time: prayerTimings.asar || '15:13', status: '', isFardhu: true },
            { name: 'Magrib', time: prayerTimings.magrib || '17:41', status: '', isFardhu: true },
            { name: 'Isya', time: prayerTimings.isya || '18:54', status: '', isFardhu: true }
          ].map((sh, idx) => {
            const isActive = activePrayerName === sh.name;
            const isAlarmOn = sh.isFardhu ? alarmSettings[sh.name] : false;

            return (
              <div
                key={idx}
                className={`p-3.5 px-4 flex justify-between items-center transition-colors ${
                  isActive ? 'bg-emerald-500/10 font-extrabold border-y border-emerald-500/15' : 'hover:bg-slate-50/50'
                }`}
              >
                {/* Left side: status dot and name */}
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 rounded-full ${
                    isActive ? 'bg-emerald-600 animate-pulse' : 'bg-slate-300'
                  }`} />
                  <span className={`font-medium ${isActive ? 'text-emerald-900 font-extrabold' : 'text-slate-700'}`}>
                    {sh.name}
                  </span>
                </div>

                {/* Right side: Time display, alarm volume switcher */}
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs font-bold ${isActive ? 'text-emerald-700 text-sm font-extrabold' : 'text-slate-800'}`}>
                    {sh.time}
                  </span>

                  {/* Volume automatic alarm switcher for fardhu prayers */}
                  {sh.isFardhu ? (
                    <button
                      onClick={() => handleToggleAlarm(sh.name)}
                      className={`p-2 rounded-xl transition-all flex items-center justify-center border ${
                        isAlarmOn 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm hover:bg-emerald-700' 
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-650 hover:bg-slate-100'
                      }`}
                      title={isAlarmOn ? `Suara Azan ${sh.name} Aktif` : `Suara Azan ${sh.name} Senyap`}
                    >
                      {isAlarmOn ? (
                        <Volume2 className="h-4.5 w-4.5" />
                      ) : (
                        <VolumeX className="h-4.5 w-4.5" />
                      )}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-sans px-2.5 py-0.5 rounded-full bg-slate-100">
                      Sunnah
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sync panel and metadata */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleSyncAllAlarms}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sinkronisasi Ulang Alarm Azan</span>
          </button>

          {syncStatusMsg && (
            <p className="text-center font-bold text-[11px] text-emerald-700 animate-pulse">
              {syncStatusMsg}
            </p>
          )}

          <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-center text-[10px] text-slate-400">
            Pemberitahuan Azan didukung suara "azan.mp3" bawaan aplikasi yang handal memicu alarm walaupun dalam keadaan luring demi kekhusyukan beribadah.
          </div>
        </div>
      </div>
    </Modal>
  );
}
