/**
 * ============================================================================
 * CEISA 4.0 - IN-HOUSE OCR & SEARCHABLE PDF CLIENT ENGINE (ocr_tool.js)
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * High-Contrast, Tactile Anti-AI-Slop Executive Interaction
 * Strict Zero-Emoji Professional Vector UI
 * ============================================================================
 */

// Dynamic or ES Module import of pdf.mjs
let pdfjsLib = null;

async function initPdfJs() {
    if (pdfjsLib) return pdfjsLib;
    try {
        pdfjsLib = await import('./pdf.mjs');
        if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';
        }
    } catch (err) {
        console.warn('In-house PDF engine import notice:', err.message);
        if (typeof window !== 'undefined' && window.pdfjsLib) {
            pdfjsLib = window.pdfjsLib;
        }
    }
    return pdfjsLib;
}

let activeBackendBase = null;

// Backend URL resolution supporting direct or proxied host with automatic IP/localhost fallback
function getBackendUrl(path = '') {
    if (activeBackendBase) {
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        return `${activeBackendBase}${cleanPath}`;
    }
    if (typeof window !== 'undefined' && typeof window.getCeisaBackendUrl === 'function') {
        return window.getCeisaBackendUrl(path);
    }
    let base = 'http://127.0.0.1:5005';
    try {
        if (typeof window !== 'undefined' && window.location) {
            if (window.location.protocol.startsWith('http')) {
                const host = window.location.hostname;
                const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
                base = `${window.location.protocol}//${host}:${port}`;
            }
        }
    } catch (_) {}
    return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

async function fetchBackendWithFallback(path, options = {}) {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const candidates = [];
    if (activeBackendBase) candidates.push(`${activeBackendBase}${cleanPath}`);
    candidates.push(getBackendUrl(cleanPath));
    candidates.push(`http://127.0.0.1:5005${cleanPath}`);
    candidates.push(`http://localhost:5005${cleanPath}`);
    const uniqueCandidates = [...new Set(candidates)];

    let lastError = null;
    for (const url of uniqueCandidates) {
        try {
            const res = await fetch(url, options);
            const parsedUrl = new URL(url);
            activeBackendBase = `${parsedUrl.protocol}//${parsedUrl.host}`;
            return res;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error('Gagal terhubung ke server backend di port 5005.');
}

// Reactive State
const state = {
    file: null,
    fileUrl: null,
    pdfDoc: null,
    totalPages: 1,
    currentPage: 1,
    isProcessing: false,
    zoom: 100,
    showBoxes: false,
    displayMode: 'transparent',
    activeTab: 'fullText',
    result: {
        fullText: '',
        pages: [],
        summary: {
            docType: '—',
            detectedLanguage: '—',
            totalWords: 0,
            totalCharacters: 0,
            totalPages: 0
        }
    },
    searchQuery: '',
    searchMatches: [],
    currentMatchIdx: -1
};

// DOM Elements Cache
let el = {};

function cacheElements() {
    el = {
        // Dropzone & File
        fileInput: document.getElementById('ocrFileInput'),
        dropzone: document.getElementById('ocrDropzone'),
        selectedBanner: document.getElementById('ocrSelectedFileBanner'),
        fileName: document.getElementById('ocrFileName'),
        fileMeta: document.getElementById('ocrFileMeta'),
        btnChangeFile: document.getElementById('btnChangeFile'),
        btnStartOcr: document.getElementById('btnStartOcr'),

        // Progress & Status
        progressCard: document.getElementById('ocrProgressCard'),
        progressFill: document.getElementById('ocrProgressFill'),
        progressPercent: document.getElementById('ocrProgressPercent'),
        progressStatusText: document.getElementById('ocrProgressStatusText'),
        spinner: document.getElementById('ocrSpinner'),
        stepUpload: document.getElementById('stepUpload'),
        stepOcr: document.getElementById('stepOcr'),
        stepSearchable: document.getElementById('stepSearchable'),
        stepDone: document.getElementById('stepDone'),

        // In-House Viewer & Document Canvas
        previewViewport: document.getElementById('ocrPreviewViewport'),
        previewEmpty: document.getElementById('ocrPreviewEmpty'),
        documentPages: document.getElementById('ocrDocumentPages'),
        viewerHint: document.getElementById('ocrViewerHint'),
        btnPrevPage: document.getElementById('btnPrevPage'),
        btnNextPage: document.getElementById('btnNextPage'),
        pageIndicator: document.getElementById('pageIndicator'),
        btnZoomIn: document.getElementById('btnZoomIn'),
        btnZoomOut: document.getElementById('btnZoomOut'),
        btnResetZoom: document.getElementById('btnResetZoom'),
        btnToggleTextLayer: document.getElementById('btnToggleTextLayer'),
        zoomLevelDisplay: document.getElementById('zoomLevelDisplay'),

        // Layer Display Mode Switchers
        btnModeTransparent: document.getElementById('btnModeTransparent'),
        btnModeBoxes: document.getElementById('btnModeBoxes'),
        btnModeReadable: document.getElementById('btnModeReadable'),

        // Master Toolbar OCR Actions
        btnCopyAll: document.getElementById('btnCopyAll'),
        btnDownloadSearchablePdf: document.getElementById('btnDownloadSearchablePdf'),
        btnDownloadTxt: document.getElementById('btnDownloadTxt'),

        // Summary Chips
        summaryDocType: document.getElementById('summaryDocType'),
        summaryLanguage: document.getElementById('summaryLanguage'),
        summaryWords: document.getElementById('summaryWords'),
        summaryChars: document.getElementById('summaryChars'),
        summaryPages: document.getElementById('summaryPages'),

        // Search
        searchInput: document.getElementById('ocrSearchInput'),
        searchClear: document.getElementById('ocrSearchClear'),
        searchCount: document.getElementById('ocrSearchCount'),
        btnSearchPrev: document.getElementById('btnSearchPrev'),
        btnSearchNext: document.getElementById('btnSearchNext'),

        // Tabs & Viewports
        tabBtnFullText: document.getElementById('tabBtnFullText'),
        tabBtnPages: document.getElementById('tabBtnPages'),
        viewFullText: document.getElementById('viewFullText'),
        viewPages: document.getElementById('viewPages'),
        tabPagesCount: document.getElementById('tabPagesCount'),
        fullTextEditor: document.getElementById('ocrFullTextEditor'),
        pagesContainer: document.getElementById('ocrPagesContainer'),

        // Header & Sidebar
        serverStatusChip: document.getElementById('serverStatusChip'),
        serverStatusText: document.getElementById('serverStatusText'),
        sidebar: document.getElementById('ceisaSidebar'),
        sidebarToggle: document.getElementById('ceisaSidebarToggle'),
        toastContainer: document.getElementById('ocrToastContainer')
    };
}

// Zero-Emoji Professional Vector Toast Notifications
function showToast(message, type = 'info') {
    const container = el.toastContainer || document.getElementById('ocrToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'ocr-toast';

    let iconSvg = '';
    let borderColor = 'var(--border-color, #cbd5e1)';

    if (type === 'success') {
        borderColor = '#10b981';
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
        borderColor = '#ef4444';
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
        borderColor = '#0284c7';
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.style.borderLeft = `4px solid ${borderColor}`;
    toast.innerHTML = `
        <span style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${iconSvg}</span>
        <div style="flex: 1; font-weight: 500; color: var(--text-primary); line-height: 1.4;">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.25s, transform 0.25s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 250);
    }, 4000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// File Selection Handler
async function handleSelectedFile(file) {
    if (!file) return;

    const validExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const fileNameLower = file.name.toLowerCase();
    const isValid = validExts.some(ext => fileNameLower.endsWith(ext));

    if (!isValid) {
        showToast('Format berkas tidak didukung. Harap pilih berkas PDF, JPG, PNG, atau WEBP.', 'error');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        showToast('Ukuran berkas melebihi batas 50 MB.', 'error');
        return;
    }

    // Clean up previous blob
    if (state.fileUrl) {
        try { URL.revokeObjectURL(state.fileUrl); } catch (_) {}
    }

    state.file = file;
    state.fileUrl = URL.createObjectURL(file);

    // Update selected file banner
    if (el.fileName) el.fileName.textContent = file.name;
    if (el.fileMeta) {
        const ext = file.name.split('.').pop().toUpperCase();
        el.fileMeta.textContent = `${ext} • ${formatBytes(file.size)}`;
    }
    if (el.selectedBanner) el.selectedBanner.style.display = 'flex';
    if (el.dropzone) el.dropzone.style.display = 'none';

    // Reset previous OCR outputs if new file chosen
    resetOcrResults();

    // Render In-House Custom Document Pages (Canvas based)
    await renderDocumentInHouse(file);

    showToast(`Berkas "${file.name}" siap diekstrak.`, 'info');
}

// Custom In-House Canvas Document Rendering (PDF & Image)
async function renderDocumentInHouse(file) {
    if (!el.documentPages) return;

    if (el.previewEmpty) el.previewEmpty.style.display = 'none';
    if (el.viewerHint) el.viewerHint.style.display = 'flex';
    el.documentPages.style.display = 'flex';
    el.documentPages.innerHTML = '';

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
        await renderPdfPages(file);
    } else {
        await renderImagePage(file);
    }

    updatePageIndicator();
}

/**
 * Ekstraksi teks digital native dari satu halaman PDF menggunakan PDF.js
 */
async function extractNativePageContent(page, viewport, pageNum) {
    try {
        const textContent = await page.getTextContent();
        if (!textContent || !textContent.items) return null;

        const validItems = textContent.items.filter(it => it.str && it.str.trim().length > 0);
        if (validItems.length === 0) return null;

        const pageW = viewport.width;
        const pageH = viewport.height;
        const lineGroups = [];

        validItems.forEach(it => {
            const [x, y] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
            const fontH = Math.abs(it.height || it.transform[0] || it.transform[3] || 10) * (viewport.scale / (viewport.rawDims?.scale || 1.5));
            const fontW = (it.width || (it.str.length * 6)) * (viewport.scale / (viewport.rawDims?.scale || 1.5));
            const top = y - fontH;
            const bottom = y;
            const left = x;
            const right = x + fontW;

            let group = lineGroups.find(g => Math.abs(g.baselineY - y) < 6);
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

        const lines = lineGroups.map((g, lIdx) => {
            g.items.sort((a, b) => a.left - b.left);
            const lineText = g.items.map(i => i.text).join(' ');
            const minX = Math.min(...g.items.map(i => i.left));
            const maxX = Math.max(...g.items.map(i => i.right));
            const minY = Math.min(...g.items.map(i => i.top));
            const maxY = Math.max(...g.items.map(i => i.bottom));

            const yminNorm = Math.max(0, Math.min(1000, Math.round((minY / pageH) * 1000)));
            const xminNorm = Math.max(0, Math.min(1000, Math.round((minX / pageW) * 1000)));
            const ymaxNorm = Math.max(0, Math.min(1000, Math.round((maxY / pageH) * 1000)));
            const xmaxNorm = Math.max(0, Math.min(1000, Math.round((maxX / pageW) * 1000)));

            const topPercent = (minY / pageH) * 100;
            const leftPercent = (minX / pageW) * 100;
            const widthPercent = ((maxX - minX) / pageW) * 100;
            const heightPercent = ((maxY - minY) / pageH) * 100;

            return {
                text: lineText,
                box_2d: [yminNorm, xminNorm, ymaxNorm, xmaxNorm],
                topPercent,
                leftPercent,
                widthPercent,
                heightPercent,
                fontSizePt: Math.max(9, Math.round(maxY - minY)),
                isNative: true
            };
        });

        const fullPageText = lines.map(l => l.text).join('\n');

        return {
            pageNumber: pageNum,
            text: fullPageText,
            lines,
            itemsCount: validItems.length,
            isDigital: true
        };
    } catch (err) {
        console.warn(`[OCR TOOL] Ekstraksi native hal ${pageNum} gagal:`, err);
        return null;
    }
}

async function renderPdfPages(file) {
    const pdfLib = await initPdfJs();
    if (!pdfLib) {
        // Fallback display if pdf.mjs unavailable
        el.documentPages.innerHTML = `
            <div style="padding: 40px; color: #cbd5e1; text-align: center;">
                Memuat pratinjau dokumen...
            </div>
        `;
        return;
    }

    try {
        const arrayBuf = await file.arrayBuffer();
        const loadingTask = pdfLib.getDocument({ data: arrayBuf });
        const pdfDoc = await loadingTask.promise;

        state.pdfDoc = pdfDoc;
        state.totalPages = pdfDoc.numPages;
        state.currentPage = 1;

        const nativeExtractedPages = [];

        for (let p = 1; p <= pdfDoc.numPages; p++) {
            const page = await pdfDoc.getPage(p);
            const scale = (state.zoom / 100) * 1.5; // High resolution crisp canvas
            const viewport = page.getViewport({ scale });

            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'ocr-page-wrapper';
            pageWrapper.id = `ocrPageWrapper-${p}`;
            pageWrapper.setAttribute('data-page', String(p));
            pageWrapper.style.width = `${viewport.width}px`;
            pageWrapper.style.height = `${viewport.height}px`;

            // Set CSS custom properties for Mozilla TextLayer sub-pixel font scaling
            pageWrapper.style.setProperty('--total-scale-factor', String(viewport.scale));
            pageWrapper.style.setProperty('--scale-factor', String(viewport.scale));
            pageWrapper.style.setProperty('--scale-round-x', '1px');
            pageWrapper.style.setProperty('--scale-round-y', '1px');

            const canvas = document.createElement('canvas');
            canvas.className = 'ocr-page-canvas';
            canvas.id = `ocrCanvasPage-${p}`;
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            pageWrapper.appendChild(canvas);

            // Native Mozilla text layer for sub-pixel digital text selection (Always 100% transparent)
            const nativeTextLayer = document.createElement('div');
            nativeTextLayer.className = 'textLayer';
            nativeTextLayer.id = `pdfNativeTextLayer-${p}`;
            pageWrapper.appendChild(nativeTextLayer);

            // Active in-place text layer overlay (for Bounding Boxes, Readable Text, & OCR lines)
            const textLayer = document.createElement('div');
            textLayer.className = `ocr-text-layer mode-${state.displayMode}` + (state.showBoxes ? ' show-boxes' : '');
            textLayer.id = `ocrTextLayer-${p}`;
            pageWrapper.appendChild(textLayer);

            el.documentPages.appendChild(pageWrapper);

            // Instant native text extraction
            const nativePage = await extractNativePageContent(page, viewport, p);
            if (nativePage && nativePage.lines && nativePage.lines.length > 0) {
                nativeExtractedPages.push(nativePage);

                // Render Mozilla official TextLayer for digital text fidelity
                if (pdfLib && typeof pdfLib.TextLayer === 'function') {
                    try {
                        const textContentSource = await page.getTextContent();
                        if (textContentSource && textContentSource.items && textContentSource.items.length > 0) {
                            const tl = new pdfLib.TextLayer({
                                textContentSource,
                                container: nativeTextLayer,
                                viewport
                            });
                            await tl.render();
                        }
                    } catch (tlErr) {
                        console.warn(`[OCR TOOL] Mozilla TextLayer native render notice (hal ${p}):`, tlErr.message);
                    }
                }
            }
        }

        // Jika dokumen memiliki teks digital asli
        if (nativeExtractedPages.length > 0) {
            state.hasNativeText = true;
            state.result.pages = nativeExtractedPages;
            state.result.fullText = nativeExtractedPages
                .map(pg => (pdfDoc.numPages > 1 ? `--- HALAMAN ${pg.pageNumber} ---\n` : '') + (pg.text || ''))
                .join('\n\n')
                .trim();

            state.result.summary = {
                docType: 'Dokumen Digital (Teks Asli)',
                detectedLanguage: 'Indonesia / English',
                totalWords: (state.result.fullText.trim().match(/\S+/g) || []).length,
                totalCharacters: state.result.fullText.length,
                totalPages: pdfDoc.numPages
            };

            // Render Output into Document Viewer & Right Editor immediately!
            renderOcrResults(state.result);
            populateTextOverlay();

            const isAllDigital = nativeExtractedPages.length === pdfDoc.numPages;
            if (isAllDigital) {
                showToast(`Teks digital asli (${pdfDoc.numPages} halaman) langsung aktif. Dokumen siap disalin atau diunduh tanpa perlu OCR.`, 'success');
            } else {
                showToast(`Teks digital asli aktif pada ${nativeExtractedPages.length} dari ${pdfDoc.numPages} halaman. Anda dapat langsung menyalin teks, atau klik 'Mulai Ekstraksi OCR' untuk memindai halaman gambar.`, 'info');
            }
        } else {
            state.hasNativeText = false;
            // Mount any existing OCR text onto the text layer
            if (state.result.pages && state.result.pages.length > 0) {
                populateTextOverlay();
            }
            showToast('Dokumen hasil scan terdeteksi. Klik "Mulai Ekstraksi OCR" untuk mengekstrak teks dengan AI.', 'info');
        }
    } catch (err) {
        console.error('In-house PDF render error:', err);
        showToast('Gagal merender halaman PDF secara internal: ' + err.message, 'error');
    }
}

async function renderImagePage(file) {
    state.totalPages = 1;
    state.currentPage = 1;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'ocr-page-wrapper';
            pageWrapper.id = 'ocrPageWrapper-1';
            pageWrapper.setAttribute('data-page', '1');

            // Responsive scale
            const maxW = 760;
            const scaleFactor = img.naturalWidth > maxW ? (maxW / img.naturalWidth) : 1;
            const targetW = img.naturalWidth * scaleFactor * (state.zoom / 100);
            const targetH = img.naturalHeight * scaleFactor * (state.zoom / 100);

            pageWrapper.style.width = `${targetW}px`;
            pageWrapper.style.height = `${targetH}px`;

            const canvas = document.createElement('canvas');
            canvas.className = 'ocr-page-canvas';
            canvas.id = 'ocrCanvasPage-1';
            canvas.width = targetW;
            canvas.height = targetH;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, targetW, targetH);
            pageWrapper.appendChild(canvas);

            // Active in-place text layer overlay
            const textLayer = document.createElement('div');
            textLayer.className = `ocr-text-layer mode-${state.displayMode}` + (state.showBoxes ? ' show-boxes' : '');
            textLayer.id = 'ocrTextLayer-1';
            pageWrapper.appendChild(textLayer);

            el.documentPages.appendChild(pageWrapper);

            // Mount any existing OCR text onto the text layer
            if (state.result.pages && state.result.pages.length > 0) {
                populateTextOverlay();
            }

            resolve();
        };
        img.src = state.fileUrl;
    });
}

// In-Place Text Layer Overlay Populator (Accurate Coordinate Mapping)
function populateTextOverlay() {
    const pages = state.result.pages || [];
    if (pages.length === 0 && state.result.fullText) {
        pages.push({
            pageNumber: 1,
            text: state.result.fullText,
            lines: state.result.fullText.split('\n').filter(Boolean).map(line => ({ text: line }))
        });
    }

    pages.forEach((pg, pIdx) => {
        const pageNum = pg.pageNumber || (pIdx + 1);
        const textLayer = document.getElementById(`ocrTextLayer-${pageNum}`);
        if (!textLayer) return;

        textLayer.innerHTML = '';
        textLayer.className = `ocr-text-layer mode-${state.displayMode}` + 
            (state.showBoxes ? ' show-boxes' : '') + 
            (pg.isDigital ? ' is-digital' : '');
        const lines = pg.lines || [];

        if (lines.length === 0 && pg.text) {
            // Generate lines from text paragraphs
            const rawLines = pg.text.split('\n');
            const stepY = 100 / Math.max(1, rawLines.length);
            rawLines.forEach((t, lIdx) => {
                if (!t.trim()) return;
                const span = document.createElement('span');
                span.className = 'ocr-text-line';
                span.setAttribute('data-line', String(lIdx));
                span.setAttribute('data-text', t);
                span.style.top = `${lIdx * stepY}%`;
                span.style.left = '5%';
                span.style.width = '90%';
                span.style.fontSize = '13px';
                span.textContent = t;
                attachLineCopyHandler(span);
                textLayer.appendChild(span);
            });
            return;
        }

        lines.forEach((line, lIdx) => {
            const lineText = line.text || '';
            if (!lineText.trim()) return;

            const box = Array.isArray(line.box_2d) ? line.box_2d :
                        (Array.isArray(line.bbox) ? line.bbox :
                        (Array.isArray(line.box) ? line.box : null));

            const span = document.createElement('span');
            span.className = 'ocr-text-line';
            span.setAttribute('data-line', String(lIdx));
            span.setAttribute('data-text', lineText);

            let topPct, leftPct, widthPct, heightPct;

            if (line.topPercent !== undefined && line.leftPercent !== undefined) {
                topPct = Number(line.topPercent);
                leftPct = Number(line.leftPercent);
                widthPct = Number(line.widthPercent || 10);
                heightPct = Number(line.heightPercent || 2);
            } else if (box && box.length === 4) {
                const [ymin, xmin, ymax, xmax] = box.map(Number);
                const maxVal = Math.max(ymin, xmin, ymax, xmax);

                if (maxVal <= 1.01) {
                    topPct = ymin * 100;
                    leftPct = xmin * 100;
                    widthPct = (xmax - xmin) * 100;
                    heightPct = (ymax - ymin) * 100;
                } else {
                    topPct = (ymin / 1000) * 100;
                    leftPct = (xmin / 1000) * 100;
                    widthPct = ((xmax - xmin) / 1000) * 100;
                    heightPct = ((ymax - ymin) / 1000) * 100;
                }
            } else {
                // Fallback sequential distribution
                const stepY = 100 / Math.max(1, lines.length);
                topPct = lIdx * stepY;
                leftPct = 5;
                widthPct = 90;
                heightPct = 2.5;
            }

            span.style.top = `${topPct}%`;
            span.style.left = `${leftPct}%`;
            span.style.width = `${Math.max(1, widthPct)}%`;
            span.style.height = `${Math.max(1.2, heightPct)}%`;

            // Calculate font size relative to rendered page height
            const parentH = textLayer.clientHeight || 800;
            const calcFont = line.fontSizePt || Math.max(9, Math.round((heightPct / 100) * parentH * 0.8));
            span.style.fontSize = `${calcFont}px`;
            span.style.lineHeight = `${Math.max(10, Math.round((heightPct / 100) * parentH))}px`;

            span.textContent = lineText;
            attachLineCopyHandler(span);
            textLayer.appendChild(span);
        });
    });
}

// Quick click-to-copy handler on individual lines
function attachLineCopyHandler(span) {
    span.title = 'Klik untuk salin baris ini, atau blok dengan kursor mouse untuk seleksi';
    span.addEventListener('click', () => {
        const sel = window.getSelection ? window.getSelection().toString() : '';
        if (sel && sel.trim().length > 0) return; // User is performing drag text selection
        const text = span.textContent || '';
        if (!text.trim()) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                span.classList.add('copied-pulse');
                setTimeout(() => span.classList.remove('copied-pulse'), 600);
                const preview = text.length > 40 ? text.slice(0, 37) + '...' : text;
                showToast(`Tersalin: "${preview}"`, 'success');
            }).catch(() => {});
        }
    });
}

// Layer display mode switcher
function setLayerMode(mode) {
    if (!['transparent', 'boxes', 'readable'].includes(mode)) return;
    state.displayMode = mode;
    state.showBoxes = (mode === 'boxes');

    const layers = document.querySelectorAll('.ocr-text-layer');
    layers.forEach(ly => {
        ly.classList.remove('mode-transparent', 'mode-boxes', 'mode-readable', 'show-boxes');
        ly.classList.add(`mode-${mode}`);
        if (mode === 'boxes') ly.classList.add('show-boxes');
    });

    if (el.btnModeTransparent) el.btnModeTransparent.classList.toggle('active', mode === 'transparent');
    if (el.btnModeBoxes) el.btnModeBoxes.classList.toggle('active', mode === 'boxes');
    if (el.btnModeReadable) el.btnModeReadable.classList.toggle('active', mode === 'readable');

    if (el.btnToggleTextLayer) {
        el.btnToggleTextLayer.style.borderColor = (mode === 'boxes') ? 'var(--ceisa-blue, #2563eb)' : '';
        el.btnToggleTextLayer.style.color = (mode === 'boxes') ? 'var(--ceisa-blue, #2563eb)' : '';
    }

    if (mode === 'transparent') {
        showToast('Mode Lapisan: Transparan (Default) - seleksi dan salin teks langsung aktif.', 'info');
    } else if (mode === 'boxes') {
        showToast('Mode Lapisan: Kotak Penanda - batas kotak teks ditampilkan.', 'info');
    } else if (mode === 'readable') {
        showToast('Mode Lapisan: Teks Terbaca - teks kontras tinggi ditampilkan di atas dokumen.', 'info');
    }
}

function updatePageIndicator() {
    if (el.pageIndicator) {
        el.pageIndicator.textContent = `Hal ${state.currentPage} / ${state.totalPages}`;
    }
    if (el.btnPrevPage) el.btnPrevPage.disabled = state.currentPage <= 1;
    if (el.btnNextPage) el.btnNextPage.disabled = state.currentPage >= state.totalPages;
}

function setZoom(val) {
    state.zoom = Math.max(50, Math.min(250, val));
    if (el.zoomLevelDisplay) el.zoomLevelDisplay.textContent = `${state.zoom}%`;
    if (state.file) {
        renderDocumentInHouse(state.file);
    }
}

// Reset results state
function resetOcrResults() {
    state.result = {
        fullText: '',
        pages: [],
        summary: { docType: '—', detectedLanguage: '—', totalWords: 0, totalCharacters: 0, totalPages: 0 }
    };

    if (el.fullTextEditor) el.fullTextEditor.value = '';
    if (el.pagesContainer) {
        el.pagesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px;">
                Klik tombol "Mulai Ekstraksi OCR" untuk memproses teks.
            </div>
        `;
    }

    updateSummaryChips(state.result.summary);

    if (el.btnCopyAll) el.btnCopyAll.disabled = true;
    if (el.btnDownloadSearchablePdf) el.btnDownloadSearchablePdf.disabled = true;
    if (el.btnDownloadTxt) el.btnDownloadTxt.disabled = true;
    if (el.searchInput) {
        el.searchInput.disabled = true;
        el.searchInput.value = '';
    }
    if (el.searchCount) el.searchCount.textContent = '0 ditemukan';
    if (el.tabPagesCount) el.tabPagesCount.textContent = '0';
}

// Progress animation helper
function setProgress(percent, statusText, activeStepId) {
    if (el.progressCard) el.progressCard.style.display = 'block';
    if (el.progressFill) el.progressFill.style.width = `${percent}%`;
    if (el.progressPercent) el.progressPercent.textContent = `${percent}%`;
    if (el.progressStatusText && statusText) el.progressStatusText.textContent = statusText;

    const steps = [el.stepUpload, el.stepOcr, el.stepSearchable, el.stepDone];
    steps.forEach(step => {
        if (!step) return;
        step.classList.remove('active', 'done');
    });

    if (activeStepId === 'stepUpload') {
        if (el.stepUpload) el.stepUpload.classList.add('active');
    } else if (activeStepId === 'stepOcr') {
        if (el.stepUpload) el.stepUpload.classList.add('done');
        if (el.stepOcr) el.stepOcr.classList.add('active');
    } else if (activeStepId === 'stepSearchable') {
        if (el.stepUpload) el.stepUpload.classList.add('done');
        if (el.stepOcr) el.stepOcr.classList.add('done');
        if (el.stepSearchable) el.stepSearchable.classList.add('active');
    } else if (activeStepId === 'stepDone') {
        steps.forEach(step => { if (step) step.classList.add('done'); });
    }
}

// OCR Execution
async function startOcrProcess() {
    if (!state.file || state.isProcessing) return;

    state.isProcessing = true;
    if (el.btnStartOcr) el.btnStartOcr.disabled = true;
    if (el.spinner) el.spinner.style.display = 'inline-block';

    setProgress(15, 'Mengunggah dokumen ke server...', 'stepUpload');

    const formData = new FormData();
    formData.append('document', state.file);

    // Progress timeline simulation while waiting for Gemini AI
    let progressVal = 20;
    const progressTimer = setInterval(() => {
        if (progressVal < 45) {
            progressVal += 5;
            setProgress(progressVal, 'Mengirim berkas pabean ke engine AI...', 'stepUpload');
        } else if (progressVal < 78) {
            progressVal += 3;
            setProgress(progressVal, 'Google Gemini OCR membaca tata letak & teks...', 'stepOcr');
        } else if (progressVal < 92) {
            progressVal += 1;
            setProgress(progressVal, 'Menghitung koordinat lapisan teks & PDF Searchable...', 'stepSearchable');
        }
    }, 600);

    try {
        const res = await fetchBackendWithFallback('/api/ocr/extract-text', {
            method: 'POST',
            body: formData
        });

        clearInterval(progressTimer);

        if (!res.ok) {
            let errText = `HTTP Error ${res.status}`;
            try {
                const errJson = await res.json();
                if (errJson && errJson.error) errText = errJson.error;
            } catch (_) {}
            throw new Error(errText);
        }

        const data = await res.json();
        if (!data.success && !data.fullText) {
            throw new Error(data.error || 'Ekstraksi OCR tidak mengembalikan teks');
        }

        setProgress(100, 'Ekstraksi OCR selesai dengan sukses!', 'stepDone');

        // Set state
        state.result.fullText = data.fullText || '';
        state.result.pages = data.pages || [];
        state.result.summary = data.summary || {
            docType: data.docType || 'Dokumen Pabean',
            detectedLanguage: data.detectedLanguage || 'Indonesia / English',
            totalWords: (data.fullText || '').split(/\s+/).filter(Boolean).length,
            totalCharacters: (data.fullText || '').length,
            totalPages: (data.pages && data.pages.length) ? data.pages.length : 1
        };

        // Render Output into Document Viewer
        renderOcrResults(state.result);

        // Mount the extracted text onto the In-House Document Text Layer
        populateTextOverlay();

        showToast('Ekstraksi teks OCR berhasil diselesaikan. Teks pada dokumen kini dapat diseleksi langsung!', 'success');
    } catch (err) {
        clearInterval(progressTimer);
        console.error('OCR Extraction Error:', err);

        const isNetworkErr = err.message && (err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError'));
        const friendlyMsg = isNetworkErr ?
            'Gagal menghubungi server backend (port 5005). Pastikan server aktif (START_SERVER.bat atau node backend-service/server.js).' :
            `Gagal mengekstrak teks OCR: ${err.message}`;

        setProgress(100, isNetworkErr ? 'Server backend port 5005 offline' : `Gagal: ${err.message}`, 'stepUpload');
        showToast(friendlyMsg, 'error');
    } finally {
        state.isProcessing = false;
        if (el.btnStartOcr) el.btnStartOcr.disabled = false;
        if (el.spinner) el.spinner.style.display = 'none';

        setTimeout(() => {
            if (!state.isProcessing && el.progressCard) {
                el.progressCard.style.display = 'none';
            }
        }, 5000);
    }
}

// Graceful fallback for offline or error recovery
function handleOcrFallback(errorMsg) {
    if (state.result.pages && state.result.pages.length > 0) {
        // Teks digital asli dokumen tetap dipertahankan dengan aman
        renderOcrResults(state.result);
        populateTextOverlay();
        showToast('Server OCR tidak dapat dihubungi. Teks digital asli dokumen tetap dipertahankan.', 'info');
        return;
    }

    showToast('Gagal memproses dokumen dan tidak ditemukan teks digital: ' + (errorMsg || 'Server offline'), 'error');
}

// Render OCR Results into UI
function renderOcrResults(result) {
    if (el.fullTextEditor) {
        el.fullTextEditor.value = result.fullText || '';
    }

    updateSummaryChips(result.summary);
    renderPagesView(result.pages, result.fullText);

    if (el.btnCopyAll) el.btnCopyAll.disabled = false;
    if (el.btnDownloadSearchablePdf) el.btnDownloadSearchablePdf.disabled = false;
    if (el.btnDownloadTxt) el.btnDownloadTxt.disabled = false;
    if (el.searchInput) el.searchInput.disabled = false;
}

function updateSummaryChips(summary) {
    if (!summary) return;
    if (el.summaryDocType) el.summaryDocType.textContent = `Dokumen: ${summary.docType || 'Umum'}`;
    if (el.summaryLanguage) el.summaryLanguage.textContent = `Bahasa: ${summary.detectedLanguage || 'ID/EN'}`;
    if (el.summaryWords) el.summaryWords.textContent = `${(summary.totalWords || 0).toLocaleString()} Kata`;
    if (el.summaryChars) el.summaryChars.textContent = `${(summary.totalCharacters || 0).toLocaleString()} Karakter`;
    if (el.summaryPages) el.summaryPages.textContent = `${summary.totalPages || 1} Halaman`;
    if (el.tabPagesCount) el.tabPagesCount.textContent = String(summary.totalPages || (state.result.pages ? state.result.pages.length : 1));
}

function renderPagesView(pages, fullText) {
    if (!el.pagesContainer) return;

    let items = pages;
    if (!items || items.length === 0) {
        items = [{
            pageNumber: 1,
            text: fullText || '',
            wordCount: (fullText || '').split(/\s+/).filter(Boolean).length
        }];
    }

    el.pagesContainer.innerHTML = '';

    items.forEach((pg, idx) => {
        const pageNum = pg.pageNumber || (idx + 1);
        const pageText = pg.text || '';
        const words = pg.wordCount || pageText.split(/\s+/).filter(Boolean).length;

        const card = document.createElement('div');
        card.className = 'ocr-page-card';
        card.id = `ocrPageCard-${pageNum}`;

        card.innerHTML = `
            <div class="ocr-page-header">
                <div class="ocr-page-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="6" y="2" width="12" height="20" rx="2"></rect>
                    </svg>
                    <span>Halaman ${pageNum}</span>
                    <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">(${words} kata)</span>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn-page-copy" data-page-index="${idx}" title="Salin teks halaman ${pageNum}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Salin Halaman</span>
                    </button>
                </div>
            </div>
            <div class="ocr-page-body" id="ocrPageBody-${pageNum}">${escapeHtml(pageText)}</div>
        `;

        el.pagesContainer.appendChild(card);
    });

    const copyBtns = el.pagesContainer.querySelectorAll('.btn-page-copy');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const pageIdx = parseInt(btn.getAttribute('data-page-index'), 10);
            copyPageText(pageIdx, btn);
        });
    });
}

// Action: Copy All Text (Zero Emoji Clean Feedback)
async function copyAllText() {
    const textToCopy = el.fullTextEditor ? el.fullTextEditor.value : state.result.fullText;
    if (!textToCopy) {
        showToast('Tidak ada teks untuk disalin.', 'error');
        return;
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToCopy);
        } else if (el.fullTextEditor) {
            el.fullTextEditor.select();
            document.execCommand('copy');
        }

        if (el.btnCopyAll) {
            const originalHtml = el.btnCopyAll.innerHTML;
            el.btnCopyAll.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Tersalin ke Clipboard!</span>
            `;
            el.btnCopyAll.style.background = '#059669';
            el.btnCopyAll.style.borderColor = '#047857';

            setTimeout(() => {
                el.btnCopyAll.innerHTML = originalHtml;
                el.btnCopyAll.style.background = '';
                el.btnCopyAll.style.borderColor = '';
            }, 2200);
        }

        showToast('Semua teks hasil OCR berhasil disalin ke clipboard!', 'success');
    } catch (err) {
        showToast('Gagal menyalin ke clipboard: ' + err.message, 'error');
    }
}

// Action: Copy Specific Page
async function copyPageText(pageIndex, btnElement) {
    let text = '';
    if (state.result.pages && state.result.pages[pageIndex]) {
        text = state.result.pages[pageIndex].text || '';
    } else {
        text = state.result.fullText || '';
    }

    if (!text) return;

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        }

        if (btnElement) {
            const orig = btnElement.innerHTML;
            btnElement.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Tersalin</span>
            `;
            btnElement.style.borderColor = '#10b981';
            btnElement.style.color = '#10b981';
            setTimeout(() => {
                btnElement.innerHTML = orig;
                btnElement.style.borderColor = '';
                btnElement.style.color = '';
            }, 2000);
        }

        showToast(`Teks Halaman ${pageIndex + 1} berhasil disalin!`, 'success');
    } catch (err) {
        showToast('Gagal menyalin teks halaman: ' + err.message, 'error');
    }
}

// Action: Download Raw Text (.txt)
function downloadTxtFile() {
    const text = el.fullTextEditor ? el.fullTextEditor.value : state.result.fullText;
    if (!text) {
        showToast('Tidak ada teks untuk diunduh.', 'error');
        return;
    }

    const baseName = state.file ? state.file.name.replace(/\.[^/.]+$/, '') : 'dokumen_ocr';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `[OCR]_${baseName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Berkas "[OCR]_${baseName}.txt" berhasil diunduh!`, 'success');
}

// Action: Download Searchable PDF from Backend Engine
async function downloadSearchablePdf() {
    if (!state.file) {
        showToast('Harap pilih berkas terlebih dahulu.', 'error');
        return;
    }

    if (el.btnDownloadSearchablePdf) {
        el.btnDownloadSearchablePdf.disabled = true;
        el.btnDownloadSearchablePdf.innerHTML = `
            <span class="spinner-inline"></span>
            <span>Membuat PDF...</span>
        `;
    }

    showToast('Sedang memproses Searchable PDF (melapiskan OCR text layer)...', 'info');

    const formData = new FormData();
    formData.append('document', state.file);
    if (state.result && state.result.pages && state.result.pages.length > 0) {
        formData.append('ocrResult', JSON.stringify(state.result));
    }

    try {
        const res = await fetchBackendWithFallback('/api/ocr/searchable-pdf', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            let errText = `HTTP Error ${res.status}`;
            try {
                const errJson = await res.json();
                if (errJson && errJson.error) errText = errJson.error;
            } catch (_) {}
            throw new Error(errText);
        }

        const blob = await res.blob();
        const baseName = state.file.name.replace(/\.[^/.]+$/, '');
        const downloadUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `[Searchable]_${baseName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

        showToast(`Searchable PDF "[Searchable]_${baseName}.pdf" berhasil diunduh! Teks kini dapat dicari & disalin di Adobe Reader/Chrome.`, 'success');
    } catch (err) {
        console.error('Searchable PDF error:', err);
        showToast(`Gagal mengunduh Searchable PDF: ${err.message}`, 'error');
    } finally {
        if (el.btnDownloadSearchablePdf) {
            el.btnDownloadSearchablePdf.disabled = false;
            el.btnDownloadSearchablePdf.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Unduh Searchable PDF</span>
            `;
        }
    }
}

// Live In-Document Search & Text Layer Highlighting
function handleLiveSearch() {
    const rawQuery = (el.searchInput ? el.searchInput.value : '').trim();
    state.searchQuery = rawQuery;

    if (el.searchClear) {
        el.searchClear.style.display = rawQuery ? 'block' : 'none';
    }

    // Reset all on-canvas search highlights
    const allLines = document.querySelectorAll('.ocr-text-line');
    allLines.forEach(ln => {
        ln.classList.remove('search-match', 'search-match-active');
    });

    state.searchMatches = [];
    state.currentMatchIdx = -1;

    if (!rawQuery) {
        if (el.searchCount) el.searchCount.textContent = '0 ditemukan';
        if (el.btnSearchPrev) el.btnSearchPrev.disabled = true;
        if (el.btnSearchNext) el.btnSearchNext.disabled = true;
        resetSearchHighlights();
        return;
    }

    const queryLower = rawQuery.toLowerCase();
    allLines.forEach(ln => {
        const text = (ln.textContent || '').toLowerCase();
        if (text.includes(queryLower)) {
            ln.classList.add('search-match');
            state.searchMatches.push(ln);
        }
    });

    const matchCount = state.searchMatches.length;

    if (matchCount > 0) {
        state.currentMatchIdx = 0;
        state.searchMatches[0].classList.add('search-match-active');
        state.searchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el.searchCount) el.searchCount.textContent = `1 / ${matchCount}`;
        if (el.btnSearchPrev) el.btnSearchPrev.disabled = false;
        if (el.btnSearchNext) el.btnSearchNext.disabled = false;
    } else {
        // Fallback check full text if canvas lines aren't yet populated
        const fullText = el.fullTextEditor ? el.fullTextEditor.value : state.result.fullText;
        const regex = new RegExp(`(${rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const fallbackMatches = (fullText.match(regex) || []).length;
        if (el.searchCount) el.searchCount.textContent = `${fallbackMatches} ditemukan`;
        if (el.btnSearchPrev) el.btnSearchPrev.disabled = fallbackMatches === 0;
        if (el.btnSearchNext) el.btnSearchNext.disabled = fallbackMatches === 0;
    }

    const regex = new RegExp(`(${rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    highlightPagesSearch(regex);
}

function navigateSearchMatch(direction) {
    if (!state.searchMatches || state.searchMatches.length === 0) return;

    state.searchMatches[state.currentMatchIdx].classList.remove('search-match-active');

    if (direction === 'next') {
        state.currentMatchIdx = (state.currentMatchIdx + 1) % state.searchMatches.length;
    } else {
        state.currentMatchIdx = (state.currentMatchIdx - 1 + state.searchMatches.length) % state.searchMatches.length;
    }

    const target = state.searchMatches[state.currentMatchIdx];
    target.classList.add('search-match-active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (el.searchCount) {
        el.searchCount.textContent = `${state.currentMatchIdx + 1} / ${state.searchMatches.length}`;
    }
}

function resetSearchHighlights() {
    if (!state.result.pages) return;
    state.result.pages.forEach((pg, idx) => {
        const pageNum = pg.pageNumber || (idx + 1);
        const pageBody = document.getElementById(`ocrPageBody-${pageNum}`);
        if (pageBody) {
            pageBody.textContent = pg.text || '';
        }
    });
}

function highlightPagesSearch(regex) {
    if (!state.result.pages) return;
    state.result.pages.forEach((pg, idx) => {
        const pageNum = pg.pageNumber || (idx + 1);
        const pageBody = document.getElementById(`ocrPageBody-${pageNum}`);
        if (!pageBody) return;

        const originalText = pg.text || '';
        if (regex.test(originalText)) {
            pageBody.innerHTML = originalText.replace(regex, '<mark class="ocr-highlight">$1</mark>');
        } else {
            pageBody.textContent = originalText;
        }
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Drag and Drop
    if (el.dropzone) {
        el.dropzone.addEventListener('click', () => {
            if (el.fileInput) el.fileInput.click();
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            el.dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'dragend', 'drop'].forEach(eventName => {
            el.dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.dropzone.classList.remove('dragover');
            });
        });

        el.dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleSelectedFile(dt.files[0]);
            }
        });
    }

    // File input change
    if (el.fileInput) {
        el.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleSelectedFile(e.target.files[0]);
            }
        });
    }

    // Change file button
    if (el.btnChangeFile) {
        el.btnChangeFile.addEventListener('click', () => {
            if (el.fileInput) {
                el.fileInput.value = '';
                el.fileInput.click();
            }
        });
    }

    // Start OCR button
    if (el.btnStartOcr) {
        el.btnStartOcr.addEventListener('click', startOcrProcess);
    }

    // Layer Display Mode Buttons
    if (el.btnModeTransparent) {
        el.btnModeTransparent.addEventListener('click', () => setLayerMode('transparent'));
    }
    if (el.btnModeBoxes) {
        el.btnModeBoxes.addEventListener('click', () => setLayerMode('boxes'));
    }
    if (el.btnModeReadable) {
        el.btnModeReadable.addEventListener('click', () => setLayerMode('readable'));
    }

    // Copy All button
    if (el.btnCopyAll) {
        el.btnCopyAll.addEventListener('click', copyAllText);
    }

    // Download Searchable PDF button
    if (el.btnDownloadSearchablePdf) {
        el.btnDownloadSearchablePdf.addEventListener('click', downloadSearchablePdf);
    }

    // Download TXT button
    if (el.btnDownloadTxt) {
        el.btnDownloadTxt.addEventListener('click', downloadTxtFile);
    }

    // Search events
    if (el.searchInput) {
        el.searchInput.addEventListener('input', handleLiveSearch);
    }

    if (el.searchClear) {
        el.searchClear.addEventListener('click', () => {
            if (el.searchInput) {
                el.searchInput.value = '';
                handleLiveSearch();
                el.searchInput.focus();
            }
        });
    }

    if (el.btnSearchNext) {
        el.btnSearchNext.addEventListener('click', () => navigateSearchMatch('next'));
    }
    if (el.btnSearchPrev) {
        el.btnSearchPrev.addEventListener('click', () => navigateSearchMatch('prev'));
    }

    // Multi-page navigation
    if (el.btnPrevPage) {
        el.btnPrevPage.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                updatePageIndicator();
                const target = document.getElementById(`ocrPageWrapper-${state.currentPage}`);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    if (el.btnNextPage) {
        el.btnNextPage.addEventListener('click', () => {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                updatePageIndicator();
                const target = document.getElementById(`ocrPageWrapper-${state.currentPage}`);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // Zoom Controls
    if (el.btnZoomIn) {
        el.btnZoomIn.addEventListener('click', () => setZoom(state.zoom + 15));
    }
    if (el.btnZoomOut) {
        el.btnZoomOut.addEventListener('click', () => setZoom(state.zoom - 15));
    }
    if (el.btnResetZoom) {
        el.btnResetZoom.addEventListener('click', () => setZoom(100));
    }

    // Toggle Inspector Mode (Bounding Boxes Outline)
    if (el.btnToggleTextLayer) {
        el.btnToggleTextLayer.addEventListener('click', () => {
            setLayerMode(state.displayMode === 'boxes' ? 'transparent' : 'boxes');
        });
    }

    // View Mode Tabs (Compatibility)
    if (el.tabBtnFullText && el.tabBtnPages) {
        el.tabBtnFullText.addEventListener('click', () => {
            state.activeTab = 'fullText';
            el.tabBtnFullText.classList.add('active');
            el.tabBtnPages.classList.remove('active');
            if (el.viewFullText) el.viewFullText.style.display = 'block';
            if (el.viewPages) el.viewPages.style.display = 'none';
        });

        el.tabBtnPages.addEventListener('click', () => {
            state.activeTab = 'pages';
            el.tabBtnPages.classList.add('active');
            el.tabBtnFullText.classList.remove('active');
            if (el.viewFullText) el.viewFullText.style.display = 'none';
            if (el.viewPages) el.viewPages.style.display = 'block';
        });
    }

    // Sidebar expand / collapse
    if (el.sidebar) {
        el.sidebar.addEventListener('mouseenter', () => {
            el.sidebar.classList.add('expanded');
            if (el.sidebarToggle) el.sidebarToggle.setAttribute('aria-expanded', 'true');
        });
        el.sidebar.addEventListener('mouseleave', () => {
            el.sidebar.classList.remove('expanded');
            if (el.sidebarToggle) el.sidebarToggle.setAttribute('aria-expanded', 'false');
        });
    }
    if (el.sidebarToggle) {
        el.sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (el.sidebar) el.sidebar.classList.toggle('expanded');
        });
    }

    // Health check for backend server status
    checkBackendHealth();
    setInterval(checkBackendHealth, 5000);
}

async function checkBackendHealth() {
    try {
        const res = await fetchBackendWithFallback('/api/print/status');
        const data = await res.json();
        if (data && data.success) {
            if (el.serverStatusChip) el.serverStatusChip.className = 'ph-chip ph-chip-green';
            if (el.serverStatusText) el.serverStatusText.textContent = 'Layanan OCR Siap';
            return true;
        }
    } catch (_) {
        if (el.serverStatusChip) el.serverStatusChip.className = 'ph-chip ph-chip-red';
        if (el.serverStatusText) el.serverStatusText.textContent = 'Server Offline (Port 5005)';
        return false;
    }
}

// Init on DOMContentLoaded
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            cacheElements();
            setupEventListeners();
        });
    } else {
        cacheElements();
        setupEventListeners();
    }
}

// Expose ceisaOcr globally for tests & programmatic interaction
if (typeof window !== 'undefined') {
    window.ceisaOcr = {
        state,
        handleSelectedFile,
        renderDocumentInHouse,
        populateTextOverlay,
        setLayerMode,
        startOcrProcess,
        copyAllText,
        copyPageText,
        downloadTxtFile,
        downloadSearchablePdf
    };
}

export {
    state,
    handleSelectedFile,
    renderDocumentInHouse,
    populateTextOverlay,
    setLayerMode,
    startOcrProcess,
    copyAllText,
    copyPageText,
    downloadTxtFile,
    downloadSearchablePdf
};
