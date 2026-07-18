import React, { useState, useEffect, useRef } from 'react';
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
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Settings,
  Scissors,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KitabTextEditorProps {
  isOpen: boolean;
  onClose: () => void;
  kitabTitle: string;
  kitabJenis: string;
  initialPages: string[];
  initialTextBody: string;
  initialTextAlign?: 'left' | 'center' | 'right' | 'justify';
  initialDirection?: 'ltr' | 'rtl' | 'auto';
  initialFontSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  initialLineHeight?: 'normal' | 'relaxed' | 'loose';
  onSave: (
    pages: string[], 
    textBody: string, 
    styles?: {
      textAlign: 'left' | 'center' | 'right' | 'justify';
      direction: 'ltr' | 'rtl' | 'auto';
      fontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
      lineHeight: 'normal' | 'relaxed' | 'loose';
    }
  ) => void;
  onSuccessMessage: (msg: string) => void;
}

export default function KitabTextEditor({
  isOpen,
  onClose,
  kitabTitle,
  kitabJenis,
  initialPages,
  initialTextBody,
  initialTextAlign,
  initialDirection,
  initialFontSize,
  initialLineHeight,
  onSave,
  onSuccessMessage
}: KitabTextEditorProps) {
  const [editorPages, setEditorPages] = useState<string[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  
  // Custom states for the new features
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [editHtmlSource, setEditHtmlSource] = useState<boolean>(false);

  // Formatting options for perfect aesthetic customization
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('justify');
  const [direction, setDirection] = useState<'ltr' | 'rtl' | 'auto'>('auto');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl' | '2xl'>('lg');
  const [lineHeight, setLineHeight] = useState<'normal' | 'relaxed' | 'loose'>('relaxed');

  const scrollPageIntoView = (idx: number) => {
    setActivePageIndex(idx);
    setTimeout(() => {
      const target = document.getElementById(`page-sheet-${idx}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Initialize editor pages when modal opens or initialPages changes
  useEffect(() => {
    if (isOpen) {
      if (initialPages && initialPages.length > 0) {
        setEditorPages([...initialPages]);
      } else if (initialTextBody) {
        const paragraphs = initialTextBody.split('\n');
        const chunks: string[] = [];
        let current = '';
        paragraphs.forEach(p => {
          if ((current + '\n' + p).length > 1500) {
            if (current.trim()) chunks.push(current.trim());
            current = p;
          } else {
            current += (current ? '\n' : '') + p;
          }
        });
        if (current.trim()) chunks.push(current.trim());
        setEditorPages(chunks.length > 0 ? chunks : [initialTextBody]);
      } else {
        setEditorPages(['']);
      }
      
      // Load initial styles from props if available
      if (initialTextAlign) setTextAlign(initialTextAlign);
      if (initialDirection) setDirection(initialDirection);
      if (initialFontSize) setFontSize(initialFontSize);
      if (initialLineHeight) setLineHeight(initialLineHeight);
      
      setActivePageIndex(0);
    }
  }, [isOpen, initialPages, initialTextBody, initialTextAlign, initialDirection, initialFontSize, initialLineHeight]);

  // Helper to detect if text contains Arabic characters
  const isArabicText = (text: string): boolean => {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
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
                onSave(trimmedPages, trimmedPages.join('\n\n'), {
                  textAlign,
                  direction,
                  fontSize,
                  lineHeight
                });
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
        </div>        {/* LOWER MAIN AREA WITH 2 COLUMNS */}
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
                  setTimeout(() => {
                    scrollPageIntoView(updated.length - 1);
                  }, 50);
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
                  onClick={() => scrollPageIntoView(idx)}
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
                          setTimeout(() => {
                            scrollPageIntoView(idx - 1);
                          }, 50);
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
                          setTimeout(() => {
                            scrollPageIntoView(idx + 1);
                          }, 50);
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
                          scrollPageIntoView(Math.max(0, idx - 1));
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
          <div className="flex-1 bg-slate-700/90 flex flex-col overflow-hidden relative">
            
            {/* TOOLBAR */}
            <div className="bg-slate-800 text-slate-200 p-2.5 px-4 border-b border-slate-600 flex flex-col sm:flex-row items-center justify-between text-[11px] gap-2.5 shadow-lg z-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[10px] uppercase font-bold text-amber-400">Lembar Aktif: Halaman {activePageIndex + 1} dari {editorPages.length}</span>
                <span className="text-slate-600 hidden sm:inline">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...editorPages];
                    updated.splice(activePageIndex + 1, 0, '');
                    setEditorPages(updated);
                    setTimeout(() => {
                      scrollPageIntoView(activePageIndex + 1);
                    }, 50);
                  }}
                  className="flex items-center gap-1 bg-emerald-950 border border-emerald-800 px-2.5 py-1 rounded-md text-emerald-300 hover:bg-emerald-900 transition-colors cursor-pointer text-[10px] font-bold"
                >
                  <PlusCircle className="h-3 w-3 text-emerald-450" /> Sisipkan Halaman Baru Setelah Ini
                </button>
                <span className="text-slate-600 hidden sm:inline">|</span>
                {/* HTML Source Toggle */}
                <button
                  type="button"
                  onClick={() => setEditHtmlSource(prev => !prev)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                    editHtmlSource 
                      ? 'bg-amber-450 border-transparent text-slate-900' 
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                  title="Ganti antara mode visual instan dan kode sumber HTML murni"
                >
                  <Languages className="h-3.5 w-3.5" /> {editHtmlSource ? 'Mode Visual (WYSIWYG)' : 'Lihat Kode HTML'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activePageIndex === 0}
                  onClick={() => scrollPageIntoView(activePageIndex - 1)}
                  className="p-1 px-2.5 rounded bg-slate-700 hover:bg-slate-650 disabled:opacity-40 transition-colors cursor-pointer text-[10px]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono text-[11px] font-bold bg-slate-900 px-3 py-1 rounded text-white">{activePageIndex + 1}</span>
                <button
                  type="button"
                  disabled={activePageIndex === editorPages.length - 1}
                  onClick={() => scrollPageIntoView(activePageIndex + 1)}
                  className="p-1 px-2.5 rounded bg-slate-700 hover:bg-slate-650 disabled:opacity-40 transition-colors cursor-pointer text-[10px]"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* SCROLLABLE SHEETS CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 flex flex-col items-center scrollbar-thin scrollbar-thumb-slate-650">
              
              {editorPages.map((pageContent, idx) => {
                const computedDirection = direction === 'auto' 
                  ? (isArabicText(pageContent) ? 'rtl' : 'ltr') 
                  : direction;
                const isRtl = computedDirection === 'rtl';

                const alignClass = textAlign === 'left' ? 'text-left' :
                                   textAlign === 'center' ? 'text-center' :
                                   textAlign === 'right' ? 'text-right' : 'text-justify';

                const sizeClass = fontSize === 'sm' ? 'text-xs md:text-sm' :
                                  fontSize === 'base' ? 'text-sm md:text-base' :
                                  fontSize === 'lg' ? 'text-base md:text-lg' :
                                  fontSize === 'xl' ? 'text-lg md:text-xl' : 'text-xl md:text-2xl';

                const leadingClass = lineHeight === 'normal' ? 'leading-normal' :
                                     lineHeight === 'relaxed' ? 'leading-relaxed' : 'leading-loose';

                const familyClass = isRtl ? 'font-arabic tracking-wide animate-fade-in' : 'font-serif';

                return (
                  <div 
                    key={idx}
                    id={`page-sheet-${idx}`}
                    onClick={() => setActivePageIndex(idx)}
                    className={`bg-white max-w-2xl w-full h-auto min-h-[600px] p-6 md:p-10 rounded-2xl border transition-all relative flex flex-col shrink-0 shadow-xl ${
                      idx === activePageIndex 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/10' 
                        : 'border-slate-350 hover:border-slate-400'
                    }`}
                  >
                    {/* WORD-PROCESSOR HEADER METADATA & ARABIC DETECTION SHIELD */}
                    <div className="flex flex-wrap items-center justify-between border-b pb-2 mb-4 border-slate-150 font-mono text-[9px] text-slate-400 gap-2 select-none">
                      <span className="uppercase tracking-wide font-bold text-emerald-800 font-sans">HALAMAN {idx + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase font-sans">Tipe: {kitabJenis}</span>
                        {isArabicText(pageContent) && (
                          <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold font-sans">✨ Terdeteksi Tulisan Arab</span>
                        )}
                      </div>
                    </div>

                    {/* DYNAMIC EDITING CONTROLS (Only visible on active page sheet for clean focus) */}
                    {idx === activePageIndex && (
                      <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2 mb-4 flex flex-wrap items-center justify-between gap-2.5 text-[10.5px] animate-fade-in">
                        {/* DIRECTIVITY & ALIGNMENT */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase font-mono mr-1">Rata:</span>
                          <div className="flex rounded-md bg-slate-205 p-0.5 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setTextAlign('left')}
                              className={`p-1 rounded cursor-pointer ${textAlign === 'left' ? 'bg-white text-emerald-850 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                              title="Rata Kiri"
                            >
                              <AlignLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setTextAlign('center')}
                              className={`p-1 rounded cursor-pointer ${textAlign === 'center' ? 'bg-white text-emerald-850 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                              title="Rata Tengah (Tafsir/Syi'ir)"
                            >
                              <AlignCenter className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setTextAlign('right')}
                              className={`p-1 rounded cursor-pointer ${textAlign === 'right' ? 'bg-white text-emerald-850 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                              title="Rata Kanan (Sangat cocok untuk Hadis/Arab murni)"
                            >
                              <AlignRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setTextAlign('justify')}
                              className={`p-1 rounded cursor-pointer ${textAlign === 'justify' ? 'bg-white text-emerald-850 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                              title="Rata Kanan-Kiri"
                            >
                              <AlignJustify className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* DIRECTION MODE */}
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase font-mono mr-1">Arah:</span>
                          <div className="flex rounded-md bg-slate-205 p-0.5 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setDirection('auto')}
                              className={`px-1.5 py-0.5 text-[9px] rounded-sm font-bold cursor-pointer transition-all ${direction === 'auto' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'}`}
                              title="Otomatis menyesuaikan karakter bahasa"
                            >
                              Auto
                            </button>
                            <button
                              type="button"
                              onClick={() => setDirection('ltr')}
                              className={`px-1.5 py-0.5 text-[9px] rounded-sm font-bold cursor-pointer transition-all ${direction === 'ltr' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'}`}
                              title="Left-to-Right (Latin / Terjemahan)"
                            >
                              LTR
                            </button>
                            <button
                              type="button"
                              onClick={() => setDirection('rtl')}
                              className={`px-1.5 py-0.5 text-[9px] rounded-sm font-bold cursor-pointer transition-all ${direction === 'rtl' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'}`}
                              title="Right-to-Left (Arab / Pegon)"
                            >
                              RTL
                            </button>
                          </div>
                        </div>

                        {/* FONT SIZE SELECTION */}
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase font-mono mr-1">Ukuran:</span>
                          <select
                            value={fontSize}
                            onChange={(e) => setFontSize(e.target.value as any)}
                            className="bg-white border border-slate-200 rounded p-1 text-[10px] font-sans font-medium focus:outline-none text-slate-700 cursor-pointer"
                          >
                            <option value="sm">Kecil (13px)</option>
                            <option value="base">Normal (15px)</option>
                            <option value="lg">Sedang (17px)</option>
                            <option value="xl">Besar (20px)</option>
                            <option value="2xl">Ekstra Besar (24px)</option>
                          </select>
                        </div>

                        {/* LINE HEIGHT SPACING */}
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase font-mono mr-1">Baris:</span>
                          <select
                            value={lineHeight}
                            onChange={(e) => setLineHeight(e.target.value as any)}
                            className="bg-white border border-slate-200 rounded p-1 text-[10px] font-sans font-medium focus:outline-none text-slate-700 cursor-pointer"
                          >
                            <option value="normal">Kompak</option>
                            <option value="relaxed">Standard (Relaks)</option>
                            <option value="loose">Renggang (Khusus Arab)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* ACTIVE PAGE CONTENT AREA WITH THE AUTO-GROWING CAPABILITY */}
                    <div className="flex-1 flex flex-col relative w-full mb-1">
                      {idx === activePageIndex ? (
                        (() => {
                          const isHtml = /<[a-z][\s\S]*>/i.test(pageContent);
                          
                          if (isHtml && !editHtmlSource) {
                            // WYSIWYG ContentEditable mode for HTML content
                            return (
                              <div className="relative w-full min-h-[380px] flex flex-col">
                                <div className="absolute right-3 top-3 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded text-[8.5px] font-bold z-10 select-none">
                                  ✍️ Sunting Langsung (Visual WYSIWYG)
                                </div>
                                <style dangerouslySetInnerHTML={{ __html: `
                                  .word-content table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin-top: 14px;
                                    margin-bottom: 14px;
                                    font-size: 0.9em;
                                  }
                                  .word-content th, .word-content td {
                                    border: 1.5px solid #cbd5e1;
                                    padding: 10px 14px;
                                    text-align: ${isRtl ? 'right' : 'left'};
                                    vertical-align: middle;
                                  }
                                  .word-content th {
                                    background-color: #f8fafc;
                                    font-weight: 700;
                                    color: #1e293b;
                                  }
                                  .word-content tr:nth-child(even) {
                                    background-color: #f8fafc/50;
                                  }
                                  .word-content p {
                                    margin-bottom: 10px;
                                    text-align: inherit;
                                  }
                                  .word-content h1, .word-content h2, .word-content h3, .word-content h4 {
                                    font-weight: 800;
                                    color: #0f172a;
                                    margin-top: 20px;
                                    margin-bottom: 10px;
                                    line-height: 1.3;
                                  }
                                  .word-content h1 { font-size: 1.6em; }
                                  .word-content h2 { font-size: 1.4em; }
                                  .word-content h3 { font-size: 1.2em; }
                                  .word-content h4 { font-size: 1.1em; }
                                  .word-content ul, .word-content ol {
                                    margin-left: 24px;
                                    margin-bottom: 14px;
                                    list-style-position: outside;
                                  }
                                  .word-content ul { list-style-type: disc; }
                                  .word-content ol { list-style-type: decimal; }
                                  .word-content li {
                                    margin-bottom: 6px;
                                  }
                                  .word-content blockquote {
                                    border-left: 4px solid #10b981;
                                    padding-left: 16px;
                                    margin: 16px 0;
                                    color: #475569;
                                    font-style: italic;
                                  }
                                  .word-content hr {
                                    border: 0;
                                    border-top: 2px solid #e2e8f0;
                                    margin: 20px 0;
                                  }
                                `}} />
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onInput={(e) => {
                                    const updated = [...editorPages];
                                    updated[idx] = e.currentTarget.innerHTML;
                                    setEditorPages(updated);
                                  }}
                                  onBlur={(e) => {
                                    const updated = [...editorPages];
                                    updated[idx] = e.currentTarget.innerHTML;
                                    setEditorPages(updated);
                                  }}
                                  dir={computedDirection}
                                  className={`word-content w-full min-h-[380px] p-4 bg-white rounded-xl border border-dashed border-emerald-300 focus:border-emerald-500 outline-none focus:outline-none transition-all font-medium text-slate-850 ${alignClass} ${sizeClass} ${leadingClass} ${familyClass}`}
                                  dangerouslySetInnerHTML={{ __html: pageContent }}
                                />
                              </div>
                            );
                          } else {
                            // Standard Textarea mode for Plain Text or HTML raw code
                            return (
                              <textarea
                                value={pageContent}
                                onChange={(e) => {
                                  const updated = [...editorPages];
                                  updated[idx] = e.target.value;
                                  setEditorPages(updated);
                                  
                                  // Auto adjust height inline on type
                                  e.target.style.height = 'auto';
                                  e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                onFocus={() => setActivePageIndex(idx)}
                                ref={(el) => {
                                  if (el) {
                                    el.style.height = 'auto';
                                    el.style.height = `${Math.max(380, el.scrollHeight)}px`;
                                  }
                                }}
                                dir={computedDirection}
                                placeholder={isHtml ? `Sunting kode HTML halaman ${idx + 1}...` : `Mulai mengetik atau menyalin untuk halaman ${idx + 1}...`}
                                style={{ overflowY: 'hidden' }}
                                className={`w-full min-h-[380px] p-4 resize-none outline-none focus:outline-none bg-slate-50/50 rounded-xl border border-dashed border-slate-205 focus:border-emerald-300 focus:bg-white transition-all ${isHtml ? 'font-mono text-xs text-blue-900 leading-normal' : 'font-medium text-slate-850 ' + alignClass + ' ' + sizeClass + ' ' + leadingClass + ' ' + familyClass}`}
                              />
                            );
                          }
                        })()
                      ) : (
                        (() => {
                          const isHtml = /<[a-z][\s\S]*>/i.test(pageContent);
                          return (
                            <div
                              onClick={() => setActivePageIndex(idx)}
                              dir={computedDirection}
                              className={`w-full min-h-[380px] p-4 bg-slate-50/20 rounded-xl border border-dashed border-slate-150 cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-slate-850 select-text ${alignClass} ${sizeClass} ${leadingClass} ${familyClass}`}
                            >
                              <style dangerouslySetInnerHTML={{ __html: `
                                .word-content table {
                                  width: 100%;
                                  border-collapse: collapse;
                                  margin-top: 14px;
                                  margin-bottom: 14px;
                                  font-size: 0.9em;
                                }
                                .word-content th, .word-content td {
                                  border: 1.5px solid #cbd5e1;
                                  padding: 10px 14px;
                                  text-align: ${isRtl ? 'right' : 'left'};
                                  vertical-align: middle;
                                }
                                .word-content th {
                                  background-color: #f8fafc;
                                  font-weight: 700;
                                  color: #1e293b;
                                }
                                .word-content tr:nth-child(even) {
                                  background-color: #f8fafc/50;
                                }
                                .word-content p {
                                  margin-bottom: 10px;
                                  text-align: inherit;
                                }
                                .word-content h1, .word-content h2, .word-content h3, .word-content h4 {
                                  font-weight: 800;
                                  color: #0f172a;
                                  margin-top: 20px;
                                  margin-bottom: 10px;
                                  line-height: 1.3;
                                }
                                .word-content h1 { font-size: 1.6em; }
                                .word-content h2 { font-size: 1.4em; }
                                .word-content h3 { font-size: 1.2em; }
                                .word-content h4 { font-size: 1.1em; }
                                .word-content ul, .word-content ol {
                                  margin-left: 24px;
                                  margin-bottom: 14px;
                                  list-style-position: outside;
                                }
                                .word-content ul { list-style-type: disc; }
                                .word-content ol { list-style-type: decimal; }
                                .word-content li {
                                  margin-bottom: 6px;
                                }
                                .word-content blockquote {
                                  border-left: 4px solid #10b981;
                                  padding-left: 16px;
                                  margin: 16px 0;
                                  color: #475569;
                                  font-style: italic;
                                }
                                .word-content hr {
                                  border: 0;
                                  border-top: 2px solid #e2e8f0;
                                  margin: 20px 0;
                                }
                              `}} />
                              {isHtml ? (
                                <div className="word-content" dangerouslySetInnerHTML={{ __html: pageContent }} />
                              ) : (
                                <div className="whitespace-pre-wrap">
                                  {pageContent || <span className="text-slate-400 italic font-sans text-xs">Halaman kosong. Klik untuk mengetik...</span>}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* WORD-PROCESSOR FOOTER METADATA */}
                    <div className="flex items-center justify-between border-t pt-3 mt-4 border-slate-100 font-mono text-[9.5px] text-slate-400 select-none">
                      <span className="font-sans">Halaman {idx + 1} dari {editorPages.length}</span>
                      <span className="font-sans">{pageContent.trim().split(/\s+/).filter(Boolean).length || 0} Kata</span>
                    </div>

                    {/* MINI WATERMARK EFFECT */}
                    <div className="absolute right-10 bottom-14 opacity-[0.015] select-none pointer-events-none">
                      <BookOpen className="h-36 w-36 text-[#064e40]" />
                    </div>
                  </div>
                );
              })}

              {/* HELP BANNER */}
              <div className="mt-2 p-3.5 bg-slate-800/80 text-[10.5px] leading-relaxed text-slate-300 max-w-2xl w-full rounded-xl border border-slate-700 flex items-start gap-2.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-300 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <strong className="text-amber-300">Tips Format & Penyuntingan Pintar:</strong> 
                  <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-350">
                    <li>Semua lembar halaman tersusun vertikal ke bawah mirip Microsoft Word. Klik nomor halaman di kiri untuk navigasi instan.</li>
                    <li>Lembaran kertas di atas <span className="text-emerald-300 font-bold">akan memanjang otomatis ke bawah secara dinamis</span> saat Anda mengetik, sehingga Anda dapat melakukan scroll ruang halaman dengan leluasa.</li>
                    <li>Tulisan Arab terdeteksi secara otomatis, mengaktifkan arah kanan-ke-kiri (RTL) dan font Arab murni berketinggian renggang agar syakal harakat hadis/ayat terlihat sangat jelas dan rapi.</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
