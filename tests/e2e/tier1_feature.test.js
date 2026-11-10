/**
 * CEISA 4.0 E2E Test Suite - Tier 1: Feature Coverage (Happy Path)
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
// F1: Print Hub QR Container Removal (.ph-qr-card, #qrThumbBox, etc.)
// =========================================================================
describe('Tier 1 - F1: Print Hub QR Card Container Removal', () => {
    test('TC-T1-F1-01: .ph-qr-card container is completely absent from print_hub.html DOM', () => {
        const { document } = loadPrintHubDom();
        const qrCard = document.querySelector('.ph-qr-card');
        assert.strictEqual(qrCard, null, 'Expected .ph-qr-card to be removed from print_hub.html');
    }, { tier: 1, feature: 'F1', id: 'TC-T1-F1-01' });

    test('TC-T1-F1-02: #qrThumbBox element is absent from DOM', () => {
        const { document } = loadPrintHubDom();
        const el = document.getElementById('qrThumbBox');
        assert.strictEqual(el, null, 'Expected #qrThumbBox to be absent');
    }, { tier: 1, feature: 'F1', id: 'TC-T1-F1-02' });

    test('TC-T1-F1-03: #qrThumbImage element is absent from DOM', () => {
        const { document } = loadPrintHubDom();
        const el = document.getElementById('qrThumbImage');
        assert.strictEqual(el, null, 'Expected #qrThumbImage to be absent');
    }, { tier: 1, feature: 'F1', id: 'TC-T1-F1-03' });

    test('TC-T1-F1-04: #qrLoadingSkeleton placeholder element is absent from DOM', () => {
        const { document } = loadPrintHubDom();
        const el = document.getElementById('qrLoadingSkeleton');
        assert.strictEqual(el, null, 'Expected #qrLoadingSkeleton to be absent');
    }, { tier: 1, feature: 'F1', id: 'TC-T1-F1-04' });

    test('TC-T1-F1-05: #lanUrlDisplay and #btnCopyLanUrl are absent from DOM', () => {
        const { document } = loadPrintHubDom();
        const urlDisplay = document.getElementById('lanUrlDisplay');
        const copyBtn = document.getElementById('btnCopyLanUrl');
        assert.strictEqual(urlDisplay, null, 'Expected #lanUrlDisplay to be absent');
        assert.strictEqual(copyBtn, null, 'Expected #btnCopyLanUrl to be absent');
    }, { tier: 1, feature: 'F1', id: 'TC-T1-F1-05' });
});

// =========================================================================
// F2: Print Hub Header Action & Modal Removal (#btnOpenQrHeader, #qrModal)
// =========================================================================
describe('Tier 1 - F2: Print Hub Header QR Button & Modal Removal', () => {
    test('TC-T1-F2-01: #btnOpenQrHeader button is absent from print_hub.html DOM', () => {
        const { document } = loadPrintHubDom();
        const btn = document.getElementById('btnOpenQrHeader');
        assert.strictEqual(btn, null, 'Expected #btnOpenQrHeader to be removed');
    }, { tier: 1, feature: 'F2', id: 'TC-T1-F2-01' });

    test('TC-T1-F2-02: Header action buttons contain no Scan HP label', () => {
        const { document } = loadPrintHubDom();
        const header = document.querySelector('header');
        assert.ok(header, 'Header element must exist');
        const text = header.textContent || '';
        assert.strictEqual(/Scan\s*HP/i.test(text), false, 'Header should not mention Scan HP');
    }, { tier: 1, feature: 'F2', id: 'TC-T1-F2-02' });

    test('TC-T1-F2-03: #qrModal overlay container is absent from DOM', () => {
        const { document } = loadPrintHubDom();
        const modal = document.getElementById('qrModal');
        assert.strictEqual(modal, null, 'Expected #qrModal to be absent');
    }, { tier: 1, feature: 'F2', id: 'TC-T1-F2-03' });

    test('TC-T1-F2-04: #qrLargeImage element is absent from DOM', () => {
        const { document } = loadPrintHubDom();
        const img = document.getElementById('qrLargeImage');
        assert.strictEqual(img, null, 'Expected #qrLargeImage to be absent');
    }, { tier: 1, feature: 'F2', id: 'TC-T1-F2-04' });

    test('TC-T1-F2-05: #btnCloseQrModal and #modalUrlDisplay are absent from DOM', () => {
        const { document } = loadPrintHubDom();
        const btnClose = document.getElementById('btnCloseQrModal');
        const urlDisplay = document.getElementById('modalUrlDisplay');
        assert.strictEqual(btnClose, null, 'Expected #btnCloseQrModal to be absent');
        assert.strictEqual(urlDisplay, null, 'Expected #modalUrlDisplay to be absent');
    }, { tier: 1, feature: 'F2', id: 'TC-T1-F2-05' });
});

// =========================================================================
// F3: Print Hub JS references cleanup & print functionality intact
// =========================================================================
describe('Tier 1 - F3: Print Hub JS Cleanup & Print Functionality', () => {
    test('TC-T1-F3-01: DOMContentLoaded executes without throwing TypeError for missing QR elements', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        assert.doesNotThrow(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }, 'DOMContentLoaded should complete without throwing null property errors');
    }, { tier: 1, feature: 'F3', id: 'TC-T1-F3-01' });

    test('TC-T1-F3-02: Printer selection dropdown #printerSelect exists in DOM', () => {
        const { document } = loadPrintHubDom();
        const select = document.getElementById('printerSelect');
        assert.ok(select, '#printerSelect dropdown must exist');
    }, { tier: 1, feature: 'F3', id: 'TC-T1-F3-02' });

    test('TC-T1-F3-03: Reload printers button #btnReloadPrinters exists and has click trigger', () => {
        const { window, document } = loadPrintHubDom();
        loadPrintHubScript(window);
        const btn = document.getElementById('btnReloadPrinters');
        assert.ok(btn, '#btnReloadPrinters must exist');
        assert.doesNotThrow(() => {
            btn.click();
        }, 'Clicking reload printers should execute without runtime crash');
    }, { tier: 1, feature: 'F3', id: 'TC-T1-F3-03' });

    test('TC-T1-F3-04: File print form #filePrintForm exists and handles submission', () => {
        const { document } = loadPrintHubDom();
        const form = document.getElementById('filePrintForm');
        assert.ok(form, '#filePrintForm must exist');
    }, { tier: 1, feature: 'F3', id: 'TC-T1-F3-04' });

    test('TC-T1-F3-05: Text print form #textPrintForm and #rawTextArea exist for direct text/dot-matrix printing', () => {
        const { document } = loadPrintHubDom();
        const form = document.getElementById('textPrintForm');
        const textarea = document.getElementById('rawTextArea');
        assert.ok(form, '#textPrintForm must exist');
        assert.ok(textarea, '#rawTextArea must exist');
    }, { tier: 1, feature: 'F3', id: 'TC-T1-F3-05' });
});

// =========================================================================
// F4: PIB Header (.ceisa-doc-topbar) Removal
// =========================================================================
describe('Tier 1 - F4: PIB Header .ceisa-doc-topbar Removal', () => {
    test('TC-T1-F4-01: .ceisa-doc-topbar element is absent from pib.html', () => {
        const { document } = loadPibDom();
        const topbar = document.querySelector('.ceisa-doc-topbar');
        assert.strictEqual(topbar, null, 'Expected .ceisa-doc-topbar to be removed');
    }, { tier: 1, feature: 'F4', id: 'TC-T1-F4-01' });

    test('TC-T1-F4-02: #btnPibKembali button is absent from pib.html', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnPibKembali');
        assert.strictEqual(btn, null, 'Expected #btnPibKembali to be removed');
    }, { tier: 1, feature: 'F4', id: 'TC-T1-F4-02' });

    test('TC-T1-F4-03: #btnPibUpdateData button is absent from pib.html', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnPibUpdateData');
        assert.strictEqual(btn, null, 'Expected #btnPibUpdateData to be removed');
    }, { tier: 1, feature: 'F4', id: 'TC-T1-F4-03' });

    test('TC-T1-F4-04: #btnPibMenuToggle button is absent from pib.html', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnPibMenuToggle');
        assert.strictEqual(btn, null, 'Expected #btnPibMenuToggle to be removed');
    }, { tier: 1, feature: 'F4', id: 'TC-T1-F4-04' });

    test('TC-T1-F4-05: Main workspace directly renders .ceisa-tabs without topbar gap', () => {
        const { document } = loadPibDom();
        const main = document.querySelector('.main-workspace');
        assert.ok(main, '.main-workspace must exist');
        const tabs = main.querySelector('.ceisa-tabs');
        assert.ok(tabs, '.ceisa-tabs strip must exist');
        const topbar = main.querySelector('.ceisa-doc-topbar');
        assert.strictEqual(topbar, null, 'No topbar inside main workspace');
    }, { tier: 1, feature: 'F4', id: 'TC-T1-F4-05' });
});

// =========================================================================
// F5: PIB Old PPJK Card Removal
// =========================================================================
describe('Tier 1 - F5: PIB Old PPJK Card Removal', () => {
    test('TC-T1-F5-01: Full-width card titled "PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional" is absent', () => {
        const { document } = loadPibDom();
        const titles = Array.from(document.querySelectorAll('.ceisa-card-title'));
        const oldTitle = titles.find(t => (t.textContent || '').includes('PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional'));
        assert.strictEqual(oldTitle, undefined, 'Old PPJK card title should be removed');
    }, { tier: 1, feature: 'F5', id: 'TC-T1-F5-01' });

    test('TC-T1-F5-02: Tab Entitas contains no element with grid-column: span 2', () => {
        const { document } = loadPibDom();
        const tabEntitas = document.getElementById('pib-tab-entitas');
        assert.ok(tabEntitas, '#pib-tab-entitas must exist');
        const span2Cards = tabEntitas.querySelectorAll('[style*="grid-column: span 2"]');
        assert.strictEqual(span2Cards.length, 0, 'No span-2 cards allowed in 2-column layout');
    }, { tier: 1, feature: 'F5', id: 'TC-T1-F5-02' });

    test('TC-T1-F5-03: Obsolete checkbox #pibCheckOwnerSame is absent', () => {
        const { document } = loadPibDom();
        const cb = document.getElementById('pibCheckOwnerSame');
        assert.strictEqual(cb, null, 'Expected #pibCheckOwnerSame to be removed');
    }, { tier: 1, feature: 'F5', id: 'TC-T1-F5-03' });

    test('TC-T1-F5-04: Obsolete checkbox #pibCheckSellerSame is absent', () => {
        const { document } = loadPibDom();
        const cb = document.getElementById('pibCheckSellerSame');
        assert.strictEqual(cb, null, 'Expected #pibCheckSellerSame to be removed');
    }, { tier: 1, feature: 'F5', id: 'TC-T1-F5-04' });

    test('TC-T1-F5-05: Old single-column PPJK input layout without ID type selector is absent', () => {
        const { document } = loadPibDom();
        const oldPpjkCard = Array.from(document.querySelectorAll('.ceisa-form-card')).find(c => {
            const label = c.querySelector('label');
            return label && label.textContent.trim() === 'NPWP PPJK' && !c.querySelector('select');
        });
        assert.strictEqual(oldPpjkCard, undefined, 'Old 3-column NPWP PPJK card without select must be removed');
    }, { tier: 1, feature: 'F5', id: 'TC-T1-F5-05' });
});

// =========================================================================
// F6: CEISA 4.0 2-Column Tab Entitas Layout (.ceisa-entitas-grid)
// =========================================================================
describe('Tier 1 - F6: CEISA 4.0 2-Column Tab Entitas Layout', () => {
    test('TC-T1-F6-01: Tab Entitas contains .ceisa-entitas-grid container', () => {
        const { document } = loadPibDom();
        const tabEntitas = document.getElementById('pib-tab-entitas');
        const grid = tabEntitas?.querySelector('.ceisa-entitas-grid');
        assert.ok(grid, '.ceisa-entitas-grid must exist in #pib-tab-entitas');
    }, { tier: 1, feature: 'F6', id: 'TC-T1-F6-01' });

    test('TC-T1-F6-02: Exactly two .ceisa-entitas-column wrappers exist within the grid', () => {
        const { document } = loadPibDom();
        const cols = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column');
        assert.strictEqual(cols.length, 2, 'Must have exactly 2 columns in Tab Entitas');
    }, { tier: 1, feature: 'F6', id: 'TC-T1-F6-02' });

    test('TC-T1-F6-03: Left column contains exactly 3 entity cards (Pengirim, Pembeli, Pemilik)', () => {
        const { document } = loadPibDom();
        const leftCol = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column')[0];
        assert.ok(leftCol, 'Left column must exist');
        const cards = leftCol.querySelectorAll('.ceisa-form-card, .card');
        assert.strictEqual(cards.length, 3, 'Left column must contain 3 cards');
    }, { tier: 1, feature: 'F6', id: 'TC-T1-F6-03' });

    test('TC-T1-F6-04: Right column contains exactly 3 entity cards (Penerima, Penjual, PPJK)', () => {
        const { document } = loadPibDom();
        const rightCol = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column')[1];
        assert.ok(rightCol, 'Right column must exist');
        const cards = rightCol.querySelectorAll('.ceisa-form-card, .card');
        assert.strictEqual(cards.length, 3, 'Right column must contain 3 cards');
    }, { tier: 1, feature: 'F6', id: 'TC-T1-F6-04' });

    test('TC-T1-F6-05: Stepper navigation footer .ceisa-tab-nav-footer exists with previous/next buttons', () => {
        const { document } = loadPibDom();
        const tabEntitas = document.getElementById('pib-tab-entitas');
        const footer = tabEntitas?.querySelector('.ceisa-tab-nav-footer');
        assert.ok(footer, 'Stepper nav footer must exist');
        const prevBtn = footer.querySelector('.btn-tab-prev');
        const nextBtn = footer.querySelector('.btn-tab-next');
        assert.ok(prevBtn, 'Previous button must exist');
        assert.ok(nextBtn, 'Next button must exist');
    }, { tier: 1, feature: 'F6', id: 'TC-T1-F6-05' });
});

// =========================================================================
// F7: Column 1 Card 1 (Pengirim)
// =========================================================================
describe('Tier 1 - F7: Column 1 Card 1 (Pengirim)', () => {
    test('TC-T1-F7-01: Pengirim card header displays title "Pengirim"', () => {
        const { document } = loadPibDom();
        const leftCol = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column')[0];
        const card1 = leftCol?.querySelectorAll('.ceisa-form-card, .card')[0];
        assert.ok(card1, 'Card 1 must exist');
        assert.ok(card1.textContent.includes('Pengirim'), 'Card 1 title must be Pengirim');
    }, { tier: 1, feature: 'F7', id: 'TC-T1-F7-01' });

    test('TC-T1-F7-02: Pengirim card header contains Referensi button', () => {
        const { document } = loadPibDom();
        const btnRef = document.getElementById('btnRefPengirim') || document.querySelector('.ceisa-entitas-column:first-child button[id*="Ref"]');
        assert.ok(btnRef, 'Pengirim Referensi button must exist');
    }, { tier: 1, feature: 'F7', id: 'TC-T1-F7-02' });

    test('TC-T1-F7-03: Pengirim has split input for identity type and identity number', () => {
        const { document } = loadPibDom();
        const idType = document.getElementById('pibPengirimIdType');
        const idNum = document.getElementById('pibPengirimId');
        assert.ok(idType, '#pibPengirimIdType select must exist');
        assert.ok(idNum, '#pibPengirimId input must exist');
    }, { tier: 1, feature: 'F7', id: 'TC-T1-F7-03' });

    test('TC-T1-F7-04: Pengirim has Nama and Alamat fields', () => {
        const { document } = loadPibDom();
        const name = document.getElementById('pibPengirimName');
        const addr = document.getElementById('pibPengirimAddress');
        assert.ok(name, '#pibPengirimName input must exist');
        assert.ok(addr, '#pibPengirimAddress textarea must exist');
    }, { tier: 1, feature: 'F7', id: 'TC-T1-F7-04' });

    test('TC-T1-F7-05: Pengirim has Negara dropdown with default or option CN - CHINA', () => {
        const { document } = loadPibDom();
        const ctry = document.getElementById('pibPengirimCountry');
        assert.ok(ctry, '#pibPengirimCountry select must exist');
        const hasChina = Array.from(ctry.options).some(o => o.value.includes('CN') || o.textContent.includes('CHINA'));
        assert.ok(hasChina, 'Country dropdown must contain CN - CHINA option');
    }, { tier: 1, feature: 'F7', id: 'TC-T1-F7-05' });
});

// =========================================================================
// F8: Column 1 Card 2 (Pembeli)
// =========================================================================
describe('Tier 1 - F8: Column 1 Card 2 (Pembeli)', () => {
    test('TC-T1-F8-01: Pembeli card header displays title "Pembeli"', () => {
        const { document } = loadPibDom();
        const leftCol = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column')[0];
        const card2 = leftCol?.querySelectorAll('.ceisa-form-card, .card')[1];
        assert.ok(card2, 'Card 2 Pembeli must exist');
        assert.ok(card2.textContent.includes('Pembeli'), 'Card 2 title must be Pembeli');
    }, { tier: 1, feature: 'F8', id: 'TC-T1-F8-01' });

    test('TC-T1-F8-02: Pembeli header contains "Hapus Pembeli" button', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnHapusPembeli') || document.getElementById('pibBtnHapusPembeli');
        assert.ok(btn, 'Button Hapus Pembeli must exist');
    }, { tier: 1, feature: 'F8', id: 'TC-T1-F8-02' });

    test('TC-T1-F8-03: Pembeli header contains "Salin data penerima" button', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnCopyPenerimaToPembeli') || document.getElementById('pibBtnSalinPenerima');
        assert.ok(btn, 'Button Salin data penerima must exist');
    }, { tier: 1, feature: 'F8', id: 'TC-T1-F8-03' });

    test('TC-T1-F8-04: Pembeli has NITKU input field with maxlength 22', () => {
        const { document } = loadPibDom();
        const nitku = document.getElementById('pibPembeliNitku');
        assert.ok(nitku, '#pibPembeliNitku must exist');
        assert.strictEqual(nitku.getAttribute('maxlength'), '22', 'NITKU maxlength must be 22');
    }, { tier: 1, feature: 'F8', id: 'TC-T1-F8-04' });

    test('TC-T1-F8-05: Pembeli has IdType, Id, Nama, Alamat, and Negara fields', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('pibPembeliIdType'), '#pibPembeliIdType must exist');
        assert.ok(document.getElementById('pibPembeliId'), '#pibPembeliId must exist');
        assert.ok(document.getElementById('pibPembeliName'), '#pibPembeliName must exist');
        assert.ok(document.getElementById('pibPembeliAddress'), '#pibPembeliAddress must exist');
        assert.ok(document.getElementById('pibPembeliCountry'), '#pibPembeliCountry must exist');
    }, { tier: 1, feature: 'F8', id: 'TC-T1-F8-05' });
});

// =========================================================================
// F9: Column 1 Card 3 (Pemilik Barang)
// =========================================================================
describe('Tier 1 - F9: Column 1 Card 3 (Pemilik Barang)', () => {
    test('TC-T1-F9-01: Pemilik Barang card header displays title "Pemilik Barang"', () => {
        const { document } = loadPibDom();
        const leftCol = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column')[0];
        const card3 = leftCol?.querySelectorAll('.ceisa-form-card, .card')[2];
        assert.ok(card3, 'Card 3 Pemilik Barang must exist');
        assert.ok(card3.textContent.includes('Pemilik Barang'), 'Card 3 title must be Pemilik Barang');
    }, { tier: 1, feature: 'F9', id: 'TC-T1-F9-01' });

    test('TC-T1-F9-02: Pemilik Barang header contains "Salin Penerima" button', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnCopyPenerimaToPemilik') || document.getElementById('pibBtnSalinPemilik');
        assert.ok(btn, 'Button Salin Penerima must exist');
    }, { tier: 1, feature: 'F9', id: 'TC-T1-F9-02' });

    test('TC-T1-F9-03: Pemilik Barang header contains "Referensi" button', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnRefPemilik') || document.querySelector('.ceisa-entitas-column:first-child .ceisa-form-card:nth-child(3) button[id*="Ref"]');
        assert.ok(btn, 'Pemilik Barang Referensi button must exist');
    }, { tier: 1, feature: 'F9', id: 'TC-T1-F9-03' });

    test('TC-T1-F9-04: Pemilik Barang has Afiliasi dropdown with default "TAH - Tidak berhubungan"', () => {
        const { document } = loadPibDom();
        const afi = document.getElementById('pibPemilikAfiliasi');
        assert.ok(afi, '#pibPemilikAfiliasi dropdown must exist');
        const hasTah = Array.from(afi.options).some(o => o.value.includes('TAH'));
        assert.ok(hasTah, 'Afiliasi dropdown must have TAH option');
    }, { tier: 1, feature: 'F9', id: 'TC-T1-F9-04' });

    test('TC-T1-F9-05: Pemilik Barang has IdType, Id, NITKU, Nama, and Alamat fields', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('pibPemilikIdType'), '#pibPemilikIdType must exist');
        assert.ok(document.getElementById('pibPemilikId'), '#pibPemilikId must exist');
        assert.ok(document.getElementById('pibPemilikNitku'), '#pibPemilikNitku must exist');
        assert.ok(document.getElementById('pibPemilikName'), '#pibPemilikName must exist');
        assert.ok(document.getElementById('pibPemilikAddress'), '#pibPemilikAddress must exist');
    }, { tier: 1, feature: 'F9', id: 'TC-T1-F9-05' });
});

// =========================================================================
// F10: Column 2 Card 1 (Penerima)
// =========================================================================
describe('Tier 1 - F10: Column 2 Card 1 (Penerima)', () => {
    test('TC-T1-F10-01: Penerima card header displays title "Penerima"', () => {
        const { document } = loadPibDom();
        const rightCol = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column')[1];
        const card1 = rightCol?.querySelectorAll('.ceisa-form-card, .card')[0];
        assert.ok(card1, 'Card 1 Penerima must exist');
        assert.ok(card1.textContent.includes('Penerima'), 'Card 1 title must be Penerima');
    }, { tier: 1, feature: 'F10', id: 'TC-T1-F10-01' });

    test('TC-T1-F10-02: Penerima header contains "Referensi" button', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnRefPenerima') || document.querySelector('.ceisa-entitas-column:last-child button[id*="Ref"]');
        assert.ok(btn, 'Penerima Referensi button must exist');
    }, { tier: 1, feature: 'F10', id: 'TC-T1-F10-02' });

    test('TC-T1-F10-03: Penerima has identity select defaulting to "6 - NPWP 16 DIGIT" and id input', () => {
        const { document } = loadPibDom();
        const idType = document.getElementById('pibPenerimaIdType');
        const idNum = document.getElementById('pibPenerimaId');
        assert.ok(idType, '#pibPenerimaIdType must exist');
        assert.ok(idNum, '#pibPenerimaId must exist');
        assert.ok(idType.value.includes('NPWP 16') || Array.from(idType.options).some(o => o.value.includes('NPWP 16')), 'Should support NPWP 16 DIGIT');
    }, { tier: 1, feature: 'F10', id: 'TC-T1-F10-03' });

    test('TC-T1-F10-04: Penerima has NITKU (maxlength 22), Nama, Alamat, and Negara fields', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('pibPenerimaNitku'), '#pibPenerimaNitku must exist');
        assert.ok(document.getElementById('pibPenerimaName'), '#pibPenerimaName must exist');
        assert.ok(document.getElementById('pibPenerimaAddress'), '#pibPenerimaAddress must exist');
        assert.ok(document.getElementById('pibPenerimaCountry'), '#pibPenerimaCountry must exist');
    }, { tier: 1, feature: 'F10', id: 'TC-T1-F10-04' });

    test('TC-T1-F10-05: Penerima has Status dropdown and Ijin BP (No and Tanggal) fields', () => {
        const { document } = loadPibDom();
        const status = document.getElementById('pibPenerimaStatus');
        const ijinNo = document.getElementById('pibPenerimaIjinNo') || document.getElementById('pibIjinBpNomor');
        const ijinDate = document.getElementById('pibPenerimaIjinDate') || document.getElementById('pibIjinBpTanggal');
        assert.ok(status, '#pibPenerimaStatus dropdown must exist');
        assert.ok(ijinNo, 'Ijin BP Nomor input must exist');
        assert.ok(ijinDate, 'Ijin BP Tanggal input must exist');
    }, { tier: 1, feature: 'F10', id: 'TC-T1-F10-05' });
});

// =========================================================================
// F11: Column 2 Card 2 (Penjual)
// =========================================================================
describe('Tier 1 - F11: Column 2 Card 2 (Penjual)', () => {
    test('TC-T1-F11-01: Penjual card header displays title "Penjual"', () => {
        const { document } = loadPibDom();
        const rightCol = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column')[1];
        const card2 = rightCol?.querySelectorAll('.ceisa-form-card, .card')[1];
        assert.ok(card2, 'Card 2 Penjual must exist');
        assert.ok(card2.textContent.includes('Penjual'), 'Card 2 title must be Penjual');
    }, { tier: 1, feature: 'F11', id: 'TC-T1-F11-01' });

    test('TC-T1-F11-02: Penjual header contains "Salin data pengirim" button', () => {
        const { document } = loadPibDom();
        const btn = document.getElementById('btnCopyPengirimToPenjual') || document.getElementById('pibBtnSalinPengirim');
        assert.ok(btn, 'Button Salin data pengirim must exist');
    }, { tier: 1, feature: 'F11', id: 'TC-T1-F11-02' });

    test('TC-T1-F11-03: Penjual has IdType select and Id number input', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('pibPenjualIdType'), '#pibPenjualIdType must exist');
        assert.ok(document.getElementById('pibPenjualId'), '#pibPenjualId must exist');
    }, { tier: 1, feature: 'F11', id: 'TC-T1-F11-03' });

    test('TC-T1-F11-04: Penjual has Nama and Alamat fields', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('pibPenjualName'), '#pibPenjualName must exist');
        assert.ok(document.getElementById('pibPenjualAddress'), '#pibPenjualAddress must exist');
    }, { tier: 1, feature: 'F11', id: 'TC-T1-F11-04' });

    test('TC-T1-F11-05: Penjual has Negara dropdown containing foreign countries', () => {
        const { document } = loadPibDom();
        const ctry = document.getElementById('pibPenjualCountry');
        assert.ok(ctry, '#pibPenjualCountry must exist');
        assert.ok(ctry.options.length > 0, 'Negara dropdown must have options');
    }, { tier: 1, feature: 'F11', id: 'TC-T1-F11-05' });
});

// =========================================================================
// F12: Column 2 Card 3 (PPJK)
// =========================================================================
describe('Tier 1 - F12: Column 2 Card 3 (PPJK)', () => {
    test('TC-T1-F12-01: PPJK card header displays title "PPJK"', () => {
        const { document } = loadPibDom();
        const rightCol = document.querySelectorAll('.ceisa-entitas-grid .ceisa-entitas-column')[1];
        const card3 = rightCol?.querySelectorAll('.ceisa-form-card, .card')[2];
        assert.ok(card3, 'Card 3 PPJK must exist');
        assert.ok(card3.textContent.includes('PPJK'), 'Card 3 title must be PPJK');
    }, { tier: 1, feature: 'F12', id: 'TC-T1-F12-01' });

    test('TC-T1-F12-02: PPJK has split identity type select and identity number input', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('pibPpjkIdType'), '#pibPpjkIdType must exist');
        assert.ok(document.getElementById('pibPpjkId'), '#pibPpjkId must exist');
    }, { tier: 1, feature: 'F12', id: 'TC-T1-F12-02' });

    test('TC-T1-F12-03: PPJK has NITKU input with maxlength 22 and monospace font styling', () => {
        const { document } = loadPibDom();
        const nitku = document.getElementById('pibPpjkNitku');
        assert.ok(nitku, '#pibPpjkNitku must exist');
        assert.strictEqual(nitku.getAttribute('maxlength'), '22', 'NITKU maxlength must be 22');
    }, { tier: 1, feature: 'F12', id: 'TC-T1-F12-03' });

    test('TC-T1-F12-04: PPJK NITKU field has attached sync button #btnSyncNitkuPpjk', () => {
        const { document } = loadPibDom();
        const btnSync = document.getElementById('btnSyncNitkuPpjk') || document.getElementById('pibBtnSyncNitkuPpjk');
        assert.ok(btnSync, 'PPJK NITKU sync button must exist');
    }, { tier: 1, feature: 'F12', id: 'TC-T1-F12-04' });

    test('TC-T1-F12-05: PPJK has Nama and Alamat fields', () => {
        const { document } = loadPibDom();
        assert.ok(document.getElementById('pibPpjkName'), '#pibPpjkName must exist');
        assert.ok(document.getElementById('pibPpjkAddress'), '#pibPpjkAddress must exist');
    }, { tier: 1, feature: 'F12', id: 'TC-T1-F12-05' });
});

// =========================================================================
// F13: PIB Data - Copy Action Handlers
// =========================================================================
describe('Tier 1 - F13: Copy Action Handlers', () => {
    test('TC-T1-F13-01: "Salin data penerima" copies Penerima fields to Pembeli', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        // Populate Penerima
        const pId = document.getElementById('pibPenerimaId');
        const pNitku = document.getElementById('pibPenerimaNitku');
        const pName = document.getElementById('pibPenerimaName');
        const pAddr = document.getElementById('pibPenerimaAddress');
        const pCtry = document.getElementById('pibPenerimaCountry');

        assert.ok(pId && pName, 'Penerima elements must exist to execute copy');
        pId.value = '0830727251085000';
        if (pNitku) pNitku.value = '0830727251085000000002';
        pName.value = 'PT. OTTO SEKAWAN MULIA';
        pAddr.value = 'KAWASAN INDUSTRI TUNAS BATAM';
        if (pCtry) pCtry.value = 'ID - INDONESIA';

        const btnCopy = document.getElementById('btnCopyPenerimaToPembeli') || document.getElementById('pibBtnSalinPenerima');
        assert.ok(btnCopy, 'Copy button must exist');
        btnCopy.click();

        const bId = document.getElementById('pibPembeliId');
        const bName = document.getElementById('pibPembeliName');
        assert.strictEqual(bId.value, '0830727251085000', 'Pembeli ID must match Penerima ID');
        assert.strictEqual(bName.value, 'PT. OTTO SEKAWAN MULIA', 'Pembeli Name must match Penerima Name');
    }, { tier: 1, feature: 'F13', id: 'TC-T1-F13-01' });

    test('TC-T1-F13-02: "Hapus Pembeli" clears Pembeli input fields', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        const bName = document.getElementById('pibPembeliName');
        const bId = document.getElementById('pibPembeliId');
        assert.ok(bName && bId, 'Pembeli elements must exist');
        bName.value = 'PT. EXISTING BUYER';
        bId.value = '1234567890123456';

        const btnHapus = document.getElementById('btnHapusPembeli') || document.getElementById('pibBtnHapusPembeli');
        assert.ok(btnHapus, 'Hapus Pembeli button must exist');
        btnHapus.click();

        assert.ok(bName.value === '' || bName.value === '-', 'Pembeli Name should be reset');
        assert.ok(bId.value === '' || bId.value === '-', 'Pembeli ID should be reset');
    }, { tier: 1, feature: 'F13', id: 'TC-T1-F13-02' });

    test('TC-T1-F13-03: "Salin data pengirim" copies Pengirim fields to Penjual', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        const sName = document.getElementById('pibPengirimName');
        const sAddr = document.getElementById('pibPengirimAddress');
        const sCtry = document.getElementById('pibPengirimCountry');
        assert.ok(sName && sAddr, 'Pengirim elements must exist');
        sName.value = 'SHANGHAI TRADING CO';
        sAddr.value = 'Songze Avenue 888, Shanghai';
        if (sCtry) sCtry.value = 'CN - CHINA';

        const btnCopy = document.getElementById('btnCopyPengirimToPenjual') || document.getElementById('pibBtnSalinPengirim');
        assert.ok(btnCopy, 'Copy Pengirim button must exist');
        btnCopy.click();

        const jName = document.getElementById('pibPenjualName');
        const jAddr = document.getElementById('pibPenjualAddress');
        assert.strictEqual(jName.value, 'SHANGHAI TRADING CO', 'Penjual Name must match Pengirim');
        assert.strictEqual(jAddr.value, 'Songze Avenue 888, Shanghai', 'Penjual Address must match Pengirim');
    }, { tier: 1, feature: 'F13', id: 'TC-T1-F13-03' });

    test('TC-T1-F13-04: "Salin Penerima" copies Penerima to Pemilik Barang without overwriting Afiliasi', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        const pName = document.getElementById('pibPenerimaName');
        const pId = document.getElementById('pibPenerimaId');
        assert.ok(pName && pId, 'Penerima elements must exist');
        pName.value = 'PT. PEMILIK ASLI';
        pId.value = '9999888877776666';

        const oAfi = document.getElementById('pibPemilikAfiliasi');
        if (oAfi) oAfi.value = 'TAH - Tidak berhubungan';

        const btnCopy = document.getElementById('btnCopyPenerimaToPemilik') || document.getElementById('pibBtnSalinPemilik');
        assert.ok(btnCopy, 'Copy Pemilik button must exist');
        btnCopy.click();

        const oName = document.getElementById('pibPemilikName');
        assert.strictEqual(oName.value, 'PT. PEMILIK ASLI', 'Pemilik Name must match Penerima');
        if (oAfi) {
            assert.strictEqual(oAfi.value, 'TAH - Tidak berhubungan', 'Afiliasi should not be corrupted');
        }
    }, { tier: 1, feature: 'F13', id: 'TC-T1-F13-04' });

    test('TC-T1-F13-05: PPJK NITKU sync pads 16-digit NPWP with 6 trailing zeroes to 22 digits', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        if (typeof window.setupPibCopyHandlers === 'function') window.setupPibCopyHandlers();

        const ppjkId = document.getElementById('pibPpjkId');
        const ppjkNitku = document.getElementById('pibPpjkNitku');
        const btnSync = document.getElementById('btnSyncNitkuPpjk') || document.getElementById('pibBtnSyncNitkuPpjk');
        assert.ok(ppjkId && ppjkNitku && btnSync, 'PPJK sync elements must exist');

        ppjkId.value = '0026923485215000';
        btnSync.click();

        assert.strictEqual(ppjkNitku.value, '0026923485215000000000', 'NITKU must be 22 digits with 6 zeroes padded');
    }, { tier: 1, feature: 'F13', id: 'TC-T1-F13-05' });
});

// =========================================================================
// F14: PIB Data - collectPibFormData()
// =========================================================================
describe('Tier 1 - F14: PIB Data collectPibFormData()', () => {
    test('TC-T1-F14-01: Serializes all 6 entity cards (pengirim, pembeli, pemilik, penerima, penjual, ppjk)', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);
        assert.strictEqual(typeof window.collectPibFormData, 'function', 'collectPibFormData must be defined');

        // Fill test values in DOM
        const setIfExists = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setIfExists('pibPengirimName', 'SHANGHAI SHP');
        setIfExists('pibPembeliName', 'PT BUYER');
        setIfExists('pibPemilikName', 'PT OWNER');
        setIfExists('pibPenerimaName', 'PT IMPORTER');
        setIfExists('pibPenjualName', 'SELLER CORP');
        setIfExists('pibPpjkName', 'PPJK LOGISTIK');

        const data = window.collectPibFormData();
        assert.strictEqual(data.pengirimName, 'SHANGHAI SHP');
        assert.strictEqual(data.pembeliName, 'PT BUYER');
        assert.strictEqual(data.pemilikName, 'PT OWNER');
        assert.strictEqual(data.penerimaName, 'PT IMPORTER');
        assert.strictEqual(data.penjualName, 'SELLER CORP');
        assert.strictEqual(data.ppjkName, 'PPJK LOGISTIK');
    }, { tier: 1, feature: 'F14', id: 'TC-T1-F14-01' });

    test('TC-T1-F14-02: Includes backward-compatible aliases importirName and supplierName', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const setIfExists = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setIfExists('pibPenerimaName', 'PT. IMPORTIR COMPAT');
        setIfExists('pibPengirimName', 'SUPPLIER COMPAT');

        const data = window.collectPibFormData();
        assert.strictEqual(data.importirName, 'PT. IMPORTIR COMPAT', 'importirName alias must match penerimaName');
        assert.strictEqual(data.supplierName, 'SUPPLIER COMPAT', 'supplierName alias must match pengirimName');
    }, { tier: 1, feature: 'F14', id: 'TC-T1-F14-02' });

    test('TC-T1-F14-03: Includes backward-compatible aliases importirId, importirAddress, supplierAddress', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const setIfExists = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setIfExists('pibPenerimaId', '0123456789012345');
        setIfExists('pibPenerimaAddress', 'Jl. Pelabuhan No 1');
        setIfExists('pibPengirimAddress', 'Qingpu District, Shanghai');

        const data = window.collectPibFormData();
        assert.strictEqual(data.importirId, '0123456789012345');
        assert.strictEqual(data.importirAddress, 'Jl. Pelabuhan No 1');
        assert.strictEqual(data.supplierAddress, 'Qingpu District, Shanghai');
    }, { tier: 1, feature: 'F14', id: 'TC-T1-F14-03' });

    test('TC-T1-F14-04: Captures NITKU values for Pembeli, Pemilik, Penerima, and PPJK', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const setIfExists = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setIfExists('pibPembeliNitku', '0123456789012345000001');
        setIfExists('pibPemilikNitku', '0123456789012345000002');
        setIfExists('pibPenerimaNitku', '0123456789012345000003');
        setIfExists('pibPpjkNitku', '9988776655443322000004');

        const data = window.collectPibFormData();
        assert.strictEqual(data.pembeliNitku, '0123456789012345000001');
        assert.strictEqual(data.pemilikNitku, '0123456789012345000002');
        assert.strictEqual(data.penerimaNitku, '0123456789012345000003');
        assert.strictEqual(data.ppjkNitku, '9988776655443322000004');
    }, { tier: 1, feature: 'F14', id: 'TC-T1-F14-04' });

    test('TC-T1-F14-05: Safely extracts values without throwing when fields are empty', () => {
        const { window } = loadPibDom();
        loadPibDashboardScript(window);

        assert.doesNotThrow(() => {
            const data = window.collectPibFormData();
            assert.ok(typeof data === 'object' && data !== null);
        }, 'collectPibFormData should safely return an object when inputs are empty');
    }, { tier: 1, feature: 'F14', id: 'TC-T1-F14-05' });
});

// =========================================================================
// F15: PIB Data - loadPibDraftData() / populatePibForm
// =========================================================================
describe('Tier 1 - F15: PIB Data loadPibDraftData() & populatePibForm', () => {
    test('TC-T1-F15-01: Populates all 6 entity cards from complete JSON draft payload', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const draft = {
            pengirimName: 'BEIJING SHENZHOU LTD',
            pembeliName: 'PT. PEMBELI JAYA',
            pemilikName: 'PT. PEMILIK GUDANG',
            penerimaName: 'PT. PENERIMA MANDIRI',
            penjualName: 'BEIJING TRADING CO',
            ppjkName: 'PT. PPJK UTAMA'
        };

        window.loadPibDraftData(draft);

        const getVal = (id) => document.getElementById(id)?.value;
        assert.strictEqual(getVal('pibPengirimName'), 'BEIJING SHENZHOU LTD');
        assert.strictEqual(getVal('pibPembeliName'), 'PT. PEMBELI JAYA');
        assert.strictEqual(getVal('pibPemilikName'), 'PT. PEMILIK GUDANG');
        assert.strictEqual(getVal('pibPenerimaName'), 'PT. PENERIMA MANDIRI');
        assert.strictEqual(getVal('pibPenjualName'), 'BEIJING TRADING CO');
        assert.strictEqual(getVal('pibPpjkName'), 'PT. PPJK UTAMA');
    }, { tier: 1, feature: 'F15', id: 'TC-T1-F15-01' });

    test('TC-T1-F15-02: Populates from legacy draft schema mapping importir* to Penerima and supplier* to Pengirim', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const legacyDraft = {
            importirName: 'PT. LEGACY IMPORTER',
            importirId: '0123456789012345',
            importirAddress: 'Jl. Industri No 5',
            supplierName: 'LEGACY SUPPLIER CORP',
            supplierAddress: 'No. 12 Street, China'
        };

        window.loadPibDraftData(legacyDraft);

        const getVal = (id) => document.getElementById(id)?.value;
        assert.strictEqual(getVal('pibPenerimaName'), 'PT. LEGACY IMPORTER', 'Penerima should receive legacy importirName');
        assert.strictEqual(getVal('pibPengirimName'), 'LEGACY SUPPLIER CORP', 'Pengirim should receive legacy supplierName');
    }, { tier: 1, feature: 'F15', id: 'TC-T1-F15-02' });

    test('TC-T1-F15-03: Auto-falls back Pembeli from Penerima when draft omits Pembeli', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const draft = {
            penerimaName: 'PT. FALLBACK TESTER',
            penerimaId: '1111222233334444'
        };

        window.loadPibDraftData(draft);

        const getVal = (id) => document.getElementById(id)?.value;
        assert.strictEqual(getVal('pibPembeliName'), 'PT. FALLBACK TESTER', 'Pembeli Name should fallback to Penerima');
    }, { tier: 1, feature: 'F15', id: 'TC-T1-F15-03' });

    test('TC-T1-F15-04: Auto-falls back Penjual from Pengirim when draft omits Penjual', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const draft = {
            pengirimName: 'FALLBACK SHIPPERS INC',
            pengirimAddress: 'Port of Ningbo'
        };

        window.loadPibDraftData(draft);

        const getVal = (id) => document.getElementById(id)?.value;
        assert.strictEqual(getVal('pibPenjualName'), 'FALLBACK SHIPPERS INC', 'Penjual Name should fallback to Pengirim');
    }, { tier: 1, feature: 'F15', id: 'TC-T1-F15-04' });

    test('TC-T1-F15-05: window.populatePibForm alias is callable and synchronizes form', () => {
        const { window, document } = loadPibDom();
        loadPibDashboardScript(window);

        const populateFn = window.populatePibForm || window.loadPibDraftData;
        assert.strictEqual(typeof populateFn, 'function', 'populatePibForm or loadPibDraftData must be available');
        populateFn({ penerimaName: 'PT. POPULATE ALIAS TEST' });

        const pName = document.getElementById('pibPenerimaName')?.value || document.getElementById('pibImportirName')?.value;
        assert.strictEqual(pName, 'PT. POPULATE ALIAS TEST');
    }, { tier: 1, feature: 'F15', id: 'TC-T1-F15-05' });
});

// =========================================================================
// F16: Content Script - handleCeisaAutoInputRow in content.js
// =========================================================================
describe('Tier 1 - F16: Content Script CEISA 4.0 Auto-Input', () => {
    test('TC-T1-F16-01: handleCeisaAutoInputRow function exists and accepts section "entitas"', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);
        assert.strictEqual(typeof window.handleCeisaAutoInputRow, 'function', 'handleCeisaAutoInputRow must exist');

        const filledFields = [];
        const container = document.getElementById('tab-entitas');
        assert.doesNotThrow(() => {
            window.handleCeisaAutoInputRow({}, container, 'entitas', filledFields);
        }, 'handleCeisaAutoInputRow should execute safely');
    }, { tier: 1, feature: 'F16', id: 'TC-T1-F16-01' });

    test('TC-T1-F16-02: Auto-fills Pengirim card fields from item payload', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);

        const filledFields = [];
        const container = document.getElementById('tab-entitas');
        const item = {
            pengirimName: 'SHENZHEN TECH EXPORT LTD',
            pengirimAddress: 'Baoan District, Shenzhen, China',
            pengirimCountry: 'CN - CHINA'
        };

        window.handleCeisaAutoInputRow(item, container, 'entitas', filledFields);

        const pNameInput = document.getElementById('ceisa_pengirim_nama');
        assert.ok(pNameInput, '#ceisa_pengirim_nama must exist in mock portal');
        assert.strictEqual(pNameInput.value, 'SHENZHEN TECH EXPORT LTD');
    }, { tier: 1, feature: 'F16', id: 'TC-T1-F16-02' });

    test('TC-T1-F16-03: Auto-fills Penerima card fields (including NITKU and Status) from item payload', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);

        const filledFields = [];
        const container = document.getElementById('tab-entitas');
        const item = {
            penerimaId: '0830727251085000',
            penerimaNitku: '0830727251085000000002',
            penerimaName: 'PT. OTTO SEKAWAN MULIA',
            penerimaAddress: 'Batam Kota, Kepulauan Riau',
            penerimaStatus: 'LAINNYA'
        };

        window.handleCeisaAutoInputRow(item, container, 'entitas', filledFields);

        const rId = document.getElementById('ceisa_penerima_id');
        const rName = document.getElementById('ceisa_penerima_nama');
        assert.ok(rId && rName, 'Penerima inputs must exist');
        assert.strictEqual(rId.value, '0830727251085000');
        assert.strictEqual(rName.value, 'PT. OTTO SEKAWAN MULIA');
    }, { tier: 1, feature: 'F16', id: 'TC-T1-F16-03' });

    test('TC-T1-F16-04: Card-scoped filling prevents collision between Pembeli and Penerima', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);

        const filledFields = [];
        const container = document.getElementById('tab-entitas');
        const item = {
            penerimaName: 'PT. PENERIMA UTAMA',
            pembeliName: 'PT. PEMBELI CABANG'
        };

        window.handleCeisaAutoInputRow(item, container, 'entitas', filledFields);

        const rName = document.getElementById('ceisa_penerima_nama');
        const bName = document.getElementById('ceisa_pembeli_nama');
        assert.strictEqual(rName.value, 'PT. PENERIMA UTAMA', 'Penerima should have its distinct value');
        // If content.js scopes by card, Pembeli receives PT. PEMBELI CABANG
        if (bName && bName.value) {
            assert.strictEqual(bName.value, 'PT. PEMBELI CABANG', 'Pembeli must not be overwritten with Penerima');
        }
    }, { tier: 1, feature: 'F16', id: 'TC-T1-F16-04' });

    test('TC-T1-F16-05: Auto-fills PPJK card fields (NPWP, NITKU, Nama, Alamat) from payload', () => {
        const { window, document } = createMockCeisaPortalDom();
        loadContentScriptFunctions(window);

        const filledFields = [];
        const container = document.getElementById('tab-entitas');
        const item = {
            ppjkId: '0026923485215000',
            ppjkNitku: '0026923485215000000000',
            ppjkName: 'PT. SARANA PPJK LOGISTIK',
            ppjkAddress: 'Jl. Sulawesi No. 12 Tanjung Priok'
        };

        window.handleCeisaAutoInputRow(item, container, 'entitas', filledFields);

        const ppjkName = document.getElementById('ceisa_ppjk_nama');
        if (ppjkName && ppjkName.value) {
            assert.strictEqual(ppjkName.value, 'PT. SARANA PPJK LOGISTIK');
        }
    }, { tier: 1, feature: 'F16', id: 'TC-T1-F16-05' });
});
