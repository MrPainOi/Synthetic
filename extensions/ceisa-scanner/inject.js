// ============================================================
// CEISA AUTO COLORING
// inject.js
// PAGE WORLD
// ============================================================

(() => {

    if (window.__CEISA_AUTO_COLORING_HOOK__) {

        console.log(
            "CEISA Auto Coloring hook sudah aktif"
        );

        return;

    }


    window.__CEISA_AUTO_COLORING_HOOK__ = true;


    console.log(
        "CEISA Auto Coloring Page Hook aktif"
    );


    let armed = false;

    let currentJobId = null;

    let currentDocumentNumber = null;


    // ========================================================
    // Helpers
    // ========================================================

    function emit(message) {

        try {

            window.postMessage(

                {

                    source:
                        "CEISA_AUTO_COLORING",

                    ...message

                },

                "*"

            );

        } catch (error) {

            console.error(
                "CEISA emit error:",
                error
            );

        }

    }


    function looksLikePdfRequest(url) {

        if (!url) {
            return false;
        }


        const value =
            String(url)
            .toLowerCase();


        return (

            value.includes(
                "report-service/respon"
            )

            ||

            value.includes(
                "/respon/"
            )

        );

    }


    function looksLikePdfContentType(type) {

        const value =
            String(type || "")
            .toLowerCase();


        return (

            value.includes(
                "application/pdf"
            )

            ||

            value.includes(
                "application/octet-stream"
            )

            ||

            value.includes(
                "pdf"
            )

        );

    }


    // ========================================================
    // ArrayBuffer → Base64
    // ========================================================

    function arrayBufferToBase64(buffer) {

        const bytes =
            new Uint8Array(buffer);


        let binary = "";


        const chunkSize =
            0x8000;


        for (
            let i = 0;
            i < bytes.length;
            i += chunkSize
        ) {

            const chunk =
                bytes.subarray(
                    i,
                    Math.min(
                        i + chunkSize,
                        bytes.length
                    )
                );


            binary +=
                String.fromCharCode(
                    ...chunk
                );

        }


        return btoa(binary);

    }


    // ========================================================
    // Kirim PDF
    // ========================================================

    async function emitPdf(
        buffer,
        url,
        contentType
    ) {

        if (!armed) {
            return;
        }


        if (!buffer) {
            return;
        }


        // Matikan arm SEBELUM async
        // supaya response ganda tidak dikirim.

        armed = false;


        try {

            const base64 =
                arrayBufferToBase64(
                    buffer
                );


            emit({

                type:
                    "PDF_CAPTURED",

                jobId:
                    currentJobId,

                documentNumber:
                    currentDocumentNumber,

                url:
                    String(url || ""),

                contentType:
                    String(contentType || ""),

                base64

            });


            console.log(
                "CEISA: PDF captured",
                currentDocumentNumber,
                buffer.byteLength
            );


        } catch (error) {

            console.error(
                "CEISA PDF capture error:",
                error
            );


            emit({

                type:
                    "PDF_CAPTURE_ERROR",

                jobId:
                    currentJobId,

                error:
                    error?.message ||
                    String(error)

            });

        }

    }


    // ========================================================
    // ARM
    // ========================================================

    window.addEventListener(

        "message",

        event => {

            if (
                event.source !==
                window
            ) {

                return;

            }


            const data =
                event.data;


            if (
                !data ||
                data.source !==
                "CEISA_AUTO_COLORING_CONTROL"
            ) {

                return;

            }


            if (
                data.type !==
                "ARM_PDF"
            ) {

                return;

            }


            armed = true;

            currentJobId =
                data.jobId;

            currentDocumentNumber =
                data.documentNumber;


            console.log(
                "CEISA: armed PDF capture",
                currentDocumentNumber
            );

        }

    );


    // ========================================================
    // FETCH HOOK
    // ========================================================

    if (window.fetch) {

        const originalFetch =
            window.fetch;


        window.fetch =
            async function (...args) {

                const response =
                    await originalFetch.apply(
                        this,
                        args
                    );


                try {

                    if (!armed) {

                        return response;

                    }


                    const requestUrl =
                        typeof args[0] === "string"

                            ? args[0]

                            : args[0]?.url;


                    if (
                        !looksLikePdfRequest(
                            requestUrl
                        )
                    ) {

                        return response;

                    }


                    const contentType =
                        response.headers
                            ?.get("content-type") ||
                        "";


                    const clone =
                        response.clone();


                    const buffer =
                        await clone.arrayBuffer();


                    if (
                        looksLikePdfContentType(
                            contentType
                        )
                        ||
                        buffer.byteLength > 1000
                    ) {

                        await emitPdf(

                            buffer,

                            requestUrl,

                            contentType

                        );

                    }

                } catch (error) {

                    console.debug(
                        "CEISA fetch capture error:",
                        error
                    );

                }


                return response;

            };

    }


    // ========================================================
    // XHR OPEN
    // ========================================================

    const originalXHROpen =
        XMLHttpRequest.prototype.open;


    const originalXHRSend =
        XMLHttpRequest.prototype.send;


    XMLHttpRequest.prototype.open =
        function (
            method,
            url,
            ...rest
        ) {

            this.__ceisa_url =
                url;

            this.__ceisa_method =
                method;


            return originalXHROpen.call(

                this,

                method,

                url,

                ...rest

            );

        };


    // ========================================================
    // XHR SEND
    // ========================================================

    XMLHttpRequest.prototype.send =
        function (body) {

            try {

                if (
                    !this.__ceisa_capture_hook__
                ) {

                    this.__ceisa_capture_hook__ =
                        true;


                    this.addEventListener(

                        "load",

                        async () => {

                            try {

                                if (!armed) {
                                    return;
                                }


                                const url =
                                    this.__ceisa_url;


                                if (
                                    !looksLikePdfRequest(
                                        url
                                    )
                                ) {

                                    return;

                                }


                                const contentType =
                                    this.getResponseHeader(
                                        "content-type"
                                    ) || "";


                                let buffer = null;


                                // --------------------------------
                                // responseType blob
                                // --------------------------------

                                if (
                                    this.responseType ===
                                    "blob"
                                ) {

                                    if (
                                        this.response instanceof
                                        Blob
                                    ) {

                                        buffer =
                                            await this.response
                                                .arrayBuffer();

                                    }

                                }


                                // --------------------------------
                                // responseType arraybuffer
                                // --------------------------------

                                else if (
                                    this.responseType ===
                                    "arraybuffer"
                                ) {

                                    buffer =
                                        this.response;

                                }


                                // --------------------------------
                                // responseType kosong
                                // --------------------------------

                                else if (
                                    this.response
                                ) {

                                    const blob =
                                        new Blob(
                                            [
                                                this.response
                                            ]
                                        );


                                    buffer =
                                        await blob.arrayBuffer();

                                }


                                if (!buffer) {
                                    return;
                                }


                                if (
                                    looksLikePdfContentType(
                                        contentType
                                    )
                                    ||
                                    buffer.byteLength > 1000
                                ) {

                                    await emitPdf(

                                        buffer,

                                        url,

                                        contentType

                                    );

                                }

                            } catch (error) {

                                console.debug(
                                    "CEISA XHR PDF capture error:",
                                    error
                                );

                            }

                        }

                    );

                }

            } catch (error) {

                console.debug(
                    "CEISA XHR hook error:",
                    error
                );

            }


            return originalXHRSend.call(
                this,
                body
            );

        };


})();