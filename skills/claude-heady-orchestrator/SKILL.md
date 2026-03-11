# Claude Heady Orchestrator Skill

> **Trigger:** "orchestrate heady", "run pipeline", "execute heady workflow", "start heady pipeline", "heady orchestration"

## Purpose

Full-lifecycle orchestration of the Heady HCFullPipeline from within Claude. This skill enables Claude to act as the primary conductor for all 21 pipeline stages, managing concurrent execution, phi-based resource allocation, and sacred geometry node topology.

## Capabilities

1. **Pipeline Execution** — Trigger and monitor HCFullPipeline runs across all 21 Fibonacci-aligned stages
2. **Stage Management** — Pause, resume, skip, or retry individual stages
3. **Concurrent Task Dispatch** — Fire independent stages simultaneously using capability-based routing
4. **Resource Allocation** — Apply phi-scaled (φ ≈ 1.618) resource budgets across hot/warm/cold node pools
5. **Health Monitoring** — Continuous health checks with Fibonacci-timed intervals
6. **Self-Critique Loop** — Post-execution self-assessment with CSL scoring

## Pipeline Stages (21 — Fibonacci(8))

```
1. channel-entry     → 2. recon           → 3. intake
4. classify          → 5. triage          → 6. decompose
7. trial-and-error   → 8. orchestrate     → 9. monte-carlo
10. arena            → 11. judge          → 12. approve
13. execute          → 14. verify         → 15. self-awareness
16. self-critique    → 17. mistake-analysis → 18. optimization-ops
19. continuous-search → 20. evolution      → 21. receipt
```

## Usage

```
/claude-heady-orchestrator [task description]
```

### Examples

```
/claude-heady-orchestrator deploy all services to production
/claude-heady-orchestrator run full pipeline health check
/claude-heady-orchestrator optimize memory service latency
```

## Implementation Notes

- Uses MCP tools: `heady_pipeline_status`, `heady_deploy_run`, `heady_health_ping`
- Respects CodeLock: checks lock status before any code modifications
- Logs all operations to latent space for pattern learning
- CSL scoring weights: correctness 34%, safety 21%, performance 21%, quality 13%, elegance 11%

## Node Pool Routing

| Pool | Reserved Concurrency | Max Latency | Task Types |
|------|---------------------|-------------|------------|
| Hot  | 6 (F(6))           | 2000ms      | User-facing, pipeline execution |
| Warm | 2 (F(3))           | 5000ms      | Self-critique, optimization |
| Cold | Dynamic             | 10000ms     | Ingestion, planning, monitoring |

## Constants

```javascript
const PHI = 1.618033988749895;
const RETRY_BACKOFF = [1618, 2618, 4236]; // φ¹, φ², φ³ × 1000ms
const MAX_CONCURRENT = 8;  // F(6)
const MAX_RETRIES = 3;     // F(4)
const PIPELINE_STAGES = 21; // F(8)
```
