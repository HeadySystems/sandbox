/**
 * ∞ Heady™ CognitiveRuntime — Cognitive Processing Engine
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

'use strict';

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum tokens held in working memory before eviction */
const WORKING_MEMORY_CAPACITY = 8192;

/** Attention weight decay per idle tick */
const ATTENTION_DECAY = 0.1;

/** Maximum concurrent reasoning chains */
const MAX_CHAINS = 32;

/** Cognitive load threshold — above this, new tasks are queued */
const LOAD_THRESHOLD = 0.85;

// ─── CognitiveRuntime ─────────────────────────────────────────────────────────

/**
 * CognitiveRuntime is the cognitive processing engine for Heady™Systems.
 *
 * It manages:
 * - **Context Assembly**: Combines vector memory retrievals + graph RAG results
 *   into a unified context object for downstream LLM calls.
 * - **Reasoning Chains**: Tracks multi-step reasoning sequences with full
 *   provenance — each step records its inputs, outputs, and confidence.
 * - **Working Memory**: Fast-access in-process store for the current task's
 *   intermediate state, with token-budget enforcement.
 * - **Attention Mechanism**: Scores items by relevance, recency, and urgency,
 *   then allocates compute to highest-scoring active tasks.
 * - **Cognitive Load Balancing**: Measures per-node load and routes new
 *   reasoning requests to under-loaded nodes.
 *
 * @extends EventEmitter
 *
 * @fires CognitiveRuntime#context:assembled
 * @fires CognitiveRuntime#chain:started
 * @fires CognitiveRuntime#chain:step
 * @fires CognitiveRuntime#chain:completed
 * @fires CognitiveRuntime#memory:evicted
 * @fires CognitiveRuntime#attention:updated
 * @fires CognitiveRuntime#load:high
 */
class CognitiveRuntime extends EventEmitter {
  /**
   * @param {Object}   [options={}]
   * @param {Function} [options.vectorRetriever]   - async(query, k) → [{text, score}]
   * @param {Function} [options.graphRetriever]    - async(query) → [{node, edges}]
   * @param {number}   [options.workingMemoryCap]  - Token capacity for working memory
   * @param {number}   [options.maxChains]         - Maximum concurrent reasoning chains
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    super();
    this._vectorRetriever = options.vectorRetriever ?? this._nullRetriever;
    this._graphRetriever  = options.graphRetriever  ?? this._nullRetriever;
    this._wmCap           = options.workingMemoryCap ?? WORKING_MEMORY_CAPACITY;
    this._maxChains       = options.maxChains        ?? MAX_CHAINS;
    this._logger          = options.logger           ?? console;

    /**
     * Working memory: Map<key, { value, tokens, score, insertedAt }>
     * Eviction uses lowest attention score first (LAS).
     * @type {Map<string, WorkingMemoryEntry>}
     */
    this._workingMemory = new Map();
    this._wmTokensUsed  = 0;

    /**
     * Active reasoning chains: Map<chainId, ReasoningChain>
     * @type {Map<string, ReasoningChain>}
     */
    this._chains = new Map();

    /**
     * Attention scores: Map<taskId|key, number>
     * @type {Map<string, number>}
     */
    this._attention = new Map();

    /**
     * Node load registry: Map<nodeId, { current: number, capacity: number }>
     * @type {Map<string, NodeLoad>}
     */
    this._nodeLoads = new Map();
  }

  // ─── Context Assembly ────────────────────────────────────────────────────────

  /**
   * Assembles a rich context object for an LLM inference call by merging:
   * - Vector memory retrievals (semantic similarity to query)
   * - Graph RAG results (structural relationships)
   * - Working memory items (current task state)
   * - Attention-weighted recency bias
   *
   * @param {Object}  params
   * @param {string}  params.query          - The task or question driving retrieval
   * @param {string}  [params.taskId]       - Active task ID for attention scoring
   * @param {number}  [params.vectorTopK=5] - Number of vector hits to retrieve
   * @param {number}  [params.tokenBudget]  - Max tokens for assembled context
   * @returns {Promise<AssembledContext>}
   */
  async assembleContext({ query, taskId, vectorTopK = 5, tokenBudget }) {
    const budget = tokenBudget ?? this._wmCap;

    // Parallel retrieval
    const [vectorHits, graphHits] = await Promise.all([
      this._vectorRetriever(query, vectorTopK).catch(() => []),
      this._graphRetriever(query).catch(() => []),
    ]);

    // Working memory dump (attention-sorted)
    const wmItems = this._getWorkingMemoryByAttention(taskId);

    // Merge and budget-trim
    const context = this._mergeContext(vectorHits, graphHits, wmItems, budget);

    const assembled = {
      contextId:    crypto.randomUUID(),
      query,
      taskId:       taskId ?? null,
      vectorHits,
      graphHits,
      workingMemory: wmItems,
      mergedContext: context,
      totalTokens:  this._estimateTokens(context),
      assembledAt:  Date.now(),
    };

    this.emit('context:assembled', { contextId: assembled.contextId, taskId, tokenCount: assembled.totalTokens });
    return assembled;
  }

  // ─── Reasoning Chains ────────────────────────────────────────────────────────

  /**
   * Starts a new reasoning chain for a task.
   *
   * @param {Object}  params
   * @param {string}  params.taskId      - Parent task identifier
   * @param {string}  params.goal        - Human-readable goal for this chain
   * @param {Object}  [params.initialCtx={}] - Seed context
   * @returns {string} chainId
   */
  startChain({ taskId, goal, initialCtx = {} }) {
    if (this._chains.size >= this._maxChains) {
      throw new Error(`[CognitiveRuntime] Max reasoning chains (${this._maxChains}) reached`);
    }

    const chainId = crypto.randomUUID();
    /** @type {ReasoningChain} */
    const chain = {
      chainId,
      taskId,
      goal,
      steps:       [],
      state:       'active',
      context:     { ...initialCtx },
      startedAt:   Date.now(),
      completedAt: null,
    };

    this._chains.set(chainId, chain);
    this.emit('chain:started', { chainId, taskId, goal });
    return chainId;
  }

  /**
   * Appends a reasoning step to an active chain.
   *
   * @param {string}  chainId
   * @param {Object}  step
   * @param {string}  step.thought     - Reasoning narrative
   * @param {*}       step.input       - Input to this step
   * @param {*}       step.output      - Output of this step
   * @param {number}  [step.confidence=1.0] - Confidence score (0–1)
   * @param {Object}  [step.meta={}]   - Arbitrary metadata
   * @returns {number} Step index
   */
  addStep(chainId, step) {
    const chain = this._chains.get(chainId);
    if (!chain) throw new Error(`[CognitiveRuntime] Unknown chain: ${chainId}`);
    if (chain.state !== 'active') throw new Error(`[CognitiveRuntime] Chain ${chainId} is ${chain.state}`);

    const record = {
      index:      chain.steps.length,
      thought:    step.thought ?? '',
      input:      step.input,
      output:     step.output,
      confidence: Math.min(1, Math.max(0, step.confidence ?? 1.0)),
      meta:       step.meta ?? {},
      timestamp:  Date.now(),
    };

    chain.steps.push(record);
    // Merge output into chain context if it's an object
    if (step.output && typeof step.output === 'object') {
      Object.assign(chain.context, step.output);
    }

    this.emit('chain:step', { chainId, step: record });
    return record.index;
  }

  /**
   * Completes a reasoning chain and returns its final context.
   *
   * @param {string}  chainId
   * @param {*}       [conclusion] - Final conclusion to attach
   * @returns {ReasoningChain}
   */
  completeChain(chainId, conclusion) {
    const chain = this._chains.get(chainId);
    if (!chain) throw new Error(`[CognitiveRuntime] Unknown chain: ${chainId}`);

    chain.state       = 'completed';
    chain.completedAt = Date.now();
    chain.conclusion  = conclusion;

    const durationMs = chain.completedAt - chain.startedAt;
    this.emit('chain:completed', { chainId, taskId: chain.taskId, durationMs, stepCount: chain.steps.length });
    return chain;
  }

  /**
   * Retrieves a chain by ID.
   * @param {string} chainId
   * @returns {ReasoningChain|undefined}
   */
  getChain(chainId) {
    return this._chains.get(chainId);
  }

  // ─── Working Memory ───────────────────────────────────────────────────────────

  /**
   * Stores a key-value pair in working memory.
   * If the token budget is exceeded, evicts lowest-attention items first.
   *
   * @param {string} key
   * @param {*}      value
   * @param {Object} [opts={}]
   * @param {number} [opts.tokens=1]      - Estimated token cost of this entry
   * @param {number} [opts.score=1.0]     - Initial attention score
   * @returns {void}
   */
  memorize(key, value, opts = {}) {
    const tokens = opts.tokens ?? this._estimateTokens(value);
    const score  = opts.score  ?? 1.0;

    // Evict until there's room
    while (this._wmTokensUsed + tokens > this._wmCap && this._workingMemory.size > 0) {
      this._evictLowestAttention();
    }

    const existing = this._workingMemory.get(key);
    if (existing) this._wmTokensUsed -= existing.tokens;

    this._workingMemory.set(key, { value, tokens, score, insertedAt: Date.now() });
    this._wmTokensUsed += tokens;
  }

  /**
   * Reads a value from working memory, boosting its attention score on access.
   * @param {string} key
   * @returns {*|undefined}
   */
  recall(key) {
    const entry = this._workingMemory.get(key);
    if (!entry) return undefined;
    entry.score = Math.min(10, entry.score + 0.5); // Access boost
    return entry.value;
  }

  /**
   * Removes an item from working memory.
   * @param {string} key
   */
  forget(key) {
    const entry = this._workingMemory.get(key);
    if (entry) {
      this._wmTokensUsed -= entry.tokens;
      this._workingMemory.delete(key);
    }
  }

  /**
   * Returns working memory usage stats.
   * @returns {{ used: number, capacity: number, utilisation: number, items: number }}
   */
  getMemoryStats() {
    return {
      used:         this._wmTokensUsed,
      capacity:     this._wmCap,
      utilisation:  +(this._wmTokensUsed / this._wmCap).toFixed(4),
      items:        this._workingMemory.size,
    };
  }

  // ─── Attention Mechanism ─────────────────────────────────────────────────────

  /**
   * Sets the attention weight for a task or memory key.
   * Higher weights = more compute resources allocated.
   *
   * @param {string} key
   * @param {number} weight - Attention weight (0–∞)
   */
  setAttention(key, weight) {
    this._attention.set(key, Math.max(0, weight));
    this.emit('attention:updated', { key, weight });
  }

  /**
   * Decays all attention weights by ATTENTION_DECAY. Should be called on a tick.
   * Items with weight < 0.01 are removed from the attention map.
   */
  decayAttention() {
    for (const [key, weight] of this._attention.entries()) {
      const decayed = weight * (1 - ATTENTION_DECAY);
      if (decayed < 0.01) {
        this._attention.delete(key);
      } else {
        this._attention.set(key, decayed);
      }
    }
  }

  /**
   * Returns the top-N keys by current attention weight.
   * @param {number} [n=5]
   * @returns {Array<{key: string, weight: number}>}
   */
  getTopAttention(n = 5) {
    return Array.from(this._attention.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, weight]) => ({ key, weight }));
  }

  // ─── Cognitive Load Balancing ─────────────────────────────────────────────────

  /**
   * Registers or updates a node's load capacity.
   * @param {string} nodeId
   * @param {number} capacity - Max concurrent reasoning tasks
   */
  registerNode(nodeId, capacity = 10) {
    this._nodeLoads.set(nodeId, { current: 0, capacity });
  }

  /**
   * Marks a reasoning task as assigned to a node (increments current load).
   * @param {string} nodeId
   */
  acquireLoad(nodeId) {
    const node = this._nodeLoads.get(nodeId);
    if (!node) throw new Error(`[CognitiveRuntime] Unknown node: ${nodeId}`);
    node.current++;
    const load = node.current / node.capacity;
    if (load >= LOAD_THRESHOLD) {
      this.emit('load:high', { nodeId, load });
    }
  }

  /**
   * Releases load on a node (decrements current).
   * @param {string} nodeId
   */
  releaseLoad(nodeId) {
    const node = this._nodeLoads.get(nodeId);
    if (node && node.current > 0) node.current--;
  }

  /**
   * Returns the least-loaded node from the registry.
   * @returns {string|null} nodeId or null if none registered
   */
  getLeastLoadedNode() {
    let best     = null;
    let bestLoad = Infinity;

    for (const [nodeId, { current, capacity }] of this._nodeLoads.entries()) {
      const load = current / capacity;
      if (load < bestLoad) {
        bestLoad = load;
        best     = nodeId;
      }
    }

    return best;
  }

  /**
   * Returns a snapshot of all node loads.
   * @returns {Array<{nodeId: string, current: number, capacity: number, load: number}>}
   */
  getLoadSnapshot() {
    return Array.from(this._nodeLoads.entries()).map(([nodeId, { current, capacity }]) => ({
      nodeId,
      current,
      capacity,
      load: +(current / capacity).toFixed(4),
    }));
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Builds working memory items sorted by attention score descending.
   * @param {string} [taskId]
   * @returns {Array<{key: string, value: *, score: number}>}
   */
  _getWorkingMemoryByAttention(taskId) {
    return Array.from(this._workingMemory.entries())
      .map(([key, entry]) => ({
        key,
        value:   entry.value,
        score:   this._attention.get(key) ?? entry.score,
        tokens:  entry.tokens,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Merges vector hits, graph hits, and working memory into a single context string.
   * Trims to stay within token budget.
   *
   * @param {Array}  vectorHits
   * @param {Array}  graphHits
   * @param {Array}  wmItems
   * @param {number} budget
   * @returns {string}
   */
  _mergeContext(vectorHits, graphHits, wmItems, budget) {
    const parts = [];
    let usedTokens = 0;

    const add = (text) => {
      const t = this._estimateTokens(text);
      if (usedTokens + t <= budget) {
        parts.push(text);
        usedTokens += t;
        return true;
      }
      return false;
    };

    // Priority: vector hits → working memory → graph hits
    for (const hit of vectorHits) {
      if (!add(`[VEC] ${hit.text ?? JSON.stringify(hit)}`)) break;
    }

    for (const item of wmItems) {
      const str = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
      if (!add(`[WM:${item.key}] ${str}`)) break;
    }

    for (const node of graphHits) {
      if (!add(`[GRAPH] ${JSON.stringify(node)}`)) break;
    }

    return parts.join('\n');
  }

  /**
   * Simple token estimator: ~4 chars per token (GPT-4 approximation).
   * @param {*} value
   * @returns {number}
   */
  _estimateTokens(value) {
    if (!value) return 0;
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return Math.ceil(str.length / 4);
  }

  /**
   * Evicts the working memory item with the lowest attention score.
   */
  _evictLowestAttention() {
    let lowestKey   = null;
    let lowestScore = Infinity;

    for (const [key, entry] of this._workingMemory.entries()) {
      const score = this._attention.get(key) ?? entry.score;
      if (score < lowestScore) {
        lowestScore = score;
        lowestKey   = key;
      }
    }

    if (lowestKey) {
      const entry = this._workingMemory.get(lowestKey);
      this._wmTokensUsed -= entry.tokens;
      this._workingMemory.delete(lowestKey);
      this.emit('memory:evicted', { key: lowestKey, score: lowestScore });
    }
  }

  /**
   * Null retriever stub — returns empty array.
   * @returns {Promise<[]>}
   */
  async _nullRetriever() {
    return [];
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {

  CognitiveRuntime,
  WORKING_MEMORY_CAPACITY,
  LOAD_THRESHOLD,
};
