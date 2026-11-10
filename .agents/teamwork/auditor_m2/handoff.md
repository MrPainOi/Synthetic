# Forensic Audit Report: Milestone 2 (PIB CEISA 4.0 Tab Entitas & Data Controller)

**Work Product**: `c:\Synthetic\pib.html`, `c:\Synthetic\dashboard.css`, `c:\Synthetic\pib_dashboard.js`  
**Profile**: General Project  
**Integrity Mode**: Development (from `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

## 1. Observation

### A. Code Layout & Git Status
- `git status -s` execution result:
  ```
   M dashboard.css
   M pib.html
   M pib_dashboard.js
   M print_hub.html
   M print_hub.js
   M wifi-share.js
  ```
  Modifications for Milestone 2 are strictly restricted to `pib.html`, `dashboard.css`, and `pib_dashboard.js`. `content.js` (Milestone 3 ownership) and core project metadata files were undisturbed. `print_hub.html`, `print_hub.js`, and `wifi-share.js` reflect Milestone 1 completions.

### B. Genuine Removal Verification (No CSS Hiding Cheats)
- Target strings checked in `pib.html`:
  * `.ceisa-doc-topbar`: `git grep -n "ceisa-doc-topbar" pib.html` returned exit code 1 (0 matches).
  * `#btnPibKembali`, `#btnPibUpdateData`, `#btnPibMenuToggle`: `git grep -nE "btnPibKembali|btnPibUpdateData|btnPibMenuToggle" pib.html` returned exit code 1 (0 matches).
  * "FTZ01 - Pemasukan dari Luar Daerah Pabean": `git grep -n "FTZ01 - Pemasukan dari Luar Daerah Pabean" pib.html` returned exit code 1 (0 matches).
  * Legacy PPJK card title ("PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional"): `git grep -n "PPJK (Pengusaha" pib.html` returned exit code 1 (0 matches).
  * Legacy elements (`pibPpjkNpwp`, `pibCheckOwnerSame`, `pibCheckSellerSame`): `git grep -nE "pibCheckOwnerSame|pibCheckSellerSame|pibPpjkNpwp" pib.html` returned exit code 1 (0 matches).
- No inline styles or CSS rules were found setting `display: none` or `visibility: hidden` to simulate removal of the topbar or old PPJK card. They have been genuinely purged from the HTML DOM tree.

### C. 2-Column, 6-Card DOM Structure & Responsiveness
- `pib.html` lines 437-833 directly render:
  * Container: `<div class="ceisa-entitas-grid">`
  * Left column: `<div class="ceisa-entitas-column ceisa-entitas-col-left">` containing 3 cards:
    1. Card 1: **Pengirim** (Button `btnRefPengirim`, Identity split `pibPengirimIdType` + `pibPengirimId`, `pibPengirimName`, `pibPengirimAddress`, `pibPengirimCountry`).
    2. Card 2: **Pembeli** (Buttons `btnHapusPembeli`, `btnCopyPenerimaToPembeli`, Identity split `pibPembeliIdType` + `pibPembeliId`, NITKU input `pibPembeliNitku` [maxlength 22], `pibPembeliName`, `pibPembeliAddress`, `pibPembeliCountry`).
    3. Card 3: **Pemilik Barang** (Buttons `btnCopyPenerimaToPemilik`, `btnRefPemilik`, Identity split `pibPemilikIdType` + `pibPemilikId`, NITKU `pibPemilikNitku` [maxlength 22], `pibPemilikName`, `pibPemilikAddress`, `pibPemilikAfiliasi` [TAH / HUB]).
  * Right column: `<div class="ceisa-entitas-column ceisa-entitas-col-right">` containing 3 cards:
    4. Card 4: **Penerima** (Button `btnRefPenerima`, Identity split `pibPenerimaIdType` + `pibPenerimaId`, NITKU `pibPenerimaNitku` [maxlength 22], `pibPenerimaName`, `pibPenerimaAddress`, `pibPenerimaCountry`, `pibPenerimaStatus` [LAINNYA, API-U, API-P, NON-API, MITA, AEO], `pibPenerimaIjinNo`, `pibPenerimaIjinDate`).
    5. Card 5: **Penjual** (Button `btnCopyPengirimToPenjual`, Identity split `pibPenjualIdType` + `pibPenjualId`, `pibPenjualName`, `pibPenjualAddress`, `pibPenjualCountry`).
    6. Card 6: **PPJK** (Identity split `pibPpjkIdType` + `pibPpjkId`, NITKU `pibPpjkNitku` [maxlength 22] with button `btnSyncNitkuPpjk`, `pibPpjkName`, `pibPpjkAddress`).
  * Stepper navigation: `<div class="ceisa-tab-nav-footer">` with `#btnPrevFromPibEntitas` and `#btnNextFromPibEntitas`.
- `dashboard.css` lines 2410-2460 define genuine CSS grid:
  ```css
  .ceisa-entitas-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px 20px;
      align-items: start;
  }
  @media (max-width: 900px) {
      .ceisa-entitas-grid {
          grid-template-columns: 1fr;
      }
  }
  ```

### D. Anti-Facade & Logic Integrity Verification
- `pib_dashboard.js` was inspected for hardcoded outputs or facade patterns:
  * `collectPibFormData()`: Queries `document.getElementById` dynamically for all 33 entity fields. An independent test injected arbitrary random strings (`TEST_VAL_<rand>_*`) into the DOM; `collectPibFormData()` returned the exact injected random values in both the structured `entitas` contract and backward-compatible root aliases. This confirms it is an authentic data collector and not a hardcoded fixture.
  * `setupPibCopyHandlers()`: Implements real DOM manipulation for all copy actions (`Salin data penerima`, `Hapus Pembeli`, `Salin data pengirim`, `Salin Penerima`) and fires bubbling `input` and `change` events.
  * NITKU Sync Handler: Correctly pads 16-digit NPWPs to 22 digits (`${id}000000`), pads 15-digit NPWPs to 22 digits (`${id}0000000`), and clears invalid shorter inputs safely without crashing.
  * `loadPibDraftData()`: Correctly auto-populates drafts into DOM inputs, applies the Sinar Asia business cascade rule (`PT. SINAR ASIA PACK` -> `GOLDEN BEN PRINTER PTE LTD`, `SG - SINGAPORE`), and provides default fallbacks.

### E. Test Suite Execution Results
- Feature-by-feature execution of Milestone 2 test suites:
  * `node tests/e2e/run_tests.js --feature=F4` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F5` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F6` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F7` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F8` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F9` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F10` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F11` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F12` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F13` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F14` -> 10/10 passed (100.0%)
  * `node tests/e2e/run_tests.js --feature=F15` -> 10/10 passed (100.0%)
- Total Milestone 2 Tests: **120/120 passed (100.0%)**.
- Full test runner (`node tests/e2e/run_tests.js --summary`):
  * Total Tests: 175
  * Passed: 168 (96.0%)
  * Failed: 7 (All 7 failures belong strictly to Milestone 3 / Feature F16 on `content.js` and mock CEISA portal auto-input).

---

## 2. Logic Chain

1. **Premise 1**: The user requirements (`ORIGINAL_REQUEST.md` R2 & R3) demand genuine deletion of `.ceisa-doc-topbar` and the old single-column PPJK card, and genuine construction of a 2-column, 6-card Tab Entitas grid matching CEISA 4.0 format.
2. **Observation Link 1**: Direct DOM inspection and regex search across `pib.html` confirm that `.ceisa-doc-topbar`, its child buttons (`#btnPibKembali`, `#btnPibUpdateData`, `#btnPibMenuToggle`), and the old PPJK card with its obsolete checkboxes (`#pibCheckOwnerSame`, `#pibCheckSellerSame`) have been completely purged from the markup. No CSS hiding rules (`display: none`, `visibility: hidden`) are used to mask lingering elements.
3. **Premise 2**: A genuine implementation must not be a facade returning hardcoded data or dummy fixtures.
4. **Observation Link 2**: Executing independent dynamic data extraction tests proved that modifying DOM input values in real time directly altered the output of `collectPibFormData()`. Event handlers for copying fields between cards and synchronizing NITKU operate directly on DOM state and dispatch real DOM events.
5. **Premise 3**: Code layout constraints require changes to remain scoped to Milestone 2 files.
6. **Observation Link 3**: `git status` verifies that Milestone 2 edits are confined to `pib.html`, `dashboard.css`, and `pib_dashboard.js`. `content.js` remains untouched for Milestone 3.
7. **Conclusion Link**: Because all forensic checks (absence of prohibited patterns, genuine DOM deletion, authentic 2-column 6-card layout, dynamic reactive JS implementation, layout compliance, and 120/120 test pass rate) are verified empirically, the work product is authentic and free of integrity violations.

---

## 3. Caveats

- Milestone 3 (`content.js` auto-input into the CEISA 4.0 portal) is not yet implemented. The 7 failing tests in `tests/e2e/run_tests.js --summary` correspond strictly to Feature F16 (`handleCeisaAutoInputRow` in `content.js`) and its mock portal integration tests (`TC-T3-05`, `TC-T4-01`). This is expected per `PROJECT.md` milestone sequencing.
- No caveats regarding Milestone 2 deliverables.

---

## 4. Conclusion

**Verdict: CLEAN**

The Milestone 2 work product genuinely fulfills all acceptance criteria:
- Complete removal of `.ceisa-doc-topbar` and legacy PPJK card without CSS hiding tricks.
- Authentic 2-column, 6-card Tab Entitas architecture matching CEISA 4.0 specifications with responsive collapse at <= 900px.
- Dynamic, non-facade implementation of `collectPibFormData()`, `loadPibDraftData()`, `setupPibCopyHandlers()`, and NITKU synchronization.
- 100% pass rate (120/120) across all Milestone 2 test suites (F4 through F15).
- Full compliance with code layout discipline.

---

## 5. Verification Method

To independently reproduce the forensic verification findings:

1. **Verify Genuine DOM Deletion (Regex Search)**:
   ```powershell
   git grep -nE "ceisa-doc-topbar|btnPibKembali|btnPibUpdateData|pibCheckOwnerSame|pibPpjkNpwp" pib.html
   ```
   *Expected output*: No matches (exit code 1).

2. **Verify 2-Column CSS Grid**:
   ```powershell
   git grep -n "grid-template-columns: repeat(2" dashboard.css
   ```
   *Expected output*: Matches line defining `.ceisa-entitas-grid`.

3. **Execute All Milestone 2 Feature Tests**:
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
   *Expected output*: 10/10 passed [PASS] for each feature.

4. **Execute Independent DOM & JS Stress Test**:
   ```powershell
   node -e "
   const fs = require('fs');
   const { JSDOM } = require('jsdom');
   const html = fs.readFileSync('pib.html', 'utf8');
   const js = fs.readFileSync('pib_dashboard.js', 'utf8');
   const dom = new JSDOM(html, { runScripts: 'outside-only' });
   dom.window.localStorage = { getItem: () => null, setItem: () => {} };
   dom.window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
   dom.window.eval(js);
   dom.window.setupPibCopyHandlers();
   dom.window.document.getElementById('pibPengirimName').value = 'TEST_RANDOM_SHIPPER';
   const collected = dom.window.collectPibFormData();
   if (collected.entitas.pengirim.nama !== 'TEST_RANDOM_SHIPPER') throw new Error('Facade detected!');
   console.log('Independent Verification: CLEAN');
   "
   ```
   *Expected output*: `Independent Verification: CLEAN`.
