param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    
    [Parameter(Mandatory=$false)]
    [string]$FilePath,

    [Parameter(Mandatory=$false)]
    [string]$Text,

    [Parameter(Mandatory=$false)]
    [string]$DocName = "WebPrint RAW Document"
)

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public class DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW pDocInfo);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes, string docName) {
        IntPtr hPrinter;
        if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            int err = Marshal.GetLastWin32Error();
            throw new Exception("OpenPrinter failed with error code " + err);
        }
        DOCINFOW di = new DOCINFOW();
        di.pDocName = docName;
        di.pDataType = "RAW";
        bool bSuccess = false;
        try {
            if (StartDocPrinter(hPrinter, 1, di)) {
                try {
                    if (StartPagePrinter(hPrinter)) {
                        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                        try {
                            Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                            int dwWritten = 0;
                            bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                        } finally {
                            Marshal.FreeCoTaskMem(pUnmanagedBytes);
                        }
                        EndPagePrinter(hPrinter);
                    }
                } finally {
                    EndDocPrinter(hPrinter);
                }
            }
        } finally {
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }
}
"@ -ErrorAction SilentlyContinue

try {
    [byte[]]$bytes = $null
    if ($FilePath -and (Test-Path $FilePath)) {
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    } elseif ($Text) {
        # Default ASCII / Windows-1252 for ESC/P
        $bytes = [System.Text.Encoding]::GetEncoding("windows-1252").GetBytes($Text)
    } else {
        throw "Either -FilePath or -Text must be specified"
    }

    $ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes, $DocName)
    if ($ok) {
        Write-Output "SUCCESS"
    } else {
        Write-Error "SendBytesToPrinter returned false"
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

