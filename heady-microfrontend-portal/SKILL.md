---
name: heady-microfrontend-portal
description: Use when working with Heady™Web micro-frontend architecture, Webpack Module Federation, domain routing, the 7 remote micro-frontends (Antigravity, Swarm Dashboard, Governance Panel, Projection Monitor, Vector Explorer, HeadyIDE, Landing), or the command center application. Keywords include micro-frontend, Module Federation, HeadyWeb, remote, antigravity, swarm dashboard, governance panel, projection monitor, vector explorer, HeadyIDE, landing, webpack, and portal.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Micro-Frontend Portal

## When to Use This Skill

Use this skill when the user needs to:
- Work with the Heady™Web micro-frontend architecture
- Configure Webpack Module Federation remotes
- Add or modify micro-frontend applications
- Set up domain routing for Heady™ portals
- Deploy the Heady™Web shell or any remote

## Architecture

HeadyWeb uses Webpack Module Federation with a host shell that dynamically loads 7 remote micro-frontends.

### Remote Registry
| Remote | Scope | Route | Purpose |
|---|---|---|---|
| antigravity | antigravity | /app/antigravity | Three.js Sacred Geometry 3D viewport |
| landing | headyLanding | / | Marketing page with hero and pillars |
| heady-ide | headyIDE | /app/ide | VS Code-style editor with Heady™Buddy |
| swarm-dashboard | swarmDashboard | /app/swarm | Agent monitoring, topology graph |
| governance-panel | governancePanel | /app/governance | Policy engine, approval gates, RBAC |
| projection-monitor | projectionMonitor | /app/projections | Deployment targets, pipeline, domain map |
| vector-explorer | vectorExplorer | /app/vectors | Three.js point cloud, search |

### Shell Architecture
```
apps/headyweb/
├── src/shell/
│   ├── index.js          # Boot sequence, remote registry
│   ├── index.html         # Shell HTML with spinner
│   └── load-dynamic-remote.js  # Module Federation loader
├── src/services/
│   ├── domain-router.js   # Domain-to-projection resolver
│   └── ui-registry.js     # 13 Heady hostnames to UI IDs
├── src/vector-federation.js  # Push/pull/gossip replication
├── webpack.config.js      # Dual-mode (host + remote)
└── remotes/               # All 7 micro-frontends
```

## Instructions

### Adding a New Remote
1. Create directory under apps/headyweb/remotes/{name}/.
2. Add src/App.js, src/mount.js, src/bootstrap.js, src/styles.css.
3. Add package.json with webpack and Module Federation plugin.
4. Register in REMOTE_REGISTRY in shell/index.js.
5. Add route mapping in domain-router.js.
6. Build: bash scripts/build-all-remotes.sh.

### Domain Routing
- 13 Heady hostnames mapped to UI IDs via ui-registry.js.
- Domain resolution: /api/domains/current returns active domain config.
- Each domain can show a different default remote.
- Fallback: unknown domains route to landing page.

### Build & Deploy
```bash
cd apps/headyweb
npm install
npm run build                    # Build shell
bash scripts/build-all-remotes.sh  # Build all 7 remotes
npm start                        # Dev server on :3000
docker-compose up                # Production with nginx
```

### Performance
- Remote preloading for predicted navigation.
- Shared React vendor chunk across all remotes.
- CSS isolation per remote (scoped styles).
- Error boundaries with fallback UI per remote.
- Fibonacci-sized chunk splitting for optimal loading.

## Output Format

- Remote Configuration
- Build Status
- Domain Routing Map
- Performance Metrics
- Deployment Status
