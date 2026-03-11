# Claude Heady Deploy Skill

> **Trigger:** "deploy heady", "push heady", "ship it", "deploy to production", "heady deploy", "auto-deploy"

## Purpose

End-to-end deployment orchestration for the Heady ecosystem. Handles git operations, build validation, deployment to multiple targets (Render, Cloud Run, Cloudflare Workers), and post-deploy verification.

## Capabilities

1. **Pre-Deploy Validation** — Run tests, lint, type-check, localhost audit, secrets scan
2. **Multi-Target Deploy** — Render (heady-manager), Cloud Run (services), Cloudflare (workers)
3. **Git Operations** — Commit, push, branch management with CodeLock compliance
4. **Auto-Deploy Scheduler** — Start/stop the automated deployment cycle
5. **Rollback** — Quick rollback on health check failure
6. **Post-Deploy Verification** — Health pings, smoke tests, latent space logging

## Deploy Pipeline

```
Pre-Flight Checks
  ├─ heady_codelock_status (is codebase locked?)
  ├─ heady_conflicts_scan (any merge conflicts?)
  ├─ heady_secrets_scan (any exposed secrets?)
  └─ heady_config_validate (configs valid?)

Build & Test
  ├─ pnpm install
  ├─ pnpm build (turbo)
  ├─ pnpm test
  └─ validate:no-localhost

Deploy
  ├─ heady_deploy_run (commit + push + deploy)
  ├─ Monitor deployment status
  └─ Wait for health checks

Verify
  ├─ heady_health_ping (all services)
  ├─ Smoke test critical endpoints
  └─ heady_latent_record (log deployment)
```

## Usage

```
/claude-heady-deploy                    # Full deploy with validation
/claude-heady-deploy --force            # Skip pre-flight, deploy now
/claude-heady-deploy --scheduler start  # Start auto-deploy scheduler
/claude-heady-deploy --scheduler stop   # Stop auto-deploy scheduler
/claude-heady-deploy --status           # Check deploy status
```

## MCP Tools Used

- `heady_deploy_run`, `heady_deploy_status`, `heady_deploy_start`, `heady_deploy_stop`
- `heady_codelock_status`, `heady_conflicts_scan`, `heady_secrets_scan`
- `heady_config_validate`, `heady_health_ping`
- `heady_git_status`, `heady_git_log`, `heady_git_diff`
- `heady_latent_record`

## Safety Rules

- Always check CodeLock before modifying code
- Never deploy with exposed secrets
- Never deploy with merge conflicts
- Always verify health after deployment
- Log every deployment to latent space for pattern analysis
