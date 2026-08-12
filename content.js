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


    async function getActiveScanDate() {
        const data = await chrome.storage.local.get("ceisa_last_scan_date");
        if (data.ceisa_last_scan_date) {
            scanDate = data.ceisa_last_scan_date;
            return data.ceisa_last_scan_date;
        }
        const detected = (typeof detectCeisaPortalDate === "function") ? detectCeisaPortalDate() : null;
        if (detected) {
            scanDate = detected;
            return detected;
        }
        return scanDate || todayISO();
    }

    async function loadCompletedNumbers() {
        const activeDate = await getActiveScanDate();
        const data = await chrome.storage.local.get([
            `ceisa_completed_numbers_${activeDate}`,
            "ceisa_completed_numbers"
        ]);

        const list = Array.isArray(data[`ceisa_completed_numbers_${activeDate}`])
            ? data[`ceisa_completed_numbers_${activeDate}`]
            : (Array.isArray(data.ceisa_completed_numbers) ? data.ceisa_completed_numbers : []);

        completedNumbers = new Set(
            list
                .map(x => String(x).trim())
                .filter(x => /^\d{6}$/.test(x))
        );
    }

    async function loadPibPebNumbers() {
        const activeDate = await getActiveScanDate();
        const data = await chrome.storage.local.get([
            `ceisa_pibpeb_numbers_${activeDate}`,
            "ceisa_pibpeb_numbers"
        ]);

        const list = Array.isArray(data[`ceisa_pibpeb_numbers_${activeDate}`])
            ? data[`ceisa_pibpeb_numbers_${activeDate}`]
            : (Array.isArray(data.ceisa_pibpeb_numbers) ? data.ceisa_pibpeb_numbers : []);

        pibPebNumbers = new Set(
            list
                .map(x => String(x).trim())
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

    async function loadCompletedNumbers() {

        const data =
            await chrome.storage.local.get(
                "ceisa_completed_numbers"
            );


        const value =
            Array.isArray(
                data.ceisa_completed_numbers
            )
                ? data.ceisa_completed_numbers
                : [];


        completedNumbers =
            new Set(

                value
                    .map(x =>
                        String(x).trim()
                    )
                    .filter(x =>
                        /^\d{6}$/.test(x)
                    )

            );

    }


    // ========================================================
    // SCAN CACHE
    // ========================================================

    function isWithinLast3Days(dateStr, timestamp) {
        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0);

        if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const itemDate = new Date(dateStr + "T00:00:00");
            return itemDate >= cutoff;
        }

        if (timestamp && typeof timestamp === "number") {
            const itemDate = new Date(timestamp);
            return itemDate >= cutoff;
        }

        return true;
    }

    function pruneScanCache3Days(cache) {
        if (!cache || typeof cache !== "object") return {};
        const pruned = {};
        for (const [key, item] of Object.entries(cache)) {
            if (item && isWithinLast3Days(item.rowDate, item.timestamp)) {
                pruned[key] = item;
            }
        }
        return pruned;
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
        const status = itemOrCache?.status;
        if (status === "red" || status === "yellow" || status === "pink" || status === "cream" || status === "aqua") {
            return true;
        }
        const str = (
            (itemOrCache?.location || "") + " " +
            (itemOrCache?.target || "") + " " +
            (itemOrCache?.value || "") + " " +
            (itemOrCache?.companyName || "") + " " +
            rowText
        ).toUpperCase();
        return str.includes("BATU AMPAR") || str.includes("BATUAMPAR") || str.includes("IDBTU");
    }

    function isSekupang(itemOrCache, rowText = "") {
        if (isBatuAmpar(itemOrCache, rowText)) return false;
        return true;
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

        // 3. Only SPPB/NPPB Printed (ALWAYS OVERRIDES STALE ORANGE STATUS)
        if (isSppbPrinted && !isPibPebPrinted) {
            return batuAmpar ? "yellow" : "green";
        }

        // 4. Belum Di Print SPPB/NPPB (Hanya jika ada di scanCache)
        if (cached && cached.status) {
            if (cached.status === "orange" || cached.status === "red") {
                return batuAmpar ? "red" : "orange";
            }
            return cached.status;
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
                existing.style.removeProperty("background");
                existing.style.removeProperty("color");
                existing.style.removeProperty("padding");
                existing.style.removeProperty("border-radius");
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

        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
            return clean;
        }

        const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyMatch) {
            const day = String(dmyMatch[1]).padStart(2, "0");
            const month = String(dmyMatch[2]).padStart(2, "0");
            const year = dmyMatch[3];
            return `${year}-${month}-${day}`;
        }

        return null;
    }

    let lastDetectedPortalDate = null;

    function detectCeisaPortalDate() {
        // Priority 1: Currently focused input on CEISA page
        if (document.activeElement && document.activeElement.tagName === "INPUT") {
            const val = parseDateString(document.activeElement.value);
            if (val) return val;
        }

        // Priority 2: Check date filter inputs on CEISA page
        const dateInputs = Array.from(document.querySelectorAll("input")).filter(input => {
            const type = (input.type || "").toLowerCase();
            const name = (input.name || "").toLowerCase();
            const placeholder = (input.placeholder || "").toLowerCase();
            const cls = (input.className || "").toLowerCase();
            const id = (input.id || "").toLowerCase();
            return type === "date" || name.includes("tanggal") || name.includes("date") ||
                   placeholder.includes("tanggal") || placeholder.includes("date") ||
                   cls.includes("date") || id.includes("date") || id.includes("tanggal");
        });

        const dateValues = [];
        for (const input of dateInputs) {
            const val = parseDateString(input.value);
            if (val) dateValues.push(val);
        }

        if (dateValues.length > 0) {
            dateValues.sort();
            return dateValues[dateValues.length - 1];
        }

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
            await Promise.all([
                loadCompletedNumbers(),
                loadPibPebNumbers(),
                loadScanCache()
            ]);
            recolorExistingRows();
        }
    }

    // Attach real-time input change listener to all date inputs on CEISA page
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
        message => {

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

                loadCompletedNumbers()
                    .then(
                        () =>
                            recolorExistingRows()
                    );

                return;

            }

        }
    );


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
        autoSyncDateFromCeisaPortal();
        const rows =
            getRows();

        let updated = false;

        for (const item of rows) {

            const reg =
                item.registrationNumber;

            const cached =
                scanCache[reg];

            const color =
                determineRowColor(reg, item.row, cached);

            colorRegistrationNumber(

                item.row,

                reg,

                color

            );

            if (cached) {

                if (!cached.documentType && item.documentType) {

                    cached.documentType = item.documentType;

                    cached.documentNumber = item.documentNumber;

                    updated = true;

                }

            } else {

                scanCache[reg] = {

                    registrationNumber:
                        reg,

                    documentType:
                        item.documentType,

                    documentNumber:
                        item.documentNumber,

                    status:
                        color || (completedNumbers.has(reg) ? "green" : ""),

                    companyName: "",

                    location: "",

                    rowDate:
                        item.rowDate,

                    timestamp:
                        Date.now()

                };

                updated = true;

            }

        }

        if (updated) {

            saveScanCache();

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

        const isBatuAmparItem =
            scanCache[registrationNumber]?.status === "yellow" ||
            isBatuAmpar(scanCache[registrationNumber]) ||
            isBatuAmpar(result) ||
            isBatuAmpar(null, row?.innerText);

        const finalStatus =
            computedColor ||
            (isCompleted
                ? (isBatuAmparItem ? "yellow" : "green")
                : (found ? "orange" : "red"));


        colorRegistrationNumber(
            row,
            registrationNumber,
            finalStatus
        );

        if (finalStatus === "green" || finalStatus === "yellow" || finalStatus === "blue" || finalStatus === "purple" || finalStatus === "cream") {
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
                result?.value || result?.target || "",

            rowDate:
                item.rowDate,

            timestamp:
                Date.now()

        };


        await saveScanCache();


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
                const data = await chrome.storage.local.get(["ceisa_completed_numbers", "ceisa_pibpeb_numbers", "ceisa_scan_cache"]);
                await pushExactStateToWifiServer(
                    data.ceisa_completed_numbers || [],
                    data.ceisa_pibpeb_numbers || [],
                    data.ceisa_scan_cache || {}
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
            const data = await chrome.storage.local.get(["ceisa_completed_numbers", "ceisa_pibpeb_numbers", "ceisa_scan_cache"]);
            await pushExactStateToWifiServer(
                data.ceisa_completed_numbers || [],
                data.ceisa_pibpeb_numbers || [],
                data.ceisa_scan_cache || {}
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

    let recolorTimer = null;


    const observer =
        new MutationObserver(() => {

            if (recolorTimer) {
                return;
            }


            recolorTimer =
                setTimeout(() => {
                    recolorTimer = null;
                    recolorExistingRows();
                }, 200);
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

        if (hasRelevantChange) {
            await Promise.all([
                loadCompletedNumbers(),
                loadPibPebNumbers(),
                loadScanCache()
            ]);
            recolorExistingRows();
        }
    });


    // Fast 1-second background recolor loop & periodic Wi-Fi sync
    setInterval(async () => {
        recolorExistingRows();
        if (typeof syncWithWifiServer === "function") {
            const synced = await syncWithWifiServer();
            if (synced) {
                await Promise.all([
                    loadCompletedNumbers(),
                    loadPibPebNumbers(),
                    loadScanCache()
                ]);
                recolorExistingRows();
            }
        }
    }, 1000);

    // ========================================================
    // INITIAL
    // ========================================================

    async function initContentScript() {
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

    window.addEventListener("load", () => {
        initContentScript();
    });


})();