---
title: "Law 03: Context Maximization"
domain: unbreakable-law
law_number: 3
semantic_tags: [context, vector-memory, pre-action-scan, ecosystem-state, budget-check, directive-1]
enforcement: MANDATORY
---

# LAW 3: CONTEXT MAXIMIZATION — NO ACTION WITHOUT FULL AWARENESS

No agent, service, or pipeline stage may execute a meaningful action without first loading the
minimum required context. Context is the immune system of the Heady™ alive architecture: insufficient
context produces incoherent decisions, breaks pattern learning, and violates Directive 1 (ecosystem
state must be known before any mutation). This law is enforced at the INTAKE stage of every
HCFullPipeline run.

## Pre-Action Context Loading Protocol

Every action must complete the following scan before proceeding to CLASSIFY (stage 3):

1. **Vector memory load** — query pgvector for relevant 384D embeddings; must complete within 50ms
2. **Health registry check** — read current service health states; must complete within 10ms (cached)
3. **Budget verification** — confirm AI token budget is available for the planned operation
4. **Conflict scan** — check for in-flight tasks that overlap with the planned mutation scope

All four checks are mandatory. A failure in any check blocks advancement past INTAKE (stage 2).

## Context Sources (Minimum 3 Required)

The minimum number of distinct context sources is 3 (fib(4)):

| Source | Purpose | Timeout |
|--------|---------|---------|
| Vector memory (pgvector, 384D) | Semantic state, pattern history | 50ms |
| Health registry | Live service status, circuit breaker states | 10ms |
| Recent changes log | Last fib(7)=13 commits or mutations | 20ms |

Additional context sources (wisdom.json, HeadyPatterns catalog, HeadyAutobiographer log) are
loaded when available and do not count against the 3-source minimum — they supplement it.

## Context Completeness Gate

The embedding density gate at INTAKE stage requires:

```
context_completeness ≥ 0.92  (embedding_density_gate)
```

This is derived from the HIGH CSL threshold (phiThreshold(3) ≈ 0.882) plus one increment toward
CRITICAL (0.927). A score of 0.92 confirms that the loaded context covers the semantic neighborhood
of the planned action with sufficient density to avoid blind-spot decisions.

If the gate score is below 0.92, the pipeline must:
1. Attempt context enrichment (fetch additional sources, extend vector query radius)
2. Re-score completeness
3. Proceed only if score reaches 0.92 or higher
4. Otherwise: escalate to HeadySoul with `CONTEXT_INSUFFICIENT` classification

## Cross-Session Persistence

Context is not ephemeral. Heady maintains continuity across sessions via:

- **384D embeddings** stored in pgvector with session provenance metadata
- **Cosine similarity** used to identify related prior sessions and import their relevant context
- **HeadyAutobiographer** logs providing narrative continuity for long-running projects
- **wisdom.json** preserving distilled decisions, patterns, and lessons across all sessions

New sessions must bootstrap from prior embeddings, not from a cold start.

## Budget Enforcement

Every AI call has a token cost. Budget must be verified **before** every AI call, not in aggregate:

- Budget check at start of session (RECON stage 1)
- Budget check before each LLM invocation during ORCHESTRATE (stage 7) and EXECUTE (stage 12)
- If budget is insufficient, queue the call or escalate — never silently degrade to a cheaper model
  without logging the substitution

## Invariants

- **Pre-action scan is non-negotiable** — all 4 checks (memory, health, budget, conflicts) before any action
- **Budget check before every AI call** — not just at session start
- **Context completeness gate ≥ 0.92** at INTAKE stage — pipeline blocked if not met
- **Minimum 3 context sources** (fib(4)) — fewer sources is an automatic INTAKE failure
- **Vector memory load within 50ms** — exceeding this timeout triggers a cache warm request
- **Health registry within 10ms** — must be served from cache; cache miss triggers a refresh + 10ms grace
- **Cross-session embeddings always persisted** — no session may terminate without flushing embeddings to pgvector
- Actions taken without ecosystem state loaded are **Directive 1 violations** and must be flagged to HeadySoul
