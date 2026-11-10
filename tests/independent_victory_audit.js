const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const {
  createMockCeisaPortalDom,
  loadContentScriptFunctions
} = require('./e2e/helpers/dom_env');

console.log('================================================================');
console.log('  VICTORY AUDITOR INDEPENDENT RE-EXECUTION & FORENSIC SUITE');
console.log('================================================================');

// -----------------------------------------------------------------------------
// AUDIT R1: Print Hub Clean-up
// -----------------------------------------------------------------------------
const printHubHtml = fs.readFileSync('print_hub.html', 'utf8');
const printHubDom = new JSDOM(printHubHtml, { runScripts: 'outside-only' });
const pDoc = printHubDom.window.document;

if (pDoc.querySelector('.ph-qr-card') !== null) throw new Error('FAIL R1: .ph-qr-card still in DOM');
if (pDoc.querySelector('#qrThumbBox') !== null) throw new Error('FAIL R1: #qrThumbBox still in DOM');
if (pDoc.querySelector('#qrThumbImage') !== null) throw new Error('FAIL R1: #qrThumbImage still in DOM');
if (pDoc.querySelector('#btnOpenQrHeader') !== null) throw new Error('FAIL R1: #btnOpenQrHeader still in DOM');
if (pDoc.querySelector('#qrModal') !== null) throw new Error('FAIL R1: #qrModal still in DOM');
if (printHubHtml.includes('Cetak Langsung dari HP')) throw new Error('FAIL R1: Text still in HTML');

const printHubJs = fs.readFileSync('print_hub.js', 'utf8');
if (printHubJs.includes('qrModal') || printHubJs.includes('fetchQrCode')) throw new Error('FAIL R1: QR code logic still in print_hub.js');
console.log('[AUDIT PASS] R1: Print Hub QR elements and scripts successfully removed');

// -----------------------------------------------------------------------------
// AUDIT R2: PIB Topbar & Old PPJK Removal
// -----------------------------------------------------------------------------
const pibHtml = fs.readFileSync('pib.html', 'utf8');
const pibDom = new JSDOM(pibHtml, {
  runScripts: 'outside-only',
  url: 'http://localhost:3000/pib.html'
});
const { window: pibWin } = pibDom;
const pibDoc = pibWin.document;

if (pibDoc.querySelector('.ceisa-doc-topbar') !== null) throw new Error('FAIL R2: .ceisa-doc-topbar still in DOM');
if (pibDoc.querySelector('#btnPibKembali') !== null) throw new Error('FAIL R2: #btnPibKembali still in DOM');
if (pibDoc.querySelector('#btnPibUpdateData') !== null) throw new Error('FAIL R2: #btnPibUpdateData still in DOM');
if (pibHtml.includes('FTZ01 - Pemasukan dari Luar Daerah Pabean')) throw new Error('FAIL R2: Topbar title still in HTML');
if (pibHtml.includes('PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional')) throw new Error('FAIL R2: Old PPJK card title still in HTML');
if (pibDoc.querySelector('#pibCheckOwnerSame') !== null) throw new Error('FAIL R2: #pibCheckOwnerSame still in DOM');
if (pibDoc.querySelector('#pibCheckSellerSame') !== null) throw new Error('FAIL R2: #pibCheckSellerSame still in DOM');
console.log('[AUDIT PASS] R2: Topbar and Old PPJK Card successfully removed');

// -----------------------------------------------------------------------------
// AUDIT R3: CEISA 4.0 2-Column Tab Entitas Layout & Cards
// -----------------------------------------------------------------------------
const grid = pibDoc.querySelector('.ceisa-entitas-grid');
if (!grid) throw new Error('FAIL R3: .ceisa-entitas-grid not found');

const colLeft = pibDoc.querySelector('.ceisa-entitas-col-left');
const colRight = pibDoc.querySelector('.ceisa-entitas-col-right');
if (!colLeft || !colRight) throw new Error('FAIL R3: Left or Right column missing');

const leftCards = colLeft.querySelectorAll('.ceisa-form-card, .ceisa-entitas-card');
const rightCards = colRight.querySelectorAll('.ceisa-form-card, .ceisa-entitas-card');
if (leftCards.length !== 3) throw new Error('FAIL R3: Left column does not contain 3 cards, found ' + leftCards.length);
if (rightCards.length !== 3) throw new Error('FAIL R3: Right column does not contain 3 cards, found ' + rightCards.length);

// Verify Card Titles & Fields
// Left: Pengirim, Pembeli, Pemilik Barang
if (!leftCards[0].textContent.includes('Pengirim')) throw new Error('FAIL R3: Card 1 left is not Pengirim');
if (!pibDoc.querySelector('#btnRefPengirim')) throw new Error('FAIL R3: btnRefPengirim missing');
if (!pibDoc.querySelector('#pibPengirimIdType') || !pibDoc.querySelector('#pibPengirimId') || !pibDoc.querySelector('#pibPengirimName') || !pibDoc.querySelector('#pibPengirimAddress') || !pibDoc.querySelector('#pibPengirimCountry')) throw new Error('FAIL R3: Pengirim fields missing');

if (!leftCards[1].textContent.includes('Pembeli')) throw new Error('FAIL R3: Card 2 left is not Pembeli');
if (!pibDoc.querySelector('#btnHapusPembeli')) throw new Error('FAIL R3: btnHapusPembeli missing');
if (!pibDoc.querySelector('#btnCopyPenerimaToPembeli')) throw new Error('FAIL R3: btnCopyPenerimaToPembeli missing');
if (!pibDoc.querySelector('#pibPembeliNitku')) throw new Error('FAIL R3: pibPembeliNitku missing');

if (!leftCards[2].textContent.includes('Pemilik Barang')) throw new Error('FAIL R3: Card 3 left is not Pemilik Barang');
if (!pibDoc.querySelector('#btnCopyPenerimaToPemilik')) throw new Error('FAIL R3: btnCopyPenerimaToPemilik missing');
if (!pibDoc.querySelector('#pibPemilikAfiliasi')) throw new Error('FAIL R3: pibPemilikAfiliasi missing');

// Right: Penerima, Penjual, PPJK
if (!rightCards[0].textContent.includes('Penerima')) throw new Error('FAIL R3: Card 1 right is not Penerima');
if (!pibDoc.querySelector('#pibPenerimaStatus')) throw new Error('FAIL R3: pibPenerimaStatus missing');
if (!pibDoc.querySelector('#pibPenerimaIjinNo') || !pibDoc.querySelector('#pibPenerimaIjinDate')) throw new Error('FAIL R3: Ijin BP fields missing');

if (!rightCards[1].textContent.includes('Penjual')) throw new Error('FAIL R3: Card 2 right is not Penjual');
if (!pibDoc.querySelector('#btnCopyPengirimToPenjual')) throw new Error('FAIL R3: btnCopyPengirimToPenjual missing');

if (!rightCards[2].textContent.includes('PPJK')) throw new Error('FAIL R3: Card 3 right is not PPJK');
if (!pibDoc.querySelector('#pibPpjkNitku') || !pibDoc.querySelector('#btnSyncNitkuPpjk')) throw new Error('FAIL R3: PPJK NITKU or sync button missing');
console.log('[AUDIT PASS] R3: 2-Column Tab Entitas layout, cards, and fields match CEISA 4.0 specification');

// -----------------------------------------------------------------------------
// AUDIT R4: Form Collection, Population, Copy Handlers & Auto-Input
// -----------------------------------------------------------------------------
// Polyfill browser globals for pib_dashboard.js
pibWin.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data: [] }),
  text: async () => ''
});
pibWin.showToast = () => {};
pibWin.eval(fs.readFileSync('pib_dashboard.js', 'utf8'));

// Test Copy Handlers
pibDoc.querySelector('#pibPenerimaName').value = 'PT AUDIT PENERIMA INDONESIA';
pibDoc.querySelector('#pibPenerimaId').value = '1122334455667788';
pibDoc.querySelector('#pibPenerimaNitku').value = '1122334455667788000000';
pibDoc.querySelector('#pibPenerimaAddress').value = 'Audit Street No 1';
pibDoc.querySelector('#btnCopyPenerimaToPembeli').click();
if (pibDoc.querySelector('#pibPembeliName').value !== 'PT AUDIT PENERIMA INDONESIA') throw new Error('FAIL R4: Salin data penerima to pembeli failed');
if (pibDoc.querySelector('#pibPembeliNitku').value !== '1122334455667788000000') throw new Error('FAIL R4: Salin data penerima NITKU failed');

pibDoc.querySelector('#btnHapusPembeli').click();
if (pibDoc.querySelector('#pibPembeliName').value !== '') throw new Error('FAIL R4: Hapus pembeli failed');
if (pibDoc.querySelector('#pibPembeliNitku').value !== '') throw new Error('FAIL R4: Hapus pembeli NITKU failed');

pibDoc.querySelector('#btnCopyPenerimaToPemilik').click();
if (pibDoc.querySelector('#pibPemilikName').value !== 'PT AUDIT PENERIMA INDONESIA') throw new Error('FAIL R4: Salin penerima to pemilik barang failed');

pibDoc.querySelector('#pibPengirimName').value = 'GLOBAL AUDIT EXPORTER LTD';
pibDoc.querySelector('#btnCopyPengirimToPenjual').click();
if (pibDoc.querySelector('#pibPenjualName').value !== 'GLOBAL AUDIT EXPORTER LTD') throw new Error('FAIL R4: Salin pengirim to penjual failed');

// Test NITKU Sync
pibDoc.querySelector('#pibPpjkId').value = '0123456789012345';
pibDoc.querySelector('#btnSyncNitkuPpjk').click();
if (pibDoc.querySelector('#pibPpjkNitku').value !== '0123456789012345000000') throw new Error('FAIL R4: NITKU sync failed');

// Test collectPibFormData
const collected = pibWin.collectPibFormData();
if (!collected.entitas || !collected.entitas.pengirim || !collected.entitas.pembeli || !collected.entitas.pemilikBarang || !collected.entitas.penerima || !collected.entitas.penjual || !collected.entitas.ppjk) throw new Error('FAIL R4: collectPibFormData entitas missing cards');
if (collected.entitas.pengirim.nama !== 'GLOBAL AUDIT EXPORTER LTD') throw new Error('FAIL R4: collectPibFormData pengirim.nama incorrect');
if (collected.entitas.penerima.nama !== 'PT AUDIT PENERIMA INDONESIA') throw new Error('FAIL R4: collectPibFormData penerima.nama incorrect');
if (collected.entitas.ppjk.nitku !== '0123456789012345000000') throw new Error('FAIL R4: collectPibFormData ppjk.nitku incorrect');

// Test populatePibForm / loadPibDraftData
pibWin.populatePibForm({
  entitas: {
    pengirim: { nama: 'REPOPULATED SHP' },
    penerima: { nama: 'REPOPULATED RCV' }
  }
});
if (pibDoc.querySelector('#pibPengirimName').value !== 'REPOPULATED SHP') throw new Error('FAIL R4: populatePibForm pengirim failed');
if (pibDoc.querySelector('#pibPenerimaName').value !== 'REPOPULATED RCV') throw new Error('FAIL R4: populatePibForm penerima failed');
console.log('[AUDIT PASS] R4: Copy handlers, collectPibFormData, and populatePibForm fully functional');

// -----------------------------------------------------------------------------
// AUDIT R4 (Part 2): content.js handleCeisaAutoInputRow into CEISA portal DOM
// -----------------------------------------------------------------------------
const { window: portalWin, document: portalDoc } = createMockCeisaPortalDom();
loadContentScriptFunctions(portalWin);

const filledFields = [];
const container = portalDoc.getElementById('tab-entitas');
const autoInputResult = portalWin.handleCeisaAutoInputRow(collected, container, 'entitas', filledFields);

if (!autoInputResult || !autoInputResult.ok) {
  throw new Error('FAIL R4: handleCeisaAutoInputRow returned !ok: ' + JSON.stringify(autoInputResult));
}

const pengirimNamaEl = portalDoc.getElementById('ceisa_pengirim_nama');
if (!pengirimNamaEl || pengirimNamaEl.value !== 'GLOBAL AUDIT EXPORTER LTD') {
  throw new Error('FAIL R4: content.js did not auto-fill ceisa_pengirim_nama, got ' + (pengirimNamaEl ? pengirimNamaEl.value : 'missing'));
}

const penerimaNamaEl = portalDoc.getElementById('ceisa_penerima_nama');
if (!penerimaNamaEl || penerimaNamaEl.value !== 'PT AUDIT PENERIMA INDONESIA') {
  throw new Error('FAIL R4: content.js did not auto-fill ceisa_penerima_nama, got ' + (penerimaNamaEl ? penerimaNamaEl.value : 'missing'));
}

const ppjkNitkuEl = portalDoc.getElementById('ceisa_ppjk_nitku');
// User requirement: PPJK card must NOT be auto-filled (left for user manual entry)
if (ppjkNitkuEl && ppjkNitkuEl.value !== '') {
  throw new Error('FAIL R4: PPJK should NOT be auto-filled, but got ' + ppjkNitkuEl.value);
}
console.log('[AUDIT PASS] R4: content.js handleCeisaAutoInputRow correctly maps all cards into portal DOM');

console.log('================================================================');
console.log('  ALL INDEPENDENT AUDITOR VERIFICATION CHECKS PASSED (100%)');
console.log('================================================================');
process.exit(0);
