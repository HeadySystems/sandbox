# Heady™ Database Infrastructure

**Heady Liquid Architecture v3.1** — Complete PostgreSQL/pgvector database layer with multi-tenant RLS, Redis pooling, PgBouncer configuration, and Cloud SQL provisioning.

© 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.

---

## Architecture Overview

```
Application (Cloud Run / Cloudflare Workers)
    │
    ├── Redis Pool (ioredis)
    │   ├── Heartbeats, Locks, Rate Limiting
    │   ├── Pub/Sub (inter-swarm events)
    │   └── Vector Cache, Session Store
    │
    └── PgBouncer (port 6432, transaction mode)
        │
        └── PostgreSQL 16 + pgvector (Cloud SQL)
            ├── heady_identity  — tenants, users, RBAC
            ├── heady_core      — vector_memories, agent_state
            ├── heady_swarm     — swarm_topology, task_queue
            ├── heady_audit     — audit_logs (partitioned)
            └── heady_pipeline  — pipeline_runs, stage_executions
```

## Directory Structure

```
heady-db-infra/
├── migrations/
│   ├── 001_extensions_and_schemas.sql   — pgvector, pgcrypto, schemas, tenant functions
│   ├── 002_vector_memories.sql          — 384-dim embeddings, HNSW indexes, 3D projection
│   ├── 003_audit_logs.sql               — Partitioned immutable audit ledger
│   ├── 004_task_queue.sql               — SKIP LOCKED job queue with phi backoff
│   ├── 005_agent_state.sql              — Bee lifecycle, health, Hot/Warm/Cold pools
│   ├── 006_swarm_topology.sql           — Swarm registry, membership, channels
│   ├── 007_pipeline_runs.sql            — HCFullPipeline execution tracking
│   └── 008_views_and_functions.sql      — Dashboard views, system health summary
├── config/
│   ├── pgbouncer.ini                    — PgBouncer connection pooler config
│   ├── pgbouncer-userlist.txt           — PgBouncer user credentials (template)
│   └── redis-pool.js                    — Redis pool with locks, rate limiting, pub/sub
├── scripts/
│   ├── setup-cloud-sql.sh               — Full GCP Cloud SQL provisioning
│   └── run-migrations.sh                — Migration runner for any environment
├── seed/
│   └── seed-swarm-taxonomy.sql          — 17-swarm taxonomy with channels & agents
└── README.md
```

## Quick Start

### Local Development (Docker Compose)

```bash
# From the Heady™ project root (uses existing docker-compose.yml):
docker compose up -d postgres redis pgbouncer

# Run migrations + seed:
./scripts/run-migrations.sh --local --seed
```

### Cloud SQL (GCP)

```bash
# Provision instance + run migrations + seed:
./scripts/setup-cloud-sql.sh production

# Or just migrations against an existing instance:
export DATABASE_URL="postgresql://heady_app:***@127.0.0.1:5433/heady_prod"
./scripts/run-migrations.sh --seed
```

## Tables

| Schema | Table | Description |
|--------|-------|-------------|
| `heady_core` | `vector_memories` | 384-dim embeddings with 3D projection, HNSW indexes, importance scoring |
| `heady_core` | `agent_state` | Bee/node lifecycle, health telemetry, Hot/Warm/Cold pool assignment |
| `heady_swarm` | `swarm_topology` | 17-swarm taxonomy with Sacred Geometry parameters |
| `heady_swarm` | `swarm_membership` | Agent ↔ Swarm associations with roles and weights |
| `heady_swarm` | `swarm_channels` | Inter-swarm communication channels |
| `heady_swarm` | `task_queue` | Priority job queue with SKIP LOCKED dequeue |
| `heady_audit` | `audit_logs` | Monthly-partitioned immutable event ledger |
| `heady_pipeline` | `pipeline_runs` | HCFullPipeline execution tracking |
| `heady_pipeline` | `stage_executions` | Per-stage execution state and checkpoints |
| `heady_identity` | `tenants` | Multi-tenant registry |

## 17-Swarm Taxonomy

### Tier 1: Core Domain Swarms (8)
1. **Infrastructure** — Cloud resources, scaling, self-healing
2. **Security** — Threat detection, RBAC, code governance
3. **Intelligence** — AI reasoning, RAG, embeddings, CSL gates
4. **Pipeline** — HCFullPipeline orchestration
5. **Communication** — Slack, email, webhooks, SSE
6. **Finance** — Cost optimization, budget enforcement
7. **Identity** — Authentication, tenant management, key rotation
8. **Discovery** — Service discovery, capability detection

### Tier 2: Pipeline Stage Swarms (6)
9. **Ingest** — Data acquisition and normalization
10. **Projection** — Embedding generation, 3D mapping
11. **Reasoning** — Multi-model consensus, CSL semantic gates
12. **Synthesis** — Knowledge creation, STM→LTM consolidation
13. **Ignition** — Deployment and action execution
14. **Audit** — Verification and immutable logging

### Tier 3: Orchestration Swarms (3)
15. **Conductor** — Master task routing and pool scheduling
16. **Sacred Geometry** — Phi-weighted scheduling, octant balancing
17. **Self-Awareness** — Coherence monitoring, drift detection, self-healing

## Key Design Decisions

- **HNSW over IVFFlat**: Higher memory but O(log n) query time vs O(√n). Better for concurrent writes.
- **Transaction-mode PgBouncer**: Cloud Run's ephemeral containers need stateless connections.
- **Monthly audit partitions**: Drop entire months for retention instead of expensive DELETE.
- **SKIP LOCKED task queue**: Lock-free concurrent dequeuing without advisory locks.
- **Phi-based backoff**: Golden ratio exponential backoff (φ^n * base) for retry timing.
- **Octant-first search**: Query the local 3D octant zone before expanding to neighbors.
- **RLS everywhere**: Every table enforces tenant isolation at the database level.
