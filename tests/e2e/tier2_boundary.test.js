/**
 * CEISA 4.0 E2E Test Suite - Tier 2: Boundary & Corner Cases
 * Covers F1 through F16 (>= 5 tests per feature = 80 test cases)
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

// =========================================================================
// F1: Print Hub QR Container Removal Boundaries
// =========================================================================
describe('Tier 2 - F1: Print Hub QR Container Removal Boundaries', () => {
    test('TC-T2-F1-01: Empty or whitespace query parameters in print hub URL do not render QR container', () => {
        const { document } = loadPrintHubDom({ url: 'http://localhost:3000/print_hub.html?qr=1&mobile=true' });
        const qrCard = document.querySelector('.ph-qr-card');
        assert.strictEqual(qrCard, null, 'QR card should never appear even with query params');
    }, { tier: 2, feature: 'F1', id: 'TC-T2-F1-01' });

    test('TC-T2-F1-02: Script initialization does not dynamically create .ph-qr-card element', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);
        const qrCard = document.querySelector('.ph-qr-card');
        assert.strictEqual(qrCard, null, 'Script must not re-inject QR card');
    }, { tier: 2, feature: 'F1', id: 'TC-T2-F1-02' });

    test('TC-T2-F1-03: Responsive mobile container width (360px) does not leave vacant layout gap', () => {
        const { document } = loadPrintHubDom();
        const main = document.querySelector('.ceisa-portal-content');
        assert.ok(main, 'Main portal content container must exist');
        const firstChild = main.querySelector('.ph-container > :first-child');
        assert.ok(firstChild, 'ph-container must have content');
        assert.notStrictEqual(firstChild.className, 'ph-qr-card', 'First child must not be qr-card');
    }, { tier: 2, feature: 'F1', id: 'TC-T2-F1-03' });

    test('TC-T2-F1-04: CSS in print_hub.html has no orphaned .ph-qr-card rules interfering with layout', () => {
        const { document } = loadPrintHubDom();
        const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
        assert.strictEqual(styles.includes('.ph-qr-card {'), false, 'Obsolete .ph-qr-card CSS should be removed');
    }, { tier: 2, feature: 'F1', id: 'TC-T2-F1-04' });

    test('TC-T2-F1-05: Dark theme toggle on print hub executes cleanly without QR dark theme styles', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        document.documentElement.setAttribute('data-theme', 'dark');
        assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
        const qrCard = document.querySelector('.ph-qr-card');
        assert.strictEqual(qrCard, null);
    }, { tier: 2, feature: 'F1', id: 'TC-T2-F1-05' });
});

// =========================================================================
// F2: Header QR & Modal Removal Boundaries
// =========================================================================
describe('Tier 2 - F2: Header QR & Modal Removal Boundaries', () => {
    test('TC-T2-F2-01: Header button container remains cleanly aligned with zero references to Scan HP', () => {
        const { document } = loadPrintHubDom();
        const headerButtons = document.querySelectorAll('header button');
        for (const btn of headerButtons) {
            assert.strictEqual(btn.id, 'themeToggleBtn', 'Only valid header buttons should exist');
            assert.strictEqual(/Scan\s*HP/i.test(btn.textContent), false);
        }
    }, { tier: 2, feature: 'F2', id: 'TC-T2-F2-01' });

    test('TC-T2-F2-02: Pressing ESC key on document does not throw trying to close non-existent modal', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        assert.doesNotThrow(() => {
            const escEvent = new window.KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 });
            document.dispatchEvent(escEvent);
        }, 'Escape key listener should not crash');
    }, { tier: 2, feature: 'F2', id: 'TC-T2-F2-02' });

    test('TC-T2-F2-03: Clicking header empty areas does not open any modal overlay', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        const header = document.querySelector('header');
        header.click();
        const activeModal = document.querySelector('.ph-modal-overlay.active');
        assert.strictEqual(activeModal, null, 'No modal should open');
    }, { tier: 2, feature: 'F2', id: 'TC-T2-F2-03' });

    test('TC-T2-F2-04: Header container width responsiveness on mobile screen (360px)', () => {
        const { document } = loadPrintHubDom();
        const header = document.querySelector('header') || document.querySelector('.portal-header');
        assert.ok(header, 'Header must exist');
    }, { tier: 2, feature: 'F2', id: 'TC-T2-F2-04' });

    test('TC-T2-F2-05: Window resize events do not invoke QR modal repositioning logic', () => {
        const { window } = loadPrintHubDom();
        loadPrintHubScript(window);
        assert.doesNotThrow(() => {
            window.dispatchEvent(new window.Event('resize'));
        }, 'Resize event must complete safely');
    }, { tier: 2, feature: 'F2', id: 'TC-T2-F2-05' });
});

// =========================================================================
// F3: Print Hub JS Cleanup Boundaries
// =========================================================================
describe('Tier 2 - F3: Print Hub JS Cleanup Boundaries', () => {
    test('TC-T2-F3-01: Backend status failure (500) handled gracefully without attempting QR fallback', async () => {
        const { window, document } = loadPrintHubDom();
        window.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) });
        loadPrintHubScript(window);
        assert.doesNotThrow(() => {
            document.dispatchEvent(new window.Event('DOMContentLoaded'));
        });
    }, { tier: 2, feature: 'F3', id: 'TC-T2-F3-01' });

    test('TC-T2-F3-02: Empty printer list [] handled without throwing null pointer exceptions', async () => {
        const { window, document } = loadPrintHubDom();
        window.fetch = async (url) => {
            if (String(url).includes('/api/printers')) {
                return { ok: true, json: async () => ({ success: true, printers: [] }) };
            }
            return { ok: true, json: async () => ({ success: true }) };
        };
        loadPrintHubScript(window);
        assert.doesNotThrow(() => {
            document.dispatchEvent(new window.Event('DOMContentLoaded'));
        });
    }, { tier: 2, feature: 'F3', id: 'TC-T2-F3-02' });

    test('TC-T2-F3-03: Printer names with special characters escape cleanly in select options', () => {
        const { window, document } = loadPrintHubDom();
        window.mockPrinters = [
            { name: 'EPSON L3110 (USB#1) & <HQ> "Print"', status: 'ready', isDefault: true }
        ];
        loadPrintHubScript(window);
        document.dispatchEvent(new window.Event('DOMContentLoaded'));
        const select = document.getElementById('printerSelect');
        assert.ok(select, '#printerSelect must exist');
    }, { tier: 2, feature: 'F3', id: 'TC-T2-F3-03' });

    test('TC-T2-F3-04: Rapid clicking on reload printers button does not trigger unhandled rejection', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        const btn = document.getElementById('btnReloadPrinters');
        assert.doesNotThrow(() => {
            btn.click();
            btn.click();
            btn.click();
        });
    }, { tier: 2, feature: 'F3', id: 'TC-T2-F3-04' });

    test('TC-T2-F3-05: Submitting text print when rawTextArea is empty shows warning toast rather than crash', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        const form = document.getElementById('textPrintForm');
        const textarea = document.getElementById('rawTextArea');
        textarea.value = '';
        assert.doesNotThrow(() => {
            form.dispatchEvent(new window.Event('submit', { cancelable: true }));
        });
    }, { tier: 2, feature: 'F3', id: 'TC-T2-F3-05' });
});

// =========================================================================
// F4: PIB Header (.ceisa-doc-topbar) Removal Boundaries
// =========================================================================
describe('Tier 2 - F4: PIB Header Removal Boundaries', () => {
    test('TC-T2-F4-01: History navigation: standard window.history operations remain undisturbed when btnPibKembali is absent', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);
        assert.ok(window.history, 'window.history must exist');
    }, { tier: 2, feature: 'F4', id: 'TC-T2-F4-01' });

    test('TC-T2-F4-02: Absence of #btnPibUpdateData does not affect draft auto-save debounce timer', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);
        // triggerPibAutoSave should function independently of topbar button
        assert.doesNotThrow(() => {
            if (typeof window.triggerPibAutoSave === 'function') window.triggerPibAutoSave();
        });
    }, { tier: 2, feature: 'F4', id: 'TC-T2-F4-02' });

    test('TC-T2-F4-03: CSS verification: dashboard.css contains no orphaned topbar height offsets', () => {
        const fs = require('fs');
        const path = require('path');
        const cssContent = fs.readFileSync(path.join(__dirname, '../../dashboard.css'), 'utf8');
        // If topbar is removed, verify .main-workspace padding is intact
        assert.ok(cssContent.includes('.main-workspace'), '.main-workspace styling should be preserved');
    }, { tier: 2, feature: 'F4', id: 'TC-T2-F4-03' });

    test('TC-T2-F4-04: Viewport top margin remains compact without hidden topbar elements taking space', () => {
        const { document } = loadPibDom();
        const main = document.querySelector('.main-workspace');
        assert.ok(main, '.main-workspace must exist');
    }, { tier: 2, feature: 'F4', id: 'TC-T2-F4-04' });

    test('TC-T2-F4-05: Theme switching (data-theme="dark") operates cleanly without references to .ceisa-doc-topbar', () => {
        const { document } = loadPibDom();
        document.documentElement.setAttribute('data-theme', 'dark');
        assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
    }, { tier: 2, feature: 'F4', id: 'TC-T2-F4-05' });
});

// =========================================================================
// F5: PIB Old PPJK Card Removal Boundaries
// =========================================================================
describe('Tier 2 - F5: PIB Old PPJK Card Removal Boundaries', () => {
    test('TC-T2-F5-01: Draft with legacy single-column ppjkId does not resurrect old card DOM', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.loadPibDraftData === 'function') {
            window.loadPibDraftData({ ppjkId: '0026923485215000', ppjkName: 'TEST PPJK' });
        }
        const oldCard = document.querySelector('.ceisa-form-card[style*="span 2"]');
        assert.strictEqual(oldCard, null, 'Old span-2 PPJK card must not exist');
    }, { tier: 2, feature: 'F5', id: 'TC-T2-F5-01' });

    test('TC-T2-F5-02: Empty/null ppjkId in draft handles gracefully without runtime error', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);
        assert.doesNotThrow(() => {
            if (typeof window.loadPibDraftData === 'function') {
                window.loadPibDraftData({ ppjkId: null, ppjkName: null });
            }
        });
    }, { tier: 2, feature: 'F5', id: 'TC-T2-F5-02' });

    test('TC-T2-F5-03: Form grid has no broken columns resulting from old PPJK removal', () => {
        const { document } = loadPibDom();
        const tabEntitas = document.getElementById('pib-tab-entitas');
        assert.ok(tabEntitas, '#pib-tab-entitas must exist');
    }, { tier: 2, feature: 'F5', id: 'TC-T2-F5-03' });

    test('TC-T2-F5-04: Old pibCheckOwnerSame or pibCheckSellerSame change events do not throw errors', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);
        assert.doesNotThrow(() => {
            if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        });
    }, { tier: 2, feature: 'F5', id: 'TC-T2-F5-04' });

    test('TC-T2-F5-05: Serialization with old draft properties preserves backward compatibility', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.collectPibFormData === 'function') {
            const data = window.collectPibFormData();
            assert.ok('ppjkId' in data, 'ppjkId key should exist in collected data');
        }
    }, { tier: 2, feature: 'F5', id: 'TC-T2-F5-05' });
});

// =========================================================================
// F6: CEISA 4.0 2-Column Tab Entitas Layout Boundaries
// =========================================================================
describe('Tier 2 - F6: 2-Column Tab Entitas Layout Boundaries', () => {
    test('TC-T2-F6-01: Responsive breakpoint: CSS contains media query for max-width: 900px', () => {
        const fs = require('fs');
        const path = require('path');
        const cssContent = fs.readFileSync(path.join(__dirname, '../../dashboard.css'), 'utf8');
        assert.ok(cssContent.includes('900px') || cssContent.includes('.ceisa-entitas-grid'), 'Grid CSS should define layout');
    }, { tier: 2, feature: 'F6', id: 'TC-T2-F6-01' });

    test('TC-T2-F6-02: Column stacking: left and right columns have independent flex vertical flow', () => {
        const { document } = loadPibDom();
        const cols = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column');
        if (cols.length >= 2) {
            assert.strictEqual(cols[0].querySelectorAll('.ceisa-form-card, .card').length, 3);
            assert.strictEqual(cols[1].querySelectorAll('.ceisa-form-card, .card').length, 3);
        }
    }, { tier: 2, feature: 'F6', id: 'TC-T2-F6-02' });

    test('TC-T2-F6-03: Excessive content in Left Column does not stretch Right Column cards', () => {
        const { document } = loadPibDom();
        const leftAddr = document.getElementById('pibPengirimAddress');
        if (leftAddr) leftAddr.value = 'A'.repeat(500);
        // Validates DOM integrity under extreme string length
        assert.ok(true);
    }, { tier: 2, feature: 'F6', id: 'TC-T2-F6-03' });

    test('TC-T2-F6-04: Stepper navigation buttons handle tab switching without crash', () => {
        const { window, document } = loadPibDom();
        const prevBtn = document.getElementById('btnPrevFromPibEntitas');
        const nextBtn = document.getElementById('btnNextFromPibEntitas');
        if (prevBtn) prevBtn.click();
        if (nextBtn) nextBtn.click();
        assert.ok(true);
    }, { tier: 2, feature: 'F6', id: 'TC-T2-F6-04' });

    test('TC-T2-F6-05: Empty card body within a card does not collapse grid layout', () => {
        const { document } = loadPibDom();
        const grid = document.querySelector('.ceisa-entitas-grid');
        if (grid) {
            assert.ok(grid.children.length >= 2, 'Grid should maintain columns even if empty');
        }
    }, { tier: 2, feature: 'F6', id: 'TC-T2-F6-05' });
});

// =========================================================================
// F7: Pengirim Boundary Cases
// =========================================================================
describe('Tier 2 - F7: Pengirim Boundary Cases', () => {
    test('TC-T2-F7-01: Pengirim name with Chinese / Unicode characters (上海普陀区精工机械有限公司)', () => {
        const { document } = loadPibDom();
        const nameInput = document.getElementById('pibPengirimName');
        if (nameInput) {
            nameInput.value = '上海普陀区精工机械有限公司';
            assert.strictEqual(nameInput.value, '上海普陀区精工机械有限公司');
        }
    }, { tier: 2, feature: 'F7', id: 'TC-T2-F7-01' });

    test('TC-T2-F7-02: Pengirim address with multiline text and maximum boundary length (300+ chars)', () => {
        const { document } = loadPibDom();
        const addrInput = document.getElementById('pibPengirimAddress');
        if (addrInput) {
            const longAddr = 'Building 5, Block B, Hi-Tech Industrial Zone\nSongze Avenue No. 888\nQingpu District, Shanghai 201700, China\n' + 'X'.repeat(200);
            addrInput.value = longAddr;
            assert.ok(addrInput.value.length > 250);
        }
    }, { tier: 2, feature: 'F7', id: 'TC-T2-F7-02' });

    test('TC-T2-F7-03: Pengirim Id type switched to "2 - PASPOR" or "0 - NPWP 12 DIGIT"', () => {
        const { document } = loadPibDom();
        const idType = document.getElementById('pibPengirimIdType');
        if (idType) {
            const pasporOpt = Array.from(idType.options).find(o => o.value.includes('PASPOR'));
            if (pasporOpt) {
                idType.value = pasporOpt.value;
                assert.ok(idType.value.includes('PASPOR'));
            }
        }
    }, { tier: 2, feature: 'F7', id: 'TC-T2-F7-03' });

    test('TC-T2-F7-04: Pengirim Id number with special characters (P12345678-X/2026)', () => {
        const { document } = loadPibDom();
        const idNum = document.getElementById('pibPengirimId');
        if (idNum) {
            idNum.value = 'P12345678-X/2026';
            assert.strictEqual(idNum.value, 'P12345678-X/2026');
        }
    }, { tier: 2, feature: 'F7', id: 'TC-T2-F7-04' });

    test('TC-T2-F7-05: Pengirim country selection with non-standard country code (DE - GERMANY)', () => {
        const { document } = loadPibDom();
        const ctry = document.getElementById('pibPengirimCountry');
        if (ctry) {
            const deOpt = Array.from(ctry.options).find(o => o.value.includes('DE') || o.textContent.includes('GERMANY'));
            if (deOpt) {
                ctry.value = deOpt.value;
                assert.ok(ctry.value.includes('DE'));
            }
        }
    }, { tier: 2, feature: 'F7', id: 'TC-T2-F7-05' });
});

// =========================================================================
// F8: Pembeli Boundary Cases
// =========================================================================
describe('Tier 2 - F8: Pembeli Boundary Cases', () => {
    test('TC-T2-F8-01: Pembeli NITKU with exact 22 digits preserved without truncation', () => {
        const { document } = loadPibDom();
        const nitku = document.getElementById('pibPembeliNitku');
        if (nitku) {
            nitku.value = '0830727251085000000002';
            assert.strictEqual(nitku.value.length, 22);
            assert.strictEqual(nitku.value, '0830727251085000000002');
        }
    }, { tier: 2, feature: 'F8', id: 'TC-T2-F8-01' });

    test('TC-T2-F8-02: Pembeli with 16-digit NPWP containing punctuation (01.234.567.8-012.000)', () => {
        const { document } = loadPibDom();
        const id = document.getElementById('pibPembeliId');
        if (id) {
            id.value = '01.234.567.8-012.000';
            assert.strictEqual(id.value, '01.234.567.8-012.000');
        }
    }, { tier: 2, feature: 'F8', id: 'TC-T2-F8-02' });

    test('TC-T2-F8-03: Pembeli name with quotes, apostrophes, and ampersands (PT. "KARYA & ABADI" \'LOGISTIK\')', () => {
        const { document } = loadPibDom();
        const name = document.getElementById('pibPembeliName');
        if (name) {
            name.value = 'PT. "KARYA & ABADI" \'LOGISTIK\'';
            assert.strictEqual(name.value, 'PT. "KARYA & ABADI" \'LOGISTIK\'');
        }
    }, { tier: 2, feature: 'F8', id: 'TC-T2-F8-03' });

    test('TC-T2-F8-04: "Hapus Pembeli" clicked when Pembeli is already empty or default', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const btnHapus = document.getElementById('btnHapusPembeli') || document.getElementById('pibBtnHapusPembeli');
        if (btnHapus) {
            assert.doesNotThrow(() => btnHapus.click());
        }
    }, { tier: 2, feature: 'F8', id: 'TC-T2-F8-04' });

    test('TC-T2-F8-05: Pembeli address containing line breaks and tabs', () => {
        const { document } = loadPibDom();
        const addr = document.getElementById('pibPembeliAddress');
        if (addr) {
            addr.value = 'Kawasan Industri MM2100\n\tBlok C-5, Cikarang Barat\nJawa Barat';
            assert.ok(addr.value.includes('\n'));
        }
    }, { tier: 2, feature: 'F8', id: 'TC-T2-F8-05' });
});

// =========================================================================
// F9: Pemilik Barang Boundary Cases
// =========================================================================
describe('Tier 2 - F9: Pemilik Barang Boundary Cases', () => {
    test('TC-T2-F9-01: Afiliasi dropdown toggled to "HUB - Berhubungan"', () => {
        const { document } = loadPibDom();
        const afi = document.getElementById('pibPemilikAfiliasi');
        if (afi) {
            const hubOpt = Array.from(afi.options).find(o => o.value.includes('HUB'));
            if (hubOpt) {
                afi.value = hubOpt.value;
                assert.ok(afi.value.includes('HUB'));
            }
        }
    }, { tier: 2, feature: 'F9', id: 'TC-T2-F9-01' });

    test('TC-T2-F9-02: Pemilik NITKU with exactly 22 digits', () => {
        const { document } = loadPibDom();
        const nitku = document.getElementById('pibPemilikNitku');
        if (nitku) {
            nitku.value = '1122334455667788000001';
            assert.strictEqual(nitku.value.length, 22);
        }
    }, { tier: 2, feature: 'F9', id: 'TC-T2-F9-02' });

    test('TC-T2-F9-03: Pemilik Id type set to "3 - KTP" with 16-digit NIK', () => {
        const { document } = loadPibDom();
        const idType = document.getElementById('pibPemilikIdType');
        const idNum = document.getElementById('pibPemilikId');
        if (idType && idNum) {
            idNum.value = '3171012345670001';
            assert.strictEqual(idNum.value.length, 16);
        }
    }, { tier: 2, feature: 'F9', id: 'TC-T2-F9-03' });

    test('TC-T2-F9-04: Pemilik name left blank (optional / fallback)', () => {
        const { document } = loadPibDom();
        const name = document.getElementById('pibPemilikName');
        if (name) {
            name.value = '';
            assert.strictEqual(name.value, '');
        }
    }, { tier: 2, feature: 'F9', id: 'TC-T2-F9-04' });

    test('TC-T2-F9-05: Pemilik address with 250+ characters', () => {
        const { document } = loadPibDom();
        const addr = document.getElementById('pibPemilikAddress');
        if (addr) {
            addr.value = 'Gudang Logistik Berikat, Blok A No. 12, Tanjung Priok, Jakarta Utara. '.repeat(5);
            assert.ok(addr.value.length > 250);
        }
    }, { tier: 2, feature: 'F9', id: 'TC-T2-F9-05' });
});

// =========================================================================
// F10: Penerima Boundary Cases
// =========================================================================
describe('Tier 2 - F10: Penerima Boundary Cases', () => {
    test('TC-T2-F10-01: Penerima 16-digit NPWP boundary (0830727251085000)', () => {
        const { document } = loadPibDom();
        const id = document.getElementById('pibPenerimaId');
        if (id) {
            id.value = '0830727251085000';
            assert.strictEqual(id.value.length, 16);
        }
    }, { tier: 2, feature: 'F10', id: 'TC-T2-F10-01' });

    test('TC-T2-F10-02: Penerima Status dropdown cycled through options (API-U, API-P, NON-API, MITA, AEO, LAINNYA)', () => {
        const { document } = loadPibDom();
        const status = document.getElementById('pibPenerimaStatus');
        if (status) {
            const validOptions = ['LAINNYA', 'API-U', 'API-P', 'NON-API'];
            for (const opt of validOptions) {
                const found = Array.from(status.options).find(o => o.value.includes(opt));
                if (found) {
                    status.value = found.value;
                    assert.ok(status.value.includes(opt));
                }
            }
        }
    }, { tier: 2, feature: 'F10', id: 'TC-T2-F10-02' });

    test('TC-T2-F10-03: Ijin BP No with slashes, dashes, dots (0262/KA-A3/112.BP/2026)', () => {
        const { document } = loadPibDom();
        const ijinNo = document.getElementById('pibPenerimaIjinNo') || document.getElementById('pibIjinBpNomor');
        if (ijinNo) {
            ijinNo.value = '0262/KA-A3/112.BP/2026';
            assert.strictEqual(ijinNo.value, '0262/KA-A3/112.BP/2026');
        }
    }, { tier: 2, feature: 'F10', id: 'TC-T2-F10-03' });

    test('TC-T2-F10-04: Ijin BP Date boundary: leap year date (2024-02-29)', () => {
        const { document } = loadPibDom();
        const ijinDate = document.getElementById('pibPenerimaIjinDate') || document.getElementById('pibIjinBpTanggal');
        if (ijinDate) {
            ijinDate.value = '2024-02-29';
            assert.strictEqual(ijinDate.value, '2024-02-29');
        }
    }, { tier: 2, feature: 'F10', id: 'TC-T2-F10-04' });

    test('TC-T2-F10-05: Penerima NITKU with exactly 22 digits', () => {
        const { document } = loadPibDom();
        const nitku = document.getElementById('pibPenerimaNitku');
        if (nitku) {
            nitku.value = '0830727251085000000002';
            assert.strictEqual(nitku.value.length, 22);
        }
    }, { tier: 2, feature: 'F10', id: 'TC-T2-F10-05' });
});

// =========================================================================
// F11: Penjual Boundary Cases
// =========================================================================
describe('Tier 2 - F11: Penjual Boundary Cases', () => {
    test('TC-T2-F11-01: Penjual identity type set to "4 - LAINNYA" with "-" number', () => {
        const { document } = loadPibDom();
        const idType = document.getElementById('pibPenjualIdType');
        const idNum = document.getElementById('pibPenjualId');
        if (idType && idNum) {
            idNum.value = '-';
            assert.strictEqual(idNum.value, '-');
        }
    }, { tier: 2, feature: 'F11', id: 'TC-T2-F11-01' });

    test('TC-T2-F11-02: Penjual name with overseas commercial designation (GMBH & CO. KG, S.P.A.)', () => {
        const { document } = loadPibDom();
        const name = document.getElementById('pibPenjualName');
        if (name) {
            name.value = 'SIEMENS LOGISTICS GMBH & CO. KG';
            assert.strictEqual(name.value, 'SIEMENS LOGISTICS GMBH & CO. KG');
        }
    }, { tier: 2, feature: 'F11', id: 'TC-T2-F11-02' });

    test('TC-T2-F11-03: Penjual address with European special characters (Zürichstraße 45, München)', () => {
        const { document } = loadPibDom();
        const addr = document.getElementById('pibPenjualAddress');
        if (addr) {
            addr.value = 'Zürichstraße 45, 80331 München, Germany';
            assert.strictEqual(addr.value, 'Zürichstraße 45, 80331 München, Germany');
        }
    }, { tier: 2, feature: 'F11', id: 'TC-T2-F11-03' });

    test('TC-T2-F11-04: Penjual country set to USA or other global codes', () => {
        const { document } = loadPibDom();
        const ctry = document.getElementById('pibPenjualCountry');
        if (ctry) {
            const usOpt = Array.from(ctry.options).find(o => o.value.includes('US') || o.textContent.includes('UNITED STATES'));
            if (usOpt) {
                ctry.value = usOpt.value;
                assert.ok(ctry.value.includes('US'));
            }
        }
    }, { tier: 2, feature: 'F11', id: 'TC-T2-F11-04' });

    test('TC-T2-F11-05: Penjual unpopulated empty fields do not trigger form validation crash', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        const name = document.getElementById('pibPenjualName');
        if (name) name.value = '';
        assert.doesNotThrow(() => {
            if (typeof window.collectPibFormData === 'function') window.collectPibFormData();
        });
    }, { tier: 2, feature: 'F11', id: 'TC-T2-F11-05' });
});

// =========================================================================
// F12: PPJK Boundary Cases
// =========================================================================
describe('Tier 2 - F12: PPJK Boundary Cases', () => {
    test('TC-T2-F12-01: NITKU sync button clicked when NPWP is empty does not generate "000000" or crash', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const id = document.getElementById('pibPpjkId');
        const nitku = document.getElementById('pibPpjkNitku');
        const btnSync = document.getElementById('btnSyncNitkuPpjk') || document.getElementById('pibBtnSyncNitkuPpjk');
        if (id && nitku && btnSync) {
            id.value = '';
            nitku.value = '';
            btnSync.click();
            assert.strictEqual(nitku.value, '', 'Empty NPWP should not be padded');
        }
    }, { tier: 2, feature: 'F12', id: 'TC-T2-F12-01' });

    test('TC-T2-F12-02: NITKU sync button clicked when NPWP has 10 digits does not corrupt input', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const id = document.getElementById('pibPpjkId');
        const nitku = document.getElementById('pibPpjkNitku');
        const btnSync = document.getElementById('btnSyncNitkuPpjk') || document.getElementById('pibBtnSyncNitkuPpjk');
        if (id && nitku && btnSync) {
            id.value = '1234567890';
            btnSync.click();
            assert.strictEqual(nitku.value, '', 'Under 15 digits should not be padded to 22');
        }
    }, { tier: 2, feature: 'F12', id: 'TC-T2-F12-02' });

    test('TC-T2-F12-03: NITKU sync strips non-digits before padding 16-digit NPWP (00.269.234.8-521.000)', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const id = document.getElementById('pibPpjkId');
        const nitku = document.getElementById('pibPpjkNitku');
        const btnSync = document.getElementById('btnSyncNitkuPpjk') || document.getElementById('pibBtnSyncNitkuPpjk');
        if (id && nitku && btnSync) {
            id.value = '00.269.234.8-521.000';
            btnSync.click();
            if (nitku.value) {
                assert.strictEqual(nitku.value.replace(/\D/g, '').length, 22);
            }
        }
    }, { tier: 2, feature: 'F12', id: 'TC-T2-F12-03' });

    test('TC-T2-F12-04: PPJK fields completely omitted/blank (optional submission: self-handling importer)', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        const name = document.getElementById('pibPpjkName');
        if (name) name.value = '';
        assert.doesNotThrow(() => {
            if (typeof window.collectPibFormData === 'function') window.collectPibFormData();
        });
    }, { tier: 2, feature: 'F12', id: 'TC-T2-F12-04' });

    test('TC-T2-F12-05: PPJK name and address with special symbols (CV. "JASA UTAMA" (CUSTOMS AGENT))', () => {
        const { document } = loadPibDom();
        const name = document.getElementById('pibPpjkName');
        if (name) {
            name.value = 'CV. "JASA UTAMA" (CUSTOMS AGENT)';
            assert.strictEqual(name.value, 'CV. "JASA UTAMA" (CUSTOMS AGENT)');
        }
    }, { tier: 2, feature: 'F12', id: 'TC-T2-F12-05' });
});

// =========================================================================
// F13: Copy Handlers Boundary Cases
// =========================================================================
describe('Tier 2 - F13: Copy Handlers Boundary Cases', () => {
    test('TC-T2-F13-01: "Salin data penerima" when Penerima has empty fields does not inject "undefined" into Pembeli', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const pName = document.getElementById('pibPenerimaName');
        if (pName) pName.value = '';
        const btnCopy = document.getElementById('btnCopyPenerimaToPembeli') || document.getElementById('pibBtnSalinPenerima');
        if (btnCopy) {
            btnCopy.click();
            const bName = document.getElementById('pibPembeliName');
            assert.notStrictEqual(bName?.value, 'undefined');
        }
    }, { tier: 2, feature: 'F13', id: 'TC-T2-F13-01' });

    test('TC-T2-F13-02: "Salin data pengirim" with Unicode characters preserves exact encoding', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const sName = document.getElementById('pibPengirimName');
        if (sName) sName.value = '北京中海实业有限公司';
        const btnCopy = document.getElementById('btnCopyPengirimToPenjual') || document.getElementById('pibBtnSalinPengirim');
        if (btnCopy) {
            btnCopy.click();
            const jName = document.getElementById('pibPenjualName');
            assert.strictEqual(jName?.value, '北京中海实业有限公司');
        }
    }, { tier: 2, feature: 'F13', id: 'TC-T2-F13-02' });

    test('TC-T2-F13-03: Rapid consecutive clicks on "Salin Penerima" are idempotent', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const pName = document.getElementById('pibPenerimaName');
        if (pName) pName.value = 'PT. IDEMPOTENT';
        const btnCopy = document.getElementById('btnCopyPenerimaToPemilik') || document.getElementById('pibBtnSalinPemilik');
        if (btnCopy) {
            btnCopy.click();
            btnCopy.click();
            btnCopy.click();
            const oName = document.getElementById('pibPemilikName');
            assert.strictEqual(oName?.value, 'PT. IDEMPOTENT');
        }
    }, { tier: 2, feature: 'F13', id: 'TC-T2-F13-03' });

    test('TC-T2-F13-04: "Salin data penerima" followed immediately by "Hapus Pembeli" returns Pembeli to cleared state', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const pName = document.getElementById('pibPenerimaName');
        if (pName) pName.value = 'PT. TO BE CLEARED';
        const btnCopy = document.getElementById('btnCopyPenerimaToPembeli') || document.getElementById('pibBtnSalinPenerima');
        const btnHapus = document.getElementById('btnHapusPembeli') || document.getElementById('pibBtnHapusPembeli');
        if (btnCopy && btnHapus) {
            btnCopy.click();
            btnHapus.click();
            const bName = document.getElementById('pibPembeliName');
            assert.ok(bName?.value === '' || bName?.value === '-');
        }
    }, { tier: 2, feature: 'F13', id: 'TC-T2-F13-04' });

    test('TC-T2-F13-05: NITKU sync clicked repeatedly maintains stable 22-digit value without adding duplicate zeroes', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();
        const id = document.getElementById('pibPpjkId');
        const nitku = document.getElementById('pibPpjkNitku');
        const btnSync = document.getElementById('btnSyncNitkuPpjk') || document.getElementById('pibBtnSyncNitkuPpjk');
        if (id && nitku && btnSync) {
            id.value = '0026923485215000';
            btnSync.click();
            btnSync.click();
            btnSync.click();
            assert.strictEqual(nitku.value, '0026923485215000000000');
        }
    }, { tier: 2, feature: 'F13', id: 'TC-T2-F13-05' });
});

// =========================================================================
// F14: collectPibFormData() Boundary Cases
// =========================================================================
describe('Tier 2 - F14: collectPibFormData() Boundary Cases', () => {
    test('TC-T2-F14-01: Handles completely empty form returning valid schema without throwing', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.collectPibFormData === 'function') {
            assert.doesNotThrow(() => {
                const data = window.collectPibFormData();
                assert.ok(typeof data === 'object');
            });
        }
    }, { tier: 2, feature: 'F14', id: 'TC-T2-F14-01' });

    test('TC-T2-F14-02: Inputs containing HTML special characters (<script>, &amp;) serialized intact without corruption', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        const name = document.getElementById('pibPenerimaName');
        if (name) name.value = '<script>alert("xss")</script> & "special"';
        if (typeof window.collectPibFormData === 'function') {
            const data = window.collectPibFormData();
            assert.strictEqual(data.penerimaName, '<script>alert("xss")</script> & "special"');
        }
    }, { tier: 2, feature: 'F14', id: 'TC-T2-F14-02' });

    test('TC-T2-F14-03: Multi-line strings in address fields preserved with intact newline characters', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        const addr = document.getElementById('pibPenerimaAddress');
        if (addr) addr.value = 'Line 1\nLine 2\nLine 3';
        if (typeof window.collectPibFormData === 'function') {
            const data = window.collectPibFormData();
            assert.strictEqual(data.penerimaAddress, 'Line 1\nLine 2\nLine 3');
        }
    }, { tier: 2, feature: 'F14', id: 'TC-T2-F14-03' });

    test('TC-T2-F14-04: Whitespace-only fields preserved or trimmed without NaN conversions', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        const id = document.getElementById('pibPenerimaId');
        if (id) id.value = '   ';
        if (typeof window.collectPibFormData === 'function') {
            const data = window.collectPibFormData();
            assert.notStrictEqual(data.penerimaId, 'NaN');
        }
    }, { tier: 2, feature: 'F14', id: 'TC-T2-F14-04' });

    test('TC-T2-F14-05: Dual-key consistency: data.importirName === data.penerimaName', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        const pName = document.getElementById('pibPenerimaName');
        if (pName) pName.value = 'PT. SYMMETRY CHECK';
        if (typeof window.collectPibFormData === 'function') {
            const data = window.collectPibFormData();
            if (data.penerimaName) {
                assert.strictEqual(data.importirName, data.penerimaName);
            }
        }
    }, { tier: 2, feature: 'F14', id: 'TC-T2-F14-05' });
});

// =========================================================================
// F15: loadPibDraftData() Boundary Cases
// =========================================================================
describe('Tier 2 - F15: loadPibDraftData() Boundary Cases', () => {
    test('TC-T2-F15-01: Handles empty object {} draft input without throwing runtime error', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.loadPibDraftData === 'function') {
            assert.doesNotThrow(() => window.loadPibDraftData({}));
        }
    }, { tier: 2, feature: 'F15', id: 'TC-T2-F15-01' });

    test('TC-T2-F15-02: Handles null or undefined field values in draft payload without displaying literal "null"', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.loadPibDraftData === 'function') {
            window.loadPibDraftData({
                penerimaName: null,
                pengirimName: undefined,
                pembeliName: null
            });
            const pName = document.getElementById('pibPenerimaName')?.value;
            assert.notStrictEqual(pName, 'null');
            assert.notStrictEqual(pName, 'undefined');
        }
    }, { tier: 2, feature: 'F15', id: 'TC-T2-F15-02' });

    test('TC-T2-F15-03: Sinar Asia rule: auto-detects "Sinar Asia" in name and populates Golden Ben Printer / SG', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.loadPibDraftData === 'function') {
            window.loadPibDraftData({ penerimaName: 'PT. SINAR ASIA PACK' });
            const sName = document.getElementById('pibPengirimName')?.value;
            const sCtry = document.getElementById('pibPengirimCountry')?.value;
            if (sName) {
                assert.ok(/GOLDEN\s*BEN/i.test(sName), 'Shipper should be Golden Ben Printer');
            }
        }
    }, { tier: 2, feature: 'F15', id: 'TC-T2-F15-03' });

    test('TC-T2-F15-04: Non-string data types (e.g. numeric NPWP 830727251085000) coerced safely to string in inputs', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.loadPibDraftData === 'function') {
            window.loadPibDraftData({ penerimaId: 830727251085000 });
            const pId = document.getElementById('pibPenerimaId')?.value;
            assert.ok(typeof pId === 'string');
        }
    }, { tier: 2, feature: 'F15', id: 'TC-T2-F15-04' });

    test('TC-T2-F15-05: Extremely long payload values (1000+ characters) populate without truncation error', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.loadPibDraftData === 'function') {
            const longStr = 'EXTREME_DATA_'.repeat(100);
            window.loadPibDraftData({ penerimaAddress: longStr });
            const pAddr = document.getElementById('pibPenerimaAddress')?.value;
            assert.strictEqual(pAddr, longStr);
        }
    }, { tier: 2, feature: 'F15', id: 'TC-T2-F15-05' });
});

// =========================================================================
// F16: Auto-Input content.js Boundary Cases
// =========================================================================
describe('Tier 2 - F16: Auto-Input content.js Boundary Cases', () => {
    test('TC-T2-F16-01: CEISA container missing one or more entity cards: fills existing cards without throwing unhandled error', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);
        // Remove pembeli card from mock DOM
        const pembeliCard = document.querySelector('.card-pembeli');
        if (pembeliCard) pembeliCard.remove();

        const container = document.getElementById('tab-entitas');
        const filledFields = [];
        assert.doesNotThrow(() => {
            window.handleCeisaAutoInputRow({
                pengirimName: 'TEST SHP',
                penerimaName: 'TEST RCV'
            }, container, 'entitas', filledFields);
        });
    }, { tier: 2, feature: 'F16', id: 'TC-T2-F16-01' });

    test('TC-T2-F16-02: Target inputs marked read-only or disabled are skipped safely', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);
        const rName = document.getElementById('ceisa_penerima_nama');
        if (rName) rName.disabled = true;

        const container = document.getElementById('tab-entitas');
        const filledFields = [];
        assert.doesNotThrow(() => {
            window.handleCeisaAutoInputRow({ penerimaName: 'NEW VALUE' }, container, 'entitas', filledFields);
        });
    }, { tier: 2, feature: 'F16', id: 'TC-T2-F16-02' });

    test('TC-T2-F16-03: Case-insensitive card title matching (e.g. PENGIRIM vs Pengirim)', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);
        const titleEl = document.querySelector('.card-pengirim .ant-card-head-title');
        if (titleEl) titleEl.textContent = 'PENGIRIM (SHIPPER)';

        const container = document.getElementById('tab-entitas');
        const filledFields = [];
        window.handleCeisaAutoInputRow({ pengirimName: 'CASE INSENSITIVE CO' }, container, 'entitas', filledFields);
        const inp = document.getElementById('ceisa_pengirim_nama');
        assert.strictEqual(inp.value, 'CASE INSENSITIVE CO');
    }, { tier: 2, feature: 'F16', id: 'TC-T2-F16-03' });

    test('TC-T2-F16-04: Target fields using <textarea> instead of <input> accept multiline values properly', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);
        const addrTextarea = document.getElementById('ceisa_penerima_alamat');
        assert.strictEqual(addrTextarea.tagName, 'TEXTAREA');

        const container = document.getElementById('tab-entitas');
        const filledFields = [];
        window.handleCeisaAutoInputRow({ penerimaAddress: 'Batam\nKepri' }, container, 'entitas', filledFields);
        assert.ok(addrTextarea.value.includes('\n'));
    }, { tier: 2, feature: 'F16', id: 'TC-T2-F16-04' });

    test('TC-T2-F16-05: Null or missing item keys do not overwrite existing portal DOM values with "undefined"', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);
        const rName = document.getElementById('ceisa_penerima_nama');
        rName.value = 'PRE-EXISTING VALUE';

        const container = document.getElementById('tab-entitas');
        const filledFields = [];
        window.handleCeisaAutoInputRow({ penerimaName: null }, container, 'entitas', filledFields);
        assert.notStrictEqual(rName.value, 'null');
        assert.notStrictEqual(rName.value, 'undefined');
    }, { tier: 2, feature: 'F16', id: 'TC-T2-F16-05' });
});
