/**
 * BTKI / HS Code Database Import Script
 * Mengunduh semua kode HS (WCO Harmonized System) dari UN Comtrade
 * dan menyimpannya ke database SQLite lokal.
 * 
 * Cara jalankan: node import_hscode.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'temp', 'hscode.db');
const CACHE_FILE = path.join(__dirname, 'temp', 'btki_cache.json');

// Pastikan folder temp ada
fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });

// =====================================================================
// BTKI Chapter Titles (Bahasa Indonesia) - Semua 97 Chapter
// =====================================================================
const CHAPTER_TITLES = {
    '01': 'Binatang Hidup',
    '02': 'Daging dan Jeroan yang dapat dimakan',
    '03': 'Ikan dan Binatang Air Lainnya',
    '04': 'Produk Susu; Telur Burung; Madu Alam; Produk Pangan Hewani',
    '05': 'Produk Hewani Lainnya',
    '06': 'Tanaman Hidup dan Produk Floristik',
    '07': 'Sayuran dan Akar serta Umbi yang dapat dimakan',
    '08': 'Buah dan Kacang yang dapat dimakan; Kulit Jeruk atau Melon',
    '09': 'Kopi, Teh, Mate dan Rempah-rempah',
    '10': 'Serealia',
    '11': 'Produk Industri Penggilingan; Malt; Pati; Inulin; Gluten Gandum',
    '12': 'Biji-bijian Minyak; Biji-bijian Industri atau Obat; Jerami dan Pakan',
    '13': 'Lak; Karet, Resin dan Getah Nabati Lainnya',
    '14': 'Bahan Nabati untuk Anyaman; Produk Nabati Lainnya',
    '15': 'Lemak dan Minyak Hewani atau Nabati; Produk Turunannya',
    '16': 'Olahan Daging, Ikan atau Binatang Air Lainnya',
    '17': 'Gula dan Kembang Gula',
    '18': 'Kakao dan Olahan Kakao',
    '19': 'Olahan Serealia, Tepung, Pati atau Susu; Produk Industri Kue',
    '20': 'Olahan Sayuran, Buah, Kacang atau Bagian Tanaman Lainnya',
    '21': 'Berbagai Olahan Makanan',
    '22': 'Minuman, Cairan Beralkohol dan Cuka',
    '23': 'Ampas dan Limbah Industri Pangan; Pakan Olahan Hewan',
    '24': 'Tembakau dan Pengganti Tembakau Olahan',
    '25': 'Garam; Belerang; Bumi dan Batu; Plester; Kapur dan Semen',
    '26': 'Bijih, Terak dan Abu',
    '27': 'Bahan Bakar Mineral; Minyak Mineral dan Produk Destilasi',
    '28': 'Bahan Kimia Anorganik; Senyawa Organik atau Anorganik dari Logam Mulia',
    '29': 'Bahan Kimia Organik',
    '30': 'Produk Farmasi',
    '31': 'Pupuk',
    '32': 'Ekstrak Penyamak atau Pencelup; Tanin; Turunannya; Zat Warna; Cat; Tinta',
    '33': 'Minyak Atsiri dan Resinoid; Parfum, Kosmetik, Preparat Toilet',
    '34': 'Sabun, Preparat Pembersih, Pelumas, Lilin, Preparat Pemoles, Pasta Gigi',
    '35': 'Zat Albumin; Pati Termodifikasi; Lem; Enzim',
    '36': 'Bubuk Mesiu dan Bahan Peledak; Kembang Api; Korek Api; Paduan Piroforik',
    '37': 'Produk Fotografi dan Sinematografi',
    '38': 'Berbagai Produk Kimia',
    '39': 'Plastik dan Barang dari Plastik',
    '40': 'Karet dan Barang dari Karet',
    '41': 'Kulit Mentah (selain Bulu Hewan) dan Kulit Samak',
    '42': 'Barang dari Kulit; Barang Pelana; Perlengkapan Perjalanan, Tas Tangan',
    '43': 'Bulu Hewan dan Bulu Imitasi; Barang Daripadanya',
    '44': 'Kayu dan Barang dari Kayu; Arang',
    '45': 'Gabus dan Barang dari Gabus',
    '46': 'Barang dari Jerami, Esparto atau Bahan Anyaman Lainnya; Barang Keranjang',
    '47': 'Pulp dari Kayu atau Bahan Berserat Selulosa Lainnya; Kertas/Karton Bekas',
    '48': 'Kertas dan Karton; Barang dari Pulp Kertas, Kertas atau Karton',
    '49': 'Buku Cetakan, Surat Kabar, Gambar dan Produk Industri Percetakan Lainnya',
    '50': 'Sutera',
    '51': 'Wol, Bulu Hewan Halus atau Kasar; Benang Kuda dan Kain Tenun',
    '52': 'Kapas',
    '53': 'Serat Nabati Tekstil Lainnya; Benang Kertas dan Kain Tenun dari Benang Kertas',
    '54': 'Filamen Buatan; Strip dan Sejenisnya dari Bahan Tekstil Buatan',
    '55': 'Serat Stapel Buatan',
    '56': 'Gumpalan, Kain Kempa dan Bukan Tenunan; Benang Khusus; Tali; Kain Anyaman',
    '57': 'Karpet dan Penutup Lantai Tekstil Lainnya',
    '58': 'Kain Tenun Khusus; Kain Bertekstur; Renda; Tapestri; Garniture; Sulaman',
    '59': 'Kain Tekstil Diresapi, Dilapisi, Ditutupi atau Dilaminasi; Barang Tekstil Teknik',
    '60': 'Kain Rajutan atau Kait',
    '61': 'Pakaian dan Aksesori Pakaian; Rajutan atau Kait',
    '62': 'Pakaian dan Aksesori Pakaian; Bukan Rajutan atau Kait',
    '63': 'Barang Tekstil Jadi Lainnya; Setelan; Pakaian Bekas dan Kain Bekas',
    '64': 'Alas Kaki; Pelindung Kaki dan Sejenisnya; Bagian dari Barang Tersebut',
    '65': 'Tutup Kepala dan Bagiannya',
    '66': 'Payung, Payung Matahari, Tongkat Jalan, Cambuk, Pecut dan Bagiannya',
    '67': 'Bulu Unggas Olahan; Bulu Halus; Bunga Buatan; Barang dari Rambut Manusia',
    '68': 'Barang dari Batu, Gips, Semen, Asbes, Mika atau Bahan Sejenisnya',
    '69': 'Produk Keramik',
    '70': 'Kaca dan Barang dari Kaca',
    '71': 'Batu Mulia, Logam Mulia, Perhiasan, Koin',
    '72': 'Besi dan Baja',
    '73': 'Barang dari Besi atau Baja',
    '74': 'Tembaga dan Barang dari Tembaga',
    '75': 'Nikel dan Barang dari Nikel',
    '76': 'Aluminium dan Barang dari Aluminium',
    '78': 'Timbal dan Barang dari Timbal',
    '79': 'Seng dan Barang dari Seng',
    '80': 'Timah dan Barang dari Timah',
    '81': 'Logam Dasar Lainnya; Cermet; Barang Daripadanya',
    '82': 'Perkakas, Peralatan, Sendok Garpu dan Sendok dari Logam Dasar',
    '83': 'Berbagai Barang dari Logam Dasar',
    '84': 'Reaktor Nuklir, Ketel Uap, Mesin dan Peralatan Mekanik',
    '85': 'Mesin, Peralatan Listrik dan Elektronik',
    '86': 'Lokomotif, Gerbong Kereta Api, Tram; Peralatan Rel; Perlengkapan Pensinyalan',
    '87': 'Kendaraan; Selain dari Kereta Api/Tram; Bagian dan Aksesorinya',
    '88': 'Pesawat Udara, Pesawat Luar Angkasa dan Bagiannya',
    '89': 'Kapal, Perahu dan Struktur Terapung',
    '90': 'Instrumen Optik, Fotografi, Sinematografi, Pengukur; Instrumen Bedah',
    '91': 'Jam Tangan, Jam dan Bagiannya',
    '92': 'Instrumen Musik; Bagian dan Aksesori Instrumen Musik',
    '93': 'Senjata dan Amunisi; Bagian dan Aksesorinya',
    '94': 'Furnitur; Tempat Tidur, Kasur, Dasar Kasur; Lampu dan Perlengkapan Pencahayaan',
    '95': 'Mainan, Permainan dan Peralatan Olahraga; Bagian dan Aksesorinya',
    '96': 'Berbagai Barang Jadi',
    '97': 'Karya Seni, Barang Koleksi dan Barang Antik'
};

// =====================================================================
// Tarif BM MFN Default per Chapter (approximasi BTKI 2022)
// =====================================================================
const BM_DEFAULT_BY_CHAPTER = {
    '01': 0, '02': 5, '03': 5, '04': 5, '05': 0, '06': 5, '07': 5, '08': 5,
    '09': 5, '10': 5, '11': 5, '12': 5, '13': 0, '14': 0, '15': 5, '16': 5,
    '17': 5, '18': 5, '19': 5, '20': 5, '21': 5, '22': 5, '23': 0, '24': 40,
    '25': 0, '26': 0, '27': 0, '28': 0, '29': 0, '30': 0, '31': 0, '32': 5,
    '33': 10, '34': 5, '35': 5, '36': 5, '37': 5, '38': 0, '39': 5, '40': 5,
    '41': 0, '42': 15, '43': 5, '44': 5, '45': 0, '46': 5, '47': 0, '48': 0,
    '49': 0, '50': 5, '51': 5, '52': 5, '53': 5, '54': 5, '55': 5, '56': 5,
    '57': 15, '58': 5, '59': 5, '60': 5, '61': 15, '62': 15, '63': 15, '64': 20,
    '65': 15, '66': 10, '67': 5, '68': 0, '69': 15, '70': 10, '71': 0, '72': 0,
    '73': 10, '74': 0, '75': 0, '76': 5, '78': 0, '79': 0, '80': 0, '81': 0,
    '82': 5, '83': 10, '84': 0, '85': 0, '86': 0, '87': 10, '88': 0, '89': 0,
    '90': 0, '91': 0, '92': 0, '93': 5, '94': 15, '95': 10, '96': 10, '97': 0
};

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        console.log(`[FETCH] Mengunduh data dari: ${url}`);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Gagal parse JSON: ' + e.message));
                }
            });
        }).on('error', reject);
    });
}

function initDatabase(db) {
    console.log('[DB] Menginisialisasi database SQLite...');
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS hscode (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            code_formatted TEXT,
            code_level INTEGER,          -- 2=chapter, 4=heading, 6=subheading, 8=tariff_line
            parent_code TEXT,
            section TEXT,
            chapter TEXT,
            chapter_title_id TEXT,
            description_en TEXT NOT NULL,
            description_id TEXT,
            bm_mfn REAL DEFAULT 0,
            ppn REAL DEFAULT 11,
            pph_api REAL DEFAULT 2.5,
            pph_nonapi REAL DEFAULT 7.5,
            lartas INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_hscode_code ON hscode(code);
        CREATE INDEX IF NOT EXISTS idx_hscode_chapter ON hscode(chapter);
        CREATE INDEX IF NOT EXISTS idx_hscode_level ON hscode(code_level);
        
        CREATE VIRTUAL TABLE IF NOT EXISTS hscode_fts USING fts5(
            code,
            description_en,
            description_id,
            content='hscode',
            content_rowid='id'
        );
        
        CREATE TRIGGER IF NOT EXISTS hscode_ai AFTER INSERT ON hscode BEGIN
            INSERT INTO hscode_fts(rowid, code, description_en, description_id)
            VALUES (new.id, new.code, new.description_en, COALESCE(new.description_id, ''));
        END;
    `);
    
    console.log('[DB] Tabel dan indeks berhasil dibuat.');
}

function formatCode(code) {
    const c = code.replace(/\D/g, '');
    if (c.length === 2) return c;
    if (c.length === 4) return c.substring(0, 4);
    if (c.length === 6) return `${c.substring(0, 4)}.${c.substring(4, 6)}`;
    if (c.length === 8) return `${c.substring(0, 4)}.${c.substring(4, 6)}.${c.substring(6, 8)}`;
    if (c.length === 10) return `${c.substring(0, 4)}.${c.substring(4, 6)}.${c.substring(6, 8)}.${c.substring(8, 10)}`;
    return code;
}

async function importFromComtrade(db) {
    console.log('[IMPORT] Memulai import dari UN Comtrade HS Classification...');
    
    const data = await fetchJson('https://comtrade.un.org/data/cache/classificationHS.json');
    const results = data.results || [];
    
    console.log(`[IMPORT] Ditemukan ${results.length} entri HS Code dari Comtrade.`);
    
    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO hscode 
        (code, code_formatted, code_level, parent_code, section, chapter, chapter_title_id, description_en, bm_mfn, ppn, pph_api, pph_nonapi)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((items) => {
        let count = 0;
        for (const item of items) {
            const id = String(item.id || '').trim();
            if (!id || id.length < 2 || /[A-Z]/.test(id)) continue; // Skip aggregates
            
            const text = String(item.text || '');
            // Format: "010110 - Description here"
            const dashIdx = text.indexOf(' - ');
            const description = dashIdx >= 0 ? text.substring(dashIdx + 3) : text;
            
            const codeDigits = id.replace(/\D/g, '');
            const level = codeDigits.length;
            if (level < 2 || level > 6) continue; // Kita simpan 2,4,6 digit saja
            
            const chapterNum = codeDigits.substring(0, 2);
            const bmMfn = BM_DEFAULT_BY_CHAPTER[chapterNum] ?? 0;
            const chapterTitle = CHAPTER_TITLES[chapterNum] || '';
            
            insertStmt.run(
                codeDigits,
                formatCode(codeDigits),
                level,
                String(item.parent || '').replace(/\D/g, '') || null,
                null,
                chapterNum,
                chapterTitle,
                description,
                bmMfn,
                11,
                2.5,
                7.5
            );
            count++;
        }
        return count;
    });
    
    const inserted = insertMany(results);
    console.log(`[IMPORT] Berhasil mengimpor ${inserted} pos tarif HS Code dari Comtrade.`);
    return inserted;
}

// =====================================================================
// Import dari cache Gemini yang sudah ada (btki_cache.json)
// =====================================================================
function importFromCache(db) {
    if (!fs.existsSync(CACHE_FILE)) {
        console.log('[IMPORT] Tidak ada cache Gemini lokal. Melewati...');
        return 0;
    }
    
    console.log('[IMPORT] Membaca cache Gemini lokal...');
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    
    const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO hscode 
        (code, code_formatted, code_level, chapter, chapter_title_id, description_en, description_id, bm_mfn, ppn, pph_api, pph_nonapi, lartas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((entries) => {
        let count = 0;
        for (const [key, val] of entries) {
            if (!val || !val.hsCode) continue;
            const codeDigits = val.hsCode.replace(/\D/g, '');
            if (codeDigits.length < 6) continue;
            
            insertStmt.run(
                codeDigits,
                val.formattedCode || formatCode(codeDigits),
                codeDigits.length,
                val.bab || codeDigits.substring(0, 2),
                val.babTitle || CHAPTER_TITLES[codeDigits.substring(0, 2)] || '',
                val.uraianEn || '',
                val.uraianId || '',
                val.bmMfn || 0,
                val.ppn || 11,
                val.pphApi || 2.5,
                val.pphNonApi || 7.5,
                val.lartasImpor ? 1 : 0
            );
            count++;
        }
        return count;
    });
    
    const entries = Object.entries(cache);
    const inserted = insertMany(entries);
    console.log(`[IMPORT] Berhasil mengimpor ${inserted} pos tarif dari cache Gemini lokal.`);
    return inserted;
}

async function main() {
    console.log('=======================================================');
    console.log('🚀 BTKI HS Code Database Import Tool');
    console.log('=======================================================');
    
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    
    initDatabase(db);
    
    // 1. Import dari cache lokal Gemini terlebih dahulu
    const cacheCount = importFromCache(db);
    
    // 2. Import dari UN Comtrade (database internasional lengkap)
    let comtradeCount = 0;
    try {
        comtradeCount = await importFromComtrade(db);
    } catch (e) {
        console.error('[IMPORT] Gagal fetch dari Comtrade:', e.message);
        console.log('[IMPORT] Melanjutkan dengan data yang sudah ada...');
    }
    
    // Statistik
    const stats = db.prepare('SELECT code_level, COUNT(*) as total FROM hscode GROUP BY code_level').all();
    const total = db.prepare('SELECT COUNT(*) as total FROM hscode').get();
    
    console.log('\n=======================================================');
    console.log('✅ Import Selesai!');
    console.log(`📊 Total pos tarif: ${total.total}`);
    stats.forEach(s => {
        const label = { 2: 'Chapter (2-digit)', 4: 'Heading (4-digit)', 6: 'Subheading (6-digit)', 8: 'Tariff Line (8-digit)', 10: 'BTKI 10-digit' }[s.code_level] || `${s.code_level}-digit`;
        console.log(`   ${label}: ${s.total}`);
    });
    console.log(`   Cache Gemini: ${cacheCount}`);
    console.log(`   Comtrade WCO: ${comtradeCount}`);
    console.log(`📁 Database: ${DB_PATH}`);
    console.log('=======================================================\n');
    
    db.close();
}

main().catch(e => {
    console.error('[ERROR]', e.message);
    process.exit(1);
});
