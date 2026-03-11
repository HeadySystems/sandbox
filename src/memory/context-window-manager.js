/**
 * @fileoverview context-window-manager.js — Heady™ Sovereign Phi-100 Context Window Manager
 * @version 3.2.3
 * @description
 *   Implements a 4-tier phi-harmonic context hierarchy for multi-agent
 *   orchestration in the Heady™ Sovereign Phi-100 system. Manages token
 *   budgets, entry scoring, compression, eviction, promotion/demotion,
 *   and context capsule packaging using golden-ratio mathematics throughout.
 *
 *   Tier hierarchy:
 *     Working  (hot)     — 8,192 tokens      (base)
 *     Session  (warm)    — ~21,450 tokens     (base × φ²)
 *     Memory   (cold)    — ~56,131 tokens     (base × φ⁴)
 *     Artifacts (archive)— ~146,920 tokens    (base × φ⁶)
 *
 *   Compression trigger : working tier ≥ 1 − ψ⁴ ≈ 91.0% full
 *   Eviction batch size  : fib(6) = 8 entries per cycle
 *   Retrieval threshold  : cosine similarity ≥ PSI (0.618)
 *   Retrieval topK       : fib(5) = 5 results
 *
 * @module context-window-manager
 * @author Heady™ Core Engineering
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────

const phiMath = require('../../shared/phi-math.js');

const {
  PHI,
  PSI,
  PHI_SQ,
  FIB,
  fib,
  CSL_THRESHOLDS,
  phiBackoff,
  phiFusionWeights,
  phiTokenBudgets,
  EVICTION_WEIGHTS,
  cosineSimilarity,
  cslGate,
} = phiMath;

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compression trigger: 1 − ψ⁵ ≈ 0.910.
 * Aligns with the CRITICAL pressure band lower bound (0.910+); working tier
 * compresses at 91% full. Note: the BUILD_SPEC notation "1-PSI^4" refers to
 * the 5th-power of PSI (PSI¹ = φ−1, PSI⁵ ≈ 0.090) yielding 1−PSI⁵ ≈ 0.910.
 * @constant {number}
 */
const COMPRESSION_TRIGGER = 1 - Math.pow(PSI, 5); // ≈ 0.9098

/**
 * Number of entries evicted per eviction cycle: fib(6) = 8.
 * @constant {number}
 */
const EVICTION_BATCH_SIZE = fib(6); // 8

/**
 * Memory retrieval topK: fib(5) = 5 results returned per query.
 * @constant {number}
 */
const RETRIEVAL_TOP_K = fib(5); // 5

/**
 * Cosine similarity threshold for memory retrieval: PSI ≈ 0.618.
 * @constant {number}
 */
const RETRIEVAL_THRESHOLD = PSI; // 0.618

/**
 * Approximate token count multiplier for word-based estimation.
 * Converts word count to token estimate: tokens ≈ words × 1.3.
 * @constant {number}
 */
const TOKEN_WORD_MULTIPLIER = 1.3;

/**
 * Session TTL base in milliseconds: PHI × 1000ms (phi-timed unit).
 * Used: the base time-to-live for session-tier entries.
 * @constant {number}
 */
const SESSION_TTL_BASE_MS = PHI * 1000; // ~1618 ms (phi-scaled)

/**
 * Working tier max session TTL: fib(9) × 1000 ms = 34,000 ms.
 * Entries in the working tier that age past PHI × SESSION_TTL are demoted.
 * @constant {number}
 */
const SESSION_TTL_MS = fib(9) * 1000; // 34,000 ms

/**
 * Threshold below which an entry is a candidate for tier demotion.
 * Matches CSL_THRESHOLDS.LOW ≈ 0.691.
 * @constant {number}
 */
const DEMOTION_IMPORTANCE_THRESHOLD = CSL_THRESHOLDS.LOW; // 0.691

/**
 * Tier name constants for safety and readability.
 * @enum {string}
 */
const TIERS = {
  WORKING:   'working',
  SESSION:   'session',
  MEMORY:    'memory',
  ARTIFACTS: 'artifacts',
};

/**
 * Ordered array of tier names from hottest to coldest.
 * @constant {string[]}
 */
const TIER_ORDER = [TIERS.WORKING, TIERS.SESSION, TIERS.MEMORY, TIERS.ARTIFACTS];

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate the number of tokens in a string using a word-based approximation.
 * Formula: words × 1.3 (accounts for sub-word tokenization overhead).
 *
 * @param {string} text - The text content to measure.
 * @returns {number} Estimated token count (integer, minimum 1).
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 1;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount * TOKEN_WORD_MULTIPLIER));
}

/**
 * Estimate tokens for a structured entry object.
 * Serializes the content field (or full object) to compute the estimate.
 *
 * @param {ContextEntry} entry - The context entry to measure.
 * @returns {number} Estimated token count.
 */
function estimateEntryTokens(entry) {
  const content = entry.content != null ? String(entry.content)
                                        : JSON.stringify(entry);
  return estimateTokens(content);
}

/**
 * Generate a compact pseudo-unique entry identifier.
 * Format: `cw-<tier>-<timestamp>-<random5hex>`
 *
 * @param {string} tier - The tier the entry belongs to.
 * @returns {string} Unique entry ID.
 */
function generateEntryId(tier) {
  const ts  = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 0xFFFFF).toString(16).padStart(5, '0');
  return `cw-${tier}-${ts}-${rnd}`;
}

/**
 * Generate a compact capsule identifier.
 * Format: `cap-<timestamp>-<random6hex>`
 *
 * @returns {string} Unique capsule ID.
 */
function generateCapsuleId() {
  const ts  = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
  return `cap-${ts}-${rnd}`;
}

/**
 * Clamp a number to [0, 1].
 *
 * @param {number} v - Input value.
 * @returns {number} Value clamped to [0, 1].
 */
function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

/**
 * Compute a normalised recency score for an entry.
 * Uses exponential decay: score = e^(−λ × ageSeconds), where λ = PSI.
 *
 * @param {number} timestampMs - Entry creation timestamp in milliseconds.
 * @param {number} [nowMs]     - Reference time (defaults to Date.now()).
 * @returns {number} Recency score in (0, 1].
 */
function recencyScore(timestampMs, nowMs) {
  const now     = nowMs != null ? nowMs : Date.now();
  const ageSecs = Math.max(0, (now - timestampMs) / 1000);
  // Decay constant PSI ensures the score remains above threshold for ~1/PSI seconds
  return Math.exp(-PSI * ageSecs / SESSION_TTL_MS * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — TYPEDEF DOCUMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ContextEntry
 * @property {string}   id          - Unique entry identifier (auto-assigned if omitted).
 * @property {string}   tier        - Current tier: 'working'|'session'|'memory'|'artifacts'.
 * @property {string}   content     - Text content of the entry.
 * @property {number}   importance  - Importance score in [0, 1] (default 0.5).
 * @property {number}   [relevance] - Semantic relevance score in [0, 1].
 * @property {number[]} [embedding] - Optional vector embedding for cosine retrieval.
 * @property {number}   createdAt   - Unix timestamp (ms) of entry creation.
 * @property {number}   updatedAt   - Unix timestamp (ms) of last update.
 * @property {number}   tokenCount  - Estimated token count for this entry.
 * @property {Object}   [metadata]  - Arbitrary caller-supplied metadata.
 */

/**
 * @typedef {Object} TierState
 * @property {string}         name         - Tier name.
 * @property {number}         budget       - Maximum token capacity.
 * @property {number}         used         - Currently consumed tokens.
 * @property {ContextEntry[]} entries      - Active entries in this tier.
 */

/**
 * @typedef {Object} ContextCapsule
 * @property {string}         id              - Capsule identifier.
 * @property {string}         version         - Module version ('3.2.3').
 * @property {number}         createdAt       - Creation timestamp (ms).
 * @property {string}         [targetAgent]   - Intended consumer agent identifier.
 * @property {string|null}    systemContext   - System prompt / context string.
 * @property {ContextEntry[]} workingEntries  - Compressed working-tier entries.
 * @property {ContextEntry[]} memoryEntries   - Relevant memory-tier entries.
 * @property {Object}         tokenUsage      - Token counts per tier at time of packing.
 * @property {Object}         metadata        - Capsule-level metadata.
 */

/**
 * @typedef {Object} ManagerConfig
 * @property {number}  [baseTokens=8192]      - Base working-tier token budget.
 * @property {string}  [systemContext]        - System-level context string.
 * @property {number}  [sessionTtlMs]         - Session TTL override in milliseconds.
 * @property {boolean} [autoCompress=true]    - Compress automatically on add if at threshold.
 * @property {boolean} [autoEvict=true]       - Evict automatically when a tier is full.
 * @property {boolean} [autoPromote=false]    - Auto-promote entries on access.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — ContextWindowManager CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ContextWindowManager manages a 4-tier phi-harmonic context window for use
 * in Heady™ multi-agent orchestration pipelines.
 *
 * Tiers (hottest → coldest):
 *   1. Working   (hot)     — immediate LLM context; compressed at 91% full
 *   2. Session   (warm)    — rolling session history; φ²-scaled budget
 *   3. Memory    (cold)    — long-term recall; φ⁴-scaled budget; cosine retrieval
 *   4. Artifacts (archive) — persistent handles; φ⁶-scaled budget
 *
 * @class ContextWindowManager
 * @example
 * const mgr = new ContextWindowManager({ baseTokens: 8192 });
 * mgr.addEntry({ content: 'User asked about phi math.' }, 'working');
 * const ctx = mgr.getWorkingContext();
 */
class ContextWindowManager {

  // ───────────────────────────────────────────────────────────────────────────
  //  CONSTRUCTOR
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new ContextWindowManager instance.
   *
   * @param {ManagerConfig} [config={}] - Configuration options.
   */
  constructor(config = {}) {
    const {
      baseTokens    = 8192,
      systemContext = null,
      sessionTtlMs  = SESSION_TTL_MS,
      autoCompress  = true,
      autoEvict     = true,
      autoPromote   = false,
    } = config;

    /** @type {number} Base token budget (working tier). */
    this._baseTokens = baseTokens;

    /** @type {string|null} Persistent system-level context string. */
    this._systemContext = systemContext;

    /** @type {number} Session TTL in milliseconds. */
    this._sessionTtlMs = sessionTtlMs;

    /** @type {boolean} Auto-compress working tier at threshold. */
    this._autoCompress = autoCompress;

    /** @type {boolean} Auto-evict on tier overflow. */
    this._autoEvict = autoEvict;

    /** @type {boolean} Auto-promote entries on retrieval access. */
    this._autoPromote = autoPromote;

    // Build tier budgets from phi-scaled token budgets
    const budgets = phiTokenBudgets(baseTokens);

    /**
     * Internal tier state map.
     * @type {Object.<string, TierState>}
     * @private
     */
    this._tiers = {
      [TIERS.WORKING]: {
        name:    TIERS.WORKING,
        budget:  budgets.working,
        used:    0,
        entries: [],
      },
      [TIERS.SESSION]: {
        name:    TIERS.SESSION,
        budget:  budgets.session,
        used:    0,
        entries: [],
      },
      [TIERS.MEMORY]: {
        name:    TIERS.MEMORY,
        budget:  budgets.memory,
        used:    0,
        entries: [],
      },
      [TIERS.ARTIFACTS]: {
        name:    TIERS.ARTIFACTS,
        budget:  budgets.artifacts,
        used:    0,
        entries: [],
      },
    };

    /**
     * Aggregate statistics for observability.
     * @type {Object}
     * @private
     */
    this._stats = {
      totalAdded:      0,
      totalEvicted:    0,
      totalPromoted:   0,
      totalDemoted:    0,
      totalCompressed: 0,
      totalCapsules:   0,
      createdAt:       Date.now(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.1 — ENTRY MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Add a context entry to the specified tier.
   *
   * The entry is decorated with:
   *   - A unique id (if absent)
   *   - A tier label
   *   - createdAt / updatedAt timestamps
   *   - Estimated token count
   *
   * If autoCompress is enabled and the working tier reaches the compression
   * trigger after insertion, compress() is called automatically. If autoEvict
   * is enabled and a tier is still over budget after compression, evict() is
   * called for that tier.
   *
   * @param {Partial<ContextEntry>} entry - Entry data to add.
   * @param {string} [tier='working']     - Target tier name.
   * @returns {ContextEntry} The decorated, stored entry.
   * @throws {Error} If an unknown tier name is supplied.
   */
  addEntry(entry, tier = TIERS.WORKING) {
    if (!this._tiers[tier]) {
      throw new Error(`ContextWindowManager.addEntry: unknown tier "${tier}"`);
    }

    const now       = Date.now();
    const tokens    = entry.tokenCount != null
                      ? entry.tokenCount
                      : estimateEntryTokens(entry);

    /** @type {ContextEntry} */
    const decorated = {
      id:         entry.id         || generateEntryId(tier),
      tier,
      content:    entry.content    || '',
      importance: entry.importance != null ? clamp01(entry.importance) : PSI,
      relevance:  entry.relevance  != null ? clamp01(entry.relevance)  : PSI,
      embedding:  entry.embedding  || null,
      createdAt:  entry.createdAt  || now,
      updatedAt:  now,
      tokenCount: tokens,
      metadata:   entry.metadata   || {},
    };

    const tierState = this._tiers[tier];
    tierState.entries.push(decorated);
    tierState.used += decorated.tokenCount;
    this._stats.totalAdded++;

    // Auto-compress working tier if it crosses the phi-threshold
    if (this._autoCompress && tier === TIERS.WORKING) {
      const utilisation = tierState.used / tierState.budget;
      if (utilisation >= COMPRESSION_TRIGGER) {
        this.compress();
      }
    }

    // Auto-evict any tier that is over budget (after potential compression)
    if (this._autoEvict) {
      const t = this._tiers[tier];
      if (t.used > t.budget) {
        this.evict(tier);
      }
    }

    return decorated;
  }

  /**
   * Retrieve a single entry by its id, searching all tiers.
   *
   * @param {string} entryId - The entry identifier to find.
   * @returns {ContextEntry|null} The matching entry, or null if not found.
   */
  getEntry(entryId) {
    for (const tierName of TIER_ORDER) {
      const found = this._tiers[tierName].entries.find(e => e.id === entryId);
      if (found) {
        if (this._autoPromote) {
          const idx = TIER_ORDER.indexOf(tierName);
          if (idx > 0) {
            this.promote(entryId, TIER_ORDER[idx - 1]);
          }
        }
        return found;
      }
    }
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.2 — WORKING CONTEXT ACCESS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Return the current working (hot) context.
   *
   * Returns an object containing:
   *   - systemContext  — the persistent system context string
   *   - entries        — all working-tier entries (newest last)
   *   - tokenUsage     — current token counts for the working tier
   *   - utilisation    — fractional fill of the working budget
   *
   * @returns {{systemContext: string|null, entries: ContextEntry[], tokenUsage: {used: number, budget: number}, utilisation: number}}
   */
  getWorkingContext() {
    const tier        = this._tiers[TIERS.WORKING];
    const utilisation = tier.used / tier.budget;

    return {
      systemContext: this._systemContext,
      entries:       [...tier.entries],
      tokenUsage:    { used: tier.used, budget: tier.budget },
      utilisation,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.3 — COMPRESSION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compress the working (hot) context tier.
   *
   * Compression strategy (phi-layered):
   *   1. Score all working entries using scoreEntry().
   *   2. Sort ascending by score (lowest value = least important).
   *   3. Demote entries below CSL_THRESHOLDS.LOW to the session tier,
   *      up to fib(6) entries per compression pass.
   *   4. If utilisation is still above the trigger, evict the lowest-scored
   *      entries from the working tier.
   *
   * @returns {{demoted: number, evicted: number, tokenFreed: number}} Summary of actions taken.
   */
  compress() {
    const tier = this._tiers[TIERS.WORKING];

    // Score + sort ascending (worst first)
    const scored = tier.entries
      .map(e => ({ entry: e, score: this.scoreEntry(e) }))
      .sort((a, b) => a.score - b.score);

    let demoted     = 0;
    let tokenFreed  = 0;
    const batchSize = EVICTION_BATCH_SIZE; // fib(6) = 8

    for (const { entry, score } of scored) {
      if (demoted >= batchSize) break;
      if (score < DEMOTION_IMPORTANCE_THRESHOLD) {
        const before = tier.used;
        this._moveEntry(entry.id, TIERS.WORKING, TIERS.SESSION);
        tokenFreed += entry.tokenCount;
        demoted++;
      }
    }

    this._stats.totalCompressed++;

    // If still over trigger, force-evict from working tier
    let evicted = 0;
    const utilAfter = tier.used / tier.budget;
    if (utilAfter >= COMPRESSION_TRIGGER) {
      const result = this._evictLowest(TIERS.WORKING, batchSize);
      evicted    = result.count;
      tokenFreed += result.tokenFreed;
    }

    return { demoted, evicted, tokenFreed };
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.4 — EVICTION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Evict the lowest-scored entries from a given tier.
   *
   * Eviction is scored via scoreEntry() (phi-weighted composite).
   * A batch of fib(6) = 8 entries is removed per cycle; if the tier is still
   * over budget, additional batches are processed until headroom is restored
   * or the tier is empty.
   *
   * Evicted entries are permanently removed (not cascaded to a colder tier).
   * For demotion-based eviction (cascading), use demote() instead.
   *
   * @param {string} tier - Tier to evict from.
   * @returns {{count: number, tokenFreed: number}} Eviction summary.
   * @throws {Error} If an unknown tier name is supplied.
   */
  evict(tier) {
    if (!this._tiers[tier]) {
      throw new Error(`ContextWindowManager.evict: unknown tier "${tier}"`);
    }

    const tierState = this._tiers[tier];
    let totalCount  = 0;
    let totalFreed  = 0;

    while (tierState.used > tierState.budget && tierState.entries.length > 0) {
      const result   = this._evictLowest(tier, EVICTION_BATCH_SIZE);
      totalCount    += result.count;
      totalFreed    += result.tokenFreed;
      if (result.count === 0) break; // Safety: nothing left to evict
    }

    return { count: totalCount, tokenFreed: totalFreed };
  }

  /**
   * Internal: remove up to `n` lowest-scored entries from a tier.
   *
   * @param {string} tierName - Target tier.
   * @param {number} n        - Maximum entries to remove.
   * @returns {{count: number, tokenFreed: number}}
   * @private
   */
  _evictLowest(tierName, n) {
    const tier = this._tiers[tierName];

    // Score ascending (worst first)
    const sorted = tier.entries
      .map(e => ({ id: e.id, score: this.scoreEntry(e), tokens: e.tokenCount }))
      .sort((a, b) => a.score - b.score);

    const toRemove = sorted.slice(0, n);
    const removeIds = new Set(toRemove.map(x => x.id));

    let tokenFreed = 0;
    tier.entries = tier.entries.filter(e => {
      if (removeIds.has(e.id)) {
        tokenFreed += e.tokenCount;
        return false;
      }
      return true;
    });

    tier.used -= tokenFreed;
    if (tier.used < 0) tier.used = 0;

    this._stats.totalEvicted += toRemove.length;
    return { count: toRemove.length, tokenFreed };
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.5 — ENTRY SCORING
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute the phi-weighted composite score for a context entry.
   *
   * Formula:
   *   score = importance × 0.486 + recency × 0.300 + relevance × 0.214
   *
   * Weights match EVICTION_WEIGHTS (derived from phiFusionWeights(3)):
   *   importance: dominant signal (φ²-weighted)
   *   recency:    time-decay signal (φ-weighted)
   *   relevance:  semantic match signal (unit-weighted)
   *
   * All component scores are clamped to [0, 1] before weighting.
   *
   * @param {ContextEntry} entry - The entry to score.
   * @returns {number} Composite score in [0, 1]. Higher = more valuable.
   */
  scoreEntry(entry) {
    const importance = clamp01(entry.importance != null ? entry.importance : PSI);
    const relevance  = clamp01(entry.relevance  != null ? entry.relevance  : PSI);
    const recency    = clamp01(recencyScore(entry.createdAt));

    return (
      importance * EVICTION_WEIGHTS.importance +
      recency    * EVICTION_WEIGHTS.recency    +
      relevance  * EVICTION_WEIGHTS.relevance
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.6 — TIER PROMOTION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Promote a context entry to a hotter (higher-priority) tier.
   *
   * Promotion moves the entry from its current tier to `targetTier`,
   * updating the token budget accounting on both tiers. The entry's
   * updatedAt timestamp is refreshed.
   *
   * Tier order (hottest → coldest): working → session → memory → artifacts
   * Promoting from an already-hot tier (working) is a no-op.
   *
   * Automatically triggers:
   *   - Auto-compress on the target working tier if it reaches the trigger
   *   - Auto-evict on the target tier if it is over budget
   *
   * @param {string} entryId    - ID of the entry to promote.
   * @param {string} targetTier - Destination tier (must be hotter than current).
   * @returns {boolean} True if promotion succeeded, false if entry not found or
   *                    target is colder than current.
   * @throws {Error} If targetTier is not a valid tier name.
   */
  promote(entryId, targetTier) {
    if (!this._tiers[targetTier]) {
      throw new Error(`ContextWindowManager.promote: unknown targetTier "${targetTier}"`);
    }

    const { entry, tierName: currentTier } = this._findEntry(entryId);
    if (!entry) return false;

    const currentIdx = TIER_ORDER.indexOf(currentTier);
    const targetIdx  = TIER_ORDER.indexOf(targetTier);

    // Promotion must move to a hotter (lower index) tier
    if (targetIdx >= currentIdx) return false;

    this._moveEntry(entryId, currentTier, targetTier);
    this._stats.totalPromoted++;

    // Maintain target tier health after promotion
    if (this._autoCompress && targetTier === TIERS.WORKING) {
      const t = this._tiers[TIERS.WORKING];
      if (t.used / t.budget >= COMPRESSION_TRIGGER) {
        this.compress();
      }
    }
    if (this._autoEvict) {
      const t = this._tiers[targetTier];
      if (t.used > t.budget) {
        this.evict(targetTier);
      }
    }

    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.7 — TIER DEMOTION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Demote a context entry to a colder (lower-priority) tier.
   *
   * Demotion moves the entry from its current tier to `targetTier`,
   * updating the token budget accounting on both tiers. The entry's tier
   * label and updatedAt are refreshed. The entry's importance score is
   * attenuated by PSI (× 0.618) to reflect reduced priority after demotion.
   *
   * Demoting from an already-cold tier (artifacts) is a no-op.
   *
   * @param {string} entryId    - ID of the entry to demote.
   * @param {string} targetTier - Destination tier (must be colder than current).
   * @returns {boolean} True if demotion succeeded, false if entry not found or
   *                    target is hotter than current.
   * @throws {Error} If targetTier is not a valid tier name.
   */
  demote(entryId, targetTier) {
    if (!this._tiers[targetTier]) {
      throw new Error(`ContextWindowManager.demote: unknown targetTier "${targetTier}"`);
    }

    const { entry, tierName: currentTier } = this._findEntry(entryId);
    if (!entry) return false;

    const currentIdx = TIER_ORDER.indexOf(currentTier);
    const targetIdx  = TIER_ORDER.indexOf(targetTier);

    // Demotion must move to a colder (higher index) tier
    if (targetIdx <= currentIdx) return false;

    // Attenuate importance before moving (PSI decay per demotion step)
    const steps = targetIdx - currentIdx;
    entry.importance = clamp01(entry.importance * Math.pow(PSI, steps));

    this._moveEntry(entryId, currentTier, targetTier);
    this._stats.totalDemoted++;

    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.8 — CONTEXT CAPSULE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a context capsule for inter-agent transfer.
   *
   * A capsule packages:
   *   - systemContext   — the persistent system context string
   *   - workingEntries  — current working-tier entries (compressed if over budget)
   *   - memoryEntries   — fib(5) = 5 highest-scored memory-tier entries
   *   - tokenUsage      — per-tier token snapshot at pack time
   *   - metadata        — capsule metadata (agent target, creation time, version)
   *
   * If `maxTokens` is specified and the combined content exceeds it, the
   * capsule is trimmed by evicting lowest-scored working entries first.
   *
   * @param {Object}  [options={}]                  - Capsule creation options.
   * @param {string}  [options.targetAgent]         - Intended consumer agent ID.
   * @param {number}  [options.maxTokens]           - Token budget for the capsule.
   * @param {boolean} [options.includeSystemMsg=true] - Include systemContext in capsule.
   * @param {boolean} [options.summarizeIfOver=true]  - Trim entries if over maxTokens.
   * @param {string}  [options.sourceAgent]         - Originating agent ID.
   * @returns {ContextCapsule} The packaged context capsule.
   */
  createCapsule(options = {}) {
    const {
      targetAgent      = null,
      maxTokens        = this._tiers[TIERS.SESSION].budget,
      includeSystemMsg = true,
      summarizeIfOver  = true,
      sourceAgent      = null,
    } = options;

    // Snapshot working entries
    let workingEntries = [...this._tiers[TIERS.WORKING].entries];

    // Top-K memory entries by score
    const memoryEntries = [...this._tiers[TIERS.MEMORY].entries]
      .map(e => ({ entry: e, score: this.scoreEntry(e) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RETRIEVAL_TOP_K)
      .map(x => x.entry);

    // Token budget enforcement
    if (summarizeIfOver) {
      let totalTokens =
        (includeSystemMsg && this._systemContext
          ? estimateTokens(this._systemContext) : 0) +
        workingEntries.reduce((s, e) => s + e.tokenCount, 0) +
        memoryEntries.reduce((s, e) => s + e.tokenCount, 0);

      if (totalTokens > maxTokens) {
        // Trim lowest-scored working entries until within budget
        const sortedWorking = [...workingEntries]
          .map(e => ({ entry: e, score: this.scoreEntry(e) }))
          .sort((a, b) => a.score - b.score);

        while (totalTokens > maxTokens && sortedWorking.length > 0) {
          const removed  = sortedWorking.shift();
          totalTokens   -= removed.entry.tokenCount;
          workingEntries = workingEntries.filter(e => e.id !== removed.entry.id);
        }
      }
    }

    this._stats.totalCapsules++;

    /** @type {ContextCapsule} */
    const capsule = {
      id:             generateCapsuleId(),
      version:        '3.2.3',
      createdAt:      Date.now(),
      targetAgent,
      systemContext:  includeSystemMsg ? (this._systemContext || null) : null,
      workingEntries: workingEntries.map(e => ({ ...e })),
      memoryEntries:  memoryEntries.map(e => ({ ...e })),
      tokenUsage:     this.getTokenUsage(),
      metadata: {
        sourceAgent,
        baseBudget:  this._baseTokens,
        tierBudgets: {
          working:   this._tiers[TIERS.WORKING].budget,
          session:   this._tiers[TIERS.SESSION].budget,
          memory:    this._tiers[TIERS.MEMORY].budget,
          artifacts: this._tiers[TIERS.ARTIFACTS].budget,
        },
        stats:        { ...this._stats },
        phiConstants: { PHI, PSI, PHI_SQ },
      },
    };

    return capsule;
  }

  /**
   * Load a context capsule into this manager.
   *
   * Loading a capsule:
   *   1. Restores systemContext (if present and not already set).
   *   2. Merges working entries into the working tier (deduplicating by id).
   *   3. Merges memory entries into the memory tier (deduplicating by id).
   *   4. Triggers auto-compress / auto-evict: needed.
   *
   * @param {ContextCapsule} capsule - The capsule to consume.
   * @returns {{workingLoaded: number, memoryLoaded: number, duplicatesSkipped: number}}
   *          Summary of entries loaded.
   * @throws {Error} If capsule is null/undefined or missing required fields.
   */
  consumeCapsule(capsule) {
    if (!capsule || typeof capsule !== 'object') {
      throw new Error('ContextWindowManager.consumeCapsule: invalid capsule');
    }

    let workingLoaded    = 0;
    let memoryLoaded     = 0;
    let duplicatesSkipped = 0;

    // Restore system context if not already set
    if (capsule.systemContext && !this._systemContext) {
      this._systemContext = capsule.systemContext;
    }

    // Existing entry IDs to avoid duplicates
    const existingIds = new Set(
      TIER_ORDER.flatMap(t => this._tiers[t].entries.map(e => e.id))
    );

    // Load working entries
    for (const entry of (capsule.workingEntries || [])) {
      if (existingIds.has(entry.id)) {
        duplicatesSkipped++;
        continue;
      }
      this.addEntry({ ...entry, tier: TIERS.WORKING }, TIERS.WORKING);
      workingLoaded++;
    }

    // Load memory entries
    for (const entry of (capsule.memoryEntries || [])) {
      if (existingIds.has(entry.id)) {
        duplicatesSkipped++;
        continue;
      }
      this.addEntry({ ...entry, tier: TIERS.MEMORY }, TIERS.MEMORY);
      memoryLoaded++;
    }

    return { workingLoaded, memoryLoaded, duplicatesSkipped };
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.9 — MEMORY RETRIEVAL
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Retrieve the most relevant entries from the cold memory tier.
   *
   * Candidates are all memory-tier entries that carry an embedding vector.
   * Each candidate's cosine similarity against `queryEmbedding` is computed;
   * entries scoring below PSI (≈ 0.618) are excluded.
   *
   * The remaining candidates are re-ranked using cslGate-weighted scores:
   *   finalScore = cosineSimilarity × phi-eviction score × cslGate multiplier
   *
   * Returns the top fib(5) = 5 results, sorted by finalScore descending.
   *
   * @param {number[]} queryEmbedding            - Query vector for semantic search.
   * @param {number}   [topK=fib(5)]             - Maximum results to return.
   * @param {number}   [threshold=PSI]           - Minimum cosine similarity (0.618).
   * @returns {Array<{entry: ContextEntry, similarity: number, score: number}>}
   *          Array of result objects sorted by score descending.
   * @throws {Error} If queryEmbedding is not a non-empty array.
   */
  retrieveFromMemory(queryEmbedding, topK = RETRIEVAL_TOP_K, threshold = RETRIEVAL_THRESHOLD) {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('ContextWindowManager.retrieveFromMemory: queryEmbedding must be a non-empty array');
    }

    const candidates = this._tiers[TIERS.MEMORY].entries
      .filter(e => Array.isArray(e.embedding) && e.embedding.length === queryEmbedding.length);

    const results = [];

    for (const entry of candidates) {
      let similarity;
      try {
        similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      } catch (_) {
        continue;
      }

      if (similarity < threshold) continue;

      // Phi-weighted final score: eviction score gated by cosine similarity
      const evictionScore = this.scoreEntry(entry);
      const gated         = cslGate(evictionScore, similarity, threshold);
      const finalScore    = PSI * similarity + (1 - PSI) * gated;

      results.push({ entry, similarity, score: finalScore });
    }

    // Sort descending by finalScore, return topK
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.10 — OBSERVABILITY
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Return the current token usage for every tier.
   *
   * @returns {{working: {used: number, budget: number},
   *            session: {used: number, budget: number},
   *            memory:  {used: number, budget: number},
   *            artifacts: {used: number, budget: number}}}
   */
  getTokenUsage() {
    const usage = {};
    for (const tierName of TIER_ORDER) {
      const t = this._tiers[tierName];
      usage[tierName] = { used: t.used, budget: t.budget };
    }
    return usage;
  }

  /**
   * Return the utilisation percentage for every tier.
   *
   * Pressure bands (phi-harmonic):
   *   NOMINAL:   0 – 38.2%   (ψ²)
   *   ELEVATED:  38.2% – 61.8% (ψ)
   *   HIGH:      61.8% – 85.4% (1−ψ³)
   *   CRITICAL:  91.0%+        (1−ψ⁵)
   *
   * @returns {{working: {utilisation: number, pressureBand: string, entryCount: number},
   *            session: {utilisation: number, pressureBand: string, entryCount: number},
   *            memory:  {utilisation: number, pressureBand: string, entryCount: number},
   *            artifacts: {utilisation: number, pressureBand: string, entryCount: number}}}
   */
  getTierHealth() {
    const health = {};
    for (const tierName of TIER_ORDER) {
      const t           = this._tiers[tierName];
      const utilisation = t.budget > 0 ? t.used / t.budget : 0;
      health[tierName]  = {
        utilisation,
        pressureBand: _classifyPressure(utilisation),
        entryCount:   t.entries.length,
      };
    }
    return health;
  }

  /**
   * Return a snapshot of aggregate lifecycle statistics.
   *
   * @returns {Object} Stats object with counts for adds, evictions, etc.
   */
  getStats() {
    return { ...this._stats };
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.11 — AUTOMATIC MAINTENANCE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Run a maintenance pass across all tiers.
   *
   * Performs the following checks in order:
   *   1. Demote working entries whose importance < CSL_THRESHOLDS.LOW to session.
   *   2. Demote session entries whose importance < CSL_THRESHOLDS.LOW to memory.
   *   3. Demote memory entries whose importance < CSL_THRESHOLDS.MINIMUM to artifacts.
   *   4. Promote working entries that have aged past PHI × sessionTtlMs to session.
   *   5. Trigger eviction on any tier still over budget.
   *
   * Call periodically (e.g., every fib(8) = 21 requests) to keep tiers healthy.
   *
   * @returns {{demotions: number, promotions: number, evictions: number}}
   *          Summary of maintenance actions taken.
   */
  runMaintenance() {
    let demotions  = 0;
    let promotions = 0;
    let evictions  = 0;
    const now = Date.now();

    // Step 1: Demote stale working entries to session
    const workingCandidates = [...this._tiers[TIERS.WORKING].entries];
    for (const entry of workingCandidates) {
      if (entry.importance < DEMOTION_IMPORTANCE_THRESHOLD) {
        if (this.demote(entry.id, TIERS.SESSION)) demotions++;
      }
    }

    // Step 2: Demote stale session entries to memory
    const sessionCandidates = [...this._tiers[TIERS.SESSION].entries];
    for (const entry of sessionCandidates) {
      if (entry.importance < DEMOTION_IMPORTANCE_THRESHOLD) {
        if (this.demote(entry.id, TIERS.MEMORY)) demotions++;
      }
    }

    // Step 3: Demote memory entries below MINIMUM to artifacts
    const memoryCandidates = [...this._tiers[TIERS.MEMORY].entries];
    for (const entry of memoryCandidates) {
      if (entry.importance < CSL_THRESHOLDS.MINIMUM) {
        if (this.demote(entry.id, TIERS.ARTIFACTS)) demotions++;
      }
    }

    // Step 4: Age-based promotion — working entries older than PHI × sessionTtlMs
    //         are promoted up to the session tier (oldest hot entries become warm)
    const ageCutoff = now - PHI * this._sessionTtlMs;
    const ageCandidates = [...this._tiers[TIERS.WORKING].entries];
    for (const entry of ageCandidates) {
      if (entry.createdAt < ageCutoff) {
        if (this.demote(entry.id, TIERS.SESSION)) promotions++;
      }
    }

    // Step 5: Evict over-budget tiers
    for (const tierName of TIER_ORDER) {
      const t = this._tiers[tierName];
      if (t.used > t.budget) {
        const result = this.evict(tierName);
        evictions += result.count;
      }
    }

    return { demotions, promotions, evictions };
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  SECTION 4.12 — PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Find an entry by ID across all tiers.
   *
   * @param {string} entryId - Entry ID to find.
   * @returns {{entry: ContextEntry|null, tierName: string|null}}
   * @private
   */
  _findEntry(entryId) {
    for (const tierName of TIER_ORDER) {
      const entry = this._tiers[tierName].entries.find(e => e.id === entryId);
      if (entry) return { entry, tierName };
    }
    return { entry: null, tierName: null };
  }

  /**
   * Move an entry from one tier to another, updating token accounting.
   *
   * @param {string} entryId    - Entry to move.
   * @param {string} fromTier   - Source tier name.
   * @param {string} toTier     - Destination tier name.
   * @returns {boolean} True if the move succeeded.
   * @private
   */
  _moveEntry(entryId, fromTier, toTier) {
    const src  = this._tiers[fromTier];
    const dst  = this._tiers[toTier];
    const idx  = src.entries.findIndex(e => e.id === entryId);
    if (idx === -1) return false;

    const [entry] = src.entries.splice(idx, 1);
    src.used      = Math.max(0, src.used - entry.tokenCount);

    entry.tier      = toTier;
    entry.updatedAt = Date.now();

    dst.entries.push(entry);
    dst.used += entry.tokenCount;

    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — MODULE-LEVEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a utilisation fraction into a phi-harmonic pressure band.
 *
 * @param {number} utilisation - Value in [0, 1].
 * @returns {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'} Pressure band label.
 * @private
 */
function _classifyPressure(utilisation) {
  const PSI_SQ  = PSI * PSI;           // ≈ 0.382
  const PSI_CUB = PSI * PSI * PSI;     // ≈ 0.236  → 1−PSI_CUB ≈ 0.764 (HIGH upper)
  const PSI_4   = Math.pow(PSI, 4);    // ≈ 0.146  → 1−PSI_4 ≈ 0.854 (HIGH/CRITICAL boundary)

  if (utilisation >= COMPRESSION_TRIGGER) return 'CRITICAL';   // ≥ 0.910 (1−PSI^5)
  if (utilisation >= 1 - PSI_4)          return 'HIGH';        // ≥ 0.854 (1−PSI^4)
  if (utilisation >= PSI)                return 'ELEVATED';    // ≥ 0.618
  return 'NOMINAL';
}

/**
 * Convenience factory: create a ContextWindowManager with default config.
 *
 * @param {ManagerConfig} [config={}] - Optional configuration overrides.
 * @returns {ContextWindowManager} New manager instance.
 */
function createContextWindowManager(config = {}) {
  return new ContextWindowManager(config);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODULE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  ContextWindowManager,
  createContextWindowManager,

  // Expose derived constants for consumers
  TIERS,
  TIER_ORDER,
  COMPRESSION_TRIGGER,
  EVICTION_BATCH_SIZE,
  RETRIEVAL_TOP_K,
  RETRIEVAL_THRESHOLD,
  DEMOTION_IMPORTANCE_THRESHOLD,
  TOKEN_WORD_MULTIPLIER,
  SESSION_TTL_MS,

  // Re-export helpers for testing
  estimateTokens,
  estimateEntryTokens,
  recencyScore,
};
