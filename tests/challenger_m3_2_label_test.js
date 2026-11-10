/**
 * Test label association in Ant Design form items without `for` attribute
 */
const { JSDOM } = require('jsdom');
const { loadContentScriptFunctions } = require('./e2e/helpers/dom_env');

function testAntDesignLabelWithoutFor() {
    console.log('--- Testing Ant Design Label without for attribute ---');
    const html = `
    <!DOCTYPE html>
    <html><body>
        <div class="ant-card">
            <div class="ant-card-head"><div class="ant-card-head-title">Pengirim</div></div>
            <div class="ant-card-body">
                <div class="ant-form-item">
                    <div class="ant-form-item-label">
                        <label>Nama Pengirim</label>
                    </div>
                    <div class="ant-form-item-control">
                        <!-- Input has no id matching for, and no placeholder/name with 'nama' -->
                        <input class="ant-input" />
                    </div>
                </div>
            </div>
        </div>
    </body></html>
    `;

    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://ceisa40.beacukai.go.id/pib' });
    loadContentScriptFunctions(dom.window);

    const card = dom.window.document.querySelector('.ant-card');
    const input = dom.window.findFieldByKeywords(['nama'], card);
    console.log('Found input without for attribute:', !!input);
    return !!input;
}

testAntDesignLabelWithoutFor();
