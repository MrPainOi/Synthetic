const fs = require('fs');

const content = fs.readFileSync('pib.html', 'utf8');
const lines = content.split('\n');

console.log('Searching for hidden elements or legacy inputs in pib.html...');
lines.forEach((l, i) => {
    const lower = l.toLowerCase();
    if (lower.includes('display:none') || lower.includes('display: none') || lower.includes('type="hidden"') || lower.includes('visibility: hidden') || lower.includes('opacity: 0')) {
        if (lower.includes('pib') || lower.includes('ppjk') || lower.includes('entitas') || lower.includes('topbar') || lower.includes('supplier') || lower.includes('importir')) {
            console.log(`Line ${i+1}: ${l.trim()}`);
        }
    }
});
