const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync, spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend-service');
const LOG_FILE = path.join(PROJECT_ROOT, 'autostart.log');
const SERVER_PORT = 5005;

function log(msg) {
    const timestamp = new Date().toLocaleString('id-ID', { hour12: false });
    const line = `[${timestamp}] [NativeLauncher] ${msg}\n`;
    try {
        fs.appendFileSync(LOG_FILE, line, 'utf8');
    } catch (_) {}
}

function sendNativeMessage(obj) {
    try {
        const json = Buffer.from(JSON.stringify(obj), 'utf8');
        const header = Buffer.alloc(4);
        header.writeUInt32LE(json.length, 0);
        process.stdout.write(header);
        process.stdout.write(json);
    } catch (e) {
        log(`Error sending message: ${e.message}`);
    }
}

function checkServerStatus(timeoutMs = 1500) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${SERVER_PORT}/api/status`, { timeout: timeoutMs }, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

function ensureExecutionPolicy() {
    try {
        log('Memeriksa & menetapkan Set-ExecutionPolicy RemoteSigned...');
        execSync('powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"', {
            windowsHide: true,
            stdio: 'ignore'
        });
        log('ExecutionPolicy berhasil diatur ke RemoteSigned.');
    } catch (e) {
        log(`Peringatan ExecutionPolicy: ${e.message}`);
    }
}

function ensureDependencies() {
    const nodeModulesPath = path.join(BACKEND_DIR, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        log('Folder node_modules tidak ditemukan. Menjalankan npm install...');
        try {
            execSync('npm install', {
                cwd: BACKEND_DIR,
                windowsHide: true,
                stdio: 'ignore'
            });
            log('npm install selesai dijalankan.');
        } catch (e) {
            log(`Error saat npm install: ${e.message}`);
        }
    }
}

async function startServer() {
    // 1. Cek jika sudah berjalan
    const isOnline = await checkServerStatus();
    if (isOnline) {
        log('Server sudah aktif di port ' + SERVER_PORT);
        return { status: 'already_running', port: SERVER_PORT };
    }

    // 2. Pastikan dependencies terpasang jika belum ada
    ensureDependencies();

    // 3. Cari binary node yang valid
    let nodeBin = process.execPath || 'node';
    if (!fs.existsSync(nodeBin)) {
        if (fs.existsSync('D:\\Program Files\\nodejs\\node.exe')) {
            nodeBin = 'D:\\Program Files\\nodejs\\node.exe';
        } else if (fs.existsSync('C:\\Program Files\\nodejs\\node.exe')) {
            nodeBin = 'C:\\Program Files\\nodejs\\node.exe';
        }
    }

    // 4. Jalankan server secara detached di background dengan file log
    log('Menjalankan server di port ' + SERVER_PORT + ' menggunakan ' + nodeBin);
    const serverScript = path.join(BACKEND_DIR, 'server.js');
    const serverLogPath = path.join(PROJECT_ROOT, 'server.log');
    let outStream = 'ignore';
    let errStream = 'ignore';
    try {
        const outFd = fs.openSync(serverLogPath, 'a');
        outStream = outFd;
        errStream = outFd;
    } catch (_) {}

    const child = spawn(nodeBin, [serverScript], {
        cwd: BACKEND_DIR,
        detached: true,
        stdio: ['ignore', outStream, errStream],
        windowsHide: true
    });
    child.unref();

    log(`Server berhasil di-spawn (PID: ${child.pid}). Menunggu siap...`);

    // 5. Polling hingga server siap (maksimal 10 detik)
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        const ready = await checkServerStatus(1000);
        if (ready) {
            log(`Server siap dan merespons pada port ${SERVER_PORT}`);
            return { status: 'started', pid: child.pid, port: SERVER_PORT };
        }
    }

    log('Peringatan: Server belum merespons setelah 10 detik.');
    return { status: 'starting', pid: child.pid, port: SERVER_PORT };
}

// ------------------------------------------------------------
// SISTEM PEMBARUAN OTOMATIS (AUTO-UPDATE & PUSH-UPDATE)
// ------------------------------------------------------------
const https = require('https');

function getVersionInfo() {
    const vFile = path.join(PROJECT_ROOT, 'version.json');
    let vData = { version: '2.1.0', branch: 'SupabaseV2' };
    if (fs.existsSync(vFile)) {
        try { vData = JSON.parse(fs.readFileSync(vFile, 'utf8')); } catch (_) {}
    }
    try {
        if (fs.existsSync(path.join(PROJECT_ROOT, '.git'))) {
            const currentSha = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'pipe' }).toString().trim();
            vData.commit = currentSha;
        }
    } catch (_) {}
    return vData;
}

function fetchGithubCommit() {
    return new Promise((resolve, reject) => {
        https.get('https://api.github.com/repos/MrPainOi/Synthetic/commits/SupabaseV2', {
            headers: { 'User-Agent': 'Node-CEISA-Updater' }
        }, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(raw);
                    if (json && json.sha) {
                        resolve({
                            sha: json.sha,
                            message: json.commit?.message || '',
                            author: json.commit?.author?.name || '',
                            date: json.commit?.author?.date || ''
                        });
                    } else {
                        reject(new Error(json.message || 'Gagal membaca commit dari GitHub'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'temp' || 
            entry.name === 'autostart.log' || entry.name === 'server.log') {
            continue;
        }
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function downloadAndExtractZip() {
    return new Promise((resolve, reject) => {
        const zipUrl = 'https://codeload.github.com/MrPainOi/Synthetic/zip/refs/heads/SupabaseV2';
        const tempZip = path.join(PROJECT_ROOT, 'temp_update.zip');
        const tempExtractDir = path.join(PROJECT_ROOT, 'temp_extracted_update');

        const fileStream = fs.createWriteStream(tempZip);

        function fetchFile(url) {
            https.get(url, { headers: { 'User-Agent': 'Node-CEISA-Updater' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fetchFile(res.headers.location);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`Download zip gagal: HTTP ${res.statusCode}`));
                }
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    try {
                        if (fs.existsSync(tempExtractDir)) {
                            fs.rmSync(tempExtractDir, { recursive: true, force: true });
                        }
                        fs.mkdirSync(tempExtractDir, { recursive: true });

                        execSync(`tar -xf "${tempZip}" -C "${tempExtractDir}"`, { windowsHide: true, stdio: 'pipe' });

                        const subdirs = fs.readdirSync(tempExtractDir);
                        const sourceDir = subdirs.length > 0 ? path.join(tempExtractDir, subdirs[0]) : tempExtractDir;

                        copyDirRecursive(sourceDir, PROJECT_ROOT);

                        try { fs.unlinkSync(tempZip); } catch (_) {}
                        try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (_) {}
                        resolve(true);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        }

        fetchFile(zipUrl);
    });
}

async function performPullUpdate() {
    log('Menjalankan pull update...');
    let methodUsed = 'git';
    let hasGit = false;

    try {
        execSync('git --version', { windowsHide: true, stdio: 'ignore' });
        if (fs.existsSync(path.join(PROJECT_ROOT, '.git'))) {
            hasGit = true;
        }
    } catch (_) {}

    if (hasGit) {
        try {
            log('Mengambil update via git fetch & reset hard...');
            execSync('git fetch origin SupabaseV2', { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'pipe' });
            execSync('git reset --hard origin/SupabaseV2', { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'pipe' });
        } catch (gitErr) {
            log(`Git pull gagal: ${gitErr.message}, beralih ke zip...`);
            hasGit = false;
        }
    }

    if (!hasGit) {
        log('Mengunduh pembaruan rilis ZIP dari GitHub...');
        await downloadAndExtractZip();
        methodUsed = 'zip';
    }

    let finalCommit = '';
    try {
        if (fs.existsSync(path.join(PROJECT_ROOT, '.git'))) {
            finalCommit = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'pipe' }).toString().trim();
        }
    } catch (_) {}

    const vFile = path.join(PROJECT_ROOT, 'version.json');
    let vData = { version: '2.1.0', branch: 'SupabaseV2' };
    if (fs.existsSync(vFile)) {
        try { vData = JSON.parse(fs.readFileSync(vFile, 'utf8')); } catch (_) {}
    }
    if (finalCommit) vData.commit = finalCommit;
    vData.updated_at = new Date().toISOString();
    fs.writeFileSync(vFile, JSON.stringify(vData, null, 2), 'utf8');

    try { ensureDependencies(); } catch (_) {}

    log(`Pembaruan selesai (Metode: ${methodUsed}, Commit: ${finalCommit.substring(0, 7) || 'latest'})`);
    return {
        status: 'success',
        method: methodUsed,
        commit: finalCommit,
        version: vData.version,
        message: 'Pembaruan berhasil diterapkan!'
    };
}

async function performPushUpdate(commitMsg) {
    log('Menjalankan push update (Developer Mode)...');
    const msg = commitMsg || `Rilis update sistem: ${new Date().toLocaleString('id-ID')}`;

    execSync('git add -A', { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'pipe' });
    try {
        execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'pipe' });
    } catch (_) {
        // Abaikan jika tidak ada file yang berubah
    }

    execSync('git push origin SupabaseV2', { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'pipe' });

    const newSha = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'pipe' }).toString().trim();

    const vFile = path.join(PROJECT_ROOT, 'version.json');
    let vData = { version: '2.1.0', branch: 'SupabaseV2' };
    if (fs.existsSync(vFile)) {
        try { vData = JSON.parse(fs.readFileSync(vFile, 'utf8')); } catch (_) {}
    }
    vData.commit = newSha;
    vData.updated_at = new Date().toISOString();
    fs.writeFileSync(vFile, JSON.stringify(vData, null, 2), 'utf8');

    log(`Push update berhasil ke GitHub (Commit: ${newSha.substring(0, 7)})`);
    return {
        status: 'success',
        commit: newSha,
        version: vData.version,
        message: `Pembaruan berhasil di-push ke GitHub! (Commit: ${newSha.substring(0, 7)})`
    };
}

// Handler pesan Native Messaging (Chrome STDIO)
let inputChunks = [];
let expectedLength = null;

process.stdin.on('data', async (chunk) => {
    inputChunks.push(chunk);

    while (true) {
        const fullBuffer = Buffer.concat(inputChunks);
        if (expectedLength === null) {
            if (fullBuffer.length < 4) break;
            expectedLength = fullBuffer.readUInt32LE(0);
        }

        if (fullBuffer.length >= 4 + expectedLength) {
            const msgBytes = fullBuffer.slice(4, 4 + expectedLength);
            inputChunks = [fullBuffer.slice(4 + expectedLength)];
            expectedLength = null;

            try {
                const message = JSON.parse(msgBytes.toString('utf8'));
                log(`Menerima pesan dari Chrome: ${JSON.stringify(message)}`);

                if (message.action === 'status') {
                    const online = await checkServerStatus();
                    sendNativeMessage({ status: online ? 'online' : 'offline', port: SERVER_PORT });
                } else if (message.action === 'start') {
                    const result = await startServer();
                    sendNativeMessage(result);
                } else if (message.action === 'get_version') {
                    const info = getVersionInfo();
                    sendNativeMessage({ status: 'success', data: info });
                } else if (message.action === 'check_update') {
                    const localInfo = getVersionInfo();
                    let remoteInfo = null;
                    try {
                        remoteInfo = await fetchGithubCommit();
                    } catch (e) {
                        log(`Peringatan cek remote GitHub: ${e.message}`);
                    }
                    const updateAvailable = remoteInfo && remoteInfo.sha !== localInfo.commit;
                    sendNativeMessage({
                        status: 'success',
                        update_available: Boolean(updateAvailable),
                        local_commit: localInfo.commit,
                        remote_commit: remoteInfo?.sha || '',
                        remote_message: remoteInfo?.message || '',
                        remote_date: remoteInfo?.date || ''
                    });
                } else if (message.action === 'pull_update') {
                    const result = await performPullUpdate();
                    sendNativeMessage(result);
                } else if (message.action === 'push_update') {
                    const result = await performPushUpdate(message.commit_message);
                    sendNativeMessage(result);
                } else {
                    sendNativeMessage({ status: 'unknown_action', action: message.action });
                }
            } catch (err) {
                log(`Error parsing pesan: ${err.message}`);
                sendNativeMessage({ status: 'error', error: err.message });
            }
        } else {
            break;
        }
    }
});

process.stdin.on('end', () => {
    process.exit(0);
});
