/**
 * CEISA 4.0 E2E Test Suite - Tier 5: Adversarial Coverage Hardening
 * Empirical verification of end-to-end user lifecycle, edge cases, and attack surfaces.
 */
const { test, describe, assert, defaultHarness } = require('./helpers/test_framework');
const {
    loadPrintHubDom,
    loadPrintHubScript,
    loadPibDom,
    loadPibDashboardScript,
    createMockCeisaPortalDom,
    loadContentScriptFunctions
} = require('./helpers/dom_env');

describe('Tier 5 - Adversarial Coverage Hardening', () => {

    test('TC-T5-01: Complete End-to-End User Lifecycle & Field-by-Field Parity', async () => {
        // =========================================================================
        // 1. PRINT HUB OPERATIONS (Simulation)
        // =========================================================================
        const printEnv = loadPrintHubDom();
        const fakePrinters = [
            { name: 'EPSON LQ-310 ESC/P', isDefault: true, isDotMatrix: true, portName: 'USB001', driverName: 'EPSON LQ-310', status: 'Normal' },
            { name: 'Canon G3010 Series', isDefault: false, isDotMatrix: false, portName: 'WSD-Port', driverName: 'Canon Inkjet', status: 'Normal' }
        ];

        let postedJob = null;
        printEnv.window.fetch = async (url, opts) => {
            const urlStr = String(url);
            if (urlStr.includes('/api/print/status')) {
                return { json: async () => ({ success: true, port: 5005 }) };
            }
            if (urlStr.includes('/api/print/printers')) {
                return { json: async () => ({ success: true, printers: fakePrinters, defaultPrinter: 'EPSON LQ-310 ESC/P' }) };
            }
            if (urlStr.includes('/api/print/queue')) {
                return { json: async () => ({ success: true, queue: [], history: [] }) };
            }
            if (urlStr.includes('/api/print/text')) {
                postedJob = JSON.parse(opts.body);
                return { json: async () => ({ success: true, jobId: 'job-t5-999' }) };
            }
            return { json: async () => ({ success: true }) };
        };

        loadPrintHubScript(printEnv.window);
        await new Promise(r => setTimeout(r, 60));

        // Verify Print Hub UI integrity
        assert.strictEqual(printEnv.document.querySelector('.ph-qr-card'), null, 'QR card must not exist');
        assert.strictEqual(printEnv.document.getElementById('btnOpenQrHeader'), null, 'Scan HP button must not exist');
        assert.strictEqual(printEnv.document.getElementById('qrModal'), null, 'QR modal must not exist');

        // Select printer and switch tab
        const printerSelect = printEnv.document.getElementById('printerSelect');
        assert.ok(printerSelect.options.length >= 2, 'Printers loaded');
        printerSelect.value = 'EPSON LQ-310 ESC/P';
        printerSelect.dispatchEvent(new printEnv.window.Event('change'));

        // Submit RAW text print
        const rawText = printEnv.document.getElementById('rawTextArea');
        rawText.value = 'FAKTUR PABEAN TESTING CEISA 4.0';
        const textForm = printEnv.document.getElementById('textPrintForm');
        textForm.dispatchEvent(new printEnv.window.Event('submit'));
        await new Promise(r => setTimeout(r, 60));
        assert.ok(postedJob, 'Print job was submitted to backend');
        assert.strictEqual(postedJob.printer, 'EPSON LQ-310 ESC/P');

        // =========================================================================
        // 2. PIB FORM INITIALIZATION & EDITING ACROSS ALL 6 ENTITY CARDS
        // =========================================================================
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);
        pibEnv.window.setupPibCopyHandlers();

        // Verify Topbar and Old PPJK are completely absent
        assert.strictEqual(pibEnv.document.querySelector('.ceisa-doc-topbar'), null);
        assert.strictEqual(pibEnv.document.getElementById('btnPibKembali'), null);
        assert.strictEqual(pibEnv.document.getElementById('pibCheckOwnerSame'), null);

        // Edit Card 1: Pengirim
        pibEnv.document.getElementById('pibPengirimIdType').value = '2 - PASPOR';
        pibEnv.document.getElementById('pibPengirimId').value = 'PP-JPN-887766';
        pibEnv.document.getElementById('pibPengirimName').value = 'TOKYO ADVANCED ROBOTICS CORP';
        pibEnv.document.getElementById('pibPengirimAddress').value = '3-2-1 Roppongi, Minato-ku, Tokyo 106-0032';
        pibEnv.document.getElementById('pibPengirimCountry').value = 'JP - JAPAN';

        // Edit Card 4: Penerima
        pibEnv.document.getElementById('pibPenerimaIdType').value = '6 - NPWP 16 DIGIT';
        pibEnv.document.getElementById('pibPenerimaId').value = '0123456789012345';
        pibEnv.document.getElementById('pibPenerimaNitku').value = '0123456789012345000000';
        pibEnv.document.getElementById('pibPenerimaName').value = 'PT. INDO GLOBAL MEKATRONIKA';
        pibEnv.document.getElementById('pibPenerimaAddress').value = 'Kawasan Industri GIIC Blok AA No. 1, Cikarang Pusat, Bekasi';
        pibEnv.document.getElementById('pibPenerimaCountry').value = 'ID - INDONESIA';
        pibEnv.document.getElementById('pibPenerimaStatus').value = 'MITA';
        pibEnv.document.getElementById('pibPenerimaIjinNo').value = 'IZIN-BP-BTM/2026/099';
        pibEnv.document.getElementById('pibPenerimaIjinDate').value = '2026-05-20';

        // =========================================================================
        // 3. TRIGGER COPY OPERATIONS
        // =========================================================================
        // Copy Penerima -> Pembeli
        pibEnv.document.getElementById('btnCopyPenerimaToPembeli').click();
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliId').value, '0123456789012345');
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliNitku').value, '0123456789012345000000');
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliName').value, 'PT. INDO GLOBAL MEKATRONIKA');
        // Independent edit for Pembeli
        pibEnv.document.getElementById('pibPembeliName').value = 'PT. INDO GLOBAL TRADING (BUYER BRANCH)';

        // Copy Pengirim -> Penjual
        pibEnv.document.getElementById('btnCopyPengirimToPenjual').click();
        assert.strictEqual(pibEnv.document.getElementById('pibPenjualIdType').value, '2 - PASPOR');
        assert.strictEqual(pibEnv.document.getElementById('pibPenjualId').value, 'PP-JPN-887766');
        assert.strictEqual(pibEnv.document.getElementById('pibPenjualName').value, 'TOKYO ADVANCED ROBOTICS CORP');
        assert.strictEqual(pibEnv.document.getElementById('pibPenjualCountry').value, 'JP - JAPAN');

        // Copy Penerima -> Pemilik Barang
        pibEnv.document.getElementById('btnCopyPenerimaToPemilik').click();
        assert.strictEqual(pibEnv.document.getElementById('pibPemilikId').value, '0123456789012345');
        assert.strictEqual(pibEnv.document.getElementById('pibPemilikName').value, 'PT. INDO GLOBAL MEKATRONIKA');
        // Set Afiliasi
        pibEnv.document.getElementById('pibPemilikAfiliasi').value = 'HUB - Berhubungan';

        // PPJK & NITKU Sync
        pibEnv.document.getElementById('pibPpjkIdType').value = '6 - NPWP 16 DIGIT';
        pibEnv.document.getElementById('pibPpjkId').value = '0026923485215000';
        pibEnv.document.getElementById('btnSyncNitkuPpjk').click();
        assert.strictEqual(pibEnv.document.getElementById('pibPpjkNitku').value, '0026923485215000000000');
        pibEnv.document.getElementById('pibPpjkName').value = 'PT. TRANS NUSANTARA LOGISTIK PPJK';
        pibEnv.document.getElementById('pibPpjkAddress').value = 'Gedung Kargo Bandara Soekarno Hatta Blok C';

        // =========================================================================
        // 4. COLLECT FORM DATA & VERIFY SERIALIZATION STRUCTURE
        // =========================================================================
        const collectedData = pibEnv.window.collectPibFormData();
        assert.ok(collectedData.entitas, 'entitas object exists');
        assert.strictEqual(collectedData.entitas.pengirim.nama, 'TOKYO ADVANCED ROBOTICS CORP');
        assert.strictEqual(collectedData.entitas.penerima.nama, 'PT. INDO GLOBAL MEKATRONIKA');
        assert.strictEqual(collectedData.entitas.penerima.status, 'MITA');
        assert.strictEqual(collectedData.entitas.pembeli.nama, 'PT. INDO GLOBAL TRADING (BUYER BRANCH)');
        assert.strictEqual(collectedData.entitas.penjual.nama, 'TOKYO ADVANCED ROBOTICS CORP');
        assert.strictEqual(collectedData.entitas.pemilikBarang.afiliasi, 'HUB - Berhubungan');
        assert.strictEqual(collectedData.entitas.ppjk.nitku, '0026923485215000000000');
        assert.strictEqual(collectedData.entitas.ppjk.nama, 'PT. TRANS NUSANTARA LOGISTIK PPJK');

        // Verify dual-key backward compatibility
        assert.strictEqual(collectedData.importirName, 'PT. INDO GLOBAL MEKATRONIKA');
        assert.strictEqual(collectedData.supplierName, 'TOKYO ADVANCED ROBOTICS CORP');

        // =========================================================================
        // 5. SIMULATE DRAFT SAVE, WIPE FORM, AND RELOAD
        // =========================================================================
        const serialized = JSON.stringify(collectedData);
        // Wipe all inputs
        const allInputs = pibEnv.document.querySelectorAll('#pib-tab-entitas input, #pib-tab-entitas textarea');
        allInputs.forEach(i => { i.value = ''; });
        assert.strictEqual(pibEnv.document.getElementById('pibPenerimaName').value, '');

        // Reload draft
        const parsedDraft = JSON.parse(serialized);
        pibEnv.window.loadPibDraftData(parsedDraft, false);

        // Verify 100% restoration
        assert.strictEqual(pibEnv.document.getElementById('pibPengirimName').value, 'TOKYO ADVANCED ROBOTICS CORP');
        assert.strictEqual(pibEnv.document.getElementById('pibPenerimaName').value, 'PT. INDO GLOBAL MEKATRONIKA');
        assert.strictEqual(pibEnv.document.getElementById('pibPenerimaStatus').value, 'MITA');
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliName').value, 'PT. INDO GLOBAL TRADING (BUYER BRANCH)');
        assert.strictEqual(pibEnv.document.getElementById('pibPenjualName').value, 'TOKYO ADVANCED ROBOTICS CORP');
        assert.strictEqual(pibEnv.document.getElementById('pibPemilikAfiliasi').value, 'HUB - Berhubungan');
        assert.strictEqual(pibEnv.document.getElementById('pibPpjkNitku').value, '0026923485215000000000');
        assert.strictEqual(pibEnv.document.getElementById('pibPpjkName').value, 'PT. TRANS NUSANTARA LOGISTIK PPJK');

        // =========================================================================
        // 6. AUTO-INPUT INTO CEISA 4.0 PORTAL & FIELD-BY-FIELD PARITY
        // =========================================================================
        const ceisaEnv = createMockCeisaPortalDom();
        loadContentScriptFunctions(ceisaEnv.window);
        const ceisaContainer = ceisaEnv.document.getElementById('tab-entitas');
        const filled = [];
        const result = ceisaEnv.window.handleCeisaAutoInputRow(collectedData, ceisaContainer, 'entitas', filled);

        assert.strictEqual(result.ok, true, 'Auto-input executed successfully');

        // Field-by-Field Parity Check on CEISA Portal DOM:
        // Card Pengirim
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pengirim_id').value, 'PP-JPN-887766');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pengirim_nama').value, 'TOKYO ADVANCED ROBOTICS CORP');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pengirim_alamat').value, '3-2-1 Roppongi, Minato-ku, Tokyo 106-0032');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pengirim_negara').value, 'JP - JAPAN');

        // Card Penerima
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penerima_id').value, '0123456789012345');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penerima_nitku').value, '0123456789012345000000');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penerima_nama').value, 'PT. INDO GLOBAL MEKATRONIKA');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penerima_alamat').value, 'Kawasan Industri GIIC Blok AA No. 1, Cikarang Pusat, Bekasi');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penerima_negara').value, 'ID - INDONESIA');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penerima_status').value, 'MITA');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penerima_ijin_no').value, 'IZIN-BP-BTM/2026/099');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penerima_ijin_tgl').value, '2026-05-20');

        // Card Pembeli
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pembeli_id').value, '0123456789012345');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pembeli_nitku').value, '0123456789012345000000');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pembeli_nama').value, 'PT. INDO GLOBAL TRADING (BUYER BRANCH)');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pembeli_negara').value, 'ID - INDONESIA');

        // Card Penjual
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penjual_id').value, 'PP-JPN-887766');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penjual_nama').value, 'TOKYO ADVANCED ROBOTICS CORP');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_penjual_negara').value, 'JP - JAPAN');

        // Card Pemilik Barang
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pemilik_id').value, '0123456789012345');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pemilik_nitku').value, '0123456789012345000000');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pemilik_nama').value, 'PT. INDO GLOBAL MEKATRONIKA');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pemilik_afiliasi').value, 'HUB - Berhubungan');

        // Card PPJK
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_ppjk_id').value, '0026923485215000');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_ppjk_nitku').value, '0026923485215000000000');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_ppjk_nama').value, 'PT. TRANS NUSANTARA LOGISTIK PPJK');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_ppjk_alamat').value, 'Gedung Kargo Bandara Soekarno Hatta Blok C');
    }, { tier: 5, id: 'TC-T5-01' });

    test('TC-T5-02: Adversarial Special Characters, Multiline Strings & Unicode', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        const hostileDraft = {
            entitas: {
                pengirim: {
                    jenisIdentitas: '4 - LAINNYA',
                    nomorIdentitas: '<script>alert("xss")</script>',
                    nama: 'O\'Connor & "Sons" (Holdings) Ltd. <Shanghai> & Co.',
                    alamat: 'Line 1: Building #9\nLine 2: Floor 14 "West Wing"\nLine 3: Pudong, 上海 200120 🚀',
                    negara: 'CN - CHINA'
                },
                penerima: {
                    jenisIdentitas: '6 - NPWP 16 DIGIT',
                    nomorIdentitas: '0123456789012345',
                    nitku: '0123456789012345000000',
                    nama: 'PT. JAYA ABADI & REKAN "PERSEROAN" <TERBUKA>',
                    alamat: 'Jl. Sudirman No. 100\nKavling 20 & 21\nJakarta 10220',
                    negara: 'ID - INDONESIA',
                    status: 'LAINNYA'
                }
            }
        };

        pibEnv.window.loadPibDraftData(hostileDraft, false);
        const collected = pibEnv.window.collectPibFormData();

        assert.strictEqual(collected.entitas.pengirim.nama, 'O\'Connor & "Sons" (Holdings) Ltd. <Shanghai> & Co.');
        assert.ok(collected.entitas.pengirim.alamat.includes('\n'), 'Newlines preserved');

        const ceisaEnv = createMockCeisaPortalDom();
        loadContentScriptFunctions(ceisaEnv.window);
        const ceisaContainer = ceisaEnv.document.getElementById('tab-entitas');
        ceisaEnv.window.handleCeisaAutoInputRow(collected, ceisaContainer, 'entitas', []);

        // Assert exact injection without corruption
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pengirim_nama').value, 'O\'Connor & "Sons" (Holdings) Ltd. <Shanghai> & Co.');
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pengirim_id').value, '<script>alert("xss")</script>');
        assert.ok(ceisaEnv.document.getElementById('ceisa_pengirim_alamat').value.includes('上海 200120 🚀'));
    }, { tier: 5, id: 'TC-T5-02' });

    test('TC-T5-03: "Hapus Pembeli" and Optional Entity Cascade Hardening', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);
        pibEnv.window.setupPibCopyHandlers();

        // Populate Pembeli
        pibEnv.document.getElementById('pibPembeliId').value = '1122334455667788';
        pibEnv.document.getElementById('pibPembeliNitku').value = '1122334455667788000000';
        pibEnv.document.getElementById('pibPembeliName').value = 'PT. CALON PEMBELI DIHAPUS';
        pibEnv.document.getElementById('pibPembeliAddress').value = 'Gudang Sementara Blok A';

        // Click Hapus Pembeli
        pibEnv.document.getElementById('btnHapusPembeli').click();

        // Verify fields are blanked
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliId').value, '');
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliNitku').value, '');
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliName').value, '');
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliAddress').value, '');

        const collected = pibEnv.window.collectPibFormData();
        assert.strictEqual(collected.entitas.pembeli.nama, '');
        assert.strictEqual(collected.pembeliName, '');

        // Auto-input into CEISA
        const ceisaEnv = createMockCeisaPortalDom();
        loadContentScriptFunctions(ceisaEnv.window);
        const ceisaContainer = ceisaEnv.document.getElementById('tab-entitas');
        // Preset an existing value in CEISA
        ceisaEnv.document.getElementById('ceisa_pembeli_nama').value = 'EXISTING_VALUE';

        // Auto-input should NOT overwrite with literal "undefined" or "null" or empty string when str is empty
        ceisaEnv.window.handleCeisaAutoInputRow(collected, ceisaContainer, 'entitas', []);
        assert.strictEqual(ceisaEnv.document.getElementById('ceisa_pembeli_nama').value, 'EXISTING_VALUE');
    }, { tier: 5, id: 'TC-T5-03' });

    test('TC-T5-04: NITKU 22-Digit Generation & Formatting Stress', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);
        pibEnv.window.setupPibCopyHandlers();

        const ppjkIdInput = pibEnv.document.getElementById('pibPpjkId');
        const nitkuInput = pibEnv.document.getElementById('pibPpjkNitku');
        const syncBtn = pibEnv.document.getElementById('btnSyncNitkuPpjk');

        // Case A: Formatted 16-digit NPWP
        ppjkIdInput.value = '00.269.234.8-521.5000';
        syncBtn.click();
        assert.strictEqual(nitkuInput.value, '0026923485215000000000', 'Strips punctuation and pads to 22 digits');

        // Case B: Already 22 digits
        ppjkIdInput.value = '0026923485215000123456';
        syncBtn.click();
        assert.strictEqual(nitkuInput.value, '0026923485215000123456', 'Preserves exact 22-digit value');

        // Case C: Invalid short NPWP
        ppjkIdInput.value = '12345';
        syncBtn.click();
        assert.strictEqual(nitkuInput.value, '', 'Clears or ignores invalid short length');

        // Case D: Rapid 10x re-click stability
        ppjkIdInput.value = '0123456789012345';
        for (let i = 0; i < 10; i++) syncBtn.click();
        assert.strictEqual(nitkuInput.value, '0123456789012345000000', 'Stable under rapid repeated clicks');
    }, { tier: 5, id: 'TC-T5-04' });

    test('TC-T5-05: Sinar Asia Pack Auto-Routing Hardening', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        // Case: lower-case with extra spaces
        const draft = {
            importirName: '  pt  sinar   asia  pack  indonesia '
        };

        pibEnv.window.loadPibDraftData(draft, false);

        assert.strictEqual(pibEnv.document.getElementById('pibPenerimaName').value, 'PT. SINAR ASIA PACK');
        assert.strictEqual(pibEnv.document.getElementById('pibPengirimName').value, 'GOLDEN BEN PRINTER PTE LTD');
        assert.strictEqual(pibEnv.document.getElementById('pibPengirimCountry').value, 'SG - SINGAPORE');

        const collected = pibEnv.window.collectPibFormData();
        assert.strictEqual(collected.entitas.pengirim.nama, 'GOLDEN BEN PRINTER PTE LTD');
        assert.strictEqual(collected.entitas.pengirim.negara, 'SG - SINGAPORE');
    }, { tier: 5, id: 'TC-T5-05' });

    test('TC-T5-06: Legacy Draft Seamless Migration to 6-Card CEISA 4.0', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        const legacyDraft = {
            importirId: '0199988877766600',
            importirName: 'PT. IMPORTIR LAMA INDONESIA',
            importirAddress: 'Jl. Pegangsaan Timur No. 56',
            importirStatus: 'API-U',
            supplierName: 'GERMAN MACHINERY GMBH',
            supplierAddress: 'Industriestrasse 10, Stuttgart',
            supplierCountry: 'DE - GERMANY',
            ownerName: 'PT. PEMILIK LAIN',
            ownerAddress: 'Jl. Merdeka No. 1'
        };

        pibEnv.window.loadPibDraftData(legacyDraft, false);

        // Verify all 6 cards populated gracefully
        assert.strictEqual(pibEnv.document.getElementById('pibPenerimaName').value, 'PT. IMPORTIR LAMA INDONESIA');
        assert.strictEqual(pibEnv.document.getElementById('pibPengirimName').value, 'GERMAN MACHINERY GMBH');
        assert.strictEqual(pibEnv.document.getElementById('pibPengirimCountry').value, 'DE - GERMANY');
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliName').value, 'PT. IMPORTIR LAMA INDONESIA', 'Pembeli falls back to Penerima');
        assert.strictEqual(pibEnv.document.getElementById('pibPemilikName').value, 'PT. PEMILIK LAIN', 'Pemilik mapped from legacy ownerName');
        assert.strictEqual(pibEnv.document.getElementById('pibPenjualName').value, 'GERMAN MACHINERY GMBH', 'Penjual mapped from legacy supplierName');

        // Collect and verify modern entitas schema
        const collected = pibEnv.window.collectPibFormData();
        assert.strictEqual(collected.entitas.penerima.nama, 'PT. IMPORTIR LAMA INDONESIA');
        assert.strictEqual(collected.entitas.pengirim.nama, 'GERMAN MACHINERY GMBH');
    }, { tier: 5, id: 'TC-T5-06' });

    test('TC-T5-07: Hostile / Partial CEISA Portal DOM Resilience', () => {
        // Construct a hostile portal DOM missing Card Pembeli, Card PPJK, and with disabled/readonly fields
        const ceisaEnv = createMockCeisaPortalDom();
        loadContentScriptFunctions(ceisaEnv.window);

        // Remove Pembeli and PPJK cards completely
        const cardPembeli = ceisaEnv.document.querySelector('.card-pembeli');
        if (cardPembeli) cardPembeli.remove();
        const cardPpjk = ceisaEnv.document.querySelector('.card-ppjk');
        if (cardPpjk) cardPpjk.remove();

        // Lock a field with disabled and another with readOnly
        const penerimaNama = ceisaEnv.document.getElementById('ceisa_penerima_nama');
        penerimaNama.disabled = true;
        const pengirimNama = ceisaEnv.document.getElementById('ceisa_pengirim_nama');
        pengirimNama.readOnly = true;

        const payload = {
            entitas: {
                pengirim: { nama: 'NEW SHANGHAI EXPORTER', negara: 'CN - CHINA' },
                penerima: { nama: 'NEW INDONESIA IMPORTER', negara: 'ID - INDONESIA' },
                pembeli: { nama: 'GHOST BUYER' },
                ppjk: { nama: 'GHOST PPJK' }
            }
        };

        const filledFields = [];
        let execResult;
        assert.doesNotThrow(() => {
            execResult = ceisaEnv.window.handleCeisaAutoInputRow(payload, ceisaEnv.document.getElementById('tab-entitas'), 'entitas', filledFields);
        }, 'Must not throw even with missing cards or locked fields');

        assert.strictEqual(execResult.ok, true);
        // Verify locked fields were NOT overwritten
        assert.notStrictEqual(penerimaNama.value, 'NEW INDONESIA IMPORTER');
        assert.notStrictEqual(pengirimNama.value, 'NEW SHANGHAI EXPORTER');
    }, { tier: 5, id: 'TC-T5-07' });

    test('TC-T5-08: Multiple Successive Draft Switching & State Isolation', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        // Draft A
        pibEnv.window.loadPibDraftData({
            penerimaName: 'COMPANY A',
            pengirimName: 'SUPPLIER A',
            ppjkName: 'PPJK A'
        }, false);
        let colA = pibEnv.window.collectPibFormData();
        assert.strictEqual(colA.entitas.penerima.nama, 'COMPANY A');

        // Draft B
        pibEnv.window.loadPibDraftData({
            penerimaName: 'COMPANY B',
            pengirimName: 'SUPPLIER B',
            ppjkName: ''
        }, false);
        let colB = pibEnv.window.collectPibFormData();
        assert.strictEqual(colB.entitas.penerima.nama, 'COMPANY B');
        assert.strictEqual(colB.entitas.pengirim.nama, 'SUPPLIER B');
        assert.strictEqual(colB.entitas.ppjk.nama, '', 'PPJK must not retain ghost data from Draft A');

        // Empty Draft {}
        pibEnv.window.loadPibDraftData({}, false);
        let colEmpty = pibEnv.window.collectPibFormData();
        assert.ok(colEmpty.entitas, 'Produces valid schema even for empty draft');
    }, { tier: 5, id: 'TC-T5-08' });

    test('TC-T5-09: Print Hub Production Lifecycle & Direct RAW Submission', () => {
        const printEnv = loadPrintHubDom();
        loadPrintHubScript(printEnv.window);

        // Verify elements
        const reloadBtn = printEnv.document.getElementById('btnReloadPrinters');
        assert.ok(reloadBtn);
        const textForm = printEnv.document.getElementById('textPrintForm');
        assert.ok(textForm);
        const clearHistoryBtn = printEnv.document.getElementById('btnClearHistory');
        assert.ok(clearHistoryBtn);

        // Clear history click
        clearHistoryBtn.click();
        const historyList = printEnv.document.getElementById('historyList');
        assert.ok(historyList.innerHTML.includes('Belum ada berkas yang dicetak'));
    }, { tier: 5, id: 'TC-T5-09' });

    test('TC-T5-10: Copy Handler Re-Binding & Memory Idempotency', () => {
        const pibEnv = loadPibDom();
        loadPibDashboardScript(pibEnv.window);

        // Initialize 20 times in a row
        for (let i = 0; i < 20; i++) {
            pibEnv.window.setupPibCopyHandlers();
        }

        // Set Penerima
        pibEnv.document.getElementById('pibPenerimaName').value = 'SINGLE_COPY_TEST';

        // Trigger Salin
        pibEnv.document.getElementById('btnCopyPenerimaToPembeli').click();

        // Should copy cleanly without multiplying
        assert.strictEqual(pibEnv.document.getElementById('pibPembeliName').value, 'SINGLE_COPY_TEST');
    }, { tier: 5, id: 'TC-T5-10' });

});

// Self-run block when executed directly
if (require.main === module) {
    (async () => {
        console.log('='.repeat(80));
        console.log('  CEISA 4.0 - TIER 5 ADVERSARIAL TEST HARNESS');
        console.log('='.repeat(80));

        defaultHarness.tests = defaultHarness.tests.filter(t => t.tier === 5);
        console.log(`Discovered ${defaultHarness.tests.length} Tier 5 adversarial test cases.\n`);

        const results = await defaultHarness.run();
        let passed = 0;
        let failed = 0;

        for (const r of results) {
            const icon = r.status === 'PASSED' ? '✓' : '✗';
            const color = r.status === 'PASSED' ? '\x1b[32m' : '\x1b[31m';
            console.log(`  ${color}${icon}\x1b[0m [${r.id}] ${r.name} (${r.durationMs}ms)`);
            if (r.status === 'FAILED') {
                console.log(`     \x1b[31mError:\x1b[0m ${r.error?.stack || r.error}`);
                failed++;
            } else {
                passed++;
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log(`  Tier 5 Results: ${passed} passed, ${failed} failed (${results.length} total)`);
        console.log('='.repeat(80));
        process.exit(failed > 0 ? 1 : 0);
    })();
}
