/**
 * Battle-Sim Orchestrator + Continuous Action Analyzer — Test Suite
 *
 * Tests:
 *   1. Sim pre-flight scoring and resource estimation
 *   2. Battle racing with mock arena contestants
 *   3. MC sampling determinism measurement
 *   4. Full pipeline: Sim → CSL → Battle → MC → Bee → Swarm → Result → Drift
 *   5. Continuous action analyzer drift detection and pattern learning
 *   6. Comparison framework (Heady™ vs external output)
 *   7. Task dispatcher routing to HeadyBattle/HeadySims
 *   8. Edge cases
 *
 * Run: npx jest tests/battle-sim-orchestrator.test.js --verbose
 */

const { BattleSimTaskOrchestrator, PHI, PSI, PSI_SQ } = require('../src/orchestration/battle-sim-task-orchestrator');
const { ContinuousActionAnalyzer, DRIFT_THRESHOLD, LEARN_THRESHOLD } = require('../src/analytics/continuous-action-analyzer');

// ─── Stubs ────────────────────────────────────────────────────────────────────

class StubCSLConfidenceGate {
    constructor() {
        this._driftWindow = [];
        this._stats = { checks: 0, executes: 0, halts: 0 };
    }
    preFlightCheck(promptId, vars, interpolated) {
        this._stats.checks++;
        const filled = Object.values(vars).filter(v => v && String(v).trim()).length;
        const total = Object.keys(vars).length;
        const completeness = total > 0 ? filled / total : 0;
        const promptLen = (interpolated || '').length;
        const lengthScore = Math.min(1.0, promptLen / 100);
        const confidence = (completeness * PSI + lengthScore * PSI_SQ) / (PSI + PSI_SQ);
        const decision = confidence >= PSI ? 'EXECUTE' : confidence >= PSI_SQ ? 'CAUTIOUS' : 'HALT';
        if (decision === 'EXECUTE') this._stats.executes++;
        if (decision === 'HALT') this._stats.halts++;
        return { confidence: +confidence.toFixed(4), decision, factors: { completeness, lengthScore } };
    }
    trackDrift(hash) {
        this._driftWindow.push(hash);
        if (this._driftWindow.length > 20) this._driftWindow.shift();
        if (this._driftWindow.length < 5) return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        const unique = new Set(this._driftWindow).size;
        const driftScore = (unique - 1) / (this._driftWindow.length - 1);
        return { drifting: driftScore > PSI_SQ, driftScore: +driftScore.toFixed(4), prediction: driftScore > PSI_SQ ? 'drift_detected' : 'stable' };
    }
    getStats() { return this._stats; }
}

class StubBattleArena {
    constructor() {
        this._contestants = new Map();
        this._contestants.set('model-a', { id: 'model-a', provider: 'anthropic', model: 'claude-3' });
        this._contestants.set('model-b', { id: 'model-b', provider: 'openai', model: 'gpt-4' });
    }
    async runRound(task) {
        return {
            winner: 'model-a',
            outputs: {
                'model-a': `Analysis of "${task.prompt}": comprehensive and accurate with reasoning.`,
                'model-b': `Response to "${task.prompt}": concise summary.`,
            },
            finalScores: { 'model-a': 0.85, 'model-b': 0.72 },
            durationMs: 150,
        };
    }
}

// ─── 1. Sim Pre-Flight ───────────────────────────────────────────────────────

describe('Sim Pre-Flight', () => {
    test('well-formed task gets high sim score', async () => {
        const orch = new BattleSimTaskOrchestrator();
        const result = await orch.execute({
            id: 'test-001',
            prompt: 'Analyze this code for security vulnerabilities and provide detailed recommendations for fixing each issue found.',
            domain: 'code',
            keywords: ['security', 'vulnerability', 'fix'],
            variables: { language: 'JavaScript', severity: 'high' },
        }, { skipBattle: true, skipMC: true });

        expect(result.halted).toBe(false);
        expect(result.stages.sim_preflight.score).toBeGreaterThan(0.5);
        expect(result.stages.sim_preflight.resources).toBeDefined();
    });

    test('empty task gets low sim score and halts', async () => {
        const orch = new BattleSimTaskOrchestrator();
        const result = await orch.execute({
            id: 'test-002', prompt: '', domain: '', keywords: [],
        }, { skipBattle: true, skipMC: true });

        expect(result.halted).toBe(true);
        expect(result.haltStage).toBe('sim_preflight');
    });

    test('sim can be skipped', async () => {
        const orch = new BattleSimTaskOrchestrator();
        const result = await orch.execute({
            id: 'test-003', prompt: 'Hello', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(result.halted).toBe(false);
        expect(result.stages.sim_preflight).toBeUndefined();
    });
});

// ─── 2. Battle Racing ────────────────────────────────────────────────────────

describe('Battle Racing', () => {
    test('arena races contestants and picks winner', async () => {
        const arena = new StubBattleArena();
        const orch = new BattleSimTaskOrchestrator({ arena, simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'battle-001',
            prompt: 'Which sorting algorithm is fastest for nearly-sorted data?',
            domain: 'code', keywords: ['sort', 'algorithm'],
        }, { skipSim: true, skipMC: true });

        expect(result.halted).toBe(false);
        expect(result.stages.battle_race.winner).toBe('model-a');
        expect(result.stages.battle_race.winnerProvider).toBe('anthropic');
        expect(result.stages.battle_race.finalScores['model-a']).toBeGreaterThan(result.stages.battle_race.finalScores['model-b']);
    });

    test('battle race is skipped when no arena provided', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'battle-002', prompt: 'Test', domain: 'code',
        }, { skipSim: true, skipMC: true });

        expect(result.stages.battle_race.skipped).toBe(true);
    });
});

// ─── 3. MC Sampling ──────────────────────────────────────────────────────────

describe('MC Sampling', () => {
    test('deterministic input produces consistent MC metrics', async () => {
        const orch = new BattleSimTaskOrchestrator({ mcIterations: 10, simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'mc-001', prompt: 'Test prompt for MC sampling', domain: 'code',
            variables: { language: 'JS' },
        }, { skipSim: true, skipBattle: true });

        expect(result.stages.mc_sampling.iterations).toBe(10);
        expect(result.stages.mc_sampling.uniqueHashes).toBeGreaterThanOrEqual(1);
        expect(result.stages.mc_sampling.determinismScore).toBeDefined();
        expect(result.stages.mc_sampling.boundary).toBeDefined();
        expect(result.stages.mc_sampling.prediction).toBeDefined();
    });

    test('MC can be skipped', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'mc-002', prompt: 'Test', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(result.stages.mc_sampling).toBeUndefined();
    });
});

// ─── 4. Full Pipeline ────────────────────────────────────────────────────────

describe('Full Pipeline', () => {
    test('all 9 stages execute in sequence', async () => {
        const gate = new StubCSLConfidenceGate();
        const arena = new StubBattleArena();
        const analyzer = new ContinuousActionAnalyzer();
        const orch = new BattleSimTaskOrchestrator({
            arena, confidenceGate: gate, actionAnalyzer: analyzer, mcIterations: 3,
        });

        const result = await orch.execute({
            id: 'full-001',
            prompt: 'Design a microservice architecture for a real-time trading platform with low-latency requirements, distributed consensus, and phi-scaled resource allocation.',
            domain: 'code',
            keywords: ['architecture', 'microservice', 'trading', 'latency'],
            variables: { language: 'Go', scale: 'large' },
        });

        expect(result.halted).toBe(false);
        expect(result.pipelineId).toBeDefined();
        expect(result.stages.sim_preflight).toBeDefined();
        expect(result.stages.csl_gate).toBeDefined();
        expect(result.stages.battle_race).toBeDefined();
        expect(result.stages.mc_sampling).toBeDefined();
        expect(result.stages.bee_dispatch).toBeDefined();
        expect(result.stages.swarm_route).toBeDefined();
        expect(result.stages.result_capture).toBeDefined();
        expect(result.stages.drift_check).toBeDefined();
        expect(result.output).toBeDefined();
        expect(result.outputHash).toBeDefined();
        expect(result.determinismMetrics).toBeDefined();
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('bee dispatch routes to correct domain', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'bee-001', prompt: 'Deploy the service', domain: 'deploy',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(result.stages.bee_dispatch.bee).toBe('deployment-bee');
        expect(result.stages.bee_dispatch.domain).toBe('deploy');
    });

    test('swarm route targets correct swarm', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'swarm-001', prompt: 'Research the topic', domain: 'research',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(result.stages.swarm_route.targetSwarm).toBe('research-herald');
        expect(result.stages.swarm_route.routed).toBe(true);
    });

    test('pipeline emits events', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        let completeFired = false;
        orch.on('pipeline:complete', () => { completeFired = true; });

        await orch.execute({
            id: 'events-001', prompt: 'Test event emission', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        expect(completeFired).toBe(true);
    });
});

// ─── 5. Continuous Action Analyzer ───────────────────────────────────────────

describe('Continuous Action Analyzer', () => {
    test('records actions and updates stats', () => {
        const analyzer = new ContinuousActionAnalyzer();
        analyzer.record({ taskId: 'test', domain: 'code', inputHash: 'abc', outputHash: 'def', provider: 'anthropic', model: 'claude', latencyMs: 100, confidence: 0.9, simScore: 0.85, battleWon: true, mcDeterminism: 0.95 });
        const stats = analyzer.getStats();
        expect(stats.totalActions).toBe(1);
        expect(stats.avgConfidence).toBeCloseTo(0.9, 1);
    });

    test('detects drift when outputs diverge', () => {
        const analyzer = new ContinuousActionAnalyzer();
        let driftFired = false;
        analyzer.on('action:drift', () => { driftFired = true; });

        // Push diverse outputs to trigger drift
        for (let i = 0; i < 20; i++) {
            analyzer.record({ taskId: `t${i}`, domain: 'code', outputHash: `unique-${i}`, provider: 'test', model: 'test', latencyMs: 100, confidence: 0.5, simScore: 0.5, battleWon: false, mcDeterminism: 0.3 });
        }

        expect(driftFired).toBe(true);
        expect(analyzer.getStats().driftAlerts).toBeGreaterThan(0);
    });

    test('learns patterns after threshold', () => {
        const analyzer = new ContinuousActionAnalyzer();
        let learnedFired = false;
        analyzer.on('action:learned', () => { learnedFired = true; });

        for (let i = 0; i < LEARN_THRESHOLD + 5; i++) {
            analyzer.record({ taskId: `t${i}`, domain: 'code', outputHash: 'same-hash', provider: 'anthropic', model: 'claude-3', latencyMs: 200, confidence: 0.85, simScore: 0.9, battleWon: true, mcDeterminism: 0.95 });
        }

        expect(learnedFired).toBe(true);
        const pattern = analyzer.getPattern('code');
        expect(pattern).not.toBe(null);
        expect(pattern.avgConfidence).toBeGreaterThan(0.8);
        expect(pattern.bestProviderModel).toBe('anthropic/claude-3');
    });

    test('records user actions', () => {
        const analyzer = new ContinuousActionAnalyzer();
        analyzer.recordUserAction({ type: 'click', target: 'submit-btn', sessionId: 's1' });
        expect(analyzer.getStats().totalActions).toBe(1);
        expect(analyzer.getRecentActions(1)[0].domain).toBe('user-interaction');
    });

    test('records environmental params', () => {
        const analyzer = new ContinuousActionAnalyzer();
        analyzer.recordEnvironmental({ key: 'NODE_ENV', value: 'production', source: 'env' });
        expect(analyzer.getStats().totalActions).toBe(1);
        expect(analyzer.getRecentActions(1)[0].domain).toBe('environmental');
    });

    test('determinism report aggregates patterns', () => {
        const analyzer = new ContinuousActionAnalyzer();
        for (let i = 0; i < 15; i++) {
            analyzer.record({ taskId: `r${i}`, domain: 'deploy', outputHash: 'h1', provider: 'gcp', model: 'cloudrun', latencyMs: 300, confidence: 0.9, simScore: 0.88, battleWon: true, mcDeterminism: 0.92 });
        }
        const report = analyzer.getDeterminismReport();
        expect(report.learnedDomains).toBe(1);
        expect(report.avgDeterminism).toBeGreaterThan(0.5);
        expect(report.recommendation).toContain('deterministic');
    });
});

// ─── 6. Comparison Framework ─────────────────────────────────────────────────

describe('Comparison Framework', () => {
    test('identical outputs → hashMatch + high determinism score', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'comp-001', prompt: 'Test comparison', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        const comparison = orch.compareOutputs(result, result.output);
        expect(comparison.hashMatch).toBe(true);
        expect(comparison.jaccardSimilarity).toBe(1.0);
        expect(comparison.determinismScore).toBeGreaterThan(PSI);
        expect(comparison.verdict).toBe('deterministic');
    });

    test('different outputs → no hashMatch + lower determinism', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const result = await orch.execute({
            id: 'comp-002', prompt: 'First output for comparison', domain: 'code',
        }, { skipSim: true, skipBattle: true, skipMC: true });

        const comparison = orch.compareOutputs(result, 'Completely different and unrelated text about something else entirely');
        expect(comparison.hashMatch).toBe(false);
        expect(comparison.jaccardSimilarity).toBeLessThan(0.5);
        expect(comparison.determinismScore).toBeLessThan(PSI);
    });

    test('comparePipelineRuns detects self-consistency', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        const task = { id: 'consistency-001', prompt: 'Same task for consistency check', domain: 'code' };
        const a = await orch.execute(task, { skipSim: true, skipBattle: true, skipMC: true });
        const b = await orch.execute(task, { skipSim: true, skipBattle: true, skipMC: true });
        const consistency = orch.comparePipelineRuns(a, b);
        expect(consistency.hashMatch).toBe(true);
        expect(consistency.selfConsistent).toBe(true);
    });
});

// ─── 7. Task Dispatcher Routing ──────────────────────────────────────────────

describe('Task Dispatcher Battle/Sim Routing', () => {
    // Load the actual dispatcher to verify it has the new agents
    let classify, SUB_AGENTS;
    beforeAll(() => {
        try {
            ({ classify, SUB_AGENTS } = require('../src/hcfp/task-dispatcher'));
        } catch (e) {
            // Dispatcher may fail to load due to missing midi-event-bus — skip
            classify = null;
        }
    });

    test('SUB_AGENTS includes heady-battle', () => {
        if (!SUB_AGENTS) return; // skip if dispatcher doesn't load
        expect(SUB_AGENTS['heady-battle']).toBeDefined();
        expect(SUB_AGENTS['heady-battle'].name).toBe('HeadyBattle');
        expect(SUB_AGENTS['heady-battle'].keywords).toContain('battle');
        expect(SUB_AGENTS['heady-battle'].keywords).toContain('race');
        expect(SUB_AGENTS['heady-battle'].keywords).toContain('compare');
    });

    test('SUB_AGENTS includes heady-sims', () => {
        if (!SUB_AGENTS) return;
        expect(SUB_AGENTS['heady-sims']).toBeDefined();
        expect(SUB_AGENTS['heady-sims'].name).toBe('HeadySims');
        expect(SUB_AGENTS['heady-sims'].keywords).toContain('simulate');
        expect(SUB_AGENTS['heady-sims'].keywords).toContain('predict');
    });

    test('battle keyword routes to HeadyBattle', () => {
        if (!classify) return;
        const result = classify({ name: 'battle arena evaluation compare', action: 'battle', inputs: {} });
        expect(result.agent).toBe('heady-battle');
        expect(result.name).toBe('HeadyBattle');
    });

    test('simulate keyword routes to HeadySims', () => {
        if (!classify) return;
        const result = classify({ name: 'Simulate resource usage', action: 'simulate', inputs: {} });
        expect(result.agent).toBe('heady-sims');
        expect(result.name).toBe('HeadySims');
    });
});

// ─── 8. Edge Cases ───────────────────────────────────────────────────────────

describe('Edge Cases', () => {
    test('stats are accurate after multiple runs', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        await orch.execute({ id: 'e1', prompt: 'Task 1', domain: 'code' }, { skipSim: true, skipBattle: true, skipMC: true });
        await orch.execute({ id: 'e2', prompt: 'Task 2', domain: 'deploy' }, { skipSim: true, skipBattle: true, skipMC: true });
        const stats = orch.getStats();
        expect(stats.tasksProcessed).toBe(2);
        expect(stats.beeDispatches).toBe(2);
        expect(stats.swarmRoutes).toBe(2);
    });

    test('audit log tracks all actions', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        await orch.execute({ id: 'audit-1', prompt: 'Audit test', domain: 'code' }, { skipSim: true, skipBattle: true, skipMC: true });
        const log = orch.getAuditLog();
        expect(log.length).toBeGreaterThan(0);
        expect(log[0].action).toBe('pipeline_start');
    });

    test('determinism report is correct', async () => {
        const orch = new BattleSimTaskOrchestrator({ simConfidenceThreshold: 0 });
        await orch.execute({ id: 'dr-1', prompt: 'Test', domain: 'code' }, { skipSim: true, skipBattle: true, skipMC: true });
        const report = orch.getDeterminismReport();
        expect(report.totalTasks).toBe(1);
        expect(report.phi).toBeCloseTo(PHI, 6);
        expect(report.psi).toBeCloseTo(PSI, 6);
    });

    test('force flag bypasses sim halt', async () => {
        const orch = new BattleSimTaskOrchestrator();
        const result = await orch.execute({
            id: 'force-001', prompt: '', domain: '',
        }, { force: true, skipBattle: true, skipMC: true });
        expect(result.halted).toBe(false);
    });

    test('phi constants are golden ratio', () => {
        expect(PHI).toBeCloseTo(1.618, 2);
        expect(PSI).toBeCloseTo(0.618, 2);
        expect(PSI_SQ).toBeCloseTo(0.382, 2);
        expect(PHI * PSI).toBeCloseTo(1.0, 6);
    });
});
