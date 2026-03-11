# Developer onboarding

## Start here
1. Read `docs/architecture/system-topology.md`.
2. Review `docs/adr/ADR-001-central-auth-and-context.md`.
3. Run the validation script and tests.
4. Set local secrets for auth and infrastructure before attempting service startup.

## Key files
- `services/shared/service-base.js`
- `services/shared/auto-context-middleware.js`
- `services/specialized/heady-auto-context/index.js`
- `services/user-facing/heady-auth/index.js`
- `infra/kubernetes/docker-compose.dev.yml`
