# Survey Phase Handoff Report: Print Hub & PIB Header / Old Elements Removal

**State Folder**: `c:\Synthetic\.agents\teamwork\explorer_survey_1\`  
**Investigator**: Explorer Survey 1  
**Timestamp**: 2026-11-10T04:26:00Z  

---

## 1. Observation

### A. Print Hub: QR Code Banner, Header Action & Modal
Direct observation in `c:\Synthetic\print_hub.html` and `c:\Synthetic\print_hub.js`, correlated with visual reference screenshot `media_1794282626045_8ddf80f2.png`:

1. **HTML QR Code Banner Container** (`print_hub.html:990-1008`):
```html
<!-- Mobile Scan Banner -->
<div class="ph-qr-card">
    <div class="ph-qr-thumb-box" id="qrThumbBox" style="position: relative; width: 88px; height: 88px; flex-shrink: 0; cursor: pointer;">
        <div id="qrLoadingSkeleton" style="width: 88px; height: 88px; border-radius: var(--radius-md, 10px); background: rgba(2, 132, 199, 0.08); border: 1.5px dashed var(--border-color, #cbd5e1); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 20px; color: var(--text-muted); gap: 4px;">
            <span>📱</span>
            <span style="font-size: 9px; font-weight: 700;">QR HP</span>
        </div>
        <img id="qrThumbImage" class="ph-qr-thumb" src="" alt="Scan QR HP" title="Klik untuk memperbesar QR code" style="display: none; position: absolute; top: 0; left: 0; width: 88px; height: 88px; margin: 0;">
    </div>
    <div class="ph-qr-info">
        <div class="ph-qr-title">📱 Cetak Langsung dari HP (Android / iOS)</div>
        <div class="ph-qr-sub">Scan QR Code dengan kamera HP untuk mencetak berkas PDF, foto dokumen, atau faktur tanpa perlu instal aplikasi printer.</div>
        <div class="ph-qr-link-box" id="btnCopyLanUrl" title="Klik untuk menyalin alamat IP LAN">
            <span>🔗</span>
            <span id="lanUrlDisplay">http://...</span>
            <span style="font-size: 10px; color: var(--text-muted);">(Salin)</span>
        </div>
    </div>
</div>
```
Selectors present: `.ph-qr-card`, `#qrThumbBox`, `#qrLoadingSkeleton`, `#qrThumbImage`, `.ph-qr-thumb`, `.ph-qr-info`, `.ph-qr-title`, `.ph-qr-sub`, `#btnCopyLanUrl`, `.ph-qr-link-box`, `#lanUrlDisplay`.

2. **HTML Header Action Button "Scan HP"** (`print_hub.html:824-832`):
```html
<button type="button" class="btn btn-header-subtle" id="btnOpenQrHeader" title="Buka QR Code untuk HP">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
    Scan HP
</button>
```

3. **HTML QR Code Modal** (`print_hub.html:1228-1245`):
```html
<!-- QR Code Modal (Large View) -->
<div class="ph-modal-overlay" id="qrModal">
    <div class="ph-modal-card">
        <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
            Scan QR Code dari Smartphone
        </h3>
        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.45;">
            Pastikan smartphone Anda terhubung ke Wi-Fi yang sama, lalu buka kamera dan arahkan ke kode berikut:
        </p>
        <img id="qrLargeImage" class="ph-qr-large" src="" alt="QR Code Fullsize">
        <div class="ph-qr-link-box" id="modalUrlDisplay" style="width: 100%; justify-content: center; margin-bottom: 14px;">
            http://...
        </div>
        <button type="button" class="btn btn-header-subtle" id="btnCloseQrModal" style="width: 100%; height: 38px; font-weight: 600;">
            Tutup Jendela
        </button>
    </div>
</div>
```

4. **CSS Scoped Rules in `print_hub.html`**:
- Lines 576-635: `.ph-qr-card`, `.ph-qr-thumb`, `.ph-qr-thumb:hover`, `.ph-qr-info`, `.ph-qr-title`, `.ph-qr-sub`, `.ph-qr-link-box`.
- Lines 638-685: `.ph-modal-overlay`, `.ph-modal-overlay.active`, `.ph-modal-card`, `.ph-modal-overlay.active .ph-modal-card`, `.ph-qr-large`.
- Lines 765-774: `[data-theme="dark"] .ph-qr-card`, `[data-theme="dark"] .ph-qr-link-box`.

5. **JavaScript References in `print_hub.js`**:
- **DOM element cache** (`print_hub.js:51-56, 104-107`):
  ```javascript
  btnOpenQrHeader: document.getElementById('btnOpenQrHeader'),
  qrThumbBox: document.getElementById('qrThumbBox'),
  qrThumbImage: document.getElementById('qrThumbImage'),
  qrLoadingSkeleton: document.getElementById('qrLoadingSkeleton'),
  lanUrlDisplay: document.getElementById('lanUrlDisplay'),
  btnCopyLanUrl: document.getElementById('btnCopyLanUrl'),
  ...
  qrModal: document.getElementById('qrModal'),
  qrLargeImage: document.getElementById('qrLargeImage'),
  modalUrlDisplay: document.getElementById('modalUrlDisplay'),
  btnCloseQrModal: document.getElementById('btnCloseQrModal'),
  ```
- **Direct property access in `fetchServerStatus()`** (`print_hub.js:183-184`):
  ```javascript
  elements.lanUrlDisplay.textContent = url;
  elements.modalUrlDisplay.textContent = url;
  ```
- **Direct property access in `fetchQrCode()`** (`print_hub.js:192-209`):
  ```javascript
  elements.qrThumbImage.src = data.qr;
  elements.qrThumbImage.style.display = 'block';
  if (elements.qrLoadingSkeleton) elements.qrLoadingSkeleton.style.display = 'none';
  elements.qrLargeImage.src = data.qr;
  elements.lanUrlDisplay.textContent = data.url;
  elements.modalUrlDisplay.textContent = data.url;
  ```
- **Function invocations of `fetchQrCode()`**:
  - `print_hub.js:653` (inside `btnReloadPrinters` click listener).
  - `print_hub.js:768` (inside `DOMContentLoaded` startup sequence).
- **Direct Event Listeners in `initListeners()`** (`print_hub.js:722-741`):
  ```javascript
  const openModal = () => elements.qrModal.classList.add('active');
  const closeModal = () => elements.qrModal.classList.remove('active');

  elements.btnOpenQrHeader.addEventListener('click', openModal);
  if (elements.qrThumbBox) elements.qrThumbBox.addEventListener('click', openModal);
  elements.btnCloseQrModal.addEventListener('click', closeModal);
  elements.qrModal.addEventListener('click', (e) => {
      if (e.target === elements.qrModal) closeModal();
  });

  elements.btnCopyLanUrl.addEventListener('click', () => {
      const url = elements.lanUrlDisplay.textContent.trim();
      if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => {
              showToast('Tautan portal cetak berhasil disalin ke clipboard!', 'success');
          });
      }
  });
  ```

---

### B. PIB Document Topbar (`.ceisa-doc-topbar`)
Direct observation in `c:\Synthetic\pib.html`, `c:\Synthetic\pib_dashboard.js`, and `c:\Synthetic\dashboard.css`, correlated with visual reference screenshot `media_1794282626019_9dd72ceb.png` (red box over topbar):

1. **HTML Element** (`pib.html:243-261`):
```html
<!-- CEISA 4.0 Document Topbar (1:1 FTZ01 Portal Screen) -->
<div class="ceisa-doc-topbar">
    <div class="ceisa-doc-topbar-left">
        <h2 class="ceisa-doc-type-title">FTZ01 - Pemasukan dari Luar Daerah Pabean</h2>
    </div>
    <div class="ceisa-doc-topbar-right">
        <button type="button" class="btn-topbar-action" id="btnPibKembali" title="Kembali ke Beranda">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Kembali</span>
        </button>
        <button type="button" class="btn-topbar-action" id="btnPibUpdateData" title="Update Data Draft">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span>Update Data</span>
        </button>
        <button type="button" class="btn-topbar-icon" id="btnPibMenuToggle" title="Menu Opsi">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
    </div>
</div>
```

2. **JavaScript Listeners in `pib_dashboard.js:1791-1808`**:
```javascript
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
```
*Note*: `btnPibMenuToggle` has no listener attached anywhere in the codebase.

3. **CSS in `dashboard.css:2409-2505`**:
- Selectors: `.ceisa-doc-topbar`, `.ceisa-doc-topbar-left`, `.ceisa-doc-type-title`, `.ceisa-doc-topbar-right`, `.btn-topbar-action`, `.btn-topbar-icon`, and `[data-theme="dark"]` rules.
- Grep across project confirmed `.btn-topbar-action`, `.btn-topbar-icon`, and `.ceisa-doc-topbar` appear *exclusively* in `pib.html:244-257`.

---

### C. Old PPJK Card in PIB
Direct observation in `c:\Synthetic\pib.html`, `c:\Synthetic\pib_dashboard.js`, and visual reference screenshot `media_1794282626039_d1d40fb4.png` (red box over PPJK card):

1. **HTML Element** (`pib.html:600-622`):
```html
<!-- Card 5: PPJK (Opsional) -->
<div class="ceisa-form-card" style="grid-column: span 2;">
    <div class="ceisa-card-header">
        <span class="ceisa-card-title">PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional</span>
    </div>
    <div class="ceisa-card-body" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
        <div class="form-group">
            <label class="form-label">NPWP PPJK</label>
            <input type="text" id="pibPpjkId" class="form-control form-control-mono"
                value="0026923485215000">
        </div>
        <div class="form-group">
            <label class="form-label">Nama PPJK</label>
            <input type="text" id="pibPpjkName" class="form-control"
                value="PT. SARANA PPJK LOGISTIK UTAMA">
        </div>
        <div class="form-group">
            <label class="form-label">Alamat PPJK</label>
            <input type="text" id="pibPpjkAddress" class="form-control"
                value="Jl. Sulawesi No. 12 Tanjung Priok, Jakarta Utara">
        </div>
    </div>
</div>
```

2. **JavaScript Data Handling in `pib_dashboard.js`**:
- **Default Sample Data** (`pib_dashboard.js:85-87`):
  ```javascript
  ppjkId: "0026923485215000",
  ppjkName: "PT. SARANA PPJK LOGISTIK UTAMA",
  ppjkAddress: "Jl. Sulawesi No. 12 Tanjung Priok, Jakarta Utara",
  ```
- **Data Collection** (`pib_dashboard.js:366-368` inside `collectPibFormData()`):
  ```javascript
  ppjkId: getVal('pibPpjkId'),
  ppjkName: getVal('pibPpjkName'),
  ppjkAddress: getVal('pibPpjkAddress'),
  ```
  *Note*: `getVal(id)` (`pib_dashboard.js:335-338`) implements safe lookup: `const el = document.getElementById(id); return el ? el.value : '';`.
- **Form Population** (`pib_dashboard.js:618-620` inside `loadPibDraftData()`):
  ```javascript
  if (data.ppjkId) setVal('pibPpjkId', data.ppjkId);
  if (data.ppjkName) setVal('pibPpjkName', data.ppjkName);
  if (data.ppjkAddress) setVal('pibPpjkAddress', data.ppjkAddress);
  ```
  *Note*: `setVal(id, val)` (`pib_dashboard.js:559-564`) implements safe lookup: `const el = document.getElementById(id); if (el && val !== undefined && val !== null) { el.value = val; }`.

---

## 2. Logic Chain

### Step 1: Print Hub Failure Mechanics Upon Element Deletion
- **Premise**: Removing the QR code banner `.ph-qr-card` deletes `#lanUrlDisplay`, `#btnCopyLanUrl`, `#qrThumbImage`, `#qrThumbBox`, and `#qrLoadingSkeleton` from `print_hub.html`.
- **Reasoning**:
  1. In `print_hub.js`, lines 51-56 cache these elements into `elements`. If the elements are missing, their properties become `null`.
  2. In `initListeners()`, line 726 (`elements.btnOpenQrHeader.addEventListener`) and line 734 (`elements.btnCopyLanUrl.addEventListener`) perform unguarded `.addEventListener` calls on `elements.btnCopyLanUrl` and `elements.btnOpenQrHeader`.
  3. If `#btnCopyLanUrl` is removed with the banner, `initListeners()` throws an unhandled `TypeError: Cannot read properties of null (reading 'addEventListener')` at line 734.
  4. In `DOMContentLoaded`, `initListeners()` is invoked first (line 766). Because it throws, lines 767 (`fetchServerStatus()`), 768 (`fetchQrCode()`), 769 (`fetchPrinters()`), 770 (`fetchQueue()`), and 773-776 (`setInterval(...)`) are NEVER executed.
  5. As a direct consequence, the printer list is never fetched, the print queue is never fetched, and the entire Print Hub becomes non-functional.
- **Deduction**: Deleting the banner from `print_hub.html` MUST be paired with cleaning up or guarding all references in `print_hub.js` (including `btnCopyLanUrl`, `lanUrlDisplay`, `fetchQrCode`, and related modal elements).

### Step 2: Print Hub QR Modal & "Scan HP" Button Alignment
- **Premise**: Requirement R1 states: "Hapus banner/kontainer QR Code ('Cetak Langsung dari HP (Android / IOS)' yang menampilkan QR Code) pada print_hub.html dan skrip terkait di print_hub.js, sehingga halaman cetak tidak lagi menampilkan QR Code."
- **Reasoning**:
  1. The header button `#btnOpenQrHeader` ("Scan HP") and modal `#qrModal` also render a large QR Code (`#qrLargeImage`).
  2. If the user intends for the print page to no longer display QR codes at all ("sehingga halaman cetak tidak lagi menampilkan QR Code"), keeping the modal and header button would leave an orphaned QR code popup.
  3. Deleting `#btnOpenQrHeader` and `#qrModal` along with `.ph-qr-card` produces a completely clean, unified interface that avoids all QR references.
- **Deduction**: Both the banner and the QR modal/header button should be removed or cleanly disabled, with all associated JS event listeners safely eliminated.

### Step 3: PIB Header (`.ceisa-doc-topbar`) Removal Safety
- **Premise**: Deleting `.ceisa-doc-topbar` (`pib.html:243-261`) removes `#btnPibKembali`, `#btnPibUpdateData`, and `#btnPibMenuToggle`.
- **Reasoning**:
  1. In `pib_dashboard.js:1791-1808`, both `btnPibKembali` and `btnPibUpdateData` are wrapped in `if (btnPibKembali)` and `if (btnPibUpdateData)`.
  2. Removing the DOM elements will not throw any runtime errors in `pib_dashboard.js`.
  3. However, lines 1791-1808 will become dead code and should be removed during implementation for cleanliness.
  4. In `dashboard.css`, lines 2409-2505 define `.ceisa-doc-topbar` and its child classes. Grep confirms these classes are not referenced anywhere else.
  5. In DOM layout, `<main class="main-workspace">` has `style="padding-top: 4px;"`. When `.ceisa-doc-topbar` is removed, the tabs navigation `<nav class="ceisa-tabs">` immediately follows `<main>`, which directly matches the native CEISA 4.0 layout shown in screenshots `media_1794282977653_5e8008e4.png` and `media_1794282972406_ac3647c6.png`.
- **Deduction**: Removing `.ceisa-doc-topbar` is 100% safe, causes no broken layout or JS errors, and cleanly accomplishes requirement R2.

### Step 4: Old PPJK Card Removal & Data Model Transition
- **Premise**: Requirement R2 states: "Hapus komponen card 'PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional' yang lama."
- **Reasoning**:
  1. The old card in `pib.html:600-622` was a full-width card (`grid-column: span 2;`) with 3 fields (`pibPpjkId`, `pibPpjkName`, `pibPpjkAddress`).
  2. In `pib_dashboard.js`, `collectPibFormData` and `loadPibDraftData` interact with these fields via `getVal` and `setVal`, both of which are null-safe (`document.getElementById` check).
  3. Removing the card from `pib.html` will NOT cause runtime crashes.
  4. In Requirement R3 (investigated by Explorer 2), a new PPJK Card is specified for Column 2 (Right Column), containing 5 fields:
     - Nomor Identitas: select jenis identitas (default '6 - NPWP 16 DIGIT') + input nomor
     - NITKU with sync button
     - Nama PPJK
     - Alamat PPJK
- **Deduction**: The old PPJK card can be immediately and cleanly removed from `pib.html`. The data model in `pib_dashboard.js` can either keep the existing keys (`ppjkId`, `ppjkName`, `ppjkAddress`) or extend them with `ppjkIdType` and `ppjkNitku` when Explorer 2's new structure is implemented.

---

## 3. Caveats

1. **Backend Endpoint `/api/print/qr`**:
   The backend service (`backend-service/server.js:519`) defines `app.get('/api/print/qr')`. Removing the front-end QR code banner and callers does not break the backend, but the backend endpoint will simply become idle. No backend changes are required for this frontend cleanup.
2. **Tab Entitas R3 / R4 Dependency**:
   The removal of the old PPJK card leaves Tab Entitas with 4 cards temporarily until Explorer 2's new 6-card, 2-column layout is placed. The implementer should coordinate R2 and R3 together so that the Tab Entitas structure is updated in a single coherent edit.
3. **Draft Storage Backward Compatibility**:
   Any previously saved drafts in localStorage or JSON containing `ppjkId`, `ppjkName`, and `ppjkAddress` should continue to map smoothly to the new PPJK card fields.

---

## 4. Conclusion

1. **Print Hub Cleanup**:
   - Remove `<div class="ph-qr-card">...</div>` (`print_hub.html:990-1008`).
   - Remove `<button id="btnOpenQrHeader">Scan HP</button>` (`print_hub.html:824-832`) and `<div id="qrModal">...</div>` (`print_hub.html:1228-1245`).
   - Remove QR-related CSS rules from `print_hub.html` (lines 576-635, 638-685, 765-774).
   - In `print_hub.js`, remove or guard:
     - Lines 51-56 and 104-107 in `elements`.
     - Lines 183-184 in `fetchServerStatus()`.
     - Function `fetchQrCode()` (lines 192-209) and calls to it (lines 653, 768).
     - Event listeners for `btnOpenQrHeader`, `qrThumbBox`, `btnCloseQrModal`, `qrModal`, and `btnCopyLanUrl` (lines 722-741).
   - This ensures 0 runtime errors and prevents broken initialization.

2. **PIB Header Removal**:
   - Remove `.ceisa-doc-topbar` (`pib.html:243-261`).
   - Remove dead event listener code in `pib_dashboard.js:1791-1808` (`btnPibKembali`, `btnPibUpdateData`).
   - Remove or leave unused CSS in `dashboard.css:2409-2505` (`.ceisa-doc-topbar` and sub-selectors).
   - Results in tabs appearing directly below the main header bar, matching CEISA 4.0 production layout.

3. **Old PPJK Card Removal**:
   - Remove `<div class="ceisa-form-card" style="grid-column: span 2;">...</div>` (`pib.html:600-622`).
   - Safely update `collectPibFormData` and `loadPibDraftData` in `pib_dashboard.js` when the new PPJK card (Right Column Card 3) is introduced per R3/R4 specifications.

---

## 5. Verification Method

To independently verify the observations and conclusions:

1. **DOM Elements Verification**:
   - Inspect `c:\Synthetic\print_hub.html` around line 990 for `.ph-qr-card`, line 824 for `#btnOpenQrHeader`, and line 1229 for `#qrModal`.
   - Inspect `c:\Synthetic\pib.html` around line 244 for `.ceisa-doc-topbar` and line 601 for the old PPJK card.
   - Inspect `c:\Synthetic\pib_dashboard.js` around line 1791 for `#btnPibKembali` and line 366 / 618 for `pibPpjkId`.

2. **JavaScript Syntax Verification Command**:
   ```powershell
   node -c c:\Synthetic\print_hub.js
   node -c c:\Synthetic\pib_dashboard.js
   ```
   Both must pass with return code 0.

3. **Runtime Error Check Simulation**:
   When implementing changes, verify in browser console or headless runner that `DOMContentLoaded` completes without `TypeError: Cannot read properties of null (reading 'addEventListener')` or `(reading 'textContent')`. Check that `fetchPrinters()` runs and populates the printer dropdown.

4. **Invalidation Conditions**:
   - If `#btnCopyLanUrl` or `#btnOpenQrHeader` listeners are left unguarded in `print_hub.js` after deleting their HTML elements, this report's logic chain predicts an immediate fatal `TypeError` in `initListeners()`. Testing with deleted HTML elements and unmodified JS will directly confirm this failure mechanism.
