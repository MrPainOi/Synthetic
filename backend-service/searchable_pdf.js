'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { PDFParse } = require('pdf-parse');

/**
 * Standard WinAnsi character code ranges & supplementary characters
 * supported natively by standard Type 1 fonts (Helvetica, Times, Courier) in pdf-lib.
 */
const WIN_ANSI_EXTENDED_CODES = new Set([
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017D, 0x017E, 0x0192,
  0x02C6, 0x02DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C,
  0x201D, 0x201E, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039,
  0x203A, 0x20AC, 0x2122
]);

/**
 * Mapping common non-WinAnsi symbols & Unicode punctuation to safe WinAnsi equivalents.
 */
const UNICODE_REPLACEMENTS = {
  '\u2713': '[v]', '\u2714': '[v]', '\u221A': '[v]', // checkmarks
  '\u2715': '[x]', '\u2716': '[x]', '\u274C': '[x]', // cross marks
  '\u201C': '"', '\u201D': '"', '\u00AB': '"', '\u00BB': '"', // quotes
  '\u2018': "'", '\u2019': "'", '\u201A': "'",
  '\u2014': '-', '\u2013': '-', '\u2212': '-', // dashes
  '\u2026': '...', // ellipsis
  '\u2022': '*', '\u00B7': '*', '\u25E6': '*', '\u25AA': '*', '\u25AB': '*', // bullets
  '\u2192': '->', '\u2794': '->', '\u279C': '->', '\u2190': '<-', // arrows
  '\u2264': '<=', '\u2265': '>=', '\u2260': '!=', '\u00B1': '+/-',
  '\u00D7': 'x', '\u00F7': '/', '\u00B0': ' deg ',
  '\u00A9': '(c)', '\u00AE': '(r)', '\u2122': '(tm)',
  '\u200B': '', '\uFEFF': '', '\u00A0': ' ', // zero-width & non-breaking spaces
  '\t': ' ', '\r': ''
};

/**
 * Sanitize text so that pdf-lib's WinAnsi encoder will never throw.
 * @param {string} text 
 * @returns {string} Safe single-line string encoded cleanly for pdf-lib
 */
function sanitizeTextForPdf(text) {
  if (text === null || text === undefined) return '';
  let str = String(text);

  // Apply common symbol replacements
  str = str.replace(/[\u2713\u2714\u221A\u2715\u2716\u274C\u201C\u201D\u00AB\u00BB\u2018\u2019\u201A\u2014\u2013\u2212\u2026\u2022\u00B7\u25E6\u25AA\u25AB\u2192\u2794\u279C\u2190\u2264\u2265\u2260\u00B1\u00D7\u00F7\u00B0\u00A9\u00AE\u2122\u200B\uFEFF\u00A0\t\r]/g,
    ch => UNICODE_REPLACEMENTS[ch] !== undefined ? UNICODE_REPLACEMENTS[ch] : ' '
  );

  // Filter or replace any character not in WinAnsi
  let cleaned = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Standard ASCII printables (32 to 126)
    if (code >= 32 && code <= 126) {
      cleaned += str[i];
    } else if (code >= 160 && code <= 255) {
      // Latin-1 supplement
      cleaned += str[i];
    } else if (WIN_ANSI_EXTENDED_CODES.has(code)) {
      // Extended characters supported by standard PDF Helvetica
      cleaned += str[i];
    } else {
      // Replace unencodable character with space
      cleaned += ' ';
    }
  }

  return cleaned.trim();
}

/**
 * Detect image format from buffer magic bytes.
 * @param {Uint8Array|Buffer} buf 
 * @returns {'png'|'jpg'|'unknown'}
 */
function detectImageFormat(buf) {
  if (!buf || buf.length < 4) return 'unknown';
  // PNG magic bytes: 0x89 0x50 0x4E 0x47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return 'png';
  }
  // JPEG magic bytes: 0xFF 0xD8 0xFF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'jpg';
  }
  return 'unknown';
}

/**
 * Normalize input (Buffer, Uint8Array, base64, data URI, file path) into a clean, isolated Uint8Array.
 * @param {Buffer|Uint8Array|string} input 
 * @returns {Uint8Array|null}
 */
function toUint8Array(input) {
  if (!input) return null;
  if (input instanceof Uint8Array) {
    // Return clean copy to guarantee isolated ArrayBuffer
    return new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
  }
  if (Buffer.isBuffer(input)) {
    return new Uint8Array(input);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // Check if it's a data URI: data:image/png;base64,... or data:application/pdf;base64,...
    const match = trimmed.match(/^data:[a-zA-Z0-9\/+-]+;base64,(.+)$/);
    if (match) {
      const buf = Buffer.from(match[1], 'base64');
      return new Uint8Array(buf);
    }
    // Check if file path exists on disk
    if (fs.existsSync(trimmed)) {
      const buf = fs.readFileSync(trimmed);
      return new Uint8Array(buf);
    }
    const resolved = path.resolve(trimmed);
    if (fs.existsSync(resolved)) {
      const buf = fs.readFileSync(resolved);
      return new Uint8Array(buf);
    }
    // Try base64 decode only if it looks like raw base64 string
    if (!trimmed.includes('/') && !trimmed.includes('\\') && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      try {
        const buf = Buffer.from(trimmed, 'base64');
        if (buf.length > 0) return new Uint8Array(buf);
      } catch (_) {}
    }
  }

  return null;
}

/**
 * Overlay transparent OCR text lines onto a PDFPage.
 * Supports:
 * - Gemini box_2d: [ymin, xmin, ymax, xmax] (normalized 0..1000 or 0..1, or absolute points)
 * - Explicit coordinates: { x, y, width, height, fontSize }
 * - Sequential line layout from page-level text
 *
 * @param {PDFPage} pdfPage 
 * @param {object} pageData 
 * @param {PDFFont} font 
 * @param {object} options 
 */
function renderTextLayerOnPage(pdfPage, pageData, font, options = {}) {
  const { width: pageWidth, height: pageHeight } = pdfPage.getSize();
  const textOpacity = typeof options.opacity === 'number' ? options.opacity : 0; // Default 0: invisible / searchable layer

  // Gather text items from lines, blocks, words, or textBlocks
  let items = [];
  if (Array.isArray(pageData.lines) && pageData.lines.length > 0) {
    items = pageData.lines;
  } else if (Array.isArray(pageData.blocks) && pageData.blocks.length > 0) {
    items = pageData.blocks;
  } else if (Array.isArray(pageData.words) && pageData.words.length > 0) {
    items = pageData.words;
  } else if (Array.isArray(pageData.textBlocks) && pageData.textBlocks.length > 0) {
    items = pageData.textBlocks;
  }

  // If structured items exist, render them with coordinates
  if (items.length > 0) {
    for (const item of items) {
      const rawText = typeof item === 'string' ? item : (item.text || item.str || item.content || '');
      const cleanText = sanitizeTextForPdf(rawText);
      if (!cleanText && (!Array.isArray(item.words) || item.words.length === 0)) continue;

      let pdfX = 0;
      let pdfY = 0;
      let boxW = 0;
      let boxH = 0;
      let calculatedFontSize = item.fontSize || item.size || 0;
      let scaleX = 1;
      let scaleY = 1;

      // Extract box coordinates: box_2d, bbox, or box
      const boxArray = Array.isArray(item.box_2d) ? item.box_2d :
                       (Array.isArray(item.bbox) ? item.bbox :
                       (Array.isArray(item.box) ? item.box : null));

      let boxBottom = 0;

      if (boxArray && boxArray.length === 4) {
        // Handle Gemini box_2d: [ymin, xmin, ymax, xmax]
        const [ymin, xmin, ymax, xmax] = boxArray.map(Number);
        const maxVal = Math.max(ymin, xmin, ymax, xmax);

        if (maxVal <= 1.01) {
          // Normalized 0.0 - 1.0
          scaleX = pageWidth;
          scaleY = pageHeight;
        } else if (maxVal <= 1005) {
          // Gemini standard 0 - 1000
          scaleX = pageWidth / 1000;
          scaleY = pageHeight / 1000;
        } else if (pageData.imageWidth && pageData.imageHeight) {
          scaleX = pageWidth / pageData.imageWidth;
          scaleY = pageHeight / pageData.imageHeight;
        }

        boxW = Math.max(0, (xmax - xmin) * scaleX);
        boxH = Math.max(0, (ymax - ymin) * scaleY);
        pdfX = Math.max(0, xmin * scaleX);

        // In PDF coordinates: origin (0,0) is bottom-left, y increases upward.
        // Screen/OCR ymin is distance from TOP. ymax is lower edge from TOP.
        // Therefore, bottom of box in PDF = pageHeight - (ymax * scaleY).
        boxBottom = pageHeight - (ymax * scaleY);

      } else if (item.x !== undefined && item.y !== undefined) {
        // Explicit coordinates { x, y, width, height, fontSize }
        let rawX = Number(item.x) || 0;
        let rawY = Number(item.y) || 0;
        let rawW = Number(item.width || item.w) || 0;
        let rawH = Number(item.height || item.h) || 0;

        // If coordinates are normalized <= 1.0
        if (rawX <= 1 && rawY <= 1 && rawW <= 1 && rawH <= 1 && (rawX > 0 || rawY > 0)) {
          pdfX = rawX * pageWidth;
          boxW = rawW * pageWidth;
          boxH = rawH * pageHeight;
          boxBottom = pageHeight - (rawY + rawH) * pageHeight;
        } else {
          // Coordinates in points / pixels
          pdfX = rawX;
          boxW = rawW;
          boxH = rawH;

          // If OCR y is distance from top (standard default)
          if (item.origin === 'bottom' || item.yIsBottom) {
            boxBottom = rawY;
          } else {
            const h = boxH || calculatedFontSize || 12;
            boxBottom = pageHeight - (rawY + h);
          }
        }
      } else {
        // Item without coordinates
        continue;
      }

      // If word-level bounding boxes are provided in item.words, render each word individually for 1:1 precision
      if (Array.isArray(item.words) && item.words.length > 0) {
        for (const w of item.words) {
          const rawWordText = typeof w === 'string' ? w : (w.text || w.str || '');
          const cleanWord = sanitizeTextForPdf(rawWordText);
          if (!cleanWord) continue;

          const wBox = Array.isArray(w.box_2d) ? w.box_2d : (Array.isArray(w.bbox) ? w.bbox : null);
          if (wBox && wBox.length === 4) {
            const [wYmin, wXmin, wYmax, wXmax] = wBox.map(Number);
            const wX = Math.max(0, wXmin * scaleX);
            const wYbottom = pageHeight - (wYmax * scaleY);
            const wH = Math.max(0, (wYmax - wYmin) * scaleY);
            const wW = Math.max(0, (wXmax - wXmin) * scaleX);
            let wSize = w.fontSize || (wH > 0 ? wH * 0.82 : 10);
            wSize = Math.max(4, Math.min(72, wSize));

            try {
              const wRenderWidth = font.widthOfTextAtSize(cleanWord, wSize);
              if (wW > 5 && wRenderWidth > wW * 1.02) {
                wSize = Math.max(4, wSize * (wW / wRenderWidth));
              }
            } catch (_) {}

            const wY = Math.max(0, Math.min(pageHeight - 4, wYbottom + (wSize * 0.18)));
            try {
              pdfPage.drawText(cleanWord, {
                x: wX,
                y: wY,
                size: wSize,
                font,
                color: rgb(0, 0, 0),
                opacity: textOpacity
              });
            } catch (_) {}
          }
        }
        continue;
      }

      if (!cleanText) continue;

      // 1:1 Typography Alignment Calculation:
      // Helvetica glyphs occupy ~82% of box height.
      if (!calculatedFontSize) {
        calculatedFontSize = boxH > 0 ? (boxH * 0.82) : 10;
      }
      calculatedFontSize = Math.max(4, Math.min(72, calculatedFontSize));

      // Helvetica descent is ~20% of font size.
      // Align baseline at boxBottom + (fontSize * 0.18) so descenders touch boxBottom
      // and capital letters reach boxBottom + (fontSize * 0.90) <= boxBottom + boxH.
      pdfY = Math.max(0, Math.min(pageHeight - 4, boxBottom + (calculatedFontSize * 0.18)));
      pdfX = Math.max(0, Math.min(pageWidth - 4, pdfX));

      // Horizontal width matching & word spacing
      let wordSpacing = 0;
      if (boxW > 5) {
        try {
          const renderedWidth = font.widthOfTextAtSize(cleanText, calculatedFontSize);
          if (renderedWidth > boxW * 1.02) {
            // Text overflows box: scale font size down proportionally so it fits exactly within boxW
            const scaleDown = boxW / renderedWidth;
            calculatedFontSize = Math.max(4, calculatedFontSize * scaleDown);
            pdfY = Math.max(0, Math.min(pageHeight - 4, boxBottom + (calculatedFontSize * 0.18)));
          } else if (renderedWidth < boxW * 0.90 && cleanText.includes(' ')) {
            // Text is narrower and has spaces: distribute difference across word spacing
            const spaceCount = (cleanText.match(/ /g) || []).length;
            if (spaceCount > 0) {
              const diff = boxW - renderedWidth;
              const perSpace = diff / spaceCount;
              if (perSpace <= calculatedFontSize * 1.5) {
                wordSpacing = perSpace;
              }
            }
          }
        } catch (_) {}
      }

      // Render the text at computed position
      try {
        pdfPage.drawText(cleanText, {
          x: pdfX,
          y: pdfY,
          size: calculatedFontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: textOpacity,
          ...(wordSpacing > 0 ? { wordSpacing } : {})
        });
      } catch (err) {
        // Fallback: draw with basic ASCII to ensure text is never skipped
        const asciiFallback = cleanText.replace(/[^\x20-\x7E]/g, ' ');
        try {
          pdfPage.drawText(asciiFallback, {
            x: pdfX,
            y: pdfY,
            size: calculatedFontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: textOpacity,
            ...(wordSpacing > 0 ? { wordSpacing } : {})
          });
        } catch (_) {}
      }
    }
    return;
  }

  // Fallback: Page-level unstructured text (e.g. pageData.text or pageData.fullText)
  const fullText = pageData.text || pageData.fullText || pageData.rawText || '';
  if (typeof fullText === 'string' && fullText.trim()) {
    const lines = fullText.split(/\r?\n/).map(l => sanitizeTextForPdf(l)).filter(Boolean);
    const marginLeft = 36; // 0.5 inch margin
    const marginTop = 36;
    const fontSize = options.fallbackFontSize || 10;
    const lineHeight = fontSize * 1.35;
    let currentY = pageHeight - marginTop - fontSize;

    for (const line of lines) {
      if (currentY < 36) {
        // Page boundary reached; clamp or break
        break;
      }
      try {
        pdfPage.drawText(line, {
          x: marginLeft,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: textOpacity
        });
      } catch (e) {
        const asciiLine = line.replace(/[^\x20-\x7E]/g, ' ');
        try {
          pdfPage.drawText(asciiLine, {
            x: marginLeft,
            y: currentY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: textOpacity
          });
        } catch (_) {}
      }
      currentY -= lineHeight;
    }
  }
}

/**
 * Generate a Searchable PDF (Sandwiched / OCR text layer).
 *
 * @param {object} params
 * @param {Array<object>} params.pages Array of page definitions with OCR lines or image
 * @param {Buffer|Uint8Array|string} [params.originalPdfBuffer] Existing PDF to overlay text upon
 * @param {boolean} [params.isImageOnly=false] Force creating new PDF document from images
 * @param {object} [params.options] Additional rendering options (e.g. opacity, default dimensions)
 * @returns {Promise<Buffer>} Searchable PDF binary buffer
 */
async function generateSearchablePdf({ pages = [], originalPdfBuffer = null, isImageOnly = false, options = {} } = {}) {
  // Normalize pages input into an array
  let pageList = [];
  if (Array.isArray(pages)) {
    pageList = pages;
  } else if (pages && typeof pages === 'object') {
    if (Array.isArray(pages.pages)) {
      pageList = pages.pages;
    } else {
      pageList = [pages];
    }
  }

  // Determine mode: Existing PDF overlay vs. New PDF from images/scans
  const hasExistingPdf = Boolean(originalPdfBuffer && !isImageOnly);

  let doc;
  if (hasExistingPdf) {
    const rawPdfBytes = toUint8Array(originalPdfBuffer);
    if (!rawPdfBytes || rawPdfBytes.length === 0) {
      throw new Error('generateSearchablePdf: originalPdfBuffer is invalid or empty');
    }
    doc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
  } else {
    doc = await PDFDocument.create();
  }

  // Embed default Helvetica font for text rendering
  const font = await doc.embedFont(StandardFonts.Helvetica);

  if (hasExistingPdf) {
    // Mode 1: Overlay text layer onto existing PDF pages
    const existingPages = doc.getPages();

    for (let i = 0; i < pageList.length; i++) {
      const pageData = pageList[i];
      let targetIndex = i;

      // Match by pageNumber (1-based) or pageIndex (0-based)
      if (typeof pageData.pageNumber === 'number' && pageData.pageNumber >= 1) {
        targetIndex = pageData.pageNumber - 1;
      } else if (typeof pageData.pageIndex === 'number' && pageData.pageIndex >= 0) {
        targetIndex = pageData.pageIndex;
      }

      if (targetIndex >= 0 && targetIndex < existingPages.length) {
        const pdfPage = existingPages[targetIndex];
        renderTextLayerOnPage(pdfPage, pageData, font, options);
      }
    }
  } else {
    // Mode 2: Create new PDF from image scans or page definitions
    // Default page size: A4 (595.28 x 841.89 pt)
    const defaultWidth = options.pageWidth || 595.28;
    const defaultHeight = options.pageHeight || 841.89;

    if (pageList.length === 0) {
      // Empty document fallback: create one blank page
      doc.addPage([defaultWidth, defaultHeight]);
    }

    for (const pageData of pageList) {
      const imgInput = pageData.image || pageData.imageBuffer || pageData.data || pageData.buffer;
      const imgBytes = toUint8Array(imgInput);

      let pdfPage;
      if (imgBytes && imgBytes.length > 0) {
        // Detect format and embed image
        const format = pageData.imageType || detectImageFormat(imgBytes);
        let embeddedImage;

        if (format === 'png') {
          embeddedImage = await doc.embedPng(imgBytes);
        } else if (format === 'jpg' || format === 'jpeg') {
          embeddedImage = await doc.embedJpg(imgBytes);
        } else {
          // Attempt JPG first, then fallback to PNG
          try {
            embeddedImage = await doc.embedJpg(imgBytes);
          } catch (_) {
            embeddedImage = await doc.embedPng(imgBytes);
          }
        }

        // Determine page dimensions:
        // Scanned document images keep original pixel width/height (1:1 scale for maximum resolution).
        // If image is an icon or tiny (< 200 pt), use default page dimensions to prevent clipping.
        let pageWidth = Number(pageData.width);
        let pageHeight = Number(pageData.height);

        if (!pageWidth || !pageHeight) {
          if (embeddedImage.width >= 200 && embeddedImage.height >= 200) {
            pageWidth = embeddedImage.width;
            pageHeight = embeddedImage.height;
          } else {
            pageWidth = defaultWidth;
            pageHeight = defaultHeight;
          }
        }

        pdfPage = doc.addPage([pageWidth, pageHeight]);

        // Draw scanned page image in the background
        pdfPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight
        });
      } else {
        // Page without image (e.g. synthetic text page)
        const pageWidth = Number(pageData.width) || defaultWidth;
        const pageHeight = Number(pageData.height) || defaultHeight;
        pdfPage = doc.addPage([pageWidth, pageHeight]);
      }

      // Overlay the invisible, selectable OCR text layer on top of the image
      renderTextLayerOnPage(pdfPage, pageData, font, options);
    }
  }

  // Save and return final PDF Buffer
  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Convenience helper to create a searchable PDF strictly from image scans.
 */
async function createSearchablePdfFromImages(pages, options = {}) {
  return generateSearchablePdf({ pages, isImageOnly: true, options });
}

/**
 * Convenience helper to overlay searchable text onto an existing PDF buffer.
 */
async function createSearchablePdfFromExisting(originalPdfBuffer, pages, options = {}) {
  return generateSearchablePdf({ originalPdfBuffer, pages, isImageOnly: false, options });
}

/**
 * Verify and extract text from a generated PDF buffer using pdf-parse.
 * @param {Buffer|Uint8Array} pdfBuffer 
 * @returns {Promise<string>}
 */
async function extractTextFromPdf(pdfBuffer) {
  if (!pdfBuffer) return '';
  const uint8 = toUint8Array(pdfBuffer);
  const parser = new PDFParse({ data: uint8 });
  try {
    await parser.load();
    const result = await parser.getText();
    if (typeof result === 'string') return result;
    return (result && result.text) ? result.text : '';
  } finally {
    try {
      await parser.destroy();
    } catch (_) {}
  }
}

// Export module functions
generateSearchablePdf.generateSearchablePdf = generateSearchablePdf;
generateSearchablePdf.createSearchablePdfFromImages = createSearchablePdfFromImages;
generateSearchablePdf.createSearchablePdfFromExisting = createSearchablePdfFromExisting;
generateSearchablePdf.extractTextFromPdf = extractTextFromPdf;
generateSearchablePdf.sanitizeTextForPdf = sanitizeTextForPdf;
generateSearchablePdf.default = generateSearchablePdf;

module.exports = generateSearchablePdf;
