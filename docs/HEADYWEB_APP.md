# Heady™Web App Capability Guide

The gateway app now provides a full browser workflow for authenticated user access, persistent vector memory operations, and authenticated workspace file operations from the same interface.

## Start

```bash
cd apps/gateway
npm run dev
```

## Core capabilities

- **Auth flow**: register/login/session (`/api/auth/*`).
- **Persistent memory**: upsert/search/list/timeline (`/api/memory/*`).
- **MCP integration**: JSON-RPC tool listing/invocation (`/mcp/rpc`, `/mcp/sse`, `/ws/mcp`).
- **HeadyAI-IDE file operations**:
  - `GET /api/ide/workspace`
  - `POST /api/ide/read`
  - `POST /api/ide/write`
- **Chat command bridge** (`POST /api/chat/interface`):
  - `/read <path>`
  - `/write <path>` + request body `content`
  - `/memory <query>`

## Security guardrails

- Workspace file operations are scoped to `HEADY_WORKSPACE_ROOT` (or current working directory).
- Absolute paths and traversal (`../`) are blocked.
- Large files are bounded with a max payload limit.

## Deploy notes

Set `HEADY_WORKSPACE_ROOT` in runtime environment to the mounted repository path used by your cloud runtime.
