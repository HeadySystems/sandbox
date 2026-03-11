---
title: "Law 04: Implementation Completeness"
domain: unbreakable-law
law_number: 4
semantic_tags: [completeness, jsdoc, error-handling, health-endpoints, zod-validation, test-coverage, no-stubs]
enforcement: MANDATORY
---

# LAW 4: IMPLEMENTATION COMPLETENESS — FINISHED OR NOT DEPLOYED

Stub implementations, placeholder functions, and console-log-only handlers are not code — they are
promises that were never kept. LAW-04 enforces that every function, module, service, and endpoint
shipped to a production or staging branch is genuinely complete: documented, validated, tested, and
observable. Partial implementations that pass review are a form of technical fraud against the
system's integrity.

## Function Requirements

Every exported or route-handling function must have all four of the following:

1. **JSDoc block** — `@param`, `@returns`, `@throws` annotations; purpose described in one sentence
2. **Error handling** — all failure paths caught, classified, logged, and surfaced (see LAW-02)
3. **Logging** — at minimum: function entry at DEBUG, errors at ERROR, significant state changes at INFO
4. **Return type** — explicit TypeScript return type annotation; `any` return type is a violation

Functions that import the logger module but do not use it on all error paths are flagged by the
Code Quality heartbeat as LAW-04 violations.

## Module Requirements

Every module (file exporting logic) must have:

- **Explicit exports** — no barrel exports that hide what a module provides
- **Health check capability** — a `healthCheck()` function or equivalent export for monitoring
- **Graceful shutdown hook** — a `shutdown()` or `dispose()` function that releases connections and
  flushes pending writes before process termination

## Service Requirements

Every deployed service must expose:

| Endpoint | Purpose | Required Fields |
|----------|---------|----------------|
| `GET /health` | Composite health | `status`, `version`, `uptime`, `checks` |
| `GET /ready` | Readiness probe | `ready: boolean`, `reason` if false |
| `GET /live` | Liveness probe | `alive: boolean`, timestamp |

Services without all three health endpoints are blocked from deployment by the infrastructure
validation gate (LAW-07 category 8 — Infrastructure heartbeat task).

## API Endpoint Requirements

Every HTTP API endpoint must have all of the following before it may be registered:

1. **Input validation** via Zod schema — request body, query params, and path params validated
2. **Rate limiting** — endpoint-level or service-level; unlimited endpoints are violations
3. **Auth check** — authentication and authorization verified before any business logic executes
4. **Error response schema** — all error responses match a declared schema; unstructured error
   strings are not acceptable in production

## Test Coverage

Minimum test coverage threshold: **0.618** (ψ = 1/φ) line coverage across all production modules.

- Coverage is measured per module, not as a global average
- Modules below 0.618 coverage block the VERIFY stage (13) of HCFullPipeline
- Integration tests count toward coverage; snapshot tests do not
- Test coverage is tracked in the Performance category of the Auto-Success Engine heartbeat

## No Stub Implementations

Stub implementations are defined as functions that:
- Contain only `console.log` or `console.error` with no real logic
- Return hardcoded values not derived from inputs
- Throw `new Error('Not implemented')` or equivalent
- Contain only `// TODO: implement` with no body

Any of the above patterns in a production branch trigger an automatic APPROVE-stage (11) block.

## Invariants

- **Every exported function has JSDoc** — missing JSDoc blocks fail the lint gate
- **Every HTTP handler has Zod validation** — unvalidated handlers are rejected at code review
- **Every file that imports logger uses it on all error paths** — verified by static analysis
- **Test coverage ≥ 0.618 (ψ) per module** — below this threshold blocks VERIFY stage (13)
- **No stub implementations in production or staging branches** — zero tolerance
- **All three health endpoints (/health, /ready, /live) required** per service — blocks deployment
- **`any` return type on exported functions** is a type-check gate violation
- **Graceful shutdown hook required** on every module managing external connections or file handles
