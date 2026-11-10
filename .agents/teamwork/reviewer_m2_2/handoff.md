# Reviewer 2 Handoff Report: Milestone 2 Review & Adversarial Audit

**Verdict**: **APPROVE**  
**Role**: Reviewer 2 & Adversarial Critic  
**Target Milestone**: Milestone 2 (PIB CEISA 4.0 Tab Entitas & Data Controller)  
**Date**: 2026-11-10T05:28:00Z  

---

## 1. Observation

### Source Code Inspections
1. **`c:\Synthetic\pib.html`**:
   - Lines 88-120: `.ceisa-doc-topbar` (including "FTZ01 - Pemasukan dari Luar Daerah Pabean", `#btnPibKembali`, `#btnPibUpdateData`, and `#btnPibMenuToggle`) is completely removed from the DOM.
   - Lines 435-742: Replaced old single-column PPJK card (`grid-column: span 2`, `#pibPpjkNpwp`, `#pibCheckOwnerSame`, `#pibCheckSellerSame`) with `.ceisa-entitas-grid` containing two distinct columns:
     - **Left Column (`.ceisa-entitas-col-left`)**:
       * Card 1 (**Pengirim**): Button `#btnRefPengirim`, split identity `#pibPengirimIdType` (default `4 - LAINNYA`) + `#pibPengirimId`, `#pibPengirimName`, `#pibPengirimAddress`, `#pibPengirimCountry` (default `CN - CHINA`).
       * Card 2 (**Pembeli**): Buttons `#btnHapusPembeli` and `#btnCopyPenerimaToPembeli`, split identity `#pibPembeliIdType` (default `6 - NPWP 16 DIGIT`) + `#pibPembeliId`, `#pibPembeliNitku` (maxlength 22), `#pibPembeliName`, `#pibPembeliAddress`, `#pibPembeliCountry` (default `ID - INDONESIA`).
       * Card 3 (**Pemilik Barang**): Buttons `#btnCopyPenerimaToPemilik` and `#btnRefPemilik`, split identity `#pibPemilikIdType` (default `6 - NPWP 16 DIGIT`) + `#pibPemilikId`, `#pibPemilikNitku` (maxlength 22), `#pibPemilikName`, `#pibPemilikAddress`, `#pibPemilikAfiliasi` (options `TAH - Tidak berhubungan` [default], `HUB - Berhubungan`).
     - **Right Column (`.ceisa-entitas-col-right`)**:
       * Card 4 (**Penerima**): Button `#btnRefPenerima`, split identity `#pibPenerimaIdType` (default `6 - NPWP 16 DIGIT`) + `#pibPenerimaId`, `#pibPenerimaNitku` (maxlength 22), `#pibPenerimaName`, `#pibPenerimaAddress`, `#pibPenerimaCountry` (default `ID - INDONESIA`), `#pibPenerimaStatus` (default `LAINNYA`), split inputs `#pibPenerimaIjinNo` and `#pibPenerimaIjinDate`.
       * Card 5 (**Penjual**): Button `#btnCopyPengirimToPenjual`, split identity `#pibPenjualIdType` (default `4 - LAINNYA`) + `#pibPenjualId`, `#pibPenjualName`, `#pibPenjualAddress`, `#pibPenjualCountry` (default `CN - CHINA`).
       * Card 6 (**PPJK**): Split identity `#pibPpjkIdType` (default `6 - NPWP 16 DIGIT`) + `#pibPpjkId`, `#pibPpjkNitku` (maxlength 22) with sync button `#btnSyncNitkuPpjk`, `#pibPpjkName`, `#pibPpjkAddress`.
   - Lines 822-832: Stepper navigation footer `.ceisa-tab-nav-footer` with `#btnPrevFromPibEntitas` (`data-target-tab="pib-tab-header"`) and `#btnNextFromPibEntitas` (`data-target-tab="pib-tab-dokumen"`).

2. **`c:\Synthetic\dashboard.css`**:
   - Lines 2412-2460: Modern 2-column layout defined via:
     ```css
     .ceisa-entitas-grid {
         display: grid;
         grid-template-columns: repeat(2, minmax(0, 1fr));
         gap: 16px 20px;
         align-items: start;
     }
     .ceisa-entitas-column, .ceisa-entitas-col-left, .ceisa-entitas-col-right {
         display: flex;
         flex-direction: column;
         gap: 16px;
     }
     @media (max-width: 900px) {
         .ceisa-entitas-grid {
             grid-template-columns: 1fr;
         }
     }
     ```
   - Legacy `.ceisa-doc-topbar` styles remain harmlessly declared without elements targeting them.

3. **`c:\Synthetic\pib_dashboard.js`**:
   - Lines 428-643: `collectPibFormData()` extracts all 6 cards, produces standard nested contract `entitas: { pengirim, pembeli, pemilikBarang, penerima, penjual, ppjk }`, and exposes flat Indonesian/English aliases as well as backward-compatible legacy keys (`importirName`, `supplierName`, `ownerName`, `consigneeName`, `sellerName`, etc.).
   - Lines 821-1007: `loadPibDraftData()` supports both nested `data.entitas` and flat keys, handles null/undefined safely, coerces numbers to strings, cascades omitted entities, derives 22-digit NITKUs from 16-digit NPWPs, and honors the Sinar Asia business rule.
   - Lines 2107-2244: `setupPibCopyHandlers()` binds copy actions with `_pibCopyBound` deduplication guards, dispatches bubbling `input` and `change` events, and validates NITKU synchronization for 15, 16, and 22 digits.
   - Lines 2278-2297: Stepper navigation click listeners switch tabs between Header, Entitas, and Dokumen.
   - Lines 2633-2637: Global exposure on `window` (`collectPibFormData`, `loadPibDraftData`, `populatePibForm`, `setupPibCopyHandlers`).

### Verification & Test Execution Results
1. **Milestone 2 Features (F4 through F15)**:
   - `node tests/e2e/run_tests.js --feature=F4`  -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F5`  -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F6`  -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F7`  -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F8`  -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F9`  -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F10` -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F11` -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F12` -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F13` -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F14` -> 10/10 passed [PASS]
   - `node tests/e2e/run_tests.js --feature=F15` -> 10/10 passed [PASS]
   - Total Milestone 2 Features: **120 / 120 tests passed (100.0%)**.

2. **Full Test Suite (`node tests/e2e/run_tests.js --summary`)**:
   - Total Tests: 175
   - Passed: 168 (96.0%)
   - Failed: 7 (All 7 are strictly in Milestone 3 scope: TC-T1-F16-02, TC-T1-F16-03, TC-T1-F16-04, TC-T2-F16-03, TC-T2-F16-04 in `content.js`, plus mock portal auto-input integration tests TC-T3-05 and TC-T4-01).

3. **Integrity Audit**:
   - Regex scans across `pib_dashboard.js` and `pib.html` for `TC-`, `mock`, or hardcoded test expected values returned zero cheating or dummy facades. Implementations perform real DOM queries, event dispatches, string transformations, and state synchronization.

4. **Adversarial Stress Testing**:
   - Deduplication / Event Stacking: Executing `setupPibCopyHandlers()` 20 times resulted in exactly 1 event dispatched per user click (`_pibCopyBound` works as intended).
   - Afiliasi Preservation: Repeatedly clicking "Salin Penerima" left `pibPemilikAfiliasi` intact (`HUB - Berhubungan`).
   - NITKU Boundaries:
     * 15-digit NPWP -> padded with 7 zeros to 22 digits (`1234567890123450000000`)
     * Formatted NPWP (`01.234.567.8-012.000`) -> sanitized and padded to 22 digits (`0123456780120000000000`)
     * 16-digit NPWP -> padded with 6 zeros to 22 digits
     * 22-digit NPWP -> preserved verbatim
     * Short (<15 digits) or alphabetic inputs -> safely cleared to empty string `''`
   - Malformed Inputs: `null`, `undefined`, numbers, empty objects, missing sub-objects do not throw runtime exceptions.
   - XSS / Unicode Roundtrip: Special characters (`<script>`, unicode `🏮`, multiline strings) survive `loadPibDraftData` -> `collectPibFormData` roundtrip without corruption.
   - Sinar Asia Business Rule: Regex variations (`pt. sinar  asia  pack indonesia`) correctly trigger cascade of Golden Ben Printer Pte Ltd / Singapore.

---

## 2. Logic Chain

1. **Top-Bar & Legacy PPJK Removal**:
   - Inspection of `pib.html` lines 88-120 and lines 435-742 demonstrates that `.ceisa-doc-topbar`, `#btnPibKembali`, `#btnPibUpdateData`, and the legacy span-2 PPJK card were deleted.
   - Tests `TC-T1-F4-01` through `TC-T1-F4-05` and `TC-T1-F5-01` through `TC-T1-F5-05` pass, confirming complete DOM removal and clean layout continuity without orphaned offsets.

2. **CEISA 4.0 Layout Compliance**:
   - The Tab Entitas DOM structure matches the 2-column screenshot layout specified in `ORIGINAL_REQUEST.md` (Pengirim, Pembeli, Pemilik Barang on the left; Penerima, Penjual, PPJK on the right).
   - CSS Grid with `repeat(2, minmax(0, 1fr))` and a 900px responsive breakpoint ensures clean rendering on both desktop and mobile viewports (`TC-T1-F6-01` through `TC-T2-F6-05` pass).

3. **Data Controller & Copy Actions**:
   - `setupPibCopyHandlers()` implements the 4 copy actions, "Hapus Pembeli", and NITKU synchronization with standard DOM events.
   - The implementation was stress-tested against rapid successive clicks and duplicate initialization, demonstrating full idempotence.
   - `collectPibFormData()` fulfills the M2 ↔ M3 contract in `PROJECT.md` by emitting the structured `entitas` tree while guaranteeing backward-compatibility for existing calculation pipelines.
   - `loadPibDraftData()` supports both modernized and legacy schemas, with graceful fallback cascading.

4. **Integrity & Quality**:
   - Verification of the codebase proves zero integrity violations. No test-specific conditions, mock facades, or shortcuts exist in `pib.html`, `dashboard.css`, or `pib_dashboard.js`.

---

## 3. Caveats

- **Milestone 3 Dependency**: The 7 failing tests in `tests/e2e/run_tests.js` (TC-T1-F16-02, TC-T1-F16-03, TC-T1-F16-04, TC-T2-F16-03, TC-T2-F16-04, TC-T3-05, TC-T4-01) test the content script (`content.js`) injecting values into the CEISA 4.0 portal form DOM. Because `content.js` belongs strictly to Milestone 3 (F16), these failures are expected and do not reflect any defect in Milestone 2.
- **Scope Restriction**: Review was strictly confined to `pib.html`, `dashboard.css`, and `pib_dashboard.js` as prescribed.

---

## 4. Conclusion

Milestone 2 implementation is **complete, robust, fully tested, and verified**.
- Requirements R2, R3, and R4 are satisfied.
- 120/120 Milestone 2 automated E2E tests pass (100.0%).
- All adversarial stress tests pass without regressions or vulnerabilities.
- Zero integrity violations detected.

**Final Verdict**: **APPROVE**

---

## 5. Verification Method

To independently reproduce and verify this review:
1. Syntax validation:
   ```powershell
   node -c pib_dashboard.js
   ```
2. Verify all Milestone 2 feature test suites individually:
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
   *Expected result*: Every feature reports `10/10 passed [PASS]`.
3. Check overall test suite summary:
   ```powershell
   node tests/e2e/run_tests.js --summary
   ```
   *Expected result*: 168 passed, 7 failed (strictly F16/M3).
4. Inspect DOM structure in `pib.html` (lines 435-742) and styles in `dashboard.css` (lines 2412-2460).
