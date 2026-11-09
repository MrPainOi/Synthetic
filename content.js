// ============================================================
// CEISA AUTO COLORING
// content.js
// ============================================================

(() => {

    if (window.__CEISA_AUTO_COLORING_CONTENT__) {
        return;
    }

    window.__CEISA_AUTO_COLORING_CONTENT__ = true;

    console.log("CEISA AUTO COLORING READY");


    // ========================================================
    // STATE
    // ========================================================

    let scanning = false;

    let scanDate = null;

    // Dipertahankan agar kompatibel dengan message lama.
    let scanAllDates = false;

    let completedNumbers = new Set();

    let pibPebNumbers = new Set();

    let scanCache = {};

    // Anti-flicker: lock to prevent concurrent recolor executions
    let _recolorInProgress = false;

    // MutationObserver instance (assigned below after function declarations)
    let observer = null;

    // Storage-change debounce timer
    let _storageRecolorTimer = null;

    // MutationObserver debounce timer
    let recolorTimer = null;


    async function getActiveScanDate() {
        const detected = (typeof detectCeisaPortalDate === "function") ? detectCeisaPortalDate() : null;
        if (detected) {
            scanDate = detected;
            chrome.storage.local.set({ ceisa_last_scan_date: detected, ceisa_scan_date: detected }).catch(() => {});
            return detected;
        }
        const data = await chrome.storage.local.get("ceisa_last_scan_date");
        if (data.ceisa_last_scan_date) {
            scanDate = data.ceisa_last_scan_date;
            return data.ceisa_last_scan_date;
        }
        return scanDate || todayISO();
    }

    async function loadCompletedNumbers() {
        const activeDate = await getActiveScanDate();
        const data = await chrome.storage.local.get([
            `ceisa_completed_numbers_${activeDate}`,
            "ceisa_completed_numbers"
        ]);

        const list = (Array.isArray(data[`ceisa_completed_numbers_${activeDate}`]) && data[`ceisa_completed_numbers_${activeDate}`].length > 0)
            ? data[`ceisa_completed_numbers_${activeDate}`]
            : (Array.isArray(data.ceisa_completed_numbers) ? data.ceisa_completed_numbers : []);

        completedNumbers = new Set(
            list
                .map(x => String(x).trim().padStart(6, "0"))
                .filter(x => /^\d{6}$/.test(x))
        );
    }

    async function loadPibPebNumbers() {
        const activeDate = await getActiveScanDate();
        const data = await chrome.storage.local.get([
            `ceisa_pibpeb_numbers_${activeDate}`,
            "ceisa_pibpeb_numbers"
        ]);

        const list = (Array.isArray(data[`ceisa_pibpeb_numbers_${activeDate}`]) && data[`ceisa_pibpeb_numbers_${activeDate}`].length > 0)
            ? data[`ceisa_pibpeb_numbers_${activeDate}`]
            : (Array.isArray(data.ceisa_pibpeb_numbers) ? data.ceisa_pibpeb_numbers : []);

        pibPebNumbers = new Set(
            list
                .map(x => String(x).trim().padStart(6, "0"))
                .filter(x => /^\d{6}$/.test(x))
        );
    }

    let currentScanToken = 0;


    const captureWaiters = new Map();

    const resultWaiters = new Map();


    let stats = {
        total: 0,
        processed: 0,
        green: 0,
        orange: 0,
        red: 0,
        error: 0
    };


    // ========================================================
    // Inject page hook
    // ========================================================

    function injectPageHook() {

        if (window.__CEISA_AUTO_COLORING_INJECTED__) {
            return;
        }

        window.__CEISA_AUTO_COLORING_INJECTED__ = true;


        window.addEventListener(
            "message",
            onPageMessage,
            false
        );


        const script =
            document.createElement("script");


        script.src =
            chrome.runtime.getURL("inject.js");


        script.async = false;


        (
            document.head ||
            document.documentElement
        ).appendChild(script);


        script.onload = () => {
            script.remove();
        };


        script.onerror = error => {

            console.error(
                "CEISA inject.js gagal:",
                error
            );

        };

    }


    injectPageHook();


    // ========================================================
    // Page → content
    // ========================================================

    function onPageMessage(event) {

        if (event.source !== window) {
            return;
        }


        const data = event.data;


        if (
            !data ||
            data.source !== "CEISA_AUTO_COLORING"
        ) {
            return;
        }


        // ----------------------------------------------------
        // PDF CAPTURED
        // ----------------------------------------------------

        if (data.type === "PDF_CAPTURED") {

            const waiter =
                captureWaiters.get(data.jobId);


            if (!waiter) {

                console.warn(
                    "CEISA PDF capture tidak punya waiter:",
                    data.jobId
                );

                return;

            }


            captureWaiters.delete(data.jobId);


            waiter.resolve({

                base64:
                    data.base64,

                url:
                    data.url,

                contentType:
                    data.contentType,

                documentNumber:
                    data.documentNumber

            });


            return;
        }


        // ----------------------------------------------------
        // PDF CAPTURE ERROR
        // ----------------------------------------------------

        if (data.type === "PDF_CAPTURE_ERROR") {

            const waiter =
                captureWaiters.get(data.jobId);


            if (!waiter) {
                return;
            }


            captureWaiters.delete(data.jobId);


            waiter.reject(
                new Error(
                    data.error ||
                    "PDF capture error"
                )
            );

        }

    }


    // ========================================================
    // UTILITY
    // ========================================================

    function sleep(ms) {

        return new Promise(
            resolve => setTimeout(resolve, ms)
        );

    }


    function normalizeText(text) {

        return String(text || "")
            .normalize("NFKC")
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    }


    function normalizeUpper(text) {

        return normalizeText(text)
            .toUpperCase();

    }


    function normalizeDate(text) {

        const match =
            String(text || "")
                .match(
                    /\b(\d{2})-(\d{2})-(\d{4})\b/
                );


        if (!match) {
            return "";
        }


        return `${match[3]}-${match[2]}-${match[1]}`;

    }


    function todayISO() {

        const now = new Date();


        const year =
            now.getFullYear();


        const month =
            String(now.getMonth() + 1)
                .padStart(2, "0");


        const day =
            String(now.getDate())
                .padStart(2, "0");


        return `${year}-${month}-${day}`;

    }


    function generateJobId() {

        return (
            Date.now().toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 10)
        );

    }


    // ========================================================
    // TARGET MATCHING
    // ========================================================

    /*
     * SPPB:
     *   Target = SEWU
     *
     * NPPB:
     *   Target = Sekupang
     *
     * CEISA kadang menghasilkan variasi:
     *
     *   IDKSP - SEKUPANG
     *   IDSKP - SEKUPANG
     *   IDKSP
     *   IDSKP
     *   SEKUPANG
     *
     * Karena itu NPPB tidak boleh hanya dibandingkan
     * dengan string "IDKSP" secara persis.
     */


    function isNppbSekupang(value) {

        const text =
            normalizeUpper(value);


        if (!text) {
            return false;
        }


        // Bentuk paling aman:
        // harus ada SEKUPANG + salah satu kode.

        const hasSekupang =
            text.includes("SEKUPANG");


        const hasIdksp =
            text.includes("IDKSP");


        const hasIdskp =
            text.includes("IDSKP");


        if (
            hasSekupang &&
            (hasIdksp || hasIdskp)
        ) {
            return true;
        }


        // Fallback jika parser hanya mengembalikan
        // kode lokasi tanpa kata Sekupang.

        if (
            hasIdksp ||
            hasIdskp
        ) {
            return true;
        }


        return false;

    }


    function isSppbSewu(value) {

        const text =
            normalizeUpper(value);


        if (!text) {
            return false;
        }


        return text.includes("SEWU");

    }


    /*
     * Tentukan ulang hasil parser berdasarkan jenis dokumen.
     *
     * Ini sengaja dilakukan di content.js agar kita tidak
     * harus mengubah parser PDF yang sudah bekerja.
     */


    function resolveTargetMatch(
        result,
        documentType
    ) {

        if (!result) {
            return false;
        }


        // Kalau parser sudah menyatakan true,
        // langsung diterima.

        if (result.found === true) {
            return true;
        }


        const value =
            normalizeUpper(
                result.value || ""
            );


        if (!value) {
            return false;
        }


        // ----------------------------------------------------
        // NPPB → SEKU­PANG
        // ----------------------------------------------------

        if (
            documentType === "NPPB"
        ) {

            return isNppbSekupang(value);

        }


        // ----------------------------------------------------
        // SPPB → SEWU
        // ----------------------------------------------------

        if (
            documentType === "SPPB"
        ) {

            return isSppbSewu(value);

        }


        return false;

    }


    // ========================================================
    // COMPLETED NUMBERS
    // ========================================================

    // (duplicate loadCompletedNumbers removed — date-aware version is defined above)


    // ========================================================
    // SCAN CACHE
    // ========================================================

    function isWithinLast3Days(dateStr, timestamp) {
        return true;
    }

    function pruneScanCache3Days(cache) {
        return (cache && typeof cache === "object") ? cache : {};
    }

    async function loadScanCache() {
        const data =
            await chrome.storage.local.get(
                "ceisa_scan_cache"
            );

        const rawCache =
            (data.ceisa_scan_cache && typeof data.ceisa_scan_cache === "object")
                ? data.ceisa_scan_cache
                : {};

        scanCache = pruneScanCache3Days(rawCache);
        for (const item of Object.values(scanCache)) {
            if (!item) continue;
            const loc = String(item.location || item.value || "").toUpperCase();
            const isSewuLoc = loc.includes("SEWU") || loc.includes("SEKUPANG") || loc.includes("IDKSP") || loc.includes("IDSKP");
            const isBatuLoc = loc.includes("BATU AMPAR") || loc.includes("BATUAMPAR") || loc.includes("IDBTU");

            // Perbaiki Sewu yang salah berstatus red menjadi orange
            if (isSewuLoc && item.status === "red") {
                item.status = "orange";
            }
            // Perbaiki Batu Ampar yang salah berstatus orange menjadi red
            if (isBatuLoc && item.status === "orange") {
                item.status = "red";
            }
        }

    }


    async function saveScanCache() {
        scanCache = pruneScanCache3Days(scanCache);
        if (typeof storageSet === "function") {
            await storageSet({ ceisa_scan_cache: scanCache });
        } else {
            await chrome.storage.local.set({ ceisa_scan_cache: scanCache });
        }

        if (typeof syncWithWifiServer === "function") {
            syncWithWifiServer().catch(() => {});
        }
    }


    // ========================================================
    // COLORING
    // ========================================================

    function isBatuAmpar(itemOrCache, rowText = "") {
        if (!itemOrCache && !rowText) return false;

        // 1. Status definitif khusus Batu Ampar
        const status = itemOrCache?.status;
        if (status === "yellow" || status === "pink" || status === "cream" || status === "aqua") {
            return true;
        }
        // Status definitif khusus Sewu
        if (status === "green" || status === "purple" || status === "blue" || status === "orange") {
            return false;
        }

        // 2. Evaluasi lokasi spesifik
        const loc = String(itemOrCache?.location || itemOrCache?.value || itemOrCache?.target || "").toUpperCase();

        // Jika lokasi menyebutkan SEWU / SEKUPANG / IDKSP, maka pasti Sewu (BUKAN Batu Ampar!)
        if (loc.includes("SEWU") || loc.includes("SEKUPANG") || loc.includes("IDKSP") || loc.includes("IDSKP")) {
            return false;
        }

        // Jika lokasi menyebutkan BATU AMPAR / IDBTU, maka pasti Batu Ampar!
        if (loc.includes("BATU AMPAR") || loc.includes("BATUAMPAR") || loc.includes("IDBTU")) {
            return true;
        }

        // 3. Cek rowText di tabel CEISA jika ada
        if (rowText) {
            const upperRow = String(rowText).toUpperCase();
            if (upperRow.includes("SEWU") || upperRow.includes("SEKUPANG") || upperRow.includes("IDKSP") || upperRow.includes("IDSKP")) {
                return false;
            }
            if (upperRow.includes("BATU AMPAR") || upperRow.includes("BATUAMPAR") || upperRow.includes("IDBTU")) {
                return true;
            }
        }

        return false;
    }

    function isSekupang(itemOrCache, rowText = "") {
        return !isBatuAmpar(itemOrCache, rowText);
    }

    function isNumberInSet(setObj, numStr) {
        if (!setObj || !(setObj instanceof Set) || setObj.size === 0 || !numStr) return false;
        const raw = String(numStr).trim();
        if (setObj.has(raw)) return true;
        const unpadded = raw.replace(/^0+/, "");
        if (setObj.has(unpadded)) return true;
        const padded = raw.padStart(6, "0");
        if (setObj.has(padded)) return true;
        return false;
    }

    function determineRowColor(reg, itemRow, cached) {
        const rowText = itemRow?.innerText || "";
        const isPibPebPrinted = isNumberInSet(pibPebNumbers, reg);
        const isSppbPrinted = isNumberInSet(completedNumbers, reg);
        const batuAmpar = isBatuAmpar(cached, rowText);

        // 1. Both PIB/PEB & SPPB/NPPB Printed
        if (isPibPebPrinted && isSppbPrinted) {
            return batuAmpar ? "aqua" : "blue";
        }

        // 2. Only PIB/PEB Printed
        if (isPibPebPrinted && !isSppbPrinted) {
            return batuAmpar ? "pink" : "purple";
        }

        // 3. Only SPPB/NPPB Printed
        if (isSppbPrinted && !isPibPebPrinted) {
            return batuAmpar ? "yellow" : "green";
        }

        // 4. Belum Di-Print (TIDAK ADA di daftar Nomor Selesai Hijau maupun PIB/PEB)
        if (cached) {
            // Batu Ampar belum selesai WAJIB merah, dilarang oren!
            if (batuAmpar) {
                return "red";
            }

            // Sewu belum selesai WAJIB oren, dilarang merah!
            return "orange";
        }

        // Jika cache kosong & tidak di daftar selesai -> Tanpa Warna ("")
        return "";
    }


    function getColor(type) {

        if (type === "green") {
            return {
                background: "#22c55e",
                color: "#ffffff"
            };
        }

        if (type === "yellow") {
            return {
                background: "#ffd600",
                color: "#000000"
            };
        }

        if (type === "purple") {
            return {
                background: "#9333ea",
                color: "#ffffff"
            };
        }

        if (type === "pink" || type === "cream") {
            return {
                background: "#ec4899",
                color: "#ffffff"
            };
        }

        if (type === "blue") {
            return {
                background: "#2563eb",
                color: "#ffffff"
            };
        }

        if (type === "aqua" || type === "cyan") {
            return {
                background: "#06b6d4",
                color: "#ffffff"
            };
        }

        if (type === "orange") {
            return {
                background: "#ff9800",
                color: "#000000"
            };
        }

        if (type === "red") {
            return {
                background: "#ef4444",
                color: "#ffffff"
            };
        }

        return {
            background: "#9e9e9e",
            color: "#ffffff"
        };

    }


    function colorRegistrationNumber(
        row,
        registrationNumber,
        type
    ) {

        if (!row) {
            return false;
        }


        const cells =
            row.querySelectorAll("td");


        if (cells.length < 4) {
            return false;
        }


        const td = cells[3];


        const existing =
            Array.from(
                td.querySelectorAll(
                    "span[data-ceisa-registration]"
                )
            )
                .find(
                    span =>
                        span.dataset.ceisaRegistration ===
                        registrationNumber
                );


        if (!type) {
            if (existing) {
                try {
                    const textNode = document.createTextNode(existing.textContent || registrationNumber);
                    existing.parentNode.replaceChild(textNode, existing);
                } catch (_) {
                    existing.removeAttribute("style");
                    existing.removeAttribute("title");
                    delete existing.dataset.ceisaRegistration;
                }
            }
            return true;
        }

        const colors =
            getColor(type);


        if (existing) {

            existing.style.setProperty(
                "background",
                colors.background,
                "important"
            );


            existing.style.setProperty(
                "color",
                colors.color,
                "important"
            );


            return true;

        }


        const walker =
            document.createTreeWalker(
                td,
                NodeFilter.SHOW_TEXT
            );


        let node;


        while (
            node = walker.nextNode()
        ) {

            const text =
                node.nodeValue || "";


            if (
                !text.includes(
                    registrationNumber
                )
            ) {
                continue;
            }


            const index =
                text.indexOf(
                    registrationNumber
                );


            const before =
                document.createTextNode(
                    text.substring(
                        0,
                        index
                    )
                );


            const number =
                document.createElement("span");


            number.dataset.ceisaRegistration =
                registrationNumber;


            number.textContent =
                registrationNumber;


            number.style.setProperty(
                "background",
                colors.background,
                "important"
            );


            number.style.setProperty(
                "color",
                colors.color,
                "important"
            );


            number.style.setProperty(
                "font-weight",
                "700",
                "important"
            );


            number.style.setProperty(
                "padding",
                "2px 6px",
                "important"
            );


            number.style.setProperty(
                "border-radius",
                "4px",
                "important"
            );


            number.style.setProperty(
                "display",
                "inline-block",
                "important"
            );


            number.title =
                type === "blue"
                    ? "PIB/PEB Selesai (Sekupang + Sudah Selesai)"
                    : type === "purple"
                        ? "PIB/PEB Selesai (Sekupang - Baru Print)"
                        : (type === "cream" || type === "pink")
                            ? "PIB/PEB Selesai (Bukan Sekupang)"
                            : type === "yellow"
                                ? "Sudah selesai (Batu Ampar)"
                                : type === "green"
                                    ? "Sudah selesai"
                                    : type === "orange"
                                        ? "Target ditemukan"
                                        : "Target tidak ditemukan";


            const after =
                document.createTextNode(
                    text.substring(
                        index +
                        registrationNumber.length
                    )
                );


            const fragment =
                document.createDocumentFragment();


            fragment.appendChild(before);
            fragment.appendChild(number);
            fragment.appendChild(after);


            node.parentNode.replaceChild(
                fragment,
                node
            );


            return true;

        }


        return false;

    }


    // ========================================================
    // AUTO DATE DETECTION FROM CEISA PORTAL PAGE
    // ========================================================

    function todayISO() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function normalizeDate(str) {
        if (!str) return scanDate || todayISO();
        const dmyMatch = String(str).match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
        if (dmyMatch) {
            const day = String(dmyMatch[1]).padStart(2, "0");
            const month = String(dmyMatch[2]).padStart(2, "0");
            const year = dmyMatch[3];
            return `${year}-${month}-${day}`;
        }
        const ymdMatch = String(str).match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
        if (ymdMatch) {
            const year = ymdMatch[1];
            const month = String(ymdMatch[2]).padStart(2, "0");
            const day = String(ymdMatch[3]).padStart(2, "0");
            return `${year}-${month}-${day}`;
        }
        return scanDate || todayISO();
    }

    function parseDateString(str) {
        if (!str) return null;
        const clean = String(str).trim();

        // 1. ISO format: YYYY-MM-DD
        const isoMatches = Array.from(clean.matchAll(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g));
        if (isoMatches.length > 0) {
            const match = isoMatches[isoMatches.length - 1];
            const year = match[1];
            const month = String(match[2]).padStart(2, "0");
            const day = String(match[3]).padStart(2, "0");
            return `${year}-${month}-${day}`;
        }

        // 2. DMY format: DD/MM/YYYY or DD-MM-YYYY (handles date ranges e.g. "01/09/2026 - 21/09/2026")
        const dmyMatches = Array.from(clean.matchAll(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g));
        if (dmyMatches.length > 0) {
            const match = dmyMatches[dmyMatches.length - 1];
            const day = String(match[1]).padStart(2, "0");
            const month = String(match[2]).padStart(2, "0");
            const year = match[3];
            return `${year}-${month}-${day}`;
        }

        return null;
    }

    let lastDetectedPortalDate = null;

    function detectCeisaPortalDate() {
        // Priority 1: Currently focused input on CEISA page if it contains a date
        if (document.activeElement && document.activeElement.tagName === "INPUT") {
            const val = parseDateString(document.activeElement.value);
            if (val) return val;
        }

        // Priority 2: Scoped date filter inputs on CEISA page (Rule 3 compliant)
        const DATE_INPUT_SELECTORS = [
            'input[type="date"]',
            'input[name*="tanggal" i]',
            'input[name*="tgl" i]',
            'input[name*="date" i]',
            'input[id*="tanggal" i]',
            'input[id*="tgl" i]',
            'input[id*="date" i]',
            'input[placeholder*="tanggal" i]',
            'input[placeholder*="tgl" i]',
            'input[placeholder*="date" i]',
            'input[placeholder*="dd/mm/yyyy" i]',
            'input[placeholder*="dd-mm-yyyy" i]',
            'input[class*="datepicker" i]',
            'input[class*="date-picker" i]',
            'input[class*="flatpickr" i]',
            'input.ant-picker-input > input',
            'input.ant-calendar-picker-input'
        ].join(", ");

        const dateInputs = document.querySelectorAll(DATE_INPUT_SELECTORS);
        const dateValues = [];
        for (const input of dateInputs) {
            const val = parseDateString(input.value);
            if (val) dateValues.push(val);
        }

        if (dateValues.length > 0) {
            dateValues.sort();
            return dateValues[dateValues.length - 1];
        }

        // Priority 3: Dates visible in table rows (CEISA document list table)
        try {
            const tableDateCells = document.querySelectorAll("table tbody tr td");
            if (tableDateCells.length > 0) {
                const counts = {};
                for (let i = 0; i < Math.min(tableDateCells.length, 120); i++) {
                    const text = (tableDateCells[i].textContent || "").trim();
                    if (text.length >= 8 && text.length <= 25) {
                        const parsed = parseDateString(text);
                        if (parsed) {
                            counts[parsed] = (counts[parsed] || 0) + 1;
                        }
                    }
                }
                let bestDate = null;
                let maxCount = 0;
                for (const [d, count] of Object.entries(counts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        bestDate = d;
                    }
                }
                if (bestDate && maxCount >= 2) {
                    return bestDate;
                }
            }
        } catch (_) {}

        return null;
    }

    async function autoSyncDateFromCeisaPortal() {
        const activeDate = detectCeisaPortalDate();
        if (activeDate && activeDate !== lastDetectedPortalDate) {
            lastDetectedPortalDate = activeDate;
            scanDate = activeDate;
            await chrome.storage.local.set({
                ceisa_last_scan_date: activeDate,
                ceisa_scan_date: activeDate
            });
            try {
                chrome.runtime.sendMessage({
                    type: "CEISA_PORTAL_DATE_CHANGED",
                    date: activeDate
                }).catch(() => {});
            } catch (_) {}
            await Promise.all([
                loadCompletedNumbers(),
                loadPibPebNumbers(),
                loadScanCache()
            ]);
            recolorExistingRows();
        }
    }

    // Attach real-time input change & input interaction listeners to date inputs on CEISA page
    document.addEventListener("change", (e) => {
        if (e.target && e.target.tagName === "INPUT") {
            const val = parseDateString(e.target.value);
            if (val) {
                autoSyncDateFromCeisaPortal();
            }
        }
    }, true);

    document.addEventListener("input", (e) => {
        if (e.target && e.target.tagName === "INPUT") {
            const val = parseDateString(e.target.value);
            if (val) {
                autoSyncDateFromCeisaPortal();
            }
        }
    }, true);

    // Click listener to catch calendar picker day clicks, search, or filter button triggers
    let _portalClickSyncTimer = null;
    document.addEventListener("click", () => {
        if (_portalClickSyncTimer) clearTimeout(_portalClickSyncTimer);
        _portalClickSyncTimer = setTimeout(() => {
            _portalClickSyncTimer = null;
            autoSyncDateFromCeisaPortal();
        }, 300);
    }, true);


    // ========================================================
    // GET ROWS
    // ========================================================

    function getRows() {

        const rows =
            Array.from(
                document.querySelectorAll("tr")
            );


        const result = [];

        const seen = new Set();


        for (const row of rows) {

            const cells =
                row.querySelectorAll("td");


            if (cells.length < 5) {
                continue;
            }


            const registrationText =
                cells[3]?.innerText || "";


            const match =
                registrationText.match(
                    /\b\d{6}\b/
                );


            if (!match) {
                continue;
            }


            const registrationNumber =
                match[0];


            if (
                seen.has(
                    registrationNumber
                )
            ) {
                continue;
            }


            seen.add(
                registrationNumber
            );


            const rowDate =
                normalizeDate(
                    registrationText
                );


            const documentText =
                cells[4]?.innerText || "";


            const upperDocument =
                documentText.toUpperCase();


            let documentType = "";


            if (
                upperDocument.includes("SPPB")
            ) {

                documentType = "SPPB";

            }

            else if (
                upperDocument.includes("NPPB")
            ) {

                documentType = "NPPB";

            }


            const documentNumberMatch =
                documentText.match(
                    /\b\d{6}\/[A-Z0-9.]+\/\d{4}\b/i
                );


            const documentNumber =
                documentNumberMatch
                    ? documentNumberMatch[0]
                    : "";


            result.push({

                row,

                registrationNumber,

                rowDate,

                documentType,

                documentNumber

            });

        }


        return result;

    }


    // ========================================================
    // FIND DOCUMENT ELEMENT
    // ========================================================

    function findDocumentElement(
        row,
        documentNumber
    ) {

        if (!row) {
            return null;
        }


        const exact =
            Array.from(
                row.querySelectorAll("p")
            )
                .find(
                    element =>
                        normalizeText(
                            element.textContent
                        ) ===
                        documentNumber
                );


        if (exact) {
            return exact;
        }


        const all =
            Array.from(
                row.querySelectorAll("*")
            );


        return (

            all.find(
                element =>
                    element.children.length === 0 &&
                    normalizeText(
                        element.textContent
                    ) ===
                    documentNumber
            )

            ||

            null

        );

    }


    // ========================================================
    // ARM PDF CAPTURE
    // ========================================================

    function armPdfCapture(
        jobId,
        documentNumber
    ) {

        window.postMessage(

            {
                source:
                    "CEISA_AUTO_COLORING_CONTROL",

                type:
                    "ARM_PDF",

                jobId,

                documentNumber
            },

            "*"

        );

    }


    // ========================================================
    // WAIT PDF
    // ========================================================

    function waitForPdf(
        jobId,
        timeout = 20000
    ) {

        return new Promise(
            (resolve, reject) => {

                const timer =
                    setTimeout(
                        () => {

                            captureWaiters.delete(
                                jobId
                            );


                            reject(
                                new Error(
                                    "Timeout menunggu response PDF CEISA"
                                )
                            );

                        },
                        timeout
                    );


                captureWaiters.set(
                    jobId,
                    {

                        resolve: data => {

                            clearTimeout(timer);

                            resolve(data);

                        },


                        reject: error => {

                            clearTimeout(timer);

                            reject(error);

                        }

                    }
                );

            }
        );

    }


    // ========================================================
    // WAIT PARSER RESULT
    // ========================================================

    function waitForPdfResult(
        jobId,
        timeout = 40000
    ) {

        return new Promise(
            (resolve, reject) => {

                const timer =
                    setTimeout(
                        () => {

                            resultWaiters.delete(
                                jobId
                            );


                            reject(
                                new Error(
                                    "Timeout parsing PDF"
                                )
                            );

                        },
                        timeout
                    );


                resultWaiters.set(
                    jobId,
                    {

                        resolve: data => {

                            clearTimeout(timer);

                            resolve(data);

                        },


                        reject: error => {

                            clearTimeout(timer);

                            reject(error);

                        }

                    }
                );

            }
        );

    }


    // ========================================================
    // RUNTIME MESSAGES
    // ========================================================

    chrome.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {

            // ------------------------------------------------
            // PDF RESULT
            // ------------------------------------------------

            if (
                message.type === "PDF_RESULT"
            ) {

                const waiter =
                    resultWaiters.get(
                        message.jobId
                    );


                if (!waiter) {
                    return;
                }


                resultWaiters.delete(
                    message.jobId
                );


                waiter.resolve(
                    message.result
                );


                return;

            }


            // ------------------------------------------------
            // START
            // ------------------------------------------------

            if (
                message.type === "START_SCAN"
            ) {

                startScan(message);

                return;

            }


            // ------------------------------------------------
            // STOP
            // ------------------------------------------------

            if (
                message.type === "STOP_SCAN"
            ) {

                stopScan();

                return;

            }


            // ------------------------------------------------
            // REFRESH COLOR
            // ------------------------------------------------

            if (
                message.type === "REFRESH_COLOR"
            ) {

                Promise.all([
                    loadCompletedNumbers(),
                    loadPibPebNumbers(),
                    loadScanCache()
                ]).then(
                    () =>
                        recolorExistingRows()
                );

                return;

            }

            if (
                message.type === "GET_CEISA_PORTAL_DATE"
            ) {
                const detected = detectCeisaPortalDate();
                if (typeof sendResponse === "function") {
                    sendResponse({ date: detected || scanDate || todayISO() });
                }
                return false;
            }

            // ------------------------------------------------
            // CEISA AUTO INPUT ROW (STEP-BY-STEP INJECTION)
            // ------------------------------------------------
            if (message.type === "CEISA_AUTO_INPUT_ROW") {
                const res = handleCeisaAutoInputRow(message);
                if (typeof sendResponse === "function") {
                    sendResponse(res);
                }
                return false;
            }

            if (message.type === "CHECK_CEISA_PAGE") {
                if (typeof sendResponse === "function") {
                    sendResponse({ ok: true, url: window.location.href, title: document.title, isCeisa: true });
                }
                return false;
            }

        }
    );

    // ========================================================
    // CEISA 4.0 AUTO INPUT HELPER & DOM INJECTION ENGINE
    // ========================================================

    function escapeCeisaHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showCeisaAutoInputToast(title, body, type = "success") {
        try {
            let container = document.getElementById("ceisaAutoInputToastContainer");
            if (!container) {
                container = document.createElement("div");
                container.id = "ceisaAutoInputToastContainer";
                container.style.cssText = 'position: fixed; top: 24px; right: 24px; z-index: 999999999; display: flex; flex-direction: column; gap: 10px; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
                document.body.appendChild(container);
            }

            const toast = document.createElement("div");
            const borderColor = type === "success" ? "#10b981" : (type === "warn" ? "#f59e0b" : "#ef4444");

            toast.style.cssText = 'min-width: 300px; max-width: 440px; background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96)); border-left: 4px solid ' + borderColor + '; border-top: 1px solid rgba(255, 255, 255, 0.12); border-right: 1px solid rgba(255, 255, 255, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 14px 28px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 12px 16px; color: #f8fafc; font-size: 13px; line-height: 1.45; pointer-events: auto; opacity: 0; transform: translateX(30px); transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);';

            toast.innerHTML = '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">' +
                '<div style="display: flex; align-items: center; gap: 6px;">' +
                    '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ' + borderColor + '; box-shadow: 0 0 6px ' + borderColor + ';"></span>' +
                    '<strong style="color: #ffffff; font-size: 13px; letter-spacing: -0.2px;">' + escapeCeisaHtml(title) + '</strong>' +
                '</div>' +
                '<span style="font-size: 10px; background: rgba(255, 255, 255, 0.12); padding: 2px 6px; border-radius: 4px; color: #94a3b8; font-weight: 600;">CEISA 4.0 AUTO</span>' +
            '</div>' +
            '<div style="color: #cbd5e1; font-size: 12px;">' + escapeCeisaHtml(body) + '</div>';

            container.appendChild(toast);

            requestAnimationFrame(() => {
                toast.style.opacity = "1";
                toast.style.transform = "translateX(0)";
            });

            setTimeout(() => {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(30px)";
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 350);
            }, 3800);
        } catch (err) {
            console.warn("showCeisaAutoInputToast error:", err);
        }
    }

    function highlightCeisaInput(el) {
        if (!el) return;
        const prevTransition = el.style.transition;
        const prevOutline = el.style.outline;
        const prevBoxShadow = el.style.boxShadow;

        el.style.transition = "all 0.3s ease";
        el.style.outline = "2px solid #10b981";
        el.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.6)";

        setTimeout(() => {
            el.style.outline = prevOutline;
            el.style.boxShadow = prevBoxShadow;
            el.style.transition = prevTransition;
        }, 1500);
    }

    function setNativeInputValue(element, val) {
        if (!element) return false;
        try {
            element.focus();
            const strVal = String(val ?? "");

            // React 16+ / Ant Design value setter override
            const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
            const prototype = Object.getPrototypeOf(element);
            const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

            if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
                prototypeValueSetter.call(element, strVal);
            } else if (valueSetter) {
                valueSetter.call(element, strVal);
            } else {
                element.value = strVal;
            }

            // Dispatch events for React synthetic state sync
            element.dispatchEvent(new Event("focus", { bubbles: true }));
            element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            element.dispatchEvent(new Event("blur", { bubbles: true }));

            highlightCeisaInput(element);
            return true;
        } catch (e) {
            console.error("setNativeInputValue error:", e);
            return false;
        }
    }

    function findCeisaTargetContainer() {
        const openModal = document.querySelector(".ant-modal-wrap:not([style*='display: none']) .ant-modal, .ant-modal-content, .ant-drawer-content");
        if (openModal) return openModal;
        const activeTabPane = document.querySelector(".ant-tabs-tabpane-active, .tab-pane.active, .tab-content > .active");
        if (activeTabPane) return activeTabPane;
        return document;
    }

    function findFieldByKeywords(keywords, parent = document) {
        if (!parent) parent = document;

        // 1. Match by input name, id, placeholder, aria-label
        for (const kw of keywords) {
            const lowerKw = kw.toLowerCase();
            const candidates = parent.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');

            for (const input of candidates) {
                const name = (input.name || "").toLowerCase();
                const id = (input.id || "").toLowerCase();
                const placeholder = (input.placeholder || "").toLowerCase();
                const aria = (input.getAttribute("aria-label") || "").toLowerCase();

                if (name.includes(lowerKw) || id.includes(lowerKw) || placeholder.includes(lowerKw) || aria.includes(lowerKw)) {
                    return input;
                }
            }
        }

        // 2. Match by Label association
        const labels = Array.from(parent.querySelectorAll(".ant-form-item-label label, .form-group label, label"));
        for (const kw of keywords) {
            const lowerKw = kw.toLowerCase();
            for (const lbl of labels) {
                const text = (lbl.innerText || lbl.textContent || "").toLowerCase();
                if (text.includes(lowerKw)) {
                    const forId = lbl.getAttribute("for");
                    if (forId) {
                        const byId = parent.querySelector('#' + forId);
                        if (byId) return byId;
                    }
                    const formItem = lbl.closest(".ant-form-item, .form-group, .row, .col, div");
                    if (formItem) {
                        const inp = formItem.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
                        if (inp) return inp;
                    }
                }
            }
        }

        return null;
    }

    function switchCeisaActiveTab(section) {
        try {
            const tabKeywords = {
                'entitas': ['entitas', 'entity'],
                'dokumen': ['dokumen', 'lampiran', 'document'],
                'pengangkut': ['pengangkut', 'sarana', 'carrier'],
                'kemasan': ['kemasan', 'peti kemas', 'package', 'container'],
                'transaksi': ['transaksi', 'transaction'],
                'barang': ['barang', 'item', 'goods'],
                'pungutan': ['pungutan', 'levy', 'billing']
            };
            const kws = tabKeywords[section] || [section];
            const allTabs = Array.from(document.querySelectorAll('.ant-tabs-tab, .nav-tabs .nav-link, [role="tab"], .tab-item'));
            for (const tab of allTabs) {
                const text = (tab.textContent || '').toLowerCase().trim();
                if (kws.some(kw => text.includes(kw))) {
                    const btn = tab.querySelector('div, span, a') || tab;
                    btn.click();
                    return true;
                }
            }
        } catch (e) {
            console.warn('[Auto-Switch Tab Error]', e);
        }
        return false;
    }

    function handleCeisaAutoInputRow(message) {
        const { section, draftType, item, index, total } = message;
        if (!item) {
            return { ok: false, message: "Data baris kosong." };
        }

        // Buka tab CEISA yang sesuai secara otomatis jika belum aktif
        switchCeisaActiveTab(section);

        const container = findCeisaTargetContainer();
        const filledFields = [];

        // SECTION: DOKUMEN LAMPIRAN
        if (section === "dokumen") {
            const docCode = item.code || (item.type === "INVOICE" ? "380" : item.type === "PACKING_LIST" ? "217" : item.type === "BL" ? "705" : item.type === "COO" ? "861" : "380");
            const docNum = item.number || "";
            const docDate = item.date || "";

            const codeInput = findFieldByKeywords(["kodeDokumen", "kodeJenisDokumen", "jenisDokumen", "kode_dokumen", "kode jenis", "kode"], container);
            if (codeInput) {
                setNativeInputValue(codeInput, docCode);
                filledFields.push('Jenis: ' + docCode);
            }

            const numInput = findFieldByKeywords(["nomorDokumen", "nomor", "noDok", "no_dok", "no dokumen", "number"], container);
            if (numInput) {
                setNativeInputValue(numInput, docNum);
                filledFields.push('Nomor: ' + docNum);
            }

            const dateInput = findFieldByKeywords(["tanggalDokumen", "tanggal", "tglDok", "tgl_dok", "tgl", "date"], container);
            if (dateInput) {
                setNativeInputValue(dateInput, docDate);
                filledFields.push('Tanggal: ' + docDate);
            }

            const successMsg = 'Dokumen [' + (index + 1) + '/' + total + '] ' + (item.type || 'DOC') + ': ' + (docNum || docCode) + ' dimasukkan ke CEISA.';
            showCeisaAutoInputToast('Auto Input Dokumen (' + (index + 1) + '/' + total + ')', (item.name || item.type) + ': ' + docNum + ' (' + docDate + ')', filledFields.length > 0 ? 'success' : 'warn');

            return {
                ok: true,
                message: filledFields.length > 0 
                    ? successMsg + ' (' + filledFields.join(', ') + ')' 
                    : successMsg + ' (Form terdeteksi, pastikan modal Tambah Dokumen telah terbuka di CEISA).'
            };
        }

        // SECTION: DATA BARANG
        if (section === "barang") {
            const hs = String(item.hsCode || item.posTarif || "").replace(/[^0-9]/g, "");
            let desc = item.description || item.uraianJenisBarang || item.uraianBarang || item.namaBarang || "";
            let qty = item.quantity || item.jumlahSatuan || item.qty || "";
            let uom = item.uom || item.kodeSatuan || item.satuan || "";
            let val = item.cifValue || item.fobValue || item.nilaiBarang || item.amount || item.harga || "";
            let netto = item.netWeight || item.beratBersih || "";

            if (!qty && item.jumlahDanSatuanBarang) {
                const m = String(item.jumlahDanSatuanBarang).match(/^([\d\s.,]+)\s*([a-zA-Z/]+)?$/);
                if (m) {
                    qty = m[1].replace(/\s/g, "");
                    if (!uom && m[2]) uom = m[2];
                } else {
                    qty = item.jumlahDanSatuanBarang;
                }
            }

            const hsInput = findFieldByKeywords(["posTarif", "pos_tarif", "hsCode", "hs", "pos", "tarif"], container);
            if (hsInput) {
                setNativeInputValue(hsInput, hs || item.hsCode);
                filledFields.push('HS: ' + hs);
            }

            const descInput = findFieldByKeywords(["uraian", "namaBarang", "description", "deskripsi"], container);
            if (descInput) {
                setNativeInputValue(descInput, desc);
                filledFields.push('Uraian: ' + desc.substring(0, 20) + '...');
            }

            const qtyInput = findFieldByKeywords(["jumlahSatuan", "jumlah_satuan", "qty", "jumlah"], container);
            if (qtyInput) {
                setNativeInputValue(qtyInput, qty);
                filledFields.push('Qty: ' + qty);
            }

            const uomInput = findFieldByKeywords(["kodeSatuan", "kode_satuan", "satuan", "uom"], container);
            if (uomInput) {
                setNativeInputValue(uomInput, uom);
                filledFields.push('Satuan: ' + uom);
            }

            const valInput = findFieldByKeywords(["nilaiBarang", "nilaiPabean", "cif", "fob", "nilai", "harga"], container);
            if (valInput) {
                setNativeInputValue(valInput, val);
                filledFields.push('Nilai: ' + val);
            }

            const nettoInput = findFieldByKeywords(["netto", "beratBersih", "berat"], container);
            if (nettoInput) {
                setNativeInputValue(nettoInput, netto);
                filledFields.push('Netto: ' + netto);
            }

            const successMsg = 'Barang [' + (index + 1) + '/' + total + '] HS ' + hs + ': ' + desc.substring(0, 25) + ' dimasukkan.';
            showCeisaAutoInputToast('Auto Input Barang (' + (index + 1) + '/' + total + ')', 'HS ' + hs + ' | Qty: ' + qty + ' ' + uom + ' | Val: ' + val, filledFields.length > 0 ? 'success' : 'warn');

            return {
                ok: true,
                message: filledFields.length > 0
                    ? successMsg + ' (' + filledFields.join(', ') + ')'
                    : successMsg + ' (Field form barang terdeteksi, pastikan form barang aktif).'
            };
        }

        // SECTION: HEADER / ENTITAS / PENGANGKUT
        if (section === "header") {
            const noAju = item.nomorAju || item.noAju || "";
            const kdKantor = item.kodeKantor || item.kantorPabean || item.kantorAsal || "";
            const jnsPemasukan = item.jenisPemasukan || item.jenisImpor || "";
            const jnsPemberitahuan = item.jenisPemberitahuan || item.jenisProsedur || "";
            const katPemasukan = item.kategoriPemasukan || item.kategoriImpor || "";
            const tujPemasukan = item.tujuanPemasukan || "";
            const jnsPajak = item.jenisTransaksiPajak || item.jenisTransaksiPerpajakan || "";

            const ajuInput = findFieldByKeywords(["nomorAju", "noAju", "nomor_aju", "no_aju"], container);
            if (ajuInput && noAju) {
                setNativeInputValue(ajuInput, noAju);
                filledFields.push('No Aju: ' + noAju);
            }
            const ktrInput = findFieldByKeywords(["kodeKantor", "kantorPabean", "kantorAsal", "kantor"], container);
            if (ktrInput && kdKantor) {
                setNativeInputValue(ktrInput, kdKantor);
                filledFields.push('Kantor: ' + kdKantor);
            }
            const jnsInp = findFieldByKeywords(["jenisPemasukan", "jenisImpor", "jenis"], container);
            if (jnsInp && jnsPemasukan) {
                setNativeInputValue(jnsInp, jnsPemasukan);
                filledFields.push('Jenis: ' + jnsPemasukan);
            }
            const pmbInp = findFieldByKeywords(["jenisPemberitahuan", "jenisProsedur", "pemberitahuan"], container);
            if (pmbInp && jnsPemberitahuan) {
                setNativeInputValue(pmbInp, jnsPemberitahuan);
                filledFields.push('Pemberitahuan: ' + jnsPemberitahuan);
            }
            const katInp = findFieldByKeywords(["kategoriPemasukan", "kategoriImpor", "kategori"], container);
            if (katInp && katPemasukan) {
                setNativeInputValue(katInp, katPemasukan);
                filledFields.push('Kategori: ' + katPemasukan);
            }
            const tujInp = findFieldByKeywords(["tujuanPemasukan", "tujuan"], container);
            if (tujInp && tujPemasukan) {
                setNativeInputValue(tujInp, tujPemasukan);
                filledFields.push('Tujuan: ' + tujPemasukan);
            }
            const pjkInp = findFieldByKeywords(["jenisTransaksiPajak", "jenisTransaksiPerpajakan", "transaksiPajak", "pajak"], container);
            if (pjkInp && jnsPajak) {
                setNativeInputValue(pjkInp, jnsPajak);
                filledFields.push('Pajak: ' + jnsPajak);
            }
        }

        if (section === "entitas") {
            const shipper = item.shipperName || item.supplierName || item.eksportirNama || "";
            const consignee = item.consigneeName || item.importirName || item.pembeliNama || "";
            const importirId = item.importirId || item.npwpImportir || "";
            const importirNib = item.importirNib || item.nib || "";
            const importirAddr = item.importirAddress || item.consigneeAddress || "";
            const supplierAddr = item.supplierAddress || item.shipperAddress || "";
            const supplierCountry = item.supplierCountry || item.negaraPemasok || "";

            const csgInput = findFieldByKeywords(["namaImportir", "importir", "consignee", "penerima", "nama_importir"], container);
            if (csgInput && consignee) {
                setNativeInputValue(csgInput, consignee);
                filledFields.push('Importir: ' + consignee);
            }
            const idInput = findFieldByKeywords(["nomorIdentitasImportir", "npwpImportir", "idImportir", "npwp", "nomor identitas"], container);
            if (idInput && importirId) {
                setNativeInputValue(idInput, importirId);
                filledFields.push('NPWP: ' + importirId);
            }
            const nibInput = findFieldByKeywords(["nibImportir", "nib", "nomor induk berusaha"], container);
            if (nibInput && importirNib) {
                setNativeInputValue(nibInput, importirNib);
                filledFields.push('NIB: ' + importirNib);
            }
            const addrInput = findFieldByKeywords(["alamatImportir", "alamat", "alamat penerima"], container);
            if (addrInput && importirAddr) {
                setNativeInputValue(addrInput, importirAddr);
                filledFields.push('Alamat Imp: ' + importirAddr.substring(0, 15) + '...');
            }

            const shpInput = findFieldByKeywords(["namaPemasok", "namaEksportir", "pemasok", "eksportir", "shipper", "pengirim"], container);
            if (shpInput && shipper) {
                setNativeInputValue(shpInput, shipper);
                filledFields.push('Pemasok: ' + shipper);
            }
            const sAddrInput = findFieldByKeywords(["alamatPemasok", "alamatEksportir", "alamat pemasok"], container);
            if (sAddrInput && supplierAddr) {
                setNativeInputValue(sAddrInput, supplierAddr);
                filledFields.push('Alamat Pem: ' + supplierAddr.substring(0, 15) + '...');
            }
            const sCtryInput = findFieldByKeywords(["negaraPemasok", "negaraEksportir", "negara asal", "country"], container);
            if (sCtryInput && supplierCountry) {
                setNativeInputValue(sCtryInput, supplierCountry);
                filledFields.push('Negara: ' + supplierCountry);
            }
        }

        if (section === "pengangkut") {
            const caraAngkut = item.caraPengangkutan || item.modeTransport || "1 - LAUT";
            const vessel = item.vesselName || item.namaSaranaPengangkut || item.namaKapal || "";
            const voyage = item.voyageNumber || item.nomorPengangkut || item.voyage || "";
            const flag = item.vesselFlag || item.bendera || "";
            const portLoad = item.portLoading || item.pelabuhanMuat || "";
            const portDischarge = item.portDischarge || item.dischargePort || item.pelabuhanBongkar || "";
            const tps = item.tpsLocation || item.kodeTps || "";

            const caraInp = findFieldByKeywords(["caraPengangkutan", "cara angkut", "mode transport", "pengangkutan"], container);
            if (caraInp && caraAngkut) {
                setNativeInputValue(caraInp, caraAngkut);
                filledFields.push('Cara: ' + caraAngkut);
            }
            const vslInp = findFieldByKeywords(["namaSaranaPengangkut", "namaPengangkut", "nama kapal", "sarana pengangkut", "vessel"], container);
            if (vslInp && vessel) {
                setNativeInputValue(vslInp, vessel);
                filledFields.push('Sarana: ' + vessel);
            }
            const voyInp = findFieldByKeywords(["nomorPengangkut", "nomorVoyage", "voyage", "voy", "no pengangkut"], container);
            if (voyInp && voyage) {
                setNativeInputValue(voyInp, voyage);
                filledFields.push('Voyage: ' + voyage);
            }
            const flgInp = findFieldByKeywords(["benderaPengangkut", "bendera", "negara bendera", "flag"], container);
            if (flgInp && flag) {
                setNativeInputValue(flgInp, flag);
                filledFields.push('Bendera: ' + flag);
            }
            const pLoadInp = findFieldByKeywords(["pelabuhanMuat", "pelabuhan muat", "loading port", "port of loading"], container);
            if (pLoadInp && portLoad) {
                setNativeInputValue(pLoadInp, portLoad);
                filledFields.push('Muat: ' + portLoad);
            }
            const pDscInp = findFieldByKeywords(["pelabuhanBongkar", "pelabuhan bongkar", "pelabuhan tujuan", "discharge port"], container);
            if (pDscInp && portDischarge) {
                setNativeInputValue(pDscInp, portDischarge);
                filledFields.push('Bongkar: ' + portDischarge);
            }
            const tpsInp = findFieldByKeywords(["tempatPenimbunan", "kodeTps", "tps", "lokasi tps"], container);
            if (tpsInp && tps) {
                setNativeInputValue(tpsInp, tps);
                filledFields.push('TPS: ' + tps);
            }
        }

        if (section === "kemasan") {
            const pkgType = item.packageType || item.jenisKemasan || "CT - CARTON";
            const pkgQty = item.packageQty || item.jumlahKemasan || "";
            const pkgBrand = item.packageBrand || item.merekKemasan || "";
            const contNum = item.containerNumber || item.nomorKontainer || "";
            const contSize = item.containerSize || item.ukuranKontainer || "";
            const contType = item.containerType || item.jenisKontainer || "";
            const bruto = item.grossWeight || item.totalGrossWeightKGM || item.beratKotor || "";
            const netto = item.netWeight || item.totalNetWeightKGM || item.beratBersih || "";

            const typeInp = findFieldByKeywords(["jenisKemasan", "kodeJenisKemasan", "kemasan", "jenis kemasan", "package type"], container);
            if (typeInp && pkgType) {
                setNativeInputValue(typeInp, pkgType);
                filledFields.push('Kemasan: ' + pkgType);
            }
            const qtyInp = findFieldByKeywords(["jumlahKemasan", "jumlah kemasan", "banyak kemasan", "package qty"], container);
            if (qtyInp && pkgQty) {
                setNativeInputValue(qtyInp, pkgQty);
                filledFields.push('Jml Kemasan: ' + pkgQty);
            }
            const brandInp = findFieldByKeywords(["merekKemasan", "merek", "tanda kemasan"], container);
            if (brandInp && pkgBrand) {
                setNativeInputValue(brandInp, pkgBrand);
                filledFields.push('Merek: ' + pkgBrand);
            }
            const cntInp = findFieldByKeywords(["nomorKontainer", "nomor peti kemas", "nomor container", "peti kemas"], container);
            if (cntInp && contNum) {
                setNativeInputValue(cntInp, contNum);
                filledFields.push('Kontainer: ' + contNum);
            }
            const cszInp = findFieldByKeywords(["ukuranKontainer", "ukuran peti kemas", "size"], container);
            if (cszInp && contSize) {
                setNativeInputValue(cszInp, contSize);
                filledFields.push('Ukuran: ' + contSize);
            }
            const ctpInp = findFieldByKeywords(["jenisKontainer", "tipe kontainer", "tipe peti kemas"], container);
            if (ctpInp && contType) {
                setNativeInputValue(ctpInp, contType);
                filledFields.push('Tipe Peti Kemas: ' + contType);
            }
            const grsInp = findFieldByKeywords(["beratKotor", "bruto", "gross weight", "gross"], container);
            if (grsInp && bruto) {
                setNativeInputValue(grsInp, bruto);
                filledFields.push('Bruto: ' + bruto);
            }
            const netInp = findFieldByKeywords(["beratBersih", "netto", "net weight", "net"], container);
            if (netInp && netto) {
                setNativeInputValue(netInp, netto);
                filledFields.push('Netto: ' + netto);
            }
        }

        if (section === "transaksi") {
            const valuta = item.currency || item.valuta || "USD";
            const kurs = item.exchangeRate || item.kurs || item.ndpbm || "";
            const incoterm = item.incoterm || item.jenisTransaksi || "FOB";
            const invAmt = item.invoiceAmount || item.nilaiInvoice || item.fob || item.amount || "";
            const freight = item.freightAmount || item.freight || "";
            const asuransi = item.insuranceAmount || item.asuransi || "";
            const jnsAsuransi = item.insuranceType || "LN";

            const valInp = findFieldByKeywords(["kodeValuta", "valuta", "mata uang", "currency"], container);
            if (valInp && valuta) {
                setNativeInputValue(valInp, valuta);
                filledFields.push('Valuta: ' + valuta);
            }
            const krsInp = findFieldByKeywords(["kurs", "nilaiTukar", "exchange rate", "ndpbm"], container);
            if (krsInp && kurs) {
                setNativeInputValue(krsInp, kurs);
                filledFields.push('Kurs: ' + kurs);
            }
            const incoInp = findFieldByKeywords(["jenisHarga", "incoterm", "metode penyerahan", "cara penyerahan"], container);
            if (incoInp && incoterm) {
                setNativeInputValue(incoInp, incoterm);
                filledFields.push('Incoterm: ' + incoterm);
            }
            const amtInp = findFieldByKeywords(["nilaiTransaksi", "nilaiInvoice", "nilai barang", "fob", "harga barang"], container);
            if (amtInp && invAmt) {
                setNativeInputValue(amtInp, invAmt);
                filledFields.push('Nilai: ' + invAmt);
            }
            const frtInp = findFieldByKeywords(["freight", "ongkos angkut", "biaya pengangkutan"], container);
            if (frtInp && freight) {
                setNativeInputValue(frtInp, freight);
                filledFields.push('Freight: ' + freight);
            }
            const asrInp = findFieldByKeywords(["asuransi", "nilaiAsuransi", "insurance"], container);
            if (asrInp && asuransi) {
                setNativeInputValue(asrInp, asuransi);
                filledFields.push('Asuransi: ' + asuransi);
            }
            const jAsrInp = findFieldByKeywords(["jenisAsuransi", "asuransi bayar", "tipe asuransi"], container);
            if (jAsrInp && jnsAsuransi) {
                setNativeInputValue(jAsrInp, jnsAsuransi);
                filledFields.push('Jenis Asuransi: ' + jnsAsuransi);
            }
        }

        if (section === "pungutan") {
            const cifRp = item.cifRupiah || item.cifRp || item.nilaiPabeanRp || (item.pungutan && item.pungutan.cifRupiah) || item.pibPungutanCifRp || "";
            const tarifBm = item.tarifBm !== undefined ? item.tarifBm : (item.pungutan && item.pungutan.tarifBm !== undefined ? item.pungutan.tarifBm : "");
            const nilaiBm = item.nilaiBm || (item.pungutan && item.pungutan.nilaiBm) || "";
            const tarifPpn = item.tarifPpn !== undefined ? item.tarifPpn : (item.pungutan && item.pungutan.tarifPpn !== undefined ? item.pungutan.tarifPpn : "11");
            const nilaiPpn = item.nilaiPpn || (item.pungutan && item.pungutan.nilaiPpn) || "";
            const tarifPph = item.tarifPph !== undefined ? item.tarifPph : (item.pungutan && item.pungutan.tarifPph !== undefined ? item.pungutan.tarifPph : "2.5");
            const nilaiPph = item.nilaiPph || (item.pungutan && item.pungutan.nilaiPph) || "";
            const totalBilling = item.totalBilling || (item.pungutan && item.pungutan.totalBilling) || "";

            const cifInp = findFieldByKeywords(["nilaiPabean", "cifRupiah", "cif rp", "nilai impor", "cif (rp)"], container);
            if (cifInp && cifRp) {
                setNativeInputValue(cifInp, cifRp);
                filledFields.push('CIF Rp: ' + cifRp);
            }
            const tBmInp = findFieldByKeywords(["tarifBm", "tarif bea masuk", "bm tarif", "bm %"], container);
            if (tBmInp && tarifBm !== "") {
                setNativeInputValue(tBmInp, tarifBm);
                filledFields.push('Tarif BM: ' + tarifBm + '%');
            }
            const nBmInp = findFieldByKeywords(["nilaiBm", "nilai bea masuk", "bm bayar", "bea masuk bayar"], container);
            if (nBmInp && nilaiBm) {
                setNativeInputValue(nBmInp, nilaiBm);
                filledFields.push('Nilai BM: ' + nilaiBm);
            }
            const tPpnInp = findFieldByKeywords(["tarifPpn", "tarif ppn", "ppn %"], container);
            if (tPpnInp && tarifPpn !== "") {
                setNativeInputValue(tPpnInp, tarifPpn);
                filledFields.push('Tarif PPN: ' + tarifPpn + '%');
            }
            const nPpnInp = findFieldByKeywords(["nilaiPpn", "nilai ppn", "ppn bayar"], container);
            if (nPpnInp && nilaiPpn) {
                setNativeInputValue(nPpnInp, nilaiPpn);
                filledFields.push('Nilai PPN: ' + nilaiPpn);
            }
            const tPphInp = findFieldByKeywords(["tarifPph", "tarif pph", "pph %"], container);
            if (tPphInp && tarifPph !== "") {
                setNativeInputValue(tPphInp, tarifPph);
                filledFields.push('Tarif PPh: ' + tarifPph + '%');
            }
            const nPphInp = findFieldByKeywords(["nilaiPph", "nilai pph", "pph bayar"], container);
            if (nPphInp && nilaiPph) {
                setNativeInputValue(nPphInp, nilaiPph);
                filledFields.push('Nilai PPh: ' + nilaiPph);
            }
            const billInp = findFieldByKeywords(["totalBilling", "total tagihan", "total bayar", "billing"], container);
            if (billInp && totalBilling) {
                setNativeInputValue(billInp, totalBilling);
                filledFields.push('Billing: ' + totalBilling);
            }
        }

        showCeisaAutoInputToast('Auto Input Section: ' + section.toUpperCase(), 'Memasukkan parameter draft ' + section, 'success');
        return {
            ok: true,
            message: `Data section "${section}" berhasil diproses ke CEISA.`
        };
    }


    // ========================================================
    // STATUS
    // ========================================================

    async function updateStatus(status) {

        await chrome.storage.local.set({

            ceisa_scan_status:
                status,

            ceisa_scan_stats:
                stats

        });


        try {

            chrome.runtime.sendMessage({

                type:
                    "SCAN_STATUS_UPDATE",

                status,

                stats

            });

        } catch (_) { }

    }


    // ========================================================
    // RECOLOR EXISTING
    // ========================================================

    function recolorExistingRows() {
        // Skip if already running (prevents stacked calls from causing flicker)
        if (_recolorInProgress) return;
        _recolorInProgress = true;

        // Temporarily disconnect MutationObserver so DOM coloring
        // doesn't trigger another recolor cycle
        if (observer) observer.disconnect();

        try {
            const rows = getRows();
            let updated = false;

            for (const item of rows) {
                const reg = item.registrationNumber;
                const cached =
                    scanCache[reg] ||
                    scanCache[reg.padStart(6, "0")] ||
                    scanCache[reg.replace(/^0+/, "")];

                const color = determineRowColor(reg, item.row, cached);

                colorRegistrationNumber(item.row, reg, color || "");

                if (cached) {
                    if (color && cached.status !== color) {
                        const isOldCompleted = (cached.status === "green" || cached.status === "yellow" || cached.status === "blue" || cached.status === "purple" || cached.status === "pink" || cached.status === "aqua");
                        if (isOldCompleted) {
                            cached.status = color;
                            updated = true;
                        }
                    } else if (!color && (cached.status === "green" || cached.status === "yellow" || cached.status === "blue" || cached.status === "purple" || cached.status === "pink" || cached.status === "aqua")) {
                        if (!cached.companyName && !cached.location) {
                            delete scanCache[reg];
                            delete scanCache[reg.padStart(6, "0")];
                            delete scanCache[reg.replace(/^0+/, "")];
                        } else {
                            cached.status = "red";
                        }
                        updated = true;
                    }

                    if (!cached.documentType && item.documentType) {
                        cached.documentType = item.documentType;
                        cached.documentNumber = item.documentNumber;
                        updated = true;
                    }
                }
            }

            if (updated) {
                saveScanCache();
            }
        } finally {
            _recolorInProgress = false;
            // Re-attach observer after coloring is done
            if (observer) observer.observe(document.documentElement, { childList: true, subtree: true });
        }
    }


    // ========================================================
    // CLOSE PDF VIEWER
    // ========================================================

    async function closePdfViewer() {

        await sleep(300);


        const closeButton =
            document.querySelector(
                ".ant-modal-close"
            );


        if (closeButton) {

            try {

                closeButton.click();

                await sleep(250);

                return;

            } catch (_) { }

        }


        const buttons =
            Array.from(
                document.querySelectorAll("button")
            );


        const close =
            buttons.find(button => {

                const text =
                    normalizeText(
                        button.innerText
                    ).toLowerCase();


                const aria =
                    (
                        button.getAttribute(
                            "aria-label"
                        ) || ""
                    ).toLowerCase();


                return (

                    text === "close" ||

                    text === "tutup" ||

                    aria === "close" ||

                    aria === "tutup"

                );

            });


        if (close) {

            try {

                close.click();

                await sleep(250);

                return;

            } catch (_) { }

        }


        try {

            document.dispatchEvent(
                new KeyboardEvent(
                    "keydown",
                    {

                        key: "Escape",

                        code: "Escape",

                        keyCode: 27,

                        which: 27,

                        bubbles: true

                    }
                )
            );

        } catch (_) { }

    }


    // ========================================================
    // PROCESS ONE ROW
    // ========================================================

    async function processRow(item) {

        if (!scanning) {
            return;
        }


        const {
            row,
            registrationNumber,
            documentType,
            documentNumber
        } = item;


        console.log(
            "CEISA scan:",
            registrationNumber,
            documentType,
            documentNumber
        );


        // ----------------------------------------------------
        // SUDAH SELESAI (HIJAU)
        // ----------------------------------------------------

        const isCompleted = isNumberInSet(completedNumbers, registrationNumber);

        if (isCompleted) {
            const cached = scanCache[registrationNumber];
            const targetColor = determineRowColor(registrationNumber, row, cached);
            colorRegistrationNumber(
                row,
                registrationNumber,
                targetColor || "green"
            );

            if (cached) {
                cached.status = targetColor || "green";
                if (cached.companyName) {
                    stats.processed++;
                    stats.green++;
                    await updateStatus("scanning");
                    return;
                }
            }
        }


        // ----------------------------------------------------
        // CACHED (OREN / MERAH / ERROR DENGAN NAMA)
        // ----------------------------------------------------

        if (scanCache[registrationNumber]) {
            const cached = scanCache[registrationNumber];
            const targetColor = determineRowColor(registrationNumber, row, cached);

            if (targetColor && cached.companyName) {
                cached.status = targetColor;
                colorRegistrationNumber(
                    row,
                    registrationNumber,
                    targetColor
                );

                stats.processed++;
                if (targetColor === "green" || targetColor === "yellow") {
                    stats.green++;
                } else if (targetColor === "orange") {
                    stats.orange++;
                } else if (targetColor === "red") {
                    stats.red++;
                } else if (targetColor === "error") {
                    stats.error++;
                }

                await updateStatus("scanning");
                return;
            }
        }


        // ----------------------------------------------------
        // DOKUMEN TIDAK DIKENALI
        // ----------------------------------------------------

        if (
            !documentNumber ||
            !documentType
        ) {

            console.warn(
                "CEISA: dokumen tidak dikenali",
                registrationNumber
            );


            colorRegistrationNumber(
                row,
                registrationNumber,
                "error"
            );


            stats.processed++;
            stats.error++;


            await updateStatus("scanning");

            return;

        }


        const documentElement =
            findDocumentElement(
                row,
                documentNumber
            );


        if (!documentElement) {

            console.warn(
                "CEISA: elemen dokumen tidak ditemukan",
                documentNumber
            );


            colorRegistrationNumber(
                row,
                registrationNumber,
                "error"
            );


            stats.processed++;
            stats.error++;


            await updateStatus("scanning");

            return;

        }


        // ----------------------------------------------------
        // PREPARE
        // ----------------------------------------------------

        const jobId =
            generateJobId();


        const pdfPromise =
            waitForPdf(
                jobId,
                20000
            );


        const resultPromise =
            waitForPdfResult(
                jobId,
                40000
            );


        // ARM HARUS SEBELUM CLICK

        armPdfCapture(
            jobId,
            documentNumber
        );


        await sleep(100);


        // ----------------------------------------------------
        // CLICK NOMOR DOKUMEN
        // ----------------------------------------------------

        console.log(
            "CEISA: klik dokumen:",
            documentNumber
        );


        try {

            documentElement.click();

        } catch (error) {

            console.error(
                "CEISA click error:",
                error
            );


            captureWaiters.delete(jobId);
            resultWaiters.delete(jobId);


            colorRegistrationNumber(
                row,
                registrationNumber,
                "error"
            );


            stats.processed++;
            stats.error++;

            return;

        }


        // ----------------------------------------------------
        // WAIT PDF
        // ----------------------------------------------------

        let pdf;


        try {

            pdf =
                await pdfPromise;

        } catch (error) {

            console.error(
                "CEISA: PDF tidak tertangkap",
                registrationNumber,
                error
            );


            resultWaiters.delete(jobId);


            colorRegistrationNumber(
                row,
                registrationNumber,
                "error"
            );


            stats.processed++;
            stats.error++;


            await updateStatus("scanning");

            return;

        }


        console.log(
            "CEISA: PDF berhasil ditangkap",
            documentNumber,
            pdf.contentType
        );


        // ----------------------------------------------------
        // KIRIM PDF KE PARSER
        // ----------------------------------------------------

        try {

            await chrome.runtime.sendMessage({

                type:
                    "PARSE_PDF",

                jobId,

                documentNumber,

                documentType,

                base64:
                    pdf.base64

            });

        } catch (error) {

            console.error(
                "CEISA: gagal mengirim PDF ke parser",
                error
            );


            resultWaiters.delete(jobId);


            colorRegistrationNumber(
                row,
                registrationNumber,
                "error"
            );


            stats.processed++;
            stats.error++;

            return;

        }


        // ----------------------------------------------------
        // WAIT RESULT
        // ----------------------------------------------------

        let result;


        try {

            result =
                await resultPromise;

        } catch (error) {

            console.error(
                "CEISA: parser timeout",
                documentNumber,
                error
            );


            colorRegistrationNumber(
                row,
                registrationNumber,
                "error"
            );


            stats.processed++;
            stats.error++;


            await closePdfViewer();

            return;

        }


        console.log(
            "CEISA: hasil:",
            registrationNumber,
            result
        );


        // ----------------------------------------------------
        // TARGET MATCH
        // ----------------------------------------------------

        const found =
            resolveTargetMatch(
                result,
                documentType
            );


        console.log(
            "CEISA: target resolved:",
            {
                registrationNumber,
                documentType,
                documentNumber,
                parserFound:
                    result?.found,
                parserTarget:
                    result?.target,
                parserValue:
                    result?.value,
                finalFound:
                    found
            }
        );


        // ----------------------------------------------------
        // COLOR & CACHE
        // ----------------------------------------------------

        const computedColor = determineRowColor(registrationNumber, row, result || scanCache[registrationNumber]);

        // Prioritaskan hasil scan PDF (result) yang definitif!
        // Jangan timpa dengan row.innerText jika result dari PDF sudah jelas menyatakan SEWU atau Sekupang.
        let isBatuAmparItem = false;
        if (result && (result.value || result.target)) {
            isBatuAmparItem = isBatuAmpar(result);
        } else if (scanCache[registrationNumber]) {
            isBatuAmparItem = isBatuAmpar(scanCache[registrationNumber]);
        } else {
            isBatuAmparItem = isBatuAmpar(null, row?.innerText);
        }

        let finalStatus = computedColor;
        if (!finalStatus) {
            if (isCompleted) {
                finalStatus = isBatuAmparItem ? "yellow" : "green";
            } else {
                finalStatus = isBatuAmparItem ? "red" : (found ? "orange" : "red");
            }
        }

        // Proteksi ketat: Batu Ampar dilarang berwarna oren dalam kondisi apapun!
        if (isBatuAmparItem && finalStatus === "orange") {
            finalStatus = isCompleted ? "yellow" : "red";
        }


        colorRegistrationNumber(
            row,
            registrationNumber,
            finalStatus
        );

        if (finalStatus === "green" || finalStatus === "yellow" || finalStatus === "blue" || finalStatus === "purple" || finalStatus === "cream" || finalStatus === "pink" || finalStatus === "aqua") {
            stats.green++;
        } else if (finalStatus === "orange") {
            stats.orange++;
        } else {
            stats.red++;
        }


        scanCache[registrationNumber] = {

            registrationNumber,

            documentType,

            documentNumber,

            status:
                finalStatus,

            companyName:
                result?.companyName || "",

            location:
                result?.value || result?.target || (isBatuAmparItem ? "IDBTU - BATU AMPAR" : "SEWU"),

            rowDate:
                item.rowDate,

            timestamp:
                Date.now()

        };


        await saveScanCache();

        if (typeof pushSingleCacheItemToSupabase === "function") {
            pushSingleCacheItemToSupabase(scanCache[registrationNumber]).catch(() => {});
        }


        stats.processed++;


        await updateStatus("scanning");


        // ----------------------------------------------------
        // CLOSE PDF
        // ----------------------------------------------------

        await closePdfViewer();


        await sleep(500);

    }


    // ========================================================
    // START SCAN
    // ========================================================

    async function startScan(options) {

        if (scanning) {

            console.log(
                "CEISA: scan sudah berjalan"
            );

            return;

        }


        scanning = true;

        currentScanToken++;


        const token =
            currentScanToken;


        /*
         * Kompatibilitas dengan popup lama.
         * UI baru tidak perlu toggle semua tanggal.
         */

        scanAllDates =
            Boolean(
                options?.allDates
            );


        scanDate =
            options?.date ||
            todayISO();


        stats = {

            total: 0,

            processed: 0,

            green: 0,

            orange: 0,

            red: 0,

            error: 0

        };


        await loadCompletedNumbers();

        await loadScanCache();


        await updateStatus("scanning");


        console.log(
            "===================================="
        );


        console.log(
            "CEISA AUTO COLORING START"
        );


        console.log(
            "Tanggal:",
            scanAllDates
                ? "SEMUA"
                : scanDate
        );


        console.log(
            "Completed:",
            Array.from(
                completedNumbers
            )
        );


        console.log(
            "===================================="
        );


        // Tunggu table React

        await sleep(1000);


        const allRows =
            getRows();


        const rows =
            allRows.filter(item => {

                if (scanAllDates) {
                    return true;
                }


                return (
                    item.rowDate ===
                    scanDate
                );

            });


        stats.total =
            rows.length;


        console.log(
            "CEISA: rows ditemukan:",
            rows.length
        );


        await updateStatus("scanning");


        if (rows.length === 0) {

            console.warn(
                "CEISA: tidak ada row sesuai tanggal",
                scanDate
            );


            scanning = false;


            await updateStatus("done");

            return;

        }


        // ----------------------------------------------------
        // PROCESS
        // ----------------------------------------------------

        for (
            let i = 0;
            i < rows.length;
            i++
        ) {

            if (!scanning) {
                break;
            }


            if (
                token !==
                currentScanToken
            ) {
                break;
            }


            const item =
                rows[i];


            console.log(

                `CEISA: [${i + 1}/${rows.length}]`,

                item.registrationNumber,

                item.documentType,

                item.documentNumber

            );


            await processRow(item);


            await sleep(250);

        }


        // ----------------------------------------------------
        // DONE
        // ----------------------------------------------------

        if (
            token ===
            currentScanToken
        ) {

            scanning = false;

            await saveScanCache();
            if (typeof pushExactStateToWifiServer === "function") {
                const activeDate = await getActiveScanDate();
                const data = await chrome.storage.local.get([
                    `ceisa_completed_numbers_${activeDate}`,
                    `ceisa_pibpeb_numbers_${activeDate}`,
                    "ceisa_completed_numbers",
                    "ceisa_pibpeb_numbers",
                    "ceisa_scan_cache"
                ]);
                const comp = Array.isArray(data[`ceisa_completed_numbers_${activeDate}`])
                    ? data[`ceisa_completed_numbers_${activeDate}`]
                    : (activeDate === todayISO() && Array.isArray(data.ceisa_completed_numbers) ? data.ceisa_completed_numbers : []);
                const pib = Array.isArray(data[`ceisa_pibpeb_numbers_${activeDate}`])
                    ? data[`ceisa_pibpeb_numbers_${activeDate}`]
                    : (activeDate === todayISO() && Array.isArray(data.ceisa_pibpeb_numbers) ? data.ceisa_pibpeb_numbers : []);
                await pushExactStateToWifiServer(
                    comp,
                    pib,
                    data.ceisa_scan_cache || {},
                    activeDate
                );
            }

            await updateStatus("done");


            console.log(
                "===================================="
            );


            console.log(
                "CEISA AUTO COLORING SELESAI"
            );


            console.log(stats);


            console.log(
                "===================================="
            );

        }

    }


    // ========================================================
    // STOP
    // ========================================================

    async function stopScan() {

        scanning = false;

        currentScanToken++;


        // Cancel PDF capture

        for (
            const [jobId, waiter]
            of captureWaiters
        ) {

            waiter.reject(
                new Error(
                    "Scan dihentikan"
                )
            );

        }


        captureWaiters.clear();


        // Cancel parser

        for (
            const [jobId, waiter]
            of resultWaiters
        ) {

            waiter.reject(
                new Error(
                    "Scan dihentikan"
                )
            );

        }


        resultWaiters.clear();

        await saveScanCache();
        if (typeof pushExactStateToWifiServer === "function") {
            const activeDate = await getActiveScanDate();
            const data = await chrome.storage.local.get([
                `ceisa_completed_numbers_${activeDate}`,
                `ceisa_pibpeb_numbers_${activeDate}`,
                "ceisa_scan_cache"
            ]);
            await pushExactStateToWifiServer(
                data[`ceisa_completed_numbers_${activeDate}`] || [],
                data[`ceisa_pibpeb_numbers_${activeDate}`] || [],
                data.ceisa_scan_cache || {},
                activeDate
            );
        }

        await updateStatus("stopped");


        console.log(
            "CEISA Auto Coloring STOP"
        );

    }


    // ========================================================
    // MUTATION OBSERVER
    // ========================================================

    // MutationObserver: Recolor when page DOM changes (e.g. new rows loaded by React)
    // Using a long debounce (600ms) to avoid firing mid-scan when content.js
    // itself is modifying span tags — recolorExistingRows also disconnects/reconnects
    // the observer to prevent self-triggering.
    observer =
        new MutationObserver(() => {
            // Skip if we're inside a recolor (observer is disconnected then anyway)
            if (recolorTimer) {
                clearTimeout(recolorTimer);
            }
            recolorTimer = setTimeout(() => {
                recolorTimer = null;
                autoSyncDateFromCeisaPortal();
                recolorExistingRows();
            }, 600);
        });


    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );


    // ========================================================
    // STORAGE CHANGES
    // ========================================================

    // Debounce timer for storage changes to prevent rapid-fire recolors when
    // multiple storage keys are written simultaneously (e.g. by pushExactStateToSupabase)
    chrome.storage.onChanged.addListener(async changes => {
        if (changes.ceisa_last_scan_date && changes.ceisa_last_scan_date.newValue) {
            scanDate = changes.ceisa_last_scan_date.newValue;
        }

        const hasRelevantChange = Object.keys(changes).some(k =>
            k.includes("ceisa_completed_numbers") ||
            k.includes("ceisa_pibpeb_numbers") ||
            k.includes("ceisa_scan_cache") ||
            k.includes("ceisa_last_scan_date")
        );

        if (!hasRelevantChange) return;

        // Debounce: wait for all related storage writes to settle before recoloring
        if (_storageRecolorTimer) clearTimeout(_storageRecolorTimer);
        _storageRecolorTimer = setTimeout(async () => {
            _storageRecolorTimer = null;
            await Promise.all([
                loadCompletedNumbers(),
                loadPibPebNumbers(),
                loadScanCache()
            ]);
            recolorExistingRows();
        }, 150);
    });


    // Periodic background auto-sync date from CEISA portal filter and recolor
    setInterval(() => {
        autoSyncDateFromCeisaPortal();
        recolorExistingRows();
    }, 3000);

    // ========================================================
    // INITIAL
    // ========================================================

    async function initContentScript() {
        await autoSyncDateFromCeisaPortal();
        await Promise.all([
            loadCompletedNumbers(),
            loadPibPebNumbers(),
            loadScanCache()
        ]);
        recolorExistingRows();
    }

    initContentScript();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            initContentScript();
        });
    }

    // Bridge message dari Web Page (misal localhost/dashboard) ke Extension Background
    window.addEventListener("message", (event) => {
        if (!event.data) return;
        if (event.data.type === "CEISA_REQUEST_START_SERVER") {
            try {
                chrome.runtime.sendMessage({ type: "START_BACKEND_SERVER" }, (res) => {
                    window.postMessage({ type: "CEISA_START_SERVER_RESPONSE", response: res }, "*");
                });
            } catch (e) {
                window.postMessage({ type: "CEISA_START_SERVER_RESPONSE", response: { ok: false, error: e.message } }, "*");
            }
        }
    });

})();