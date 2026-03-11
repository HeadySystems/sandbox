# Architecture

The recommended topology is edge-first: Cloudflare Workers handle MCP ingress, provider routing, and lightweight companion streaming, while Cloud Run runs the heavier orchestration and memory-adjacent services. This split matches Cloudflare’s guidance that remote MCP servers should use Streamable HTTP and Durable Objects when per-session state is needed ([Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)).

The memory plane is hybrid. PostgreSQL with pgvector is the source of truth for 384-dimensional embeddings and Graph RAG state, while Cloudflare Vectorize acts as the hot edge retrieval layer for globally distributed reads. Cloudflare states that Vectorize supports up to 5 million vectors per index and up to 1536 dimensions, which makes it a practical edge complement rather than a replacement for origin persistence ([Cloudflare Vectorize](https://blog.cloudflare.com/building-vectorize-a-distributed-vector-database-on-cloudflare-developer-platform/)).

HeadyMCP publicly describes an edge-native MCP server with JSON-RPC and SSE plus 30+ tools for VS Code, Cursor, and Windsurf, which supports treating the `heady-mcp-worker` as the IDE-facing control plane ([HeadyMCP](https://headymcp.com)).

HeadyAPI publicly describes a liquid gateway that races 4+ providers and performs auto-failover, which aligns with the `liquid-gateway-worker` and the budget-aware provider policy in this bundle ([HeadyAPI](https://www.headyapi.com)).

## Layers

1. Edge ingress: `heady-mcp-worker`, `liquid-gateway-worker`, `heady-buddy-worker`, `edge-auth-worker`
2. Control plane: `heady-conductor`, `heady-governance`, `domain-router`, `observability-kernel`
3. Execution plane: `hcfullpipeline-executor`, `auto-success-engine`, `heady-bee-factory`, `heady-brains`, `heady-soul`, `heady-vinci`
4. Memory plane: `heady-memory`, pgvector, Graph RAG schema, Vectorize sync boundary
5. Safety and health: `heady-health`, `heady-guard`, Cloudflare Access, audit policies
