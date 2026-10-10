// ====================================================================
// CEISA 4.0 - Dokumen Searcher Backend Service
// doc_searcher_service.js
// Handles PIB/PEB analysis, Outlook MAPI searching, and attachment management
// ====================================================================

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { GoogleGenAI } = require('@google/genai');

const TEMP_DIR = path.join(__dirname, 'temp');
const ATTACHMENTS_DIR = path.join(TEMP_DIR, 'outlook_attachments');
const ZIPS_DIR = path.join(TEMP_DIR, 'zips');

// Ensure working directories exist
[TEMP_DIR, ATTACHMENTS_DIR, ZIPS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper Gemini client
function getAiClient(customKey) {
    const key = customKey || process.env.GEMINI_API_KEY;
    if (!key || !key.trim()) return null;
    return new GoogleGenAI({ apiKey: key.trim() });
}

/**
 * 1. Analyze PIB / PEB PDF Document
 */
async function analyzePibPebDocument(pdfPath, originalName, customApiKey = null) {
    console.log(`[DocSearcher] Menganalisis dokumen PIB/PEB: ${originalName} (${pdfPath})`);

    const ai = getAiClient(customApiKey);
    if (!ai) {
        // Fallback jika API key belum diset
        console.warn(`[DocSearcher] GEMINI_API_KEY belum diset. Mengembalikan template data.`);
        return {
            success: true,
            isAIFallback: true,
            warning: 'Gemini API Key belum diset. Parameter dapat diisi secara manual.',
            data: {
                docType: originalName.toLowerCase().includes('peb') ? 'PEB' : 'PIB',
                pibPebNo: '',
                pibPebDate: new Date().toISOString().split('T')[0],
                importerExporter: '',
                supplierSeller: '',
                consigneeBuyer: '',
                invoiceNo: '',
                invoiceDate: '',
                blAwbNo: '',
                blAwbDate: '',
                packingListNo: '',
                goodsDescription: '',
                vesselVoyage: '',
                containerNo: '',
                targetDocuments: [
                    { type: 'INVOICE', label: 'Commercial Invoice', targetNumber: '', required: true },
                    { type: 'PACKING_LIST', label: 'Packing List', targetNumber: '', required: true },
                    { type: 'BILL_OF_LADING', label: 'Bill of Lading / AWB', targetNumber: '', required: true },
                    { type: 'COO', label: 'Certificate of Origin (COO)', targetNumber: '', required: false },
                    { type: 'OTHER', label: 'Dokumen Pendukung Lainnya', targetNumber: '', required: false }
                ]
            }
        };
    }

    try {
        const fileManager = ai.files;
        console.log(`[DocSearcher] Mengunggah ${originalName} ke Gemini File API...`);
        const uploadResult = await fileManager.upload({
            file: pdfPath,
            mimeType: 'application/pdf',
        });

        const prompt = `Anda adalah ahli kepabeanan Indonesia (CEISA 4.0) spesialis dokumen PIB (Pemberitahuan Impor Barang - BC 2.0) dan PEB (Pemberitahuan Ekspor Barang - BC 3.0).
Analisis berkas PDF pabean ini secara teliti dan ekstrak semua entitas identitas dokumen serta dokumen pelengkap pabean yang tercantum di dalamnya.

Keluarkan HANYA format JSON valid tanpa tanda markdown (tanpa \`\`\`json) dengan struktur persis seperti berikut:
{
  "docType": "PIB atau PEB",
  "pibPebNo": "Nomor Pengajuan / Nomor Pendaftaran (misal 000000-000000-2026... atau 6 digit no pendaftaran)",
  "pibPebDate": "YYYY-MM-DD",
  "importerExporter": "Nama lengkap perusahaan Importir / Eksportir",
  "supplierSeller": "Nama lengkap Pemasok / Pengirim / Shipper / Penjual luar negeri",
  "consigneeBuyer": "Nama lengkap Penerima / Pembeli",
  "invoiceNo": "Nomor Invoice / Faktur komersial",
  "invoiceDate": "YYYY-MM-DD",
  "blAwbNo": "Nomor Bill of Lading (B/L) atau Air Waybill (AWB)",
  "blAwbDate": "YYYY-MM-DD",
  "packingListNo": "Nomor Packing List jika tertera terpisah (atau sama dengan invoice)",
  "goodsDescription": "Ringkasan uraian jenis barang",
  "vesselVoyage": "Nama sarana pengangkut / kapal / flight & nomor voyage",
  "containerNo": "Nomor kontainer / peti kemas jika ada",
  "targetDocuments": [
    { "type": "INVOICE", "label": "Commercial Invoice", "targetNumber": "nomor invoice", "required": true },
    { "type": "PACKING_LIST", "label": "Packing List", "targetNumber": "nomor packing list / invoice", "required": true },
    { "type": "BILL_OF_LADING", "label": "Bill of Lading / AWB", "targetNumber": "nomor BL/AWB", "required": true },
    { "type": "COO", "label": "Certificate of Origin (COO)", "targetNumber": "nomor Form / COO jika ada", "required": false },
    { "type": "OTHER", "label": "Dokumen Pendukung Lainnya", "targetNumber": "", "required": false }
  ]
}`;

        const modelsToTry = [
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.8-flash',
            'gemini-3.6-flash'
        ];

        let response = null;
        let lastErr = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`[DocSearcher] Mengirim prompt ekstraksi ke Gemini (${modelName})...`);
                response = await ai.models.generateContent({
                    model: modelName,
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { fileData: { fileUri: uploadResult.uri, mimeType: uploadResult.mimeType } },
                                { text: prompt }
                            ]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });
                if (response && response.text) {
                    console.log(`[DocSearcher] Sukses dengan model: ${modelName}`);
                    break;
                }
            } catch (mErr) {
                console.warn(`[DocSearcher] Model ${modelName} gagal:`, mErr.message || mErr);
                lastErr = mErr;
            }
        }

        if (!response || !response.text) {
            throw lastErr || new Error('Semua model Gemini tidak dapat merespons.');
        }

        const rawText = response.text || "{}";
        let parsedData = {};
        try {
            const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            console.error('[DocSearcher] Gagal parse JSON AI:', e.message, rawText);
            throw new Error(`Respon AI bukan JSON valid: ${e.message}`);
        }

        console.log(`[DocSearcher] Ekstraksi AI berhasil:`, {
            docType: parsedData.docType,
            invoiceNo: parsedData.invoiceNo,
            blAwbNo: parsedData.blAwbNo,
            importerExporter: parsedData.importerExporter
        });

        return {
            success: true,
            isAIFallback: false,
            data: parsedData
        };

    } catch (err) {
        console.error(`[DocSearcher] Error saat analisis AI dokumen:`, err.message || err);
        // Heuristic fallback from filename
        const isPeb = originalName.toLowerCase().includes('peb');
        const numMatch = originalName.match(/(\d{6,})/);
        return {
            success: true,
            isAIFallback: true,
            warning: `AI offline/kuota habis: ${err.message}. Menggunakan parameter default.`,
            data: {
                docType: isPeb ? 'PEB' : 'PIB',
                pibPebNo: numMatch ? numMatch[1] : '',
                pibPebDate: new Date().toISOString().split('T')[0],
                importerExporter: '',
                supplierSeller: '',
                consigneeBuyer: '',
                invoiceNo: '',
                invoiceDate: '',
                blAwbNo: '',
                blAwbDate: '',
                packingListNo: '',
                goodsDescription: '',
                vesselVoyage: '',
                containerNo: '',
                targetDocuments: [
                    { type: 'INVOICE', label: 'Commercial Invoice', targetNumber: '', required: true },
                    { type: 'PACKING_LIST', label: 'Packing List', targetNumber: '', required: true },
                    { type: 'BILL_OF_LADING', label: 'Bill of Lading / AWB', targetNumber: '', required: true },
                    { type: 'COO', label: 'Certificate of Origin (COO)', targetNumber: '', required: false },
                    { type: 'OTHER', label: 'Dokumen Pendukung Lainnya', targetNumber: '', required: false }
                ]
            }
        };
    }
}

/**
 * 2. Search Outlook Mailbox via PowerShell MAPI Script
 */
function searchOutlook(searchParams) {
    return new Promise((resolve) => {
        const timestamp = Date.now();
        const paramFilePath = path.join(TEMP_DIR, `search_param_${timestamp}.json`);
        
        try {
            fs.writeFileSync(paramFilePath, JSON.stringify(searchParams, null, 2), 'utf8');
        } catch (writeErr) {
            return resolve({
                success: false,
                error: `Gagal membuat file parameter sementara: ${writeErr.message}`
            });
        }

        const scriptPath = path.join(__dirname, 'outlook_searcher.ps1');
        console.log(`[DocSearcher] Menjalankan pencarian Outlook dengan parameter:`, searchParams);

        const child = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-NoProfile',
            '-File', scriptPath,
            '-ParamsFile', paramFilePath
        ], {
            cwd: __dirname,
            windowsHide: true
        });

        let stdoutData = '';
        let stderrData = '';

        child.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString('utf8');
        });

        child.stderr.on('data', (chunk) => {
            stderrData += chunk.toString('utf8');
        });

        child.on('close', (code) => {
            // Clean up temporary param file
            try {
                if (fs.existsSync(paramFilePath)) fs.unlinkSync(paramFilePath);
            } catch (_) {}

            if (code !== 0 && !stdoutData.trim()) {
                console.error(`[DocSearcher] Script PowerShell error (Exit code ${code}):`, stderrData);
                return resolve({
                    success: false,
                    error: stderrData || `PowerShell script gagal dengan exit code ${code}`
                });
            }

            try {
                const result = JSON.parse(stdoutData.trim());
                console.log(`[DocSearcher] Pencarian Outlook selesai: ${result.totalDocsFound} dokumen ditemukan.`);
                resolve(result);
            } catch (jsonErr) {
                console.error(`[DocSearcher] Gagal membaca output JSON dari PowerShell:`, stdoutData);
                resolve({
                    success: false,
                    error: `Format output tidak valid: ${jsonErr.message}`,
                    rawOutput: stdoutData
                });
            }
        });

        child.on('error', (procErr) => {
            try {
                if (fs.existsSync(paramFilePath)) fs.unlinkSync(paramFilePath);
            } catch (_) {}
            console.error(`[DocSearcher] Gagal menjalankan powershell.exe:`, procErr);
            resolve({
                success: false,
                error: `Gagal menjalankan PowerShell: ${procErr.message}`
            });
        });
    });
}

/**
 * 3. Open Email in Outlook Desktop via EntryID
 */
function openOutlookEmail(entryId) {
    return new Promise((resolve) => {
        if (!entryId || !entryId.trim()) {
            return resolve({ success: false, error: 'EntryID email kosong.' });
        }

        const safeEntryId = entryId.trim().replace(/[^a-zA-Z0-9]/g, '');
        const psCommand = `$outlook = New-Object -ComObject Outlook.Application; $item = $outlook.GetNamespace('MAPI').GetItemFromID('${safeEntryId}'); if ($item) { $item.Display() }`;

        console.log(`[DocSearcher] Membuka email di Outlook: EntryID ${safeEntryId}`);
        const child = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-NoProfile',
            '-Command', psCommand
        ], {
            windowsHide: false
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, message: 'Email berhasil dibuka di Microsoft Outlook.' });
            } else {
                resolve({ success: false, error: `Gagal membuka email di Outlook (Exit code ${code})` });
            }
        });

        child.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

/**
 * 4. Create ZIP Bundle of Found Attachments
 */
function createZipBundle(fileNames) {
    return new Promise((resolve) => {
        if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
            return resolve({ success: false, error: 'Tidak ada file untuk dikompres.' });
        }

        const validFilePaths = [];
        fileNames.forEach(fn => {
            const cleanName = path.basename(fn);
            const fullPath = path.join(ATTACHMENTS_DIR, cleanName);
            if (fs.existsSync(fullPath)) {
                validFilePaths.push(fullPath);
            }
        });

        if (validFilePaths.length === 0) {
            return resolve({ success: false, error: 'Berkas dokumen tidak ditemukan di folder penyimpanan.' });
        }

        const zipName = `Dokumen_Pabean_${Date.now()}.zip`;
        const zipPath = path.join(ZIPS_DIR, zipName);

        // Build PowerShell command for Compress-Archive
        const pathsStr = validFilePaths.map(p => `'${p.replace(/'/g, "''")}'`).join(', ');
        const psCmd = `Compress-Archive -LiteralPath @(${pathsStr}) -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`;

        console.log(`[DocSearcher] Mengompres ${validFilePaths.length} file ke ${zipName}...`);
        const child = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-NoProfile',
            '-Command', psCmd
        ], {
            windowsHide: true
        });

        child.on('close', (code) => {
            if (code === 0 && fs.existsSync(zipPath)) {
                resolve({
                    success: true,
                    zipName: zipName,
                    downloadUrl: `/api/doc-searcher/zips/${zipName}`,
                    fileSize: fs.statSync(zipPath).size,
                    totalFiles: validFilePaths.length
                });
            } else {
                resolve({
                    success: false,
                    error: `Gagal membuat arsip ZIP (Exit code ${code})`
                });
            }
        });

        child.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

module.exports = {
    analyzePibPebDocument,
    searchOutlook,
    openOutlookEmail,
    createZipBundle,
    ATTACHMENTS_DIR,
    ZIPS_DIR
};
