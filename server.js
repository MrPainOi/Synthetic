// ============================================================
// CEISA INSPECTOR - LOCAL WI-FI SYNC SERVER (server.js)
// Server Lokal Wi-Fi Murni (Tanpa Internet / Zero External Cloud)
// Jalankan dengan command: node server.js
// ============================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 8080;
const DB_FILE = path.join(__dirname, "ceisa_wifi_db.json");

function isWithinLast3Days(dateStr, timestamp) {
    return true;
}

function pruneScanCache3Days(cache) {
    return (cache && typeof cache === "object") ? cache : {};
}

// In-Memory & File Database Initialization
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed) {
                if (parsed.cache) parsed.cache = pruneScanCache3Days(parsed.cache);
                if (!parsed.completedByDate) parsed.completedByDate = {};
                if (!parsed.pibpebByDate) parsed.pibpebByDate = {};

                const todayKey = new Date().toISOString().split('T')[0];
                if (Array.isArray(parsed.completed) && parsed.completed.length > 0) {
                    if (!parsed.completedByDate[todayKey]) {
                        parsed.completedByDate[todayKey] = parsed.completed;
                    }
                }
                if (Array.isArray(parsed.pibpeb) && parsed.pibpeb.length > 0) {
                    if (!parsed.pibpebByDate[todayKey]) {
                        parsed.pibpebByDate[todayKey] = parsed.pibpeb;
                    }
                }
                return parsed;
            }
        }
    } catch (_) {}
    return {
        completed: [],
        pibpeb: [],
        completedByDate: {},
        pibpebByDate: {},
        cache: {},
        updatedAt: Date.now()
    };
}

function saveDB(data) {
    try {
        if (data && data.cache) {
            data.cache = pruneScanCache3Days(data.cache);
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
        console.error("Gagal menyimpan ceisa_wifi_db.json:", err.message);
    }
}

let db = loadDB();

// Get Local Wi-Fi IP Address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === "IPv4" && !net.internal) {
                return net.address;
            }
        }
    }
    return "127.0.0.1";
}

const server = http.createServer((req, res) => {
    // Enable CORS for local network access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // API GET / HEAD Documents (Serve PDF & attached clearance files)
    if (pathname.startsWith("/api/documents/") && (req.method === "GET" || req.method === "HEAD")) {
        const rawFileName = decodeURIComponent(pathname.replace(/^\/api\/documents\//, ""));
        const searchDirs = [
            path.join(__dirname, "backend-service", "temp", "attachments"),
            path.join(__dirname, "backend-service", "temp"),
            path.join(__dirname, "attachments"),
            __dirname
        ];

        let foundPath = null;
        for (const dir of searchDirs) {
            if (fs.existsSync(dir)) {
                const candidate = path.join(dir, rawFileName);
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    foundPath = candidate;
                    break;
                }
            }
        }

        // Fuzzy match if exact file name is not found
        if (!foundPath) {
            for (const dir of searchDirs) {
                if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
                    const files = fs.readdirSync(dir);
                    const cleanTarget = rawFileName.toLowerCase().replace(/[^a-z0-9]/g, "");
                    const matched = files.find(f => {
                        const cleanF = f.toLowerCase().replace(/[^a-z0-9]/g, "");
                        return cleanF === cleanTarget || cleanF.includes(cleanTarget) || cleanTarget.includes(cleanF);
                    });
                    if (matched) {
                        foundPath = path.join(dir, matched);
                        break;
                    }
                }
            }
        }

        if (foundPath) {
            const ext = path.extname(foundPath).toLowerCase();
            const mimeTypes = {
                ".pdf": "application/pdf",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".json": "application/json"
            };
            const contentType = mimeTypes[ext] || "application/octet-stream";
            res.writeHead(200, {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${path.basename(foundPath)}"`,
                "Access-Control-Allow-Origin": "*"
            });
            fs.createReadStream(foundPath).pipe(res);
            return;
        } else {
            res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ error: "File tidak ditemukan", requested: rawFileName }));
            return;
        }
    }

    // API GET Status (Lightweight ping/healthcheck)
    if (pathname === "/api/status" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            status: "ok",
            message: "CEISA Inspector Server Aktif",
            pid: process.pid,
            port: PORT,
            wifiIp: getLocalIP(),
            wifiUrl: `http://${getLocalIP()}:${PORT}/dashboard.html`,
            uptime: Math.floor(process.uptime())
        }));
        return;
    }

    // API GET Sync
    if (pathname === "/api/sync" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(db));
        return;
    }

    // API POST Sync
    if (pathname === "/api/sync" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", () => {
            try {
                const incoming = JSON.parse(body);

                if (incoming.clearCache) {
                    db.cache = {};
                    db.updatedAt = Date.now();
                    saveDB(db);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true, data: db }));
                    return;
                }

                if (incoming.isSave) {
                    const dateKey = incoming.date || new Date().toISOString().split('T')[0];
                    if (!db.completedByDate) db.completedByDate = {};
                    if (!db.pibpebByDate) db.pibpebByDate = {};

                    if (Array.isArray(incoming.completed)) {
                        db.completedByDate[dateKey] = incoming.completed;
                        db.completed = incoming.completed;
                    }

                    if (Array.isArray(incoming.pibpeb)) {
                        db.pibpebByDate[dateKey] = incoming.pibpeb;
                        db.pibpeb = incoming.pibpeb;
                    }

                    if (incoming.completedByDate && typeof incoming.completedByDate === "object") {
                        for (const [d, list] of Object.entries(incoming.completedByDate)) {
                            if (Array.isArray(list)) {
                                db.completedByDate[d] = list;
                            }
                        }
                    }

                    if (incoming.pibpebByDate && typeof incoming.pibpebByDate === "object") {
                        for (const [d, list] of Object.entries(incoming.pibpebByDate)) {
                            if (Array.isArray(list)) {
                                db.pibpebByDate[d] = list;
                            }
                        }
                    }

                    if (incoming.cache && typeof incoming.cache === "object") {
                        db.cache = { ...db.cache, ...incoming.cache };
                    }

                    db.updatedAt = Date.now();
                    saveDB(db);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true, data: db }));
                    return;
                }

                // Normal periodic sync or live scan update (Only merge scan cache, keep server lists authoritative)
                const localCache = (incoming.cache && typeof incoming.cache === "object") ? incoming.cache : {};
                db.cache = { ...db.cache, ...localCache };

                db.updatedAt = Date.now();
                saveDB(db);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, data: db }));
            } catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // Static File Serving
    let filePath = path.join(__dirname, pathname === "/" ? "dashboard.html" : pathname);
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg"
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === "ENOENT") {
                res.writeHead(404, { "Content-Type": "text/html" });
                res.end("<h1>404 Not Found</h1>");
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { "Content-Type": contentType });
            res.end(content, "utf-8");
        }
    });
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        const nextPort = PORT + 1;
        console.log(`Port ${PORT} sedang digunakan. Mencoba port ${nextPort}...`);
        server.listen(nextPort, "0.0.0.0");
    } else {
        console.error("Server Error:", err);
    }
});

server.listen(PORT, "0.0.0.0", () => {
    const localIP = getLocalIP();
    console.log("\n==============================================================");
    console.log("🚀 CEISA INSPECTOR - SERVER WI-FI LOKAL AKTIF!");
    console.log("==============================================================");
    console.log(`📶 Sambungkan HP ke Wi-Fi yang sama, lalu buka link ini di HP:`);
    console.log(`\n👉 http://${localIP}:${PORT}/dashboard.html\n`);
    console.log(`💻 Atau di PC ini: http://localhost:${PORT}/dashboard.html`);
    console.log("==============================================================\n");
});

// Keep process active
process.stdin.resume();
