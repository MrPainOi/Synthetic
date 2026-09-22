@echo off
chcp 65001 >nul
title CEISA Document Parser Backend Server
cd /d "%~dp0backend-service"

echo ================================================================
echo    CEISA DOCUMENT PARSER BACKEND SERVER (Port 5005)
echo ================================================================
echo.

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
