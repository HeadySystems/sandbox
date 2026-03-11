/**
 * @fileoverview Heady™ Vector Memory — RAM-First Cosine Search Store
 *
 * In-memory vector store optimized for 384-dim embeddings with:
 *   - Cosine similarity search with phi-minimum score threshold
 *   - Semantic deduplication (VECTOR.DEDUP ≈ 0.972)
 *   - LRU eviction with phi-weighted composite scoring:
 *       score = importance × 0.486 + recency × 0.300 + relevance × 0.214
 *   - Max entries: fib(20) = 6,765
 *
 * All constants imported from phi-math — zero magic numbers.
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  fib,
  PSI,
  PHI,
  VECTOR,
  EVICTION,
  CSL_THRESHOLDS,
  cosineSimilarity,
  normalize,
} = require('../../shared/phi-math.js');

// ─── Store constants (all phi-math) ──────────────────────────────────────────

/** Maximum entries before LRU eviction kicks in: fib(20) = 6,765 */
const MAX_ENTRIES = fib(20);

/** Embedding dimension: VECTOR.DIMS = 384 */
const VECTOR_DIMS = VECTOR.DIMS;

/** Deduplication threshold: VECTOR.DEDUP ≈ 0.972 */
const DEDUP_THRESHOLD = VECTOR.DEDUP;

/** Minimum search score to return: VECTOR.MIN_SCORE = PSI ≈ 0.618 */
const MIN_SEARCH_SCORE = VECTOR.MIN_SCORE;

/** Default topK for search: fib(5) = 5 */
const DEFAULT_TOP_K = fib(5);

/** LRU eviction batch size: fib(6) = 8 */
const EVICTION_BATCH = fib(6);

/** Eviction weights (phi-derived) */
const W_IMPORTANCE = EVICTION.IMPORTANCE;  // 0.486
const W_RECENCY    = EVICTION.RECENCY;     // 0.300
const W_RELEVANCE  = EVICTION.RELEVANCE;   // 0.214

// ─── Eviction scoring ─────────────────────────────────────────────────────────

/**
 * Compute the composite eviction retention score for an entry.
 * Higher score = keep; lower = evict first.
 *
 * @param {object} entry
 * @param {number} nowMs     - current time (ms)
 * @param {number} oldestMs  - oldest entry's lastAccess (ms), for recency normalization
 * @param {number} newestMs  - newest entry's lastAccess (ms)
 * @returns {number} score ∈ [0, 1]
 */
function evictionScore(entry, nowMs, oldestMs, newestMs) {
  const importance = Math.min(1, Math.max(0, entry.importance || PSI));

  // Recency: 1.0 = most recently accessed, 0.0 = oldest
  const timeRange = Math.max(1, newestMs - oldestMs);
  const recency   = (entry.lastAccess - oldestMs) / timeRange;

  // Relevance: normalized query-match frequency
  const relevance = Math.min(1, (entry.hitCount || 0) / (fib(7) /* 13 */));

  return W_IMPORTANCE * importance +
         W_RECENCY    * recency    +
         W_RELEVANCE  * relevance;
}

// ─── VectorMemory class ───────────────────────────────────────────────────────

/**
 * @class VectorMemory
 *
 * @example
 * const mem = new VectorMemory();
 * mem.store('doc-42', embedding, { text: 'hello world', importance: 0.9 });
 * const results = mem.search(queryEmbedding, 5, 0.75);
 */
class VectorMemory {
  /**
   * @param {object} [opts]
   * @param {number}  [opts.maxEntries]     - max store size (default fib(20)=6765)
   * @param {number}  [opts.dedupThreshold] - cosine dedup threshold (default VECTOR.DEDUP)
   * @param {number}  [opts.minScore]       - minimum search score to return (default PSI)
   * @param {number}  [opts.dims]           - vector dimension (default 384)
   */
  constructor(opts = {}) {
    this.maxEntries     = opts.maxEntries     || MAX_ENTRIES;
    this.dedupThreshold = opts.dedupThreshold || DEDUP_THRESHOLD;
    this.minScore       = opts.minScore       || MIN_SEARCH_SCORE;
    this.dims           = opts.dims           || VECTOR_DIMS;

    /** @type {Map<string, VectorEntry>} */
    this._store       = new Map();
    this._storeCount  = 0;
    this._hitCount    = 0;
    this._missCount   = 0;
    this._evictCount  = 0;
    this._dedupCount  = 0;
  }

  // ─── Store ─────────────────────────────────────────────────────────────────

  /**
   * Store a vector with associated metadata.
   * Deduplicates against existing entries above DEDUP_THRESHOLD.
   * Triggers LRU eviction if at capacity.
   *
   * @param {string}   id         - unique identifier
   * @param {number[]} vector     - raw embedding (will be normalized)
   * @param {object}   [metadata]
   * @param {number}   [metadata.importance] - retention weight (0–1, default PSI)
   * @returns {{ stored: boolean, deduped: boolean, evicted: number }}
   */
  store(id, vector, metadata = {}) {
    if (!Array.isArray(vector) || vector.length !== this.dims) {
      throw new Error(`VectorMemory.store: vector must be ${this.dims}-dim array`);
    }

    const normed = normalize(vector);
    const now    = Date.now();

    // Check for semantic duplicate
    const dup = this._findDuplicate(normed, id);
    if (dup) {
      // Merge metadata into existing entry, boost hit count
      const existing = this._store.get(dup);
      existing.hitCount++;
      existing.lastAccess = now;
      if (metadata.importance != null) {
        existing.importance = Math.max(existing.importance, metadata.importance);
      }
      this._dedupCount++;
      return { stored: false, deduped: true, evicted: 0 };
    }

    // Evict if at capacity
    let evicted = 0;
    if (this._store.size >= this.maxEntries) {
      evicted = this._evict(EVICTION_BATCH);
    }

    /** @type {VectorEntry} */
    const entry = {
      id,
      vector:     normed,
      metadata:   { ...metadata },
      importance: metadata.importance != null ? metadata.importance : PSI,
      createdAt:  now,
      lastAccess: now,
      hitCount:   0,
    };

    this._store.set(id, entry);
    this._storeCount++;

    return { stored: true, deduped: false, evicted };
  }

  /**
   * @private
   * Find an existing entry that is semantically identical (above dedupThreshold).
   * @param {number[]} normedVec
   * @param {string}   excludeId
   * @returns {string|null} matching id or null
   */
  _findDuplicate(normedVec, excludeId) {
    for (const [id, entry] of this._store) {
      if (id === excludeId) continue;
      const sim = cosineSimilarity(normedVec, entry.vector);
      if (sim >= this.dedupThreshold) return id;
    }
    return null;
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  /**
   * Cosine similarity search. Returns top-K results above minScore.
   *
   * @param {number[]} query   - query embedding (will be normalized)
   * @param {number}   [topK]  - max results (default fib(5)=5)
   * @param {number}   [minScore] - minimum cosine threshold (default VECTOR.MIN_SCORE)
   * @returns {Array<{id: string, score: number, metadata: object, vector: number[]}>}
   */
  search(query, topK = DEFAULT_TOP_K, minScore = this.minScore) {
    if (!Array.isArray(query) || query.length !== this.dims) {
      throw new Error(`VectorMemory.search: query must be ${this.dims}-dim array`);
    }

    const normedQ = normalize(query);
    const now     = Date.now();
    const results = [];

    for (const [id, entry] of this._store) {
      const score = cosineSimilarity(normedQ, entry.vector);
      if (score >= minScore) {
        results.push({ id, score, metadata: entry.metadata, vector: entry.vector });
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, topK);

    // Update access stats for returned entries
    for (const r of top) {
      const entry = this._store.get(r.id);
      if (entry) {
        entry.lastAccess = now;
        entry.hitCount++;
      }
      this._hitCount++;
    }

    if (top.length === 0) this._missCount++;

    return top;
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  /**
   * Remove an entry by id.
   * @param {string} id
   * @returns {boolean} true if deleted
   */
  delete(id) {
    return this._store.delete(id);
  }

  /**
   * Check if an id exists.
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this._store.has(id);
  }

  /**
   * Retrieve entry metadata without cosine search.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    const entry = this._store.get(id);
    if (!entry) return null;
    entry.lastAccess = Date.now();
    return { id: entry.id, metadata: entry.metadata, vector: entry.vector };
  }

  // ─── Eviction ──────────────────────────────────────────────────────────────

  /**
   * @private
   * Evict the lowest-scoring `count` entries using phi-weighted scoring.
   * @param {number} count
   * @returns {number} actual evictions performed
   */
  _evict(count) {
    if (this._store.size === 0) return 0;

    const now      = Date.now();
    const entries  = Array.from(this._store.values());
    const oldest   = Math.min(...entries.map(e => e.lastAccess));
    const newest   = Math.max(...entries.map(e => e.lastAccess));

    // Score all entries — lowest scored will be evicted
    const scored = entries.map(e => ({
      id:    e.id,
      score: evictionScore(e, now, oldest, newest),
    }));

    // Sort ascending (lowest = evict first)
    scored.sort((a, b) => a.score - b.score);

    let evicted = 0;
    for (let i = 0; i < Math.min(count, scored.length); i++) {
      this._store.delete(scored[i].id);
      evicted++;
      this._evictCount++;
    }
    return evicted;
  }

  /**
   * Force eviction of entries below a score threshold (garbage collection).
   * @param {number} [minImportance=VECTOR.MIN_SCORE]
   * @returns {number} entries removed
   */
  gc(minImportance = VECTOR.MIN_SCORE) {
    let removed = 0;
    for (const [id, entry] of this._store) {
      if ((entry.importance || 0) < minImportance) {
        this._store.delete(id);
        removed++;
        this._evictCount++;
      }
    }
    return removed;
  }

  // ─── Statistics ────────────────────────────────────────────────────────────

  /**
   * Store statistics snapshot.
   * @returns {object}
   */
  stats() {
    return {
      size:          this._store.size,
      maxEntries:    this.maxEntries,
      fillPercent:   this._store.size / this.maxEntries,
      totalStored:   this._storeCount,
      totalEvicted:  this._evictCount,
      totalDeduped:  this._dedupCount,
      searchHits:    this._hitCount,
      searchMisses:  this._missCount,
      hitRate:       (this._hitCount + this._missCount) > 0
        ? this._hitCount / (this._hitCount + this._missCount)
        : 0,
    };
  }

  /**
   * Clear all entries.
   */
  clear() {
    this._store.clear();
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  VectorMemory,
  evictionScore,
  MAX_ENTRIES,
  VECTOR_DIMS,
  DEDUP_THRESHOLD,
  MIN_SEARCH_SCORE,
  DEFAULT_TOP_K,
  EVICTION_BATCH,
  W_IMPORTANCE,
  W_RECENCY,
  W_RELEVANCE,
};
