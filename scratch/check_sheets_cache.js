const fs = require('fs');
const path = require('path');

async function check() {
    const configText = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
    const match = configText.match(/GOOGLE_SCRIPT_URL:\s*"([^"]+)"/);
    const scriptUrl = match[1];

    const res = await fetch(scriptUrl + '?action=sync');
    const data = await res.json();
    console.log('Total items in cache:', data.scan_cache.length);
    
    // Cari item yang berpotensi rancu / salah klasifikasi
    const misclassified = [];
    data.scan_cache.forEach(c => {
        const loc = (c.location || '').toUpperCase();
        const status = c.status || '';
        const co = c.company_name || '';

        // Sewu tapi status merah/kuning/pink
        if ((loc.includes('SEWU') || loc.includes('SEKUPANG') || loc.includes('IDKSP')) && (status === 'red' || status === 'yellow' || status === 'pink')) {
            misclassified.push({ issue: 'SEWU tetapi status ' + status, reg: c.registration_number, type: c.document_type, doc: c.document_number, loc: c.location, status, co });
        }
        // Batu Ampar tapi status hijau/ungu/oren
        if ((loc.includes('BATU AMPAR') || loc.includes('IDBTU')) && (status === 'green' || status === 'purple' || status === 'orange')) {
            misclassified.push({ issue: 'BATU AMPAR tetapi status ' + status, reg: c.registration_number, type: c.document_type, doc: c.document_number, loc: c.location, status, co });
        }
    });

    console.log(`Ditemukan ${misclassified.length} item dengan potensi salah klasifikasi:`);
    misclassified.forEach((m, i) => {
        console.log(`[${i+1}] ${m.issue} | Reg: ${m.reg} | ${m.type} ${m.doc} | Loc: "${m.loc}" | Co: "${m.co}"`);
    });
}

check().catch(console.error);
