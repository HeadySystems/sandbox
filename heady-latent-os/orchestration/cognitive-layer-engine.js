/**
 * @fileoverview Cognitive Layer Engine — 7-Animal Cognitive Architecture
 * @module orchestration/cognitive-layer-engine
 * @version 2.0.0
 * @author HeadySystems Inc.
 *
 * Maps the 7 cognitive animal archetypes from heady-cognitive-config.json
 * to HCFullPipeline stages and task execution. Each layer contributes
 * phi-weighted reasoning to the fusion engine.
 *
 * Layers (by Sacred Geometry ring):
 *   Inner Ring  (Governance) : OWL, EAGLE
 *   Middle Ring (Critical)   : DOLPHIN, RABBIT
 *   Outer Ring  (Execution)  : ANT, ELEPHANT, BEAVER
 *
 * Persona Mappings (Directive 6):
 *   EMPATHIC_SAFE_SPACE      → OWL + ELEPHANT
 *   ANALYTICAL_COACH         → OWL + EAGLE + BEAVER
 *   ENVIRONMENTAL_ACTUATOR   → ANT + BEAVER
 *   CREATIVE_COLLABORATOR    → DOLPHIN + RABBIT
 *   EXECUTIVE_STRATEGIST     → EAGLE + OWL + RABBIT
 *
 * @see heady-cognitive-config.json
 * @see MASTER_DIRECTIVES.md §6 (Empathic Masking & Persona Fidelity)
 * @see MASTER_DIRECTIVES.md §7 (HCFullPipeline — 21-Stage Cognitive State Machine)
 */

'use strict';

import {
  PHI,
  PSI,
  fib,
  phiThreshold,
  phiFusionWeights,
  cosineSimilarity,
  placeholderVector,
  CSL_THRESHOLDS,
  sacredGeometryPosition,
  VECTOR_DIMENSIONS,
  COHERENCE_DRIFT_THRESHOLD,
  cslGate,
  normalize,
} from '../shared/phi-math.js';

// ─── Layer IDs ────────────────────────────────────────────────────────────────

export const LAYER_ID = Object.freeze({
  OWL:      'OWL',
  EAGLE:    'EAGLE',
  DOLPHIN:  'DOLPHIN',
  RABBIT:   'RABBIT',
  ANT:      'ANT',
  ELEPHANT: 'ELEPHANT',
  BEAVER:   'BEAVER',
});

// ─── Persona IDs ──────────────────────────────────────────────────────────────

export const PERSONA_ID = Object.freeze({
  EMPATHIC_SAFE_SPACE:    'EMPATHIC_SAFE_SPACE',
  ANALYTICAL_COACH:       'ANALYTICAL_COACH',
  ENVIRONMENTAL_ACTUATOR: 'ENVIRONMENTAL_ACTUATOR',
  CREATIVE_COLLABORATOR:  'CREATIVE_COLLABORATOR',
  EXECUTIVE_STRATEGIST:   'EXECUTIVE_STRATEGIST',
});

// ─── Pipeline Stage IDs ───────────────────────────────────────────────────────

/** All 21 HCFullPipeline stage IDs (Directive 7) */
export const STAGE_ID = Object.freeze({
  CHANNEL_ENTRY:     'CHANNEL_ENTRY',
  RECON:             'RECON',
  INTAKE:            'INTAKE',
  CLASSIFY:          'CLASSIFY',
  TRIAGE:            'TRIAGE',
  DECOMPOSE:         'DECOMPOSE',
  TRIAL_AND_ERROR:   'TRIAL_AND_ERROR',
  ORCHESTRATE:       'ORCHESTRATE',
  MONTE_CARLO:       'MONTE_CARLO',
  ARENA:             'ARENA',
  JUDGE:             'JUDGE',
  APPROVE:           'APPROVE',
  EXECUTE:           'EXECUTE',
  VERIFY:            'VERIFY',
  SELF_AWARENESS:    'SELF_AWARENESS',
  SELF_CRITIQUE:     'SELF_CRITIQUE',
  MISTAKE_ANALYSIS:  'MISTAKE_ANALYSIS',
  OPTIMIZATION_OPS:  'OPTIMIZATION_OPS',
  CONTINUOUS_SEARCH: 'CONTINUOUS_SEARCH',
  EVOLUTION:         'EVOLUTION',
  RECEIPT:           'RECEIPT',
});

// ─── Minimum Confidence Floors ────────────────────────────────────────────────

/** CRITICAL layers floor: phiThreshold(1) ≈ 0.691 */
const CRITICAL_FLOOR = phiThreshold(1); // ≈ 0.691

/** HIGH layers floor: phiThreshold(0) ≈ 0.500 */
const HIGH_FLOOR = phiThreshold(0); // ≈ 0.500

/** Phi-derived layer weights */
const WEIGHT_CRITICAL = PSI;        // 0.618 — CRITICAL priority layers
const WEIGHT_HIGH     = PSI * PSI;  // 0.382 — HIGH priority layers

// ─── Layer Definition Builder ─────────────────────────────────────────────────

/**
 * @typedef {Object} CognitiveLayer
 * @property {string}   id
 * @property {string}   name
 * @property {string}   archetype
 * @property {string}   description
 * @property {'CRITICAL'|'HIGH'} priority
 * @property {number}   minConfidence   — floor confidence for activation
 * @property {string[]} activationStages — pipeline stage IDs
 * @property {number}   weight          — phi-derived contribution weight
 * @property {number[]} embedding       — 384-dim conceptual vector (placeholder)
 * @property {{ x: number, y: number, ring: number }} position — Sacred Geometry
 * @property {Object}   metrics         — runtime performance tracking
 */

/**
 * Build the canonical 7 cognitive layer definitions.
 * @returns {Map<string, CognitiveLayer>}
 */
function buildLayerDefinitions() {
  /** @type {Array<Omit<CognitiveLayer,'embedding'|'position'|'metrics'>>} */
  const raw = [
    {
      id:               LAYER_ID.OWL,
      name:             'Wisdom Layer',
      archetype:        'OWL',
      description:      'First principles, deep reasoning, pattern recognition across time, governance',
      priority:         'CRITICAL',
      minConfidence:    CRITICAL_FLOOR,
      activationStages: [
        STAGE_ID.CLASSIFY,
        STAGE_ID.JUDGE,
        STAGE_ID.APPROVE,
        STAGE_ID.SELF_AWARENESS,
      ],
      weight: WEIGHT_CRITICAL,
    },
    {
      id:               LAYER_ID.EAGLE,
      name:             'Omniscience Layer',
      archetype:        'EAGLE',
      description:      '360° awareness, edge cases, security implications, failure modes',
      priority:         'CRITICAL',
      minConfidence:    CRITICAL_FLOOR,
      activationStages: [
        STAGE_ID.RECON,
        STAGE_ID.TRIAGE,
        STAGE_ID.VERIFY,
        STAGE_ID.SELF_CRITIQUE,
      ],
      weight: WEIGHT_CRITICAL,
    },
    {
      id:               LAYER_ID.DOLPHIN,
      name:             'Creativity Layer',
      archetype:        'DOLPHIN',
      description:      'Lateral thinking, elegant solutions, combinatorial innovation',
      priority:         'CRITICAL',
      minConfidence:    CRITICAL_FLOOR,
      activationStages: [
        STAGE_ID.TRIAL_AND_ERROR,
        STAGE_ID.ARENA,
        STAGE_ID.EVOLUTION,
      ],
      weight: WEIGHT_CRITICAL,
    },
    {
      id:               LAYER_ID.RABBIT,
      name:             'Multiplication Layer',
      archetype:        'RABBIT',
      description:      'Idea proliferation, 5+ angles minimum, contingency breeding',
      priority:         'CRITICAL',
      minConfidence:    CRITICAL_FLOOR,
      activationStages: [
        STAGE_ID.DECOMPOSE,
        STAGE_ID.MONTE_CARLO,
        STAGE_ID.CONTINUOUS_SEARCH,
      ],
      weight: WEIGHT_CRITICAL,
    },
    {
      id:               LAYER_ID.ANT,
      name:             'Task Layer',
      archetype:        'ANT',
      description:      'Zero-skip repetitive execution, batch consistency, precision delivery',
      priority:         'HIGH',
      minConfidence:    HIGH_FLOOR,
      activationStages: [
        STAGE_ID.EXECUTE,
        STAGE_ID.ORCHESTRATE,
      ],
      weight: WEIGHT_HIGH,
    },
    {
      id:               LAYER_ID.ELEPHANT,
      name:             'Memory Layer',
      archetype:        'ELEPHANT',
      description:      'Perfect recall, cross-session continuity, deep focus, mistake retention',
      priority:         'HIGH',
      minConfidence:    HIGH_FLOOR,
      activationStages: [
        STAGE_ID.INTAKE,
        STAGE_ID.RECEIPT,
        STAGE_ID.MISTAKE_ANALYSIS,
      ],
      weight: WEIGHT_HIGH,
    },
    {
      id:               LAYER_ID.BEAVER,
      name:             'Build Layer',
      archetype:        'BEAVER',
      description:      'Clean architecture, proper scaffolding, quality construction, system hygiene',
      priority:         'HIGH',
      minConfidence:    HIGH_FLOOR,
      activationStages: [
        STAGE_ID.EXECUTE,
        STAGE_ID.OPTIMIZATION_OPS,
        STAGE_ID.VERIFY,
      ],
      weight: WEIGHT_HIGH,
    },
  ];

  const map = new Map();

  // Sacred Geometry ring assignment:
  //   Ring 0 (inner/governance): OWL, EAGLE  (2 layers)
  //   Ring 1 (middle/critical) : DOLPHIN, RABBIT  (2 layers)
  //   Ring 2 (outer/execution) : ANT, ELEPHANT, BEAVER  (3 layers)
  const ringMap = {
    [LAYER_ID.OWL]:      { ring: 0, idx: 0, total: 2 },
    [LAYER_ID.EAGLE]:    { ring: 0, idx: 1, total: 2 },
    [LAYER_ID.DOLPHIN]:  { ring: 1, idx: 0, total: 2 },
    [LAYER_ID.RABBIT]:   { ring: 1, idx: 1, total: 2 },
    [LAYER_ID.ANT]:      { ring: 2, idx: 0, total: 3 },
    [LAYER_ID.ELEPHANT]: { ring: 2, idx: 1, total: 3 },
    [LAYER_ID.BEAVER]:   { ring: 2, idx: 2, total: 3 },
  };

  raw.forEach(def => {
    const { ring, idx, total } = ringMap[def.id];
    map.set(def.id, {
      ...def,
      embedding: placeholderVector(`cognitive:${def.archetype}`, VECTOR_DIMENSIONS),
      position: sacredGeometryPosition(ring, idx, total),
      metrics: {
        activationCount: 0,
        avgConfidence: 0,
        lastActivated: null,
        successRate: 1.0,
      },
    });
  });

  return map;
}

// ─── Persona → Layer Mapping ──────────────────────────────────────────────────

/**
 * Canonical persona → primary layer mapping (Directive 6).
 * @type {Object.<string, string[]>}
 */
const PERSONA_LAYERS = Object.freeze({
  [PERSONA_ID.EMPATHIC_SAFE_SPACE]:    [LAYER_ID.OWL,     LAYER_ID.ELEPHANT],
  [PERSONA_ID.ANALYTICAL_COACH]:       [LAYER_ID.OWL,     LAYER_ID.EAGLE,  LAYER_ID.BEAVER],
  [PERSONA_ID.ENVIRONMENTAL_ACTUATOR]: [LAYER_ID.ANT,     LAYER_ID.BEAVER],
  [PERSONA_ID.CREATIVE_COLLABORATOR]:  [LAYER_ID.DOLPHIN, LAYER_ID.RABBIT],
  [PERSONA_ID.EXECUTIVE_STRATEGIST]:   [LAYER_ID.EAGLE,   LAYER_ID.OWL,    LAYER_ID.RABBIT],
});

// ─── Class: CognitiveLayerEngine ──────────────────────────────────────────────

/**
 * @typedef {Object} LayerOutput
 * @property {string} layerId
 * @property {number} confidence — 0–1
 * @property {*}      result     — layer-specific output payload
 * @property {number} processingMs
 */

/**
 * @typedef {Object} FusedOutput
 * @property {*}      result           — synthesized output
 * @property {number} confidence       — composite confidence score
 * @property {string[]} activeLayers   — layer IDs that contributed
 * @property {Object.<string,number>} weights — per-layer fusion weights
 */

export class CognitiveLayerEngine {
  constructor() {
    /** @type {Map<string, CognitiveLayer>} */
    this.layers = buildLayerDefinitions();

    /** @type {number} Engine startup timestamp */
    this._startedAt = Date.now();

    /** @type {Array<{ stageId: string, layerIds: string[], ts: number, confidence: number }>} */
    this._activationHistory = [];

    this._log('info', 'CognitiveLayerEngine initialized', {
      layers: Array.from(this.layers.keys()),
      criticalLayers: this._getCriticalLayers().length,
      highLayers: this._getHighLayers().length,
    });
  }

  // ─── Layer Activation ──────────────────────────────────────────────────────

  /**
   * Returns which cognitive layers should be active for a given pipeline stage.
   * A layer is active if stageId appears in its activationStages array.
   *
   * @param {string} stageId — HCFullPipeline stage identifier
   * @returns {CognitiveLayer[]} ordered by weight descending
   */
  getActiveLayers(stageId) {
    const active = [];

    this.layers.forEach(layer => {
      if (layer.activationStages.includes(stageId)) {
        active.push(layer);
      }
    });

    // Sort: CRITICAL before HIGH, then by weight descending
    active.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'CRITICAL' ? -1 : 1;
      }
      return b.weight - a.weight;
    });

    return active;
  }

  // ─── Layer Weights ─────────────────────────────────────────────────────────

  /**
   * Returns phi-weighted contribution of each active layer for a given stage.
   * Weights are normalized so they sum to 1.0.
   * CRITICAL layers receive WEIGHT_CRITICAL (≈0.618); HIGH receive WEIGHT_HIGH (≈0.382).
   * Among layers of equal priority, phi-fusion sub-weights are applied.
   *
   * @param {string} stageId
   * @returns {Object.<string, number>} layerId → normalized weight
   */
  computeLayerWeights(stageId) {
    const activeLayers = this.getActiveLayers(stageId);
    if (activeLayers.length === 0) return {};

    // Separate CRITICAL and HIGH
    const criticals = activeLayers.filter(l => l.priority === 'CRITICAL');
    const highs      = activeLayers.filter(l => l.priority === 'HIGH');

    const result = {};

    // CRITICAL block weight: PSI = 0.618, HIGH block: PSI² = 0.382
    // (if only one priority tier is active, it takes 1.0)
    const hasBoth = criticals.length > 0 && highs.length > 0;
    const criticalBlockWeight = hasBoth ? WEIGHT_CRITICAL : (criticals.length > 0 ? 1.0 : 0);
    const highBlockWeight     = hasBoth ? WEIGHT_HIGH     : (highs.length > 0 ? 1.0 : 0);

    // Sub-weights within each block using phiFusionWeights
    if (criticals.length > 0) {
      const subWeights = phiFusionWeights(criticals.length);
      criticals.forEach((layer, i) => {
        result[layer.id] = criticalBlockWeight * subWeights[i];
      });
    }
    if (highs.length > 0) {
      const subWeights = phiFusionWeights(highs.length);
      highs.forEach((layer, i) => {
        result[layer.id] = highBlockWeight * subWeights[i];
      });
    }

    // Normalize to sum = 1.0
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(result).forEach(k => { result[k] = result[k] / total; });
    }

    return result;
  }

  // ─── Output Fusion ─────────────────────────────────────────────────────────

  /**
   * Weighted synthesis of layer outputs using phiFusionWeights.
   * Combines numeric confidence scores; passes through the highest-weighted
   * result payload as the synthesis winner.
   *
   * @param {LayerOutput[]} layerResults
   * @returns {FusedOutput}
   */
  fuseLayerOutputs(layerResults) {
    if (!layerResults || layerResults.length === 0) {
      return { result: null, confidence: 0, activeLayers: [], weights: {} };
    }

    const stageId = layerResults[0]?._stageId ?? 'EXECUTE';
    const weights = this.computeLayerWeights(stageId);

    let totalConfidence = 0;
    let bestResult = null;
    let bestWeight = 0;
    const activeLayers = [];
    const usedWeights = {};

    layerResults.forEach(lr => {
      const w = weights[lr.layerId] ?? (1 / layerResults.length);
      totalConfidence += lr.confidence * w;
      activeLayers.push(lr.layerId);
      usedWeights[lr.layerId] = parseFloat(w.toFixed(6));

      if (w > bestWeight) {
        bestWeight = w;
        bestResult = lr.result;
      }

      // Update layer metrics
      const layer = this.layers.get(lr.layerId);
      if (layer) {
        layer.metrics.activationCount++;
        layer.metrics.lastActivated = new Date().toISOString();
        // Exponential moving average for avgConfidence
        layer.metrics.avgConfidence =
          layer.metrics.avgConfidence * PSI + lr.confidence * (1 - PSI);
      }
    });

    return {
      result: bestResult,
      confidence: parseFloat(totalConfidence.toFixed(6)),
      activeLayers,
      weights: usedWeights,
    };
  }

  // ─── Confidence Assessment ─────────────────────────────────────────────────

  /**
   * Compute composite confidence from all active layer results.
   * Uses phi-weighted harmonic mean — penalizes any layer falling below its floor.
   *
   * @param {LayerOutput[]} layerResults
   * @returns {{ composite: number, allAboveFloor: boolean, worstLayer: string|null }}
   */
  assessConfidence(layerResults) {
    if (!layerResults || layerResults.length === 0) {
      return { composite: 0, allAboveFloor: false, worstLayer: null };
    }

    let allAboveFloor = true;
    let worstLayer = null;
    let worstConfidence = Infinity;
    let weightedSum = 0;
    let totalWeight = 0;

    const weights = phiFusionWeights(layerResults.length);

    layerResults.forEach((lr, i) => {
      const layer = this.layers.get(lr.layerId);
      const floor = layer?.minConfidence ?? HIGH_FLOOR;
      const w = weights[i];

      weightedSum += lr.confidence * w;
      totalWeight += w;

      if (lr.confidence < floor) {
        allAboveFloor = false;
      }
      if (lr.confidence < worstConfidence) {
        worstConfidence = lr.confidence;
        worstLayer = lr.layerId;
      }
    });

    const composite = totalWeight > 0
      ? parseFloat((weightedSum / totalWeight).toFixed(6))
      : 0;

    return { composite, allAboveFloor, worstLayer };
  }

  // ─── Layer Health ──────────────────────────────────────────────────────────

  /**
   * Return per-layer status and accumulated metrics.
   * @returns {Object.<string, { id: string, priority: string, health: 'HEALTHY'|'DEGRADED', metrics: Object }>}
   */
  getLayerHealth() {
    const health = {};

    this.layers.forEach((layer, id) => {
      const avgConf = layer.metrics.avgConfidence;
      const isHealthy = avgConf === 0 || avgConf >= layer.minConfidence;

      health[id] = {
        id,
        name: layer.name,
        archetype: layer.archetype,
        priority: layer.priority,
        minConfidence: layer.minConfidence,
        weight: layer.weight,
        health: isHealthy ? 'HEALTHY' : 'DEGRADED',
        metrics: { ...layer.metrics },
        position: layer.position,
      };
    });

    return health;
  }

  // ─── Persona Mapping ───────────────────────────────────────────────────────

  /**
   * Returns which cognitive layers are primary for a given persona mode.
   *
   * @param {string} personaId — one of PERSONA_ID values
   * @returns {{ primary: CognitiveLayer[], weights: Object.<string, number> }}
   * @throws {Error} if personaId is unknown
   */
  mapLayerToPersona(personaId) {
    const layerIds = PERSONA_LAYERS[personaId];
    if (!layerIds) {
      throw new Error(`mapLayerToPersona: unknown personaId "${personaId}". ` +
        `Valid: ${Object.keys(PERSONA_LAYERS).join(', ')}`);
    }

    const primary = layerIds
      .map(id => this.layers.get(id))
      .filter(Boolean);

    // Compute phi-fusion weights for this persona's layer set
    const subWeights = phiFusionWeights(primary.length);
    const weights = {};
    primary.forEach((layer, i) => {
      weights[layer.id] = parseFloat(subWeights[i].toFixed(6));
    });

    return { primary, weights };
  }

  // ─── Topology ──────────────────────────────────────────────────────────────

  /**
   * Return Sacred Geometry ring positions for all 7 cognitive layers.
   * Inner ring = governance/wisdom, middle = creative/generative, outer = execution.
   *
   * @returns {{ rings: Array<{ ring: number, label: string, layers: Array<{ id: string, position: Object }> }> }}
   */
  getTopology() {
    const ringDef = [
      { ring: 0, label: 'governance', layerIds: [LAYER_ID.OWL, LAYER_ID.EAGLE] },
      { ring: 1, label: 'generative', layerIds: [LAYER_ID.DOLPHIN, LAYER_ID.RABBIT] },
      { ring: 2, label: 'execution',  layerIds: [LAYER_ID.ANT, LAYER_ID.ELEPHANT, LAYER_ID.BEAVER] },
    ];

    return {
      rings: ringDef.map(({ ring, label, layerIds }) => ({
        ring,
        label,
        layers: layerIds.map(id => {
          const layer = this.layers.get(id);
          return {
            id,
            archetype: layer?.archetype,
            name: layer?.name,
            priority: layer?.priority,
            weight: layer?.weight,
            position: layer?.position,
          };
        }),
      })),
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /** @private */
  _getCriticalLayers() {
    return Array.from(this.layers.values()).filter(l => l.priority === 'CRITICAL');
  }

  /** @private */
  _getHighLayers() {
    return Array.from(this.layers.values()).filter(l => l.priority === 'HIGH');
  }

  /**
   * @private
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} message
   * @param {Object} [meta]
   */
  _log(level, message, meta = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      module: 'CognitiveLayerEngine',
      message,
      ...meta,
    };
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    } else if (process.env.LOG_LEVEL === 'debug') {
      console.log(JSON.stringify(entry));
    }
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  /**
   * Complete engine status snapshot.
   * @returns {Object}
   */
  getStatus() {
    return {
      version: '2.0.0',
      uptime: Date.now() - this._startedAt,
      layerCount: this.layers.size,
      health: this.getLayerHealth(),
      topology: this.getTopology(),
      personaMappings: Object.fromEntries(
        Object.keys(PERSONA_LAYERS).map(pid => {
          const { primary, weights } = this.mapLayerToPersona(pid);
          return [pid, { layerIds: primary.map(l => l.id), weights }];
        })
      ),
      thresholds: {
        criticalFloor: CRITICAL_FLOOR,
        highFloor: HIGH_FLOOR,
        coherenceDrift: COHERENCE_DRIFT_THRESHOLD,
        cslThresholds: {
          MINIMUM:  phiThreshold(0),
          LOW:      phiThreshold(1),
          MEDIUM:   phiThreshold(2),
          HIGH:     phiThreshold(3),
          CRITICAL: phiThreshold(4),
        },
      },
      sacredGeometry: {
        criticalWeight: WEIGHT_CRITICAL,
        highWeight:     WEIGHT_HIGH,
        phi: PHI,
        psi: PSI,
      },
    };
  }
}

export default CognitiveLayerEngine;
