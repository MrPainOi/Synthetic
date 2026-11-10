# BRIEFING — 2026-11-10T04:23:45Z

## Mission
Extract authoritative specification for CEISA 4.0 Tab Entitas from visual screenshots and existing codebase, producing structured handoff report for downstream implementation.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Read-only spec extractor, UI/DOM specification specialist
- Working directory: c:\Synthetic
- State folder: c:\Synthetic\.agents\teamwork\spec_miner_survey_2
- Original parent: f70416d4-7049-476a-94f7-853514b120c5
- Milestone: Survey Phase (Tab Entitas Specification)

## 🔒 Key Constraints
- Read-only: DO NOT write or edit any source code.
- Write only to state folder: c:\Synthetic\.agents\teamwork\spec_miner_survey_2\.
- Thoroughly inspect screenshots and existing codebase.
- Provide full field schemas, layout specifications, styling rules, button interactions, auto-fill mappings.

## Current Parent
- Conversation ID: f70416d4-7049-476a-94f7-853514b120c5
- Updated: 2026-11-10T04:17:47Z

## Task Summary
- **What to build**: Tab Entitas CEISA 4.0 specification report (`handoff.md`).
- **Success criteria**: Complete specification of all 6 cards, 2 columns, all fields, labels, tag types, dropdown values, button actions, and DOM differences with current `pib.html`.
- **Interface contracts**: `c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md` & `DISPATCH.md`
- **Code layout**: `c:\Synthetic\pib.html`, `pib_dashboard.js`, `dashboard.css`, `content.js`

## Key Decisions Made
- Confirmed layout as 2 independent stacking vertical columns (`.ceisa-entitas-grid` with `.ceisa-entitas-column`).
- Identified 6 discrete cards: Pengirim (4 fields), Pembeli (5 fields), Pemilik Barang (5 fields) in Column 1; Penerima (7 fields), Penjual (4 fields), PPJK (4 fields) in Column 2.
- Specified 4 copy/delete header buttons (`btnHapusPembeli`, `btnCopyPenerimaToPembeli`, `btnCopyPenerimaToPemilik`, `btnCopyPengirimToPenjual`) replacing old checkbox toggle patterns.
- Detailed backwards-compatible ID and serialization scheme for `collectPibFormData` and `populatePibForm`.

## Artifact Index
- `DISPATCH.md` — Assigned scope and instructions
- `BRIEFING.md` — Agent state and working memory
- `progress.md` — Execution status and heartbeat
- `handoff.md` — Final structured specification deliverable
