/**
 * @fileoverview wisdom-store.js — Heady™ Sovereign Phi-100 Long-Term Wisdom Store
 * @version 3.2.3
 * @description
 *   Long-term vector memory persistence layer.  Stores learned patterns,
 *   decisions, and system wisdom: 384D embeddings with rich metadata.
 *
 *   Capacity:              fib(17) = 1597 entries
 *   Eviction trigger:      occupancy ≥ 1 − PSI⁴ ≈ 0.910
 *   Consolidation:         cosine ≥ CSL_THRESHOLDS.CRITICAL ≈ 0.927
 *   Query threshold:       PSI ≈ 0.618 (default)
 *   Default topK:          fib(6) = 8
 *   Importance decay:      importance *= PSI per fib(11) = 89-day inactivity window
 *   Eviction scoring:      importance×0.486 + recency×0.300 + relevance×0.214
 *
 * @module wisdom-store
 * @author Heady™ Core Engineering
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const phiMath = require('../../shared/phi-math.js');

const {
  PHI,
  PSI,
  FIB,
  fib,
  CSL_THRESHOLDS,
  phiFusionWeights,
  EVICTION_WEIGHTS,
  cosineSimilarity,
  cslGate,
} = phiMath;

// ─────────────────────────────────────────────────────────────────────────────
//  MODULE-LEVEL CONSTANTS  (all derived from phi-math — no magic numbers)
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum entries: F(17) = 1597. @constant {number} */
const CAPACITY = fib(17);

/** Occupancy ratio triggering auto-prune: 1 − PSI⁴ ≈ 0.910. @constant {number} */
const EVICTION_OCCUPANCY = 1 - Math.pow(PSI, 4);

/** Entries evicted per prune cycle: F(6) = 8. @constant {number} */
const PRUNE_BATCH = fib(6);

/** Default cosine query threshold: PSI ≈ 0.618. @constant {number} */
const DEFAULT_THRESHOLD = PSI;

/** Default maximum results from query(): F(6) = 8. @constant {number} */
const DEFAULT_TOP_K = fib(6);

/** Inactivity window after which importance decays: F(11) = 89 days. @constant {number} */
const DECAY_PERIOD_DAYS = fib(11);

/** Milliseconds per day. @constant {number} */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Soft-delete TTL: PHI⁶ × 1000 ms = 17 944 ms (canonical phi timeout).
 * @constant {number}
 */
const SOFT_DELETE_TTL_MS = Math.round(Math.pow(PHI, 6) * 1000);

/** Required embedding dimensionality. @constant {number} */
const EMBEDDING_DIMS = 384;

/**
 * Valid namespace identifiers.
 * @enum {string}
 */
const NAMESPACES = Object.freeze({
  PATTERNS:       'patterns',
  DECISIONS:      'decisions',
  INCIDENTS:      'incidents',
  CONFIGURATIONS: 'configurations',
  EXPERIMENTS:    'experiments',
});

/** @type {Set<string>} */
const VALID_NAMESPACES = new Set(Object.values(NAMESPACES));

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a compact time-ordered unique entry ID.
 * @returns {string}
 */
function generateEntryId() {
  const ts  = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * Math.pow(36, 6)).toString(36).padStart(6, '0');
  return `ws_${ts}_${rnd}`;
}

/**
 * Compute normalised recency score in (0, 1] using phi-harmonic exponential decay.
 * Half-life equals DECAY_PERIOD_DAYS so score = PSI after 89 days of inactivity.
 * @param {number} accessedAt - Unix ms of last access.
 * @param {number} [now=Date.now()]
 * @returns {number}
 */
function recencyScore(accessedAt, now = Date.now()) {
  const ageDays = (now - accessedAt) / MS_PER_DAY;
  const lambda  = Math.log(1 / PSI) / DECAY_PERIOD_DAYS;
  return Math.exp(-lambda * ageDays);
}

/**
 * Apply cumulative importance decay for full DECAY_PERIOD_DAYS windows of inactivity.
 * Importance *= PSI per period, floored at PSI⁴ ≈ 0.146. Mutates entry in place.
 * @param {Object} entry - WisdomEntry to decay.
 * @param {number} [now=Date.now()]
 * @returns {number} Number of decay cycles applied.
 */
function applyImportanceDecay(entry, now = Date.now()) {
  const lastCheck         = entry._lastDecayAt || entry.createdAt;
  const inactiveDays      = (now - entry.accessedAt) / MS_PER_DAY;
  const periodsSinceCheck = Math.floor((now - lastCheck) / (DECAY_PERIOD_DAYS * MS_PER_DAY));

  if (inactiveDays < DECAY_PERIOD_DAYS || periodsSinceCheck < 1) return 0;

  const cycles = Math.min(periodsSinceCheck, fib(8)); // cap at F(8) = 21
  entry.importance   = Math.max(Math.pow(PSI, 4), entry.importance * Math.pow(PSI, cycles));
  entry._lastDecayAt = now;
  return cycles;
}

/**
 * Phi-weighted element-wise average of two equal-length vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @param {number}   [wA=0.5] - Weight for a; wB = 1 − wA.
 * @returns {number[]}
 */
function averageVectors(a, b, wA = 0.5) {
  const wB = 1 - wA;
  return a.map((v, i) => v * wA + b[i] * wB);
}

/**
 * Assert that an embedding is a finite numeric array of EMBEDDING_DIMS elements.
 * @param {*} embedding
 * @throws {TypeError}
 */
function validateEmbedding(embedding) {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
    throw new TypeError(
      `WisdomStore: embedding must be a numeric array of length ${EMBEDDING_DIMS}; ` +
      `got ${Array.isArray(embedding) ? embedding.length : typeof embedding}`,
    );
  }
  for (let i = 0; i < embedding.length; i++) {
    if (typeof embedding[i] !== 'number' || !isFinite(embedding[i])) {
      throw new TypeError(`WisdomStore: embedding[${i}] is not a finite number`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  WISDOM STORE CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WisdomStore — long-term vector memory persistence for the Heady™ Phi-100 platform.
 *
 * @class
 */
class WisdomStore {
  /**
   * @param {Object}  [config={}]
   * @param {number}  [config.capacity=fib(17)]              - Max live entries.
   * @param {number}  [config.evictionOccupancy]             - Occupancy ratio triggering prune.
   * @param {number}  [config.consolidationThreshold]        - Cosine threshold for merging.
   * @param {number}  [config.defaultThreshold=PSI]          - Default query similarity floor.
   * @param {number}  [config.defaultTopK=fib(6)]            - Default query result count.
   * @param {boolean} [config.autoDecay=true]                - Apply decay on query hits.
   * @param {boolean} [config.autoPrune=true]                - Auto-prune on capacity pressure.
   */
  constructor(config = {}) {
    /** @type {Map<string, Object>} */
    this._entries = new Map();

    this.capacity               = config.capacity               || CAPACITY;
    this.evictionOccupancy      = config.evictionOccupancy      || EVICTION_OCCUPANCY;
    this.consolidationThreshold = config.consolidationThreshold || CSL_THRESHOLDS.CRITICAL;
    this.defaultThreshold       = config.defaultThreshold !== undefined ? config.defaultThreshold : DEFAULT_THRESHOLD;
    this.defaultTopK            = config.defaultTopK            || DEFAULT_TOP_K;
    this.autoDecay              = config.autoDecay  !== undefined ? config.autoDecay  : true;
    this.autoPrune              = config.autoPrune  !== undefined ? config.autoPrune  : true;

    this._totalStored         = 0;
    this._pruneCount          = 0;
    this._consolidationMerges = 0;
  }

  // ── CORE CRUD ──────────────────────────────────────────────────────────────

  /**
   * Persist a wisdom entry with a 384D embedding and metadata.
   * Auto-prunes when occupancy ≥ EVICTION_OCCUPANCY (if autoPrune=true).
   *
   * @param {Object}   entry
   * @param {string}   entry.namespace        - One of NAMESPACES.
   * @param {number[]} entry.embedding        - 384D semantic vector.
   * @param {string}   entry.content          - Human-readable content.
   * @param {Object}   [entry.metadata={}]
   * @param {number}   [entry.importance=PSI] - Initial importance in [0, 1].
   * @param {string}   [entry.id]             - Optional caller-supplied ID.
   * @returns {Object} The stored entry record.
   * @throws {TypeError}  On invalid namespace or malformed embedding.
   * @throws {RangeError} If store is at hard capacity after pruning.
   */
  store(entry) {
    if (!VALID_NAMESPACES.has(entry.namespace)) {
      throw new TypeError(
        `WisdomStore.store: invalid namespace "${entry.namespace}". ` +
        `Valid: ${[...VALID_NAMESPACES].join(', ')}`,
      );
    }
    validateEmbedding(entry.embedding);

    if (this.autoPrune && this._liveCount() / this.capacity >= this.evictionOccupancy) {
      this.prune();
    }

    if (this._liveCount() >= this.capacity) {
      throw new RangeError(
        `WisdomStore.store: at maximum capacity (${this.capacity}). Call prune() or consolidate().`,
      );
    }

    const now    = Date.now();
    const record = {
      id:           entry.id || generateEntryId(),
      namespace:    entry.namespace,
      embedding:    entry.embedding.slice(),
      content:      String(entry.content || ''),
      metadata:     Object.assign({}, entry.metadata || {}),
      importance:   typeof entry.importance === 'number' ? Math.max(0, Math.min(1, entry.importance)) : PSI,
      createdAt:    now,
      accessedAt:   now,
      accessCount:  0,
      _deleted:     false,
      _deletedAt:   null,
      _lastDecayAt: now,
    };

    this._entries.set(record.id, record);
    this._totalStored++;
    return record;
  }

  /**
   * Find the topK most similar live entries to a 384D query vector.
   * Bumps accessedAt / accessCount on every hit. Applies decay when autoDecay=true.
   *
   * @param {number[]} queryEmbedding
   * @param {number}   [topK=DEFAULT_TOP_K]
   * @param {number}   [threshold=DEFAULT_THRESHOLD]
   * @returns {Array<{entry: Object, similarity: number, gatedScore: number}>}
   */
  query(queryEmbedding, topK = this.defaultTopK, threshold = this.defaultThreshold) {
    validateEmbedding(queryEmbedding);

    const now     = Date.now();
    const results = [];

    for (const entry of this._entries.values()) {
      if (entry._deleted) continue;
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity < threshold) continue;
      const gatedScore = cslGate(similarity, similarity, threshold, PSI * PSI);
      results.push({ entry, similarity, gatedScore });
    }

    results.sort((a, b) =>
      b.similarity !== a.similarity ? b.similarity - a.similarity : b.gatedScore - a.gatedScore,
    );

    const topResults = results.slice(0, topK);
    for (const { entry: e } of topResults) {
      e.accessedAt  = now;
      e.accessCount += 1;
      if (this.autoDecay) applyImportanceDecay(e, now);
    }

    return topResults;
  }

  /**
   * Update an existing entry's metadata, embedding, content, and/or importance.
   * Merges metadata shallowly; replaces embedding entirely if provided.
   *
   * @param {string} entryId
   * @param {Object} updates - { metadata?, embedding?, content?, importance? }
   * @returns {Object} Updated entry.
   * @throws {Error}     If entry not found or soft-deleted.
   * @throws {TypeError} If new embedding is malformed.
   */
  update(entryId, updates) {
    const entry = this._entries.get(entryId);
    if (!entry || entry._deleted) {
      throw new Error(`WisdomStore.update: entry "${entryId}" not found or deleted.`);
    }

    if (updates.embedding  !== undefined) { validateEmbedding(updates.embedding); entry.embedding  = updates.embedding.slice(); }
    if (updates.metadata   !== undefined) { Object.assign(entry.metadata, updates.metadata); }
    if (updates.content    !== undefined) { entry.content    = String(updates.content); }
    if (updates.importance !== undefined) { entry.importance = Math.max(0, Math.min(1, Number(updates.importance))); }

    entry.accessedAt = Date.now();
    return entry;
  }

  /**
   * Soft-delete an entry by ID (excludes it from queries; expunged on next prune).
   *
   * @param {string} entryId
   * @returns {boolean} true if found and deleted, false if not found.
   */
  forget(entryId) {
    const entry = this._entries.get(entryId);
    if (!entry) return false;
    entry._deleted   = true;
    entry._deletedAt = Date.now();
    return true;
  }

  // ── CONSOLIDATION & PRUNING ────────────────────────────────────────────────

  /**
   * Merge near-duplicate entries with cosine ≥ CSL_THRESHOLDS.CRITICAL (0.927).
   * Greedy single-pass: surviving entry inherits importance-weighted centroid
   * embedding, max importance, sum of accessCounts, earliest createdAt.
   * Absorbed entries are hard-deleted immediately.
   *
   * @returns {{ merged: number, survivors: number }}
   */
  consolidate() {
    const now     = Date.now();
    const live    = this._getLiveEntries();
    const visited = new Set();
    let   merged  = 0;

    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      if (visited.has(a.id)) continue;

      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        if (visited.has(b.id)) continue;

        if (cosineSimilarity(a.embedding, b.embedding) < this.consolidationThreshold) continue;

        const wA       = a.importance / (a.importance + b.importance + Number.EPSILON);
        a.embedding    = averageVectors(a.embedding, b.embedding, wA);
        a.importance   = Math.max(a.importance, b.importance);
        a.accessCount += b.accessCount;
        a.createdAt    = Math.min(a.createdAt, b.createdAt);
        a.accessedAt   = Math.max(a.accessedAt, b.accessedAt);

        for (const [k, v] of Object.entries(b.metadata)) {
          if (!(k in a.metadata)) a.metadata[k] = v;
        }

        this._entries.delete(b.id);
        visited.add(b.id);
        merged++;
        this._consolidationMerges++;
      }
      a.accessedAt = now;
    }

    this._expungeSoftDeleted(now);
    return { merged, survivors: this._liveCount() };
  }

  /**
   * Evict lowest-scoring entries in batches of PRUNE_BATCH = fib(6) = 8 until
   * occupancy drops below EVICTION_OCCUPANCY.  Always expunges expired soft-deletes first.
   *
   * @returns {{ evicted: number, remaining: number }}
   */
  prune() {
    const now = Date.now();
    this._expungeSoftDeleted(now);

    let evicted = 0;

    while (this._liveCount() / this.capacity >= this.evictionOccupancy) {
      const live = this._getLiveEntries();
      if (live.length === 0) break;

      const scored = live
        .map(e => ({ id: e.id, score: this.scoreEntry(e, now) }))
        .sort((a, b) => a.score - b.score); // ascending — worst first

      for (const { id } of scored.slice(0, PRUNE_BATCH)) {
        this._entries.delete(id);
        evicted++;
      }
      this._pruneCount++;
    }

    return { evicted, remaining: this._liveCount() };
  }

  /**
   * Compute a composite retention score for an entry.
   * Higher = more valuable (less likely to be evicted).
   *
   * Formula:
   *   score = importance × EVICTION_WEIGHTS.importance (0.486)
   *         + recency    × EVICTION_WEIGHTS.recency    (0.300)
   *         + relevance  × EVICTION_WEIGHTS.relevance  (0.214)
   *
   * relevance = min(accessCount / fib(8), 1)  where fib(8) = 21 saturates the score.
   *
   * @param {Object} entry
   * @param {number} [now=Date.now()]
   * @returns {number} Score in [0, 1].
   */
  scoreEntry(entry, now = Date.now()) {
    const importance = entry.importance;
    const recency    = recencyScore(entry.accessedAt, now);
    const relevance  = Math.min(entry.accessCount / fib(8), 1);

    return (
      importance * EVICTION_WEIGHTS.importance +
      recency    * EVICTION_WEIGHTS.recency    +
      relevance  * EVICTION_WEIGHTS.relevance
    );
  }

  // ── NAMESPACE OPERATIONS ───────────────────────────────────────────────────

  /**
   * Return all unique namespace strings present among live entries.
   * @returns {string[]} Sorted array.
   */
  getNamespaces() {
    const ns = new Set();
    for (const e of this._entries.values()) {
      if (!e._deleted) ns.add(e.namespace);
    }
    return [...ns].sort();
  }

  /**
   * Semantic query restricted to a single namespace.
   * Access tracking and importance decay are applied identically to query().
   *
   * @param {string}   namespace
   * @param {number[]} queryEmbedding
   * @param {number}   [topK=DEFAULT_TOP_K]
   * @param {number}   [threshold=DEFAULT_THRESHOLD]
   * @returns {Array<{entry: Object, similarity: number, gatedScore: number}>}
   */
  queryByNamespace(namespace, queryEmbedding, topK = this.defaultTopK, threshold = this.defaultThreshold) {
    if (!VALID_NAMESPACES.has(namespace)) {
      throw new TypeError(
        `WisdomStore.queryByNamespace: invalid namespace "${namespace}". ` +
        `Valid: ${[...VALID_NAMESPACES].join(', ')}`,
      );
    }
    validateEmbedding(queryEmbedding);

    const now     = Date.now();
    const results = [];

    for (const entry of this._entries.values()) {
      if (entry._deleted || entry.namespace !== namespace) continue;
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity < threshold) continue;
      const gatedScore = cslGate(similarity, similarity, threshold, PSI * PSI);
      results.push({ entry, similarity, gatedScore });
    }

    results.sort((a, b) =>
      b.similarity !== a.similarity ? b.similarity - a.similarity : b.gatedScore - a.gatedScore,
    );

    const topResults = results.slice(0, topK);
    for (const { entry: e } of topResults) {
      e.accessedAt  = now;
      e.accessCount += 1;
      if (this.autoDecay) applyImportanceDecay(e, now);
    }

    return topResults;
  }

  // ── STATISTICS ─────────────────────────────────────────────────────────────

  /**
   * Return a snapshot of current store statistics.
   *
   * @returns {{
   *   count: number,
   *   capacity: number,
   *   occupancy: number,
   *   avgImportance: number,
   *   oldestEntry: number|null,
   *   softDeleted: number,
   *   byNamespace: Object,
   *   totalStored: number,
   *   pruneCount: number,
   *   consolidationMerges: number,
   *   evictionOccupancy: number,
   *   consolidationThreshold: number,
   *   generatedAt: number
   * }}
   */
  getStats() {
    const now         = Date.now();
    const live        = this._getLiveEntries();
    const softDeleted = [...this._entries.values()].filter(e => e._deleted).length;

    const byNamespace = {};
    for (const ns of VALID_NAMESPACES) byNamespace[ns] = 0;

    let importanceSum = 0;
    let oldestEntry   = null;

    for (const e of live) {
      byNamespace[e.namespace] = (byNamespace[e.namespace] || 0) + 1;
      importanceSum += e.importance;
      if (oldestEntry === null || e.createdAt < oldestEntry) oldestEntry = e.createdAt;
    }

    const count = live.length;
    return {
      count,
      capacity:               this.capacity,
      occupancy:              parseFloat((count / this.capacity).toFixed(6)),
      avgImportance:          parseFloat((count > 0 ? importanceSum / count : 0).toFixed(6)),
      oldestEntry,
      softDeleted,
      byNamespace,
      totalStored:            this._totalStored,
      pruneCount:             this._pruneCount,
      consolidationMerges:    this._consolidationMerges,
      evictionOccupancy:      this.evictionOccupancy,
      consolidationThreshold: this.consolidationThreshold,
      generatedAt:            now,
    };
  }

  // ── PERSISTENCE ────────────────────────────────────────────────────────────

  /**
   * Serialize all live entries to a JSON file.
   * Soft-deleted entries are excluded. Creates parent directories: needed.
   *
   * @param {string} filePath
   * @returns {Promise<string>} Absolute path of the written file.
   */
  async persist(filePath) {
    const absPath = path.resolve(filePath);
    const dir     = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const payload = {
      _version: '3.2.3',
      _schema:  'WisdomStore',
      _savedAt: Date.now(),
      config: {
        capacity:               this.capacity,
        evictionOccupancy:      this.evictionOccupancy,
        consolidationThreshold: this.consolidationThreshold,
        defaultThreshold:       this.defaultThreshold,
        defaultTopK:            this.defaultTopK,
      },
      diagnostics: {
        totalStored:         this._totalStored,
        pruneCount:          this._pruneCount,
        consolidationMerges: this._consolidationMerges,
      },
      entries: this._getLiveEntries().map(e => ({
        id:           e.id,
        namespace:    e.namespace,
        embedding:    e.embedding,
        content:      e.content,
        metadata:     e.metadata,
        importance:   e.importance,
        createdAt:    e.createdAt,
        accessedAt:   e.accessedAt,
        accessCount:  e.accessCount,
        _lastDecayAt: e._lastDecayAt,
      })),
    };

    return new Promise((resolve, reject) => {
      fs.writeFile(absPath, JSON.stringify(payload, null, 2), 'utf8', err =>
        err ? reject(new Error(`WisdomStore.persist: ${err.message}`)) : resolve(absPath),
      );
    });
  }

  /**
   * Hydrate the store from a previously persisted JSON file.
   * Clears existing in-memory state before loading. Skips malformed entries.
   *
   * @param {string} filePath
   * @returns {Promise<{ loaded: number, skipped: number }>}
   * @throws {Error} If file is missing or unparseable.
   */
  async hydrate(filePath) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`WisdomStore.hydrate: file not found — ${absPath}`);
    }

    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    } catch (e) {
      throw new Error(`WisdomStore.hydrate: JSON parse error — ${e.message}`);
    }

    if (payload._schema !== 'WisdomStore') {
      throw new Error(`WisdomStore.hydrate: unexpected schema "${payload._schema}"`);
    }

    this._entries.clear();
    this._totalStored         = payload.diagnostics?.totalStored         || 0;
    this._pruneCount          = payload.diagnostics?.pruneCount          || 0;
    this._consolidationMerges = payload.diagnostics?.consolidationMerges || 0;

    if (payload.config) {
      if (payload.config.capacity               != null) this.capacity               = payload.config.capacity;
      if (payload.config.evictionOccupancy      != null) this.evictionOccupancy      = payload.config.evictionOccupancy;
      if (payload.config.consolidationThreshold != null) this.consolidationThreshold = payload.config.consolidationThreshold;
      if (payload.config.defaultThreshold       != null) this.defaultThreshold       = payload.config.defaultThreshold;
      if (payload.config.defaultTopK            != null) this.defaultTopK            = payload.config.defaultTopK;
    }

    let loaded = 0, skipped = 0;

    for (const raw of (payload.entries || [])) {
      try {
        if (!Array.isArray(raw.embedding) || raw.embedding.length !== EMBEDDING_DIMS) {
          throw new TypeError(`embedding length mismatch: ${raw.embedding?.length}`);
        }
        if (!VALID_NAMESPACES.has(raw.namespace)) {
          throw new TypeError(`invalid namespace: ${raw.namespace}`);
        }
        this._entries.set(raw.id, {
          id:           raw.id          || generateEntryId(),
          namespace:    raw.namespace,
          embedding:    raw.embedding,
          content:      String(raw.content || ''),
          metadata:     raw.metadata    || {},
          importance:   typeof raw.importance === 'number' ? raw.importance : PSI,
          createdAt:    raw.createdAt   || Date.now(),
          accessedAt:   raw.accessedAt  || Date.now(),
          accessCount:  raw.accessCount || 0,
          _deleted:     false,
          _deletedAt:   null,
          _lastDecayAt: raw._lastDecayAt || raw.createdAt || Date.now(),
        });
        loaded++;
      } catch (err) {
        process.stderr.write(`WisdomStore.hydrate: skipping entry (${raw?.id}): ${err.message}\n`);
        skipped++;
      }
    }

    return { loaded, skipped };
  }

  // ── PRIVATE HELPERS ────────────────────────────────────────────────────────

  /** @private @returns {number} */
  _liveCount() {
    let n = 0;
    for (const e of this._entries.values()) { if (!e._deleted) n++; }
    return n;
  }

  /** @private @returns {Object[]} */
  _getLiveEntries() {
    const out = [];
    for (const e of this._entries.values()) { if (!e._deleted) out.push(e); }
    return out;
  }

  /**
   * Hard-delete soft-deleted entries whose TTL has elapsed.
   * @private
   * @param {number} now
   * @returns {number} Count removed.
   */
  _expungeSoftDeleted(now) {
    let n = 0;
    for (const [id, e] of this._entries) {
      if (e._deleted && (now - e._deletedAt) >= SOFT_DELETE_TTL_MS) {
        this._entries.delete(id);
        n++;
      }
    }
    return n;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODULE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  WisdomStore,
  NAMESPACES,
  VALID_NAMESPACES,
  CAPACITY,
  EVICTION_OCCUPANCY,
  PRUNE_BATCH,
  DEFAULT_THRESHOLD,
  DEFAULT_TOP_K,
  DECAY_PERIOD_DAYS,
  EMBEDDING_DIMS,
  SOFT_DELETE_TTL_MS,
};
