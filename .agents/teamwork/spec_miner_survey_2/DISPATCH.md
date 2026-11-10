# Dispatch: Spec Miner Survey 2 (CEISA 4.0 Tab Entitas Specification)

## Context & Objectives
You are Spec Miner 2 in the Survey phase. Read `c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md`.
Your role is read-only specification extraction of the Tab Entitas CEISA 4.0 format.
Examine:
1. Visual references:
   - `C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282977653_5e8008e4.png`
   - `C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282972406_ac3647c6.png`
2. Existing Tab Entitas in `pib.html`, `pib_dashboard.js`, and `dashboard.css`.

Extract precise UI & DOM specifications for all 6 cards arranged in 2 columns:
- Kolom Kiri:
  1. Card Pengirim: Tombol 'Referensi', Nomor Identitas (select jenis identitas + input nomor), Nama, Alamat, Negara (dropdown).
  2. Card Pembeli: Tombol 'Hapus Pembeli', 'Salin data penerima', Nomor Identitas (select jenis + input nomor), NITKU, Nama, Alamat, Negara (dropdown).
  3. Card Pemilik Barang: Tombol 'Salin Penerima', 'Referensi', Nomor Identitas, NITKU, Nama, Alamat, Afiliasi (dropdown, default 'TAH - Tidak berhubungan').
- Kolom Kanan:
  1. Card Penerima: Tombol 'Referensi', Nomor Identitas (select jenis, default '6 - NPWP 16 DIGIT' + input nomor), NITKU, Nama, Alamat, Negara (dropdown), Status (default 'LAINNYA'), Ijin Badan Pengusahaan (No Izin + Tanggal).
  2. Card Penjual: Tombol 'Salin data pengirim', Nomor Identitas (select jenis + input nomor), Nama, Alamat, Negara (dropdown).
  3. Card PPJK: Nomor Identitas (select jenis, default '6 - NPWP 16 DIGIT' + input nomor), NITKU dengan tombol sinkronisasi, Nama, Alamat.

## Deliverables
Produce a structured report in `c:\Synthetic\.agents\teamwork\spec_miner_survey_2\handoff.md` detailing:
- Exact layout specification (2-column CSS grid/flex, styling, headers, badge/colors matching CEISA 4.0).
- Detailed field specification for every card: field name, label, element tag (`<input>`, `<select>`, `<textarea>`), dropdown options (NPWP 16 Digit, etc., country list or search, status options, affiliation options), default values, placeholder text, and IDs/classes.
- Button specifications: Exact text, icon/placement, behavior specification.
- Comparison with current `pib.html` Tab Entitas structure.

Do not write or modify source code files. Write only within your state folder `c:\Synthetic\.agents\teamwork\spec_miner_survey_2\`.


## 2026-11-10T04:17:47Z
[Message] sender=f70416d4-7049-476a-94f7-853514b120c5 priority=MESSAGE_PRIORITY_HIGH
You are Spec Miner 2 for the Survey phase. Read your task assignment at c:\Synthetic\.agents\teamwork\spec_miner_survey_2\DISPATCH.md and original request at c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md.
Investigate and extract the exact specification for CEISA 4.0 Tab Entitas.
Check visual screenshots at:
- C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282977653_5e8008e4.png
- C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282972406_ac3647c6.png
And compare with existing pib.html, pib_dashboard.js, dashboard.css.

Write your structured handoff report to c:\Synthetic\.agents\teamwork\spec_miner_survey_2\handoff.md and notify me when complete. Do not write or edit any source code.
