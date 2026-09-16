// ====================================================================
// CEISA 4.0 PORTAL MASTER & MODUL DRAFT PEB (EKSPOR)
// peb_dashboard.js - 100% External, Chrome Extension CSP Compliant
// ====================================================================

// MASTER PORTAL MODULE SWITCHER (CEISA 4.0 SIDEBAR & WORKSPACE)
function switchPortalModule(moduleName) {
    const pebView = document.getElementById('module-peb');
    const inspectorView = document.getElementById('module-inspector');
    const btnPeb = document.getElementById('btnNavPeb');
    const btnInspector = document.getElementById('btnNavInspector');
    const pebHeaderActions = document.getElementById('pebHeaderActions');
    const inspectorHeaderActions = document.getElementById('inspectorHeaderActions');

    if (moduleName === 'inspector') {
        if (pebView) pebView.style.display = 'none';
        if (inspectorView) inspectorView.style.display = 'block';
        if (btnPeb) {
            btnPeb.classList.remove('active');
            btnPeb.setAttribute('aria-selected', 'false');
        }
        if (btnInspector) {
            btnInspector.classList.add('active');
            btnInspector.setAttribute('aria-selected', 'true');
        }
        if (pebHeaderActions) pebHeaderActions.style.display = 'none';
        if (inspectorHeaderActions) inspectorHeaderActions.style.display = 'flex';
        if (typeof loadDashboardData === 'function') loadDashboardData();
    } else {
        if (pebView) pebView.style.display = 'block';
        if (inspectorView) inspectorView.style.display = 'none';
        if (btnPeb) {
            btnPeb.classList.add('active');
            btnPeb.setAttribute('aria-selected', 'true');
        }
        if (btnInspector) {
            btnInspector.classList.remove('active');
            btnInspector.setAttribute('aria-selected', 'false');
        }
        if (pebHeaderActions) pebHeaderActions.style.display = 'flex';
        if (inspectorHeaderActions) inspectorHeaderActions.style.display = 'none';
    }
    try {
        sessionStorage.setItem('ceisa_active_portal_module', moduleName);
    } catch (e) {
        console.warn('Storage unavailable:', e);
    }
}

// UNIFIED TOAST NOTIFICATION
function showToast(msg, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast visible';
    if (type === 'success') toast.classList.add('toast-success');
    else if (type === 'error') toast.classList.add('toast-error');
    else toast.classList.add('toast-info');

    setTimeout(() => {
        toast.className = 'toast';
    }, 2500);
}

// ====================================================================
// MODUL PEB: PERSISTENCE & DATA MANAGEMENT
// ====================================================================
const STORAGE_KEY_LAST_DRAFT = 'ceisa_last_loaded_draft';
const STORAGE_KEY_LAST_FILENAME = 'ceisa_last_loaded_filename';
let autoSaveTimer = null;

function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveCurrentDraftState();
    }, 600);
}

function saveCurrentDraftState() {
    try {
        const draft = collectFormData();
        localStorage.setItem(STORAGE_KEY_LAST_DRAFT, JSON.stringify(draft));
        const indicator = document.getElementById('saveIndicator');
        if (indicator) {
            indicator.style.opacity = '1';
            indicator.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--color-green-text);"></span> Tersimpan Otomatis';
        }
    } catch (err) {
        console.warn('Gagal menyimpan draft ke localStorage:', err);
    }
}

function restoreDraftState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_LAST_DRAFT);
        const savedName = localStorage.getItem(STORAGE_KEY_LAST_FILENAME);
        if (saved) {
            const data = JSON.parse(saved);
            if (savedName) {
                const lbl = document.getElementById('lblFileName');
                if (lbl) lbl.textContent = savedName;
            }
            loadDraftData(data, false);
            return true;
        }
    } catch (e) {
        console.warn('Draft lokal tidak valid, memuat data default.');
    }
    return false;
}

function resetDraftForm() {
    if (confirm("Kosongkan seluruh formulir draft PEB? Memori draft tersimpan akan dibersihkan.")) {
        try {
            localStorage.removeItem(STORAGE_KEY_LAST_DRAFT);
            localStorage.removeItem(STORAGE_KEY_LAST_FILENAME);
        } catch (e) {}
        const lbl = document.getElementById('lblFileName');
        if (lbl) lbl.textContent = 'Draft_Baru.json';
        loadDraftData({
            nomorAju: '030000-' + Math.floor(100000 + Math.random() * 900000) + '-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-000001',
            shipperName: '',
            shipperAddress: '',
            consigneeName: '',
            consigneeAddress: '',
            invoiceNumber: '',
            invoiceDate: '',
            packingListNumber: '',
            packingListDate: '',
            blNumber: '',
            blDate: '',
            loadingPort: '',
            dischargePort: '',
            containerNumber: '',
            totalKemasan: '',
            totalNetWeightKGM: '',
            totalGrossWeightKGM: '',
            items: []
        }, false);
        showToast("Formulir telah dikosongkan.", "info");
    }
}

function exportJsonDraft() {
    const draft = collectFormData();
    const jsonStr = JSON.stringify(draft, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const noAju = document.getElementById('noAju')?.value || 'PEB_Draft';
    a.href = url;
    a.download = `Draft_PEB_${noAju.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Berkas JSON berhasil diekspor!", "success");
}

function collectFormData() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    const items = [];

    rows.forEach(r => {
        if (r.querySelector('td[colspan="8"]')) return;
        const desc = r.querySelector('.item-desc')?.value.trim();
        const qtyVal = r.querySelector('.item-qty-val')?.value.trim();
        const qtyUnit = r.querySelector('.item-qty-unit')?.value || 'PCE';
        const packVal = r.querySelector('.item-pack-val')?.value.trim();
        const packType = r.querySelector('.item-pack-type')?.value || 'BX';
        const net = r.querySelector('.item-net')?.value.trim();
        const gross = r.querySelector('.item-gross')?.value.trim();
        const amt = r.querySelector('.item-amt')?.value.trim();

        if (desc || qtyVal) {
            items.push({
                uraianJenisBarang: desc,
                jumlahDanSatuanBarang: qtyVal ? `${qtyVal} ${qtyUnit}` : '',
                kemasan: packVal ? `${packVal} ${packType}` : '',
                beratBersih: net,
                beratKotor: gross,
                amount: amt
            });
        }
    });

    return {
        nomorAju: document.getElementById('noAju')?.value || '',
        kantorPabean: document.getElementById('kantorPabean')?.value || '',
        jenisEkspor: document.getElementById('jenisEkspor')?.value || '',
        kategoriEkspor: document.getElementById('kategoriEkspor')?.value || '',
        caraDagang: document.getElementById('caraDagang')?.value || '',
        caraBayar: document.getElementById('caraBayar')?.value || '',
        valutaHeader: document.getElementById('valutaHeader')?.value || '',
        nilaiEksporHeader: document.getElementById('nilaiEksporHeader')?.value || '',
        shipperName: document.getElementById('shipperName')?.value || '',
        shipperAddress: document.getElementById('shipperAddress')?.value || '',
        consigneeName: document.getElementById('consigneeName')?.value || '',
        consigneeAddress: document.getElementById('consigneeAddress')?.value || '',
        invoiceNumber: document.getElementById('invoiceNumber')?.value || '',
        invoiceDate: document.getElementById('invoiceDate')?.value || '',
        packingListNumber: document.getElementById('packingListNumber')?.value || '',
        packingListDate: document.getElementById('packingListDate')?.value || '',
        blNumber: document.getElementById('blNumber')?.value || '',
        blDate: document.getElementById('blDate')?.value || '',
        loadingPort: document.getElementById('loadingPort')?.value || '',
        dischargePort: document.getElementById('dischargePort')?.value || '',
        // Tab Pengangkut
        namaPengangkut: document.getElementById('namaPengangkut')?.value || '',
        voyageNumber: document.getElementById('voyageNumber')?.value || '',
        benderaPengangkut: document.getElementById('benderaPengangkut')?.value || '',
        tglPerkiraanEkspor: document.getElementById('tglPerkiraanEkspor')?.value || '',
        // Tab Kemasan & Peti Kemas
        containerNumber: document.getElementById('containerNumber')?.value || '',
        segelKontainer: document.getElementById('segelKontainer')?.value || '',
        totalKemasan: document.getElementById('totalKemasan')?.value || '',
        merekKemasan: document.getElementById('merekKemasan')?.value || '',
        totalNetWeightKGM: document.getElementById('totalNetWeightKGM')?.value || '',
        totalGrossWeightKGM: document.getElementById('totalGrossWeightKGM')?.value || '',
        // Tab Transaksi
        kursPabean: document.getElementById('kursPabean')?.value || '',
        incotermsTransaksi: document.getElementById('incotermsTransaksi')?.value || '',
        freightHeader: document.getElementById('freightHeader')?.value || '',
        asuransiHeader: document.getElementById('asuransiHeader')?.value || '',
        nilaiPabeanIdr: document.getElementById('nilaiPabeanIdr')?.value || '',
        caraBayarTransaksi: document.getElementById('caraBayarTransaksi')?.value || '',
        bankDhe: document.getElementById('bankDhe')?.value || '',
        // Tab Pernyataan
        pernyataanTempat: document.getElementById('pernyataanTempat')?.value || '',
        pernyataanTanggal: document.getElementById('pernyataanTanggal')?.value || '',
        pernyataanNama: document.getElementById('pernyataanNama')?.value || '',
        pernyataanJabatan: document.getElementById('pernyataanJabatan')?.value || '',
        pernyataanNik: document.getElementById('pernyataanNik')?.value || '',
        items: items,
        safeCheck: window._currentSafeCheck || null
    };
}

// 9-TAB DEFINITION & TITLES (1:1 STANDAR RESMI CEISA 4.0)
const CEISA_TAB_ORDER = [
    'tab-header',
    'tab-entitas',
    'tab-dokumen',
    'tab-pengangkut',
    'tab-kemasan',
    'tab-transaksi',
    'tab-barang',
    'tab-pungutan',
    'tab-pernyataan'
];

const CEISA_TAB_TITLES = {
    'tab-header': 'Header',
    'tab-entitas': 'Entitas',
    'tab-dokumen': 'Dokumen',
    'tab-pengangkut': 'Pengangkut',
    'tab-kemasan': 'Kemasan & Peti Kemas',
    'tab-transaksi': 'Transaksi',
    'tab-barang': 'Barang',
    'tab-pungutan': 'Pungutan',
    'tab-pernyataan': 'Pernyataan'
};

// TAB SWITCHING IN PEB MODULE
function switchCeisaTab(tabId) {
    if (!CEISA_TAB_ORDER.includes(tabId)) {
        tabId = 'tab-header';
    }

    document.querySelectorAll('#module-peb .tab-content-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.querySelectorAll('#module-peb .ceisa-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add('active');

    const matchingBtn = document.querySelector(`#module-peb .ceisa-tab-btn[data-tab="${tabId}"]`);
    if (matchingBtn) {
        matchingBtn.classList.add('active');
    }

    // Update Stepper Navigation Controls
    const currentIndex = CEISA_TAB_ORDER.indexOf(tabId);
    const btnPrev = document.getElementById('btnTabPrev');
    const btnNext = document.getElementById('btnTabNext');
    const stepBadge = document.getElementById('ceisaStepBadge');
    const stepLabel = document.getElementById('ceisaStepLabel');

    if (currentIndex === 0) {
        // Tab 1 (Header): Tidak ada tombol Sebelumnya, hanya tombol Selanjutnya di kanan
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) {
            btnNext.style.display = 'inline-flex';
            btnNext.style.marginLeft = 'auto';
            btnNext.innerHTML = 'Selanjutnya <span style="font-size: 14px;">&#x21BB;</span>';
        }
    } else if (currentIndex === CEISA_TAB_ORDER.length - 1) {
        // Tab terakhir (9/9 Pernyataan): tombol Sebelumnya di kiri disembunyikan, tombol kanan diubah jadi "Sebelumnya"
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) {
            btnNext.style.display = 'inline-flex';
            btnNext.style.marginLeft = 'auto';
            btnNext.innerHTML = '<span style="font-size: 14px;">&#x21BA;</span> Sebelumnya';
        }
    } else {
        // Tab 2 - 8: Tombol Sebelumnya di kiri dan Selanjutnya di kanan
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

    if (stepBadge) {
        stepBadge.textContent = `Langkah ${currentIndex + 1} / ${CEISA_TAB_ORDER.length}`;
    }
    if (stepLabel) {
        stepLabel.textContent = CEISA_TAB_TITLES[tabId] || tabId;
    }

    window._activeCeisaTab = tabId;
}

function handleStepperPrev() {
    const current = window._activeCeisaTab || 'tab-header';
    const currentIndex = CEISA_TAB_ORDER.indexOf(current);
    if (currentIndex > 0) {
        switchCeisaTab(CEISA_TAB_ORDER[currentIndex - 1]);
        const mainWorkspace = document.querySelector('#module-peb .main-workspace');
        if (mainWorkspace) mainWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function handleStepperNext() {
    const current = window._activeCeisaTab || 'tab-header';
    const currentIndex = CEISA_TAB_ORDER.indexOf(current);
    if (currentIndex === CEISA_TAB_ORDER.length - 1) {
        // Pada tab 9/9, tombol kanan bertindak sebagai "Sebelumnya"
        handleStepperPrev();
        return;
    }
    if (currentIndex < CEISA_TAB_ORDER.length - 1) {
        switchCeisaTab(CEISA_TAB_ORDER[currentIndex + 1]);
        const mainWorkspace = document.querySelector('#module-peb .main-workspace');
        if (mainWorkspace) mainWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        submitToCustoms();
    }
}

// LOAD PEB DRAFT DATA
function loadDraftData(data, shouldSave = true) {
    if (!data) return;
    window._currentSafeCheck = data.safeCheck || null;

    if (data.nomorAju) {
        const noAjuEl = document.getElementById('noAju');
        if (noAjuEl) noAjuEl.value = data.nomorAju;
        const lblNoAjuEl = document.getElementById('lblNoAju');
        if (lblNoAjuEl) lblNoAjuEl.textContent = data.nomorAju;
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('shipperName', data.shipperName);
    setVal('shipperAddress', data.shipperAddress);
    setVal('consigneeName', data.consigneeName);
    setVal('consigneeAddress', data.consigneeAddress);

    setVal('invoiceNumber', data.invoiceNumber);
    setVal('invoiceDate', data.invoiceDate);
    setVal('packingListNumber', data.packingListNumber || data.invoiceNumber);
    setVal('packingListDate', data.packingListDate || data.invoiceDate);
    setVal('blNumber', data.blNumber);
    setVal('blDate', data.blDate);

    // Resolve Document Filenames for Table 1 Links
    window._currentDocMap = window._currentDocMap || {};
    const docList = data.safeCheck?.documentList || [];

    const invDoc = docList.find(d => /invoice/i.test(d.documentType || '') || /inv/i.test(d.fileName || ''));
    const plDoc = docList.find(d => /packing/i.test(d.documentType || '') || /pl/i.test(d.fileName || ''));
    const blDoc = docList.find(d => /lading/i.test(d.documentType || '') || /bl/i.test(d.fileName || ''));

    window._currentDocMap.INVOICE = invDoc?.fileName || (data.invoiceNumber ? `INV.${data.invoiceNumber}.pdf` : 'INV.98007744.pdf');
    window._currentDocMap.PACKING_LIST = plDoc?.fileName || (data.packingListNumber ? `PL.${data.packingListNumber}.pdf` : 'PL.98007744.pdf');
    window._currentDocMap.BILL_OF_LADING = blDoc?.fileName || (data.blNumber ? `BL BAPSIN0153818 PT VALEO AC-RBB47.pdf` : 'BL BAPSIN0153818 PT VALEO AC-RBB47.pdf');

    const tagInv = document.getElementById('tagFileInvoice');
    if (tagInv) tagInv.textContent = window._currentDocMap.INVOICE;
    const tagPl = document.getElementById('tagFilePackingList');
    if (tagPl) tagPl.textContent = window._currentDocMap.PACKING_LIST;
    const tagBl = document.getElementById('tagFileBL');
    if (tagBl) tagBl.textContent = window._currentDocMap.BILL_OF_LADING;

    setVal('loadingPort', data.loadingPort);
    setVal('dischargePort', data.dischargePort);
    setVal('namaPengangkut', data.namaPengangkut || 'WAN HAI 215');
    setVal('voyageNumber', data.voyageNumber || 'VOY 091S');
    setVal('benderaPengangkut', data.benderaPengangkut || 'PA - PANAMA');
    setVal('tglPerkiraanEkspor', data.tglPerkiraanEkspor || data.blDate || '12/09/2026');

    setVal('containerNumber', data.containerNumber);
    setVal('segelKontainer', data.segelKontainer || (data.containerNumber && data.containerNumber.includes('/') ? data.containerNumber.split('/')[1].trim() : 'WHLW 184912'));
    setVal('totalKemasan', data.totalKemasan);
    setVal('merekKemasan', data.merekKemasan || 'AC DELCO / VALEO');

    setVal('valutaHeader', data.valutaHeader || 'USD - US DOLLAR');
    setVal('kursPabean', data.kursPabean || '15,850.00');
    setVal('incotermsTransaksi', data.incotermsTransaksi || data.caraDagang || 'FOB - FREE ON BOARD');
    setVal('nilaiEksporHeader', data.nilaiEksporHeader || '13,264.00');
    setVal('freightHeader', data.freightHeader || '0.00');
    setVal('asuransiHeader', data.asuransiHeader || '0.00');
    setVal('caraBayarTransaksi', data.caraBayarTransaksi || data.caraBayar || '2 - PEMBAYARAN KEMUDIAN');
    setVal('bankDhe', data.bankDhe || 'BANK MANDIRI (PERSERO) TBK');

    setVal('pernyataanTempat', data.pernyataanTempat || 'BATAM');
    setVal('pernyataanTanggal', data.pernyataanTanggal || (data.blDate || '14/09/2026'));
    setVal('pernyataanNama', data.pernyataanNama || 'JEAN-LUC DUPONT');
    setVal('pernyataanJabatan', data.pernyataanJabatan || 'DIREKTUR EKSEKUTIF');
    setVal('pernyataanNik', data.pernyataanNik || '2171012903780004');

    // ATURAN BERAT & KEMASAN KHUSUS SINAR ASIA PACK
    const isSinarAsia = Boolean(
        (data.shipperName && /sinar\s*asia/i.test(data.shipperName)) ||
        (data.safeCheck?.matchedIdentifiers && data.safeCheck.matchedIdentifiers.some(m => /sinar\s*asia/i.test(m))) ||
        (data.safeCheck?.summary && /sinar\s*asia/i.test(data.safeCheck.summary))
    );
    if (isSinarAsia && Array.isArray(data.items) && data.items.length > 0) {
        const hasMissing = data.items.some(i => !i.beratBersih || !i.beratKotor || i.beratBersih === 'null' || i.beratKotor === 'null');
        if (hasMissing) {
            const rawTotal = data.totalGrossWeightKGM || data.totalNetWeightKGM || '';
            const match = String(rawTotal).replace(/,/g, '').match(/([\d.]+)\s*([A-Za-z]+)?/);
            if (match) {
                const totalVal = parseFloat(match[1]);
                const unit = match[2] || 'KGS';
                if (!isNaN(totalVal) && totalVal > 0) {
                    const divided = (totalVal / data.items.length).toFixed(2);
                    const allocated = `${divided} ${unit}`;
                    data.items.forEach(i => {
                        if (!i.beratBersih || i.beratBersih === 'null') i.beratBersih = allocated;
                        if (!i.beratKotor || i.beratKotor === 'null') i.beratKotor = allocated;
                    });
                    if (!data.totalNetWeightKGM && data.totalGrossWeightKGM) {
                        data.totalNetWeightKGM = data.totalGrossWeightKGM;
                    }
                }
            }
        }

        // KEMASAN SINAR ASIA: TOTAL PALET SAMA SEMUA PER BARIS
        let sinarAsiaKemasan = '';
        const totalStr = String(data.totalKemasan || '').trim();
        const mPallet = totalStr.match(/(\d+[\d.,]*)\s*(PALLET|PALLETS|PLT|PL)/i);
        if (mPallet) {
            sinarAsiaKemasan = `${mPallet[1]} PL`;
        } else {
            let sumP = 0;
            for (const it of data.items) {
                const m = String(it.kemasan || it.kemasanJumlah || '').match(/(\d+[\d.,]*)/);
                if (m) sumP += parseFloat(m[1].replace(/,/g, ''));
            }
            if (sumP > 0) {
                sinarAsiaKemasan = `${sumP} PL`;
            } else {
                const mNum = totalStr.match(/(\d+[\d.,]*)/);
                sinarAsiaKemasan = mNum ? `${mNum[1]} PL` : (totalStr ? `${totalStr} PL` : '22 PL');
            }
        }

        if (sinarAsiaKemasan) {
            data.items.forEach(it => {
                it.kemasan = sinarAsiaKemasan;
                it.kemasanJumlah = sinarAsiaKemasan.split(' ')[0];
                it.kemasanJenis = 'PL';
            });
            if (!data.totalKemasan || !/pallet|plt|pl/i.test(data.totalKemasan)) {
                data.totalKemasan = `${sinarAsiaKemasan.split(' ')[0]} PALLETS`;
            }
        }
    }

    // ATURAN KEMASAN KHUSUS VALEO (PT. VALEO AC INDONESIA)
    const isValeo = Boolean(
        (data.shipperName && /valeo/i.test(data.shipperName)) ||
        (data.safeCheck?.matchedIdentifiers && data.safeCheck.matchedIdentifiers.some(m => /valeo/i.test(m)))
    );

    if (isValeo && Array.isArray(data.items) && data.items.length > 0) {
        let valeoKemasan = '';
        for (const it of data.items) {
            if (it.kemasan && /\d+/.test(it.kemasan)) {
                valeoKemasan = it.kemasan;
                break;
            }
        }
        if (!valeoKemasan && data.totalKemasan) {
            const totalStr = String(data.totalKemasan).trim();
            const boxMatch = totalStr.match(/([\d.,]+)\s*(BOX|BOXES|BX|CTN|CARTON|CARTONS)/i);
            if (boxMatch) {
                valeoKemasan = `${boxMatch[1]} BX`;
            } else {
                const numMatch = totalStr.match(/([\d.,]+)/);
                valeoKemasan = numMatch ? `${numMatch[1]} BX` : totalStr;
            }
        }
        if (valeoKemasan) {
            data.items.forEach(it => {
                it.kemasan = valeoKemasan;
            });
        }
    } else if (!isSinarAsia && Array.isArray(data.items) && data.items.length > 0) {
        // Auto-alokasi kemasan Non-Valeo jika belum terisi
        const missingKemasan = data.items.some(i => !i.kemasan && !i.kemasanJumlah);
        if (missingKemasan) {
            const totalKemasanStr = String(data.totalKemasan || '').trim();
            const countMatch = totalKemasanStr.match(/(\d+[\d.,]*)\s*([A-Za-z]+)?/);
            let totalCount = countMatch ? parseFloat(countMatch[1].replace(/,/g, '')) : 0;
            let packType = 'BX';
            if (/pallet|plt/i.test(totalKemasanStr)) packType = 'PL';
            else if (/box|boxes|bx/i.test(totalKemasanStr)) packType = 'BX';
            else if (/package|pkg|pk/i.test(totalKemasanStr)) packType = 'PK';
            else if (/carton|ctn|ct/i.test(totalKemasanStr)) packType = 'CT';
            else if (/drum/i.test(totalKemasanStr)) packType = '1A';
            else if (countMatch && countMatch[2]) packType = normalizePack(countMatch[2]);

            if (data.items.length === 1 && totalCount > 0) {
                data.items[0].kemasan = `${totalCount} ${packType}`;
            } else if (totalCount > 0 && totalCount >= data.items.length) {
                let sumQty = 0;
                data.items.forEach(it => {
                    const q = parseFloat(String(it.jumlahDanSatuanBarang || it.jumlahBarang || '').replace(/[^0-9.]/g, '')) || 0;
                    sumQty += q;
                });
                let remaining = totalCount;
                data.items.forEach((it, idx) => {
                    if (it.kemasan || it.kemasanJumlah) return;
                    if (idx === data.items.length - 1) {
                        it.kemasan = `${Math.max(1, Math.round(remaining))} ${packType}`;
                    } else {
                        const q = parseFloat(String(it.jumlahDanSatuanBarang || it.jumlahBarang || '').replace(/[^0-9.]/g, '')) || 0;
                        const alloc = sumQty > 0 ? Math.round((q / sumQty) * totalCount) : Math.floor(totalCount / data.items.length);
                        const finalAlloc = Math.max(1, alloc);
                        it.kemasan = `${finalAlloc} ${packType}`;
                        remaining -= finalAlloc;
                    }
                });
            } else {
                data.items.forEach(it => {
                    if (!it.kemasan && !it.kemasanJumlah) {
                        it.kemasan = `1 ${packType}`;
                    }
                });
            }
        }
    }

    setVal('totalNetWeightKGM', data.totalNetWeightKGM || data.totalGrossWeightKGM);
    setVal('totalGrossWeightKGM', data.totalGrossWeightKGM || data.totalNetWeightKGM);

    calculateTare();
    renderItemsTable(data.items || []);
    renderSafeCheck(data.safeCheck);

    if (shouldSave) {
        saveCurrentDraftState();
    }
}

// RENDER ITEMS TABLE
function renderItemsTable(items) {
    const tbody = document.getElementById('itemsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">Belum ada rincian barang.</td></tr>`;
        updateLiveKPIs();
        return;
    }

    items.forEach((item, idx) => {
        appendItemRow(item, idx + 1);
    });

    setTimeout(() => {
        document.querySelectorAll('.table-input-text').forEach(el => autoGrow(el));
    }, 60);

    updateLiveKPIs();
}

// NORMALISASI SATUAN (CEISA 4.0 CODES)
function parseQtyAndUnit(rawQty, explicitUnit) {
    if (explicitUnit) {
        return { qty: String(rawQty || '').replace(/[^\d.,]/g, '').trim(), unit: normalizeUnit(explicitUnit) };
    }
    if (!rawQty) return { qty: '', unit: 'PCE' };
    const s = String(rawQty).trim();
    const match = s.match(/^([\d.,]+)\s*(.*)$/);
    if (match) {
        const qty = match[1].trim();
        const unitStr = match[2].trim();
        return { qty, unit: normalizeUnit(unitStr) };
    }
    return { qty: s, unit: 'PCE' };
}

function normalizeUnit(unitStr) {
    if (!unitStr) return 'PCE';
    const u = String(unitStr).trim().toUpperCase();
    if (u === 'PCE' || u === 'PC' || u === 'PCS' || u.includes('PIECE')) return 'PCE';
    if (u === '--' || u === '------' || u === '-- -- --') return '--';
    if (u === '05' || u.includes('LIFT')) return '05';
    if (u === '06' || u.includes('SMALL SPRAY') || u.includes('SMALLSPRAY')) return '06';
    if (u === '08' || u.includes('HEAT LOT') || u.includes('HEATLOT')) return '08';
    if (u === '10' || u.includes('GROUP')) return '10';
    if (u === '11' || u.includes('OUTFIT')) return '11';
    if (u === '123' || u === '124' || u.includes('124')) return '123';
    if (u === '13' || u.includes('RATION')) return '13';
    if (u === 'KGM' || u === 'KG' || u === 'KGS' || u.includes('KILOGRAM')) return 'KGM';
    if (u === 'SET' || u === 'SETS') return 'SET';
    if (u === 'ROL' || u === 'ROLL' || u === 'ROLLS') return 'ROL';
    if (u === 'DZN' || u === 'DOZEN' || u === 'DOZ') return 'DZN';
    if (u === 'UNT' || u === 'UNIT' || u === 'UNITS') return 'UNT';
    if (u === 'BOX' || u === 'BOXES' || u === 'BX') return 'BOX';
    if (u === 'MTR' || u === 'METER' || u === 'METERS') return 'MTR';
    if (u === 'LTR' || u === 'LITER' || u === 'LITERS') return 'LTR';
    if (u === 'LBR' || u === 'LEMBAR' || u === 'SHEET') return 'LBR';
    if (u === 'PRS' || u === 'PAIR' || u === 'PAIRS') return 'PRS';
    if (u === 'BAG' || u === 'BAGS') return 'BAG';
    return 'PCE';
}

// NORMALISASI KEMASAN (CEISA 4.0 CODES)
function parsePackaging(item) {
    if (item.kemasanJumlah !== undefined && item.kemasanJenis !== undefined && item.kemasanJumlah !== null && item.kemasanJumlah !== '') {
        return { count: item.kemasanJumlah, type: normalizePack(item.kemasanJenis) };
    }
    if (item.kemasan) {
        const match = String(item.kemasan).trim().match(/^([\d.,]+)\s*(.*)$/);
        if (match) {
            return { count: match[1].trim(), type: normalizePack(match[2].trim()) };
        }
        return { count: item.kemasan, type: 'BX' };
    }
    return { count: '1', type: 'BX' };
}

function normalizePack(packStr) {
    if (!packStr) return 'BX';
    const p = String(packStr).trim().toUpperCase();
    if (p === 'NE' || p.includes('UNPACKED') || p.includes('UNPACKAGED')) return 'NE';
    if (p === '1A' || p.includes('DRUM, STEEL') || p.includes('DRUM STEEL')) return '1A';
    if (p === '1B' || p.includes('DRUM, ALUMINIUM') || p.includes('DRUM ALUMINIUM')) return '1B';
    if (p === '1D' || p.includes('DRUM, PLYWOOD') || p.includes('DRUM PLYWOOD')) return '1D';
    if (p === '1F' || p.includes('CONTAINER, FLEXIBLE') || p.includes('CONTAINER FLEXIBLE')) return '1F';
    if (p === '1G' || p.includes('DRUM, FIBRE') || p.includes('DRUM FIBRE')) return '1G';
    if (p === '1W' || p.includes('DRUM, WOODEN') || p.includes('DRUM WOODEN')) return '1W';
    if (p === '2C' || p.includes('BARREL, WOODEN') || p.includes('BARREL WOODEN')) return '2C';
    if (p === '3A' || p.includes('JERRICAN, STEEL') || p.includes('JERRICAN STEEL')) return '3A';
    if (p === 'BX' || p === 'BOX' || p === 'BOXES') return 'BX';
    if (p === 'CT' || p === 'CTN' || p === 'CARTON' || p === 'CARTONS') return 'CT';
    if (p === 'PK' || p === 'PKG' || p === 'PACKAGE' || p === 'PACKAGES') return 'PK';
    if (p === 'PL' || p === 'PLT' || p === 'PALLET' || p === 'PALLETS') return 'PL';
    if (p === 'BG' || p === 'BAG' || p === 'BAGS') return 'BG';
    if (p === 'DR' || p === 'DRUM' || p === 'DRUMS') return 'DR';
    if (p === 'CS' || p === 'CASE' || p === 'CASES') return 'CS';
    if (p === 'CR' || p === 'CRATE' || p === 'CRATES') return 'CR';
    if (p === 'SK' || p === 'SACK' || p === 'SACKS') return 'SK';
    if (p === 'RL' || p === 'REEL' || p === 'REELS') return 'RL';
    return 'BX';
}

// APPEND ITEM ROW (Pure HTML with NO inline handlers for CSP compliance)
function appendItemRow(item = {}, rowNum = null) {
    const tbody = document.getElementById('itemsTableBody');
    if (!tbody) return;
    const index = rowNum || (tbody.querySelectorAll('tr').length + 1);

    const qtyInfo = parseQtyAndUnit(item.jumlahDanSatuanBarang || item.jumlahBarang, item.satuanBarang);
    const packInfo = parsePackaging(item);

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="text-align: center; font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--text-muted); vertical-align: top; padding-top: 10px;" class="row-num-cell">${index}</td>
        <td style="vertical-align: top;">
            <textarea class="table-input-text item-desc" rows="2" placeholder="Uraian jenis barang...">${escapeHtml(item.uraianJenisBarang || '')}</textarea>
        </td>
        <td style="vertical-align: top;">
            <div class="table-input-composite">
                <input type="text" class="table-input-mono item-qty-val" value="${escapeHtml(qtyInfo.qty)}" placeholder="0">
                <select class="table-select-unit item-qty-unit">
                    <optgroup label="CEISA 4.0 Satuan">
                        <option value="PCE"${qtyInfo.unit === 'PCE' ? ' selected' : ''}>PCE - PIECE</option>
                        <option value="--"${qtyInfo.unit === '--' ? ' selected' : ''}>-- -- --</option>
                        <option value="05"${qtyInfo.unit === '05' ? ' selected' : ''}>05 - LIFT</option>
                        <option value="06"${qtyInfo.unit === '06' ? ' selected' : ''}>06 - SMALL SPRAY</option>
                        <option value="08"${qtyInfo.unit === '08' ? ' selected' : ''}>08 - HEAT LOT</option>
                        <option value="10"${qtyInfo.unit === '10' ? ' selected' : ''}>10 - GROUP</option>
                        <option value="11"${qtyInfo.unit === '11' ? ' selected' : ''}>11 - OUTFIT</option>
                        <option value="123"${qtyInfo.unit === '123' ? ' selected' : ''}>123 - 124</option>
                        <option value="13"${qtyInfo.unit === '13' ? ' selected' : ''}>13 - RATION</option>
                    </optgroup>
                    <optgroup label="Standar Umum Lainnya">
                        <option value="KGM"${qtyInfo.unit === 'KGM' ? ' selected' : ''}>KGM - KILOGRAM</option>
                        <option value="SET"${qtyInfo.unit === 'SET' ? ' selected' : ''}>SET - SET</option>
                        <option value="ROL"${qtyInfo.unit === 'ROL' ? ' selected' : ''}>ROL - ROLL</option>
                        <option value="DZN"${qtyInfo.unit === 'DZN' ? ' selected' : ''}>DZN - DOZEN</option>
                        <option value="UNT"${qtyInfo.unit === 'UNT' ? ' selected' : ''}>UNT - UNIT</option>
                        <option value="BOX"${qtyInfo.unit === 'BOX' ? ' selected' : ''}>BOX - BOX</option>
                        <option value="MTR"${qtyInfo.unit === 'MTR' ? ' selected' : ''}>MTR - METER</option>
                        <option value="LTR"${qtyInfo.unit === 'LTR' ? ' selected' : ''}>LTR - LITER</option>
                        <option value="LBR"${qtyInfo.unit === 'LBR' ? ' selected' : ''}>LBR - LEMBAR</option>
                        <option value="PRS"${qtyInfo.unit === 'PRS' ? ' selected' : ''}>PRS - PAIRS</option>
                        <option value="BAG"${qtyInfo.unit === 'BAG' ? ' selected' : ''}>BAG - BAG</option>
                    </optgroup>
                </select>
            </div>
        </td>
        <td style="vertical-align: top;">
            <div class="table-input-composite">
                <input type="text" class="table-input-mono item-pack-val" value="${escapeHtml(packInfo.count)}" placeholder="0">
                <select class="table-select-unit item-pack-type">
                    <optgroup label="CEISA 4.0 Kemasan">
                        <option value="NE"${packInfo.type === 'NE' ? ' selected' : ''}>NE - UNPACKED OR UNPACKAGED</option>
                        <option value="1A"${packInfo.type === '1A' ? ' selected' : ''}>1A - DRUM, STEEL</option>
                        <option value="1B"${packInfo.type === '1B' ? ' selected' : ''}>1B - DRUM, ALUMINIUM</option>
                        <option value="1D"${packInfo.type === '1D' ? ' selected' : ''}>1D - DRUM, PLYWOOD</option>
                        <option value="1F"${packInfo.type === '1F' ? ' selected' : ''}>1F - CONTAINER, FLEXIBLE</option>
                        <option value="1G"${packInfo.type === '1G' ? ' selected' : ''}>1G - DRUM, FIBRE</option>
                        <option value="1W"${packInfo.type === '1W' ? ' selected' : ''}>1W - DRUM, WOODEN</option>
                        <option value="2C"${packInfo.type === '2C' ? ' selected' : ''}>2C - BARREL, WOODEN</option>
                        <option value="3A"${packInfo.type === '3A' ? ' selected' : ''}>3A - JERRICAN, STEEL</option>
                    </optgroup>
                    <optgroup label="Standar Umum Lainnya">
                        <option value="BX"${packInfo.type === 'BX' ? ' selected' : ''}>BX - BOX</option>
                        <option value="CT"${packInfo.type === 'CT' ? ' selected' : ''}>CT - CARTON</option>
                        <option value="PK"${packInfo.type === 'PK' ? ' selected' : ''}>PK - PACKAGE</option>
                        <option value="PL"${packInfo.type === 'PL' ? ' selected' : ''}>PL - PALLET</option>
                        <option value="BG"${packInfo.type === 'BG' ? ' selected' : ''}>BG - BAG</option>
                        <option value="DR"${packInfo.type === 'DR' ? ' selected' : ''}>DR - DRUM</option>
                        <option value="CS"${packInfo.type === 'CS' ? ' selected' : ''}>CS - CASE</option>
                        <option value="CR"${packInfo.type === 'CR' ? ' selected' : ''}>CR - CRATE</option>
                        <option value="SK"${packInfo.type === 'SK' ? ' selected' : ''}>SK - SACK</option>
                        <option value="RL"${packInfo.type === 'RL' ? ' selected' : ''}>RL - REEL</option>
                    </optgroup>
                </select>
            </div>
        </td>
        <td style="vertical-align: top;">
            <input type="text" class="table-input-mono item-net" value="${escapeHtml(item.beratBersih || '')}" placeholder="0.00">
        </td>
        <td style="vertical-align: top;">
            <input type="text" class="table-input-mono item-gross" value="${escapeHtml(item.beratKotor || '')}" placeholder="0.00">
        </td>
        <td style="vertical-align: top;">
            <input type="text" class="table-input-mono item-amt" value="${escapeHtml(item.amount || '')}" placeholder="0.00" style="font-weight: 700; color: var(--ceisa-blue);">
        </td>
        <td style="text-align: center; vertical-align: top; padding-top: 8px;">
            <button type="button" class="btn-table-del" title="Hapus Baris Barang">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    autoGrow(tr.querySelector('.item-desc'));
}

function addNewItemRow() {
    const tbody = document.getElementById('itemsTableBody');
    if (!tbody) return;
    if (tbody.querySelector('td[colspan="8"]')) tbody.innerHTML = '';
    appendItemRow({ uraianJenisBarang: '', jumlahDanSatuanBarang: '', kemasan: '', beratBersih: '', beratKotor: '', amount: '' });
    updateLiveKPIs();
    triggerAutoSave();
    showToast("Baris barang baru ditambahkan.", "info");
}

function removeRow(element) {
    const row = element.closest('tr');
    if (row) {
        row.remove();
        reindexRows();
        updateLiveKPIs();
        triggerAutoSave();
    }
}

function reindexRows() {
    const tbody = document.getElementById('itemsTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach((r, idx) => {
        const cell = r.querySelector('.row-num-cell');
        if (cell) cell.textContent = idx + 1;
    });
}

function autoGrow(element) {
    if (!element) return;
    element.style.height = 'auto';
    const computedHeight = Math.max(48, element.scrollHeight);
    element.style.height = computedHeight + 'px';
}

// VALEO & SINAR ASIA PACK AUTO-SYNC HANDLERS
function handleItemPackChange(inputEl) {
    updateLiveKPIs();
    const shipper = document.getElementById('shipperName')?.value || '';
    if (/valeo|sinar\s*asia/i.test(shipper)) {
        const val = inputEl.value;
        document.querySelectorAll('.item-pack-val').forEach(el => {
            if (el !== inputEl) el.value = val;
        });
        updateLiveKPIs();
    }
}

function handleItemPackTypeChange(selectEl) {
    updateLiveKPIs();
    const shipper = document.getElementById('shipperName')?.value || '';
    if (/valeo|sinar\s*asia/i.test(shipper)) {
        const type = selectEl.value;
        document.querySelectorAll('.item-pack-type').forEach(el => {
            if (el !== selectEl) el.value = type;
        });
        updateLiveKPIs();
    }
}

// TARE & LIVE SUMMARY CALCULATIONS
function calculateTare() {
    const netEl = document.getElementById('totalNetWeightKGM');
    const grossEl = document.getElementById('totalGrossWeightKGM');
    const tareInput = document.getElementById('tareCalcInput');
    if (!netEl || !grossEl || !tareInput) return;

    const net = parseNum(netEl.value);
    const gross = parseNum(grossEl.value);

    if (gross > 0 && net > 0) {
        const tare = Math.max(0, gross - net);
        tareInput.value = tare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' KG';
    }
}

function updateLiveKPIs() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    let count = 0;
    let totalQty = 0;
    let totalPack = 0;
    let totalNet = 0;
    let totalGross = 0;
    let totalAmt = 0;
    let currency = 'USD';
    let mainUnit = 'PCE';
    let mainPackUnit = 'BX';
    const packValues = [];

    rows.forEach(r => {
        if (r.querySelector('td[colspan="8"]')) return;
        count++;
        const q = parseNum(r.querySelector('.item-qty-val')?.value);
        const u = r.querySelector('.item-qty-unit')?.value;
        if (u && u !== '--') mainUnit = u;
        const p = parseNum(r.querySelector('.item-pack-val')?.value);
        const pu = r.querySelector('.item-pack-type')?.value;
        if (pu) mainPackUnit = pu;
        packValues.push(p);

        const n = parseNum(r.querySelector('.item-net')?.value);
        const g = parseNum(r.querySelector('.item-gross')?.value);
        const a = parseNum(r.querySelector('.item-amt')?.value);

        totalQty += q;
        totalPack += p;
        totalNet += n;
        totalGross += g;
        totalAmt += a;
    });

    const kpiLines = document.getElementById('kpiTotalLines');
    if (kpiLines) kpiLines.textContent = `${count} Item`;

    const badgeCount = document.getElementById('badgeItemCount');
    if (badgeCount) badgeCount.textContent = count;

    const kpiQty = document.getElementById('kpiTotalQty');
    if (kpiQty) kpiQty.textContent = totalQty > 0 ? `${totalQty.toLocaleString('en-US')} ${mainUnit}` : '-';

    // Cek apakah shipper adalah Valeo atau Sinar Asia, atau jika semua baris kemasannya sama
    const shipper = document.getElementById('shipperName')?.value || '';
    const isSharedPack = /valeo|sinar\s*asia/i.test(shipper) || (packValues.length > 0 && packValues.every(v => v === packValues[0]));
    if (isSharedPack && packValues.length > 0) {
        totalPack = packValues[0];
    }

    const packLabel = document.getElementById('kpiTotalPack');
    if (packLabel) {
        packLabel.textContent = totalPack > 0 ? `${totalPack.toLocaleString('en-US')} ${mainPackUnit}` : '-';
    }

    const kpiNet = document.getElementById('kpiTotalNet');
    if (kpiNet) kpiNet.textContent = totalNet > 0 ? `${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })} Kg` : '-';

    const kpiGross = document.getElementById('kpiTotalGross');
    if (kpiGross) kpiGross.textContent = totalGross > 0 ? `${totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })} Kg` : '-';

    const amtFormatted = `${currency} ${totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const kpiAmt = document.getElementById('kpiTotalAmount');
    if (kpiAmt) kpiAmt.textContent = totalAmt > 0 ? amtFormatted : '-';

    const headerNilai = document.getElementById('nilaiEksporHeader');
    if (headerNilai && totalAmt > 0) {
        headerNilai.value = totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

function parseNum(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// RENDER SAFETY CHECK AUDIT CARD
function renderSafeCheck(safeCheck) {
    const container = document.getElementById('safeCheckSection');
    if (!container) return;

    if (!safeCheck) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    const isRelated = safeCheck.isRelated !== false;
    const score = safeCheck.confidenceScore !== undefined ? safeCheck.confidenceScore : 100;
    const banner = document.getElementById('safeCheckBanner');
    const statusBadge = document.getElementById('safeCheckStatusBadge');
    const scoreVal = document.getElementById('safeCheckScore');
    const title = document.getElementById('safeCheckTitle');
    const summary = document.getElementById('safeCheckSummary');
    const matchedList = document.getElementById('safeCheckMatchedList');
    const warningsBox = document.getElementById('safeCheckWarningsBox');
    const warningsList = document.getElementById('safeCheckWarningsList');
    const docTbody = document.getElementById('safeCheckDocTableBody');

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
                li.innerHTML = `<span style="color: var(--color-green-text); font-weight: 700; flex-shrink: 0;">✓</span><span>${escapeHtml(m)}</span>`;
                matchedList.appendChild(li);
            });
        } else {
            matchedList.innerHTML = `<li style="color: #64748b;">Tidak ada catatan parameter khusus.</li>`;
        }
    }

    if (warningsBox && warningsList) {
        const warnings = safeCheck.discrepanciesOrWarnings || [];
        if (warnings && warnings.length > 0) {
            warningsBox.style.display = 'block';
            warningsList.innerHTML = '';
            warnings.forEach(w => {
                const li = document.createElement('li');
                li.innerHTML = `<span style="color: var(--color-red-text); font-weight: 700; flex-shrink: 0;">⚠</span><span>${escapeHtml(w)}</span>`;
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
                        <span style="color: var(--text-primary);">${escapeHtml(fileName)}</span>
                    </td>
                    <td><span style="font-size: 12px; font-weight: 600; background: #e2e8f0; padding: 2px 6px; border-radius: 3px;">${escapeHtml(docType)}</span></td>
                    <td style="text-align: center;">
                        <span class="${isShipmentDoc ? 'badge-safe-valid' : 'badge-safe-warning'}" style="font-size: 12px; padding: 2px 6px;">
                            ${isShipmentDoc ? 'Cocok (1 Shipment)' : 'Asing / Tidak Cocok'}
                        </span>
                    </td>
                    <td style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(d.notes || '-')}</td>
                    <td style="text-align: center;">
                        <button type="button" class="btn-doc-link btn-table-doc-open" data-filename="${escapeHtml(fileName)}" data-doctype="${escapeHtml(docType)}" title="Buka berkas ${escapeHtml(fileName)} langsung di web">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <span>Buka</span>
                        </button>
                    </td>
                `;
                docTbody.appendChild(tr);
            });
        } else {
            docTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">Tidak ada perincian berkas.</td></tr>`;
        }
    }
}

// ====================================================================
// CEISA 4.0 DOCUMENT VIEWER MODAL CONTROLLER
// ====================================================================
window._docFileMap = window._docFileMap || {};
window._activeModalFileName = '';

function openCeisaDocViewer({ docType, fileName, docNumber, docDate }) {
    const modal = document.getElementById('ceisaDocViewerModal');
    if (!modal) return;

    window._activeModalFileName = fileName || 'Dokumen_Pabean.pdf';

    const titleEl = document.getElementById('modalDocTitle');
    const badgeEl = document.getElementById('modalDocTypeBadge');
    const metaEl = document.getElementById('modalDocMeta');
    const iframe = document.getElementById('docViewerIframe');
    const loading = document.getElementById('modalDocLoading');
    const fallback = document.getElementById('modalDocFallback');
    const fallbackFileName = document.getElementById('fallbackFileName');
    const btnDownload = document.getElementById('btnModalDownload');
    const btnOpenTab = document.getElementById('btnModalOpenTab');

    if (titleEl) titleEl.textContent = window._activeModalFileName;
    if (badgeEl) badgeEl.textContent = docType || 'DOKUMEN PABEAN';
    if (metaEl) metaEl.textContent = `No: ${docNumber || '-'} \u2022 Tanggal: ${docDate || '-'}`;
    if (fallbackFileName) fallbackFileName.textContent = window._activeModalFileName;

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Reset UI state
    if (loading) loading.style.display = 'flex';
    if (fallback) fallback.style.display = 'none';
    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = 'about:blank';
    }

    // 1. If user previously uploaded/attached this file in current session
    if (window._docFileMap[window._activeModalFileName]) {
        const blobUrl = window._docFileMap[window._activeModalFileName];
        if (iframe) iframe.src = blobUrl;
        if (btnDownload) {
            btnDownload.href = blobUrl;
            btnDownload.download = window._activeModalFileName;
        }
        if (btnOpenTab) btnOpenTab.href = blobUrl;
        setTimeout(() => { if (loading) loading.style.display = 'none'; }, 200);
        return;
    }

    // 2. Try loading from local Wi-Fi API server (server.js on port 8080)
    const serverUrl = `http://127.0.0.1:8080/api/documents/${encodeURIComponent(window._activeModalFileName)}`;
    const relativeUrl = `attachments/${encodeURIComponent(window._activeModalFileName)}`;

    fetch(serverUrl, { method: 'HEAD' })
        .then(res => {
            if (res.ok) {
                if (iframe) iframe.src = serverUrl;
                if (btnDownload) {
                    btnDownload.href = serverUrl;
                    btnDownload.download = window._activeModalFileName;
                }
                if (btnOpenTab) btnOpenTab.href = serverUrl;
                if (loading) loading.style.display = 'none';
            } else {
                throw new Error("Server 404");
            }
        })
        .catch(() => {
            // Test relative attachments path
            fetch(relativeUrl, { method: 'HEAD' })
                .then(r => {
                    if (r.ok) {
                        if (iframe) iframe.src = relativeUrl;
                        if (btnDownload) {
                            btnDownload.href = relativeUrl;
                            btnDownload.download = window._activeModalFileName;
                        }
                        if (btnOpenTab) btnOpenTab.href = relativeUrl;
                        if (loading) loading.style.display = 'none';
                    } else {
                        throw new Error("Relative 404");
                    }
                })
                .catch(() => {
                    // Show fallback view allowing file selection
                    if (loading) loading.style.display = 'none';
                    if (iframe) iframe.style.display = 'none';
                    if (fallback) fallback.style.display = 'flex';
                    if (btnDownload) btnDownload.href = '#';
                    if (btnOpenTab) btnOpenTab.href = '#';
                });
        });
}

function closeCeisaDocViewer() {
    const modal = document.getElementById('ceisaDocViewerModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
    const iframe = document.getElementById('docViewerIframe');
    if (iframe) iframe.src = 'about:blank';
}

function handleDocViewerFileSelect(file) {
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    const targetName = window._activeModalFileName || file.name;
    window._docFileMap[targetName] = blobUrl;
    window._docFileMap[file.name] = blobUrl;

    const iframe = document.getElementById('docViewerIframe');
    const loading = document.getElementById('modalDocLoading');
    const fallback = document.getElementById('modalDocFallback');
    const btnDownload = document.getElementById('btnModalDownload');
    const btnOpenTab = document.getElementById('btnModalOpenTab');
    const titleEl = document.getElementById('modalDocTitle');

    if (titleEl) titleEl.textContent = file.name;
    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = blobUrl;
    }
    if (loading) loading.style.display = 'none';
    if (fallback) fallback.style.display = 'none';
    if (btnDownload) {
        btnDownload.href = blobUrl;
        btnDownload.download = file.name;
    }
    if (btnOpenTab) btnOpenTab.href = blobUrl;

    showToast(`Berkas '${file.name}' berhasil dimuat ke viewer!`, "success");
}

// SUBMIT ACTION
function submitToCustoms() {
    const noAju = document.getElementById('noAju')?.value || '';
    showToast(`Mengirim No. Aju: ${noAju} ke OpenAPI CEISA 4.0 Bea Cukai...`, "info");
    setTimeout(() => {
        showToast("Berhasil terkirim ke CEISA 4.0! Menunggu respon Nomor Pendaftaran.", "success");
    }, 1200);
}

// SAMPLE DATA (VALEO DEFAULT SHIPMENT)
const SAMPLE_DATA = {
    "safeCheck": {
        "isRelated": true,
        "confidenceScore": 100,
        "summary": "Seluruh berkas (Commercial Invoice, Packing List, dan Ocean B/L) saling bersesuaian tanpa indikasi dokumen asing. No. Invoice 98007744, No. Kontainer WHSU0243603, serta Shipper PT. VALEO AC INDONESIA dan Consignee GM CCA Pontiac RDC selaras di semua dokumen.",
        "matchedIdentifiers": [
            "Nomor Invoice 98007744 cocok di Bill of Lading, Invoice, dan Packing List",
            "Nomor Kontainer WHSU0243603 dan Seal WHLW 184912 serasi di seluruh dokumen",
            "Shipper PT. VALEO AC INDONESIA dan Consignee GM CCA Pontiac RDC terkonfirmasi sama"
        ],
        "discrepanciesOrWarnings": [],
        "documentList": [
            {
                "fileName": "BL BAPSIN0153818 PT VALEO AC-RBB47.pdf",
                "documentType": "BILL_OF_LADING",
                "belongsToShipment": true,
                "notes": "Ocean B/L No. BAPSIN0153818 tanggal 11/09/2026"
            },
            {
                "fileName": "INV.98007744.pdf",
                "documentType": "INVOICE",
                "belongsToShipment": true,
                "notes": "Commercial Invoice No. 98007744 tanggal 10.09.2026"
            },
            {
                "fileName": "PL.98007744.pdf",
                "documentType": "PACKING_LIST",
                "belongsToShipment": true,
                "notes": "Packing List No. 98007744 merinci 816 Box / 7 Pallet"
            }
        ]
    },
    "nomorAju": "030000-001538-20260910-007744",
    "blNumber": "BAPSIN0153818",
    "blDate": "11/09/2026",
    "invoiceNumber": "98007744",
    "invoiceDate": "10.09.2026",
    "packingListNumber": "98007744",
    "packingListDate": "10/09/2026",
    "containerNumber": "WHSU0243603 / WHLW 184912",
    "shipperName": "PT. VALEO AC INDONESIA",
    "shipperAddress": "Panbil Industrial Estate Factory Blok D Lot.1 - 3, Jl. Ahmad Yani, Kel. Muka Kuning, Kec. Sei Beduk, Kota Batam, Provinsi Kepulauan Riau. Postal Code : 29433 - INDONESIA",
    "consigneeName": "GM CCA Pontiac RDC",
    "consigneeAddress": "Joslyn Road, 1251, 48340, Pontiac, USA",
    "loadingPort": "BATAM, BATU AMPAR",
    "dischargePort": "SINGAPORE",
    "totalKemasan": "816 BOXES (7 PALLETS)",
    "totalGrossWeightKGM": "1,450.60 KG",
    "totalNetWeightKGM": "1,345.60 KG",
    "items": [
        {
            "uraianJenisBarang": "FG AC Delco US Gold Hybrid 21\" 525mm",
            "jumlahDanSatuanBarang": "960 PCS",
            "kemasan": "816 BX",
            "beratBersih": "159.36 KG",
            "beratKotor": "174.36 KG",
            "amount": "1,929.60"
        },
        {
            "uraianJenisBarang": "FG AC Delco US Silver SVB 21\" 525mm",
            "jumlahDanSatuanBarang": "960 PCS",
            "kemasan": "816 BX",
            "beratBersih": "166.08 KG",
            "beratKotor": "181.08 KG",
            "amount": "1,545.60"
        },
        {
            "uraianJenisBarang": "FG AC Delco US Silver SVB 26\" 650mm",
            "jumlahDanSatuanBarang": "800 PCS",
            "kemasan": "816 BX",
            "beratBersih": "168.80 KG",
            "beratKotor": "183.80 KG",
            "amount": "1,520.00"
        },
        {
            "uraianJenisBarang": "FG AC Delco US Silver SVB 18\" 450mm",
            "jumlahDanSatuanBarang": "5,440 PCS",
            "kemasan": "816 BX",
            "beratBersih": "851.36 KG",
            "beratKotor": "911.36 KG",
            "amount": "8,268.80"
        }
    ]
};

// ====================================================================
// INITIALIZATION ON DOM CONTENT LOADED (CSP COMPLIANT EVENT WIRING)
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. CEISA 4.0 Left Sidebar Module Switcher Listeners
    const btnNavPeb = document.getElementById('btnNavPeb');
    const btnNavInspector = document.getElementById('btnNavInspector');
    if (btnNavPeb) btnNavPeb.addEventListener('click', () => switchPortalModule('peb'));
    if (btnNavInspector) btnNavInspector.addEventListener('click', () => switchPortalModule('inspector'));

    // 1.1 CEISA 4.0 Sidebar Toggle (Expand / Collapse >> / <<)
    const sidebarToggle = document.getElementById('ceisaSidebarToggle');
    const sidebar = document.getElementById('ceisaSidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('expanded');
            const isExpanded = sidebar.classList.contains('expanded');
            sidebarToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            try {
                localStorage.setItem('ceisa_sidebar_expanded', isExpanded ? '1' : '0');
            } catch (e) {}
        });

        // Menutup otomatis saat kursor keluar dari sidebar (mouseleave)
        sidebar.addEventListener('mouseleave', () => {
            if (sidebar.classList.contains('expanded')) {
                sidebar.classList.remove('expanded');
                sidebarToggle.setAttribute('aria-expanded', 'false');
                try {
                    localStorage.setItem('ceisa_sidebar_expanded', '0');
                } catch (e) {}
            }
        });

        try {
            if (localStorage.getItem('ceisa_sidebar_expanded') === '1') {
                sidebar.classList.add('expanded');
                sidebarToggle.setAttribute('aria-expanded', 'true');
            }
        } catch (e) {}
    }

    // 2. Defaultkan selalu ke Ceisa Inspector saat web dashboard dibuka
    try {
        const initialModule = sessionStorage.getItem('ceisa_active_portal_module') || 'inspector';
        switchPortalModule(initialModule);
    } catch (e) {
        switchPortalModule('inspector');
    }

    // 3. PEB Header Action Buttons
    const btnUpload = document.getElementById('btnHeaderUploadJson');
    const headerInput = document.getElementById('headerJsonFileInput');
    if (btnUpload && headerInput) {
        btnUpload.addEventListener('click', () => headerInput.click());
    }

    const btnSample = document.getElementById('btnHeaderSample');
    if (btnSample) {
        btnSample.addEventListener('click', () => {
            const lbl = document.getElementById('lblFileName');
            if (lbl) lbl.textContent = 'Sample_Customs_Clearance_Draft.json';
            try {
                localStorage.setItem(STORAGE_KEY_LAST_FILENAME, 'Sample_Customs_Clearance_Draft.json');
            } catch (e) {}
            loadDraftData(SAMPLE_DATA, true);
            showToast("Sampel data pengapalan berhasil dimuat!", "info");
        });
    }

    const btnPrint = document.getElementById('btnHeaderPrint');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => window.print());
    }

    if (headerInput) {
        headerInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const lbl = document.getElementById('lblFileName');
            if (lbl) lbl.textContent = file.name;
            try {
                localStorage.setItem(STORAGE_KEY_LAST_FILENAME, file.name);
            } catch (err) {}

            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    loadDraftData(parsed, true);
                    showToast(`Berkas '${file.name}' berhasil dimuat & tersimpan otomatis!`, "success");
                } catch (err) {
                    alert("Format berkas JSON tidak valid: " + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    // 4. CEISA 9-Tab Navigation Buttons
    document.querySelectorAll('#module-peb .ceisa-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId) switchCeisaTab(tabId);
        });
    });

    // 4.1 Stepper Navigation Buttons (Sebelumnya / Selanjutnya)
    const btnTabPrev = document.getElementById('btnTabPrev');
    if (btnTabPrev) {
        btnTabPrev.addEventListener('click', handleStepperPrev);
    }
    const btnTabNext = document.getElementById('btnTabNext');
    if (btnTabNext) {
        btnTabNext.addEventListener('click', handleStepperNext);
    }

    // 4.1.1 Safety Check Collapsible Accordion (Arrow Toggle)
    const btnToggleSafeCheck = document.getElementById('btnToggleSafeCheck');
    const safeCheckHeader = document.getElementById('safeCheckHeader');
    const safeCheckBody = document.getElementById('safeCheckBody');

    function toggleSafeCheck() {
        if (!safeCheckBody) return;
        const isCollapsed = safeCheckBody.classList.contains('collapsed') || safeCheckBody.style.display === 'none';
        if (isCollapsed) {
            safeCheckBody.classList.remove('collapsed');
            safeCheckBody.style.display = 'block';
            if (btnToggleSafeCheck) {
                btnToggleSafeCheck.classList.add('expanded');
                btnToggleSafeCheck.setAttribute('aria-expanded', 'true');
            }
            if (safeCheckHeader) safeCheckHeader.classList.add('expanded');
        } else {
            safeCheckBody.classList.add('collapsed');
            safeCheckBody.style.display = 'none';
            if (btnToggleSafeCheck) {
                btnToggleSafeCheck.classList.remove('expanded');
                btnToggleSafeCheck.setAttribute('aria-expanded', 'false');
            }
            if (safeCheckHeader) safeCheckHeader.classList.remove('expanded');
        }
    }

    if (btnToggleSafeCheck) {
        btnToggleSafeCheck.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSafeCheck();
        });
    }
    if (safeCheckHeader) {
        safeCheckHeader.addEventListener('click', () => {
            toggleSafeCheck();
        });
    }

    // 4.2 CEISA Sub-Bar Buttons
    const btnCeisaKembali = document.getElementById('btnCeisaKembali');
    if (btnCeisaKembali) {
        btnCeisaKembali.addEventListener('click', () => switchPortalModule('inspector'));
    }
    const btnCeisaUpdateData = document.getElementById('btnCeisaUpdateData');
    if (btnCeisaUpdateData) {
        btnCeisaUpdateData.addEventListener('click', () => {
            saveCurrentDraftState();
            updateLiveKPIs();
            showToast("Data pabean berhasil diperbarui & tersimpan!", "success");
        });
    }
    const btnCeisaMenu = document.getElementById('btnCeisaMenu');
    if (btnCeisaMenu) {
        btnCeisaMenu.addEventListener('click', () => {
            if (confirm("Pilih opsi formulir pabean:\n\n[OK] Ekspor Berkas JSON Draft\n[Batal] Batal")) {
                exportJsonDraft();
            }
        });
    }

    // 4.3 CEISA Action Buttons (Detail Barang, Sync Netto, Salin Entitas)
    const btnDetailBarang = document.getElementById('btnDetailBarang');
    if (btnDetailBarang) {
        btnDetailBarang.addEventListener('click', () => switchCeisaTab('tab-barang'));
    }

    const btnSyncNetto = document.getElementById('btnSyncNetto');
    if (btnSyncNetto) {
        btnSyncNetto.addEventListener('click', () => {
            const kpiNet = document.getElementById('kpiTotalNet');
            const netWeightInput = document.getElementById('totalNetWeightKGM');
            if (kpiNet && netWeightInput) {
                const val = kpiNet.textContent.replace(/[^\d.]/g, '');
                if (val) {
                    netWeightInput.value = parseFloat(val).toFixed(4);
                    calculateTare();
                    showToast("Netto berhasil disinkronkan dengan total rincian barang!", "success");
                }
            }
        });
    }

    const btnSalinPenerima = document.getElementById('btnSalinPenerima');
    if (btnSalinPenerima) {
        btnSalinPenerima.addEventListener('click', () => {
            const cName = document.getElementById('consigneeName')?.value || '';
            const cAddr = document.getElementById('consigneeAddress')?.value || '';
            const buyerName = document.getElementById('buyerName');
            if (buyerName) buyerName.value = cName;
            const buyerAddr = document.querySelector('#tab-entitas .form-grid-2 > div:nth-child(3) textarea');
            if (buyerAddr) buyerAddr.value = cAddr;
            showToast("Data penerima berhasil disalin ke pembeli!", "success");
        });
    }

    const btnHapusPembeli = document.getElementById('btnHapusPembeli');
    if (btnHapusPembeli) {
        btnHapusPembeli.addEventListener('click', () => {
            const buyerName = document.getElementById('buyerName');
            if (buyerName) buyerName.value = '-';
            const buyerAddr = document.querySelector('#tab-entitas .form-grid-2 > div:nth-child(3) textarea');
            if (buyerAddr) buyerAddr.value = '-';
            showToast("Data pembeli dikosongkan.", "info");
        });
    }

    const btnSalinPengirim = document.getElementById('btnSalinPengirim');
    if (btnSalinPengirim) {
        btnSalinPengirim.addEventListener('click', () => {
            const sName = document.getElementById('shipperName')?.value || '';
            const sAddr = document.getElementById('shipperAddress')?.value || '';
            const sellerName = document.querySelector('#tab-entitas .form-grid-2 > div:nth-child(4) input[type="text"]:not(.form-control-mono)');
            if (sellerName) sellerName.value = sName;
            const sellerAddr = document.querySelector('#tab-entitas .form-grid-2 > div:nth-child(4) textarea');
            if (sellerAddr) sellerAddr.value = sAddr;
            showToast("Data pengirim berhasil disalin ke penjual!", "success");
        });
    }

    const btnSalinPemilik = document.getElementById('btnSalinPemilik');
    if (btnSalinPemilik) {
        btnSalinPemilik.addEventListener('click', () => {
            const cName = document.getElementById('consigneeName')?.value || '';
            const cAddr = document.getElementById('consigneeAddress')?.value || '';
            const ownerName = document.querySelector('#tab-entitas .form-grid-2 > div:nth-child(5) input[type="text"]:not(.form-control-mono)');
            if (ownerName) ownerName.value = cName;
            const ownerAddr = document.querySelector('#tab-entitas .form-grid-2 > div:nth-child(5) textarea');
            if (ownerAddr) ownerAddr.value = cAddr;
            showToast("Data penerima berhasil disalin ke pemilik barang!", "success");
        });
    }

    // 5. Tare Calculation Inputs
    const netWeightInput = document.getElementById('totalNetWeightKGM');
    const grossWeightInput = document.getElementById('totalGrossWeightKGM');
    if (netWeightInput) netWeightInput.addEventListener('input', calculateTare);
    if (grossWeightInput) grossWeightInput.addEventListener('input', calculateTare);

    // 6. Add Item Button
    const btnAddItem = document.getElementById('btnAddNewItem');
    if (btnAddItem) {
        btnAddItem.addEventListener('click', addNewItemRow);
    }

    // 7. Dynamic Table Rows Delegated Listeners (CSP Compliant)
    const itemsTableBody = document.getElementById('itemsTableBody');
    if (itemsTableBody) {
        itemsTableBody.addEventListener('input', (e) => {
            if (e.target.classList.contains('item-pack-val')) {
                handleItemPackChange(e.target);
            } else if (e.target.classList.contains('item-qty-val') ||
                       e.target.classList.contains('item-net') ||
                       e.target.classList.contains('item-gross') ||
                       e.target.classList.contains('item-amt')) {
                updateLiveKPIs();
            } else if (e.target.classList.contains('item-desc')) {
                autoGrow(e.target);
            }
        });

        itemsTableBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('item-pack-type')) {
                handleItemPackTypeChange(e.target);
            } else if (e.target.classList.contains('item-qty-unit')) {
                updateLiveKPIs();
            }
        });

        itemsTableBody.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.btn-table-del');
            if (delBtn) {
                removeRow(delBtn);
            }
        });
    }

    // 8. Bottom Action Dock Buttons
    const btnResetDraft = document.getElementById('btnResetDraft');
    if (btnResetDraft) btnResetDraft.addEventListener('click', resetDraftForm);

    const btnExportJson = document.getElementById('btnExportJson');
    if (btnExportJson) btnExportJson.addEventListener('click', exportJsonDraft);

    const btnSubmitCustoms = document.getElementById('btnSubmitCustoms');
    if (btnSubmitCustoms) btnSubmitCustoms.addEventListener('click', submitToCustoms);

    // 9. Auto-save triggers on any input or change inside PEB form
    const modulePeb = document.getElementById('module-peb');
    if (modulePeb) {
        modulePeb.addEventListener('input', () => triggerAutoSave());
        modulePeb.addEventListener('change', () => triggerAutoSave());
    }

    // 10. CEISA Document Viewer Trigger Buttons (Table 1 & Table 2)
    const btnOpenInv = document.getElementById('btnOpenDocInvoice');
    if (btnOpenInv) {
        btnOpenInv.addEventListener('click', () => {
            openCeisaDocViewer({
                docType: '380 - INVOICE (KOMERSIAL)',
                fileName: window._currentDocMap?.INVOICE || 'INV.98007744.pdf',
                docNumber: document.getElementById('invoiceNumber')?.value || '98007744',
                docDate: document.getElementById('invoiceDate')?.value || '10.09.2026'
            });
        });
    }

    const btnOpenPl = document.getElementById('btnOpenDocPackingList');
    if (btnOpenPl) {
        btnOpenPl.addEventListener('click', () => {
            openCeisaDocViewer({
                docType: '217 - PACKING LIST (DAFTAR KEMASAN)',
                fileName: window._currentDocMap?.PACKING_LIST || 'PL.98007744.pdf',
                docNumber: document.getElementById('packingListNumber')?.value || '98007744',
                docDate: document.getElementById('packingListDate')?.value || '10.09.2026'
            });
        });
    }

    const btnOpenBl = document.getElementById('btnOpenDocBL');
    if (btnOpenBl) {
        btnOpenBl.addEventListener('click', () => {
            openCeisaDocViewer({
                docType: '705 - BILL OF LADING (OCEAN B/L)',
                fileName: window._currentDocMap?.BILL_OF_LADING || 'BL BAPSIN0153818 PT VALEO AC-RBB47.pdf',
                docNumber: document.getElementById('blNumber')?.value || 'BAPSIN0153818',
                docDate: document.getElementById('blDate')?.value || '11/09/2026'
            });
        });
    }

    // Delegated click for SafeCheck Document Table rows
    const safeCheckTable = document.getElementById('safeCheckDocTableBody');
    if (safeCheckTable) {
        safeCheckTable.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-table-doc-open');
            if (btn) {
                const fileName = btn.getAttribute('data-filename') || 'Dokumen_Pabean.pdf';
                const docType = btn.getAttribute('data-doctype') || 'DOKUMEN PABEAN';
                openCeisaDocViewer({
                    docType: docType,
                    fileName: fileName,
                    docNumber: '',
                    docDate: ''
                });
            }
        });
    }

    // Modal Action Controls
    const btnCloseModal = document.getElementById('btnModalCloseDoc');
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', closeCeisaDocViewer);
    }

    const modalOverlay = document.getElementById('ceisaDocViewerModal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeCeisaDocViewer();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCeisaDocViewer();
    });

    const docModalInput = document.getElementById('docModalFileInput');
    if (docModalInput) {
        docModalInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleDocViewerFileSelect(e.target.files[0]);
            }
        });
    }

    const btnModalUpload = document.getElementById('btnModalUploadCustom');
    if (btnModalUpload && docModalInput) {
        btnModalUpload.addEventListener('click', () => docModalInput.click());
    }

    const btnFallbackSelect = document.getElementById('btnFallbackSelectFile');
    if (btnFallbackSelect && docModalInput) {
        btnFallbackSelect.addEventListener('click', () => docModalInput.click());
    }

    // 11. Restore PEB draft or load sample
    const hasRestored = restoreDraftState();
    if (!hasRestored) {
        loadDraftData(SAMPLE_DATA, false);
    }

    // 12. Initialize 9-Tab Stepper State
    switchCeisaTab('tab-header');
});
