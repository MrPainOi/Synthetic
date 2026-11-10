# Dispatch: Milestone 3 Worker (CEISA 4.0 Auto-Input Content Script Integration)

## Mission & Scope
You are the implementation Worker for Milestone 3.
Read:
- `c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Synthetic\.agents\teamwork\PROJECT.md`
- `c:\Synthetic\.agents\teamwork\explorer_survey_3\handoff.md` (exact CEISA 4.0 target selectors, entity mapping schemas, card-scoped input queries)
- `c:\Synthetic\TEST_INFRA.md` & `c:\Synthetic\TEST_READY.md`

## Write Ownership
You exclusively own:
- `c:\Synthetic\content.js`
Do NOT modify any other files.

## Detailed Requirements
In `c:\Synthetic\content.js`:
1. Modernize `handleCeisaAutoInputRow(row, docType, rowData, forceTab)`:
   - Handle payload containing the new 6-card entity structure (`rowData.entitas` or top-level properties).
   - Ensure support for all 6 entities in CEISA 4.0:
     * **Pengirim (Shipper / Supplier)**: Map `nama`, `alamat`, `negara`, `nomorIdentitas`, `jenisIdentitas` to Card Pengirim inputs in CEISA.
     * **Pembeli (Buyer)**: Map `nama`, `alamat`, `negara`, `nitku`, `nomorIdentitas`, `jenisIdentitas` to Card Pembeli inputs in CEISA.
     * **Pemilik Barang (Cargo Owner)**: Map `nama`, `alamat`, `nitku`, `nomorIdentitas`, `jenisIdentitas`, `afiliasi` to Card Pemilik Barang inputs in CEISA.
     * **Penerima (Importer / Consignee)**: Map `nama`, `alamat`, `negara`, `nitku`, `nomorIdentitas`, `jenisIdentitas`, `status`, `ijinBpNo`, `ijinBpTgl` to Card Penerima inputs in CEISA.
     * **Penjual (Seller)**: Map `nama`, `alamat`, `negara`, `nomorIdentitas`, `jenisIdentitas` to Card Penjual inputs in CEISA.
     * **PPJK**: Map `nama`, `alamat`, `nitku`, `nomorIdentitas`, `jenisIdentitas` to Card PPJK inputs in CEISA.
   - Maintain backward-compatible support for legacy payload structure (`rowData.importirName`, `rowData.supplierName`, etc.).
   - Use card-scoped selector queries so fields with identical class names (e.g. `.form-control`, `input[type="text"]`, `select`) in different cards are accurately targeted within their respective container cards.
   - Dispatch `input` and `change` events on every targeted input/select/textarea so Angular/React/CEISA portal state registers the changes.
   - Ensure global export or availability of `handleCeisaAutoInputRow` for both content script invocation and test harness execution.

## Verification
1. Run syntax check: `node -c c:\Synthetic\content.js`.
2. Run Feature 16 test suite: `node c:\Synthetic\tests\e2e\run_tests.js --feature=F16`. Expected: 10/10 passed (100%).
3. Run full E2E test suite: `node c:\Synthetic\tests\e2e\run_tests.js`. Expected: 175/175 passed (100% global pass rate across all tiers!).

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Deliver your handoff report to `c:\Synthetic\.agents\teamwork\worker_m3\handoff.md`.


## 2026-11-10T05:45:49Z
[Message] sender=f70416d4-7049-476a-94f7-853514b120c5 priority=MESSAGE_PRIORITY_HIGH content=You are the implementation Worker for Milestone 3 (CEISA 4.0 Auto-Input Content Script Integration).
Read your task assignment at c:\Synthetic\.agents\teamwork\worker_m3\DISPATCH.md, PROJECT.md at c:\Synthetic\.agents\teamwork\PROJECT.md, ORIGINAL_REQUEST.md at c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md, and Explorer 3 handoff at c:\Synthetic\.agents\teamwork\explorer_survey_3\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement card-scoped auto-input mapping in content.js for all 6 CEISA 4.0 entity cards. Run node tests/e2e/run_tests.js --feature=F16 and node tests/e2e/run_tests.js.
Deliver your handoff report to c:\Synthetic\.agents\teamwork\worker_m3\handoff.md.


## 2026-11-10T05:56:12Z
[Message] sender=f70416d4-7049-476a-94f7-853514b120c5 priority=MESSAGE_PRIORITY_HIGH content=**Context**: Milestone 3 Implementation (CEISA Auto-Input Integration in content.js)
**Content**: Heartbeat check. Please update your progress.md and report current implementation progress.
**Action**: Report current status.
