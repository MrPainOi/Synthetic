require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'temp', 'btki_cache.json');

// Pastikan folder temp ada
fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('[BTKI-CACHE] Gagal membaca file cache:', e.message);
    }
    return {};
}

function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
        console.warn('[BTKI-CACHE] Gagal menyimpan file cache:', e.message);
    }
}

async function lookupHsCode(query, customApiKey = null) {
    if (!query || !query.trim()) {
        throw new Error('Query komoditas atau HS Code tidak boleh kosong.');
    }

    const cleanQuery = query.trim().toLowerCase();
    const cache = loadCache();

    // Cek cache dulu
    if (cache[cleanQuery]) {
        console.log(`[BTKI-LOOKUP] Hit cache untuk query: "${cleanQuery}"`);
        return cache[cleanQuery];
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY belum dikonfigurasi di server backend.');
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    const prompt = `Anda adalah Spesialis Klasifikasi Tarif Kepabeanan Indonesia (BTKI 2022/2027) dan Regulasi LARTAS Impor/Ekspor (Permendag No. 36/2023 jo. No. 8/2024 dan instansi teknis terkait).

TUGAS:
Klasifikasikan komoditas berikut ke dalam Pos Tarif HS Code 8-digit BTKI resmi Indonesia:
"${query}"

KEMBALIKAN HANYA SATU OBJEK JSON VALID (tanpa markdown, murni JSON teks saja) dengan format:
{
  "hsCode": "8522.90.91",
  "formattedCode": "8522.90.91",
  "bab": "85",
  "babTitle": "Judul Bab Resmi BTKI",
  "uraianId": "Uraian spesifik barang dalam Bahasa Indonesia resmi BTKI",
  "uraianEn": "Official goods description in English BTKI",
  "satuan": "PCE",
  "bmMfn": 0,
  "bmPreferensi": { "atiga": "0% (Form D)", "acfta": "0% (Form E)", "rcep": "0%" },
  "ppn": 11,
  "pphApi": 2.5,
  "pphNonApi": 7.5,
  "beaKeluar": "0%",
  "lartasImpor": false,
  "lartasKategori": "BEBAS TATA NIAGA (POST BORDER / TIDAK ADA LARTAS)",
  "lartasInstansi": "-",
  "lartasDasarHukum": "-",
  "lartasDokumen": [],
  "lartasEkspor": false,
  "keywords": ["kata_kunci1", "kata_kunci2"],
  "inswWebUrl": "https://www.insw.go.id/intr/detail-komoditas"
}

=== ATURAN HIERARKI KLASIFIKASI BTKI (WAJIB IKUTI URUTAN INI) ===

LANGKAH 1 - CEK APAKAH BARANG ADALAH PARTS/ACCESSORIES UNTUK PERALATAN TERTENTU:
Jika barang adalah BAGIAN, KOMPONEN, AKSESORI, atau PANEL KONTROL yang dirancang SEMATA-MATA
untuk digunakan bersama peralatan audio/video/broadcast/kamera/komputer, gunakan pos PARTS:

  - Pos 8522.90.91 = Parts & accessories untuk peralatan video/audio recording/playback/broadcast:
    * Panel kontrol hardware untuk video switcher (misal: ATEM Advanced Panel, DaVinci Panel)
    * Control surface untuk broadcast/editing equipment
    * Converter audio/video (SDI to Audio, UpDownCross, dll)
    * PCB, LCD display, enclosure yang merupakan komponen/sparepart peralatan video
    * Aksesoris kamera video/kamera siaran
  - Pos 8529 = Parts untuk peralatan transmisi radio/TV (antenna, tuner, modul RF)
  - Pos 8473 = Parts untuk peralatan komputer/printer
  - Pos 8466 = Parts untuk mesin perkakas (jig, fixture, PCB router pallet)
  - Pos 8503 = Parts untuk motor/generator
  - Pos 8542.90 = Parts untuk sirkuit terpadu/IC (komponen elektronik pasif/aktif kecil)

LANGKAH 2 - KABEL DAN KAWAT LISTRIK (POS 8544) — BACA DENGAN SEKSAMA:
Pos 8544 mencakup kawat, kabel berisolasi, dan konduktor listrik lainnya.
PEMBEDAAN KRITIS yang sering salah:

  a) KABEL DENGAN KONEKTOR (sudah terpasang plug/socket/terminal di ujung):
     → 8544.42.xx — tegangan ≤ 1.000 V, dilengkapi konektor
     Contoh: power cord dengan steker, kabel data dengan USB/RJ45, extension cord siap pakai

  b) KABEL TANPA KONEKTOR (raw wire/cable, bahan baku produksi, belum ada konektor):
     → 8544.49.xx — tegangan ≤ 1.000 V, TIDAK dilengkapi konektor
     → 8544.49.95.00 untuk kabel tembaga berisolasi lainnya tanpa konektor
     Contoh: gulungan kabel tembaga berisolasi, kawat listrik curah, bahan baku kabel pabrik
     PENTING: Jika konteks pengirim adalah PABRIK KABEL (misal PT Volex, pabrik manufaktur)
     yang mengimpor bahan baku untuk dirakit, kemungkinan besar ini 8544.49.xx (tanpa konektor)

  c) KABEL KOAKSIAL → 8544.20.xx
  d) KABEL KENDARAAN/WIRING HARNESS → 8544.30.xx
  e) KAWAT LILITAN (WINDING WIRE, tembaga enamel) → 8544.11.00
  f) KAWAT/KABEL TEGANGAN TINGGI > 1.000V → 8544.60.xx
  g) KABEL SERAT OPTIK → 8544.70.00

LANGKAH 3 - JIKA BUKAN KABEL DAN BUKAN PARTS, FUNGSI MANDIRI:
  - Video switcher/production switcher mandiri → 8525.xx
  - Kamera digital/video broadcast → 8525.80.xx
  - Monitor/display video → 8528.xx
  - Peralatan jaringan data → 8517.xx
  - Mesin cuci rumah tangga → 8450.xx
  - Peralatan listrik fungsi mandiri lainnya (TERAKHIR) → 8543.70.xx

LANGKAH 4 - 8543.70 HANYA JIKA:
Barang BUKAN kabel, BUKAN parts/accessories, memiliki fungsi mandiri penuh, DAN tidak ada
pos tarif lebih spesifik di atas.

=== CONTOH KLASIFIKASI BENAR (BERDASARKAN INVOICE RESMI PT BLACKMAGIC DESIGN MFG) ===
- "ATEM 1 M/E Advanced Panel 20" → 8522.90.91 (panel kontrol untuk ATEM switcher = aksesori)
- "ATEM 2 M/E Advanced Panel 20" → 8522.90.91 (sama, control surface)
- "DaVinci Resolve Micro Panel" → 8522.90.91 (control surface untuk editing)
- "DaVinci Resolve Speed Editor" → 8522.90.91 (aksesori editing)
- "Mini Converter - SDI to Audio" → 8522.90.91 (converter = aksesori video)
- "Mini Converter - UpDownCross HD" → 8522.90.91 (converter = aksesori)
- "Blackmagic Cinema Camera 6K" → 8525.80.xx (kamera mandiri)
- "ATEM 4 M/E Constellation 4K Plus" → 8525.xx (video switcher mandiri penuh)
- "Enclosure - ATEM Mini Pro Top" → 8471.60.90 (casing/enclosure untuk perangkat komputer)
- "Router Pallet PCB" → 8466.10.90 (jig/pallet untuk mesin CNC = parts mesin perkakas)
- "Reg Sw 24V 30A - AOZ2369" → 8542.90.00 (IC/komponen elektronik)

=== CONTOH KLASIFIKASI BENAR — KABEL (POS 8544) ===
- "CABLE" dari pabrik kabel (PT Volex, manufaktur) → 8544.49.95.00 (raw cable tanpa konektor = bahan baku)
- "Power Cord" / "AC Power Cord" → 8544.42.xx (kabel dengan steker/konektor = produk jadi)
- "Cable Assembly" dengan konektor terpasang → 8544.42.99 (assembly dengan konektor)
- "Wiring Harness" untuk kendaraan → 8544.30.xx (set kabel kendaraan)
- "Coaxial Cable" / "RF Cable" → 8544.20.xx (kabel koaksial)
- "Winding Wire" / kawat tembaga enamel → 8544.11.00 (kawat lilitan dari tembaga)
- "Optical Fiber Cable" → 8544.70.00 (serat optik)
- "High Voltage Cable" > 1kV → 8544.60.xx

ATURAN PENTING LAINNYA:
- "hsCode" gunakan format BTKI dengan titik (misal '8522.90.91'), bukan tanpa titik.
- "bmMfn" berupa angka persentase saja (0, 5, 10, dst).
- "ppn" standar 11 atau 12. "pphApi" 2.5, "pphNonApi" 7.5.
- "lartasImpor" = true HANYA jika ada ketentuan LARTAS impor resmi dari kementerian teknis.
- Jika bebas LARTAS: "lartasKategori": "BEBAS TATA NIAGA (POST BORDER / TIDAK ADA LARTAS)", "lartasInstansi": "-", "lartasDokumen": [].`;

    const modelsToTry = [
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-3.6-flash'
    ];

    let lastError = null;
    let jsonText = '';

    for (const modelName of modelsToTry) {
        try {
            console.log(`[BTKI-LOOKUP] Menjalankan klasifikasi untuk "${query}" dengan model ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt
            });

            jsonText = response.text || '';
            jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
            if (jsonText) break;
        } catch (err) {
            console.warn(`[BTKI-LOOKUP] Model ${modelName} gagal:`, err.message);
            lastError = err;
        }
    }

    if (!jsonText) {
        throw new Error('Gagal mendapatkan respon dari AI: ' + (lastError?.message || 'Unknown error'));
    }

    const result = JSON.parse(jsonText);

    // Simpan ke cache
    cache[cleanQuery] = result;
    if (result.hsCode) {
        const hsClean = result.hsCode.replace(/[^0-9]/g, '');
        cache[hsClean] = result;
    }
    saveCache(cache);

    console.log(`[BTKI-LOOKUP] Berhasil mengklasifikasikan: ${result.formattedCode} - ${result.uraianId}`);
    return result;
}

module.exports = { lookupHsCode, loadCache };
