@echo off
chcp 65001 >nul
title CEISA Document Parser Backend Server
cd /d "%~dp0backend-service"

echo ================================================================
echo    CEISA DOCUMENT PARSER BACKEND SERVER (Port 5005)
echo ================================================================
echo.

:: Daftarkan Host Native Messaging otomatis ke Chrome & Edge jika folder berpindah drive/lokasi
set "JSON_PATH=%~dp0launcher\com.ceisa.server_launcher.json"
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.ceisa.server_launcher" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.ceisa.server_launcher" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul 2>&1

:: Pastikan Execution Policy
powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" >nul 2>&1

:: Cek dependensi
if not exist "node_modules" (
    echo [INFO] Menyiapkan dependensi (npm install)...
    call npm install
)

echo [INFO] Memulai server CEISA...
call npm start
pause
