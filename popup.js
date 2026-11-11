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
    const data = await storageGet(["ceisa_last_scan_date"]);
    const targetDate = data.ceisa_last_scan_date || todayISO();
    dateInput.value = targetDate;
    await loadDataForDate(targetDate);
}

function syncDateFromActiveCeisaTab() {
    if (typeof chrome === "undefined" || !chrome.tabs) return;
    try {
        chrome.tabs.query({ url: ["*://portal.beacukai.go.id/*", "*://*.beacukai.go.id/*"] }, (tabs) => {
            if (!tabs || tabs.length === 0) return;
            const targetTab = tabs.find(t => t.active) || tabs[0];
            if (!targetTab?.id) return;
            chrome.tabs.sendMessage(targetTab.id, { type: "GET_CEISA_PORTAL_DATE" }, async (resp) => {
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
    const raw = (Array.isArray(data[`ceisa_completed_numbers_${date}`]) && data[`ceisa_completed_numbers_${date}`].length > 0)
        ? data[`ceisa_completed_numbers_${date}`]
        : (Array.isArray(data.ceisa_completed_numbers) ? data.ceisa_completed_numbers : []);
    const numbers = cleanNumberList(raw);
    completedNumbers.value = numbers.join("\n");
}

async function loadPibPeb(chosenDate) {
    if (!pibPebNumbers) return;
    if (document.activeElement === pibPebNumbers) return;
    const date = chosenDate || (dateInput ? dateInput.value : todayISO());
    const data = await storageGet([`ceisa_pibpeb_numbers_${date}`, "ceisa_pibpeb_numbers"]);
    const raw = (Array.isArray(data[`ceisa_pibpeb_numbers_${date}`]) && data[`ceisa_pibpeb_numbers_${date}`].length > 0)
        ? data[`ceisa_pibpeb_numbers_${date}`]
        : (Array.isArray(data.ceisa_pibpeb_numbers) ? data.ceisa_pibpeb_numbers : []);
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

    const payload = {};
    if (date === todayISO()) {
        payload.ceisa_completed_numbers = cleanCompleted;
        payload.ceisa_pibpeb_numbers = cleanPibPeb;
    }
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

    if (typeof loadDataForDate === "function") {
        await loadDataForDate(date);
    }

    setStatus("TERSIMPAN");
    setTimeout(() => {
        if (statusText && (statusText.textContent === "TERSIMPAN" || statusText.textContent === "DATA TERSIMPAN!")) {
            setStatus("SIAP");
        }
    }, 1500);
}

async function saveCompletedOnly() {
    const date = dateInput ? dateInput.value || todayISO() : todayISO();
    const rawCompleted = completedNumbers ? completedNumbers.value : "";
    const cleanCompleted = parseRegistrationNumbersFromText(rawCompleted);
    if (completedNumbers) completedNumbers.value = cleanCompleted.join("\n");

    const existing = await storageGet([`ceisa_pibpeb_numbers_${date}`, "ceisa_pibpeb_numbers", "ceisa_scan_cache"]);
    const currentPibPeb = cleanNumberList(existing[`ceisa_pibpeb_numbers_${date}`] || (date === todayISO() ? existing.ceisa_pibpeb_numbers : []) || []);
    const cache = (existing.ceisa_scan_cache && typeof existing.ceisa_scan_cache === "object") ? existing.ceisa_scan_cache : {};

    const payload = {};
    if (date === todayISO()) {
        payload.ceisa_completed_numbers = cleanCompleted;
    }
    payload[`ceisa_completed_numbers_${date}`] = cleanCompleted;
    await storageSet(payload);

    if (typeof pushExactStateToSupabase === "function") {
        await pushExactStateToSupabase(cleanCompleted, currentPibPeb, cache, date);
    } else if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(cleanCompleted, currentPibPeb, cache, date);
    }
    if (typeof broadcastRefreshColor === "function") {
        await broadcastRefreshColor();
    }
    if (typeof loadDataForDate === "function") {
        await loadDataForDate(date);
    }
    setStatus("TERSIMPAN");
    setTimeout(() => {
        if (statusText && (statusText.textContent === "TERSIMPAN" || statusText.textContent === "DATA TERSIMPAN!")) {
            setStatus("SIAP");
        }
    }, 1500);
}

async function savePibPebOnly() {
    const date = dateInput ? dateInput.value || todayISO() : todayISO();
    const rawPibPeb = pibPebNumbers ? pibPebNumbers.value : "";
    const cleanPibPeb = parseRegistrationNumbersFromText(rawPibPeb);
    if (pibPebNumbers) pibPebNumbers.value = cleanPibPeb.join("\n");

    const existing = await storageGet([`ceisa_completed_numbers_${date}`, "ceisa_completed_numbers", "ceisa_scan_cache"]);
    const completedList = (Array.isArray(existing[`ceisa_completed_numbers_${date}`]) && existing[`ceisa_completed_numbers_${date}`].length > 0)
        ? existing[`ceisa_completed_numbers_${date}`]
        : (Array.isArray(existing.ceisa_completed_numbers) ? existing.ceisa_completed_numbers : []);
    const currentCompleted = cleanNumberList(completedList);
    const cache = (existing.ceisa_scan_cache && typeof existing.ceisa_scan_cache === "object") ? existing.ceisa_scan_cache : {};

    const payload = {};
    if (date === todayISO()) {
        payload.ceisa_pibpeb_numbers = cleanPibPeb;
    }
    payload[`ceisa_pibpeb_numbers_${date}`] = cleanPibPeb;
    await storageSet(payload);

    if (typeof pushExactStateToSupabase === "function") {
        await pushExactStateToSupabase(currentCompleted, cleanPibPeb, cache, date);
    } else if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(currentCompleted, cleanPibPeb, cache, date);
    }
    if (typeof broadcastRefreshColor === "function") {
        await broadcastRefreshColor();
    }
    if (typeof loadDataForDate === "function") {
        await loadDataForDate(date);
    }
    setStatus("TERSIMPAN");
    setTimeout(() => {
        if (statusText && (statusText.textContent === "TERSIMPAN" || statusText.textContent === "DATA TERSIMPAN!")) {
            setStatus("SIAP");
        }
    }, 1500);
}

const saveCompleted = saveCompletedOnly;
const savePibPeb = savePibPebOnly;

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
        const scriptUrl = (typeof GOOGLE_SCRIPT_URL !== "undefined" && GOOGLE_SCRIPT_URL)
            ? GOOGLE_SCRIPT_URL
            : (typeof CEISA_CONFIG !== "undefined" ? CEISA_CONFIG.GOOGLE_SCRIPT_URL : "");
        if (scriptUrl) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(`${scriptUrl}?action=ping`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                wifiStatusBadge.textContent = "Terhubung";
                wifiStatusBadge.className = "wifi-status-on";
                await storageSet({ ceisa_supabase_status: "connected" });
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
    const activeDate = dateInput ? dateInput.value || todayISO() : todayISO();
    await loadCompleted(activeDate);
    await loadPibPeb(activeDate);

    const statsData = await storageGet(["ceisa_scan_stats", "ceisa_scan_status"]);
    updateStats(statsData.ceisa_scan_stats);
    if (statsData.ceisa_scan_status) {
        setStatus(String(statsData.ceisa_scan_status).toUpperCase());
    }

    syncDateFromActiveCeisaTab();

    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === "local") {
            if (changes.ceisa_supabase_status) {
                if (changes.ceisa_supabase_status.newValue === "connected") {
                    if (wifiStatusBadge) {
                        wifiStatusBadge.textContent = "Terhubung";
                        wifiStatusBadge.className = "wifi-status-on";
                    }
                } else if (changes.ceisa_supabase_status.newValue === "offline") {
                    if (wifiStatusBadge) {
                        wifiStatusBadge.textContent = "Offline";
                        wifiStatusBadge.className = "wifi-status-off";
                    }
                }
            }
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

if (dateInput) {
    dateInput.addEventListener("change", async () => {
        const selectedDate = dateInput.value;
        if (!selectedDate) return;
        await storageSet({ ceisa_last_scan_date: selectedDate });
        await loadDataForDate(selectedDate);
        await loadCompleted(selectedDate);
        await loadPibPeb(selectedDate);
    });
}

if (saveAllDataButton) {
    saveAllDataButton.onclick = saveAllData;
}

if (saveCompletedButton) {
    saveCompletedButton.onclick = saveCompletedOnly;
}

if (savePibPebButton) {
    savePibPebButton.onclick = savePibPebOnly;
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

// ============================================================
// POPUP VERSION DISPLAY
// ============================================================
(function initPopupVersion() {
    const versionText = document.getElementById("popupVersionText");
    if (!versionText) return;

    // 1. Ambil instan dari manifest ekstensi
    try {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest) {
            const manifest = chrome.runtime.getManifest();
            if (manifest && manifest.version) {
                versionText.textContent = "v" + manifest.version;
            }
        }
    } catch (e) {
        console.warn("Could not read manifest version", e);
    }

    // 2. Ambil dari sistem service worker jika tersedia
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: "GET_SYSTEM_VERSION" }, (res) => {
            if (chrome.runtime.lastError) return;
            if (res && res.ok && res.data && res.data.data) {
                const info = res.data.data;
                if (info.version) {
                    versionText.textContent = "v" + info.version;
                }
            }
        });
    }
})();

// ============================================================
// POPUP MODE SWITCHER & AUTO INPUT CEISA MODULE
// ============================================================
(function initPopupAutoInput() {
    const btnModeScanner = document.getElementById("btnModeScanner");
    const btnModeAutoInput = document.getElementById("btnModeAutoInput");
    const viewScanner = document.getElementById("viewScanner");
    const viewAutoInput = document.getElementById("viewAutoInput");

    if (!btnModeScanner || !btnModeAutoInput || !viewScanner || !viewAutoInput) return;

    // 1. Tab Switching Function
    function switchMode(mode) {
        if (mode === 'autoinput') {
            btnModeAutoInput.classList.add('active');
            btnModeAutoInput.setAttribute('aria-selected', 'true');
            btnModeScanner.classList.remove('active');
            btnModeScanner.setAttribute('aria-selected', 'false');
            viewScanner.style.display = 'none';
            viewAutoInput.style.display = 'flex';
            checkCeisaPortalTab();
            if (!currentDraft) {
                loadLatestDraftAuto();
            }
        } else {
            btnModeScanner.classList.add('active');
            btnModeScanner.setAttribute('aria-selected', 'true');
            btnModeAutoInput.classList.remove('active');
            btnModeAutoInput.setAttribute('aria-selected', 'false');
            viewScanner.style.display = 'flex';
            viewAutoInput.style.display = 'none';
        }
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ popup_active_tab: mode }).catch(() => {});
        }
    }

    btnModeScanner.addEventListener('click', () => switchMode('scanner'));
    btnModeAutoInput.addEventListener('click', () => switchMode('autoinput'));

    // Restore last active mode from storage
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("popup_active_tab").then(res => {
            if (res && res.popup_active_tab === 'autoinput') {
                switchMode('autoinput');
            }
        }).catch(() => {});
    }

    // 2. CEISA Portal Tab Detection & Focus
    const portalDot = document.getElementById("ceisaPortalDot");
    const portalText = document.getElementById("ceisaPortalText");
    const btnFocusCeisaTab = document.getElementById("btnFocusCeisaTab");

    let activeCeisaTab = null;

    async function checkCeisaPortalTab() {
        if (typeof chrome === "undefined" || !chrome.tabs) return;
        try {
            const tabs = await chrome.tabs.query({ url: ["*://portal.beacukai.go.id/*", "*://*.beacukai.go.id/*"] });
            if (tabs && tabs.length > 0) {
                activeCeisaTab = tabs.find(t => t.active) || tabs[0];
                if (portalDot) {
                    portalDot.classList.remove("dot-offline");
                }
                if (portalText) {
                    portalText.textContent = "CEISA 4.0 Terdeteksi (" + (tabs[0].title ? tabs[0].title.slice(0, 20) + "..." : "Aktif") + ")";
                }
                if (btnFocusCeisaTab) {
                    btnFocusCeisaTab.textContent = "Buka Tab";
                }
                appendLog("Terhubung ke tab CEISA 4.0 (ID: " + activeCeisaTab.id + ").", "log-success");
                queryActiveCeisaSection();
            } else {
                activeCeisaTab = null;
                if (portalDot) {
                    portalDot.classList.add("dot-offline");
                }
                if (portalText) {
                    portalText.textContent = "Tab CEISA 4.0 Belum Dibuka";
                }
                if (btnFocusCeisaTab) {
                    btnFocusCeisaTab.textContent = "Buka CEISA";
                }
                appendLog("Tab portal.beacukai.go.id belum dibuka.", "log-warn");
            }
        } catch (e) {
            console.warn("Could not check CEISA tabs", e);
        }
    }

    if (btnFocusCeisaTab) {
        btnFocusCeisaTab.addEventListener('click', async () => {
            if (activeCeisaTab?.id) {
                chrome.tabs.update(activeCeisaTab.id, { active: true });
                if (activeCeisaTab.windowId) {
                    chrome.windows.update(activeCeisaTab.windowId, { focused: true });
                }
            } else {
                chrome.tabs.create({ url: "https://portal.beacukai.go.id" });
            }
        });
    }

    // 3. Draft State & Selection
    let currentDraft = null;
    let currentDraftType = 'impor'; // 'impor' (PIB) or 'ekspor' (PEB)
    let currentSection = 'entitas';
    let currentItemIndex = 0;
    let isAutoLoopRunning = false;

    const btnSelectTypePib = document.getElementById("btnSelectTypePib");
    const btnSelectTypePeb = document.getElementById("btnSelectTypePeb");
    const btnLoadLatestDraft = document.getElementById("btnLoadLatestDraft");
    const autoInputJsonFile = document.getElementById("autoInputJsonFile");

    if (btnSelectTypePib && btnSelectTypePeb) {
        btnSelectTypePib.addEventListener('click', () => {
            btnSelectTypePib.classList.add('active');
            btnSelectTypePeb.classList.remove('active');
            currentDraftType = 'impor';
            loadLatestDraftAuto();
        });
        btnSelectTypePeb.addEventListener('click', () => {
            btnSelectTypePeb.classList.add('active');
            btnSelectTypePib.classList.remove('active');
            currentDraftType = 'ekspor';
            loadLatestDraftAuto();
        });
    }

    // Load Draft from Backend or Storage
    async function loadLatestDraftAuto() {
        appendLog(`Memuat draft terbaru (${currentDraftType.toUpperCase()})...`, "log-info");
        try {
            const resp = await fetch(`http://localhost:5005/api/get-latest-draft?mode=${currentDraftType}`);
            if (resp.ok) {
                const draft = await resp.json();
                if (draft && typeof draft === 'object' && (draft.invoiceNumber || draft.nomorAju || draft.invoices)) {
                    setDraftData(draft);
                    appendLog(`Draft berhasil dimuat dari sistem lokal!`, "log-success");
                    return;
                }
            }
        } catch (_) {}

        // Fallback to chrome.storage
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            const storageKey = currentDraftType === 'impor' ? 'ceisa_pib_draft' : 'ceisa_peb_draft';
            const data = await chrome.storage.local.get(storageKey);
            if (data[storageKey]) {
                setDraftData(data[storageKey]);
                appendLog(`Draft berhasil dimuat dari memori browser.`, "log-success");
                return;
            }
        }

        appendLog(`Belum ada draft ${currentDraftType.toUpperCase()} aktif. Buka Web Dashboard atau unggah file JSON.`, "log-warn");
    }

    if (btnLoadLatestDraft) {
        btnLoadLatestDraft.addEventListener('click', () => loadLatestDraftAuto());
    }

    // Load JSON via File Upload
    if (autoInputJsonFile) {
        autoInputJsonFile.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    setDraftData(parsed);
                    appendLog(`Berkas '${file.name}' berhasil dimuat!`, "log-success");
                } catch (err) {
                    appendLog(`Format JSON tidak valid: ${err.message}`, "log-err");
                }
            };
            reader.readAsText(file);
        });
    }

    // Render Draft Summary
    function setDraftData(draft) {
        currentDraft = draft;
        currentItemIndex = 0;

        const lblDraftBadge = document.getElementById("lblDraftBadge");
        const lblDraftAjuNo = document.getElementById("lblDraftAjuNo");
        const lblDraftShipper = document.getElementById("lblDraftShipper");
        const lblDraftConsignee = document.getElementById("lblDraftConsignee");
        const lblDraftDocCount = document.getElementById("lblDraftDocCount");
        const lblDraftItemCount = document.getElementById("lblDraftItemCount");
        const lblDraftValuta = document.getElementById("lblDraftValuta");

        const isPib = currentDraftType === 'impor';
        if (lblDraftBadge) {
            lblDraftBadge.textContent = isPib ? "PIB" : "PEB";
            lblDraftBadge.className = isPib ? "ai-doc-badge draft-badge bg-pib" : "ai-doc-badge draft-badge bg-peb";
        }

        if (lblDraftAjuNo) {
            lblDraftAjuNo.textContent = draft.nomorAju || draft.noAju || (draft.invoices?.[0]?.invoiceNumber ? `Draft Inv #${draft.invoices[0].invoiceNumber}` : "Draft Tanpa Nomor Aju");
        }

        if (lblDraftShipper) {
            lblDraftShipper.textContent = draft.shipperName || draft.supplierName || draft.eksportirNama || "-";
        }

        if (lblDraftConsignee) {
            lblDraftConsignee.textContent = draft.consigneeName || draft.importirName || draft.pembeliNama || "-";
        }

        const docItems = getSectionItems('dokumen');
        const itemRows = getSectionItems('barang');

        if (lblDraftDocCount) lblDraftDocCount.textContent = docItems.length;
        if (lblDraftItemCount) lblDraftItemCount.textContent = itemRows.length;
        if (lblDraftValuta) lblDraftValuta.textContent = draft.currency || draft.valuta || "USD";

        updateSectionUI();
    }

    // --------------------------------------------------------
    // AUTO-FILL TOGGLE CONFIGURATION MODULE
    // --------------------------------------------------------
    const DEFAULT_AUTOFILL_CONFIG = {
        header: true,
        entitas: {
            enabled: true,
            pengirim: true,
            penerima: true,
            pembeli: true,
            penjual: true,
            pemilik: true,
            ppjk: false
        },
        dokumen: true,
        pengangkut: true,
        kemasan: true,
        transaksi: true,
        barang: true,
        pungutan: false,
        pernyataan: true
    };

    let currentAutofillConfig = JSON.parse(JSON.stringify(DEFAULT_AUTOFILL_CONFIG));

    const btnToggleAfCollapse = document.getElementById("btnToggleAfCollapse");
    const afConfigBody = document.getElementById("afConfigBody");
    const iconAfChevron = document.getElementById("iconAfChevron");
    const lblAfActiveCount = document.getElementById("lblAfActiveCount");
    const btnAfSelectAll = document.getElementById("btnAfSelectAll");
    const btnAfResetDefault = document.getElementById("btnAfResetDefault");
    const afSubGroupEntitas = document.getElementById("afSubGroupEntitas");

    const afToggles = {
        header: document.getElementById("afToggle_header"),
        entitas: document.getElementById("afToggle_entitas"),
        entitas_pengirim: document.getElementById("afToggle_entitas_pengirim"),
        entitas_penerima: document.getElementById("afToggle_entitas_penerima"),
        entitas_pembeli: document.getElementById("afToggle_entitas_pembeli"),
        entitas_penjual: document.getElementById("afToggle_entitas_penjual"),
        entitas_pemilik: document.getElementById("afToggle_entitas_pemilik"),
        entitas_ppjk: document.getElementById("afToggle_entitas_ppjk"),
        dokumen: document.getElementById("afToggle_dokumen"),
        pengangkut: document.getElementById("afToggle_pengangkut"),
        kemasan: document.getElementById("afToggle_kemasan"),
        transaksi: document.getElementById("afToggle_transaksi"),
        barang: document.getElementById("afToggle_barang"),
        pungutan: document.getElementById("afToggle_pungutan"),
        pernyataan: document.getElementById("afToggle_pernyataan")
    };

    function updateAutofillConfigUI() {
        if (!afToggles.header) return;

        afToggles.header.checked = currentAutofillConfig.header !== false;

        const ent = currentAutofillConfig.entitas || {};
        const isEntEnabled = typeof currentAutofillConfig.entitas === 'object' ? currentAutofillConfig.entitas.enabled !== false : currentAutofillConfig.entitas !== false;
        if (afToggles.entitas) afToggles.entitas.checked = isEntEnabled;

        if (afSubGroupEntitas) {
            if (isEntEnabled) {
                afSubGroupEntitas.classList.remove('is-disabled');
            } else {
                afSubGroupEntitas.classList.add('is-disabled');
            }
        }

        if (afToggles.entitas_pengirim) afToggles.entitas_pengirim.checked = ent.pengirim !== false;
        if (afToggles.entitas_penerima) afToggles.entitas_penerima.checked = ent.penerima !== false;
        if (afToggles.entitas_pembeli) afToggles.entitas_pembeli.checked = ent.pembeli !== false;
        if (afToggles.entitas_penjual) afToggles.entitas_penjual.checked = ent.penjual !== false;
        if (afToggles.entitas_pemilik) afToggles.entitas_pemilik.checked = ent.pemilik !== false;
        if (afToggles.entitas_ppjk) afToggles.entitas_ppjk.checked = ent.ppjk === true;

        if (afToggles.dokumen) afToggles.dokumen.checked = currentAutofillConfig.dokumen !== false;
        if (afToggles.pengangkut) afToggles.pengangkut.checked = currentAutofillConfig.pengangkut !== false;
        if (afToggles.kemasan) afToggles.kemasan.checked = currentAutofillConfig.kemasan !== false;
        if (afToggles.transaksi) afToggles.transaksi.checked = currentAutofillConfig.transaksi !== false;
        if (afToggles.barang) afToggles.barang.checked = currentAutofillConfig.barang !== false;
        if (afToggles.pungutan) afToggles.pungutan.checked = currentAutofillConfig.pungutan === true;
        if (afToggles.pernyataan) afToggles.pernyataan.checked = currentAutofillConfig.pernyataan !== false;

        const mainSections = ['header', 'entitas', 'dokumen', 'pengangkut', 'kemasan', 'transaksi', 'barang', 'pungutan', 'pernyataan'];
        let activeCount = 0;
        mainSections.forEach(sec => {
            if (sec === 'entitas') {
                if (isEntEnabled) activeCount++;
            } else if (sec === 'pungutan') {
                if (currentAutofillConfig.pungutan === true) activeCount++;
            } else {
                if (currentAutofillConfig[sec] !== false) activeCount++;
            }
        });

        if (lblAfActiveCount) {
            lblAfActiveCount.textContent = `${activeCount} / 9 Aktif`;
        }
    }

    function readAutofillConfigFromUI() {
        currentAutofillConfig = {
            header: afToggles.header ? afToggles.header.checked : true,
            entitas: {
                enabled: afToggles.entitas ? afToggles.entitas.checked : true,
                pengirim: afToggles.entitas_pengirim ? afToggles.entitas_pengirim.checked : true,
                penerima: afToggles.entitas_penerima ? afToggles.entitas_penerima.checked : true,
                pembeli: afToggles.entitas_pembeli ? afToggles.entitas_pembeli.checked : true,
                penjual: afToggles.entitas_penjual ? afToggles.entitas_penjual.checked : true,
                pemilik: afToggles.entitas_pemilik ? afToggles.entitas_pemilik.checked : true,
                ppjk: afToggles.entitas_ppjk ? afToggles.entitas_ppjk.checked : false
            },
            dokumen: afToggles.dokumen ? afToggles.dokumen.checked : true,
            pengangkut: afToggles.pengangkut ? afToggles.pengangkut.checked : true,
            kemasan: afToggles.kemasan ? afToggles.kemasan.checked : true,
            transaksi: afToggles.transaksi ? afToggles.transaksi.checked : true,
            barang: afToggles.barang ? afToggles.barang.checked : true,
            pungutan: afToggles.pungutan ? afToggles.pungutan.checked : false,
            pernyataan: afToggles.pernyataan ? afToggles.pernyataan.checked : true
        };
        saveAutofillConfig();
        updateAutofillConfigUI();
    }

    function saveAutofillConfig() {
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ ceisa_autofill_config: currentAutofillConfig }).catch(() => {});
            }
            localStorage.setItem("ceisa_autofill_config", JSON.stringify(currentAutofillConfig));
        } catch (e) {
            console.warn("Gagal menyimpan preferensi auto-fill:", e);
        }
    }

    function loadAutofillConfig() {
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get("ceisa_autofill_config", (res) => {
                    if (res && res.ceisa_autofill_config) {
                        currentAutofillConfig = Object.assign({}, DEFAULT_AUTOFILL_CONFIG, res.ceisa_autofill_config);
                        if (res.ceisa_autofill_config.entitas) {
                            currentAutofillConfig.entitas = Object.assign({}, DEFAULT_AUTOFILL_CONFIG.entitas, res.ceisa_autofill_config.entitas);
                        }
                    } else {
                        const localSaved = localStorage.getItem("ceisa_autofill_config");
                        if (localSaved) {
                            const parsed = JSON.parse(localSaved);
                            currentAutofillConfig = Object.assign({}, DEFAULT_AUTOFILL_CONFIG, parsed);
                            if (parsed.entitas) {
                                currentAutofillConfig.entitas = Object.assign({}, DEFAULT_AUTOFILL_CONFIG.entitas, parsed.entitas);
                            }
                        }
                    }
                    updateAutofillConfigUI();
                });
            } else {
                const localSaved = localStorage.getItem("ceisa_autofill_config");
                if (localSaved) {
                    const parsed = JSON.parse(localSaved);
                    currentAutofillConfig = Object.assign({}, DEFAULT_AUTOFILL_CONFIG, parsed);
                    if (parsed.entitas) {
                        currentAutofillConfig.entitas = Object.assign({}, DEFAULT_AUTOFILL_CONFIG.entitas, parsed.entitas);
                    }
                }
                updateAutofillConfigUI();
            }
        } catch (e) {
            updateAutofillConfigUI();
        }
    }

    if (btnToggleAfCollapse && afConfigBody) {
        btnToggleAfCollapse.addEventListener('click', () => {
            const isHidden = afConfigBody.style.display === 'none';
            afConfigBody.style.display = isHidden ? 'flex' : 'none';
            if (iconAfChevron) {
                iconAfChevron.textContent = isHidden ? '▴' : '▾';
            }
        });
    }

    Object.values(afToggles).forEach(input => {
        if (input) {
            input.addEventListener('change', () => {
                readAutofillConfigFromUI();
            });
        }
    });

    if (btnAfSelectAll) {
        btnAfSelectAll.addEventListener('click', () => {
            currentAutofillConfig = {
                header: true,
                entitas: {
                    enabled: true,
                    pengirim: true,
                    penerima: true,
                    pembeli: true,
                    penjual: true,
                    pemilik: true,
                    ppjk: true
                },
                dokumen: true,
                pengangkut: true,
                kemasan: true,
                transaksi: true,
                barang: true,
                pungutan: true,
                pernyataan: true
            };
            saveAutofillConfig();
            updateAutofillConfigUI();
            appendLog("Semua opsi auto-fill diaktifkan (Termasuk PPJK & Pungutan).", "log-info");
        });
    }

    if (btnAfResetDefault) {
        btnAfResetDefault.addEventListener('click', () => {
            currentAutofillConfig = JSON.parse(JSON.stringify(DEFAULT_AUTOFILL_CONFIG));
            saveAutofillConfig();
            updateAutofillConfigUI();
            appendLog("Opsi auto-fill dikembalikan ke default (PPJK & Pungutan Manual).", "log-info");
        });
    }

    loadAutofillConfig();

    // Extract Items for Section
    function getSectionItems(section) {
        if (!currentDraft) return [];

        if (section === 'dokumen') {
            const list = [];
            // BL
            if (currentDraft.blNumber && currentDraft.blNumber !== 'null') {
                list.push({ type: 'BL', code: '705', name: 'Bill of Lading', number: currentDraft.blNumber, date: currentDraft.blDate || '' });
            }
            // Invoices
            if (Array.isArray(currentDraft.invoices) && currentDraft.invoices.length > 0) {
                currentDraft.invoices.forEach(inv => {
                    list.push({ type: 'INVOICE', code: '380', name: 'Commercial Invoice', number: inv.invoiceNumber, date: inv.invoiceDate || currentDraft.invoiceDate || '', amount: inv.amount, currency: inv.currency });
                });
            } else if (currentDraft.invoiceNumber && currentDraft.invoiceNumber !== 'null') {
                const parts = String(currentDraft.invoiceNumber).split(',').map(s => s.trim()).filter(Boolean);
                parts.forEach(p => {
                    list.push({ type: 'INVOICE', code: '380', name: 'Commercial Invoice', number: p, date: currentDraft.invoiceDate || '' });
                });
            }
            // Packing List
            if (currentDraft.packingListNumber && currentDraft.packingListNumber !== 'null') {
                const parts = String(currentDraft.packingListNumber).split(',').map(s => s.trim()).filter(Boolean);
                parts.forEach(p => {
                    list.push({ type: 'PACKING_LIST', code: '217', name: 'Packing List', number: p, date: currentDraft.packingListDate || currentDraft.invoiceDate || '' });
                });
            }
            // COO
            if (currentDraft.cooNumber && currentDraft.cooNumber !== 'null') {
                list.push({ type: 'COO', code: '861', name: 'Certificate of Origin', number: currentDraft.cooNumber, date: currentDraft.cooDate || '' });
            }
            return list;
        }

        if (section === 'barang') {
            return Array.isArray(currentDraft.items) ? currentDraft.items : [];
        }

        // Single object sections (header, entitas, pengangkut, kemasan, transaksi, pungutan, pernyataan)
        return [currentDraft];
    }

    // --------------------------------------------------------
    // REAL-TIME CEISA ACTIVE TAB AUTO-SYNC
    // --------------------------------------------------------
    function applyActiveSectionFromCeisa(newSec) {
        if (!newSec || isAutoLoopRunning) return;
        const validSections = ['header', 'entitas', 'dokumen', 'pengangkut', 'kemasan', 'transaksi', 'barang', 'pungutan', 'pernyataan'];
        if (!validSections.includes(newSec)) return;

        if (newSec === currentSection && sectionSelect && sectionSelect.value === newSec) return;

        currentSection = newSec;
        if (sectionSelect) {
            sectionSelect.value = newSec;
        }
        currentItemIndex = 0;
        updateSectionUI();

        const syncBadge = document.getElementById("lblCeisaAutoSyncBadge");
        if (syncBadge) {
            syncBadge.classList.add("synced-active");
            setTimeout(() => {
                if (syncBadge) syncBadge.classList.remove("synced-active");
            }, 1000);
        }
    }

    function queryActiveCeisaSection() {
        if (!activeCeisaTab?.id) return;
        try {
            chrome.tabs.sendMessage(activeCeisaTab.id, { type: "GET_CEISA_ACTIVE_TAB" }, (res) => {
                if (chrome.runtime?.lastError) return;
                if (res && res.ok && res.activeSection) {
                    applyActiveSectionFromCeisa(res.activeSection);
                }
            });
        } catch (_) {}
    }

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg && msg.type === "CEISA_ACTIVE_TAB_CHANGED" && msg.activeSection) {
                applyActiveSectionFromCeisa(msg.activeSection);
            }
        });
    }

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("ceisa_current_active_tab", (res) => {
            if (res && res.ceisa_current_active_tab) {
                applyActiveSectionFromCeisa(res.ceisa_current_active_tab);
            }
        });
        if (chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === "local" && changes.ceisa_current_active_tab?.newValue) {
                    applyActiveSectionFromCeisa(changes.ceisa_current_active_tab.newValue);
                }
            });
        }
    }

    // Auto-polling interval to keep popup in sync with CEISA portal tab state
    setInterval(() => {
        if (!isAutoLoopRunning && viewAutoInput && viewAutoInput.style.display !== 'none') {
            if (activeCeisaTab?.id) {
                queryActiveCeisaSection();
            } else {
                checkCeisaPortalTab();
            }
        }
    }, 1500);

    // Section Selector Listener (Manual Selection + Bidirectional Tab Switch)
    const sectionSelect = document.getElementById("autoInputSectionSelect");
    if (sectionSelect) {
        sectionSelect.addEventListener('change', () => {
            currentSection = sectionSelect.value;
            currentItemIndex = 0;
            updateSectionUI();

            // Bidirectional: also switch tab on portal CEISA if connected
            if (activeCeisaTab?.id) {
                chrome.tabs.sendMessage(activeCeisaTab.id, {
                    type: "CEISA_SWITCH_TAB",
                    section: currentSection
                }, () => {
                    if (chrome.runtime?.lastError) {}
                });
            }
        });
    }

    // Update Stepper & Preview UI
    function updateSectionUI() {
        const items = getSectionItems(currentSection);
        const total = items.length;

        const lblStepperIndex = document.getElementById("lblStepperIndex");
        const lblItemPreviewTitle = document.getElementById("lblItemPreviewTitle");
        const lblItemPreviewDesc = document.getElementById("lblItemPreviewDesc");
        const btnStepPrev = document.getElementById("btnStepPrev");
        const lblBtnInjectText = document.getElementById("lblBtnInjectText");

        if (total === 0) {
            if (lblStepperIndex) lblStepperIndex.textContent = "0 / 0";
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = "Tidak Ada Data";
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = "Bagian ini tidak memiliki baris data pada draft terpilih.";
            if (btnStepPrev) btnStepPrev.disabled = true;
            if (lblBtnInjectText) lblBtnInjectText.textContent = "Tidak Ada Data";
            return;
        }

        if (currentItemIndex < 0) currentItemIndex = 0;
        if (currentItemIndex >= total) currentItemIndex = total - 1;

        if (lblStepperIndex) lblStepperIndex.textContent = `${currentItemIndex + 1} / ${total}`;
        if (btnStepPrev) btnStepPrev.disabled = (currentItemIndex === 0);

        const curr = items[currentItemIndex];

        if (currentSection === 'header') {
            const noAju = curr.nomorAju || curr.noAju || '-';
            const kantor = curr.kantorPabean || curr.kodeKantor || 'KPU BATAM';
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `1. Header: ${noAju}`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Kantor: ${kantor} • Jenis: ${curr.jenisPemasukan || '01 - DARI LDP'}`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Masukkan Data Header ke CEISA ▶`;
        } else if (currentSection === 'entitas') {
            const shp = curr.shipperName || curr.supplierName || curr.eksportirNama || 'Pemasok Luar Negeri';
            const csg = curr.consigneeName || curr.importirName || curr.pembeliNama || 'Importir Indonesia';
            const ppjkNotice = currentAutofillConfig.entitas?.ppjk ? '(PPJK Auto-Fill ON)' : '(PPJK Manual)';
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `2. Entitas: ${shp.slice(0, 20)} ➔ ${csg.slice(0, 20)}`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Importir: ${csg} • Pemasok: ${shp} ${ppjkNotice}`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Masukkan Data Entitas ke CEISA ▶`;
        } else if (currentSection === 'dokumen') {
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `[${curr.code || '380'}] ${curr.name || 'Dokumen'} #${curr.number || '-'}`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Tgl: ${curr.date || '-'} ${curr.amount ? '• Nilai: ' + (curr.currency || '') + ' ' + curr.amount : ''}`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Input Dokumen #${curr.number || currentItemIndex + 1} & Lanjut ▶`;
        } else if (currentSection === 'pengangkut') {
            const dPort = curr.portDischarge || curr.dischargePort || 'BATAM';
            const lPort = curr.portLoading || curr.loadingPort || '-';
            const vName = curr.vesselName || curr.namaSaranaPengangkut || curr.caraPengangkutan || 'Sarana Pengangkut';
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `4. Pengangkut: ${vName}`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Pelabuhan Bongkar: ${dPort} • Pelabuhan Muat: ${lPort}`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Masukkan Data Pengangkut ke CEISA ▶`;
        } else if (currentSection === 'kemasan') {
            const kemasan = curr.totalKemasan || (curr.packageQty ? `${curr.packageQty} ${curr.packageType || 'Colli'}` : 'Multiple Colli / Karton');
            const bruto = curr.grossWeight || curr.totalGrossWeightKGM || '-';
            const netto = curr.netWeight || curr.totalNetWeightKGM || '-';
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `5. Kemasan & Peti Kemas`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Kemasan: ${kemasan} • Bruto: ${bruto} Kg • Netto: ${netto} Kg`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Masukkan Data Kemasan ke CEISA ▶`;
        } else if (currentSection === 'transaksi') {
            const valuta = curr.currency || curr.valuta || 'USD';
            const invAmt = curr.invoiceAmount || curr.amount || '0';
            const incoterm = curr.incoterm || 'FOB';
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `6. Transaksi: ${incoterm} ${valuta} ${invAmt}`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Valuta: ${valuta} • Nilai: ${invAmt} • Cara Bayar: TUNAI/BIASA`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Masukkan Data Transaksi ke CEISA ▶`;
        } else if (currentSection === 'barang') {
            const hs = curr.hsCode || curr.posTarif || 'Pos Tarif';
            const desc = curr.uraianJenisBarang || curr.description || curr.namaBarang || 'Barang';
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `[HS ${hs}] ${desc}`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Jumlah: ${curr.jumlahDanSatuanBarang || curr.quantity || '-'} • Kemasan: ${curr.kemasan || '-'} • Nilai: ${curr.amount || curr.cifUsd || curr.cifValue || '-'}`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Input Barang #${currentItemIndex + 1} & Lanjut ▶`;
        } else if (currentSection === 'pungutan') {
            const cifIdr = curr.nilaiPabeanIdr || curr.cifValueIdr || curr.cifRupiah || '-';
            const billing = curr.totalBilling || curr.totalPungutan || '-';
            const pgtNotice = currentAutofillConfig.pungutan ? '(Pungutan Auto-Fill ON)' : '(Pungutan Manual)';
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `8. Pungutan: Billing Rp ${billing}`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Nilai Pabean: Rp ${cifIdr} • ${pgtNotice}`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Masukkan Data Pungutan ke CEISA ▶`;
        } else if (currentSection === 'pernyataan') {
            const nama = curr.pernyataanNama || 'HENDRA WIJAYA';
            const kota = curr.pernyataanKota || 'Jakarta Utara';
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `9. Pernyataan: ${nama} (${kota})`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Pernyataan kebenaran data & kesanggupan kepabeanan`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Masukkan Data Pernyataan ke CEISA ▶`;
        } else {
            if (lblItemPreviewTitle) lblItemPreviewTitle.textContent = `Bagian: ${currentSection.toUpperCase()}`;
            if (lblItemPreviewDesc) lblItemPreviewDesc.textContent = `Data siap dimasukkan ke formulir CEISA.`;
            if (lblBtnInjectText) lblBtnInjectText.textContent = `Masukkan Data Bagian Ini ▶`;
        }
    }

    // Step Navigation Handlers
    const btnStepPrev = document.getElementById("btnStepPrev");
    const btnStepInject = document.getElementById("btnStepInject");

    if (btnStepPrev) {
        btnStepPrev.addEventListener('click', () => {
            if (currentItemIndex > 0) {
                currentItemIndex--;
                updateSectionUI();
            }
        });
    }

    // Manual Step-by-Step Injection
    async function injectCurrentStep(advanceAfter = true) {
        const items = getSectionItems(currentSection);
        if (!items || items.length === 0) {
            appendLog("Tidak ada data untuk diinput.", "log-warn");
            return;
        }

        const currItem = items[currentItemIndex];
        await checkCeisaPortalTab();

        if (!activeCeisaTab?.id) {
            appendLog("Gagal: Tab portal CEISA 4.0 tidak ditemukan. Klik 'Buka CEISA'.", "log-err");
            return;
        }

        appendLog(`Mengirim baris ${currentItemIndex + 1}/${items.length} ke tab CEISA...`, "log-info");

        try {
            chrome.tabs.sendMessage(activeCeisaTab.id, {
                type: "CEISA_AUTO_INPUT_ROW",
                section: currentSection,
                draftType: currentDraftType,
                item: currItem,
                index: currentItemIndex,
                total: items.length,
                autofillConfig: currentAutofillConfig
            }, (res) => {
                if (chrome.runtime.lastError) {
                    appendLog(`Error: ${chrome.runtime.lastError.message}`, "log-err");
                    return;
                }
                if (res && res.skipped) {
                    appendLog(`[LEWATI] ${res.message || 'Bagian dilewati sesuai toggle.'}`, "log-info");
                    return;
                }
                if (res && res.ok) {
                    appendLog(`[SUKSES] ${res.message || 'Baris berhasil diinput ke CEISA!'}`, "log-success");
                    if (advanceAfter && currentItemIndex < items.length - 1) {
                        currentItemIndex++;
                        updateSectionUI();
                    }
                } else {
                    appendLog(`[PERINGATAN] ${(res && res.message) || 'Halaman CEISA belum siap atau field tidak ditemukan.'}`, "log-warn");
                }
            });
        } catch (e) {
            appendLog(`Kesalahan komunikasi: ${e.message}`, "log-err");
        }
    }

    if (btnStepInject) {
        btnStepInject.addEventListener('click', () => injectCurrentStep(true));
    }

    // Fill Whole Active Section
    const btnFillActiveSection = document.getElementById("btnFillActiveSection");
    if (btnFillActiveSection) {
        btnFillActiveSection.addEventListener('click', async () => {
            const isSecEnabled = (sec) => {
                if (sec === 'entitas') {
                    return currentAutofillConfig.entitas && (typeof currentAutofillConfig.entitas === 'object' ? currentAutofillConfig.entitas.enabled !== false : currentAutofillConfig.entitas !== false);
                }
                if (sec === 'pungutan') {
                    return currentAutofillConfig.pungutan === true;
                }
                return currentAutofillConfig[sec] !== false;
            };

            if (!isSecEnabled(currentSection)) {
                appendLog(`Bagian '${currentSection.toUpperCase()}' sedang dinonaktifkan di toggle. Aktifkan toggle jika ingin mengisinya.`, "log-warn");
                return;
            }

            const items = getSectionItems(currentSection);
            if (!items || items.length === 0) {
                appendLog("Tidak ada data untuk diinput.", "log-warn");
                return;
            }
            appendLog(`Mengisi seluruh bagian '${currentSection}' (${items.length} data)...`, "log-info");
            for (let i = 0; i < items.length; i++) {
                currentItemIndex = i;
                updateSectionUI();
                await injectCurrentStep(false);
                await new Promise(r => setTimeout(r, 600)); // safe delay
            }
            appendLog(`Pengisian seluruh bagian '${currentSection}' selesai!`, "log-success");
        });
    }

    // Auto Input All (Continuous Loop across Active Sections)
    const btnAutoInputAll = document.getElementById("btnAutoInputAll");
    if (btnAutoInputAll) {
        btnAutoInputAll.addEventListener('click', async () => {
            if (isAutoLoopRunning) {
                isAutoLoopRunning = false;
                btnAutoInputAll.classList.remove('running');
                btnAutoInputAll.textContent = "🚀 Auto Input Berurutan";
                appendLog("Proses auto input dihentikan oleh pengguna.", "log-warn");
                return;
            }

            const ALL_SECTIONS = ['header', 'entitas', 'dokumen', 'pengangkut', 'kemasan', 'transaksi', 'barang', 'pungutan', 'pernyataan'];
            const isSecEnabled = (sec) => {
                if (sec === 'entitas') {
                    return currentAutofillConfig.entitas && (typeof currentAutofillConfig.entitas === 'object' ? currentAutofillConfig.entitas.enabled !== false : currentAutofillConfig.entitas !== false);
                }
                if (sec === 'pungutan') {
                    return currentAutofillConfig.pungutan === true;
                }
                return currentAutofillConfig[sec] !== false;
            };

            const activeSections = ALL_SECTIONS.filter(isSecEnabled);

            if (activeSections.length === 0) {
                appendLog("Semua opsi auto-fill dinonaktifkan dalam toggle. Aktifkan minimal satu bagian untuk memulai auto input.", "log-warn");
                return;
            }

            const startSecIdx = activeSections.indexOf(currentSection);
            const sectionsToProcess = startSecIdx !== -1 ? activeSections.slice(startSecIdx) : activeSections;

            isAutoLoopRunning = true;
            btnAutoInputAll.classList.add('running');
            btnAutoInputAll.textContent = "⏹ Hentikan";
            appendLog(`Memulai Auto Input berurutan (${sectionsToProcess.join(' ➔ ')})...`, "log-info");

            for (let s = 0; s < sectionsToProcess.length; s++) {
                if (!isAutoLoopRunning) break;
                currentSection = sectionsToProcess[s];
                if (sectionSelect) sectionSelect.value = currentSection;

                const items = getSectionItems(currentSection);
                if (!items || items.length === 0) continue;

                appendLog(`[Auto Input] Memproses Bagian: ${currentSection.toUpperCase()} (${items.length} data)...`, "log-info");

                const startIdx = (s === 0) ? currentItemIndex : 0;
                for (let i = startIdx; i < items.length; i++) {
                    if (!isAutoLoopRunning) break;
                    currentItemIndex = i;
                    updateSectionUI();
                    await injectCurrentStep(false);
                    await new Promise(r => setTimeout(r, 800)); // safe delay
                }

                if (isAutoLoopRunning) {
                    await new Promise(r => setTimeout(r, 400));
                }
            }

            isAutoLoopRunning = false;
            btnAutoInputAll.classList.remove('running');
            btnAutoInputAll.textContent = "🚀 Auto Input Berurutan";
            appendLog("🎉 Auto Input Selesai! Seluruh bagian terpilih berhasil diproses.", "log-success");
        });
    }

    // Logging helper
    const logBody = document.getElementById("autoInputLogBody");
    const btnClearLog = document.getElementById("btnClearAutoInputLog");

    function appendLog(text, className = "log-info") {
        if (!logBody) return;
        const now = new Date();
        const timeStr = `[${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}]`;
        const div = document.createElement("div");
        div.className = `log-entry ${className}`;
        div.textContent = `${timeStr} ${text}`;
        logBody.appendChild(div);
        logBody.scrollTop = logBody.scrollHeight;
    }

    if (btnClearLog && logBody) {
        btnClearLog.addEventListener('click', () => {
            logBody.innerHTML = '';
        });
    }
})();