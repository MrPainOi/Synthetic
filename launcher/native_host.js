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

    // 2. Pastikan ExecutionPolicy & dependencies terpasang
    ensureExecutionPolicy();
    ensureDependencies();

    // 3. Cari binary node
    let nodeBin = 'node';
    if (fs.existsSync('C:\\Program Files\\nodejs\\node.exe')) {
        nodeBin = 'C:\\Program Files\\nodejs\\node.exe';
    } else if (fs.existsSync('D:\\Program Files\\nodejs\\node.exe')) {
        nodeBin = 'D:\\Program Files\\nodejs\\node.exe';
    }

    // 4. Jalankan server secara detached di background
    log('Menjalankan server di port ' + SERVER_PORT);
    const serverScript = path.join(BACKEND_DIR, 'server.js');
    
    const child = spawn(nodeBin, [serverScript], {
        cwd: BACKEND_DIR,
        detached: true,
        stdio: 'ignore',
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
