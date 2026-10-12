#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const PROJECT_ROOT = __dirname;

function bumpVersion(v) {
    if (!v) return '2.1.1';
    const parts = v.replace(/^v/i, '').trim().split('.');
    if (parts.length >= 3) {
        const patch = parseInt(parts[2], 10);
        return `${parts[0]}.${parts[1]}.${isNaN(patch) ? 1 : patch + 1}`;
    }
    return '2.1.1';
}

function promptMessage(defaultMsg) {
    return new Promise((resolve) => {
        if (!process.stdin.isTTY) {
            return resolve(defaultMsg);
        }
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Masukkan catatan update (tekan Enter untuk default): ', (answer) => {
            rl.close();
            const msg = answer && answer.trim() ? answer.trim() : defaultMsg;
            resolve(msg);
        });
    });
}

async function run() {
    console.log('================================================================');
    console.log('   CEISA INSPECTOR - PUBLIKASI PEMBARUAN (AUTO-INCREMENT)');
    console.log('================================================================\n');

    let argMsg = process.argv.slice(2).join(' ').trim();
    const defaultMsg = `Pembaruan sistem rutin (${new Date().toLocaleDateString('id-ID')})`;
    let commitMsg = argMsg || await promptMessage(defaultMsg);

    // 1. Baca versi saat ini & Naikkan versi otomatis
    const vFile = path.join(PROJECT_ROOT, 'version.json');
    const mFile = path.join(PROJECT_ROOT, 'manifest.json');

    let vData = { version: '2.1.1', branch: 'SupabaseV2' };
    if (fs.existsSync(vFile)) {
        try { vData = JSON.parse(fs.readFileSync(vFile, 'utf8')); } catch (_) {}
    }

    const oldVersion = vData.version || '2.1.0';
    const nextVersion = bumpVersion(oldVersion);

    vData.version = nextVersion;
    vData.updated_at = new Date().toISOString();
    fs.writeFileSync(vFile, JSON.stringify(vData, null, 2), 'utf8');

    if (fs.existsSync(mFile)) {
        try {
            const mData = JSON.parse(fs.readFileSync(mFile, 'utf8'));
            mData.version = nextVersion;
            fs.writeFileSync(mFile, JSON.stringify(mData, null, 4), 'utf8');
        } catch (_) {}
    }

    console.log(`\n[1/4] Versi ditingkatkan otomatis: v${oldVersion} -> v${nextVersion}`);

    // 2. Git add -A
    console.log('[2/4] Menambahkan semua perubahan ke Git (git add -A)...');
    execSync('git add -A', { cwd: PROJECT_ROOT, stdio: 'inherit' });

    const finalCommitMsg = `${commitMsg} (v${nextVersion})`;
    console.log(`[3/4] Membuat commit: "${finalCommitMsg}"...`);
    try {
        execSync(`git commit -m "${finalCommitMsg.replace(/"/g, '\\"')}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (_) {
        console.log('      (Catatan: tidak ada perubahan file baru untuk di-commit)');
    }

    console.log('[4/4] Mengunggah ke GitHub (git push origin SupabaseV2)...');
    try {
        execSync('git push origin SupabaseV2', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (err) {
        console.error('\n[ERROR] Gagal melakukan git push. Periksa koneksi internet.');
        process.exit(1);
    }

    // Ambil commit hash terbaru
    const sha = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
    vData.commit = sha;
    fs.writeFileSync(vFile, JSON.stringify(vData, null, 2), 'utf8');

    // 5. Broadcast ke Google Apps Script Web App
    console.log('\n[SYNC] Menyiarkan sinyal update ke Google Sheets...');
    let scriptUrl = 'https://script.google.com/macros/s/AKfycbyGBHuIkhsLawwQ1V48bKXmg8MXu35sc7iD91Re2We6mOsDvFm0uM8g6lnZxxKYfl0/exec';
    try {
        const configText = fs.readFileSync(path.join(PROJECT_ROOT, 'config.js'), 'utf8');
        const match = configText.match(/GOOGLE_SCRIPT_URL:\s*\"([^\"]+)\"/);
        if (match && match[1]) scriptUrl = match[1];
    } catch (_) {}

    try {
        const res = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'publish_update',
                commit: sha,
                version: nextVersion,
                message: finalCommitMsg,
                branch: 'SupabaseV2'
            })
        });
        const json = await res.json().catch(() => null);
        if (json && json.success) {
            console.log(`       [OK] Sinyal update berhasil disiarkan ke Google Sheets! (v${nextVersion} / ${sha.substring(0, 7)})`);
        } else {
            console.log('       [PERINGATAN] Respons Google Sheets:', json);
        }
    } catch (err) {
        console.warn('       [PERINGATAN] Gagal menyiarkan ke Google Sheets:', err.message);
    }

    console.log('\n================================================================');
    console.log(`   [BERHASIL] UPDATE v${nextVersion} SELESAI DIPUBLIKASIKAN!`);
    console.log('================================================================');
    console.log('Semua komputer rekan/karyawan akan otomatis mendeteksi versi');
    console.log(`v${nextVersion} saat mereka membuka dashboard atau melakukan sync.\n`);
}

if (require.main === module) {
    run().catch((err) => {
        console.error('Fatal Error:', err);
        process.exit(1);
    });
}

module.exports = { bumpVersion };
