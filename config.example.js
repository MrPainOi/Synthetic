// ============================================================
// CEISA AUTO COLORING - TEMPLATE KONFIGURASI
// ============================================================
// File ini AMAN di-commit ke Git (tidak berisi nilai asli).
// Cara setup:
//   1. Salin file ini menjadi config.js
//   2. Pilih SYNC_PROVIDER ("google_sheets" atau "supabase")
//   3. Masukkan GOOGLE_SCRIPT_URL jika pakai Google Sheets,
//      atau SUPABASE_URL & ANON_KEY jika pakai Supabase.
// ============================================================

const CEISA_CONFIG = {
    // Mode sync: "google_sheets" (Disarankan: Gratis, tanpa limit) atau "supabase"
    SYNC_PROVIDER: "google_sheets",

    // URL Web App dari Google Apps Script (lihat panduan di google-apps-script/Code.gs)
    GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfyc.../exec",

    // Konfigurasi Supabase (opsional)
    SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
    SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY_HERE"
};
