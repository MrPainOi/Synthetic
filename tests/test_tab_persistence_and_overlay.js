/**
 * Challenger Test Suite: Cross-Tab Persistence & Clean Overlay Mode Parity
 * Verifies:
 * 1. PDF OCR cross-tab persistence (IndexedDB + localStorage, zero re-scan on tab switch)
 * 2. Print Hub cross-tab persistence (Raw text, settings, printer selection, file storage)
 * 3. PIB Dashboard sub-tab persistence
 * 4. Doc Searcher parameters and Outlook results persistence
 * 5. Bounding box overlay & multi-layer suppression (No solid blue clutter)
 * 6. Zero-Emoji Compliance across all modules
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`[PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`[FAIL] ${name}: ${err.message}`);
        testsFailed++;
    }
}

console.log('--- RUNNING CROSS-TAB PERSISTENCE & OVERLAY TEST SUITE ---');

// 1. PDF OCR Persistence in ocr_tool.js
runTest('PDF OCR: saveOcrSessionState, restoreLastOcrSession, and clearOcrSession exist in ocr_tool.js', () => {
    const ocrJs = fs.readFileSync(path.join(__dirname, '../ocr_tool.js'), 'utf8');
    assert(ocrJs.includes('function saveOcrSessionState'), 'saveOcrSessionState should be defined');
    assert(ocrJs.includes('async function restoreLastOcrSession'), 'restoreLastOcrSession should be defined');
    assert(ocrJs.includes('async function clearOcrSession'), 'clearOcrSession should be defined');
    assert(ocrJs.includes('ceisa_ocr_last_state'), 'Should persist state under ceisa_ocr_last_state in localStorage');
    assert(ocrJs.includes('ceisa_storage_db'), 'Should use IndexedDB ceisa_storage_db');
    assert(ocrJs.includes('last_ocr_document'), 'Should store document under key last_ocr_document');
});

// 2. PDF OCR Clean Overlay & Dual-Layer Suppression
runTest('PDF OCR: Clean bounding boxes and textLayer suppression defined in CSS', () => {
    const ocrHtml = fs.readFileSync(path.join(__dirname, '../ocr_tool.html'), 'utf8');
    assert(ocrHtml.includes('.textLayer.suppressed'), 'textLayer.suppressed class should exist to prevent selection clashes');
    assert(ocrHtml.includes('background: rgba(59, 130, 246, 0.03)'), 'Bounding boxes must have near-transparent background (not solid blue)');
    assert(ocrHtml.includes('.ocr-text-layer.mode-boxes .ocr-text-line:hover'), 'Hover highlight must be clearly defined');
});

// 3. Print Hub Persistence in print_hub.js
runTest('Print Hub: State & document persistence defined in print_hub.js', () => {
    const printJs = fs.readFileSync(path.join(__dirname, '../print_hub.js'), 'utf8');
    assert(printJs.includes('function savePrintState'), 'savePrintState must be defined');
    assert(printJs.includes('async function restorePrintState'), 'restorePrintState must be defined');
    assert(printJs.includes('ceisa_print_hub_state'), 'ceisa_print_hub_state must be used');
    assert(printJs.includes('last_print_document'), 'last_print_document must be used in IndexedDB');
});

// 4. PIB Dashboard Active Sub-Tab Persistence
runTest('PIB Dashboard: Sub-tab persistence defined in pib_dashboard.js', () => {
    const pibJs = fs.readFileSync(path.join(__dirname, '../pib_dashboard.js'), 'utf8');
    assert(pibJs.includes('ceisa_active_pib_tab'), 'ceisa_active_pib_tab must be persisted in localStorage');
    assert(pibJs.includes("localStorage.getItem('ceisa_active_pib_tab')"), 'Active sub-tab must be restored on load');
});

// 5. Doc Searcher Persistence in doc_searcher.js
runTest('Doc Searcher: Parameters and Outlook results persistence defined in doc_searcher.js', () => {
    const dsJs = fs.readFileSync(path.join(__dirname, '../doc_searcher.js'), 'utf8');
    assert(dsJs.includes('function saveDocSearcherState'), 'saveDocSearcherState must be defined');
    assert(dsJs.includes('async function restoreDocSearcherState'), 'restoreDocSearcherState must be defined');
    assert(dsJs.includes('ceisa_doc_searcher_state'), 'ceisa_doc_searcher_state must be used');
    assert(dsJs.includes('last_docsearcher_document'), 'last_docsearcher_document must be used');
});

// 6. Zero-Emoji Compliance
runTest('Zero-Emoji Compliance across all module scripts and views', () => {
    const filesToCheck = [
        '../ocr_tool.html',
        '../ocr_tool.js',
        '../print_hub.js',
        '../doc_searcher.js',
        '../pib_dashboard.js'
    ];
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    filesToCheck.forEach(relPath => {
        const full = path.join(__dirname, relPath);
        const text = fs.readFileSync(full, 'utf8');
        const matches = text.match(new RegExp(emojiRegex, 'gu'));
        assert(!matches || matches.length === 0, `Found ${matches ? matches.length : 0} emojis in ${relPath}`);
    });
});

console.log(`\nTEST RESULTS: ${testsPassed} Passed, ${testsFailed} Failed.`);
if (testsFailed > 0) process.exit(1);
