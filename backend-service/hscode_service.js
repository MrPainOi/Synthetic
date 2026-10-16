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

const ID_TO_EN_SYNONYMS = {
    'kabel': ['cable', 'conductor', 'wire'],
    'kawat': ['wire'],
    'tembaga': ['copper'],
    'besi': ['iron', 'steel'],
    'baja': ['steel'],
    'minyak': ['oil'],
    'kelapa sawit': ['palm oil'],
    'sawit': ['palm'],
    'beras': ['rice'],
    'padi': ['rice', 'paddy'],
    'gandum': ['wheat'],
    'tepung': ['flour'],
    'karet': ['rubber'],
    'ban': ['tyre', 'tire'],
    'kayu': ['wood'],
    'kertas': ['paper'],
    'plastik': ['plastic'],
    'sepatu': ['footwear', 'shoe'],
    'pakaian': ['garment', 'clothing', 'apparel'],
    'baju': ['shirt', 't-shirt', 'clothing'],
    'celana': ['trousers', 'pants'],
    'kaos': ['t-shirt'],
    'kain': ['fabric', 'cloth'],
    'benang': ['yarn', 'thread'],
    'kapas': ['cotton'],
    'susu': ['milk'],
    'keju': ['cheese'],
    'daging': ['meat'],
    'ikan': ['fish'],
    'udang': ['shrimp', 'prawn'],
    'kopi': ['coffee'],
    'teh': ['tea'],
    'gula': ['sugar'],
    'garam': ['salt'],
    'semen': ['cement'],
    'kaca': ['glass'],
    'keramik': ['ceramic'],
    'emas': ['gold'],
    'perak': ['silver'],
    'aluminium': ['aluminium', 'aluminum'],
    'timah': ['tin'],
    'seng': ['zinc'],
    'nikel': ['nickel'],
    'mesin': ['machinery', 'engine', 'machine'],
    'pompa': ['pump'],
    'kompresor': ['compressor'],
    'motor': ['motor', 'motorcycle'],
    'mobil': ['motor car', 'vehicle', 'automobile'],
    'truk': ['truck', 'lorry'],
    'sepeda': ['bicycle'],
    'kapal': ['ship', 'vessel', 'boat'],
    'pesawat': ['aircraft', 'aeroplane'],
    'obat': ['medicament', 'medicine', 'pharmaceutical'],
    'farmasi': ['pharmaceutical'],
    'pupuk': ['fertiliser', 'fertilizer'],
    'cat': ['paint', 'varnish'],
    'sabun': ['soap'],
    'kosmetik': ['cosmetic']
};

/**
 * Cari HS Code berdasarkan teks (Full-Text Search atau Kode)
 * Kembalikan hasil pencarian (default limit 50, maks 200)
 */
function searchByText(query, limit = 50) {
    const db = getDb();
    if (!db) return [];
    
    const cleanDigits = String(query).replace(/\D/g, '');
    const maxLimit = Math.min(Math.max(limit, 1), 200);

    // Jika query murni angka atau ada awalan angka (misal: '8544' atau '0101')
    if (cleanDigits.length >= 2 && /^\d/.test(query.trim())) {
        const prefixResults = db.prepare(`
            SELECT * FROM hscode
            WHERE code LIKE ?
            ORDER BY code_level ASC, code ASC
            LIMIT ?
        `).all(`${cleanDigits}%`, maxLimit);

        if (prefixResults.length > 0) return prefixResults;
    }

    try {
        // Coba FTS terlebih dahulu
        const ftsQuery = `"${query.replace(/"/g, '')}"*`;
        const ftsResults = db.prepare(`
            SELECT h.* FROM hscode h
            JOIN hscode_fts f ON h.id = f.rowid
            WHERE hscode_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        `).all(ftsQuery, maxLimit);
        
        if (ftsResults.length > 0) return ftsResults;
    } catch (e) {
        // Fallback ke LIKE jika FTS gagal
    }
    
    // Cek sinonim Bahasa Indonesia -> Bahasa Inggris
    const lowerQ = query.trim().toLowerCase();
    const synonymTerms = ID_TO_EN_SYNONYMS[lowerQ] || [];
    
    // Fallback: LIKE search pada description_en, description_id, dan code
    let whereClauses = ['(description_en LIKE ? OR description_id LIKE ? OR code LIKE ?)'];
    let params = [`%${query}%`, `%${query}%`, `%${query}%`];

    if (synonymTerms.length > 0) {
        const synClauses = synonymTerms.map(() => 'description_en LIKE ?');
        whereClauses.push(`(${synClauses.join(' OR ')})`);
        synonymTerms.forEach(t => params.push(`%${t}%`));
    }

    const whereSql = whereClauses.join(' OR ');

    return db.prepare(`
        SELECT * FROM hscode
        WHERE ${whereSql}
        ORDER BY code_level ASC, code ASC
        LIMIT ?
    `).all(...params, maxLimit);
}

/**
 * Cari semua HS Code dalam satu chapter
 */
function getChapterCodes(chapterNum, level = 0) {
    const db = getDb();
    if (!db) return [];
    const ch = String(chapterNum).padStart(2, '0');
    if (level && level > 0) {
        return db.prepare(`
            SELECT * FROM hscode
            WHERE chapter = ? AND code_level = ?
            ORDER BY code ASC
        `).all(ch, level);
    }
    return db.prepare(`
        SELECT * FROM hscode
        WHERE chapter = ?
        ORDER BY code ASC
    `).all(ch);
}

/**
 * Jelajah / Browse pos tarif dari database SQLite lokal
 * Mendukung filter chapter tunggal atau jamak (cth: '85' atau '72,73'), pagination, dan level
 */
function browseHsCodes({ chapters = 'all', limit = 100, offset = 0, minLevel = 2 } = {}) {
    const db = getDb();
    if (!db) return { total: 0, limit, offset, items: [] };

    let whereClauses = [];
    let params = [];

    if (minLevel && minLevel > 0) {
        whereClauses.push('code_level >= ?');
        params.push(minLevel);
    }

    if (chapters && chapters !== 'all') {
        const chList = String(chapters).split(',').map(c => c.trim().padStart(2, '0')).filter(Boolean);
        if (chList.length > 0) {
            const placeholders = chList.map(() => '?').join(',');
            whereClauses.push(`chapter IN (${placeholders})`);
            params.push(...chList);
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT count(id) as total FROM hscode ${whereSql}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const rows = db.prepare(`
        SELECT * FROM hscode
        ${whereSql}
        ORDER BY code ASC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
        total,
        limit,
        offset,
        items: rows.map(formatDbResult)
    };
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
        if (dbResult) {
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
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-2.5-flash'
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
        babTitleEn: row.chapter_title_en || '',
        section: row.section || '',
        pdfUrl: row.pdf_url || '',
        sourceUrl: row.source_url || 'https://www.beacukai.go.id/btki-dan-tarif#',
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

function getBtkiCatalog() {
    try {
        const { SECTIONS, CHAPTER_DATA } = require('./update_beacukai_btki');
        return {
            source: 'https://www.beacukai.go.id/btki-dan-tarif#',
            title: 'Buku Tarif Kepabeanan Indonesia (BTKI) 2022',
            legalBasis: 'PMK Nomor 26/PMK.010/2022',
            sections: SECTIONS,
            chapters: CHAPTER_DATA
        };
    } catch (e) {
        return null;
    }
}

module.exports = {
    lookupHsCode,
    loadCache,
    searchByCode,
    searchByText,
    autocomplete,
    getChapterCodes,
    getDatabaseStats,
    getBtkiCatalog,
    browseHsCodes
};

