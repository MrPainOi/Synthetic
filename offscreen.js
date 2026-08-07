// ============================================================
// CEISA AUTO COLORING
// offscreen.js
// ============================================================

import * as pdfjsLib from "./pdf.mjs";


// ============================================================
// PDF.js worker
// ============================================================

pdfjsLib.GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL("pdf.worker.mjs");


console.log(
    "CEISA PDF Processor aktif. PDF.js:",
    pdfjsLib.version
);


// ============================================================
// Base64 → Uint8Array
// ============================================================

function base64ToUint8Array(base64) {

    const binary = atob(base64);

    const bytes = new Uint8Array(
        binary.length
    );

    for (
        let i = 0;
        i < binary.length;
        i++
    ) {

        bytes[i] =
            binary.charCodeAt(i);

    }

    return bytes;
}


// ============================================================
// Normalisasi teks
// ============================================================

function normalizeText(text) {

    return String(text || "")
        .normalize("NFKC")
        .replace(/\u00A0/g, " ")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n")
        .trim();

}


// ============================================================
// Normalisasi pencarian
// ============================================================

function normalizeSearch(text) {

    return normalizeText(text)
        .toUpperCase()
        .replace(/[‐-‒–—−]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

}


// ============================================================
// Ambil text PDF
// ============================================================

async function extractPdfText(base64) {

    const data =
        base64ToUint8Array(base64);

    console.log(
        "CEISA PDF size:",
        data.byteLength,
        "bytes"
    );


    const loadingTask =
        pdfjsLib.getDocument({

            data,

            useWorkerFetch: true,

            isEvalSupported: true

        });


    const pdf =
        await loadingTask.promise;


    console.log(
        "CEISA PDF pages:",
        pdf.numPages
    );


    const pages = [];

    let allText = "";


    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {

        const page =
            await pdf.getPage(pageNumber);


        const content =
            await page.getTextContent();


        const pageText =
            content.items

                .map(item =>
                    typeof item.str === "string"
                        ? item.str
                        : ""
                )

                .join(" ");


        const clean =
            normalizeText(pageText);


        pages.push({

            page: pageNumber,

            text: clean

        });


        allText +=
            "\n" +
            clean;

    }


    return {

        text:
            normalizeText(allText),

        pages

    };

}


// ============================================================
// Cari nilai setelah label
// ============================================================

function findAfterLabel(text, labels) {

    const source =
        normalizeSearch(text);


    for (const label of labels) {

        const normalizedLabel =
            normalizeSearch(label);


        const index =
            source.indexOf(normalizedLabel);


        if (index === -1) {
            continue;
        }


        const after =
            source.substring(
                index +
                normalizedLabel.length
            );


        const clean =
            after

                .replace(/^[:\-\s]+/, "")

                .split(/\n{2,}/)[0]

                .substring(0, 300)

                .trim();


        if (clean) {
            return clean;
        }

    }


    return "";

}


// ============================================================
// SPPB
// ============================================================

function isKnownPortKeyword(text) {
    if (!text) return false;
    const upper = String(text).toUpperCase();
    const keywords = ["SEWU", "SEKUPANG", "IDKSP", "BATU", "AMPAR", "IDBTU", "CITRA", "TUSA", "IDCTS", "KABIL", "IDKDA", "TPS", "PELABUHAN", "DERMAGA", "TERMINAL"];
    return keywords.some(kw => upper.includes(kw));
}

function cleanLocation(val, targetFound, defaultTarget = "SEWU") {
    if (!val) {
        return targetFound ? defaultTarget : "";
    }
    let str = String(val).toUpperCase().trim();

    // Check for explicit known port locations first
    if (str.includes("SEWU")) return "SEWU";
    if (str.includes("IDBTU") || str.includes("BATU AMPAR") || str.includes("BATUAMPAR")) return "IDBTU - BATU AMPAR";
    if (str.includes("IDKSP") || str.includes("SEKUPANG")) return "IDKSP - SEKUPANG";
    if (str.includes("IDCTS") || str.includes("CITRA TUSA") || str.includes("CITRATUSA")) return "IDCTS - CITRA TUSA";
    if (str.includes("IDKDA") || str.includes("KABIL")) return "IDKDA - KABIL";

    // Potong pada label pengangkut / kapal / B. PELABUHAN / VOY / FLIGHT
    str = str.split(/\b(?:NAMA|SARANA|PENGANGKUT|NO\.|B\/L|NO\s|VOY|VOYAGE|FLIGHT|KAPAL|B\.\s*PELABUHAN|PELABUHAN\s+MUAT\s+EKSPOR|TANGGAL|NOMOR|NPWP|ALAMAT)\b/i)[0].trim();
    str = str.replace(/^(?:[A-Z0-9\.\s]*PELABUHAN[A-Z0-9\.\s]*:|LOKASI\s+BARANG\s*:|LOCATION\s+OF\s+GOODS\s*:|[:\-\s]+)+/i, "").trim();

    if (str.includes("SEWU")) return "SEWU";
    if (str.includes("IDBTU") || str.includes("BATU AMPAR") || str.includes("BATUAMPAR")) return "IDBTU - BATU AMPAR";
    if (str.includes("IDKSP") || str.includes("SEKUPANG")) return "IDKSP - SEKUPANG";
    if (str.includes("IDCTS") || str.includes("CITRA TUSA") || str.includes("CITRATUSA")) return "IDCTS - CITRA TUSA";
    if (str.includes("IDKDA") || str.includes("KABIL")) return "IDKDA - KABIL";

    str = str.replace(/^[:\/\-\,\.\s]+|[:\/\-\,\.\s]+$/, "").trim();

    // Filter out Voyage / Flight / BL codes (e.g. 03D890, 1779A, P30G26, 1234F, V.1779, or alphanumeric codes)
    const isAlphanumericCode = /^(?=.*\d)[A-Z0-9\.\-\/]{3,20}$/i.test(str);
    const hasNoPortKeyword = !isKnownPortKeyword(str);

    if ((isAlphanumericCode && hasNoPortKeyword) || str.length < 3) {
        return targetFound ? defaultTarget : "";
    }
    return str;
}


function analyzeSPPB(text) {

    const normalized =
        normalizeSearch(text);


    const value =
        findAfterLabel(

            text,

            [

                "LOKASI BARANG",

                "LOKASI BARANG :",

                "LOKASI BARANG:",

                "LOCATION OF GOODS"

            ]

        );


    const targetFound =
        /\bSEWU\b/i.test(
            normalized
        );


    const cleanLoc =
        cleanLocation(value, targetFound, "SEWU");


    return {

        target: "SEWU",

        found:
            targetFound,

        value:
            cleanLoc

    };

}


// ============================================================
// NPPB
// ============================================================

function analyzeNPPB(text) {

    const normalized =
        normalizeSearch(text);


    const value =
        findAfterLabel(

            text,

            [

                "PELABUHAN MUAT EKSPOR",

                "A.PELABUHAN MUAT ASAL",

                "A. PELABUHAN MUAT ASAL",

                "PELABUHAN MUAT ASAL",

                "PELABUHAN MUAT"

            ]

        );


    const targetFound =
        normalized.includes("IDKSP") &&
        normalized.includes("SEKUPANG");


    const cleanLoc =
        cleanLocation(value, targetFound, "IDKSP - Sekupang");


    return {

        target:
            "IDKSP - Sekupang",

        found:
            targetFound,

        value:
            cleanLoc

    };

}


// ============================================================
// EKSTRAK NAMA PERUSAHAAN
// ============================================================

function extractCompanyName(text) {
    if (!text) return "";

    const raw = String(text);

    const labels = [
        "NAMA IMPORTIR / PEMILIK BARANG",
        "NAMA IMPORTIR",
        "NAMA EKSPORTIR",
        "IMPORTIR / PEMILIK BARANG",
        "IMPORTIR / EKSPORTIR",
        "IMPORTIR",
        "EKSPORTIR",
        "PEMILIK BARANG",
        "NAMA PERUSAHAAN",
        "PERUSAHAAN",
        "NAMA PENGUSAHA TPB",
        "PENGUSAHA TPB",
        "NAMA PENGUSAHA",
        "PENGUSAHA",
        "PENERIMA BARANG",
        "PENERIMA",
        "PENGIRIM BARANG",
        "PENGIRIM",
        "KEPADA YTH.",
        "KEPADA YTH",
        "KEPADA"
    ];

    let foundStr = "";

    function cleanName(str) {
        if (!str) return "";
        let line = String(str).trim();

        // 1. Potong pada kata kunci label terpisah
        line = line.split(/\b(?:NPWP|ALAMAT|NOMOR|NO\.|NO\s|TANGGAL|TGL|TELP|FAX|POS|NIB|STATUS|JL|JALAN|KEPADA|SERIES|JUMLAH|BRUTO|NETTO|KODE)\b/i)[0].trim();

        // 2. Hapus awalan label generik jika ada di depan string
        line = line.replace(/^(?:[\/\-:\s]*\b(?:IMPORTIR|EKSPORTIR|PEMILIK|BARANG|PENERIMA|PENGUSAHA|TPB|PERUSAHAAN|PENGIRIM|KEPADA|YTH)\b[\/\-:\s]*)+/i, "").trim();

        // 3. Hapus nomor NPWP / ID pendaftaran di awal jika ada
        line = line.replace(/^(?:\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\.\s]?\d[\.\s\-]?\d{3}[\.\s]?\d{3}|\d+)\s*[\/\-:]+\s*/, "").trim();

        // 4. Hapus angka NPWP / NIB / kode 8-20 digit di mana saja di dalam string
        line = line.replace(/\b\d{8,20}\b[\.\s]*/g, "").trim();

        // 5. Hapus angka berlebih di akhir string
        line = line.replace(/\s+\d+[\.\s]*$/g, "").trim();

        // 6. Rapikan awalan PT / CV / UD (misal: "PT. . VOLEX" -> "PT. VOLEX", "PT.VALEO" -> "PT. VALEO")
        line = line.replace(/\bPT[\.\s]*\.?\s*/gi, "PT. ").trim();
        line = line.replace(/\bCV[\.\s]*\.?\s*/gi, "CV. ").trim();
        line = line.replace(/\bUD[\.\s]*\.?\s*/gi, "UD. ").trim();

        // 7. Hapus tanda baca berlebih di awal & akhir
        line = line.replace(/^[:\/\-\,\.\s]+|[:\/\-\,\.\s]+$/g, "").trim();

        // 8. Jika hasil pembersihan hanya berupa kata generik atau terlalu pendek, kosongkan
        const upper = line.toUpperCase();
        const genericOnly = [
            "PENERIMA", "IMPORTIR", "EKSPORTIR", "PEMILIK", "BARANG",
            "PEMILIK BARANG", "PENERIMA BARANG", "PENGUSAHA", "PENGUSAHA TPB",
            "PERUSAHAAN", "KEPADA YTH", "KEPADA", "PENGIRIM", "PENGIRIM BARANG",
            "PENERIMA/IMPORTIR", "IMPORTIR/PENERIMA"
        ];

        if (genericOnly.includes(upper) || upper.length < 3) {
            return "";
        }

        return line;
    }

    for (const label of labels) {
        const idx = raw.toUpperCase().indexOf(label);
        if (idx !== -1) {
            const after = raw.substring(idx + label.length).trim();
            let candidate = after.replace(/^[:\-\s]+/, "").trim();
            candidate = candidate.replace(/^(?:\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\.\s]?\d[\.\s\-]?\d{3}[\.\s]?\d{3}|\d{5,20})\s*[\/\-]?\s*/, "").trim();

            const stopMatch = candidate.match(/^([^\n\r]+)/);
            if (stopMatch) {
                const line = cleanName(stopMatch[1]);
                if (line.length >= 3) {
                    foundStr = line;
                    break;
                }
            }
        }
    }

    if (!foundStr) {
        const ptMatch = raw.match(/\b(PT|CV|UD|PD)\.?\s+([A-Z0-9\.\s\-\&\(\)\,\']{3,60})/i);
        if (ptMatch) {
            let name = (ptMatch[1] + ". " + ptMatch[2]).trim();
            name = cleanName(name);
            if (name.length >= 3) {
                foundStr = name;
            }
        }
    }

    if (foundStr) {
        foundStr = cleanName(foundStr);
        foundStr = foundStr.substring(0, 80).replace(/\s+/g, " ").trim();
    }

    return foundStr;
}


// ============================================================
// Analisa PDF
// ============================================================

async function analyzePdf(message) {

    const {

        base64,

        documentType,

        documentNumber

    } = message;


    const extracted =
        await extractPdfText(
            base64
        );


    const text =
        extracted.text;


    let analysis;


    const type =
        String(
            documentType || ""
        )
        .toUpperCase();


    if (type === "SPPB") {

        analysis =
            analyzeSPPB(text);

    }

    else if (type === "NPPB") {

        analysis =
            analyzeNPPB(text);

    }

    else {

        // Fallback berdasarkan isi PDF

        const upper =
            normalizeSearch(text);


        if (
            upper.includes("LOKASI BARANG")
        ) {

            analysis =
                analyzeSPPB(text);

        }

        else if (
            upper.includes(
                "PELABUHAN MUAT"
            )

        ) {

            analysis =
                analyzeNPPB(text);

        }

        else {

            analysis = {

                found: false,

                target: "",

                value: ""

            };

        }

    }


    const companyName =
        extractCompanyName(text);


    return {

        documentNumber,

        documentType,

        found:
            Boolean(analysis.found),

        target:
            analysis.target,

        value:
            analysis.value,

        companyName:
            companyName || "",

        pageCount:
            extracted.pages.length,

        preview:
            text.substring(0, 1200)

    };

}


// ============================================================
// Runtime message
// ============================================================

chrome.runtime.onMessage.addListener(

    (message) => {

        if (
            message.target !==
            "offscreen"
        ) {

            return;

        }


        if (
            message.type !==
            "PARSE_PDF"
        ) {

            return;

        }


        (async () => {

            try {

                console.log(
                    "CEISA: parsing PDF",
                    message.documentNumber
                );


                const result =
                    await analyzePdf(
                        message
                    );


                console.log(
                    "CEISA: PDF result",
                    result
                );


                chrome.runtime.sendMessage({

                    target:
                        "background",

                    type:
                        "PDF_RESULT",

                    tabId:
                        message.tabId,

                    jobId:
                        message.jobId,

                    result

                });


            } catch (error) {

                console.error(
                    "CEISA PDF parser error:",
                    error
                );


                chrome.runtime.sendMessage({

                    target:
                        "background",

                    type:
                        "PDF_RESULT",

                    tabId:
                        message.tabId,

                    jobId:
                        message.jobId,

                    result: {

                        found: false,

                        error:
                            error?.message ||
                            String(error)

                    }

                });

            }

        })();

    }

);