const ExcelJS = require('exceljs');

function normalizeHeaderName(raw) {
    return String(raw || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function findSheetCaseInsensitive(workbook, targetNames) {
    const targets = targetNames.map(n => normalizeHeaderName(n));
    return workbook.worksheets.find(ws => targets.includes(normalizeHeaderName(ws.name))) || null;
}

function buildHeaderMap(worksheet) {
    const headerRow = worksheet.getRow(1);
    const map = {};
    const cols = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const raw = cell.text !== undefined ? String(cell.text).trim() : String(cell.value || '').trim();
        if (!raw) return;
        const norm = normalizeHeaderName(raw);
        if (!norm) return;
        map[norm] = colNumber;
        cols.push({ colNumber, raw, norm });
    });
    return { map, cols };
}

function findCol(headerInfo, candidates) {
    for (const c of candidates) {
        const norm = normalizeHeaderName(c);
        if (headerInfo.map[norm]) return headerInfo.map[norm];
    }
    return null;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function getRawCellText(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (cell.value instanceof Date) return cell.value;
    if (typeof cell.value === 'object') {
        if (cell.value.text !== undefined) return String(cell.value.text).trim();
        if (Array.isArray(cell.value.richText)) {
            return cell.value.richText.map(r => r.text || '').join('').trim();
        }
        if (cell.value.result !== undefined) return cell.value.result;
    }
    return String(cell.value).trim();
}

/**
 * Mengubah format tanggal ijin entitas CEISA dari "MM-DD-YYYY 00:00:00"
 * menjadi string text "YYYY-MM-DD HH:mm:ss" dengan mempertahankan bagian waktu ("00:00:00").
 */
function formatCeisaEntityDatePreserveTime(rawVal) {
    if (rawVal === null || rawVal === undefined || rawVal === '') return null;

    if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
        const yyyy = rawVal.getUTCFullYear();
        const mm = pad2(rawVal.getUTCMonth() + 1);
        const dd = pad2(rawVal.getUTCDate());
        const hh = pad2(rawVal.getUTCHours());
        const mi = pad2(rawVal.getUTCMinutes());
        const ss = pad2(rawVal.getUTCSeconds());
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    }

    const str = String(rawVal).replace(/^'+/, '').trim();
    if (!str || str === '-') return null;

    // 1. Sudah YYYY-MM-DD HH:mm:ss atau YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{2}:\d{2}:\d{2}))?/);
    if (isoMatch) {
        const [, yyyy, m, d, t] = isoMatch;
        return `${yyyy}-${pad2(m)}-${pad2(d)} ${t || '00:00:00'}`;
    }

    // 2. Format ekspor CEISA: MM-DD-YYYY HH:mm:ss (misal "03-21-2023 00:00:00")
    //    atau DD-MM-YYYY bila bagian pertama > 12 (misal "21-03-2023 00:00:00")
    const usOrEuMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?/);
    if (usOrEuMatch) {
        const p1 = parseInt(usOrEuMatch[1], 10);
        const p2 = parseInt(usOrEuMatch[2], 10);
        const yyyy = usOrEuMatch[3];
        const timePart = usOrEuMatch[4] || '00:00:00';
        let mm = p1;
        let dd = p2;
        if (p1 > 12 && p2 <= 12) {
            dd = p1;
            mm = p2;
        }
        return `${yyyy}-${pad2(mm)}-${pad2(dd)} ${timePart}`;
    }

    return null;
}

function cleanNum(val) {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    let s = String(val).replace(/[^0-9.,-]/g, '').trim();
    if (!s) return null;
    // Handle European/ID thousands separator "1.234,56" vs US "1,234.56"
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
    } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
        s = s.replace(/,/g, '');
    } else if (s.includes(',') && !s.includes('.')) {
        s = s.replace(',', '.');
    } else {
        s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

function extractQtyAndUom(item) {
    let qty = cleanNum(item.quantity ?? item.jumlahSatuan ?? item.qty);
    let uom = String(item.satuanBarang || item.kodeSatuan || item.packageUnit || item.uom || item.satuan || '').trim();
    if ((qty === null || !uom) && item.jumlahDanSatuanBarang) {
        const m = String(item.jumlahDanSatuanBarang).trim().match(/^([\d\s.,]+)\s*([A-Za-z0-9/-]+)?$/);
        if (m) {
            if (qty === null) qty = cleanNum(m[1]);
            if (!uom && m[2]) uom = m[2];
        }
    }
    if (uom) {
        uom = uom.split(/[\s-]+/)[0].toUpperCase();
    }
    return { qty: qty !== null ? qty : 1, uom: uom || 'PCE' };
}

function extractPkgQtyAndCode(item) {
    let qty = cleanNum(item.kemasanQty);
    let code = String(item.kemasanJenis || '').trim();
    if ((qty === null || !code) && item.kemasan) {
        const m = String(item.kemasan).trim().match(/^([\d.,]+)\s*(.+)$/);
        if (m) {
            if (qty === null) qty = cleanNum(m[1]);
            if (!code) code = m[2];
        }
    }
    let shortCode = code ? code.split(/[\s-]+/)[0].toUpperCase() : 'PK';
    if (/pallet/i.test(shortCode) || shortCode === 'PLT') shortCode = 'PX';
    else if (/box/i.test(shortCode)) shortCode = 'BX';
    else if (/carton/i.test(shortCode) || shortCode === 'CTN') shortCode = 'CT';
    else if (/package|pkg/i.test(shortCode)) shortCode = 'PK';
    return { qty: qty !== null ? qty : 1, code: shortCode, full: code || `${qty || 1} ${shortCode}` };
}

function adaptCodeToTemplate(rawVal, templateSample) {
    const str = String(rawVal || '').trim();
    if (!str) return templateSample ?? '';
    const tpl = String(templateSample ?? '').trim();
    const firstCode = str.split(/[\s-]+/)[0].trim();
    // Jika template menggunakan kode singkat (misal 'ID', 'CN', '1', '4', 'BX', 'PCE')
    if (!tpl || (!tpl.includes(' - ') && tpl.length <= 5)) {
        return firstCode;
    }
    return str;
}

function resolveLartasCellValue(item, templateSample) {
    const wantLartas = String(item.lartas || '').toLowerCase() === 'terkena' || item.isLartas === true;
    const tpl = String(templateSample ?? '').trim().toUpperCase();
    if (tpl === '0' || tpl === '1') return wantLartas ? '1' : '0';
    if (tpl.includes('TERKENA') || tpl.includes('TIDAK')) {
        return wantLartas ? 'Terkena Lartas' : 'Tidak Terkena Lartas';
    }
    return wantLartas ? 'Y' : 'T';
}

function cloneRowStyle(srcRow, dstRow, colCount) {
    if (srcRow.height) dstRow.height = srcRow.height;
    for (let c = 1; c <= colCount; c++) {
        const srcCell = srcRow.getCell(c);
        const dstCell = dstRow.getCell(c);
        if (srcCell.style) {
            dstCell.style = JSON.parse(JSON.stringify(srcCell.style));
        }
        if (srcCell.numFmt) dstCell.numFmt = srcCell.numFmt;
    }
}

function pruneOrCloneSeriSheet(ws, items, mode) {
    if (!ws || ws.rowCount < 2) return;
    const headerInfo = buildHeaderMap(ws);
    const seriCol = findCol(headerInfo, ['SERIBARANG', 'NOSERI', 'SERI']);
    if (!seriCol) return;

    const totalCols = Math.max(headerInfo.cols.length, ws.columnCount || 0);
    const tarifSheet = normalizeHeaderName(ws.name) === 'BARANGTARIF';

    if (tarifSheet) {
        const jenisCol = findCol(headerInfo, ['KODEJENISPUNGUTAN', 'JENISPUNGUTAN', 'KODEPUNGUTAN', 'PUNGUTAN']);
        const tarifCol = findCol(headerInfo, ['TARIF', 'TARIFF']);
        // Ambil baris template Seri 1
        const templateRows = [];
        for (let r = 2; r <= ws.rowCount; r++) {
            const row = ws.getRow(r);
            const sVal = cleanNum(getRawCellText(row.getCell(seriCol)));
            if (sVal === 1 || (templateRows.length === 0 && r === 2)) {
                const snap = [];
                for (let c = 1; c <= totalCols; c++) {
                    const cell = row.getCell(c);
                    snap.push({
                        val: cell.value,
                        style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : undefined,
                        numFmt: cell.numFmt
                    });
                }
                templateRows.push(snap);
            }
        }
        if (templateRows.length === 0) return;

        for (let r = ws.rowCount; r >= 2; r--) {
            ws.spliceRows(r, 1);
        }

        let writeRowIdx = 2;
        const count = Math.max(1, items.length);
        for (let i = 0; i < count; i++) {
            const item = items[i] || {};
            for (const tplSnap of templateRows) {
                const dstRow = ws.getRow(writeRowIdx++);
                for (let c = 1; c <= totalCols; c++) {
                    const cellMeta = tplSnap[c - 1];
                    const dstCell = dstRow.getCell(c);
                    if (cellMeta) {
                        dstCell.value = cellMeta.val;
                        if (cellMeta.style) dstCell.style = JSON.parse(JSON.stringify(cellMeta.style));
                        if (cellMeta.numFmt) dstCell.numFmt = cellMeta.numFmt;
                    }
                }
                dstRow.getCell(seriCol).value = i + 1;
                if (jenisCol && tarifCol) {
                    const pungutan = String(getRawCellText(dstRow.getCell(jenisCol)) || '').toUpperCase();
                    if (pungutan === 'BM' && item.tarifBm !== undefined) {
                        const t = cleanNum(item.tarifBm ?? item.tariffBm);
                        if (t !== null) dstRow.getCell(tarifCol).value = t;
                    } else if (pungutan === 'PPN' && item.tarifPpn !== undefined) {
                        const t = cleanNum(item.tarifPpn);
                        if (t !== null) dstRow.getCell(tarifCol).value = t;
                    } else if (pungutan === 'PPH' && item.tarifPph !== undefined) {
                        const t = cleanNum(item.tarifPph);
                        if (t !== null) dstRow.getCell(tarifCol).value = t;
                    }
                }
            }
        }
        return;
    }

    // Sheet anak lain: hapus baris dengan SERI BARANG > items.length agar tidak orphan
    const maxSeri = Math.max(1, items.length);
    for (let r = ws.rowCount; r >= 2; r--) {
        const row = ws.getRow(r);
        const sVal = cleanNum(getRawCellText(row.getCell(seriCol)));
        if (sVal !== null && sVal > maxSeri) {
            ws.spliceRows(r, 1);
        }
    }
}

/**
 * Validasi file Excel CEISA 4.0 dan terapkan aturan transformasi Entitas & Barang.
 * @param {Buffer} excelBuffer
 * @param {Object} draftData
 * @param {string} mode ('pib' | 'peb')
 * @returns {Promise<{ buffer: Buffer, summary: Object }>}
 */
async function transformCeisaExcelBuffer(excelBuffer, draftData = {}, mode = 'peb') {
    if (!excelBuffer || !Buffer.isBuffer(excelBuffer) || excelBuffer.length === 0) {
        throw new Error('File Excel kosong atau tidak terbaca.');
    }

    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(excelBuffer);
    } catch (err) {
        throw new Error('File tidak dapat dibaca sebagai Excel .xlsx CEISA 4.0 yang valid (' + (err.message || 'format tidak sesuai') + ').');
    }

    if (!workbook.worksheets || workbook.worksheets.length < 2) {
        throw new Error('File Excel bukan template CEISA 4.0 (minimal harus memiliki sheet ENTITAS dan BARANG hasil ekspor CEISA).');
    }

    const entitasSheet = findSheetCaseInsensitive(workbook, ['ENTITAS']);
    const barangSheet = findSheetCaseInsensitive(workbook, ['BARANG']);

    if (!entitasSheet || !barangSheet) {
        throw new Error('File Excel harus berasal dari Portal CEISA 4.0 (sheet ENTITAS dan BARANG tidak ditemukan, bukan Excel kosong).');
    }

    const entitasHeader = buildHeaderMap(entitasSheet);
    const barangHeader = buildHeaderMap(barangSheet);

    if (entitasHeader.cols.length < 3 || barangHeader.cols.length < 4) {
        throw new Error('Header kolom CEISA pada sheet ENTITAS atau BARANG tidak lengkap / Excel kosong.');
    }

    const hasEntitasData = entitasSheet.rowCount >= 2;
    const hasBarangData = barangSheet.rowCount >= 2;
    if (!hasEntitasData && !hasBarangData) {
        throw new Error('File Excel yang diunggah masih kosong (tidak memiliki baris data template pada sheet ENTITAS maupun BARANG). Gunakan Excel hasil ekspor dari CEISA 4.0.');
    }

    // 1. SHEET ENTITAS: Ubah "TANGGAL IJIN ENTITAS" untuk KODE NEGARA = "ID"
    //    "03-21-2023 00:00:00" -> "2023-03-21 00:00:00" (disimpan sebagai teks '@' dan waktu 00:00:00 dipertahankan)
    const tglIjinCol = findCol(entitasHeader, ['TANGGALIJINENTITAS', 'TGLIJINENTITAS', 'TANGGALIJIN']);
    const kodeNegaraEntCol = findCol(entitasHeader, ['KODENEGARA', 'NEGARA']);
    let entitasUpdated = 0;

    if (tglIjinCol) {
        for (let r = 2; r <= entitasSheet.rowCount; r++) {
            const row = entitasSheet.getRow(r);
            if (kodeNegaraEntCol) {
                const negRaw = String(getRawCellText(row.getCell(kodeNegaraEntCol)) || '').trim().toUpperCase();
                const isIdCountry = negRaw === 'ID' || negRaw.startsWith('ID -') || negRaw.startsWith('ID-');
                if (!isIdCountry) continue;
            }
            const tglCell = row.getCell(tglIjinCol);
            const rawVal = getRawCellText(tglCell);
            const formatted = formatCeisaEntityDatePreserveTime(rawVal);
            if (formatted) {
                tglCell.value = formatted;
                tglCell.numFmt = '@';
                entitasUpdated++;
            }
        }
    }

    // 2. SHEET BARANG:
    //    Hapus semua seri sesudah baris 2, sisakan baris 2 sebagai template Seri 1,
    //    lalu ubah/isi seri 1..N sesuai items pada draft aktif.
    if (barangSheet.rowCount < 2) {
        throw new Error('Sheet BARANG pada file Excel tidak memiliki baris template pertama (baris 2).');
    }

    const templateRow = barangSheet.getRow(2);
    const totalBarangCols = Math.max(barangHeader.cols.length, barangSheet.columnCount || 0);
    const templateSnapshot = [];
    for (let c = 1; c <= totalBarangCols; c++) {
        const cell = templateRow.getCell(c);
        templateSnapshot.push({
            val: cell.value,
            style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : undefined,
            numFmt: cell.numFmt
        });
    }

    // Hapus semua baris seri setelah baris 2
    for (let r = barangSheet.rowCount; r >= 3; r--) {
        barangSheet.spliceRows(r, 1);
    }

    const draftItems = Array.isArray(draftData?.items) ? draftData.items : [];
    const itemsToWrite = draftItems.length > 0 ? draftItems : [{}];

    const colSeri = findCol(barangHeader, ['SERIBARANG', 'NOSERI', 'SERI']);
    const colHs = findCol(barangHeader, ['HS', 'POSTARIF', 'KODEHS', 'HSCODE', 'POSTARIFHS']);
    const colLartas = findCol(barangHeader, ['PERNYATAANLARTAS', 'FLAGLARTAS', 'LARTAS', 'KODELARTAS']);
    const colKodeBarang = findCol(barangHeader, ['KODEBARANG', 'PARTNUMBER']);
    const colUraian = findCol(barangHeader, ['URAIAN', 'URAIANBARANG', 'URAIANJENISBARANG']);
    const colMerek = findCol(barangHeader, ['MEREK', 'MERK']);
    const colTipe = findCol(barangHeader, ['TIPE', 'TYPE']);
    const colUkuran = findCol(barangHeader, ['UKURAN']);
    const colSpek = findCol(barangHeader, ['SPESIFIKASILAIN', 'SPESIFIKASI', 'SPEC']);
    const colNegara = findCol(barangHeader, ['KODENEGARA', 'KODENEGARAASAL', 'NEGARAASAL']);
    const colKondisi = findCol(barangHeader, ['KODEKONDISIBARANG', 'KONDISIBARANG', 'KONDISI']);
    const colKategori = findCol(barangHeader, ['KODEKATEGORIBARANG', 'KATEGORIBARANG', 'KATEGORI']);
    const colQty = findCol(barangHeader, ['JUMLAHSATUAN', 'JUMLAHBARANG', 'QTY']);
    const colSatuan = findCol(barangHeader, ['KODESATUAN', 'KODESATUANBARANG', 'SATUAN']);
    const colJmlKemasan = findCol(barangHeader, ['JUMLAHKEMASAN', 'JMLKEMASAN']);
    const colKodeKemasan = findCol(barangHeader, ['KODEKEMASAN', 'KODEJENISKEMASAN', 'JENISKEMASAN']);
    const colNetto = findCol(barangHeader, ['NETTO', 'BERATBERSIH', 'BERATBERSIHKG']);
    const colBruto = findCol(barangHeader, ['BRUTO', 'BERATKOTOR', 'BERATKOTORKG']);
    const colVolume = findCol(barangHeader, ['VOLUME', 'VOLUMEM3']);
    const colFob = findCol(barangHeader, ['FOB', 'NILAIFOB', 'AMOUNTFOB', 'AMOUNT', 'AMOUNTFCA', 'NILAIEKSPOR', 'HARGAEKSPOR', 'NILAIBARANG', 'HARGAPENYERAHAN']);
    const colBiayaTambahan = findCol(barangHeader, ['BIAYATAMBAHAN', 'BT']);
    const colHargaSatuan = findCol(barangHeader, ['HARGASATUAN', 'HARGAUNIT']);
    const colFreight = findCol(barangHeader, ['FREIGHT']);
    const colAsuransi = findCol(barangHeader, ['ASURANSI']);
    const colCif = findCol(barangHeader, ['CIF', 'CIFUSD', 'NILAICIF', 'NILAIPABEAN']);
    const colCifRp = findCol(barangHeader, ['CIFRUPIAH', 'CIFRP']);

    itemsToWrite.forEach((item, idx) => {
        const targetRowNum = 2 + idx;
        const row = barangSheet.getRow(targetRowNum);
        if (idx > 0) {
            if (templateRow.height) row.height = templateRow.height;
            for (let c = 1; c <= totalBarangCols; c++) {
                const snap = templateSnapshot[c - 1];
                const dstCell = row.getCell(c);
                if (snap) {
                    dstCell.value = snap.val;
                    if (snap.style) dstCell.style = JSON.parse(JSON.stringify(snap.style));
                    if (snap.numFmt) dstCell.numFmt = snap.numFmt;
                }
            }
        }

        const seriNum = idx + 1;
        if (colSeri) row.getCell(colSeri).value = seriNum;

        if (draftItems.length === 0) return;

        const hsDigits = String(item.hsCode || item.posTarif || '').replace(/\D/g, '');
        if (colHs && hsDigits) {
            const c = row.getCell(colHs);
            c.value = hsDigits;
            c.numFmt = '@';
        }
        if (colLartas && item.lartas !== undefined) {
            const tplVal = templateSnapshot[colLartas - 1]?.val;
            row.getCell(colLartas).value = resolveLartasCellValue(item, tplVal);
        }
        if (colKodeBarang && (item.kodeBarang || item.partNumber)) {
            row.getCell(colKodeBarang).value = String(item.kodeBarang || item.partNumber);
        }
        if (colUraian && (item.uraianJenisBarang || item.description || item.namaBarang)) {
            row.getCell(colUraian).value = String(item.uraianJenisBarang || item.description || item.namaBarang);
        }
        if (colMerek && item.merek) {
            row.getCell(colMerek).value = String(item.merek);
        }
        if (colTipe && item.tipe) {
            row.getCell(colTipe).value = String(item.tipe);
        }
        if (colUkuran && item.ukuran) {
            row.getCell(colUkuran).value = String(item.ukuran);
        }
        if (colSpek && item.spesifikasi) {
            row.getCell(colSpek).value = String(item.spesifikasi);
        }
        if (colNegara && (item.negaraAsal || item.countryOfOrigin || item.negara)) {
            const tplVal = templateSnapshot[colNegara - 1]?.val;
            row.getCell(colNegara).value = adaptCodeToTemplate(item.negaraAsal || item.countryOfOrigin || item.negara, tplVal);
        }
        if (colKondisi && item.kondisi) {
            const tplVal = String(templateSnapshot[colKondisi - 1]?.val || '').trim();
            const isUsed = /bukan\s*baru|bekas|used/i.test(String(item.kondisi));
            row.getCell(colKondisi).value = (/^\d+$/.test(tplVal) || !tplVal) ? (isUsed ? '2' : '1') : String(item.kondisi);
        }
        if (colKategori && item.kategori) {
            const tplVal = templateSnapshot[colKategori - 1]?.val;
            row.getCell(colKategori).value = adaptCodeToTemplate(item.kategori, tplVal);
        }

        const { qty, uom } = extractQtyAndUom(item);
        if (colQty) row.getCell(colQty).value = qty;
        if (colSatuan) row.getCell(colSatuan).value = uom;

        const pkg = extractPkgQtyAndCode(item);
        if (colJmlKemasan) row.getCell(colJmlKemasan).value = pkg.qty;
        if (colKodeKemasan) {
            const tplVal = templateSnapshot[colKodeKemasan - 1]?.val;
            row.getCell(colKodeKemasan).value = adaptCodeToTemplate(pkg.code, tplVal);
        }

        const netto = cleanNum(item.beratBersih ?? item.netWeight);
        if (colNetto && netto !== null) row.getCell(colNetto).value = netto;

        const bruto = cleanNum(item.beratKotor ?? item.grossWeight);
        if (colBruto && bruto !== null) row.getCell(colBruto).value = bruto;

        const vol = cleanNum(item.volume);
        if (colVolume && vol !== null) row.getCell(colVolume).value = vol;

        const fobVal = cleanNum(item.fob ?? item.amountFob ?? item.amount ?? item.cifUsd);
        if (colFob && fobVal !== null) row.getCell(colFob).value = fobVal;

        const biayaTambahan = cleanNum(item.biayaTambahan);
        if (colBiayaTambahan && biayaTambahan !== null) row.getCell(colBiayaTambahan).value = biayaTambahan;

        const hargaSatuan = cleanNum(item.hargaSatuan) ?? (fobVal !== null && qty > 0 ? parseFloat((fobVal / qty).toFixed(4)) : null);
        if (colHargaSatuan && hargaSatuan !== null) row.getCell(colHargaSatuan).value = hargaSatuan;

        const freightVal = cleanNum(item.freight ?? item.freightAmount);
        if (colFreight && freightVal !== null) row.getCell(colFreight).value = freightVal;

        const asuransiVal = cleanNum(item.asuransi ?? item.insuranceAmount);
        if (colAsuransi && asuransiVal !== null) row.getCell(colAsuransi).value = asuransiVal;

        const cifVal = cleanNum(item.cifUsd ?? item.nilaiCif) ?? fobVal;
        if (colCif && cifVal !== null) row.getCell(colCif).value = cifVal;

        const cifRpVal = cleanNum(item.cifRupiah);
        if (colCifRp && cifRpVal !== null) row.getCell(colCifRp).value = cifRpVal;
    });

    // 3. Sinkronkan sheet anak berbasis SERI BARANG agar konsisten (terutama BARANGTARIF PIB)
    for (const ws of workbook.worksheets) {
        const nm = normalizeHeaderName(ws.name);
        if (nm === 'BARANG' || nm === 'ENTITAS' || nm === 'HEADER' || nm === 'DOKUMEN' || nm === 'PENGANGKUT' || nm === 'KEMASAN' || nm === 'KONTAINER') {
            continue;
        }
        if (nm.startsWith('BARANG') || nm === 'BAHANBAKU') {
            pruneOrCloneSeriSheet(ws, draftItems, mode);
        }
    }

    const outBuffer = await workbook.xlsx.writeBuffer();
    return {
        buffer: Buffer.from(outBuffer),
        summary: {
            mode: String(mode || 'peb').toUpperCase(),
            entitasUpdated,
            barangCount: itemsToWrite.length,
            draftItemCount: draftItems.length,
            hasTglIjinColumn: Boolean(tglIjinCol)
        }
    };
}

module.exports = {
    transformCeisaExcelBuffer,
    formatCeisaEntityDatePreserveTime,
    normalizeHeaderName
};
