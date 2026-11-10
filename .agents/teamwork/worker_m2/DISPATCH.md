# Dispatch: Milestone 2 Worker (PIB CEISA 4.0 Tab Entitas & Data Controller)

## Mission & Scope
You are the implementation Worker for Milestone 2.
Read:
- `c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Synthetic\.agents\teamwork\PROJECT.md`
- `c:\Synthetic\.agents\teamwork\spec_miner_survey_2\handoff.md` (complete layout, DOM, CSS tokens, IDs, buttons)
- `c:\Synthetic\.agents\teamwork\explorer_survey_3\handoff.md` (complete data schema, copy button logic, backward-compatible aliases)
- Visual screenshots:
  * `C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282626019_9dd72ceb.png` (header to remove)
  * `C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282626039_d1d40fb4.png` (old PPJK to remove)
  * `C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282977653_5e8008e4.png` (CEISA 4.0 Tab Entitas)
  * `C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282972406_ac3647c6.png` (CEISA 4.0 Tab Entitas 2-column)

## Write Ownership
You exclusively own:
- `c:\Synthetic\pib.html`
- `c:\Synthetic\dashboard.css`
- `c:\Synthetic\pib_dashboard.js`
Do NOT modify any other files.

## Detailed Requirements

### 1. In `pib.html`:
- Remove `.ceisa-doc-topbar` ("FTZ01 - Pemasukan dari Luar Daerah Pabean", tombol "Kembali", dan tombol "Update Data").
- Remove the old single-column PPJK card.
- Rombak Tab Entitas (`#pib-tab-entitas`) menjadi tata letak 2 kolom sejajar (`ceisa-entitas-grid` with `ceisa-entitas-col-left` and `ceisa-entitas-col-right`):
  * **Kolom Kiri**:
    1. Card **Pengirim**: Tombol 'Referensi' (`btnPibPengirimRef`), Nomor Identitas (select jenis `pibPengirimJenisIdentitas` default '4' + input nomor `pibPengirimNomorIdentitas`), Nama (`pibPengirimNama`), Alamat (`pibPengirimAlamat`), Negara (`pibPengirimNegara`).
    2. Card **Pembeli**: Tombol 'Hapus Pembeli' (`btnPibHapusPembeli`), 'Salin data penerima' (`btnPibSalinPenerimaKePembeli`), Nomor Identitas (select jenis `pibPembeliJenisIdentitas` default '6' + input nomor `pibPembeliNomorIdentitas`), NITKU (`pibPembeliNitku`, 22 digits), Nama (`pibPembeliNama`), Alamat (`pibPembeliAlamat`), Negara (`pibPembeliNegara`).
    3. Card **Pemilik Barang**: Tombol 'Salin Penerima' (`btnPibSalinPenerimaKePemilik`), 'Referensi' (`btnPibPemilikRef`), Nomor Identitas (select jenis `pibPemilikJenisIdentitas` default '6' + input nomor `pibPemilikNomorIdentitas`), NITKU (`pibPemilikNitku`, 22 digits), Nama (`pibPemilikNama`), Alamat (`pibPemilikAlamat`), Afiliasi (dropdown `pibPemilikAfiliasi`, default 'TAH - Tidak berhubungan').
  * **Kolom Kanan**:
    1. Card **Penerima**: Tombol 'Referensi' (`btnPibPenerimaRef`), Nomor Identitas (select jenis `pibPenerimaJenisIdentitas`, default '6 - NPWP 16 DIGIT' + input nomor `pibPenerimaNomorIdentitas`), NITKU (`pibPenerimaNitku`, 22 digits), Nama (`pibPenerimaNama`), Alamat (`pibPenerimaAlamat`), Negara (`pibPenerimaNegara`), Status (`pibPenerimaStatus`, default 'LAINNYA'), Ijin Badan Pengusahaan (`pibPenerimaIjinBpNo` + `pibPenerimaIjinBpTgl`).
    2. Card **Penjual**: Tombol 'Salin data pengirim' (`btnPibSalinPengirimKePenjual`), Nomor Identitas (select jenis `pibPenjualJenisIdentitas` default '4' + input nomor `pibPenjualNomorIdentitas`), Nama (`pibPenjualNama`), Alamat (`pibPenjualAlamat`), Negara (`pibPenjualNegara`).
    3. Card **PPJK**: Nomor Identitas (select jenis `pibPpjkJenisIdentitas`, default '6 - NPWP 16 DIGIT' + input nomor `pibPpjkNomorIdentitas`), NITKU (`pibPpjkNitku`, 22 digits) dengan tombol sinkronisasi (`btnPibSyncNitkuPpjk`), Nama (`pibPpjkNama`), Alamat (`pibPpjkAlamat`).

### 2. In `dashboard.css`:
- Implement styling for `.ceisa-entitas-grid`, `.ceisa-entitas-col-left`, `.ceisa-entitas-col-right`, and `.ceisa-entitas-card` matching CEISA 4.0 screenshots.
- Ensure 2 independent vertical columns on desktop (`grid-template-columns: 1fr 1fr; gap: 16px; align-items: start;`) stacking gracefully on mobile.
- Card styling: Clean white cards with light grayish-blue headers, blue badge/buttons, primary action buttons, red asterisk `<span class="req">*</span>` on mandatory fields, split identity input styling (`input-group-split` flex row).

### 3. In `pib_dashboard.js`:
- Remove or guard dead event listeners for `.ceisa-doc-topbar` (`btnPibKembali`, `btnPibUpdateData`).
- Implement copy actions and wire click listeners:
  * 'Salin data penerima' (`btnPibSalinPenerimaKePembeli`): Copies Penerima fields (Identitas, NITKU, Nama, Alamat, Negara) to Pembeli.
  * 'Salin data pengirim' (`btnPibSalinPengirimKePenjual`): Copies Pengirim fields (Identitas, Nama, Alamat, Negara) to Penjual.
  * 'Salin Penerima' (`btnPibSalinPenerimaKePemilik`): Copies Penerima fields (Identitas, NITKU, Nama, Alamat) to Pemilik Barang (keeps Afiliasi).
  * 'Hapus Pembeli' (`btnPibHapusPembeli`): Clears Pembeli fields.
  * Sync NITKU PPJK (`btnPibSyncNitkuPpjk`): Formats or synchronizes PPJK NITKU from NPWP + "000000".
- Update `collectPibFormData()`:
  * Collect structured `entitas` object containing all 6 entities (`pengirim`, `pembeli`, `pemilikBarang`, `penerima`, `penjual`, `ppjk`).
  * Preserve backward-compatible root-level properties (`importirName`, `importirAddress`, `importirId`, `supplierName`, `supplierAddress`, `supplierCountry`, `ownerName`, `ownerAddress`, `sellerName`, `sellerAddress`, `ppjkName`, `ppjkAddress`, etc.) populated from `penerima`, `pengirim`, `pemilikBarang`, `penjual`, and `ppjk` so downstream calculations (CIF, BM, PPN, PPh) and existing exports work seamlessly.
- Update `loadPibDraftData()`:
  * Populate all 6 entity cards from draft object (supporting both new `entitas.*` format and legacy `importir*` / `supplier*` formats).
  * Also expose `populatePibForm(data)` as an exported alias/wrapper calling `loadPibDraftData(data, false)`.

### 4. Verification:
- Run syntax check: `node -c c:\Synthetic\pib_dashboard.js`.
- Run E2E tests: `node c:\Synthetic\tests\e2e\run_tests.js --feature=F4,F5,F6,F7,F8,F9,F10,F11,F12,F13,F14,F15`.
- Verify all M2 test cases pass.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Provide a complete handoff report at `c:\Synthetic\.agents\teamwork\worker_m2\handoff.md` with:
- Exact files and sections modified
- Test commands executed and results
- Verification of UI, copy buttons, data collection, and population

## 2026-11-10T04:47:23Z
You are the implementation Worker for Milestone 2 (PIB CEISA 4.0 Tab Entitas & Data Controller).
Read your task assignment at c:\Synthetic\.agents\teamwork\worker_m2\DISPATCH.md, PROJECT.md at c:\Synthetic\.agents\teamwork\PROJECT.md, ORIGINAL_REQUEST.md at c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md, spec miner findings at c:\Synthetic\.agents\teamwork\spec_miner_survey_2\handoff.md, and explorer findings at c:\Synthetic\.agents\teamwork\explorer_survey_3\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the changes across pib.html, dashboard.css, and pib_dashboard.js. Run tests with node tests/e2e/run_tests.js --feature=F4,F5,F6,F7,F8,F9,F10,F11,F12,F13,F14,F15.
Deliver handoff report to c:\Synthetic\.agents\teamwork\worker_m2\handoff.md.

## 2026-11-10T05:08:36Z
**Context**: Milestone 2 Implementation (PIB Tab Entitas & Data Controller)
**Content**: Heartbeat check. Please update your progress.md and report the current status of pib_dashboard.js updates and test runs.
**Action**: Report current status and any blockers.

