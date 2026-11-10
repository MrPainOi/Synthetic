/**
 * CEISA 4.0 - Print Hub Client Logic (print_hub.js)
 * High-performance, responsive local & mobile printing system.
 */

(function () {
    'use strict';

    // Helper resolver URL backend dinamis (kompatibel file://, localhost, IP LAN WiFi HP)
    function getBackendUrl(path = '') {
        if (typeof window.getCeisaBackendUrl === 'function') {
            return window.getCeisaBackendUrl(path);
        }
        let base = 'http://localhost:5005';
        try {
            if (typeof window !== 'undefined' && window.location) {
                if (window.location.protocol.startsWith('http')) {
                    const host = window.location.hostname;
                    const port = window.location.port ? `:${window.location.port}` : ':5005';
                    base = `${window.location.protocol}//${host}${port}`;
                } else {
                    // Protocol file:/// atau sejenisnya
                    base = 'http://localhost:5005';
                }
            }
        } catch (_) {}
        if (path) {
            if (!path.startsWith('/')) path = '/' + path;
            return `${base}${path}`;
        }
        return base;
    }

    // State
    const state = {
        printers: [],
        defaultPrinter: null,
        selectedPrinter: null,
        selectedFile: null,
        selectedFileBase64: null,
        activeTab: 'tab-file',
        pollInterval: null,
        activeJobPolling: {}
    };

    // DOM Elements
    const elements = {
        // Status & Header
        serverStatusChip: document.getElementById('serverStatusChip'),
        serverStatusText: document.getElementById('serverStatusText'),

        // Printers
        printerSelect: document.getElementById('printerSelect'),
        printerCountChip: document.getElementById('printerCountChip'),
        btnReloadPrinters: document.getElementById('btnReloadPrinters'),
        printerMetaBar: document.getElementById('printerMetaBar'),
        dotMatrixBanner: document.getElementById('dotMatrixBanner'),

        // Tabs
        tabsNav: document.querySelectorAll('.ph-tab-btn'),
        tabPanes: document.querySelectorAll('.ph-tab-pane'),

        // File Form
        filePrintForm: document.getElementById('filePrintForm'),
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('fileInput'),
        filePreview: document.getElementById('filePreview'),
        fileNamePreview: document.getElementById('fileNamePreview'),
        fileSizePreview: document.getElementById('fileSizePreview'),
        btnRemoveFile: document.getElementById('btnRemoveFile'),
        fileCopies: document.getElementById('fileCopies'),
        paperSizeSelect: document.getElementById('paperSizeSelect'),
        pageRangeInput: document.getElementById('pageRangeInput'),
        fileModeSelect: document.getElementById('fileModeSelect'),
        btnSubmitFile: document.getElementById('btnSubmitFile'),
        btnSubmitFileLabel: document.getElementById('btnSubmitFileLabel'),

        // Text Form
        textPrintForm: document.getElementById('textPrintForm'),
        rawTextArea: document.getElementById('rawTextArea'),
        rawModeToggle: document.getElementById('rawModeToggle'),
        ejectPageToggle: document.getElementById('ejectPageToggle'),
        btnSubmitText: document.getElementById('btnSubmitText'),
        btnSubmitTextLabel: document.getElementById('btnSubmitTextLabel'),
        tplSuratJalan: document.getElementById('tplSuratJalan'),
        tplInvoice: document.getElementById('tplInvoice'),
        tplSppb: document.getElementById('tplSppb'),
        tplLqTest: document.getElementById('tplLqTest'),
        btnClearText: document.getElementById('btnClearText'),

        // Spooler & History
        spoolerList: document.getElementById('spoolerList'),
        historyList: document.getElementById('historyList'),
        btnRefreshQueue: document.getElementById('btnRefreshQueue'),
        btnClearHistory: document.getElementById('btnClearHistory'),


        // Toast Container
        toastContainer: document.getElementById('toastContainer'),

        // Sidebar
        ceisaSidebar: document.getElementById('ceisaSidebar'),
        ceisaSidebarToggle: document.getElementById('ceisaSidebarToggle'),
        themeToggleBtn: document.getElementById('themeToggleBtn')
    };

    // Helpers
    function showToast(message, type = 'info') {
        if (!elements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'ph-toast';
        
        let icon = 'ℹ️';
        let borderColor = 'var(--border-color)';
        if (type === 'success') {
            icon = '✅';
            borderColor = '#10b981';
        } else if (type === 'error') {
            icon = '⚠️';
            borderColor = '#ef4444';
        } else if (type === 'loading') {
            icon = '⏳';
            borderColor = '#0284c7';
        }

        toast.style.borderLeft = `4px solid ${borderColor}`;
        toast.innerHTML = `
            <span style="font-size: 16px;">${icon}</span>
            <div style="flex: 1; word-break: break-word;">${message}</div>
        `;

        elements.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 4500);
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const res = reader.result;
                const base64 = res.substring(res.indexOf(',') + 1);
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    // API Calls
    async function fetchServerStatus() {
        try {
            const res = await fetch(getBackendUrl('/api/print/status'));
            const data = await res.json();
            if (data.success) {
                if (elements.serverStatusChip) elements.serverStatusChip.className = 'ph-chip ph-chip-green';
                if (elements.serverStatusText) elements.serverStatusText.textContent = `Server Aktif (Port ${data.port})`;
            }
        } catch (err) {
            if (elements.serverStatusChip) elements.serverStatusChip.className = 'ph-chip ph-chip-orange';
            if (elements.serverStatusText) elements.serverStatusText.textContent = 'Server Offline (Port 5005)';
        }
    }

    async function fetchPrinters() {
        try {
            elements.printerCountChip.textContent = 'Memeriksa...';
            elements.printerCountChip.className = 'ph-chip';

            const res = await fetch(getBackendUrl('/api/print/printers'));
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Gagal memuat printer');

            state.printers = data.printers || [];
            state.defaultPrinter = data.defaultPrinter;

            renderPrinterSelect();
        } catch (err) {
            elements.printerSelect.innerHTML = `<option value="">⚠️ Gagal terhubung ke backend server (Port 5005). Pastikan START_SERVER.bat sudah berjalan.</option>`;
            elements.printerCountChip.textContent = 'Server Offline';
            elements.printerCountChip.className = 'ph-chip ph-chip-orange';
            elements.serverStatusChip.className = 'ph-chip ph-chip-orange';
            elements.serverStatusText.textContent = 'Server Offline (Port 5005)';
            console.error('Fetch printers error:', err);
        }
    }

    function renderPrinterSelect() {
        elements.printerSelect.innerHTML = '';
        if (state.printers.length === 0) {
            elements.printerSelect.innerHTML = '<option value="">Tidak ada printer Windows yang terpasang</option>';
            elements.printerCountChip.textContent = '0 Printer';
            return;
        }

        elements.printerCountChip.className = 'ph-chip ph-chip-green';
        elements.printerCountChip.textContent = `${state.printers.length} Printer Terdeteksi`;

        const savedPrinter = localStorage.getItem('synthetic_last_printer');
        let matched = false;

        state.printers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = `${p.name} ${p.isDefault ? '★ (Default)' : ''}`;
            if (savedPrinter && p.name === savedPrinter) {
                opt.selected = true;
                matched = true;
            } else if (!savedPrinter && p.name === state.defaultPrinter) {
                opt.selected = true;
                matched = true;
            }
            elements.printerSelect.appendChild(opt);
        });

        if (!matched && state.printers.length > 0) {
            elements.printerSelect.selectedIndex = 0;
        }

        onPrinterChange();
    }

    function onPrinterChange() {
        const selectedName = elements.printerSelect.value;
        state.selectedPrinter = state.printers.find(p => p.name === selectedName) || null;

        if (state.selectedPrinter) {
            localStorage.setItem('synthetic_last_printer', state.selectedPrinter.name);
            renderPrinterMeta(state.selectedPrinter);
        }
    }

    function renderPrinterMeta(p) {
        elements.printerMetaBar.innerHTML = '';

        // Port pill
        const portPill = document.createElement('span');
        portPill.className = 'ph-chip';
        portPill.innerHTML = `🔌 Port: <strong>${p.portName || 'N/A'}</strong>`;
        elements.printerMetaBar.appendChild(portPill);

        // Driver pill
        const driverPill = document.createElement('span');
        driverPill.className = 'ph-chip';
        driverPill.innerHTML = `🖨️ Driver: ${p.driverName || 'Generic'}`;
        elements.printerMetaBar.appendChild(driverPill);

        // Status pill
        const statusPill = document.createElement('span');
        statusPill.className = 'ph-chip ph-chip-green';
        statusPill.textContent = `Status: ${p.status || 'Normal'}`;
        elements.printerMetaBar.appendChild(statusPill);

        // Dot matrix banner & auto-configuration
        if (p.isDotMatrix) {
            elements.dotMatrixBanner.style.display = 'flex';
            elements.fileModeSelect.value = 'true';
            elements.paperSizeSelect.value = 'Fanfold';
            elements.rawModeToggle.checked = true;
        } else {
            elements.dotMatrixBanner.style.display = 'none';
            elements.fileModeSelect.value = 'false';
            elements.paperSizeSelect.value = 'auto';
            elements.rawModeToggle.checked = false;
        }
    }

    async function fetchQueue() {
        try {
            const res = await fetch(getBackendUrl('/api/print/queue'));
            const data = await res.json();
            if (data.success) {
                renderSpooler(data.queue || []);
                renderHistory(data.history || []);
            }
        } catch (err) {
            console.warn('Gagal memuat antrean:', err.message);
        }
    }

    function renderSpooler(jobs) {
        if (!jobs || jobs.length === 0) {
            elements.spoolerList.innerHTML = `
                <div style="text-align: center; padding: 24px 0; color: var(--text-muted); font-size: 12.5px;">
                    Tidak ada dokumen dalam antrean spooler Windows.
                </div>
            `;
            return;
        }

        elements.spoolerList.innerHTML = jobs.map(j => `
            <div class="ph-job-item">
                <div>
                    <span class="ph-job-title">${escapeHtml(j.DocumentName || 'Dokumen')}</span>
                    <span class="ph-job-sub">${escapeHtml(j.PrinterName || '')} &bull; ${j.TotalPages || 1} Halaman</span>
                </div>
                <span class="ph-badge-status ph-badge-pending">${escapeHtml(j.JobStatus || 'Mencetak...')}</span>
            </div>
        `).join('');
    }

    function renderHistory(history) {
        if (!history || history.length === 0) {
            elements.historyList.innerHTML = `
                <div style="text-align: center; padding: 24px 0; color: var(--text-muted); font-size: 12.5px;">
                    Belum ada berkas yang dicetak pada sesi ini.
                </div>
            `;
            return;
        }

        elements.historyList.innerHTML = history.map(h => {
            let badgeClass = 'ph-badge-pending';
            if (h.status === 'Berhasil Dicetak') badgeClass = 'ph-badge-success';
            else if (h.status === 'Gagal') badgeClass = 'ph-badge-error';

            const timeStr = h.timestamp ? new Date(h.timestamp).toLocaleTimeString('id-ID') : '';

            return `
                <div class="ph-job-item">
                    <div>
                        <span class="ph-job-title">${escapeHtml(h.filename)}</span>
                        <span class="ph-job-sub">${escapeHtml(h.printer)} &bull; ${formatBytes(h.size)} &bull; ${timeStr}</span>
                        ${h.error ? `<div style="font-size: 11px; color: #ef4444; margin-top: 2px;">${escapeHtml(h.error)}</div>` : ''}
                    </div>
                    <span class="ph-badge-status ${badgeClass}">${escapeHtml(h.status)}</span>
                </div>
            `;
        }).join('');
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Polling print job status
    function pollJobStatus(jobId, filename) {
        if (state.activeJobPolling[jobId]) return;
        state.activeJobPolling[jobId] = true;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(getBackendUrl(`/api/print/job/${jobId}`));
                const data = await res.json();
                if (data.success && data.job) {
                    const status = data.job.status;
                    if (status === 'Berhasil Dicetak') {
                        clearInterval(interval);
                        delete state.activeJobPolling[jobId];
                        showToast(`Dokumen "${filename}" selesai dicetak!`, 'success');
                        fetchQueue();
                    } else if (status === 'Gagal') {
                        clearInterval(interval);
                        delete state.activeJobPolling[jobId];
                        showToast(`Cetak gagal: ${data.job.error || 'Spooler error'}`, 'error');
                        fetchQueue();
                    }
                }
            } catch (e) {
                // Ignore transient network errors
            }
        }, 1500);

        // Max poll timeout: 60s
        setTimeout(() => {
            clearInterval(interval);
            delete state.activeJobPolling[jobId];
        }, 60000);
    }

    // Tab Switching
    function switchTab(tabId) {
        state.activeTab = tabId;
        elements.tabsNav.forEach(btn => {
            const active = btn.getAttribute('data-tab') === tabId;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        elements.tabPanes.forEach(pane => {
            pane.style.display = (pane.id === tabId) ? 'block' : 'none';
        });
    }

    // File Drag & Drop Handling
    function handleSelectedFile(file) {
        if (!file) return;

        state.selectedFile = file;
        elements.fileNamePreview.textContent = file.name;
        elements.fileSizePreview.textContent = formatBytes(file.size);
        elements.filePreview.classList.add('active');
        elements.dropzone.style.display = 'none';
        elements.btnSubmitFile.disabled = false;

        // Auto detect RAW if file is .txt
        if (file.name.toLowerCase().endsWith('.txt')) {
            elements.fileModeSelect.value = 'true';
        }

        // Convert to Base64 in background immediately for bulletproof mobile upload
        fileToBase64(file).then(base64 => {
            state.selectedFileBase64 = base64;
        }).catch(err => {
            console.error('Base64 convert error:', err);
        });
    }

    function removeSelectedFile() {
        state.selectedFile = null;
        state.selectedFileBase64 = null;
        elements.fileInput.value = '';
        elements.filePreview.classList.remove('active');
        elements.dropzone.style.display = 'block';
        elements.btnSubmitFile.disabled = true;
    }

    // Form Submissions
    async function submitFilePrint(e) {
        e.preventDefault();
        if (!state.selectedFile) {
            showToast('Silakan pilih berkas dokumen terlebih dahulu.', 'error');
            return;
        }

        const printerName = elements.printerSelect.value;
        if (!printerName) {
            showToast('Silakan pilih printer tujuan.', 'error');
            return;
        }

        const copies = parseInt(elements.fileCopies.value, 10) || 1;
        const paperSize = elements.paperSizeSelect.value;
        const pageRange = elements.pageRangeInput.value.trim();
        const isRaw = elements.fileModeSelect.value === 'true';

        elements.btnSubmitFile.disabled = true;
        elements.btnSubmitFileLabel.textContent = 'MENGIRIM KE SPOOLER...';

        try {
            // Ensure base64 is ready
            let base64 = state.selectedFileBase64;
            if (!base64) {
                base64 = await fileToBase64(state.selectedFile);
            }

            const payload = {
                filename: state.selectedFile.name,
                printer: printerName,
                base64Data: base64,
                copies,
                paperSize,
                pageRange,
                isRaw
            };

            const res = await fetch(getBackendUrl('/api/print/base64'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Gagal mengirim berkas ke printer');

            showToast(`Berkas dikirim ke ${printerName}. Sedang dicetak...`, 'loading');
            pollJobStatus(data.jobId, state.selectedFile.name);
            fetchQueue();

            // Clear file selection
            removeSelectedFile();
        } catch (err) {
            showToast('Gagal mencetak berkas: ' + err.message, 'error');
        } finally {
            elements.btnSubmitFileLabel.textContent = 'KIRIM DOKUMEN KE PRINTER';
            elements.btnSubmitFile.disabled = !state.selectedFile;
        }
    }

    async function submitTextPrint(e) {
        e.preventDefault();
        const text = elements.rawTextArea.value.trim();
        if (!text) {
            showToast('Teks faktur / surat jalan tidak boleh kosong.', 'error');
            return;
        }

        const printerName = elements.printerSelect.value;
        if (!printerName) {
            showToast('Silakan pilih printer tujuan.', 'error');
            return;
        }

        const isRaw = elements.rawModeToggle.checked;
        const ejectPage = elements.ejectPageToggle.checked;

        elements.btnSubmitText.disabled = true;
        elements.btnSubmitTextLabel.textContent = 'MENGIRIM TEKS...';

        try {
            const res = await fetch(getBackendUrl('/api/print/text'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: elements.rawTextArea.value,
                    printer: printerName,
                    isRaw,
                    ejectPage,
                    docName: 'Teks Langsung / Faktur'
                })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Gagal mengirim teks ke printer');

            showToast(`Teks dikirim ke ${printerName}!`, 'loading');
            pollJobStatus(data.jobId, 'Teks Langsung');
            fetchQueue();
        } catch (err) {
            showToast('Gagal mencetak teks: ' + err.message, 'error');
        } finally {
            elements.btnSubmitTextLabel.textContent = 'CETAK TEKS KE PRINTER';
            elements.btnSubmitText.disabled = false;
        }
    }

    // Templates
    function loadTemplate(type) {
        const dateStr = new Date().toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        });

        if (type === 'suratJalan') {
            elements.rawTextArea.value = 
`================================================================
                    SURAT JALAN PENGELUARAN
                  KANTOR PABEAN & LOGISTIK
================================================================
No. Surat : SJ-${Date.now().toString().slice(-6)}
Tanggal   : ${dateStr}
Kepada    : PT. EXPEDISI UTAMA SEJAHTERA
Gudang    : TPS Lini 1 Tanjung Priok
----------------------------------------------------------------
No.  Nama Barang               Kemasan     Jumlah       Berat
----------------------------------------------------------------
 1   ELECTRONIC COMPONENTS    40 CTN      400 PCS    1,200 KG
 2   SPAREPARTS INDUSTRIAL    15 PLT       30 PKG      850 KG
----------------------------------------------------------------
Catatan: Dokumen SPPB CEISA 4.0 Valid & Terverifikasi.

Penerima / Driver,                          Petugas Gudang,



( .................... )                   ( .................... )
================================================================`;
        } else if (type === 'invoice') {
            elements.rawTextArea.value = 
`================================================================
                    FAKTUR KOMERSIAL PABEAN
================================================================
Invoice No : INV-${Date.now().toString().slice(-6)}
Tanggal    : ${dateStr}
Customer   : GLOBAL LOGISTICS PTE LTD
----------------------------------------------------------------
Item Deskripsi                      Qty     Harga (USD)   Total
----------------------------------------------------------------
STEEL FASTENERS M8x50mm          1,000      $ 0.45       $ 450.00
BRASS CONNECTORS 1/2"              500      $ 1.20       $ 600.00
----------------------------------------------------------------
SUBTOTAL                                                $ 1,050.00
FREIGHT & INSURANCE                                     $   120.00
TOTAL CIF                                               $ 1,170.00
================================================================`;
        } else if (type === 'sppb') {
            elements.rawTextArea.value = 
`================================================================
        SURAT PERSETUJUAN PENGELUARAN BARANG (SPPB)
              DIREKTORAT JENDERAL BEA DAN CUKAI
================================================================
Nomor SPPB   : 014829/WBC.07/KPP.MP.01/${new Date().getFullYear()}
Tanggal SPPB : ${dateStr}
No. PIB      : 029381 Tanggal: ${dateStr}
Importir     : PT. MULTI INDO TRADING
Status Jalur : HIJAU (AUTOMATIC CLEARANCE)
----------------------------------------------------------------
Diberikan izin untuk mengeluarkan barang impor dari Kawasan Pabean.
================================================================`;
        } else if (type === 'lqTest') {
            elements.rawTextArea.value = `EPSON LQ-310 24-PIN ESC/P ASCII TEST OK - ${new Date().toLocaleTimeString('id-ID')}`;
        }
    }

    // Event Listeners Initialization
    function initListeners() {
        // Printer selection & refresh
        elements.printerSelect.addEventListener('change', onPrinterChange);
        if (elements.btnReloadPrinters) {
            elements.btnReloadPrinters.addEventListener('click', () => {
                fetchPrinters();
                fetchServerStatus();
                showToast('Memperbarui status printer & koneksi...', 'info');
            });
        }

        // Tab switching
        elements.tabsNav.forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.getAttribute('data-tab'));
            });
        });

        // Dropzone & File
        elements.dropzone.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleSelectedFile(e.target.files[0]);
            }
        });

        elements.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropzone.classList.add('dragover');
        });

        elements.dropzone.addEventListener('dragleave', () => {
            elements.dropzone.classList.remove('dragover');
        });

        elements.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleSelectedFile(e.dataTransfer.files[0]);
            }
        });

        elements.btnRemoveFile.addEventListener('click', removeSelectedFile);

        // Submit Forms
        elements.filePrintForm.addEventListener('submit', submitFilePrint);
        elements.textPrintForm.addEventListener('submit', submitTextPrint);

        // Templates
        elements.tplSuratJalan.addEventListener('click', () => loadTemplate('suratJalan'));
        elements.tplInvoice.addEventListener('click', () => loadTemplate('invoice'));
        elements.tplSppb.addEventListener('click', () => loadTemplate('sppb'));
        elements.tplLqTest.addEventListener('click', () => loadTemplate('lqTest'));
        elements.btnClearText.addEventListener('click', () => {
            elements.rawTextArea.value = '';
            elements.rawTextArea.focus();
        });

        // Refresh Queue & Clear History
        elements.btnRefreshQueue.addEventListener('click', () => {
            fetchQueue();
            showToast('Antrean spooler disegarkan.', 'info');
        });

        elements.btnClearHistory.addEventListener('click', async () => {
            try {
                await fetch(getBackendUrl('/api/print/clear-history'), { method: 'POST' });
                fetchQueue();
                showToast('Riwayat cetak berhasil dibersihkan.', 'success');
            } catch (err) {
                showToast('Gagal membersihkan riwayat: ' + err.message, 'error');
            }
        });

        // Sidebar expand / collapse
        if (elements.ceisaSidebar) {
            elements.ceisaSidebar.addEventListener('mouseenter', () => {
                elements.ceisaSidebar.classList.add('expanded');
                if (elements.ceisaSidebarToggle) elements.ceisaSidebarToggle.setAttribute('aria-expanded', 'true');
            });
            elements.ceisaSidebar.addEventListener('mouseleave', () => {
                elements.ceisaSidebar.classList.remove('expanded');
                if (elements.ceisaSidebarToggle) elements.ceisaSidebarToggle.setAttribute('aria-expanded', 'false');
            });
        }
        if (elements.ceisaSidebarToggle) {
            elements.ceisaSidebarToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (elements.ceisaSidebar) elements.ceisaSidebar.classList.toggle('expanded');
            });
        }


    }

    // Startup
    document.addEventListener('DOMContentLoaded', () => {
        initListeners();
        fetchServerStatus();
        fetchPrinters();
        fetchQueue();

        // Recurring background poll for queue & status
        state.pollInterval = setInterval(() => {
            fetchQueue();
            fetchServerStatus();
        }, 5000);
    });

})();
