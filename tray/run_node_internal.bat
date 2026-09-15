@echo off
cd /d "%~dp0.."

set "NODE_BIN=node"
if exist "D:\Program Files\nodejs\node.exe" (
    set "NODE_BIN=D:\Program Files\nodejs\node.exe"
) else (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_BIN=C:\Program Files\nodejs\node.exe"
    )
)

"%NODE_BIN%" server.js
