## 2026-11-10T04:15:33Z

Perbaikan antarmuka Print Hub dan pembaruan struktur Tab Entitas pada modul PIB untuk lingkungan produksi agar sesuai dengan format asli CEISA 4.0.

Integrity mode: development

## Verification Resources
- Referensi visual screenshot pada direktori brain:
  * Print Hub (tanpa QR Code): C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282626045_8ddf80f2.png
  * Header PIB (.ceisa-doc-topbar yang dihapus): C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282626019_9dd72ceb.png
  * Card PPJK lama (yang dihapus): C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282626039_d1d40fb4.png
  * Tampilan asli Tab Entitas CEISA 4.0:
    - C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282977653_5e8008e4.png
    - C:/Users/User/.gemini/antigravity/brain/7931af86-5954-4436-8b8b-9d8db5fd564b/.user_uploaded/media_1794282972406_ac3647c6.png
- Verifikasi dilakukan melalui inspeksi DOM, visual rendering, dan pengecekan fungsionalitas konsol/form terhadap screenshot referensi CEISA 4.0.

## Requirements

### R1. Hapus Banner/Kontainer QR Code pada Halaman Print Hub
Hapus banner/kontainer QR Code ("Cetak Langsung dari HP (Android / IOS)" yang menampilkan QR Code) pada `print_hub.html` dan skrip terkait di `print_hub.js`, sehingga halaman cetak tidak lagi menampilkan QR Code.

### R2. Hapus Elemen yang Ditandai Merah pada Halaman PIB
Pada halaman PIB (`pib.html`, `pib_dashboard.js`, `dashboard.css`):
- Hapus baris dokumen paling atas (`.ceisa-doc-topbar` dengan teks "FTZ01 - Pemasukan dari Luar Daerah Pabean", tombol "Kembali", dan tombol "Update Data").
- Hapus komponen card "PPJK (Pengusaha Pengurusan Jasa Kepabeanan) - Opsional" yang lama.

### R3. Samakan Tab Entitas PIB dengan Format Asli CEISA 4.0
Rombak tampilan dan struktur Tab Entitas pada `pib.html` menjadi tata letak 2 kolom yang identik dengan tampilan asli CEISA 4.0:
- **Kolom Kiri**:
  1. Card **Pengirim**: Tombol 'Referensi', Nomor Identitas (select jenis identitas + input nomor), Nama, Alamat, Negara (dropdown).
  2. Card **Pembeli**: Tombol 'Hapus Pembeli', 'Salin data penerima', Nomor Identitas (select jenis + input nomor), NITKU, Nama, Alamat, Negara (dropdown).
  3. Card **Pemilik Barang**: Tombol 'Salin Penerima', 'Referensi', Nomor Identitas, NITKU, Nama, Alamat, Afiliasi (dropdown, default 'TAH - Tidak berhubungan').
- **Kolom Kanan**:
  1. Card **Penerima**: Tombol 'Referensi', Nomor Identitas (select jenis, default '6 - NPWP 16 DIGIT' + input nomor), NITKU, Nama, Alamat, Negara (dropdown), Status (default 'LAINNYA'), Ijin Badan Pengusahaan (No Izin + Tanggal).
  2. Card **Penjual**: Tombol 'Salin data pengirim', Nomor Identitas (select jenis + input nomor), Nama, Alamat, Negara (dropdown).
  3. Card **PPJK**: Nomor Identitas (select jenis, default '6 - NPWP 16 DIGIT' + input nomor), NITKU dengan tombol sinkronisasi, Nama, Alamat.

### R4. Penyesuaian Penanganan Data Form dan Auto-Input
Sesuaikan skrip JavaScript agar mendukung seluruh field entitas CEISA 4.0:
- Perbarui `collectPibFormData` dan `populatePibForm` pada `pib_dashboard.js` untuk membaca dan mengisi seluruh field entitas yang baru.
- Perbarui `handleCeisaAutoInputRow` pada `content.js` untuk memetakan data entitas baru ke input target CEISA.
- Pastikan tombol aksi salin data ('Salin data penerima', 'Salin data pengirim', 'Salin Penerima') berfungsi menyalin nilai antar card di antarmuka pengguna.
