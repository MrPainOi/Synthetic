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

    console.log(`\n============================================================`);
    console.log(`  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log(`============================================================\n`);
    process.exitCode = failed > 0 ? 1 : 0;
    setTimeout(() => process.exit(process.exitCode), 50);
})();
