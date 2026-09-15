' ============================================================
' CEISA Inspector - Background Server Launcher (Silent Mode)
' Berjalan tanpa jendela hitam dan terlepas dari console induk
' ============================================================
Dim strWorkDir, strNodeExe, intPID, errReturn
Dim objShell, objFSO, objHTTP, objWMIService, objStartup, objConfig, objProcess, objLog

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strWorkDir = "C:\Synthetic"
objShell.CurrentDirectory = strWorkDir

' 1. Cek apakah server sudah aktif di port 8080 agar tidak ada duplikasi
On Error Resume Next
Set objHTTP = CreateObject("MSXML2.ServerXMLHTTP.6.0")
objHTTP.open "GET", "http://127.0.0.1:8080/api/status", False
objHTTP.setTimeouts 1000, 1000, 1000, 1000
objHTTP.send ""

If Err.Number = 0 Then
    If objHTTP.status = 200 Or objHTTP.status = 304 Then
        ' Server sudah aktif, keluar tanpa membuat proses baru
        WScript.Quit 0
    End If
End If
On Error GoTo 0

' 2. Deteksi lokasi node.exe secara dinamis
strNodeExe = "node.exe"
If objFSO.FileExists("D:\Program Files\nodejs\node.exe") Then
    strNodeExe = "D:\Program Files\nodejs\node.exe"
ElseIf objFSO.FileExists("C:\Program Files\nodejs\node.exe") Then
    strNodeExe = "C:\Program Files\nodejs\node.exe"
ElseIf objFSO.FileExists("C:\Program Files (x86)\nodejs\node.exe") Then
    strNodeExe = "C:\Program Files (x86)\nodejs\node.exe"
End If

' 3. Jalankan server secara independen dan hidden lewat WMI Win32_Process
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
Set objStartup = objWMIService.Get("Win32_ProcessStartup")
Set objConfig = objStartup.SpawnInstance_
objConfig.ShowWindow = 0 ' 0 = SW_HIDE (Jendela disembunyikan sepenuhnya)

Set objProcess = GetObject("winmgmts:\\.\root\cimv2:Win32_Process")
Dim strCmd
strCmd = """" & strNodeExe & """ """ & strWorkDir & "\server.js"""
errReturn = objProcess.Create(strCmd, strWorkDir, objConfig, intPID)

' 4. Catat log autostart untuk monitoring keandalan
On Error Resume Next
Set objLog = objFSO.OpenTextFile(strWorkDir & "\autostart.log", 8, True)
If errReturn = 0 Then
    objLog.WriteLine "[" & Now & "] CEISA Server berhasil dinyalakan di latar belakang (PID: " & intPID & ")"
Else
    objLog.WriteLine "[" & Now & "] Gagal menyalakan CEISA Server. Kode Error WMI: " & errReturn
End If
objLog.Close
