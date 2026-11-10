# BRIEFING — 2026-11-10T04:26:30Z

## Mission
Survey Print Hub QR code removal, PIB header removal (.ceisa-doc-topbar), and old PPJK card removal across HTML, JS, CSS, and verify against reference screenshots.

## 🔒 My Identity
- Archetype: explorer
- Roles: read-only investigation, analysis, synthesis
- Working directory: c:\Synthetic
- State folder: c:\Synthetic\.agents\teamwork\explorer_survey_1
- Original parent: f70416d4-7049-476a-94f7-853514b120c5
- Milestone: Survey Phase

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do not write or edit any source code
- Write only to state folder c:\Synthetic\.agents\teamwork\explorer_survey_1\

## Current Parent
- Conversation ID: f70416d4-7049-476a-94f7-853514b120c5
- Updated: 2026-11-10T04:26:30Z

## Investigation State
- **Explored paths**:
  - `print_hub.html` (lines 576-685, 824-832, 990-1008, 1228-1245)
  - `print_hub.js` (lines 51-56, 104-107, 182-185, 192-209, 653, 722-741, 768)
  - `pib.html` (lines 243-261, 600-622)
  - `pib_dashboard.js` (lines 85-87, 366-368, 618-620, 1791-1808)
  - `dashboard.css` (lines 2409-2505, 2855-2905)
  - Reference screenshots (`media_...8ddf80f2.png`, `media_...9dd72ceb.png`, `media_...d1d40fb4.png`, `media_...5e8008e4.png`, `media_...ac3647c6.png`)
- **Key findings**:
  - In `print_hub.html`, deleting the QR card without updating `print_hub.js` causes fatal `TypeError` in `initListeners()` at line 734 (`btnCopyLanUrl`), halting `DOMContentLoaded` and completely breaking printer & spooler loading.
  - The "Scan HP" header button (`#btnOpenQrHeader`) and modal (`#qrModal`) should also be removed/cleaned up along with the banner for a complete QR code removal.
  - In `pib.html`, removing `.ceisa-doc-topbar` is completely safe; event listeners in `pib_dashboard.js:1791-1808` are already guarded by `if (...)`, and CSS rules in `dashboard.css:2409-2505` are isolated.
  - The old PPJK card in `pib.html:600-622` (`pibPpjkId`, `pibPpjkName`, `pibPpjkAddress`) can be cleanly removed; `getVal` and `setVal` in `pib_dashboard.js` are null-safe. Replacement with the new CEISA 4.0 PPJK card in Column 2 (Right) will add `pibPpjkIdType` and `pibPpjkNitku`.
- **Unexplored areas**: None for Explorer 1 scope. Explorer 2 covers the 2-column CEISA 4.0 Entitas tab restructure.

## Key Decisions Made
- Fully documented exact line numbers, selectors, failure risks, and cleanup instructions in `handoff.md`.

## Artifact Index
- `c:\Synthetic\.agents\teamwork\explorer_survey_1\BRIEFING.md` — persistent working memory
- `c:\Synthetic\.agents\teamwork\explorer_survey_1\progress.md` — liveness heartbeat
- `c:\Synthetic\.agents\teamwork\explorer_survey_1\handoff.md` — survey report
- `c:\Synthetic\.agents\teamwork\explorer_survey_1\DISPATCH.md` — task dispatch record
