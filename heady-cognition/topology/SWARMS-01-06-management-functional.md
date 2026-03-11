---
title: "Swarm Topology: Management & Functional Core (Swarms 1-6)"
domain: node-topology
semantic_tags: [swarm, overmind, governance, forge, emissary, foundry, studio, bees, agents, factory]
---

# SWARM TOPOLOGY — MANAGEMENT & FUNCTIONAL CORE

## Swarm 1: OVERMIND (Decision)

Root swarm — intents enter here, decompose into task DAGs.

| Bee | Role | Persist | Scale |
|---|---|---|---|
| `OrchestratorBee` | Primary router — HeadyBuddy/MCP intake → subtask DAGs | ✅ | 1-3 |
| `OvermindDirectorBee` | Strategic planner — multi-swarm activation decisions | ✅ | 1 |
| `PriorityResolverBee` | CSL-scored priority ranking across competing tasks | ✅ | 1-5 |
| `DecompositionBee` | DAG generator — topologically-sorted subtask graphs | ❌ | 5-21 |
| `EscalationBee` | Stuck task detection, timeout violations → human gate | ✅ | 1 |
| `SchedulerBee` | Fibonacci-distributed task scheduling to prevent bursts | ✅ | 1-3 |
| `LoadBalancerBee` | Cross-swarm work distribution using phi-weighted scoring | ✅ | 1 |

## Swarm 2: GOVERNANCE (Security & Compliance)

| Bee | Role | Persist | Scale |
|---|---|---|---|
| `AuditBee` | Immutable audit chain via `observability-kernel` | ✅ | 1-3 |
| `ComplianceBee` | Regulatory + policy rule verification | ✅ | 1-3 |
| `PermissionGuardBee` | RBAC enforcement — identity, scoped tokens, capability envelopes | ✅ | 1-5 |
| `SecretScannerBee` | Continuous credential/key/token detection in code + logs | ✅ | 1-3 |
| `PatentZoneGuardBee` | Patent Lock zone integrity (60+ provisionals) | ✅ | 1 |
| `PolicyEnforcerBee` | Enforces Unbreakable Laws at code review time | ✅ | 1-3 |

## Swarm 3: FORGE (Code Production)

| Bee | Role | Persist | Scale |
|---|---|---|---|
| `ASTMutatorBee` | AST-level code modification (never raw string replace) | ❌ | 13-89 |
| `HologramBee` | Preview projections of changes before apply | ❌ | 5-34 |
| `ChaosTesterBee` | Fault injection stress testing | ❌ | 8-55 |
| `ContextWeaverBee` | Full context assembly (imports, types, patterns) | ❌ | 8-34 |
| `RefactorBee` | Architectural refactoring identification + execution | ❌ | 5-21 |
| `TestGeneratorBee` | Auto-test generation for new functions/endpoints | ❌ | 8-34 |
| `LiveCoderBee` | Real-time collaborative via Heady™Coder/HeadyCodex | ❌ | 3-13 |
| `DiffValidatorBee` | Validates proposed diffs against coding standards | ❌ | 3-13 |

## Swarm 4: EMISSARY (Docs, MCP & SDK)

| Bee | Role | Persist | Scale |
|---|---|---|---|
| `DocumentationBee` | Auto-docs from code, ADRs from decisions | ❌ | 5-21 |
| `MCPProtocolBee` | JSON-RPC 2.0 SSE/stdio MCP connections | ✅ | 3-13 |
| `SDKPublisherBee` | Package + publish SDK modules | ❌ | 1-5 |
| `OpenAPIBee` | Generate/validate OpenAPI specs | ❌ | 1-8 |
| `ChangelogBee` | Structured changelogs from git history | ❌ | 1-5 |
| `BriefingBee` | LLM-ready knowledge pack generation | ❌ | 1-8 |

## Swarm 5: FOUNDRY (Fine-Tuning)

| Bee | Role | Persist | Scale |
|---|---|---|---|
| `DataCuratorBee` | Dataset cleaning, labeling, preparation | ❌ | 5-34 |
| `TrainingOrchestratorBee` | Fine-tuning jobs on Colab/Vertex | ❌ | 1-5 |
| `EvalBee` | Evaluation benchmarks on fine-tuned models | ❌ | 3-13 |
| `SyntheticDataBee` | Synthetic training example generation | ❌ | 8-55 |

## Swarm 6: STUDIO (Audio/MIDI/Ableton)

| Bee | Role | Persist | Scale |
|---|---|---|---|
| `CloudMIDIBee` | Cloud → MIDI translation for hardware | ✅ | 1-3 |
| `DAWBridgeBee` | Ableton Live integration via Link | ✅ | 1 |
| `SysExReceiverBee` | System Exclusive MIDI message parsing | ✅ | 1-3 |
| `SequencerBee` | Programmatic MIDI sequence generation | ❌ | 1-8 |
| `AudioAnalysisBee` | Tempo, key, energy feature extraction | ❌ | 1-5 |
