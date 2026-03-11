# Heady™ Cognitive Architecture — Wiring Guide

> How to deploy these files into the Heady™ ecosystem.

## Step 1: Files Are Already in the Repo

All files live at `~/Heady/heady-cognition/`. Commit them:

```bash
cd ~/Heady
git add heady-cognition/
git commit -m "feat: add 7-archetype cognitive architecture v2.0 — 8 laws, 10 directives, 89 bee types, 10K scale"
```

## Step 2: Wire into HeadyManager

In `heady-manager.js`, load the config at startup:

```javascript
import { readFileSync } from 'fs';
const cognitiveConfig = JSON.parse(readFileSync('./heady-cognition/config/heady-cognitive-config.json', 'utf-8'));

function initializeAgent(taskType) {
  const config = cognitiveConfig.cognitive_architecture;
  return {
    layers: config.layers,
    laws: config.laws,
    fusion: config.fusion_engine,
    scale: config.scale,
    phi: config.phi_constants
  };
}
```

## Step 3: Wire into MCP Gateway

Ensure `SYSTEM_PRIME_DIRECTIVE.md` content is prepended as the system prompt for ALL agent invocations through `packages/mcp-server`:

```typescript
// packages/mcp-server/src/index.ts
import { readFileSync } from 'fs';
const PRIME_DIRECTIVE = readFileSync('../../../heady-cognition/prompts/SYSTEM_PRIME_DIRECTIVE.md', 'utf-8');

function buildSystemPrompt(taskContext: string): string {
  return `${PRIME_DIRECTIVE}\n\n---\n\n${taskContext}`;
}
```

## Step 4: Wire into IDE Rules

Add to `.windsurf/rules` or any IDE config (CLAUDE.md, .cursorrules, GEMINI.md):

```
@include heady-cognition/prompts/SYSTEM_PRIME_DIRECTIVE.md
@include heady-cognition/prompts/UNBREAKABLE_LAWS.md
@include heady-cognition/prompts/MASTER_DIRECTIVES.md
@include heady-cognition/prompts/COGNITIVE_FUSION_RUNTIME.md
```

## Step 5: Wire into HeadyBuddy

Load `SYSTEM_PRIME_DIRECTIVE.md` on HeadyBuddy initialization. Maintain across all conversation contexts. Load `NODE_TOPOLOGY.md` for swarm routing decisions.

## Step 6: Wire into CI/CD (HCFullPipeline)

Add `UNBREAKABLE_LAWS.md` rules as automated gate checks in GitHub Actions:

```yaml
# .github/workflows/heady-quality-gate.yml
- name: Anti-Shortcut Check
  run: |
    # Check for forbidden patterns from UNBREAKABLE_LAWS.md
    ! grep -rn "// TODO\|// HACK\|// FIXME\|console\.log" --include="*.ts" --include="*.js" \
      --exclude-dir=node_modules --exclude-dir=_archive src/ services/ packages/ || \
      (echo "BLOCKED: Forbidden shortcut patterns found" && exit 1)
```

## Step 7: Environment Variables

```bash
export HEADY_COGNITIVE_CONFIG="$HOME/Heady/heady-cognition/config/heady-cognitive-config.json"
export HEADY_MAX_BEES=10000
export HEADY_CSL_THRESHOLD=0.618
export HEADY_PHI=1.6180339887
```

## File Inventory

```
heady-cognition/
├── README.md                              ← This overview
├── WIRING_GUIDE.md                        ← You are here
├── config/
│   └── heady-cognitive-config.json        ← Central config (JSON)
├── prompts/
│   ├── SYSTEM_PRIME_DIRECTIVE.md          ← Root identity + 7 archetypes
│   ├── UNBREAKABLE_LAWS.md               ← 8 deeply detailed laws
│   ├── MASTER_DIRECTIVES.md              ← 10 operational directives
│   ├── NODE_TOPOLOGY.md                  ← 17 swarms, 89 bee types, 10K scale
│   └── COGNITIVE_FUSION_RUNTIME.md       ← Parallel layer processing
└── audit/
    └── UNIMPLEMENTED_SERVICES_AUDIT.md   ← 21-item gap analysis
```

Total: **8 files** composing the complete cognitive architecture.
