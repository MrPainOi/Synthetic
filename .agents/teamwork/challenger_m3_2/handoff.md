# Handoff Report — Milestone 3 Challenger 2 (Empirical Adversarial Review)

**Author**: Challenger 2 (`challenger_m3_2`)  
**Role**: Empirical Challenger (`critic`, `specialist`)  
**Date**: 2026-11-10T06:10:00Z  
**Verdict**: **REQUEST_CHANGES**  
**Target Milestone**: Milestone 3 (CEISA 4.0 Auto-Input Content Script Integration)  
**File Reviewed**: `c:\Synthetic\content.js`  

---

## 1. Observation

Adversarial testing was conducted on `content.js` across four dimensions:
1. Non-regression in existing sections (`dokumen`, `barang`, `header`, `pengangkut`, `kemasan`, `transaksi`, `pungutan`).
2. Polymorphic invocation signatures (Chrome message object, test harness parameters, dispatch parameters, payload object, boundary values).
3. Edge-case data payloads (Unicode, German/French/Spanish special characters, multiline strings, missing optional fields, non-string numbers).
4. Realistic CEISA 4.0 production DOM structures (standard Ant Design cards with header copy buttons, without mock `.card-*` CSS helper classes).

### 1.1 Confirmed Bug 1 (CRITICAL): `findCeisaCard('penerima')` Collides with Card Pemilik Barang; Penerima Left Blank
- **File**: `content.js`, lines 1876–1890:
  ```javascript
  const cardSelectors = '.ant-card, .card, .ceisa-form-card, fieldset, .ceisa-card, [class*="card"]';
  const candidates = Array.from(container.querySelectorAll(cardSelectors));

  for (const c of candidates) {
      const header = c.querySelector('.ant-card-head, .ant-card-head-title, .card-header, .ceisa-card-title, .card-title, h4, h5, h6, legend');
      if (header) {
          const txt = (header.innerText || header.textContent || '').trim();
          if (regex && regex.test(txt)) {
              if (cardKey.includes('penerima') && /pembeli/i.test(txt)) continue;
              if (cardKey.includes('pembeli') && /penerima/i.test(txt) && !/pembeli/i.test(txt)) continue;
              if (cardKey.includes('pengirim') && /penjual/i.test(txt)) continue;
              if (cardKey.includes('penjual') && /pengirim/i.test(txt) && !/penjual/i.test(txt)) continue;
              return c;
          }
      }
  }
  ```
- **Direct Observation**:
  - In standard CEISA 4.0 Ant Design card structure, `.ant-card-head` contains the title (`.ant-card-head-title`) AND the action buttons (`.ant-card-extra`).
  - Card 3 (Pemilik Barang) contains the button `"Salin Penerima"`.
  - Because `.ant-card-head` is selected before `.ant-card-head-title` in `c.querySelector(...)`, `txt` becomes `"Pemilik Barang Salin Penerima"`.
  - When `findCeisaCard('penerima', container)` executes, `cardKey` is `'penerima'`, and `regex` matches `'penerima'` due to the button label `"Salin Penerima"`.
  - Line 1884 only excludes `/pembeli/`: `if (cardKey.includes('penerima') && /pembeli/i.test(txt)) continue;`. It completely omits checking for `/pemilik/`!
  - Because Card 3 (Pemilik Barang, in column 1) is traversed before Card 4 (Penerima, in column 2), `findCeisaCard('penerima', container)` returns Card 3 (Pemilik Barang).
  - Consequently, Card 3 is filled with Penerima data, then overwritten with Pemilik data, while Card 4 (Penerima) is **NEVER filled** (its inputs remain completely blank).
- **Reproduction**:
  - Test command: `node tests/challenger_m3_2_card_collision_test.js`
  - Verbatim output:
    ```
    findCeisaCard("penerima") title: Pemilik Barang
    Pengirim Nama value: SHANGHAI TRADING CO
    Pembeli Nama value: PT PEMBELI NUSANTARA
    Pemilik Nama value: PT CARGO OWNER
    Penerima Nama value: ""
    Penjual Nama value: SHANGHAI SELLER CORP
    PPJK Nama value: PT PPJK MITRA UTAMA
    Penerima correctly filled: false
    BUG CONFIRMED: Penerima card was NOT filled! Actual value is: ""
    ```
- **Why E2E Suite Didn't Catch It**:
  - `tests/e2e/helpers/dom_env.js:160-318` used artificial helper classes `.card-pengirim`, `.card-penerima`, etc. which hit the shortcut in line 1871, and omitted the `"Salin Penerima"` button from the mock DOM. Real CEISA 4.0 does not have these helper classes.

### 1.2 Confirmed Bug 2 (CRITICAL): Unconditional `.ant-modal-content` Selector Diverts Auto-Input to Hidden Modals
- **File**: `content.js`, line 1753:
  ```javascript
  const openModal = document.querySelector(".ant-modal-wrap:not([style*='display: none']) .ant-modal, .ant-modal-content, .ant-drawer-content");
  ```
- **Direct Observation**:
  - The selector contains `, .ant-modal-content` as an unconditional comma-separated branch.
  - If any closed modal exists in the CEISA 4.0 DOM (e.g. `<div class="ant-modal-wrap" style="display: none;"><div class="ant-modal-content">...</div></div>`), `document.querySelector(".ant-modal-content")` matches it regardless of the wrapper's `display: none` style.
  - `findCeisaTargetContainer()` returns the hidden modal instead of the active tab pane.
  - Auto-input looks for form inputs inside the hidden modal, finds nothing, and leaves all real form inputs on the active tab blank.
- **Reproduction**:
  - Test command: `node tests/challenger_m3_2_modal_test.js`
  - Verbatim output:
    ```
    Auto input result: { ok: true, message: '... (Form terdeteksi, pastikan tab Entitas aktif di CEISA).' }
    Input in active tab filled: ""
    Successfully filled active tab despite hidden modal: false
    ```

### 1.3 Confirmed Bug 3 (MEDIUM): `lbl.closest()` Trapped in Intermediate `div`
- **File**: `content.js`, line 1792:
  ```javascript
  const formItem = lbl.closest(".ant-form-item, .form-group, .row, .col, div");
  ```
- **Direct Observation**:
  - Including `div` causes `lbl.closest(...)` to stop at the immediate label wrapper `<div class="ant-form-item-label">`.
  - That wrapper does not contain the input (the input is inside sibling `<div class="ant-form-item-control">`).
  - When CEISA form inputs lack an explicit `for` / `id` link, `findFieldByKeywords` fails to locate the input.
- **Reproduction**:
  - Test command: `node tests/challenger_m3_2_label_test.js`
  - Verbatim output: `Found input without for attribute: false`.

---

## 2. Logic Chain

1. **Bug 1 Chain**:
   - Observation: CEISA 4.0 original portal Tab Entitas layout defines Card 3 as "Pemilik Barang" with button "Salin Penerima", and Card 4 as "Penerima" (see `ORIGINAL_REQUEST.md:36`, screenshot `media_1794282977653_5e8008e4.png`).
   - Observation: In standard Ant Design, `c.querySelector('.ant-card-head, .ant-card-head-title, ...')` resolves to `.ant-card-head`, which concatenates title and button texts.
   - Observation: `findCeisaCard('penerima')` regex matches `"Salin Penerima"` in Card 3.
   - Observation: Disambiguation filter only checks `/pembeli/`, failing to check `/pemilik/`.
   - Inevitable Result: Card 3 is returned as Card Penerima. Penerima data overwrites Pemilik Barang temporarily, is subsequently overwritten by Pemilik Barang data, and Card 4 (Penerima) is never populated.
   - Impact: Critical customs declaration corruption. Importer/Penerima is left completely empty on CEISA portal submission.

2. **Bug 2 Chain**:
   - Observation: Standard Ant Design portals retain closed modals in the DOM with `.ant-modal-wrap style="display: none"`.
   - Observation: `findCeisaTargetContainer()` evaluates `.ant-modal-content` unconditionally.
   - Inevitable Result: `openModal` resolves to the hidden modal. Container is set to the hidden modal instead of the active tab.
   - Impact: Critical portal-wide auto-input failure on any page where a modal has been opened and closed.

3. **Bug 3 Chain**:
   - Observation: In `.ant-form-item`, `<label>` is nested in `<div class="ant-form-item-label">` while `<input>` is in sibling `<div class="ant-form-item-control">`.
   - Observation: `lbl.closest(".ant-form-item, ..., div")` immediately matches the parent `<div class="ant-form-item-label">`.
   - Inevitable Result: `formItem.querySelector('input')` evaluates to `null`.
   - Impact: Fallback label-based input resolution fails whenever `for` / `id` mapping is missing.

---

## 3. Caveats

- **No regressions in other sections**: Auto-input for sections `dokumen`, `barang`, `header`, `pengangkut`, `kemasan`, `transaksi`, and `pungutan` remained functional and passed all empirical checks.
- **Polymorphic signatures**: All four parameter invocation signatures and error handlings are properly implemented.
- **Payload edge cases**: Unicode (Chinese, Japanese, Emojis), foreign supplier special characters, multiline addresses, and numeric coercions operate correctly when the card and container are correctly resolved.

---

## 4. Conclusion

Verdict: **REQUEST_CHANGES**.

While baseline opaque tests in `run_tests.js` passed due to artificial CSS helper classes in `dom_env.js`, adversarial inspection against real CEISA 4.0 portal DOM revealed two critical bugs and one medium bug in `content.js` that break auto-input in production.

### Required Changes for `worker_m3` in `c:\Synthetic\content.js`:

1. **Fix `findCeisaCard` (lines 1876–1906)**:
   - Prioritize title elements over header wrappers:
     Query `.ant-card-head-title, .ceisa-card-title, .card-title, h4, h5, h6, legend` BEFORE `.ant-card-head, .card-header`.
   - Add `/pemilik/` exclusion for `penerima`:
     ```javascript
     if (cardKey.includes('penerima') && (/pembeli/i.test(txt) || /pemilik/i.test(txt))) continue;
     ```
   - Update fallback loop (line 1900) with the same `/pemilik/` check.

2. **Fix `findCeisaTargetContainer` (line 1753)**:
   - Ensure `.ant-modal-content` is properly scoped to an active/visible modal wrapper:
     ```javascript
     const openModal = document.querySelector(
         ".ant-modal-wrap:not([style*='display: none']):not(.ant-modal-wrap-close) .ant-modal-content, .ant-drawer:not([style*='display: none']) .ant-drawer-content"
     );
     ```

3. **Fix `findFieldByKeywords` (line 1792)**:
   - Remove `div` from `lbl.closest()` so it walks up to the actual form item container:
     ```javascript
     const formItem = lbl.closest(".ant-form-item, .form-group, .row, tr");
     ```

---

## 5. Verification Method

To independently verify these findings and confirm fixes:

1. **Card Collision Test**:
   ```powershell
   node c:\Synthetic\tests\challenger_m3_2_card_collision_test.js
   ```
   *Expected with bug*: `BUG CONFIRMED: Penerima card was NOT filled! Actual value is: ""`  
   *Expected after fix*: `isPenerimaCorrect: true`, `Penerima correctly filled: true`

2. **Hidden Modal Target Test**:
   ```powershell
   node c:\Synthetic\tests\challenger_m3_2_modal_test.js
   ```
   *Expected with bug*: `Successfully filled active tab despite hidden modal: false`  
   *Expected after fix*: `Successfully filled active tab despite hidden modal: true`

3. **Label Association Test**:
   ```powershell
   node c:\Synthetic\tests\challenger_m3_2_label_test.js
   ```
   *Expected with bug*: `Found input without for attribute: false`  
   *Expected after fix*: `Found input without for attribute: true`

4. **Master Adversarial Verification Suite (41 tests)**:
   ```powershell
   node c:\Synthetic\tests\challenger_m3_2_comprehensive_adversarial.js
   ```
   *Expected with bug*: 39 passed, 2 failed.  
   *Expected after fix*: 41/41 passed (100.0%).

5. **Existing Regression Suite (175 tests)**:
   ```powershell
   node c:\Synthetic\tests\e2e\run_tests.js
   ```
   *Expected*: 175/175 passed (100.0%).
