/**
 * ============================================================
 * CEISA 4.0 AUTOMATION - GOOGLE APPS SCRIPT BACKEND
 * ============================================================
 * Skrip ini bertindak sebagai REST API sinkronisasi data antar PC
 * dan mengelola database Google Spreadsheet secara rapi, elegan,
 * serta mudah dibaca oleh manusia:
 * - Tab Per Bulan (misal: '2026-10') dengan rincian harian
 * - Tab Master 'Rekap Master' untuk rekapitulasi semua data
 * - Teks bersih nomor dokumen (tanpa format JSON di dalam sel)
 * - Tab 'ScanCache' untuk riwayat scan dokumen
 *
 * CARA UPDATE/DEPLOY DI GOOGLE APPS SCRIPT:
 * 1. Buka Google Spreadsheet Anda.
 * 2. Klik menu 'Ekstensi' (Extensions) -> 'Apps Script'.
 * 3. Hapus seluruh isi kode lama dan tempel (paste) kode ini.
 * 4. Klik ikon Simpan (Save).
 * 5. Klik 'Terapkan' (Deploy) -> 'Kelola penerapan' (Manage deployments).
 * 6. Klik ikon pensil (Edit) pada penerapan aktif.
 * 7. Pilih Versi: 'Versi baru' (New version).
 * 8. Klik 'Terapkan' (Deploy).
 * ============================================================
 */

const SHEET_MASTER = "Rekap Master";
const SHEET_SCAN_CACHE = "ScanCache";

// Tema Warna Profesional (Deep Slate & Neutral)
const THEME = {
  HEADER_BG: "#1e293b",       // Slate gelap
  HEADER_TEXT: "#ffffff",     // Putih
  BANNER_BG: "#0f172a",       // Midnight slate
  BANNER_TEXT: "#ffffff",
  STATS_BG: "#334155",        // Slate medium
  STATS_TEXT: "#f8fafc",
  ROW_ALT_BG: "#f8fafc",      // Putih keabuan lembut
  BORDER_COLOR: "#cbd5e1"     // Abu-abu border halus
};

/**
 * Menu khusus saat membuka Google Spreadsheet
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("CEISA Automation")
    .addItem("Rapikan Format Spreadsheet Sekarang", "tidyAndReformatAllSheets")
    .addToUi();
}

/**
 * Trigger otomatis saat pengguna mengedit Spreadsheet secara manual:
 * Memperbarui hitungan jumlah dokumen dan kolom 'Terakhir Diperbarui' secara instan.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  try {
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();
    const col = e.range.getColumn();

    // 1. Rekap Master
    if (sheetName === SHEET_MASTER && row > 1) {
      // Kolom 8: Daftar Hijau, Kolom 9: Daftar PIB/PEB
      if (col === 8 || col === 9) {
        const compVal = sheet.getRange(row, 8).getValue();
        const pibVal = sheet.getRange(row, 9).getValue();
        const compNums = parseNumbersFromSheet(compVal);
        const pibNums = parseNumbersFromSheet(pibVal);

        sheet.getRange(row, 5).setValue(compNums.length); // Jml Hijau
        sheet.getRange(row, 6).setValue(pibNums.length);  // Jml PIB/PEB
        sheet.getRange(row, 7).setValue(compNums.length + pibNums.length); // Total
        sheet.getRange(row, 10).setValue(formatHumanDateTime(new Date())); // Terakhir Diperbarui
      }
    }

    // 2. Tab Bulanan (misal: '2026-10')
    const monthPattern = /^\d{4}-\d{2}$/;
    if (monthPattern.test(sheetName) && row >= 4) {
      // Kolom 7: Daftar Hijau, Kolom 8: Daftar PIB/PEB
      if (col === 7 || col === 8) {
        const compVal = sheet.getRange(row, 7).getValue();
        const pibVal = sheet.getRange(row, 8).getValue();
        const compNums = parseNumbersFromSheet(compVal);
        const pibNums = parseNumbersFromSheet(pibVal);

        sheet.getRange(row, 4).setValue(compNums.length); // Jml Hijau
        sheet.getRange(row, 5).setValue(pibNums.length);  // Jml PIB/PEB
        sheet.getRange(row, 6).setValue(compNums.length + pibNums.length); // Total
        sheet.getRange(row, 9).setValue(formatHumanDateTime(new Date())); // Terakhir Diperbarui
        reorderAndRefreshMonthlySheet(sheet, sheetName);
      }
    }
  } catch (err) {
    console.error("Error in onEdit:", err);
  }
}

/**
 * Inisialisasi atau ambil Sheet Rekap Master
 */
function getMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_MASTER);
  if (!sheet) {
    // Periksa apakah ada sheet lama bernama SyncState
    const legacySheet = ss.getSheetByName("SyncState");
    if (legacySheet) {
      legacySheet.setName(SHEET_MASTER);
      sheet = legacySheet;
    } else {
      sheet = ss.insertSheet(SHEET_MASTER, 0);
    }
  }
  ensureMasterHeaders(sheet);
  return sheet;
}

/**
 * Inisialisasi atau ambil Sheet Per Bulan (format nama: YYYY-MM)
 */
function getMonthlySheet(monthKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(monthKey);
  if (!sheet) {
    sheet = ss.insertSheet(monthKey);
    initMonthlyLayout(sheet, monthKey);
  }
  return sheet;
}

/**
 * Inisialisasi atau ambil Sheet ScanCache
 */
function getScanCacheSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SCAN_CACHE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SCAN_CACHE);
  }
  ensureScanCacheHeaders(sheet);
  return sheet;
}

/**
 * Setup Header untuk Rekap Master
 */
function ensureMasterHeaders(sheet) {
  const headers = [
    "No",
    "Bulan",
    "Tanggal",
    "Hari",
    "Jml Hijau",
    "Jml PIB/PEB",
    "Total Dokumen",
    "Daftar Nomor Selesai (Hijau)",
    "Daftar Nomor PIB/PEB",
    "Terakhir Diperbarui"
  ];

  const currentValues = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const isMatch = headers.every((h, idx) => currentValues[idx] === h);

  if (!isMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange
      .setFontWeight("bold")
      .setBackground(THEME.HEADER_BG)
      .setFontColor(THEME.HEADER_TEXT)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);
  }
}

/**
 * Setup Tata Letak Awal untuk Sheet Bulanan
 */
function initMonthlyLayout(sheet, monthKey) {
  sheet.clear();

  // Baris 1: Judul Banner Bulan
  sheet.getRange(1, 1, 1, 9).merge();
  const banner = sheet.getRange(1, 1);
  banner
    .setValue("REKAPITULASI DOKUMEN CEISA - BULAN " + monthKey)
    .setFontWeight("bold")
    .setFontSize(12)
    .setBackground(THEME.BANNER_BG)
    .setFontColor(THEME.BANNER_TEXT)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);

  // Baris 2: Ringkasan Kartu Statistik
  sheet.getRange(2, 1, 1, 9).merge();
  const stats = sheet.getRange(2, 1);
  stats
    .setValue("Total Selesai (Hijau): 0  |  Total PIB/PEB: 0  |  Total Dokumen: 0  |  Hari Aktif: 0")
    .setFontWeight("bold")
    .setBackground(THEME.STATS_BG)
    .setFontColor(THEME.STATS_TEXT)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(2, 30);

  // Baris 3: Header Kolom
  const headers = [
    "No",
    "Tanggal",
    "Hari",
    "Jml Hijau",
    "Jml PIB/PEB",
    "Total Dokumen",
    "Daftar Nomor Selesai (Hijau)",
    "Daftar Nomor PIB/PEB",
    "Terakhir Diperbarui"
  ];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange(3, 1, 1, headers.length);
  headerRange
    .setFontWeight("bold")
    .setBackground(THEME.HEADER_BG)
    .setFontColor(THEME.HEADER_TEXT)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(3, 32);

  sheet.setFrozenRows(3);

  // Atur Lebar Kolom
  sheet.setColumnWidth(1, 50);   // No
  sheet.setColumnWidth(2, 110);  // Tanggal
  sheet.setColumnWidth(3, 85);   // Hari
  sheet.setColumnWidth(4, 90);   // Jml Hijau
  sheet.setColumnWidth(5, 95);   // Jml PIB/PEB
  sheet.setColumnWidth(6, 105);  // Total
  sheet.setColumnWidth(7, 340);  // Daftar Hijau
  sheet.setColumnWidth(8, 280);  // Daftar PIB/PEB
  sheet.setColumnWidth(9, 160);  // Terakhir Diperbarui
}

/**
 * Setup Header untuk ScanCache
 */
function ensureScanCacheHeaders(sheet) {
  const headers = [
    "No Pendaftaran",
    "No Dokumen",
    "Jenis",
    "Perusahaan",
    "Lokasi",
    "Status",
    "Tanggal Dokumen",
    "Waktu Scan",
    "Data Mentah",
    "Terakhir Diperbarui"
  ];

  const currentValues = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const isMatch = headers.every((h, idx) => currentValues[idx] === h);

  if (!isMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange
      .setFontWeight("bold")
      .setBackground(THEME.HEADER_BG)
      .setFontColor(THEME.HEADER_TEXT)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);

    sheet.setColumnWidth(1, 115); // No Pendaftaran
    sheet.setColumnWidth(2, 115); // No Dokumen
    sheet.setColumnWidth(3, 75);  // Jenis
    sheet.setColumnWidth(4, 230); // Perusahaan
    sheet.setColumnWidth(5, 130); // Lokasi
    sheet.setColumnWidth(6, 100); // Status
    sheet.setColumnWidth(7, 120); // Tanggal Dokumen
    sheet.setColumnWidth(8, 160); // Waktu Scan
    sheet.setColumnWidth(9, 120); // Data Mentah
    sheet.setColumnWidth(10, 160); // Terakhir Diperbarui
  }
}

/**
 * Handle GET requests (Sinkronisasi dari Spreadsheet ke Chrome Extension)
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "sync";

  if (action === "ping") {
    return jsonResponse({
      status: "ok",
      app: "CEISA_GOOGLE_SHEETS_SYNC",
      time: new Date().toISOString()
    });
  }

  if (action === "sync" || action === "pull") {
    const since = (e && e.parameter && e.parameter.since) ? e.parameter.since : null;
    const sinceTime = since ? new Date(since).getTime() : 0;

    // 1. Ambil data dari Rekap Master
    const masterSheet = getMasterSheet();
    const stateData = masterSheet.getDataRange().getValues();
    const syncStateList = [];

    if (stateData.length > 1) {
      const headers = stateData[0].map(h => String(h).trim().toLowerCase());
      
      // Deteksi dinamis indeks kolom
      let colDate = headers.indexOf("tanggal");
      if (colDate === -1) colDate = headers.indexOf("date");
      if (colDate === -1) colDate = 2; // Default struktur baru

      let colComp = headers.indexOf("daftar nomor selesai (hijau)");
      if (colComp === -1) colComp = headers.indexOf("completed_numbers");
      if (colComp === -1) colComp = 7;

      let colPib = headers.indexOf("daftar nomor pib/peb");
      if (colPib === -1) colPib = headers.indexOf("pibpeb_numbers");
      if (colPib === -1) colPib = 8;

      let colUpdated = headers.indexOf("terakhir diperbarui");
      if (colUpdated === -1) colUpdated = headers.indexOf("updated_at");
      if (colUpdated === -1) colUpdated = 9;

      const dateMap = {};
      for (let i = 1; i < stateData.length; i++) {
        const row = stateData[i];
        const dateStr = row[colDate] ? formatSheetDate(row[colDate]) : "";
        if (!dateStr) continue;

        const updatedAtVal = row[colUpdated];
        const updatedAtIso = parseToIsoString(updatedAtVal);
        const rowTime = updatedAtIso ? new Date(updatedAtIso).getTime() : 0;
        const compNums = parseNumbersFromSheet(row[colComp]);
        const pibNums = parseNumbersFromSheet(row[colPib]);

        // Simpan baris paling mutakhir untuk setiap tanggal (anti-stale & anti-duplikat)
        if (dateMap[dateStr]) {
          const prev = dateMap[dateStr];
          if (rowTime > prev._time || (rowTime === prev._time && compNums.length >= prev.completed_numbers.length)) {
            dateMap[dateStr] = {
              date: dateStr,
              completed_numbers: compNums,
              pibpeb_numbers: pibNums,
              updated_at: updatedAtIso || new Date().toISOString(),
              _time: rowTime
            };
          }
        } else {
          dateMap[dateStr] = {
            date: dateStr,
            completed_numbers: compNums,
            pibpeb_numbers: pibNums,
            updated_at: updatedAtIso || new Date().toISOString(),
            _time: rowTime
          };
        }
      }

      for (const d in dateMap) {
        delete dateMap[d]._time;
        syncStateList.push(dateMap[d]);
      }
    }

    // 2. Ambil data ScanCache (maksimal 250 item terbaru)
    const cacheSheet = getScanCacheSheet();
    const cacheData = cacheSheet.getDataRange().getValues();
    const scanCacheList = [];

    if (cacheData.length > 1) {
      for (let i = cacheData.length - 1; i >= 1; i--) {
        const row = cacheData[i];
        const regNo = row[0] ? String(row[0]).replace(/^'/, "").trim() : "";
        if (!regNo) continue;

        const updatedAtVal = row[9];
        const updatedAtIso = parseToIsoString(updatedAtVal);
        const rowTime = updatedAtIso ? new Date(updatedAtIso).getTime() : 0;

        if (!sinceTime || rowTime > sinceTime) {
          const rawObj = parseJsonObjectSafe(row[8]);
          const timeNum = parseNumericTimestamp(row[7]);

          scanCacheList.push({
            registration_number: regNo,
            document_number: row[1] ? String(row[1]).replace(/^'/, "").trim() : "",
            document_type: row[2] ? String(row[2]).trim() : "",
            company_name: row[3] ? String(row[3]).trim() : "",
            location: row[4] ? String(row[4]).trim() : "",
            status: row[5] ? String(row[5]).trim() : "",
            row_date: row[6] ? formatSheetDate(row[6]) : "",
            timestamp: timeNum,
            raw_data: rawObj,
            updated_at: updatedAtIso || new Date().toISOString()
          });
          if (scanCacheList.length >= 250) break;
        }
      }
    }

    // 3. Ambil data versi terbaru dari Script Properties (Broadcast Auto-Update)
    let latestUpdateInfo = null;
    try {
      const updateInfoStr = PropertiesService.getScriptProperties().getProperty("LATEST_UPDATE_INFO");
      if (updateInfoStr) {
        latestUpdateInfo = JSON.parse(updateInfoStr);
      }
    } catch (_) {}

    return jsonResponse({
      success: true,
      sync_state: syncStateList,
      scan_cache: scanCacheList,
      latest_update: latestUpdateInfo,
      server_time: new Date().toISOString()
    });
  }

  return jsonResponse({ error: "Invalid action" });
}

/**
 * Handle POST requests (Simpan nomor dokumen & cache dari Chrome Extension)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    try {
      hasLock = lock.tryLock(5000);
    } catch (_) {
      hasLock = false;
    }

    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;

    // 1. Simpan State Nomor (Selesai & PIB/PEB per tanggal)
    if (action === "push_state") {
      const date = String(payload.date || "").trim();
      if (!date) return jsonResponse({ success: false, error: "Date is required" });

      const completed = Array.isArray(payload.completed_numbers) ? payload.completed_numbers : [];
      const pibpeb = Array.isArray(payload.pibpeb_numbers) ? payload.pibpeb_numbers : [];
      const now = new Date();

      // Perbarui Rekap Master & Tab Bulanan
      upsertMasterRow(date, completed, pibpeb, now);
      upsertMonthlyRow(date, completed, pibpeb, now);

      return jsonResponse({
        success: true,
        date: date,
        updated_at: now.toISOString()
      });
    }

    // 2. Simpan Cache Scan Tunggal
    if (action === "push_cache_single") {
      const item = payload.item;
      if (!item || !item.registration_number) {
        return jsonResponse({ success: false, error: "registration_number is required" });
      }

      upsertScanCacheRow(item);
      return jsonResponse({ success: true });
    }

    // 3. Simpan Cache Scan Batch
    if (action === "push_cache_batch") {
      const items = Array.isArray(payload.items) ? payload.items : [];
      for (let i = 0; i < items.length; i++) {
        upsertScanCacheRow(items[i]);
      }
      return jsonResponse({ success: true, count: items.length });
    }

    // 4. Bersihkan Cache Scan
    if (action === "clear_cache") {
      const sheet = getScanCacheSheet();
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return jsonResponse({ success: true, cleared: true });
    }

    // 5. Publikasi Update (Push Update dari Developer)
    if (action === "publish_update") {
      const commit = String(payload.commit || "").trim();
      const version = String(payload.version || "2.1.0").trim();
      const message = String(payload.message || "Pembaruan otomatis sistem").trim();
      const branch = String(payload.branch || "SupabaseV2").trim();
      const timestamp = new Date().toISOString();

      const updatePayload = {
        commit: commit,
        version: version,
        branch: branch,
        message: message,
        timestamp: timestamp
      };

      PropertiesService.getScriptProperties().setProperty("LATEST_UPDATE_INFO", JSON.stringify(updatePayload));

      return jsonResponse({
        success: true,
        message: "Update berhasil dipublikasikan ke seluruh komputer pengguna!",
        latest_update: updatePayload
      });
    }

    return jsonResponse({ error: "Unknown action" });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

/**
 * Upsert 1 baris di Rekap Master
 */
function upsertMasterRow(date, completed, pibpeb, now) {
  const sheet = getMasterSheet();
  const data = sheet.getDataRange().getValues();
  const dateFormatted = formatSheetDate(date);
  const monthKey = getMonthKey(dateFormatted);
  const dayName = getIndonesianDayName(dateFormatted);

  const cleanCompletedStr = formatNumbersForSheet(completed);
  const cleanPibpebStr = formatNumbersForSheet(pibpeb);
  const compCount = Array.isArray(completed) ? completed.length : 0;
  const pibCount = Array.isArray(pibpeb) ? pibpeb.length : 0;
  const totalCount = compCount + pibCount;
  const humanTime = formatHumanDateTime(now);

  let colDate = 2;
  if (data.length > 0) {
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idx = headers.indexOf("tanggal");
    if (idx !== -1) colDate = idx;
    else {
      const idx2 = headers.indexOf("date");
      if (idx2 !== -1) colDate = idx2;
    }
  }

  let targetRow = -1;
  const duplicateRows = [];
  for (let i = 1; i < data.length; i++) {
    if (formatSheetDate(data[i][colDate]) === dateFormatted) {
      if (targetRow === -1) {
        targetRow = i + 1;
      } else {
        duplicateRows.push(i + 1);
      }
    }
  }

  // Hapus baris duplikat lama dari bawah ke atas agar indeks tidak bergeser
  for (let d = duplicateRows.length - 1; d >= 0; d--) {
    sheet.deleteRow(duplicateRows[d]);
  }

  const rowValues = [
    targetRow > 0 ? data[targetRow - 1][0] : data.length, // No
    "'" + monthKey,
    "'" + dateFormatted,
    dayName,
    compCount,
    pibCount,
    totalCount,
    cleanCompletedStr ? ("'" + cleanCompletedStr) : "",
    cleanPibpebStr ? ("'" + cleanPibpebStr) : "",
    humanTime
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    applyMasterRowStyle(sheet, targetRow);
  } else {
    sheet.appendRow(rowValues);
    const newLastRow = sheet.getLastRow();
    applyMasterRowStyle(sheet, newLastRow);
  }

  reorderAndRenumberMaster(sheet);
}

/**
 * Upsert 1 baris di Tab Bulanan (misal: '2026-10')
 */
function upsertMonthlyRow(date, completed, pibpeb, now) {
  const dateFormatted = formatSheetDate(date);
  const monthKey = getMonthKey(dateFormatted);
  if (!monthKey) return;

  const sheet = getMonthlySheet(monthKey);
  const data = sheet.getDataRange().getValues();
  const dayName = getIndonesianDayName(dateFormatted);

  const cleanCompletedStr = formatNumbersForSheet(completed);
  const cleanPibpebStr = formatNumbersForSheet(pibpeb);
  const compCount = Array.isArray(completed) ? completed.length : 0;
  const pibCount = Array.isArray(pibpeb) ? pibpeb.length : 0;
  const totalCount = compCount + pibCount;
  const humanTime = formatHumanDateTime(now);

  let colDate = 1;
  if (data.length > 2) {
    const headers = data[2].map(h => String(h).trim().toLowerCase());
    const idx = headers.indexOf("tanggal");
    if (idx !== -1) colDate = idx;
    else {
      const idx2 = headers.indexOf("date");
      if (idx2 !== -1) colDate = idx2;
    }
  }

  let targetRow = -1;
  const duplicateRows = [];
  // Baris data bulanan dimulai dari baris 4 (baris 1: judul banner, baris 2: stats, baris 3: headers)
  for (let i = 3; i < data.length; i++) {
    if (formatSheetDate(data[i][colDate]) === dateFormatted) {
      if (targetRow === -1) {
        targetRow = i + 1;
      } else {
        duplicateRows.push(i + 1);
      }
    }
  }

  // Hapus baris duplikat lama dari bawah ke atas
  for (let d = duplicateRows.length - 1; d >= 0; d--) {
    sheet.deleteRow(duplicateRows[d]);
  }

  const rowValues = [
    targetRow > 0 ? data[targetRow - 1][0] : (data.length - 2), // No
    "'" + dateFormatted,
    dayName,
    compCount,
    pibCount,
    totalCount,
    cleanCompletedStr ? ("'" + cleanCompletedStr) : "",
    cleanPibpebStr ? ("'" + cleanPibpebStr) : "",
    humanTime
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    applyMonthlyRowStyle(sheet, targetRow);
  } else {
    sheet.appendRow(rowValues);
    const newLastRow = sheet.getLastRow();
    applyMonthlyRowStyle(sheet, newLastRow);
  }

  reorderAndRefreshMonthlySheet(sheet, monthKey);
}

/**
 * Styling selisih baris Rekap Master
 */
function applyMasterRowStyle(sheet, rowIdx) {
  const range = sheet.getRange(rowIdx, 1, 1, 10);
  range.setVerticalAlignment("middle");

  // Kolom No, Bulan, Tanggal, Hari, Jumlah, Total, Terakhir Update di-center
  sheet.getRange(rowIdx, 1, 1, 7).setHorizontalAlignment("center");
  sheet.getRange(rowIdx, 10).setHorizontalAlignment("center");

  // Kolom Daftar Nomor diset Left + Wrap Text
  const compRange = sheet.getRange(rowIdx, 8);
  compRange.setWrap(true).setHorizontalAlignment("left");

  const pibRange = sheet.getRange(rowIdx, 9);
  pibRange.setWrap(true).setHorizontalAlignment("left");
}

/**
 * Styling baris di Tab Bulanan
 */
function applyMonthlyRowStyle(sheet, rowIdx) {
  const range = sheet.getRange(rowIdx, 1, 1, 9);
  range.setVerticalAlignment("middle");

  sheet.getRange(rowIdx, 1, 1, 6).setHorizontalAlignment("center");
  sheet.getRange(rowIdx, 9).setHorizontalAlignment("center");

  const compRange = sheet.getRange(rowIdx, 7);
  compRange.setWrap(true).setHorizontalAlignment("left");

  const pibRange = sheet.getRange(rowIdx, 8);
  pibRange.setWrap(true).setHorizontalAlignment("left");
}

/**
 * Urutkan dan Perbarui Rekap Master (Hari terbaru di paling atas)
 */
function reorderAndRenumberMaster(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;

  const dataRange = sheet.getRange(2, 1, lastRow - 1, 10);
  // Sort berdasarkan kolom Tanggal (kolom 3) Descending
  dataRange.sort({ column: 3, ascending: false });

  // Update nomor urut (1, 2, 3...)
  const numRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const nums = [];
  for (let i = 1; i <= lastRow - 1; i++) {
    nums.push([i]);
  }
  numRange.setValues(nums);

  // Atur lebar kolom Rekap Master agar pas & rapi
  sheet.setColumnWidth(1, 50);   // No
  sheet.setColumnWidth(2, 90);   // Bulan
  sheet.setColumnWidth(3, 110);  // Tanggal
  sheet.setColumnWidth(4, 85);   // Hari
  sheet.setColumnWidth(5, 90);   // Jml Hijau
  sheet.setColumnWidth(6, 95);   // Jml PIB/PEB
  sheet.setColumnWidth(7, 105);  // Total
  sheet.setColumnWidth(8, 340);  // Daftar Hijau
  sheet.setColumnWidth(9, 280);  // Daftar PIB/PEB
  sheet.setColumnWidth(10, 160); // Terakhir Diperbarui
}

/**
 * Urutkan hari (Ascending dari tgl 1 - 31) dan hitung total di tab Bulanan
 */
function reorderAndRefreshMonthlySheet(sheet, monthKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return;

  const rowCount = lastRow - 3;
  const dataRange = sheet.getRange(4, 1, rowCount, 9);
  // Sort berdasarkan Tanggal (kolom 2) Ascending agar berurutan tanggal 1, 2, dst
  dataRange.sort({ column: 2, ascending: true });

  // Renumber No
  const numRange = sheet.getRange(4, 1, rowCount, 1);
  const nums = [];
  for (let i = 1; i <= rowCount; i++) {
    nums.push([i]);
  }
  numRange.setValues(nums);

  // Hitung akumulasi statistik bulan ini
  const values = sheet.getRange(4, 4, rowCount, 3).getValues();
  let sumHijau = 0;
  let sumPibpeb = 0;
  let sumTotal = 0;

  for (let i = 0; i < values.length; i++) {
    sumHijau += Number(values[i][0]) || 0;
    sumPibpeb += Number(values[i][1]) || 0;
    sumTotal += Number(values[i][2]) || 0;
  }

  // Update kartu ringkasan di Baris 2
  const statsText = `Total Selesai (Hijau): ${sumHijau}  |  Total PIB/PEB: ${sumPibpeb}  |  Total Dokumen: ${sumTotal}  |  Hari Aktif: ${rowCount}`;
  sheet.getRange(2, 1).setValue(statsText);
}

/**
 * Upsert 1 baris di sheet ScanCache
 */
function upsertScanCacheRow(item) {
  if (!item || !item.registration_number) return;
  const regNo = String(item.registration_number).trim();
  const sheet = getScanCacheSheet();
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    const existingReg = String(data[i][0]).replace(/^'/, "").trim();
    if (existingReg === regNo) {
      foundRow = i + 1;
      break;
    }
  }

  const now = new Date();
  const scanTimeFormatted = item.timestamp ? formatHumanDateTime(item.timestamp) : formatHumanDateTime(now);
  const humanUpdatedTime = formatHumanDateTime(now);

  const rowValues = [
    "'" + regNo,
    item.document_number ? ("'" + item.document_number) : "",
    item.document_type || "",
    item.company_name || "",
    item.location || "",
    item.status || "",
    item.row_date ? formatSheetDate(item.row_date) : "",
    scanTimeFormatted,
    JSON.stringify(item.raw_data || {}),
    humanUpdatedTime
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

/**
 * FUNGSI UTAMA: Rapikan & Ubah Format Seluruh Spreadsheet
 * Dapat dijalankan kapan saja dari menu Google Sheets:
 * "CEISA Automation" -> "Rapikan Format Spreadsheet Sekarang"
 */
function tidyAndReformatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Periksa sheet lama 'SyncState' jika ada
  let masterSheet = ss.getSheetByName(SHEET_MASTER);
  const legacySheet = ss.getSheetByName("SyncState");
  if (!masterSheet && legacySheet) {
    legacySheet.setName(SHEET_MASTER);
    masterSheet = legacySheet;
  } else if (!masterSheet) {
    masterSheet = ss.insertSheet(SHEET_MASTER, 0);
  }

  const masterData = masterSheet.getDataRange().getValues();
  const cleanedDailyMap = {};

  if (masterData.length > 1) {
    const headers = masterData[0].map(h => String(h).trim().toLowerCase());
    
    // Deteksi dinamis kolom berdasarkan header
    const isLegacyFourCols = headers.length <= 4 || (headers.includes("date") && !headers.includes("bulan"));
    let colDate = headers.indexOf("tanggal");
    if (colDate === -1) colDate = headers.indexOf("date");
    if (colDate === -1) colDate = isLegacyFourCols ? 0 : 2;

    let colComp = headers.indexOf("daftar nomor selesai (hijau)");
    if (colComp === -1) colComp = headers.indexOf("completed_numbers");
    if (colComp === -1) colComp = isLegacyFourCols ? 1 : 7;

    let colPib = headers.indexOf("daftar nomor pib/peb");
    if (colPib === -1) colPib = headers.indexOf("pibpeb_numbers");
    if (colPib === -1) colPib = isLegacyFourCols ? 2 : 8;

    let colUpdated = headers.indexOf("terakhir diperbarui");
    if (colUpdated === -1) colUpdated = headers.indexOf("updated_at");
    if (colUpdated === -1) colUpdated = isLegacyFourCols ? 3 : 9;

    for (let i = 1; i < masterData.length; i++) {
      const row = masterData[i];
      const dateVal = (colDate !== -1 && colDate < row.length) ? row[colDate] : "";
      const compVal = (colComp !== -1 && colComp < row.length) ? row[colComp] : "";
      const pibVal = (colPib !== -1 && colPib < row.length) ? row[colPib] : "";
      const updateVal = (colUpdated !== -1 && colUpdated < row.length) ? row[colUpdated] : "";

      const dateStr = formatSheetDate(dateVal);
      if (!dateStr) continue;

      const completedArr = parseNumbersFromSheet(compVal);
      const pibpebArr = parseNumbersFromSheet(pibVal);
      const updateDate = updateVal ? new Date(updateVal) : new Date();

      cleanedDailyMap[dateStr] = {
        date: dateStr,
        completed: completedArr,
        pibpeb: pibpebArr,
        updated: isNaN(updateDate.getTime()) ? new Date() : updateDate
      };
    }
  }

  // Tulis ulang Rekap Master dengan format bersih
  masterSheet.clear();
  ensureMasterHeaders(masterSheet);

  const sortedDates = Object.keys(cleanedDailyMap).sort().reverse();
  const masterRows = [];

  for (let idx = 0; idx < sortedDates.length; idx++) {
    const dStr = sortedDates[idx];
    const item = cleanedDailyMap[dStr];
    const monthKey = getMonthKey(dStr);
    const dayName = getIndonesianDayName(dStr);
    const compStr = formatNumbersForSheet(item.completed);
    const pibStr = formatNumbersForSheet(item.pibpeb);
    const cCount = item.completed.length;
    const pCount = item.pibpeb.length;

    masterRows.push([
      idx + 1,
      "'" + monthKey,
      "'" + dStr,
      dayName,
      cCount,
      pCount,
      cCount + pCount,
      compStr,
      pibStr,
      formatHumanDateTime(item.updated)
    ]);
  }

  if (masterRows.length > 0) {
    masterSheet.getRange(2, 1, masterRows.length, 10).setValues(masterRows);
    for (let r = 2; r <= masterRows.length + 1; r++) {
      applyMasterRowStyle(masterSheet, r);
    }
  }
  reorderAndRenumberMaster(masterSheet);

  // 2. Buat dan Perbarui Tab Bulanan untuk setiap Bulan
  const monthsFound = {};
  for (const dStr of Object.keys(cleanedDailyMap)) {
    const m = getMonthKey(dStr);
    if (m) {
      if (!monthsFound[m]) monthsFound[m] = [];
      monthsFound[m].push(cleanedDailyMap[dStr]);
    }
  }

  for (const [mKey, daysList] of Object.entries(monthsFound)) {
    let mSheet = ss.getSheetByName(mKey);
    if (!mSheet) {
      mSheet = ss.insertSheet(mKey);
    }
    initMonthlyLayout(mSheet, mKey);

    daysList.sort((a, b) => a.date.localeCompare(b.date));
    const mRows = [];

    for (let i = 0; i < daysList.length; i++) {
      const item = daysList[i];
      const dayName = getIndonesianDayName(item.date);
      const compStr = formatNumbersForSheet(item.completed);
      const pibStr = formatNumbersForSheet(item.pibpeb);
      const cCount = item.completed.length;
      const pCount = item.pibpeb.length;

      mRows.push([
        i + 1,
        "'" + item.date,
        dayName,
        cCount,
        pCount,
        cCount + pCount,
        compStr,
        pibStr,
        formatHumanDateTime(item.updated)
      ]);
    }

    if (mRows.length > 0) {
      mSheet.getRange(4, 1, mRows.length, 9).setValues(mRows);
      for (let r = 4; r <= mRows.length + 3; r++) {
        applyMonthlyRowStyle(mSheet, r);
      }
    }
    reorderAndRefreshMonthlySheet(mSheet, mKey);
  }

  // 3. Rapikan ScanCache
  const scanSheet = getScanCacheSheet();
  ensureScanCacheHeaders(scanSheet);

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Format spreadsheet berhasil dirapikan per bulan dan per hari!",
      "Sukses",
      5
    );
  } catch (_) {}
}

// ============================================================
// FUNGSI BANTUAN FORMATTING & PARSING
// ============================================================

/**
 * Format array nomor ke string bersih dipisah koma (tanpa tanda kutip/kurung JSON)
 */
function formatNumbersForSheet(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return "";
  const cleaned = arr.map(n => String(n).trim()).filter(Boolean);
  return cleaned.join(", ");
}

/**
 * Validasi apakah teks merupakan nomor dokumen yang sah (bukan string Date/GMT)
 */
function isValidDocNumber(str) {
  if (!str) return false;
  const s = String(str).trim();
  if (s.length === 0) return false;
  if (s.startsWith("[") || s.startsWith("]") || s.startsWith("{") || s.startsWith("}")) return false;
  if (s.includes("GMT") || s.includes("Time") || s.includes("Waktu") || s.includes("00:00:00") ||
      s.includes("Mon ") || s.includes("Tue ") || s.includes("Wed ") || s.includes("Thu ") ||
      s.includes("Fri ") || s.includes("Sat ") || s.includes("Sun ")) {
    return false;
  }
  return /^[A-Za-z0-9\/\-\.]{3,30}$/.test(s) && /\d/.test(s);
}

/**
 * Parse string sel (bisa format koma, baris baru, atau JSON lama) kembali ke Array
 */
function parseNumbersFromSheet(val) {
  if (!val) return [];
  if (val instanceof Date) return [];
  if (Array.isArray(val)) return val.map(n => String(n).trim()).filter(isValidDocNumber);
  const str = String(val).trim();
  if (!str) return [];
  if (str.includes("GMT") || str.includes("Time") || str.includes("Waktu") || str.includes("00:00:00")) {
    return [];
  }

  // Jika format JSON lama: ["081049", "081052"]
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(n => String(n).trim())
          .map(s => /^\d{1,5}$/.test(s) ? s.padStart(6, "0") : s)
          .filter(isValidDocNumber);
      }
    } catch (_) {}
  }

  // Jika format baru: teks dipisah koma atau baris baru
  return str.split(/[\r\n,]+/)
    .map(s => s.trim().replace(/^['"]|['"]$/g, ""))
    .map(s => /^\d{1,5}$/.test(s) ? s.padStart(6, "0") : s)
    .filter(isValidDocNumber);
}

/**
 * Helper format date ke YYYY-MM-DD
 */
function formatSheetDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const day = String(val.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const str = String(val).replace(/^'/, "").trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return str;
}

/**
 * Ambil Nama Hari Bahasa Indonesia
 */
function getIndonesianDayName(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[d.getDay()];
}

/**
 * Ambil Kunci Bulan YYYY-MM
 */
function getMonthKey(dateStr) {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4}-\d{2})/);
  return match ? match[1] : "";
}

/**
 * Format Tanggal & Jam Manusiawi: DD/MM/YYYY HH:mm:ss
 */
function formatHumanDateTime(val) {
  if (!val) return "";
  let d;
  if (typeof val === "number") {
    d = new Date(val);
  } else if (val instanceof Date) {
    d = val;
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return String(val);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  const secs = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
}

/**
 * Parse berbagai format tanggal/waktu sel ke ISO string
 */
function parseToIsoString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return val.toISOString();
  }
  const str = String(val).trim();
  // Format DD/MM/YYYY HH:mm:ss
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6]));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return "";
}

/**
 * Parse timestamp numerik untuk ScanCache
 */
function parseNumericTimestamp(val) {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (val instanceof Date) return val.getTime();
  const str = String(val).trim();
  const num = Number(str);
  if (!isNaN(num) && num > 0) return num;

  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6]));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.getTime();
  return Date.now();
}

function parseJsonObjectSafe(val) {
  if (!val) return {};
  try {
    const parsed = JSON.parse(val);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch (_) {
    return {};
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
