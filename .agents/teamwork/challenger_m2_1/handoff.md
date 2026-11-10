# Milestone 2 Challenge Report: PIB CEISA 4.0 Tab Entitas & Data Controller

**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Test Suite & Baseline Execution
- **Baseline Feature Tests**:
  Command: `node tests/e2e/run_tests.js --feature=F[4..15]`
  Output: 120/120 passed across all 12 Milestone 2 features (F4 through F15).
- **Syntax Check**:
  Command: `node -c pib_dashboard.js`
  Output: Zero syntax errors.

### 1.2 Empirical Stress Harness Execution
- Executed empirical challenge suite (`node tests/challenger_stress_m2.js`):
  Output: 26 passed, 2 failed out of 28 stress test cases (92.9% pass rate).
  ```
  STRESS TEST SUMMARY: 26/28 passed (92.9%)
  FAILED TESTS: 2
  ```

### 1.3 Confirmed Defect Observations

#### Defect 1 (High Severity): `calculatePibPungutan` ignores `#pibPenerimaStatus`, breaking PPh 22 calculation for `NON-API`
- **Location**: `c:\Synthetic\pib_dashboard.js:360`
  ```javascript
  const tarifBm = parseFloat(document.getElementById('pibTarifBm')?.value) || 0;
  const importirStatus = document.getElementById('pibImportirStatus')?.value || 'API-U';
  ```
- **Observed Behavior**:
  - In `pib.html`, the legacy input `#pibImportirStatus` was deleted during M2 refactoring and replaced by `#pibPenerimaStatus` in Card 4 (Penerima).
  - `document.getElementById('pibImportirStatus')` returns `null`.
  - When a user selects `<option value="NON-API">` in `#pibPenerimaStatus`, `calculatePibPungutan()` fails to read it and defaults to `'API-U'`.
  - In lines 384-388:
    ```javascript
    let pphRate = 0.025;
    if (importirStatus === 'NON-API') {
        pphRate = 0.075;
    }
    const nilaiPph = Math.round(nilaiImpor * pphRate);
    ```
    `pphRate` remains `0.025` (2.5%) instead of `0.075` (7.5%).
  - Verbatim Test Failure:
    ```
    ✗ Defect 5.1: calculatePibPungutan must react to pibPenerimaStatus (NON-API -> 7.5% PPh)
       Error: PPh for NON-API must differ from API-U (7.5% vs 2.5%)
    ```

#### Defect 2 (Medium Severity): `#btnPibAddItem` defaults new items to `CN - CHINA` instead of Card 1 `#pibPengirimCountry`
- **Location**: `c:\Synthetic\pib_dashboard.js:2519`
  ```javascript
  const country = document.getElementById('pibSupplierCountry')?.value || 'CN - CHINA';
  ```
- **Observed Behavior**:
  - In `pib.html`, legacy element `#pibSupplierCountry` was deleted during M2 refactoring and replaced by `#pibPengirimCountry` in Card 1 (Pengirim).
  - `document.getElementById('pibSupplierCountry')` returns `null`.
  - When `#pibPengirimCountry` is set to any non-China origin (e.g. `JP - JAPAN`, `DE - GERMANY`, `SG - SINGAPORE`), clicking `+ Tambah Barang` (`#btnPibAddItem`) creates a new item with `countryOfOrigin: 'CN - CHINA'`.
  - Verbatim Test Failure:
    ```
    ✗ Defect 5.2: Adding a new item in Tab Barang must adopt countryOfOrigin from pibPengirimCountry
       Error: Expected new item country to be JP - JAPAN from pibPengirimCountry, got CN - CHINA
    + actual - expected
    + 'CN - CHINA'
    - 'JP - JAPAN'
    ```

### 1.4 Successfully Verified Features
- **Copy Button Sequences**:
  - `btnCopyPenerimaToPembeli` followed by `btnHapusPembeli` completely clears Pembeli (`name`, `id`, `nitku`, `address` = `''`) while leaving Penerima 100% intact.
  - `btnCopyPenerimaToPemilik` preserves `pibPemilikAfiliasi` both when set to default `'TAH - Tidak berhubungan'` and when set to `'HUB - Berhubungan'`.
  - `btnCopyPengirimToPenjual` preserves foreign country selections (`DE - GERMANY`, `JP - JAPAN`, `SG - SINGAPORE`, `US - UNITED STATES`).
  - Both `input` and `change` events are dispatched on target elements upon copy and delete actions.
  - Cyclical executions (Salin -> Hapus -> Salin -> Hapus) are fully idempotent without listener duplication.
- **NITKU Sync**:
  - 15-digit NPWP (e.g. `012345678901234`) pads with 7 zeroes to 22 digits (`0123456789012340000000`).
  - 16-digit NPWP (e.g. `0123456789012345`) pads with 6 zeroes to 22 digits (`0123456789012345000000`).
  - 22-digit NITKU remains untouched at 22 digits.
  - Formatted NPWP with punctuation (`01.234.567.8-901.000`) is sanitized and padded to 22 digits.
  - Invalid lengths (<15 digits, 17 digits, empty, or alphanumeric) safely clear `pibPpjkNitku` without throwing.
- **Roundtrip Serialization**:
  - All 6 cards serialize to JSON and restore from JSON with 100% field equality.
  - Special characters (`"`, `'`, `&`, `<`, `>`, newlines `\n`, German umlauts `Ü`, `Ö`) survive roundtrip serialization without corruption.
  - Cleared Pembeli (empty string) survives roundtrip without erroneously re-cascading from Penerima.
  - Sinar Asia rule correctly auto-populates Singapore shipper `GOLDEN BEN PRINTER PTE LTD` and country `SG - SINGAPORE`.
- **DOM & CSS Structure**:
  - `.ceisa-doc-topbar`, `#btnPibKembali`, and `#btnPibUpdateData` are completely removed from `pib.html`.
  - Old single-column PPJK card (`#pibPpjkNpwp`) is completely removed from `pib.html`.
  - `.ceisa-entitas-grid` contains `.ceisa-entitas-col-left` (Pengirim, Pembeli, Pemilik Barang) and `.ceisa-entitas-col-right` (Penerima, Penjual, PPJK).
  - Stepper navigation buttons `#btnPrevFromPibEntitas` and `#btnNextFromPibEntitas` function correctly.
  - CSS contains 2-column grid and `@media (max-width: 900px)` single-column rule.

---

## 2. Logic Chain

1. **Defect 1 Chain**:
   - `ORIGINAL_REQUEST.md` (R3, R4) and `PROJECT.md` (F10, F14) require Tab Entitas to use Card 4 (Penerima) with field `pibPenerimaStatus`.
   - In `initPibDashboard()` (lines 2329-2330), the author added `'pibPenerimaStatus'` to `calcTriggers`, confirming the intention for changes to `pibPenerimaStatus` to recompute taxes via `calculatePibPungutan()`.
   - However, in `calculatePibPungutan()` (line 360), the implementation reads exclusively from `document.getElementById('pibImportirStatus')?.value || 'API-U'`.
   - Because `#pibImportirStatus` no longer exists in `pib.html`, `document.getElementById('pibImportirStatus')` is always `null`.
   - As observed in Defect 5.1 test, switching `#pibPenerimaStatus` to `'NON-API'` never updates `importirStatus`, leaving `pphRate` stuck at `2.5%` instead of `7.5%`. This causes undercalculation of PIB tax billing.

2. **Defect 2 Chain**:
   - In M2, the legacy `#pibSupplierCountry` element was replaced with `#pibPengirimCountry` in Card 1 (Pengirim).
   - In `pib_dashboard.js:2519`, the item creation handler `#btnPibAddItem` queries:
     `const country = document.getElementById('pibSupplierCountry')?.value || 'CN - CHINA';`
   - Because `#pibSupplierCountry` is not in `pib.html`, `document.getElementById('pibSupplierCountry')` is always `null`.
   - As observed in Defect 5.2 test, even when `#pibPengirimCountry` is set to `JP - JAPAN`, newly added items always receive `countryOfOrigin: 'CN - CHINA'`.

3. **Conclusion Chain**:
   - Because both defects represent functional regressions in downstream logic caused by referencing obsolete DOM IDs without fallback to the new CEISA 4.0 elements, changes must be requested before Milestone 2 can be approved.

---

## 3. Caveats
- No changes to implementation files (`pib_dashboard.js`, `pib.html`, `dashboard.css`) were made by Challenger 1, adhering strictly to review-only constraints.
- Content script integration (`content.js` / F16) was not evaluated as it is explicitly assigned to Milestone 3.
- The test harness `tests/challenger_stress_m2.js` was written and executed in `tests/` to provide reproducible regression checks.

---

## 4. Conclusion
**Verdict**: **REQUEST_CHANGES**

Milestone 2 implementation is well-structured and passes 26 out of 28 empirical stress tests, but requires two straightforward one-line fixes in `pib_dashboard.js`:

1. **Fix `calculatePibPungutan` to read `#pibPenerimaStatus`** (`pib_dashboard.js:360`):
   ```javascript
   // Replace:
   const importirStatus = document.getElementById('pibImportirStatus')?.value || 'API-U';
   // With:
   const importirStatus = document.getElementById('pibPenerimaStatus')?.value || document.getElementById('pibImportirStatus')?.value || 'API-U';
   ```

2. **Fix `#btnPibAddItem` to read `#pibPengirimCountry`** (`pib_dashboard.js:2519`):
   ```javascript
   // Replace:
   const country = document.getElementById('pibSupplierCountry')?.value || 'CN - CHINA';
   // With:
   const country = document.getElementById('pibPengirimCountry')?.value || document.getElementById('pibSupplierCountry')?.value || 'CN - CHINA';
   ```

Once Worker M2 applies these two fallback queries, all 28 stress tests and downstream calculation/item flows will pass with 100% compliance.

---

## 5. Verification Method

To independently reproduce the failures:
1. Run the challenger stress harness:
   ```powershell
   node tests/challenger_stress_m2.js
   ```
   Observed result: Exits with code 1, reporting failures in `Defect 5.1` and `Defect 5.2`.

2. Isolated Reproduction Commands:
   - For Defect 5.1 (PPh 22 rate undercalculation):
     ```powershell
     node -e "const { loadPibDom, loadPibDashboardScript } = require('./tests/e2e/helpers/dom_env'); const { window, document } = loadPibDom(); loadPibDashboardScript(window); document.getElementById('pibInvoiceAmount').value = 10000; document.getElementById('pibExchangeRate').value = 10000; document.getElementById('pibTarifBm').value = 0; document.getElementById('pibPenerimaStatus').value = 'NON-API'; window.calculatePibPungutan(); console.log('PPh:', document.getElementById('pibPungutanNilaiPph').value);"
     ```
     Observed: Prints `Rp 2.500.000` (2.5%) instead of `Rp 7.500.000` (7.5%).

   - For Defect 5.2 (Item country-of-origin defaulting):
     ```powershell
     node -e "const { loadPibDom, loadPibDashboardScript } = require('./tests/e2e/helpers/dom_env'); const { window, document } = loadPibDom(); window.HTMLElement.prototype.scrollIntoView = () => {}; loadPibDashboardScript(window); window.initPibDashboard(); document.getElementById('pibPengirimCountry').value = 'JP - JAPAN'; document.getElementById('btnPibAddItem').click(); console.log('Country:', window._pibItems[window._pibItems.length - 1].countryOfOrigin);"
     ```
     Observed: Prints `CN - CHINA` instead of `JP - JAPAN`.

3. Invalidation Conditions:
   - When Worker M2 adds `pibPenerimaStatus` and `pibPengirimCountry` lookups to lines 360 and 2519, `node tests/challenger_stress_m2.js` will exit with code 0 (28/28 passed, 100.0%).
