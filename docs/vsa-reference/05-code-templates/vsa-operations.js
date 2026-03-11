/**
 * ═══════════════════════════════════════════════════════════════════════
 * Heady™ VSA Operations - Node.js Implementation
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Vector Symbolic Architecture operations for 10,000-dimensional
 * hypervectors with CSL confidence gating.
 * 
 * Operations:
 *   - Binding (⊗): Associate concepts
 *   - Bundling (+): Combine into sets
 *   - Permutation (π): Encode order
 *   - Similarity (cos): Measure resemblance
 * 
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems
 */

'use strict';

const crypto = require('crypto');

// ─── Constants ──────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const PSI = 0.6180339887;  // φ⁻¹
const VSA_DIM = 10000;

const CSL_THRESHOLDS = {
  DEDUP:  0.951,
  HIGH:   0.882,
  MEDIUM: 0.764,
  LOW:    0.618,  // PSI
  MINIMAL: 0.382
};

// ─── Helper Functions ───────────────────────────────────────────────────────

function normalize(vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);

  if (norm === 0) return vec;

  const result = new Float64Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    result[i] = vec[i] / norm;
  }
  return result;
}

function randomHypervector(dim = VSA_DIM, seed = null) {
  const vec = new Float64Array(dim);

  if (seed === null) {
    // Pure random
    for (let i = 0; i < dim; i++) {
      vec[i] = Math.random() * 2 - 1;  // Uniform [-1, 1]
    }
  } else {
    // Seeded random (for deterministic atoms)
    const hash = crypto.createHash('sha256').update(seed).digest();
    for (let i = 0; i < dim; i++) {
      const idx = i % hash.length;
      vec[i] = (hash[idx] / 255) * 2 - 1;
    }
  }

  return normalize(vec);
}

// ─── VSA Operations ─────────────────────────────────────────────────────────

function bind(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error(`Dimension mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  const result = new Float64Array(vecA.length);
  for (let i = 0; i < vecA.length; i++) {
    result[i] = vecA[i] * vecB[i];
  }

  return normalize(result);
}

function bundle(...vectors) {
  if (vectors.length === 0) {
    throw new Error('Cannot bundle zero vectors');
  }

  const dim = vectors[0].length;
  const sum = new Float64Array(dim);

  for (const vec of vectors) {
    if (vec.length !== dim) {
      throw new Error(`Dimension mismatch in bundling`);
    }
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i];
    }
  }

  return normalize(sum);
}

function permute(vec, shifts = 1) {
  const n = vec.length;
  const result = new Float64Array(n);

  // Normalize shifts to [0, n)
  shifts = ((shifts % n) + n) % n;

  for (let i = 0; i < n; i++) {
    result[i] = vec[(i - shifts + n) % n];
  }

  return result;
}

function unPermute(vec, shifts = 1) {
  return permute(vec, -shifts);
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error(`Dimension mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function cslGatedSimilarity(vecA, vecB, threshold = CSL_THRESHOLDS.LOW) {
  const sim = cosineSimilarity(vecA, vecB);
  return sim >= threshold ? sim : 0;
}

// ─── VSA Engine Class ───────────────────────────────────────────────────────

class VSAEngine {
  constructor(dimensions = VSA_DIM) {
    this.dim = dimensions;
    this.atoms = new Map();  // Named atomic concept vectors
    this.cslThreshold = CSL_THRESHOLDS.LOW;
  }

  /**
   * Get or create an atomic hypervector
   */
  atom(name) {
    if (!this.atoms.has(name)) {
      this.atoms.set(name, randomHypervector(this.dim, name));
    }
    return this.atoms.get(name);
  }

  /**
   * Bind multiple vectors
   */
  bind(...vectors) {
    if (vectors.length === 0) throw new Error('No vectors to bind');

    let result = vectors[0];
    for (let i = 1; i < vectors.length; i++) {
      result = bind(result, vectors[i]);
    }
    return result;
  }

  /**
   * Bundle multiple vectors
   */
  bundle(...vectors) {
    return bundle(...vectors);
  }

  /**
   * Permute vector
   */
  permute(vec, shifts = 1) {
    return permute(vec, shifts);
  }

  /**
   * Unpermute vector
   */
  unPermute(vec, shifts = 1) {
    return unPermute(vec, shifts);
  }

  /**
   * Compute CSL-gated similarity
   */
  similarity(vecA, vecB, threshold = null) {
    threshold = threshold !== null ? threshold : this.cslThreshold;
    return cslGatedSimilarity(vecA, vecB, threshold);
  }

  /**
   * Encode a sequence with positional information
   */
  encodeSequence(items) {
    const encoded = items.map((item, idx) => {
      const itemVec = typeof item === 'string' ? this.atom(item) : item;
      return permute(itemVec, idx);
    });
    return bundle(...encoded);
  }

  /**
   * Clean up noisy vector (find closest atom)
   */
  cleanup(vec, threshold = null) {
    threshold = threshold !== null ? threshold : this.cslThreshold;

    let bestMatch = null;
    let bestSim = threshold;

    for (const [name, atom] of this.atoms) {
      const sim = cosineSimilarity(vec, atom);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = { name, similarity: sim };
      }
    }

    return bestMatch;
  }

  /**
   * Get all registered atoms
   */
  getAtoms() {
    return Array.from(this.atoms.keys());
  }

  /**
   * Clear all atoms
   */
  clearAtoms() {
    this.atoms.clear();
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  VSAEngine,
  bind,
  bundle,
  permute,
  unPermute,
  cosineSimilarity,
  cslGatedSimilarity,
  randomHypervector,
  normalize,
  VSA_DIM,
  CSL_THRESHOLDS,
  PHI,
  PSI
};
