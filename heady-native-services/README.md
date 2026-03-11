# Heady™NativeServices

**Sacred Geometry Architecture v3.0.0 — Zero External AI Dependencies**

Seven production-ready, self-hosted services that replace every external AI provider dependency in the Heady™ ecosystem. Built for sovereignty, performance, and cost optimization.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   HeadyGateway :3100                     │
│              /api/v1/{service}/{endpoint}                 │
├──────────┬──────────┬──────────┬──────────┬──────────────┤
│          │          │          │          │              │
│  Embed   │  Infer   │  Vector  │  Chain   │  Cache       │
│  :3101   │  :3102   │  :3103   │  :3104   │  :3105       │
│          │          │          │          │              │
├──────────┴──────────┴──────────┴──────────┴──────────────┤
│                                                          │
│      HeadyGuard :3106          HeadyEval :3107           │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│         PostgreSQL + pgvector    Ollama (optional)        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Replaces | Key Features |
|---------|------|----------|--------------|
| **HeadyEmbed** | 3101 | OpenAI Embeddings | Local ONNX transformers, batch processing, LRU cache with bloom filter |
| **HeadyInfer** | 3102 | Direct Provider SDKs | Provider racing, circuit breakers, cost tracking, PHI-scaled failover |
| **HeadyVector** | 3103 | Pinecone/Weaviate | pgvector HNSW, hybrid BM25+semantic (RRF), Graph RAG with PageRank |
| **HeadyChain** | 3104 | LangChain/LangGraph | DAG workflows, 9 node types, 6 agent patterns, tool registry |
| **HeadyCache** | 3105 | Redis Cloud | Semantic similarity cache, VP-tree ANN, 3 storage backends |
| **HeadyGuard** | 3106 | OpenAI Moderation API | 6-stage pipeline, injection detection, PII redaction, rule engine |
| **HeadyEval** | 3107 | External Eval Tools | LLM-as-judge, 6 built-in scorers, multi-judge consensus, A/B testing |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+ with pgvector (or use Docker)

### 1. Clone and Configure

```bash
cp .env.example .env
# Edit .env with your API keys (only needed for Heady™Infer provider adapters)
npm install
```

### 2. Start with Docker

```bash
# Start all services
docker compose up -d

# Include local LLM (Ollama)
docker compose --profile local-llm up -d

# Check health
node scripts/health-check.js
```

### 3. Start Individually

```bash
# Run database migrations first
npm run migrate

# Start any service independently
npm run start:embed   # HeadyEmbed on :3101
npm run start:infer   # HeadyInfer on :3102
npm run start:vector  # HeadyVector on :3103
npm run start:chain   # HeadyChain on :3104
npm run start:cache   # HeadyCache on :3105
npm run start:guard   # HeadyGuard on :3106
npm run start:eval    # HeadyEval on :3107

# Or start the unified gateway
npm start             # Gateway on :3100
```

### 4. Run Tests

```bash
npm test              # All tests
npm run test:embed    # HeadyEmbed tests
npm run test:infer    # HeadyInfer tests
# ... etc
```

## API Quick Reference

### Heady™Embed — Embeddings
```bash
# Generate embeddings
curl -X POST http://localhost:3101/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, Sacred Geometry"}'

# Batch embeddings
curl -X POST http://localhost:3101/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["First text", "Second text", "Third text"]}'

# Compute similarity
curl -X POST http://localhost:3101/embed/similarity \
  -H "Content-Type: application/json" \
  -d '{"text1": "cat", "text2": "kitten"}'
```

### Heady™Infer — Inference
```bash
# Generate completion
curl -X POST http://localhost:3102/infer \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Explain Sacred Geometry"}],
    "task_type": "creative",
    "max_tokens": 500
  }'

# Race providers
curl -X POST http://localhost:3102/infer/race \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Quick answer"}],
    "providers": ["anthropic", "openai", "groq"]
  }'

# Cost report
curl http://localhost:3102/costs/report
```

### Heady™Vector — Vector Search
```bash
# Create collection
curl -X POST http://localhost:3103/collections \
  -H "Content-Type: application/json" \
  -d '{"name": "documents", "dimensions": 384}'

# Upsert vectors
curl -X POST http://localhost:3103/vectors/upsert \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "documents",
    "vectors": [{
      "id": "doc-1",
      "values": [0.1, 0.2, ...],
      "metadata": {"title": "Sacred Geometry Guide"}
    }]
  }'

# Hybrid search
curl -X POST http://localhost:3103/vectors/search \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "documents",
    "query_vector": [0.1, 0.2, ...],
    "query_text": "Sacred Geometry patterns",
    "mode": "hybrid",
    "alpha": 0.7,
    "top_k": 10
  }'
```

### Heady™Chain — Workflows
```bash
# Execute ReAct agent
curl -X POST http://localhost:3104/agents/react \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Research and summarize the latest AI news",
    "tools": ["web_search"],
    "max_steps": 10
  }'

# Execute DAG workflow
curl -X POST http://localhost:3104/chain/execute \
  -H "Content-Type: application/json" \
  -d '{
    "graph": { "nodes": [...], "edges": [...] },
    "input": { "query": "Analyze this document" }
  }'
```

### Heady™Cache — Semantic Caching
```bash
# Set cache entry
curl -X POST http://localhost:3105/cache/set \
  -H "Content-Type: application/json" \
  -d '{"key": "What is Sacred Geometry?", "value": {"answer": "..."}, "namespace": "qa"}'

# Semantic lookup (finds similar cached entries)
curl -X POST http://localhost:3105/cache/get \
  -H "Content-Type: application/json" \
  -d '{"key": "Explain Sacred Geometry to me", "namespace": "qa"}'
```

### Heady™Guard — Content Security
```bash
# Check content
curl -X POST http://localhost:3106/guard/check \
  -H "Content-Type: application/json" \
  -d '{"content": "User input to check", "mode": "input"}'

# Redact PII
curl -X POST http://localhost:3106/guard/redact \
  -H "Content-Type: application/json" \
  -d '{"text": "My email is john@example.com and SSN is 123-45-6789"}'
```

### Heady™Eval — Evaluation
```bash
# Evaluate a single response
curl -X POST http://localhost:3107/eval/score \
  -H "Content-Type: application/json" \
  -d '{
    "input": "What is PHI?",
    "output": "PHI is the golden ratio, approximately 1.618",
    "context": "PHI (φ) = 1.618033988749895, the golden ratio",
    "scorers": ["relevance", "faithfulness", "coherence"]
  }'

# Run evaluation suite
curl -X POST http://localhost:3107/eval/run \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "qa-benchmark",
    "scorers": ["relevance", "faithfulness", "safety"],
    "model": "claude-3.5-sonnet"
  }'
```

## Sacred Geometry Constants

All services use the Golden Ratio (PHI) for scaling:

```javascript
const PHI = 1.618033988749895;

// Exponential backoff: 1s → 1.618s → 2.618s → 4.236s → 6.854s
// Resource limits: CPU 1.618 cores, Memory PHI * base
// Batch scaling: base_size * PHI^n
```

## Service Dependencies

```
HeadyEval ──→ HeadyInfer ──→ [External LLM Providers]
    │              │
    ├──→ HeadyEmbed (local, no external deps)
    │
    └──→ HeadyGuard (local, no external deps)

HeadyChain ──→ HeadyInfer
    ├──→ HeadyVector ──→ PostgreSQL + pgvector
    └──→ HeadyEmbed

HeadyCache ──→ HeadyEmbed
```

## Deployment

### Google Cloud Run

Each service has its own Dockerfile optimized for Cloud Run:

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT/heady-embed src/services/heady-embed
gcloud run deploy heady-embed --image gcr.io/PROJECT/heady-embed --port 3101

# Repeat for each service
```

### Cloudflare Workers (Edge Proxy)

Use Cloudflare Workers to route requests to Cloud Run services with edge caching.

### Kubernetes

```yaml
# Each service is a separate Deployment + Service
# Use the provided Dockerfiles
# Set resource limits using PHI scaling
```

## Testing

```
Total tests: 603+
├── HeadyEmbed:  96 tests
├── HeadyInfer:  57 tests
├── HeadyVector: 77 tests
├── HeadyChain:  101 tests
├── HeadyCache:  90 tests
├── HeadyGuard:  94 tests
└── HeadyEval:   88 tests
```

## License

MIT — HeadySystems Inc.
