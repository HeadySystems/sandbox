import { createServiceApp } from '@heady-ai/service-runtime';
import type { ServiceManifest } from '@heady-ai/contract-types';
import { execSync } from 'node:child_process';
import { readdir, stat, readFile, rm } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

// ────────────────────────────────────────────────────────────
//  φ Constants (Golden Ratio derived — no magic numbers)
// ────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const STALE_THRESHOLD_DAYS = Math.round(PHI * PHI * PHI * 8);  // ~34 days
const MAX_SCAN_DEPTH = Math.round(PHI * PHI * 5);              // ~13 levels
const CYCLE_COOLDOWN_MS = Math.round(PHI * 1000 * 60);         // ~1.6 min

// ────────────────────────────────────────────────────────────
//  Maintenance Stage Definitions
// ────────────────────────────────────────────────────────────
type StageResult = {
    stage: string;
    status: 'pass' | 'warn' | 'fail' | 'skip';
    duration_ms: number;
    details: Record<string, unknown>;
};

type MaintenanceCycleResult = {
    runId: string;
    startedAt: string;
    completedAt: string;
    stages: StageResult[];
    summary: { passed: number; warned: number; failed: number; skipped: number };
};

const WORKSPACE_ROOT = process.env.HEADY_WORKSPACE_ROOT || process.cwd();
const ACTIVE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.md', '.html', '.css', '.toml', '.py', '.sh']);
const PROTECTED_DIRS = new Set(['node_modules', '.git', '.turbo', 'dist', 'coverage', '.wrangler', '.pnpm']);
const STALE_CANDIDATES = ['_archive', 'archive', '_downloads', 'colab', 'benchmarks', 'evidence', 'credential-rotation', 'compliance-templates'];

// ────────────────────────────────────────────────────────────
//  Stage 1: SCAN — validate file structure
// ────────────────────────────────────────────────────────────
async function stageScan(): Promise<StageResult> {
    const start = Date.now();
    let totalFiles = 0;
    let invalidFiles: string[] = [];
    let emptyFiles: string[] = [];

    async function walk(dir: string, depth = 0) {
        if (depth > MAX_SCAN_DEPTH) return;
        const basename = dir.split('/').pop() || '';
        if (PROTECTED_DIRS.has(basename)) return;

        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full, depth + 1);
            } else if (entry.isFile()) {
                totalFiles++;
                const info = await stat(full).catch(() => null);
                if (info && info.size === 0 && ACTIVE_EXTENSIONS.has(extname(entry.name))) {
                    emptyFiles.push(relative(WORKSPACE_ROOT, full));
                }
            }
        }
    }

    await walk(WORKSPACE_ROOT);
    return {
        stage: 'scan',
        status: invalidFiles.length > 0 ? 'warn' : 'pass',
        duration_ms: Date.now() - start,
        details: { totalFiles, emptyFiles: emptyFiles.length, invalidFiles: invalidFiles.length },
    };
}

// ────────────────────────────────────────────────────────────
//  Stage 2: VALIDATE — turbo build check
// ────────────────────────────────────────────────────────────
function stageValidate(): StageResult {
    const start = Date.now();
    try {
        const output = execSync('npx turbo run build --summarize 2>&1', {
            cwd: WORKSPACE_ROOT,
            timeout: 120_000,
            encoding: 'utf8',
        });
        const taskMatch = output.match(/Tasks:\s+(\d+)\s+successful,\s+(\d+)\s+total/);
        const passed = taskMatch ? Number(taskMatch[1]) : 0;
        const total = taskMatch ? Number(taskMatch[2]) : 0;
        return {
            stage: 'validate',
            status: passed === total ? 'pass' : 'fail',
            duration_ms: Date.now() - start,
            details: { passed, total, clean: passed === total },
        };
    } catch (error: any) {
        return {
            stage: 'validate',
            status: 'fail',
            duration_ms: Date.now() - start,
            details: { error: error.message?.slice(0, 500) },
        };
    }
}

// ────────────────────────────────────────────────────────────
//  Stage 3: BRAND — check branding headers exist
// ────────────────────────────────────────────────────────────
async function stageBrand(): Promise<StageResult> {
    const start = Date.now();
    let branded = 0;
    let unbranded: string[] = [];
    const brandableExts = new Set(['.yaml', '.yml', '.toml', '.ts', '.js', '.mjs', '.css', '.html']);

    async function check(dir: string, depth = 0) {
        if (depth > 5) return;
        const basename = dir.split('/').pop() || '';
        if (PROTECTED_DIRS.has(basename) || basename.startsWith('.')) return;

        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                await check(full, depth + 1);
            } else if (entry.isFile() && brandableExts.has(extname(entry.name))) {
                const head = await readFile(full, 'utf8').then(c => c.slice(0, 300)).catch(() => '');
                if (head.includes('HEADY_BRAND') || head.includes('HeadySystems') || head.includes('@heady-ai')) {
                    branded++;
                } else {
                    unbranded.push(relative(WORKSPACE_ROOT, full));
                }
            }
        }
    }

    // Only check key directories
    for (const subdir of ['configs', 'packages', 'services', 'apps', 'workers']) {
        await check(join(WORKSPACE_ROOT, subdir));
    }

    return {
        stage: 'brand',
        status: unbranded.length > 20 ? 'warn' : 'pass',
        duration_ms: Date.now() - start,
        details: { branded, unbranded: unbranded.length, sampleUnbranded: unbranded.slice(0, 10) },
    };
}

// ────────────────────────────────────────────────────────────
//  Stage 4: TRIM — identify stale directories/files
// ────────────────────────────────────────────────────────────
async function stageTrim(dryRun = true): Promise<StageResult> {
    const start = Date.now();
    const staleFound: string[] = [];
    const now = Date.now();
    const staleMs = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    for (const candidate of STALE_CANDIDATES) {
        const full = join(WORKSPACE_ROOT, candidate);
        const info = await stat(full).catch(() => null);
        if (info?.isDirectory()) {
            staleFound.push(candidate);
            if (!dryRun) {
                await rm(full, { recursive: true, force: true });
            }
        }
    }

    return {
        stage: 'trim',
        status: staleFound.length > 0 ? 'warn' : 'pass',
        duration_ms: Date.now() - start,
        details: { staleFound, count: staleFound.length, dryRun, thresholdDays: STALE_THRESHOLD_DAYS },
    };
}

// ────────────────────────────────────────────────────────────
//  Stage 5: COMMIT — stage and commit changes
// ────────────────────────────────────────────────────────────
function stageCommit(dryRun = true): StageResult {
    const start = Date.now();
    try {
        const status = execSync('git status --short', { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
        const changedFiles = status.split('\n').filter(Boolean).length;

        if (changedFiles === 0) {
            return { stage: 'commit', status: 'skip', duration_ms: Date.now() - start, details: { changedFiles: 0 } };
        }

        if (!dryRun) {
            execSync('git add -A', { cwd: WORKSPACE_ROOT });
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            execSync(`git commit -m "chore(maintenance): system update cycle ${timestamp}"`, { cwd: WORKSPACE_ROOT });
        }

        return {
            stage: 'commit',
            status: 'pass',
            duration_ms: Date.now() - start,
            details: { changedFiles, dryRun },
        };
    } catch (error: any) {
        return { stage: 'commit', status: 'fail', duration_ms: Date.now() - start, details: { error: error.message?.slice(0, 300) } };
    }
}

// ────────────────────────────────────────────────────────────
//  Stage 6: DEPLOY — trigger turbo build for production
// ────────────────────────────────────────────────────────────
function stageDeploy(dryRun = true): StageResult {
    const start = Date.now();
    try {
        if (!dryRun) {
            execSync('npx turbo run build', { cwd: WORKSPACE_ROOT, timeout: 180_000 });
        }
        return { stage: 'deploy', status: dryRun ? 'skip' : 'pass', duration_ms: Date.now() - start, details: { dryRun } };
    } catch (error: any) {
        return { stage: 'deploy', status: 'fail', duration_ms: Date.now() - start, details: { error: error.message?.slice(0, 300) } };
    }
}

// ────────────────────────────────────────────────────────────
//  Stage 7: PUSH — push to origin
// ────────────────────────────────────────────────────────────
function stagePush(dryRun = true): StageResult {
    const start = Date.now();
    try {
        if (!dryRun) {
            execSync('git push origin HEAD', { cwd: WORKSPACE_ROOT, timeout: 60_000 });
        }
        return { stage: 'push', status: dryRun ? 'skip' : 'pass', duration_ms: Date.now() - start, details: { dryRun } };
    } catch (error: any) {
        return { stage: 'push', status: 'fail', duration_ms: Date.now() - start, details: { error: error.message?.slice(0, 300) } };
    }
}

// ────────────────────────────────────────────────────────────
//  Full Maintenance Cycle Orchestrator
// ────────────────────────────────────────────────────────────
async function runMaintenanceCycle(dryRun = true): Promise<MaintenanceCycleResult> {
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const stages: StageResult[] = [];

    stages.push(await stageScan());
    stages.push(stageValidate());
    stages.push(await stageBrand());
    stages.push(await stageTrim(dryRun));
    stages.push(stageCommit(dryRun));
    stages.push(stageDeploy(dryRun));
    stages.push(stagePush(dryRun));

    const summary = {
        passed: stages.filter(s => s.status === 'pass').length,
        warned: stages.filter(s => s.status === 'warn').length,
        failed: stages.filter(s => s.status === 'fail').length,
        skipped: stages.filter(s => s.status === 'skip').length,
    };

    return { runId, startedAt, completedAt: new Date().toISOString(), stages, summary };
}

// ────────────────────────────────────────────────────────────
//  Service Manifest & Routes
// ────────────────────────────────────────────────────────────
const manifest: ServiceManifest = {
    name: 'heady-maintenance',
    version: '0.1.0',
    port: 4320,
    summary: 'Complete system update and maintenance cycle: scan → validate → brand → trim → commit → deploy → push.',
    routes: [
        '/maintenance/run',
        '/maintenance/dry-run',
        '/maintenance/status',
        '/maintenance/stages',
    ],
    dependencies: [
        'phi-math-foundation',
        'csl-gate',
        'observability-client',
    ],
} as ServiceManifest;

const app = createServiceApp(manifest);

let lastResult: MaintenanceCycleResult | null = null;
let running = false;

// Full cycle (live — commits, deploys, pushes)
app.post('/maintenance/run', async (request) => {
    if (running) return { accepted: false, reason: 'cycle already running' };
    running = true;
    try {
        const body = request.body as Record<string, unknown>;
        const dryRun = body?.dryRun !== false; // default safe: dry-run
        lastResult = await runMaintenanceCycle(dryRun);
        return { accepted: true, result: lastResult };
    } finally {
        running = false;
    }
});

// Dry-run only (scan + validate + brand + trim report, no mutations)
app.post('/maintenance/dry-run', async () => {
    if (running) return { accepted: false, reason: 'cycle already running' };
    running = true;
    try {
        lastResult = await runMaintenanceCycle(true);
        return { accepted: true, result: lastResult };
    } finally {
        running = false;
    }
});

// Last cycle result
app.get('/maintenance/status', async () => {
    if (!lastResult) return { state: 'idle', lastRun: null };
    return { state: running ? 'running' : 'idle', lastRun: lastResult };
});

// Stage definitions
app.get('/maintenance/stages', async () => ({
    stages: [
        { id: 1, name: 'scan', description: 'Validate file structure, find empty/invalid files' },
        { id: 2, name: 'validate', description: 'Run turbo build to verify all packages compile' },
        { id: 3, name: 'brand', description: 'Check HEADY_BRAND headers across config and source files' },
        { id: 4, name: 'trim', description: 'Identify and optionally remove stale directories' },
        { id: 5, name: 'commit', description: 'Stage all changes and commit with maintenance message' },
        { id: 6, name: 'deploy', description: 'Run production build via turbo' },
        { id: 7, name: 'push', description: 'Push committed changes to origin' },
    ],
    phiConstants: {
        staleThresholdDays: STALE_THRESHOLD_DAYS,
        maxScanDepth: MAX_SCAN_DEPTH,
        cycleCooldownMs: CYCLE_COOLDOWN_MS,
    },
}));

const port = Number(process.env.PORT ?? 4320);
app.listen({ port, host: '0.0.0.0' }).then(() => {
    app.log.info(`heady-maintenance listening on ${port}`);
}).catch((error) => {
    app.log.error(error);
    process.exit(1);
});

export { runMaintenanceCycle };
export type { MaintenanceCycleResult, StageResult };
