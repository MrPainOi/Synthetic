// ============================================================
// CEISA POPUP (100% Offline Local Engine)
// ============================================================

const dateInput = document.getElementById("scanDate");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const statusBadge = document.getElementById("status");
const statusText = document.getElementById("statusText");

const greenElement = document.getElementById("green");
const redElement = document.getElementById("red");
const errorElement = document.getElementById("error");
const totalElement = document.getElementById("total");

const completedNumbers = document.getElementById("completedNumbers");
const saveCompletedButton = document.getElementById("saveCompleted");

const pibPebNumbers = document.getElementById("pibPebNumbers");
const savePibPebButton = document.getElementById("savePibPeb");

const saveAllDataButton = document.getElementById("saveAllData");
const openDashboardButton = document.getElementById("openDashboard");
const clearCacheButton = document.getElementById("clearCache");

const toggleInfoBtn = document.getElementById("toggleInfoBtn");
const infoContent = document.getElementById("infoContent");
const infoArrow = document.getElementById("infoArrow");

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function setStatus(value) {
    if (statusText) statusText.textContent = value;
    if (statusBadge) statusBadge.textContent = value;
}

function updateStats(stats) {
    stats = stats || {};
    if (greenElement) greenElement.textContent = stats.green || 0;
    if (redElement) redElement.textContent = stats.red || 0;
    if (errorElement) errorElement.textContent = stats.error || 0;
    if (totalElement) totalElement.textContent = stats.total || 0;
}

function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function loadDataForDate(chosenDate) {
    const data = await storageGet(["ceisa_scan_cache", "ceisa_scan_stats"]);
    const cache = (data.ceisa_scan_cache && typeof data.ceisa_scan_cache === "object") ? data.ceisa_scan_cache : {};

    let dateGreen = 0;
    let dateRed = 0;
    let dateTotal = 0;

    for (const item of Object.values(cache)) {
        if (!item) continue;
        const itemDate = item.rowDate || (item.timestamp ? new Date(item.timestamp).toISOString().split('T')[0] : "");
        if (!chosenDate || itemDate === chosenDate) {
            dateTotal++;
            if (item.status === "green" || item.status === "yellow" || item.status === "blue" || item.status === "aqua" || item.status === "purple" || item.status === "pink") {
                dateGreen++;
            } else if (item.status === "red" || item.status === "orange") {
                dateRed++;
            }
        }
    }

    // Selalu update statistik (jika 0 items pada tanggal terpilih, reset ke 0 / kosong)
    updateStats({ green: dateGreen, red: dateRed, error: 0, total: dateTotal });
}

async function loadLastDate() {
    if (!dateInput) return;
    const data = await storageGet("ceisa_last_scan_date");
    const val = data.ceisa_last_scan_date || todayISO();
    dateInput.value = val;
    await loadDataForDate(val);
}

function syncDateFromActiveCeisaTab() {
    if (typeof chrome === "undefined" || !chrome.tabs) return;
    try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]?.id) return;
            chrome.tabs.sendMessage(tabs[0].id, { type: "GET_CEISA_PORTAL_DATE" }, async (resp) => {
                if (chrome.runtime.lastError) return;
                if (resp && resp.date && dateInput && dateInput.value !== resp.date) {
                    dateInput.value = resp.date;
                    await storageSet({ ceisa_last_scan_date: resp.date });
                    await loadDataForDate(resp.date);
                    await loadCompleted(resp.date);
                    await loadPibPeb(resp.date);
                }
            });
        });
    } catch (_) {}
}

function cleanNumberList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
            return (item.nomor_daftar || item.registrationNumber || item.nomor_dokumen || item.id || "").trim();
        }
        return String(item || "").trim();
    }).map(s => {
        const clean = s.replace(/\D/g, "");
        if (clean.length >= 1 && clean.length <= 6) {
            return clean.padStart(6, "0");
        }
        return s;
    }).filter(s => s && s !== "[object Object]" && !s.includes("[object") && !s.startsWith("PEB-USER-"));
}

function parseRegistrationNumbersFromText(text) {
    if (!text) return [];
    const rawTokens = String(text).split(/[\r\n,;]+/);
    const result = [];
    const seen = new Set();

    for (const rawToken of rawTokens) {
        const line = rawToken.trim();
        if (!line) continue;

        const parts = line.split(/\s+/);
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;

            const digits = trimmed.replace(/\D/g, "");
            if (digits.length >= 1 && digits.length <= 6) {
                const padded = digits.padStart(6, "0");
                if (!seen.has(padded)) {
                    seen.add(padded);
                    result.push(padded);
                }
            } else if (digits.length > 6) {
                const matches = trimmed.match(/\b\d{6}\b/g) || digits.match(/\d{6}/g);
                if (matches) {
                    for (const m of matches) {
                        const padded = m.padStart(6, "0");
                        if (!seen.has(padded)) {
                            seen.add(padded);
                            result.push(padded);
                        }
                    }
                }
            }
        }
    }
    return result;
}

async function loadCompleted(chosenDate) {
    if (!completedNumbers) return;
    if (document.activeElement === completedNumbers) return;
    const date = chosenDate || (dateInput ? dateInput.value : todayISO());
    const data = await storageGet([`ceisa_completed_numbers_${date}`, "ceisa_completed_numbers"]);
    const raw = Array.isArray(data[`ceisa_completed_numbers_${date}`])
        ? data[`ceisa_completed_numbers_${date}`]
        : (Array.isArray(data.ceisa_completed_numbers) && date === todayISO() ? data.ceisa_completed_numbers : []);
    const numbers = cleanNumberList(raw);
    completedNumbers.value = numbers.join("\n");
}

async function loadPibPeb(chosenDate) {
    if (!pibPebNumbers) return;
    if (document.activeElement === pibPebNumbers) return;
    const date = chosenDate || (dateInput ? dateInput.value : todayISO());
    const data = await storageGet([`ceisa_pibpeb_numbers_${date}`, "ceisa_pibpeb_numbers"]);
    const raw = Array.isArray(data[`ceisa_pibpeb_numbers_${date}`])
        ? data[`ceisa_pibpeb_numbers_${date}`]
        : (Array.isArray(data.ceisa_pibpeb_numbers) && date === todayISO() ? data.ceisa_pibpeb_numbers : []);
    const numbers = cleanNumberList(raw);
    pibPebNumbers.value = numbers.join("\n");
}

async function saveAllData() {
    const date = dateInput ? dateInput.value || todayISO() : todayISO();

    // Read both textareas synchronously up front before ANY async operations
    const rawCompleted = completedNumbers ? completedNumbers.value : "";
    const rawPibPeb = pibPebNumbers ? pibPebNumbers.value : "";

    const cleanCompleted = parseRegistrationNumbersFromText(rawCompleted);
    const cleanPibPeb = parseRegistrationNumbersFromText(rawPibPeb);

    // Update UI immediately with formatted 6-digit values
    if (completedNumbers) completedNumbers.value = cleanCompleted.join("\n");
    if (pibPebNumbers) pibPebNumbers.value = cleanPibPeb.join("\n");

    const payload = {
        ceisa_completed_numbers: cleanCompleted,
        ceisa_pibpeb_numbers: cleanPibPeb
    };
    payload[`ceisa_completed_numbers_${date}`] = cleanCompleted;
    payload[`ceisa_pibpeb_numbers_${date}`] = cleanPibPeb;

    await storageSet(payload);

    const currentData = await storageGet(["ceisa_scan_cache"]);
    const cache = (currentData.ceisa_scan_cache && typeof currentData.ceisa_scan_cache === "object")
        ? currentData.ceisa_scan_cache
        : {};

    if (typeof pushExactStateToSupabase === "function") {
        await pushExactStateToSupabase(
            cleanCompleted,
            cleanPibPeb,
            cache,
            date
        );
    } else if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(
            cleanCompleted,
            cleanPibPeb,
            cache,
            date
        );
    }

    if (typeof broadcastRefreshColor === "function") {
        await broadcastRefreshColor();
    }

    setStatus("TERSIMPAN");
    setTimeout(() => {
        if (statusText && (statusText.textContent === "TERSIMPAN" || statusText.textContent === "DATA TERSIMPAN!")) {
            setStatus("SIAP");
        }
    }, 1500);
}

const saveCompleted = saveAllData;
const savePibPeb = saveAllData;

// ============================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================

const wifiStatusBadge = document.getElementById("wifiStatusBadge");

async function checkWifiStatus() {
    if (!wifiStatusBadge) return;
    try {
        const data = await storageGet(["ceisa_supabase_status"]);
        if (data.ceisa_supabase_status === "connected") {
            wifiStatusBadge.textContent = "Terhubung";
            wifiStatusBadge.className = "wifi-status-on";
            return;
        }
        if (typeof SUPABASE_URL !== "undefined" && typeof getSupabaseHeaders === "function") {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${SUPABASE_URL}/rest/v1/ceisa_sync_state?select=date&limit=1`, {
                headers: getSupabaseHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                wifiStatusBadge.textContent = "Terhubung";
                wifiStatusBadge.className = "wifi-status-on";
                return;
            }
        }
    } catch (_) {}
    wifiStatusBadge.textContent = "Offline";
    wifiStatusBadge.className = "wifi-status-off";
}

document.addEventListener("DOMContentLoaded", async () => {
    await checkWifiStatus();
    await loadLastDate();
    await loadCompleted();
    await loadPibPeb();

    const statsData = await storageGet(["ceisa_scan_stats", "ceisa_scan_status"]);
    updateStats(statsData.ceisa_scan_stats);
    if (statsData.ceisa_scan_status) {
        setStatus(String(statsData.ceisa_scan_status).toUpperCase());
    }

    syncDateFromActiveCeisaTab();

    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === "local") {
            if (changes.ceisa_last_scan_date && changes.ceisa_last_scan_date.newValue) {
                const newDate = changes.ceisa_last_scan_date.newValue;
                if (dateInput && dateInput.value !== newDate) {
                    dateInput.value = newDate;
                    await loadDataForDate(newDate);
                    await loadCompleted(newDate);
                    await loadPibPeb(newDate);
                }
            }
            const date = dateInput ? dateInput.value || todayISO() : todayISO();
            if (changes[`ceisa_completed_numbers_${date}`] || changes.ceisa_completed_numbers) {
                loadCompleted(date);
            }
            if (changes[`ceisa_pibpeb_numbers_${date}`] || changes.ceisa_pibpeb_numbers) {
                loadPibPeb(date);
            }
            if (changes.ceisa_scan_stats) {
                updateStats(changes.ceisa_scan_stats.newValue);
            }
            if (changes.ceisa_scan_status) {
                setStatus(String(changes.ceisa_scan_status.newValue || "SIAP").toUpperCase());
            }
        }
    });
});

if (toggleInfoBtn && infoContent) {
    toggleInfoBtn.onclick = () => {
        const isHidden = infoContent.classList.toggle("hidden");
        if (infoArrow) {
            infoArrow.textContent = isHidden ? "▼" : "▲";
        }
    };
}

if (openDashboardButton) {
    openDashboardButton.onclick = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    };
}

if (saveAllDataButton) {
    saveAllDataButton.onclick = saveAllData;
}

if (saveCompletedButton) {
    saveCompletedButton.onclick = saveAllData;
}

if (savePibPebButton) {
    savePibPebButton.onclick = saveAllData;
}

if (clearCacheButton) {
    clearCacheButton.onclick = async () => {
        if (!confirm("Hapus seluruh cache scan dokumen?")) return;
        if (typeof clearAllScanCache === "function") {
            await clearAllScanCache();
        } else {
            await storageRemove("ceisa_scan_cache");
        }
        try {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });
            if (tabs[0]?.id) {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    type: "REFRESH_COLOR"
                });
            }
        } catch (_) {}
    };
}

if (dateInput) {
    dateInput.addEventListener("change", async () => {
        const val = dateInput.value;
        await storageSet({
            ceisa_last_scan_date: val
        });
        await loadDataForDate(val);
        await loadCompleted(val);
        await loadPibPeb(val);
    });
}

if (startButton) {
    startButton.onclick = async () => {
        const date = dateInput ? dateInput.value || todayISO() : todayISO();
        await storageSet({
            ceisa_scan_date: date,
            ceisa_scan_status: "running"
        });

        try {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            const tab = tabs[0];
            if (!tab || !tab.id) {
                setStatus("NO TAB");
                return;
            }

            await chrome.tabs.sendMessage(tab.id, {
                type: "START_SCAN",
                date: date
            });

            setStatus("RUNNING");
        } catch (error) {
            console.error("CEISA popup START error:", error);
            setStatus("ERROR");
        }
    };
}

if (stopButton) {
    stopButton.onclick = async () => {
        try {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            const tab = tabs[0];
            if (!tab || !tab.id) return;

            await chrome.tabs.sendMessage(tab.id, {
                type: "STOP_SCAN"
            });

            setStatus("STOPPED");
        } catch (error) {
            console.error("CEISA popup STOP error:", error);
        }
    };
}



if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(async message => {
        if (message.type === "SCAN_STATUS_UPDATE") {
            setStatus(String(message.status || "SIAP").toUpperCase());
            updateStats(message.stats);
        } else if (message.type === "CEISA_PORTAL_DATE_CHANGED" && message.date) {
            if (dateInput && dateInput.value !== message.date) {
                dateInput.value = message.date;
                await loadDataForDate(message.date);
                await loadCompleted(message.date);
                await loadPibPeb(message.date);
            }
        }
    });
}