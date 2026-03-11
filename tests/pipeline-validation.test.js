'use strict';

/**
 * pipeline-validation.test.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Comprehensive validation test suite for the Heady™ 10/10 ecosystem.
 * Validates internal consistency of all pipeline configuration files and
 * confirms compliance with φ-derived constants throughout.
 *
 * Runtime: Node.js built-in assert module (no external dependencies).
 * Run:     node tests/pipeline-validation.test.js
 * Exit:    0 = all tests passed, 1 = one or more failures
 * ──────────────────────────────────────────────────────────────────────────────
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ─── Phi Constants ────────────────────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PHI_POWERS = { 3: 4236, 4: 6854, 5: 11090, 6: 17944, 7: 29034, 8: 46979, 9: 76013 };
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

// ─── Known Heady™ Nodes ────────────────────────────────────────────────────────
const KNOWN_NODES = new Set([
  'HeadyConductor', 'HeadySoul', 'HeadyBrains', 'HeadyVinci', 'HeadyMemory',
  'HeadyArena', 'HeadyBee', 'HeadyGovernance', 'HeadyGuard', 'HeadyHealth',
  'HeadyDeepScan', 'HeadyPerplexity', 'HeadyAutobiographer'
]);

// ─── Canonical φ-derived stage timeouts ──────────────────────────────────────
const CANONICAL_TIMEOUTS = new Set([4236, 6854, 11090, 17944, 29034, 46979]);

// ─── Arbitrary (non-φ) timeouts that must NOT appear ─────────────────────────
const FORBIDDEN_TIMEOUTS = new Set([120000, 60000, 300000, 30000, 10000, 5000, 15000]);

// ─── File paths (relative to this file's location) ───────────────────────────
const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'configs');
const LAWS_DIR = path.join(ROOT, 'laws');

// ─── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

/**
 * Run a single named test. Increments pass/fail counters and captures
 * the error message for any assertion failure.
 *
 * @param {string} name  - Human-readable test label
 * @param {Function} fn  - Test body (may throw)
 */
function test(name, fn) {
  try {
    fn();
    passed++;
    // Uncomment the line below for verbose mode:
    // console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof assert.AssertionError
      ? `${err.message} — actual: ${JSON.stringify(err.actual)}, expected: ${JSON.stringify(err.expected)}`
      : err.message;
    failures.push(`  ✗ ${name}\n      ${msg}`);
  }
}

/**
 * Helper: assert two numbers are within tolerance of each other.
 */
function assertApprox(actual, expected, tolerance, label) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${label}: expected ≈${expected} (tolerance ±${tolerance}), got ${actual} (diff ${diff})`
  );
}

/**
 * Helper: check that a value is in the Fibonacci sequence array.
 */
function isFibonacci(n) {
  return FIB.includes(n);
}

// ─── Load config files ────────────────────────────────────────────────────────
let pipeline, cognitiveConfig, versionMap, deprecationManifest;
let loadErrors = [];

try {
  pipeline = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'hcfullpipeline.json'), 'utf8'));
} catch (e) {
  loadErrors.push(`Failed to load hcfullpipeline.json: ${e.message}`);
}

try {
  cognitiveConfig = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'heady-cognitive-config.json'), 'utf8'));
} catch (e) {
  loadErrors.push(`Failed to load heady-cognitive-config.json: ${e.message}`);
}

try {
  versionMap = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'canonical-version-map.json'), 'utf8'));
} catch (e) {
  loadErrors.push(`Failed to load canonical-version-map.json: ${e.message}`);
}

try {
  deprecationManifest = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'deprecation-manifest.json'), 'utf8'));
} catch (e) {
  loadErrors.push(`Failed to load deprecation-manifest.json: ${e.message}`);
}

if (loadErrors.length > 0) {
  console.error('\n⛔  CONFIG LOAD FAILURES — cannot continue:\n');
  loadErrors.forEach(e => console.error('  ' + e));
  process.exit(1);
}

// ─── Convenience accessors ────────────────────────────────────────────────────
const stages = pipeline.stages;
const pipelineMeta = pipeline.pipeline;
const pools = pipeline.pools;
const variants = pipeline.variants;
const arch = cognitiveConfig.cognitive_architecture;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: PIPELINE STRUCTURE TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── PIPELINE STRUCTURE TESTS ─────────────────────────────────────────────────');

test('Exactly 21 stages exist', () => {
  assert.strictEqual(
    stages.length, 21,
    `Expected 21 stages, found ${stages.length}`
  );
});

test('Stage orders are integers 0-20 with no gaps', () => {
  const orders = stages.map(s => s.order).sort((a, b) => a - b);
  for (let i = 0; i <= 20; i++) {
    assert.strictEqual(
      orders[i], i,
      `Missing stage order ${i} — found orders: ${orders.join(', ')}`
    );
  }
});

test('All stage orders are integers (no fractional values)', () => {
  stages.forEach(s => {
    assert.ok(
      Number.isInteger(s.order),
      `Stage "${s.id}" has non-integer order: ${s.order}`
    );
  });
});

test('Stage IDs are kebab-case (lowercase, hyphens only)', () => {
  const kebabRe = /^[a-z][a-z0-9-]*$/;
  stages.forEach(s => {
    assert.match(
      s.id, kebabRe,
      `Stage id "${s.id}" is not valid kebab-case`
    );
  });
});

test('Required stages have required === true', () => {
  // Stages with required: true must explicitly have true, not undefined
  stages.forEach(s => {
    if (s.required === true) {
      assert.strictEqual(s.required, true, `Stage "${s.id}" required flag mismatch`);
    }
  });
  // Specifically the well-known required stages
  const requiredIds = [
    'channel-entry', 'recon', 'intake', 'classify', 'triage', 'decompose',
    'orchestrate', 'judge', 'execute', 'verify', 'self-awareness',
    'self-critique', 'mistake-analysis', 'receipt'
  ];
  requiredIds.forEach(id => {
    const stage = stages.find(s => s.id === id);
    assert.ok(stage, `Required stage "${id}" not found`);
    assert.strictEqual(stage.required, true, `Stage "${id}" should have required: true`);
  });
});

test('No fractional order values exist in any stage', () => {
  const fractional = stages.filter(s => s.order !== Math.floor(s.order));
  assert.strictEqual(
    fractional.length, 0,
    `Stages with fractional orders: ${fractional.map(s => s.id).join(', ')}`
  );
});

test('pipeline.stageCount matches actual stage array length', () => {
  assert.strictEqual(
    pipelineMeta.stageCount, stages.length,
    `pipeline.stageCount=${pipelineMeta.stageCount} but stages array has ${stages.length} entries`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: PHI-TIMEOUT COMPLIANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── PHI-TIMEOUT COMPLIANCE TESTS ─────────────────────────────────────────────');

test('Every stage timeout is a canonical φ-derived value', () => {
  stages.forEach(s => {
    assert.ok(
      CANONICAL_TIMEOUTS.has(s.timeout),
      `Stage "${s.id}" has non-canonical timeout ${s.timeout}. ` +
      `Allowed values: ${[...CANONICAL_TIMEOUTS].join(', ')}`
    );
  });
});

test('No forbidden arbitrary timeouts appear in stage definitions', () => {
  stages.forEach(s => {
    assert.ok(
      !FORBIDDEN_TIMEOUTS.has(s.timeout),
      `Stage "${s.id}" uses forbidden arbitrary timeout ${s.timeout}`
    );
  });
});

test('Total pipeline timeout (maxDuration) is φ⁹ × 1000 rounded = 76013', () => {
  assert.strictEqual(
    pipelineMeta.maxDuration, PHI_POWERS[9],
    `pipeline.maxDuration expected ${PHI_POWERS[9]}, got ${pipelineMeta.maxDuration}`
  );
});

test('pipeline.maxDuration matches PHI_POWERS[9] = 76013', () => {
  assert.strictEqual(pipelineMeta.maxDuration, 76013);
});

test('All per-step inline timeouts are ≤ their parent stage timeout', () => {
  stages.forEach(stage => {
    (stage.steps || []).forEach(step => {
      // Check any nested timeout values in step params
      const params = step.params || {};
      Object.entries(params).forEach(([key, value]) => {
        if (
          typeof value === 'number' &&
          key.toLowerCase().includes('timeout') &&
          value > stage.timeout
        ) {
          throw new assert.AssertionError({
            message: `Step "${step.id}" in stage "${stage.id}": param.${key}=${value} exceeds stage timeout ${stage.timeout}`,
            actual: value,
            expected: `≤ ${stage.timeout}`
          });
        }
      });
    });
  });
});

test('timeouts config section phi9_pipeline_total equals 76013', () => {
  assert.strictEqual(
    pipeline.timeouts.phi9_pipeline_total, 76013,
    `timeouts.phi9_pipeline_total should be 76013`
  );
});

test('timeouts config section phi4_medium equals 6854', () => {
  assert.strictEqual(pipeline.timeouts.phi4_medium, 6854);
});

test('timeouts config section phi5_introspection equals 11090', () => {
  assert.strictEqual(pipeline.timeouts.phi5_introspection, 11090);
});

test('timeouts config section phi6_heavy equals 17944', () => {
  assert.strictEqual(pipeline.timeouts.phi6_heavy, 17944);
});

test('timeouts config section phi7_very_heavy equals 29034', () => {
  assert.strictEqual(pipeline.timeouts.phi7_very_heavy, 29034);
});

test('timeouts config section phi8_extreme equals 46979', () => {
  assert.strictEqual(pipeline.timeouts.phi8_extreme, 46979);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: PHI-BACKOFF COMPLIANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── PHI-BACKOFF COMPLIANCE TESTS ─────────────────────────────────────────────');

test('retryPolicy.multiplier ≈ 1.618 (within 0.001 tolerance)', () => {
  const multiplier = pipelineMeta.retryPolicy.multiplier;
  assertApprox(multiplier, 1.618, 0.001, 'retryPolicy.multiplier');
});

test('retryPolicy.sequence matches [1000, 1618, 2618]', () => {
  const seq = pipelineMeta.retryPolicy.sequence;
  assert.deepStrictEqual(
    seq, [1000, 1618, 2618],
    `retryPolicy.sequence expected [1000, 1618, 2618], got ${JSON.stringify(seq)}`
  );
});

test('retryPolicy.maxRetries === 3', () => {
  assert.strictEqual(
    pipelineMeta.retryPolicy.maxRetries, 3,
    `retryPolicy.maxRetries expected 3, got ${pipelineMeta.retryPolicy.maxRetries}`
  );
});

test('errorHandling.onStageFailure retryPolicy.multiplier ≈ 1.618', () => {
  assertApprox(
    pipeline.errorHandling.onStageFailure.retryPolicy.multiplier,
    1.618, 0.001,
    'errorHandling.onStageFailure.retryPolicy.multiplier'
  );
});

test('errorHandling.onStepFailure retryPolicy.sequence matches [1000, 1618, 2618]', () => {
  assert.deepStrictEqual(
    pipeline.errorHandling.onStepFailure.retryPolicy.sequence,
    [1000, 1618, 2618]
  );
});

test('retryPolicy.baseMs === 1000', () => {
  assert.strictEqual(pipelineMeta.retryPolicy.baseMs, 1000);
});

test('retryPolicy.jitterFactor ≈ 0.382 (ψ²)', () => {
  assertApprox(
    pipelineMeta.retryPolicy.jitterFactor, 0.382, 0.001,
    'retryPolicy.jitterFactor'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: POOL SIZE TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── POOL SIZE TESTS ──────────────────────────────────────────────────────────');

test('bee_workers.default is a Fibonacci number', () => {
  const val = pools.bee_workers.default;
  assert.ok(isFibonacci(val), `bee_workers.default=${val} is not in FIB: ${FIB.join(', ')}`);
});

test('bee_workers.max is a Fibonacci number', () => {
  const val = pools.bee_workers.max;
  assert.ok(isFibonacci(val), `bee_workers.max=${val} is not in FIB: ${FIB.join(', ')}`);
});

test('bee_workers.ttl is a Fibonacci number', () => {
  const val = pools.bee_workers.ttl;
  assert.ok(isFibonacci(val), `bee_workers.ttl=${val} is not in FIB: ${FIB.join(', ')}`);
});

test('concurrent_requests.max is a Fibonacci number', () => {
  const val = pools.concurrent_requests.max;
  assert.ok(isFibonacci(val), `concurrent_requests.max=${val} is not in FIB: ${FIB.join(', ')}`);
});

test('cost_usd.max is a Fibonacci number', () => {
  const val = pools.cost_usd.max;
  assert.ok(isFibonacci(val), `cost_usd.max=${val} is not in FIB: ${FIB.join(', ')}`);
});

test('bee_workers.default < bee_workers.max (sane ordering)', () => {
  assert.ok(
    pools.bee_workers.default < pools.bee_workers.max,
    `bee_workers.default (${pools.bee_workers.default}) should be < max (${pools.bee_workers.max})`
  );
});

test('concurrent_requests.default is a Fibonacci number', () => {
  const val = pools.concurrent_requests.default;
  assert.ok(isFibonacci(val), `concurrent_requests.default=${val} is not in FIB: ${FIB.join(', ')}`);
});

test('concurrent_requests.default < concurrent_requests.max', () => {
  assert.ok(
    pools.concurrent_requests.default < pools.concurrent_requests.max,
    `concurrent_requests.default (${pools.concurrent_requests.default}) should be < max (${pools.concurrent_requests.max})`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: STAGE STEP TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── STAGE STEP TESTS ─────────────────────────────────────────────────────────');

test('Every stage has at least 1 step', () => {
  stages.forEach(s => {
    assert.ok(
      Array.isArray(s.steps) && s.steps.length >= 1,
      `Stage "${s.id}" has no steps (steps=${JSON.stringify(s.steps)})`
    );
  });
});

test('Every step has id, name, node, and action fields', () => {
  stages.forEach(stage => {
    stage.steps.forEach(step => {
      ['id', 'name', 'node', 'action'].forEach(field => {
        assert.ok(
          step[field] !== undefined && step[field] !== null && step[field] !== '',
          `Step "${step.id || '(unnamed)'}" in stage "${stage.id}" is missing or empty field: ${field}`
        );
      });
    });
  });
});

test('Every step.node references a known Heady node', () => {
  stages.forEach(stage => {
    stage.steps.forEach(step => {
      assert.ok(
        KNOWN_NODES.has(step.node),
        `Step "${step.id}" in stage "${stage.id}" references unknown node "${step.node}". ` +
        `Known nodes: ${[...KNOWN_NODES].join(', ')}`
      );
    });
  });
});

test('Every step.id is unique within its stage', () => {
  stages.forEach(stage => {
    const ids = stage.steps.map(s => s.id);
    const unique = new Set(ids);
    assert.strictEqual(
      unique.size, ids.length,
      `Stage "${stage.id}" has duplicate step IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`
    );
  });
});

test('All step.action fields are non-empty strings', () => {
  stages.forEach(stage => {
    stage.steps.forEach(step => {
      assert.ok(
        typeof step.action === 'string' && step.action.length > 0,
        `Step "${step.id}" in stage "${stage.id}" has invalid action: ${step.action}`
      );
    });
  });
});

test('Total step count across all stages is > 21 (at least 1 per stage)', () => {
  const totalSteps = stages.reduce((sum, s) => sum + s.steps.length, 0);
  assert.ok(
    totalSteps > 21,
    `Total step count ${totalSteps} should be > 21`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: PIPELINE VARIANT TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── PIPELINE VARIANT TESTS ───────────────────────────────────────────────────');

test('Exactly 4 variants exist: fast_path, full_path, arena_path, learning_path', () => {
  const variantKeys = Object.keys(variants).sort();
  const expected = ['arena_path', 'fast_path', 'full_path', 'learning_path'];
  assert.deepStrictEqual(
    variantKeys, expected,
    `Variant keys mismatch. Expected ${expected.join(', ')}, got ${variantKeys.join(', ')}`
  );
});

test('full_path contains all 21 stage numbers (0-20)', () => {
  const fullStages = variants.full_path.stages;
  assert.strictEqual(
    fullStages.length, 21,
    `full_path.stages should have 21 entries, has ${fullStages.length}`
  );
  for (let i = 0; i <= 20; i++) {
    assert.ok(
      fullStages.includes(i),
      `full_path is missing stage ${i}`
    );
  }
});

test('fast_path stages are a subset of full_path stages', () => {
  const fullSet = new Set(variants.full_path.stages);
  variants.fast_path.stages.forEach(n => {
    assert.ok(
      fullSet.has(n),
      `fast_path stage ${n} is not present in full_path`
    );
  });
});

test('arena_path stages are a subset of full_path stages', () => {
  const fullSet = new Set(variants.full_path.stages);
  variants.arena_path.stages.forEach(n => {
    assert.ok(
      fullSet.has(n),
      `arena_path stage ${n} is not present in full_path`
    );
  });
});

test('learning_path stages are a subset of full_path stages', () => {
  const fullSet = new Set(variants.full_path.stages);
  variants.learning_path.stages.forEach(n => {
    assert.ok(
      fullSet.has(n),
      `learning_path stage ${n} is not present in full_path`
    );
  });
});

test('All variant stage numbers are valid integers in range 0-20', () => {
  Object.entries(variants).forEach(([name, variant]) => {
    variant.stages.forEach(n => {
      assert.ok(
        Number.isInteger(n) && n >= 0 && n <= 20,
        `Variant "${name}" contains invalid stage number: ${n}`
      );
    });
  });
});

test('Every variant has stages, description, riskLevel, and estimatedMs fields', () => {
  Object.entries(variants).forEach(([name, variant]) => {
    ['stages', 'description', 'riskLevel', 'estimatedMs'].forEach(field => {
      assert.ok(
        variant[field] !== undefined,
        `Variant "${name}" is missing required field: ${field}`
      );
    });
  });
});

test('fast_path has fewer stages than full_path (is a genuine shortcut)', () => {
  assert.ok(
    variants.fast_path.stages.length < variants.full_path.stages.length,
    `fast_path (${variants.fast_path.stages.length} stages) should have fewer stages than full_path (${variants.full_path.stages.length})`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: COGNITIVE CONFIG TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── COGNITIVE CONFIG TESTS ───────────────────────────────────────────────────');

test('cognitive_architecture version is "3.0.0"', () => {
  assert.strictEqual(
    arch.version, '3.0.0',
    `cognitive_architecture.version expected "3.0.0", got "${arch.version}"`
  );
});

test('All 7 cognitive layers exist with correct names', () => {
  const expectedLayers = [
    'owl_wisdom', 'eagle_omniscience', 'dolphin_creativity',
    'rabbit_multiplication', 'ant_task', 'elephant_memory', 'beaver_build'
  ];
  const actualLayers = Object.keys(arch.layers);
  expectedLayers.forEach(layer => {
    assert.ok(
      actualLayers.includes(layer),
      `Cognitive layer "${layer}" is missing. Found: ${actualLayers.join(', ')}`
    );
  });
  assert.strictEqual(
    actualLayers.length, 7,
    `Expected exactly 7 layers, found ${actualLayers.length}: ${actualLayers.join(', ')}`
  );
});

test('CRITICAL layers have min_confidence === 0.618', () => {
  Object.entries(arch.layers).forEach(([name, layer]) => {
    if (layer.priority === 'CRITICAL') {
      assertApprox(
        layer.min_confidence, 0.618, 0.001,
        `CRITICAL layer "${name}" min_confidence`
      );
    }
  });
});

test('HIGH layers have min_confidence === 0.500', () => {
  Object.entries(arch.layers).forEach(([name, layer]) => {
    if (layer.priority === 'HIGH') {
      assertApprox(
        layer.min_confidence, 0.500, 0.001,
        `HIGH layer "${name}" min_confidence`
      );
    }
  });
});

test('All 7 cognitive layers are enabled', () => {
  Object.entries(arch.layers).forEach(([name, layer]) => {
    assert.strictEqual(layer.enabled, true, `Layer "${name}" should be enabled`);
  });
});

test('All 7 cognitive layers are immutable', () => {
  Object.entries(arch.layers).forEach(([name, layer]) => {
    assert.strictEqual(layer.immutable, true, `Layer "${name}" should be immutable`);
  });
});

test('All 8 laws exist with correct keys', () => {
  const expectedLawKeys = [
    '1_thoroughness_over_speed',
    '2_solutions_not_workarounds',
    '3_context_maximization',
    '4_implementation_completeness',
    '5_cross_environment_purity',
    '6_ten_thousand_bee_scale',
    '7_auto_success_integrity',
    '8_arena_mode_default'
  ];
  const actualKeys = Object.keys(arch.laws);
  expectedLawKeys.forEach(key => {
    assert.ok(
      actualKeys.includes(key),
      `Law key "${key}" is missing from cognitive config. Found: ${actualKeys.join(', ')}`
    );
  });
  assert.strictEqual(
    actualKeys.length, 8,
    `Expected exactly 8 laws, found ${actualKeys.length}`
  );
});

test('Every law has a spec_file field', () => {
  Object.entries(arch.laws).forEach(([key, law]) => {
    assert.ok(
      typeof law.spec_file === 'string' && law.spec_file.length > 0,
      `Law "${key}" is missing or has empty spec_file field`
    );
  });
});

test('Every law has enforcement, overridable, and description fields', () => {
  Object.entries(arch.laws).forEach(([key, law]) => {
    ['enforcement', 'overridable', 'description'].forEach(field => {
      assert.ok(
        law[field] !== undefined,
        `Law "${key}" is missing field: ${field}`
      );
    });
  });
});

test('phi_constants.phi ≈ 1.618 (within 0.001)', () => {
  assertApprox(arch.phi_constants.phi, PHI, 0.001, 'phi_constants.phi');
});

test('phi_constants.inverse_phi ≈ 0.618 (within 0.001)', () => {
  assertApprox(arch.phi_constants.inverse_phi, PSI, 0.001, 'phi_constants.inverse_phi');
});

test('csl_thresholds section exists with MINIMUM, LOW, MEDIUM, HIGH, CRITICAL', () => {
  const csl = arch.csl_thresholds;
  assert.ok(csl, 'csl_thresholds section is missing');
  ['MINIMUM', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].forEach(level => {
    assert.ok(
      csl[level] !== undefined,
      `csl_thresholds.${level} is missing`
    );
  });
});

test('csl_thresholds values are ordered: MINIMUM < LOW < MEDIUM < HIGH < CRITICAL', () => {
  const csl = arch.csl_thresholds;
  assert.ok(csl.MINIMUM < csl.LOW, `MINIMUM (${csl.MINIMUM}) should be < LOW (${csl.LOW})`);
  assert.ok(csl.LOW < csl.MEDIUM, `LOW (${csl.LOW}) should be < MEDIUM (${csl.MEDIUM})`);
  assert.ok(csl.MEDIUM < csl.HIGH, `MEDIUM (${csl.MEDIUM}) should be < HIGH (${csl.HIGH})`);
  assert.ok(csl.HIGH < csl.CRITICAL, `HIGH (${csl.HIGH}) should be < CRITICAL (${csl.CRITICAL})`);
});

test('resource_allocation percentages sum to ≈ 81 (34+21+13+8+5)', () => {
  const ra = arch.resource_allocation;
  const sum = ra.hot_pool_pct + ra.warm_pool_pct + ra.cold_pool_pct +
              ra.reserve_pool_pct + ra.governance_pool_pct;
  assertApprox(sum, 81, 1, 'resource_allocation sum');
});

test('resource_allocation values match Fibonacci-ratio percentages: 34, 21, 13, 8, 5', () => {
  const ra = arch.resource_allocation;
  assert.strictEqual(ra.hot_pool_pct, 34, `hot_pool_pct should be 34`);
  assert.strictEqual(ra.warm_pool_pct, 21, `warm_pool_pct should be 21`);
  assert.strictEqual(ra.cold_pool_pct, 13, `cold_pool_pct should be 13`);
  assert.strictEqual(ra.reserve_pool_pct, 8, `reserve_pool_pct should be 8`);
  assert.strictEqual(ra.governance_pool_pct, 5, `governance_pool_pct should be 5`);
});

test('scale.pipeline_stages === 21', () => {
  assert.strictEqual(arch.scale.pipeline_stages, 21);
});

test('scale.auto_success_tasks === 135', () => {
  assert.strictEqual(arch.scale.auto_success_tasks, 135);
});

test('scale.auto_success_categories === 9', () => {
  assert.strictEqual(arch.scale.auto_success_categories, 9);
});

test('scale.auto_success_cycle_ms === 30000 (30-second heartbeat)', () => {
  assert.strictEqual(arch.scale.auto_success_cycle_ms, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: LAW FILE TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── LAW FILE TESTS ───────────────────────────────────────────────────────────');

const LAW_FILES = [
  'LAW-01-thoroughness-over-speed.md',
  'LAW-02-solutions-not-workarounds.md',
  'LAW-03-context-maximization.md',
  'LAW-04-implementation-completeness.md',
  'LAW-05-cross-environment-purity.md',
  'LAW-06-ten-thousand-bee-scale.md',
  'LAW-07-auto-success-engine.md',
  'LAW-08-arena-mode-default.md'
];

test('All 8 LAW files exist (LAW-01 through LAW-08)', () => {
  LAW_FILES.forEach(filename => {
    const filePath = path.join(LAWS_DIR, filename);
    assert.ok(
      fs.existsSync(filePath),
      `LAW file not found: ${filePath}`
    );
  });
});

test('Each LAW file has YAML frontmatter with enforcement field', () => {
  LAW_FILES.forEach(filename => {
    const filePath = path.join(LAWS_DIR, filename);
    if (!fs.existsSync(filePath)) return; // guard (existence tested above)
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(
      content.startsWith('---'),
      `${filename}: does not start with YAML frontmatter delimiter "---"`
    );
    assert.ok(
      content.includes('enforcement:'),
      `${filename}: YAML frontmatter missing "enforcement:" field`
    );
  });
});

test('Each LAW file has law_number in frontmatter matching its filename number', () => {
  LAW_FILES.forEach((filename, idx) => {
    const expectedNumber = idx + 1; // LAW-01 → 1, LAW-02 → 2, etc.
    const filePath = path.join(LAWS_DIR, filename);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    // Extract YAML frontmatter block
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fmMatch, `${filename}: could not extract YAML frontmatter`);
    const fm = fmMatch[1];
    // Find law_number line
    const lnMatch = fm.match(/law_number:\s*(\d+)/);
    assert.ok(lnMatch, `${filename}: frontmatter missing "law_number:" field`);
    assert.strictEqual(
      parseInt(lnMatch[1], 10), expectedNumber,
      `${filename}: law_number ${lnMatch[1]} does not match expected ${expectedNumber}`
    );
  });
});

test('LAW-07 specifically references "135" tasks', () => {
  const filePath = path.join(LAWS_DIR, 'LAW-07-auto-success-engine.md');
  if (!fs.existsSync(filePath)) {
    throw new Error('LAW-07 file not found');
  }
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(
    content.includes('135'),
    'LAW-07 should reference "135" (total background tasks)'
  );
});

test('LAW-07 specifically references "9 categories"', () => {
  const filePath = path.join(LAWS_DIR, 'LAW-07-auto-success-engine.md');
  if (!fs.existsSync(filePath)) {
    throw new Error('LAW-07 file not found');
  }
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(
    content.includes('9 categories'),
    'LAW-07 should reference "9 categories"'
  );
});

test('LAW-07 specifically references "30-second" cycle', () => {
  const filePath = path.join(LAWS_DIR, 'LAW-07-auto-success-engine.md');
  if (!fs.existsSync(filePath)) {
    throw new Error('LAW-07 file not found');
  }
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(
    content.includes('30-second') || content.includes('30 second'),
    'LAW-07 should reference "30-second" cycle'
  );
});

test('Each LAW file is non-empty (> 100 bytes)', () => {
  LAW_FILES.forEach(filename => {
    const filePath = path.join(LAWS_DIR, filename);
    if (!fs.existsSync(filePath)) return;
    const size = fs.statSync(filePath).size;
    assert.ok(
      size > 100,
      `${filename} appears too small (${size} bytes) — may be empty or stub`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: DEPRECATION MANIFEST TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── DEPRECATION MANIFEST TESTS ───────────────────────────────────────────────');

const deprecations = deprecationManifest.deprecations;
const manifestMeta = deprecationManifest._meta;

test('deprecations array exists and has > 0 entries', () => {
  assert.ok(
    Array.isArray(deprecations) && deprecations.length > 0,
    `deprecations should be a non-empty array, got: ${JSON.stringify(deprecations)}`
  );
});

test('Every deprecation has file, status, replacedBy, and deadline fields', () => {
  deprecations.forEach(dep => {
    ['file', 'status', 'replacedBy', 'deadline'].forEach(field => {
      assert.ok(
        dep[field] !== undefined && dep[field] !== null && dep[field] !== '',
        `Deprecation "${dep.id || dep.file}" missing or empty field: ${field}`
      );
    });
  });
});

test('All deprecation statuses are "DEPRECATED"', () => {
  deprecations.forEach(dep => {
    assert.strictEqual(
      dep.status, 'DEPRECATED',
      `Deprecation "${dep.id}" has unexpected status: "${dep.status}"`
    );
  });
});

test('All deadlines are within 13 days of the generation date (fib(7) = 13)', () => {
  const generatedAt = new Date(manifestMeta.generatedAt);
  const maxDays = manifestMeta.maxDeprecationDays || 13;

  deprecations.forEach(dep => {
    const deadline = new Date(dep.deadline);
    const diffMs = deadline.getTime() - generatedAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    assert.ok(
      diffDays >= 0 && diffDays <= maxDays,
      `Deprecation "${dep.id}": deadline "${dep.deadline}" is ${diffDays.toFixed(1)} days from generatedAt "${manifestMeta.generatedAt}". Must be within ${maxDays} days.`
    );
  });
});

test('Every deprecation id is unique', () => {
  const ids = deprecations.map(d => d.id);
  const unique = new Set(ids);
  assert.strictEqual(
    unique.size, ids.length,
    `Duplicate deprecation IDs found: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`
  );
});

test('Every deprecation has at least 1 migration step', () => {
  deprecations.forEach(dep => {
    assert.ok(
      Array.isArray(dep.migrationSteps) && dep.migrationSteps.length >= 1,
      `Deprecation "${dep.id}" has no migrationSteps`
    );
  });
});

// Build the set of all canonical file paths from the version map for cross-reference
const canonicalFilePaths = new Set();
if (versionMap && versionMap.components) {
  Object.values(versionMap.components).forEach(component => {
    if (component.canonical && component.canonical.path) {
      canonicalFilePaths.add(component.canonical.path);
    }
  });
}

test('Every deprecation.replacedBy is listed as canonical in canonical-version-map.json', () => {
  deprecations.forEach(dep => {
    assert.ok(
      canonicalFilePaths.has(dep.replacedBy),
      `Deprecation "${dep.id}": replacedBy "${dep.replacedBy}" is not a canonical path in version map. ` +
      `Known canonicals: ${[...canonicalFilePaths].join(', ')}`
    );
  });
});

test('summary.totalDeprecations matches actual deprecations array length', () => {
  if (deprecationManifest.summary) {
    assert.strictEqual(
      deprecationManifest.summary.totalDeprecations, deprecations.length,
      `summary.totalDeprecations (${deprecationManifest.summary.totalDeprecations}) ≠ actual length (${deprecations.length})`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: CANONICAL VERSION MAP TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── CANONICAL VERSION MAP TESTS ──────────────────────────────────────────────');

const components = versionMap.components;

test('components object exists in canonical-version-map.json', () => {
  assert.ok(
    components && typeof components === 'object',
    'canonical-version-map.json must have a top-level "components" object'
  );
});

test('Every component has exactly one canonical entry', () => {
  Object.entries(components).forEach(([name, component]) => {
    assert.ok(
      component.canonical && component.canonical.path,
      `Component "${name}" is missing a canonical entry with a path field`
    );
  });
});

test('Every deprecated entry has a migratedTo field', () => {
  Object.entries(components).forEach(([name, component]) => {
    (component.deprecated || []).forEach(dep => {
      assert.ok(
        dep.migratedTo && dep.migratedTo.length > 0,
        `Component "${name}" deprecated entry "${dep.path}" is missing migratedTo field`
      );
    });
  });
});

test('No file appears as both canonical and deprecated within the same component', () => {
  Object.entries(components).forEach(([name, component]) => {
    const canonicalPath = component.canonical && component.canonical.path;
    (component.deprecated || []).forEach(dep => {
      assert.notStrictEqual(
        dep.path, canonicalPath,
        `Component "${name}": file "${dep.path}" appears as both canonical and deprecated`
      );
    });
  });
});

test('No canonical path appears as a deprecated path in any component', () => {
  // Collect all deprecated paths across all components
  const allDeprecatedPaths = new Set();
  Object.values(components).forEach(component => {
    (component.deprecated || []).forEach(dep => {
      allDeprecatedPaths.add(dep.path);
    });
  });

  // Assert no canonical is in the deprecated set
  Object.entries(components).forEach(([name, component]) => {
    const canonicalPath = component.canonical && component.canonical.path;
    if (canonicalPath) {
      assert.ok(
        !allDeprecatedPaths.has(canonicalPath),
        `Component "${name}": canonical path "${canonicalPath}" also appears as a deprecated path`
      );
    }
  });
});

test('Every deprecated entry has an action field', () => {
  Object.entries(components).forEach(([name, component]) => {
    (component.deprecated || []).forEach(dep => {
      assert.ok(
        dep.action && dep.action.length > 0,
        `Component "${name}" deprecated entry "${dep.path}" missing action field`
      );
    });
  });
});

test('Every deprecated entry migratedTo path is a canonical path in the version map', () => {
  Object.entries(components).forEach(([name, component]) => {
    (component.deprecated || []).forEach(dep => {
      assert.ok(
        canonicalFilePaths.has(dep.migratedTo),
        `Component "${name}" deprecated "${dep.path}": migratedTo "${dep.migratedTo}" is not a canonical path in the version map`
      );
    });
  });
});

test('_meta.version is present in canonical-version-map.json', () => {
  assert.ok(
    versionMap._meta && versionMap._meta.version,
    'canonical-version-map.json missing _meta.version'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: CROSS-FILE CONSISTENCY TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── CROSS-FILE CONSISTENCY TESTS ─────────────────────────────────────────────');

test('pipeline phiRef.phi matches cognitive_architecture phi_constants.phi', () => {
  assertApprox(
    pipeline._meta.phiRef.phi,
    arch.phi_constants.phi,
    0.0000001,
    'PHI cross-file consistency'
  );
});

test('pipeline phiRef.psi matches cognitive_architecture phi_constants.inverse_phi', () => {
  assertApprox(
    pipeline._meta.phiRef.psi,
    arch.phi_constants.inverse_phi,
    0.0000001,
    'PSI cross-file consistency'
  );
});

test('Number of stages in full_path equals total stages array length', () => {
  assert.strictEqual(
    variants.full_path.stages.length, stages.length,
    `full_path has ${variants.full_path.stages.length} stages but pipeline has ${stages.length} stages`
  );
});

test('cognitive_architecture laws spec_file paths reference recognizable LAW files', () => {
  Object.entries(arch.laws).forEach(([key, law]) => {
    assert.ok(
      law.spec_file.startsWith('laws/LAW-') && law.spec_file.endsWith('.md'),
      `Law "${key}" spec_file "${law.spec_file}" does not match expected pattern "laws/LAW-XX-*.md"`
    );
  });
});

test('pipeline cslGates MINIMUM and LOW match cognitive csl_thresholds', () => {
  assertApprox(
    pipeline.pipeline.cslGates.MINIMUM, arch.csl_thresholds.MINIMUM, 0.001,
    'cslGates.MINIMUM vs csl_thresholds.MINIMUM'
  );
  assertApprox(
    pipeline.pipeline.cslGates.LOW, arch.csl_thresholds.LOW, 0.001,
    'cslGates.LOW vs csl_thresholds.LOW'
  );
});

test('pipeline cslGates CRITICAL matches cognitive csl_thresholds.CRITICAL', () => {
  assertApprox(
    pipeline.pipeline.cslGates.CRITICAL, arch.csl_thresholds.CRITICAL, 0.001,
    'cslGates.CRITICAL vs csl_thresholds.CRITICAL'
  );
});

test('deprecation_manifest generatedAt date is parseable', () => {
  const d = new Date(manifestMeta.generatedAt);
  assert.ok(!isNaN(d.getTime()), `generatedAt "${manifestMeta.generatedAt}" is not a valid date`);
});

test('deprecation deadline date is parseable for all entries', () => {
  deprecations.forEach(dep => {
    const d = new Date(dep.deadline);
    assert.ok(!isNaN(d.getTime()), `Deprecation "${dep.id}" has unparseable deadline: "${dep.deadline}"`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FINAL SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log('\n' + '─'.repeat(80));

if (failures.length > 0) {
  console.log('\nFAILED TESTS:\n');
  failures.forEach(f => console.log(f));
  console.log('');
}

console.log(`PIPELINE VALIDATION: ${passed}/${total} tests passed`);

if (failed === 0) {
  console.log('✓ All tests passed. Heady ecosystem meets the 10/10 health standard.');
} else {
  console.log(`✗ ${failed} test(s) failed. Review failures above and correct config files.`);
}

console.log('─'.repeat(80) + '\n');

process.exit(failed > 0 ? 1 : 0);
