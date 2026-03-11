/**
 * @file monte-carlo-engine-csl-enhanced.js
 * @description CSL-enhanced Monte Carlo simulation engine for trading and risk analysis.
 *   Extends the base MonteCarloEngine pattern with continuous-logic confidence weighting,
 *   phi-harmonic confidence intervals, and full trading simulation capabilities.
 *
 * @module CSLMonteCarloEngine
 * @version 2.0.0
 * @author HeadySystems Inc.
 * @copyright © 2026 Heady™Systems Inc. All rights reserved.
 *
 * @patent US-PENDING-2026-HSI-001 — Phi-Harmonic Semantic Gate Architecture
 * @patent US-PENDING-2026-HSI-004 — CSL Monte Carlo Risk Fusion Protocol
 *
 * All numeric constants are derived from φ (phi) = 1.6180339887.
 *
 * Architecture:
 *   - Uses a seeded Mulberry32 PRNG for full reproducibility
 *   - CSL confidence gates modulate each risk factor's effective probability
 *   - Geometric mean fusion replaces arithmetic summation for multi-factor risk
 *   - Phi-harmonic confidence bands replace standard 95% CI
 */

'use strict';

const { EventEmitter } = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// PHI CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** @constant {number} PHI — Golden ratio φ */
const PHI = 1.6180339887;

/** @constant {number} PSI — 1/φ ≈ 0.6180339887 */
const PSI = 1 / PHI;

/** @constant {number} PSI2 — PSI² ≈ 0.3819660113 */
const PSI2 = PSI * PSI;

/** @constant {number} PHI2 — φ² ≈ 2.6180339887 */
const PHI2 = PHI * PHI;

/** @constant {number} EPSILON — floating-point tolerance */
const EPSILON = 1e-10;

// Grade thresholds (phi-scaled): multiply by PSI^n * 60
const GRADE_GREEN   = (1 / PSI) * 60;     // ≈ 97.08
const GRADE_YELLOW  = (PSI ** 0) * 60;    // = 60.00
const GRADE_ORANGE  = PSI * 60;           // ≈ 37.08
// Below GRADE_ORANGE → RED

// ─────────────────────────────────────────────────────────────────────────────
// MULBERRY32 PRNG — seeded, deterministic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Mulberry32 pseudo-random number generator from a 32-bit seed.
 * @param {number} seed — integer seed
 * @returns {() => number} function returning uniform [0, 1)
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sort a numeric array in ascending order (returns a copy).
 * @param {number[]} arr
 * @returns {number[]}
 */
function sortAsc(arr) {
  return [...arr].sort((a, b) => a - b);
}

/**
 * Compute a percentile from a sorted array.
 * @param {number[]} sorted — ascending sorted array
 * @param {number} p — percentile ∈ [0,100]
 * @returns {number}
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

/**
 * Compute mean of an array.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Compute sample standard deviation.
 * @param {number[]} arr
 * @returns {number}
 */
function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Geometric mean of positive values; ignores zeros in input.
 * @param {number[]} values
 * @returns {number}
 */
function geometricMean(values) {
  if (!values || values.length === 0) return 0;
  const pos = values.filter(v => v > 0);
  if (pos.length === 0) return 0;
  return Math.exp(pos.reduce((s, v) => s + Math.log(v), 0) / pos.length);
}

/**
 * Wilson score confidence interval for a binary proportion.
 * @param {number} successes
 * @param {number} total
 * @param {number} [z=1.96] — z-score for desired confidence level
 * @returns {{ lower: number, upper: number, center: number }}
 */
function wilsonInterval(successes, total, z = 1.96) {
  if (total === 0) return { lower: 0, upper: 1, center: 0.5 };
  const p = successes / total;
  const denom = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denom;
  const halfWidth = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / denom;
  return {
    lower: Math.max(0, center - halfWidth),
    upper: Math.min(1, center + halfWidth),
    center,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSL GATE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSL gate: maps confidence ∈ [0,1] to activation ∈ [0,1].
 * Smooth linear interpolation between PSI² and PSI.
 * @param {number} confidence
 * @returns {number}
 */
function cslGate(confidence) {
  if (confidence >= PSI) return 1;
  if (confidence < PSI2) return 0;
  return (confidence - PSI2) / (PSI - PSI2);
}

/**
 * Classify confidence value into CSL zone.
 * @param {number} confidence
 * @returns {'EXECUTE'|'CAUTIOUS'|'HALT'}
 */
function classifyConfidence(confidence) {
  if (confidence > PSI) return 'EXECUTE';
  if (confidence >= PSI2) return 'CAUTIOUS';
  return 'HALT';
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADE SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a numeric score (0–100) to a letter grade using phi-harmonic thresholds.
 * @param {number} score
 * @returns {'A'|'B'|'C'|'F'}
 */
function scoreToGrade(score) {
  if (score >= GRADE_GREEN)  return 'A';  // ≥ 97.08
  if (score >= GRADE_YELLOW) return 'B';  // ≥ 60.00
  if (score >= GRADE_ORANGE) return 'C';  // ≥ 37.08
  return 'F';
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE MONTE CARLO ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class MonteCarloEngine
 * @description Base Monte Carlo simulation engine with seeded PRNG,
 *   scenario analysis, pipeline hooks, and Wilson intervals.
 */
class MonteCarloEngine extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.seed=42] — PRNG seed for reproducibility
   * @param {number} [options.defaultIterations=10000]
   */
  constructor(options = {}) {
    super();
    this._seed = options.seed !== undefined ? options.seed : 42;
    this._defaultIterations = options.defaultIterations || 10000;
    this._rng = mulberry32(this._seed);
    this._hooks = { pre: [], post: [] };
  }

  /** Reset PRNG to initial seed. */
  resetRng() {
    this._rng = mulberry32(this._seed);
    return this;
  }

  /** Add a pipeline hook. @param {'pre'|'post'} stage  @param {Function} fn */
  addHook(stage, fn) {
    if (this._hooks[stage]) this._hooks[stage].push(fn);
    return this;
  }

  /** Run all hooks for a given stage. */
  _runHooks(stage, data) {
    return this._hooks[stage].reduce((acc, fn) => fn(acc) || acc, data);
  }

  /**
   * Base simulation: sample risk factors over N iterations.
   * @param {{ factors: Array<{name: string, probability: number, impact: number}> }} params
   * @param {number} [iterations]
   * @returns {{ losses: number[], stats: object }}
   */
  runSimulation(params, iterations) {
    const n = iterations || this._defaultIterations;
    params = this._runHooks('pre', params);

    const losses = new Array(n);
    for (let i = 0; i < n; i++) {
      let totalLoss = 0;
      for (const factor of params.factors) {
        if (this._rng() < factor.probability) {
          totalLoss += factor.impact;
        }
      }
      losses[i] = totalLoss;
    }

    const sorted = sortAsc(losses);
    const stats = {
      mean: mean(losses),
      stdDev: stdDev(losses),
      var95: percentile(sorted, 95),
      var99: percentile(sorted, 99),
      max: sorted[sorted.length - 1],
      min: sorted[0],
      iterations: n,
    };

    this._runHooks('post', { losses, stats });
    return { losses, stats };
  }

  /**
   * Scenario analysis: run simulation for each scenario definition.
   * @param {Array<{name: string, factors: object[]}>} scenarios
   * @param {number} [iterations]
   * @returns {Array<{name: string, stats: object}>}
   */
  scenarioAnalysis(scenarios, iterations) {
    return scenarios.map(scenario => {
      this.resetRng();
      const { stats } = this.runSimulation({ factors: scenario.factors }, iterations);
      return { name: scenario.name, stats };
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSL MONTE CARLO ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class CSLMonteCarloEngine
 * @extends MonteCarloEngine
 * @description Extends MonteCarloEngine with CSL confidence-weighted simulations,
 *   phi-harmonic confidence intervals, and trading-specific simulation capabilities.
 */
class CSLMonteCarloEngine extends MonteCarloEngine {
  /**
   * @param {object} [options] — passed to MonteCarloEngine
   */
  constructor(options = {}) {
    super(options);
    this._cslStats = {
      totalCSLSims: 0,
      totalTradingSims: 0,
      avgCSLConfidence: 0,
    };
  }

  /**
   * Override grade scoring to use phi-harmonic thresholds.
   * @param {number} score
   * @returns {'A'|'B'|'C'|'F'}
   */
  scoreToGrade(score) {
    return scoreToGrade(score);
  }

  // ── CSL Risk Fusion ───────────────────────────────────────────────────────

  /**
   * Geometric mean confidence fusion across all risk factors.
   * Uses geometric mean of each factor's cslConfidence.
   *
   * @param {Array<{cslConfidence: number, [key: string]: any}>} factors
   * @returns {{ fusedConfidence: number, gateValue: number, zone: string }}
   */
  cslRiskFusion(factors) {
    if (!factors || factors.length === 0) {
      return { fusedConfidence: 0, gateValue: 0, zone: 'HALT' };
    }

    const confidences = factors.map(f =>
      typeof f.cslConfidence === 'number' ? Math.max(0, Math.min(1, f.cslConfidence)) : 0.5
    );

    const fusedConfidence = geometricMean(confidences);
    const gateValue = cslGate(fusedConfidence);
    const zone = classifyConfidence(fusedConfidence);

    return { fusedConfidence, gateValue, zone, confidences };
  }

  // ── CSL Simulation ────────────────────────────────────────────────────────

  /**
   * CSL-gated simulation: each risk factor is modulated by its cslConfidence.
   *
   * For each factor:
   *   effective_prob   = probability * cslGate(cslConfidence)
   *   effective_impact = impact * (1 - (1/PHI) * cslConfidence)
   *
   * Multi-factor risk is combined as geometric mean (not sum).
   *
   * @param {{ factors: Array<{name: string, probability: number, impact: number, cslConfidence?: number}> }} params
   * @param {number} [iterations]
   * @returns {{ losses: number[], stats: object, cslStats: object }}
   */
  runCSLSimulation(params, iterations) {
    const n = iterations || this._defaultIterations;
    params = this._runHooks('pre', params);
    this._cslStats.totalCSLSims++;

    // Pre-compute effective factors
    const effectiveFactors = params.factors.map(factor => {
      const conf = typeof factor.cslConfidence === 'number'
        ? Math.max(0, Math.min(1, factor.cslConfidence))
        : 0.5;
      const gate = cslGate(conf);
      return {
        name: factor.name,
        effectiveProbability: factor.probability * gate,
        effectiveImpact: factor.impact * (1 - (1 / PHI) * conf),
        cslConfidence: conf,
        gate,
      };
    });

    // Geometric mean of all factor cslConfidences
    const { fusedConfidence } = this.cslRiskFusion(params.factors);

    const losses = new Array(n);
    let triggeredCount = 0;

    for (let i = 0; i < n; i++) {
      const factorLosses = [];
      for (const ef of effectiveFactors) {
        if (this._rng() < ef.effectiveProbability) {
          factorLosses.push(ef.effectiveImpact);
          triggeredCount++;
        }
      }
      // Geometric mean for multi-factor (0 if none triggered)
      losses[i] = factorLosses.length > 0 ? geometricMean(factorLosses) : 0;
    }

    const sorted = sortAsc(losses);
    const stats = {
      mean: mean(losses),
      stdDev: stdDev(losses),
      var95: percentile(sorted, 95),
      var99: percentile(sorted, 99),
      max: sorted[sorted.length - 1],
      min: sorted[0],
      iterations: n,
    };

    const cslStats = {
      fusedConfidence,
      avgTriggerRate: triggeredCount / (n * effectiveFactors.length),
      effectiveFactors,
      zone: classifyConfidence(fusedConfidence),
    };

    // Update running average
    this._cslStats.avgCSLConfidence =
      (this._cslStats.avgCSLConfidence * (this._cslStats.totalCSLSims - 1) + fusedConfidence) /
      this._cslStats.totalCSLSims;

    this._runHooks('post', { losses, stats, cslStats });
    return { losses, stats, cslStats };
  }

  // ── Trading Simulation ────────────────────────────────────────────────────

  /**
   * Trading-specific Monte Carlo simulation.
   * Simulates equity paths with CSL-gated position entry/exit.
   *
   * @param {Array<{symbol: string, size: number, entryConfidence: number, exitThreshold?: number}>} positions
   * @param {{ volatility: number, drift: number, initialEquity: number, daysPerPath: number }} marketParams
   * @param {number} [iterations=1000]
   * @returns {{ pnlDistribution: object, maxDrawdownDistribution: object, winRate: object, paths: number[][], cslStats: object }}
   */
  tradingSimulation(positions, marketParams, iterations = 1000) {
    this._cslStats.totalTradingSims++;

    const {
      volatility = 0.02,
      drift = 0.0005,
      initialEquity = 100000,
      daysPerPath = 252,
    } = marketParams;

    const pnlResults = new Array(iterations);
    const maxDrawdownResults = new Array(iterations);
    const paths = [];
    let wins = 0;

    for (let iter = 0; iter < iterations; iter++) {
      let equity = initialEquity;
      let peakEquity = initialEquity;
      let maxDrawdown = 0;
      const path = [equity];

      for (let day = 0; day < daysPerPath; day++) {
        // Daily return: geometric Brownian motion (Box-Muller)
        const u1 = this._rng();
        const u2 = this._rng();
        const z = Math.sqrt(-2 * Math.log(Math.max(u1, EPSILON))) * Math.cos(2 * Math.PI * u2);
        const dailyReturn = drift + volatility * z;

        // Aggregate position P&L modulated by CSL gates
        let positionPnL = 0;
        for (const pos of positions) {
          const entryGate = cslGate(pos.entryConfidence);
          const exitThresh = pos.exitThreshold !== undefined ? pos.exitThreshold : PSI2;
          const exitGate = cslGate(pos.entryConfidence - exitThresh);

          // Only enter if entry gate is active
          if (entryGate > 0) {
            const posReturn = pos.size * dailyReturn * entryGate;
            // Exit gate: if confidence drops below exit threshold, reduce exposure
            positionPnL += posReturn * (1 - (1 - exitGate) * PSI);
          }
        }

        equity = equity * (1 + dailyReturn) + positionPnL;
        equity = Math.max(0, equity);  // floor at 0

        if (equity > peakEquity) peakEquity = equity;
        const drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        path.push(equity);
      }

      const pnl = equity - initialEquity;
      pnlResults[iter] = pnl;
      maxDrawdownResults[iter] = maxDrawdown;
      if (pnl > 0) wins++;

      if (iter < 100) paths.push(path); // keep first 100 paths for memory
    }

    const sortedPnl = sortAsc(pnlResults);
    const sortedDD = sortAsc(maxDrawdownResults);
    const winInterval = wilsonInterval(wins, iterations);

    // Phi-harmonic confidence interval on P&L
    const phiCI = this.phiScaledConfidenceInterval(pnlResults);

    const cslStats = {
      positionCount: positions.length,
      avgEntryConfidence: mean(positions.map(p => p.entryConfidence)),
      entryZones: positions.map(p => ({
        symbol: p.symbol,
        zone: classifyConfidence(p.entryConfidence),
      })),
    };

    return {
      pnlDistribution: {
        mean: mean(pnlResults),
        stdDev: stdDev(pnlResults),
        var95: percentile(sortedPnl, 5),   // 5th pct = 95% VaR (worst)
        var99: percentile(sortedPnl, 1),
        p50: percentile(sortedPnl, 50),
        p90: percentile(sortedPnl, 90),
        phiCI,
      },
      maxDrawdownDistribution: {
        mean: mean(maxDrawdownResults),
        stdDev: stdDev(maxDrawdownResults),
        p50: percentile(sortedDD, 50),
        p75: percentile(sortedDD, 75),
        p95: percentile(sortedDD, 95),
        worst: sortedDD[sortedDD.length - 1],
      },
      winRate: {
        rate: wins / iterations,
        wins,
        iterations,
        wilsonCI: winInterval,
      },
      paths,
      cslStats,
    };
  }

  // ── Phi-Harmonic Confidence Interval ─────────────────────────────────────

  /**
   * Compute phi-harmonic confidence bands for a data series.
   * Uses phi-scaled percentiles instead of standard ±1.96σ.
   *
   * Bands at phi-derived percentiles:
   *   - Center: 50th percentile
   *   - Inner band: [50 - 50*PSI², 50 + 50*PSI²] ≈ [30.9, 69.1]
   *   - Outer band: [50 - 50*PSI,  50 + 50*PSI]  ≈ [19.1, 80.9]
   *   - Extreme: [50 - 50/PHI², 50 + 50/PHI²] ≈ [30.9, 69.1] → outer
   *
   * @param {number[]} data
   * @returns {{ center: number, innerLow: number, innerHigh: number, outerLow: number, outerHigh: number, phiBands: object }}
   */
  phiScaledConfidenceInterval(data) {
    if (!data || data.length === 0) {
      return { center: 0, innerLow: 0, innerHigh: 0, outerLow: 0, outerHigh: 0 };
    }

    const sorted = sortAsc(data);

    // Phi-derived percentile offsets from median
    const innerOffset = 50 * PSI2;   // ≈ 19.1
    const outerOffset = 50 * PSI;    // ≈ 30.9
    const extremeOffset = 50 / PHI2; // ≈ 19.1 (same as inner for symmetry via phi identity)

    const phiBands = {
      p_phi0:   percentile(sorted, 50 - extremeOffset),
      p_phi1:   percentile(sorted, 50 - outerOffset),
      p_phi2:   percentile(sorted, 50 - innerOffset),
      p_median: percentile(sorted, 50),
      p_phi3:   percentile(sorted, 50 + innerOffset),
      p_phi4:   percentile(sorted, 50 + outerOffset),
      p_phi5:   percentile(sorted, 50 + extremeOffset),
    };

    return {
      center:    phiBands.p_median,
      innerLow:  phiBands.p_phi2,
      innerHigh: phiBands.p_phi3,
      outerLow:  phiBands.p_phi1,
      outerHigh: phiBands.p_phi4,
      extremeLow:  phiBands.p_phi0,
      extremeHigh: phiBands.p_phi5,
      phiBands,
    };
  }

  // ── Internal Stats ────────────────────────────────────────────────────────

  /**
   * Return CSL-specific engine statistics.
   * @returns {object}
   */
  getCSLStats() {
    return { ...this._cslStats };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Classes
  MonteCarloEngine,
  CSLMonteCarloEngine,

  // Constants
  PHI,
  PSI,
  PSI2,
  PHI2,
  EPSILON,
  GRADE_GREEN,
  GRADE_YELLOW,
  GRADE_ORANGE,

  // Utilities
  mulberry32,
  sortAsc,
  percentile,
  mean,
  stdDev,
  geometricMean,
  wilsonInterval,
  cslGate,
  classifyConfidence,
  scoreToGrade,
};
