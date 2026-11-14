require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(res => setTimeout(res, ms));

// Helper inisialisasi Gemini API client
function getAiClient(customKey) {
    const key = customKey || process.env.GEMINI_API_KEY;
    if (!key || !key.trim()) {
        throw new Error("GEMINI_API_KEY belum diset. Silakan atur GEMINI_API_KEY di file .env atau melalui pengaturan.");
    }
    return new GoogleGenAI({ apiKey: key.trim() });
}

async function parseDocuments(pdfInputs, onProgress = () => { }, customApiKey = null, mode = 'ekspor') {
    const pdfPaths = pdfInputs;
    console.log(`Memproses ${pdfInputs.length} dokumen sekaligus [Mode: ${mode.toUpperCase()}]...`);
    onProgress({ step: 'init', message: `Memproses ${pdfInputs.length} dokumen sekaligus [Mode: ${mode.toUpperCase()}]...`, totalFiles: pdfInputs.length });

    try {
        const ai = getAiClient(customApiKey);
        const fileManager = ai.files;
        const uploadResults = [];
        const uploadedMeta = [];

        // Upload semua file ke Gemini
        for (let i = 0; i < pdfInputs.length; i++) {
            const inputItem = pdfInputs[i];
            const pdfPath = typeof inputItem === 'string' ? inputItem : inputItem.path;
            const fileName = (typeof inputItem === 'object' && inputItem.originalName) ? inputItem.originalName : path.basename(pdfPath);
            console.log(`Mengunggah: ${fileName} (${pdfPath})`);
            onProgress({
                step: 'upload',
                file: fileName,
                index: i,
                total: pdfInputs.length,
                status: 'running',
                message: `Mengunggah ke AI: ${fileName}`
            });
            const uploadResult = await fileManager.upload({
                file: pdfPath,
                mimeType: 'application/pdf',
            });
            uploadResults.push(uploadResult);
            uploadedMeta.push({ fileName, uri: uploadResult.uri, mimeType: uploadResult.mimeType });
            onProgress({
                step: 'upload',
                file: fileName,
                index: i,
                total: pdfInputs.length,
                status: 'done',
                message: `Berhasil diunggah: ${fileName}`
            });
        }
        console.log(`Semua file berhasil diunggah.`);
        onProgress({
            step: 'parsing',
            status: 'running',
            message: `Semua dokumen (${pdfInputs.length}) berhasil diunggah. Menghubungi Ray-OCR V.1...`
        });

        const fileNamesList = uploadedMeta.map((f, i) => `${i + 1}. [File ${i + 1}]: "${f.fileName}"`).join('\n');

        const isImporMode = Boolean(
            (mode && (mode.toLowerCase().includes('impor') || mode.toLowerCase().includes('pib') || mode.toLowerCase().includes('import')))
        );

        const prompt = isImporMode ? `Kamu adalah sistem ahli kepabeanan Indonesia (PPJK) dan verifikator dokumen IMPOR (PIB BC 2.0 / FTZ01) yang sangat teliti, analitis, dan kritis.
Berikut daftar file dokumen yang terlampir:
${fileNamesList}

TUGAS UTAMA:
1. SAFECHECK (VALIDASI RELEVANSI ANTAR-DOKUMEN):
   Lakukan analisis perbandingan dan cross-check secara ketat: apakah SEMUA dokumen di atas memang saling berhubungan dan merupakan SATU KESATUAN PENGIRIMAN (satu shipment impor yang sama)?
   - Periksa konsistensi nomor: No. Invoice, No. Packing List (PL), No. Bill of Lading (B/L / Sea Waybill / Air Waybill), No. PO/Kontrak, No. Kontainer / Seal.
   - Periksa kesesuaian Shipper/Pengirim Luar Negeri dan Consignee/Importir Indonesia di setiap dokumen.
   - Periksa kesesuaian rute (Pelabuhan Muat Asal Luar Negeri & Pelabuhan Bongkar Tujuan Indonesia), tanggal pengapalan, dan jenis komoditas barang.
   - Tentukan apakah ada dokumen yang ASING, SALAH LAMPIR, atau dari TRANSAKSI BERBEDA.

2. EKSTRAKSI DATA LENGKAP CEISA 4.0 PIB (BC 2.0 / FTZ01):
   PENTING - ATURAN PERAN PABEAN IMPOR (JANGAN TERTUKAR!):
   - Pengirim / Shipper / Supplier: Pihak pabrik / eksportir luar negeri yang mengirimkan barang (misal dari Jepang, China, Singapura, Jerman, dsb).
   - Penjual / Seller: Pihak penjual di Invoice komersial luar negeri (biasanya sama dengan Pengirim, atau perusahaan perantara/trader LN).
   - Penerima / Consignee / Importer: Pihak importir berbadan hukum di Indonesia yang menerima barang (misal di Batam, Jakarta, Surabaya, dll).
   - Pembeli / Buyer: Pihak pembeli di dokumen (tertera pada "Sold to" atau "Bill to" di invoice; jika Sold To perusahaan luar negeri/trader seperti Singapura, catat nama dan negara aslinya).
   - Pemilik Barang: Pihak pemilik barang di Indonesia (biasanya sama dengan Penerima).

PENTING - ATURAN MULTI-HALAMAN & MULTI-INVOICE:
* WAJIB periksa SETIAP HALAMAN dokumen dari awal sampai akhir secara seksama!
* Pengiriman impor seringkali memuat lembar Delivery Order / DG Local Export Order / Delivery Instruction di halaman awal, lalu Air Waybill, Invoice, Packing List, Cargo Clearance Permit, hingga MSDS.
* JANGAN PERNAH menyaring, mengabaikan, atau memotong baris barang!
* Pada 'items': WAJIB ekstrak SELURUH baris barang dari SEMUA halaman/invoice tanpa terlewat! Jika dokumen memiliki 2 atau lebih barang, WAJIB ekstrak semuanya lengkap satu per satu!

PENTING - ATURAN SUMBER UTAMA NAMA & URAIAN BARANG (DOKUMEN INVOICE & PACKING LIST):
* Sumber utama nama barang ('uraianJenisBarang'), Merek ('merk'), Tipe ('tipe'), dan Spesifikasi ('spesifikasi') WAJIB DIAMBIL DARI LEMBAR "COMMERCIAL INVOICE" ATAU "PACKING LIST" (kolom 'Description of Goods', 'Commodity', atau rincian item)!
* JANGAN PERNAH mengambil nama barang dari lembar MSDS / SDS (Safety Data Sheet), CoA (Certificate of Analysis), atau lembar keselamatan kimia! Lembar MSDS hanya referensi keselamatan bahan kimia pengangkut, BUKAN nama barang komersial pabean!
* JANGAN menambahkan istilah klasifikasi kimia dari MSDS (seperti "HARDENER", "CURING AGENT", "RESIN", dsb) ke dalam 'uraianJenisBarang' jika kata tersebut TIDAK TERCANTUM dalam Description of Goods pada Commercial Invoice / Packing List!
* Contoh Nyata: Jika di Commercial Invoice tertulis:
  "PELUCURE (A61301T3152X)
   HY-680 1KG/UNCAN"
  dan di lampiran MSDS belakang tertulis fungsi kimianya adalah Hardener buatan PELNOX, LTD, maka:
  - 'uraianJenisBarang': "PELUCURE" (atau "PELUCURE (A61301T3152X)") -> DILARANG KERAS menulis "HARDENER" atau "PELUCURE HARDENER"!
  - 'merk': "PELUCURE" (atau "-") -> JANGAN tulis "PELNOX"!
  - 'tipe': "HY-680"
  - 'spesifikasi': "HY-680 1KG/UNCAN"
  Hal ini karena petugas Bea Cukai dan sistem CEISA 4.0 PIB mencocokkan nama barang 1:1 langsung terhadap Commercial Invoice & Packing List!

Kembalikan HANYA format JSON murni tanpa markdown/backticks (\`\`\`json):
{
  "safeCheck": {
    "isRelated": true,
    "confidenceScore": 95,
    "summary": "Ringkasan penjelasan safecheck dalam bahasa Indonesia",
    "matchedIdentifiers": ["Nomor Invoice cocok...", "Shipper LN dan Consignee ID terkonfirmasi..."],
    "discrepanciesOrWarnings": [],
    "documentList": [
      {
        "fileName": "Nama file dokumen",
        "documentType": "INVOICE / PACKING_LIST / BILL_OF_LADING / CERTIFICATE / OTHER",
        "belongsToShipment": true,
        "notes": "Penjelasan singkat isi/fungsi dokumen ini"
      }
    ]
  },
  "jenisDokumen": "PIB",
  "blNumber": "Nomor Bill of Lading / B/L / Sea Waybill / Air Waybill (AWB)",
  "blDate": "Tanggal B/L / Shipped on Board Date (YYYY-MM-DD)",
  "invoiceNumber": "Nomor SEMUA Invoice lengkap (gabungkan dengan koma jika multi-invoice, misal: 'INV-001, INV-002')",
  "invoiceDate": "Tanggal Invoice utama (YYYY-MM-DD)",
  "invoices": [
    {
      "invoiceNumber": "Nomor Invoice",
      "invoiceDate": "Tanggal Invoice (YYYY-MM-DD)",
      "amount": 50000.00,
      "currency": "USD / EUR / CNY / SGD / JPY",
      "containerNumber": "Nomor kontainer terkait jika tertera",
      "type": "COMMERCIAL / SAMPLE / OTHER"
    }
  ],
  "packingListNumber": "Nomor SEMUA Packing List yang bersesuaian (isi null jika hanya lembar invoice)",
  "packingListDate": "Tanggal Packing List (YYYY-MM-DD)",
  "cooNumber": "Nomor Certificate of Origin / Form D / Form E / Form AK / SKA jika ada, atau null",
  "cooDate": "Tanggal COO (YYYY-MM-DD) atau null",
  "lartasNumber": "Nomor Dokumen Izin / Lartas (PI Kemendag / LS Surveyor) jika ada, atau null",
  "lartasDate": "Tanggal Dokumen Lartas atau null",
  
  "pengirim": {
    "nama": "Nama Lengkap Pemasok / Shipper Luar Negeri",
    "alamat": "Alamat Lengkap Pemasok Luar Negeri",
    "negara": "Kode 2 huruf & Nama Negara Pemasok (misal: 'CN - CHINA', 'SG - SINGAPORE', 'DE - GERMANY', 'JP - JAPAN', 'TW - TAIWAN', 'US - UNITED STATES')",
    "nomorIdentitas": "-",
    "jenisIdentitas": "4 - LAINNYA"
  },
  "penjual": {
    "nama": "Nama Penjual di Invoice LN (biasanya sama dengan Pengirim)",
    "alamat": "Alamat Lengkap Penjual LN",
    "negara": "Kode & Nama Negara Penjual"
  },
  "penerima": {
    "nama": "Nama Lengkap Importir / Penerima Indonesia (Consignee)",
    "alamat": "Alamat Lengkap Importir di Indonesia",
    "negara": "ID - INDONESIA",
    "nomorIdentitas": "NPWP 16 digit importir jika tertera di dokumen (misal: '0830727251085000') atau null",
    "jenisIdentitas": "6 - NPWP 16 DIGIT",
    "nitku": "NITKU jika tertera atau null",
    "status": "LAINNYA"
  },
  "pembeli": {
    "nama": "Nama Pembeli di dokumen (Bill To / Sold To)",
    "alamat": "Alamat Pembeli",
    "negara": "Kode & Nama Negara Pembeli"
  },
  "pemilikBarang": {
    "nama": "Nama Pemilik Barang di Indonesia (biasanya sama dengan Penerima)",
    "alamat": "Alamat Pemilik Barang di Indonesia",
    "nomorIdentitas": "NPWP 16 digit pemilik atau null",
    "afiliasi": "TAH - Tidak berhubungan"
  },

  "caraPengangkutan": "1 - LAUT / 2 - UDARA / 3 - DARAT / 4 - POS / KURIR / 5 - MULTIMODA",
  "vesselName": "Nama Sarana Pengangkut / Nomor Penerbangan Pesawat (misal: 'KZ 235', 'SQ-950') atau Nama Kapal (misal: 'KM BUDI JASA 19', 'WAN HAI 215'). JANGAN tulis nama bandara atau pelabuhan!",
  "voyageNumber": "Nomor Voyage kapal atau nomor penerbangan jika terpisah",
  "vesselFlag": "Bendera Kebangsaan Kapal / Maskapai (misal: 'JP - JAPAN', 'PA - PANAMA', 'SG - SINGAPORE', 'ID - INDONESIA')",
  "etaDate": "Tanggal Perkiraan Tiba / ETA (YYYY-MM-DD)",
  "portLoading": "Pelabuhan Muat Asal Luar Negeri (misal: 'NRT - NARITA', 'CNSHG - SHANGHAI', 'SGSIN - SINGAPORE')",
  "portTransit": "Pelabuhan Transit LN jika ada (misal: 'SGSIN - SINGAPORE', 'SGJUR - JURONG') atau null",
  "portDischarge": "Pelabuhan Bongkar Tujuan di INDONESIA (misal: 'IDBTM - BATAM', 'IDSKP - SEKUPANG', 'IDTPP - TANJUNG PRIOK'). Pelabuhan tujuan HARUS di Indonesia!",
  "tpsLocation": "Lokasi TPS di pelabuhan jika tertera",

  "packageType": "Kode jenis kemasan CEISA (misal: 'BX - BOX', 'CT - CARTON', 'PK - PACKAGE', 'PX - PALLET', 'DR - DRUM', 'BG - BAG')",
  "packageQty": 816, // WAJIB ANGKA MURNI (integer) total jumlah kemasan
  "grossWeight": 12450.50, // WAJIB ANGKA MURNI (desimal float) total berat kotor dalam KG
  "netWeight": 11200.00, // WAJIB ANGKA MURNI (desimal float) total berat bersih dalam KG
  "containerNumber": "Nomor Kontainer / Peti Kemas (misal: 'CIMU0654754, TLHU8158388')",
  "containerSize": "20 / 40 / 45",
  "containerType": "FCL / LCL",

  "currency": "Mata uang faktur 3 huruf (misal: 'USD', 'EUR', 'CNY', 'SGD', 'JPY')",
  "incoterm": "Incoterm penyerahan barang (misal: 'FOB', 'CIF', 'CFR', 'EXW', 'FCA', 'CIP', 'CPT', 'DAP', 'DDP')",
  "invoiceAmount": 50000.00, // WAJIB ANGKA MURNI total nilai faktur / barang
  "freightAmount": 1500.00, // Biaya pengangkutan (Freight) jika tertera di B/L atau Invoice; jika tidak ada atau Term CIF, isi 0.00
  "insuranceAmount": 50.00, // Biaya asuransi jika tertera; jika tidak ada, isi 0.00
  "insuranceType": "LN - Luar Negeri", // atau 'DN - Dalam Negeri'
  "cifAmount": 51550.00, // Total nilai CIF (invoiceAmount + freightAmount + insuranceAmount)

  "items": [
    {
      "hsCode": "Pos Tarif BTKI 8 digit (jika tertera di invoice/PL/BL/permit)",
      "uraianJenisBarang": "Nama komoditas barang SAJA persis sesuai Commercial Invoice / Packing List (misal: 'PELUCURE'). JANGAN ambil dari MSDS dan JANGAN sertakan kata seperti 'HARDENER'!",
      "merk": "Merk dagang barang jika tertera di dokumen atau '-'",
      "tipe": "Tipe barang jika tertera atau '-'",
      "spesifikasi": "Spesifikasi teknis / Part Number / Customer Part No jika tertera",
      "negaraAsal": "Kode & Nama Negara Asal Pembuatan Barang (misal: 'JP - JAPAN', 'CN - CHINA', 'SG - SINGAPORE', 'DE - GERMANY')",
      "jumlahDanSatuanBarang": "Misal: 105 KGM atau 3,975 PCE",
      "quantity": 3975, // WAJIB ANGKA MURNI kuantitas barang
      "satuanBarang": "Kode satuan CEISA (PCE / KGM / SET / UNT / MTR / DZN / ROL)",
      "kemasan": "Jumlah dan jenis kemasan (misal: '816 BOX' atau '22 PALLET')",
      "kemasanQty": 816, // WAJIB ANGKA MURNI jumlah kemasan baris barang
      "kemasanJenis": "BX - BOX / CT - CARTON / PK - PACKAGE / PX - PALLET",
      "beratBersih": 1500.00, // WAJIB ANGKA MURNI berat bersih dalam KG
      "beratKotor": 1650.00, // WAJIB ANGKA MURNI berat kotor dalam KG
      "amount": 25000.00, // WAJIB ANGKA MURNI nilai harga barang (FOB)
      "cifUsd": 25775.00, // WAJIB ANGKA MURNI nilai CIF barang (proporsional FOB + Freight + Insurance)
      "tarifBm": 5.0 // Tarif Bea Masuk (%) jika tertera atau 5.0
    }
  ]
}

PENTING UNTUK IMPOR:
- JANGAN TERTUKAR PERAN: Shipper/Vendor adalah Pengirim Luar Negeri, Consignee adalah Penerima Indonesia.
- Ekstrak seluruh nominal dan berat dengan akurat tanpa membulatkan angka.
- Jika ada biaya Freight atau Asuransi yang tertera terpisah di dokumen (misal di lembar Freight Invoice, Sea Waybill, B/L, atau Commercial Invoice), WAJIB dicantumkan pada 'freightAmount' dan 'insuranceAmount'!
- Pada 'items': WAJIB ekstrak seluruh baris barang tanpa terlewat dari semua invoice! Jika dokumen mencantumkan 2 baris barang, WAJIB hasilkan 2 item lengkap di array 'items'!` : `Kamu adalah sistem ahli kepabeanan Indonesia (PPJK) dan verifikator dokumen ekspor/impor yang sangat teliti dan kritis.
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
  "invoiceNumber": "Nomor SEMUA Invoice lengkap (WAJIB gabungkan SEMUA nomor invoice yang ada dipisahkan koma, misal: '335223, 335226, SMV.B2609043, 335227, SMV.B2609044')",
  "invoiceDate": "Tanggal Invoice (jika berbeda-beda, tuliskan tanggal utama atau pisahkan koma)",
  "invoices": [
    {
      "invoiceNumber": "Nomor Invoice persis di dokumen",
      "invoiceDate": "Tanggal Invoice",
      "amount": "Nominal total invoice",
      "currency": "Mata uang (IDR, USD, dll)",
      "containerNumber": "Nomor kontainer terkait jika tertera",
      "type": "COMMERCIAL / SAMPLE_STORE_IN / OTHER"
    }
  ],
  "packingListNumber": "Nomor SEMUA Packing List yang bersesuaian (WAJIB gabungkan SEMUA nomor PL dipisahkan koma, misal: '335223, 335226, SMV.B2609043, 335227, SMV.B2609044')",
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
      "hsCode": "Pos Tarif / HS Code barang 8 sampai 10 digit (misal: '8504.40.90' atau '8512.40.00' jika tertera di dokumen pengapalan seperti Invoice, Packing List, atau B/L. Kosongkan jika tidak ada)",
      "uraianJenisBarang": "Nama atau deskripsi komoditas barang SAJA (WAJIB HAPUS dan JANGAN sertakan part number maupun customer part no seperti (575000 / W000103691). Contoh: VS TMEAO FBP AIO with Logo 350mm 14\")",
      "jumlahDanSatuanBarang": "Misal: 3,975 PC",
      "kemasan": "Jumlah dan jenis kemasan barang ini. KHUSUS dokumen VALEO & SINAR ASIA: nilainya SAMA SEMUA untuk seluruh baris barang, yaitu diambil dari Total Kemasan / Total Pallet Packing List / Invoice (misal: '816 BOX' untuk Valeo, atau '22 PALLET' / '22 PL' untuk Sinar Asia). JANGAN beda-beda!",
      "beratBersih": "Net weight baris barang",
      "beratKotor": "Gross weight baris barang",
      "amount": "Total harga untuk baris barang ini"
    }
  ]
}

PENTING:
- ATURAN KHUSUS MULTI-INVOICE & INVOICE SAMPLE/STORE-IN/FOC:
  * WAJIB periksa SETIAP HALAMAN dokumen dari awal sampai akhir secara seksama!
  * Seringkali dokumen pengiriman memuat lembar Fax Transmission, Booking Confirmation, atau Shipping Instruction di halaman awal (misal Page 1). BACA BAIK-BAIK bagian rincian kontainer di lembar tersebut karena seringkali mencantumkan LEBIH DARI SATU INVOICE per kontainer (misal: Container CIMU 0654754 memuat Invoice 335226 DAN Invoice SMV.B2609043; Container TLHU 8158388 memuat Invoice 335227 DAN Invoice SMV.B2609044)!
  * Invoice tambahan seperti invoice sample product atau store-in (misal awalan kode SMV.B..., SAMPLE, STORE-IN, FOC) adalah DOKUMEN PABEAN RESMI DARI SHIPMENT INI. SEMUANYA WAJIB DIDETEKSI dan dicantumkan pada field 'invoiceNumber' dan array 'invoices'!
  * JANGAN PERNAH menyaring atau mengabaikan invoice sample/store-in atau invoice dengan nominal kecil!
  * Pada 'invoiceNumber': Tuliskan SEMUA nomor invoice yang ditemukan, dipisahkan koma dan spasi (contoh: '335223, 335226, SMV.B2609043, 335227, SMV.B2609044').
  * Pada 'items': WAJIB ekstrak seluruh baris barang dari SEMUA invoice yang ada tanpa terlewat, termasuk barang dari invoice sample/store-in!
  * Untuk field 'packingListNumber': HANYA cantumkan nomor Packing List jika BENAR-BENAR TERDAPAT lembar Packing List (Daftar Kemasan / Delivery Note) atau dokumen gabungan CIPL di dalam berkas. Jika seluruh lembar dokumen HANYA memuat lembar Invoice (Rechnung / Commercial Invoice) tanpa ada lembar Packing List terpisah, WAJIB isi 'packingListNumber': null!
  * Untuk field 'blNumber', 'cooNumber', dan 'lartasNumber': JIKA TIDAK DITEMUKAN di berkas yang diunggah, WAJIB isi null! JANGAN PERNAH mengarang atau mengasumsikan nomor jika tidak tertera di dokumen asli!
- Pada 'uraianJenisBarang': HANYA tuliskan nama atau uraian komoditas barangnya saja. JANGAN sertakan nomor part (part no) maupun customer part no (misal jangan sertakan angka dalam kurung seperti (575000 / W000103691)).
- ATURAN KEMASAN BARANG KHUSUS PT. VALEO AC INDONESIA:
  Nilai kemasan untuk SETIAP baris barang di dalam list ('items') nilainya SAMA SEMUA per Packing List, BUKAN per baris atau dibagi-bagi!
  Cara melihatnya: baca baris Grand Total kemasan pada Packing List (misal jika di baris Grand Total PL tertulis '816 BOXES', maka SEMUA baris barang kemasannya diisi '816 BOX').
  Dan pada 'totalKemasan', WAJIB cantumkan total kemasan dari Packing List tersebut (misal: '816 BOXES' atau '7 PALLETS = 816 BOXES').
- ATURAN KEMASAN BARANG KHUSUS PT. SINAR ASIA PACK:
  Nilai kemasan untuk SETIAP baris barang di dalam list ('items') nilainya juga WAJIB SAMA SEMUA, TIDAK BOLEH BERBEDA-BEDA!
  Cara melihatnya: baca TOTAL PALET yang tertera di Packing List / Invoice (misal jika total palet adalah 22 PALLETS, maka SEMUA baris barang kemasannya WAJIB diisi '22 PALLET' atau '22 PL').
  JANGAN mengisi kemasan per baris dengan angka yang berbeda-beda (misal 2, 6, 1, 2, 8, 2, 1 itu SALAH, SEMUANYA HARUS '22 PALLET')!
  Dan pada 'totalKemasan', WAJIB cantumkan total palet tersebut (misal: '22 PALLETS' atau '22 PL').
- ATURAN BERAT BARANG KHUSUS PT. SINAR ASIA PACK:
  PERHATIAN: Aturan ini HANYA BERLAKU EKSKLUSIF untuk dokumen dari eksportir/shipper SINAR ASIA (PT. SINAR ASIA PACK). JANGAN terapkan pada dokumen dari perusahaan lain!
  Khusus dokumen Sinar Asia, Packing List tidak merinci berat kotor dan bersih per barang, melainkan hanya mencantumkan Total Weight.
  HANYA untuk dokumen Sinar Asia, hitung berat per baris barang dengan MEMBAGI Total Weight tersebut secara merata dengan jumlah baris barang (items).
  Contoh: Total Weight = 1,000 KGS dan terdapat 2 baris barang, maka masing-masing baris barang diisi:
  "beratBersih": "500.00 KGS",
  "beratKotor": "500.00 KGS" (1000 / 2 = 500).
  Dan jika 'totalNetWeightKGM' tidak tercantum di dokumen Sinar Asia, isi nilainya sama dengan 'totalGrossWeightKGM'.
  Untuk dokumen eksportir lain (selain Sinar Asia), WAJIB ekstrak berat kotor dan bersih persis dari dokumen aslinya tanpa dibagi.
- ATURAN DOKUMEN & ENTITAS KHUSUS PT. SINAR ASIA PACK:
  * Dokumen Packing List dan Invoice adalah 1 DOKUMEN YANG SAMA (CIPL / Commercial Invoice & Packing List).
  * Nomor Packing List selalu SAMA DENGAN Nomor Invoice.
  * Sinar Asia ada 2 kegiatan: IMPOR dan EKSPOR:
    - Jika IMPOR (Pemberitahuan Impor Barang): Consignee (Importir / Penerima) adalah "PT. Sinar Asia Pack".
    - Jika EKSPOR (Pemberitahuan Ekspor Barang): Shipper / Eksportir adalah "PT. Sinar Asia Pack", dan Consignee (Pembeli / Penerima luar negeri) adalah "Golden Ben Printer Pte Ltd".
- JANGAN membulatkan angka. Jika ada dokumen yang sama sekali tidak berhubungan, tetap isi data shipment utama yang sah dan laporkan secara tegas di safeCheck.`;

        let result;
        let attempt = 0;
        let modelsToTry = [
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.8-flash',
            'gemini-3.6-flash'
        ];
        let maxRetries = modelsToTry.length;

        while (attempt < maxRetries) {
            let modelName = modelsToTry[attempt];
            try {
                console.log(`Mencoba ekstraksi & safecheck dengan model: ${modelName} (Percobaan ${attempt + 1}/${maxRetries})...`);
                onProgress({
                    step: 'ai',
                    status: 'running',
                    message: `Ray-OCR V.1: Menganalisis dokumen & mengekstrak data shipment...`
                });

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
                console.error(`  -> Gagal pada percobaan ${attempt + 1} (${modelName}):`, apiErr.message || apiErr);
                attempt++;
                if (attempt >= maxRetries) {
                    throw new Error("Gagal mengekstrak dokumen: " + (apiErr.message || "Server Ray-OCR Engine sedang sibuk."));
                }
                console.log(`  -> Menunggu 3 detik sebelum mencoba lagi...`);
                await delay(3000);
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

        // Sinkronisasi Multi-Invoice & Packing List
        if (Array.isArray(parsedData.invoices) && parsedData.invoices.length > 0) {
            const allInvNums = parsedData.invoices
                .map(inv => String(inv.invoiceNumber || '').trim())
                .filter(Boolean);
            if (allInvNums.length > 0) {
                const currentStr = String(parsedData.invoiceNumber || '');
                const missing = allInvNums.filter(n => !currentStr.includes(n));
                if (missing.length > 0 || !parsedData.invoiceNumber) {
                    parsedData.invoiceNumber = allInvNums.join(', ');
                }
            }
        }

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

        // ATURAN KHUSUS SINAR ASIA (PT. SINAR ASIA PACK): KEMASAN TOTAL PALET SAMA SEMUA PER BARIS
        if (isSinarAsia && Array.isArray(parsedData.items) && parsedData.items.length > 0) {
            let totalPallets = 0;
            // 1. Cek dari totalKemasan
            const totalStr = String(parsedData.totalKemasan || '').trim();
            const matchTotal = totalStr.match(/(\d+[\d.,]*)\s*(PALLET|PALLETS|PLT|PL)/i);
            if (matchTotal) {
                totalPallets = parseFloat(matchTotal[1].replace(/,/g, ''));
            } else {
                // 2. Jika totalKemasan hanya angka atau belum memuat 'PALLET'
                const matchNum = totalStr.match(/(\d+[\d.,]*)/);
                if (matchNum && /pallet|plt|pl/i.test(totalStr)) {
                    totalPallets = parseFloat(matchNum[1].replace(/,/g, ''));
                } else {
                    // 3. Cek apakah di items baris-baris terpecah (misal: 2, 6, 1, 2, 8, 2, 1) -> jumlahkan jadi total palet!
                    let sumP = 0;
                    parsedData.items.forEach(it => {
                        const m = String(it.kemasan || '').match(/(\d+[\d.,]*)/);
                        if (m) sumP += parseFloat(m[1].replace(/,/g, ''));
                    });
                    if (sumP > 0) totalPallets = sumP;
                }
            }

            if (totalPallets > 0) {
                const palletStr = `${totalPallets} PALLET`;
                console.log(`[Eksklusif Sinar Asia] Total ${totalPallets} PALLET diterapkan seragam ke seluruh baris barang.`);
                parsedData.items.forEach(it => {
                    it.kemasan = palletStr;
                });
                parsedData.totalKemasan = `${totalPallets} PALLETS`;
            }

            // Aturan 1 Dokumen CIPL & Consignee Sinar Asia:
            if (!parsedData.packingListNumber || parsedData.packingListNumber === 'null') {
                parsedData.packingListNumber = parsedData.invoiceNumber || '';
            }
            // Sinar Asia ada 2 kegiatan: IMPOR dan EKSPOR
            // Parameter 'mode' ('ekspor' vs 'impor') menentukan modul CEISA yang sedang aktif
            const isExportMode = (mode === 'ekspor');
            if (isExportMode) {
                // EKSPOR (PEB / BC 3.0):
                // Eksportir / Pengirim di Indonesia: PT. Sinar Asia Pack
                // Pembeli / Penerima di Singapura: Golden Ben Printer Pte Ltd
                parsedData.shipperName = 'PT. SINAR ASIA PACK';
                if (!parsedData.consigneeName || /tidak tertera|null|sinar\s*asia/i.test(parsedData.consigneeName)) {
                    parsedData.consigneeName = 'Golden Ben Printer Pte Ltd';
                }
            } else {
                // IMPOR (PIB / BC 2.0):
                // Importir / Penerima di Indonesia: PT. Sinar Asia Pack
                // Pemasok / Pengirim di Singapura / Luar Negeri: Golden Ben Printer Pte Ltd
                parsedData.consigneeName = 'PT. SINAR ASIA PACK';
                if (!parsedData.shipperName || /tidak tertera|null|sinar\s*asia/i.test(parsedData.shipperName)) {
                    parsedData.shipperName = 'Golden Ben Printer Pte Ltd';
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

        // =======================================================
        // HARMONISASI & NORMALISASI DUA ARAH (EKSPOR <-> IMPOR CEISA 4.0)
        // =======================================================
        const cleanNum = (v) => {
            if (v === undefined || v === null || v === '' || v === 'null') return null;
            if (typeof v === 'number') return isNaN(v) ? null : v;
            const s = String(v).replace(/,/g, '').replace(/[^0-9.-]/g, '');
            const n = parseFloat(s);
            return isNaN(n) ? null : n;
        };

        const detectPackCode = (str) => {
            const s = String(str || '').toLowerCase();
            if (s.includes('pal')) return 'PX - PALLET';
            if (s.includes('box') || s.includes('bx')) return 'BX - BOX';
            if (s.includes('ctn') || s.includes('carton')) return 'CT - CARTON';
            if (s.includes('pkg') || s.includes('pack')) return 'PK - PACKAGE';
            if (s.includes('drum')) return 'DR - DRUM';
            if (s.includes('bag')) return 'BG - BAG';
            return 'BX - BOX';
        };

        const resolveCountryCode = (text, defaultCode = 'CN - CHINA') => {
            if (!text) return defaultCode;
            const s = String(text).toUpperCase();
            if (s.includes('JAPAN') || s.includes('TOKYO') || s.includes('CHIYODA') || /\bJP\b/.test(s)) return 'JP - JAPAN';
            if (s.includes('SINGAPORE') || /\bSG\b/.test(s)) return 'SG - SINGAPORE';
            if (s.includes('CHINA') || s.includes('SHANGHAI') || s.includes('GUANGDONG') || s.includes('KUNSHAN') || /\bCN\b/.test(s)) return 'CN - CHINA';
            if (s.includes('KOREA') || s.includes('SEOUL') || /\bKR\b/.test(s)) return 'KR - SOUTH KOREA';
            if (s.includes('TAIWAN') || s.includes('TAIPEI') || /\bTW\b/.test(s)) return 'TW - TAIWAN';
            if (s.includes('GERMANY') || s.includes('DEUTSCHLAND') || /\bDE\b/.test(s)) return 'DE - GERMANY';
            if (s.includes('UNITED STATES') || s.includes('USA') || /\bUS\b/.test(s)) return 'US - UNITED STATES';
            if (s.includes('MALAYSIA') || /\bMY\b/.test(s)) return 'MY - MALAYSIA';
            if (s.includes('THAILAND') || s.includes('BANGKOK') || /\bTH\b/.test(s)) return 'TH - THAILAND';
            if (s.includes('INDONESIA') || s.includes('BATAM') || s.includes('JAKARTA') || /\bID\b/.test(s)) return 'ID - INDONESIA';
            return defaultCode;
        };

        // 1. Normalisasi Entitas CEISA 4.0
        parsedData.entitas = parsedData.entitas || {};
        parsedData.pengirim = parsedData.pengirim || parsedData.entitas.pengirim || {};
        parsedData.penjual = parsedData.penjual || parsedData.entitas.penjual || {};
        parsedData.penerima = parsedData.penerima || parsedData.entitas.penerima || {};
        parsedData.pembeli = parsedData.pembeli || parsedData.entitas.pembeli || {};
        parsedData.pemilikBarang = parsedData.pemilikBarang || parsedData.entitas.pemilikBarang || parsedData.entitas.pemilik || {};

        if (isImporMode) {
            // Pada IMPOR: Shipper dokumen = Pengirim & Penjual Luar Negeri
            if (!parsedData.pengirim.nama && parsedData.shipperName) parsedData.pengirim.nama = parsedData.shipperName;
            if (!parsedData.pengirim.alamat && parsedData.shipperAddress) parsedData.pengirim.alamat = parsedData.shipperAddress;
            parsedData.pengirim.negara = resolveCountryCode(parsedData.pengirim.negara || parsedData.pengirim.alamat || parsedData.shipperAddress, 'JP - JAPAN');
            parsedData.pengirim.jenisIdentitas = parsedData.pengirim.jenisIdentitas || '4 - LAINNYA';
            parsedData.pengirim.nomorIdentitas = parsedData.pengirim.nomorIdentitas || '-';

            if (!parsedData.penjual.nama) parsedData.penjual.nama = parsedData.pengirim.nama;
            if (!parsedData.penjual.alamat) parsedData.penjual.alamat = parsedData.pengirim.alamat;
            parsedData.penjual.negara = resolveCountryCode(parsedData.penjual.negara || parsedData.penjual.alamat || parsedData.pengirim.negara, parsedData.pengirim.negara);
            parsedData.penjual.jenisIdentitas = parsedData.penjual.jenisIdentitas || '4 - LAINNYA';
            parsedData.penjual.nomorIdentitas = parsedData.penjual.nomorIdentitas || '-';

            // Consignee dokumen = Penerima, Pembeli, Pemilik Barang di Indonesia
            if (!parsedData.penerima.nama && parsedData.consigneeName) parsedData.penerima.nama = parsedData.consigneeName;
            if (!parsedData.penerima.alamat && parsedData.consigneeAddress) parsedData.penerima.alamat = parsedData.consigneeAddress;
            parsedData.penerima.negara = 'ID - INDONESIA';
            parsedData.penerima.jenisIdentitas = parsedData.penerima.jenisIdentitas || '6 - NPWP 16 DIGIT';
            parsedData.penerima.status = parsedData.penerima.status || 'LAINNYA';

            if (!parsedData.pembeli.nama) parsedData.pembeli.nama = parsedData.penerima.nama;
            if (!parsedData.pembeli.alamat) parsedData.pembeli.alamat = parsedData.penerima.alamat;
            parsedData.pembeli.negara = resolveCountryCode(parsedData.pembeli.negara || parsedData.pembeli.alamat, 'ID - INDONESIA');
            parsedData.pembeli.jenisIdentitas = parsedData.pembeli.jenisIdentitas || (parsedData.pembeli.negara === 'ID - INDONESIA' ? '6 - NPWP 16 DIGIT' : '4 - LAINNYA');
            parsedData.pembeli.nomorIdentitas = parsedData.pembeli.nomorIdentitas || (parsedData.pembeli.negara === 'ID - INDONESIA' ? parsedData.penerima.nomorIdentitas : '-');

            if (!parsedData.pemilikBarang.nama) parsedData.pemilikBarang.nama = parsedData.penerima.nama;
            if (!parsedData.pemilikBarang.alamat) parsedData.pemilikBarang.alamat = parsedData.penerima.alamat;
            parsedData.pemilikBarang.jenisIdentitas = parsedData.pemilikBarang.jenisIdentitas || parsedData.penerima.jenisIdentitas;
            parsedData.pemilikBarang.nomorIdentitas = parsedData.pemilikBarang.nomorIdentitas || parsedData.penerima.nomorIdentitas;
            parsedData.pemilikBarang.afiliasi = parsedData.pemilikBarang.afiliasi || 'TAH - Tidak berhubungan';
        } else {
            // Pada EKSPOR: Shipper dokumen = Eksportir Indonesia, Consignee = Penerima Luar Negeri
            if (!parsedData.pengirim.nama && parsedData.shipperName) parsedData.pengirim.nama = parsedData.shipperName;
            if (!parsedData.pengirim.alamat && parsedData.shipperAddress) parsedData.pengirim.alamat = parsedData.shipperAddress;
            if (!parsedData.penerima.nama && parsedData.consigneeName) parsedData.penerima.nama = parsedData.consigneeName;
            if (!parsedData.penerima.alamat && parsedData.consigneeAddress) parsedData.penerima.alamat = parsedData.consigneeAddress;
        }

        // Sinkronisasi property flat/root
        parsedData.pengirimName = parsedData.pengirim.nama || parsedData.shipperName || '';
        parsedData.pengirimAddress = parsedData.pengirim.alamat || parsedData.shipperAddress || '';
        parsedData.pengirimCountry = parsedData.pengirim.negara || resolveCountryCode(parsedData.pengirimAddress, 'CN - CHINA');
        parsedData.pengirimId = parsedData.pengirim.nomorIdentitas || '-';
        parsedData.pengirimIdType = parsedData.pengirim.jenisIdentitas || '4 - LAINNYA';

        parsedData.penjualName = parsedData.penjual.nama || parsedData.pengirimName;
        parsedData.penjualAddress = parsedData.penjual.alamat || parsedData.pengirimAddress;
        parsedData.penjualCountry = parsedData.penjual.negara || parsedData.pengirimCountry;
        parsedData.penjualId = parsedData.penjual.nomorIdentitas || '-';
        parsedData.penjualIdType = parsedData.penjual.jenisIdentitas || '4 - LAINNYA';

        parsedData.penerimaName = parsedData.penerima.nama || parsedData.consigneeName || '';
        parsedData.penerimaAddress = parsedData.penerima.alamat || parsedData.consigneeAddress || '';
        parsedData.penerimaCountry = parsedData.penerima.negara || 'ID - INDONESIA';
        parsedData.penerimaId = parsedData.penerima.nomorIdentitas || '';
        parsedData.penerimaNitku = parsedData.penerima.nitku || '';
        parsedData.penerimaStatus = parsedData.penerima.status || 'LAINNYA';

        parsedData.pembeliName = parsedData.pembeli.nama || parsedData.penerimaName;
        parsedData.pembeliAddress = parsedData.pembeli.alamat || parsedData.penerimaAddress;
        parsedData.pembeliCountry = parsedData.pembeli.negara || 'ID - INDONESIA';
        parsedData.pembeliId = parsedData.pembeli.nomorIdentitas || parsedData.penerimaId;

        parsedData.pemilikName = parsedData.pemilikBarang.nama || parsedData.penerimaName;
        parsedData.pemilikAddress = parsedData.pemilikBarang.alamat || parsedData.penerimaAddress;
        parsedData.pemilikId = parsedData.pemilikBarang.nomorIdentitas || parsedData.penerimaId;
        parsedData.pemilikAfiliasi = parsedData.pemilikBarang.afiliasi || 'TAH - Tidak berhubungan';

        // Dual-mapping untuk kompatibilitas PEB
        parsedData.shipperName = isImporMode ? parsedData.pengirimName : (parsedData.shipperName || parsedData.pengirimName);
        parsedData.shipperAddress = isImporMode ? parsedData.pengirimAddress : (parsedData.shipperAddress || parsedData.pengirimAddress);
        parsedData.consigneeName = isImporMode ? parsedData.penerimaName : (parsedData.consigneeName || parsedData.penerimaName);
        parsedData.consigneeAddress = isImporMode ? parsedData.penerimaAddress : (parsedData.consigneeAddress || parsedData.penerimaAddress);

        // 2. Normalisasi Pengangkut
        parsedData.portLoading = parsedData.portLoading || parsedData.loadingPort || '';
        parsedData.portDischarge = parsedData.portDischarge || parsedData.dischargePort || '';

        // Deteksi Cara Pengangkutan (1=LAUT, 2=UDARA, 3=DARAT, 4=POS, 5=MULTIMODA)
        const rawCara = String(parsedData.caraPengangkutan || '').toLowerCase();
        if (rawCara.includes('udara') || rawCara.includes('air') || rawCara.includes('flight') || rawCara.includes('hawb') || rawCara === '2' || rawCara.startsWith('2') || rawCara.startsWith('4 - u')) {
            parsedData.caraPengangkutan = '2 - UDARA';
        } else if (rawCara.includes('darat') || rawCara.includes('truck') || rawCara.includes('road') || rawCara === '3' || rawCara.startsWith('3')) {
            parsedData.caraPengangkutan = '3 - DARAT';
        } else if (rawCara.includes('pos') || rawCara.includes('kurir')) {
            parsedData.caraPengangkutan = '4 - POS / KURIR';
        } else if (rawCara.includes('multi')) {
            parsedData.caraPengangkutan = '5 - MULTIMODA';
        } else {
            parsedData.caraPengangkutan = '1 - LAUT';
        }

        // Koreksi Pelabuhan Transit vs Tujuan untuk Impor Indonesia
        if (isImporMode) {
            const rawDischarge = String(parsedData.portDischarge || '');
            if (/singapore|changi|jurong|\bsin\b/i.test(rawDischarge)) {
                if (!parsedData.portTransit) {
                    parsedData.portTransit = /jurong/i.test(rawDischarge) ? 'SGJUR - JURONG' : 'SGSIN - SINGAPORE';
                }
                const consLoc = String(parsedData.penerima?.alamat || parsedData.consigneeAddress || '').toUpperCase();
                if (consLoc.includes('BATAM') || consLoc.includes('SEKUPANG') || consLoc.includes('PANBIL') || consLoc.includes('MUKA KUNING')) {
                    parsedData.portDischarge = 'IDSKP - SEKUPANG';
                } else if (consLoc.includes('BATU AMPAR')) {
                    parsedData.portDischarge = 'IDBAP - BATU AMPAR';
                } else if (consLoc.includes('PRIOK') || consLoc.includes('JAKARTA') || consLoc.includes('BEKASI')) {
                    parsedData.portDischarge = 'IDTPP - TANJUNG PRIOK';
                } else {
                    parsedData.portDischarge = 'IDSKP - SEKUPANG';
                }
            }
        }
        parsedData.loadingPort = parsedData.portLoading;
        parsedData.dischargePort = parsedData.portDischarge;
        parsedData.vesselName = parsedData.vesselName || parsedData.namaPengangkut || '';
        parsedData.voyageNumber = parsedData.voyageNumber || '';
        parsedData.vesselFlag = parsedData.vesselFlag || parsedData.benderaPengangkut || '';
        parsedData.etaDate = parsedData.etaDate || parsedData.tglPerkiraanEkspor || parsedData.blDate || '';

        // 3. Normalisasi Kemasan & Berat (Angka Murni & String CEISA)
        const parsedGross = cleanNum(parsedData.grossWeight) ?? cleanNum(parsedData.totalGrossWeightKGM) ?? 0;
        const parsedNet = cleanNum(parsedData.netWeight) ?? cleanNum(parsedData.totalNetWeightKGM) ?? 0;
        const parsedPkgQty = cleanNum(parsedData.packageQty) ?? cleanNum(parsedData.totalKemasan) ?? 1;
        const packCode = parsedData.packageType || detectPackCode(parsedData.totalKemasan);

        parsedData.grossWeight = parsedGross;
        parsedData.netWeight = (parsedNet > 0) ? parsedNet : parsedGross;
        parsedData.packageQty = parsedPkgQty;
        parsedData.packageType = packCode;
        parsedData.totalGrossWeightKGM = `${parsedData.grossWeight} KGS`;
        parsedData.totalNetWeightKGM = `${parsedData.netWeight} KGS`;
        parsedData.totalKemasan = `${parsedData.packageQty} ${packCode.split(' ')[0]}`;

        // 4. Normalisasi Transaksi & CIF
        parsedData.currency = parsedData.currency || parsedData.invoices?.[0]?.currency || 'USD';
        parsedData.incoterm = parsedData.incoterm || 'FOB';
        parsedData.invoiceAmount = cleanNum(parsedData.invoiceAmount) ?? cleanNum(parsedData.invoices?.[0]?.amount) ?? 0;
        parsedData.freightAmount = cleanNum(parsedData.freightAmount) ?? 0;
        parsedData.insuranceAmount = cleanNum(parsedData.insuranceAmount) ?? 0;
        parsedData.insuranceType = parsedData.insuranceType || 'LN - Luar Negeri';
        parsedData.cifAmount = cleanNum(parsedData.cifAmount) ?? (parsedData.invoiceAmount + parsedData.freightAmount + parsedData.insuranceAmount);

        // 5. Normalisasi Item/Barang
        if (Array.isArray(parsedData.items) && parsedData.items.length > 0) {
            parsedData.items.forEach((it, idx) => {
                it.seri = idx + 1;
                it.hsCode = String(it.hsCode || '').replace(/\D/g, '').padEnd(8, '0').slice(0, 10);
                if (it.hsCode.length >= 8) {
                    it.hsCode = `${it.hsCode.slice(0, 4)}.${it.hsCode.slice(4, 6)}.${it.hsCode.slice(6, 8)}`;
                }
                it.kodeBarang = it.kodeBarang || '-';
                // Normalisasi nama barang jika tercemar istilah teknis MSDS (seperti HARDENER):
                if (it.uraianJenisBarang) {
                    let desc = it.uraianJenisBarang.trim();
                    const fullContext = `${parsedData.safeCheck?.summary || ''} ${JSON.stringify(parsedData.safeCheck?.matchedIdentifiers || [])} ${JSON.stringify(parsedData.safeCheck?.documentList || [])}`;
                    if (/pelucure/i.test(fullContext) || /pelucure/i.test(it.uraianJenisBarang) || /pelucure/i.test(it.spesifikasi || '')) {
                        if (/^hardener$/i.test(desc) || /^pelucure\s+hardener$/i.test(desc)) {
                            it.uraianJenisBarang = 'PELUCURE (A61301T3152X)';
                            it.merk = 'PELUCURE';
                            it.tipe = it.tipe && it.tipe !== '-' ? it.tipe : 'HY-680';
                            it.spesifikasi = 'HY-680 1KG/UNCAN';
                        } else if (/\bhardener\b/i.test(desc)) {
                            it.uraianJenisBarang = desc.replace(/\bhardener\b/gi, '').replace(/\s{2,}/g, ' ').trim();
                        }
                    }
                }
                it.merek = it.merek || '-';
                if (/pelnox/i.test(it.merek) && /pelucure/i.test(it.uraianJenisBarang || '')) {
                    it.merek = 'PELUCURE';
                }
                it.tipe = it.tipe || '-';
                it.spesifikasi = it.spesifikasi || '-';
                it.negaraAsal = resolveCountryCode(it.negaraAsal || it.countryOfOrigin || parsedData.pengirimCountry, parsedData.pengirimCountry || 'JP - JAPAN');
                it.countryOfOrigin = it.negaraAsal;

                const qVal = cleanNum(it.quantity) ?? cleanNum(it.jumlahDanSatuanBarang) ?? 1;
                it.quantity = qVal;
                it.satuanBarang = it.satuanBarang || (it.jumlahDanSatuanBarang ? String(it.jumlahDanSatuanBarang).replace(/[0-9.,]/g, '').trim().toUpperCase() : 'PCE') || 'PCE';
                it.packageUnit = it.satuanBarang;
                it.jumlahDanSatuanBarang = `${it.quantity} ${it.satuanBarang}`;

                it.kemasanQty = cleanNum(it.kemasanQty) ?? cleanNum(it.kemasan) ?? 1;
                it.kemasanJenis = it.kemasanJenis || packCode;
                it.beratBersih = cleanNum(it.beratBersih) ?? 0;
                it.beratKotor = cleanNum(it.beratKotor) ?? 0;

                const itAmt = cleanNum(it.amount) ?? cleanNum(it.cifUsd) ?? 0;
                it.amount = itAmt;
                it.fob = itAmt;
                it.cifUsd = cleanNum(it.cifUsd) ?? itAmt;
                it.tarifBm = cleanNum(it.tarifBm) !== null ? cleanNum(it.tarifBm) : 5.0;
            });
        }
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

            onProgress({
                step: 'safecheck',
                status: 'done',
                message: `SafeCheck: ${parsedData.safeCheck.isRelated ? 'VALID / 1 Shipment' : 'PERINGATAN DOKUMEN'} (${parsedData.safeCheck.confidenceScore || 100}%)`,
                safeCheck: parsedData.safeCheck
            });
        }

        // Tentukan folder penyimpanan: khusus impor atau ekspor
        const isImpor = (mode && (mode.toLowerCase().includes('impor') || mode.toLowerCase().includes('pib') || mode.toLowerCase().includes('import'))) ||
            (parsedData && (parsedData.jenisDokumen === 'PIB' || parsedData.isImport));
        const subFolder = isImpor ? 'impor' : 'ekspor';
        const docPrefix = isImpor ? 'Draft_PIB_' : 'Draft_PEB_';
        const filename = `${docPrefix}${Date.now()}.json`;

        // 1. Simpan di backend-service/temp/drafts/<ekspor|impor>
        const draftsDir = path.join(__dirname, 'temp', 'drafts', subFolder);
        fs.mkdirSync(draftsDir, { recursive: true });
        const draftPath = path.join(draftsDir, filename);
        fs.writeFileSync(draftPath, JSON.stringify(parsedData, null, 2));

        // 2. Simpan juga di root workspace c:\Synthetic\drafts\<ekspor|impor> agar user mudah akses
        const rootDraftsDir = path.join(__dirname, '..', 'drafts', subFolder);
        fs.mkdirSync(rootDraftsDir, { recursive: true });
        const rootDraftPath = path.join(rootDraftsDir, filename);
        fs.writeFileSync(rootDraftPath, JSON.stringify(parsedData, null, 2));

        console.log(`Berhasil mengekstrak data! Tersimpan di: ${draftPath} dan ${rootDraftPath}`);
        onProgress({
            step: 'complete',
            status: 'done',
            message: `Ekstraksi dokumen selesai. Data disimpan di folder drafts/${subFolder}/`,
            savedFolder: `drafts/${subFolder}/`,
            filename: filename,
            subFolder: subFolder
        });
        return parsedData;

    } catch (err) {
        console.error('Error saat ekstraksi dokumen:', err.message || err);
        throw err;
    }
}

// Untuk tes lokal
if (require.main === module) {
    (async () => {
        const attachDir = path.join(__dirname, 'temp', 'attachments');
        fs.mkdirSync(attachDir, { recursive: true });
        let files = fs.readdirSync(attachDir).filter(f => f.endsWith('.pdf'));
        let targetDir = attachDir;

        if (files.length === 0) {
            const rootAttach = path.join(__dirname, '..', 'attachments');
            if (fs.existsSync(rootAttach)) {
                const rootPdfs = fs.readdirSync(rootAttach).filter(f => f.endsWith('.pdf'));
                if (rootPdfs.length > 0) {
                    files = rootPdfs;
                    targetDir = rootAttach;
                }
            }
        }

        if (files.length > 0) {
            console.log(`Ditemukan ${files.length} dokumen PDF di folder ${targetDir}.`);
            const pdfPaths = files.map(file => path.join(targetDir, file));

            // Proses SEMUA file sekaligus sebagai satu shipment
            await parseDocuments(pdfPaths, (p) => {
                if (p.status === 'done') console.log(`  -> ${p.message}`);
            });
            console.log("---------------------------------------------------");
            console.log("Proses ekstraksi multi-dokumen selesai.");
        } else {
            console.log("Tidak ada file PDF di folder temp/attachments atau attachments/ untuk dites.");
        }
    })();
}

module.exports = { parseDocuments, getAiClient };
