const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ExcelJS = require(path.join(__dirname, '..', 'backend-service', 'node_modules', 'exceljs'));
const { JSDOM } = require('jsdom');

const ROOT_DIR = path.join(__dirname, '..');
const { transformCeisaExcelBuffer } = require(path.join(ROOT_DIR, 'backend-service', 'ceisa_excel_service.js'));

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}`);
        console.error('        ', err && err.stack ? err.stack : err);
        failed++;
    }
}

async function buildSampleCeisaWorkbook({ entitasRows = [], barangRows = [], includeTarif = true } = {}) {
    const wb = new ExcelJS.Workbook();

    const hdr = wb.addWorksheet('HEADER');
    hdr.addRow(['NOMOR AJU', 'KODE DOKUMEN']);
    hdr.addRow(['00051100123420261128000001', '20']);

    const ent = wb.addWorksheet('ENTITAS');
    ent.addRow(['NOMOR AJU', 'SERI', 'KODE ENTITAS', 'KODE JENIS IDENTITAS', 'NOMOR IDENTITAS', 'NAMA ENTITAS', 'ALAMAT ENTITAS', 'NOMOR IJIN ENTITAS', 'TANGGAL IJIN ENTITAS', 'KODE NEGARA']);
    for (const r of entitasRows) {
        ent.addRow(r);
    }

    const brg = wb.addWorksheet('BARANG');
    brg.addRow([
        'NOMOR AJU', 'SERI BARANG', 'HS', 'KODE BARANG', 'URAIAN', 'MEREK', 'TIPE', 'UKURAN',
        'SPESIFIKASI LAIN', 'KODE NEGARA', 'KODE KONDISI BARANG', 'KODE KATEGORI BARANG',
        'PERNYATAAN LARTAS', 'JUMLAH SATUAN', 'KODE SATUAN', 'JUMLAH KEMASAN', 'KODE KEMASAN',
        'NETTO', 'BRUTO', 'VOLUME', 'FOB', 'CIF', 'HARGA SATUAN', 'FREIGHT', 'ASURANSI'
    ]);
    for (const r of barangRows) {
        brg.addRow(r);
    }

    if (includeTarif) {
        const bt = wb.addWorksheet('BARANGTARIF');
        bt.addRow(['NOMOR AJU', 'SERI BARANG', 'KODE JENIS PUNGUTAN', 'TARIF', 'KODE FASILITAS TARIF']);
        bt.addRow(['00051100123420261128000001', 1, 'BM', 5, '1']);
        bt.addRow(['00051100123420261128000001', 1, 'PPN', 11, '1']);
        bt.addRow(['00051100123420261128000001', 1, 'PPH', 2.5, '1']);
        bt.addRow(['00051100123420261128000001', 2, 'BM', 10, '1']);
        bt.addRow(['00051100123420261128000001', 4, 'BM', 15, '1']);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}

(async () => {
    console.log('\n============================================================');
    console.log('CEISA 4.0 EXCEL EXPORT TRANSFORMATION TEST SUITE');
    console.log('============================================================\n');

    await runTest('1. Rejects blank or non-CEISA Excel files cleanly', async () => {
        const emptyWb = new ExcelJS.Workbook();
        emptyWb.addWorksheet('Sheet1');
        const emptyBuf = Buffer.from(await emptyWb.xlsx.writeBuffer());

        await assert.rejects(
            () => transformCeisaExcelBuffer(emptyBuf, { items: [] }, 'pib'),
            /bukan template CEISA/i
        );

        const headerOnlyWb = new ExcelJS.Workbook();
        headerOnlyWb.addWorksheet('ENTITAS').addRow(['A', 'B', 'C', 'D']);
        headerOnlyWb.addWorksheet('BARANG').addRow(['A', 'B', 'C', 'D']);
        const headerOnlyBuf = Buffer.from(await headerOnlyWb.xlsx.writeBuffer());

        await assert.rejects(
            () => transformCeisaExcelBuffer(headerOnlyBuf, { items: [] }, 'peb'),
            /kosong/i
        );
    });

    await runTest('2. Converts ENTITAS TANGGAL IJIN ENTITAS only for KODE NEGARA = ID and preserves HH:mm:ss as text', async () => {
        const buf = await buildSampleCeisaWorkbook({
            entitasRows: [
                ['00051100123420261128000001', 1, '1', '6', '0123456789012345', 'PT SINAR ASIA PACK', 'BATAM', 'NIB-01', '03-21-2023 00:00:00', 'ID'],
                ['00051100123420261128000001', 2, '9', '4', '-', 'PELNOX LTD', 'TOKYO', 'IJIN-JP', '03-21-2023 00:00:00', 'JP'],
                ['00051100123420261128000001', 3, '7', '6', '0123456789012345', 'PT PEMILIK ID', 'BATAM', 'NIB-02', new Date('2024-11-05T00:00:00.000Z'), 'ID']
            ],
            barangRows: [
                ['00051100123420261128000001', 1, '39073090', 'OLD-01', 'OLD ITEM', '-', '-', '-', '-', 'JP', '1', '4', 'T', 1, 'KGM', 1, 'PK', 1, 2, 0, 100, 100, 100, 0, 0]
            ]
        });

        const { buffer, summary } = await transformCeisaExcelBuffer(buf, { items: [] }, 'pib');
        assert.strictEqual(summary.entitasUpdated, 2, 'Should update only the 2 ID rows');

        const outWb = new ExcelJS.Workbook();
        await outWb.xlsx.load(buffer);
        const outEnt = outWb.getWorksheet('ENTITAS');

        const row1Tgl = outEnt.getRow(2).getCell(9);
        const row2Tgl = outEnt.getRow(3).getCell(9);
        const row3Tgl = outEnt.getRow(4).getCell(9);

        assert.strictEqual(row1Tgl.value, '2023-03-21 00:00:00');
        assert.strictEqual(row1Tgl.numFmt, '@');
        assert.strictEqual(row2Tgl.value, '03-21-2023 00:00:00', 'Non-ID entity date must NOT be modified');
        assert.strictEqual(row3Tgl.value, '2024-11-05 00:00:00');
        assert.strictEqual(row3Tgl.numFmt, '@');
    });

    await runTest('3. Deletes extra BARANG Seri rows (leaving row 2 template) and populates 3 Seri items + BARANGTARIF from draft', async () => {
        const sampleRow = (seri) => [
            '00051100123420261128000001', seri, '11111111', 'TPL', `OLD SERI ${seri}`, '-', '-', '-', '-',
            'SG', '1', '4', 'T', 1, 'PCE', 1, 'BX', 1, 1, 0, 10, 10, 10, 0, 0
        ];
        const buf = await buildSampleCeisaWorkbook({
            entitasRows: [
                ['00051100123420261128000001', 1, '1', '6', '012345', 'PT IMPORTIR', 'BATAM', 'NIB-01', '07-19-2022 00:00:00', 'ID']
            ],
            barangRows: [sampleRow(1), sampleRow(2), sampleRow(3), sampleRow(4), sampleRow(5)]
        });

        const draft = {
            nomorAju: '000511-001234-20261128-000001',
            items: [
                {
                    hsCode: '3907.30.90',
                    kodeBarang: 'G01285801',
                    uraianJenisBarang: 'EPOXY RESIN WHITE',
                    merek: 'PELUCURE',
                    tipe: 'ME105',
                    spesifikasi: '4KG/UNCAN',
                    negaraAsal: 'JP - JAPAN',
                    kondisi: 'Barang Baru',
                    kategori: '4 - BAHAN BAKU',
                    lartas: 'tidak',
                    jumlahDanSatuanBarang: '32 KGM',
                    kemasanQty: 3,
                    kemasanJenis: 'PK - PACKAGE',
                    beratBersih: 16,
                    beratKotor: 18.5,
                    volume: 0.25,
                    amount: 80800,
                    cifUsd: 80800,
                    tarifBm: 0,
                    tarifPpn: 11,
                    tarifPph: 2.5
                },
                {
                    hsCode: '39073090',
                    kodeBarang: 'ME-255',
                    uraianJenisBarang: 'RESIN ME-255 TYPE T 5KG',
                    negaraAsal: 'JP - JAPAN',
                    lartas: 'terkena',
                    jumlahDanSatuanBarang: '10 KGM',
                    kemasanQty: 3,
                    kemasanJenis: 'PK - PACKAGE',
                    beratBersih: 10,
                    beratKotor: 23,
                    amount: 65000,
                    tarifBm: 7.5
                },
                {
                    hsCode: '39073090',
                    kodeBarang: 'HV-125',
                    uraianJenisBarang: 'RESIN HV-125 TYPE T 5KG',
                    negaraAsal: 'CN - CHINA',
                    jumlahDanSatuanBarang: '10 KGM',
                    kemasanQty: 3,
                    kemasanJenis: 'PK - PACKAGE',
                    beratBersih: 10,
                    beratKotor: 23,
                    amount: 65000
                }
            ]
        };

        const { buffer, summary } = await transformCeisaExcelBuffer(buf, draft, 'pib');
        assert.strictEqual(summary.barangCount, 3);

        const outWb = new ExcelJS.Workbook();
        await outWb.xlsx.load(buffer);
        const outBrg = outWb.getWorksheet('BARANG');
        assert.strictEqual(outBrg.rowCount, 4, 'Must have 1 header row + 3 item rows (old rows 4-5 removed)');

        // Row 2 = Seri 1
        assert.strictEqual(outBrg.getRow(2).getCell(1).value, '00051100123420261128000001');
        assert.strictEqual(outBrg.getRow(2).getCell(2).value, 1);
        assert.strictEqual(outBrg.getRow(2).getCell(3).value, '39073090');
        assert.strictEqual(outBrg.getRow(2).getCell(4).value, 'G01285801');
        assert.strictEqual(outBrg.getRow(2).getCell(5).value, 'EPOXY RESIN WHITE');
        assert.strictEqual(outBrg.getRow(2).getCell(10).value, 'JP');
        assert.strictEqual(outBrg.getRow(2).getCell(13).value, 'T');
        assert.strictEqual(outBrg.getRow(2).getCell(14).value, 32);
        assert.strictEqual(outBrg.getRow(2).getCell(15).value, 'KGM');
        assert.strictEqual(outBrg.getRow(2).getCell(16).value, 3);
        assert.strictEqual(outBrg.getRow(2).getCell(17).value, 'PK');
        assert.strictEqual(outBrg.getRow(2).getCell(18).value, 16);
        assert.strictEqual(outBrg.getRow(2).getCell(19).value, 18.5);
        assert.strictEqual(outBrg.getRow(2).getCell(21).value, 80800);

        // Row 3 = Seri 2 & Row 4 = Seri 3
        assert.strictEqual(outBrg.getRow(3).getCell(2).value, 2);
        assert.strictEqual(outBrg.getRow(3).getCell(5).value, 'RESIN ME-255 TYPE T 5KG');
        assert.strictEqual(outBrg.getRow(3).getCell(13).value, 'Y');
        assert.strictEqual(outBrg.getRow(4).getCell(2).value, 3);
        assert.strictEqual(outBrg.getRow(4).getCell(10).value, 'CN');

        // BARANGTARIF: 3 Seri * 3 tarif rows = 9 data rows + 1 header = 10 rows
        const outBt = outWb.getWorksheet('BARANGTARIF');
        assert.strictEqual(outBt.rowCount, 10);
        assert.strictEqual(outBt.getRow(2).getCell(2).value, 1);
        assert.strictEqual(outBt.getRow(2).getCell(4).value, 0);
        assert.strictEqual(outBt.getRow(5).getCell(2).value, 2);
        assert.strictEqual(outBt.getRow(5).getCell(4).value, 7.5);
        assert.strictEqual(outBt.getRow(8).getCell(2).value, 3);
    });

    await runTest('4. Reducing 4-Seri CEISA template down to 1-item draft keeps only row 2 with SERI BARANG = 1', async () => {
        const sampleRow = (seri) => [
            '03000000153420260907007732', seri, '85044090', '-', `OLD ${seri}`, '-', '-', '-', '-',
            'ID', '1', '4', 'T', 10, 'PCE', 2, 'BX', 5, 6, 0, 100, 100, 10, 0, 0
        ];
        const buf = await buildSampleCeisaWorkbook({
            entitasRows: [['03000000153420260907007732', 1, '2', '6', '0123', 'PT EKS', 'BATAM', 'NIB', '03-21-2023 00:00:00', 'ID']],
            barangRows: [sampleRow(1), sampleRow(2), sampleRow(3), sampleRow(4)],
            includeTarif: false
        });

        const { buffer, summary } = await transformCeisaExcelBuffer(buf, {
            items: [{ hsCode: '7326.90.99', uraianJenisBarang: 'SINGLE EXPORT ITEM', jumlahDanSatuanBarang: '50 PCE', kemasan: '5 BX', beratBersih: 12, beratKotor: 14, amount: 500 }]
        }, 'peb');

        assert.strictEqual(summary.barangCount, 1);
        const outWb = new ExcelJS.Workbook();
        await outWb.xlsx.load(buffer);
        const outBrg = outWb.getWorksheet('BARANG');
        assert.strictEqual(outBrg.rowCount, 2, 'Only header row 1 and Seri 1 row 2 must remain');
        assert.strictEqual(outBrg.getRow(2).getCell(2).value, 1);
        assert.strictEqual(outBrg.getRow(2).getCell(3).value, '73269099');
        assert.strictEqual(outBrg.getRow(2).getCell(5).value, 'SINGLE EXPORT ITEM');
    });

    await runTest('5. PIB & PEB HTML modal + ceisa_excel_client.js wire trigger buttons and POST /api/export-ceisa-excel', async () => {
        const clientJs = fs.readFileSync(path.join(ROOT_DIR, 'ceisa_excel_client.js'), 'utf8');
        for (const htmlName of ['pib.html', 'peb.html']) {
            const html = fs.readFileSync(path.join(ROOT_DIR, htmlName), 'utf8');
            const dom = new JSDOM(html, { url: `http://localhost:5005/${htmlName}`, runScripts: 'outside-only' });
            const doc = dom.window.document;
            assert(doc.getElementById('btnExportCeisaExcelHeader'), `${htmlName} must have header button`);
            assert(doc.getElementById('btnExportCeisaExcelDock'), `${htmlName} must have dock button`);
            assert(doc.getElementById('ceisaExcelModal'), `${htmlName} must have #ceisaExcelModal`);

            dom.window.collectPibFormData = htmlName === 'pib.html' ? (() => ({ nomorAju: 'AJU-PIB-1', items: [{ hsCode: '84834000' }] })) : undefined;
            dom.window.collectFormData = htmlName === 'peb.html' ? (() => ({ nomorAju: 'AJU-PEB-1', items: [{ hsCode: '73269099' }, { hsCode: '85044090' }] })) : undefined;

            dom.window.eval(clientJs);
            doc.getElementById('btnExportCeisaExcelHeader').click();
            assert.strictEqual(doc.getElementById('ceisaExcelModal').style.display, 'flex');
            const badge = doc.getElementById('ceisaExcelModeBadge').textContent;
            const summaryTxt = doc.getElementById('ceisaExcelDraftSummary').textContent;
            if (htmlName === 'pib.html') {
                assert(badge.includes('PIB'));
                assert(summaryTxt.includes('1 baris barang'));
            } else {
                assert(badge.includes('PEB'));
                assert(summaryTxt.includes('2 baris barang'));
            }
            dom.window.close();
        }
    });

    console.log(`\n============================================================`);
    console.log(`  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log(`============================================================\n`);
    process.exitCode = failed > 0 ? 1 : 0;
})();
