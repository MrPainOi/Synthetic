/**
 * Adversarial Challenger 2 Test Suite for Milestone 1 (Print Hub QR & UI Cleanup)
 * Author: Empirical Challenger (critic & specialist)
 */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const HTML_PATH = path.resolve('c:/Synthetic/print_hub.html');
const JS_PATH = path.resolve('c:/Synthetic/print_hub.js');

const rawHtml = fs.readFileSync(HTML_PATH, 'utf8');
const rawJs = fs.readFileSync(JS_PATH, 'utf8');

const testResults = [];
function record(name, pass, details = '') {
    testResults.push({ name, pass, details });
    const symbol = pass ? ' PASS ' : ' FAIL ';
    console.log(`[${symbol}] ${name}${details ? ' - ' + details : ''}`);
}

async function runAdversarialSuite() {
    console.log('======================================================================');
    console.log('CHALLENGER 2 ADVERSARIAL TEST HARNESS: MILESTONE 1 PRINT HUB CLEANUP');
    console.log('======================================================================\n');

    // -------------------------------------------------------------
    // SECTION 1: QR Remnants, Commented-out Code, and Orphaned Selectors
    // -------------------------------------------------------------
    console.log('--- SECTION 1: Remnant & Masking Audit ---');

    const qrForbiddenTokens = [
        'ph-qr-card', 'ph-qr-thumb', 'ph-qr-info', 'ph-qr-title', 'ph-qr-sub',
        'ph-qr-link-box', 'ph-modal-overlay', 'ph-modal-card', 'ph-qr-large',
        'qrThumbBox', 'qrThumbImage', 'qrLoadingSkeleton', 'lanUrlDisplay',
        'btnCopyLanUrl', 'btnOpenQrHeader', 'qrModal', 'qrLargeImage',
        'modalUrlDisplay', 'btnCloseQrModal', 'fetchQrCode'
    ];

    for (const token of qrForbiddenTokens) {
        const inHtml = rawHtml.includes(token);
        const inJs = rawJs.includes(token);
        record(`Absence of '${token}' in print_hub.html`, !inHtml, inHtml ? 'Remnant found!' : 'Clean');
        record(`Absence of '${token}' in print_hub.js`, !inJs, inJs ? 'Remnant found!' : 'Clean');
    }

    // Check case-insensitive regex for phrases
    const phrases = [
        /Cetak Langsung dari HP/i,
        /Scan HP/i,
        /Buka QR Code/i,
        /\/api\/print\/qr/i
    ];
    for (const regex of phrases) {
        const inHtml = regex.test(rawHtml);
        const inJs = regex.test(rawJs);
        record(`Absence of pattern ${regex} in HTML`, !inHtml, inHtml ? 'Pattern match found' : 'Clean');
        record(`Absence of pattern ${regex} in JS`, !inJs, inJs ? 'Pattern match found' : 'Clean');
    }

    // Check for any HTML comments that might conceal QR markup
    const domParse = new JSDOM(rawHtml);
    const document = domParse.window.document;
    const iterator = document.createNodeIterator(document, domParse.window.NodeFilter.SHOW_COMMENT);
    let commentNode;
    let qrCommentFound = false;
    while ((commentNode = iterator.nextNode())) {
        if (/qr|barcode|scan/i.test(commentNode.nodeValue)) {
            qrCommentFound = true;
            break;
        }
    }
    record('No HTML comments containing QR/Scan remnants', !qrCommentFound, qrCommentFound ? 'Found hidden comment' : 'Clean');

    // Check for style="display:none" on elements that might be hiding QR blocks
    const hiddenElements = document.querySelectorAll('[style*="display: none"], [style*="display:none"]');
    let suspiciousHidden = false;
    hiddenElements.forEach(el => {
        if (/qr|modal|scan|lan/i.test(el.id || '') || /qr|modal|scan|lan/i.test(el.className || '')) {
            suspiciousHidden = true;
        }
    });
    record('No hidden elements masking QR UI via inline styles', !suspiciousHidden, suspiciousHidden ? 'Suspicious hidden element found' : 'Clean');

    // -------------------------------------------------------------
    // SECTION 2: DOM Hierarchy & Visual Reference Layout Verification
    // -------------------------------------------------------------
    console.log('\n--- SECTION 2: DOM Hierarchy & Layout Alignment ---');

    // Validate Header
    const portalHeader = document.querySelector('.portal-header');
    record('Portal header exists (.portal-header)', !!portalHeader);

    const scanHpHeaderBtn = document.getElementById('btnOpenQrHeader');
    record('Header "Scan HP" button removed from DOM', !scanHpHeaderBtn);

    const statusChip = document.getElementById('serverStatusChip');
    record('Server status chip present (#serverStatusChip)', !!statusChip);

    // Validate Container & Grid
    const phContainer = document.querySelector('.ph-container');
    record('Print Hub container exists (.ph-container)', !!phContainer);

    const qrCardContainer = document.querySelector('.ph-qr-card');
    record('QR banner card completely removed from DOM (.ph-qr-card)', !qrCardContainer);

    const gridLayout = document.querySelector('.ph-grid-layout');
    record('Two-column grid layout exists (.ph-grid-layout)', !!gridLayout);

    const colLeft = document.querySelector('.ph-col-left');
    const colRight = document.querySelector('.ph-col-right');
    record('Left column exists (.ph-col-left)', !!colLeft);
    record('Right column exists (.ph-col-right)', !!colRight);

    // Validate Left Column Cards
    const printerCard = colLeft?.querySelector('.ph-card:first-child');
    record('Printer selection card is first child of left column', !!printerCard);
    record('printerSelect dropdown exists', !!document.getElementById('printerSelect'));
    record('btnReloadPrinters refresh button exists', !!document.getElementById('btnReloadPrinters'));
    record('printerCountChip exists', !!document.getElementById('printerCountChip'));

    const actionCard = colLeft?.querySelectorAll('.ph-card')[1];
    record('Print actions card is second child of left column', !!actionCard);
    record('Tabs nav exists (.ph-tabs-nav)', !!actionCard?.querySelector('.ph-tabs-nav'));
    record('File print form exists (#filePrintForm)', !!document.getElementById('filePrintForm'));
    record('Dropzone exists (#dropzone)', !!document.getElementById('dropzone'));
    record('Text print form exists (#textPrintForm)', !!document.getElementById('textPrintForm'));
    record('Raw textarea exists (#rawTextArea)', !!document.getElementById('rawTextArea'));

    // Validate Right Column Cards
    const spoolerCard = colRight?.querySelector('.ph-card:first-child');
    record('Spooler card is first child of right column', !!spoolerCard);
    record('spoolerList exists', !!document.getElementById('spoolerList'));
    record('btnRefreshQueue exists', !!document.getElementById('btnRefreshQueue'));

    const historyCard = colRight?.querySelectorAll('.ph-card')[1];
    record('Print history card is second child of right column', !!historyCard);
    record('historyList exists', !!document.getElementById('historyList'));
    record('btnClearHistory exists', !!document.getElementById('btnClearHistory'));

    // Modal check
    const qrModal = document.getElementById('qrModal');
    record('QR modal overlay completely removed from DOM (#qrModal)', !qrModal);

    // -------------------------------------------------------------
    // SECTION 3: Adversarial Network Error Stress Harness
    // -------------------------------------------------------------
    console.log('\n--- SECTION 3: Adversarial Network Error & Failure Injection ---');

    async function createIsolatedEnvironment(fetchMock) {
        const uncaughtErrors = [];
        const consoleErrors = [];

        const virtualConsole = new VirtualConsole();
        virtualConsole.on('error', err => consoleErrors.push(err));

        const domInstance = new JSDOM(rawHtml, {
            runScripts: 'outside-only',
            virtualConsole,
            url: 'http://localhost:5005/print_hub.html'
        });

        domInstance.window.addEventListener('error', e => uncaughtErrors.push(e.error || e.message));
        domInstance.window.addEventListener('unhandledrejection', e => uncaughtErrors.push(e.reason));

        domInstance.window.fetch = fetchMock;

        // Eval script before DOMContentLoaded fires
        domInstance.window.eval(rawJs);

        // Wait for JSDOM's natural DOMContentLoaded to fire and resolve initial fetch calls
        await new Promise(r => setTimeout(r, 80));

        return { domInstance, uncaughtErrors, consoleErrors };
    }

    // Stress Test 3.1: Complete Network Failure (TypeError / Connection Refused)
    {
        const { domInstance, uncaughtErrors, consoleErrors } = await createIsolatedEnvironment(async () => {
            throw new Error('TypeError: Failed to fetch (ECONNREFUSED 127.0.0.1:5005)');
        });

        const doc = domInstance.window.document;
        const statusText = doc.getElementById('serverStatusText')?.textContent;
        const chipClass = doc.getElementById('serverStatusChip')?.className;
        const selectText = doc.getElementById('printerSelect')?.textContent;

        record('Offline Network: 0 uncaught runtime errors during initialization', uncaughtErrors.length === 0, `Errors: ${uncaughtErrors.length}`);
        record('Offline Network: serverStatusText displays offline fallback', statusText.includes('Offline'), statusText);
        record('Offline Network: serverStatusChip transitions to warning chip', chipClass.includes('orange'), chipClass);
        record('Offline Network: printerSelect displays helpful server error notice', selectText.includes('Gagal terhubung'), selectText.slice(0, 40) + '...');
        record('Offline Network: errors caught cleanly in catch blocks', consoleErrors.length > 0, `Logged error messages caught: ${consoleErrors.length}`);
    }

    // Stress Test 3.2: HTTP 500 Internal Server Error with HTML body
    {
        const { domInstance, uncaughtErrors } = await createIsolatedEnvironment(async (url) => {
            return {
                ok: false,
                status: 500,
                json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); }
            };
        });

        const doc = domInstance.window.document;
        record('HTTP 500 HTML Error: 0 uncaught runtime errors', uncaughtErrors.length === 0, `Errors: ${uncaughtErrors.length}`);
        record('HTTP 500 HTML Error: serverStatusText handles json syntax error gracefully', doc.getElementById('serverStatusText')?.textContent.includes('Offline'));
    }

    // Stress Test 3.3: HTTP 500 with JSON error response ({ success: false, error: 'Database locked' })
    {
        const { domInstance, uncaughtErrors } = await createIsolatedEnvironment(async (url) => {
            return {
                ok: false,
                status: 500,
                json: async () => ({ success: false, error: 'Internal Server Error: Print Spooler Service Crashing' })
            };
        });

        const doc = domInstance.window.document;
        record('HTTP 500 JSON Error: 0 uncaught runtime errors', uncaughtErrors.length === 0);
        record('HTTP 500 JSON Error: printer dropdown handles failure', doc.getElementById('printerSelect')?.textContent.includes('Gagal terhubung'));
    }

    // Stress Test 3.4: Empty Array Returns (/printers -> [], /queue -> empty)
    {
        const { domInstance, uncaughtErrors } = await createIsolatedEnvironment(async (url) => {
            const u = String(url);
            if (u.includes('/status')) return { ok: true, json: async () => ({ success: true, port: 5005 }) };
            if (u.includes('/printers')) return { ok: true, json: async () => ({ success: true, printers: [], defaultPrinter: null }) };
            if (u.includes('/queue')) return { ok: true, json: async () => ({ success: true, queue: [], history: [] }) };
            return { ok: true, json: async () => ({}) };
        });

        const doc = domInstance.window.document;
        const printerCount = doc.getElementById('printerCountChip')?.textContent;
        const selectOptions = doc.getElementById('printerSelect')?.innerHTML;
        const spoolerText = doc.getElementById('spoolerList')?.textContent;
        const historyText = doc.getElementById('historyList')?.textContent;

        record('Empty Backend Data: 0 uncaught errors', uncaughtErrors.length === 0);
        record('Empty Backend Data: printerCountChip displays "0 Printer"', printerCount === '0 Printer', printerCount);
        record('Empty Backend Data: select has empty state notice', selectOptions.includes('Tidak ada printer Windows yang terpasang'));
        record('Empty Backend Data: spooler list displays empty message', spoolerText.includes('Tidak ada dokumen dalam antrean'));
        record('Empty Backend Data: history list displays empty message', historyText.includes('Belum ada berkas'));
    }

    // Stress Test 3.5: Null / Undefined / Malformed Queue Fields
    {
        const { domInstance, uncaughtErrors } = await createIsolatedEnvironment(async (url) => {
            const u = String(url);
            if (u.includes('/status')) return { ok: true, json: async () => ({ success: true, port: 5005 }) };
            if (u.includes('/printers')) return { ok: true, json: async () => ({ success: true, printers: [{ name: 'Test Printer' }] }) };
            if (u.includes('/queue')) return {
                ok: true,
                json: async () => ({
                    success: true,
                    queue: [{ DocumentName: null, PrinterName: null, TotalPages: null, JobStatus: null }],
                    history: [{ filename: null, printer: null, size: 0, timestamp: null, status: 'Berhasil Dicetak' }]
                })
            };
            return { ok: true, json: async () => ({}) };
        });

        const doc = domInstance.window.document;
        record('Null Queue Data: 0 uncaught errors with corrupted fields', uncaughtErrors.length === 0);
        const spoolerContent = doc.getElementById('spoolerList')?.innerHTML;
        record('Null Queue Data: spooler rendered safely with fallback values', spoolerContent.includes('Dokumen'));
    }

    // -------------------------------------------------------------
    // SECTION 4: Interactive Functional Stress Harness
    // -------------------------------------------------------------
    console.log('\n--- SECTION 4: Interactive Functional Testing ---');

    {
        const apiCalls = [];
        const { domInstance, uncaughtErrors } = await createIsolatedEnvironment(async (url, opts = {}) => {
            const u = String(url);
            apiCalls.push({ url: u, method: opts.method || 'GET', body: opts.body });

            if (u.includes('/status')) return { ok: true, json: async () => ({ success: true, port: 5005 }) };
            if (u.includes('/printers')) return {
                ok: true,
                json: async () => ({
                    success: true,
                    printers: [
                        { name: 'EPSON LQ-310', isDefault: true, portName: 'USB001', driverName: 'Epson ESC/P 24-Pin', status: 'Normal', isDotMatrix: true },
                        { name: 'HP LaserJet Pro', isDefault: false, portName: 'IP_192.168.1.50', driverName: 'HP PCL6', status: 'Normal', isDotMatrix: false }
                    ],
                    defaultPrinter: 'EPSON LQ-310'
                })
            };
            if (u.includes('/queue')) return {
                ok: true,
                json: async () => ({
                    success: true,
                    queue: [{ DocumentName: 'PibDraft_123.pdf', PrinterName: 'EPSON LQ-310', TotalPages: 2, JobStatus: 'Printing' }],
                    history: [{ filename: 'Faktur_456.txt', printer: 'EPSON LQ-310', size: 1024, timestamp: Date.now(), status: 'Berhasil Dicetak' }]
                })
            };
            if (u.includes('/clear-history')) return { ok: true, json: async () => ({ success: true }) };
            if (u.includes('/text')) return { ok: true, json: async () => ({ success: true, jobId: 'job-text-999' }) };
            if (u.includes('/base64')) return { ok: true, json: async () => ({ success: true, jobId: 'job-file-888' }) };
            if (u.includes('/job/')) return { ok: true, json: async () => ({ success: true, job: { status: 'Berhasil Dicetak' } }) };
            return { ok: true, json: async () => ({ success: true }) };
        });

        const doc = domInstance.window.document;
        const win = domInstance.window;

        // Verify printer auto-detection & meta bar
        const printerSelect = doc.getElementById('printerSelect');
        record('Printer dropdown auto-selected default printer EPSON LQ-310', printerSelect.value === 'EPSON LQ-310');

        const metaBarText = doc.getElementById('printerMetaBar')?.textContent;
        record('Printer meta bar rendered port, driver, status pills', metaBarText.includes('USB001') && metaBarText.includes('Normal'));

        const dotMatrixBanner = doc.getElementById('dotMatrixBanner');
        record('Dot Matrix banner displayed for EPSON LQ-310', dotMatrixBanner?.style.display === 'flex');

        // Test Tab Switching: Click 'tab-text'
        const tabBtns = doc.querySelectorAll('.ph-tab-btn');
        tabBtns[1].click();
        const tabTextPane = doc.getElementById('tab-text');
        const tabFilePane = doc.getElementById('tab-file');
        record('Tab switched to Teks / Faktur / RAW pane (display: block)', tabTextPane.style.display === 'block');
        record('File print pane hidden (display: none)', tabFilePane.style.display === 'none');

        // Test Template Loading: Click 'tplSuratJalan'
        doc.getElementById('tplSuratJalan')?.click();
        const rawText = doc.getElementById('rawTextArea')?.value;
        record('Quick template tplSuratJalan populates rawTextArea', rawText.includes('SURAT JALAN PENGELUARAN'));

        // Test Clear Text button
        doc.getElementById('btnClearText')?.click();
        record('btnClearText empties rawTextArea', doc.getElementById('rawTextArea')?.value === '');

        // Test Text Form Submission (with text)
        doc.getElementById('tplLqTest')?.click();
        const initialTextCalls = apiCalls.filter(c => c.url.includes('/api/print/text')).length;
        doc.getElementById('textPrintForm').dispatchEvent(new win.Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 60));
        const postTextCalls = apiCalls.filter(c => c.url.includes('/api/print/text')).length;
        record('textPrintForm submission sends POST to /api/print/text', postTextCalls === initialTextCalls + 1);

        // Test Clear History button
        const initialClearCalls = apiCalls.filter(c => c.url.includes('/api/print/clear-history')).length;
        doc.getElementById('btnClearHistory')?.click();
        await new Promise(r => setTimeout(r, 60));
        const postClearCalls = apiCalls.filter(c => c.url.includes('/api/print/clear-history')).length;
        record('btnClearHistory triggers POST to /api/print/clear-history', postClearCalls === initialClearCalls + 1);

        // Test Refresh Queue button
        const initialQueueCalls = apiCalls.filter(c => c.url.includes('/api/print/queue')).length;
        doc.getElementById('btnRefreshQueue')?.click();
        await new Promise(r => setTimeout(r, 60));
        const postQueueCalls = apiCalls.filter(c => c.url.includes('/api/print/queue')).length;
        record('btnRefreshQueue triggers GET to /api/print/queue', postQueueCalls === initialQueueCalls + 1);

        // Test Reload Printers button
        const initialPrinterCalls = apiCalls.filter(c => c.url.includes('/api/print/printers')).length;
        doc.getElementById('btnReloadPrinters')?.click();
        await new Promise(r => setTimeout(r, 60));
        const postPrinterCalls = apiCalls.filter(c => c.url.includes('/api/print/printers')).length;
        record('btnReloadPrinters triggers refresh of printers & status', postPrinterCalls === initialPrinterCalls + 1);

        // Ensure zero calls to /api/print/qr throughout entire lifecycle
        const totalQrCalls = apiCalls.filter(c => c.url.includes('/api/print/qr')).length;
        record('Zero calls to /api/print/qr throughout entire session', totalQrCalls === 0, `Calls: ${totalQrCalls}`);

        record('Zero uncaught exceptions during full interactive session', uncaughtErrors.length === 0, `Errors: ${uncaughtErrors.length}`);
    }

    // -------------------------------------------------------------
    // SUMMARY & VERDICT
    // -------------------------------------------------------------
    console.log('\n======================================================================');
    const total = testResults.length;
    const passed = testResults.filter(r => r.pass).length;
    const failed = testResults.filter(r => !r.pass).length;
    console.log(`TOTAL ADVERSARIAL TESTS : ${total}`);
    console.log(`PASSED                  : ${passed}`);
    console.log(`FAILED                  : ${failed}`);
    console.log(`VERDICT                 : ${failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES'}`);
    console.log('======================================================================\n');

    process.exit(failed === 0 ? 0 : 1);
}

runAdversarialSuite().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
});
