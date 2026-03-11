---
title: "Law 08: Arena Mode Default"
domain: unbreakable-law
law_number: 8
semantic_tags: [arena-mode, multi-candidate, code-generation, scoring-weights, headyvinci, deterministic, pattern-learning]
enforcement: MANDATORY
---

# LAW 8: ARENA MODE DEFAULT — COMPETITION BEFORE COMMITMENT

No code generation output may be committed to a production or staging branch without passing
through **Arena Mode** — Heady's multi-candidate competition system. Arena Mode eliminates
single-point-of-failure in generative decisions by requiring at least two independent candidates
to be scored against each other before a winner is selected. The losing candidates and their
scores are never discarded; they feed HeadyVinci's pattern learning system, making every Arena
run a training event.

## Arena Mode Requirements

Every code generation task in the ARENA stage (pipeline stage 9) must:

1. Produce a minimum of **2 candidates** (fib(3)) per round
2. Score all candidates against the five weighted criteria (see Scoring Weights below)
3. Require the winning candidate to exceed the runner-up by ≥ 5% composite score
4. Log all candidates, scores, and the delta to `observability-kernel`
5. Feed results into HeadyVinci for pattern extraction (LAW-07 category 6 — Learning heartbeat)

If the winner does not exceed the runner-up by ≥ 5%, the round is inconclusive. In an inconclusive
round the system must either:
- Generate a third candidate and re-score, or
- Escalate to HeadySoul for human or higher-model adjudication

## Scoring Weights (Immutable, φ-Derived)

The five scoring criteria and their weights are permanently fixed. They are derived from the
φ-recursive weight series and may not be adjusted by configuration, feature flags, or task overrides:

| Criterion | Weight | Derivation |
|-----------|--------|-----------|
| Correctness | 0.34 | Hot resource allocation (Fibonacci ratio 34%) |
| Safety | 0.21 | Warm resource allocation (Fibonacci ratio 21%) |
| Performance | 0.21 | Warm resource allocation (Fibonacci ratio 21%) |
| Quality | 0.13 | Cold resource allocation (Fibonacci ratio 13%) |
| Elegance | 0.11 | Reserve + governance blended |

Total: 1.00. Weights are validated on every Arena run; weight-sum deviation > 0.001 triggers a
configuration integrity alert.

## Seeded PRNG for Reproducibility

Arena runs use a seeded pseudo-random number generator to ensure:
- Identical inputs produce identical candidate generation order across re-runs
- Results are auditable and reproducible for debugging and compliance
- Seed is derived from: `hash(task_id + stage_timestamp + pipeline_run_id)`
- Seed and all RNG calls are logged alongside Arena results

## Bypass Conditions

Arena Mode may be bypassed **only** under the following exact conditions:

1. The task matches a pre-approved pattern in `wisdom.json` with a confidence score ≥ 0.927
   (the CRITICAL CSL threshold, phiThreshold(4))
2. The pattern was approved by a HeadySoul review (not auto-approved)
3. The bypass is explicitly logged with the matching pattern ID and confidence score

A bypass without a matching `wisdom.json` entry at or above 0.927 confidence is a LAW-08 violation
equivalent to skipping the ARENA stage (9) entirely. It is detected by SELF_CRITIQUE (stage 15)
and triggers rollback of the affected output.

## Heady™Vinci Pattern Learning Integration

Every Arena run, win or lose, produces structured training data:

- **Winner profile**: criteria scores, candidate structure, task context, seed
- **Loser profiles**: criteria scores, failure modes, contrast features vs. winner
- **Delta analysis**: which criteria drove the outcome; by how much
- **Pattern tag**: auto-tagged to the most relevant wisdom.json category

HeadyVinci ingests this data during the Learning heartbeat (LAW-07 category 6) to:
- Increase confidence of patterns that consistently produce winners
- Decay confidence of patterns that consistently produce losers
- Surface new pattern candidates when novel winners emerge fib(8)=21 times

## Invariants

- **No code generation without Arena validation** — single-candidate outputs are LAW-08 violations
- **Minimum 2 candidates (fib(3)) per Arena round** — fewer candidates block JUDGE stage (10)
- **Scoring weights are immutable** — correctness=0.34, safety=0.21, performance=0.21, quality=0.13, elegance=0.11
- **Winner must exceed runner-up by ≥ 5% composite score** — ties and near-ties require a third candidate or escalation
- **Seeded PRNG required** — unseeded Arena runs are non-reproducible and non-auditable; blocked
- **All Arena results logged** — winners, losers, scores, deltas, seeds — no result may be discarded
- **Bypass requires wisdom.json pattern confidence ≥ 0.927** — lower confidence does not qualify for bypass
- **Bypass events always logged** — with pattern ID, confidence score, and approving HeadySoul review reference
