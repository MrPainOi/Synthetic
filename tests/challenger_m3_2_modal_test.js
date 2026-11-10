/**
 * Test findCeisaTargetContainer with a hidden Ant Design modal
 */
const { JSDOM } = require('jsdom');
const { loadContentScriptFunctions } = require('./e2e/helpers/dom_env');

function testHiddenModalTargetContainer() {
    console.log('--- Testing findCeisaTargetContainer with hidden modal in DOM ---');
    const html = `
    <!DOCTYPE html>
    <html><body>
        <!-- Hidden modal left in DOM by CEISA 4.0 -->
        <div class="ant-modal-wrap" style="display: none;">
            <div class="ant-modal-mask"></div>
            <div class="ant-modal">
                <div class="ant-modal-content">
                    <div class="ant-modal-header"><div class="ant-modal-title">Cari Dokumen</div></div>
                    <div class="ant-modal-body">
                        <input id="modal_search_input" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Active Tab Pane with CEISA Form -->
        <div class="ant-tabs-content">
            <div class="ant-tabs-tabpane ant-tabs-tabpane-active" id="active-tab-entitas">
                <div class="ant-card">
                    <div class="ant-card-head"><div class="ant-card-head-title">Pengirim</div></div>
                    <div class="ant-card-body">
                        <input name="nama" id="real_pengirim_nama" />
                    </div>
                </div>
            </div>
        </div>
    </body></html>
    `;

    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://ceisa40.beacukai.go.id/pib' });
    loadContentScriptFunctions(dom.window);

    // Call handleCeisaAutoInputRow via Chrome message signature (which uses findCeisaTargetContainer())
    const res = dom.window.handleCeisaAutoInputRow({
        type: 'CEISA_AUTO_INPUT_ROW',
        section: 'entitas',
        item: {
            entitas: {
                pengirim: { nama: 'TARGET TEST SHIPPER' }
            }
        }
    });

    console.log('Auto input result:', res);
    console.log('Input in active tab filled:', dom.window.document.getElementById('real_pengirim_nama').value);

    const isFilled = dom.window.document.getElementById('real_pengirim_nama').value === 'TARGET TEST SHIPPER';
    console.log('Successfully filled active tab despite hidden modal:', isFilled);
    return isFilled;
}

testHiddenModalTargetContainer();
