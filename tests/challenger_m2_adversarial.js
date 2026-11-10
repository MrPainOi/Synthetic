/**
 * Adversarial Challenger 2 Test Suite for Milestone 2
 * Focus: Tab Entitas & Data Controller (pib.html, dashboard.css, pib_dashboard.js)
 * Author: Empirical Challenger (critic & specialist)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const { loadPibDom, loadPibDashboardScript } = require('./e2e/helpers/dom_env');

const testResults = [];
function record(name, pass, details = '') {
    testResults.push({ name, pass, details });
    const symbol = pass ? ' PASS ' : ' FAIL ';
    console.log(`[${symbol}] ${name}${details ? ' - ' + details : ''}`);
}

async function runChallenger2AdversarialSuite() {
    console.log('======================================================================');
    console.log('CHALLENGER 2 EMPIRICAL ADVERSARIAL TEST HARNESS: MILESTONE 2');
    console.log('======================================================================\n');

    // =========================================================================
    // SECTION 1: Remnant & Masking Audit (DOM, CSS, JS)
    // =========================================================================
    console.log('--- SECTION 1: Remnant, Masking & Orphaned Code Audit ---');
    const rawHtml = fs.readFileSync(path.resolve('pib.html'), 'utf8');
    const rawCss = fs.readFileSync(path.resolve('dashboard.css'), 'utf8');
    const rawJs = fs.readFileSync(path.resolve('pib_dashboard.js'), 'utf8');

    // 1.1 Forbidden DOM elements in pib.html
    const forbiddenDomTokens = [
        'ceisa-doc-topbar',
        'btnPibKembali',
        'btnPibUpdateData',
        'btnPibMenuToggle',
        'pibPpjkNpwp',
        'pibCheckOwnerSame',
        'pibCheckSellerSame',
        'PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional'
    ];
    for (const token of forbiddenDomTokens) {
        const present = rawHtml.includes(token);
        record(`Absence of '${token}' in pib.html`, !present, present ? 'Found in DOM!' : 'Clean');
    }

    // 1.2 Check that no span-2 or old grid styling breaks Tab Entitas in DOM
    const { document: doc1, window: win1 } = loadPibDom();
    const span2 = doc1.querySelectorAll('#pib-tab-entitas [style*="grid-column: span 2"]');
    record('Zero elements with grid-column: span 2 in #pib-tab-entitas', span2.length === 0, `Count: ${span2.length}`);

    // 1.3 Ensure all buttons in Tab Entitas have type="button" to prevent accidental form submission
    const entitasButtons = Array.from(doc1.querySelectorAll('#pib-tab-entitas button'));
    const nonButtonTypes = entitasButtons.filter(b => b.getAttribute('type') !== 'button');
    record('All Tab Entitas buttons have explicit type="button"', nonButtonTypes.length === 0, 
        nonButtonTypes.length ? `Buttons missing type="button": ${nonButtonTypes.map(b => b.id || b.className).join(', ')}` : 'Clean');

    // =========================================================================
    // SECTION 2: Visual Structure & Reference Alignment (6 Cards, 2 Columns)
    // =========================================================================
    console.log('\n--- SECTION 2: CEISA 4.0 Layout & Reference Screenshot Alignment ---');
    
    const grid = doc1.querySelector('.ceisa-entitas-grid');
    record('.ceisa-entitas-grid exists in #pib-tab-entitas', !!grid);

    const cols = doc1.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column');
    record('Grid contains exactly two columns', cols.length === 2, `Count: ${cols.length}`);

    const leftCards = cols[0] ? Array.from(cols[0].querySelectorAll('.ceisa-form-card')) : [];
    const rightCards = cols[1] ? Array.from(cols[1].querySelectorAll('.ceisa-form-card')) : [];

    record('Left column has exactly 3 cards', leftCards.length === 3, `Count: ${leftCards.length}`);
    record('Right column has exactly 3 cards', rightCards.length === 3, `Count: ${rightCards.length}`);

    // Card titles order verification
    const getCardTitle = card => card.querySelector('.ceisa-card-title')?.textContent?.trim().replace(/\s+/g, ' ') || '';
    const leftTitles = leftCards.map(getCardTitle);
    const rightTitles = rightCards.map(getCardTitle);

    record('Left Column Card 1 is "Pengirim"', leftTitles[0]?.startsWith('Pengirim'), `Found: "${leftTitles[0]}"`);
    record('Left Column Card 2 is "Pembeli"', leftTitles[1]?.startsWith('Pembeli'), `Found: "${leftTitles[1]}"`);
    record('Left Column Card 3 is "Pemilik Barang"', leftTitles[2]?.startsWith('Pemilik Barang'), `Found: "${leftTitles[2]}"`);

    record('Right Column Card 1 is "Penerima"', rightTitles[0]?.startsWith('Penerima'), `Found: "${rightTitles[0]}"`);
    record('Right Column Card 2 is "Penjual"', rightTitles[1]?.startsWith('Penjual'), `Found: "${rightTitles[1]}"`);
    record('Right Column Card 3 is "PPJK"', rightTitles[2]?.startsWith('PPJK'), `Found: "${rightTitles[2]}"`);

    // Verify key interactive controls per card as in screenshot
    const btnRefPengirim = doc1.getElementById('btnRefPengirim');
    const btnHapusPembeli = doc1.getElementById('btnHapusPembeli');
    const btnCopyPenerimaToPembeli = doc1.getElementById('btnCopyPenerimaToPembeli');
    const btnCopyPenerimaToPemilik = doc1.getElementById('btnCopyPenerimaToPemilik');
    const btnRefPemilik = doc1.getElementById('btnRefPemilik');
    const btnRefPenerima = doc1.getElementById('btnRefPenerima');
    const btnCopyPengirimToPenjual = doc1.getElementById('btnCopyPengirimToPenjual');
    const btnSyncNitkuPpjk = doc1.getElementById('btnSyncNitkuPpjk');

    record('Card Pengirim has "Referensi" button', !!btnRefPengirim);
    record('Card Pembeli has "Hapus Pembeli" button', !!btnHapusPembeli);
    record('Card Pembeli has "Salin data penerima" button', !!btnCopyPenerimaToPembeli);
    record('Card Pemilik Barang has "Salin Penerima" button', !!btnCopyPenerimaToPemilik);
    record('Card Pemilik Barang has "Referensi" button', !!btnRefPemilik);
    record('Card Penerima has "Referensi" button', !!btnRefPenerima);
    record('Card Penjual has "Salin data pengirim" button', !!btnCopyPengirimToPenjual);
    record('Card PPJK has inline "Sinkronisasi NITKU" button', !!btnSyncNitkuPpjk);

    // Verify split inputs
    record('Card Pengirim has split identity input', !!doc1.getElementById('pibPengirimIdType') && !!doc1.getElementById('pibPengirimId'));
    record('Card Pembeli has split identity input', !!doc1.getElementById('pibPembeliIdType') && !!doc1.getElementById('pibPembeliId'));
    record('Card Pemilik Barang has split identity input', !!doc1.getElementById('pibPemilikIdType') && !!doc1.getElementById('pibPemilikId'));
    record('Card Penerima has split identity input', !!doc1.getElementById('pibPenerimaIdType') && !!doc1.getElementById('pibPenerimaId'));
    record('Card Penjual has split identity input', !!doc1.getElementById('pibPenjualIdType') && !!doc1.getElementById('pibPenjualId'));
    record('Card PPJK has split identity input', !!doc1.getElementById('pibPpjkIdType') && !!doc1.getElementById('pibPpjkId'));

    // Verify special fields
    record('Card Pembeli has NITKU with maxlength 22', doc1.getElementById('pibPembeliNitku')?.getAttribute('maxlength') === '22');
    record('Card Pemilik Barang has NITKU with maxlength 22', doc1.getElementById('pibPemilikNitku')?.getAttribute('maxlength') === '22');
    record('Card Pemilik Barang has Afiliasi dropdown', !!doc1.getElementById('pibPemilikAfiliasi'));
    record('Card Penerima has NITKU with maxlength 22', doc1.getElementById('pibPenerimaNitku')?.getAttribute('maxlength') === '22');
    record('Card Penerima has Status dropdown', !!doc1.getElementById('pibPenerimaStatus'));
    record('Card Penerima has Ijin BP Nomor and Tanggal', !!doc1.getElementById('pibPenerimaIjinNo') && !!doc1.getElementById('pibPenerimaIjinDate'));
    record('Card PPJK has NITKU with maxlength 22', doc1.getElementById('pibPpjkNitku')?.getAttribute('maxlength') === '22');

    // =========================================================================
    // SECTION 3: Edge Case Testing - Empty Inputs & Boundary Values
    // =========================================================================
    console.log('\n--- SECTION 3: Edge Case Testing - Empty Inputs & Extreme Boundaries ---');

    const { window: win2, document: doc2 } = loadPibDom();
    loadPibDashboardScript(win2);
    win2.setupPibCopyHandlers();

    // 3.1 Empty Form Collection
    const allInputIds = [
        'pibPengirimId', 'pibPengirimName', 'pibPengirimAddress',
        'pibPembeliId', 'pibPembeliNitku', 'pibPembeliName', 'pibPembeliAddress',
        'pibPemilikId', 'pibPemilikNitku', 'pibPemilikName', 'pibPemilikAddress',
        'pibPenerimaId', 'pibPenerimaNitku', 'pibPenerimaName', 'pibPenerimaAddress', 'pibPenerimaIjinNo', 'pibPenerimaIjinDate',
        'pibPenjualId', 'pibPenjualName', 'pibPenjualAddress',
        'pibPpjkId', 'pibPpjkNitku', 'pibPpjkName', 'pibPpjkAddress'
    ];
    allInputIds.forEach(id => {
        const el = doc2.getElementById(id);
        if (el) el.value = '';
    });

    let emptyCollected = null;
    let emptyCollectError = null;
    try {
        emptyCollected = win2.collectPibFormData();
    } catch (e) {
        emptyCollectError = e;
    }

    record('collectPibFormData() succeeds with empty form without TypeError', !emptyCollectError, emptyCollectError?.message);
    record('Empty form collect produces valid nested entitas', emptyCollected && !!emptyCollected.entitas);
    record('Empty form collect preserves all 6 entity keys', 
        emptyCollected && ['pengirim', 'pembeli', 'pemilikBarang', 'penerima', 'penjual', 'ppjk'].every(k => k in emptyCollected.entitas));
    record('Empty form collect preserves backward-compatible root aliases', 
        emptyCollected && ('importirName' in emptyCollected) && ('supplierName' in emptyCollected));

    // 3.2 Loading null, undefined, empty object, and malformed drafts
    const malformedCases = [
        { label: 'null draft', input: null },
        { label: 'undefined draft', input: undefined },
        { label: 'empty object {}', input: {} },
        { label: 'empty entitas { entitas: {} }', input: { entitas: {} } },
        { label: 'null entitas { entitas: null }', input: { entitas: null } },
        { label: 'null entity cards { entitas: { pengirim: null, pembeli: null } }', input: { entitas: { pengirim: null, pembeli: null } } }
    ];

    for (const c of malformedCases) {
        let loadErr = null;
        try {
            win2.loadPibDraftData(c.input, false);
        } catch (e) {
            loadErr = e;
        }
        record(`loadPibDraftData(${c.label}) executes without throwing`, !loadErr, loadErr?.message);
    }

    // 3.3 Verify that null draft fields DO NOT insert literal string "null" or "undefined"
    win2.loadPibDraftData({
        entitas: {
            pengirim: { nama: null, nomorIdentitas: null, alamat: null, negara: null },
            pembeli: { nama: null, nomorIdentitas: null, nitku: null, alamat: null },
            penerima: { nama: null, nomorIdentitas: null, nitku: null, alamat: null, status: null }
        }
    }, false);

    const checkNoLiteralNull = [
        'pibPengirimName', 'pibPengirimAddress',
        'pibPembeliName', 'pibPembeliNitku', 'pibPembeliAddress',
        'pibPenerimaName', 'pibPenerimaNitku', 'pibPenerimaAddress'
    ];
    let literalNullFound = false;
    for (const id of checkNoLiteralNull) {
        const val = doc2.getElementById(id)?.value;
        if (val === 'null' || val === 'undefined') {
            literalNullFound = true;
            console.log(`Field #${id} has literal '${val}' string!`);
        }
    }
    record('Fields never receive literal "null" or "undefined" string values', !literalNullFound);

    // =========================================================================
    // SECTION 4: Special Characters, Quotations & Unicode Robustness
    // =========================================================================
    console.log('\n--- SECTION 4: Special Characters, Quotations & Unicode Robustness ---');

    const complexPayload = {
        entitas: {
            pengirim: {
                jenisIdentitas: '4 - LAINNYA',
                nomorIdentitas: "ID-'X\"99&<1>",
                nama: "O'Reilly & Sons \"International\" <Logistics> Ltd.",
                alamat: "Line 1: 100 Main St.\nLine 2: Suite #400 & Co.\n\"Special Characters\": <>&'",
                negara: "CN - CHINA"
            },
            pembeli: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0123456789012345',
                nitku: '0123456789012345000001',
                nama: "PT. MAKMUR & 'SEJAHTERA' (PERSERO) Tbk. <INDONESIA>",
                alamat: "Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan & Lt. 25 \"Gedung\"",
                negara: "ID - INDONESIA"
            },
            pemilikBarang: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0123456789012345',
                nitku: '0123456789012345000001',
                nama: "PT. MAKMUR & 'SEJAHTERA' (PERSERO) Tbk. <INDONESIA>",
                alamat: "Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan & Lt. 25 \"Gedung\"",
                afiliasi: 'TAH - Tidak berhubungan'
            },
            penerima: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0123456789012345',
                nitku: '0123456789012345000001',
                nama: "PT. MAKMUR & 'SEJAHTERA' (PERSERO) Tbk. <INDONESIA>",
                alamat: "Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan & Lt. 25 \"Gedung\"",
                negara: "ID - INDONESIA",
                status: 'API-U',
                ijinBpNo: "BP-001/A&B/\"2026\"",
                ijinBpTgl: "2026-11-10"
            },
            penjual: {
                jenisIdentitas: '4 - LAINNYA',
                nomorIdentitas: "ID-'X\"99&<1>",
                nama: "O'Reilly & Sons \"International\" <Logistics> Ltd.",
                alamat: "Line 1: 100 Main St.\nLine 2: Suite #400 & Co.\n\"Special Characters\": <>&'",
                negara: "CN - CHINA"
            },
            ppjk: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0026923485215000',
                nitku: '0026923485215000000000',
                nama: "PT. LOGISTIK & 'FORWARDING' GLOBAL",
                alamat: "Pelabuhan Tanjung Priok Blok B/\"12\""
            }
        }
    };

    win2.loadPibDraftData(complexPayload, false);

    // Verify DOM inputs retain special characters verbatim
    record('DOM retains single quotes in Pengirim name', doc2.getElementById('pibPengirimName').value === complexPayload.entitas.pengirim.nama);
    record('DOM retains multiline & double quotes in Pengirim address', doc2.getElementById('pibPengirimAddress').value === complexPayload.entitas.pengirim.alamat);
    record('DOM retains angle brackets & ampersands in Pembeli name', doc2.getElementById('pibPembeliName').value === complexPayload.entitas.pembeli.nama);
    record('DOM retains quotes and slashes in Ijin BP No', doc2.getElementById('pibPenerimaIjinNo').value === complexPayload.entitas.penerima.ijinBpNo);

    // Round-trip collection
    const collectedComplex = win2.collectPibFormData();
    record('Roundtrip collect preserves single quotes in Pengirim name verbatim', 
        collectedComplex.entitas.pengirim.nama === complexPayload.entitas.pengirim.nama);
    record('Roundtrip collect preserves multiline & quotes in Pengirim address verbatim', 
        collectedComplex.entitas.pengirim.alamat === complexPayload.entitas.pengirim.alamat);
    record('Roundtrip collect preserves angle brackets in Pembeli name verbatim', 
        collectedComplex.entitas.pembeli.nama === complexPayload.entitas.pembeli.nama);
    record('Roundtrip collect preserves quotes & ampersands in root aliases (importirName)', 
        collectedComplex.importirName === complexPayload.entitas.penerima.nama);

    // =========================================================================
    // SECTION 5: Copy Actions & Event Triggering
    // =========================================================================
    console.log('\n--- SECTION 5: Copy Actions, NITKU Sync & Event Propagation ---');

    const { window: win3, document: doc3 } = loadPibDom();
    loadPibDashboardScript(win3);
    win3.setupPibCopyHandlers();

    // 5.1 Copy Penerima -> Pembeli with Event Dispatch Tracking
    doc3.getElementById('pibPenerimaIdType').value = '6 - NPWP 16 DIGIT';
    doc3.getElementById('pibPenerimaId').value = '9876543210987654';
    doc3.getElementById('pibPenerimaNitku').value = '9876543210987654000001';
    doc3.getElementById('pibPenerimaName').value = 'PT. PENERIMA ASLI EVENT';
    doc3.getElementById('pibPenerimaAddress').value = 'Alamat Penerima Asli';
    doc3.getElementById('pibPenerimaCountry').value = 'ID - INDONESIA';

    let pembeliInputFired = false;
    let pembeliChangeFired = false;
    doc3.getElementById('pibPembeliName').addEventListener('input', () => { pembeliInputFired = true; });
    doc3.getElementById('pibPembeliName').addEventListener('change', () => { pembeliChangeFired = true; });

    doc3.getElementById('btnCopyPenerimaToPembeli').click();

    record('Copy Penerima -> Pembeli copies ID verbatim', doc3.getElementById('pibPembeliId').value === '9876543210987654');
    record('Copy Penerima -> Pembeli copies NITKU verbatim', doc3.getElementById('pibPembeliNitku').value === '9876543210987654000001');
    record('Copy Penerima -> Pembeli copies Name verbatim', doc3.getElementById('pibPembeliName').value === 'PT. PENERIMA ASLI EVENT');
    record('Copy Penerima -> Pembeli dispatches "input" event', pembeliInputFired);
    record('Copy Penerima -> Pembeli dispatches "change" event', pembeliChangeFired);

    // 5.2 Hapus Pembeli with Event Dispatch Tracking
    let hapusInputFired = false;
    let hapusChangeFired = false;
    doc3.getElementById('pibPembeliName').addEventListener('input', () => { hapusInputFired = true; });
    doc3.getElementById('pibPembeliName').addEventListener('change', () => { hapusChangeFired = true; });

    doc3.getElementById('btnHapusPembeli').click();

    record('Hapus Pembeli clears ID to empty string', doc3.getElementById('pibPembeliId').value === '');
    record('Hapus Pembeli clears NITKU to empty string', doc3.getElementById('pibPembeliNitku').value === '');
    record('Hapus Pembeli clears Name to empty string', doc3.getElementById('pibPembeliName').value === '');
    record('Hapus Pembeli clears Address to empty string', doc3.getElementById('pibPembeliAddress').value === '');
    record('Hapus Pembeli dispatches "input" event', hapusInputFired);
    record('Hapus Pembeli dispatches "change" event', hapusChangeFired);

    // 5.3 Copy Pengirim -> Penjual
    doc3.getElementById('pibPengirimIdType').value = '4 - LAINNYA';
    doc3.getElementById('pibPengirimId').value = 'EXP-999';
    doc3.getElementById('pibPengirimName').value = 'TEST SHIPPER CO LTD';
    doc3.getElementById('pibPengirimAddress').value = 'Shipper Address Tokyo Japan';
    doc3.getElementById('pibPengirimCountry').value = 'JP - JAPAN';

    doc3.getElementById('btnCopyPengirimToPenjual').click();

    record('Copy Pengirim -> Penjual copies ID', doc3.getElementById('pibPenjualId').value === 'EXP-999');
    record('Copy Pengirim -> Penjual copies Name', doc3.getElementById('pibPenjualName').value === 'TEST SHIPPER CO LTD');
    record('Copy Pengirim -> Penjual copies Address', doc3.getElementById('pibPenjualAddress').value === 'Shipper Address Tokyo Japan');
    record('Copy Pengirim -> Penjual copies Country (JP - JAPAN)', doc3.getElementById('pibPenjualCountry').value === 'JP - JAPAN');

    // 5.4 Copy Penerima -> Pemilik Barang (preserves Afiliasi)
    doc3.getElementById('pibPemilikAfiliasi').value = 'HUB - Berhubungan';
    doc3.getElementById('btnCopyPenerimaToPemilik').click();

    record('Copy Penerima -> Pemilik copies Name', doc3.getElementById('pibPemilikName').value === 'PT. PENERIMA ASLI EVENT');
    record('Copy Penerima -> Pemilik copies NITKU', doc3.getElementById('pibPemilikNitku').value === '9876543210987654000001');
    record('Copy Penerima -> Pemilik PRESERVES existing Afiliasi ("HUB - Berhubungan")', 
        doc3.getElementById('pibPemilikAfiliasi').value === 'HUB - Berhubungan');

    // 5.5 PPJK NITKU Sync Button
    // Case A: 16 digits NPWP -> pad to 22
    doc3.getElementById('pibPpjkId').value = '0026923485215000';
    doc3.getElementById('pibPpjkNitku').value = '';
    doc3.getElementById('btnSyncNitkuPpjk').click();
    record('Sync NITKU PPJK: 16 digits padded to 22 digits', doc3.getElementById('pibPpjkNitku').value === '0026923485215000000000');

    // Case B: Formatted NPWP with dots & dashes -> strips punctuation and pads
    doc3.getElementById('pibPpjkId').value = '00.269.234.8-521.000';
    doc3.getElementById('pibPpjkNitku').value = '';
    doc3.getElementById('btnSyncNitkuPpjk').click();
    record('Sync NITKU PPJK: formatted NPWP stripped and padded to 22 digits', doc3.getElementById('pibPpjkNitku').value === '0026923485210000000000');

    // Case C: Already 22 digits -> preserves verbatim
    doc3.getElementById('pibPpjkId').value = '1122334455667788990011';
    doc3.getElementById('btnSyncNitkuPpjk').click();
    record('Sync NITKU PPJK: 22 digits preserved verbatim', doc3.getElementById('pibPpjkNitku').value === '1122334455667788990011');

    // Case D: Short NPWP (<15 digits) -> clears or sets empty safely
    doc3.getElementById('pibPpjkId').value = '12345';
    doc3.getElementById('btnSyncNitkuPpjk').click();
    record('Sync NITKU PPJK: short NPWP handles safely without crashing', doc3.getElementById('pibPpjkNitku').value === '');

    // =========================================================================
    // SECTION 6: Stepper Navigation (Previous & Next buttons)
    // =========================================================================
    console.log('\n--- SECTION 6: Tab Stepper Navigation ---');
    const { window: win4, document: doc4 } = loadPibDom();
    loadPibDashboardScript(win4);

    const btnPrev = doc4.getElementById('btnPrevFromPibEntitas');
    const btnNext = doc4.getElementById('btnNextFromPibEntitas');

    record('btnPrevFromPibEntitas exists', !!btnPrev);
    record('btnNextFromPibEntitas exists', !!btnNext);

    // Switch to tab entitas first
    win4.switchPibTab('pib-tab-entitas');
    record('Initially switched to #pib-tab-entitas', doc4.getElementById('pib-tab-entitas').classList.contains('active'));

    // Prev should switch to #pib-tab-header
    btnPrev.click();
    record('Clicking btnPrevFromPibEntitas navigates to #pib-tab-header', doc4.getElementById('pib-tab-header').classList.contains('active'));

    // Next should switch to #pib-tab-dokumen
    win4.switchPibTab('pib-tab-entitas');
    btnNext.click();
    record('Clicking btnNextFromPibEntitas navigates to #pib-tab-dokumen', doc4.getElementById('pib-tab-dokumen').classList.contains('active'));

    // =========================================================================
    // SECTION 7: Summary & Verdict Calculation
    // =========================================================================
    console.log('\n======================================================================');
    console.log('CHALLENGER 2 ADVERSARIAL TEST RESULTS SUMMARY');
    console.log('======================================================================');
    const total = testResults.length;
    const passed = testResults.filter(r => r.pass).length;
    const failed = testResults.filter(r => !r.pass).length;

    console.log(`Total Adversarial Tests: ${total}`);
    console.log(`Passed                 : ${passed}`);
    console.log(`Failed                 : ${failed}`);
    console.log(`Pass Rate              : ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
        console.log('Failed Tests:');
        testResults.filter(r => !r.pass).forEach(r => {
            console.log(`  - ${r.name}: ${r.details}`);
        });
    }

    return { total, passed, failed };
}

if (require.main === module) {
    runChallenger2AdversarialSuite().then(({ failed }) => {
        process.exit(failed > 0 ? 1 : 0);
    });
}

module.exports = { runChallenger2AdversarialSuite };
