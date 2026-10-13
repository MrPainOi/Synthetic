const fs = require('fs');
const path = require('path');

async function check() {
    const configText = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
    const match = configText.match(/GOOGLE_SCRIPT_URL:\s*"([^"]+)"/);
    const scriptUrl = match[1];

    const res = await fetch(scriptUrl + '?action=sync_mirror');
    const data = await res.json();
    console.log('Sync mirror result:');
    console.log('State rows count:', data.state ? data.state.length : 0);
    console.log('Scan cache count:', data.scan_cache ? data.scan_cache.length : 0);
    if (data.scan_cache) {
        console.log('\n--- SAMPLE CACHE ITEMS ---');
        data.scan_cache.slice(0, 30).forEach(c => {
            console.log(`Reg: ${c.registration_number} | Type: ${c.document_type} | Status: ${c.status} | Loc: "${c.location}" | Company: "${c.company_name}" | Date: ${c.row_date}`);
        });
    }
}

check().catch(console.error);
