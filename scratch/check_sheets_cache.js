const fs = require('fs');
const path = require('path');

async function check() {
    const configText = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
    const match = configText.match(/GOOGLE_SCRIPT_URL:\s*"([^"]+)"/);
    const scriptUrl = match[1];

    const res = await fetch(scriptUrl + '?action=sync');
    const d = await res.json();
    console.log('SYNC_STATE:', JSON.stringify(d.sync_state, null, 2));

    const regs = ['112915', '188836', '112747', '188748', '112732', '188762', '188759', '188847', '112809'];
    regs.forEach(r => {
        const c = d.scan_cache.find(x => x.registration_number === r || x.registration_number === r.padStart(6, '0') || x.registration_number === r.replace(/^0+/, ''));
        if (c) {
            console.log(`[${r}] Loc: "${c.location}" | Status: "${c.status}" | Co: "${c.company_name}" | Doc: ${c.document_type} ${c.document_number}`);
        } else {
            console.log(`[${r}] NOT IN CACHE`);
        }
    });
}

check().catch(console.error);
