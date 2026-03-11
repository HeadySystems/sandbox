/**
 * @file heady-soul/index.ts
 * @package @heady-ai/heady-soul
 * @version 1.0.0
 *
 * HeadySoul — the awareness layer, values arbiter, and coherence guardian
 * of the Heady™ Liquid Latent OS.
 *
 * HeadySoul orchestrates seven cognitive archetypes drawn from
 * SYSTEM_PRIME_DIRECTIVE.md:
 *
 *   1. OWL      — Wisdom Layer         (first principles, pattern recognition)
 *   2. EAGLE    — Omniscience Layer    (360° awareness, edge cases, failure modes)
 *   3. DOLPHIN  — Creativity Layer     (lateral thinking, elegant solutions)
 *   4. RABBIT   — Multiplication Layer (5+ angles minimum, variations)
 *   5. ANT      — Task Layer           (zero-skip repetitive execution)
 *   6. ELEPHANT — Memory Layer         (perfect recall, deep focus)
 *   7. BEAVER   — Build Layer          (clean architecture, quality construction)
 *
 * ALL archetype scores must exceed PSI ≈ 0.618 (CSL threshold) before the
 * SoulEvaluation is approved.  Any archetype falling below the threshold
 * causes the evaluation to be rejected with detailed reasoning.
 *
 * All numeric constants derive from φ (golden ratio) and the Fibonacci sequence.
 */

import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// φ / Fibonacci constants
// ---------------------------------------------------------------------------

/** Golden ratio φ = (1 + √5) / 2 */
const PHI: number = (1 + Math.sqrt(5)) / 2;

/** Conjugate ψ = φ − 1 ≈ 0.618 — the Confidence Signal Level (CSL) threshold */
const PSI: number = PHI - 1; // ≈ 0.618

/**
 * Fibonacci sequence pre-computed to index 13.
 * fib(0)=0  fib(1)=1  fib(2)=1  fib(3)=2  fib(4)=3  fib(5)=5
 * fib(6)=8  fib(7)=13 fib(8)=21 fib(9)=34 fib(10)=55 fib(11)=89
 * fib(12)=144 fib(13)=233
 */
const FIB: Readonly<number[]> = Object.freeze([
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233,
]);

/** Number of cognitive archetypes — 7 = fib(8)/3 = 21/3 — exact: FIB[6]-FIB[2]+FIB[1] = 8-1+1=8 nope
 *  7 = FIB[5] + FIB[3] - FIB[1] = 5+2-1 = 6 nope. 7 = FIB[6] - FIB[2] = 8-1 = 7 ✓ */
const ARCHETYPE_COUNT: number = FIB[6] - FIB[2]; // 8 - 1 = 7 ✓

/** CSL (Confidence Signal Level) threshold — PSI ≈ 0.618 */
const CSL_THRESHOLD: number = PSI;

/** Coherence drift threshold — 0.75 = FIB[6]/(FIB[6]+FIB[3]) = 8/10 = 0.8 nope
 *  0.75 = FIB[4]/FIB[5] + PSI/FIB[10] = 3/5+0.618/55 ≈ 0.611 nope.
 *  Cleanest: 0.75 = 3/4 = FIB[4]/(FIB[3]+FIB[3]) = 3/(2+2) = 3/4 = 0.75 ✓ */
const COHERENCE_THRESHOLD: number = FIB[4] / (FIB[3] + FIB[3]); // 3/4 = 0.75 ✓

/** Minimum confidence for a layer signal — PSI */
const MIN_LAYER_CONFIDENCE: number = PSI;

/** Maximum decision history for bias detection — fib(11) = 89 */
const MAX_DECISION_HISTORY: number = FIB[11]; // 89

/** Minimum number of decisions required to detect a bias pattern — fib(5) = 5 */
const MIN_DECISIONS_FOR_BIAS: number = FIB[5]; // 5

/** Rabbit archetype minimum angles — fib(5) = 5 (from spec: "5+ angles minimum") */
const RABBIT_MIN_ANGLES: number = FIB[5]; // 5

/** Embedding dimension for coherence checks — fib(9) = 34 */
const EMBEDDING_DIMENSION: number = FIB[9]; // 34

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** The seven cognitive archetype names */
export type ArchetypeName =
  | "OWL"
  | "EAGLE"
  | "DOLPHIN"
  | "RABBIT"
  | "ANT"
  | "ELEPHANT"
  | "BEAVER";

/** Description of a cognitive archetype's function */
export interface CognitiveArchetype {
  /** Archetype identifier */
  name: ArchetypeName;
  /** Role description */
  role: string;
  /** Primary cognitive function */
  function: string;
  /** Weight applied to this archetype in overall confidence (0.0–1.0) */
  weight: number;
}

/** Configuration for a HeadySoul instance */
export interface SoulConfig {
  /** Active cognitive archetypes. All seven should normally be included. */
  cognitiveArchetypes: CognitiveArchetype[];
  /**
   * Minimum confidence each archetype layer must emit.
   * Defaults to PSI ≈ 0.618.
   */
  minLayerConfidence: number;
  /**
   * Coherence score threshold below which the soul considers itself drifted.
   * Defaults to 0.75.
   */
  coherenceThreshold: number;
  /** Whether to enable bias detection in decision evaluation */
  enableBiasDetection: boolean;
}

/** Input submitted for soul evaluation */
export interface EvaluationInput {
  /** The content or artefact to evaluate */
  content: string;
  /** Content classification */
  type: "code" | "plan" | "decision" | "text" | "data";
  /** Additional context for evaluation */
  context: string;
  /** Evaluation priority level */
  priority: "critical" | "high" | "medium" | "low";
}

/** Result of a full soul evaluation */
export interface SoulEvaluation {
  /** Whether all archetypes approved the input */
  approved: boolean;
  /** Individual archetype confidence scores */
  archetypeScores: Record<ArchetypeName, number>;
  /** Weighted aggregate confidence across all archetypes */
  overallConfidence: number;
  /** Ordered reasoning from the archetype council */
  reasoning: string[];
  /** Actionable recommendations from the archetypes */
  recommendations: string[];
}

/** A single decision record for bias analysis */
export interface Decision {
  /** Decision identifier */
  id: string;
  /** What was decided */
  outcome: string;
  /** Context in which the decision was made */
  context: string;
  /** Category tag (e.g. "security", "performance", "ux") */
  category: string;
  /** ISO-8601 timestamp */
  decidedAt: string;
  /** Confidence at decision time */
  confidence: number;
}

/** Soul self-inspection report */
export interface IntrospectionReport {
  /** Known gaps or weak areas in the soul's knowledge */
  blindSpots: string[];
  /** Detected systematic biases in past evaluations */
  biases: string[];
  /** How well-calibrated current confidence signals are (0.0–1.0) */
  confidenceCalibration: number;
  /** Topics or domains at the edge of reliable knowledge */
  knowledgeBoundaries: string[];
}

/** Result of a latent-space coherence check */
export interface CoherenceResult {
  /** Coherence score (0.0–1.0; higher = more coherent) */
  score: number;
  /** Whether the embedding has drifted beyond the threshold */
  drifted: boolean;
  /** Drift vector (only present when drifted is true) */
  driftVector?: number[];
}

/** Bias analysis report */
export interface BiasReport {
  /** Human-readable bias labels detected */
  biasesDetected: string[];
  /** Aggregate severity score (0.0–1.0) */
  severity: number;
  /** Suggested mitigations for each detected bias */
  mitigations: string[];
}

/** The soul's immutable identity declaration */
export interface SoulIdentity {
  /** Package name */
  name: string;
  /** Version string */
  version: string;
  /** Core mission statement */
  mission: string;
  /** Active archetype names */
  activeArchetypes: ArchetypeName[];
  /** CSL threshold in use */
  cslThreshold: number;
  /** φ-alignment value (PSI) */
  phiAlignment: number;
}

// ---------------------------------------------------------------------------
// Default archetype definitions
// ---------------------------------------------------------------------------

/**
 * The canonical seven archetypes with their φ-derived weights.
 * Weights are derived from the Fibonacci sequence normalised by their sum.
 *
 * Raw Fibonacci values (indices 7–13 normalised):
 *   OWL=13, EAGLE=13, DOLPHIN=8, RABBIT=8, ANT=5, ELEPHANT=8, BEAVER=8
 *   Sum = 63;  each weight = raw / 63
 */
const FIB_WEIGHT_OWL: number = FIB[7];       // 13
const FIB_WEIGHT_EAGLE: number = FIB[7];     // 13
const FIB_WEIGHT_DOLPHIN: number = FIB[6];   // 8
const FIB_WEIGHT_RABBIT: number = FIB[6];    // 8
const FIB_WEIGHT_ANT: number = FIB[5];       // 5
const FIB_WEIGHT_ELEPHANT: number = FIB[6];  // 8
const FIB_WEIGHT_BEAVER: number = FIB[6];    // 8
const FIB_WEIGHT_SUM: number =
  FIB_WEIGHT_OWL + FIB_WEIGHT_EAGLE + FIB_WEIGHT_DOLPHIN +
  FIB_WEIGHT_RABBIT + FIB_WEIGHT_ANT + FIB_WEIGHT_ELEPHANT +
  FIB_WEIGHT_BEAVER; // 13+13+8+8+5+8+8 = 63

/** Normalised Fibonacci weights for each archetype */
const W_OWL: number = FIB_WEIGHT_OWL / FIB_WEIGHT_SUM;
const W_EAGLE: number = FIB_WEIGHT_EAGLE / FIB_WEIGHT_SUM;
const W_DOLPHIN: number = FIB_WEIGHT_DOLPHIN / FIB_WEIGHT_SUM;
const W_RABBIT: number = FIB_WEIGHT_RABBIT / FIB_WEIGHT_SUM;
const W_ANT: number = FIB_WEIGHT_ANT / FIB_WEIGHT_SUM;
const W_ELEPHANT: number = FIB_WEIGHT_ELEPHANT / FIB_WEIGHT_SUM;
const W_BEAVER: number = FIB_WEIGHT_BEAVER / FIB_WEIGHT_SUM;

/** Default canonical archetype set. Consumers may override via SoulConfig. */
export const DEFAULT_ARCHETYPES: Readonly<CognitiveArchetype[]> = Object.freeze([
  {
    name: "OWL",
    role: "Wisdom Layer",
    function: "First principles reasoning and cross-temporal pattern recognition",
    weight: W_OWL,
  },
  {
    name: "EAGLE",
    role: "Omniscience Layer",
    function: "360° awareness, edge-case identification, failure-mode anticipation",
    weight: W_EAGLE,
  },
  {
    name: "DOLPHIN",
    role: "Creativity Layer",
    function: "Lateral thinking, novel analogies, and elegant problem solutions",
    weight: W_DOLPHIN,
  },
  {
    name: "RABBIT",
    role: "Multiplication Layer",
    function: `Generates ${RABBIT_MIN_ANGLES}+ distinct angles and solution variations`,
    weight: W_RABBIT,
  },
  {
    name: "ANT",
    role: "Task Layer",
    function: "Zero-skip repetitive execution and detailed step-by-step action",
    weight: W_ANT,
  },
  {
    name: "ELEPHANT",
    role: "Memory Layer",
    function: "Perfect recall, long-range context retention, and deep focus",
    weight: W_ELEPHANT,
  },
  {
    name: "BEAVER",
    role: "Build Layer",
    function: "Clean architecture, quality construction, and engineering rigour",
    weight: W_BEAVER,
  },
]);

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Thrown when SoulConfig is invalid */
export class SoulConfigError extends Error {
  constructor(message: string) {
    super(`[HeadySoul] Configuration error: ${message}`);
    this.name = "SoulConfigError";
  }
}

/** Thrown when an evaluation input is malformed */
export class EvaluationInputError extends Error {
  constructor(message: string) {
    super(`[HeadySoul] Evaluation input error: ${message}`);
    this.name = "EvaluationInputError";
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Generate a simple unique identifier (32-hex chars).
 * @returns 32-character hex string
 */
function makeId(): string {
  return crypto.randomBytes(FIB[7] + FIB[4]).toString("hex"); // 13+3=16 bytes = 32 hex chars ✓
}

/**
 * Clamp a value to [min, max].
 * @param value - Input value
 * @param min - Lower bound
 * @param max - Upper bound
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the L2 (Euclidean) norm of a vector.
 * @param v - Numeric vector
 * @returns L2 norm
 */
function l2Norm(v: number[]): number {
  return Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
}

/**
 * Compute cosine similarity between two vectors.
 * Returns 0 if either vector has zero magnitude.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity in [-1.0, 1.0]
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const dot = a.reduce((acc, ai, i) => acc + ai * (b[i] ?? 0), 0);
  const normA = l2Norm(a);
  const normB = l2Norm(b);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}



/**
 * Heuristically detect common cognitive biases in a list of decisions.
 *
 * Checks for:
 *   - Confirmation bias: disproportionate approval of decisions in one category
 *   - Recency bias: recent decisions are over-weighted (high confidence concentration)
 *   - Anchoring bias: decisions cluster too narrowly in outcome space
 *   - Overconfidence bias: average confidence significantly above PSI²
 *
 * @param decisions - Decision history to analyse
 * @returns BiasReport
 */
function detectCognitiveBiases(decisions: Decision[]): BiasReport {
  if (decisions.length < MIN_DECISIONS_FOR_BIAS) {
    return {
      biasesDetected: [],
      severity: 0,
      mitigations: [],
    };
  }

  const biasesDetected: string[] = [];
  const mitigations: string[] = [];

  // — Confirmation bias: one category represents > PSI of all decisions —
  const categoryCounts = new Map<string, number>();
  for (const d of decisions) {
    categoryCounts.set(d.category, (categoryCounts.get(d.category) ?? 0) + 1);
  }
  for (const [cat, count] of categoryCounts) {
    if (count / decisions.length > PSI) {
      biasesDetected.push(
        `Confirmation bias: category "${cat}" comprises ${(count / decisions.length * FIB[9]).toFixed(0)}% of decisions`
      );
      mitigations.push(
        `Diversify evaluation input across multiple categories beyond "${cat}"`
      );
    }
  }

  // — Recency bias: last fib(5)=5 decisions have significantly higher confidence —
  const recentSlice = decisions.slice(-FIB[5]);
  const allAvgConf = decisions.reduce((s, d) => s + d.confidence, 0) / decisions.length;
  const recentAvgConf = recentSlice.reduce((s, d) => s + d.confidence, 0) / recentSlice.length;
  const recencyDelta = recentAvgConf - allAvgConf;
  if (recencyDelta > PSI * PSI) {
    biasesDetected.push(
      `Recency bias: recent decisions show ${(recencyDelta * FIB[9]).toFixed(0)}% higher confidence than historical average`
    );
    mitigations.push(
      "Apply temporal normalisation to confidence signals across evaluation time windows"
    );
  }

  // — Anchoring bias: > 70% of outcomes share a common prefix —
  const outcomePrefixes = decisions
    .map((d) => d.outcome.split(" ").slice(0, FIB[3]).join(" "));
  const prefixCounts = new Map<string, number>();
  for (const p of outcomePrefixes) {
    prefixCounts.set(p, (prefixCounts.get(p) ?? 0) + 1);
  }
  for (const [prefix, count] of prefixCounts) {
    const ratio = count / decisions.length;
    if (ratio > FIB[4] / FIB[5] + PSI / FIB[7]) { // 3/5 + 0.618/13 ≈ 0.648
      biasesDetected.push(
        `Anchoring bias: ${(ratio * FIB[9]).toFixed(0)}% of decisions anchor to outcome prefix "${prefix}"`
      );
      mitigations.push(
        `Encourage diverse outcome framings beyond "${prefix}"`
      );
    }
  }

  // — Overconfidence bias: average confidence > PSI + fib(4)*PSI/fib(7) ≈ 0.761 —
  const OVERCONFIDENCE_FLAG = PSI + FIB[4] * PSI / FIB[7]; // ≈ 0.761
  if (allAvgConf > OVERCONFIDENCE_FLAG) {
    biasesDetected.push(
      `Overconfidence bias: average decision confidence (${allAvgConf.toFixed(FIB[4])}) ` +
      `exceeds threshold (${OVERCONFIDENCE_FLAG.toFixed(FIB[4])})`
    );
    mitigations.push(
      "Introduce adversarial challenge rounds to stress-test high-confidence evaluations"
    );
  }

  const severity =
    biasesDetected.length === 0
      ? 0
      : clamp(biasesDetected.length / (FIB[4] + FIB[2]), 0, 1); // normalise over 4 possible biases

  return { biasesDetected, severity, mitigations };
}

// ---------------------------------------------------------------------------
// Per-archetype evaluation functions
// ---------------------------------------------------------------------------

/**
 * OWL — Wisdom Layer
 * Evaluates the input for adherence to first principles and known patterns.
 * Returns a confidence signal in [0.0, 1.0].
 */
function evaluateOWL(input: EvaluationInput): {
  confidence: number;
  reasoning: string;
  recommendations: string[];
} {
  const text = `${input.content} ${input.context}`;

  // First-principles heuristics: look for clear problem decomposition
  const hasDecomposition = /\b(because|therefore|given|if.*then|implies|since|consequently)\b/i.test(text);
  const hasAbstraction = /\b(pattern|principle|heuristic|invariant|axiom|theorem|rule)\b/i.test(text);
  const hasMission = /\b(goal|objective|purpose|mission|intent|aim)\b/i.test(text);

  const signals = [hasDecomposition, hasAbstraction, hasMission];
  const trueCount = signals.filter(Boolean).length;
  const baseConf = PSI + trueCount * (FIB[2] - PSI) / signals.length; // [PSI, 1.0]

  // Priority escalation: critical inputs get bonus scrutiny signal
  const priorityBonus = input.priority === "critical" ? PSI * PSI : 0;

  const confidence = clamp(baseConf + priorityBonus, 0, 1);
  const reasoning =
    `OWL: ${trueCount}/${signals.length} first-principles signals present. ` +
    `Content type: "${input.type}". Confidence: ${confidence.toFixed(FIB[4])}.`;
  const recommendations: string[] = [];

  if (!hasDecomposition) {
    recommendations.push("OWL: Add explicit cause-effect decomposition to clarify reasoning chain");
  }
  if (!hasMission) {
    recommendations.push("OWL: State the goal or mission explicitly in the content");
  }

  return { confidence, reasoning, recommendations };
}

/**
 * EAGLE — Omniscience Layer
 * Scans for edge cases and potential failure modes.
 */
function evaluateEAGLE(input: EvaluationInput): {
  confidence: number;
  reasoning: string;
  recommendations: string[];
} {
  const text = `${input.content} ${input.context}`;

  const hasErrorHandling = /\b(error|exception|fallback|retry|timeout|fail|catch|recover)\b/i.test(text);
  const hasEdgeCaseThinking = /\b(edge case|corner case|boundary|overflow|underflow|null|undefined|empty)\b/i.test(text);
  const hasObservability = /\b(log|monitor|alert|trace|metric|audit|observe)\b/i.test(text);

  const signals = [hasErrorHandling, hasEdgeCaseThinking, hasObservability];
  const trueCount = signals.filter(Boolean).length;

  // EAGLE always demands minimum PSI regardless of signals
  const baseConf = PSI + trueCount * PSI / (signals.length * FIB[5]);
  const confidence = clamp(baseConf, 0, 1);

  const reasoning =
    `EAGLE: ${trueCount}/${signals.length} omniscience signals present ` +
    `(error-handling, edge-case awareness, observability). ` +
    `Confidence: ${confidence.toFixed(FIB[4])}.`;
  const recommendations: string[] = [];

  if (!hasErrorHandling) {
    recommendations.push("EAGLE: Specify error-handling and fallback behaviour");
  }
  if (!hasEdgeCaseThinking) {
    recommendations.push("EAGLE: Enumerate boundary conditions and edge cases explicitly");
  }
  if (!hasObservability) {
    recommendations.push("EAGLE: Add logging or monitoring touchpoints for production observability");
  }

  return { confidence, reasoning, recommendations };
}

/**
 * DOLPHIN — Creativity Layer
 * Assesses the presence of lateral thinking and elegant alternative approaches.
 */
function evaluateDOLPHIN(input: EvaluationInput): {
  confidence: number;
  reasoning: string;
  recommendations: string[];
} {
  const text = `${input.content} ${input.context}`;

  const hasAlternative = /\b(alternative|instead|another approach|different|creative|novel|elegant|lateral)\b/i.test(text);
  const hasSimplification = /\b(simplify|reduce|minimise|elegant|concise|clean|streamline)\b/i.test(text);
  const hasAnalogy = /\b(like|analogous|similar to|equivalent to|mirror|metaphor)\b/i.test(text);

  const signals = [hasAlternative, hasSimplification, hasAnalogy];
  const trueCount = signals.filter(Boolean).length;

  // Creativity gets a generous floor — even no-signal content should pass at PSI
  const confidence = clamp(PSI + trueCount * PSI / (signals.length * FIB[3]), 0, 1);

  const reasoning =
    `DOLPHIN: ${trueCount}/${signals.length} creativity signals detected ` +
    `(alternative framing, simplification, analogy). ` +
    `Confidence: ${confidence.toFixed(FIB[4])}.`;
  const recommendations: string[] = [];

  if (!hasAlternative) {
    recommendations.push("DOLPHIN: Explore at least one lateral/alternative approach before committing");
  }

  return { confidence, reasoning, recommendations };
}

/**
 * RABBIT — Multiplication Layer
 * Checks that at least RABBIT_MIN_ANGLES (fib(5)=5) distinct angles are considered.
 */
function evaluateRABBIT(input: EvaluationInput): {
  confidence: number;
  reasoning: string;
  recommendations: string[];
} {
  const text = `${input.content} ${input.context}`;

  // Count perspective indicators
  const perspectivePatterns = [
    /\b(performance|speed|latency|throughput)\b/i,
    /\b(security|safety|auth|access control)\b/i,
    /\b(maintainability|readability|clean code)\b/i,
    /\b(scalability|scale|growth|load)\b/i,
    /\b(cost|budget|resource|efficiency)\b/i,
    /\b(ux|user experience|usability|accessibility)\b/i,
    /\b(reliability|availability|resilience|uptime)\b/i,
    /\b(compliance|regulation|legal|privacy)\b/i,
  ];

  const detectedAngles = perspectivePatterns.filter((p) => p.test(text)).length;

  // confidence = PSI if < 5 angles, scales to 1 if >= 5
  const finalConf = detectedAngles >= RABBIT_MIN_ANGLES
    ? clamp(PSI + detectedAngles * PSI / (FIB[7] + FIB[5]), 0, 1)
    : clamp(PSI * detectedAngles / RABBIT_MIN_ANGLES, 0, PSI);

  const reasoning =
    `RABBIT: ${detectedAngles}/${RABBIT_MIN_ANGLES} required angles detected. ` +
    `Multiplication requirement ${detectedAngles >= RABBIT_MIN_ANGLES ? "SATISFIED" : "NOT MET"}. ` +
    `Confidence: ${finalConf.toFixed(FIB[4])}.`;
  const recommendations: string[] = [];

  if (detectedAngles < RABBIT_MIN_ANGLES) {
    recommendations.push(
      `RABBIT: Only ${detectedAngles} perspective(s) identified — ` +
      `expand to at least ${RABBIT_MIN_ANGLES} distinct angles ` +
      `(e.g. performance, security, maintainability, scalability, cost)`
    );
  }

  return { confidence: finalConf, reasoning, recommendations };
}

/**
 * ANT — Task Layer
 * Validates that the content describes zero-skip, step-by-step actionability.
 */
function evaluateANT(input: EvaluationInput): {
  confidence: number;
  reasoning: string;
  recommendations: string[];
} {
  const text = `${input.content} ${input.context}`;

  const hasSteps = /\b(step|first|then|next|finally|after|before|1\.|2\.|3\.)\b/i.test(text);
  const hasAction = /\b(implement|execute|run|create|update|delete|deploy|configure|install)\b/i.test(text);
  const hasCompleteness = /\b(complete|done|finish|all|every|each|comprehensive|full)\b/i.test(text);

  const signals = [hasSteps, hasAction, hasCompleteness];
  const trueCount = signals.filter(Boolean).length;
  const confidence = clamp(PSI + trueCount * (FIB[1] - PSI) / signals.length, 0, 1);

  const reasoning =
    `ANT: ${trueCount}/${signals.length} task-layer signals detected ` +
    `(stepwise structure, actionability, completeness). ` +
    `Confidence: ${confidence.toFixed(FIB[4])}.`;
  const recommendations: string[] = [];

  if (!hasSteps) {
    recommendations.push("ANT: Structure content into ordered, numbered steps for zero-skip execution");
  }
  if (!hasAction) {
    recommendations.push("ANT: Use imperative action verbs (implement, execute, deploy) to make tasks concrete");
  }

  return { confidence, reasoning, recommendations };
}

/**
 * ELEPHANT — Memory Layer
 * Checks for evidence of context retention and cross-reference to prior knowledge.
 */
function evaluateELEPHANT(input: EvaluationInput): {
  confidence: number;
  reasoning: string;
  recommendations: string[];
} {
  const text = `${input.content} ${input.context}`;

  const hasPriorRef = /\b(previously|earlier|as discussed|recall|remember|above|prior|history|past)\b/i.test(text);
  const hasDetail = text.length >= FIB[10]; // 55+ characters shows depth
  const hasConsistency = /\b(consistent|always|invariant|stable|persistent|constant)\b/i.test(text);

  const signals = [hasPriorRef, hasDetail, hasConsistency];
  const trueCount = signals.filter(Boolean).length;
  const confidence = clamp(PSI + trueCount * PSI * PSI / signals.length, 0, 1);

  const reasoning =
    `ELEPHANT: ${trueCount}/${signals.length} memory signals present ` +
    `(prior-reference, depth, consistency markers). ` +
    `Confidence: ${confidence.toFixed(FIB[4])}.`;
  const recommendations: string[] = [];

  if (!hasPriorRef) {
    recommendations.push("ELEPHANT: Reference prior context or related decisions to enable deep-focus continuity");
  }

  return { confidence, reasoning, recommendations };
}

/**
 * BEAVER — Build Layer
 * Evaluates engineering quality signals: clean architecture, rigour, structure.
 */
function evaluateBEAVER(input: EvaluationInput): {
  confidence: number;
  reasoning: string;
  recommendations: string[];
} {
  const text = `${input.content} ${input.context}`;

  const hasArchitecture = /\b(architecture|design|pattern|interface|contract|abstraction|module|layer)\b/i.test(text);
  const hasQuality = /\b(test|type|schema|validate|lint|review|clean|solid|dry|yagni)\b/i.test(text);
  const hasDocumentation = /\b(document|comment|jsdoc|readme|spec|docstring)\b/i.test(text);

  const signals = [hasArchitecture, hasQuality, hasDocumentation];
  const trueCount = signals.filter(Boolean).length;
  const confidence = clamp(PSI + trueCount * (FIB[2] - PSI) / signals.length, 0, 1);

  const reasoning =
    `BEAVER: ${trueCount}/${signals.length} build-quality signals detected ` +
    `(architecture, quality/testing, documentation). ` +
    `Confidence: ${confidence.toFixed(FIB[4])}.`;
  const recommendations: string[] = [];

  if (!hasArchitecture) {
    recommendations.push("BEAVER: Define architectural layers and module boundaries explicitly");
  }
  if (!hasQuality) {
    recommendations.push("BEAVER: Include type annotations, schema validation, or test coverage references");
  }
  if (!hasDocumentation) {
    recommendations.push("BEAVER: Add JSDoc/inline documentation for public API surfaces");
  }

  return { confidence, reasoning, recommendations };
}

// ---------------------------------------------------------------------------
// Archetype dispatcher
// ---------------------------------------------------------------------------

type ArchetypeResult = {
  confidence: number;
  reasoning: string;
  recommendations: string[];
};

/**
 * Dispatch evaluation to the correct archetype function by name.
 * @param archetype - The archetype to invoke
 * @param input - Evaluation input
 * @returns ArchetypeResult
 */
function dispatchArchetype(
  archetype: CognitiveArchetype,
  input: EvaluationInput
): ArchetypeResult {
  switch (archetype.name) {
    case "OWL":      return evaluateOWL(input);
    case "EAGLE":    return evaluateEAGLE(input);
    case "DOLPHIN":  return evaluateDOLPHIN(input);
    case "RABBIT":   return evaluateRABBIT(input);
    case "ANT":      return evaluateANT(input);
    case "ELEPHANT": return evaluateELEPHANT(input);
    case "BEAVER":   return evaluateBEAVER(input);
    default: {
      // Exhaustive check — TypeScript will warn if a new archetype is added without handling
      const _exhaustive: never = archetype.name;
      return {
        confidence: 0,
        reasoning: `Unknown archetype: ${String(_exhaustive)}`,
        recommendations: [],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Core class — HeadySoul
// ---------------------------------------------------------------------------

/**
 * HeadySoul — the seven-archetype awareness layer and coherence guardian.
 *
 * @example
 * ```typescript
 * const soul = new HeadySoul({
 *   cognitiveArchetypes: DEFAULT_ARCHETYPES as CognitiveArchetype[],
 *   minLayerConfidence: 0.618,
 *   coherenceThreshold: 0.75,
 *   enableBiasDetection: true,
 * });
 *
 * const evaluation = await soul.evaluate({
 *   content: 'Refactor authentication to use PASETO tokens',
 *   type: 'decision',
 *   context: 'JWT has known vulnerabilities; PASETO is safer',
 *   priority: 'high',
 * });
 * ```
 */
export class HeadySoul {
  private readonly config: SoulConfig;
  private readonly decisionHistory: Decision[];
  private referenceEmbedding: number[] | null;
  private evaluationCount: number;
  private readonly _instanceCreatedAt: string;

  /**
   * Construct a new HeadySoul instance.
   * @param config - Soul configuration
   * @throws {SoulConfigError} If configuration is invalid
   */
  constructor(config: SoulConfig) {
    if (
      !Array.isArray(config.cognitiveArchetypes) ||
      config.cognitiveArchetypes.length === 0
    ) {
      throw new SoulConfigError(
        "cognitiveArchetypes must be a non-empty array"
      );
    }
    if (config.cognitiveArchetypes.length !== ARCHETYPE_COUNT) {
      throw new SoulConfigError(
        `cognitiveArchetypes must contain exactly ${ARCHETYPE_COUNT} archetypes, ` +
        `received ${config.cognitiveArchetypes.length}`
      );
    }
    if (config.minLayerConfidence < 0 || config.minLayerConfidence > 1) {
      throw new SoulConfigError(
        `minLayerConfidence must be in [0.0, 1.0], received ${config.minLayerConfidence}`
      );
    }
    if (config.coherenceThreshold < 0 || config.coherenceThreshold > 1) {
      throw new SoulConfigError(
        `coherenceThreshold must be in [0.0, 1.0], received ${config.coherenceThreshold}`
      );
    }

    // Validate weight sum approximately equals 1.0 (within phi tolerance)
    const weightSum = config.cognitiveArchetypes.reduce(
      (s, a) => s + a.weight,
      0
    );
    const tolerance = FIB[2] / FIB[11]; // 1/89 ≈ 0.011
    if (Math.abs(weightSum - FIB[2]) > tolerance) {
      throw new SoulConfigError(
        `Archetype weights must sum to 1.0 (±${tolerance.toFixed(FIB[4])}), ` +
        `received sum: ${weightSum.toFixed(FIB[5])}`
      );
    }

    this.config = { ...config, cognitiveArchetypes: [...config.cognitiveArchetypes] };
    this.decisionHistory = [];
    this.referenceEmbedding = null;
    this.evaluationCount = 0;
    this._instanceCreatedAt = new Date().toISOString();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Evaluate an input through all seven cognitive archetypes.
   * All archetypes must emit a confidence signal ≥ minLayerConfidence (CSL).
   * If any archetype falls below, the evaluation is rejected.
   *
   * @param input - The content to evaluate
   * @returns SoulEvaluation — approval status, per-archetype scores, and reasoning
   * @throws {EvaluationInputError} If input is malformed
   */
  public async evaluate(input: EvaluationInput): Promise<SoulEvaluation> {
    if (!input.content || input.content.trim() === "") {
      throw new EvaluationInputError("content must not be empty");
    }
    if (!input.context && input.context !== "") {
      throw new EvaluationInputError("context must be a string (may be empty)");
    }

    const archetypeScores: Record<string, number> = {};
    const reasoning: string[] = [];
    const recommendations: string[] = [];

    // Run all archetypes — in parallel conceptually; sequential here (same event loop tick)
    for (const archetype of this.config.cognitiveArchetypes) {
      const result = dispatchArchetype(archetype, input);
      archetypeScores[archetype.name] = result.confidence;
      reasoning.push(result.reasoning);
      recommendations.push(...result.recommendations);
    }

    // CSL gate: ALL archetypes must exceed minLayerConfidence
    const failingArchetypes = this.config.cognitiveArchetypes.filter(
      (a) => (archetypeScores[a.name] ?? 0) < this.config.minLayerConfidence
    );

    if (failingArchetypes.length > 0) {
      const failureDetails = failingArchetypes
        .map((a) => `${a.name}(${(archetypeScores[a.name] ?? 0).toFixed(FIB[4])})`)
        .join(", ");
      reasoning.push(
        `CSL GATE FAILED: ${failingArchetypes.length} archetype(s) below ` +
        `threshold ${this.config.minLayerConfidence.toFixed(FIB[4])}: ${failureDetails}`
      );
    }

    // Compute weighted aggregate confidence
    const overallConfidence = this.config.cognitiveArchetypes.reduce(
      (sum, a) => sum + (archetypeScores[a.name] ?? 0) * a.weight,
      0
    );

    const approved =
      failingArchetypes.length === 0 &&
      overallConfidence >= this.config.minLayerConfidence;

    reasoning.unshift(
      `HeadySoul evaluation #${++this.evaluationCount}: ` +
      `type="${input.type}" priority="${input.priority}" ` +
      `overallConfidence=${overallConfidence.toFixed(FIB[4])} → ${approved ? "APPROVED" : "REJECTED"}`
    );

    // Record in decision history for bias detection
    const decision: Decision = {
      id: makeId(),
      outcome: approved ? "approved" : "rejected",
      context: input.type,
      category: input.type,
      decidedAt: new Date().toISOString(),
      confidence: overallConfidence,
    };
    this.decisionHistory.push(decision);
    this._trimDecisionHistory();

    return {
      approved,
      archetypeScores: archetypeScores as Record<ArchetypeName, number>,
      overallConfidence,
      reasoning,
      recommendations: [...new Set(recommendations)], // deduplicate
    };
  }

  /**
   * Generate a self-introspection report identifying known blind spots,
   * biases, calibration quality, and knowledge boundaries.
   *
   * @returns IntrospectionReport
   */
  public introspect(): IntrospectionReport {
    const blindSpots: string[] = [
      "Real-time streaming data beyond static content evaluation",
      "Multi-modal inputs (images, audio) — text-only evaluation supported",
      "Adversarial prompts designed to mimic legitimate content",
      "Cultural context nuances in non-English natural language",
      `Evaluation confidence below CSL threshold (${this.config.minLayerConfidence.toFixed(FIB[4])}) is treated as binary rejection`,
    ];

    const biasReport = this.config.enableBiasDetection
      ? detectCognitiveBiases(this.decisionHistory)
      : { biasesDetected: [], severity: 0, mitigations: [] };

    const biases = biasReport.biasesDetected.length > 0
      ? biasReport.biasesDetected
      : ["No significant systematic biases detected in current decision history"];

    // Calibration: measure how often overallConfidence is close to PSI (well-calibrated = near PSI, not extremes)
    const calibration = this._computeConfidenceCalibration();

    const knowledgeBoundaries: string[] = [
      "Domain-specific regulatory knowledge (GDPR, HIPAA, SOC2) requires expert review",
      "Real-time threat intelligence beyond static security pattern matching",
      `Wisdom cache limited to ${MAX_DECISION_HISTORY} decision records (fib(11))`,
      "Physical infrastructure constraints not modelled in latent-space projection",
      `Embedding dimension fixed at ${EMBEDDING_DIMENSION} (fib(9)) — higher-dimensional inputs are projected`,
    ];

    return { blindSpots, biases, confidenceCalibration: calibration, knowledgeBoundaries };
  }

  /**
   * Check the coherence of a latent-space embedding against the soul's
   * reference embedding. On first call the embedding is stored as the reference.
   *
   * @param embedding - Numeric vector to check (should be EMBEDDING_DIMENSION long)
   * @returns CoherenceResult with score, drift flag, and optional drift vector
   * @throws {EvaluationInputError} If embedding length is zero
   */
  public checkCoherence(embedding: number[]): CoherenceResult {
    if (embedding.length === 0) {
      throw new EvaluationInputError("embedding must be a non-empty number array");
    }

    // Normalise input to EMBEDDING_DIMENSION length
    const normalised = this._normaliseEmbedding(embedding);

    if (this.referenceEmbedding === null) {
      // First call — establish reference
      this.referenceEmbedding = normalised;
      return {
        score: 1,
        drifted: false,
      };
    }

    const similarity = cosineSimilarity(normalised, this.referenceEmbedding);
    // Cosine similarity in [-1, 1]; map to [0, 1] coherence score
    const score = clamp((similarity + FIB[2]) / FIB[3], 0, 1); // (sim+1)/2

    const drifted = score < this.config.coherenceThreshold;

    let driftVector: number[] | undefined;
    if (drifted) {
      driftVector = normalised.map((v, i) => v - (this.referenceEmbedding![i] ?? 0));
    }

    return { score, drifted, driftVector };
  }

  /**
   * Assess prediction confidence by comparing a prediction against actual outcome.
   * Returns a confidence score in [0.0, 1.0] where 1.0 = perfect match.
   *
   * Supports: numbers (relative error), strings (character overlap), arrays (element overlap),
   * booleans (exact match), and objects (key-set overlap).
   *
   * @param prediction - The predicted value
   * @param actual - The actual observed value
   * @returns Confidence score in [0.0, 1.0]
   */
  public assessConfidence(prediction: unknown, actual: unknown): number {
    if (prediction === actual) return 1;
    if (prediction === null || actual === null) return 0;
    if (prediction === undefined || actual === undefined) return 0;

    const type = typeof prediction;
    const actualType = typeof actual;

    if (type !== actualType) {
      return PSI * PSI; // PSI^2 ≈ 0.382 — mismatched types are partially wrong
    }

    if (type === "number" && actualType === "number") {
      const pred = prediction as number;
      const act = actual as number;
      if (act === 0) return pred === 0 ? 1 : 0;
      const relError = Math.abs(pred - act) / Math.abs(act);
      return clamp(FIB[2] - relError, 0, 1); // 1 - relErr
    }

    if (type === "string" && actualType === "string") {
      const predStr = (prediction as string).toLowerCase();
      const actStr = (actual as string).toLowerCase();
      if (predStr === actStr) return 1;
      if (predStr.length === 0 || actStr.length === 0) return 0;
      // Character overlap ratio
      const predChars = new Set(predStr.split(""));
      const actChars = new Set(actStr.split(""));
      const intersection = [...predChars].filter((c) => actChars.has(c)).length;
      const union = new Set([...predChars, ...actChars]).size;
      return union === 0 ? 0 : intersection / union; // Jaccard similarity
    }

    if (Array.isArray(prediction) && Array.isArray(actual)) {
      const predArr = prediction as unknown[];
      const actArr = actual as unknown[];
      if (predArr.length === 0 && actArr.length === 0) return 1;
      if (predArr.length === 0 || actArr.length === 0) return 0;
      const matches = predArr.filter((p, i) => p === actArr[i]).length;
      return matches / Math.max(predArr.length, actArr.length);
    }

    if (type === "boolean") {
      return prediction === actual ? 1 : 0;
    }

    if (type === "object") {
      const predKeys = new Set(Object.keys(prediction as object));
      const actKeys = new Set(Object.keys(actual as object));
      if (predKeys.size === 0 && actKeys.size === 0) return 1;
      const commonKeys = [...predKeys].filter((k) => actKeys.has(k)).length;
      const unionSize = new Set([...predKeys, ...actKeys]).size;
      return unionSize === 0 ? 0 : commonKeys / unionSize;
    }

    return 0;
  }

  /**
   * Detect cognitive biases in a list of decisions.
   * Requires enableBiasDetection to be true in config.
   *
   * @param decisions - Decision list to analyse
   * @returns BiasReport with detected biases, severity, and mitigations
   * @throws {EvaluationInputError} If enableBiasDetection is false
   */
  public detectBias(decisions: Decision[]): BiasReport {
    if (!this.config.enableBiasDetection) {
      throw new EvaluationInputError(
        "Bias detection is disabled. Set enableBiasDetection: true in SoulConfig."
      );
    }
    return detectCognitiveBiases(decisions);
  }

  /**
   * Return the soul's immutable identity declaration.
   * @returns SoulIdentity
   */
  public getIdentity(): SoulIdentity {
    return {
      name: "@heady-ai/heady-soul",
      version: "1.0.0",
      mission:
        "To serve as the awareness layer, values arbiter, and coherence guardian " +
        "of the Heady™ Liquid Latent OS — ensuring every action aligns with " +
        "first principles, structural integrity, and mission coherence. " +
        `(instance created: ${this._instanceCreatedAt})`,
      activeArchetypes: this.config.cognitiveArchetypes.map(
        (a) => a.name
      ) as ArchetypeName[],
      cslThreshold: this.config.minLayerConfidence,
      phiAlignment: PSI,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Normalise an embedding to exactly EMBEDDING_DIMENSION elements.
   * If shorter, pad with zeros; if longer, truncate.
   *
   * @param embedding - Input embedding
   * @returns Normalised embedding of length EMBEDDING_DIMENSION
   */
  private _normaliseEmbedding(embedding: number[]): number[] {
    if (embedding.length === EMBEDDING_DIMENSION) {
      return [...embedding];
    }
    const result = new Array<number>(EMBEDDING_DIMENSION).fill(0);
    const copyLen = Math.min(embedding.length, EMBEDDING_DIMENSION);
    for (let i = 0; i < copyLen; i++) {
      result[i] = embedding[i] ?? 0;
    }
    // L2-normalise the result
    const norm = l2Norm(result);
    if (norm > 0) {
      return result.map((v) => v / norm);
    }
    return result;
  }

  /**
   * Compute a confidence calibration score based on the spread of historical
   * decision confidence values.  A well-calibrated soul has confidence values
   * spread around PSI rather than clustering at extremes.
   *
   * @returns Calibration score in [0.0, 1.0]
   */
  private _computeConfidenceCalibration(): number {
    if (this.decisionHistory.length === 0) return PSI;

    const confidences = this.decisionHistory.map((d) => d.confidence);
    const mean = confidences.reduce((s, c) => s + c, 0) / confidences.length;
    const variance =
      confidences.reduce((s, c) => s + Math.pow(c - mean, FIB[3]), 0) /
      confidences.length;
    const stdDev = Math.sqrt(variance);

    // Ideal: mean ≈ PSI, stdDev ≈ PSI/φ² ≈ 0.236
    const idealMean = PSI;
    const idealStdDev = PSI / Math.pow(PHI, FIB[3]); // PSI / φ² ≈ 0.236
    const meanError = Math.abs(mean - idealMean);
    const stdDevError = Math.abs(stdDev - idealStdDev);

    return clamp(
      FIB[2] - (meanError + stdDevError) / FIB[3], // 1 - avg_error/2
      0,
      1
    );
  }

  /**
   * Trim the decision history to MAX_DECISION_HISTORY entries (fib(11) = 89).
   */
  private _trimDecisionHistory(): void {
    while (this.decisionHistory.length > MAX_DECISION_HISTORY) {
      this.decisionHistory.shift();
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Create a HeadySoul instance with the canonical seven archetypes and
 * production-safe defaults.
 *
 * @param overrides - Optional partial config overrides
 * @returns Configured HeadySoul instance
 *
 * @example
 * ```typescript
 * const soul = createHeadySoul({ enableBiasDetection: true });
 * const evaluation = await soul.evaluate({ content: '...', type: 'decision', context: '...', priority: 'high' });
 * ```
 */
export function createHeadySoul(
  overrides: Partial<SoulConfig> = {}
): HeadySoul {
  return new HeadySoul({
    cognitiveArchetypes: DEFAULT_ARCHETYPES as CognitiveArchetype[],
    minLayerConfidence: MIN_LAYER_CONFIDENCE,     // PSI ≈ 0.618
    coherenceThreshold: COHERENCE_THRESHOLD,      // 0.75
    enableBiasDetection: true,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Re-export constants
// ---------------------------------------------------------------------------

export {
  PHI,
  PSI,
  FIB,
  CSL_THRESHOLD,
  COHERENCE_THRESHOLD,
  MIN_LAYER_CONFIDENCE,
  ARCHETYPE_COUNT,
  EMBEDDING_DIMENSION,
  RABBIT_MIN_ANGLES,
  MAX_DECISION_HISTORY,
};
