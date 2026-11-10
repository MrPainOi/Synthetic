# Handoff Report — Explorer Survey 3 (Data Handling & Auto-Input Mapping)

**Author**: Explorer Survey 3 (Archetype: Explorer / Investigator & Synthesizer)  
**Date**: 2026-11-10T04:25:00Z  
**Scope**: `pib_dashboard.js`, `content.js`, `pib.html`, and extension storage/message flow for PIB Entitas CEISA 4.0

---

## 1. Observation

Direct observations from the codebase, screenshots, and configuration:

### 1.1 Current State of `pib_dashboard.js`
- **Draft Defaults (`SAMPLE_PIB_DATA`, lines 71–98)**:
  Contains legacy fields for 4 entities (Importir, Pemilik, Supplier, PPJK):
  ```javascript
  // Importir & Entitas
  importirIdType: "5 - NPWP 16 DIGIT",
  importirId: "01.234.567.8-012.000 / NIB 912000881234",
  importirNib: "912000881234",
  importirName: "PT. INDONESIA MAKMUR IMPORTAMA",
  importirAddress: "Kawasan Industri MM2100 Blok C-5, Cikarang Barat, Kab. Bekasi, Jawa Barat 17530",
  importirStatus: "API-U",
  importirCustomsStatus: "Importir Umum",
  
  ownerSame: true,
  ownerId: "01.234.567.8-012.000",
  ownerName: "PT. INDONESIA MAKMUR IMPORTAMA",
  ownerAddress: "Kawasan Industri MM2100 Blok C-5, Cikarang Barat, Kab. Bekasi, Jawa Barat 17530",
  
  ppjkId: "0026923485215000",
  ppjkName: "PT. SARANA PPJK LOGISTIK UTAMA",
  ppjkAddress: "Jl. Sulawesi No. 12 Tanjung Priok, Jakarta Utara",

  supplierName: "SHANGHAI PRECISION MACHINERY CO., LTD.",
  supplierAddress: "No. 888 Songze Avenue, Qingpu District, Shanghai 201700, China",
  supplierCountry: "CN - CHINA",
  
  sellerSame: true,
  sellerName: "SHANGHAI PRECISION MACHINERY CO., LTD.",
  sellerAddress: "No. 888 Songze Avenue, Qingpu District, Shanghai 201700, China",
  sellerCountry: "CN - CHINA",
  ```
  *Defect/Gap*: Missing `NITKU` for all entities, missing `ijinBpNomor` and `ijinBpTanggal`, missing Pembeli entity, missing Afiliasi for Pemilik, and uses old field naming conventions (`importir*`, `supplier*`).

- **Data Collection (`collectPibFormData`, lines 334–378)**:
  ```javascript
  importirIdType: getVal('pibImportirIdType'),
  importirId: getVal('pibImportirId'),
  importirNib: getVal('pibImportirNib'),
  importirName: getVal('pibImportirName'),
  importirAddress: getVal('pibImportirAddress'),
  importirStatus: getVal('pibImportirStatus'),
  importirCustomsStatus: getVal('pibImportirCustomsStatus'),

  ownerSame: document.getElementById('pibCheckOwnerSame')?.checked ?? true,
  ownerId: getVal('pibOwnerId'),
  ownerName: getVal('pibOwnerName'),
  ownerAddress: getVal('pibOwnerAddress'),

  ppjkId: getVal('pibPpjkId'),
  ppjkName: getVal('pibPpjkName'),
  ppjkAddress: getVal('pibPpjkAddress'),

  supplierName: getVal('pibSupplierName'),
  supplierAddress: getVal('pibSupplierAddress'),
  supplierCountry: getVal('pibSupplierCountry'),

  sellerSame: document.getElementById('pibCheckSellerSame')?.checked ?? true,
  sellerName: getVal('pibSellerName'),
  sellerAddress: getVal('pibSellerAddress'),
  sellerCountry: getVal('pibSellerCountry'),
  ```
  *Defect/Gap*: Reads strictly from legacy DOM element IDs (`pibImportirId`, `pibCheckOwnerSame`, `pibSupplierName`, etc.). If new CEISA 4.0 cards are introduced with updated IDs, `collectPibFormData` will produce empty or undefined values.

- **Data Population (`loadPibDraftData`, lines 556–629)**:
  Note: There is no standalone function named `populatePibForm`; the form population is handled by `loadPibDraftData(data, shouldSave)`.
  ```javascript
  // Entitas
  if (data.importirIdType) setVal('pibImportirIdType', data.importirIdType);
  if (data.importirId) setVal('pibImportirId', data.importirId);
  if (data.importirNib) setVal('pibImportirNib', data.importirNib);
  if (importirName) setVal('pibImportirName', importirName);
  if (importirAddress) setVal('pibImportirAddress', importirAddress);
  if (data.importirStatus) setVal('pibImportirStatus', data.importirStatus);
  if (data.importirCustomsStatus) setVal('pibImportirCustomsStatus', data.importirCustomsStatus);

  if (data.ownerName || importirName) setVal('pibOwnerName', data.ownerName || importirName);
  if (data.ownerAddress || importirAddress) setVal('pibOwnerAddress', data.ownerAddress || importirAddress);
  if (data.ownerId || data.importirId) setVal('pibOwnerId', data.ownerId || data.importirId);

  if (data.ppjkId) setVal('pibPpjkId', data.ppjkId);
  if (data.ppjkName) setVal('pibPpjkName', data.ppjkName);
  if (data.ppjkAddress) setVal('pibPpjkAddress', data.ppjkAddress);

  if (supplierName) setVal('pibSupplierName', supplierName);
  if (supplierAddress) setVal('pibSupplierAddress', supplierAddress);
  if (supplierCountry) setVal('pibSupplierCountry', supplierCountry);

  if (data.sellerName || supplierName) setVal('pibSellerName', data.sellerName || supplierName);
  if (data.sellerAddress || supplierAddress) setVal('pibSellerAddress', data.sellerAddress || supplierAddress);
  if (data.sellerCountry || supplierCountry) setVal('pibSellerCountry', data.sellerCountry || supplierCountry);
  ```

- **Copy Handlers (`setupPibCopyHandlers`, lines 1729–1763)**:
  Currently, copy handling only listens to `change` events on checkboxes:
  - `pibCheckOwnerSame`
  - `pibCheckSellerSame`
  No click listeners exist for buttons: `'Salin data penerima'`, `'Salin data pengirim'`, `'Salin Penerima'`, `'Hapus Pembeli'`, or NITKU sync.

- **Calculation & Other Field Dependencies**:
  - `pib_dashboard.js:266`: `const importirStatus = document.getElementById('pibImportirStatus')?.value || 'API-U';` (determines PPh rate 2.5% vs 7.5%).
  - `pib_dashboard.js:1710`: `if (!data.importirName) { alert('Mohon lengkapi Nama Importir...'); switchPibTab('pib-tab-entitas'); }`
  - `pib_dashboard.js:2007`: `const country = document.getElementById('pibSupplierCountry')?.value || 'CN - CHINA';` (used when adding a new item).

### 1.2 Current State of `content.js` (Auto-Input in CEISA 4.0)
- **Container & Field Lookup (lines 1720–1769)**:
  - `findCeisaTargetContainer()` looks for `.ant-modal`, `.ant-tabs-tabpane-active`, or falls back to `document`.
  - `findFieldByKeywords(keywords, parent)` searches inputs/selects/textareas or associated `<label>` text within `parent`.
- **Auto-Input Row Handler (`handleCeisaAutoInputRow`, lines 1959–2004)**:
  ```javascript
  if (section === "entitas") {
      const shipper = item.shipperName || item.supplierName || item.eksportirNama || "";
      const consignee = item.consigneeName || item.importirName || item.pembeliNama || "";
      const importirId = item.importirId || item.npwpImportir || "";
      const importirNib = item.importirNib || item.nib || "";
      const importirAddr = item.importirAddress || item.consigneeAddress || "";
      const supplierAddr = item.supplierAddress || item.shipperAddress || "";
      const supplierCountry = item.supplierCountry || item.negaraPemasok || "";

      const csgInput = findFieldByKeywords(["namaImportir", "importir", "consignee", "penerima", "nama_importir"], container);
      if (csgInput && consignee) {
          setNativeInputValue(csgInput, consignee);
          filledFields.push('Importir: ' + consignee);
      }
      const idInput = findFieldByKeywords(["nomorIdentitasImportir", "npwpImportir", "idImportir", "npwp", "nomor identitas"], container);
      if (idInput && importirId) {
          setNativeInputValue(idInput, importirId);
          filledFields.push('NPWP: ' + importirId);
      }
      const nibInput = findFieldByKeywords(["nibImportir", "nib", "nomor induk berusaha"], container);
      if (nibInput && importirNib) {
          setNativeInputValue(nibInput, importirNib);
          filledFields.push('NIB: ' + importirNib);
      }
      const addrInput = findFieldByKeywords(["alamatImportir", "alamat", "alamat penerima"], container);
      if (addrInput && importirAddr) {
          setNativeInputValue(addrInput, importirAddr);
          filledFields.push('Alamat Imp: ' + importirAddr.substring(0, 15) + '...');
      }

      const shpInput = findFieldByKeywords(["namaPemasok", "namaEksportir", "pemasok", "eksportir", "shipper", "pengirim"], container);
      if (shpInput && shipper) {
          setNativeInputValue(shpInput, shipper);
          filledFields.push('Pemasok: ' + shipper);
      }
      const sAddrInput = findFieldByKeywords(["alamatPemasok", "alamatEksportir", "alamat pemasok"], container);
      if (sAddrInput && supplierAddr) {
          setNativeInputValue(sAddrInput, supplierAddr);
          filledFields.push('Alamat Pem: ' + supplierAddr.substring(0, 15) + '...');
      }
      const sCtryInput = findFieldByKeywords(["negaraPemasok", "negaraEksportir", "negara asal", "country"], container);
      if (sCtryInput && supplierCountry) {
          setNativeInputValue(sCtryInput, supplierCountry);
          filledFields.push('Negara: ' + supplierCountry);
      }
  }
  ```
  *Defect/Gap*:
  1. Searches the entire tab pane (`container`) without card scoping. In CEISA 4.0, all 6 cards have labels "Nomor Identitas", "Nama", "Alamat", and "Negara". As a result, searching globally causes all inputs to collide and only ever target the first matching card (Card Pengirim)!
  2. Does not map: NITKU, Status Penerima, Ijin BP (Nomor & Tanggal), Pembeli (ID, NITKU, Nama, Alamat, Negara), Penjual (ID, Nama, Alamat, Negara), Pemilik Barang (ID, NITKU, Nama, Alamat, Afiliasi), and PPJK (ID, NITKU, Nama, Alamat).

### 1.3 CEISA 4.0 Reference Layout from Screenshots
Verified from `media_1794282977653_5e8008e4.png` and `media_1794282972406_ac3647c6.png`:
- **Left Column**:
  1. **Pengirim**: Button `[Referensi]`, Nomor Identitas (`select` + `input`), Nama (`input`), Alamat (`textarea`), Negara (`select`).
  2. **Pembeli**: Button `[Hapus Pembeli]`, Button `[Salin data penerima]`, Nomor Identitas (`select` + `input`), NITKU (`input`), Nama (`input`), Alamat (`textarea`), Negara (`select`).
  3. **Pemilik Barang**: Button `[Salin Penerima]`, Button `[Referensi]`, Nomor Identitas (`select` + `input`), NITKU (`input`), Nama (`input`), Alamat (`textarea`), Afiliasi (`select`, default 'TAH - Tidak berhubungan').
- **Right Column**:
  1. **Penerima**: Button `[Referensi]`, Nomor Identitas (`select` [default '6 - NPWP 16 DIGIT'] + `input`), NITKU (`input`), Nama (`input`), Alamat (`textarea`), Negara (`select`), Status (`select`, default 'LAINNYA'), Ijin Badan Pengusahaan (`input` no + `input` tanggal).
  2. **Penjual**: Button `[Salin data pengirim]`, Nomor Identitas (`select` + `input`), Nama (`input`), Alamat (`textarea`), Negara (`select`).
  3. **PPJK**: Nomor Identitas (`select` [default '6 - NPWP 16 DIGIT'] + `input`), NITKU (`input` + sync button `[C]`), Nama (`input`), Alamat (`textarea`).

---

## 2. Logic Chain

1. **Schema Standardization**:
   - Because both `collectPibFormData` and `loadPibDraftData` exchange data with `localStorage`, backend file storage (`drafts/impor/*.json`), and `chrome.storage.local` (`ceisa_pib_draft`), the entity schema must cleanly represent all 6 cards while providing backward-compatible aliases for legacy draft files.
   - If legacy drafts only contain `importirName` and `supplierName`, `loadPibDraftData` must assign:
     * `penerimaName = data.penerimaName || data.importirName || data.consigneeName`
     * `pengirimName = data.pengirimName || data.supplierName || data.shipperName`
     * `pembeliName = data.pembeliName || data.penerimaName || data.importirName`
     * `penjualName = data.penjualName || data.pengirimName || data.supplierName`
     * `pemilikName = data.pemilikName || data.ownerName || data.penerimaName || data.importirName`
     * `ppjkName = data.ppjkName || ''`
   - In reverse, `collectPibFormData` must output both new standard keys (`penerima*`, `pengirim*`, `pembeli*`, `penjual*`, `pemilik*`, `ppjk*`) AND legacy keys (`importir*`, `supplier*`, `owner*`, `seller*`) so that `submitPibCustoms`, item addition, and external consumers never encounter missing properties.

2. **DOM ID Binding in `pib.html` & `pib_dashboard.js`**:
   - To avoid collisions and maintain clarity matching `peb.html`, each input in `pib.html` must follow a predictable ID pattern:
     * Pengirim: `pibPengirimIdType`, `pibPengirimId`, `pibPengirimName`, `pibPengirimAddress`, `pibPengirimCountry`
     * Penerima: `pibPenerimaIdType`, `pibPenerimaId`, `pibPenerimaNitku`, `pibPenerimaName`, `pibPenerimaAddress`, `pibPenerimaCountry`, `pibPenerimaStatus`, `pibIjinBpNomor`, `pibIjinBpTanggal`
     * Pembeli: `pibPembeliIdType`, `pibPembeliId`, `pibPembeliNitku`, `pibPembeliName`, `pibPembeliAddress`, `pibPembeliCountry`
     * Penjual: `pibPenjualIdType`, `pibPenjualId`, `pibPenjualName`, `pibPenjualAddress`, `pibPenjualCountry`
     * Pemilik Barang: `pibPemilikIdType`, `pibPemilikId`, `pibPemilikNitku`, `pibPemilikName`, `pibPemilikAddress`, `pibPemilikAfiliasi`
     * PPJK: `pibPpjkIdType`, `pibPpjkId`, `pibPpjkNitku`, `pibPpjkName`, `pibPpjkAddress`

3. **Copy Button Event Wiring**:
   - Instead of legacy checkbox-based toggling (`pibCheckOwnerSame`, `pibCheckSellerSame`), the UI uses explicit action buttons:
     * `btnSalinDataPenerima` (Card Pembeli): Reads Penerima fields (`IdType`, `Id`, `Nitku`, `Name`, `Address`, `Country`) and populates Pembeli inputs.
     * `btnHapusPembeli` (Card Pembeli): Sets Pembeli `Id` to `'-'`, `Nitku` to `''`, `Name` to `'-'`, `Address` to `'-'`.
     * `btnSalinDataPengirim` (Card Penjual): Reads Pengirim fields (`IdType`, `Id`, `Name`, `Address`, `Country`) and populates Penjual inputs.
     * `btnSalinPenerima` (Card Pemilik Barang): Reads Penerima fields (`IdType`, `Id`, `Nitku`, `Name`, `Address`) and populates Pemilik Barang inputs.
     * `btnSyncNitkuPpjk` (Card PPJK): Takes `pibPpjkId` (16 digits), removes non-digits, pads with 6 zeroes to 22 digits, and sets `pibPpjkNitku`.
   - Each copy handler must trigger `input` and `change` events so that `triggerPibAutoSave()` immediately preserves the modified state in localStorage.

4. **CEISA 4.0 Auto-Input Architecture in `content.js`**:
   - CEISA 4.0 uses Ant Design cards with card titles: "Pengirim", "Penerima", "Pembeli", "Penjual", "Pemilik Barang", and "PPJK".
   - Searching the root `container` for "Nomor Identitas" causes catastrophic ambiguity.
   - Solution: Implement `findCeisaCard(titleKeyword, container)` that locates the specific card element by matching header title text (`.ant-card-head, .card-header, legend, h4, h5, span`), then calls `findFieldByKeywords(...)` scoped exclusively to that card.
   - For each card, map the corresponding draft fields using `setNativeInputValue(...)` to ensure React synthetic events trigger internal state updates in CEISA 4.0.

---

## 3. Detailed Specifications

### 3.1 Data Structure Schema (All 6 Entity Cards)

```typescript
interface PibEntitasSchema {
    // 1. Pengirim (Overseas Shipper / Supplier)
    pengirimIdType: string;       // e.g. "4 - LAINNYA"
    pengirimId: string;           // e.g. "-"
    pengirimName: string;         // e.g. "JIANGSU RUIJIA IMPORT & EXPORT CO.,LTD"
    pengirimAddress: string;      // e.g. "3034#, 3FLOOR , NO.2 BUILDING..."
    pengirimCountry: string;      // e.g. "CN - CHINA"

    // 2. Penerima (Indonesian Importer / Consignee)
    penerimaIdType: string;       // e.g. "6 - NPWP 16 DIGIT"
    penerimaId: string;           // e.g. "0830727251085000"
    penerimaNitku: string;        // e.g. "0830727251085000000002" (22 digits)
    penerimaName: string;         // e.g. "PT. OTTO SEKAWAN MULIA"
    penerimaAddress: string;      // e.g. "KAWASAN INDUSTRI TUNAS BATAM CENTER..."
    penerimaCountry: string;      // e.g. "ID - INDONESIA"
    penerimaStatus: string;       // e.g. "LAINNYA" (or "KPB / FTZ", "BERIKAT")
    ijinBpNomor: string;          // e.g. "0262/KA-A3/112"
    ijinBpTanggal: string;        // e.g. "21-09-2024" (DD-MM-YYYY)

    // 3. Pembeli (Buyer)
    pembeliIdType: string;        // e.g. "6 - NPWP 16 DIGIT"
    pembeliId: string;            // e.g. "0830727251085000"
    pembeliNitku: string;         // e.g. "0830727251085000000002"
    pembeliName: string;          // e.g. "PT. OTTO SEKAWAN MULIA"
    pembeliAddress: string;       // e.g. "KAWASAN INDUSTRI TUNAS BATAM CENTER..."
    pembeliCountry: string;       // e.g. "ID - INDONESIA"

    // 4. Penjual (Seller)
    penjualIdType: string;        // e.g. "4 - LAINNYA"
    penjualId: string;            // e.g. "-"
    penjualName: string;          // e.g. "JIANGSU RUIJIA IMPORT & EXPORT CO.,LTD"
    penjualAddress: string;       // e.g. "3034#, 3FLOOR , NO.2 BUILDING..."
    penjualCountry: string;       // e.g. "CN - CHINA"

    // 5. Pemilik Barang (Cargo Owner)
    pemilikIdType: string;        // e.g. "6 - NPWP 16 DIGIT"
    pemilikId: string;            // e.g. "0830727251085000"
    pemilikNitku: string;         // e.g. "0830727251085000000002"
    pemilikName: string;          // e.g. "PT. OTTO SEKAWAN MULIA"
    pemilikAddress: string;       // e.g. "KAWASAN INDUSTRI TUNAS BATAM CENTER..."
    pemilikAfiliasi: string;      // e.g. "TAH - Tidak berhubungan" (or "HUB - Berhubungan Istimewa")

    // 6. PPJK (Customs Broker)
    ppjkIdType: string;           // e.g. "6 - NPWP 16 DIGIT"
    ppjkId: string;               // e.g. "0026923485215000"
    ppjkNitku: string;            // e.g. "0026923485215000000000"
    ppjkName: string;             // e.g. "TUAH TIMUR"
    ppjkAddress: string;          // e.g. "FIRST CITY KOMPLEK BLOK A2 NO.04..."
}
```

### 3.2 Exact Changes Required in `collectPibFormData` (`pib_dashboard.js`)

Replace lines 353–377 with:
```javascript
        // ==========================================
        // CEISA 4.0 TAB ENTITAS (6 CARDS)
        // ==========================================
        // Card 1: Pengirim
        pengirimIdType: getVal('pibPengirimIdType') || '4 - LAINNYA',
        pengirimId: getVal('pibPengirimId') || '-',
        pengirimName: getVal('pibPengirimName'),
        pengirimAddress: getVal('pibPengirimAddress'),
        pengirimCountry: getVal('pibPengirimCountry') || 'CN - CHINA',

        // Card 2: Pembeli
        pembeliIdType: getVal('pibPembeliIdType') || '6 - NPWP 16 DIGIT',
        pembeliId: getVal('pibPembeliId'),
        pembeliNitku: getVal('pibPembeliNitku'),
        pembeliName: getVal('pibPembeliName'),
        pembeliAddress: getVal('pibPembeliAddress'),
        pembeliCountry: getVal('pibPembeliCountry') || 'ID - INDONESIA',

        // Card 3: Pemilik Barang
        pemilikIdType: getVal('pibPemilikIdType') || '6 - NPWP 16 DIGIT',
        pemilikId: getVal('pibPemilikId'),
        pemilikNitku: getVal('pibPemilikNitku'),
        pemilikName: getVal('pibPemilikName'),
        pemilikAddress: getVal('pibPemilikAddress'),
        pemilikAfiliasi: getVal('pibPemilikAfiliasi') || 'TAH - Tidak berhubungan',

        // Card 4: Penerima
        penerimaIdType: getVal('pibPenerimaIdType') || '6 - NPWP 16 DIGIT',
        penerimaId: getVal('pibPenerimaId'),
        penerimaNitku: getVal('pibPenerimaNitku'),
        penerimaName: getVal('pibPenerimaName'),
        penerimaAddress: getVal('pibPenerimaAddress'),
        penerimaCountry: getVal('pibPenerimaCountry') || 'ID - INDONESIA',
        penerimaStatus: getVal('pibPenerimaStatus') || 'LAINNYA',
        ijinBpNomor: getVal('pibIjinBpNomor'),
        ijinBpTanggal: getVal('pibIjinBpTanggal'),

        // Card 5: Penjual
        penjualIdType: getVal('pibPenjualIdType') || '4 - LAINNYA',
        penjualId: getVal('pibPenjualId') || '-',
        penjualName: getVal('pibPenjualName'),
        penjualAddress: getVal('pibPenjualAddress'),
        penjualCountry: getVal('pibPenjualCountry') || 'CN - CHINA',

        // Card 6: PPJK
        ppjkIdType: getVal('pibPpjkIdType') || '6 - NPWP 16 DIGIT',
        ppjkId: getVal('pibPpjkId'),
        ppjkNitku: getVal('pibPpjkNitku'),
        ppjkName: getVal('pibPpjkName'),
        ppjkAddress: getVal('pibPpjkAddress'),

        // Legacy Aliases for 100% Backward Compatibility
        importirIdType: getVal('pibPenerimaIdType') || getVal('pibImportirIdType'),
        importirId: getVal('pibPenerimaId') || getVal('pibImportirId'),
        importirName: getVal('pibPenerimaName') || getVal('pibImportirName'),
        importirAddress: getVal('pibPenerimaAddress') || getVal('pibImportirAddress'),
        consigneeName: getVal('pibPenerimaName'),
        consigneeAddress: getVal('pibPenerimaAddress'),
        supplierName: getVal('pibPengirimName') || getVal('pibSupplierName'),
        supplierAddress: getVal('pibPengirimAddress') || getVal('pibSupplierAddress'),
        supplierCountry: getVal('pibPengirimCountry') || getVal('pibSupplierCountry'),
        shipperName: getVal('pibPengirimName'),
        shipperAddress: getVal('pibPengirimAddress'),
        ownerName: getVal('pibPemilikName') || getVal('pibOwnerName'),
        ownerAddress: getVal('pibPemilikAddress') || getVal('pibOwnerAddress'),
        ownerId: getVal('pibPemilikId') || getVal('pibOwnerId'),
        sellerName: getVal('pibPenjualName') || getVal('pibSellerName'),
        sellerAddress: getVal('pibPenjualAddress') || getVal('pibSellerAddress'),
        sellerCountry: getVal('pibPenjualCountry') || getVal('pibSellerCountry'),
```

### 3.3 Exact Changes Required in `loadPibDraftData` / `populatePibForm` (`pib_dashboard.js`)

Replace lines 566–629 with:
```javascript
    // Resolve entity values with multi-source fallback
    let penerimaName = data.penerimaName || data.importirName || data.consigneeName || '';
    let penerimaAddress = data.penerimaAddress || data.importirAddress || data.consigneeAddress || '';
    let pengirimName = data.pengirimName || data.supplierName || data.shipperName || '';
    let pengirimAddress = data.pengirimAddress || data.supplierAddress || data.shipperAddress || '';
    let pengirimCountry = data.pengirimCountry || data.supplierCountry || 'CN - CHINA';

    // Sinar Asia special rule:
    const isSinarAsiaImpor = /sinar\s*asia/i.test(penerimaName) ||
                             /sinar\s*asia/i.test(pengirimName) ||
                             /golden\s*ben/i.test(penerimaName) ||
                             /golden\s*ben/i.test(pengirimName);

    if (isSinarAsiaImpor) {
        penerimaName = 'PT. SINAR ASIA PACK';
        if (!pengirimName || /sinar\s*asia/i.test(pengirimName)) {
            pengirimName = 'GOLDEN BEN PRINTER PTE LTD';
            pengirimCountry = 'SG - SINGAPORE';
        }
    }

    // Card 1: Pengirim
    setVal('pibPengirimIdType', data.pengirimIdType || data.supplierIdType || '4 - LAINNYA');
    setVal('pibPengirimId', data.pengirimId || data.supplierId || '-');
    setVal('pibPengirimName', pengirimName);
    setVal('pibPengirimAddress', pengirimAddress);
    setVal('pibPengirimCountry', pengirimCountry);

    // Card 2: Pembeli
    setVal('pibPembeliIdType', data.pembeliIdType || data.penerimaIdType || '6 - NPWP 16 DIGIT');
    setVal('pibPembeliId', data.pembeliId || data.penerimaId || data.importirId || '');
    setVal('pibPembeliNitku', data.pembeliNitku || data.penerimaNitku || '');
    setVal('pibPembeliName', data.pembeliName || penerimaName);
    setVal('pibPembeliAddress', data.pembeliAddress || penerimaAddress);
    setVal('pibPembeliCountry', data.pembeliCountry || data.penerimaCountry || 'ID - INDONESIA');

    // Card 3: Pemilik Barang
    setVal('pibPemilikIdType', data.pemilikIdType || data.penerimaIdType || '6 - NPWP 16 DIGIT');
    setVal('pibPemilikId', data.pemilikId || data.ownerId || data.penerimaId || data.importirId || '');
    setVal('pibPemilikNitku', data.pemilikNitku || data.penerimaNitku || '');
    setVal('pibPemilikName', data.pemilikName || data.ownerName || penerimaName);
    setVal('pibPemilikAddress', data.pemilikAddress || data.ownerAddress || penerimaAddress);
    setVal('pibPemilikAfiliasi', data.pemilikAfiliasi || 'TAH - Tidak berhubungan');

    // Card 4: Penerima
    setVal('pibPenerimaIdType', data.penerimaIdType || data.importirIdType || '6 - NPWP 16 DIGIT');
    setVal('pibPenerimaId', data.penerimaId || data.importirId || '');
    setVal('pibPenerimaNitku', data.penerimaNitku || (data.penerimaId && data.penerimaId.replace(/\D/g, '').length === 16 ? data.penerimaId.replace(/\D/g, '') + '000000' : ''));
    setVal('pibPenerimaName', penerimaName);
    setVal('pibPenerimaAddress', penerimaAddress);
    setVal('pibPenerimaCountry', data.penerimaCountry || 'ID - INDONESIA');
    setVal('pibPenerimaStatus', data.penerimaStatus || 'LAINNYA');
    setVal('pibIjinBpNomor', data.ijinBpNomor || '');
    setVal('pibIjinBpTanggal', data.ijinBpTanggal || '');

    // Card 5: Penjual
    setVal('pibPenjualIdType', data.penjualIdType || data.pengirimIdType || '4 - LAINNYA');
    setVal('pibPenjualId', data.penjualId || data.pengirimId || '-');
    setVal('pibPenjualName', data.penjualName || data.sellerName || pengirimName);
    setVal('pibPenjualAddress', data.penjualAddress || data.sellerAddress || pengirimAddress);
    setVal('penjualCountry', data.penjualCountry || data.sellerCountry || pengirimCountry);

    // Card 6: PPJK
    setVal('pibPpjkIdType', data.ppjkIdType || '6 - NPWP 16 DIGIT');
    setVal('pibPpjkId', data.ppjkId || '');
    setVal('pibPpjkNitku', data.ppjkNitku || (data.ppjkId && data.ppjkId.replace(/\D/g, '').length === 16 ? data.ppjkId.replace(/\D/g, '') + '000000' : ''));
    setVal('pibPpjkName', data.ppjkName || '');
    setVal('pibPpjkAddress', data.ppjkAddress || '');
```
*Note*: Also expose an explicit alias at the end of the file:
```javascript
window.populatePibForm = loadPibDraftData;
```

### 3.4 Copy Button Implementation Details

In `setupPibCopyHandlers()` (`pib_dashboard.js` lines 1728–1763):
```javascript
function setupPibCopyHandlers() {
    // 1. Salin data penerima -> Pembeli
    const btnSalinPenerimaToPembeli = document.getElementById('pibBtnSalinPenerima');
    if (btnSalinPenerimaToPembeli) {
        btnSalinPenerimaToPembeli.addEventListener('click', () => {
            const idType = document.getElementById('pibPenerimaIdType')?.value || '6 - NPWP 16 DIGIT';
            const id = document.getElementById('pibPenerimaId')?.value || '';
            const nitku = document.getElementById('pibPenerimaNitku')?.value || '';
            const name = document.getElementById('pibPenerimaName')?.value || '';
            const addr = document.getElementById('pibPenerimaAddress')?.value || '';
            const ctry = document.getElementById('pibPenerimaCountry')?.value || 'ID - INDONESIA';

            const setField = (elemId, val) => {
                const el = document.getElementById(elemId);
                if (el) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            };

            setField('pibPembeliIdType', idType);
            setField('pibPembeliId', id);
            setField('pibPembeliNitku', nitku);
            setField('pibPembeliName', name);
            setField('pibPembeliAddress', addr);
            setField('pibPembeliCountry', ctry);

            if (typeof showToast === 'function') {
                showToast('Data penerima berhasil disalin ke Pembeli!', 'success');
            }
        });
    }

    // 2. Hapus Pembeli
    const btnHapusPembeli = document.getElementById('pibBtnHapusPembeli');
    if (btnHapusPembeli) {
        btnHapusPembeli.addEventListener('click', () => {
            const setField = (elemId, val) => {
                const el = document.getElementById(elemId);
                if (el) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            };
            setField('pibPembeliId', '-');
            setField('pibPembeliNitku', '');
            setField('pibPembeliName', '-');
            setField('pibPembeliAddress', '-');

            if (typeof showToast === 'function') {
                showToast('Data pembeli berhasil dikosongkan.', 'info');
            }
        });
    }

    // 3. Salin data pengirim -> Penjual
    const btnSalinPengirimToPenjual = document.getElementById('pibBtnSalinPengirim');
    if (btnSalinPengirimToPenjual) {
        btnSalinPengirimToPenjual.addEventListener('click', () => {
            const idType = document.getElementById('pibPengirimIdType')?.value || '4 - LAINNYA';
            const id = document.getElementById('pibPengirimId')?.value || '-';
            const name = document.getElementById('pibPengirimName')?.value || '';
            const addr = document.getElementById('pibPengirimAddress')?.value || '';
            const ctry = document.getElementById('pibPengirimCountry')?.value || 'CN - CHINA';

            const setField = (elemId, val) => {
                const el = document.getElementById(elemId);
                if (el) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            };

            setField('pibPenjualIdType', idType);
            setField('pibPenjualId', id);
            setField('pibPenjualName', name);
            setField('pibPenjualAddress', addr);
            setField('pibPenjualCountry', ctry);

            if (typeof showToast === 'function') {
                showToast('Data pengirim berhasil disalin ke Penjual!', 'success');
            }
        });
    }

    // 4. Salin Penerima -> Pemilik Barang
    const btnSalinPenerimaToPemilik = document.getElementById('pibBtnSalinPemilik');
    if (btnSalinPenerimaToPemilik) {
        btnSalinPenerimaToPemilik.addEventListener('click', () => {
            const idType = document.getElementById('pibPenerimaIdType')?.value || '6 - NPWP 16 DIGIT';
            const id = document.getElementById('pibPenerimaId')?.value || '';
            const nitku = document.getElementById('pibPenerimaNitku')?.value || '';
            const name = document.getElementById('pibPenerimaName')?.value || '';
            const addr = document.getElementById('pibPenerimaAddress')?.value || '';

            const setField = (elemId, val) => {
                const el = document.getElementById(elemId);
                if (el) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            };

            setField('pibPemilikIdType', idType);
            setField('pibPemilikId', id);
            setField('pibPemilikNitku', nitku);
            setField('pibPemilikName', name);
            setField('pibPemilikAddress', addr);

            if (typeof showToast === 'function') {
                showToast('Data penerima berhasil disalin ke Pemilik Barang!', 'success');
            }
        });
    }

    // 5. Sinkronisasi NITKU PPJK
    const btnSyncNitkuPpjk = document.getElementById('pibBtnSyncNitkuPpjk');
    if (btnSyncNitkuPpjk) {
        btnSyncNitkuPpjk.addEventListener('click', () => {
            const ppjkId = document.getElementById('pibPpjkId')?.value || '';
            const digits = ppjkId.replace(/\D/g, '');
            const nitkuEl = document.getElementById('pibPpjkNitku');
            if (nitkuEl && digits.length >= 15) {
                nitkuEl.value = digits.padEnd(22, '0');
                nitkuEl.dispatchEvent(new Event('input', { bubbles: true }));
                nitkuEl.dispatchEvent(new Event('change', { bubbles: true }));
                if (typeof showToast === 'function') {
                    showToast('NITKU PPJK berhasil disinkronkan (22 digit)!', 'success');
                }
            }
        });
    }
}
```

### 3.5 Mapping Logic in `content.js` for CEISA 4.0 Auto-Input

In `content.js` lines 1959–2004:
Implement card-scoped query algorithm:
```javascript
        if (section === "entitas") {
            // Helper to find a card container by its title in CEISA 4.0
            const findCeisaCard = (titlePattern) => {
                const candidates = container.querySelectorAll('.ant-card, .card, .ceisa-form-card, fieldset, [class*="card"], .ant-col, div');
                for (const c of candidates) {
                    const header = c.querySelector('.ant-card-head, .card-header, .ceisa-card-title, h4, h5, .card-title, span');
                    if (header) {
                        const txt = (header.innerText || header.textContent || '').trim();
                        if (titlePattern.test(txt)) return c;
                    }
                }
                return null;
            };

            const fillCardField = (card, keywords, value, fieldDesc) => {
                if (!card || !value) return;
                const field = findFieldByKeywords(keywords, card);
                if (field) {
                    setNativeInputValue(field, value);
                    filledFields.push(fieldDesc + ': ' + String(value).slice(0, 15));
                }
            };

            // 1. CARD PENGIRIM
            const cardPengirim = findCeisaCard(/^Pengirim/i);
            const pengirimId = item.pengirimId || item.supplierId || item.shipperId || '-';
            const pengirimName = item.pengirimName || item.supplierName || item.shipperName || item.eksportirNama || '';
            const pengirimAddr = item.pengirimAddress || item.supplierAddress || item.shipperAddress || '';
            const pengirimCountry = item.pengirimCountry || item.supplierCountry || item.negaraPemasok || 'CN - CHINA';

            if (cardPengirim) {
                fillCardField(cardPengirim, ['nomorIdentitas', 'nomor', 'noIdentitas', 'identitas'], pengirimId, 'Pengirim ID');
                fillCardField(cardPengirim, ['nama', 'name'], pengirimName, 'Pengirim Nama');
                fillCardField(cardPengirim, ['alamat', 'address'], pengirimAddr, 'Pengirim Alamat');
                fillCardField(cardPengirim, ['negara', 'country'], pengirimCountry, 'Pengirim Negara');
            }

            // 2. CARD PENERIMA
            const cardPenerima = findCeisaCard(/^Penerima/i);
            const penerimaId = item.penerimaId || item.importirId || item.npwpImportir || '';
            const penerimaNitku = item.penerimaNitku || (penerimaId.replace(/\D/g, '').length === 16 ? penerimaId.replace(/\D/g, '') + '000000' : '');
            const penerimaName = item.penerimaName || item.importirName || item.consigneeName || '';
            const penerimaAddr = item.penerimaAddress || item.importirAddress || item.consigneeAddress || '';
            const penerimaCountry = item.penerimaCountry || 'ID - INDONESIA';
            const penerimaStatus = item.penerimaStatus || 'LAINNYA';
            const ijinBpNo = item.ijinBpNomor || item.noIzinBp || '';
            const ijinBpTgl = item.ijinBpTanggal || item.tglIzinBp || '';

            if (cardPenerima) {
                fillCardField(cardPenerima, ['nomorIdentitas', 'nomor', 'npwp', 'identitas'], penerimaId, 'Penerima NPWP');
                fillCardField(cardPenerima, ['nitku'], penerimaNitku, 'Penerima NITKU');
                fillCardField(cardPenerima, ['nama', 'name', 'penerima'], penerimaName, 'Penerima Nama');
                fillCardField(cardPenerima, ['alamat', 'address'], penerimaAddr, 'Penerima Alamat');
                fillCardField(cardPenerima, ['negara', 'country'], penerimaCountry, 'Penerima Negara');
                fillCardField(cardPenerima, ['status'], penerimaStatus, 'Penerima Status');
                fillCardField(cardPenerima, ['ijin', 'izin', 'noIjin', 'no_izin'], ijinBpNo, 'Ijin BP No');
                fillCardField(cardPenerima, ['tanggal', 'tgl', 'date'], ijinBpTgl, 'Ijin BP Tgl');
            }

            // 3. CARD PEMBELI
            const cardPembeli = findCeisaCard(/^Pembeli/i);
            const pembeliId = item.pembeliId || penerimaId;
            const pembeliNitku = item.pembeliNitku || penerimaNitku;
            const pembeliName = item.pembeliName || penerimaName;
            const pembeliAddr = item.pembeliAddress || penerimaAddr;
            const pembeliCountry = item.pembeliCountry || penerimaCountry;

            if (cardPembeli) {
                fillCardField(cardPembeli, ['nomorIdentitas', 'nomor', 'identitas'], pembeliId, 'Pembeli ID');
                fillCardField(cardPembeli, ['nitku'], pembeliNitku, 'Pembeli NITKU');
                fillCardField(cardPembeli, ['nama', 'name', 'pembeli'], pembeliName, 'Pembeli Nama');
                fillCardField(cardPembeli, ['alamat', 'address'], pembeliAddr, 'Pembeli Alamat');
                fillCardField(cardPembeli, ['negara', 'country'], pembeliCountry, 'Pembeli Negara');
            }

            // 4. CARD PENJUAL
            const cardPenjual = findCeisaCard(/^Penjual/i);
            const penjualId = item.penjualId || pengirimId;
            const penjualName = item.penjualName || item.sellerName || pengirimName;
            const penjualAddr = item.penjualAddress || item.sellerAddress || pengirimAddr;
            const penjualCountry = item.penjualCountry || pengirimCountry;

            if (cardPenjual) {
                fillCardField(cardPenjual, ['nomorIdentitas', 'nomor', 'identitas'], penjualId, 'Penjual ID');
                fillCardField(cardPenjual, ['nama', 'name', 'penjual'], penjualName, 'Penjual Nama');
                fillCardField(cardPenjual, ['alamat', 'address'], penjualAddr, 'Penjual Alamat');
                fillCardField(cardPenjual, ['negara', 'country'], penjualCountry, 'Penjual Negara');
            }

            // 5. CARD PEMILIK BARANG
            const cardPemilik = findCeisaCard(/^Pemilik\s*Barang/i);
            const pemilikId = item.pemilikId || item.ownerId || penerimaId;
            const pemilikNitku = item.pemilikNitku || penerimaNitku;
            const pemilikName = item.pemilikName || item.ownerName || penerimaName;
            const pemilikAddr = item.pemilikAddress || item.ownerAddress || penerimaAddr;
            const pemilikAfiliasi = item.pemilikAfiliasi || 'TAH - Tidak berhubungan';

            if (cardPemilik) {
                fillCardField(cardPemilik, ['nomorIdentitas', 'nomor', 'identitas'], pemilikId, 'Pemilik ID');
                fillCardField(cardPemilik, ['nitku'], pemilikNitku, 'Pemilik NITKU');
                fillCardField(cardPemilik, ['nama', 'name', 'pemilik'], pemilikName, 'Pemilik Nama');
                fillCardField(cardPemilik, ['alamat', 'address'], pemilikAddr, 'Pemilik Alamat');
                fillCardField(cardPemilik, ['afiliasi'], pemilikAfiliasi, 'Pemilik Afiliasi');
            }

            // 6. CARD PPJK
            const cardPpjk = findCeisaCard(/^PPJK/i);
            const ppjkId = item.ppjkId || '';
            const ppjkNitku = item.ppjkNitku || (ppjkId.replace(/\D/g, '').length === 16 ? ppjkId.replace(/\D/g, '') + '000000' : '');
            const ppjkName = item.ppjkName || '';
            const ppjkAddr = item.ppjkAddress || '';

            if (cardPpjk && ppjkName) {
                fillCardField(cardPpjk, ['nomorIdentitas', 'nomor', 'identitas'], ppjkId, 'PPJK ID');
                fillCardField(cardPpjk, ['nitku'], ppjkNitku, 'PPJK NITKU');
                fillCardField(cardPpjk, ['nama', 'name', 'ppjk'], ppjkName, 'PPJK Nama');
                fillCardField(cardPpjk, ['alamat', 'address'], ppjkAddr, 'PPJK Alamat');
            }
        }
```

---

## 4. Risk Analysis & Edge Cases

| Risk / Edge Case | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|
| **Legacy Saved Drafts (`drafts/impor/*.json`)** lacking new fields (Pembeli, Penjual, NITKU, Afiliasi, Ijin BP) | High | Medium | Provide cascading fallbacks in `loadPibDraftData`: `pembeliName` defaults to `penerimaName`, `penjualName` defaults to `pengirimName`, `pemilikAfiliasi` defaults to `'TAH - Tidak berhubungan'`, `nitku` generated from 16-digit NPWP + `'000000'` if absent. |
| **Null or `"null"` string values from AI Parser** (e.g. `blNumber: null`, `ppjkId: null`) | Medium | High | Sanitize all field assignments with `String(val ?? "").trim()`, treating `'null'` or `'undefined'` as `""`. |
| **CEISA 4.0 Label Collisions** (identical label names in all 6 cards) | High | Critical | Enforce card-scoped DOM queries using `findCeisaCard(...)` before executing keyword lookups. Never query `container` directly for entity field inputs. |
| **Tax calculation dependency** (`pibImportirStatus` used in PPh formula) | Medium | Low | Ensure `calculatePibPungutan` checks `pibPenerimaStatus` or defaults safely to `API-U` (2.5% rate) if `pibImportirStatus` is omitted. |
| **Validation lock in `submitPibCustoms`** checking `data.importirName` | High | High | `collectPibFormData` must output dual keys (`penerimaName` and `importirName`) to pass the existing validation checks seamlessly. |
| **NITKU Sync with non-16 digit numbers** (e.g. NIK 16 digit vs NPWP 15 digit vs Lainnya '-') | Low | Medium | Only auto-pad with `'000000'` if raw digits equal exactly 16; otherwise preserve user input as-is without corrupting it. |

---

## 5. Caveats

- **No Caveats**: All relevant files (`pib_dashboard.js`, `pib.html`, `content.js`, `popup.js`, `backend-service/document_parser.js`, `peb_dashboard.js`) and visual reference screenshots have been directly inspected. No live source code modifications were performed during this exploration turn.

---

## 6. Conclusion

1. The entity card structure in PIB is currently outdated and misaligned with CEISA 4.0. Upgrading it to the 6-card symmetric 2-column layout (Pengirim, Pembeli, Pemilik Barang on the left; Penerima, Penjual, PPJK on the right) matches CEISA 4.0 and mirrors the existing clean pattern in `peb.html`.
2. `collectPibFormData` and `loadPibDraftData` (the real populate function) must be updated with the 6-card schema while retaining legacy aliases for 100% backward compatibility.
3. The copy buttons (`btnSalinPenerima`, `btnHapusPembeli`, `btnSalinPengirim`, `btnSalinPemilik`, `btnSyncNitkuPpjk`) need active event listeners dispatching synthetic events to ensure instant auto-saving.
4. Auto-input in `content.js` must transition from global container searching to card-scoped searching to prevent catastrophic input target collisions across the 6 entity cards in CEISA 4.0.

---

## 7. Verification Method

To independently verify these conclusions:
1. **DOM Structure & ID Verification**:
   Inspect `pib.html` lines 457–623 and compare with the proposed IDs in Section 3.1.
2. **Data Roundtrip Test**:
   ```powershell
   node -e "const d = JSON.parse(require('fs').readFileSync('./drafts/impor/PIB_Draft_010700-569612-20261109-721496.json')); console.log('Importir:', d.importirName, 'Shipper:', d.supplierName);"
   ```
3. **Auto-Input Selector Test in CEISA Console**:
   In any CEISA 4.0 tab or mock DOM, execute:
   ```javascript
   const card = Array.from(document.querySelectorAll('.ant-card, .ceisa-form-card')).find(c => /penerima/i.test(c.innerText));
   console.log('Target Penerima Card Found:', !!card);
   ```
   Invalidation condition: If CEISA 4.0 changes its card headers so that card titles are absent from DOM text content, card detection heuristics would need fallback to positional column indexing.
