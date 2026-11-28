(function () {
    'use strict';

    let selectedExcelFile = null;

    function detectPageMode() {
        if (typeof window.collectPibFormData === 'function' || document.getElementById('pibItemListView') || /pib\.html/i.test(window.location.pathname)) {
            return 'pib';
        }
        return 'peb';
    }

    function collectActiveDraftForExcel(mode) {
        if (mode === 'pib' && typeof window.collectPibFormData === 'function') {
            return window.collectPibFormData();
        }
        if (typeof window.collectFormData === 'function') {
            return window.collectFormData();
        }
        return { items: [] };
    }

    function resolveExcelApiUrl() {
        if (typeof getBackendUrl === 'function') {
            return getBackendUrl('/api/export-ceisa-excel');
        }
        const host = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'http://localhost:5005';
        return `${host.replace(/\/$/, '')}/api/export-ceisa-excel`;
    }

    function setExcelModalStatus(message, tone = 'info') {
        const box = document.getElementById('ceisaExcelStatusBox');
        if (!box) return;
        const palette = {
            info: { bg: '#f1f5f9', border: '#cbd5e1', color: '#334155' },
            success: { bg: '#ecfdf5', border: '#6ee7b7', color: '#065f46' },
            error: { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b' }
        }[tone] || { bg: '#f1f5f9', border: '#cbd5e1', color: '#334155' };

        box.style.display = 'block';
        box.style.background = palette.bg;
        box.style.borderColor = palette.border;
        box.style.color = palette.color;
        box.textContent = message;
    }

    function updateSelectedExcelUi(file) {
        selectedExcelFile = file || null;
        const nameEl = document.getElementById('ceisaExcelFileName');
        const btnRun = document.getElementById('btnProcessCeisaExcel');
        if (file) {
            if (nameEl) nameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            if (btnRun) btnRun.disabled = false;
            setExcelModalStatus('Template Excel CEISA siap diproses. Klik "Proses & Unduh Excel CEISA".', 'info');
        } else {
            if (nameEl) nameEl.textContent = 'Belum ada file Excel CEISA dipilih';
            if (btnRun) btnRun.disabled = true;
        }
    }

    function openCeisaExcelModal() {
        const modal = document.getElementById('ceisaExcelModal');
        if (!modal) return;

        const mode = detectPageMode();
        const draft = collectActiveDraftForExcel(mode);
        const itemCount = Array.isArray(draft.items) ? draft.items.length : 0;

        const modeLabel = document.getElementById('ceisaExcelModeBadge');
        if (modeLabel) modeLabel.textContent = mode === 'pib' ? 'PIB BC 2.0 (IMPOR)' : 'PEB BC 3.0 (EKSPOR)';

        const draftSummary = document.getElementById('ceisaExcelDraftSummary');
        if (draftSummary) {
            draftSummary.textContent = `Draft aktif: ${itemCount} baris barang (No. Aju: ${draft.nomorAju || '-'})`;
        }

        const fileInput = document.getElementById('ceisaExcelFileInput');
        if (fileInput) fileInput.value = '';
        updateSelectedExcelUi(null);

        const box = document.getElementById('ceisaExcelStatusBox');
        if (box) box.style.display = 'none';

        modal.style.display = 'flex';
    }

    function closeCeisaExcelModal() {
        const modal = document.getElementById('ceisaExcelModal');
        if (modal) modal.style.display = 'none';
    }

    async function handleProcessCeisaExcel() {
        if (!selectedExcelFile) {
            setExcelModalStatus('Silakan pilih file Excel hasil ekspor Portal CEISA 4.0 terlebih dahulu.', 'error');
            return;
        }
        if (!/\.xlsx$/i.test(selectedExcelFile.name)) {
            setExcelModalStatus('Format file harus .xlsx hasil ekspor resmi dari Portal CEISA 4.0 (bukan Excel kosong).', 'error');
            return;
        }

        const mode = detectPageMode();
        const draft = collectActiveDraftForExcel(mode);
        const btnRun = document.getElementById('btnProcessCeisaExcel');
        if (btnRun) {
            btnRun.disabled = true;
            btnRun.textContent = 'Memproses Excel CEISA...';
        }
        setExcelModalStatus('Memvalidasi template CEISA, mengubah Tanggal Ijin Entitas (ID), dan mengisi ulang Sheet Barang...', 'info');

        try {
            const fd = new FormData();
            fd.append('excelFile', selectedExcelFile);
            fd.append('mode', mode);
            fd.append('draftJson', JSON.stringify(draft));

            const resp = await fetch(resolveExcelApiUrl(), {
                method: 'POST',
                body: fd
            });

            if (!resp.ok) {
                let errMsg = `Gagal memproses Excel (HTTP ${resp.status})`;
                try {
                    const errJson = await resp.json();
                    if (errJson && errJson.error) errMsg = errJson.error;
                } catch (_) {}
                throw new Error(errMsg);
            }

            const blob = await resp.blob();
            const entUpdated = resp.headers.get('X-Ceisa-Entitas-Updated') || '0';
            const brgCount = resp.headers.get('X-Ceisa-Barang-Count') || String((draft.items || []).length || 1);

            let outName = `CEISA_${mode.toUpperCase()}_${(draft.nomorAju || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '')}.xlsx`;
            const cd = resp.headers.get('Content-Disposition') || '';
            const fnMatch = cd.match(/filename="?([^"]+)"?/i);
            if (fnMatch && fnMatch[1]) outName = fnMatch[1];

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = outName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);

            const doneMsg = `Selesai! ${entUpdated} Tanggal Ijin Entitas (ID) diubah & ${brgCount} Seri Barang dimasukkan ke ${outName}.`;
            setExcelModalStatus(doneMsg, 'success');
            if (typeof showToast === 'function') {
                showToast(doneMsg, 'success');
            }
        } catch (err) {
            setExcelModalStatus(err.message || 'Gagal mengonversi Excel CEISA.', 'error');
            if (typeof showToast === 'function') {
                showToast(err.message || 'Gagal mengonversi Excel CEISA.', 'error');
            }
        } finally {
            if (btnRun) {
                btnRun.disabled = false;
                btnRun.textContent = 'Proses & Unduh Excel CEISA';
            }
        }
    }

    function initCeisaExcelClient() {
        const triggerIds = ['btnExportCeisaExcelHeader', 'btnExportCeisaExcelDock'];
        triggerIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', openCeisaExcelModal);
        });

        const btnClose = document.getElementById('btnCloseCeisaExcelModal');
        if (btnClose) btnClose.addEventListener('click', closeCeisaExcelModal);

        const btnCancel = document.getElementById('btnCancelCeisaExcelModal');
        if (btnCancel) btnCancel.addEventListener('click', closeCeisaExcelModal);

        const modal = document.getElementById('ceisaExcelModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeCeisaExcelModal();
            });
        }

        const fileInput = document.getElementById('ceisaExcelFileInput');
        const dropZone = document.getElementById('ceisaExcelDropZone');
        const btnChoose = document.getElementById('btnChooseCeisaExcelFile');

        if (btnChoose && fileInput) {
            btnChoose.addEventListener('click', () => fileInput.click());
        }
        if (dropZone && fileInput) {
            dropZone.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') fileInput.click();
            });
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.style.borderColor = '#2563eb';
                dropZone.style.background = '#eff6ff';
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.style.borderColor = '#cbd5e1';
                dropZone.style.background = '#f8fafc';
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.style.borderColor = '#cbd5e1';
                dropZone.style.background = '#f8fafc';
                if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
                    updateSelectedExcelUi(e.dataTransfer.files[0]);
                }
            });
        }
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    updateSelectedExcelUi(e.target.files[0]);
                }
            });
        }

        const btnRun = document.getElementById('btnProcessCeisaExcel');
        if (btnRun) btnRun.addEventListener('click', handleProcessCeisaExcel);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCeisaExcelClient);
    } else {
        initCeisaExcelClient();
    }

    if (typeof window !== 'undefined') {
        window.openCeisaExcelModal = openCeisaExcelModal;
        window.closeCeisaExcelModal = closeCeisaExcelModal;
    }
})();
