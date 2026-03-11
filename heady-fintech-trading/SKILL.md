---
name: heady-fintech-trading
description: Use when working with Heady™Coin token economics, Apex trading risk management, FinOps budget routing, subscription tier management, or financial technology integrations in the Heady™ ecosystem. Keywords include HeadyCoin, trading, fintech, staking, wallet, ledger, Merkle, budget, FinOps, subscription, Apex, risk agent, and financial operations.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ FinTech & Trading Operations

## When to Use This Skill

Use this skill when the user needs to:
- Work with Heady™Coin token system (minting, staking, transfers)
- Implement or debug the Apex trading risk agent
- Configure FinOps budget routing and cost optimization
- Manage subscription tiers and billing logic
- Handle financial transaction ledgers or Merkle verification

## Heady™Coin Architecture

| Module | Path | Role |
|---|---|---|
| headycoin-core | src/headycoin/headycoin-core.js | Token minting, transfer, burn operations |
| headycoin-ledger | src/headycoin/headycoin-ledger.js | Immutable transaction ledger with JSONL |
| headycoin-merkle | src/headycoin/headycoin-merkle.js | Merkle tree verification for ledger integrity |
| headycoin-staking | src/headycoin/headycoin-staking.js | Staking pools with phi-scaled rewards |
| headycoin-wallet | src/headycoin/headycoin-wallet.js | Wallet management and balance queries |

## Instructions

### Heady™Coin Operations
1. All token operations go through headycoin-core.js.
2. Every transaction is logged to the JSONL ledger at data/headycoin-ledger.jsonl.
3. Merkle roots are computed after every N transactions (N = Fibonacci number).
4. Staking rewards use phi-ratio compounding: reward = stake * (PHI^period - 1).
5. Wallet balances are derived from ledger replay, never stored independently.

### FinOps Budget Router
- Route API calls through finops-budget-router.js based on cost constraints.
- Budget caps use phi-scaled tiers: $8, $13, $21, $34, $55 monthly.
- Provider selection optimizes for cost/quality ratio using CSL scoring.
- Real-time spend tracking with automatic throttling at 80% budget.

### Apex Trading Risk Agent
- Risk scoring uses Monte Carlo simulation (src/monte-carlo.js).
- Position limits follow Fibonacci-stepped sizing.
- Stop-loss triggers at phi-ratio levels (38.2%, 61.8%).
- The biometric-hitl.js module enables human-in-the-loop for high-risk trades.

### Subscription Tiers
- Tier definitions in subscription-tiers.js with phi-scaled pricing.
- Feature gates use CSL continuous scoring (no hard boolean).
- Usage metering with Fibonacci-stepped quotas.
- Upgrade/downgrade logic with prorated billing.

## FinOps Budget Routing Pattern

```javascript
const budget = {
  daily: Math.round(PHI * 13),  // $21
  weekly: Math.round(PHI * 55), // $89
  monthly: Math.round(PHI * 144), // $233
  providers: {
    openai: { weight: 0.618, maxDaily: 13 },
    anthropic: { weight: 0.382, maxDaily: 8 },
    groq: { weight: 0.236, maxDaily: 5 },
  }
};
```

## Output Format

- Token Operation Summary
- Ledger Integrity Status (Merkle root)
- Budget Utilization Report
- Risk Assessment Score
- Recommended Tier/Configuration
