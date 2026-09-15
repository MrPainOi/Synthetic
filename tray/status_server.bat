@echo off
title Status CEISA Server
echo ============================================================
echo Memeriksa status CEISA Server (Port 8080)...
echo ============================================================

netstat -aon | findstr ":8080" | findstr "LISTENING" >nul
if %ERRORLEVEL% == 0 (
    echo [STATUS: AKTIF] CEISA Server SEDANG BERJALAN di port 8080!
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
        echo  - PID: %%a
    )
    powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/status' -TimeoutSec 2; Write-Host ' - Respon API: ' $r.message } catch { Write-Host ' - Respon API: Menunggu koneksi...' }"
) else (
    echo [STATUS: TIDAK AKTIF] CEISA Server saat ini MATI.
    echo Anda dapat menyalakannya dengan klik dua kali start_server.vbs
)

echo ============================================================
pause
