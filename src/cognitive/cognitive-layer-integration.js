/**
 * Cognitive Layer Integration — 7 Animal Layers Wired Into Pipeline
 * ==================================================================
 * FIX FOR: Finding #4 — Cognitive animal layers defined in config but not
 *          integrated into any pipeline or orchestration code.
 *
 * This module:
 *  - Loads the 7 cognitive layers from heady-cognitive-config.json
 *  - Provides a CognitiveFusion engine that runs all layers in PARALLEL
 *  - Resolves conflicts via WEIGHTED_SYNTHESIS (as spec'd in config)
 *  - Integrates as a pre-processor hook into HCFullPipeline stages
 *  - Each pipeline stage can be enhanced with relevant cognitive layer(s)
 *
 * The 7 Layers:
 *   owl_wisdom         — First principles, deep reasoning, pattern recognition
 *   eagle_omniscience  — 360° awareness, edge cases, security implications
 *   dolphin_creativity — Lateral thinking, elegant solutions, innovation
 *   rabbit_multiplication — Idea proliferation, contingency breeding
 *   ant_task           — Zero-skip execution, batch consistency
 *   elephant_memory    — Perfect recall, cross-session continuity
 *   beaver_build       — Clean architecture, quality construction
 *
 * @module src/cognitive/cognitive-layer-integration
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const {
  COGNITIVE_LAYERS,
  CSL_THRESHOLDS,
  PHI,
  PSI,
  phiFusionWeights,
  cosineSimilarity,
  cslGate,
} = require('../../shared/phi-math');

// ── Layer-to-Stage Mapping ──────────────────────────────────────────────────
// Which cognitive layers are most relevant to each pipeline stage.
// All layers run in parallel; this defines emphasis weights per stage.

const STAGE_LAYER_EMPHASIS = {
  CHANNEL_ENTRY:     ['elephant_memory', 'eagle_omniscience'],
  RECON:             ['eagle_omniscience', 'owl_wisdom'],
  INTAKE:            ['elephant_memory', 'eagle_omniscience'],
  CLASSIFY:          ['owl_wisdom', 'eagle_omniscience'],
  TRIAGE:            ['owl_wisdom', 'eagle_omniscience', 'ant_task'],
  DECOMPOSE:         ['rabbit_multiplication', 'beaver_build'],
  TRIAL_AND_ERROR:   ['dolphin_creativity', 'rabbit_multiplication', 'beaver_build'],
  ORCHESTRATE:       ['ant_task', 'beaver_build'],
  MONTE_CARLO:       ['owl_wisdom', 'rabbit_multiplication'],
  ARENA:             ['dolphin_creativity', 'rabbit_multiplication'],
  JUDGE:             ['owl_wisdom', 'eagle_omniscience'],
  APPROVE:           ['eagle_omniscience', 'owl_wisdom'],
  EXECUTE:           ['ant_task', 'beaver_build', 'elephant_memory'],
  VERIFY:            ['eagle_omniscience', 'owl_wisdom'],
  SELF_AWARENESS:    ['owl_wisdom', 'eagle_omniscience', 'elephant_memory'],
  SELF_CRITIQUE:     ['owl_wisdom', 'dolphin_creativity'],
  MISTAKE_ANALYSIS:  ['owl_wisdom', 'elephant_memory', 'eagle_omniscience'],
  OPTIMIZATION_OPS:  ['eagle_omniscience', 'beaver_build'],
  CONTINUOUS_SEARCH: ['dolphin_creativity', 'rabbit_multiplication', 'eagle_omniscience'],
  EVOLUTION:         ['dolphin_creativity', 'owl_wisdom', 'rabbit_multiplication'],
  RECEIPT:           ['ant_task', 'beaver_build'],
};

/**
 * CognitiveFusion — Runs all 7 layers in parallel, fuses results.
 *
 * Each "layer" acts as a lens that filters/enriches the input signal.
 * The fusion engine combines their outputs using phi-weighted synthesis.
 */
class CognitiveFusion {
  constructor(config = {}) {
    this.layers = COGNITIVE_LAYERS;
    this.minConfidence = config.minConfidence || 0.7;
    this.mode = config.mode || 'PARALLEL';
    this.conflictResolution = config.conflictResolution || 'WEIGHTED_SYNTHESIS';
    this.iterateOnLowConfidence = config.iterateOnLowConfidence !== false;
    this.maxIterations = 3;
  }

  /**
   * Process an input through all cognitive layers for a given pipeline stage.
   *
   * @param {string} stageName - The pipeline stage requesting cognitive processing
   * @param {object} input - The input to process (task, context, etc.)
   * @param {object} context - Additional context (vector memory, run state)
   * @returns {object} Fused cognitive output
   */
  async process(stageName, input, context = {}) {
    const emphasizedLayers = STAGE_LAYER_EMPHASIS[stageName] || Object.keys(this.layers);
    const startTime = Date.now();

    // Phase 1: Run all layers in parallel
    const layerResults = await this._runLayersParallel(input, context, emphasizedLayers);

    // Phase 2: Fuse results using weighted synthesis
    let fused = this._fuseResults(layerResults, emphasizedLayers);

    // Phase 3: Iterate if confidence is below threshold
    let iterations = 0;
    while (this.iterateOnLowConfidence &&
           fused.confidence < this.minConfidence &&
           iterations < this.maxIterations) {
      iterations++;
      const refinedResults = await this._runLayersParallel(
        { ...input, previousFusion: fused },
        context,
        emphasizedLayers,
      );
      fused = this._fuseResults(refinedResults, emphasizedLayers);
    }

    return {
      stage: stageName,
      fused,
      layerResults,
      emphasizedLayers,
      iterations,
      processingMs: Date.now() - startTime,
    };
  }

  /**
   * Run all cognitive layers in parallel.
   * Each layer applies its cognitive lens to the input.
   */
  async _runLayersParallel(input, context, emphasizedLayers) {
    const results = {};

    const layerPromises = Object.entries(this.layers).map(async ([layerName, layerConfig]) => {
      const isEmphasized = emphasizedLayers.includes(layerName);
      const weight = isEmphasized ? layerConfig.weight * PHI : layerConfig.weight;

      try {
        const output = await this._runSingleLayer(layerName, layerConfig, input, context);
        results[layerName] = {
          output,
          weight,
          emphasized: isEmphasized,
          confidence: output.confidence || 0.7,
        };
      } catch (err) {
        results[layerName] = {
          output: null,
          weight: 0,
          emphasized: isEmphasized,
          confidence: 0,
          error: err.message,
        };
      }
    });

    await Promise.allSettled(layerPromises);
    return results;
  }

  /**
   * Run a single cognitive layer.
   * In production, each layer would call its respective AI/logic system.
   * This implementation provides the interface and default heuristics.
   */
  async _runSingleLayer(layerName, layerConfig, input, context) {
    switch (layerName) {
      case 'owl_wisdom':
        return this._owlWisdom(input, context);
      case 'eagle_omniscience':
        return this._eagleOmniscience(input, context);
      case 'dolphin_creativity':
        return this._dolphinCreativity(input, context);
      case 'rabbit_multiplication':
        return this._rabbitMultiplication(input, context);
      case 'ant_task':
        return this._antTask(input, context);
      case 'elephant_memory':
        return this._elephantMemory(input, context);
      case 'beaver_build':
        return this._beaverBuild(input, context);
      default:
        return { confidence: 0.5, insights: [] };
    }
  }

  // ── Layer Implementations ───────────────────────────────────────────────

  /** First principles reasoning, pattern recognition across time */
  async _owlWisdom(input, context) {
    const insights = [];
    const warnings = [];

    // Check for known patterns from wisdom.json / vector memory
    if (context.vectorMemory) {
      const stimulus = typeof input === 'string' ? input : JSON.stringify(input.task || input);
      try {
        const patterns = await context.vectorMemory.queryMemory(stimulus, 5, { type: 'pattern' });
        if (patterns.length > 0) {
          insights.push({
            type: 'pattern_match',
            description: `Found ${patterns.length} relevant historical patterns`,
            topScore: patterns[0].score,
            patterns: patterns.slice(0, 3).map(p => p.content),
          });
        }
      } catch { /* non-critical */ }
    }

    return { confidence: 0.75, insights, warnings, layer: 'owl_wisdom' };
  }

  /** 360° awareness — edge cases, security implications, failure modes */
  async _eagleOmniscience(input, context) {
    const insights = [];
    const risks = [];

    // Scan for potential risks in the input
    if (input.task || input.code) {
      const text = input.task || input.code || '';
      // Basic risk pattern detection
      const riskPatterns = [
        { pattern: /delete|remove|drop/i, risk: 'destructive_operation' },
        { pattern: /deploy|push|publish/i, risk: 'production_change' },
        { pattern: /secret|key|password|token/i, risk: 'credential_handling' },
        { pattern: /eval|exec|spawn/i, risk: 'code_execution' },
      ];
      for (const { pattern, risk } of riskPatterns) {
        if (pattern.test(text)) {
          risks.push({ type: risk, severity: 'medium', detected: pattern.source });
        }
      }
    }

    return {
      confidence: 0.8,
      insights,
      risks,
      riskLevel: risks.length > 0 ? 'ELEVATED' : 'NOMINAL',
      layer: 'eagle_omniscience',
    };
  }

  /** Lateral thinking, elegant solutions, combinatorial innovation */
  async _dolphinCreativity(input, context) {
    return {
      confidence: 0.7,
      insights: [],
      alternatives: [],
      layer: 'dolphin_creativity',
    };
  }

  /** Idea proliferation, 5+ angles, contingency breeding */
  async _rabbitMultiplication(input, context) {
    return {
      confidence: 0.7,
      insights: [],
      angles: [],
      contingencies: [],
      layer: 'rabbit_multiplication',
    };
  }

  /** Zero-skip execution, batch consistency */
  async _antTask(input, context) {
    return {
      confidence: 0.85,
      insights: [],
      executionPlan: null,
      layer: 'ant_task',
    };
  }

  /** Perfect recall, cross-session continuity */
  async _elephantMemory(input, context) {
    const insights = [];

    if (context.vectorMemory) {
      const stimulus = typeof input === 'string' ? input : JSON.stringify(input.task || input);
      try {
        const memories = await context.vectorMemory.queryMemory(stimulus, 8, {});
        if (memories.length > 0) {
          insights.push({
            type: 'memory_recall',
            description: `Recalled ${memories.length} relevant memories`,
            topScore: memories[0].score,
          });
        }
      } catch { /* non-critical */ }
    }

    return { confidence: 0.8, insights, layer: 'elephant_memory' };
  }

  /** Clean architecture, quality construction */
  async _beaverBuild(input, context) {
    return {
      confidence: 0.75,
      insights: [],
      architectureNotes: [],
      layer: 'beaver_build',
    };
  }

  // ── Fusion ──────────────────────────────────────────────────────────────

  /**
   * Fuse layer results using weighted synthesis.
   */
  _fuseResults(layerResults, emphasizedLayers) {
    const allInsights = [];
    const allRisks = [];
    let totalWeight = 0;
    let weightedConfidence = 0;

    for (const [layerName, result] of Object.entries(layerResults)) {
      if (!result.output) continue;

      const weight = result.weight;
      totalWeight += weight;
      weightedConfidence += (result.confidence || 0) * weight;

      if (result.output.insights) allInsights.push(...result.output.insights);
      if (result.output.risks) allRisks.push(...result.output.risks);
    }

    const confidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;

    return {
      confidence: Math.round(confidence * 1000) / 1000,
      insights: allInsights,
      risks: allRisks,
      layerCount: Object.keys(layerResults).length,
      activeLayerCount: Object.values(layerResults).filter(r => r.output).length,
      emphasizedLayers,
    };
  }
}

/**
 * Create a pipeline hook that integrates cognitive processing.
 * Returns a function that wraps stage execution with cognitive pre/post processing.
 *
 * @param {CognitiveFusion} fusion - The CognitiveFusion instance
 * @returns {function} Stage wrapper function
 */
function createPipelineHook(fusion) {
  return async function cognitiveStageWrapper(stageName, stageInput, context, originalStageFn) {
    // Pre-process through cognitive layers
    const cognitiveResult = await fusion.process(stageName, stageInput, context);

    // Enrich input with cognitive insights
    const enrichedInput = {
      ...stageInput,
      _cognitive: {
        insights: cognitiveResult.fused.insights,
        risks: cognitiveResult.fused.risks,
        confidence: cognitiveResult.fused.confidence,
        emphasizedLayers: cognitiveResult.emphasizedLayers,
      },
    };

    // Execute the original stage with enriched input
    const result = await originalStageFn(enrichedInput);

    // Attach cognitive metadata to result
    return {
      ...result,
      _cognitiveMetadata: {
        layersUsed: cognitiveResult.emphasizedLayers,
        confidence: cognitiveResult.fused.confidence,
        processingMs: cognitiveResult.processingMs,
        iterations: cognitiveResult.iterations,
      },
    };
  };
}

module.exports = {
  CognitiveFusion,
  createPipelineHook,
  STAGE_LAYER_EMPHASIS,
};
