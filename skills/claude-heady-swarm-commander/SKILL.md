# Claude Heady Swarm Commander Skill

> **Trigger:** "swarm", "bee factory", "spawn agents", "distribute task", "parallel agents", "heady bees", "headybee"

## Purpose

Command the HeadyBee swarm intelligence system — spawn, coordinate, and monitor distributed agent swarms for parallel task execution across the Heady ecosystem.

## Capabilities

1. **Swarm Spawning** — Create bee swarms sized by Fibonacci numbers (1, 2, 3, 5, 8, 13, 21)
2. **Task Distribution** — Route tasks to bees by semantic relevance, not priority ranking
3. **Swarm Monitoring** — Track swarm health, completion rates, and resource usage
4. **Convergence** — Gather swarm results and synthesize into unified output
5. **Auto-Scaling** — Dynamically scale swarm size based on workload using phi ratios

## Swarm Architecture

```
┌──────────────────────────────────────────────────────┐
│                  SWARM COMMANDER                       │
│                   (Claude Agent)                       │
├──────────────────────────────────────────────────────┤
│                                                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │  Queen   │  │  Queen   │  │  Queen   │  ...         │
│  │  Bee #1  │  │  Bee #2  │  │  Bee #3  │              │
│  └────┬────┘  └────┬────┘  └────┬────┘               │
│       │            │            │                      │
│  ┌────┴────┐  ┌────┴────┐  ┌────┴────┐               │
│  │Worker   │  │Worker   │  │Worker   │                │
│  │Bees x5  │  │Bees x3  │  │Bees x8  │                │
│  └─────────┘  └─────────┘  └─────────┘               │
│                                                        │
│  Sizing: F(n) workers per queen                        │
│  Routing: Semantic relevance gates                     │
│  Convergence: CSL-scored result synthesis              │
└──────────────────────────────────────────────────────┘
```

## Swarm Sizes (Fibonacci-Based)

| Size | Workers | Use Case |
|------|---------|----------|
| Micro | 1-2    | Simple lookup, single-file edits |
| Small | 3-5    | Multi-file changes, testing |
| Medium | 8-13  | Service-level operations, builds |
| Large | 21-34  | Full system scans, migrations |
| Mega | 55+     | Complete rebuilds, audits |

## Usage

```
/claude-heady-swarm-commander scan all services for security issues
/claude-heady-swarm-commander build and test all 37 packages
/claude-heady-swarm-commander migrate configs from v3 to v4
```

## Implementation

The swarm commander uses Claude's Agent tool to spawn sub-agents:
- Each sub-agent gets a focused, independent task
- Independent tasks fire concurrently (no serialization)
- Results converge back to the commander for synthesis
- All operations logged to latent space

## MCP Tools Used

- `heady_brain_think` (task decomposition)
- `heady_latent_record` (operation logging)
- `heady_health_ping` (swarm health)
- `heady_code_stats` (workload estimation)
