/**
 * Heady™ CSL Engine — Test Suite
 *
 * Validates all CSL gates against mathematical properties.
 */

'use strict';

const {
  dot, norm, normalize, add, sub, scale,
  cslAND, cslOR, cslNOT, cslIMPLY, cslXOR,
  cslCONSENSUS, cslGATE,
  batchSimilarity, topK,
  hdcBIND, hdcBUNDLE, hdcPERMUTE,
  moeRoute,
  ternary, truthValue,
} = require('../shared/csl-engine');

// Helper: create a random unit vector
function randomUnitVector(dim = 384) {
  const v = new Float64Array(dim);
  for (let i = 0; i < dim; i++) v[i] = Math.random() - 0.5;
  return normalize(v);
}

// Helper: create a vector pointing in a specific direction
function directionVector(dim, idx) {
  const v = new Float64Array(dim);
  v[idx] = 1.0;
  return v;
}

// ─── Vector Utilities ────────────────────────────────────────────────────────

describe('Vector Utilities', () => {
  test('normalize produces unit vector', () => {
    const v = new Float64Array([3, 4, 0]);
    const n = normalize(v);
    expect(norm(n)).toBeCloseTo(1.0, 10);
  });

  test('normalize of zero vector returns zero vector', () => {
    const v = new Float64Array([0, 0, 0]);
    const n = normalize(v);
    expect(norm(n)).toBe(0);
  });

  test('dot product is commutative', () => {
    const a = randomUnitVector(10);
    const b = randomUnitVector(10);
    expect(dot(a, b)).toBeCloseTo(dot(b, a), 10);
  });
});

// ─── CSL AND ─────────────────────────────────────────────────────────────────

describe('CSL AND (Cosine Similarity)', () => {
  test('identical vectors → cos = 1', () => {
    const v = randomUnitVector(384);
    expect(cslAND(v, v)).toBeCloseTo(1.0, 10);
  });

  test('orthogonal vectors → cos = 0', () => {
    const a = directionVector(384, 0);
    const b = directionVector(384, 1);
    expect(cslAND(a, b)).toBeCloseTo(0.0, 10);
  });

  test('opposite vectors → cos = -1', () => {
    const a = directionVector(384, 0);
    const b = scale(a, -1);
    expect(cslAND(a, b)).toBeCloseTo(-1.0, 10);
  });

  test('AND is commutative', () => {
    const a = randomUnitVector(384);
    const b = randomUnitVector(384);
    expect(cslAND(a, b)).toBeCloseTo(cslAND(b, a), 10);
  });

  test('AND range is [-1, 1]', () => {
    const a = randomUnitVector(384);
    const b = randomUnitVector(384);
    const result = cslAND(a, b);
    expect(result).toBeGreaterThanOrEqual(-1);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ─── CSL OR ──────────────────────────────────────────────────────────────────

describe('CSL OR (Superposition)', () => {
  test('OR produces unit vector', () => {
    const a = randomUnitVector(384);
    const b = randomUnitVector(384);
    const result = cslOR(a, b);
    expect(norm(result)).toBeCloseTo(1.0, 10);
  });

  test('OR of identical vectors = same vector', () => {
    const v = randomUnitVector(384);
    const result = cslOR(v, v);
    expect(cslAND(result, v)).toBeCloseTo(1.0, 5);
  });
});

// ─── CSL NOT ─────────────────────────────────────────────────────────────────

describe('CSL NOT (Orthogonal Projection)', () => {
  test('NOT result is orthogonal to b', () => {
    const a = randomUnitVector(384);
    const b = randomUnitVector(384);
    const result = cslNOT(a, b);
    expect(dot(result, b)).toBeCloseTo(0, 8);
  });

  test('NOT is idempotent: NOT(NOT(a,b),b) = NOT(a,b)', () => {
    const a = randomUnitVector(384);
    const b = randomUnitVector(384);
    const once = cslNOT(a, b);
    const twice = cslNOT(once, b);
    // Should be very close
    for (let i = 0; i < 10; i++) {
      expect(once[i]).toBeCloseTo(twice[i], 8);
    }
  });
});

// ─── CSL IMPLY ───────────────────────────────────────────────────────────────

describe('CSL IMPLY (Projection)', () => {
  test('IMPLY is parallel to b', () => {
    const a = randomUnitVector(384);
    const b = randomUnitVector(384);
    const result = cslIMPLY(a, b);
    const resultNorm = normalize(result);
    const bNorm = normalize(b);
    // Should be parallel (cos ≈ ±1)
    expect(Math.abs(cslAND(resultNorm, bNorm))).toBeCloseTo(1.0, 5);
  });

  test('NOT + IMPLY = original', () => {
    const a = randomUnitVector(384);
    const b = randomUnitVector(384);
    const notPart = cslNOT(a, b);
    const implyPart = cslIMPLY(a, b);
    const reconstructed = add(notPart, implyPart);
    for (let i = 0; i < 10; i++) {
      expect(reconstructed[i]).toBeCloseTo(a[i], 8);
    }
  });
});

// ─── CSL CONSENSUS ───────────────────────────────────────────────────────────

describe('CSL CONSENSUS', () => {
  test('consensus of identical vectors = same vector', () => {
    const v = randomUnitVector(384);
    const result = cslCONSENSUS([v, v, v]);
    expect(cslAND(result, v)).toBeCloseTo(1.0, 5);
  });

  test('consensus produces unit vector', () => {
    const vectors = Array.from({ length: 5 }, () => randomUnitVector(384));
    const result = cslCONSENSUS(vectors);
    expect(norm(result)).toBeCloseTo(1.0, 10);
  });
});

// ─── CSL GATE ────────────────────────────────────────────────────────────────

describe('CSL GATE', () => {
  test('gate is bounded', () => {
    const result = cslGATE(10, 0.9);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(10);
  });
});

// ─── HDC Operations ──────────────────────────────────────────────────────────

describe('HDC Operations', () => {
  test('BIND produces unit vector', () => {
    const a = randomUnitVector(384);
    const b = randomUnitVector(384);
    const result = hdcBIND(a, b);
    expect(norm(result)).toBeCloseTo(1.0, 10);
  });

  test('BUNDLE produces unit vector', () => {
    const vectors = Array.from({ length: 5 }, () => randomUnitVector(384));
    const result = hdcBUNDLE(vectors);
    expect(norm(result)).toBeCloseTo(1.0, 10);
  });

  test('PERMUTE preserves vector length', () => {
    const v = randomUnitVector(384);
    const result = hdcPERMUTE(v, 3);
    expect(result.length).toBe(384);
  });
});

// ─── MoE Router ──────────────────────────────────────────────────────────────

describe('MoE Router', () => {
  test('routes to top-K experts', () => {
    const input = randomUnitVector(384);
    const experts = Array.from({ length: 5 }, (_, i) => ({
      id: `expert-${i}`,
      gate: randomUnitVector(384),
    }));

    const result = moeRoute(input, experts, { k: 2 });
    expect(result.length).toBe(2);
    expect(result[0].weight + result[1].weight).toBeCloseTo(1.0, 5);
  });
});

// ─── Ternary Logic ───────────────────────────────────────────────────────────

describe('Ternary Logic', () => {
  test('high cosScore → TRUE', () => {
    expect(ternary(0.9)).toBe('TRUE');
  });

  test('low cosScore → FALSE', () => {
    expect(ternary(-0.9)).toBe('FALSE');
  });

  test('zero cosScore → UNKNOWN', () => {
    expect(ternary(0.0)).toBe('UNKNOWN');
  });

  test('truthValue maps [-1,1] → [0,1]', () => {
    expect(truthValue(1.0)).toBe(1.0);
    expect(truthValue(-1.0)).toBe(0.0);
    expect(truthValue(0.0)).toBe(0.5);
  });
});
