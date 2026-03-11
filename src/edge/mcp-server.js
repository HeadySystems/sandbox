/**
 * ∞ Heady™ MCP Server — Model Context Protocol Server
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

'use strict';

const EventEmitter = require('events');
const http         = require('http');

// ─────────────────────────────────────────────
// MCP Protocol Constants
// ─────────────────────────────────────────────

const MCP_VERSION     = '2024-11-05';
const SERVER_NAME     = 'headymcp';
const SERVER_VERSION  = '4.0.0';

/** Tool categories */
const TOOL_CATEGORIES = {
  MEMORY:        'memory',
  ORCHESTRATION: 'orchestration',
  DEPLOYMENT:    'deployment',
  HEALTH:        'health',
  RESEARCH:      'research',
  CODE:          'code',
  CREATIVE:      'creative',
};

// ─────────────────────────────────────────────
// Tool Registry
// ─────────────────────────────────────────────

/**
 * @typedef {object} ToolDefinition
 * @property {string}   name
 * @property {string}   description
 * @property {string}   category    One of TOOL_CATEGORIES
 * @property {object}   inputSchema  JSON Schema for the tool's input
 * @property {function} handler     Async (args, session) => ToolResult
 */

/**
 * @typedef {object} ToolResult
 * @property {Array<{type: string, text?: string, data?: string, mimeType?: string}>} content
 * @property {boolean} [isError]
 */

/**
 * Central registry for MCP tools.
 * Supports registration, lookup, and schema listing.
 */
class ToolRegistry {
  constructor() {
    /** @type {Map<string, ToolDefinition>} */
    this._tools = new Map();
  }

  /**
   * Register a tool.
   * @param {ToolDefinition} def
   */
  register(def) {
    if (!def.name)     throw new Error('Tool must have a name');
    if (!def.handler)  throw new Error(`Tool "${def.name}" must have a handler`);
    this._tools.set(def.name, def);
  }

  /**
   * Register multiple tools at once.
   * @param {ToolDefinition[]} defs
   */
  registerAll(defs) {
    for (const def of defs) this.register(def);
  }

  /**
   * Get a tool by name.
   * @param {string} name
   * @returns {ToolDefinition|undefined}
   */
  get(name) { return this._tools.get(name); }

  /**
   * List all tools in MCP schema format.
   * @returns {Array<{name: string, description: string, inputSchema: object}>}
   */
  list() {
    return [...this._tools.values()].map(t => ({
      name:        t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
    }));
  }

  /** @returns {number} */
  get size() { return this._tools.size; }
}

// ─────────────────────────────────────────────
// Built-in Heady™ Tools (31 tools)
// ─────────────────────────────────────────────

/**
 * Build and return all 31 built-in Heady™ MCP tools.
 * Handlers are stubs that emit semantic responses —
 * real implementations are injected via setDependencies().
 *
 * @param {object} deps  Injected dependencies (inference, memory, orchestrator, …)
 * @returns {ToolDefinition[]}
 */
function buildBuiltinTools(deps = {}) {
  const { inference, memory, orchestrator, storyDriver, patternEngine, beeFactory } = deps;

  const _text = (text) => ({ content: [{ type: 'text', text }] });
  const _json = (obj)  => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
  const _err  = (msg)  => ({ content: [{ type: 'text', text: `Error: ${msg}` }], isError: true });

  return [
    // ── Memory Tools ──────────────────────────────
    {
      name:        'memory_store',
      description: 'Store a key-value pair in Heady™ vector memory with optional namespace.',
      category:    TOOL_CATEGORIES.MEMORY,
      inputSchema: {
        type: 'object',
        properties: {
          key:       { type: 'string', description: 'Unique memory key' },
          value:     { type: 'string', description: 'Content to store' },
          namespace: { type: 'string', description: 'Memory namespace (default: global)', default: 'global' },
        },
        required: ['key', 'value'],
      },
      async handler(args, session) {
        if (memory?.store) await memory.store(args.key, args.value, args.namespace);
        return _text(`Stored "${args.key}" in namespace "${args.namespace ?? 'global'}".`);
      },
    },
    {
      name:        'memory_retrieve',
      description: 'Retrieve a stored memory entry by key.',
      category:    TOOL_CATEGORIES.MEMORY,
      inputSchema: {
        type: 'object',
        properties: {
          key:       { type: 'string' },
          namespace: { type: 'string', default: 'global' },
        },
        required: ['key'],
      },
      async handler(args, session) {
        const value = memory?.get ? await memory.get(args.key, args.namespace) : null;
        if (!value) return _text(`No entry found for key "${args.key}".`);
        return _text(value);
      },
    },
    {
      name:        'memory_search',
      description: 'Semantic search through Heady™ vector memory.',
      category:    TOOL_CATEGORIES.MEMORY,
      inputSchema: {
        type: 'object',
        properties: {
          query:     { type: 'string', description: 'Semantic search query' },
          k:         { type: 'number', description: 'Top-k results', default: 5 },
          namespace: { type: 'string', default: 'global' },
        },
        required: ['query'],
      },
      async handler(args, session) {
        const results = memory?.search ? await memory.search(args.query, args.k ?? 5, args.namespace) : [];
        return _json(results);
      },
    },
    {
      name:        'memory_list',
      description: 'List all memory keys in a namespace.',
      category:    TOOL_CATEGORIES.MEMORY,
      inputSchema: {
        type: 'object',
        properties: { namespace: { type: 'string', default: 'global' } },
      },
      async handler(args) {
        const keys = memory?.list ? await memory.list(args.namespace) : [];
        return _json(keys);
      },
    },
    {
      name:        'memory_delete',
      description: 'Delete a memory entry by key.',
      category:    TOOL_CATEGORIES.MEMORY,
      inputSchema: {
        type: 'object',
        properties: {
          key:       { type: 'string' },
          namespace: { type: 'string', default: 'global' },
        },
        required: ['key'],
      },
      async handler(args) {
        if (memory?.delete) await memory.delete(args.key, args.namespace);
        return _text(`Deleted key "${args.key}" from "${args.namespace ?? 'global'}".`);
      },
    },

    // ── Orchestration Tools ───────────────────────
    {
      name:        'pipeline_run',
      description: 'Trigger a Heady™ pipeline by name with optional parameters.',
      category:    TOOL_CATEGORIES.ORCHESTRATION,
      inputSchema: {
        type: 'object',
        properties: {
          pipeline: { type: 'string', description: 'Pipeline name' },
          params:   { type: 'object', description: 'Pipeline input parameters' },
          async:    { type: 'boolean', default: false },
        },
        required: ['pipeline'],
      },
      async handler(args, session) {
        if (!orchestrator?.run) return _err('Orchestrator not connected');
        const run = await orchestrator.run(args.pipeline, args.params ?? {}, { async: args.async });
        return _json(run);
      },
    },
    {
      name:        'pipeline_status',
      description: 'Get the status of a running or completed pipeline run.',
      category:    TOOL_CATEGORIES.ORCHESTRATION,
      inputSchema: {
        type: 'object',
        properties: { runId: { type: 'string' } },
        required:   ['runId'],
      },
      async handler(args) {
        const status = orchestrator?.getStatus ? await orchestrator.getStatus(args.runId) : null;
        if (!status) return _err(`Run "${args.runId}" not found`);
        return _json(status);
      },
    },
    {
      name:        'pipeline_list',
      description: 'List all available pipelines and their descriptions.',
      category:    TOOL_CATEGORIES.ORCHESTRATION,
      inputSchema: { type: 'object', properties: {} },
      async handler() {
        const list = orchestrator?.listPipelines ? await orchestrator.listPipelines() : [];
        return _json(list);
      },
    },
    {
      name:        'bee_spawn',
      description: 'Spawn an ephemeral Heady™ Bee agent for a specific task.',
      category:    TOOL_CATEGORIES.ORCHESTRATION,
      inputSchema: {
        type: 'object',
        properties: {
          domain:    { type: 'string', description: 'Bee domain specialization' },
          task:      { type: 'string', description: 'Task description' },
          config:    { type: 'object', description: 'Optional bee configuration' },
        },
        required: ['task'],
      },
      async handler(args, session) {
        if (!beeFactory?.spawnBee) return _err('Bee factory not connected');
        const bee = await beeFactory.spawnBee({
          domain: args.domain ?? 'general',
          task:   args.task,
          ...args.config,
        });
        return _json({ beeId: bee.id, domain: bee.domain, status: bee.status });
      },
    },
    {
      name:        'bee_list',
      description: 'List all active Heady™ Bee agents.',
      category:    TOOL_CATEGORIES.ORCHESTRATION,
      inputSchema: {
        type: 'object',
        properties: { domain: { type: 'string' } },
      },
      async handler(args) {
        const bees = beeFactory?.listBees ? beeFactory.listBees(args.domain) : [];
        return _json(bees);
      },
    },

    // ── Deployment Tools ──────────────────────────
    {
      name:        'deploy_service',
      description: 'Deploy a Heady™ service to its target environment.',
      category:    TOOL_CATEGORIES.DEPLOYMENT,
      inputSchema: {
        type: 'object',
        properties: {
          service: { type: 'string' },
          version: { type: 'string' },
          target:  { type: 'string', enum: ['production', 'staging', 'dev'], default: 'staging' },
          flags:   { type: 'object' },
        },
        required: ['service'],
      },
      async handler(args) {
        if (!orchestrator?.deploy) return _err('Orchestrator not connected');
        const result = await orchestrator.deploy(args.service, args.version, args.target, args.flags);
        return _json(result);
      },
    },
    {
      name:        'rollback_service',
      description: 'Rollback a service to a previous version.',
      category:    TOOL_CATEGORIES.DEPLOYMENT,
      inputSchema: {
        type: 'object',
        properties: {
          service:    { type: 'string' },
          toVersion:  { type: 'string' },
        },
        required: ['service', 'toVersion'],
      },
      async handler(args) {
        if (!orchestrator?.rollback) return _err('Orchestrator not connected');
        const result = await orchestrator.rollback(args.service, args.toVersion);
        return _json(result);
      },
    },
    {
      name:        'deployment_history',
      description: 'Get deployment history for a service.',
      category:    TOOL_CATEGORIES.DEPLOYMENT,
      inputSchema: {
        type: 'object',
        properties: {
          service: { type: 'string' },
          limit:   { type: 'number', default: 10 },
        },
        required: ['service'],
      },
      async handler(args) {
        const history = orchestrator?.deploymentHistory
          ? await orchestrator.deploymentHistory(args.service, args.limit)
          : [];
        return _json(history);
      },
    },

    // ── Health Tools ──────────────────────────────
    {
      name:        'health_check',
      description: 'Run a health check across all Heady™ services.',
      category:    TOOL_CATEGORIES.HEALTH,
      inputSchema: { type: 'object', properties: { service: { type: 'string' } } },
      async handler(args) {
        const results = orchestrator?.healthCheck
          ? await orchestrator.healthCheck(args.service)
          : { status: 'unknown' };
        return _json(results);
      },
    },
    {
      name:        'system_status',
      description: 'Get comprehensive system status including all subsystems.',
      category:    TOOL_CATEGORIES.HEALTH,
      inputSchema: { type: 'object', properties: {} },
      async handler() {
        const status = {
          platform:  SERVER_NAME,
          version:   SERVER_VERSION,
          timestamp: new Date().toISOString(),
          uptime:    process.uptime(),
        };
        return _json(status);
      },
    },
    {
      name:        'get_metrics',
      description: 'Retrieve system metrics for a time window.',
      category:    TOOL_CATEGORIES.HEALTH,
      inputSchema: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['1h', '6h', '24h', '7d'], default: '1h' },
          metric: { type: 'string' },
        },
      },
      async handler(args) {
        const metrics = orchestrator?.getMetrics
          ? await orchestrator.getMetrics(args.period, args.metric)
          : {};
        return _json(metrics);
      },
    },
    {
      name:        'trigger_healing',
      description: 'Manually trigger self-healing for a service.',
      category:    TOOL_CATEGORIES.HEALTH,
      inputSchema: {
        type: 'object',
        properties: {
          service: { type: 'string' },
          reason:  { type: 'string' },
        },
        required: ['service'],
      },
      async handler(args) {
        const result = orchestrator?.triggerHealing
          ? await orchestrator.triggerHealing(args.service, args.reason)
          : { initiated: true };
        return _json(result);
      },
    },

    // ── Research Tools ────────────────────────────
    {
      name:        'research',
      description: 'Perform a deep research query using Perplexity Sonar.',
      category:    TOOL_CATEGORIES.RESEARCH,
      inputSchema: {
        type: 'object',
        properties: {
          query:    { type: 'string' },
          depth:    { type: 'string', enum: ['quick', 'deep'], default: 'quick' },
          format:   { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
        },
        required: ['query'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const res = await inference.infer({
          prompt:    args.query,
          taskType:  'research',
          sessionId: session?.id,
        });
        return _text(res.text);
      },
    },
    {
      name:        'summarize',
      description: 'Summarize a block of text or document.',
      category:    TOOL_CATEGORIES.RESEARCH,
      inputSchema: {
        type: 'object',
        properties: {
          text:   { type: 'string' },
          style:  { type: 'string', enum: ['brief', 'detailed', 'bullet'], default: 'brief' },
          length: { type: 'string', enum: ['short', 'medium', 'long'],    default: 'medium' },
        },
        required: ['text'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const prompt = `Summarize the following text in ${args.style} ${args.length} format:\n\n${args.text}`;
        const res    = await inference.infer({ prompt, taskType: 'documentation', sessionId: session?.id });
        return _text(res.text);
      },
    },
    {
      name:        'pattern_query',
      description: 'Query learned behavioral patterns for insights and recommendations.',
      category:    TOOL_CATEGORIES.RESEARCH,
      inputSchema: {
        type: 'object',
        properties: {
          query:    { type: 'string' },
          taskType: { type: 'string' },
          limit:    { type: 'number', default: 5 },
        },
        required: ['query'],
      },
      async handler(args) {
        if (!patternEngine) return _err('Pattern engine not connected');
        const results = await patternEngine.search(args.query, args.limit);
        return _json(results.map(r => ({
          type:           r.type,
          recommendation: r.recommendation,
          confidence:     r.confidence,
          occurrences:    r.occurrences,
        })));
      },
    },
    {
      name:        'story_timeline',
      description: 'Get the Heady™Autobiographer system event timeline.',
      category:    TOOL_CATEGORIES.RESEARCH,
      inputSchema: {
        type: 'object',
        properties: {
          limit:     { type: 'number', default: 20 },
          service:   { type: 'string' },
          eventType: { type: 'string' },
          since:     { type: 'number' },
        },
      },
      async handler(args) {
        if (!storyDriver) return _err('Story driver not connected');
        const timeline = storyDriver.timeline({
          limit:     args.limit,
          service:   args.service,
          eventType: args.eventType,
          since:     args.since,
        });
        const digest = timeline.map(e => `[${e.iso}] ${e.narrative}`).join('\n');
        return _text(digest || 'No events found.');
      },
    },

    // ── Code Tools ────────────────────────────────
    {
      name:        'code_generate',
      description: 'Generate code using the optimal AI model for code generation.',
      category:    TOOL_CATEGORIES.CODE,
      inputSchema: {
        type: 'object',
        properties: {
          prompt:   { type: 'string' },
          language: { type: 'string', default: 'javascript' },
          context:  { type: 'string' },
        },
        required: ['prompt'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const fullPrompt = args.context
          ? `Context:\n${args.context}\n\nTask:\n${args.prompt}\n\nLanguage: ${args.language}`
          : args.prompt;
        const res = await inference.infer({ prompt: fullPrompt, taskType: 'code_generation', sessionId: session?.id });
        return _text(res.text);
      },
    },
    {
      name:        'code_review',
      description: 'Review code for bugs, security issues, and best practices.',
      category:    TOOL_CATEGORIES.CODE,
      inputSchema: {
        type: 'object',
        properties: {
          code:     { type: 'string' },
          language: { type: 'string' },
          focus:    { type: 'string', enum: ['all', 'security', 'performance', 'style'], default: 'all' },
        },
        required: ['code'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const prompt = `Review the following ${args.language ?? ''} code (focus: ${args.focus ?? 'all'}):\n\n\`\`\`\n${args.code}\n\`\`\``;
        const res    = await inference.infer({ prompt, taskType: 'code_review', sessionId: session?.id });
        return _text(res.text);
      },
    },
    {
      name:        'architecture_design',
      description: 'Design or review system architecture with AI assistance.',
      category:    TOOL_CATEGORIES.CODE,
      inputSchema: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          constraints: { type: 'string' },
          output:      { type: 'string', enum: ['diagram', 'prose', 'components'], default: 'prose' },
        },
        required: ['description'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const prompt = `Design a system architecture for: ${args.description}\n${args.constraints ? `Constraints: ${args.constraints}` : ''}`;
        const res    = await inference.infer({ prompt, taskType: 'architecture', sessionId: session?.id });
        return _text(res.text);
      },
    },
    {
      name:        'security_scan',
      description: 'Perform a security analysis of code or configuration.',
      category:    TOOL_CATEGORIES.CODE,
      inputSchema: {
        type: 'object',
        properties: {
          target:      { type: 'string', description: 'Code or config to scan' },
          targetType:  { type: 'string', enum: ['code', 'config', 'api', 'infra'], default: 'code' },
        },
        required: ['target'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const prompt = `Perform a security analysis of this ${args.targetType}:\n\n${args.target}`;
        const res    = await inference.infer({ prompt, taskType: 'security', sessionId: session?.id });
        return _text(res.text);
      },
    },

    // ── Creative Tools ────────────────────────────
    {
      name:        'creative_write',
      description: 'Generate creative content: stories, copy, marketing, poetry.',
      category:    TOOL_CATEGORIES.CREATIVE,
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          style:  { type: 'string' },
          length: { type: 'string', enum: ['short', 'medium', 'long'], default: 'medium' },
        },
        required: ['prompt'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const prompt = args.style
          ? `${args.prompt}\n\nStyle: ${args.style}. Length: ${args.length ?? 'medium'}.`
          : args.prompt;
        const res    = await inference.infer({ prompt, taskType: 'creative', sessionId: session?.id });
        return _text(res.text);
      },
    },
    {
      name:        'document_generate',
      description: 'Generate technical documentation, READMEs, API docs.',
      category:    TOOL_CATEGORIES.CREATIVE,
      inputSchema: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          type:    { type: 'string', enum: ['readme', 'api', 'guide', 'spec'], default: 'guide' },
          context: { type: 'string' },
        },
        required: ['subject'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const prompt = `Generate ${args.type} documentation for: ${args.subject}\n${args.context ?? ''}`;
        const res    = await inference.infer({ prompt, taskType: 'documentation', sessionId: session?.id });
        return _text(res.text);
      },
    },
    {
      name:        'quick_ask',
      description: 'Quick single-turn question with fast-track routing.',
      category:    TOOL_CATEGORIES.CREATIVE,
      inputSchema: {
        type: 'object',
        properties: { question: { type: 'string' } },
        required: ['question'],
      },
      async handler(args, session) {
        if (!inference) return _err('Inference gateway not connected');
        const res = await inference.infer({ prompt: args.question, taskType: 'quick', sessionId: session?.id });
        return _text(res.text);
      },
    },
  ];
}

// ─────────────────────────────────────────────
// Session Manager
// ─────────────────────────────────────────────

/**
 * @typedef {object} MCPSession
 * @property {string}   id
 * @property {string}   transport   'stdio' | 'sse'
 * @property {boolean}  initialized
 * @property {Date}     createdAt
 * @property {object}   clientInfo
 * @property {Map}      context     Per-session context store
 */

class SessionManager {
  constructor() {
    /** @type {Map<string, MCPSession>} */
    this._sessions = new Map();
  }

  create(transport) {
    const id = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const session = {
      id,
      transport,
      initialized: false,
      createdAt:   new Date(),
      clientInfo:  {},
      context:     new Map(),
    };
    this._sessions.set(id, session);
    return session;
  }

  get(id) { return this._sessions.get(id); }

  delete(id) { this._sessions.delete(id); }

  mark_initialized(id, clientInfo) {
    const s = this._sessions.get(id);
    if (s) { s.initialized = true; s.clientInfo = clientInfo ?? {}; }
  }

  /** @returns {number} */
  get size() { return this._sessions.size; }

  list() { return [...this._sessions.values()]; }
}

// ─────────────────────────────────────────────
// JSON-RPC 2.0 Helpers
// ─────────────────────────────────────────────

function jsonRpcResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

const JSONRPC_ERRORS = {
  PARSE_ERROR:      -32700,
  INVALID_REQUEST:  -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS:   -32602,
  INTERNAL_ERROR:   -32603,
};

// ─────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────

/**
 * @typedef {object} MCPServerConfig
 * @property {number}  [ssePort=3002]     Port for SSE transport
 * @property {boolean} [enableStdio=true] Enable stdio transport
 * @property {boolean} [enableSSE=true]   Enable SSE transport
 * @property {object}  [dependencies]     Injected service dependencies
 */

/**
 * Heady™ MCP Server.
 *
 * Implements the Model Context Protocol (MCP) spec v2024-11-05.
 * Exposes 31 tools across 7 categories via stdio and SSE transports.
 *
 * Transport: stdio — reads JSON-RPC from stdin, writes to stdout.
 * Transport: SSE  — HTTP server with /sse endpoint for event streaming.
 *
 * @extends EventEmitter
 */
class MCPServer extends EventEmitter {
  /**
   * @param {MCPServerConfig} [config]
   */
  constructor(config = {}) {
    super();
    this.config    = config;
    this.tools     = new ToolRegistry();
    this.sessions  = new SessionManager();
    this._ssePort  = config.ssePort  ?? 3002;

    // Register built-in tools
    const builtins = buildBuiltinTools(config.dependencies ?? {});
    this.tools.registerAll(builtins);

    this._httpServer = null;
    this._sseClients = new Map(); // sessionId → {res: ServerResponse}
  }

  // ── Dependency Injection ──

  /**
   * Inject runtime dependencies (inference, memory, orchestrator, etc.).
   * Can be called after construction to avoid circular deps.
   * @param {object} deps
   */
  setDependencies(deps) {
    const builtins = buildBuiltinTools(deps);
    this.tools.registerAll(builtins);
    this.emit('dependencies_set', { count: builtins.length });
  }

  /**
   * Register additional custom tools.
   * @param {ToolDefinition|ToolDefinition[]} defs
   */
  registerTool(defs) {
    const arr = Array.isArray(defs) ? defs : [defs];
    this.tools.registerAll(arr);
    this.emit('tools_registered', { names: arr.map(t => t.name) });
  }

  // ── Start / Stop ──

  /**
   * Start the MCP server.
   * @param {object} [opts]
   * @param {boolean} [opts.stdio]   Enable stdio transport (default: config.enableStdio)
   * @param {boolean} [opts.sse]     Enable SSE transport (default: config.enableSSE)
   */
  async start(opts = {}) {
    const useStdio = opts.stdio ?? this.config.enableStdio ?? true;
    const useSSE   = opts.sse   ?? this.config.enableSSE   ?? true;

    if (useSSE)   this._startSSEServer();
    if (useStdio) this._startStdioTransport();

    this.emit('started', {
      name:     SERVER_NAME,
      version:  SERVER_VERSION,
      tools:    this.tools.size,
      transports: [useSSE ? 'sse' : null, useStdio ? 'stdio' : null].filter(Boolean),
    });
  }

  /**
   * Stop the MCP server.
   */
  async stop() {
    if (this._httpServer) {
      await new Promise(r => this._httpServer.close(r));
      this._httpServer = null;
    }
    this.emit('stopped');
  }

  // ── Message Handling ──

  /**
   * Handle a single MCP JSON-RPC message.
   * @param {object|string} rawMessage
   * @param {MCPSession} session
   * @returns {Promise<object>}  JSON-RPC response or null (for notifications)
   */
  async handleMessage(rawMessage, session) {
    let msg;
    try {
      msg = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    } catch {
      return jsonRpcError(null, JSONRPC_ERRORS.PARSE_ERROR, 'Parse error');
    }

    const { id, method, params } = msg;

    // Notification — no response
    if (id === undefined) {
      await this._dispatchNotification(method, params, session).catch(() => {});
      return null;
    }

    try {
      const result = await this._dispatchRequest(method, params, session);
      return jsonRpcResponse(id, result);
    } catch (err) {
      this.emit('handler_error', { method, err });
      return jsonRpcError(id, JSONRPC_ERRORS.INTERNAL_ERROR, err.message);
    }
  }

  async _dispatchRequest(method, params, session) {
    switch (method) {
      case 'initialize':
        return this._handleInitialize(params, session);
      case 'tools/list':
        return this._handleToolsList();
      case 'tools/call':
        return this._handleToolCall(params, session);
      case 'prompts/list':
        return { prompts: [] };
      case 'resources/list':
        return { resources: [] };
      case 'ping':
        return {};
      default:
        throw Object.assign(new Error(`Method not found: ${method}`), { code: JSONRPC_ERRORS.METHOD_NOT_FOUND });
    }
  }

  async _dispatchNotification(method, params, session) {
    if (method === 'notifications/cancelled') {
      this.emit('request_cancelled', { params, sessionId: session?.id });
    }
  }

  _handleInitialize(params, session) {
    this.sessions.mark_initialized(session.id, params?.clientInfo);
    return {
      protocolVersion: MCP_VERSION,
      serverInfo:      { name: SERVER_NAME, version: SERVER_VERSION },
      capabilities:    { tools: { listChanged: false }, prompts: {}, resources: {} },
    };
  }

  _handleToolsList() {
    return { tools: this.tools.list() };
  }

  async _handleToolCall(params, session) {
    const { name, arguments: args = {} } = params ?? {};
    if (!name) throw new Error('tools/call: missing name');
    const tool = this.tools.get(name);
    if (!tool)  throw new Error(`Tool not found: ${name}`);

    this.emit('tool_call', { name, sessionId: session?.id });
    const start  = Date.now();
    let result;
    try {
      result = await tool.handler(args, session);
    } catch (err) {
      result = { content: [{ type: 'text', text: `Tool error: ${err.message}` }], isError: true };
    }
    this.emit('tool_result', { name, sessionId: session?.id, latencyMs: Date.now() - start });
    return result;
  }

  // ── SSE Transport ──

  _startSSEServer() {
    this._httpServer = http.createServer(async (req, res) => {
      if (req.url === '/sse' && req.method === 'GET') {
        this._handleSSEConnect(req, res);
      } else if (req.url === '/message' && req.method === 'POST') {
        await this._handleSSEMessage(req, res);
      } else if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', tools: this.tools.size }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    this._httpServer.listen(this._ssePort, () => {
      this.emit('sse_listening', { port: this._ssePort });
    });
  }

  _handleSSEConnect(req, res) {
    const session = this.sessions.create('sse');
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Session-Id':  session.id,
    });

    this._sseClients.set(session.id, { res });

    // Send endpoint info
    const endpointMsg = `event: endpoint\ndata: /message?sessionId=${session.id}\n\n`;
    res.write(endpointMsg);

    req.on('close', () => {
      this._sseClients.delete(session.id);
      this.sessions.delete(session.id);
      this.emit('sse_disconnected', { sessionId: session.id });
    });

    this.emit('sse_connected', { sessionId: session.id });
  }

  async _handleSSEMessage(req, res) {
    const { sessionId } = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const session       = this.sessions.get(sessionId);
    const client        = this._sseClients.get(sessionId);

    let body = '';
    for await (const chunk of req) body += chunk;

    res.writeHead(202);
    res.end();

    if (!client) return;

    const response = await this.handleMessage(body, session ?? { id: sessionId });
    if (response) {
      client.res.write(`data: ${JSON.stringify(response)}\n\n`);
    }
  }

  // ── Stdio Transport ──

  _startStdioTransport() {
    const session = this.sessions.create('stdio');
    let buffer    = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk) => {
      buffer += chunk;
      // MCP stdio uses newline-delimited JSON
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const response = await this.handleMessage(trimmed, session);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      }
    });

    process.stdin.on('end', () => {
      this.sessions.delete(session.id);
      this.emit('stdio_ended', { sessionId: session.id });
    });

    this.emit('stdio_started', { sessionId: session.id });
  }

  // ── Introspection ──

  /**
   * Full server status snapshot.
   * @returns {object}
   */
  status() {
    return {
      name:     SERVER_NAME,
      version:  SERVER_VERSION,
      tools:    this.tools.size,
      sessions: this.sessions.size,
      sseClients: this._sseClients.size,
    };
  }
}

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

export {

  MCPServer,
  ToolRegistry,
  SessionManager,
  buildBuiltinTools,
  TOOL_CATEGORIES,
  MCP_VERSION,
  SERVER_NAME,
  SERVER_VERSION,
};
