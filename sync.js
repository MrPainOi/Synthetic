// ============================================================
// CEISA INSPECTOR - LOCAL WI-FI NETWORK SYNC ENGINE (sync.js)
// 100% Exact Mirror Sync Across All Devices (Additions & Deletions)
// ============================================================

let wifiSyncInterval = null;
let isWifiSyncing = false;

const DEFAULT_WIFI_PORT = "8080";

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
// GET & SET LOCAL WI-FI SERVER URL
// ------------------------------------------------------------
async function discoverWifiServer() {
    const saved = await storageGet(["ceisa_wifi_server_url", "ceisa_operation_mode"]);
    const mode = saved.ceisa_operation_mode || "auto"; // "auto", "host", "client"
    
    let originCandidate = null;
    if (typeof window !== "undefined" && window.location && window.location.hostname) {
        if (window.location.protocol.startsWith("http") && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
            originCandidate = `${window.location.protocol}//${window.location.hostname}:${window.location.port || DEFAULT_WIFI_PORT}`;
        }
    }

    const candidateUrls = [];
    if (originCandidate) candidateUrls.push(originCandidate);

    if (saved.ceisa_wifi_server_url) {
        let clean = saved.ceisa_wifi_server_url.trim().replace(/\/+$/, "");
        if (!clean.startsWith("http")) clean = `http://${clean}`;
        if (!candidateUrls.includes(clean)) candidateUrls.push(clean);
    }

    // Common office subnet probes (e.g. 192.168.100.x, 192.168.1.x, 192.168.0.x)
    const subnetPrefixes = ["192.168.100.", "192.168.1.", "192.168.0."];
    const ipMatch = (saved.ceisa_wifi_server_url || originCandidate || "").match(/(\d+\.\d+\.\d+\.)/);
    if (ipMatch && !subnetPrefixes.includes(ipMatch[1])) {
        subnetPrefixes.unshift(ipMatch[1]);
    }

    for (const prefix of subnetPrefixes) {
        for (const hostNum of [15, 1, 2, 10, 50, 100]) {
            const u = `http://${prefix}${hostNum}:${DEFAULT_WIFI_PORT}`;
            if (!candidateUrls.includes(u)) candidateUrls.push(u);
        }
    }

    const localhostUrl = `http://localhost:${DEFAULT_WIFI_PORT}`;
    if (mode === "host") {
        candidateUrls.unshift(localhostUrl);
    } else {
        candidateUrls.push(localhostUrl);
    }

    // Fast probing across candidate URLs
    for (const url of candidateUrls) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600);
            const res = await fetch(`${url}/api/status`, { method: "GET", signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const info = await res.json().catch(() => null);
                if (info && (info.status === "ok" || info.app === "ceisa_inspector")) {
                    await storageSet({ ceisa_wifi_server_url: url });
                    return url;
                }
            }
        } catch (_) {}
    }

    return null;
}

async function getWifiServerUrl() {
    const data = await storageGet(["ceisa_wifi_server_url", "ceisa_operation_mode"]);
    if (data.ceisa_wifi_server_url) {
        let url = data.ceisa_wifi_server_url.trim().replace(/\/+$/, "");
        if (!url.startsWith("http")) url = `http://${url}`;
        return url;
    }
    if (typeof window !== "undefined" && window.location && window.location.hostname) {
        if (window.location.protocol.startsWith("http")) {
            return `${window.location.protocol}//${window.location.hostname}:${window.location.port || DEFAULT_WIFI_PORT}`;
        }
    }

    // Try auto-discovering server on LAN
    const discovered = await discoverWifiServer();
    if (discovered) return discovered;

    return `http://localhost:${DEFAULT_WIFI_PORT}`;
}

async function setWifiServerUrl(url) {
    let cleanUrl = String(url || "").trim().replace(/\/+$/, "");
    if (cleanUrl && !cleanUrl.startsWith("http")) {
        cleanUrl = `http://${cleanUrl}`;
    }
    await storageSet({ ceisa_wifi_server_url: cleanUrl });
    if (cleanUrl) {
        await syncWithWifiServer();
    }
    return cleanUrl;
}

// ------------------------------------------------------------
// PUSH EXACT MIRROR STATE TO WI-FI SERVER (Additions & Deletions)
// ------------------------------------------------------------
async function pushExactStateToWifiServer(completed, pibpeb, cache, targetDate) {
    try {
        const baseUrl = await getWifiServerUrl();
        if (!baseUrl) return false;

        let date = targetDate;
        if (!date) {
            const dateData = await storageGet("ceisa_last_scan_date");
            date = dateData.ceisa_last_scan_date || new Date().toISOString().split('T')[0];
        }

        const cleanCompleted = Array.isArray(completed)
            ? completed.map(s => String(s || "").trim()).filter(s => /^\d{6}$/.test(s))
            : [];
        const cleanPibPeb = Array.isArray(pibpeb)
            ? pibpeb.map(s => String(s || "").trim()).filter(s => /^\d{6}$/.test(s))
            : [];

        const payload = {
            isSave: true,
            forceOverwrite: true,
            date: date,
            completed: cleanCompleted,
            pibpeb: cleanPibPeb,
            cache: cache || {}
        };

        payload.completedByDate = {};
        payload.completedByDate[date] = cleanCompleted;

        payload.pibpebByDate = {};
        payload.pibpebByDate[date] = cleanPibPeb;

        await fetch(`${baseUrl}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return true;
    } catch (_) {
        return false;
    }
}

// ------------------------------------------------------------
// SYNC WITH LOCAL WI-FI SERVER (MIRROR SYNC)
// ------------------------------------------------------------
async function syncWithWifiServer() {
    if (isWifiSyncing) return null;
    isWifiSyncing = true;

    try {
        const baseUrl = await getWifiServerUrl();
        if (!baseUrl) {
            isWifiSyncing = false;
            return null;
        }

        // Send local scan cache to merge with server (do NOT send completed/pibpeb lists during background sync to prevent stale overwrites)
        const local = await storageGet(["ceisa_scan_cache"]);
        const cache = (local.ceisa_scan_cache && typeof local.ceisa_scan_cache === "object") ? local.ceisa_scan_cache : {};

        const response = await fetch(`${baseUrl}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cache })
        });

        if (!response.ok) {
            isWifiSyncing = false;
            return null;
        }

        const resData = await response.json();
        if (resData && resData.success && resData.data) {
            const serverDb = resData.data;

            const mergedCache = (serverDb.cache && typeof serverDb.cache === "object") ? serverDb.cache : {};
            const serverCompletedByDate = (serverDb.completedByDate && typeof serverDb.completedByDate === "object") ? serverDb.completedByDate : {};
            const serverPibPebByDate = (serverDb.pibpebByDate && typeof serverDb.pibpebByDate === "object") ? serverDb.pibpebByDate : {};

            const activeDateData = await storageGet("ceisa_last_scan_date");
            const activeDate = activeDateData.ceisa_last_scan_date || new Date().toISOString().split('T')[0];

            function cleanNumberArray(list) {
                if (!Array.isArray(list)) return [];
                return list.map(item => {
                    if (typeof item === "string") return item.trim();
                    if (item && typeof item === "object") {
                        return (item.nomor_daftar || item.registrationNumber || item.nomor_dokumen || item.id || "").trim();
                    }
                    return String(item || "").trim();
                }).filter(s => s && s !== "[object Object]" && !s.includes("[object") && !s.startsWith("PEB-USER-"));
            }

            const storagePayload = {
                ceisa_scan_cache: mergedCache,
                ceisa_last_wifi_sync: Date.now()
            };

            for (const [d, list] of Object.entries(serverCompletedByDate)) {
                storagePayload[`ceisa_completed_numbers_${d}`] = cleanNumberArray(list);
            }
            for (const [d, list] of Object.entries(serverPibPebByDate)) {
                storagePayload[`ceisa_pibpeb_numbers_${d}`] = cleanNumberArray(list);
            }

            if (serverCompletedByDate[activeDate]) {
                storagePayload.ceisa_completed_numbers = cleanNumberArray(serverCompletedByDate[activeDate]);
            }
            if (serverPibPebByDate[activeDate]) {
                storagePayload.ceisa_pibpeb_numbers = cleanNumberArray(serverPibPebByDate[activeDate]);
            }

            await storageSet(storagePayload);

            // Broadcast REFRESH_COLOR to active CEISA tabs
            try {
                if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
                    const tabs = await chrome.tabs.query({ url: "https://portal.beacukai.go.id/*" });
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { type: "REFRESH_COLOR" });
                    });
                }
            } catch (_) {}
        }

        isWifiSyncing = false;
        return true;

    } catch (err) {
        isWifiSyncing = false;
        return null;
    }
}

// ------------------------------------------------------------
// CLEAR ALL SCAN CACHE (LOCAL + SERVER)
// ------------------------------------------------------------
async function clearAllScanCache() {
    await storageRemove("ceisa_scan_cache");

    try {
        const baseUrl = await getWifiServerUrl();
        if (baseUrl) {
            await fetch(`${baseUrl}/api/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clearCache: true })
            });
        }
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
        version: "2.0.0",
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

        const impCompleted = Array.isArray(parsed.completed) ? parsed.completed : [];
        const impPibPeb = Array.isArray(parsed.pibpeb) ? parsed.pibpeb : [];
        const impCache = (parsed.cache && typeof parsed.cache === "object") ? parsed.cache : {};

        await storageSet({
            ceisa_completed_numbers: impCompleted,
            ceisa_pibpeb_numbers: impPibPeb,
            ceisa_scan_cache: impCache
        });

        if (typeof pushExactStateToWifiServer === "function") {
            await pushExactStateToWifiServer(impCompleted, impPibPeb, impCache);
        }

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
// AUTO WI-FI SYNC LOOP (Every 2 seconds)
// ------------------------------------------------------------
(async () => {
    await syncWithWifiServer();
    if (!wifiSyncInterval) {
        wifiSyncInterval = setInterval(async () => {
            await syncWithWifiServer();
        }, 2000);
    }
})();
