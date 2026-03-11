/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ═══ Heady™ Patent Implementation Registry ═══
 * Master index for all patent-backed modules.
 * Each module cites its USPTO patent docket for Reduction to Practice (RTP).
 */

'use strict';

// ── HS-058: Continuous Semantic Logic Gates ──────────────────────
const CSLGates = require('./src/core/csl-gates-enhanced');

// ── HS-059: Self-Healing Attestation Mesh ────────────────────────
const AttestationMesh = require('./src/mesh/self-healing-attestation-mesh');

// ── HS-062: Vector-Native Security Scanner ───────────────────────
const VectorSecurity = require('./src/security/vector-native-scanner');

// ── HS-053: Neural Stream Telemetry ──────────────────────────────
const NeuralTelemetry = require('./src/telemetry/neural-stream-telemetry');

// ── HS-051: Vibe-Match Latency Delta ─────────────────────────────
const VibeMatch = require('./src/routing/vibe-match-router');

// ── HS-052: Shadow Memory Persistence ────────────────────────────
const ShadowMemory = require('./src/memory/shadow-memory-persistence');

// ── HS-060: Dynamic Bee Factory & Swarm Consensus ────────────────
const BeeFactory = require('./src/agents/dynamic-bee-factory-enhanced');

// ── HS-061: Metacognitive Self-Awareness Loop ────────────────────
const MetacognitiveLoop = require('./src/awareness/metacognitive-loop');

// ── Monte Carlo Simulation Engine (HCFullPipeline Stage) ─────────
const MonteCarlo = require('./src/intelligence/monte-carlo-engine');

// ── Socratic Execution Loop (4-Phase Validation) ─────────────────
const SocraticLoop = require('./src/orchestration/socratic-execution-loop');

// ── Deterministic Prompt Management (64 Master Prompts) ──────────
const PromptManager = require('./src/prompts/deterministic-prompt-manager');

// ── MIDI-to-MCP Protocol Bridge ──────────────────────────────────
const MidiBridge = require('./src/bridge/midi-to-mcp-bridge');

// ── Edge Durable Agents (Cloudflare Workers) ─────────────────────
const EdgeAgent = require('./src/edge/durable-edge-agent');

// ── Sovereign Identity with BYOK ─────────────────────────────────
const SovereignIdentity = require('./src/identity/sovereign-identity-byok');

// ── VALU Tensor Core (Math-as-a-Service) ─────────────────────────
const VALUCore = require('./src/compute/valu-tensor-core');

// ── Battle Arena Protocol ────────────────────────────────────────
const BattleArena = require('./src/arena/battle-arena-protocol');

// ── Empathic Persona Engine ──────────────────────────────────────
const PersonaEngine = require('./src/persona/empathic-persona-engine');

// ── Zero-Trust Sanitization Pipeline ─────────────────────────────
const ZeroTrust = require('./src/security/zero-trust-sanitizer');

// ── 3D Octree Spatial Index with Graph RAG ───────────────────────
const OctreeMemory = require('./src/memory/octree-spatial-index');

// ── Phi-Exponential Backoff (Enhanced) ───────────────────────────
const PhiBackoff = require('./src/resilience/phi-backoff-enhanced');

// ── 17-Swarm Decentralized Orchestration ─────────────────────────
const SwarmOrchestrator = require('./src/orchestration/seventeen-swarm-orchestrator');

// ── API Routes ───────────────────────────────────────────────────
const routes = {
    csl: require('./src/routes/csl-routes'),
    mesh: require('./src/routes/mesh-routes'),
    security: require('./src/routes/security-routes'),
    telemetry: require('./src/routes/telemetry-routes'),
    shadowMemory: require('./src/routes/shadow-memory-routes'),
    beeFactory: require('./src/routes/bee-factory-routes'),
    awareness: require('./src/routes/awareness-routes'),
    monteCarlo: require('./src/routes/monte-carlo-routes'),
    midi: require('./src/routes/midi-routes'),
    edge: require('./src/routes/edge-routes'),
    identity: require('./src/routes/identity-routes'),
    valu: require('./src/routes/valu-routes'),
    arena: require('./src/routes/arena-routes'),
    persona: require('./src/routes/persona-routes'),
    sanitizer: require('./src/routes/sanitizer-routes'),
    octree: require('./src/routes/octree-routes'),
};

module.exports = {
    // ── Core Gates (HS-058) ──
    CSLGates,

    // ── Self-Healing Mesh (HS-059) ──
    AttestationMesh,

    // ── Vector Security (HS-062) ──
    VectorSecurity,

    // ── Neural Telemetry (HS-053) ──
    NeuralTelemetry,

    // ── Vibe-Match Router (HS-051) ──
    VibeMatch,

    // ── Shadow Memory (HS-052) ──
    ShadowMemory,

    // ── Bee Factory (HS-060) ──
    BeeFactory,

    // ── Metacognitive Loop (HS-061) ──
    MetacognitiveLoop,

    // ── Monte Carlo Engine ──
    MonteCarlo,

    // ── Socratic Loop ──
    SocraticLoop,

    // ── Prompt Manager ──
    PromptManager,

    // ── MIDI Bridge ──
    MidiBridge,

    // ── Edge Agent ──
    EdgeAgent,

    // ── Sovereign Identity ──
    SovereignIdentity,

    // ── VALU Tensor Core ──
    VALUCore,

    // ── Battle Arena ──
    BattleArena,

    // ── Persona Engine ──
    PersonaEngine,

    // ── Zero-Trust Sanitizer ──
    ZeroTrust,

    // ── Octree Memory ──
    OctreeMemory,

    // ── Phi Backoff ──
    PhiBackoff,

    // ── Swarm Orchestrator ──
    SwarmOrchestrator,

    // ── All Routes ──
    routes,
};
