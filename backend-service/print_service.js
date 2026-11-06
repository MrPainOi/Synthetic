const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const ptp = require('pdf-to-printer');
const QRCode = require('qrcode');

const uploadsDir = path.join(__dirname, 'temp', 'prints');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Locate SumatraPDF bundled with pdf-to-printer
const sumatraBinary = path.join(__dirname, 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe');

// In-memory print history
const jobHistory = [];

function getLocalIps() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ips.push({ interface: name, address: net.address });
            }
        }
    }
    return ips;
}

function getPrimaryIp() {
    const ips = getLocalIps();
    // Prioritize Wi-Fi interface if available for phones on the same WLAN
    const wifi = ips.find(i => /wi-fi|wireless|wlan/i.test(i.interface));
    if (wifi) return wifi.address;
    const lan = ips.find(i => i.address.startsWith('192.168.'));
    if (lan) return lan.address;
    if (ips.length > 0) return ips[0].address;
    return '127.0.0.1';
}

function printWithSumatra(printerName, filePath, options = {}) {
    return new Promise((resolve, reject) => {
        const args = ['-print-to', printerName];

        const settings = [];
        if (options.copies && options.copies > 1) {
            settings.push(`${options.copies}x`);
        }
        if (options.paperSize && options.paperSize !== 'auto') {
            settings.push(`paper=${options.paperSize}`);
        }
        if (options.pageRange) {
            settings.push(options.pageRange);
        }

        if (settings.length > 0) {
            args.push('-print-settings', settings.join(','));
        }

        args.push(filePath);

        const child = spawn(sumatraBinary, args, { windowsHide: true });
        let stderr = '';
        child.stderr?.on('data', d => { stderr += d.toString(); });

        child.on('close', code => {
            if (code === 0) resolve({ success: true });
            else reject(new Error(`SumatraPDF keluar dengan kode ${code}: ${stderr}`));
        });
        child.on('error', reject);
    });
}

function printRawData(printerName, content, isFile = false, docName = 'Synthetic RAW Job') {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'raw_print.ps1');
        let psArgs = `-ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${printerName}" -DocName "${docName}"`;
        let tempFileToClean = null;
        
        if (isFile) {
            psArgs += ` -FilePath "${content}"`;
        } else {
            const tempFile = path.join(uploadsDir, `raw_${Date.now()}_${Math.round(Math.random() * 1000)}.txt`);
            // Write buffer strictly in Latin-1 / Windows-1252 8-bit ASCII to prevent dot-matrix UTF-16LE glitches
            fs.writeFileSync(tempFile, Buffer.from(content, 'latin1'));
            psArgs += ` -FilePath "${tempFile}"`;
            tempFileToClean = tempFile;
        }

        exec(`powershell -NoProfile ${psArgs}`, (err, stdout, stderr) => {
            if (tempFileToClean) {
                fs.unlink(tempFileToClean, () => {});
            }
            if (err) {
                return reject(new Error(stderr || err.message));
            }
            resolve({ success: true, output: stdout.trim() });
        });
    });
}

async function processPrintJob(jobRecord, filePath, options = {}) {
    console.log(`[SYNTHETIC PRINT] ${jobRecord.id}: ${jobRecord.filename} -> ${jobRecord.printer}`);
    try {
        const ext = path.extname(jobRecord.filename).toLowerCase();
        
        if (options.isRaw === 'true' || options.isRaw === true) {
            await printRawData(jobRecord.printer, filePath, true, jobRecord.filename);
        } else if (ext === '.pdf') {
            const printOptions = {
                printer: jobRecord.printer,
                copies: jobRecord.copies
            };
            if (options.paperSize && options.paperSize !== 'auto') {
                printOptions.paperSize = options.paperSize;
            }
            if (options.pageRange) {
                printOptions.pages = options.pageRange;
            }
            if (options.orientation && options.orientation !== 'auto') {
                printOptions.orientation = options.orientation;
            }
            await ptp.print(filePath, printOptions);
        } else {
            await printWithSumatra(jobRecord.printer, filePath, {
                copies: jobRecord.copies,
                paperSize: options.paperSize !== 'auto' ? options.paperSize : undefined,
                pageRange: options.pageRange
            });
        }

        jobRecord.status = 'Berhasil Dicetak';
        console.log(`[SYNTHETIC PRINT SUCCESS] ${jobRecord.id}: ${jobRecord.filename}`);
    } catch (err) {
        jobRecord.status = 'Gagal';
        jobRecord.error = err.message;
        console.error(`[SYNTHETIC PRINT ERROR] ${jobRecord.id}:`, err.message);
    } finally {
        setTimeout(() => {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlink(filePath, () => {});
            }
        }, 15000);
    }
}

function createBase64PrintJob(payload) {
    const {
        filename,
        printer,
        base64Data,
        copies = 1,
        paperSize,
        pageRange,
        orientation,
        isRaw = false
    } = payload;

    if (!base64Data) {
        throw new Error('Data berkas (base64) tidak boleh kosong.');
    }
    if (!printer) {
        throw new Error('Nama printer tujuan wajib dipilih.');
    }

    const cleanFilename = filename || 'dokumen_' + Date.now() + '.pdf';
    const buffer = Buffer.from(base64Data, 'base64');
    const safeExt = path.extname(cleanFilename) || '.pdf';
    const tempFilePath = path.join(uploadsDir, `${Date.now()}_${Math.round(Math.random() * 1E6)}${safeExt}`);
    
    fs.writeFileSync(tempFilePath, buffer);

    const jobId = 'JOB-' + Date.now();
    const jobRecord = {
        id: jobId,
        filename: cleanFilename,
        size: buffer.length,
        printer,
        copies: parseInt(copies, 10) || 1,
        timestamp: new Date().toISOString(),
        status: 'Sedang dikirim ke spooler...',
        error: null
    };
    jobHistory.unshift(jobRecord);

    // Run in background without blocking response
    processPrintJob(jobRecord, tempFilePath, { paperSize, pageRange, orientation, isRaw });

    return {
        jobId,
        message: `Berkas "${cleanFilename}" berhasil diterima dan sedang dikirim ke printer.`,
        record: jobRecord
    };
}

function createFilePrintJob(file, payload = {}) {
    if (!file) {
        throw new Error('Tidak ada berkas yang diunggah.');
    }
    const {
        printer,
        copies = 1,
        paperSize,
        pageRange,
        orientation,
        isRaw = false
    } = payload;

    if (!printer) {
        throw new Error('Nama printer tujuan wajib dipilih.');
    }

    const jobId = 'JOB-' + Date.now();
    const jobRecord = {
        id: jobId,
        filename: file.originalname,
        size: file.size,
        printer,
        copies: parseInt(copies, 10) || 1,
        timestamp: new Date().toISOString(),
        status: 'Sedang dikirim ke spooler...',
        error: null
    };
    jobHistory.unshift(jobRecord);

    processPrintJob(jobRecord, file.path, { paperSize, pageRange, orientation, isRaw });

    return {
        jobId,
        message: `Berkas "${file.originalname}" berhasil diterima dan sedang dikirim ke printer.`,
        record: jobRecord
    };
}

function createTextPrintJob(payload) {
    const {
        text,
        printer,
        isRaw = true,
        ejectPage = false,
        docName = 'Faktur / Teks Langsung',
        copies = 1
    } = payload;

    if (!text || !text.trim()) {
        throw new Error('Teks tidak boleh kosong.');
    }
    if (!printer) {
        throw new Error('Nama printer tujuan wajib dipilih.');
    }

    const jobId = 'JOB-' + Date.now();
    const jobRecord = {
        id: jobId,
        filename: docName,
        size: Buffer.byteLength(text, 'latin1'),
        printer,
        copies: parseInt(copies, 10) || 1,
        timestamp: new Date().toISOString(),
        status: 'Sedang dikirim ke spooler...',
        error: null
    };
    jobHistory.unshift(jobRecord);

    (async () => {
        try {
            if (isRaw === true || isRaw === 'true') {
                let printText = text;
                if (ejectPage === true || ejectPage === 'true') {
                    // Only append form feed if user explicitly requested ejecting the continuous form
                    if (!printText.endsWith('\f') && !printText.endsWith('\x0c')) {
                        printText += '\r\n\x0c';
                    }
                } else {
                    // Append 3 simple newlines to advance paper slightly without ejecting
                    printText += '\r\n\r\n\r\n';
                }
                await printRawData(printer, printText, false, docName);
            } else {
                const tempFile = path.join(uploadsDir, `text_${Date.now()}.txt`);
                fs.writeFileSync(tempFile, text, 'utf8');
                await printWithSumatra(printer, tempFile);
                setTimeout(() => fs.unlink(tempFile, () => {}), 15000);
            }
            jobRecord.status = 'Berhasil Dicetak';
            console.log(`[SYNTHETIC PRINT TEXT SUCCESS] ${jobRecord.id}: ${jobRecord.filename}`);
        } catch (err) {
            jobRecord.status = 'Gagal';
            jobRecord.error = err.message;
            console.error(`[SYNTHETIC PRINT TEXT ERROR] ${jobRecord.id}:`, err.message);
        }
    })();

    return {
        jobId,
        message: `Teks "${docName}" diterima dan sedang dikirim ke printer.`,
        record: jobRecord
    };
}

function getJobStatus(jobId) {
    return jobHistory.find(j => j.id === jobId) || null;
}

function clearJobHistory() {
    jobHistory.length = 0;
    return true;
}

async function getPrinters() {
    const [printerList, defaultPrinter] = await Promise.all([
        ptp.getPrinters().catch(() => []),
        ptp.getDefaultPrinter().catch(() => null)
    ]);

    return new Promise((resolve) => {
        const psCommand = `Get-Printer | Select-Object Name, DriverName, PortName, Shared, PrinterStatus | ConvertTo-Json -Compress`;
        exec(`powershell -NoProfile -Command "${psCommand}"`, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
            let winDetails = [];
            if (!err && stdout) {
                try {
                    const parsed = JSON.parse(stdout);
                    winDetails = Array.isArray(parsed) ? parsed : [parsed];
                } catch (e) {}
            }

            const enriched = printerList.map(p => {
                const detail = winDetails.find(w => w.Name === p.name) || {};
                const nameLow = (p.name || '').toLowerCase();
                const isDotMatrix = nameLow.includes('lq') || nameLow.includes('fx') || nameLow.includes('lx') || nameLow.includes('matrix') || nameLow.includes('epson');

                return {
                    name: p.name,
                    deviceId: p.deviceId,
                    paperSizes: p.paperSizes || [],
                    isDefault: defaultPrinter && defaultPrinter.name === p.name,
                    driverName: detail.DriverName || null,
                    portName: detail.PortName || null,
                    isShared: !!detail.Shared,
                    status: detail.PrinterStatus || 'Normal',
                    isDotMatrix
                };
            });

            resolve({
                printers: enriched,
                defaultPrinter: defaultPrinter ? defaultPrinter.name : (enriched[0]?.name || null)
            });
        });
    });
}

function getQueue() {
    return new Promise((resolve) => {
        const psCommand = `Get-PrintJob -ErrorAction SilentlyContinue | Select-Object Id, PrinterName, DocumentName, JobStatus, TotalPages, SubmittedTime | ConvertTo-Json -Compress`;
        exec(`powershell -NoProfile -Command "${psCommand}"`, (err, stdout) => {
            let jobs = [];
            if (!err && stdout && stdout.trim()) {
                try {
                    const parsed = JSON.parse(stdout);
                    jobs = Array.isArray(parsed) ? parsed : [parsed];
                } catch (e) {
                    jobs = [];
                }
            }
            resolve({
                queue: jobs,
                history: jobHistory.slice(0, 30)
            });
        });
    });
}

async function getQrDataUrl(port) {
    const primaryIp = getPrimaryIp();
    const serverUrl = `http://${primaryIp}:${port}/print_hub.html`;
    const qrDataUrl = await QRCode.toDataURL(serverUrl, {
        width: 320,
        margin: 2,
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        }
    });
    return { url: serverUrl, qr: qrDataUrl, ip: primaryIp, port };
}

async function getStatus(port) {
    const primaryIp = getPrimaryIp();
    const serverUrl = `http://${primaryIp}:${port}/print_hub.html`;
    const defaultPrinter = await ptp.getDefaultPrinter().catch(() => null);

    return {
        status: 'online',
        hostname: os.hostname(),
        primaryIp,
        port,
        serverUrl,
        allIps: getLocalIps(),
        defaultPrinter: defaultPrinter ? defaultPrinter.name : null,
        activeJobs: jobHistory.filter(j => j.status.includes('Sedang')).length
    };
}

module.exports = {
    uploadsDir,
    jobHistory,
    getLocalIps,
    getPrimaryIp,
    getPrinters,
    getQueue,
    getQrDataUrl,
    getStatus,
    getJobStatus,
    clearJobHistory,
    createBase64PrintJob,
    createFilePrintJob,
    createTextPrintJob,
    processPrintJob,
    printRawData,
    printWithSumatra
};
