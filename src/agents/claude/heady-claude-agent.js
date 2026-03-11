/**
 * HeadyClaudeAgent — Primary Claude agent definition for Heady ecosystem
 *
 * This agent integrates Claude's capabilities with Heady's sacred geometry
 * architecture, enabling autonomous system management through MCP tools,
 * latent space memory, and phi-based resource allocation.
 *
 * @module HeadyClaudeAgent
 * @version 4.0.0
 * @license Proprietary — HeadySystems Inc.
 */

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

/**
 * Relevance gates for semantic routing decisions
 * Derived from golden ratio conjugate (ψ ≈ 0.618)
 */
const RELEVANCE_GATES = {
  include: PSI * PSI,    // ≈ 0.382 — minimum relevance to act
  boost: PSI,            // ≈ 0.618 — threshold to prioritize
  inject: PSI + 0.1,     // ≈ 0.718 — auto-inject into context
};

/**
 * Agent ring topology — maps agent capabilities to sacred geometry rings
 */
const AGENT_RINGS = {
  central: {
    radius: 0,
    agents: ['heady-soul'],
    role: 'Awareness and values — origin point',
  },
  inner: {
    radius: 1,
    agents: ['heady-brains', 'heady-conductor', 'heady-vinci'],
    role: 'Core processing — reasoning, orchestration, planning',
  },
  middle: {
    radius: PHI,
    agents: ['claude-orchestrator', 'claude-builder', 'claude-diagnostics', 'claude-deployer'],
    role: 'Execution — building, monitoring, deploying',
  },
  outer: {
    radius: PHI * PHI,
    agents: ['claude-researcher', 'claude-swarm-commander', 'claude-vector-ops'],
    role: 'Specialization — research, swarm intelligence, memory',
  },
  governance: {
    radius: PHI * PHI * PHI,
    agents: ['heady-qa', 'heady-guard', 'heady-governance'],
    role: 'Governance — quality, security, policy',
  },
};

/**
 * Claude agent capabilities manifest
 */
const CLAUDE_CAPABILITIES = {
  orchestration: {
    description: 'Full HCFullPipeline lifecycle management',
    tools: ['heady_pipeline_status', 'heady_deploy_run', 'heady_health_ping'],
    ring: 'middle',
  },
  diagnostics: {
    description: 'Deep system health analysis and troubleshooting',
    tools: ['heady_status', 'heady_health_ping', 'heady_config_validate',
            'heady_deps_scan', 'heady_env_audit', 'heady_secrets_scan',
            'heady_conflicts_scan', 'heady_brain_status'],
    ring: 'middle',
  },
  deployment: {
    description: 'Multi-target deployment with validation and rollback',
    tools: ['heady_deploy_run', 'heady_deploy_status', 'heady_deploy_start',
            'heady_deploy_stop', 'heady_codelock_status', 'heady_git_status'],
    ring: 'middle',
  },
  vectorOps: {
    description: 'Latent space vector memory management',
    tools: ['heady_latent_record', 'heady_latent_search', 'heady_latent_status',
            'heady_latent_log', 'latent_store', 'latent_search', 'latent_list'],
    ring: 'outer',
  },
  swarmCommand: {
    description: 'Distributed agent swarm orchestration',
    tools: ['heady_brain_think', 'heady_latent_record', 'heady_code_stats'],
    ring: 'outer',
  },
  codeManagement: {
    description: 'CodeLock-compliant code modifications',
    tools: ['heady_codelock_status', 'heady_codelock_request', 'heady_codelock_approve',
            'heady_write_file', 'heady_read_file', 'heady_search'],
    ring: 'middle',
  },
  translation: {
    description: 'Cross-protocol message translation',
    tools: ['heady_translator_translate', 'heady_translator_decode',
            'heady_translator_adapters', 'heady_translator_bridge'],
    ring: 'outer',
  },
};

/**
 * Route a task to the appropriate capability based on semantic relevance
 * @param {string} taskDescription — Natural language task description
 * @returns {Object} — Matched capability with confidence score
 */
function routeTask(taskDescription) {
  const keywords = {
    orchestration: ['pipeline', 'orchestrate', 'run', 'execute', 'workflow', 'stage'],
    diagnostics: ['health', 'diagnose', 'status', 'check', 'scan', 'audit', 'debug'],
    deployment: ['deploy', 'push', 'ship', 'release', 'production', 'rollback'],
    vectorOps: ['vector', 'memory', 'latent', 'embed', 'semantic', 'search'],
    swarmCommand: ['swarm', 'bee', 'parallel', 'distribute', 'agents', 'concurrent'],
    codeManagement: ['code', 'file', 'edit', 'write', 'lock', 'modify', 'fix'],
    translation: ['translate', 'protocol', 'bridge', 'convert', 'midi', 'websocket'],
  };

  const normalizedTask = taskDescription.toLowerCase();
  const scores = {};

  for (const [capability, words] of Object.entries(keywords)) {
    const matchCount = words.filter(w => normalizedTask.includes(w)).length;
    scores[capability] = matchCount / words.length;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestMatch, bestScore] = sorted[0];

  if (bestScore < RELEVANCE_GATES.include) {
    return { capability: 'diagnostics', confidence: 0.5, fallback: true };
  }

  return {
    capability: bestMatch,
    confidence: bestScore,
    boosted: bestScore >= RELEVANCE_GATES.boost,
    tools: CLAUDE_CAPABILITIES[bestMatch].tools,
    ring: CLAUDE_CAPABILITIES[bestMatch].ring,
  };
}

/**
 * Calculate phi-scaled retry backoff
 * @param {number} attempt — Current attempt number (0-indexed)
 * @returns {number} — Backoff duration in milliseconds
 */
function phiBackoff(attempt) {
  return Math.round(Math.pow(PHI, attempt + 1) * 1000);
}

/**
 * Determine optimal swarm size using Fibonacci sequence
 * @param {number} taskComplexity — Estimated complexity (1-10)
 * @returns {number} — Fibonacci-aligned swarm size
 */
function fibSwarmSize(taskComplexity) {
  const index = Math.min(Math.max(Math.round(taskComplexity), 1), FIB.length - 1);
  return FIB[index];
}

export {
  PHI, PSI, FIB,
  RELEVANCE_GATES,
  AGENT_RINGS,
  CLAUDE_CAPABILITIES,
  routeTask,
  phiBackoff,
  fibSwarmSize,
};
