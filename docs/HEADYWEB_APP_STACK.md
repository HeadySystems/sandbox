# Heady™Web App Stack

## What this delivers

- A runnable HeadyWeb interface (`src/headyweb/public`) with:
  - chat workflow,
  - persistent workspace memory,
  - IDE file read/write/list operations.
- A backend service (`src/headyweb/server.js`) that exposes:
  - `GET /api/health`
  - `GET /api/auth/verify` (proxy to configured auth service)
  - `POST /api/chat`
  - `GET /api/workspace`
  - `GET /api/ide/list`
  - `GET /api/ide/read`
  - `POST /api/ide/write`

## Runtime configuration

- `HEADYWEB_PORT` (default: `3791`)
- `HEADY_AUTH_URL` (default: `https://auth.headysystems.com`)
- `HEADY_VECTOR_URL` (default: `https://headyos.com`)
- `HEADYWEB_IDE_ROOT` (default: repo root)
- `HEADY_DATA_DIR` (default: `./data`)

## Start

```bash
npm run headyweb:start
```

Then open:

- `http://localhost:3791`

## Notes

- Workspace persistence is file-based (`data/headyweb-workspace.json`) for deterministic local/hybrid behavior.
- Auth verification is delegated to `HEADY_AUTH_URL` so cloud and hybrid deployments use the same trust boundary.
