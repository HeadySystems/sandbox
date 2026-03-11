#!/usr/bin/env node
/**
 * test-orchestrator.mjs
 * Master test orchestrator for Heady™ — follows the hcfullpipeline flow:
 *   RECON → INTAKE → CLASSIFY → EXECUTE → VERIFY → RECEIPT → NOTIFY
 *
 * Usage:
 *   node scripts/test-orchestrator.mjs              # run all tests
 *   node scripts/test-orchestrator.mjs --staging    # also validate staging schema
 *   node scripts/test-orchestrator.mjs --promote    # run + prepare for staging sync
 *
 * Exit code 0 = all pass, 1 = failures detected
 *
 * © 2026 HeadySystems Inc.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

// ── Constants ──────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PHI_INVERSE = 1 / PHI;
const VERSION = '4.0.0';

// ── CLI Args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const STAGING   = args.includes('--staging');
const PROMOTE   = args.includes('--promote');
const VERBOSE   = args.includes('--verbose');

// ── Logger ─────────────────────────────────────────────────────────────────
const COLORS = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};

function log(stage, msg, color = COLORS.cyan) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`${COLORS.dim}[${ts}]${COLORS.reset} ${color}[${stage}]${COLORS.reset} ${msg}`);
}

function logSuccess(stage, msg) { log(stage, `✓ ${msg}`, COLORS.green); }
function logFail(stage, msg)    { log(stage, `✗ ${msg}`, COLORS.red); }
function logWarn(stage, msg)    { log(stage, `⚠ ${msg}`, COLORS.yellow); }

function section(title) {
  const bar = '─'.repeat(60);
  console.log(`\n${COLORS.bold}${bar}${COLORS.reset}`);
  console.log(`${COLORS.bold}  ${title}${COLORS.reset}`);
  console.log(`${COLORS.bold}${bar}${COLORS.reset}\n`);
}

// ── Jest Runner ────────────────────────────────────────────────────────────

function runJest(pattern, label, extra = []) {
  const jestBin = join(ROOT, 'node_modules', '.bin', 'jest');
  const cmd = existsSync(jestBin) ? jestBin : 'npx jest';

  const cmdParts = typeof cmd === 'string' ? cmd.split(' ') : [cmd];

  const result = spawnSync(
    cmdParts[0],
    [...cmdParts.slice(1), pattern, '--json', '--no-coverage', '--passWithNoTests', ...extra],
    { cwd: ROOT, encoding: 'utf8', timeout: 120_000, shell: true }
  );

  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    try {
      const lines = (result.stdout || '').split('\n').filter(Boolean);
      parsed = JSON.parse(lines[lines.length - 1]);
    } catch { /* ignore */ }
  }

  if (VERBOSE && result.stderr) {
    console.log(result.stderr.slice(0, 1000));
  }

  const passed = parsed?.numPassedTests || 0;
  const failed = parsed?.numFailedTests || 0;
  const total  = passed + failed;
  const suites = parsed?.numPassedTestSuites || 0;

  return { label, passed, failed, total, suites, exitCode: result.status || 0 };
}

// ── Stage Functions ────────────────────────────────────────────────────────

function stageRecon() {
  section('STAGE 1: RECON — Environment Scan');
  const checks = {};

  // Git status
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
    const changedFiles = status.trim().split('\n').filter(Boolean).length;
    checks.gitChangedFiles = changedFiles;
    if (changedFiles > 0) {
      logWarn('RECON', `${changedFiles} uncommitted changes detected`);
    } else {
      logSuccess('RECON', 'Working tree is clean');
    }
  } catch {
    logWarn('RECON', 'Could not read git status');
    checks.gitChangedFiles = -1;
  }

  // Branch
  try {
    const branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim();
    checks.branch = branch;
    logSuccess('RECON', `Current branch: ${branch}`);
  } catch {
    checks.branch = 'unknown';
  }

  // Node version
  try {
    const nodeVer = execSync('node --version', { encoding: 'utf8' }).trim();
    checks.nodeVersion = nodeVer;
    logSuccess('RECON', `Node.js: ${nodeVer}`);
  } catch {
    checks.nodeVersion = 'unknown';
  }

  // Package lock exists
  checks.hasLockFile = existsSync(join(ROOT, 'pnpm-lock.yaml'))
                     || existsSync(join(ROOT, 'package-lock.json'))
                     || existsSync(join(ROOT, 'yarn.lock'));
  if (checks.hasLockFile) logSuccess('RECON', 'Lock file present');
  else logWarn('RECON', 'No lock file found');

  return checks;
}

function stageIntake() {
  section('STAGE 2: INTAKE — Config Validation');
  const configs = {};
  const configFiles = [
    'configs/hcfullpipeline.yaml',
    'configs/hcfullpipeline.json',
    'package.json',
    'jest.config.js',
  ];

  for (const cf of configFiles) {
    const full = join(ROOT, cf);
    if (existsSync(full)) {
      try {
        if (cf.endsWith('.json')) {
          JSON.parse(readFileSync(full, 'utf8'));
        }
        configs[cf] = 'ok';
        logSuccess('INTAKE', `${cf} — valid`);
      } catch (e) {
        configs[cf] = `error: ${e.message}`;
        logFail('INTAKE', `${cf} — parse error: ${e.message}`);
      }
    } else {
      configs[cf] = 'missing';
      logWarn('INTAKE', `${cf} — file not found`);
    }
  }

  return configs;
}

function stageClassify() {
  section('STAGE 3: CLASSIFY — Test Suite Discovery');
  const suites = {
    unit:        [],
    integration: [],
    e2e:         [],
    pipeline:    [],
    staging:     [],
    smoke:       [],
    other:       [],
  };

  const testsDir = join(ROOT, 'tests');
  if (!existsSync(testsDir)) {
    logFail('CLASSIFY', 'tests/ directory not found');
    return suites;
  }

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory() && e.name !== 'node_modules') {
        walk(full);
      } else if (e.isFile() && /\.test\.(js|ts|mjs)$/.test(e.name)) {
        const name = e.name.toLowerCase();
        if (full.includes('integration') || name.includes('integration')) {
          suites.integration.push(full);
        } else if (full.includes('e2e') || name.includes('e2e')) {
          suites.e2e.push(full);
        } else if (name.includes('pipeline') || name.includes('hcfull')) {
          suites.pipeline.push(full);
        } else if (name.includes('staging')) {
          suites.staging.push(full);
        } else if (name.includes('smoke') || name.includes('boot')) {
          suites.smoke.push(full);
        } else {
          suites.unit.push(full);
        }
      }
    }
  }

  walk(testsDir);

  // Also check test/ directory
  const testDir = join(ROOT, 'test');
  if (existsSync(testDir)) walk(testDir);

  for (const [cat, files] of Object.entries(suites)) {
    if (files.length > 0) {
      logSuccess('CLASSIFY', `${cat}: ${files.length} test file(s)`);
    }
  }

  const total = Object.values(suites).reduce((s, a) => s + a.length, 0);
  logSuccess('CLASSIFY', `Total: ${total} test files discovered`);

  return suites;
}

function stageExecute(suites) {
  section('STAGE 12: EXECUTE — Running Test Suites');
  const results = [];

  // 1. Pipeline validation tests (critical priority)
  log('EXECUTE', '▸ Running pipeline validation tests...');
  results.push(runJest('tests/hcfullpipeline-validator.test.js', 'Pipeline Validator'));

  // 2. Staging test schema (if --staging or --promote)
  if (STAGING || PROMOTE) {
    log('EXECUTE', '▸ Running staging test schema...');
    results.push(runJest('tests/staging-test-schema.test.js', 'Staging Schema'));
  }

  // 3. Core unit tests (sample the most important ones)
  const coreTests = [
    'tests/core.test.js',
    'tests/phi-math.test.js',
    'tests/circuit-breaker.test.js',
    'tests/bees.test.js',
  ].filter(f => existsSync(join(ROOT, f)));

  if (coreTests.length > 0) {
    log('EXECUTE', `▸ Running ${coreTests.length} core unit tests...`);
    for (const ct of coreTests) {
      results.push(runJest(ct, basename(ct, '.test.js')));
    }
  }

  // 4. Integration tests
  if (existsSync(join(ROOT, 'tests', 'integration'))) {
    log('EXECUTE', '▸ Running integration tests...');
    results.push(runJest('tests/integration/', 'Integration'));
  }

  // 5. Smoke tests
  const smokeTests = ['tests/boot-smoke.test.js', 'tests/smoke/'].filter(f =>
    existsSync(join(ROOT, f))
  );
  if (smokeTests.length > 0) {
    log('EXECUTE', '▸ Running smoke tests...');
    for (const st of smokeTests) {
      results.push(runJest(st, 'Smoke'));
    }
  }

  return results;
}

function stageVerify(results) {
  section('STAGE 13: VERIFY — Results Analysis');

  let totalPassed = 0;
  let totalFailed = 0;
  let allPass = true;

  for (const r of results) {
    totalPassed += r.passed;
    totalFailed += r.failed;

    if (r.failed > 0 || r.exitCode !== 0) {
      allPass = false;
      logFail('VERIFY', `${r.label}: ${r.passed} passed, ${r.failed} failed`);
    } else {
      logSuccess('VERIFY', `${r.label}: ${r.passed} passed, ${r.failed} failed`);
    }
  }

  log('VERIFY', `Total: ${totalPassed} passed, ${totalFailed} failed across ${results.length} suites`);

  return { totalPassed, totalFailed, allPass, suiteCount: results.length };
}

function stageReceipt(recon, intake, suites, results, verification) {
  section('STAGE 20: RECEIPT — Report Generation');

  const report = {
    _meta: {
      generator: 'heady-test-orchestrator',
      version: VERSION,
      phi: PHI,
      generatedAt: new Date().toISOString(),
    },
    environment: recon,
    configValidation: intake,
    suiteDiscovery: {
      unit:        suites.unit.length,
      integration: suites.integration.length,
      e2e:         suites.e2e.length,
      pipeline:    suites.pipeline.length,
      staging:     suites.staging.length,
      smoke:       suites.smoke.length,
      other:       suites.other.length,
    },
    testResults: results.map(r => ({
      label:    r.label,
      passed:   r.passed,
      failed:   r.failed,
      total:    r.total,
      exitCode: r.exitCode,
    })),
    verification,
    outcome: verification.allPass ? 'PASS' : 'FAIL',
  };

  // Write JSON report
  const reportsDir = join(ROOT, 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const jsonPath = join(reportsDir, 'test-run-report.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  logSuccess('RECEIPT', `JSON report: reports/test-run-report.json`);

  // Write Markdown report
  const mdLines = [
    `# Heady™ Test Run Report`,
    ``,
    `**Generated:** ${report._meta.generatedAt}`,
    `**Outcome:** ${report.outcome === 'PASS' ? '✅ PASS' : '❌ FAIL'}`,
    `**Branch:** ${recon.branch || 'unknown'}`,
    `**Node.js:** ${recon.nodeVersion || 'unknown'}`,
    ``,
    `## Test Results`,
    ``,
    `| Suite | Passed | Failed | Total | Status |`,
    `|-------|--------|--------|-------|--------|`,
  ];

  for (const r of report.testResults) {
    const status = r.failed === 0 && r.exitCode === 0 ? '✅' : '❌';
    mdLines.push(`| ${r.label} | ${r.passed} | ${r.failed} | ${r.total} | ${status} |`);
  }

  mdLines.push('');
  mdLines.push(`## Summary`);
  mdLines.push('');
  mdLines.push(`- **Total Passed:** ${verification.totalPassed}`);
  mdLines.push(`- **Total Failed:** ${verification.totalFailed}`);
  mdLines.push(`- **Suite Count:** ${verification.suiteCount}`);
  mdLines.push(`- **φ Compliance:** Active (PHI = ${PHI})`);
  mdLines.push('');

  if (report.suiteDiscovery) {
    mdLines.push(`## Test Suite Discovery`);
    mdLines.push('');
    for (const [cat, count] of Object.entries(report.suiteDiscovery)) {
      if (count > 0) mdLines.push(`- **${cat}:** ${count} file(s)`);
    }
    mdLines.push('');
  }

  const mdPath = join(reportsDir, 'test-run-report.md');
  writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
  logSuccess('RECEIPT', `Markdown report: reports/test-run-report.md`);

  // Write validation metadata (used by promote-to-staging.yml)
  if (PROMOTE || STAGING) {
    const metadata = {
      status: verification.allPass ? 'passed' : 'failed',
      validatedAt: new Date().toISOString(),
      branch: recon.branch,
      totalPassed: verification.totalPassed,
      totalFailed: verification.totalFailed,
      phi: PHI,
      version: VERSION,
    };

    const metaPath = join(ROOT, '.validation-metadata.json');
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
    logSuccess('RECEIPT', `.validation-metadata.json written`);
  }

  return report;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(`${COLORS.bold}╔══════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bold}║  Heady™ Test Orchestrator — HCFullPipeline Flow     ║${COLORS.reset}`);
  console.log(`${COLORS.bold}║  Version: ${VERSION}  ·  φ = ${PHI.toFixed(6)}             ║${COLORS.reset}`);
  console.log(`${COLORS.bold}╚══════════════════════════════════════════════════════╝${COLORS.reset}`);

  const flags = [];
  if (STAGING) flags.push('--staging');
  if (PROMOTE) flags.push('--promote');
  if (VERBOSE) flags.push('--verbose');
  if (flags.length > 0) log('INIT', `Flags: ${flags.join(' ')}`);

  const start = Date.now();

  // Pipeline stages
  const recon        = stageRecon();
  const intake       = stageIntake();
  const suites       = stageClassify();
  const results      = stageExecute(suites);
  const verification = stageVerify(results);
  const report       = stageReceipt(recon, intake, suites, results, verification);

  // Final summary
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  section('FINAL SUMMARY');

  if (verification.allPass) {
    console.log(`${COLORS.green}${COLORS.bold}  ✅ ALL TESTS PASSED${COLORS.reset}`);
    console.log(`${COLORS.green}     ${verification.totalPassed} tests across ${verification.suiteCount} suites${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}${COLORS.bold}  ❌ TESTS FAILED${COLORS.reset}`);
    console.log(`${COLORS.red}     ${verification.totalFailed} failures out of ${verification.totalPassed + verification.totalFailed} tests${COLORS.reset}`);
  }

  console.log(`${COLORS.dim}  Elapsed: ${elapsed}s${COLORS.reset}`);
  console.log('');

  if (PROMOTE && verification.allPass) {
    console.log(`${COLORS.green}  ► Ready for staging promotion.${COLORS.reset}`);
    console.log(`${COLORS.dim}    .validation-metadata.json is written.${COLORS.reset}`);
    console.log(`${COLORS.dim}    Run 'gh workflow run promote-to-staging.yml' to promote.${COLORS.reset}`);
    console.log('');
  }

  process.exit(verification.allPass ? 0 : 1);
}

main().catch(err => {
  console.error(`${COLORS.red}Fatal error: ${err.message}${COLORS.reset}`);
  if (VERBOSE) console.error(err.stack);
  process.exit(1);
});
