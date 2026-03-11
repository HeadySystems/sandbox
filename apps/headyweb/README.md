# Heady™Web Universal Shell + HeadyAI-IDE Runtime

This app now includes a working hybrid runtime for:

- token-based auth flow (`/api/auth/login`, `/api/auth/session`)
- persistent vector workspace (`/api/vector/*`)
- hybrid file operations rooted to repo workspace (`/api/fs/file`)
- chat orchestration surface with command-mode automation (`/api/chat`)

## Run

```bash
node apps/headyweb/server.js
```

## Default local auth

- username: `heady-admin`
- password: `heady-dev-pass`

Override with:

- `HEADYWEB_AUTH_USER`
- `HEADYWEB_AUTH_PASS`
- `HEADYWEB_AUTH_TOKEN` (optional service token)

## Optional upstream chat routing

If you set `HEADYWEB_CHAT_UPSTREAM_URL`, chat requests are forwarded to that endpoint when command-mode does not match a local command.

## Vector persistence

By default vectors persist to:

- `apps/headyweb/data/vector-workspace.json`

Override path with `HEADYWEB_VECTOR_STORE_PATH`.

## Command-mode chat examples

- `/help`
- `/read apps/headyweb/server.js`
- `/write docs/demo.txt ::: hello from headyweb`
- `/vector-save release-note ::: deployed latent workspace`
- `/vector-search latent workspace`
