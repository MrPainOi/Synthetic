// ============================================================
// CEISA AUTO COLORING - KONFIGURASI SENSITIF
// ============================================================
// File ini TIDAK di-commit ke Git (ada di .gitignore)
// Salin dari config.example.js dan isi dengan nilai asli.
// ============================================================

const CEISA_CONFIG = {
    // Mode sync aktif: "google_sheets" (disarankan) atau "supabase"
    SYNC_PROVIDER: "google_sheets",

    // Masukkan URL Google Apps Script Web App di sini setelah dideploy:
    GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyGBHuIkhsLawwQ1V48bKXmg8MXu35sc7iD91Re2We6mOsDvFm0uM8g6lnZxxKYfl0/exec",

    // Konfigurasi Supabase (aktif otomatis jika GOOGLE_SCRIPT_URL kosong atau SYNC_PROVIDER = 'supabase')
    SUPABASE_URL: "https://grvwcvcpxemqyjprbdtr.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdydndjdmNweGVtcXlqcHJiZHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTU4MjcsImV4cCI6MjEwNTQ5MTgyN30.sm_cp0G9Xta95vPj3urguZ5tLGlJeQLRXklANTdCwE4"
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
