#!/usr/bin/env node
/**
 * Build Modular Chrome Extension Packages under c:\Synthetic\extensions\
 * Memisahkan Extension dari file Website/Backend sehingga pengguna bisa upload:
 * 1. extensions/ceisa-auto-input/  -> Modul Auto Input CEISA saja (paling ringan, tanpa Website/Scanner/PDF/Backend)
 * 2. extensions/ceisa-scanner/     -> Modul Scanner & Monitoring SPPB saja (tanpa Auto Input/Website)
 * 3. extensions/ceisa-extension/   -> Extension Lengkap (Scanner + Auto Input) tanpa Website/OCR/Backend
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXTENSIONS_OUT_DIR = path.join(ROOT_DIR, 'extensions');

const rootManifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));

function ensureCleanDir(dirPath) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    fs.mkdirSync(dirPath, { recursive: true });
}

function copyRelativeFile(destRoot, relPath) {
    const src = path.join(ROOT_DIR, relPath);
    const dst = path.join(destRoot, relPath);
    if (!fs.existsSync(src)) {
        throw new Error(`File sumber tidak ditemukan: ${src}`);
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
}

function writeTextFile(destRoot, relPath, content) {
    const dst = path.join(destRoot, relPath);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, content, 'utf8');
}

function writeJsonFile(destRoot, relPath, obj) {
    writeTextFile(destRoot, relPath, JSON.stringify(obj, null, 4) + '\n');
}

function copyExtensionIcons(destRoot, includeLargeIcons = false) {
    const iconFiles = ['icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-128.png', 'favicon.svg'];
    if (includeLargeIcons) {
        iconFiles.push('icons/icon-192.png', 'icons/icon-512.png');
    }
    iconFiles.forEach(rel => {
        if (fs.existsSync(path.join(ROOT_DIR, rel))) {
            copyRelativeFile(destRoot, rel);
        }
    });
}

function buildAutoInputPopupHtml() {
    let html = fs.readFileSync(path.join(ROOT_DIR, 'popup.html'), 'utf8');
    // Hapus script sync.js agar modul Auto Input tidak bergantung pada Google Sheets Sync engine
    html = html.replace(/^\s*<script src="sync\.js"><\/script>\r?\n/m, '');
    // Ubah judul halaman agar sesuai modul standalone Auto Input
    html = html.replace('<title>CEISA 4.0 Automation</title>', '<title>CEISA 4.0 Auto Input</title>');
    return html;
}

function buildScannerPopupHtml() {
    let html = fs.readFileSync(path.join(ROOT_DIR, 'popup.html'), 'utf8');
    html = html.replace('<title>CEISA 4.0 Automation</title>', '<title>CEISA 4.0 Scanner Status</title>');
    return html;
}

function buildModuleManifest(moduleType) {
    const baseIcons = {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png"
    };

    const actionBlock = {
        "default_title": moduleType === 'autoinput'
            ? "CEISA 4.0 Auto Input"
            : (moduleType === 'scanner' ? "CEISA 4.0 Scanner Status" : "CEISA 4.0 Automation"),
        "default_popup": "popup.html",
        "default_icon": baseIcons
    };

    if (moduleType === 'autoinput') {
        return {
            "manifest_version": 3,
            "name": "CEISA 4.0 Auto Input",
            "version": rootManifest.version,
            "description": "Modul standalone Auto Input CEISA 4.0 (ambil draft lokal/LAN IP tanpa bundling website).",
            "icons": baseIcons,
            "permissions": [
                "storage",
                "activeTab",
                "scripting"
            ],
            "host_permissions": [
                "https://portal.beacukai.go.id/*",
                "https://*.beacukai.go.id/*",
                "http://localhost/*",
                "http://127.0.0.1/*",
                "http://*/*",
                "https://*/*"
            ],
            "action": actionBlock,
            "content_security_policy": {
                "extension_pages": "script-src 'self'; object-src 'self'"
            },
            "content_scripts": [
                {
                    "matches": [
                        "https://portal.beacukai.go.id/*",
                        "https://*.beacukai.go.id/*"
                    ],
                    "js": [
                        "module_config.js",
                        "config.js",
                        "draft_source_client.js",
                        "content.js"
                    ],
                    "run_at": "document_start",
                    "all_frames": false
                }
            ]
        };
    }

    if (moduleType === 'scanner') {
        return {
            "manifest_version": 3,
            "name": "CEISA 4.0 Scanner Status",
            "version": rootManifest.version,
            "description": "Modul standalone Scanner & Monitoring Status SPPB/NPPB CEISA 4.0 (tanpa bundling website).",
            "icons": baseIcons,
            "permissions": [
                "storage",
                "offscreen",
                "activeTab",
                "nativeMessaging",
                "scripting"
            ],
            "host_permissions": rootManifest.host_permissions,
            "externally_connectable": rootManifest.externally_connectable,
            "background": {
                "service_worker": "background.js"
            },
            "action": actionBlock,
            "content_security_policy": {
                "extension_pages": "script-src 'self'; object-src 'self'"
            },
            "content_scripts": [
                {
                    "matches": [
                        "https://portal.beacukai.go.id/*",
                        "https://*.beacukai.go.id/*"
                    ],
                    "js": [
                        "module_config.js",
                        "config.js",
                        "sync.js",
                        "content.js"
                    ],
                    "run_at": "document_start",
                    "all_frames": false
                }
            ],
            "web_accessible_resources": [
                {
                    "resources": ["inject.js"],
                    "matches": [
                        "https://portal.beacukai.go.id/*",
                        "https://*.beacukai.go.id/*"
                    ]
                }
            ]
        };
    }

    // 'extension' -> Paket lengkap extension (Scanner + Auto Input) tanpa website HTML/backend/OCR
    return {
        "manifest_version": 3,
        "name": rootManifest.name,
        "version": rootManifest.version,
        "description": "CEISA 4.0 Automation Extension (Scanner + Auto Input, tanpa file website/backend).",
        "icons": baseIcons,
        "key": rootManifest.key,
        "permissions": rootManifest.permissions,
        "host_permissions": rootManifest.host_permissions,
        "externally_connectable": rootManifest.externally_connectable,
        "background": {
            "service_worker": "background.js"
        },
        "action": actionBlock,
        "content_security_policy": {
            "extension_pages": "script-src 'self'; object-src 'self'"
        },
        "content_scripts": [
            {
                "matches": [
                    "https://portal.beacukai.go.id/*",
                    "https://*.beacukai.go.id/*"
                ],
                "js": [
                    "module_config.js",
                    "config.js",
                    "sync.js",
                    "content.js"
                ],
                "run_at": "document_start",
                "all_frames": false
            }
        ],
        "web_accessible_resources": [
            {
                "resources": ["inject.js"],
                "matches": [
                    "https://portal.beacukai.go.id/*",
                    "https://*.beacukai.go.id/*"
                ]
            }
        ]
    };
}

function buildModularPackages() {
    fs.mkdirSync(EXTENSIONS_OUT_DIR, { recursive: true });

    // 1. Standalone Auto Input Extension
    const autoInputDir = path.join(EXTENSIONS_OUT_DIR, 'ceisa-auto-input');
    ensureCleanDir(autoInputDir);
    ['config.js', 'draft_source_client.js', 'popup.css', 'popup.js', 'content.js'].forEach(f => copyRelativeFile(autoInputDir, f));
    copyExtensionIcons(autoInputDir, false);
    writeTextFile(autoInputDir, 'module_config.js', "globalThis.__CEISA_MODULE_MODE__ = 'autoinput';\n");
    writeTextFile(autoInputDir, 'popup.html', buildAutoInputPopupHtml());
    writeJsonFile(autoInputDir, 'manifest.json', buildModuleManifest('autoinput'));

    // 2. Standalone Scanner Status Extension
    const scannerDir = path.join(EXTENSIONS_OUT_DIR, 'ceisa-scanner');
    ensureCleanDir(scannerDir);
    [
        'config.js', 'sync.js', 'draft_source_client.js', 'background.js',
        'offscreen.html', 'offscreen.js', 'pdf.mjs', 'pdf.worker.mjs',
        'inject.js', 'popup.css', 'popup.js', 'content.js'
    ].forEach(f => copyRelativeFile(scannerDir, f));
    copyExtensionIcons(scannerDir, false);
    writeTextFile(scannerDir, 'module_config.js', "globalThis.__CEISA_MODULE_MODE__ = 'scanner';\n");
    writeTextFile(scannerDir, 'popup.html', buildScannerPopupHtml());
    writeJsonFile(scannerDir, 'manifest.json', buildModuleManifest('scanner'));

    // 3. Combined Extension Only (Scanner + Auto Input, zero website HTML / OCR traineddata / backend)
    const fullExtDir = path.join(EXTENSIONS_OUT_DIR, 'ceisa-extension');
    ensureCleanDir(fullExtDir);
    [
        'config.js', 'sync.js', 'draft_source_client.js', 'background.js',
        'offscreen.html', 'offscreen.js', 'pdf.mjs', 'pdf.worker.mjs',
        'inject.js', 'popup.html', 'popup.css', 'popup.js', 'content.js'
    ].forEach(f => copyRelativeFile(fullExtDir, f));
    copyExtensionIcons(fullExtDir, false);
    writeTextFile(fullExtDir, 'module_config.js', "globalThis.__CEISA_MODULE_MODE__ = 'extension';\n");
    writeJsonFile(fullExtDir, 'manifest.json', buildModuleManifest('extension'));

    // README panduan penggunaan modular
    writeTextFile(
        EXTENSIONS_OUT_DIR,
        'README.md',
        [
            '# Paket Extension Modular CEISA 4.0',
            '',
            'Setiap subfolder di sini bisa langsung di-upload ke Chrome (`chrome://extensions` -> aktifkan **Developer mode** -> **Load unpacked**), **tanpa membawa file website/backend**:',
            '',
            '1. `extensions/ceisa-auto-input/` - Hanya modul **Auto Input CEISA** (paling ringan, tanpa Scanner, tanpa Website, tanpa PDF/OCR/Backend).',
            '2. `extensions/ceisa-scanner/` - Hanya modul **Scanner & Monitoring Status SPPB** (terhubung ke Web Dashboard di host Anda).',
            '3. `extensions/ceisa-extension/` - Gabungan **Scanner + Auto Input** tanpa file Website (`pib.html`, `peb.html`, `dashboard.html`, dll) dan tanpa `backend-service/`.',
            '',
            '## Mengambil Draft dari PC Lain (misal `192.168.100.15`) Saat Web di Host Sendiri',
            '- Di **PC Pemilik Draft (`192.168.100.15`)**: pastikan backend berjalan (`START_SERVER.bat` / `node backend-service/server.js`) dan port `5005` diizinkan di Windows Firewall untuk jaringan LAN.',
            '- Di **PC Anda**: buka popup Auto Input -> klik **Atur IP / Host** -> isi `192.168.100.15` (atau `192.168.100.15:5005`) -> klik **Hubungkan**.',
            '- Secara terpisah, isi **Host Web Dashboard Anda** (misal `http://localhost:5005` atau URL host Anda sendiri) -> klik **Buka Web**.',
            '',
            'Untuk menyinkronkan ulang folder modular setelah mengubah file sumber di root, jalankan:',
            '```',
            'node scripts/build_modular_extensions.js',
            '```',
            ''
        ].join('\n')
    );

    const summary = ['ceisa-auto-input', 'ceisa-scanner', 'ceisa-extension'].map(name => {
        const dir = path.join(EXTENSIONS_OUT_DIR, name);
        let totalBytes = 0;
        let fileCount = 0;
        function walk(d) {
            for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
                const p = path.join(d, entry.name);
                if (entry.isDirectory()) walk(p);
                else {
                    fileCount++;
                    totalBytes += fs.statSync(p).size;
                }
            }
        }
        walk(dir);
        return { name, fileCount, sizeKB: Math.round(totalBytes / 1024) };
    });

    return summary;
}

if (require.main === module) {
    const result = buildModularPackages();
    console.log('Modular Chrome extension packages berhasil dibuat di:', EXTENSIONS_OUT_DIR);
    result.forEach(r => {
        console.log(` - extensions/${r.name}: ${r.fileCount} files (${r.sizeKB} KB)`);
    });
}

module.exports = { buildModularPackages };
