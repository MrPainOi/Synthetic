const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const contentJs = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');

console.log('Running Reviewer 1 Adversarial Tests...');

// Test 1: Verify Disambiguation with Action Buttons
{
  const html = `
  <div id="container">
    <div class="ant-card">
      <div class="ant-card-head"><div class="ant-card-head-wrapper"><div class="ant-card-head-title">Pemilik Barang</div><div class="ant-card-extra"><button>Salin Penerima</button></div></div></div>
      <div class="ant-card-body"><input name="nama" id="ceisa_pemilik_nama" /></div>
    </div>
    <div class="ant-card">
      <div class="ant-card-head"><div class="ant-card-head-wrapper"><div class="ant-card-head-title">Penerima</div></div></div>
      <div class="ant-card-body"><input name="nama" id="ceisa_penerima_nama" /></div>
    </div>
  </div>`;
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const win = dom.window;
  win.chrome = {
    runtime: { getURL: () => '', onMessage: { addListener: () => {} }, sendMessage: () => {} },
    storage: { local: { get: (k, cb) => { if (cb) cb({}); return Promise.resolve({}); }, set: (o, cb) => { if (cb) cb(); return Promise.resolve(); } }, onChanged: { addListener: () => {} } }
  };
  win.eval(contentJs);
  const card = win.findCeisaCard('penerima', win.document.getElementById('container'));
  assert.ok(card, 'Card penerima must be found');
  const matchedTitle = card.querySelector('.ant-card-head-title').textContent.trim();
  console.log('Test 1 Matched Title:', matchedTitle);
  assert.strictEqual(matchedTitle, 'Penerima', 'Expected card title to be Penerima');
  console.log('✓ Test 1: Penerima card disambiguation passed');
}

// Test 2: Verify Select Option Matching with Blank Placeholder
{
  const html = `<select id="sel"><option value="">-- Pilih --</option><option value="ID">INDONESIA</option><option value="CN">CHINA</option></select>`;
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const win = dom.window;
  win.chrome = {
    runtime: { getURL: () => '', onMessage: { addListener: () => {} }, sendMessage: () => {} },
    storage: { local: { get: (k, cb) => { if (cb) cb({}); return Promise.resolve({}); }, set: (o, cb) => { if (cb) cb(); return Promise.resolve(); } }, onChanged: { addListener: () => {} } }
  };
  win.eval(contentJs);
  const sel = win.document.getElementById('sel');
  win.setNativeInputValue(sel, 'CHINA');
  console.log('Test 2 Select Value:', sel.value);
  assert.strictEqual(sel.value, 'CN', 'Expected select value to be CN');
  console.log('✓ Test 2: Select option matching with blank placeholder passed');
}

console.log('Reviewer 1 Adversarial Tests Passed Successfully!');
process.exit(0);
