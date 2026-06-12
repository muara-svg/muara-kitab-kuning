import React from 'react';
import { User, Edit, Trash2, BookOpen, MessageSquare, Heart, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';

interface MasailProblem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userBio: string;
  title: string;
  content: string;
  referenceKitab: string;
  likesCount: number;
  likedBy: string[]; // List of user IDs who liked
  commentsCount: number;
  createdAt: string;
  pinned?: boolean;
  pinnedUntil?: string | null;
  aiAutoReplied?: boolean;
}

interface BahtsulMasailMyPostsProps {
  problems: MasailProblem[];
  userProfile: UserProfile;
  setCurrentSubView: (view: 'feed' | 'my-posts') => void;
  setEditingProblem: (prob: MasailProblem) => void;
  setDeletingProblemId: (id: string) => void;
  setActiveProblemId: (id: string) => void;
  getMatchingKitab: (titleStr: string) => any;
  setSelectedReferencedKitab: (kitab: any) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function BahtsulMasailMyPosts({
  problems,
  userProfile,
  setCurrentSubView,
  setEditingProblem,
  setDeletingProblemId,
  setActiveProblemId,
  getMatchingKitab,
  setSelectedReferencedKitab,
  showToast,
}: BahtsulMasailMyPostsProps) {
  const displayed = problems.filter((p) => p.userId === userProfile.id);

  return (
    <div className="space-y-4">
      {/* Dashboard Header Bar */}
      <div className="bg-gradient-to-r from-amber-500/10 to-transparent p-3 sm:p-4 rounded-2xl border border-amber-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-900 shadow-sm select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-amber-500/15 text-amber-800 flex items-center justify-center border border-amber-300 shrink-0">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-xs sm:text-sm text-slate-800 block">Koleksi Postingan Saya</span>
            <p className="text-[9px] sm:text-[10px] text-slate-500 truncate">Mengelola, membalas, mengedit, atau menghapus postingan Anda</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCurrentSubView('feed')}
          className="text-[9px] sm:text-[10px] hover:bg-slate-200 border border-slate-300 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer bg-white text-slate-700 shrink-0 w-fit align-middle"
        >
          ← Forum Utama
        </button>
      </div>

      {/* List of user's problems */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-500 text-xs bg-white rounded-xl sm:rounded-2xl border border-slate-100/80">
            <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 mx-auto text-amber-500/60 mb-2 animate-bounce" />
            <span>Anda belum mengajukan masalah bahasan apapun. Silakan klik tombol (+) untuk membuat post baru!</span>
          </div>
        ) : (
          displayed.map((prob, index) => {
            return (
              <div
                key={prob.id || `prob-display-${index}`}
                className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200/50 hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                      {new Date(prob.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* EDIT ACTION */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProblem(prob);
                        }}
                        className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#064e3b] transition-all cursor-pointer border border-emerald-100 hover:scale-105 shrink-0"
                        title="Modifikasi teks rujukan"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>

                      {/* DELETE ACTION */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProblemId(prob.id);
                        }}
                        className="p-1 sm:p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all cursor-pointer border border-rose-100 hover:scale-105 shrink-0"
                        title="Hapus postingan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveProblemId(prob.id)}
                    className="cursor-pointer space-y-1 group"
                  >
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-1">
                      {prob.title}
                    </h4>
                    <p className="text-[10px] sm:text-xs text-slate-600 leading-relaxed line-clamp-2 select-none">
                      {prob.content}
                    </p>
                  </div>
                </div>

                {/* Clickable Kitab reference decaling */}
                <div
                  onClick={() => {
                    const mKitab = getMatchingKitab(prob.referenceKitab);
                    if (mKitab) {
                      setSelectedReferencedKitab(mKitab);
                    } else {
                      showToast(`📖 "${prob.referenceKitab}" belum terdigitalisasi penuh.`, 'info');
                    }
                  }}
                  className="mt-2.5 px-2 py-1.5 bg-emerald-50/50 hover:bg-emerald-100/60 rounded-lg border border-emerald-100/60 text-[9px] sm:text-[10px] font-mono text-[#064e3b] max-w-full truncate flex items-center justify-between cursor-pointer select-none shadow-3xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate mr-1">Rujukan: <strong className="font-extrabold">{prob.referenceKitab}</strong></span>
                  </div>
                  <span className="text-[8px] bg-emerald-600 text-white font-extrabold px-1 rounded-sm flex items-center shrink-0">BACA</span>
                </div>

                {/* Footer stats row */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 font-mono">
                  <span
                    onClick={() => setActiveProblemId(prob.id)}
                    className="text-[9px] sm:text-[10.5px] text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Tanggapan ({prob.commentsCount}) & Lihat Diskusi →
                  </span>

                  <span className="text-[9.5px] text-amber-600 flex items-center gap-1">
                    <Heart className="h-3 w-3 text-amber-500 fill-amber-500" />
                    {prob.likesCount} Suka
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
