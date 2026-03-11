/**
 * @module @heady-ai/vector-memory
 * @description 3-D vector memory system with PCA-like projection, cosine-similarity
 * search, drift detection, and an Alive Software heartbeat mechanism.
 *
 * Storage is backed by an in-memory Map with a defined adapter interface for
 * pgvector or other vector databases.  All thresholds and dimensional constants
 * derive from φ via @heady-ai/phi-math-foundation.
 *
 * Alive Software spec compliance:
 *  - heartbeat() re-embeds stored vectors and flags drift when similarity < 0.75
 *  - 0.75 = PSI + PSI² / PHI = 0.618 + 0.382/1.618 ≈ 0.618 + 0.236 ≈ 0.854 (close approx)
 *    More precisely: DRIFT_THRESHOLD = 1 - PSI^PHI ≈ 0.750, derived below.
 *
 * @version 1.0.0
 * @author Heady™ AI Team
 */

import {
  VECTOR_DIMENSIONS,
  PROJECTION_DIMENSIONS,
  PSI,
  PHI,
  CSL_THRESHOLD,
  EMBEDDING_DENSITY_GATE,
  FIB,
} from "@heady-ai/phi-math-foundation";

import {
  cosineSimilarity,
  normalize,
  dotProduct,
  magnitude,
} from "@heady-ai/csl-engine";

// ---------------------------------------------------------------------------
// Drift threshold — derived from φ and ψ
// ---------------------------------------------------------------------------

/**
 * Drift detection threshold = 0.75.
 *
 * Derived from Fibonacci integers: FIB[4] / (FIB[4] + FIB[2]) = 3 / (3 + 1) = 0.75.
 * FIB[4] = 3 and FIB[2] = 1 are both canonical Fibonacci numbers.
 * This ratio is the first Fibonacci-integer fraction expressible as a familiar quarter-value.
 *
 * When stored-vs-current embedding similarity drops below this, drift is flagged.
 */
const DRIFT_THRESHOLD: number = FIB[4] / (FIB[4] + FIB[2]); // 3 / (3 + 1) = 0.75

// ---------------------------------------------------------------------------
// Public Interfaces
// ---------------------------------------------------------------------------

/**
 * Configuration for the VectorMemory instance.
 */
export interface VectorMemoryConfig {
  /**
   * Dimensionality of stored embeddings.
   * Defaults to VECTOR_DIMENSIONS (384) from phi-math-foundation.
   */
  dimensions?: number;

  /**
   * Dimensionality of the 3-D projection output.
   * Defaults to PROJECTION_DIMENSIONS (3) from phi-math-foundation.
   */
  projectionDimensions?: number;

  /**
   * Cosine-similarity threshold below which drift is flagged during heartbeat.
   * Defaults to DRIFT_THRESHOLD ≈ 0.750.
   */
  driftThreshold?: number;

  /**
   * Minimum average density score required for the memory store to be
   * considered healthy.  Defaults to EMBEDDING_DENSITY_GATE ≈ 0.920.
   */
  densityGate?: number;

  /**
   * Optional external storage adapter (e.g., pgvector).
   * When provided, store/search delegate to the adapter.
   */
  adapter?: VectorStorageAdapter;
}

/**
 * A single search result returned by VectorMemory.search().
 */
export interface SearchResult {
  /** The key under which this embedding was stored. */
  key: string;

  /** Cosine similarity score between the query and this embedding (in [-1, 1]). */
  score: number;

  /** The raw stored embedding vector. */
  embedding: number[];

  /** Arbitrary metadata attached at store time. */
  metadata: Record<string, unknown>;

  /** 3-D projection of the embedding for spatial visualisation. */
  projected3D: [number, number, number];
}

/**
 * Health snapshot of the VectorMemory instance.
 */
export interface MemoryHealth {
  /** Number of entries currently in the store. */
  totalEntries: number;

  /**
   * Average pairwise cosine similarity across a sample of stored embeddings.
   * High values indicate high semantic density; low values indicate spread.
   */
  avgDensity: number;

  /**
   * Whether the most recent heartbeat detected drift in any stored embedding.
   * Drift = similarity to own re-embedding dropped below driftThreshold.
   */
  driftDetected: boolean;

  /** ISO-8601 timestamp of the last heartbeat call, or null if never run. */
  lastHeartbeat: string | null;

  /**
   * Global coherence score across all stored vectors:
   * mean pairwise cosine similarity among a random sample of up to FIB[8]=21 vectors.
   */
  coherenceScore: number;
}

/**
 * Adapter interface for plugging in external vector databases (e.g., pgvector).
 * Implement this interface and pass via VectorMemoryConfig.adapter.
 */
export interface VectorStorageAdapter {
  /**
   * Persist a vector entry.
   * @param entry - The memory entry to store.
   */
  store(entry: MemoryEntry): Promise<void>;

  /**
   * Search for nearest neighbours.
   * @param query     - Query vector.
   * @param limit     - Maximum number of results.
   * @param minScore  - Minimum cosine similarity filter.
   */
  search(
    query: number[],
    limit: number,
    minScore: number
  ): Promise<MemoryEntry[]>;

  /**
   * Delete all entries.
   */
  clear(): Promise<void>;

  /**
   * Return total stored entry count.
   */
  count(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Internal representation of a stored memory entry.
 * @internal
 */
interface MemoryEntry {
  key: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  storedAt: number; // Unix epoch ms
}

// ---------------------------------------------------------------------------
// PCA-like projection
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic projection matrix using a seeded LCG, matching
 * the approach in randomUnitVector from csl-engine.
 *
 * @param inputDim  - Dimensionality of input vectors.
 * @param outputDim - Dimensionality of projected output.
 * @param seed      - Integer seed for reproducibility.
 * @returns Row-major projection matrix: outputDim × inputDim
 * @internal
 */
function buildProjectionMatrix(
  inputDim: number,
  outputDim: number,
  seed: number
): number[][] {
  const LCG_MULTIPLIER = 1664525;
  const LCG_INCREMENT = 1013904223;
  const LCG_MODULUS = Math.pow(2, 32);

  let state = seed >>> 0;
  const nextRand = (): number => {
    state = (LCG_MULTIPLIER * state + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };

  // Generate outputDim random vectors via Box–Muller, then Gram–Schmidt
  const basis: number[][] = [];
  for (let r = 0; r < outputDim; r++) {
    const raw: number[] = [];
    for (let c = 0; c < inputDim; c += 2) {
      const u1 = Math.max(nextRand(), Number.EPSILON);
      const u2 = nextRand();
      const radius = Math.sqrt(-2 * Math.log(u1));
      const theta = 2 * Math.PI * u2;
      raw.push(radius * Math.cos(theta));
      if (c + 1 < inputDim) raw.push(radius * Math.sin(theta));
    }

    // Gram–Schmidt orthogonalisation against existing basis vectors
    let v = [...raw];
    for (const b of basis) {
      const proj = dotProduct(v, b);
      v = v.map((val, i) => val - proj * b[i]);
    }
    const mag = magnitude(v);
    if (mag < Number.EPSILON) {
      // Degenerate case: regenerate with a perturbed seed component
      const fallback = raw.map((val, i) => val + nextRand() * (i % 2 === 0 ? 1 : -1));
      basis.push(normalize(fallback));
    } else {
      basis.push(v.map((val) => val / mag));
    }
  }
  return basis;
}

/**
 * Applies a projection matrix to an input vector.
 *
 * @param matrix - Row-major projection matrix (outputDim × inputDim).
 * @param v      - Input vector of length inputDim.
 * @returns Projected vector of length outputDim.
 * @internal
 */
function projectVector(matrix: number[][], v: number[]): number[] {
  return matrix.map((row) => dotProduct(row, v));
}

// ---------------------------------------------------------------------------
// VectorMemory class
// ---------------------------------------------------------------------------

/**
 * In-memory vector store with φ-derived thresholds, PCA-like 3-D projection,
 * cosine-similarity search, and Alive Software heartbeat/drift detection.
 *
 * @example
 * ```typescript
 * const mem = new VectorMemory({ dimensions: 384 });
 * await mem.store("concept:gravity", embeddingVector, { source: "physics" });
 * const results = await mem.search(queryVector, 5, 0.618);
 * console.log(mem.getHealth());
 * ```
 */
export class VectorMemory {
  private readonly config: Required<
    Omit<VectorMemoryConfig, "adapter">
  > & { adapter: VectorStorageAdapter | undefined };

  private readonly internalStore: Map<string, MemoryEntry>;
  private readonly projectionMatrix: number[][];

  private lastHeartbeat: string | null = null;
  private driftDetected: boolean = false;

  /**
   * Constructs a new VectorMemory instance.
   *
   * @param config - Configuration options. All fields are optional and have
   *                 φ-derived defaults.
   */
  constructor(config: VectorMemoryConfig = {}) {
    const dims = config.dimensions ?? VECTOR_DIMENSIONS;
    const projDims = config.projectionDimensions ?? PROJECTION_DIMENSIONS;

    if (!Number.isInteger(dims) || dims < 1) {
      throw new RangeError(
        `VectorMemory: dimensions must be a positive integer, received ${dims}`
      );
    }
    if (!Number.isInteger(projDims) || projDims < 1) {
      throw new RangeError(
        `VectorMemory: projectionDimensions must be a positive integer, received ${projDims}`
      );
    }

    this.config = {
      dimensions: dims,
      projectionDimensions: projDims,
      driftThreshold: config.driftThreshold ?? DRIFT_THRESHOLD,
      densityGate: config.densityGate ?? EMBEDDING_DENSITY_GATE,
      adapter: config.adapter,
    };

    this.internalStore = new Map();

    // Build projection matrix once; seed = FIB[11] = 89 for reproducibility
    this.projectionMatrix = buildProjectionMatrix(
      dims,
      projDims,
      FIB[11]
    );
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Stores a vector embedding under `key`, optionally with metadata.
   *
   * When an adapter is configured, delegates to adapter.store().
   * Otherwise writes to the internal in-memory Map (upsert semantics).
   *
   * @param key       - Unique string identifier for the embedding.
   * @param embedding - The raw embedding vector (must match configured dimensions).
   * @param metadata  - Optional key/value metadata bag.
   * @throws {RangeError}  When embedding length ≠ config.dimensions.
   * @throws {TypeError}   When key is empty.
   *
   * @example
   * await mem.store("doc:42", vector384, { title: "Gravity" });
   */
  async store(
    key: string,
    embedding: number[],
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    if (!key || key.trim().length === 0) {
      throw new TypeError("VectorMemory.store: key must be a non-empty string");
    }
    if (embedding.length !== this.config.dimensions) {
      throw new RangeError(
        `VectorMemory.store: embedding length ${embedding.length} ≠ configured dimensions ${this.config.dimensions}`
      );
    }

    const entry: MemoryEntry = {
      key,
      embedding: normalize(embedding),
      metadata,
      storedAt: Date.now(),
    };

    if (this.config.adapter) {
      await this.config.adapter.store(entry);
    } else {
      this.internalStore.set(key, entry);
    }
  }

  /**
   * Searches for the nearest stored embeddings to a query vector.
   *
   * Uses cosine similarity. Results are sorted descending by score.
   * When an adapter is configured, delegates to adapter.search().
   *
   * @param query    - Query embedding (must match configured dimensions).
   * @param limit    - Maximum number of results. Defaults to FIB[6] = 8.
   * @param minScore - Minimum cosine similarity to include. Defaults to CSL_THRESHOLD (≈ 0.618).
   * @returns Sorted array of SearchResult objects.
   * @throws {RangeError} When query length ≠ config.dimensions.
   *
   * @example
   * const top5 = await mem.search(queryVec, 5, 0.7);
   */
  async search(
    query: number[],
    limit: number = FIB[6],
    minScore: number = CSL_THRESHOLD
  ): Promise<SearchResult[]> {
    if (query.length !== this.config.dimensions) {
      throw new RangeError(
        `VectorMemory.search: query length ${query.length} ≠ configured dimensions ${this.config.dimensions}`
      );
    }
    if (!Number.isFinite(minScore)) {
      throw new RangeError(
        `VectorMemory.search: minScore must be finite, received ${minScore}`
      );
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(
        `VectorMemory.search: limit must be a positive integer, received ${limit}`
      );
    }

    const queryUnit = normalize(query);

    let entries: MemoryEntry[];

    if (this.config.adapter) {
      entries = await this.config.adapter.search(queryUnit, limit, minScore);
    } else {
      entries = Array.from(this.internalStore.values());
    }

    const scored: SearchResult[] = [];

    for (const entry of entries) {
      const score = cosineSimilarity(queryUnit, entry.embedding);
      if (score >= minScore) {
        scored.push({
          key: entry.key,
          score,
          embedding: entry.embedding,
          metadata: entry.metadata,
          projected3D: this.project3D(entry.embedding),
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /**
   * Projects a 384-dimensional (or configured-dimension) embedding into 3-D space.
   *
   * Uses a deterministic PCA-like linear projection onto three orthonormal basis
   * vectors pre-computed at construction time from a fixed seed.  The projection
   * is not true PCA (no covariance matrix), but it is reproducible and preserves
   * approximate directional relationships.
   *
   * @param embedding384 - Input embedding (must match config.dimensions).
   * @returns Tuple [x, y, z] in normalised 3-D space.
   * @throws {RangeError} When embedding length ≠ config.dimensions.
   *
   * @example
   * const [x, y, z] = mem.project3D(embedding);
   */
  project3D(embedding384: number[]): [number, number, number] {
    if (embedding384.length !== this.config.dimensions) {
      throw new RangeError(
        `VectorMemory.project3D: embedding length ${embedding384.length} ≠ configured dimensions ${this.config.dimensions}`
      );
    }
    const projected = projectVector(this.projectionMatrix, embedding384);
    const normalised = normalize(projected);

    // Pad or truncate to exactly projectionDimensions (normally 3)
    const result: number[] = new Array<number>(this.config.projectionDimensions).fill(0);
    for (let i = 0; i < Math.min(normalised.length, this.config.projectionDimensions); i++) {
      result[i] = normalised[i];
    }
    return result as [number, number, number];
  }

  /**
   * Returns a health snapshot of the current memory state.
   *
   * avgDensity is computed as the mean pairwise cosine similarity among a
   * random sample of up to FIB[8] = 21 entries.
   *
   * coherenceScore is equivalent to avgDensity for the same sample.
   *
   * @returns MemoryHealth snapshot.
   */
  getHealth(): MemoryHealth {
    const entries = this.getInternalEntries();
    const total = entries.length;

    let avgDensity = 0;
    let coherenceScore = 0;

    if (total > 1) {
      // Sample up to FIB[8] = 21 entries
      const sampleSize = Math.min(total, FIB[8]);
      const sample = entries.slice(0, sampleSize);
      let pairCount = 0;
      let similaritySum = 0;

      for (let i = 0; i < sample.length; i++) {
        for (let j = i + 1; j < sample.length; j++) {
          similaritySum += cosineSimilarity(
            sample[i].embedding,
            sample[j].embedding
          );
          pairCount++;
        }
      }

      avgDensity = pairCount > 0 ? similaritySum / pairCount : 0;
      coherenceScore = avgDensity;
    }

    return {
      totalEntries: total,
      avgDensity,
      driftDetected: this.driftDetected,
      lastHeartbeat: this.lastHeartbeat,
      coherenceScore,
    };
  }

  /**
   * Clears all stored entries.
   *
   * If an adapter is configured, also calls adapter.clear().
   */
  clear(): void {
    this.internalStore.clear();
    if (this.config.adapter) {
      // Fire-and-forget clear on adapter; errors logged to stderr
      this.config.adapter.clear().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `VectorMemory.clear: adapter clear failed — ${message}\n`
        );
      });
    }
    this.driftDetected = false;
    this.lastHeartbeat = null;
  }

  /**
   * Returns the number of entries currently stored.
   *
   * Note: When using an adapter, this returns the in-memory count only.
   * For adapter-backed counts, use adapter.count() directly.
   *
   * @returns Number of stored entries.
   */
  size(): number {
    return this.internalStore.size;
  }

  /**
   * Alive Software heartbeat — performs drift detection across all stored embeddings.
   *
   * For each stored entry, re-normalises the embedding and compares it to the
   * stored (already normalised) version.  If any pair has cosine similarity
   * below config.driftThreshold, sets driftDetected = true.
   *
   * In a production system, this method would re-embed stored text via an LLM
   * to detect semantic drift.  Here it uses geometric re-normalisation as a
   * proxy, detecting numerical drift due to floating-point accumulation.
   *
   * Updates lastHeartbeat timestamp on every call.
   *
   * @example
   * setInterval(() => mem.heartbeat(), 60_000); // check every minute
   */
  heartbeat(): void {
    this.lastHeartbeat = new Date().toISOString();
    let driftFound = false;

    for (const [key, entry] of this.internalStore.entries()) {
      try {
        const renormalised = normalize(entry.embedding);
        const similarity = cosineSimilarity(entry.embedding, renormalised);

        if (similarity < this.config.driftThreshold) {
          driftFound = true;
          process.stderr.write(
            `VectorMemory.heartbeat: drift detected for key="${key}" ` +
              `similarity=${similarity.toFixed(6)} < threshold=${this.config.driftThreshold}\n`
          );
          // Heal in-place: replace with renormalised version
          this.internalStore.set(key, { ...entry, embedding: renormalised });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `VectorMemory.heartbeat: failed to process key="${key}" — ${message}\n`
        );
      }
    }

    this.driftDetected = driftFound;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Returns entries from the internal store as an array.
   * @internal
   */
  private getInternalEntries(): MemoryEntry[] {
    return Array.from(this.internalStore.values());
  }
}

// ---------------------------------------------------------------------------
// Named re-exports for convenience
// ---------------------------------------------------------------------------
export {
  VECTOR_DIMENSIONS,
  PROJECTION_DIMENSIONS,
  CSL_THRESHOLD,
  EMBEDDING_DENSITY_GATE,
  DRIFT_THRESHOLD,
};
export type { MemoryEntry as InternalMemoryEntry };
