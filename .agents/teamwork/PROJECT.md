# Project: CEISA 4.0 PIB Tab Entitas & Print Hub Modernization

## Architecture
- Chrome Extension Architecture:
  - `print_hub.html` / `print_hub.js`: Print hub UI, direct IP printing, queue management.
  - `pib.html` / `pib_dashboard.js` / `dashboard.css`: PIB FTZ-01 document editor, form state, draft storage, UI validation.
  - `content.js`: Injected script running on CEISA 4.0 web pages (`https://ceisa40.beacukai.go.id/*`), automating form filling and portal integration.
- Shared Data Flow:
  - PIB Form State (6 Entity Cards) <-> Chrome Local Storage (`pib_draft_*`) <-> `content.js` Auto-Input Payload <-> CEISA 4.0 Form DOM.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1 | Remove QR Code Card Container (`.ph-qr-card`) and child elements (`#qrThumbBox`, `#qrThumbImage`, `#lanUrlDisplay`) from `print_hub.html` | M1 | survey_1 |
| 2 | F2 | Remove Header "Scan HP" Button (`#btnOpenQrHeader`) and Modal (`#qrModal`, `#qrLargeImage`) from `print_hub.html` | M1 | survey_1 |
| 3 | F3 | Clean up JavaScript references, listeners, and pollers in `print_hub.js` ensuring print functionality and printer listing remain 100% functional without console errors | M1 | survey_1 |
| 4 | F4 | Remove `.ceisa-doc-topbar` ("FTZ01 - Pemasukan dari Luar Daerah Pabean", "Kembali", "Update Data") and unused listeners/styles in `pib.html`, `pib_dashboard.js`, `dashboard.css` | M2 | survey_1 |
| 5 | F5 | Remove Old Single-Column PPJK Card (`#pibPpjkNpwp`, etc.) from `pib.html` and `dashboard.css` | M2 | survey_1 |
| 6 | F6 | Implement CEISA 4.0 2-Column Tab Entitas Layout (`.ceisa-entitas-grid`, `.ceisa-entitas-col-left`, `.ceisa-entitas-col-right`) in `pib.html` and `dashboard.css` | M2 | spec_miner_2 |
| 7 | F7 | Column 1 Card 1 (Pengirim): Tombol 'Referensi', Nomor Identitas (select jenis + input nomor), Nama, Alamat, Negara (dropdown) | M2 | spec_miner_2 |
| 8 | F8 | Column 1 Card 2 (Pembeli): Tombol 'Hapus Pembeli', 'Salin data penerima', Nomor Identitas (select jenis + input nomor), NITKU, Nama, Alamat, Negara (dropdown) | M2 | spec_miner_2 |
| 9 | F9 | Column 1 Card 3 (Pemilik Barang): Tombol 'Salin Penerima', 'Referensi', Nomor Identitas, NITKU, Nama, Alamat, Afiliasi (dropdown default 'TAH - Tidak berhubungan') | M2 | spec_miner_2 |
| 10 | F10 | Column 2 Card 1 (Penerima): Tombol 'Referensi', Nomor Identitas (select default '6 - NPWP 16 DIGIT' + input nomor), NITKU, Nama, Alamat, Negara, Status (default 'LAINNYA'), Ijin Badan Pengusahaan (No Izin + Tanggal) | M2 | spec_miner_2 |
| 11 | F11 | Column 2 Card 2 (Penjual): Tombol 'Salin data pengirim', Nomor Identitas (select jenis + input nomor), Nama, Alamat, Negara (dropdown) | M2 | spec_miner_2 |
| 12 | F12 | Column 2 Card 3 (PPJK): Nomor Identitas (select default '6 - NPWP 16 DIGIT' + input nomor), NITKU dengan tombol sinkronisasi, Nama, Alamat | M2 | spec_miner_2 |
| 13 | F13 | PIB Data - Copy Action Handlers: 'Salin data penerima' (Penerima -> Pembeli), 'Salin data pengirim' (Pengirim -> Penjual), 'Salin Penerima' (Penerima -> Pemilik Barang), 'Hapus Pembeli' (Clear Pembeli), NITKU sync | M2 | survey_3 |
| 14 | F14 | PIB Data - `collectPibFormData()` updated to serialize all 6 entity cards with backward-compatible aliases for CIF/tax calculations | M2 | survey_3 |
| 15 | F15 | PIB Data - `loadPibDraftData()` (and `populatePibForm` wrapper) updated to populate all 6 entity cards from saved draft or CEISA response | M2 | survey_3 |
| 16 | F16 | Content Script - `handleCeisaAutoInputRow` in `content.js` updated to map all 6 entity cards to CEISA 4.0 portal form fields | M3 | survey_3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Print Hub QR & UI Cleanup | Remove QR banner, header action, modal, and clean JS logic (`print_hub.html`, `print_hub.js`) | none | DONE |
| M2 | PIB CEISA 4.0 Tab Entitas & Data Controller | Remove topbar & old PPJK; build 2-column 6-card UI; wire copy actions, `collectPibFormData` & `loadPibDraftData` (`pib.html`, `dashboard.css`, `pib_dashboard.js`) | none | DONE |
| M3 | CEISA 4.0 Auto-Input Content Script Integration | Card-scoped CEISA auto-input handler for all 6 entities in `content.js` | M2 | DONE |
| M4 | Final Milestone: E2E Integration & Verification | Pass 100% of E2E test suite (Tiers 1-4) published by E2E track + Tier 5 coverage hardening | M1, M2, M3 | DONE |

## Interface Contracts

### M2 (`pib_dashboard.js`) ↔ M3 (`content.js`) Data Contract
Data schema produced by `collectPibFormData()` and consumed by `handleCeisaAutoInputRow`:
```json
{
  "entitas": {
    "pengirim": {
      "jenisIdentitas": "4",
      "nomorIdentitas": "-",
      "nama": "SHANGHAI PRECISION MACHINERY CO., LTD.",
      "alamat": "No. 888 Songze Avenue, Qingpu District, Shanghai",
      "negara": "CN"
    },
    "pembeli": {
      "jenisIdentitas": "6",
      "nomorIdentitas": "0123456780120000",
      "nitku": "0123456780120000000000",
      "nama": "PT. INDONESIA MAKMUR IMPORTAMA",
      "alamat": "Kawasan Industri MM2100 Blok C-5",
      "negara": "ID"
    },
    "pemilikBarang": {
      "jenisIdentitas": "6",
      "nomorIdentitas": "0123456780120000",
      "nitku": "0123456780120000000000",
      "nama": "PT. INDONESIA MAKMUR IMPORTAMA",
      "alamat": "Kawasan Industri MM2100 Blok C-5",
      "afiliasi": "TAH"
    },
    "penerima": {
      "jenisIdentitas": "6",
      "nomorIdentitas": "0123456780120000",
      "nitku": "0123456780120000000000",
      "nama": "PT. INDONESIA MAKMUR IMPORTAMA",
      "alamat": "Kawasan Industri MM2100 Blok C-5",
      "negara": "ID",
      "status": "LAINNYA",
      "ijinBpNo": "",
      "ijinBpTgl": ""
    },
    "penjual": {
      "jenisIdentitas": "4",
      "nomorIdentitas": "-",
      "nama": "SHANGHAI PRECISION MACHINERY CO., LTD.",
      "alamat": "No. 888 Songze Avenue, Qingpu District, Shanghai",
      "negara": "CN"
    },
    "ppjk": {
      "jenisIdentitas": "6",
      "nomorIdentitas": "0026923485215000",
      "nitku": "0026923485215000000000",
      "nama": "PT. SARANA PPJK LOGISTIK UTAMA",
      "alamat": "Jl. Sulawesi No. 12 Tanjung Priok"
    }
  },
  "importirName": "PT. INDONESIA MAKMUR IMPORTAMA",
  "importirAddress": "Kawasan Industri MM2100 Blok C-5",
  "supplierName": "SHANGHAI PRECISION MACHINERY CO., LTD.",
  "supplierAddress": "No. 888 Songze Avenue, Qingpu District, Shanghai",
  "supplierCountry": "CN"
}
```

## Code Layout
- `print_hub.html`: UI for Print Hub (Cleaned in M1)
- `print_hub.js`: Logic for Print Hub (Cleaned in M1)
- `pib.html`: UI for PIB FTZ01 Document (Modernized in M2)
- `dashboard.css`: Styling for PIB & Dashboard (Modernized in M2)
- `pib_dashboard.js`: PIB Form Controller & Storage (Modernized in M2)
- `content.js`: CEISA 4.0 Auto-Input Content Script (Modernized in M3)
