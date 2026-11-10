# Milestone 2 Review & Adversarial Audit Report: PIB CEISA 4.0 Tab Entitas & Data Controller

**Verdict**: **APPROVE**  
**Reviewer Role**: Reviewer 1 & Adversarial Critic  
**Date**: 2026-11-10T05:25:30Z  
**Reviewed Changes**: `c:\Synthetic\pib.html`, `c:\Synthetic\dashboard.css`, `c:\Synthetic\pib_dashboard.js`  
**Referenced Contracts**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `TEST_READY.md`, `worker_m2/handoff.md`

---

## 1. Observation

### 1.1 Direct Inspection of Source Artifacts
1. **`c:\Synthetic\pib.html`**:
   - Lines 88-120: `.ceisa-doc-topbar`, `#btnPibKembali`, `#btnPibUpdateData`, and `#btnPibMenuToggle` are completely removed. Verified via grep search (`Select-String -Pattern "ceisa-doc-topbar|btnPibKembali|btnPibUpdateData|btnPibMenuToggle"`): 0 matches found.
   - Lines 438-741: Tab Entitas (`#pib-tab-entitas`) contains `.ceisa-entitas-grid` with two vertical columns:
     - Left column (`.ceisa-entitas-col-left`):
       * Card 1 (**Pengirim**): Button `#btnRefPengirim`, split identity select `#pibPengirimIdType` + input `#pibPengirimId`, `#pibPengirimName`, `#pibPengirimAddress`, `#pibPengirimCountry`.
       * Card 2 (**Pembeli**): Buttons `#btnHapusPembeli`, `#btnCopyPenerimaToPembeli`, split identity select `#pibPembeliIdType` + input `#pibPembeliId`, NITKU input `#pibPembeliNitku` (maxlength="22"), `#pibPembeliName`, `#pibPembeliAddress`, `#pibPembeliCountry`.
       * Card 3 (**Pemilik Barang**): Buttons `#btnCopyPenerimaToPemilik`, `#btnRefPemilik`, split identity select `#pibPemilikIdType` + input `#pibPemilikId`, NITKU input `#pibPemilikNitku` (maxlength="22"), `#pibPemilikName`, `#pibPemilikAddress`, `#pibPemilikAfiliasi` (options 'TAH - Tidak berhubungan', 'HUB - Berhubungan').
     - Right column (`.ceisa-entitas-col-right`):
       * Card 4 (**Penerima**): Button `#btnRefPenerima`, split identity select `#pibPenerimaIdType` (default 6) + input `#pibPenerimaId`, NITKU input `#pibPenerimaNitku` (maxlength="22"), `#pibPenerimaName`, `#pibPenerimaAddress`, `#pibPenerimaCountry`, `#pibPenerimaStatus` (default 'LAINNYA'), `#pibPenerimaIjinNo`, `#pibPenerimaIjinDate`.
       * Card 5 (**Penjual**): Button `#btnCopyPengirimToPenjual`, split identity select `#pibPenjualIdType` + input `#pibPenjualId`, `#pibPenjualName`, `#pibPenjualAddress`, `#pibPenjualCountry`.
       * Card 6 (**PPJK**): Split identity select `#pibPpjkIdType` (default 6) + input `#pibPpjkId`, NITKU input `#pibPpjkNitku` (maxlength="22") with attached sync button `#btnSyncNitkuPpjk`, `#pibPpjkName`, `#pibPpjkAddress`.
   - Lines 822-832: Nav footer `.ceisa-tab-nav-footer` contains `#btnPrevFromPibEntitas` and `#btnNextFromPibEntitas`.
   - Legacy PPJK card (`grid-column: span 2`) and obsolete checkboxes (`#pibCheckOwnerSame`, `#pibCheckSellerSame`) are completely removed from DOM.

2. **`c:\Synthetic\dashboard.css`**:
   - Lines 2409-2470: Added `.ceisa-entitas-grid` with `grid-template-columns: repeat(2, minmax(0, 1fr))`, `gap: 16px 20px`, `align-items: start;`.
   - Added flex column containers `.ceisa-entitas-column`, `.ceisa-entitas-col-left`, `.ceisa-entitas-col-right` with `display: flex; flex-direction: column; gap: 16px;`.
   - Added responsive breakpoint `@media (max-width: 900px)` stacking columns to `grid-template-columns: 1fr;`.

3. **`c:\Synthetic\pib_dashboard.js`**:
   - Lines 68-170: Updated `SAMPLE_PIB_DATA` to reflect CEISA 4.0 6-card entitas structure and backward-compatible aliases.
   - Lines 434-645: Implemented `collectPibFormData()`:
     * Reads all 6 entity cards from DOM inputs.
     * Returns structured `entitas: { pengirim, pembeli, pemilikBarang, penerima, penjual, ppjk }`.
     * Returns flattened CEISA 4.0 properties (`pengirimName`, `pembeliName`, `pemilikName`, `penerimaName`, `penjualName`, `ppjkName`, `ppjkNitku`, etc.).
     * Returns legacy aliases (`importirName`, `importirAddress`, `supplierName`, `supplierAddress`, `ownerName`, `sellerName`, etc.) preserving 100% calculation and validation compatibility.
   - Lines 820-1010: Implemented `loadPibDraftData()`:
     * Handles nested `data.entitas` or flat root properties.
     * Implements fallback cascade: Pembeli from Penerima, Penjual from Pengirim, Pemilik from Penerima when omitted.
     * Sinar Asia business rule: `/sinar\s*asia/i` cascades Singapore shipper `GOLDEN BEN PRINTER PTE LTD`.
     * Safe null/undefined handling: prevents literal `"null"` or `"undefined"` strings.
     * Dual-populates active 6-card DOM and legacy hidden inputs.
   - Lines 2106-2257: Implemented `setupPibCopyHandlers()`:
     * `Salin data penerima`: copies Penerima to Pembeli, dispatches `input` and `change` events.
     * `Hapus Pembeli`: resets Pembeli fields, dispatches events.
     * `Salin data pengirim`: copies Pengirim to Penjual, dispatches events.
     * `Salin Penerima`: copies Penerima to Pemilik Barang while preserving `pibPemilikAfiliasi`, dispatches events.
     * `Sync NITKU PPJK`: extracts digits; if 15-16 digits, pads to 22 digits with zeroes (`padEnd(22, '0')`); if 22 digits maintains value; if invalid length clears; dispatches events.
   - Lines 2631-2637: Global exposure on `window` for `collectPibFormData`, `loadPibDraftData`, `populatePibForm`, and `setupPibCopyHandlers`.

### 1.2 Independent Test Execution
1. Full Test Suite (`node tests/e2e/run_tests.js --summary`):
   - Total Tests: 175
   - Passed: 168 (96.0%)
   - Failed: 7 (All 7 failures are exclusively within Milestone 3 scope in `content.js`: TC-T1-F16-02, TC-T1-F16-03, TC-T1-F16-04, TC-T2-F16-03, TC-T2-F16-04, TC-T3-05, TC-T4-01).
2. Milestone 2 Feature Tests:
   - F4 (PIB Header Removal): 10/10 passed [PASS]
   - F5 (Old PPJK Card Removal): 10/10 passed [PASS]
   - F6 (2-Column Grid Layout): 10/10 passed [PASS]
   - F7 (Card 1: Pengirim): 10/10 passed [PASS]
   - F8 (Card 2: Pembeli): 10/10 passed [PASS]
   - F9 (Card 3: Pemilik Barang): 10/10 passed [PASS]
   - F10 (Card 4: Penerima): 10/10 passed [PASS]
   - F11 (Card 5: Penjual): 10/10 passed [PASS]
   - F12 (Card 6: PPJK): 10/10 passed [PASS]
   - F13 (Copy Handlers): 10/10 passed [PASS]
   - F14 (collectPibFormData): 10/10 passed [PASS]
   - F15 (loadPibDraftData): 10/10 passed [PASS]
   - **Total Milestone 2 Tests**: **120 / 120 passed (100.0%)**.

### 1.3 Integrity Violation Check
- Hardcoded test outputs in code? **None**. All inputs and outputs dynamically parse DOM and payloads.
- Dummy or facade implementations? **None**. Real event listeners, form elements, and state mutations.
- Task shortcuts / bypasses? **None**. Tab Entitas was rewritten from scratch into a parallel 2-column layout.
- Fabricated attestation or outputs? **None**. Results independently verified via direct test execution.

---

## 2. Logic Chain

1. **Observation 1.1 (DOM cleanup)** confirms `.ceisa-doc-topbar` and the old PPJK card with `grid-column: span 2` were completely removed, satisfying Requirements R2 and Features F4 & F5.
2. **Observation 1.1 (2-Column Layout)** confirms that `.ceisa-entitas-grid` contains `.ceisa-entitas-col-left` (Pengirim, Pembeli, Pemilik Barang) and `.ceisa-entitas-col-right` (Penerima, Penjual, PPJK). All cards contain the required split identity selects, inputs, NITKU inputs, buttons, and dropdowns matching CEISA 4.0 specifications, satisfying Requirement R3 and Features F6-F12.
3. **Observation 1.1 & 1.2 (Copy handlers & events)** confirm that copy buttons clone data correctly between cards and dispatch `input`/`change` events so auto-save debouncing and recalculation timers are triggered. In addition, copying to Pemilik Barang does not overwrite Afiliasi, satisfying Feature F13.
4. **Observation 1.1 & 1.2 (Data serialization & deserialization)** confirm `collectPibFormData()` outputs the exact contract required by M3 (`entitas` nested tree + flat aliases) while `loadPibDraftData()` supports cascade fallbacks, null safety, and NITKU padding, satisfying Requirement R4 and Features F14 & F15.
5. **Observation 1.2 (Test Suite Run)** confirms 120/120 tests pass for M2 features. The 7 failing tests belong strictly to `content.js` (M3).

Therefore, Milestone 2 fulfills all requirements without regressions or integrity violations.

---

## 3. Adversarial Review & Stress-Test Results

**Overall Risk Assessment**: **LOW**

### Adversarial Challenges & Mitigations Tested

1. **Challenge 1: Corrupted or Malformed Draft Payload to `loadPibDraftData`**
   - *Attack*: Pass `null`, `undefined`, empty object `{}`, or malformed `{ entitas: null }`.
   - *Result*: **PASS**. `loadPibDraftData` uses optional chaining and safe defaults (`const ent = (data && data.entitas) || {};`), preventing any TypeError crashes.
2. **Challenge 2: XSS Injection & Multiline Strings in Form Inputs**
   - *Attack*: Inject `<img src=x onerror=alert(1)>` and 10,000-character multiline strings into entity fields.
   - *Result*: **PASS**. Strings are set via `.value` (DOM property) rather than `innerHTML`, preventing XSS execution. Multiline newlines are preserved intact without truncation.
3. **Challenge 3: Idempotency of Copy Handlers & Event Flooding**
   - *Attack*: Click copy and sync buttons in rapid succession or multiple times.
   - *Result*: **PASS**. Handlers are bound with idempotency guards (`_pibCopyBound = true`). NITKU sync retains a stable 22-digit value across multiple clicks without accumulating runaway zeroes.
4. **Challenge 4: NITKU Sync Boundary Handling**
   - *Attack*: Input formatted NPWP (`00.269.234.8-521.000`), short NPWP (<15 digits), and long NPWP (>22 digits).
   - *Result*: **PASS**. Non-digits are stripped first. 15-16 digit numbers are cleanly padded to 22 digits. Numbers under 15 digits or above 22 digits are safely cleared to avoid submitting invalid NITKUs.
5. **Challenge 5: Preservation of Uncopied Metadata (Afiliasi)**
   - *Attack*: Copy from Penerima to Pemilik Barang when Pemilik Barang has Afiliasi set to `'HUB - Berhubungan'`.
   - *Result*: **PASS**. The copy handler targets only identity, NITKU, name, and address; the Afiliasi dropdown value remains untouched.

---

## 4. Caveats

- `content.js` was not modified in Milestone 2. Tests asserting auto-input into the mock CEISA portal (TC-T1-F16-02..04, TC-T2-F16-03..04, TC-T3-05, TC-T4-01) fail as expected and are scheduled for Milestone 3.
- In `pib_dashboard.js`, `setupPibCopyHandlers()` binds handlers once using DOM properties. If external scripts dynamically wipe out `#pib-tab-entitas` via `innerHTML`, `setupPibCopyHandlers()` must be invoked again to re-bind event listeners.

---

## 5. Conclusion

Milestone 2 implementation is **APPROVED**. The Tab Entitas UI is fully modernized to CEISA 4.0 standards, legacy artifacts have been cleanly excised, data controllers are fully functional and backward-compatible, and all 120 feature/boundary tests pass with zero integrity violations.

---

## 6. Verification Method

To independently verify this verdict:

1. **Syntax Check**:
   ```powershell
   node -c pib_dashboard.js
   ```
2. **Execute Full Test Suite**:
   ```powershell
   node tests/e2e/run_tests.js --summary
   ```
   *Expected*: 168 passed, 7 failed (all 7 belonging strictly to M3 / F16).
3. **Execute M2 Features Individually**:
   ```powershell
   node tests/e2e/run_tests.js --feature=F4
   node tests/e2e/run_tests.js --feature=F5
   node tests/e2e/run_tests.js --feature=F6
   node tests/e2e/run_tests.js --feature=F7
   node tests/e2e/run_tests.js --feature=F8
   node tests/e2e/run_tests.js --feature=F9
   node tests/e2e/run_tests.js --feature=F10
   node tests/e2e/run_tests.js --feature=F11
   node tests/e2e/run_tests.js --feature=F12
   node tests/e2e/run_tests.js --feature=F13
   node tests/e2e/run_tests.js --feature=F14
   node tests/e2e/run_tests.js --feature=F15
   ```
   *Expected*: Each prints `10/10 passed [PASS]`.
4. **Adversarial Stress Test**:
   ```powershell
   node -e "const { loadPibDom, loadPibDashboardScript } = require('./tests/e2e/helpers/dom_env'); const { window, document } = loadPibDom(); loadPibDashboardScript(window); window.setupPibCopyHandlers(); document.getElementById('pibPpjkId').value = '0026923485215000'; document.getElementById('btnSyncNitkuPpjk').click(); console.assert(document.getElementById('pibPpjkNitku').value === '0026923485215000000000'); console.log('Adversarial sync check passed');"
   ```
