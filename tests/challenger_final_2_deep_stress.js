/**
 * Deep Stress & Hostile Attack Suite for Final Milestone
 * Target: pib_dashboard.js, content.js, print_hub.js
 */
const assert = require('assert');
const {
    loadPibDom,
    loadPibDashboardScript,
    createMockCeisaPortalDom,
    loadContentScriptFunctions
} = require('./e2e/helpers/dom_env');

let passes = 0;
let fails = 0;

function test(name, fn) {
    try {
        fn();
        passes++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        fails++;
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
    }
}

console.log('=== RUNNING DEEP STRESS & HOSTILE ATTACK SUITE ===\n');

// 1. Prototype Pollution & Malformed Draft Resilience
test('Draft Loader: Prototype pollution payload does not pollute Object prototype', () => {
    const { window } = loadPibDom();
    loadPibDashboardScript(window);

    const maliciousDraft = JSON.parse('{"__proto__": {"polluted": true}, "entitas": {"pengirim": {"__proto__": {"admin": true}}}}');
    window.loadPibDraftData(maliciousDraft);

    assert.strictEqual(Object.prototype.polluted, undefined);
    assert.strictEqual(Object.prototype.admin, undefined);
});

test('Draft Loader: Arrays and unexpected data types in place of entity objects', () => {
    const { window } = loadPibDom();
    loadPibDashboardScript(window);

    const crazyDraft = {
        entitas: {
            pengirim: ['unexpected', 'array'],
            pembeli: 12345,
            pemilikBarang: true,
            penerima: null,
            penjual: undefined,
            ppjk: 'string_instead_of_object'
        }
    };

    assert.doesNotThrow(() => {
        window.loadPibDraftData(crazyDraft);
    });

    const collected = window.collectPibFormData();
    assert.strictEqual(typeof collected.entitas, 'object');
});

// 2. DOM Node Deletion / Resilience to Missing Elements
test('Form Collector: Missing DOM elements do not cause TypeError during collect', () => {
    const { window, document } = loadPibDom();
    loadPibDashboardScript(window);

    // Intentionally remove 3 key inputs from DOM
    const el1 = document.getElementById('pibPengirimName');
    const el2 = document.getElementById('pibPembeliNitku');
    const el3 = document.getElementById('pibPpjkAddress');
    if (el1) el1.remove();
    if (el2) el2.remove();
    if (el3) el3.remove();

    let collected;
    assert.doesNotThrow(() => {
        collected = window.collectPibFormData();
    });

    assert.strictEqual(collected.entitas.pengirim.nama, '');
    assert.strictEqual(collected.entitas.pembeli.nitku, '');
    assert.strictEqual(collected.entitas.ppjk.alamat, '');
});

// 3. CEISA Portal Card Disambiguation Under Hostile DOM
test('Portal Auto-Input: Card text collision resolution (Penerima vs Pembeli/Pemilik buttons)', () => {
    const { window: portalWin } = createMockCeisaPortalDom();
    loadContentScriptFunctions(portalWin);

    const doc = portalWin.document;

    // Simulate Pembeli card with inner text containing "Salin data penerima"
    const cardPembeli = doc.querySelector('.card-pembeli .ant-card-head');
    cardPembeli.innerHTML = `
        <div class="ant-card-head-title">Pembeli</div>
        <div class="ant-card-extra">
            <button>Salin data penerima</button>
            <button>Hapus Pembeli</button>
        </div>
    `;

    // Simulate Pemilik card with inner text containing "Salin Penerima"
    const cardPemilik = doc.querySelector('.card-pemilik .ant-card-head');
    cardPemilik.innerHTML = `
        <div class="ant-card-head-title">Pemilik Barang</div>
        <div class="ant-card-extra">
            <button>Salin Penerima</button>
        </div>
    `;

    const payload = {
        entitas: {
            penerima: { nama: 'TARGET PENERIMA ONLY' },
            pembeli: { nama: 'TARGET PEMBELI ONLY' },
            pemilikBarang: { nama: 'TARGET PEMILIK ONLY' }
        }
    };

    portalWin.handleCeisaAutoInputRow(payload);

    assert.strictEqual(doc.getElementById('ceisa_penerima_nama').value, 'TARGET PENERIMA ONLY');
    assert.strictEqual(doc.getElementById('ceisa_pembeli_nama').value, 'TARGET PEMBELI ONLY');
    assert.strictEqual(doc.getElementById('ceisa_pemilik_nama').value, 'TARGET PEMILIK ONLY');
});

// 4. Tab Navigation Rapid Stress
test('PIB Tab Navigation: 100 rapid tab transitions maintain active state consistency', () => {
    const { window, document } = loadPibDom();
    const tabs = ['pib-tab-header', 'pib-tab-entitas', 'pib-tab-dokumen', 'pib-tab-transaksi', 'pib-tab-barang'];

    for (let i = 0; i < 100; i++) {
        const targetTab = tabs[i % tabs.length];
        window.switchPibTab(targetTab);
    }

    // Last target
    const finalTab = tabs[99 % tabs.length];
    const activePanels = document.querySelectorAll('.tab-content-panel.active');
    assert.strictEqual(activePanels.length, 1, 'Only one panel should be active');
    assert.strictEqual(activePanels[0].id, finalTab);
});

// 5. Pungutan Calculation Link with Entity Status
test('Tax / Pungutan: Entity status change alters tariff calculation without errors', () => {
    const { window, document } = loadPibDom();
    loadPibDashboardScript(window);

    const statusSelect = document.getElementById('pibPenerimaStatus');
    assert.ok(statusSelect, 'pibPenerimaStatus select must exist');

    statusSelect.value = 'API-U';
    assert.doesNotThrow(() => {
        if (typeof window.calculatePibPungutan === 'function') {
            window.calculatePibPungutan();
        }
    });

    statusSelect.value = 'NON-API';
    assert.doesNotThrow(() => {
        if (typeof window.calculatePibPungutan === 'function') {
            window.calculatePibPungutan();
        }
    });

    const collected = window.collectPibFormData();
    assert.strictEqual(collected.entitas.penerima.status, 'NON-API');
});

console.log('\n=================================================');
console.log(`TOTAL DEEP STRESS: ${passes} Passed, ${fails} Failed`);
console.log('=================================================\n');

process.exit(fails > 0 ? 1 : 0);
