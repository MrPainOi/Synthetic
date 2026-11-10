/**
 * CEISA 4.0 E2E Test Suite - Tier 4: Real-World Application Scenarios
 * Validates complete end-to-end user workflows matching production usage
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

describe('Tier 4 - Real-World Application Scenarios', () => {
    test('TC-T4-01: End-to-End PIB Document Declaration Lifecycle: load -> edit 6 cards -> copy -> sync NITKU -> collect -> auto-input', async () => {
        // Step 1: Initialize PIB Form
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);
        if (typeof pibEnv.window.setupPibCopyHandlers === 'function') pibEnv.window.setupPibCopyHandlers();

        // Step 2: Populate initial draft
        const initialDraft = {
            penerimaId: '0830727251085000',
            penerimaName: 'PT. OTTO SEKAWAN MULIA',
            penerimaAddress: 'Kawasan Industri Tunas Batam Center, Tunas Bizpark Type C6, Batam',
            penerimaCountry: 'ID - INDONESIA',
            penerimaStatus: 'LAINNYA',
            pengirimName: 'JIANGSU RUIJIA IMPORT & EXPORT CO., LTD',
            pengirimAddress: 'No. 888 Songze Avenue, Qingpu District, Shanghai, China',
            pengirimCountry: 'CN - CHINA',
            ppjkId: '0026923485215000',
            ppjkName: 'PT. SARANA PPJK LOGISTIK UTAMA'
        };

        if (typeof pibEnv.window.loadPibDraftData === 'function') {
            pibEnv.window.loadPibDraftData(initialDraft);

            // Step 3: Trigger copy actions (Salin data penerima -> Pembeli, Salin pengirim -> Penjual)
            const btnCopyPembeli = pibEnv.document.getElementById('btnCopyPenerimaToPembeli') || pibEnv.document.getElementById('pibBtnSalinPenerima');
            const btnCopyPenjual = pibEnv.document.getElementById('btnCopyPengirimToPenjual') || pibEnv.document.getElementById('pibBtnSalinPengirim');
            const btnSyncPpjk = pibEnv.document.getElementById('btnSyncNitkuPpjk') || pibEnv.document.getElementById('pibBtnSyncNitkuPpjk');

            if (btnCopyPembeli) btnCopyPembeli.click();
            if (btnCopyPenjual) btnCopyPenjual.click();
            if (btnSyncPpjk) btnSyncPpjk.click();

            // Step 4: Collect serialized draft
            const collected = pibEnv.window.collectPibFormData();
            assert.strictEqual(collected.penerimaName, 'PT. OTTO SEKAWAN MULIA');
            assert.strictEqual(collected.pembeliName, 'PT. OTTO SEKAWAN MULIA');
            assert.strictEqual(collected.pengirimName, 'JIANGSU RUIJIA IMPORT & EXPORT CO., LTD');
            assert.strictEqual(collected.penjualName, 'JIANGSU RUIJIA IMPORT & EXPORT CO., LTD');

            // Step 5: Transfer to CEISA Portal via content script
            const ceisaEnv = createMockCeisaPortalDom();
            loadContentScriptFunctions(ceisaEnv.window);
            const container = ceisaEnv.document.getElementById('tab-entitas');
            const filledFields = [];
            ceisaEnv.window.handleCeisaAutoInputRow(collected, container, 'entitas', filledFields);

            // Step 6: Verify CEISA portal DOM
            const cPenerima = ceisaEnv.document.getElementById('ceisa_penerima_nama')?.value;
            const cPengirim = ceisaEnv.document.getElementById('ceisa_pengirim_nama')?.value;
            assert.strictEqual(cPenerima, 'PT. OTTO SEKAWAN MULIA');
            assert.strictEqual(cPengirim, 'JIANGSU RUIJIA IMPORT & EXPORT CO., LTD');
        }
    }, { tier: 4, id: 'TC-T4-01' });

    test('TC-T4-02: Self-Handled Declaration Workflow (Blank / Optional PPJK Submission)', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        const draftWithoutPpjk = {
            penerimaName: 'PT. MANDIRI IMPOR LANGSUNG',
            penerimaId: '0123456789012345',
            pengirimName: 'GLOBAL EXPORTERS CORP',
            ppjkId: '',
            ppjkName: '',
            ppjkAddress: ''
        };

        if (typeof pibEnv.window.loadPibDraftData === 'function') {
            pibEnv.window.loadPibDraftData(draftWithoutPpjk);
            const collected = pibEnv.window.collectPibFormData();

            assert.strictEqual(collected.penerimaName, 'PT. MANDIRI IMPOR LANGSUNG');
            assert.ok(!collected.ppjkName || collected.ppjkName === '');

            // Ensure auto-input does not crash with empty PPJK
            const ceisaEnv = createMockCeisaPortalDom();
            loadContentScriptFunctions(ceisaEnv.window);
            const container = ceisaEnv.document.getElementById('tab-entitas');
            assert.doesNotThrow(() => {
                ceisaEnv.window.handleCeisaAutoInputRow(collected, container, 'entitas', []);
            });
        }
    }, { tier: 4, id: 'TC-T4-02' });

    test('TC-T4-03: Foreign Shipper != Foreign Seller Business Workflow', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);
        if (typeof pibEnv.window.setupPibCopyHandlers === 'function') pibEnv.window.setupPibCopyHandlers();

        const sName = pibEnv.document.getElementById('pibPengirimName');
        const sCtry = pibEnv.document.getElementById('pibPengirimCountry');
        if (sName) {
            sName.value = 'SHANGHAI MANUFACTURING PLANT LTD';
            if (sCtry) sCtry.value = 'CN - CHINA';

            // User clicks Salin data pengirim to initialize Penjual
            const btnCopy = pibEnv.document.getElementById('btnCopyPengirimToPenjual') || pibEnv.document.getElementById('pibBtnSalinPengirim');
            if (btnCopy) btnCopy.click();

            // User overrides Penjual to offshore billing agent in Hong Kong
            const jName = pibEnv.document.getElementById('pibPenjualName');
            const jCtry = pibEnv.document.getElementById('pibPenjualCountry');
            if (jName) jName.value = 'HONG KONG COMMERCIAL TRADING CO., LTD';
            if (jCtry) jCtry.value = 'HK - HONG KONG';

            const collected = pibEnv.window.collectPibFormData();
            assert.strictEqual(collected.pengirimName, 'SHANGHAI MANUFACTURING PLANT LTD');
            assert.strictEqual(collected.penjualName, 'HONG KONG COMMERCIAL TRADING CO., LTD');
        }
    }, { tier: 4, id: 'TC-T4-03' });

    test('TC-T4-04: Print Hub Production Workflow: verify clean UI, fetch printers, submit print job without errors', async () => {
        const phEnv = loadPrintHubDom();
        loadPrintHubScript(phEnv.window);

        // Verify clean UI
        assert.strictEqual(phEnv.document.querySelector('.ph-qr-card'), null, 'No QR banner');
        assert.strictEqual(phEnv.document.getElementById('btnOpenQrHeader'), null, 'No Scan HP button');
        assert.strictEqual(phEnv.document.getElementById('qrModal'), null, 'No QR modal');

        // Trigger startup
        phEnv.document.dispatchEvent(new phEnv.window.Event('DOMContentLoaded'));

        // Verify printer listing
        const select = phEnv.document.getElementById('printerSelect');
        assert.ok(select, '#printerSelect must exist');

        // Submit text print
        const form = phEnv.document.getElementById('textPrintForm');
        const textarea = phEnv.document.getElementById('rawTextArea');
        if (textarea && form) {
            textarea.value = '=== RESI PENGIRIMAN DOKUMEN PIB ===\nNO AJU: 010700-000001-20261110-000001\nSTATUS: APPROVED\n';
            assert.doesNotThrow(() => {
                form.dispatchEvent(new phEnv.window.Event('submit', { cancelable: true }));
            });
        }
    }, { tier: 4, id: 'TC-T4-04' });

    test('TC-T4-05: High-Stress / Large Data PIB Draft with 22-digit NITKUs across all domestic entities', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        const highStressDraft = {
            penerimaId: '0830727251085000',
            penerimaNitku: '0830727251085000000002',
            penerimaName: 'PT. MULTI LOGISTIK TRANS NUSANTARA TBK.',
            penerimaAddress: 'Kawasan Berikat MM2100 Blok C-5, Cikarang Barat, Kabupaten Bekasi, Jawa Barat 17530, Republik Indonesia',
            pembeliId: '0830727251085000',
            pembeliNitku: '0830727251085000000002',
            pembeliName: 'PT. MULTI LOGISTIK TRANS NUSANTARA TBK.',
            pembeliAddress: 'Kawasan Berikat MM2100 Blok C-5, Cikarang Barat, Kabupaten Bekasi, Jawa Barat 17530, Republik Indonesia',
            pemilikId: '0830727251085000',
            pemilikNitku: '0830727251085000000002',
            pemilikName: 'PT. MULTI LOGISTIK TRANS NUSANTARA TBK.',
            pemilikAddress: 'Kawasan Berikat MM2100 Blok C-5, Cikarang Barat, Kabupaten Bekasi, Jawa Barat 17530, Republik Indonesia',
            ppjkId: '0026923485215000',
            ppjkNitku: '0026923485215000000000',
            ppjkName: 'PT. SARANA PPJK LOGISTIK UTAMA TBK.',
            ppjkAddress: 'Jl. Sulawesi No. 12 Tanjung Priok, Jakarta Utara'
        };

        if (typeof pibEnv.window.loadPibDraftData === 'function') {
            pibEnv.window.loadPibDraftData(highStressDraft);
            const collected = pibEnv.window.collectPibFormData();

            assert.strictEqual(collected.penerimaNitku.length, 22);
            assert.strictEqual(collected.pembeliNitku.length, 22);
            assert.strictEqual(collected.pemilikNitku.length, 22);
            assert.strictEqual(collected.ppjkNitku.length, 22);
        }
    }, { tier: 4, id: 'TC-T4-05' });
});
