# STAGE 19: EVOLUTION — Evolution & Mutation

> **Pipeline Position**: Stage 19 (after CONTINUOUS_SEARCH, before RECEIPT)
> **Timeout**: 29034ms (φ⁷ × 1000)
> **Parallel**: No (sequential — mutations must be carefully controlled)
> **Required**: No — enabled when `pipeline.evolutionEnabled === true`

---

## Purpose

Controlled evolution of the system itself. The system doesn't just optimize —
it **TRANSFORMS**. It proposes and tests mutations to its own parameters, then
only promotes changes that demonstrably improve performance.

This is genetic programming applied to system configuration.

## Cycle

```
mutate → test → measure → promote/discard → record
```

## Process

### 1. Identify Evolution Candidates

- Analyze current pipeline parameters for potential mutations
- Sources of candidates:
  - Self-critique weaknesses
  - Optimization ops recommendations
  - Continuous search discoveries
  - Historical performance trends
- Focus on parameters that have the most impact on system fitness

### 2. Generate Mutations

- Mutation rate: **0.0618 (1/φ / 10)** — conservative
- Population size: **fib(6) = 8** candidates per generation
- Max mutation magnitude: **fib(7)/100 = 0.13** — max 13% change per parameter
- Each mutation is a small, controlled parameter adjustment

### 3. Simulate Mutations

- Use **HeadySims** (Monte Carlo simulation) to evaluate each mutation
- Run 500+ scenarios per candidate
- Compare mutated performance vs baseline performance
- Measure: latency, cost, quality, reliability, elegance

### 4. Fitness Evaluation

Score each mutation using composite CSL fitness:

| Weight | Metric |
|--------|--------|
| 0.34 | Latency improvement |
| 0.21 | Cost reduction |
| 0.21 | Quality improvement |
| 0.13 | Reliability improvement |
| 0.11 | Elegance improvement |

### 5. Selection & Promotion

- **Promote**: if mutation fitness > baseline (measurable improvement)
- **Discard**: if mutation fitness < baseline
- **Rollback**: auto-rollback if regression > 5%
- **Human approval**: required if change > 8% magnitude

### 6. Record Evolution History

Track every mutation attempt:

- What was mutated
- The magnitude of change
- Simulated vs actual performance
- Whether promoted or discarded
- Why it succeeded or failed

## Safety Guards

> [!CAUTION]
> Evolution operates on the system's own configuration. These guards are MANDATORY.

| Guard | Threshold | Action |
|-------|-----------|--------|
| Max magnitude | 13% (fib(7)/100) | Block mutations exceeding this |
| Auto-rollback | 5% regression | Automatically revert |
| Human approval | 8% change | Require Eric's approval |
| **NEVER mutate** | φ constant, Fibonacci sequence, CSL gate math, security policies | These are immutable — Sacred Geometry is law |

## Output

```json
{
  "generationNumber": int,
  "mutationsGenerated": int,
  "mutationsSimulated": int,
  "mutationsPromoted": int,
  "mutationsDiscarded": int,
  "mutationsRolledBack": int,
  "fitnessImprovement": float,
  "promotedMutations": [
    { "parameter": str, "oldValue": any, "newValue": any, "improvement": float }
  ],
  "evolutionHistory": [
    { "mutation": str, "outcome": str, "reason": str }
  ]
}
```

## Sacred Rules

- Mutation rate: 1/φ / 10 = 0.0618
- Population size: fib(6) = 8
- Max magnitude: fib(7)/100 = 0.13 (13%)
- Fitness weights: φ-derived (0.34, 0.21, 0.21, 0.13, 0.11)
- Rollback threshold: 5% regression
- Approval threshold: 8% change
- Generations per day: fib(4) = 3
- Timeout: φ⁷ × 1000 = 29034ms
- IMMUTABLE: φ, Fibonacci, CSL math, security policies
- Every mutation must be recorded — evolution history is permanent
