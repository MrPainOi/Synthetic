# Dispatch: Milestone 1 Worker (Print Hub QR & UI Cleanup)

## Mission & Scope
You are the implementation Worker for Milestone 1.
Read:
- `c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Synthetic\.agents\teamwork\PROJECT.md`
- `c:\Synthetic\.agents\teamwork\explorer_survey_1\handoff.md`

## Write Ownership
You exclusively own:
- `c:\Synthetic\print_hub.html`
- `c:\Synthetic\print_hub.js`
Do NOT modify any other files.

## Detailed Requirements
1. In `print_hub.html`:
   - Remove the QR Code banner card container (`.ph-qr-card`) and all its child elements (`#qrThumbBox`, `#qrLoadingSkeleton`, `#qrThumbImage`, `.ph-qr-info`, `#btnCopyLanUrl`, `#lanUrlDisplay`, etc.).
   - Remove the header action button "Scan HP" (`#btnOpenQrHeader`).
   - Remove the QR Code modal (`#qrModal`, `#qrLargeImage`, `#modalUrlDisplay`, `#btnCloseQrModal`).
   - Clean up obsolete QR-specific CSS rules (`.ph-qr-card`, `.ph-qr-thumb`, `.ph-qr-info`, `.ph-qr-title`, `.ph-qr-sub`, `.ph-qr-link-box`, `.ph-modal-overlay`, `.ph-modal-card`, `.ph-qr-large`).
2. In `print_hub.js`:
   - Remove or safely guard cached DOM elements for QR features (`btnOpenQrHeader`, `qrThumbBox`, `qrThumbImage`, `qrLoadingSkeleton`, `lanUrlDisplay`, `btnCopyLanUrl`, `qrModal`, `qrLargeImage`, `modalUrlDisplay`, `btnCloseQrModal`).
   - Remove or cleanly stub `fetchQrCode()` and remove its invocations in `DOMContentLoaded` and `btnReloadPrinters`.
   - Remove QR modal event listeners and clipboard copy listener (`btnCopyLanUrl`).
   - Ensure `initListeners()`, `fetchServerStatus()`, printer list rendering, print dispatch, and queue monitoring run completely error-free without any TypeErrors or null-pointer exceptions.
3. Verification:
   - Run syntax checks / node tests on `print_hub.js`.
   - Verify that all remaining Print Hub elements (printer selection, job queue, print buttons) function without error.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Provide a complete handoff report at `c:\Synthetic\.agents\teamwork\worker_m1\handoff.md` documenting:
- Exact files modified and changes made
- Verification commands executed and test outputs
- Evidence that no console errors or regressions occur


## 2026-11-10T04:28:25Z
You are the implementation Worker for Milestone 1 (Print Hub QR & UI Cleanup).
Read your task assignment at c:\Synthetic\.agents\teamwork\worker_m1\DISPATCH.md, PROJECT.md at c:\Synthetic\.agents\teamwork\PROJECT.md, ORIGINAL_REQUEST.md at c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md, and explorer findings at c:\Synthetic\.agents\teamwork\explorer_survey_1\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the changes in print_hub.html and print_hub.js, verify syntax and execution, and report handoff at c:\Synthetic\.agents\teamwork\worker_m1\handoff.md.
