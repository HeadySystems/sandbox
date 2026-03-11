'use strict';

/**
 * WisdomCuratorBee — wisdom.json management, pattern scoring, anti-regression enforcement.
 * Maintains a phi-ranked store of learned insights, prevents high-regression patterns from recurring.
 * © 2026-2026 HeadySystems Inc.
 */

const fs   = require('fs');
const path = require('path');

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;

const WISDOM_STORE_MAX   = 377;   // fib(14) — maximum wisdom entries
const PATTERN_STORE_MAX  = 144;   // fib(12) — anti-regression pattern store
const HEARTBEAT_MS       = Math.round(PHI3 * 1000);   // 4236 ms
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);     // ≈ 0.618
const PROMOTION_THRESHOLD = 1 - Math.pow(PSI, 3);     // ≈ 0.854 — pattern promoted to permanent
const DECAY_RATE          = 1 - PSI;                  // ≈ 0.382 — score decay per non-use cycle
const REGRESSION_FLOOR    = PSI;                      // ≈ 0.618 — below this triggers regression alert

class WisdomCuratorBee {
  constructor(config = {}) {
    this.id        = config.id ?? `wisdom-${Date.now()}`;
    this.storeFile = config.storeFile ?? null;   // path to wisdom.json if persisting to disk

    this._alive             = false;
    this._coherence         = 1.0;
    this._wisdomStore       = [];
    this._patternStore      = [];
    this._regressionAlerts  = 0;
    this._totalLearned      = 0;
    this._promotionCount    = 0;
    this._heartbeatTimer    = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._wisdomStore      = [];
    this._patternStore     = [];
    this._regressionAlerts = 0;
    this._totalLearned     = 0;
    this._promotionCount   = 0;
    this._coherence        = 1.0;
    // Load persisted wisdom if file exists
    if (this.storeFile) await this._loadFromDisk();
  }

  /**
   * Execute a wisdom operation.
   * @param {object} task — {
   *   op: 'LEARN'|'QUERY'|'ANTI_REGRESS'|'PROMOTE'|'DECAY'|'EXPORT',
   *   ...payload
   * }
   */
  async execute(task) {
    if (!this._alive) throw new Error('WisdomCuratorBee not spawned');
    switch (task.op) {
      case 'LEARN':        return this._learn(task);
      case 'QUERY':        return this._query(task);
      case 'ANTI_REGRESS': return this._antiRegress(task);
      case 'PROMOTE':      return this._promote(task);
      case 'DECAY':        return this._runDecay();
      case 'EXPORT':       return this._export();
      default: throw new Error(`Unknown wisdom op: ${task.op}`);
    }
  }

  /** Learn a new insight from an experience. */
  _learn({ insight, category = 'GENERAL', score = PSI, source = 'UNKNOWN', tags = [] }) {
    const existing = this._wisdomStore.find(w => this._similarity(w.insight, insight) > 0.854);
    if (existing) {
      // Reinforce existing wisdom using phi-blend
      existing.score = Math.min(1.0, existing.score * PSI + score * (1 - PSI) + 0.034);
      existing.reinforced = (existing.reinforced ?? 0) + 1;
      existing.lastSeenAt = Date.now();
      this._totalLearned++;
      return { op: 'REINFORCED', id: existing.id, score: existing.score };
    }

    const entry = {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      insight: insight.slice(0, 610),   // fib(15) chars max
      category,
      score: Math.min(1.0, Math.max(0, score)),
      source,
      tags,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      reinforced: 0,
      permanent: false,
    };

    this._wisdomStore.push(entry);
    this._totalLearned++;

    // Evict lowest-score entries if over capacity
    if (this._wisdomStore.length > WISDOM_STORE_MAX) {
      this._wisdomStore.sort((a, b) => a.score - b.score);
      const evicted = this._wisdomStore.shift();
      if (evicted.score < REGRESSION_FLOOR) this._addPattern(evicted);
    }

    this._updateCoherence();
    return { op: 'LEARNED', id: entry.id, score: entry.score };
  }

  /** Query wisdom store by category or keyword. */
  _query({ category, keyword, topK = 8 }) {
    let results = [...this._wisdomStore];
    if (category) results = results.filter(w => w.category === category);
    if (keyword)  results = results.filter(w => w.insight.toLowerCase().includes(keyword.toLowerCase()));
    results.sort((a, b) => b.score - a.score);
    return { results: results.slice(0, topK), total: results.length };
  }

  /** Check if a proposed action matches a known regression pattern. */
  _antiRegress({ description, category }) {
    const matches = this._patternStore.filter(p => {
      const catMatch = !category || p.category === category;
      const sim = this._similarity(p.pattern, description);
      return catMatch && sim > REGRESSION_FLOOR;
    });

    if (matches.length > 0) {
      this._regressionAlerts++;
      return {
        isRegression: true,
        matchCount: matches.length,
        topMatch: matches[0],
        recommendation: `Avoid pattern "${matches[0].pattern.slice(0, 89)}". Previously caused degradation.`,
      };
    }
    return { isRegression: false };
  }

  /** Promote high-score wisdom to permanent. */
  _promote({ id }) {
    const entry = this._wisdomStore.find(w => w.id === id);
    if (!entry) return { promoted: false, reason: 'Not found' };
    if (entry.score < PROMOTION_THRESHOLD) {
      return { promoted: false, reason: `Score ${entry.score.toFixed(3)} < threshold ${PROMOTION_THRESHOLD.toFixed(3)}` };
    }
    entry.permanent = true;
    this._promotionCount++;
    return { promoted: true, id: entry.id, score: entry.score };
  }

  /** Decay non-reinforced entries by DECAY_RATE per cycle. */
  _runDecay() {
    let decayed = 0;
    for (const entry of this._wisdomStore) {
      if (entry.permanent) continue;
      const ageDays = (Date.now() - entry.lastSeenAt) / 86400000;
      if (ageDays > 1) {
        entry.score = Math.max(0, entry.score - DECAY_RATE * Math.log1p(ageDays));
        decayed++;
      }
    }
    // Prune entries that have decayed to near-zero
    const before = this._wisdomStore.length;
    this._wisdomStore = this._wisdomStore.filter(w => w.permanent || w.score > 0.034);
    return { decayed, pruned: before - this._wisdomStore.length };
  }

  _export() {
    return {
      version: '3.2.3',
      generatedAt: Date.now(),
      phiCompliance: '100%',
      entries: this._wisdomStore,
      patterns: this._patternStore,
      stats: {
        totalLearned: this._totalLearned,
        regressionAlerts: this._regressionAlerts,
        promotionCount: this._promotionCount,
      },
    };
  }

  _addPattern(entry) {
    const pat = { pattern: entry.insight, category: entry.category, score: entry.score, ts: Date.now() };
    this._patternStore.push(pat);
    if (this._patternStore.length > PATTERN_STORE_MAX) this._patternStore.shift();
  }

  /** Lightweight Jaccard-like similarity for dedup. */
  _similarity(a, b) {
    if (!a || !b) return 0;
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...setA].filter(w => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
  }

  _updateCoherence() {
    const n = this._wisdomStore.length;
    if (n === 0) { this._coherence = 1.0; return; }
    const avgScore = this._wisdomStore.reduce((s, w) => s + w.score, 0) / n;
    this._coherence = Math.min(1.0, avgScore * PHI);
  }

  async _loadFromDisk() {
    try {
      if (fs.existsSync(this.storeFile)) {
        const raw = JSON.parse(fs.readFileSync(this.storeFile, 'utf8'));
        this._wisdomStore  = (raw.entries  ?? []).slice(0, WISDOM_STORE_MAX);
        this._patternStore = (raw.patterns ?? []).slice(0, PATTERN_STORE_MAX);
      }
    } catch {
      // Corrupt file — start fresh
      this._wisdomStore = [];
    }
  }

  async _saveToDisk() {
    if (!this.storeFile) return;
    try {
      fs.writeFileSync(this.storeFile, JSON.stringify(this._export(), null, 2), 'utf8');
    } catch { /* noop */ }
  }

  heartbeat() {
    this._updateCoherence();
    this._runDecay();
    if (this.storeFile) this._saveToDisk();
  }

  getHealth() {
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence:       parseFloat(this._coherence.toFixed(4)),
      wisdomCount:     this._wisdomStore.length,
      patternCount:    this._patternStore.length,
      permanentCount:  this._wisdomStore.filter(w => w.permanent).length,
      totalLearned:    this._totalLearned,
      promotionCount:  this._promotionCount,
      regressionAlerts: this._regressionAlerts,
      storeCapacity:   WISDOM_STORE_MAX,
      promotionThreshold: PROMOTION_THRESHOLD,
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    await this._saveToDisk();
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = {
  WisdomCuratorBee,
  WISDOM_STORE_MAX,
  PATTERN_STORE_MAX,
  PROMOTION_THRESHOLD,
  REGRESSION_FLOOR,
  COHERENCE_THRESHOLD,
};
