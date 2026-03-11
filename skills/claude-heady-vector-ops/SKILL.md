# Claude Heady Vector Ops Skill

> **Trigger:** "vector search", "latent space", "semantic search", "embed", "vector memory", "heady memory"

## Purpose

Manage Heady's latent space vector memory — store, search, analyze, and maintain the semantic knowledge base that powers Heady's long-term intelligence.

## Capabilities

1. **Semantic Storage** — Record operations, decisions, and patterns as vectors
2. **Similarity Search** — Find related entries using natural language queries
3. **Memory Analysis** — View latent space health, ring buffer status, vector store stats
4. **Category Management** — Organize vectors by category (deploy, config, service, ai, error)
5. **Knowledge Extraction** — Surface patterns and insights from accumulated vectors
6. **Memory Cleanup** — Prune stale or redundant vectors

## Vector Operations

### Store
```
Record an operation: heady_latent_record
Store with key: latent_store
```

### Search
```
Semantic search: heady_latent_search / latent_search
List all entries: latent_list
```

### Manage
```
View status: heady_latent_status
View log: heady_latent_log
Delete entry: latent_delete
```

## Categories

| Category | Description | Example |
|----------|-------------|---------|
| deploy   | Deployment events | "Deployed v4.0.0 to Render at 2026-03-11T16:00:00Z" |
| config   | Configuration changes | "Updated hcfullpipeline.yaml stage ordering" |
| service  | Service events | "heady-conductor restarted after OOM" |
| ai       | AI/ML operations | "Embedding model switched to text-embedding-3-small" |
| error    | Error patterns | "PostgreSQL connection pool exhausted at 89 connections" |
| pattern  | Discovered patterns | "Phi-based retry backoff reduces error rate by 34%" |

## Usage

```
/claude-heady-vector-ops search "deployment failures this week"
/claude-heady-vector-ops store "Migrated heady-memory to pgvector v0.7" --category service
/claude-heady-vector-ops status
/claude-heady-vector-ops log --category error --limit 20
```

## MCP Tools Used

- `heady_latent_record`, `heady_latent_search`, `heady_latent_status`, `heady_latent_log`
- `latent_store`, `latent_search`, `latent_list`, `latent_delete`

## Sacred Geometry Constants

Vector similarity thresholds follow phi-derived gates:
- **Include gate:** ψ² ≈ 0.382 (minimum relevance to return)
- **Boost gate:** ψ ≈ 0.618 (amplify matching results)
- **Inject gate:** ψ + 0.1 ≈ 0.718 (auto-inject into context)
