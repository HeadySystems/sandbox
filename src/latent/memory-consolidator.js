/**
 * ∞ Heady™ Memory Consolidator — STM→LTM Consolidation Engine
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * @module memory-consolidator
 * @description Runs periodic STM→LTM consolidation passes over a VectorMemory
 *   instance. Scores all STM entries by I(m) = recency * frequency * relevance,
 *   promotes entries above the importance threshold to LTM, prunes expired STM
 *   via TTL, and compacts LTM by merging vectors that have cosine similarity
 *   above 0.95. Reports detailed consolidation metrics.
 */

'use strict';

const { EventEmitter } = require('events');
const { cosineSimilarity, centroid, DIMS } = require('./vector-space-ops');
const { computeImportance } = require('./vector-memory');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_IMPORTANCE_THRESHOLD = 0.6;
const COMPACTION_SIMILARITY_THRESHOLD = 0.95;
const DEFAULT_COMPACTION_ENABLED = true;

// ---------------------------------------------------------------------------
// ConsolidationReport
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ConsolidationReport
 * @property {number} runId - Monotonically increasing run counter.
 * @property {number} startedAt - Timestamp when the run began.
 * @property {number} completedAt - Timestamp when the run ended.
 * @property {number} durationMs - Wall-clock duration of this run.
 * @property {number} stmScanned - STM entries examined.
 * @property {number} promoted - STM entries promoted to LTM.
 * @property {number} prunedExpired - STM entries pruned due to TTL expiry.
 * @property {number} prunedLowImportance - STM entries pruned for low I(m) when over capacity.
 * @property {number} ltmMerged - LTM entries merged during compaction.
 * @property {number} totalRemaining - Total entries after the run.
 * @property {number} avgImportancePromoted - Average importance of promoted entries.
 * @property {string} trigger - What triggered the run ('interval', 'manual', 'pressure').
 */

// ---------------------------------------------------------------------------
// MemoryConsolidator
// ---------------------------------------------------------------------------

/**
 * MemoryConsolidator runs scheduled and on-demand consolidation passes.
 *
 * @extends EventEmitter
 *
 * @fires MemoryConsolidator#consolidation-start
 * @fires MemoryConsolidator#consolidation-complete
 * @fires MemoryConsolidator#compaction-start
 * @fires MemoryConsolidator#compaction-complete
 */
class MemoryConsolidator extends EventEmitter {
  /**
   * @param {Object} options
   * @param {Object} options.memory - VectorMemory instance to consolidate.
   * @param {number} [options.intervalMs=300000] - Consolidation interval.
   * @param {number} [options.importanceThreshold=0.6] - Promotion threshold.
   * @param {boolean} [options.compactionEnabled=true] - Enable LTM compaction.
   * @param {number} [options.compactionSimilarityThreshold=0.95] - Merge threshold.
   * @param {boolean} [options.autoStart=false] - Start immediately.
   * @param {number} [options.maxStmRetention] - Max STM entries to keep after pruning.
   */
  constructor(options) {
    super();
    if (!options.memory) throw new Error('MemoryConsolidator: memory is required');
    this.memory = options.memory;
    this.intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
    this.importanceThreshold = options.importanceThreshold || DEFAULT_IMPORTANCE_THRESHOLD;
    this.compactionEnabled = options.compactionEnabled !== false ? DEFAULT_COMPACTION_ENABLED : false;
    this.compactionSimilarityThreshold = options.compactionSimilarityThreshold || COMPACTION_SIMILARITY_THRESHOLD;
    this.maxStmRetention = options.maxStmRetention || null;

    this._timer = null;
    this._runId = 0;
    this._running = false;
    this._reports = []; // Last 50 reports.

    this._cumulativeStats = {
      totalRuns: 0,
      totalPromoted: 0,
      totalPruned: 0,
      totalMerged: 0,
    };

    if (options.autoStart) this.start();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start the automatic consolidation timer.
   */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.run('interval'), this.intervalMs);
    if (this._timer.unref) this._timer.unref();
    // Run an initial pass on start.
    this.run('interval');
  }

  /**
   * Stop the automatic consolidation timer.
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Consolidation
  // -------------------------------------------------------------------------

  /**
   * Run a full consolidation pass (can be called manually).
   *
   * @param {'interval'|'manual'|'pressure'} [trigger='manual'] - Trigger reason.
   * @returns {ConsolidationReport}
   *
   * @fires MemoryConsolidator#consolidation-start
   * @fires MemoryConsolidator#consolidation-complete
   */
  run(trigger = 'manual') {
    if (this._running) {
      return null; // Skip if already running.
    }
    this._running = true;
    this._runId += 1;
    const runId = this._runId;
    const startedAt = Date.now();

    this.emit('consolidation-start', { runId, trigger, startedAt });

    const report = {
      runId,
      startedAt,
      completedAt: 0,
      durationMs: 0,
      stmScanned: 0,
      promoted: 0,
      prunedExpired: 0,
      prunedLowImportance: 0,
      ltmMerged: 0,
      totalRemaining: 0,
      avgImportancePromoted: 0,
      trigger,
    };

    try {
      // Phase 1: Score all STM entries.
      const stmEntries = this._collectStm();
      report.stmScanned = stmEntries.length;

      const now = Date.now();
      const maxFreq = stmEntries.reduce((m, e) => Math.max(m, e.accessCount), 1);

      const scored = stmEntries.map(entry => ({
        entry,
        importance: computeImportance(entry, now, maxFreq),
      }));

      // Phase 2: Prune expired STM.
      const expiredKeys = [];
      for (const { entry } of scored) {
        if (entry.ttl > 0 && now - entry.createdAt > entry.ttl) {
          expiredKeys.push(entry.key);
        }
      }
      for (const key of expiredKeys) {
        this.memory.forget(key);
        report.prunedExpired += 1;
      }

      // Remove expired from scored list.
      const expiredSet = new Set(expiredKeys);
      const activeScored = scored.filter(s => !expiredSet.has(s.entry.key));

      // Phase 3: Promote high-importance STM to LTM.
      const importanceSumPromoted = [];
      for (const { entry, importance } of activeScored) {
        if (importance >= this.importanceThreshold) {
          entry.tier = 'ltm';
          entry.ttl = 0;
          entry.importance = importance;
          report.promoted += 1;
          importanceSumPromoted.push(importance);
        }
      }
      report.avgImportancePromoted = importanceSumPromoted.length > 0
        ? importanceSumPromoted.reduce((a, b) => a + b, 0) / importanceSumPromoted.length
        : 0;

      // Phase 4: Capacity pruning (if maxStmRetention set).
      if (this.maxStmRetention !== null) {
        const remainingStm = activeScored
          .filter(s => s.entry.tier === 'stm')
          .sort((a, b) => b.importance - a.importance);
        if (remainingStm.length > this.maxStmRetention) {
          const toPrune = remainingStm.slice(this.maxStmRetention);
          for (const { entry } of toPrune) {
            this.memory.forget(entry.key);
            report.prunedLowImportance += 1;
          }
        }
      }

      // Phase 5: LTM compaction.
      if (this.compactionEnabled) {
        report.ltmMerged = this._compactLtm();
      }

      // Update cumulative stats.
      this._cumulativeStats.totalRuns += 1;
      this._cumulativeStats.totalPromoted += report.promoted;
      this._cumulativeStats.totalPruned += report.prunedExpired + report.prunedLowImportance;
      this._cumulativeStats.totalMerged += report.ltmMerged;

      report.totalRemaining = this.memory.keyIndex.size;
    } finally {
      report.completedAt = Date.now();
      report.durationMs = report.completedAt - report.startedAt;
      this._running = false;

      // Store last 50 reports.
      this._reports.push(report);
      if (this._reports.length > 50) this._reports.shift();

      /**
       * @event MemoryConsolidator#consolidation-complete
       * @type {ConsolidationReport}
       */
      this.emit('consolidation-complete', report);
    }

    return report;
  }

  // -------------------------------------------------------------------------
  // LTM Compaction
  // -------------------------------------------------------------------------

  /**
   * Compact LTM by merging near-duplicate entries (cosine > threshold).
   * Merging: the two vectors are replaced by their normalised centroid,
   * metadata is merged, and access counts are summed. The source key is deleted.
   *
   * @param {number} [threshold] - Similarity threshold override.
   * @returns {number} Number of LTM entries merged.
   *
   * @fires MemoryConsolidator#compaction-start
   * @fires MemoryConsolidator#compaction-complete
   */
  _compactLtm(threshold) {
    const simThreshold = threshold || this.compactionSimilarityThreshold;
    this.emit('compaction-start', { threshold: simThreshold, timestamp: Date.now() });

    // Collect all LTM entries.
    const ltmEntries = [];
    for (const shard of this.memory.shards) {
      for (const [, entry] of shard) {
        if (entry.tier === 'ltm') ltmEntries.push(entry);
      }
    }

    const merged = new Set(); // Keys that have been absorbed.
    let mergeCount = 0;

    for (let i = 0; i < ltmEntries.length; i++) {
      const a = ltmEntries[i];
      if (merged.has(a.key)) continue;

      for (let j = i + 1; j < ltmEntries.length; j++) {
        const b = ltmEntries[j];
        if (merged.has(b.key)) continue;

        const similarity = cosineSimilarity(a.vector, b.vector);
        if (similarity >= simThreshold) {
          // Merge b into a.
          // New vector = normalised centroid.
          const merged_vec = centroid([a.vector, b.vector]);
          // Normalise.
          const mag = Math.sqrt(merged_vec.reduce((s, v) => s + v * v, 0));
          if (mag > 0) {
            for (let k = 0; k < DIMS; k++) merged_vec[k] /= mag;
          }
          a.vector = merged_vec;
          // Merge metadata.
          a.metadata = { ...b.metadata, ...a.metadata };
          // Sum access counts.
          a.accessCount += b.accessCount;
          a.lastAccessed = Math.max(a.lastAccessed, b.lastAccessed);
          // Forget the absorbed entry.
          this.memory.forget(b.key);
          merged.add(b.key);
          mergeCount += 1;
        }
      }
    }

    this.emit('compaction-complete', { merged: mergeCount, timestamp: Date.now() });
    return mergeCount;
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  /**
   * Return the most recent consolidation report.
   * @returns {ConsolidationReport|null}
   */
  getLastReport() {
    return this._reports[this._reports.length - 1] || null;
  }

  /**
   * Return all stored consolidation reports (up to last 50).
   * @returns {ConsolidationReport[]}
   */
  getReports() {
    return [...this._reports];
  }

  /**
   * Return cumulative consolidation statistics.
   * @returns {Object}
   */
  stats() {
    return {
      ...this._cumulativeStats,
      intervalMs: this.intervalMs,
      importanceThreshold: this.importanceThreshold,
      compactionEnabled: this.compactionEnabled,
      running: this._running,
      lastRunAt: this.getLastReport()?.completedAt || null,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Collect all STM entries from the memory store.
   * @private
   * @returns {Object[]}
   */
  _collectStm() {
    const stm = [];
    for (const shard of this.memory.shards) {
      for (const [, entry] of shard) {
        if (entry.tier === 'stm') stm.push(entry);
      }
    }
    return stm;
  }
}


module.exports = { MemoryConsolidator, COMPACTION_SIMILARITY_THRESHOLD, DEFAULT_INTERVAL_MS };
