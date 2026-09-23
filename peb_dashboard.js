// ====================================================================
// CEISA 4.0 PORTAL MASTER & MODUL DRAFT PEB (EKSPOR)
// peb_dashboard.js - 100% External, Chrome Extension CSP Compliant
// ====================================================================

// MASTER PORTAL MODULE SWITCHER (CEISA 4.0 SIDEBAR & WORKSPACE)
function switchPortalModule(moduleName) {
    const pebView = document.getElementById('module-peb');
    const pibView = document.getElementById('module-pib');
    const inspectorView = document.getElementById('module-inspector');

    // Multi-page routing across decoupled pages
    if (moduleName === 'peb' && !pebView) {
        window.location.href = 'peb.html';
        return;
    }
    if (moduleName === 'pib' && !pibView) {
        window.location.href = 'pib.html';
        return;
    }
    if (moduleName === 'inspector' && !inspectorView) {
        window.location.href = 'dashboard.html';
        return;
    }

    try {
        sessionStorage.setItem('ceisa_active_portal_module', moduleName);
    } catch (e) {}

    const btnPeb = document.getElementById('btnNavPeb');
    const btnPib = document.getElementById('btnNavPib');
    const btnInspector = document.getElementById('btnNavInspector');
    const pebHeaderActions = document.getElementById('pebHeaderActions');
    const pibHeaderActions = document.getElementById('pibHeaderActions');
    const inspectorHeaderActions = document.getElementById('inspectorHeaderActions');

    // Reset visibility of all views
    if (pebView) pebView.style.display = 'none';
    if (pibView) pibView.style.display = 'none';
    if (inspectorView) inspectorView.style.display = 'none';

    // Reset active status of sidebar buttons
    if (btnPeb) {
        btnPeb.classList.remove('active');
        btnPeb.setAttribute('aria-selected', 'false');
    }
    if (btnPib) {
        btnPib.classList.remove('active');
        btnPib.setAttribute('aria-selected', 'false');
    }
    if (btnInspector) {
        btnInspector.classList.remove('active');
        btnInspector.setAttribute('aria-selected', 'false');
    }

    // Hide all contextual header actions
    if (pebHeaderActions) pebHeaderActions.style.display = 'none';
    if (pibHeaderActions) pibHeaderActions.style.display = 'none';
    if (inspectorHeaderActions) inspectorHeaderActions.style.display = 'none';

    if (moduleName === 'inspector') {
        if (inspectorView) inspectorView.style.display = 'block';
        if (btnInspector) {
            btnInspector.classList.add('active');
            btnInspector.setAttribute('aria-selected', 'true');
        }
        if (inspectorHeaderActions) inspectorHeaderActions.style.display = 'flex';
        if (typeof loadDashboardData === 'function') loadDashboardData();
    } else if (moduleName === 'pib') {
        if (pibView) pibView.style.display = 'block';
        if (btnPib) {
            btnPib.classList.add('active');
            btnPib.setAttribute('aria-selected', 'true');
        }
        if (pibHeaderActions) pibHeaderActions.style.display = 'flex';
    } else {
        // Default: 'peb' (Ekspor)
        if (pebView) pebView.style.display = 'block';
        if (btnPeb) {
            btnPeb.classList.add('active');
            btnPeb.setAttribute('aria-selected', 'true');
        }
        if (pebHeaderActions) pebHeaderActions.style.display = 'flex';
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
    const safeFilename = `Draft_PEB_${noAju.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
    a.href = url;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Simpan juga ke backend server di folder drafts/ekspor/
    try {
        fetch('http://localhost:5005/api/save-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'ekspor',
                data: draft,
                filename: safeFilename
            })
        }).then(res => res.json()).then(res => {
            console.log('[SAVE-DRAFT EKSPOR]', res);
        }).catch(err => {
            console.warn('Gagal sinkronisasi draft ke server:', err);
        });
    } catch (e) {}

    showToast("Berkas JSON PEB berhasil diekspor (tersimpan di drafts/ekspor/)!", "success");
}

function collectFormData() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    const items = [];

    rows.forEach(r => {
        if (r.querySelector('td[colspan]')) return;
        const hsCode = r.querySelector('.item-hscode')?.value.trim() || '';
        const desc = r.querySelector('.item-desc')?.value.trim();
        const qtyVal = r.querySelector('.item-qty-val')?.value.trim();
        const qtyUnit = r.querySelector('.item-qty-unit')?.value || 'PCE';
        const packVal = r.querySelector('.item-pack-val')?.value.trim();
        const packType = r.querySelector('.item-pack-type')?.value || 'BX';
        const net = r.querySelector('.item-net')?.value.trim();
        const gross = r.querySelector('.item-gross')?.value.trim();
        const amt = r.querySelector('.item-amt')?.value.trim();

        if (desc || qtyVal || hsCode) {
            items.push({
                hsCode: hsCode,
                posTarif: hsCode,
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

// HELPER NORMALISASI NAMA FILE DOKUMEN (Mengabaikan timestamp prefix & spasi/simbol)
function normalizeDocName(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/^\d{10,14}_/, '') // Buang timestamp prefix misal 1727000000000_
        .replace(/[^a-z0-9]/g, '');
}

// HELPER GUESS DOCUMENT TYPE (GLOBAL SCOPE)
function guessDocType(filename) {
    if (!filename) return 'DOKUMEN PABEAN';
    const lower = filename.toLowerCase();

    // 1. Deteksi B/L / Konosemen / Sea Waybill / Air Waybill
    const blTokens = ['bl', 'bol', 'swb', 'awb', 'ocean bl', 'ocean-bl', 'ocean_bl', 'b/l', 'b.l'];
    const hasBlToken = blTokens.some(tok => {
        const regex = new RegExp(`(^|[^a-z0-9])${tok.replace(/[/.]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
        return regex.test(lower);
    });

    if (
        hasBlToken ||
        lower.includes('lading') ||
        lower.includes('waybill') ||
        lower.includes('konosemen') ||
        lower.includes('bapsin') ||
        lower.includes('bill of lading') ||
        lower.includes('seawaybill') ||
        lower.includes('airwaybill') ||
        lower.startsWith('bl ') || lower.startsWith('bl_') || lower.startsWith('bl-') || lower.startsWith('bl.') ||
        lower.endsWith('_bl.pdf') || lower.endsWith('-bl.pdf') || lower.endsWith(' bl.pdf') || lower.endsWith('.bl.pdf')
    ) {
        return 'BILL OF LADING';
    }

    // 2. Deteksi Invoice / Faktur
    if (
        /(^|[^a-z0-9])(inv|invoice|faktur)([^a-z0-9]|$)/i.test(lower) ||
        lower.includes('commercial') ||
        lower.includes('faktur') ||
        lower.startsWith('inv')
    ) {
        return 'INVOICE';
    }

    // 3. Deteksi Packing List / Daftar Kemasan
    if (
        /(^|[^a-z0-9])(pl|pack|packing|kemasan)([^a-z0-9]|$)/i.test(lower) ||
        lower.includes('packing') ||
        lower.includes('packlist') ||
        lower.includes('kemasan') ||
        lower.startsWith('pl')
    ) {
        return 'PACKING LIST';
    }

    if (lower.includes('coo') || lower.includes('cert') || lower.includes('origin')) {
        return 'CERTIFICATE';
    }

    return 'DOKUMEN PABEAN';
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

    // Resolve Document Filenames for Table 1 Links (Otomatis terhubung dengan file yang diunggah)
    window._currentDocMap = window._currentDocMap || {};
    const docList = data.safeCheck?.documentList || [];

    // Prioritaskan file yang diunggah dalam sesi ini
    const uploadedFiles = window._lastUploadedFiles || [];
    const primaryFile = window._lastUploadedFile || uploadedFiles[0] || null;
    const primaryBlob = window._lastUploadedBlobUrl || (primaryFile ? window._docFileMap[primaryFile.name] : null);

    let invFileName = null;
    let plFileName = null;
    let blFileName = null;

    // 1. Deteksi awal dari nama file fisik yang diunggah
    if (uploadedFiles.length > 0) {
        uploadedFiles.forEach(f => {
            const dt = guessDocType(f.name);
            if (dt === 'INVOICE' && !invFileName) invFileName = f.name;
            else if (dt === 'PACKING LIST' && !plFileName) plFileName = f.name;
            else if (dt === 'BILL OF LADING' && !blFileName) blFileName = f.name;
        });
    }

    // 2. Cross-check dengan hasil AI Document Classifier (docList)
    if (docList.length > 0 && uploadedFiles.length > 0) {
        docList.forEach(d => {
            const dt = d.documentType || '';
            const dNorm = normalizeDocName(d.fileName);
            const matchedUploaded = uploadedFiles.find(uf => {
                const ufNorm = normalizeDocName(uf.name);
                return ufNorm === dNorm || ufNorm.includes(dNorm) || dNorm.includes(ufNorm);
            });

            if (matchedUploaded) {
                if (/lading|bl|waybill/i.test(dt) && !blFileName) blFileName = matchedUploaded.name;
                else if (/invoice|inv/i.test(dt) && !invFileName) invFileName = matchedUploaded.name;
                else if (/packing|pl/i.test(dt) && !plFileName) plFileName = matchedUploaded.name;
            }
        });
    }

    // 3. Alokasikan file terunggah yang belum terpetakan ke slot yang masih kosong
    if (uploadedFiles.length > 0) {
        const unassigned = uploadedFiles.filter(f => f.name !== invFileName && f.name !== plFileName && f.name !== blFileName);
        if (!blFileName && unassigned.length > 0) blFileName = unassigned.shift().name;
        if (!invFileName && unassigned.length > 0) invFileName = unassigned.shift().name;
        if (!plFileName && unassigned.length > 0) plFileName = unassigned.shift().name;
    }

    // 4. Jika HANYA ADA 1 FILE yang diunggah (berkas lampiran gabungan / single PDF)
    if (uploadedFiles.length === 1 && primaryFile) {
        invFileName = primaryFile.name;
        plFileName = primaryFile.name;
        blFileName = primaryFile.name;
    }

    const invDoc = docList.find(d => /invoice/i.test(d.documentType || '') || /inv/i.test(d.fileName || ''));
    const plDoc = docList.find(d => /packing/i.test(d.documentType || '') || /pl/i.test(d.fileName || ''));
    const blDoc = docList.find(d => /lading|bl|waybill/i.test(d.documentType || '') || /bl/i.test(d.fileName || ''));

    window._currentDocMap.INVOICE = invFileName || invDoc?.fileName || (data.invoiceNumber ? `INV.${data.invoiceNumber}.pdf` : 'INV.98007744.pdf');
    window._currentDocMap.PACKING_LIST = plFileName || plDoc?.fileName || (data.packingListNumber ? `PL.${data.packingListNumber}.pdf` : 'PL.98007744.pdf');
    window._currentDocMap.BILL_OF_LADING = blFileName || blDoc?.fileName || (data.blNumber ? `BL.${data.blNumber}.pdf` : 'BL BAPSIN0153818 PT VALEO AC-RBB47.pdf');

    // 5. MAPPING KE _docFileMap SECARA AMAN (TIDAK MENIMPA B/L DENGAN INVOICE!)
    if (uploadedFiles.length === 1 && primaryBlob) {
        window._docFileMap[window._currentDocMap.INVOICE] = primaryBlob;
        window._docFileMap[window._currentDocMap.PACKING_LIST] = primaryBlob;
        window._docFileMap[window._currentDocMap.BILL_OF_LADING] = primaryBlob;
    } else {
        // Setiap dokumen dipetakan ke blob filenya masing-masing
        if (invFileName && window._docFileMap[invFileName]) {
            window._docFileMap[window._currentDocMap.INVOICE] = window._docFileMap[invFileName];
        }
        if (plFileName && window._docFileMap[plFileName]) {
            window._docFileMap[window._currentDocMap.PACKING_LIST] = window._docFileMap[plFileName];
        }
        if (blFileName && window._docFileMap[blFileName]) {
            window._docFileMap[window._currentDocMap.BILL_OF_LADING] = window._docFileMap[blFileName];
        }
    }

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
    renderDocumentsTable(data);
    renderSafeCheck(data.safeCheck);

    if (shouldSave) {
        saveCurrentDraftState();
    }
}

// ====================================================================
// RENDER TABEL DOKUMEN LAMPIRAN (TAB DOKUMEN - CEISA 4.0)
// ====================================================================
function renderDocumentsTable(data = {}) {
    const tbody = document.getElementById('ceisaDocTableBody') || document.querySelector('#tab-dokumen .ceisa-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const docList = data.safeCheck?.documentList || [];
    const rows = [];

    // 1. Dokumen Invoice (380)
    const invNum = data.invoiceNumber || '';
    const invDate = data.invoiceDate || '';
    const invFile = window._currentDocMap?.INVOICE || (invNum ? `INV.${invNum}.pdf` : 'INV.98007744.pdf');

    // 2. Dokumen Packing List (217)
    const plNum = data.packingListNumber || data.invoiceNumber || '';
    const plDate = data.packingListDate || data.invoiceDate || '';
    const plFile = window._currentDocMap?.PACKING_LIST || (plNum ? `PL.${plNum}.pdf` : 'PL.98007744.pdf');

    // 3. Dokumen Bill of Lading (705)
    const blNum = data.blNumber || '';
    const blDate = data.blDate || '';
    const blFile = window._currentDocMap?.BILL_OF_LADING || (blNum ? `BL.${blNum}.pdf` : 'BL BAPSIN0153818 PT VALEO AC-RBB47.pdf');

    // Cek apakah shipment memiliki berkas B/L atau nomor B/L
    const hasBl = Boolean(
        blNum || 
        (window._currentDocMap?.BILL_OF_LADING && !window._currentDocMap.BILL_OF_LADING.includes('VALEO')) || 
        docList.some(d => /lading|bl|waybill/i.test(d.documentType || ''))
    );

    // Jika ada BL atau merupakan draft Valeo / draft default
    if (hasBl || data.shipperName?.toLowerCase().includes('valeo') || (!data.shipperName && !data.invoiceNumber)) {
        rows.push({
            id: 'row-bl',
            code: '705 - B/L',
            docType: '705 - BILL OF LADING (OCEAN B/L)',
            inputId: 'blNumber',
            dateId: 'blDate',
            btnId: 'btnOpenDocBL',
            tagId: 'tagFileBL',
            number: blNum,
            date: blDate,
            fileName: blFile
        });
    }

    // Invoice
    rows.push({
        id: 'row-invoice',
        code: '380 - INVOICE',
        docType: '380 - INVOICE (KOMERSIAL)',
        inputId: 'invoiceNumber',
        dateId: 'invoiceDate',
        btnId: 'btnOpenDocInvoice',
        tagId: 'tagFileInvoice',
        number: invNum,
        date: invDate,
        fileName: invFile
    });

    // Packing List
    rows.push({
        id: 'row-packinglist',
        code: '217 - PACKING LIST',
        docType: '217 - PACKING LIST (DAFTAR KEMASAN)',
        inputId: 'packingListNumber',
        dateId: 'packingListDate',
        btnId: 'btnOpenDocPackingList',
        tagId: 'tagFilePackingList',
        number: plNum,
        date: plDate,
        fileName: plFile
    });

    // Jika BL belum ada di rows tetapi ada blNum
    if (!rows.some(r => r.id === 'row-bl') && blNum) {
        rows.push({
            id: 'row-bl',
            code: '705 - B/L',
            docType: '705 - BILL OF LADING (OCEAN B/L)',
            inputId: 'blNumber',
            dateId: 'blDate',
            btnId: 'btnOpenDocBL',
            tagId: 'tagFileBL',
            number: blNum,
            date: blDate,
            fileName: blFile
        });
    }

    // Dokumen tambahan lainnya dari docList (misal COO / Sertifikat Asal)
    docList.forEach((d, idx) => {
        const dt = d.documentType || '';
        if (!/invoice|inv|packing|pl|lading|bl|waybill/i.test(dt)) {
            const extraCode = /coo|cert|origin/i.test(dt) ? '861 - CERTIFICATE OF ORIGIN' : '999 - DOKUMEN LAINNYA';
            rows.push({
                id: `row-doc-extra-${idx}`,
                code: extraCode,
                docType: dt || 'DOKUMEN PABEAN',
                inputId: `docExtraNumber_${idx}`,
                dateId: `docExtraDate_${idx}`,
                btnId: `btnOpenDocExtra_${idx}`,
                tagId: `tagFileExtra_${idx}`,
                number: '',
                date: '',
                fileName: d.fileName || 'Dokumen_Pabean.pdf'
            });
        }
    });

    // Render baris dokumen
    rows.forEach((row, index) => {
        appendDocRow(row, index + 1);
    });

    updateDocTableIndices();
}

function appendDocRow(row, index) {
    const tbody = document.getElementById('ceisaDocTableBody') || document.querySelector('#tab-dokumen .ceisa-table tbody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.id = row.id || `row-doc-${Date.now()}`;
    tr.innerHTML = `
        <td style="text-align: center; font-family: var(--font-mono); font-weight: 600;" class="doc-row-num">${index}</td>
        <td style="font-weight: 600; color: var(--text-primary); font-size: 12.5px;">${escapeHtml(row.code)}</td>
        <td><input type="text" id="${row.inputId}" class="table-input-mono doc-input-sync" value="${escapeHtml(row.number || '')}" placeholder="Nomor ${escapeHtml(row.code.split('-')[1]?.trim() || 'dokumen')}..."></td>
        <td><input type="text" id="${row.dateId}" class="table-input-mono doc-input-sync" value="${escapeHtml(row.date || '')}" placeholder="DD-MM-YYYY"></td>
        <td style="text-align: center; color: #94a3b8;">-</td>
        <td style="text-align: center; color: #94a3b8;">-</td>
        <td style="text-align: center; color: #94a3b8;">-</td>
        <td>
            <div class="doc-link-wrap">
                <button type="button" class="btn-doc-link" id="${row.btnId}" data-doc-type="${escapeHtml(row.docType || row.code)}" data-filename="${escapeHtml(row.fileName || '')}" title="Buka berkas ${escapeHtml(row.fileName || '')}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
                <span class="doc-file-tag" id="${row.tagId}" title="${escapeHtml(row.fileName || '')}">${escapeHtml(row.fileName || 'Dokumen.pdf')}</span>
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
    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            const numInput = tr.querySelector(`#${row.inputId}`);
            const dateInput = tr.querySelector(`#${row.dateId}`);
            const tagEl = tr.querySelector('.doc-file-tag');
            const targetFile = tagEl?.textContent?.trim() || row.fileName || 'Dokumen.pdf';
            openCeisaDocViewer({
                docType: row.docType || row.code,
                fileName: targetFile,
                docNumber: numInput?.value || row.number,
                docDate: dateInput?.value || row.date
            });
        });
    }

    // Wire Hapus Dokumen
    const btnDel = tr.querySelector('.btn-doc-delete');
    if (btnDel) {
        btnDel.addEventListener('click', function () {
            tr.style.transition = 'opacity 0.2s';
            tr.style.opacity = '0';
            setTimeout(() => {
                tr.remove();
                updateDocTableIndices();
                triggerAutoSave();
            }, 200);
        });
    }

    // Wire input sync auto-save
    tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => triggerAutoSave());
        inp.addEventListener('change', () => triggerAutoSave());
    });

    tbody.appendChild(tr);
}

function updateDocTableIndices() {
    const tbody = document.getElementById('ceisaDocTableBody') || document.querySelector('#tab-dokumen .ceisa-table tbody');
    const totalSpan = document.getElementById('ceisaDocTableTotal') || document.querySelector('.ceisa-table-pagination > span');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach((tr, idx) => {
        const numCell = tr.querySelector('td:first-child');
        if (numCell) numCell.textContent = idx + 1;
    });

    if (totalSpan) {
        totalSpan.textContent = `Total ${rows.length}`;
    }
}

function addNewDocRow() {
    const tbody = document.getElementById('ceisaDocTableBody') || document.querySelector('#tab-dokumen .ceisa-table tbody');
    if (!tbody) return;

    const currentCount = tbody.querySelectorAll('tr').length;
    const newIdx = currentCount + 1;
    const randId = Date.now();

    const newRow = {
        id: `row-doc-${randId}`,
        code: '999 - DOKUMEN LAINNYA',
        docType: 'DOKUMEN PABEAN',
        inputId: `docCustomNum_${randId}`,
        dateId: `docCustomDate_${randId}`,
        btnId: `btnOpenDocCustom_${randId}`,
        tagId: `tagFileCustom_${randId}`,
        number: '',
        date: '',
        fileName: 'Pilih_Dokumen.pdf'
    };

    appendDocRow(newRow, newIdx);
    updateDocTableIndices();
    triggerAutoSave();
    showToast("Baris dokumen lampiran baru ditambahkan.", "info");
}

// RENDER ITEMS TABLE
function renderItemsTable(items) {
    const tbody = document.getElementById('itemsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">Belum ada rincian barang.</td></tr>`;
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
            <input type="text" class="table-input-mono item-hscode" value="${escapeHtml(item.hsCode || item.posTarif || '')}" placeholder="Pos Tarif..." maxlength="15" title="Pos Tarif / HS Code">
        </td>
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
    if (tbody.querySelector('td[colspan]')) tbody.innerHTML = '';
    appendItemRow({ hsCode: '', uraianJenisBarang: '', jumlahDanSatuanBarang: '', kemasan: '', beratBersih: '', beratKotor: '', amount: '' });
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
        if (r.querySelector('td[colspan]')) return;
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

    const isBL = /lading|bl|bill|waybill|705|bapsin/i.test(docType || '') || /bl|lading|waybill|bapsin/i.test(window._activeModalFileName || '');
    const isINV = /invoice|faktur|380/i.test(docType || '') || /inv|invoice|faktur/i.test(window._activeModalFileName || '');
    const isPL = /packing|kemasan|217/i.test(docType || '') || /pl|pack|packing/i.test(window._activeModalFileName || '');

    let blobUrl = null;
    let finalFileName = window._activeModalFileName;

    // 1. Direct key match di _docFileMap
    if (window._docFileMap[finalFileName]) {
        blobUrl = window._docFileMap[finalFileName];
    }

    // 2. Normalized name match (mengabaikan timestamp prefix, spasi vs underscore, simbol)
    if (!blobUrl) {
        const normTarget = normalizeDocName(finalFileName);
        for (const [k, v] of Object.entries(window._docFileMap)) {
            const normK = normalizeDocName(k);
            if (normK && normTarget && (normK === normTarget || normK.includes(normTarget) || normTarget.includes(normK))) {
                blobUrl = v;
                finalFileName = k;
                break;
            }
        }
    }

    // 3. Cek mapping dokumen sesi saat ini berdasarkan jenis dokumen yang diminta
    if (!blobUrl) {
        if (isBL && window._currentDocMap?.BILL_OF_LADING && window._docFileMap[window._currentDocMap.BILL_OF_LADING]) {
            blobUrl = window._docFileMap[window._currentDocMap.BILL_OF_LADING];
            finalFileName = window._currentDocMap.BILL_OF_LADING;
        } else if (isINV && window._currentDocMap?.INVOICE && window._docFileMap[window._currentDocMap.INVOICE]) {
            blobUrl = window._docFileMap[window._currentDocMap.INVOICE];
            finalFileName = window._currentDocMap.INVOICE;
        } else if (isPL && window._currentDocMap?.PACKING_LIST && window._docFileMap[window._currentDocMap.PACKING_LIST]) {
            blobUrl = window._docFileMap[window._currentDocMap.PACKING_LIST];
            finalFileName = window._currentDocMap.PACKING_LIST;
        }
    }

    // 4. Cari dari seluruh entri _docFileMap yang cocok dengan jenis dokumen
    if (!blobUrl) {
        for (const [k, v] of Object.entries(window._docFileMap)) {
            const guessed = guessDocType(k);
            if (isBL && guessed === 'BILL OF LADING') {
                blobUrl = v;
                finalFileName = k;
                break;
            } else if (isINV && guessed === 'INVOICE') {
                blobUrl = v;
                finalFileName = k;
                break;
            } else if (isPL && guessed === 'PACKING LIST') {
                blobUrl = v;
                finalFileName = k;
                break;
            }
        }
    }

    // 5. HANYA JIKA memang HANYA ADA 1 file yang diunggah (single merged shipment file)
    const uploadedList = window._lastUploadedFiles || [];
    if (!blobUrl && uploadedList.length === 1 && window._lastUploadedBlobUrl) {
        blobUrl = window._lastUploadedBlobUrl;
        finalFileName = uploadedList[0].name;
    }

    // Terapkan blobUrl jika berhasil ditemukan di browser
    if (blobUrl) {
        window._activeModalFileName = finalFileName;
        if (titleEl) titleEl.textContent = finalFileName;
        if (fallbackFileName) fallbackFileName.textContent = finalFileName;
        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = blobUrl;
        }
        if (btnDownload) {
            btnDownload.href = blobUrl;
            btnDownload.download = finalFileName;
        }
        if (btnOpenTab) btnOpenTab.href = blobUrl;
        setTimeout(() => { if (loading) loading.style.display = 'none'; }, 150);
        return;
    }

    // 6. Coba ambil dari server lokal (port 5005) dengan parameter filter docType yang akurat
    const serverUrl = `http://localhost:5005/api/documents/${encodeURIComponent(finalFileName)}?docType=${encodeURIComponent(docType || '')}`;
    const relativeUrl = `attachments/${encodeURIComponent(finalFileName)}`;

    fetch(serverUrl, { method: 'HEAD' })
        .then(res => {
            if (res.ok) {
                if (iframe) iframe.src = serverUrl;
                if (btnDownload) {
                    btnDownload.href = serverUrl;
                    btnDownload.download = finalFileName;
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
                            btnDownload.download = finalFileName;
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
            "hsCode": "8512.40.00",
            "uraianJenisBarang": "FG AC Delco US Gold Hybrid 21\" 525mm",
            "jumlahDanSatuanBarang": "960 PCS",
            "kemasan": "816 BX",
            "beratBersih": "159.36 KG",
            "beratKotor": "174.36 KG",
            "amount": "1,929.60"
        },
        {
            "hsCode": "8512.40.00",
            "uraianJenisBarang": "FG AC Delco US Silver SVB 21\" 525mm",
            "jumlahDanSatuanBarang": "960 PCS",
            "kemasan": "816 BX",
            "beratBersih": "166.08 KG",
            "beratKotor": "181.08 KG",
            "amount": "1,545.60"
        },
        {
            "hsCode": "8512.40.00",
            "uraianJenisBarang": "FG AC Delco US Silver SVB 26\" 650mm",
            "jumlahDanSatuanBarang": "800 PCS",
            "kemasan": "816 BX",
            "beratBersih": "168.80 KG",
            "beratKotor": "183.80 KG",
            "amount": "1,520.00"
        },
        {
            "hsCode": "8512.40.00",
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
// DOCUMENT PARSER MODAL (HALAMAN AWAL DOKUMEN BARU)
// ====================================================================
function initDocumentParserModal() {
    const modal = document.getElementById('docParserModal');
    const btnDokumenBaru = document.getElementById('btnDokumenBaru');
    const btnCloseTop = document.getElementById('btnCloseDocParserTop');
    const btnStart = document.getElementById('btnDocParserStart');
    const btnUploadJson = document.getElementById('btnDocParserUploadJson');
    const jsonInput = document.getElementById('docParserJsonInput');
    const dropzone = document.getElementById('docParserDropzone');
    const fileInput = document.getElementById('docParserFileInput');
    const btnBrowse = document.getElementById('btnBrowseDocParser');
    const filesWrapper = document.getElementById('docParserFilesWrapper');
    const filesList = document.getElementById('docParserFilesList');
    const filesCount = document.getElementById('docParserFilesCount');
    const btnClearFiles = document.getElementById('btnClearDocParserFiles');
    const progressBox = document.getElementById('docParserProgressBox');
    const progressFill = document.getElementById('docParserProgressFill');
    const stepTitle = document.getElementById('docParserStepTitle');
    const stepDesc = document.getElementById('docParserStepDesc');
    const stepLog = document.getElementById('docParserStepLog');
    const errorBox = document.getElementById('docParserErrorBox');
    const errorMsg = document.getElementById('docParserErrorMsg');
    const btnRetry = document.getElementById('btnDocParserRetry');
    const spinner = document.getElementById('docParserSpinner');
    const apiKeyRow = document.getElementById('docParserApiKeyRow');
    const apiKeyInput = document.getElementById('docParserApiKeyInput');
    const btnSaveGeminiKey = document.getElementById('btnSaveGeminiKey');
    const modalSafeCheckContainer = document.getElementById('modalSafeCheckContainer');
    const btnContinue = document.getElementById('btnDocParserContinue');
    const parserMinimizedActions = document.getElementById('parserMinimizedActions');
    const btnToggleParserLog = document.getElementById('btnToggleParserLog');
    const btnReuploadParser = document.getElementById('btnReuploadParser');

    // Floating Background Parser Widget Elements
    const floatingWidget = document.getElementById('floatingParserWidget');
    const floatingCircleProgress = document.getElementById('floatingCircleProgress');
    const floatingCirclePercent = document.getElementById('floatingCirclePercent');
    const floatingParserTitle = document.getElementById('floatingParserTitle');
    const floatingParserDesc = document.getElementById('floatingParserDesc');
    const btnOpenFloating = document.getElementById('btnOpenFloatingParser');
    const btnDismissFloating = document.getElementById('btnDismissFloatingParser');

    if (!modal) return;

    let selectedFiles = [];
    let isScanRunning = false;
    let currentScanState = {
        percent: 0,
        title: 'Memproses Dokumen...',
        desc: 'Ray-OCR V.1 di latar belakang',
        status: 'running' // 'running' | 'completed' | 'error'
    };

    function updateFloatingProgress(percent, title, desc, status = 'running') {
        currentScanState = { percent, title, desc, status };

        if (floatingParserTitle && title) floatingParserTitle.textContent = title;
        if (floatingParserDesc && desc) floatingParserDesc.textContent = desc;

        // Circular progress SVG: r=18, circumference = 2 * PI * 18 = 113.1
        const circumference = 113.1;
        const clamped = Math.max(0, Math.min(100, Math.round(percent)));
        const offset = circumference * (1 - clamped / 100);

        if (floatingCircleProgress) {
            floatingCircleProgress.style.strokeDashoffset = offset;
        }

        if (floatingCirclePercent) {
            if (status === 'completed') {
                floatingCirclePercent.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
            } else if (status === 'error') {
                floatingCirclePercent.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                `;
            } else {
                floatingCirclePercent.textContent = `${clamped}%`;
            }
        }

        if (floatingWidget) {
            floatingWidget.classList.remove('status-completed', 'status-error');
            if (status === 'completed') {
                floatingWidget.classList.add('status-completed');
            } else if (status === 'error') {
                floatingWidget.classList.add('status-error');
            }
        }
    }

    function showFloatingWidget() {
        if (!floatingWidget) return;
        floatingWidget.style.display = 'block';
        void floatingWidget.offsetWidth; // Force reflow
        floatingWidget.classList.add('active');
    }

    function hideFloatingWidget() {
        if (!floatingWidget) return;
        floatingWidget.classList.remove('active');
        setTimeout(() => {
            if (!floatingWidget.classList.contains('active')) {
                floatingWidget.style.display = 'none';
            }
        }, 450);
    }

    function openModal(keepState = false) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        hideFloatingWidget();
        if (!keepState && !isScanRunning) {
            resetProgress();
        }
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        if (isScanRunning) {
            showFloatingWidget();
            showToast("Pemindaian tetap berjalan di latar belakang", "info");
        } else {
            // Ketika tidak sedang scanning, sembunyikan widget dan jangan pernah dimunculkan lagi
            hideFloatingWidget();
        }
    }

    // Klik widget mengambang di kanan untuk membuka kembali popup modal
    if (btnOpenFloating) {
        btnOpenFloating.addEventListener('click', (e) => {
            if (e.target.closest('#btnDismissFloatingParser')) return;
            hideFloatingWidget();
            currentScanState.status = 'idle';
            openModal(true);
        });
    }

    // Tombol close/dismiss pada widget mengambang
    if (btnDismissFloating) {
        btnDismissFloating.addEventListener('click', (e) => {
            e.stopPropagation();
            hideFloatingWidget();
            currentScanState.status = 'idle';
        });
    }

    function resetProgress() {
        if (dropzone) dropzone.classList.remove('collapsed');
        if (filesWrapper) {
            filesWrapper.classList.remove('collapsed');
            if (selectedFiles.length > 0) filesWrapper.style.display = 'block';
            else filesWrapper.style.display = 'none';
        }
        if (progressBox) {
            progressBox.classList.remove('minimized');
            progressBox.style.display = 'none';
        }
        if (parserMinimizedActions) parserMinimizedActions.style.display = 'none';
        if (btnToggleParserLog) {
            btnToggleParserLog.classList.remove('expanded');
            const span = btnToggleParserLog.querySelector('span');
            if (span) span.textContent = 'Riwayat Log';
        }
        if (stepLog) {
            stepLog.classList.remove('expanded');
            stepLog.innerHTML = '';
            stepLog.style.display = '';
        }
        if (modalSafeCheckContainer) {
            modalSafeCheckContainer.classList.remove('animate-slide-up');
            modalSafeCheckContainer.style.display = 'none';
        }
        if (errorBox) errorBox.style.display = 'none';
        if (apiKeyRow) apiKeyRow.style.display = 'none';
        if (btnContinue) btnContinue.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        if (spinner) spinner.style.display = '';
        if (btnStart) {
            btnStart.style.display = '';
            btnStart.disabled = false;
            btnStart.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start / Mulai Scan
            `;
        }
        isScanRunning = false;
        currentScanState = { percent: 0, title: '', desc: '', status: 'idle' };
    }

    if (btnToggleParserLog) {
        btnToggleParserLog.addEventListener('click', () => {
            const isExp = stepLog.classList.toggle('expanded');
            btnToggleParserLog.classList.toggle('expanded', isExp);
            const span = btnToggleParserLog.querySelector('span');
            if (span) span.textContent = isExp ? 'Tutup Log' : 'Riwayat Log';
        });
    }

    if (btnReuploadParser) {
        btnReuploadParser.addEventListener('click', () => {
            selectedFiles = [];
            if (fileInput) fileInput.value = '';
            renderFileList();
            resetProgress();
            hideFloatingWidget();
        });
    }

    const handleOpenDokumenBaru = () => {
        if (isScanRunning) {
            // Jika sedang ada proses scan aktif, buka kembali prosesnya
            openModal(true);
        } else {
            // Jika tidak ada scan aktif, reset total untuk unggah Dokumen Baru
            selectedFiles = [];
            if (fileInput) fileInput.value = '';
            renderFileList();
            resetProgress();
            hideFloatingWidget();
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    if (btnDokumenBaru) {
        btnDokumenBaru.addEventListener('click', handleOpenDokumenBaru);
    }
    const btnPibDokumenBaru = document.getElementById('btnPibDokumenBaru');
    if (btnPibDokumenBaru) {
        btnPibDokumenBaru.addEventListener('click', handleOpenDokumenBaru);
    }
    if (btnCloseTop) btnCloseTop.addEventListener('click', closeModal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
    });

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }


    function renderFileList(isDone = false) {
        if (btnStart) {
            btnStart.disabled = false;
        }
        if (!filesList || !filesWrapper || !filesCount) return;
        if (selectedFiles.length === 0) {
            filesWrapper.style.display = 'none';
            filesList.innerHTML = '';
            return;
        }
        filesWrapper.classList.remove('collapsed');
        filesWrapper.style.display = 'block';
        filesCount.textContent = `${selectedFiles.length} Dokumen Dipilih`;
        filesList.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'doc-parser-file-item';
            const docType = guessDocType(file.name);
            const sizeStr = formatFileSize(file.size);
            const statusBadge = isDone 
                ? `<span class="file-item-tag" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;">✅ Terbaca</span>` 
                : `<span class="file-item-tag">${docType}</span>`;

            item.innerHTML = `
                <div class="file-item-left">
                    <span class="file-item-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                    </span>
                    <div class="file-item-details">
                        <span class="file-item-name" title="${file.name}">${file.name}</span>
                        <span class="file-item-size">${sizeStr} &bull; ${docType}</span>
                    </div>
                </div>
                <div class="file-item-right">
                    ${statusBadge}
                    <button type="button" class="btn-remove-file" title="Hapus berkas ini" data-index="${index}">&times;</button>
                </div>
            `;
            const btnRemove = item.querySelector('.btn-remove-file');
            if (btnRemove) {
                btnRemove.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    selectedFiles.splice(index, 1);
                    renderFileList(isDone);
                });
            }
            filesList.appendChild(item);
        });
    }

    function addFiles(fileList) {
        if (!fileList || fileList.length === 0) return;
        window._docFileMap = window._docFileMap || {};
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const alreadyExists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
            if (!alreadyExists) {
                selectedFiles.push(file);
                try {
                    const bUrl = URL.createObjectURL(file);
                    window._docFileMap[file.name] = bUrl;
                    window._lastUploadedFile = file;
                    window._lastUploadedBlobUrl = bUrl;
                } catch (e) {}
            }
        }
        window._lastUploadedFiles = [...selectedFiles];
        if (selectedFiles.length > 0 && !window._lastUploadedFile) {
            window._lastUploadedFile = selectedFiles[0];
            window._lastUploadedBlobUrl = window._docFileMap[selectedFiles[0].name];
        }
        if (filesWrapper) {
            filesWrapper.classList.remove('collapsed');
            filesWrapper.style.display = 'block';
        }
        if (btnStart) {
            btnStart.disabled = false;
        }
        renderFileList(false);
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if (e.target !== fileInput && !e.target.closest('#btnBrowseDocParser')) {
                fileInput.click();
            }
        });
        if (btnBrowse) {
            btnBrowse.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
        }
        fileInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                addFiles(e.target.files);
            }
            fileInput.value = '';
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('drag-over');
            }, false);
        });
        ['dragleave', 'dragend', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('drag-over');
            }, false);
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                addFiles(dt.files);
            }
        }, false);

        window.addEventListener('dragover', (e) => e.preventDefault(), false);
        window.addEventListener('drop', (e) => e.preventDefault(), false);
    }

    if (btnClearFiles) {
        btnClearFiles.addEventListener('click', () => {
            selectedFiles = [];
            renderFileList();
        });
    }

    // Unggah JSON langsung dari modal
    if (btnUploadJson && jsonInput) {
        btnUploadJson.addEventListener('click', () => jsonInput.click());
        jsonInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const lbl = document.getElementById('lblFileName');
            if (lbl) lbl.textContent = file.name;
            try { localStorage.setItem(STORAGE_KEY_LAST_FILENAME, file.name); } catch (err) {}
            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    loadDraftData(parsed, true);
                    closeModal();
                    showToast(`Berkas JSON '${file.name}' berhasil dimuat ke formulir!`, "success");
                } catch (err) {
                    alert("Format berkas JSON tidak valid: " + err.message);
                }
            };
            reader.readAsText(file);
            jsonInput.value = '';
        });
    }

    // --- Realtime step log helper ---
    function appendLog(icon, text, status) {
        if (!stepLog) return;
        const row = document.createElement('div');
        row.className = `step-log-row step-log-${status || 'pending'}`;
        row.innerHTML = `<span class="step-log-icon">${icon}</span><span class="step-log-text">${text}</span>`;
        stepLog.appendChild(row);
        stepLog.scrollTop = stepLog.scrollHeight;
        return row;
    }

    function updateLog(row, icon, text, status) {
        if (!row) return;
        row.className = `step-log-row step-log-${status}`;
        row.innerHTML = `<span class="step-log-icon">${icon}</span><span class="step-log-text">${text}</span>`;
    }

    function showErrorState(message, isSetupError = false) {
        if (spinner) spinner.style.display = 'none';
        if (progressFill) progressFill.style.width = '100%';
        progressFill.style.background = '#ef4444';
        if (stepTitle) stepTitle.textContent = isSetupError ? 'Server Belum Aktif / Perlu Setup PC' : 'Proses Gagal';
        if (stepDesc) stepDesc.textContent = '';

        if (errorMsg) {
            if (isSetupError) {
                errorMsg.innerHTML = `
                    <div style="font-size: 13px; line-height: 1.5; color: #f87171; text-align: left; width: 100%;">
                        <strong style="color: #fca5a5; font-size: 14px; display: block; margin-bottom: 4px;">⚠️ Server Document Parser belum aktif & PC ini belum di-setup.</strong>
                        <p style="margin: 4px 0 8px 0; color: #cbd5e1; font-size: 12.5px;">Jika PC ini baru / belum pernah menjalankan server, silakan lakukan salah satu cara di bawah (cukup 1x saja):</p>
                        <div style="background: rgba(15, 23, 42, 0.7); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); margin-bottom: 10px;">
                            <div style="color: #38bdf8; font-weight: 600; font-size: 12.5px; margin-bottom: 4px;">📁 Opsi 1 (1-Klik Otomatis - Sangat Direkomendasikan):</div>
                            <div style="color: #cbd5e1; font-size: 12px; line-height: 1.4;">
                                Buka folder <b>Synthetic</b> di File Explorer lalu klik ganda file <b>SETUP_PC.bat</b>.<br>
                                Skrip ini otomatis mengatur <code>Set-ExecutionPolicy RemoteSigned</code>, menginstall modul (<code>npm install</code>), dan mendaftarkan auto-start agar tombol Start selanjutnya langsung menyalakan server otomatis!
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" id="btnCopySetupCmd" class="btn" style="background: #2563eb; color: #ffffff; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                📋 Salin Perintah Setup (PowerShell)
                            </button>
                            <button type="button" id="btnRetryConnect" class="btn" style="background: #059669; color: #ffffff; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                🔄 Coba Hubungkan Lagi
                            </button>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    const btnCopy = document.getElementById('btnCopySetupCmd');
                    if (btnCopy) {
                        btnCopy.onclick = () => {
                            const cmd = 'powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"; $targets = @(".\\SETUP_PC.bat", "..\\SETUP_PC.bat", "C:\\Synthetic\\SETUP_PC.bat", "D:\\Synthetic\\SETUP_PC.bat", "D:\\Synthetic\\Synthetic\\SETUP_PC.bat"); $p = $targets | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($p) { & $p } else { cd backend-service; npm start }';
                            navigator.clipboard.writeText(cmd).then(() => {
                                btnCopy.textContent = '✅ Berhasil Disalin ke Clipboard!';
                                setTimeout(() => {
                                    if (btnCopy) btnCopy.textContent = '📋 Salin Perintah Setup (PowerShell)';
                                }, 3000);
                            }).catch(() => {
                                prompt('Salin perintah berikut secara manual:', cmd);
                            });
                        };
                    }
                    const btnRetryConn = document.getElementById('btnRetryConnect');
                    if (btnRetryConn) {
                        btnRetryConn.onclick = () => {
                            if (errorBox) errorBox.style.display = 'none';
                            runScan();
                        };
                    }
                }, 50);
            } else {
                errorMsg.textContent = message || 'Terjadi kesalahan saat memproses dokumen.';
            }
        }

        if (errorBox) errorBox.style.display = 'flex';
        if (btnStart) {
            btnStart.disabled = false;
            btnStart.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start / Mulai Scan
            `;
        }
        isScanRunning = false;

        // Tampilkan baris input API key jika error terkait API key
        if (apiKeyRow) {
            const isKeyError = message && (
                message.includes('GEMINI_API_KEY') ||
                message.toLowerCase().includes('api key') ||
                message.includes('API_KEY')
            );
            if (isKeyError) {
                apiKeyRow.style.display = 'flex';
                if (apiKeyInput) {
                    apiKeyInput.value = localStorage.getItem('CEISA_GEMINI_API_KEY') || '';
                    apiKeyInput.focus();
                }
            } else {
                apiKeyRow.style.display = 'none';
            }
        }
    }

    // Cek dan nyalakan backend server secara otomatis jika belum aktif
    async function ensureBackendReady(connectRow) {
        // 1. Cek langsung apakah server sudah online
        try {
            const test = await fetch('http://localhost:5005/api/status', {
                method: 'GET',
                signal: AbortSignal.timeout(1500)
            });
            if (test.ok) return { ok: true };
        } catch (_) {}

        // 2. Jika offline, minta ekstensi menyalakan server di latar belakang via Native Messaging
        if (connectRow) {
            updateLog(connectRow, '⏳', 'Server belum aktif. Mencoba menyalakan server Document Parser otomatis...', 'running');
        }

        const nativeResult = await new Promise((resolve) => {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                return resolve({ ok: false, needSetup: true, error: 'Chrome extension runtime tidak ditemukan.' });
            }
            chrome.runtime.sendMessage({ type: 'START_BACKEND_SERVER' }, (res) => {
                if (chrome.runtime.lastError || !res || !res.ok) {
                    const err = (chrome.runtime.lastError && chrome.runtime.lastError.message) || (res && res.error) || 'Host belum terdaftar';
                    return resolve({ ok: false, needSetup: true, error: err });
                }
                resolve({ ok: true, data: res.data });
            });
        });

        // 3. Polling server port 5005 sampai aktif (maksimal 20 detik)
        if (nativeResult.ok) {
            if (connectRow) {
                updateLog(connectRow, '⏳', 'Server sedang booting & memuat modul di latar belakang...', 'running');
            }
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 600));
                try {
                    const ping = await fetch('http://localhost:5005/api/status', {
                        method: 'GET',
                        signal: AbortSignal.timeout(1000)
                    });
                    if (ping.ok) {
                        return { ok: true };
                    }
                } catch (_) {}
            }
            return { ok: false, needSetup: false, error: 'Server memakan waktu terlalu lama untuk menyala (timeout 18 detik).' };
        }

        return nativeResult;
    }

    // Handler simpan API key inline
    if (btnSaveGeminiKey && apiKeyInput) {
        btnSaveGeminiKey.addEventListener('click', async () => {
            const key = apiKeyInput.value.trim();
            if (!key) {
                alert('Silakan ketikkan Gemini API Key Anda.');
                return;
            }
            btnSaveGeminiKey.disabled = true;
            btnSaveGeminiKey.textContent = 'Menyimpan...';
            try {
                localStorage.setItem('CEISA_GEMINI_API_KEY', key);
                await fetch('http://localhost:5005/api/config-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: key })
                });
                if (apiKeyRow) apiKeyRow.style.display = 'none';
                if (errorBox) errorBox.style.display = 'none';
                runScan();
            } catch (e) {
                alert('Gagal menyimpan key ke server: ' + e.message);
            } finally {
                btnSaveGeminiKey.disabled = false;
                btnSaveGeminiKey.textContent = 'Simpan & Ulangi';
            }
        });
    }

    async function runScan() {
        if (isScanRunning) return;

        if (!selectedFiles || selectedFiles.length === 0) {
            showErrorState('Silakan seret atau pilih minimal 1 berkas dokumen PDF (Invoice, Packing List, atau B/L) terlebih dahulu.');
            return;
        }

        isScanRunning = true;
        updateFloatingProgress(5, 'Menghubungkan Server...', 'Memeriksa status port 5005', 'running');

        // Reset UI progress
        if (stepLog) stepLog.innerHTML = '';
        if (errorBox) errorBox.style.display = 'none';
        if (apiKeyRow) apiKeyRow.style.display = 'none';
        if (progressFill) { progressFill.style.background = ''; progressFill.style.width = '5%'; }
        if (spinner) spinner.style.display = '';
        if (progressBox) progressBox.style.display = 'flex';
        if (btnStart) {
            btnStart.disabled = true;
            btnStart.innerHTML = `
                <span class="doc-spinner" style="width:13px; height:13px; border-width:2px; border-top-color:#fff; display:inline-block; vertical-align:middle; margin-right:4px;"></span>
                Memproses...
            `;
        }

        const connectRow = appendLog('⏳', 'Menghubungkan ke Node Document Parser (http://localhost:5005)...', 'running');

        try {
            // Pastikan server sudah aktif atau nyalakan secara otomatis
            const readyState = await ensureBackendReady(connectRow);
            if (!readyState.ok) {
                const err = new Error(readyState.error || 'Server backend tidak dapat dihubungi.');
                err.isSetupError = !!readyState.needSetup;
                throw err;
            }

            const activeModule = sessionStorage.getItem('ceisa_active_portal_module') || 'peb';
            const customsMode = (activeModule === 'pib') ? 'impor' : 'ekspor';

            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append('files', file);
            });
            formData.append('mode', customsMode);

            const customKey = localStorage.getItem('CEISA_GEMINI_API_KEY') || '';
            const headers = {};
            if (customKey) headers['x-gemini-key'] = customKey;
            headers['x-customs-mode'] = customsMode;

            let response;
            try {
                response = await fetch('http://localhost:5005/api/parse-documents', {
                    method: 'POST',
                    headers: headers,
                    body: formData
                });
            } catch (netErr) {
                const err = new Error('Gagal terhubung ke Backend Document Parser di http://localhost:5005.');
                err.isSetupError = true;
                throw err;
            }

            if (!response.ok && response.status !== 200) {
                throw new Error(`Server Document Parser mengembalikan status HTTP ${response.status}`);
            }

            updateLog(connectRow, '✅', 'Terhubung ke Backend Document Parser', 'done');
            if (progressFill) progressFill.style.width = '15%';
            updateFloatingProgress(15, 'Terhubung ke Backend', 'Menyiapkan berkas dokumen...', 'running');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let extractedResult = null;
            const uploadLogMap = {};
            let lastAiRow = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop();

                for (const part of parts) {
                    const trimmed = part.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const jsonStr = trimmed.replace(/^data:\s*/, '');

                    try {
                        const evt = JSON.parse(jsonStr);

                        if (evt.type === 'error') {
                            throw new Error(evt.message || 'Ekstraksi dokumen gagal di server.');
                        }

                        if (evt.type === 'progress') {
                            if (evt.step === 'upload') {
                                const fileKey = evt.file || `file-${evt.index}`;
                                if (evt.status === 'running') {
                                    if (!uploadLogMap[fileKey]) {
                                        uploadLogMap[fileKey] = appendLog('⏳', evt.message, 'running');
                                    }
                                    if (stepTitle) stepTitle.textContent = `Mengunggah: ${fileKey}...`;
                                    if (stepDesc) stepDesc.textContent = `File ${evt.index + 1} dari ${evt.total}`;
                                    const pct = 15 + Math.round(((evt.index + 0.5) / evt.total) * 25);
                                    if (progressFill) progressFill.style.width = `${pct}%`;
                                    updateFloatingProgress(pct, `Mengunggah: ${fileKey}...`, `File ${evt.index + 1} dari ${evt.total}`, 'running');
                                } else if (evt.status === 'done') {
                                    if (uploadLogMap[fileKey]) {
                                        updateLog(uploadLogMap[fileKey], '✅', evt.message, 'done');
                                    } else {
                                        uploadLogMap[fileKey] = appendLog('✅', evt.message, 'done');
                                    }
                                    const pct = 15 + Math.round(((evt.index + 1) / evt.total) * 25);
                                    if (progressFill) progressFill.style.width = `${pct}%`;
                                    updateFloatingProgress(pct, 'Unggah Berkas Selesai', evt.message || `${evt.index + 1}/${evt.total} terunggah`, 'running');
                                }
                            } else if (evt.step === 'parsing') {
                                if (stepTitle) stepTitle.textContent = 'Menyiapkan Ray-OCR V.1...';
                                if (stepDesc) stepDesc.textContent = evt.message;
                                if (progressFill) progressFill.style.width = '45%';
                                appendLog('⏳', evt.message, 'running');
                                updateFloatingProgress(45, 'Menyiapkan Ray-OCR V.1...', evt.message || 'Ekstraksi teks & struktur', 'running');
                            } else if (evt.step === 'ai') {
                                if (stepTitle) stepTitle.textContent = 'Ray-OCR V.1 Menganalisis Dokumen...';
                                if (stepDesc) stepDesc.textContent = evt.message;
                                if (progressFill) progressFill.style.width = '70%';
                                if (!lastAiRow) {
                                    lastAiRow = appendLog('🤖', evt.message, 'running');
                                } else {
                                    updateLog(lastAiRow, '🤖', evt.message, 'running');
                                }
                                updateFloatingProgress(70, 'Ray-OCR V.1 Menganalisis Dokumen...', evt.message || 'AI mengenali entitas pabean', 'running');
                            } else if (evt.step === 'safecheck') {
                                if (lastAiRow) {
                                    updateLog(lastAiRow, '✅', 'Data pabean berhasil dianalisis oleh Ray-OCR V.1', 'done');
                                }
                                if (stepTitle) stepTitle.textContent = 'SafeCheck & Validasi Shipment...';
                                if (stepDesc) stepDesc.textContent = evt.message;
                                if (progressFill) progressFill.style.width = '88%';
                                appendLog('🛡️', evt.message, 'done');
                                updateFloatingProgress(88, 'SafeCheck & Validasi Shipment...', evt.message || 'Memverifikasi nomor, nilai, tanggal', 'running');
                            } else if (evt.step === 'complete') {
                                if (progressFill) progressFill.style.width = '96%';
                                appendLog('✅', evt.message, 'done');
                                updateFloatingProgress(96, 'Menyelesaikan Pemindaian...', evt.message || 'Menyiapkan draft PEB', 'running');
                            }
                        }

                        if (evt.type === 'result') {
                            extractedResult = evt.data;
                        }
                    } catch (parseErr) {
                        if (parseErr.message && !parseErr.message.includes('JSON')) {
                            throw parseErr;
                        }
                    }
                }
            }

            if (!extractedResult) {
                throw new Error('Tidak menerima payload data hasil ekstraksi dari Document Parser.');
            }

            if (progressFill) progressFill.style.width = '100%';
            if (stepTitle) stepTitle.textContent = '✅ Ekstraksi & Validasi Selesai (Ray-OCR V.1)!';
            const activeFileText = selectedFiles.length > 0 ? selectedFiles[0].name : 'Dokumen';
            if (stepDesc) stepDesc.textContent = `${activeFileText} • SafeCheck Tervalidasi 1 Kesatuan Shipment`;
            if (spinner) spinner.style.display = 'none';

            // MINIMIZE DENGAN ANIMASI:
            // Sembunyikan dropzone agar SafeCheck naik ke atas, TETAP tampilkan berkas terlampir
            if (dropzone) dropzone.classList.add('collapsed');
            if (filesWrapper) {
                filesWrapper.classList.remove('collapsed');
                filesWrapper.style.display = 'block';
            }
            renderFileList(true);

            // Minimize box loading progress menjadi status pill ringkas
            if (progressBox) progressBox.classList.add('minimized');
            if (parserMinimizedActions) parserMinimizedActions.style.display = 'flex';
            if (stepLog) stepLog.classList.remove('expanded');

            // Update label nama file aktif di header PEB
            const lbl = document.getElementById('lblFileName');
            if (lbl && selectedFiles.length > 0) {
                lbl.textContent = selectedFiles[0].name;
                try { localStorage.setItem(STORAGE_KEY_LAST_FILENAME, selectedFiles[0].name); } catch (e) {}
            }

            // LOAD DATA HASIL EKSTRAKSI ASLI KE FORMULIR PEB / PIB (latar belakang)
            if (activeModule === 'pib' && typeof loadPibDraftData === 'function') {
                loadPibDraftData(extractedResult, true);
                const lblPib = document.getElementById('lblPibFileName');
                if (lblPib && selectedFiles.length > 0) {
                    lblPib.textContent = selectedFiles[0].name;
                }
            } else {
                loadDraftData(extractedResult, true);
            }

            // TAMPILKAN DAN NAIKKAN HASIL SAFECHECK KE ATAS DENGAN ANIMASI SLIDE UP
            renderModalSafeCheck(extractedResult.safeCheck);

            // Sembunyikan tombol Start, tampilkan tombol Lanjutkan ke Formulir PEB
            if (btnStart) btnStart.style.display = 'none';
            if (btnContinue) btnContinue.style.display = 'inline-flex';

            // Update floating progress ke completed
            updateFloatingProgress(100, '✅ Ekstraksi Selesai!', `${activeFileText} • SafeCheck Tervalidasi`, 'completed');

            // Jika modal sedang ditutup user, beri notifikasi toast dan tampilkan widget
            if (modal.style.display === 'none') {
                showFloatingWidget();
                showToast("✅ Pemindaian selesai! Klik widget di kanan bawah untuk membuka formulir.", "success");
            } else {
                hideFloatingWidget();
            }

        } catch (err) {
            showErrorState(err?.message || 'Gagal memproses dokumen.', !!err?.isSetupError);
            updateFloatingProgress(100, '❌ Pemindaian Gagal', err?.message || 'Gagal memproses dokumen.', 'error');
            if (modal.style.display === 'none') {
                showFloatingWidget();
                showToast("⚠️ Pemindaian dokumen gagal. Klik widget untuk melihat detail.", "error");
            }
        } finally {
            isScanRunning = false;
        }
    }

    // Fungsi Render SafeCheck khusus di dalam popup modal
    function renderModalSafeCheck(safeCheck) {
        if (!modalSafeCheckContainer) return;
        if (!safeCheck) {
            modalSafeCheckContainer.style.display = 'none';
            return;
        }

        const isRelated = safeCheck.isRelated !== false;
        const score = safeCheck.confidenceScore !== undefined ? safeCheck.confidenceScore : 100;
        const banner = document.getElementById('modalSafeCheckBanner');
        const statusBadge = document.getElementById('modalSafeCheckStatusBadge');
        const scoreVal = document.getElementById('modalSafeCheckScore');
        const title = document.getElementById('modalSafeCheckTitle');
        const summary = document.getElementById('modalSafeCheckSummary');
        const matchedList = document.getElementById('modalSafeCheckMatchedList');
        const warningsBox = document.getElementById('modalSafeCheckWarningsBox');
        const warningsList = document.getElementById('modalSafeCheckWarningsList');

        if (scoreVal) scoreVal.textContent = score + '%';
        if (summary) summary.textContent = safeCheck.summary || 'Semua dokumen saling berhubungan dan merupakan satu kesatuan shipment yang sama.';

        if (banner && statusBadge && title) {
            if (isRelated) {
                banner.className = 'modal-safecheck-banner';
                statusBadge.className = 'badge-safe-valid';
                statusBadge.textContent = 'Tervalidasi: 1 Shipment';
                title.textContent = 'Semua Dokumen Cocok & Terverifikasi 1 Kesatuan Pengiriman';
            } else {
                banner.className = 'modal-safecheck-banner safecheck-banner-warning';
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
                    li.className = 'modal-safecheck-item';
                    li.innerHTML = `<span class="modal-safecheck-check-icon">✓</span><span class="modal-safecheck-item-text">${escapeHtml(m)}</span>`;
                    matchedList.appendChild(li);
                });
            } else {
                matchedList.innerHTML = `<li class="modal-safecheck-empty">Tidak ada parameter identifikasi khusus.</li>`;
            }
        }

        if (warningsBox && warningsList) {
            const warnings = safeCheck.discrepanciesOrWarnings || [];
            if (warnings && warnings.length > 0) {
                warningsBox.style.display = 'block';
                warningsList.innerHTML = '';
                warnings.forEach(w => {
                    const li = document.createElement('li');
                    li.className = 'modal-safecheck-warning-item';
                    li.innerHTML = `<span class="modal-safecheck-warn-icon">⚠</span><span class="modal-safecheck-warning-text">${escapeHtml(w)}</span>`;
                    warningsList.appendChild(li);
                });
            } else {
                warningsBox.style.display = 'none';
            }
        }

        modalSafeCheckContainer.classList.remove('animate-slide-up');
        void modalSafeCheckContainer.offsetWidth;
        modalSafeCheckContainer.classList.add('animate-slide-up');
        modalSafeCheckContainer.style.display = 'block';

        const modalBody = modal.querySelector('.doc-parser-modal-body');
        if (modalBody) {
            modalBody.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // Handler tombol Lanjutkan ke Formulir (PEB / PIB sesuai modul aktif)
    if (btnContinue) {
        btnContinue.addEventListener('click', () => {
            hideFloatingWidget();
            closeModal();

            const activeModule = sessionStorage.getItem('ceisa_active_portal_module') || 'peb';
            if (activeModule === 'pib') {
                switchPortalModule('pib');
                if (typeof switchPibTab === 'function') switchPibTab('pib-tab-dokumen');
                showToast("Draft PIB siap ditinjau!", "success");
            } else {
                switchPortalModule('peb');
                switchCeisaTab('tab-dokumen');

                const safeCheckBody = document.getElementById('safeCheckBody');
                const btnToggleSafeCheck = document.getElementById('btnToggleSafeCheck');
                const safeCheckHeader = document.getElementById('safeCheckHeader');
                if (safeCheckBody) {
                    safeCheckBody.classList.remove('collapsed');
                    safeCheckBody.style.display = 'block';
                }
                if (btnToggleSafeCheck) {
                    btnToggleSafeCheck.classList.add('expanded');
                    btnToggleSafeCheck.setAttribute('aria-expanded', 'true');
                }
                if (safeCheckHeader) safeCheckHeader.classList.add('expanded');

                setTimeout(() => {
                    const safeCheckSection = document.getElementById('safeCheckSection');
                    if (safeCheckSection) safeCheckSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
                showToast("Draft PEB siap ditinjau!", "success");
            }
        });
    }

    // Start / Mulai Scan
    if (btnStart) btnStart.addEventListener('click', runScan);

    // Retry
    if (btnRetry) btnRetry.addEventListener('click', runScan);
}

// ====================================================================
// INITIALIZATION ON DOM CONTENT LOADED (CSP COMPLIANT EVENT WIRING)
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. CEISA 4.0 Left Sidebar Module Switcher Listeners
    const btnNavPeb = document.getElementById('btnNavPeb');
    const btnNavPib = document.getElementById('btnNavPib');
    const btnNavInspector = document.getElementById('btnNavInspector');
    if (btnNavPeb && btnNavPeb.tagName !== 'A') btnNavPeb.addEventListener('click', () => switchPortalModule('peb'));
    if (btnNavPib && btnNavPib.tagName !== 'A') btnNavPib.addEventListener('click', () => switchPortalModule('pib'));
    if (btnNavInspector && btnNavInspector.tagName !== 'A') btnNavInspector.addEventListener('click', () => switchPortalModule('inspector'));

    // 1.1 CEISA 4.0 Sidebar Hover & Toggle (Otomatis terbuka saat kursor hover)
    const sidebarToggle = document.getElementById('ceisaSidebarToggle');
    const sidebar = document.getElementById('ceisaSidebar');
    if (sidebar) {
        sidebar.addEventListener('mouseenter', () => {
            sidebar.classList.add('expanded');
            if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
        });

        sidebar.addEventListener('mouseleave', () => {
            sidebar.classList.remove('expanded');
            if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
        });

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('expanded');
                const isExpanded = sidebar.classList.contains('expanded');
                sidebarToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            });
        }
    }

    // 2. Tentukan modul awal sesuai halaman yang aktif
    try {
        const hasPib = !!document.getElementById('module-pib');
        const hasPeb = !!document.getElementById('module-peb');
        const hasInspector = !!document.getElementById('module-inspector');

        let initialModule = 'peb';
        if (hasPib && !hasPeb) {
            initialModule = 'pib';
        } else if (hasPeb && !hasInspector) {
            initialModule = 'peb';
        } else if (hasInspector && !hasPeb && !hasPib) {
            initialModule = 'inspector';
        } else {
            initialModule = sessionStorage.getItem('ceisa_active_portal_module') || 'inspector';
        }
        sessionStorage.setItem('ceisa_active_portal_module', initialModule);
        switchPortalModule(initialModule);
    } catch (e) {
        if (document.getElementById('module-peb')) switchPortalModule('peb');
    }

    // 3. PEB Header Action Buttons
    const btnUpload = document.getElementById('btnHeaderUploadJson');
    const headerInput = document.getElementById('headerJsonFileInput');
    if (btnUpload && headerInput) {
        btnUpload.addEventListener('click', () => headerInput.click());
    }

    // 3.1 Dokumen Baru & Document Parser Modal
    initDocumentParserModal();

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

    // 4.1 Tambah & Urutkan Dokumen Lampiran
    const btnAddDoc = document.getElementById('btnAddDoc');
    if (btnAddDoc) {
        btnAddDoc.addEventListener('click', addNewDocRow);
    }

    const btnSortDoc = document.getElementById('btnSortDoc');
    if (btnSortDoc) {
        btnSortDoc.addEventListener('click', () => {
            const tbody = document.getElementById('ceisaDocTableBody') || document.querySelector('#tab-dokumen .ceisa-table tbody');
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const orderScore = (row) => {
                const text = row.textContent || '';
                if (text.includes('705') || text.includes('B/L') || text.includes('LADING')) return 1;
                if (text.includes('380') || text.includes('INVOICE')) return 2;
                if (text.includes('217') || text.includes('PACKING')) return 3;
                if (text.includes('861') || text.includes('ORIGIN')) return 4;
                return 5;
            };
            rows.sort((a, b) => orderScore(a) - orderScore(b));
            rows.forEach(r => tbody.appendChild(r));
            updateDocTableIndices();
            showToast("Tabel dokumen lampiran telah diurutkan.", "info");
        });
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
            const blNum = document.getElementById('blNumber')?.value || '';
            const blDate = document.getElementById('blDate')?.value || '';
            const defaultBlName = blNum ? `BL.${blNum}.pdf` : 'BL BAPSIN0153818 PT VALEO AC-RBB47.pdf';
            openCeisaDocViewer({
                docType: '705 - BILL OF LADING (OCEAN B/L)',
                fileName: window._currentDocMap?.BILL_OF_LADING || defaultBlName,
                docNumber: blNum || 'BAPSIN0153818',
                docDate: blDate || '11/09/2026'
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

    // 11. Restore PEB draft or load sample (hanya jika #module-peb ada)
    if (document.getElementById('module-peb')) {
        const hasRestored = restoreDraftState();
        if (!hasRestored) {
            loadDraftData(SAMPLE_DATA, false);
        }

        // 12. Initialize 9-Tab Stepper State
        switchCeisaTab('tab-header');
    }
});
