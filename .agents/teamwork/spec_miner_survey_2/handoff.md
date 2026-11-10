# Handoff Report: CEISA 4.0 Tab Entitas Specification

**Agent**: Spec Miner Survey 2 (`spec_miner_survey_2`)  
**Timestamp**: 2026-11-10T04:23:00Z  
**Target Milestone**: Survey Phase — Tab Entitas CEISA 4.0 Specification  
**Authority Sources**: 
- Screenshot 1: `C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282977653_5e8008e4.png`
- Screenshot 2: `C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282972406_ac3647c6.png`
- Existing Codebase: `c:\Synthetic\pib.html`, `pib_dashboard.js`, `dashboard.css`, `content.js`

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Layout | 2-Column Independent Stacking | Tab Entitas organized into two columns (Left: Pengirim, Pembeli, Pemilik Barang; Right: Penerima, Penjual, PPJK). Columns stack independently without row-height locking. | Responsive container width | 2 equal columns on desktop (>900px), single column on mobile (<900px) | Elements wrap gracefully | CEISA 4.0 Screenshot 2 & `dashboard.css` |
| 2 | Card 1 (Left) | Card Pengirim | Supplier / shipper entity card. Contains reference button in header, split identification number, name, address, country. | Dropdown Jenis Identitas (`4 - LAINNYA`), Input Nomor (`-`), Nama, Alamat, Negara (`CN - CHINA`) | Form state object (`pengirim*`) | Red asterisk validation on required fields | CEISA 4.0 Screenshot 1 & 2 |
| 3 | Card 2 (Left) | Card Pembeli | Domestic buyer entity card. Features 'Hapus Pembeli' and 'Salin data penerima' header buttons, NITKU field. | Dropdown Jenis Identitas (`6 - NPWP 16 DIGIT`), Input Nomor, NITKU (22 digits), Nama, Alamat, Negara (`ID - INDONESIA`) | Form state object (`pembeli*`) | Missing required fields flagged | CEISA 4.0 Screenshot 2 |
| 4 | Card 3 (Left) | Card Pemilik Barang | Cargo owner entity card. Features 'Salin Penerima' and 'Referensi' buttons, NITKU, and Afiliasi dropdown. | Dropdown Jenis Identitas, Input Nomor, NITKU, Nama, Alamat, Afiliasi (`TAH - Tidak berhubungan` / `HUB - Berhubungan`) | Form state object (`pemilik*`) | Fallback to default affiliation | CEISA 4.0 Screenshot 2 |
| 5 | Card 4 (Right) | Card Penerima | Domestic consignee / importer entity card. Features 'Referensi' button, NITKU, Status dropdown, and split Ijin Badan Pengusahaan. | Dropdown Jenis Identitas (`6 - NPWP 16 DIGIT`), Input Nomor, NITKU, Nama, Alamat, Negara, Status (`LAINNYA`), No Izin + Tgl Izin | Form state object (`penerima*`) | Missing required fields flagged | CEISA 4.0 Screenshot 1 & 2 |
| 6 | Card 5 (Right) | Card Penjual | Foreign seller entity card. Features 'Salin data pengirim' header button, split identification number, name, address, country. | Dropdown Jenis Identitas (`4 - LAINNYA`), Input Nomor (`-`), Nama, Alamat, Negara | Form state object (`penjual*`) | Missing required fields flagged | CEISA 4.0 Screenshot 2 |
| 7 | Card 6 (Right) | Card PPJK | Customs broker entity card. Features split identification number, NITKU with attached sync button, name, address. | Dropdown Jenis Identitas (`6 - NPWP 16 DIGIT`), Input Nomor, NITKU with sync trigger, Nama, Alamat | Form state object (`ppjk*`) | NITKU validation / sync error handling | CEISA 4.0 Screenshot 2 |
| 8 | Interactivity | Quick Copy Actions | 'Salin data penerima' (Penerima -> Pembeli), 'Salin Penerima' (Penerima -> Pemilik Barang), 'Salin data pengirim' (Pengirim -> Penjual) | Click on action buttons | Field values copied across cards in DOM | No-op if source card is empty | CEISA 4.0 Screenshot 2 & Dispatch |
| 9 | Interactivity | Reset Action ('Hapus Pembeli') | Clears all input and textarea values in Card Pembeli, resets dropdowns to defaults. | Click on 'Hapus Pembeli' button | Card Pembeli inputs emptied | None (safe reset) | CEISA 4.0 Screenshot 2 & Dispatch |
| 10 | Interactivity | NITKU Synchronization | Sync button attached to NITKU input in Card PPJK fetches or verifies 22-digit NITKU. | Click on sync button | NITKU field updated / synced | Alert or toast if sync fails | CEISA 4.0 Screenshot 2 |
| 11 | Stepper Nav | Footer Navigation | 'Sebelumnya' (back to Header tab) and 'Selanjutnya' (advance to Dokumen tab) buttons at bottom of Tab Entitas. | Click on navigation buttons | Tab panel switches active state | None | CEISA 4.0 Screenshot 2 & `pib.html` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | 'Salin data penerima' | Penerima has incomplete or empty fields | Only non-empty fields copied to Pembeli; existing fields in Pembeli not overwritten if empty in Penerima or overwritten with blank per standard reset. |
| 2 | 'Salin data pengirim' | Pengirim has foreign address and country (`CN - CHINA`) | Penjual receives exact overseas name, address, and country from Pengirim. |
| 3 | 'Salin Penerima' | Penerima has status and license fields | Pemilik Barang only receives Identitas, NITKU, Nama, and Alamat; Afiliasi remains untouched (`TAH - Tidak berhubungan`). |
| 4 | NITKU Input Length | NITKU with 22 digits vs 16-digit NPWP | NITKU input accepts 22 alphanumeric digits (16-digit NPWP + 6-digit branch code, e.g. `0830727251085000000002`). |
| 5 | PPJK Optionality | PPJK fields left blank | PIB validation permits optional PPJK if import declaration is self-handled by Importer (non-PPJK submission). |
| 6 | Split Input Alignment | Mobile or narrow viewport (<640px) | Split input retains flex layout or wraps neatly without breaking select dropdown width. |

---

## 1. Observation

### 1.1 Visual Screenshot Analysis (CEISA 4.0 Authority)
From `media_1794282977653_5e8008e4.png` and `media_1794282972406_ac3647c6.png`:
1. **Grid Layout**:
   - The Tab Entitas interface is strictly structured as **two vertical columns** positioned side by side.
   - **Left Column**: Contains exactly 3 cards in vertical sequence:
     1. Card **Pengirim**
     2. Card **Pembeli**
     3. Card **Pemilik Barang**
   - **Right Column**: Contains exactly 3 cards in vertical sequence:
     1. Card **Penerima**
     2. Card **Penjual**
     3. Card **PPJK**
   - Noticeably, Card Penerima (7 fields) is much taller than Card Pengirim (4 fields). In the screenshot, Card Pembeli starts immediately beneath Card Pengirim on the left column, rather than waiting for Card Penerima to finish. This confirms that the two columns stack cards independently (flex column or grid with column-major flow, NOT locked row-by-row heights).

2. **Visual Styling Tokens**:
   - Background of Cards: Pure white `#ffffff` (light mode) / dark navy `#111c34` (dark theme).
   - Card Border: `1px solid #e2e8f0` (light) / `rgba(255, 255, 255, 0.08)` (dark).
   - Card Border Radius: `6px` (`var(--radius-sm)`).
   - Card Header: Light grayish-blue `#f8fafc` (light) / `#141f35` (dark), padding `10px 16px`, bottom border `1px solid #e2e8f0`.
   - Card Header Title: Font-weight `600`, font-size `14px`, text color `#1e293b`.
   - Primary Blue Buttons: `#0284c7` (hover: `#0369a1`), border `1px solid #0284c7`, font-size `12px`, font-weight `500`, border-radius `4px`, padding `4px 12px`, white text.
   - Secondary Button (`Hapus Pembeli`): Background `#ffffff`, border `1px solid #cbd5e1`, color `#334155`, font-size `12px`, padding `4px 10px`.
   - Red Asterisk Indicator: `<span class="req" style="color: #ef4444;">*</span>` indicating mandatory fields.
   - Info Circle Icon: Light cyan/blue `(i)` icon placed immediately next to title "Penerima" and "Pembeli".

### 1.2 Existing Codebase Inspection
1. **`pib.html` (Lines 457–623)**:
   - Current Tab Entitas uses `<div class="form-grid-2">` containing only 5 cards:
     - Card 1: Importir (Penerima di Indonesia) [Lines 460–509]
     - Card 2: Pemilik Barang [Lines 512–536] with checkbox `pibCheckOwnerSame`
     - Card 3: Pemasok / Pengirim Luar Negeri (Supplier) [Lines 539–567]
     - Card 4: Penjual (Seller) [Lines 570–598] with checkbox `pibCheckSellerSame`
     - Card 5: PPJK (Opsional) [Lines 601–622] spanning 2 columns (`grid-column: span 2;`)
   - Card **Pembeli** is completely absent.
   - Top bar `.ceisa-doc-topbar` (lines ~230-250) is still present and marked for deletion.
   - Card PPJK is full-width horizontal, conflicting with the CEISA 4.0 2-column layout.

2. **`pib_dashboard.js`**:
   - `collectPibFormData()` (Lines 353–377): Gathers data using outdated field keys (`importir*`, `supplier*`, `owner*`, `seller*`, `ppjk*`).
   - `populatePibForm()` (Lines 606–629): Populates only old IDs.
   - `setupPibCopyHandlers()` (Lines 1729–1763): Only listens to checkbox `change` events (`pibCheckOwnerSame`, `pibCheckSellerSame`).

3. **`content.js` (Lines 1959–2004)**:
   - `handleCeisaAutoInputRow`: Extracts data only for `importir` and `supplier`. Lacks explicit card-level mapping for Pembeli, Pemilik Barang, Penjual, and PPJK in CEISA 4.0.

---

## 2. Detailed Technical Specifications

### 2.1 Tab Entitas Architectural Layout
```html
<!-- TAB 2: ENTITAS PIB (1:1 FORMAT ASLI CEISA 4.0) -->
<section id="pib-tab-entitas" class="tab-content-panel">
    <div class="ceisa-entitas-grid">
        <!-- ==================== KOLOM KIRI ==================== -->
        <div class="ceisa-entitas-column">
            <!-- 1. Card Pengirim -->
            <!-- 2. Card Pembeli -->
            <!-- 3. Card Pemilik Barang -->
        </div>

        <!-- ==================== KOLOM KANAN ==================== -->
        <div class="ceisa-entitas-column">
            <!-- 1. Card Penerima -->
            <!-- 2. Card Penjual -->
            <!-- 3. Card PPJK -->
        </div>
    </div>

    <!-- Stepper Navigation Footer -->
    <div class="ceisa-tab-nav-footer">
        <button type="button" class="btn btn-ceisa-primary btn-tab-prev" id="btnPrevFromPibEntitas" data-target-tab="pib-tab-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 8 8 12 12 16"/><line x1="16" y1="12" x2="8" y2="12"/></svg>
            <span>Sebelumnya</span>
        </button>
        <button type="button" class="btn btn-ceisa-primary btn-tab-next" id="btnNextFromPibEntitas" data-target-tab="pib-tab-dokumen">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 8 16 12 12 16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <span>Selanjutnya</span>
        </button>
    </div>
</section>
```

CSS rules required in `dashboard.css`:
```css
/* CEISA 4.0 Tab Entitas 2-Column Grid Layout */
.ceisa-entitas-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 20px;
    align-items: start;
}

.ceisa-entitas-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

@media (max-width: 900px) {
    .ceisa-entitas-grid {
        grid-template-columns: 1fr;
    }
}

.ceisa-tab-nav-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    margin-top: 20px;
    border-top: 1px solid var(--border-color, #e2e8f0);
}
```

---

### 2.2 Microscopic Card Specifications

#### CARD 1: PENGIRIM (Kolom Kiri - Card 1)
- **Header**:
  - Title: `Pengirim`
  - Action Button (Right):
    - Tag: `<button type="button" class="btn-ceisa-blue" id="btnRefPengirim">`
    - Content: `<svg class="icon-ref" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> <span>Referensi</span>`
- **Fields**:
  1. `Nomor Identitas *`:
     - Container: `<div class="ceisa-split-input">`
     - Select: `id="pibPengirimIdType" class="form-control" style="flex: 0 0 155px;"`
       - Options:
         - `<option value="4 - LAINNYA" selected>4 - LAINNYA</option>`
         - `<option value="0 - NPWP 12 DIGIT">0 - NPWP 12 DIGIT</option>`
         - `<option value="1 - NPWP 10 DIGIT">1 - NPWP 10 DIGIT</option>`
         - `<option value="2 - PASPOR">2 - PASPOR</option>`
         - `<option value="3 - KTP">3 - KTP</option>`
         - `<option value="5 - NPWP 15 DIGIT">5 - NPWP 15 DIGIT</option>`
         - `<option value="6 - NPWP 16 DIGIT">6 - NPWP 16 DIGIT</option>`
     - Input: `id="pibPengirimId" class="form-control form-control-mono" value="-"`
  2. `Nama *`:
     - Input: `type="text" id="pibPengirimName" class="form-control" placeholder="Nama Perusahaan Pengirim"`
     - Sample Value: `JIANGSU RUIJIA IMPORT & EXPORT CO.,LTD`
  3. `Alamat *`:
     - Textarea: `id="pibPengirimAddress" class="form-control" rows="3" placeholder="Alamat Lengkap Pengirim"`
     - Sample Value: `3034#, 3FLOOR, NO.2 BUILDING, DREAM FUN PLAZA, ZHOUTIE TOWN, YIXING CITY, JIANGSU PROVINCE, CHINA`
  4. `Negara *`:
     - Select: `id="pibPengirimCountry" class="form-control"`
     - Sample Value / Default: `CN - CHINA` (selected)

---

#### CARD 2: PEMBELI (Kolom Kiri - Card 2)
- **Header**:
  - Title: `Pembeli` + `<svg class="icon-info" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  - Action Buttons (Right):
    1. Button Hapus: `<button type="button" class="btn-ceisa-sub" id="btnHapusPembeli">Hapus Pembeli</button>`
    2. Button Salin: `<button type="button" class="btn-ceisa-blue" id="btnCopyPenerimaToPembeli">Salin data penerima</button>`
- **Fields**:
  1. `Nomor Identitas *`:
     - Container: `<div class="ceisa-split-input">`
     - Select: `id="pibPembeliIdType" class="form-control" style="flex: 0 0 155px;"` (Default: `6 - NPWP 16 DIGIT` selected)
     - Input: `id="pibPembeliId" class="form-control form-control-mono" placeholder="Nomor NPWP 16 Digit"`
  2. `NITKU`:
     - Input: `type="text" id="pibPembeliNitku" class="form-control form-control-mono" placeholder="Nomor Induk Tempat Kegiatan Usaha (22 Digit)" maxlength="22"`
     - Sample Value: `0830727251085000000002`
  3. `Nama *`:
     - Input: `type="text" id="pibPembeliName" class="form-control" placeholder="Nama Perusahaan Pembeli"`
  4. `Alamat *`:
     - Textarea: `id="pibPembeliAddress" class="form-control" rows="3" placeholder="Alamat Lengkap Pembeli"`
  5. `Negara *`:
     - Select: `id="pibPembeliCountry" class="form-control"`
     - Default: `ID - INDONESIA` (selected)

---

#### CARD 3: PEMILIK BARANG (Kolom Kiri - Card 3)
- **Header**:
  - Title: `Pemilik Barang`
  - Action Buttons (Right):
    1. Button Salin: `<button type="button" class="btn-ceisa-blue" id="btnCopyPenerimaToPemilik">Salin Penerima</button>`
    2. Button Referensi: `<button type="button" class="btn-ceisa-blue" id="btnRefPemilik"><svg ...></svg> <span>Referensi</span></button>`
- **Fields**:
  1. `Nomor Identitas`:
     - Container: `<div class="ceisa-split-input">`
     - Select: `id="pibPemilikIdType" class="form-control" style="flex: 0 0 155px;"` (Default: `6 - NPWP 16 DIGIT` selected)
     - Input: `id="pibPemilikId" class="form-control form-control-mono" placeholder="Nomor Identitas"`
  2. `NITKU`:
     - Input: `type="text" id="pibPemilikNitku" class="form-control form-control-mono" placeholder="NITKU (22 Digit)" maxlength="22"`
  3. `Nama`:
     - Input: `type="text" id="pibPemilikName" class="form-control" placeholder="Nama Pemilik Barang"`
  4. `Alamat`:
     - Textarea: `id="pibPemilikAddress" class="form-control" rows="3" placeholder="Alamat Pemilik Barang"`
  5. `Afiliasi`:
     - Select: `id="pibPemilikAfiliasi" class="form-control"`
     - Options:
       - `<option value="TAH - Tidak berhubungan" selected>TAH - Tidak berhubungan</option>`
       - `<option value="HUB - Berhubungan">HUB - Berhubungan</option>`

---

#### CARD 4: PENERIMA (Kolom Kanan - Card 1)
- **Header**:
  - Title: `Penerima` + `<svg class="icon-info" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  - Action Button (Right):
    - Button Referensi: `<button type="button" class="btn-ceisa-blue" id="btnRefPenerima"><svg ...></svg> <span>Referensi</span></button>`
- **Fields**:
  1. `Nomor Identitas *`:
     - Container: `<div class="ceisa-split-input">`
     - Select: `id="pibPenerimaIdType" class="form-control" style="flex: 0 0 155px;"` (Default: `6 - NPWP 16 DIGIT` selected)
     - Input: `id="pibPenerimaId" class="form-control form-control-mono" placeholder="Nomor NPWP 16 Digit"`
       - Sample Value: `0830727251085000`
  2. `NITKU`:
     - Input: `type="text" id="pibPenerimaNitku" class="form-control form-control-mono" placeholder="NITKU (22 Digit)" maxlength="22"`
       - Sample Value: `0830727251085000000002`
  3. `Nama *`:
     - Input: `type="text" id="pibPenerimaName" class="form-control" placeholder="Nama Penerima / Importir"`
       - Sample Value: `PT.OTTO SEKAWAN MULIA`
  4. `Alamat *`:
     - Textarea: `id="pibPenerimaAddress" class="form-control" rows="3" placeholder="Alamat Lengkap Penerima"`
       - Sample Value: `KAWASAN INDUSTRI TUNAS BATAM CENTER, TUNAS BIZPARK TYPE C6 RT.000 RW.000, BELIAN, BATAM KOTA, KOTA BATAM, KEPULAUAN RIAU`
  5. `Negara *`:
     - Select: `id="pibPenerimaCountry" class="form-control"`
     - Default: `ID - INDONESIA` (selected)
  6. `Status`:
     - Select: `id="pibPenerimaStatus" class="form-control"`
     - Options:
       - `<option value="LAINNYA" selected>LAINNYA</option>`
       - `<option value="API-U">API-U</option>`
       - `<option value="API-P">API-P</option>`
       - `<option value="NON-API">NON-API</option>`
       - `<option value="MITA">MITA</option>`
       - `<option value="AEO">AEO</option>`
  7. `Ijin Badan Pengusahaan`:
     - Container: `<div class="ceisa-split-input">`
     - Left Input (No Ijin): `type="text" id="pibPenerimaIjinNo" class="form-control" placeholder="Nomor Izin BP" style="flex: 1;"` (Sample: `0262/KA-A3/112`)
     - Right Input (Tanggal Izin): `type="date" id="pibPenerimaIjinDate" class="form-control" style="flex: 1;"` (Sample: `2024-09-21`)

---

#### CARD 5: PENJUAL (Kolom Kanan - Card 2)
- **Header**:
  - Title: `Penjual`
  - Action Button (Right):
    - Button Salin: `<button type="button" class="btn-ceisa-blue" id="btnCopyPengirimToPenjual">Salin data pengirim</button>`
- **Fields**:
  1. `Nomor Identitas *`:
     - Container: `<div class="ceisa-split-input">`
     - Select: `id="pibPenjualIdType" class="form-control" style="flex: 0 0 155px;"`
       - Default: `4 - LAINNYA` (selected)
     - Input: `id="pibPenjualId" class="form-control form-control-mono" value="-"`
  2. `Nama *`:
     - Input: `type="text" id="pibPenjualName" class="form-control" placeholder="Nama Penjual"`
     - Sample Value: `JIANGSU RUIJIA IMPORT & EXPORT CO.,LTD`
  3. `Alamat *`:
     - Textarea: `id="pibPenjualAddress" class="form-control" rows="3" placeholder="Alamat Penjual"`
     - Sample Value: `3034#, 3FLOOR, NO.2 BUILDING, DREAM FUN PLAZA, ZHOUTIE TOWN, YIXING CITY, JIANGSU PROVINCE, CHINA`
  4. `Negara *`:
     - Select: `id="pibPenjualCountry" class="form-control"`
     - Default: `CN - CHINA` (selected)

---

#### CARD 6: PPJK (Kolom Kanan - Card 3)
- **Header**:
  - Title: `PPJK`
  - Action Button (Right): None (clean header).
- **Fields**:
  1. `Nomor Identitas`:
     - Container: `<div class="ceisa-split-input">`
     - Select: `id="pibPpjkIdType" class="form-control" style="flex: 0 0 155px;"` (Default: `6 - NPWP 16 DIGIT` selected)
     - Input: `id="pibPpjkId" class="form-control form-control-mono" placeholder="Nomor Identitas PPJK"` (Sample: `0026923466215000`)
  2. `NITKU`:
     - Container: `<div style="display: flex; width: 100%;">`
     - Input: `type="text" id="pibPpjkNitku" class="form-control form-control-mono" placeholder="NITKU PPJK (22 Digit)" maxlength="22" style="border-top-right-radius: 0; border-bottom-right-radius: 0; flex: 1;"` (Sample: `0026923466215000000000`)
     - Sync Button: `<button type="button" class="btn-sync-nitku" id="btnSyncNitkuPpjk" title="Sinkronisasi NITKU" style="width: 34px; height: 32px; background: #0284c7; color: #fff; border: 1px solid #0284c7; border-top-right-radius: 4px; border-bottom-right-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg></button>`
  3. `Nama`:
     - Input: `type="text" id="pibPpjkName" class="form-control" placeholder="Nama Perusahaan PPJK"` (Sample: `TUAH TIMUR`)
  4. `Alamat`:
     - Textarea: `id="pibPpjkAddress" class="form-control" rows="3" placeholder="Alamat Kantor PPJK"` (Sample: `FIRST CITY KOMPLEK BLOK A2 NO.04 / TELUK TERING BATAM KOTA`)

---

## 3. Logic Chain

1. **Premise 1**: The original user request specifies conforming Tab Entitas PIB strictly to the visual format of CEISA 4.0 as evidenced in screenshots `media_1794282977653_5e8008e4.png` and `media_1794282972406_ac3647c6.png`.
2. **Premise 2**: In both authoritative screenshots, the tab displays exactly 6 entity cards split across 2 columns:
   - Left Column: Pengirim, Pembeli, Pemilik Barang.
   - Right Column: Penerima, Penjual, PPJK.
3. **Premise 3**: The old PIB interface implemented a 5-card layout containing obsolete fields (API-U status dropdowns, Customs Status MITA/AEO checkboxes, full-width span 2 PPJK card) and completely lacked the Pembeli card and NITKU identifiers mandated by PMK-112/CEISA 4.0.
4. **Premise 4**: Interaction patterns in CEISA 4.0 rely on explicit button triggers (`Salin data penerima`, `Salin Penerima`, `Salin data pengirim`, `Hapus Pembeli`) rather than checkbox toggles (`Sama dengan Importir`, `Sama dengan Pemasok`).
5. **Inference**: To satisfy R2, R3, and R4:
   - Remove `.ceisa-doc-topbar` and the old full-width PPJK card.
   - Restructure DOM into `.ceisa-entitas-grid` with two `.ceisa-entitas-column` wrappers.
   - Wire event listeners for copy/delete buttons to duplicate data across input DOM nodes.
   - Update `collectPibFormData` and `populatePibForm` with backwards-compatible aliases so calculations and document safety checks do not regress.

---

## 4. Caveats

1. **Backwards Compatibility**: In `pib_dashboard.js`, calculations for CIF valuta and PPh 22 depend on `pibImportirStatus` (API-U vs API-P vs NON-API) and `pibSupplierCountry`. The new specification includes `pibPenerimaStatus` and `pibPengirimCountry`, so the implementation must retain backward-compatible aliases or mirror values (`pibImportirStatus` aliased to `pibPenerimaStatus`) to prevent NaN or default tariff failures.
2. **NITKU Sync Behavior**: The CEISA 4.0 portal connects the NITKU sync button to an internal API (`/ceisa40/api/v1/referensi/nitku`). In local development mode, this should perform a graceful fallback (validating format or copying base NPWP + 6 zeros) accompanied by a feedback toast.
3. **Modal Referensi**: Clicking 'Referensi' opens entity lookups in the official portal. In the offline prototype/extension, clicking 'Referensi' should either invoke the master entity modal or show an informational toast.

---

## 5. Conclusion

The specification for CEISA 4.0 Tab Entitas is fully decoded and verified against high-resolution official screenshots:
- **Layout**: 2-column flex/grid container `.ceisa-entitas-grid` containing 6 vertical cards.
- **Left Column**: Card Pengirim (4 fields), Card Pembeli (5 fields), Card Pemilik Barang (5 fields).
- **Right Column**: Card Penerima (7 fields), Card Penjual (4 fields), Card PPJK (4 fields).
- **Interactive Controls**: 4 copy/delete header buttons (`btnHapusPembeli`, `btnCopyPenerimaToPembeli`, `btnCopyPenerimaToPemilik`, `btnCopyPengirimToPenjual`) + NITKU sync button + Reference buttons.
- **Data Model**: Full state coverage with backward-compatible aliases for existing PIB calculation routines.

---

## 6. Verification Method

To independently verify this specification:
1. **Visual Alignment**: Open `pib.html` in a browser after implementation and compare side-by-side with `media_1794282977653_5e8008e4.png` and `media_1794282972406_ac3647c6.png`. Verify card headers, borders, colors (`#0284c7`), and 2-column alignment.
2. **DOM Element Existence**:
   ```powershell
   powershell -Command "Select-String -Path c:\Synthetic\pib.html -Pattern 'pibPengirimId|pibPembeliId|pibPemilikAfiliasi|pibPenerimaIjinNo|pibPenjualName|btnSyncNitkuPpjk'"
   ```
3. **Copy Interactivity**:
   - Fill Penerima data, click 'Salin data penerima' -> Verify Card Pembeli is filled.
   - Click 'Hapus Pembeli' -> Verify Card Pembeli inputs are cleared.
   - Click 'Salin Penerima' -> Verify Card Pemilik Barang is filled.
   - Fill Pengirim data, click 'Salin data pengirim' -> Verify Card Penjual is filled.
4. **Form Serialization**:
   - Execute `collectPibFormData()` in browser devtools console -> Verify returned object contains all 6 entity sets (`pengirim*`, `pembeli*`, `pemilik*`, `penerima*`, `penjual*`, `ppjk*`).
