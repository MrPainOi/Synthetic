// ============================================================
// CEISA INSPECTOR DASHBOARD (100% Offline Local Storage)
// dashboard.js
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
});

function initDashboard() {
    const saveAllBtn = document.getElementById("saveAllBtn");
    const refreshBtn = document.getElementById("refreshDataBtn");
    const clearCacheBtn = document.getElementById("clearCacheBtn");
    const copyOrangeBtn = document.getElementById("copyOrangeBtn");
    const copyGreenBtn = document.getElementById("copyGreenBtn");
    const saveCompletedBtn = document.getElementById("saveCompletedBtn");
    const savePibPebBtn = document.getElementById("savePibPebBtn");
    const dashInfoToggleBtn = document.getElementById("dashInfoToggleBtn");
    const dashInfoContent = document.getElementById("dashInfoContent");
    const dashInfoArrow = document.getElementById("dashInfoArrow");

    if (dashInfoToggleBtn && dashInfoContent) {
        dashInfoToggleBtn.addEventListener("click", () => {
            const isHidden = dashInfoContent.classList.toggle("hidden");
            if (dashInfoArrow) {
                dashInfoArrow.textContent = isHidden ? "▼" : "▲";
            }
        });
    }

    // CEISA 4.0 Sidebar Hover & Toggle (Otomatis terbuka saat kursor hover)
    const sidebarToggle = document.getElementById('ceisaSidebarToggle');
    const sidebar = document.getElementById('ceisaSidebar');
    if (sidebar) {
        sidebar.addEventListener('mouseenter', () => {
            sidebar.classList.add('expanded');
            if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
        });

        sidebar.addEventListener('mouseleave', () => {
            sidebar.classList.remove('expanded');
            if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
        });

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('expanded');
                const isExpanded = sidebar.classList.contains('expanded');
                sidebarToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            });
        }
    }
    const datePicker = document.getElementById("scanDate");
    if (datePicker) {
        storageGet("ceisa_last_scan_date").then(data => {
            datePicker.value = data.ceisa_last_scan_date || todayISO();
        });
        datePicker.addEventListener("change", async () => {
            await storageSet({ ceisa_last_scan_date: datePicker.value });
            await loadDashboardData();
        });
        datePicker.addEventListener("click", () => {
            try {
                if (typeof datePicker.showPicker === "function") {
                    datePicker.showPicker();
                }
            } catch (e) {
                console.debug("showPicker not triggered:", e);
            }
        });
    }

    function updateSyncBadge() {
        const badge = document.getElementById("wifiSyncStatus");
        if (!badge) return;
        storageGet(["ceisa_supabase_status"]).then(data => {
            if (data.ceisa_supabase_status === "connected") {
                badge.textContent = "Google Cloud Sync: Terhubung";
                badge.style.background = "rgba(16, 185, 129, 0.15)";
                badge.style.color = "#10b981";
                badge.style.borderColor = "rgba(16, 185, 129, 0.3)";
            } else if (data.ceisa_supabase_status === "offline") {
                badge.textContent = "Cloud Sync: Offline";
                badge.style.background = "rgba(239, 68, 68, 0.15)";
                badge.style.color = "#ef4444";
                badge.style.borderColor = "rgba(239, 68, 68, 0.3)";
            } else {
                badge.textContent = "Google Cloud Sync: Aktif";
                badge.style.background = "rgba(16, 185, 129, 0.15)";
                badge.style.color = "#10b981";
                badge.style.borderColor = "rgba(16, 185, 129, 0.3)";
            }
        });
    }

    if (saveAllBtn) saveAllBtn.addEventListener("click", saveAllDataDashboard);
    if (saveCompletedBtn) saveCompletedBtn.addEventListener("click", saveCompletedOnlyDashboard);
    if (savePibPebBtn) savePibPebBtn.addEventListener("click", savePibPebOnlyDashboard);
    if (refreshBtn) refreshBtn.addEventListener("click", loadDashboardData);
    if (clearCacheBtn) clearCacheBtn.addEventListener("click", clearCache);
    if (copyOrangeBtn) copyOrangeBtn.addEventListener("click", () => copyText("orangeTextarea", "Daftar Oren & Merah disalin!"));
    if (copyGreenBtn) copyGreenBtn.addEventListener("click", () => copyText("greenTextarea", "Hasil Format Hijau disalin!"));

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local") {
                const keys = Object.keys(changes);
                const hasRelevantChange = keys.some(k =>
                    k.includes("ceisa_completed_numbers") ||
                    k.includes("ceisa_pibpeb_numbers") ||
                    k === "ceisa_scan_cache" ||
                    k === "ceisa_supabase_status" ||
                    k === "ceisa_last_scan_date"
                );
                if (hasRelevantChange) {
                    loadDashboardData();
                    updateSyncBadge();
                }
            }
        });
    }

    window.addEventListener("ceisa_storage_changed", () => {
        loadDashboardData();
        updateSyncBadge();
    });

    updateSyncBadge();
    loadDashboardData();
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 2000);
}

function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function cleanCompanyName(name) {
    if (!name) return "";
    return name
        .replace(/^\d+[\.\s\-\:]+/, "")
        .replace(/^(PT|CV|UD|PD|TB|PERSERO|PERSEROAN)\.?\s+/i, "")
        .replace(/^[:\/\-\,\.\s]+|[:\/\-\,\.\s]+$/, "")
        .trim();
}

function isKnownPortKeyword(str) {
    if (!str) return false;
    const s = str.toUpperCase();
    const keywords = [
        "SEWU", "SEKUPANG", "IDKSP",
        "BATU", "AMPAR", "IDBTU",
        "CITRA", "TUSA", "IDCTS",
        "KABIL", "IDKDA",
        "TPS", "PELABUHAN", "DERMAGA", "TERMINAL"
    ];
    return keywords.some(kw => s.includes(kw));
}

function cleanLocation(loc) {
    if (!loc) return "";
    let val = loc.toUpperCase().trim();

    if (val.includes("IDBTU") || val.includes("BATU AMPAR") || val.includes("BATUAMPAR")) return "IDBTU - BATU AMPAR";
    if (val.includes("IDKSP") || val.includes("SEKUPANG")) return "IDKSP - SEKUPANG";
    if (val.includes("IDCTS") || val.includes("CITRA TUSA") || val.includes("CITRATUSA")) return "IDCTS - CITRA TUSA";
    if (val.includes("IDKDA") || val.includes("KABIL")) return "IDKDA - KABIL";

    val = val.replace(/^[:\/\-\,\.\s]+|[:\/\-\,\.\s]+$/, "").trim();

    const isAlphanumericCode = /^(?=.*\d)[A-Z0-9\.\-\/]{3,20}$/i.test(val);
    const hasNoPortKeyword = !isKnownPortKeyword(val);

    if ((isAlphanumericCode && hasNoPortKeyword) || val.length < 3) return "";

    return val;
}

function isBatuAmpar(itemOrCache) {
    if (!itemOrCache) return false;
    const status = itemOrCache?.status;
    if (status === "yellow" || status === "pink" || status === "cream" || status === "aqua") return true;
    if (status === "green" || status === "purple" || status === "blue" || status === "orange") return false;

    const loc = String(itemOrCache?.location || itemOrCache?.value || itemOrCache?.target || "").toUpperCase();
    if (loc.includes("SEWU") || loc.includes("SEKUPANG") || loc.includes("IDKSP") || loc.includes("IDSKP")) {
        return false;
    }
    if (loc.includes("BATU AMPAR") || loc.includes("BATUAMPAR") || loc.includes("IDBTU")) {
        return true;
    }
    return false;
}

function formatGroupedOutput(items) {
    if (!items || items.length === 0) return "";

    const sppbItems = [];
    const nppbItems = [];
    const otherItems = [];

    for (const item of items) {
        const type = String(item.documentType || "").toUpperCase();
        if (type === "SPPB") sppbItems.push(item);
        else if (type === "NPPB") nppbItems.push(item);
        else otherItems.push(item);
    }

    const sortFn = (a, b) => String(a.registrationNumber || "").localeCompare(String(b.registrationNumber || ""));
    sppbItems.sort(sortFn);
    nppbItems.sort(sortFn);
    otherItems.sort(sortFn);

    function formatItemLine(item, index) {
        const reg = item.registrationNumber;
        const name = cleanCompanyName(item.companyName);
        let loc = cleanLocation(item.location || item.value || "");

        const batuAmpar = isBatuAmpar(item);

        if (batuAmpar) {
            if (!loc || loc === "SEWU") {
                loc = "IDBTU - BATU AMPAR";
            }
        } else {
            if (!loc || loc === "IDBTU - BATU AMPAR") {
                loc = cleanLocation(item.target || "") || (item.documentType === "NPPB" ? "IDKSP - SEKUPANG" : "SEWU");
            }
        }

        let codePt = name ? `[${reg} - ${name}]` : `[${reg}]`;
        let place = loc ? ` [${loc}]` : "";

        return `${index + 1}.${codePt}${place}`;
    }

    const sections = [];
    if (sppbItems.length > 0) {
        const lines = ["SPPB"];
        sppbItems.forEach((item, idx) => lines.push(formatItemLine(item, idx)));
        sections.push(lines.join("\n"));
    }
    if (nppbItems.length > 0) {
        const lines = ["NPPB"];
        nppbItems.forEach((item, idx) => lines.push(formatItemLine(item, idx)));
        sections.push(lines.join("\n"));
    }
    if (otherItems.length > 0) {
        const lines = ["LAINNYA"];
        otherItems.forEach((item, idx) => lines.push(formatItemLine(item, idx)));
        sections.push(lines.join("\n"));
    }

    return sections.join("\n\n");
}

function isWithinLast3Days(dateStr, timestamp) {
    return true;
}

function pruneScanCache3Days(cache) {
    return (cache && typeof cache === "object") ? cache : {};
}

function findInScanCache(cache, registrationNumber) {
    if (!cache || !registrationNumber) return null;
    const raw = String(registrationNumber).trim();
    if (cache[raw]) return cache[raw];

    const unpadded = raw.replace(/^0+/, "");
    if (cache[unpadded]) return cache[unpadded];

    const padded = raw.padStart(6, "0");
    if (cache[padded]) return cache[padded];

    for (const item of Object.values(cache)) {
        if (!item || !item.registrationNumber) continue;
        const itemReg = String(item.registrationNumber).trim();
        if (itemReg === raw || itemReg.replace(/^0+/, "") === unpadded || itemReg.padStart(6, "0") === padded) {
            return item;
        }
    }

    return null;
}

async function loadDashboardData() {
    const datePicker = document.getElementById("scanDate");
    const chosenDate = datePicker ? datePicker.value || todayISO() : todayISO();

    const data = await storageGet([
        `ceisa_completed_numbers_${chosenDate}`,
        "ceisa_completed_numbers",
        `ceisa_pibpeb_numbers_${chosenDate}`,
        "ceisa_pibpeb_numbers",
        "ceisa_scan_cache"
    ]);

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

    const rawCompleted = Array.isArray(data[`ceisa_completed_numbers_${chosenDate}`])
        ? data[`ceisa_completed_numbers_${chosenDate}`]
        : (chosenDate === todayISO() && Array.isArray(data.ceisa_completed_numbers) ? data.ceisa_completed_numbers : []);

    const rawPibPeb = Array.isArray(data[`ceisa_pibpeb_numbers_${chosenDate}`])
        ? data[`ceisa_pibpeb_numbers_${chosenDate}`]
        : (chosenDate === todayISO() && Array.isArray(data.ceisa_pibpeb_numbers) ? data.ceisa_pibpeb_numbers : []);

    const completed = cleanNumberList(rawCompleted);
    const pibPeb = cleanNumberList(rawPibPeb);

    const completedSet = new Set();
    completed.forEach(x => {
        const str = String(x).trim();
        completedSet.add(str);
        completedSet.add(str.replace(/^0+/, ""));
        completedSet.add(str.padStart(6, "0"));
    });

    const rawCache = (data.ceisa_scan_cache && typeof data.ceisa_scan_cache === "object") ? data.ceisa_scan_cache : {};
    const scanCache = pruneScanCache3Days(rawCache);

    // Self-heal: perbaiki status Sewu (ke orange) dan Batu Ampar (ke red)
    for (const item of Object.values(scanCache)) {
        if (!item) continue;
        const loc = String(item.location || item.value || "").toUpperCase();
        const isSewuLoc = loc.includes("SEWU") || loc.includes("SEKUPANG") || loc.includes("IDKSP") || loc.includes("IDSKP");
        const isBatuLoc = loc.includes("BATU AMPAR") || loc.includes("BATUAMPAR") || loc.includes("IDBTU");

        if (isSewuLoc && item.status === "red") {
            item.status = "orange";
        }
        if (isBatuLoc && item.status === "orange") {
            item.status = "red";
        }
    }

    // Filter cache items strictly for chosenDate
    const dateCacheValues = Object.values(scanCache).filter(item => {
        if (!item) return false;
        const itemDate = item.rowDate || (item.timestamp ? new Date(item.timestamp).toISOString().split('T')[0] : "");
        return itemDate === chosenDate;
    });

    document.getElementById("statTotal").textContent = dateCacheValues.length;

    // Filter Oren & Merah for chosenDate
    const orangeItems = dateCacheValues.filter(item => {
        if (!item || !item.registrationNumber) return false;
        const regStr = String(item.registrationNumber).trim();
        return !completedSet.has(regStr) && !completedSet.has(regStr.replace(/^0+/, "")) && !completedSet.has(regStr.padStart(6, "0"));
    });

    document.getElementById("statOrange").textContent = orangeItems.length;
    document.getElementById("orangeTextarea").value = formatGroupedOutput(orangeItems);

    // Completed Items for chosenDate (Strict Fuzzy Match so Company Names Always Resolve)
    const completedItems = completed.map(code => {
        const reg = String(code).trim();
        const cached = findInScanCache(scanCache, reg);
        const batu = isBatuAmpar(cached);
        return {
            registrationNumber: reg,
            companyName: cached?.companyName || "",
            location: cached?.location || (batu ? "IDBTU - BATU AMPAR" : (cached?.target || (cached?.documentType === "NPPB" ? "IDKSP - SEKUPANG" : "SEWU"))),
            documentType: cached?.documentType || "SPPB",
            status: cached?.status || (batu ? "yellow" : "green"),
            isBatuAmpar: batu
        };
    });

    // Pisahkan Sewu (Selesai Hijau) dan Batu Ampar (Selesai Kuning) secara ketat
    const sewuCompleted = completedItems.filter(x => !x.isBatuAmpar);
    const batuAmparCompleted = completedItems.filter(x => x.isBatuAmpar);

    // Stat Selesai Hijau: HANYA Sewu / Sekupang
    document.getElementById("statGreen").textContent = sewuCompleted.length;
    // Stat Batu Ampar: HANYA Batu Ampar
    document.getElementById("statYellow").textContent = batuAmparCompleted.length;

    // greenTextarea menampilkan daftar dokumen selesai
    document.getElementById("greenTextarea").value = formatGroupedOutput(completedItems);

    // Set completedInput
    const completedInput = document.getElementById("completedInput");
    if (completedInput && document.activeElement !== completedInput) {
        completedInput.value = completed.join("\n");
    }

    // Set pibPebInput
    const pibPebInput = document.getElementById("pibPebInput");
    if (pibPebInput && document.activeElement !== pibPebInput) {
        pibPebInput.value = pibPeb.join("\n");
    }
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

async function saveAllDataDashboard() {
    const datePicker = document.getElementById("scanDate");
    const chosenDate = datePicker ? datePicker.value || todayISO() : todayISO();

    const completedInput = document.getElementById("completedInput");
    const pibPebInput = document.getElementById("pibPebInput");

    // Read both inputs synchronously up front before ANY async calls!
    const rawCompleted = completedInput ? completedInput.value : "";
    const rawPibPeb = pibPebInput ? pibPebInput.value : "";

    const uniqueCompleted = parseRegistrationNumbersFromText(rawCompleted);
    const uniquePibPeb = parseRegistrationNumbersFromText(rawPibPeb);

    // Update UI immediately with formatted 6-digit values
    if (completedInput) completedInput.value = uniqueCompleted.join("\n");
    if (pibPebInput) pibPebInput.value = uniquePibPeb.join("\n");

    const payload = {};
    if (chosenDate === todayISO()) {
        payload.ceisa_completed_numbers = uniqueCompleted;
        payload.ceisa_pibpeb_numbers = uniquePibPeb;
    }
    payload[`ceisa_completed_numbers_${chosenDate}`] = uniqueCompleted;
    payload[`ceisa_pibpeb_numbers_${chosenDate}`] = uniquePibPeb;
    await storageSet(payload);

    const currentData = await storageGet(["ceisa_scan_cache"]);
    const cache = (currentData.ceisa_scan_cache && typeof currentData.ceisa_scan_cache === "object")
        ? currentData.ceisa_scan_cache
        : {};

    if (typeof pushExactStateToSupabase === "function") {
        await pushExactStateToSupabase(
            uniqueCompleted,
            uniquePibPeb,
            cache,
            chosenDate
        );
    } else if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(
            uniqueCompleted,
            uniquePibPeb,
            cache,
            chosenDate
        );
    }

    if (typeof broadcastRefreshColor === "function") {
        await broadcastRefreshColor();
    }

    showToast("Seluruh data berhasil disimpan & disinkronkan ke Google Cloud.");
    await loadDashboardData();
}

async function saveCompletedOnlyDashboard() {
    const datePicker = document.getElementById("scanDate");
    const chosenDate = datePicker ? datePicker.value || todayISO() : todayISO();
    const completedInput = document.getElementById("completedInput");
    const rawCompleted = completedInput ? completedInput.value : "";
    const uniqueCompleted = parseRegistrationNumbersFromText(rawCompleted);
    if (completedInput) completedInput.value = uniqueCompleted.join("\n");

    const existing = await storageGet([`ceisa_pibpeb_numbers_${chosenDate}`, "ceisa_pibpeb_numbers", "ceisa_scan_cache"]);
    const currentPibPeb = cleanNumberList(existing[`ceisa_pibpeb_numbers_${chosenDate}`] || (chosenDate === todayISO() ? existing.ceisa_pibpeb_numbers : []) || []);
    const cache = (existing.ceisa_scan_cache && typeof existing.ceisa_scan_cache === "object") ? existing.ceisa_scan_cache : {};

    const payload = {};
    if (chosenDate === todayISO()) {
        payload.ceisa_completed_numbers = uniqueCompleted;
    }
    payload[`ceisa_completed_numbers_${chosenDate}`] = uniqueCompleted;
    await storageSet(payload);

    if (typeof pushExactStateToSupabase === "function") {
        await pushExactStateToSupabase(uniqueCompleted, currentPibPeb, cache, chosenDate);
    } else if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(uniqueCompleted, currentPibPeb, cache, chosenDate);
    }

    if (typeof broadcastRefreshColor === "function") {
        await broadcastRefreshColor();
    }
    showToast("Nomor Selesai Hijau berhasil disimpan & disinkronkan ke Google Cloud.");
    await loadDashboardData();
}

async function savePibPebOnlyDashboard() {
    const datePicker = document.getElementById("scanDate");
    const chosenDate = datePicker ? datePicker.value || todayISO() : todayISO();
    const pibPebInput = document.getElementById("pibPebInput");
    const rawPibPeb = pibPebInput ? pibPebInput.value : "";
    const uniquePibPeb = parseRegistrationNumbersFromText(rawPibPeb);
    if (pibPebInput) pibPebInput.value = uniquePibPeb.join("\n");

    const existing = await storageGet([`ceisa_completed_numbers_${chosenDate}`, "ceisa_completed_numbers", "ceisa_scan_cache"]);
    const currentCompleted = cleanNumberList(existing[`ceisa_completed_numbers_${chosenDate}`] || (chosenDate === todayISO() ? existing.ceisa_completed_numbers : []) || []);
    const cache = (existing.ceisa_scan_cache && typeof existing.ceisa_scan_cache === "object") ? existing.ceisa_scan_cache : {};

    const payload = {};
    if (chosenDate === todayISO()) {
        payload.ceisa_pibpeb_numbers = uniquePibPeb;
    }
    payload[`ceisa_pibpeb_numbers_${chosenDate}`] = uniquePibPeb;
    await storageSet(payload);

    if (typeof pushExactStateToSupabase === "function") {
        await pushExactStateToSupabase(currentCompleted, uniquePibPeb, cache, chosenDate);
    } else if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(currentCompleted, uniquePibPeb, cache, chosenDate);
    }

    if (typeof broadcastRefreshColor === "function") {
        await broadcastRefreshColor();
    }
    showToast("Nomor Selesai PIB/PEB berhasil disimpan & disinkronkan ke Google Cloud.");
    await loadDashboardData();
}

const saveCompletedNumbers = saveCompletedOnlyDashboard;
const savePibPebNumbers = savePibPebOnlyDashboard;

function copyText(textareaId, toastMsg) {
    const textarea = document.getElementById(textareaId);
    if (!textarea || !textarea.value) {
        showToast("Tidak ada teks untuk disalin");
        return;
    }
    navigator.clipboard.writeText(textarea.value).then(() => {
        showToast(toastMsg);
    });
}

async function clearCache() {
    if (!confirm("Apakah Anda yakin ingin menghapus seluruh cache scan dokumen?")) return;
    if (typeof clearAllScanCache === "function") {
        await clearAllScanCache();
    } else {
        await storageRemove("ceisa_scan_cache");
    }
    showToast("Cache scan di seluruh perangkat telah dibersihkan");
    loadDashboardData();
}

// ==========================================================================
// PUSAT PEMBARUAN SISTEM (SYSTEM UPDATE CENTER - AUTO-UPDATE & PUSH-UPDATE)
// ==========================================================================
(function initSystemUpdateModule() {
    const modal = document.getElementById("updateModal");
    const openBtn = document.getElementById("openUpdateModalBtn");
    const closeBtn = document.getElementById("closeUpdateModalBtn");

    const localVersionBadge = document.getElementById("localVersionBadge");
    const localCommitText = document.getElementById("localCommitText");
    const updateBtnLabel = document.getElementById("updateBtnLabel");
    const updatePulseDot = document.getElementById("updatePulseDot");

    const autoUpdateToggle = document.getElementById("autoUpdateToggle");
    const updateNoticeBox = document.getElementById("updateNoticeBox");
    const remoteCommitMsg = document.getElementById("remoteCommitMsg");
    const checkUpdateBtn = document.getElementById("checkUpdateBtn");
    const applyUpdateBtn = document.getElementById("applyUpdateBtn");
    const applyUpdateBtnText = document.getElementById("applyUpdateBtnText");
    const updateStatusFeedback = document.getElementById("updateStatusFeedback");

    const devCommitMsgInput = document.getElementById("devCommitMsgInput");
    const devPushUpdateBtn = document.getElementById("devPushUpdateBtn");
    const devPushBtnText = document.getElementById("devPushBtnText");
    const devPushFeedback = document.getElementById("devPushFeedback");

    if (!modal || !openBtn) return;

    // 1. Inisialisasi Versi Lokal
    function refreshLocalVersion() {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: "GET_SYSTEM_VERSION" }, (res) => {
                if (res && res.ok && res.data && res.data.data) {
                    const info = res.data.data;
                    const v = info.version || "2.1.1";
                    const sha = info.commit || "";
                    if (localVersionBadge) localVersionBadge.textContent = "v" + v;
                    if (updateBtnLabel) updateBtnLabel.textContent = "v" + v;
                    if (localCommitText) localCommitText.textContent = sha ? sha.substring(0, 7) : "Local";
                    if (typeof storageSet === "function" && sha) {
                        storageSet({ ceisa_local_commit: sha });
                    }
                }
            });
        }
    }

    // 2. Ambil preferensi Auto-Update (Default: MATI / False)
    if (typeof storageGet === "function") {
        storageGet(["ceisa_auto_update_enabled"]).then(data => {
            if (autoUpdateToggle) {
                // Secara default nonaktif (mati) kecuali diaktifkan secara eksplisit oleh user
                autoUpdateToggle.checked = Boolean(data.ceisa_auto_update_enabled === true);
            }
        }).catch(() => {});
    }

    if (autoUpdateToggle) {
        autoUpdateToggle.addEventListener("change", () => {
            if (typeof storageSet === "function") {
                storageSet({ ceisa_auto_update_enabled: autoUpdateToggle.checked });
            }
            showToast(autoUpdateToggle.checked ? "Auto-Update aktif" : "Auto-Update dinonaktifkan");
        });
    }

    // 3. Kontrol Modal Buka / Tutup
    openBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
        refreshLocalVersion();
        checkUpdate(false);
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
        });
    }

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.add("hidden");
        }
    });

    // 4. Periksa Pembaruan
    function checkUpdate(isManualClick = true) {
        if (isManualClick && updateStatusFeedback) {
            updateStatusFeedback.textContent = "Memeriksa pembaruan di GitHub...";
            updateStatusFeedback.style.color = "var(--text-muted)";
        }

        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: "CHECK_UPDATE" }, (res) => {
                if (chrome.runtime.lastError || !res || !res.ok) {
                    if (updateStatusFeedback && isManualClick) {
                        updateStatusFeedback.textContent = "Gagal menghubungi server pembaruan.";
                        updateStatusFeedback.style.color = "#dc2626";
                    }
                    return;
                }

                const data = res.data || {};
                if (data.update_available) {
                    if (updatePulseDot) updatePulseDot.classList.add("has-update");
                    if (updateNoticeBox) updateNoticeBox.classList.remove("hidden");
                    if (remoteCommitMsg) {
                        remoteCommitMsg.textContent = data.remote_message
                            ? `Commit: ${data.remote_commit.substring(0, 7)} — "${data.remote_message}"`
                            : `Commit terbaru: ${data.remote_commit.substring(0, 7)}`;
                    }
                    if (applyUpdateBtn) applyUpdateBtn.disabled = false;
                    if (updateStatusFeedback) {
                        updateStatusFeedback.textContent = "Pembaruan tersedia. Klik tombol di atas untuk memasang.";
                        updateStatusFeedback.style.color = "#d97706";
                    }
                } else {
                    if (updatePulseDot) updatePulseDot.classList.remove("has-update");
                    if (updateNoticeBox) updateNoticeBox.classList.add("hidden");
                    if (applyUpdateBtn) applyUpdateBtn.disabled = true;
                    if (updateStatusFeedback) {
                        updateStatusFeedback.textContent = "Versi yang Anda gunakan adalah yang paling baru.";
                        updateStatusFeedback.style.color = "#059669";
                    }
                }
            });
        }
    }

    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener("click", () => checkUpdate(true));
    }

    // 5. Terapkan Pembaruan (Pull & Reload)
    if (applyUpdateBtn) {
        applyUpdateBtn.addEventListener("click", () => {
            if (applyUpdateBtn.disabled) return;
            applyUpdateBtn.disabled = true;
            if (applyUpdateBtnText) applyUpdateBtnText.textContent = "Mengunduh & Memasang...";
            if (updateStatusFeedback) {
                updateStatusFeedback.textContent = "Sedang mengunduh file terbaru dari GitHub...";
                updateStatusFeedback.style.color = "var(--text-muted)";
            }

            chrome.runtime.sendMessage({ type: "PERFORM_PULL_UPDATE" }, (res) => {
                if (chrome.runtime.lastError || !res || !res.ok) {
                    applyUpdateBtn.disabled = false;
                    if (applyUpdateBtnText) applyUpdateBtnText.textContent = "Perbarui Sekarang";
                    if (updateStatusFeedback) {
                        updateStatusFeedback.textContent = "Gagal mengunduh pembaruan. Silakan coba lagi.";
                        updateStatusFeedback.style.color = "#dc2626";
                    }
                    return;
                }

                if (updateStatusFeedback) {
                    updateStatusFeedback.textContent = "Pembaruan berhasil dipasang. Memuat ulang ekstensi...";
                    updateStatusFeedback.style.color = "#059669";
                }
                showToast("Pembaruan berhasil dipasang. Memuat ulang sistem...");
            });
        });
    }

    // 6. Push Update (Khusus Pengembang / Master PC)
    if (devPushUpdateBtn) {
        devPushUpdateBtn.addEventListener("click", () => {
            const commitMsg = devCommitMsgInput ? devCommitMsgInput.value.trim() : "";
            if (!confirm(`Publikasikan pembaruan ini sekarang ke seluruh komputer pengguna?\n\nSemua komputer karyawan akan otomatis memperbarui file mereka.`)) {
                return;
            }

            devPushUpdateBtn.disabled = true;
            if (devPushBtnText) devPushBtnText.textContent = "Mendorong ke GitHub...";
            if (devPushFeedback) {
                devPushFeedback.textContent = "Memproses git commit, git push & menyiarkan sinyal...";
                devPushFeedback.style.color = "var(--text-muted)";
            }

            chrome.runtime.sendMessage({
                type: "PERFORM_PUSH_UPDATE",
                commit_message: commitMsg
            }, (res) => {
                devPushUpdateBtn.disabled = false;
                if (devPushBtnText) devPushBtnText.textContent = "Push Update ke Semua Komputer";

                if (chrome.runtime.lastError || !res || !res.ok) {
                    if (devPushFeedback) {
                        devPushFeedback.textContent = "Gagal melakukan push update. Periksa koneksi internet.";
                        devPushFeedback.style.color = "#dc2626";
                    }
                    return;
                }

                const commitSha = res.data && res.data.commit ? res.data.commit.substring(0, 7) : "";
                if (devPushFeedback) {
                    devPushFeedback.textContent = `Berhasil. Commit [${commitSha}] telah di-push dan disiarkan ke semua komputer client.`;
                    devPushFeedback.style.color = "#059669";
                }
                if (devCommitMsgInput) devCommitMsgInput.value = "";
                showToast("Update berhasil dipublikasikan ke seluruh komputer.");
                refreshLocalVersion();
            });
        });
    }

    // 7. Event Listener dari sync.js (saat remote update terdeteksi)
    window.addEventListener("ceisa_update_available", (e) => {
        if (updatePulseDot) updatePulseDot.classList.add("has-update");
        if (updateNoticeBox) updateNoticeBox.classList.remove("hidden");
        if (applyUpdateBtn) applyUpdateBtn.disabled = false;
        if (remoteCommitMsg && e.detail) {
            remoteCommitMsg.textContent = e.detail.message
                ? `Versi baru dirilis: "${e.detail.message}"`
                : "Pembaruan sistem baru tersedia di cloud!";
        }
    });

    // Inisialisasi awal saat halaman dashboard dibuka
    refreshLocalVersion();
})();

