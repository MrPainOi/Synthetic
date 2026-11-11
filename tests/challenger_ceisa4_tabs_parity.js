const assert = require('assert');
const path = require('path');
const {
    loadPibDom,
    loadPibDashboardScript
} = require('./e2e/helpers/dom_env');

console.log('================================================================');
console.log('  CHALLENGER CEISA 4.0 TABS PARITY: PENGANGKUT, KEMASAN, TRANSAKSI');
console.log('================================================================');

const dom = loadPibDom();
const { window } = dom;
const { document } = window;

loadPibDashboardScript(window);

let passed = 0;
let failed = 0;

function it(name, fn) {
    try {
        fn();
        console.log(`  ✓ [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ [FAIL] ${name}`);
        console.error(`    -> ${err.message}`);
        failed++;
    }
}

// SUITE 1: TAB PENGANGKUT
console.log('\n--- SUITE 1: TAB PENGANGKUT DOM & FIELD STRUCTURE ---');
it('1.1 Grid is 3-column .ceisa-3col-grid', () => {
    const tab = document.getElementById('pib-tab-pengangkut');
    assert.ok(tab, 'Tab Pengangkut exists');
    const grid = tab.querySelector('.ceisa-3col-grid');
    assert.ok(grid, '.ceisa-3col-grid exists in Tab Pengangkut');
    assert.strictEqual(grid.querySelectorAll('.ceisa-form-card').length, 3, 'Contains exactly 3 cards');
});

it('1.2 Card 1: BC 1.1 fields match CEISA 4.0 photo', () => {
    assert.ok(document.getElementById('pibTutupPuType'), 'pibTutupPuType exists');
    assert.ok(document.getElementById('pibNomorTutupPu'), 'pibNomorTutupPu exists');
    assert.ok(document.getElementById('pibTanggalTutupPu'), 'pibTanggalTutupPu exists');
    assert.ok(document.getElementById('pibTanggalBc11'), 'pibTanggalBc11 exists');
    assert.ok(document.getElementById('pibNomorPos1'), 'pibNomorPos1 exists');
    assert.ok(document.getElementById('pibNomorPos2'), 'pibNomorPos2 exists');
    assert.ok(document.getElementById('pibNomorPos3'), 'pibNomorPos3 exists');
});

it('1.3 Card 2: Pengangkutan fields match CEISA 4.0 photo', () => {
    assert.ok(document.getElementById('pibCaraPengangkutan'), 'pibCaraPengangkutan exists');
    assert.ok(document.getElementById('pibVesselName'), 'pibVesselName exists');
    assert.ok(document.getElementById('pibVoyageNumber'), 'pibVoyageNumber exists');
    assert.ok(document.getElementById('pibVesselFlag'), 'pibVesselFlag exists');
    assert.ok(document.getElementById('pibEtaDate'), 'pibEtaDate exists');
});

it('1.4 Card 3: Pelabuhan & Tempat Penimbunan fields match CEISA 4.0 photo', () => {
    assert.ok(document.getElementById('pibPortLoading'), 'pibPortLoading exists');
    assert.ok(document.getElementById('pibPortTransit'), 'pibPortTransit exists');
    assert.ok(document.getElementById('pibPortDischarge'), 'pibPortDischarge exists');
    assert.ok(document.getElementById('pibTpsLocation'), 'pibTpsLocation exists');
    assert.ok(document.getElementById('pibLokasiPemeriksaan'), 'pibLokasiPemeriksaan exists');
});

it('1.5 Tab Pengangkut has stepper navigation footer', () => {
    assert.ok(document.getElementById('btnPrevFromPibPengangkut'), 'btnPrevFromPibPengangkut exists');
    assert.ok(document.getElementById('btnNextFromPibPengangkut'), 'btnNextFromPibPengangkut exists');
});

// SUITE 2: TAB KEMASAN & PETI KEMAS
console.log('\n--- SUITE 2: TAB KEMASAN & PETI KEMAS DOM & FIELD STRUCTURE ---');
it('2.1 Grid is 2-column .ceisa-2col-grid', () => {
    const tab = document.getElementById('pib-tab-kemasan');
    assert.ok(tab, 'Tab Kemasan exists');
    const grid = tab.querySelector('.ceisa-2col-grid');
    assert.ok(grid, '.ceisa-2col-grid exists in Tab Kemasan');
    assert.strictEqual(grid.querySelectorAll('.ceisa-form-card').length, 2, 'Contains exactly 2 cards');
});

it('2.2 Left Card: Kemasan table, filter row, actions, and pagination exist', () => {
    assert.ok(document.getElementById('btnSortPibKemasan'), 'btnSortPibKemasan exists');
    assert.ok(document.getElementById('btnAddPibKemasan'), 'btnAddPibKemasan exists');
    assert.ok(document.getElementById('pibKemasanTableBody'), 'pibKemasanTableBody exists');
    assert.ok(document.getElementById('pibKemasanTotal'), 'pibKemasanTotal exists');
});

it('2.3 Right Card: Peti Kemas table, filter row, actions, empty state, and pagination exist', () => {
    assert.ok(document.getElementById('btnSortPibPetiKemas'), 'btnSortPibPetiKemas exists');
    assert.ok(document.getElementById('btnAddPibPetiKemas'), 'btnAddPibPetiKemas exists');
    assert.ok(document.getElementById('pibPetiKemasTableBody'), 'pibPetiKemasTableBody exists');
    assert.ok(document.getElementById('pibPetiKemasTotal'), 'pibPetiKemasTotal exists');
});

it('2.4 Tab Kemasan has stepper navigation footer', () => {
    assert.ok(document.getElementById('btnPrevFromPibKemasan'), 'btnPrevFromPibKemasan exists');
    assert.ok(document.getElementById('btnNextFromPibKemasan'), 'btnNextFromPibKemasan exists');
});

// SUITE 3: TAB TRANSAKSI
console.log('\n--- SUITE 3: TAB TRANSAKSI DOM & FIELD STRUCTURE ---');
it('3.1 Top action: Detail Barang button exists', () => {
    assert.ok(document.getElementById('btnPibDetailBarang'), 'btnPibDetailBarang exists');
});

it('3.2 Grid is 3-column .ceisa-3col-grid', () => {
    const tab = document.getElementById('pib-tab-transaksi');
    assert.ok(tab, 'Tab Transaksi exists');
    const grid = tab.querySelector('.ceisa-3col-grid');
    assert.ok(grid, '.ceisa-3col-grid exists in Tab Transaksi');
    assert.strictEqual(grid.querySelectorAll('.ceisa-form-card').length, 3, 'Contains exactly 3 cards');
});

it('3.3 Card 1: Harga fields match CEISA 4.0 photo', () => {
    assert.ok(document.getElementById('pibCurrency'), 'pibCurrency exists');
    assert.ok(document.getElementById('pibExchangeRate'), 'pibExchangeRate exists');
    assert.ok(document.getElementById('pibJenisTransaksi'), 'pibJenisTransaksi exists');
    assert.ok(document.getElementById('pibJenisTransaksiLainnya'), 'pibJenisTransaksiLainnya exists');
    assert.ok(document.getElementById('pibIncoterm'), 'pibIncoterm exists');
    assert.ok(document.getElementById('pibInvoiceAmount'), 'pibInvoiceAmount exists');
    assert.ok(document.getElementById('pibCifIdr'), 'pibCifIdr exists');
});

it('3.4 Card 2: Harga Lainnya fields match CEISA 4.0 photo', () => {
    assert.ok(document.getElementById('pibBiayaPenambah'), 'pibBiayaPenambah exists');
    assert.ok(document.getElementById('pibBiayaPengurang'), 'pibBiayaPengurang exists');
    assert.ok(document.getElementById('pibFreightAmount'), 'pibFreightAmount exists');
    assert.ok(document.getElementById('pibInsuranceType'), 'pibInsuranceType exists');
    assert.ok(document.getElementById('pibInsuranceAmount'), 'pibInsuranceAmount exists');
    assert.ok(document.getElementById('pibVoluntaryDeclaration'), 'pibVoluntaryDeclaration exists');
    assert.ok(document.getElementById('pibFobTransaksi'), 'pibFobTransaksi exists');
});

it('3.5 Card 3: Berat fields match CEISA 4.0 photo', () => {
    assert.ok(document.getElementById('pibGrossWeight'), 'pibGrossWeight exists');
    assert.ok(document.getElementById('pibNetWeight'), 'pibNetWeight exists');
    assert.ok(document.getElementById('btnSyncNettoBarang'), 'btnSyncNettoBarang exists');
    assert.ok(document.getElementById('pibVolume'), 'pibVolume exists');
});

it('3.6 Tab Transaksi has stepper navigation footer', () => {
    assert.ok(document.getElementById('btnPrevFromPibTransaksi'), 'btnPrevFromPibTransaksi exists');
    assert.ok(document.getElementById('btnNextFromPibTransaksi'), 'btnNextFromPibTransaksi exists');
});

// SUITE 4: DATA POPULATION & BEHAVIOR
console.log('\n--- SUITE 4: FUNCTIONAL SCRIPT VERIFICATION ---');
it('4.1 loadPibDraftData populates Pengangkut, Kemasan, and Transaksi fields', () => {
    const testDraft = {
        tutupPuType: 'BC 1.1',
        nomorTutupPu: '123456',
        tanggalTutupPu: '2026-11-12',
        tanggalBc11: '2026-11-12',
        nomorPos1: '0001',
        nomorPos2: '0002',
        nomorPos3: '0003',
        caraPengangkutan: '1 - LAUT',
        vesselName: 'KM CEISA TESTER',
        voyageNumber: 'V-999',
        vesselFlag: 'ID - INDONESIA',
        etaDate: '2026-11-15',
        portLoading: 'SGJUR - JURONG',
        portTransit: 'SGJUR - JURONG',
        portDischarge: 'IDSKP - SEKUPANG',
        tpsLocation: 'BTI0 - SEWU',
        lokasiPemeriksaan: '4 - TEMPAT PENIMBUNAN SEMENTARA',
        packageType: 'CT - CARTON',
        packageQty: 50,
        currency: 'JPY - YEN',
        exchangeRate: 114.5961,
        jenisTransaksi: '15 - LAINNYA',
        jenisTransaksiLainnya: 'SPECIAL CARGO',
        incoterm: 'FCA - FREE CARRIER',
        invoiceAmount: 18137.32,
        grossWeight: 153.9,
        netWeight: 66.468,
        volume: 2.5
    };

    window.loadPibDraftData(testDraft, false);

    assert.strictEqual(document.getElementById('pibNomorTutupPu').value, '123456');
    assert.strictEqual(document.getElementById('pibNomorPos1').value, '0001');
    assert.strictEqual(document.getElementById('pibVesselName').value, 'KM CEISA TESTER');
    assert.strictEqual(document.getElementById('pibPortLoading').value, 'SGJUR - JURONG');
    assert.strictEqual(document.getElementById('pibJenisTransaksiLainnya').value, 'SPECIAL CARGO');
    assert.strictEqual(document.getElementById('pibGrossWeight').value, '153.9');
    assert.strictEqual(document.getElementById('pibVolume').value, '2.5');
});

it('4.2 collectPibFormData collects all newly introduced fields', () => {
    const collected = window.collectPibFormData();
    assert.strictEqual(collected.nomorTutupPu, '123456');
    assert.strictEqual(collected.nomorPos1, '0001');
    assert.strictEqual(collected.vesselName, 'KM CEISA TESTER');
    assert.strictEqual(collected.jenisTransaksiLainnya, 'SPECIAL CARGO');
    assert.strictEqual(collected.volume, 2.5);
    assert.ok(Array.isArray(collected.kemasan), 'kemasan is array');
    assert.ok(Array.isArray(collected.petiKemas), 'petiKemas is array');
});

it('4.3 btnSyncNettoBarang calculates sum of item netto correctly', () => {
    window._pibItems = [
        { netto: 30.25 },
        { netto: 36.218 }
    ];
    document.getElementById('btnSyncNettoBarang').click();
    assert.strictEqual(document.getElementById('pibNetWeight').value, '66.4680');
});

it('4.4 calculatePibPungutan computes FOB and CIF IDR matching reference math', () => {
    document.getElementById('pibInvoiceAmount').value = '18137.32';
    document.getElementById('pibExchangeRate').value = '114.5961';
    document.getElementById('pibFreightAmount').value = '0';
    document.getElementById('pibInsuranceAmount').value = '0';
    document.getElementById('pibIncoterm').value = 'FCA - FREE CARRIER';

    window.calculatePibPungutan();

    const expectedCif = Number(18137.32 * 114.5961).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    assert.strictEqual(document.getElementById('pibFobTransaksi').value, '18,137.32');
    assert.strictEqual(document.getElementById('pibCifIdr').value, expectedCif);
});

console.log('\n================================================================');
console.log(`  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) process.exit(1);
