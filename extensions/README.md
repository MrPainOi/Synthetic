# Paket Extension Modular CEISA 4.0

Setiap subfolder di sini bisa langsung di-upload ke Chrome (`chrome://extensions` -> aktifkan **Developer mode** -> **Load unpacked**), **tanpa membawa file website/backend**:

1. `extensions/ceisa-auto-input/` - Hanya modul **Auto Input CEISA** (paling ringan, tanpa Scanner, tanpa Website, tanpa PDF/OCR/Backend).
2. `extensions/ceisa-scanner/` - Hanya modul **Scanner & Monitoring Status SPPB** (terhubung ke Web Dashboard di host Anda).
3. `extensions/ceisa-extension/` - Gabungan **Scanner + Auto Input** tanpa file Website (`pib.html`, `peb.html`, `dashboard.html`, dll) dan tanpa `backend-service/`.

## Mengambil Draft dari PC Lain (misal `192.168.100.15`) Saat Web di Host Sendiri
- Di **PC Pemilik Draft (`192.168.100.15`)**: pastikan backend berjalan (`START_SERVER.bat` / `node backend-service/server.js`) dan port `5005` diizinkan di Windows Firewall untuk jaringan LAN.
- Di **PC Anda**: buka popup Auto Input -> klik **Atur IP / Host** -> isi `192.168.100.15` (atau `192.168.100.15:5005`) -> klik **Hubungkan**.
- Secara terpisah, isi **Host Web Dashboard Anda** (misal `http://localhost:5005` atau URL host Anda sendiri) -> klik **Buka Web**.

Untuk menyinkronkan ulang folder modular setelah mengubah file sumber di root, jalankan:
```
node scripts/build_modular_extensions.js
```
