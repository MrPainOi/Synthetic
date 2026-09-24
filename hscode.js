// ====================================================================
// CEISA 4.0 HS CODE CHECKER & BTKI ENGINE (hscode.js)
// 100% External, Chrome Extension CSP Compliant
// ====================================================================

// DATASET BUKU TARIF KEPABEANAN INDONESIA (BTKI 2022/2027) & LARTAS RESMI
const BTKI_DATABASE = [
    {
        hsCode: "8544.49.95.00",
        formattedCode: "8544.49.95.00",
        bab: "85",
        babTitle: "Mesin, Peralatan Listrik & Elektronik",
        uraianId: "Konduktor listrik lainnya, untuk tegangan tidak melebihi 1.000 V: Berisolasi dengan plastik, lainnya",
        uraianEn: "Other electric conductors, for a voltage not exceeding 1,000 V: Insulated with plastics, other",
        satuan: "KGM / MTR",
        bmMfn: 5,
        bmPreferensi: {
            atiga: "0% (Form D)",
            acfta: "0% (Form E)",
            akfta: "0% (Form AK)",
            ijepa: "0% (Form JIEPA)",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) & LAPORAN SURVEYOR (LS)",
        lartasInstansi: "Kementerian Perdagangan (Kemendag)",
        lartasDasarHukum: "Permendag No. 36/2023 jo. No. 8/2024 tentang Kebijakan dan Pengaturan Impor (Komoditas Elektronik & Kabel)",
        lartasDokumen: ["Persetujuan Impor (PI) Kemendag", "Laporan Surveyor (LS) Negara Muat", "Sertifikat SNI Wajib (SNI 04-6629.3-2006)"],
        lartasEkspor: false,
        keywords: ["kabel", "cable", "electric", "conductor", "copper", "tembaga", "pvc", "kawat", "wire", "listrik"]
    },
    {
        hsCode: "8544.42.99.00",
        formattedCode: "8544.42.99.00",
        bab: "85",
        babTitle: "Mesin, Peralatan Listrik & Elektronik",
        uraianId: "Konduktor listrik lainnya, untuk tegangan tidak melebihi 1.000 V: Dipasangi fiting, lainnya",
        uraianEn: "Other electric conductors, fitted with connectors, other",
        satuan: "KGM / PCE",
        bmMfn: 5,
        bmPreferensi: {
            atiga: "0% (Form D)",
            acfta: "0% (Form E)",
            akfta: "0% (Form AK)",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB LAPORAN SURVEYOR (LS)",
        lartasInstansi: "Kementerian Perdagangan (Kemendag)",
        lartasDasarHukum: "Permendag No. 36/2023 jo. No. 8/2024",
        lartasDokumen: ["Laporan Surveyor (LS)"],
        lartasEkspor: false,
        keywords: ["kabel konektor", "harness", "wire harness", "lead wire", "fittings", "kabel assembly"]
    },
    {
        hsCode: "8538.90.99.00",
        formattedCode: "8538.90.99.00",
        bab: "85",
        babTitle: "Mesin, Peralatan Listrik & Elektronik",
        uraianId: "Bagian yang semata-mata atau terutama cocok untuk peralatan dari pos 85.35, 85.36 atau 85.37: Lain-lain (Terminal Blok, Konektor, Housing)",
        uraianEn: "Parts suitable for use solely or principally with the apparatus of heading 85.35, 85.36 or 85.37: Other (Terminal, Connector)",
        satuan: "KGM / PCE",
        bmMfn: 0,
        bmPreferensi: {
            atiga: "0%",
            acfta: "0%",
            akfta: "0%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: false,
        lartasKategori: "BEBAS LARTAS (JALUR HIJAU KEPATUHAN)",
        lartasInstansi: "Direktorat Jenderal Bea dan Cukai (DJBC)",
        lartasDasarHukum: "Ketentuan Umum Tata Niaga Bebas",
        lartasDokumen: ["Invoice Komersial", "Packing List", "B/L / Air Waybill"],
        lartasEkspor: false,
        keywords: ["terminal", "connector", "pin terminal", "housing", "lug", "crimping", "switchgear parts"]
    },
    {
        hsCode: "8504.40.90.00",
        formattedCode: "8504.40.90.00",
        bab: "85",
        babTitle: "Mesin, Peralatan Listrik & Elektronik",
        uraianId: "Konverter statis lainnya (Power Supply Unit, Inverter, Rectifier, Adaptor Daya)",
        uraianEn: "Static converters: Other (Power Supply Units, Inverters, Adapters)",
        satuan: "PCE",
        bmMfn: 0,
        bmPreferensi: {
            atiga: "0%",
            acfta: "0%",
            akfta: "0%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) & SNI ELEKTRONIK",
        lartasInstansi: "Kementerian Perindustrian & Kemendag",
        lartasDasarHukum: "Permenperin No. 6/2024 tentang Standar Industri Power Supply & Adaptor",
        lartasDokumen: ["Persetujuan Impor (PI)", "Sertifikat SPPT-SNI", "Laporan Surveyor (LS)"],
        lartasEkspor: false,
        keywords: ["power supply", "inverter", "adaptor", "charger", "rectifier", "catu daya", "elektronik"]
    },
    {
        hsCode: "8471.30.20.00",
        formattedCode: "8471.30.20.00",
        bab: "84",
        babTitle: "Reaktor Nuklir, Ketel, Mesin & Peralatan Mekanis",
        uraianId: "Komputer jinjing (Laptop / Notebook) dengan berat tidak lebih dari 10 kg, terdiri dari setidaknya satu unit pemroses pusat, keyboard, dan layar",
        uraianEn: "Laptops (Notebooks) weighing not more than 10 kg, consisting of at least a CPU, keyboard and display",
        satuan: "PCE",
        bmMfn: 0,
        bmPreferensi: {
            atiga: "0%",
            acfta: "0%",
            akfta: "0%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) B2B & SERTIFIKASI SDPPI",
        lartasInstansi: "Kementerian Komunikasi dan Informatika & Kemendag",
        lartasDasarHukum: "Permenkominfo No. 16/2018 (Sertifikasi Alat Telekomunikasi) & Permendag 36/2023",
        lartasDokumen: ["Sertifikat Alat & Perangkat SDPPI", "Persetujuan Impor (PI) Laptop/Komputer", "Laporan Surveyor (LS)"],
        lartasEkspor: false,
        keywords: ["laptop", "notebook", "komputer", "pc", "computer", "macbook", "ultrabook"]
    },
    {
        hsCode: "8481.80.30.00",
        formattedCode: "8481.80.30.00",
        bab: "84",
        babTitle: "Reaktor Nuklir, Ketel, Mesin & Peralatan Mekanis",
        uraianId: "Keran, klep, katup dan peralatan semacam itu untuk pipa: Katup gerbang (Gate Valves) dari besi atau baja",
        uraianEn: "Taps, cocks, valves and similar appliances for pipes: Gate valves of iron or steel",
        satuan: "KGM / PCE",
        bmMfn: 5,
        bmPreferensi: {
            atiga: "0% (Form D)",
            acfta: "0% (Form E)",
            akfta: "0%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) BESI BAJA & PRODUK TURUNAN",
        lartasInstansi: "Kementerian Perdagangan (Kemendag)",
        lartasDasarHukum: "Permendag No. 36/2023 jo No. 8/2024 (Lampiran Besi Baja)",
        lartasDokumen: ["Persetujuan Impor (PI) Besi Baja", "Laporan Surveyor (LS)", "Mill Test Certificate (MTC)"],
        lartasEkspor: false,
        keywords: ["valve", "gate valve", "katup", "klep", "keran", "flange", "piping", "fitting pipa"]
    },
    {
        hsCode: "7208.39.00.00",
        formattedCode: "7208.39.00.00",
        bab: "72",
        babTitle: "Besi dan Baja",
        uraianId: "Produk canai lantaian dari besi atau baja bukan paduan, lebar 600 mm atau lebih, dalam gulungan (Hot Rolled Coils - HRC), ketebalan kurang dari 3 mm",
        uraianEn: "Flat-rolled products of iron or non-alloy steel, width 600 mm or more, in coils (HRC), thickness less than 3 mm",
        satuan: "TNE / KGM",
        bmMfn: 15,
        bmPreferensi: {
            atiga: "0% (Form D)",
            acfta: "5% (Form E)",
            akfta: "5%",
            ijepa: "0%",
            rcep: "5%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) BESI BAJA, LS & REKOMENDASI PERTEK",
        lartasInstansi: "Kementerian Perindustrian & Kementerian Perdagangan",
        lartasDasarHukum: "Permenperin Pertimbangan Teknis (Pertek) & Permendag 36/2023",
        lartasDokumen: ["Persetujuan Impor (PI) Besi Baja", "Pertimbangan Teknis (Pertek) Kemenperin", "Laporan Surveyor (LS)", "Mill Certificate"],
        lartasEkspor: false,
        keywords: ["hrc", "hot rolled coil", "baja", "besi", "steel coil", "pelat baja", "canai panas"]
    },
    {
        hsCode: "7306.30.90.00",
        formattedCode: "7306.30.90.00",
        bab: "73",
        babTitle: "Barang dari Besi atau Baja",
        uraianId: "Tabung, pipa dan profil berongga lainnya, dari besi atau baja bukan paduan, dilas, berpenampang lingkaran, lainnya",
        uraianEn: "Other tubes, pipes and hollow profiles, of iron or non-alloy steel, welded, circular cross-section, other",
        satuan: "KGM / MTR",
        bmMfn: 10,
        bmPreferensi: {
            atiga: "0%",
            acfta: "0%",
            akfta: "0%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) & LAPORAN SURVEYOR (LS)",
        lartasInstansi: "Kementerian Perdagangan (Kemendag)",
        lartasDasarHukum: "Permendag No. 36/2023 jo No. 8/2024",
        lartasDokumen: ["Persetujuan Impor (PI) Besi Baja", "Laporan Surveyor (LS)"],
        lartasEkspor: false,
        keywords: ["pipa", "pipe", "steel pipe", "pipa baja", "pipa las", "welded pipe", "tubing"]
    },
    {
        hsCode: "3901.10.12.00",
        formattedCode: "3901.10.12.00",
        bab: "39",
        babTitle: "Plastik dan Barang Daripadanya",
        uraianId: "Polimer dari etilena, dalam bentuk asal: Polietilena mempunyai berat jenis kurang dari 0,94 (LDPE - Low Density Polyethylene) jenis granul / pelet",
        uraianEn: "Polymers of ethylene, in primary forms: Polyethylene having a specific gravity of less than 0.94 (LDPE) in granules",
        satuan: "KGM / TNE",
        bmMfn: 5,
        bmPreferensi: {
            atiga: "0% (Form D)",
            acfta: "0% (Form E)",
            akfta: "0%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) BAHAN BAKU PLASTIK & LS",
        lartasInstansi: "Kementerian Perdagangan & Kementerian Lingkungan Hidup",
        lartasDasarHukum: "Permendag Tata Niaga Bahan Baku Plastik",
        lartasDokumen: ["Persetujuan Impor (PI) Plastik", "Laporan Surveyor (LS) Kemurnian Bahan Baku", "NIB Produsen (API-P)"],
        lartasEkspor: false,
        keywords: ["plastik", "ldpe", "polyethylene", "pelet plastik", "biji plastik", "resin", "polimer"]
    },
    {
        hsCode: "8703.23.51.00",
        formattedCode: "8703.23.51.00",
        bab: "87",
        babTitle: "Kendaraan Selain Yang Berjalan Di Atas Rel Kereta Api",
        uraianId: "Mobil penumpang bensin dengan kapasitas silinder melebihi 1.500 cc tetapi tidak melebihi 3.000 cc: Kendaraan Bermotor Penumpang (CBU - Completely Built Up)",
        uraianEn: "Motor cars for passenger transport, cylinder capacity exceeding 1,500 cc but not exceeding 3,000 cc: CBU",
        satuan: "PCE / UNIT",
        bmMfn: 50,
        bmPreferensi: {
            atiga: "0% (Form D)",
            acfta: "35% (Form E)",
            akfta: "35%",
            ijepa: "0%",
            rcep: "35%"
        },
        ppn: 11,
        pphApi: 10.0,
        pphNonApi: 15.0,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) KENDARAAN BERMOTOR & VPTI",
        lartasInstansi: "Kementerian Perdagangan & Kementerian Perhubungan",
        lartasDasarHukum: "Permendag Kebijakan Impor Kendaraan Bermotor CBU & PPnBM Barang Sangat Mewah",
        lartasDokumen: ["Persetujuan Impor (PI) Kemendag", "Sertifikat Uji Tipe (SUT) Kemenhub", "Laporan Surveyor (LS)"],
        lartasEkspor: false,
        keywords: ["mobil", "kendaraan", "car", "passenger car", "sedan", "suv", "cbu", "otomotif"]
    },
    {
        hsCode: "4011.10.00.00",
        formattedCode: "4011.10.00.00",
        bab: "40",
        babTitle: "Karet dan Barang Daripadanya",
        uraianId: "Ban pneumatik baru, dari karet: Dari jenis yang digunakan untuk mobil penumpang (termasuk station wagon dan mobil balap)",
        uraianEn: "New pneumatic tyres, of rubber: Of a kind used on motor cars (including station wagons and racing cars)",
        satuan: "PCE",
        bmMfn: 15,
        bmPreferensi: {
            atiga: "0% (Form D)",
            acfta: "0% (Form E)",
            akfta: "5%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) BAN & SNI WAJIB",
        lartasInstansi: "Kementerian Perindustrian & Kementerian Perdagangan",
        lartasDasarHukum: "Permenperin Pemberlakuan SNI Ban Wajib & Permendag Tata Niaga Impor Ban",
        lartasDokumen: ["Sertifikat Produk Penggunaan Tanda SNI (SPPT-SNI)", "Persetujuan Impor (PI) Ban", "Laporan Surveyor (LS)"],
        lartasEkspor: false,
        keywords: ["ban", "tyre", "tire", "ban mobil", "pneumatik", "karet", "tubeless"]
    },
    {
        hsCode: "1511.90.20.00",
        formattedCode: "1511.90.20.00",
        bab: "15",
        babTitle: "Lemak dan Minyak Hewani atau Nabati",
        uraianId: "Minyak kelapa sawit dan fraksinya, dimurnikan tetapi tidak dimodifikasi secara kimia: RBD Palm Olein dalam kemasan",
        uraianEn: "Palm oil and its fractions, refined but not chemically modified: RBD Palm Olein",
        satuan: "KGM / TNE",
        bmMfn: 0,
        bmPreferensi: {
            atiga: "0%",
            acfta: "0%",
            akfta: "0%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "3% s/d US$ 52/MT (Tergantung Harga Referensi Kemendag)",
        lartasImpor: false,
        lartasKategori: "LARTAS EKSPOR: WAJIB PEB EKSPOR, DMO SAWIT & PUNGUTAN SAWIT BPDPKS",
        lartasInstansi: "Kementerian Perdagangan & BPDPKS",
        lartasDasarHukum: "Kepmenkeu Tarif Bea Keluar CPO & Kepmendag Harga Referensi CPO Bulanan",
        lartasDokumen: ["Persetujuan Ekspor (PE) Kemendag", "Kuitansi Pembayaran Pungutan Sawit BPDPKS", "Laporan Surveyor Ekspor (LS)"],
        lartasEkspor: true,
        keywords: ["cpo", "sawit", "palm oil", "rbd olein", "minyak goreng", "olein", "ekspor sawit"]
    },
    {
        hsCode: "1006.30.99.00",
        formattedCode: "1006.30.99.00",
        bab: "10",
        babTitle: "Serealia",
        uraianId: "Beras digiling setengahnya atau digiling seluruhnya, disosoh atau dikilapkan maupun tidak: Beras lainnya (Beras Khusus / Premium / Medium)",
        uraianEn: "Semi-milled or wholly milled rice, whether or not polished or glazed: Other",
        satuan: "KGM / TNE",
        bmMfn: "Rp 450 / KG (Spesifik)",
        bmPreferensi: {
            atiga: "Rp 0 / KG",
            acfta: "Rp 450 / KG",
            akfta: "Rp 450 / KG",
            ijepa: "Rp 450 / KG",
            rcep: "Rp 450 / KG"
        },
        ppn: 0, // Bebas PPN (Barang Kebutuhan Pokok)
        pphApi: 0.5,
        pphNonApi: 1.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "LARTAS KETAT: KHUSUS PERUM BULOG & WAJIB KARANTINA PERTANIAN",
        lartasInstansi: "Badan Pangan Nasional (Bapanas), Kemendag & Barantan",
        lartasDasarHukum: "Perpres Stabilisasi Pasokan dan Harga Pangan & Permendag Tata Niaga Beras",
        lartasDokumen: ["Penugasan Impor Bapanas", "Persetujuan Impor (PI) Beras Kemendag", "Phytosanitary Certificate (KT-2)", "Laporan Surveyor (LS)"],
        lartasEkspor: false,
        keywords: ["beras", "rice", "serealia", "pangan", "bulog", "gabah", "sembako"]
    },
    {
        hsCode: "3004.90.99.00",
        formattedCode: "3004.90.99.00",
        bab: "30",
        babTitle: "Produk Farmasi",
        uraianId: "Obat-obatan terdiri dari produk campuran atau tidak bercampur untuk keperluan terapeutik atau profilaktik: Lain-lain",
        uraianEn: "Medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses: Other",
        satuan: "KGM / PCE",
        bmMfn: 0,
        bmPreferensi: {
            atiga: "0%",
            acfta: "0%",
            akfta: "0%",
            ijepa: "0%",
            rcep: "0%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        lartasImpor: true,
        lartasKategori: "WAJIB SURAT KETERANGAN IMPOR (SKI) DARI BADAN POM",
        lartasInstansi: "Badan Pengawas Obat dan Makanan (BPOM)",
        lartasDasarHukum: "Peraturan BPOM No. 27/2022 tentang Pengawasan Pemasukan Obat dan Makanan",
        lartasDokumen: ["Surat Keterangan Impor (SKI) BPOM", "Izin Edar BPOM (Nomor Registrasi)", "Certificate of Analysis (CoA)", "GMP Certificate"],
        lartasEkspor: false,
        keywords: ["obat", "farmasi", "medicine", "pharmaceutical", "tablet", "kapsul", "bpom", "ski"]
    },
    {
        hsCode: "6109.10.10.00",
        formattedCode: "6109.10.10.00",
        bab: "61",
        babTitle: "Pakaian dan Aksesori Pakaian, Rajutan atau Kait",
        uraianId: "T-shirt, singlet dan rompi lainnya, rajutan atau kaitan: Dari kapas: Untuk pria atau anak laki-laki",
        uraianEn: "T-shirts, singlets and other vests, knitted or crocheted: Of cotton: For men or boys",
        satuan: "PCE",
        bmMfn: 25,
        bmPreferensi: {
            atiga: "0% (Form D)",
            acfta: "5% (Form E)",
            akfta: "5%",
            ijepa: "0%",
            rcep: "5%"
        },
        ppn: 11,
        pphApi: 2.5,
        pphNonApi: 7.5,
        beaKeluar: "0%",
        bmtpTarif: "Rp 19.260 / PCE (Bea Masuk Tindakan Pengamanan - BMTP Pakaian Jadi)",
        lartasImpor: true,
        lartasKategori: "WAJIB PERSETUJUAN IMPOR (PI) TEKSTIL (TPT) & LAPORAN SURVEYOR (LS)",
        lartasInstansi: "Kementerian Perdagangan (Kemendag)",
        lartasDasarHukum: "Permendag No. 36/2023 jo No. 8/2024 & PMK Pengenaan BMTP Tekstil",
        lartasDokumen: ["Persetujuan Impor (PI) TPT", "Laporan Surveyor (LS)", "Bea Masuk Tambahan BMTP Safeguard"],
        lartasEkspor: false,
        keywords: ["kaos", "t-shirt", "baju", "pakaian", "garmen", "textile", "cotton", "katun", "singlet"]
    }
];

// STATE MANAGEMENT
let activeSelectedHsCode = null;
let currentSearchQuery = "";
let currentCategoryFilter = "all";
const STORAGE_KEY_RECENT_HS = "ceisa_recent_hscode_checks";

// DOM INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
    initHsCodeChecker();
});

function initHsCodeChecker() {
    setupSidebarToggle();
    renderRecentBadges();
    setupSearchEvents();
    setupCategoryChips();
    setupCalculatorEvents();
    setupActionButtons();

    // Check URL query parameters (e.g. ?code=8544.49.95 or ?q=kabel)
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get("code") || urlParams.get("q") || "";
    if (codeParam) {
        const searchInput = document.getElementById("hsSearchInput");
        if (searchInput) searchInput.value = codeParam;
        currentSearchQuery = codeParam.trim();
    }

    // Initial render
    performSearch();
}

// 1. SIDEBAR TOGGLE
function setupSidebarToggle() {
    const sidebarToggle = document.getElementById("ceisaSidebarToggle");
    const sidebar = document.getElementById("ceisaSidebar");
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener("click", () => {
            sidebar.classList.toggle("expanded");
            const isExpanded = sidebar.classList.contains("expanded");
            sidebarToggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
            try {
                localStorage.setItem("ceisa_sidebar_expanded", isExpanded ? "1" : "0");
            } catch (e) {}
        });

        sidebar.addEventListener("mouseleave", () => {
            if (sidebar.classList.contains("expanded")) {
                sidebar.classList.remove("expanded");
                sidebarToggle.setAttribute("aria-expanded", "false");
                try {
                    localStorage.setItem("ceisa_sidebar_expanded", "0");
                } catch (e) {}
            }
        });

        try {
            if (localStorage.getItem("ceisa_sidebar_expanded") === "1") {
                sidebar.classList.add("expanded");
                sidebarToggle.setAttribute("aria-expanded", "true");
            }
        } catch (e) {}
    }
}

// 2. SEARCH & FILTER EVENTS
function setupSearchEvents() {
    const searchInput = document.getElementById("hsSearchInput");
    const btnClear = document.getElementById("btnHsSearchClear");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentSearchQuery = e.target.value.trim();
            if (btnClear) {
                btnClear.style.display = currentSearchQuery ? "block" : "none";
            }
            performSearch();
        });

        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const q = currentSearchQuery.trim();
                performSearch(true); // save to recent
                if (q) {
                    const combined = getCombinedBtkiDatabase();
                    const cleanDigits = q.replace(/[^0-9]/g, "");
                    const hasMatch = combined.some(item => {
                        const itemDigits = item.hsCode.replace(/[^0-9]/g, "");
                        if (cleanDigits.length >= 2 && itemDigits.includes(cleanDigits)) return true;
                        if (item.uraianId.toLowerCase().includes(q.toLowerCase())) return true;
                        if (item.uraianEn.toLowerCase().includes(q.toLowerCase())) return true;
                        if (item.keywords && item.keywords.some(k => k.toLowerCase().includes(q.toLowerCase()))) return true;
                        return false;
                    });
                    if (!hasMatch) {
                        triggerDynamicLookup(q);
                    }
                }
            }
        });
    }

    if (btnClear && searchInput) {
        btnClear.addEventListener("click", () => {
            searchInput.value = "";
            currentSearchQuery = "";
            btnClear.style.display = "none";
            searchInput.focus();
            performSearch();
        });
    }
}

// 2.1 DATABASE COMBINER (BTKI MASTER + LOCAL STORAGE CACHE)
function getCombinedBtkiDatabase() {
    let custom = [];
    try {
        const stored = localStorage.getItem("ceisa_btki_custom_items");
        if (stored) custom = JSON.parse(stored);
    } catch (e) {}
    const codes = new Set(BTKI_DATABASE.map(i => i.hsCode));
    const merged = [...BTKI_DATABASE];
    if (Array.isArray(custom)) {
        custom.forEach(item => {
            if (item && item.hsCode && !codes.has(item.hsCode)) {
                codes.add(item.hsCode);
                merged.unshift(item);
            }
        });
    }
    return merged;
}

// 2.2 BACKEND SEARCH - Cari langsung dari SQLite (8000+ pos tarif)
let _backendSearchTimeout = null;
let _backendSearchAbort = null;

async function searchFromBackend(query) {
    try {
        if (_backendSearchAbort) {
            _backendSearchAbort.abort();
        }
        _backendSearchAbort = new AbortController();

        const url = `http://localhost:5005/api/hscode/search?q=${encodeURIComponent(query)}&limit=50`;
        const res = await fetch(url, {
            signal: _backendSearchAbort.signal,
            headers: { 'Cache-Control': 'max-age=300' }
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.success || !Array.isArray(data.data)) return [];

        // Konversi format SQLite ke format BTKI
        return data.data.map(row => ({
            hsCode: row.code_formatted || row.code,
            formattedCode: row.code_formatted || row.code,
            bab: String(row.chapter || row.code.substring(0, 2)).padStart(2, '0'),
            babTitle: row.chapter_title_id || '',
            uraianId: row.description_id || row.description_en || '',
            uraianEn: row.description_en || '',
            satuan: 'KGM',
            bmMfn: row.bm_mfn || 0,
            bmPreferensi: { atiga: `${row.bm_mfn||0}%`, acfta: `${row.bm_mfn||0}%`, rcep: `${row.bm_mfn||0}%` },
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
            _source: 'sqlite'
        }));
    } catch (e) {
        if (e.name !== 'AbortError') console.warn('[HSCODE] Backend search error:', e.message);
        return [];
    }
}

// 2.2 DYNAMIC LOOKUP VIA BACKEND (BTKI 2022/2027 ENGINE)
let isLookingUpOnline = false;
async function triggerDynamicLookup(query) {
    if (!query || !query.trim() || isLookingUpOnline) return;
    isLookingUpOnline = true;

    const listEl = document.getElementById("hsResultsList");
    const countEl = document.getElementById("hsResultsCount");
    if (countEl) countEl.textContent = "Sedang Mencari...";

    if (listEl) {
        listEl.innerHTML = `
            <div class="hscode-empty-lookup-box">
                <div class="ceisa-spinner" style="margin-bottom: 14px;"></div>
                <strong style="color: #0284c7; font-size: 14px; display: block; margin-bottom: 6px;">Sedang Mencari Klasifikasi Pos Tarif...</strong>
                <p style="color: #64748b; font-size: 12px; margin-bottom: 12px; line-height: 1.5;">
                    Menganalisis komoditas "<strong>${escapeHtml(query)}</strong>" terhadap database BTKI 2022/2027 & regulasi LARTAS...
                </p>
                <div style="font-size: 11px; color: #94a3b8;">
                    Menghubungkan ke backend server lokal port 5005...
                </div>
            </div>
        `;
    }

    try {
        const res = await fetch("http://localhost:5005/api/hscode/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query.trim() })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server error ${res.status}`);
        }

        const data = await res.json();
        if (data && data.data) {
            const newItem = data.data;
            // Simpan ke localStorage
            let custom = [];
            try {
                const stored = localStorage.getItem("ceisa_btki_custom_items");
                if (stored) custom = JSON.parse(stored);
            } catch (e) {}
            custom = custom.filter(c => c.hsCode !== newItem.hsCode);
            custom.unshift(newItem);
            localStorage.setItem("ceisa_btki_custom_items", JSON.stringify(custom));

            showToast(`Pos Tarif ${newItem.formattedCode} berhasil ditemukan & disimpan!`, "success");
            isLookingUpOnline = false;
            performSearch(true);
            selectHsCodeItem(newItem);
            return;
        } else {
            throw new Error("Format respons tidak valid.");
        }
    } catch (err) {
        console.error("Gagal dynamic lookup:", err);
        showToast("Pencarian otomatis gagal: " + err.message, "error");
        isLookingUpOnline = false;
        renderEmptyStateWithInsw(query, err.message);
    }
}

// 2.3 RENDER EMPTY STATE DENGAN OPSI CEK INSW & AI LOOKUP
function renderEmptyStateWithInsw(query, errorMsg = null) {
    const listEl = document.getElementById("hsResultsList");
    const countEl = document.getElementById("hsResultsCount");
    if (countEl) countEl.textContent = "0 Pos Tarif";
    if (!listEl) return;

    listEl.innerHTML = `
        <div class="hscode-empty-lookup-box">
            <div style="margin-bottom: 8px; color: var(--text-muted); display: inline-flex; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </div>
            <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">Pos Tarif Belum Ada di Database Cepat</strong>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 14px; line-height: 1.5;">
                ${query ? `Komoditas "<strong>${escapeHtml(query)}</strong>" belum ada di daftar lokal.` : 'Ketik nama barang atau kode HS untuk mencari.'}
                ${errorMsg ? `<br><span style="color: #ef4444; font-size: 11px;">(${escapeHtml(errorMsg)})</span>` : ''}
            </p>
            <div style="display: flex; flex-direction: column; gap: 8px; max-width: 320px; margin: 0 auto;">
                ${query ? `
                <button type="button" class="btn btn-primary-ceisa" id="btnTriggerAiLookup"
                    style="background: #0284c7; border-color: #0284c7; justify-content: center; padding: 9px 14px; font-weight: 600;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    Cari Otomatis via AI BTKI
                </button>
                ` : ''}
                <a href="https://www.insw.go.id/intr/detail-komoditas" target="_blank" rel="noopener noreferrer"
                    class="btn btn-insw-portal" id="btnDirectInswSearch" style="justify-content: center; padding: 9px 14px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    Cek di Web Resmi INSW ↗
                </a>
            </div>
        </div>
    `;

    const btnAi = document.getElementById("btnTriggerAiLookup");
    if (btnAi && query) {
        btnAi.addEventListener("click", () => {
            triggerDynamicLookup(query);
        });
    }

    const btnInsw = document.getElementById("btnDirectInswSearch");
    if (btnInsw && query) {
        btnInsw.addEventListener("click", () => {
            navigator.clipboard.writeText(query).then(() => {
                showToast(`Kata kunci "${query}" disalin! Tempelkan di pencarian INSW.`, "info");
            }).catch(() => {});
        });
    }
}

// 3. CATEGORY CHIP EVENTS
function setupCategoryChips() {
    const chips = document.querySelectorAll(".hscode-chip");
    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            currentCategoryFilter = chip.getAttribute("data-category") || "all";
            performSearch();
        });
    });
}

// 4. PERFORM SEARCH & RENDER RESULTS
function performSearch(recordRecent = false) {
    if (isLookingUpOnline) return;

    const query = currentSearchQuery.toLowerCase();
    const cleanDigits = query.replace(/[^0-9]/g, '');

    const database = getCombinedBtkiDatabase();
    const filtered = database.filter(item => {
        if (currentCategoryFilter !== 'all') {
            if (currentCategoryFilter === '85' && item.bab !== '85') return false;
            if (currentCategoryFilter === '84' && item.bab !== '84') return false;
            if (currentCategoryFilter === '72' && item.bab !== '72' && item.bab !== '73') return false;
            if (currentCategoryFilter === '39' && item.bab !== '39' && item.bab !== '28' && item.bab !== '29') return false;
            if (currentCategoryFilter === '87' && item.bab !== '87' && item.bab !== '40') return false;
            if (currentCategoryFilter === '10' && item.bab !== '10' && item.bab !== '15' && item.bab !== '09') return false;
            if (currentCategoryFilter === '61' && item.bab !== '61' && item.bab !== '62') return false;
            if (currentCategoryFilter === '30' && item.bab !== '30' && item.bab !== '90') return false;
        }
        if (!query) return true;
        const itemDigits = item.hsCode.replace(/[^0-9]/g, '');
        if (cleanDigits.length >= 2 && itemDigits.includes(cleanDigits)) return true;
        if (item.uraianId && item.uraianId.toLowerCase().includes(query)) return true;
        if (item.uraianEn && item.uraianEn.toLowerCase().includes(query)) return true;
        if (item.babTitle && item.babTitle.toLowerCase().includes(query)) return true;
        if (item.keywords && item.keywords.some(k => k.toLowerCase().includes(query) || query.includes(k.toLowerCase()))) return true;
        return false;
    });

    renderResultsList(filtered);

    if (filtered.length > 0) {
        const stillSelected = filtered.find(f => f.hsCode === (activeSelectedHsCode ? activeSelectedHsCode.hsCode : null));
        selectHsCodeItem(stillSelected || filtered[0]);
    } else if (!query) {
        renderEmptyDetail();
    }

    if (recordRecent && query) saveRecentSearch(query);

    // Async: cari juga dari SQLite backend (8260+ pos tarif)
    if (query && query.length >= 2) {
        clearTimeout(_backendSearchTimeout);
        _backendSearchTimeout = setTimeout(async () => {
            const backendResults = await searchFromBackend(query);
            if (!backendResults || backendResults.length === 0) {
                if (filtered.length === 0) renderEmptyStateWithInsw(currentSearchQuery);
                return;
            }
            const existingCodes = new Set(filtered.map(f => f.hsCode.replace(/\D/g, '')));
            const newItems = backendResults
                .filter(b => !existingCodes.has(b.hsCode.replace(/\D/g, '')))
                .filter(item => currentCategoryFilter === 'all' || item.bab === currentCategoryFilter);
            const combined = [...filtered, ...newItems];
            if (combined.length !== filtered.length) {
                renderResultsList(combined);
                if (filtered.length === 0 && combined.length > 0) {
                    const sel = combined.find(f => f.hsCode === (activeSelectedHsCode ? activeSelectedHsCode.hsCode : null));
                    selectHsCodeItem(sel || combined[0]);
                }
            } else {
                const countEl = document.getElementById('hsResultsCount');
                if (countEl && combined.length > 0) countEl.textContent = combined.length + ' Pos Tarif Ditemukan';
                if (combined.length === 0) renderEmptyStateWithInsw(currentSearchQuery);
            }
        }, 350);
    }
}
// 5. RENDER RESULTS LIST (LEFT COLUMN)
function renderResultsList(items) {
    const listEl = document.getElementById("hsResultsList");
    const countEl = document.getElementById("hsResultsCount");

    const sqliteCount = items.filter(i => i._source === 'sqlite').length;
    const localCount = items.length - sqliteCount;
    if (countEl) {
        if (sqliteCount > 0 && localCount > 0) {
            countEl.textContent = `${items.length} Pos Tarif (${localCount} BTKI + ${sqliteCount} WCO)`;
        } else {
            countEl.textContent = `${items.length} Pos Tarif Ditemukan`;
        }
    }
    if (!listEl) return;

    listEl.innerHTML = "";

    if (items.length === 0) {
        renderEmptyStateWithInsw(currentSearchQuery);
        return;
    }

    items.forEach(item => {
        const isSelected = activeSelectedHsCode && activeSelectedHsCode.hsCode === item.hsCode;
        const card = document.createElement("div");
        card.className = `hscode-item-card ${isSelected ? "active" : ""}`;
        card.setAttribute("data-code", item.hsCode);

        const lartasBadge = item.lartasImpor
            ? `<span class="badge-lartas-yes">LARTAS</span>`
            : `<span class="badge-lartas-no">BEBAS</span>`;

        const bmText = typeof item.bmMfn === "number" ? `BM ${item.bmMfn}%` : item.bmMfn;
        const sourceBadge = item._source === 'sqlite'
            ? `<span style="font-size:9px;background:#e0f2fe;color:#0284c7;border-radius:3px;padding:1px 4px;margin-left:4px;">WCO</span>`
            : '';

        card.innerHTML = `
            <div class="hscode-card-top">
                <span class="hscode-card-code">${item.formattedCode}${sourceBadge}</span>
                ${lartasBadge}
            </div>
            <div class="hscode-card-desc" title="${escapeHtml(item.uraianId || item.uraianEn)}">
                ${escapeHtml(item.uraianId || item.uraianEn)}
            </div>
            <div class="hscode-card-meta">
                <span class="badge-duty-rate">${bmText}</span>
                <span class="badge-duty-rate">PPN ${item.ppn}%</span>
                <span class="badge-duty-rate">PPh ${item.pphApi}%</span>
                <span style="color: #94a3b8; font-size: 10px; margin-left: auto;">Bab ${item.bab}</span>
            </div>
        `;

        card.addEventListener("click", () => {
            selectHsCodeItem(item);
        });

        listEl.appendChild(card);
    });
}

// 6. SELECT ITEM & RENDER DETAIL PANEL (RIGHT COLUMN)
function selectHsCodeItem(item) {
    if (!item) return;
    activeSelectedHsCode = item;

    // Highlight card in left list
    document.querySelectorAll(".hscode-item-card").forEach(c => {
        c.classList.toggle("active", c.getAttribute("data-code") === item.hsCode);
    });

    // Populate Detail Header
    const codeBadge = document.getElementById("detailHsCode");
    const descId = document.getElementById("detailUraianId");
    const descEn = document.getElementById("detailUraianEn");
    const babTag = document.getElementById("detailBabTag");

    if (codeBadge) codeBadge.textContent = item.formattedCode;
    if (descId) descId.textContent = item.uraianId;
    if (descEn) descEn.textContent = item.uraianEn ? `EN: ${item.uraianEn}` : "";
    if (babTag) babTag.textContent = `BAB ${item.bab} - ${item.babTitle}`;

    // Populate Duty & Tax Rates
    const bmVal = document.getElementById("valDutyBm");
    const ppnVal = document.getElementById("valDutyPpn");
    const pphVal = document.getElementById("valDutyPph");
    const bkVal = document.getElementById("valDutyBk");

    if (bmVal) bmVal.textContent = typeof item.bmMfn === "number" ? `${item.bmMfn}%` : item.bmMfn;
    if (ppnVal) ppnVal.textContent = `${item.ppn}%`;
    if (pphVal) pphVal.textContent = `${item.pphApi}% (API)`;
    if (bkVal) bkVal.textContent = item.beaKeluar || "0%";

    // Populate FTA Preferences Table
    const ftaList = document.getElementById("detailFtaList");
    if (ftaList && item.bmPreferensi) {
        ftaList.innerHTML = Object.entries(item.bmPreferensi).map(([key, val]) => `
            <div class="hscode-fta-row">
                <span class="hscode-fta-key">${key}:</span>
                <span class="hscode-fta-val">${val}</span>
            </div>
        `).join("");
    }

    // Populate Lartas Section
    const lartasBox = document.getElementById("detailLartasBox");
    const lartasTitle = document.getElementById("detailLartasTitle");
    const lartasInstansi = document.getElementById("detailLartasInstansi");
    const lartasHukum = document.getElementById("detailLartasHukum");
    const lartasDocsList = document.getElementById("detailLartasDocsList");

    if (lartasBox) {
        lartasBox.className = `hscode-lartas-box ${item.lartasImpor ? "lartas-active" : "lartas-free"}`;
    }
    if (lartasTitle) {
        lartasTitle.textContent = item.lartasKategori || (item.lartasImpor ? "TERKENA LARTAS IMPOR" : "BEBAS LARTAS");
        lartasTitle.style.color = item.lartasImpor ? "#b91c1c" : "#15803d";
    }
    if (lartasInstansi) {
        lartasInstansi.textContent = item.lartasInstansi || "-";
    }
    if (lartasHukum) {
        lartasHukum.textContent = item.lartasDasarHukum || "-";
    }
    if (lartasDocsList) {
        lartasDocsList.innerHTML = "";
        const docs = item.lartasDokumen || [];
        if (docs.length > 0) {
            docs.forEach(doc => {
                const li = document.createElement("li");
                li.style.marginBottom = "4px";
                li.innerHTML = `<strong>•</strong> ${escapeHtml(doc)}`;
                lartasDocsList.appendChild(li);
            });
        } else {
            lartasDocsList.innerHTML = `<li style="color: #64748b;">Tidak ada dokumen perizinan khusus yang dipersyaratkan.</li>`;
        }
    }

    // Update Live Calculator
    calculateSimulation();
}

function renderEmptyDetail() {
    activeSelectedHsCode = null;
    const codeBadge = document.getElementById("detailHsCode");
    const descId = document.getElementById("detailUraianId");
    if (codeBadge) codeBadge.textContent = "POS TARIF TIDAK DIPILIH";
    if (descId) descId.textContent = "Silakan pilih salah satu pos tarif pada kolom hasil pencarian.";
}

// 7. REAL-TIME TARIFF CALCULATOR
function setupCalculatorEvents() {
    const calcCif = document.getElementById("calcCifAmount");
    const calcRate = document.getElementById("calcExchangeRate");
    const calcApi = document.getElementById("calcImportirStatus");

    [calcCif, calcRate, calcApi].forEach(el => {
        if (el) {
            el.addEventListener("input", calculateSimulation);
            el.addEventListener("change", calculateSimulation);
        }
    });
}

function calculateSimulation() {
    if (!activeSelectedHsCode) return;

    const cifUsd = parseFloat(document.getElementById("calcCifAmount")?.value) || 0;
    const rate = parseFloat(document.getElementById("calcExchangeRate")?.value) || 16300;
    const isApi = document.getElementById("calcImportirStatus")?.value !== "non_api";

    const cifRp = Math.round(cifUsd * rate);

    // BM rate
    let bmRateNum = 0;
    if (typeof activeSelectedHsCode.bmMfn === "number") {
        bmRateNum = activeSelectedHsCode.bmMfn / 100;
    }
    const bmRp = Math.round(cifRp * bmRateNum);

    // Nilai Impor = CIF + BM
    const nilaiImporRp = cifRp + bmRp;

    // PPN = Nilai Impor * 11%
    const ppnRate = (activeSelectedHsCode.ppn || 11) / 100;
    const ppnRp = Math.round(nilaiImporRp * ppnRate);

    // PPh = Nilai Impor * (API 2.5% or Non-API 7.5%)
    const pphRate = (isApi ? (activeSelectedHsCode.pphApi || 2.5) : (activeSelectedHsCode.pphNonApi || 7.5)) / 100;
    const pphRp = Math.round(nilaiImporRp * pphRate);

    const totalBilling = bmRp + ppnRp + pphRp;

    // Update UI elements
    const elCifRp = document.getElementById("calcResCifRp");
    const elBmRp = document.getElementById("calcResBmRp");
    const elPpnRp = document.getElementById("calcResPpnRp");
    const elPphRp = document.getElementById("calcResPphRp");
    const elTotal = document.getElementById("calcResTotalBilling");

    if (elCifRp) elCifRp.textContent = `Rp ${cifRp.toLocaleString("id-ID")}`;
    if (elBmRp) elBmRp.textContent = `Rp ${bmRp.toLocaleString("id-ID")}`;
    if (elPpnRp) elPpnRp.textContent = `Rp ${ppnRp.toLocaleString("id-ID")}`;
    if (elPphRp) elPphRp.textContent = `Rp ${pphRp.toLocaleString("id-ID")}`;
    if (elTotal) elTotal.textContent = `Rp ${totalBilling.toLocaleString("id-ID")}`;
}

// 8. ACTION BUTTONS (COPY, APPLY TO PIB, APPLY TO PEB)
function setupActionButtons() {
    // 8.1 Copy HS Code
    const btnCopy = document.getElementById("btnCopyHsCode");
    if (btnCopy) {
        btnCopy.addEventListener("click", () => {
            if (!activeSelectedHsCode) return;
            const codeToCopy = activeSelectedHsCode.formattedCode.replace(/[^0-9]/g, "");
            navigator.clipboard.writeText(codeToCopy).then(() => {
                showToast(`Pos Tarif ${activeSelectedHsCode.formattedCode} disalin ke clipboard!`, "success");
            }).catch(() => {
                showToast(`Salin: ${codeToCopy}`, "info");
            });
        });
    }

    // 8.1.1 Buka Web Resmi INSW
    const btnCheckInsw = document.getElementById("btnCheckInswWeb");
    if (btnCheckInsw) {
        btnCheckInsw.addEventListener("click", () => {
            if (!activeSelectedHsCode) return;
            const codeToCopy = activeSelectedHsCode.formattedCode.replace(/[^0-9]/g, "");
            navigator.clipboard.writeText(codeToCopy).then(() => {
                showToast(`Kode HS ${activeSelectedHsCode.formattedCode} disalin! Membuka portal INSW...`, "info");
            }).catch(() => {
                showToast("Membuka portal INSW...", "info");
            });
        });
    }

    // 8.2 Terapkan ke Draft PIB
    const btnApplyPib = document.getElementById("btnApplyToPib");
    if (btnApplyPib) {
        btnApplyPib.addEventListener("click", () => {
            if (!activeSelectedHsCode) return;
            const payload = {
                hsCode: activeSelectedHsCode.formattedCode.replace(/[^0-9]/g, ""),
                uraian: activeSelectedHsCode.uraianId,
                bmRate: typeof activeSelectedHsCode.bmMfn === "number" ? activeSelectedHsCode.bmMfn : 5,
                ppnRate: activeSelectedHsCode.ppn || 11,
                pphRate: activeSelectedHsCode.pphApi || 2.5,
                satuan: activeSelectedHsCode.satuan.split("/")[0].trim()
            };
            try {
                localStorage.setItem("ceisa_apply_to_pib", JSON.stringify(payload));
            } catch (e) {}
            showToast("Menerapkan ke Draft PIB...", "info");
            setTimeout(() => {
                window.location.href = "pib.html";
            }, 300);
        });
    }

    // 8.3 Terapkan ke Draft PEB
    const btnApplyPeb = document.getElementById("btnApplyToPeb");
    if (btnApplyPeb) {
        btnApplyPeb.addEventListener("click", () => {
            if (!activeSelectedHsCode) return;
            const payload = {
                hsCode: activeSelectedHsCode.formattedCode.replace(/[^0-9]/g, ""),
                uraian: activeSelectedHsCode.uraianId,
                satuan: activeSelectedHsCode.satuan.split("/")[0].trim()
            };
            try {
                localStorage.setItem("ceisa_apply_to_peb", JSON.stringify(payload));
            } catch (e) {}
            showToast("Menerapkan ke Draft PEB...", "info");
            setTimeout(() => {
                window.location.href = "peb.html";
            }, 300);
        });
    }

    // 8.4 AI Smart Technical Classifier Modal / Prompt Trigger
    const btnAiClassify = document.getElementById("btnAiSmartClassify");
    if (btnAiClassify) {
        btnAiClassify.addEventListener("click", () => {
            const promptText = prompt(
                "CEISA AI Pos Tarif Classifier\n\nMasukkan atau tempel deskripsi spesifikasi barang dari Invoice / Packing List (Indonesia / English):",
                "ELECTRIC COPPER WIRE WITH PLASTIC INSULATION 600V"
            );
            if (!promptText || !promptText.trim()) return;

            const q = promptText.trim().toLowerCase();
            const searchInput = document.getElementById("hsSearchInput");
            if (searchInput) {
                searchInput.value = promptText.trim();
                currentSearchQuery = promptText.trim();
            }

            // Keyword scoring across database
            let bestMatch = null;
            let highestScore = -1;

            BTKI_DATABASE.forEach(item => {
                let score = 0;
                const fullText = (item.uraianId + " " + item.uraianEn + " " + (item.keywords || []).join(" ")).toLowerCase();
                const words = q.split(/[\s,./-]+/).filter(w => w.length > 2);
                words.forEach(w => {
                    if (fullText.includes(w)) score += 10;
                });
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = item;
                }
            });

            if (bestMatch && highestScore > 0) {
                selectHsCodeItem(bestMatch);
                showToast(`🤖 Rekomendasi AI: ${bestMatch.formattedCode} (${bestMatch.uraianId.substring(0, 40)}...)`, "success");
            } else {
                performSearch(true);
            }
        });
    }
}

// 9. RECENT SEARCHES MANAGEMENT
function saveRecentSearch(query) {
    if (!query) return;
    try {
        let recents = JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT_HS) || "[]");
        recents = recents.filter(r => r.toLowerCase() !== query.toLowerCase());
        recents.unshift(query);
        if (recents.length > 6) recents.pop();
        localStorage.setItem(STORAGE_KEY_RECENT_HS, JSON.stringify(recents));
        renderRecentBadges();
    } catch (e) {}
}

function renderRecentBadges() {
    const container = document.getElementById("hsRecentContainer");
    if (!container) return;

    try {
        const recents = JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT_HS) || "[]");
        if (recents.length === 0) {
            container.style.display = "none";
            return;
        }
        container.style.display = "flex";
        const listEl = document.getElementById("hsRecentList");
        if (!listEl) return;
        listEl.innerHTML = "";

        recents.forEach(r => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "hscode-chip";
            btn.style.fontSize = "10.5px";
            btn.style.padding = "2px 8px";
            btn.textContent = r;
            btn.addEventListener("click", () => {
                const searchInput = document.getElementById("hsSearchInput");
                if (searchInput) searchInput.value = r;
                currentSearchQuery = r;
                performSearch();
            });
            listEl.appendChild(btn);
        });
    } catch (e) {}
}

// HELPER: ESCAPE HTML
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// HELPER: SHOW TOAST NOTIFICATION
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.log(`[Toast] ${message}`);
        return;
    }
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    if (type === 'success') {
        toast.style.background = '#15803d';
        toast.style.color = '#ffffff';
    } else if (type === 'error') {
        toast.style.background = '#b91c1c';
        toast.style.color = '#ffffff';
    } else {
        toast.style.background = '#0284c7';
        toast.style.color = '#ffffff';
    }
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}
