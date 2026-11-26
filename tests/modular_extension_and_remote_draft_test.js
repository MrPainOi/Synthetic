const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { JSDOM } = require('jsdom');

const ROOT_DIR = path.resolve(__dirname, '..');
const { buildModularPackages } = require('../scripts/build_modular_extensions');
const DraftClient = require('../draft_source_client');

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}: ${err.message}`);
        failed++;
    }
}

function getAllFilesRecursive(dir, base = dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...getAllFilesRecursive(full, base));
        } else {
            results.push(path.relative(base, full).replace(/\\/g, '/'));
        }
    }
    return results;
}

function collectManifestAssetPaths(manifest) {
    const refs = new Set();
    if (manifest.icons) Object.values(manifest.icons).forEach(p => refs.add(p));
    if (manifest.action?.default_popup) refs.add(manifest.action.default_popup);
    if (manifest.action?.default_icon) Object.values(manifest.action.default_icon).forEach(p => refs.add(p));
    if (manifest.background?.service_worker) refs.add(manifest.background.service_worker);
    if (Array.isArray(manifest.content_scripts)) {
        manifest.content_scripts.forEach(cs => {
            (cs.js || []).forEach(p => refs.add(p));
            (cs.css || []).forEach(p => refs.add(p));
        });
    }
    if (Array.isArray(manifest.web_accessible_resources)) {
        manifest.web_accessible_resources.forEach(w => {
            (w.resources || []).forEach(p => refs.add(p));
        });
    }
    return Array.from(refs);
}

(async () => {
    console.log('\n============================================================');
    console.log('MODULAR EXTENSION & REMOTE DRAFT SOURCE TEST SUITE');
    console.log('============================================================\n');

    const pkgSummary = buildModularPackages();

    await runTest('1. buildModularPackages creates all 3 modular extension folders cleanly', () => {
        const names = pkgSummary.map(p => p.name);
        assert.deepStrictEqual(names, ['ceisa-auto-input', 'ceisa-scanner', 'ceisa-extension']);
        pkgSummary.forEach(p => {
            assert(fs.existsSync(path.join(ROOT_DIR, 'extensions', p.name, 'manifest.json')));
        });
    });

    await runTest('2. All manifest references and popup script tags resolve inside each modular folder', () => {
        ['ceisa-auto-input', 'ceisa-scanner', 'ceisa-extension'].forEach(modName => {
            const modDir = path.join(ROOT_DIR, 'extensions', modName);
            const manifest = JSON.parse(fs.readFileSync(path.join(modDir, 'manifest.json'), 'utf8'));
            const refs = collectManifestAssetPaths(manifest);
            refs.forEach(rel => {
                assert(fs.existsSync(path.join(modDir, rel)), `${modName} missing manifest asset: ${rel}`);
            });

            const popupHtml = fs.readFileSync(path.join(modDir, manifest.action.default_popup), 'utf8');
            const scriptMatches = Array.from(popupHtml.matchAll(/<script\s+[^>]*src="([^"]+)"/g)).map(m => m[1]);
            const cssMatches = Array.from(popupHtml.matchAll(/<link\s+[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)).map(m => m[1]);
            [...scriptMatches, ...cssMatches].forEach(asset => {
                assert(fs.existsSync(path.join(modDir, asset)), `${modName} popup.html missing asset: ${asset}`);
            });

            if (manifest.host_permissions) {
                assert(manifest.host_permissions.includes('http://*/*'), `${modName} must permit LAN http://*/* fetches`);
            }
            const csp = manifest.content_security_policy?.extension_pages || '';
            assert(csp.includes("script-src 'self'") && !csp.includes('upgrade-insecure-requests'), `${modName} CSP must allow plain HTTP LAN fetches without upgrade-insecure-requests`);
        });
    });

    await runTest('3. Website HTML/backend/traineddata are excluded from ALL modular extensions, and ceisa-auto-input excludes scanner/PDF bloat', () => {
        const forbiddenWebsiteFiles = [
            'pib.html', 'peb.html', 'dashboard.html', 'ocr_tool.html',
            'print_hub.html', 'doc_searcher.html', 'hscode.html',
            'eng.traineddata', 'backend-service/server.js'
        ];
        ['ceisa-auto-input', 'ceisa-scanner', 'ceisa-extension'].forEach(modName => {
            const modDir = path.join(ROOT_DIR, 'extensions', modName);
            const files = getAllFilesRecursive(modDir);
            forbiddenWebsiteFiles.forEach(f => {
                assert(!files.includes(f), `${modName} must NOT contain website/backend file: ${f}`);
            });
        });

        const autoInputFiles = getAllFilesRecursive(path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input'));
        ['sync.js', 'background.js', 'offscreen.html', 'offscreen.js', 'pdf.mjs', 'pdf.worker.mjs'].forEach(f => {
            assert(!autoInputFiles.includes(f), `ceisa-auto-input must NOT include ${f}`);
        });
    });

    await runTest('4. DraftSourceClient normalizes peer LAN IP & separates Draft Source vs Web Host', () => {
        assert.strictEqual(DraftClient.normalizeHostUrl('192.168.100.15'), 'http://192.168.100.15:5005');
        assert.strictEqual(DraftClient.normalizeHostUrl('192.168.100.15:5050/'), 'http://192.168.100.15:5050');
        assert.strictEqual(DraftClient.normalizeHostUrl('http://192.168.100.15'), 'http://192.168.100.15:5005');
        assert.strictEqual(DraftClient.normalizeHostUrl('https://web.company.id'), 'https://web.company.id');
        assert.strictEqual(DraftClient.isRemoteSource('http://192.168.100.15:5005'), true);
        assert.strictEqual(DraftClient.isRemoteSource('http://localhost:5005'), false);

        // Web dashboard URL remains local user host even when Draft Source is 192.168.100.15
        const dashUrlModular = DraftClient.resolveDashboardUrl(
            { webHostUrl: 'http://localhost:5005', hasCustomWebHost: false },
            false
        );
        assert.strictEqual(dashUrlModular, 'http://localhost:5005/dashboard.html');
    });

    await runTest('5. ceisa-auto-input popup boots standalone in autoinput mode & loads remote draft from peer IP', async () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const html = fs.readFileSync(path.join(modDir, 'popup.html'), 'utf8');
        const modConfigJs = fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8');
        const configJs = fs.readFileSync(path.join(modDir, 'config.js'), 'utf8');
        const clientJs = fs.readFileSync(path.join(modDir, 'draft_source_client.js'), 'utf8');
        const popupJs = fs.readFileSync(path.join(modDir, 'popup.js'), 'utf8');

        const dom = new JSDOM(html, { url: 'chrome-extension://fake-auto-input-id/popup.html', runScripts: 'outside-only' });
        const { window } = dom;

        const store = {
            ceisa_draft_source_host: 'http://192.168.100.15:5005',
            ceisa_web_host: 'http://localhost:5005'
        };
        const openedUrls = [];
        window.chrome = {
            runtime: {
                getManifest: () => ({ version: '2.1.2' }),
                onMessage: { addListener: () => {} },
                sendMessage: () => {}
            },
            storage: {
                local: {
                    get: async (keys) => {
                        if (typeof keys === 'string') return { [keys]: store[keys] };
                        if (Array.isArray(keys)) {
                            const out = {};
                            keys.forEach(k => { if (store[k] !== undefined) out[k] = store[k]; });
                            return out;
                        }
                        return { ...store };
                    },
                    set: async (obj) => { Object.assign(store, obj); },
                    remove: async () => {}
                },
                onChanged: { addListener: () => {} }
            },
            tabs: {
                query: async () => [],
                create: ({ url }) => { openedUrls.push(url); },
                sendMessage: () => {}
            }
        };

        const fetchedUrls = [];
        window.fetch = async (url) => {
            fetchedUrls.push(url);
            if (url === 'http://192.168.100.15:5005/api/health') {
                return { ok: true, json: async () => ({ ok: true, hostIp: '192.168.100.15', port: 5005 }) };
            }
            if (url.startsWith('http://192.168.100.15:5005/api/list-drafts')) {
                return {
                    ok: true,
                    json: async () => ({
                        ok: true,
                        drafts: [{ filename: 'PIB_Draft_123456.json', nomorAju: '000020-123456', itemCount: 2 }]
                    })
                };
            }
            if (url.startsWith('http://192.168.100.15:5005/api/get-latest-draft')) {
                return {
                    ok: true,
                    json: async () => ({
                        nomorAju: '000020-123456',
                        shipperName: 'TDK SENSORS AG',
                        consigneeName: 'PT TDK ELECTRONICS INDONESIA',
                        currency: 'USD',
                        items: [{ hsCode: '83081000', description: 'Clip' }]
                    })
                };
            }
            throw new Error(`Unexpected fetch URL: ${url}`);
        };

        window.eval(modConfigJs);
        window.eval(configJs);
        window.eval(clientJs);
        window.eval(popupJs);

        await new Promise(r => setTimeout(r, 80));

        assert.strictEqual(window.__CEISA_MODULE_MODE__, 'autoinput');
        assert.strictEqual(window.document.querySelector('.popup-mode-switcher').style.display, 'none');
        assert.strictEqual(window.document.getElementById('viewAutoInput').style.display, 'flex');
        assert.strictEqual(window.document.getElementById('viewScanner').style.display, 'none');
        assert.strictEqual(window.document.getElementById('lblDraftAjuNo').textContent, '000020-123456');
        assert.ok(window.document.getElementById('lblActiveDraftHost').textContent.includes('192.168.100.15:5005'));
        assert.ok(fetchedUrls.some(u => u.startsWith('http://192.168.100.15:5005/api/get-latest-draft')));

        window.document.getElementById('btnOpenWebDashboardAuto').click();
        await new Promise(r => setTimeout(r, 30));
        assert.strictEqual(openedUrls[0], 'http://localhost:5005/dashboard.html');
        dom.window.close();
    });

    await runTest('6. ceisa-auto-input content.js respects autoinput mode without requiring sync.js', () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const modConfigJs = fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8');
        const contentJs = fs.readFileSync(path.join(modDir, 'content.js'), 'utf8');
        const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://portal.beacukai.go.id/', runScripts: 'outside-only' });
        const { window } = dom;
        window.chrome = {
            runtime: { onMessage: { addListener: () => {} }, sendMessage: () => {} },
            storage: { local: { get: () => {}, set: () => {} }, onChanged: { addListener: () => {} } }
        };
        window.eval(modConfigJs);
        window.eval(contentJs);
        assert.strictEqual(typeof window.handleCeisaAutoInputRow, 'function');
        const res = window.handleCeisaAutoInputRow({
            type: 'CEISA_AUTO_INPUT_ROW',
            section: 'kemasan',
            item: { grossWeight: '10' },
            autofillConfig: { kemasan: false }
        });
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.skipped, true);
        dom.window.close();
    });

    await runTest('7. Backend server supports CORS + Private Network Access preflight & /api/health, /api/list-drafts, /api/get-draft', async () => {
        // Test only if local backend port 5005 is running
        const testDraftName = '__TEST_MODULAR_LAN_DRAFT__.json';
        const draftsDir = path.join(ROOT_DIR, 'drafts', 'impor');
        fs.mkdirSync(draftsDir, { recursive: true });
        const testDraftPath = path.join(draftsDir, testDraftName);

        try {
            const preflightRes = await new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: '127.0.0.1',
                    port: 5005,
                    path: '/api/get-latest-draft?mode=impor',
                    method: 'OPTIONS',
                    headers: {
                        'Origin': 'chrome-extension://abcdef',
                        'Access-Control-Request-Private-Network': 'true'
                    }
                }, res => resolve({ status: res.statusCode, headers: res.headers }));
                req.on('error', reject);
                req.end();
            });
            assert.strictEqual(preflightRes.status, 204);
            assert.strictEqual(preflightRes.headers['access-control-allow-private-network'], 'true');
            assert.strictEqual(preflightRes.headers['access-control-allow-origin'], '*');

            const health = await DraftClient.checkDraftServerHealth('http://127.0.0.1:5005');
            assert.strictEqual(health.ok, true);
            assert.strictEqual(health.legacy, false);

            fs.writeFileSync(testDraftPath, JSON.stringify({
                nomorAju: '000020-TESTLAN',
                shipperName: 'LAN TEST SHIPPER',
                items: [{ hsCode: '85044090', description: 'Adapter' }]
            }));

            const listRes = await DraftClient.fetchDraftList('127.0.0.1:5005', 'impor');
            assert.strictEqual(listRes.ok, true);
            assert(listRes.drafts.some(d => d.filename === testDraftName));

            const draftRes = await DraftClient.fetchDraftData('127.0.0.1', 'impor', testDraftName);
            assert.strictEqual(draftRes.ok, true);
            assert.strictEqual(draftRes.draft.nomorAju, '000020-TESTLAN');
        } finally {
            if (fs.existsSync(testDraftPath)) fs.unlinkSync(testDraftPath);
        }
    });

    await runTest('8. Auto Input persists PEB mode, typed LAN IP, section & host panel across popup close/reopen', async () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const html = fs.readFileSync(path.join(modDir, 'popup.html'), 'utf8');
        const modConfigJs = fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8');
        const configJs = fs.readFileSync(path.join(modDir, 'config.js'), 'utf8');
        const clientJs = fs.readFileSync(path.join(modDir, 'draft_source_client.js'), 'utf8');
        const popupJs = fs.readFileSync(path.join(modDir, 'popup.js'), 'utf8');

        const sharedStore = {};
        function createPopupWindow(fetchImpl) {
            const dom = new JSDOM(html, { url: 'chrome-extension://fake-auto-input-id/popup.html', runScripts: 'outside-only' });
            const { window } = dom;
            window.chrome = {
                runtime: {
                    getManifest: () => ({ version: '2.1.2' }),
                    onMessage: { addListener: () => {} },
                    sendMessage: () => {}
                },
                storage: {
                    local: {
                        get: async (keys) => {
                            if (typeof keys === 'string') return { [keys]: sharedStore[keys] };
                            if (Array.isArray(keys)) {
                                const out = {};
                                keys.forEach(k => { if (sharedStore[k] !== undefined) out[k] = sharedStore[k]; });
                                return out;
                            }
                            return { ...sharedStore };
                        },
                        set: async (obj) => { Object.assign(sharedStore, obj); },
                        remove: async () => {}
                    },
                    onChanged: { addListener: () => {} }
                },
                tabs: { query: async () => [], create: () => {}, sendMessage: () => {} }
            };
            window.fetch = fetchImpl;
            window.eval(modConfigJs);
            window.eval(configJs);
            window.eval(clientJs);
            window.eval(popupJs);
            return dom;
        }

        const requestedModesSession2 = [];
        const mockFetch = (recorder) => async (url) => {
            if (recorder) recorder.push(url);
            if (url.includes('/api/health')) {
                return { ok: true, json: async () => ({ ok: true, hostIp: '192.168.100.15' }) };
            }
            if (url.includes('/api/list-drafts')) {
                return { ok: true, json: async () => ({ ok: true, drafts: [] }) };
            }
            if (url.includes('/api/get-latest-draft?mode=ekspor')) {
                return {
                    ok: true,
                    json: async () => ({
                        nomorAju: 'PEB-009988',
                        shipperName: 'PT EKSPOR MANDIRI',
                        consigneeName: 'BUYER JAPAN',
                        items: [{ hsCode: '85044090', description: 'Export Unit' }]
                    })
                };
            }
            return { ok: true, json: async () => null };
        };

        // Session 1: buka popup, buka panel IP, ketik IP 192.168.100.15 tanpa klik Hubungkan, pilih PEB & section barang
        const dom1 = createPopupWindow(mockFetch(null));
        await new Promise(r => setTimeout(r, 60));

        dom1.window.document.getElementById('btnToggleHostPanel').click();
        await new Promise(r => setTimeout(r, 20));

        const hostInput = dom1.window.document.getElementById('inputDraftSourceHost');
        hostInput.value = '192.168.100.15';
        hostInput.dispatchEvent(new dom1.window.Event('input'));

        dom1.window.document.getElementById('btnSelectTypePeb').click();
        await new Promise(r => setTimeout(r, 60));

        const secSelect = dom1.window.document.getElementById('autoInputSectionSelect');
        secSelect.value = 'barang';
        secSelect.dispatchEvent(new dom1.window.Event('change'));
        await new Promise(r => setTimeout(r, 40));
        dom1.window.close();

        // Session 2: buka popup lagi dari awal -> semua setting terakhir harus langsung pulih & fetch PEB dari 192.168.100.15:5005
        const dom2 = createPopupWindow(mockFetch(requestedModesSession2));
        await new Promise(r => setTimeout(r, 80));

        assert.strictEqual(dom2.window.document.getElementById('inputDraftSourceHost').value, 'http://192.168.100.15:5005');
        assert.ok(dom2.window.document.getElementById('btnSelectTypePeb').classList.contains('active'));
        assert.ok(!dom2.window.document.getElementById('btnSelectTypePib').classList.contains('active'));
        assert.strictEqual(dom2.window.document.getElementById('lblDraftBadge').textContent, 'PEB');
        assert.strictEqual(dom2.window.document.getElementById('lblDraftAjuNo').textContent, 'PEB-009988');
        assert.strictEqual(dom2.window.document.getElementById('autoInputSectionSelect').value, 'barang');
        assert.strictEqual(dom2.window.document.getElementById('aiHostPanel').style.display, 'flex');
        assert.ok(requestedModesSession2.some(u => u === 'http://192.168.100.15:5005/api/get-latest-draft?mode=ekspor'));
        dom2.window.close();
    });

    await runTest('9. Popup auto-injects content scripts via chrome.scripting when CEISA tab has no receiving end', async () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const manifest = JSON.parse(fs.readFileSync(path.join(modDir, 'manifest.json'), 'utf8'));
        assert(manifest.permissions.includes('scripting'), 'Manifest must include scripting permission');
        assert(manifest.content_scripts[0].matches.includes('https://*.beacukai.go.id/*'), 'Manifest must match *.beacukai.go.id/*');

        const html = fs.readFileSync(path.join(modDir, 'popup.html'), 'utf8');
        const modConfigJs = fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8');
        const configJs = fs.readFileSync(path.join(modDir, 'config.js'), 'utf8');
        const clientJs = fs.readFileSync(path.join(modDir, 'draft_source_client.js'), 'utf8');
        const popupJs = fs.readFileSync(path.join(modDir, 'popup.js'), 'utf8');

        const dom = new JSDOM(html, { url: 'chrome-extension://fake-auto-input-id/popup.html', runScripts: 'outside-only' });
        const { window } = dom;

        let injected = false;
        let injectedFiles = [];
        const sentMessages = [];

        window.chrome = {
            runtime: {
                getManifest: () => manifest,
                onMessage: { addListener: () => {} },
                sendMessage: () => {},
                lastError: null
            },
            storage: {
                local: {
                    get: async () => ({}),
                    set: async () => {},
                    remove: async () => {}
                },
                onChanged: { addListener: () => {} }
            },
            scripting: {
                executeScript: async ({ target, files }) => {
                    assert.strictEqual(target.tabId, 2075520279);
                    injected = true;
                    injectedFiles = files;
                    return [];
                }
            },
            tabs: {
                query: async () => [{ id: 2075520279, title: 'Portal CEISA 4.0', active: true }],
                create: () => {},
                sendMessage: (tabId, msg, cb) => {
                    sentMessages.push({ tabId, type: msg.type, injectedAtCall: injected });
                    if (!injected) {
                        window.chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
                        cb(undefined);
                        window.chrome.runtime.lastError = null;
                        return;
                    }
                    window.chrome.runtime.lastError = null;
                    if (msg.type === 'CEISA_AUTO_INPUT_ROW') {
                        cb({ ok: true, message: 'Baris header berhasil diinput setelah auto-inject!' });
                    } else {
                        cb({ ok: true, activeSection: 'entitas' });
                    }
                }
            }
        };

        window.fetch = async (url) => {
            if (url.includes('/api/get-latest-draft')) {
                return {
                    ok: true,
                    json: async () => ({ nomorAju: 'AJU-AUTOINJECT-1', items: [{ hsCode: '83081000', description: 'Clip' }] })
                };
            }
            return { ok: true, json: async () => ({ ok: true, drafts: [] }) };
        };

        window.eval(modConfigJs);
        window.eval(configJs);
        window.eval(clientJs);
        window.eval(popupJs);

        await new Promise(r => setTimeout(r, 200));
        window.document.getElementById('btnStepInject').click();
        await new Promise(r => setTimeout(r, 200));

        assert.strictEqual(injected, true, 'chrome.scripting.executeScript must have been invoked');
        assert.deepStrictEqual(injectedFiles, ['module_config.js', 'config.js', 'draft_source_client.js', 'content.js']);
        const logText = window.document.getElementById('autoInputLogBody').textContent;
        assert(logText.includes('[SUKSES] Baris header berhasil diinput setelah auto-inject!'), 'Auto Input log must show success after auto-inject');
        dom.window.close();
    });

    await runTest('10. Web Dashboard button auto-starts stopped local server via START_BACKEND_SERVER before opening tab', async () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-extension');
        const html = fs.readFileSync(path.join(modDir, 'popup.html'), 'utf8');
        const modConfigJs = fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8');
        const configJs = fs.readFileSync(path.join(modDir, 'config.js'), 'utf8');
        const syncJs = fs.readFileSync(path.join(modDir, 'sync.js'), 'utf8');
        const clientJs = fs.readFileSync(path.join(modDir, 'draft_source_client.js'), 'utf8');
        const popupJs = fs.readFileSync(path.join(modDir, 'popup.js'), 'utf8');

        const dom = new JSDOM(html, { url: 'chrome-extension://geogeopfnkjopjgpfdnfnikfpecdodhe/popup.html', runScripts: 'outside-only' });
        const { window } = dom;

        let serverStarted = false;
        const openedUrls = [];
        window.chrome = {
            runtime: {
                getManifest: () => ({ version: '2.1.2' }),
                onMessage: { addListener: () => {} },
                sendMessage: (msg, cb) => {
                    if (msg && msg.type === 'START_BACKEND_SERVER') {
                        serverStarted = true;
                    }
                    if (typeof cb === 'function') cb({ ok: true });
                },
                lastError: null
            },
            storage: {
                local: {
                    get: async () => ({}),
                    set: async () => {},
                    remove: async () => {}
                },
                onChanged: { addListener: () => {} }
            },
            tabs: {
                query: async () => [],
                create: ({ url }) => openedUrls.push(url),
                sendMessage: () => {}
            }
        };

        window.fetch = async (url) => {
            if (url.includes('/api/health') || url.includes('/api/get-latest-draft')) {
                if (!serverStarted) throw new Error('ECONNREFUSED');
                return { ok: true, json: async () => ({ ok: true, hostIp: '127.0.0.1' }) };
            }
            return { ok: true, json: async () => ({ ok: true }) };
        };

        window.eval(modConfigJs);
        window.eval(configJs);
        window.eval(syncJs);
        window.eval(clientJs);
        window.eval(popupJs);

        await window.document.getElementById('openDashboard').onclick();
        assert.strictEqual(serverStarted, true, 'Must attempt START_BACKEND_SERVER when localhost:5005 is down');
        assert.strictEqual(openedUrls[0], 'http://localhost:5005/dashboard.html');
        dom.window.close();
    });

    await runTest('11. HS Code di Tab Barang PIB/PEB, Auto Input preview & backend parser bebas titik (7326.90.99 -> 73269099)', async () => {
        // 1) PIB Dashboard: loadPibDraftData & table/input rendering
        const pibHtml = fs.readFileSync(path.join(ROOT_DIR, 'pib.html'), 'utf8');
        const pibJs = fs.readFileSync(path.join(ROOT_DIR, 'pib_dashboard.js'), 'utf8');
        const pibDom = new JSDOM(pibHtml, { url: 'http://localhost:5005/pib.html', runScripts: 'outside-only' });
        pibDom.window.Element.prototype.scrollIntoView = () => {};
        pibDom.window.showToast = () => {};
        pibDom.window.fetch = async () => ({ ok: true, json: async () => null });
        pibDom.window.eval(pibJs);

        assert.strictEqual(pibDom.window.normalizePibHsCode('7326.90.99'), '73269099');
        pibDom.window.loadPibDraftData({
            nomorAju: '000020-HS-TEST',
            items: [{ hsCode: '7326.90.99', uraianJenisBarang: 'Bracket Besi', jumlahDanSatuanBarang: '10 PCE', amount: '100' }]
        });
        const pibTableHs = pibDom.window.document.querySelector('#pibItemsTableBody .cell-pib-hscode')?.textContent?.trim();
        assert.strictEqual(pibTableHs, '73269099');
        pibDom.window.openPibItemEditor(0);
        assert.strictEqual(pibDom.window.document.getElementById('pibItemHsCode').value, '73269099');
        pibDom.window.close();

        // 2) PEB Dashboard: appendItemRow & collectFormData
        const pebHtml = fs.readFileSync(path.join(ROOT_DIR, 'peb.html'), 'utf8');
        const pebJs = fs.readFileSync(path.join(ROOT_DIR, 'peb_dashboard.js'), 'utf8');
        const pebDom = new JSDOM(pebHtml, { url: 'http://localhost:5005/peb.html', runScripts: 'outside-only' });
        pebDom.window.showToast = () => {};
        pebDom.window.fetch = async () => ({ ok: true, json: async () => null });
        pebDom.window.eval(pebJs);

        assert.strictEqual(pebDom.window.normalizePebHsCode('7326.90.99'), '73269099');
        const tbody = pebDom.window.document.getElementById('itemsTableBody');
        tbody.innerHTML = '';
        pebDom.window.appendItemRow({ hsCode: '7326.90.99', uraianJenisBarang: 'Bracket Ekspor', jumlahDanSatuanBarang: '5 PCE', amount: '50' }, 1);
        assert.strictEqual(pebDom.window.document.querySelector('.item-hscode').value, '73269099');
        const collected = pebDom.window.collectFormData();
        assert.strictEqual(collected.items[0].hsCode, '73269099');
        pebDom.window.close();

        // 3) Auto Input preview strips dots even from legacy dotted JSON
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const popDom = new JSDOM(fs.readFileSync(path.join(modDir, 'popup.html'), 'utf8'), { url: 'chrome-extension://id/popup.html', runScripts: 'outside-only' });
        popDom.window.chrome = {
            runtime: { getManifest: () => ({ version: '2.1.2' }), onMessage: { addListener: () => {} }, sendMessage: () => {} },
            storage: { local: { get: async () => ({ ceisa_autoinput_last_section: 'barang' }), set: async () => {}, remove: async () => {} }, onChanged: { addListener: () => {} } },
            tabs: { query: async () => [], create: () => {}, sendMessage: () => {} }
        };
        popDom.window.fetch = async (url) => {
            if (url.includes('/api/get-latest-draft')) {
                return { ok: true, json: async () => ({ nomorAju: 'AJU-HS-DOT', items: [{ hsCode: '7326.90.99', description: 'Bracket' }] }) };
            }
            return { ok: true, json: async () => ({ ok: true, drafts: [] }) };
        };
        popDom.window.eval(fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8'));
        popDom.window.eval(fs.readFileSync(path.join(modDir, 'config.js'), 'utf8'));
        popDom.window.eval(fs.readFileSync(path.join(modDir, 'draft_source_client.js'), 'utf8'));
        popDom.window.eval(fs.readFileSync(path.join(modDir, 'popup.js'), 'utf8'));
        await new Promise(r => setTimeout(r, 80));
        assert.strictEqual(popDom.window.document.getElementById('lblItemPreviewTitle').textContent, '[HS 73269099] Bracket');
        popDom.window.close();

        // 4) Backend document_parser.js must not format hsCode with dots
        const parserCode = fs.readFileSync(path.join(ROOT_DIR, 'backend-service', 'document_parser.js'), 'utf8');
        assert(!parserCode.includes('it.hsCode.slice(0, 4)}.${it.hsCode.slice(4, 6)}'), 'document_parser.js must not re-insert dots into hsCode');
    });

    await runTest('12. Hubungkan requests origin permission when missing (Firefox MV3) & guards concurrent clicks', async () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const dom = new JSDOM(fs.readFileSync(path.join(modDir, 'popup.html'), 'utf8'), {
            url: 'moz-extension://fake-firefox-id/popup.html',
            runScripts: 'outside-only'
        });
        const { window } = dom;

        let permRequested = null;
        let hasPerm = false;
        window.chrome = {
            runtime: { getManifest: () => ({ version: '2.1.2' }), onMessage: { addListener: () => {} }, sendMessage: () => {} },
            permissions: {
                contains: async () => hasPerm,
                request: async ({ origins }) => {
                    permRequested = origins;
                    hasPerm = true;
                    return true;
                }
            },
            storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: () => {} } },
            tabs: { query: async () => [], create: () => {}, sendMessage: () => {} }
        };

        window.fetch = async (url) => {
            if (!hasPerm && url.includes('192.168.100.15')) {
                throw new TypeError('NetworkError when attempting to fetch resource.');
            }
            if (url.includes('/api/health')) {
                return { ok: true, json: async () => ({ ok: true, hostIp: '192.168.100.15' }) };
            }
            if (url.includes('/api/get-latest-draft')) {
                return { ok: true, json: async () => ({ nomorAju: 'AJU-FF-OK', items: [{ hsCode: '73269099', description: 'Clip' }] }) };
            }
            return { ok: true, json: async () => ({ ok: true, drafts: [] }) };
        };

        window.eval(fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8'));
        window.eval(fs.readFileSync(path.join(modDir, 'config.js'), 'utf8'));
        window.eval(fs.readFileSync(path.join(modDir, 'draft_source_client.js'), 'utf8'));
        window.eval(fs.readFileSync(path.join(modDir, 'popup.js'), 'utf8'));

        await new Promise(r => setTimeout(r, 40));
        window.document.getElementById('inputDraftSourceHost').value = '192.168.100.15';
        window.document.getElementById('btnSaveDraftSourceHost').click();
        await new Promise(r => setTimeout(r, 120));

        assert.deepStrictEqual(Array.from(permRequested || []), ['http://192.168.100.15/*']);
        assert.strictEqual(window.document.getElementById('lblDraftAjuNo').textContent, 'AJU-FF-OK');
        dom.window.close();
    });

    await runTest('13. content.js fills real Ant Design CEISA 4.0 PEB Barang form (nested active pane, horizontal ant-row, ant-select readonly combobox)', () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const dom = new JSDOM(`<!doctype html><html><body>
            <div class="ant-tabs-tabpane ant-tabs-tabpane-active" id="outerShell">
                <div class="ant-tabs-nav" role="tablist">
                    <div class="ant-tabs-tab" role="tab">Header</div>
                    <div class="ant-tabs-tab ant-tabs-tab-active" role="tab">Barang</div>
                </div>
                <div class="ant-tabs-tabpane ant-tabs-tabpane-hidden">
                    <input id="hidden_hs" name="posTarif" />
                </div>
                <div class="ant-tabs-tabpane ant-tabs-tabpane-active" id="innerBarangPane">
                    <div class="ant-row"><div class="ant-col"><span>Pos Tarif/HS</span></div><div class="ant-col"><input id="ceisa_hs" type="text" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Uraian</span></div><div class="ant-col"><textarea id="ceisa_uraian"></textarea></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Jumlah Satuan</span></div><div class="ant-col"><input id="ceisa_qty" type="text" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Satuan</span></div><div class="ant-col"><div class="ant-select"><div class="ant-select-selector"><input id="ceisa_uom" role="combobox" readonly class="ant-select-selection-search-input" /></div></div></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Nilai Ekspor</span></div><div class="ant-col"><input id="ceisa_val" type="text" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Berat Bersih (Kg)</span></div><div class="ant-col"><input id="ceisa_netto" type="text" /></div></div>
                </div>
            </div>
            <div class="ant-select-dropdown"><div class="ant-select-item-option" title="KGM - KILOGRAM" id="optKgm">KGM - KILOGRAM</div></div>
        </body></html>`, { url: 'https://portal.beacukai.go.id/', runScripts: 'outside-only' });

        let clickedKgmOption = false;
        dom.window.document.getElementById('optKgm').addEventListener('click', () => {
            clickedKgmOption = true;
        });
        dom.window.chrome = {
            runtime: { onMessage: { addListener: () => {} }, sendMessage: () => {} },
            storage: { local: { get: () => {}, set: () => {} }, onChanged: { addListener: () => {} } }
        };
        dom.window.eval(fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8'));
        dom.window.eval(fs.readFileSync(path.join(modDir, 'content.js'), 'utf8'));

        const res = dom.window.handleCeisaAutoInputRow({
            type: 'CEISA_AUTO_INPUT_ROW',
            section: 'barang',
            draftType: 'ekspor',
            index: 0,
            total: 3,
            item: {
                hsCode: '3907.30.90',
                uraianJenisBarang: 'EPOXY RESIN P/N:G01285801',
                jumlahDanSatuanBarang: '10 KGM',
                amount: '500.00',
                beratBersih: '10.00 KG'
            }
        });

        assert.strictEqual(res.ok, true);
        assert.strictEqual(dom.window.document.getElementById('hidden_hs').value, '', 'Hidden tab input must NOT be modified');
        assert.strictEqual(dom.window.document.getElementById('ceisa_hs').value, '39073090');
        assert.strictEqual(dom.window.document.getElementById('ceisa_uraian').value, 'EPOXY RESIN P/N:G01285801');
        assert.strictEqual(dom.window.document.getElementById('ceisa_qty').value, '10');
        assert.strictEqual(clickedKgmOption, true, 'Ant Design readonly Select option KGM must be clicked');
        assert.strictEqual(dom.window.document.getElementById('ceisa_val').value, '500.00');
        assert.strictEqual(dom.window.document.getElementById('ceisa_netto').value, '10.00');
        dom.window.close();
    });

    await runTest('14. content.js returns ok=false (not fake SUKSES) when CEISA Barang form inputs are not open yet', () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const dom = new JSDOM(`<!doctype html><html><body>
            <div class="ant-tabs-tabpane-active"><button type="button">Tambah</button><table><tr><td>Belum ada barang</td></tr></table></div>
        </body></html>`, { url: 'https://portal.beacukai.go.id/', runScripts: 'outside-only' });
        dom.window.chrome = {
            runtime: { onMessage: { addListener: () => {} }, sendMessage: () => {} },
            storage: { local: { get: () => {}, set: () => {} }, onChanged: { addListener: () => {} } }
        };
        dom.window.eval(fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8'));
        dom.window.eval(fs.readFileSync(path.join(modDir, 'content.js'), 'utf8'));

        const res = dom.window.handleCeisaAutoInputRow({
            type: 'CEISA_AUTO_INPUT_ROW',
            section: 'barang',
            item: { hsCode: '39073090', uraianJenisBarang: 'EPOXY RESIN' }
        });

        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.noFieldsMatched, true);
        assert(res.message.includes('Tambah'), 'Hint should mention clicking Tambah button');
        dom.window.close();
    });

    await runTest('15. content.js fills ALL CEISA 4.0 PEB Barang screenshot fields inside outer .row/.col & async Pos Tarif/HS', async () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const dom = new JSDOM(`<!doctype html><html><body>
            <div class="row">
                <div class="col">
                    <div class="ant-row"><div class="ant-col"><span>Seri</span></div><div class="ant-col"><input id="ceisa_seri" disabled value="1" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Pos Tarif/HS</span></div><div class="ant-col"><div class="ant-select"><div class="ant-select-selector"><input id="ceisa_hs" role="combobox" class="ant-select-selection-search-input" /></div></div></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Pernyataan Lartas</span></div><div class="ant-col"><label><input type="radio" id="radYa" name="lartas" />Terkena Lartas</label><label><input type="radio" id="radTidak" name="lartas" />Tidak Terkena Lartas</label></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Kode Barang</span></div><div class="ant-col"><input id="ceisa_kode" type="text" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Uraian Jenis Barang</span></div><div class="ant-col"><textarea id="uraian" name="uraian"></textarea></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Merek</span></div><div class="ant-col"><input id="ceisa_merek" type="text" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Tipe</span></div><div class="ant-col"><input id="ceisa_tipe" type="text" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Spesifikasi Lain</span></div><div class="ant-col"><input id="ceisa_spek" type="text" /></div></div>
                </div>
                <div class="col">
                    <div class="ant-row"><div class="ant-col"><span>Jumlah dan Satuan Barang</span></div><div class="ant-col"><input id="ceisa_qty" type="text" value="1.0000" /></div><div class="ant-col"><div class="ant-select"><div class="ant-select-selector"><input id="ceisa_uom" role="combobox" readonly class="ant-select-selection-search-input" /></div></div></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Kemasan</span></div><div class="ant-col"><input id="ceisa_pkg_qty" type="text" value="1" /></div><div class="ant-col"><div class="ant-select"><div class="ant-select-selector"><input id="ceisa_pkg_type" role="combobox" readonly class="ant-select-selection-search-input" /></div></div></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Berat Bersih (Kg)</span></div><div class="ant-col"><input id="ceisa_netto" type="text" value="0" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Berat Kotor (Kg)</span></div><div class="ant-col"><input id="ceisa_bruto" type="text" value="0" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Volume (M3)</span></div><div class="ant-col"><input id="ceisa_vol" type="text" value="" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Amount FCA</span></div><div class="ant-col"><input id="ceisa_amt" type="text" value="0" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>(Biaya Tambahan - Diskon)</span></div><div class="ant-col"><input id="ceisa_biaya" type="text" value="" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>FOB</span></div><div class="ant-col"><input id="ceisa_fob" type="text" value="0" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Harga Satuan</span></div><div class="ant-col"><input id="ceisa_unit_price" type="text" value="0" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Freight</span></div><div class="ant-col"><input id="ceisa_freight" type="text" value="" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Asuransi</span></div><div class="ant-col"><input id="ceisa_asuransi" type="text" value="" /></div></div>
                </div>
            </div>
            <div class="ant-select-dropdown" id="dd">
                <div class="ant-select-item-option" id="optKgs">KGS - KILOGRAM PER SECOND</div>
                <div class="ant-select-item-option" id="optPk">PK - PACKAGE</div>
            </div>
        </body></html>`, { url: 'https://portal.beacukai.go.id/', runScripts: 'outside-only' });

        let selectedHsAsync = false;
        let selectedKgs = false;
        let selectedPk = false;
        dom.window.document.getElementById('optKgs').addEventListener('click', () => { selectedKgs = true; });
        dom.window.document.getElementById('optPk').addEventListener('click', () => { selectedPk = true; });
        // Simulasikan Pos Tarif/HS dropdown muncul asinkron 150ms setelah user mengetik 39073090
        dom.window.document.getElementById('ceisa_hs').addEventListener('input', () => {
            setTimeout(() => {
                const opt = dom.window.document.createElement('div');
                opt.className = 'ant-select-item-option';
                opt.textContent = '39073090 - - - LAIN-LAIN';
                opt.addEventListener('click', () => { selectedHsAsync = true; });
                dom.window.document.getElementById('dd').appendChild(opt);
            }, 100);
        });

        dom.window.chrome = {
            runtime: { onMessage: { addListener: () => {} }, sendMessage: () => {} },
            storage: { local: { get: () => {}, set: () => {} }, onChanged: { addListener: () => {} } }
        };
        dom.window.eval(fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8'));
        dom.window.eval(fs.readFileSync(path.join(modDir, 'content.js'), 'utf8'));

        const res = await dom.window.handleCeisaAutoInputRowAsync({
            type: 'CEISA_AUTO_INPUT_ROW',
            section: 'barang',
            index: 0,
            total: 1,
            item: {
                hsCode: '39073090',
                lartas: 'tidak',
                kodeBarang: 'KB-01',
                uraianJenisBarang: 'EPOXY RESIN P/N:G01285801XM01',
                merek: 'PELUCURE',
                tipe: 'ME105',
                spesifikasi: 'WHITE 4KG',
                jumlahDanSatuanBarang: '32 KGS',
                kemasanQty: 3,
                kemasanJenis: 'PK - PACKAGE',
                beratBersih: 16,
                beratKotor: 18.5,
                volume: 0,
                amount: 80800,
                biayaTambahan: 0,
                fob: 80800,
                hargaSatuan: 2525,
                freight: 0,
                asuransi: 0
            }
        });

        assert.strictEqual(res.ok, true);
        assert.strictEqual(selectedHsAsync, true, 'Async Pos Tarif/HS dropdown must resolve and click');
        assert.strictEqual(dom.window.document.getElementById('radTidak').checked, true);
        assert.strictEqual(dom.window.document.getElementById('ceisa_kode').value, 'KB-01');
        assert.strictEqual(dom.window.document.getElementById('uraian').value, 'EPOXY RESIN P/N:G01285801XM01');
        assert.strictEqual(dom.window.document.getElementById('ceisa_merek').value, 'PELUCURE');
        assert.strictEqual(dom.window.document.getElementById('ceisa_tipe').value, 'ME105');
        assert.strictEqual(dom.window.document.getElementById('ceisa_spek').value, 'WHITE 4KG');
        assert.strictEqual(dom.window.document.getElementById('ceisa_qty').value, '32');
        assert.strictEqual(selectedKgs, true, 'Satuan KGS dropdown must be selected cleanly');
        assert.strictEqual(dom.window.document.getElementById('ceisa_pkg_qty').value, '3');
        assert.strictEqual(selectedPk, true, 'Kemasan PK dropdown must be selected cleanly');
        assert.strictEqual(dom.window.document.getElementById('ceisa_netto').value, '16');
        assert.strictEqual(dom.window.document.getElementById('ceisa_bruto').value, '18.5');
        assert.strictEqual(dom.window.document.getElementById('ceisa_vol').value, '0');
        assert.strictEqual(dom.window.document.getElementById('ceisa_amt').value, '80800');
        assert.strictEqual(dom.window.document.getElementById('ceisa_biaya').value, '0');
        assert.strictEqual(dom.window.document.getElementById('ceisa_fob').value, '80800');
        assert.strictEqual(dom.window.document.getElementById('ceisa_unit_price').value, '2525');
        assert.strictEqual(dom.window.document.getElementById('ceisa_freight').value, '0');
        assert.strictEqual(dom.window.document.getElementById('ceisa_asuransi').value, '0');
        dom.window.close();
    });

    await runTest('16. Multi-Seri Barang (3 items): auto-switches tab, opens Edit/Tambah, Simpan & Salin Seri across Seri 1->2->3 without overwriting', async () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const dom = new JSDOM(`<!doctype html><html><body>
            <div class="ant-tabs-nav" role="tablist">
                <div class="ant-tabs-tab ant-tabs-tab-active" role="tab" id="tabHeader">Header</div>
                <div class="ant-tabs-tab" role="tab" id="tabBarang">Barang</div>
            </div>
            <div id="paneHost"></div>
        </body></html>`, { url: 'https://portal.beacukai.go.id/', runScripts: 'outside-only' });

        const doc = dom.window.document;
        const paneHost = doc.getElementById('paneHost');
        const savedRecords = [];
        let editingSeri = 1;

        function renderBarangTable() {
            paneHost.innerHTML = `
                <div class="ant-tabs-tabpane-active">
                    <button type="button" id="btnTambahBarang">Tambah</button>
                    <button type="button" id="btnSalinSeri">Salin Seri</button>
                    <table><tbody id="barangRows">
                        ${(savedRecords.length > 0 ? savedRecords : [{ seri: 1, uraian: 'Initial', qty: '1' }]).map((r, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${r.uraian}</td>
                                <td><button type="button" class="btn-edit-row" data-seri="${idx + 1}">Ubah</button></td>
                            </tr>
                        `).join('')}
                    </tbody></table>
                </div>`;
            doc.getElementById('btnTambahBarang').addEventListener('click', () => {
                editingSeri = savedRecords.length + 1;
                renderBarangForm(editingSeri);
            });
            doc.getElementById('btnSalinSeri').addEventListener('click', () => {
                editingSeri = savedRecords.length + 1;
                renderBarangForm(editingSeri);
            });
            paneHost.querySelectorAll('.btn-edit-row').forEach(btn => {
                btn.addEventListener('click', () => {
                    editingSeri = parseInt(btn.getAttribute('data-seri'), 10);
                    renderBarangForm(editingSeri);
                });
            });
        }

        function renderBarangForm(seriNo) {
            paneHost.innerHTML = `
                <div class="ant-tabs-tabpane-active">
                    <button type="button" id="btnSimpanBarang">Simpan</button>
                    <div class="ant-row"><div class="ant-col"><span>Seri</span></div><div class="ant-col"><input id="formSeri" disabled value="${seriNo}" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Uraian Jenis Barang</span></div><div class="ant-col"><textarea id="formUraian"></textarea></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Jumlah Satuan</span></div><div class="ant-col"><input id="formQty" type="text" /></div></div>
                    <div class="ant-row"><div class="ant-col"><span>Berat Bersih (Kg)</span></div><div class="ant-col"><input id="formNetto" type="text" /></div></div>
                </div>`;
            doc.getElementById('btnSimpanBarang').addEventListener('click', () => {
                savedRecords[seriNo - 1] = {
                    seri: seriNo,
                    uraian: doc.getElementById('formUraian').value,
                    qty: doc.getElementById('formQty').value,
                    netto: doc.getElementById('formNetto').value
                };
                renderBarangTable();
            });
        }

        doc.getElementById('tabBarang').addEventListener('click', () => {
            doc.getElementById('tabHeader').classList.remove('ant-tabs-tab-active');
            doc.getElementById('tabBarang').classList.add('ant-tabs-tab-active');
            renderBarangTable();
        });

        dom.window.chrome = {
            runtime: { onMessage: { addListener: () => {} }, sendMessage: () => {} },
            storage: { local: { get: () => {}, set: () => {} }, onChanged: { addListener: () => {} } }
        };
        dom.window.eval(fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8'));
        dom.window.eval(fs.readFileSync(path.join(modDir, 'content.js'), 'utf8'));

        const items = [
            { hsCode: '39073090', uraianJenisBarang: 'EPOXY RESIN', jumlahDanSatuanBarang: '32 KGS', beratBersih: 16 },
            { hsCode: '39073090', uraianJenisBarang: 'RESIN ME-255', jumlahDanSatuanBarang: '10 KGS', beratBersih: 10 },
            { hsCode: '39073090', uraianJenisBarang: 'RESIN HV-125', jumlahDanSatuanBarang: '10 KGS', beratBersih: 10 }
        ];

        for (let i = 0; i < items.length; i++) {
            const res = await dom.window.handleCeisaAutoInputRowAsync({
                type: 'CEISA_AUTO_INPUT_ROW',
                section: 'barang',
                index: i,
                total: items.length,
                saveAfterFill: true,
                item: items[i]
            });
            assert.strictEqual(res.ok, true, `Seri ${i + 1} should succeed`);
        }

        assert.strictEqual(savedRecords.length, 3, 'All 3 distinct Seri must be saved separately');
        assert.deepStrictEqual(savedRecords.map(r => [r.seri, r.uraian, r.qty, r.netto]), [
            [1, 'EPOXY RESIN', '32', '16'],
            [2, 'RESIN ME-255', '10', '10'],
            [3, 'RESIN HV-125', '10', '10']
        ]);
        dom.window.close();
    });

    await runTest('17. Visual proximity plain-div grid (live CEISA layout) + checkbox-gated Salin Seri with async Simpan spinner', async () => {
        const modDir = path.join(ROOT_DIR, 'extensions', 'ceisa-auto-input');
        const dom = new JSDOM(`<!doctype html><html><body>
            <div class="ant-tabs-tabpane-active" id="rootPane"></div>
        </body></html>`, { url: 'https://portal.beacukai.go.id/', runScripts: 'outside-only' });

        const doc = dom.window.document;
        const rootPane = doc.getElementById('rootPane');
        const mockRect = (el, x, y, w, h) => {
            if (!el) return;
            el.getBoundingClientRect = () => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h });
        };

        const savedRows = [{ seri: 1, qty: '1', netto: '32', bruto: '37', amount: '80800', selected: false }];
        let pickedSatuan = false;

        function renderTable() {
            rootPane.innerHTML = `
                <button type="button" id="btnCopyToolbar" disabled>Salin Seri</button>
                <table><tbody id="tbRows">
                    ${savedRows.map((r, i) => `
                        <tr data-row="${i}">
                            <td><input type="checkbox" class="ant-checkbox-input" data-idx="${i}" ${r.selected ? 'checked' : ''} /></td>
                            <td>${r.seri}</td>
                            <td><button type="button" class="btn-ubah" data-idx="${i}">Ubah</button></td>
                        </tr>
                    `).join('')}
                </tbody></table>
            `;
            rootPane.querySelectorAll('.ant-checkbox-input').forEach(cb => {
                cb.addEventListener('change', () => {
                    const idx = parseInt(cb.getAttribute('data-idx'), 10);
                    savedRows[idx].selected = cb.checked;
                    doc.getElementById('btnCopyToolbar').disabled = !savedRows.some(r => r.selected);
                });
            });
            doc.getElementById('btnCopyToolbar').addEventListener('click', () => {
                const newSeri = savedRows.length + 1;
                savedRows.push({ seri: newSeri, qty: '1', netto: '32', bruto: '37', amount: '80800', selected: false });
                renderForm(newSeri);
            });
            rootPane.querySelectorAll('.btn-ubah').forEach(b => {
                b.addEventListener('click', () => renderForm(parseInt(b.getAttribute('data-idx'), 10) + 1));
            });
        }

        function renderForm(seriNo) {
            // Plain <div> grid WITHOUT .ant-col / .ant-row / .ant-form-item wrappers, plus nested containers to exercise visual proximity!
            rootPane.innerHTML = `
                <button type="button" id="btnSimpan">Simpan</button>
                <div class="custom-two-col">
                    <div class="left-labels">
                        <div id="lSeri">Seri</div>
                        <div id="lUraian">Uraian Jenis Barang</div>
                    </div>
                    <div class="left-inputs">
                        <input id="fSeri" disabled value="${seriNo}" />
                        <textarea id="fUraian"></textarea>
                    </div>
                    <div class="right-labels">
                        <div id="lQty">Jumlah dan Satuan Barang</div>
                        <div id="lPkg">Kemasan</div>
                        <div id="lNetto">Berat Bersih (Kg)</div>
                        <div id="lBruto">Berat Kotor (Kg)</div>
                        <div id="lAmt">Amount FCA</div>
                    </div>
                    <div class="right-inputs">
                        <input id="fQty" type="text" />
                        <div class="ant-select" id="selSatWrap"><input id="fSat" type="search" /></div>
                        <input id="fPkgQty" type="text" />
                        <input id="fNetto" type="text" />
                        <input id="fBruto" type="text" />
                        <input id="fAmt" type="text" />
                    </div>
                </div>
                <div id="ddHost"></div>
            `;
            mockRect(doc.getElementById('lSeri'), 50, 50, 120, 24);
            mockRect(doc.getElementById('fSeri'), 200, 48, 220, 28);
            mockRect(doc.getElementById('lUraian'), 50, 110, 140, 24);
            mockRect(doc.getElementById('fUraian'), 200, 108, 220, 60);

            mockRect(doc.getElementById('lQty'), 500, 50, 140, 24);
            mockRect(doc.getElementById('fQty'), 660, 48, 120, 28);
            mockRect(doc.getElementById('selSatWrap'), 790, 48, 160, 28);
            mockRect(doc.getElementById('fSat'), 790, 48, 160, 28);

            mockRect(doc.getElementById('lPkg'), 500, 90, 140, 24);
            mockRect(doc.getElementById('fPkgQty'), 660, 88, 120, 28);

            mockRect(doc.getElementById('lNetto'), 500, 130, 140, 24);
            mockRect(doc.getElementById('fNetto'), 660, 128, 290, 28);

            mockRect(doc.getElementById('lBruto'), 500, 170, 140, 24);
            mockRect(doc.getElementById('fBruto'), 660, 168, 290, 28);

            mockRect(doc.getElementById('lAmt'), 500, 210, 140, 24);
            mockRect(doc.getElementById('fAmt'), 660, 208, 290, 28);

            doc.getElementById('fSat').addEventListener('input', () => {
                doc.getElementById('ddHost').innerHTML = `<div class="ant-select-dropdown"><div id="optKgm" class="ant-select-item-option" title="KGM - KILOGRAM">KGM - KILOGRAM</div></div>`;
                doc.getElementById('optKgm').addEventListener('click', () => { pickedSatuan = true; });
            });

            doc.getElementById('btnSimpan').addEventListener('click', () => {
                const spin = doc.createElement('div');
                spin.className = 'ant-spin-spinning';
                rootPane.appendChild(spin);
                const snap = {
                    seri: seriNo,
                    uraian: doc.getElementById('fUraian').value,
                    qty: doc.getElementById('fQty').value,
                    netto: doc.getElementById('fNetto').value,
                    bruto: doc.getElementById('fBruto').value,
                    amount: doc.getElementById('fAmt').value,
                    selected: false
                };
                setTimeout(() => {
                    savedRows[seriNo - 1] = snap;
                    renderTable();
                }, 420);
            });
        }

        renderForm(1);
        dom.window.chrome = {
            runtime: { onMessage: { addListener: () => {} }, sendMessage: () => {} },
            storage: { local: { get: () => {}, set: () => {} }, onChanged: { addListener: () => {} } }
        };
        dom.window.eval(fs.readFileSync(path.join(modDir, 'module_config.js'), 'utf8'));
        dom.window.eval(fs.readFileSync(path.join(modDir, 'content.js'), 'utf8'));

        const res1 = await dom.window.handleCeisaAutoInputRowAsync({
            type: 'CEISA_AUTO_INPUT_ROW',
            section: 'barang',
            index: 0,
            total: 2,
            saveAfterFill: true,
            item: { hsCode: '39073090', uraianJenisBarang: 'EPOXY RESIN', jumlahDanSatuanBarang: '32 KGM', kemasanQty: 3, beratBersih: 16, beratKotor: 18.5, amount: 80800 }
        });
        assert.strictEqual(res1.ok, true);
        assert.strictEqual(pickedSatuan, true, 'Visual proximity must pick the right-hand Ant Select for Satuan');
        assert.strictEqual(savedRows[0].qty, '32');
        assert.strictEqual(savedRows[0].netto, '16');
        assert.strictEqual(savedRows[0].bruto, '18.5');
        assert.strictEqual(savedRows[0].amount, '80800');

        // Seri 2 arrives while table is displayed with disabled toolbar Salin Seri until row checkbox checked
        const res2 = await dom.window.handleCeisaAutoInputRowAsync({
            type: 'CEISA_AUTO_INPUT_ROW',
            section: 'barang',
            index: 1,
            total: 2,
            saveAfterFill: true,
            item: { hsCode: '39073090', uraianJenisBarang: 'RESIN ME-255', jumlahDanSatuanBarang: '10 KGM', kemasanQty: 3, beratBersih: 10, beratKotor: 23, amount: 65000 }
        });
        assert.strictEqual(res2.ok, true);
        assert.strictEqual(savedRows.length, 2, 'Checkbox-gated Salin Seri + async Simpan spinner must create Seri 2');
        assert.deepStrictEqual([savedRows[1].seri, savedRows[1].uraian, savedRows[1].qty, savedRows[1].netto, savedRows[1].bruto, savedRows[1].amount], [2, 'RESIN ME-255', '10', '10', '23', '65000']);
        dom.window.close();
    });

    console.log(`\n============================================================`);
    console.log(`  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log(`============================================================\n`);
    process.exitCode = failed > 0 ? 1 : 0;
    setTimeout(() => process.exit(process.exitCode), 50);
})();
