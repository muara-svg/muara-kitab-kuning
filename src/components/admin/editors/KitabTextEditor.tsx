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
  BookOpen, 
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Table,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Helper to detect if text contains Arabic characters
const isArabicText = (text: string): boolean => {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

// Precise browser-based A4 HTML pagination function
export function paginateHtml(
  htmlContent: string,
  options: {
    fontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
    lineHeight: 'normal' | 'relaxed' | 'loose';
    isRtl: boolean;
  }
): string[] {
  if (typeof document === 'undefined') {
    return [htmlContent];
  }

  // Create an invisible measurement container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '210mm'; // Standard A4 width
  container.style.padding = '20mm'; // Standard A4 margin
  container.style.boxSizing = 'border-box';
  container.style.visibility = 'hidden';
  container.style.overflow = 'hidden';

  const isRtl = options.isRtl;
  const alignClass = 'text-justify'; 
  const sizeClass = options.fontSize === 'sm' ? 'text-xs md:text-sm' :
                    options.fontSize === 'base' ? 'text-sm md:text-base' :
                    options.fontSize === 'lg' ? 'text-base md:text-lg' :
                    options.fontSize === 'xl' ? 'text-lg md:text-xl' : 'text-xl md:text-2xl';

  const leadingClass = options.lineHeight === 'normal' ? 'leading-normal' :
                       options.lineHeight === 'relaxed' ? 'leading-relaxed' : 'leading-loose';

  const familyClass = isRtl ? 'font-arabic tracking-wide' : 'font-serif';

  container.className = `word-content bg-white ${alignClass} ${sizeClass} ${leadingClass} ${familyClass}`;
  
  const fontSizeMap = {
    sm: '13px',
    base: '15px',
    lg: '17px',
    xl: '20px',
    '2xl': '24px'
  };
  const lineHeightMap = {
    normal: '1.5',
    relaxed: '1.8',
    loose: '2.2'
  };
  container.style.fontSize = fontSizeMap[options.fontSize] || '17px';
  container.style.lineHeight = lineHeightMap[options.lineHeight] || '1.8';

  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
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
    .word-content p {
      margin-bottom: 10px;
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
  `;
  container.appendChild(styleEl);

  const tempPage = document.createElement('div');
  tempPage.style.width = '100%';
  tempPage.style.minHeight = '257mm'; // Content area height (297mm - 40mm padding)
  tempPage.style.boxSizing = 'border-box';
  container.appendChild(tempPage);

  document.body.appendChild(container);

  // Maximum vertical height budget for content of A4 page (roughly 257mm)
  const targetPageHeight = 1000; 

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(htmlContent, 'text/html');
  const childNodes = Array.from(parsedDoc.body.childNodes);

  const pages: string[] = [];

  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      continue;
    }

    const clone = node.cloneNode(true);
    tempPage.appendChild(clone);

    const currentHeight = tempPage.offsetHeight;

    if (currentHeight > targetPageHeight) {
      if (tempPage.childNodes.length > 1) {
        tempPage.removeChild(clone);
        pages.push(tempPage.innerHTML);
        
        tempPage.innerHTML = '';
        const newClone = node.cloneNode(true);
        tempPage.appendChild(newClone);
      } else {
        pages.push(tempPage.innerHTML);
        tempPage.innerHTML = '';
      }
    }
  }

  if (tempPage.innerHTML.trim()) {
    pages.push(tempPage.innerHTML);
  }

  document.body.removeChild(container);

  return pages.length > 0 ? pages : [''];
}

// Strip visual page-break dividers from combined HTML
export const stripPageBreaks = (html: string): string => {
  if (!html) return '';
  return html.replace(/<div\s+[^>]*class=["'][^"']*page-break-divider[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi, '');
};

// Insert visual page-break dividers into combined HTML based on exact A4 height page splits
export const insertPageDividers = (
  rawHtml: string,
  fontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl',
  lineHeight: 'normal' | 'relaxed' | 'loose',
  isRtl: boolean
): { combinedHtml: string; pageCount: number; pages: string[] } => {
  const cleanHtml = stripPageBreaks(rawHtml);
  const pages = paginateHtml(cleanHtml, { fontSize, lineHeight, isRtl });
  
  const combined = pages.map((pageHtml, idx) => {
    if (idx === pages.length - 1) {
      return pageHtml;
    }
    const pageNum = idx + 1;
    const dividerHtml = `<div class="page-break-divider" contenteditable="false" style="user-select: none; -webkit-user-select: none; pointer-events: none; height: 48px; position: relative;" data-page="${pageNum}">` +
      `</div>`;
    return pageHtml + dividerHtml;
  }).join('');

  return {
    combinedHtml: combined || '<p>&nbsp;</p>',
    pageCount: pages.length,
    pages
  };
};

// Robust caret/selection preservation for contentEditable to prevent cursor jumping
function saveSelection(containerEl: HTMLElement) {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  
  const range = sel.getRangeAt(0);
  
  // Count character offset from start of containerEl, ignoring dividers
  let charCount = 0;
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      let parent = node.parentElement;
      while (parent && parent !== containerEl) {
        if (parent.classList.contains('page-break-divider')) {
          return NodeFilter.FILTER_REJECT;
        }
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let foundStart = false;
  let startOffset = 0;
  let endOffset = 0;
  
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode === range.startContainer) {
      startOffset = charCount + range.startOffset;
      foundStart = true;
    }
    if (currentNode === range.endContainer) {
      endOffset = charCount + range.endOffset;
      break;
    }
    charCount += currentNode.textContent?.length || 0;
    currentNode = walker.nextNode();
  }
  
  if (!foundStart) {
    return {
      type: 'fallback',
      anchorNode: sel.anchorNode,
      anchorOffset: sel.anchorOffset,
      focusNode: sel.focusNode,
      focusOffset: sel.focusOffset
    };
  }

  return {
    type: 'charOffset',
    start: startOffset,
    end: endOffset
  };
}

function restoreSelection(containerEl: HTMLElement, savedSel: any) {
  if (!savedSel) return;
  if (typeof window === 'undefined') return;
  const sel = window.getSelection();
  if (!sel) return;
  
  if (savedSel.type === 'fallback') {
    try {
      const range = document.createRange();
      range.setStart(savedSel.anchorNode, savedSel.anchorOffset);
      range.setEnd(savedSel.focusNode, savedSel.focusOffset);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {
      // Benign fallback error
    }
    return;
  }

  let charCount = 0;
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      let parent = node.parentElement;
      while (parent && parent !== containerEl) {
        if (parent.classList.contains('page-break-divider')) {
          return NodeFilter.FILTER_REJECT;
        }
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;

  let currentNode = walker.nextNode();
  while (currentNode) {
    const len = currentNode.textContent?.length || 0;
    if (!startNode && savedSel.start >= charCount && savedSel.start <= charCount + len) {
      startNode = currentNode;
      startNodeOffset = savedSel.start - charCount;
    }
    if (!endNode && savedSel.end >= charCount && savedSel.end <= charCount + len) {
      endNode = currentNode;
      endNodeOffset = savedSel.end - charCount;
      break;
    }
    charCount += len;
    currentNode = walker.nextNode();
  }

  if (startNode && endNode) {
    try {
      const range = document.createRange();
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {
      // Benign restore range error
    }
  }
}

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

  // Unified document states
  const [fullContentHtml, setFullContentHtml] = useState<string>('');
  const [editorPages, setEditorPages] = useState<string[]>([]);
  const [isSelectionActive, setIsSelectionActive] = useState<boolean>(false);

  // References to handle mounting lifecycle and direct visual manipulation
  const initialCombinedHtmlRef = useRef<string>('');
  const isInitializedRef = useRef<boolean>(false);
  const reflowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // In-Place DOM Reflow: Adjusts dividers directly without destroying nodes or selection
  const reflowInPlace = () => {
    const editorEl = editorRef.current || document.getElementById('continuous-editor-sheet');
    if (!editorEl) return;

    // Save selection before making DOM changes
    const savedSel = saveSelection(editorEl);

    // 1. Find all existing divider elements
    const dividers = Array.from(editorEl.getElementsByClassName('page-break-divider')) as HTMLElement[];
    
    // 2. Remove them completely so they don't affect natural offsetTop measurements
    dividers.forEach(div => {
      div.remove();
    });

    // Fallback: If editor has no block children, insert a default paragraph so height/focus remain valid
    if (editorEl.children.length === 0) {
      editorEl.innerHTML = '<p><br></p>';
    }

    // 3. Get all content children (paragraphs, tables, lists, etc)
    const children = (Array.from(editorEl.children) as HTMLElement[]).filter(child => {
      return !child.classList.contains('page-break-divider');
    });

    const PADDING_TOP = 60;
    const CONTENT_BUDGET = 1000;
    const DIVIDER_HEIGHT = 48;

    let currentPageStart = PADDING_TOP;
    let currentPageEnd = PADDING_TOP + CONTENT_BUDGET;

    const breakBeforeElements: HTMLElement[] = [];
    let accumulatedOffset = 0;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      const naturalTop = child.offsetTop;
      const naturalHeight = child.offsetHeight;
      
      const adjustedTop = naturalTop + accumulatedOffset;
      const adjustedBottom = adjustedTop + naturalHeight;

      if (adjustedBottom > currentPageEnd) {
        if (i > 0) {
          breakBeforeElements.push(child);
          accumulatedOffset += DIVIDER_HEIGHT;
          
          currentPageStart = PADDING_TOP + (breakBeforeElements.length * (CONTENT_BUDGET + DIVIDER_HEIGHT));
          currentPageEnd = currentPageStart + CONTENT_BUDGET;
        }
      }
    }

    // 4. Insert new dividers before the calculated overflow elements
    breakBeforeElements.forEach((el, idx) => {
      const pageNum = idx + 1;
      const div = document.createElement('div');
      div.className = 'page-break-divider';
      div.setAttribute('contenteditable', 'false');
      div.setAttribute('data-page', pageNum.toString());
      div.style.userSelect = 'none';
      div.style.webkitUserSelect = 'none';
      div.style.height = `${DIVIDER_HEIGHT}px`;
      div.style.position = 'relative';
      
      editorEl.insertBefore(div, el);
    });

    // 5. Build dynamic pages slice representation for counters/previews
    const pages: string[] = [];
    let currentPageHtml = '';

    children.forEach(child => {
      if (breakBeforeElements.includes(child)) {
        pages.push(currentPageHtml);
        currentPageHtml = '';
      }
      currentPageHtml += child.outerHTML;
    });
    if (currentPageHtml) {
      pages.push(currentPageHtml);
    }

    setEditorPages(pages);
    setFullContentHtml(editorEl.innerHTML);

    // Restore caret position perfectly, eliminating cursor jumping!
    restoreSelection(editorEl, savedSel);
  };

  // Re-calculate the page break visual dividers precisely
  const handleAdjustPageBoundaries = (silent: boolean = false) => {
    reflowInPlace();
    if (!silent) {
      onSuccessMessage('Sekat batas kertas A4 berhasil disesuaikan dengan presisi tinggi!');
    }
  };

  // Dynamic Text Reflow with Cursor Selection Preservation
  const handleReflow = (immediate: boolean = false) => {
    if (reflowTimeoutRef.current) {
      clearTimeout(reflowTimeoutRef.current);
    }

    if (immediate) {
      reflowInPlace();
    } else {
      reflowTimeoutRef.current = setTimeout(reflowInPlace, 100);
    }
  };

  // Selection Change Listener to lock/unlock toolbar formatting buttons
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        const editorSheet = editorRef.current || document.getElementById('continuous-editor-sheet');
        if (editorSheet && (editorSheet.contains(sel.anchorNode) || editorSheet.contains(sel.focusNode))) {
          setIsSelectionActive(true);
          return;
        }
      }
      setIsSelectionActive(false);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Format Text block with automatic Reflow trigger
  const handleFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    // After formatting, immediately trigger reflow
    handleReflow(true);
  };

  // Initialize editor full content when modal opens
  useEffect(() => {
    if (isOpen) {
      let combinedHtml = '';
      if (initialPages && initialPages.length > 0) {
        combinedHtml = initialPages.map(page => {
          const isHtml = /<[a-z][\s\S]*>/i.test(page);
          if (isHtml) return page;
          return page.split('\n').map(p => `<p>${p || '&nbsp;'}</p>`).join('');
        }).join('');
      } else if (initialTextBody) {
        const isHtml = /<[a-z][\s\S]*>/i.test(initialTextBody);
        if (isHtml) {
          combinedHtml = initialTextBody;
        } else {
          combinedHtml = initialTextBody.split('\n').map(p => `<p>${p || '&nbsp;'}</p>`).join('');
        }
      }
      
      const initialAlign = initialTextAlign || 'justify';
      const initialDir = initialDirection || 'auto';
      const initialSize = initialFontSize || 'lg';
      const initialHeight = initialLineHeight || 'relaxed';

      setTextAlign(initialAlign);
      setDirection(initialDir);
      setFontSize(initialSize);
      setLineHeight(initialHeight);

      const computedDir = initialDir === 'auto' 
        ? (isArabicText(combinedHtml) ? 'rtl' : 'ltr') 
        : initialDir;
      const isRtl = computedDir === 'rtl';

      const result = insertPageDividers(combinedHtml, initialSize, initialHeight, isRtl);

      initialCombinedHtmlRef.current = result.combinedHtml;
      setFullContentHtml(result.combinedHtml);
      setEditorPages(result.pages);
      isInitializedRef.current = true;

      // Mount the initial layout with dividers directly into the editor
      setTimeout(() => {
        const editorEl = editorRef.current || document.getElementById('continuous-editor-sheet');
        if (editorEl) {
          editorEl.innerHTML = result.combinedHtml;
          // Initial calculation
          reflowInPlace();
        }
      }, 50);
    } else {
      isInitializedRef.current = false;
    }
  }, [isOpen, initialPages, initialTextBody, initialTextAlign, initialDirection, initialFontSize, initialLineHeight]);

  // Clean layout when editor configurations change
  useEffect(() => {
    if (!isInitializedRef.current) return;
    handleAdjustPageBoundaries(true);
  }, [fontSize, lineHeight, textAlign, direction]);

  // Cleanup spaces and empty markup tags
  const handleCleanSpaces = () => {
    const editorEl = editorRef.current || document.getElementById('continuous-editor-sheet');
    if (!editorEl) return;

    const currentHtml = editorEl.innerHTML;
    const cleanHtml = stripPageBreaks(currentHtml);
    
    let cleaned = cleanHtml;
    // Remove triple or more consecutive spaces
    cleaned = cleaned.replace(/ {3,}/g, ' ');
    // Remove excessive empty paragraphs
    cleaned = cleaned.replace(/(<p>&nbsp;<\/p>\s*){3,}/g, '<p>&nbsp;</p><p>&nbsp;</p>');
    cleaned = cleaned.replace(/(<p><br><\/p>\s*){3,}/g, '<p><br></p><p><br></p>');

    const computedDirection = direction === 'auto' 
      ? (isArabicText(cleaned) ? 'rtl' : 'ltr') 
      : direction;
    const isRtl = computedDirection === 'rtl';

    // Insert visual dividers back
    const result = insertPageDividers(cleaned, fontSize, lineHeight, isRtl);

    setFullContentHtml(result.combinedHtml);
    initialCombinedHtmlRef.current = result.combinedHtml;
    setEditorPages(result.pages);
    
    editorEl.innerHTML = result.combinedHtml;

    onSuccessMessage('Auto-Spasi sukses! Jarak antar-paragraf, spasi berlebih, dan sekat kertas A4 berhasil dirapikan secara serentak.');
  };

  const handleSave = () => {
    const editorEl = editorRef.current || document.getElementById('continuous-editor-sheet');
    const contentToSave = editorEl ? editorEl.innerHTML : fullContentHtml;

    const computedDirection = direction === 'auto' 
      ? (isArabicText(contentToSave) ? 'rtl' : 'ltr') 
      : direction;
    const isRtl = computedDirection === 'rtl';

    // Filter total all internal visual decorators and extra comments before saving clean text
    const cleanHtml = stripPageBreaks(contentToSave);

    // Fresh exact A4 page calculations on clean content
    const finalPages = paginateHtml(cleanHtml, {
      fontSize,
      lineHeight,
      isRtl
    });

    const trimmedPages = finalPages.map(p => p.trim());
    onSave(trimmedPages, cleanHtml, {
      textAlign,
      direction,
      fontSize,
      lineHeight
    });
    onSuccessMessage(`Kitab berhasil disunting. Total ${trimmedPages.length} Halaman A4 standard tersimpan.`);
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
                Editor Alur Bebas MS-Word <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.5 rounded-full font-serif lowercase italic">pro a4-style</span>
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
              className="flex items-center gap-1 bg-emerald-900 hover:bg-emerald-850 text-emerald-100 border border-emerald-755 px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition-all cursor-pointer shadow-2xs"
              title="Merapikan spasi berlebih dan spasi ganda secara cerdas"
            >
              <Sparkles className="h-3 w-3 text-amber-300" /> Auto-Spasi & Paragraf
            </button>

            {/* ADJUST PAGE BOUNDARIES */}
            <button
              type="button"
              onClick={() => handleAdjustPageBoundaries()}
              className="flex items-center gap-1 bg-teal-900 hover:bg-teal-850 text-teal-100 border border-teal-700 px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition-all cursor-pointer shadow-2xs"
              title="Mengkalkulasi ulang tinggi konten dan mengatur posisi sekat lembar kertas A4"
            >
              <BookOpen className="h-3 w-3 text-amber-300 animate-pulse" /> Sesuaikan Sekat Halaman (A4)
            </button>

            <span className="text-emerald-800/60 hidden md:inline">|</span>

            {/* COUNTERS */}
            <div className="flex items-center gap-1.5 bg-emerald-950/40 px-2.5 py-1 rounded-lg text-[9.5px] font-mono text-emerald-250">
              <span className="text-emerald-300 font-bold">{editorPages.length}</span> Hal A4
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

                {/* DIRECTION MODE (Global setting, keep editable) */}
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

              {/* NAV PREV NEXT BADGE */}
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="bg-slate-900 px-2.5 py-1 rounded text-slate-400 border border-slate-850">
                  Estimasi Budget: <span className="text-emerald-400 font-bold">{editorPages.length} Halaman A4</span>
                </span>
              </div>
            </div>

            {/* WYSIWYG SUB TOOLBAR FOR TEXT BLOCK (Selection locked) */}
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

                {/* TABLE INSERTER */}
                <button
                  type="button"
                  disabled={!isSelectionActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const tableHtml = `
                      <table style="width: 100%; border-collapse: collapse; margin: 14px 0;">
                        <thead>
                          <tr style="background-color: #f8fafc;">
                            <th style="border: 1.5px solid #cbd5e1; padding: 10px 14px; font-weight: bold; text-align: left;">Judul Kolom 1</th>
                            <th style="border: 1.5px solid #cbd5e1; padding: 10px 14px; font-weight: bold; text-align: left;">Judul Kolom 2</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style="border: 1.5px solid #cbd5e1; padding: 10px 14px;">Isi Data 1</td>
                            <td style="border: 1.5px solid #cbd5e1; padding: 10px 14px;">Isi Data 2</td>
                          </tr>
                        </tbody>
                      </table>
                    `;
                    handleFormat('insertHTML', tableHtml);
                  }}
                  className={!isSelectionActive ? `opacity-35 cursor-not-allowed pointer-events-none p-1 px-2 rounded bg-slate-900 border border-slate-700 text-slate-500 flex items-center gap-1 text-[10px]` : `p-1 px-2 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center gap-1 font-bold cursor-pointer`}
                  title="Sisipkan Tabel"
                >
                  <Table className="h-3.5 w-3.5" /> +Tabel
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
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 14px;
                  margin-bottom: 14px;
                  font-size: 0.9em;
                }
                .word-content th, .word-content td {
                  border: 1.5px solid #cbd5e1;
                  padding: 10px 14px;
                  text-align: inherit;
                  vertical-align: middle;
                }
                .word-content th {
                  background-color: #f8fafc;
                  font-weight: 700;
                  color: #1e293b;
                }
                .word-content tr:nth-child(even) {
                  background-color: rgba(248, 250, 252, 0.5);
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
                .page-break-divider {
                  height: 48px;
                  background-color: #f1f5f9;
                  margin-left: -60px;
                  margin-right: -60px;
                  border-top: 1px solid #cbd5e1;
                  border-bottom: 1px solid #cbd5e1;
                  box-shadow: inset 0 2px 4px rgba(0,0,0,0.05), inset 0 -2px 4px rgba(0,0,0,0.05);
                  position: relative;
                  user-select: none;
                  -webkit-user-select: none;
                  pointer-events: none;
                  display: block;
                }
              `}} />

              {/* Single Continuous Flowable Sheet with real visual page break divisions */}
              <div className="relative select-text" style={{ width: '794px' }}>
                
                {/* Flowable Editor Container with solid white paper appearance */}
                <div className="relative z-10 w-full" style={{ width: '794px' }}>
                  
                  {/* Floating Metadata Indicator */}
                  <div className="absolute top-[20px] left-[60px] right-[60px] flex items-center justify-between border-b pb-2 border-slate-200 font-mono text-[9px] text-slate-400 select-none pointer-events-none z-25">
                    <span className="uppercase tracking-wider font-extrabold text-emerald-800 font-sans">MANUSKRIP UTUH (A4 FLOWABLE)</span>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase font-sans">KERTAS A4 PATEN</span>
                      {isArabicText(fullContentHtml) && (
                        <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full text-[8px] font-bold font-sans">Aksara Arab Aktif</span>
                      )}
                    </div>
                  </div>

                  {/* Flowable Editor Content Area */}
                  <div
                    id="continuous-editor-sheet"
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => handleReflow(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
                        // Let browser finish processing naturally first, then update dividers in-place after 10ms
                        setTimeout(() => handleReflow(true), 10);
                      }
                    }}
                    onBlur={(e) => {
                      setFullContentHtml(e.currentTarget.innerHTML);
                    }}
                    dir={computedDirection}
                    className={`word-content outline-none focus:outline-none w-full transition-all font-medium text-slate-850 relative rounded-sm border border-slate-300 shadow-2xl ${alignClass} ${sizeClass} ${leadingClass} ${familyClass}`}
                    style={{
                      paddingTop: '60px',
                      paddingBottom: '60px',
                      paddingLeft: '60px',
                      paddingRight: '60px',
                      boxSizing: 'border-box',
                      minHeight: '1122px',
                      backgroundColor: '#ffffff'
                    }}
                  />

                  {/* Floating Footer Indicator inside Page 1 background bottom area */}
                  <div className="absolute top-[1085px] left-[60px] right-[60px] flex items-center justify-between border-t pt-2 border-slate-150 font-mono text-[8px] text-slate-400 select-none pointer-events-none z-20">
                    <span className="font-sans">Lembar Utama Aliran Kata</span>
                    <span className="font-sans">Simulasi Mesin Editor A4</span>
                  </div>
                </div>

              </div>

              {/* TIPS BANNER */}
              <div className="mt-6 p-4 bg-slate-850 text-[10.5px] leading-relaxed text-slate-300 max-w-[210mm] w-full rounded-xl border border-slate-700 flex items-start gap-3 shadow-md">
                <Sparkles className="h-4 w-4 text-amber-300 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <strong className="text-amber-300">Tips Format & Penyuntingan Pintar:</strong> 
                  <ul className="list-disc pl-4 space-y-1.5 mt-1.5 text-slate-350 font-sans">
                    <li>Halaman di atas bersikap <span className="text-emerald-300 font-bold">fleksibel & mengalir utuh (flowable)</span> layaknya Microsoft Word asli. Anda bebas menekan Enter atau menghapus spasi/kata tanpa batasan sekat antar halaman.</li>
                    <li>Sistem cerdas di latar belakang akan <span className="text-emerald-300 font-bold">mengkalkulasikan tinggi halaman A4</span> secara dinamis dan menempatkan sekat batas lembar kerja secara otomatis tanpa memutus alur kursor atau melompat.</li>
                    <li>Untuk memformat teks, pastikan Anda memblok/menyeleksi kata terlebih dahulu untuk mengaktifkan toolbar formatting di bagian atas.</li>
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
