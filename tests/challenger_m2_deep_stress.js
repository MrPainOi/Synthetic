/**
 * Challenger 2 Deep Stress & Invariant Harness
 * Author: Empirical Challenger
 */

const path = require('path');
const assert = require('assert');
const { loadPibDom, loadPibDashboardScript } = require('./e2e/helpers/dom_env');

const testResults = [];
function record(name, pass, details = '') {
    testResults.push({ name, pass, details });
    const symbol = pass ? ' PASS ' : ' FAIL ';
    console.log(`[${symbol}] ${name}${details ? ' - ' + details : ''}`);
}

async function runDeepStressSuite() {
    console.log('======================================================================');
    console.log('CHALLENGER 2 DEEP STRESS & INVARIANT HARNESS: MILESTONE 2');
    console.log('======================================================================\n');

    const { window, document } = loadPibDom();
    loadPibDashboardScript(window);
    window.setupPibCopyHandlers();

    // 1. Idempotency of setupPibCopyHandlers
    let clickCount = 0;
    const pembeliNameEl = document.getElementById('pibPembeliName');
    pembeliNameEl.addEventListener('input', () => { clickCount++; });

    // Call setup 5 more times
    for (let i = 0; i < 5; i++) {
        window.setupPibCopyHandlers();
    }
    document.getElementById('btnCopyPenerimaToPembeli').click();
    record('setupPibCopyHandlers() is strictly idempotent (no duplicate event listeners)', clickCount === 1, `Triggered ${clickCount} times`);

    // 2. Unicode and Emoji resilience
    const unicodePayload = {
        entitas: {
            pengirim: {
                nama: "🌟 北京自动化科技 (Beijing Automation) & Co. 🚀",
                alamat: "北京市朝阳区建国路88号 / No. 88 Jianguo Rd, Chaoyang, Beijing 🇨🇳",
                negara: "CN - CHINA",
                nomorIdentitas: "CN-998877",
                jenisIdentitas: "4 - LAINNYA"
            },
            penerima: {
                nama: "PT. INDO GLOBAL JAYA 🇮🇩 (Cabang Batam)",
                alamat: "Kompleks Pergudangan Batamindo Blok D-10, Muka Kuning, Batam",
                negara: "ID - INDONESIA",
                nomorIdentitas: "0100011122233344",
                nitku: "0100011122233344000000",
                jenisIdentitas: "6 - NPWP 16 DIGIT",
                status: "LAINNYA"
            }
        }
    };
    window.loadPibDraftData(unicodePayload, false);
    record('Unicode and emojis in company name preserved in DOM', 
        document.getElementById('pibPengirimName').value === unicodePayload.entitas.pengirim.nama);
    record('Unicode and emojis in address preserved in DOM', 
        document.getElementById('pibPengirimAddress').value === unicodePayload.entitas.pengirim.alamat);

    const unicodeCollected = window.collectPibFormData();
    record('Unicode and emojis preserved through collectPibFormData()', 
        unicodeCollected.entitas.pengirim.nama === unicodePayload.entitas.pengirim.nama);

    // 3. Downstream Pungutan calculation does not throw with modernized entity fields
    let calcError = null;
    try {
        if (typeof window.calculatePibPungutan === 'function') {
            window.calculatePibPungutan();
        }
    } catch (e) {
        calcError = e;
    }
    record('calculatePibPungutan() executes cleanly with modernized 6-card form', !calcError, calcError?.message);

    // 4. Sinar Asia rule validation
    // 4.1 Sinar Asia in importer -> Golden Ben Singapore shipper
    window.loadPibDraftData({
        importirName: 'PT. Sinar Asia Chemicals',
        importirAddress: 'Jl. Raya Industri Batam',
        importirId: '0123456789012345'
    }, false);
    record('Sinar Asia rule: auto-sets penerima to "PT. SINAR ASIA PACK"', 
        document.getElementById('pibPenerimaName').value === 'PT. SINAR ASIA PACK');
    record('Sinar Asia rule: auto-sets pengirim to "GOLDEN BEN PRINTER PTE LTD"', 
        document.getElementById('pibPengirimName').value === 'GOLDEN BEN PRINTER PTE LTD');
    record('Sinar Asia rule: auto-sets pengirim country to "SG - SINGAPORE"', 
        document.getElementById('pibPengirimCountry').value === 'SG - SINGAPORE');

    // 4.2 Non-Sinar Asia importer -> preserves original shipper
    window.loadPibDraftData({
        penerimaName: 'PT. KARYA ABADI TEKNIK',
        pengirimName: 'TOKYO SEIMITSU CO., LTD.',
        pengirimCountry: 'JP - JAPAN'
    }, false);
    record('Non-Sinar Asia importer preserves original shipper name', 
        document.getElementById('pibPengirimName').value === 'TOKYO SEIMITSU CO., LTD.');
    record('Non-Sinar Asia importer preserves original shipper country', 
        document.getElementById('pibPengirimCountry').value === 'JP - JAPAN');

    // 5. Mixed type values (numbers instead of strings in numeric fields)
    window.loadPibDraftData({
        entitas: {
            pengirim: { nama: 1234567, nomorIdentitas: 998877 },
            penerima: { nomorIdentitas: 8307272510850000, nitku: 8307272510850000000000 }
        }
    }, false);
    record('Numeric types coerced to string without throwing TypeError', 
        document.getElementById('pibPengirimName').value === '1234567');
    record('Numeric identity number coerced to string correctly', 
        document.getElementById('pibPenerimaId').value === '8307272510850000');

    // 6. Header stepper button to Entitas
    const btnNextHeader = document.getElementById('btnNextFromPibHeader');
    record('btnNextFromPibHeader exists in Header tab', !!btnNextHeader);
    if (btnNextHeader) {
        window.switchPibTab('pib-tab-header');
        btnNextHeader.click();
        record('Clicking btnNextFromPibHeader navigates to #pib-tab-entitas', 
            document.getElementById('pib-tab-entitas').classList.contains('active'));
    }

    console.log('\n======================================================================');
    console.log('DEEP STRESS TEST RESULTS SUMMARY');
    console.log('======================================================================');
    const total = testResults.length;
    const passed = testResults.filter(r => r.pass).length;
    const failed = testResults.filter(r => !r.pass).length;
    console.log(`Total: ${total}, Passed: ${passed}, Failed: ${failed}`);

    return { total, passed, failed };
}

if (require.main === module) {
    runDeepStressSuite().then(({ failed }) => {
        process.exit(failed > 0 ? 1 : 0);
    });
}

module.exports = { runDeepStressSuite };
