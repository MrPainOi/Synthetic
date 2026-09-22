@echo off
setlocal
set "NODE_BIN=node"
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_BIN=C:\Program Files\nodejs\node.exe"
) else if exist "D:\Program Files\nodejs\node.exe" (
    set "NODE_BIN=D:\Program Files\nodejs\node.exe"
)

"%NODE_BIN%" "%~dp0native_host.js"
