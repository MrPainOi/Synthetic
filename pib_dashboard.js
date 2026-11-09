// ====================================================================
// CEISA 4.0 MODUL DRAFT PIB (PEMBERITAHUAN IMPOR BARANG - BC 2.0)
// pib_dashboard.js - 100% External, Chrome Extension CSP Compliant
// ====================================================================

// Helper resolver URL backend dinamis (Localhost vs WiFi IP / HP)
function getBackendUrl(path = '') {
    if (typeof window.getCeisaBackendUrl === 'function') {
        return window.getCeisaBackendUrl(path);
    }
    let base = 'http://localhost:5005';
    try {
        if (typeof window !== 'undefined' && window.location) {
            const host = window.location.hostname;
            // Jika diakses dari HP / laptop lain via WiFi IP (192.168.x.x, 10.x.x.x, dsb)
            if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
                base = `http://${host}:5005`;
            }
        }
    } catch (_) {}
    if (path) {
        if (!path.startsWith('/')) path = '/' + path;
        return `${base}${path}`;
    }
    return base;
}

// 9-TAB DEFINITION FOR PIB (BC 2.0)
const PIB_TAB_ORDER = [
    'pib-tab-header',
    'pib-tab-entitas',
    'pib-tab-dokumen',
    'pib-tab-pengangkut',
    'pib-tab-kemasan',
    'pib-tab-transaksi',
    'pib-tab-barang',
    'pib-tab-pungutan',
    'pib-tab-pernyataan'
];

const PIB_TAB_TITLES = {
    'pib-tab-header': 'Header',
    'pib-tab-entitas': 'Entitas',
    'pib-tab-dokumen': 'Dokumen',
    'pib-tab-pengangkut': 'Pengangkut',
    'pib-tab-kemasan': 'Kemasan & Peti Kemas',
    'pib-tab-transaksi': 'Transaksi',
    'pib-tab-barang': 'Barang',
    'pib-tab-pungutan': 'Pungutan',
    'pib-tab-pernyataan': 'Pernyataan'
};

const STORAGE_KEY_LAST_PIB_DRAFT = 'ceisa_last_loaded_pib_draft';
const STORAGE_KEY_LAST_PIB_FILENAME = 'ceisa_last_loaded_pib_filename';
let pibAutoSaveTimer = null;

// SAMPLE DEFAULT PIB DATA (AUTHENTIC IMPORT CLEARANCE DRAFT)
const SAMPLE_PIB_DATA = {
    nomorAju: "000511OTA39120261103000002",
    kantorPabean: "020400 - KPU BEA DAN CUKAI TIPE B BATAM",
    jenisPemasukan: "01 - DARI LDP",
    jenisPemberitahuan: "1 - BIASA",
    kategoriPemasukan: "001",
    tujuanPemasukan: "2 - PEMAKAIAN LANGSUNG",
    jenisTransaksiPajak: "4",
    jenisImpor: "01 - DARI LDP",
    jenisProsedur: "1 - BIASA",
    kategoriImpor: "001",
    caraBayar: "1 - BIASA / TUNAI",
    
    // Importir & Entitas
    importirIdType: "5 - NPWP 16 DIGIT",
    importirId: "01.234.567.8-012.000 / NIB 912000881234",
    importirNib: "912000881234",
    importirName: "PT. INDONESIA MAKMUR IMPORTAMA",
    importirAddress: "Kawasan Industri MM2100 Blok C-5, Cikarang Barat, Kab. Bekasi, Jawa Barat 17530",
    importirStatus: "API-U",
    importirCustomsStatus: "Importir Umum",
    
    ownerSame: true,
    ownerId: "01.234.567.8-012.000",
    ownerName: "PT. INDONESIA MAKMUR IMPORTAMA",
    ownerAddress: "Kawasan Industri MM2100 Blok C-5, Cikarang Barat, Kab. Bekasi, Jawa Barat 17530",
    
    ppjkId: "0026923485215000",
    ppjkName: "PT. SARANA PPJK LOGISTIK UTAMA",
    ppjkAddress: "Jl. Sulawesi No. 12 Tanjung Priok, Jakarta Utara",

    // Supplier / Pengirim Luar Negeri
    supplierName: "SHANGHAI PRECISION MACHINERY CO., LTD.",
    supplierAddress: "No. 888 Songze Avenue, Qingpu District, Shanghai 201700, China",
    supplierCountry: "CN - CHINA",
    
    sellerSame: true,
    sellerName: "SHANGHAI PRECISION MACHINERY CO., LTD.",
    sellerAddress: "No. 888 Songze Avenue, Qingpu District, Shanghai 201700, China",
    sellerCountry: "CN - CHINA",

    // Dokumen Pabean
    blNumber: "SMLU987654321",
    blDate: "2026-09-18",
    invoiceNumber: "INV-SPM/2026/0904",
    invoiceDate: "2026-09-15",
    packingListNumber: "PL-SPM/2026/0904",
    packingListDate: "2026-09-15",
    cooNumber: "E261234567890",
    cooDate: "2026-09-17",
    lartasNumber: "PI-03.26.0123/KEMENDAG",
    lartasDate: "2026-08-10",

    // Pengangkut
    caraPengangkutan: "1 - LAUT",
    vesselName: "WAN HAI 502",
    voyageNumber: "V.W240",
    vesselFlag: "TW - TAIWAN",
    etaDate: "2026-09-24",
    portLoading: "CNSHA - SHANGHAI, CHINA",
    portTransit: "SGSIN - SINGAPORE",
    portDischarge: "IDTPP - TANJUNG PRIOK, JAKARTA",
    tpsLocation: "TPS JAKARTA INTERNATIONAL CONTAINER TERMINAL (JICT)",

    // Kemasan & Peti Kemas
    packageType: "PK - PACKAGE",
    packageQty: 48,
    grossWeight: 4520.00,
    netWeight: 4200.00,
    containerNumber: "WHLU4567890",
    containerSize: "40 FT",
    containerType: "FCL",

    // Transaksi
    currency: "USD",
    exchangeRate: 15850.00,
    incoterm: "FOB",
    invoiceAmount: 68450.00,
    freightAmount: 2400.00,
    insuranceAmount: 342.25,
    insuranceType: "DN - Dalam Negeri",

    // Barang
    items: [
        {
            hsCode: "8483.40.00",
            uraianJenisBarang: "Gears and Gearing, Ball or Roller Screws for Industrial Automation",
            description: "Gears and Gearing, Ball or Roller Screws for Industrial Automation",
            countryOfOrigin: "CN",
            jumlahDanSatuanBarang: "48 PCE",
            quantity: 48,
            packageUnit: "PCE",
            amount: "71,192.25",
            cifUsd: 71192.25,
            tariffBm: 5.0,
            facility: "MFN"
        }
    ],

    // Pernyataan
    pernyataanKota: "Jakarta Utara",
    pernyataanTanggal: "2026-09-23",
    pernyataanNama: "HENDRA WIJAYA",
    pernyataanJabatan: "Direktur Utama"
};

// TAB SWITCHING IN PIB MODULE
function switchPibTab(tabId) {
    if (!PIB_TAB_ORDER.includes(tabId)) {
        tabId = 'pib-tab-header';
    }

    document.querySelectorAll('#module-pib .tab-content-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.querySelectorAll('#module-pib .ceisa-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add('active');

    const matchingBtn = document.querySelector(`#module-pib .ceisa-tab-btn[data-pib-tab="${tabId}"]`);
    if (matchingBtn) {
        matchingBtn.classList.add('active');
    }

    // Update Stepper Navigation Controls
    const currentIndex = PIB_TAB_ORDER.indexOf(tabId);
    const btnPrev = document.getElementById('btnPibTabPrev');
    const btnNext = document.getElementById('btnPibTabNext');
    const stepBadge = document.getElementById('pibCeisaStepBadge');
    const stepLabel = document.getElementById('pibCeisaStepLabel');

    if (stepBadge) stepBadge.textContent = `${currentIndex + 1}/9`;
    if (stepLabel) stepLabel.textContent = PIB_TAB_TITLES[tabId] || 'Langkah';

    if (currentIndex === 0) {
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) {
            btnNext.style.display = 'inline-flex';
            btnNext.style.marginLeft = 'auto';
            btnNext.innerHTML = 'Selanjutnya <span style="font-size: 14px;">&#x21BB;</span>';
        }
    } else if (currentIndex === PIB_TAB_ORDER.length - 1) {
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) {
            btnNext.style.display = 'inline-flex';
            btnNext.style.marginLeft = 'auto';
            btnNext.innerHTML = '<span style="font-size: 14px;">&#x21BA;</span> Sebelumnya';
        }
    } else {
        if (btnPrev) {
            btnPrev.style.display = 'inline-flex';
            btnPrev.disabled = false;
            btnPrev.innerHTML = '<span style="font-size: 14px;">&#x21BA;</span> Sebelumnya';
        }
        if (btnNext) {
            btnNext.style.display = 'inline-flex';
            btnNext.style.marginLeft = 'auto';
            btnNext.innerHTML = 'Selanjutnya <span style="font-size: 14px;">&#x21BB;</span>';
        }
    }

    window._activePibTab = tabId;

    if (tabId === 'pib-tab-barang') {
        showPibItemListView();
    }
}

function handlePibTabNext() {
    const current = window._activePibTab || 'pib-tab-header';
    const currentIndex = PIB_TAB_ORDER.indexOf(current);
    if (currentIndex === PIB_TAB_ORDER.length - 1) {
        switchPibTab(PIB_TAB_ORDER[0]);
    } else if (currentIndex >= 0 && currentIndex < PIB_TAB_ORDER.length - 1) {
        switchPibTab(PIB_TAB_ORDER[currentIndex + 1]);
    }
}

function handlePibTabPrev() {
    const current = window._activePibTab || 'pib-tab-header';
    const currentIndex = PIB_TAB_ORDER.indexOf(current);
    if (currentIndex > 0) {
        switchPibTab(PIB_TAB_ORDER[currentIndex - 1]);
    }
}

// FORMAT RUPIAH / NUMBERS
function formatIdr(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return "Rp 0";
    return "Rp " + Math.round(amount).toLocaleString('id-ID');
}

function formatUsd(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return "0.00";
    return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// AUTOMATIC TARIFF & TAX CALCULATOR FOR PIB (BC 2.0)
function calculatePibPungutan() {
    const invoiceAmt = parseFloat(document.getElementById('pibInvoiceAmount')?.value) || 0;
    const freightAmt = parseFloat(document.getElementById('pibFreightAmount')?.value) || 0;
    const insuranceAmt = parseFloat(document.getElementById('pibInsuranceAmount')?.value) || 0;
    const exchangeRate = parseFloat(document.getElementById('pibExchangeRate')?.value) || 15850;
    const incoterm = document.getElementById('pibIncoterm')?.value || 'FOB';
    const tarifBm = parseFloat(document.getElementById('pibTarifBm')?.value) || 0;
    const importirStatus = document.getElementById('pibImportirStatus')?.value || 'API-U';

    // 1. Calculate CIF in Foreign Currency
    let cifValuta = invoiceAmt;
    if (incoterm === 'FOB') {
        cifValuta = invoiceAmt + freightAmt + insuranceAmt;
    } else if (incoterm === 'CFR') {
        cifValuta = invoiceAmt + insuranceAmt;
    }

    const cifIdr = cifValuta * exchangeRate;

    // 2. Bea Masuk (BM) = CIF (IDR) * tarif BM (%)
    const nilaiBm = Math.round(cifIdr * (tarifBm / 100));

    // 3. Nilai Impor = CIF (IDR) + Bea Masuk
    const nilaiImpor = cifIdr + nilaiBm;

    // 4. PPN Impor = Nilai Impor * 11% (Tarif PPN UU HPP)
    const ppnRate = 0.11;
    const nilaiPpn = Math.round(nilaiImpor * ppnRate);

    // 5. PPh Pasal 22 Impor
    // Memiliki API (API-U / API-P): 2.5%, Non-API: 7.5%
    let pphRate = 0.025;
    if (importirStatus === 'NON-API') {
        pphRate = 0.075;
    }
    const nilaiPph = Math.round(nilaiImpor * pphRate);

    // 6. Total Tagihan / Billing
    const totalBilling = nilaiBm + nilaiPpn + nilaiPph;

    // Update UI Fields in Transaksi tab
    const elCifValuta = document.getElementById('pibCifValuta');
    if (elCifValuta) elCifValuta.value = formatUsd(cifValuta);

    const elCifIdr = document.getElementById('pibCifIdr');
    if (elCifIdr) elCifIdr.value = formatIdr(cifIdr);

    // Update UI Fields in Pungutan tab
    const setElemText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    const setElemVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setElemVal('pibPungutanCifRp', formatIdr(cifIdr));
    setElemVal('pibPungutanNilaiBm', formatIdr(nilaiBm));
    setElemVal('pibPungutanNilaiImpor', formatIdr(nilaiImpor));
    setElemVal('pibPungutanNilaiPpn', formatIdr(nilaiPpn));
    setElemVal('pibPungutanNilaiPph', formatIdr(nilaiPph));
    setElemVal('pibPungutanTotalBilling', formatIdr(totalBilling));

    setElemText('lblPibTotalBillingBadge', formatIdr(totalBilling));
    setElemText('lblPibSummaryBm', formatIdr(nilaiBm));
    setElemText('lblPibSummaryPpn', formatIdr(nilaiPpn));
    setElemText('lblPibSummaryPph', formatIdr(nilaiPph));

    // Update item total if item row exists
    const itemCif = document.getElementById('pibItemCifUsd');
    if (itemCif) itemCif.textContent = '$ ' + formatUsd(cifValuta);
}

// COLLECT PIB FORM DATA
function collectPibFormData() {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };

    return {
        nomorAju: getVal('pibNoAju'),
        kantorPabean: getVal('pibKantorPabean'),
        jenisPemasukan: getVal('pibJenisPemasukan') || getVal('pibJenisImpor'),
        jenisPemberitahuan: getVal('pibJenisPemberitahuan') || getVal('pibJenisProsedur'),
        kategoriPemasukan: getVal('pibKategoriPemasukan') || getVal('pibKategoriImpor'),
        tujuanPemasukan: getVal('pibTujuanPemasukan'),
        jenisTransaksiPajak: getVal('pibJenisTransaksiPajak'),
        jenisImpor: getVal('pibJenisPemasukan') || getVal('pibJenisImpor'),
        jenisProsedur: getVal('pibJenisPemberitahuan') || getVal('pibJenisProsedur'),
        kategoriImpor: getVal('pibKategoriPemasukan') || getVal('pibKategoriImpor'),
        caraBayar: getVal('pibCaraBayar'),

        importirIdType: getVal('pibImportirIdType'),
        importirId: getVal('pibImportirId'),
        importirNib: getVal('pibImportirNib'),
        importirName: getVal('pibImportirName'),
        importirAddress: getVal('pibImportirAddress'),
        importirStatus: getVal('pibImportirStatus'),
        importirCustomsStatus: getVal('pibImportirCustomsStatus'),

        ownerSame: document.getElementById('pibCheckOwnerSame')?.checked ?? true,
        ownerId: getVal('pibOwnerId'),
        ownerName: getVal('pibOwnerName'),
        ownerAddress: getVal('pibOwnerAddress'),

        ppjkId: getVal('pibPpjkId'),
        ppjkName: getVal('pibPpjkName'),
        ppjkAddress: getVal('pibPpjkAddress'),

        supplierName: getVal('pibSupplierName'),
        supplierAddress: getVal('pibSupplierAddress'),
        supplierCountry: getVal('pibSupplierCountry'),

        sellerSame: document.getElementById('pibCheckSellerSame')?.checked ?? true,
        sellerName: getVal('pibSellerName'),
        sellerAddress: getVal('pibSellerAddress'),
        sellerCountry: getVal('pibSellerCountry'),

        blNumber: document.getElementById('pibBlNumber')?.value || document.querySelector('#pibDocTableBody input[id*="BlNumber"]')?.value || '',
        blDate: document.getElementById('pibBlDate')?.value || document.querySelector('#pibDocTableBody input[id*="BlDate"]')?.value || '',
        invoiceNumber: (() => {
            const el = document.getElementById('pibInvoiceNumber');
            if (el && el.value) return el.value;
            const invInputs = Array.from(document.querySelectorAll('#pibDocTableBody input[id*="InvoiceNumber"]'));
            if (invInputs.length > 0) return invInputs.map(i => i.value.trim()).filter(Boolean).join(', ');
            return '';
        })(),
        invoiceDate: document.getElementById('pibInvoiceDate')?.value || document.querySelector('#pibDocTableBody input[id*="InvoiceDate"]')?.value || '',
        packingListNumber: (() => {
            const el = document.getElementById('pibPackingListNumber');
            if (el && el.value) return el.value;
            const plInputs = Array.from(document.querySelectorAll('#pibDocTableBody input[id*="PackingListNumber"]'));
            if (plInputs.length > 0) return plInputs.map(i => i.value.trim()).filter(Boolean).join(', ');
            return '';
        })(),
        packingListDate: document.getElementById('pibPackingListDate')?.value || document.querySelector('#pibDocTableBody input[id*="PackingListDate"]')?.value || '',
        cooNumber: document.getElementById('pibCooNumber')?.value || document.querySelector('#pibDocTableBody input[id*="CooNumber"]')?.value || '',
        cooDate: document.getElementById('pibCooDate')?.value || document.querySelector('#pibDocTableBody input[id*="CooDate"]')?.value || '',
        lartasNumber: document.getElementById('pibLartasNumber')?.value || document.querySelector('#pibDocTableBody input[id*="LartasNumber"]')?.value || '',
        lartasDate: document.getElementById('pibLartasDate')?.value || document.querySelector('#pibDocTableBody input[id*="LartasDate"]')?.value || '',

        documents: (() => {
            const tbody = document.getElementById('pibDocTableBody');
            if (!tbody) return [];
            return Array.from(tbody.querySelectorAll('tr')).map(tr => {
                const codeSelect = tr.querySelector('.doc-type-select');
                const code = codeSelect ? codeSelect.value : (tr.querySelector('td:nth-child(2)')?.textContent?.trim() || '');
                const inputs = tr.querySelectorAll('input.doc-input-sync');
                const num = inputs[0]?.value?.trim() || '';
                const date = inputs[1]?.value?.trim() || '';
                const tag = tr.querySelector('.doc-file-tag')?.textContent?.trim() || '';
                return {
                    code,
                    docNumber: num,
                    docDate: date,
                    fileName: tag
                };
            }).filter(d => d.docNumber || d.fileName);
        })(),

        caraPengangkutan: getVal('pibCaraPengangkutan'),
        vesselName: getVal('pibVesselName'),
        voyageNumber: getVal('pibVoyageNumber'),
        vesselFlag: getVal('pibVesselFlag'),
        etaDate: getVal('pibEtaDate'),
        portLoading: getVal('pibPortLoading'),
        portTransit: getVal('pibPortTransit'),
        portDischarge: getVal('pibPortDischarge'),
        tpsLocation: getVal('pibTpsLocation'),

        packageType: getVal('pibPackageType'),
        packageQty: parseFloat(getVal('pibPackageQty')) || 0,
        grossWeight: parseFloat(getVal('pibGrossWeight')) || 0,
        netWeight: parseFloat(getVal('pibNetWeight')) || 0,
        containerNumber: getVal('pibContainerNumber'),
        containerSize: getVal('pibContainerSize'),
        containerType: getVal('pibContainerType'),

        currency: getVal('pibCurrency'),
        exchangeRate: parseFloat(getVal('pibExchangeRate')) || 15850,
        incoterm: getVal('pibIncoterm'),
        invoiceAmount: parseFloat(getVal('pibInvoiceAmount')) || 0,
        freightAmount: parseFloat(getVal('pibFreightAmount')) || 0,
        insuranceAmount: parseFloat(getVal('pibInsuranceAmount')) || 0,
        insuranceType: getVal('pibInsuranceType'),

        tarifBm: parseFloat(getVal('pibTarifBm')) || 0,
        tarifPpn: 11,
        tarifPph: 2.5,
        cifRupiah: getVal('pibPungutanCifRp') || getVal('pibCifIdr'),
        nilaiBm: getVal('pibPungutanNilaiBm'),
        nilaiImpor: getVal('pibPungutanNilaiImpor'),
        nilaiPpn: getVal('pibPungutanNilaiPpn'),
        nilaiPph: getVal('pibPungutanNilaiPph'),
        totalBilling: getVal('pibPungutanTotalBilling'),
        pungutan: {
            cifRupiah: getVal('pibPungutanCifRp') || getVal('pibCifIdr'),
            tarifBm: parseFloat(getVal('pibTarifBm')) || 0,
            nilaiBm: getVal('pibPungutanNilaiBm'),
            nilaiImpor: getVal('pibPungutanNilaiImpor'),
            tarifPpn: 11,
            nilaiPpn: getVal('pibPungutanNilaiPpn'),
            tarifPph: 2.5,
            nilaiPph: getVal('pibPungutanNilaiPph'),
            totalBilling: getVal('pibPungutanTotalBilling')
        },

        pernyataanKota: getVal('pibPernyataanKota'),
        pernyataanTanggal: getVal('pibPernyataanTanggal'),
        pernyataanNama: getVal('pibPernyataanNama'),
        pernyataanJabatan: getVal('pibPernyataanJabatan'),

        items: (() => {
            if (typeof savePibActiveItemFromForm === 'function') {
                savePibActiveItemFromForm();
            }
            if (Array.isArray(window._pibItems) && window._pibItems.length > 0) {
                return window._pibItems;
            }
            return [];
        })(),
        
        updatedAt: new Date().toISOString()
    };
}

// SAVE & RESTORE PIB DRAFT
function triggerPibAutoSave() {
    if (pibAutoSaveTimer) clearTimeout(pibAutoSaveTimer);
    pibAutoSaveTimer = setTimeout(() => {
        saveCurrentPibDraftState();
    }, 600);
}

function saveCurrentPibDraftState() {
    try {
        const draft = collectPibFormData();
        localStorage.setItem(STORAGE_KEY_LAST_PIB_DRAFT, JSON.stringify(draft));
        const indicator = document.getElementById('pibSaveIndicator');
        if (indicator) {
            indicator.style.opacity = '1';
            indicator.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--color-green-text);"></span> Tersimpan Otomatis';
        }
    } catch (err) {
        console.warn('Gagal menyimpan draft PIB ke localStorage:', err);
    }
}

function restorePibDraftState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_LAST_PIB_DRAFT);
        const savedName = localStorage.getItem(STORAGE_KEY_LAST_PIB_FILENAME);
        if (saved) {
            const data = JSON.parse(saved);
            if (savedName) {
                const lbl = document.getElementById('lblPibFileName');
                if (lbl) lbl.textContent = savedName;
            }

            // Jika saved draft belum memiliki rincian barang, ambil dari draft JSON server
            if (!data.items || data.items.length === 0) {
                fetch(getBackendUrl('/api/get-latest-draft?mode=impor'))
                    .then(res => res.json())
                    .then(latest => {
                        if (latest && Array.isArray(latest.items) && latest.items.length > 0) {
                            console.log('[AUTO-RECOVER ITEMS]', `Memulihkan ${latest.items.length} rincian barang impor dari draft server`);
                            data.items = latest.items;
                            loadPibDraftData(data, true);
                        }
                    })
                    .catch(() => {});
            }

            loadPibDraftData(data, false);
            return;
        }
    } catch (e) {
        console.warn('Restore PIB draft error:', e);
    }
    // Default fallback: check server for latest impor draft first
    fetch(getBackendUrl('/api/get-latest-draft?mode=impor'))
        .then(res => res.json())
        .then(latest => {
            if (latest && (latest.items || latest.invoiceNumber)) {
                loadPibDraftData(latest, false);
            } else {
                loadPibDraftData(SAMPLE_PIB_DATA, false);
            }
        })
        .catch(() => {
            loadPibDraftData(SAMPLE_PIB_DATA, false);
        });
}

// LOAD PIB DRAFT DATA (FROM SAMPLE, PARSER, OR JSON FILE)
function loadPibDraftData(data, shouldSave = true) {
    if (!data) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) {
            el.value = val;
        }
    };

    // Mapping: If data comes from AI Document Parser:
    // - Consignee is Importir (Indonesian buyer)
    // - Shipper is Supplier (Overseas seller)
    let importirName = data.importirName || data.consigneeName || '';
    let importirAddress = data.importirAddress || data.consigneeAddress || '';
    let supplierName = data.supplierName || data.shipperName || '';
    let supplierAddress = data.supplierAddress || data.shipperAddress || '';
    let supplierCountry = data.supplierCountry || '';

    // Aturan Khusus PT. Sinar Asia Pack pada Modul Impor (PIB):
    // Importir / Penerima di Indonesia: PT. Sinar Asia Pack
    // Supplier / Pengirim Luar Negeri: Golden Ben Printer Pte Ltd (atau pemasok LN tertera)
    const isSinarAsiaImpor = /sinar\s*asia/i.test(importirName) ||
                             /sinar\s*asia/i.test(supplierName) ||
                             /golden\s*ben/i.test(importirName) ||
                             /golden\s*ben/i.test(supplierName);

    if (isSinarAsiaImpor) {
        importirName = 'PT. SINAR ASIA PACK';
        if (!supplierName || /sinar\s*asia/i.test(supplierName)) {
            supplierName = 'GOLDEN BEN PRINTER PTE LTD';
            supplierCountry = 'SG - SINGAPORE';
        }
    }

    // No Aju
    const noAju = data.nomorAju || `010700-${Math.floor(100000 + Math.random() * 900000)}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(100000 + Math.random() * 900000)}`;
    setVal('pibNoAju', noAju);
    const lblNoAju = document.getElementById('lblPibNoAju');
    if (lblNoAju) lblNoAju.textContent = noAju;

    // Header (1:1 FTZ01 / PIB)
    if (data.kantorPabean || data.kantorAsal) setVal('pibKantorPabean', data.kantorPabean || data.kantorAsal);
    if (data.jenisPemasukan || data.jenisImpor) setVal('pibJenisPemasukan', data.jenisPemasukan || data.jenisImpor);
    if (data.jenisPemberitahuan || data.jenisProsedur) setVal('pibJenisPemberitahuan', data.jenisPemberitahuan || data.jenisProsedur);
    if (data.kategoriPemasukan || data.kategoriImpor) setVal('pibKategoriPemasukan', data.kategoriPemasukan || data.kategoriImpor);
    if (data.tujuanPemasukan) setVal('pibTujuanPemasukan', data.tujuanPemasukan);
    if (data.jenisTransaksiPajak || data.jenisTransaksiPerpajakan) setVal('pibJenisTransaksiPajak', data.jenisTransaksiPajak || data.jenisTransaksiPerpajakan);

    // Entitas
    if (data.importirIdType) setVal('pibImportirIdType', data.importirIdType);
    if (data.importirId) setVal('pibImportirId', data.importirId);
    if (data.importirNib) setVal('pibImportirNib', data.importirNib);
    if (importirName) setVal('pibImportirName', importirName);
    if (importirAddress) setVal('pibImportirAddress', importirAddress);
    if (data.importirStatus) setVal('pibImportirStatus', data.importirStatus);
    if (data.importirCustomsStatus) setVal('pibImportirCustomsStatus', data.importirCustomsStatus);

    if (data.ownerName || importirName) setVal('pibOwnerName', data.ownerName || importirName);
    if (data.ownerAddress || importirAddress) setVal('pibOwnerAddress', data.ownerAddress || importirAddress);
    if (data.ownerId || data.importirId) setVal('pibOwnerId', data.ownerId || data.importirId);

    if (data.ppjkId) setVal('pibPpjkId', data.ppjkId);
    if (data.ppjkName) setVal('pibPpjkName', data.ppjkName);
    if (data.ppjkAddress) setVal('pibPpjkAddress', data.ppjkAddress);

    if (supplierName) setVal('pibSupplierName', supplierName);
    if (supplierAddress) setVal('pibSupplierAddress', supplierAddress);
    if (supplierCountry) setVal('pibSupplierCountry', supplierCountry);

    if (data.sellerName || supplierName) setVal('pibSellerName', data.sellerName || supplierName);
    if (data.sellerAddress || supplierAddress) setVal('pibSellerAddress', data.sellerAddress || supplierAddress);
    if (data.sellerCountry || supplierCountry) setVal('pibSellerCountry', data.sellerCountry || supplierCountry);

    // Dokumen (Render Dynamic Document Table)
    renderPibDocumentsTable(data);
    if (data.blNumber) setVal('pibBlNumber', data.blNumber);
    if (data.blDate) setVal('pibBlDate', data.blDate);
    if (data.invoiceNumber) setVal('pibInvoiceNumber', data.invoiceNumber);
    if (data.invoiceDate) setVal('pibInvoiceDate', data.invoiceDate);
    if (data.packingListNumber) setVal('pibPackingListNumber', data.packingListNumber);
    if (data.packingListDate) setVal('pibPackingListDate', data.packingListDate);
    if (data.cooNumber) setVal('pibCooNumber', data.cooNumber);
    if (data.cooDate) setVal('pibCooDate', data.cooDate);
    if (data.lartasNumber) setVal('pibLartasNumber', data.lartasNumber);
    if (data.lartasDate) setVal('pibLartasDate', data.lartasDate);

    // Pengangkut
    if (data.caraPengangkutan) setVal('pibCaraPengangkutan', data.caraPengangkutan);
    if (data.vesselName) setVal('pibVesselName', data.vesselName);
    if (data.voyageNumber) setVal('pibVoyageNumber', data.voyageNumber);
    if (data.vesselFlag) setVal('pibVesselFlag', data.vesselFlag);
    if (data.etaDate) setVal('pibEtaDate', data.etaDate);
    if (data.portLoading) setVal('pibPortLoading', data.portLoading);
    if (data.portTransit) setVal('pibPortTransit', data.portTransit);
    if (data.portDischarge) setVal('pibPortDischarge', data.portDischarge);
    if (data.tpsLocation) setVal('pibTpsLocation', data.tpsLocation);

    // Kemasan & Peti Kemas
    if (data.packageType) setVal('pibPackageType', data.packageType);
    if (data.packageQty !== undefined) setVal('pibPackageQty', data.packageQty);
    if (data.grossWeight !== undefined) setVal('pibGrossWeight', data.grossWeight);
    if (data.netWeight !== undefined) setVal('pibNetWeight', data.netWeight);
    if (data.containerNumber) setVal('pibContainerNumber', data.containerNumber);
    if (data.containerSize) setVal('pibContainerSize', data.containerSize);
    if (data.containerType) setVal('pibContainerType', data.containerType);

    // Transaksi
    if (data.currency) setVal('pibCurrency', data.currency);
    if (data.exchangeRate) setVal('pibExchangeRate', data.exchangeRate);
    if (data.incoterm) setVal('pibIncoterm', data.incoterm);
    // Hitung invoiceAmount dari rincian barang jika belum tersedia
    if ((!data.invoiceAmount || data.invoiceAmount === 0) && Array.isArray(data.items) && data.items.length > 0) {
        let sumAmt = 0;
        data.items.forEach(it => {
            const rawAmt = it.amount || it.cifUsd || it.nilaiCif || 0;
            const parsedAmt = parseFloat(String(rawAmt).replace(/\./g, '').replace(/,/g, '.'));
            if (!isNaN(parsedAmt) && parsedAmt > 0) {
                sumAmt += parsedAmt;
            }
        });
        if (sumAmt > 0) {
            data.invoiceAmount = parseFloat(sumAmt.toFixed(2));
        }
    }
    if (data.invoiceAmount !== undefined) setVal('pibInvoiceAmount', data.invoiceAmount);
    if (data.freightAmount !== undefined) setVal('pibFreightAmount', data.freightAmount);
    if (data.insuranceAmount !== undefined) setVal('pibInsuranceAmount', data.insuranceAmount);
    if (data.insuranceType) setVal('pibInsuranceType', data.insuranceType);
    if (data.tarifBm !== undefined) setVal('pibTarifBm', data.tarifBm);

    // Pernyataan
    if (data.pernyataanKota) setVal('pibPernyataanKota', data.pernyataanKota);
    if (data.pernyataanTanggal) setVal('pibPernyataanTanggal', data.pernyataanTanggal);
    if (data.pernyataanNama) setVal('pibPernyataanNama', data.pernyataanNama);
    if (data.pernyataanJabatan) setVal('pibPernyataanJabatan', data.pernyataanJabatan);

    // Sinkronisasi items ke state global PIB & bersihkan dari duplikasi satuan
    window._pibItems = (Array.isArray(data.items) && data.items.length > 0) ? data.items.map(it => {
        const parsed = parsePibQtyUnit(it.jumlahDanSatuanBarang || it.quantity, it.packageUnit || it.satuanBarang);
        return {
            ...it,
            jumlahDanSatuanBarang: `${parsed.qty} ${parsed.unit}`,
            packageUnit: parsed.unit,
            quantity: parseFloat(parsed.qty.replace(/\./g, '').replace(/,/g, '.')) || 0
        };
    }) : [];
    showPibItemListView();

    // Auto-calculate Pungutan
    calculatePibPungutan();

    // Sinkronisasi Tabel Dokumen Pelengkap Pabean Impor
    updatePibDocTable(data);
    renderPibSafeCheck(data.safeCheck);

    if (shouldSave) {
        saveCurrentPibDraftState();
    }
}

// ESCAPE HTML HELPER FOR PIB
function escapePibHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// NORMALISASI JUMLAH & SATUAN BARANG PIB (HANYA ANGKA UNTUK QTY)
function parsePibQtyUnit(rawQty, rawUnit) {
    let q = '';
    let u = (rawUnit || '').trim().toUpperCase();

    if (rawQty !== undefined && rawQty !== null) {
        const s = String(rawQty).trim();
        // Ekstrak angka dan tanda baca titik/koma terlebih dahulu
        const match = s.match(/^([0-9.,\s]+)(.*)$/);
        if (match) {
            q = match[1].trim();
            const trailingUnit = match[2].replace(/[^a-zA-Z]/g, '').trim().toUpperCase();
            if (trailingUnit && !u) {
                u = trailingUnit;
            }
        } else {
            q = s.replace(/[^0-9.,]/g, '').trim();
        }
    }

    // Pastikan q HANYA berisi digit dan titik/koma (TIDAK ADA HURUF ATAU KODE SATUAN)
    q = q.replace(/[a-zA-Z]/g, '').trim();
    if (!q) q = '1';

    // Normalisasi satuan
    if (u) {
        u = u.replace(/[^A-Z]/g, ' ').trim().split(/\s+/)[0] || 'PCE';
    } else {
        u = 'PCE';
    }

    return { qty: q, unit: u };
}

// NORMALISASI NILAI AMOUNT / CIF PIB
function formatPibAmount(raw) {
    if (raw === undefined || raw === null || raw === '') return '0.00';
    if (typeof raw === 'number') return raw.toFixed(2);
    const s = String(raw).trim();
    if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
        return s.replace(/\./g, '').replace(/,/g, '.');
    }
    return s.replace(/,/g, '');
}

// GLOBAL ITEMS STATE FOR AUTHENTIC CEISA 4.0 PIB ITEM VIEW
window._pibItems = [];
window._currentPibItemIdx = 0;

// RENDER ACTIVE ITEM DETAILS IN AUTHENTIC CEISA 4.0 ITEM CARD
function renderPibActiveItem(idx = 0) {
    if (!Array.isArray(window._pibItems)) {
        window._pibItems = [];
    }
    if (window._pibItems.length === 0) {
        window._pibItems.push({
            hsCode: '',
            uraianJenisBarang: '',
            jumlahDanSatuanBarang: '1 PCE',
            countryOfOrigin: 'CN - CHINA',
            amount: '0.00',
            kemasan: '1 PX - PALLET'
        });
    }

    if (idx < 0) idx = 0;
    if (idx >= window._pibItems.length) idx = window._pibItems.length - 1;
    window._currentPibItemIdx = idx;

    const item = window._pibItems[idx] || {};

    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val !== undefined && val !== null) ? val : '';
    };

    // 1. Seri & Stepper
    setEl('pibItemSeri', idx + 1);
    const lblPager = document.getElementById('lblPibItemPager');
    if (lblPager) {
        lblPager.textContent = `${idx + 1}/${window._pibItems.length}`;
    }
    const jumpInput = document.getElementById('pibJumpItemInput');
    if (jumpInput) {
        jumpInput.value = idx + 1;
        jumpInput.max = window._pibItems.length;
    }
    const btnPrev = document.getElementById('btnPibItemPrev');
    const btnNext = document.getElementById('btnPibItemNext');
    if (btnPrev) btnPrev.disabled = (idx === 0);
    if (btnNext) btnNext.disabled = (idx >= window._pibItems.length - 1);

    // 2. Pos Tarif (HS) & Lartas
    const hsCode = item.hsCode || item.posTarif || '';
    setEl('pibItemHsCode', hsCode);

    const radYa = document.getElementById('pibItemLartasYa');
    const radTidak = document.getElementById('pibItemLartasTidak');
    if (radYa && radTidak) {
        if (item.lartas === 'terkena' || item.isLartas === true) {
            radYa.checked = true;
        } else {
            radTidak.checked = true;
        }
    }

    // 3. Identitas Barang
    setEl('pibItemKode', item.kodeBarang || '-');
    setEl('pibItemUraian', item.uraianJenisBarang || item.description || item.namaBarang || '');
    setEl('pibItemMerek', item.merek || '-');
    setEl('pibItemTipe', item.tipe || '-');
    setEl('pibItemSpesifikasi', item.spesifikasi || '-');

    // 4. Negara
    const rawCountry = item.countryOfOrigin || item.negara || 'CN - CHINA';
    const selCountry = document.getElementById('pibItemNegara');
    if (selCountry) {
        const found = Array.from(selCountry.options).find(o => 
            o.value.toLowerCase().includes(rawCountry.toLowerCase().slice(0, 2))
        );
        if (found) selCountry.value = found.value;
        else selCountry.value = 'CN - CHINA';
    }

    setEl('pibItemKondisi', item.kondisi || 'Barang Baru');
    setEl('pibItemKategori', item.kategori || '4 - BAHAN BAKU');
    setEl('pibItemAsal', item.asal || '1 - SEPENUHNYA DIPEROLEH DAN/ATAU DIPRODUKSI DI LUAR DAERAH PABEAN (WHOLLY OBTAINED)');

    // 5. Kuantitas & Kemasan
    const qtyInfo = parsePibQtyUnit(item.jumlahDanSatuanBarang || item.quantity, item.packageUnit || item.satuanBarang);
    setEl('pibItemQty', qtyInfo.qty);
    const selUnit = document.getElementById('pibItemUnit');
    if (selUnit) {
        const foundUnit = Array.from(selUnit.options).find(o => 
            o.value.toUpperCase().startsWith(qtyInfo.unit) || o.value.toUpperCase().includes(qtyInfo.unit)
        );
        if (foundUnit) selUnit.value = foundUnit.value;
        else selUnit.value = 'PCE - PIECE';
    }

    // Kemasan
    let kemasanQty = item.kemasanQty || 1;
    let kemasanJenis = item.kemasanJenis || 'PX - PALLET';
    if (typeof item.kemasan === 'string' && item.kemasan.trim() !== '') {
        const kmMatch = item.kemasan.match(/^(\d+)\s*(.*)$/);
        if (kmMatch) {
            kemasanQty = kmMatch[1];
            if (/pal/i.test(kmMatch[2])) kemasanJenis = 'PX - PALLET';
            else if (/box|ctn|carton/i.test(kmMatch[2])) kemasanJenis = 'BX - BOX';
            else if (/pack/i.test(kmMatch[2])) kemasanJenis = 'PK - PACKAGE';
        }
    }
    setEl('pibItemKemasanQty', kemasanQty);
    const selKemasan = document.getElementById('pibItemKemasanJenis');
    if (selKemasan) selKemasan.value = kemasanJenis;

    // 6. Berat & Volume
    setEl('pibItemNetto', item.beratBersih || '0.0000');
    setEl('pibItemBruto', item.beratKotor || '0.0000');
    setEl('pibItemVolume', item.volume || '0.00');

    // 7. Nilai & Perhitungan
    const amtVal = formatPibAmount(item.amount || item.cifUsd || item.nilaiCif || 0);
    setEl('pibItemAmountFob', amtVal);
    setEl('pibItemBiayaTambahan', item.biayaTambahan || '0.00');
    setEl('pibItemFob', amtVal);

    // Hitung Harga Satuan & CIF Rupiah
    const fobNum = parseFloat(String(amtVal).replace(/[^0-9.]/g, '')) || 0;
    const qtyNum = parseFloat(String(qtyInfo.qty).replace(/[^0-9.]/g, '')) || 1;
    const unitPrice = qtyNum > 0 ? (fobNum / qtyNum).toFixed(4) : '0.00';
    setEl('pibItemHargaSatuan', unitPrice);
    setEl('pibItemAsuransi', item.asuransi || '0.00');

    const kurs = parseFloat(document.getElementById('pibExchangeRate')?.value) || 16300;
    const cifRp = Math.round(fobNum * kurs);
    setEl('pibItemCifRupiah', `Rp ${cifRp.toLocaleString('id-ID')},00`);

    // 8. Pungutan
    const tarifBm = item.tariffBm !== undefined ? item.tariffBm : (item.tarifBm !== undefined ? item.tarifBm : 5.0);
    setEl('pibItemBmTarifVal', `${tarifBm}%`);

    // Badge
    const badge = document.getElementById('pibItemCountBadge');
    if (badge) {
        badge.textContent = `${window._pibItems.length} Barang Terdeteksi`;
    }

    // Highlight summary table row
    highlightPibSummaryTableRow(idx);
}

// SIMPAN NILAI DARI FORM DETAIL ITEM AKTIF KEMBALI KE STATE
function savePibActiveItemFromForm() {
    if (!Array.isArray(window._pibItems) || window._pibItems.length === 0) return;
    const idx = window._currentPibItemIdx;
    if (idx < 0 || idx >= window._pibItems.length) return;

    const getEl = id => document.getElementById(id)?.value?.trim() || '';

    const hsCode = getEl('pibItemHsCode');
    const desc = getEl('pibItemUraian');
    const country = getEl('pibItemNegara');
    
    // Bersihkan nilai kuantitas agar HANYA berupa angka dan titik/koma (bebas dari imbuhan satuan)
    const rawQty = getEl('pibItemQty');
    const cleanQty = rawQty.replace(/[^\d.,]/g, '').trim() || '0';
    const unitRaw = getEl('pibItemUnit');
    const unit = (unitRaw.split(' ')[0] || 'PCE').toUpperCase();

    const qtyInputEl = document.getElementById('pibItemQty');
    if (qtyInputEl && qtyInputEl.value !== cleanQty) {
        qtyInputEl.value = cleanQty;
    }

    const amountVal = getEl('pibItemAmountFob');
    const netWeight = getEl('pibItemNetto');
    const grossWeight = getEl('pibItemBruto');
    const kemasanQty = getEl('pibItemKemasanQty');
    const kemasanJenis = getEl('pibItemKemasanJenis');
    const tarifBm = parseFloat(getEl('pibItemBmTarifVal')) || 5.0;

    const radYa = document.getElementById('pibItemLartasYa');

    window._pibItems[idx] = {
        ...window._pibItems[idx],
        hsCode: hsCode,
        uraianJenisBarang: desc,
        description: desc,
        kodeBarang: getEl('pibItemKode'),
        lartas: radYa && radYa.checked ? 'terkena' : 'tidak',
        merek: getEl('pibItemMerek'),
        tipe: getEl('pibItemTipe'),
        spesifikasi: getEl('pibItemSpesifikasi'),
        countryOfOrigin: country,
        kondisi: getEl('pibItemKondisi'),
        kategori: getEl('pibItemKategori'),
        asal: getEl('pibItemAsal'),
        jumlahDanSatuanBarang: `${cleanQty} ${unit}`,
        quantity: parseFloat(cleanQty.replace(/\./g, '').replace(/,/g, '.')) || 0,
        packageUnit: unit,
        kemasan: `${kemasanQty} ${kemasanJenis.split(' ')[0]}`,
        kemasanQty: kemasanQty,
        kemasanJenis: kemasanJenis,
        beratBersih: netWeight,
        beratKotor: grossWeight,
        volume: getEl('pibItemVolume'),
        amount: amountVal,
        cifUsd: parseFloat(amountVal.replace(/[^0-9.]/g, '')) || 0,
        biayaTambahan: getEl('pibItemBiayaTambahan'),
        fob: getEl('pibItemFob'),
        asuransi: getEl('pibItemAsuransi'),
        tariffBm: tarifBm
    };

    // Update row di summary table jika tabel sedang ter-render
    updatePibSummaryRow(idx);
}

// VIEW CONTROLLERS UNTUK TAB BARANG IMPOR (LIST FIRST -> EDITOR)
window._pibViewMode = 'list';

function showPibItemListView() {
    const listView = document.getElementById('pibItemListView');
    const detailCard = document.getElementById('pibItemDetailCard');
    if (listView) listView.style.display = 'block';
    if (detailCard) detailCard.style.display = 'none';
    window._pibViewMode = 'list';
    renderPibSummaryTable();
    highlightPibSummaryTableRow(window._currentPibItemIdx);
}

function openPibItemEditor(idx = 0) {
    if (window._pibViewMode === 'editor' && typeof savePibActiveItemFromForm === 'function') {
        savePibActiveItemFromForm();
    }
    const listView = document.getElementById('pibItemListView');
    const detailCard = document.getElementById('pibItemDetailCard');
    if (listView) listView.style.display = 'none';
    if (detailCard) detailCard.style.display = 'block';
    window._pibViewMode = 'editor';
    renderPibActiveItem(idx);
    detailCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// RENDER TABEL RANGKUMAN SELURUH BARANG IMPOR (LIST VIEW)
function renderPibSummaryTable(filterText = '') {
    const tbody = document.getElementById('pibItemsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const badge = document.getElementById('pibItemCountBadge');
    if (badge) {
        badge.textContent = `${window._pibItems?.length || 0} Barang Terdaftar`;
    }

    if (!window._pibItems || window._pibItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px 20px;">Belum ada rincian barang impor. Tekan tombol <b>+ Tambah Barang</b> di atas untuk menambahkan.</td></tr>`;
        return;
    }

    const q = (filterText || '').toLowerCase().trim();

    window._pibItems.forEach((item, idx) => {
        const hsCode = item.hsCode || item.posTarif || '';
        const desc = item.uraianJenisBarang || item.description || item.namaBarang || '';
        if (q && !hsCode.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) {
            return;
        }

        const country = (item.countryOfOrigin || item.negara || 'CN').slice(0, 2);
        const qtyInfo = parsePibQtyUnit(item.jumlahDanSatuanBarang || item.quantity, item.packageUnit || item.satuanBarang);
        const amtVal = formatPibAmount(item.amount || item.cifUsd || 0);
        const tarifBm = item.tariffBm !== undefined ? item.tariffBm : 5.0;

        const tr = document.createElement('tr');
        tr.setAttribute('data-item-index', idx);
        tr.style.cursor = 'pointer';
        if (idx === window._currentPibItemIdx) {
            tr.classList.add('selected-row');
        }

        tr.innerHTML = `
            <td style="text-align: center; font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
            <td class="cell-pib-hscode">${escapePibHtml(hsCode)}</td>
            <td style="font-size: 12px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapePibHtml(desc)}">${escapePibHtml(desc)}</td>
            <td style="text-align: center; font-size: 11.5px; font-weight: 600;">${escapePibHtml(country)}</td>
            <td style="text-align: right; font-family: var(--font-mono); font-size: 11.5px;">${escapePibHtml(qtyInfo.qty)} ${escapePibHtml(qtyInfo.unit)}</td>
            <td style="text-align: right; font-family: var(--font-mono); font-size: 11.5px; font-weight: 600;">$${escapePibHtml(amtVal)}</td>
            <td style="text-align: center; font-size: 11.5px;">${tarifBm}%</td>
            <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="btn btn-ceisa-sub btn-xs btn-open-pib-item" data-idx="${idx}">Ubah</button>
                <button type="button" class="btn-del-pib-summary-row" data-idx="${idx}" title="Hapus Barang" style="background: none; border: none; color: #ef4444; font-size: 15px; cursor: pointer; padding: 0 4px; margin-left: 6px;">&times;</button>
            </td>
        `;

        const btnOpen = tr.querySelector('.btn-open-pib-item');
        if (btnOpen) {
            btnOpen.addEventListener('click', (e) => {
                e.stopPropagation();
                openPibItemEditor(idx);
            });
        }

        const btnDel = tr.querySelector('.btn-del-pib-summary-row');
        if (btnDel) {
            btnDel.addEventListener('click', (e) => {
                e.stopPropagation();
                deletePibItemAt(idx);
            });
        }

        tr.addEventListener('click', () => {
            openPibItemEditor(idx);
        });

        tbody.appendChild(tr);
    });
}

function highlightPibSummaryTableRow(activeIdx) {
    const rows = document.querySelectorAll('#pibItemsTableBody tr[data-item-index]');
    rows.forEach(r => {
        const idx = parseInt(r.getAttribute('data-item-index'), 10);
        if (idx === activeIdx) {
            r.classList.add('selected-row');
        } else {
            r.classList.remove('selected-row');
        }
    });
}

function updatePibSummaryRow(idx) {
    const r = document.querySelector(`#pibItemsTableBody tr[data-item-index="${idx}"]`);
    if (!r) return;
    const item = window._pibItems[idx];
    if (!item) return;

    const cells = r.querySelectorAll('td');
    if (cells.length >= 7) {
        cells[1].textContent = item.hsCode || '';
        cells[2].textContent = item.uraianJenisBarang || item.description || '';
        cells[2].title = item.uraianJenisBarang || item.description || '';
        cells[3].textContent = (item.countryOfOrigin || 'CN').slice(0, 2);
        cells[4].textContent = item.jumlahDanSatuanBarang || '';
        cells[5].textContent = `$${formatPibAmount(item.amount || item.cifUsd || 0)}`;
        cells[6].textContent = `${item.tariffBm || 5}%`;
    }
}

function deletePibItemAt(idx) {
    if (!confirm(`Hapus barang No. ${idx + 1}?`)) return;
    window._pibItems.splice(idx, 1);
    if (window._pibItems.length === 0) {
        window._pibItems.push({
            hsCode: '',
            uraianJenisBarang: '',
            jumlahDanSatuanBarang: '1 PCE',
            amount: '0.00'
        });
        window._currentPibItemIdx = 0;
    } else if (window._currentPibItemIdx >= window._pibItems.length) {
        window._currentPibItemIdx = window._pibItems.length - 1;
    }
    if (window._pibViewMode === 'editor') {
        renderPibActiveItem(window._currentPibItemIdx);
    } else {
        renderPibSummaryTable();
    }
    triggerPibAutoSave();
    if (typeof showToast === 'function') {
        showToast('Barang berhasil dihapus', 'info');
    }
}

// ====================================================================
// RENDER TABEL DOKUMEN LAMPIRAN DINAMIS (TAB DOKUMEN PIB - CEISA 4.0)
// ====================================================================
function renderPibDocumentsTable(data = {}) {
    const tbody = document.getElementById('pibDocTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const docList = data.safeCheck?.documentList || data.documentList || data.documents || [];
    const rows = [];

    // Helper: cari nama file dari memory/cache atau dokumen terunggah
    const resolveFileName = (typePattern, defaultName) => {
        if (window._currentDocMap && window._currentDocMap[typePattern]) {
            return window._currentDocMap[typePattern];
        }
        if (window._lastUploadedFiles && window._lastUploadedFiles.length > 0) {
            const f = window._lastUploadedFiles.find(file => new RegExp(typePattern, 'i').test(file.name));
            if (f) return f.name;
        }
        if (docList && docList.length > 0) {
            const d = docList.find(doc => new RegExp(typePattern, 'i').test(doc.documentType || '') || new RegExp(typePattern, 'i').test(doc.fileName || ''));
            if (d && d.fileName) return d.fileName;
        }
        return defaultName;
    };

    // Identifikasi Data & Dokumen Nyata (Abaikan null/undefined/placeholder)
    const cleanStr = (val) => (val && val !== 'null' && val !== 'undefined') ? String(val).trim() : '';

    const blNum = cleanStr(data.blNumber);
    const blDate = cleanStr(data.blDate);
    const hasBlDoc = docList.some(d => /lading|bl|waybill/i.test((d.documentType || '') + ' ' + (d.fileName || '')));

    const invNum = cleanStr(data.invoiceNumber);
    const invDate = cleanStr(data.invoiceDate);

    const plNum = cleanStr(data.packingListNumber);
    const plDate = cleanStr(data.packingListDate) || invDate;
    const hasPlDoc = docList.some(d => /packing|pl|kemasan/i.test((d.documentType || '') + ' ' + (d.fileName || '')));

    const cooNum = cleanStr(data.cooNumber);
    const cooDate = cleanStr(data.cooDate);
    const hasCooDoc = docList.some(d => /coo|origin|ska/i.test((d.documentType || '') + ' ' + (d.fileName || '')));

    const lartasNum = cleanStr(data.lartasNumber);
    const lartasDate = cleanStr(data.lartasDate);
    const hasLartasDoc = docList.some(d => /lartas|kemendag|surveyor|ls|pi/i.test((d.documentType || '') + ' ' + (d.fileName || '')));

    // 1. Dokumen Bill of Lading (705) - HANYA jika dokumen B/L memang ada
    if (blNum || hasBlDoc) {
        const blFile = resolveFileName('lading|bl|waybill', blNum ? `BL_${blNum.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf` : 'BL_Dokumen.pdf');
        rows.push({
            id: 'row-pib-bl',
            code: '705 - B/L',
            docType: '705 - BILL OF LADING (OCEAN B/L)',
            inputId: 'pibBlNumber',
            dateId: 'pibBlDate',
            btnId: 'btnOpenDocPibBL',
            tagId: 'tagFilePibBL',
            number: blNum,
            date: blDate,
            fileName: blFile
        });
    }

    // 2. Dokumen Invoice (380 - Mendukung Multi-Invoice)
    const invFile = resolveFileName('inv|invoice|faktur', invNum ? `INV_${invNum.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf` : 'INV-SPM_2026_0904.pdf');

    if (Array.isArray(data.invoices) && data.invoices.length > 0) {
        data.invoices.forEach((inv, i) => {
            const num = cleanStr(inv.invoiceNumber);
            const dt = cleanStr(inv.invoiceDate) || invDate;
            const isFirst = i === 0;
            const specificFile = inv.fileName || resolveFileName(num || 'inv', invFile);
            rows.push({
                id: isFirst ? 'row-pib-invoice' : `row-pib-invoice-${i}`,
                code: '380 - INVOICE',
                docType: '380 - COMMERCIAL INVOICE',
                inputId: isFirst ? 'pibInvoiceNumber' : `pibInvoiceNumber_${i}`,
                dateId: isFirst ? 'pibInvoiceDate' : `pibInvoiceDate_${i}`,
                btnId: isFirst ? 'btnOpenDocPibInvoice' : `btnOpenDocPibInvoice_${i}`,
                tagId: isFirst ? 'tagFilePibInvoice' : `tagFilePibInvoice_${i}`,
                number: num,
                date: dt,
                fileName: specificFile
            });
        });
    } else if (invNum.includes(',')) {
        const splitInvs = invNum.split(',').map(s => s.trim()).filter(Boolean);
        splitInvs.forEach((num, i) => {
            const isFirst = i === 0;
            rows.push({
                id: isFirst ? 'row-pib-invoice' : `row-pib-invoice-${i}`,
                code: '380 - INVOICE',
                docType: '380 - COMMERCIAL INVOICE',
                inputId: isFirst ? 'pibInvoiceNumber' : `pibInvoiceNumber_${i}`,
                dateId: isFirst ? 'pibInvoiceDate' : `pibInvoiceDate_${i}`,
                btnId: isFirst ? 'btnOpenDocPibInvoice' : `btnOpenDocPibInvoice_${i}`,
                tagId: isFirst ? 'tagFilePibInvoice' : `tagFilePibInvoice_${i}`,
                number: num,
                date: invDate,
                fileName: invFile
            });
        });
    } else if (invNum || (!blNum && !plNum && !cooNum && !lartasNum)) {
        rows.push({
            id: 'row-pib-invoice',
            code: '380 - INVOICE',
            docType: '380 - COMMERCIAL INVOICE',
            inputId: 'pibInvoiceNumber',
            dateId: 'pibInvoiceDate',
            btnId: 'btnOpenDocPibInvoice',
            tagId: 'tagFilePibInvoice',
            number: invNum || 'INV-SPM/2026/0904',
            date: invDate || '2026-09-15',
            fileName: invFile
        });
    }

    // 3. Dokumen Packing List (217 - HANYA jika dokumen Packing List memang ada)
    if (plNum || hasPlDoc) {
        const plFile = resolveFileName('packing|pl|kemasan', plNum ? `PL_${plNum.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf` : 'PL-SPM_2026_0904.pdf');

        if (plNum.includes(',')) {
            const splitPls = plNum.split(',').map(s => s.trim()).filter(Boolean);
            splitPls.forEach((num, i) => {
                const isFirst = i === 0;
                rows.push({
                    id: isFirst ? 'row-pib-packinglist' : `row-pib-packinglist-${i}`,
                    code: '217 - PACKING LIST',
                    docType: '217 - PACKING LIST',
                    inputId: isFirst ? 'pibPackingListNumber' : `pibPackingListNumber_${i}`,
                    dateId: isFirst ? 'pibPackingListDate' : `pibPackingListDate_${i}`,
                    btnId: isFirst ? 'btnOpenDocPibPackingList' : `btnOpenDocPibPackingList_${i}`,
                    tagId: isFirst ? 'tagFilePibPackingList' : `tagFilePibPackingList_${i}`,
                    number: num,
                    date: plDate,
                    fileName: plFile
                });
            });
        } else {
            rows.push({
                id: 'row-pib-packinglist',
                code: '217 - PACKING LIST',
                docType: '217 - PACKING LIST',
                inputId: 'pibPackingListNumber',
                dateId: 'pibPackingListDate',
                btnId: 'btnOpenDocPibPackingList',
                tagId: 'tagFilePibPackingList',
                number: plNum,
                date: plDate,
                fileName: plFile
            });
        }
    }

    // 4. Dokumen COO (861 - HANYA jika memang ada)
    if (cooNum || hasCooDoc) {
        const cooFile = resolveFileName('coo|origin|ska', cooNum ? `COO_${cooNum.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf` : 'COO_Dokumen.pdf');
        rows.push({
            id: 'row-pib-coo',
            code: '861 - COO',
            docType: '861 - CERTIFICATE OF ORIGIN',
            inputId: 'pibCooNumber',
            dateId: 'pibCooDate',
            btnId: 'btnOpenDocPibCOO',
            tagId: 'tagFilePibCOO',
            number: cooNum,
            date: cooDate,
            fileName: cooFile
        });
    }

    // 5. Dokumen Perizinan Lartas (999 - HANYA jika memang ada)
    if (lartasNum || hasLartasDoc) {
        const lartasFile = resolveFileName('lartas|kemendag|surveyor|ls|pi', lartasNum ? `PI_${lartasNum.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf` : 'PI_Kemendag.pdf');
        rows.push({
            id: 'row-pib-lartas',
            code: '999 - LARTAS',
            docType: '999 - PERIZINAN LARTAS',
            inputId: 'pibLartasNumber',
            dateId: 'pibLartasDate',
            btnId: 'btnOpenDocPibLartas',
            tagId: 'tagFilePibLartas',
            number: lartasNum,
            date: lartasDate,
            fileName: lartasFile
        });
    }

    // 6. Dokumen Tambahan Lainnya dari docList (Health Cert, Phytosanitary, Asuransi, Surveyor Report, MSDS, dll.)
    docList.forEach((d, idx) => {
        const dt = d.documentType || '';
        const fn = d.fileName || '';
        if (!/invoice|inv|faktur|packing|pl|lading|bl|waybill|coo|origin|ska|lartas|kemendag/i.test(dt + ' ' + fn)) {
            const extraCode = /surveyor|ls/i.test(dt + ' ' + fn) ? '810 - LAPORAN SURVEYOR' :
                             /insurance|asuransi/i.test(dt + ' ' + fn) ? '011 - POLIS ASURANSI' :
                             /karantina|health|phyto/i.test(dt + ' ' + fn) ? '851 - SERTIFIKAT KARANTINA' :
                             '999 - DOKUMEN LAINNYA';
            rows.push({
                id: `row-pib-extra-${idx}`,
                code: extraCode,
                docType: dt || 'DOKUMEN PABEAN IMPOR',
                inputId: `pibDocExtraNum_${idx}`,
                dateId: `pibDocExtraDate_${idx}`,
                btnId: `btnOpenDocPibExtra_${idx}`,
                tagId: `tagFilePibExtra_${idx}`,
                number: d.notes?.match(/No[.:\s]+([^\s,]+)/i)?.[1] || d.docNumber || '',
                date: d.notes?.match(/(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/)?.[1] || d.docDate || '',
                fileName: fn || d.fileName || 'Dokumen_Impor.pdf'
            });
        }
    });

    // Render baris dokumen
    rows.forEach((row, index) => {
        appendPibDocRow(row, index + 1);
    });

    updatePibDocTableIndices();
}

function appendPibDocRow(row, index) {
    const tbody = document.getElementById('pibDocTableBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.id = row.id || `row-pib-doc-${Date.now()}`;
    tr.innerHTML = `
        <td style="text-align: center; font-family: var(--font-mono); font-weight: 600;" class="doc-row-num">${index}</td>
        <td>
            <select class="table-input-mono doc-type-select" style="font-weight: 600; font-size: 11.5px; padding: 3px 6px; width: 100%;">
                <option value="705 - B/L" ${row.code.includes('705') ? 'selected' : ''}>705 - B/L</option>
                <option value="380 - INVOICE" ${row.code.includes('380') ? 'selected' : ''}>380 - INVOICE</option>
                <option value="217 - PACKING LIST" ${row.code.includes('217') ? 'selected' : ''}>217 - PACKING LIST</option>
                <option value="861 - COO" ${row.code.includes('861') ? 'selected' : ''}>861 - COO / SKA</option>
                <option value="999 - LARTAS" ${row.code.includes('999') || row.code.includes('LARTAS') ? 'selected' : ''}>999 - PERIZINAN LARTAS</option>
                <option value="810 - LAPORAN SURVEYOR" ${row.code.includes('810') || row.code.includes('SURVEYOR') ? 'selected' : ''}>810 - LAPORAN SURVEYOR</option>
                <option value="011 - POLIS ASURANSI" ${row.code.includes('011') || row.code.includes('ASURANSI') ? 'selected' : ''}>011 - POLIS ASURANSI</option>
                <option value="851 - SERTIFIKAT KARANTINA" ${row.code.includes('851') || row.code.includes('KARANTINA') ? 'selected' : ''}>851 - SERTIFIKAT KARANTINA</option>
                <option value="999 - DOKUMEN LAINNYA" ${(!row.code.includes('705') && !row.code.includes('380') && !row.code.includes('217') && !row.code.includes('861') && !row.code.includes('810') && !row.code.includes('011') && !row.code.includes('851') && !row.code.includes('LARTAS')) ? 'selected' : ''}>999 - DOKUMEN LAINNYA</option>
            </select>
        </td>
        <td><input type="text" id="${row.inputId}" class="table-input-mono doc-input-sync" value="${escapePibHtml(row.number || '')}" placeholder="Nomor dokumen..."></td>
        <td><input type="text" id="${row.dateId}" class="table-input-mono doc-input-sync" value="${escapePibHtml(row.date || '')}" placeholder="YYYY-MM-DD"></td>
        <td style="text-align: center; color: #94a3b8;">-</td>
        <td style="text-align: center; color: #94a3b8;">-</td>
        <td style="text-align: center; color: #94a3b8;">-</td>
        <td>
            <div class="doc-link-wrap">
                <button type="button" class="btn-doc-link" id="${row.btnId}" data-doc-type="${escapePibHtml(row.docType || row.code)}" data-filename="${escapePibHtml(row.fileName || '')}" title="Buka berkas ${escapePibHtml(row.fileName || '')}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
                <span class="doc-file-tag" id="${row.tagId}" title="${escapePibHtml(row.fileName || '')}">${escapePibHtml(row.fileName || 'Dokumen.pdf')}</span>
            </div>
        </td>
        <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 6px;">
                <button type="button" class="btn-ceisa-sub btn-icon-only btn-doc-delete" data-row-id="${tr.id}" title="Hapus Dokumen">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;

    // Wire Buka Dokumen
    const btnOpen = tr.querySelector('.btn-doc-link');
    const tagEl = tr.querySelector('.doc-file-tag');
    const handleOpenViewer = () => {
        const numInput = tr.querySelector(`#${row.inputId}`) || tr.querySelector('input.doc-input-sync');
        const dateInput = tr.querySelector(`#${row.dateId}`) || tr.querySelectorAll('input.doc-input-sync')[1];
        const targetFile = tagEl?.textContent?.trim() || row.fileName || 'Dokumen.pdf';
        const codeSelect = tr.querySelector('.doc-type-select');
        const selectedCode = codeSelect ? codeSelect.value : (row.docType || row.code);
        if (typeof openCeisaDocViewer === 'function') {
            openCeisaDocViewer({
                docType: selectedCode,
                fileName: targetFile,
                docNumber: numInput?.value || row.number,
                docDate: dateInput?.value || row.date
            });
        }
    };

    if (btnOpen) btnOpen.addEventListener('click', handleOpenViewer);
    if (tagEl) {
        tagEl.style.cursor = 'pointer';
        tagEl.addEventListener('click', handleOpenViewer);
    }

    // Wire Hapus Dokumen
    const btnDel = tr.querySelector('.btn-doc-delete');
    if (btnDel) {
        btnDel.addEventListener('click', function () {
            tr.style.transition = 'opacity 0.2s';
            tr.style.opacity = '0';
            setTimeout(() => {
                tr.remove();
                updatePibDocTableIndices();
                triggerPibAutoSave();
            }, 200);
        });
    }

    // Wire input sync auto-save
    tr.querySelectorAll('input, select').forEach(inp => {
        inp.addEventListener('input', () => triggerPibAutoSave());
        inp.addEventListener('change', () => triggerPibAutoSave());
    });

    tbody.appendChild(tr);
}

function updatePibDocTableIndices() {
    const tbody = document.getElementById('pibDocTableBody');
    const totalSpan = document.getElementById('pibDocTableTotal');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach((tr, idx) => {
        const numCell = tr.querySelector('td:first-child');
        if (numCell) numCell.textContent = idx + 1;
    });

    if (totalSpan) {
        totalSpan.textContent = `Total ${rows.length} Dokumen`;
    }
}

function addNewPibDocRow() {
    const tbody = document.getElementById('pibDocTableBody');
    if (!tbody) return;

    const currentCount = tbody.querySelectorAll('tr').length;
    const newIdx = currentCount + 1;
    const randId = Date.now();

    const newRow = {
        id: `row-pib-doc-${randId}`,
        code: '999 - DOKUMEN LAINNYA',
        docType: 'DOKUMEN PABEAN IMPOR',
        inputId: `pibDocCustomNum_${randId}`,
        dateId: `pibDocCustomDate_${randId}`,
        btnId: `btnOpenDocPibCustom_${randId}`,
        tagId: `tagFilePibCustom_${randId}`,
        number: '',
        date: '',
        fileName: 'Pilih_Dokumen.pdf'
    };

    appendPibDocRow(newRow, newIdx);
    updatePibDocTableIndices();
    triggerPibAutoSave();
    if (typeof showToast === 'function') {
        showToast('Baris dokumen lampiran PIB baru ditambahkan.', 'info');
    }
}

function sortPibDocRows() {
    const tbody = document.getElementById('pibDocTableBody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const orderScore = (row) => {
        const text = row.textContent || '';
        if (text.includes('705') || text.includes('B/L') || text.includes('LADING')) return 1;
        if (text.includes('380') || text.includes('INVOICE')) return 2;
        if (text.includes('217') || text.includes('PACKING')) return 3;
        if (text.includes('861') || text.includes('ORIGIN') || text.includes('COO')) return 4;
        if (text.includes('999') || text.includes('LARTAS') || text.includes('KEMENDAG')) return 5;
        if (text.includes('810') || text.includes('SURVEYOR')) return 6;
        if (text.includes('011') || text.includes('ASURANSI')) return 7;
        return 8;
    };

    rows.sort((a, b) => orderScore(a) - orderScore(b));
    rows.forEach(r => tbody.appendChild(r));
    updatePibDocTableIndices();
    triggerPibAutoSave();
    if (typeof showToast === 'function') {
        showToast('Tabel dokumen lampiran PIB telah diurutkan.', 'info');
    }
}

// SYNC & RENDER ATTACHED DOCUMENTS IN PIB TAB DOKUMEN (BACKWARD COMPATIBLE WRAPPER)


// RENDER PIB SAFETY CHECK AUDIT CARD
function renderPibSafeCheck(safeCheck) {
    const container = document.getElementById('pibSafeCheckSection');
    if (!container) return;

    if (!safeCheck) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const isRelated = safeCheck.isRelated !== false;
    const score = safeCheck.confidenceScore !== undefined ? safeCheck.confidenceScore : 100;
    const banner = document.getElementById('pibSafeCheckBanner');
    const statusBadge = document.getElementById('pibSafeCheckStatusBadge');
    const scoreVal = document.getElementById('pibSafeCheckScore');
    const title = document.getElementById('pibSafeCheckTitle');
    const summary = document.getElementById('pibSafeCheckSummary');
    const matchedList = document.getElementById('pibSafeCheckMatchedList');
    const warningsBox = document.getElementById('pibSafeCheckWarningsBox');
    const warningsList = document.getElementById('pibSafeCheckWarningsList');
    const docTbody = document.getElementById('pibSafeCheckDocTableBody');

    if (scoreVal) scoreVal.textContent = score + '%';
    if (summary) summary.textContent = safeCheck.summary || 'Validasi keterkaitan dokumen selesai.';

    if (banner && statusBadge && title) {
        if (isRelated) {
            banner.className = 'safecheck-banner';
            statusBadge.className = 'badge-safe-valid';
            statusBadge.textContent = 'Tervalidasi: 1 Shipment';
            title.textContent = 'Semua Dokumen Cocok & Terverifikasi 1 Kesatuan Pengiriman';
        } else {
            banner.className = 'safecheck-banner safecheck-banner-warning';
            statusBadge.className = 'badge-safe-warning';
            statusBadge.textContent = 'Peringatan: Dokumen Asing / Selisih';
            title.textContent = 'Perhatian: Ditemukan Ketidaksesuaian Antar-Dokumen';
        }
    }

    if (matchedList) {
        matchedList.innerHTML = '';
        const matched = safeCheck.matchedIdentifiers || [];
        if (matched.length > 0) {
            matched.forEach(m => {
                const li = document.createElement('li');
                li.innerHTML = `<span style="color: var(--color-green-text); font-weight: 700; flex-shrink: 0;">✓</span><span>${escapePibHtml(m)}</span>`;
                matchedList.appendChild(li);
            });
        } else {
            matchedList.innerHTML = `<li style="color: var(--text-muted);">Tidak ada catatan parameter khusus.</li>`;
        }
    }

    if (warningsBox && warningsList) {
        const warnings = safeCheck.discrepanciesOrWarnings || [];
        if (warnings && warnings.length > 0) {
            warningsBox.style.display = 'block';
            warningsList.innerHTML = '';
            warnings.forEach(w => {
                const li = document.createElement('li');
                li.innerHTML = `<span style="color: var(--color-red-text); font-weight: 700; flex-shrink: 0;">!</span><span>${escapePibHtml(w)}</span>`;
                warningsList.appendChild(li);
            });
        } else {
            warningsBox.style.display = 'none';
        }
    }

    if (docTbody) {
        docTbody.innerHTML = '';
        const docs = safeCheck.documentList || [];
        if (docs.length > 0) {
            docs.forEach((d, idx) => {
                const tr = document.createElement('tr');
                const isShipmentDoc = d.belongsToShipment !== false;
                const fileName = d.fileName || 'Dokumen_Pabean.pdf';
                const docType = d.documentType || 'DOKUMEN';
                tr.innerHTML = `
                    <td style="text-align: center; font-family: var(--font-mono); font-weight: 600;">${idx + 1}</td>
                    <td style="font-family: var(--font-mono); font-size: 12px; font-weight: 600;">
                        <span style="color: var(--text-primary);">${escapePibHtml(fileName)}</span>
                    </td>
                    <td><span style="font-size: 12px; font-weight: 600; background: var(--surface-subtle); color: var(--text-primary); border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 3px;">${escapePibHtml(docType)}</span></td>
                    <td style="text-align: center;">
                        <span class="${isShipmentDoc ? 'badge-safe-valid' : 'badge-safe-warning'}" style="font-size: 12px; padding: 2px 6px;">
                            ${isShipmentDoc ? 'Cocok (1 Shipment)' : 'Asing / Tidak Cocok'}
                        </span>
                    </td>
                    <td style="font-size: 12px; color: var(--text-secondary);">${escapePibHtml(d.notes || '-')}</td>
                `;
                docTbody.appendChild(tr);
            });
        }
    }
}

function updatePibDocTable(data = {}) {
    renderPibDocumentsTable(data);
}

// RESET PIB FORM TO BLANK/DEFAULTS
function resetPibForm() {
    if (!confirm('Apakah Anda yakin ingin mengosongkan formulir Draft PIB?')) return;
    try {
        localStorage.removeItem(STORAGE_KEY_LAST_PIB_DRAFT);
        localStorage.removeItem(STORAGE_KEY_LAST_PIB_FILENAME);
    } catch (e) {}

    const freshNoAju = `010700-${Math.floor(100000 + Math.random() * 900000)}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(100000 + Math.random() * 900000)}`;
    const blankData = {
        ...SAMPLE_PIB_DATA,
        nomorAju: freshNoAju,
        importirName: "",
        importirAddress: "",
        supplierName: "",
        supplierAddress: "",
        blNumber: "",
        invoiceNumber: "",
        packingListNumber: "",
        invoiceAmount: 0,
        freightAmount: 0,
        insuranceAmount: 0
    };
    loadPibDraftData(blankData, true);
    switchPibTab('pib-tab-header');
    if (typeof showToast === 'function') {
        showToast('Formulir Draft PIB berhasil di-reset.', 'info');
    }
}

// EXPORT PIB JSON
function exportPibJson() {
    const data = collectPibFormData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeFilename = `PIB_Draft_${(data.nomorAju || 'BC20').replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
    a.href = url;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Simpan juga ke backend server di folder drafts/impor/
    try {
        fetch(getBackendUrl('/api/save-draft'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'impor',
                data: data,
                filename: safeFilename
            })
        }).then(res => res.json()).then(res => {
            console.log('[SAVE-DRAFT IMPOR]', res);
        }).catch(err => {
            console.warn('Gagal sinkronisasi draft PIB ke server:', err);
        });
    } catch (e) {}

    if (typeof showToast === 'function') {
        showToast('Draft PIB berhasil diekspor (tersimpan di drafts/impor/)!', 'success');
    }
}

// SUBMIT CUSTOMS VALIDATION (SIMULATED CEISA 4.0 VALIDATION)
function submitPibCustoms() {
    const data = collectPibFormData();
    if (!data.importirName) {
        alert('Mohon lengkapi Nama Importir pada tab Entitas terlebih dahulu!');
        switchPibTab('pib-tab-entitas');
        return;
    }
    if (!data.invoiceNumber) {
        alert('Mohon lengkapi Nomor Invoice pada tab Dokumen terlebih dahulu!');
        switchPibTab('pib-tab-dokumen');
        return;
    }
    if (typeof showToast === 'function') {
        showToast('Memvalidasi Draft PIB ke OpenAPI Bea Cukai...', 'info');
    }
    setTimeout(() => {
        alert(`VALIDASI DOKUMEN IMPOR BERHASIL!\n\nNomor Aju: ${data.nomorAju}\nDokumen: BC 2.0 (PIB)\nKantor Pabean: ${data.kantorPabean}\nImportir: ${data.importirName}\nStatus: Siap Kirim (Billing Terbit)`);
    }, 800);
}

// COPY / SYNC HANDLERS
function setupPibCopyHandlers() {
    const checkOwner = document.getElementById('pibCheckOwnerSame');
    if (checkOwner) {
        checkOwner.addEventListener('change', () => {
            if (checkOwner.checked) {
                const name = document.getElementById('pibImportirName')?.value || '';
                const addr = document.getElementById('pibImportirAddress')?.value || '';
                const id = document.getElementById('pibImportirId')?.value || '';
                const elName = document.getElementById('pibOwnerName');
                const elAddr = document.getElementById('pibOwnerAddress');
                const elId = document.getElementById('pibOwnerId');
                if (elName) elName.value = name;
                if (elAddr) elAddr.value = addr;
                if (elId) elId.value = id;
            }
        });
    }

    const checkSeller = document.getElementById('pibCheckSellerSame');
    if (checkSeller) {
        checkSeller.addEventListener('change', () => {
            if (checkSeller.checked) {
                const name = document.getElementById('pibSupplierName')?.value || '';
                const addr = document.getElementById('pibSupplierAddress')?.value || '';
                const country = document.getElementById('pibSupplierCountry')?.value || '';
                const elName = document.getElementById('pibSellerName');
                const elAddr = document.getElementById('pibSellerAddress');
                const elCountry = document.getElementById('pibSellerCountry');
                if (elName) elName.value = name;
                if (elAddr) elAddr.value = addr;
                if (elCountry) elCountry.value = country;
            }
        });
    }
}

// INITIALIZATION ENTRYPOINT FOR PIB MODULE
function initPibDashboard() {
    if (!document.getElementById('module-pib')) return;

    // 1. PIB Tabs Click Handlers
    document.querySelectorAll('#module-pib .ceisa-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-pib-tab');
            if (tabId) switchPibTab(tabId);
        });
    });

    // 2. Stepper Prev / Next
    const btnPrev = document.getElementById('btnPibTabPrev');
    const btnNext = document.getElementById('btnPibTabNext');
    if (btnPrev) btnPrev.addEventListener('click', handlePibTabPrev);
    if (btnNext) btnNext.addEventListener('click', handlePibTabNext);

    // 2b. Header Tab Next Button & Topbar Buttons (FTZ01 1:1)
    const btnNextHeader = document.getElementById('btnNextFromPibHeader');
    if (btnNextHeader) {
        btnNextHeader.addEventListener('click', () => {
            switchPibTab('pib-tab-entitas');
        });
    }

    const btnPibKembali = document.getElementById('btnPibKembali');
    if (btnPibKembali) {
        btnPibKembali.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'dashboard.html';
            }
        });
    }

    const btnPibUpdateData = document.getElementById('btnPibUpdateData');
    if (btnPibUpdateData) {
        btnPibUpdateData.addEventListener('click', () => {
            saveCurrentPibDraft(true);
            showToast('Data draft PIB / FTZ01 berhasil diperbarui!', 'success');
        });
    }

    // 3. Calculation Triggers
    const calcTriggers = [
        'pibInvoiceAmount',
        'pibFreightAmount',
        'pibInsuranceAmount',
        'pibExchangeRate',
        'pibIncoterm',
        'pibTarifBm',
        'pibImportirStatus'
    ];
    calcTriggers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculatePibPungutan);
            el.addEventListener('change', calculatePibPungutan);
        }
    });

    // 4. Auto-Save on all inputs inside #module-pib
    document.querySelectorAll('#module-pib input, #module-pib select, #module-pib textarea').forEach(input => {
        input.addEventListener('input', triggerPibAutoSave);
        input.addEventListener('change', triggerPibAutoSave);
    });

    // 5. Header Action: Unggah JSON PIB
    const btnUploadPib = document.getElementById('btnPibHeaderUploadJson');
    const fileInputPib = document.getElementById('pibHeaderJsonFileInput');
    if (btnUploadPib && fileInputPib) {
        btnUploadPib.addEventListener('click', () => fileInputPib.click());
    }
    if (fileInputPib) {
        fileInputPib.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const lbl = document.getElementById('lblPibFileName');
            if (lbl) lbl.textContent = file.name;
            try {
                localStorage.setItem(STORAGE_KEY_LAST_PIB_FILENAME, file.name);
            } catch (err) {}

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    loadPibDraftData(parsed, true);
                    if (typeof showToast === 'function') {
                        showToast(`Berkas '${file.name}' berhasil dimuat ke Draft PIB!`, 'success');
                    }
                } catch (err) {
                    alert('Format berkas JSON tidak valid: ' + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    // 6. Header Action: Dokumen Baru for PIB
    const btnDokumenBaruPib = document.getElementById('btnPibDokumenBaru');
    if (btnDokumenBaruPib) {
        btnDokumenBaruPib.addEventListener('click', () => {
            const btnPebDocBaru = document.getElementById('btnDokumenBaru');
            if (btnPebDocBaru) {
                btnPebDocBaru.click();
            }
        });
    }

    // 7. Header Action: Cetak PIB
    const btnPrintPib = document.getElementById('btnPibHeaderPrint');
    if (btnPrintPib) {
        btnPrintPib.addEventListener('click', () => window.print());
    }

    // 8. Bottom Dock Buttons
    const btnReset = document.getElementById('btnPibResetDraft');
    if (btnReset) btnReset.addEventListener('click', resetPibForm);

    const btnExport = document.getElementById('btnPibExportJson');
    if (btnExport) btnExport.addEventListener('click', exportPibJson);

    const btnSubmit = document.getElementById('btnPibSubmitCustoms');
    if (btnSubmit) btnSubmit.addEventListener('click', submitPibCustoms);

    // Tab Dokumen Actions: Tambah & Urutkan
    
    // PIB SafeCheck collapsible toggle
    const pibSafeCheckHdr = document.getElementById('pibSafeCheckHeader');
    const pibSafeCheckBdy = document.getElementById('pibSafeCheckBody');
    const btnTogglePibSafe = document.getElementById('btnTogglePibSafeCheck');
    if (pibSafeCheckHdr && pibSafeCheckBdy && btnTogglePibSafe) {
        pibSafeCheckHdr.addEventListener('click', () => {
            const isCollapsed = pibSafeCheckBdy.classList.contains('collapsed');
            if (isCollapsed) {
                pibSafeCheckBdy.classList.remove('collapsed');
                pibSafeCheckBdy.style.display = 'block';
                btnTogglePibSafe.classList.add('open');
                btnTogglePibSafe.setAttribute('aria-expanded', 'true');
            } else {
                pibSafeCheckBdy.classList.add('collapsed');
                pibSafeCheckBdy.style.display = 'none';
                btnTogglePibSafe.classList.remove('open');
                btnTogglePibSafe.setAttribute('aria-expanded', 'false');
            }
        });
    }

    const btnAddPibDoc = document.getElementById('btnAddPibDoc');
    if (btnAddPibDoc) {
        btnAddPibDoc.addEventListener('click', addNewPibDocRow);
    }
    const btnSortPibDoc = document.getElementById('btnSortPibDoc');
    if (btnSortPibDoc) {
        btnSortPibDoc.addEventListener('click', sortPibDocRows);
    }

    // 9. Copy entity helpers
    setupPibCopyHandlers();

    // 10. CEISA 4.0 Authentic Item Stepper & Navigation Handlers
    const btnPrevItem = document.getElementById('btnPibItemPrev');
    if (btnPrevItem) {
        btnPrevItem.addEventListener('click', () => {
            savePibActiveItemFromForm();
            if (window._currentPibItemIdx > 0) {
                renderPibActiveItem(window._currentPibItemIdx - 1);
            }
        });
    }

    const btnNextItem = document.getElementById('btnPibItemNext');
    if (btnNextItem) {
        btnNextItem.addEventListener('click', () => {
            savePibActiveItemFromForm();
            if (window._currentPibItemIdx < (window._pibItems?.length || 1) - 1) {
                renderPibActiveItem(window._currentPibItemIdx + 1);
            }
        });
    }

    const btnJumpItem = document.getElementById('btnPibJumpItem');
    const inpJumpItem = document.getElementById('pibJumpItemInput');
    const doJumpItem = () => {
        if (window._pibViewMode === 'editor' && typeof savePibActiveItemFromForm === 'function') {
            savePibActiveItemFromForm();
        }
        const val = parseInt(inpJumpItem?.value, 10);
        if (!isNaN(val) && val >= 1 && val <= (window._pibItems?.length || 1)) {
            openPibItemEditor(val - 1);
        }
    };
    if (btnJumpItem) btnJumpItem.addEventListener('click', doJumpItem);
    if (inpJumpItem) {
        inpJumpItem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doJumpItem();
        });
    }

    const searchSummary = document.getElementById('pibSummarySearch');
    if (searchSummary) {
        searchSummary.addEventListener('input', (e) => {
            renderPibSummaryTable(e.target.value);
        });
    }

    const btnSimpanItem = document.getElementById('btnPibItemSimpan');
    if (btnSimpanItem) {
        btnSimpanItem.addEventListener('click', () => {
            savePibActiveItemFromForm();
            saveCurrentPibDraftState();
            if (typeof showToast === 'function') {
                showToast(`Barang No. ${window._currentPibItemIdx + 1} berhasil disimpan!`, 'success');
            }
        });
    }

    const btnBackToList = document.getElementById('btnPibBackToList');
    if (btnBackToList) {
        btnBackToList.addEventListener('click', () => {
            savePibActiveItemFromForm();
            showPibItemListView();
        });
    }

    const btnTutupItem = document.getElementById('btnPibItemTutup');
    if (btnTutupItem) {
        btnTutupItem.addEventListener('click', () => {
            savePibActiveItemFromForm();
            showPibItemListView();
        });
    }

    const btnAddItem = document.getElementById('btnPibAddItem');
    if (btnAddItem) {
        btnAddItem.addEventListener('click', () => {
            if (window._pibViewMode === 'editor' && typeof savePibActiveItemFromForm === 'function') {
                savePibActiveItemFromForm();
            }
            const country = document.getElementById('pibSupplierCountry')?.value || 'CN - CHINA';
            if (!Array.isArray(window._pibItems)) window._pibItems = [];
            window._pibItems.push({
                hsCode: '',
                uraianJenisBarang: '',
                jumlahDanSatuanBarang: '1 PCE',
                countryOfOrigin: country,
                amount: '0.00',
                kemasan: '1 PX - PALLET'
            });
            openPibItemEditor(window._pibItems.length - 1);
            triggerPibAutoSave();
            if (typeof showToast === 'function') {
                showToast(`Barang No. ${window._pibItems.length} ditambahkan! Lengkapi rincian barang.`, 'info');
            }
        });
    }

    const btnSesuaiHs = document.getElementById('btnPibItemSesuaiHs');
    if (btnSesuaiHs) {
        btnSesuaiHs.addEventListener('click', () => {
            const hsVal = document.getElementById('pibItemHsCode')?.value?.trim() || '';
            const uraianEl = document.getElementById('pibItemUraian');
            if (uraianEl) {
                if (hsVal) {
                    uraianEl.value = `SESUAI BTKI POS TARIF ${hsVal}: ${uraianEl.value || 'KOMODITAS IMPOR SESUAI STANDAR HS'}`;
                } else {
                    uraianEl.value = 'SESUAI POS TARIF BTKI';
                }
                savePibActiveItemFromForm();
                triggerPibAutoSave();
            }
        });
    }

    const btnNavPrevTab = document.getElementById('btnPibItemNavPrevTab');
    if (btnNavPrevTab) {
        btnNavPrevTab.addEventListener('click', () => switchPibTab('pib-tab-transaksi'));
    }

    const btnNavNextTab = document.getElementById('btnPibItemNavNextTab');
    if (btnNavNextTab) {
        btnNavNextTab.addEventListener('click', () => switchPibTab('pib-tab-pungutan'));
    }

    // Auto-calculate Item Price & CIF on input
    ['pibItemAmountFob', 'pibItemQty'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const amtStr = document.getElementById('pibItemAmountFob')?.value || '0';
                const qtyStr = document.getElementById('pibItemQty')?.value || '1';
                const fobNum = parseFloat(String(amtStr).replace(/[^0-9.]/g, '')) || 0;
                const qtyNum = parseFloat(String(qtyStr).replace(/[^0-9.]/g, '')) || 1;
                const unitPrice = qtyNum > 0 ? (fobNum / qtyNum).toFixed(4) : '0.00';
                const hargaSatuanEl = document.getElementById('pibItemHargaSatuan');
                if (hargaSatuanEl) hargaSatuanEl.value = unitPrice;

                const fobEl = document.getElementById('pibItemFob');
                if (fobEl) fobEl.value = amtStr;

                const kurs = parseFloat(document.getElementById('pibExchangeRate')?.value) || 16300;
                const cifRp = Math.round(fobNum * kurs);
                const cifRpEl = document.getElementById('pibItemCifRupiah');
                if (cifRpEl) cifRpEl.value = `Rp ${cifRp.toLocaleString('id-ID')},00`;

                savePibActiveItemFromForm();
                calculatePibPungutan();
            });
        }
    });

    // 11. Initial Draft Restore & Calculation
    restorePibDraftState();

    // 12. Check if payload from HS Code Checker exists
    try {
        const pibPayloadRaw = localStorage.getItem('ceisa_apply_to_pib');
        if (pibPayloadRaw) {
            localStorage.removeItem('ceisa_apply_to_pib');
            const pibPayload = JSON.parse(pibPayloadRaw);
            switchPibTab('pib-tab-barang');

            const hsInput = document.getElementById('pibItemHsCode');
            const uraianInput = document.getElementById('pibItemUraian');
            const unitInput = document.getElementById('pibItemUnit');
            const tarifBmInput = document.getElementById('pibTarifBm');

            if (hsInput) hsInput.value = pibPayload.hsCode;
            if (uraianInput) uraianInput.value = pibPayload.uraian;
            if (unitInput && pibPayload.satuan) unitInput.value = pibPayload.satuan;
            if (tarifBmInput && pibPayload.bmRate !== undefined) tarifBmInput.value = pibPayload.bmRate;

            savePibActiveItemFromForm();
            calculatePibPungutan();
            renderPibSummaryTable();
            triggerPibAutoSave();

            if (typeof showToast === 'function') {
                showToast(`Pos Tarif ${pibPayload.hsCode} berhasil diterapkan ke Draft PIB!`, 'success');
            }
        }
    } catch (e) {}
}

// DOM Ready initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPibDashboard);
} else {
    initPibDashboard();
}
