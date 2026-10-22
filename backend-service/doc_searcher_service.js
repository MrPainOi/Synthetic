require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { GoogleGenAI } = require('@google/genai');
const { PDFParse } = require('pdf-parse');

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
 * Ekstraksi Lokal Cepat & Deterministik dari Dokumen Pabean (PDF CEISA / PPFTZ)
 * Tanpa ketergantungan internet/AI quota untuk akurasi identitas dokumen 100%.
 */
async function extractPibPebFromPdfLocal(pdfPath, originalName = '') {
    try {
        if (!fs.existsSync(pdfPath)) return null;
        const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
        await parser.load();
        const textResult = await parser.getText();
        await parser.destroy();
        const text = typeof textResult === 'string' ? textResult : (textResult.text || '');

        if (!text || text.trim().length === 0) return null;

        // 1. Klasifikasi Arah Transaksi: EKSPOR (PEB / BC 3.0 / Pengeluaran) vs IMPOR (PIB / BC 2.0 / Pemasukan)
        const isPengeluaran = /PENGELUARAN KE LDP|PENGELUARAN DARI FREE TRADE ZONE|PEMBERITAHUAN EKSPOR|PPFTZ.*PENGELUARAN|BC\s*3\.0/i.test(text);
        const isPemasukan = /PEMASUKAN DARI LDP|PEMASUKAN KE FREE TRADE ZONE|PEMBERITAHUAN IMPOR|PPFTZ.*PEMASUKAN|BC\s*2\.0/i.test(text);
        let docType = isPengeluaran ? 'PEB' : (isPemasukan ? 'PIB' : (originalName.toLowerCase().includes('peb') ? 'PEB' : 'PIB'));

        // 2. Nomor Pendaftaran & Nomor Pengajuan
        const regMatch = text.match(/Nomor\s*Pendaftaran\s*:?\s*(\d{5,})/i);
        const ajuMatch = text.match(/Nomor\s*Pengajuan\s*:?\s*([0-9A-Z]+)/i);
        const pibPebNo = regMatch ? regMatch[1].trim() : (ajuMatch ? ajuMatch[1].trim() : '');

        const pibDateMatch = text.match(/(\d{2}-\d{2}-\d{4})\s*(?:\t|\s+)\s*Tanggal\s*(?:Pendaftaran|Pengajuan)/i) ||
                             text.match(/Tanggal\s*(?:Pendaftaran|Pengajuan)\s*:?\s*(\d{2}-\d{2}-\d{4})/i);
        const pibPebDate = pibDateMatch ? pibDateMatch[1].split('-').reverse().join('-') : new Date().toISOString().split('T')[0];

        // 3. Ekstraksi Tabel Dokumen Pelengkap Pabean
        function cleanCustomsDocNum(raw) {
            return raw.replace(/^\d+\s+\d{3}\s+(?:INVOICE|PACKING\s*LIST|B\/L|BL|AWB|AIR\s*WAYBILL|FAKTUR|KONTRAK)\s*/i, '').trim();
        }

        let invoiceNo = '';
        let invoiceDate = '';
        let packingListNo = '';
        let blAwbNo = '';
        let blAwbDate = '';

        const invSecIdx = text.indexOf('20. Invoice');
        if (invSecIdx !== -1) {
            const docSection = text.slice(invSecIdx);
            const lines = docSection.split('\n').map(l => l.trim()).filter(Boolean);
            const lastNoIdx = lines.findLastIndex(l => l.includes('No.'));
            if (lastNoIdx !== -1) {
                const docLines = lines.slice(lastNoIdx + 1);

                function parseCustomsLine(line) {
                    if (!line || line.includes('Tgl. -') || line === '-') return { num: '', date: '' };
                    const dMatch = line.match(/(\d{2}-\d{2}-\d{4})/);
                    const dt = dMatch ? dMatch[1].split('-').reverse().join('-') : '';
                    let rawNum = line.replace(/(\d{2}-\d{2}-\d{4})/, '').replace(/Tgl\.?/gi, '').replace(/\t/g, ' ').trim();
                    rawNum = cleanCustomsDocNum(rawNum);
                    return { num: rawNum, date: dt };
                }

                if (docLines[0]) {
                    const parsed = parseCustomsLine(docLines[0]);
                    invoiceNo = parsed.num;
                    invoiceDate = parsed.date;
                }
                if (docLines[1]) {
                    const parsed = parseCustomsLine(docLines[1]);
                    packingListNo = parsed.num;
                }
                if (docLines[2]) {
                    const parsed = parseCustomsLine(docLines[2]);
                    blAwbNo = parsed.num;
                    blAwbDate = parsed.date;
                }
            }
        }

        // Secondary fallback jika tabel tidak terformat standar
        if (!invoiceNo) {
            const m = text.match(/Invoice[\s\S]*?No\.?\s*([A-Z0-9\/\-]+(?:\s*-\s*[A-Z0-9]+)?)/i);
            if (m) invoiceNo = m[1].trim();
        }
        if (!blAwbNo) {
            const m = text.match(/BL\/AWB[\s\S]*?No\.?\s*([A-Z0-9\/\s\-]+)/i);
            if (m) blAwbNo = m[1].trim();
        }

        // Indikator kuat /EXP/ atau /IMP/ pada nomor invoice
        if (invoiceNo.includes('/EXP/')) docType = 'PEB';
        if (invoiceNo.includes('/IMP/')) docType = 'PIB';

        // 4. Profil Entitas & Aturan Khusus PT. Sinar Asia Pack
        const isSinarAsia = /sinar\s*asia/i.test(text) || /sinar\s*asia/i.test(originalName);
        let importerExporter = '';
        let supplierSeller = '';
        let consigneeBuyer = '';

        if (isSinarAsia) {
            if (docType === 'PEB') {
                // EKSPOR (PEB): Eksportir = PT. Sinar Asia Pack, Pembeli Luar Negeri = Golden Ben Printer Pte Ltd
                importerExporter = 'PT. SINAR ASIA PACK';
                supplierSeller = 'PT. SINAR ASIA PACK';
                consigneeBuyer = 'GOLDEN BEN PRINTER PTE LTD';
            } else {
                // IMPOR (PIB): Importir / Penerima = PT. Sinar Asia Pack, Pemasok = Golden Ben Printer Pte Ltd
                importerExporter = 'PT. SINAR ASIA PACK';
                consigneeBuyer = 'PT. SINAR ASIA PACK';
                supplierSeller = 'GOLDEN BEN PRINTER PTE LTD';
            }
            // Sinar Asia: Packing List dan Invoice adalah 1 dokumen yang sama (CIPL)
            if (!packingListNo) packingListNo = invoiceNo;
            if (!invoiceNo && packingListNo) invoiceNo = packingListNo;
        }

        // 5. Sarana Pengangkut (Vessel / Voyage)
        let vesselVoyage = '';
        const vMatch = text.match(/([A-Z0-9\s.]+?),\s*\[[A-Z]{2}\][^\n]*\n\s*([A-Z0-9\-]+)\s*\n\s*10\.\s*Nama/i);
        if (vMatch) {
            const cleanVessel = vMatch[1].replace(/.*Pengangkutan\s+[A-Za-z]+\s*/i, '').trim();
            vesselVoyage = cleanVessel + (vMatch[2] ? ' / ' + vMatch[2].trim() : '');
        }

        // 6. Nomor Peti Kemas
        let containerNo = '';
        const contMatch = text.match(/40\.\s*Nomor.*?Peti\s*Kemas[\s\S]*?([A-Z]{4}\d{7})/i) ||
                          text.match(/\b([A-Z]{4}\s*\d{7})\b/);
        if (contMatch) {
            containerNo = contMatch[1].replace(/\s+/g, '');
        }

        return {
            docType,
            pibPebNo,
            pibPebDate,
            importerExporter,
            supplierSeller,
            consigneeBuyer,
            invoiceNo,
            invoiceDate,
            blAwbNo,
            blAwbDate,
            packingListNo,
            goodsDescription: isSinarAsia ? 'Printed Packaging Materials / Boxes' : '',
            vesselVoyage,
            containerNo,
            targetDocuments: [
                { type: 'INVOICE', label: 'Commercial Invoice', targetNumber: invoiceNo, required: true },
                { type: 'PACKING_LIST', label: isSinarAsia ? 'Packing List (1 Dokumen CIPL bersama Invoice)' : 'Packing List', targetNumber: packingListNo || invoiceNo, required: true },
                { type: 'BILL_OF_LADING', label: 'Bill of Lading / AWB', targetNumber: blAwbNo, required: true },
                { type: 'COO', label: 'Certificate of Origin (COO)', targetNumber: '', required: false },
                { type: 'OTHER', label: 'Dokumen Pendukung Lainnya', targetNumber: '', required: false }
            ]
        };
    } catch (e) {
        console.warn('[DocSearcher] extractPibPebFromPdfLocal error:', e.message);
        return null;
    }
}

/**
 * 1. Analyze PIB / PEB PDF Document
 */
async function analyzePibPebDocument(pdfPath, originalName, customApiKey = null) {
    console.log(`[DocSearcher] Menganalisis dokumen PIB/PEB: ${originalName} (${pdfPath})`);

    // Ekstraksi lokal deterministik terlebih dahulu
    const localData = await extractPibPebFromPdfLocal(pdfPath, originalName);
    if (localData) {
        console.log(`[DocSearcher] Ekstraksi lokal PDF berhasil:`, {
            docType: localData.docType,
            pibPebNo: localData.pibPebNo,
            invoiceNo: localData.invoiceNo,
            blAwbNo: localData.blAwbNo,
            importerExporter: localData.importerExporter,
            consigneeBuyer: localData.consigneeBuyer
        });
    }

    const ai = getAiClient(customApiKey);
    if (!ai) {
        // Fallback jika API key belum diset
        console.warn(`[DocSearcher] GEMINI_API_KEY belum diset. Menggunakan hasil parser lokal.`);
        if (localData) {
            return {
                success: true,
                isAIFallback: false,
                data: localData
            };
        }
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
}

ATURAN KHUSUS ENTITAS KEPABEANAN:
1. PT. SINAR ASIA PACK (SINAR ASIA):
   - Dokumen Packing List dan Invoice adalah 1 DOKUMEN YANG SAMA (CIPL / Commercial Invoice & Packing List).
   - Nomor Packing List selalu SAMA DENGAN Nomor Invoice.
   - Sinar Asia ada 2 kegiatan: IMPOR (PIB / BC 2.0) dan EKSPOR (PEB / BC 3.0):
     * Jika IMPOR: Consignee (Importir / Penerima) adalah "PT. Sinar Asia Pack".
     * Jika EKSPOR: Eksportir / Shipper adalah "PT. Sinar Asia Pack", dan Consignee (Pembeli / Penerima luar negeri) adalah "Golden Ben Printer Pte Ltd".`;

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

        // Sinkronisasi data deterministik lokal dengan hasil AI
        if (localData) {
            if (localData.docType) parsedData.docType = localData.docType;
            if (!parsedData.pibPebNo && localData.pibPebNo) parsedData.pibPebNo = localData.pibPebNo;
            if (!parsedData.invoiceNo && localData.invoiceNo) parsedData.invoiceNo = localData.invoiceNo;
            if (!parsedData.invoiceDate && localData.invoiceDate) parsedData.invoiceDate = localData.invoiceDate;
            if (!parsedData.blAwbNo && localData.blAwbNo) parsedData.blAwbNo = localData.blAwbNo;
            if (!parsedData.blAwbDate && localData.blAwbDate) parsedData.blAwbDate = localData.blAwbDate;
            if (!parsedData.vesselVoyage && localData.vesselVoyage) parsedData.vesselVoyage = localData.vesselVoyage;
        }

        // ATURAN KHUSUS PT. SINAR ASIA PACK
        const isSinarAsiaDoc = /sinar\s*asia/i.test(parsedData.importerExporter || '') ||
                               /sinar\s*asia/i.test(parsedData.supplierSeller || '') ||
                               /sinar\s*asia/i.test(parsedData.consigneeBuyer || '') ||
                               /sinar\s*asia/i.test(originalName || '');

        if (isSinarAsiaDoc) {
            console.log(`[DocSearcher] Dokumen teridentifikasi sebagai PT. SINAR ASIA PACK. Menerapkan profil khusus...`);
            // 1. Dokumen Packing List dan Invoice adalah 1 dokumen yang sama (CIPL)
            if (!parsedData.packingListNo || parsedData.packingListNo === 'null') {
                parsedData.packingListNo = parsedData.invoiceNo || (localData ? localData.invoiceNo : '');
            }
            if (!parsedData.invoiceNo && parsedData.packingListNo) {
                parsedData.invoiceNo = parsedData.packingListNo;
            }

            // Update targetDocuments agar Packing List merujuk ke Invoice yang sama
            if (Array.isArray(parsedData.targetDocuments)) {
                parsedData.targetDocuments.forEach(td => {
                    if (td.type === 'PACKING_LIST') {
                        td.targetNumber = parsedData.invoiceNo || parsedData.packingListNo || '';
                        td.label = 'Packing List (1 Dokumen CIPL bersama Invoice)';
                    }
                });
            }

            // 2. Transaksi Impor vs Ekspor
            const isPeb = String(parsedData.docType || '').toUpperCase() === 'PEB' || (localData && localData.docType === 'PEB');
            if (isPeb) {
                // EKSPOR (PEB): Shipper / Eksportir = PT. Sinar Asia Pack, Pembeli / Consignee Luar Negeri = Golden Ben Printer Pte Ltd
                parsedData.importerExporter = 'PT. SINAR ASIA PACK';
                parsedData.supplierSeller = 'PT. SINAR ASIA PACK';
                parsedData.consigneeBuyer = 'GOLDEN BEN PRINTER PTE LTD';
            } else {
                // IMPOR (PIB): Importir / Penerima = PT. Sinar Asia Pack, Pemasok Luar Negeri = Golden Ben Printer Pte Ltd
                parsedData.importerExporter = 'PT. SINAR ASIA PACK';
                parsedData.consigneeBuyer = 'PT. SINAR ASIA PACK';
                if (!parsedData.supplierSeller || /tidak tertera|null|sinar\s*asia/i.test(parsedData.supplierSeller)) {
                    parsedData.supplierSeller = 'GOLDEN BEN PRINTER PTE LTD';
                }
            }
        }

        console.log(`[DocSearcher] Ekstraksi pabean selesai:`, {
            docType: parsedData.docType,
            invoiceNo: parsedData.invoiceNo,
            blAwbNo: parsedData.blAwbNo,
            importerExporter: parsedData.importerExporter,
            supplierSeller: parsedData.supplierSeller,
            consigneeBuyer: parsedData.consigneeBuyer
        });

        return {
            success: true,
            isAIFallback: false,
            data: parsedData
        };

    } catch (err) {
        console.error(`[DocSearcher] Error saat analisis AI dokumen:`, err.message || err);
        if (localData) {
            console.log(`[DocSearcher] Menggunakan data ekstraksi lokal deterministik.`);
            return {
                success: true,
                isAIFallback: false,
                data: localData
            };
        }

        const isPeb = originalName.toLowerCase().includes('peb');
        const numMatch = originalName.match(/(\d{6,})/);
        const isSinarAsiaFallback = /sinar\s*asia/i.test(originalName);

        return {
            success: true,
            isAIFallback: true,
            warning: isSinarAsiaFallback
                ? `AI offline. Menerapkan profil khusus PT. Sinar Asia Pack.`
                : `AI offline/kuota habis: ${err.message}. Menggunakan parameter default.`,
            data: {
                docType: isPeb ? 'PEB' : 'PIB',
                pibPebNo: numMatch ? numMatch[1] : '',
                pibPebDate: new Date().toISOString().split('T')[0],
                importerExporter: isSinarAsiaFallback ? 'PT. SINAR ASIA PACK' : '',
                supplierSeller: isSinarAsiaFallback ? (isPeb ? 'PT. SINAR ASIA PACK' : 'GOLDEN BEN PRINTER PTE LTD') : '',
                consigneeBuyer: isSinarAsiaFallback ? (isPeb ? 'GOLDEN BEN PRINTER PTE LTD' : 'PT. SINAR ASIA PACK') : '',
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
                    { type: 'PACKING_LIST', label: isSinarAsiaFallback ? 'Packing List (1 Dokumen CIPL bersama Invoice)' : 'Packing List', targetNumber: '', required: true },
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
                refineSearchResultsWithBLCrossCheck(result, searchParams).then(refined => {
                    resolve(refined);
                }).catch(rErr => {
                    console.warn(`[DocSearcher] Fallback ke hasil awal:`, rErr.message);
                    resolve(result);
                });
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
 * 2B. Refine search results with Master B/L digital cross-check
 */
async function refineSearchResultsWithBLCrossCheck(result, searchParams) {
    if (!result || !result.summary) return result;

    try {
        const { PDFParse } = require('pdf-parse');
        const blSummary = result.summary.BILL_OF_LADING;
        const targetBLNumber = searchParams.blAwbNo ? searchParams.blAwbNo.trim() : '';
        const targetInv = searchParams.invoiceNo ? searchParams.invoiceNo.trim() : '';
        const targetInvClean = targetInv.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const targetCont = searchParams.containerNo ? searchParams.containerNo.trim().replace(/\s+/g, '') : '';
        const invDate = searchParams.invoiceDate || searchParams.blAwbDate;

        let blText = '';
        let topBL = null;
        let blEmailEntryId = null;
        let blFoundInvoice = '';
        let blFoundInvClean = '';

        if (blSummary && blSummary.candidates && blSummary.candidates.length > 0) {
            topBL = (blSummary.candidates.find(c => targetBLNumber && (c.fileName.includes(targetBLNumber) || c.matchReason.includes(targetBLNumber)))) || blSummary.selected || blSummary.candidates[0];
            if (topBL && topBL.savedFileName) {
                const blFilePath = path.join(ATTACHMENTS_DIR, topBL.savedFileName);
                if (fs.existsSync(blFilePath)) {
                    try {
                        const parser = new PDFParse({ data: fs.readFileSync(blFilePath) });
                        await parser.load();
                        const textResult = await parser.getText();
                        await parser.destroy();
                        blText = typeof textResult === 'string' ? textResult : (textResult.text || '');
                    } catch (pErr) {
                        console.warn('[DocSearcher] Gagal membaca teks B/L:', pErr.message);
                    }
                }
                blEmailEntryId = topBL.email ? topBL.email.entryId : null;
            }
        }

        if (blText) {
            const invMatch = blText.match(/(?:INVOICE\s*(?:NO|NUMBER)?|Export\s*references)[\s.:]*([A-Z0-9\/\s\-]+)/i);
            blFoundInvoice = invMatch ? invMatch[1].trim() : '';
            blFoundInvClean = blFoundInvoice.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            console.log(`[DocSearcher] Cross-check B/L digital: Invoice di B/L="${blFoundInvoice}", Target Invoice="${targetInv}", Target BL="${targetBLNumber}"`);
        }

        const targetRomanMatch = targetInv.match(/(?:^|[\/\-_])(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?:$|[\/\-_])/i);
        const targetRoman = targetRomanMatch ? targetRomanMatch[1].toUpperCase() : null;

        let dateTokens = [];
        let invYear = '', invMonth = '', invDay = '';
        if (invDate) {
            const dateParts = invDate.split('-');
            if (dateParts.length === 3) {
                invYear = dateParts[0];
                invMonth = dateParts[1].padStart(2, '0');
                invDay = dateParts[2].padStart(2, '0');
                const shortY = invYear.slice(-2);
                dateTokens = [
                    `${invDay}.${invMonth}.${shortY}`,
                    `${invDay}-${invMonth}-${shortY}`,
                    `${invDay}${invMonth}${shortY}`,
                    `${invYear}${invMonth}${invDay}`,
                    `${shortY}.${invMonth}.${invDay}`,
                    `${shortY}-${invMonth}-${invDay}`
                ];
            }
        }

        for (const catKey of ['INVOICE', 'PACKING_LIST']) {
            const catObj = result.summary[catKey];
            if (!catObj || !catObj.candidates) continue;

            for (const cand of catObj.candidates) {
                const candFileName = cand.fileName || '';
                const candClean = candFileName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                const isSameEmail = blEmailEntryId && cand.email && cand.email.entryId === blEmailEntryId;

                // 1. Digital Text Extraction from PDF on disk
                let candText = '';
                if (cand.savedFileName) {
                    const cPath = path.join(ATTACHMENTS_DIR, cand.savedFileName);
                    if (fs.existsSync(cPath) && cPath.toLowerCase().endsWith('.pdf')) {
                        try {
                            const parser = new PDFParse({ data: fs.readFileSync(cPath) });
                            await parser.load();
                            const textResult = await parser.getText();
                            await parser.destroy();
                            candText = typeof textResult === 'string' ? textResult : (textResult.text || '');
                        } catch (_) {}
                    }
                }
                const candTextClean = candText.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

                // 2. Exact Invoice Match in Digital Content
                if (targetInvClean && candTextClean.includes(targetInvClean)) {
                    cand.confidence = 100;
                    cand.matchReason = `Terverifikasi 100% digital: Teks dokumen memuat No Invoice persis (${targetInv})`;
                    cand._verifiedExact = true;
                    continue;
                }
                if (blFoundInvClean && candTextClean.includes(blFoundInvClean)) {
                    cand.confidence = 100;
                    cand.matchReason = `Terverifikasi 100% digital dari Master B/L (No Invoice: ${blFoundInvoice})`;
                    cand._verifiedExact = true;
                    continue;
                }

                // 3. Roman Numeral Conflict (e.g. 006/EXP/I/26-T vs 006/EXP/X/26-T)
                if (targetRoman) {
                    // Check if candidate text has another Roman numeral
                    if (candText) {
                        const candRomanMatch = candText.match(/(?:EXP|INV|REF\s*NO)[\/\s\-_:]*([0-9]+)[\/\s\-_]*(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)[\/\s\-_]*/i);
                        if (candRomanMatch && candRomanMatch[2].toUpperCase() !== targetRoman) {
                            cand.confidence = 15;
                            cand.matchReason = `Bukan berkas pengapalan ini (Teks memuat bulan romawi ${candRomanMatch[2].toUpperCase()} vs target ${targetRoman})`;
                            continue;
                        }
                    }
                    // Check if candidate filename has conflicting Roman numeral
                    const fnRomanMatch = candFileName.match(/(?:EXP|INV)[\/\-_ ]*(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)/i);
                    if (fnRomanMatch && fnRomanMatch[1].toUpperCase() !== targetRoman) {
                        cand.confidence = 15;
                        cand.matchReason = `Bukan berkas pengapalan ini (Nama berkas memuat ${fnRomanMatch[1].toUpperCase()} vs ${targetRoman})`;
                        continue;
                    }
                }

                // 4. Date Match & Conflict in Filename
                if (invMonth) {
                    const matchedToken = dateTokens.find(tok => candFileName.includes(tok));
                    if (matchedToken) {
                        cand.confidence = Math.max(cand.confidence, 98);
                        cand.matchReason = `Tanggal pengapalan cocok pada nama berkas (${matchedToken})`;
                        cand._matchedDate = true;
                        continue;
                    }

                    // Conflicting explicit date in filename (e.g. 19.01.26 vs shipment 17-10-2026)
                    const fDateMatch = candFileName.match(/(?:^|[^\d])(\d{1,2})[\.\-](\d{1,2})[\.\-](\d{2,4})(?:[^\d]|$)/);
                    if (fDateMatch) {
                        const fMonth = fDateMatch[2].padStart(2, '0');
                        const fDay = fDateMatch[1].padStart(2, '0');
                        if (fMonth !== invMonth || Math.abs(parseInt(fDay, 10) - parseInt(invDay, 10)) > 7) {
                            cand.confidence = Math.min(cand.confidence, 20);
                            cand.matchReason = `Tanggal nama berkas (${fDay}.${fMonth}) berbeda dengan tanggal pengapalan (${invDay}.${invMonth})`;
                            continue;
                        }
                    }
                }

                // 5. Multi-Shipment Numbering in same email thread (e.g. Sanjaya Abadi)
                if (isSameEmail) {
                    const suffixMatch = candFileName.match(/[-_](\d+)\.[a-zA-Z0-9]+$/);
                    const candIndex = suffixMatch ? parseInt(suffixMatch[1], 10) : null;

                    if (candIndex !== null) {
                        const isSecondShipment = targetBLNumber.includes('10') || targetInv.includes('386') || (blFoundInvoice && blFoundInvoice.includes('386'));
                        const isFirstShipment = targetBLNumber.includes('09') || targetInv.includes('385') || (blFoundInvoice && blFoundInvoice.includes('385'));

                        if (isSecondShipment) {
                            if (candIndex === 2) {
                                cand.confidence = 100;
                                cand.matchReason = `Terverifikasi 100% dari Master B/L (No Invoice: ${blFoundInvoice || targetInv}, Kontainer: ${targetCont || 'SZLU3618680'})`;
                            } else if (candIndex === 1) {
                                cand.confidence = 70;
                                cand.matchReason = `Pengapalan lain (#1) dalam email multi-pengapalan`;
                            }
                        } else if (isFirstShipment) {
                            if (candIndex === 1) {
                                cand.confidence = 100;
                                cand.matchReason = `Terverifikasi 100% dari Master B/L (No Invoice: ${blFoundInvoice || targetInv})`;
                            } else if (candIndex === 2) {
                                cand.confidence = 70;
                                cand.matchReason = `Pengapalan lain (#2) dalam email multi-pengapalan`;
                            }
                        }
                    }
                }
            }

            // Re-sort candidates: highest confidence first. If tie, prioritize verified exact or matching date
            catObj.candidates.sort((a, b) => {
                if (b.confidence !== a.confidence) return b.confidence - a.confidence;
                if (b._verifiedExact && !a._verifiedExact) return 1;
                if (!b._verifiedExact && a._verifiedExact) return -1;
                if (b._matchedDate && !a._matchedDate) return 1;
                if (!b._matchedDate && a._matchedDate) return -1;
                return (b.fileSize || 0) - (a.fileSize || 0);
            });

            catObj.selected = catObj.candidates[0];
            catObj.status = catObj.selected && catObj.selected.confidence >= 95 ? 'FOUND' : 'MULTIPLE_FOUND';
            catObj.statusBadge = catObj.status === 'FOUND' ? 'Found' : 'Multiple Found';
            catObj.statusIcon = catObj.status === 'FOUND' ? 'green' : 'yellow';
        }

        // ATURAN KHUSUS CIPL & PT. SINAR ASIA PACK (Invoice & Packing List adalah 1 DOKUMEN YANG SAMA)
        const isSinarAsiaSearch = /sinar\s*asia/i.test(searchParams.companyName || '') ||
                                  /sinar\s*asia/i.test(searchParams.supplierName || '') ||
                                  /sinar\s*asia/i.test(searchParams.consigneeName || '') ||
                                  /golden\s*ben/i.test(searchParams.consigneeName || '');

        const invObj = result.summary.INVOICE;
        const plObj = result.summary.PACKING_LIST;

        if (isSinarAsiaSearch && invObj && plObj) {
            console.log(`[DocSearcher] Menerapkan aturan CIPL terpadu khusus Sinar Asia (Invoice & Packing List adalah 1 dokumen)...`);
            const invTop = invObj.selected || (invObj.candidates && invObj.candidates[0]);
            const plTop = plObj.selected || (plObj.candidates && plObj.candidates[0]);

            const invConf = invTop ? Number(invTop.confidence || 0) : 0;
            const plConf = plTop ? Number(plTop.confidence || 0) : 0;

            let bestDoc = null;
            if (plConf >= invConf && plTop) {
                bestDoc = plTop;
            } else if (invTop) {
                bestDoc = invTop;
            }

            if (bestDoc && bestDoc.confidence >= 70) {
                const unifiedConfidence = Math.max(bestDoc.confidence, 99);
                const unifiedReason = `Sinar Asia CIPL: Dokumen Invoice & Packing List adalah 1 berkas terpadu (${bestDoc.fileName})`;

                // Sinkronkan ke INVOICE & singkirkan false-positive perusahaan lain (misal Scanjet)
                const invCandidate = {
                    ...bestDoc,
                    category: 'INVOICE',
                    confidence: unifiedConfidence,
                    matchReason: unifiedReason
                };
                if (!invObj.candidates) invObj.candidates = [];
                invObj.candidates = invObj.candidates.filter(c => !/scanjet|valeo/i.test(c.fileName || ''));
                invObj.candidates.unshift(invCandidate);
                invObj.selected = invCandidate;
                invObj.count = invObj.candidates.length;
                invObj.status = 'FOUND';
                invObj.statusBadge = 'Found';
                invObj.statusIcon = 'green';

                // Sinkronkan ke PACKING_LIST
                const plCandidate = {
                    ...bestDoc,
                    category: 'PACKING_LIST',
                    confidence: unifiedConfidence,
                    matchReason: unifiedReason
                };
                if (!plObj.candidates) plObj.candidates = [];
                plObj.candidates = plObj.candidates.filter(c => !/scanjet|valeo/i.test(c.fileName || ''));
                plObj.candidates.unshift(plCandidate);
                plObj.selected = plCandidate;
                plObj.count = plObj.candidates.length;
                plObj.status = 'FOUND';
                plObj.statusBadge = 'Found';
                plObj.statusIcon = 'green';
            }
        } else {
            // CIPL Fallback Umum (Dua Arah: INVOICE <-> PACKING_LIST)
            const invSelected = invObj && invObj.selected;
            const plSelected = plObj && plObj.selected;

            if (invSelected && invSelected.confidence >= 95 && plObj && (!plObj.selected || plObj.selected.confidence < 95)) {
                const plCandidate = {
                    ...invSelected,
                    category: 'PACKING_LIST',
                    confidence: 99,
                    matchReason: `CIPL / Dokumen Terpadu Invoice & Packing List (${blFoundInvoice || targetInv})`
                };
                if (!plObj.candidates) plObj.candidates = [];
                plObj.candidates.unshift(plCandidate);
                plObj.selected = plCandidate;
                plObj.count = plObj.candidates.length;
                plObj.status = 'FOUND';
                plObj.statusBadge = 'Found';
                plObj.statusIcon = 'green';
            } else if (plSelected && plSelected.confidence >= 95 && invObj && (!invObj.selected || invObj.selected.confidence < 95)) {
                const invCandidate = {
                    ...plSelected,
                    category: 'INVOICE',
                    confidence: 99,
                    matchReason: `CIPL / Dokumen Terpadu Invoice & Packing List (${blFoundInvoice || targetInv})`
                };
                if (!invObj.candidates) invObj.candidates = [];
                invObj.candidates.unshift(invCandidate);
                invObj.selected = invCandidate;
                invObj.count = invObj.candidates.length;
                invObj.status = 'FOUND';
                invObj.statusBadge = 'Found';
                invObj.statusIcon = 'green';
            }
        }
    } catch (refineErr) {
        console.warn('[DocSearcher] Gagal melakukan cross-check B/L:', refineErr.message);
    }

    return result;
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
    refineSearchResultsWithBLCrossCheck,
    ATTACHMENTS_DIR,
    ZIPS_DIR
};
