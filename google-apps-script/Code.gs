/**
 * ============================================================
 * CEISA AUTO COLORING - GOOGLE APPS SCRIPT SYNC BACKEND
 * ============================================================
 * Skrip ini bertindak sebagai REST API gratis & tanpa batas kuota
 * untuk menyinkronkan data nomor dokumen CEISA & cache hasil scan
 * antar PC secara real-time ke Google Spreadsheet.
 *
 * CARA DEPLOY:
 * 1. Buka spreadsheet baru di Google Sheets.
 * 2. Klik menu 'Ekstensi' (Extensions) -> 'Apps Script'.
 * 3. Hapus semua kode default dan tempel kode ini seluruhnya.
 * 4. Klik tombol 'Terapkan' (Deploy) -> 'Penerapan baru' (New deployment).
 * 5. Pilih jenis: 'Aplikasi web' (Web app).
 * 6. Jalankan sebagai: 'Saya' (Me / akun Google Anda).
 * 7. Siapa yang memiliki akses: 'Siapa saja' (Anyone).
 * 8. Klik 'Terapkan' (Deploy), berikan izin, lalu SALIN Web App URL-nya.
 * ============================================================
 */

const SHEET_SYNC_STATE = "SyncState";
const SHEET_SCAN_CACHE = "ScanCache";

/**
 * Inisialisasi sheet dan header jika belum ada
 */
function getOrCreateSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSyncStateSheet() {
  return getOrCreateSheet(SHEET_SYNC_STATE, [
    "date",
    "completed_numbers",
    "pibpeb_numbers",
    "updated_at"
  ]);
}

function getScanCacheSheet() {
  return getOrCreateSheet(SHEET_SCAN_CACHE, [
    "registration_number",
    "document_number",
    "document_type",
    "company_name",
    "location",
    "status",
    "row_date",
    "timestamp",
    "raw_data",
    "updated_at"
  ]);
}

/**
 * Handle GET requests (Sync data dari Spreadsheet ke Chrome Extension)
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

  if (action === "sync") {
    const since = (e && e.parameter && e.parameter.since) ? e.parameter.since : null;
    const sinceTime = since ? new Date(since).getTime() : 0;

    // 1. Ambil data SyncState
    const stateSheet = getSyncStateSheet();
    const stateData = stateSheet.getDataRange().getValues();
    const syncStateList = [];

    if (stateData.length > 1) {
      for (let i = 1; i < stateData.length; i++) {
        const row = stateData[i];
        const dateStr = row[0] ? formatSheetDate(row[0]) : "";
        if (!dateStr) continue;

        const updatedAtStr = row[3] ? String(row[3]) : "";
        const rowTime = updatedAtStr ? new Date(updatedAtStr).getTime() : 0;

        if (!sinceTime || rowTime > sinceTime) {
          syncStateList.push({
            date: dateStr,
            completed_numbers: parseJsonArraySafe(row[1]),
            pibpeb_numbers: parseJsonArraySafe(row[2]),
            updated_at: updatedAtStr || new Date().toISOString()
          });
        }
      }
    }

    // 2. Ambil data ScanCache (maksimal 250 item terbaru untuk hemat memori)
    const cacheSheet = getScanCacheSheet();
    const cacheData = cacheSheet.getDataRange().getValues();
    const scanCacheList = [];

    if (cacheData.length > 1) {
      // Baca dari bawah ke atas agar mendapat data terbaru lebih dulu
      for (let i = cacheData.length - 1; i >= 1; i--) {
        const row = cacheData[i];
        const regNo = row[0] ? String(row[0]).trim() : "";
        if (!regNo) continue;

        const updatedAtStr = row[9] ? String(row[9]) : "";
        const rowTime = updatedAtStr ? new Date(updatedAtStr).getTime() : 0;

        if (!sinceTime || rowTime > sinceTime) {
          scanCacheList.push({
            registration_number: regNo,
            document_number: row[1] ? String(row[1]) : "",
            document_type: row[2] ? String(row[2]) : "",
            company_name: row[3] ? String(row[3]) : "",
            location: row[4] ? String(row[4]) : "",
            status: row[5] ? String(row[5]) : "",
            row_date: row[6] ? formatSheetDate(row[6]) : "",
            timestamp: row[7] ? Number(row[7]) : Date.now(),
            raw_data: parseJsonObjectSafe(row[8]),
            updated_at: updatedAtStr || new Date().toISOString()
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
  try {
    // Kunci selama max 10 detik agar multi-user tidak saling menimpa
    lock.waitLock(10000);

    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;

    // 1. Aksi Simpan State Nomor (Selesai & PIB/PEB per tanggal)
    if (action === "push_state") {
      const date = String(payload.date || "").trim();
      if (!date) return jsonResponse({ success: false, error: "Date is required" });

      const completed = Array.isArray(payload.completed_numbers) ? payload.completed_numbers : [];
      const pibpeb = Array.isArray(payload.pibpeb_numbers) ? payload.pibpeb_numbers : [];
      const nowIso = new Date().toISOString();

      const sheet = getSyncStateSheet();
      const data = sheet.getDataRange().getValues();
      let foundRow = -1;

      for (let i = 1; i < data.length; i++) {
        if (formatSheetDate(data[i][0]) === date) {
          foundRow = i + 1; // 1-indexed
          break;
        }
      }

      const rowValues = [
        "'" + date,
        JSON.stringify(completed),
        JSON.stringify(pibpeb),
        nowIso
      ];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return jsonResponse({ success: true, date: date, updated_at: nowIso });
    }

    // 2. Aksi Simpan Cache Hasil Scan Tunggal
    if (action === "push_cache_single") {
      const item = payload.item;
      if (!item || !item.registration_number) {
        return jsonResponse({ success: false, error: "registration_number is required" });
      }

      upsertScanCacheRow(item);
      return jsonResponse({ success: true });
    }

    // 3. Aksi Simpan Cache Batch (maksimal 50 item)
    if (action === "push_cache_batch") {
      const items = Array.isArray(payload.items) ? payload.items : [];
      for (let i = 0; i < items.length; i++) {
        upsertScanCacheRow(items[i]);
      }
      return jsonResponse({ success: true, count: items.length });
    }

    // 4. Aksi Bersihkan Cache Scan
    if (action === "clear_cache") {
      const sheet = getScanCacheSheet();
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return jsonResponse({ success: true, cleared: true });
    }

    // 5. Aksi Publikasi Pembaruan (Push Update dari Developer / PC Master)
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
    lock.releaseLock();
  }
}

/**
 * Helper: Upsert 1 baris di sheet ScanCache
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

  const nowIso = new Date().toISOString();
  const rowValues = [
    "'" + regNo,
    item.document_number ? ("'" + item.document_number) : "",
    item.document_type || "",
    item.company_name || "",
    item.location || "",
    item.status || "",
    item.row_date ? formatSheetDate(item.row_date) : "",
    item.timestamp || Date.now(),
    JSON.stringify(item.raw_data || {}),
    nowIso
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
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

function parseJsonArraySafe(val) {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
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
