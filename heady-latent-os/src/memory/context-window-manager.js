/**
 * @fileoverview Heady™ Context Window Manager — Tiered Context with Compression
 *
 * Manages a four-tier context hierarchy for multi-agent orchestration:
 *
 *   working   (hot)  : 8,192  tokens  — current turn, always in context
 *   session   (warm) : 21,450 tokens  — recent turns (base × φ²)
 *   memory    (cold) : 56,131 tokens  — long-term compressed entries (base × φ⁴)
 *   artifacts (arch) : 146,920 tokens — handles-only, large artifacts (base × φ⁶)
 *
 * Compression triggers at 1 - ψ⁴ ≈ 91% of budget (COMPRESSION_TRIGGER).
 * Eviction uses phi-weighted scoring: importance×0.486 + recency×0.300 + relevance×0.214
 *
 * Context capsules enable inter-agent transfer with compression and filtering.
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  PHI,
  PSI,
  fib,
  phiTokenBudgets,
  CSL_THRESHOLDS,
  EVICTION,
  cosineSimilarity,
  normalize,
} = require('../../shared/phi-math.js');

// ─── Token budget constants ───────────────────────────────────────────────────

const TOKEN_BUDGETS = Object.freeze(phiTokenBudgets(8192));

/** Compression trigger: 1 - ψ⁴ ≈ 0.910 */
const COMPRESSION_TRIGGER = 1 - Math.pow(PSI, 4);

/** Eviction score weights (phi-derived) */
const W_IMPORTANCE = EVICTION.IMPORTANCE;  // 0.486
const W_RECENCY    = EVICTION.RECENCY;     // 0.300
const W_RELEVANCE  = EVICTION.RELEVANCE;   // 0.214

/** Memory retrieval min similarity: CSL DEFAULT (ψ ≈ 0.618) */
const MEMORY_MIN_SIM = CSL_THRESHOLDS.DEFAULT;

/** Tier demotion threshold: CSL LOW ≈ 0.691 */
const DEMOTION_THRESHOLD = CSL_THRESHOLDS.LOW;

/** Default retrieve topK: fib(5) = 5 */
const RETRIEVE_TOP_K = fib(5);

// ─── Context tiers ────────────────────────────────────────────────────────────

const TIER = Object.freeze({
  WORKING:   'working',
  SESSION:   'session',
  MEMORY:    'memory',
  ARTIFACTS: 'artifacts',
});

// ─── Eviction scoring ─────────────────────────────────────────────────────────

/**
 * Compute retention score for a context entry (higher = keep).
 * @param {ContextEntry} entry
 * @param {number} oldestMs - oldest lastAccess in current tier
 * @param {number} newestMs - newest lastAccess in current tier
 * @returns {number} ∈ [0, 1]
 */
function retentionScore(entry, oldestMs, newestMs) {
  const importance = Math.min(1, Math.max(0, entry.importance || PSI));
  const timeRange  = Math.max(1, newestMs - oldestMs);
  const recency    = (entry.lastAccess - oldestMs) / timeRange;
  const relevance  = Math.min(1, (entry.accessCount || 0) / fib(7) /* 13 */);
  return W_IMPORTANCE * importance + W_RECENCY * recency + W_RELEVANCE * relevance;
}

// ─── ContextWindowManager class ───────────────────────────────────────────────

/**
 * @class ContextWindowManager
 *
 * @example
 * const ctx = new ContextWindowManager();
 * ctx.add('system', 'You are a helpful assistant.', { role:'system', tokens:8 });
 * ctx.add('user-turn-42', 'What is phi?', { role:'user', tokens:6 });
 * const capsule = ctx.createCapsule({ targetAgent: 'math-specialist', maxTokens: 21450 });
 */
class ContextWindowManager {
  /**
   * @param {object} [opts]
   * @param {number}   [opts.workingBudget]   - token budget for working tier
   * @param {number}   [opts.sessionBudget]   - session tier budget
   * @param {number}   [opts.memoryBudget]    - memory tier budget
   * @param {number}   [opts.artifactsBudget] - artifacts tier budget
   * @param {Function} [opts.compressor]      - async fn(entry) → compressed text
   * @param {Function} [opts.embedder]        - async fn(text) → number[] (384-dim)
   */
  constructor(opts = {}) {
    this.budgets = Object.freeze({
      [TIER.WORKING]:   opts.workingBudget   || TOKEN_BUDGETS.working,
      [TIER.SESSION]:   opts.sessionBudget   || TOKEN_BUDGETS.session,
      [TIER.MEMORY]:    opts.memoryBudget    || TOKEN_BUDGETS.memory,
      [TIER.ARTIFACTS]: opts.artifactsBudget || TOKEN_BUDGETS.artifacts,
    });
    this.compressor = opts.compressor || null;
    this.embedder   = opts.embedder   || null;

    /** @type {Map<string, ContextEntry[]>} tier → entries */
    this._tiers = {
      [TIER.WORKING]:   [],
      [TIER.SESSION]:   [],
      [TIER.MEMORY]:    [],
      [TIER.ARTIFACTS]: [],
    };

    /** token usage per tier */
    this._usage = {
      [TIER.WORKING]:   0,
      [TIER.SESSION]:   0,
      [TIER.MEMORY]:    0,
      [TIER.ARTIFACTS]: 0,
    };

    this._totalAdded    = 0;
    this._compressions  = 0;
    this._evictions     = 0;
  }

  // ─── Add entry ─────────────────────────────────────────────────────────────

  /**
   * Add a new entry to the working tier.
   * Triggers compression/eviction if budget exceeds COMPRESSION_TRIGGER.
   *
   * @param {string} id      - unique identifier
   * @param {string} content - text content
   * @param {object} [meta]
   * @param {number}   [meta.tokens]     - token count (estimate if not provided)
   * @param {string}   [meta.role]       - 'system'|'user'|'assistant'|'tool'
   * @param {number}   [meta.importance] - 0–1, default PSI
   * @param {number[]} [meta.embedding]  - pre-computed embedding
   * @returns {Promise<void>}
   */
  async add(id, content, meta = {}) {
    const tokens    = meta.tokens     || this._estimateTokens(content);
    const embedding = meta.embedding  || (this.embedder ? await this.embedder(content) : null);

    /** @type {ContextEntry} */
    const entry = {
      id,
      content,
      tokens,
      role:        meta.role       || 'user',
      importance:  meta.importance != null ? meta.importance : PSI,
      embedding:   embedding ? normalize(embedding) : null,
      createdAt:   Date.now(),
      lastAccess:  Date.now(),
      accessCount: 0,
      tier:        TIER.WORKING,
    };

    this._tiers[TIER.WORKING].push(entry);
    this._usage[TIER.WORKING] += tokens;
    this._totalAdded++;

    // Check compression trigger
    const pressure = this._usage[TIER.WORKING] / this.budgets[TIER.WORKING];
    if (pressure >= COMPRESSION_TRIGGER) {
      await this._compressWorking();
    }
  }

  // ─── Compression ───────────────────────────────────────────────────────────

  /**
   * @private
   * Compress working tier: demote low-importance entries to session,
   * optionally compressing text before demotion.
   */
  async _compressWorking() {
    const entries = this._tiers[TIER.WORKING];
    if (entries.length === 0) return;

    const now     = Date.now();
    const oldest  = Math.min(...entries.map(e => e.lastAccess));
    const newest  = Math.max(...entries.map(e => e.lastAccess));

    // Score all entries
    const scored = entries.map(e => ({
      entry: e,
      score: retentionScore(e, oldest, newest),
    }));

    // Sort by score ascending — lowest scored demoted first
    scored.sort((a, b) => a.score - b.score);

    // Demote bottom half (sorted ascending, so first fib(6)=8 are weakest)
    const demoteCount = Math.min(fib(6) /* 8 */, Math.floor(entries.length / 2));

    for (let i = 0; i < demoteCount; i++) {
      const { entry } = scored[i];

      // Optionally compress content
      if (this.compressor && entry.content.length > fib(10) /* 55 chars */) {
        try {
          const compressed = await this.compressor(entry);
          entry.tokens     = this._estimateTokens(compressed);
          entry.content    = compressed;
          this._compressions++;
        } catch (_) { /* keep original on error */ }
      }

      // Demote to session
      await this._demote(entry, TIER.WORKING, TIER.SESSION);
    }
  }

  /**
   * @private
   * Move an entry from one tier to another.
   */
  async _demote(entry, fromTier, toTier) {
    const tierArr = this._tiers[fromTier];
    const idx     = tierArr.indexOf(entry);
    if (idx !== -1) {
      tierArr.splice(idx, 1);
      this._usage[fromTier] -= entry.tokens;
    }

    entry.tier = toTier;
    this._tiers[toTier].push(entry);
    this._usage[toTier] += entry.tokens;

    // Check if destination tier needs eviction
    const pressure = this._usage[toTier] / this.budgets[toTier];
    if (pressure >= COMPRESSION_TRIGGER) {
      await this._evictTier(toTier);
    }
  }

  /**
   * @private
   * Evict lowest-scored entries from a tier (demote downward or drop artifacts).
   */
  async _evictTier(tier) {
    const entries = this._tiers[tier];
    if (entries.length === 0) return;

    const oldest = Math.min(...entries.map(e => e.lastAccess));
    const newest = Math.max(...entries.map(e => e.lastAccess));
    const scored = entries.map(e => ({
      entry: e,
      score: retentionScore(e, oldest, newest),
    })).sort((a, b) => a.score - b.score);

    const evictCount = Math.max(1, Math.floor(entries.length * (1 - PSI)));

    for (let i = 0; i < evictCount; i++) {
      const { entry } = scored[i];

      if (tier === TIER.SESSION) {
        await this._demote(entry, TIER.SESSION, TIER.MEMORY);
      } else if (tier === TIER.MEMORY) {
        await this._demote(entry, TIER.MEMORY, TIER.ARTIFACTS);
      } else {
        // Artifacts: just drop (handle-only reference)
        const idx = this._tiers[TIER.ARTIFACTS].indexOf(entry);
        if (idx !== -1) {
          this._tiers[TIER.ARTIFACTS].splice(idx, 1);
          this._usage[TIER.ARTIFACTS] -= entry.tokens;
        }
        this._evictions++;
      }
    }
  }

  // ─── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Retrieve memory entries by cosine similarity to a query embedding.
   * Searches session + memory tiers.
   *
   * @param {number[]} queryEmbedding
   * @param {number}   [topK=RETRIEVE_TOP_K]
   * @param {number}   [minSim=MEMORY_MIN_SIM]
   * @returns {Array<{id:string, content:string, score:number, tier:string}>}
   */
  retrieveFromMemory(queryEmbedding, topK = RETRIEVE_TOP_K, minSim = MEMORY_MIN_SIM) {
    const normed  = normalize(queryEmbedding);
    const results = [];
    const searchTiers = [TIER.SESSION, TIER.MEMORY];

    for (const tier of searchTiers) {
      for (const entry of this._tiers[tier]) {
        if (!entry.embedding) continue;
        const score = cosineSimilarity(normed, entry.embedding);
        if (score >= minSim) {
          results.push({ id: entry.id, content: entry.content, score, tier });
          entry.lastAccess = Date.now();
          entry.accessCount++;
        }
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Get all entries in the working tier (current context window).
   * @returns {ContextEntry[]}
   */
  getWorkingContext() {
    return this._tiers[TIER.WORKING].slice();
  }

  // ─── Context Capsule ───────────────────────────────────────────────────────

  /**
   * Create a transferable context capsule for inter-agent handoff.
   * Packages: system entries, compressed working context, relevant memory.
   *
   * @param {object} opts
   * @param {string}   opts.targetAgent      - receiving agent name
   * @param {number}   [opts.maxTokens]      - token budget for capsule (default session)
   * @param {boolean}  [opts.includeSystem]  - include system-role entries
   * @param {number[]} [opts.queryEmbedding] - for memory relevance selection
   * @returns {ContextCapsule}
   */
  createCapsule(opts = {}) {
    const maxTokens     = opts.maxTokens    || TOKEN_BUDGETS.session;
    const includeSystem = opts.includeSystem !== false;
    const query         = opts.queryEmbedding || null;

    const entries = [];
    let   budget  = maxTokens;

    // System entries first (always included if flag set)
    if (includeSystem) {
      for (const e of this._tiers[TIER.WORKING]) {
        if (e.role === 'system' && budget >= e.tokens) {
          entries.push({ id: e.id, content: e.content, role: e.role, tokens: e.tokens });
          budget -= e.tokens;
        }
      }
    }

    // Working context (most recent first)
    const working = this._tiers[TIER.WORKING]
      .filter(e => e.role !== 'system')
      .slice()
      .reverse();

    for (const e of working) {
      if (budget < e.tokens) break;
      entries.push({ id: e.id, content: e.content, role: e.role, tokens: e.tokens });
      budget -= e.tokens;
    }

    // Relevant memory entries if embedding query provided
    if (query && budget > 0) {
      const memResults = this.retrieveFromMemory(query, RETRIEVE_TOP_K, MEMORY_MIN_SIM);
      for (const r of memResults) {
        const e = this._findEntry(r.id);
        if (e && budget >= e.tokens) {
          entries.push({ id: e.id, content: e.content, role: e.role || 'memory', tokens: e.tokens, score: r.score });
          budget -= e.tokens;
        }
      }
    }

    return {
      targetAgent: opts.targetAgent || 'unknown',
      createdAt:   Date.now(),
      tokenCount:  maxTokens - budget,
      tokenBudget: maxTokens,
      entries,
      metadata: {
        sourceTiers:  Object.keys(this._usage),
        totalEntries: entries.length,
      },
    };
  }

  /**
   * @private
   */
  _findEntry(id) {
    for (const tier of Object.values(TIER)) {
      for (const e of this._tiers[tier]) {
        if (e.id === id) return e;
      }
    }
    return null;
  }

  // ─── Token estimation ──────────────────────────────────────────────────────

  /**
   * @private
   * Rough token estimate: ~4 chars per token.
   */
  _estimateTokens(text) {
    return Math.ceil((text || '').length / fib(3) /* 2 */ / 2);
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  /**
   * Token usage and pressure by tier.
   * @returns {object}
   */
  usage() {
    const result = {};
    for (const tier of Object.values(TIER)) {
      result[tier] = {
        tokens:   this._usage[tier],
        budget:   this.budgets[tier],
        pressure: this._usage[tier] / this.budgets[tier],
        entries:  this._tiers[tier].length,
      };
    }
    result.compressionTrigger = COMPRESSION_TRIGGER;
    result.totalAdded         = this._totalAdded;
    result.compressions       = this._compressions;
    result.evictions          = this._evictions;
    return result;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  ContextWindowManager,
  retentionScore,
  TIER,
  TOKEN_BUDGETS,
  COMPRESSION_TRIGGER,
  RETRIEVE_TOP_K,
  MEMORY_MIN_SIM,
  DEMOTION_THRESHOLD,
};
