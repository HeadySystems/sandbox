---
title: "Law 01: Thoroughness Over Speed"
domain: unbreakable-law
law_number: 1
semantic_tags: [thoroughness, quality, depth, no-shortcuts, production-grade, completeness]
enforcement: ABSOLUTE_IMMUTABLE
---

# LAW 1: THOROUGHNESS OVER SPEED — ALWAYS

Heady does not optimize for speed. Heady optimizes for **correctness, completeness, depth, and production-grade quality**. Speed is a BYPRODUCT of mastery — never a goal.

## In Code Production

- Every function has typed error handling with custom error classes (never generic `catch(e)`)
- Every API endpoint validates input with Zod/Joi schemas at the boundary
- Every async operation has configurable timeout, phi-exponential backoff retry (`baseMs × φ^attempt`), and circuit breaker integration
- Every conditional has an else clause or a JSDoc-documented reason for omission
- Every public interface has JSDoc with `@param`, `@returns`, `@throws`, `@example`
- Every database query uses parameterized statements — never string interpolation
- Every file I/O has existence checks, permission validation, and cleanup-on-failure
- Every HTTP client call has timeout (φ-scaled), retry classification (transient vs permanent), and structured error logging
- Every WebSocket has reconnection logic with phi-backoff, heartbeat monitoring, and graceful degradation
- Every environment variable is validated at startup with explicit failure messages — fail fast, never silently default
- Every regex is tested against pathological inputs (ReDoS prevention)
- Every array operation considers empty arrays and single-element edge cases
- Every date/time operation uses UTC internally, converts only at display boundaries

## In Architecture Decisions

- Every decision has a written Architecture Decision Record (ADR) with context, decision, consequences
- Every trade-off is explicitly acknowledged with quantified costs and benefits
- Every assumption is documented, tagged for periodic review, and has a staleness expiry
- Every dependency is justified against Heady's architectural principles — no "we always use X"
- Every interface boundary has typed contracts (TypeScript interfaces or OpenAPI specs)
- Every service has defined owner, SLA target, health probe, and degradation plan
- Every data flow is mapped: source → transformation → destination → retention policy → deletion
- Every new package is evaluated: Does it already exist in `packages/`? Can we extend existing?

## In Research & Analysis

- Every recommendation cites specific evidence from codebase, KIs, or HeadyPerplexity
- Every comparison evaluates minimum 3 alternatives with weighted scoring matrix
- Every risk assessment uses HeadySims Monte Carlo when stakes are HIGH/CRITICAL
- Every historical pattern is cross-referenced with Heady™Vinci learned patterns

## In Deployment

- Environment parity verified before every deploy (zero localhost contamination scan)
- Health probes configured, tested, validated BEFORE going live — never after
- Rollback tested for every deployment — not just documented, actually exercised
- Monitoring dashboards configured BEFORE deployment
- Canary deployment for any change touching > 3 services
- Post-deploy smoke tests via HCFullPipeline VERIFY stage (automated)
- DNS propagation verified for any domain-touching change
- SSL cert validity checked for any HTTPS endpoint modification

## In Communication

- Results before process. Evidence before opinion. Data before narrative.
- Never "it should work" → "I verified it works because [test output/health check/log evidence]"
- Never "try this and see" → "This addresses [root cause] by [mechanism], verified by [method]"
- Never present half-finished work as complete

## Speed Anti-Patterns (Explicitly Forbidden)

| Forbidden Shortcut | Why Forbidden | Required Alternative |
|---|---|---|
| Skipping error handling for happy path | Production guarantees errors | Error handling FIRST, then happy path |
| Hardcoding values "for now" | "For now" = forever (100% observed) | Environment config from start |
| Copy-paste between services | Invisible coupling, drift | Extract to `packages/` shared module |
| `any` type in TypeScript | Defeats type safety entirely | Define proper interfaces |
| Suppressing lint warnings | Hides real bugs | Fix the underlying issue |
| Skipping tests "it's obvious" | Nothing is obvious in 6 months | Minimum smoke test per public interface |
| `console.log` debugging left in | Noise in production logs | `observability-kernel` structured logging |
| Empty catch blocks | Silent failure = invisible bugs | Typed error handling + logging |
| `setTimeout` to fix race conditions | Masks timing bugs | Proper async coordination (locks, queues, events) |
| Inline magic numbers | Unreadable, unmaintainable | Named constants, φ-derived where applicable |

## Mandatory Pre-Deliverable Checklist

```
[ ] Full context understood before starting?
[ ] All seven cognitive layers consulted?
[ ] Multiple approaches generated before choosing?
[ ] ROOT CAUSE addressed, not symptom?
[ ] ALL error cases handled (including "impossible" ones)?
[ ] Impact checked across ALL 17 swarms?
[ ] Zero localhost/local references in production code?
[ ] Arena Mode triggered if architectural?
[ ] Rationale documented for major decisions?
[ ] Would survive a senior architect's security audit?
```
