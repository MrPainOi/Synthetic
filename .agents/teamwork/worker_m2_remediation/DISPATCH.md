# Dispatch: Worker M2 Remediation

## Mission & Scope
You are the remediation Worker for Milestone 2.
Read:
- `c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Synthetic\.agents\teamwork\PROJECT.md`
- `c:\Synthetic\.agents\teamwork\challenger_m2_1\handoff.md`

## Write Ownership
You exclusively own:
- `c:\Synthetic\pib_dashboard.js`
Do NOT modify any other files.

## Detailed Requirements
In `c:\Synthetic\pib_dashboard.js`:
1. Line 360 (in `calculatePibPungutan()`):
   Update the selector lookup for `importirStatus`:
   ```javascript
   const importirStatus = document.getElementById('pibPenerimaStatus')?.value || document.getElementById('pibImportirStatus')?.value || 'API-U';
   ```
   This ensures that when a user selects `NON-API` in Card 4 (Penerima), the PPh 22 calculation applies 7.5% rather than being stuck at 2.5%.
2. Line 2519 (in `#btnPibAddItem` click listener):
   Update the selector lookup for `country`:
   ```javascript
   const country = document.getElementById('pibPengirimCountry')?.value || document.getElementById('pibPengirimNegara')?.value || document.getElementById('pibSupplierCountry')?.value || 'CN - CHINA';
   ```
   This ensures that newly added items adopt the country of origin from Card 1 (Pengirim).

## Verification
1. Run syntax check: `node -c pib_dashboard.js`.
2. Run Challenger 1's stress test harness: `node tests/challenger_stress_m2.js`. Expected: 28/28 passed (100%).
3. Run official Milestone 2 feature tests: `node tests/e2e/run_tests.js --feature=F4,F5,F6,F7,F8,F9,F10,F11,F12,F13,F14,F15`. Expected: 120/120 passed.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Deliver your handoff report to `c:\Synthetic\.agents\teamwork\worker_m2_remediation\handoff.md`.


## 2026-11-10T05:33:40Z
You are the remediation Worker for Milestone 2. Read your task assignment at c:\Synthetic\.agents\teamwork\worker_m2_remediation\DISPATCH.md, PROJECT.md at c:\Synthetic\.agents\teamwork\PROJECT.md, ORIGINAL_REQUEST.md at c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md, and Challenger 1 handoff at c:\Synthetic\.agents\teamwork\challenger_m2_1\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Apply the selector updates to lines 360 and 2519 in pib_dashboard.js. Run node tests/challenger_stress_m2.js and node tests/e2e/run_tests.js --feature=F4,F5,F6,F7,F8,F9,F10,F11,F12,F13,F14,F15.
Report handoff at c:\Synthetic\.agents\teamwork\worker_m2_remediation\handoff.md.
