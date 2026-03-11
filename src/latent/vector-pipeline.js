/**
 * ∞ Heady™ Vector Pipeline — Staged Processing Pipeline for Vector Operations
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * @module vector-pipeline
 * @description A staged, back-pressure-aware pipeline for ingesting raw text
 *   into the Heady™ vector memory system. Stages:
 *     embed → normalize → shard → store → index → acknowledge
 *   Each stage can be individually monitored. Back-pressure pauses the intake
 *   queue when any internal stage is saturated. Batch processing reduces
 *   per-item overhead for high-throughput workloads.
 */

'use strict';

const { EventEmitter } = require('events');
const { normalize, fibonacciShardIndex, isValidVector, DIMS } = require('./vector-space-ops');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 32;
const DEFAULT_MAX_QUEUE = 256;
const DEFAULT_FLUSH_INTERVAL_MS = 100;
const STAGE_NAMES = ['embed', 'normalize', 'shard', 'store', 'index', 'acknowledge'];

// ---------------------------------------------------------------------------
// Stage helpers
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PipelineItem
 * @property {string} id - Unique item ID.
 * @property {string} text - Raw input text.
 * @property {string} key - Memory key.
 * @property {Object} metadata - Metadata payload.
 * @property {'stm'|'ltm'} tier - Memory tier.
 * @property {Float32Array|null} vector - Assigned after embed stage.
 * @property {number} shardIndex - Assigned after shard stage.
 * @property {number} enqueuedAt - Timestamp when item entered the pipeline.
 * @property {Object} stageTimes - Per-stage latency tracking.
 * @property {Function} resolve - Promise resolver for acknowledgement.
 * @property {Function} reject - Promise rejecter for error paths.
 */

// ---------------------------------------------------------------------------
// StageMetrics
// ---------------------------------------------------------------------------

/**
 * Tracks throughput and latency statistics for a single pipeline stage.
 */
class StageMetrics {
  constructor(name) {
    this.name = name;
    this.processed = 0;
    this.errors = 0;
    this.totalLatencyMs = 0;
    this.minLatencyMs = Infinity;
    this.maxLatencyMs = 0;
    this._batchCount = 0;
  }

  /**
   * Record a completed batch.
   * @param {number} count - Items processed.
   * @param {number} latencyMs - Wall-clock time for the batch.
   */
  record(count, latencyMs) {
    this.processed += count;
    this.totalLatencyMs += latencyMs;
    this._batchCount += 1;
    if (latencyMs < this.minLatencyMs) this.minLatencyMs = latencyMs;
    if (latencyMs > this.maxLatencyMs) this.maxLatencyMs = latencyMs;
  }

  recordError(count = 1) {
    this.errors += count;
  }

  /** @returns {Object} Snapshot */
  snapshot() {
    const avgBatchLatency = this._batchCount > 0
      ? this.totalLatencyMs / this._batchCount
      : 0;
    const avgItemLatency = this.processed > 0
      ? this.totalLatencyMs / this.processed
      : 0;
    return {
      name: this.name,
      processed: this.processed,
      errors: this.errors,
      avgBatchLatencyMs: avgBatchLatency,
      avgItemLatencyMs: avgItemLatency,
      minLatencyMs: this.minLatencyMs === Infinity ? 0 : this.minLatencyMs,
      maxLatencyMs: this.maxLatencyMs,
      batchCount: this._batchCount,
    };
  }
}

// ---------------------------------------------------------------------------
// VectorPipeline
// ---------------------------------------------------------------------------

/**
 * VectorPipeline processes items through the embed→normalize→shard→store→
 * index→acknowledge pipeline stages with configurable batch sizes and
 * back-pressure management.
 *
 * Usage:
 * ```js
 * const pipeline = new VectorPipeline({ memory, embedProvider });
 * pipeline.start();
 * await pipeline.enqueue({ key: 'memory:1', text: 'Hello Heady™', metadata: {} });
 * ```
 *
 * @extends EventEmitter
 *
 * @fires VectorPipeline#batch-complete
 * @fires VectorPipeline#back-pressure
 * @fires VectorPipeline#drain
 * @fires VectorPipeline#error
 */
class VectorPipeline extends EventEmitter {
  /**
   * @param {Object} options
   * @param {Object} options.memory - VectorMemory (or FederatedMemory) instance.
   * @param {Object} options.embedProvider - EmbeddingProvider instance.
   * @param {number} [options.batchSize=32] - Items per processing batch.
   * @param {number} [options.maxQueue=256] - Maximum intake queue depth.
   * @param {number} [options.flushIntervalMs=100] - Auto-flush interval.
   * @param {boolean} [options.autoStart=false] - Start processing immediately.
   * @param {Function} [options.onAcknowledge] - Called with each acked item.
   */
  constructor(options) {
    super();
    if (!options.memory) throw new Error('VectorPipeline: memory is required');
    if (!options.embedProvider) throw new Error('VectorPipeline: embedProvider is required');

    this.memory = options.memory;
    this.embedProvider = options.embedProvider;
    this.batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    this.maxQueue = options.maxQueue || DEFAULT_MAX_QUEUE;
    this.flushIntervalMs = options.flushIntervalMs || DEFAULT_FLUSH_INTERVAL_MS;
    this.onAcknowledge = options.onAcknowledge || null;

    /** @type {PipelineItem[]} */
    this._queue = [];
    this._running = false;
    this._flushTimer = null;
    this._processing = false;

    // Per-stage metrics.
    this.metrics = {};
    for (const name of STAGE_NAMES) {
      this.metrics[name] = new StageMetrics(name);
    }

    this._pipelineMetrics = {
      totalEnqueued: 0,
      totalAcknowledged: 0,
      totalFailed: 0,
      backPressureEvents: 0,
      drainEvents: 0,
    };

    if (options.autoStart) this.start();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Start the processing loop. */
  start() {
    if (this._running) return;
    this._running = true;
    this._flushTimer = setInterval(() => this._flush(), this.flushIntervalMs);
    if (this._flushTimer.unref) this._flushTimer.unref();
  }

  /** Stop the processing loop and flush remaining items. */
  async stop() {
    this._running = false;
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    // Drain remaining items.
    if (this._queue.length > 0) {
      await this._flush();
    }
  }

  // -------------------------------------------------------------------------
  // Intake
  // -------------------------------------------------------------------------

  /**
   * Enqueue a single item for processing.
   * Returns a Promise that resolves when the item is acknowledged (stored)
   * or rejects on pipeline error. Throws immediately if the queue is full
   * (back-pressure signal).
   *
   * @param {Object} item
   * @param {string} item.key - Memory key.
   * @param {string} [item.text] - Raw text for embedding.
   * @param {Float32Array} [item.vector] - Pre-computed vector (skips embed stage).
   * @param {Object} [item.metadata={}] - Metadata.
   * @param {'stm'|'ltm'} [item.tier='stm'] - Memory tier.
   * @returns {Promise<PipelineItem>}
   */
  enqueue(item) {
    if (this._queue.length >= this.maxQueue) {
      this._pipelineMetrics.backPressureEvents += 1;
      /**
       * @event VectorPipeline#back-pressure
       * @type {{ queueDepth: number, maxQueue: number }}
       */
      this.emit('back-pressure', { queueDepth: this._queue.length, maxQueue: this.maxQueue });
      return Promise.reject(new Error(`VectorPipeline: back-pressure — queue full (${this._queue.length}/${this.maxQueue})`));
    }

    return new Promise((resolve, reject) => {
      const pItem = {
        id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: item.text || '',
        key: item.key,
        metadata: item.metadata || {},
        tier: item.tier || 'stm',
        vector: item.vector instanceof Float32Array ? item.vector : null,
        shardIndex: -1,
        enqueuedAt: Date.now(),
        stageTimes: {},
        resolve,
        reject,
      };
      this._queue.push(pItem);
      this._pipelineMetrics.totalEnqueued += 1;
      // Trigger an async flush immediately so enqueue resolves without
      // waiting for the next interval tick.
      if (this._running) {
        setImmediate(() => this._flush());
      }
    });
  }

  /**
   * Enqueue multiple items as a batch.
   *
   * @param {Object[]} items - Array of items (same shape as enqueue()).
   * @returns {Promise<PipelineItem[]>} Resolves when all items are acknowledged.
   */
  async enqueueBatch(items) {
    return Promise.all(items.map(item => this.enqueue(item)));
  }

  // -------------------------------------------------------------------------
  // Processing
  // -------------------------------------------------------------------------

  /** @private */
  async _flush() {
    if (this._processing || this._queue.length === 0) return;
    this._processing = true;
    try {
      while (this._queue.length > 0) {
        const batch = this._queue.splice(0, this.batchSize);
        await this._processBatch(batch);
      }
      if (this._pipelineMetrics.totalAcknowledged > 0) {
        /**
         * @event VectorPipeline#drain
         */
        this.emit('drain', { timestamp: Date.now() });
        this._pipelineMetrics.drainEvents += 1;
      }
    } finally {
      this._processing = false;
    }
  }

  /**
   * Run a batch through all pipeline stages.
   * @private
   * @param {PipelineItem[]} batch
   */
  async _processBatch(batch) {
    // Stage 1: Embed
    await this._stageEmbed(batch);
    // Stage 2: Normalize
    this._stageNormalize(batch);
    // Stage 3: Shard assignment
    this._stageShard(batch);
    // Stage 4: Store
    await this._stageStore(batch);
    // Stage 5: Index (post-store hooks)
    this._stageIndex(batch);
    // Stage 6: Acknowledge
    this._stageAcknowledge(batch);

    /**
     * @event VectorPipeline#batch-complete
     * @type {{ batchSize: number, timestamp: number }}
     */
    this.emit('batch-complete', { batchSize: batch.length, timestamp: Date.now() });
  }

  /** @private Stage 1 — Embed raw text into 384D vectors. */
  async _stageEmbed(batch) {
    const t0 = Date.now();
    // Items that already have a vector skip embedding.
    const toEmbed = batch.filter(item => item.vector === null && item.text);
    const textsToEmbed = toEmbed.map(item => item.text);
    try {
      if (textsToEmbed.length > 0) {
        const vectors = await this.embedProvider.embedBatch(textsToEmbed);
        for (let i = 0; i < toEmbed.length; i++) {
          toEmbed[i].vector = vectors[i];
          toEmbed[i].stageTimes.embed = Date.now() - t0;
        }
      }
      this.metrics.embed.record(batch.length, Date.now() - t0);
    } catch (err) {
      this.metrics.embed.recordError(batch.length);
      for (const item of toEmbed) {
        item.reject(err);
      }
      // Remove failed items from batch.
      for (const item of toEmbed) {
        const idx = batch.indexOf(item);
        if (idx !== -1) batch.splice(idx, 1);
      }
      this._pipelineMetrics.totalFailed += toEmbed.length;
    }
  }

  /** @private Stage 2 — Normalize vectors to unit length. */
  _stageNormalize(batch) {
    const t0 = Date.now();
    for (const item of batch) {
      if (item.vector && isValidVector(item.vector, DIMS)) {
        item.vector = normalize(item.vector);
        item.stageTimes.normalize = Date.now() - t0;
      }
    }
    this.metrics.normalize.record(batch.length, Date.now() - t0);
  }

  /** @private Stage 3 — Assign shard indices. */
  _stageShard(batch) {
    const t0 = Date.now();
    const numShards = this.memory.numShards || 8;
    for (const item of batch) {
      if (item.vector) {
        item.shardIndex = fibonacciShardIndex(item.vector, numShards);
        item.stageTimes.shard = Date.now() - t0;
      }
    }
    this.metrics.shard.record(batch.length, Date.now() - t0);
  }

  /** @private Stage 4 — Write to memory. */
  async _stageStore(batch) {
    const t0 = Date.now();
    const failed = [];
    for (const item of batch) {
      if (!item.vector) {
        failed.push(item);
        continue;
      }
      try {
        this.memory.store(item.key, item.vector, {
          ...item.metadata,
          pipeline_id: item.id,
          text: item.text || undefined,
        }, item.tier);
        item.stageTimes.store = Date.now() - t0;
      } catch (err) {
        item.reject(err);
        failed.push(item);
        this._pipelineMetrics.totalFailed += 1;
      }
    }
    this.metrics.store.record(batch.length - failed.length, Date.now() - t0);
    this.metrics.store.recordError(failed.length);
    for (const item of failed) {
      const idx = batch.indexOf(item);
      if (idx !== -1) batch.splice(idx, 1);
    }
  }

  /** @private Stage 5 — Post-store indexing (extensible hook). */
  _stageIndex(batch) {
    const t0 = Date.now();
    for (const item of batch) {
      item.stageTimes.index = Date.now() - t0;
      // Emit for downstream indexers (e.g., spatial-mapper).
      this.emit('item-indexed', {
        key: item.key,
        vector: item.vector,
        metadata: item.metadata,
        tier: item.tier,
        shardIndex: item.shardIndex,
      });
    }
    this.metrics.index.record(batch.length, Date.now() - t0);
  }

  /** @private Stage 6 — Resolve promises and fire acknowledge callbacks. */
  _stageAcknowledge(batch) {
    const t0 = Date.now();
    for (const item of batch) {
      item.stageTimes.acknowledge = Date.now() - t0;
      item.stageTimes.totalMs = Date.now() - item.enqueuedAt;
      if (this.onAcknowledge) {
        try { this.onAcknowledge(item); } catch (_) { /* ignore */ }
      }
      item.resolve(item);
      this._pipelineMetrics.totalAcknowledged += 1;
    }
    this.metrics.acknowledge.record(batch.length, Date.now() - t0);
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  /**
   * Return a full metrics snapshot for the pipeline and each stage.
   *
   * @returns {Object}
   */
  getMetrics() {
    const stageSnapshots = {};
    for (const [name, sm] of Object.entries(this.metrics)) {
      stageSnapshots[name] = sm.snapshot();
    }
    return {
      pipeline: {
        ...this._pipelineMetrics,
        currentQueueDepth: this._queue.length,
        running: this._running,
      },
      stages: stageSnapshots,
    };
  }

  /**
   * Reset all stage metrics.
   */
  resetMetrics() {
    for (const name of STAGE_NAMES) {
      this.metrics[name] = new StageMetrics(name);
    }
  }
}


module.exports = { VectorPipeline, StageMetrics, STAGE_NAMES };
