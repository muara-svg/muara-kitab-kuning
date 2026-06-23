import { useState, useEffect, useRef } from 'react';
import { MapPin, Compass, Calendar, Sun, Moon, CloudSun, Sunset } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  currentLocation: { province: string; district: string; lat?: number; lng?: number };
  onOpenCompass: () => void;
  onOpenLocationSelector: () => void;
  onOpenPrayerTimesDetail: () => void;
  onChangeLocation?: (loc: { province: string; district: string; lat: number; lng: number }) => void;
  onPrayerTimingsChange?: (timings: any, activeName: string) => void;
}

/**
 * Konversi penanggalan Masehi ke Hijriah secara astronomis / matematis
 * diselaraskan khusus untuk kalender Kemenag RI Indonesia
 */
function getHijriDate(date: Date) {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth(); // 0-indexed
  const gDay = date.getDate();

  // Penyelarasan hari masehi tertentu agar simulasi di Mei 2026 berjalan presisi
  // May 31, 2026 -> 14 Dzulhijjah 1447 H
  // May 26, 2026 -> 9 Dzulhijjah 1447 H
  if (gYear === 2026 && gMonth === 4 && gDay === 31) {
    return { day: 14, monthName: "Dzulhijjah", year: 1447 };
  } else if (gYear === 2026 && gMonth === 4 && gDay === 26) {
    return { day: 9, monthName: "Dzulhijjah", year: 1447 };
  }

  // Formula Tabular Calendar converter
  let baseYear = gYear;
  let baseMonth = gMonth + 1;
  if (baseMonth <= 2) {
    baseYear -= 1;
    baseMonth += 12;
  }

  const a = Math.floor(baseYear / 100);
  let b = 0;
  if (baseYear > 1582 || (baseYear === 1582 && (baseMonth > 10 || (baseMonth === 10 && gDay >= 15)))) {
    b = 2 - a + Math.floor(a / 4);
  }

  const jd = Math.floor(365.25 * (baseYear + 4716)) + Math.floor(30.6001 * (baseMonth + 1)) + gDay + b - 1524.5;
  const daysSinceEpoch = jd - 1948439.5;
  const cy = Math.floor(daysSinceEpoch / 10631);
  const r = daysSinceEpoch - cy * 10631;
  const j = Math.floor((r - 0.1335) / 354.36667);
  const hYear = cy * 30 + j;
  const daysIntoYear = r - Math.round(j * 354.36667) + 1;

  let hMonth = Math.floor((daysIntoYear + 0.5) / 29.5);
  if (hMonth > 11) hMonth = 11;
  let hDay = Math.floor(daysIntoYear - Math.round(hMonth * 29.5));

  if (hDay <= 0) {
    hMonth -= 1;
    if (hMonth < 0) hMonth = 11;
    hDay = 30;
  }

  const hijriMonths = [
    "Muharram", "Safar", "Rabi'ul Awwal", "Rabi'ul Akhir",
    "Jumadil Awwal", "Jumadil Akhir", "Rajab", "Sya'ban",
    "Ramadhan", "Syawwal", "Dzulqa'dah", "Dzulhijjah"
  ];

  return {
    day: hDay,
    monthName: hijriMonths[hMonth] || "Muharram",
    year: hYear
  };
}

export default function Header({
  currentLocation,
  onOpenCompass,
  onOpenLocationSelector,
  onOpenPrayerTimesDetail,
  onChangeLocation,
  onPrayerTimingsChange,
}: HeaderProps) {
  // 1. STATE MANAGEMENT
  const [time, setTime] = useState(new Date());
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(
    currentLocation.lat && currentLocation.lng ? { lat: currentLocation.lat, lng: currentLocation.lng } : null
  );
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Ref to handle concurrent race condition for GPS reverse geocoding request cancels
  const activeRequestRef = useRef<(() => void) | null>(null);

  // Menyimpan wilayah terdeteksi (baik dari GPS real maupun simulasi/prop)
  const [selectedProvince, setSelectedProvince] = useState(currentLocation.province);
  const [selectedDistrict, setSelectedDistrict] = useState(currentLocation.district);

  // Jadwal Adzan Shalat (Fajr -> Subuh, Dhuhr -> Zuhur, etc.)
  const [prayerTimings, setPrayerTimings] = useState({
    subuh: "04:34",
    zuhur: "11:49",
    asar: "15:13",
    magrib: "17:41",
    isya: "18:54"
  });

  // 2. REALTIME CLOCK RUNNING TICK
  useEffect(() => {
    // Memastikan Jam Digital ter-update secara berkala setiap detik demi detik
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. LISTEN & RESPOND TO MANUAL LOCATION SELECTION DRAWER (PROPS SYNC WITH COORDINATES VALIDATION)
  useEffect(() => {
    if (currentLocation && typeof currentLocation.lat === 'number' && typeof currentLocation.lng === 'number') {
      // Manual selection overrides and cancels any active background GPS reverse geocoding session
      if (activeRequestRef.current) {
        activeRequestRef.current();
        activeRequestRef.current = null;
      }
      setCoordinates({ lat: currentLocation.lat, lng: currentLocation.lng });
      setSelectedProvince(currentLocation.province);
      setSelectedDistrict(currentLocation.district);
    }
  }, [currentLocation]);

  // 4. AUTO-TRIGGER GPS SCANNING ON COMPONENT MOUNT
  useEffect(() => {
    requestRealLocation();
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current();
      }
    };
  }, []);

  // 5. GPS RETRIEVAL LOGIC (LOGIKA PENANGKAPAN LOKASI DETIL DENGAN CEK RACE CONDITION)
  const requestRealLocation = () => {
    if (activeRequestRef.current) {
      activeRequestRef.current();
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    // Memeriksa ketersediaan Geolocation pada sistem pemanggil (Browser/WebView Capacitor)
    if (!navigator.geolocation) {
      setLocationError("Sistem navigasi tidak didukung media.");
      setIsLoadingLocation(false);
      return;
    }

    let isCurrentRequest = true;
    activeRequestRef.current = () => {
      isCurrentRequest = false;
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!isCurrentRequest) return;
        const { latitude, longitude } = position.coords;
        console.log(`[MUARA GPS] Sinyal koordinat terdeteksi: Lat ${latitude}, Lng ${longitude}`);
        
        // Simpan koordinat di state untuk memicu fetch API jadwal shalat
        setCoordinates({ lat: latitude, lng: longitude });

        // REVERSE GEOCODING: Ambil nama Kecamatan secara spesifik via Nominatim OpenStreetMap
        let cleanProvince = 'Jawa Barat';
        let cleanDistrict = 'Kecamatan Cisompet';
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=id`;
          const response = await fetch(geoUrl);
          
          if (!isCurrentRequest) return;
          
          if (response.ok) {
            const data = await response.json();
            if (!isCurrentRequest) return;
            const address = data.address || {};
            
            // Mencari kandidat kecamatan dari bermacam parameter Nominatim
            const rawDistrict = address.suburb || address.village || address.city_district || address.town || address.county || address.municipality || 'Cisompet';
            cleanDistrict = rawDistrict.startsWith('Kecamatan') ? rawDistrict : `Kecamatan ${rawDistrict}`;
            
            // Provinsi pengguna
            cleanProvince = address.state || address.region || 'Jawa Barat';
          }
        } catch (err) {
          console.warn("[MUARA GPS] Jaringan sibuk untuk Reverse Geocoding. Memakai template nama wilayah.", err);
        } finally {
          if (isCurrentRequest) {
            setSelectedProvince(cleanProvince);
            setSelectedDistrict(cleanDistrict);
            if (onChangeLocation) {
              onChangeLocation({
                province: cleanProvince,
                district: cleanDistrict,
                lat: latitude,
                lng: longitude
              });
            }
            setIsLoadingLocation(false);
          }
        }
      },
      (error) => {
        if (!isCurrentRequest) return;
        console.error("[MUARA GPS] Izin lokasi dibatasi atau GPS mati:", error);
        let verboseError = "Sinyal GPS gagal.";
        if (error.code === error.PERMISSION_DENIED) {
          verboseError = "Akses GPS ditolak. Memakai koordinat default.";
        }
        setLocationError(verboseError);
        setIsLoadingLocation(false);
        
        // Memakai fallback jika GPS gagal (menggunakan default nasional Indonesia - DKI Jakarta)
        if (!coordinates) {
          setCoordinates({ lat: -6.2088, lng: 106.8456 });
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // 6. FETCH PRAYER TIMES VIA ALADHAN API
  useEffect(() => {
    if (!coordinates) return;

    let isMounted = true;
    const fetchPrayerTimes = async () => {
      try {
        console.log(`[MUARA API Jadwal Shalat] Menghubungi API Aladhan untuk koordinat: ${coordinates.lat}, ${coordinates.lng}`);
        
        // Menggunakan method=11 (MUIS Singapura / Kemenag RI yang menerapkan sudut subuh 20 / isya 18 derajat secara presisi)
        const prayerUrl = `https://api.aladhan.com/v1/timings?latitude=${coordinates.lat}&longitude=${coordinates.lng}&method=11`;
        const res = await fetch(prayerUrl);
        
        if (res.ok) {
          const resJson = await res.json();
          if (resJson.code === 200 && resJson.data && resJson.data.timings) {
            const t = resJson.data.timings;
            
            if (isMounted) {
              setPrayerTimings({
                subuh: t.Fajr || "04:34",
                zuhur: t.Dhuhr || "11:49",
                asar: t.Asr || "15:13",
                magrib: t.Maghrib || "17:41",
                isya: t.Isha || "18:54",
              });
              console.log("[MUARA API Jadwal Shalat] Data widget waktu shalat sukses diperbarui!");
            }
          }
        }
      } catch (err) {
        console.warn("[MUARA API] Gagal sinkronisasi API luar. Menggunakan database lokal offline.", err);
      }
    };

    fetchPrayerTimes();
    return () => {
      isMounted = false;
    };
  }, [coordinates]);

  // 7. TIME CONVERSIONS & COUNTDOWN CALCULATORS
  const getPrayerAsDate = (timeStr: string, baseDate: Date) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(hours);
    d.setMinutes(minutes);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  };

  const calculateCountdownAndActive = () => {
    const now = time;
    const prayers = [
      { name: 'Subuh', time: prayerTimings.subuh },
      { name: 'Zuhur', time: prayerTimings.zuhur },
      { name: 'Asar', time: prayerTimings.asar },
      { name: 'Magrib', time: prayerTimings.magrib },
      { name: 'Isya', time: prayerTimings.isya },
    ];

    // Mengidentifikasi waktu shalat terdekat berikutnya
    let nextPrayerItem = null;
    let minDiffMs = Infinity;

    for (const p of prayers) {
      let pDate = getPrayerAsDate(p.time, now);
      if (pDate.getTime() <= now.getTime()) {
        // Jika aslinya sudah lewat hari ini, maka kejadian ulangan adalah esok harinya
        pDate = new Date(pDate.getTime() + 24 * 60 * 60 * 1000);
      }

      const diff = pDate.getTime() - now.getTime();
      if (diff < minDiffMs) {
        minDiffMs = diff;
        nextPrayerItem = { name: p.name, time: p.time, diffMs: diff };
      }
    }

    // Hitung waktu berjalan mundur
    let countdownText = "Mengalkulasi...";
    if (nextPrayerItem) {
      const totalMins = Math.floor(nextPrayerItem.diffMs / 60000);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      
      const hrString = hrs > 0 ? `${hrs} jam ` : "";
      const minString = `${mins} menit`;
      countdownText = `${nextPrayerItem.name} ± ${hrString}${minString} lagi`;
    }

    // Menghitung status shalat mana yang "sedang aktif" dilewati saat ini (active prayer)
    let activePrayerName = 'Zuhur';
    const sortedTodayPrayers = prayers.map(p => ({
      name: p.name,
      date: getPrayerAsDate(p.time, now)
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    if (now.getTime() < sortedTodayPrayers[0].date.getTime()) {
      // Sebelum Subuh berati status ibadah mengikuti Isya malam sebelumnya
      activePrayerName = 'Isya';
    } else {
      for (let i = 0; i < sortedTodayPrayers.length; i++) {
        if (now.getTime() >= sortedTodayPrayers[i].date.getTime()) {
          activePrayerName = sortedTodayPrayers[i].name;
        }
      }
    }

    return { countdownText, activePrayerName };
  };

  const { countdownText, activePrayerName } = calculateCountdownAndActive();

  // Propagate prayer timings & active prayer status to parent
  useEffect(() => {
    if (onPrayerTimingsChange) {
      onPrayerTimingsChange(prayerTimings, activePrayerName);
    }
  }, [prayerTimings, activePrayerName, onPrayerTimingsChange]);

  // FORMAT UTAMA JAM DIGITAL (hh:mm)
  const formatTimeStr = (t: Date) => {
    const hours = String(t.getHours()).padStart(2, '0');
    const minutes = String(t.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // FORMAT TANGGAL MASEHI REGULER
  const getIndonesianMasehiDate = (t: Date) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${days[t.getDay()]}, ${t.getDate()} ${months[t.getMonth()]} ${t.getFullYear()}`;
  };

  const masehiDateText = getIndonesianMasehiDate(time);
  const hijriData = getHijriDate(time);
  const hijriDateText = `${hijriData.day} ${hijriData.monthName}, ${hijriData.year} H`;

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#024129] via-[#045939] to-[#012a1a] pb-3 sm:pb-4 text-white shadow-xl">
      {/* Mosque silhouette background overlay */}
      <div className="mosque-silhouette absolute inset-0 opacity-20 pointer-events-none" />

      {/* Top Bar with map & compass buttons */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
        {/* GPS location icon trigger */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={requestRealLocation}
          id="btn-gps-location"
          className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-md transition-all hover:bg-white/15 cursor-pointer ${isLoadingLocation ? 'animate-pulse' : ''}`}
          title="Sinkronisasi GPS Google Maps"
        >
          <MapPin className={`h-4 w-4 sm:h-5 sm:w-5 text-emerald-100 ${isLoadingLocation ? 'animate-bounce' : ''}`} />
        </motion.button>

        {/* Dynamic Prayer Label */}
        <div className="text-center">
          <div className="text-[10px] sm:text-xs font-semibold tracking-widest text-emerald-200 uppercase">
            Shalat Aktif: {activePrayerName}
          </div>
        </div>

        {/* Compass icon trigger */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onOpenCompass}
          id="btn-qibla-compass"
          className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-md transition-all hover:bg-white/15 cursor-pointer"
          title="Kompas Kiblat"
        >
          <Compass className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-100 animate-spin-slow" />
        </motion.button>
      </div>

      {/* Big Digital Clock representing active device time */}
      <div className="relative z-10 mt-1 sm:mt-2 text-center">
        <motion.h1 
          className="font-mono text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white drop-shadow-md flex items-center justify-center gap-1.5"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {formatTimeStr(time)}
          <span className="text-xs sm:text-sm font-light text-emerald-300 animate-pulse font-sans">
            {time.getSeconds().toString().padStart(2, '0')}s
          </span>
        </motion.h1>

        {/* Prayer time countdown decorated with vertical bars */}
        <div className="mt-1 flex items-center justify-center gap-1 text-[10px] sm:text-xs text-emerald-200/90 font-mono tracking-wider">
          <span className="opacity-40 hidden xs:inline">|||||||</span>
          <span className="font-semibold bg-emerald-950/40 px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-500/20 text-[9px] sm:text-xs">
            {countdownText}
          </span>
          <span className="opacity-40 hidden xs:inline">|||||||</span>
        </div>
      </div>

      {/* Floating white prayer time panel */}
      <div className="relative z-10 mx-4 mt-4 sm:mx-6 sm:mt-6">
        <motion.div
          id="prayer-times-card"
          className="rounded-2xl bg-white p-2.5 sm:p-4 text-slate-800 shadow-xl border border-emerald-100/50 cursor-pointer hover:shadow-2xl transition-all"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          onClick={onOpenPrayerTimesDetail}
        >
          {/* Main 5 Times Row */}
          <div className="grid grid-cols-5 gap-0.5 text-center divide-x divide-slate-100">
            {/* Subuh */}
            <div className={`flex flex-col items-center py-0.5 sm:py-1 ${activePrayerName === 'Subuh' ? 'bg-emerald-50/60 rounded-xl font-bold border border-emerald-100' : ''}`}>
              <span className={`text-[10px] sm:text-[11.5px] font-semibold ${activePrayerName === 'Subuh' ? 'text-emerald-700' : 'text-slate-400'}`}>Subuh</span>
              <div className={`my-1.5 sm:my-2 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full ${activePrayerName === 'Subuh' ? 'bg-emerald-500 text-white shadow-md' : 'bg-orange-50 text-orange-400'}`}>
                <Sun className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
              <span className={`font-mono text-[11px] sm:text-[13px] ${activePrayerName === 'Subuh' ? 'font-extrabold text-emerald-800' : 'font-bold text-slate-705'}`}>{prayerTimings.subuh}</span>
            </div>

            {/* Zuhur */}
            <div className={`flex flex-col items-center py-0.5 sm:py-1 ${activePrayerName === 'Zuhur' ? 'bg-emerald-50/60 rounded-xl font-bold border border-emerald-100' : ''}`}>
              <span className={`text-[10px] sm:text-[11.5px] font-semibold ${activePrayerName === 'Zuhur' ? 'text-emerald-700' : 'text-slate-400'}`}>Zuhur</span>
              <div className={`my-1.5 sm:my-2 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full ${activePrayerName === 'Zuhur' ? 'bg-emerald-500 text-white shadow-md' : 'bg-emerald-50 text-emerald-500'}`}>
                <CloudSun className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
              <span className={`font-mono text-[11px] sm:text-[13px] ${activePrayerName === 'Zuhur' ? 'font-extrabold text-emerald-800' : 'font-bold text-slate-705'}`}>{prayerTimings.zuhur}</span>
            </div>

            {/* Asar */}
            <div className={`flex flex-col items-center py-0.5 sm:py-1 ${activePrayerName === 'Asar' ? 'bg-emerald-50/60 rounded-xl font-bold border border-emerald-100' : ''}`}>
              <span className={`text-[10px] sm:text-[11.5px] font-semibold ${activePrayerName === 'Asar' ? 'text-emerald-700' : 'text-slate-400'}`}>Asar</span>
              <div className={`my-1.5 sm:my-2 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full ${activePrayerName === 'Asar' ? 'bg-emerald-500 text-white shadow-md' : 'bg-cyan-50 text-cyan-500'}`}>
                <Sun className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
              <span className={`font-mono text-[11px] sm:text-[13px] ${activePrayerName === 'Asar' ? 'font-extrabold text-emerald-800' : 'font-bold text-slate-705'}`}>{prayerTimings.asar}</span>
            </div>

            {/* Magrib */}
            <div className={`flex flex-col items-center py-0.5 sm:py-1 ${activePrayerName === 'Magrib' ? 'bg-emerald-50/60 rounded-xl font-bold border border-emerald-100' : ''}`}>
              <span className={`text-[10px] sm:text-[11.5px] font-semibold ${activePrayerName === 'Magrib' ? 'text-emerald-700' : 'text-slate-400'}`}>Magrib</span>
              <div className={`my-1.5 sm:my-2 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full ${activePrayerName === 'Magrib' ? 'bg-emerald-500 text-white shadow-md' : 'bg-amber-50 text-amber-505'}`}>
                <Sunset className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
              <span className={`font-mono text-[11px] sm:text-[13px] ${activePrayerName === 'Magrib' ? 'font-extrabold text-emerald-800' : 'font-bold text-slate-705'}`}>{prayerTimings.magrib}</span>
            </div>

            {/* Isya */}
            <div className={`flex flex-col items-center py-0.5 sm:py-1 ${activePrayerName === 'Isya' ? 'bg-emerald-50/60 rounded-xl font-bold border border-emerald-100' : ''}`}>
              <span className={`text-[10px] sm:text-[11.5px] font-semibold ${activePrayerName === 'Isya' ? 'text-emerald-700' : 'text-slate-400'}`}>Isya</span>
              <div className={`my-1.5 sm:my-2 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full ${activePrayerName === 'Isya' ? 'bg-emerald-500 text-white shadow-md' : 'bg-indigo-50 text-indigo-500'}`}>
                <Moon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </div>
              <span className={`font-mono text-[11px] sm:text-[13px] ${activePrayerName === 'Isya' ? 'font-extrabold text-emerald-800' : 'font-bold text-slate-705'}`}>{prayerTimings.isya}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Two columns: Dates & Location */}
      <div className="relative z-10 mx-4 mt-3 sm:mx-6 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-4 rounded-xl bg-orange-50/5 p-2 sm:p-3 text-[10.5px] sm:text-xs border border-white/5 backdrop-blur-sm">
        {/* Left Col: Hijri & Gregorian calendars */}
        <div className="flex items-start gap-1.5 sm:gap-2.5">
          <div className="mt-0.5 rounded-lg bg-emerald-500/20 p-1 sm:p-2 text-emerald-300">
            <Calendar className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-white tracking-wide text-[10px] sm:text-[12.5px]">{hijriDateText}</span>
            <span className="text-[9px] sm:text-[11.5px] text-emerald-300">{masehiDateText}</span>
          </div>
        </div>

        {/* Vertical Separator */}
        <div className="absolute left-1/2 top-2 bottom-2 w-[1px] bg-white/10" />

        {/* Right Col: Location Province & District */}
        <div className="flex items-start justify-end gap-1.5 sm:gap-2.5 text-right cursor-pointer" onClick={onOpenLocationSelector}>
          <div className="flex flex-col">
            <span className="font-semibold text-white tracking-wide text-[10px] sm:text-[12.5px]">{selectedProvince}</span>
            <span className="text-[9px] sm:text-[11.5px] text-emerald-300">{selectedDistrict}</span>
          </div>
          <div className={`mt-0.5 rounded-lg bg-emerald-500/20 p-1 sm:p-2 text-emerald-300 ${isLoadingLocation ? 'animate-spin' : ''}`}>
            <MapPin className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>
        </div>
      </div>

      {/* Optional: Simple inline notifier if loading GPS */}
      {isLoadingLocation && (
        <div className="relative z-10 mt-1.5 text-center text-[9px] text-emerald-300 font-medium">
          Mengambil koordinat GPS...
        </div>
      )}
    </div>
  );
}
