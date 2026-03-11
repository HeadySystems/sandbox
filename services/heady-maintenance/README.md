# Heady™Maintenance Service

> Complete system update and maintenance cycle as a reusable service.

## Port: 4320

## 7-Stage Maintenance Cycle

| Stage | Name     | Description |
|-------|----------|-------------|
| 1     | Scan     | Validate file structure, find empty/invalid files |
| 2     | Validate | Run turbo build to verify all packages compile |
| 3     | Brand    | Check HEADY_BRAND headers across config and source files |
| 4     | Trim     | Identify and optionally remove stale directories |
| 5     | Commit   | Stage all changes and commit with maintenance message |
| 6     | Deploy   | Run production build via turbo |
| 7     | Push     | Push committed changes to origin |

## API

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/maintenance/run` | Full cycle (set `dryRun: false` for live mutations) |
| POST | `/maintenance/dry-run` | Scan + validate + report only, no mutations |
| GET  | `/maintenance/status` | Last cycle result |
| GET  | `/maintenance/stages` | Stage definitions and phi constants |

## Pipeline Integration

- **Auto-Success Engine**: `POST /cycle/maintenance` triggers a dry-run as part of success cycles
- **HCFullPipeline**: Stage 22 — `POST /pipeline/maintenance` runs the maintenance cycle

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4320` | Service port |
| `HEADY_WORKSPACE_ROOT` | `cwd()` | Root directory to scan |
| `HEADY_MAINTENANCE_URL` | `http://localhost:4320` | URL used by pipelines to call this service |

## φ Constants

All thresholds use phi-derived scaling:

- Stale threshold: ~34 days (φ³ × 8)
- Max scan depth: ~13 levels (φ² × 5)
- Cycle cooldown: ~1.6 min (φ × 60s)
