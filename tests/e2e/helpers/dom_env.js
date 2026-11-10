/**
 * DOM and Browser Environment Helper for CEISA 4.0 E2E Testing
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT_DIR = path.resolve(__dirname, '../../..');

/**
 * Loads print_hub.html in JSDOM with necessary browser mocks
 */
function loadPrintHubDom(options = {}) {
    const htmlPath = path.join(ROOT_DIR, 'print_hub.html');
    const rawHtml = fs.readFileSync(htmlPath, 'utf8');

    const dom = new JSDOM(rawHtml, {
        runScripts: 'outside-only',
        url: 'http://localhost:3000/print_hub.html',
        ...options
    });

    const { window } = dom;

    // Browser API mocks
    window.navigator.clipboard = {
        writeText: async (text) => text
    };

    window.toasts = [];
    window.showToast = (msg, type = 'info') => {
        window.toasts.push({ msg, type });
    };

    window.mockPrinters = [
        { name: 'EPSON L3110 Series', status: 'ready', isDefault: true, ip: '192.168.1.100' },
        { name: 'Canon G2010', status: 'ready', isDefault: false, ip: '192.168.1.101' }
    ];

    window.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/printers') || urlStr.includes('/printers')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, printers: window.mockPrinters })
            };
        }
        if (urlStr.includes('/api/print/status') || urlStr.includes('/status')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ status: 'online', port: 3000, ip: '192.168.1.50' })
            };
        }
        if (urlStr.includes('/api/print/qr') || urlStr.includes('/qr')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ qr: 'data:image/png;base64,mockqr', url: 'http://192.168.1.50:3000' })
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        };
    };

    return { dom, window, document: window.document };
}

/**
 * Loads pib.html in JSDOM with mocks
 */
function loadPibDom(options = {}) {
    const htmlPath = path.join(ROOT_DIR, 'pib.html');
    const rawHtml = fs.readFileSync(htmlPath, 'utf8');

    const dom = new JSDOM(rawHtml, {
        runScripts: 'outside-only',
        url: 'http://localhost:3000/pib.html',
        ...options
    });

    const { window } = dom;

    // Polyfill globals for outside-only eval
    window.fetch = async (url) => {
        return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: [] }),
            text: async () => ''
        };
    };

    window.toasts = [];
    window.showToast = (msg, type = 'info') => {
        window.toasts.push({ msg, type });
    };

    window.switchPibTab = (tabId) => {
        const panels = window.document.querySelectorAll('.tab-content-panel');
        panels.forEach(p => p.classList.remove('active'));
        const target = window.document.getElementById(tabId);
        if (target) target.classList.add('active');
    };

    window.localStorage = {
        _store: {},
        getItem: function(k) { return this._store[k] !== undefined ? this._store[k] : null; },
        setItem: function(k, v) { this._store[k] = String(v); },
        removeItem: function(k) { delete this._store[k]; },
        clear: function() { this._store = {}; }
    };

    return { dom, window, document: window.document };
}

/**
 * Executes or injects pib_dashboard.js logic into a JSDOM window
 */
function loadPibDashboardScript(window) {
    const jsPath = path.join(ROOT_DIR, 'pib_dashboard.js');
    const rawJs = fs.readFileSync(jsPath, 'utf8');

    try {
        // Polyfill fetch and storage into window scope before executing
        window.eval(`
            if (typeof fetch === 'undefined') var fetch = window.fetch;
            if (typeof localStorage === 'undefined') var localStorage = window.localStorage;
            ${rawJs}
            if (typeof collectPibFormData === 'function') window.collectPibFormData = collectPibFormData;
            if (typeof loadPibDraftData === 'function') window.loadPibDraftData = loadPibDraftData;
            if (typeof populatePibForm === 'function') window.populatePibForm = populatePibForm;
            if (typeof setupPibCopyHandlers === 'function') window.setupPibCopyHandlers = setupPibCopyHandlers;
            if (typeof calculatePibPungutan === 'function') window.calculatePibPungutan = calculatePibPungutan;
        `);
    } catch (err) {
        window.__scriptError = err;
    }

    return window;
}

/**
 * Builds a realistic CEISA 4.0 Portal DOM tree with 6 Ant Design cards
 */
function createMockCeisaPortalDom() {
    const html = `
    <!DOCTYPE html>
    <html>
    <head><title>CEISA 4.0 Portal</title></head>
    <body>
        <div class="ant-tabs-content">
            <div class="ant-tabs-tabpane ant-tabs-tabpane-active" id="tab-entitas">
                <div class="ceisa-cards-container">
                    <!-- 1. Card Pengirim -->
                    <div class="ant-card card-pengirim">
                        <div class="ant-card-head"><div class="ant-card-head-title">Pengirim</div></div>
                        <div class="ant-card-body">
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pengirim_id">Nomor Identitas</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pengirim_id" name="nomorIdentitas" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pengirim_nama">Nama</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pengirim_nama" name="nama" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pengirim_alamat">Alamat</label></div>
                                <div class="ant-form-item-control"><textarea id="ceisa_pengirim_alamat" name="alamat"></textarea></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pengirim_negara">Negara</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pengirim_negara" name="negara" /></div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Card Penerima -->
                    <div class="ant-card card-penerima">
                        <div class="ant-card-head"><div class="ant-card-head-title">Penerima</div></div>
                        <div class="ant-card-body">
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penerima_id">Nomor Identitas</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penerima_id" name="nomorIdentitas" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penerima_nitku">NITKU</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penerima_nitku" name="nitku" maxlength="22" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penerima_nama">Nama</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penerima_nama" name="nama" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penerima_alamat">Alamat</label></div>
                                <div class="ant-form-item-control"><textarea id="ceisa_penerima_alamat" name="alamat"></textarea></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penerima_negara">Negara</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penerima_negara" name="negara" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penerima_status">Status</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penerima_status" name="status" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penerima_ijin_no">Nomor Izin BP</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penerima_ijin_no" name="noIjin" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penerima_ijin_tgl">Tanggal Izin BP</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penerima_ijin_tgl" name="tglIzin" type="date" /></div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Card Pembeli -->
                    <div class="ant-card card-pembeli">
                        <div class="ant-card-head"><div class="ant-card-head-title">Pembeli</div></div>
                        <div class="ant-card-body">
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pembeli_id">Nomor Identitas</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pembeli_id" name="nomorIdentitas" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pembeli_nitku">NITKU</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pembeli_nitku" name="nitku" maxlength="22" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pembeli_nama">Nama</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pembeli_nama" name="nama" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pembeli_alamat">Alamat</label></div>
                                <div class="ant-form-item-control"><textarea id="ceisa_pembeli_alamat" name="alamat"></textarea></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pembeli_negara">Negara</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pembeli_negara" name="negara" /></div>
                            </div>
                        </div>
                    </div>

                    <!-- 4. Card Penjual -->
                    <div class="ant-card card-penjual">
                        <div class="ant-card-head"><div class="ant-card-head-title">Penjual</div></div>
                        <div class="ant-card-body">
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penjual_id">Nomor Identitas</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penjual_id" name="nomorIdentitas" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penjual_nama">Nama</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penjual_nama" name="nama" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penjual_alamat">Alamat</label></div>
                                <div class="ant-form-item-control"><textarea id="ceisa_penjual_alamat" name="alamat"></textarea></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_penjual_negara">Negara</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_penjual_negara" name="negara" /></div>
                            </div>
                        </div>
                    </div>

                    <!-- 5. Card Pemilik Barang -->
                    <div class="ant-card card-pemilik">
                        <div class="ant-card-head"><div class="ant-card-head-title">Pemilik Barang</div></div>
                        <div class="ant-card-body">
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pemilik_id">Nomor Identitas</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pemilik_id" name="nomorIdentitas" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pemilik_nitku">NITKU</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pemilik_nitku" name="nitku" maxlength="22" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pemilik_nama">Nama</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pemilik_nama" name="nama" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pemilik_alamat">Alamat</label></div>
                                <div class="ant-form-item-control"><textarea id="ceisa_pemilik_alamat" name="alamat"></textarea></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_pemilik_afiliasi">Afiliasi</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_pemilik_afiliasi" name="afiliasi" /></div>
                            </div>
                        </div>
                    </div>

                    <!-- 6. Card PPJK -->
                    <div class="ant-card card-ppjk">
                        <div class="ant-card-head"><div class="ant-card-head-title">PPJK</div></div>
                        <div class="ant-card-body">
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_ppjk_id">Nomor Identitas</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_ppjk_id" name="nomorIdentitas" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_ppjk_nitku">NITKU</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_ppjk_nitku" name="nitku" maxlength="22" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_ppjk_nama">Nama</label></div>
                                <div class="ant-form-item-control"><input id="ceisa_ppjk_nama" name="nama" /></div>
                            </div>
                            <div class="ant-form-item">
                                <div class="ant-form-item-label"><label for="ceisa_ppjk_alamat">Alamat</label></div>
                                <div class="ant-form-item-control"><textarea id="ceisa_ppjk_alamat" name="alamat"></textarea></div>
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

    return { dom, window, document: window.document };
}

/**
 * Loads content.js auto-input helper into window
 */
function loadContentScriptFunctions(window) {
    const jsPath = path.join(ROOT_DIR, 'content.js');
    const rawJs = fs.readFileSync(jsPath, 'utf8');

    if (!window.chrome) {
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
    }

    // Expose internal functions safely for test harness inspection without modifying production code
    const testExposeJs = rawJs.replace(
        /\}\)\(\);?\s*$/,
        `
        window.handleCeisaAutoInputRow = typeof handleCeisaAutoInputRow !== 'undefined' ? handleCeisaAutoInputRow : null;
        window.findFieldByKeywords = typeof findFieldByKeywords !== 'undefined' ? findFieldByKeywords : null;
        window.setNativeInputValue = typeof setNativeInputValue !== 'undefined' ? setNativeInputValue : null;
        window.findCeisaCard = typeof findCeisaCard !== 'undefined' ? findCeisaCard : null;
        })();
        `
    );

    try {
        window.eval(`
            if (typeof chrome === 'undefined') var chrome = window.chrome;
            ${testExposeJs}
        `);
    } catch (err) {
        window.__contentScriptError = err;
    }

    return window;
}

/**
 * Executes or injects print_hub.js into a JSDOM window
 */
function loadPrintHubScript(window) {
    const jsPath = path.join(ROOT_DIR, 'print_hub.js');
    const rawJs = fs.readFileSync(jsPath, 'utf8');

    try {
        window.eval(rawJs);
    } catch (err) {
        window.__scriptError = err;
    }

    return window;
}

module.exports = {
    ROOT_DIR,
    loadPrintHubDom,
    loadPrintHubScript,
    loadPibDom,
    loadPibDashboardScript,
    createMockCeisaPortalDom,
    loadContentScriptFunctions
};
