const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // juga baca dari root jika ada
const { GoogleGenAI } = require('@google/genai');
const { PDFDocument } = require('pdf-lib');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const delay = ms => new Promise(res => setTimeout(res, ms));

// Helper inisialisasi Gemini API client
function getAiClient(customKey) {
    const key = customKey || process.env.GEMINI_API_KEY;
    if (!key || !key.trim()) {
        throw new Error("GEMINI_API_KEY belum diset. Silakan atur GEMINI_API_KEY di file .env atau melalui pengaturan.");
    }
    return new GoogleGenAI({ apiKey: key.trim() });
}

const MIME_MAP = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
};

function resolveMimeType(filePath, providedMime) {
    if (providedMime && providedMime !== 'application/octet-stream' && providedMime !== '') {
        return providedMime;
    }
    const ext = path.extname(filePath || '').toLowerCase();
    return MIME_MAP[ext] || 'application/pdf';
}

const OCR_PROMPT = `You are an expert OCR, document layout analysis, and text extraction engine.
Analyze the provided document (scanned PDF or image) with high structural precision and exact spatial alignment.

Extract all visible text and output ONLY a valid JSON object matching this schema:
{
  "fullText": "Clean, structured text preserving paragraphs, line breaks, and tabular layout so the user can directly copy and paste it into spreadsheets or text documents.",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Clean structured text of page 1",
      "lines": [
        {
          "text": "Extracted text of this specific line or heading or row",
          "box_2d": [ymin, xmin, ymax, xmax]
        }
      ]
    }
  ],
  "summary": {
    "documentType": "Invoice / Packing List / Bill of Lading / Surat Jalan / Kepabeanan (PIB/PEB/PPFTZ) / Kontrak / Other",
    "detectedLanguage": "Indonesian / English / Chinese / Japanese / etc",
    "totalWords": 0,
    "totalCharacters": 0
  }
}

CRITICAL SPATIAL & BOUNDING BOX INSTRUCTIONS:
1. "lines": Break text down into precise, individual visual lines or table cells.
   - For every line, "box_2d": [ymin, xmin, ymax, xmax] MUST tightly wrap the exact visual bounds of that line of text on the page image.
   - Scale: Normalized 0 to 1000 integer coordinates:
     * ymin = top edge of text line (0 = very top of page, 1000 = bottom of page)
     * xmin = left edge of text line (0 = very left edge, 1000 = right edge)
     * ymax = bottom edge of text line
     * xmax = right edge of text line
   - High spatial precision is required so that an interactive HTML text layer and a PDF transparent text layer align exactly 1:1 on top of the original scanned words.
2. "fullText": Preserves original line breaks, blank lines, table columns aligned with whitespace/tabs, headers, and footer notes. It must be human-readable and clean.
3. "pages": Array of pages. If document has multiple pages, extract each page sequentially with correct pageNumber (1, 2, ...). If it's a single image, provide 1 page.
4. "summary":
   - documentType: Detect if it is Invoice, Packing List (PL), Bill of Lading (B/L), Surat Jalan / Pengantar, PIB, PEB, PPFTZ, or other business document.
   - detectedLanguage: Primary language detected.
   - totalWords: Count of words in fullText.
   - totalCharacters: Count of characters in fullText.
5. Return ONLY pure JSON. Do NOT wrap in markdown fences (\`\`\`json). No conversational commentary.`;

/**
 * Parse JSON safely from AI models with automatic sanitization,
 * trailing comma cleanup, and truncated bracket/brace recovery.
 */
function parseSafeJson(rawText) {
    if (typeof rawText !== 'string') return rawText || {};
    let clean = rawText.trim();
    if (clean.startsWith('```')) {
        clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    // 0. Pre-clean AI commentary and syntax quirks
    clean = clean.replace(/\/\/[^\n\r]*/g, '');
    clean = clean.replace(/\/\*[\s\S]*?\*\//g, '');
    clean = clean.replace(/,\s*\[\s*x?min[^\n\r\]]+\]\s*->\s*\[[^\]]+\]/gi, '');
    clean = clean.replace(/->\s*\[[^\]]+\]/g, '');

    // 1. Direct JSON parse
    try {
        return JSON.parse(clean);
    } catch (_) { }

    // 2. Extract outer object { ... }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        let sub = clean.slice(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(sub);
        } catch (_) {
            // Remove trailing commas before } or ]
            try {
                const noTrailing = sub.replace(/,\s*([}\]])/g, '$1').replace(/,\s*([}\]])/g, '$1');
                return JSON.parse(noTrailing);
            } catch (_) { }

            // Strip invalid control characters
            try {
                const noCtrl = sub.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, '');
                const noTrailing = noCtrl.replace(/,\s*([}\]])/g, '$1').replace(/,\s*([}\]])/g, '$1');
                return JSON.parse(noTrailing);
            } catch (_) { }
        }
    }

    // 3. Truncated JSON recovery: close open quotes, brackets, and braces
    if (firstBrace !== -1) {
        let partial = clean.slice(firstBrace);
        partial = partial.replace(/,\s*$/, '');
        let openBraces = 0, openBrackets = 0;
        let inString = false, escaped = false;
        for (let i = 0; i < partial.length; i++) {
            const char = partial[i];
            if (escaped) { escaped = false; continue; }
            if (char === '\\') { escaped = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (!inString) {
                if (char === '{') openBraces++;
                else if (char === '}') openBraces = Math.max(0, openBraces - 1);
                else if (char === '[') openBrackets++;
                else if (char === ']') openBrackets = Math.max(0, openBrackets - 1);
            }
        }
        if (inString) partial += '"';
        while (openBrackets > 0) { partial += ']'; openBrackets--; }
        while (openBraces > 0) { partial += '}'; openBraces--; }
        try {
            return JSON.parse(partial.replace(/,\s*([}\]])/g, '$1'));
        } catch (_) { }
    }

    // 4. Robust Line & Text Recovery via Regex (rescuing lines and bounding boxes from malformed AI JSON)
    const recoveredLines = [];
    const lineRegex = /\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"box_2d"\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]/gi;
    let m;
    while ((m = lineRegex.exec(clean)) !== null) {
        try {
            const text = JSON.parse(`"${m[1]}"`);
            const box = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
            recoveredLines.push({ text, box_2d: box });
        } catch (_) {
            recoveredLines.push({ text: m[1], box_2d: [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])] });
        }
    }

    // Try finding fullText or text field
    const textMatch = clean.match(/"(?:fullText|text)"\s*:\s*"((?:\\.|[^"\\])*)"/);
    let extractedText = '';
    if (textMatch) {
        try {
            extractedText = JSON.parse(`"${textMatch[1]}"`);
        } catch (_) {
            extractedText = textMatch[1];
        }
    } else if (recoveredLines.length > 0) {
        extractedText = recoveredLines.map(l => l.text).join('\n');
    } else {
        // Extreme fallback: strip all JSON syntax keys and braces, NEVER return raw JSON code
        extractedText = clean
            .replace(/"pageNumber"\s*:\s*\d+,?/gi, '')
            .replace(/"box_2d"\s*:\s*\[[^\]]+\]/gi, '')
            .replace(/"lines"\s*:\s*\[/gi, '')
            .replace(/[{}\[\]",:]/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    // Extract pageNumber if present
    const pgNumMatch = clean.match(/"pageNumber"\s*:\s*(\d+)/);
    const resolvedPageNum = pgNumMatch ? parseInt(pgNumMatch[1], 10) : 1;

    return {
        fullText: extractedText,
        pages: [{
            pageNumber: resolvedPageNum,
            text: extractedText,
            lines: recoveredLines
        }],
        summary: {
            documentType: 'Dokumen',
            detectedLanguage: 'Indonesia'
        }
    };
}

/**
 * Normalizes and validates the extracted OCR JSON data.
 */
function normalizeOcrData(rawJson, fileName) {
    let data = {};
    if (typeof rawJson === 'string') {
        data = parseSafeJson(rawJson);
    } else if (typeof rawJson === 'object' && rawJson !== null) {
        data = rawJson;
    }

    // Pastikan fullText ada
    let fullText = typeof data.fullText === 'string' ? data.fullText : (typeof data.text === 'string' ? data.text : '');

    // Pastikan pages ada
    let pages = Array.isArray(data.pages) ? data.pages : [];
    if (pages.length === 0) {
        if (Array.isArray(data.lines) && data.lines.length > 0) {
            pages = [{
                pageNumber: data.pageNumber || 1,
                text: data.text || fullText,
                lines: data.lines
            }];
        } else {
            pages = [{
                pageNumber: data.pageNumber || 1,
                text: fullText,
                lines: []
            }];
        }
    }

    // Normalisasi setiap halaman dan baris
    pages = pages.map((page, pIdx) => {
        const pageNum = Number(page.pageNumber) || (pIdx + 1);
        const pageText = typeof page.text === 'string' ? page.text : '';
        let rawLinesList = Array.isArray(page.lines) ? page.lines : [];

        // Jika lines kosong tapi pageText ada, buat fallback lines dari baris teks
        if (rawLinesList.length === 0 && pageText.trim().length > 0) {
            const rawLines = pageText.split('\n').filter(l => l.trim().length > 0);
            const totalLines = rawLines.length || 1;
            const lineH = Math.min(28, Math.floor(900 / totalLines));
            rawLinesList = rawLines.map((lineStr, lIdx) => {
                const ymin = Math.min(950, 50 + lIdx * lineH);
                const ymax = Math.min(990, ymin + lineH - 4);
                return {
                    text: lineStr.trim(),
                    box_2d: [ymin, 50, ymax, 950]
                };
            });
        }

        // Ekstrak dan pecah bongkahan multi-line/paragraf menjadi baris-baris individual presisi
        const expandedLines = [];
        rawLinesList.forEach(line => {
            const text = (line.text || '').toString();
            if (!text.trim()) return;

            let box = Array.isArray(line.box_2d) ? line.box_2d :
                (Array.isArray(line.bbox) ? line.bbox :
                    (Array.isArray(line.box) ? line.box : null));

            // Buka kemasan nested array jika AI mengembalikan [[ymin, xmin, ymax, xmax], ...]
            if (Array.isArray(box) && box.length > 0 && Array.isArray(box[0])) {
                box = box[0];
            }

            if (!box || box.length < 4) {
                box = [0, 0, 1000, 1000];
            }

            const rawCoords = box.slice(0, 4).map(v => Number(v) || 0);
            const maxVal = Math.max(...rawCoords);
            let ymin, xmin, ymax, xmax;

            if (maxVal <= 1.05 && maxVal > 0) {
                ymin = Math.round(rawCoords[0] * 1000);
                xmin = Math.round(rawCoords[1] * 1000);
                ymax = Math.round(rawCoords[2] * 1000);
                xmax = Math.round(rawCoords[3] * 1000);
            } else {
                ymin = Math.round(rawCoords[0]);
                xmin = Math.round(rawCoords[1]);
                ymax = Math.round(rawCoords[2]);
                xmax = Math.round(rawCoords[3]);
            }

            ymin = Math.max(0, Math.min(1000, ymin));
            xmin = Math.max(0, Math.min(1000, xmin));
            ymax = Math.max(ymin, Math.min(1000, Math.max(ymax, ymin + 8)));
            xmax = Math.max(xmin, Math.min(1000, Math.max(xmax, xmin + 15)));

            const boxH = ymax - ymin;
            const subLines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

            // Anti-Bongkahan: Jika teks terdiri dari beberapa baris dan tinggi kotak > 35, pecah menjadi baris terpisah
            if (subLines.length > 1 && boxH > 35) {
                const stepH = boxH / subLines.length;
                subLines.forEach((sText, sIdx) => {
                    const sYmin = Math.round(ymin + sIdx * stepH);
                    const sYmax = Math.round(ymin + (sIdx + 1) * stepH);
                    expandedLines.push({
                        text: sText,
                        box_2d: [sYmin, xmin, sYmax, xmax],
                        words: line.words
                    });
                });
            } else {
                // Batasi tinggi kotak tunggal agar tidak pernah menutupi sebagian besar halaman (> 10% halaman)
                let finalYmax = ymax;
                if (boxH > 100 && subLines.length <= 1) {
                    finalYmax = Math.min(1000, ymin + 26);
                }
                expandedLines.push({
                    text,
                    box_2d: [ymin, xmin, finalYmax, xmax],
                    words: line.words
                });
            }
        });

        const normalizedLines = expandedLines.map(line => {
            const text = line.text;
            const [ymin, xmin, ymax, xmax] = line.box_2d;

            const normX = xmin / 1000;
            const normY = ymin / 1000;
            const normWidth = (xmax - xmin) / 1000;
            const normHeight = (ymax - ymin) / 1000;

            const leftPercent = Number((normX * 100).toFixed(3));
            const topPercent = Number((normY * 100).toFixed(3));
            const widthPercent = Number((normWidth * 100).toFixed(3));
            const heightPercent = Number((normHeight * 100).toFixed(3));
            const fontSizePt = Math.max(6, Math.min(48, Math.round((ymax - ymin) * 0.72)));

            const lineItem = {
                text,
                box_2d: [ymin, xmin, ymax, xmax],
                ymin,
                xmin,
                ymax,
                xmax,
                x: xmin,
                y: ymin,
                width: Math.max(1, xmax - xmin),
                height: Math.max(1, ymax - ymin),
                normX,
                normY,
                normWidth,
                normHeight,
                leftPercent,
                topPercent,
                widthPercent,
                heightPercent,
                fontSizePt
            };

            if (Array.isArray(line.words) && line.words.length > 0) {
                lineItem.words = line.words;
            }

            return lineItem;
        });

        return {
            pageNumber: pageNum,
            text: pageText || normalizedLines.map(l => l.text).join('\n'),
            lines: normalizedLines
        };
    });

    if (!fullText) {
        fullText = pages.map(p => p.text).join('\n\n');
    }

    // Normalisasi summary
    const summary = data.summary || {};
    const totalChars = fullText.length;
    const totalWords = (fullText.trim().match(/\S+/g) || []).length;

    const normalizedSummary = {
        documentType: summary.documentType || 'Dokumen / Lainnya',
        detectedLanguage: summary.detectedLanguage || 'Indonesia',
        totalWords: Number(summary.totalWords) > 0 ? Number(summary.totalWords) : totalWords,
        totalCharacters: Number(summary.totalCharacters) > 0 ? Number(summary.totalCharacters) : totalChars
    };

    return {
        success: true,
        fileName: fileName || 'document',
        fullText,
        pages,
        summary: normalizedSummary
    };
}

/**
 * Ekstraksi teks digital native dari halaman PDF menggunakan pdfjs-dist.
 * Menghasilkan teks 100% presisi dan koordinat bounding box tanpa AI hallucination.
 */
async function extractDigitalPage(page, pageNum) {
    const vp = page.getViewport({ scale: 1.0 });
    const pageW = vp.width;
    const pageH = vp.height;
    const tc = await page.getTextContent();
    const validItems = tc.items.filter(it => it.str && it.str.trim().length > 0);

    const lineGroups = [];
    validItems.forEach(it => {
        const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
        const fontH = Math.abs(it.height || it.transform[0] || it.transform[3] || 10);
        const fontW = it.width || (it.str.length * 6);
        const top = y - fontH;
        const bottom = y;
        const left = x;
        const right = x + fontW;

        let group = lineGroups.find(g => Math.abs(g.baselineY - y) < 4);
        if (!group) {
            group = { baselineY: y, top, bottom, items: [] };
            lineGroups.push(group);
        } else {
            group.top = Math.min(group.top, top);
            group.bottom = Math.max(group.bottom, bottom);
        }
        group.items.push({ text: it.str, left, right, top, bottom, fontH, fontW });
    });

    lineGroups.sort((a, b) => a.top - b.top);

    const lines = lineGroups.map(g => {
        g.items.sort((a, b) => a.left - b.left);
        const lineText = g.items.map(i => i.text).join(' ');
        const minX = Math.min(...g.items.map(i => i.left));
        const maxX = Math.max(...g.items.map(i => i.right));
        const minY = Math.min(...g.items.map(i => i.top));
        const maxY = Math.max(...g.items.map(i => i.bottom));

        const ymin = Math.max(0, Math.min(1000, Math.round((minY / pageH) * 1000)));
        const xmin = Math.max(0, Math.min(1000, Math.round((minX / pageW) * 1000)));
        const ymax = Math.max(0, Math.min(1000, Math.round((maxY / pageH) * 1000)));
        const xmax = Math.max(0, Math.min(1000, Math.round((maxX / pageW) * 1000)));

        return {
            text: lineText,
            box_2d: [ymin, xmin, ymax, xmax]
        };
    });

    return {
        pageNumber: pageNum,
        text: lines.map(l => l.text).join('\n'),
        lines,
        isDigital: true
    };
}

let tesseractWorkerPromise = null;

async function getLocalTesseractWorker() {
    if (!tesseractWorkerPromise) {
        const { createWorker } = require('tesseract.js');
        tesseractWorkerPromise = createWorker('eng').catch(err => {
            tesseractWorkerPromise = null;
            throw err;
        });
    }
    return tesseractWorkerPromise;
}

function parseTsvToLines(tsvString) {
    const lines = [];
    const tsvLines = (tsvString || '').split('\n');
    let imgW = 1000, imgH = 1000;
    let currentLine = null;

    for (let i = 0; i < tsvLines.length; i++) {
        const row = tsvLines[i].split('\t');
        if (row.length < 12) continue;
        const level = parseInt(row[0], 10);
        const left = parseInt(row[6], 10);
        const top = parseInt(row[7], 10);
        const width = parseInt(row[8], 10);
        const height = parseInt(row[9], 10);
        const text = row[11] ? row[11].trim() : '';

        if (level === 1) {
            imgW = width || 1000;
            imgH = height || 1000;
        } else if (level === 4) {
            if (currentLine && currentLine.words.length > 0) {
                lines.push(currentLine);
            }
            currentLine = { left, top, width, height, words: [] };
        } else if (level === 5 && text && currentLine) {
            currentLine.words.push(text);
        }
    }
    if (currentLine && currentLine.words.length > 0) {
        lines.push(currentLine);
    }

    return lines.map(l => {
        const lineText = l.words.join(' ');
        const ymin = Math.max(0, Math.min(1000, Math.round((l.top / imgH) * 1000)));
        const xmin = Math.max(0, Math.min(1000, Math.round((l.left / imgW) * 1000)));
        const ymax = Math.max(0, Math.min(1000, Math.round(((l.top + l.height) / imgH) * 1000)));
        const xmax = Math.max(0, Math.min(1000, Math.round(((l.left + l.width) / imgW) * 1000)));
        return {
            text: lineText,
            box_2d: [ymin, xmin, ymax, xmax]
        };
    });
}

/**
 * Ekstraksi OCR lokal offline menggunakan Tesseract.js (Zero API Key / Zero Internet)
 */
async function extractImageWithLocalTesseract({
    filePath,
    fileBuffer,
    fileName,
    pageNumber = 1,
    onProgress = () => { }
}) {
    onProgress({ step: 'ocr', message: `Memproses OCR lokal offline (Tesseract hal ${pageNumber})...` });
    const worker = await getLocalTesseractWorker();
    const source = fileBuffer || filePath;
    const ret = await worker.recognize(source, {}, { tsv: true });
    const lines = parseTsvToLines(ret.data.tsv || '');
    const pageText = lines.map(l => l.text).join('\n') || (ret.data.text || '');

    return {
        success: true,
        fileName: fileName || 'document',
        fullText: pageText,
        pages: [{
            pageNumber,
            text: pageText,
            lines,
            isDigital: false,
            engine: 'tesseract-local'
        }],
        summary: {
            documentType: 'Dokumen Pindaian / Gambar (OCR Lokal Offline)',
            detectedLanguage: 'Indonesia / English',
            totalWords: (pageText.trim().match(/\S+/g) || []).length,
            totalCharacters: pageText.length,
            totalPages: 1
        }
    };
}

/**
 * Proses OCR pada single page/image menggunakan Gemini API
 */
async function processSinglePageGemini({
    ai,
    fileBuffer,
    filePath,
    fileName,
    mimeType,
    pageNumber = 1,
    candidateModels,
    onProgress = () => { }
}) {
    let tempCreated = false;
    let targetFile = filePath;

    if (!targetFile && fileBuffer) {
        const ext = mimeType === 'application/pdf' ? '.pdf' : (path.extname(fileName || '') || '.tmp');
        targetFile = path.join(os.tmpdir(), `ocr_pg_${pageNumber}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
        fs.writeFileSync(targetFile, fileBuffer);
        tempCreated = true;
    }

    try {
        const uploadResult = await ai.files.upload({
            file: targetFile,
            mimeType: mimeType || 'application/pdf'
        });

        const singlePagePrompt = `You are an expert OCR, document layout analysis, and text extraction engine.
Analyze the provided document page with high structural precision and exact spatial alignment.
This file represents page ${pageNumber} of the document.

Extract all visible text on this page image and output ONLY a valid JSON object matching this schema:
{
  "pageNumber": ${pageNumber},
  "text": "Clean structured text of this specific page preserving lines, whitespace, and table columns.",
  "lines": [
    {
      "text": "Extracted text line or heading or table cell",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ],
  "summary": {
    "documentType": "Invoice / Packing List / Bill of Lading / Surat Jalan / Kepabeanan / Other",
    "detectedLanguage": "Indonesian / English / etc"
  }
}

CRITICAL INSTRUCTIONS:
1. "lines": Break text down into precise, individual visual lines or table cells. Every distinct visual line must be a separate entry in the "lines" array.
   - NEVER group multiple lines, large paragraphs, or multi-row tables into a single line item.
   - "box_2d": [ymin, xmin, ymax, xmax] MUST tightly wrap the exact visual bounds of that individual line of text.
   - Scale: Normalized 0 to 1000 integer coordinates:
     * ymin = top edge of text line (0 = very top of page, 1000 = bottom of page)
     * xmin = left edge of text line (0 = very left edge, 1000 = right edge)
     * ymax = bottom edge of text line
     * xmax = right edge of text line
2. Extract all visible text on this page image. Output ONLY pure JSON.`;

        let result = null;
        let lastErr = null;

        for (let i = 0; i < candidateModels.length; i++) {
            const currentModel = candidateModels[i];
            try {
                result = await ai.models.generateContent({
                    model: currentModel,
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { fileData: { fileUri: uploadResult.uri, mimeType: uploadResult.mimeType } },
                                { text: singlePagePrompt }
                            ]
                        }
                    ],
                    config: {
                        responseMimeType: 'application/json',
                        maxOutputTokens: 8192
                    }
                });
                break;
            } catch (err) {
                lastErr = err;
                console.warn(`[OCR SERVICE] Percobaan hal ${pageNumber} model ${currentModel} gagal:`, err.message || err);
                if (i < candidateModels.length - 1) await delay(1200);
            }
        }

        if (!result || !result.text) {
            throw new Error(`Gagal memproses OCR hal ${pageNumber}: ${lastErr ? (lastErr.message || lastErr) : 'Respons kosong'}`);
        }

        const data = normalizeOcrData(result.text, fileName);
        if (data.pages && data.pages[0]) {
            data.pages[0].pageNumber = pageNumber;
        }
        return data;
    } finally {
        if (tempCreated && targetFile && fs.existsSync(targetFile)) {
            try { fs.unlinkSync(targetFile); } catch (_) { }
        }
    }
}

/**
 * Mengekstrak teks dan layout dokumen menggunakan Gemini API.
 * Mendukung dokumen multi-halaman dengan ekstraksi per-halaman presisi 1:1.
 * 
 * @param {Object} options
 * @param {string} [options.filePath] Path file di disk (PDF atau Gambar)
 * @param {Buffer} [options.fileBuffer] Buffer file jika tidak disimpan di disk
 * @param {string} [options.fileName] Nama asli file
 * @param {string} [options.mimeType] MIME type file
 * @param {string} [options.customApiKey] Custom Gemini API key jika ada
 * @param {string} [options.modelName] Nama model spesifik (opsional)
 * @param {Function} [options.onProgress] Callback progres (opsional)
 * @returns {Promise<Object>} { success: true, fileName, fullText, pages, summary }
 */
async function extractDocumentText({
    filePath,
    fileBuffer,
    fileName,
    mimeType,
    customApiKey,
    modelName,
    onProgress = () => { }
}) {
    let tempCreated = false;
    let targetPath = filePath;

    // Jika diberikan fileBuffer tanpa filePath, buat file sementara
    if (!targetPath && fileBuffer) {
        const ext = mimeType === 'application/pdf' ? '.pdf' : (path.extname(fileName || '') || '.tmp');
        targetPath = path.join(os.tmpdir(), `ocr_upload_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
        fs.writeFileSync(targetPath, fileBuffer);
        tempCreated = true;
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
        throw new Error("File dokumen tidak ditemukan untuk diproses OCR.");
    }

    const resolvedMime = resolveMimeType(targetPath, mimeType);
    const resolvedName = fileName || path.basename(targetPath);

    try {
        // 1. Prioritaskan Ekstraksi Teks Digital Otomatis (100% Offline Tanpa Kebutuhan API Key Gemini)
        if (resolvedMime === 'application/pdf') {
            let fileBuf = fileBuffer;
            if (!fileBuf && targetPath && fs.existsSync(targetPath)) {
                try { fileBuf = fs.readFileSync(targetPath); } catch (_) { }
            }

            let pdfjsDoc = null;
            if (fileBuf && pdfjs) {
                try {
                    pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(fileBuf) }).promise;
                } catch (pdfErr) {
                    console.warn('[OCR SERVICE] pdfjs-dist load notice:', pdfErr.message);
                }
            }

            let pdfDoc = null;
            if (fileBuf) {
                try {
                    pdfDoc = await PDFDocument.load(fileBuf, { ignoreEncryption: true });
                } catch (pdfErr) {
                    console.warn('[OCR SERVICE] pdf-lib load notice:', pdfErr.message);
                }
            }

            const totalPages = (pdfDoc && pdfDoc.getPageCount()) || (pdfjsDoc && pdfjsDoc.numPages) || 1;

            if (pdfjsDoc) {
                const digitalPagesMap = new Map();
                const pagesNeedingOcr = [];

                for (let p = 1; p <= totalPages; p++) {
                    try {
                        const page = await pdfjsDoc.getPage(p);
                        const tc = await page.getTextContent();
                        const validItems = tc.items.filter(it => it.str && it.str.trim().length > 0);
                        if (validItems.length >= 10) {
                            const digitalPage = await extractDigitalPage(page, p);
                            digitalPagesMap.set(p, digitalPage);
                        } else {
                            pagesNeedingOcr.push(p);
                        }
                    } catch (_) {
                        pagesNeedingOcr.push(p);
                    }
                }

                // Kasus 1: Seluruh halaman memiliki teks digital asli (100% akurat tanpa AI hallucination & tanpa API Key)
                if (pagesNeedingOcr.length === 0) {
                    const allPageObjects = Array.from(digitalPagesMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
                    const fullText = allPageObjects.map(p => (totalPages > 1 ? `--- HALAMAN ${p.pageNumber} ---\n` : '') + (p.text || '')).join('\n\n');
                    return {
                        success: true,
                        fileName: resolvedName,
                        fullText,
                        pages: allPageObjects,
                        summary: {
                            documentType: 'Dokumen Digital (Teks Asli)',
                            detectedLanguage: 'Indonesia / English',
                            totalWords: (fullText.trim().match(/\S+/g) || []).length,
                            totalCharacters: fullText.length,
                            totalPages
                        }
                    };
                }

                // Kasus 2: Dokumen campuran atau pindaian (halaman tanpa teks digital diproses OCR)
                let ai = null;
                try {
                    ai = getAiClient(customApiKey);
                } catch (keyErr) {
                    // Jika tidak ada API Key tapi kita memiliki beberapa halaman digital, kembalikan halaman digital
                    if (digitalPagesMap.size > 0) {
                        const allPageObjects = Array.from(digitalPagesMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
                        const fullText = allPageObjects.map(p => (totalPages > 1 ? `--- HALAMAN ${p.pageNumber} ---\n` : '') + (p.text || '')).join('\n\n');
                        return {
                            success: true,
                            fileName: resolvedName,
                            fullText,
                            pages: allPageObjects,
                            summary: {
                                documentType: `Dokumen Digital Sebagian (${digitalPagesMap.size}/${totalPages} Hal)`,
                                detectedLanguage: 'Indonesia / English',
                                totalWords: (fullText.trim().match(/\S+/g) || []).length,
                                totalCharacters: fullText.length,
                                totalPages
                            },
                            warning: `GEMINI_API_KEY belum diset. Hanya ${digitalPagesMap.size} halaman digital yang diekstrak.`
                        };
                    }
                    throw keyErr;
                }

                const candidateModels = [];
                if (modelName) candidateModels.push(modelName);
                if (process.env.GEMINI_OCR_MODEL) candidateModels.push(process.env.GEMINI_OCR_MODEL);
                candidateModels.push('gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest');
                const modelsToTry = [...new Set(candidateModels)];

                onProgress({ step: 'ocr', message: `Memproses ${pagesNeedingOcr.length} halaman pindaian dari total ${totalPages} halaman...` });

                const allPageObjects = Array.from(digitalPagesMap.values());
                const concurrency = 2;

                for (let i = 0; i < pagesNeedingOcr.length; i += concurrency) {
                    const batchPages = pagesNeedingOcr.slice(i, i + concurrency);
                    const batchPromises = batchPages.map(async (pageNum) => {
                        const pIdx = pageNum - 1;
                        let singleBytes = null;
                        if (pdfDoc && pIdx < pdfDoc.getPageCount()) {
                            const singleDoc = await PDFDocument.create();
                            const [copiedPage] = await singleDoc.copyPages(pdfDoc, [pIdx]);
                            singleDoc.addPage(copiedPage);
                            singleBytes = await singleDoc.save();
                        }

                        let pageObj = null;
                        let lastErr = null;

                        // Percobaan ekstraksi per halaman dengan retry jika model sibuk (503/429)
                        for (let attempt = 1; attempt <= 2; attempt++) {
                            try {
                                const singleData = await processSinglePageGemini({
                                    ai,
                                    fileBuffer: singleBytes ? Buffer.from(singleBytes) : fileBuf,
                                    fileName: `${path.basename(resolvedName, '.pdf')}_hal_${pageNum}.pdf`,
                                    mimeType: 'application/pdf',
                                    pageNumber: pageNum,
                                    candidateModels: modelsToTry,
                                    onProgress
                                });

                                if (singleData.pages && singleData.pages[0]) {
                                    const candidate = singleData.pages[0];
                                    candidate.pageNumber = pageNum;
                                    if ((candidate.lines && candidate.lines.length > 0) || (candidate.text && candidate.text.trim().length > 0)) {
                                        pageObj = candidate;
                                        break;
                                    }
                                }
                            } catch (singleErr) {
                                lastErr = singleErr;
                                console.warn(`[OCR SERVICE] Percobaan ${attempt} hal ${pageNum} gagal: ${singleErr.message}`);
                                if (attempt < 2) await delay(1500);
                            }
                        }

                        if (!pageObj) {
                            console.warn(`[OCR SERVICE] Halaman ${pageNum} tidak menghasilkan baris teks (${lastErr ? lastErr.message : 'kosong'}).`);
                            pageObj = {
                                pageNumber: pageNum,
                                text: `[Halaman ${pageNum}: Pindaian gambar - ${lastErr ? lastErr.message : 'tidak terdeteksi'}]`,
                                lines: [],
                                isDigital: false
                            };
                        }
                        return pageObj;
                    });

                    const batchResults = await Promise.all(batchPromises);
                    allPageObjects.push(...batchResults);
                    onProgress({ step: 'ocr', message: `Selesai ${Math.min(i + concurrency, pagesNeedingOcr.length)} dari ${pagesNeedingOcr.length} halaman pindaian...` });
                    if (i + concurrency < pagesNeedingOcr.length) {
                        await delay(700);
                    }
                }

                allPageObjects.sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));

                const fullText = allPageObjects.map(p => (totalPages > 1 ? `--- HALAMAN ${p.pageNumber} ---\n` : '') + (p.text || '')).join('\n\n');
                return {
                    success: true,
                    fileName: resolvedName,
                    fullText,
                    pages: allPageObjects,
                    summary: {
                        documentType: digitalPagesMap.size > 0 ? 'Dokumen Pabean Campuran (Digital & Pindai)' : 'Dokumen Pabean Pindaian Multi-Halaman',
                        detectedLanguage: 'Indonesia / English',
                        totalWords: (fullText.trim().match(/\S+/g) || []).length,
                        totalCharacters: fullText.length,
                        totalPages
                    }
                };
            }
        }

        // Dokumen Gambar (JPG, PNG, WebP) - Dukungan Hybrid: Coba Gemini AI jika tersedia, otomatis fallback ke OCR Lokal Offline (Tesseract)
        let ai = null;
        try {
            ai = getAiClient(customApiKey);
        } catch (_) {
            ai = null;
        }

        if (ai) {
            try {
                const candidateModels = [];
                if (modelName) candidateModels.push(modelName);
                if (process.env.GEMINI_OCR_MODEL) candidateModels.push(process.env.GEMINI_OCR_MODEL);
                candidateModels.push('gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest');
                const modelsToTry = [...new Set(candidateModels)];

                onProgress({ step: 'ocr', message: `Mengekstrak teks gambar dengan Ray-OCR V.1...` });
                const singleResult = await processSinglePageGemini({
                    ai,
                    fileBuffer,
                    filePath: targetPath,
                    fileName: resolvedName,
                    mimeType: resolvedMime,
                    pageNumber: 1,
                    candidateModels: modelsToTry,
                    onProgress
                });

                return singleResult;
            } catch (geminiErr) {
                console.warn('[OCR SERVICE] Gemini AI OCR gagal/offline, beralih otomatis ke OCR lokal (Tesseract):', geminiErr.message);
            }
        }

        // Jalankan OCR Lokal Offline (Tesseract) jika Gemini tidak tersedia atau gagal
        return await extractImageWithLocalTesseract({
            filePath: targetPath,
            fileBuffer,
            fileName: resolvedName,
            pageNumber: 1,
            onProgress
        });

    } finally {
        // Bersihkan temp file jika dibuat sementara
        if (tempCreated && targetPath && fs.existsSync(targetPath)) {
            try {
                fs.unlinkSync(targetPath);
            } catch (e) { }
        }
    }
}

/**
 * Menghasilkan Searchable PDF dari dokumen dan hasil OCR.
 * Memanggil fungsi `generateSearchablePdf` dari `./searchable_pdf`.
 * 
 * @param {Object} options
 * @param {string} [options.filePath] Path file dokumen
 * @param {Buffer} [options.fileBuffer] Buffer dokumen asli
 * @param {string} [options.fileName] Nama file
 * @param {string} [options.mimeType] MIME type
 * @param {Object} [options.ocrResult] Hasil ekstraksi teks OCR jika sudah ada
 * @param {string} [options.customApiKey] Custom API key jika perlu extract OCR
 * @returns {Promise<Buffer>} Searchable PDF binary buffer
 */
async function generateSearchablePdfBinary({
    filePath,
    fileBuffer,
    fileName,
    mimeType,
    ocrResult,
    customApiKey
}) {
    let resolvedBuffer = fileBuffer;
    if (!resolvedBuffer && filePath && fs.existsSync(filePath)) {
        resolvedBuffer = fs.readFileSync(filePath);
    }
    if (!resolvedBuffer) {
        throw new Error("Berkas dokumen asli tidak ditemukan untuk membuat Searchable PDF.");
    }

    const resolvedMime = resolveMimeType(filePath || fileName, mimeType);
    const isImageOnly = resolvedMime.startsWith('image/');

    // Jika data OCR belum disediakan, jalankan OCR terlebih dahulu
    let ocr = ocrResult;
    if (!ocr || !Array.isArray(ocr.pages)) {
        ocr = await extractDocumentText({
            filePath,
            fileBuffer: resolvedBuffer,
            fileName,
            mimeType: resolvedMime,
            customApiKey
        });
    }

    // Load searchable_pdf engine
    let searchablePdfModule;
    try {
        searchablePdfModule = require('./searchable_pdf');
    } catch (e) {
        throw new Error("Modul './searchable_pdf' belum tersedia atau gagal dimuat: " + e.message);
    }

    const generateSearchablePdf = searchablePdfModule.generateSearchablePdf || searchablePdfModule;
    if (typeof generateSearchablePdf !== 'function') {
        throw new Error("Modul './searchable_pdf' tidak mengekspor fungsi 'generateSearchablePdf'.");
    }

    // Jika input gambar tunggal, pasang imageBuffer pada halaman
    if (isImageOnly && Array.isArray(ocr.pages)) {
        ocr.pages.forEach(p => {
            if (!p.image && !p.imageBuffer && !p.data && !p.buffer) {
                p.imageBuffer = resolvedBuffer;
            }
        });
    }

    // Siapkan parameter untuk generateSearchablePdf
    const pdfResult = await generateSearchablePdf({
        pages: ocr.pages,
        originalPdfBuffer: isImageOnly ? null : resolvedBuffer,
        originalImageBuffer: isImageOnly ? resolvedBuffer : null,
        imageBuffer: isImageOnly ? resolvedBuffer : null,
        isImageOnly,
        mimeType: resolvedMime,
        fileName: fileName || (filePath ? path.basename(filePath) : 'document.pdf')
    });

    // Pastikan hasil adalah Buffer
    if (Buffer.isBuffer(pdfResult)) {
        return pdfResult;
    } else if (pdfResult instanceof Uint8Array) {
        return Buffer.from(pdfResult);
    } else if (pdfResult && pdfResult.buffer) {
        return Buffer.from(pdfResult.buffer);
    }

    throw new Error("Searchable PDF generator tidak mengembalikan buffer yang valid.");
}

module.exports = {
    extractDocumentText,
    generateSearchablePdfBinary,
    normalizeOcrData,
    resolveMimeType
};
