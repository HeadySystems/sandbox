# STAGE 16: MISTAKE_ANALYSIS — Mistake Analysis & Prevention

> **Pipeline Position**: Stage 16 (after SELF_CRITIQUE, before OPTIMIZATION_OPS)
> **Timeout**: 11090ms (φ⁵ × 1000)
> **Parallel**: No (sequential analysis)
> **Required**: Yes

---

## Purpose

Deep dive into failures — both from THIS run and from historical runs.
The system **LEARNS FROM MISTAKES** and actively prevents them from recurring.
Every failure is a lesson. Every lesson becomes a guard.

## Cycle

```
catalog → analyze → pattern → prevent → immunize
```

## Process

### 1. Catalog Current Run Failures

- List ALL errors, warnings, and suboptimal results from this pipeline run
- Include: stage where failure occurred, error message, stack trace, context
- Severity classification: CRITICAL / HIGH / MEDIUM / LOW

### 2. Retrieve Historical Failures

- Search vector memory for similar past failures
- Lookback window: **fib(11) = 89 pipeline runs**
- Use cosine similarity to find "same mistake" patterns
- Similarity threshold: **0.618 (1/φ)** — above this = same mistake class

### 3. Root Cause Analysis

- Method: **5-Whys + Fishbone (Ishikawa) Diagram**
- For each failure class, ask "Why?" 5 times to reach root cause
- Categorize root causes using fishbone categories:
  - People (wrong assumptions, knowledge gaps)
  - Process (wrong sequence, missing steps)
  - Technology (bugs, misconfigurations)
  - Data (stale data, wrong format)
  - Environment (infrastructure, external dependencies)

### 4. Detect Recurring Patterns

- Cluster failures by root cause similarity
- If same mistake recurs > **fib(4) = 3 times**: escalate immediately
- Track mistake frequency, severity trend, and blast radius

### 5. Generate Prevention Rules

- For each failure pattern, generate a **CSL gate** prevention rule
- Prevention rules are machine-executable guards
- Format: CSL gate that blocks the same mistake from recurring

### 6. Anti-Regression Guards

- Create automated test cases for each failure pattern
- Add checks to RECON stage (inject into pre-action scan)
- Add known failure modes to TRIAL_AND_ERROR config (inform experiments)

### 7. Compute Mistake Cost

Quantify the cost of each mistake:

| Weight | Metric |
|--------|--------|
| 0.382 (1 - 1/φ) | Time cost (developer hours wasted) |
| 0.382 | Money cost (compute, API calls) |
| 0.236 (1/φ²) | Quality cost (user impact, trust erosion) |

### 8. Immunize Pipeline

- Update `wisdom.json` with new prevention rules
- Inject guards into future RECON stage scans
- Inform TRIAL_AND_ERROR of known failure modes
- Store all learnings in vector memory under `failures` namespace

## Output

```json
{
  "currentRunFailures": int,
  "historicalMatches": int,
  "rootCauses": [{ "class": str, "category": str, "depth": int, "rootCause": str }],
  "recurringPatterns": [{ "pattern": str, "occurrences": int, "severity": str }],
  "preventionRulesGenerated": int,
  "antiRegressionGuards": int,
  "totalMistakeCost": { "time_hours": float, "money_usd": float, "quality_score": float },
  "immunizationActions": [str]
}
```

## Sacred Rules

- Historical lookback: fib(11) = 89 runs
- Same-mistake similarity: 1/φ = 0.618 cosine threshold
- Max recurrences before escalation: fib(4) = 3
- Prevention rule format: CSL gates (machine-executable)
- Cost weights: φ-derived (0.382, 0.382, 0.236)
- Timeout: φ⁵ × 1000 = 11090ms
- NEVER delete failure history — mistakes are permanent lessons
