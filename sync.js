// ============================================================
// CEISA INSPECTOR - SUPABASE CLOUD SYNC ENGINE (sync.js)
// Real-time Cloud Synchronization (Additions, Deletions & Offline Fallback)
// ============================================================

const SUPABASE_URL = "https://grvwcvcpxemqyjprbdtr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdydndjdmNweGVtcXlqcHJiZHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTU4MjcsImV4cCI6MjEwNTQ5MTgyN30.sm_cp0G9Xta95vPj3urguZ5tLGlJeQLRXklANTdCwE4";

let supabaseSyncInterval = null;
let isSupabaseSyncing = false;

function getSupabaseHeaders(extraHeaders = {}) {
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        ...extraHeaders
    };
}

// ------------------------------------------------------------
// UNIVERSAL STORAGE HELPER (chrome.storage.local + localStorage)
// ------------------------------------------------------------
async function storageGet(keys) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
            const data = await chrome.storage.local.get(keys);
            if (data && Object.keys(data).length > 0) return data;
        } catch (_) {}
    }

    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach(k => {
        try {
            const val = localStorage.getItem(k);
            result[k] = val ? JSON.parse(val) : undefined;
        } catch (_) {}
    });
    return result;
}

async function storageSet(object) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
            await chrome.storage.local.set(object);
        } catch (_) {}
    }

    for (const [k, v] of Object.entries(object)) {
        try {
            localStorage.setItem(k, JSON.stringify(v));
        } catch (_) {}
    }

    try {
        window.dispatchEvent(new CustomEvent("ceisa_storage_changed", { detail: object }));
    } catch (_) {}
}

async function storageRemove(key) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
            await chrome.storage.local.remove(key);
        } catch (_) {}
    }
    try {
        localStorage.removeItem(key);
    } catch (_) {}
}

// ------------------------------------------------------------
// SANITIZE & CLEAN DATA HELPERS
// ------------------------------------------------------------
function sanitizeRegistrationItem(item) {
    if (!item) return null;
    let str = "";
    if (typeof item === "string") {
        str = item.trim();
    } else if (typeof item === "object") {
        str = String(item.nomor_daftar || item.registrationNumber || item.nomor_dokumen || item.id || "").trim();
    } else {
        str = String(item).trim();
    }
    if (!str || str === "[object Object]" || str.includes("[object") || str.startsWith("PEB-USER-")) return null;
    return str;
}

function cleanNumberArray(list) {
    if (!Array.isArray(list)) return [];
    const set = new Set();
    const result = [];
    for (const item of list) {
        const clean = sanitizeRegistrationItem(item);
        if (clean && !set.has(clean)) {
            set.add(clean);
            result.push(clean);
        }
    }
    return result;
}

// Broadcast REFRESH_COLOR to all active CEISA tabs
async function broadcastRefreshColor() {
    try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
            const tabs = await chrome.tabs.query({ url: "https://portal.beacukai.go.id/*" });
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: "REFRESH_COLOR" }).catch(() => {});
            });
        }
    } catch (_) {}
}

// ------------------------------------------------------------
// PUSH EXACT MIRROR STATE TO SUPABASE CLOUD
// ------------------------------------------------------------
async function pushExactStateToSupabase(completed, pibpeb, cache, targetDate) {
    try {
        let date = targetDate;
        if (!date) {
            const dateData = await storageGet("ceisa_last_scan_date");
            date = dateData.ceisa_last_scan_date || new Date().toISOString().split('T')[0];
        }

        const cleanCompleted = cleanNumberArray(completed);
        const cleanPibPeb = cleanNumberArray(pibpeb);
        const cleanCache = (cache && typeof cache === "object") ? cache : {};

        // 1. Instantly update local storage for zero latency
        const localPayload = {
            ceisa_completed_numbers: cleanCompleted,
            ceisa_pibpeb_numbers: cleanPibPeb,
            ceisa_scan_cache: cleanCache,
            ceisa_last_supabase_sync: Date.now()
        };
        localPayload[`ceisa_completed_numbers_${date}`] = cleanCompleted;
        localPayload[`ceisa_pibpeb_numbers_${date}`] = cleanPibPeb;
        await storageSet(localPayload);

        // 2. Upsert to Supabase ceisa_sync_state
        const syncRow = {
            date: date,
            completed_numbers: cleanCompleted,
            pibpeb_numbers: cleanPibPeb,
            updated_at: new Date().toISOString()
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/ceisa_sync_state`, {
            method: "POST",
            headers: getSupabaseHeaders({
                "Prefer": "resolution=merge-duplicates"
            }),
            body: JSON.stringify([syncRow])
        });

        if (res.ok) {
            await storageSet({ ceisa_supabase_status: "connected" });
        } else {
            console.warn("Supabase sync state warning:", res.status, await res.text().catch(() => ""));
        }

        // 3. If cache has items, upsert to ceisa_scan_cache
        const cacheEntries = Object.values(cleanCache);
        if (cacheEntries.length > 0) {
            const cacheRows = cacheEntries.map(item => {
                if (!item) return null;
                const regNo = sanitizeRegistrationItem(item.registrationNumber);
                if (!regNo) return null;
                return {
                    registration_number: regNo,
                    document_number: item.documentNumber || null,
                    document_type: item.documentType || null,
                    company_name: item.companyName || null,
                    location: item.location || null,
                    status: item.status || null,
                    row_date: (item.rowDate && /^\d{4}-\d{2}-\d{2}$/.test(item.rowDate)) ? item.rowDate : null,
                    timestamp: typeof item.timestamp === "number" ? item.timestamp : Date.now(),
                    raw_data: item,
                    updated_at: new Date().toISOString()
                };
            }).filter(Boolean);

            if (cacheRows.length > 0) {
                // Upsert in batches of 50
                for (let i = 0; i < cacheRows.length; i += 50) {
                    const batch = cacheRows.slice(i, i + 50);
                    await fetch(`${SUPABASE_URL}/rest/v1/ceisa_scan_cache`, {
                        method: "POST",
                        headers: getSupabaseHeaders({
                            "Prefer": "resolution=merge-duplicates"
                        }),
                        body: JSON.stringify(batch)
                    }).catch(() => {});
                }
            }
        }

        await broadcastRefreshColor();
        return true;
    } catch (err) {
        console.warn("Gagal menyimpan ke Supabase:", err.message);
        return false;
    }
}

// ------------------------------------------------------------
// SYNC WITH SUPABASE CLOUD (FETCH & MERGE)
// ------------------------------------------------------------
async function syncWithSupabase() {
    if (isSupabaseSyncing) return null;
    isSupabaseSyncing = true;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        // Fetch sync state & scan cache in parallel
        const [syncRes, cacheRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/ceisa_sync_state?select=*&order=date.desc`, {
                method: "GET",
                headers: getSupabaseHeaders(),
                signal: controller.signal
            }),
            fetch(`${SUPABASE_URL}/rest/v1/ceisa_scan_cache?select=*`, {
                method: "GET",
                headers: getSupabaseHeaders(),
                signal: controller.signal
            })
        ]);

        clearTimeout(timeoutId);

        if (!syncRes.ok) {
            isSupabaseSyncing = false;
            await storageSet({ ceisa_supabase_status: "offline" });
            return null;
        }

        const syncData = await syncRes.json();
        const cacheData = cacheRes.ok ? await cacheRes.json() : [];

        // Build server state maps
        const serverCompletedByDate = {};
        const serverPibPebByDate = {};

        if (Array.isArray(syncData)) {
            for (const row of syncData) {
                if (!row || !row.date) continue;
                serverCompletedByDate[row.date] = cleanNumberArray(row.completed_numbers);
                serverPibPebByDate[row.date] = cleanNumberArray(row.pibpeb_numbers);
            }
        }

        // Build server scan cache map
        const serverCache = {};
        if (Array.isArray(cacheData)) {
            for (const doc of cacheData) {
                if (!doc || !doc.registration_number) continue;
                serverCache[doc.registration_number] = doc.raw_data || {
                    registrationNumber: doc.registration_number,
                    documentNumber: doc.document_number,
                    documentType: doc.document_type,
                    companyName: doc.company_name,
                    location: doc.location,
                    status: doc.status,
                    rowDate: doc.row_date,
                    timestamp: doc.timestamp
                };
            }
        }

        // Active date handling
        const activeDateData = await storageGet("ceisa_last_scan_date");
        const activeDate = activeDateData.ceisa_last_scan_date || new Date().toISOString().split('T')[0];

        // Merge any local-only cache to cloud if newly discovered
        const local = await storageGet(["ceisa_scan_cache"]);
        const localCache = (local.ceisa_scan_cache && typeof local.ceisa_scan_cache === "object") ? local.ceisa_scan_cache : {};
        const unsyncedCacheRows = [];

        for (const [k, v] of Object.entries(localCache)) {
            if (!serverCache[k] && v) {
                serverCache[k] = v;
                const regNo = sanitizeRegistrationItem(v.registrationNumber || k);
                if (regNo) {
                    unsyncedCacheRows.push({
                        registration_number: regNo,
                        document_number: v.documentNumber || null,
                        document_type: v.documentType || null,
                        company_name: v.companyName || null,
                        location: v.location || null,
                        status: v.status || null,
                        row_date: (v.rowDate && /^\d{4}-\d{2}-\d{2}$/.test(v.rowDate)) ? v.rowDate : null,
                        timestamp: typeof v.timestamp === "number" ? v.timestamp : Date.now(),
                        raw_data: v,
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }

        // Prepare local storage payload
        const storagePayload = {
            ceisa_scan_cache: serverCache,
            ceisa_last_supabase_sync: Date.now(),
            ceisa_supabase_status: "connected"
        };

        for (const [d, list] of Object.entries(serverCompletedByDate)) {
            storagePayload[`ceisa_completed_numbers_${d}`] = list;
        }
        for (const [d, list] of Object.entries(serverPibPebByDate)) {
            storagePayload[`ceisa_pibpeb_numbers_${d}`] = list;
        }

        if (serverCompletedByDate[activeDate]) {
            storagePayload.ceisa_completed_numbers = serverCompletedByDate[activeDate];
        }
        if (serverPibPebByDate[activeDate]) {
            storagePayload.ceisa_pibpeb_numbers = serverPibPebByDate[activeDate];
        }

        await storageSet(storagePayload);

        // Upload unsynced local cache rows to cloud in background
        if (unsyncedCacheRows.length > 0) {
            fetch(`${SUPABASE_URL}/rest/v1/ceisa_scan_cache`, {
                method: "POST",
                headers: getSupabaseHeaders({
                    "Prefer": "resolution=merge-duplicates"
                }),
                body: JSON.stringify(unsyncedCacheRows)
            }).catch(() => {});
        }

        await broadcastRefreshColor();

        isSupabaseSyncing = false;
        return true;

    } catch (err) {
        isSupabaseSyncing = false;
        await storageSet({ ceisa_supabase_status: "offline" });
        return null;
    }
}

// ------------------------------------------------------------
// CLEAR ALL SCAN CACHE (LOCAL + SUPABASE)
// ------------------------------------------------------------
async function clearAllScanCache() {
    await storageRemove("ceisa_scan_cache");

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/ceisa_scan_cache?registration_number=not.is.null`, {
            method: "DELETE",
            headers: getSupabaseHeaders()
        });
    } catch (_) {}

    try {
        window.dispatchEvent(new CustomEvent("ceisa_storage_changed"));
    } catch (_) {}
}

// ------------------------------------------------------------
// EXPORT & IMPORT BACKUP JSON
// ------------------------------------------------------------
async function exportBackupJSON() {
    const data = await storageGet([
        "ceisa_completed_numbers",
        "ceisa_pibpeb_numbers",
        "ceisa_scan_cache"
    ]);

    const backup = {
        app: "CEISA_INSPECTOR",
        version: "3.0.0",
        source: "Supabase Cloud",
        exportDate: new Date().toISOString(),
        completed: Array.isArray(data.ceisa_completed_numbers) ? data.ceisa_completed_numbers : [],
        pibpeb: Array.isArray(data.ceisa_pibpeb_numbers) ? data.ceisa_pibpeb_numbers : [],
        cache: (data.ceisa_scan_cache && typeof data.ceisa_scan_cache === "object") ? data.ceisa_scan_cache : {}
    };

    return JSON.stringify(backup, null, 2);
}

async function importBackupJSON(jsonString) {
    try {
        const parsed = JSON.parse(jsonString);
        if (!parsed || parsed.app !== "CEISA_INSPECTOR") {
            throw new Error("Format file JSON tidak valid.");
        }

        const impCompleted = cleanNumberArray(parsed.completed);
        const impPibPeb = cleanNumberArray(parsed.pibpeb);
        const impCache = (parsed.cache && typeof parsed.cache === "object") ? parsed.cache : {};

        await pushExactStateToSupabase(impCompleted, impPibPeb, impCache);

        return {
            success: true,
            completedCount: impCompleted.length,
            pibpebCount: impPibPeb.length,
            cacheCount: Object.keys(impCache).length
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ------------------------------------------------------------
// BACKWARD COMPATIBILITY ALIASES & WI-FI STUBS
// ------------------------------------------------------------
const pushExactStateToWifiServer = pushExactStateToSupabase;
const syncWithWifiServer = syncWithSupabase;

async function getWifiServerUrl() {
    return SUPABASE_URL;
}

async function setWifiServerUrl(url) {
    return SUPABASE_URL;
}

async function discoverWifiServer() {
    return SUPABASE_URL;
}

// ------------------------------------------------------------
// AUTO SUPABASE SYNC LOOP (Every 2.5 seconds)
// ------------------------------------------------------------
(async () => {
    await syncWithSupabase();
    if (!supabaseSyncInterval) {
        supabaseSyncInterval = setInterval(async () => {
            await syncWithSupabase();
        }, 2500);
    }
})();
