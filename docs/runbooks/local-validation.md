# Local validation runbook

## Quick checks
1. Run `python /home/user/workspace/heady-system-build/scripts/validate_bundle.py`.
2. Run `node --test /home/user/workspace/heady-system-build/tests/*.test.js`.

## Optional service smoke tests
- Auth service:
  - export `AUTH_COOKIE_SECRET`
  - optionally export Firebase and OAuth provider credentials
  - run `node /home/user/workspace/heady-system-build/services/user-facing/heady-auth/index.js`
- AutoContext service:
  - run `node /home/user/workspace/heady-system-build/services/specialized/heady-auto-context/index.js`

## Full stack note
`infra/kubernetes/docker-compose.dev.yml` still requires Docker plus deploy-time secrets such as `POSTGRES_PASSWORD` and `DRUPAL_WEBHOOK_SECRET`.
