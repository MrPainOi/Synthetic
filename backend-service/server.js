require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseDocuments } = require('./document_parser');

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Redirect root to primary module (PIB)
app.get('/', (req, res) => {
    res.redirect('/pib.html');
});

// Setup folder temp/attachments
const uploadDir = path.join(__dirname, 'temp', 'attachments');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Amankan nama file dengan mempertahankan ekstensi dan nama asli
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}_${base}${ext}`);
    }
});
const upload = multer({ storage });

// Serve static attachments
app.use('/api/documents', express.static(uploadDir));
app.get('/api/documents/:filename', (req, res) => {
    const rawTarget = decodeURIComponent(req.params.filename || '');
    const docTypeReq = decodeURIComponent(req.query.docType || '').toLowerCase();
    const target = rawTarget.toLowerCase();
    const cleanTarget = target.replace(/^\d{10,14}_/, '').replace(/[^a-z0-9]/g, '');

    try {
        const files = fs.readdirSync(uploadDir);
        if (files.length === 0) return res.status(404).send('Document not found');

        // 1. Direct or normalized match by filename
        let match = files.find(f => {
            const fLow = f.toLowerCase();
            const fClean = fLow.replace(/^\d{10,14}_/, '').replace(/[^a-z0-9]/g, '');
            return fLow === target || 
                   fClean === cleanTarget || 
                   (cleanTarget.length > 3 && (fClean.includes(cleanTarget) || cleanTarget.includes(fClean)));
        });
        if (match) {
            return res.sendFile(path.join(uploadDir, match));
        }

        // 2. Match by Document Type (B/L vs INVOICE vs PACKING LIST)
        const isBL = /lading|bl|bill|waybill|705|bapsin/i.test(docTypeReq) || /bl|lading|waybill|bapsin/i.test(target);
        const isINV = /invoice|faktur|380/i.test(docTypeReq) || /inv|invoice|faktur/i.test(target);
        const isPL = /packing|kemasan|217/i.test(docTypeReq) || /pl|pack|packing/i.test(target);

        if (isBL) {
            const blMatch = files.slice().reverse().find(f => {
                const fl = f.toLowerCase();
                return fl.includes('bl') || fl.includes('lading') || fl.includes('waybill') || fl.includes('bapsin') || fl.includes('ocean');
            });
            if (blMatch) return res.sendFile(path.join(uploadDir, blMatch));
        } else if (isINV) {
            const invMatch = files.slice().reverse().find(f => {
                const fl = f.toLowerCase();
                return fl.includes('inv') || fl.includes('faktur') || fl.includes('commercial');
            });
            if (invMatch) return res.sendFile(path.join(uploadDir, invMatch));
        } else if (isPL) {
            const plMatch = files.slice().reverse().find(f => {
                const fl = f.toLowerCase();
                return fl.includes('pack') || fl.includes('pl') || fl.includes('list');
            });
            if (plMatch) return res.sendFile(path.join(uploadDir, plMatch));
        }

        // 3. Hanya jika total file di folder uploadDir hanya ada 1 (berkas shipment gabungan)
        if (files.length === 1) {
            return res.sendFile(path.join(uploadDir, files[0]));
        }
    } catch (e) {}
    res.status(404).send('Document not found');
});

// Status & Health Check
app.get('/api/status', (req, res) => {
    const key = process.env.GEMINI_API_KEY || '';
    const hasApiKey = key.trim().length > 5;
    res.json({
        status: 'online',
        service: 'CEISA Document Parser Backend',
        hasApiKey,
        keyPreview: hasApiKey ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : null,
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// Network Info - Mendapatkan semua IP lokal untuk WiFi Sharing
app.get('/api/network-info', (req, res) => {
    const interfaces = os.networkInterfaces();
    const localIPs = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
            // Hanya IPv4, non-loopback
            if (addr.family === 'IPv4' && !addr.internal) {
                localIPs.push({
                    name,
                    address: addr.address,
                    url: `http://${addr.address}:${PORT}`
                });
            }
        }
    }

    res.json({
        success: true,
        port: PORT,
        localIPs,
        pages: ['/', '/pib.html', '/peb.html', '/hscode.html', '/dashboard.html']
    });
});

// Update / Simpan Gemini API Key ke .env
app.post('/api/config-key', (req, res) => {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 5) {
        return res.status(400).json({ error: 'API Key tidak valid.' });
    }
    const cleanKey = apiKey.trim();
    process.env.GEMINI_API_KEY = cleanKey;

    try {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
            if (envContent.includes('GEMINI_API_KEY=')) {
                envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${cleanKey}`);
            } else {
                envContent += `\nGEMINI_API_KEY=${cleanKey}\n`;
            }
        } else {
            envContent = `GEMINI_API_KEY=${cleanKey}\nPORT=${PORT}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('[CONFIG] GEMINI_API_KEY berhasil disimpan ke .env');
        res.json({ success: true, message: 'Gemini API Key berhasil disimpan!' });
    } catch (err) {
        console.error('[CONFIG ERROR]', err.message);
        res.status(500).json({ error: 'Gagal menulis file .env: ' + err.message });
    }
});

// Streaming Parser Endpoint (Server-Sent Events)
app.post('/api/parse-documents', upload.array('files'), async (req, res) => {
    // Setup SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const sendEvent = (obj) => {
        try {
            res.write(`data: ${JSON.stringify(obj)}\n\n`);
        } catch (e) {}
    };

    const uploadedFiles = req.files || [];
    const customKey = req.headers['x-gemini-key'] || req.body?.apiKey || null;
    const mode = req.body?.mode || req.headers['x-customs-mode'] || 'ekspor';

    if (uploadedFiles.length === 0) {
        sendEvent({ type: 'error', message: 'Tidak ada berkas yang diterima server.' });
        return res.end();
    }

    const fileItems = uploadedFiles.map(f => ({
        path: f.path,
        originalName: f.originalname
    }));
    console.log(`\n[API] Menerima ${fileItems.length} dokumen untuk diproses [Mode: ${mode.toUpperCase()}]:`);
    uploadedFiles.forEach(f => console.log(`  - ${f.originalname} (${f.size} bytes)`));

    try {
        const onProgress = (prog) => {
            sendEvent({ type: 'progress', ...prog });
        };

        delete require.cache[require.resolve('./document_parser')];
        const { parseDocuments: dynamicParse } = require('./document_parser');
        const parsedData = await dynamicParse(fileItems, onProgress, customKey, mode);

        if (!parsedData) {
            throw new Error('Hasil ekstraksi kosong atau gagal diproses oleh AI.');
        }

        console.log(`[API] Berhasil mengekstrak data shipment untuk ${uploadedFiles.length} dokumen [Mode: ${mode}].`);
        sendEvent({
            type: 'result',
            data: parsedData,
            mode: mode,
            fileNames: uploadedFiles.map(f => f.originalname)
        });
        res.end();

    } catch (err) {
        console.error('[API ERROR]', err.message);
        sendEvent({
            type: 'error',
            message: err.message || 'Terjadi kesalahan saat memproses dokumen.'
        });
        res.end();
    }
});

// Endpoint untuk menyimpan draft pabean dipisah per folder: khusus impor dan ekspor
app.post('/api/save-draft', (req, res) => {
    try {
        const { mode, data, filename } = req.body || {};
        const isImpor = (mode && (mode.toLowerCase().includes('impor') || mode.toLowerCase().includes('pib'))) ||
            (data && (data.jenisDokumen === 'PIB' || data.isImport));
        const subFolder = isImpor ? 'impor' : 'ekspor';
        const prefix = isImpor ? 'PIB_Draft_' : 'PEB_Draft_';
        const noAju = data?.nomorAju ? data.nomorAju.replace(/[^a-zA-Z0-9_-]/g, '') : Date.now();
        const safeName = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, '_') : `${prefix}${noAju}.json`;

        // 1. Simpan di temp/drafts/<ekspor|impor>
        const tempDir = path.join(__dirname, 'temp', 'drafts', subFolder);
        fs.mkdirSync(tempDir, { recursive: true });
        const tempPath = path.join(tempDir, safeName);
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));

        // 2. Simpan juga di root workspace drafts/<ekspor|impor>
        const rootDir = path.join(__dirname, '..', 'drafts', subFolder);
        fs.mkdirSync(rootDir, { recursive: true });
        const rootPath = path.join(rootDir, safeName);
        fs.writeFileSync(rootPath, JSON.stringify(data, null, 2));

        console.log(`[DRAFT SAVED] Folder: drafts/${subFolder}/ | File: ${safeName}`);
        res.json({
            success: true,
            folder: `drafts/${subFolder}`,
            filename: safeName,
            localPath: rootPath
        });
    } catch (err) {
        console.error('[SAVE-DRAFT ERROR]', err.message);
        res.status(500).json({ error: 'Gagal menyimpan draft: ' + err.message });
    }
});

// Endpoint untuk mengambil draft terbaru (misal untuk pemulihan otomatis data barang)
app.get('/api/get-latest-draft', (req, res) => {
    try {
        const mode = req.query.mode === 'impor' ? 'impor' : 'ekspor';
        const targetDir = path.join(__dirname, '..', 'drafts', mode);
        if (!fs.existsSync(targetDir)) return res.json(null);
        const files = fs.readdirSync(targetDir)
            .filter(f => f.endsWith('.json'))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(targetDir, f)).mtime }))
            .sort((a, b) => b.mtime - a.mtime);
        if (files.length === 0) return res.json(null);
        const latestContent = fs.readFileSync(path.join(targetDir, files[0].name), 'utf8');
        res.json(JSON.parse(latestContent));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint untuk mencari dan mengklasifikasikan HS Code secara dinamis (BTKI & LARTAS)
const {
    lookupHsCode,
    loadCache,
    searchByCode,
    searchByText,
    autocomplete,
    getChapterCodes,
    getDatabaseStats
} = require('./hscode_service');

// POST /api/hscode/lookup - Lookup lengkap via AI + cache
app.post('/api/hscode/lookup', async (req, res) => {
    try {
        const query = req.body?.query || req.query?.query;
        const customKey = req.headers['x-gemini-key'] || req.body?.apiKey;
        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Parameter query diperlukan.' });
        }
        const data = await lookupHsCode(query, customKey);
        res.json({ success: true, data });
    } catch (err) {
        console.error('[HSCODE-LOOKUP ERROR]', err.message);
        res.status(500).json({ error: 'Gagal lookup pos tarif: ' + err.message });
    }
});

// GET /api/hscode/cache - Lihat cache Gemini
app.get('/api/hscode/cache', (req, res) => {
    try {
        const cache = loadCache();
        res.json({ success: true, data: cache });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/hscode/search?q=... - Pencarian cepat dari database SQLite lokal
app.get('/api/hscode/search', (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = Math.min(parseInt(req.query.limit || '20'), 100);
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Parameter q minimal 2 karakter.' });
        }
        const results = searchByText(q.trim(), limit);
        res.json({ success: true, total: results.length, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/hscode/autocomplete?q=... - Autocomplete untuk input HS Code
app.get('/api/hscode/autocomplete', (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = Math.min(parseInt(req.query.limit || '10'), 50);
        if (!q || q.trim().length < 2) {
            return res.json({ success: true, data: [] });
        }
        const results = autocomplete(q.trim(), limit);
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/hscode/code/:code - Lookup langsung by kode
app.get('/api/hscode/code/:code', (req, res) => {
    try {
        const code = req.params.code.replace(/\D/g, '');
        if (!code || code.length < 2) {
            return res.status(400).json({ error: 'Kode HS tidak valid.' });
        }
        const result = searchByCode(code);
        if (!result) {
            return res.status(404).json({ error: `HS Code ${code} tidak ditemukan di database lokal.` });
        }
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/hscode/chapter/:chapter - Semua kode dalam satu chapter
app.get('/api/hscode/chapter/:chapter', (req, res) => {
    try {
        const chapter = String(req.params.chapter).padStart(2, '0');
        const level = parseInt(req.query.level || '6');
        const results = getChapterCodes(chapter, level);
        res.json({ success: true, chapter, total: results.length, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/hscode/stats - Statistik database
app.get('/api/hscode/stats', (req, res) => {
    try {
        const stats = getDatabaseStats();
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/shutdown - Matikan server secara graceful (dari UI toggle)
app.post('/api/shutdown', (req, res) => {
    res.json({ success: true, message: 'Server dimatikan. Jalankan START_SERVER.bat untuk menghidupkan kembali.' });
    console.log('[SHUTDOWN] Server dimatikan via API oleh pengguna.');
    setTimeout(() => {
        server.close(() => {
            console.log('[SHUTDOWN] Server berhenti.');
            process.exit(0);
        });
    }, 500);
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`CEISA Document Parser Server AKTIF di port ${PORT}`);
    console.log(`Endpoint API: http://localhost:${PORT}/api/parse-documents`);
    console.log(`Status API Key: ${process.env.GEMINI_API_KEY ? 'Terpasang' : 'BELUM DISET'}`);
    console.log(`=======================================================`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} sedang digunakan. Coba ganti PORT di .env.`);
    } else {
        console.error('Server error:', err);
    }
});
