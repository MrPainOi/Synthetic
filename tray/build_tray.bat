@echo off
title Compile CEISA System Tray
echo ============================================================
echo Kompilasi CEISA System Tray (ceisa_tray.cs -^> ceisa_tray.exe)
echo ============================================================

set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" (
    echo [ERROR] Compiler csc.exe tidak ditemukan di direktori .NET Framework.
    pause
    exit /b 1
)

cd /d "%~dp0"

"%CSC%" /target:winexe /win32icon:"%~dp0ceisa_online.ico" /out:"%~dp0ceisa_tray.exe" /optimize+ /r:System.dll,System.Windows.Forms.dll,System.Drawing.dll "%~dp0ceisa_tray.cs"

if %ERRORLEVEL% == 0 (
    echo [BERHASIL] ceisa_tray.exe berhasil dikompilasi!
) else (
    echo [GAGAL] Terjadi kesalahan saat kompilasi.
)

echo ============================================================
pause
