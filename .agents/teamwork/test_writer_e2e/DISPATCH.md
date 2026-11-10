# Dispatch: E2E Test Suite Writer (Dual Track)

## Context & Objectives
You are the E2E Testing Track Worker (`teamwork_test_writer`).
Read:
- `c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Synthetic\.agents\teamwork\PROJECT.md`

Your mission:
Design and implement an opaque-box, requirement-driven E2E test suite covering all 16 inventoried features across all 4 tiers:
- **Tier 1 - Feature Coverage (>=5 per feature)**: Happy path tests for Print Hub QR removal, PIB header removal, old PPJK card removal, 6 entity cards presence & fields, copy buttons, data collection, and auto-input mappings.
- **Tier 2 - Boundary & Corner Cases (>=5 per feature)**: Empty/blank fields, maximum length (e.g. 22-digit NITKU, 16-digit NPWP), special characters in names/addresses, null data in storage, and viewport responsiveness.
- **Tier 3 - Cross-Feature Combinations (pairwise coverage)**: Copying from Penerima to Pembeli then Pemilik; draft save then load; auto-input mapping from collected form data.
- **Tier 4 - Real-World Application Scenarios**: Complete flow from editing 6 entity cards in PIB -> saving draft -> reloading -> validating auto-input payload generation for CEISA 4.0; opening Print Hub and executing print workflow without errors.

## Test Infrastructure Requirements
1. Create `TEST_INFRA.md` at project root (or inside `.agents/teamwork/TEST_INFRA.md`) following the Project Pattern guidelines.
2. Implement automated runnable test scripts (e.g. Node.js scripts using JSDOM or Playwright / Puppeteer or automated headless DOM verification scripts in `tests/e2e/`).
3. Ensure the test runner can be executed with a single command (e.g. `node tests/e2e/run_tests.js`).
4. When all test cases are prepared and initial baseline tests are runnable, publish `TEST_READY.md` at project root with the test summary and execution instructions.

Deliver your handoff report to `c:\Synthetic\.agents\teamwork\test_writer_e2e\handoff.md`.


## 2026-11-10T04:28:22Z
You are the E2E Testing Track Writer. Read your task assignment at c:\Synthetic\.agents\teamwork\test_writer_e2e\DISPATCH.md, PROJECT.md at c:\Synthetic\.agents\teamwork\PROJECT.md, and ORIGINAL_REQUEST.md at c:\Synthetic\.agents\teamwork\ORIGINAL_REQUEST.md.
Design and implement the 4-tier opaque-box E2E test suite covering Print Hub QR removal, PIB header removal, CEISA 4.0 2-column 6-card Tab Entitas, copy actions, and auto-input mappings.
Create TEST_INFRA.md, runnable test scripts in tests/e2e/, execute the runner, and publish TEST_READY.md when ready.
Report handoff to c:\Synthetic\.agents\teamwork\test_writer_e2e\handoff.md.
