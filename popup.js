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

function cleanNumberList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
            return (item.nomor_daftar || item.registrationNumber || item.nomor_dokumen || item.id || "").trim();
        }
        return String(item || "").trim();
    }).filter(s => s && s !== "[object Object]" && !s.includes("[object") && !s.startsWith("PEB-USER-"));
}

async function loadCompleted(chosenDate) {
    if (!completedNumbers) return;
    const date = chosenDate || (dateInput ? dateInput.value : todayISO());
    const data = await storageGet([`ceisa_completed_numbers_${date}`, "ceisa_completed_numbers"]);
    const raw = Array.isArray(data[`ceisa_completed_numbers_${date}`])
        ? data[`ceisa_completed_numbers_${date}`]
        : (Array.isArray(data.ceisa_completed_numbers) && date === todayISO() ? data.ceisa_completed_numbers : []);
    const numbers = cleanNumberList(raw);
    completedNumbers.value = numbers.join("\n");
}

async function saveCompleted() {
    if (!completedNumbers) return;
    const date = dateInput ? dateInput.value || todayISO() : todayISO();
    const values = completedNumbers.value
        .split(/[\s,;]+/)
        .map(value => value.trim())
        .filter(value => /^\d{6}$/.test(value));

    const unique = [...new Set(values)];

    const payload = {
        ceisa_completed_numbers: unique
    };
    payload[`ceisa_completed_numbers_${date}`] = unique;

    await storageSet(payload);

    completedNumbers.value = unique.join("\n");

    const currentData = await storageGet(["ceisa_pibpeb_numbers", "ceisa_scan_cache"]);
    if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(
            unique,
            currentData.ceisa_pibpeb_numbers || [],
            currentData.ceisa_scan_cache || {}
        );
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

    setStatus("TERSIMPAN");
    setTimeout(() => {
        if (statusText && statusText.textContent === "TERSIMPAN") {
            setStatus("SIAP");
        }
    }, 1200);
}

async function loadPibPeb(chosenDate) {
    if (!pibPebNumbers) return;
    const date = chosenDate || (dateInput ? dateInput.value : todayISO());
    const data = await storageGet([`ceisa_pibpeb_numbers_${date}`, "ceisa_pibpeb_numbers"]);
    const raw = Array.isArray(data[`ceisa_pibpeb_numbers_${date}`])
        ? data[`ceisa_pibpeb_numbers_${date}`]
        : (Array.isArray(data.ceisa_pibpeb_numbers) && date === todayISO() ? data.ceisa_pibpeb_numbers : []);
    const numbers = cleanNumberList(raw);
    pibPebNumbers.value = numbers.join("\n");
}

async function savePibPeb() {
    if (!pibPebNumbers) return;
    const date = dateInput ? dateInput.value || todayISO() : todayISO();
    const values = pibPebNumbers.value
        .split(/[\s,;]+/)
        .map(value => value.trim())
        .filter(value => /^\d{6}$/.test(value));

    const unique = [...new Set(values)];

    const payload = {
        ceisa_pibpeb_numbers: unique
    };
    payload[`ceisa_pibpeb_numbers_${date}`] = unique;

    await storageSet(payload);

    pibPebNumbers.value = unique.join("\n");

    const currentData = await storageGet(["ceisa_completed_numbers", "ceisa_scan_cache"]);
    if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(
            currentData.ceisa_completed_numbers || [],
            unique,
            currentData.ceisa_scan_cache || {}
        );
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

    setStatus("TERSIMPAN");
    setTimeout(() => {
        if (statusText && statusText.textContent === "TERSIMPAN") {
            setStatus("SIAP");
        }
    }, 1200);
}

// ============================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================

const wifiServerIpInput = document.getElementById("wifiServerIp");
const saveWifiIpBtn = document.getElementById("saveWifiIpBtn");
const wifiStatusBadge = document.getElementById("wifiStatusBadge");

async function checkWifiStatus() {
    if (!wifiStatusBadge) return;
    try {
        const url = await getWifiServerUrl();
        if (wifiServerIpInput && !wifiServerIpInput.value) {
            wifiServerIpInput.value = url.replace(/^https?:\/\//, "");
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${url}/api/sync`, { method: "GET", signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            wifiStatusBadge.textContent = "Terhubung";
            wifiStatusBadge.className = "wifi-status-on";
            return;
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

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
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
        }
    });
});

if (saveWifiIpBtn && wifiServerIpInput) {
    saveWifiIpBtn.onclick = async () => {
        const inputVal = wifiServerIpInput.value.trim();
        if (!inputVal) return;
        await setWifiServerUrl(inputVal);
        await checkWifiStatus();
    };
}

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

async function saveAllData() {
    await saveCompleted();
    await savePibPeb();
    setStatus("DATA TERSIMPAN!");
    setTimeout(() => {
        if (statusText && statusText.textContent === "DATA TERSIMPAN!") {
            setStatus("SIAP");
        }
    }, 1500);
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

if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(changes => {
        if (changes.ceisa_scan_status) {
            setStatus(changes.ceisa_scan_status.newValue?.toUpperCase() || "SIAP");
        }
        if (changes.ceisa_scan_stats) {
            updateStats(changes.ceisa_scan_stats.newValue);
        }
        if (changes.ceisa_completed_numbers || changes.ceisa_pibpeb_numbers) {
            loadCompleted();
            loadPibPeb();
        }
    });
}

if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(message => {
        if (message.type === "SCAN_STATUS_UPDATE") {
            setStatus(String(message.status || "SIAP").toUpperCase());
            updateStats(message.stats);
        }
    });
}