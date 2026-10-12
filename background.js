// ============================================================
// CEISA AUTO COLORING
// background.js
// ============================================================

console.log("CEISA Auto Coloring background aktif");

const OFFSCREEN_PATH = "offscreen.html";

let creatingOffscreen = null;


// ============================================================
// Pastikan offscreen document aktif
// ============================================================

async function ensureOffscreenDocument() {

    const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);

    if ("getContexts" in chrome.runtime) {

        const contexts = await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
            documentUrls: [offscreenUrl]
        });

        if (contexts.length > 0) {
            return;
        }

    }

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    creatingOffscreen = chrome.offscreen.createDocument({

        url: OFFSCREEN_PATH,

        reasons: [
            "BLOBS",
            "WORKERS"
        ],

        justification:
            "Membaca PDF CEISA di memory untuk menentukan lokasi barang atau pelabuhan muat."

    });

    try {

        await creatingOffscreen;

    } finally {

        creatingOffscreen = null;

    }

}


// ============================================================
// Pesan dari content.js / offscreen.js / popup.js
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // --------------------------------------------------------
    // Parse PDF
    // --------------------------------------------------------

    if (message.type === "PARSE_PDF") {

        const tabId = sender.tab?.id;

        if (!tabId) {

            sendResponse({
                ok: false,
                error: "TAB_ID tidak ditemukan"
            });

            return;
        }

        (async () => {

            try {

                await ensureOffscreenDocument();

                chrome.runtime.sendMessage({

                    target: "offscreen",

                    type: "PARSE_PDF",

                    jobId: message.jobId,

                    documentNumber: message.documentNumber,

                    documentType: message.documentType,

                    base64: message.base64,

                    tabId

                });

                sendResponse({
                    ok: true
                });

            } catch (error) {

                console.error(
                    "CEISA background PARSE_PDF error:",
                    error
                );

                sendResponse({

                    ok: false,

                    error:
                        error?.message ||
                        String(error)

                });

            }

        })();

        return true;
    }


    // --------------------------------------------------------
    // Hasil parsing PDF dari offscreen
    // --------------------------------------------------------

    if (
        message.target === "background" &&
        message.type === "PDF_RESULT"
    ) {

        const tabId = message.tabId;

        if (!tabId) {
            return;
        }

        chrome.tabs.sendMessage(

            tabId,

            {

                type: "PDF_RESULT",

                jobId: message.jobId,

                result: message.result

            },

            () => {

                // Supaya tidak muncul:
                // Could not establish connection
                void chrome.runtime.lastError;

            }

        );

        return;
    }


    // --------------------------------------------------------
    // Status popup
    // --------------------------------------------------------

    if (message.type === "GET_STATUS") {

        chrome.storage.local.get(

            [
                "ceisa_scan_status",
                "ceisa_scan_stats"
            ],

            data => {

                sendResponse({

                    status:
                        data.ceisa_scan_status ||
                        "idle",

                    stats:
                        data.ceisa_scan_stats ||
                        {

                            total: 0,
                            processed: 0,
                            green: 0,
                            orange: 0,
                            red: 0,
                            error: 0

                        }

                });

            }

        );

        return true;
    }


    // --------------------------------------------------------
    // Kontrol Backend Server via Native Messaging (Internal)
    // --------------------------------------------------------

    if (message.type === "START_BACKEND_SERVER") {
        handleNativeServerAction("start", sendResponse);
        return true;
    }

    if (message.type === "STOP_BACKEND_SERVER") {
        handleNativeServerAction("stop", sendResponse);
        return true;
    }

    if (message.type === "CHECK_BACKEND_STATUS") {
        handleNativeServerAction({ action: "status" }, sendResponse);
        return true;
    }

    // --------------------------------------------------------
    // Sistem Pembaruan Proyek (Auto-Update & Push-Update)
    // --------------------------------------------------------
    if (message.type === "GET_SYSTEM_VERSION") {
        handleNativeServerAction({ action: "get_version" }, sendResponse);
        return true;
    }

    if (message.type === "CHECK_UPDATE") {
        handleNativeServerAction({ action: "check_update" }, sendResponse);
        return true;
    }

    if (message.type === "PERFORM_PULL_UPDATE") {
        handleNativeServerAction({ action: "pull_update" }, (res) => {
            sendResponse(res);
            if (res && res.ok && res.data && res.data.status === "success") {
                setTimeout(() => {
                    chrome.runtime.reload();
                }, 1200);
            }
        });
        return true;
    }

    if (message.type === "PERFORM_PUSH_UPDATE") {
        handleNativeServerAction({
            action: "push_update",
            commit_message: message.commit_message || ""
        }, async (res) => {
            if (res && res.ok && res.data && res.data.status === "success") {
                // Broadcast ke Google Apps Script agar client lain langsung dapat sinyal update
                try {
                    const scriptUrl = "https://script.google.com/macros/s/AKfycbyGBHuIkhsLawwQ1V48bKXmg8MXu35sc7iD91Re2We6mOsDvFm0uM8g6lnZxxKYfl0/exec";
                    await fetch(scriptUrl, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({
                            action: "publish_update",
                            commit: res.data.commit,
                            version: res.data.version || "2.1.0",
                            message: message.commit_message || "Update otomatis",
                            branch: "SupabaseV2"
                        })
                    });
                } catch (_) {}
            }
            sendResponse(res);
        });
        return true;
    }

    if (message.type === "RELOAD_EXTENSION") {
        sendResponse({ ok: true });
        setTimeout(() => {
            chrome.runtime.reload();
        }, 500);
        return true;
    }

});

// Helper komunikasi Native Messaging Host
function handleNativeServerAction(actionPayload, sendResponse) {
    try {
        const payload = typeof actionPayload === "string" ? { action: actionPayload } : actionPayload;
        chrome.runtime.sendNativeMessage(
            "com.ceisa.server_launcher",
            payload,
            (response) => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        ok: false,
                        error: chrome.runtime.lastError.message
                    });
                } else {
                    sendResponse({
                        ok: true,
                        data: response
                    });
                }
            }
        );
    } catch (err) {
        sendResponse({
            ok: false,
            error: err.message
        });
    }
}

// ============================================================
// Pesan dari Web Page Eksternal (localhost / 127.0.0.1 / Portal CEISA)
// ============================================================
if (chrome.runtime.onMessageExternal) {
    chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
        if (!message) return;
        if (message.type === "START_BACKEND_SERVER") {
            handleNativeServerAction("start", sendResponse);
            return true;
        }
        if (message.type === "STOP_BACKEND_SERVER") {
            handleNativeServerAction("stop", sendResponse);
            return true;
        }
        if (message.type === "CHECK_BACKEND_STATUS") {
            handleNativeServerAction("status", sendResponse);
            return true;
        }
    });
}