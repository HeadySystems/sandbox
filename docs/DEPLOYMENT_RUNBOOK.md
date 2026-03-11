# Deployment Runbook

## Edge

1. Provision Cloudflare Workers and Durable Objects.
2. Bind `heady-mcp-worker` to `headymcp.com` and `liquid-gateway-worker` to `headyapi.com`.
3. Use Streamable HTTP as the primary MCP route because Cloudflare’s current remote MCP documentation centers on that transport for remote servers ([Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)).

## Cloud Run

1. Build each service image.
2. Apply the matching YAML under `infra/cloud-run/`.
3. Verify `/health/live` and `/health/ready` for every service.

## Data

1. Provision PostgreSQL with pgvector.
2. Apply `001_extensions.sql`, `002_vector_memory.sql`, and `003_graph_rag.sql`.
3. Provision Redis and point all services at it for ephemeral coordination.
