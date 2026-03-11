# STAGE 14: SELF_AWARENESS — Self-Awareness Assessment

> **Pipeline Position**: Stage 14 (after VERIFY, before SELF_CRITIQUE)
> **Timeout**: 11090ms (φ⁵ × 1000)
> **Parallel**: No (sequential introspection)
> **Required**: Yes

---

## Purpose

Metacognition — the system evaluates **its own cognitive state**. How confident
am I? Where are my blind spots? Am I calibrated correctly? What do I NOT know
that I should know? This stage ensures the system is **honest with itself**.

## Cycle

```
introspect → calibrate → identify-gaps → adjust
```

## Assessment Areas

### 1. Confidence Calibration

- Look back at the last **fib(8) = 21 pipeline runs**
- For each run: compare predicted confidence to actual outcomes
- Calculate calibration score: `|predicted_confidence - actual_outcome|`
- If average calibration error > 0.382 (1 - 1/φ): flag as **miscalibrated**
- Action: adjust confidence scaling factor for future predictions

### 2. Blind Spot Detection

- Method: **Counterfactual Reasoning**
- Ask: "What would have changed if X were different?"
- Generate at least **fib(4) = 3 counterfactuals** per decision
- Identify areas where small input changes cause large output changes
- These are blind spots — document them

### 3. Cognitive Load Assessment

- Is the system overwhelmed? (too many parallel tasks, context overload)
- Is the system under-utilized? (idle capacity, wasted resources)
- Optimal load: 0.618 of maximum capacity (1/φ)
- Adjust: scale bees up/down based on load assessment

### 4. Assumption Validity Check

- List all assumptions the system is currently operating under
- For each: check if it's still valid given current data
- Flag stale assumptions (> fib(7) = 13 days without validation)
- Action: re-validate or discard stale assumptions

### 5. Prediction Accuracy

- Track historical predictions vs actual outcomes
- If accuracy drops below **0.618 (1/φ)**: trigger recalibration
- Maintain a rolling accuracy score over the last 21 runs

### 6. Bias Detection

Check for these cognitive biases:

- **Confirmation Bias** — favoring results that confirm existing beliefs
- **Anchoring Bias** — over-weighting initial information
- **Availability Bias** — favoring recent/memorable patterns over statistically significant ones
- **Survivorship Bias** — only considering successful outcomes, ignoring failures

## Output

```json
{
  "selfAwarenessScore": 0.0-1.0,
  "calibrationError": float,
  "blindSpots": [{ "area": str, "risk": str, "counterfactuals": int }],
  "cognitiveLoad": { "current": float, "optimal": 0.618, "adjustment": str },
  "staleAssumptions": [{ "assumption": str, "age_days": int }],
  "predictionAccuracy": float,
  "biasesDetected": [{ "type": str, "evidence": str, "severity": str }],
  "recommendations": []
}
```

## CSL Gate

- **Self-awareness confidence** must reach **≥ 0.618** to proceed normally
- If below 0.618: escalate to HeadyBuddy for human-in-the-loop review
- Never suppress a self-awareness failure — transparency is non-negotiable

## Sacred Rules

- Calibration window: fib(8) = 21 runs
- Min counterfactuals: fib(4) = 3
- Optimal cognitive load: 1/φ = 0.618
- Assumption staleness: fib(7) = 13 days
- Accuracy threshold: 1/φ = 0.618
- Timeout: φ⁵ × 1000 = 11090ms
