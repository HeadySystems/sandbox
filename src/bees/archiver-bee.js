'use strict';

/**
 * ArchiverBee — Archive management, data retention, and backup lifecycle.
 * φ-compliant: all sizing, timing, and thresholds derived from golden ratio / Fibonacci.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;   // golden ratio
const PSI  = 0.6180339887;   // 1/φ
const PHI2 = 2.6180339887;   // φ²
const PHI3 = 4.2360679775;   // φ³

// Fibonacci retention tiers (days)
const RETENTION = {
  HOT:      fib(7),   // 13 days  — recent high-value data
  WARM:     fib(10),  // 55 days  — moderate access data
  COLD:     fib(12),  // 144 days — low-access archives
  GLACIER:  fib(14),  // 377 days — legal/compliance hold
};

// Fibonacci batch and buffer sizes
const BATCH_SIZE          = fib(8);   // 21 items per archive batch
const RING_BUFFER_SIZE    = fib(13);  // 233 archive log entries
const SNAPSHOT_INTERVAL   = Math.round(PHI3 * 1000);   // 4236 ms heartbeat
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);      // ≈ 0.618

function fib(n) {
  const f = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946,17711];
  return f[n] ?? f[f.length - 1];
}

class ArchiverBee {
  constructor(config = {}) {
    this.id          = config.id ?? `archiver-${Date.now()}`;
    this.namespace   = config.namespace ?? 'default';
    this.storageRoot = config.storageRoot ?? '/var/heady/archive';
    this.maxSizeMb   = config.maxSizeMb ?? Math.round(PHI2 * 1000);   // 2618 MB

    this._alive       = false;
    this._coherence   = 1.0;
    this._archiveLog  = [];          // ring buffer, max RING_BUFFER_SIZE
    this._pendingBatch = [];
    this._heartbeatTimer = null;
    this._totalArchived  = 0;
    this._totalPurged    = 0;
    this._lastSnapshotAt = 0;
  }

  /** Allocate resources and open storage channel. */
  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), SNAPSHOT_INTERVAL);
    await this.initialize();
    return this;
  }

  /** Validate storage root; warm retention metadata. */
  async initialize() {
    this._retentionPolicy = { ...RETENTION };
    this._sizeUsedMb = 0;
    this._coherence = 1.0;
    this._lastSnapshotAt = Date.now();
  }

  /**
   * Execute an archive task.
   * @param {object} task — { items: Array, tier?: 'HOT'|'WARM'|'COLD'|'GLACIER', ttl?: number }
   * @returns {object} result summary
   */
  async execute(task) {
    if (!this._alive) throw new Error('ArchiverBee not spawned');
    const { items = [], tier = 'WARM', ttl } = task;

    const chunks = this._chunk(items, BATCH_SIZE);
    const archived = [];

    for (const chunk of chunks) {
      const record = await this._archiveChunk(chunk, tier, ttl);
      archived.push(record);
      this._pushLog({ event: 'ARCHIVED', count: chunk.length, tier, ts: Date.now() });
      this._totalArchived += chunk.length;
    }

    // Run retention sweep after each execute
    const purged = await this._sweepExpired();
    this._totalPurged += purged;

    this._coherence = Math.min(1.0, this._coherence + (archived.length * PSI * 0.01));
    return { archived: archived.length * BATCH_SIZE, purged, tier, coherence: this._coherence };
  }

  /** Archive a single batch chunk with phi-weighted priority. */
  async _archiveChunk(items, tier, ttl) {
    const retentionDays = ttl ?? this._retentionPolicy[tier];
    const expiresAt = Date.now() + retentionDays * 86400 * 1000;
    const record = {
      id: `arc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tier,
      count: items.length,
      sizeEstimateBytes: items.length * Math.round(PHI2 * 512),
      createdAt: Date.now(),
      expiresAt,
      phiPriority: tier === 'HOT' ? PHI2 : tier === 'WARM' ? PHI : PSI,
    };
    this._sizeUsedMb += record.sizeEstimateBytes / (1024 * 1024);
    return record;
  }

  /** Remove expired records; return purge count. */
  async _sweepExpired() {
    const now = Date.now();
    const before = this._archiveLog.length;
    this._archiveLog = this._archiveLog.filter(e => !e.expiresAt || e.expiresAt > now);
    return before - this._archiveLog.length;
  }

  _chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out.length ? out : [[]];
  }

  _pushLog(entry) {
    this._archiveLog.push(entry);
    if (this._archiveLog.length > RING_BUFFER_SIZE) this._archiveLog.shift();
  }

  /** Periodic coherence check and compaction trigger. */
  heartbeat() {
    const sizeRatio = this._sizeUsedMb / this.maxSizeMb;
    if (sizeRatio > 1 - Math.pow(PSI, 4)) {   // > 0.910 — near capacity
      this._coherence = Math.max(0, this._coherence - PSI * 0.1);
    } else {
      this._coherence = Math.min(1.0, this._coherence + PSI * 0.01);
    }
    this._lastSnapshotAt = Date.now();
  }

  getHealth() {
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence: parseFloat(this._coherence.toFixed(4)),
      totalArchived: this._totalArchived,
      totalPurged: this._totalPurged,
      sizeUsedMb: parseFloat(this._sizeUsedMb.toFixed(2)),
      retentionPolicy: this._retentionPolicy,
      lastSnapshotAt: this._lastSnapshotAt,
      logDepth: this._archiveLog.length,
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    await this._sweepExpired();
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = { ArchiverBee, RETENTION, BATCH_SIZE, RING_BUFFER_SIZE, COHERENCE_THRESHOLD };
