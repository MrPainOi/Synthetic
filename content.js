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
            chrome.storage.local.set({ ceisa_last_scan_date: detected, ceisa_scan_date: detected }).catch(() => { });
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


    if ((typeof globalThis === "undefined" || globalThis.__CEISA_MODULE_MODE__ !== "autoinput") &&
        typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
        injectPageHook();
    }


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
            syncWithWifiServer().catch(() => { });
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
        } catch (_) { }

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
                }).catch(() => { });
            } catch (_) { }
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
            // CEISA AUTO INPUT ROW (STEP-BY-STEP & AUTO-SERI ASYNC INJECTION)
            // ------------------------------------------------
            if (message.type === "CEISA_AUTO_INPUT_ROW") {
                handleCeisaAutoInputRowAsync(message)
                    .then(res => {
                        if (typeof sendResponse === "function") {
                            sendResponse(res);
                        }
                    })
                    .catch(err => {
                        if (typeof sendResponse === "function") {
                            sendResponse({ ok: false, message: err?.message || "Gagal memproses Auto Input." });
                        }
                    });
                return true;
            }

            if (message.type === "CHECK_CEISA_PAGE") {
                if (typeof sendResponse === "function") {
                    sendResponse({ ok: true, url: window.location.href, title: document.title, isCeisa: true });
                }
                return false;
            }

            // ------------------------------------------------
            // CEISA ACTIVE TAB QUERY & SWITCH
            // ------------------------------------------------
            if (message.type === "GET_CEISA_ACTIVE_TAB") {
                const activeSec = detectCeisaActiveSection();
                if (typeof sendResponse === "function") {
                    sendResponse({ ok: true, activeSection: activeSec });
                }
                return false;
            }

            if (message.type === "CEISA_SWITCH_TAB") {
                const switched = switchCeisaActiveTab(message.section);
                if (typeof sendResponse === "function") {
                    sendResponse({ ok: true, switched: switched, activeSection: message.section });
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

            const raf = typeof requestAnimationFrame !== 'undefined'
                ? requestAnimationFrame
                : (typeof window !== 'undefined' && typeof window.requestAnimationFrame !== 'undefined'
                    ? window.requestAnimationFrame
                    : (cb) => setTimeout(cb, 16));
            raf(() => {
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

    function isElementHiddenOrInactive(el) {
        if (!el) return true;
        if (el.closest && el.closest(".ant-tabs-tabpane-hidden, [hidden], .ant-table-filter-dropdown")) {
            return true;
        }
        try {
            let cur = el;
            while (cur && cur.nodeType === 1) {
                const styleAttr = cur.getAttribute && cur.getAttribute("style");
                if (styleAttr && /display\s*:\s*none|visibility\s*:\s*hidden/i.test(styleAttr)) {
                    return true;
                }
                if (typeof getComputedStyle === "function") {
                    const cs = getComputedStyle(cur);
                    if (cs && (cs.display === "none" || cs.visibility === "hidden")) {
                        return true;
                    }
                }
                cur = cur.parentElement;
            }
        } catch (_) {}
        return false;
    }

    const _pendingAntSelectTasks = [];

    function selectMatchingAntDropdownOption(antSelectWrap, lowerTarget) {
        const dropdowns = Array.from(document.querySelectorAll(".ant-select-dropdown:not(.ant-select-dropdown-hidden)"));
        // Cari dropdown yang terlihat, atau jika belum ada di wrapper khusus cari semua dropdown options yang terlihat
        const optionNodes = [];
        const roots = dropdowns.length > 0 ? dropdowns : Array.from(document.querySelectorAll(".ant-select-dropdown"));
        for (const dd of roots) {
            if (isElementHiddenOrInactive(dd)) continue;
            dd.querySelectorAll(".ant-select-item-option").forEach(opt => optionNodes.push(opt));
        }
        if (optionNodes.length === 0) return false;

        // Prioritaskan exact -> prefix kode ("KGS - ..." / "39073090 - ...") -> word -> substring
        const getOptText = (opt) => (opt.getAttribute("title") || opt.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
        const codeToken = lowerTarget.split(/[\s-]+/)[0].trim();

        let matchedOpt = optionNodes.find(opt => getOptText(opt) === lowerTarget);
        if (!matchedOpt && codeToken.length >= 2) {
            matchedOpt = optionNodes.find(opt => {
                const txt = getOptText(opt);
                return txt === codeToken || txt.startsWith(codeToken + " ") || txt.startsWith(codeToken + "-");
            });
        }
        if (!matchedOpt && lowerTarget.length >= 2) {
            matchedOpt = optionNodes.find(opt => getOptText(opt).includes(lowerTarget));
        }

        if (matchedOpt && typeof matchedOpt.click === "function") {
            matchedOpt.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            matchedOpt.click();
            highlightCeisaInput(antSelectWrap);
            return true;
        }
        return false;
    }

    function setNativeInputValue(element, val) {
        if (!element) return false;
        const antSelectWrap = element.closest ? element.closest(".ant-select") : null;
        const isPickerInput = element.closest ? Boolean(element.closest(".ant-picker-input")) : false;
        if (element.disabled) return false;
        if (element.readOnly && !antSelectWrap && !isPickerInput) return false;

        try {
            if (typeof element.focus === "function") {
                try { element.focus(); } catch (e) { }
            }
            const strVal = String(val ?? "");

            // Ant Design <Select> / <AutoComplete> combobox support (JANGAN blur() agar async options tidak tertutup!)
            if (antSelectWrap) {
                const lowerTarget = strVal.toLowerCase().trim();
                try {
                    const lastValue = element.value;
                    const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
                    const protoSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
                    if (!element.readOnly) {
                        if (protoSetter && valueSetter !== protoSetter) protoSetter.call(element, strVal);
                        else if (valueSetter) valueSetter.call(element, strVal);
                        else element.value = strVal;
                        if (element._valueTracker) {
                            element._valueTracker.setValue(lastValue !== strVal ? lastValue : "");
                        }
                        element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
                        element.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                    const selector = antSelectWrap.querySelector(".ant-select-selector") || antSelectWrap;
                    if (selector && typeof selector.click === "function") {
                        selector.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                        selector.click();
                    }
                    const selectedNow = selectMatchingAntDropdownOption(antSelectWrap, lowerTarget);
                    if (!selectedNow && lowerTarget) {
                        _pendingAntSelectTasks.push({ antSelectWrap, element, strVal, lowerTarget });
                    }
                    highlightCeisaInput(antSelectWrap);
                    return true;
                } catch (_) {}
            }

            // If it is a SELECT element, match option by value or text
            if (element.tagName === "SELECT") {
                let matched = false;
                const lowerStr = strVal.toLowerCase().trim();

                if (lowerStr !== "") {
                    // Pass 1: Exact value or text match
                    for (let i = 0; i < element.options.length; i++) {
                        const opt = element.options[i];
                        const optVal = (opt.value || "").toLowerCase().trim();
                        const optTxt = (opt.text || "").toLowerCase().trim();
                        if (optVal === lowerStr || optTxt === lowerStr) {
                            element.selectedIndex = i;
                            matched = true;
                            break;
                        }
                    }

                    // Pass 2: Prefix / Code match (e.g. "6" matching "6 - NPWP 16 DIGIT" or "TAH" matching "TAH - Tidak berhubungan")
                    if (!matched) {
                        for (let i = 0; i < element.options.length; i++) {
                            const opt = element.options[i];
                            const optVal = (opt.value || "").toLowerCase().trim();
                            const optTxt = (opt.text || "").toLowerCase().trim();

                            if (optVal.length > 0 && (optVal.startsWith(lowerStr + ' ') || optVal.startsWith(lowerStr + '-') || optVal.startsWith(lowerStr + ':'))) {
                                element.selectedIndex = i;
                                matched = true;
                                break;
                            }
                            if (optTxt.length > 0 && (optTxt.startsWith(lowerStr + ' ') || optTxt.startsWith(lowerStr + '-') || optTxt.startsWith(lowerStr + ' -') || optTxt.startsWith(lowerStr + ':'))) {
                                element.selectedIndex = i;
                                matched = true;
                                break;
                            }
                            if (optVal.length > 0 && (lowerStr.startsWith(optVal + ' ') || lowerStr.startsWith(optVal + '-') || lowerStr.startsWith(optVal + ':'))) {
                                element.selectedIndex = i;
                                matched = true;
                                break;
                            }
                        }
                    }

                    // Pass 3: Whole word boundary match (e.g. \bHUB\b does not match "TAH - Tidak berhubungan")
                    if (!matched) {
                        const escapedStr = lowerStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const wordRegex = new RegExp('(?:^|\\b|\\s)' + escapedStr + '(?:$|\\b|\\s)', 'i');
                        for (let i = 0; i < element.options.length; i++) {
                            const opt = element.options[i];
                            const optVal = (opt.value || "").toLowerCase().trim();
                            const optTxt = (opt.text || "").toLowerCase().trim();
                            if ((optVal.length > 0 && wordRegex.test(optVal)) || (optTxt.length > 0 && wordRegex.test(optTxt))) {
                                element.selectedIndex = i;
                                matched = true;
                                break;
                            }
                        }
                    }

                    // Pass 4: Substring match with strict non-empty guards (never match against empty strings)
                    if (!matched && lowerStr.length >= 2) {
                        for (let i = 0; i < element.options.length; i++) {
                            const opt = element.options[i];
                            const optVal = (opt.value || "").toLowerCase().trim();
                            const optTxt = (opt.text || "").toLowerCase().trim();
                            const valMatch = optVal.length >= 2 && (optVal.includes(lowerStr) || (lowerStr.length >= 3 && lowerStr.includes(optVal)));
                            const txtMatch = optTxt.length >= 2 && (optTxt.includes(lowerStr) || (lowerStr.length >= 4 && lowerStr.includes(optTxt)));
                            if (valMatch || txtMatch) {
                                element.selectedIndex = i;
                                matched = true;
                                break;
                            }
                        }
                    }
                }

                if (!matched) {
                    try { element.value = strVal; } catch (e) { }
                }
            } else {
                // React 16+ / Ant Design value setter override + _valueTracker reset
                const lastValue = element.value;
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

                if (element._valueTracker) {
                    try {
                        element._valueTracker.setValue(lastValue !== strVal ? lastValue : "");
                    } catch (_) { }
                }

                if (element.tagName === "TEXTAREA" && element.value !== strVal) {
                    try {
                        Object.defineProperty(element, "value", {
                            get: () => strVal,
                            set: (v) => { strVal = String(v ?? ""); },
                            configurable: true
                        });
                    } catch (_) { }
                }
            }

            // Dispatch events for React synthetic state sync
            element.dispatchEvent(new Event("focus", { bubbles: true }));
            element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            if (typeof element.blur === "function") {
                try { element.blur(); } catch (e) { }
            }

            highlightCeisaInput(element);
            return true;
        } catch (e) {
            console.error("setNativeInputValue error:", e);
            return false;
        }
    }

    function countFormControls(el) {
        if (!el || typeof el.querySelectorAll !== "function") return 0;
        const list = el.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
        let visibleCount = 0;
        for (const inp of list) {
            if (!isElementHiddenOrInactive(inp)) visibleCount++;
        }
        return visibleCount;
    }

    function findCeisaTargetContainer() {
        // 1. Cek modal / drawer yang benar-benar terbuka dan berisi field input form
        const modalCandidates = Array.from(document.querySelectorAll(
            ".ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-modal, .ant-modal-wrap .ant-modal-content, .ant-drawer-open .ant-drawer-content, .ant-drawer .ant-drawer-content"
        ));
        for (let i = modalCandidates.length - 1; i >= 0; i--) {
            const m = modalCandidates[i];
            const wrap = m.closest(".ant-modal-wrap, .ant-drawer") || m;
            if (!isElementHiddenOrInactive(wrap) && !isElementHiddenOrInactive(m) && countFormControls(m) > 0) {
                return m;
            }
        }

        // 2. Cek tab pane aktif terdalam yang benar-benar terlihat dan memiliki kontrol form
        const activePanes = Array.from(document.querySelectorAll(".ant-tabs-tabpane-active, .tab-pane.active, .tab-content > .active"));
        for (let i = activePanes.length - 1; i >= 0; i--) {
            const p = activePanes[i];
            if (!isElementHiddenOrInactive(p) && countFormControls(p) > 0) {
                return p;
            }
        }

        return document;
    }

    function findFieldByKeywords(arg1, arg2 = document, options = {}) {
        let keywords = [];
        let parent = document;
        let opts = options || {};

        if (Array.isArray(arg1) || typeof arg1 === "string") {
            keywords = Array.isArray(arg1) ? arg1 : [arg1];
            parent = (arg2 && typeof arg2.querySelector === "function") ? arg2 : document;
        } else if (arg1 && typeof arg1.querySelector === "function") {
            parent = arg1;
            keywords = Array.isArray(arg2) ? arg2 : (typeof arg2 === "string" ? [arg2] : []);
        } else if (Array.isArray(arg2) || typeof arg2 === "string") {
            keywords = Array.isArray(arg2) ? arg2 : [arg2];
            parent = document;
        }

        const preferredKind = opts.preferredKind || "any"; // 'text' | 'select' | 'any'

        const isUsableControl = (inp) => {
            if (!inp || inp.disabled) return false;
            const inpType = String(inp.type || "").toLowerCase();
            if (inp.tagName === "INPUT" && (inpType === "hidden" || inpType === "radio" || inpType === "checkbox")) return false;
            if (isElementHiddenOrInactive(inp)) return false;
            const inSelect = inp.closest ? Boolean(inp.closest(".ant-select")) : false;
            const inPicker = inp.closest ? Boolean(inp.closest(".ant-picker-input")) : false;
            if (inp.readOnly && !inSelect && !inPicker) return false;
            return true;
        };

        const matchesPreferredKind = (inp) => {
            if (!isUsableControl(inp)) return false;
            const isSelectLike = inp.tagName === "SELECT" || Boolean(inp.closest && inp.closest(".ant-select"));
            if (preferredKind === "select") return isSelectLike;
            if (preferredKind === "text") return !isSelectLike;
            return true;
        };

        const rawCandidates = Array.from(parent.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'));
        const candidates = rawCandidates.filter(matchesPreferredKind);
        const fallbackCandidates = preferredKind !== "any" ? rawCandidates.filter(isUsableControl) : [];

        // 1. Match by input name, id, placeholder, aria-label, data-* attributes
        const findAttrMatch = (list) => {
            for (const kw of keywords) {
                const lowerKw = kw.toLowerCase();
                for (const input of list) {
                    const name = (input.name || "").toLowerCase();
                    const id = (input.id || "").toLowerCase();
                    const placeholder = (input.placeholder || "").toLowerCase();
                    const aria = (input.getAttribute("aria-label") || "").toLowerCase();
                    const testId = (input.getAttribute("data-testid") || input.getAttribute("data-field") || "").toLowerCase();

                    if (name.includes(lowerKw) || id.includes(lowerKw) || placeholder.includes(lowerKw) || aria.includes(lowerKw) || testId.includes(lowerKw)) {
                        return input;
                    }
                }
            }
            return null;
        };

        const attrHit = findAttrMatch(candidates);
        if (attrHit) return attrHit;

        // 2. Match by Label / Heading association (urutan ketat dari leaf label -> DOM sibling/row -> visual bounding-box)
        const isGenericContainerTag = (el) => {
            const tag = el.tagName;
            if (tag !== "DIV" && tag !== "TD") return false;
            if (el.classList && (el.classList.contains("ant-form-item-label") || el.classList.contains("ceisa-item-label") || el.classList.contains("ant-descriptions-item-label") || el.classList.contains("ant-col"))) {
                return false;
            }
            return true;
        };

        const labelEls = Array.from(parent.querySelectorAll(
            ".ant-form-item-label label, .ant-form-item-label, .form-group label, label, .ceisa-item-label, .ant-descriptions-item-label, th, td, div, span, p, strong, b, h4, h5, h6"
        )).filter(el => {
            if (isElementHiddenOrInactive(el)) return false;
            if (el.querySelector && el.querySelector("input, textarea, select")) return false;
            if (isGenericContainerTag(el) && el.querySelector && el.querySelector("div, td, p, label, table, ul, ol, h4, h5, h6")) {
                return false;
            }
            const rawTxt = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
            if (!rawTxt || rawTxt.length > 90) return false;
            return true;
        });

        const getControlsIn = (rootEl) => {
            if (!rootEl || typeof rootEl.querySelectorAll !== "function") return [];
            return Array.from(rootEl.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'))
                .filter(isUsableControl);
        };

        const pickFirstControlIn = (rootEl) => {
            const allCtrls = getControlsIn(rootEl);
            if (allCtrls.length === 0) return null;
            const preferred = allCtrls.find(matchesPreferredKind);
            if (preferred) return preferred;
            return preferredKind === "any" ? allCtrls[0] : null;
        };

        const isSingleFieldRowBox = (box) => {
            if (!box) return false;
            const cnt = getControlsIn(box).length;
            return cnt >= 1 && cnt <= 4;
        };

        const findControlByVisualProximity = (lbl, controlList) => {
            if (!lbl || typeof lbl.getBoundingClientRect !== "function" || !controlList || controlList.length === 0) return null;
            const lblRect = lbl.getBoundingClientRect();
            if (!lblRect || lblRect.width <= 0 || lblRect.height <= 0) return null;

            const lblMidY = lblRect.top + lblRect.height / 2;
            let bestHorizontal = null;
            let bestHorizontalScore = Infinity;
            let bestBelow = null;
            let bestBelowScore = Infinity;

            for (const ctrl of controlList) {
                const anchorEl = (ctrl.closest && ctrl.closest(".ant-select, .ant-input-number, .ant-input-affix-wrapper, .ant-picker")) || ctrl;
                let r = typeof anchorEl.getBoundingClientRect === "function" ? anchorEl.getBoundingClientRect() : null;
                if ((!r || r.width <= 0 || r.height <= 0) && anchorEl !== ctrl && typeof ctrl.getBoundingClientRect === "function") {
                    r = ctrl.getBoundingClientRect();
                }
                if (!r || r.width <= 0 || r.height <= 0) continue;

                const ctrlMidY = r.top + r.height / 2;
                const dy = Math.abs(ctrlMidY - lblMidY);
                const maxSameRowDy = Math.max(24, lblRect.height * 0.9, r.height * 0.75);
                const dx = r.left - lblRect.right;

                // Prioritas 1: Sejajar horizontal di sebelah kanan label ([Label] [Input] [Select])
                if (dy <= maxSameRowDy && dx >= -24 && dx <= 460 && r.right > lblRect.left) {
                    const score = dy * 4 + Math.max(0, dx);
                    if (score < bestHorizontalScore) {
                        bestHorizontalScore = score;
                        bestHorizontal = ctrl;
                    }
                    continue;
                }

                // Prioritas 2: Bertumpuk vertikal tepat di bawah label
                const vGap = r.top - lblRect.bottom;
                const xAlignDiff = Math.abs(r.left - lblRect.left);
                const horizOverlap = r.left < lblRect.right + 40 && r.right > lblRect.left - 24;
                if (vGap >= -8 && vGap <= 48 && (xAlignDiff <= 140 || horizOverlap)) {
                    const score = Math.max(0, vGap) * 2 + xAlignDiff * 0.5;
                    if (score < bestBelowScore) {
                        bestBelowScore = score;
                        bestBelow = ctrl;
                    }
                }
            }

            return bestHorizontal || bestBelow || null;
        };

        for (const kw of keywords) {
            const lowerKw = kw.toLowerCase();
            const matchingLabels = [];
            for (const lbl of labelEls) {
                const text = (lbl.innerText || lbl.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
                if (!text || text.length > 90 || !text.includes(lowerKw)) continue;
                const cleanText = text.replace(/[*:\s]+$/g, "").trim();
                const isExact = cleanText === lowerKw || text === lowerKw;
                const isExplicitLabel = Boolean(lbl.tagName === "LABEL" || (lbl.classList && (lbl.classList.contains("ant-form-item-label") || lbl.classList.contains("ceisa-item-label") || lbl.classList.contains("ant-descriptions-item-label"))));
                matchingLabels.push({ lbl, text, isExact, isExplicitLabel, len: text.length });
            }

            matchingLabels.sort((a, b) =>
                (a.isExact !== b.isExact ? (a.isExact ? -1 : 1) : 0) ||
                (a.isExplicitLabel !== b.isExplicitLabel ? (a.isExplicitLabel ? -1 : 1) : 0) ||
                (a.len - b.len)
            );

            for (const { lbl } of matchingLabels) {
                const forAttr = lbl.getAttribute("for") || lbl.querySelector?.("label[for]")?.getAttribute("for");
                if (forAttr) {
                    let byId = null;
                    try {
                        byId = (typeof document !== "undefined" && document.getElementById(forAttr)) ||
                            (typeof CSS !== "undefined" && CSS.escape ? parent.querySelector("#" + CSS.escape(forAttr)) : null);
                    } catch (_) {}
                    if (byId && (!parent.contains || parent === document || parent.contains(byId)) && matchesPreferredKind(byId)) {
                        return byId;
                    }
                }

                // A. Single-field Ant Design / form-group wrappers
                const singleItemWrap = lbl.closest(".ant-form-item, .form-group, .ceisa-item-row, fieldset");
                if (singleItemWrap && isSingleFieldRowBox(singleItemWrap)) {
                    const inp = pickFirstControlIn(singleItemWrap);
                    if (inp) return inp;
                }

                // B1. Sibling langsung dari leaf label (mis. <div>Label</div><div><input></div>)
                let directSib = lbl.nextElementSibling;
                let directHops = 0;
                while (directSib && directHops < 3) {
                    const directInp = pickFirstControlIn(directSib);
                    if (directInp) return directInp;
                    directSib = directSib.nextElementSibling;
                    directHops++;
                }

                // B2. Horizontal Ant Design / grid column siblings: [Label Col] [Control Col 1] [Control Col 2]
                const colEl = lbl.closest(".ant-form-item-label, .ant-col");
                if (colEl) {
                    let sib = colEl.nextElementSibling;
                    let hops = 0;
                    while (sib && hops < 3) {
                        const sibInp = pickFirstControlIn(sib);
                        if (sibInp) return sibInp;
                        sib = sib.nextElementSibling;
                        hops++;
                    }
                }

                // C. Baris lokal (.ant-row / tr / .row / .col) HANYA jika berisi <= 4 kontrol field itu saja
                const localRow = lbl.closest(".ant-row, tr, .row, .col");
                if (localRow && isSingleFieldRowBox(localRow)) {
                    const rowInp = pickFirstControlIn(localRow);
                    if (rowInp) return rowInp;
                }
            }

            // 3. Visual bounding-box proximity fallback (ketika struktur DOM grid custom tidak memakai .ant-col/.ant-row standar)
            for (const { lbl } of matchingLabels) {
                const visualInp = findControlByVisualProximity(lbl, candidates);
                if (visualInp) return visualInp;
            }
        }

        if (preferredKind === "text" && fallbackCandidates.length > 0) {
            return findAttrMatch(fallbackCandidates);
        }

        return null;
    }

    function detectCeisaActiveSection() {
        const normalizeSectionName = (rawText) => {
            if (!rawText || typeof rawText !== 'string') return null;
            const text = rawText.toLowerCase().trim();
            if (text.includes('header')) return 'header';
            if (text.includes('entitas') || text.includes('entity')) return 'entitas';
            if (text.includes('dokumen') || text.includes('lampiran') || text.includes('document')) return 'dokumen';
            if (text.includes('pengangkut') || text.includes('sarana') || text.includes('carrier')) return 'pengangkut';
            if (text.includes('kemasan') || text.includes('peti kemas') || text.includes('package') || text.includes('container')) return 'kemasan';
            if (text.includes('transaksi') || text.includes('transaction')) return 'transaksi';
            if (text.includes('barang') || text.includes('item') || text.includes('goods')) return 'barang';
            if (text.includes('pungutan') || text.includes('levy') || text.includes('billing')) return 'pungutan';
            if (text.includes('pernyataan') || text.includes('statement')) return 'pernyataan';
            return null;
        };

        // 1. Check active tab element in Ant Design or standard tabbars
        const activeTab = document.querySelector(
            '.ant-tabs-tab-active, [role="tab"][aria-selected="true"], .nav-tabs .nav-link.active, .tab-item.active, .tab-button.active, .ceisa-tab-btn.active, .tab-btn.active'
        );
        if (activeTab) {
            const sec = normalizeSectionName(activeTab.textContent);
            if (sec) return sec;
        }

        // 2. Scan all tabs in case active state is indicated by aria-selected or class
        const allTabs = document.querySelectorAll('.ant-tabs-tab, [role="tab"], .ceisa-tab-btn, .nav-tabs .nav-link');
        for (const tab of allTabs) {
            if (tab.classList.contains('ant-tabs-tab-active') || 
                tab.getAttribute('aria-selected') === 'true' || 
                tab.classList.contains('active')) {
                const sec = normalizeSectionName(tab.textContent);
                if (sec) return sec;
            }
        }

        // 3. Check active tabpane container
        const activePane = document.querySelector(
            '.ant-tabs-tabpane-active, .tab-pane.active, .tab-content > .active, section.tab-content-panel.active'
        );
        if (activePane) {
            const id = (activePane.id || '').toLowerCase();
            const secFromId = normalizeSectionName(id);
            if (secFromId) return secFromId;

            if (activePane.querySelector('input[name*="posTarif"], input[id*="posTarif"], input[placeholder*="Pos Tarif"]')) return 'barang';
            if (activePane.querySelector('input[name*="nilaiPabean"], input[name*="beaMasuk"]')) return 'pungutan';
            if (activePane.querySelector('input[name*="kodeValuta"], input[name*="valuta"], input[name*="nilaiTransaksi"]')) return 'transaksi';
            if (activePane.querySelector('input[name*="nomorDokumen"], input[name*="kodeDokumen"]')) return 'dokumen';
            if (activePane.querySelector('input[name*="caraPengangkutan"], input[name*="namaSaranaPengangkut"]')) return 'pengangkut';
            if (activePane.querySelector('input[name*="jenisKemasan"], input[name*="nomorKontainer"]')) return 'kemasan';
            if (activePane.querySelector('input[name*="nomorAju"], input[name*="kantorPabean"]')) return 'header';
            if (activePane.querySelector('input[name*="pemberitahu"], input[name*="kotaPernyataan"]')) return 'pernyataan';
            if (activePane.querySelector('.card-pengirim, .card-penerima, input[name*="pemasok"], input[name*="importir"]')) return 'entitas';
        }

        return null;
    }

    function switchCeisaActiveTab(section) {
        try {
            const tabKeywords = {
                'header': ['header', 'data utama', 'pemberitahuan'],
                'entitas': ['entitas', 'entity'],
                'dokumen': ['dokumen', 'lampiran', 'document'],
                'pengangkut': ['pengangkut', 'sarana', 'carrier'],
                'kemasan': ['kemasan', 'peti kemas', 'package', 'container'],
                'transaksi': ['transaksi', 'transaction'],
                'barang': ['barang', 'item', 'goods'],
                'pungutan': ['pungutan', 'levy', 'billing'],
                'pernyataan': ['pernyataan', 'statement']
            };
            const kws = tabKeywords[section] || [section];
            const allTabs = Array.from(document.querySelectorAll('.ant-tabs-tab, .nav-tabs .nav-link, [role="tab"], .tab-item, .ceisa-tab-btn'));
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

    // ========================================================
    // REAL-TIME CEISA ACTIVE TAB TRACKER & SYNCHRONIZER
    // ========================================================
    let lastObservedCeisaSection = null;

    function notifyCeisaActiveTabChange(forcedSection = null) {
        const currentSec = forcedSection || detectCeisaActiveSection();
        if (!currentSec || currentSec === lastObservedCeisaSection) return;

        lastObservedCeisaSection = currentSec;

        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ ceisa_current_active_tab: currentSec }).catch(() => {});
            }
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    type: "CEISA_ACTIVE_TAB_CHANGED",
                    activeSection: currentSec
                }, () => {
                    if (chrome.runtime?.lastError) { /* ignore error when popup closed */ }
                });
            }
        } catch (_) {}
    }

    const __CEISA_MODULE_MODE__ = (typeof globalThis !== "undefined" && globalThis.__CEISA_MODULE_MODE__) || "full";
    const __IS_SCANNER_MODULE__ = __CEISA_MODULE_MODE__ !== "autoinput";
    const __IS_AUTOINPUT_MODULE__ = __CEISA_MODULE_MODE__ !== "scanner";

    if (typeof document !== 'undefined' && __IS_AUTOINPUT_MODULE__) {
        document.addEventListener('click', (e) => {
            const tabEl = e.target?.closest?.('.ant-tabs-tab, [role="tab"], .ceisa-tab-btn, .nav-tabs .nav-link, .tab-item');
            if (tabEl) {
                setTimeout(() => {
                    notifyCeisaActiveTabChange();
                }, 120);
            }
        }, true);

        if (typeof MutationObserver !== 'undefined' && document.body) {
            let tabObserverTimeout = null;
            const tabObserver = new MutationObserver(() => {
                if (tabObserverTimeout) clearTimeout(tabObserverTimeout);
                tabObserverTimeout = setTimeout(() => {
                    notifyCeisaActiveTabChange();
                }, 250);
            });
            tabObserver.observe(document.body, {
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'aria-selected', 'aria-hidden']
            });
        }
    }

    function findCeisaCard(target, container = document) {
        if (!container) container = document;

        const cardRegexMap = {
            'pengirim': /(?:^|\b)(?:pengirim|shipper|supplier)(?:\b|$)/i,
            'penerima': /(?:^|\b)(?:penerima|importir|importer|consignee)(?:\b|$)/i,
            'pembeli': /(?:^|\b)(?:pembeli|buyer)(?:\b|$)/i,
            'penjual': /(?:^|\b)(?:penjual|seller)(?:\b|$)/i,
            'pemilik': /(?:^|\b)(?:pemilik(?:\s*barang)?|owner)(?:\b|$)/i,
            'pemilikbarang': /(?:^|\b)(?:pemilik(?:\s*barang)?|owner)(?:\b|$)/i,
            'ppjk': /(?:^|\b)(?:ppjk|broker)(?:\b|$)/i
        };

        let regex = null;
        let cardKey = '';

        if (target instanceof RegExp) {
            regex = target;
            cardKey = target.source.toLowerCase();
        } else if (typeof target === 'string') {
            const clean = target.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cardRegexMap[clean]) {
                regex = cardRegexMap[clean];
                cardKey = clean;
            } else {
                regex = new RegExp(target, 'i');
                cardKey = target.toLowerCase();
            }
        }

        // 1. Direct class name shortcut (e.g. .card-pengirim, .card-penerima in test harness or customized DOM)
        if (cardKey) {
            const baseKey = cardKey.includes('pengirim') ? 'pengirim' :
                cardKey.includes('penerima') ? 'penerima' :
                    cardKey.includes('pembeli') ? 'pembeli' :
                        cardKey.includes('penjual') ? 'penjual' :
                            cardKey.includes('pemilik') ? 'pemilik' :
                                cardKey.includes('ppjk') ? 'ppjk' : '';
            if (baseKey) {
                const classMatch = container.querySelector(`.card-${baseKey}, [data-card*="${baseKey}"]`);
                if (classMatch) return classMatch;
            }
        }

        // Helper to extract clean title text isolated from action buttons and extra header controls
        const extractCardTitle = (cardEl) => {
            // First look for pure title elements
            const titleEl = cardEl.querySelector('.ant-card-head-title, .card-title, .ceisa-card-title, h4, h5, h6, legend');
            if (titleEl) {
                return (titleEl.innerText || titleEl.textContent || '').trim();
            }
            // If only container header exists, clone and remove buttons/extra to avoid contamination
            const headerContainer = cardEl.querySelector('.ant-card-head, .card-header');
            if (headerContainer) {
                try {
                    const clone = headerContainer.cloneNode(true);
                    clone.querySelectorAll('.ant-card-extra, button, [role="button"], a').forEach(el => el.remove());
                    return (clone.innerText || clone.textContent || '').trim();
                } catch (_) {
                    return (headerContainer.innerText || headerContainer.textContent || '').trim();
                }
            }
            return '';
        };

        const matchesTargetCard = (txt) => {
            if (!regex || !regex.test(txt)) return false;
            // Strict negative guards
            if (cardKey.includes('penerima') && (/pemilik/i.test(txt) || /pembeli/i.test(txt) || /salin\s*penerima/i.test(txt))) return false;
            if (cardKey.includes('pengirim') && (/penjual/i.test(txt) || /salin\s*pengirim/i.test(txt))) return false;
            if (cardKey.includes('pembeli') && /penerima/i.test(txt) && !/pembeli/i.test(txt)) return false;
            if (cardKey.includes('penjual') && /pengirim/i.test(txt) && !/penjual/i.test(txt)) return false;
            if (cardKey.includes('pemilik') && !/pemilik/i.test(txt)) return false;
            return true;
        };

        // 2. Query specific card candidates (exclude outer wrappers matching [class*="card"])
        const cardSelectors = '.ant-card, .card, .ceisa-form-card, .ceisa-entitas-card, fieldset, .ceisa-card';
        let candidates = Array.from(container.querySelectorAll(cardSelectors));
        // Filter out outer wrappers that contain other candidate cards
        candidates = candidates.filter(el => !el.querySelector('.ant-card, .card, .ceisa-form-card, .ceisa-entitas-card, .ceisa-card'));

        for (const c of candidates) {
            const txt = extractCardTitle(c);
            if (txt && matchesTargetCard(txt)) {
                return c;
            }
        }

        // 3. Fallback: Check innerText or child headings in any container-like element
        const genericCandidates = Array.from(container.querySelectorAll('div, section'));
        for (const el of genericCandidates) {
            // Avoid matching wrapper containers that wrap cards
            if (el.querySelector('.ant-card, .card, .ceisa-form-card, .ceisa-entitas-card, .ceisa-card')) continue;
            const titleEl = el.querySelector('.ant-card-head-title, .card-title, .ceisa-card-title, h4, h5, h6, legend');
            if (titleEl) {
                const txt = (titleEl.innerText || titleEl.textContent || '').trim();
                if (txt && matchesTargetCard(txt)) {
                    return el;
                }
            }
        }

        return null;
    }

    // ========================================================
    // AUTO-INPUT TOGGLE CONFIGURATION DEFAULTS
    // ========================================================
    const DEFAULT_CEISA_AUTOFILL_CONFIG = {
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

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
            chrome.storage.local.get(["ceisa_autofill_config"], (res) => {
                if (res && res.ceisa_autofill_config) {
                    window._ceisaAutofillConfig = res.ceisa_autofill_config;
                }
            });
            if (chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener((changes, area) => {
                    if (area === "local" && changes.ceisa_autofill_config) {
                        window._ceisaAutofillConfig = changes.ceisa_autofill_config.newValue;
                    }
                });
            }
        } catch (_) { }
    }

    function handleCeisaAutoInputRow(arg1, arg2, arg3, arg4) {
        let item = null;
        let container = null;
        let section = "entitas";
        let draftType = "PIB";
        let filledFields = [];
        let index = 0;
        let total = 1;
        let forceTab = false;

        if (arg1 && typeof arg1 === "object" && arg1.type === "CEISA_AUTO_INPUT_ROW") {
            // Case 1: chrome message
            if (!arg1.item) {
                return { ok: false, message: "Data baris kosong." };
            }
            section = arg1.section || "entitas";
            draftType = arg1.draftType || arg1.docType || "PIB";
            item = arg1.item || arg1.rowData || arg1.data || arg1;
            index = arg1.index || 0;
            total = arg1.total || 1;
            container = findCeisaTargetContainer();
            filledFields = [];
            forceTab = true;
        } else if (arg2 && (arg2.nodeType === 1 || typeof arg2.querySelector === "function")) {
            // Case 2: item, container, section, filledFields
            item = (arg1 && typeof arg1 === "object") ? (arg1.item || arg1.rowData || arg1) : {};
            container = arg2;
            section = (typeof arg3 === "string" && arg3.trim()) ? arg3.trim() : (item.section || "entitas");
            filledFields = Array.isArray(arg4) ? arg4 : [];
            draftType = item.draftType || item.docType || "PIB";
            forceTab = false;
        } else if (typeof arg2 === "string" && arg3 && typeof arg3 === "object") {
            // Case 3: row, docType, rowData, forceTab
            draftType = arg2;
            item = arg3.item || arg3.rowData || arg3;
            section = (item && item.section) ? item.section : "entitas";
            container = findCeisaTargetContainer();
            filledFields = Array.isArray(arg4) ? arg4 : [];
            forceTab = arg4 === true;
        } else if (arg1 && typeof arg1 === "object") {
            // Case 4: payload object or single object
            if (arg1.section && arg1.item) {
                section = arg1.section;
                item = arg1.item;
                draftType = arg1.draftType || "PIB";
            } else {
                item = arg1.item || arg1.rowData || arg1;
                section = typeof arg2 === "string" ? arg2 : (item.section || "entitas");
                filledFields = Array.isArray(arg3) ? arg3 : (Array.isArray(arg2) ? arg2 : []);
            }
            container = (arg2 && typeof arg2.querySelector === "function") ? arg2 : findCeisaTargetContainer();
            forceTab = false;
        } else {
            item = {};
            container = findCeisaTargetContainer();
            filledFields = [];
            forceTab = false;
        }

        if (!item || typeof item !== "object") {
            item = {};
        }

        const config = (arg1 && arg1.autofillConfig) ||
            (arg1 && arg1.item && arg1.item.autofillConfig) ||
            (item && item.autofillConfig) ||
            window._ceisaAutofillConfig ||
            DEFAULT_CEISA_AUTOFILL_CONFIG;

        // Check section toggle configuration
        const isSectionAllowed = (sec) => {
            if (!config) return true;
            if (sec === "entitas") {
                if (config.entitas === false) return false;
                if (typeof config.entitas === "object" && config.entitas !== null && config.entitas.enabled === false) return false;
                return true;
            }
            if (sec === "pungutan") {
                return config.pungutan === true;
            }
            return config[sec] !== false;
        };

        if (section === "pungutan" && config.pungutan !== true) {
            showCeisaAutoInputToast('Auto Input Section: PUNGUTAN', 'Bagian pungutan dilewati dari auto-fill (diisi manual oleh pengguna)', 'info');
            return {
                ok: true,
                skipped: true,
                message: 'Bagian pungutan dilewati dari auto-fill sesuai preferensi pengguna.'
            };
        }

        if (!isSectionAllowed(section)) {
            const skipMsg = `Bagian ${section.toUpperCase()} dilewati dari auto-fill sesuai preferensi pengguna.`;
            showCeisaAutoInputToast('Auto Input Dilewati', skipMsg, 'info');
            return {
                ok: true,
                skipped: true,
                message: skipMsg
            };
        }

        if (forceTab && typeof switchCeisaActiveTab === "function" && detectCeisaActiveSection() !== section) {
            try {
                switchCeisaActiveTab(section);
            } catch (e) { }
            // Refresh target container setelah tab berpindah
            container = findCeisaTargetContainer();
        }

        if (!container) {
            container = findCeisaTargetContainer();
        }

        // SECTION: DOKUMEN LAMPIRAN
        if (section === "dokumen") {
            const docCode = item.code || (item.type === "INVOICE" ? "380" : item.type === "PACKING_LIST" ? "217" : item.type === "BL" ? "705" : item.type === "COO" ? "861" : "380");
            const docNum = item.number || "";
            const docDate = item.date || "";

            const fillDocSection = (scope) => {
                const codeInput = findFieldByKeywords(["kodeDokumen", "kodeJenisDokumen", "jenisDokumen", "kode_dokumen", "kode jenis", "kode dokumen", "jenis dokumen"], scope);
                if (codeInput && setNativeInputValue(codeInput, docCode)) {
                    filledFields.push('Jenis: ' + docCode);
                }

                const numInput = findFieldByKeywords(["nomorDokumen", "nomor dokumen", "noDok", "no_dok", "no dokumen", "nomor", "number"], scope);
                if (numInput && docNum && setNativeInputValue(numInput, docNum)) {
                    filledFields.push('Nomor: ' + docNum);
                }

                const dateInput = findFieldByKeywords(["tanggalDokumen", "tanggal dokumen", "tglDok", "tgl_dok", "tanggal", "tgl", "date"], scope);
                if (dateInput && docDate && setNativeInputValue(dateInput, docDate)) {
                    filledFields.push('Tanggal: ' + docDate);
                }
            };

            fillDocSection(container);
            if (filledFields.length === 0 && container !== document) {
                fillDocSection(document);
            }

            if (filledFields.length === 0) {
                const warnMsg = `0 field dokumen terisi untuk #${docNum || docCode}. Buka modal "Tambah / Ubah Dokumen" di CEISA 4.0 lalu coba lagi.`;
                showCeisaAutoInputToast('Form Dokumen Tidak Terbuka', warnMsg, 'warn');
                return { ok: false, noFieldsMatched: true, message: warnMsg };
            }

            const successMsg = 'Dokumen [' + (index + 1) + '/' + total + '] ' + (item.type || 'DOC') + ': ' + (docNum || docCode) + ' dimasukkan ke CEISA.';
            showCeisaAutoInputToast('Auto Input Dokumen (' + (index + 1) + '/' + total + ')', (item.name || item.type) + ': ' + docNum + ' (' + docDate + ')', 'success');

            return {
                ok: true,
                message: successMsg + ' (' + filledFields.join(', ') + ')'
            };
        }

        // SECTION: DATA BARANG
        if (section === "barang") {
            const formatNumVal = (v) => (v !== undefined && v !== null && String(v).trim() !== "")
                ? String(v).replace(/[^\d.,-]/g, "")
                : "";

            const hs = String(item.hsCode || item.posTarif || "").replace(/[^0-9]/g, "");
            const kodeBrg = (item.kodeBarang !== undefined && item.kodeBarang !== null) ? String(item.kodeBarang).trim() : "";
            const desc = item.description || item.uraianJenisBarang || item.uraianBarang || item.namaBarang || "";
            const merek = (item.merek || item.merk) ? String(item.merek || item.merk).trim() : "";
            const tipe = (item.tipe || item.type || item.model) ? String(item.tipe || item.type || item.model).trim() : "";
            const spek = (item.spesifikasi || item.spec) ? String(item.spesifikasi || item.spec).trim() : "";
            let qty = item.quantity ?? item.jumlahSatuan ?? item.qty ?? "";
            let uom = item.uom || item.kodeSatuan || item.packageUnit || item.satuanBarang || item.satuan || "";
            let pkgQty = item.kemasanQty ?? "";
            let pkgType = item.kemasanJenis || "";
            let val = item.amount ?? item.cifValue ?? item.fobValue ?? item.nilaiBarang ?? item.harga ?? "";
            const fobVal = item.fob ?? item.amountFob ?? val;
            const hargaSatuan = formatNumVal(item.hargaSatuan);
            const biayaTambahan = formatNumVal(item.biayaTambahan);
            const freightVal = formatNumVal(item.freight ?? item.freightAmount);
            const asuransiVal = formatNumVal(item.asuransi ?? item.insuranceAmount);
            let netto = formatNumVal(item.netWeight ?? item.beratBersih);
            let bruto = formatNumVal(item.grossWeight ?? item.beratKotor);
            const volume = formatNumVal(item.volume);
            const negaraAsal = item.countryOfOrigin || item.negaraAsal || item.negara || "";
            const kondisi = item.kondisi ? String(item.kondisi).trim() : "";
            const kategori = item.kategori ? String(item.kategori).trim() : "";
            const asalBarang = item.asal ? String(item.asal).trim() : "";
            const cifUsdStr = formatNumVal(item.cifUsd ?? item.nilaiCif);
            const tarifBmVal = (item.tarifBm !== undefined && item.tarifBm !== null && String(item.tarifBm).trim() !== "")
                ? String(item.tarifBm).replace(/%/g, "").trim()
                : ((item.tariffBm !== undefined && item.tariffBm !== null && String(item.tariffBm).trim() !== "") ? String(item.tariffBm).replace(/%/g, "").trim() : "");
            const tarifPpnVal = (item.tarifPpn !== undefined && item.tarifPpn !== null && String(item.tarifPpn).trim() !== "") ? String(item.tarifPpn).replace(/%/g, "").trim() : "";
            const tarifPphVal = (item.tarifPph !== undefined && item.tarifPph !== null && String(item.tarifPph).trim() !== "") ? String(item.tarifPph).replace(/%/g, "").trim() : "";

            if ((qty === "" || qty === undefined || !uom) && item.jumlahDanSatuanBarang) {
                const m = String(item.jumlahDanSatuanBarang).trim().match(/^([\d\s.,]+)\s*([a-zA-Z0-9/-]+)?$/);
                if (m) {
                    if (qty === "" || qty === undefined) qty = m[1].replace(/\s/g, "");
                    if (!uom && m[2]) uom = m[2];
                } else if (qty === "" || qty === undefined) {
                    qty = item.jumlahDanSatuanBarang;
                }
            }
            if ((pkgQty === "" || pkgQty === undefined || !pkgType) && item.kemasan) {
                const mk = String(item.kemasan).trim().match(/^([\d.,]+)\s*(.+)$/);
                if (mk) {
                    if (pkgQty === "" || pkgQty === undefined) pkgQty = mk[1];
                    if (!pkgType) pkgType = mk[2].split(/\s|-/)[0].trim();
                }
            }
            if (val !== undefined && val !== null && String(val).trim() !== "") val = formatNumVal(val);
            const fobStr = (fobVal !== undefined && fobVal !== null && String(fobVal).trim() !== "") ? formatNumVal(fobVal) : "";

            const missedFields = [];
            const fillBarangSection = (scope, recordMissing = false) => {
                const tryFill = (kws, value, label, fieldOpts = {}) => {
                    if (value === undefined || value === null || String(value).trim() === "") return;
                    const inp = findFieldByKeywords(kws, scope, fieldOpts);
                    if (inp && setNativeInputValue(inp, value)) {
                        filledFields.push(label + ': ' + String(value).slice(0, 18));
                    } else if (recordMissing && !fieldOpts.optional) {
                        missedFields.push(label);
                    }
                };

                tryFill(["posTarif", "pos_tarif", "kodeHs", "hsCode", "pos tarif/hs", "pos tarif / hs", "pos tarif", "hs"], hs, 'HS');
                tryFill(["kodeBarang", "kode_barang", "kode barang"], kodeBrg, 'Kode');
                tryFill(["uraianJenisBarang", "uraianBarang", "uraian jenis barang", "uraian barang", "uraian", "namaBarang", "description", "deskripsi"], desc, 'Uraian');
                tryFill(["merek", "merk"], merek, 'Merek');
                tryFill(["tipe", "type"], tipe, 'Tipe');
                tryFill(["spesifikasi lain", "spesifikasi"], spek, 'Spek');
                tryFill(["jumlahSatuan", "jumlah_satuan", "jumlah dan satuan", "jumlah satuan", "qty", "jumlah barang", "jumlah"], qty, 'Qty', { preferredKind: 'text' });
                tryFill(["kodeSatuan", "kode_satuan", "jumlah dan satuan", "jenisSatuan", "jenis satuan", "satuan barang", "satuan", "uom"], uom, 'Satuan', { preferredKind: 'select' });
                tryFill(["jumlahKemasan", "jumlah_kemasan", "jumlah kemasan", "jmlKemasan", "kemasan"], pkgQty, 'Jml Kemasan', { preferredKind: 'text' });
                tryFill(["jenisKemasan", "kodeJenisKemasan", "jenis kemasan", "kemasan"], pkgType, 'Kemasan', { preferredKind: 'select' });
                tryFill(["beratBersih", "berat bersih (kg)", "berat bersih", "netto"], netto, 'Netto', { preferredKind: 'text' });
                tryFill(["beratKotor", "berat kotor (kg)", "berat kotor", "bruto"], bruto, 'Bruto', { preferredKind: 'text' });
                tryFill(["volume (m3)", "volume"], volume, 'Volume', { preferredKind: 'text' });
                tryFill(["amount fca", "amount fob", "amount cif", "nilaiEkspor", "nilai ekspor", "hargaEkspor", "harga ekspor", "nilaiBarang", "nilai barang", "nilaiPabean", "amount", "nilai"], val, 'Amount', { preferredKind: 'text' });
                tryFill(["biaya tambahan", "biayaTambahan", "diskon"], biayaTambahan, 'Biaya Tambahan', { preferredKind: 'text' });
                tryFill(["fob", "nilaiFob"], fobStr, 'FOB', { preferredKind: 'text' });
                tryFill(["hargaSatuan", "harga satuan", "harga_satuan"], hargaSatuan, 'Harga Satuan', { preferredKind: 'text' });
                tryFill(["freight"], freightVal, 'Freight', { preferredKind: 'text' });
                tryFill(["asuransi"], asuransiVal, 'Asuransi', { preferredKind: 'text' });
                tryFill(["negaraAsal", "negara asal", "daerahAsal", "negara"], negaraAsal, 'Negara', { preferredKind: 'select' });
                // Kolom tambahan Barang Impor (PIB BC 2.0)
                tryFill(["kondisiBarang", "kondisi barang", "kondisi"], kondisi, 'Kondisi', { preferredKind: 'select', optional: true });
                tryFill(["kategoriBarang", "kategori barang", "kategori"], kategori, 'Kategori', { preferredKind: 'select', optional: true });
                tryFill(["asalBarang", "asal barang"], asalBarang, 'Asal Barang', { preferredKind: 'select', optional: true });
                tryFill(["cifUsd", "cif valuta", "nilai pabean", "nilai cif"], cifUsdStr, 'CIF', { preferredKind: 'text', optional: true });
                tryFill(["bmTarif", "tarifBm", "tarif bm", "bea masuk"], tarifBmVal, 'Tarif BM', { preferredKind: 'text', optional: true });
                tryFill(["ppnTarif", "tarifPpn", "tarif ppn", "ppn"], tarifPpnVal, 'Tarif PPN', { preferredKind: 'text', optional: true });
                tryFill(["pphTarif", "tarifPph", "tarif pph", "pph"], tarifPphVal, 'Tarif PPh', { preferredKind: 'text', optional: true });

                // Radio Pernyataan Lartas ("Terkena Lartas" / "Tidak Terkena Lartas")
                if (item.lartas !== undefined && scope?.querySelectorAll) {
                    const wantLartas = String(item.lartas).toLowerCase() === 'terkena' || item.isLartas === true;
                    const radios = Array.from(scope.querySelectorAll('input[type="radio"]'));
                    for (const rad of radios) {
                        const lblText = (rad.closest("label")?.textContent || rad.parentElement?.textContent || "").toLowerCase();
                        const matchTidak = !wantLartas && lblText.includes("tidak") && lblText.includes("lartas");
                        const matchYa = wantLartas && !lblText.includes("tidak") && lblText.includes("lartas");
                        if ((matchTidak || matchYa) && !rad.disabled) {
                            rad.click();
                            filledFields.push('Lartas: ' + (wantLartas ? 'Ya' : 'Tidak'));
                            break;
                        }
                    }
                }
            };

            fillBarangSection(container, true);
            if (filledFields.length === 0 && container !== document) {
                missedFields.length = 0;
                fillBarangSection(document, true);
            }

            if (filledFields.length === 0) {
                const totalInputs = countFormControls(document);
                const hasAddBtn = Array.from(document.querySelectorAll("button")).some(b => /tambah/i.test(b.textContent || ""));
                const hint = hasAddBtn
                    ? `Form detail Barang belum terbuka di CEISA 4.0 (${totalInputs} input aktif terlihat). Klik tombol "Tambah" / "Ubah" di tab Barang CEISA dulu, baru klik Masukkan Data.`
                    : `Tidak ada kolom Barang yang cocok (${totalInputs} input aktif terdeteksi di halaman CEISA). Pastikan form Barang CEISA sedang terbuka.`;
                showCeisaAutoInputToast('Form Barang Tidak Ditemukan', hint, 'warn');
                return {
                    ok: false,
                    noFieldsMatched: true,
                    message: hint
                };
            }

            const successMsg = 'Barang [' + (index + 1) + '/' + total + '] HS ' + hs + ': ' + desc.substring(0, 25) + ' dimasukkan.';
            const missingSuffix = missedFields.length > 0 ? ' | Tidak cocok: ' + missedFields.join(', ') : '';
            showCeisaAutoInputToast('Auto Input Barang (' + (index + 1) + '/' + total + ')', 'HS ' + hs + ' | Qty: ' + qty + ' ' + uom + ' | Val: ' + val, 'success');

            return {
                ok: true,
                missedFields,
                message: successMsg + ' (' + filledFields.join(', ') + ')' + missingSuffix
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
            const ent = item.entitas || {};
            const entConfig = (typeof config.entitas === 'object' && config.entitas !== null)
                ? config.entitas
                : { enabled: config.entitas !== false, pengirim: true, penerima: true, pembeli: true, penjual: true, pemilik: true, ppjk: false };

            const fillCardField = (card, keywords, value, fieldDesc) => {
                if (!card) return;
                if (value === null || value === undefined) return;
                const str = String(value).trim();
                if (str === "" || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") return;

                const field = findFieldByKeywords(keywords, card);
                if (field) {
                    if (field.disabled || field.readOnly) return;
                    setNativeInputValue(field, value);
                    if (Array.isArray(filledFields)) {
                        filledFields.push(fieldDesc + ': ' + str.slice(0, 15));
                    }
                }
            };

            // 1. CARD PENGIRIM (Shipper / Supplier)
            const cardPengirim = (entConfig.pengirim !== false) ? findCeisaCard('pengirim', container) : null;
            const pengirimIdType = ent.pengirim?.jenisIdentitas ?? item.pengirimIdType ?? item.pengirimJenisIdentitas ?? item.supplierIdType;
            const pengirimId = ent.pengirim?.nomorIdentitas ?? item.pengirimId ?? item.pengirimNomorIdentitas ?? item.supplierId ?? item.shipperId;
            const pengirimName = ent.pengirim?.nama ?? item.pengirimName ?? item.pengirimNama ?? item.supplierName ?? item.shipperName ?? item.eksportirNama;
            const pengirimAddr = ent.pengirim?.alamat ?? item.pengirimAddress ?? item.pengirimAlamat ?? item.supplierAddress ?? item.shipperAddress;
            const pengirimCountry = ent.pengirim?.negara ?? item.pengirimCountry ?? item.pengirimNegara ?? item.supplierCountry ?? item.negaraPemasok;

            if (cardPengirim) {
                fillCardField(cardPengirim, ['jenisIdentitas', 'jenis_identitas', 'jenisId', 'jenis_id', 'jenisDokumen'], pengirimIdType, 'Pengirim Jenis ID');
                fillCardField(cardPengirim, ['nomorIdentitas', 'nomor_identitas', 'noIdentitas', 'no_identitas', 'nomorId', 'npwp', 'nomor identitas', 'no identitas'], pengirimId, 'Pengirim ID');
                fillCardField(cardPengirim, ['nama', 'name'], pengirimName, 'Pengirim Nama');
                fillCardField(cardPengirim, ['alamat', 'address'], pengirimAddr, 'Pengirim Alamat');
                fillCardField(cardPengirim, ['negara', 'country'], pengirimCountry, 'Pengirim Negara');
            }

            // 2. CARD PENERIMA (Importer / Consignee)
            const cardPenerima = (entConfig.penerima !== false) ? findCeisaCard('penerima', container) : null;
            const penerimaIdType = ent.penerima?.jenisIdentitas ?? item.penerimaIdType ?? item.penerimaJenisIdentitas ?? item.importirIdType;
            const penerimaId = ent.penerima?.nomorIdentitas ?? item.penerimaId ?? item.penerimaNomorIdentitas ?? item.importirId ?? item.npwpImportir;
            const penerimaNitku = ent.penerima?.nitku ?? item.penerimaNitku;
            const penerimaName = ent.penerima?.nama ?? item.penerimaName ?? item.penerimaNama ?? item.importirName ?? item.consigneeName;
            const penerimaAddr = ent.penerima?.alamat ?? item.penerimaAddress ?? item.penerimaAlamat ?? item.importirAddress ?? item.consigneeAddress;
            const penerimaCountry = ent.penerima?.negara ?? item.penerimaCountry ?? item.penerimaNegara;
            const penerimaStatus = ent.penerima?.status ?? item.penerimaStatus ?? item.importirStatus;
            const ijinBpNo = ent.penerima?.ijinBpNo ?? item.ijinBpNo ?? item.ijinBpNomor ?? item.noIzinBp ?? item.noIjin;
            const ijinBpTgl = ent.penerima?.ijinBpTgl ?? item.ijinBpTgl ?? item.ijinBpTanggal ?? item.tglIzinBp ?? item.tglIzin;

            if (cardPenerima) {
                fillCardField(cardPenerima, ['jenisIdentitas', 'jenis_identitas', 'jenisId', 'jenis_id', 'jenisDokumen'], penerimaIdType, 'Penerima Jenis ID');
                fillCardField(cardPenerima, ['nomorIdentitas', 'nomor_identitas', 'noIdentitas', 'no_identitas', 'nomorId', 'npwp', 'nomor identitas', 'no identitas'], penerimaId, 'Penerima ID');
                fillCardField(cardPenerima, ['nitku'], penerimaNitku, 'Penerima NITKU');
                fillCardField(cardPenerima, ['nama', 'name'], penerimaName, 'Penerima Nama');
                fillCardField(cardPenerima, ['alamat', 'address'], penerimaAddr, 'Penerima Alamat');
                fillCardField(cardPenerima, ['negara', 'country'], penerimaCountry, 'Penerima Negara');
                fillCardField(cardPenerima, ['status'], penerimaStatus, 'Penerima Status');
                fillCardField(cardPenerima, ['noIjin', 'no_ijin', 'noIzin', 'no_izin', 'nomorIzin', 'nomorIjin', 'izin bp', 'ijin bp'], ijinBpNo, 'Ijin BP No');
                fillCardField(cardPenerima, ['tglIzin', 'tgl_izin', 'tglIjin', 'tgl_ijin', 'tanggalIzin', 'tanggalIjin', 'tanggal', 'date'], ijinBpTgl, 'Ijin BP Tgl');
            }

            // 3. CARD PEMBELI (Buyer)
            const cardPembeli = (entConfig.pembeli !== false) ? findCeisaCard('pembeli', container) : null;
            const pembeliIdType = ent.pembeli?.jenisIdentitas ?? item.pembeliIdType ?? item.pembeliJenisIdentitas;
            const pembeliId = ent.pembeli?.nomorIdentitas ?? item.pembeliId ?? item.pembeliNomorIdentitas;
            const pembeliNitku = ent.pembeli?.nitku ?? item.pembeliNitku;
            const pembeliName = ent.pembeli?.nama ?? item.pembeliName ?? item.pembeliNama;
            const pembeliAddr = ent.pembeli?.alamat ?? item.pembeliAddress ?? item.pembeliAlamat;
            const pembeliCountry = ent.pembeli?.negara ?? item.pembeliCountry ?? item.pembeliNegara;

            if (cardPembeli) {
                fillCardField(cardPembeli, ['jenisIdentitas', 'jenis_identitas', 'jenisId', 'jenis_id', 'jenisDokumen'], pembeliIdType, 'Pembeli Jenis ID');
                fillCardField(cardPembeli, ['nomorIdentitas', 'nomor_identitas', 'noIdentitas', 'no_identitas', 'nomorId', 'npwp', 'nomor identitas', 'no identitas'], pembeliId, 'Pembeli ID');
                fillCardField(cardPembeli, ['nitku'], pembeliNitku, 'Pembeli NITKU');
                fillCardField(cardPembeli, ['nama', 'name'], pembeliName, 'Pembeli Nama');
                fillCardField(cardPembeli, ['alamat', 'address'], pembeliAddr, 'Pembeli Alamat');
                fillCardField(cardPembeli, ['negara', 'country'], pembeliCountry, 'Pembeli Negara');
            }

            // 4. CARD PENJUAL (Seller)
            const cardPenjual = (entConfig.penjual !== false) ? findCeisaCard('penjual', container) : null;
            const penjualIdType = ent.penjual?.jenisIdentitas ?? item.penjualIdType ?? item.penjualJenisIdentitas;
            const penjualId = ent.penjual?.nomorIdentitas ?? item.penjualId ?? item.penjualNomorIdentitas;
            const penjualName = ent.penjual?.nama ?? item.penjualName ?? item.penjualNama ?? item.sellerName;
            const penjualAddr = ent.penjual?.alamat ?? item.penjualAddress ?? item.penjualAlamat ?? item.sellerAddress;
            const penjualCountry = ent.penjual?.negara ?? item.penjualCountry ?? item.penjualNegara ?? item.sellerCountry;

            if (cardPenjual) {
                fillCardField(cardPenjual, ['jenisIdentitas', 'jenis_identitas', 'jenisId', 'jenis_id', 'jenisDokumen'], penjualIdType, 'Penjual Jenis ID');
                fillCardField(cardPenjual, ['nomorIdentitas', 'nomor_identitas', 'noIdentitas', 'no_identitas', 'nomorId', 'npwp', 'nomor identitas', 'no identitas'], penjualId, 'Penjual ID');
                fillCardField(cardPenjual, ['nama', 'name'], penjualName, 'Penjual Nama');
                fillCardField(cardPenjual, ['alamat', 'address'], penjualAddr, 'Penjual Alamat');
                fillCardField(cardPenjual, ['negara', 'country'], penjualCountry, 'Penjual Negara');
            }

            // 5. CARD PEMILIK BARANG (Cargo Owner)
            const cardPemilik = (entConfig.pemilik !== false) ? findCeisaCard('pemilik', container) : null;
            const pemilikIdType = ent.pemilikBarang?.jenisIdentitas ?? ent.pemilik?.jenisIdentitas ?? item.pemilikIdType ?? item.pemilikJenisIdentitas;
            const pemilikId = ent.pemilikBarang?.nomorIdentitas ?? ent.pemilik?.nomorIdentitas ?? item.pemilikId ?? item.pemilikNomorIdentitas ?? item.ownerId;
            const pemilikNitku = ent.pemilikBarang?.nitku ?? ent.pemilik?.nitku ?? item.pemilikNitku;
            const pemilikName = ent.pemilikBarang?.nama ?? ent.pemilik?.nama ?? item.pemilikName ?? item.pemilikNama ?? item.ownerName;
            const pemilikAddr = ent.pemilikBarang?.alamat ?? ent.pemilik?.alamat ?? item.pemilikAddress ?? item.pemilikAlamat ?? item.ownerAddress;
            const pemilikAfiliasi = ent.pemilikBarang?.afiliasi ?? ent.pemilik?.afiliasi ?? item.pemilikAfiliasi ?? item.afiliasi;

            if (cardPemilik) {
                fillCardField(cardPemilik, ['jenisIdentitas', 'jenis_identitas', 'jenisId', 'jenis_id', 'jenisDokumen'], pemilikIdType, 'Pemilik Jenis ID');
                fillCardField(cardPemilik, ['nomorIdentitas', 'nomor_identitas', 'noIdentitas', 'no_identitas', 'nomorId', 'npwp', 'nomor identitas', 'no identitas'], pemilikId, 'Pemilik ID');
                fillCardField(cardPemilik, ['nitku'], pemilikNitku, 'Pemilik NITKU');
                fillCardField(cardPemilik, ['nama', 'name'], pemilikName, 'Pemilik Nama');
                fillCardField(cardPemilik, ['alamat', 'address'], pemilikAddr, 'Pemilik Alamat');
                fillCardField(cardPemilik, ['afiliasi', 'hubungan'], pemilikAfiliasi, 'Pemilik Afiliasi');
            }

            // 6. CARD PPJK (Customs Broker) - Diisi jika toggle diaktifkan pengguna
            const cardPpjk = (entConfig.ppjk === true) ? findCeisaCard('ppjk', container) : null;
            if (cardPpjk) {
                const ppjkIdType = ent.ppjk?.jenisIdentitas ?? item.ppjkIdType ?? item.ppjkJenisIdentitas;
                const ppjkId = ent.ppjk?.nomorIdentitas ?? item.ppjkId ?? item.ppjkNomorIdentitas ?? item.ppjkNpwp ?? item.npwpPpjk;
                const ppjkNitku = ent.ppjk?.nitku ?? item.ppjkNitku;
                const ppjkName = ent.ppjk?.nama ?? item.ppjkName ?? item.ppjkNama;
                const ppjkAddr = ent.ppjk?.alamat ?? item.ppjkAddress ?? item.ppjkAlamat;

                fillCardField(cardPpjk, ['jenisIdentitas', 'jenis_identitas', 'jenisId', 'jenis_id', 'jenisDokumen'], ppjkIdType, 'PPJK Jenis ID');
                fillCardField(cardPpjk, ['nomorIdentitas', 'nomor_identitas', 'noIdentitas', 'no_identitas', 'nomorId', 'npwp', 'nomor identitas', 'no identitas'], ppjkId, 'PPJK ID');
                fillCardField(cardPpjk, ['nitku'], ppjkNitku, 'PPJK NITKU');
                fillCardField(cardPpjk, ['nama', 'name'], ppjkName, 'PPJK Nama');
                fillCardField(cardPpjk, ['alamat', 'address'], ppjkAddr, 'PPJK Alamat');
            }

            // Fallback for legacy CEISA portals without card containers
            if (!cardPengirim && !cardPenerima && !cardPembeli && !cardPenjual && !cardPemilik && !cardPpjk) {
                const csgInput = findFieldByKeywords(["namaImportir", "importir", "consignee", "penerima", "nama_importir"], container);
                if (csgInput && penerimaName) {
                    setNativeInputValue(csgInput, penerimaName);
                    filledFields.push('Importir: ' + penerimaName);
                }
                const idInput = findFieldByKeywords(["nomorIdentitasImportir", "npwpImportir", "idImportir", "npwp", "nomor identitas"], container);
                if (idInput && (penerimaId || item.importirId)) {
                    setNativeInputValue(idInput, penerimaId || item.importirId);
                    filledFields.push('NPWP: ' + (penerimaId || item.importirId));
                }
                const nibInput = findFieldByKeywords(["nibImportir", "nib", "nomor induk berusaha"], container);
                if (nibInput && (item.importirNib || item.nib)) {
                    setNativeInputValue(nibInput, item.importirNib || item.nib);
                    filledFields.push('NIB: ' + (item.importirNib || item.nib));
                }
                const addrInput = findFieldByKeywords(["alamatImportir", "alamat", "alamat penerima"], container);
                if (addrInput && penerimaAddr) {
                    setNativeInputValue(addrInput, penerimaAddr);
                    filledFields.push('Alamat Imp: ' + penerimaAddr.substring(0, 15) + '...');
                }

                const shpInput = findFieldByKeywords(["namaPemasok", "namaEksportir", "pemasok", "eksportir", "shipper", "pengirim"], container);
                if (shpInput && pengirimName) {
                    setNativeInputValue(shpInput, pengirimName);
                    filledFields.push('Pemasok: ' + pengirimName);
                }
                const sAddrInput = findFieldByKeywords(["alamatPemasok", "alamatEksportir", "alamat pemasok"], container);
                if (sAddrInput && pengirimAddr) {
                    setNativeInputValue(sAddrInput, pengirimAddr);
                    filledFields.push('Alamat Pem: ' + pengirimAddr.substring(0, 15) + '...');
                }
                const sCtryInput = findFieldByKeywords(["negaraPemasok", "negaraEksportir", "negara asal", "country"], container);
                if (sCtryInput && pengirimCountry) {
                    setNativeInputValue(sCtryInput, pengirimCountry);
                    filledFields.push('Negara: ' + pengirimCountry);
                }
            }

            const successMsg = 'Entitas [' + (index + 1) + '/' + total + '] berhasil dimasukkan ke form CEISA.';
            showCeisaAutoInputToast('Auto Input Entitas (' + (index + 1) + '/' + total + ')', filledFields.slice(0, 3).join(', '), filledFields.length > 0 ? 'success' : 'warn');

            return {
                ok: true,
                message: filledFields.length > 0
                    ? successMsg + ' (' + filledFields.join(', ') + ')'
                    : successMsg + ' (Form terdeteksi, pastikan tab Entitas aktif di CEISA).'
            };
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
            if (config.pungutan !== true) {
                // Bagian pungutan sengaja dikecualikan dari auto-fill jika toggle dimatikan
                showCeisaAutoInputToast('Auto Input Section: PUNGUTAN', 'Bagian pungutan dilewati dari auto-fill (diisi manual oleh pengguna)', 'info');
                return {
                    ok: true,
                    skipped: true,
                    message: 'Bagian pungutan dilewati dari auto-fill sesuai preferensi pengguna.'
                };
            }

            const pgt = item.pungutan || {};
            const nilaiPabean = pgt.nilaiPabeanIdr ?? pgt.cifRupiah ?? item.nilaiPabeanIdr ?? item.cifValueIdr ?? item.cifRupiah ?? item.nilaiPabean ?? "";
            const bm = pgt.nilaiBm ?? pgt.bm ?? item.nilaiBm ?? item.bm ?? item.tarifBm ?? "";
            const ppn = pgt.nilaiPpn ?? pgt.ppn ?? item.nilaiPpn ?? item.ppn ?? item.tarifPpn ?? "";
            const pph = pgt.nilaiPph ?? pgt.pph ?? item.nilaiPph ?? item.pph ?? item.tarifPph ?? "";
            const totalBilling = pgt.totalBilling ?? pgt.billing ?? item.totalBilling ?? item.totalPungutan ?? item.billing ?? "";

            const pabeanInp = findFieldByKeywords(["nilaiPabean", "nilai_pabean", "cifRupiah", "cif_rupiah", "pabean"], container);
            if (pabeanInp && nilaiPabean) {
                setNativeInputValue(pabeanInp, nilaiPabean);
                filledFields.push('Nilai Pabean: ' + nilaiPabean);
            }
            const bmInp = findFieldByKeywords(["beaMasuk", "nilaiBm", "tarifBm", "bm"], container);
            if (bmInp && bm) {
                setNativeInputValue(bmInp, bm);
                filledFields.push('BM: ' + bm);
            }
            const ppnInp = findFieldByKeywords(["ppn", "nilaiPpn", "tarifPpn"], container);
            if (ppnInp && ppn) {
                setNativeInputValue(ppnInp, ppn);
                filledFields.push('PPN: ' + ppn);
            }
            const pphInp = findFieldByKeywords(["pph", "nilaiPph", "tarifPph"], container);
            if (pphInp && pph) {
                setNativeInputValue(pphInp, pph);
                filledFields.push('PPh: ' + pph);
            }
            const totalInp = findFieldByKeywords(["totalBilling", "totalPungutan", "billing", "total"], container);
            if (totalInp && totalBilling) {
                setNativeInputValue(totalInp, totalBilling);
                filledFields.push('Total Billing: ' + totalBilling);
            }

            const successMsg = 'Pungutan berhasil diinput ke CEISA.';
            showCeisaAutoInputToast('Auto Input Pungutan', filledFields.slice(0, 3).join(', '), filledFields.length > 0 ? 'success' : 'warn');
            return {
                ok: true,
                message: filledFields.length > 0
                    ? successMsg + ' (' + filledFields.join(', ') + ')'
                    : successMsg + ' (Field pungutan terdeteksi).'
            };
        }

        if (section === "pernyataan") {
            const kota = item.pernyataanKota || item.kota || "Jakarta Utara";
            const tgl = item.pernyataanTanggal || item.tanggalPernyataan || new Date().toISOString().slice(0, 10);
            const nama = item.pernyataanNama || item.namaPemberitahu || item.namaPernyataan || "";
            const jabatan = item.pernyataanJabatan || item.jabatanPemberitahu || item.jabatanPernyataan || "";

            const kotaInp = findFieldByKeywords(["kotaPernyataan", "kota", "tempatPernyataan", "tempat"], container);
            if (kotaInp && kota) {
                setNativeInputValue(kotaInp, kota);
                filledFields.push('Kota: ' + kota);
            }
            const tglInp = findFieldByKeywords(["tanggalPernyataan", "tglPernyataan", "tanggal", "date"], container);
            if (tglInp && tgl) {
                setNativeInputValue(tglInp, tgl);
                filledFields.push('Tanggal: ' + tgl);
            }
            const namaInp = findFieldByKeywords(["namaPemberitahu", "namaPernyataan", "namaTTD", "nama"], container);
            if (namaInp && nama) {
                setNativeInputValue(namaInp, nama);
                filledFields.push('Nama: ' + nama);
            }
            const jabInp = findFieldByKeywords(["jabatanPemberitahu", "jabatanPernyataan", "jabatan"], container);
            if (jabInp && jabatan) {
                setNativeInputValue(jabInp, jabatan);
                filledFields.push('Jabatan: ' + jabatan);
            }

            const agreeCheck = container?.querySelector('input[type="checkbox"][id*="pernyataan"], input[type="checkbox"][name*="setuju"], input[type="checkbox"][name*="agree"]');
            if (agreeCheck && !agreeCheck.checked) {
                agreeCheck.checked = true;
                agreeCheck.dispatchEvent(new Event('change', { bubbles: true }));
                filledFields.push('Pernyataan Disetujui');
            }

            const successMsg = 'Pernyataan berhasil diinput ke CEISA.';
            showCeisaAutoInputToast('Auto Input Pernyataan', filledFields.join(', '), filledFields.length > 0 ? 'success' : 'warn');
            return {
                ok: true,
                message: filledFields.length > 0
                    ? successMsg + ' (' + filledFields.join(', ') + ')'
                    : successMsg + ' (Field pernyataan terdeteksi).'
            };
        }

        if (filledFields.length === 0) {
            const totalInputs = countFormControls(document);
            const warnMsg = `0 field "${section}" terisi (${totalInputs} input aktif terlihat). Pastikan tab/form "${section}" di portal CEISA 4.0 sudah terbuka.`;
            showCeisaAutoInputToast('Field Tidak Ditemukan: ' + section.toUpperCase(), warnMsg, 'warn');
            return {
                ok: false,
                noFieldsMatched: true,
                message: warnMsg
            };
        }

        showCeisaAutoInputToast('Auto Input Section: ' + section.toUpperCase(), filledFields.slice(0, 3).join(', '), 'success');
        return {
            ok: true,
            message: `Data section "${section}" berhasil diinput (${filledFields.join(', ')}).`
        };
    }

    // ========================================================
    // ASYNC CEISA AUTO-NAVIGATE, AUTO-OPEN & MULTI-SERI RUNNER
    // ========================================================
    const sleepMs = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function waitUntilCondition(predicate, timeoutMs = 1500, stepMs = 100) {
        const start = Date.now();
        while (Date.now() - start <= timeoutMs) {
            try {
                const res = predicate();
                if (res) return res;
            } catch (_) {}
            await sleepMs(stepMs);
        }
        return null;
    }

    function findVisibleActionButton(patterns, root = document) {
        if (!root || typeof root.querySelectorAll !== "function") return null;
        const els = Array.from(root.querySelectorAll('button, a.ant-btn, [role="button"], .ant-btn, a[title], span[role="button"]'));
        for (const pat of patterns) {
            for (const el of els) {
                if (el.disabled || isElementHiddenOrInactive(el)) continue;
                const txt = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
                const title = (el.getAttribute("title") || el.getAttribute("aria-label") || "").trim();
                if (pat.test(txt) || pat.test(title)) {
                    return el;
                }
            }
        }
        return null;
    }

    function readDisabledOrActiveSeriInput(root = document) {
        if (!root || typeof root.querySelectorAll !== "function") return null;
        const labels = Array.from(root.querySelectorAll("label, .ant-form-item-label, span, div.ant-col, th, p"));
        for (const lbl of labels) {
            if (isElementHiddenOrInactive(lbl)) continue;
            const txt = (lbl.innerText || lbl.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
            if (txt === "seri" || txt === "no. seri" || txt === "nomor seri") {
                const colEl = lbl.closest(".ant-col") || lbl.parentElement;
                const sibInp = colEl?.nextElementSibling?.querySelector?.("input");
                const rowInp = lbl.closest(".ant-form-item, .ant-row, .row")?.querySelector?.("input");
                const targetInp = sibInp || rowInp;
                if (targetInp && targetInp.value !== undefined) {
                    const num = parseInt(String(targetInp.value).replace(/\D/g, ""), 10);
                    if (!isNaN(num) && num > 0) return num;
                }
            }
        }
        const byName = root.querySelector('input[name="seri"], input[id*="seri" i]');
        if (byName && byName.value) {
            const num = parseInt(String(byName.value).replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > 0) return num;
        }
        return null;
    }

    function isBarangDetailFormOpen() {
        const container = findCeisaTargetContainer();
        const hasUraian = Boolean(findFieldByKeywords(["uraianJenisBarang", "uraianBarang", "uraian jenis barang", "uraian", "description"], container));
        const hasHs = Boolean(findFieldByKeywords(["posTarif", "pos tarif/hs", "pos tarif / hs", "pos tarif", "hs"], container));
        const hasNetto = Boolean(findFieldByKeywords(["beratBersih", "berat bersih", "netto"], container));
        return hasUraian || (hasHs && hasNetto);
    }

    function findBarangTableRows(root = document) {
        const pane = findCeisaTargetContainer();
        const tables = Array.from((pane || root).querySelectorAll("table"));
        for (const tbl of tables) {
            if (isElementHiddenOrInactive(tbl)) continue;
            const rows = Array.from(tbl.querySelectorAll("tbody tr")).filter(r => {
                if (isElementHiddenOrInactive(r)) return false;
                if (r.classList.contains("ant-table-placeholder") || r.querySelector("td[colspan]")) return false;
                return Boolean(r.textContent && r.textContent.trim().length > 0);
            });
            if (rows.length > 0) return rows;
        }
        return [];
    }

    function findRowActionBtn(row, type = "edit") {
        if (!row) return null;
        if (type === "copy") {
            return row.querySelector('button[title*="Salin" i], a[title*="Salin" i], button[aria-label*="copy" i], .anticon-copy, button[title*="Copy" i]') ||
                findVisibleActionButton([/salin\s*seri/i, /^\s*salin\b/i, /copy/i], row);
        }
        return row.querySelector('button[title*="Ubah" i], button[title*="Edit" i], a[title*="Ubah" i], a[title*="Edit" i], .anticon-edit, [aria-label="edit"]') ||
            findVisibleActionButton([/^\s*ubah\b/i, /^\s*edit\b/i], row);
    }

    async function handleConfirmModalIfAny() {
        await sleepMs(120);
        const confirmModal = document.querySelector(".ant-modal-confirm .ant-modal-confirm-btns, .ant-popover:not(.ant-popover-hidden) .ant-popover-buttons");
        if (confirmModal && !isElementHiddenOrInactive(confirmModal)) {
            const okBtn = findVisibleActionButton([/^\s*(ya|ok|lanjut|setuju|yes|simpan)\b/i], confirmModal);
            if (okBtn) {
                okBtn.click();
                await sleepMs(200);
            }
        }
    }

    async function clickToolbarCopyWithRowSelect(rows) {
        const targetRow = rows && rows.length > 0 ? rows[rows.length - 1] : null;
        if (targetRow) {
            const cb = targetRow.querySelector('.ant-checkbox-input:not(:disabled), input[type="checkbox"]:not(:disabled)');
            if (cb && !cb.checked) {
                cb.click();
                await sleepMs(160);
            }
        }
        const globalCopy = findVisibleActionButton([/salin\s*seri/i, /^\s*salin\b/i]);
        if (globalCopy && !globalCopy.disabled) {
            globalCopy.click();
            return true;
        }
        const prevRowCopy = targetRow ? findRowActionBtn(targetRow, "copy") : null;
        if (prevRowCopy && !prevRowCopy.disabled) {
            prevRowCopy.click();
            return true;
        }
        return false;
    }

    async function waitBarangSaveSettled(targetNextSeri) {
        await waitUntilCondition(() => {
            const spinning = Boolean(document.querySelector(".ant-spin-spinning"));
            if (spinning) return false;
            const nowSeri = readDisabledOrActiveSeriInput(findCeisaTargetContainer()) || readDisabledOrActiveSeriInput(document);
            return !isBarangDetailFormOpen() || (targetNextSeri && nowSeri && nowSeri >= targetNextSeri);
        }, 4500, 120);
        await sleepMs(180);
    }

    async function prepareBarangFormForTargetSeri(targetSeri) {
        // 1. Jika form belum terbuka, buka otomatis (Edit baris ada atau Tambah / Salin Seri)
        if (!isBarangDetailFormOpen()) {
            const rows = findBarangTableRows();
            if (targetSeri === 1) {
                const editBtn = rows[0] ? findRowActionBtn(rows[0], "edit") : null;
                const addBtn = findVisibleActionButton([/^\s*\+?\s*tambah\b/i, /tambah\s*barang/i]);
                if (editBtn) {
                    editBtn.click();
                } else if (addBtn) {
                    addBtn.click();
                }
                await waitUntilCondition(() => isBarangDetailFormOpen(), 2200, 100);
                return;
            }

            // targetSeri > 1: Jika baris Seri ke-N sudah ada di tabel, klik Ubah/Edit; kalau belum, Salin Seri atau Tambah
            if (rows.length >= targetSeri) {
                const targetEdit = findRowActionBtn(rows[targetSeri - 1], "edit");
                if (targetEdit) {
                    targetEdit.click();
                    await waitUntilCondition(() => isBarangDetailFormOpen(), 2200, 100);
                    return;
                }
            }

            const copied = await clickToolbarCopyWithRowSelect(rows);
            if (!copied) {
                const addBtn = findVisibleActionButton([/^\s*\+?\s*tambah\b/i, /tambah\s*barang/i]);
                if (addBtn) addBtn.click();
            }
            await handleConfirmModalIfAny();

            // Tunggu sampai form terbuka langsung ATAU baris tabel bertambah jadi targetSeri lalu klik Edit baris baru
            await waitUntilCondition(() => !document.querySelector(".ant-spin-spinning") && (isBarangDetailFormOpen() || findBarangTableRows().length >= targetSeri), 3000, 120);
            if (!isBarangDetailFormOpen()) {
                const updatedRows = findBarangTableRows();
                if (updatedRows.length >= targetSeri) {
                    const newEditBtn = findRowActionBtn(updatedRows[targetSeri - 1], "edit") || findRowActionBtn(updatedRows[updatedRows.length - 1], "edit");
                    if (newEditBtn) {
                        newEditBtn.click();
                        await waitUntilCondition(() => isBarangDetailFormOpen(), 2200, 100);
                    }
                }
            }
            return;
        }

        // 2. Form SUDAH terbuka: cek apakah sedang berada di Seri sebelumnya (< targetSeri)
        const currentSeri = readDisabledOrActiveSeriInput(findCeisaTargetContainer()) || readDisabledOrActiveSeriInput(document);
        if (targetSeri > 1 && currentSeri && currentSeri < targetSeri) {
            // Simpan Seri aktif dulu supaya data Seri sebelumnya tidak tertimpa
            const saveBtn = findVisibleActionButton([/^\s*simpan\b/i, /simpan/i], findCeisaTargetContainer()) ||
                findVisibleActionButton([/^\s*simpan\b/i, /simpan/i], document);
            if (saveBtn) {
                saveBtn.click();
                await waitBarangSaveSettled(targetSeri);
            }

            // Re-evaluasi setelah Simpan: jika kembali ke tabel atau masih di Seri lama, buka/buat Seri targetSeri
            const afterSeri = readDisabledOrActiveSeriInput(findCeisaTargetContainer()) || readDisabledOrActiveSeriInput(document);
            if (!isBarangDetailFormOpen() || (afterSeri && afterSeri < targetSeri)) {
                const rows = findBarangTableRows();
                if (!isBarangDetailFormOpen() && rows.length >= targetSeri) {
                    const targetEdit = findRowActionBtn(rows[targetSeri - 1], "edit");
                    if (targetEdit) {
                        targetEdit.click();
                        await waitUntilCondition(() => isBarangDetailFormOpen(), 2200, 100);
                        return;
                    }
                }
                const copied = await clickToolbarCopyWithRowSelect(rows);
                if (!copied) {
                    const addBtn = findVisibleActionButton([/^\s*\+?\s*tambah\b/i, /tambah\s*barang/i]);
                    if (addBtn) addBtn.click();
                }

                await handleConfirmModalIfAny();
                await waitUntilCondition(() => {
                    if (document.querySelector(".ant-spin-spinning")) return false;
                    const s = readDisabledOrActiveSeriInput(findCeisaTargetContainer()) || readDisabledOrActiveSeriInput(document);
                    return (isBarangDetailFormOpen() && (!s || s >= targetSeri)) || (!isBarangDetailFormOpen() && findBarangTableRows().length >= targetSeri);
                }, 3000, 120);

                if (!isBarangDetailFormOpen()) {
                    const updatedRows = findBarangTableRows();
                    const newEditBtn = updatedRows[targetSeri - 1]
                        ? findRowActionBtn(updatedRows[targetSeri - 1], "edit")
                        : (updatedRows.length > 0 ? findRowActionBtn(updatedRows[updatedRows.length - 1], "edit") : null);
                    if (newEditBtn) {
                        newEditBtn.click();
                        await waitUntilCondition(() => isBarangDetailFormOpen(), 2200, 100);
                    }
                }
            }
        }
    }

    async function flushPendingAntSelectDropdowns() {
        if (_pendingAntSelectTasks.length === 0) return;
        const tasks = _pendingAntSelectTasks.splice(0, _pendingAntSelectTasks.length);
        for (const task of tasks) {
            const matched = await waitUntilCondition(
                () => selectMatchingAntDropdownOption(task.antSelectWrap, task.lowerTarget),
                750,
                120
            );
            if (!matched && typeof task.element?.blur === "function") {
                try { task.element.blur(); } catch (_) {}
            }
        }
    }

    async function handleCeisaAutoInputRowAsync(message) {
        if (!message || typeof message !== "object") {
            return { ok: false, message: "Payload tidak valid." };
        }

        const section = message.section || "entitas";
        const cfg = message.autofillConfig || window._ceisaAutofillConfig || DEFAULT_CEISA_AUTOFILL_CONFIG;

        // Pastikan tab CEISA aktif berpindah & React selesai me-render DOM sebelum mencari form
        const isSectionDisabled =
            (section === "pungutan" && cfg.pungutan !== true) ||
            (section === "entitas" && (cfg.entitas === false || cfg.entitas?.enabled === false)) ||
            (section !== "entitas" && section !== "pungutan" && cfg[section] === false);

        if (!isSectionDisabled && typeof switchCeisaActiveTab === "function" && detectCeisaActiveSection() !== section) {
            const switched = switchCeisaActiveTab(section);
            if (switched) {
                await waitUntilCondition(() => detectCeisaActiveSection() === section || countFormControls(findCeisaTargetContainer()) > 0, 1200, 100);
                await sleepMs(150);
            }
        }

        if (!isSectionDisabled) {
            if (section === "barang") {
                const targetSeri = (Number(message.index) || 0) + 1;
                await prepareBarangFormForTargetSeri(targetSeri);
            } else if (section === "dokumen") {
                const container = findCeisaTargetContainer();
                const hasNumInp = Boolean(findFieldByKeywords(["nomorDokumen", "nomor dokumen", "noDok"], container));
                if (!hasNumInp) {
                    const addDocBtn = findVisibleActionButton([/^\s*\+?\s*tambah\b/i, /tambah\s*dokumen/i]);
                    if (addDocBtn) {
                        addDocBtn.click();
                        await waitUntilCondition(() => Boolean(findFieldByKeywords(["nomorDokumen", "nomor dokumen", "noDok"], findCeisaTargetContainer())), 1200, 100);
                    }
                }
            }
        }

        _pendingAntSelectTasks.length = 0;
        const result = handleCeisaAutoInputRow(message);
        await flushPendingAntSelectDropdowns();

        if (result && result.ok && !result.skipped && message.saveAfterFill === true && (section === "barang" || section === "dokumen")) {
            await sleepMs(180);
            const saveBtn = findVisibleActionButton([/^\s*simpan\b/i, /simpan/i], findCeisaTargetContainer()) ||
                findVisibleActionButton([/^\s*simpan\b/i, /simpan/i], document);
            if (saveBtn) {
                saveBtn.click();
                if (section === "barang") {
                    await waitBarangSaveSettled(null);
                } else {
                    await waitUntilCondition(() => !document.querySelector(".ant-spin-spinning"), 2500, 120);
                    await sleepMs(200);
                }
            }
        }

        return result;
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
            pushSingleCacheItemToSupabase(scanCache[registrationNumber]).catch(() => { });
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


    if (__IS_SCANNER_MODULE__) {
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
    }

    // ========================================================
    // INITIAL
    // ========================================================

    async function initContentScript() {
        if (!__IS_SCANNER_MODULE__) return;
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

    // Expose internal functions globally for content script invocation and test harness execution
    if (typeof window !== "undefined") {
        window.handleCeisaAutoInputRow = handleCeisaAutoInputRow;
        window.handleCeisaAutoInputRowAsync = handleCeisaAutoInputRowAsync;
        window.findFieldByKeywords = findFieldByKeywords;
        window.setNativeInputValue = setNativeInputValue;
        window.findCeisaCard = findCeisaCard;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.handleCeisaAutoInputRow = handleCeisaAutoInputRow;
        globalThis.handleCeisaAutoInputRowAsync = handleCeisaAutoInputRowAsync;
        globalThis.findFieldByKeywords = findFieldByKeywords;
        globalThis.setNativeInputValue = setNativeInputValue;
        globalThis.findCeisaCard = findCeisaCard;
    }

})();