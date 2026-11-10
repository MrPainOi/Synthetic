#!/usr/bin/env node
/**
 * CEISA 4.0 E2E Master Test Runner
 * Executes all 4 tiers of tests and outputs feature coverage matrix.
 *
 * Usage:
 *   node tests/e2e/run_tests.js
 *   node tests/e2e/run_tests.js --tier=1
 *   node tests/e2e/run_tests.js --feature=F1
 *   node tests/e2e/run_tests.js --summary
 */
const path = require('path');
const { defaultHarness } = require('./helpers/test_framework');

// Parse CLI flags
const args = process.argv.slice(2);
const tierFilter = args.find(a => a.startsWith('--tier='))?.split('=')[1];
const featureFilter = args.find(a => a.startsWith('--feature='))?.split('=')[1];
const summaryOnly = args.includes('--summary');
const allowPending = args.includes('--allow-pending') || args.includes('--baseline');

// Load test suites
require('./tier1_feature.test');
require('./tier2_boundary.test');
require('./tier3_integration.test');
require('./tier4_scenarios.test');

async function main() {
    console.log('='.repeat(80));
    console.log('  CEISA 4.0 - E2E AUTOMATED TEST SUITE RUNNER');
    console.log('  Opaque-Box Requirement-Driven Verification (Tiers 1-4)');
    console.log('='.repeat(80));

    // Filter tests if requested
    if (tierFilter) {
        const tNum = parseInt(tierFilter, 10);
        defaultHarness.tests = defaultHarness.tests.filter(t => t.tier === tNum);
        console.log(`[FILTER] Running Tier ${tNum} only (${defaultHarness.tests.length} tests)`);
    }
    if (featureFilter) {
        const allowedFeatures = featureFilter.split(',').map(s => s.trim());
        defaultHarness.tests = defaultHarness.tests.filter(t => allowedFeatures.includes(t.feature));
        console.log(`[FILTER] Running Features [${allowedFeatures.join(', ')}] only (${defaultHarness.tests.length} tests)`);
    }

    console.log(`\nDiscovered ${defaultHarness.tests.length} test cases. Executing...\n`);

    const results = await defaultHarness.run();

    // Grouping by Tier and Feature
    const tierStats = { 1: { pass: 0, fail: 0 }, 2: { pass: 0, fail: 0 }, 3: { pass: 0, fail: 0 }, 4: { pass: 0, fail: 0 } };
    const featureStats = {};
    for (let i = 1; i <= 16; i++) {
        featureStats[`F${i}`] = { pass: 0, fail: 0, total: 0 };
    }

    const failures = [];

    for (const r of results) {
        if (r.tier && tierStats[r.tier]) {
            if (r.status === 'PASSED') tierStats[r.tier].pass++;
            else tierStats[r.tier].fail++;
        }

        if (r.feature && featureStats[r.feature]) {
            featureStats[r.feature].total++;
            if (r.status === 'PASSED') featureStats[r.feature].pass++;
            else featureStats[r.feature].fail++;
        }

        if (r.status === 'FAILED') {
            failures.push(r);
        }

        if (!summaryOnly) {
            const icon = r.status === 'PASSED' ? '✓' : '✗';
            const statusColor = r.status === 'PASSED' ? '\x1b[32m' : '\x1b[31m';
            const reset = '\x1b[0m';
            console.log(`  ${statusColor}${icon}${reset} [${r.id}] ${r.name} (${r.durationMs}ms)`);
            if (r.status === 'FAILED') {
                console.log(`     \x1b[31mError:\x1b[0m ${r.error?.message || r.error}`);
            }
        }
    }

    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const failedCount = results.filter(r => r.status === 'FAILED').length;
    const totalCount = results.length;
    const passRate = totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(80));
    console.log('  TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`  Total Tests  : ${totalCount}`);
    console.log(`  Passed       : \x1b[32m${passedCount}\x1b[0m`);
    console.log(`  Failed       : \x1b[31m${failedCount}\x1b[0m`);
    console.log(`  Pass Rate    : ${passRate}%\n`);

    console.log('  Breakdown by Tier:');
    console.log('  -------------------------------------------------------------');
    for (const [t, s] of Object.entries(tierStats)) {
        const total = s.pass + s.fail;
        if (total > 0) {
            console.log(`    Tier ${t} : ${s.pass}/${total} passed (${((s.pass / total) * 100).toFixed(1)}%)`);
        }
    }

    console.log('\n  Breakdown by Feature (F1-F16):');
    console.log('  -------------------------------------------------------------');
    for (let i = 1; i <= 16; i++) {
        const fKey = `F${i}`;
        const f = featureStats[fKey];
        if (f.total > 0) {
            const statusLabel = f.fail === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mPENDING/FAIL\x1b[0m';
            console.log(`    ${fKey.padEnd(5)} : ${f.pass.toString().padStart(2)}/${f.total.toString().padEnd(2)} passed [${statusLabel}]`);
        }
    }

    if (failures.length > 0) {
        console.log('\n' + '-'.repeat(80));
        console.log(`  FAILURES / PENDING FEATURES LIST (${failures.length} items):`);
        console.log('-'.repeat(80));
        failures.forEach((f, idx) => {
            console.log(`  ${idx + 1}. [${f.id}] (${f.feature || 'Global'}) ${f.name}`);
            console.log(`     Error: ${f.error?.message || f.error}\n`);
        });
    }

    console.log('='.repeat(80));

    if (failedCount > 0 && !allowPending) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Fatal Runner Error:', err);
    process.exit(1);
});
