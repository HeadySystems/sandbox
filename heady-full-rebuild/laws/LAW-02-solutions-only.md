---
title: "Law 02: Solutions Only — No Workarounds"
domain: unbreakable-law
law_number: 2
semantic_tags: [root-cause, no-workarounds, no-band-aids, no-hacks, permanent-fix, proper-solution]
enforcement: ABSOLUTE_IMMUTABLE
---

# LAW 2: SOLUTIONS ONLY — NO WORKAROUNDS, NO FIXES, NO BAND-AIDS

Every implementation addresses ROOT CAUSE. If the root cause requires refactoring 5, 15, or 50 files — that IS the correct scope.

## Classification System

### SOLUTION (Acceptable ✅)

- Addresses root cause verified through investigation and evidence
- Improves or maintains system architecture integrity
- Reduces future maintenance burden (negative technical debt)
- Works correctly in ALL environments (local dev, edge, cloud, Colab burst)
- Handles edge cases and failure modes explicitly with typed errors
- Integrates with existing Heady patterns (CSL gates, phi-scaling, Sacred Geometry)
- Includes tests, documentation, monitoring, and health probes

### WORKAROUND (Forbidden ❌)

- Masks symptoms without addressing root cause
- Adds complexity without architectural value
- Works only in specific conditions or environments
- Will need to be replaced "eventually" (which means never)
- Creates compound technical debt that accumulates interest over time
- Makes the next developer (or future Heady agent) confused about intent

### BAND-AID FIX (Forbidden ❌)

- `setTimeout` / `sleep` / `delay` to "fix" race conditions or timing bugs
- `try/catch` with empty catch body or `catch(e) { /* ignore */ }`
- Hardcoded values that should be phi-scaled or env-based configuration
- "Temporary" files, routes, or services that become permanent fixtures
- Comments: `// HACK`, `// FIXME`, `// TODO: do this properly later`, `// TEMP`
- Disabling tests that fail instead of fixing the code under test
- Catching all errors and returning HTTP 200 with `{ success: true }`
- `!important` in CSS to override specificity issues instead of fixing cascade
- TypeScript `any` or `as unknown as T` to silence compiler errors
- Commenting out broken code instead of deleting it (git has history)
- `@ts-ignore` / `@ts-nocheck` / `eslint-disable` without documented justification
- Wrapping broken code in `if (process.env.NODE_ENV !== 'production')` guards
- `JSON.parse(JSON.stringify(obj))` for deep cloning (use `structuredClone`)
- Monkey-patching prototypes to fix library bugs

## Root Cause Protocol (Mandatory for Every Bug Fix)

```
 1. REPRODUCE    — Create reliable, minimal reproduction case
 2. TRACE        — Follow execution to EXACT point of failure (structured logging, breakpoints)
 3. UNDERSTAND   — Determine WHY it fails, not just WHERE (🦉 Owl: first principles)
 4. CONTEXT      — Check if this pattern exists elsewhere in codebase (🦅 Eagle: panoramic scan)
 5. DESIGN       — Determine CORRECT fix at the source, considering all 17 swarms
 6. ALTERNATIVES — Generate 3+ fix approaches (🐇 Rabbit: multiplication)
 7. EVALUATE     — Score approaches for correctness, elegance, systemic impact, maintainability
 8. IMPLEMENT    — Apply winning solution with full error handling, types, and tests
 9. VERIFY       — Confirm fix doesn't introduce new issues across connected services
10. DOCUMENT     — Record root cause, fix rationale, and pattern learned (ADR format)
11. LEARN        — Feed pattern to HeadyVinci for future recognition
12. PREVENT      — Add lint rule or CI check to catch this pattern going forward
```

## Real-World Enforcement Table

| Workaround (FORBIDDEN) | Solution (REQUIRED) |
|---|---|
| Hardcode port 3301 | `process.env.PORT` with Zod validation at startup |
| Catch all → return 200 | Typed error classes, proper HTTP status, error middleware with correlation IDs |
| Skip auth on "internal" endpoints | Service-to-service Ed25519 signing via `agent-identity` package |
| Use `localhost` in config | Environment-based URL resolution via `domain-router` service |
| Disable CORS for convenience | Per-domain CORS via Cloudflare Access rules |
| "Just restart when it hangs" | Circuit breaker + graceful recovery + root cause investigation |
| Stub returning mock data permanently | Real implementation backed by actual data source |
| `// TODO: add validation later` | Zod schema validation NOW |
| Inline `console.log` for debugging | Structured logging via `observability-kernel` with trace IDs |
| Retry infinitely without backoff | Phi-exponential backoff with circuit breaker and dead letter queue |
| Global mutable state for "convenience" | Scoped state with lifecycle management and cleanup |
| String concatenation for SQL | Parameterized queries via query builder |
| `eval()` or `new Function()` for dynamic code | Pre-compiled templates or safe interpreter |
| Polling loop for state changes | Event-driven architecture via `spatial-events` bus |
