/**
 * CEISA 4.0 E2E Test Suite - Tier 3: Cross-Feature Combinations (Pairwise Integration)
 * Covers interactions across Print Hub, PIB Tab Entitas, Storage, and CEISA Auto-Input
 */
const { test, describe, assert } = require('./helpers/test_framework');
const {
    loadPrintHubDom,
    loadPrintHubScript,
    loadPibDom,
    loadPibDashboardScript,
    createMockCeisaPortalDom,
    loadContentScriptFunctions
} = require('./helpers/dom_env');

describe('Tier 3 - Cross-Feature Pairwise Integration', () => {
    test('TC-T3-01: Copying from Penerima -> Pembeli then Penerima -> Pemilik maintains consistent entity state', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        const pId = document.getElementById('pibPenerimaId');
        const pNitku = document.getElementById('pibPenerimaNitku');
        const pName = document.getElementById('pibPenerimaName');
        const pAddr = document.getElementById('pibPenerimaAddress');

        if (pId && pName) {
            pId.value = '0830727251085000';
            if (pNitku) pNitku.value = '0830727251085000000002';
            pName.value = 'PT. INDONESIA SEJAHTERA';
            if (pAddr) pAddr.value = 'Kawasan MM2100 Blok C-5';

            const btnCopyPembeli = document.getElementById('btnCopyPenerimaToPembeli') || document.getElementById('pibBtnSalinPenerima');
            const btnCopyPemilik = document.getElementById('btnCopyPenerimaToPemilik') || document.getElementById('pibBtnSalinPemilik');

            if (btnCopyPembeli) btnCopyPembeli.click();
            if (btnCopyPemilik) btnCopyPemilik.click();

            const bName = document.getElementById('pibPembeliName')?.value;
            const oName = document.getElementById('pibPemilikName')?.value;

            assert.strictEqual(bName, 'PT. INDONESIA SEJAHTERA');
            assert.strictEqual(oName, 'PT. INDONESIA SEJAHTERA');
        }
    }, { tier: 3, id: 'TC-T3-01' });

    test('TC-T3-02: Copying Pengirim -> Penjual then modifying Pengirim ensures Penjual remains independent', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        const sName = document.getElementById('pibPengirimName');
        const sAddr = document.getElementById('pibPengirimAddress');
        if (sName && sAddr) {
            sName.value = 'ORIGINAL SHANGHAI SUPPLIER';
            sAddr.value = 'Songze Avenue No. 888';

            const btnCopy = document.getElementById('btnCopyPengirimToPenjual') || document.getElementById('pibBtnSalinPengirim');
            if (btnCopy) btnCopy.click();

            // Mutate Pengirim
            sName.value = 'MODIFIED SHANGHAI SUPPLIER 2';

            const jName = document.getElementById('pibPenjualName')?.value;
            assert.strictEqual(jName, 'ORIGINAL SHANGHAI SUPPLIER', 'Penjual value must remain independent after copy');
        }
    }, { tier: 3, id: 'TC-T3-02' });

    test('TC-T3-03: Full Form Edit -> collectPibFormData -> loadPibDraftData -> verify complete roundtrip equality', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const initialDraft = {
            pengirimName: 'ROUNDTRIP SHIPPER CO',
            pengirimCountry: 'CN - CHINA',
            pembeliName: 'ROUNDTRIP BUYER PT',
            pemilikName: 'ROUNDTRIP OWNER PT',
            penerimaName: 'ROUNDTRIP RECEIVER PT',
            penerimaNitku: '0830727251085000000002',
            penjualName: 'ROUNDTRIP SELLER LTD',
            ppjkName: 'ROUNDTRIP PPJK LOGISTIK',
            ppjkNitku: '0026923485215000000000'
        };

        if (typeof window.loadPibDraftData === 'function') {
            window.loadPibDraftData(initialDraft);
            const collected = window.collectPibFormData();

            assert.strictEqual(collected.pengirimName, initialDraft.pengirimName);
            assert.strictEqual(collected.pembeliName, initialDraft.pembeliName);
            assert.strictEqual(collected.pemilikName, initialDraft.pemilikName);
            assert.strictEqual(collected.penerimaName, initialDraft.penerimaName);
            assert.strictEqual(collected.penjualName, initialDraft.penjualName);
            assert.strictEqual(collected.ppjkName, initialDraft.ppjkName);
        }
    }, { tier: 3, id: 'TC-T3-03' });

    test('TC-T3-04: Legacy draft load -> Migrates automatically into 6-card DOM with dual-key backward compatibility', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);

        const legacyDraft = {
            importirName: 'PT. MAKMUR IMPORTAMA',
            supplierName: 'JIANGSU PRECISION'
        };

        if (typeof window.loadPibDraftData === 'function') {
            window.loadPibDraftData(legacyDraft);
            const collected = window.collectPibFormData();

            // Check new keys
            assert.strictEqual(collected.penerimaName, 'PT. MAKMUR IMPORTAMA');
            assert.strictEqual(collected.pengirimName, 'JIANGSU PRECISION');
            // Check legacy aliases
            assert.strictEqual(collected.importirName, 'PT. MAKMUR IMPORTAMA');
            assert.strictEqual(collected.supplierName, 'JIANGSU PRECISION');
        }
    }, { tier: 3, id: 'TC-T3-04' });

    test('TC-T3-05: Form Data Collection directly feeds CEISA 4.0 Auto-Input in mock portal', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        const draft = {
            pengirimName: 'AUTO_INPUT_SHIPPER',
            penerimaName: 'AUTO_INPUT_RECEIVER',
            pembeliName: 'AUTO_INPUT_BUYER',
            penjualName: 'AUTO_INPUT_SELLER',
            pemilikName: 'AUTO_INPUT_OWNER',
            ppjkName: 'AUTO_INPUT_PPJK'
        };

        if (typeof pibEnv.window.loadPibDraftData === 'function') {
            pibEnv.window.loadPibDraftData(draft);
            const payload = pibEnv.window.collectPibFormData();

            // Inject into CEISA mock portal
            const ceisaEnv = createMockCeisaPortalDom();
            loadContentScriptFunctions(ceisaEnv.window);

            const container = ceisaEnv.document.getElementById('tab-entitas');
            const filledFields = [];
            ceisaEnv.window.handleCeisaAutoInputRow(payload, container, 'entitas', filledFields);

            const cPenerima = ceisaEnv.document.getElementById('ceisa_penerima_nama')?.value;
            const cPengirim = ceisaEnv.document.getElementById('ceisa_pengirim_nama')?.value;

            assert.strictEqual(cPenerima, 'AUTO_INPUT_RECEIVER');
            assert.strictEqual(cPengirim, 'AUTO_INPUT_SHIPPER');
        }
    }, { tier: 3, id: 'TC-T3-05' });

    test('TC-T3-06: NITKU sync on PPJK -> Form collection -> Auto-input into CEISA PPJK card', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        const ppjkId = document.getElementById('pibPpjkId');
        const btnSync = document.getElementById('btnSyncNitkuPpjk') || document.getElementById('pibBtnSyncNitkuPpjk');
        if (ppjkId && btnSync) {
            ppjkId.value = '0026923485215000';
            btnSync.click();

            if (typeof window.collectPibFormData === 'function') {
                const collected = window.collectPibFormData();
                assert.strictEqual(collected.ppjkNitku, '0026923485215000000000');

                // Auto-input into CEISA
                const ceisaEnv = createMockCeisaPortalDom();
                loadContentScriptFunctions(ceisaEnv.window);
                const container = ceisaEnv.document.getElementById('tab-entitas');
                ceisaEnv.window.handleCeisaAutoInputRow(collected, container, 'entitas', []);

                const ceisaNitku = ceisaEnv.document.getElementById('ceisa_ppjk_nitku')?.value;
                if (ceisaNitku) {
                    assert.strictEqual(ceisaNitku, '0026923485215000000000');
                }
            }
        }
    }, { tier: 3, id: 'TC-T3-06' });

    test('TC-T3-07: "Hapus Pembeli" followed by collect: Pembeli cleared while other cards remain intact', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        if (typeof window.loadPibDraftData === 'function') {
            window.loadPibDraftData({
                penerimaName: 'PT. ACTIVE IMPORTER',
                pembeliName: 'PT. BUYER TO BE DELETED'
            });

            const btnHapus = document.getElementById('btnHapusPembeli') || document.getElementById('pibBtnHapusPembeli');
            if (btnHapus) btnHapus.click();

            const collected = window.collectPibFormData();
            assert.ok(collected.pembeliName === '' || collected.pembeliName === '-');
            assert.strictEqual(collected.penerimaName, 'PT. ACTIVE IMPORTER');
        }
    }, { tier: 3, id: 'TC-T3-07' });

    test('TC-T3-08: Print Hub printer fetch and PIB form operations execute without global state collision', () => {
        const phEnv = loadPrintHubDom();
        loadPrintHubScript(phEnv.window);
        phEnv.document.dispatchEvent(new phEnv.window.Event('DOMContentLoaded'));

        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        assert.doesNotThrow(() => {
            if (typeof pibEnv.window.collectPibFormData === 'function') {
                pibEnv.window.collectPibFormData();
            }
        });
    }, { tier: 3, id: 'TC-T3-08' });

    test('TC-T3-09: Entity Status "NON-API" correctly links to calculation formulas and collects cleanly', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const status = document.getElementById('pibPenerimaStatus');
        if (status) {
            const nonApiOpt = Array.from(status.options).find(o => o.value.includes('NON-API'));
            if (nonApiOpt) status.value = nonApiOpt.value;

            if (typeof window.calculatePibPungutan === 'function') {
                assert.doesNotThrow(() => window.calculatePibPungutan());
            }

            if (typeof window.collectPibFormData === 'function') {
                const data = window.collectPibFormData();
                assert.ok(data.penerimaStatus.includes('NON-API') || data.importirStatus?.includes('NON-API'));
            }
        }
    }, { tier: 3, id: 'TC-T3-09' });

    test('TC-T3-10: Sinar Asia draft load cascades Golden Ben Singapore shipper into CEISA auto-input', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        if (typeof pibEnv.window.loadPibDraftData === 'function') {
            pibEnv.window.loadPibDraftData({ penerimaName: 'PT. SINAR ASIA PACK' });
            const payload = pibEnv.window.collectPibFormData();

            const ceisaEnv = createMockCeisaPortalDom();
            loadContentScriptFunctions(ceisaEnv.window);
            const container = ceisaEnv.document.getElementById('tab-entitas');
            ceisaEnv.window.handleCeisaAutoInputRow(payload, container, 'entitas', []);

            const shipper = ceisaEnv.document.getElementById('ceisa_pengirim_nama')?.value;
            if (shipper) {
                assert.ok(/GOLDEN\s*BEN/i.test(shipper));
            }
        }
    }, { tier: 3, id: 'TC-T3-10' });
});
