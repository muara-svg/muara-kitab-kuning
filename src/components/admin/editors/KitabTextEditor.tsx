import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  Sparkles, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  FileText, 
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  isArabicText, 
  stripShapesAndTables, 
  cleanSpacesAndEnters, 
  paginateHtml 
} from '../../../lib/KitabUtils';

interface KitabTextEditorProps {
  isOpen: boolean;
  onClose: () => void;
  kitabTitle: string;
  kitabJenis: string;
  initialPages: string[];
  initialTextBody?: string;
  initialTextAlign?: 'left' | 'center' | 'right' | 'justify';
  initialDirection?: 'ltr' | 'rtl' | 'auto';
  initialFontSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  initialLineHeight?: 'normal' | 'relaxed' | 'loose';
  onSave: (
    pages: string[], 
    textBody: string, 
    settings: {
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
  // Styles configuration states
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('justify');
  const [direction, setDirection] = useState<'ltr' | 'rtl' | 'auto'>('auto');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl' | '2xl'>('lg');
  const [lineHeight, setLineHeight] = useState<'normal' | 'relaxed' | 'loose'>('relaxed');

  // Document state & estimation
  const [fullContentHtml, setFullContentHtml] = useState<string>('');
  const [estimatedPagesCount, setEstimatedPagesCount] = useState<number>(1);
  const [isSelectionActive, setIsSelectionActive] = useState<boolean>(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Recalculate A4 page budget estimate
  const updateEstimatedPages = (html: string) => {
    const computedDir = direction === 'auto' 
      ? (isArabicText(html) ? 'rtl' : 'ltr') 
      : direction;
    const isRtl = computedDir === 'rtl';

    const pages = paginateHtml(html, { fontSize, lineHeight, isRtl });
    setEstimatedPagesCount(pages.length);
  };

  // Selection Change Listener to lock/unlock toolbar formatting buttons
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        setIsSelectionActive(true);
      } else {
        setIsSelectionActive(false);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Format Text block
  const handleFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setFullContentHtml(html);
      updateEstimatedPages(html);
    }
  };

  // Initialize editor content when opened
  useEffect(() => {
    if (isOpen) {
      let combinedHtml = '';
      if (initialPages && initialPages.length > 0) {
        combinedHtml = initialPages.map(page => {
          const isHtml = /<[a-z][\s\S]*>/i.test(page);
          if (isHtml) return stripShapesAndTables(page);
          return page.split('\n').map(p => `<p>${p || '&nbsp;'}</p>`).join('');
        }).join('');
      } else if (initialTextBody) {
        const isHtml = /<[a-z][\s\S]*>/i.test(initialTextBody);
        if (isHtml) {
          combinedHtml = stripShapesAndTables(initialTextBody);
        } else {
          combinedHtml = initialTextBody.split('\n').map(p => `<p>${p || '&nbsp;'}</p>`).join('');
        }
      }

      const cleanHtml = stripShapesAndTables(combinedHtml);
      
      const initialAlign = initialTextAlign || 'justify';
      const initialDir = initialDirection || 'auto';
      const initialSize = initialFontSize || 'lg';
      const initialHeight = initialLineHeight || 'relaxed';

      setTextAlign(initialAlign);
      setDirection(initialDir);
      setFontSize(initialSize);
      setLineHeight(initialHeight);

      setFullContentHtml(cleanHtml);
      isInitializedRef.current = true;

      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = cleanHtml || '<p><br></p>';
          updateEstimatedPages(cleanHtml);
        }
      }, 50);
    } else {
      isInitializedRef.current = false;
    }
  }, [isOpen, initialPages, initialTextBody, initialTextAlign, initialDirection, initialFontSize, initialLineHeight]);

  // Update estimation when style configurations change
  useEffect(() => {
    if (!isInitializedRef.current) return;
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : fullContentHtml;
    updateEstimatedPages(currentHtml);
  }, [fontSize, lineHeight, textAlign, direction]);

  // Clean spaces, tables, shapes, and excessive blank lines
  const handleCleanSpaces = () => {
    const rawHtml = editorRef.current ? editorRef.current.innerHTML : fullContentHtml;
    const cleaned = cleanSpacesAndEnters(rawHtml);

    if (editorRef.current) {
      editorRef.current.innerHTML = cleaned || '<p><br></p>';
    }
    setFullContentHtml(cleaned);
    updateEstimatedPages(cleaned);

    onSuccessMessage('Auto-Spasi & Paragraf Berhasil! Spasi berlebih, tabel/shapes, dan enter yang terlalu jauh berhasil dirapikan secara serentak.');
  };

  const handleSave = () => {
    const rawHtml = editorRef.current ? editorRef.current.innerHTML : fullContentHtml;
    const cleanedHtml = cleanSpacesAndEnters(rawHtml);

    const computedDirection = direction === 'auto' 
      ? (isArabicText(cleanedHtml) ? 'rtl' : 'ltr') 
      : direction;
    const isRtl = computedDirection === 'rtl';

    const finalPages = paginateHtml(cleanedHtml, {
      fontSize,
      lineHeight,
      isRtl
    });

    const trimmedPages = finalPages.map(p => p.trim());
    onSave(trimmedPages, cleanedHtml, {
      textAlign,
      direction,
      fontSize,
      lineHeight
    });
    onSuccessMessage(`Kitab berhasil tersimpan! Konten dirapikan & terbagi otomatis dalam ${trimmedPages.length} Halaman A4.`);
  };

  if (!isOpen) return null;

  const computedDirection = direction === 'auto' 
    ? (isArabicText(fullContentHtml) ? 'rtl' : 'ltr') 
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

  const familyClass = isRtl ? 'font-arabic tracking-wide' : 'font-serif';

  // Lockable visual styling
  const disabledToolbarBtnClass = "opacity-35 cursor-not-allowed pointer-events-none";
  const standardToolbarBtnClass = "p-1 px-2 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium shadow-xs cursor-pointer transition-all";

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex flex-col font-sans"
      >
        {/* HEADER BAR */}
        <div className="bg-[#03362a] text-white p-3 px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md border-b border-emerald-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-950 p-2 rounded-xl border border-emerald-800">
              <FileText className="h-5 w-5 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold tracking-tight flex items-center gap-1.5 uppercase font-sans">
                Editor Lembar Tunggal MS-Word <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.5 rounded-full font-serif lowercase italic">pro continuous canvas</span>
              </h4>
              <p className="text-[10px] text-emerald-200/90 font-mono mt-0.5">
                Kitab: {kitabTitle || 'Manuskrip Baru'} ({kitabJenis})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* CLEAN UP SPACES */}
            <button
              type="button"
              onClick={handleCleanSpaces}
              className="flex items-center gap-1.5 bg-emerald-900 hover:bg-emerald-850 text-emerald-100 border border-emerald-700 px-3 py-1.5 rounded-xl font-bold text-[10.5px] transition-all cursor-pointer shadow-2xs"
              title="Merapikan spasi berlebih, menghapus tabel/shapes, dan memangkas enter yang terlalu jauh"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Auto-Spasi & Paragraf
            </button>

            <span className="text-emerald-800/60 hidden md:inline">|</span>

            {/* COUNTERS */}
            <div className="flex items-center gap-1.5 bg-emerald-950/40 px-3 py-1 rounded-lg text-[10px] font-mono text-emerald-250 border border-emerald-800/50">
              Estimasi: <span className="text-emerald-300 font-bold">{estimatedPagesCount} Halaman A4</span>
              <span>•</span>
              <span className="text-emerald-300 font-bold">
                {fullContentHtml.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length}
              </span> kata
            </div>

            {/* ACTION BUTTONS */}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-amber-450 hover:bg-amber-500 text-slate-900 font-extrabold text-[11px] px-4 py-1.5 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" /> Simpan Perubahan
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-red-900/95 hover:bg-red-950 text-red-100 font-bold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5 inline mr-1" /> Tutup
            </button>
          </div>
        </div>

        {/* WORKSPACE AREA (FULL WIDTH) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* MAIN COLUMN: MS WORD SCROLLABLE CANVAS */}
          <div className="flex-1 bg-slate-800 flex flex-col overflow-hidden relative w-full">
            
            {/* RICH TEXT FORMATTING TOOLBAR */}
            <div className="bg-slate-850 text-slate-200 p-2.5 px-4 border-b border-slate-700 flex flex-wrap items-center justify-between text-[11px] gap-2.5 shadow-lg shrink-0">
              
              <div className="flex flex-wrap items-center gap-2">
                {/* DIRECTIVITY & ALIGNMENT (Selection locked) */}
                <div className={`flex rounded-md bg-slate-900 p-0.5 border border-slate-700 ${!isSelectionActive ? disabledToolbarBtnClass : ''}`}>
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTextAlign('left')}
                    className={`p-1 rounded cursor-pointer ${textAlign === 'left' ? 'bg-emerald-800 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Rata Kiri"
                  >
                    <AlignLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTextAlign('center')}
                    className={`p-1 rounded cursor-pointer ${textAlign === 'center' ? 'bg-emerald-800 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Rata Tengah"
                  >
                    <AlignCenter className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTextAlign('right')}
                    className={`p-1 rounded cursor-pointer ${textAlign === 'right' ? 'bg-emerald-800 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Rata Kanan"
                  >
                    <AlignRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTextAlign('justify')}
                    className={`p-1 rounded cursor-pointer ${textAlign === 'justify' ? 'bg-emerald-800 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Rata Kanan-Kiri"
                  >
                    <AlignJustify className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span className="text-slate-700 mx-1">|</span>

                {/* DIRECTION MODE */}
                <div className="flex rounded-md bg-slate-900 p-0.5 border border-slate-700 text-[9px]">
                  <button
                    type="button"
                    onClick={() => setDirection('auto')}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-all ${direction === 'auto' ? 'bg-emerald-800 text-white' : 'text-slate-400'}`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('ltr')}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-all ${direction === 'ltr' ? 'bg-emerald-800 text-white' : 'text-slate-400'}`}
                  >
                    LTR
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('rtl')}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-all ${direction === 'rtl' ? 'bg-emerald-800 text-white' : 'text-slate-400'}`}
                  >
                    RTL
                  </button>
                </div>

                <span className="text-slate-700 mx-1">|</span>

                {/* FONT SIZE */}
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 rounded p-1 text-[10px] focus:outline-none cursor-pointer font-sans"
                >
                  <option value="sm">Kecil (13px)</option>
                  <option value="base">Normal (15px)</option>
                  <option value="lg">Sedang (17px)</option>
                  <option value="xl">Besar (20px)</option>
                  <option value="2xl">Ekstra Besar (24px)</option>
                </select>

                {/* LINE HEIGHT */}
                <select
                  value={lineHeight}
                  onChange={(e) => setLineHeight(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 rounded p-1 text-[10px] focus:outline-none cursor-pointer font-sans"
                >
                  <option value="normal">Kompak</option>
                  <option value="relaxed">Relaks (Standard)</option>
                  <option value="loose">Renggang (Arab)</option>
                </select>
              </div>

              {/* ESTIMATE BADGE */}
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="bg-slate-900 px-2.5 py-1 rounded text-slate-400 border border-slate-700">
                  Total Budget: <span className="text-emerald-400 font-bold">~{estimatedPagesCount} Halaman A4</span>
                </span>
              </div>
            </div>

            {/* WYSIWYG SUB TOOLBAR FOR TEXT BLOCK */}
            <div className="bg-slate-850 text-slate-300 px-4 py-2 border-b border-slate-750 flex flex-wrap items-center gap-1.5 shrink-0 text-[10px]">
              <span className="text-[9px] font-bold text-slate-500 uppercase font-mono mr-1">Teks Blok (Word Style):</span>
              
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('bold')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Tebal (Bold)"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('italic')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Miring (Italic)"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('underline')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Garis Bawah (Underline)"
                >
                  <Underline className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('strikeThrough')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Coret (Strikethrough)"
                >
                  <Strikethrough className="h-3.5 w-3.5" />
                </button>

                <span className="text-slate-750 mx-1">|</span>

                {/* TEXT ALIGNMENT FOR SELECTED BLOCK */}
                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('justifyLeft')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Rata Kiri Blok"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('justifyCenter')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Rata Tengah Blok"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('justifyRight')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Rata Kanan Blok"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('justifyFull')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Rata Samping / Kanan-Kiri Blok"
                >
                  <AlignJustify className="h-3.5 w-3.5" />
                </button>

                <span className="text-slate-700 mx-1">|</span>

                {/* HEADING ACCENTS */}
                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('formatBlock', '<h1>')}
                  className={!isSelectionActive ? `opacity-35 cursor-not-allowed pointer-events-none p-1 px-1.5 rounded bg-slate-900 border border-slate-700 text-slate-500 text-[8.5px]` : `p-1 px-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 text-[8.5px] cursor-pointer`}
                >
                  H1
                </button>
                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('formatBlock', '<h2>')}
                  className={!isSelectionActive ? `opacity-35 cursor-not-allowed pointer-events-none p-1 px-1.5 rounded bg-slate-900 border border-slate-700 text-slate-500 text-[8.5px]` : `p-1 px-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 text-[8.5px] cursor-pointer`}
                >
                  H2
                </button>
                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('formatBlock', '<p>')}
                  className={!isSelectionActive ? `opacity-35 cursor-not-allowed pointer-events-none p-1 px-1.5 rounded bg-slate-900 border border-slate-700 text-slate-500 text-[8.5px]` : `p-1 px-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 text-[8.5px] cursor-pointer`}
                >
                  P
                </button>

                <span className="text-slate-700 mx-1">|</span>

                {/* LISTS */}
                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('insertUnorderedList')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Bullet List"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('insertOrderedList')}
                  className={!isSelectionActive ? disabledToolbarBtnClass : standardToolbarBtnClass}
                  title="Numbered List"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </button>

                <span className="text-slate-700 mx-1">|</span>

                {/* COLORS */}
                <div className={`flex items-center gap-1 ${!isSelectionActive ? disabledToolbarBtnClass : ''}`}>
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('foreColor', '#000000')}
                    className="w-3.5 h-3.5 rounded-full bg-black border border-slate-600 cursor-pointer hover:scale-110 transition-transform"
                    title="Hitam"
                  />
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('foreColor', '#ef4444')}
                    className="w-3.5 h-3.5 rounded-full bg-red-500 border border-slate-600 cursor-pointer hover:scale-110 transition-transform"
                    title="Merah"
                  />
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('foreColor', '#10b981')}
                    className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-slate-600 cursor-pointer hover:scale-110 transition-transform"
                    title="Hijau"
                  />
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('foreColor', '#3b82f6')}
                    className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-slate-600 cursor-pointer hover:scale-110 transition-transform"
                    title="Biru"
                  />
                  <button
                    type="button"
                    disabled={!isSelectionActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('foreColor', '#f59e0b')}
                    className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-slate-600 cursor-pointer hover:scale-110 transition-transform"
                    title="Oranye"
                  />
                </div>

                <span className="text-slate-700 mx-1">|</span>

                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleFormat('removeFormat')}
                  className={!isSelectionActive ? `opacity-35 cursor-not-allowed pointer-events-none p-1 px-2 rounded bg-red-950 border border-red-900 text-red-500 flex items-center gap-1 text-[10px]` : `p-1 px-2 rounded bg-red-950 hover:bg-red-900 text-red-200 border border-red-900 flex items-center gap-1 cursor-pointer`}
                  title="Bersihkan format pada bagian yang dipilih"
                >
                  <Scissors className="h-3.5 w-3.5" /> Bersihkan Format
                </button>
              </div>
            </div>

            {/* SCROLLABLE SHEET WORKSPACE */}
            <div className="flex-1 overflow-auto p-4 md:p-10 flex flex-col items-center scrollbar-thin scrollbar-thumb-slate-300 bg-slate-100">
              
              <style dangerouslySetInnerHTML={{ __html: `
                .word-content table {
                  display: none !important;
                }
                .word-content img, .word-content svg, .word-content canvas {
                  display: none !important;
                }
                .word-content p {
                  margin-bottom: 12px;
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

              {/* UNIFIED CONTINUOUS A4 SHEET CANVAS */}
              <div className="flex flex-col items-center py-4 w-full select-text">
                <div 
                  className="bg-white shadow-2xl rounded-sm border border-slate-300 relative text-slate-850 flex flex-col transition-all"
                  style={{ 
                    width: '794px', 
                    minHeight: '1122px', // Minimum 1 A4 height, grows smoothly downwards
                    paddingTop: '60px',
                    paddingBottom: '60px',
                    paddingLeft: '60px',
                    paddingRight: '60px',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Top Watermark */}
                  <div className="flex items-center justify-between border-b pb-2 mb-6 border-slate-200 font-mono text-[9px] text-slate-400 select-none pointer-events-none">
                    <span className="uppercase tracking-wider font-extrabold text-emerald-800 font-sans">
                      MANUSKRIP LEMBAR TUNGGAL — {kitabTitle || 'MANUSKRIP KITAB'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase font-sans">
                        LEMBAR A4 CONTINUOUS (LEBAR 794 PX)
                      </span>
                      {isArabicText(fullContentHtml) && (
                        <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full text-[8px] font-bold font-sans">Aksara Arab</span>
                      )}
                    </div>
                  </div>

                  {/* Single Continuous Editable Content Area */}
                  <div
                    id="continuous-editor-sheet"
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    dir={computedDirection}
                    className={`word-content outline-none focus:outline-none w-full min-h-[960px] font-medium text-slate-850 relative ${alignClass} ${sizeClass} ${leadingClass} ${familyClass}`}
                    onInput={(e) => {
                      const html = e.currentTarget.innerHTML;
                      setFullContentHtml(html);
                      updateEstimatedPages(html);
                    }}
                    onBlur={(e) => {
                      const html = e.currentTarget.innerHTML;
                      setFullContentHtml(html);
                      updateEstimatedPages(html);
                    }}
                  />

                  {/* Bottom Watermark */}
                  <div className="flex items-center justify-between pt-2 mt-8 font-mono text-[8px] text-slate-400 select-none pointer-events-none">
                    <span className="font-sans text-slate-500 font-medium">Batas Cetak A4 Standard — Lembar Kerja Bebas Error</span>
                    <span className="font-sans font-extrabold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                      Estimasi: {estimatedPagesCount} Halaman A4 saat dibaca
                    </span>
                  </div>
                </div>
              </div>

              {/* TIPS BANNER */}
              <div className="mt-6 p-4 bg-slate-850 text-[10.5px] leading-relaxed text-slate-300 max-w-[794px] w-full rounded-xl border border-slate-700 flex items-start gap-3 shadow-md">
                <Sparkles className="h-4 w-4 text-amber-300 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <strong className="text-amber-300">Layout Lembar Bebas Memanjang (Continuous Canvas):</strong> 
                  <ul className="list-disc pl-4 space-y-1.5 mt-1.5 text-slate-350 font-sans">
                    <li>Semua teks berada di dalam <span className="text-emerald-300 font-bold">satu kertas memanjang yang sama</span> tanpa sekat halaman yang mengganggu.</li>
                    <li>Operasi seperti tekan <span className="text-emerald-300 font-bold">Enter, Backspace, maupun Hapus Baris</span> dijamin berjalan 100% mulus tanpa error.</li>
                    <li>Gunakan tombol <span className="text-amber-300 font-bold">Auto-Spasi & Paragraf</span> untuk membuang spasi berlebih, menghapus tabel/shapes, serta merapikan enter yang terlalu jauh.</li>
                    <li>Saat kitab disimpan atau dibaca pada Pembaca Kitab (Reader), sistem akan otomatis memotong teks menjadi halaman A4 yang rapi tanpa ada kalimat terpotong.</li>
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
