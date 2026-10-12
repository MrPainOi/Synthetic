// ============================================================
// CEISA AUTO COLORING - KONFIGURASI SENSITIF
// ============================================================
// File ini TIDAK di-commit ke Git (ada di .gitignore)
// Salin dari config.example.js dan isi dengan nilai asli.
// ============================================================

const CEISA_CONFIG = {
    // Mode sync aktif: "google_sheets"
    SYNC_PROVIDER: "google_sheets",

    // URL Google Apps Script Web App
    GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyGBHuIkhsLawwQ1V48bKXmg8MXu35sc7iD91Re2We6mOsDvFm0uM8g6lnZxxKYfl0/exec"
};

// Resolver dinamis URL backend CEISA (berlaku untuk localhost, IP WiFi/LAN, HP/laptop lain)
window.getCeisaBackendUrl = function (path = '') {
    let base = 'http://localhost:5005';
    try {
        if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
            base = `${window.location.protocol}//${window.location.hostname}:5005`;
        }
    } catch (_) {}
    if (path) {
        if (!path.startsWith('/')) path = '/' + path;
        return `${base}${path}`;
    }
    return base;
};
