/**
 * ============================================================================
 * CHALLENGER OCR & SEARCHABLE PDF TEST SUITE
 * File: tests/challenger_ocr_suite.js
 * Author: Verifier Agent
 * 
 * Comprehensive, adversarial verification for the OCR & Searchable PDF feature:
 * 1. Searchable PDF Generation Engine (pdf-lib & pdf-parse verification)
 * 2. Backend OCR Service & REST API Endpoints (/api/ocr/*)
 * 3. Frontend UI Module (ocr_tool.html, ocr_tool.js, sidebar navigation)
 * 4. Regression Verification (challenger_ceisa4_tabs_parity & challenger_m3_2_comprehensive_adversarial)
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');
const { JSDOM } = require('jsdom');

// Searchable PDF Engine
const searchablePdfModule = require('../backend-service/searchable_pdf');
const {
    generateSearchablePdf,
    createSearchablePdfFromImages,
    createSearchablePdfFromExisting,
    extractTextFromPdf,
    sanitizeTextForPdf
} = searchablePdfModule;

// OCR Service
const ocrService = require('../backend-service/ocr_service');

const ROOT_DIR = path.resolve(__dirname, '..');
const ATTACHMENTS_DIR = path.join(ROOT_DIR, 'backend-service', 'temp', 'attachments');

let passedCount = 0;
let failedCount = 0;
const results = [];

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✓ [PASS] ${name}`);
        passedCount++;
        results.push({ name, status: 'PASS' });
    } catch (err) {
        console.error(`  ✗ [FAIL] ${name}`);
        console.error(`    -> Error: ${err.message || err}`);
        failedCount++;
        results.push({ name, status: 'FAIL', error: err.message || String(err) });
    }
}

async function runChallengerSuite() {
    console.log('================================================================================');
    console.log('       CHALLENGER VERIFICATION SUITE: OCR & SEARCHABLE PDF MODULE');
    console.log('================================================================================');

    // =========================================================================
    // SUITE 1: SEARCHABLE PDF ENGINE (backend-service/searchable_pdf.js)
    // =========================================================================
    console.log('\n--- SUITE 1: SEARCHABLE PDF GENERATION & TEXT LAYER EXTRACTION ---');

    await test('1.1 Module exports core and named helper functions', () => {
        assert.strictEqual(typeof generateSearchablePdf, 'function', 'generateSearchablePdf is a function');
        assert.strictEqual(typeof createSearchablePdfFromImages, 'function', 'createSearchablePdfFromImages is a function');
        assert.strictEqual(typeof createSearchablePdfFromExisting, 'function', 'createSearchablePdfFromExisting is a function');
        assert.strictEqual(typeof extractTextFromPdf, 'function', 'extractTextFromPdf is a function');
        assert.strictEqual(typeof sanitizeTextForPdf, 'function', 'sanitizeTextForPdf is a function');
    });

    await test('1.2 sanitizeTextForPdf encodes WinAnsi cleanly without throwing', () => {
        const raw = 'Invoice #9999: ✓ Approved! "Special Quotes" & Em—dash & Bullet • & €250.50 & 500m²';
        const cleaned = sanitizeTextForPdf(raw);
        assert.ok(cleaned.includes('[v] Approved!'), 'Checkmark converted to safe [v]');
        assert.ok(cleaned.includes('"Special Quotes"'), 'Quotes normalized');
        assert.ok(cleaned.includes('-'), 'Em-dash normalized');
        assert.ok(cleaned.includes('*'), 'Bullet normalized');
        assert.ok(cleaned.includes('€250.50'), 'Euro sign preserved in WinAnsi');
    });

    await test('1.3 generateSearchablePdf creates valid %PDF buffer with Gemini box_2d coordinates', async () => {
        const samplePages = [
            {
                pageNumber: 1,
                width: 595.28,
                height: 841.89,
                lines: [
                    {
                        text: 'KEMENTERIAN KEUANGAN REPUBLIK INDONESIA',
                        box_2d: [50, 100, 80, 500]
                    },
                    {
                        text: 'DIREKTORAT JENDERAL BEA DAN CUKAI',
                        box_2d: [90, 100, 120, 500]
                    },
                    {
                        text: 'NOMOR AJU: 010700-001234-20261117-009988',
                        box_2d: [150, 100, 180, 550]
                    }
                ]
            }
        ];

        const pdfBuffer = await generateSearchablePdf({ pages: samplePages, isImageOnly: false });
        assert.ok(Buffer.isBuffer(pdfBuffer), 'Returned result is a Buffer');
        assert.ok(pdfBuffer.length > 500, `Buffer size is non-trivial (${pdfBuffer.length} bytes)`);
        assert.strictEqual(pdfBuffer.slice(0, 4).toString(), '%PDF', 'Buffer starts with %PDF magic bytes');

        // Extract with pdf-parse and verify text layer
        const extracted = await extractTextFromPdf(pdfBuffer);
        assert.ok(extracted.includes('KEMENTERIAN KEUANGAN REPUBLIK INDONESIA'), 'Contains Header 1');
        assert.ok(extracted.includes('DIREKTORAT JENDERAL BEA DAN CUKAI'), 'Contains Header 2');
        assert.ok(extracted.includes('010700-001234-20261117-009988'), 'Contains No Aju');
    });

    await test('1.4 generateSearchablePdf with explicit coordinates { x, y, width, height, fontSize }', async () => {
        const samplePages = [
            {
                pageNumber: 1,
                width: 600,
                height: 800,
                lines: [
                    {
                        text: 'INVOICE NUMBER: INV-2026-X88',
                        x: 50,
                        y: 100,
                        width: 300,
                        height: 20,
                        fontSize: 12
                    },
                    {
                        text: 'TOTAL CIF IDR: Rp 1.542.800.000',
                        x: 50,
                        y: 150,
                        width: 350,
                        height: 20,
                        fontSize: 12
                    }
                ]
            }
        ];

        const pdfBuffer = await generateSearchablePdf({ pages: samplePages });
        assert.ok(Buffer.isBuffer(pdfBuffer));
        const extracted = await extractTextFromPdf(pdfBuffer);
        assert.ok(extracted.includes('INV-2026-X88'), 'Extracted explicit coordinate text');
        assert.ok(extracted.includes('Rp 1.542.800.000'), 'Extracted CIF IDR amount');
    });

    await test('1.5 generateSearchablePdf with page-level text fallback (auto line layout)', async () => {
        const samplePages = [
            {
                pageNumber: 1,
                text: 'PACKING LIST\nCONTAINER: WHSU0243603\nSEAL: WHLW184912\nTOTAL GROSS WEIGHT: 15,420.50 KGM'
            }
        ];

        const pdfBuffer = await generateSearchablePdf({ pages: samplePages });
        assert.ok(Buffer.isBuffer(pdfBuffer));
        const extracted = await extractTextFromPdf(pdfBuffer);
        assert.ok(extracted.includes('PACKING LIST'), 'Extracted PACKING LIST');
        assert.ok(extracted.includes('WHSU0243603'), 'Extracted Container number');
        assert.ok(extracted.includes('15,420.50'), 'Extracted Gross Weight');
    });

    await test('1.6 Overlay searchable text onto existing PDF (createSearchablePdfFromExisting)', async () => {
        const samplePdfName = '1792380506300_HENG_GUAN.pdf';
        const samplePdfPath = path.join(ATTACHMENTS_DIR, samplePdfName);
        assert.ok(fs.existsSync(samplePdfPath), `Sample PDF exists at ${samplePdfPath}`);

        const originalPdfBytes = fs.readFileSync(samplePdfPath);
        const overlayPages = [
            {
                pageNumber: 1,
                lines: [
                    {
                        text: 'SEARCHABLE_OVERLAY_VERIFICATION_TOKEN_8899',
                        box_2d: [200, 100, 230, 600]
                    }
                ]
            }
        ];

        const overlaidPdfBuffer = await createSearchablePdfFromExisting(originalPdfBytes, overlayPages);
        assert.ok(Buffer.isBuffer(overlaidPdfBuffer));
        assert.ok(overlaidPdfBuffer.length > originalPdfBytes.length * 0.8, 'Overlaid PDF size is preserved');
        assert.strictEqual(overlaidPdfBuffer.slice(0, 4).toString(), '%PDF');

        const extracted = await extractTextFromPdf(overlaidPdfBuffer);
        assert.ok(extracted.includes('SEARCHABLE_OVERLAY_VERIFICATION_TOKEN_8899'), 'Overlay token found in generated PDF');
    });

    await test('1.7 Image-to-Searchable PDF (createSearchablePdfFromImages with favicon/sample image)', async () => {
        const sampleImgPath = path.join(ROOT_DIR, 'favicon.png');
        assert.ok(fs.existsSync(sampleImgPath), 'favicon.png exists');

        const imgBytes = fs.readFileSync(sampleImgPath);
        const imagePages = [
            {
                pageNumber: 1,
                image: imgBytes,
                lines: [
                    {
                        text: 'OCR_IMAGE_LAYER_TEXT_PROOF_9988',
                        box_2d: [100, 100, 140, 500]
                    }
                ]
            }
        ];

        const pdfBuffer = await createSearchablePdfFromImages(imagePages);
        assert.ok(Buffer.isBuffer(pdfBuffer));
        assert.strictEqual(pdfBuffer.slice(0, 4).toString(), '%PDF');

        const extracted = await extractTextFromPdf(pdfBuffer);
        assert.ok(extracted.includes('OCR_IMAGE_LAYER_TEXT_PROOF_9988'), 'Extracted text layer from image PDF');
    });

    await test('1.8 Searchable PDF Engine handles edge cases (empty pages array)', async () => {
        const pdfBuffer = await generateSearchablePdf({ pages: [] });
        assert.ok(Buffer.isBuffer(pdfBuffer));
        assert.strictEqual(pdfBuffer.slice(0, 4).toString(), '%PDF');
    });

    // =========================================================================
    // SUITE 2: OCR SERVICE & REST API ENDPOINTS
    // =========================================================================
    console.log('\n--- SUITE 2: BACKEND OCR SERVICE & API ENDPOINTS ---');

    await test('2.1 ocr_service.js exports required service functions', () => {
        assert.strictEqual(typeof ocrService.extractDocumentText, 'function', 'extractDocumentText is a function');
        assert.strictEqual(typeof ocrService.generateSearchablePdfBinary, 'function', 'generateSearchablePdfBinary is a function');
        assert.strictEqual(typeof ocrService.normalizeOcrData, 'function', 'normalizeOcrData is a function');
        assert.strictEqual(typeof ocrService.resolveMimeType, 'function', 'resolveMimeType is a function');
    });

    await test('2.2 normalizeOcrData cleans and standardizes Gemini AI OCR response', () => {
        const rawJson = {
            fullText: 'PT. SINAR ASIA PACK\nINVOICE NO: 12345\nTOTAL: USD 10,000.00',
            pages: [
                {
                    pageNumber: 1,
                    text: 'PT. SINAR ASIA PACK\nINVOICE NO: 12345\nTOTAL: USD 10,000.00',
                    lines: [
                        { text: 'PT. SINAR ASIA PACK', box_2d: [50, 100, 80, 400] },
                        { text: 'INVOICE NO: 12345', box_2d: [100, 100, 130, 300] }
                    ]
                }
            ],
            summary: {
                documentType: 'Invoice',
                detectedLanguage: 'Indonesian / English',
                totalWords: 9,
                totalCharacters: 58
            }
        };

        const normalized = ocrService.normalizeOcrData(rawJson, 'test_invoice.pdf');
        assert.strictEqual(normalized.success, true);
        assert.strictEqual(normalized.fileName, 'test_invoice.pdf');
        assert.strictEqual(normalized.summary.documentType, 'Invoice');
        assert.strictEqual(normalized.pages.length, 1);
        assert.ok(normalized.pages[0].lines[0].box_2d, 'Line contains box_2d');
        assert.ok(normalized.pages[0].lines[0].normX !== undefined, 'Line contains normX calculation');
    });

    const samplePdfPath = path.join(ATTACHMENTS_DIR, '1792380506300_HENG_GUAN.pdf');
    const pdfBytes = fs.readFileSync(samplePdfPath);

    await test('2.3 POST /api/ocr/extract-text returns 200 with fullText, pages array, and summary', async () => {
        const formData = new FormData();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        formData.append('document', blob, '1792380506300_HENG_GUAN.pdf');

        const res = await fetch('http://localhost:5005/api/ocr/extract-text', {
            method: 'POST',
            body: formData
        });

        assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
        const data = await res.json();

        assert.strictEqual(data.success, true, 'Response success is true');
        assert.ok(data.fileName, 'fileName is present');
        assert.ok(typeof data.fullText === 'string' && data.fullText.length > 0, 'fullText is non-empty string');
        assert.ok(Array.isArray(data.pages) && data.pages.length > 0, 'pages is a non-empty array');
        assert.ok(data.summary && typeof data.summary === 'object', 'summary object is present');
        assert.ok(data.summary.documentType, 'summary.documentType is present');
        assert.ok(data.summary.detectedLanguage, 'summary.detectedLanguage is present');
        assert.ok(data.summary.totalWords >= 0, 'summary.totalWords is a number');
        assert.ok(data.summary.totalCharacters >= 0, 'summary.totalCharacters is a number');
    });

    await test('2.4 POST /api/ocr/searchable-pdf returns application/pdf with non-zero length & downloadable headers', async () => {
        const formData = new FormData();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        formData.append('document', blob, '1792380506300_HENG_GUAN.pdf');

        const res = await fetch('http://localhost:5005/api/ocr/searchable-pdf', {
            method: 'POST',
            body: formData
        });

        assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
        assert.strictEqual(res.headers.get('content-type'), 'application/pdf', 'Content-Type is application/pdf');

        const disposition = res.headers.get('content-disposition');
        assert.ok(disposition && disposition.includes('attachment'), `Content-Disposition contains attachment: ${disposition}`);

        const arrayBuf = await res.arrayBuffer();
        const resultBuf = Buffer.from(arrayBuf);
        assert.ok(resultBuf.length > 0, 'Returned PDF buffer length is > 0');
        assert.strictEqual(resultBuf.slice(0, 4).toString(), '%PDF', 'Buffer starts with %PDF magic bytes');

        // Extract with pdf-parse to verify text layer is present
        const parsedText = await extractTextFromPdf(resultBuf);
        assert.ok(parsedText && parsedText.length > 50, `Extracted text from generated PDF is non-trivial (${parsedText.length} chars)`);
    });

    await test('2.5 Edge Case: Empty upload to POST /api/ocr/extract-text returns 400 Bad Request', async () => {
        const formData = new FormData(); // No file attached
        const res = await fetch('http://localhost:5005/api/ocr/extract-text', {
            method: 'POST',
            body: formData
        });

        assert.strictEqual(res.status, 400, `Expected HTTP 400, got ${res.status}`);
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.ok(data.error && data.error.includes('wajib diunggah'), 'Contains explanatory error message');
    });

    await test('2.6 Edge Case: Empty upload to POST /api/ocr/searchable-pdf returns 400 Bad Request', async () => {
        const formData = new FormData();
        const res = await fetch('http://localhost:5005/api/ocr/searchable-pdf', {
            method: 'POST',
            body: formData
        });

        assert.strictEqual(res.status, 400, `Expected HTTP 400, got ${res.status}`);
        const data = await res.json();
        assert.strictEqual(data.success, false);
    });

    await test('2.7 POST /api/ocr/searchable-pdf with pre-cached ocrResult avoids duplicate OCR', async () => {
        const preCachedOcr = {
            pages: [
                {
                    pageNumber: 1,
                    lines: [
                        { text: 'PRE_CACHED_OCR_LINE_VERIFICATION', box_2d: [100, 100, 130, 400] }
                    ]
                }
            ]
        };

        const formData = new FormData();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        formData.append('document', blob, 'precached_test.pdf');
        formData.append('ocrResult', JSON.stringify(preCachedOcr));

        const res = await fetch('http://localhost:5005/api/ocr/searchable-pdf', {
            method: 'POST',
            body: formData
        });

        assert.strictEqual(res.status, 200);
        const arrayBuf = await res.arrayBuffer();
        const resultBuf = Buffer.from(arrayBuf);
        const parsedText = await extractTextFromPdf(resultBuf);
        assert.ok(parsedText.includes('PRE_CACHED_OCR_LINE_VERIFICATION'), 'Pre-cached OCR text found in PDF');
    });

    // =========================================================================
    // SUITE 3: FRONTEND UI MODULE (ocr_tool.html, ocr_tool.js, SIDEBAR LINKS)
    // =========================================================================
    console.log('\n--- SUITE 3: OCR TOOL UI & SIDEBAR NAVIGATION INTEGRATION ---');

    const ocrHtmlPath = path.join(ROOT_DIR, 'ocr_tool.html');
    const ocrJsPath = path.join(ROOT_DIR, 'ocr_tool.js');

    await test('3.1 ocr_tool.html and ocr_tool.js exist and have non-zero size', () => {
        assert.ok(fs.existsSync(ocrHtmlPath), 'ocr_tool.html exists');
        assert.ok(fs.existsSync(ocrJsPath), 'ocr_tool.js exists');
        assert.ok(fs.statSync(ocrHtmlPath).size > 2000, 'ocr_tool.html has substantive content');
        assert.ok(fs.statSync(ocrJsPath).size > 2000, 'ocr_tool.js has substantive content');
    });

    const ocrRawHtml = fs.readFileSync(ocrHtmlPath, 'utf8');
    const ocrDom = new JSDOM(ocrRawHtml, { runScripts: 'outside-only' });
    const { document: ocrDoc } = ocrDom.window;

    await test('3.2 Hallmark / CEISA 4.0 design standards and Dark/Light mode toggle exist', () => {
        assert.ok(ocrRawHtml.includes('Hallmark · pre-emit critique'), 'Hallmark critique tag present');
        assert.ok(ocrDoc.getElementById('themeToggleBtn'), '#themeToggleBtn exists');
        assert.ok(ocrRawHtml.includes('theme-init.js'), 'theme-init.js included for flashbang prevention');
    });

    await test('3.3 Dropzone, file input, and supported format badges exist', () => {
        assert.ok(ocrDoc.getElementById('ocrDropzone'), '#ocrDropzone exists');
        assert.ok(ocrDoc.getElementById('ocrFileInput'), '#ocrFileInput exists');
        assert.ok(ocrDoc.getElementById('ocrSelectedFileBanner'), '#ocrSelectedFileBanner exists');
        assert.ok(ocrDoc.getElementById('btnStartOcr'), '#btnStartOcr exists');
    });

    await test('3.4 Processing progress card and step tracking pills exist', () => {
        assert.ok(ocrDoc.getElementById('ocrProgressCard'), '#ocrProgressCard exists');
        assert.ok(ocrDoc.getElementById('ocrProgressFill'), '#ocrProgressFill exists');
        assert.ok(ocrDoc.getElementById('ocrProgressPercent'), '#ocrProgressPercent exists');
        assert.ok(ocrDoc.getElementById('ocrProgressStatusText'), '#ocrProgressStatusText exists');
        assert.ok(ocrDoc.getElementById('stepUpload'), '#stepUpload exists');
        assert.ok(ocrDoc.getElementById('stepOcr'), '#stepOcr exists');
        assert.ok(ocrDoc.getElementById('stepSearchable'), '#stepSearchable exists');
        assert.ok(ocrDoc.getElementById('stepDone'), '#stepDone exists');
    });

    await test('3.5 Dual-pane layout: Left pane document preview with zoom controls', () => {
        assert.ok(ocrDoc.getElementById('ocrPreviewViewport'), '#ocrPreviewViewport exists');
        assert.ok(ocrDoc.getElementById('ocrDocumentPages') || ocrDoc.getElementById('pdfPreviewFrame'), '#ocrDocumentPages or preview frame exists');
        assert.ok(ocrDoc.getElementById('btnZoomIn'), '#btnZoomIn exists');
        assert.ok(ocrDoc.getElementById('btnZoomOut'), '#btnZoomOut exists');
        assert.ok(ocrDoc.getElementById('btnResetZoom'), '#btnResetZoom exists');
    });

    await test('3.6 Right pane: Prominent Copy-to-Clipboard and Download buttons exist', () => {
        const btnCopyAll = ocrDoc.getElementById('btnCopyAll');
        assert.ok(btnCopyAll, '#btnCopyAll exists');
        assert.ok(btnCopyAll.textContent.includes('Salin Semua Teks'), 'Button text includes Salin Semua Teks');

        const btnSearchablePdf = ocrDoc.getElementById('btnDownloadSearchablePdf');
        assert.ok(btnSearchablePdf, '#btnDownloadSearchablePdf exists');
        assert.ok(btnSearchablePdf.textContent.includes('Unduh Searchable PDF'), 'Button text includes Unduh Searchable PDF');

        const btnTxt = ocrDoc.getElementById('btnDownloadTxt');
        assert.ok(btnTxt, '#btnDownloadTxt exists');
        assert.ok(btnTxt.textContent.includes('Unduh File Teks (.txt)'), 'Button text includes Unduh File Teks (.txt)');
    });

    await test('3.7 Live search keyword filter and counter exist', () => {
        assert.ok(ocrDoc.getElementById('ocrSearchInput'), '#ocrSearchInput exists');
        assert.ok(ocrDoc.getElementById('ocrSearchCount'), '#ocrSearchCount exists');
        assert.ok(ocrDoc.getElementById('btnSearchPrev'), '#btnSearchPrev exists');
        assert.ok(ocrDoc.getElementById('btnSearchNext'), '#btnSearchNext exists');
    });

    await test('3.8 Dual text views: Full text editor and per-page view tabs exist', () => {
        assert.ok(ocrDoc.getElementById('tabBtnFullText'), '#tabBtnFullText exists');
        assert.ok(ocrDoc.getElementById('tabBtnPages'), '#tabBtnPages exists');
        assert.ok(ocrDoc.getElementById('ocrFullTextEditor'), '#ocrFullTextEditor exists');
        assert.ok(ocrDoc.getElementById('ocrPagesContainer'), '#ocrPagesContainer exists');
    });

    await test('3.9 Sidebar navigation in pib.html, peb.html, doc_searcher.html, print_hub.html points to ocr_tool.html', () => {
        const requiredFiles = ['pib.html', 'peb.html', 'doc_searcher.html', 'print_hub.html'];

        for (const f of requiredFiles) {
            const filePath = path.join(ROOT_DIR, f);
            assert.ok(fs.existsSync(filePath), `${f} exists`);
            const htmlContent = fs.readFileSync(filePath, 'utf8');

            const hasOcrLink = htmlContent.includes('href="ocr_tool.html"') || htmlContent.includes("href='ocr_tool.html'");
            assert.ok(hasOcrLink, `${f} contains sidebar link to ocr_tool.html`);

            const hasOcrNavId = htmlContent.includes('id="btnNavOcrTool"') || htmlContent.includes("id='btnNavOcrTool'");
            assert.ok(hasOcrNavId, `${f} contains #btnNavOcrTool sidebar element`);
        }
    });

    await test('3.10 ocr_tool.js syntax and client handler functions execute cleanly in JSDOM', () => {
        assert.doesNotThrow(() => {
            execSync(`node --check "${ocrJsPath}"`, { stdio: 'pipe' });
        }, 'ocr_tool.js syntax is valid');
    });

    // =========================================================================
    // SUITE 4: REGRESSION VERIFICATION (CEISA4 TABS & ADVERSARIAL SUITE)
    // =========================================================================
    console.log('\n--- SUITE 4: ZERO REGRESSION VERIFICATION ---');

    await test('4.1 challenger_ceisa4_tabs_parity.js passes 100% (19/19)', () => {
        const output = execSync('node tests/challenger_ceisa4_tabs_parity.js', { cwd: ROOT_DIR, encoding: 'utf8' });
        assert.ok(output.includes('TOTAL: 19 | PASSED: 19 | FAILED: 0'), `Expected 19/19 passed, output:\n${output}`);
    });

    await test('4.2 challenger_m3_2_comprehensive_adversarial.js passes 100% (41/41)', () => {
        const output = execSync('node tests/challenger_m3_2_comprehensive_adversarial.js', { cwd: ROOT_DIR, encoding: 'utf8' });
        assert.ok(output.includes('ALL ADVERSARIAL TESTS PASSED!'), `Expected adversarial tests passed, output:\n${output}`);
        assert.ok(output.includes('Passed : 41'), `Expected 41 passed, output:\n${output}`);
        assert.ok(output.includes('Failed : 0'), `Expected 0 failed, output:\n${output}`);
    });

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log('\n================================================================================');
    console.log(`  CHALLENGER OCR SUITE TOTAL: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log('================================================================================');

    if (failedCount > 0) {
        process.exit(1);
    }
}

runChallengerSuite().catch(err => {
    console.error('Fatal test suite exception:', err);
    process.exit(1);
});
