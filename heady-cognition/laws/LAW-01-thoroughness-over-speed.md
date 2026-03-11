---
title: "Law 01: Thoroughness Over Speed"
domain: unbreakable-law
law_number: 1
semantic_tags: [thoroughness, quality-gates, completeness, verification, analysis-depth, pipeline-integrity]
enforcement: ABSOLUTE
---

# LAW 1: THOROUGHNESS OVER SPEED — COMPLETE OR FAILED

Every task in the Heady™ system is binary: **fully complete** or **failed**. Partial completion is not a
valid terminal state. Speed optimizations apply exclusively to execution mechanics — parallelism,
caching, routing — never to the elimination of verification, analysis, or self-critique stages.

## Core Mandate

No pipeline stage may be skipped to reduce latency unless the active task is operating under a
formally declared **variant path** registered in the pipeline configuration. All other shortcuts
constitute a LAW-01 violation and must trigger an immediate rollback and incident log entry.

## Analysis Depth Requirements

- **Minimum perspectives before any recommendation**: 3 (fib(4))
- **Architecture decisions**: at minimum 2 options evaluated; tradeoffs explicitly documented
- **Code changes**: must complete lint → type-check → security scan → test run in full before any commit
- **Recommendations without documented analysis**: blocked at JUDGE stage (pipeline stage 10)

## Quality Gate Rules

Quality gates exist at the following canonical pipeline stages and are non-bypassable:

| Stage | Gate |
|-------|------|
| INTAKE (2) | Context completeness ≥ 0.92 |
| VERIFY (13) | All assertions pass; zero unhandled failures |
| SELF_CRITIQUE (15) | Critique score must resolve or be escalated |
| MISTAKE_ANALYSIS (16) | All errors classified and root-caused |

## What "speedPriority" Means

`speedPriority` in task configuration governs **execution optimization only**:
- Parallel subtask dispatch
- Cache hit utilization
- Routing to lowest-latency model

`speedPriority` does **not** authorize:
- Skipping VERIFY stage
- Skipping SELF_CRITIQUE stage
- Reducing analysis depth below fib(4) = 3 perspectives
- Omitting lint, type-check, security scan, or test run from code changes

## Subtask Completeness

A task is complete only when every declared subtask has reached a terminal success state.
Subtasks that time out must be retried with phi-backoff before the parent task may mark itself
done. Abandoned subtasks propagate failure to the parent.

## Invariants

- **No stage skip** in HCFullPipeline unless explicitly declared in a registered variant path
- **SELF_CRITIQUE stage (15) ALWAYS runs** — no exception, no bypass, no timeout override
- **VERIFY stage (13) ALWAYS runs** — results must be logged to `observability-kernel`
- **Minimum analysis depth**: 3 perspectives (fib(4)) before any recommendation surfaces
- **Code change checklist** is atomic: lint + type-check + security scan + test run — all four or none
- **Architecture decisions** without documented tradeoffs are invalid outputs (blocked at APPROVE stage 11)
- Partial task completion reported as success is a **critical violation** triggering HeadySoul alert
