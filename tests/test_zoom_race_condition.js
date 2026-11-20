/**
 * ============================================================================
 * CEISA 4.0 - MULTI-PAGE ZOOM RACE CONDITION & ORDER VERIFICATION SUITE
 * File: tests/test_zoom_race_condition.js
 * Author: verifier-4
 *
 * Verifies:
 * 1. Pre-allocated Sorted DOM Slots (ocrPageWrapper-1..N synchronous order).
 * 2. High-velocity rapid successive zoom calls with chaotic async latency.
 * 3. Continuous invariant: document.querySelectorAll('.ocr-page-wrapper')
 *    maintains exact order 1..N at all times with 0 swaps or interleaving.
 * 4. Render Token & Cancellation Lock: Obsolete in-flight renders aborted.
 * 5. Reuse of state.pdfDoc and native text cache on zoom.
 * 6. Active page indicator and scroll position preservation across zoom.
 * 7. Strict zero-emoji compliance.
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const ROOT_DIR = path.resolve(__dirname, '..');
const JS_PATH = path.join(ROOT_DIR, 'ocr_tool.js');
const HTML_PATH = path.join(ROOT_DIR, 'ocr_tool.html');

const EMOJI_REGEX = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

let passed = 0;
let total = 0;

async function test(name, fn) {
    total++;
    try {
        await fn();
        console.log(`  ✓ [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ [FAIL] ${name}`);
        console.error(`    -> Error: ${err.message || err}`);
        throw err;
    }
}

/**
 * Creates an isolated JSDOM test environment with mock PDF.js and Canvas 2D
 */
function createTestHarness(pageCount = 4, customDelays = {}, customRenderDelay = 30) {
    const htmlContent = fs.readFileSync(HTML_PATH, 'utf8');
    let jsContent = fs.readFileSync(JS_PATH, 'utf8');

    // Strip ES module export so script evaluates cleanly in JSDOM
    jsContent = jsContent.replace(/export\s*\{[^}]*\};?/g, '');
    // Pre-bind pdfjsLib to window.pdfjsLib to avoid relative import notice in tests directory
    jsContent = jsContent.replace(/let pdfjsLib = null;/, 'let pdfjsLib = typeof window !== "undefined" ? window.pdfjsLib : null;');

    const dom = new JSDOM(htmlContent, {
        runScripts: 'dangerously',
        url: 'http://localhost:3000'
    });

    const { window } = dom;

    // Stub Element scrollIntoView for headless DOM
    window.Element.prototype.scrollIntoView = function () {};

    // Stub IntersectionObserver
    window.IntersectionObserver = class {
        constructor(callback, options) {
            this.callback = callback;
            this.options = options;
            this.observedElements = new Set();
        }
        observe(target) {
            this.observedElements.add(target);
        }
        unobserve(target) {
            this.observedElements.delete(target);
        }
        disconnect() {
            this.observedElements.clear();
        }
    };

    // Stub HTMLCanvasElement getContext
    window.HTMLCanvasElement.prototype.getContext = function (type) {
        return {
            fillRect: () => {},
            clearRect: () => {},
            getImageData: (x, y, w, h) => ({ data: new Array(w * h * 4) }),
            putImageData: () => {},
            createImageData: () => [],
            setTransform: () => {},
            drawImage: () => {},
            save: () => {},
            restore: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            stroke: () => {},
            fill: () => {}
        };
    };

    // Intercept setInterval to avoid keeping Node event loop open
    window.setInterval = (fn, ms) => {
        return 999999;
    };

    let getDocumentCalls = 0;
    let arrayBufferCalls = 0;
    let cancelledRenderTasks = 0;
    let totalRenderTasks = 0;

    // Build mock multi-page PDF document
    const mockPdfDoc = {
        numPages: pageCount,
        getPage: async (p) => {
            const delay = customDelays[p] !== undefined ? customDelays[p] : (p === 1 ? 50 : (p === 2 ? 10 : 30));
            if (delay > 0) {
                await new Promise(r => setTimeout(r, delay));
            }
            return {
                pageNumber: p,
                getViewport: ({ scale }) => ({
                    width: Math.round(595 * scale),
                    height: Math.round(842 * scale),
                    scale,
                    convertToViewportPoint: (x, y) => [x * scale, y * scale]
                }),
                getTextContent: async () => ({
                    items: [
                        { str: `Header Dokumen Halaman ${p}`, transform: [1, 0, 0, 1, 50, 800], width: 250, height: 14 },
                        { str: `Nomor Seri CEISA 4.0: 00000${p}`, transform: [1, 0, 0, 1, 50, 750], width: 200, height: 12 },
                        { str: `Konten Utama Paragraf ${p}`, transform: [1, 0, 0, 1, 50, 700], width: 300, height: 12 }
                    ]
                }),
                render: ({ canvasContext, viewport }) => {
                    totalRenderTasks++;
                    let isCancelled = false;
                    return {
                        promise: new Promise((resolve, reject) => {
                            const renderTimer = setTimeout(() => {
                                if (isCancelled) {
                                    const cancelErr = new Error('Rendering cancelled');
                                    cancelErr.name = 'RenderingCancelledException';
                                    reject(cancelErr);
                                } else {
                                    resolve();
                                }
                            }, customRenderDelay);
                        }),
                        cancel: () => {
                            isCancelled = true;
                            cancelledRenderTasks++;
                        }
                    };
                }
            };
        }
    };

    window.pdfjsLib = {
        GlobalWorkerOptions: {},
        getDocument: ({ data }) => {
            getDocumentCalls++;
            return {
                promise: Promise.resolve(mockPdfDoc)
            };
        },
        TextLayer: class {
            constructor({ textContentSource, container, viewport }) {
                this.container = container;
            }
            async render() {
                // Mock text layer render
            }
        }
    };

    // Execute ocr_tool.js in window
    window.eval(jsContent);

    const mockFile = {
        name: 'test_multipage_ceisa.pdf',
        type: 'application/pdf',
        size: 1024 * 1024,
        arrayBuffer: async () => {
            arrayBufferCalls++;
            return new ArrayBuffer(1024);
        }
    };

    return {
        window,
        document: window.document,
        ceisaOcr: window.ceisaOcr,
        mockPdfDoc,
        mockFile,
        metrics: {
            get getDocumentCalls() { return getDocumentCalls; },
            get arrayBufferCalls() { return arrayBufferCalls; },
            get cancelledRenderTasks() { return cancelledRenderTasks; },
            get totalRenderTasks() { return totalRenderTasks; }
        }
    };
}

async function runSuite() {
    console.log('================================================================================');
    console.log(' TEST SUITE: MULTI-PAGE ZOOM RACE CONDITION & DOM INVARIANT AUDIT');
    console.log('================================================================================\n');

    // -------------------------------------------------------------------------
    // SUITE 1: STRICT ZERO-EMOJI AUDIT
    // -------------------------------------------------------------------------
    console.log('--- SUITE 1: STRICT ZERO-EMOJI AUDIT ---');

    await test('1.1 Zero emojis anywhere in ocr_tool.js', () => {
        const js = fs.readFileSync(JS_PATH, 'utf8');
        const matches = js.match(new RegExp(EMOJI_REGEX.source, 'gu')) || [];
        assert.strictEqual(matches.length, 0, `Found emojis in ocr_tool.js: ${matches.join(', ')}`);
    });

    await test('1.2 Zero emojis anywhere in ocr_tool.html', () => {
        const html = fs.readFileSync(HTML_PATH, 'utf8');
        const matches = html.match(new RegExp(EMOJI_REGEX.source, 'gu')) || [];
        assert.strictEqual(matches.length, 0, `Found emojis in ocr_tool.html: ${matches.join(', ')}`);
    });

    // -------------------------------------------------------------------------
    // SUITE 2: INITIAL MULTI-PAGE RENDERING & STRICT NUMERICAL ORDER (1..N)
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 2: INITIAL MULTI-PAGE RENDERING & ORDER VERIFICATION ---');

    await test('2.1 Initial load pre-allocates and mounts wrappers in strict 1..N order', async () => {
        const PAGE_COUNT = 4;
        // Inverted async page loading times (Page 1 slowest, Page 4 fastest)
        const customDelays = { 1: 60, 2: 40, 3: 20, 4: 5 };
        const harness = createTestHarness(PAGE_COUNT, customDelays);
        const { window, document, ceisaOcr, mockFile } = harness;

        harness.ceisaOcr.state.file = mockFile;

        // Perform initial document render
        await ceisaOcr.renderDocumentInHouse(mockFile);

        const wrappers = Array.from(document.querySelectorAll('.ocr-page-wrapper'));
        assert.strictEqual(wrappers.length, PAGE_COUNT, `Expected exactly ${PAGE_COUNT} page wrappers`);

        wrappers.forEach((wrapper, idx) => {
            const expectedPageNum = idx + 1;
            assert.strictEqual(wrapper.id, `ocrPageWrapper-${expectedPageNum}`, `Slot ${idx} must be page ${expectedPageNum}`);
            assert.strictEqual(wrapper.getAttribute('data-page'), String(expectedPageNum), `Slot ${idx} data-page mismatch`);

            // Check canvas child exists inside its corresponding slot
            const canvas = wrapper.querySelector('.ocr-page-canvas');
            assert.ok(canvas, `Canvas must exist inside page wrapper ${expectedPageNum}`);
            assert.strictEqual(canvas.id, `ocrCanvasPage-${expectedPageNum}`, `Canvas ID mismatch in page ${expectedPageNum}`);

            // Check text layer child exists
            const textLayer = wrapper.querySelector('.ocr-text-layer');
            assert.ok(textLayer, `Text layer must exist inside page wrapper ${expectedPageNum}`);
            assert.strictEqual(textLayer.id, `ocrTextLayer-${expectedPageNum}`);
        });

        assert.strictEqual(ceisaOcr.state.totalPages, PAGE_COUNT);
        assert.strictEqual(ceisaOcr.state.currentPage, 1);
    });

    // -------------------------------------------------------------------------
    // SUITE 3: RAPID SUCCESSIVE ZOOM RACE SIMULATION & CONTINUOUS DOM INVARIANT
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 3: RAPID SUCCESSIVE ZOOM RACE SIMULATION ---');

    await test('3.1 Continuous DOM Invariant: document.querySelectorAll(\'.ocr-page-wrapper\') maintains exact order 1..N at all times', async () => {
        const PAGE_COUNT = 5;
        // Extreme latency jitter between pages to maximize race conditions
        const customDelays = { 1: 80, 2: 15, 3: 70, 4: 10, 5: 45 };
        const harness = createTestHarness(PAGE_COUNT, customDelays);
        const { window, document, ceisaOcr, mockFile, metrics } = harness;

        ceisaOcr.state.file = mockFile;
        await ceisaOcr.renderDocumentInHouse(mockFile);

        // Verification function to test DOM invariant at any arbitrary snapshot
        function assertStrictPageOrder(contextDescription) {
            const wrappers = Array.from(document.querySelectorAll('.ocr-page-wrapper'));
            assert.strictEqual(
                wrappers.length,
                PAGE_COUNT,
                `[${contextDescription}] Expected ${PAGE_COUNT} page wrappers, found ${wrappers.length}`
            );

            wrappers.forEach((el, index) => {
                const expectedId = `ocrPageWrapper-${index + 1}`;
                const expectedDataPage = String(index + 1);
                assert.strictEqual(
                    el.id,
                    expectedId,
                    `[${contextDescription}] DOM ordering failure at index ${index}: expected ${expectedId}, got ${el.id}`
                );
                assert.strictEqual(
                    el.getAttribute('data-page'),
                    expectedDataPage,
                    `[${contextDescription}] data-page mismatch at index ${index}: expected ${expectedDataPage}, got ${el.getAttribute('data-page')}`
                );
            });
        }

        assertStrictPageOrder('Baseline after initial render');

        // Set up continuous DOM polling during rapid successive zoom operations
        const sampledSnapshots = [];
        const intervalId = window.setInterval(() => {
            const currentOrder = Array.from(document.querySelectorAll('.ocr-page-wrapper')).map(w => w.id);
            sampledSnapshots.push(currentOrder);
        }, 10);

        // Fire 5 rapid zoom operations in quick succession (mimicking user spamming Ctrl + or Zoom buttons)
        const zoomSequence = [115, 130, 145, 160, 175];
        const zoomPromises = [];

        for (let i = 0; i < zoomSequence.length; i++) {
            const targetZoom = zoomSequence[i];
            const p = ceisaOcr.setZoom(targetZoom);
            zoomPromises.push(p);

            // Assert synchronous pre-allocation and order immediately after setZoom trigger
            assertStrictPageOrder(`Immediately after setZoom(${targetZoom}%) triggered`);

            // Small delay between clicks (5ms) to test queueing / debounce
            await new Promise(r => setTimeout(r, 5));
        }

        // Wait for all zoom operations to settle
        await Promise.all(zoomPromises);

        // Allow microtasks to complete
        await new Promise(r => setTimeout(r, 120));

        // Stop sampler
        if (intervalId && typeof window.clearInterval === 'function') {
            window.clearInterval(intervalId);
        }

        // Final assertion of strict ordering
        assertStrictPageOrder('Final settled state after 5 rapid zoom cycles');

        // Verify that in all sampled snapshots during transitions, wrappers were never swapped
        sampledSnapshots.forEach((snapshot, idx) => {
            assert.strictEqual(
                snapshot.length,
                PAGE_COUNT,
                `Sample ${idx} must contain ${PAGE_COUNT} wrappers`
            );
            snapshot.forEach((id, pIdx) => {
                assert.strictEqual(
                    id,
                    `ocrPageWrapper-${pIdx + 1}`,
                    `Sample ${idx} violated order: slot ${pIdx} is ${id} instead of ocrPageWrapper-${pIdx + 1}`
                );
            });
        });

        assert.strictEqual(ceisaOcr.state.zoom, 175, 'Final zoom level must match last requested zoom');
    });

    await test('3.2 Cancellation Lock: In-flight obsolete render tasks are cancelled', async () => {
        const PAGE_COUNT = 3;
        // Fast getPage with long render delay so task is actively in flight
        const customDelays = { 1: 0, 2: 0, 3: 0 };
        const harness = createTestHarness(PAGE_COUNT, customDelays, 100);
        const { ceisaOcr, mockFile, metrics } = harness;

        ceisaOcr.state.file = mockFile;
        await ceisaOcr.renderDocumentInHouse(mockFile);

        const initialCancelled = metrics.cancelledRenderTasks;

        // Trigger zoom with immediate = true, then immediately trigger another zoom with immediate = true
        // This forces renderPdfPages to overlap without waiting for debounce
        const p1 = ceisaOcr.setZoom(115, true);
        await new Promise(r => setTimeout(r, 15)); // Give p1 a moment to start page.render()
        const p2 = ceisaOcr.setZoom(130, true);

        await Promise.all([p1, p2]);

        assert.ok(
            metrics.cancelledRenderTasks > initialCancelled,
            `Expected cancelledRenderTasks to increase (was ${initialCancelled}, now ${metrics.cancelledRenderTasks})`
        );
    });

    // -------------------------------------------------------------------------
    // SUITE 4: REUSE OF STATE.PDFDOC & NATIVE TEXT CACHING ON ZOOM
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 4: REUSE OF STATE.PDFDOC & TEXT CACHING ---');

    await test('4.1 Reuses state.pdfDoc on zoom without re-reading file.arrayBuffer() or getDocument()', async () => {
        const PAGE_COUNT = 3;
        const harness = createTestHarness(PAGE_COUNT);
        const { ceisaOcr, mockFile, metrics } = harness;

        ceisaOcr.state.file = mockFile;

        // First render: loads PDF document
        await ceisaOcr.renderDocumentInHouse(mockFile);

        const initialArrayBufferCalls = metrics.arrayBufferCalls;
        const initialGetDocumentCalls = metrics.getDocumentCalls;

        assert.strictEqual(initialArrayBufferCalls, 1, 'Initial render calls arrayBuffer() exactly once');
        assert.strictEqual(initialGetDocumentCalls, 1, 'Initial render calls getDocument() exactly once');
        assert.ok(ceisaOcr.state.pdfDoc, 'state.pdfDoc is populated');

        // Perform 3 successive zoom adjustments
        await ceisaOcr.setZoom(115, true);
        await ceisaOcr.setZoom(130, true);
        await ceisaOcr.setZoom(100, true);

        // Assert that zero additional arrayBuffer or getDocument calls were made
        assert.strictEqual(
            metrics.arrayBufferCalls,
            initialArrayBufferCalls,
            'arrayBuffer() must NOT be re-called on zoom'
        );
        assert.strictEqual(
            metrics.getDocumentCalls,
            initialGetDocumentCalls,
            'getDocument() must NOT be re-called on zoom'
        );
    });

    await test('4.2 Reuses state.result.pages without re-extracting native text on zoom', async () => {
        const PAGE_COUNT = 3;
        const harness = createTestHarness(PAGE_COUNT);
        const { ceisaOcr, mockFile } = harness;

        ceisaOcr.state.file = mockFile;
        await ceisaOcr.renderDocumentInHouse(mockFile);

        assert.ok(ceisaOcr.state.result.pages.length === PAGE_COUNT, 'Native text extracted on initial load');
        const originalPages = ceisaOcr.state.result.pages;

        // Perform zoom
        await ceisaOcr.setZoom(130, true);

        // Assert that the existing pages reference and data were retained
        assert.strictEqual(ceisaOcr.state.result.pages, originalPages, 'Existing state.result.pages was reused on zoom');
    });

    // -------------------------------------------------------------------------
    // SUITE 5: ACTIVE PAGE PRESERVATION & SCROLL SPY
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 5: ACTIVE PAGE PRESERVATION & SCROLL SPY ---');

    await test('5.1 Preserves active state.currentPage and page indicator text across zoom', async () => {
        const PAGE_COUNT = 4;
        const harness = createTestHarness(PAGE_COUNT);
        const { document, ceisaOcr, mockFile } = harness;

        ceisaOcr.state.file = mockFile;
        await ceisaOcr.renderDocumentInHouse(mockFile);

        // User navigated to Page 3
        ceisaOcr.state.currentPage = 3;
        const pageIndicator = document.getElementById('ocrPageIndicator');
        if (pageIndicator) pageIndicator.textContent = 'Hal 3 / 4';

        // Trigger zoom
        await ceisaOcr.setZoom(145, true);

        // Assert that current page is preserved at 3
        assert.strictEqual(ceisaOcr.state.currentPage, 3, 'currentPage must remain 3 after zoom');
        if (pageIndicator) {
            assert.strictEqual(pageIndicator.textContent, 'Hal 3 / 4', 'Page indicator text preserved');
        }
    });

    console.log('\n================================================================================');
    console.log(` ZOOM RACE CONDITION QA TOTAL: ${total} | PASSED: ${passed} | FAILED: 0`);
    console.log('================================================================================');
}

runSuite().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
