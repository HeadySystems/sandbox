/**
 * ∞ Heady™ Vector Memory — RAM-First 384D Sovereign Memory Brain
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * @module vector-memory
 * @description The central memory brain of Heady™. All memories are 384D
 *   Float32Array vectors held in RAM, organised into Fibonacci shards,
 *   and scored by an importance function I(m) = recency * frequency * relevance.
 *   Short-term memories (STM) with high importance are promoted to long-term
 *   (LTM) by the MemoryConsolidator. Relationships between memories are
 *   tracked in an in-memory graph. Events are emitted on every mutation.
 */

'use strict';

const { EventEmitter } = require('events');
const {
  cosineSimilarity,
  fibonacciShardIndex,
  isValidVector,
  toArray,
  fromArray,
  DIMS,
} = require('./vector-space-ops');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of Fibonacci shards across which memories are distributed. */
const DEFAULT_NUM_SHARDS = 8;

/** Default number of shards that replicate a memory for redundancy. */
const DEFAULT_REPLICATION = 1;

/** Default TTL for short-term memories (ms). */
const STM_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Importance threshold above which STM is promoted to LTM. */
const LTM_IMPORTANCE_THRESHOLD = 0.6;

/** Maximum entries in STM before LRU eviction triggers. */
const STM_MAX_SIZE = 1000;

// ---------------------------------------------------------------------------
// Helper: compute importance score I(m) = recency * frequency * relevance
// ---------------------------------------------------------------------------

/**
 * Compute normalised importance score for a memory entry.
 *
 * @param {MemoryEntry} entry - Memory entry to score.
 * @param {number} now - Current timestamp (ms).
 * @param {number} maxFrequency - Maximum frequency across all entries (normaliser).
 * @param {Float32Array|null} queryVector - Optional query for relevance component.
 * @returns {number} Importance in [0, 1].
 */
function computeImportance(entry, now, maxFrequency = 1, queryVector = null) {
  const ageSec = (now - entry.lastAccessed) / 1000;
  // Exponential recency decay with half-life of 1 hour.
  const recency = Math.exp(-ageSec / 3600);
  // Frequency component normalised by max frequency.
  const frequency = maxFrequency > 0 ? entry.accessCount / maxFrequency : 0;
  // Relevance: cosine similarity to query, or 1.0 if no query provided.
  const relevance = queryVector
    ? Math.max(0, cosineSimilarity(entry.vector, queryVector))
    : (entry.metadata.relevance !== undefined ? entry.metadata.relevance : 1.0);
  return recency * frequency * relevance;
}

// ---------------------------------------------------------------------------
// MemoryEntry
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MemoryEntry
 * @property {string} key - Unique identifier.
 * @property {Float32Array} vector - 384D embedding vector.
 * @property {Object} metadata - Arbitrary metadata payload.
 * @property {'stm'|'ltm'} tier - Memory tier.
 * @property {number} createdAt - Creation timestamp (ms).
 * @property {number} lastAccessed - Last access timestamp (ms).
 * @property {number} accessCount - How many times this entry was recalled.
 * @property {number} ttl - Time-to-live in ms (0 = immortal for LTM).
 * @property {number} shardIndex - Assigned Fibonacci shard.
 * @property {number} importance - Cached importance score.
 */

// ---------------------------------------------------------------------------
// VectorMemory
// ---------------------------------------------------------------------------

/**
 * VectorMemory is the RAM-first sovereign memory brain for the Heady™ platform.
 *
 * Architecture:
 * - **Shards**: memories are distributed across `numShards` Map instances,
 *   indexed by Fibonacci golden-ratio projection.
 * - **STM / LTM tiers**: newly stored entries go to STM. The consolidator
 *   promotes high-importance STM entries to LTM asynchronously.
 * - **Graph layer**: memories can be linked with typed relationships and
 *   traversed at configurable depth.
 *
 * @extends EventEmitter
 *
 * @fires VectorMemory#store
 * @fires VectorMemory#recall
 * @fires VectorMemory#forget
 * @fires VectorMemory#consolidate
 * @fires VectorMemory#evict
 */
class VectorMemory extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.numShards=8] - Number of Fibonacci shards.
   * @param {number} [options.replication=1] - Shard replication factor.
   * @param {number} [options.stmTtlMs=300000] - STM TTL in milliseconds.
   * @param {number} [options.stmMaxSize=1000] - Maximum STM entries.
   * @param {number} [options.ltmImportanceThreshold=0.6] - Promotion threshold.
   * @param {string} [options.instanceId='vm-0'] - Unique instance identifier.
   */
  constructor(options = {}) {
    super();
    this.instanceId = options.instanceId || 'vm-0';
    this.numShards = options.numShards || DEFAULT_NUM_SHARDS;
    this.replication = options.replication || DEFAULT_REPLICATION;
    this.stmTtlMs = options.stmTtlMs || STM_TTL_MS;
    this.stmMaxSize = options.stmMaxSize || STM_MAX_SIZE;
    this.ltmImportanceThreshold = options.ltmImportanceThreshold || LTM_IMPORTANCE_THRESHOLD;

    // Primary storage: shardIndex → Map<key, MemoryEntry>
    /** @type {Map<string, MemoryEntry>[]} */
    this.shards = Array.from({ length: this.numShards }, () => new Map());

    // Global key → shardIndex reverse index for O(1) lookup.
    /** @type {Map<string, number>} */
    this.keyIndex = new Map();

    // Graph adjacency: key → Set<{ target, relation, weight, createdAt }>
    /** @type {Map<string, Set<Object>>} */
    this.graph = new Map();

    // Per-node reverse index for incoming edges.
    /** @type {Map<string, Set<string>>} */
    this.reverseGraph = new Map();

    this._stats = {
      totalStores: 0,
      totalRecalls: 0,
      totalForgets: 0,
      totalConsolidations: 0,
      stmPromotions: 0,
      evictions: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Core CRUD
  // -------------------------------------------------------------------------

  /**
   * Store a memory entry. New entries start as STM.
   * If a key already exists the vector and metadata are updated in-place
   * and access statistics are refreshed.
   *
   * @param {string} key - Unique memory key.
   * @param {Float32Array} vector - 384D embedding vector.
   * @param {Object} [metadata={}] - Arbitrary metadata.
   * @param {'stm'|'ltm'} [tier='stm'] - Memory tier override.
   * @returns {MemoryEntry} The stored entry.
   *
   * @fires VectorMemory#store
   */
  store(key, vector, metadata = {}, tier = 'stm') {
    if (!isValidVector(vector, DIMS)) {
      throw new TypeError(`store: vector must be Float32Array of length ${DIMS}`);
    }
    const now = Date.now();
    const shardIndex = fibonacciShardIndex(vector, this.numShards);
    const shard = this.shards[shardIndex];

    let entry;
    if (shard.has(key)) {
      // Update existing entry.
      entry = shard.get(key);
      entry.vector = vector;
      entry.metadata = { ...entry.metadata, ...metadata };
      entry.lastAccessed = now;
      entry.accessCount += 1;
      entry.importance = computeImportance(entry, now, this._maxFrequency());
    } else {
      // Check STM capacity and evict LRU if necessary.
      if (tier === 'stm') {
        this._enforceStmCapacity();
      }
      entry = {
        key,
        vector,
        metadata: { ...metadata },
        tier,
        createdAt: now,
        lastAccessed: now,
        accessCount: 1,
        ttl: tier === 'stm' ? this.stmTtlMs : 0,
        shardIndex,
        importance: 0,
      };
      entry.importance = computeImportance(entry, now, this._maxFrequency());
      shard.set(key, entry);
      this.keyIndex.set(key, shardIndex);
    }

    this._stats.totalStores += 1;

    /**
     * @event VectorMemory#store
     * @type {Object}
     * @property {string} key
     * @property {number} shardIndex
     * @property {'stm'|'ltm'} tier
     * @property {number} timestamp
     */
    this.emit('store', { key, shardIndex, tier: entry.tier, timestamp: now });
    return entry;
  }

  /**
   * Recall the top-K most similar memories to a query vector.
   * Scans all shards (linear scan; replace with HNSW for large collections).
   *
   * @param {Float32Array} queryVector - 384D query embedding.
   * @param {number} [k=10] - Number of results to return.
   * @param {Object} [options={}]
   * @param {'stm'|'ltm'|'all'} [options.tier='all'] - Filter by tier.
   * @param {number} [options.minSimilarity=0] - Minimum cosine similarity cutoff.
   * @returns {Array<{ entry: MemoryEntry, similarity: number }>} Ranked results.
   *
   * @fires VectorMemory#recall
   */
  recall(queryVector, k = 10, options = {}) {
    if (!isValidVector(queryVector, DIMS)) {
      throw new TypeError(`recall: queryVector must be Float32Array of length ${DIMS}`);
    }
    const { tier = 'all', minSimilarity = 0 } = options;
    const now = Date.now();
    const results = [];

    for (const shard of this.shards) {
      for (const [, entry] of shard) {
        // Tier filter.
        if (tier !== 'all' && entry.tier !== tier) continue;
        // TTL expiry check.
        if (entry.tier === 'stm' && entry.ttl > 0) {
          if (now - entry.createdAt > entry.ttl) continue;
        }
        const similarity = cosineSimilarity(queryVector, entry.vector);
        if (similarity >= minSimilarity) {
          results.push({ entry, similarity });
        }
      }
    }

    // Sort descending by similarity.
    results.sort((a, b) => b.similarity - a.similarity);
    const topK = results.slice(0, k);

    // Update access stats for recalled entries.
    const maxFreq = this._maxFrequency();
    for (const { entry } of topK) {
      entry.lastAccessed = now;
      entry.accessCount += 1;
      entry.importance = computeImportance(entry, now, maxFreq, queryVector);
    }

    this._stats.totalRecalls += 1;

    /**
     * @event VectorMemory#recall
     * @type {Object}
     * @property {Float32Array} queryVector
     * @property {number} k
     * @property {number} resultsCount
     * @property {number} timestamp
     */
    this.emit('recall', { queryVector, k, resultsCount: topK.length, timestamp: now });
    return topK;
  }

  /**
   * Remove a memory entry by key.
   *
   * @param {string} key - Key to delete.
   * @returns {boolean} True if the key existed and was removed.
   *
   * @fires VectorMemory#forget
   */
  forget(key) {
    const shardIndex = this.keyIndex.get(key);
    if (shardIndex === undefined) return false;

    this.shards[shardIndex].delete(key);
    this.keyIndex.delete(key);

    // Remove from graph.
    this.graph.delete(key);
    this.reverseGraph.delete(key);
    // Clean dangling edges.
    for (const [, edges] of this.graph) {
      for (const edge of edges) {
        if (edge.target === key) edges.delete(edge);
      }
    }

    this._stats.totalForgets += 1;

    /**
     * @event VectorMemory#forget
     * @type {Object}
     * @property {string} key
     * @property {number} shardIndex
     * @property {number} timestamp
     */
    this.emit('forget', { key, shardIndex, timestamp: Date.now() });
    return true;
  }

  /**
   * Retrieve a single memory entry by exact key.
   *
   * @param {string} key - Memory key.
   * @returns {MemoryEntry|null} Entry or null if not found.
   */
  get(key) {
    const shardIndex = this.keyIndex.get(key);
    if (shardIndex === undefined) return null;
    return this.shards[shardIndex].get(key) || null;
  }

  /**
   * Check whether a key exists in memory.
   *
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.keyIndex.has(key);
  }

  // -------------------------------------------------------------------------
  // Consolidation
  // -------------------------------------------------------------------------

  /**
   * Run STM→LTM consolidation pass. High-importance STM entries are promoted
   * to LTM; expired STM entries are pruned.
   *
   * @returns {{ promoted: number, pruned: number, remaining: number }} Stats.
   *
   * @fires VectorMemory#consolidate
   */
  consolidate() {
    const now = Date.now();
    const maxFreq = this._maxFrequency();
    let promoted = 0;
    let pruned = 0;

    for (const shard of this.shards) {
      for (const [key, entry] of shard) {
        if (entry.tier !== 'stm') continue;
        // Prune expired STM.
        if (entry.ttl > 0 && now - entry.createdAt > entry.ttl) {
          shard.delete(key);
          this.keyIndex.delete(key);
          pruned += 1;
          continue;
        }
        // Score and promote.
        entry.importance = computeImportance(entry, now, maxFreq);
        if (entry.importance >= this.ltmImportanceThreshold) {
          entry.tier = 'ltm';
          entry.ttl = 0; // LTM lives forever.
          promoted += 1;
          this._stats.stmPromotions += 1;
        }
      }
    }

    this._stats.totalConsolidations += 1;
    const remaining = this.keyIndex.size;

    /**
     * @event VectorMemory#consolidate
     * @type {Object}
     * @property {number} promoted
     * @property {number} pruned
     * @property {number} remaining
     * @property {number} timestamp
     */
    this.emit('consolidate', { promoted, pruned, remaining, timestamp: now });
    return { promoted, pruned, remaining };
  }

  // -------------------------------------------------------------------------
  // Graph Relationships
  // -------------------------------------------------------------------------

  /**
   * Create a directed relationship from keyA to keyB.
   *
   * @param {string} keyA - Source memory key.
   * @param {string} keyB - Target memory key.
   * @param {string} [relation='related'] - Relationship label.
   * @param {number} [weight=1.0] - Edge weight.
   * @returns {boolean} True if both keys exist and the edge was created.
   */
  link(keyA, keyB, relation = 'related', weight = 1.0) {
    if (!this.has(keyA) || !this.has(keyB)) return false;

    if (!this.graph.has(keyA)) this.graph.set(keyA, new Set());
    if (!this.reverseGraph.has(keyB)) this.reverseGraph.set(keyB, new Set());

    this.graph.get(keyA).add({ target: keyB, relation, weight, createdAt: Date.now() });
    this.reverseGraph.get(keyB).add(keyA);
    return true;
  }

  /**
   * BFS traversal from a memory key, returning all related keys up to `depth`.
   *
   * @param {string} key - Starting memory key.
   * @param {number} [depth=2] - Maximum traversal depth.
   * @param {string|null} [relation=null] - Optional relation filter (null = all).
   * @returns {Array<{ key: string, relation: string, depth: number, entry: MemoryEntry|null }>}
   */
  getRelated(key, depth = 2, relation = null) {
    const visited = new Set([key]);
    const result = [];
    /** @type {Array<{ key: string, currentDepth: number }>} */
    const queue = [{ key, currentDepth: 0 }];

    while (queue.length > 0) {
      const { key: current, currentDepth } = queue.shift();
      if (currentDepth >= depth) continue;

      const edges = this.graph.get(current);
      if (!edges) continue;

      for (const edge of edges) {
        if (relation !== null && edge.relation !== relation) continue;
        if (visited.has(edge.target)) continue;
        visited.add(edge.target);
        result.push({
          key: edge.target,
          relation: edge.relation,
          weight: edge.weight,
          depth: currentDepth + 1,
          entry: this.get(edge.target),
        });
        queue.push({ key: edge.target, currentDepth: currentDepth + 1 });
      }
    }

    return result;
  }

  /**
   * Remove a directed edge between two keys.
   *
   * @param {string} keyA - Source key.
   * @param {string} keyB - Target key.
   * @param {string|null} [relation=null] - Relation to remove (null = all).
   * @returns {number} Number of edges removed.
   */
  unlink(keyA, keyB, relation = null) {
    const edges = this.graph.get(keyA);
    if (!edges) return 0;
    let removed = 0;
    for (const edge of [...edges]) {
      if (edge.target === keyB && (relation === null || edge.relation === relation)) {
        edges.delete(edge);
        removed += 1;
      }
    }
    if (this.reverseGraph.has(keyB)) {
      this.reverseGraph.get(keyB).delete(keyA);
    }
    return removed;
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /**
   * Return memory statistics.
   *
   * @returns {Object} Statistics snapshot.
   */
  stats() {
    const now = Date.now();
    let stmCount = 0;
    let ltmCount = 0;
    let expiredStm = 0;
    let importanceSum = 0;
    const shardDistribution = new Array(this.numShards).fill(0);
    const maxFreq = this._maxFrequency();

    for (let s = 0; s < this.numShards; s++) {
      const shard = this.shards[s];
      shardDistribution[s] = shard.size;
      for (const [, entry] of shard) {
        if (entry.tier === 'stm') {
          stmCount += 1;
          if (entry.ttl > 0 && now - entry.createdAt > entry.ttl) expiredStm += 1;
        } else {
          ltmCount += 1;
        }
        const imp = computeImportance(entry, now, maxFreq);
        importanceSum += imp;
      }
    }

    const total = stmCount + ltmCount;
    return {
      instanceId: this.instanceId,
      total,
      stmCount,
      ltmCount,
      expiredStm,
      shardDistribution,
      avgImportance: total > 0 ? importanceSum / total : 0,
      graphEdges: [...this.graph.values()].reduce((n, s) => n + s.size, 0),
      ...(this._stats),
    };
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  /**
   * Serialise the entire memory store to a JSON-compatible object.
   * Vectors are converted to plain arrays for transport / persistence.
   *
   * @returns {Object} Serialised snapshot.
   */
  toJSON() {
    const entries = [];
    for (const shard of this.shards) {
      for (const [, entry] of shard) {
        entries.push({
          key: entry.key,
          vector: toArray(entry.vector),
          metadata: entry.metadata,
          tier: entry.tier,
          createdAt: entry.createdAt,
          lastAccessed: entry.lastAccessed,
          accessCount: entry.accessCount,
          ttl: entry.ttl,
          importance: entry.importance,
        });
      }
    }

    // Serialise graph.
    const graphData = {};
    for (const [k, edges] of this.graph) {
      graphData[k] = [...edges].map(e => ({
        target: e.target,
        relation: e.relation,
        weight: e.weight,
        createdAt: e.createdAt,
      }));
    }

    return {
      instanceId: this.instanceId,
      numShards: this.numShards,
      version: '4.0.0',
      exportedAt: Date.now(),
      entries,
      graph: graphData,
    };
  }

  /**
   * Restore memory from a previously serialised JSON snapshot.
   * Existing contents are cleared before loading.
   *
   * @param {Object} snapshot - Snapshot produced by toJSON().
   * @returns {number} Number of entries restored.
   */
  fromJSON(snapshot) {
    // Clear existing state.
    for (let s = 0; s < this.numShards; s++) this.shards[s].clear();
    this.keyIndex.clear();
    this.graph.clear();
    this.reverseGraph.clear();

    let count = 0;
    for (const raw of (snapshot.entries || [])) {
      const vector = fromArray(raw.vector);
      const entry = {
        key: raw.key,
        vector,
        metadata: raw.metadata || {},
        tier: raw.tier || 'stm',
        createdAt: raw.createdAt || Date.now(),
        lastAccessed: raw.lastAccessed || Date.now(),
        accessCount: raw.accessCount || 1,
        ttl: raw.ttl || 0,
        shardIndex: fibonacciShardIndex(vector, this.numShards),
        importance: raw.importance || 0,
      };
      this.shards[entry.shardIndex].set(entry.key, entry);
      this.keyIndex.set(entry.key, entry.shardIndex);
      count += 1;
    }

    // Restore graph.
    for (const [src, edges] of Object.entries(snapshot.graph || {})) {
      if (!this.graph.has(src)) this.graph.set(src, new Set());
      for (const e of edges) {
        this.graph.get(src).add({ target: e.target, relation: e.relation, weight: e.weight, createdAt: e.createdAt });
        if (!this.reverseGraph.has(e.target)) this.reverseGraph.set(e.target, new Set());
        this.reverseGraph.get(e.target).add(src);
      }
    }

    return count;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** @private */
  _maxFrequency() {
    let max = 1;
    for (const shard of this.shards) {
      for (const [, entry] of shard) {
        if (entry.accessCount > max) max = entry.accessCount;
      }
    }
    return max;
  }

  /**
   * Enforce STM capacity by evicting the least important STM entry.
   * @private
   */
  _enforceStmCapacity() {
    let stmCount = 0;
    for (const shard of this.shards) {
      for (const [, entry] of shard) {
        if (entry.tier === 'stm') stmCount += 1;
      }
    }
    if (stmCount < this.stmMaxSize) return;

    // Find least-important STM entry.
    let leastKey = null;
    let leastImp = Infinity;
    const now = Date.now();
    const maxFreq = this._maxFrequency();

    for (const shard of this.shards) {
      for (const [key, entry] of shard) {
        if (entry.tier !== 'stm') continue;
        const imp = computeImportance(entry, now, maxFreq);
        if (imp < leastImp) {
          leastImp = imp;
          leastKey = key;
        }
      }
    }

    if (leastKey) {
      this.forget(leastKey);
      this._stats.evictions += 1;
      this.emit('evict', { key: leastKey, importance: leastImp, timestamp: now });
    }
  }

  /**
   * Iterator over all entries across all shards.
   * @returns {IterableIterator<MemoryEntry>}
   */
  [Symbol.iterator]() {
    const shards = this.shards;
    let shardIdx = 0;
    let shardIter = shards[0].values();
    return {
      next() {
        while (true) {
          const { value, done } = shardIter.next();
          if (!done) return { value, done: false };
          shardIdx += 1;
          if (shardIdx >= shards.length) return { value: undefined, done: true };
          shardIter = shards[shardIdx].values();
        }
      },
      [Symbol.iterator]() { return this; },
    };
  }
}


module.exports = { VectorMemory, computeImportance, STM_TTL_MS, LTM_IMPORTANCE_THRESHOLD };
