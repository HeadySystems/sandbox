---
name: heady-cloud-orchestrator
description: Use when orchestrating cloud resources, managing XET storage, automating git commits, or handling remote compute in the Heady™ ecosystem. Keywords include cloud orchestrator, XET storage, auto-commit, remote compute, cloud resources, multi-cloud, resource orchestration, and compute management.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Cloud Orchestrator

## When to Use This Skill

Use this skill when the user needs to:
- Orchestrate cloud resources across providers
- Configure XET storage engine
- Set up auto-commit workflows
- Manage remote compute instances
- Coordinate multi-cloud deployments

## Module Map

| Module | Path | Role |
|---|---|---|
| cloud-orchestrator | src/orchestration/cloud-orchestrator.js | Cloud resource coordination |
| xet-storage-engine | src/engines/xet-storage-engine.js | XET storage management |
| auto-commit-engine | src/engines/auto-commit-engine.js | Automated git operations |
| remote-compute | src/remote-compute.js | Remote compute management |
| cloud-run-deployer-bee | src/bees/cloud-run-deployer-bee.js | GCP Cloud Run deployment |

## Instructions

### Cloud Resource Orchestration
1. Multi-cloud support: Cloudflare (edge), GCP (compute), Render (hosting).
2. Resource allocation uses phi-scaled tiers.
3. Auto-scaling: scale up at 0.618 utilization, scale down at 0.382.
4. Cost optimization: route to cheapest provider meeting SLA.
5. Failover: automatic provider failover with phi-backoff retry.

### Cloud Provider Map
| Provider | Services | Role |
|---|---|---|
| Cloudflare | Workers, Pages, R2, D1, Vectorize | Edge computing + CDN |
| GCP | Cloud Run, Compute Engine, Cloud SQL | Heavy compute + DB |
| Render | Web Services, PostgreSQL | Production hosting |
| Neon | PostgreSQL + pgvector | Vector database |
| Redis Cloud | Caching, Streams | Real-time data |

### XET Storage Engine
1. Content-addressable storage for large files.
2. Deduplication at block level.
3. Lazy loading: fetch blocks on demand.
4. Integration with Git LFS for repo management.
5. Cache hierarchy: edge (Cloudflare R2) -> origin (GCS) -> cold (archive).

### Auto-Commit Engine
1. Watches for file changes in monitored paths.
2. Groups changes into logical commits.
3. Commit messages generated from change analysis.
4. Branch management: feature branches auto-created.
5. PR generation with change summary.

### Remote Compute
1. Manage Google Colab Pro+ sessions.
2. GPU allocation for training/inference.
3. Job queuing with priority scheduling.
4. Result retrieval and caching.
5. Cost tracking per compute session.

## Output Format

- Cloud Resource Inventory
- Provider Health Status
- Storage Utilization
- Commit History
- Compute Job Status
