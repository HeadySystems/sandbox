---
name: heady-bee-swarm-ops
description: Use when managing HeadyBee agent worker lifecycle, template registries, swarm coordination, or working with any of the 30+ bee types (agents-bee, brain-bee, config-bee, creative-bee, deployment-bee, device-provisioner-bee, engines-bee, intelligence-bee, lifecycle-bee, middleware-bee, ops-bee, orchestration-bee, pipeline-bee, providers-bee, refactor-bee, routes-bee, services-bee, sync-projection-bee, vector-ops-bee, vector-template-bee, connectors-bee, auto-success-bee). Keywords include bee, swarm, worker, template registry, agent factory, bee lifecycle, HeadyBee, and bee orchestration.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™Bee Swarm Operations

## When to Use This Skill

Use this skill when the user needs to:
- Create, manage, or coordinate HeadyBee agent workers
- Work with the bee template registry or bee factory
- Debug bee lifecycle issues (spawn, execute, retire)
- Optimize swarm coordination across multiple bee types
- Implement new bee types or extend existing ones

## Heady™Bee Type Registry

All bees follow the BaseHeadyBee interface with spawn(), execute(), report(), retire() lifecycle.

| Bee Type | Module | Role |
|---|---|---|
| agents-bee | src/bees/agents-bee.js | Manages agent creation and routing |
| auth-provider-bee | src/bees/auth-provider-bee.js | Authentication provider orchestration |
| auto-success-bee | src/bees/auto-success-bee.js | Automated success pipeline execution |
| brain-bee | src/bees/brain-bee.js | LLM provider routing and model selection |
| config-bee | src/bees/config-bee.js | Configuration management and validation |
| connectors-bee | src/bees/connectors-bee.js | External service connector management |
| creative-bee | src/bees/creative-bee.js | Creative content generation (images, music, text) |
| deployment-bee | src/bees/deployment-bee.js | Cloud deployment automation |
| device-provisioner-bee | src/bees/device-provisioner-bee.js | Device onboarding and provisioning |
| documentation-bee | src/bees/documentation-bee.js | Auto-documentation generation |
| engines-bee | src/bees/engines-bee.js | Engine orchestration and lifecycle |
| governance-bee | src/bees/governance-bee.js | Policy enforcement and compliance |
| health-bee | src/bees/health-bee.js | Health probe execution and reporting |
| intelligence-bee | src/bees/intelligence-bee.js | Intelligence gathering and analysis |
| lifecycle-bee | src/bees/lifecycle-bee.js | Service lifecycle management |
| mcp-bee | src/bees/mcp-bee.js | MCP protocol tool execution |
| memory-bee | src/bees/memory-bee.js | Memory operations (store, retrieve, embed) |
| middleware-bee | src/bees/middleware-bee.js | Middleware chain management |
| midi-bee | src/bees/midi-bee.js | MIDI event processing |
| ops-bee | src/bees/ops-bee.js | Operations automation |
| orchestration-bee | src/bees/orchestration-bee.js | Multi-bee orchestration coordination |
| pipeline-bee | src/bees/pipeline-bee.js | Pipeline stage execution |
| providers-bee | src/bees/providers-bee.js | Provider health and failover |
| refactor-bee | src/bees/refactor-bee.js | Code refactoring automation |
| resilience-bee | src/bees/resilience-bee.js | Resilience pattern enforcement |
| routes-bee | src/bees/routes-bee.js | API route management |
| security-bee | src/bees/security-bee.js | Security scanning and enforcement |
| services-bee | src/bees/services-bee.js | Service catalog management |
| sync-projection-bee | src/bees/sync-projection-bee.js | Repo projection synchronization |
| telemetry-bee | src/bees/telemetry-bee.js | Telemetry collection and export |
| trading-bee | src/bees/trading-bee.js | Financial trading operations |
| vector-ops-bee | src/bees/vector-ops-bee.js | Vector space operations |
| vector-template-bee | src/bees/vector-template-bee.js | Vector template management |

## Instructions

1. Identify which bee type(s) are relevant to the task.
2. Follow the BaseHeadyBee lifecycle: spawn() -> execute() -> report() -> retire().
3. Use the bee-factory.js to dynamically create bee instances.
4. Register new bees in the headybee-template-registry.
5. All bee parameters use phi-continuous scaling (phi = 1.618).
6. Swarm coordination uses the consensus protocol from swarm-intelligence.js.
7. Each bee must emit telemetry via the telemetry-bee channel.
8. Health checks are mandatory — every bee reports to health-bee.

## Bee Lifecycle Pattern

```javascript
// Standard bee lifecycle
class CustomBee extends BaseHeadyBee {
  constructor(config) {
    super(config);
    this.PHI = 1.618033988749895;
    this.maxRetries = Math.round(this.PHI * 5); // 8
    this.timeout = Math.round(this.PHI * 1000); // 1618ms
  }

  async spawn(context) {
    // Initialize resources, validate config
    // Register with bee-factory registry
  }

  async execute(task) {
    // Core task execution with CSL-gated logic
    // Emit progress via telemetry channel
  }

  async report() {
    // Report results to orchestration-bee
    // Update health-bee status
  }

  async retire() {
    // Cleanup resources in LIFO order
    // Deregister from registry
  }
}
```

## Template Registry Operations

The headybee-template-registry maintains all bee configurations:
- Template creation and versioning
- Scenario-based template selection
- Optimization policy enforcement
- Auto-tuning based on performance metrics

## Swarm Coordination

- Consensus: Weighted voting across active bees using cosine similarity
- Task distribution: DAG-based with topological sort
- Load balancing: Phi-weighted priority scoring
- Failure handling: Circuit breaker per bee with phi-backoff

## Output Format

- Bee Type and Configuration
- Lifecycle Stage
- Swarm Topology
- Health Status
- Telemetry Metrics
- Recommended Optimizations
