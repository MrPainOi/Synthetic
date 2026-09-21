// ============================================================
// CEISA INSPECTOR - SUPABASE CLOUD SYNC ENGINE (sync.js)
// Real-time Cloud Synchronization (Additions, Deletions & Offline Fallback)
// ============================================================

// Konfigurasi diambil dari config.js (file yang di-gitignore).
// Jika config.js tidak ada (misal: clone baru), buat dari config.example.js
const SUPABASE_URL = (typeof CEISA_CONFIG !== "undefined" && CEISA_CONFIG.SUPABASE_URL)
    ? CEISA_CONFIG.SUPABASE_URL
    : "";
const SUPABASE_ANON_KEY = (typeof CEISA_CONFIG !== "undefined" && CEISA_CONFIG.SUPABASE_ANON_KEY)
    ? CEISA_CONFIG.SUPABASE_ANON_KEY
    : "";

let supabaseSyncInterval = null;
let isSupabaseSyncing = false;
let lastLocalSaveTimestamp = 0;
let isLocalPushInProgress = false;

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

function areArraysEqual(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// Broadcast REFRESH_COLOR to all active CEISA tabs
async function broadcastRefreshColor() {
    try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
            const tabs = await chrome.tabs.query({ url: ["*://portal.beacukai.go.id/*", "*://*.beacukai.go.id/*"] });
            if (tabs && tabs.length > 0) {
                tabs.forEach(tab => {
                    if (tab.id) {
                        chrome.tabs.sendMessage(tab.id, { type: "REFRESH_COLOR" }).catch(() => {});
                    }
                });
            } else {
                const activeTabs = await chrome.tabs.query({ active: true });
                activeTabs.forEach(tab => {
                    if (tab.id) {
                        chrome.tabs.sendMessage(tab.id, { type: "REFRESH_COLOR" }).catch(() => {});
                    }
                });
            }
        }
    } catch (_) {}
}

// ------------------------------------------------------------
// PUSH EXACT MIRROR STATE TO SUPABASE CLOUD
// ------------------------------------------------------------
async function pushExactStateToSupabase(completed, pibpeb, cache, targetDate) {
    const now = Date.now();
    lastLocalSaveTimestamp = now;
    isLocalPushInProgress = true;

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
            ceisa_last_supabase_sync: now,
            ceisa_last_local_save_time: now
        };
        localPayload[`ceisa_completed_numbers_${date}`] = cleanCompleted;
        localPayload[`ceisa_pibpeb_numbers_${date}`] = cleanPibPeb;
        localPayload[`ceisa_last_save_${date}`] = now;
        await storageSet(localPayload);

        // Immediate broadcast to ensure instantaneous color change with 0 latency
        await broadcastRefreshColor();

        // 2. Upsert to Supabase ceisa_sync_state
        const syncRow = {
            date: date,
            completed_numbers: cleanCompleted,
            pibpeb_numbers: cleanPibPeb,
            updated_at: new Date(now).toISOString()
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/ceisa_sync_state`, {
            method: "POST",
            headers: getSupabaseHeaders({
                "Prefer": "resolution=merge-duplicates"
            }),
            body: JSON.stringify([syncRow])
        });

        isLocalPushInProgress = false;

        if (res.ok) {
            await storageSet({ ceisa_supabase_status: "connected" });
        } else {
            console.warn("Supabase sync state warning:", res.status, await res.text().catch(() => ""));
        }

        // 3. Upsert cache in background without blocking UI
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
                (async () => {
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
                })();
            }
        }

        return true;
    } catch (err) {
        isLocalPushInProgress = false;
        console.warn("Gagal menyimpan ke Supabase:", err.message);
        return false;
    }
}

// ------------------------------------------------------------
// INSTANT PUSH SINGLE CACHE ITEM TO SUPABASE
// ------------------------------------------------------------
async function pushSingleCacheItemToSupabase(item) {
    if (!item) return false;
    const regNo = sanitizeRegistrationItem(item.registrationNumber);
    if (!regNo || !item.status) return false;

    const row = {
        registration_number: regNo,
        document_number: item.documentNumber || null,
        document_type: item.documentType || null,
        company_name: item.companyName || null,
        location: item.location || null,
        status: item.status,
        row_date: (item.rowDate && /^\d{4}-\d{2}-\d{2}$/.test(item.rowDate)) ? item.rowDate : null,
        timestamp: typeof item.timestamp === "number" ? item.timestamp : Date.now(),
        raw_data: item,
        updated_at: new Date().toISOString()
    };

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/ceisa_scan_cache`, {
            method: "POST",
            headers: getSupabaseHeaders({
                "Prefer": "resolution=merge-duplicates"
            }),
            body: JSON.stringify([row])
        });
        return true;
    } catch (_) {
        return false;
    }
}

// ------------------------------------------------------------
// SYNC WITH SUPABASE CLOUD (FETCH & MERGE)
// ------------------------------------------------------------
async function syncWithSupabase() {
    if (isSupabaseSyncing || isLocalPushInProgress) return null;
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
            fetch(`${SUPABASE_URL}/rest/v1/ceisa_scan_cache?select=*&status=not.is.null&order=timestamp.desc.nullslast&limit=1000`, {
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

        // Active date handling
        const activeDateData = await storageGet("ceisa_last_scan_date");
        const activeDate = activeDateData.ceisa_last_scan_date || new Date().toISOString().split('T')[0];

        // Fetch local save timestamps for anti-flicker protection
        const localTimeKeys = ["ceisa_last_local_save_time", `ceisa_last_save_${activeDate}`];
        if (Array.isArray(syncData)) {
            syncData.forEach(r => {
                if (r && r.date) localTimeKeys.push(`ceisa_last_save_${r.date}`);
            });
        }
        const localTimeData = await storageGet(localTimeKeys);

        // Build server state maps (respecting local saves that just happened)
        const serverCompletedByDate = {};
        const serverPibPebByDate = {};

        if (Array.isArray(syncData)) {
            for (const row of syncData) {
                if (!row || !row.date) continue;
                const d = row.date;
                const serverTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                const localDateSaveTime = Math.max(
                    lastLocalSaveTimestamp,
                    Number(localTimeData.ceisa_last_local_save_time || 0),
                    Number(localTimeData[`ceisa_last_save_${d}`] || 0)
                );
                const timeSinceSave = Date.now() - localDateSaveTime;

                // Anti-flicker: If local client saved recently (< 6s) and server is not newer,
                // NEVER overwrite fresh local numbers with stale server data!
                if (timeSinceSave < 6000 && serverTime <= localDateSaveTime) {
                    continue;
                }

                serverCompletedByDate[d] = cleanNumberArray(row.completed_numbers);
                serverPibPebByDate[d] = cleanNumberArray(row.pibpeb_numbers);
            }
        }

        // Build server scan cache map (only items with valid status)
        const serverCache = {};
        if (Array.isArray(cacheData)) {
            for (const doc of cacheData) {
                if (!doc || !doc.registration_number || !doc.status) continue;
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

        // Merge localCache and serverCache safely (local valid scan never gets erased by server)
        const local = await storageGet(["ceisa_scan_cache"]);
        const localCache = (local.ceisa_scan_cache && typeof local.ceisa_scan_cache === "object") ? local.ceisa_scan_cache : {};
        const mergedCache = { ...serverCache };
        const unsyncedCacheRows = [];

        for (const [k, v] of Object.entries(localCache)) {
            if (!v) continue;
            const sItem = mergedCache[k];
            const localHasStatus = Boolean(v.status && v.status !== "");
            const serverHasStatus = Boolean(sItem && sItem.status && sItem.status !== "");
            const localTs = Number(v.timestamp || 0);
            const serverTs = Number(sItem?.timestamp || 0);

            // Local wins if server doesn't have it, or server has no status while local does, or local is newer with valid status
            if (!sItem || (!serverHasStatus && localHasStatus) || (localHasStatus && localTs >= serverTs)) {
                mergedCache[k] = v;
                if (localHasStatus) {
                    const regNo = sanitizeRegistrationItem(v.registrationNumber || k);
                    if (regNo) {
                        unsyncedCacheRows.push({
                            registration_number: regNo,
                            document_number: v.documentNumber || null,
                            document_type: v.documentType || null,
                            company_name: v.companyName || null,
                            location: v.location || null,
                            status: v.status,
                            row_date: (v.rowDate && /^\d{4}-\d{2}-\d{2}$/.test(v.rowDate)) ? v.rowDate : null,
                            timestamp: localTs || Date.now(),
                            raw_data: v,
                            updated_at: new Date().toISOString()
                        });
                    }
                }
            }
        }

        // Check against current local storage to only update and broadcast on ACTUAL changes
        const currentStored = await storageGet([
            "ceisa_completed_numbers",
            "ceisa_pibpeb_numbers",
            `ceisa_completed_numbers_${activeDate}`,
            `ceisa_pibpeb_numbers_${activeDate}`
        ]);

        let hasNumberChanges = false;
        const storagePayload = {
            ceisa_scan_cache: mergedCache,
            ceisa_last_supabase_sync: Date.now(),
            ceisa_supabase_status: "connected"
        };

        for (const [d, list] of Object.entries(serverCompletedByDate)) {
            const currentList = Array.isArray(currentStored[`ceisa_completed_numbers_${d}`])
                ? currentStored[`ceisa_completed_numbers_${d}`]
                : [];
            if (!areArraysEqual(currentList, list)) {
                storagePayload[`ceisa_completed_numbers_${d}`] = list;
                hasNumberChanges = true;
            }
        }
        for (const [d, list] of Object.entries(serverPibPebByDate)) {
            const currentList = Array.isArray(currentStored[`ceisa_pibpeb_numbers_${d}`])
                ? currentStored[`ceisa_pibpeb_numbers_${d}`]
                : [];
            if (!areArraysEqual(currentList, list)) {
                storagePayload[`ceisa_pibpeb_numbers_${d}`] = list;
                hasNumberChanges = true;
            }
        }

        if (serverCompletedByDate[activeDate] !== undefined) {
            const currentList = Array.isArray(currentStored.ceisa_completed_numbers)
                ? currentStored.ceisa_completed_numbers
                : [];
            if (!areArraysEqual(currentList, serverCompletedByDate[activeDate])) {
                storagePayload.ceisa_completed_numbers = serverCompletedByDate[activeDate];
                hasNumberChanges = true;
            }
        }
        if (serverPibPebByDate[activeDate] !== undefined) {
            const currentList = Array.isArray(currentStored.ceisa_pibpeb_numbers)
                ? currentStored.ceisa_pibpeb_numbers
                : [];
            if (!areArraysEqual(currentList, serverPibPebByDate[activeDate])) {
                storagePayload.ceisa_pibpeb_numbers = serverPibPebByDate[activeDate];
                hasNumberChanges = true;
            }
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

        // Only broadcast REFRESH_COLOR if numbers actually changed or new cache arrived
        if (hasNumberChanges || unsyncedCacheRows.length > 0) {
            await broadcastRefreshColor();
        }

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
