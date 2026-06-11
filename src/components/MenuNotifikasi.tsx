import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, Eye, Calendar, User, FileText, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from './Modal';
import { NotificationItem } from '../types';

interface MenuNotifikasiProps {
  notifications: NotificationItem[];
}

export default function MenuNotifikasi({ notifications }: MenuNotifikasiProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);

  useEffect(() => {
    const handleBackButton = (e: any) => {
      if (selectedNotif) {
        setSelectedNotif(null);
        e.detail?.consume?.();
      } else if (isOpen) {
        setIsOpen(false);
        e.detail?.consume?.();
      }
    };
    window.addEventListener('muara-hardware-back-button', handleBackButton);
    return () => {
      window.removeEventListener('muara-hardware-back-button', handleBackButton);
    };
  }, [isOpen, selectedNotif]);
  
  // Load read notifications tracking from safe local storage
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('muara_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Calculate actual unread count
  const unreadCount = notifications.filter((notif) => !readIds.includes(notif.id)).length;

  const handleOpenNotification = (notif: NotificationItem) => {
    setSelectedNotif(notif);
    if (!readIds.includes(notif.id)) {
      const newReadIds = [...readIds, notif.id];
      setReadIds(newReadIds);
      localStorage.setItem('muara_read_notifications', JSON.stringify(newReadIds));
    }

    // Direct redirection for Bahtsul Masail notifications
    const titleL = notif.title.toLowerCase();
    const contentL = notif.content.toLowerCase();
    const isBahtsul = (notif as any).category === 'bahtsul_masail' || 
                      titleL.includes('bahtsul') || 
                      contentL.includes('bahtsul') ||
                      titleL.includes('komentar') ||
                      titleL.includes('balasan') ||
                      titleL.includes('suka baru') ||
                      contentL.includes('menyukai status') ||
                      contentL.includes('mengomentari status') ||
                      contentL.includes('membalas komentar');
                      
    if (isBahtsul) {
      const problemId = (notif as any).problemId || '';
      const commentId = (notif as any).commentId || '';
      let actionType = 'comment';
      if (titleL.includes('suka') || contentL.includes('menyukai') || titleL.includes('like')) {
        actionType = 'like';
      }
      window.dispatchEvent(new CustomEvent('muara-open-bahtsul', { 
        detail: { 
          problemId, 
          commentId,
          type: actionType 
        } 
      }));
      // Close the notification list modal and selected notification reader modal
      setIsOpen(false);
      setSelectedNotif(null);
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    localStorage.setItem('muara_read_notifications', JSON.stringify(allIds));
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        id="menu-btn-notifications"
        onClick={() => setIsOpen(true)}
        className="flex flex-col items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-center transition-all bg-gradient-to-br from-slate-50 to-emerald-50/20 border-emerald-100 hover:border-emerald-200 hover:shadow-md relative cursor-pointer h-full"
      >
        {unreadCount > 0 && (
          <span className="absolute top-1 right-2 sm:top-2 sm:right-3 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-emerald-600 text-[8px] sm:text-[10px] font-extrabold text-white shadow-sm ring-1 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
        <div className="flex items-center justify-center h-[42px] w-[42px] sm:h-12 sm:w-12 rounded-full bg-emerald-100 text-[#064e3b] mb-1.5 sm:mb-2 shrink-0">
          <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[11px] sm:text-xs font-bold text-slate-800 truncate">Notifikasi</span>
          <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate font-semibold">
            {unreadCount > 0 ? `${unreadCount} Baru` : 'Tidak Ada Baru'}
          </span>
        </div>
      </motion.button>

      {/* PRIMARY NOTIFICATIONS LIST OVERLAY */}
      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title="Pengumuman & Kabaran Santri"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3.5">
            <p className="text-[11px] text-slate-500 max-w-[70%]">
              Daftar siaran maklumat pengajian, pembaruan materi Kitab Kuning, dan info penting pesantren.
            </p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-[10px] text-emerald-800 font-bold hover:underline bg-emerald-50 px-2 py-1 rounded-lg cursor-pointer"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Selesai Dibaca
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="h-10 w-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs text-slate-400 font-medium">Belum ada pengumuman masuk saat ini.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isRead = readIds.includes(notif.id);
                return (
                  <div 
                    key={notif.id}
                    onClick={() => handleOpenNotification(notif)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left relative break-words ${
                      !isRead 
                        ? 'bg-emerald-50/45 border-emerald-150 hover:bg-emerald-50/70 shadow-2xs' 
                        : 'bg-white border-slate-150 hover:bg-slate-50/50'
                    }`}
                  >
                    {!isRead && (
                      <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                    )}
                    
                    <div className="space-y-1.5 font-sans">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wide ${
                          !isRead 
                            ? 'bg-emerald-600 text-white animate-pulse' 
                            : 'bg-slate-200 text-slate-600 font-bold'
                        }`}>
                          {!isRead ? 'Belum Dibaca' : 'Sudah Dibaca'}
                        </span>

                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wide ${
                          notif.important 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {notif.important ? 'VIP Terbatas' : 'Siaran Santri'}
                        </span>
                        
                        {notif.imageUrl && (
                          <span className="flex items-center gap-0.5 text-[8.5px] font-bold text-emerald-700 bg-emerald-55/40 px-1.5 py-0.5 rounded-md">
                            <Image className="h-2.5 w-2.5" /> Lampiran
                          </span>
                        )}
                      </div>

                      <h4 className={`text-slate-850 text-xs leading-snug pr-4 ${!isRead ? 'font-extrabold' : 'font-bold'}`}>
                        {notif.title}
                      </h4>
                      
                      <p className="text-[10.5px] text-slate-500 line-clamp-2 leading-relaxed">
                        {notif.content}
                      </p>

                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1.5 border-t border-dashed border-slate-100">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5 text-slate-400" /> {notif.dateSent}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-800 font-bold">
                          <Eye className="h-3 w-3" /> Baca Kabar
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* INDIVIDUAL DETAILED NOTIFICATION READER */}
      <AnimatePresence>
        {selectedNotif && (
          <Modal 
            isOpen={!!selectedNotif} 
            onClose={() => setSelectedNotif(null)} 
            title="Maklumat Lengkap"
          >
            <div className="space-y-4 text-xs font-sans">
              <div className="space-y-1 border-b pb-3">
                <span className="inline-block text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider mb-1">
                  Pesan Terverifikasi Admin
                </span>
                <h3 className="font-extrabold text-slate-850 text-sm md:text-base leading-snug">
                  {selectedNotif.title}
                </h3>
                <div className="flex gap-4 text-[9.5px] text-slate-450 pt-1 font-mono">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {selectedNotif.dateSent}</span>
                  <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 text-emerald-700" /> Oleh: Admin MUARA</span>
                </div>
              </div>

              {/* Uploaded Compressed Image Display */}
              {selectedNotif.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 max-h-[220px] flex items-center justify-center">
                  <img 
                    src={selectedNotif.imageUrl} 
                    alt="Lampiran Pengumuman" 
                    referrerPolicy="no-referrer"
                    className="object-contain w-full h-full max-h-[220px] transition-transform hover:scale-102"
                  />
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/60">
                <p className="text-[11.5px] text-slate-700 font-normal leading-relaxed whitespace-pre-wrap break-words">
                  {selectedNotif.content}
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl pointer shadow-2xs text-[11px]"
                >
                  Tutup Kabar
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
