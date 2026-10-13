// ============================================================
// CEISA INSPECTOR - GOOGLE SHEETS CLOUD SYNC ENGINE (sync.js)
// Real-time Cloud Synchronization (Additions, Deletions & Auto-Update)
// ============================================================

const SYNC_PROVIDER = "google_sheets";
const GOOGLE_SCRIPT_URL = (typeof CEISA_CONFIG !== "undefined" && CEISA_CONFIG.GOOGLE_SCRIPT_URL)
    ? CEISA_CONFIG.GOOGLE_SCRIPT_URL
    : "";

function isGoogleSheetsActive() {
    return Boolean(GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.trim() !== "");
}

async function postGoogleSheetsAction(payload) {
    if (!GOOGLE_SCRIPT_URL) return false;
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        return Boolean(data && data.success);
    } catch (err) {
        console.warn("Gagal kirim ke Google Sheets:", err.message);
        return false;
    }
}

let supabaseSyncInterval = null;
let isSupabaseSyncing = false;
let lastLocalSaveTimestamp = 0;
let isLocalPushInProgress = false;
let consecutiveSyncFailures = 0;

// Smart Sync & Egress Protection Constants
let syncChannel = null;
try {
    if (typeof BroadcastChannel !== "undefined") {
        syncChannel = new BroadcastChannel("ceisa_sync_channel");
        syncChannel.onmessage = (event) => {
            if (event.data?.type === "LOCAL_STATE_UPDATED") {
                try {
                    window.dispatchEvent(new CustomEvent("ceisa_storage_changed", { detail: event.data.payload }));
                    broadcastRefreshColor();
                } catch (_) {}
            }
        };
    }
} catch (_) {}

let lastSuccessfulSupabaseSyncIso = null;
try {
    lastSuccessfulSupabaseSyncIso = localStorage.getItem("ceisa_last_supabase_sync_iso") || null;
} catch (_) {}
const GLOBAL_SYNC_THROTTLE_MS = 25000; // Minimal interval 25 detik antar sinkronisasi cloud

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
        if (syncChannel) {
            syncChannel.postMessage({ type: "LOCAL_STATE_UPDATED", payload: object });
        }
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
function normalizeIsoDate(dateVal) {
    if (!dateVal) return "";
    const str = String(dateVal).trim();
    const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        }
    } catch (_) {}
    return str;
}

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
    if (!str || str === "[object Object]" || str.includes("[object") || str.startsWith("PEB-USER-") || str.includes("GMT") || str.includes("Time") || str.includes("Waktu") || str.includes("00:00:00")) return null;
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
            const tabs = await chrome.tabs.query({});
            if (tabs && tabs.length > 0) {
                tabs.forEach(tab => {
                    if (tab.id && tab.url && (tab.url.includes("beacukai.go.id") || tab.url.includes("localhost"))) {
                        chrome.tabs.sendMessage(tab.id, { type: "REFRESH_COLOR" }).catch(() => {});
                    }
                });
            }
        }
    } catch (_) {}
}

// ------------------------------------------------------------
// RECONCILE SCAN CACHE WITH COMPLETED LISTS
// Memastikan status 'green'/'yellow'/'blue' dsb langsung dibersihkan/dikembalikan
// jika nomor bersangkutan dihapus dari daftar selesai
// ------------------------------------------------------------
function reconcileCacheWithCompletedNumbers(cache, completedList, pibpebList, targetDate) {
    if (!cache || typeof cache !== "object") return {};
    const compSet = new Set((cleanNumberArray(completedList) || []).map(s => String(s).trim().padStart(6, "0")));
    const pibSet = new Set((cleanNumberArray(pibpebList) || []).map(s => String(s).trim().padStart(6, "0")));

    const isNumInSet = (setObj, rawNum) => {
        if (!setObj || setObj.size === 0 || !rawNum) return false;
        const s = String(rawNum).trim();
        return setObj.has(s) || setObj.has(s.padStart(6, "0")) || setObj.has(s.replace(/^0+/, ""));
    };

    const isBatuAmparObj = (item) => {
        if (!item) return false;
        const status = item.status;
        if (status === "yellow" || status === "pink" || status === "cream" || status === "aqua") return true;
        if (status === "green" || status === "purple" || status === "blue" || status === "orange") return false;

        const loc = String(item.location || item.value || item.target || "").toUpperCase();
        if (loc.includes("SEWU") || loc.includes("SEKUPANG") || loc.includes("IDKSP") || loc.includes("IDSKP")) {
            return false;
        }
        if (loc.includes("BATU AMPAR") || loc.includes("BATUAMPAR") || loc.includes("IDBTU")) {
            return true;
        }
        return false;
    };

    for (const [key, item] of Object.entries(cache)) {
        if (!item) continue;
        // Hanya rekonsiliasi cache untuk tanggal yang ditargetkan (jangan hapus/ubah cache tanggal lain!)
        if (targetDate) {
            const itemDate = item.rowDate || (item.timestamp ? new Date(item.timestamp).toISOString().split('T')[0] : "");
            if (itemDate && itemDate !== targetDate) {
                continue;
            }
        }

        const reg = item.registrationNumber || key;
        const isComp = isNumInSet(compSet, reg);
        const isPib = isNumInSet(pibSet, reg);
        const status = item.status;
        const isBatu = isBatuAmparObj(item);

        const loc = String(item.location || item.value || "").toUpperCase();
        const isSewuLoc = loc.includes("SEWU") || loc.includes("SEKUPANG") || loc.includes("IDKSP") || loc.includes("IDSKP");
        const isBatuLoc = loc.includes("BATU AMPAR") || loc.includes("BATUAMPAR") || loc.includes("IDBTU");

        // Self-heal: jika item Sewu tapi tersimpan status red, perbaiki menjadi orange
        if (isSewuLoc && item.status === "red") {
            item.status = "orange";
        }
        // Self-heal: jika item Batu Ampar tapi tersimpan status orange, perbaiki menjadi red
        if (isBatuLoc && item.status === "orange") {
            item.status = "red";
        }

        const isCompletedStatus = (status === "green" || status === "yellow" || status === "blue" || status === "purple" || status === "pink" || status === "aqua");

        if (isCompletedStatus) {
            if (isComp && isPib) {
                item.status = isBatu ? "aqua" : "blue";
            } else if (isComp && !isPib) {
                item.status = isBatu ? "yellow" : "green";
            } else if (!isComp && isPib) {
                item.status = isBatu ? "pink" : "purple";
            } else {
                // Nomor dihapus dari daftar selesai oleh pengguna
                if (item.companyName || item.location || item.documentNumber || item.value) {
                    item.status = isBatu ? "red" : "orange";
                } else {
                    delete cache[key];
                }
            }
        }
    }
    return cache;
}

// ------------------------------------------------------------
// PUSH EXACT MIRROR STATE TO SUPABASE CLOUD
// ------------------------------------------------------------
async function pushExactStateToSupabase(completed, pibpeb, cache, targetDate, isFullBackup = false) {
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
        let cleanCache = (cache && typeof cache === "object") ? { ...cache } : {};

        // Rekonsiliasi cache khusus untuk tanggal target agar tanggal lain tidak tersenggol
        cleanCache = reconcileCacheWithCompletedNumbers(cleanCache, cleanCompleted, cleanPibPeb, date);

        // 1. Instantly update local storage for zero latency
        const localPayload = {
            ceisa_scan_cache: cleanCache,
            ceisa_last_supabase_sync: now,
            ceisa_last_local_save_time: now
        };
        localPayload[`ceisa_completed_numbers_${date}`] = cleanCompleted;
        localPayload[`ceisa_pibpeb_numbers_${date}`] = cleanPibPeb;
        localPayload[`ceisa_last_save_${date}`] = now;
        if (date === new Date().toISOString().split('T')[0]) {
            localPayload.ceisa_completed_numbers = cleanCompleted;
            localPayload.ceisa_pibpeb_numbers = cleanPibPeb;
        }
        await storageSet(localPayload);

        // Immediate broadcast to ensure instantaneous color change with 0 latency
        await broadcastRefreshColor();

        // 2. Prepare Cache Rows
        const cacheEntries = Object.values(cleanCache);
        let cacheRows = [];
        if (cacheEntries.length > 0) {
            let targetCacheEntries = cacheEntries;
            if (!isFullBackup) {
                const ONE_DAY_MS = 24 * 60 * 60 * 1000;
                targetCacheEntries = cacheEntries
                    .filter(item => item && (now - Number(item.timestamp || 0)) < ONE_DAY_MS)
                    .slice(0, 50);
            }

            cacheRows = targetCacheEntries.map(item => {
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
        }

        // Kirim ke Google Sheets Web App
        if (!isGoogleSheetsActive()) {
            isLocalPushInProgress = false;
            return false;
        }

        postGoogleSheetsAction({
            action: "push_state",
            date: date,
            completed_numbers: cleanCompleted,
            pibpeb_numbers: cleanPibPeb
        }).then(ok => {
            if (ok) storageSet({ ceisa_supabase_status: "connected" });
        });

        if (cacheRows.length > 0) {
            postGoogleSheetsAction({
                action: "push_cache_batch",
                items: cacheRows
            });
        }

        isLocalPushInProgress = false;
        return true;
    } catch (err) {
        isLocalPushInProgress = false;
        console.warn("Gagal menyimpan ke Google Sheets:", err.message);
        return false;
    }
}

// ------------------------------------------------------------
// INSTANT PUSH SINGLE CACHE ITEM TO CLOUD (GOOGLE SHEETS / SUPABASE)
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

    if (!isGoogleSheetsActive()) return false;

    postGoogleSheetsAction({
        action: "push_cache_single",
        item: row
    });
    return true;
}

// ------------------------------------------------------------
// SYNC WITH CLOUD (GOOGLE SHEETS / SUPABASE) (FETCH & MERGE)
// ------------------------------------------------------------
async function syncWithSupabase(force = false) {
    if (!isGoogleSheetsActive()) return null;
    if (isSupabaseSyncing || isLocalPushInProgress) return null;

    // 1. Tab Visibility Guard: Hentikan polling jika tab sedang di-minimize / tidak aktif
    if (!force && typeof document !== "undefined" && document.hidden) {
        return null;
    }

    // 2. Cross-Tab Throttle: Jika tab lain di browser baru saja sync < 25 detik lalu, lewati
    let lastGlobal = 0;
    try {
        lastGlobal = Number(localStorage.getItem("ceisa_global_sync_ts") || 0);
    } catch (_) {}
    if (!force && (Date.now() - lastGlobal < GLOBAL_SYNC_THROTTLE_MS)) {
        return null;
    }

    isSupabaseSyncing = true;
    try {
        localStorage.setItem("ceisa_global_sync_ts", String(Date.now()));
    } catch (_) {}

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);

        let gUrl = `${GOOGLE_SCRIPT_URL}?action=sync`;
        if (lastSuccessfulSupabaseSyncIso && !force) {
            gUrl += `&since=${encodeURIComponent(lastSuccessfulSupabaseSyncIso)}`;
        }

        const gRes = await fetch(gUrl, {
            method: "GET",
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!gRes.ok) {
            isSupabaseSyncing = false;
            consecutiveSyncFailures++;
            if (consecutiveSyncFailures >= 2) {
                await storageSet({ ceisa_supabase_status: "offline" });
            }
            return null;
        }

        const gJson = await gRes.json();
        const syncData = Array.isArray(gJson.sync_state) ? gJson.sync_state : [];
        const cacheData = Array.isArray(gJson.scan_cache) ? gJson.scan_cache : [];

        // Broadcast Auto-Update Detection
        if (gJson && gJson.latest_update && gJson.latest_update.commit) {
            storageSet({ ceisa_remote_update: gJson.latest_update }).catch(() => {});
            storageGet(["ceisa_local_commit", "ceisa_auto_update_enabled"]).then(store => {
                const localSha = store.ceisa_local_commit;
                const remoteSha = gJson.latest_update.commit;
                if (localSha && remoteSha && localSha !== remoteSha) {
                    try {
                        window.dispatchEvent(new CustomEvent("ceisa_update_available", { detail: gJson.latest_update }));
                    } catch (_) {}

                    if (store.ceisa_auto_update_enabled === true) {
                        try {
                            chrome.runtime.sendMessage({ type: "PERFORM_PULL_UPDATE" });
                        } catch (_) {}
                    }
                }
            }).catch(() => {});
        }

        lastSuccessfulSupabaseSyncIso = new Date().toISOString();
        try {
            localStorage.setItem("ceisa_last_supabase_sync_iso", lastSuccessfulSupabaseSyncIso);
        } catch (_) {}

        // Jika delta query kosong (tidak ada data baru dari cloud), langsung selesai dengan 0 KB beban
        if (lastSuccessfulSupabaseSyncIso && Array.isArray(syncData) && syncData.length === 0 && Array.isArray(cacheData) && cacheData.length === 0) {
            isSupabaseSyncing = false;
            return true;
        }

        // Active date handling
        const activeDateData = await storageGet("ceisa_last_scan_date");
        const activeDate = activeDateData.ceisa_last_scan_date || new Date().toISOString().split('T')[0];

        // Fetch local save timestamps for anti-flicker protection
        const localTimeKeys = ["ceisa_last_local_save_time", `ceisa_last_save_${activeDate}`];
        if (Array.isArray(syncData)) {
            syncData.forEach(r => {
                if (r && r.date) {
                    r.date = normalizeIsoDate(r.date);
                    localTimeKeys.push(`ceisa_last_save_${r.date}`);
                }
            });
        }
        const localTimeData = await storageGet(localTimeKeys);

        // Build server state maps (respecting local saves that just happened)
        const serverCompletedByDate = {};
        const serverPibPebByDate = {};

        if (Array.isArray(syncData)) {
            for (const row of syncData) {
                if (!row || !row.date) continue;
                const d = normalizeIsoDate(row.date);
                const serverTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                const localDateSaveTime = Math.max(
                    lastLocalSaveTimestamp,
                    Number(localTimeData.ceisa_last_local_save_time || 0),
                    Number(localTimeData[`ceisa_last_save_${d}`] || 0)
                );
                const timeSinceSave = Date.now() - localDateSaveTime;

                // Anti-flicker: If local client saved recently (< 30s) and server is not newer,
                // NEVER overwrite fresh local numbers with stale server data!
                if (localDateSaveTime > 0 && timeSinceSave < 30000 && serverTime <= localDateSaveTime) {
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
                const regKey = sanitizeRegistrationItem(doc.registration_number);
                if (!regKey) continue;
                const cacheObj = doc.raw_data || {
                    registrationNumber: regKey,
                    documentNumber: doc.document_number,
                    documentType: doc.document_type,
                    companyName: doc.company_name,
                    location: doc.location,
                    status: doc.status,
                    rowDate: normalizeIsoDate(doc.row_date),
                    timestamp: doc.timestamp
                };
                serverCache[regKey] = cacheObj;
                if (/^\d{1,5}$/.test(regKey)) {
                    serverCache[regKey.padStart(6, '0')] = cacheObj;
                }
            }
        }

        // Merge localCache and serverCache safely (local valid scan never gets erased by server)
        const local = await storageGet(["ceisa_scan_cache"]);
        const localCache = (local.ceisa_scan_cache && typeof local.ceisa_scan_cache === "object") ? local.ceisa_scan_cache : {};
        const mergedCache = { ...localCache, ...serverCache };
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

        // Rekonsiliasi mergedCache dengan daftar selesai aktif agar nomor yang dihapus tidak pernah dibangkitkan kembali
        const effectiveCompleted = serverCompletedByDate[activeDate] !== undefined ? serverCompletedByDate[activeDate] : (currentStored[`ceisa_completed_numbers_${activeDate}`] || currentStored.ceisa_completed_numbers || []);
        const effectivePibpeb = serverPibPebByDate[activeDate] !== undefined ? serverPibPebByDate[activeDate] : (currentStored[`ceisa_pibpeb_numbers_${activeDate}`] || currentStored.ceisa_pibpeb_numbers || []);
        reconcileCacheWithCompletedNumbers(mergedCache, effectiveCompleted, effectivePibpeb, activeDate);

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

        const todayDate = new Date().toISOString().split('T')[0];
        if (serverCompletedByDate[activeDate] !== undefined && activeDate === todayDate) {
            const currentList = Array.isArray(currentStored.ceisa_completed_numbers)
                ? currentStored.ceisa_completed_numbers
                : [];
            if (!areArraysEqual(currentList, serverCompletedByDate[activeDate])) {
                storagePayload.ceisa_completed_numbers = serverCompletedByDate[activeDate];
                hasNumberChanges = true;
            }
        }

        if (serverPibPebByDate[activeDate] !== undefined && activeDate === todayDate) {
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
        if (unsyncedCacheRows.length > 0 && isGoogleSheetsActive()) {
            postGoogleSheetsAction({
                action: "push_cache_batch",
                items: unsyncedCacheRows.slice(0, 50)
            });
        }

        // Only broadcast REFRESH_COLOR if numbers actually changed or new cache arrived
        if (hasNumberChanges || unsyncedCacheRows.length > 0) {
            await broadcastRefreshColor();
        }

        isSupabaseSyncing = false;
        consecutiveSyncFailures = 0;
        return true;

    } catch (err) {
        isSupabaseSyncing = false;
        consecutiveSyncFailures++;
        if (consecutiveSyncFailures >= 2) {
            await storageSet({ ceisa_supabase_status: "offline" });
        }
        return null;
    }
}

// ------------------------------------------------------------
// CLEAR ALL SCAN CACHE (LOCAL + CLOUD)
// ------------------------------------------------------------
async function clearAllScanCache() {
    await storageRemove("ceisa_scan_cache");

    if (isGoogleSheetsActive()) {
        await postGoogleSheetsAction({ action: "clear_cache" });
    }

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
        source: "Google Cloud Sync",
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

        await pushExactStateToSupabase(impCompleted, impPibPeb, impCache, null, true);

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
    return GOOGLE_SCRIPT_URL;
}

async function setWifiServerUrl(url) {
    return GOOGLE_SCRIPT_URL;
}

async function discoverWifiServer() {
    return GOOGLE_SCRIPT_URL;
}

// ------------------------------------------------------------
// SMART SUPABASE SYNC LOOP (Every 30 seconds when tab is active)
// ------------------------------------------------------------
(async () => {
    // Initial sync
    setTimeout(async () => {
        await syncWithSupabase(true);
    }, 1000);

    if (!supabaseSyncInterval) {
        supabaseSyncInterval = setInterval(async () => {
            await syncWithSupabase(false);
        }, 30000); // 30 detik (hemat bandwidth 99%)
    }

    // Auto sync saat pengguna kembali membuka / memfokuskan tab
    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                syncWithSupabase(false);
            }
        });
        window.addEventListener("focus", () => {
            syncWithSupabase(false);
        });
    }
})();

// ------------------------------------------------------------
// UNIVERSAL THEME MANAGER (DARK / LIGHT MODE PERSISTENCE)
// ------------------------------------------------------------
function initCeisaTheme() {
    let savedTheme = 'dark';
    try {
        savedTheme = localStorage.getItem('ceisa_theme');
        if (!savedTheme) {
            savedTheme = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'dark';
        }
    } catch (_) {}
    applyCeisaTheme(savedTheme);
}

function applyCeisaTheme(theme) {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    try {
        localStorage.setItem('ceisa_theme', theme);
    } catch (_) {}

    const isDark = theme === 'dark';
    const bg = isDark ? '#080d16' : '#f8fafc';
    const cs = isDark ? 'dark' : 'light';

    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.colorScheme = cs;

    const criticalStyle = document.getElementById('ceisa-theme-critical');
    if (criticalStyle) {
        criticalStyle.textContent = 'html, body { background-color: ' + bg + ' !important; color-scheme: ' + cs + ' !important; }';
    }

    const toggleBtns = document.querySelectorAll('#themeToggleBtn, .ceisa-theme-toggle');
    toggleBtns.forEach(btn => {
        const label = btn.querySelector('.theme-label');
        if (label) {
            label.textContent = theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';
        }
        btn.setAttribute('title', theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap');
    });
}

function toggleCeisaTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyCeisaTheme(next);
}

if (typeof document !== 'undefined') {
    initCeisaTheme();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initCeisaTheme();
            setupThemeToggleListeners();
        });
    } else {
        setupThemeToggleListeners();
    }
}

function setupThemeToggleListeners() {
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('#themeToggleBtn, .ceisa-theme-toggle');
        if (toggleBtn) {
            e.preventDefault();
            toggleCeisaTheme();
        }
    });
}

