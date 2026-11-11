/**
 * CHALLENGER AUTO-FILL TOGGLE TEST SUITE
 * 
 * Verifies that the new toggle (on/off) system allows users to selectively configure
 * which sections and entity sub-cards are auto-filled to CEISA 4.0.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadContentScriptFunctions } = require('./e2e/helpers/dom_env');

console.log('================================================================');
console.log('  CHALLENGER CEISA 4.0 AUTO-FILL TOGGLE VERIFICATION');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(description, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✓ [PASS] ${description}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ [FAIL] ${description}`);
        console.error(`    Error: ${err.message}`);
    }
}

// -----------------------------------------------------------------------------
// SETUP JSDOM WITH CONTENT.JS
// -----------------------------------------------------------------------------
const popupHtmlCode = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
const pibHtmlCode = fs.readFileSync(path.join(__dirname, '..', 'pib.html'), 'utf8');

function createCeisaDom() {
    const html = `
    <!DOCTYPE html>
    <html>
    <body>
        <div id="portal-root">
            <!-- Header Tab -->
            <input id="sec_noAju" name="nomorAju" />
            <input id="sec_kantor" name="kodeKantor" />

            <!-- Entitas Cards -->
            <div class="ant-card card-pengirim">
                <div class="ant-card-head-title">Pengirim</div>
                <input id="c_pengirim_nama" name="nama" />
                <input id="c_pengirim_id" name="nomorIdentitas" />
            </div>

            <div class="ant-card card-penerima">
                <div class="ant-card-head-title">Penerima</div>
                <input id="c_penerima_nama" name="nama" />
                <input id="c_penerima_id" name="nomorIdentitas" />
            </div>

            <div class="ant-card card-pembeli">
                <div class="ant-card-head-title">Pembeli</div>
                <input id="c_pembeli_nama" name="nama" />
            </div>

            <div class="ant-card card-penjual">
                <div class="ant-card-head-title">Penjual</div>
                <input id="c_penjual_nama" name="nama" />
            </div>

            <div class="ant-card card-pemilik">
                <div class="ant-card-head-title">Pemilik Barang</div>
                <input id="c_pemilik_nama" name="nama" />
            </div>

            <div class="ant-card card-ppjk">
                <div class="ant-card-head-title">PPJK</div>
                <input id="c_ppjk_nama" name="nama" />
                <input id="c_ppjk_id" name="nomorIdentitas" />
                <input id="c_ppjk_alamat" name="alamat" />
            </div>

            <!-- Dokumen Tab -->
            <input id="sec_docNum" name="nomorDokumen" />
            <input id="sec_docCode" name="kodeDokumen" />

            <!-- Pengangkut Tab -->
            <input id="sec_vessel" name="namaSaranaPengangkut" />

            <!-- Kemasan Tab -->
            <input id="sec_kemasanType" name="jenisKemasan" />
            <input id="sec_kemasanQty" name="jumlahKemasan" />

            <!-- Transaksi Tab -->
            <input id="sec_valuta" name="kodeValuta" />
            <input id="sec_invAmt" name="nilaiTransaksi" />

            <!-- Barang Tab -->
            <input id="sec_hs" name="posTarif" />
            <input id="sec_desc" name="uraian" />

            <!-- Pungutan Tab -->
            <input id="sec_cifRp" name="nilaiPabean" />
            <input id="sec_bm" name="beaMasuk" />
            <input id="sec_ppn" name="ppn" />
            <input id="sec_billing" name="totalBilling" />

            <!-- Pernyataan Tab -->
            <input id="sec_kota" name="kotaPernyataan" />
            <input id="sec_pernyataanNama" name="namaPemberitahu" />
            <input id="sec_pernyataanJab" name="jabatanPemberitahu" />
            <input id="sec_pernyataanAgree" type="checkbox" name="setuju" />
        </div>
    </body>
    </html>
    `;

    const dom = new JSDOM(html, { runScripts: "outside-only", url: 'https://portal.beacukai.go.id' });
    loadContentScriptFunctions(dom.window);
    return dom;
}

// -----------------------------------------------------------------------------
// SUITE 1: DOM PRESENCE IN POPUP AND PIB
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: UI DOM TOGGLE CONTROLS ---');

test('1.1 popup.html contains #cardAutofillConfig and collapse header', () => {
    const dom = new JSDOM(popupHtmlCode);
    const card = dom.window.document.getElementById('cardAutofillConfig');
    assert(card, 'Card #cardAutofillConfig must exist in popup.html');
    assert(dom.window.document.getElementById('btnToggleAfCollapse'), '#btnToggleAfCollapse must exist');
    assert(dom.window.document.getElementById('lblAfActiveCount'), '#lblAfActiveCount badge must exist');
});

test('1.2 popup.html contains all 9 section toggles and 6 entity sub-toggles', () => {
    const dom = new JSDOM(popupHtmlCode);
    const toggles = [
        'afToggle_header',
        'afToggle_entitas',
        'afToggle_entitas_pengirim',
        'afToggle_entitas_penerima',
        'afToggle_entitas_pembeli',
        'afToggle_entitas_penjual',
        'afToggle_entitas_pemilik',
        'afToggle_entitas_ppjk',
        'afToggle_dokumen',
        'afToggle_pengangkut',
        'afToggle_kemasan',
        'afToggle_transaksi',
        'afToggle_barang',
        'afToggle_pungutan',
        'afToggle_pernyataan'
    ];
    toggles.forEach(id => {
        assert(dom.window.document.getElementById(id), `Toggle #${id} must exist in popup.html`);
    });
});

test('1.3 popup.html defaults PPJK and Pungutan to unchecked, others checked', () => {
    const dom = new JSDOM(popupHtmlCode);
    assert.strictEqual(dom.window.document.getElementById('afToggle_entitas_ppjk').checked, false, 'PPJK toggle must be unchecked by default');
    assert.strictEqual(dom.window.document.getElementById('afToggle_pungutan').checked, false, 'Pungutan toggle must be unchecked by default');
    assert.strictEqual(dom.window.document.getElementById('afToggle_header').checked, true, 'Header toggle must be checked by default');
    assert.strictEqual(dom.window.document.getElementById('afToggle_entitas').checked, true, 'Entitas toggle must be checked by default');
    assert.strictEqual(dom.window.document.getElementById('afToggle_barang').checked, true, 'Barang toggle must be checked by default');
});

test('1.4 pib.html contains #btnPibAutofillSettings and #modalAutofillSettings', () => {
    const dom = new JSDOM(pibHtmlCode);
    assert(dom.window.document.getElementById('btnPibAutofillSettings'), '#btnPibAutofillSettings must exist in pib.html header');
    assert(dom.window.document.getElementById('modalAutofillSettings'), '#modalAutofillSettings modal must exist in pib.html');
});

// -----------------------------------------------------------------------------
// SUITE 2: PPJK TOGGLE BEHAVIOR
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: PPJK TOGGLE BEHAVIOR ---');

const testDraft = {
    header: { nomorAju: '010700-20261111-001', kodeKantor: '020400' },
    entitas: {
        pengirim: { nama: 'GLOBAL EXPORT LTD', nomorIdentitas: 'EXP-123' },
        penerima: { nama: 'PT IMPOR JAYA ABADI', nomorIdentitas: '01000111222000' },
        pembeli: { nama: 'PT PEMBELI NUSANTARA' },
        penjual: { nama: 'GLOBAL SELLER INC' },
        pemilikBarang: { nama: 'PT CARGO OWNER' },
        ppjk: { nama: 'PT SARANA PPJK TAMA', nomorIdentitas: '02000222333000', alamat: 'Jl. Pelabuhan No. 10' }
    },
    pungutan: {
        nilaiPabeanIdr: '500000000',
        nilaiBm: '25000000',
        nilaiPpn: '55000000',
        totalBilling: '80000000'
    },
    pernyataanNama: 'BAMBANG HERMANTO',
    pernyataanKota: 'Jakarta Utara',
    pernyataanJabatan: 'Kuasa Direksi'
};

test('2.1 Default: PPJK is NOT auto-filled when toggle is OFF', () => {
    const dom = createCeisaDom();
    const res = dom.window.handleCeisaAutoInputRow({
        item: testDraft,
        section: 'entitas'
    });
    assert(res.ok, 'Result ok should be true');
    assert.strictEqual(dom.window.document.getElementById('c_pengirim_nama').value, 'GLOBAL EXPORT LTD');
    assert.strictEqual(dom.window.document.getElementById('c_penerima_nama').value, 'PT IMPOR JAYA ABADI');
    assert.strictEqual(dom.window.document.getElementById('c_ppjk_nama').value, '', 'PPJK name must be empty by default');
});

test('2.2 When PPJK toggle is ON: PPJK IS populated with name, NPWP, and address', () => {
    const dom = createCeisaDom();
    const res = dom.window.handleCeisaAutoInputRow({
        item: testDraft,
        section: 'entitas',
        autofillConfig: {
            entitas: {
                enabled: true,
                pengirim: true,
                penerima: true,
                pembeli: true,
                penjual: true,
                pemilik: true,
                ppjk: true // User turned PPJK ON!
            }
        }
    });
    assert(res.ok, 'Result ok should be true');
    assert.strictEqual(dom.window.document.getElementById('c_ppjk_nama').value, 'PT SARANA PPJK TAMA');
    assert.strictEqual(dom.window.document.getElementById('c_ppjk_id').value, '02000222333000');
    assert.strictEqual(dom.window.document.getElementById('c_ppjk_alamat').value, 'Jl. Pelabuhan No. 10');
});

// -----------------------------------------------------------------------------
// SUITE 3: PUNGUTAN TOGGLE BEHAVIOR
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: PUNGUTAN TOGGLE BEHAVIOR ---');

test('3.1 Default: Pungutan is skipped when toggle is OFF', () => {
    const dom = createCeisaDom();
    const res = dom.window.handleCeisaAutoInputRow({
        item: testDraft,
        section: 'pungutan'
    });
    assert(res.ok, 'Result ok should be true');
    assert(res.skipped, 'Result skipped should be true');
    assert.strictEqual(dom.window.document.getElementById('sec_cifRp').value, '', 'Pungutan must not be filled by default');
});

test('3.2 When Pungutan toggle is ON: Pungutan fields ARE populated', () => {
    const dom = createCeisaDom();
    const res = dom.window.handleCeisaAutoInputRow({
        item: testDraft,
        section: 'pungutan',
        autofillConfig: {
            pungutan: true // User turned Pungutan ON!
        }
    });
    assert(res.ok, 'Result ok should be true');
    assert(!res.skipped, 'Result should not be skipped');
    assert.strictEqual(dom.window.document.getElementById('sec_cifRp').value, '500000000');
    assert.strictEqual(dom.window.document.getElementById('sec_bm').value, '25000000');
    assert.strictEqual(dom.window.document.getElementById('sec_ppn').value, '55000000');
    assert.strictEqual(dom.window.document.getElementById('sec_billing').value, '80000000');
});

// -----------------------------------------------------------------------------
// SUITE 4: SELECTIVE SECTION & SUB-ENTITY SKIPPING
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: SELECTIVE SECTION & SUB-ENTITY SKIPPING ---');

test('4.1 When Kemasan toggle is OFF: Kemasan section is skipped safely', () => {
    const dom = createCeisaDom();
    const res = dom.window.handleCeisaAutoInputRow({
        item: { packageType: 'CT - CARTON', packageQty: '100' },
        section: 'kemasan',
        autofillConfig: {
            kemasan: false // User turned Kemasan OFF!
        }
    });
    assert(res.ok, 'Result ok should be true');
    assert(res.skipped, 'Result skipped should be true');
    assert.strictEqual(dom.window.document.getElementById('sec_kemasanType').value, '', 'Kemasan should remain empty');
});

test('4.2 When Pembeli toggle is OFF: Pembeli card is skipped while Pengirim is filled', () => {
    const dom = createCeisaDom();
    const res = dom.window.handleCeisaAutoInputRow({
        item: testDraft,
        section: 'entitas',
        autofillConfig: {
            entitas: {
                enabled: true,
                pengirim: true,
                penerima: true,
                pembeli: false, // User turned Pembeli OFF!
                penjual: true,
                pemilik: true,
                ppjk: false
            }
        }
    });
    assert(res.ok, 'Result ok should be true');
    assert.strictEqual(dom.window.document.getElementById('c_pengirim_nama').value, 'GLOBAL EXPORT LTD');
    assert.strictEqual(dom.window.document.getElementById('c_pembeli_nama').value, '', 'Pembeli must be empty when toggle is OFF');
});

test('4.3 Pernyataan section auto-fills name, kota, jabatan and checks agreement', () => {
    const dom = createCeisaDom();
    const res = dom.window.handleCeisaAutoInputRow({
        item: testDraft,
        section: 'pernyataan',
        autofillConfig: { pernyataan: true }
    });
    assert(res.ok, 'Result ok should be true');
    assert.strictEqual(dom.window.document.getElementById('sec_pernyataanNama').value, 'BAMBANG HERMANTO');
    assert.strictEqual(dom.window.document.getElementById('sec_kota').value, 'Jakarta Utara');
    assert.strictEqual(dom.window.document.getElementById('sec_pernyataanJab').value, 'Kuasa Direksi');
    assert.strictEqual(dom.window.document.getElementById('sec_pernyataanAgree').checked, true);
});

// -----------------------------------------------------------------------------
// SUITE 5: REAL-TIME CEISA TAB AUTO-SYNC
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: REAL-TIME CEISA TAB AUTO-SYNC ---');

test('5.1 popup.html contains #lblCeisaAutoSyncBadge indicator', () => {
    const dom = new JSDOM(popupHtmlCode);
    const badge = dom.window.document.getElementById('lblCeisaAutoSyncBadge');
    assert(badge, '#lblCeisaAutoSyncBadge must exist in popup.html');
    assert(badge.textContent.includes('Ikuti Tab CEISA'), 'Badge must mention following CEISA tab');
});

test('5.2 detectCeisaActiveSection detects active tabs from real CEISA 4.0 tabbar', () => {
    const htmlWithTabs = `
    <!DOCTYPE html>
    <html>
    <body>
        <div class="ant-tabs-nav" role="tablist">
            <div class="ant-tabs-tab" role="tab">Header</div>
            <div class="ant-tabs-tab" role="tab">Entitas</div>
            <div class="ant-tabs-tab" role="tab">Dokumen</div>
            <div class="ant-tabs-tab ant-tabs-tab-active" role="tab">Pengangkut</div>
            <div class="ant-tabs-tab" role="tab">Kemasan & Peti Kemas</div>
            <div class="ant-tabs-tab" role="tab">Transaksi</div>
            <div class="ant-tabs-tab" role="tab">Barang</div>
            <div class="ant-tabs-tab" role="tab">Pungutan</div>
            <div class="ant-tabs-tab" role="tab">Pernyataan</div>
        </div>
    </body>
    </html>
    `;
    const dom = new JSDOM(htmlWithTabs, { runScripts: "outside-only", url: 'https://portal.beacukai.go.id' });
    loadContentScriptFunctions(dom.window);

    // Initial: Pengangkut is active
    let detected = dom.window.detectCeisaActiveSection();
    assert.strictEqual(detected, 'pengangkut', 'Should detect active tab "pengangkut"');

    // Switch active class to Transaksi
    const tabs = dom.window.document.querySelectorAll('.ant-tabs-tab');
    tabs[3].classList.remove('ant-tabs-tab-active');
    tabs[5].classList.add('ant-tabs-tab-active');
    detected = dom.window.detectCeisaActiveSection();
    assert.strictEqual(detected, 'transaksi', 'Should detect active tab "transaksi"');

    // Switch active class to Kemasan & Peti Kemas
    tabs[5].classList.remove('ant-tabs-tab-active');
    tabs[4].classList.add('ant-tabs-tab-active');
    detected = dom.window.detectCeisaActiveSection();
    assert.strictEqual(detected, 'kemasan', 'Should detect active tab "kemasan"');

    // Switch active class to Barang
    tabs[4].classList.remove('ant-tabs-tab-active');
    tabs[6].classList.add('ant-tabs-tab-active');
    detected = dom.window.detectCeisaActiveSection();
    assert.strictEqual(detected, 'barang', 'Should detect active tab "barang"');
});

test('5.3 switchCeisaActiveTab triggers click on target tab in CEISA portal', () => {
    const htmlWithTabs = `
    <!DOCTYPE html>
    <html>
    <body>
        <div class="ant-tabs-nav" role="tablist">
            <button class="ant-tabs-tab" id="tab_hdr" role="tab">Header</button>
            <button class="ant-tabs-tab" id="tab_ent" role="tab">Entitas</button>
            <button class="ant-tabs-tab" id="tab_dok" role="tab">Dokumen</button>
            <button class="ant-tabs-tab" id="tab_angkut" role="tab">Pengangkut</button>
            <button class="ant-tabs-tab" id="tab_kemas" role="tab">Kemasan & Peti Kemas</button>
            <button class="ant-tabs-tab" id="tab_trx" role="tab">Transaksi</button>
            <button class="ant-tabs-tab" id="tab_brg" role="tab">Barang</button>
        </div>
    </body>
    </html>
    `;
    const dom = new JSDOM(htmlWithTabs, { runScripts: "outside-only", url: 'https://portal.beacukai.go.id' });
    loadContentScriptFunctions(dom.window);

    let clickedTabId = null;
    dom.window.document.querySelectorAll('.ant-tabs-tab').forEach(b => {
        b.addEventListener('click', () => { clickedTabId = b.id; });
    });

    const success = dom.window.switchCeisaActiveTab('transaksi');
    assert(success, 'switchCeisaActiveTab should return true');
    assert.strictEqual(clickedTabId, 'tab_trx', 'Should have clicked the Transaksi tab');
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('================================================================');

if (passedTests !== totalTests) {
    process.exit(1);
}
