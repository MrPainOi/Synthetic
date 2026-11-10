# Dispatch: Worker M3 Remediation (CEISA 4.0 Auto-Input Content Script Integration)

## Mission & Scope
You are the remediation Worker for Milestone 3.
Read:
- `c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Synthetic\.agents\teamwork\PROJECT.md`
- `c:\Synthetic\.agents\teamwork\challenger_m3_1\handoff.md`
- `c:\Synthetic\.agents\teamwork\challenger_m3_2\handoff.md`
- `c:\Synthetic\.agents\teamwork\reviewer_m3_1\handoff.md`

## Write Ownership
You exclusively own:
- `c:\Synthetic\content.js`
Do NOT modify any other files.

## Detailed Remediation Requirements
In `c:\Synthetic\content.js`:

### 1. Fix `findCeisaCard(target, container)` (Card Collision & Container Scope)
- **Isolate Card Title**: Look up the card title strictly inside title elements (`.ant-card-head-title, .card-title, .ceisa-card-title, h4, h5, h6, legend`). If `.ant-card-head` is used, clone the header or exclude `.ant-card-extra` and `button` elements so buttons like `"Salin Penerima"` do NOT contaminate the card title text!
- **Narrow Card Selectors**: Remove greedy `[class*="card"]` selector which erroneously matches outer wrappers like `.ceisa-cards-container`. Use specific selectors: `.ant-card, .card, .ceisa-form-card, .ceisa-entitas-card, fieldset`.
- **Add Strict Negative Guards**:
  * For `penerima`: `if (cardKey.includes('penerima') && (/pemilik/i.test(txt) || /pembeli/i.test(txt) || /salin\s*penerima/i.test(txt))) continue;`
  * For `pengirim`: `if (cardKey.includes('pengirim') && (/penjual/i.test(txt) || /salin\s*pengirim/i.test(txt))) continue;`
  * For `pembeli`: `if (cardKey.includes('pembeli') && /penerima/i.test(txt) && !/pembeli/i.test(txt)) continue;`
  * For `penjual`: `if (cardKey.includes('penjual') && /pengirim/i.test(txt) && !/penjual/i.test(txt)) continue;`

### 2. Fix `setNativeInputValue(element, val)` for `<select>` Elements
- In option matching:
  * Never match an option with `value === ""` or empty text via substring inclusion (`lowerStr.includes("")` is always true and breaks selects!).
  * Prioritize exact code/value match:
    1. Check exact `opt.value.toLowerCase() === lowerStr`
    2. Check exact `opt.text.toLowerCase() === lowerStr`
    3. Check prefix/code: `opt.text.toLowerCase().startsWith(lowerStr + ' ') || opt.text.toLowerCase().startsWith(lowerStr + '-') || opt.text.toLowerCase().startsWith(lowerStr + ':')`
    4. Only then check substring, but ensure words like "HUB" do not match "TAH - Tidak berhubungan" (e.g. check word boundary `\bHUB\b` or value equality).

### 3. Fix `findCeisaTargetContainer()` (Hidden Modal Hijacking)
- Replace line 1753:
  Do NOT use bare `, .ant-modal-content`.
  Only target visible modals:
  ```javascript
  const openModal = document.querySelector(".ant-modal-wrap:not([style*='display: none']) .ant-modal, .ant-modal-wrap:not([style*='display: none']) .ant-modal-content, .ant-drawer:not([style*='display: none']) .ant-drawer-content");
  ```

### 4. Fix `findFieldByKeywords(container, keywords)` (Label Traversal Trap)
- In line 1792:
  Remove bare `div` from `lbl.closest(...)`:
  ```javascript
  const formItem = lbl.closest(".ant-form-item, .form-group, .row, .col, fieldset");
  ```
  This allows label traversal to reach the true parent container containing the `<input>` / `<select>` / `<textarea>`.

## Verification Commands
1. Syntax check: `node -c c:\Synthetic\content.js`
2. Challenger 1 stress test: `node tests/e2e/challenger_m3_empirical_stress.js`
3. Challenger 2 adversarial suite: `node tests/challenger_m3_2_comprehensive_adversarial.js`
4. Reviewer 1 adversarial test: `node tests/reviewer_m3_1_adversarial.js`
5. Feature 16 test suite: `node tests/e2e/run_tests.js --feature=F16`
6. Master test suite: `node tests/e2e/run_tests.js` (All 175 tests must pass!)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Deliver your handoff report to `c:\Synthetic\.agents\teamwork\worker_m3_remediation\handoff.md`.


## 2026-11-10T06:12:30Z
[Message] timestamp=2026-11-10T06:12:30Z sender=f70416d4-7049-476a-94f7-853514b120c5 priority=MESSAGE_PRIORITY_HIGH content=You are the remediation Worker for Milestone 3 (CEISA 4.0 Auto-Input Integration in content.js).
Read your task assignment at c:\Synthetic\.agents\teamwork\worker_m3_remediation\DISPATCH.md, PROJECT.md at c:\Synthetic\.agents\teamwork\PROJECT.md, ORIGINAL_REQUEST.md at c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md, and challenger handoffs at c:\Synthetic\.agents\teamwork\challenger_m3_1\handoff.md, c:\Synthetic\.agents\teamwork\challenger_m3_2\handoff.md, and c:\Synthetic\.agents\teamwork\reviewer_m3_1\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Apply all 4 fixes to content.js (card title isolation, strict negative guards, select option matching with empty value guard, visible modal selector, and label closest selector).
Run all verification commands:
- node -c content.js
- node tests/e2e/challenger_m3_empirical_stress.js
- node tests/challenger_m3_2_comprehensive_adversarial.js
- node tests/reviewer_m3_1_adversarial.js
- node tests/e2e/run_tests.js --feature=F16
- node tests/e2e/run_tests.js
Deliver handoff report to c:\Synthetic\.agents\teamwork\worker_m3_remediation\handoff.md.
