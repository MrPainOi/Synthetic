/**
 * Comprehensive Adversarial Test: Real CEISA 4.0 Portal DOM (without custom helper classes)
 */
const { JSDOM } = require('jsdom');
const { loadContentScriptFunctions } = require('./e2e/helpers/dom_env');

function testRealCeisaDomAutoInput() {
    console.log('=== TEST: Auto-Input on Real CEISA 4.0 Portal DOM (Standard Ant-Card without .card-* classes) ===');

    const html = `
    <!DOCTYPE html>
    <html>
    <head><title>CEISA 4.0 Portal</title></head>
    <body>
        <div class="ant-tabs-content">
            <div class="ant-tabs-tabpane ant-tabs-tabpane-active" id="tab-entitas">
                <div class="ant-row">
                    <!-- Column 1 (Left): Pengirim, Pembeli, Pemilik Barang -->
                    <div class="ant-col ant-col-12">
                        <!-- 1. Card Pengirim -->
                        <div class="ant-card ant-card-bordered">
                            <div class="ant-card-head">
                                <div class="ant-card-head-title">Pengirim</div>
                                <div class="ant-card-extra"><button type="button">Referensi</button></div>
                            </div>
                            <div class="ant-card-body">
                                <input name="nomorIdentitas" id="in_pengirim_id" />
                                <input name="nama" id="in_pengirim_nama" />
                                <input name="alamat" id="in_pengirim_alamat" />
                                <input name="negara" id="in_pengirim_negara" />
                            </div>
                        </div>

                        <!-- 2. Card Pembeli -->
                        <div class="ant-card ant-card-bordered">
                            <div class="ant-card-head">
                                <div class="ant-card-head-title">Pembeli</div>
                                <div class="ant-card-extra">
                                    <button type="button">Hapus Pembeli</button>
                                    <button type="button">Salin data penerima</button>
                                </div>
                            </div>
                            <div class="ant-card-body">
                                <input name="nomorIdentitas" id="in_pembeli_id" />
                                <input name="nitku" id="in_pembeli_nitku" />
                                <input name="nama" id="in_pembeli_nama" />
                                <input name="alamat" id="in_pembeli_alamat" />
                                <input name="negara" id="in_pembeli_negara" />
                            </div>
                        </div>

                        <!-- 3. Card Pemilik Barang -->
                        <div class="ant-card ant-card-bordered">
                            <div class="ant-card-head">
                                <div class="ant-card-head-title">Pemilik Barang</div>
                                <div class="ant-card-extra">
                                    <button type="button">Salin Penerima</button>
                                    <button type="button">Referensi</button>
                                </div>
                            </div>
                            <div class="ant-card-body">
                                <input name="nomorIdentitas" id="in_pemilik_id" />
                                <input name="nitku" id="in_pemilik_nitku" />
                                <input name="nama" id="in_pemilik_nama" />
                                <input name="alamat" id="in_pemilik_alamat" />
                                <input name="afiliasi" id="in_pemilik_afiliasi" />
                            </div>
                        </div>
                    </div>

                    <!-- Column 2 (Right): Penerima, Penjual, PPJK -->
                    <div class="ant-col ant-col-12">
                        <!-- 4. Card Penerima -->
                        <div class="ant-card ant-card-bordered">
                            <div class="ant-card-head">
                                <div class="ant-card-head-title">Penerima</div>
                                <div class="ant-card-extra"><button type="button">Referensi</button></div>
                            </div>
                            <div class="ant-card-body">
                                <input name="nomorIdentitas" id="in_penerima_id" />
                                <input name="nitku" id="in_penerima_nitku" />
                                <input name="nama" id="in_penerima_nama" />
                                <input name="alamat" id="in_penerima_alamat" />
                                <input name="negara" id="in_penerima_negara" />
                                <input name="status" id="in_penerima_status" />
                            </div>
                        </div>

                        <!-- 5. Card Penjual -->
                        <div class="ant-card ant-card-bordered">
                            <div class="ant-card-head">
                                <div class="ant-card-head-title">Penjual</div>
                                <div class="ant-card-extra"><button type="button">Salin data pengirim</button></div>
                            </div>
                            <div class="ant-card-body">
                                <input name="nomorIdentitas" id="in_penjual_id" />
                                <input name="nama" id="in_penjual_nama" />
                                <input name="alamat" id="in_penjual_alamat" />
                                <input name="negara" id="in_penjual_negara" />
                            </div>
                        </div>

                        <!-- 6. Card PPJK -->
                        <div class="ant-card ant-card-bordered">
                            <div class="ant-card-head">
                                <div class="ant-card-head-title">PPJK</div>
                            </div>
                            <div class="ant-card-body">
                                <input name="nomorIdentitas" id="in_ppjk_id" />
                                <input name="nitku" id="in_ppjk_nitku" />
                                <input name="nama" id="in_ppjk_nama" />
                                <input name="alamat" id="in_ppjk_alamat" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://ceisa40.beacukai.go.id/pib' });
    loadContentScriptFunctions(dom.window);

    const testPayload = {
        entitas: {
            pengirim: { nama: 'SHANGHAI TRADING CO', nomorIdentitas: 'SH-001', alamat: 'Shanghai', negara: 'CN' },
            pembeli: { nama: 'PT PEMBELI NUSANTARA', nomorIdentitas: '011111111000', nitku: '011111111000000000', alamat: 'Jakarta', negara: 'ID' },
            pemilikBarang: { nama: 'PT CARGO OWNER', nomorIdentitas: '022222222000', nitku: '022222222000000000', alamat: 'Surabaya', afiliasi: 'TAH' },
            penerima: { nama: 'PT PENERIMA SEJAHTERA', nomorIdentitas: '033333333000', nitku: '033333333000000000', alamat: 'Bekasi', negara: 'ID', status: 'LAINNYA' },
            penjual: { nama: 'SHANGHAI SELLER CORP', nomorIdentitas: 'SH-999', alamat: 'Shanghai', negara: 'CN' },
            ppjk: { nama: 'PT PPJK MITRA UTAMA', nomorIdentitas: '044444444000', nitku: '044444444000000000', alamat: 'Tanjung Priok' }
        }
    };

    const container = dom.window.document.getElementById('tab-entitas');
    const result = dom.window.handleCeisaAutoInputRow(testPayload, container, 'entitas');

    console.log('Result:', result);
    console.log('Pengirim Nama value:', dom.window.document.getElementById('in_pengirim_nama').value);
    console.log('Pembeli Nama value:', dom.window.document.getElementById('in_pembeli_nama').value);
    console.log('Pemilik Nama value:', dom.window.document.getElementById('in_pemilik_nama').value);
    console.log('Penerima Nama value:', dom.window.document.getElementById('in_penerima_nama').value);
    console.log('Penjual Nama value:', dom.window.document.getElementById('in_penjual_nama').value);
    console.log('PPJK Nama value:', dom.window.document.getElementById('in_ppjk_nama').value);

    const penerimaFilled = dom.window.document.getElementById('in_penerima_nama').value === 'PT PENERIMA SEJAHTERA';
    const pemilikFilled = dom.window.document.getElementById('in_pemilik_nama').value === 'PT CARGO OWNER';

    console.log('Penerima correctly filled:', penerimaFilled);
    console.log('Pemilik correctly filled:', pemilikFilled);

    if (!penerimaFilled) {
        console.error('BUG CONFIRMED: Penerima card was NOT filled! Actual value is: "' + dom.window.document.getElementById('in_penerima_nama').value + '"');
    }
}

testRealCeisaDomAutoInput();
