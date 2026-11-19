'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  generateSearchablePdf,
  createSearchablePdfFromImages,
  createSearchablePdfFromExisting,
  extractTextFromPdf,
  sanitizeTextForPdf
} = require('../backend-service/searchable_pdf');

async function runTests() {
  console.log('=== Running Searchable PDF Generator Tests ===\n');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
    }
  }

  // 1. Sanitize text test
  await test('sanitizeTextForPdf handles unicode, smart quotes, checkmarks', () => {
    const raw = 'Invoice #999: ✓ OK! "Smart Quotes" & Em—dash & Bullet • & €100';
    const cleaned = sanitizeTextForPdf(raw);
    assert(cleaned.includes('[v] OK!'), 'Checkmark replaced with [v]');
    assert(cleaned.includes('"Smart Quotes"'), 'Smart quotes normalized');
    assert(cleaned.includes('-'), 'Em-dash normalized');
    assert(cleaned.includes('*'), 'Bullet normalized');
    assert(cleaned.includes('€100'), 'Euro sign preserved in WinAnsi');
  });

  // 2. Generate searchable PDF from image (using favicon.png)
  await test('generateSearchablePdf from image with Gemini box_2d coordinates', async () => {
    const imagePath = path.resolve(__dirname, '../favicon.png');
    assert(fs.existsSync(imagePath), 'favicon.png must exist for test');

    const samplePages = [
      {
        pageNumber: 1,
        image: imagePath,
        width: 600,
        height: 800,
        lines: [
          {
            text: 'CEISA 4.0 DOKUMEN PABEAN',
            box_2d: [50, 100, 80, 500] // Gemini normalized 0..1000
          },
          {
            text: 'NOMOR PENDAFTARAN: 012345/KPU.01/2026',
            box_2d: [100, 100, 130, 600]
          },
          {
            text: 'IMPORTIR: PT SYNTHETIC INDONESIA JAYA',
            box_2d: [150, 100, 180, 700]
          }
        ]
      }
    ];

    const pdfBuffer = await generateSearchablePdf({
      pages: samplePages,
      isImageOnly: true
    });

    assert(Buffer.isBuffer(pdfBuffer), 'Must return a Buffer');
    assert(pdfBuffer.length > 500, 'PDF buffer must be non-empty');

    // Extract text using pdf-parse
    const extractedText = await extractTextFromPdf(pdfBuffer);
    assert(extractedText.includes('CEISA 4.0 DOKUMEN PABEAN'), 'Extracted text must contain title');
    assert(extractedText.includes('012345/KPU.01/2026'), 'Extracted text must contain registration number');
    assert(extractedText.includes('PT SYNTHETIC INDONESIA JAYA'), 'Extracted text must contain importer name');
  });

  // 3. Generate searchable PDF with explicit { x, y, width, height, fontSize } coordinates
  await test('generateSearchablePdf with explicit coordinates', async () => {
    const samplePages = [
      {
        pageNumber: 1,
        width: 612,
        height: 792,
        lines: [
          {
            text: 'INVOICE NUMBER: INV-2026-9988',
            x: 72,
            y: 100,
            width: 300,
            height: 20,
            fontSize: 14
          },
          {
            text: 'TOTAL AMOUNT: USD 45,000.00',
            x: 72,
            y: 140,
            width: 250,
            height: 18,
            fontSize: 12
          }
        ]
      }
    ];

    const pdfBuffer = await generateSearchablePdf({
      pages: samplePages,
      isImageOnly: true
    });

    const extracted = await extractTextFromPdf(pdfBuffer);
    assert(extracted.includes('INV-2026-9988'), 'Must include invoice number');
    assert(extracted.includes('USD 45,000.00'), 'Must include total amount');
  });

  // 4. Generate searchable PDF with page-level fallback text
  await test('generateSearchablePdf with unstructured page-level text fallback', async () => {
    const samplePages = [
      {
        pageNumber: 1,
        text: 'BILL OF LADING\nB/L NO: ONEYJKT998877\nVESSEL: NYK THEMIS V.088W\nPORT OF LOADING: SINGAPORE\nPORT OF DISCHARGE: TANJUNG PRIOK'
      }
    ];

    const pdfBuffer = await generateSearchablePdf({
      pages: samplePages,
      isImageOnly: true
    });

    const extracted = await extractTextFromPdf(pdfBuffer);
    assert(extracted.includes('ONEYJKT998877'), 'Must extract B/L number from unstructured text');
    assert(extracted.includes('TANJUNG PRIOK'), 'Must extract destination port');
  });

  // 5. Overlay text layer onto existing PDF buffer
  await test('generateSearchablePdf overlays text layer onto existing PDF', async () => {
    const existingPdfPath = path.resolve(__dirname, '../attachments/INV.98007744.pdf');
    if (!fs.existsSync(existingPdfPath)) {
      console.log('Skipping existing PDF overlay test: sample PDF not found');
      return;
    }

    const existingBuffer = fs.readFileSync(existingPdfPath);
    const pagesData = [
      {
        pageNumber: 1,
        lines: [
          {
            text: 'EXTRA_SEARCHABLE_OCR_INDEX_KEYWORD_2026',
            box_2d: [100, 100, 130, 400]
          }
        ]
      }
    ];

    const searchablePdfBuffer = await generateSearchablePdf({
      originalPdfBuffer: existingBuffer,
      pages: pagesData,
      isImageOnly: false
    });

    assert(Buffer.isBuffer(searchablePdfBuffer), 'Must return a Buffer');
    const extracted = await extractTextFromPdf(searchablePdfBuffer);
    assert(extracted.includes('EXTRA_SEARCHABLE_OCR_INDEX_KEYWORD_2026'), 'Overlay text must be present in parsed PDF');
  });

  // 6. Multi-page document test
  await test('generateSearchablePdf handles multi-page documents seamlessly', async () => {
    const samplePages = [
      {
        pageNumber: 1,
        lines: [{ text: 'PAGE ONE SCAN CONTENT', box_2d: [100, 100, 130, 400] }]
      },
      {
        pageNumber: 2,
        lines: [{ text: 'PAGE TWO SCAN CONTENT', box_2d: [100, 100, 130, 400] }]
      }
    ];

    const pdfBuffer = await generateSearchablePdf({
      pages: samplePages,
      isImageOnly: true
    });

    const extracted = await extractTextFromPdf(pdfBuffer);
    assert(extracted.includes('PAGE ONE SCAN CONTENT'), 'Page 1 text must be present');
    assert(extracted.includes('PAGE TWO SCAN CONTENT'), 'Page 2 text must be present');
  });

  // 7. Data URI base64 image input test
  await test('generateSearchablePdf handles data URI base64 images', async () => {
    const base64Data = fs.readFileSync('favicon.png').toString('base64');
    const dataUri = 'data:image/png;base64,' + base64Data;
    const buf = await createSearchablePdfFromImages([
      {
        image: dataUri,
        lines: [{ text: 'BASE64_DATA_URI_SUCCESS', box_2d: [100, 100, 200, 500] }]
      }
    ]);
    const extracted = await extractTextFromPdf(buf);
    assert(extracted.includes('BASE64_DATA_URI_SUCCESS'), 'Must extract text from data URI page');
  });

  // 8. Real JPEG scanned document test
  await test('generateSearchablePdf handles real JPEG scans', async () => {
    const jpgPath = path.resolve(__dirname, '../scratch/inspect_sanjaya_396/image001.jpg');
    if (!fs.existsSync(jpgPath)) {
      console.log('Skipping JPG test: file not found');
      return;
    }
    const buf = await createSearchablePdfFromImages([
      {
        image: jpgPath,
        lines: [{ text: 'AUTHENTIC_JPEG_OCR_SCAN_LAYER', box_2d: [100, 100, 150, 600] }]
      }
    ]);
    const extracted = await extractTextFromPdf(buf);
    assert(extracted.includes('AUTHENTIC_JPEG_OCR_SCAN_LAYER'), 'Must extract text from JPEG scan');
  });

  // 9. Input validation and error handling
  await test('rejects invalid or empty originalPdfBuffer in existing PDF mode', async () => {
    let rejected = false;
    try {
      await generateSearchablePdf({
        originalPdfBuffer: Buffer.alloc(0),
        isImageOnly: false,
        pages: []
      });
    } catch (e) {
      rejected = true;
    }
    assert(rejected, 'Must reject empty originalPdfBuffer');
  });

  // 10. Require formats: both const generateSearchablePdf and { generateSearchablePdf }
  await test('module exports both function directly and named exports', () => {
    const defaultExport = require('../backend-service/searchable_pdf');
    const { generateSearchablePdf: namedExport } = require('../backend-service/searchable_pdf');
    assert.strictEqual(typeof defaultExport, 'function', 'Default export is a function');
    assert.strictEqual(typeof namedExport, 'function', 'Named export is a function');
    assert.strictEqual(defaultExport, namedExport, 'Named and default exports match');
  });

  // 11. 1:1 Precision Alignment: word-level boxes and wordSpacing distribution
  await test('generateSearchablePdf renders sub-words and wordSpacing for 1:1 alignment', async () => {
    const samplePages = [
      {
        pageNumber: 1,
        width: 600,
        height: 800,
        lines: [
          {
            text: 'CEISA 4.0 IMPORTIR',
            box_2d: [100, 100, 140, 500],
            words: [
              { text: 'CEISA', box_2d: [100, 100, 140, 220] },
              { text: '4.0', box_2d: [100, 230, 140, 300] },
              { text: 'IMPORTIR', box_2d: [100, 310, 140, 500] }
            ]
          },
          {
            text: 'TOTAL NILAI PABEAN CIF USD 125,000.00',
            box_2d: [150, 100, 180, 580]
          }
        ]
      }
    ];

    const pdfBuffer = await generateSearchablePdf({
      pages: samplePages,
      isImageOnly: true
    });

    const extracted = await extractTextFromPdf(pdfBuffer);
    assert(extracted.includes('CEISA'), 'Must extract word CEISA');
    assert(extracted.includes('IMPORTIR'), 'Must extract word IMPORTIR');
    assert(extracted.includes('TOTAL NILAI PABEAN'), 'Must extract spaced line text');
  });

  console.log(`\n=== Test Results: ${passed}/${total} passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
