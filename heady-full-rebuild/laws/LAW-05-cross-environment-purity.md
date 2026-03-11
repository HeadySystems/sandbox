---
title: "Law 05: Cross-Environment Purity"
domain: unbreakable-law
law_number: 5
semantic_tags: [environment-purity, no-hardcoding, secrets, env-vars, docker, trufflehog, twelve-factor]
enforcement: ABSOLUTE
---

# LAW 5: CROSS-ENVIRONMENT PURITY — ONE CODEBASE, ALL ENVIRONMENTS

A Heady service must behave identically across development, staging, and production environments
when given equivalent configuration. Any code that bakes in environment-specific values —
hostnames, ports, credentials, feature flags — is a portability violation that creates invisible
divergence between environments and makes the system unpredictable. This law is an absolute
constraint: no exceptions, no temporary overrides, no "just for now" hardcodes.

## No Hardcoded Configuration

The following are unconditional violations regardless of context or branch:

| Violation Pattern | Required Replacement |
|------------------|---------------------|
| Hardcoded URLs (`https://api.myservice.com`) | `process.env.API_BASE_URL` |
| Hardcoded ports (`listen(3000)`) | `process.env.PORT \|\| 3000` (dev only; staging/prod must use env var) |
| Hardcoded hostnames (`localhost`, `127.0.0.1` in non-test code) | `process.env.HOST` |
| Hardcoded connection strings | `process.env.DATABASE_URL` |
| Hardcoded API keys or tokens | Secret manager reference via env var |
| Hardcoded environment names (`if (env === 'production')` without reading from env) | `process.env.NODE_ENV` |

`localhost` references in production code are ABSOLUTE violations. They are permitted only in:
- Unit test files (`*.test.ts`, `*.spec.ts`)
- Developer-only scripts clearly marked with `@dev-only` annotation

## Environment Variable Discipline

Config loading order is strictly enforced:
```
env vars  >  config files  >  defaults
```

- `process.env.NODE_ENV` must be explicitly read and validated at application startup
- Behavior must meaningfully differ between `development`, `staging`, and `production`
- A service that behaves identically in dev and production (same logging verbosity, same error
  exposure, same feature flags) is misconfigured

## .env.example Requirement

Every repository must contain a `.env.example` file that:
- Lists **every** environment variable the application reads
- Provides safe example values (never real credentials)
- Stays in sync with actual env var usage — verified by the Infrastructure heartbeat (LAW-07 category 8)
- Omitting a variable from `.env.example` while reading it in code is a LAW-05 violation

## Secrets Management

No secret may appear in:
- Source code (any branch, including feature branches)
- Log output (structured or unstructured)
- Error messages surfaced to clients
- Git history (enforced by TruffleHog pattern scanning in the Security heartbeat, LAW-07 category 2)

Secrets detected in git history trigger an immediate incident: the history must be purged and all
affected credentials rotated. Detection-to-rotation SLA is fib(6) = 8 hours.

## Docker and Container Purity

Docker containers must:
- Accept all environment-specific configuration exclusively via environment variables or mounted
  secret volumes
- Produce identical behavior given identical env configuration on any host
- Not embed environment-specific files (`production.config.js`, `.env.production`) in the image
- Pass `docker inspect` environment variable completeness check before deployment approval

## Invariants

- **Zero hardcoded connection strings** in any branch — TruffleHog + static analysis enforced
- **Zero secrets in git history** — detected secrets trigger immediate incident and credential rotation
- **`.env.example` always in sync** with actual env var usage — drift detected by Infrastructure heartbeat
- **No `localhost` in production code** — only in test files and `@dev-only` scripts
- **Config loading order enforced**: env vars → config files → defaults — no reversals
- **`process.env.NODE_ENV` must be read and validated** at startup — absence is a misconfiguration
- **Docker containers accept config only via env vars or secret volumes** — no embedded env files in images
- **Secret detection-to-rotation SLA**: fib(6) = 8 hours after any TruffleHog alert fires
