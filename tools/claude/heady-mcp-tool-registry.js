/**
 * HeadyMCPToolRegistry — Complete registry of MCP tools available to Claude
 * for interacting with the Heady ecosystem.
 *
 * Organized by domain with semantic tags for relevance-based routing.
 *
 * @module HeadyMCPToolRegistry
 * @version 4.0.0
 */

const TOOL_REGISTRY = {
  // ─── SYSTEM STATUS ────────────────────────────────────────────────
  system: {
    heady_status: {
      description: 'Get overall system status — structure, configs, services',
      tags: ['status', 'health', 'system', 'overview'],
      domain: 'diagnostics',
    },
    heady_brain_status: {
      description: 'System Brain overview — ORS score, patterns, recommendations',
      tags: ['brain', 'intelligence', 'ors', 'recommendations'],
      domain: 'diagnostics',
    },
    heady_brain_think: {
      description: 'Ask the System Brain to analyze a situation and recommend actions',
      tags: ['think', 'analyze', 'recommend', 'brain'],
      domain: 'intelligence',
    },
    heady_code_stats: {
      description: 'Project code statistics — lines of code, file counts, language breakdown',
      tags: ['stats', 'code', 'metrics', 'analysis'],
      domain: 'diagnostics',
    },
  },

  // ─── PIPELINE ─────────────────────────────────────────────────────
  pipeline: {
    heady_pipeline_status: {
      description: 'HCFullPipeline configuration and stage definitions',
      tags: ['pipeline', 'stages', 'configuration', 'hcfp'],
      domain: 'orchestration',
    },
  },

  // ─── DEPLOYMENT ───────────────────────────────────────────────────
  deploy: {
    heady_deploy_status: {
      description: 'Auto-deploy system status — scheduler, git state, recent deploys',
      tags: ['deploy', 'status', 'scheduler', 'git'],
      domain: 'deployment',
    },
    heady_deploy_run: {
      description: 'Trigger a single deploy cycle (commit, push, deploy)',
      tags: ['deploy', 'trigger', 'push', 'commit'],
      domain: 'deployment',
    },
    heady_deploy_start: {
      description: 'Start the auto-deploy scheduler',
      tags: ['deploy', 'scheduler', 'start', 'auto'],
      domain: 'deployment',
    },
    heady_deploy_stop: {
      description: 'Stop the auto-deploy scheduler',
      tags: ['deploy', 'scheduler', 'stop'],
      domain: 'deployment',
    },
  },

  // ─── GIT ──────────────────────────────────────────────────────────
  git: {
    heady_git_status: {
      description: 'Show git status — modified, staged, untracked files',
      tags: ['git', 'status', 'changes', 'files'],
      domain: 'codeManagement',
    },
    heady_git_log: {
      description: 'View recent git commits and branch info',
      tags: ['git', 'log', 'history', 'commits'],
      domain: 'codeManagement',
    },
    heady_git_diff: {
      description: 'Show git diff — unstaged changes or diff between branches',
      tags: ['git', 'diff', 'changes', 'compare'],
      domain: 'codeManagement',
    },
  },

  // ─── CODELOCK ─────────────────────────────────────────────────────
  codelock: {
    heady_codelock_status: {
      description: 'Get codebase lock status — who can make changes, pending approvals',
      tags: ['lock', 'status', 'permissions', 'approval'],
      domain: 'codeManagement',
    },
    heady_codelock_lock: {
      description: 'Lock the codebase — blocks all changes until owner approves',
      tags: ['lock', 'block', 'protect'],
      domain: 'codeManagement',
    },
    heady_codelock_unlock: {
      description: 'Unlock the codebase (owner only)',
      tags: ['unlock', 'release', 'allow'],
      domain: 'codeManagement',
    },
    heady_codelock_request: {
      description: 'Request approval to change specific files',
      tags: ['request', 'change', 'approval', 'files'],
      domain: 'codeManagement',
    },
    heady_codelock_approve: {
      description: 'Approve a pending change request',
      tags: ['approve', 'accept', 'allow'],
      domain: 'codeManagement',
    },
    heady_codelock_snapshot: {
      description: 'Take a file integrity snapshot for change detection',
      tags: ['snapshot', 'integrity', 'hash'],
      domain: 'codeManagement',
    },
    heady_codelock_detect: {
      description: 'Detect unauthorized changes since last snapshot',
      tags: ['detect', 'unauthorized', 'changes', 'security'],
      domain: 'security',
    },
  },

  // ─── LATENT SPACE ─────────────────────────────────────────────────
  latent: {
    heady_latent_record: {
      description: 'Record an operation in latent space vector memory',
      tags: ['record', 'vector', 'memory', 'store'],
      domain: 'vectorOps',
    },
    heady_latent_search: {
      description: 'Search latent space by semantic similarity',
      tags: ['search', 'vector', 'semantic', 'find'],
      domain: 'vectorOps',
    },
    heady_latent_status: {
      description: 'Get latent space status — ring buffer, vector store stats',
      tags: ['latent', 'status', 'memory', 'vectors'],
      domain: 'vectorOps',
    },
    heady_latent_log: {
      description: 'View recent operations log from latent space',
      tags: ['log', 'history', 'operations', 'latent'],
      domain: 'vectorOps',
    },
  },

  // ─── TRANSLATOR ───────────────────────────────────────────────────
  translator: {
    heady_translator_status: {
      description: 'HeadyTranslator status — adapters, routes, protocol bridge health',
      tags: ['translator', 'status', 'protocol', 'bridge'],
      domain: 'translation',
    },
    heady_translator_translate: {
      description: 'Translate a message between protocols (MCP, HTTP, WebSocket, UDP, MIDI, TCP)',
      tags: ['translate', 'protocol', 'convert', 'bridge'],
      domain: 'translation',
    },
    heady_translator_adapters: {
      description: 'List all registered protocol adapters',
      tags: ['adapters', 'protocols', 'list'],
      domain: 'translation',
    },
    heady_translator_decode: {
      description: 'Decode raw protocol data into HeadyMessage envelope',
      tags: ['decode', 'raw', 'protocol', 'parse'],
      domain: 'translation',
    },
    heady_translator_bridge: {
      description: 'Start/stop the HTTP bridge server',
      tags: ['bridge', 'http', 'server', 'start', 'stop'],
      domain: 'translation',
    },
  },

  // ─── HEALTH & VALIDATION ──────────────────────────────────────────
  health: {
    heady_health_ping: {
      description: 'Ping all services and report health status',
      tags: ['health', 'ping', 'services', 'availability'],
      domain: 'diagnostics',
    },
    heady_config_validate: {
      description: 'Cross-validate YAML configs',
      tags: ['config', 'validate', 'yaml', 'check'],
      domain: 'diagnostics',
    },
    heady_env_audit: {
      description: 'Audit .env — find missing keys, empty values',
      tags: ['env', 'audit', 'environment', 'variables'],
      domain: 'diagnostics',
    },
    heady_deps_scan: {
      description: 'Scan package.json for outdated/vulnerable dependencies',
      tags: ['deps', 'scan', 'packages', 'vulnerabilities'],
      domain: 'diagnostics',
    },
    heady_secrets_scan: {
      description: 'Scan codebase for accidentally committed secrets',
      tags: ['secrets', 'scan', 'security', 'keys'],
      domain: 'security',
    },
    heady_conflicts_scan: {
      description: 'Scan for git merge conflicts',
      tags: ['conflicts', 'merge', 'git', 'scan'],
      domain: 'codeManagement',
    },
  },

  // ─── FILES & PROJECT ──────────────────────────────────────────────
  files: {
    heady_project_tree: {
      description: 'Show project directory structure',
      tags: ['tree', 'structure', 'directories', 'project'],
      domain: 'codeManagement',
    },
    heady_read_file: {
      description: 'Read a file from the Heady project',
      tags: ['read', 'file', 'content', 'view'],
      domain: 'codeManagement',
    },
    heady_write_file: {
      description: 'Write content to a file (CodeLock compliant)',
      tags: ['write', 'file', 'create', 'modify'],
      domain: 'codeManagement',
    },
    heady_search: {
      description: 'Search for text patterns across project files',
      tags: ['search', 'grep', 'find', 'pattern'],
      domain: 'codeManagement',
    },
    heady_read_config: {
      description: 'Read a config file from configs/ directory',
      tags: ['config', 'read', 'yaml', 'json'],
      domain: 'codeManagement',
    },
    heady_list_configs: {
      description: 'List all configuration files',
      tags: ['configs', 'list', 'files'],
      domain: 'codeManagement',
    },
  },

  // ─── PATTERNS & OPTIMIZATION ──────────────────────────────────────
  patterns: {
    heady_patterns_list: {
      description: 'List all implemented, planned, and available patterns',
      tags: ['patterns', 'list', 'architecture', 'design'],
      domain: 'intelligence',
    },
    heady_patterns_evaluate: {
      description: 'Evaluate a pattern for potential adoption',
      tags: ['pattern', 'evaluate', 'assess', 'adopt'],
      domain: 'intelligence',
    },
    heady_quickfix: {
      description: 'Run automated fixes — console.logs, whitespace, dead imports',
      tags: ['fix', 'clean', 'lint', 'autofix'],
      domain: 'codeManagement',
    },
    heady_cost_report: {
      description: 'Generate cost report — API usage, cloud spend',
      tags: ['cost', 'budget', 'spending', 'resources'],
      domain: 'diagnostics',
    },
    heady_docs_freshness: {
      description: 'Check documentation freshness — stale docs, missing owners',
      tags: ['docs', 'freshness', 'stale', 'documentation'],
      domain: 'diagnostics',
    },
  },

  // ─── LIQUID NODES (External Integrations) ─────────────────────────
  liquid: {
    github_list_repos: { description: 'List GitHub repositories', tags: ['github', 'repos', 'list'], domain: 'integration' },
    github_repo_info: { description: 'Get GitHub repo details', tags: ['github', 'repo', 'info'], domain: 'integration' },
    github_search_code: { description: 'Search code across GitHub', tags: ['github', 'search', 'code'], domain: 'integration' },
    gist_list: { description: 'List GitHub Gists', tags: ['gist', 'list', 'github'], domain: 'integration' },
    gist_create: { description: 'Create a new Gist', tags: ['gist', 'create', 'share'], domain: 'integration' },
    cloudflare_list_zones: { description: 'List Cloudflare DNS zones', tags: ['cloudflare', 'dns', 'zones'], domain: 'integration' },
    cloudflare_dns_records: { description: 'Get DNS records', tags: ['cloudflare', 'dns', 'records'], domain: 'integration' },
    cloudflare_list_workers: { description: 'List Cloudflare Workers', tags: ['cloudflare', 'workers', 'list'], domain: 'integration' },
    cloudflare_list_pages: { description: 'List Cloudflare Pages', tags: ['cloudflare', 'pages', 'list'], domain: 'integration' },
    vertex_list_models: { description: 'List Vertex AI models', tags: ['vertex', 'ai', 'models'], domain: 'integration' },
    vertex_predict: { description: 'Run Vertex AI prediction', tags: ['vertex', 'predict', 'inference'], domain: 'integration' },
    aistudio_generate: { description: 'Generate text with Gemini', tags: ['gemini', 'generate', 'ai'], domain: 'integration' },
    latent_store: { description: 'Store in latent space', tags: ['latent', 'store', 'vector'], domain: 'vectorOps' },
    latent_search: { description: 'Search latent space', tags: ['latent', 'search', 'semantic'], domain: 'vectorOps' },
    latent_list: { description: 'List latent space entries', tags: ['latent', 'list', 'all'], domain: 'vectorOps' },
    latent_delete: { description: 'Delete latent space entry', tags: ['latent', 'delete', 'remove'], domain: 'vectorOps' },
    liquid_nodes_status: { description: 'Get all liquid node connection status', tags: ['liquid', 'nodes', 'status'], domain: 'integration' },
  },
};

/**
 * Get all tools for a given domain
 * @param {string} domain — Domain name
 * @returns {string[]} — Array of tool names
 */
function getToolsForDomain(domain) {
  const tools = [];
  for (const category of Object.values(TOOL_REGISTRY)) {
    for (const [toolName, toolDef] of Object.entries(category)) {
      if (toolDef.domain === domain) {
        tools.push(toolName);
      }
    }
  }
  return tools;
}

/**
 * Search tools by semantic tags
 * @param {string[]} searchTags — Tags to match
 * @returns {Object[]} — Matching tools with relevance scores
 */
function searchTools(searchTags) {
  const results = [];
  const normalizedSearch = searchTags.map(t => t.toLowerCase());

  for (const category of Object.values(TOOL_REGISTRY)) {
    for (const [toolName, toolDef] of Object.entries(category)) {
      const matchCount = toolDef.tags.filter(t => normalizedSearch.includes(t)).length;
      if (matchCount > 0) {
        const relevance = matchCount / Math.max(toolDef.tags.length, normalizedSearch.length);
        results.push({ tool: toolName, ...toolDef, relevance });
      }
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Get the complete tool count
 * @returns {number} — Total number of registered tools
 */
function getToolCount() {
  let count = 0;
  for (const category of Object.values(TOOL_REGISTRY)) {
    count += Object.keys(category).length;
  }
  return count;
}

export { TOOL_REGISTRY, getToolsForDomain, searchTools, getToolCount };
