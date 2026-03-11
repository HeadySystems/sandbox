# Heady™ Liquid Latent OS Bundle

This bundle turns the attached Heady directives and configuration seeds into a production-oriented monorepo with Cloudflare edge workers, Cloud Run services, shared runtime packages, pgvector migrations, deployment workflows, and operational runbooks. Internal source material comes from the attached workspace directives, HCFullPipeline definitions, and cognitive configuration.

Cloudflare’s remote MCP guidance recommends Streamable HTTP as the current transport standard and Durable Objects when MCP sessions need state, which fits HeadyMCP’s edge-native control plane ([Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)).

Cloudflare Vectorize supports up to 5 million vectors per index and up to 1536 dimensions, which makes it a strong edge retrieval layer while origin pgvector remains the authoritative memory plane ([Cloudflare Vectorize](https://blog.cloudflare.com/building-vectorize-a-distributed-vector-database-on-cloudflare-developer-platform/)).

HeadyMCP publicly positions itself as an edge-native MCP server with JSON-RPC transport, SSE support, and 30+ tools for IDEs such as VS Code, Cursor, and Windsurf ([HeadyMCP](https://headymcp.com)).

HeadyAPI publicly positions itself as a liquid gateway that races 4+ providers and uses auto-failover, which directly informs the worker routing layer included here ([HeadyAPI](https://www.headyapi.com)).

## Included

- Shared phi and CSL packages
- 15 Cloud Run service scaffolds
- 4 Cloudflare worker scaffolds
- pgvector and Graph RAG migrations
- CI/CD, Docker, smoke tests, and deployment templates
- Reconciled directives and missing cognitive-layer files
- Runbooks, ADRs, and activation checklists

## Activation

1. Install `pnpm` and Node 22.
2. Copy `.env.example` to `.env` and fill secrets.
3. Provision Cloudflare, GCP, PostgreSQL with pgvector, and Redis.
4. Run `pnpm install` then `pnpm build`.
5. Run `pnpm dev` or `docker compose up --build`.
6. Deploy Cloudflare workers and Cloud Run services via the included GitHub Actions.

## Honest status

This bundle gives you the complete file system, contracts, deployment scaffolding, and core runtime glue needed for production hardening. Final go-live still requires live credentials, DNS, certificates, Cloudflare/GCP accounts, and real provider keys.
