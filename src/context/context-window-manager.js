/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Context Window Manager — src/context/context-window-manager.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Manages limited context windows across multi-agent systems with:
 * - Tiered context: working / session / memory / artifacts
 * - Automatic compression via LLM summarization
 * - Context capsules for inter-agent transfer
 * - Priority-based eviction with phi-weighted scoring
 * - Token budget tracking per tier
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const {
  PHI, PSI, fib, phiTokenBudgets,
  EVICTION_WEIGHTS, phiFusionWeights, CSL_THRESHOLDS,
} = require('../../shared/phi-math');

class ContextWindowManager {
  /**
   * @param {object} [opts]
   * @param {number} [opts.baseTokens] - Base token budget (default 8192)
   * @param {Function} [opts.tokenCounter] - (text) → number (estimate tokens)
   * @param {Function} [opts.summarizer] - async (text) → compressed text
   * @param {Function} [opts.logger]
   */
  constructor(opts = {}) {
    const budgets = phiTokenBudgets(opts.baseTokens || 8192);
    this.tokenCounter = opts.tokenCounter || estimateTokens;
    this.summarizer = opts.summarizer || null;
    this.logger = opts.logger || console;

    this.tiers = {
      working: {
        budget: budgets.working,        // 8192
        entries: [],
        usedTokens: 0,
      },
      session: {
        budget: budgets.session,         // ~21450
        entries: [],
        usedTokens: 0,
      },
      memory: {
        budget: budgets.memory,          // ~56131
        entries: [],
        usedTokens: 0,
      },
      artifacts: {
        budget: budgets.artifacts,       // ~146920
        entries: [],
        usedTokens: 0,
      },
    };
  }

  /**
   * Add content to a context tier.
   * @param {string} tier - 'working' | 'session' | 'memory' | 'artifacts'
   * @param {object} entry
   * @param {string} entry.id
   * @param {string} entry.content
   * @param {number} [entry.importance=0.5]
   * @param {string} [entry.type] - 'message' | 'tool_result' | 'system' | 'artifact'
   * @returns {{ added: boolean, evicted: string[] }}
   */
  add(tier, entry) {
    const t = this.tiers[tier];
    if (!t) throw new Error(`Unknown tier: ${tier}`);

    const tokens = this.tokenCounter(entry.content);
    const evicted = [];

    // Evict until we have room
    while (t.usedTokens + tokens > t.budget && t.entries.length > 0) {
      const victim = this._selectVictim(t);
      if (!victim) break;
      t.usedTokens -= victim.tokens;
      t.entries = t.entries.filter(e => e.id !== victim.id);
      evicted.push(victim.id);
    }

    if (t.usedTokens + tokens > t.budget) {
      return { added: false, evicted, reason: 'Insufficient budget after eviction' };
    }

    t.entries.push({
      id: entry.id,
      content: entry.content,
      importance: entry.importance || 0.5,
      type: entry.type || 'message',
      tokens,
      addedAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    });
    t.usedTokens += tokens;

    return { added: true, evicted };
  }

  /**
   * Get content from a tier by ID.
   * @param {string} tier
   * @param {string} id
   * @returns {object|null}
   */
  get(tier, id) {
    const t = this.tiers[tier];
    if (!t) return null;
    const entry = t.entries.find(e => e.id === id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
    }
    return entry || null;
  }

  /**
   * Compress a tier using LLM summarization.
   * Replaces older entries with their summary.
   * @param {string} tier
   * @param {number} [targetRatio=PSI] - Target compression ratio
   */
  async compress(tier, targetRatio = PSI) {
    if (!this.summarizer) {
      this.logger.warn?.('[ContextWindowManager] No summarizer configured');
      return;
    }

    const t = this.tiers[tier];
    if (!t || t.entries.length < 2) return;

    const targetTokens = Math.floor(t.budget * targetRatio);
    if (t.usedTokens <= targetTokens) return;

    // Sort by importance (ascending) — compress least important first
    const sorted = [...t.entries].sort((a, b) => a.importance - b.importance);
    const toCompress = [];
    let tokensToFree = t.usedTokens - targetTokens;

    for (const entry of sorted) {
      if (tokensToFree <= 0) break;
      toCompress.push(entry);
      tokensToFree -= entry.tokens;
    }

    if (toCompress.length === 0) return;

    // Summarize
    const combinedText = toCompress.map(e => e.content).join('\n---\n');
    const summary = await this.summarizer(combinedText);
    const summaryTokens = this.tokenCounter(summary);

    // Remove compressed entries
    const compressedIds = new Set(toCompress.map(e => e.id));
    const freedTokens = toCompress.reduce((sum, e) => sum + e.tokens, 0);
    t.entries = t.entries.filter(e => !compressedIds.has(e.id));
    t.usedTokens -= freedTokens;

    // Add summary
    this.add(tier, {
      id: `summary-${Date.now()}`,
      content: summary,
      importance: CSL_THRESHOLDS.HIGH,
      type: 'summary',
    });

    this.logger.info?.(`[ContextWindowManager] Compressed ${tier}: ${toCompress.length} entries → summary (${freedTokens} → ${summaryTokens} tokens)`);
  }

  /**
   * Create a context capsule for inter-agent transfer.
   * Packages essential context into a portable format.
   * @param {string[]} [tiers=['working', 'session']]
   * @param {number} [maxTokens=4096]
   * @returns {object} Capsule { entries, totalTokens, createdAt }
   */
  createCapsule(tiers = ['working', 'session'], maxTokens = 4096) {
    const entries = [];
    let totalTokens = 0;

    for (const tierName of tiers) {
      const t = this.tiers[tierName];
      if (!t) continue;

      // Sort by importance (descending) — most important first
      const sorted = [...t.entries].sort((a, b) => b.importance - a.importance);

      for (const entry of sorted) {
        if (totalTokens + entry.tokens > maxTokens) break;
        entries.push({
          id: entry.id,
          content: entry.content,
          importance: entry.importance,
          type: entry.type,
          tier: tierName,
        });
        totalTokens += entry.tokens;
      }
    }

    return {
      entries,
      totalTokens,
      createdAt: new Date().toISOString(),
      tierSources: tiers,
    };
  }

  /**
   * Load a context capsule into this manager.
   * @param {object} capsule
   * @param {string} [targetTier='working']
   */
  loadCapsule(capsule, targetTier = 'working') {
    for (const entry of capsule.entries) {
      this.add(targetTier, entry);
    }
  }

  // ─── Eviction ──────────────────────────────────────────────────────────────

  /**
   * Select victim for eviction using phi-weighted scoring.
   * Lowest score = first to evict.
   */
  _selectVictim(tier) {
    if (tier.entries.length === 0) return null;

    const now = Date.now();
    const maxAge = Math.max(1, ...tier.entries.map(e => now - e.addedAt));
    const maxAccess = Math.max(1, ...tier.entries.map(e => e.accessCount));

    let lowestEntry = null;
    let lowestScore = Infinity;

    for (const entry of tier.entries) {
      const recency = 1 - ((now - entry.lastAccessedAt) / maxAge);
      const frequency = entry.accessCount / maxAccess;
      const importance = entry.importance;

      const score =
        importance * EVICTION_WEIGHTS.importance +
        Math.max(0, recency) * EVICTION_WEIGHTS.recency +
        frequency * EVICTION_WEIGHTS.relevance;

      if (score < lowestScore) {
        lowestScore = score;
        lowestEntry = entry;
      }
    }

    return lowestEntry;
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  status() {
    const result = {};
    for (const [name, tier] of Object.entries(this.tiers)) {
      result[name] = {
        budget: tier.budget,
        used: tier.usedTokens,
        utilization: (tier.usedTokens / tier.budget).toFixed(3),
        entries: tier.entries.length,
      };
    }
    return result;
  }
}

/**
 * Simple token estimator (~4 chars per token).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

module.exports = { ContextWindowManager, estimateTokens };
