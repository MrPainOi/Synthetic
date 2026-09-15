@echo off
title Hentikan CEISA Server
echo ============================================================
echo Menghentikan CEISA Server (Port 8080)...
echo ============================================================

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    set FOUND=1
    taskkill /F /PID %%a >nul 2>&1
    echo [BERHASIL] Proses Server dengan PID %%a telah dihentikan.
)

if "%FOUND%"=="0" (
    echo [INFO] Tidak ada CEISA Server yang sedang berjalan di port 8080.
) else (
    echo [INFO] CEISA Server telah dinonaktifkan.
)

echo ============================================================
pause
