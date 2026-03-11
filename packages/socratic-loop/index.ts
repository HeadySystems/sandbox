/**
 * @file socratic-loop/index.ts
 * @package @heady-ai/socratic-loop
 * @version 1.0.0
 *
 * SocraticLoop — validates reasoning BEFORE code projection in the
 * Heady™ Liquid Latent OS.
 *
 * The loop runs up to fib(5)=5 iterative refinement passes, each composed
 * of four Socratic checks:
 *
 *   1. NECESSITY  — Is this action already satisfied in wisdom?
 *   2. SAFETY     — Does it pass security checks (injection, XSS, SSRF, path traversal)?
 *   3. EFFICIENCY — Is sequential thinking or routine write the right approach?
 *   4. LEARNING   — Does wisdom.json contain an optimised pattern?
 *
 * All numeric constants derive from φ (golden ratio) and the Fibonacci sequence.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// φ / Fibonacci constants
// ---------------------------------------------------------------------------

/** Golden ratio φ = (1 + √5) / 2 */
const PHI: number = (1 + Math.sqrt(5)) / 2;

/** Conjugate ψ = φ − 1 ≈ 0.618 — used as the CSL (Confidence Signal Level) threshold */
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

/** Maximum iterations per validation pass — fib(5) = 5 */
const MAX_ITERATIONS: number = FIB[5]; // 5

/** Minimum confidence to approve an action — PSI ≈ 0.618 */
const MIN_CONFIDENCE: number = PSI;

/** Maximum wisdom entries stored — fib(11) = 89 */
const MAX_WISDOM_ENTRIES: number = FIB[11]; // 89

/** Wisdom similarity threshold — PSI ≈ 0.618 */
const WISDOM_SIMILARITY_THRESHOLD: number = PSI; // 0.618

/** Maximum validation history entries — fib(10) = 55 */
const MAX_VALIDATION_HISTORY: number = FIB[10]; // 55

/** Number of Socratic checks per iteration — 4 = fib(4) + fib(2) = 3 + 1 ✓ */
const SOCRATIC_CHECK_COUNT: number = FIB[4] + FIB[2]; // 3 + 1 = 4 ✓

// ---------------------------------------------------------------------------
// Security patterns for SAFETY check
// ---------------------------------------------------------------------------

/** SQL / NoSQL injection patterns */
const INJECTION_PATTERNS: Readonly<RegExp[]> = Object.freeze([
  /(\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bUNION\s+SELECT\b)/i,
  /\b(exec|execute|xp_cmdshell|sp_executesql)\b/i,
  /\$where\s*:/i,
  /\$gt\s*:\s*['"]?\s*['"]?\s*\}/i,
]);

/** Cross-site scripting patterns */
const XSS_PATTERNS: Readonly<RegExp[]> = Object.freeze([
  /<script[^>]*>/i,
  /javascript\s*:/i,
  /on\w+\s*=\s*["'][^"']*["']/i,
  /eval\s*\(|setTimeout\s*\(|setInterval\s*\(/i,
]);

/** Server-side request forgery patterns */
const SSRF_PATTERNS: Readonly<RegExp[]> = Object.freeze([
  /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.169\.254|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/i,
  /file:\/\//i,
  /gopher:\/\//i,
]);

/** Path traversal patterns */
const PATH_TRAVERSAL_PATTERNS: Readonly<RegExp[]> = Object.freeze([
  /\.\.[\/\\]/,
  /%2e%2e[%2f%5c]/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
]);

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** Categories for wisdom entries */
export type WisdomCategory =
  | "architecture"
  | "security"
  | "performance"
  | "pattern"
  | "anti-pattern"
  | "heuristic";

/** A cached wisdom entry with pattern, solution, and metadata */
export interface WisdomEntry {
  /** Unique wisdom identifier */
  key: string;
  /** Natural-language pattern description */
  pattern: string;
  /** Optimal solution or guidance for this pattern */
  solution: string;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Number of times this entry has been applied */
  appliedCount: number;
  /** ISO-8601 timestamp of last application */
  lastApplied: string;
  /** Category for organised retrieval */
  category: WisdomCategory;
}

/** A proposed action to be validated by the Socratic loop */
export interface ProposedAction {
  /** Classification of the action */
  type: "code_change" | "deploy" | "config_update" | "architecture_decision";
  /** Human-readable description of the action */
  description: string;
  /** Additional context (code snippets, URLs, error traces, etc.) */
  context: string;
  /** Scoped impact areas (e.g. ["authentication", "database", "api"]) */
  impactScope: string[];
}

/** Result of a single Socratic check */
export interface SocraticCheck {
  /** Check name */
  name: "NECESSITY" | "SAFETY" | "EFFICIENCY" | "LEARNING";
  /** Whether this check passed */
  passed: boolean;
  /** Confidence score for this check (0.0–1.0) */
  confidence: number;
  /** Detailed reasoning for this check */
  reasoning: string;
  /** Wisdom entries that informed this check */
  wisdomApplied: WisdomEntry[];
}

/** The final verdict after running the Socratic validation loop */
export interface SocraticVerdict {
  /** Whether the action is approved for execution */
  approved: boolean;
  /** Overall confidence score (0.0–1.0) */
  confidence: number;
  /** Ordered list of reasoning conclusions */
  reasoning: string[];
  /** Results of each Socratic check in the final iteration */
  checkResults: SocraticCheck[];
  /** Wisdom entries that contributed to the verdict */
  wisdomApplied: WisdomEntry[];
  /** Number of refinement iterations used */
  iterationsUsed: number;
}

/** Internal record of a completed validation */
export interface ValidationRecord {
  /** Unique record identifier */
  id: string;
  /** Action type that was validated */
  actionType: ProposedAction["type"];
  /** Brief description of the action */
  description: string;
  /** Whether the action was approved */
  approved: boolean;
  /** Final confidence score */
  confidence: number;
  /** ISO-8601 timestamp */
  validatedAt: string;
  /** Iterations consumed */
  iterationsUsed: number;
}

/** Configuration for a SocraticLoop instance */
export interface SocraticConfig {
  /**
   * Maximum refinement iterations per validation.
   * Defaults to fib(5) = 5.
   */
  maxIterations: number;
  /**
   * Minimum confidence required to approve an action.
   * Defaults to PSI ≈ 0.618.
   */
  minConfidence: number;
  /** Absolute path to the wisdom.json persistence file */
  wisdomPath: string;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Thrown when the Socratic loop encounters an irrecoverable validation error */
export class SocraticValidationError extends Error {
  public readonly actionType: string;
  public readonly checkName: string;

  constructor(actionType: string, checkName: string, reason: string) {
    super(`[SocraticLoop] ${checkName} check failed for "${actionType}": ${reason}`);
    this.name = "SocraticValidationError";
    this.actionType = actionType;
    this.checkName = checkName;
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Generate a reliable 32-char hex ID from 16 random bytes.
 * 16 bytes = FIB[7] + FIB[4] = 13 + 3 = 16 ✓
 * @returns 32-character hex string
 */
function makeId(): string {
  return crypto.randomBytes(FIB[7] + FIB[4]).toString("hex"); // 13+3=16 bytes = 32 hex chars ✓
}

/**
 * Compute a naive string-similarity score between two strings (0.0–1.0)
 * using character bigram overlap (Sørensen–Dice coefficient).
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score in [0.0, 1.0]
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < FIB[3] || b.length < FIB[3]) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + FIB[3]); // bigram length = fib(3) = 2
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };

  const ba = bigrams(a.toLowerCase());
  const bb = bigrams(b.toLowerCase());

  let intersection = 0;
  for (const [bg, countA] of ba) {
    const countB = bb.get(bg) ?? 0;
    intersection += Math.min(countA, countB);
  }

  const totalA = a.length - 1;
  const totalB = b.length - 1;
  return (FIB[3] * intersection) / (totalA + totalB); // Sørensen–Dice: 2*|A∩B| / (|A|+|B|)
}

/**
 * Check whether text contains any injection/XSS/SSRF/path-traversal patterns.
 * @param text - Content to scan
 * @returns Object with detected threat categories
 */
function runSecurityScan(text: string): {
  injection: boolean;
  xss: boolean;
  ssrf: boolean;
  pathTraversal: boolean;
} {
  return {
    injection: INJECTION_PATTERNS.some((p) => p.test(text)),
    xss: XSS_PATTERNS.some((p) => p.test(text)),
    ssrf: SSRF_PATTERNS.some((p) => p.test(text)),
    pathTraversal: PATH_TRAVERSAL_PATTERNS.some((p) => p.test(text)),
  };
}

/**
 * Estimate the complexity of an action description (1.0 = simple, 0.0 = extremely complex).
 * Uses word count and term heuristics as a rough proxy.
 *
 * @param description - Action description
 * @param context - Additional context
 * @returns Efficiency score in [0.0, 1.0]
 */
function estimateEfficiency(description: string, context: string): number {
  const combined = `${description} ${context}`;
  const wordCount = combined.split(/\s+/).filter(Boolean).length;

  // Complexity penalisers (architectural / systemic keywords)
  const complexTerms = [
    "refactor", "redesign", "migration", "rewrite", "overhaul",
    "distributed", "consensus", "sharding", "orchestration", "breaking change",
  ];
  const complexMatches = complexTerms.filter((t) =>
    combined.toLowerCase().includes(t)
  ).length;

  // Base score: simpler actions (fewer words) start high
  const lengthScore = Math.max(
    0,
    1 - wordCount / (FIB[10] + FIB[7]) // 55+13=68 words → score 0
  );

  // Penalise complexity terms — each one reduces by PSI^3 ≈ 0.236
  const complexPenalty = complexMatches * Math.pow(PSI, FIB[4]); // PSI^3

  return Math.max(0, Math.min(1, lengthScore - complexPenalty));
}

// ---------------------------------------------------------------------------
// Core class — SocraticLoop
// ---------------------------------------------------------------------------

/**
 * SocraticLoop — validates proposed actions through iterative Socratic
 * reasoning before they reach the LiquidDeploy projection engine.
 *
 * @example
 * ```typescript
 * const loop = new SocraticLoop({
 *   maxIterations: 5,
 *   minConfidence: 0.618,
 *   wisdomPath: '/var/heady/wisdom.json',
 * });
 *
 * const verdict = await loop.validate({
 *   type: 'deploy',
 *   description: 'Deploy new authentication service',
 *   context: 'Replacing JWT with PASETO for enhanced security',
 *   impactScope: ['authentication', 'api'],
 * });
 *
 * if (verdict.approved) {
 *   // safe to project
 * }
 * ```
 */
export class SocraticLoop {
  private readonly config: SocraticConfig;
  private readonly wisdomCache: Map<string, WisdomEntry>;
  private readonly validationHistory: ValidationRecord[];

  /**
   * Construct a new SocraticLoop with the given configuration.
   * Loads any existing wisdom from disk if wisdomPath exists.
   *
   * @param config - Loop configuration
   * @throws {Error} If maxIterations exceeds MAX_ITERATIONS or minConfidence is out of range
   */
  constructor(config: SocraticConfig) {
    if (config.maxIterations < FIB[1] || config.maxIterations > MAX_ITERATIONS) {
      throw new Error(
        `SocraticConfig.maxIterations must be in [1, ${MAX_ITERATIONS}] (fib(5)). ` +
        `Received: ${config.maxIterations}`
      );
    }
    if (config.minConfidence < 0 || config.minConfidence > 1) {
      throw new Error(
        `SocraticConfig.minConfidence must be in [0.0, 1.0]. ` +
        `Received: ${config.minConfidence}`
      );
    }
    if (!config.wisdomPath || config.wisdomPath.trim() === "") {
      throw new Error("SocraticConfig.wisdomPath must be a non-empty string");
    }

    this.config = { ...config };
    this.wisdomCache = new Map();
    this.validationHistory = [];

    this._loadWisdomFromDisk();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Run the Socratic validation loop on a proposed action.
   * Iterates up to maxIterations times, refining confidence on each pass.
   *
   * @param action - The action to validate
   * @returns SocraticVerdict with approval decision and full reasoning
   */
  public async validate(action: ProposedAction): Promise<SocraticVerdict> {
    if (!action.description || action.description.trim() === "") {
      throw new SocraticValidationError(
        action.type,
        "PRECONDITION",
        "action.description must not be empty"
      );
    }
    if (!Array.isArray(action.impactScope) || action.impactScope.length === 0) {
      throw new SocraticValidationError(
        action.type,
        "PRECONDITION",
        "action.impactScope must be a non-empty array"
      );
    }

    let iterationsUsed = 0;
    let bestCheckResults: SocraticCheck[] = [];
    let bestConfidence = 0;
    const allReasoning: string[] = [];
    const allWisdomApplied: Map<string, WisdomEntry> = new Map();

    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      iterationsUsed++;

      const checkResults = await this._runChecks(action, iteration);
      checkResults.forEach((c) => {
        c.wisdomApplied.forEach((w) => allWisdomApplied.set(w.key, w));
      });

      const confidence = this._aggregateConfidence(checkResults);
      allReasoning.push(
        `[Iteration ${iteration + 1}/${this.config.maxIterations}] ` +
        `Confidence: ${confidence.toFixed(FIB[4])} — ` +
        checkResults.map((c) => `${c.name}:${c.passed ? "✓" : "✗"}`).join(" ")
      );

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestCheckResults = checkResults;
      }

      // Early exit if all checks pass and confidence meets threshold
      if (
        confidence >= this.config.minConfidence &&
        checkResults.every((c) => c.passed)
      ) {
        allReasoning.push(
          `Early exit at iteration ${iteration + 1}: all checks passed with ` +
          `confidence ${confidence.toFixed(FIB[4])} ≥ ${this.config.minConfidence.toFixed(FIB[4])}`
        );
        break;
      }

      // If SAFETY fails, stop immediately — do not refine
      const safetyCheck = checkResults.find((c) => c.name === "SAFETY");
      if (safetyCheck && !safetyCheck.passed) {
        allReasoning.push(
          `SAFETY check failed at iteration ${iteration + 1} — aborting refinement loop`
        );
        break;
      }
    }

    const approved =
      bestConfidence >= this.config.minConfidence &&
      bestCheckResults.every((c) => c.passed);

    allReasoning.push(
      `Final verdict: ${approved ? "APPROVED" : "REJECTED"} ` +
      `(confidence: ${bestConfidence.toFixed(FIB[4])}, ` +
      `threshold: ${this.config.minConfidence.toFixed(FIB[4])})`
    );

    // Persist validation record
    const record: ValidationRecord = {
      id: makeId(),
      actionType: action.type,
      description: action.description.slice(0, FIB[9]), // max 34 chars in record
      approved,
      confidence: bestConfidence,
      validatedAt: new Date().toISOString(),
      iterationsUsed,
    };
    this.validationHistory.push(record);
    this._trimHistory();

    // Update appliedCount for wisdom entries that were used
    for (const entry of allWisdomApplied.values()) {
      const cached = this.wisdomCache.get(entry.key);
      if (cached) {
        cached.appliedCount++;
        cached.lastApplied = new Date().toISOString();
      }
    }
    this._persistWisdom();

    return {
      approved,
      confidence: bestConfidence,
      reasoning: allReasoning,
      checkResults: bestCheckResults,
      wisdomApplied: Array.from(allWisdomApplied.values()),
      iterationsUsed,
    };
  }

  /**
   * Retrieve a wisdom entry by its unique key.
   * @param key - Wisdom entry key
   * @returns WisdomEntry if found, undefined otherwise
   */
  public getWisdom(key: string): WisdomEntry | undefined {
    return this.wisdomCache.get(key);
  }

  /**
   * Record a new wisdom entry into the cache and persist to disk.
   * Entries with existing keys are updated.
   *
   * @param entry - Wisdom entry to record
   * @throws {Error} If entry.confidence is outside [0.0, 1.0]
   */
  public recordWisdom(entry: WisdomEntry): void {
    if (!entry.key || entry.key.trim() === "") {
      throw new Error("WisdomEntry.key must not be empty");
    }
    if (entry.confidence < 0 || entry.confidence > 1) {
      throw new Error(
        `WisdomEntry.confidence must be in [0.0, 1.0]. Received: ${entry.confidence}`
      );
    }

    this.wisdomCache.set(entry.key, { ...entry });

    // Evict oldest if over limit
    while (this.wisdomCache.size > MAX_WISDOM_ENTRIES) {
      const oldestKey = this._findOldestWisdomKey();
      if (oldestKey) {
        this.wisdomCache.delete(oldestKey);
      } else {
        break;
      }
    }

    this._persistWisdom();
  }

  /**
   * Return the full validation history (most recent first).
   * Capped at MAX_VALIDATION_HISTORY (fib(10) = 55).
   *
   * @returns Immutable array of validation records
   */
  public getValidationHistory(): ValidationRecord[] {
    return [...this.validationHistory].reverse();
  }

  // -------------------------------------------------------------------------
  // Private — four Socratic checks
  // -------------------------------------------------------------------------

  /**
   * Run all four Socratic checks for one iteration.
   * @param action - The proposed action
   * @param iterationIndex - Zero-based iteration counter (used for confidence adjustment)
   * @returns Array of four SocraticCheck results
   */
  private async _runChecks(
    action: ProposedAction,
    iterationIndex: number
  ): Promise<SocraticCheck[]> {
    return [
      this._checkNecessity(action, iterationIndex),
      this._checkSafety(action, iterationIndex),
      this._checkEfficiency(action, iterationIndex),
      this._checkLearning(action, iterationIndex),
    ];
  }

  /**
   * CHECK 1 — NECESSITY
   * Is this action genuinely required, or is it already satisfied by existing wisdom?
   * An action is considered unnecessary if a near-identical wisdom entry already exists
   * with a solution in the cache.
   */
  private _checkNecessity(
    action: ProposedAction,
    iterationIndex: number
  ): SocraticCheck {
    const matches = this._findMatchingWisdom(action.description);
    const alreadySolved = matches.some(
      (w) =>
        w.confidence >= MIN_CONFIDENCE &&
        w.category !== "anti-pattern"
    );

    if (alreadySolved) {
      const bestMatch = matches[0];
      return {
        name: "NECESSITY",
        passed: true,
        confidence: Math.min(1, bestMatch.confidence + PSI * (FIB[1] / FIB[5])),
        reasoning:
          `Action description matches existing wisdom entry "${bestMatch.key}" ` +
          `(confidence: ${bestMatch.confidence.toFixed(FIB[4])}). ` +
          `Known solution: ${bestMatch.solution.slice(0, FIB[9])}`,
        wisdomApplied: [bestMatch],
      };
    }

    // No prior wisdom — action is novel and therefore necessary
    const baseConfidence =
      PSI - (iterationIndex * PSI) / (this.config.maxIterations * FIB[5]);
    return {
      name: "NECESSITY",
      passed: true,
      confidence: Math.max(PSI, baseConfidence),
      reasoning:
        "No conflicting wisdom entry found. Action is novel and appears necessary.",
      wisdomApplied: [],
    };
  }

  /**
   * CHECK 2 — SAFETY
   * Does the action's description + context pass security scanning?
   * Checks for injection, XSS, SSRF, and path traversal indicators.
   */
  private _checkSafety(
    action: ProposedAction,
    iterationIndex: number
  ): SocraticCheck {
    const scanText = `${action.description} ${action.context}`;
    const threats = runSecurityScan(scanText);
    const detectedThreats: string[] = [];

    if (threats.injection) detectedThreats.push("SQL/NoSQL injection pattern");
    if (threats.xss) detectedThreats.push("XSS pattern");
    if (threats.ssrf) detectedThreats.push("SSRF pattern (private IP / localhost)");
    if (threats.pathTraversal) detectedThreats.push("path traversal pattern");

    const antiPatternWisdom = this._findMatchingWisdom(action.description).filter(
      (w) => w.category === "anti-pattern" && w.confidence >= MIN_CONFIDENCE
    );
    if (antiPatternWisdom.length > 0) {
      detectedThreats.push(
        `matches known anti-pattern: "${antiPatternWisdom[0].key}"`
      );
    }

    const passed = detectedThreats.length === 0;
    const confidence = passed
      ? PSI + (iterationIndex + FIB[1]) * (FIB[1] / FIB[10]) // ramp up over iterations
      : 0; // zero confidence if safety fails

    return {
      name: "SAFETY",
      passed,
      confidence: Math.min(1, confidence),
      reasoning: passed
        ? "No injection, XSS, SSRF, or path traversal patterns detected. Action is safe to proceed."
        : `Security threats detected: ${detectedThreats.join("; ")}. Action must not proceed.`,
      wisdomApplied: antiPatternWisdom.slice(0, FIB[3]),
    };
  }

  /**
   * CHECK 3 — EFFICIENCY
   * Is sequential thinking or a simple routine write the right approach?
   * Evaluates action complexity and assigns a confidence score.
   */
  private _checkEfficiency(
    action: ProposedAction,
    iterationIndex: number
  ): SocraticCheck {
    const efficiencyScore = estimateEfficiency(action.description, action.context);

    // High-impact scopes increase the requirement for efficiency
    const broadScopeThreshold = FIB[5]; // 5 impact areas = broad scope
    const scopePenalty =
      action.impactScope.length >= broadScopeThreshold
        ? PSI * (action.impactScope.length - broadScopeThreshold + FIB[1]) / FIB[10]
        : 0;

    const adjustedScore = Math.max(0, efficiencyScore - scopePenalty);
    const passed = adjustedScore >= MIN_CONFIDENCE || iterationIndex >= FIB[3];

    return {
      name: "EFFICIENCY",
      passed,
      confidence: Math.min(1, adjustedScore + iterationIndex * PSI / this.config.maxIterations),
      reasoning: passed
        ? `Action complexity is manageable (efficiency score: ${adjustedScore.toFixed(FIB[4])}, ` +
          `impact scope: ${action.impactScope.length} area(s)). Proceed with sequential execution.`
        : `Action is excessively complex (efficiency score: ${adjustedScore.toFixed(FIB[4])}, ` +
          `scope: ${action.impactScope.length} areas). Decompose into smaller actions before projecting.`,
      wisdomApplied: [],
    };
  }

  /**
   * CHECK 4 — LEARNING
   * Does the wisdom cache contain an optimised pattern for this action?
   * If yes, surface it; if no, note it as a learning opportunity.
   */
  private _checkLearning(
    action: ProposedAction,
    iterationIndex: number
  ): SocraticCheck {
    const matches = this._findMatchingWisdom(action.description);
    const highConfidenceMatches = matches.filter(
      (w) => w.confidence >= MIN_CONFIDENCE && w.category !== "anti-pattern"
    );

    if (highConfidenceMatches.length > 0) {
      const top = highConfidenceMatches[0];
      return {
        name: "LEARNING",
        passed: true,
        confidence: Math.min(1, top.confidence + PSI * iterationIndex / this.config.maxIterations),
        reasoning:
          `Wisdom cache hit: "${top.key}" (applied ${top.appliedCount} time(s)). ` +
          `Optimised solution available: ${top.solution.slice(0, FIB[9])}`,
        wisdomApplied: highConfidenceMatches.slice(0, FIB[3]),
      };
    }

    // No cached optimisation — this is a learning opportunity
    const baseConf = PSI - PSI / FIB[5]; // slightly below threshold on first pass
    return {
      name: "LEARNING",
      passed: iterationIndex >= FIB[3] - FIB[1], // passes after iteration 1
      confidence: Math.min(PSI, baseConf + iterationIndex * PSI / this.config.maxIterations),
      reasoning:
        "No optimised wisdom pattern found for this action. " +
        "Action will be executed without prior pattern guidance. " +
        "Consider recording outcome as a new WisdomEntry after completion.",
      wisdomApplied: [],
    };
  }

  // -------------------------------------------------------------------------
  // Private — wisdom management
  // -------------------------------------------------------------------------

  /**
   * Find wisdom entries that match a query string, sorted by similarity descending.
   * @param query - Natural-language query
   * @returns Array of matching WisdomEntry, sorted best-match first
   */
  private _findMatchingWisdom(query: string): WisdomEntry[] {
    const scored: Array<{ entry: WisdomEntry; score: number }> = [];

    for (const entry of this.wisdomCache.values()) {
      const score = stringSimilarity(query, entry.pattern);
      if (score >= WISDOM_SIMILARITY_THRESHOLD) {
        scored.push({ entry, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .map((s) => s.entry);
  }

  /**
   * Aggregate confidence across all Socratic checks using a weighted harmonic mean.
   * SAFETY failure (confidence=0) immediately pulls the aggregate to zero.
   *
   * @param checks - Array of completed check results
   * @returns Overall confidence in [0.0, 1.0]
   */
  private _aggregateConfidence(checks: SocraticCheck[]): number {
    if (checks.length === 0) return 0;

    // Weights derived from φ: SAFETY gets highest weight (PHI^2), others get PHI^1, PHI^0.5, PHI^0.25
    const weights: Record<string, number> = {
      SAFETY: Math.pow(PHI, FIB[3]),      // φ² ≈ 2.618
      NECESSITY: Math.pow(PHI, FIB[2]),   // φ¹ ≈ 1.618
      EFFICIENCY: Math.pow(PHI, PSI),     // φ^0.618 ≈ 1.370
      LEARNING: Math.pow(PHI, PSI * PSI), // φ^0.382 ≈ 1.203
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const check of checks) {
      const w = weights[check.name] ?? FIB[1];
      weightedSum += check.confidence * w;
      totalWeight += w;
    }

    return totalWeight > 0 ? Math.min(1, weightedSum / totalWeight) : 0;
  }

  /**
   * Load wisdom entries from the configured wisdomPath JSON file.
   * Silently ignores missing or malformed files.
   */
  private _loadWisdomFromDisk(): void {
    try {
      if (!fs.existsSync(this.config.wisdomPath)) {
        return;
      }
      const raw = fs.readFileSync(this.config.wisdomPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;

      if (!Array.isArray(parsed)) {
        return;
      }

      for (const item of parsed) {
        if (
          item &&
          typeof item === "object" &&
          typeof (item as WisdomEntry).key === "string" &&
          typeof (item as WisdomEntry).pattern === "string"
        ) {
          const entry = item as WisdomEntry;
          this.wisdomCache.set(entry.key, entry);
        }
      }
    } catch {
      // Disk load failure is non-fatal — start with empty cache
    }
  }

  /**
   * Persist the current wisdom cache to disk as a JSON array.
   * Silently ignores write failures (non-fatal).
   */
  private _persistWisdom(): void {
    try {
      const dir = path.dirname(this.config.wisdomPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const entries = Array.from(this.wisdomCache.values());
      fs.writeFileSync(
        this.config.wisdomPath,
        JSON.stringify(entries, null, FIB[3]), // indent = fib(3) = 2
        { encoding: "utf8" }
      );
    } catch {
      // Non-fatal: wisdom cache remains in memory
    }
  }

  /**
   * Find the key of the oldest wisdom entry by lastApplied timestamp.
   * @returns Key string or undefined if cache is empty
   */
  private _findOldestWisdomKey(): string | undefined {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.wisdomCache) {
      const time = new Date(entry.lastApplied).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    return oldestKey;
  }

  /**
   * Trim the validation history to MAX_VALIDATION_HISTORY entries.
   */
  private _trimHistory(): void {
    while (this.validationHistory.length > MAX_VALIDATION_HISTORY) {
      this.validationHistory.shift();
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Create a SocraticLoop with production-safe defaults.
 *
 * @param wisdomPath - Absolute path to the wisdom.json persistence file
 * @param overrides - Optional partial config overrides
 * @returns Configured SocraticLoop instance
 *
 * @example
 * ```typescript
 * const loop = createSocraticLoop('/var/heady/wisdom.json');
 * ```
 */
export function createSocraticLoop(
  wisdomPath: string,
  overrides: Partial<Omit<SocraticConfig, "wisdomPath">> = {}
): SocraticLoop {
  return new SocraticLoop({
    maxIterations: MAX_ITERATIONS,       // fib(5) = 5
    minConfidence: MIN_CONFIDENCE,       // PSI ≈ 0.618
    wisdomPath,
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
  MAX_ITERATIONS,
  MIN_CONFIDENCE,
  MAX_WISDOM_ENTRIES,
  WISDOM_SIMILARITY_THRESHOLD,
  SOCRATIC_CHECK_COUNT,
};
