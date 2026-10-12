@echo off
chcp 65001 >nul
title CEISA Inspector - Push Update ke Semua Komputer
cd /d "%~dp0"

echo ================================================================
echo    CEISA INSPECTOR - PUBLIKASI PEMBARUAN (PUSH UPDATE)
echo ================================================================
echo.
echo Skrip ini akan:
echo 1. Menyimpan semua perubahan kode proyek ke Git
echo 2. Mengirim (push) commit ke GitHub branch SupabaseV2
echo 3. Menyiarkan sinyal update ke Google Sheets agar semua komputer
echo    karyawan otomatis memperbarui ekstensi mereka!
echo.
echo ================================================================

set "COMMIT_MSG="
set /p COMMIT_MSG="Masukkan catatan update (tekan Enter untuk default): "

if "%COMMIT_MSG%"=="" (
    set "COMMIT_MSG=Pembaruan sistem rutin (%date% %time%)"
)

echo.
echo [1/4] Menambahkan semua perubahan file (git add -A)...
git add -A

echo [2/4] Membuat commit: "%COMMIT_MSG%"...
git commit -m "%COMMIT_MSG%"

echo [3/4] Mengunggah ke GitHub (git push origin SupabaseV2)...
git push origin SupabaseV2
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Gagal melakukan git push. Pastikan koneksi internet aktif.
    pause
    exit /b 1
)

echo [4/4] Memperbarui version.json dan menyiarkan sinyal update...
node -e "
const fs = require('fs');
const { execSync } = require('child_process');

try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const vFile = 'version.json';
    let vData = { version: '2.1.0', branch: 'SupabaseV2' };
    if (fs.existsSync(vFile)) {
        try { vData = JSON.parse(fs.readFileSync(vFile, 'utf8')); } catch (_) {}
    }
    vData.commit = sha;
    vData.updated_at = new Date().toISOString();
    fs.writeFileSync(vFile, JSON.stringify(vData, null, 2), 'utf8');

    // Broadcast ke Google Apps Script
    const configText = fs.readFileSync('config.js', 'utf8');
    const match = configText.match(/GOOGLE_SCRIPT_URL:\s*\"([^\"]+)\"/);
    if (match) {
        const url = match[1];
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'publish_update',
                commit: sha,
                version: vData.version,
                message: process.env.COMMIT_MSG || 'Pembaruan sistem',
                branch: 'SupabaseV2'
            })
        }).then(r => r.json()).then(res => {
            console.log('       [OK] Sinyal update berhasil disiarkan ke Google Sheets!');
        }).catch(err => {
            console.log('       [PERINGATAN] Gagal kirim sinyal ke Google Sheets:', err.message);
        });
    }
} catch (e) {
    console.error('Error post-update:', e.message);
}
"

echo.
echo ================================================================
echo    [BERHASIL] UPDATE SELESAI DIPUBLIKASIKAN!
echo ================================================================
echo Semua komputer rekan Anda akan otomatis menerima pembaruan ini
echo saat mereka membuka dashboard atau melakukan sinkronisasi data.
echo.
pause
exit /b 0
