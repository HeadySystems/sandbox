/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ CONTEXT WINDOW MANAGER                                   ║
 * ║  Tiered Phi-Scaled Context Window Management                     ║
 * ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
 * ║  60+ Provisional Patents — All Rights Reserved                   ║
 * ║  © 2026-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Four-tier phi-scaled context budget with compression-triggered eviction,
 * phi-weighted retention scoring, and inter-agent capsule serialization.
 *
 * @module context-window-manager
 */

import { EventEmitter } from 'events';
import {
  PHI, PHI_SQUARED, PHI_4, PHI_6,
  PSI, PSI_4, PSI_5,
  fib, FIBONACCI,
  phiTokenBudgets, EVICTION_WEIGHTS, evictionScore,
  TIMEOUT_TIERS,
} from '../shared/phi-math.js';
import { cslAND, normalize } from '../shared/csl-engine.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

/** Base working context tokens (8192). */
const BASE_TOKENS = fib(13); // fib(13)=233; actual value: use explicit 8192
const WORKING_BASE = 8192;

/** Pre-computed phi-scaled tier budgets. */
const TIER_BUDGETS = Object.freeze(phiTokenBudgets(WORKING_BASE));
// { working: 8192, session: 21451, memory: 56132, artifacts: 146921 }

/** Compression trigger: 1 - ψ⁴ ≈ 0.854 → actually spec says 91.0% = 1 - ψ⁴ ≈ 1 - 0.146 = 0.854
 *  But spec says 91.0% = (1 - PSI_4), so we use PRESSURE_LEVELS.CRITICAL ≈ 0.854.
 *  The spec says "1 - ψ⁴" which equals 1 - 0.1459 = 0.854.
 *  Using PSI_5 for ≈ 0.910 as the spec says "91%" — PSI_5=0.090, 1-PSI_5=0.910. */
const COMPRESSION_TRIGGER = 1 - PSI_5; // ≈ 0.910

/** Entries evicted per cycle: fib(6) = 8 */
const EVICTION_BATCH = fib(6); // 8

/** Memory retrieval top-K: fib(5) = 5 */
const RETRIEVAL_TOP_K = fib(5); // 5

/** Memory retrieval similarity threshold: ψ ≈ 0.618 */
const RETRIEVAL_THRESHOLD = PSI; // 0.618

/** Tier TTLs (ms) — phi-scaled from base 13 000 ms (fib(7)×1000) */
const TIER_TTL = Object.freeze({
  working:   fib(7) * 1000,     //  13 000 ms
  session:   fib(8) * 1000,     //  21 000 ms  (approx fib(7) × φ)
  memory:    fib(10) * 1000,    //  55 000 ms
  artifacts: fib(11) * 1000,    //  89 000 ms
});

/** Tier names in priority order (working = highest priority). */
const TIERS = ['working', 'session', 'memory', 'artifacts'];

/** Average chars per token estimate: fib(2) ≈ 1, more accurately fib(3)=2 chars = 1 token.
 *  Industry standard: 4 chars ≈ 1 token. Use fib(4)=3 as phi-compliant approximation. */
const CHARS_PER_TOKEN = fib(4); // 3

// ─── CONTEXT ENTRY ───────────────────────────────────────────────────────────

/**
 * A single context entry within a tier.
 */
class ContextEntry {
  /**
   * @param {object} opts
   * @param {string}       opts.id
   * @param {string}       opts.tier
   * @param {string}       opts.content      - Raw text content.
   * @param {number}       [opts.importance]  - [0,1] importance signal.
   * @param {Float64Array} [opts.embVec]      - Pre-computed normalized embedding.
   * @param {object}       [opts.metadata]
   */
  constructor({ id, tier, content, importance = PSI, embVec = null, metadata = {} }) {
    this.id         = id;
    this.tier       = tier;
    this.content    = content;
    this.tokens     = countTokens(content);
    this.importance = importance;
    this.embVec     = embVec;
    this.metadata   = metadata;
    this.createdAt  = Date.now();
    this.accessedAt = Date.now();
    this.accessCount = 1;
  }

  /** Recency score — decays with time, phi-derived decay constant. */
  get recency() {
    const ageMs      = Date.now() - this.accessedAt;
    const halfLifeMs = TIER_TTL[this.tier];
    // Exponential decay: e^(-ln2 × age / halfLife), simplified via PSI
    return Math.exp(-(Math.LN2 * ageMs) / halfLifeMs);
  }

  /** Relevance score (set externally via updateRelevance). */
  relevance = PSI_4; // initial neutral relevance: ψ⁴ ≈ 0.146

  /** Compute composite eviction score (higher = keep). */
  get retentionScore() {
    return evictionScore(this.importance, this.recency, this.relevance);
  }

  /** Update access time and increment counter. */
  touch() {
    this.accessedAt = Date.now();
    this.accessCount++;
  }
}

// ─── TOKEN COUNTER ───────────────────────────────────────────────────────────

/**
 * Estimate token count from string content.
 * Uses fib(4)=3 chars/token as phi-compliant approximation.
 *
 * @param {string} text
 * @returns {number}
 */
export function countTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─── CONTEXT WINDOW MANAGER ──────────────────────────────────────────────────

/**
 * ContextWindowManager — Phi-tiered context storage with compression and eviction.
 *
 * Manages four phi-scaled tiers (Working, Session, Memory, Artifacts),
 * triggers compression at 91.0% capacity, evicts fib(6)=8 low-retention
 * entries per cycle, and packages inter-agent capsules with phi-sized budgets.
 *
 * @extends EventEmitter
 */
export class ContextWindowManager extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.workingBase=WORKING_BASE] - Override working tier token budget.
   */
  constructor(opts = {}) {
    super();
    const base     = opts.workingBase ?? WORKING_BASE;
    const budgets  = phiTokenBudgets(base);

    /** @type {Map<string, {budget: number, entries: Map<string, ContextEntry>}>} */
    this._tiers = new Map(TIERS.map(name => [
      name,
      { budget: budgets[name], entries: new Map() },
    ]));

    this._totalTokensUsed = 0;
  }

  // ─── TOKEN ACCOUNTING ──────────────────────────────────────────────────────

  /** Total token budget across all tiers. */
  get totalBudget() {
    let sum = 0;
    for (const t of this._tiers.values()) sum += t.budget;
    return sum;
  }

  /** Tokens currently in use across all tiers. */
  get tokensUsed() {
    let sum = 0;
    for (const t of this._tiers.values()) {
      for (const e of t.entries.values()) sum += e.tokens;
    }
    return sum;
  }

  /** Utilization ratio [0,1] for a specific tier. */
  tierUtilization(tierName) {
    const t = this._tiers.get(tierName);
    if (!t) return 0;
    let used = 0;
    for (const e of t.entries.values()) used += e.tokens;
    return used / t.budget;
  }

  // ─── ADD ENTRY ─────────────────────────────────────────────────────────────

  /**
   * Add a context entry to the specified tier.
   * Triggers compression if utilization ≥ 91.0% after insertion.
   *
   * @param {object} opts
   * @param {string}       opts.id
   * @param {string}       [opts.tier='working']
   * @param {string}       opts.content
   * @param {number}       [opts.importance]
   * @param {Float64Array} [opts.embVec]
   * @param {object}       [opts.metadata]
   * @returns {ContextEntry} The created entry.
   */
  add({ id, tier = 'working', content, importance, embVec, metadata }) {
    const store = this._tiers.get(tier);
    if (!store) throw new Error(`ContextWindowManager: unknown tier '${tier}'`);

    // Replace if exists
    if (store.entries.has(id)) {
      const old = store.entries.get(id);
      store.entries.delete(id);
      this._totalTokensUsed -= old.tokens;
    }

    const entry = new ContextEntry({ id, tier, content, importance, embVec, metadata });
    store.entries.set(id, entry);
    this._totalTokensUsed += entry.tokens;

    this.emit('entry:added', { id, tier, tokens: entry.tokens, utilization: this.tierUtilization(tier) });

    // Trigger compression if needed
    if (this.tierUtilization(tier) >= COMPRESSION_TRIGGER) {
      this.compress(tier);
    }

    return entry;
  }

  /**
   * Retrieve an entry by ID (searches all tiers).
   * @param {string} id
   * @returns {ContextEntry|null}
   */
  get(id) {
    for (const t of this._tiers.values()) {
      if (t.entries.has(id)) {
        const e = t.entries.get(id);
        e.touch();
        return e;
      }
    }
    return null;
  }

  // ─── EVICTION ──────────────────────────────────────────────────────────────

  /**
   * Evict the fib(6)=8 lowest-retention entries from a tier.
   *
   * @param {string} tierName
   * @returns {string[]} Evicted entry IDs.
   */
  evict(tierName) {
    const store = this._tiers.get(tierName);
    if (!store || store.entries.size === 0) return [];

    // Sort entries by retention score ascending (lowest first = evict first)
    const sorted = [...store.entries.values()]
      .sort((a, b) => a.retentionScore - b.retentionScore);

    const toEvict  = sorted.slice(0, EVICTION_BATCH);
    const evictIds = toEvict.map(e => e.id);

    for (const e of toEvict) {
      store.entries.delete(e.id);
      this._totalTokensUsed -= e.tokens;
    }

    this.emit('eviction:batch', { tier: tierName, evicted: evictIds, count: evictIds.length });
    return evictIds;
  }

  // ─── COMPRESSION ───────────────────────────────────────────────────────────

  /**
   * Compress a tier by evicting batches until utilization drops below
   * COMPRESSION_TRIGGER. Promotes eligible entries to next tier if possible.
   *
   * @param {string} tierName
   * @returns {{ evictedCount: number, promoted: number }}
   */
  compress(tierName) {
    let evictedCount = 0;
    let promoted     = 0;
    const nextTierName = TIERS[TIERS.indexOf(tierName) + 1];

    while (this.tierUtilization(tierName) >= COMPRESSION_TRIGGER) {
      const store  = this._tiers.get(tierName);
      if (!store || store.entries.size === 0) break;

      const sorted = [...store.entries.values()]
        .sort((a, b) => a.retentionScore - b.retentionScore);

      // Attempt to promote high-importance entries to next tier
      if (nextTierName) {
        const nextStore = this._tiers.get(nextTierName);
        for (const e of sorted.slice(-EVICTION_BATCH)) {
          if (e.importance >= RETRIEVAL_THRESHOLD && nextStore) {
            store.entries.delete(e.id);
            e.tier = nextTierName;
            nextStore.entries.set(e.id, e);
            promoted++;
          }
        }
      }

      // Evict low-retention entries
      const ids = this.evict(tierName);
      evictedCount += ids.length;
      if (ids.length === 0) break; // safety exit
    }

    this.emit('compression:complete', { tier: tierName, evictedCount, promoted });
    return { evictedCount, promoted };
  }

  // ─── MEMORY RETRIEVAL ──────────────────────────────────────────────────────

  /**
   * Retrieve the top-K (fib(5)=5) most semantically relevant entries
   * from memory/session tiers using cosine similarity ≥ ψ (0.618).
   *
   * @param {Float64Array} queryVec - Normalized query embedding.
   * @param {string[]}     [tiers]  - Tiers to search (default all).
   * @returns {Array<{entry: ContextEntry, similarity: number}>}
   */
  retrieve(queryVec, tiers = TIERS) {
    const normQuery = normalize(new Float64Array(queryVec));
    const candidates = [];

    for (const tierName of tiers) {
      const store = this._tiers.get(tierName);
      if (!store) continue;
      for (const entry of store.entries.values()) {
        if (!entry.embVec) continue;
        const sim = cslAND(normQuery, entry.embVec);
        if (sim >= RETRIEVAL_THRESHOLD) {
          candidates.push({ entry, similarity: sim });
          entry.touch();
        }
      }
    }

    candidates.sort((a, b) => b.similarity - a.similarity);
    return candidates.slice(0, RETRIEVAL_TOP_K);
  }

  // ─── TIER PROMOTION / DEMOTION ─────────────────────────────────────────────

  /**
   * Promote an entry to the next higher tier.
   * @param {string} entryId
   * @returns {boolean} Whether promotion succeeded.
   */
  promote(entryId) {
    for (let i = 0; i < TIERS.length - 1; i++) {
      const currentTier = TIERS[i];
      const store       = this._tiers.get(currentTier);
      if (store?.entries.has(entryId)) {
        const entry    = store.entries.get(entryId);
        const nextName = TIERS[i + 1];
        store.entries.delete(entryId);
        entry.tier = nextName;
        this._tiers.get(nextName).entries.set(entryId, entry);
        this.emit('tier:promoted', { id: entryId, from: currentTier, to: nextName });
        return true;
      }
    }
    return false;
  }

  /**
   * Demote an entry to the next lower tier.
   * @param {string} entryId
   * @returns {boolean}
   */
  demote(entryId) {
    for (let i = TIERS.length - 1; i > 0; i--) {
      const currentTier = TIERS[i];
      const store       = this._tiers.get(currentTier);
      if (store?.entries.has(entryId)) {
        const entry    = store.entries.get(entryId);
        const prevName = TIERS[i - 1];
        store.entries.delete(entryId);
        entry.tier = prevName;
        this._tiers.get(prevName).entries.set(entryId, entry);
        this.emit('tier:demoted', { id: entryId, from: currentTier, to: prevName });
        return true;
      }
    }
    return false;
  }

  // ─── CONTEXT CAPSULE ───────────────────────────────────────────────────────

  /**
   * Create a phi-sized context capsule for inter-agent transfer.
   *
   * The capsule includes the highest-retention working-tier entries within
   * a phi-scaled token budget.
   *
   * @param {object} [opts]
   * @param {number}  [opts.budgetTokens] - Token budget for capsule. Default: ψ × working budget.
   * @param {string}  [opts.agentId]      - Destination agent ID for routing metadata.
   * @returns {{ capsule: object[], budgetUsed: number, capsuleTokens: number }}
   */
  createCapsule({ budgetTokens, agentId } = {}) {
    const budget = budgetTokens ?? Math.round(TIER_BUDGETS.working * PSI);

    const workingStore = this._tiers.get('working');
    const sorted = [...workingStore.entries.values()]
      .sort((a, b) => b.retentionScore - a.retentionScore);

    const capsule = [];
    let used = 0;
    for (const entry of sorted) {
      if (used + entry.tokens > budget) continue; // skip if too large
      capsule.push({
        id:         entry.id,
        tier:       entry.tier,
        content:    entry.content,
        importance: entry.importance,
        relevance:  entry.relevance,
        tokens:     entry.tokens,
        metadata:   entry.metadata,
      });
      used += entry.tokens;
    }

    this.emit('capsule:created', { agentId, budgetTokens: budget, used, count: capsule.length });
    return { capsule, budgetUsed: used, capsuleTokens: budget };
  }

  /**
   * Ingest a context capsule received from another agent.
   * @param {object[]} capsule - Array of capsule entries.
   * @param {string}   [tier='session'] - Target tier.
   */
  ingestCapsule(capsule, tier = 'session') {
    let ingested = 0;
    for (const item of capsule) {
      try {
        this.add({ ...item, tier });
        ingested++;
      } catch (err) {
        this.emit('capsule:ingest-error', { id: item.id, error: err.message });
      }
    }
    this.emit('capsule:ingested', { count: ingested, tier });
  }

  // ─── STATS ─────────────────────────────────────────────────────────────────

  /** Return per-tier and global utilization stats. */
  getStats() {
    const stats = { totalBudget: this.totalBudget, tokensUsed: this.tokensUsed };
    for (const [name, store] of this._tiers) {
      let used = 0;
      for (const e of store.entries.values()) used += e.tokens;
      stats[name] = {
        budget:      store.budget,
        used,
        utilization: +(used / store.budget).toFixed(fib(3)),
        entryCount:  store.entries.size,
      };
    }
    return stats;
  }
}

export default ContextWindowManager;
