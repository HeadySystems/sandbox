# Production Readiness Plan

Internal attached directives define the behavior contract, but the public platform shape is best anchored by Cloudflare’s remote MCP guidance and Heady’s public product surfaces.

## First wave

- Publish `@heady-ai/phi-math-foundation` and import it everywhere the attached auto-success engine currently expects it.
- Bring up `domain-router` first so production URLs are environment-resolved rather than local-only.
- Deploy the MCP worker with Streamable HTTP on `/mcp` and SSE fallback on `/sse`, matching Cloudflare’s current remote MCP recommendation ([Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)).
- Deploy the liquid provider worker because HeadyAPI publicly advertises fastest-response provider racing and auto-failover ([HeadyAPI](https://www.headyapi.com)).

## Second wave

- Provision PostgreSQL with pgvector and run the included migrations.
- Stand up `heady-memory`, `observability-kernel`, and `heady-health`.
- Deploy `heady-conductor`, `hcfullpipeline-executor`, and `auto-success-engine`.

## Final wave

- Add Cloudflare Access and Ed25519 service tokens.
- Wire CI/CD for Cloudflare and Cloud Run.
- Run the smoke and governance checks before live traffic.
