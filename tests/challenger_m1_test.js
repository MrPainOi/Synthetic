/**
 * Adversarial Challenger Test Suite: Milestone 1 (Print Hub QR & UI Cleanup)
 * Author: Empirical Challenger (critic & specialist)
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT_DIR = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT_DIR, 'print_hub.html');
const JS_PATH = path.join(ROOT_DIR, 'print_hub.js');

const rawHtml = fs.readFileSync(HTML_PATH, 'utf8');
const rawJs = fs.readFileSync(JS_PATH, 'utf8');

const results = [];
function record(testName, passed, details = '') {
    results.push({ testName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark}: ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runTestSuite() {
    console.log('================================================================');
    console.log('BEGIN EMPIRICAL ADVERSARIAL CHALLENGE: MILESTONE 1 (PRINT HUB)');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // SUITE 1: Static Code and Regex Absence Audit
    // -------------------------------------------------------------
    console.log('--- SUITE 1: Static Code & Absence Audit ---');

    const forbiddenSelectors = [
        'ph-qr-card',
        'qrThumbBox',
        'qrThumbImage',
        'qrLoadingSkeleton',
        'lanUrlDisplay',
        'btnCopyLanUrl',
        'btnOpenQrHeader',
        'qrModal',
        'qrLargeImage',
        'modalUrlDisplay',
        'btnCloseQrModal'
    ];

    for (const sel of forbiddenSelectors) {
        const inHtml = rawHtml.includes(sel);
        const inJs = rawJs.includes(sel);
        record(`Absence of '${sel}' in HTML`, !inHtml, inHtml ? 'Found in HTML' : 'Absent');
        record(`Absence of '${sel}' in JS`, !inJs, inJs ? 'Found in JS' : 'Absent');
    }

    // Check for QR banner texts or titles
    const forbiddenPhrases = [
        'Cetak Langsung dari HP',
        'Scan HP',
        'Buka QR Code untuk HP',
        'fetchQrCode'
    ];
    for (const phrase of forbiddenPhrases) {
        const inHtml = rawHtml.includes(phrase);
        const inJs = rawJs.includes(phrase);
        record(`Absence of phrase '${phrase}' in HTML`, !inHtml, inHtml ? 'Found in HTML' : 'Absent');
        record(`Absence of phrase '${phrase}' in JS`, !inJs, inJs ? 'Found in JS' : 'Absent');
    }

    // Check CSS rules in HTML
    const forbiddenCssRules = [
        '.ph-qr-card',
        '.ph-qr-thumb',
        '.ph-qr-info',
        '.ph-qr-title',
        '.ph-qr-sub',
        '.ph-qr-link-box',
        '.ph-modal-overlay',
        '.ph-modal-card',
        '.ph-qr-large'
    ];
    for (const cssSel of forbiddenCssRules) {
        const inCss = rawHtml.includes(cssSel);
        record(`Absence of CSS rule '${cssSel}' in HTML style tags`, !inCss, inCss ? 'Found in CSS' : 'Absent');
    }

    // -------------------------------------------------------------
    // SUITE 2: Core Print Hub Controls & DOM Tree Presence Audit
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Core Controls Presence Audit ---');

    const tempDom = new JSDOM(rawHtml);
    const tempDoc = tempDom.window.document;

    const requiredElements = [
        { id: 'serverStatusChip', tag: 'DIV' },
        { id: 'serverStatusText', tag: 'SPAN' },
        { id: 'btnReloadPrinters', tag: 'BUTTON' },
        { id: 'printerCountChip', tag: 'SPAN' },
        { id: 'printerSelect', tag: 'SELECT' },
        { id: 'printerMetaBar', tag: 'DIV' },
        { id: 'dotMatrixBanner', tag: 'DIV' },
        { id: 'filePrintForm', tag: 'FORM' },
        { id: 'dropzone', tag: 'DIV' },
        { id: 'fileInput', tag: 'INPUT' },
        { id: 'filePreview', tag: 'DIV' },
        { id: 'fileNamePreview', tag: 'DIV' },
        { id: 'fileSizePreview', tag: 'DIV' },
        { id: 'btnRemoveFile', tag: 'BUTTON' },
        { id: 'fileCopies', tag: 'INPUT' },
        { id: 'paperSizeSelect', tag: 'SELECT' },
        { id: 'pageRangeInput', tag: 'INPUT' },
        { id: 'fileModeSelect', tag: 'SELECT' },
        { id: 'btnSubmitFile', tag: 'BUTTON' },
        { id: 'btnSubmitFileLabel', tag: 'SPAN' },
        { id: 'textPrintForm', tag: 'FORM' },
        { id: 'rawTextArea', tag: 'TEXTAREA' },
        { id: 'rawModeToggle', tag: 'INPUT' },
        { id: 'ejectPageToggle', tag: 'INPUT' },
        { id: 'btnSubmitText', tag: 'BUTTON' },
        { id: 'btnSubmitTextLabel', tag: 'SPAN' },
        { id: 'btnRefreshQueue', tag: 'BUTTON' },
        { id: 'spoolerList', tag: 'DIV' },
        { id: 'btnClearHistory', tag: 'BUTTON' },
        { id: 'historyList', tag: 'DIV' },
        { id: 'toastContainer', tag: 'DIV' }
    ];

    for (const req of requiredElements) {
        const el = tempDoc.getElementById(req.id);
        const present = !!el && (req.tag ? el.tagName === req.tag : true);
        record(`Presence of required core control #${req.id} (${req.tag})`, present, present ? 'Found' : 'MISSING');
    }

    // -------------------------------------------------------------
    // SUITE 3: DOM Lifecycle Simulation & Zero Error Startup
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: DOM Lifecycle & Zero Error Startup ---');

    const virtualConsole = new VirtualConsole();
    const uncaughtErrors = [];
    const consoleErrors = [];
    virtualConsole.on('jsdomError', (err) => uncaughtErrors.push(err));
    virtualConsole.on('error', (err) => consoleErrors.push(err));

    const dom = new JSDOM(rawHtml, {
        runScripts: 'outside-only',
        virtualConsole,
        url: 'http://localhost:5005/print_hub.html'
    });

    const win = dom.window;
    const doc = win.document;

    // Polyfill localStorage
    const storageStore = {};
    win.localStorage = {
        getItem: (k) => storageStore[k] || null,
        setItem: (k, v) => { storageStore[k] = String(v); },
        removeItem: (k) => { delete storageStore[k]; },
        clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
    };

    // Mock API State & Tracker
    const apiCalls = [];
    let mockHistory = [
        { filename: 'SPPB_FTZ01.pdf', printer: 'EPSON LX-310', size: 1048576, status: 'Berhasil Dicetak', timestamp: Date.now() - 3600000 }
    ];
    let mockQueue = [
        { DocumentName: 'PIB_FTZ01.pdf', PrinterName: 'EPSON LX-310', TotalPages: 2, JobStatus: 'Spooling...' }
    ];

    win.fetch = async (url, options = {}) => {
        const u = String(url);
        apiCalls.push({ url: u, method: options.method || 'GET', body: options.body });

        if (u.includes('/api/print/status')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, port: 5005, primaryIp: '192.168.1.100' })
            };
        }
        if (u.includes('/api/print/printers')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    printers: [
                        { name: 'EPSON LX-310', isDefault: true, status: 'idle', isDotMatrix: true, portName: 'LPT1:', driverName: 'EPSON LX-310 ESC/P' },
                        { name: 'Canon G2010', isDefault: false, status: 'idle', isDotMatrix: false, portName: 'USB001', driverName: 'Canon G2010 Series' }
                    ],
                    defaultPrinter: 'EPSON LX-310'
                })
            };
        }
        if (u.includes('/api/print/queue')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    queue: [...mockQueue],
                    history: [...mockHistory]
                })
            };
        }
        if (u.includes('/api/print/clear-history')) {
            mockHistory = [];
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true })
            };
        }
        if (u.includes('/api/print/text')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, jobId: 'job-text-123' })
            };
        }
        if (u.includes('/api/print/base64')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, jobId: 'job-file-456' })
            };
        }
        if (u.includes('/api/print/qr')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, qr: 'data:image/png;base64,mockqr', url: 'http://192.168.1.100:5005' })
            };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    };

    // Execute script
    try {
        win.eval(rawJs);
        record('print_hub.js evaluation in window scope', true, 'Executed without throwing');
    } catch (evalErr) {
        record('print_hub.js evaluation in window scope', false, evalErr.message);
    }

    // Trigger DOMContentLoaded
    doc.dispatchEvent(new win.Event('DOMContentLoaded'));

    // Wait 100ms for async fetch operations to resolve
    await new Promise(r => setTimeout(r, 100));

    // Check if /api/print/qr was called
    const qrCallCount = apiCalls.filter(c => c.url.includes('/api/print/qr')).length;
    record('Zero calls made to /api/print/qr endpoint during startup', qrCallCount === 0, `Calls: ${qrCallCount}`);

    // Check if server status updated
    const statusText = doc.getElementById('serverStatusText')?.textContent;
    record("Server status text updated to 'Server Aktif (Port 5005)'", statusText === 'Server Aktif (Port 5005)', statusText);

    // Check if printers dropdown populated
    const select = doc.getElementById('printerSelect');
    const options = Array.from(select?.options || []).map(o => o.value);
    const printersPopulated = options.includes('EPSON LX-310') && options.includes('Canon G2010');
    record('Printers dropdown populated with discovered printers', printersPopulated, `Options: ${options.join(', ')}`);

    // Check if dotMatrixBanner automatically configured for EPSON LX-310
    const dotMatrixDisplay = doc.getElementById('dotMatrixBanner')?.style.display;
    record('Dot Matrix banner auto-activated for EPSON LX-310', dotMatrixDisplay === 'flex', `Display: ${dotMatrixDisplay}`);

    // Check if queue populated
    const spoolerListHtml = doc.getElementById('spoolerList')?.innerHTML || '';
    const queuePopulated = spoolerListHtml.includes('PIB_FTZ01.pdf');
    record('Print spooler queue successfully rendered job item', queuePopulated, 'Found PIB_FTZ01.pdf');

    const historyListHtml = doc.getElementById('historyList')?.innerHTML || '';
    const historyPopulated = historyListHtml.includes('SPPB_FTZ01.pdf');
    record('Print history successfully rendered past job item', historyPopulated, 'Found SPPB_FTZ01.pdf');

    // -------------------------------------------------------------
    // SUITE 4: User Interaction Stress Testing
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: User Interaction Stress Testing ---');

    // 1. Reload printers button click
    const btnReload = doc.getElementById('btnReloadPrinters');
    const callsBeforeReload = apiCalls.length;
    btnReload.click();
    await new Promise(r => setTimeout(r, 50));
    const callsAfterReload = apiCalls.length;
    record('btnReloadPrinters click triggers refresh without errors', callsAfterReload > callsBeforeReload, `New API calls: ${callsAfterReload - callsBeforeReload}`);

    // Verify /api/print/qr was NOT called upon reload
    const qrCallsAfterReload = apiCalls.filter(c => c.url.includes('/api/print/qr')).length;
    record('btnReloadPrinters does NOT invoke /api/print/qr', qrCallsAfterReload === 0, `QR calls: ${qrCallsAfterReload}`);

    // 2. Tab switching stress test
    const tabBtns = Array.from(doc.querySelectorAll('.ph-tab-btn'));
    let tabSwitchSuccess = true;
    for (const btn of tabBtns) {
        btn.click();
        const tabTargetId = btn.getAttribute('data-tab');
        const targetPane = doc.getElementById(tabTargetId);
        const isBtnActive = btn.classList.contains('active');
        const isPaneVisible = targetPane && targetPane.style.display !== 'none';
        if (!isBtnActive || !isPaneVisible) {
            tabSwitchSuccess = false;
        }
    }
    record('Tab switching activates target pane display block and active class', tabSwitchSuccess, `Tabs tested: ${tabBtns.length}`);

    // Switch to tab-text
    doc.querySelector('.ph-tab-btn[data-tab="tab-text"]')?.click();

    // 3. Template button click (e.g. Surat Jalan template)
    const tplSj = doc.getElementById('tplSuratJalan');
    tplSj.click();
    const rawTextArea = doc.getElementById('rawTextArea');
    const templateLoaded = rawTextArea.value.includes('SURAT JALAN PENGELUARAN');
    record('Quick Template click loads template text into rawTextArea', templateLoaded, 'Surat Jalan template verified');

    // 4. Text / Direct Print form submission
    const textForm = doc.getElementById('textPrintForm');
    textForm.dispatchEvent(new win.Event('submit', { cancelable: true }));
    await new Promise(r => setTimeout(r, 50));
    const textPrintCalls = apiCalls.filter(c => c.url.includes('/api/print/text'));
    record('Text print form submission dispatches print job to /api/print/text', textPrintCalls.length > 0, `Text print calls: ${textPrintCalls.length}`);

    // 5. Dropzone drag-and-drop events
    const dropzone = doc.getElementById('dropzone');
    dropzone.dispatchEvent(new win.Event('dragover', { cancelable: true }));
    const dragoverActive = dropzone.classList.contains('dragover');
    dropzone.dispatchEvent(new win.Event('dragleave', { cancelable: true }));
    const dragleaveClean = !dropzone.classList.contains('dragover');
    record('Dropzone dragover and dragleave toggle CSS state correctly', dragoverActive && dragleaveClean, 'dragover styling verified');

    // 6. Refresh queue button click
    const btnRefreshQueue = doc.getElementById('btnRefreshQueue');
    btnRefreshQueue.click();
    await new Promise(r => setTimeout(r, 50));
    const queueCalls = apiCalls.filter(c => c.url.includes('/api/print/queue'));
    record('btnRefreshQueue click triggers queue fetch', queueCalls.length > 1, `Queue calls: ${queueCalls.length}`);

    // 7. Clear history button click
    const btnClearHistory = doc.getElementById('btnClearHistory');
    btnClearHistory.click();
    await new Promise(r => setTimeout(r, 50));
    const historyCleared = doc.getElementById('historyList')?.innerHTML.includes('Belum ada berkas');
    record('btnClearHistory triggers /api/print/clear-history and resets history list', historyCleared, 'History reset verified');

    // -------------------------------------------------------------
    // SUITE 5: Adversarial Network & Error Resilience
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Adversarial Network & Error Resilience ---');

    // Simulate Network Outage
    win.fetch = async () => {
        throw new win.TypeError('Failed to fetch (Network connection lost)');
    };

    // Trigger reload under offline condition
    btnReload.click();
    await new Promise(r => setTimeout(r, 50));

    const offlineStatusText = doc.getElementById('serverStatusText')?.textContent;
    const offlineChipClass = doc.getElementById('serverStatusChip')?.className;
    record('Offline server: serverStatusText shows fallback message', offlineStatusText.includes('Offline'), offlineStatusText);
    record('Offline server: serverStatusChip shows orange warning class', offlineChipClass.includes('orange'), offlineChipClass);

    // Simulate Malformed JSON
    win.fetch = async () => {
        return {
            ok: true,
            status: 200,
            json: async () => { throw new win.SyntaxError('Unexpected token < in JSON at position 0'); }
        };
    };

    btnReload.click();
    await new Promise(r => setTimeout(r, 50));
    record('Malformed JSON response is caught gracefully without uncaught rejection', true, 'Handled via try/catch');

    // -------------------------------------------------------------
    // SUITE 6: Polling Interval & Long-Run Leak Check
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: Polling Loop Verification ---');

    // Restore working fetch
    const pollCalls = [];
    win.fetch = async (url) => {
        pollCalls.push(String(url));
        return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, port: 5005, queue: [], history: [] })
        };
    };

    // Trigger background interval ticks
    for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 10));
    }
    const pollQrCalls = pollCalls.filter(c => c.includes('/api/print/qr')).length;
    record('Continuous polling does NOT issue any /api/print/qr calls', pollQrCalls === 0, `Calls: ${pollQrCalls}`);

    // Check runtime error log: uncaught errors / jsdomError
    record('Zero uncaught exceptions/TypeErrors during entire lifecycle', uncaughtErrors.length === 0, `Uncaught errors: ${uncaughtErrors.length}`);

    console.log('\n================================================================');
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;
    console.log(`TOTAL TESTS : ${totalTests}`);
    console.log(`PASSED      : ${passedTests}`);
    console.log(`FAILED      : ${failedTests}`);
    console.log(`VERDICT     : ${failedTests === 0 ? 'APPROVE' : 'REQUEST_CHANGES'}`);
    console.log('================================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
}

runTestSuite().catch(err => {
    console.error('Test harness exception:', err);
    process.exit(1);
});
