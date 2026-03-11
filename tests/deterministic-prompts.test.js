/**
 * Deterministic Prompt System — Test Suite
 *
 * Tests that prove:
 *   1. Template interpolation is perfectly deterministic
 *   2. CSL confidence gates classify correctly at phi thresholds
 *   3. Drift detection fires at > 0.382 (1 - φ⁻¹)
 *   4. HALT prevents execution and emits reconfigure event
 *   5. Replay cache returns identical results
 *   6. Edge cases: missing vars, empty inputs, degenerate data
 *   7. Full executor pipeline with deterministic guarantees
 *
 * Run: npx jest tests/deterministic-prompts.test.js --verbose
 */

const { DeterministicPromptExecutor, DETERMINISTIC_LLM_PARAMS, REPLAY_THRESHOLD, PHI, PSI, PSI_SQ } = require('../src/prompts/deterministic-prompt-executor');
const { CSLConfidenceGate, TIERS, DRIFT_THRESHOLD } = require('../src/prompts/csl-confidence-gate');

// ─── Stub PromptManager ───────────────────────────────────────────────────────
// The production PromptManager uses backtick template literals that evaluate at
// require() time. We use a faithful stub that mimics its interpolation behavior
// (replacing ${var} placeholders) without triggering JS evaluation.

class StubPromptManager {
    constructor() {
        this._prompts = new Map();
        // Register test prompts using regular strings (not template literals)
        const testPrompts = [
            {
                id: 'code-001', domain: 'code', name: 'Code Review',
                description: 'Thorough code review',
                template: 'You are reviewing ${language} code.\n\nCode:\n${code}\n\nFocus: ${focus}\nStandards: ${standards}\n\nProvide: 1. Critical issues 2. Performance 3. Style 4. Line feedback 5. Rating',
                variables: ['language', 'code', 'focus', 'standards'],
                tags: ['review', 'quality'],
            },
            {
                id: 'code-002', domain: 'code', name: 'Bug Analysis',
                description: 'Diagnose a bug and propose a fix',
                template: 'Diagnose this ${language} bug.\n\nError: ${errorMessage}\nCode: ${code}\nStack: ${stackTrace}\n\nProvide: root cause, fix, prevention.',
                variables: ['language', 'errorMessage', 'code', 'stackTrace'],
                tags: ['debug', 'fix'],
            },
            {
                id: 'deploy-001', domain: 'deploy', name: 'Deployment Plan',
                description: 'Generate a deployment plan',
                template: 'Deploy ${serviceName} from ${currentVersion} to ${targetVersion} using ${strategy} on ${environment}.',
                variables: ['serviceName', 'environment', 'currentVersion', 'targetVersion', 'strategy'],
                tags: ['deployment', 'devops'],
            },
        ];
        for (const p of testPrompts) this._prompts.set(p.id, p);
        this._compositionLog = [];
    }

    getPrompt(id) {
        const p = this._prompts.get(id);
        if (!p) throw new Error(`Prompt not found: '${id}'. Use listPrompts() to see all IDs.`);
        return { ...p };
    }

    interpolate(promptOrId, vars = {}, opts = {}) {
        const { strict = true } = opts;
        const prompt = typeof promptOrId === 'string' ? this.getPrompt(promptOrId) : promptOrId;
        if (strict) {
            const missing = (prompt.variables || []).filter(v => !(v in vars));
            if (missing.length > 0) throw new Error(`Prompt '${prompt.id}' is missing required variables: ${missing.join(', ')}`);
        }
        let result = prompt.template;
        for (const [key, value] of Object.entries(vars)) {
            result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value != null ? String(value) : '');
        }
        return result;
    }

    listPrompts() {
        return Array.from(this._prompts.values()).map(({ id, domain, name, description, variables, tags }) => ({
            id, domain, name, description, variables, tags,
        }));
    }

    composePrompts(ids, varsByPrompt = {}, opts = {}) {
        const { separator = '\n\n---\n\n' } = opts;
        const sections = ids.map(id => {
            const prompt = this.getPrompt(id);
            const vars = varsByPrompt[id] || {};
            const content = this.interpolate(prompt, vars, { strict: false });
            return { id, name: prompt.name, domain: prompt.domain, content };
        });
        return { composed: sections.map(s => s.content).join(separator), sections, ids };
    }
}

// ─── 1. Template Interpolation Determinism ────────────────────────────────────

describe('Template Interpolation Determinism', () => {
    const pm = new StubPromptManager();

    test('same inputs produce identical output — 100 iterations', () => {
        const prompts = pm.listPrompts();
        for (const p of prompts) {
            const vars = {};
            p.variables.forEach(v => { vars[v] = `TEST_${v.toUpperCase()}`; });
            const baseline = pm.interpolate(p.id, vars);
            for (let i = 0; i < 100; i++) {
                expect(pm.interpolate(p.id, vars)).toBe(baseline);
            }
        }
    });

    test('different vars produce different output', () => {
        const a = pm.interpolate('code-001', { language: 'JavaScript', code: 'function a() {}', focus: 'bugs', standards: 'ESLint' });
        const b = pm.interpolate('code-001', { language: 'Python', code: 'def a(): pass', focus: 'security', standards: 'PEP8' });
        expect(a).not.toBe(b);
    });

    test('composition is deterministic', () => {
        const ids = ['code-001', 'code-002'];
        const varsByPrompt = {
            'code-001': { language: 'JS', code: 'x()', focus: 'perf', standards: 'ESLint' },
            'code-002': { language: 'JS', errorMessage: 'TypeError', code: 'y()', stackTrace: 'line 1' },
        };
        const a = pm.composePrompts(ids, varsByPrompt);
        const b = pm.composePrompts(ids, varsByPrompt);
        expect(a.composed).toBe(b.composed);
    });
});

// ─── 2. CSL Confidence Gate Thresholds ────────────────────────────────────────

describe('CSL Confidence Gate — Phi-Scaled Thresholds', () => {
    test('phi constants are correct', () => {
        expect(PHI).toBeCloseTo(1.618, 2);
        expect(PSI).toBeCloseTo(0.618, 2);
        expect(PSI_SQ).toBeCloseTo(0.382, 2);
    });

    test('EXECUTE threshold = φ⁻¹ ≈ 0.618', () => {
        expect(TIERS.EXECUTE).toBeCloseTo(PSI, 6);
    });

    test('CAUTIOUS threshold = φ⁻² ≈ 0.382', () => {
        expect(TIERS.CAUTIOUS).toBeCloseTo(PSI_SQ, 6);
    });

    test('fully-filled prompt → EXECUTE decision', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('code-001',
            { language: 'JavaScript', code: 'function test() {}', focus: 'bugs', standards: 'ESLint' },
            'A long interpolated prompt string that is well-formed and contains meaningful content for code review.'
        );
        expect(result.decision).toBe('EXECUTE');
        expect(result.confidence).toBeGreaterThanOrEqual(TIERS.EXECUTE);
    });

    test('partially-filled prompt → CAUTIOUS or lower', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('code-001',
            { language: 'JavaScript', code: '', focus: '', standards: '' },
            'Short.'
        );
        expect(['CAUTIOUS', 'HALT']).toContain(result.decision);
        expect(result.confidence).toBeLessThan(TIERS.EXECUTE);
    });

    test('unknown domain → lower confidence', () => {
        const gate = new CSLConfidenceGate();
        const good = gate.preFlightCheck('code-001', { a: 'test' }, 'A long prompt that is meaningful and complete.');
        const bad = gate.preFlightCheck('xyzzy-001', { a: 'test' }, 'A long prompt that is meaningful and complete.');
        expect(bad.confidence).toBeLessThan(good.confidence);
    });

    test('empty prompt → HALT', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('', {}, '');
        expect(result.decision).toBe('HALT');
        expect(result.confidence).toBeLessThan(TIERS.CAUTIOUS);
    });
});

// ─── 3. Drift Detection ──────────────────────────────────────────────────────

describe('Drift Detection', () => {
    test('identical outputs → no drift (driftScore = 0)', () => {
        const gate = new CSLConfidenceGate();
        for (let i = 0; i < 5; i++) gate.trackDrift('same_hash');
        const result = gate.trackDrift('same_hash');
        expect(result.drifting).toBe(false);
        expect(result.driftScore).toBe(0);
        expect(result.prediction).toBe('perfectly_deterministic');
    });

    test('all-unique outputs → severe drift (driftScore ≈ 1)', () => {
        const gate = new CSLConfidenceGate();
        for (let i = 0; i < 10; i++) gate.trackDrift(`unique_${i}`);
        const result = gate.trackDrift('unique_10');
        expect(result.drifting).toBe(true);
        expect(result.driftScore).toBeGreaterThan(DRIFT_THRESHOLD);
        expect(result.prediction).toBe('severe_drift_error_imminent');
    });

    test('drift threshold is 1 - φ⁻¹ ≈ 0.382', () => {
        expect(DRIFT_THRESHOLD).toBeCloseTo(1 - PSI, 6);
        expect(DRIFT_THRESHOLD).toBeCloseTo(0.382, 2);
    });

    test('insufficient data → no drift alert', () => {
        const gate = new CSLConfidenceGate();
        gate.trackDrift('a');
        const result = gate.trackDrift('b');
        expect(result.prediction).toBe('insufficient_data');
        expect(result.drifting).toBe(false);
    });
});

// ─── 4. Halt Mechanism ───────────────────────────────────────────────────────

describe('Halt & Reconfigure', () => {
    test('HALT prevents execution and returns null output', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        // Force a halt by giving empty vars to a strict prompt
        const result = executor.execute('code-001', {}, { strict: true });
        expect(result.halted).toBe(true);
        expect(result.output).toBe(null);
        expect(result.decision).toBe('HALT');
    });

    test('HALT emits halt event', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        let haltFired = false;
        executor.on('halt', () => { haltFired = true; });
        executor.execute('code-001', {}, { strict: true });
        expect(haltFired).toBe(true);
    });

    test('HALT emits system:reconfigure event with action plan', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        let reconfigData = null;
        executor.on('system:reconfigure', (data) => { reconfigData = data; });
        executor.execute('code-001', {}, { strict: true });
        expect(reconfigData).not.toBe(null);
        expect(reconfigData.action).toBeDefined();
        expect(reconfigData.steps).toBeDefined();
        expect(reconfigData.steps.length).toBeGreaterThan(0);
    });

    test('reconfigure returns sensible steps for low confidence', () => {
        const gate = new CSLConfidenceGate();
        const reconfig = gate.reconfigure({ confidence: 0.1, reason: 'low confidence' });
        expect(reconfig.action).toBe('escalate');
        expect(reconfig.steps).toContain('ESCALATE: Confidence critically low, require human review');
    });

    test('reconfigure suggests stabilize for drift', () => {
        const gate = new CSLConfidenceGate();
        const reconfig = gate.reconfigure({ confidence: 0.3, reason: 'drift detected, diverging outputs' });
        expect(reconfig.action).toBe('stabilize');
        expect(reconfig.newConfig.llmOverrides.temperature).toBe(0);
    });
});

// ─── 5. Replay Cache ─────────────────────────────────────────────────────────

describe('Replay Cache', () => {
    test('replay returns cached output for known inputHash', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const vars = { language: 'JS', code: 'x()', focus: 'bugs', standards: 'ESLint' };
        const first = executor.execute('code-001', vars);
        expect(first.cached).toBe(false);

        const replayed = executor.replay(first.inputHash);
        expect(replayed).not.toBeNull();
        expect(replayed.output).toBe(first.output);
        expect(replayed.cslScore).toBe(first.cslScore);
    });

    test('second execution hits cache', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const vars = { language: 'Python', code: 'def f(): pass', focus: 'security', standards: 'PEP8' };
        const first = executor.execute('code-001', vars);
        const second = executor.execute('code-001', vars);
        expect(second.cached).toBe(true);
        expect(second.decision).toBe('CACHED');
        expect(second.output).toBe(first.output);
    });

    test('replay returns null for unknown hash', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        expect(executor.replay('nonexistent_hash')).toBeNull();
    });

    test('bypassCache forces fresh execution', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const vars = { language: 'Go', code: 'func main() {}', focus: 'perf', standards: 'govet' };
        executor.execute('code-001', vars);
        const fresh = executor.execute('code-001', vars, { bypassCache: true });
        expect(fresh.cached).toBe(false);
    });
});

// ─── 6. Deterministic Executor — Full Pipeline ───────────────────────────────

describe('Deterministic Executor Pipeline', () => {
    test('enforces deterministic LLM params', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        expect(executor.llmParams.temperature).toBe(0);
        expect(executor.llmParams.top_p).toBe(1);
        expect(executor.llmParams.seed).toBe(42);
    });

    test('inputHash is deterministic (same promptId + vars → same hash)', () => {
        const pm1 = new StubPromptManager();
        const pm2 = new StubPromptManager();
        const executor1 = new DeterministicPromptExecutor({ promptManager: pm1 });
        const executor2 = new DeterministicPromptExecutor({ promptManager: pm2 });
        const vars = { language: 'Rust', code: 'fn main() {}', focus: 'safe', standards: 'clippy' };
        const a = executor1.execute('code-001', vars);
        const b = executor2.execute('code-001', vars);
        expect(a.inputHash).toBe(b.inputHash);
        expect(a.output).toBe(b.output);
    });

    test('getDeterminismReport returns accurate stats', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const vars = { language: 'JS', code: 'x', focus: 'f', standards: 's' };
        executor.execute('code-001', vars);
        executor.execute('code-001', vars); // cache hit
        const report = executor.getDeterminismReport();
        expect(report.totalExecutions).toBe(2);
        expect(report.cacheHits).toBe(1);
        expect(report.cacheMisses).toBe(1);
        expect(report.cacheHitRate).toBe('50.0%');
        expect(report.phi).toBeCloseTo(PHI, 6);
    });

    test('getAuditLog returns execution history', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        executor.execute('code-001', { language: 'JS', code: 'a', focus: 'b', standards: 'c' });
        const log = executor.getAuditLog();
        expect(log.length).toBe(1);
        expect(log[0].promptId).toBe('code-001');
        expect(log[0].timestamp).toBeGreaterThan(0);
    });

    test('REPLAY_THRESHOLD = φ⁻¹ ≈ 0.618', () => {
        expect(REPLAY_THRESHOLD).toBeCloseTo(PSI, 6);
    });
});

// ─── 7. Edge Cases ───────────────────────────────────────────────────────────

describe('Edge Cases', () => {
    test('CSLConfidenceGate handles empty vars gracefully', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('code-001', {}, '');
        // Empty vars + empty prompt → low confidence → HALT or CAUTIOUS
        expect(['CAUTIOUS', 'HALT']).toContain(result.decision);
        expect(result.confidence).toBeLessThan(1.0);
    });

    test('StubPromptManager throws on unknown prompt ID', () => {
        const pm = new StubPromptManager();
        expect(() => pm.getPrompt('nonexistent-999')).toThrow(/not found/i);
    });

    test('gate stats accumulate correctly', () => {
        const gate = new CSLConfidenceGate();
        gate.preFlightCheck('code-001', { language: 'JS', code: 'x', focus: 'f', standards: 's' }, 'A good prompt with enough content.');
        gate.preFlightCheck('', {}, '');
        const stats = gate.getStats();
        expect(stats.checks).toBe(2);
        expect(stats.executes + stats.cautious + stats.halts).toBe(2);
    });

    test('executor handles cross-domain prompts', () => {
        const pm = new StubPromptManager();
        const executor = new DeterministicPromptExecutor({ promptManager: pm });
        const result = executor.execute('deploy-001', {
            serviceName: 'heady-manager', environment: 'prod',
            currentVersion: '3.2.2', targetVersion: '3.2.3', strategy: 'rolling',
        });
        expect(result.halted).toBe(false);
        expect(result.output).toContain('heady-manager');
        expect(result.output).toContain('3.2.3');
    });

    test('confidence factors are all between 0 and 1', () => {
        const gate = new CSLConfidenceGate();
        const result = gate.preFlightCheck('code-001',
            { language: 'JS', code: 'test', focus: 'perf', standards: 'lint' },
            'A prompt.'
        );
        for (const [key, val] of Object.entries(result.factors)) {
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(1);
        }
    });
});
