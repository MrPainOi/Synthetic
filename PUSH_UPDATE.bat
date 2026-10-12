@echo off
chcp 65001 >nul
title CEISA Inspector - Push Update ke Semua Komputer
cd /d "%~dp0"

node publish_update.js %*

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Terjadi kendala saat publikasi pembaruan.
)

pause
