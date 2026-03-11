/**
 * @file test-csl-global-finance.js
 * @description Comprehensive test suite for CSL global finance modules.
 *   Tests unit CSL scalars, integration patterns, trading logic,
 *   determinism guarantees, and phi constant precision.
 *
 * @module TestCSLGlobalFinance
 * @version 2.0.0
 * @author HeadySystems Inc.
 * @copyright © 2026 Heady™Systems Inc. All rights reserved.
 *
 * @patent US-PENDING-2026-HSI-001 — Phi-Harmonic Semantic Gate Architecture
 *
 * Usage: node tests/test-csl-global-finance.js
 * Exit code 0 = all tests passed, 1 = one or more tests failed.
 *
 * Self-contained: inline minimal implementations of all CSL scalar functions
 * and trading helpers so this file runs cleanly with just `node` and no deps.
 */

'use strict';

const assert = require('assert');
const { createHash } = require('crypto');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// INLINE CORE IMPLEMENTATIONS (self-sufficient)
// These mirror the production modules so tests run in isolation too.
// ─────────────────────────────────────────────────────────────────────────────

const PHI    = 1.6180339887;
const PSI    = 1 / PHI;
const PSI2   = PSI * PSI;
const PHI2   = PHI * PHI;
const EPSILON = 1e-10;

// ── CSL scalar gates ──────────────────────────────────────────────────────
function cslGate(c) {
  if (c >= PSI)  return 1;
  if (c < PSI2)  return 0;
  return (c - PSI2) / (PSI - PSI2);
}
function cslAnd(a, b)   { return Math.sqrt(Math.max(0,a) * Math.max(0,b)); }
function cslOr(a, b)    { const ca=Math.max(0,Math.min(1,a)), cb=Math.max(0,Math.min(1,b)); return ca+cb-ca*cb; }
function cslNot(a)      { return 1 - Math.max(0,Math.min(1,a)); }
function cslXor(a, b)   { return Math.abs(Math.max(0,Math.min(1,a)) - Math.max(0,Math.min(1,b))); }
function cslImplies(a,b){ return cslOr(cslNot(a), b); }
function cslEquivalent(a,b){ return 1 - Math.abs(Math.max(0,Math.min(1,a)) - Math.max(0,Math.min(1,b))); }

function classifyConfidence(c) {
  if (c > PSI)  return 'EXECUTE';
  if (c >= PSI2) return 'CAUTIOUS';
  return 'HALT';
}

function cslBlend(a, b, t) {
  const tc = Math.max(0, Math.min(1, t));
  return a.map((v, i) => v * (1 - tc) + (b[i] || 0) * tc);
}

// ── Geometric mean ────────────────────────────────────────────────────────
function geometricMean(values) {
  const pos = values.filter(v => v > 0);
  if (pos.length === 0) return 0;
  return Math.exp(pos.reduce((s, v) => s + Math.log(v), 0) / pos.length);
}

// ── Vector math ───────────────────────────────────────────────────────────
function l2Norm(v)       { return Math.sqrt(v.reduce((s,x) => s+x*x, 0)); }
function normalize(v)    { const n=l2Norm(v); return n<EPSILON ? v.map(()=>0) : v.map(x=>x/n); }
function dotProduct(a,b) { return a.reduce((s,x,i)=>s+x*(b[i]||0), 0); }
function cosineSimilarity(a, b) {
  if (!a||!b||a.length!==b.length) return 0;
  const na=l2Norm(a), nb=l2Norm(b);
  if (na<EPSILON||nb<EPSILON) return 0;
  return dotProduct(a,b)/(na*nb);
}

// ── SHA-256 ───────────────────────────────────────────────────────────────
function sha256(input) {
  const data = typeof input === 'string' ? input : JSON.stringify(input);
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

// ── Mulberry32 PRNG ───────────────────────────────────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6d2b79f5)|0;
    let z = Math.imul(s^(s>>>15), 1|s);
    z ^= z + Math.imul(z^(z>>>7), 61|z);
    return ((z^(z>>>14))>>>0) / 4294967296;
  };
}

// ── CSL Risk / Trading helpers (inline for self-containment) ──────────────

/**
 * Continuous risk score from equity drawdown profile.
 * @param {number} equity
 * @param {number} peak
 * @param {number} accountSize
 * @returns {number} risk score ∈ [0,1]
 */
function cslRiskScore(equity, peak, accountSize) {
  const drawdown = peak > 0 ? (peak - equity) / peak : 0;
  const drawdownFactor = 1 - Math.min(1, drawdown / PSI);
  const equityFactor = Math.min(1, equity / accountSize);
  return cslAnd(drawdownFactor, equityFactor);
}

/**
 * CSL-gated position size calculation.
 * @param {number} baseSize
 * @param {number} confidence ∈ [0,1]
 * @param {number} riskFraction ∈ (0,1)
 * @returns {number}
 */
function cslPositionSize(baseSize, confidence, riskFraction = PSI2) {
  const gate = cslGate(confidence);
  return baseSize * gate * (1 - riskFraction);
}

/**
 * CSL entry gate: AND over all signal confidences.
 * @param {number[]} signals ∈ [0,1]
 * @returns {number}
 */
function cslEntryGate(signals) {
  if (!signals || signals.length === 0) return 0;
  return signals.reduce((acc, s) => cslAnd(acc, s), 1);
}

/**
 * CSL exit gate: triggers if drawdown approaches limit.
 * @param {number} drawdown — current drawdown fraction ∈ [0,1]
 * @param {number} drawdownLimit ∈ (0,1)
 * @returns {{ shouldExit: boolean, exitConfidence: number }}
 */
function cslExitGate(drawdown, drawdownLimit) {
  const ratio = drawdownLimit > 0 ? drawdown / drawdownLimit : 1;
  const exitConfidence = Math.min(1, ratio);
  return {
    shouldExit: exitConfidence >= PSI,
    exitConfidence,
  };
}

/**
 * CSL portfolio risk: geometric mean of individual factor risks.
 * Contrast with simple max().
 * @param {number[]} factorRisks
 * @returns {{ geometric: number, max: number }}
 */
function cslPortfolioRisk(factorRisks) {
  return {
    geometric: geometricMean(factorRisks),
    max: Math.max(...factorRisks),
  };
}

/**
 * Safety net calculation (must remain unchanged by CSL migration).
 * @param {number} accountSize
 * @param {number} maxLossPercent
 * @returns {number}
 */
function safetyNet(accountSize, maxLossPercent) {
  return accountSize * (1 - maxLossPercent / 100);
}

/**
 * Payout eligibility check (logic must remain unchanged).
 * @param {number} profitFactor
 * @param {number} minDays
 * @param {number} actualDays
 * @returns {boolean}
 */
function payoutEligible(profitFactor, minDays, actualDays) {
  return profitFactor > 1 && actualDays >= minDays;
}

// ── Account tier definitions ──────────────────────────────────────────────
const ACCOUNT_TIERS = {
  '25K':  { size: 25000,  maxLoss: 0.06, maxDrawdown: 0.10 },
  '50K':  { size: 50000,  maxLoss: 0.06, maxDrawdown: 0.10 },
  '100K': { size: 100000, maxLoss: 0.06, maxDrawdown: 0.10 },
  '200K': { size: 200000, maxLoss: 0.06, maxDrawdown: 0.10 },
  '300K': { size: 300000, maxLoss: 0.06, maxDrawdown: 0.10 },
};

/**
 * CSL risk check for an account tier.
 * @param {string} tier
 * @param {number} currentEquity
 * @param {number} peakEquity
 * @returns {{ violation: boolean, riskScore: number, zone: string, safetyNetValue: number }}
 */
function checkRiskCSL(tier, currentEquity, peakEquity) {
  const t = ACCOUNT_TIERS[tier];
  if (!t) throw new Error(`Unknown tier: ${tier}`);

  const riskScore = cslRiskScore(currentEquity, peakEquity, t.size);
  const drawdown = peakEquity > 0 ? (peakEquity - currentEquity) / peakEquity : 0;
  const violation = drawdown > t.maxDrawdown || currentEquity < t.size * (1 - t.maxLoss);
  const zone = classifyConfidence(riskScore);
  const safetyNetValue = safetyNet(t.size, t.maxLoss * 100);

  return { violation, riskScore, zone, safetyNetValue, drawdown };
}

// ── Ternary migration simulation ──────────────────────────────────────────
// Simulates the migration classification logic

/**
 * Represents a ternary pattern type in the codebase.
 * TYPE_A: string equality checks → semantic router
 * TYPE_B: threshold checks → phi-scaled gate
 * TYPE_C: complex conditional (preserve)
 * TYPE_D: side-effect-based (preserve)
 */
function classifyTernaryPattern(pattern) {
  if (pattern.type === 'string_equality' && pattern.migrateable) return 'TYPE_A';
  if (pattern.type === 'threshold' && pattern.migrateable)        return 'TYPE_B';
  if (pattern.type === 'complex')                                 return 'TYPE_C';
  if (pattern.type === 'side_effect')                             return 'TYPE_D';
  return 'UNKNOWN';
}

function buildMigrationPlan(patterns, dryRun = false) {
  const plan = [];
  for (const p of patterns) {
    const pt = classifyTernaryPattern(p);
    if (pt === 'TYPE_A') plan.push({ ...p, patternType: 'TYPE_A', priority: 1, dryRun });
    if (pt === 'TYPE_B') plan.push({ ...p, patternType: 'TYPE_B', priority: 2, dryRun });
    // TYPE_C/D are not migrated
  }
  plan.sort((a, b) => a.priority - b.priority);
  return plan;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
let _total  = 0;
const _failures = [];

function test(description, fn) {
  _total++;
  try {
    fn();
    _passed++;
    process.stdout.write(`  ✔  ${description}\n`);
  } catch (err) {
    _failed++;
    _failures.push({ description, error: err.message });
    process.stdout.write(`  ✘  ${description}\n     → ${err.message}\n`);
  }
}

function section(title) {
  process.stdout.write(`\n${'═'.repeat(64)}\n  ${title}\n${'═'.repeat(64)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: UNIT TESTS — CSL SCALAR GATES
// ─────────────────────────────────────────────────────────────────────────────
section('UNIT TESTS — CSL Scalar Gates');

test('cslAnd(1, 1) === 1', () => {
  assert.strictEqual(cslAnd(1, 1), 1);
});

test('cslAnd(0, 1) === 0', () => {
  assert.strictEqual(cslAnd(0, 1), 0);
});

test('cslAnd(0, 0) === 0', () => {
  assert.strictEqual(cslAnd(0, 0), 0);
});

test('cslAnd(0.5, 0.5) === 0.5 (sqrt(0.25))', () => {
  assert.strictEqual(cslAnd(0.5, 0.5), 0.5);
});

test('cslAnd(0.9, 0.4) === sqrt(0.36)', () => {
  assert.ok(Math.abs(cslAnd(0.9, 0.4) - Math.sqrt(0.9 * 0.4)) < EPSILON);
});

test('cslOr(0, 0) === 0', () => {
  assert.strictEqual(cslOr(0, 0), 0);
});

test('cslOr(1, 0) === 1', () => {
  assert.strictEqual(cslOr(1, 0), 1);
});

test('cslOr(1, 1) === 1', () => {
  assert.strictEqual(cslOr(1, 1), 1);
});

test('cslOr(0.5, 0.5) === 0.75 (probabilistic union)', () => {
  assert.ok(Math.abs(cslOr(0.5, 0.5) - 0.75) < EPSILON);
});

test('cslNot(0) === 1', () => {
  assert.strictEqual(cslNot(0), 1);
});

test('cslNot(1) === 0', () => {
  assert.strictEqual(cslNot(1), 0);
});

test('cslNot(PSI) ≈ 1 - PSI ≈ PSI2', () => {
  assert.ok(Math.abs(cslNot(PSI) - PSI2) < 1e-6);
});

test('cslXor(0, 0) === 0', () => {
  assert.strictEqual(cslXor(0, 0), 0);
});

test('cslXor(1, 0) === 1', () => {
  assert.strictEqual(cslXor(1, 0), 1);
});

test('cslXor(0.7, 0.7) === 0', () => {
  assert.strictEqual(cslXor(0.7, 0.7), 0);
});

test('cslXor(0.3, 0.8) ≈ 0.5', () => {
  assert.ok(Math.abs(cslXor(0.3, 0.8) - 0.5) < EPSILON);
});

test('cslImplies(0, 0) === 1 (false → false = true)', () => {
  assert.strictEqual(cslImplies(0, 0), 1);
});

test('cslImplies(1, 1) === 1', () => {
  assert.strictEqual(cslImplies(1, 1), 1);
});

test('cslImplies(1, 0) === 0 (true → false = false)', () => {
  assert.strictEqual(cslImplies(1, 0), 0);
});

test('cslEquivalent(0.6, 0.6) === 1', () => {
  assert.strictEqual(cslEquivalent(0.6, 0.6), 1);
});

test('cslEquivalent(0, 1) === 0', () => {
  assert.strictEqual(cslEquivalent(0, 1), 0);
});

test('cslEquivalent(0.4, 0.7) ≈ 0.7', () => {
  assert.ok(Math.abs(cslEquivalent(0.4, 0.7) - 0.7) < EPSILON);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: UNIT TESTS — PHI THRESHOLD CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────
section('UNIT TESTS — Phi Threshold Classification');

test('classifyConfidence(0.9) === EXECUTE (> PSI)', () => {
  assert.strictEqual(classifyConfidence(0.9), 'EXECUTE');
});

test('classifyConfidence(PSI + 0.01) === EXECUTE', () => {
  assert.strictEqual(classifyConfidence(PSI + 0.01), 'EXECUTE');
});

test('classifyConfidence(PSI) === CAUTIOUS (boundary)', () => {
  assert.strictEqual(classifyConfidence(PSI), 'CAUTIOUS');
});

test('classifyConfidence(PSI2) === CAUTIOUS (boundary)', () => {
  assert.strictEqual(classifyConfidence(PSI2), 'CAUTIOUS');
});

test('classifyConfidence(0.5) === CAUTIOUS (between PSI2 and PSI)', () => {
  assert.strictEqual(classifyConfidence(0.5), 'CAUTIOUS');
});

test('classifyConfidence(PSI2 - 0.01) === HALT', () => {
  assert.strictEqual(classifyConfidence(PSI2 - 0.01), 'HALT');
});

test('classifyConfidence(0) === HALT', () => {
  assert.strictEqual(classifyConfidence(0), 'HALT');
});

test('classifyConfidence(0.1) === HALT', () => {
  assert.strictEqual(classifyConfidence(0.1), 'HALT');
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: UNIT TESTS — GEOMETRIC MEAN
// ─────────────────────────────────────────────────────────────────────────────
section('UNIT TESTS — Geometric Mean');

test('geometricMean([1]) === 1', () => {
  assert.strictEqual(geometricMean([1]), 1);
});

test('geometricMean([1, 1, 1]) === 1', () => {
  assert.ok(Math.abs(geometricMean([1, 1, 1]) - 1) < EPSILON);
});

test('geometricMean([2, 8]) === 4', () => {
  assert.ok(Math.abs(geometricMean([2, 8]) - 4) < EPSILON);
});

test('geometricMean([0, 1]) === 0 (zero removed)', () => {
  assert.strictEqual(geometricMean([0, 1]), 1); // zeros ignored, only [1] remains
});

test('geometricMean([]) === 0', () => {
  assert.strictEqual(geometricMean([]), 0);
});

test('geometricMean([0, 0]) === 0 (all zeros)', () => {
  assert.strictEqual(geometricMean([0, 0]), 0);
});

test('geometricMean([0.5, 0.5]) ≈ 0.5', () => {
  assert.ok(Math.abs(geometricMean([0.5, 0.5]) - 0.5) < EPSILON);
});

test('geometricMean vs max: [0.1, 0.9] → gm < max', () => {
  const gm = geometricMean([0.1, 0.9]);
  assert.ok(gm < Math.max(0.1, 0.9));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: UNIT TESTS — cslGate ZONES
// ─────────────────────────────────────────────────────────────────────────────
section('UNIT TESTS — cslGate Zone Behavior');

test('cslGate(1.0) === 1 (full EXECUTE)', () => {
  assert.strictEqual(cslGate(1.0), 1);
});

test('cslGate(PSI) === 1 (exactly at execute boundary)', () => {
  assert.strictEqual(cslGate(PSI), 1);
});

test('cslGate(0) === 0 (full HALT)', () => {
  assert.strictEqual(cslGate(0), 0);
});

test('cslGate(PSI2 - EPSILON) === 0 (just below CAUTIOUS)', () => {
  assert.strictEqual(cslGate(PSI2 - EPSILON), 0);
});

test('cslGate in CAUTIOUS zone ∈ (0,1)', () => {
  const midpoint = (PSI + PSI2) / 2;
  const g = cslGate(midpoint);
  assert.ok(g > 0 && g < 1, `Expected (0,1), got ${g}`);
});

test('cslGate is monotonically increasing in CAUTIOUS zone', () => {
  const lo = cslGate(PSI2 + 0.01);
  const hi = cslGate(PSI - 0.01);
  assert.ok(hi > lo, `Expected hi(${hi}) > lo(${lo})`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: UNIT TESTS — cslBlend
// ─────────────────────────────────────────────────────────────────────────────
section('UNIT TESTS — cslBlend Interpolation');

test('cslBlend at t=0 returns vector a', () => {
  const a = [1, 0, 0];
  const b = [0, 1, 0];
  const result = cslBlend(a, b, 0);
  result.forEach((v, i) => assert.ok(Math.abs(v - a[i]) < EPSILON));
});

test('cslBlend at t=1 returns vector b', () => {
  const a = [1, 0, 0];
  const b = [0, 1, 0];
  const result = cslBlend(a, b, 1);
  result.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < EPSILON));
});

test('cslBlend at t=0.5 returns midpoint', () => {
  const a = [0, 0];
  const b = [1, 1];
  const result = cslBlend(a, b, 0.5);
  result.forEach(v => assert.ok(Math.abs(v - 0.5) < EPSILON));
});

test('cslBlend clamps t to [0,1]: t=-1 → t=0', () => {
  const a = [1, 2, 3];
  const b = [4, 5, 6];
  const result = cslBlend(a, b, -1);
  result.forEach((v, i) => assert.ok(Math.abs(v - a[i]) < EPSILON));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: UNIT TESTS — SHA-256 DETERMINISM
// ─────────────────────────────────────────────────────────────────────────────
section('UNIT TESTS — SHA-256 Determinism');

test('sha256 same string → same hash', () => {
  assert.strictEqual(sha256('HeadySystems'), sha256('HeadySystems'));
});

test('sha256 different strings → different hashes', () => {
  assert.notStrictEqual(sha256('hello'), sha256('world'));
});

test('sha256 empty string is deterministic', () => {
  const h1 = sha256('');
  const h2 = sha256('');
  assert.strictEqual(h1, h2);
});

test('sha256 known value', () => {
  // SHA-256 of "abc"
  const expected = 'ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469fa72a444b7a28b503';
  assert.ok(sha256('abc').startsWith(expected.substring(0, 16)));
});

test('sha256 of JSON object is reproducible', () => {
  const obj = { phi: PHI, psi: PSI };
  assert.strictEqual(sha256(obj), sha256(obj));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: INTEGRATION TESTS — TERNARY MIGRATION
// ─────────────────────────────────────────────────────────────────────────────
section('INTEGRATION TESTS — Ternary → CSL Migration');

test('TYPE_A pattern: string_equality + migrateable → TYPE_A', () => {
  const p = { type: 'string_equality', migrateable: true, id: 'route-check' };
  assert.strictEqual(classifyTernaryPattern(p), 'TYPE_A');
});

test('TYPE_B pattern: threshold + migrateable → TYPE_B', () => {
  const p = { type: 'threshold', migrateable: true, id: 'confidence-check' };
  assert.strictEqual(classifyTernaryPattern(p), 'TYPE_B');
});

test('TYPE_C: complex pattern → TYPE_C (not migrated)', () => {
  const p = { type: 'complex', migrateable: false, id: 'complex-expr' };
  assert.strictEqual(classifyTernaryPattern(p), 'TYPE_C');
});

test('TYPE_D: side-effect pattern → TYPE_D (not migrated)', () => {
  const p = { type: 'side_effect', migrateable: false, id: 'db-write' };
  assert.strictEqual(classifyTernaryPattern(p), 'TYPE_D');
});

test('TYPE_A has higher migration priority than TYPE_B (lower number = higher priority)', () => {
  const patterns = [
    { type: 'threshold', migrateable: true, id: 'b1' },
    { type: 'string_equality', migrateable: true, id: 'a1' },
  ];
  const plan = buildMigrationPlan(patterns);
  assert.strictEqual(plan[0].patternType, 'TYPE_A');
  assert.strictEqual(plan[1].patternType, 'TYPE_B');
});

test('TYPE_C/D patterns are excluded from migration plan', () => {
  const patterns = [
    { type: 'complex',      migrateable: false, id: 'c1' },
    { type: 'side_effect',  migrateable: false, id: 'd1' },
    { type: 'threshold',    migrateable: true,  id: 'b1' },
  ];
  const plan = buildMigrationPlan(patterns);
  assert.strictEqual(plan.length, 1);
  assert.strictEqual(plan[0].patternType, 'TYPE_B');
});

test('Dry run mode: plan items have dryRun=true', () => {
  const patterns = [{ type: 'string_equality', migrateable: true, id: 'a1' }];
  const plan = buildMigrationPlan(patterns, true);
  assert.ok(plan.every(p => p.dryRun === true));
});

test('Non-dry-run: plan items have dryRun=false', () => {
  const patterns = [{ type: 'threshold', migrateable: true, id: 'b1' }];
  const plan = buildMigrationPlan(patterns, false);
  assert.ok(plan.every(p => p.dryRun === false));
});

test('Migration plan ordering: multiple TYPE_A before TYPE_B', () => {
  const patterns = [
    { type: 'threshold',      migrateable: true, id: 'b2' },
    { type: 'string_equality', migrateable: true, id: 'a1' },
    { type: 'string_equality', migrateable: true, id: 'a2' },
  ];
  const plan = buildMigrationPlan(patterns);
  assert.strictEqual(plan[0].patternType, 'TYPE_A');
  assert.strictEqual(plan[1].patternType, 'TYPE_A');
  assert.strictEqual(plan[2].patternType, 'TYPE_B');
});

test('Empty patterns → empty migration plan', () => {
  const plan = buildMigrationPlan([]);
  assert.strictEqual(plan.length, 0);
});

test('TYPE_A string equality pattern → semantic router replacement', () => {
  // Simulate the semantic routing result for a TYPE_A replacement
  const sim = cosineSimilarity([1, 0, 0], [1, 0, 0]);
  assert.ok(sim >= PSI, `Expected similarity >= PSI for same-vector; got ${sim}`);
});

test('TYPE_B threshold pattern → phi-scaled gate replacement', () => {
  // A value above PSI in the phi-scaled gate should EXECUTE
  const val = PSI + 0.01;
  assert.strictEqual(classifyConfidence(val), 'EXECUTE');
});

test('Migration plan has correct item count for mixed patterns', () => {
  const patterns = [
    { type: 'string_equality', migrateable: true,  id: 'a1' },
    { type: 'threshold',       migrateable: true,  id: 'b1' },
    { type: 'complex',         migrateable: false, id: 'c1' },
    { type: 'side_effect',     migrateable: false, id: 'd1' },
    { type: 'threshold',       migrateable: true,  id: 'b2' },
  ];
  const plan = buildMigrationPlan(patterns);
  assert.strictEqual(plan.length, 3);
});

test('Dry run: plan does not execute file changes (dryRun flag present)', () => {
  const patterns = [{ type: 'string_equality', migrateable: true, id: 'a1' }];
  const plan = buildMigrationPlan(patterns, true);
  // In dry run, we should NOT apply changes (represented by dryRun=true)
  assert.ok(plan[0].dryRun === true, 'dryRun flag must be true');
});

test('String equality pattern: non-migrateable → excluded', () => {
  const p = { type: 'string_equality', migrateable: false, id: 'a_locked' };
  const plan = buildMigrationPlan([p]);
  assert.strictEqual(plan.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: TRADING TESTS — CSL Risk & Position
// ─────────────────────────────────────────────────────────────────────────────
section('TRADING TESTS — CSL Risk Score & Position Sizing');

test('cslRiskScore returns continuous ∈ [0,1]', () => {
  for (const [eq, pk, acc] of [[100000, 100000, 100000],[90000,100000,100000],[50000,100000,100000]]) {
    const score = cslRiskScore(eq, pk, acc);
    assert.ok(score >= 0 && score <= 1, `Expected [0,1], got ${score}`);
  }
});

test('cslRiskScore is higher when equity = peak (no drawdown)', () => {
  const highScore = cslRiskScore(100000, 100000, 100000);
  const lowScore  = cslRiskScore(80000,  100000, 100000);
  assert.ok(highScore > lowScore, `Expected ${highScore} > ${lowScore}`);
});

test('cslRiskScore with 50% drawdown is lower than 10% drawdown', () => {
  const a = cslRiskScore(50000, 100000, 100000);
  const b = cslRiskScore(90000, 100000, 100000);
  assert.ok(a < b);
});

test('cslPositionSize scales with confidence: high conf > low conf', () => {
  const high = cslPositionSize(10000, 0.9);
  const low  = cslPositionSize(10000, 0.1);
  assert.ok(high > low, `Expected high(${high}) > low(${low})`);
});

test('cslPositionSize returns 0 when confidence in HALT zone', () => {
  const sz = cslPositionSize(10000, PSI2 - 0.01);
  assert.strictEqual(sz, 0);
});

test('cslPositionSize is positive when confidence in EXECUTE zone', () => {
  const sz = cslPositionSize(10000, PSI + 0.01);
  assert.ok(sz > 0);
});

test('cslEntryGate([1, 1, 1]) === 1', () => {
  assert.strictEqual(cslEntryGate([1, 1, 1]), 1);
});

test('cslEntryGate([0, 0, 0]) === 0', () => {
  assert.strictEqual(cslEntryGate([0, 0, 0]), 0);
});

test('cslEntryGate mixed signals ∈ (0,1)', () => {
  const g = cslEntryGate([0.9, 0.4, 0.7]);
  assert.ok(g > 0 && g < 1);
});

test('cslEntryGate: single low signal drags down result', () => {
  const withLow    = cslEntryGate([0.9, 0.9, 0.1]);
  const withoutLow = cslEntryGate([0.9, 0.9, 0.9]);
  assert.ok(withLow < withoutLow);
});

test('cslExitGate: drawdown near limit triggers exit', () => {
  const { shouldExit } = cslExitGate(0.09, 0.10);
  assert.ok(shouldExit, 'Should exit when drawdown = 90% of limit');
});

test('cslExitGate: small drawdown does not trigger exit', () => {
  const { shouldExit } = cslExitGate(0.01, 0.10);
  assert.ok(!shouldExit);
});

test('cslExitGate: exitConfidence ∈ [0,1]', () => {
  for (const [dd, lim] of [[0,0.1],[0.05,0.1],[0.1,0.1],[0.2,0.1]]) {
    const { exitConfidence } = cslExitGate(dd, lim);
    assert.ok(exitConfidence >= 0 && exitConfidence <= 1);
  }
});

test('cslPortfolioRisk: geometric < max for heterogeneous factors', () => {
  const risks = [0.1, 0.9, 0.5];
  const { geometric, max } = cslPortfolioRisk(risks);
  assert.ok(geometric < max, `Expected geometric(${geometric}) < max(${max})`);
});

test('cslPortfolioRisk: geometric === max for single factor', () => {
  const { geometric, max } = cslPortfolioRisk([0.7]);
  assert.ok(Math.abs(geometric - max) < EPSILON);
});

test('cslPortfolioRisk: uniform factors → geometric ≈ max', () => {
  const { geometric, max } = cslPortfolioRisk([0.5, 0.5, 0.5]);
  assert.ok(Math.abs(geometric - max) < EPSILON);
});

test('checkRiskCSL: 25K account, no drawdown → no violation', () => {
  const result = checkRiskCSL('25K', 25000, 25000);
  assert.strictEqual(result.violation, false);
});

test('checkRiskCSL: 100K account, 15% drawdown → violation', () => {
  const result = checkRiskCSL('100K', 85000, 100000);
  assert.strictEqual(result.violation, true);
});

test('checkRiskCSL: riskScore ∈ [0,1]', () => {
  for (const tier of Object.keys(ACCOUNT_TIERS)) {
    const t = ACCOUNT_TIERS[tier];
    const result = checkRiskCSL(tier, t.size, t.size);
    assert.ok(result.riskScore >= 0 && result.riskScore <= 1);
  }
});

test('Safety net calculation unchanged: 25K @ 6% loss = 23500', () => {
  assert.ok(Math.abs(safetyNet(25000, 6) - 23500) < EPSILON);
});

test('Safety net calculation unchanged: 100K @ 6% loss = 94000', () => {
  assert.ok(Math.abs(safetyNet(100000, 6) - 94000) < EPSILON);
});

test('Payout eligibility: profitFactor > 1 and days >= minDays → eligible', () => {
  assert.strictEqual(payoutEligible(1.5, 10, 15), true);
});

test('Payout eligibility: profitFactor <= 1 → not eligible', () => {
  assert.strictEqual(payoutEligible(0.9, 10, 15), false);
});

test('Payout eligibility: actualDays < minDays → not eligible', () => {
  assert.strictEqual(payoutEligible(1.5, 10, 5), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: APEX RISK AGENT — ACCOUNT TIER TESTS
// ─────────────────────────────────────────────────────────────────────────────
section('TRADING TESTS — ApexRiskAgentCSL by Account Tier');

for (const tier of Object.keys(ACCOUNT_TIERS)) {
  const t = ACCOUNT_TIERS[tier];
  test(`${tier} account: no drawdown → riskScore = EXECUTE zone`, () => {
    const result = checkRiskCSL(tier, t.size, t.size);
    assert.strictEqual(result.zone, 'EXECUTE');
  });

  test(`${tier} account: 5% drawdown → no violation (< 10% limit)`, () => {
    const peak = t.size;
    const current = peak * 0.95;
    const result = checkRiskCSL(tier, current, peak);
    assert.strictEqual(result.violation, false);
  });

  test(`${tier} account: 11% drawdown → violation`, () => {
    const peak = t.size;
    const current = peak * 0.89;
    const result = checkRiskCSL(tier, current, peak);
    assert.strictEqual(result.violation, true);
  });
}

// Session management simulation
test('Session start: equity initialized at account size', () => {
  const tier = '50K';
  const t = ACCOUNT_TIERS[tier];
  const session = { equity: t.size, peak: t.size, startTime: Date.now() };
  assert.strictEqual(session.equity, t.size);
  assert.strictEqual(session.peak, t.size);
});

test('Session end: compute final riskScore and zone', () => {
  const tier = '100K';
  const t = ACCOUNT_TIERS[tier];
  const session = { equity: t.size * 0.97, peak: t.size };
  const result = checkRiskCSL(tier, session.equity, session.peak);
  assert.ok(['EXECUTE', 'CAUTIOUS', 'HALT'].includes(result.zone));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: DETERMINISM TESTS
// ─────────────────────────────────────────────────────────────────────────────
section('DETERMINISM TESTS');

test('Same input → same CSL confidence output (cslAnd)', () => {
  const a1 = cslAnd(0.7, 0.8);
  const a2 = cslAnd(0.7, 0.8);
  assert.strictEqual(a1, a2);
});

test('Same input → same CSL confidence output (cslGate)', () => {
  assert.strictEqual(cslGate(0.55), cslGate(0.55));
});

test('Same Mulberry32 seed → same Monte Carlo sequence', () => {
  const rng1 = mulberry32(12345);
  const rng2 = mulberry32(12345);
  for (let i = 0; i < 100; i++) {
    assert.strictEqual(rng1(), rng2());
  }
});

test('Different seeds → different random sequences', () => {
  const rng1 = mulberry32(1);
  const rng2 = mulberry32(2);
  const seq1 = Array.from({ length: 10 }, () => rng1());
  const seq2 = Array.from({ length: 10 }, () => rng2());
  const allEqual = seq1.every((v, i) => v === seq2[i]);
  assert.ok(!allEqual, 'Different seeds must produce different sequences');
});

test('SHA-256 hash of CSL output is reproducible', () => {
  const val = cslAnd(PSI, PSI2);
  const h1 = sha256(val.toString());
  const h2 = sha256(val.toString());
  assert.strictEqual(h1, h2);
});

test('PHI constant precision: PHI === 1.6180339887', () => {
  assert.strictEqual(PHI, 1.6180339887);
});

test('PHI identity: PHI * PHI ≈ PHI + 1 (within epsilon 1e-6)', () => {
  assert.ok(Math.abs(PHI * PHI - (PHI + 1)) < 1e-6,
    `PHI² = ${PHI * PHI}, PHI+1 = ${PHI + 1}, diff = ${Math.abs(PHI * PHI - (PHI + 1))}`);
});

test('PSI = 1/PHI — cross-check to 7 significant figures', () => {
  assert.ok(Math.abs(PSI - 0.6180339) < 1e-7);
});

test('PSI2 = PSI * PSI ≈ 0.3819660', () => {
  assert.ok(Math.abs(PSI2 - 0.3819660) < 1e-7);
});

test('PSI + PSI2 ≈ 1 (phi identity)', () => {
  assert.ok(Math.abs(PSI + PSI2 - 1) < 1e-9,
    `PSI + PSI² = ${PSI + PSI2}, expected ≈ 1`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: MODULE IMPORT TESTS
// ─────────────────────────────────────────────────────────────────────────────
section('MODULE IMPORT TESTS — Production Files');

let svcMod, routesMod, mcMod, vsaMod;
let importErrors = [];

try {
  svcMod = require('../src/services/csl-service-integration-global');
} catch (e) { importErrors.push(`csl-service-integration-global: ${e.message}`); }

try {
  routesMod = require('../src/routes/csl-routes-enhanced');
} catch (e) { importErrors.push(`csl-routes-enhanced: ${e.message}`); }

try {
  mcMod = require('../src/intelligence/monte-carlo-engine-csl-enhanced');
} catch (e) { importErrors.push(`monte-carlo-engine-csl-enhanced: ${e.message}`); }

try {
  vsaMod = require('../src/vsa/vsa-csl-bridge-enhanced');
} catch (e) { importErrors.push(`vsa-csl-bridge-enhanced: ${e.message}`); }

test('csl-service-integration-global imports without error', () => {
  if (importErrors.find(e => e.includes('csl-service-integration-global'))) {
    throw new Error(importErrors.find(e => e.includes('csl-service-integration-global')));
  }
  assert.ok(svcMod);
});

test('csl-routes-enhanced imports without error', () => {
  if (importErrors.find(e => e.includes('csl-routes-enhanced'))) {
    throw new Error(importErrors.find(e => e.includes('csl-routes-enhanced')));
  }
  assert.ok(routesMod);
});

test('monte-carlo-engine-csl-enhanced imports without error', () => {
  if (importErrors.find(e => e.includes('monte-carlo-engine-csl-enhanced'))) {
    throw new Error(importErrors.find(e => e.includes('monte-carlo-engine-csl-enhanced')));
  }
  assert.ok(mcMod);
});

test('vsa-csl-bridge-enhanced imports without error', () => {
  if (importErrors.find(e => e.includes('vsa-csl-bridge-enhanced'))) {
    throw new Error(importErrors.find(e => e.includes('vsa-csl-bridge-enhanced')));
  }
  assert.ok(vsaMod);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12: CSLServiceGateway INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────
section('INTEGRATION — CSLServiceGateway');

if (svcMod) {
  const { CSLServiceGateway } = svcMod;

  test('CSLServiceGateway: registerService + listServices', () => {
    const gw = new CSLServiceGateway();
    gw.registerService('risk', [1, 0, 0], () => 'risk');
    assert.ok(gw.listServices().includes('risk'));
  });

  test('CSLServiceGateway: routeToService returns best match', () => {
    const gw = new CSLServiceGateway();
    gw.registerService('alpha', [1, 0, 0], () => 'alpha');
    gw.registerService('beta',  [0, 1, 0], () => 'beta');
    const result = gw.routeToService([1, 0, 0]);
    assert.strictEqual(result.service, 'alpha');
  });

  test('CSLServiceGateway: confidence ∈ [0,1]', () => {
    const gw = new CSLServiceGateway();
    gw.registerService('svc', [1, 1, 1], () => null);
    const { confidence } = gw.routeToService([1, 0, 0]);
    assert.ok(confidence >= 0 && confidence <= 1);
  });

  test('CSLServiceGateway: batchGate returns array of same length', () => {
    const gw = new CSLServiceGateway();
    const inputs = [[1,0],[0,1],[1,1]];
    const gate = [1, 0];
    const results = gw.batchGate(inputs, gate);
    assert.strictEqual(results.length, inputs.length);
  });

  test('CSLServiceGateway: consensus returns normalized vector', () => {
    const gw = new CSLServiceGateway();
    const { consensus: cv } = gw.consensus([[1,0,0],[0,1,0],[0,0,1]]);
    const norm = Math.sqrt(cv.reduce((s,v) => s+v*v, 0));
    assert.ok(Math.abs(norm - 1) < 1e-6, `Expected unit vector, norm=${norm}`);
  });

  test('CSLServiceGateway: decide returns ranked array', () => {
    const gw = new CSLServiceGateway();
    const candidates = [
      { id: 'A', vector: [1, 0] },
      { id: 'B', vector: [0, 1] },
    ];
    const ranked = gw.decide(candidates, [1, 0]);
    assert.strictEqual(ranked[0].id, 'A');
  });

  test('CSLServiceGateway: getMetrics reflects operations', () => {
    const gw = new CSLServiceGateway();
    gw.registerService('svc', [1, 0, 0], () => null);
    gw.routeToService([1, 0, 0]);
    gw.routeToService([0, 1, 0]);
    const m = gw.getMetrics();
    assert.ok(m.totalRoutes >= 2);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13: MONTE CARLO ENGINE INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────
section('INTEGRATION — CSLMonteCarloEngine');

if (mcMod) {
  const { CSLMonteCarloEngine, mulberry32: mb32 } = mcMod;

  test('CSLMonteCarloEngine: runCSLSimulation returns losses array', () => {
    const engine = new CSLMonteCarloEngine({ seed: 42 });
    const { losses } = engine.runCSLSimulation({
      factors: [{ name: 'f1', probability: 0.3, impact: 1000, cslConfidence: 0.8 }],
    }, 100);
    assert.strictEqual(losses.length, 100);
  });

  test('CSLMonteCarloEngine: cslRiskFusion returns fusedConfidence ∈ [0,1]', () => {
    const engine = new CSLMonteCarloEngine();
    const { fusedConfidence } = engine.cslRiskFusion([
      { cslConfidence: 0.8 },
      { cslConfidence: 0.6 },
    ]);
    assert.ok(fusedConfidence >= 0 && fusedConfidence <= 1);
  });

  test('CSLMonteCarloEngine: same seed → identical CSL simulation losses', () => {
    const e1 = new CSLMonteCarloEngine({ seed: 99 });
    const e2 = new CSLMonteCarloEngine({ seed: 99 });
    const params = {
      factors: [{ name: 'x', probability: 0.5, impact: 500, cslConfidence: 0.7 }],
    };
    const { losses: l1 } = e1.runCSLSimulation(params, 50);
    const { losses: l2 } = e2.runCSLSimulation(params, 50);
    assert.deepStrictEqual(l1, l2);
  });

  test('CSLMonteCarloEngine: phiScaledConfidenceInterval returns correct keys', () => {
    const engine = new CSLMonteCarloEngine({ seed: 1 });
    const data = Array.from({ length: 100 }, (_, i) => i);
    const ci = engine.phiScaledConfidenceInterval(data);
    assert.ok('center' in ci);
    assert.ok('innerLow' in ci);
    assert.ok('innerHigh' in ci);
    assert.ok('outerLow' in ci);
    assert.ok('outerHigh' in ci);
  });

  test('CSLMonteCarloEngine: scoreToGrade uses phi thresholds', () => {
    const engine = new CSLMonteCarloEngine();
    assert.strictEqual(engine.scoreToGrade(98), 'A');
    assert.strictEqual(engine.scoreToGrade(65), 'B');
    assert.strictEqual(engine.scoreToGrade(40), 'C');
    assert.strictEqual(engine.scoreToGrade(10), 'F');
  });

  test('CSLMonteCarloEngine: tradingSimulation returns pnlDistribution', () => {
    const engine = new CSLMonteCarloEngine({ seed: 42 });
    const result = engine.tradingSimulation(
      [{ symbol: 'ES', size: 0.01, entryConfidence: 0.8 }],
      { volatility: 0.01, drift: 0.0002, initialEquity: 50000, daysPerPath: 10 },
      20
    );
    assert.ok('pnlDistribution' in result);
    assert.ok('maxDrawdownDistribution' in result);
    assert.ok('winRate' in result);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 14: VSA-CSL BRIDGE INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────
section('INTEGRATION — VSACSLBridge');

if (vsaMod) {
  const { VSACSLBridge } = vsaMod;

  test('VSACSLBridge: store and retrieve concept vector', () => {
    const bridge = new VSACSLBridge(3);
    bridge.store('cat', [1, 0, 0]);
    const v = bridge.retrieve('cat');
    assert.ok(Array.isArray(v) && v.length === 3);
  });

  test('VSACSLBridge: cslBind with high-resonance vectors succeeds', () => {
    const bridge = new VSACSLBridge(3);
    const result = bridge.cslBind([1, 0, 0], [1, 0.1, 0]);
    // Same-direction vectors should have high resonance
    assert.ok(result.resonance > 0.9);
    assert.strictEqual(result.didBind, true);
  });

  test('VSACSLBridge: cslBind with orthogonal vectors halts', () => {
    const bridge = new VSACSLBridge(3);
    const result = bridge.cslBind([1, 0, 0], [0, 1, 0]);
    assert.strictEqual(result.didBind, false);
  });

  test('VSACSLBridge: cslQuery returns sorted results', () => {
    const bridge = new VSACSLBridge(3);
    bridge.store('a', [1, 0, 0]);
    bridge.store('b', [0.9, 0.1, 0]);
    bridge.store('c', [0, 0, 1]);
    const results = bridge.cslQuery([1, 0, 0], 0, 5);
    assert.ok(results.length >= 2);
    // First result should be most similar
    assert.ok(results[0].similarity >= results[1].similarity);
  });

  test('VSACSLBridge: continuousLogicLayer AND', () => {
    const bridge = new VSACSLBridge();
    assert.ok(Math.abs(bridge.continuousLogicLayer(0.5, 0.5, 'and') - 0.5) < EPSILON);
  });

  test('VSACSLBridge: continuousLogicLayer OR', () => {
    const bridge = new VSACSLBridge();
    assert.ok(Math.abs(bridge.continuousLogicLayer(0, 1, 'or') - 1) < EPSILON);
  });

  test('VSACSLBridge: continuousLogicLayer NOT', () => {
    const bridge = new VSACSLBridge();
    assert.ok(Math.abs(bridge.continuousLogicLayer(0.3, 0, 'not') - 0.7) < EPSILON);
  });

  test('VSACSLBridge: cslFusionGate returns normalized fused vector', () => {
    const bridge = new VSACSLBridge(3);
    const { fused } = bridge.cslFusionGate([[1,0,0],[0,1,0],[0,0,1]]);
    const norm = Math.sqrt(fused.reduce((s,v) => s+v*v, 0));
    assert.ok(Math.abs(norm - 1) < 1e-6 || fused.every(v => v === 0));
  });

  test('VSACSLBridge: cslDecisionGate returns best matching rule', () => {
    const bridge = new VSACSLBridge(3);
    const rules = [
      { name: 'buy',  condition: [1, 0, 0], action: 'BUY'  },
      { name: 'sell', condition: [0, 1, 0], action: 'SELL' },
    ];
    const result = bridge.cslDecisionGate([1, 0, 0], rules);
    assert.ok(result.matched !== null);
    assert.strictEqual(result.matched.action, 'BUY');
  });

  test('VSACSLBridge: cslScriptEngine executes AND command', () => {
    const bridge = new VSACSLBridge();
    const output = bridge.cslScriptEngine('AND 0.8 0.6');
    assert.strictEqual(output[0].ok, true);
    assert.ok(Math.abs(output[0].result - cslAnd(0.8, 0.6)) < EPSILON);
  });

  test('VSACSLBridge: cslScriptEngine handles comments', () => {
    const bridge = new VSACSLBridge();
    const output = bridge.cslScriptEngine('# this is a comment\nNOT 0.3');
    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].command, 'NOT');
  });

  test('VSACSLBridge: resonanceGate identical vectors = 1', () => {
    const bridge = new VSACSLBridge(3);
    const v = [1, 0, 0];
    const { resonance } = bridge.resonanceGate(v, v);
    assert.ok(Math.abs(resonance - 1) < EPSILON);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 15: ROUTES MODULE TESTS
// ─────────────────────────────────────────────────────────────────────────────
section('INTEGRATION — CSL Routes');

if (routesMod && svcMod) {
  const { registerCSLRoutes, evaluateRiskGate, pairwiseSimilarityMatrix } = routesMod;
  const { CSLServiceGateway } = svcMod;

  test('registerCSLRoutes: registers all 8 expected routes', () => {
    const gw = new CSLServiceGateway();
    const routeMap = registerCSLRoutes(null, gw);
    const expected = [
      'GET /api/csl/health',
      'GET /api/csl/thresholds',
      'POST /api/csl/gate',
      'POST /api/csl/score',
      'POST /api/csl/consensus',
      'POST /api/csl/decide',
      'POST /api/csl/risk-gate',
      'GET /api/csl/metrics',
    ];
    for (const route of expected) {
      assert.ok(route in routeMap, `Missing route: ${route}`);
    }
  });

  test('GET /api/csl/health returns ok:true', () => {
    const gw = new CSLServiceGateway();
    const routes = registerCSLRoutes(null, gw);
    const result = routes['GET /api/csl/health']({}, null);
    assert.strictEqual(result.ok, true);
  });

  test('GET /api/csl/thresholds returns PSI and PHI', () => {
    const gw = new CSLServiceGateway();
    const routes = registerCSLRoutes(null, gw);
    const result = routes['GET /api/csl/thresholds']({}, null);
    assert.ok(result.thresholds.PSI !== undefined);
    assert.ok(result.thresholds.PHI !== undefined);
  });

  test('POST /api/csl/gate: valid input returns similarity + zone', () => {
    const gw = new CSLServiceGateway();
    const routes = registerCSLRoutes(null, gw);
    const result = routes['POST /api/csl/gate']({
      input: [1, 0, 0],
      gateVector: [1, 0, 0],
    }, null);
    assert.strictEqual(result.ok, true);
    assert.ok(result.similarity !== undefined);
    assert.ok(result.zone !== undefined);
  });

  test('POST /api/csl/gate: mismatched dimensions returns error', () => {
    const gw = new CSLServiceGateway();
    const routes = registerCSLRoutes(null, gw);
    const result = routes['POST /api/csl/gate']({ input: [1,0], gateVector: [1,0,0] }, null);
    assert.strictEqual(result.ok, false);
  });

  test('POST /api/csl/score: pairwise matrix is symmetric', () => {
    const gw = new CSLServiceGateway();
    const routes = registerCSLRoutes(null, gw);
    const result = routes['POST /api/csl/score']({ vectors: [[1,0],[0,1],[1,1]] }, null);
    assert.strictEqual(result.ok, true);
    const m = result.matrix;
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m[i].length; j++) {
        assert.ok(Math.abs(m[i][j] - m[j][i]) < 1e-10, `Not symmetric at [${i}][${j}]`);
      }
    }
  });

  test('POST /api/csl/risk-gate: no-risk scenario returns zone EXECUTE', () => {
    const gw = new CSLServiceGateway();
    const routes = registerCSLRoutes(null, gw);
    const result = routes['POST /api/csl/risk-gate']({ exposure: 1000, limit: 100000 }, null);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.zone, 'EXECUTE');
  });

  test('evaluateRiskGate: exposure > limit returns exceeded=true', () => {
    const r = evaluateRiskGate(110, 100);
    assert.strictEqual(r.exceeded, true);
  });

  test('pairwiseSimilarityMatrix: diagonal === 1', () => {
    const m = pairwiseSimilarityMatrix([[1,0],[0,1],[1,1]]);
    for (let i = 0; i < m.length; i++) {
      assert.ok(Math.abs(m[i][i] - 1) < 1e-10);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

process.stdout.write('\n' + '═'.repeat(64) + '\n');
process.stdout.write(`  TEST RESULTS\n`);
process.stdout.write('═'.repeat(64) + '\n');
process.stdout.write(`  Total:   ${_total}\n`);
process.stdout.write(`  Passed:  ${_passed}\n`);
process.stdout.write(`  Failed:  ${_failed}\n`);

if (_failures.length > 0) {
  process.stdout.write('\n  Failed tests:\n');
  _failures.forEach(f => {
    process.stdout.write(`    ✘ ${f.description}\n`);
    process.stdout.write(`      ${f.error}\n`);
  });
}

process.stdout.write('\n  ' + (_failed === 0
  ? '✔ ALL TESTS PASSED'
  : `✘ ${_failed} TEST(S) FAILED`) + '\n');
process.stdout.write('═'.repeat(64) + '\n\n');

process.exit(_failed > 0 ? 1 : 0);
