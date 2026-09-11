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

    async function saveAllDataDashboard() {
        await saveCompletedNumbers();
        await savePibPebNumbers();
        showToast("💾 Seluruh data berhasil disimpan ke Server & Wi-Fi!");
    }

    if (saveAllBtn) saveAllBtn.addEventListener("click", saveAllDataDashboard);
    if (saveCompletedBtn) saveCompletedBtn.addEventListener("click", saveAllDataDashboard);
    if (savePibPebBtn) savePibPebBtn.addEventListener("click", saveAllDataDashboard);
    if (refreshBtn) refreshBtn.addEventListener("click", loadDashboardData);
    if (clearCacheBtn) clearCacheBtn.addEventListener("click", clearCache);
    if (copyOrangeBtn) copyOrangeBtn.addEventListener("click", () => copyText("orangeTextarea", "Daftar Oren & Merah disalin!"));
    if (copyGreenBtn) copyGreenBtn.addEventListener("click", () => copyText("greenTextarea", "Hasil Format Hijau disalin!"));

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && (changes.ceisa_scan_cache || changes.ceisa_completed_numbers || changes.ceisa_pibpeb_numbers)) {
                loadDashboardData();
            }
        });
    }

    window.addEventListener("ceisa_storage_changed", () => {
        loadDashboardData();
    });

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
    if (status === "red" || status === "yellow" || status === "pink" || status === "cream" || status === "aqua") {
        return true;
    }
    const str = (
        (itemOrCache?.location || "") + " " +
        (itemOrCache?.target || "") + " " +
        (itemOrCache?.value || "") + " " +
        (itemOrCache?.companyName || "")
    ).toUpperCase();
    return str.includes("BATU AMPAR") || str.includes("BATUAMPAR") || str.includes("IDBTU");
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
        let loc = cleanLocation(item.location || "");

        const isRedOrBatuAmpar = item.status === "red" || isBatuAmpar(item);

        if (isRedOrBatuAmpar) {
            if (!loc || loc === "SEWU") {
                loc = "IDBTU - BATU AMPAR";
            }
        } else {
            if (!loc) {
                loc = cleanLocation(item.target || "") || "SEWU";
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

    const completed = Array.isArray(data[`ceisa_completed_numbers_${chosenDate}`])
        ? data[`ceisa_completed_numbers_${chosenDate}`]
        : (Array.isArray(data.ceisa_completed_numbers) && chosenDate === todayISO() ? data.ceisa_completed_numbers : []);

    const pibPeb = Array.isArray(data[`ceisa_pibpeb_numbers_${chosenDate}`])
        ? data[`ceisa_pibpeb_numbers_${chosenDate}`]
        : (Array.isArray(data.ceisa_pibpeb_numbers) && chosenDate === todayISO() ? data.ceisa_pibpeb_numbers : []);

    const completedSet = new Set();
    completed.forEach(x => {
        const str = String(x).trim();
        completedSet.add(str);
        completedSet.add(str.replace(/^0+/, ""));
        completedSet.add(str.padStart(6, "0"));
    });

    const rawCache = (data.ceisa_scan_cache && typeof data.ceisa_scan_cache === "object") ? data.ceisa_scan_cache : {};
    const scanCache = pruneScanCache3Days(rawCache);

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

    // Green Items for chosenDate (Strict Fuzzy Match so Company Names Always Resolve)
    const greenItems = completed.map(code => {
        const reg = String(code).trim();
        const cached = findInScanCache(scanCache, reg);
        return {
            registrationNumber: reg,
            companyName: cached?.companyName || "",
            location: cached?.location || cached?.target || "",
            documentType: cached?.documentType || "SPPB",
            status: cached?.status || "green"
        };
    });

    document.getElementById("statGreen").textContent = greenItems.length;
    document.getElementById("greenTextarea").value = formatGroupedOutput(greenItems);

    // Batu Ampar Count
    let yellowCount = 0;
    completed.forEach(code => {
        const cached = findInScanCache(scanCache, String(code).trim());
        if (cached?.status === "yellow" || isBatuAmpar(cached)) {
            yellowCount++;
        }
    });
    document.getElementById("statYellow").textContent = yellowCount;

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

async function saveCompletedNumbers() {
    const input = document.getElementById("completedInput").value || "";
    const rawMatches = input.match(/\b\d{6}\b/g) || [];

    const uniqueList = [];
    const seen = new Set();
    for (const code of rawMatches) {
        const cleaned = code.trim();
        if (!seen.has(cleaned)) {
            seen.add(cleaned);
            uniqueList.push(cleaned);
        }
    }

    await storageSet({
        ceisa_completed_numbers: uniqueList
    });

    const currentData = await storageGet(["ceisa_pibpeb_numbers", "ceisa_scan_cache"]);
    if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(
            uniqueList,
            currentData.ceisa_pibpeb_numbers || [],
            currentData.ceisa_scan_cache || {}
        );
    }

    showToast("Nomor Selesai (Hijau) disimpan & tersinkronisasi!");
    loadDashboardData();

    // Broadcast REFRESH_COLOR to tabs
    try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
            const tabs = await chrome.tabs.query({ url: "https://portal.beacukai.go.id/*" });
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: "REFRESH_COLOR" });
            });
        }
    } catch (_) {}
}

async function savePibPebNumbers() {
    const input = document.getElementById("pibPebInput").value || "";
    const rawMatches = input.match(/\b\d{6}\b/g) || [];

    const uniqueList = [];
    const seen = new Set();
    for (const code of rawMatches) {
        const cleaned = code.trim();
        if (!seen.has(cleaned)) {
            seen.add(cleaned);
            uniqueList.push(cleaned);
        }
    }

    await storageSet({
        ceisa_pibpeb_numbers: uniqueList
    });

    const currentData = await storageGet(["ceisa_completed_numbers", "ceisa_scan_cache"]);
    if (typeof pushExactStateToWifiServer === "function") {
        await pushExactStateToWifiServer(
            currentData.ceisa_completed_numbers || [],
            uniqueList,
            currentData.ceisa_scan_cache || {}
        );
    }

    showToast("Nomor Selesai PIB/PEB disimpan & tersinkronisasi!");
    loadDashboardData();

    // Broadcast REFRESH_COLOR to tabs
    try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
            const tabs = await chrome.tabs.query({ url: "https://portal.beacukai.go.id/*" });
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: "REFRESH_COLOR" });
            });
        }
    } catch (_) {}
}

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
