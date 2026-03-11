# Heady™ Latent OS — File Manifest v5.0.0

> 35 files · @heady-ai/latent-os · Zero magic numbers

---

## Root

| File | Purpose | Lines |
|------|---------|-------|
| `package.json` | npm package definition, v5.0.0 | — |
| `.windsurfrules` | Coding agent rules for φ-compliance | — |
| `ARCHITECTURE.md` | System architecture documentation | — |
| `MANIFEST.md` | This file manifest | — |
| `PHI-COMPLIANCE-SCORECARD.md` | φ-compliance audit scorecard | — |

## shared/

| File | Purpose | Exports |
|------|---------|---------|
| `phi-math.js` | **SINGLE SOURCE OF TRUTH** for all constants | PHI, PSI, fib(), phiMs(), CSL_THRESHOLDS, phiBackoff(), phiFusionWeights(), POOLS, BEE, PIPELINE, AUTO_SUCCESS, VECTOR, JUDGE, COST_W, EVICTION, cslGate(), cosineSimilarity(), normalize() |

## src/core/

| File | Purpose | Key Features |
|------|---------|-------------|
| `event-bus.js` | System-wide event infrastructure | φ-bounded listener limits, priority queues, namespaced channels |
| `heady-logger.js` | Structured logging with φ-scaled levels | Fibonacci-buffered batches, φ-timed flush intervals |
| `health-probes.js` | Kubernetes-compatible health checks | Liveness, readiness, startup probes, φ-timed intervals |

## src/csl/

| File | Purpose | Key Features |
|------|---------|-------------|
| `csl-engine.js` | 8 CSL gate operations | AND (cosine), OR (superposition), NOT (orthogonal), IMPLY, XOR, CONSENSUS, GATE, BLEND |
| `csl-router.js` | MoE cosine routing | Expert selection via cosine scoring, φ-weighted load balancing |

## src/memory/

| File | Purpose | Key Features |
|------|---------|-------------|
| `vector-memory.js` | 384D vector storage | RAM-first, pgvector backend, 3D projection, φ-scored retrieval |
| `context-window-manager.js` | Tiered context management | Working/Session/Memory/Artifacts tiers, φ-weighted eviction |
| `embedding-router.js` | Multi-provider embeddings | Nomic/Jina/Cohere/Voyage/Ollama, circuit breaker failover, LRU cache |

## src/resilience/

| File | Purpose | Key Features |
|------|---------|-------------|
| `circuit-breaker.js` | Service protection | Closed→Open→HalfOpen, φ-backoff, fib-sized failure windows |
| `exponential-backoff.js` | Retry with φ-scaling | φ-geometric progression, jitter ±ψ², max-cap enforcement |
| `drift-detector.js` | Semantic drift detection | Cosine drift at 0.809 threshold, rolling window analysis |
| `self-healer.js` | Auto-recovery engine | Quarantine→Diagnose→Respawn, LIFO cleanup, health attestation |

## src/orchestration/

| File | Purpose | Key Features |
|------|---------|-------------|
| `heady-conductor.js` | Central dispatch | Task routing, node dispatch, pipeline coordination, pool scheduling |
| `liquid-scheduler.js` | Dynamic liquid scheduling | φ-weighted priority, Hot/Warm/Cold pool affinity, load balancing |
| `pool-manager.js` | Resource pool management | 5 pools (34/21/13/8/5%), dynamic rebalancing, pressure response |

## src/pipeline/

| File | Purpose | Key Features |
|------|---------|-------------|
| `pipeline-core.js` | 21-stage DAG executor | Topological sort, max 8 concurrent, φ-backoff retries |
| `pipeline-stages.js` | Stage definitions | All 21 HCFullPipeline stages with CSL scoring |

## src/bees/

| File | Purpose | Key Features |
|------|---------|-------------|
| `bee-factory.js` | Dynamic worker creation | 17 swarm types, φ-scaled pre-warming [5,8,13,21], lifecycle mgmt |
| `swarm-coordinator.js` | Multi-swarm coordination | CSL-scored task routing, consensus via vector voting |

## src/governance/

| File | Purpose | Key Features |
|------|---------|-------------|
| `semantic-backpressure.js` | SRE adaptive throttling | Google SRE algorithm, semantic dedup cos ≥ 0.972, φ-pressure levels |
| `governance-gate.js` | Policy enforcement | CSL-gated approval, audit trail, compliance checks |
| `budget-tracker.js` | Cost management | Per-model cost caps, φ-weighted budget allocation, overage alerts |

## src/auto-success/

| File | Purpose | Key Features |
|------|---------|-------------|
| `auto-success-engine.js` | Continuous improvement | 13 categories, 144 tasks, 29,034ms cycle, Battle Arena Mode |

## src/bootstrap/

| File | Purpose | Key Features |
|------|---------|-------------|
| `bootstrap.js` | System initialization | Ordered startup sequence, dependency resolution, LIFO shutdown |
| `heady-manager.js` | Top-level manager | Lifecycle orchestration, signal handling, graceful shutdown |

## configs/

| File | Purpose | Key Features |
|------|---------|-------------|
| `system.yaml` | Core system configuration | All values φ-derived, no magic numbers |
| `sacred-geometry.yaml` | Sacred Geometry topology | Node placement rules, fractal patterns, golden spiral |
| `domains.yaml` | Domain definitions | 17 Heady domains with CSL affinity scores |

## scripts/

| File | Purpose | Key Features |
|------|---------|-------------|
| `phi-compliance-check.js` | Audit tool | Scans all .js files for hardcoded numbers, reports violations |

---

## Import Rule

**Every .js module MUST import constants from `shared/phi-math.js`:**

```javascript
const { PHI, PSI, fib, phiMs, CSL_THRESHOLDS, ... } = require('../shared/phi-math.js');
```

No module may define its own numeric constants. The phi-math module is canonical.

---

*35 files · 0 magic numbers · 100% φ-derived · v5.0.0*
