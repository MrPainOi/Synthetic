/**
 * BTKI HS Code Database Service (SQLite-based)
 * Menyediakan pencarian dan lookup HS Code dari database lokal
 * dengan fallback ke Gemini AI untuk detail tarif Indonesia.
 */

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'temp', 'hscode.db');
const CACHE_FILE = path.join(__dirname, 'temp', 'btki_cache.json');

// Pastikan folder temp ada
fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });

// =====================================================================
// Database Connection (lazy init)
// =====================================================================
let _db = null;

function getDb() {
    if (_db) return _db;
    if (!fs.existsSync(DB_PATH)) return null;
    try {
        _db = new Database(DB_PATH, { readonly: true });
        _db.pragma('journal_mode = WAL');
        return _db;
    } catch (e) {
        console.warn('[HSCODE-DB] Gagal membuka database:', e.message);
        return null;
    }
}

// =====================================================================
// Cache JSON (untuk hasil AI)
// =====================================================================
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

// =====================================================================
// Pencarian di database SQLite
// =====================================================================

/**
 * Cari HS Code berdasarkan kode eksak (2/4/6/8/10 digit)
 */
function searchByCode(code) {
    const db = getDb();
    if (!db) return null;
    const cleanCode = String(code).replace(/\D/g, '');
    return db.prepare('SELECT * FROM hscode WHERE code = ?').get(cleanCode);
}

/**
 * Cari HS Code berdasarkan teks (Full-Text Search)
 * Kembalikan top 10 hasil
 */
function searchByText(query, limit = 20) {
    const db = getDb();
    if (!db) return [];
    
    try {
        // Coba FTS terlebih dahulu
        const ftsResults = db.prepare(`
            SELECT h.* FROM hscode h
            JOIN hscode_fts f ON h.id = f.rowid
            WHERE hscode_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        `).all(`"${query.replace(/"/g, '')}"*`, limit);
        
        if (ftsResults.length > 0) return ftsResults;
    } catch (e) {
        // Fallback ke LIKE jika FTS gagal
    }
    
    // Fallback: LIKE search pada description_en dan description_id
    const likeQuery = `%${query}%`;
    return db.prepare(`
        SELECT * FROM hscode
        WHERE (description_en LIKE ? OR description_id LIKE ? OR code LIKE ?)
        AND code_level >= 6
        ORDER BY code_level ASC, code ASC
        LIMIT ?
    `).all(likeQuery, likeQuery, likeQuery, limit);
}

/**
 * Cari semua HS Code dalam satu chapter
 */
function getChapterCodes(chapterNum, level = 6) {
    const db = getDb();
    if (!db) return [];
    const ch = String(chapterNum).padStart(2, '0');
    return db.prepare(`
        SELECT * FROM hscode
        WHERE chapter = ? AND code_level = ?
        ORDER BY code ASC
    `).all(ch, level);
}

/**
 * Autocomplete: Cari suggestions berdasarkan prefix kode atau kata
 */
function autocomplete(query, limit = 10) {
    const db = getDb();
    if (!db) return [];
    
    const cleanQuery = query.replace(/\D/g, '');
    
    // Jika terlihat seperti kode angka
    if (cleanQuery.length >= 2 && /^\d+$/.test(query.trim())) {
        return db.prepare(`
            SELECT code, code_formatted, description_en, description_id, chapter, chapter_title_id, bm_mfn, code_level
            FROM hscode
            WHERE code LIKE ? AND code_level >= 6
            ORDER BY code_level ASC, code ASC
            LIMIT ?
        `).all(`${cleanQuery}%`, limit);
    }
    
    // Cari berdasarkan deskripsi
    return searchByText(query, limit);
}

/**
 * Statistik database
 */
function getDatabaseStats() {
    const db = getDb();
    if (!db) return { available: false };
    
    const total = db.prepare('SELECT COUNT(*) as total FROM hscode').get();
    const byLevel = db.prepare('SELECT code_level, COUNT(*) as total FROM hscode GROUP BY code_level').all();
    
    return {
        available: true,
        total: total.total,
        byLevel: byLevel.reduce((acc, row) => {
            acc[row.code_level] = row.total;
            return acc;
        }, {}),
        dbPath: DB_PATH
    };
}

// =====================================================================
// AI Lookup (Gemini) - untuk mendapatkan detail tarif Indonesia
// =====================================================================
const AI_PROMPT_TEMPLATE = (query) => `Anda adalah Spesialis Klasifikasi Tarif Kepabeanan Indonesia (BTKI 2022/2027) dan Regulasi LARTAS Impor/Ekspor (Permendag No. 36/2023 jo. No. 8/2024 dan instansi teknis terkait).

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

ATURAN PENTING:
- "hsCode" gunakan format BTKI dengan titik (misal '8522.90.91'), bukan tanpa titik.
- "bmMfn" berupa angka persentase saja (0, 5, 10, dst).
- "ppn" standar 11 atau 12. "pphApi" 2.5, "pphNonApi" 7.5.
- "lartasImpor" = true HANYA jika ada ketentuan LARTAS impor resmi dari kementerian teknis.
- Jika bebas LARTAS: "lartasKategori": "BEBAS TATA NIAGA (POST BORDER / TIDAK ADA LARTAS)", "lartasInstansi": "-", "lartasDokumen": [].`;

async function lookupHsCode(query, customApiKey = null) {
    if (!query || !query.trim()) {
        throw new Error('Query komoditas atau HS Code tidak boleh kosong.');
    }

    const cleanQuery = query.trim().toLowerCase();
    const cache = loadCache();

    // 1. Cek cache AI dulu
    if (cache[cleanQuery]) {
        console.log(`[BTKI-LOOKUP] Hit cache untuk query: "${cleanQuery}"`);
        return cache[cleanQuery];
    }

    // 2. Cek database lokal untuk kode eksak
    if (/^\d/.test(cleanQuery)) {
        const dbResult = searchByCode(cleanQuery.replace(/\D/g, ''));
        if (dbResult && dbResult.code_level >= 6) {
            console.log(`[BTKI-LOOKUP] Hit database SQLite untuk kode: "${cleanQuery}"`);
            return formatDbResult(dbResult);
        }
    }

    // 3. Fallback ke Gemini AI
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        // Coba return dari DB sebagai fallback
        const textResults = searchByText(cleanQuery, 1);
        if (textResults.length > 0) {
            return formatDbResult(textResults[0]);
        }
        throw new Error('GEMINI_API_KEY belum dikonfigurasi di server backend.');
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    const modelsToTry = [
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
    ];

    let lastError = null;
    let jsonText = '';

    for (const modelName of modelsToTry) {
        try {
            console.log(`[BTKI-LOOKUP] Menjalankan klasifikasi untuk "${query}" dengan model ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: AI_PROMPT_TEMPLATE(query)
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

/**
 * Format hasil dari DB ke format yang kompatibel dengan UI
 */
function formatDbResult(row) {
    const chapterNum = String(row.chapter || row.code.substring(0, 2)).padStart(2, '0');
    return {
        hsCode: row.code_formatted || row.code,
        formattedCode: row.code_formatted || row.code,
        bab: chapterNum,
        babTitle: row.chapter_title_id || '',
        uraianId: row.description_id || row.description_en || '',
        uraianEn: row.description_en || '',
        satuan: 'KGM',
        bmMfn: row.bm_mfn || 0,
        bmPreferensi: {
            atiga: `${row.bm_mfn || 0}% (Form D)`,
            acfta: `${row.bm_mfn || 0}% (Form E)`,
            rcep: `${row.bm_mfn || 0}%`
        },
        ppn: row.ppn || 11,
        pphApi: row.pph_api || 2.5,
        pphNonApi: row.pph_nonapi || 7.5,
        beaKeluar: '0%',
        lartasImpor: row.lartas === 1,
        lartasKategori: row.lartas === 1 ? 'CEK INSW UNTUK DETAIL LARTAS' : 'BEBAS TATA NIAGA (POST BORDER / TIDAK ADA LARTAS)',
        lartasInstansi: '-',
        lartasDasarHukum: '-',
        lartasDokumen: [],
        lartasEkspor: false,
        keywords: [],
        source: 'local_db'
    };
}

module.exports = {
    lookupHsCode,
    loadCache,
    searchByCode,
    searchByText,
    autocomplete,
    getChapterCodes,
    getDatabaseStats
};
