/**
 * Challenger 1 Stress Harness for Milestone 2 (PIB CEISA 4.0 Tab Entitas & Data Controller)
 * Empirically challenges copy buttons, NITKU sync, serialization roundtrips, and edge cases.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadPibDom, loadPibDashboardScript } = require('./e2e/helpers/dom_env');

const results = [];
function test(name, fn) {
    try {
        fn();
        results.push({ name, status: 'PASSED' });
        console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
        results.push({ name, status: 'FAILED', error: err.message });
        console.error(`  \x1b[31m✗\x1b[0m ${name}`);
        console.error(`     \x1b[31mError:\x1b[0m ${err.message}`);
    }
}

function setupEnv() {
    const { dom, window, document } = loadPibDom();
    // polyfill scrollIntoView for jsdom
    if (!window.HTMLElement.prototype.scrollIntoView) {
        window.HTMLElement.prototype.scrollIntoView = function() {};
    }
    loadPibDashboardScript(window);
    if (typeof window.setupPibCopyHandlers === 'function') {
        window.setupPibCopyHandlers();
    }
    return { dom, window, document };
}

console.log('='.repeat(80));
console.log('  CHALLENGER 1: EMPIRICAL STRESS TESTS (MILESTONE 2)');
console.log('='.repeat(80));

// =========================================================================
// SECTION 1: COPY BUTTON SEQUENCES & BEHAVIOR
// =========================================================================
console.log('\n--- Section 1: Copy Button Sequences & Field Retention ---');

test('Seq 1.1: Salin Penerima ke Pembeli -> Hapus Pembeli -> Verify Pembeli cleared, Penerima intact', () => {
    const { window, document } = setupEnv();
    
    // Set initial custom values on Penerima
    document.getElementById('pibPenerimaIdType').value = '6 - NPWP 16 DIGIT';
    document.getElementById('pibPenerimaId').value = '9876543210987654';
    document.getElementById('pibPenerimaNitku').value = '9876543210987654000000';
    document.getElementById('pibPenerimaName').value = 'PT. PENERIMA MAKMUR SEJAHTERA';
    document.getElementById('pibPenerimaAddress').value = 'Jl. Industri Hijau No. 88, Cikarang';
    document.getElementById('pibPenerimaCountry').value = 'ID - INDONESIA';

    // Click Salin Penerima ke Pembeli
    const btnCopyPembeli = document.getElementById('btnCopyPenerimaToPembeli');
    assert(btnCopyPembeli, 'btnCopyPenerimaToPembeli must exist');
    btnCopyPembeli.click();

    // Verify Pembeli received Penerima data
    assert.strictEqual(document.getElementById('pibPembeliId').value, '9876543210987654');
    assert.strictEqual(document.getElementById('pibPembeliNitku').value, '9876543210987654000000');
    assert.strictEqual(document.getElementById('pibPembeliName').value, 'PT. PENERIMA MAKMUR SEJAHTERA');
    assert.strictEqual(document.getElementById('pibPembeliAddress').value, 'Jl. Industri Hijau No. 88, Cikarang');
    assert.strictEqual(document.getElementById('pibPembeliCountry').value, 'ID - INDONESIA');

    // Click Hapus Pembeli
    const btnHapusPembeli = document.getElementById('btnHapusPembeli');
    assert(btnHapusPembeli, 'btnHapusPembeli must exist');
    btnHapusPembeli.click();

    // Verify Pembeli fields are completely cleared
    assert.strictEqual(document.getElementById('pibPembeliId').value, '');
    assert.strictEqual(document.getElementById('pibPembeliNitku').value, '');
    assert.strictEqual(document.getElementById('pibPembeliName').value, '');
    assert.strictEqual(document.getElementById('pibPembeliAddress').value, '');

    // Verify Penerima was NOT affected by Hapus Pembeli
    assert.strictEqual(document.getElementById('pibPenerimaId').value, '9876543210987654');
    assert.strictEqual(document.getElementById('pibPenerimaName').value, 'PT. PENERIMA MAKMUR SEJAHTERA');
    assert.strictEqual(document.getElementById('pibPenerimaAddress').value, 'Jl. Industri Hijau No. 88, Cikarang');
});

test('Seq 1.2: Salin Penerima ke Pemilik -> Afiliasi default TAH is preserved', () => {
    const { window, document } = setupEnv();
    
    document.getElementById('pibPenerimaId').value = '1122334455667788';
    document.getElementById('pibPenerimaNitku').value = '1122334455667788000000';
    document.getElementById('pibPenerimaName').value = 'PT. PEMILIK LOGISTIK UTAMA';
    document.getElementById('pibPenerimaAddress').value = 'Kawasan Berikat Nusantara Blok A';

    // Ensure Afiliasi is default 'TAH - Tidak berhubungan'
    document.getElementById('pibPemilikAfiliasi').value = 'TAH - Tidak berhubungan';

    const btnCopyPemilik = document.getElementById('btnCopyPenerimaToPemilik');
    assert(btnCopyPemilik, 'btnCopyPenerimaToPemilik must exist');
    btnCopyPemilik.click();

    // Verify Pemilik received Penerima data
    assert.strictEqual(document.getElementById('pibPemilikId').value, '1122334455667788');
    assert.strictEqual(document.getElementById('pibPemilikNitku').value, '1122334455667788000000');
    assert.strictEqual(document.getElementById('pibPemilikName').value, 'PT. PEMILIK LOGISTIK UTAMA');
    assert.strictEqual(document.getElementById('pibPemilikAddress').value, 'Kawasan Berikat Nusantara Blok A');

    // Verify Afiliasi remains 'TAH - Tidak berhubungan'
    assert.strictEqual(document.getElementById('pibPemilikAfiliasi').value, 'TAH - Tidak berhubungan');
});

test('Seq 1.3: Salin Penerima ke Pemilik -> Afiliasi modified to HUB is strictly preserved', () => {
    const { window, document } = setupEnv();
    
    document.getElementById('pibPenerimaId').value = '9988776655443322';
    document.getElementById('pibPenerimaName').value = 'PT. INDUK USAHA SEJAHTERA';
    
    // Explicitly set Afiliasi to 'HUB - Berhubungan'
    const selAfiliasi = document.getElementById('pibPemilikAfiliasi');
    selAfiliasi.value = 'HUB - Berhubungan';

    const btnCopyPemilik = document.getElementById('btnCopyPenerimaToPemilik');
    btnCopyPemilik.click();

    // Verify data copied
    assert.strictEqual(document.getElementById('pibPemilikId').value, '9988776655443322');
    assert.strictEqual(document.getElementById('pibPemilikName').value, 'PT. INDUK USAHA SEJAHTERA');
    
    // Verify Afiliasi was NOT reset to default TAH
    assert.strictEqual(document.getElementById('pibPemilikAfiliasi').value, 'HUB - Berhubungan');
});

test('Seq 1.4: Salin Pengirim ke Penjual -> Foreign countries and identities preserved across multiple regions', () => {
    const { window, document } = setupEnv();
    const btnCopyPenjual = document.getElementById('btnCopyPengirimToPenjual');
    assert(btnCopyPenjual, 'btnCopyPengirimToPenjual must exist');

    const testCases = [
        { idType: '4 - LAINNYA', id: 'DE-883921', name: 'SIEMENS AG MUNICH', addr: 'Werner-von-Siemens-Strasse 1', country: 'DE - GERMANY' },
        { idType: '2 - PASPOR', id: 'P98234190', name: 'TOKYO INSTRUMENTS INC', addr: 'Chuo-ku, Tokyo 104-0061', country: 'JP - JAPAN' },
        { idType: '4 - LAINNYA', id: 'SG-20231994Z', name: 'GOLDEN BEN PRINTER PTE LTD', addr: '10 Ubi Crescent #01-02', country: 'SG - SINGAPORE' },
        { idType: '4 - LAINNYA', id: 'US-991283', name: 'CALIFORNIA TECH SUPPLIES LLC', addr: '450 Silicon Valley Way, CA', country: 'US - UNITED STATES' }
    ];

    for (const tc of testCases) {
        document.getElementById('pibPengirimIdType').value = tc.idType;
        document.getElementById('pibPengirimId').value = tc.id;
        document.getElementById('pibPengirimName').value = tc.name;
        document.getElementById('pibPengirimAddress').value = tc.addr;
        document.getElementById('pibPengirimCountry').value = tc.country;

        btnCopyPenjual.click();

        assert.strictEqual(document.getElementById('pibPenjualIdType').value, tc.idType, `Penjual idType should match ${tc.idType}`);
        assert.strictEqual(document.getElementById('pibPenjualId').value, tc.id, `Penjual id should match ${tc.id}`);
        assert.strictEqual(document.getElementById('pibPenjualName').value, tc.name, `Penjual name should match ${tc.name}`);
        assert.strictEqual(document.getElementById('pibPenjualAddress').value, tc.addr, `Penjual address should match ${tc.addr}`);
        assert.strictEqual(document.getElementById('pibPenjualCountry').value, tc.country, `Penjual country should match ${tc.country}`);
    }
});

test('Seq 1.5: Event emission on copy actions: input and change events must fire for reactivity/autosave', () => {
    const { window, document } = setupEnv();
    
    let pembeliInputFired = 0;
    let pembeliChangeFired = 0;
    document.getElementById('pibPembeliName').addEventListener('input', () => pembeliInputFired++);
    document.getElementById('pibPembeliName').addEventListener('change', () => pembeliChangeFired++);

    document.getElementById('pibPenerimaName').value = 'PT. TEST EVENT REACTIVITY';
    document.getElementById('btnCopyPenerimaToPembeli').click();

    assert(pembeliInputFired > 0, 'Expected input event to be dispatched on pibPembeliName during copy');
    assert(pembeliChangeFired > 0, 'Expected change event to be dispatched on pibPembeliName during copy');

    // Test clear event emission
    let clearInputFired = 0;
    let clearChangeFired = 0;
    document.getElementById('pibPembeliName').addEventListener('input', () => clearInputFired++);
    document.getElementById('pibPembeliName').addEventListener('change', () => clearChangeFired++);

    document.getElementById('btnHapusPembeli').click();
    assert(clearInputFired > 0, 'Expected input event on pibPembeliName during Hapus Pembeli');
    assert(clearChangeFired > 0, 'Expected change event on pibPembeliName during Hapus Pembeli');
});

test('Seq 1.6: Repeated cyclical copy and clear actions remain idempotent without listener leakage', () => {
    const { window, document } = setupEnv();
    const btnCopy = document.getElementById('btnCopyPenerimaToPembeli');
    const btnHapus = document.getElementById('btnHapusPembeli');

    document.getElementById('pibPenerimaName').value = 'PT. SIKLUS PERSISTEN';

    for (let cycle = 0; cycle < 10; cycle++) {
        btnCopy.click();
        assert.strictEqual(document.getElementById('pibPembeliName').value, 'PT. SIKLUS PERSISTEN');
        btnHapus.click();
        assert.strictEqual(document.getElementById('pibPembeliName').value, '');
    }
});


// =========================================================================
// SECTION 2: PPJK NITKU SYNC & FORMATTING
// =========================================================================
console.log('\n--- Section 2: PPJK NITKU Sync & Validation Matrix ---');

test('NITKU 2.1: 15-digit NPWP is correctly padded to 22 digits with zeroes', () => {
    const { window, document } = setupEnv();
    const inputId = document.getElementById('pibPpjkId');
    const inputNitku = document.getElementById('pibPpjkNitku');
    const btnSync = document.getElementById('btnSyncNitkuPpjk');

    inputId.value = '012345678901234'; // 15 digits
    inputNitku.value = '';
    btnSync.click();

    assert.strictEqual(inputNitku.value.length, 22, 'NITKU length must be 22 digits');
    assert.strictEqual(inputNitku.value, '0123456789012340000000', '15 digits must be padded with 7 zeroes');
});

test('NITKU 2.2: 16-digit NPWP is correctly padded to 22 digits with zeroes', () => {
    const { window, document } = setupEnv();
    const inputId = document.getElementById('pibPpjkId');
    const inputNitku = document.getElementById('pibPpjkNitku');
    const btnSync = document.getElementById('btnSyncNitkuPpjk');

    inputId.value = '0123456789012345'; // 16 digits
    inputNitku.value = '';
    btnSync.click();

    assert.strictEqual(inputNitku.value.length, 22, 'NITKU length must be 22 digits');
    assert.strictEqual(inputNitku.value, '0123456789012345000000', '16 digits must be padded with 6 zeroes');
});

test('NITKU 2.3: Existing 22-digit NITKU in PPJK ID is preserved identically', () => {
    const { window, document } = setupEnv();
    const inputId = document.getElementById('pibPpjkId');
    const inputNitku = document.getElementById('pibPpjkNitku');
    const btnSync = document.getElementById('btnSyncNitkuPpjk');

    inputId.value = '0123456789012345000000'; // 22 digits
    inputNitku.value = '';
    btnSync.click();

    assert.strictEqual(inputNitku.value.length, 22, 'NITKU length must be 22 digits');
    assert.strictEqual(inputNitku.value, '0123456789012345000000');
});

test('NITKU 2.4: Formatted NPWP with dots and hyphens is sanitized and padded', () => {
    const { window, document } = setupEnv();
    const inputId = document.getElementById('pibPpjkId');
    const inputNitku = document.getElementById('pibPpjkNitku');
    const btnSync = document.getElementById('btnSyncNitkuPpjk');

    // 15 digits formatted standard NPWP: 01.234.567.8-901.000
    inputId.value = '01.234.567.8-901.000';
    btnSync.click();

    assert.strictEqual(inputNitku.value.length, 22, 'Sanitized NITKU must be 22 digits');
    assert.strictEqual(inputNitku.value, '0123456789010000000000');
});

test('NITKU 2.5: Sub-15 digit string (14 digits) clears NITKU to prevent corrupted payload', () => {
    const { window, document } = setupEnv();
    const inputId = document.getElementById('pibPpjkId');
    const inputNitku = document.getElementById('pibPpjkNitku');
    const btnSync = document.getElementById('btnSyncNitkuPpjk');

    inputId.value = '12345678901234'; // 14 digits
    inputNitku.value = 'EXISTING_VALUE';
    btnSync.click();

    assert.strictEqual(inputNitku.value, '', 'Sub-15 digit NPWP should clear NITKU');
});

test('NITKU 2.6: Non-compliant length (17 digits) clears NITKU safely', () => {
    const { window, document } = setupEnv();
    const inputId = document.getElementById('pibPpjkId');
    const inputNitku = document.getElementById('pibPpjkNitku');
    const btnSync = document.getElementById('btnSyncNitkuPpjk');

    inputId.value = '12345678901234567'; // 17 digits
    inputNitku.value = 'EXISTING_VALUE';
    btnSync.click();

    assert.strictEqual(inputNitku.value, '', '17-digit string should clear NITKU');
});

test('NITKU 2.7: Invalid alphanumeric or empty input clears NITKU safely', () => {
    const { window, document } = setupEnv();
    const inputId = document.getElementById('pibPpjkId');
    const inputNitku = document.getElementById('pibPpjkNitku');
    const btnSync = document.getElementById('btnSyncNitkuPpjk');

    const invalidInputs = ['', '   ', 'INVALID-NPWP', 'ABC12345', '---'];
    for (const inv of invalidInputs) {
        inputId.value = inv;
        inputNitku.value = 'SHOULD_BE_CLEARED';
        btnSync.click();
        assert.strictEqual(inputNitku.value, '', `Invalid input "${inv}" must result in empty NITKU`);
    }
});

test('NITKU 2.8: Nitku sync fires change and input events on pibPpjkNitku', () => {
    const { window, document } = setupEnv();
    const inputId = document.getElementById('pibPpjkId');
    const inputNitku = document.getElementById('pibPpjkNitku');
    const btnSync = document.getElementById('btnSyncNitkuPpjk');

    let eventCount = 0;
    inputNitku.addEventListener('change', () => eventCount++);

    inputId.value = '0123456789012345';
    btnSync.click();

    assert(eventCount > 0, 'Change event must fire on pibPpjkNitku after sync');
});


// =========================================================================
// SECTION 3: ROUNDTRIP SERIALIZATION & RESTORATION FIDELITY
// =========================================================================
console.log('\n--- Section 3: Data Collection & Roundtrip Serialization ---');

test('Roundtrip 3.1: Complete 6-card payload survives collect -> serialize -> clear -> load -> collect roundtrip', () => {
    const { window, document } = setupEnv();
    
    // Fill all 6 cards with unique distinct values
    const originalDraft = {
        nomorAju: '010700-123456-20261110-000001',
        kantorPabean: '020400 - KPU BEA DAN CUKAI TIPE B BATAM',
        jenisPemasukan: '01 - DARI LDP',
        jenisPemberitahuan: '1 - BIASA',
        kategoriPemasukan: '001',
        tujuanPemasukan: '2 - PEMAKAIAN LANGSUNG',
        jenisTransaksiPajak: 'B - BUKAN PENYERAHAN BARANG KENA PAJAK',
        entitas: {
            pengirim: {
                jenisIdentitas: '4 - LAINNYA',
                nomorIdentitas: 'SH-EXP-2026-99',
                nama: 'SHANGHAI HEAVY INDUSTRIAL CO LTD',
                alamat: 'Building 12, Pudong High-Tech Park, Shanghai',
                negara: 'CN - CHINA'
            },
            pembeli: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0123456789012345',
                nitku: '0123456789012345000000',
                nama: 'PT. PEMBELI MITRA TEKNIK',
                alamat: 'Jl. Merdeka Barat No. 100, Jakarta Pusat',
                negara: 'ID - INDONESIA'
            },
            pemilikBarang: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '9876543210987654',
                nitku: '9876543210987654000000',
                nama: 'PT. PEMILIK ASET SENTOSA',
                alamat: 'Kawasan Industri Pulogadung Blok B',
                afiliasi: 'HUB - Berhubungan'
            },
            penerima: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '5566778899001122',
                nitku: '5566778899001122000000',
                nama: 'PT. PENERIMA KONSINYASI INDO',
                alamat: 'Jl. Tanjung Priok Pelabuhan No. 5',
                negara: 'ID - INDONESIA',
                status: 'API-U',
                ijinBpNo: 'BP-BTM-2026-0045',
                ijinBpTgl: '2026-05-15'
            },
            penjual: {
                jenisIdentitas: '4 - LAINNYA',
                nomorIdentitas: 'SELLER-CORP-888',
                nama: 'BEIJING TRADING VENTURES LLC',
                alamat: 'Chaoyang District, Beijing, China',
                negara: 'CN - CHINA'
            },
            ppjk: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0026923485215000',
                nitku: '0026923485215000000000',
                nama: 'PT. SARANA PPJK LOGISTIK PRIMA',
                alamat: 'Jl. Enggano No. 40, Tanjung Priok'
            }
        }
    };

    // Load initial
    window.loadPibDraftData(originalDraft, false);
    const collected1 = window.collectPibFormData();
    
    // JSON serialize and parse
    const serialized = JSON.stringify(collected1);
    const deserialized = JSON.parse(serialized);

    // Obliterate the DOM (clear all input fields)
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(el => { el.value = ''; });

    // Restore from parsed JSON
    window.loadPibDraftData(deserialized, false);
    const collected2 = window.collectPibFormData();

    // Verify 100% roundtrip fidelity across all 6 cards
    assert.deepStrictEqual(collected2.entitas.pengirim, collected1.entitas.pengirim, 'Pengirim must match 100%');
    assert.deepStrictEqual(collected2.entitas.pembeli, collected1.entitas.pembeli, 'Pembeli must match 100%');
    assert.deepStrictEqual(collected2.entitas.pemilikBarang, collected1.entitas.pemilikBarang, 'PemilikBarang must match 100%');
    assert.deepStrictEqual(collected2.entitas.penerima, collected1.entitas.penerima, 'Penerima must match 100%');
    assert.deepStrictEqual(collected2.entitas.penjual, collected1.entitas.penjual, 'Penjual must match 100%');
    assert.deepStrictEqual(collected2.entitas.ppjk, collected1.entitas.ppjk, 'PPJK must match 100%');

    // Verify root aliases match
    assert.strictEqual(collected2.importirName, collected1.importirName);
    assert.strictEqual(collected2.supplierName, collected1.supplierName);
    assert.strictEqual(collected2.ownerName, collected1.ownerName);
    assert.strictEqual(collected2.sellerName, collected1.sellerName);
});

test('Roundtrip 3.2: Special characters, quotes, ampersands, unicode, and multi-line strings survive intact', () => {
    const { window, document } = setupEnv();

    const complexDraft = {
        entitas: {
            pengirim: {
                jenisIdentitas: '4 - LAINNYA',
                nomorIdentitas: 'XYZ"&<>\'#1',
                nama: 'MÜLLER & SÖHNE GMBH & CO. KG',
                alamat: 'Industriestraße 12-14\nGebäude B, 2. Stock\n80331 München\nGERMANY',
                negara: 'DE - GERMANY'
            },
            penerima: {
                jenisIdentitas: '6 - NPWP 16 DIGIT',
                nomorIdentitas: '0123456789012345',
                nitku: '0123456789012345000000',
                nama: 'PT. "ANEKA JAYA & ABADI" (PERSERO) TBK.',
                alamat: 'Komplek Pergudangan "KENCANA" Blok A-1, No. 12 & 14\nRT. 001 / RW. 002\nJakarta Utara',
                negara: 'ID - INDONESIA',
                status: 'AEO',
                ijinBpNo: 'BP/2026/XI-001/A&B',
                ijinBpTgl: '2026-12-31'
            }
        }
    };

    window.loadPibDraftData(complexDraft, false);
    const c1 = window.collectPibFormData();
    
    // Clear and restore
    document.querySelectorAll('input, select, textarea').forEach(el => el.value = '');
    window.loadPibDraftData(c1, false);
    const c2 = window.collectPibFormData();

    assert.strictEqual(c2.entitas.pengirim.nama, 'MÜLLER & SÖHNE GMBH & CO. KG');
    assert.strictEqual(c2.entitas.pengirim.alamat, 'Industriestraße 12-14\nGebäude B, 2. Stock\n80331 München\nGERMANY');
    assert.strictEqual(c2.entitas.penerima.nama, 'PT. "ANEKA JAYA & ABADI" (PERSERO) TBK.');
    assert.strictEqual(c2.entitas.penerima.alamat, 'Komplek Pergudangan "KENCANA" Blok A-1, No. 12 & 14\nRT. 001 / RW. 002\nJakarta Utara');
    assert.strictEqual(c2.entitas.penerima.ijinBpNo, 'BP/2026/XI-001/A&B');
});

test('Roundtrip 3.3: Cleared Pembeli (empty string) survives roundtrip without erroneously cascading from Penerima', () => {
    const { window, document } = setupEnv();
    
    // Set Penerima
    document.getElementById('pibPenerimaName').value = 'PT. PENERIMA ASLI';
    
    // Emptied Pembeli
    document.getElementById('btnHapusPembeli').click();
    assert.strictEqual(document.getElementById('pibPembeliName').value, '');

    // Collect data
    const collected = window.collectPibFormData();
    assert.strictEqual(collected.entitas.pembeli.nama, '');
    assert.strictEqual(collected.entitas.pembeli.nomorIdentitas, '');

    // Reload from collected data
    window.loadPibDraftData(collected, false);

    // Verify Pembeli did NOT cascade from Penerima
    assert.strictEqual(document.getElementById('pibPembeliName').value, '', 'Pembeli should remain empty and not cascade when explicitly empty string');
    assert.strictEqual(document.getElementById('pibPembeliId').value, '', 'Pembeli ID should remain empty');
});

test('Roundtrip 3.4: Omitted entities correctly cascade from counterparts when loading unpopulated draft', () => {
    const { window, document } = setupEnv();

    const partialDraft = {
        entitas: {
            pengirim: {
                nama: 'TOKYO SHIPPERS CO',
                alamat: 'Tokyo, Japan',
                negara: 'JP - JAPAN'
            },
            penerima: {
                nama: 'PT. JAKARTA IMPOR MANDIRI',
                alamat: 'Jl. Merdeka No. 1',
                nomorIdentitas: '1234567890123456',
                nitku: '1234567890123456000000',
                negara: 'ID - INDONESIA'
            }
            // pembeli, pemilikBarang, penjual are omitted
        }
    };

    window.loadPibDraftData(partialDraft, false);

    // Pembeli should cascade from Penerima
    assert.strictEqual(document.getElementById('pibPembeliName').value, 'PT. JAKARTA IMPOR MANDIRI');
    assert.strictEqual(document.getElementById('pibPembeliAddress').value, 'Jl. Merdeka No. 1');
    assert.strictEqual(document.getElementById('pibPembeliId').value, '1234567890123456');

    // Pemilik should cascade from Penerima
    assert.strictEqual(document.getElementById('pibPemilikName').value, 'PT. JAKARTA IMPOR MANDIRI');
    assert.strictEqual(document.getElementById('pibPemilikAfiliasi').value, 'TAH - Tidak berhubungan');

    // Penjual should cascade from Pengirim
    assert.strictEqual(document.getElementById('pibPenjualName').value, 'TOKYO SHIPPERS CO');
    assert.strictEqual(document.getElementById('pibPenjualCountry').value, 'JP - JAPAN');
});

test('Roundtrip 3.5: Sinar Asia pack business rule correctly activates and sets Golden Ben Singapore', () => {
    const { window, document } = setupEnv();

    const sinarDraft = {
        importirName: 'PT. Sinar Asia Pack',
        supplierName: ''
    };

    window.loadPibDraftData(sinarDraft, false);

    assert.strictEqual(document.getElementById('pibPenerimaName').value, 'PT. SINAR ASIA PACK');
    assert.strictEqual(document.getElementById('pibPengirimName').value, 'GOLDEN BEN PRINTER PTE LTD');
    assert.strictEqual(document.getElementById('pibPengirimCountry').value, 'SG - SINGAPORE');
});

test('Roundtrip 3.6: Numeric values in draft data are safely coerced to strings without crashing', () => {
    const { window, document } = setupEnv();

    const numericDraft = {
        entitas: {
            pengirim: {
                nama: 123456,
                alamat: 7890,
                negara: 'CN - CHINA'
            },
            penerima: {
                nama: 'PT. NUMERIC TEST',
                nomorIdentitas: 1234567890123456,
                nitku: 1234567890123456000000
            }
        }
    };

    window.loadPibDraftData(numericDraft, false);

    assert.strictEqual(document.getElementById('pibPengirimName').value, '123456');
    assert.strictEqual(document.getElementById('pibPengirimAddress').value, '7890');
    assert.strictEqual(document.getElementById('pibPenerimaId').value, '1234567890123456');
});

test('Roundtrip 3.7: Nullish values do not become literal string "null" or "undefined"', () => {
    const { window, document } = setupEnv();

    const nullDraft = {
        entitas: {
            pengirim: {
                nama: null,
                alamat: null,
                nomorIdentitas: null
            },
            penerima: {
                nama: null,
                alamat: null,
                ijinBpNo: null
            }
        }
    };

    window.loadPibDraftData(nullDraft, false);

    assert.notStrictEqual(document.getElementById('pibPengirimName').value, 'null');
    assert.notStrictEqual(document.getElementById('pibPengirimAddress').value, 'null');
    assert.notStrictEqual(document.getElementById('pibPenerimaIjinNo').value, 'null');
});


// =========================================================================
// SECTION 4: DOM INTEGRITY & CEISA 4.0 SPEC COMPLIANCE
// =========================================================================
console.log('\n--- Section 4: DOM Integrity & CEISA 4.0 Spec Compliance ---');

test('DOM 4.1: Legacy .ceisa-doc-topbar is 100% removed from pib.html', () => {
    const { document } = setupEnv();
    const topbar = document.querySelector('.ceisa-doc-topbar');
    assert.strictEqual(topbar, null, '.ceisa-doc-topbar must be completely removed');

    const btnKembali = document.getElementById('btnPibKembali');
    const btnUpdate = document.getElementById('btnPibUpdateData');
    assert.strictEqual(btnKembali, null, '#btnPibKembali must be removed');
    assert.strictEqual(btnUpdate, null, '#btnPibUpdateData must be removed');
});

test('DOM 4.2: Legacy single-column PPJK card (#pibPpjkNpwp) is 100% removed', () => {
    const { document } = setupEnv();
    const oldPpjk = document.getElementById('pibPpjkNpwp');
    assert.strictEqual(oldPpjk, null, 'Old #pibPpjkNpwp element must be removed');
});

test('DOM 4.3: 2-column grid layout exists with exactly 3 cards in left column and 3 cards in right column', () => {
    const { document } = setupEnv();
    const grid = document.querySelector('.ceisa-entitas-grid');
    assert(grid, '.ceisa-entitas-grid container must exist');

    const colLeft = grid.querySelector('.ceisa-entitas-col-left');
    const colRight = grid.querySelector('.ceisa-entitas-col-right');
    assert(colLeft, '.ceisa-entitas-col-left must exist');
    assert(colRight, '.ceisa-entitas-col-right must exist');

    const leftCards = colLeft.querySelectorAll('.ceisa-form-card');
    const rightCards = colRight.querySelectorAll('.ceisa-form-card');

    assert.strictEqual(leftCards.length, 3, 'Left column must contain exactly 3 cards');
    assert.strictEqual(rightCards.length, 3, 'Right column must contain exactly 3 cards');

    // Verify ordering
    const leftTitles = Array.from(leftCards).map(c => c.querySelector('.ceisa-card-title')?.textContent.trim());
    const rightTitles = Array.from(rightCards).map(c => c.querySelector('.ceisa-card-title')?.textContent.trim());

    assert(leftTitles[0].startsWith('Pengirim'), `Left Card 1 should be Pengirim, got ${leftTitles[0]}`);
    assert(leftTitles[1].startsWith('Pembeli'), `Left Card 2 should be Pembeli, got ${leftTitles[1]}`);
    assert(leftTitles[2].startsWith('Pemilik Barang'), `Left Card 3 should be Pemilik Barang, got ${leftTitles[2]}`);

    assert(rightTitles[0].startsWith('Penerima'), `Right Card 1 should be Penerima, got ${rightTitles[0]}`);
    assert(rightTitles[1].startsWith('Penjual'), `Right Card 2 should be Penjual, got ${rightTitles[1]}`);
    assert(rightTitles[2].startsWith('PPJK'), `Right Card 3 should be PPJK, got ${rightTitles[2]}`);
});

test('DOM 4.4: Stepper navigation buttons exist at the bottom of Tab Entitas and switch tabs', () => {
    const { window, document } = setupEnv();
    const btnPrev = document.getElementById('btnPrevFromPibEntitas');
    const btnNext = document.getElementById('btnNextFromPibEntitas');

    assert(btnPrev, '#btnPrevFromPibEntitas must exist');
    assert(btnNext, '#btnNextFromPibEntitas must exist');

    if (typeof window.initPibDashboard === 'function') window.initPibDashboard();

    window.switchPibTab('pib-tab-entitas');
    btnPrev.click();
    assert.strictEqual(document.querySelector('.tab-content-panel.active')?.id, 'pib-tab-header', 'btnPrevFromPibEntitas must switch to pib-tab-header');

    window.switchPibTab('pib-tab-entitas');
    btnNext.click();
    assert.strictEqual(document.querySelector('.tab-content-panel.active')?.id, 'pib-tab-dokumen', 'btnNextFromPibEntitas must switch to pib-tab-dokumen');
});

test('CSS 4.5: dashboard.css contains responsive grid and media query for stacking below 900px', () => {
    const cssPath = path.resolve(__dirname, '../dashboard.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert(cssContent.includes('.ceisa-entitas-grid'), 'dashboard.css must declare .ceisa-entitas-grid');
    assert(cssContent.includes('1fr 1fr') || cssContent.includes('repeat(2'), 'Grid must specify 2 columns');
    assert(cssContent.includes('@media') && cssContent.includes('900px'), 'Responsive media query must exist for 900px');
});


// =========================================================================
// SECTION 5: DOWNSTREAM INTEGRATION & DEFECT DETECTION MATRIX
// =========================================================================
console.log('\n--- Section 5: Downstream Integration & Defect Verification ---');

test('Defect 5.1: calculatePibPungutan must react to pibPenerimaStatus (NON-API -> 7.5% PPh)', () => {
    const { window, document } = setupEnv();

    // Set standard pricing inputs: CIF IDR = 100,000,000, BM = 0%, Nilai Impor = 100,000,000
    document.getElementById('pibInvoiceAmount').value = 10000;
    document.getElementById('pibExchangeRate').value = 10000; // CIF IDR = 100,000,000
    document.getElementById('pibFreightAmount').value = 0;
    document.getElementById('pibInsuranceAmount').value = 0;
    document.getElementById('pibTarifBm').value = 0;

    // Case A: API-U -> PPh rate 2.5% = 2,500,000
    document.getElementById('pibPenerimaStatus').value = 'API-U';
    window.calculatePibPungutan();
    const pphApiU = document.getElementById('pibPungutanNilaiPph')?.value;

    // Case B: NON-API -> PPh rate 7.5% = 7,500,000
    document.getElementById('pibPenerimaStatus').value = 'NON-API';
    window.calculatePibPungutan();
    const pphNonApi = document.getElementById('pibPungutanNilaiPph')?.value;

    // CHALLENGE: If calculatePibPungutan still references old #pibImportirStatus, pphNonApi will equal pphApiU
    assert.notStrictEqual(pphNonApi, pphApiU, 'PPh for NON-API must differ from API-U (7.5% vs 2.5%)');
    assert(pphNonApi.includes('7.500.000') || pphNonApi.includes('7,500,000'), `Expected NON-API PPh to be 7,500,000, got ${pphNonApi}`);
});

test('Defect 5.2: Adding a new item in Tab Barang must adopt countryOfOrigin from pibPengirimCountry', () => {
    const { window, document } = setupEnv();
    if (typeof window.initPibDashboard === 'function') window.initPibDashboard();

    // Set Pengirim country to JP - JAPAN
    document.getElementById('pibPengirimCountry').value = 'JP - JAPAN';

    const btnAdd = document.getElementById('btnPibAddItem');
    assert(btnAdd, '#btnPibAddItem must exist');
    btnAdd.click();

    const lastItem = window._pibItems[window._pibItems.length - 1];
    assert(lastItem, 'Item must be created');
    
    // CHALLENGE: If btnAddItem still references old #pibSupplierCountry, lastItem.countryOfOrigin will be 'CN - CHINA'
    assert.strictEqual(lastItem.countryOfOrigin, 'JP - JAPAN', `Expected new item country to be JP - JAPAN from pibPengirimCountry, got ${lastItem.countryOfOrigin}`);
});

// Summary
const total = results.length;
const passed = results.filter(r => r.status === 'PASSED').length;
const failed = results.filter(r => r.status === 'FAILED').length;

console.log('\n' + '='.repeat(80));
console.log(`STRESS TEST SUMMARY: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
if (failed > 0) {
    console.error(`FAILED TESTS: ${failed}`);
    process.exit(1);
} else {
    console.log('ALL EMPIRICAL STRESS TESTS PASSED CLEANLY.');
    process.exit(0);
}
