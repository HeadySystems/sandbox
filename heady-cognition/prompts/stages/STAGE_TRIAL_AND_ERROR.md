# STAGE 6: TRIAL_AND_ERROR — Trial & Error Sandbox

> **Pipeline Position**: Stage 6 (after DECOMPOSE, before ORCHESTRATE)
> **Timeout**: 17944ms (φ⁶ × 1000)
> **Parallel**: Yes (up to 5 candidates = fib(5))
> **Required**: No — enabled when `task.complexity >= 'high'` or `task.allowTrials === true`

---

## Purpose

Safe sandboxed execution of candidate solutions **before committing to production**.
The system TRIES things, FAILS safely, LEARNS from each attempt, and converges
on the best approach. No trial can corrupt production state.

## Cycle

```
hypothesize → test → measure → adapt → select
```

## Process

### 1. Generate Candidates (3-5 approaches)

- For each task, generate **fib(5) = 5** candidate solutions
- Each candidate must be a complete, executable approach
- Candidates should be meaningfully different (not minor variations)
- Tag each candidate with predicted strengths and weaknesses

### 2. Setup Sandbox Environments

- Each candidate gets its own **isolated Docker container**
- Sandboxes mirror production environment but with:
  - Read-only access to production data (snapshots)
  - No write access to production state
  - Isolated networking (no external API calls unless mocked)
  - Resource limits: φ-scaled CPU/memory per sandbox

### 3. Execute Trials in Parallel

- All candidates run simultaneously
- Each trial has a hard timeout of 17944ms (φ⁶ × 1000)
- Automatic rollback on any failure — sandbox is destroyed
- Capture full execution trace for each trial

### 4. Measure Trial Outcomes

Score each trial using CSL-weighted criteria:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Correctness | 0.34 (1/φ² normalized) | Does it produce the right output? |
| Performance | 0.21 (fib ratio) | How fast and resource-efficient? |
| Safety | 0.21 | Does it introduce any risks? |
| Elegance | 0.13 | Code quality, readability, simplicity |
| Resource Efficiency | 0.11 | CPU/memory/network usage |

### 5. Select Winner

- Rank candidates by composite CSL score
- Winner must score above **φ-threshold (0.618)**
- At least **fib(3) = 2 trials** must succeed before selection
- If no candidate meets threshold: escalate to human approval

### 6. Record Trial Learnings

- Store ALL trial results (winners AND losers) in vector memory
- Tag with: task type, approach category, outcome, failure reasons
- Feed successful patterns to Pattern Engine
- Feed failure patterns to Mistake Analysis stage

## Output

```json
{
  "trialsRun": 5,
  "trialsSucceeded": 3,
  "winner": { "candidateId": "c3", "score": 0.847 },
  "learnings": [
    { "candidateId": "c1", "outcome": "failed", "reason": "timeout", "lesson": "..." },
    { "candidateId": "c2", "outcome": "succeeded", "score": 0.72, "lesson": "..." }
  ]
}
```

## Sacred Rules

- Max candidates: fib(5) = 5
- Min successes: fib(3) = 2
- Trial timeout: φ⁶ × 1000 = 17944ms
- Winner threshold: 1/φ = 0.618
- Sandbox isolation: Docker containers (NEVER run trials in production)
- Auto-rollback: ALWAYS on failure
