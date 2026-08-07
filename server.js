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
                    if (Array.isArray(incoming.completed)) {
                        db.completed = incoming.completed;
                        if (!db.completedByDate) db.completedByDate = {};
                        db.completedByDate[dateKey] = incoming.completed;
                    }
                    if (Array.isArray(incoming.pibpeb)) {
                        db.pibpeb = incoming.pibpeb;
                        if (!db.pibpebByDate) db.pibpebByDate = {};
                        db.pibpebByDate[dateKey] = incoming.pibpeb;
                    }
                    if (incoming.completedByDate && typeof incoming.completedByDate === "object") {
                        db.completedByDate = { ...db.completedByDate, ...incoming.completedByDate };
                    }
                    if (incoming.pibpebByDate && typeof incoming.pibpebByDate === "object") {
                        db.pibpebByDate = { ...db.pibpebByDate, ...incoming.pibpebByDate };
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
