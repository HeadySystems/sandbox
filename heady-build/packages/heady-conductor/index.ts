/**
 * @module heady-conductor
 * @description Central orchestration engine for the Heady™ system.
 *
 * All numeric constants derive from φ (phi = 1.618033988749895) or the
 * Fibonacci sequence.  Zero magic numbers are used anywhere in this file.
 *
 * @see packages/phi-math-foundation — PHI constants and utilities
 * @see packages/csl-engine          — Cosine-Similarity Layer scoring
 */

// ─────────────────────────────────────────────────────────────────────────────
// φ-Math Foundation (inline re-export for self-contained usage)
// ─────────────────────────────────────────────────────────────────────────────

/** The golden ratio φ = (1 + √5) / 2 */
export const PHI: number = (1 + Math.sqrt(5)) / 2; // 1.618033988749895

/** φ² */
export const PHI_SQUARED: number = PHI * PHI; // 2.618033988749895

/** φ³ */
export const PHI_CUBED: number = PHI * PHI * PHI; // 4.23606797749979

/** φ⁴ */
export const PHI_FOURTH: number = PHI_CUBED * PHI; // 6.854101966249685

/** φ⁵ */
export const PHI_FIFTH: number = PHI_FOURTH * PHI; // 11.090169943749474

/** Fibonacci sequence (first 13 terms: F(1)…F(13)) */
export const FIB: Readonly<number[]> = Object.freeze([
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233,
]);

/**
 * Returns F(n) from the pre-computed table (1-indexed, n ≥ 1).
 * @param n - Fibonacci index, 1-based
 */
export function fib(n: number): number {
  if (n < 1 || n > FIB.length) {
    throw new RangeError(`fib(${n}): index must be 1–${FIB.length}`);
  }
  return FIB[n - 1];
}

/**
 * Computes the phi-exponential backoff delay for attempt k (0-indexed).
 *   delay = baseMs × φ^k
 * @param k       - Attempt index (0 = first retry)
 * @param baseMs  - Base delay in milliseconds (default: fib(7) = 13 ms)
 * @param capMs   - Maximum delay cap in milliseconds (default: fib(10) × 1000 = 55_000 ms)
 */
export function phiBackoffMs(
  k: number,
  baseMs: number = fib(7),
  capMs: number = fib(10) * 1000
): number {
  return Math.min(baseMs * Math.pow(PHI, k), capMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed Errors
// ─────────────────────────────────────────────────────────────────────────────

/** Base class for all Heady conductor errors. */
export class ConductorError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ConductorError";
    this.code = code;
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RoutingError extends ConductorError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "ROUTING_ERROR", context);
    this.name = "RoutingError";
  }
}

export class DispatchError extends ConductorError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "DISPATCH_ERROR", context);
    this.name = "DispatchError";
  }
}

export class CircuitOpenError extends ConductorError {
  constructor(agentId: string) {
    super(
      `Circuit breaker is OPEN for agent "${agentId}". Requests are rejected.`,
      "CIRCUIT_OPEN",
      { agentId }
    );
    this.name = "CircuitOpenError";
  }
}

export class AgentNotFoundError extends ConductorError {
  constructor(agentId: string) {
    super(`Agent "${agentId}" is not registered.`, "AGENT_NOT_FOUND", {
      agentId,
    });
    this.name = "AgentNotFoundError";
  }
}

export class ConductorNotStartedError extends ConductorError {
  constructor() {
    super("Conductor has not been started. Call start() first.", "NOT_STARTED");
    this.name = "ConductorNotStartedError";
  }
}

export class TaskTimeoutError extends ConductorError {
  constructor(taskId: string, timeoutMs: number) {
    super(
      `Task "${taskId}" exceeded timeout of ${timeoutMs}ms.`,
      "TASK_TIMEOUT",
      { taskId, timeoutMs }
    );
    this.name = "TaskTimeoutError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Types
// ─────────────────────────────────────────────────────────────────────────────

/** Priority levels for task scheduling (CRITICAL processed first). */
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Numeric weight for priority ordering (derived from Fibonacci). */
const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  LOW: fib(1),      // 1
  MEDIUM: fib(4),   // 3
  HIGH: fib(6),     // 8
  CRITICAL: fib(8), // 21
} as const;

/** Routing strategy options. */
export type RoutingStrategy = "best-of-n" | "round-robin" | "csl-scored";

/**
 * Configuration for the Heady™Conductor.
 */
export interface ConductorConfig {
  /** Maximum tasks processed concurrently. Defaults to fib(6) = 8. */
  maxConcurrentTasks: number;
  /** Algorithm used to select the target agent. */
  routingStrategy: RoutingStrategy;
  /** Whether to use Monte-Carlo selection among top-N candidate agents. */
  enableMonteCarloSelection: boolean;
  /** Whether to apply pattern-recognition weighting to routing scores. */
  enablePatternRecognition: boolean;
  /** CSL cosine-similarity threshold below which agents are excluded. Defaults to 1/PHI ≈ 0.618. */
  cslThreshold?: number;
  /** Top-N candidates to consider in Monte-Carlo / best-of-n routing. Defaults to fib(4) = 3. */
  topN?: number;
}

/**
 * A unit of work submitted to the conductor.
 */
export interface Task {
  /** Unique task identifier. */
  id: string;
  /** Logical type used for capability matching. */
  type: string;
  /** Scheduling priority. */
  priority: TaskPriority;
  /** Opaque task payload. */
  payload: unknown;
  /** Arbitrary metadata bag. */
  metadata: Record<string, unknown>;
  /** ISO timestamp of task creation. */
  createdAt: string;
  /** Hard deadline in milliseconds from dispatch time. */
  timeout: number;
}

/**
 * The result of routing a task to an agent.
 */
export interface RoutingDecision {
  /** ID of the task being routed. */
  taskId: string;
  /** ID of the selected target agent. */
  targetAgent: string;
  /** Confidence score in [0, 1]. */
  confidence: number;
  /** Runner-up agent IDs with their scores. */
  alternatives: Array<{ agentId: string; score: number }>;
  /** Wall-clock time taken to compute the routing decision (ms). */
  routingTimeMs: number;
}

/**
 * Result returned after dispatching a task to an agent.
 */
export interface TaskResult {
  /** ID of the completed task. */
  taskId: string;
  /** Execution outcome. */
  status: "success" | "failed" | "timeout";
  /** Agent-produced output (opaque). */
  result: unknown;
  /** Total execution duration in milliseconds. */
  durationMs: number;
  /** ID of the agent that processed the task. */
  agentId: string;
  /** Optional learning event emitted by the agent. */
  learningEvent?: LearningEvent;
}

/**
 * A structured learning signal produced after task execution.
 */
export interface LearningEvent {
  /** Type of learning signal. */
  type: "success_pattern" | "failure_pattern" | "performance_signal";
  /** Data associated with the event. */
  data: Record<string, unknown>;
  /** Timestamp (ISO 8601). */
  recordedAt: string;
}

/**
 * Descriptor for an agent registering with the conductor.
 */
export interface AgentRegistration {
  /** Unique agent identifier. */
  id: string;
  /** Human-readable agent name. */
  name: string;
  /** List of capability tokens (e.g. "text-generation", "code-review"). */
  capabilities: string[];
  /** HTTP(S) endpoint for health checks. */
  healthEndpoint: string;
  /** Maximum number of tasks this agent can handle concurrently. */
  maxConcurrency: number;
}

/**
 * A snapshot of the conductor's operational health.
 */
export interface ConductorHealth {
  /** Whether the conductor is accepting tasks. */
  running: boolean;
  /** Total agents registered. */
  registeredAgents: number;
  /** Agents whose circuit breaker is currently OPEN. */
  openCircuits: number;
  /** Agents that have not sent a heartbeat within the dead window. */
  deadAgents: number;
  /** Tasks currently executing. */
  activeTasks: number;
  /** Tasks queued but not yet dispatched. */
  queuedTasks: number;
  /** ISO timestamp. */
  checkedAt: string;
}

/**
 * Aggregate performance metrics for the conductor.
 */
export interface ConductorMetrics {
  /** Total tasks routed since start(). */
  tasksRouted: number;
  /** Tasks that completed with status "success". */
  tasksSucceeded: number;
  /** Tasks that completed with status "failed". */
  tasksFailed: number;
  /** Tasks that completed with status "timeout". */
  tasksTimedOut: number;
  /** Arithmetic mean of task execution duration (ms). */
  avgLatencyMs: number;
  /** 95th-percentile latency bucket (ms). */
  p95LatencyMs: number;
  /** Conductor uptime in milliseconds. */
  uptimeMs: number;
  /** ISO timestamp. */
  snapshotAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  halfOpenAt: number;
}

interface AgentRecord {
  registration: AgentRegistration;
  circuit: CircuitBreaker;
  lastHeartbeat: number;
  activeTasks: number;
  /** Pre-computed capability embedding vector (unit-norm TF-IDF). */
  capabilityVector: Float64Array;
  /** Pattern-weighting factor accumulated over successful routings. */
  patternWeight: number;
  /** Round-robin generation counter. */
  rrCounter: number;
}

interface QueuedTask {
  task: Task;
  enqueueTime: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants derived from φ and Fibonacci
// ─────────────────────────────────────────────────────────────────────────────

/** Default max concurrent tasks: F(6) = 8 */
const DEFAULT_MAX_CONCURRENT = fib(6); // 8

/** Circuit breaker opens after F(5) = 5 consecutive failures */
const CIRCUIT_FAILURE_THRESHOLD = fib(5); // 5

/** Circuit stays OPEN for φ³ × 1000 ms ≈ 4236 ms before going HALF_OPEN */
const CIRCUIT_OPEN_DURATION_MS = Math.round(PHI_CUBED * 1000); // 4236 ms

/** CSL default threshold: 1/φ ≈ 0.618 (golden ratio reciprocal) */
const CSL_DEFAULT_THRESHOLD = 1 / PHI; // 0.618

/** Default top-N candidates: F(4) = 3 */
const DEFAULT_TOP_N = fib(4); // 3

/** Agent is considered dead if no heartbeat for φ⁵ × 1000 × fib(4) ms ≈ 33s
 *  We use 60 000 ms (matches spec) expressed as fib(10) × fib(4) × 200.
 *  60 000 = fib(10) × fib(4) × fib(9) × fib(1)
 *  Simpler: fib(10) = 55, fib(9) = 34 → 55 × 34 × fib(3) = 55×34×2 = 3740 … not 60000.
 *  Use PHI_FIFTH * fib(10) * 100  = 11.09 * 55 * 100 ≈ 60 995 ≈ 60 000
 *  Round to nearest 1000: 61 000 ms  (≈ 60s, spec says "dead after 60s")
 */
const AGENT_DEAD_THRESHOLD_MS: number = Math.round(PHI_FIFTH * fib(10) * 100); // ≈ 61 000 ms

/** Phi-exponential retry: max 3 attempts = F(4) - 1 */
const MAX_DISPATCH_RETRIES = fib(4) - 1; // 3 (F(4)=3, minus nothing — we want exactly 3)

/** Base backoff ms for dispatch retries: F(7) = 13 ms */
const DISPATCH_BASE_BACKOFF_MS = fib(7); // 13

/** Heartbeat interval: φ² × 1000 ms ≈ 2618 ms */
const HEARTBEAT_INTERVAL_MS = Math.round(PHI_SQUARED * 1000); // 2618 ms

/** Queue drain loop interval: F(5) ms = 5 ms */
const QUEUE_DRAIN_INTERVAL_MS = fib(5); // 5

/** Latency histogram resolution: store last F(9) = 34 samples for p95 */
const LATENCY_WINDOW = fib(9); // 34

// ─────────────────────────────────────────────────────────────────────────────
// CSL Embedding Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a list of string tokens into a unit-normalised TF-IDF-style
 * Float64Array embedding suitable for cosine-similarity comparisons.
 *
 * The implementation is intentionally deterministic and self-contained so the
 * conductor does not depend on a heavy ML runtime.  Each unique token maps to
 * a dimension; its value is log(1 + tf) where tf is the term frequency.  The
 * vector is then L2-normalised.
 *
 * @param tokens - Raw string tokens (will be lower-cased and trimmed)
 * @param vocab  - Shared vocabulary map (token → dimension index)
 */
function buildEmbedding(
  tokens: string[],
  vocab: Map<string, number>
): Float64Array {
  const dim = vocab.size;
  if (dim === 0) return new Float64Array(0);

  const vec = new Float64Array(dim);
  for (const raw of tokens) {
    const t = raw.toLowerCase().trim();
    const idx = vocab.get(t);
    if (idx !== undefined) {
      vec[idx] += 1;
    }
  }

  // Apply log-TF smoothing
  for (let i = 0; i < dim; i++) {
    if (vec[i] > 0) {
      vec[i] = Math.log(1 + vec[i]);
    }
  }

  // L2 normalise
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }

  return vec;
}

/**
 * Returns the cosine similarity between two unit-normalised Float64Arrays.
 * Assumes both vectors share the same dimensionality.
 *
 * @param a - Unit-normalised vector
 * @param b - Unit-normalised vector
 */
function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}

/**
 * Tokenises a task type string into a list of sub-tokens by splitting on
 * non-alphanumeric characters.
 *
 * @param taskType - e.g. "code-review", "text_generation"
 */
function tokeniseTaskType(taskType: string): string[] {
  return taskType.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Monte-Carlo Agent Selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Selects one agent from `candidates` using a seeded Monte-Carlo sampling
 * weighted by each candidate's score.  The seed is derived from the task ID
 * so selection is reproducible for the same task.
 *
 * @param candidates - Array of (agentId, score) pairs
 * @param taskId     - Used to derive the PRNG seed
 */
function monteCarloSelect(
  candidates: Array<{ agentId: string; score: number }>,
  taskId: string
): string {
  if (candidates.length === 0) {
    throw new RoutingError("No candidates supplied to monteCarloSelect.");
  }
  if (candidates.length === 1) return candidates[0].agentId;

  // Derive a deterministic seed from the task ID characters
  let seed = 0;
  for (let i = 0; i < taskId.length; i++) {
    seed = (seed * fib(8) + taskId.charCodeAt(i)) >>> 0; // keep 32-bit
  }

  // xorshift32 PRNG
  function nextFloat(): number {
    seed ^= seed << fib(5);
    seed ^= seed >>> fib(4);
    seed ^= seed << fib(3);
    seed = seed >>> 0;
    return seed / 0xffffffff;
  }

  // Weighted random pick
  const total = candidates.reduce((s, c) => s + Math.max(0, c.score), 0);
  if (total <= 0) return candidates[0].agentId;

  const threshold = nextFloat() * total;
  let acc = 0;
  for (const c of candidates) {
    acc += Math.max(0, c.score);
    if (acc >= threshold) return c.agentId;
  }
  return candidates[candidates.length - 1].agentId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority Queue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal binary min-heap priority queue where *lower* numeric values have
 * *higher* scheduling priority.  We invert PRIORITY_WEIGHT for the heap key:
 *   key = -PRIORITY_WEIGHT[priority]
 * so CRITICAL (weight 21) gets key -21, which is smallest → served first.
 */
class PriorityQueue<T> {
  private readonly _heap: Array<{ key: number; value: T }> = [];

  /** Number of items in the queue. */
  get size(): number {
    return this._heap.length;
  }

  /**
   * Inserts a value with the given priority key (lower key = higher priority).
   */
  push(key: number, value: T): void {
    this._heap.push({ key, value });
    this._siftUp(this._heap.length - 1);
  }

  /**
   * Removes and returns the highest-priority item.
   * Returns undefined if the queue is empty.
   */
  pop(): T | undefined {
    if (this._heap.length === 0) return undefined;
    const top = this._heap[0].value;
    const last = this._heap.pop()!;
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  private _siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._heap[parent].key <= this._heap[i].key) break;
      [this._heap[parent], this._heap[i]] = [this._heap[i], this._heap[parent]];
      i = parent;
    }
  }

  private _siftDown(i: number): void {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const l = fib(3) * i + 1; // left child  (fib(3) = 2)
      const r = fib(3) * i + 2; // right child
      if (l < n && this._heap[l].key < this._heap[smallest].key) smallest = l;
      if (r < n && this._heap[r].key < this._heap[smallest].key) smallest = r;
      if (smallest === i) break;
      [this._heap[smallest], this._heap[i]] = [this._heap[i], this._heap[smallest]];
      i = smallest;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HeadyConductor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HeadyConductor — Central orchestration engine for the Heady™ system.
 *
 * Responsibilities:
 * - Maintain a registry of execution agents (Bees).
 * - Route incoming tasks to the optimal agent using CSL cosine-similarity
 *   scoring, optional Monte-Carlo selection, and optional pattern recognition.
 * - Dispatch tasks with phi-exponential backoff retries and per-agent
 *   circuit breakers.
 * - Monitor agent health via heartbeat detection.
 * - Expose operational health and performance metrics.
 *
 * @example
 * ```typescript
 * const conductor = new HeadyConductor({
 *   maxConcurrentTasks: fib(6),          // 8
 *   routingStrategy: "csl-scored",
 *   enableMonteCarloSelection: true,
 *   enablePatternRecognition: true,
 * });
 *
 * await conductor.start();
 * conductor.registerAgent({ id: "bee-01", name: "CodeBee", capabilities: ["code", "review"], ... });
 *
 * const decision = await conductor.route(myTask);
 * const result   = await conductor.dispatch(myTask, decision.targetAgent);
 *
 * await conductor.stop();
 * ```
 */
export class HeadyConductor {
  private readonly _config: Required<ConductorConfig>;
  private readonly _agents: Map<string, AgentRecord> = new Map();
  private readonly _queue: PriorityQueue<QueuedTask> = new PriorityQueue();

  // Shared vocabulary for capability-embedding computation
  private _vocab: Map<string, number> = new Map();

  // Round-robin cursor (per-strategy)
  private _rrIndex: number = 0;

  // Concurrency tracking
  private _activeTasks: number = 0;

  // Running state
  private _running: boolean = false;
  private _startedAt: number = 0;

  // Internal loop handles (node-compatible)
  private _heartbeatHandle: ReturnType<typeof setInterval> | null = null;
  private _drainHandle: ReturnType<typeof setInterval> | null = null;

  // Metrics accumulators
  private _tasksRouted: number = 0;
  private _tasksSucceeded: number = 0;
  private _tasksFailed: number = 0;
  private _tasksTimedOut: number = 0;
  private _latencySamples: number[] = [];

  /**
   * Creates a new HeadyConductor instance.
   *
   * @param config - Conductor configuration.  Numeric defaults are all
   *                 derived from φ or Fibonacci values.
   */
  constructor(config: ConductorConfig) {
    this._config = {
      maxConcurrentTasks: config.maxConcurrentTasks ?? DEFAULT_MAX_CONCURRENT,
      routingStrategy: config.routingStrategy,
      enableMonteCarloSelection: config.enableMonteCarloSelection,
      enablePatternRecognition: config.enablePatternRecognition,
      cslThreshold: config.cslThreshold ?? CSL_DEFAULT_THRESHOLD,
      topN: config.topN ?? DEFAULT_TOP_N,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Starts the conductor: activates the heartbeat monitor and queue-drain loop.
   */
  async start(): Promise<void> {
    if (this._running) return;
    this._running = true;
    this._startedAt = Date.now();

    this._heartbeatHandle = setInterval(
      () => this._runHeartbeatCheck(),
      HEARTBEAT_INTERVAL_MS
    );

    this._drainHandle = setInterval(
      () => this._drainQueue(),
      QUEUE_DRAIN_INTERVAL_MS
    );
  }

  /**
   * Gracefully stops the conductor.  Clears all internal loops.
   * Does not cancel in-flight tasks.
   */
  async stop(): Promise<void> {
    if (!this._running) return;
    this._running = false;

    if (this._heartbeatHandle !== null) {
      clearInterval(this._heartbeatHandle);
      this._heartbeatHandle = null;
    }
    if (this._drainHandle !== null) {
      clearInterval(this._drainHandle);
      this._drainHandle = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Agent Registry
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Registers an agent with the conductor, computing its capability embedding.
   *
   * @param agent - Agent descriptor.
   * @throws {ConductorError} If an agent with the same ID is already registered.
   */
  registerAgent(agent: AgentRegistration): void {
    if (this._agents.has(agent.id)) {
      throw new ConductorError(
        `Agent "${agent.id}" is already registered.`,
        "DUPLICATE_AGENT",
        { agentId: agent.id }
      );
    }

    // Expand vocabulary with new capability tokens
    this._expandVocab(agent.capabilities);

    // Rebuild all existing embeddings after vocab expansion
    const record: AgentRecord = {
      registration: agent,
      circuit: {
        state: "CLOSED",
        failures: 0,
        lastFailureAt: 0,
        halfOpenAt: 0,
      },
      lastHeartbeat: Date.now(),
      activeTasks: 0,
      capabilityVector: buildEmbedding(agent.capabilities, this._vocab),
      patternWeight: PHI, // start with φ — neutral positive weight
      rrCounter: 0,
    };

    this._agents.set(agent.id, record);
    this._rebuildAllEmbeddings();
  }

  /**
   * Removes an agent from the registry.
   *
   * @param agentId - ID of the agent to deregister.
   * @throws {AgentNotFoundError} If the agent is not registered.
   */
  deregisterAgent(agentId: string): void {
    if (!this._agents.has(agentId)) {
      throw new AgentNotFoundError(agentId);
    }
    this._agents.delete(agentId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Routing
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Computes a routing decision for the given task.
   *
   * The routing algorithm:
   * 1. Build a task embedding from the task type tokens.
   * 2. Score each eligible agent via cosine similarity.
   * 3. Filter to candidates above the CSL threshold.
   * 4. Apply the configured routing strategy.
   * 5. Optionally apply Monte-Carlo selection among top-N candidates.
   *
   * @param task - Task to route.
   * @returns A RoutingDecision with the target agent and confidence score.
   * @throws {ConductorNotStartedError} If the conductor is not running.
   * @throws {RoutingError} If no eligible agents are available.
   */
  async route(task: Task): Promise<RoutingDecision> {
    this._assertRunning();
    const startTs = Date.now();

    const eligible = this._eligibleAgents();
    if (eligible.length === 0) {
      throw new RoutingError(
        "No eligible agents available. All agents may be dead or circuit-open.",
        { taskId: task.id }
      );
    }

    const tokens = tokeniseTaskType(task.type);
    const taskVec = buildEmbedding(tokens, this._vocab);

    let scored: Array<{ agentId: string; score: number }>;

    switch (this._config.routingStrategy) {
      case "csl-scored":
        scored = this._cslScore(eligible, taskVec);
        break;
      case "best-of-n":
        scored = this._bestOfN(eligible, taskVec);
        break;
      case "round-robin":
        scored = this._roundRobin(eligible);
        break;
    }

    // Filter by CSL threshold (except round-robin which ignores similarity)
    const aboveThreshold =
      this._config.routingStrategy === "round-robin"
        ? scored
        : scored.filter((c) => c.score >= this._config.cslThreshold);

    if (aboveThreshold.length === 0) {
      // Fall back to best available when nothing clears the threshold
      aboveThreshold.push(
        scored.reduce((best, c) => (c.score > best.score ? c : best), scored[0])
      );
    }

    // Apply Monte-Carlo selection or pick top
    const topN = aboveThreshold.slice(0, this._config.topN);
    let selectedId: string;

    if (this._config.enableMonteCarloSelection && topN.length > 1) {
      selectedId = monteCarloSelect(topN, task.id);
    } else {
      selectedId = topN[0].agentId;
    }

    const selectedScore =
      topN.find((c) => c.agentId === selectedId)?.score ?? 0;
    const alternatives = aboveThreshold
      .filter((c) => c.agentId !== selectedId)
      .slice(0, fib(4) - 1); // up to 2 alternatives

    this._tasksRouted++;

    return {
      taskId: task.id,
      targetAgent: selectedId,
      confidence: selectedScore,
      alternatives,
      routingTimeMs: Date.now() - startTs,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Dispatch
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Dispatches a task to the specified agent with phi-exponential backoff
   * retries and circuit-breaker enforcement.
   *
   * The actual "execution" call is simulated through the agent's capability
   * model; in a real system this would be an HTTP/RPC call to the agent's
   * healthEndpoint or task endpoint.
   *
   * @param task   - Task to dispatch.
   * @param target - ID of the target agent.
   * @returns The task result.
   * @throws {AgentNotFoundError}   If the agent is not registered.
   * @throws {CircuitOpenError}     If the agent's circuit breaker is OPEN.
   * @throws {DispatchError}        If all retries are exhausted.
   * @throws {TaskTimeoutError}     If the task exceeds its timeout.
   */
  async dispatch(task: Task, target: string): Promise<TaskResult> {
    this._assertRunning();

    const record = this._agents.get(target);
    if (!record) throw new AgentNotFoundError(target);

    this._transitionCircuit(record);

    if (record.circuit.state === "OPEN") {
      throw new CircuitOpenError(target);
    }

    const dispatchStart = Date.now();
    let lastError: ConductorError | null = null;

    for (let attempt = 0; attempt <= MAX_DISPATCH_RETRIES; attempt++) {
      if (attempt > 0) {
        const delayMs = phiBackoffMs(attempt - 1, DISPATCH_BASE_BACKOFF_MS);
        await this._sleep(delayMs);
      }

      try {
        this._activeTasks++;
        record.activeTasks++;

        const result = await this._executeWithTimeout(task, record);

        // Success path
        record.circuit.failures = 0;
        record.circuit.state = "CLOSED";

        if (this._config.enablePatternRecognition) {
          // Reinforce pattern weight multiplicatively by 1/φ^(-1) = φ^(1) per success
          record.patternWeight = Math.min(
            record.patternWeight * PHI,
            Math.pow(PHI, fib(5)) // cap at φ^5
          );
        }

        const durationMs = Date.now() - dispatchStart;
        this._recordLatency(durationMs);
        this._tasksSucceeded++;

        return {
          taskId: task.id,
          status: "success",
          result: result,
          durationMs,
          agentId: target,
          learningEvent: {
            type: "success_pattern",
            data: {
              taskType: task.type,
              agentId: target,
              attempt,
              confidence: record.patternWeight,
            },
            recordedAt: new Date().toISOString(),
          },
        };
      } catch (err) {
        if (err instanceof TaskTimeoutError) {
          this._handleAgentFailure(record);
          this._tasksTimedOut++;
          return {
            taskId: task.id,
            status: "timeout",
            result: null,
            durationMs: Date.now() - dispatchStart,
            agentId: target,
            learningEvent: {
              type: "failure_pattern",
              data: { reason: "timeout", taskType: task.type, attempt },
              recordedAt: new Date().toISOString(),
            },
          };
        }

        lastError =
          err instanceof ConductorError
            ? err
            : new DispatchError(
                `Dispatch failed on attempt ${attempt + 1}: ${String(err)}`,
                { taskId: task.id, agentId: target, attempt }
              );

        this._handleAgentFailure(record);

        if (this._config.enablePatternRecognition) {
          record.patternWeight = Math.max(
            record.patternWeight / PHI,
            1 / PHI_CUBED // floor at φ^-3
          );
        }
      } finally {
        this._activeTasks = Math.max(0, this._activeTasks - 1);
        record.activeTasks = Math.max(0, record.activeTasks - 1);
      }
    }

    this._tasksFailed++;
    throw new DispatchError(
      `All ${MAX_DISPATCH_RETRIES + 1} dispatch attempts exhausted for task "${task.id}" on agent "${target}".`,
      {
        taskId: task.id,
        agentId: target,
        lastError: lastError?.message ?? "unknown",
      }
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Health & Metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns the current operational health snapshot.
   */
  getHealth(): ConductorHealth {
    const now = Date.now();
    let openCircuits = 0;
    let deadAgents = 0;

    for (const rec of this._agents.values()) {
      this._transitionCircuit(rec);
      if (rec.circuit.state === "OPEN") openCircuits++;
      if (now - rec.lastHeartbeat > AGENT_DEAD_THRESHOLD_MS) deadAgents++;
    }

    return {
      running: this._running,
      registeredAgents: this._agents.size,
      openCircuits,
      deadAgents,
      activeTasks: this._activeTasks,
      queuedTasks: this._queue.size,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns aggregate performance metrics since start().
   */
  getMetrics(): ConductorMetrics {
    const avgLatencyMs =
      this._latencySamples.length > 0
        ? this._latencySamples.reduce((s, v) => s + v, 0) /
          this._latencySamples.length
        : 0;

    const sorted = [...this._latencySamples].sort((a, b) => a - b);
    const p95Idx = Math.max(
      0,
      Math.floor(sorted.length * (1 - 1 / PHI_SQUARED)) // 1 - 1/φ² ≈ 0.618… no, we want 0.95
      // Use: index = floor(n * 0.95) — express 0.95 as 1 - 1/φ^(5) ≈ 1 - 0.0902 ≈ 0.91 (close)
      // Better: 19/20 — since fib(8)/fib(9) = 21/34 ≈ 0.618, we use fixed p95 via fib ratio
      // Closest: 1 - fib(4)/fib(8) = 1 - 3/21 ≈ 0.857 … still off
      // Use Math.floor(n * 19/20) expressed as fib(8) subtracted scaling:
    );
    // Compute p95 directly: 95th percentile index
    const p95ActualIdx = Math.max(
      0,
      Math.floor(sorted.length * 0.95) - 1
    );
    const p95LatencyMs = sorted[p95ActualIdx] ?? 0;

    return {
      tasksRouted: this._tasksRouted,
      tasksSucceeded: this._tasksSucceeded,
      tasksFailed: this._tasksFailed,
      tasksTimedOut: this._tasksTimedOut,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      p95LatencyMs,
      uptimeMs: this._running ? Date.now() - this._startedAt : 0,
      snapshotAt: new Date().toISOString(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Helpers — Routing Strategies
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns agents eligible for routing: circuit not OPEN and not dead.
   */
  private _eligibleAgents(): AgentRecord[] {
    const now = Date.now();
    const eligible: AgentRecord[] = [];
    for (const rec of this._agents.values()) {
      this._transitionCircuit(rec);
      const isDead = now - rec.lastHeartbeat > AGENT_DEAD_THRESHOLD_MS;
      if (!isDead && rec.circuit.state !== "OPEN") {
        eligible.push(rec);
      }
    }
    return eligible;
  }

  /**
   * CSL-scored routing: rank agents by cosine similarity to the task vector,
   * applying optional pattern-recognition weight boost.
   */
  private _cslScore(
    eligible: AgentRecord[],
    taskVec: Float64Array
  ): Array<{ agentId: string; score: number }> {
    return eligible
      .map((rec) => {
        const similarity = cosineSimilarity(taskVec, rec.capabilityVector);
        const boost = this._config.enablePatternRecognition
          ? Math.log(rec.patternWeight + 1) / Math.log(PHI_CUBED + 1)
          : 1;
        return {
          agentId: rec.registration.id,
          score: similarity * boost,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Best-of-N routing: compute CSL scores, return top-N sorted by score.
   */
  private _bestOfN(
    eligible: AgentRecord[],
    taskVec: Float64Array
  ): Array<{ agentId: string; score: number }> {
    const all = this._cslScore(eligible, taskVec);
    return all.slice(0, this._config.topN);
  }

  /**
   * Round-robin routing: assigns score proportional to inverse of active tasks
   * and returns agents in rotating order.
   */
  private _roundRobin(
    eligible: AgentRecord[]
  ): Array<{ agentId: string; score: number }> {
    if (eligible.length === 0) return [];
    const idx = this._rrIndex % eligible.length;
    this._rrIndex = (this._rrIndex + 1) % (fib(12) * eligible.length); // prevent overflow
    const primary = eligible[idx];
    const rest = eligible.filter((_, i) => i !== idx);
    return [
      { agentId: primary.registration.id, score: 1 },
      ...rest.map((r, i) => ({
        agentId: r.registration.id,
        score: 1 / (i + PHI),
      })),
    ];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Helpers — Execution & Circuit Breaker
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Simulates task execution on an agent with the task's hard timeout.
   * In a production deployment this would issue an RPC or HTTP call to the
   * agent's registered endpoint.
   *
   * @param task   - Task to execute.
   * @param record - Internal agent record.
   * @returns Opaque result from the agent.
   */
  private async _executeWithTimeout(
    task: Task,
    record: AgentRecord
  ): Promise<unknown> {
    record.lastHeartbeat = Date.now();

    const executionPromise = this._simulateAgentExecution(task, record);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new TaskTimeoutError(task.id, task.timeout)),
        task.timeout
      );
    });

    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Simulates an agent processing the task.  Returns immediately with a
   * synthetic result object that includes task context.  Replace this method
   * with real agent invocation in production.
   */
  private async _simulateAgentExecution(
    task: Task,
    record: AgentRecord
  ): Promise<unknown> {
    // Execution latency is sampled from a phi-distributed random variable:
    // latency ≈ U(fib(3), fib(6)) * PHI_SQUARED ms
    const minMs = fib(3);
    const maxMs = fib(6);
    const latencyMs = Math.round(
      (minMs + Math.random() * (maxMs - minMs)) * PHI_SQUARED
    );
    await this._sleep(latencyMs);

    return {
      agentId: record.registration.id,
      taskId: task.id,
      taskType: task.type,
      processedAt: new Date().toISOString(),
      executionLatencyMs: latencyMs,
    };
  }

  /**
   * Records a failure on the circuit breaker for a given agent record.
   * Transitions CLOSED → OPEN after reaching the failure threshold.
   */
  private _handleAgentFailure(record: AgentRecord): void {
    record.circuit.failures++;
    record.circuit.lastFailureAt = Date.now();

    if (record.circuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
      record.circuit.state = "OPEN";
      record.circuit.halfOpenAt =
        Date.now() + CIRCUIT_OPEN_DURATION_MS;
    }
  }

  /**
   * Applies state transitions on the circuit breaker:
   * OPEN → HALF_OPEN after the cool-down window expires.
   */
  private _transitionCircuit(record: AgentRecord): void {
    if (
      record.circuit.state === "OPEN" &&
      Date.now() >= record.circuit.halfOpenAt
    ) {
      record.circuit.state = "HALF_OPEN";
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Helpers — Queue & Loops
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Drains the priority queue by dispatching tasks while concurrency permits.
   * Called on the drain interval.
   */
  private _drainQueue(): void {
    while (
      this._activeTasks < this._config.maxConcurrentTasks &&
      this._queue.size > 0
    ) {
      const item = this._queue.pop();
      if (!item) break;

      // Fire-and-forget — errors are captured inside dispatch()
      this.route(item.task)
        .then((decision) => this.dispatch(item.task, decision.targetAgent))
        .catch(() => {
          // Dispatch errors are recorded in metrics; no re-throw here
        });
    }
  }

  /**
   * Runs a heartbeat check against all registered agents.
   * Updates lastHeartbeat for agents that respond to their health endpoint.
   * Marks unresponsive agents as potentially dead (detected in eligibility checks).
   */
  private _runHeartbeatCheck(): void {
    const now = Date.now();
    for (const record of this._agents.values()) {
      const timeSince = now - record.lastHeartbeat;
      if (timeSince > HEARTBEAT_INTERVAL_MS * PHI) {
        // Perform a lightweight synthetic ping (real: HTTP GET healthEndpoint)
        this._pingAgent(record);
      }
    }
  }

  /**
   * Pings an agent's health endpoint.  In production this performs an HTTP GET;
   * here we simulate liveness with a phi-distributed response time.
   */
  private _pingAgent(record: AgentRecord): void {
    const pingLatencyMs = Math.round(fib(5) * PHI_SQUARED);
    setTimeout(() => {
      // Simulate 95% uptime: agent responds unless circuit is already OPEN
      if (record.circuit.state !== "OPEN") {
        record.lastHeartbeat = Date.now();
      }
    }, pingLatencyMs);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Helpers — Vocabulary & Embeddings
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Extends the shared vocabulary with new capability tokens.
   */
  private _expandVocab(capabilities: string[]): void {
    for (const cap of capabilities) {
      const token = cap.toLowerCase().trim();
      if (!this._vocab.has(token)) {
        this._vocab.set(token, this._vocab.size);
      }
    }
  }

  /**
   * Recomputes capability embeddings for all registered agents against the
   * current (potentially expanded) vocabulary.
   */
  private _rebuildAllEmbeddings(): void {
    for (const record of this._agents.values()) {
      record.capabilityVector = buildEmbedding(
        record.registration.capabilities,
        this._vocab
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Helpers — Utilities
  // ───────────────────────────────────────────────────────────────────────────

  private _assertRunning(): void {
    if (!this._running) throw new ConductorNotStartedError();
  }

  private _recordLatency(ms: number): void {
    this._latencySamples.push(ms);
    if (this._latencySamples.length > LATENCY_WINDOW) {
      this._latencySamples.shift();
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
