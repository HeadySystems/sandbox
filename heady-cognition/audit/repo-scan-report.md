# Heady™Me GitHub Organization — Comprehensive Repo Scan Report
**Scan Date:** 2026-03-07  
**Scanned by:** Autonomous research agent  
**Sources:** GitHub REST API (api.github.com), github.com direct pages

---

## Table of Contents
1. [HeadyMe Organization — All Repositories](#1-headyme-organization--all-repositories)
2. [HeadySystems Organization — All Repositories](#2-headysystems-organization--all-repositories)
3. [Main Repo: Heady-pre-production-9f2f0642](#3-main-repo-heady-pre-production-9f2f0642)
   - [Repo Metadata](#repo-metadata)
   - [Root-Level Structure](#root-level-structure)
   - [src/ Directory — Full Tree](#src-directory--full-tree)
   - [configs/ Directory](#configs-directory)
   - [docs/ Directory](#docs-directory)
   - [docs/strategic/ Files](#docsstrategic-files)
   - [src/pipeline/](#srcpipeline)
   - [src/bees/](#srcbees)
   - [src/orchestration/](#srcorchestration)
   - [src/resilience/](#srcresilience)
   - [src/bootstrap/](#srcbootstrap)
   - [src/core/](#srccore)
   - [src/services/](#srcservices)
   - [package.json — Dependencies & Scripts](#packagejson--dependencies--scripts)
   - [heady-manager.js — Entrypoint](#heady-managerjs--entrypoint)
   - [heady-registry.json — Key Findings](#heady-registryjson--key-findings)
4. [heady-docs Repo](#4-heady-docs-repo)
5. [HeadyMe/Heady Repo (Archived)](#5-headysystemsheady-repo-archived)
6. [Key Findings & Implementation State](#6-key-findings--implementation-state)
7. [File Count Summary by Directory](#7-file-count-summary-by-directory)

---

## 1. HeadyMe Organization — All Repositories

**Total Repos: 13** (per org page) — 13 visible via API  
**Source:** https://github.com/HeadyMe

| Repo Name | Description | Language | Visibility |
|---|---|---|---|
| `heady-docs` | Heady™ Documentation Hub — Single Source of Truth for all project docs, patents, architecture, and API references | HTML | Public |
| `Heady-pre-production-9f2f0642` | Official HeadySystems Inc. Repo | JavaScript | Public |
| `headyapi-core` | Heady™ API Gateway — unified API layer with rate limiting, auth, and intelligent routing. Projected from the Heady Latent OS. | JavaScript | Public |
| `headybot-core` | Heady™ Bot Framework — autonomous bot orchestration with swarm intelligence. Projected from the Heady Latent OS. | JavaScript | Public |
| `headybuddy-core` | Heady™ AI Companion — personal AI buddy with persistent memory, chat, and creative tools. Projected from the Heady Latent OS. | JavaScript | Public |
| `headyconnection-core` | Heady™ Community & Connection — collaborative AI workspace. Projected from the Heady Latent OS. | JavaScript | Public |
| `headyio-core` | Heady™ Developer SDK & IO — official SDK for building on the Heady platform. Projected from the Heady Latent OS. | JavaScript | Public |
| `headymcp-core` | Heady™ Master Control Program — 31 MCP tools, autonomous orchestration, zero-latency dispatch. Projected from the Heady Latent OS. | JavaScript | Public |
| `headymcp-production` | Live Projection: headymcp.com — Autonomous deployment target for HeadyMCP Dashboard UI | null | Public |
| `headyme-core` | Heady™ Personal Cloud Hub — your AI-powered command center. Projected from the Heady Latent OS. | JavaScript | Public |
| `headyos-core` | Heady™ Operating System — the latent OS powering continuous AI reasoning. Projected from the Heady Latent OS. | JavaScript | Public |
| `headysystems-core` | Heady™ AI Infrastructure Engine — self-healing infrastructure, Sacred Geometry orchestration. Projected from the Heady Latent OS. | JavaScript | Public |
| `heady-production` | Live Projection: headysystems.com — Autonomous deployment target for HeadySystems Platform UI | HTML | Public |

> **Note:** All `-core` repos are described as "Projected from the Heady™ Latent OS" — indicating they are auto-generated projection outputs from the monorepo, not independently developed repos.

---

## 2. HeadySystems Organization — All Repositories

**Total Repos: 7**  
**Source:** https://github.com/HeadySystems

| Repo Name | Description | Notes |
|---|---|---|
| `Heady` | Heady™ Systems - Sacred Geometry Architecture v3.0.0 | **Archived Mar 4, 2026.** Read-only. 120 commits. Mostly Java (95.6%). |
| `Heady-pre-production` | Official HeadySystems Inc Repo | Pre-monorepo version |
| `sandbox` | Heady Sandbox - Experimental Features | |
| `sandbox-pre-production` | Area for Project Checkpoints and File Dumps | |
| `ai-workflow-engine` | Intelligent AI workflow engine integrating Cloudflare Workers, Render services, GitHub Gists, and GitHub Actions for automated data processing and AI model orchestration | |
| `main` | (No description) | |
| `headybuddy-web` | (No description) | |

---

## 3. Main Repo: Heady-pre-production-9f2f0642

### Repo Metadata

| Field | Value |
|---|---|
| URL | https://github.com/HeadyMe/Heady-pre-production-9f2f0642 |
| Description | Official HeadySystems Inc. Repo |
| Version | 3.2.3 (package.json) / 3.0.1 (heady-registry.json) |
| Codename | Aether |
| Release Date | 2026-03-06 |
| Stars | 1 |
| Commits | 370 |
| Releases/Tags | 3 |
| Packages | 0 |
| Languages | JavaScript 78.9%, HTML 10.2%, Shell 2.6%, Python 2.4%, TypeScript 1.5%, CSS 1.5%, Other 2.9% |
| Visibility | Public |
| Author email | erica@headyconnection.org |
| Homepage | https://headysystems.com |

---

### Root-Level Structure

**Root Files:**
```
.dockerignore
.dockerignore.monorepo
.env
.env.example
.env.rebuild.example
.env.template
.gcloudignore
.gitignore
.npmrc
.prettierrc
.prettierrc.aether
CHANGELOG.md
CONTRIBUTING.md
Dockerfile
Dockerfile.monorepo
Dockerfile.production
Dockerfile.universal
MANIFEST.md
README.md
SECURITY.md
SETUP_GUIDE.md
cloudbuild.yaml
docker-compose.production.yml
docker-compose.rebuild.yml
docker-compose.yml
ecosystem.config.cjs
eslint.config.mjs
heady-init.sh
heady-manager.js          ← Main entrypoint
heady-registry.json       ← Platform registry
jest.config.js
manifest.monorepo.json
package-lock.json
package.json
package.json.additions
pnpm-workspace.yaml
```

**Root Directories (major):**
```
.agents/
.benchmarks/
.gemini/
.githooks/
.github/
.vscode/
_archive/
adapters/node/
apps/
archive/pre-rebuild-20260228/frontend/
assets/brand/
benchmarks/
bin/
certs/
cloudflare/
colab/
config/
configs/           ← Config files
coverage/
data/
db/
deployment/
dist/extensions/
docs/              ← Documentation
enterprise/
evidence/
examples/vsa/
extensions/
frontend/
heady-buddy/dist/
heady-hf-space/
heady-hf-space-connection/
heady-hf-space-systems/
heady-hive-sdk/
heady-ide-ui/
headyconnection-web/
infra/
integrations/max-for-live/
logs/
memories/memories/
migrations/
node_modules/
notebooks/
otel-wrappers/
packages/
pages/
prisma/
projections/
public/
python/
registry/
remotes/
scripts/
services/
shared/
sites/
src/               ← Core source
templates/
test/
tests/
tools/
utils/
workers/
```

---

### src/ Directory — Full Tree

The `src/` directory contains **46 loose files** and **77 subdirectories**.

**Loose files in src/ root (key ones):**
```
agent-orchestrator.js
bee-factory.js
circuit-breaker.js
compute-dashboard.js
connection-pool.js
continuous-learning.js
corrections.js
cross-device-sync.js
deep-research.js
drift-detector.js
embedding-provider.js
hc_secrets_manager.js
heady-conductor.js
hypervector.js
mcp-gateway.js
monte-carlo.js
rbac-manager.js
self-awareness.js
self-optimizer.js
system-monitor.js
tool-registry.js
vector-federation.js
vector-memory.js
vector-pipeline.js
vector-serve.js
vector-space-ops.js
zero-trust-sandbox.js
(+ corresponding .d.ts and .d.ts.map TypeScript declaration files)
```

**src/ Subdirectories (77 total):**
```
agents/
api/
architecture/
arena/
auth/
autonomy/
awareness/
battle-orchestration/
bees-memory/
bees/               ← Bee workers
bootstrap/          ← App bootstrap modules
bridge/
compute/
config/
connectors/
context-weaver/
context/
core/               ← Core primitives
creative/
data/
deployment-infra/
edge/
engines/
gateway/
governance/
hcfp/
headycoin/
hive/
identity/
integrations/
intelligence/
kernel/
landing/
lib/
lifecycle/
mcp/
memory/
mesh/
middleware/
midi/
models/
monetization/
monitoring/
observability/
onboarding/
ops/
orchestration/      ← Orchestration engine
patterns/
persona/
pipeline/           ← Pipeline modules
projection/
prompts/
protocols/
providers/
resilience/         ← Resilience stack
routes/
routing/
runtime/
scripting/
security/
services/           ← Service implementations
shared/
shell/
sites/
source-reference/
telemetry/
testing/
tmp/
trading/
ui/
utils/
vsa/
widgets/
```

---

### configs/ Directory

**Config Files (27 root-level):**
```
HeadySwarmMatrix.json
alerts.yaml
battle-blueprint.json
breaker-config.yaml
canary.yml
domains.json
domains.yaml
grafana-dashboard.json
hcfullpipeline.json
heady-registry.json
heady.config.yaml
mcp-gateway-config.yaml
pgvector-optimized.yaml
phi-scales.yaml
pnpm-workspace.yaml
projection-config.yaml
remote-resources.yaml
sacred-geometry.yaml
secrets-manifest.json
self-healing.yaml
semgrep-rules.yaml
services.yaml
slo-definitions.yaml
source-map.json
supervisor-hierarchy.yaml
system.yaml
workload-partitioning.yaml
```

**Config Subdirectories (35):**
```
INSTALLABLE_PACKAGES/
Shared/
_domains/
agent-profiles/
autonomy/
battle-contexts/
branch-protection/
branding/
cloudflare-workers/
cloudflared/
compliance/
database/
drupal/
gitignore/
governance/
infrastructure/
keys/
local-development/
nginx/
observability/
pgbouncer/
pipeline/
pki/
projection/
prompts/
pycharm/
resources/
scripts/
security/
services/
sso/
templates/
user-profiles/
```

---

### docs/ Directory

**Root-level doc files (97 files):**

```
00_EXECUTIVE_SUMMARY.md
01_PRIORITIZED_REMEDIATION_PLAN.md
02_PROJECTION_STATUS_MANIFEST.md
03_CRITICAL_FIX_SNIPPETS.md
04_REPO_SPECIFIC_FIX_PLAN.md
06_24_HOUR_ACTION_CHECKLIST.md
API.md
API_REFERENCE.md
ARCHITECTURE-MAP.md
ARCHITECTURE-aether.md
ARCHITECTURE.md
CONTRIBUTING.md
CREATE-HEADY-AGENT-SPEC.md
CSL_SCRIPTING.md
DELIVERY_MANIFEST.md
DEPLOYMENT.md
DEPLOYMENT_GUIDE.md
DEPRECATIONS.md
ENTERPRISE-MANIFEST.md
EXAMPLES.md
HARDENING-PLAYBOOK.md
HEADY_ASAP_EXECUTION_PLAN.json
HEADY_ASAP_EXECUTION_PLAN.md
HEADY_COMPLETE_ANALYSIS.md
HEADY_PROMPT_LIBRARY.md
HEADY_PROMPT_LIBRARY_FULL.md
HEADY_SKILL_AUDIT.md
Heady_Improvements_Comprehensive_Report_2026-03-07.md
INTEGRATION.md
INTEGRATION_GUIDE.md
LIVE_SURFACES.md
LOGIC-VISUALIZER-SPEC.md
MASTER-TASK-BOARD.md
MASTER_IMPROVEMENT_PLAN.md
MCP.md
MIGRATION-TURBOREPO.md
MIGRATION.md
MIGRATION_MAP.md
PATENT-CLAIM-MAP.md
PHI_SCALE_ARCHITECTURE.md
PILOT-PLAN.md
PILOT_READINESS.md
PQC_INTEGRATION.md
PRODUCTION_DEPLOYMENT_GUIDE.md
PROJECTION-TYPES.md
PromptPack.md
QUICK_REFERENCE.md
README.md
REDIS-POOLING-SPEC.md
REPO_ROLES.md
REPO_SCAN_SUMMARY.md
SCAN-REPORT.md
SECURITY-GAP-ANALYSIS.md
SECURITY.md
SETUP_GUIDE.md
SKILL_MANIFEST.md
SKILL_MANIFEST_DERIVED.md
SOC2-COMPLIANCE-MATRIX.md
SOURCE_AUDIT.md
SOURCE_INDEX.md
STRATEGIC_VALUATION_MARCH_2026.md
TEST-COVERAGE-PLAN.md
THEORY.md
VALIDATION_REPORT.md
VSA_THEORY.md
WEBSITE-MANIFEST.md
WINDSURF_INSTRUCTIONS.md
alive-software-architecture.md
api-keys-reference.md
architecture_orchestration_report.md
bees-memory-analysis.md
bookmarks_2_28_26.html
changelog-template.md
csl-architecture-guide.md
csl-mathematical-proofs.md
cutover_hygiene_memo.md
day1-setup.md
day2-operations.md
deployment-infra-analysis.md
docs_ops_memo.md
docs_repo_strategy_report.md
edge-ai-architecture-guide.md
emergency-procedures.md
enterprise-task-extraction.md
extracted-tasks.md
faq.md
heady-context-v3.2.3.md
heady-context.md
heady-platform-onboarding-roadmap.md
heady-platform-transition-roadmap.md
heady-prompt-library.md
headyapi-core-readme.md
headybot-core-readme.md
headybuddy-core-readme.md
headyconnection-core-readme.md
headyio-core-readme.md
headymcp-core-readme.md
headyme-core-readme.md
headyos-core-readme.md
headysystems-core-readme.md
openapi.yaml
orchestration-improvements.md
orchestration-patterns-guide.md
projection_upgrade_memo.md
release-notes-template.md
release-process.md
reliability_deployment_report.md
resilience-security-audit.md
revenue-model.md
security-hardening.md
security_ci_memo.md
soc2-compliance-checklist.md
threat-model.md
tool-to-platform-roadmap.md
troubleshooting.md
vector-optimization-guide.md
versioning-strategy.md
```

**docs/ Subdirectories (29):**
```
adr/
ai-responses/
analysis/
audit/
blueprints/
branch-protection/
competitive-analysis/
compliance-templates/
compliance/
deployment/
enterprise/
legal/
notebook-sources/
patent-research/
patents/
pilot/
rebuild-blueprints/
reports/
research/
sales/
security/
source-reference/
specs/
strategic/
tasks/
testing/
vsa-reference/
whitepaper/
```

---

### docs/strategic/ Files

```
ENTERPRISE_TASK_EXTRACTION.md
architectural-blueprint-buddy-orchestrator.md
enterprise-task-extraction.json
heady-improvement-roadmap-2026.md
latent-os-blueprint.md
operational-masterclass.md
valuation-report-2026-03-04.md
value-assessment-2026-q1.md
```

---

### src/pipeline/

**3 implementation files + TypeScript declarations:**
```
pipeline-core.js          ← Core pipeline logic
pipeline-core.d.ts
pipeline-core.d.ts.map
pipeline-infra.js         ← Infrastructure layer
pipeline-infra.d.ts
pipeline-infra.d.ts.map
pipeline-pools.js         ← Connection pooling
pipeline-pools.d.ts
pipeline-pools.d.ts.map
```
Total: 9 files (3 JS + 3 TS declarations + 3 source maps)

---

### src/bees/

**Full list of Bee worker files (~155 files, ~52 unique bees):**

| Bee File | Purpose |
|---|---|
| `agent-mesh.js` | Agent mesh network |
| `agents-bee.js` | Agent coordination |
| `audio-overview-generator-bee.js` | Audio content generation |
| `auth-flow-bee.js` | Auth flow orchestration |
| `auth-platform-bees.js` | Platform auth bees |
| `auth-provider-bee.js` | Auth provider abstraction |
| `auto-success-bee.js` | Autonomous success tracking |
| `bee-factory-v2.js` | Bee factory v2 |
| `bee-factory.js` | Core bee factory |
| `bee-template.js` | Base bee template |
| `brain-bee.js` | HeadyBrain interface |
| `buddy-core-v2.js` | Buddy orchestrator v2 |
| `cloud-run-deployer-bee.js` | Cloud Run deployment |
| `colab-gpu-runtime-bee.js` | Colab GPU runtime |
| `config-bee.js` | Config management |
| `config-projection-bee.js` | Config projection |
| `connectors-bee.js` | Service connectors |
| `context-weaver-bee.js` | Context weaving |
| `creative-bee.js` | Creative tasks |
| `credential-bee.js` | Credential management |
| `deployment-bee.js` | Deployment automation |
| `device-provisioner-bee.js` | Device provisioning |
| `documentation-bee.js` | Doc generation |
| `dynamic-bee-factory-enhanced.js` | Enhanced dynamic factory |
| `embedder-bee-bee.js` | Embedding operations |
| `engines-bee.js` | Engine coordination |
| `full-cloud-deploy-swarm-bee.js` | Full cloud deployment swarm |
| `gcloud-auth-automator-bee.js` | GCloud auth automation |
| `governance-bee.js` | Governance enforcement |
| `headybee-template-registry.js` | Template registry |
| `health-bee.js` | Health monitoring |
| `health-projection-bee.js` | Health projection |
| `hf-auth-3d-bees.js` | HuggingFace auth 3D |
| `hologram-bee.js` | Holographic visualization |
| `input-task-extractor-bee.js` | Task extraction |
| `input-task-extractor.js` | Task extraction core |
| `intelligence-bee.js` | Intelligence coordination |
| `landing-page-builder-bee.js` | Landing page generation |
| `lifecycle-bee.js` | Service lifecycle |
| `mcp-bee.js` | MCP protocol bee |
| `memory-bee.js` | Memory management |
| `memory-consolidation.js` | Memory consolidation |
| `middleware-bee.js` | Middleware management |
| `midi-bee.js` | MIDI interface |
| `ops-bee.js` | Operations management |
| `orchestration-bee.js` | Orchestration |
| `patent-bee.js` | Patent tracking |
| `pipeline-bee.js` | Pipeline operations |
| `platform-onboarding-analyzer-bee.js` | Onboarding analysis |
| `projection-sync-engine.js` | Projection sync |
| `providers-bee.js` | Provider management |
| `pruner-bee-bee.js` | Pruning operations |
| `refactor-bee.js` | Code refactoring |
| `registry.js` | Bee registry |
| `resilience-bee.js` | Resilience patterns |
| `routes-bee.js` | Route management |
| `security-bee.js` | Security operations |
| `semantic-bee-dispatcher.js` | Semantic dispatch |
| `service-connection-racer-bee.js` | Connection racing |
| `services-bee.js` | Service management |
| `session-templates.js` | Session templates |
| `skill-router-v2.js` | Skill routing v2 |
| `sync-projection-bee.js` | Sync projections |
| `task-queue-projection-bee.js` | Task queue projection |
| `telemetry-bee.js` | Telemetry collection |
| `telemetry-projection-bee.js` | Telemetry projection |
| `template-bee.js` | Template bee |
| `tester-bee-bee.js` | Testing bee |
| `topology-projection-bee.js` | Topology projection |
| `trading-bee.js` | Trading operations |
| `valuation-analyzer-bee.js` | Valuation analysis |
| `valuation-report-swarm-bee.js` | Valuation report swarm |
| `vector-memory-projection-bee.js` | Vector memory projection |
| `vector-memory-v2.js` | Vector memory v2 |
| `vector-ops-bee.js` | Vector operations |
| `vector-template-bee.js` | Vector template |

**Total bee files:** ~155 (including .d.ts and .d.ts.map declarations)  
**Unique bee implementations:** ~77 JS files

---

### src/orchestration/

**Files (~87 JS + declarations):**
```
agent-orchestrator.js
backpressure.js
bee-factory.js
blueprint-validator.js
brain_api.js
buddy-core.js
buddy-watchdog.js
cloud-orchestrator.js
cognitive-operations-controller.js
cognitive-runtime-governor.js
conductor.js
context-window-manager.js
continuous-conductor.js
event-stream.js
hc-full-pipeline-v2.js
hc-full-pipeline.js
hc_auto_success.js
hc_improvement_scheduler.js
hc_pipeline.js
hc_service_dispatcher.js
hc_sys_orchestrator.js
hc_task_scheduler.js
heady-bees.js
heady-cloud-conductor.js
heady-conductor-v2.js
heady-conductor.js
heady-orchestrator.js
index.js
monte-carlo-optimizer.js
monte-carlo-scheduler.js
orchestration-health-dashboard.js
pipeline-telemetry.js
rulez-gatekeeper.js
self-awareness.js
self-correction-loop.js
self-optimizer.js
semantic-backpressure.js
seventeen-swarm-orchestrator.js
skill-router.js
socratic-execution-loop.js
spatial-mapping.js
swarm-consensus-v2.js
swarm-consensus.js
swarm-coordinator.js
swarm-ignition.js
swarm-intelligence.js
task-decomposition-engine.js
ternary-logic.js
```

**Subdirectories:** `battle/`, `v2/`

---

### src/resilience/

**Files (~51):**
```
auth-hardening.js
auto-heal.js
bulkhead-isolation.js
cache.js
circuit-breaker-orchestrator.js
circuit-breaker-v2.js
circuit-breaker.js
cli.js
drift-detector.js
env-validator-hardened.js
exponential-backoff.js
governance-engine-v2.js
health-attestor.js
health-attestor.test.js
incident-timeline.js
index.js
jest.config.js
phi-backoff-enhanced.js
pool.js
quarantine-manager.js
rate-limiter-hardened.js
rate-limiter-v2.js
rate-limiter.js
redis-pool.js
respawn-controller.js
retry.js
rotation-scheduler.js
saga-orchestrator-v2.js
saga.js
security-hardening.js
security-headers.js
self-healing-swarm-bee.js
```

**Subdirectories:** `circuit-breakers/`, `v2/`

---

### src/bootstrap/

**11 bootstrap modules (33 files total including .d.ts):**

| Module | Size | Purpose |
|---|---|---|
| `auth-engine.js` | 2.4 KB | HeadyAuth + fallback + secrets/cloudflare routes |
| `config-globals.js` | 4.2 KB | env, globals, event bus, remoteConfig |
| `engine-wiring.js` | 25 KB | Pipeline + engines wiring |
| `inline-routes.js` | 7.5 KB | Health, pulse, layer, CSM, edge, telemetry routes |
| `middleware-stack.js` | 3.4 KB | CORS, helmet, rate limiting, JSON, site renderer |
| `pipeline-wiring.js` | 4.4 KB | Pipeline + self-healing binding |
| `server-boot.js` | 4.9 KB | HTTP/HTTPS + WS + listen |
| `service-registry.js` | 5.9 KB | 40+ service mount points |
| `service-routes.js` | 43 KB | Service route definitions |
| `vector-stack.js` | 11 KB | Vector memory, pipeline, federation, bees, spatial |
| `voice-relay.js` | 1.7 KB | WebSocket voice relay |

---

### src/core/

**Files (~49):**
```
auth-page-server.js
csl-gates-enhanced.js
dynamic-constants.js
dynamic-site-server.js
ecosystem-integration-map.js
heady-api-gateway-v2.js
heady-config-server.js
heady-crypt.js
heady-env.js
heady-event-bus.js
heady-fetch.js
heady-jwt.js
heady-kv.js
heady-observability.js
heady-scheduler.js
heady-server.js
heady-service-mesh.js
heady-yaml.js
index.js
phi-math.js
phi-scales-csl.js
phi-scales.js
semantic-logic-csl.js
semantic-logic.js
ternary-logic.js
```
**Subdirectories:** `csl-engine/`

---

### src/services/

**Files (~200+ including declarations), key implementations:**
```
HeadyBattle-service.js
HeadySims-service.js
admin-citadel.js
ai-dvr.js
antigravity-heady-runtime.js
arena-mode-service.js
aspirational-registry.js
ast-schema.js
auth-manager.js
auto-projection.js
autonomous-engine.js
autonomous-scheduler.js
battle-arena.js
battle-script.js
branch-automation-service.js
buddy-chat-contract.js
buddy-system.js
budget-service.js
budget-tracker.js
cloud-midi-sequencer.js
continuous-embedder.js
continuous-learning.js
core-api.js
corrections.js
creative-engine.js
cross-device-fs.js
cross-device-sync.js
csl-service-integration.js
daw-mcp-bridge.js
decentralized-governance.js
deep-research.js
deploy-script.js
deterministic-embedding-orchestrator.js
digital-presence-control-plane.js
digital-presence-orchestrator.js
domain-router.js
duckdb-memory.js
dynamic-connector-service.js
dynamic-weight-manager.js
edge-diffusion.js
error-sentinel-service.js
execution-sandbox.js
gateway.js
global-node-network.js
governance-engine.js
governance.js
heady-autocomplete.js
heady-autonomy.js
heady-branded-output.js
heady-doctor.js
heady-email.js
heady-maintenance-ops.js
heady-manager.js
heady-notion.js
heady-redis-pool.js
headyme-helper.js
health-registry.js
health-routes.js
ide-bridge.js
inference-gateway.js
liquid-autonomy-controller.js
liquid-deploy.js
liquid-state-manager.js
liquid-unified-runtime.js
llm-router.js
logic-orchestrator.js
model-router.js
monte-carlo-service.js
monte-carlo.js
neon-db.js
octree-manager.js
onboarding-orchestrator.js
openai-business.js
opentelemetry-tracing.js
perplexity-research.js
pipeline-core.js
pipeline-infra.js
policy-engine.js
projection-dispatcher.js
projection-engine.js
projection-governance.js
projection-sync.js
provider-benchmark.js
provider-connector.js
quantum-bridge.js
realtime-intelligence-service.js
redis-connection-pool.js
redis-sync-bridge.js
resilience-patterns.js
sdk-quickstart.js
sdk-registration.js
secure-key-vault.js
self-healing-mesh.js
sentry.js
service-manager.js
socratic-service.js
spatial-embedder.js
spatial-registry.js
spatial-telemetry.js
story-driver.js
structured-logger.js
swarm-dashboard.js
swarm-matrix.js
task-dag-builder.js
task-state-store.js
template-registry-service.js
tenant-isolation.js
trader-widget.js
ui-registry.js
unified-enterprise-autonomy.js
unified-liquid-system.js
upstash-redis.js
vault-boot.js
vector-memory.js
vector-space-ops.js
verification-engine.js
```

**Subdirectories:** `heady-cache/`, `heady-chain/`, `heady-embed/`, `heady-eval/`, `heady-guard/`, `heady-infer/`, `heady-vector/`

---

### package.json — Dependencies & Scripts

**Package Info:**
- Name: `heady-systems`
- Version: `3.2.3`
- Main: `heady-manager.js`
- License: `UNLICENSED` (Proprietary)
- Node: `>=20.0.0`

**Runtime Dependencies (3):**
```json
"@modelcontextprotocol/sdk": "^1.0.1"
"@octokit/auth-app": "^8.2.0"
"@octokit/rest": "^21.0.0"
```

**Dev Dependencies (8):**
```json
"@typescript-eslint/eslint-plugin": "^8.55.0"
"@typescript-eslint/parser": "^8.55.0"
"concurrently": "^9.1.2"
"eslint": "^10.0.1"
"jest": "^30.2.0"
"nodemon": "^3.1.9"
"supertest": "^7.2.2"
"wrangler": "^3.0.0"
"yamllint-jest": "^1.2.0"
```

**Notable:** The repo uses a custom `headyCore` module system that replaces 30+ standard NPM packages (node-fetch, openai, anthropic-sdk, redis, express, pg, etc.) with internal heady-* equivalents.

**Key Scripts (selected):**
| Script | Command |
|---|---|
| `start` | `node heady-manager.js` |
| `dev` | `nodemon heady-manager.js` |
| `start:mcp` | `node heady-manager.js --mcp` |
| `pipeline` | Run HCFullPipeline |
| `hcfp` / `hcfp:full-auto` | Full-auto pipeline run |
| `battle` | Battle arena orchestration |
| `deploy` | Cloud deployment |
| `deploy:hf` | HuggingFace Spaces deploy |
| `system:sync` | Unified system sync |
| `unified:runtime` | Unified runtime orchestrator |
| `vector:project` | Vector projection orchestrator |
| `rebuild:unified` | Rebuild unified system |
| `scan:stale` / `scan:seo` / `scan:quality` | Code scanning ops |
| `maintenance:ops` | Maintenance operations |
| `headybee:optimize` | HeadyBee registry optimizer |
| `test` | Jest test suite |

**CLI Binaries:**
```
heady      → ./bin/heady-cli.js
create-heady-agent → ./bin/create-heady-agent.js
```

---

### heady-manager.js — Entrypoint

The main entrypoint has been **refactored from a 1870-line God class into ~80 lines**. It orchestrates 10 bootstrap phases:

```
Phase 0: Environment validation (fail-fast)
Phase 1: config-globals.js    → env, globals, event bus
Phase 2: middleware-stack.js  → CORS, helmet, rate limiting
Phase 3: auth-engine.js       → HeadyAuth + secrets/cloudflare
Phase 4: vector-stack.js      → vector memory, pipeline, bees, spatial
Phase 5: engine-wiring.js     → MC schedules, patterns, auto-success
Phase 6: pipeline-wiring.js   → pipeline + self-healing binding
Phase 7: service-registry.js  → 40+ service mount points
Phase 8: inline-routes.js     → health, pulse, edge, telemetry routes
Phase 9: voice-relay.js       → WebSocket voice relay
Phase 10: server-boot.js      → HTTP/HTTPS + WS + listen
```

---

### heady-registry.json — Key Findings

**Version:** 3.0.1  
**Codename:** Aether  
**Release Date:** 2026-03-06  
**Environment:** pre-production  

**Architecture:**
- Framework: Liquid Architecture v3.1
- Vector Dimensions: 384
- Projection Dimensions: 3
- Shard Strategy: fibonacci
- Orchestration: Sacred Geometry v3

**Core Services Registered:**
- `heady-manager` (Cloud Run)
- `heady-edge` (Cloudflare Workers)
- `heady-mcp` (Cloud Run)
- `vector-memory`
- `bee-factory`
- `llm-router`
- `autonomous-scheduler`
- `domain-router`
- `budget-tracker`
- `projection-governance`
- `sdk-registration`

**Resilience Services:** self-healing-mesh, circuit-breaker, saga-orchestrator, bulkhead-isolation, event-store, cqrs-bus, auto-tuner, hot-cold-router, skill-based-router

**Deployment Targets:**
- Cloud Run: `heady-manager-609590223909.us-central1.run.app`
- Cloudflare Edge: `heady.headyme.com` (zones: headyme.com, headyconnection.org, heady-ai.com)
- HuggingFace Spaces: org=HeadyMe (spaces: heady-ai, heady-demo, heady-systems, heady-connection)
- GitHub Monorepo: source-of-truth

**UI Apps Registered:**
- antigravity → /app/antigravity
- landing → /
- heady-ide → /app/ide
- swarm-dashboard → /app/swarm
- governance-panel → /app/governance
- projection-monitor → /app/projects
- vector-explorer → /app/vectors
- headyweb-portal → /portal

**Embedding Pipeline:**
- Model: all-MiniLM-L6-v2
- Dimensions: 384 → projected to 3D
- Density Gate: 0.92
- Engine: src/services/continuous-embedder.js

**CI/CD:**
- Pipeline: 5-phase autonomous
- Security Gates: trufflehog, codeql-sast, npm-audit, sbom-cyclonedx, trivy-container-scan
- Auto-correction strategies: REWRITE_FUNCTION, INJECT_OPTIMIZATION, BYPASS_LEGACY, ESCALATE_MODEL
- Max correction iterations: 10

**Pub/Sub Topics:**
- Background: heady-swarm-tasks
- Priority: heady-admin-triggers
- Dead Letter: heady-dead-letter

---

## 4. heady-docs Repo

**URL:** https://github.com/HeadyMe/heady-docs  
**Description:** Heady™ Documentation Hub — Single Source of Truth for all project docs, patents, architecture, and API references  
**Language:** HTML  
**Published:** 2026-03-06  

**Root Contents:**
```
README.md
api/          ← API reference docs
patents/      ← Patent portfolio (51+ patents filed)
site/         ← Static site (deployable to GitHub Pages)
sources/      ← NotebookLM-optimized source documents
strategic/    ← Strategic documents
```

**strategic/ directory:**
```
value-assessment-2026-q1.md   (4,379 bytes)
```

**Ecosystem Referenced (18 repos total per docs README):**
- Monorepo: Heady-pre-production-9f2f0642
- Templates: mcp-server, swarm-bee, heady-ui
- Battle Arena: 9 competitive rebuild repos (Groq, Claude, Gemini, GPT-5.4, Codex, Perplexity, HeadyCoder, HuggingFace, Jules)
- Products: HeadyBuddy, HeadyWeb, HeadyAI-IDE, admin-ui

---

## 5. HeadyMe/Heady Repo (Archived)

**URL:** https://github.com/HeadyMe/Heady  
**Status:** Archived by owner on March 4, 2026 (read-only)  
**Commits:** 120  
**Language Breakdown:** Java 95.6%, C 1.6%, PowerShell 0.9%, JavaScript 0.8%, C++ 0.5%  

**Notable root files:** `.windsurfrules`, `CLAUDE.md`, `REPOSITORIES.md`, `START_HERE.md`

**Key directories:**
```
HeadyAI-IDE/
HeadyAcademy/       ← AI Nodes (JULES, OBSERVER, BUILDER, ATLAS, PYTHIA)
HeadyConnectionKits/
AndroidSDK/
apps/
backend/            ← Python worker & MCP servers
frontend/           ← React UI (Vite + TailwindCSS)
configs/
deploy/
docs/
headybuddy/
headybuddy-mobile/
mcp-servers/
midi_bridge/
scripts/
services/
src/
workers/
websites/
```

---

## 6. Key Findings & Implementation State

### Architecture Overview
Heady is a **v3.2.3** autonomous multi-agent AI platform ("Latent OS") built around:
- **Sacred Geometry v3** orchestration — φ (golden ratio) based routing and scheduling
- **HCFullPipeline** — 12-stage pipeline: INTAKE → TRIAGE → MONTE_CARLO → ARENA → JUDGE → APPROVE → EXECUTE → VERIFY → RECEIPT
- **HeadyBees** — 77+ specialized worker agents across 24 domains (~197 workers per README)
- **3D Vector Memory** — 384-dimension → 3D projection, fibonacci shard strategy, Graph RAG, STM→LTM consolidation
- **MCP Dual-Role** — Both MCP client and MCP server with 31 registered tools
- **Liquid Architecture** — Module federation + dynamic routing + runtime bee creation
- **CSL (Continuous Semantic Logic)** — Custom scripting layer with mathematical proofs

### Implementation State
| Component | State |
|---|---|
| heady-manager.js | Refactored: 1870-line God class → 80-line bootstrap orchestrator |
| src/bootstrap/ | 11 focused modules, fully wired |
| src/pipeline/ | 3 core modules present (pipeline-core, pipeline-infra, pipeline-pools) |
| src/bees/ | 77 unique JS bee workers present, no subdirectories |
| src/orchestration/ | 47 JS files, battle/ and v2/ subdirs |
| src/resilience/ | 32 JS files, circuit-breakers/ and v2/ subdirs |
| src/core/ | 25 JS files + csl-engine/ subdir |
| src/services/ | ~100+ JS files, 7 service subdirs |
| configs/ | 27 root config files + 35 subdirs — very comprehensive |
| docs/ | 97 root docs + 29 subdirs — extremely comprehensive |
| TypeScript declarations | Present (.d.ts + .d.ts.map) throughout — compiled from TS |
| Tests | Jest configured; health-attestor.test.js present; coverage/ dir exists |
| CI/CD | 10 GitHub Actions workflows (CodeQL, Gitleaks, SBOM, dependency audit) |
| Deployment | Cloud Run active (endpoint confirmed in registry), Cloudflare Workers, HuggingFace Spaces |

### Custom Module System (headyCore)
The platform has replaced 30+ standard npm packages with internal implementations:
- `heady-fetch` replaces node-fetch/axios
- `heady-env` replaces dotenv
- `heady-yaml` replaces js-yaml
- `heady-jwt` replaces jsonwebtoken
- `heady-crypto` replaces bcrypt
- `heady-scheduler` replaces node-cron
- `heady-model-bridge` replaces openai, @anthropic-ai/sdk, @google/generative-ai, groq-sdk, @huggingface/inference
- `heady-kv` replaces redis
- `heady-neon` replaces pg
- `heady-server` replaces express
- `heady-duck` replaces duckdb

### Security
- Git history sterilized via git filter-repo
- Pre-commit hooks scan for high-entropy strings
- CodeQL + Gitleaks + SBOM scanning in CI
- Zero-trust sandbox (`src/zero-trust-sandbox.js`)
- RBAC manager (`src/rbac-manager.js`)
- Post-quantum crypto integration (`docs/PQC_INTEGRATION.md`)
- SOC2 compliance matrix present

### Notable Files Not Found
- `.windsurfrules` — not found at root of Heady™Me/Heady-pre-production-9f2f0642 (API returned 404); exists in archived HeadyMe/Heady repo
- `.cursorrules` — not found at root of Heady™Me/Heady-pre-production-9f2f0642 (API returned 404)
- Note: `.windsurfrules` may exist in `/configs/` or another subdirectory not yet checked

---

## 7. File Count Summary by Directory

| Directory | JS Files | Declarations (.d.ts) | Total Files (est.) | Subdirs |
|---|---|---|---|---|
| `src/` (root) | 27 | 19 (×2 w/ maps) | 46 | 77 |
| `src/bees/` | 77 | ~50 | ~155 | 0 |
| `src/orchestration/` | 47 | ~25 | ~87 | 2 |
| `src/resilience/` | 32 | ~12 | ~51 | 2 |
| `src/bootstrap/` | 11 | 11 | 33 | 0 |
| `src/core/` | 25 | ~12 | ~49 | 1 |
| `src/services/` | ~100 | ~65 | ~200+ | 7 |
| `src/pipeline/` | 3 | 3 | 9 | 0 |
| `configs/` | — | — | 27+ | 35 |
| `docs/` | — | — | 97+ | 29 |
| `docs/strategic/` | — | — | 8 | 0 |

**Estimated total source files in repo:** 1,500–2,000+ (across all directories)

---

*Report generated: 2026-03-07 by automated repo scan*  
*Primary source: GitHub REST API (api.github.com)*  
*Main repo: https://github.com/HeadyMe/Heady-pre-production-9f2f0642*  
*HeadyMe org: https://github.com/HeadyMe*  
*HeadySystems org: https://github.com/HeadySystems*  
*Docs repo: https://github.com/HeadyMe/heady-docs*
