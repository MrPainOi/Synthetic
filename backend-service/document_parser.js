require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(res => setTimeout(res, ms));

// Inisialisasi Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function parseDocuments(pdfPaths) {
    console.log(`Memproses ${pdfPaths.length} dokumen sekaligus...`);
    
    try {
        const fileManager = ai.files;
        const uploadResults = [];
        const uploadedMeta = [];
        
        // Upload semua file ke Gemini
        for (const pdfPath of pdfPaths) {
            const fileName = path.basename(pdfPath);
            console.log(`Mengunggah: ${fileName}`);
            const uploadResult = await fileManager.upload({
                file: pdfPath,
                mimeType: 'application/pdf',
            });
            uploadResults.push(uploadResult);
            uploadedMeta.push({ fileName, uri: uploadResult.uri, mimeType: uploadResult.mimeType });
        }
        console.log(`Semua file berhasil diunggah.`);

        const fileNamesList = uploadedMeta.map((f, i) => `${i + 1}. [File ${i + 1}]: "${f.fileName}"`).join('\n');

        const prompt = `Kamu adalah sistem ahli kepabeanan Indonesia (PPJK) dan verifikator dokumen ekspor/impor yang sangat teliti dan kritis.
Berikut daftar file dokumen yang terlampir:
${fileNamesList}

TUGAS UTAMA:
1. SAFECHECK (VALIDASI RELEVANSI ANTAR-DOKUMEN):
   Lakukan analisis perbandingan dan cross-check secara ketat: apakah SEMUA dokumen di atas memang saling berhubungan dan merupakan SATU KESATUAN PENGIRIMAN (satu shipment yang sama)?
   - Periksa konsistensi nomor: No. Invoice, No. Packing List (PL), No. Bill of Lading (B/L / Sea Waybill), No. PO/Kontrak, No. Kontainer / Seal.
   - Periksa kesesuaian Shipper (Eksportir/Pengirim) dan Consignee (Importir/Penerima) di setiap dokumen.
   - Periksa kesesuaian rute (Pelabuhan Muat & Pelabuhan Bongkar), tanggal pengapalan, dan jenis komoditas barang.
   - Tentukan apakah ada dokumen yang ASING, SALAH LAMPIR, atau dari PENGIRIMAN/TRANSAKSI BERBEDA.

2. EKSTRAKSI & MERGE DATA:
   Ekstrak informasi penting secara LENGKAP persis seperti teks aslinya, jangan bulatkan angka, jangan hilangkan koma, titik, atau detail apapun. Jika tidak ditemukan, isi null.

Kembalikan HANYA format JSON murni tanpa markdown/backticks (\`\`\`json):
{
  "safeCheck": {
    "isRelated": true, // WAJIB boolean: true jika SEMUA dokumen valid & 1 shipment. false jika ada dokumen yang tidak cocok/beda shipment/asing
    "confidenceScore": 95, // Angka 0 - 100
    "summary": "Ringkasan penjelasan hasil safecheck dalam bahasa Indonesia (jelaskan mengapa dokumen cocok atau jika ada indikasi tidak nyambung)",
    "matchedIdentifiers": [
      "Contoh: Nomor Invoice 98007728 cocok antara Commercial Invoice dan Packing List",
      "Contoh: Shipper PT. ABC dan Consignee XYZ terkonfirmasi sama di semua dokumen"
    ],
    "discrepanciesOrWarnings": [
      // Isi daftar jika ada ketidaksesuaian nomor, perbedaan nama/alamat pihak, atau dokumen yang patut dicurigai tidak berhubungan
    ],
    "documentList": [
      {
        "fileName": "Nama file dokumen sesuai daftar di atas",
        "documentType": "INVOICE / PACKING_LIST / BILL_OF_LADING / CERTIFICATE / OTHER",
        "belongsToShipment": true, // true jika dokumen ini bagian dari shipment, false jika tidak relevan/berbeda
        "notes": "Penjelasan singkat isi/fungsi dokumen ini"
      }
    ]
  },
  "blNumber": "Nomor Bill of Lading / B/L / Sea Waybill",
  "blDate": "Tanggal Bill of Lading / Shipped on Board Date",
  "invoiceNumber": "Nomor Commercial Invoice (pisahkan koma jika multi-invoice)",
  "invoiceDate": "Tanggal Invoice",
  "packingListNumber": "Nomor Packing List / PL jika ada",
  "packingListDate": "Tanggal Packing List jika ada",
  "containerNumber": "Nomor Kontainer / Peti Kemas (pisahkan koma jika lebih dari satu)",
  "shipperName": "Nama Lengkap Eksportir",
  "shipperAddress": "Alamat Lengkap Eksportir persis di dokumen",
  "consigneeName": "Nama Lengkap Penerima",
  "consigneeAddress": "Alamat Lengkap Penerima persis di dokumen",
  "loadingPort": "Pelabuhan Muat",
  "dischargePort": "Pelabuhan Bongkar",
  "totalKemasan": "Total jenis & jumlah kemasan dari dokumen (KHUSUS dokumen VALEO: baca Grand Total kemasan dari Packing List, utamakan jumlah box/kemasan barang, misal: '816 BOXES' atau '7 PALLETS = 816 BOXES')",
  "totalGrossWeightKGM": "Total berat kotor (tulis persis)",
  "totalNetWeightKGM": "Total berat bersih (tulis persis)",
  "items": [
    {
      "uraianJenisBarang": "Nama atau deskripsi komoditas barang SAJA (WAJIB HAPUS dan JANGAN sertakan part number maupun customer part no seperti (575000 / W000103691). Contoh: VS TMEAO FBP AIO with Logo 350mm 14\")",
      "jumlahDanSatuanBarang": "Misal: 3,975 PC",
      "kemasan": "Jumlah dan jenis kemasan barang ini. KHUSUS dokumen VALEO: nilainya SAMA SEMUA untuk seluruh baris barang, yaitu diambil dari Grand Total Packing List (misal: '816 BOX')",
      "beratBersih": "Net weight baris barang",
      "beratKotor": "Gross weight baris barang",
      "amount": "Total harga untuk baris barang ini"
    }
  ]
}

PENTING:
- Pada 'uraianJenisBarang': HANYA tuliskan nama atau uraian komoditas barangnya saja. JANGAN sertakan nomor part (part no) maupun customer part no (misal jangan sertakan angka dalam kurung seperti (575000 / W000103691)).
- ATURAN KEMASAN BARANG (KHUSUS & HANYA UNTUK DOKUMEN PT. VALEO AC INDONESIA):
  PERHATIAN: Aturan ini HANYA BERLAKU EKSKLUSIF untuk dokumen dari eksportir/shipper VALEO (PT. VALEO AC INDONESIA). JANGAN terapkan pada eksportir lain!
  Khusus dokumen Valeo, nilai kemasan untuk SETIAP baris barang di dalam list ('items') nilainya SAMA SEMUA per Packing List, BUKAN per baris atau dibagi-bagi!
  Cara melihatnya: baca baris Grand Total kemasan pada Packing List (misal jika di baris Grand Total PL tertulis '816 BOXES', maka SEMUA baris barang kemasannya diisi '816 BOX').
  Dan pada 'totalKemasan', WAJIB cantumkan total kemasan dari Packing List tersebut (misal: '816 BOXES' atau '7 PALLETS = 816 BOXES').
- ATURAN BERAT BARANG (KHUSUS & HANYA UNTUK DOKUMEN PT. SINAR ASIA PACK):
  PERHATIAN: Aturan ini HANYA BERLAKU EKSKLUSIF untuk dokumen dari eksportir/shipper SINAR ASIA (PT. SINAR ASIA PACK). JANGAN terapkan pada dokumen dari perusahaan lain!
  Khusus dokumen Sinar Asia, Packing List tidak merinci berat kotor dan bersih per barang, melainkan hanya mencantumkan Total Weight.
  HANYA untuk dokumen Sinar Asia, hitung berat per baris barang dengan MEMBAGI Total Weight tersebut secara merata dengan jumlah baris barang (items).
  Contoh: Total Weight = 1,000 KGS dan terdapat 2 baris barang, maka masing-masing baris barang diisi:
  "beratBersih": "500.00 KGS",
  "beratKotor": "500.00 KGS" (1000 / 2 = 500).
  Dan jika 'totalNetWeightKGM' tidak tercantum di dokumen Sinar Asia, isi nilainya sama dengan 'totalGrossWeightKGM'.
  Untuk dokumen eksportir lain (selain Sinar Asia), WAJIB ekstrak berat kotor dan bersih persis dari dokumen aslinya tanpa dibagi.
- JANGAN membulatkan angka. Jika ada dokumen yang sama sekali tidak berhubungan, tetap isi data shipment utama yang sah dan laporkan secara tegas di safeCheck.`;

        let result;
        let attempt = 0;
        let maxRetries = 5;
        let modelsToTry = ['gemini-3.6-flash', 'gemini-3.6-flash', 'gemini-3.6-flash', 'gemini-3.6-flash', 'gemini-3.6-flash'];

        while (attempt < maxRetries) {
            let modelName = modelsToTry[attempt];
            try {
                console.log(`Mencoba ekstraksi & safecheck dengan model: ${modelName} (Percobaan ${attempt + 1}/${maxRetries})...`);
                
                // Susun array parts (menggabungkan semua file + prompt teks)
                const requestParts = uploadResults.map(uploadRes => ({
                    fileData: { fileUri: uploadRes.uri, mimeType: uploadRes.mimeType }
                }));
                requestParts.push({ text: prompt });

                result = await ai.models.generateContent({
                    model: modelName,
                    contents: [
                        {
                            role: 'user',
                            parts: requestParts
                        }
                    ]
                });
                break; // Keluar loop jika sukses
            } catch (apiErr) {
                console.error(`  -> Gagal pada percobaan ${attempt + 1} (${modelName}):`, apiErr.message);
                attempt++;
                if (attempt >= maxRetries) {
                    throw new Error("Gagal mengekstrak dokumen setelah " + maxRetries + " kali percobaan karena server Google sedang sibuk.");
                }
                console.log(`  -> Menunggu 10 detik sebelum mencoba lagi...`);
                await delay(10000); // Tunggu 10 detik agar server API lebih lega
            }
        }
        let jsonText = result.text;
        // Membersihkan markdown jika model mengembalikannya
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const parsedData = JSON.parse(jsonText);

        // Filter / bersihkan part number dan customer part number dari uraianJenisBarang jika ada
        if (Array.isArray(parsedData.items)) {
            parsedData.items.forEach(item => {
                if (item.uraianJenisBarang) {
                    item.uraianJenisBarang = item.uraianJenisBarang
                        .replace(/\s*\(\s*[A-Za-z0-9]+\s*\/\s*[A-Za-z0-9]+\s*\)/g, '')
                        .trim();
                }
            });
        }

        // Auto-alokasi berat barang HANYA KHUSUS untuk dokumen SINAR ASIA (PT. SINAR ASIA PACK)
        const isSinarAsia = Boolean(
            (parsedData.shipperName && /sinar\s*asia/i.test(parsedData.shipperName)) ||
            (parsedData.safeCheck?.matchedIdentifiers && parsedData.safeCheck.matchedIdentifiers.some(m => /sinar\s*asia/i.test(m))) ||
            (parsedData.safeCheck?.summary && /sinar\s*asia/i.test(parsedData.safeCheck.summary))
        );

        if (isSinarAsia && Array.isArray(parsedData.items) && parsedData.items.length > 0) {
            const itemCount = parsedData.items.length;
            const hasMissingWeights = parsedData.items.some(item => 
                !item.beratBersih || !item.beratKotor || item.beratBersih === 'null' || item.beratKotor === 'null'
            );

            if (hasMissingWeights) {
                const rawTotal = parsedData.totalGrossWeightKGM || parsedData.totalNetWeightKGM || '';
                const cleanTotalStr = String(rawTotal).replace(/,/g, '');
                const match = cleanTotalStr.match(/([\d.]+)\s*([A-Za-z]+)?/);

                if (match) {
                    const totalVal = parseFloat(match[1]);
                    const unit = match[2] || 'KGS';
                    if (!isNaN(totalVal) && totalVal > 0) {
                        const divided = (totalVal / itemCount).toFixed(2);
                        const allocatedWeight = `${divided} ${unit}`;
                        console.log(`[Eksklusif Sinar Asia] Total ${totalVal} ${unit} dibagi ${itemCount} barang = ${allocatedWeight} per baris.`);

                        parsedData.items.forEach(item => {
                            if (!item.beratBersih || item.beratBersih === 'null') {
                                item.beratBersih = allocatedWeight;
                            }
                            if (!item.beratKotor || item.beratKotor === 'null') {
                                item.beratKotor = allocatedWeight;
                            }
                        });

                        if (!parsedData.totalNetWeightKGM && parsedData.totalGrossWeightKGM) {
                            parsedData.totalNetWeightKGM = parsedData.totalGrossWeightKGM;
                        } else if (!parsedData.totalGrossWeightKGM && parsedData.totalNetWeightKGM) {
                            parsedData.totalGrossWeightKGM = parsedData.totalNetWeightKGM;
                        }
                    }
                }
            }
        }

        // ATURAN KHUSUS VALEO (PT. VALEO AC INDONESIA):
        // Kemasan semua baris barang nilainya SAMA per Packing List, diambil dari total kemasan PL (misal: 816 BOX)
        const isValeo = Boolean(
            (parsedData.shipperName && /valeo/i.test(parsedData.shipperName)) ||
            (parsedData.safeCheck?.matchedIdentifiers && parsedData.safeCheck.matchedIdentifiers.some(m => /valeo/i.test(m))) ||
            (parsedData.safeCheck?.summary && /valeo/i.test(parsedData.safeCheck.summary))
        );

        if (isValeo && Array.isArray(parsedData.items) && parsedData.items.length > 0) {
            let valeoPack = '';
            for (const it of parsedData.items) {
                if (it.kemasan && /\d+/.test(it.kemasan)) {
                    valeoPack = it.kemasan;
                    break;
                }
            }
            if (!valeoPack && parsedData.totalKemasan) {
                const boxMatch = String(parsedData.totalKemasan).match(/([\d.,]+)\s*(BOX|BOXES|BX|CTN|CARTON|CARTONS)/i);
                if (boxMatch) {
                    valeoPack = `${boxMatch[1]} BOX`;
                } else {
                    const numMatch = String(parsedData.totalKemasan).match(/([\d.,]+)/);
                    valeoPack = numMatch ? `${numMatch[1]} BOX` : parsedData.totalKemasan;
                }
            }
            if (valeoPack) {
                parsedData.items.forEach(it => {
                    it.kemasan = valeoPack;
                });
            }
        } else if (Array.isArray(parsedData.items) && parsedData.items.length > 0) {
            // Auto-alokasi kemasan per baris barang jika belum terisi oleh AI (Non-Valeo)
            const missingKemasan = parsedData.items.some(i => !i.kemasan);
            if (missingKemasan) {
                const totalKemasanStr = String(parsedData.totalKemasan || '').trim();
                const countMatch = totalKemasanStr.match(/(\d+[\d.,]*)\s*([A-Za-z]+)?/);
                let totalCount = countMatch ? parseFloat(countMatch[1].replace(/,/g, '')) : 0;
                let packType = 'BX';
                if (/pallet|plt/i.test(totalKemasanStr)) packType = 'PLT';
                else if (/box|boxes|bx/i.test(totalKemasanStr)) packType = 'BOX';
                else if (/package|pkg|pk/i.test(totalKemasanStr)) packType = 'PKG';
                else if (/carton|ctn|ct/i.test(totalKemasanStr)) packType = 'CTN';
                else if (countMatch && countMatch[2]) packType = countMatch[2].toUpperCase();

                if (parsedData.items.length === 1 && totalCount > 0) {
                    parsedData.items[0].kemasan = `${totalCount} ${packType}`;
                } else if (totalCount > 0 && totalCount >= parsedData.items.length) {
                    let sumQty = 0;
                    parsedData.items.forEach(it => {
                        const q = parseFloat(String(it.jumlahDanSatuanBarang || '').replace(/[^0-9.]/g, '')) || 0;
                        sumQty += q;
                    });
                    let remaining = totalCount;
                    parsedData.items.forEach((it, idx) => {
                        if (it.kemasan) return;
                        if (idx === parsedData.items.length - 1) {
                            it.kemasan = `${Math.max(1, Math.round(remaining))} ${packType}`;
                        } else {
                            const q = parseFloat(String(it.jumlahDanSatuanBarang || '').replace(/[^0-9.]/g, '')) || 0;
                            const alloc = sumQty > 0 ? Math.round((q / sumQty) * totalCount) : Math.floor(totalCount / parsedData.items.length);
                            const finalAlloc = Math.max(1, alloc);
                            it.kemasan = `${finalAlloc} ${packType}`;
                            remaining -= finalAlloc;
                        }
                    });
                } else {
                    parsedData.items.forEach(it => {
                        if (!it.kemasan) it.kemasan = `1 ${packType}`;
                    });
                }
            }
        }
        
        // Log status safecheck di terminal
        if (parsedData.safeCheck) {
            console.log("\n=======================================================");
            console.log("             HASIL SAFECHECK DOKUMEN                   ");
            console.log("=======================================================");
            if (parsedData.safeCheck.isRelated) {
                console.log(` STATUS : [VALID / SALING BERHUBUNGAN]`);
                console.log(` Skor Keyakinan : ${parsedData.safeCheck.confidenceScore || 100}%`);
            } else {
                console.warn(` PERINGATAN : [TIDAK BERHUBUNGAN / ADA DOKUMEN ASING]`);
                console.warn(` Skor Keyakinan : ${parsedData.safeCheck.confidenceScore || 0}%`);
            }
            console.log(` Ringkasan      : ${parsedData.safeCheck.summary}`);
            if (parsedData.safeCheck.matchedIdentifiers && parsedData.safeCheck.matchedIdentifiers.length > 0) {
                console.log(` Indikator Cocok:`);
                parsedData.safeCheck.matchedIdentifiers.forEach(m => console.log(`   - ${m}`));
            }
            if (parsedData.safeCheck.discrepanciesOrWarnings && parsedData.safeCheck.discrepanciesOrWarnings.length > 0) {
                console.warn(` Temuan Selisih / Catatan:`);
                parsedData.safeCheck.discrepanciesOrWarnings.forEach(w => console.warn(`   ! ${w}`));
            }
            console.log("=======================================================\n");
        }

        // Simpan hasil draft PEB
        const filename = 'Combined_Draft_' + Date.now() + '.json';
        const draftPath = path.join(__dirname, 'temp', 'drafts', filename);
        fs.writeFileSync(draftPath, JSON.stringify(parsedData, null, 2));
        
        console.log(`Berhasil mengekstrak data! Tersimpan di: ${draftPath}`);
        return parsedData;

    } catch (err) {
        console.error('Error saat ekstraksi dokumen:', err.message || err);
    }
}

// Untuk tes lokal
if (require.main === module) {
    (async () => {
        const attachDir = path.join(__dirname, 'temp', 'attachments');
        const files = fs.readdirSync(attachDir).filter(f => f.endsWith('.pdf'));
        
        if (files.length > 0) {
            console.log(`Ditemukan ${files.length} dokumen PDF di folder temp/attachments.`);
            // Gabungkan path lengkap
            const pdfPaths = files.map(file => path.join(attachDir, file));
            
            // Proses SEMUA file sekaligus sebagai satu shipment
            await parseDocuments(pdfPaths);
            console.log("---------------------------------------------------");
            console.log("Proses ekstraksi multi-dokumen selesai.");
        } else {
            console.log("Tidak ada file PDF di folder temp/attachments untuk dites.");
        }
    })();
}

module.exports = { parseDocuments };
