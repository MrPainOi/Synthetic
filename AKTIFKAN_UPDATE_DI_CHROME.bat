@echo off
chcp 65001 >nul
title CEISA - Registrasi Auto-Updater Chrome

set "JSON_PATH=%~dp0launcher\com.ceisa.server_launcher.json"

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.ceisa.server_launcher" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.ceisa.server_launcher" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>&1

echo ================================================================
echo    [BERHASIL] TOMBOL "PERBARUI SEKARANG" DI CHROME SUDAH AKTIF!
echo ================================================================
echo.
echo Pendaftaran berhasil dilakukan ke Google Chrome dan Microsoft Edge.
echo.
echo Mulai sekarang, Anda dapat memperbarui ekstensi cukup dengan:
echo - Membuka Dashboard atau Popup CEISA di Chrome
echo - Menekan tombol "Perbarui Sekarang"
echo.
echo Sistem akan otomatis mengunduh dan memasang pembaruan di latar belakang
echo tanpa memerlukan instalasi Node.js atau aplikasi lainnya.
echo.
echo Tekan sembarang tombol untuk keluar...
pause >nul
exit /b 0
