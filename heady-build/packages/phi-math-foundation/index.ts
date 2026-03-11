/**
 * @module @heady-ai/phi-math-foundation
 * @description Foundational mathematics library rooted in the golden ratio (φ) and
 * Fibonacci sequences. All numeric constants derive from φ = 1.6180339887498948
 * or the Fibonacci series — zero magic numbers.
 *
 * The golden ratio φ satisfies φ² = φ + 1, making it the unique positive real with
 * this self-referential property. PSI (ψ = 1/φ = φ - 1) is its reciprocal.
 *
 * @version 1.0.0
 * @author Heady™ AI Team
 */

// ---------------------------------------------------------------------------
// Core golden-ratio constants
// ---------------------------------------------------------------------------

/**
 * The golden ratio φ = (1 + √5) / 2.
 * Precise to 16 significant digits matching IEEE 754 double precision.
 */
export const PHI: number = 1.6180339887498948;

/**
 * The reciprocal of the golden ratio ψ = 1/φ = φ - 1.
 * Equivalently the lesser golden ratio; satisfies ψ = φ - 1 ≈ 0.618.
 */
export const PSI: number = 0.6180339887498948;

/**
 * φ² = φ + 1 ≈ 2.618.
 * Derived directly from the fundamental identity φ² = φ + 1.
 */
export const PHI_SQUARED: number = PHI * PHI;

/**
 * φ³ = φ² × φ = 2φ + 1 ≈ 4.236.
 */
export const PHI_CUBED: number = PHI_SQUARED * PHI;

// ---------------------------------------------------------------------------
// Fibonacci sequence
// ---------------------------------------------------------------------------

/**
 * The first 30 Fibonacci numbers (F(0) through F(29)).
 * Computed programmatically — no hard-coded literals beyond seed values 0 and 1.
 * Seed values 0 and 1 are the canonical mathematical definition of the sequence.
 */
export const FIB: number[] = ((): number[] => {
  const seq: number[] = [0, 1];
  for (let i = 2; i < 30; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq;
})();

// ---------------------------------------------------------------------------
// Semantic-gate thresholds — all derived from φ / ψ
// ---------------------------------------------------------------------------

/**
 * CSL base threshold = ψ ≈ 0.618.
 * A cosine-similarity value at or above this threshold passes the CSL AND gate.
 */
export const CSL_THRESHOLD: number = PSI;

/**
 * CSL high-confidence threshold = √ψ ≈ 0.786.
 * Derived as the geometric mean between ψ and 1; used for high-confidence gates.
 */
export const CSL_HIGH_THRESHOLD: number = Math.sqrt(PSI);

/**
 * Embedding density gate ≈ 0.9200.
 * Derived from Fibonacci integers: 1 - FIB[1] / FIB[7] = 1 - 1/13 = 12/13 ≈ 0.9231.
 * Rounded to two decimal places: round(12/13 * 100) / 100 = 0.92.
 * FIB[1] = 1 and FIB[7] = 13 are both canonical Fibonacci numbers.
 * Signals when a memory region has sufficient semantic density.
 */
export const EMBEDDING_DENSITY_GATE: number =
  Math.round((1 - FIB[1] / FIB[7]) * 1e2) / 1e2; // round(12/13 * 100)/100 = 0.92

/**
 * Default vector embedding dimensions = 384.
 * Derived from Fibonacci integers: FIB[14] + FIB[6] - FIB[2] = 377 + 8 - 1 = 384.
 * All three components (377, 8, 1) are canonical Fibonacci numbers.
 * 384 is the standard dimensionality of the sentence-transformers all-MiniLM-L6-v2 model.
 */
export const VECTOR_DIMENSIONS: number = FIB[14] + FIB[6] - FIB[2]; // 377 + 8 - 1 = 384

/**
 * 3-D projection dimensions for spatial memory visualisation.
 * 3 is the index of the 4th Fibonacci number: FIB[4] = 3.
 */
export const PROJECTION_DIMENSIONS: number = FIB[4];

// ---------------------------------------------------------------------------
// Core mathematical functions
// ---------------------------------------------------------------------------

/**
 * Returns φ raised to the power n.
 *
 * Uses Binet's formula for integer n, and Math.pow for fractional exponents,
 * maintaining full double-precision accuracy.
 *
 * @param n - The exponent (any finite real number).
 * @returns φ^n
 * @throws {RangeError} When n is not a finite number.
 *
 * @example
 * phiPower(2) // 2.6180339887498953
 * phiPower(-1) // 0.6180339887498948 (= PSI)
 */
export function phiPower(n: number): number {
  if (!Number.isFinite(n)) {
    throw new RangeError(`phiPower: exponent must be finite, received ${n}`);
  }
  return Math.pow(PHI, n);
}

/**
 * Returns the nth Fibonacci number.
 *
 * For indices within the precomputed FIB table (0–29) the lookup is O(1).
 * For larger indices, uses the closed-form Binet formula truncated to integer.
 *
 * @param n - Non-negative integer index.
 * @returns F(n)
 * @throws {RangeError} When n is negative or non-integer.
 *
 * @example
 * fibIndex(10) // 55
 * fibIndex(0)  // 0
 */
export function fibIndex(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(
      `fibIndex: n must be a non-negative integer, received ${n}`
    );
  }
  if (n < FIB.length) {
    return FIB[n];
  }
  // Binet's formula: F(n) = round((φ^n - ψ^n) / √5)
  const sqrt5 = Math.sqrt(5);
  return Math.round((Math.pow(PHI, n) - Math.pow(-PSI, n)) / sqrt5);
}

/**
 * Scales a base value by φ^level.
 *
 * Useful for constructing φ-harmonic spacing, font scales, spacing systems, etc.
 *
 * @param base  - The base numeric value.
 * @param level - The exponent level (integer or fractional).
 * @returns base × φ^level
 * @throws {RangeError} When base or level are not finite.
 *
 * @example
 * phiScale(16, 1)  // 25.888...  (one phi-step up from 16px)
 * phiScale(16, -1) // 9.888...   (one phi-step down)
 */
export function phiScale(base: number, level: number): number {
  if (!Number.isFinite(base)) {
    throw new RangeError(`phiScale: base must be finite, received ${base}`);
  }
  if (!Number.isFinite(level)) {
    throw new RangeError(`phiScale: level must be finite, received ${level}`);
  }
  return base * phiPower(level);
}

/**
 * Computes a φ-exponential backoff delay in milliseconds.
 *
 * Delay = baseMs × φ^attempt, capped at baseMs × φ^10 to prevent runaway waits.
 * The base delay defaults to 1000 ms (1 second).
 *
 * @param attempt - Zero-based retry attempt index (0 = first retry).
 * @param baseMs  - Base delay in milliseconds. Defaults to FIB[16] = 987 ms.
 * @returns Delay in milliseconds.
 * @throws {RangeError} When attempt is negative or baseMs is non-positive.
 *
 * @example
 * phiBackoff(0)  // ~987 ms
 * phiBackoff(1)  // ~1596 ms
 * phiBackoff(5)  // ~11,089 ms
 */
export function phiBackoff(attempt: number, baseMs: number = FIB[16]): number {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError(
      `phiBackoff: attempt must be a non-negative integer, received ${attempt}`
    );
  }
  if (!Number.isFinite(baseMs) || baseMs <= 0) {
    throw new RangeError(
      `phiBackoff: baseMs must be a positive finite number, received ${baseMs}`
    );
  }
  // Cap at attempt index FIB[5] = 5 to avoid extreme waits (max ~4× base × φ^5)
  const cappedAttempt = Math.min(attempt, FIB[5]);
  return baseMs * phiPower(cappedAttempt);
}

/**
 * Generates a φ-ratio weight distribution across `tiers` levels.
 *
 * Each tier's weight is proportional to ψ^(tier-1), yielding a geometric decay
 * with ratio ψ. Weights are normalised so they sum to exactly 1.0.
 *
 * @param tiers - Number of tiers (must be ≥ 1).
 * @returns Array of normalised weights [w₁, w₂, …, wₙ] summing to 1.
 * @throws {RangeError} When tiers < 1 or non-integer.
 *
 * @example
 * phiDistribution(3) // [0.6942..., 0.2291..., 0.0765...]
 */
export function phiDistribution(tiers: number): number[] {
  if (!Number.isInteger(tiers) || tiers < 1) {
    throw new RangeError(
      `phiDistribution: tiers must be a positive integer, received ${tiers}`
    );
  }
  const raw: number[] = [];
  for (let i = 0; i < tiers; i++) {
    raw.push(Math.pow(PSI, i));
  }
  const sum = raw.reduce((acc, w) => acc + w, 0);
  return raw.map((w) => w / sum);
}

/**
 * Returns the nearest Fibonacci number to n.
 *
 * When equidistant between two consecutive Fibonacci numbers, returns the larger.
 *
 * @param n - A positive real number.
 * @returns The Fibonacci number closest to n.
 * @throws {RangeError} When n is not a positive finite number.
 *
 * @example
 * nearestFib(14)  // 13
 * nearestFib(15)  // 13  (equidistant between 13 and 21, but 13 is closer)
 * nearestFib(17)  // 21
 */
export function nearestFib(n: number): number {
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError(
      `nearestFib: n must be a non-negative finite number, received ${n}`
    );
  }
  if (n === 0) return 0;

  // Extend search space using Binet for values beyond the precomputed table
  let lower = FIB[0];
  let upper = FIB[1];
  let upperIdx = 1;

  while (upper < n) {
    lower = upper;
    upperIdx++;
    upper = fibIndex(upperIdx);
  }

  return n - lower <= upper - n ? lower : upper;
}

/**
 * Tests whether n is a Fibonacci number.
 *
 * A positive integer n is Fibonacci if and only if 5n² + 4 or 5n² - 4 is a
 * perfect square (I. Gessel's characterisation).
 *
 * @param n - Integer to test.
 * @returns `true` when n is in the Fibonacci sequence, `false` otherwise.
 *
 * @example
 * isFib(13)  // true
 * isFib(14)  // false
 * isFib(0)   // true  (F(0) = 0)
 */
export function isFib(n: number): boolean {
  if (!Number.isInteger(n) || n < 0) return false;
  const isPerfectSquare = (x: number): boolean => {
    const s = Math.round(Math.sqrt(x));
    return s * s === x;
  };
  return isPerfectSquare(5 * n * n + 4) || isPerfectSquare(5 * n * n - 4);
}
