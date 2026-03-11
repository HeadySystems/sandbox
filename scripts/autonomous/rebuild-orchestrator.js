#!/usr/bin/env node

/**
 * Autonomous Rebuild Orchestrator
 *
 * Runs the full rebuild pipeline:
 *   1. Naming convention audit (CJS scanner)
 *   2. Sacred Genesis rebuild (naming report + zip bundle)
 *   3. Emits summary to stdout
 *
 * Usage:
 *   node scripts/autonomous/rebuild-orchestrator.js [--strict]
 *
 * Flags:
 *   --strict   Exit non-zero if naming violations are found
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const STEPS = [
    {
        name: 'Naming Convention Audit',
        command: 'node',
        args: [path.join(ROOT, 'scripts', 'audit-naming-conventions.js')],
        allowFailure: true,
    },
    {
        name: 'Sacred Genesis Rebuild',
        command: 'python3',
        args: [path.join(ROOT, 'scripts', 'rebuild_sacred_genesis.py')],
        allowFailure: false,
    },
];

function runStep(step) {
    const start = Date.now();
    process.stdout.write(`\n▸ ${step.name}\n`);

    const result = spawnSync(step.command, step.args, {
        cwd: ROOT,
        stdio: 'inherit',
        timeout: 120_000,
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const ok = result.status === 0;

    if (ok) {
        process.stdout.write(`  ✅ ${step.name} (${elapsed}s)\n`);
    } else {
        process.stdout.write(`  ❌ ${step.name} failed (exit ${result.status}, ${elapsed}s)\n`);
    }

    return { name: step.name, ok, elapsed, allowFailure: step.allowFailure };
}

function main() {
    const strict = process.argv.includes('--strict');
    const start = Date.now();

    process.stdout.write('═══ Autonomous Rebuild Orchestrator ═══\n');

    const results = STEPS.map(runStep);
    const totalElapsed = ((Date.now() - start) / 1000).toFixed(1);
    const failures = results.filter((r) => !r.ok && (!r.allowFailure || strict));

    process.stdout.write(`\n═══ Summary (${totalElapsed}s) ═══\n`);
    for (const r of results) {
        process.stdout.write(`  ${r.ok ? '✅' : '❌'} ${r.name} (${r.elapsed}s)\n`);
    }

    if (failures.length > 0) {
        process.stdout.write(`\n${failures.length} step(s) failed.\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write('\nAll steps passed.\n');
    }
}

main();
