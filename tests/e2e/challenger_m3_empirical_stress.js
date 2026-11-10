/**
 * Empirical Stress Test Harness for Milestone 3 (content.js CEISA 4.0 Auto-Input)
 * Authored by Challenger 1 (fcb3cdae-c057-4417-bcd3-b310264207f7)
 */
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../..');
const contentJsPath = path.join(ROOT_DIR, 'content.js');
const rawContentJs = fs.readFileSync(contentJsPath, 'utf8');

function setupTestDom(htmlBody) {
    const fullHtml = `<!DOCTYPE html><html><head><title>Test</title></head><body>${htmlBody}</body></html>`;
    const dom = new JSDOM(fullHtml, { runScripts: 'outside-only', url: 'https://ceisa40.beacukai.go.id/pib' });
    const { window } = dom;

    window.chrome = {
        runtime: {
            onMessage: { addListener: () => {} },
            sendMessage: () => {},
            getURL: (s) => s
        },
        storage: {
            local: {
                get: (k, cb) => { if (cb) cb({}); return Promise.resolve({}); },
                set: (o, cb) => { if (cb) cb(); return Promise.resolve(); }
            },
            onChanged: { addListener: () => {} }
        }
    };

    // Expose internal functions
    const testExposeJs = rawContentJs.replace(
        /\}\)\(\);?\s*$/,
        `
        window.handleCeisaAutoInputRow = typeof handleCeisaAutoInputRow !== 'undefined' ? handleCeisaAutoInputRow : null;
        window.findFieldByKeywords = typeof findFieldByKeywords !== 'undefined' ? findFieldByKeywords : null;
        window.setNativeInputValue = typeof setNativeInputValue !== 'undefined' ? setNativeInputValue : null;
        window.findCeisaCard = typeof findCeisaCard !== 'undefined' ? findCeisaCard : null;
        })();
        `
    );

    window.eval(`
        if (typeof chrome === 'undefined') var chrome = window.chrome;
        ${testExposeJs}
    `);

    return dom;
}

/**
 * Builds realistic CEISA 4.0 DOM WITHOUT artificial helper classes (e.g. .card-pengirim).
 * Uses strictly standard Ant Design / CEISA 4.0 classes and includes realistic action buttons in headers!
 */
function buildRealisticCeisaDom(options = {}) {
    return `
    <div class="ant-tabs-content">
        <div class="ant-tabs-tabpane ant-tabs-tabpane-active" id="tab-entitas">
            <div class="ceisa-cards-container">
                <!-- Column 1 (Left) -->
                <div class="col-left">
                    <!-- 1. Card Pengirim -->
                    <div class="ant-card" id="dom-pengirim">
                        <div class="ant-card-head">
                            <div class="ant-card-head-title">Pengirim</div>
                            <div class="ant-card-extra"><button type="button">Referensi</button></div>
                        </div>
                        <div class="ant-card-body">
                            <select name="jenisIdentitas" id="pengirim_id_type">
                                <option value="4">4 - PASPOR</option>
                                <option value="5">5 - LAINNYA</option>
                            </select>
                            <input name="nomorIdentitas" id="pengirim_id" />
                            <input name="nama" id="pengirim_nama" />
                            <textarea name="alamat" id="pengirim_alamat"></textarea>
                            <input name="negara" id="pengirim_negara" />
                        </div>
                    </div>

                    <!-- 2. Card Pembeli (Has button 'Salin data penerima' in header extra) -->
                    <div class="ant-card" id="dom-pembeli">
                        <div class="ant-card-head">
                            <div class="ant-card-head-title">Pembeli</div>
                            <div class="ant-card-extra">
                                <button type="button">Hapus Pembeli</button>
                                <button type="button">Salin data penerima</button>
                            </div>
                        </div>
                        <div class="ant-card-body">
                            <select name="jenisIdentitas" id="pembeli_id_type">
                                <option value="0">0 - NPWP 15 DIGIT</option>
                                <option value="6">6 - NPWP 16 DIGIT</option>
                            </select>
                            <input name="nomorIdentitas" id="pembeli_id" />
                            <input name="nitku" id="pembeli_nitku" maxlength="22" />
                            <input name="nama" id="pembeli_nama" />
                            <textarea name="alamat" id="pembeli_alamat"></textarea>
                            <input name="negara" id="pembeli_negara" />
                        </div>
                    </div>

                    <!-- 3. Card Pemilik Barang (Has button 'Salin Penerima' in header extra) -->
                    <div class="ant-card" id="dom-pemilik">
                        <div class="ant-card-head">
                            <div class="ant-card-head-title">Pemilik Barang</div>
                            <div class="ant-card-extra">
                                <button type="button">Salin Penerima</button>
                                <button type="button">Referensi</button>
                            </div>
                        </div>
                        <div class="ant-card-body">
                            <select name="jenisIdentitas" id="pemilik_id_type">
                                <option value="6">6 - NPWP 16 DIGIT</option>
                            </select>
                            <input name="nomorIdentitas" id="pemilik_id" />
                            <input name="nitku" id="pemilik_nitku" maxlength="22" />
                            <input name="nama" id="pemilik_nama" />
                            <textarea name="alamat" id="pemilik_alamat"></textarea>
                            <select name="afiliasi" id="pemilik_afiliasi">
                                <option value="TAH">TAH - Tidak berhubungan</option>
                                <option value="HUB">HUB - Berhubungan</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Column 2 (Right) -->
                <div class="col-right">
                    <!-- 4. Card Penerima -->
                    <div class="ant-card" id="dom-penerima">
                        <div class="ant-card-head">
                            <div class="ant-card-head-title">Penerima</div>
                            <div class="ant-card-extra"><button type="button">Referensi</button></div>
                        </div>
                        <div class="ant-card-body">
                            <select name="jenisIdentitas" id="penerima_id_type">
                                <option value="0">0 - NPWP 15 DIGIT</option>
                                <option value="6">6 - NPWP 16 DIGIT</option>
                            </select>
                            <input name="nomorIdentitas" id="penerima_id" />
                            <input name="nitku" id="penerima_nitku" maxlength="22" />
                            <input name="nama" id="penerima_nama" />
                            <textarea name="alamat" id="penerima_alamat"></textarea>
                            <input name="negara" id="penerima_negara" />
                            <input name="status" id="penerima_status" />
                            <input name="noIjin" id="penerima_ijin_no" />
                            <input name="tglIzin" id="penerima_ijin_tgl" type="date" />
                        </div>
                    </div>

                    <!-- 5. Card Penjual (Has button 'Salin data pengirim' in header extra) -->
                    <div class="ant-card" id="dom-penjual">
                        <div class="ant-card-head">
                            <div class="ant-card-head-title">Penjual</div>
                            <div class="ant-card-extra"><button type="button">Salin data pengirim</button></div>
                        </div>
                        <div class="ant-card-body">
                            <select name="jenisIdentitas" id="penjual_id_type">
                                <option value="4">4 - PASPOR</option>
                                <option value="5">5 - LAINNYA</option>
                            </select>
                            <input name="nomorIdentitas" id="penjual_id" />
                            <input name="nama" id="penjual_nama" />
                            <textarea name="alamat" id="penjual_alamat"></textarea>
                            <input name="negara" id="penjual_negara" />
                        </div>
                    </div>

                    <!-- 6. Card PPJK -->
                    <div class="ant-card" id="dom-ppjk">
                        <div class="ant-card-head">
                            <div class="ant-card-head-title">PPJK</div>
                        </div>
                        <div class="ant-card-body">
                            <select name="jenisIdentitas" id="ppjk_id_type">
                                <option value="6">6 - NPWP 16 DIGIT</option>
                            </select>
                            <input name="nomorIdentitas" id="ppjk_id" />
                            <input name="nitku" id="ppjk_nitku" maxlength="22" />
                            <input name="nama" id="ppjk_nama" />
                            <textarea name="alamat" id="ppjk_alamat"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

const tests = [];
function addTest(name, fn) {
    tests.push({ name, fn });
}

// -------------------------------------------------------------------------
// TEST SUITE 1: Card Disambiguation in Realistic CEISA 4.0 DOM
// -------------------------------------------------------------------------
addTest('STRESS-1.1: findCeisaCard disambiguates Penerima from Pemilik Barang (with "Salin Penerima" button)', (win, doc) => {
    const cardPenerima = win.findCeisaCard('penerima', doc);
    if (!cardPenerima) throw new Error('findCeisaCard("penerima") returned null');
    if (cardPenerima.id !== 'dom-penerima') {
        throw new Error(`COLLISION DETECTED: findCeisaCard("penerima") matched ${cardPenerima.id} instead of dom-penerima! Header text contaminated by button.`);
    }
});

addTest('STRESS-1.2: findCeisaCard disambiguates Penerima from Pembeli (with "Salin data penerima" button)', (win, doc) => {
    const cardPembeli = win.findCeisaCard('pembeli', doc);
    if (!cardPembeli) throw new Error('findCeisaCard("pembeli") returned null');
    if (cardPembeli.id !== 'dom-pembeli') {
        throw new Error(`COLLISION DETECTED: findCeisaCard("pembeli") matched ${cardPembeli.id} instead of dom-pembeli!`);
    }
});

addTest('STRESS-1.3: findCeisaCard disambiguates Pengirim from Penjual (with "Salin data pengirim" button)', (win, doc) => {
    const cardPengirim = win.findCeisaCard('pengirim', doc);
    if (!cardPengirim) throw new Error('findCeisaCard("pengirim") returned null');
    if (cardPengirim.id !== 'dom-pengirim') {
        throw new Error(`COLLISION DETECTED: findCeisaCard("pengirim") matched ${cardPengirim.id} instead of dom-pengirim!`);
    }

    const cardPenjual = win.findCeisaCard('penjual', doc);
    if (!cardPenjual) throw new Error('findCeisaCard("penjual") returned null');
    if (cardPenjual.id !== 'dom-penjual') {
        throw new Error(`COLLISION DETECTED: findCeisaCard("penjual") matched ${cardPenjual.id} instead of dom-penjual!`);
    }
});

addTest('STRESS-1.4: findCeisaCard locates all 6 entity cards independently', (win, doc) => {
    const keys = ['pengirim', 'penerima', 'pembeli', 'penjual', 'pemilik', 'ppjk'];
    const expectedIds = {
        pengirim: 'dom-pengirim',
        penerima: 'dom-penerima',
        pembeli: 'dom-pembeli',
        penjual: 'dom-penjual',
        pemilik: 'dom-pemilik',
        ppjk: 'dom-ppjk'
    };

    for (const k of keys) {
        const found = win.findCeisaCard(k, doc);
        if (!found) throw new Error(`Failed to find card for key: ${k}`);
        if (found.id !== expectedIds[k]) {
            throw new Error(`Key ${k} matched ${found.id}, expected ${expectedIds[k]}`);
        }
    }
});

// -------------------------------------------------------------------------
// TEST SUITE 2: Full Auto-Input Payload Verification on Realistic DOM
// -------------------------------------------------------------------------
addTest('STRESS-2.1: Full 6-Card Payload population into realistic DOM without cross-contamination', (win, doc) => {
    const payload = {
        entitas: {
            pengirim: { jenisIdentitas: '4', nomorIdentitas: 'PASS123', nama: 'SHANGHAI TRADING', alamat: 'Songze Ave 888', negara: 'CN' },
            pembeli: { jenisIdentitas: '6', nomorIdentitas: '9999888877776666', nitku: '9999888877776666000000', nama: 'BUYER CORP', alamat: 'Kawasan Industri A-1', negara: 'ID' },
            pemilikBarang: { jenisIdentitas: '6', nomorIdentitas: '5555444433332222', nitku: '5555444433332222000000', nama: 'CARGO OWNER LTD', alamat: 'Gudang Barat 45', afiliasi: 'HUB' },
            penerima: { jenisIdentitas: '6', nomorIdentitas: '1111222233334444', nitku: '1111222233334444000000', nama: 'IMPORTIR SEJAHTERA', alamat: 'Jl. Merdeka No. 10', negara: 'ID', status: 'MITA', ijinBpNo: 'BP-2026-001', ijinBpTgl: '2026-05-15' },
            penjual: { jenisIdentitas: '5', nomorIdentitas: 'SELLER999', nama: 'GLOBAL SELLER INC', alamat: 'Tokyo Bay 12', negara: 'JP' },
            ppjk: { jenisIdentitas: '6', nomorIdentitas: '3333444455556666', nitku: '3333444455556666000000', nama: 'LOGISTIK PRIMA PPJK', alamat: 'Pelabuhan No. 1' }
        }
    };

    win.handleCeisaAutoInputRow(payload, doc, 'entitas', []);

    // Assert Pengirim
    if (doc.getElementById('pengirim_id').value !== 'PASS123') throw new Error(`Pengirim ID mismatch: ${doc.getElementById('pengirim_id').value}`);
    if (doc.getElementById('pengirim_nama').value !== 'SHANGHAI TRADING') throw new Error(`Pengirim Nama mismatch: ${doc.getElementById('pengirim_nama').value}`);

    // Assert Pembeli vs Penerima (Crucial Collision Check)
    if (doc.getElementById('pembeli_nama').value !== 'BUYER CORP') throw new Error(`Pembeli Nama corrupted: ${doc.getElementById('pembeli_nama').value}`);
    if (doc.getElementById('penerima_nama').value !== 'IMPORTIR SEJAHTERA') throw new Error(`Penerima Nama corrupted: ${doc.getElementById('penerima_nama').value}`);
    if (doc.getElementById('pemilik_nama').value !== 'CARGO OWNER LTD') throw new Error(`Pemilik Nama corrupted: ${doc.getElementById('pemilik_nama').value}`);

    // Assert Penjual vs Pengirim
    if (doc.getElementById('penjual_nama').value !== 'GLOBAL SELLER INC') throw new Error(`Penjual Nama corrupted: ${doc.getElementById('penjual_nama').value}`);

    // Assert PPJK
    if (doc.getElementById('ppjk_nama').value !== 'LOGISTIK PRIMA PPJK') throw new Error(`PPJK Nama corrupted: ${doc.getElementById('ppjk_nama').value}`);
});

// -------------------------------------------------------------------------
// TEST SUITE 3: Input Types (<textarea>, <select>, disabled/readonly)
// -------------------------------------------------------------------------
addTest('STRESS-3.1: <textarea> multiline address preservation', (win, doc) => {
    const multilineAddr = "Gedung Cyber 2 Lantai 15\nJl. HR Rasuna Said Blok X-5\nJakarta Selatan 12950\r\nINDONESIA";
    const payload = {
        entitas: {
            penerima: { alamat: multilineAddr }
        }
    };
    win.handleCeisaAutoInputRow(payload, doc, 'entitas', []);
    const actual = doc.getElementById('penerima_alamat').value;
    if (actual !== multilineAddr) {
        throw new Error(`Textarea value corrupted. Expected: ${JSON.stringify(multilineAddr)}, Got: ${JSON.stringify(actual)}`);
    }
});

addTest('STRESS-3.2: <select> dropdown numeric code vs text label matching', (win, doc) => {
    // Test match by code "6" for jenisIdentitas
    const payload = {
        entitas: {
            pembeli: { jenisIdentitas: '6' }
        }
    };
    win.handleCeisaAutoInputRow(payload, doc, 'entitas', []);
    const select = doc.getElementById('pembeli_id_type');
    if (select.value !== '6') throw new Error(`Select matching by code '6' failed. Got: ${select.value}`);

    // Test match by text label prefix "TAH" or "Tidak berhubungan"
    const payload2 = {
        entitas: {
            pemilikBarang: { afiliasi: 'HUB' }
        }
    };
    win.handleCeisaAutoInputRow(payload2, doc, 'entitas', []);
    const selectAfiliasi = doc.getElementById('pemilik_afiliasi');
    if (selectAfiliasi.value !== 'HUB') throw new Error(`Select matching by label 'HUB' failed. Got: ${selectAfiliasi.value}`);
});

addTest('STRESS-3.3: Disabled and ReadOnly input protection', (win, doc) => {
    const disabledInput = doc.getElementById('pembeli_id');
    disabledInput.disabled = true;
    disabledInput.value = 'ORIGINAL_PRESERVED_VALUE';

    const readOnlyInput = doc.getElementById('penerima_nama');
    readOnlyInput.readOnly = true;
    readOnlyInput.value = 'READONLY_PRESERVED_NAME';

    const payload = {
        entitas: {
            pembeli: { nomorIdentitas: 'NEW_ATTEMPTED_ID' },
            penerima: { nama: 'NEW_ATTEMPTED_NAME' }
        }
    };

    win.handleCeisaAutoInputRow(payload, doc, 'entitas', []);

    if (disabledInput.value !== 'ORIGINAL_PRESERVED_VALUE') {
        throw new Error(`SECURITY BREACH: Disabled input was modified to: ${disabledInput.value}`);
    }
    if (readOnlyInput.value !== 'READONLY_PRESERVED_NAME') {
        throw new Error(`SECURITY BREACH: ReadOnly input was modified to: ${readOnlyInput.value}`);
    }
});

addTest('STRESS-3.4: Event dispatch verification (focus, input, change, blur)', (win, doc) => {
    const targetInput = doc.getElementById('penerima_id');
    const firedEvents = [];
    ['focus', 'input', 'change', 'blur'].forEach(evtType => {
        targetInput.addEventListener(evtType, (e) => {
            firedEvents.push({ type: e.type, bubbles: e.bubbles });
        });
    });

    const payload = {
        entitas: {
            penerima: { nomorIdentitas: '0123456780120000' }
        }
    };

    win.handleCeisaAutoInputRow(payload, doc, 'entitas', []);

    const eventNames = firedEvents.map(e => e.type);
    if (!eventNames.includes('input')) throw new Error('Event "input" was not fired on input element');
    if (!eventNames.includes('change')) throw new Error('Event "change" was not fired on input element');

    const inputEvt = firedEvents.find(e => e.type === 'input');
    if (!inputEvt.bubbles) throw new Error('Event "input" did not have bubbles: true');
});

// -------------------------------------------------------------------------
// TEST SUITE 4: Edge Values (null, undefined, "", literal "null", quotes)
// -------------------------------------------------------------------------
addTest('STRESS-4.1: Null, undefined, empty string, and literal "null" protection', (win, doc) => {
    const pengirimNameInp = doc.getElementById('pengirim_nama');
    pengirimNameInp.value = 'INITIAL_GOOD_VALUE';

    const penerimaNameInp = doc.getElementById('penerima_nama');
    penerimaNameInp.value = 'INITIAL_GOOD_VALUE_2';

    const payload = {
        entitas: {
            pengirim: { nama: 'null' },        // literal string "null"
            penerima: { nama: undefined },     // undefined
            pembeli: { nama: null },           // null
            penjual: { nama: '   ' }           // whitespace only
        }
    };

    win.handleCeisaAutoInputRow(payload, doc, 'entitas', []);

    if (pengirimNameInp.value !== 'INITIAL_GOOD_VALUE') {
        throw new Error(`Literal 'null' overwrote existing DOM value! Value is now: ${pengirimNameInp.value}`);
    }
    if (penerimaNameInp.value !== 'INITIAL_GOOD_VALUE_2') {
        throw new Error(`undefined overwrote existing DOM value! Value is now: ${penerimaNameInp.value}`);
    }
});

addTest('STRESS-4.2: Special characters, HTML tags, and single/double quotes', (win, doc) => {
    const specialStr = `<script>alert("xss")</script> & 'O"Reilly' \\ / % $ # @ !`;
    const payload = {
        entitas: {
            pengirim: { nama: specialStr }
        }
    };

    win.handleCeisaAutoInputRow(payload, doc, 'entitas', []);
    const actual = doc.getElementById('pengirim_nama').value;
    if (actual !== specialStr) {
        throw new Error(`Special characters corrupted. Expected: ${specialStr}, Got: ${actual}`);
    }
});

// -------------------------------------------------------------------------
// RUNNER
// -------------------------------------------------------------------------
async function runAll() {
    console.log('='.repeat(70));
    console.log('  CHALLENGER 1 EMPIRICAL STRESS TEST SUITE (Milestone 3)');
    console.log('='.repeat(70));

    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const t of tests) {
        const dom = setupTestDom(buildRealisticCeisaDom());
        try {
            t.fn(dom.window, dom.window.document);
            console.log(`  \x1b[32m✓\x1b[0m ${t.name}`);
            passed++;
        } catch (err) {
            console.log(`  \x1b[31m✗\x1b[0m ${t.name}`);
            console.log(`     \x1b[31mError:\x1b[0m ${err.message}`);
            failed++;
            failures.push({ name: t.name, error: err.message });
        }
    }

    console.log('='.repeat(70));
    console.log(`Results: ${passed} passed, ${failed} failed (${tests.length} total)`);
    console.log('='.repeat(70));

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAll();
