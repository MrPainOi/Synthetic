/**
 * Comprehensive Adversarial Verification Suite for Milestone 3
 * Challenger 2 (Empirical Adversarial Testing)
 */
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

const { loadContentScriptFunctions, createMockCeisaPortalDom } = require('./e2e/helpers/dom_env');

let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✓ PASS: ${testName}`);
        passedTests++;
    } else {
        console.error(`  ✗ FAIL: ${testName} - ${details}`);
        failedTests++;
        failures.push({ testName, details });
    }
}

// =========================================================================
// SUITE 1: REAL CEISA 4.0 PORTAL CARD RESOLUTION & DISAMBIGUATION
// =========================================================================
function runRealCeisaCardResolutionTests() {
    console.log('\n=======================================================');
    console.log('SUITE 1: Real CEISA 4.0 Ant-Card Resolution & Disambiguation');
    console.log('=======================================================');

    const html = `
    <!DOCTYPE html>
    <html><body>
        <div id="portal-root">
            <div class="ant-tabs-tabpane-active">
                <!-- Column 1 (Left) -->
                <div class="ant-card">
                    <div class="ant-card-head">
                        <div class="ant-card-head-title">Pengirim</div>
                        <div class="ant-card-extra"><button>Referensi</button></div>
                    </div>
                    <div class="ant-card-body">
                        <input name="nama" id="c_pengirim_nama" />
                        <input name="nomorIdentitas" id="c_pengirim_id" />
                    </div>
                </div>

                <div class="ant-card">
                    <div class="ant-card-head">
                        <div class="ant-card-head-title">Pembeli</div>
                        <div class="ant-card-extra">
                            <button>Hapus Pembeli</button>
                            <button>Salin data penerima</button>
                        </div>
                    </div>
                    <div class="ant-card-body">
                        <input name="nama" id="c_pembeli_nama" />
                        <input name="nomorIdentitas" id="c_pembeli_id" />
                    </div>
                </div>

                <div class="ant-card">
                    <div class="ant-card-head">
                        <div class="ant-card-head-title">Pemilik Barang</div>
                        <div class="ant-card-extra">
                            <button>Salin Penerima</button>
                            <button>Referensi</button>
                        </div>
                    </div>
                    <div class="ant-card-body">
                        <input name="nama" id="c_pemilik_nama" />
                        <input name="nomorIdentitas" id="c_pemilik_id" />
                    </div>
                </div>

                <!-- Column 2 (Right) -->
                <div class="ant-card">
                    <div class="ant-card-head">
                        <div class="ant-card-head-title">Penerima</div>
                        <div class="ant-card-extra"><button>Referensi</button></div>
                    </div>
                    <div class="ant-card-body">
                        <input name="nama" id="c_penerima_nama" />
                        <input name="nomorIdentitas" id="c_penerima_id" />
                    </div>
                </div>

                <div class="ant-card">
                    <div class="ant-card-head">
                        <div class="ant-card-head-title">Penjual</div>
                        <div class="ant-card-extra"><button>Salin data pengirim</button></div>
                    </div>
                    <div class="ant-card-body">
                        <input name="nama" id="c_penjual_nama" />
                        <input name="nomorIdentitas" id="c_penjual_id" />
                    </div>
                </div>

                <div class="ant-card">
                    <div class="ant-card-head">
                        <div class="ant-card-head-title">PPJK</div>
                    </div>
                    <div class="ant-card-body">
                        <input name="nama" id="c_ppjk_nama" />
                        <input name="nomorIdentitas" id="c_ppjk_id" />
                    </div>
                </div>
            </div>
        </div>
    </body></html>
    `;

    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://ceisa40.beacukai.go.id/pib' });
    loadContentScriptFunctions(dom.window);
    const root = dom.window.document.getElementById('portal-root');

    // Test findCeisaCard on each entity in standard portal DOM
    const cardPengirim = dom.window.findCeisaCard('pengirim', root);
    const cardPembeli = dom.window.findCeisaCard('pembeli', root);
    const cardPemilik = dom.window.findCeisaCard('pemilik', root);
    const cardPenerima = dom.window.findCeisaCard('penerima', root);
    const cardPenjual = dom.window.findCeisaCard('penjual', root);
    const cardPpjk = dom.window.findCeisaCard('ppjk', root);

    assert(cardPengirim && cardPengirim.querySelector('.ant-card-head-title').textContent.trim() === 'Pengirim',
        'findCeisaCard("pengirim") resolves Card Pengirim correctly');

    assert(cardPembeli && cardPembeli.querySelector('.ant-card-head-title').textContent.trim() === 'Pembeli',
        'findCeisaCard("pembeli") resolves Card Pembeli (does not collide with "Salin data penerima")');

    assert(cardPemilik && cardPemilik.querySelector('.ant-card-head-title').textContent.trim() === 'Pemilik Barang',
        'findCeisaCard("pemilik") resolves Card Pemilik Barang');

    assert(cardPenerima && cardPenerima.querySelector('.ant-card-head-title').textContent.trim() === 'Penerima',
        'findCeisaCard("penerima") resolves Card Penerima (does not collide with "Salin Penerima" in Pemilik card)',
        cardPenerima ? `Matched "${cardPenerima.querySelector('.ant-card-head-title').textContent.trim()}" instead of "Penerima"` : 'Returned null');

    assert(cardPenjual && cardPenjual.querySelector('.ant-card-head-title').textContent.trim() === 'Penjual',
        'findCeisaCard("penjual") resolves Card Penjual');

    assert(cardPpjk && cardPpjk.querySelector('.ant-card-head-title').textContent.trim() === 'PPJK',
        'findCeisaCard("ppjk") resolves Card PPJK');

    // Test full auto-input on this DOM
    const payload = {
        entitas: {
            pengirim: { nama: 'SHANGHAI TRADING CO', nomorIdentitas: 'SH-001' },
            pembeli: { nama: 'PT PEMBELI NUSANTARA', nomorIdentitas: '011111111000' },
            pemilikBarang: { nama: 'PT CARGO OWNER', nomorIdentitas: '022222222000' },
            penerima: { nama: 'PT PENERIMA SEJAHTERA', nomorIdentitas: '033333333000' },
            penjual: { nama: 'SHANGHAI SELLER CORP', nomorIdentitas: 'SH-999' },
            ppjk: { nama: 'PT PPJK MITRA UTAMA', nomorIdentitas: '044444444000' }
        }
    };

    dom.window.handleCeisaAutoInputRow(payload, root, 'entitas');

    assert(dom.window.document.getElementById('c_pengirim_nama').value === 'SHANGHAI TRADING CO',
        'Pengirim input populated correctly');
    assert(dom.window.document.getElementById('c_pembeli_nama').value === 'PT PEMBELI NUSANTARA',
        'Pembeli input populated correctly');
    assert(dom.window.document.getElementById('c_pemilik_nama').value === 'PT CARGO OWNER',
        'Pemilik Barang input populated correctly');
    assert(dom.window.document.getElementById('c_penerima_nama').value === 'PT PENERIMA SEJAHTERA',
        'Penerima input populated correctly without being overwritten or missed',
        `Actual value: "${dom.window.document.getElementById('c_penerima_nama').value}"`);
    assert(dom.window.document.getElementById('c_penjual_nama').value === 'SHANGHAI SELLER CORP',
        'Penjual input populated correctly');
    assert(dom.window.document.getElementById('c_ppjk_nama').value === '',
        'PPJK input intentionally not auto-filled per user request');
}

// =========================================================================
// SUITE 2: NON-REGRESSION ACROSS OTHER SECTIONS
// =========================================================================
function runOtherSectionsNonRegressionTests() {
    console.log('\n=======================================================');
    console.log('SUITE 2: Non-Regression Across Other Sections');
    console.log('=======================================================');

    const html = `
    <!DOCTYPE html>
    <html><body>
        <div id="container-sections">
            <!-- Dokumen -->
            <input name="kodeJenisDokumen" id="sec_kodeDokumen" />
            <input name="nomorDokumen" id="sec_nomorDokumen" />
            <input name="tanggalDokumen" id="sec_tanggalDokumen" />

            <!-- Barang -->
            <input name="posTarif" id="sec_posTarif" />
            <textarea name="uraian" id="sec_uraian"></textarea>
            <input name="jumlahSatuan" id="sec_qty" />
            <input name="kodeSatuan" id="sec_satuan" />
            <input name="nilaiBarang" id="sec_nilaiBarang" />
            <input name="netto" id="sec_netto" />

            <!-- Header -->
            <input name="nomorAju" id="sec_nomorAju" />
            <input name="kodeKantor" id="sec_kodeKantor" />
            <input name="jenisPemasukan" id="sec_jenisPemasukan" />
            <input name="jenisPemberitahuan" id="sec_jenisPemberitahuan" />
            <input name="kategoriPemasukan" id="sec_kategoriPemasukan" />
            <input name="tujuanPemasukan" id="sec_tujuanPemasukan" />
            <input name="jenisTransaksiPajak" id="sec_jenisTransaksiPajak" />

            <!-- Pengangkut -->
            <input name="caraPengangkutan" id="sec_caraAngkut" />
            <input name="namaSaranaPengangkut" id="sec_vessel" />
            <input name="nomorPengangkut" id="sec_voyage" />
            <input name="benderaPengangkut" id="sec_bendera" />
            <input name="pelabuhanMuat" id="sec_portLoad" />
            <input name="pelabuhanBongkar" id="sec_portDischarge" />
            <input name="tempatPenimbunan" id="sec_tps" />

            <!-- Kemasan -->
            <input name="jenisKemasan" id="sec_pkgType" />
            <input name="jumlahKemasan" id="sec_pkgQty" />
            <input name="merekKemasan" id="sec_pkgBrand" />
            <input name="nomorKontainer" id="sec_contNum" />
            <input name="ukuranKontainer" id="sec_contSize" />
            <input name="jenisKontainer" id="sec_contType" />
            <input name="beratKotor" id="sec_bruto" />
            <input name="beratBersih" id="sec_nettoKemasan" />

            <!-- Transaksi -->
            <input name="kodeValuta" id="sec_valuta" />
            <input name="kurs" id="sec_kurs" />
            <input name="jenisHarga" id="sec_incoterm" />
            <input name="nilaiTransaksi" id="sec_invAmt" />
            <input name="freight" id="sec_freight" />
            <input name="asuransi" id="sec_asuransi" />
            <input name="jenisAsuransi" id="sec_jnsAsuransi" />

            <!-- Pungutan -->
            <input name="nilaiPabean" id="sec_cifRp" />
            <input name="tarifBm" id="sec_tarifBm" />
            <input name="nilaiBm" id="sec_nilaiBm" />
            <input name="tarifPpn" id="sec_tarifPpn" />
            <input name="nilaiPpn" id="sec_nilaiPpn" />
            <input name="tarifPph" id="sec_tarifPph" />
            <input name="nilaiPph" id="sec_nilaiPph" />
            <input name="totalBilling" id="sec_totalBilling" />
        </div>
    </body></html>
    `;

    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://ceisa40.beacukai.go.id/pib' });
    loadContentScriptFunctions(dom.window);
    const container = dom.window.document.getElementById('container-sections');

    // Test Dokumen
    const dokRes = dom.window.handleCeisaAutoInputRow({
        code: '380', number: 'INV-2026-999', date: '2026-11-10'
    }, container, 'dokumen');
    assert(dokRes.ok && dom.window.document.getElementById('sec_nomorDokumen').value === 'INV-2026-999',
        'Section "dokumen" correctly fills nomorDokumen');

    // Test Barang
    const brgRes = dom.window.handleCeisaAutoInputRow({
        hsCode: '8471.30.90', description: 'LAPTOP COMPUTER INTEL I7', quantity: '50', uom: 'PCE', cifValue: '25000', netWeight: '120.5'
    }, container, 'barang');
    assert(brgRes.ok && dom.window.document.getElementById('sec_posTarif').value === '84713090' &&
           dom.window.document.getElementById('sec_uraian').value === 'LAPTOP COMPUTER INTEL I7',
        'Section "barang" correctly strips HS formatting and fills description');

    // Test Header
    const hdrRes = dom.window.handleCeisaAutoInputRow({
        nomorAju: '00002012345620261110000001', kodeKantor: '040300', jenisPemasukan: '1', jenisPemberitahuan: '1'
    }, container, 'header');
    assert(hdrRes.ok && dom.window.document.getElementById('sec_nomorAju').value === '00002012345620261110000001',
        'Section "header" correctly fills nomorAju');

    // Test Pengangkut
    const trnRes = dom.window.handleCeisaAutoInputRow({
        caraPengangkutan: '1 - LAUT', vesselName: 'EVER GIVEN', voyageNumber: 'V.104W', vesselFlag: 'PA'
    }, container, 'pengangkut');
    assert(trnRes.ok && dom.window.document.getElementById('sec_vessel').value === 'EVER GIVEN',
        'Section "pengangkut" correctly fills vesselName');

    // Test Kemasan
    const pkgRes = dom.window.handleCeisaAutoInputRow({
        packageType: 'CT', packageQty: '100', containerNumber: 'EMCU1234567', grossWeight: '1500.5'
    }, container, 'kemasan');
    assert(pkgRes.ok && dom.window.document.getElementById('sec_contNum').value === 'EMCU1234567',
        'Section "kemasan" correctly fills containerNumber');

    // Test Transaksi
    const trxRes = dom.window.handleCeisaAutoInputRow({
        currency: 'USD', exchangeRate: '15850', incoterm: 'FOB', invoiceAmount: '50000'
    }, container, 'transaksi');
    assert(trxRes.ok && dom.window.document.getElementById('sec_invAmt').value === '50000',
        'Section "transaksi" correctly fills invoiceAmount');

    // Test Pungutan (Intentionally skipped / not auto-filled per user request)
    const pgtRes = dom.window.handleCeisaAutoInputRow({
        cifRupiah: '792500000', tarifBm: '5', nilaiBm: '39625000', tarifPpn: '11', totalBilling: '130762500'
    }, container, 'pungutan');
    assert(pgtRes.ok && dom.window.document.getElementById('sec_cifRp').value === '',
        'Section "pungutan" intentionally not auto-filled per user request');
}

// =========================================================================
// SUITE 3: POLYMORPHIC INVOCATION SIGNATURES
// =========================================================================
function runPolymorphicInvocationTests() {
    console.log('\n=======================================================');
    console.log('SUITE 3: Polymorphic Invocation Signatures');
    console.log('=======================================================');

    const dom = createMockCeisaPortalDom();
    loadContentScriptFunctions(dom.window);

    // Sig 1: Chrome Extension Message Object
    const msgPayload = {
        type: 'CEISA_AUTO_INPUT_ROW',
        section: 'entitas',
        draftType: 'PIB',
        item: {
            entitas: {
                pengirim: { nama: 'POLY SHANGHAI', nomorIdentitas: 'P-1' }
            }
        },
        index: 0,
        total: 1
    };
    const res1 = dom.window.handleCeisaAutoInputRow(msgPayload);
    assert(res1 && res1.ok === true, 'Signature 1 (Chrome message object) returns ok: true');
    assert(dom.window.document.getElementById('ceisa_pengirim_nama').value === 'POLY SHANGHAI',
        'Signature 1 successfully auto-fills DOM from item');

    // Sig 2: Empty item in Chrome message object
    const resEmptyMsg = dom.window.handleCeisaAutoInputRow({ type: 'CEISA_AUTO_INPUT_ROW' });
    assert(resEmptyMsg && resEmptyMsg.ok === false && resEmptyMsg.message === 'Data baris kosong.',
        'Signature 1 handles missing item gracefully with error message');

    // Sig 3: Direct Harness Signature (item, container, section, filledFields)
    const filledFields = [];
    const container = dom.window.document.getElementById('tab-entitas');
    const res3 = dom.window.handleCeisaAutoInputRow(
        { entitas: { penerima: { nama: 'HARNESS IMPORTER', nomorIdentitas: '0123' } } },
        container,
        'entitas',
        filledFields
    );
    assert(res3 && res3.ok === true, 'Signature 2 (item, container, section, filledFields) returns ok: true');
    assert(filledFields.length > 0, 'Signature 2 pushes filled field logs to filledFields array');
    assert(dom.window.document.getElementById('ceisa_penerima_nama').value === 'HARNESS IMPORTER',
        'Signature 2 successfully auto-fills target card in container');

    // Sig 4: Dispatch signature (row, docType, rowData, forceTab)
    const res4 = dom.window.handleCeisaAutoInputRow(
        0,
        'PIB',
        { entitas: { penjual: { nama: 'DISPATCH SELLER', nomorIdentitas: 'S-77' } } },
        false
    );
    assert(res4 && res4.ok === true, 'Signature 3 (row, docType, rowData, forceTab) returns ok: true');
    assert(dom.window.document.getElementById('ceisa_penjual_nama').value === 'DISPATCH SELLER',
        'Signature 3 successfully auto-fills target card');

    // Sig 5: Single object signature (payload)
    const res5 = dom.window.handleCeisaAutoInputRow({
        section: 'entitas',
        item: { entitas: { pengirim: { nama: 'SINGLE OBJ PENGIRIM', nomorIdentitas: 'SH-99' } } }
    });
    assert(res5 && res5.ok === true, 'Signature 4 (single object with { section, item }) returns ok: true');
    assert(dom.window.document.getElementById('ceisa_pengirim_nama').value === 'SINGLE OBJ PENGIRIM',
        'Signature 4 successfully auto-fills target card');

    // Sig 6: Boundary calls: undefined, null, number, boolean
    try {
        const resUndef = dom.window.handleCeisaAutoInputRow();
        assert(resUndef && resUndef.ok === true, 'No-args invocation does not throw runtime error');
    } catch (e) {
        assert(false, 'No-args invocation threw exception', e.message);
    }

    try {
        const resNull = dom.window.handleCeisaAutoInputRow(null);
        assert(resNull && resNull.ok === true, 'null invocation does not throw runtime error');
    } catch (e) {
        assert(false, 'null invocation threw exception', e.message);
    }

    try {
        const resNum = dom.window.handleCeisaAutoInputRow(12345);
        assert(resNum && resNum.ok === true, 'number invocation does not throw runtime error');
    } catch (e) {
        assert(false, 'number invocation threw exception', e.message);
    }
}

// =========================================================================
// SUITE 4: EDGE CASE DATA PAYLOADS
// =========================================================================
function runEdgeCasePayloadTests() {
    console.log('\n=======================================================');
    console.log('SUITE 4: Edge Case Data Payloads (Unicode, Special Chars, Missing)');
    console.log('=======================================================');

    const dom = createMockCeisaPortalDom();
    loadContentScriptFunctions(dom.window);
    const container = dom.window.document.getElementById('tab-entitas');

    // Edge Case 1: Foreign supplier special characters (Accents, Umlauts, Quotes, Ampersand, XSS)
    const specialCharsPayload = {
        entitas: {
            pengirim: {
                nama: "MÖLLER & SÖHNE GMBH & CO. KG / L'ORÉAL \"INTERNATIONAL\" <TECH>",
                alamat: "Straße der Pariser Kommune 20-22, 10243 Berlin & Co., C/O Suite #404\nFloor 4, Building 'A'",
                nomorIdentitas: "DE-123456789/XYZ",
                negara: "DE"
            }
        }
    };

    dom.window.handleCeisaAutoInputRow(specialCharsPayload, container, 'entitas');

    assert(dom.window.document.getElementById('ceisa_pengirim_nama').value === specialCharsPayload.entitas.pengirim.nama,
        'Special characters preserved intact in supplier name (accents, quotes, ampersands)');
    assert(dom.window.document.getElementById('ceisa_pengirim_alamat').value === specialCharsPayload.entitas.pengirim.alamat,
        'Multiline and special punctuation preserved intact in supplier address');

    // Edge Case 2: Unicode & Asian Characters
    const unicodePayload = {
        entitas: {
            pengirim: {
                nama: "上海精密机械制造有限公司 (SHANGHAI PRECISION) 🇯🇵 東京エレクトロン",
                alamat: "上海市青浦区崧泽大道888号 101室 🚢",
                nomorIdentitas: "CN-913100007178",
                negara: "CN"
            }
        }
    };

    dom.window.handleCeisaAutoInputRow(unicodePayload, container, 'entitas');

    assert(dom.window.document.getElementById('ceisa_pengirim_nama').value === unicodePayload.entitas.pengirim.nama,
        'Unicode characters preserved intact (Chinese, Japanese, Emojis)');
    assert(dom.window.document.getElementById('ceisa_pengirim_alamat').value === unicodePayload.entitas.pengirim.alamat,
        'Unicode address preserved intact');

    // Edge Case 3: Missing optional fields (ijinBpNo, ijinBpTgl, nitku omitted)
    // First set values
    dom.window.document.getElementById('ceisa_penerima_ijin_no').value = 'EXISTING_BP_123';
    dom.window.document.getElementById('ceisa_penerima_nitku').value = 'EXISTING_NITKU_456';

    const missingOptionalPayload = {
        entitas: {
            penerima: {
                nama: 'PT IMPORTIR NORMAL',
                nomorIdentitas: '0123456780120000',
                alamat: 'Jl. Industri',
                negara: 'ID',
                status: 'LAINNYA',
                nitku: null, // Should NOT overwrite existing
                ijinBpNo: undefined, // Should NOT overwrite existing
                ijinBpTgl: '' // Empty string should NOT overwrite existing
            }
        }
    };

    dom.window.handleCeisaAutoInputRow(missingOptionalPayload, container, 'entitas');

    assert(dom.window.document.getElementById('ceisa_penerima_nama').value === 'PT IMPORTIR NORMAL',
        'Penerima name populated when optional fields are null/undefined');
    assert(dom.window.document.getElementById('ceisa_penerima_ijin_no').value === 'EXISTING_BP_123',
        'Omitted optional ijinBpNo does not overwrite existing DOM value');
    assert(dom.window.document.getElementById('ceisa_penerima_nitku').value === 'EXISTING_NITKU_456',
        'Null optional nitku does not overwrite existing DOM value with "null"');

    // Edge Case 4: Non-string numbers coerced safely
    const numericPayload = {
        entitas: {
            penerima: {
                nomorIdentitas: 830727251085000, // Numeric NPWP
                nitku: 830727251085000000000n // BigInt or large number
            }
        }
    };

    try {
        dom.window.handleCeisaAutoInputRow(numericPayload, container, 'entitas');
        assert(dom.window.document.getElementById('ceisa_penerima_id').value === '830727251085000',
            'Numeric NPWP coerced safely to string without exception');
    } catch (e) {
        assert(false, 'Numeric NPWP threw error', e.message);
    }

    // Edge Case 5: Extremely long payload values (5000+ characters)
    const longString = 'A'.repeat(5000);
    const longPayload = {
        entitas: {
            pengirim: {
                alamat: longString
            }
        }
    };

    dom.window.handleCeisaAutoInputRow(longPayload, container, 'entitas');
    assert(dom.window.document.getElementById('ceisa_pengirim_alamat').value.length === 5000,
        '5000-character address populated safely without DOM overflow error');
}

// Execute all test suites
console.log('Starting Empirical Adversarial Verification for Milestone 3...');
runRealCeisaCardResolutionTests();
runOtherSectionsNonRegressionTests();
runPolymorphicInvocationTests();
runEdgeCasePayloadTests();

console.log('\n=======================================================');
console.log('ADVERSARIAL VERIFICATION SUMMARY');
console.log('=======================================================');
console.log(`Passed : ${passedTests}`);
console.log(`Failed : ${failedTests}`);
console.log(`Total  : ${passedTests + failedTests}`);

if (failedTests > 0) {
    console.error('\nFAILURES RECORDED:');
    failures.forEach((f, idx) => {
        console.error(`${idx + 1}. ${f.testName}: ${f.details}`);
    });
    process.exit(1);
} else {
    console.log('\nALL ADVERSARIAL TESTS PASSED!');
    process.exit(0);
}
