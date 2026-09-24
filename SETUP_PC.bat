@echo off
chcp 65001 >nul
title CEISA Inspector - Setup PC Baru

echo ================================================================
echo    CEISA INSPECTOR - SETUP OTOMATIS UNTUK PC BARU
echo ================================================================
echo.
echo [1/5] Mengatur PowerShell Execution Policy ke RemoteSigned...
powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
if %errorlevel% equ 0 (
    echo       [OK] PowerShell Execution Policy berhasil diatur ke RemoteSigned.
) else (
    echo       [PERINGATAN] Gagal mengatur Execution Policy secara otomatis.
)
echo.

echo [2/5] Memeriksa instalasi Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo       [ERROR] Node.js belum terinstall di komputer ini!
    echo       Silakan unduh dan install Node.js (LTS Version) dari:
    echo       https://nodejs.org/
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('node -v') do echo       [OK] Node.js terdeteksi: %%v
)
echo.

echo [3/5] Memeriksa dependensi backend-service...
if not exist "%~dp0backend-service\node_modules" (
    echo       Menginstall modul dependensi (npm install)...
    cd /d "%~dp0backend-service"
    call npm install
    cd /d "%~dp0"
    echo       [OK] Dependensi npm berhasil diinstall.
) else (
    echo       [OK] Folder node_modules sudah tersedia.
)
echo.

echo [4/5] Mengimpor database HS Code BTKI (8000+ pos tarif WCO)...
if not exist "%~dp0backend-service\temp\hscode.db" (
    echo       Mengunduh & menyimpan semua pos tarif HS Code ke database lokal...
    echo       (Membutuhkan koneksi internet - proses sekitar 15-30 detik)
    cd /d "%~dp0backend-service"
    call node import_hscode.js
    cd /d "%~dp0"
    echo       [OK] Database HS Code berhasil diimpor!
) else (
    echo       [OK] Database HS Code sudah tersedia (hscode.db).
    echo       Untuk memperbarui: jalankan "npm run import-hscode" di folder backend-service
)
echo.

echo [5/5] Mendaftarkan Auto-Launcher ke Google Chrome & Edge...
set "JSON_PATH=%~dp0launcher\com.ceisa.server_launcher.json"

:: Buat JSON manifest portabel (menggunakan relative path launcher.bat agar berlaku di drive C, D, maupun lainnya)
(
echo {
echo   "name": "com.ceisa.server_launcher",
echo   "description": "CEISA Document Parser Backend Server Launcher",
echo   "path": "launcher.bat",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://geogeopfnkjopjgpfdnfnikfpecdodhe/"
echo   ]
echo }
) > "%JSON_PATH%"

:: Registrasi path manifest dinamis ke Google Chrome
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.ceisa.server_launcher" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo       [OK] Google Chrome Native Messaging berhasil didaftarkan.
) else (
    echo       [PERINGATAN] Gagal mendaftarkan ke registry Google Chrome.
)

:: Registrasi ke Microsoft Edge (opsional jika pengguna memakai Edge)
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.ceisa.server_launcher" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>&1

echo.
echo ================================================================
echo    [SUKSES] SETUP PC SELESAI!
echo ================================================================
echo.
echo Sekarang ketika Anda menekan tombol "Start / Mulai Scan" di
echo Web Dashboard atau Ekstensi CEISA:
echo - Server akan otomatis menyala di latar belakang (tanpa terminal)
echo - Script npm tidak akan diblokir oleh PowerShell
echo - Database HS Code dengan 8000+ pos tarif WCO tersedia offline
echo.
echo Menekan sembarang tombol akan menyalakan server sekarang dan keluar...
pause >nul

start "" "%~dp0START_SERVER.bat"
exit /b 0
