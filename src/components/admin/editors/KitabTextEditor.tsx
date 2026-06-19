import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Save, 
  X, 
  ArrowUp, 
  ArrowDown, 
  PlusCircle, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  BookOpen,
  AlignLeft,
  Settings,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KitabTextEditorProps {
  isOpen: boolean;
  onClose: () => void;
  kitabTitle: string;
  kitabJenis: string;
  initialPages: string[];
  initialTextBody: string;
  onSave: (pages: string[], textBody: string) => void;
  onSuccessMessage: (msg: string) => void;
}

export default function KitabTextEditor({
  isOpen,
  onClose,
  kitabTitle,
  kitabJenis,
  initialPages,
  initialTextBody,
  onSave,
  onSuccessMessage
}: KitabTextEditorProps) {
  const [editorPages, setEditorPages] = useState<string[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  
  // Custom states for the new features
  const [targetWordCount, setTargetWordCount] = useState<number>(200);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Initialize editor pages when modal opens or initialPages changes
  useEffect(() => {
    if (isOpen) {
      if (initialPages && initialPages.length > 0) {
        setEditorPages([...initialPages]);
      } else if (initialTextBody) {
        // Auto convert to pages if pages array is empty
        setEditorPages(autoSplitTextByWords(initialTextBody, targetWordCount));
      } else {
        setEditorPages(['']);
      }
      setActivePageIndex(0);
    }
  }, [isOpen, initialPages, initialTextBody]);

  // Helper to split text by word limits
  const autoSplitTextByWords = (text: string, wordsPerPage: number): string[] => {
    if (!text) return [''];
    
    // Clean excessive spaces first for premium word parsing
    const cleanedText = text.replace(/[\s\t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    const words = cleanedText.split(/\s+/);
    
    if (words.length === 0 || words[0] === '') return [''];
    
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerPage) {
      const slice = words.slice(i, i + wordsPerPage);
      chunks.push(slice.join(' '));
    }
    
    return chunks;
  };

  // Re-split the current overall text body based on the custom word limit
  const handleAutoSplit = () => {
    const fullText = editorPages.join('\n\n');
    if (!fullText.trim()) {
      onSuccessMessage('Teks masih kosong. Silakan isi terlebih dahulu.');
      return;
    }
    const newlySplit = autoSplitTextByWords(fullText, targetWordCount);
    setEditorPages(newlySplit);
    setActivePageIndex(0);
    onSuccessMessage(`Teks berhasil di-split ulang otomatis menjadi ${newlySplit.length} Halaman (Target ~${targetWordCount} kata per halaman).`);
  };

  // Auto clean up spaces, multi-enters, tabs across all pages to make them pristine
  const handleCleanSpaces = () => {
    let affectedCount = 0;
    const cleaned = editorPages.map(page => {
      if (!page) return page;
      const beforeStr = page;

      // 1. Pecah per baris untuk merapikan spasi di ujung setiap baris dengan aman
      let lines = page.split(/\r?\n/);
      
      // Bersihkan spasi ganda horizontal/tab dan potong spasi di awal/akhir baris
      lines = lines.map(line => line.replace(/[ \t]+/g, ' ').trim());
      
      // Gabungkan kembali
      let cleanedPage = lines.join('\n');
      
      // 2. Ciutkan 3 atau lebih enter berturut-turut menjadi maksimal 2 enter (1 baris kosong / paragraf bersih)
      cleanedPage = cleanedPage.replace(/\n{3,}/g, '\n\n');
      
      cleanedPage = cleanedPage.trim();
      
      if (beforeStr !== cleanedPage) {
        affectedCount++;
      }
      return cleanedPage;
    });

    setEditorPages(cleaned);
    onSuccessMessage(`Auto-Spasi sukses! Jarak antar-paragraf dan enter berlebih berhasil dirapikan pada ${affectedCount} halaman.`);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex flex-col font-sans"
      >
        {/* TOP ACTIONS PANELS */}
        <div className="bg-[#03362a] text-white p-3 px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md border-b border-emerald-950">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-950 p-2 rounded-xl border border-emerald-800">
              <FileText className="h-5 w-5 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold tracking-tight flex items-center gap-1.5 uppercase font-sans">
                Editor Manuskrip Pintar <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.5 rounded-full font-serif lowercase italic">pro ms-style</span>
              </h4>
              <p className="text-[10px] text-emerald-200/90 font-mono mt-0.5">
                Kitab: {kitabTitle || 'Manuskrip Baru'}
              </p>
            </div>
          </div>

          {/* ACTIVE MANAGEMENT CONTROLS */}
          <div className="flex flex-wrap items-center gap-3">
            {/* WORD COUNT CUSTOM LIMIT SPLITTER */}
            <div className="flex items-center gap-1.5 bg-emerald-950/80 p-1.5 px-3 rounded-xl border border-emerald-850">
              <span className="text-[10px] font-bold text-emerald-300 uppercase">Jml Kata/Hal:</span>
              <input 
                type="number" 
                value={targetWordCount} 
                onChange={(e) => setTargetWordCount(Math.max(10, parseInt(e.target.value) || 200))}
                className="w-12 bg-emerald-900 text-white font-mono text-[10px] font-bold text-center rounded border border-emerald-700/60 p-0.5 focus:outline-none"
                title="Aturan Manual Jumlah Kata per Halaman untuk Autorapih"
              />
              <button
                type="button"
                onClick={handleAutoSplit}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 px-2 py-0.5 rounded font-bold text-[9px] transition-all cursor-pointer shadow-2xs"
                title="Pecah Ulang Halaman Berdasarkan Aturan Jumlah Kata"
              >
                <Scissors className="h-2.5 w-2.5" /> Auto-Split
              </button>
            </div>

            {/* AUTO SPACE SPARK ACTION */}
            <button
              type="button"
              onClick={handleCleanSpaces}
              className="flex items-center gap-1 bg-emerald-900 hover:bg-emerald-850 text-emerald-100 border border-emerald-755 px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition-all cursor-pointer shadow-2xs"
              title="Menghapus spasi ganda, enter bertumpuk, dan jarak berlebih di seluruh halaman"
            >
              <Sparkles className="h-3 w-3 text-amber-300 animate-spin" /> Auto-Spasi & Enter
            </button>

            <span className="text-emerald-800/60 hidden md:inline">|</span>

            {/* STATUS AND SUBMISSION */}
            <div className="hidden lg:flex items-center gap-1 bg-emerald-950/40 px-2.5 py-1 rounded-lg text-[9.5px] font-mono text-emerald-250">
              <span className="text-emerald-300 font-bold">{editorPages.length}</span> Hal
              <span>•</span>
              <span className="text-emerald-300 font-bold">
                {editorPages.reduce((acc, p) => acc + p.trim().split(/\s+/).filter(Boolean).length, 0)}
              </span> kata
            </div>

            <button
              type="button"
              onClick={() => {
                const trimmedPages = editorPages.map(p => p.trim());
                onSave(trimmedPages, trimmedPages.join('\n\n'));
                onSuccessMessage('Kanal halaman hasil suntingan berhasil dimuat.');
              }}
              className="flex items-center gap-1.5 bg-amber-450 hover:bg-amber-500 text-slate-900 font-extrabold text-[11px] px-3.5 py-1.5 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" /> Terapkan Halaman
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-red-900/95 hover:bg-red-950 text-red-100 font-bold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5 inline mr-1" /> Batal
            </button>
          </div>
        </div>

        {/* LOWER MAIN AREA WITH 2 COLUMNS */}
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR: MINI PAGE NAVIGATOR */}
          <div className="w-56 bg-slate-850 border-r border-slate-700/80 flex flex-col overflow-hidden text-slate-300">
            <div className="p-3 bg-slate-900 border-b border-slate-750 flex items-center justify-between text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
              <span>Urutan Halaman</span>
              <button
                type="button"
                onClick={() => {
                  const updated = [...editorPages];
                  updated.push('');
                  setEditorPages(updated);
                  setActivePageIndex(updated.length - 1);
                }}
                className="p-1 rounded bg-emerald-900/80 text-emerald-300 hover:bg-emerald-800 transition-colors cursor-pointer"
                title="Tambah Halaman Baru di Akhir"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800">
              {editorPages.map((pageContent, idx) => (
                <div 
                  key={idx}
                  onClick={() => setActivePageIndex(idx)}
                  className={`group p-2.5 rounded-xl border transition-all cursor-pointer relative text-left ${
                    idx === activePageIndex 
                      ? 'bg-[#064e40] border-emerald-400 shadow-md text-white' 
                      : 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 font-mono text-[9px] font-bold">
                    <span className={idx === activePageIndex ? 'text-emerald-205' : 'text-slate-400'}>
                      HALAMAN {idx + 1}
                    </span>
                    
                    {/* REORGANIZE ACTIONS */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (idx === 0) return;
                          const updated = [...editorPages];
                          const temp = updated[idx];
                          updated[idx] = updated[idx - 1];
                          updated[idx - 1] = temp;
                          setEditorPages(updated);
                          setActivePageIndex(idx - 1);
                        }}
                        className="p-0.5 rounded hover:bg-slate-650 text-slate-200 disabled:opacity-30 cursor-pointer"
                        title="Naikkan posisi"
                      >
                        <ArrowUp className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === editorPages.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (idx === editorPages.length - 1) return;
                          const updated = [...editorPages];
                          const temp = updated[idx];
                          updated[idx] = updated[idx + 1];
                          updated[idx + 1] = temp;
                          setEditorPages(updated);
                          setActivePageIndex(idx + 1);
                        }}
                        className="p-0.5 rounded hover:bg-slate-650 text-slate-200 disabled:opacity-30 cursor-pointer"
                        title="Turunkan posisi"
                      >
                        <ArrowDown className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] line-clamp-2 leading-relaxed opacity-85 font-serif">
                    {pageContent.trim() || <span className="italic text-[9px] opacity-40">&lt;Halaman kosong&gt;</span>}
                  </p>

                  {/* QUICK DELETE */}
                  {editorPages.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Apakah Anda yakin ingin menghapus Halaman ${idx + 1}?`)) {
                          const updated = editorPages.filter((_, i) => i !== idx);
                          setEditorPages(updated);
                          setActivePageIndex(Math.max(0, idx - 1));
                        }
                      }}
                      className="absolute bottom-1.5 right-2 p-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer animate-fade-in"
                      title="Hapus Halaman Ini"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* MAIN CONTENT WORKSPACE: MS WORD-STYLE SIMULATOR */}
          <div className="flex-1 bg-slate-700 p-4 md:p-8 overflow-y-auto flex flex-col justify-start items-center relative scrollbar-thin">
            
            {/* TOOLBAR */}
            <div className="bg-slate-800 text-slate-200 p-2.5 px-4 rounded-xl border border-slate-600 w-full max-w-2xl mb-4 flex flex-col sm:flex-row items-center justify-between text-[11px] gap-2.5 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase font-bold text-amber-400">Lembar Aktif: Halaman {activePageIndex + 1} dari {editorPages.length}</span>
                <span className="text-slate-600 hidden sm:inline">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...editorPages];
                    updated.splice(activePageIndex + 1, 0, '');
                    setEditorPages(updated);
                    setActivePageIndex(activePageIndex + 1);
                  }}
                  className="flex items-center gap-1 bg-emerald-950 border border-emerald-800 px-2.5 py-1 rounded-md text-emerald-300 hover:bg-emerald-900 transition-colors cursor-pointer text-[10px] font-bold"
                >
                  <PlusCircle className="h-3 w-3 text-emerald-450" /> Sisipkan Halaman Baru Setelah Ini
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activePageIndex === 0}
                  onClick={() => setActivePageIndex(prev => prev - 1)}
                  className="p-1 px-2.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono text-[10px] font-bold bg-slate-900 px-3 py-1 rounded text-white">{activePageIndex + 1}</span>
                <button
                  type="button"
                  disabled={activePageIndex === editorPages.length - 1}
                  onClick={() => setActivePageIndex(prev => prev + 1)}
                  className="p-1 px-2.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* SIMULATED PAPER SHEET (A4 STYLE PORTRAIT) */}
            <div className="bg-white max-w-2xl w-full min-h-[460px] md:min-h-[620px] p-6 md:p-12 rounded-2xl border border-slate-650 shadow-2xl relative flex flex-col transition-all">
              
              {/* WORD-PROCESSOR HEADER METADATA */}
              <div className="flex items-center justify-between border-b pb-3 mb-5 border-slate-100 font-mono text-[9px] text-slate-400 select-none">
                <span className="uppercase tracking-wide">MUARA MULTI-PAGE MANUSCRIPT PROCESSOR</span>
                <span>TIPE: {kitabJenis.toUpperCase()}</span>
              </div>

              {/* ACTIVE PAGE CONTENT */}
              <div className="flex-1 flex flex-col relative">
                <textarea
                  value={editorPages[activePageIndex] || ''}
                  onChange={(e) => {
                    const updated = [...editorPages];
                    updated[activePageIndex] = e.target.value;
                    setEditorPages(updated);
                  }}
                  placeholder="Mulai mengetik atau merapikan baris hadis, terjemahan, atau penjelasan kitab untuk halaman ini..."
                  className="flex-1 w-full min-h-[340px] p-4 resize-none outline-none focus:outline-none font-serif text-slate-850 text-sm md:text-base leading-relaxed bg-slate-50/50 rounded-xl border border-dashed border-slate-200 focus:border-emerald-300 focus:bg-white transition-all font-medium font-serif"
                />
              </div>

              {/* WORD-PROCESSOR FOOTER METADATA */}
              <div className="flex items-center justify-between border-t pt-4 mt-6 border-slate-100 font-mono text-[9.5px] text-slate-400 select-none">
                <span>Halaman {activePageIndex + 1} dari {editorPages.length}</span>
                <span>{editorPages[activePageIndex]?.trim().split(/\s+/).filter(Boolean).length || 0} Kata</span>
              </div>

              {/* MINI WATERMARK EFFECT */}
              <div className="absolute right-10 bottom-14 opacity-[0.015] select-none pointer-events-none">
                <BookOpen className="h-36 w-36 text-[#064e40]" />
              </div>
            </div>

            {/* HELP BANNER */}
            <div className="mt-4 p-3.5 bg-slate-800/80 text-[10.5px] leading-relaxed text-slate-300 max-w-2xl w-full rounded-xl border border-slate-700 flex items-start gap-2.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <strong className="text-amber-300">Tips Format & Spasi:</strong> Pembagian halaman yang konsisten membuat santri lebih betah membaca. Gunakan tombol <span className="bg-emerald-950 text-emerald-300 font-mono px-1 py-0.2 rounded font-bold">Auto-Spasi & Enter</span> untuk merapikan spasi tak terlihat, lalu pakai <span className="bg-amber-300 text-slate-950 font-mono px-1 py-0.2 rounded font-bold">Auto-Split</span> untuk mendistribusikan materi per halaman secara proporsional.
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
