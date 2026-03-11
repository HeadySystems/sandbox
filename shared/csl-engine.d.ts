/**
 * Compute dot product of two vectors.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {number}
 */
export function dot(a: Float64Array | number[], b: Float64Array | number[]): number;
/**
 * Compute L2 norm of a vector.
 * @param {Float64Array|number[]} v
 * @returns {number}
 */
export function norm(v: Float64Array | number[]): number;
/**
 * Normalize a vector to unit length.
 * @param {Float64Array|number[]} v
 * @returns {Float64Array}
 */
export function normalize(v: Float64Array | number[]): Float64Array;
/**
 * Add two vectors.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
export function add(a: Float64Array | number[], b: Float64Array | number[]): Float64Array;
/**
 * Subtract vector b from a.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
export function sub(a: Float64Array | number[], b: Float64Array | number[]): Float64Array;
/**
 * Scale a vector by a scalar.
 * @param {Float64Array|number[]} v
 * @param {number} s
 * @returns {Float64Array}
 */
export function scale(v: Float64Array | number[], s: number): Float64Array;
/**
 * CSL AND: Cosine similarity — measures semantic alignment.
 * τ(a,b) = cos(θ) = (a·b) / (‖a‖·‖b‖)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {number} Value in [-1, +1]
 */
export function cslAND(a: Float64Array | number[], b: Float64Array | number[]): number;
/**
 * CSL OR: Superposition — soft semantic union.
 * OR(a,b) = normalize(a + b)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array} Unit vector
 */
export function cslOR(a: Float64Array | number[], b: Float64Array | number[]): Float64Array;
/**
 * CSL NOT: Orthogonal projection — semantic negation.
 * NOT(a,b) = a - proj_b(a) = a - (a·b / ‖b‖²)·b
 * Property: NOT(a,b) · b = 0 (guaranteed orthogonality)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
export function cslNOT(a: Float64Array | number[], b: Float64Array | number[]): Float64Array;
/**
 * CSL IMPLY: Projection — component of a in direction of b.
 * IMPLY(a,b) = proj_b(a) = (a·b / ‖b‖²)·b
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
export function cslIMPLY(a: Float64Array | number[], b: Float64Array | number[]): Float64Array;
/**
 * CSL XOR: Exclusive semantic components.
 * XOR(a,b) = normalize(a+b) - mutual projection
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
export function cslXOR(a: Float64Array | number[], b: Float64Array | number[]): Float64Array;
/**
 * CSL CONSENSUS: Weighted centroid of multiple agent vectors.
 * CONSENSUS(vᵢ, wᵢ) = normalize(Σ wᵢ·vᵢ)
 * @param {Array<Float64Array|number[]>} vectors
 * @param {number[]} [weights] - If omitted, uniform weights
 * @returns {Float64Array}
 */
export function cslCONSENSUS(vectors: Array<Float64Array | number[]>, weights?: number[]): Float64Array;
/**
 * CSL GATE: Soft sigmoid gating on cosine alignment.
 * GATE(value, cos, τ, temp) = value × σ((cos - τ) / temp)
 * @param {number} value
 * @param {number} cosScore
 * @param {number} [tau=CSL_THRESHOLDS.MEDIUM]
 * @param {number} [temp=PSI³]
 * @returns {number}
 */
export function cslGATE(value: number, cosScore: number, tau?: number, temp?: number): number;
/**
 * Batch cosine similarity of a query against multiple candidates.
 * @param {Float64Array|number[]} query
 * @param {Array<Float64Array|number[]>} candidates
 * @returns {number[]} Similarity scores
 */
export function batchSimilarity(query: Float64Array | number[], candidates: Array<Float64Array | number[]>): number[];
/**
 * Top-K selection by cosine similarity.
 * @param {Float64Array|number[]} query
 * @param {Array<{id: string, vector: Float64Array|number[]}>} items
 * @param {number} k
 * @returns {Array<{id: string, score: number}>}
 */
export function topK(query: Float64Array | number[], items: Array<{
    id: string;
    vector: Float64Array | number[];
}>, k: number): Array<{
    id: string;
    score: number;
}>;
/**
 * HDC BIND: Element-wise multiplication (real HRR style).
 * Creates compositional representation (role-filler binding).
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
export function hdcBIND(a: Float64Array | number[], b: Float64Array | number[]): Float64Array;
/**
 * HDC BUNDLE: Aggregate multiple vectors (majority/superposition).
 * @param {Array<Float64Array|number[]>} vectors
 * @returns {Float64Array}
 */
export function hdcBUNDLE(vectors: Array<Float64Array | number[]>): Float64Array;
/**
 * HDC PERMUTE: Cyclic shift for sequence encoding.
 * @param {Float64Array|number[]} v
 * @param {number} [n=1] - Number of positions to shift
 * @returns {Float64Array}
 */
export function hdcPERMUTE(v: Float64Array | number[], n?: number): Float64Array;
/**
 * Cosine-similarity Mixture-of-Experts router.
 * Routes input to top-K experts using CSL scoring instead of learned weights.
 *
 * @param {Float64Array|number[]} input - Input embedding
 * @param {Array<{id: string, gate: Float64Array|number[]}>} experts
 * @param {object} [opts]
 * @param {number} [opts.k=2] - Top-K experts to select
 * @param {number} [opts.temperature] - Softmax temperature (default ψ³)
 * @param {number} [opts.antiCollapse] - Anti-collapse regularization (default ψ⁸)
 * @returns {Array<{id: string, weight: number}>}
 */
export function moeRoute(input: Float64Array | number[], experts: Array<{
    id: string;
    gate: Float64Array | number[];
}>, opts?: {
    k?: number | undefined;
    temperature?: number | undefined;
    antiCollapse?: number | undefined;
}): Array<{
    id: string;
    weight: number;
}>;
/**
 * Map cosine similarity to ternary truth value.
 * +1 ≈ TRUE, 0 ≈ UNKNOWN, -1 ≈ FALSE
 * @param {number} cosScore
 * @param {number} [threshold=CSL_THRESHOLDS.MINIMUM]
 * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
 */
export function ternary(cosScore: number, threshold?: number): "TRUE" | "UNKNOWN" | "FALSE";
/**
 * Ternary truth value as continuous number.
 * Maps cos ∈ [-1,1] to truth ∈ [0,1] via (cos + 1) / 2.
 * @param {number} cosScore
 * @returns {number}
 */
export function truthValue(cosScore: number): number;
//# sourceMappingURL=csl-engine.d.ts.map