// /src/lib/kitabUtils.ts
// Utility functions for Kitab text processing, formatting, and A4 pagination

export const isArabicText = (text: string): boolean => {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

/**
 * Strips tables, shapes, images, SVGs, canvases, hr, and visual page break dividers
 * from HTML content so only clean text (Indonesian, Arabic, etc.) remains.
 */
export const stripShapesAndTables = (html: string): string => {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const docObj = parser.parseFromString(html, 'text/html');
      
      // Remove tables, images, svgs, canvases, shapes, hr, and dividers
      const selector = 'table, img, svg, canvas, shape, picture, figure, video, embed, object, iframe, hr, .page-break-divider';
      docObj.querySelectorAll(selector).forEach(el => el.remove());
      
      return docObj.body.innerHTML;
    } catch (e) {
      console.warn('DOMParser failed in stripShapesAndTables, falling back to regex:', e);
    }
  }

  // Regex fallback
  return html
    .replace(/<table[\s\S]*?<\/table>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
    .replace(/<shape[\s\S]*?<\/shape>/gi, '')
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<hr[^>]*>/gi, '')
    .replace(/<div\s+[^>]*class=["'][^"']*page-break-divider[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi, '');
};

/**
 * Auto-Spasi & Paragraf Cleaner
 * 1. Strips tables & shapes & dividers
 * 2. Reduces multiple consecutive spaces to a single space
 * 3. Reduces excessive blank Enters / paragraphs to a single clean break
 */
export const cleanSpacesAndEnters = (html: string): string => {
  if (!html) return '';
  
  let cleaned = stripShapesAndTables(html);
  
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const docObj = parser.parseFromString(cleaned, 'text/html');
      
      // Clean extra spaces inside text nodes
      const walker = docObj.createTreeWalker(docObj.body, NodeFilter.SHOW_TEXT, null);
      let currentNode = walker.nextNode();
      while (currentNode) {
        if (currentNode.textContent) {
          currentNode.textContent = currentNode.textContent.replace(/[ \t\xA0]{2,}/g, ' ');
        }
        currentNode = walker.nextNode();
      }
      
      // Clean excessive empty paragraph blocks
      const children = Array.from(docObj.body.childNodes);
      let consecutiveEmpty = 0;
      children.forEach(node => {
        const text = node.textContent?.trim() || '';
        const isElement = node.nodeType === Node.ELEMENT_NODE;
        const tag = isElement ? (node as HTMLElement).tagName.toUpperCase() : '';
        const isEmpty = !text && (tag === 'P' || tag === 'DIV' || tag === 'BR');
        
        if (isEmpty) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 2) {
            node.remove();
          }
        } else {
          consecutiveEmpty = 0;
        }
      });
      
      return docObj.body.innerHTML;
    } catch (e) {
      console.warn('DOMParser failed in cleanSpacesAndEnters, using regex fallback:', e);
    }
  }

  // Regex fallback
  cleaned = cleaned.replace(/(&nbsp;|\s){2,}/g, ' ');
  cleaned = cleaned.replace(/(<p>\s*(<br\s*\/?>|&nbsp;|\s)*<\/p>\s*){2,}/gi, '<p><br></p>');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
};

/**
 * Precise browser-based HTML pagination
 * Splits a continuous HTML string into clean, full pages.
 * Guarantees NO text, word, or sentence is lost, broken in half, or cut off.
 */
export function paginateHtml(
  htmlContent: string,
  options: {
    fontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
    lineHeight: 'normal' | 'relaxed' | 'loose';
    isRtl: boolean;
    numericFontSize?: number;
    targetHeight?: number;
  }
): string[] {
  const cleanHtml = stripShapesAndTables(htmlContent);
  if (!cleanHtml || !cleanHtml.trim()) {
    return ['<p><br></p>'];
  }

  if (typeof document === 'undefined') {
    return [cleanHtml];
  }

  // Create an offscreen measurement container matching standard A4 dimensions at 96 DPI
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '794px';
  container.style.padding = '50px 55px 40px 55px';
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
    relaxed: '1.75',
    loose: '2.1'
  };
  container.style.fontSize = options.numericFontSize ? `${options.numericFontSize}px` : (fontSizeMap[options.fontSize] || '16px');
  container.style.lineHeight = lineHeightMap[options.lineHeight] || '1.75';

  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    .word-content p {
      margin-bottom: 12px;
      text-align: inherit;
    }
    .word-content h1, .word-content h2, .word-content h3, .word-content h4 {
      font-weight: 800;
      color: #0f172a;
      margin-top: 16px;
      margin-bottom: 10px;
      line-height: 1.3;
    }
    .word-content h1 { font-size: 1.6em; }
    .word-content h2 { font-size: 1.4em; }
    .word-content h3 { font-size: 1.2em; }
    .word-content ul, .word-content ol {
      margin-left: 24px;
      margin-bottom: 14px;
    }
    .page-break-divider, hr {
      display: none !important;
    }
  `;
  container.appendChild(styleEl);

  const tempPage = document.createElement('div');
  tempPage.style.width = '100%';
  tempPage.style.boxSizing = 'border-box';
  container.appendChild(tempPage);

  document.body.appendChild(container);

  // Target height for ~30 lines per A4 page with bottom breathing space
  const targetPageHeight = options.targetHeight || 840;

  // Format plain text into paragraphs if HTML tags are missing
  let parsedHtml = cleanHtml;
  if (!/<[a-z][\s\S]*>/i.test(parsedHtml)) {
    parsedHtml = parsedHtml.split('\n').map(p => `<p>${p || '&nbsp;'}</p>`).join('');
  }

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(parsedHtml, 'text/html');
  const nodesToProcess = Array.from(parsedDoc.body.childNodes);

  const pages: string[] = [];

  const appendNodeWithSplit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      return;
    }

    const clone = node.cloneNode(true);
    tempPage.appendChild(clone);

    if (tempPage.offsetHeight > targetPageHeight) {
      if (tempPage.childNodes.length > 1) {
        tempPage.removeChild(clone);
        if (tempPage.innerHTML.trim()) {
          pages.push(tempPage.innerHTML);
        }
        tempPage.innerHTML = '';
        appendNodeWithSplit(node);
      } else {
        tempPage.removeChild(clone);

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          const innerHtml = el.innerHTML;

          // Split element by words for maximum precision across sentences and long blocks
          const words = innerHtml.split(/\s+/).filter(Boolean);

          if (words.length > 1) {
            let accumulatedHtml = '';
            const wrapper = document.createElement(tagName);
            Array.from(el.attributes).forEach(attr => wrapper.setAttribute(attr.name, attr.value));

            for (let w = 0; w < words.length; w++) {
              const word = words[w];
              const testWrapper = wrapper.cloneNode(false) as HTMLElement;
              const testText = accumulatedHtml ? accumulatedHtml + ' ' + word : word;
              testWrapper.innerHTML = testText;
              
              tempPage.appendChild(testWrapper);
              if (tempPage.offsetHeight > targetPageHeight && accumulatedHtml) {
                tempPage.removeChild(testWrapper);
                
                // Commit current page with accumulated words
                const finalWrapper = wrapper.cloneNode(false) as HTMLElement;
                finalWrapper.innerHTML = accumulatedHtml;
                tempPage.appendChild(finalWrapper);
                
                pages.push(tempPage.innerHTML);
                tempPage.innerHTML = '';
                accumulatedHtml = word;
              } else {
                tempPage.removeChild(testWrapper);
                accumulatedHtml = testText;
              }
            }

            if (accumulatedHtml) {
              const finalWrapper = wrapper.cloneNode(false) as HTMLElement;
              finalWrapper.innerHTML = accumulatedHtml;
              tempPage.appendChild(finalWrapper);
            }
          } else {
            tempPage.appendChild(clone);
          }
        } else {
          tempPage.appendChild(clone);
        }
      }
    }
  };

  for (let i = 0; i < nodesToProcess.length; i++) {
    appendNodeWithSplit(nodesToProcess[i]);
  }

  if (tempPage.innerHTML.trim()) {
    pages.push(tempPage.innerHTML);
  }

  document.body.removeChild(container);

  return pages.length > 0 ? pages : ['<p><br></p>'];
}

