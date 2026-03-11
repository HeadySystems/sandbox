/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Bee Factory — src/orchestration/bee-factory.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Dynamic worker spawning and lifecycle management. Bees are ephemeral workers
 * that execute specific tasks, report results, and self-terminate.
 *
 * Registry: tracks bee types, capabilities, and active instances.
 * Lifecycle: spawn → initialize → execute → report → terminate
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { fib, PHI, PSI, phiBackoff, phiInterval, CSL_THRESHOLDS, PHI_TIMING } = require('../../shared/phi-math');
const { BEE_LIMITS } = require('../../shared/sacred-geometry');

const BEE_STATES = Object.freeze({
  INITIALIZING: 'INITIALIZING',
  IDLE:         'IDLE',
  WORKING:      'WORKING',
  REPORTING:    'REPORTING',
  TERMINATING:  'TERMINATING',
  TERMINATED:   'TERMINATED',
  ERROR:        'ERROR',
});

class BeeFactory {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxConcurrentBees] - Max active bees (default fib(8)=21)
   * @param {number} [opts.maxQueueDepth] - Max pending spawns (default fib(13)=233)
   * @param {number} [opts.beeTimeoutMs] - Per-bee execution timeout (default fib(9)*1000=34s)
   * @param {number} [opts.maxRetries] - Retry limit per bee (default fib(5)=5)
   * @param {Function} [opts.logger]
   */
  constructor(opts = {}) {
    this.maxConcurrentBees = opts.maxConcurrentBees || BEE_LIMITS.maxConcurrentBees;
    this.maxQueueDepth     = opts.maxQueueDepth || BEE_LIMITS.maxQueueDepth;
    this.beeTimeoutMs      = opts.beeTimeoutMs || BEE_LIMITS.beeTimeoutMs;
    this.maxRetries        = opts.maxRetries || BEE_LIMITS.maxRetries;
    this.logger            = opts.logger || console;

    this._registry = new Map();  // beeType → BeeDefinition
    this._active = new Map();    // beeId → BeeInstance
    this._queue = [];            // Pending spawns
    this._counter = 0;

    // Stats
    this._stats = {
      totalSpawned: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalTerminated: 0,
    };
  }

  /**
   * Register a bee type.
   * @param {string} type - Bee type name (e.g., 'security-bee', 'documentation-bee')
   * @param {object} definition
   * @param {Function} definition.handler - async (context) → result
   * @param {string} [definition.description]
   * @param {string[]} [definition.capabilities] - Capability tags
   * @param {number} [definition.timeoutMs] - Override default timeout
   * @param {number} [definition.maxInstances] - Max concurrent instances of this type
   */
  register(type, definition) {
    if (this._registry.size >= BEE_LIMITS.registryCapacity) {
      throw new BeeError(`Registry full (max ${BEE_LIMITS.registryCapacity} types)`);
    }
    this._registry.set(type, {
      type,
      handler: definition.handler,
      description: definition.description || '',
      capabilities: definition.capabilities || [],
      timeoutMs: definition.timeoutMs || this.beeTimeoutMs,
      maxInstances: definition.maxInstances || fib(5), // 5 per type
      instanceCount: 0,
    });
  }

  /**
   * Unregister a bee type.
   * @param {string} type
   */
  unregister(type) {
    this._registry.delete(type);
  }

  /**
   * Spawn a bee instance.
   * @param {string} type - Registered bee type
   * @param {object} [context] - Task-specific context/payload
   * @param {object} [opts]
   * @param {number} [opts.priority=0] - Lower = higher priority
   * @param {string} [opts.parentBeeId] - Parent bee for hierarchical tracking
   * @returns {Promise<object>} Bee execution result
   */
  async spawn(type, context = {}, opts = {}) {
    const definition = this._registry.get(type);
    if (!definition) throw new BeeError(`Unknown bee type: ${type}`);

    // Check type instance limit
    if (definition.instanceCount >= definition.maxInstances) {
      throw new BeeError(`Max instances (${definition.maxInstances}) reached for type: ${type}`);
    }

    // Check global concurrency
    if (this._active.size >= this.maxConcurrentBees) {
      if (this._queue.length >= this.maxQueueDepth) {
        throw new BeeError('Spawn queue full — request rejected');
      }
      return this._enqueue(type, context, opts);
    }

    return this._spawn(type, definition, context, opts);
  }

  async _spawn(type, definition, context, opts) {
    const beeId = `bee-${type}-${++this._counter}-${Date.now().toString(36)}`;

    const instance = {
      id: beeId,
      type,
      state: BEE_STATES.INITIALIZING,
      context,
      priority: opts.priority || 0,
      parentBeeId: opts.parentBeeId || null,
      attempts: 0,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };

    this._active.set(beeId, instance);
    definition.instanceCount++;
    this._stats.totalSpawned++;

    this.logger.info?.(`[BeeFactory] Spawned ${beeId}`);

    try {
      instance.state = BEE_STATES.WORKING;
      instance.startedAt = Date.now();

      const result = await Promise.race([
        definition.handler(context),
        this._timeout(definition.timeoutMs, beeId),
      ]);

      instance.state = BEE_STATES.REPORTING;
      instance.result = result;
      instance.state = BEE_STATES.TERMINATED;
      instance.completedAt = Date.now();
      this._stats.totalCompleted++;

      this.logger.info?.(`[BeeFactory] ${beeId} completed in ${instance.completedAt - instance.startedAt}ms`);

      return { beeId, type, result, durationMs: instance.completedAt - instance.startedAt };

    } catch (err) {
      instance.error = err.message;

      if (instance.attempts < this.maxRetries) {
        instance.attempts++;
        instance.state = BEE_STATES.WORKING;
        const delay = phiBackoff(instance.attempts, 1000, PHI_TIMING.CYCLE);
        this.logger.warn?.(`[BeeFactory] ${beeId} failed, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return this._spawn(type, definition, context, opts);
      }

      instance.state = BEE_STATES.ERROR;
      instance.completedAt = Date.now();
      this._stats.totalFailed++;
      throw new BeeError(`Bee ${beeId} failed: ${err.message}`);

    } finally {
      this._active.delete(beeId);
      definition.instanceCount--;
      this._processQueue();
    }
  }

  _enqueue(type, context, opts) {
    return new Promise((resolve, reject) => {
      this._queue.push({
        type, context, opts, resolve, reject,
        priority: opts.priority || 0,
        enqueuedAt: Date.now(),
      });
      // Sort by priority (lower = higher priority)
      this._queue.sort((a, b) => a.priority - b.priority);
    });
  }

  _processQueue() {
    while (this._queue.length > 0 && this._active.size < this.maxConcurrentBees) {
      const entry = this._queue.shift();
      const definition = this._registry.get(entry.type);
      if (!definition) {
        entry.reject(new BeeError(`Unknown bee type: ${entry.type}`));
        continue;
      }
      this._spawn(entry.type, definition, entry.context, entry.opts)
        .then(entry.resolve)
        .catch(entry.reject);
    }
  }

  _timeout(ms, beeId) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new BeeError(`Bee ${beeId} timed out after ${ms}ms`)), ms)
    );
  }

  /**
   * Terminate a specific bee.
   * @param {string} beeId
   * @returns {boolean}
   */
  terminate(beeId) {
    const instance = this._active.get(beeId);
    if (!instance) return false;
    instance.state = BEE_STATES.TERMINATING;
    this._stats.totalTerminated++;
    return true;
  }

  /**
   * Terminate all active bees.
   */
  terminateAll() {
    for (const [beeId] of this._active) {
      this.terminate(beeId);
    }
    this._queue = [];
  }

  /**
   * List registered bee types.
   */
  listTypes() {
    return Array.from(this._registry.values()).map(d => ({
      type: d.type,
      description: d.description,
      capabilities: d.capabilities,
      instanceCount: d.instanceCount,
      maxInstances: d.maxInstances,
    }));
  }

  /**
   * Get factory status.
   */
  status() {
    return {
      registeredTypes: this._registry.size,
      activeBees: this._active.size,
      queuedSpawns: this._queue.length,
      maxConcurrent: this.maxConcurrentBees,
      stats: { ...this._stats },
    };
  }
}

class BeeError extends Error {
  constructor(message) {
    super(`[BeeFactory] ${message}`);
    this.name = 'BeeError';
  }
}

module.exports = { BeeFactory, BeeError, BEE_STATES };
