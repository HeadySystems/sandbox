/**
 * ∞ Heady™ Vector Space Ops — 384-Dimensional Vector Mathematics
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * @module vector-space-ops
 * @description Core mathematical operations for 384D embedding space.
 *   Provides SIMD-friendly loops, dimensionality reduction, golden-ratio
 *   sharding, and deterministic text hashing for offline embedding.
 *   All operations are pure functions with no external dependencies.
 */

'use strict';

/** Dimensionality of the embedding space used across the platform. */
const DIMS = 384;

/** Golden ratio φ — used in Fibonacci / golden-ratio sharding. */
const PHI = (1 + Math.sqrt(5)) / 2;

/** Inverse golden ratio (1/φ). */
const INV_PHI = 1 / PHI;

// ---------------------------------------------------------------------------
// Basic Arithmetic
// ---------------------------------------------------------------------------

/**
 * Compute the dot product of two equal-length Float32Arrays.
 * Inner loop is structured for JIT/SIMD auto-vectorisation.
 *
 * @param {Float32Array} a - First vector.
 * @param {Float32Array} b - Second vector.
 * @returns {number} Scalar dot product.
 * @throws {RangeError} When vectors have different lengths.
 */
function dotProduct(a, b) {
  if (a.length !== b.length) {
    throw new RangeError(`dotProduct: dimension mismatch (${a.length} vs ${b.length})`);
  }
  let sum = 0;
  const len = a.length;
  // Unrolled 4-wide loop for better JIT vectorisation.
  const len4 = len - (len % 4);
  let i = 0;
  for (; i < len4; i += 4) {
    sum += a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3];
  }
  for (; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Compute the squared L2 norm of a vector (avoids sqrt for comparisons).
 *
 * @param {Float32Array} v - Input vector.
 * @returns {number} Squared magnitude.
 */
function magnitudeSquared(v) {
  let sum = 0;
  const len = v.length;
  const len4 = len - (len % 4);
  let i = 0;
  for (; i < len4; i += 4) {
    sum += v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2] + v[i + 3] * v[i + 3];
  }
  for (; i < len; i++) {
    sum += v[i] * v[i];
  }
  return sum;
}

/**
 * Compute the L2 norm (magnitude) of a vector.
 *
 * @param {Float32Array} v - Input vector.
 * @returns {number} Euclidean magnitude.
 */
function magnitude(v) {
  return Math.sqrt(magnitudeSquared(v));
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value in [-1, 1] where 1 = identical direction.
 *
 * @param {Float32Array} a - First vector.
 * @param {Float32Array} b - Second vector.
 * @returns {number} Cosine similarity score.
 */
function cosineSimilarity(a, b) {
  const dot = dotProduct(a, b);
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  // Clamp to [-1, 1] to guard against floating-point overflow.
  return Math.max(-1, Math.min(1, dot / (magA * magB)));
}

/**
 * Compute Euclidean (L2) distance between two vectors.
 *
 * @param {Float32Array} a - First vector.
 * @param {Float32Array} b - Second vector.
 * @returns {number} Euclidean distance.
 * @throws {RangeError} When vectors have different lengths.
 */
function euclideanDistance(a, b) {
  if (a.length !== b.length) {
    throw new RangeError(`euclideanDistance: dimension mismatch (${a.length} vs ${b.length})`);
  }
  let sum = 0;
  const len = a.length;
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// ---------------------------------------------------------------------------
// Vector Construction / Transformation
// ---------------------------------------------------------------------------

/**
 * Return a new unit vector (L2 normalised) from input vector.
 * Zero vectors are returned unchanged to avoid NaN.
 *
 * @param {Float32Array} v - Input vector.
 * @returns {Float32Array} Normalised vector.
 */
function normalize(v) {
  const mag = magnitude(v);
  if (mag === 0) return new Float32Array(v);
  const out = new Float32Array(v.length);
  const invMag = 1 / mag;
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] * invMag;
  }
  return out;
}

/**
 * Element-wise addition of two vectors.
 *
 * @param {Float32Array} a - First vector.
 * @param {Float32Array} b - Second vector.
 * @returns {Float32Array} Result vector.
 * @throws {RangeError} When vectors have different lengths.
 */
function add(a, b) {
  if (a.length !== b.length) {
    throw new RangeError(`add: dimension mismatch (${a.length} vs ${b.length})`);
  }
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] + b[i];
  }
  return out;
}

/**
 * Element-wise subtraction of two vectors (a - b).
 *
 * @param {Float32Array} a - First vector.
 * @param {Float32Array} b - Second vector.
 * @returns {Float32Array} Result vector.
 * @throws {RangeError} When vectors have different lengths.
 */
function subtract(a, b) {
  if (a.length !== b.length) {
    throw new RangeError(`subtract: dimension mismatch (${a.length} vs ${b.length})`);
  }
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] - b[i];
  }
  return out;
}

/**
 * Scale a vector by a scalar multiplier.
 *
 * @param {Float32Array} v - Input vector.
 * @param {number} scalar - Multiplier.
 * @returns {Float32Array} Scaled vector.
 */
function scale(v, scalar) {
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] * scalar;
  }
  return out;
}

/**
 * Compute the centroid (mean vector) of an array of vectors.
 * All vectors must have identical dimension.
 *
 * @param {Float32Array[]} vectors - Array of input vectors.
 * @returns {Float32Array} Centroid vector.
 * @throws {Error} When vectors array is empty.
 */
function centroid(vectors) {
  if (!vectors || vectors.length === 0) {
    throw new Error('centroid: cannot compute centroid of empty array');
  }
  const dims = vectors[0].length;
  const sum = new Float32Array(dims);
  for (const v of vectors) {
    for (let i = 0; i < dims; i++) {
      sum[i] += v[i];
    }
  }
  const invN = 1 / vectors.length;
  for (let i = 0; i < dims; i++) {
    sum[i] *= invN;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Dimensionality Reduction
// ---------------------------------------------------------------------------

/**
 * Project a 384D vector to 3D using a deterministic PCA-like linear
 * projection. The projection matrix is fixed (seeded) so that the same
 * high-dimensional point always maps to the same 3D coordinate, enabling
 * stable visualisation across sessions.
 *
 * The three projection axes are constructed as follows:
 *   axis0 = dimensions [0..127]   summed with Fourier-like weights
 *   axis1 = dimensions [128..255] summed with Fourier-like weights
 *   axis2 = dimensions [256..383] summed with Fourier-like weights
 * Each axis is then normalised to [-1, 1].
 *
 * @param {Float32Array} v384 - 384D input vector.
 * @returns {{ x: number, y: number, z: number }} 3D projected coordinates.
 */
function projectTo3D(v384) {
  // Use three orthogonal bands of the 384D space.
  // Within each band, apply a cosine-weighted projection.
  let x = 0, y = 0, z = 0;
  const band = 128;
  for (let i = 0; i < band; i++) {
    const w = Math.cos((i / band) * Math.PI); // [-1, 1] weight envelope
    x += v384[i] * w;
    y += v384[i + band] * w;
    z += v384[i + 2 * band] * w;
  }
  // Normalise to unit range using tanh squeeze.
  return {
    x: Math.tanh(x / band),
    y: Math.tanh(y / band),
    z: Math.tanh(z / band),
  };
}

// ---------------------------------------------------------------------------
// Fibonacci / Golden-Ratio Sharding
// ---------------------------------------------------------------------------

/**
 * Assign a 384D vector to a shard index using the golden-ratio projection.
 *
 * The algorithm:
 *   1. Compute a scalar "fingerprint" of the vector by dotting with a
 *      fixed golden-ratio-derived probe vector.
 *   2. Apply the fractional part of (fingerprint * φ) — the van der Corput
 *      sequence generalisation that gives uniform shard distribution.
 *   3. Map to [0, numShards).
 *
 * @param {Float32Array} v384 - Input vector.
 * @param {number} numShards - Total number of shards.
 * @returns {number} Integer shard index in [0, numShards).
 */
function fibonacciShardIndex(v384, numShards) {
  if (numShards <= 1) return 0;
  // Build probe by cycling golden-ratio multiples.
  let dot = 0;
  for (let i = 0; i < v384.length; i++) {
    // Probe value at dimension i using golden-ratio spiral.
    const probe = ((i * INV_PHI) % 1) * 2 - 1; // Maps to [-1, 1]
    dot += v384[i] * probe;
  }
  // Squeeze into (0, 1) via sigmoid.
  const norm = 1 / (1 + Math.exp(-dot / 10));
  // Van der Corput-style spread using fractional part of norm * numShards.
  const frac = (norm * PHI) % 1;
  return Math.floor(frac * numShards) % numShards;
}

// ---------------------------------------------------------------------------
// Random Vectors
// ---------------------------------------------------------------------------

/**
 * Generate a random unit vector of the given dimensionality using the
 * Box-Muller transform (Gaussian sampling → normalise).
 *
 * @param {number} [dims=DIMS] - Number of dimensions.
 * @returns {Float32Array} Random unit vector.
 */
function randomUnit(dims = DIMS) {
  const v = new Float32Array(dims);
  // Box-Muller pairs.
  for (let i = 0; i < dims; i += 2) {
    const u1 = Math.random() || 1e-10; // Guard against 0.
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    v[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < dims) {
      v[i + 1] = r * Math.sin(2 * Math.PI * u2);
    }
  }
  return normalize(v);
}

// ---------------------------------------------------------------------------
// Deterministic Text Embedding
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic 384D unit embedding from a text string.
 * Uses a seeded variant of the FNV-1a hash function extended across all
 * 384 dimensions via a linear congruential generator (LCG) seeded by the
 * hash. Suitable as a local fallback when cloud embedding is unavailable.
 *
 * NOTE: This is NOT semantically meaningful — it does NOT capture language
 * semantics. Use only as an offline placeholder / cache-miss fallback.
 *
 * @param {string} text - Input text to embed.
 * @returns {Float32Array} Deterministic 384D unit vector.
 */
function embed(text) {
  // FNV-1a 32-bit hash.
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // Keep 32-bit unsigned.
  }

  // LCG constants (Numerical Recipes).
  const LCG_A = 1664525;
  const LCG_C = 1013904223;
  const LCG_M = 2 ** 32;

  const v = new Float32Array(DIMS);
  let seed = hash;
  for (let i = 0; i < DIMS; i++) {
    seed = (LCG_A * seed + LCG_C) % LCG_M;
    // Map to [-1, 1] using Box-Muller approximation via two LCG steps.
    const u1 = seed / LCG_M;
    seed = (LCG_A * seed + LCG_C) % LCG_M;
    const u2 = seed / LCG_M;
    // Approximate Gaussian sample.
    v[i] = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
  return normalize(v);
}

// ---------------------------------------------------------------------------
// Utility / Serialisation
// ---------------------------------------------------------------------------

/**
 * Serialise a Float32Array to a plain JavaScript number array for JSON.
 *
 * @param {Float32Array} v - Vector to serialise.
 * @returns {number[]} Plain array.
 */
function toArray(v) {
  return Array.from(v);
}

/**
 * Deserialise a plain number array back to a Float32Array.
 *
 * @param {number[]|Float32Array} arr - Array to convert.
 * @returns {Float32Array} Float32Array vector.
 */
function fromArray(arr) {
  return new Float32Array(arr);
}

/**
 * Check whether a value is a valid DIMS-dimensional Float32Array.
 *
 * @param {*} v - Value to check.
 * @param {number} [dims=DIMS] - Expected dimension.
 * @returns {boolean}
 */
function isValidVector(v, dims = DIMS) {
  return v instanceof Float32Array && v.length === dims;
}

/**
 * Linear interpolation between two vectors (LERP).
 *
 * @param {Float32Array} a - Start vector.
 * @param {Float32Array} b - End vector.
 * @param {number} t - Interpolation factor in [0, 1].
 * @returns {Float32Array} Interpolated vector.
 */
function lerp(a, b, t) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] + (b[i] - a[i]) * t;
  }
  return out;
}

/**
 * Spherical linear interpolation (SLERP) between two unit vectors.
 * Falls back to lerp + normalise when vectors are nearly parallel.
 *
 * @param {Float32Array} a - Start unit vector.
 * @param {Float32Array} b - End unit vector.
 * @param {number} t - Interpolation factor in [0, 1].
 * @returns {Float32Array} Interpolated unit vector.
 */
function slerp(a, b, t) {
  const cosTheta = cosineSimilarity(a, b);
  if (cosTheta > 0.9999) {
    return normalize(lerp(a, b, t));
  }
  const theta = Math.acos(Math.min(1, Math.max(-1, cosTheta)));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return add(scale(a, wa), scale(b, wb));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------


module.exports = { DIMS, PHI, INV_PHI };
