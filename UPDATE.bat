@echo off
chcp 65001 >nul
title CEISA Inspector - Pembaruan Otomatis

echo ================================================================
echo    CEISA INSPECTOR - PEMBARUAN OTOMATIS (CLIENT)
echo ================================================================
echo.
echo [1/3] Mengunduh pembaruan rilis terbaru dari GitHub...

set "PROJECT_DIR=%~dp0"
set "TEMP_ZIP=%PROJECT_DIR%temp_update.zip"
set "TEMP_DIR=%PROJECT_DIR%temp_update_extract"
set "REPO_URL=https://codeload.github.com/MrPainOi/Synthetic/zip/refs/heads/SupabaseV2"

:: Unduh menggunakan curl bawaan Windows atau PowerShell
where curl >nul 2>nul
if %errorlevel% equ 0 (
    curl -L -s -o "%TEMP_ZIP%" "%REPO_URL%"
) else (
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('%REPO_URL%', '%TEMP_ZIP%')"
)

if not exist "%TEMP_ZIP%" (
    echo.
    echo [ERROR] Gagal mengunduh file pembaruan.
    echo Pastikan komputer terhubung ke internet.
    echo.
    pause
    exit /b 1
)

echo [2/3] Mengekstrak file pembaruan...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%" >nul 2>&1
mkdir "%TEMP_DIR%"

where tar >nul 2>nul
if %errorlevel% equ 0 (
    tar -xf "%TEMP_ZIP%" -C "%TEMP_DIR%"
) else (
    powershell -NoProfile -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP_DIR%' -Force"
)

echo [3/3] Memasang pembaruan ke folder ekstensi...
powershell -NoProfile -Command "$sub = Get-ChildItem -Path '%TEMP_DIR%' | Where-Object { $_.PSIsContainer } | Select-Object -First 1; if ($sub) { Copy-Item -Path ($sub.FullName + '\*') -Destination '%PROJECT_DIR%' -Recurse -Force -Exclude '.git','node_modules','server.log','autostart.log' }"

:: Bersihkan file dan folder sementara
del /f /q "%TEMP_ZIP%" >nul 2>&1
rmdir /s /q "%TEMP_DIR%" >nul 2>&1

echo.
echo ================================================================
echo    [BERHASIL] PEMBARUAN BERHASIL DIPASANG!
echo ================================================================
echo.
echo Seluruh file ekstensi telah diperbarui ke versi paling baru.
echo.
echo Langkah terakhir untuk memuat versi baru di Chrome:
echo 1. Buka browser Google Chrome dan ketik: chrome://extensions
echo 2. Cari 'CEISA 4.0 Automation' lalu klik tombol putar (Reload / Muat Ulang).
echo.
echo Selesai! Tekan sembarang tombol untuk menutup jendela ini...
pause >nul
exit /b 0
