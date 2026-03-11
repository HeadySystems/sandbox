'use strict';
/**
 * self-awareness.js — HeadySelfAwareness
 * Metacognition engine for the Heady™ Sovereign AI Platform.
 * From MASTER_DIRECTIVES Stage 14.
 *
 * Capabilities:
 *   1. Confidence calibration over fib(8)=21 run sliding window
 *   2. Blind spot detection via counterfactual reasoning (fib(4)=3 minimum)
 *   3. Cognitive load assessment using phi pressure thresholds
 *   4. Knowledge boundary detection via low-confidence query mapping
 *   5. Self-awareness report generation (overall score must exceed PSI=0.618)
 *   6. Prediction tracking with sliding-window accuracy measurement
 */

const { EventEmitter } = require('events');
const phi = require('../../shared/phi-math.js');
const {
  PHI, PSI, PHI_SQ, FIBONACCI, fib, phiBackoff,
  phiThreshold, phiFusionWeights, phiResourceWeights,
  phiTimeout, cslGate, pressureLevel,
  CSL_THRESHOLDS, PRESSURE_LEVELS, ALERT_THRESHOLDS,
  nearestFib
} = phi;

// ─── Calibration constants ─────────────────────────────────────────────────────
const LOOKBACK_WINDOW      = fib(8);  // 21 pipeline runs
const CALIBRATION_THRESHOLD = PSI;    // 0.618 = 1/φ — recalibrate if below
const MIN_COUNTERFACTUALS   = fib(4); // 3 minimum per assessment

// ─── Confidence score constants ───────────────────────────────────────────────
const CONFIDENCE_FLOOR      = PSI * PSI;              // ≈ 0.382 — absolute floor
const CONFIDENCE_NOMINAL    = PSI;                    // ≈ 0.618 — nominal threshold
const CONFIDENCE_HIGH       = phiThreshold(2);        // ≈ 0.809 — strong confidence
const CONFIDENCE_CRITICAL   = phiThreshold(4);        // ≈ 0.927 — near-certain

// ─── Bias detection methods ────────────────────────────────────────────────────
const BIAS_METHODS = [
  'confirmation_bias',
  'anchoring_bias',
  'availability_bias',
  'survivorship_bias'
];

// ─── Cognitive load pressure multipliers (phi-derived) ───────────────────────
const LOAD_WEIGHTS = phiFusionWeights(3); // [~0.528, ~0.326, ~0.146]
// Maps to: [active_task_weight, queue_depth_weight, context_window_weight]

// ─── Knowledge gap severity thresholds ────────────────────────────────────────
const GAP_SEVERITY_THRESHOLD = phiThreshold(1); // ≈ 0.691 — flag if confidence < this

// ─── Sliding window utilities ─────────────────────────────────────────────────
function slidingWindow(arr, maxSize = LOOKBACK_WINDOW) {
  if (arr.length > maxSize) {
    const evict = arr.length - maxSize;
    arr.splice(0, evict);
  }
  return arr;
}

// ─── Cosine similarity in N-dim space (dense vectors) ────────────────────────
function cosineSimilarityDense(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── HeadySelfAwareness ───────────────────────────────────────────────────────
class HeadySelfAwareness extends EventEmitter {
  constructor(options = {}) {
    super();

    // ── Calibration state ──
    this._calibrationWindow = [];     // Array<{ predicted, actual, match }>
    this._calibrationScore  = 1.0;   // starts optimistic, drops on misses
    this._recalibrationsCount = 0;

    // ── Blind spot detection state ──
    this._counterfactualLog  = [];    // Array<CounterfactualAssessment>
    this._biasDetectionCounts = {};
    for (const m of BIAS_METHODS) this._biasDetectionCounts[m] = 0;

    // ── Cognitive load state ──
    this._activeTasks       = 0;
    this._queueDepth        = 0;
    this._contextWindowUsage = 0.0;  // 0–1 fraction
    this._maxActiveTasks    = fib(9);  // 34 — phi-derived max tracked
    this._maxQueueDepth     = fib(13); // 233

    // ── Knowledge boundary state ──
    this._knowledgeGaps     = new Map(); // topicKey → { count, avgConfidence, vectors }
    this._gapVectorDim      = fib(7);   // 13-dim simplified representation
    this._lowConfidenceLog  = [];

    // ── Prediction tracking state ──
    this._predictions       = new Map(); // predictionId → PredictionRecord
    this._predictionHistory = [];        // Array<{ predictionId, accurate }>
    this._predictionAccuracy = 1.0;     // rolling accuracy

    // ── Report state ──
    this._lastReport        = null;
    this._assessmentCount   = 0;
    this._startedAt         = Date.now();

    // ── HeadySoul escalation callback ──
    this._onEscalate        = options.onEscalate || null;

    // Periodic self-assessment: every fib(10)×1000 = 55000ms
    this._assessInterval = setInterval(
      () => this._periodicAssessment(),
      fib(10) * 1000
    ).unref();
  }

  // ─── Public API: assess() ────────────────────────────────────────────────────
  async assess(context = {}) {
    this._assessmentCount++;
    const assessStart = Date.now();

    // 1. Confidence calibration
    const calibration = this._runCalibration(context);

    // 2. Blind spot detection
    const blindSpots = this._detectBlindSpots(context);

    // 3. Cognitive load
    const cognitiveLoad = this._assessCognitiveLoad(context);

    // 4. Knowledge boundaries
    const knowledgeBoundaries = this._assessKnowledgeBoundaries(context);

    // 5. Synthesize overall confidence
    const overallConfidence = this._computeOverallConfidence({
      calibration, blindSpots, cognitiveLoad, knowledgeBoundaries
    });

    const assessmentMs = Date.now() - assessStart;

    const assessment = {
      id:              `assess-${this._assessmentCount}-${Date.now()}`,
      timestamp:       new Date().toISOString(),
      assessmentMs,
      calibration,
      blindSpots,
      cognitiveLoad,
      knowledgeBoundaries,
      overallConfidence,
      meetsThreshold:  overallConfidence >= CALIBRATION_THRESHOLD,
      pressureLevel:   cognitiveLoad.level
    };

    // Escalate to HeadySoul if below threshold
    if (!assessment.meetsThreshold) {
      this._escalate(assessment);
    }

    this.emit('assessment:complete', assessment);
    return assessment;
  }

  // ─── Confidence Calibration ──────────────────────────────────────────────────
  _runCalibration(context) {
    // Use any predictions that have resolved since last assessment
    const resolved = this._drainResolvedPredictions();

    for (const rec of resolved) {
      this._calibrationWindow.push({
        predictionId: rec.id,
        predicted:    rec.predictedConfidence,
        actual:       rec.actualOutcome,
        match:        Math.abs(rec.predictedConfidence - rec.actualOutcome) < PSI * PSI // within ψ²≈0.382
      });
    }
    slidingWindow(this._calibrationWindow, LOOKBACK_WINDOW);

    // Calibration score = fraction of predictions within ψ²-tolerance
    const window = this._calibrationWindow;
    const score  = window.length > 0
      ? window.filter(r => r.match).length / window.length
      : 1.0;

    this._calibrationScore = score;

    const needsRecalibration = score < CALIBRATION_THRESHOLD;
    if (needsRecalibration) {
      this._recalibrationsCount++;
      this._recalibrate();
    }

    return {
      score,
      windowSize:          window.length,
      targetWindow:        LOOKBACK_WINDOW,
      threshold:           CALIBRATION_THRESHOLD,
      needsRecalibration,
      recalibrationsTotal: this._recalibrationsCount,
      recent:              window.slice(-fib(5))  // last 5 records
    };
  }

  _recalibrate() {
    // Shrink overconfident predictions — apply PSI dampening
    for (const [id, pred] of this._predictions.entries()) {
      if (!pred.resolved && pred.predictedConfidence > CONFIDENCE_HIGH) {
        pred.predictedConfidence *= PSI; // dampen by φ⁻¹
      }
    }
    this.emit('calibration:recalibrated', {
      attempt: this._recalibrationsCount,
      score:   this._calibrationScore
    });
  }

  // ─── Blind Spot Detection ────────────────────────────────────────────────────
  _detectBlindSpots(context) {
    const counterfactuals = [];

    for (const method of BIAS_METHODS) {
      const cf = this._generateCounterfactual(method, context);
      counterfactuals.push(cf);
    }

    // Guarantee minimum of MIN_COUNTERFACTUALS=3 always produced
    while (counterfactuals.length < MIN_COUNTERFACTUALS) {
      counterfactuals.push(
        this._generateCounterfactual(BIAS_METHODS[counterfactuals.length % BIAS_METHODS.length], context)
      );
    }

    const detected = counterfactuals.filter(cf => cf.anomalyScore > CALIBRATION_THRESHOLD);
    const severity = detected.length > 0
      ? detected.reduce((s, cf) => s + cf.anomalyScore, 0) / detected.length
      : 0;

    // Log to history
    const record = {
      id:              `cf-${Date.now()}`,
      timestamp:       new Date().toISOString(),
      counterfactuals,
      detected:        detected.length,
      severity
    };
    this._counterfactualLog.push(record);
    slidingWindow(this._counterfactualLog, fib(9)); // keep last 34

    return {
      counterfactualsGenerated: counterfactuals.length,
      minimum:                  MIN_COUNTERFACTUALS,
      detected:                 detected.length,
      severity,
      methods:                  BIAS_METHODS,
      details:                  counterfactuals
    };
  }

  _generateCounterfactual(method, context) {
    this._biasDetectionCounts[method]++;

    let hypothetical, changeVector, anomalyScore;

    switch (method) {
      case 'confirmation_bias': {
        // What if the opposite of current assumption were true?
        hypothetical   = 'Assume current dominant signal is noise — what remains?';
        changeVector   = Array.from({ length: this._gapVectorDim }, () => (Math.random() - PSI) * 2);
        anomalyScore   = Math.abs(changeVector.reduce((s, v) => s + v, 0) / changeVector.length);
        break;
      }
      case 'anchoring_bias': {
        // What if the first data point seen was different?
        hypothetical   = 'If initial anchor value shifted by φ², how does conclusion change?';
        const shift    = PHI_SQ;
        changeVector   = Array.from({ length: this._gapVectorDim }, (_, i) => Math.sin(i * shift * PSI));
        anomalyScore   = changeVector.reduce((s, v) => s + Math.abs(v), 0) / changeVector.length;
        break;
      }
      case 'availability_bias': {
        // What if recent events were excluded?
        hypothetical   = 'Excluding last fib(5)=5 data points — does pattern hold?';
        changeVector   = Array.from({ length: this._gapVectorDim }, (_, i) => Math.cos(i * PHI * PSI));
        anomalyScore   = 1 - Math.abs(changeVector[0]);
        break;
      }
      case 'survivorship_bias': {
        // What about the failures that were silently discarded?
        hypothetical   = 'What if failed cases were included in distribution?';
        changeVector   = Array.from({ length: this._gapVectorDim }, (_, i) => (i % 2 === 0 ? PSI : -PSI) * Math.random());
        anomalyScore   = changeVector.reduce((s, v) => s + Math.abs(v), 0) / changeVector.length;
        break;
      }
      default: {
        hypothetical = `Unknown bias method: ${method}`;
        changeVector = new Array(this._gapVectorDim).fill(0);
        anomalyScore = 0;
      }
    }

    return {
      method,
      hypothetical,
      changeVector: changeVector.map(v => +v.toFixed(6)),
      anomalyScore: +anomalyScore.toFixed(6),
      flagged:      anomalyScore > CALIBRATION_THRESHOLD
    };
  }

  // ─── Cognitive Load Assessment ───────────────────────────────────────────────
  _assessCognitiveLoad(context) {
    // Update from context if provided
    if (context.activeTasks    !== undefined) this._activeTasks        = context.activeTasks;
    if (context.queueDepth     !== undefined) this._queueDepth         = context.queueDepth;
    if (context.contextWindow  !== undefined) this._contextWindowUsage = context.contextWindow;

    // Normalize each dimension to 0–1
    const activeRatio  = Math.min(this._activeTasks   / this._maxActiveTasks, 1);
    const queueRatio   = Math.min(this._queueDepth    / this._maxQueueDepth,  1);
    const contextRatio = Math.min(this._contextWindowUsage, 1);

    // Phi-weighted composite load
    const [w0, w1, w2] = LOAD_WEIGHTS; // [0.528, 0.326, 0.146]
    const compositeLoad = w0 * activeRatio + w1 * queueRatio + w2 * contextRatio;

    const level = pressureLevel(compositeLoad);

    return {
      activeTasks:     this._activeTasks,
      queueDepth:      this._queueDepth,
      contextUsage:    +this._contextWindowUsage.toFixed(6),
      activeRatio:     +activeRatio.toFixed(6),
      queueRatio:      +queueRatio.toFixed(6),
      contextRatio:    +contextRatio.toFixed(6),
      compositeLoad:   +compositeLoad.toFixed(6),
      level,
      weights:         { active: +w0.toFixed(6), queue: +w1.toFixed(6), context: +w2.toFixed(6) },
      thresholds: {
        nominal:  +(PSI * PSI).toFixed(6),                // ψ² ≈ 0.381966
        elevated: +PSI.toFixed(6),                        // ψ  ≈ 0.618034
        high:     +(1 - PSI * PSI * PSI).toFixed(6),     // 1-ψ³ ≈ 0.854102
        critical: +(1 - PSI * PSI * PSI * PSI).toFixed(6) // 1-ψ⁴ ≈ 0.909830
      }
    };
  }

  // ─── Knowledge Boundary Detection ────────────────────────────────────────────
  _assessKnowledgeBoundaries(context) {
    // If context carries a low-confidence query, register it
    if (context.queryConfidence !== undefined && context.queryTopic) {
      this._recordLowConfidenceQuery(context.queryTopic, context.queryConfidence, context.queryVector);
    }

    const gaps     = [];
    const gapCount = this._knowledgeGaps.size;

    for (const [topic, gapData] of this._knowledgeGaps.entries()) {
      if (gapData.avgConfidence < GAP_SEVERITY_THRESHOLD) {
        gaps.push({
          topic,
          queryCount:     gapData.count,
          avgConfidence:  +gapData.avgConfidence.toFixed(6),
          severity:       +(GAP_SEVERITY_THRESHOLD - gapData.avgConfidence).toFixed(6)
        });
      }
    }
    gaps.sort((a, b) => b.severity - a.severity);

    // Recent low-confidence log (last fib(5)=5 entries)
    const recentLowConf = this._lowConfidenceLog.slice(-fib(5));

    return {
      totalGapsTracked: gapCount,
      criticalGaps:     gaps.length,
      gaps:             gaps.slice(0, fib(5)),  // top 5
      gapSeverityThreshold: +GAP_SEVERITY_THRESHOLD.toFixed(6),
      recentLowConfidenceQueries: recentLowConf
    };
  }

  _recordLowConfidenceQuery(topic, confidence, vector = null) {
    if (!this._knowledgeGaps.has(topic)) {
      this._knowledgeGaps.set(topic, { count: 0, avgConfidence: confidence, vectors: [] });
    }
    const gap = this._knowledgeGaps.get(topic);
    gap.count++;
    gap.avgConfidence = (gap.avgConfidence * (gap.count - 1) + confidence) / gap.count;
    if (vector && gap.vectors.length < fib(7)) gap.vectors.push(vector);

    this._lowConfidenceLog.push({
      timestamp:  new Date().toISOString(),
      topic,
      confidence: +confidence.toFixed(6)
    });
    slidingWindow(this._lowConfidenceLog, fib(9)); // keep last 34
  }

  // ─── Prediction Tracking ─────────────────────────────────────────────────────
  recordPrediction(predictionId, predictedConfidence, context = {}) {
    this._predictions.set(predictionId, {
      id:                 predictionId,
      predictedConfidence: Math.max(0, Math.min(1, predictedConfidence)),
      context,
      createdAt:          Date.now(),
      resolved:           false,
      actualOutcome:      null
    });
    this.emit('prediction:recorded', { predictionId, predictedConfidence });
    return predictionId;
  }

  resolveOutcome(predictionId, actualOutcome) {
    const pred = this._predictions.get(predictionId);
    if (!pred) return false;

    pred.resolved     = true;
    pred.actualOutcome = Math.max(0, Math.min(1, actualOutcome));
    pred.resolvedAt   = Date.now();

    // Rolling accuracy update
    const accurate = Math.abs(pred.predictedConfidence - pred.actualOutcome) < PSI * PSI;
    this._predictionHistory.push({ predictionId, accurate });
    slidingWindow(this._predictionHistory, LOOKBACK_WINDOW);

    const accurateCount = this._predictionHistory.filter(p => p.accurate).length;
    this._predictionAccuracy = this._predictionHistory.length > 0
      ? accurateCount / this._predictionHistory.length
      : 1.0;

    this.emit('prediction:resolved', { predictionId, accurate, accuracy: this._predictionAccuracy });
    return accurate;
  }

  _drainResolvedPredictions() {
    const resolved = [];
    for (const [id, pred] of this._predictions.entries()) {
      if (pred.resolved) {
        resolved.push(pred);
        this._predictions.delete(id);
      }
    }
    return resolved;
  }

  // ─── Overall Confidence Synthesis ────────────────────────────────────────────
  _computeOverallConfidence({ calibration, blindSpots, cognitiveLoad, knowledgeBoundaries }) {
    // Phi-fusion weights for 4 dimensions
    const weights = phiFusionWeights(4); // [~0.463, ~0.286, ~0.177, ~0.110]

    // Calibration contribution: direct score
    const calibContrib = calibration.score;

    // Blind spots: inverse severity
    const blindContrib = Math.max(0, 1 - blindSpots.severity);

    // Cognitive load: inverse composite load
    const loadContrib  = Math.max(0, 1 - cognitiveLoad.compositeLoad);

    // Knowledge boundaries: based on gap ratio
    const totalQueries = this._lowConfidenceLog.length;
    const gapRatio     = totalQueries > 0
      ? Math.min(knowledgeBoundaries.criticalGaps / Math.max(1, totalQueries), 1)
      : 0;
    const knowContrib  = Math.max(0, 1 - gapRatio);

    const overall = weights[0] * calibContrib
                  + weights[1] * blindContrib
                  + weights[2] * loadContrib
                  + weights[3] * knowContrib;

    return +Math.max(CONFIDENCE_FLOOR, Math.min(1.0, overall)).toFixed(6);
  }

  // ─── Public Report API ────────────────────────────────────────────────────────
  async getReport(context = {}) {
    const assessment = await this.assess(context);

    const insights = this._synthesizeInsights(assessment);

    const report = {
      reportId:       `report-${Date.now()}`,
      generatedAt:    new Date().toISOString(),
      assessment,
      insights,
      overallScore:   assessment.overallConfidence,
      meetsThreshold: assessment.meetsThreshold,
      predictionStats: {
        windowSize:      this._predictionHistory.length,
        lookbackTarget:  LOOKBACK_WINDOW,
        accuracy:        +this._predictionAccuracy.toFixed(6),
        pending:         this._predictions.size
      },
      systemState: {
        activeTasks:        this._activeTasks,
        queueDepth:         this._queueDepth,
        contextUsage:       +this._contextWindowUsage.toFixed(6),
        recalibrations:     this._recalibrationsCount,
        assessmentsRun:     this._assessmentCount,
        uptimeMs:           Date.now() - this._startedAt,
        calibrationWindow:  this._calibrationWindow.length
      }
    };

    this._lastReport = report;
    this.emit('report:generated', report);
    return report;
  }

  _synthesizeInsights(assessment) {
    const insights = [];

    if (!assessment.calibration.needsRecalibration) {
      insights.push({
        type:     'positive',
        category: 'calibration',
        message:  `Calibration score ${assessment.calibration.score.toFixed(3)} exceeds φ⁻¹=${CALIBRATION_THRESHOLD.toFixed(3)} threshold.`
      });
    } else {
      insights.push({
        type:     'warning',
        category: 'calibration',
        message:  `Calibration score ${assessment.calibration.score.toFixed(3)} is below φ⁻¹=${CALIBRATION_THRESHOLD.toFixed(3)}. Recalibration triggered (#${assessment.calibration.recalibrationsTotal}).`,
        action:   'reduce_confidence_estimates'
      });
    }

    if (assessment.blindSpots.detected > 0) {
      insights.push({
        type:     'warning',
        category: 'blind_spots',
        message:  `${assessment.blindSpots.detected} bias vector(s) detected with severity ${assessment.blindSpots.severity.toFixed(3)}.`,
        methods:  assessment.blindSpots.details.filter(cf => cf.flagged).map(cf => cf.method),
        action:   'review_assumptions'
      });
    }

    const loadLevel = assessment.cognitiveLoad.level;
    if (loadLevel === 'HIGH' || loadLevel === 'CRITICAL') {
      insights.push({
        type:     'alert',
        category: 'cognitive_load',
        message:  `Cognitive load at ${loadLevel} (composite=${assessment.cognitiveLoad.compositeLoad.toFixed(3)}). Consider shedding non-critical tasks.`,
        action:   'shed_sheddable_tasks'
      });
    }

    if (assessment.knowledgeBoundaries.criticalGaps > 0) {
      insights.push({
        type:     'info',
        category: 'knowledge_gaps',
        message:  `${assessment.knowledgeBoundaries.criticalGaps} knowledge gap(s) detected below confidence threshold ${GAP_SEVERITY_THRESHOLD.toFixed(3)}.`,
        gaps:     assessment.knowledgeBoundaries.gaps.map(g => g.topic),
        action:   'escalate_to_research_domain'
      });
    }

    if (!assessment.meetsThreshold) {
      insights.push({
        type:     'critical',
        category: 'overall',
        message:  `Overall self-awareness score ${assessment.overallConfidence} is below minimum threshold ${CALIBRATION_THRESHOLD.toFixed(3)}. Escalating to HeadySoul.`,
        action:   'escalate_to_heady_soul'
      });
    }

    return insights;
  }

  // ─── Confidence Accessor ─────────────────────────────────────────────────────
  getConfidence() {
    // Quick confidence estimate without full assessment
    const calibScore  = this._calibrationScore;
    const predAcc     = this._predictionAccuracy;
    const weights     = phiFusionWeights(2); // [~0.618, ~0.382]
    const confidence  = weights[0] * calibScore + weights[1] * predAcc;
    return {
      confidence:      +Math.max(CONFIDENCE_FLOOR, Math.min(1.0, confidence)).toFixed(6),
      meetsThreshold:  confidence >= CALIBRATION_THRESHOLD,
      threshold:       CALIBRATION_THRESHOLD,
      calibScore:      +calibScore.toFixed(6),
      predictionAccuracy: +predAcc.toFixed(6)
    };
  }

  // ─── Cognitive Load Setters ───────────────────────────────────────────────────
  setActiveTasks(n) {
    this._activeTasks = Math.max(0, n);
    this.emit('load:updated', { activeTasks: this._activeTasks });
  }

  setQueueDepth(n) {
    this._queueDepth = Math.max(0, n);
    this.emit('load:updated', { queueDepth: this._queueDepth });
  }

  setContextWindowUsage(fraction) {
    this._contextWindowUsage = Math.max(0, Math.min(1, fraction));
    this.emit('load:updated', { contextWindowUsage: this._contextWindowUsage });
  }

  // ─── Escalation ───────────────────────────────────────────────────────────────
  _escalate(assessment) {
    const escalation = {
      type:      'self_awareness_below_threshold',
      score:     assessment.overallConfidence,
      threshold: CALIBRATION_THRESHOLD,
      timestamp: new Date().toISOString(),
      assessment
    };
    this.emit('escalation:heady_soul', escalation);
    if (typeof this._onEscalate === 'function') {
      try { this._onEscalate(escalation); } catch (_) { /* absorb */ }
    }
  }

  // ─── Periodic self-assessment ─────────────────────────────────────────────────
  async _periodicAssessment() {
    try {
      await this.assess({});
    } catch (err) {
      this.emit('assessment:error', { error: err.message });
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  shutdown() {
    clearInterval(this._assessInterval);
    this.emit('selfawareness:shutdown', { assessmentsRun: this._assessmentCount });
  }
}

module.exports = HeadySelfAwareness;
module.exports.LOOKBACK_WINDOW        = LOOKBACK_WINDOW;
module.exports.CALIBRATION_THRESHOLD  = CALIBRATION_THRESHOLD;
module.exports.MIN_COUNTERFACTUALS    = MIN_COUNTERFACTUALS;
module.exports.BIAS_METHODS           = BIAS_METHODS;
module.exports.CONFIDENCE_FLOOR       = CONFIDENCE_FLOOR;
module.exports.CONFIDENCE_NOMINAL     = CONFIDENCE_NOMINAL;
