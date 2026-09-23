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

    // CEISA 4.0 Sidebar Toggle (Expand / Collapse)
    const sidebarToggle = document.getElementById('ceisaSidebarToggle');
    const sidebar = document.getElementById('ceisaSidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('expanded');
            const isExpanded = sidebar.classList.contains('expanded');
            sidebarToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            try {
                localStorage.setItem('ceisa_sidebar_expanded', isExpanded ? '1' : '0');
            } catch (e) {}
        });

        sidebar.addEventListener('mouseleave', () => {
            if (sidebar.classList.contains('expanded')) {
                sidebar.classList.remove('expanded');
                sidebarToggle.setAttribute('aria-expanded', 'false');
                try {
                    localStorage.setItem('ceisa_sidebar_expanded', '0');
                } catch (e) {}
            }
        });

        try {
            if (localStorage.getItem('ceisa_sidebar_expanded') === '1') {
                sidebar.classList.add('expanded');
                sidebarToggle.setAttribute('aria-expanded', 'true');
            }
        } catch (e) {}
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
                badge.textContent = "⚡ Supabase Cloud: Terhubung";
                badge.style.background = "rgba(16, 185, 129, 0.15)";
                badge.style.color = "#10b981";
                badge.style.borderColor = "rgba(16, 185, 129, 0.3)";
            } else if (data.ceisa_supabase_status === "offline") {
                badge.textContent = "⚠️ Cloud Sync: Offline";
                badge.style.background = "rgba(239, 68, 68, 0.15)";
                badge.style.color = "#ef4444";
                badge.style.borderColor = "rgba(239, 68, 68, 0.3)";
            } else {
                badge.textContent = "⚡ Supabase Cloud: Aktif";
                badge.style.background = "rgba(16, 185, 129, 0.15)";
                badge.style.color = "#10b981";
                badge.style.borderColor = "rgba(16, 185, 129, 0.3)";
            }
        });
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
            if (area === "local" && (changes.ceisa_scan_cache || changes.ceisa_completed_numbers || changes.ceisa_pibpeb_numbers || changes.ceisa_supabase_status)) {
                loadDashboardData();
                updateSyncBadge();
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
        : (Array.isArray(data.ceisa_completed_numbers) && chosenDate === todayISO() ? data.ceisa_completed_numbers : []);

    const rawPibPeb = Array.isArray(data[`ceisa_pibpeb_numbers_${chosenDate}`])
        ? data[`ceisa_pibpeb_numbers_${chosenDate}`]
        : (Array.isArray(data.ceisa_pibpeb_numbers) && chosenDate === todayISO() ? data.ceisa_pibpeb_numbers : []);

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

    const payload = {
        ceisa_completed_numbers: uniqueCompleted,
        ceisa_pibpeb_numbers: uniquePibPeb
    };
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

    showToast("💾 Seluruh data berhasil disimpan & disinkronkan ke Supabase Cloud!");
    await loadDashboardData();
}

const saveCompletedNumbers = saveAllDataDashboard;
const savePibPebNumbers = saveAllDataDashboard;

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
