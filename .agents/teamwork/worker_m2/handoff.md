# Milestone 2 Handoff Report: PIB CEISA 4.0 Tab Entitas & Data Controller

## 1. Observation
- **Modified Source Files**:
  1. `c:\Synthetic\pib.html`:
     - Lines 88-120: Removed `.ceisa-doc-topbar` containing "FTZ01 - Pemasukan dari Luar Daerah Pabean", `#btnPibKembali`, `#btnPibUpdateData`, and `#btnPibMenuToggle`. Main workspace `#pib-tab-entitas` is directly displayed under `#pibTabsNav`.
     - Lines 125-285: Removed the legacy single-column PPJK card (`grid-column: span 2`) and obsolete checkboxes (`#pibCheckOwnerSame`, `#pibCheckSellerSame`). Replaced with `.ceisa-entitas-grid` containing two independent vertical columns:
       - `.ceisa-entitas-col-left`:
         * Card 1 (**Pengirim**): Button `btnRefPengirim` / `btnPibPengirimRef`, split identity `pibPengirimJenisIdentitas` (options 0, 1, 2, 4 default, 5) + `pibPengirimNomorIdentitas`, `pibPengirimNama`, `pibPengirimAlamat`, `pibPengirimNegara` (foreign country options with default `CN - CHINA`).
         * Card 2 (**Pembeli**): Buttons `btnHapusPembeli` / `btnPibHapusPembeli` and `btnCopyPenerimaToPembeli` / `btnPibSalinPenerimaKePembeli`, split identity `pibPembeliJenisIdentitas` (default 6) + `pibPembeliNomorIdentitas`, NITKU input `pibPembeliNitku` (maxlength 22), `pibPembeliNama`, `pibPembeliAlamat`, `pibPembeliNegara`.
         * Card 3 (**Pemilik Barang**): Buttons `btnCopyPenerimaToPemilik` / `btnPibSalinPenerimaKePemilik` and `btnRefPemilik` / `btnPibPemilikRef`, split identity `pibPemilikJenisIdentitas` + `pibPemilikNomorIdentitas`, NITKU input `pibPemilikNitku` (maxlength 22), `pibPemilikNama`, `pibPemilikAlamat`, and `pibPemilikAfiliasi` (options 'TAH - Tidak berhubungan' default, 'HUB - Berhubungan').
       - `.ceisa-entitas-col-right`:
         * Card 4 (**Penerima**): Button `btnRefPenerima` / `btnPibPenerimaRef`, split identity `pibPenerimaJenisIdentitas` + `pibPenerimaNomorIdentitas`, NITKU input `pibPenerimaNitku` (maxlength 22), `pibPenerimaNama`, `pibPenerimaAlamat`, `pibPenerimaNegara` (default 'ID - INDONESIA'), `pibPenerimaStatus` (default 'LAINNYA'), `pibPenerimaIjinBpNo`, and `pibPenerimaIjinBpTgl` (type date).
         * Card 5 (**Penjual**): Button `btnCopyPengirimToPenjual` / `btnPibSalinPengirimKePenjual`, split identity `pibPenjualJenisIdentitas` + `pibPenjualNomorIdentitas`, `pibPenjualNama`, `pibPenjualAlamat`, `pibPenjualNegara`.
         * Card 6 (**PPJK**): Split identity `pibPpjkJenisIdentitas` + `pibPpjkNomorIdentitas`, NITKU input `pibPpjkNitku` (maxlength 22) with sync button `btnSyncNitkuPpjk` / `pibBtnSyncNitkuPpjk`, `pibPpjkNama`, `pibPpjkAlamat`.
     - Lines 287-295: Added `.ceisa-tab-nav-footer` with navigation buttons `btnPrevFromPibEntitas` ("Sebelumnya: Header") and `btnNextFromPibEntitas` ("Berikutnya: Dokumen").
  2. `c:\Synthetic\dashboard.css`:
     - Lines 1250-1360: Added `.ceisa-entitas-grid` (CSS Grid 2-column `1fr 1fr`, gap `16px`, `align-items: start;`), `.ceisa-entitas-column`, `.ceisa-entitas-col-left`, `.ceisa-entitas-col-right` (`display: flex; flex-direction: column; gap: 16px; min-width: 0;`), `.ceisa-entitas-card`, `.ceisa-tab-nav-footer`, and media query `@media (max-width: 900px)` stacking columns vertically (`grid-template-columns: 1fr;`).
  3. `c:\Synthetic\pib_dashboard.js`:
     - Lines 65-175: Updated `SAMPLE_PIB_DATA` to include full 6-card fields and nested `entitas` structure while retaining backward-compatible root aliases.
     - Lines 445-640: Re-implemented `collectPibFormData()`:
       * Collects values from all 6 cards via primary and fallback DOM IDs.
       * Assembles standard CEISA 4.0 nested structure: `entitas.pengirim`, `entitas.pembeli`, `entitas.pemilikBarang`, `entitas.penerima`, `entitas.penjual`, `entitas.ppjk`.
       * Flattens root keys in both English and Indonesian naming (`pengirimName`, `pengirimNama`, `pembeliName`, `pembeliNama`, `pemilikName`, `pemilikNama`, `penerimaName`, `penerimaNama`, `penjualName`, `penjualNama`, `ppjkName`, `ppjkNama`, `ppjkNitku`, etc.).
       * Maintains 100% backward compatibility for downstream calculation and storage formulas: `importirName`, `importirAddress`, `importirId`, `importirStatus`, `supplierName`, `supplierAddress`, `supplierCountry`, `consigneeName`, `consigneeAddress`, `ownerName`, `ownerAddress`, `ownerId`.
     - Lines 810-1010: Re-implemented `loadPibDraftData()`:
       * Supports loading from nested `data.entitas`, flat root properties, or legacy `importir*`/`supplier*` aliases.
       * Implements Sinar Asia business rule: regex `/sinar\s*asia/i` on importer/penerima automatically cascades Singapore shipper `GOLDEN BEN PRINTER PTE LTD`, `10 Ubi Crescent #01-02, Singapore 408564`, and `SG - SINGAPORE`.
       * Automatic fallback defaults when omitted: Pembeli cascades from Penerima; Penjual cascades from Pengirim; Pemilik cascades from Penerima.
       * NITKU auto-derivation: 16-digit NPWP is padded to 22 digits (`${npwp}000000`).
       * Safe string coercion: coerces numbers and avoids literal string `"null"` or `"undefined"` when draft fields are nullish.
       * Dual-populates both new 6-card DOM elements and hidden/legacy backward-compatibility inputs.
     - Lines 2120-2240: Implemented `setupPibCopyHandlers()`:
       * `Salin data penerima`: Copies Penerima identity, NITKU, name, address, and country to Pembeli; dispatches `input` and `change` events.
       * `Hapus Pembeli`: Clears Pembeli fields to empty strings `''`; dispatches events.
       * `Salin data pengirim`: Copies Pengirim identity, name, address, and country to Penjual; dispatches events.
       * `Salin Penerima`: Copies Penerima identity, NITKU, name, and address to Pemilik Barang while preserving Afiliasi; dispatches events.
       * `Sync NITKU PPJK`: Validates digit length of `pibPpjkId`. If 15-16 digits, pads with zeroes to 22 digits; if 22 digits, maintains value; if <15 digits, clears or preserves safely without corrupting.
     - Global attachments: `window.collectPibFormData`, `window.loadPibDraftData`, `window.populatePibForm`, and `window.setupPibCopyHandlers` are bound to `window` for test harness and cross-script invocation.
     - Stepper navigation: Click listeners bound for `#btnPrevFromPibEntitas` (navigating to `#pib-tab-header`) and `#btnNextFromPibEntitas` (navigating to `#pib-tab-dokumen`).

- **Test Commands & Verifications**:
  1. `node -c pib_dashboard.js`: Passed with zero syntax errors.
  2. Feature-by-Feature Execution (`tests/e2e/run_tests.js`):
     - `node tests/e2e/run_tests.js --feature=F4` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F5` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F6` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F7` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F8` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F9` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F10` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F11` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F12` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F13` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F14` -> 10/10 passed (100.0%)
     - `node tests/e2e/run_tests.js --feature=F15` -> 10/10 passed (100.0%)
  3. Total Milestone 2 Features: 12 features, 120/120 tests passed (100.0% pass rate).
  4. Global Test Suite (`node tests/e2e/run_tests.js --summary`):
     - Total tests: 175
     - Passed: 168 (96.0%)
     - Failed: 7 (All 7 failures are exclusively within Milestone 3 scope: 5 tests in Feature F16 in `content.js`, plus 2 integration tests TC-T3-05 and TC-T4-01 that invoke `handleCeisaAutoInputRow` on the mock CEISA portal DOM).

## 2. Logic Chain
- Step 1: In accordance with `PROJECT.md` and user screenshots, the legacy `.ceisa-doc-topbar` and single-span PPJK card presented an obsolete UI and caused broken grid column spans. Removing them and establishing `.ceisa-entitas-grid` with two vertical column containers (`.ceisa-entitas-col-left` and `.ceisa-entitas-col-right`) organizes all 6 entities in parallel 3x3 layout.
- Step 2: Providing dual-id fallbacks on all inputs and buttons (e.g. `pibPengirimNama` / `pibPengirimName`, `btnRefPengirim` / `btnPibPengirimRef`) guarantees compatibility with both older template conventions and strict CEISA 4.0 camelCase / snake_case selectors.
- Step 3: By structuring `collectPibFormData()` to output both the nested `entitas` structure (as required by M2 ↔ M3 contract in `PROJECT.md`) and the flat root aliases (`importirName`, `supplierName`, `importirStatus`), all downstream CIF, Bea Masuk, PPh calculation formulas, and validation alerts continue functioning without regressions.
- Step 4: By implementing `setupPibCopyHandlers()` with event dispatching (`input` and `change`), copying from Penerima to Pembeli/Pemilik or Pengirim to Penjual automatically triggers the existing debounced auto-save timer and recalculation triggers.
- Step 5: By ensuring `loadPibDraftData()` cascades Pembeli from Penerima and Penjual from Pengirim when omitted, legacy drafts lacking the new entities automatically populate a valid, complete 6-card form.

## 3. Caveats
- `content.js` was not modified in Milestone 2 because its ownership belongs to Milestone 3 (Feature F16). Consequently, tests that test auto-inputting into the CEISA portal via `handleCeisaAutoInputRow` (TC-T1-F16-02, TC-T1-F16-03, TC-T1-F16-04, TC-T2-F16-03, TC-T2-F16-04, TC-T3-05, TC-T4-01) remain pending for Milestone 3 implementation.
- All modifications are strictly restricted to `c:\Synthetic\pib.html`, `c:\Synthetic\dashboard.css`, and `c:\Synthetic\pib_dashboard.js`.

## 4. Conclusion
Milestone 2 implementation is 100% complete and fully verified.
- The PIB interface matches CEISA 4.0 specifications: topbar and old PPJK removed; 2-column, 6-card Tab Entitas grid implemented with responsive mobile layout; copy buttons, NITKU sync, and stepper navigation functional.
- Data collection and population controllers are fully modernized and backward-compatible.
- 120 out of 120 Milestone 2 tests (F4 through F15) pass cleanly without any failures or regressions.

## 5. Verification Method
To independently verify the implementation:
1. Syntax validation:
   ```powershell
   node -c pib_dashboard.js
   ```
   (Must output zero errors).
2. Execute all Milestone 2 feature test suites individually:
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
   Each command will report: `10/10 passed [PASS]`.
3. Execute full suite summary:
   ```powershell
   node tests/e2e/run_tests.js --summary
   ```
   Reports: 168 passed, 7 failed (all 7 belonging to Milestone 3 / F16).
4. Inspect modified files:
   - `c:\Synthetic\pib.html` (Tab Entitas grid and cards)
   - `c:\Synthetic\dashboard.css` (Grid styling and media query)
   - `c:\Synthetic\pib_dashboard.js` (`collectPibFormData`, `loadPibDraftData`, `setupPibCopyHandlers`)
