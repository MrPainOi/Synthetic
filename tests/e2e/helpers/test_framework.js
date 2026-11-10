/**
 * Test Framework Harness for CEISA 4.0 E2E Test Suite
 * Provides test registration, assertion, reporting, and feature-level tracking.
 */
const assert = require('node:assert');

class TestSuiteHarness {
    constructor() {
        this.tests = [];
        this.results = [];
        this.currentSuite = '';
        this.currentTier = null;
        this.currentFeature = null;
    }

    setContext({ tier, feature }) {
        this.currentTier = tier;
        this.currentFeature = feature;
    }

    describe(name, fn) {
        const previousSuite = this.currentSuite;
        this.currentSuite = previousSuite ? `${previousSuite} > ${name}` : name;
        try {
            fn();
        } finally {
            this.currentSuite = previousSuite;
        }
    }

    test(name, fn, meta = {}) {
        const testCase = {
            id: meta.id || `TC-${this.tests.length + 1}`,
            name,
            suite: this.currentSuite,
            tier: meta.tier !== undefined ? meta.tier : this.currentTier,
            feature: meta.feature || this.currentFeature,
            fn
        };
        this.tests.push(testCase);
    }

    async run() {
        this.results = [];
        for (const t of this.tests) {
            const start = Date.now();
            const result = {
                id: t.id,
                name: t.name,
                suite: t.suite,
                tier: t.tier,
                feature: t.feature,
                durationMs: 0,
                status: 'PASSED',
                error: null
            };

            try {
                await t.fn();
                result.durationMs = Date.now() - start;
                result.status = 'PASSED';
            } catch (err) {
                result.durationMs = Date.now() - start;
                result.status = 'FAILED';
                result.error = err;
            }

            this.results.push(result);
        }
        return this.results;
    }

    clear() {
        this.tests = [];
        this.results = [];
    }
}

const defaultHarness = new TestSuiteHarness();

module.exports = {
    TestSuiteHarness,
    defaultHarness,
    assert,
    describe: (name, fn) => defaultHarness.describe(name, fn),
    test: (name, fn, meta) => defaultHarness.test(name, fn, meta),
    it: (name, fn, meta) => defaultHarness.test(name, fn, meta),
    setContext: (ctx) => defaultHarness.setContext(ctx)
};
