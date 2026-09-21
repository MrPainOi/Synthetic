require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parseDocuments } = require('./document_parser');

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    const target = decodeURIComponent(req.params.filename).toLowerCase();
    try {
        const files = fs.readdirSync(uploadDir);
        const match = files.find(f => f.toLowerCase().includes(target) || target.includes(f.toLowerCase()));
        if (match) {
            return res.sendFile(path.join(uploadDir, match));
        }
        if (files.length > 0) {
            // Default ke file upload terbaru
            return res.sendFile(path.join(uploadDir, files[files.length - 1]));
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

    if (uploadedFiles.length === 0) {
        sendEvent({ type: 'error', message: 'Tidak ada berkas yang diterima server.' });
        return res.end();
    }

    const filePaths = uploadedFiles.map(f => f.path);
    console.log(`\n[API] Menerima ${filePaths.length} dokumen untuk diproses:`);
    uploadedFiles.forEach(f => console.log(`  - ${f.originalname} (${f.size} bytes)`));

    try {
        const onProgress = (prog) => {
            sendEvent({ type: 'progress', ...prog });
        };

        const parsedData = await parseDocuments(filePaths, onProgress, customKey);

        if (!parsedData) {
            throw new Error('Hasil ekstraksi kosong atau gagal diproses oleh AI.');
        }

        console.log(`[API] Berhasil mengekstrak data shipment untuk ${uploadedFiles.length} dokumen.`);
        sendEvent({
            type: 'result',
            data: parsedData,
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

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 CEISA Document Parser Server AKTIF di port ${PORT}`);
    console.log(`📡 Endpoint API: http://localhost:${PORT}/api/parse-documents`);
    console.log(`🔑 Status API Key: ${process.env.GEMINI_API_KEY ? 'Terpasang' : 'BELUM DISET'}`);
    console.log(`=======================================================`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} sedang digunakan. Coba ganti PORT di .env.`);
    } else {
        console.error('Server error:', err);
    }
});
