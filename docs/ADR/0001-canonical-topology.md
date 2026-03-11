# ADR 0001: Canonical topology

## Decision

Adopt Cloudflare Workers for edge ingress and Cloud Run for orchestration and service workloads.

## Why

Cloudflare’s remote MCP documentation explicitly supports remote MCP with Streamable HTTP and stateful sessions via Durable Objects, which fits Heady’s edge ingress needs ([Cloudflare Agents docs](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)).

HeadyMCP publicly presents itself as an edge-native MCP surface for IDEs, which aligns the domain with Cloudflare-hosted ingress rather than origin-only routing ([HeadyMCP](https://headymcp.com)).
