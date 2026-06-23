import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import MenuUtama from './components/MenuUtama';
import PencarianKategori from './components/PencarianKategori';
import AdminPanel from './components/AdminPanel';
import Modal from './components/Modal';
import SatuPintuAuth from './components/SatuPintuAuth';
import SantriAI from './components/SantriAI';
import PrayerTimesDetailModal from './components/PrayerTimesDetailModal';

import { UserProfile, NotificationItem, SedekahCampaign } from './types';
import { INITIAL_NOTIFICATIONS, INITIAL_SEDEKAH_CAMPAIGNS, MOCK_KITABS } from './data/mockData';
import { Compass, HelpCircle, MapPin, Check, Sparkles, BookOpen, ShieldAlert, LogOut, Settings, ArrowLeft, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSessionUser, clearSessionUser, storeSessionUser } from './lib/authService';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { firestore } from './lib/firebaseConfig';
import { indexedDbService } from './lib/indexedDbService';

export default function App() {
  // 1. User state session
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: 'user-1',
    name: 'Firman Husen',
    email: 'firmanhusen255@gmail.com',
    phone: '081234567890',
    bio: 'Santri thalabul ilmi pencinta Kitab Kuning Digital',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
    isLoggedIn: false, // Starts as logged-off so both profiles can be checked
    membershipStatus: 'Gratis',
    role: 'user',
  });

  // Load session from localStorage on startup (Senior Full-Stack Best Practice)
  useEffect(() => {
    const session = getSessionUser();
    if (session) {
      setUserProfile({
        id: session.uid,
        name: session.name,
        email: session.email,
        phone: session.phone,
        bio: session.bio,
        avatarUrl: session.avatarUrl,
        isLoggedIn: session.isLoggedIn,
        membershipStatus: session.isPremium ? 'Premium Verified' : 'Gratis',
        role: session.role || 'user',
      });
    }

    // Intercept deep links / direct URLs like ?page=admin
    const params = new URLSearchParams(window.location.search);
    const targetPage = params.get('page') || params.get('route');
    if (targetPage === 'admin') {
      setCurrentTab('admin' as any);
    }
  }, []);

  // Automated high precision Web-origin sync & Capacitor backend URL routing (Zero Setup Paradigm)
  useEffect(() => {
    // 1. If we are running in a standard Web Webview/Browser (NOT Capacitor, NOT localhost)
    // we automatically propagate our parent origin to Firestore under app_configs/api_server.
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );
    const isWebMode = typeof window !== 'undefined' && 
      ! (window as any).Capacizer && 
      window.location.protocol.startsWith('http') && 
      !isLocalhost;

    if (isWebMode) {
      const origin = window.location.origin;
      const apiServerRef = doc(firestore, 'app_configs', 'api_server');
      setDoc(apiServerRef, { apiUrl: origin }, { merge: true })
        .then(() => {
          console.log('[MUARA Auto Sync] Origin server tersinkron ke Firestore:', origin);
        })
        .catch((err) => {
          console.warn('[MUARA Auto Sync] Terlewat menyinkronkan server apiUrl ke Firestore (No Write Perms/Guest):', err.message);
        });
    }

    // 2. Start realtime subscription of api_server to obtain active Server URL for Capacitor Client
    const apiServerRef = doc(firestore, 'app_configs', 'api_server');
    const unsubscribeApiServer = onSnapshot(apiServerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.apiUrl) {
          localStorage.setItem('muara_api_server_url', data.apiUrl);
          console.log('[MUARA Config Loader] Menemukan API URL online:', data.apiUrl);
        }
      }
    }, (error) => {
      console.warn('[MUARA Config Loader Warning] Tidak dapat mengambil API server dari Firestore:', error.message);
    });

    return () => unsubscribeApiServer();
  }, []);

  // Realtime Firestore sync with onSnapshot for instant membership updates
  useEffect(() => {
    if (userProfile.isLoggedIn && userProfile.id) {
      const userDocRef = doc(firestore, 'users', userProfile.id);
      
      const unsubscribe = onSnapshot(userDocRef, async (userSnap) => {
        try {
          if (userSnap.exists()) {
            const data = userSnap.data();
            let isPremiumVal = !!data.isPremium;
            const expiresAtValue = data.expiresAt || '';
            const roleVal = data.role || 'user';
            const nameVal = data.name || userProfile.name;
            const avatarVal = data.avatarUrl || userProfile.avatarUrl;
            const bioVal = data.bio || userProfile.bio;
            const phoneVal = data.phone || userProfile.phone || '';
            
            // Automated Package Expiration logic
            if (isPremiumVal && expiresAtValue && expiresAtValue !== 'Unlimited' && expiresAtValue !== 'Selamanya' && expiresAtValue !== 'unlimitid') {
              const expiryDate = new Date(expiresAtValue);
              expiryDate.setHours(23, 59, 59, 999);
              if (!isNaN(expiryDate.getTime()) && new Date() > expiryDate) {
                isPremiumVal = false;
                try {
                  await updateDoc(userDocRef, { isPremium: false });
                  console.log(`Membership auto-expired on ${expiresAtValue} for user UID: ${userProfile.id}`);
                } catch (autoErr) {
                  console.warn("Auto VIP expiry db write skipped (check network):", autoErr);
                }
              }
            }

            const updatedStatus = isPremiumVal ? 'Premium Verified' : 'Gratis';
            
            setUserProfile((prev) => {
              // Update local storage session too so it stays persistent
              const session = getSessionUser();
              if (session) {
                const isSessionStale = 
                  session.isPremium !== isPremiumVal || 
                  session.role !== roleVal || 
                  session.name !== nameVal || 
                  session.avatarUrl !== avatarVal ||
                  session.phone !== phoneVal ||
                  session.bio !== bioVal;
                  
                if (isSessionStale) {
                  storeSessionUser({
                    ...session,
                    name: nameVal,
                    avatarUrl: avatarVal,
                    bio: bioVal,
                    role: roleVal,
                    isPremium: isPremiumVal,
                    phone: phoneVal,
                  });
                }
              }
              
              if (
                prev.membershipStatus !== updatedStatus || 
                prev.expiresAt !== expiresAtValue || 
                prev.name !== nameVal || 
                prev.avatarUrl !== avatarVal ||
                prev.phone !== phoneVal ||
                prev.bio !== bioVal ||
                prev.role !== roleVal
              ) {
                return {
                  ...prev,
                  name: nameVal,
                  avatarUrl: avatarVal,
                  bio: bioVal,
                  role: roleVal,
                  phone: phoneVal,
                  membershipStatus: updatedStatus as 'Gratis' | 'Premium Verified',
                  expiresAt: expiresAtValue,
                };
              }
              return prev;
            });
          }
        } catch (e) {
          console.warn('Realtime profile firestore sync background bypassed:', e);
        }
      }, (error) => {
        console.warn('onSnapshot profile subscription error:', error);
      });

      return () => unsubscribe();
    }
  }, [userProfile.isLoggedIn, userProfile.id]);

  // 2. Active notifications and Sedekah databases (reactive to Admin Panel changes)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sedekahCampaigns, setSedekahCampaigns] = useState<SedekahCampaign[]>([]);

  // Realtime active sync for Sedekah Campaigns
  useEffect(() => {
    let cloudCamps: any[] = [];

    const handleUpdate = () => {
      let localCamps: any[] = [];
      try {
        const localStr = localStorage.getItem('muara_sedekah_cache');
        if (localStr) {
          localCamps = JSON.parse(localStr);
        }
      } catch (err) {
        console.warn("Gagal membaca muara_sedekah_cache:", err);
      }

      const mergedMap = new Map<string, any>();
      
      [...localCamps, ...cloudCamps].forEach((camp) => {
        if (camp && camp.id) {
          mergedMap.set(camp.id, {
            id: camp.id,
            title: camp.title || '',
            description: camp.description || '',
            targetAmount: Number(camp.targetAmount || 0),
            collectedAmount: Number(camp.collectedAmount || 0),
            donorCount: Number(camp.donorCount || 0),
            thumbnailUrl: camp.thumbnailUrl || '',
            paymentType: camp.paymentType,
            bankName: camp.bankName || '',
            bankAccountNo: camp.bankAccountNo || '',
            bankAccountHolder: camp.bankAccountHolder || '',
            qrisImageUrl: camp.qrisImageUrl || '',
            accounts: camp.accounts || [],
          });
        }
      });

      const finalCamps = Array.from(mergedMap.values());
      setSedekahCampaigns(finalCamps);
    };

    const colRef = collection(firestore, 'sedekah_campaigns');
    const unsubscribeSnapshot = onSnapshot(colRef, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      cloudCamps = list;
      handleUpdate();
    }, (error) => {
      console.warn("Realtime sedekah sync failed (permissions/offline), relying on local cache:", error);
      handleUpdate();
    });

    const handleLocalSync = () => {
      handleUpdate();
    };

    window.addEventListener('muara-sedekah-change', handleLocalSync);
    window.addEventListener('storage', handleLocalSync);

    handleUpdate();

    return () => {
      unsubscribeSnapshot();
      window.removeEventListener('muara-sedekah-change', handleLocalSync);
      window.removeEventListener('storage', handleLocalSync);
    };
  }, []);

  // Realtime subscription for real-world notifications matching target tags
  useEffect(() => {
    let cloudNotifs: any[] = [];
    let notificationDurationHours = 168; // Default 168 Jam (7 Hari & 7 Malam)
    let notificationsLastClearedAt = 0;

    // Load initial fallbacks from localStorage
    try {
      const storedDur = localStorage.getItem('muara_notifications_duration_hours');
      if (storedDur) notificationDurationHours = Number(storedDur);
      const storedClear = localStorage.getItem('muara_notifications_last_cleared');
      if (storedClear) notificationsLastClearedAt = Number(storedClear);
    } catch (e) {
      console.warn("Gagal membaca fallbacks:", e);
    }

    const handleUpdate = () => {
      // Load local cached notifications
      let localNotifs: any[] = [];
      try {
        const localStr = localStorage.getItem('muara_notifications_cache');
        if (localStr) {
          localNotifs = JSON.parse(localStr);
        }
      } catch (err) {
        console.warn("Gagal membaca muara_notifications_cache:", err);
      }

      const now = Date.now();
      const cutoffTimeMs = notificationDurationHours * 60 * 60 * 1000;

      // Auto-delete kedaluwarsa setelah ditentukan jam secara permanen dari sisi user (local cache)
      try {
        const localNotifsCleaned = localNotifs.filter((notif) => {
          let notifTime = 0;
          if (typeof notif.timestamp === 'number') {
            notifTime = notif.timestamp;
          } else if (notif.createdAt) {
            const parsed = new Date(notif.createdAt).getTime();
            if (!isNaN(parsed)) notifTime = parsed;
          }
          if (notifTime === 0) return true; // Biarkan jika tidak ada timestamp penanda
          
          // Clear if cleared by bulk delete
          if (notifTime <= notificationsLastClearedAt) return false;
          
          return (now - notifTime) <= cutoffTimeMs;
        });

        if (localNotifsCleaned.length !== localNotifs.length) {
          localStorage.setItem('muara_notifications_cache', JSON.stringify(localNotifsCleaned));
          localNotifs = localNotifsCleaned; // Jaga agar tetap konsisten paska pembersihan
        }
      } catch (localCleanErr) {
        console.warn("Gagal membersihkan cache notifikasi lokal kedaluwarsa:", localCleanErr);
      }

      // Merge cloud and local
      const mergedMap = new Map<string, any>();
      
      // Seed combined list, mengeliminasi yang melebihi batas jam atau terhapus secara massal dari cloud maupun lokal
      [...cloudNotifs, ...localNotifs].forEach((notif) => {
        if (notif && notif.id) {
          let notifTime = 0;
          if (typeof notif.timestamp === 'number') {
            notifTime = notif.timestamp;
          } else if (notif.createdAt) {
            const parsed = new Date(notif.createdAt).getTime();
            if (!isNaN(parsed)) notifTime = parsed;
          }
          const isCleared = notifTime > 0 && notifTime <= notificationsLastClearedAt;
          const isExpired = notifTime > 0 && (now - notifTime) > cutoffTimeMs;
          if (!isCleared && !isExpired) {
            mergedMap.set(notif.id, notif);
          }
        }
      });

      const allNotifs = Array.from(mergedMap.values());

      // Sort by timestamp desc (newest first)
      allNotifs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const filtered = allNotifs.filter((notif) => {
        const target = notif.target || 'all';

        // 1. Seluruh Pengguna
        if (target === 'all') return true;

        // 2. Premium VIP
        if (target === 'premium') {
          return userProfile.isLoggedIn && userProfile.membershipStatus === 'Premium Verified';
        }

        // 3. User Standar
        if (target === 'standar') {
          return userProfile.isLoggedIn && userProfile.membershipStatus !== 'Premium Verified';
        }

        // 4. Salah satu pengguna (single target)
        if (target === 'single') {
          const matchedById = userProfile.isLoggedIn && notif.targetUserId === userProfile.id;
          const matchedByEmail = userProfile.isLoggedIn && notif.targetUserEmail && (notif.targetUserEmail.toLowerCase() === userProfile.email.toLowerCase());
          return matchedById || matchedByEmail;
        }

        return false;
      });

      const finalNotifs: NotificationItem[] = filtered.map((item) => ({
        id: item.id,
        title: item.title || 'Pengumuman Baru',
        content: item.content || '',
        dateSent: item.dateSent || '',
        important: !!item.important,
        imageUrl: item.imageUrl || '',
        target: item.target || 'all',
        targetUserId: item.targetUserId || '',
        targetUserEmail: item.targetUserEmail || '',
        createdAt: item.createdAt || '',
      }));

      setNotifications(finalNotifs);
    };

    // 1. Snapshot Listener for cloud database
    const notifColRef = collection(firestore, 'notifications_logs');
    const unsubscribeSnapshot = onSnapshot(notifColRef, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      cloudNotifs = list;
      handleUpdate();
    }, (error) => {
      console.warn("Realtime notifications sync failed (permissions/offline), relying on fallback local cache:", error);
      handleUpdate(); // Still load local ones anyway!
    });

    // 1b. Realtime Listener for notification configuration settings
    const settingsRef = doc(firestore, 'app_configs', 'notifikasi_settings');
    const unsubscribeSettingsSnapshot = onSnapshot(settingsRef, (settingsSnap) => {
      if (settingsSnap.exists()) {
        const sData = settingsSnap.data();
        if (sData.durationHours) {
          notificationDurationHours = Number(sData.durationHours);
          localStorage.setItem('muara_notifications_duration_hours', String(sData.durationHours));
        }
        if (sData.lastClearedAt) {
          notificationsLastClearedAt = Number(sData.lastClearedAt);
          localStorage.setItem('muara_notifications_last_cleared', String(sData.lastClearedAt));
        }
      }
      handleUpdate();
    }, (err) => {
      console.warn('Gagal sync live notif settings, loading dari local fallback:', err);
      // Fallback
      const localDur = localStorage.getItem('muara_notifications_duration_hours');
      if (localDur) notificationDurationHours = Number(localDur);
      const localClear = localStorage.getItem('muara_notifications_last_cleared');
      if (localClear) notificationsLastClearedAt = Number(localClear);
      handleUpdate();
    });

    // 2. Custom window event listener for local broadcasts
    const handleLocalTrigger = () => {
      handleUpdate();
    };

    // Custom events
    const handleSettingsChange = (e: any) => {
      if (e.detail) {
        if (e.detail.durationHours) {
          notificationDurationHours = Number(e.detail.durationHours);
        }
        if (e.detail.lastClearedAt) {
          notificationsLastClearedAt = Number(e.detail.lastClearedAt);
        }
        handleUpdate();
      }
    };

    window.addEventListener('muara-new-notification', handleLocalTrigger);
    window.addEventListener('muara-notif-settings-change', handleSettingsChange);
    window.addEventListener('storage', handleLocalTrigger);

    // Run initial parse
    handleUpdate();

    return () => {
      unsubscribeSnapshot();
      unsubscribeSettingsSnapshot();
      window.removeEventListener('muara-new-notification', handleLocalTrigger);
      window.removeEventListener('muara-notif-settings-change', handleSettingsChange);
      window.removeEventListener('storage', handleLocalTrigger);
    };
  }, [userProfile.isLoggedIn, userProfile.membershipStatus, userProfile.id, userProfile.email]);

  // 3. Location and navigation tabs variables
  const [currentLocation, setCurrentLocation] = useState<{
    province: string;
    district: string;
    lat?: number;
    lng?: number;
  }>({
    province: 'Jawa Barat',
    district: 'Kecamatan Cisompet',
    lat: -7.42,
    lng: 107.78,
  });

  const [currentTab, setCurrentTab] = useState<'beranda' | 'jadwal' | 'kalender' | 'akun'>('beranda');

  // 4. Overlays widgets states
  const [isCompassOpen, setIsCompassOpen] = useState(false);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const [isPrayerTimesDetailOpen, setIsPrayerTimesDetailOpen] = useState(false);
  const [showStartPermissionsModal, setShowStartPermissionsModal] = useState(false);

  // Local cache for prayer times & active prayer name from Header
  const [prayerTimings, setPrayerTimings] = useState({
    subuh: "04:34",
    zuhur: "11:49",
    asar: "15:13",
    magrib: "17:41",
    isya: "18:54"
  });
  const [activePrayerName, setActivePrayerName] = useState("Zuhur");

  // Compass rotation degrees simulator
  const [compassHeading, setCompassHeading] = useState(294.5); // Exact Qibla angle from Bandung
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);

  // Unified State Tracker for hardware back button handler
  const appStateRef = useRef({
    currentTab,
    isCompassOpen,
    isLocationSelectorOpen,
    isPrayerTimesDetailOpen,
    showStartPermissionsModal
  });

  useEffect(() => {
    appStateRef.current = {
      currentTab,
      isCompassOpen,
      isLocationSelectorOpen,
      isPrayerTimesDetailOpen,
      showStartPermissionsModal
    };
  }, [currentTab, isCompassOpen, isLocationSelectorOpen, isPrayerTimesDetailOpen, showStartPermissionsModal]);

  // Handle local and native Android Capacitor physical back button behavior
  useEffect(() => {
    let sub: any = null;

    const setupCapacitorBack = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        sub = await CapApp.addListener('backButton', () => {
          // 1. Dispatch custom event to let nested interactive widgets consume/cancel the back press
          const customEvent = new CustomEvent('muara-hardware-back-button', {
            cancelable: true,
            detail: {
              handled: false,
              consume() {
                this.handled = true;
              }
            }
          });

          window.dispatchEvent(customEvent);

          if (customEvent.detail.handled) {
            // Event has been consumed and handled by a child overlay (e.g. KitabReader, MenuMembership)
            return;
          }

          const {
            currentTab,
            isCompassOpen,
            isLocationSelectorOpen,
            isPrayerTimesDetailOpen,
            showStartPermissionsModal
          } = appStateRef.current;

          // 2. Otherwise close local root-level overlay modals in hierarchy
          if (isCompassOpen) {
            setIsCompassOpen(false);
          } else if (isLocationSelectorOpen) {
            setIsLocationSelectorOpen(false);
          } else if (isPrayerTimesDetailOpen) {
            setIsPrayerTimesDetailOpen(false);
          } else if (showStartPermissionsModal) {
            setShowStartPermissionsModal(false);
          } else if (currentTab !== 'beranda') {
            // 3. If on a sub-tab, return to home/beranda
            setCurrentTab('beranda');
          } else {
            // 4. If we are on Home tab and everything is closed, tap back to exit/minimize app cleanly
            CapApp.minimizeApp();
          }
        });
      } catch (err) {
        console.log('[MUARA] Info: Native Capacitor backButton listener skipped (Running in web browser/preview mode):', err);
      }
    };

    setupCapacitorBack();

    return () => {
      if (sub) {
        sub.remove();
      }
    };
  }, []);

  // Auto-prompt permission popup on startup
  useEffect(() => {
    const isAsked = localStorage.getItem('muara_permissions_asked') === 'true';
    if (!isAsked) {
      // Small timeout to allow everything to mount gracefully
      const timer = setTimeout(() => {
        setShowStartPermissionsModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen to manual storage sync requests from the Profile drawer
  useEffect(() => {
    const handleTrigger = () => {
      downloadAndCacheAllKitabs();
    };
    window.addEventListener('muara-trigger-redownload', handleTrigger);
    return () => window.removeEventListener('muara-trigger-redownload', handleTrigger);
  }, []);

  // Silent downloader logic
  const downloadAndCacheAllKitabs = async () => {
    try {
      console.log("[MUARA] Memulai pengunduhan seluruh kitab untuk akses offline...");
      
      // 1. Caching MOCK_KITABS
      for (const k of MOCK_KITABS) {
        const isSaved = await indexedDbService.isSaved(k.id);
        if (!isSaved) {
          console.log(`[MUARA Offline] Menyimpan mock kitab: ${k.title}`);
          await indexedDbService.saveKitab(k);
        }
      }

      // 2. Fetch & Caching Firestore Kitabs
      const snap = await getDocs(collection(firestore, 'kitabs'));
      const firestoreList = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d
        } as any;
      });

      for (const k of firestoreList) {
        const isSaved = await indexedDbService.isSaved(k.id);
        if (!isSaved) {
          console.log(`[MUARA Offline] Menyimpan firestore kitab: ${k.title}`);
          await indexedDbService.saveKitab(k);
        }
      }

      // 3. Keep tracks of local customs if any
      const localCustomsRaw = localStorage.getItem('muara_custom_kitabs');
      if (localCustomsRaw) {
        const customs = JSON.parse(localCustomsRaw);
        for (const k of customs) {
          const isSaved = await indexedDbService.isSaved(k.id);
          if (!isSaved) {
            await indexedDbService.saveKitab(k);
          }
        }
      }

      console.log("[MUARA] Seluruh kitab berhasil terunduh ke penyimpanan lokal untuk dibaca offline!");
    } catch (err) {
      console.warn("[MUARA Offline Error] Gagal melakukan pra-unduh kitab:", err);
    }
  };

  // Active silent downloader when online and permission granted
  useEffect(() => {
    const isOfflineStorageGranted = localStorage.getItem('muara_storage_permission_granted') === 'true';
    if (isOfflineStorageGranted && navigator.onLine) {
      const t = setTimeout(() => {
        downloadAndCacheAllKitabs();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []);

  // Device orientation sensors for Qibla Compass
  useEffect(() => {
    if (!isCompassOpen) {
      setDeviceHeading(null);
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // webkitCompassHeading is supported on iOS Safari
      let heading = (e as any).webkitCompassHeading;
      
      if (heading === undefined) {
        if (e.alpha !== null) {
          // alpha goes 0 to 360 counter-clockwise. To make it clockwise:
          heading = (360 - e.alpha) % 360;
        }
      }

      if (heading !== undefined && heading !== null) {
        setDeviceHeading(Math.round(heading));
      }
    };

    // Ask iOS permissions if on Safari iOS
    const DeviceOrientationEventAny = DeviceOrientationEvent as any;
    if (typeof DeviceOrientationEventAny !== 'undefined' && typeof DeviceOrientationEventAny.requestPermission === 'function') {
      DeviceOrientationEventAny.requestPermission()
        .then((response: string) => {
          if (response === 'granted') {
            (window as any).addEventListener('deviceorientation', handleOrientation, true);
          }
        })
        .catch((err: any) => console.log("iOS Sensor Orientation permission fail:", err));
    } else {
      if ('ondeviceorientationabsolute' in window) {
        (window as any).addEventListener('deviceorientationabsolute', handleOrientation, true);
      } else {
        (window as any).addEventListener('deviceorientation', handleOrientation, true);
      }
    }

    return () => {
      (window as any).removeEventListener('deviceorientation', handleOrientation, true);
      (window as any).removeEventListener('deviceorientationabsolute', handleOrientation, true);
    };
  }, [isCompassOpen]);

  // Action callbacks: Account Logins
  const handleLogin = (name: string, email: string, phone: string) => {
    setUserProfile((prev) => ({
      ...prev,
      name,
      email,
      phone,
      isLoggedIn: true,
      membershipStatus: 'Gratis',
      role: 'user',
    }));
  };

  const handleAuthSuccess = (user: any) => {
    setUserProfile({
      id: user.uid,
      name: user.name,
      email: user.email,
      phone: user.phone,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isLoggedIn: true,
      membershipStatus: user.isPremium ? 'Premium Verified' : 'Gratis',
      role: user.role,
    });
  };

  const handleLogout = () => {
    clearSessionUser();
    setUserProfile({
      id: 'user-1',
      name: 'Firman Husen',
      email: 'firmanhusen255@gmail.com',
      phone: '081234567890',
      bio: 'Santri thalabul ilmi pencinta Kitab Kuning Digital',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
      isLoggedIn: false,
      membershipStatus: 'Gratis',
      role: 'user',
    });
    setCurrentTab('beranda');
  };

  const handleBuyMembership = async (planName: string) => {
    // Write request to Firestore 'membership_requests'
    if (userProfile.isLoggedIn) {
      try {
        const requestId = `req-${Date.now()}`;
        const finalUserId = userProfile.id || (userProfile as any).uid || 'guest-user';
        const finalUserName = userProfile.name || 'Hamba Allah';
        const finalUserEmail = userProfile.email || 'anonymous@gmail.com';
        const finalUserPhone = userProfile.phone || '';

        await setDoc(doc(firestore, 'membership_requests', requestId), {
          id: requestId,
          userId: finalUserId,
          userName: finalUserName,
          userEmail: finalUserEmail,
          userPhone: finalUserPhone,
          packageName: planName || 'Paket Premium Syariah',
          status: 'Pending',
          createdAt: new Date().toISOString(),
        });
        
        // Also save user profile as having requested
        setUserProfile((prev) => ({
          ...prev,
          membershipStatus: 'Gratis', // Keep as Gratis but can display a pending state indicator
        }));
      } catch (err: any) {
        console.error('Bypass Firestore or error on purchase request entry:', err);
      }
    } else {
      // Offline / fallback if not logged in
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const dateFormatted = nextYear.toISOString().split('T')[0];
      setUserProfile((prev) => ({
        ...prev,
        membershipStatus: 'Premium Verified',
        expiresAt: dateFormatted,
      }));
    }
  };

  const handleDonate = async (campaignId: string, amount: number) => {
    let updatedCampaign: any = null;

    setSedekahCampaigns((prev) => {
      const newList = prev.map((camp) => {
        if (camp.id === campaignId) {
          updatedCampaign = {
            ...camp,
            collectedAmount: camp.collectedAmount + amount,
            donorCount: camp.donorCount + 1,
          };
          return updatedCampaign;
        }
        return camp;
      });

      try {
        localStorage.setItem('muara_sedekah_cache', JSON.stringify(newList));
      } catch (err) {
        console.warn("Gagal simpan kontribusi sedekah ke cache:", err);
      }

      return newList;
    });

    if (updatedCampaign) {
      try {
        const docRef = doc(firestore, 'sedekah_campaigns', campaignId);
        await setDoc(docRef, updatedCampaign);
      } catch (dbErr) {
        console.warn("Firestore donation write bypassed/offline:", dbErr);
      }

      try {
        window.dispatchEvent(new CustomEvent('muara-sedekah-change', { detail: updatedCampaign }));
        localStorage.setItem('muara_sedekah_trigger', Date.now().toString());
      } catch (evErr) {
        console.warn("Gagal dispatch event sedekah:", evErr);
      }
    }
  };

  // Administration actions callbacks
  const handleAddNotification = (title: string, content: string, important: boolean) => {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title,
      content,
      dateSent: new Date().toISOString().split('T')[0],
      important,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleUpdateSedekahAdmin = (campaignId: string, amount: number) => {
    setSedekahCampaigns((prev) =>
      prev.map((camp) => {
        if (camp.id === campaignId) {
          return {
            ...camp,
            collectedAmount: Math.min(camp.targetAmount, camp.collectedAmount + amount),
          };
        }
        return camp;
      })
    );
  };

  const handleResetData = () => {
    setNotifications(INITIAL_NOTIFICATIONS);
    setSedekahCampaigns(INITIAL_SEDEKAH_CAMPAIGNS);
    setCurrentLocation({ province: 'Jawa Barat', district: 'Kecamatan Cisompet' });
    setUserProfile({
      id: 'user-1',
      name: 'Firman Husen',
      email: 'firmanhusen255@gmail.com',
      phone: '081234567890',
      bio: 'Santri thalabul ilmi pencinta Kitab Kuning Digital',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
      isLoggedIn: false,
      membershipStatus: 'Gratis',
      role: 'user',
    });
  };

  // Dynamic bottom navigation state syncs
  const handleTabChange = (tab: 'beranda' | 'jadwal' | 'kalender' | 'akun') => {
    if (tab === 'jadwal') {
      setIsPrayerTimesDetailOpen(true);
      return;
    } else if (tab === 'kalender') {
      // Direct scroll to Indonesian calendar inside Beranda page
      setCurrentTab('beranda');
      setTimeout(() => {
        const kalenderBtn = document.getElementById('cat-btn-kalender');
        if (kalenderBtn) {
          kalenderBtn.click();
          kalenderBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return;
    }
    setCurrentTab(tab);
  };

  const indonesianLocations = [
    { province: 'Jawa Barat', district: 'Kecamatan Cisompet' },
    { province: 'DKI Jakarta', district: 'Kecamatan Kebayoran Baru' },
    { province: 'Jawa Tengah', district: 'Kecamatan Banyumas' },
    { province: 'DI Yogyakarta', district: 'Kecamatan Depok Sleman' },
    { province: 'Jawa Timur', district: 'Kecamatan Sukolilo Surabaya' },
    { province: 'Banten', district: 'Kecamatan Serpong Tangerang' }
  ];

  const isUserAdmin = userProfile.isLoggedIn && userProfile.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white max-w-[768px] mx-auto shadow-2xl relative border-x border-slate-205">
      
      {/* 1. HEADER SECTION (with active prayer schedule widgets) */}
      <Header
        currentLocation={currentLocation}
        onOpenCompass={() => setIsCompassOpen(true)}
        onOpenLocationSelector={() => setIsLocationSelectorOpen(true)}
        onOpenPrayerTimesDetail={() => setIsPrayerTimesDetailOpen(true)}
        onChangeLocation={(loc) => setCurrentLocation(loc)}
        onPrayerTimingsChange={(timings, activeName) => {
          setPrayerTimings(timings);
          setActivePrayerName(activeName);
        }}
      />

      {/* 2. DYNAMIC BROADCAST WARNING IF IMPORTED DATA HAS AN IMPORTANT FLAG */}
      {notifications.some(n => n.important) && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-2 rounded-xl bg-red-50 p-3.5 border border-red-150 text-red-800 text-xs font-semibold animate-pulse shadow-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 rounded-md bg-red-500 text-white font-mono text-[9px]">PENTING</span>
            <span>{notifications.find(n => n.important)?.title}</span>
          </div>
          <button 
            onClick={() => {
              const notifBtn = document.getElementById('menu-btn-notifications');
              if (notifBtn) notifBtn.click();
            }}
            className="text-[10px] uppercase font-extrabold text-red-650 hover:underline shrink-0"
          >
            Baca →
          </button>
        </div>
      )}

      {/* 3. DYNAMIC PAGES VIEW SWAPPER ENGINES */}
      <main className="min-h-[500px]">
        {currentTab === 'beranda' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* CORE SUB-MENU TRIGGERS GRID */}
            <MenuUtama
              userProfile={userProfile}
              notifications={notifications}
              sedekahCampaigns={sedekahCampaigns}
              onLogin={handleLogin}
              onLogout={handleLogout}
              onBuyMembership={handleBuyMembership}
              onDonate={handleDonate}
              onLoginClick={() => setCurrentTab('akun')}
            />

            {/* ACTIVE SEARCH & DISCOVER CATEGORIES GRID */}
            <PencarianKategori
              userProfile={userProfile}
              onOpenProfile={() => setCurrentTab('akun')}
              onOpenPrayerTimes={() => setIsPrayerTimesDetailOpen(true)}
            />
          </motion.div>
        )}

        {currentTab === 'akun' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="px-6 py-4"
          >
            {/* BACK TO HOME NAVIGATION BUTTON */}
            <div className="mb-4">
              <button
                onClick={() => setCurrentTab('beranda')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-705 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl border transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Kembali Ke Beranda
              </button>
            </div>

            <SatuPintuAuth
              currentUser={
                userProfile.isLoggedIn
                  ? {
                      uid: userProfile.id,
                      name: userProfile.name,
                      email: userProfile.email,
                      phone: userProfile.phone,
                      bio: userProfile.bio,
                      avatarUrl: userProfile.avatarUrl,
                      role: userProfile.role || 'user',
                      isPremium: userProfile.membershipStatus === 'Premium Verified',
                      createdAt: new Date().toISOString(),
                      isLoggedIn: true
                    }
                  : null
              }
              onAuthSuccess={handleAuthSuccess}
              onLogout={handleLogout}
              onNavigateToAdmin={() => setCurrentTab('admin' as any)}
            />
          </motion.div>
        )}

        {/* PROTECTED ROUTES IMPLEMENTATION FOR THE ADMIN PANEL */}
        {currentTab === 'admin' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-6 py-4"
          >
            {isUserAdmin ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-red-500/10 to-red-500/5 p-5 rounded-2xl border border-red-500/25 text-red-900 flex justify-between items-center bg-red-50/20">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-red-650 rounded-xl text-white shadow-md animate-pulse">🔒 SECURE</span>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Gerbang Utama Administrasi MUARA</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Sesi Terenkripsi • Role: Administrator Aktif</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setCurrentTab('beranda')}
                    className="text-xs bg-white text-slate-700 hover:text-emerald-800 border px-3 py-1.5 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
                  >
                    Kembali Ke Beranda
                  </button>
                </div>

                <AdminPanel
                  onLogout={() => setCurrentTab('beranda')}
                />
              </div>
            ) : (
              // Access Denied Shield Warning - Secure Protected route gate preventing direct link bypass
              <div className="max-w-md mx-auto my-8 bg-white border border-red-150 p-6 rounded-2xl shadow-sm text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-800">403 Akses Ditolak: Area Terbatas</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Halaman Administrasi MUARA ini dilindungi oleh otentikasi verifikasi peran (Role-Based Access Control). Kredensial akun Anda tidak terdaftar sebagai Administrator.
                  </p>
                </div>
                <div className="p-3.5 bg-red-500/5 rounded-xl border border-red-500/10 text-[11px] text-slate-650 text-left font-mono leading-relaxed">
                  <strong>Deteksi Upaya Infiltrasi:</strong><br />
                  • Target: Dashboard Admin<br />
                  • Status Email: {userProfile.isLoggedIn ? userProfile.email : 'Belum Login'}<br />
                  • Tindakan: Unprivileged Access Blocked
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setCurrentTab('akun')}
                    className="flex-1 py-2.5 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Login Admin
                  </button>
                  <button
                    onClick={() => setCurrentTab('beranda')}
                    className="flex-1 py-2.5 border hover:bg-slate-50 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Kembali Beranda
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* ----------------- POPUP MODAL: QIBLA COMPASS ----------------- */}
      <Modal
        isOpen={isCompassOpen}
        onClose={() => setIsCompassOpen(false)}
        title="Kompas Kiblat Presisi"
      >
        <div className="text-center space-y-5 py-4">
          <p className="text-xs text-slate-500">
            Arahkan perangkat Anda mendatar. Putar-putar HP Anda sampai logo emas Kiblat lurus ke atas dan lingkaran menyala hijau menandakan arah Ka'bah Makkah Suci.
          </p>

          {/* Compass Graphic Wheel */}
          <div className={`relative mx-auto h-56 w-56 rounded-full border-4 flex items-center justify-center p-3 shadow-inner transition-all duration-300 ${
            Math.abs((294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360) < 7 || Math.abs(((294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360) - 360) < 7
              ? 'ring-4 ring-emerald-500 ring-offset-2 shadow-[0_0_25px_rgba(16,185,129,0.45)] border-emerald-500 bg-emerald-50/50' 
              : 'border-emerald-800/10 bg-[#eefdf4]/40'
          }`}>
            <div className="absolute inset-0 rounded-full border border-dashed border-emerald-500/20" />
            
            {/* Rotating Compass Rose containing Cardinal Directions (North U, South S, East T, West B) */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ rotate: `${(360 - (deviceHeading !== null ? deviceHeading : compassHeading)) % 360}deg` }}
              animate={{ rotate: (360 - (deviceHeading !== null ? deviceHeading : compassHeading)) % 360 }}
              transition={{ type: 'spring', stiffness: 50, damping: 14 }}
            >
              {/* North, South, East, West Decals inside the rotating rose */}
              <span className="absolute top-3 font-mono text-xs font-black text-red-650">U</span>
              <span className="absolute bottom-3 font-mono text-xs font-black text-slate-500">S</span>
              <span className="absolute right-3 font-mono text-xs font-black text-slate-500">T</span>
              <span className="absolute left-3 font-mono text-xs font-black text-slate-500">B</span>
              
              <div className="h-0.5 w-[85%] bg-slate-350/20 absolute" />
              <div className="w-0.5 h-[85%] bg-slate-350/20 absolute" />
            </motion.div>

            {/* Separately Rotatable Gold Qibla Needle */}
            <motion.div
              className="relative h-full w-full flex items-center justify-center z-10 pointer-events-none"
              style={{ rotate: `${(294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360}deg` }}
              animate={{ rotate: (294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360 }}
              transition={{ type: 'spring', stiffness: 60, damping: 15 }}
            >
              {/* Islamic Qibla Star Indicator Icon */}
              <div className="absolute top-0 flex flex-col items-center">
                <Compass className={`h-6 w-6 text-amber-500 animate-pulse ${
                  Math.abs((294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360) < 7 || Math.abs(((294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360) - 360) < 7
                    ? 'scale-115 text-emerald-650' 
                    : ''
                }`} />
                <span className={`text-[8px] font-black uppercase tracking-widest font-mono mt-0.5 ${
                  Math.abs((294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360) < 7 || Math.abs(((294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360) - 360) < 7
                    ? 'text-emerald-700' 
                    : 'text-amber-600'
                }`}>KIBLAT</span>
              </div>

              {/* Standard needle lines */}
              <div className="h-0.75 w-1/2 bg-amber-200 absolute right-1/2" />
              <div className="h-0.75 w-1/2 bg-amber-500 absolute left-1/2" />

              {/* Gold direction needle center */}
              <div className="absolute h-4 w-4 rounded-full bg-amber-500 border-2 border-white shadow-md z-20" />
              <div className="h-24 w-1 bg-gradient-to-b from-amber-500 to-transparent absolute top-5 z-20" />
            </motion.div>
          </div>

          <div className="flex justify-around items-center bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-xs font-mono">
            <div>
              <span className="block text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold text-center tracking-widest">DIREKSI HEADING</span>
              <span className="font-extrabold text-emerald-800 text-sm">{deviceHeading !== null ? deviceHeading : compassHeading}° NW</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-205" />
            <div>
              <span className="block text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold text-center tracking-widest block">STATUS HP</span>
              <span className={`font-extrabold text-[10px] block text-center px-1.5 py-0.5 rounded-md ${deviceHeading !== null ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                {deviceHeading !== null ? '📱 Giro Sensor' : '💻 Simulator'}
              </span>
            </div>
            <div className="h-8 w-[1px] bg-slate-205" />
            <div>
              <span className="block text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold text-center tracking-widest">AKURASI</span>
              <span className="font-extrabold text-emerald-800 text-sm">± 7.914 KM</span>
            </div>
          </div>

          {/* Alignment status alert indicator */}
          <AnimatePresence>
            {(Math.abs((294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360) < 7 || Math.abs(((294.5 - (deviceHeading !== null ? deviceHeading : compassHeading) + 360) % 360) - 360) < 7) && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4 text-emerald-600 animate-bounce animate-duration-1000 shrink-0" />
                <span>✓ HP Anda telah menghadap ke kiblat Ka'bah Makkah!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Calibrate compass heading slider when device heading sensor is null */}
          {deviceHeading === null && (
            <div className="space-y-1 bg-amber-50/40 p-3 rounded-lg border border-amber-150 text-[11px] text-slate-650">
              <span className="font-bold text-amber-800">Simulator Sensor Orientasi (Gerakkan Slider):</span>
              <input
                type="range"
                min="0"
                max="359"
                value={compassHeading}
                onChange={(e) => setCompassHeading(parseInt(e.target.value))}
                className="w-full h-1 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600 mt-2"
              />
              <p className="text-[10px] text-slate-450 mt-1">Seret slider untuk mensimulasikan memutar hp di emulator/luring.</p>
            </div>
          )}
        </div>
      </Modal>


      {/* ----------------- POPUP MODAL: LOCATION SELECTOR ----------------- */}
      <Modal
        isOpen={isLocationSelectorOpen}
        onClose={() => setIsLocationSelectorOpen(false)}
        title="Ubah Koordinat Lokasi"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 mb-2">
            Pilihlah salah satu kecamatan di bawah ini untuk mensimulasikan pembaharuan jadwal adzan shalat dan koordinat kompas kiblat secara dinamis.
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {indonesianLocations.map((loc, i) => {
              const isSelected = currentLocation.district === loc.district;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setCurrentLocation(loc);
                    setIsLocationSelectorOpen(false);
                    // Mock update compass bearing slightly based on location select index
                    setCompassHeading(291 + i * 2);
                  }}
                  className={`w-full p-4 rounded-xl text-left border flex justify-between items-center transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-750'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className={`h-4.5 w-4.5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <span className="block text-xs font-semibold">{loc.district}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{loc.province} - Indonesia</span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4.5 w-4.5 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* ----------------- POPUP MODAL: PRAYER ADVANCED SCHEDULE ----------------- */}
      <PrayerTimesDetailModal
        isOpen={isPrayerTimesDetailOpen}
        onClose={() => setIsPrayerTimesDetailOpen(false)}
        district={currentLocation.district}
        province={currentLocation.province}
        prayerTimings={prayerTimings}
        activePrayerName={activePrayerName}
      />

      {/* ----------------- POPUP MODAL: STARTUP PERMISSIONS ----------------- */}
      <AnimatePresence>
        {showStartPermissionsModal && (
          <div className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white text-slate-800 p-5 sm:p-7 rounded-3xl max-w-sm w-full shadow-2xl border border-emerald-100 flex flex-col space-y-4"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 border border-emerald-150 flex items-center justify-center text-emerald-600 shadow-inner">
                  <BookOpen className="h-6 w-6 text-emerald-600 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-slate-850 text-sm sm:text-base leading-snug">
                  Apakah aplikasi Muara ingin bisa dibuka di saat offline?
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                  Dengan mengizinkan akses offline, sistem akan otomatis menyimpan kitab kuning di penyimpanan lokal sehingga kitab tersebut bisa dibuka di saat kamu sedang offline.
                </p>
              </div>

              <div className="space-y-3">
                {/* 1. Izin Penyimpanan Kitab */}
                <div className="flex gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150 text-[10px] sm:text-xs">
                  <BookOpen className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-slate-800">Simpan Kitab Otomatis</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5 leading-snug">
                      Menyimpan kitab secara otomatis di penyimpanan lokal untuk mutholaah secara offline.
                    </span>
                  </div>
                </div>

                {/* 2. Izin Lokasi */}
                <div className="flex gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150 text-[10px] sm:text-xs">
                  <MapPin className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-slate-800">Geolokasi Waktu Shalat</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5 leading-snug">
                      Meretensi koordinat GPS perangkat agar kalkulasi jadwal shalat & penentu arah Kiblat akurat sesuai wilayah Anda.
                    </span>
                  </div>
                </div>

                {/* 3. Izin Alarm Notifikasi Audio Azan */}
                <div className="flex gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150 text-[10px] sm:text-xs">
                  <BellRing className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <span className="block font-bold text-slate-800">Alarm Audio Azan Otomatis</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5 leading-snug">
                      Mengizinkan interetensi sistem operasi agar mampu mengumandangkan suara Azan secara penuh tepat waktu saat memasuki waktu shalat fardhu.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2 font-sans">
                <button
                  type="button"
                  onClick={async () => {
                    localStorage.setItem('muara_permissions_asked', 'true');
                    localStorage.setItem('muara_storage_permission_granted', 'true');
                    setShowStartPermissionsModal(false);
                    
                    // =========================================================================
                    // 🛡️ SUNTIKAN INTEGRATION: MEMINTA IZIN NOTIFIKASI NATIVE CAPACITOR UNTUK AZAN
                    // =========================================================================
                    try {
                      const { LocalNotifications } = await import('@capacitor/local-notifications');
                      const checkPerm = await LocalNotifications.checkPermissions();
                      
                      if (checkPerm.display !== 'granted') {
                        const reqPerm = await LocalNotifications.requestPermissions();
                        if (reqPerm.display === 'granted') {
                          console.log('[MUARA PERMISSION] Izin Notifikasi Native Android Diberikan!');
                          localStorage.setItem('muara_azan_permission_granted', 'true');
                        }
                      } else {
                        localStorage.setItem('muara_azan_permission_granted', 'true');
                      }
                    } catch (notificationErr) {
                      console.log('[MUARA Web Fallback] Gagal memuat LocalNotifications (Berjalan di Web Browser biasa):', notificationErr);
                    }
                    // =========================================================================

                    // Request GPS location
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          const { latitude, longitude } = pos.coords;
                          try {
                            const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=id`;
                            const response = await fetch(geoUrl);
                            if (response.ok) {
                              const data = await response.json();
                              const address = data.address || {};
                              const rawDistrict = address.suburb || address.village || address.city_district || address.town || address.county || address.municipality || 'Cisompet';
                              const cleanDistrict = rawDistrict.startsWith('Kecamatan') ? rawDistrict : `Kecamatan ${rawDistrict}`;
                              const cleanProvince = address.state || address.region || 'Jawa Barat';
                              
                              setCurrentLocation({
                                province: cleanProvince,
                                district: cleanDistrict,
                                lat: latitude,
                                lng: longitude
                              });
                            }
                          } catch (e) {
                            setCurrentLocation(prev => ({
                              ...prev,
                              lat: latitude,
                              lng: longitude
                            }));
                          }
                        },
                        (err) => console.log("Gagal atau ditolak mengambil GPS awal", err),
                        { enableHighAccuracy: true, timeout: 5000 }
                      );
                    }

                    // Start silent background kitab downloader
                    downloadAndCacheAllKitabs();
                  }}
                  className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer text-center"
                >
                  Ya, Izinkan
                </button>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('muara_permissions_asked', 'true');
                    localStorage.setItem('muara_storage_permission_granted', 'false');
                    setShowStartPermissionsModal(false);
                  }}
                  className="w-full py-2 bg-transparent hover:bg-slate-50 text-slate-500 rounded-xl font-medium text-xs transition-colors cursor-pointer text-center"
                >
                  Nanti Saja (Buka Online)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING PINTER ASSISTANT FITUR SANTRI AI */}
      <SantriAI 
        userProfile={userProfile} 
        onOpenUpgradeModal={() => {
          window.dispatchEvent(new CustomEvent('muara-open-membership'));
        }} 
      />

    </div>
  );
}

// Simple loader inline component
function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      className={`animate-spin ${className}`} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}