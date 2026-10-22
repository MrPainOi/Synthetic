// ====================================================================
// CEISA 4.0 - DOKUMEN SEARCHER (OUTLOOK MATCHER)
// doc_searcher.js - Client Application Logic
// ====================================================================

(function () {
    'use strict';

    // Helper resolver URL backend dinamis
    function getBackendUrl(path = '') {
        if (typeof window.getCeisaBackendUrl === 'function') {
            return window.getCeisaBackendUrl(path);
        }
        let base = 'http://localhost:5005';
        try {
            if (typeof window !== 'undefined' && window.location) {
                const host = window.location.hostname;
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

    // State
    let currentUploadedFile = null;
    let extractedDocData = null;
    let searchResultsData = null;
    let isAnalyzing = false;
    let isSearching = false;

    // DOM Elements
    const dsDropzone           = document.getElementById('dsDropzone');
    const dsFileInput          = document.getElementById('dsFileInput');
    const dsSelectedFileCard   = document.getElementById('dsSelectedFileCard');
    const dsFileName           = document.getElementById('dsFileName');
    const dsFileSize           = document.getElementById('dsFileSize');
    const dsBtnRemoveFile      = document.getElementById('dsBtnRemoveFile');
    const dsAnalysisLogBox     = document.getElementById('dsAnalysisLogBox');
    const dsLogText            = document.getElementById('dsLogText');
    const dsLogSpinner         = document.getElementById('dsLogSpinner');
    const dsDocTypeBadge       = document.getElementById('dsDocTypeBadge');

    // Parameter Inputs
    const paramPibNo           = document.getElementById('paramPibNo');
    const paramPibDate         = document.getElementById('paramPibDate');
    const paramInvoiceNo       = document.getElementById('paramInvoiceNo');
    const paramInvoiceDate     = document.getElementById('paramInvoiceDate');
    const paramBlNo            = document.getElementById('paramBlNo');
    const paramBlDate          = document.getElementById('paramBlDate');
    const paramCompany         = document.getElementById('paramCompany');
    const paramSupplier        = document.getElementById('paramSupplier');
    const paramConsignee       = document.getElementById('paramConsignee');
    const paramVessel          = document.getElementById('paramVessel');
    const paramContainer       = document.getElementById('paramContainer');
    const paramCustomQuery     = document.getElementById('paramCustomQuery');

    // Target Value Placeholders
    const targetValInvoice     = document.getElementById('targetValInvoice');
    const targetValPacking     = document.getElementById('targetValPacking');
    const targetValBl          = document.getElementById('targetValBl');
    const targetValCoo         = document.getElementById('targetValCoo');

    // Buttons & Tables
    const btnStartSearchOutlook= document.getElementById('btnStartSearchOutlook');
    const btnDownloadAllZip    = document.getElementById('btnDownloadAllZip');
    const btnHeaderReset       = document.getElementById('btnHeaderReset');
    const btnDirectSearchModal = document.getElementById('btnDirectSearchModal');
    const dsTableBody          = document.getElementById('dsTableBody');
    const dsResultCountBadge   = document.getElementById('dsResultCountBadge');

    // Modals
    const modalPreview         = document.getElementById('modalPreview');
    const modalPreviewTitle    = document.getElementById('modalPreviewTitle');
    const modalPreviewSubtitle = document.getElementById('modalPreviewSubtitle');
    const previewIframe        = document.getElementById('previewIframe');
    const btnClosePreviewModal = document.getElementById('btnClosePreviewModal');
    const btnDownloadPreviewFile = document.getElementById('btnDownloadPreviewFile');

    const modalCandidates      = document.getElementById('modalCandidates');
    const modalCandTitle       = document.getElementById('modalCandTitle');
    const candidateListContainer = document.getElementById('candidateListContainer');
    const btnCloseCandModal    = document.getElementById('btnCloseCandModal');

    // --- Format Helper ---
    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // --- Dropzone Handlers ---
    if (dsDropzone && dsFileInput) {
        dsDropzone.addEventListener('click', () => dsFileInput.click());

        dsDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dsDropzone.classList.add('dragover');
        });

        dsDropzone.addEventListener('dragleave', () => {
            dsDropzone.classList.remove('dragover');
        });

        dsDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dsDropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });

        dsFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });
    }

    if (dsBtnRemoveFile) {
        dsBtnRemoveFile.addEventListener('click', resetAll);
    }

    if (btnHeaderReset) {
        btnHeaderReset.addEventListener('click', resetAll);
    }

    // --- File Selection & AI Analysis ---
    async function handleFileSelection(file) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('Silakan pilih berkas format PDF (Dokumen PIB / PEB).');
            return;
        }

        currentUploadedFile = file;
        dsFileName.textContent = file.name;
        dsFileSize.textContent = formatBytes(file.size);
        dsDropzone.style.display = 'none';
        dsSelectedFileCard.style.display = 'flex';

        // Show parsing progress
        isAnalyzing = true;
        dsAnalysisLogBox.style.display = 'flex';
        dsLogSpinner.style.display = 'inline-block';
        dsLogText.textContent = `Membaca & menganalisis berkas ${file.name}...`;

        const formData = new FormData();
        formData.append('file', file);

        const customKey = localStorage.getItem('CEISA_GEMINI_API_KEY') || '';
        const headers = {};
        if (customKey) headers['x-gemini-key'] = customKey;

        try {
            const resp = await fetch(getBackendUrl('/api/doc-searcher/analyze-pib-peb'), {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (!resp.ok) {
                throw new Error(`Server merespons status HTTP ${resp.status}`);
            }

            const resData = await resp.json();
            if (!resData.success) {
                throw new Error(resData.error || 'Gagal menganalisis dokumen.');
            }

            extractedDocData = resData.data;
            applyExtractedParameters(extractedDocData);

            dsLogSpinner.style.display = 'none';
            if (resData.isAIFallback) {
                dsLogText.innerHTML = `<span style="color:#d97706; display:inline-flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> <b>${resData.warning || 'Parameter awal telah disiapkan.'}</b> Silakan lengkapi atau sesuaikan parameter di samping bila diperlukan.</span>`;
            } else {
                dsLogText.innerHTML = `<span style="color:#16a34a; display:inline-flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Analisis selesai. Dokumen teridentifikasi sebagai <b>${extractedDocData.docType || 'Pabean'}</b>.</span>`;
            }
            btnStartSearchOutlook.disabled = false;

        } catch (err) {
            console.error('Analisis gagal:', err);
            dsLogSpinner.style.display = 'none';
            dsLogText.innerHTML = `<span style="color:#ef4444; display:inline-flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Analisis otomatis: ${err.message}. Silakan isi parameter pencarian di samping secara manual.</span>`;
            // Enable search anyway so user can search with manual inputs
            btnStartSearchOutlook.disabled = false;
        } finally {
            isAnalyzing = false;
        }
    }

    // Populate Extracted Parameters into Form & Checklist
    function applyExtractedParameters(data) {
        if (!data) return;

        if (data.docType) {
            dsDocTypeBadge.textContent = data.docType.toUpperCase() === 'PEB' ? 'MODUL EKSPOR (PEB)' : 'MODUL IMPOR (PIB)';
            dsDocTypeBadge.style.color = '#2563eb';
            dsDocTypeBadge.style.background = 'rgba(37,99,235,0.1)';
        }

        if (paramPibNo) paramPibNo.value = data.pibPebNo || '';
        if (paramPibDate && data.pibPebDate) paramPibDate.value = data.pibPebDate;
        if (paramInvoiceNo) paramInvoiceNo.value = data.invoiceNo || '';
        if (paramInvoiceDate && data.invoiceDate) paramInvoiceDate.value = data.invoiceDate;
        if (paramBlNo) paramBlNo.value = data.blAwbNo || '';
        if (paramBlDate && data.blAwbDate) paramBlDate.value = data.blAwbDate;
        if (paramCompany) paramCompany.value = data.importerExporter || '';
        if (paramSupplier) paramSupplier.value = data.supplierSeller || '';
        if (paramConsignee) paramConsignee.value = data.consigneeBuyer || '';
        if (paramVessel) paramVessel.value = data.vesselVoyage || '';
        if (paramContainer) paramContainer.value = data.containerNo || '';

        // Deteksi & Autofill Khusus PT. Sinar Asia Pack
        const isSinarAsia = /sinar\s*asia/i.test(data.importerExporter || '') ||
                            /sinar\s*asia/i.test(data.supplierSeller || '') ||
                            /sinar\s*asia/i.test(data.consigneeBuyer || '');
        if (isSinarAsia) {
            const isPeb = (data.docType || '').toUpperCase() === 'PEB';
            if (isPeb) {
                if (paramCompany && !paramCompany.value) paramCompany.value = 'PT. Sinar Asia Pack';
                if (paramConsignee && !paramConsignee.value) paramConsignee.value = 'Golden Ben Printer Pte Ltd';
            } else {
                if (paramConsignee && !paramConsignee.value) paramConsignee.value = 'PT. Sinar Asia Pack';
                if (paramCompany && !paramCompany.value) paramCompany.value = 'PT. Sinar Asia Pack';
            }
            if (targetValPacking) targetValPacking.textContent = data.invoiceNo ? `Sesuai Invoice (${data.invoiceNo}) - 1 Dokumen CIPL` : '1 Dokumen CIPL';
        } else {
            if (targetValPacking) targetValPacking.textContent = data.packingListNo ? `No: ${data.packingListNo}` : (data.invoiceNo ? `Sesuai Invoice (${data.invoiceNo})` : 'Tidak tertera');
        }

        // Update target checklist values
        if (targetValInvoice) targetValInvoice.textContent = data.invoiceNo ? `No: ${data.invoiceNo}` : 'Tidak tertera';
        if (targetValBl) targetValBl.textContent = data.blAwbNo ? `No: ${data.blAwbNo}` : 'Tidak tertera';
        if (targetValCoo) targetValCoo.textContent = 'Berdasarkan asal pengiriman';
    }

    if (paramInvoiceNo) {
        paramInvoiceNo.addEventListener('input', () => {
            const isSinarAsia = /sinar\s*asia/i.test(paramCompany?.value || '') ||
                                /sinar\s*asia/i.test(paramConsignee?.value || '') ||
                                /golden\s*ben/i.test(paramConsignee?.value || '');
            if (isSinarAsia && targetValPacking) {
                targetValPacking.textContent = paramInvoiceNo.value.trim()
                    ? `Sesuai Invoice (${paramInvoiceNo.value.trim()}) - 1 Dokumen CIPL`
                    : '1 Dokumen CIPL';
            }
        });
    }

    // --- Search in Outlook Engine ---
    if (btnStartSearchOutlook) {
        btnStartSearchOutlook.addEventListener('click', performOutlookSearch);
    }

    if (btnDirectSearchModal) {
        btnDirectSearchModal.addEventListener('click', () => {
            btnStartSearchOutlook.disabled = false;
            performOutlookSearch();
        });
    }

    async function performOutlookSearch() {
        if (isSearching) return;

        const invoiceNo    = paramInvoiceNo ? paramInvoiceNo.value.trim() : '';
        const invoiceDate  = paramInvoiceDate ? paramInvoiceDate.value.trim() : '';
        const blAwbNo      = paramBlNo ? paramBlNo.value.trim() : '';
        const blAwbDate    = paramBlDate ? paramBlDate.value.trim() : '';
        const pibPebNo     = paramPibNo ? paramPibNo.value.trim() : '';
        const companyName  = paramCompany ? paramCompany.value.trim() : '';
        const supplierName = paramSupplier ? paramSupplier.value.trim() : '';
        const consigneeName= paramConsignee ? paramConsignee.value.trim() : ((extractedDocData && extractedDocData.consigneeBuyer) ? extractedDocData.consigneeBuyer.trim() : '');
        const vesselVoyage = paramVessel ? paramVessel.value.trim() : '';
        const containerNo  = paramContainer ? paramContainer.value.trim() : '';
        const customQuery  = paramCustomQuery ? paramCustomQuery.value.trim() : '';

        if (!invoiceNo && !blAwbNo && !pibPebNo && !companyName && !customQuery) {
            alert('Silakan masukkan minimal salah satu parameter pencarian (Nomor Invoice, Nomor B/L, Perusahaan, atau Nomor PIB/PEB).');
            return;
        }

        isSearching = true;
        btnStartSearchOutlook.disabled = true;
        btnStartSearchOutlook.innerHTML = `<span class="spinner-inline"></span> Menghubungkan & Mencari di Outlook...`;

        // Render searching placeholder in table
        renderSearchingTableState();

        try {
            const payload = {
                invoiceNo,
                invoiceDate,
                blAwbNo,
                blAwbDate,
                pibPebNo,
                companyName,
                supplierName,
                consigneeName,
                vesselVoyage,
                containerNo,
                customQuery
            };

            const resp = await fetch(getBackendUrl('/api/doc-searcher/search-outlook'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                throw new Error(`Server mengembalikan status HTTP ${resp.status}`);
            }

            const result = await resp.json();
            if (!result.success) {
                throw new Error(result.error || 'Pencarian Outlook gagal dijalankan.');
            }

            searchResultsData = result;
            renderResultsTable(result);

            if (result.totalDocsFound > 0 && btnDownloadAllZip) {
                btnDownloadAllZip.disabled = false;
            }

        } catch (err) {
            console.error('Error pencarian Outlook:', err);
            renderErrorTableState(err.message);
        } finally {
            isSearching = false;
            btnStartSearchOutlook.disabled = false;
            btnStartSearchOutlook.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Ulangi Cari di Outlook
            `;
        }
    }

    // --- Render Table States ---
    function renderSearchingTableState() {
        const rows = [
            { code: '380', label: 'Commercial Invoice' },
            { code: '217', label: 'Packing List' },
            { code: '705', label: 'Bill of Lading / AWB' },
            { code: '861', label: 'Certificate of Origin (COO)' }
        ];

        let html = '';
        rows.forEach(r => {
            html += `
                <tr>
                    <td><span class="badge-doc-code">${r.code}</span><strong>${r.label}</strong></td>
                    <td><span class="badge-status-blue"><span class="spinner-inline" style="width:10px; height:10px; border-width:1.5px;"></span> Menelusuri...</span></td>
                    <td style="color: var(--text-secondary,#64748b);">Sedang menelusuri mailbox Outlook...</td>
                    <td>—</td>
                    <td>—</td>
                    <td style="text-align: center;">—</td>
                </tr>
            `;
        });
        dsTableBody.innerHTML = html;
        if (dsResultCountBadge) {
            dsResultCountBadge.style.display = 'inline-flex';
            dsResultCountBadge.textContent = 'Mencari...';
        }
    }

    function renderErrorTableState(errMsg) {
        dsTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 24px; text-align: center; color: #ef4444;">
                    <div style="font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Gagal Melakukan Pencarian di Outlook
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary,#64748b); max-width: 600px; margin: 0 auto; line-height: 1.5;">
                        ${errMsg}<br>
                        Pastikan Microsoft Outlook sedang berjalan atau sudah terpasang akun email di komputer ini.
                    </div>
                </td>
            </tr>
        `;
    }

    // Render Full Found Results
    function renderResultsTable(result) {
        const summary = result.summary || {};
        const categories = [
            { key: 'INVOICE',        code: '380', label: 'Commercial Invoice' },
            { key: 'PACKING_LIST',   code: '217', label: 'Packing List' },
            { key: 'BILL_OF_LADING', code: '705', label: 'Bill of Lading / AWB' },
            { key: 'COO',            code: '861', label: 'Certificate of Origin (COO)' },
            { key: 'OTHER',          code: '999', label: 'Dokumen Pendukung Lainnya' }
        ];

        let totalFound = 0;
        let html = '';

        categories.forEach(cat => {
            const data = summary[cat.key];
            if (!data) return;

            // Skip 'OTHER' row if empty
            if (cat.key === 'OTHER' && data.count === 0) return;

            let badgeHtml = '';
            let fileColHtml = '—';
            let emailColHtml = '—';
            let confidenceHtml = '—';
            let actionsHtml = '—';

            if (data.status === 'FOUND' && data.selected) {
                totalFound++;
                const doc = data.selected;
                badgeHtml = `<span class="badge-status-green"><span class="status-dot-green"></span> Ditemukan</span>`;
                fileColHtml = `
                    <div style="font-weight: 600; color: var(--text-primary,#0f172a);">${doc.fileName}</div>
                    <div style="font-size: 11.5px; color: var(--text-secondary,#64748b);">${doc.fileSizeFormatted} • ${doc.matchReason}</div>
                `;
                emailColHtml = `
                    <div style="font-weight: 600; color: var(--text-primary,#0f172a);">${doc.email.subject || 'Tanpa Subjek'}</div>
                    <div style="font-size: 11.5px; color: var(--text-secondary,#64748b);">
                        Dari: ${doc.email.senderName || doc.email.senderEmail} • ${doc.email.receivedTime}
                    </div>
                `;
                confidenceHtml = `
                    <div style="display: flex; align-items: center; gap: 6px; justify-content: center;">
                        <span style="font-weight: 700; color: #16a34a; font-family: var(--font-mono, monospace); font-size: 12px;">${doc.confidence}%</span>
                        <div style="width: 44px; height: 5px; background: rgba(0,0,0,0.1); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${doc.confidence}%; height: 100%; background: #16a34a;"></div>
                        </div>
                    </div>
                `;
                actionsHtml = `
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn-action-icon btn-preview-doc" data-url="${doc.downloadUrl}" data-title="${doc.fileName}" title="Pratinjau PDF">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <a href="${getBackendUrl(doc.downloadUrl)}" download="${doc.fileName}" class="btn-action-icon" title="Unduh Berkas" style="text-decoration:none;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </a>
                        ${doc.email.entryId ? `
                        <button type="button" class="btn-action-icon btn-open-outlook" data-entryid="${doc.email.entryId}" title="Buka Email di Microsoft Outlook">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </button>` : ''}
                    </div>
                `;

            } else if (data.status === 'MULTIPLE_FOUND') {
                totalFound += data.count;
                const doc = data.selected;
                badgeHtml = `<span class="badge-status-orange"><span class="status-dot-orange"></span> Kandidat (${data.count})</span>`;
                fileColHtml = `
                    <div style="font-weight: 600; color: var(--text-primary,#0f172a);">${doc ? doc.fileName : 'Beberapa Berkas'}</div>
                    <button type="button" class="btn btn-secondary-ceisa btn-pick-candidate" data-category="${cat.key}" style="padding: 3px 9px; font-size: 11px; margin-top: 5px; display: inline-flex; align-items: center; gap: 5px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        Pilih dari ${data.count} Berkas
                    </button>
                `;
                emailColHtml = doc ? `
                    <div style="font-weight: 600; color: var(--text-primary,#0f172a);">${doc.email.subject || 'Tanpa Subjek'}</div>
                    <div style="font-size: 11.5px; color: var(--text-secondary,#64748b);">
                        Dari: ${doc.email.senderName || doc.email.senderEmail} • ${doc.email.receivedTime}
                    </div>
                ` : '—';
                confidenceHtml = doc ? `
                    <div style="display: flex; align-items: center; gap: 6px; justify-content: center;">
                        <span style="font-weight: 700; color: #d97706; font-family: var(--font-mono, monospace); font-size: 12px;">${doc.confidence}%</span>
                        <div style="width: 44px; height: 5px; background: rgba(0,0,0,0.1); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${doc.confidence}%; height: 100%; background: #d97706;"></div>
                        </div>
                    </div>
                ` : '—';
                actionsHtml = doc ? `
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn-action-icon btn-preview-doc" data-url="${doc.downloadUrl}" data-title="${doc.fileName}" title="Pratinjau PDF">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <a href="${getBackendUrl(doc.downloadUrl)}" download="${doc.fileName}" class="btn-action-icon" title="Unduh Berkas" style="text-decoration:none;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </a>
                        ${doc.email.entryId ? `
                        <button type="button" class="btn-action-icon btn-open-outlook" data-entryid="${doc.email.entryId}" title="Buka Email di Microsoft Outlook">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </button>` : ''}
                    </div>
                ` : '—';

            } else {
                badgeHtml = `<span class="badge-status-red"><span class="status-dot-red"></span> Tidak Ditemukan</span>`;
                fileColHtml = `<span style="color: var(--text-secondary,#64748b);">Tidak ditemukan di mailbox Outlook</span>`;
                actionsHtml = `
                    <button type="button" class="btn btn-secondary-ceisa btn-focus-custom-query" style="padding: 3px 9px; font-size: 11px;">
                        Ubah Kata Kunci
                    </button>
                `;
            }

            html += `
                <tr>
                    <td><span class="badge-doc-code">${cat.code}</span><strong>${cat.label}</strong></td>
                    <td>${badgeHtml}</td>
                    <td>${fileColHtml}</td>
                    <td>${emailColHtml}</td>
                    <td style="text-align: center;">${confidenceHtml}</td>
                    <td style="text-align: center;">${actionsHtml}</td>
                </tr>
            `;
        });

        dsTableBody.innerHTML = html;
        if (dsResultCountBadge) {
            dsResultCountBadge.style.display = 'inline-flex';
            dsResultCountBadge.textContent = `${totalFound} Dokumen Ditemukan`;
        }

        // Attach action handlers
        attachTableActionEvents();
    }

    function attachTableActionEvents() {
        // 1. Preview PDF
        document.querySelectorAll('.btn-preview-doc').forEach(btn => {
            btn.onclick = () => {
                const url = btn.getAttribute('data-url');
                const title = btn.getAttribute('data-title');
                openPreviewModal(url, title);
            };
        });

        // 2. Open Email in Outlook
        document.querySelectorAll('.btn-open-outlook').forEach(btn => {
            btn.onclick = async () => {
                const entryId = btn.getAttribute('data-entryid');
                btn.style.opacity = '0.5';
                try {
                    const resp = await fetch(getBackendUrl('/api/doc-searcher/open-outlook-email'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ entryId })
                    });
                    const res = await resp.json();
                    if (!res.success) alert(res.error || 'Gagal membuka email di Outlook.');
                } catch (e) {
                    alert('Gagal menghubungi backend: ' + e.message);
                } finally {
                    btn.style.opacity = '1';
                }
            };
        });

        // 3. Pick Candidates
        document.querySelectorAll('.btn-pick-candidate').forEach(btn => {
            btn.onclick = () => {
                const category = btn.getAttribute('data-category');
                openCandidatePicker(category);
            };
        });

        // 4. Focus custom query input
        document.querySelectorAll('.btn-focus-custom-query').forEach(btn => {
            btn.onclick = () => {
                if (paramCustomQuery) {
                    paramCustomQuery.focus();
                    paramCustomQuery.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            };
        });
    }

    // --- Modal Preview Handler ---
    function openPreviewModal(url, title) {
        if (!modalPreview || !previewIframe) return;
        modalPreviewTitle.textContent = title || 'Pratinjau Dokumen';
        modalPreviewSubtitle.textContent = url;
        const fullUrl = getBackendUrl(url);
        previewIframe.src = fullUrl;
        if (btnDownloadPreviewFile) {
            btnDownloadPreviewFile.href = fullUrl;
            btnDownloadPreviewFile.setAttribute('download', title || 'dokumen.pdf');
        }
        modalPreview.style.display = 'flex';
    }

    if (btnClosePreviewModal) {
        btnClosePreviewModal.onclick = () => {
            if (modalPreview) modalPreview.style.display = 'none';
            if (previewIframe) previewIframe.src = 'about:blank';
        };
    }

    // --- Candidate Picker Handler ---
    function openCandidatePicker(category) {
        if (!searchResultsData || !searchResultsData.summary || !searchResultsData.summary[category]) return;
        const catData = searchResultsData.summary[category];
        const candidates = catData.candidates || [];

        modalCandTitle.textContent = `Pilih Berkas untuk: ${category.replace('_', ' ')}`;
        let html = '';

        candidates.forEach((cand) => {
            const isSelected = catData.selected && catData.selected.savedFileName === cand.savedFileName;
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid ${isSelected ? 'var(--ceisa-blue, #2563eb)' : 'var(--border-color,#e2e8f0)'}; border-radius: var(--radius-sm, 6px); background: ${isSelected ? 'rgba(37,99,235,0.06)' : 'var(--surface-subtle,#f8fafc)'}; gap: 14px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-weight: 700; color: var(--text-primary,#0f172a); font-size: 13px;">${cand.fileName}</span>
                            <span class="badge-status-green" style="font-size: 11px; padding: 2px 7px;">Skor: ${cand.confidence}%</span>
                            ${isSelected ? '<span class="badge-status-blue" style="font-size: 10px; padding: 2px 6px;">AKTIF</span>' : ''}
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary,#64748b); line-height: 1.4;">
                            <b>Subjek:</b> ${cand.email.subject || '—'}<br>
                            <b>Pengirim:</b> ${cand.email.senderName || cand.email.senderEmail} • ${cand.email.receivedTime} (${cand.fileSizeFormatted})
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-secondary-ceisa btn-cand-preview" data-url="${cand.downloadUrl}" data-title="${cand.fileName}" style="padding: 5px 12px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            Pratinjau
                        </button>
                        <button type="button" class="btn btn-primary-ceisa btn-cand-select" data-category="${category}" data-savedfilename="${cand.savedFileName}" style="padding: 5px 14px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px;">
                            ${isSelected ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Aktif' : 'Pilih Ini'}
                        </button>
                    </div>
                </div>
            `;
        });

        candidateListContainer.innerHTML = html;
        modalCandidates.style.display = 'flex';

        // Attach event listeners via DOM (CSP compliant)
        candidateListContainer.querySelectorAll('.btn-cand-preview').forEach(btn => {
            btn.onclick = () => {
                const url = btn.getAttribute('data-url');
                const title = btn.getAttribute('data-title');
                openPreviewModal(url, title);
            };
        });

        candidateListContainer.querySelectorAll('.btn-cand-select').forEach(btn => {
            btn.onclick = () => {
                const cat = btn.getAttribute('data-category');
                const savedFileName = btn.getAttribute('data-savedfilename');
                selectCandidate(cat, savedFileName);
            };
        });
    }

    function selectCandidate(category, savedFileName) {
        if (!searchResultsData || !searchResultsData.summary || !searchResultsData.summary[category]) return;
        const catData = searchResultsData.summary[category];
        const match = (catData.candidates || []).find(c => c.savedFileName === savedFileName);
        if (match) {
            catData.selected = match;
            renderResultsTable(searchResultsData);
            if (modalCandidates) modalCandidates.style.display = 'none';
        }
    }

    if (btnCloseCandModal) {
        btnCloseCandModal.onclick = () => {
            if (modalCandidates) modalCandidates.style.display = 'none';
        };
    }

    // Modal background click & escape key dismiss
    if (modalCandidates) {
        modalCandidates.addEventListener('click', (e) => {
            if (e.target === modalCandidates) {
                modalCandidates.style.display = 'none';
            }
        });
    }

    if (modalPreview) {
        modalPreview.addEventListener('click', (e) => {
            if (e.target === modalPreview) {
                modalPreview.style.display = 'none';
                if (previewIframe) previewIframe.src = 'about:blank';
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalPreview && modalPreview.style.display !== 'none') {
                modalPreview.style.display = 'none';
                if (previewIframe) previewIframe.src = 'about:blank';
            } else if (modalCandidates && modalCandidates.style.display !== 'none') {
                modalCandidates.style.display = 'none';
            }
        }
    });

    // --- ZIP Bundle Download Handler ---
    if (btnDownloadAllZip) {
        btnDownloadAllZip.addEventListener('click', async () => {
            if (!searchResultsData) return;

            const fileNames = [];
            const summary = searchResultsData.summary || {};
            Object.values(summary).forEach(cat => {
                if (cat.selected && cat.selected.savedFileName) {
                    fileNames.push(cat.selected.savedFileName);
                }
            });

            if (fileNames.length === 0) {
                alert('Tidak ada berkas yang ditemukan untuk diunduh.');
                return;
            }

            btnDownloadAllZip.disabled = true;
            btnDownloadAllZip.textContent = 'Membuat Arsip ZIP...';

            try {
                const resp = await fetch(getBackendUrl('/api/doc-searcher/create-zip'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileNames })
                });

                const res = await resp.json();
                if (!res.success) throw new Error(res.error || 'Gagal membuat arsip ZIP.');

                // Trigger download
                const link = document.createElement('a');
                link.href = getBackendUrl(res.downloadUrl);
                link.download = res.zipName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

            } catch (err) {
                alert('Error membuat ZIP: ' + err.message);
            } finally {
                btnDownloadAllZip.disabled = false;
                btnDownloadAllZip.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Unduh Semua Dokumen (.ZIP)
                `;
            }
        });
    }

    // --- Reset All State ---
    function resetAll() {
        currentUploadedFile = null;
        extractedDocData = null;
        searchResultsData = null;

        if (dsFileInput) dsFileInput.value = '';
        if (dsDropzone) dsDropzone.style.display = 'block';
        if (dsSelectedFileCard) dsSelectedFileCard.style.display = 'none';
        if (dsAnalysisLogBox) dsAnalysisLogBox.style.display = 'none';

        if (paramPibNo) paramPibNo.value = '';
        if (paramPibDate) paramPibDate.value = '';
        if (paramInvoiceNo) paramInvoiceNo.value = '';
        if (paramInvoiceDate) paramInvoiceDate.value = '';
        if (paramBlNo) paramBlNo.value = '';
        if (paramBlDate) paramBlDate.value = '';
        if (paramCompany) paramCompany.value = '';
        if (paramSupplier) paramSupplier.value = '';
        if (paramVessel) paramVessel.value = '';
        if (paramContainer) paramContainer.value = '';
        if (paramCustomQuery) paramCustomQuery.value = '';

        if (targetValInvoice) targetValInvoice.textContent = 'Belum ada dokumen';
        if (targetValPacking) targetValPacking.textContent = 'Belum ada dokumen';
        if (targetValBl) targetValBl.textContent = 'Belum ada dokumen';
        if (targetValCoo) targetValCoo.textContent = 'Opsional';

        if (dsDocTypeBadge) {
            dsDocTypeBadge.textContent = 'MENUNGGU DOKUMEN';
            dsDocTypeBadge.style.color = '#059669';
            dsDocTypeBadge.style.background = 'rgba(5,150,105,0.1)';
        }

        if (btnStartSearchOutlook) btnStartSearchOutlook.disabled = true;
        if (btnDownloadAllZip) btnDownloadAllZip.disabled = true;

        if (dsTableBody) {
            dsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary, #64748b);">
                        Belum ada dokumen yang dicari. Silakan unggah berkas PIB/PEB di atas atau tekan tombol <b>Mulai Cari di Outlook</b>.
                    </td>
                </tr>
            `;
        }
        if (dsResultCountBadge) dsResultCountBadge.textContent = '0 Dokumen';
    }

    // --- Sidebar Expand & Hover Listener ---
    document.addEventListener('DOMContentLoaded', () => {
        const sidebar = document.getElementById('ceisaSidebar');
        const sidebarToggle = document.getElementById('ceisaSidebarToggle');
        if (sidebar) {
            sidebar.addEventListener('mouseenter', () => {
                sidebar.classList.add('expanded');
                if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
            });
            sidebar.addEventListener('mouseleave', () => {
                sidebar.classList.remove('expanded');
                if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
            });
        }
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sidebar) sidebar.classList.toggle('expanded');
            });
        }
    });

})();
