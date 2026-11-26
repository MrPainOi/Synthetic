@echo off
chcp 65001 >nul
title CEISA 4.0 - Buka Windows Firewall Port 5005 (LAN Sharing)

:: Cek hak Administrator; jika belum Admin, minta elevasi UAC otomatis
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Meminta hak Administrator untuk membuka Port 5005 di Windows Firewall...
    powershell -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ================================================================
echo    CEISA 4.0 - MEMBUKA FIREWALL PORT 5005 UNTUK JARINGAN LAN
echo ================================================================
echo.

netsh advfirewall firewall delete rule name="CEISA Backend Server Port 5005" >nul 2>&1
netsh advfirewall firewall add rule name="CEISA Backend Server Port 5005" dir=in action=allow protocol=TCP localport=5005 profile=any
if %errorlevel% equ 0 (
    echo [OK] Port TCP 5005 berhasil dibuka untuk profil Domain, Private, dan Public.
) else (
    echo [ERROR] Gagal menambahkan aturan firewall untuk port 5005.
)

for /f "delims=" %%N in ('where node 2^>nul') do (
    netsh advfirewall firewall delete rule name="CEISA Node Runtime (All Profiles)" >nul 2>&1
    netsh advfirewall firewall add rule name="CEISA Node Runtime (All Profiles)" dir=in action=allow program="%%N" enable=yes profile=any >nul 2>&1
    echo [OK] Node.js diizinkan melalui firewall: %%N
)

echo.
echo [INFO] Alamat IP PC ini di jaringan LAN:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /I "IPv4"') do echo   -%%A
echo.
echo Pastikan browser di PC lain membuka: http://[IP-PC-INI]:5005/api/health
echo ================================================================
pause
