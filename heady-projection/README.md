# Heady™ Autonomous Projection System

> **HeadySystems Inc.** — Proprietary and Confidential

A complete autonomous projection system where all projections (vector memory, agent state, swarm topology, task queues, telemetry dashboards, config maps, and service health) are continuously and autonomously updated in real-time to reflect the most current system conditions and parameters.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HeadyConductor                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ ProjectionMgr │──│ProjectionSwrm│──│ ConductorInteg.  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                  │                                 │
│  ┌──────┴──────────────────┴──────────────────────────┐     │
│  │               Projection Bees                       │     │
│  │  ┌─────────┐ ┌────────┐ ┌────────┐ ┌──────────┐   │     │
│  │  │ Health  │ │ Config │ │Telemetr│ │ VecMemory│   │     │
│  │  │  1.0    │ │  0.9   │ │  0.7   │ │  0.95    │   │     │
│  │  └─────────┘ └────────┘ └────────┘ └──────────┘   │     │
│  │  ┌─────────┐ ┌──────────┐                          │     │
│  │  │Topology │ │TaskQueue │                          │     │
│  │  │  0.6    │ │  0.8     │                          │     │
│  │  └─────────┘ └──────────┘                          │     │
│  └────────────────────────────────────────────────────┘     │
│         │                                                    │
│  ┌──────┴───────┐  ┌───────────┐  ┌──────────────────┐     │
│  │  SSE Stream  │  │ Dashboard │  │ Cloud Conductor   │     │
│  │  /api/sse    │  │ :3850     │  │ (Cloud Run+PubSub)│     │
│  └──────────────┘  └───────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Start the projection service
npm run projection:start

# Start the dashboard
npm run dashboard

# Or start everything with Docker Compose
docker compose up
```

## Monorepo Structure

```
heady-projection/
├── apps/
│   ├── projection-service/   # Main projection service (port 3849)
│   └── dashboard/            # Real-time SSE dashboard (port 3850)
├── packages/
│   ├── shared-types/         # @heady-ai/shared-types — type definitions
│   └── shared-utils/         # @heady-ai/shared-utils — utility functions
├── src/
│   ├── bees/                 # Projection bee workers
│   │   ├── vector-memory-projection-bee.js
│   │   ├── config-projection-bee.js
│   │   ├── health-projection-bee.js
│   │   ├── telemetry-projection-bee.js
│   │   ├── topology-projection-bee.js
│   │   └── task-queue-projection-bee.js
│   ├── projection/           # Core projection engine
│   │   ├── projection-manager.js
│   │   ├── projection-swarm.js
│   │   ├── projection-sse.js
│   │   ├── conductor-integration.js
│   │   └── cloud-conductor-integration.js
│   ├── core/                 # CSL semantic logic
│   ├── lifecycle/            # Graceful shutdown
│   ├── orchestration/        # Swarm intelligence
│   └── utils/                # Logger
├── configs/
│   └── projection-config.yaml
├── migrations/
│   └── 001_projection_tables.sql
├── scripts/
│   ├── scaffold-cli.js       # Generate new packages/apps
│   └── generate-bee.js       # Generate new domain-specific bees
├── docs/
│   ├── ARCHITECTURE.md
│   └── PROJECTION-TYPES.md
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-cloud-run.yml
├── Dockerfile
├── docker-compose.yml
├── turbo.json
├── tsconfig.json
└── package.json
```

## Scaffold CLI

```bash
# Generate a new package
node scripts/scaffold-cli.js --type package --name my-package

# Generate a new app
node scripts/scaffold-cli.js --type app --name my-app
```

## Bee Generator

```bash
# Generate a new bee from scratch
node scripts/generate-bee.js --domain my-domain --description "Does something" --priority 0.7

# Generate from a template
node scripts/generate-bee.js --template health-check --domain gpu-monitor
node scripts/generate-bee.js --template projection --domain custom-projection
```

## Key Constants

- **PHI** (φ = 1.6180339887) — Golden Ratio used throughout for intervals, timeouts, and scaling
- **384D Embeddings** — All vectors in the system use 384-dimensional space
- **CSL Gates** — Continuous Semantic Logic for non-binary decision making
- **LIFO Shutdown** — Graceful shutdown runs handlers in reverse registration order

## License

Proprietary — HeadySystems Inc. All rights reserved.
