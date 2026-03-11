/**
 * Heady™ Phi-Math Foundation — Test Suite
 *
 * Validates that all phi-derived constants, thresholds, and functions
 * produce mathematically correct results.
 */

'use strict';

const {
  PHI, PSI, PHI_SQ, PHI_CU,
  fib, fibRange, nearestFib,
  CSL_THRESHOLDS, phiThreshold,
  PRESSURE_LEVELS, pressureLevel,
  ALERT_THRESHOLDS,
  phiBackoff, phiInterval,
  phiFusionWeights, phiPriorityScore,
  phiMultiSplit, poolAllocation,
  phiTokenBudgets,
  cslGate, cslBlend, adaptiveTemperature,
  EVICTION_WEIGHTS,
} = require('../shared/phi-math');

// ─── Core Constants ──────────────────────────────────────────────────────────

describe('Core Constants', () => {
  test('PHI ≈ 1.618', () => {
    expect(PHI).toBeCloseTo(1.6180339887, 8);
  });

  test('PSI ≈ 0.618 (conjugate)', () => {
    expect(PSI).toBeCloseTo(0.6180339887, 8);
  });

  test('PHI × PSI = 1', () => {
    expect(PHI * PSI).toBeCloseTo(1.0, 10);
  });

  test('PHI² = PHI + 1', () => {
    expect(PHI_SQ).toBeCloseTo(PHI + 1, 10);
  });

  test('PHI³ = 2φ + 1', () => {
    expect(PHI_CU).toBeCloseTo(2 * PHI + 1, 10);
  });
});

// ─── Fibonacci ───────────────────────────────────────────────────────────────

describe('Fibonacci', () => {
  test('fib(0–10) produces correct sequence', () => {
    const expected = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    for (let i = 0; i < expected.length; i++) {
      expect(fib(i)).toBe(expected[i]);
    }
  });

  test('fib(20) = 6765', () => {
    expect(fib(20)).toBe(6765);
  });

  test('fibRange returns correct range', () => {
    expect(fibRange(5, 9)).toEqual([5, 8, 13, 21, 34]);
  });

  test('nearestFib finds closest Fibonacci number', () => {
    expect(nearestFib(10)).toBe(8);
    expect(nearestFib(20)).toBe(21);
    expect(nearestFib(100)).toBe(89);
  });

  test('consecutive Fibonacci ratios converge to φ', () => {
    const ratio = fib(20) / fib(19);
    expect(ratio).toBeCloseTo(PHI, 5);
  });
});

// ─── CSL Thresholds ──────────────────────────────────────────────────────────

describe('CSL Thresholds', () => {
  test('thresholds are monotonically increasing', () => {
    expect(CSL_THRESHOLDS.MINIMUM).toBeLessThan(CSL_THRESHOLDS.LOW);
    expect(CSL_THRESHOLDS.LOW).toBeLessThan(CSL_THRESHOLDS.MEDIUM);
    expect(CSL_THRESHOLDS.MEDIUM).toBeLessThan(CSL_THRESHOLDS.HIGH);
    expect(CSL_THRESHOLDS.HIGH).toBeLessThan(CSL_THRESHOLDS.CRITICAL);
    expect(CSL_THRESHOLDS.CRITICAL).toBeLessThan(CSL_THRESHOLDS.DEDUP);
  });

  test('MINIMUM ≈ 0.500', () => {
    expect(CSL_THRESHOLDS.MINIMUM).toBeCloseTo(0.5, 2);
  });

  test('phiThreshold is deterministic', () => {
    expect(phiThreshold(2)).toBeCloseTo(CSL_THRESHOLDS.MEDIUM, 10);
  });
});

// ─── Pressure Levels ─────────────────────────────────────────────────────────

describe('Pressure Levels', () => {
  test('pressureLevel returns correct levels', () => {
    expect(pressureLevel(0.1)).toBe('NOMINAL');
    expect(pressureLevel(0.5)).toBe('ELEVATED');
    expect(pressureLevel(0.7)).toBe('HIGH');
    expect(pressureLevel(0.95)).toBe('CRITICAL');
  });
});

// ─── Backoff ─────────────────────────────────────────────────────────────────

describe('Phi Backoff', () => {
  test('backoff increases with each attempt', () => {
    const delays = [];
    for (let i = 0; i < 5; i++) {
      delays.push(phiBackoff(i, 1000, 60000, false));
    }
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  test('backoff is capped at maxMs', () => {
    const delay = phiBackoff(100, 1000, 60000, false);
    expect(delay).toBeLessThanOrEqual(60000);
  });

  test('attempt 0 returns baseMs', () => {
    expect(phiBackoff(0, 1000, 60000, false)).toBe(1000);
  });
});

// ─── Fusion Weights ──────────────────────────────────────────────────────────

describe('Phi Fusion Weights', () => {
  test('weights sum to 1', () => {
    for (let n = 1; n <= 5; n++) {
      const weights = phiFusionWeights(n);
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });

  test('weights are descending', () => {
    const weights = phiFusionWeights(4);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThan(weights[i - 1]);
    }
  });

  test('2-factor weights ≈ [0.618, 0.382]', () => {
    const w = phiFusionWeights(2);
    expect(w[0]).toBeCloseTo(PSI, 2);
    expect(w[1]).toBeCloseTo(1 - PSI, 2);
  });
});

// ─── Resource Allocation ─────────────────────────────────────────────────────

describe('Pool Allocation', () => {
  test('allocations sum to total', () => {
    const total = 1000;
    const alloc = poolAllocation(total);
    const sum = alloc.hot + alloc.warm + alloc.cold + alloc.reserve + alloc.governance;
    expect(sum).toBe(total);
  });

  test('hot pool gets largest share', () => {
    const alloc = poolAllocation(1000);
    expect(alloc.hot).toBeGreaterThan(alloc.warm);
    expect(alloc.warm).toBeGreaterThan(alloc.cold);
  });
});

// ─── Multi-Split ─────────────────────────────────────────────────────────────

describe('Phi Multi-Split', () => {
  test('splits sum to whole', () => {
    const parts = phiMultiSplit(100, 5);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

// ─── Token Budgets ───────────────────────────────────────────────────────────

describe('Token Budgets', () => {
  test('budgets follow phi-geometric progression', () => {
    const budgets = phiTokenBudgets(8192);
    expect(budgets.working).toBe(8192);
    expect(budgets.session).toBeGreaterThan(budgets.working);
    expect(budgets.memory).toBeGreaterThan(budgets.session);
    expect(budgets.artifacts).toBeGreaterThan(budgets.memory);
  });
});

// ─── CSL Gate ────────────────────────────────────────────────────────────────

describe('CSL Gate', () => {
  test('gate output is bounded [0, value]', () => {
    const result = cslGate(1.0, 0.9);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1.0);
  });

  test('high cosScore → output ≈ value', () => {
    // With tau=0.809 (MEDIUM), cos=0.99 gives strong gating
    const result = cslGate(1.0, 0.99);
    expect(result).toBeGreaterThan(0.5);
    // With explicitly low tau, cos=0.99 should gate fully open
    const resultLow = cslGate(1.0, 0.99, 0.5);
    expect(resultLow).toBeGreaterThan(0.85);
  });

  test('low cosScore → output ≈ 0', () => {
    const result = cslGate(1.0, 0.1);
    expect(result).toBeLessThan(0.15);
  });
});

// ─── Eviction Weights ────────────────────────────────────────────────────────

describe('Eviction Weights', () => {
  test('weights sum to 1', () => {
    const sum = EVICTION_WEIGHTS.importance +
                EVICTION_WEIGHTS.recency +
                EVICTION_WEIGHTS.relevance;
    expect(sum).toBeCloseTo(1.0, 10);
  });

  test('importance has highest weight', () => {
    expect(EVICTION_WEIGHTS.importance).toBeGreaterThan(EVICTION_WEIGHTS.recency);
    expect(EVICTION_WEIGHTS.recency).toBeGreaterThan(EVICTION_WEIGHTS.relevance);
  });
});
