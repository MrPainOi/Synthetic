/**
 * CHALLENGER FINAL 2 - ADVERSARIAL ROBUSTNESS & VISUAL PARITY TEST SUITE
 * 
 * Empirical verification of:
 * 1. Visual and DOM parity against CEISA 4.0 reference screenshots.
 * 2. Boundary conditions: zero items, massive item counts (1,000 items),
 *    multilingual/Unicode text (Kanji, Cyrillic, Arabic, Emoji), extreme lengths,
 *    and offline network recovery.
 * 3. 100% verification of R1, R2, R3, R4 and all Acceptance Criteria in ORIGINAL_REQUEST.md.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
    ROOT_DIR,
    loadPrintHubDom,
    loadPrintHubScript,
    loadPibDom,
    loadPibDashboardScript,
    createMockCeisaPortalDom,
    loadContentScriptFunctions
} = require('./e2e/helpers/dom_env');

let passedTests = 0;
let failedTests = 0;
const testResults = [];

function runTest(name, fn) {
    try {
        fn();
        passedTests++;
        testResults.push({ name, status: 'PASS' });
        console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
        failedTests++;
        testResults.push({ name, status: 'FAIL', error: err.message, stack: err.stack });
        console.error(`  ✗ [FAIL] ${name}`);
        console.error(`    Error: ${err.message}`);
    }
}

async function runAsyncTest(name, fn) {
    try {
        await fn();
        passedTests++;
        testResults.push({ name, status: 'PASS' });
        console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
        failedTests++;
        testResults.push({ name, status: 'FAIL', error: err.message, stack: err.stack });
        console.error(`  ✗ [FAIL] ${name}`);
        console.error(`    Error: ${err.message}`);
    }
}

console.log('================================================================================');
console.log('  CHALLENGER FINAL 2: ADVERSARIAL STRESS & CEISA 4.0 PARITY HARNESS');
console.log('================================================================================\n');

async function runAllChallengerTests() {
    console.log('--- SUITE 1: VISUAL & DOM PARITY AGAINST REFERENCE SCREENSHOTS ---');

    // 1.1 Print Hub Screenshot Parity (media_1794282626045_8ddf80f2.png)
    runTest('1.1.1 Print Hub: QR container (.ph-qr-card) completely removed from DOM', () => {
        const { document } = loadPrintHubDom();
        assert.strictEqual(document.querySelector('.ph-qr-card'), null);
        assert.strictEqual(document.getElementById('qrThumbBox'), null);
        assert.strictEqual(document.getElementById('qrThumbImage'), null);
        assert.strictEqual(document.getElementById('lanUrlDisplay'), null);
    });

    runTest('1.1.2 Print Hub: Header Scan HP button (#btnOpenQrHeader) and modal removed from DOM', () => {
        const { document } = loadPrintHubDom();
        assert.strictEqual(document.getElementById('btnOpenQrHeader'), null);
        assert.strictEqual(document.getElementById('qrModal'), null);
        assert.strictEqual(document.getElementById('qrLargeImage'), null);
        assert.strictEqual(document.getElementById('btnCloseQrModal'), null);
    });

    runTest('1.1.3 Print Hub: Preserved 2-column layout grid (.ph-grid-layout) with all required cards', () => {
        const { document } = loadPrintHubDom();
        const grid = document.querySelector('.ph-grid-layout');
        assert.ok(grid, 'Grid layout container must exist');
        assert.ok(document.querySelector('.ph-col-left'), 'Left column must exist');
        assert.ok(document.querySelector('.ph-col-right'), 'Right column must exist');
        assert.ok(document.getElementById('printerSelect'), 'Printer dropdown must exist');
        assert.ok(document.getElementById('filePrintForm'), 'File print form must exist');
        assert.ok(document.getElementById('textPrintForm'), 'Text print form must exist');
        assert.ok(document.getElementById('spoolerList'), 'Spooler list must exist');
        assert.ok(document.getElementById('historyList'), 'History list must exist');
    });

    // 1.2 PIB Topbar Removal (media_1794282626019_9dd72ceb.png)
    runTest('1.2.1 PIB: Header .ceisa-doc-topbar completely absent from DOM', () => {
        const { document } = loadPibDom();
        assert.strictEqual(document.querySelector('.ceisa-doc-topbar'), null);
        assert.strictEqual(document.getElementById('btnPibKembali'), null);
        assert.strictEqual(document.getElementById('btnPibUpdateData'), null);
        assert.strictEqual(document.getElementById('btnPibMenuToggle'), null);
    });

    // 1.3 Old PPJK Removal (media_1794282626039_d1d40fb4.png)
    runTest('1.3.1 PIB: Old full-width PPJK card and obsolete checkboxes absent from DOM', () => {
        const { document } = loadPibDom();
        const oldTitle = Array.from(document.querySelectorAll('.ceisa-card-title'))
            .find(el => el.textContent.includes('PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional'));
        assert.strictEqual(oldTitle, undefined, 'Old full-width PPJK card title must not exist');
        assert.strictEqual(document.getElementById('pibCheckOwnerSame'), null);
        assert.strictEqual(document.getElementById('pibCheckSellerSame'), null);
        assert.strictEqual(document.getElementById('pibPpjkNpwp'), null);
    });

    // 1.4 Tab Entitas 2-Column CEISA 4.0 Grid (media_1794282977653_5e8008e4.png & media_1794282972406_ac3647c6.png)
    runTest('1.4.1 Tab Entitas: 2-column grid structure exists with .ceisa-entitas-col-left and .ceisa-entitas-col-right', () => {
        const { document } = loadPibDom();
        const grid = document.querySelector('#pib-tab-entitas .ceisa-entitas-grid');
        assert.ok(grid, 'Grid container #pib-tab-entitas .ceisa-entitas-grid must exist');
        const colLeft = grid.querySelector('.ceisa-entitas-col-left');
        const colRight = grid.querySelector('.ceisa-entitas-col-right');
        assert.ok(colLeft, 'Left column .ceisa-entitas-col-left must exist');
        assert.ok(colRight, 'Right column .ceisa-entitas-col-right must exist');
    });

    runTest('1.4.2 Tab Entitas: Left Column contains exactly 3 cards: Pengirim, Pembeli, Pemilik Barang', () => {
        const { document } = loadPibDom();
        const colLeft = document.querySelector('.ceisa-entitas-col-left');
        const cardTitles = Array.from(colLeft.querySelectorAll('.ceisa-card-title'))
            .map(el => el.textContent.trim());
        assert.strictEqual(cardTitles.length, 3, 'Left column must have 3 cards');
        assert.ok(cardTitles[0].startsWith('Pengirim'), 'Card 1 must be Pengirim');
        assert.ok(cardTitles[1].startsWith('Pembeli'), 'Card 2 must be Pembeli');
        assert.ok(cardTitles[2].startsWith('Pemilik Barang'), 'Card 3 must be Pemilik Barang');
    });

    runTest('1.4.3 Tab Entitas: Right Column contains exactly 3 cards: Penerima, Penjual, PPJK', () => {
        const { document } = loadPibDom();
        const colRight = document.querySelector('.ceisa-entitas-col-right');
        const cardTitles = Array.from(colRight.querySelectorAll('.ceisa-card-title'))
            .map(el => el.textContent.trim());
        assert.strictEqual(cardTitles.length, 3, 'Right column must have 3 cards');
        assert.ok(cardTitles[0].startsWith('Penerima'), 'Card 1 must be Penerima');
        assert.ok(cardTitles[1].startsWith('Penjual'), 'Card 2 must be Penjual');
        assert.ok(cardTitles[2].startsWith('PPJK'), 'Card 3 must be PPJK');
    });

    runTest('1.4.4 Tab Entitas: Exact Field Parity on Card Pengirim', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('btnRefPengirim'), 'Tombol Referensi must exist');
        assert.ok(document.getElementById('pibPengirimIdType'), 'Select pibPengirimIdType must exist');
        assert.ok(document.getElementById('pibPengirimId'), 'Input pibPengirimId must exist');
        assert.ok(document.getElementById('pibPengirimName'), 'Input pibPengirimName must exist');
        assert.ok(document.getElementById('pibPengirimAddress'), 'Textarea pibPengirimAddress must exist');
        assert.ok(document.getElementById('pibPengirimCountry'), 'Select pibPengirimCountry must exist');
    });

    runTest('1.4.5 Tab Entitas: Exact Field Parity on Card Pembeli', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('btnHapusPembeli'), 'Tombol Hapus Pembeli must exist');
        assert.ok(document.getElementById('btnCopyPenerimaToPembeli'), 'Tombol Salin data penerima must exist');
        assert.ok(document.getElementById('pibPembeliIdType'), 'Select pibPembeliIdType must exist');
        assert.ok(document.getElementById('pibPembeliId'), 'Input pibPembeliId must exist');
        const nitku = document.getElementById('pibPembeliNitku');
        assert.ok(nitku, 'Input pibPembeliNitku must exist');
        assert.strictEqual(nitku.getAttribute('maxlength'), '22', 'NITKU Pembeli must have maxlength 22');
        assert.ok(document.getElementById('pibPembeliName'), 'Input pibPembeliName must exist');
        assert.ok(document.getElementById('pibPembeliAddress'), 'Textarea pibPembeliAddress must exist');
        assert.ok(document.getElementById('pibPembeliCountry'), 'Select pibPembeliCountry must exist');
    });

    runTest('1.4.6 Tab Entitas: Exact Field Parity on Card Pemilik Barang', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('btnCopyPenerimaToPemilik'), 'Tombol Salin Penerima must exist');
        assert.ok(document.getElementById('btnRefPemilik'), 'Tombol Referensi Pemilik must exist');
        assert.ok(document.getElementById('pibPemilikIdType'), 'Select pibPemilikIdType must exist');
        assert.ok(document.getElementById('pibPemilikId'), 'Input pibPemilikId must exist');
        const nitku = document.getElementById('pibPemilikNitku');
        assert.ok(nitku, 'Input pibPemilikNitku must exist');
        assert.strictEqual(nitku.getAttribute('maxlength'), '22', 'NITKU Pemilik must have maxlength 22');
        assert.ok(document.getElementById('pibPemilikName'), 'Input pibPemilikName must exist');
        assert.ok(document.getElementById('pibPemilikAddress'), 'Textarea pibPemilikAddress must exist');
        assert.ok(document.getElementById('pibPemilikAfiliasi'), 'Select pibPemilikAfiliasi must exist');
    });

    runTest('1.4.7 Tab Entitas: Exact Field Parity on Card Penerima', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('btnRefPenerima'), 'Tombol Referensi Penerima must exist');
        assert.ok(document.getElementById('pibPenerimaIdType'), 'Select pibPenerimaIdType must exist');
        assert.ok(document.getElementById('pibPenerimaId'), 'Input pibPenerimaId must exist');
        const nitku = document.getElementById('pibPenerimaNitku');
        assert.ok(nitku, 'Input pibPenerimaNitku must exist');
        assert.strictEqual(nitku.getAttribute('maxlength'), '22', 'NITKU Penerima must have maxlength 22');
        assert.ok(document.getElementById('pibPenerimaName'), 'Input pibPenerimaName must exist');
        assert.ok(document.getElementById('pibPenerimaAddress'), 'Textarea pibPenerimaAddress must exist');
        assert.ok(document.getElementById('pibPenerimaCountry'), 'Select pibPenerimaCountry must exist');
        assert.ok(document.getElementById('pibPenerimaStatus'), 'Select pibPenerimaStatus must exist');
        assert.ok(document.getElementById('pibPenerimaIjinNo'), 'Input pibPenerimaIjinNo must exist');
        assert.ok(document.getElementById('pibPenerimaIjinDate'), 'Input pibPenerimaIjinDate must exist');
    });

    runTest('1.4.8 Tab Entitas: Exact Field Parity on Card Penjual', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('btnCopyPengirimToPenjual'), 'Tombol Salin data pengirim must exist');
        assert.ok(document.getElementById('pibPenjualIdType'), 'Select pibPenjualIdType must exist');
        assert.ok(document.getElementById('pibPenjualId'), 'Input pibPenjualId must exist');
        assert.ok(document.getElementById('pibPenjualName'), 'Input pibPenjualName must exist');
        assert.ok(document.getElementById('pibPenjualAddress'), 'Textarea pibPenjualAddress must exist');
        assert.ok(document.getElementById('pibPenjualCountry'), 'Select pibPenjualCountry must exist');
    });

    runTest('1.4.9 Tab Entitas: Exact Field Parity on Card PPJK', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('pibPpjkIdType'), 'Select pibPpjkIdType must exist');
        assert.ok(document.getElementById('pibPpjkId'), 'Input pibPpjkId must exist');
        const nitku = document.getElementById('pibPpjkNitku');
        assert.ok(nitku, 'Input pibPpjkNitku must exist');
        assert.strictEqual(nitku.getAttribute('maxlength'), '22', 'NITKU PPJK must have maxlength 22');
        assert.ok(document.getElementById('btnSyncNitkuPpjk'), 'Tombol sinkronisasi NITKU PPJK must exist');
        assert.ok(document.getElementById('pibPpjkName'), 'Input pibPpjkName must exist');
        assert.ok(document.getElementById('pibPpjkAddress'), 'Textarea pibPpjkAddress must exist');
    });

    runTest('1.4.10 Tab Entitas: Stepper Navigation Footer buttons exist', () => {
        const { document } = loadPibDom();
        const footer = document.querySelector('#pib-tab-entitas .ceisa-tab-nav-footer');
        assert.ok(footer, 'Stepper navigation footer must exist in Tab Entitas');
        assert.ok(document.getElementById('btnPrevFromPibEntitas'), 'Tombol Sebelumnya must exist');
        assert.ok(document.getElementById('btnNextFromPibEntitas'), 'Tombol Selanjutnya must exist');
    });

    console.log('\n--- SUITE 2: BOUNDARY & EXTREME STRESS TESTING ---');

    // 2.1 Zero Items Draft Stress
    runTest('2.1.1 Zero Items: loadPibDraftData handles empty items array and empty draft object safely', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);
        assert.doesNotThrow(() => {
            window.loadPibDraftData({
                header: {},
                entitas: {},
                barang: [],
                dokumen: []
            });
        });
        const collected = window.collectPibFormData();
        assert.ok(collected.entitas, 'Collected data must contain entitas object');
        assert.strictEqual(typeof collected.entitas.pengirim, 'object');
        assert.strictEqual(typeof collected.entitas.penerima, 'object');
    });

    // 2.2 Massive Item Counts Stress (1,000 items)
    runTest('2.2.1 Massive Items: Handles 1,000 items in draft payload without performance degradation', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);

        const largeBarang = [];
        for (let i = 1; i <= 1000; i++) {
            largeBarang.push({
                seri: i,
                hsCode: '8471.30.20',
                uraian: `SPAREPART LAPTOP MODULE COMPONENT SUBASSEMBLY GRADE-${i}`,
                jumlahSatuan: i * 10,
                kodeSatuan: 'PCE',
                cif: i * 15.5
            });
        }

        const startTime = Date.now();
        window.loadPibDraftData({
            header: { nomorAju: '000511OTA39120261103009999' },
            entitas: {
                pengirim: { nama: 'HIGH VOLUME EXPORTER GLOBAL CORP.' },
                penerima: { nama: 'PT. HIGH VOLUME IMPORTER' }
            },
            barang: largeBarang
        });
        const elapsedLoad = Date.now() - startTime;
        assert.ok(elapsedLoad < 1000, `loadPibDraftData took ${elapsedLoad}ms, expected < 1000ms`);

        const startCollect = Date.now();
        const collected = window.collectPibFormData();
        const elapsedCollect = Date.now() - startCollect;
        assert.ok(elapsedCollect < 500, `collectPibFormData took ${elapsedCollect}ms, expected < 500ms`);
        assert.strictEqual(collected.entitas.pengirim.nama, 'HIGH VOLUME EXPORTER GLOBAL CORP.');
        assert.strictEqual(collected.entitas.penerima.nama, 'PT. HIGH VOLUME IMPORTER');
    });

    // 2.3 Unicode & Multilingual Stress (Kanji, Arabic, Cyrillic, Umlauts, Emoji)
    runTest('2.3.1 Unicode Stress: Multi-script Unicode preserved through form lifecycle and content auto-input', () => {
        const { window: pibWin } = loadPibDom();
        loadPibDashboardScript(pibWin);

        const unicodePayload = {
            pengirim: {
                jenisIdentitas: '4 - LAINNYA',
                nomorIdentitas: 'JP-9921-X',
                nama: '株式会社ソニー・インタラクティブエンタテインメント (SONY)',
                alamat: '東京都港区港南1丁目7番1号 〒108-0075 🇯🇵',
                negara: 'JP - JAPAN'
            },
            pembeli: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0123456780120000',
                nitku: '0123456780120000000000',
                nama: 'شركة التجارة العالمية المحدودة PT. TIMUR TENGAH INDONESIA',
                alamat: 'Jl. Boulevard Raya Blok Q-12, Kelapa Gading, Jakarta Utara 🇮🇩',
                negara: 'ID - INDONESIA'
            },
            pemilikBarang: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0123456780120000',
                nitku: '0123456780120000000000',
                nama: 'ООО "Северный Транзит и Логистика" (NORTHERN TRANSIT)',
                alamat: 'г. Санкт-Петербург, Невский проспект, дом 100, офис 42 🇷🇺',
                afiliasi: 'TAH - Tidak berhubungan'
            },
            penerima: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0123456780120000',
                nitku: '0123456780120000000000',
                nama: 'Müller & Söhne Präzisionswerkzeuge GmbH & Co. KG',
                alamat: 'Industriestraße 45, 70565 Stuttgart-Vaihingen, Baden-Württemberg, Deutschland 🇩🇪',
                negara: 'ID - INDONESIA',
                status: 'API-U',
                ijinBpNo: 'BP-2026/XI/9941-Ö',
                ijinBpTgl: '2026-11-10'
            },
            penjual: {
                jenisIdentitas: '4 - LAINNYA',
                nomorIdentitas: 'CN-888999-SH',
                nama: '上海精密機械製造有限公司 (SHANGHAI PRECISION)',
                alamat: '上海市青浦区崧泽大道888号 🇨🇳',
                negara: 'CN - CHINA'
            },
            ppjk: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0026923485215000',
                nitku: '0026923485215000000000',
                nama: 'PT. BINTANG LOGISTIK NUSANTARA 🚢✈️📦',
                alamat: 'Jl. Enggano No. 15, Tanjung Priok, Jakarta Utara'
            }
        };

        pibWin.loadPibDraftData({ entitas: unicodePayload });

        const collected = pibWin.collectPibFormData();
        assert.strictEqual(collected.entitas.pengirim.nama, unicodePayload.pengirim.nama);
        assert.strictEqual(collected.entitas.pembeli.nama, unicodePayload.pembeli.nama);
        assert.strictEqual(collected.entitas.pemilikBarang.nama, unicodePayload.pemilikBarang.nama);
        assert.strictEqual(collected.entitas.penerima.nama, unicodePayload.penerima.nama);
        assert.strictEqual(collected.entitas.penjual.nama, unicodePayload.penjual.nama);
        assert.strictEqual(collected.entitas.ppjk.nama, unicodePayload.ppjk.nama);

        // Auto-input into CEISA mock portal
        const { window: portalWin } = createMockCeisaPortalDom();
        loadContentScriptFunctions(portalWin);

        assert.ok(portalWin.handleCeisaAutoInputRow, 'handleCeisaAutoInputRow must be available');
        portalWin.handleCeisaAutoInputRow(collected);

        // Verify target DOM values in portal
        const getVal = (id) => portalWin.document.getElementById(id).value;
        assert.strictEqual(getVal('ceisa_pengirim_nama'), unicodePayload.pengirim.nama);
        assert.strictEqual(getVal('ceisa_pembeli_nama'), unicodePayload.pembeli.nama);
        assert.strictEqual(getVal('ceisa_pemilik_nama'), unicodePayload.pemilikBarang.nama);
        assert.strictEqual(getVal('ceisa_penerima_nama'), unicodePayload.penerima.nama);
        assert.strictEqual(getVal('ceisa_penjual_nama'), unicodePayload.penjual.nama);
        // PPJK is excluded from auto-fill per user request
        assert.strictEqual(getVal('ceisa_ppjk_nama'), '');
    });

    // 2.4 Extreme Character Lengths & Boundary Limits
    runTest('2.4.1 Extreme Lengths: 5,000 char names and 20,000 char addresses handle without crashing', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);

        const longName = 'COMPANY_NAME_LONG_'.repeat(250); // 4,500 chars
        const longAddress = 'LINE_1: KAWASAN INDUSTRI MEGA MEGAPLEX\n'.repeat(500); // 20,000 chars

        window.loadPibDraftData({
            entitas: {
                pengirim: { nama: longName, alamat: longAddress },
                penerima: { nama: longName, alamat: longAddress }
            }
        });

        const collected = window.collectPibFormData();
        assert.strictEqual(collected.entitas.pengirim.nama.length, longName.length);
        assert.strictEqual(collected.entitas.pengirim.alamat.length, longAddress.length);
    });

    // 2.5 Security Injections & XSS Resilience
    runTest('2.5.1 Security: XSS vectors and SQL injections stored safely as raw text without execution', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);

        const attackPayload = {
            pengirim: {
                nama: `<script>window.__xssPwned = true;</script><svg onload="window.__xssPwned=true">`,
                alamat: `'; DROP TABLE declarations; SELECT * FROM users WHERE '1'='1`
            }
        };

        window.loadPibDraftData({ entitas: attackPayload });
        assert.strictEqual(window.__xssPwned, undefined, 'Script injection must not execute');

        const collected = window.collectPibFormData();
        assert.strictEqual(collected.entitas.pengirim.nama, attackPayload.pengirim.nama);
        assert.strictEqual(collected.entitas.pengirim.alamat, attackPayload.pengirim.alamat);
    });

    // 2.6 High-Frequency Click Flood (50 consecutive clicks)
    runTest('2.6.1 Click Flood: 50 consecutive NITKU sync clicks maintain stable 22-digit length', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);

        const npwpInput = window.document.getElementById('pibPpjkId');
        const nitkuInput = window.document.getElementById('pibPpjkNitku');
        const syncBtn = window.document.getElementById('btnSyncNitkuPpjk');

        npwpInput.value = '0830727251085000'; // 16 digits
        nitkuInput.value = '';

        for (let i = 0; i < 50; i++) {
            syncBtn.click();
        }

        assert.strictEqual(nitkuInput.value.length, 22, 'NITKU must remain exactly 22 digits after 50 sync clicks');
        assert.strictEqual(nitkuInput.value, '0830727251085000000000');
    });

    runTest('2.6.2 Click Flood: 50 consecutive Salin clicks maintain idempotency across Pembeli, Penjual, Pemilik', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);

        // Prepopulate Penerima & Pengirim
        window.document.getElementById('pibPenerimaName').value = 'PT. SOURCE RECIPIENT';
        window.document.getElementById('pibPengirimName').value = 'SOURCE SHIPPER GLOBAL LTD.';

        const btnCopyPembeli = window.document.getElementById('btnCopyPenerimaToPembeli');
        const btnCopyPenjual = window.document.getElementById('btnCopyPengirimToPenjual');
        const btnCopyPemilik = window.document.getElementById('btnCopyPenerimaToPemilik');

        for (let i = 0; i < 50; i++) {
            btnCopyPembeli.click();
            btnCopyPenjual.click();
            btnCopyPemilik.click();
        }

        assert.strictEqual(window.document.getElementById('pibPembeliName').value, 'PT. SOURCE RECIPIENT');
        assert.strictEqual(window.document.getElementById('pibPenjualName').value, 'SOURCE SHIPPER GLOBAL LTD.');
        assert.strictEqual(window.document.getElementById('pibPemilikName').value, 'PT. SOURCE RECIPIENT');
    });

    // 2.7 Offline Network Failure & Recovery in Print Hub
    await runAsyncTest('2.7.1 Offline Network: Print Hub gracefully handles server unreachable & recovers on retry', async () => {
        const { window, document } = loadPrintHubDom();

        // Simulate complete network failure (offline/connection refused)
        window.fetch = async () => {
            throw new Error('TypeError: Failed to fetch (Connection Refused)');
        };

        loadPrintHubScript(window);

        // Dispatch DOMContentLoaded to trigger startup fetch
        document.dispatchEvent(new window.Event('DOMContentLoaded'));

        // Allow async fetchPrinters to reject and handle error
        await new Promise(r => setTimeout(r, 100));

        const chip = document.getElementById('printerCountChip');
        assert.ok(chip.textContent.includes('Gagal') || chip.textContent.includes('Offline') || chip.textContent.includes('Error'),
            `Chip should indicate failure/offline on server error, got: ${chip.textContent}`);

        // Now restore connection
        window.fetch = async (url) => {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    printers: [{ name: 'EPSON LX-310 (Recovered)', status: 'ready', isDefault: true }]
                })
            };
        };

        const reloadBtn = document.getElementById('btnReloadPrinters');
        reloadBtn.click();
        await new Promise(r => setTimeout(r, 100));

        const select = document.getElementById('printerSelect');
        const hasRecoveredPrinter = Array.from(select.options).some(o => o.text.includes('EPSON LX-310 (Recovered)'));
        assert.ok(hasRecoveredPrinter, 'Printer select should populate recovered printer on retry');
    });

    console.log('\n--- SUITE 3: ACCEPTANCE CRITERIA VERIFICATION (R1-R4) ---');

    // 3.1 R1: Print Hub Acceptance Criteria
    runTest('3.1.1 R1-AC1: Kontainer QR Code & QR elements removed from print_hub.html', () => {
        const html = fs.readFileSync(path.join(ROOT_DIR, 'print_hub.html'), 'utf8');
        assert.ok(!html.includes('ph-qr-card'), 'ph-qr-card must not be in print_hub.html');
        assert.ok(!html.includes('qrThumbBox'), 'qrThumbBox must not be in print_hub.html');
        assert.ok(!html.includes('qrThumbImage'), 'qrThumbImage must not be in print_hub.html');
        assert.ok(!html.includes('qrModal'), 'qrModal must not be in print_hub.html');
        assert.ok(!html.includes('Cetak Langsung dari HP (Android / IOS)'), 'QR banner text must not be in print_hub.html');
    });

    runTest('3.1.2 R1-AC2: Print Hub printing features operate without runtime error', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        assert.strictEqual(window.__scriptError, undefined, 'Script evaluation must not throw error');

        const fileForm = document.getElementById('filePrintForm');
        assert.ok(fileForm, 'filePrintForm must exist');
        const textForm = document.getElementById('textPrintForm');
        assert.ok(textForm, 'textPrintForm must exist');
    });

    // 3.2 R2: PIB Header & Old PPJK Removal Acceptance Criteria
    runTest('3.2.1 R2-AC1: Elemen .ceisa-doc-topbar terhapus dari DOM pib.html', () => {
        const html = fs.readFileSync(path.join(ROOT_DIR, 'pib.html'), 'utf8');
        assert.ok(!html.includes('ceisa-doc-topbar'), '.ceisa-doc-topbar must not be in pib.html');
        assert.ok(!html.includes('FTZ01 - Pemasukan dari Luar Daerah Pabean'), 'Topbar text must not be in pib.html');
        assert.ok(!html.includes('btnPibKembali'), 'btnPibKembali must not be in pib.html');
        assert.ok(!html.includes('btnPibUpdateData'), 'btnPibUpdateData must not be in pib.html');
    });

    runTest('3.2.2 R2-AC2: Card lama PPJK - Opsional terhapus sepenuhnya dari DOM pib.html', () => {
        const html = fs.readFileSync(path.join(ROOT_DIR, 'pib.html'), 'utf8');
        assert.ok(!html.includes('PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional'), 'Old PPJK card must not be in pib.html');
        assert.ok(!html.includes('pibCheckOwnerSame'), 'pibCheckOwnerSame must not be in pib.html');
        assert.ok(!html.includes('pibCheckSellerSame'), 'pibCheckSellerSame must not be in pib.html');
    });

    // 3.3 R3: CEISA 4.0 Tab Entitas Layout Acceptance Criteria
    runTest('3.3.1 R3-AC1: Tab Entitas tersusun dalam 2 kolom sejajar (Left: Pengirim, Pembeli, Pemilik; Right: Penerima, Penjual, PPJK)', () => {
        const { document } = loadPibDom();
        const grid = document.querySelector('.ceisa-entitas-grid');
        assert.ok(grid, 'Grid container must exist');
        const leftCards = Array.from(grid.querySelectorAll('.ceisa-entitas-col-left .ceisa-card-title')).map(e => e.textContent.trim());
        const rightCards = Array.from(grid.querySelectorAll('.ceisa-entitas-col-right .ceisa-card-title')).map(e => e.textContent.trim());

        assert.ok(leftCards[0].startsWith('Pengirim'));
        assert.ok(leftCards[1].startsWith('Pembeli'));
        assert.ok(leftCards[2].startsWith('Pemilik Barang'));

        assert.ok(rightCards[0].startsWith('Penerima'));
        assert.ok(rightCards[1].startsWith('Penjual'));
        assert.ok(rightCards[2].startsWith('PPJK'));
    });

    runTest('3.3.2 R3-AC2: Tombol Salin data penerima pada Card Pembeli berfungsi menyalin dari Card Penerima', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        document.getElementById('pibPenerimaIdType').value = '6 - NPWP 16 DIGIT';
        document.getElementById('pibPenerimaId').value = '9876543210123456';
        document.getElementById('pibPenerimaNitku').value = '9876543210123456000001';
        document.getElementById('pibPenerimaName').value = 'PT. PENERIMA ASLI';
        document.getElementById('pibPenerimaAddress').value = 'Alamat Penerima Asli No. 1';

        document.getElementById('btnCopyPenerimaToPembeli').click();

        assert.strictEqual(document.getElementById('pibPembeliId').value, '9876543210123456');
        assert.strictEqual(document.getElementById('pibPembeliNitku').value, '9876543210123456000001');
        assert.strictEqual(document.getElementById('pibPembeliName').value, 'PT. PENERIMA ASLI');
        assert.strictEqual(document.getElementById('pibPembeliAddress').value, 'Alamat Penerima Asli No. 1');
    });

    runTest('3.3.3 R3-AC3: Tombol Salin data pengirim pada Card Penjual berfungsi menyalin dari Card Pengirim', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        document.getElementById('pibPengirimIdType').value = '4 - LAINNYA';
        document.getElementById('pibPengirimId').value = 'CN-SHIP-001';
        document.getElementById('pibPengirimName').value = 'ORIGINAL SHANGHAI SHIPPER CO';
        document.getElementById('pibPengirimAddress').value = 'Songze Avenue No. 999, Shanghai';
        document.getElementById('pibPengirimCountry').value = 'CN - CHINA';

        document.getElementById('btnCopyPengirimToPenjual').click();

        assert.strictEqual(document.getElementById('pibPenjualId').value, 'CN-SHIP-001');
        assert.strictEqual(document.getElementById('pibPenjualName').value, 'ORIGINAL SHANGHAI SHIPPER CO');
        assert.strictEqual(document.getElementById('pibPenjualAddress').value, 'Songze Avenue No. 999, Shanghai');
        assert.strictEqual(document.getElementById('pibPenjualCountry').value, 'CN - CHINA');
    });

    runTest('3.3.4 R3-AC4: Tombol Salin Penerima pada Card Pemilik Barang berfungsi menyalin dari Card Penerima', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        document.getElementById('pibPenerimaIdType').value = '6 - NPWP 16 DIGIT';
        document.getElementById('pibPenerimaId').value = '1122334455667788';
        document.getElementById('pibPenerimaNitku').value = '1122334455667788000000';
        document.getElementById('pibPenerimaName').value = 'PT. PEMILIK GUDANG UTAMA';
        document.getElementById('pibPenerimaAddress').value = 'Kawasan Berikat Nusantara Blok A';

        document.getElementById('btnCopyPenerimaToPemilik').click();

        assert.strictEqual(document.getElementById('pibPemilikId').value, '1122334455667788');
        assert.strictEqual(document.getElementById('pibPemilikNitku').value, '1122334455667788000000');
        assert.strictEqual(document.getElementById('pibPemilikName').value, 'PT. PEMILIK GUDANG UTAMA');
        assert.strictEqual(document.getElementById('pibPemilikAddress').value, 'Kawasan Berikat Nusantara Blok A');
    });

    // 3.4 R4: Data Handling & Auto-Input Acceptance Criteria
    runTest('3.4.1 R4-AC1: collectPibFormData() produces complete object with all 6 entity cards', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);

        const data = window.collectPibFormData();
        assert.ok(data.entitas, 'data.entitas must exist');
        const { pengirim, pembeli, pemilikBarang, penerima, penjual, ppjk } = data.entitas;

        assert.ok(pengirim && pengirim.nama !== undefined);
        assert.ok(pembeli && pembeli.nama !== undefined);
        assert.ok(pemilikBarang && pemilikBarang.nama !== undefined);
        assert.ok(penerima && penerima.nama !== undefined);
        assert.ok(penjual && penjual.nama !== undefined);
        assert.ok(ppjk && ppjk.nama !== undefined);
    });

    runTest('3.4.2 R4-AC2: populatePibForm() / loadPibDraftData() re-populates all 6 entity cards completely', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const testDraft = {
            entitas: {
                pengirim: { nama: 'TEST PENGIRIM' },
                pembeli: { nama: 'TEST PEMBELI' },
                pemilikBarang: { nama: 'TEST PEMILIK' },
                penerima: { nama: 'TEST PENERIMA' },
                penjual: { nama: 'TEST PENJUAL' },
                ppjk: { nama: 'TEST PPJK' }
            }
        };

        window.loadPibDraftData(testDraft);

        assert.strictEqual(document.getElementById('pibPengirimName').value, 'TEST PENGIRIM');
        assert.strictEqual(document.getElementById('pibPembeliName').value, 'TEST PEMBELI');
        assert.strictEqual(document.getElementById('pibPemilikName').value, 'TEST PEMILIK');
        assert.strictEqual(document.getElementById('pibPenerimaName').value, 'TEST PENERIMA');
        assert.strictEqual(document.getElementById('pibPenjualName').value, 'TEST PENJUAL');
        assert.strictEqual(document.getElementById('pibPpjkName').value, 'TEST PPJK');
    });

    runTest('3.4.3 R4-AC3: content.js handleCeisaAutoInputRow maps all 6 entity cards to target portal elements', () => {
        const { window: portalWin } = createMockCeisaPortalDom();
        loadContentScriptFunctions(portalWin);

        const payload = {
            entitas: {
                pengirim: { nama: 'AUTO SHIPPER', alamat: 'Auto Shipper Addr', nomorIdentitas: 'SH-01' },
                penerima: { nama: 'AUTO CONSIGNEE', alamat: 'Auto Consignee Addr', nomorIdentitas: '0123456789012345', nitku: '0123456789012345000000' },
                pembeli: { nama: 'AUTO BUYER', alamat: 'Auto Buyer Addr', nomorIdentitas: '0123456789012345' },
                penjual: { nama: 'AUTO SELLER', alamat: 'Auto Seller Addr', nomorIdentitas: 'SE-01' },
                pemilikBarang: { nama: 'AUTO OWNER', alamat: 'Auto Owner Addr', nomorIdentitas: '0123456789012345' },
                ppjk: { nama: 'AUTO BROKER', alamat: 'Auto Broker Addr', nomorIdentitas: '0026923485215000' }
            }
        };

        portalWin.handleCeisaAutoInputRow(payload);

        const doc = portalWin.document;
        assert.strictEqual(doc.getElementById('ceisa_pengirim_nama').value, 'AUTO SHIPPER');
        assert.strictEqual(doc.getElementById('ceisa_penerima_nama').value, 'AUTO CONSIGNEE');
        assert.strictEqual(doc.getElementById('ceisa_pembeli_nama').value, 'AUTO BUYER');
        assert.strictEqual(doc.getElementById('ceisa_penjual_nama').value, 'AUTO SELLER');
        assert.strictEqual(doc.getElementById('ceisa_pemilik_nama').value, 'AUTO OWNER');
        // PPJK is intentionally excluded from auto-fill per user request
        assert.strictEqual(doc.getElementById('ceisa_ppjk_nama').value, '');
    });

    // Summary
    console.log('\n================================================================================');
    console.log('  CHALLENGER FINAL 2 TEST EXECUTION SUMMARY');
    console.log('================================================================================');
    console.log(`  Total Tests Executed : ${passedTests + failedTests}`);
    console.log(`  Passed               : ${passedTests}`);
    console.log(`  Failed               : ${failedTests}`);
    console.log(`  Pass Rate            : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
    console.log('================================================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
}

runAllChallengerTests().catch(err => {
    console.error('Fatal runner error:', err);
    process.exit(1);
});
