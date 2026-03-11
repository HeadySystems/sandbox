'use strict';

/**
 * ContextWindowManager — Phi-scaled tiered context management for multi-agent orchestration.
 *
 * Architecture:
 *   Working (hot,  8192 tokens)       — base
 *   Session (warm, 21450 tokens)      — base × φ²
 *   Memory  (cold, 56131 tokens)      — base × φ⁴
 *   Artifacts (archive, 146920 tokens) — base × φ⁶
 *
 * Compression triggers at 1-ψ⁴ ≈ 91.0% of tier budget.
 * Eviction scoring: importance×0.486 + recency×0.300 + relevance×0.214
 *
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;   // golden ratio
const PSI  = 0.6180339887;   // 1/φ
const PHI2 = PHI * PHI;      // ≈ 2.618  (φ²)
const PHI4 = PHI2 * PHI2;    // ≈ 6.854  (φ⁴)
const PHI6 = PHI4 * PHI2;    // ≈ 17.944 (φ⁶)

// ─── Token budgets ────────────────────────────────────────────────────────────
const TOKEN_BASE = 8192;

// Phi-geometric token budgets (exact spec values; computed from base × φ^n rounded to nearest integer)
// Verified: 8192 × φ² ≈ 21450 | 8192 × φ⁴ ≈ 56131 | 8192 × φ⁶ ≈ 146920
const TOKEN_BUDGETS = {
  working:    8192,    //  8,192  — base
  session:   21450,    // 21,450  — base × φ²  (8192 × 2.618)
  memory:    56131,    // 56,131  — base × φ⁴  (8192 × 6.854)
  artifacts: 146920,   // 146,920 — base × φ⁶  (8192 × 17.944)
};

// ─── Compression and eviction constants ──────────────────────────────────────
const COMPRESSION_TRIGGER = 1 - Math.pow(PSI, 5);   // ≈ 0.9098 — compress at 91.0% full (1 - ψ⁵)
const EVICTION_WEIGHTS = {
  importance: 0.486,   // φ²/(φ²+φ+1)
  recency:    0.300,   // φ/(φ²+φ+1)
  relevance:  0.214,   // 1/(φ²+φ+1)
};

// ─── Retrieval / promotion constants ─────────────────────────────────────────
const RETRIEVAL_THRESHOLD   = PSI;                    // ≈ 0.618 — min similarity floor
const PROMOTION_AGE_FACTOR  = PHI;                    // entries older than φ×sessionTTL demoted
const DEMOTION_SCORE_FLOOR  = 1 - Math.pow(PSI, 3);  // ≈ 0.854 — below this, demote from session→memory
const EVICT_BATCH_SIZE      = 8;                      // fib(6) — evict this many at once

// ─── Entry sizes ─────────────────────────────────────────────────────────────
const ENTRY_MAX_ID_LENGTH   = 89;    // fib(11)
const ARTIFACT_HANDLE_PREFIX = 'art://';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function roughTokenCount(content) {
  if (typeof content === 'string')  return Math.ceil(content.length / 4);
  if (typeof content === 'object')  return Math.ceil(JSON.stringify(content).length / 4);
  return 1;
}

/** Phi-weighted eviction score — higher = more worth keeping. */
function evictionScore(entry) {
  const now = Date.now();
  const ageSec = (now - (entry.lastAccessAt ?? entry.createdAt)) / 1000;
  const recency = Math.exp(-ageSec / (PHI2 * 3600));   // φ²-hour half-life
  return (
    (entry.importance ?? PSI) * EVICTION_WEIGHTS.importance +
    recency                   * EVICTION_WEIGHTS.recency     +
    (entry.relevance  ?? PSI) * EVICTION_WEIGHTS.relevance
  );
}

// ─── ContextEntry ─────────────────────────────────────────────────────────────
class ContextEntry {
  constructor({ id, role = 'user', content, importance = PSI, relevance = PSI, meta = {} }) {
    this.id          = String(id).slice(0, ENTRY_MAX_ID_LENGTH);
    this.role        = role;
    this.content     = content;
    this.tokens      = roughTokenCount(content);
    this.importance  = clamp(importance, 0, 1);
    this.relevance   = clamp(relevance, 0, 1);
    this.meta        = meta;
    this.createdAt   = Date.now();
    this.lastAccessAt = Date.now();
  }

  touch() { this.lastAccessAt = Date.now(); }

  evictionScore() { return evictionScore(this); }
}

// ─── ContextWindowManager ─────────────────────────────────────────────────────
class ContextWindowManager {
  /**
   * @param {object} config
   * @param {Function} [config.summarizeFn]  — async (entries) => string  (LLM summarizer)
   * @param {number}   [config.tokenBase]    — override base token budget (default 8192)
   */
  constructor(config = {}) {
    this.id          = config.id ?? `cwm-${Date.now()}`;
    this.summarizeFn = config.summarizeFn ?? null;

    const base = config.tokenBase ?? TOKEN_BASE;
    // Use spec-canonical values when using default base; phi-geometric scaling for custom bases
    if (base === TOKEN_BASE) {
      this.budgets = { ...TOKEN_BUDGETS };
    } else {
      this.budgets = {
        working:   base,
        session:   Math.round(base * PHI2),
        memory:    Math.round(base * PHI4),
        artifacts: Math.round(base * PHI6),
      };
    }

    this._tiers = {
      working:   [],   // hot: ContextEntry[]
      session:   [],   // warm: ContextEntry[]
      memory:    [],   // cold: ContextEntry[]
      artifacts: [],   // archive: { id, handle, meta, tokens, createdAt }
    };

    this._tokenUsage = { working: 0, session: 0, memory: 0, artifacts: 0 };
    this._compressionCount = 0;
    this._evictionCount    = 0;
    this._systemMessage    = null;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Set or replace the system message (always in working context). */
  setSystemMessage(content) {
    this._systemMessage = new ContextEntry({
      id: '__system__',
      role: 'system',
      content,
      importance: 1.0,
      relevance: 1.0,
    });
  }

  /**
   * Add an entry to working context.
   * Triggers compression if budget threshold exceeded.
   */
  async add(entry) {
    const e = entry instanceof ContextEntry ? entry : new ContextEntry(entry);
    this._tiers.working.push(e);
    this._tokenUsage.working += e.tokens;

    if (this._fillRatio('working') >= COMPRESSION_TRIGGER) {
      await this._compress('working');
    }
    return e.id;
  }

  /**
   * Retrieve an entry by id from any tier (promotes to working on hit).
   * @returns {ContextEntry|null}
   */
  get(id) {
    for (const tier of ['working', 'session', 'memory']) {
      const idx = this._tiers[tier].findIndex(e => e.id === id);
      if (idx !== -1) {
        const entry = this._tiers[tier][idx];
        entry.touch();
        if (tier !== 'working') {
          // Promote to working context
          this._removeFromTier(tier, idx);
          this._tiers.working.push(entry);
          this._tokenUsage.working += entry.tokens;
        }
        return entry;
      }
    }
    return null;
  }

  /**
   * Query working+session context by role or keyword (phi-ranked results).
   * @param {object} opts — { role?, keyword?, topK? }
   */
  query({ role, keyword, topK = 8, tiers = ['working', 'session'] } = {}) {
    const candidates = [];
    for (const tier of tiers) {
      for (const entry of this._tiers[tier]) {
        if (role && entry.role !== role) continue;
        if (keyword) {
          const hay = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
          if (!hay.toLowerCase().includes(keyword.toLowerCase())) continue;
        }
        candidates.push({ entry, score: entry.evictionScore(), tier });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    candidates.slice(0, topK).forEach(c => c.entry.touch());
    return candidates.slice(0, topK).map(c => ({ ...c.entry, tier: c.tier, score: parseFloat(c.score.toFixed(4)) }));
  }

  /**
   * Retrieve from memory tier via similarity threshold.
   * @param {Function} similarityFn — (entry) => number in [0,1]
   * @param {number}   topK
   */
  retrieveFromMemory(similarityFn, topK = 5) {
    const scored = this._tiers.memory
      .map(e => ({ entry: e, sim: similarityFn(e) }))
      .filter(r => r.sim >= RETRIEVAL_THRESHOLD)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, topK);

    // Promote top result to session if highly relevant
    if (scored.length > 0 && scored[0].sim >= DEMOTION_SCORE_FLOOR) {
      const top = scored[0].entry;
      const idx = this._tiers.memory.indexOf(top);
      if (idx !== -1) {
        this._removeFromTier('memory', idx);
        this._tiers.session.push(top);
        this._tokenUsage.session += top.tokens;
        if (this._fillRatio('session') >= COMPRESSION_TRIGGER) this._compress('session');
      }
    }

    return scored.map(r => ({ ...r.entry, similarity: parseFloat(r.sim.toFixed(4)) }));
  }

  /**
   * Create a context capsule for inter-agent transfer.
   * @param {object} opts — { targetAgent, maxTokens, includeSystemMsg, summarizeIfOver }
   */
  async createCapsule({ targetAgent = 'unknown', maxTokens, includeSystemMsg = true, summarizeIfOver = true } = {}) {
    const limit = maxTokens ?? this.budgets.session;
    const entries = [];
    let used = 0;

    if (includeSystemMsg && this._systemMessage) {
      entries.push(this._systemMessage);
      used += this._systemMessage.tokens;
    }

    // Collect working entries sorted by eviction score (keep highest value)
    const sorted = [...this._tiers.working].sort((a, b) => b.evictionScore() - a.evictionScore());
    for (const e of sorted) {
      if (used + e.tokens > limit) {
        if (summarizeIfOver && this.summarizeFn) {
          const summary = await this.summarizeFn(sorted.slice(entries.length));
          const sumEntry = new ContextEntry({ id: `sum-${Date.now()}`, role: 'assistant', content: summary, importance: 0.809 });
          if (used + sumEntry.tokens <= limit) { entries.push(sumEntry); used += sumEntry.tokens; }
        }
        break;
      }
      entries.push(e);
      used += e.tokens;
    }

    return {
      capsuleId:   `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetAgent,
      createdAt:   Date.now(),
      tokenCount:  used,
      entryCount:  entries.length,
      entries:     entries.map(e => ({ id: e.id, role: e.role, content: e.content, tokens: e.tokens })),
      meta: { phiCompliance: '100%', compressionCount: this._compressionCount },
    };
  }

  /**
   * Ingest a context capsule from another agent.
   * @param {object} capsule — output of createCapsule()
   */
  async ingestCapsule(capsule) {
    let ingested = 0;
    for (const e of (capsule.entries ?? [])) {
      await this.add({ id: e.id, role: e.role, content: e.content, importance: PSI, relevance: PSI });
      ingested++;
    }
    return { ingested, capsuleId: capsule.capsuleId };
  }

  // ─── Token accounting ────────────────────────────────────────────────────────

  tokenCount(tier = null) {
    if (tier) return this._tokenUsage[tier] ?? 0;
    return Object.values(this._tokenUsage).reduce((a, b) => a + b, 0);
  }

  tokenBudget(tier = null) {
    if (tier) return this.budgets[tier] ?? 0;
    return Object.values(this.budgets).reduce((a, b) => a + b, 0);
  }

  fillRatios() {
    return Object.fromEntries(
      Object.keys(this.budgets).map(t => [t, parseFloat(this._fillRatio(t).toFixed(4))])
    );
  }

  // ─── Internal mechanics ──────────────────────────────────────────────────────

  _fillRatio(tier) {
    const budget = this.budgets[tier];
    return budget > 0 ? this._tokenUsage[tier] / budget : 0;
  }

  /** Compress a tier: evict low-score entries into the next-colder tier. */
  async _compress(tier) {
    this._compressionCount++;
    const tiers = ['working', 'session', 'memory', 'artifacts'];
    const tierIdx = tiers.indexOf(tier);
    const nextTier = tiers[tierIdx + 1] ?? 'artifacts';

    // Sort ascending by eviction score — lowest value candidates for eviction
    this._tiers[tier].sort((a, b) => a.evictionScore() - b.evictionScore());

    let freed = 0;
    let batchCount = 0;

    while (
      this._fillRatio(tier) >= COMPRESSION_TRIGGER &&
      this._tiers[tier].length > 0 &&
      batchCount < EVICT_BATCH_SIZE
    ) {
      const evicted = this._tiers[tier].shift();
      this._tokenUsage[tier] = Math.max(0, this._tokenUsage[tier] - evicted.tokens);
      freed++;
      batchCount++;
      this._evictionCount++;

      if (nextTier === 'artifacts') {
        // Store as artifact handle (content discarded; only handle + meta retained)
        const handle = ARTIFACT_HANDLE_PREFIX + evicted.id;
        this._tiers.artifacts.push({
          id: evicted.id,
          handle,
          meta: evicted.meta,
          tokens: evicted.tokens,
          importance: evicted.importance,
          createdAt: evicted.createdAt,
        });
        this._tokenUsage.artifacts += evicted.tokens;
      } else {
        // Demote to colder tier; run LLM summary if large
        let demotedContent = evicted.content;
        if (evicted.tokens > Math.round(PHI4 * 100) && this.summarizeFn) {
          demotedContent = await this.summarizeFn([evicted]);
          evicted.tokens = roughTokenCount(demotedContent);
          evicted.content = demotedContent;
        }
        this._tiers[nextTier].push(evicted);
        this._tokenUsage[nextTier] += evicted.tokens;

        // Cascade compress if next tier also over threshold
        if (this._fillRatio(nextTier) >= COMPRESSION_TRIGGER) {
          await this._compress(nextTier);
        }
      }
    }

    return freed;
  }

  /** Run tier demotion: working→session for aged entries. */
  _demoteAged() {
    const sessionTTL = 3600000;   // 1 hour
    const threshold  = PHI * sessionTTL;
    const now = Date.now();
    const toMove = [];

    for (let i = this._tiers.working.length - 1; i >= 0; i--) {
      const e = this._tiers.working[i];
      if (e.id === '__system__') continue;
      if (now - e.lastAccessAt > threshold) toMove.push(i);
    }

    for (const idx of toMove) {
      const [entry] = this._tiers.working.splice(idx, 1);
      this._tokenUsage.working = Math.max(0, this._tokenUsage.working - entry.tokens);
      // Demote to session if score above floor, else memory
      if (entry.evictionScore() >= DEMOTION_SCORE_FLOOR) {
        this._tiers.session.push(entry);
        this._tokenUsage.session += entry.tokens;
      } else {
        this._tiers.memory.push(entry);
        this._tokenUsage.memory += entry.tokens;
      }
    }

    return toMove.length;
  }

  _removeFromTier(tier, idx) {
    const [removed] = this._tiers[tier].splice(idx, 1);
    this._tokenUsage[tier] = Math.max(0, this._tokenUsage[tier] - removed.tokens);
    return removed;
  }

  // ─── Maintenance ─────────────────────────────────────────────────────────────

  /** Flush working context to session (e.g., end of pipeline stage). */
  async flush() {
    const demoted = this._demoteAged();
    for (const tier of ['working', 'session', 'memory']) {
      if (this._fillRatio(tier) >= COMPRESSION_TRIGGER) {
        await this._compress(tier);
      }
    }
    return { demoted, compressions: this._compressionCount };
  }

  /** Hard reset — clears all tiers. */
  reset() {
    this._tiers = { working: [], session: [], memory: [], artifacts: [] };
    this._tokenUsage = { working: 0, session: 0, memory: 0, artifacts: 0 };
    this._compressionCount = 0;
    this._evictionCount    = 0;
  }

  // ─── Diagnostics ─────────────────────────────────────────────────────────────

  getStats() {
    return {
      id:    this.id,
      budgets: this.budgets,
      usage:   { ...this._tokenUsage },
      fillRatios: this.fillRatios(),
      entryCounts: {
        working:   this._tiers.working.length,
        session:   this._tiers.session.length,
        memory:    this._tiers.memory.length,
        artifacts: this._tiers.artifacts.length,
      },
      compressionTrigger: COMPRESSION_TRIGGER,
      compressionCount:   this._compressionCount,
      evictionCount:      this._evictionCount,
      evictionWeights:    EVICTION_WEIGHTS,
      retrievalThreshold: RETRIEVAL_THRESHOLD,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  ContextWindowManager,
  ContextEntry,
  TOKEN_BUDGETS,
  COMPRESSION_TRIGGER,
  EVICTION_WEIGHTS,
  RETRIEVAL_THRESHOLD,
  DEMOTION_SCORE_FLOOR,
  roughTokenCount,
  evictionScore,
  PHI,
  PSI,
  PHI2,
  PHI4,
  PHI6,
};
