# CEISA 4.0 E2E Test Infrastructure & Specification Matrix

**Integrity Mode**: Production / Development Verification  
**Test Harness**: Node.js 24 + JSDOM + Isolated VM Sandboxing  
**Scope**: Print Hub (`print_hub.html`, `print_hub.js`), PIB Tab Entitas (`pib.html`, `pib_dashboard.js`, `dashboard.css`), CEISA 4.0 Auto-Input (`content.js`).

---

## 1. Architecture Overview

The automated end-to-end testing suite is designed as an **opaque-box, requirement-driven verification system** verifying the modernization of CEISA 4.0 automation components.

```
                    +-------------------------------------------------------+
                    |                tests/e2e/run_tests.js                 |
                    |             (Master Runner & CLI Matrix)              |
                    +-------------------------------------------------------+
                                   |         |         |         |
         +-------------------------+         |         |         +-------------------------+
         |                                   |         |                                   |
         v                                   v         v                                   v
+------------------+     +------------------+   +------------------+     +------------------+
| tier1_feature    |     | tier2_boundary   |   | tier3_integration|     | tier4_scenarios  |
| 80 tests (F1-F16)|     | 80 tests (F1-F16)|   | 10 pairwise tests|     | 5 real workflows |
+------------------+     +------------------+   +------------------+     +------------------+
         |                                   |         |                                   |
         +-------------------------+         |         |         +-------------------------+
                                   v         v         v         v
                    +-------------------------------------------------------+
                    |              tests/e2e/helpers/dom_env.js             |
                    |           (JSDOM, Window, Document & Mocks)          |
                    +-------------------------------------------------------+
                                   |         |         |
                     +-------------+         |         +-------------+
                     v                       v                       v
            print_hub.html / .js    pib.html / dashboard    content.js (CEISA)
```

### Key Technical Pillars:
1. **Zero-Dependency Execution**: Built on native Node.js 24 (`node:assert`, `node:fs`, `node:path`) and standard JSDOM. No heavyweight browser drivers required for instant, deterministic CI/CD runs.
2. **True DOM Execution**: Reads actual production markup (`print_hub.html`, `pib.html`) and executes production JavaScript (`print_hub.js`, `pib_dashboard.js`, `content.js`) in isolated, sandboxed window scopes.
3. **No Facade Tests**: Every test validates real DOM nodes, attribute values, serialization objects, and synthetic browser event dispatches (`click`, `input`, `change`, `submit`).
4. **Card-Scoped Portals**: Includes a high-fidelity mock of CEISA 4.0 Ant Design portal structure to test `content.js` auto-input mapping without relying on live government portals.

---

## 2. Directory Layout

```
tests/e2e/
├── helpers/
│   ├── dom_env.js              # JSDOM loader, mocks (localStorage, chrome, fetch, clipboard)
│   └── test_framework.js       # Lightweight test harness, assertions, and reporting
├── tier1_feature.test.js       # Tier 1: Feature Coverage (>=5 tests per feature, 80 tests total)
├── tier2_boundary.test.js      # Tier 2: Boundary & Corner Cases (>=5 tests per feature, 80 tests total)
├── tier3_integration.test.js   # Tier 3: Cross-Feature Combinations (Pairwise workflows, 10 tests)
├── tier4_scenarios.test.js     # Tier 4: Real-World Scenarios (End-to-End declarations, 5 tests)
└── run_tests.js                # Master test runner with colorized output and exit codes
```

---

## 3. Test Tier Strategy

| Tier | Category | Target | Count | Scope |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage | F1–F16 | 80 | Happy path tests verifying presence of UI elements, DOM cleanup, event listeners, form serialization, draft loading, and auto-input mappings. |
| **Tier 2** | Boundary & Corner Cases | F1–F16 | 80 | Maximum input lengths (22-digit NITKU, 16-digit NPWP), multiline addresses, Unicode/foreign text, null/undefined inputs, empty storage, and responsiveness. |
| **Tier 3** | Cross-Feature Combinations | Pairwise | 10 | Cross-card copy chains (Penerima -> Pembeli -> Pemilik), NITKU sync to form collection, Sinar Asia auto-rules, and printer listing vs form isolation. |
| **Tier 4** | Real-World Application Scenarios | Workflow | 5 | End-to-end import declaration lifecycle, non-PPJK self-filing, foreign shipper vs seller segregation, and print job spooling. |
| **Total** | | | **175** | |

---

## 4. Feature Coverage Matrix (F1 – F16)

| # | Feature | Description | Tier 1 | Tier 2 | T3/T4 | Target Milestone | Status (Baseline) |
|---|---------|-------------|:------:|:------:|:-----:|:----------------:|:-----------------:|
| **F1** | Print Hub QR Container Removal | Deletion of `.ph-qr-card`, `#qrThumbBox`, `#qrThumbImage`, `#lanUrlDisplay` | 5 | 5 | ✓ | M1 | **PASS (10/10)** |
| **F2** | Print Hub Header & Modal Removal | Deletion of `#btnOpenQrHeader` ("Scan HP") and `#qrModal` | 5 | 5 | ✓ | M1 | **PASS (10/10)** |
| **F3** | Print Hub JS Logic Cleanup | Safe event listener handling, clean startup, printer listing | 5 | 5 | ✓ | M1 | **PASS (10/10)** |
| **F4** | PIB Header Removal | Removal of `.ceisa-doc-topbar`, `#btnPibKembali`, `#btnPibUpdateData` | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F5** | Old PPJK Card Removal | Deletion of span-2 card, old checkboxes `pibCheckOwnerSame`/`SellerSame` | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F6** | CEISA 4.0 2-Column Grid Layout | `.ceisa-entitas-grid`, 2 `.ceisa-entitas-column` containers, nav footer | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F7** | Card 1 (Left): Pengirim | Referensi btn, split ID, Nama, Alamat, Negara (CN default) | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F8** | Card 2 (Left): Pembeli | Hapus Pembeli, Salin Penerima, split ID, 22-digit NITKU, Nama, Alamat, ID | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F9** | Card 3 (Left): Pemilik Barang | Salin Penerima, Referensi, split ID, NITKU, Nama, Alamat, Afiliasi (TAH) | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F10**| Card 1 (Right): Penerima | Referensi, split ID (NPWP 16), NITKU, Nama, Alamat, Status, Ijin BP | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F11**| Card 2 (Right): Penjual | Salin Pengirim btn, split ID (4 - LAINNYA), Nama, Alamat, Negara | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F12**| Card 3 (Right): PPJK | Split ID (NPWP 16), NITKU 22-digit with sync button, Nama, Alamat | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F13**| Copy Action Handlers | Penerima->Pembeli, Pengirim->Penjual, Penerima->Pemilik, Hapus, Sync NITKU | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F14**| `collectPibFormData()` | Serialization of all 6 cards with backward aliases (`importir*`, `supplier*`) | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F15**| `loadPibDraftData()` | Population of 6 cards, legacy draft compatibility, Sinar Asia rule | 5 | 5 | ✓ | M2 | PENDING M2 |
| **F16**| CEISA 4.0 Auto-Input | Card-scoped auto-input mapping in `content.js` for all 6 entities | 5 | 5 | ✓ | M3 | PENDING M3 |

---

## 5. Execution Commands

### Run Full Test Suite:
```bash
node tests/e2e/run_tests.js
```

### Run Baseline / Progressive Mode (permits pending features during development):
```bash
node tests/e2e/run_tests.js --baseline
```

### Run Summary Only:
```bash
node tests/e2e/run_tests.js --summary --baseline
```

### Filter by Specific Tier:
```bash
node tests/e2e/run_tests.js --tier=1
node tests/e2e/run_tests.js --tier=2
node tests/e2e/run_tests.js --tier=3
node tests/e2e/run_tests.js --tier=4
```

### Filter by Specific Feature (F1 - F16):
```bash
node tests/e2e/run_tests.js --feature=F1
node tests/e2e/run_tests.js --feature=F2
node tests/e2e/run_tests.js --feature=F3
```
