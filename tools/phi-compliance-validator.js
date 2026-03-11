'use strict';

/**
 * @fileoverview phi-compliance-validator.js
 *
 * Audit tool that scores any Heady™ configuration or code file for phi compliance.
 * Detects magic numbers, non-phi thresholds, non-Fibonacci sizes, and non-phi
 * backoff values across JSON, YAML, and JavaScript source files.
 *
 * Violation types detected:
 *   MAGIC_NUMBER          — numeric literal not phi-derived, Fibonacci, or a known constant
 *   NON_PHI_THRESHOLD     — threshold values like 0.7/0.8/0.85/0.9 that should be phi-derived
 *   NON_FIBONACCI_SIZE    — cache/pool/queue/batch sizes not Fibonacci
 *   NON_PHI_BACKOFF       — retry/backoff values not phi-scaled
 *   NON_PHI_ALLOCATION    — resource allocations not phi-split
 *   HARDCODED_TIMEOUT     — timeout values not in phi sequence (φⁿ × 1000)
 *   ARBITRARY_RETRY       — retry counts that are not Fibonacci
 *
 * @module phi-compliance-validator
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

const {
  PHI,
  PSI,
  PHI_SQ,
  PHI_CB,
  fib,
  phiThreshold,
  CSL_THRESHOLDS,
  // FIBONACCI_POOLS, PHI_BACKOFF_SEQUENCE — resolved locally below from phi-math-v2
  fibNearest: nearestFib,
  fibCeil:    ceilFib,
  fibFloor:   floorFib,
  FIB_SEQUENCE,
  isFibonacci: _isFibonacciImpl,
} = require('../../shared/phi-math-v2.js');

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-computed Fibonacci pool sizes for common usage patterns.
 * Covers small sizes (5) up to large cache/buffer sizes (6765).
 * @type {number[]}
 */
const FIBONACCI_POOLS = FIB_SEQUENCE.slice(4, 21); // 3,5,8,13,...,6765 (indices 4-20)

/**
 * Phi-scaled backoff sequence in milliseconds starting at 1000 ms.
 * Each element = round(1000 × φⁿ) for n = 0..7.
 * @type {number[]}
 */
const PHI_BACKOFF_SEQUENCE = Array.from({ length: 8 }, (_, n) => Math.round(1000 * Math.pow(PHI, n)));
// [1000, 1618, 2618, 4236, 6854, 11090, 17944, 29034]

// ─────────────────────────────────────────────────────────────────────────────
// WHITELISTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accepted phi-derived floating-point values (tolerance applied separately).
 * @type {number[]}
 */
const PHI_DERIVED_FLOATS = [
  PHI,           // ≈ 1.618
  PSI,           // ≈ 0.618
  PHI_SQ,        // ≈ 2.618
  PHI_CB,        // ≈ 4.236
  PSI * PSI,     // ≈ 0.382  (φ-complement / ψ²)
  1 - PSI * PSI, // ≈ 0.618  (same as PSI but useful for pressure)
  1 - Math.pow(PSI, 3), // ≈ 0.764
  1 - Math.pow(PSI, 4), // ≈ 0.854
  Math.pow(PSI, 3),     // ≈ 0.236 (PHI_TEMPERATURE)
  ...Object.values(CSL_THRESHOLDS), // 0.500, 0.691, 0.809, 0.882, 0.927
  1 - Math.pow(PSI, 6) * 0.5,      // ≈ 0.972 (DEDUP_THRESHOLD)
  // phiThreshold levels with spread=0.5
  phiThreshold(0), // 0.500
  phiThreshold(1), // 0.691
  phiThreshold(2), // 0.809
  phiThreshold(3), // 0.882
  phiThreshold(4), // 0.927
  phiThreshold(5), // ≈ 0.954
  // Phi allocation fractions from phi-resource weights (5 buckets)
  0.34, 0.21, 0.13, 0.08, 0.05,
  // Common ratio approximations
  0.486, 0.300, 0.214, // eviction weights
  0.528, 0.326, 0.146, // phiFusionWeights(3)
  0.618, 0.382,        // canonical PSI / 1-PSI
];

/**
 * Accepted integer constants — Fibonacci numbers plus a few domain-specific safe values.
 * @type {Set<number>}
 */
const SAFE_INTEGERS = new Set([
  0, 1, 2, 3,          // trivial / structural
  384,                 // OpenAI/Heady embedding dimensions (standard constant)
  ...FIB_SEQUENCE.slice(0, 25), // 0,1,1,2,3,5,8,...,75025
]);

/**
 * Keywords that indicate a number is a size/capacity value in JSON paths or JS contexts.
 * Used for NON_FIBONACCI_SIZE detection.
 * @type {RegExp}
 */
const SIZE_KEY_RE = /\b(size|capacity|limit|max|min|pool|cache|queue|batch|buffer|count|depth|length|width|height|top[Kk]|window|bucket|shard|slot|worker|thread|connection)\b/i;

/**
 * Keywords that indicate a threshold/confidence/score context.
 * Used for NON_PHI_THRESHOLD detection.
 * @type {RegExp}
 */
const THRESHOLD_KEY_RE = /\b(threshold|score|confidence|cutoff|similarity|weight|ratio|rate|factor|gate|level|floor|ceil|min[Ss]core|max[Ss]core)\b/i;

/**
 * Keywords indicating backoff/retry context.
 * @type {RegExp}
 */
const BACKOFF_KEY_RE = /\b(backoff|retry|retries|delay|interval|timeout|wait|sleep|cooldown|debounce|throttle|attempt)\b/i;

/**
 * Keywords indicating resource allocation context.
 * @type {RegExp}
 */
const ALLOCATION_KEY_RE = /\b(alloc|allocation|share|portion|weight|budget|quota|limit|percent|pct|fraction|split)\b/i;

/**
 * Known non-phi thresholds that should be replaced.
 * Maps the offending value (± tolerance) to the suggested phi replacement.
 * @type {Array<{ value: number, suggestion: number, label: string }>}
 */
const NON_PHI_THRESHOLD_MAP = [
  { value: 0.50, suggestion: phiThreshold(0), label: 'phiThreshold(0)≈0.500' },
  { value: 0.60, suggestion: phiThreshold(1), label: 'phiThreshold(1)≈0.691' },
  { value: 0.70, suggestion: phiThreshold(1), label: 'phiThreshold(1)≈0.691' },
  { value: 0.75, suggestion: phiThreshold(2), label: 'phiThreshold(2)≈0.809' },
  { value: 0.80, suggestion: phiThreshold(2), label: 'phiThreshold(2)≈0.809' },
  { value: 0.85, suggestion: phiThreshold(3), label: 'phiThreshold(3)≈0.882' },
  { value: 0.90, suggestion: phiThreshold(4), label: 'phiThreshold(4)≈0.927' },
  { value: 0.95, suggestion: phiThreshold(4), label: 'phiThreshold(4)≈0.927' },
  { value: 0.99, suggestion: phiThreshold(5), label: 'phiThreshold(5)≈0.954' },
];

/**
 * Non-Fibonacci pool/cache sizes commonly found in configs.
 * @type {number[]}
 */
const COMMON_NON_FIB_SIZES = [4, 6, 7, 9, 10, 12, 15, 16, 20, 24, 25, 30,
  32, 40, 48, 50, 60, 64, 75, 80, 96, 100, 128, 150, 200, 256, 300, 400,
  500, 512, 600, 700, 750, 800, 900, 1000, 1024, 1500, 2000, 2048, 3000,
  4000, 5000, 10000];

/**
 * Non-phi backoff/timeout values commonly hardcoded.
 * @type {number[]}
 */
const COMMON_NON_PHI_TIMEOUTS = [200, 250, 300, 400, 500, 750, 800, 900,
  1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 8000, 10000, 15000,
  20000, 25000, 30000, 45000, 60000];

// ─────────────────────────────────────────────────────────────────────────────
// VIOLATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enumeration of violation type strings.
 * @enum {string}
 */
const ViolationType = Object.freeze({
  MAGIC_NUMBER:       'MAGIC_NUMBER',
  NON_PHI_THRESHOLD:  'NON_PHI_THRESHOLD',
  NON_FIBONACCI_SIZE: 'NON_FIBONACCI_SIZE',
  NON_PHI_BACKOFF:    'NON_PHI_BACKOFF',
  NON_PHI_ALLOCATION: 'NON_PHI_ALLOCATION',
  HARDCODED_TIMEOUT:  'HARDCODED_TIMEOUT',
  ARBITRARY_RETRY:    'ARBITRARY_RETRY',
});

/**
 * Enumeration of severity levels.
 * @enum {string}
 */
const Severity = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH:     'HIGH',
  MEDIUM:   'MEDIUM',
  LOW:      'LOW',
});

/**
 * Score deduction per severity (phi/Fibonacci-weighted).
 * @type {Object.<string, number>}
 */
const SCORE_DEDUCTIONS = Object.freeze({
  [Severity.CRITICAL]: fib(6),  // 8 points
  [Severity.HIGH]:     fib(5),  // 5 points
  [Severity.MEDIUM]:   fib(4),  // 3 points
  [Severity.LOW]:      fib(3),  // 2 points
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a numeric value is recognizably phi-derived.
 * A value is phi-derived if it is within `tolerance` of any value in
 * PHI_DERIVED_FLOATS, or is a safe integer (Fibonacci, 0, 1, 384, etc.).
 *
 * @param {number} value     - The number to test
 * @param {number} [tolerance=0.001] - Allowed delta from a known phi value
 * @returns {boolean} true if the value appears phi-derived
 */
function isPhiDerived(value, tolerance = 0.001) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return true; // non-numeric is not a violation

  // Integer check
  if (Number.isInteger(value)) {
    if (SAFE_INTEGERS.has(value)) return true;
    if (_isFibonacciImpl(Math.abs(value))) return true;
    return false;
  }

  // Float check — compare against all known phi-derived reference values
  for (const ref of PHI_DERIVED_FLOATS) {
    if (Math.abs(value - ref) <= tolerance) return true;
  }

  // Also check powers of PHI up to φ^8
  for (let n = 0; n <= 8; n++) {
    const phiPow = Math.pow(PHI, n);
    if (Math.abs(value - phiPow) <= tolerance) return true;
    if (Math.abs(value - (1 / phiPow)) <= tolerance) return true;
  }

  return false;
}

/**
 * Checks whether a value is a Fibonacci number (non-negative integer).
 *
 * @param {number} value - The value to test
 * @returns {boolean} true if value is a Fibonacci number
 */
function isFibonacci(value) {
  if (!Number.isInteger(value) || value < 0) return false;
  return _isFibonacciImpl(value);
}

/**
 * Checks whether an array of numbers follows the phi-backoff pattern.
 * Accepts arrays where each element ≈ previous × PHI, or matches the
 * canonical PHI_BACKOFF_SEQUENCE within a loose tolerance (5%).
 *
 * @param {number[]} arr - Array of numeric backoff values
 * @returns {boolean} true if the array follows phi-backoff pattern
 */
function isPhiBackoff(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return false;
  for (let i = 1; i < arr.length; i++) {
    const ratio = arr[i] / arr[i - 1];
    const delta = Math.abs(ratio - PHI);
    if (delta > 0.05 * PHI) return false; // allow 5% deviation
  }
  return true;
}

/**
 * Suggests the nearest phi-compliant replacement for a given floating-point value.
 * Returns the closest value from PHI_DERIVED_FLOATS plus common phi powers.
 *
 * @param {number} value - The non-compliant value
 * @returns {{ suggested: number, label: string }} Suggested replacement
 */
function suggestPhiReplacement(value) {
  const candidates = [
    ...PHI_DERIVED_FLOATS.map(v => ({ v, label: _phiValueLabel(v) })),
    ...Array.from({ length: 9 }, (_, n) => ({
      v: Math.pow(PHI, n),
      label: `PHI^${n}`,
    })),
  ];

  let bestDist = Infinity;
  let best = candidates[0];
  for (const cand of candidates) {
    const dist = Math.abs(value - cand.v);
    if (dist < bestDist) {
      bestDist = dist;
      best = cand;
    }
  }
  return { suggested: best.v, label: best.label };
}

/**
 * Suggests the nearest Fibonacci replacement for a given integer size.
 *
 * @param {number} value - The non-Fibonacci integer
 * @returns {{ suggested: number, label: string }} Suggested Fibonacci replacement
 */
function suggestFibReplacement(value) {
  const nearest = nearestFib(value);
  const idx = FIB_SEQUENCE.indexOf(nearest);
  return {
    suggested: nearest,
    label: idx >= 0 ? `fib(${idx})=${nearest}` : `≈${nearest}`,
  };
}

/**
 * Internal helper: produces a human-readable label for a known phi float.
 * @param {number} v - A phi-derived value
 * @returns {string} Human-readable label
 * @private
 */
function _phiValueLabel(v) {
  const roundTo = (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  if (Math.abs(v - PHI)    < 0.001) return 'PHI≈1.618';
  if (Math.abs(v - PSI)    < 0.001) return 'PSI≈0.618';
  if (Math.abs(v - PHI_SQ) < 0.001) return 'PHI_SQ≈2.618';
  if (Math.abs(v - PHI_CB) < 0.001) return 'PHI_CB≈4.236';
  for (const [name, tv] of Object.entries(CSL_THRESHOLDS)) {
    if (Math.abs(v - tv) < 0.001) return `CSL_THRESHOLDS.${name}≈${roundTo(tv, 3)}`;
  }
  return `≈${roundTo(v, 4)}`;
}

/**
 * Classifies the severity of a violation by type and contextual information.
 *
 * @param {string} type     - ViolationType value
 * @param {string} [context] - Optional context string (key name, path)
 * @returns {string} Severity level
 */
function classifySeverity(type, context = '') {
  switch (type) {
    case ViolationType.NON_PHI_THRESHOLD:
      return Severity.CRITICAL;
    case ViolationType.NON_PHI_BACKOFF:
    case ViolationType.ARBITRARY_RETRY:
    case ViolationType.NON_FIBONACCI_SIZE:
      return Severity.HIGH;
    case ViolationType.HARDCODED_TIMEOUT:
    case ViolationType.NON_PHI_ALLOCATION:
      return Severity.MEDIUM;
    case ViolationType.MAGIC_NUMBER:
    default:
      // A magic number in a threshold context is higher severity
      if (THRESHOLD_KEY_RE.test(context)) return Severity.HIGH;
      if (SIZE_KEY_RE.test(context))      return Severity.MEDIUM;
      return Severity.LOW;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PhiAuditReport CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AuditViolation
 * @property {string} type          - ViolationType value
 * @property {string} severity      - Severity level (CRITICAL|HIGH|MEDIUM|LOW)
 * @property {string} file          - Source file path
 * @property {string} path          - JSON path / code location (e.g. "config.cacheSize" or "line:42")
 * @property {number|string} currentValue  - The offending value found
 * @property {number|string} suggestedValue - Recommended phi-compliant replacement
 * @property {string} reason        - Human-readable explanation
 */

/**
 * Audit report produced by PhiComplianceValidator.
 * Contains all violations found, a compliance score, and formatting methods.
 */
class PhiAuditReport {
  /**
   * @param {string} filepath - The file that was audited
   */
  constructor(filepath) {
    /** @type {string} */
    this.filepath = filepath || '<unknown>';

    /** @type {AuditViolation[]} */
    this.violations = [];

    /** @type {number} Compliance score 0-100 (100 = fully phi-compliant) */
    this.score = 100;

    /** @type {{ total: number, critical: number, high: number, medium: number, low: number }} */
    this.summary = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

    /** @type {string} ISO timestamp of when the audit was run */
    this.auditedAt = new Date().toISOString();
  }

  /**
   * Adds a violation to the report and updates summary counts.
   *
   * @param {AuditViolation} violation - The violation to record
   * @returns {PhiAuditReport} this (for chaining)
   */
  addViolation(violation) {
    this.violations.push(violation);
    this.summary.total++;
    switch (violation.severity) {
      case Severity.CRITICAL: this.summary.critical++; break;
      case Severity.HIGH:     this.summary.high++;     break;
      case Severity.MEDIUM:   this.summary.medium++;   break;
      case Severity.LOW:      this.summary.low++;      break;
    }
    return this;
  }

  /**
   * Recalculates the compliance score based on current violations.
   * Uses phi-weighted (Fibonacci) deductions per severity level.
   * Minimum score is 0.
   *
   * @returns {number} Updated compliance score
   */
  recalculateScore() {
    let score = 100;
    for (const v of this.violations) {
      score -= (SCORE_DEDUCTIONS[v.severity] || 0);
    }
    this.score = Math.max(0, score);
    return this.score;
  }

  /**
   * Serialises the report to a plain JavaScript object.
   *
   * @returns {Object} JSON-serialisable report object
   */
  toJSON() {
    return {
      filepath:  this.filepath,
      auditedAt: this.auditedAt,
      score:     this.score,
      summary:   this.summary,
      violations: this.violations,
    };
  }

  /**
   * Returns a compact single-line string summary of the report.
   *
   * @returns {string} Human-readable one-liner
   */
  toString() {
    const { total, critical, high, medium, low } = this.summary;
    return (
      `[PhiAudit] ${path.basename(this.filepath)} | ` +
      `Score: ${this.score}/100 | ` +
      `Violations: ${total} (CRITICAL:${critical} HIGH:${high} MEDIUM:${medium} LOW:${low})`
    );
  }

  /**
   * Returns the report formatted as a Markdown string suitable for documentation
   * or pull-request comments.
   *
   * @returns {string} Markdown-formatted audit report
   */
  toMarkdown() {
    const lines = [];
    lines.push(`## Phi Compliance Audit: \`${this.filepath}\``);
    lines.push('');
    lines.push(`**Score:** ${this.score}/100 | **Audited:** ${this.auditedAt}`);
    lines.push('');

    const { total, critical, high, medium, low } = this.summary;
    lines.push('### Summary');
    lines.push('');
    lines.push(`| Severity | Count |`);
    lines.push(`|----------|-------|`);
    lines.push(`| CRITICAL | ${critical} |`);
    lines.push(`| HIGH     | ${high} |`);
    lines.push(`| MEDIUM   | ${medium} |`);
    lines.push(`| LOW      | ${low} |`);
    lines.push(`| **Total**| **${total}** |`);
    lines.push('');

    if (this.violations.length === 0) {
      lines.push('✓ No violations found. File is fully phi-compliant.');
      return lines.join('\n');
    }

    lines.push('### Violations');
    lines.push('');
    lines.push('| # | Severity | Type | Path | Current | Suggested | Reason |');
    lines.push('|---|----------|------|------|---------|-----------|--------|');

    this.violations.forEach((v, i) => {
      const cur  = String(v.currentValue).replace(/\|/g, '\\|');
      const sugg = String(v.suggestedValue).replace(/\|/g, '\\|');
      const rsn  = String(v.reason).replace(/\|/g, '\\|');
      lines.push(`| ${i + 1} | ${v.severity} | ${v.type} | \`${v.path}\` | \`${cur}\` | \`${sugg}\` | ${rsn} |`);
    });

    return lines.join('\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PhiComplianceValidator CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidatorOptions
 * @property {'strict'|'normal'|'lenient'} [strictness='normal'] - Audit strictness level
 * @property {string[]} [ignoredPaths=[]]                         - Glob-style paths to skip
 * @property {number}   [tolerance=0.001]                         - Float comparison tolerance
 * @property {boolean}  [checkAllIntegers=false]                  - Flag ALL non-Fibonacci integers (strict)
 * @property {boolean}  [verbose=false]                           - Emit extra diagnostic info
 */

/**
 * PhiComplianceValidator — audits Heady™ config and JS source files for phi compliance.
 *
 * Supports JSON, YAML (as plain object), and JavaScript source code.
 * Produces a `PhiAuditReport` per file, or a merged report for a whole directory.
 *
 * @example
 * const v = new PhiComplianceValidator({ strictness: 'strict' });
 * const report = v.validateJSON(myConfig, 'config/settings.json');
 * console.log(report.toMarkdown());
 */
class PhiComplianceValidator {
  /**
   * @param {ValidatorOptions} [options={}]
   */
  constructor(options = {}) {
    /** @type {'strict'|'normal'|'lenient'} */
    this.strictness = options.strictness || 'normal';

    /** @type {string[]} Paths / key patterns to skip during validation */
    this.ignoredPaths = Array.isArray(options.ignoredPaths) ? options.ignoredPaths : [];

    /** @type {number} Float comparison tolerance */
    this.tolerance = typeof options.tolerance === 'number' ? options.tolerance : 0.001;

    /** @type {boolean} If true, flag ALL non-Fibonacci integers (strict mode) */
    this.checkAllIntegers = this.strictness === 'strict'
      ? true
      : (options.checkAllIntegers || false);

    /** @type {boolean} Enable verbose diagnostic logging */
    this.verbose = options.verbose || false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Validates a parsed JSON object (or any plain JS object/array) for phi compliance.
   * Recursively traverses every key-value pair.
   *
   * @param {Object|Array} jsonObj  - Parsed configuration object
   * @param {string}       filepath - Source filepath for reporting
   * @returns {PhiAuditReport} Completed audit report
   */
  validateJSON(jsonObj, filepath) {
    const report = new PhiAuditReport(filepath);
    this._traverseObject(jsonObj, '', report, filepath);
    report.recalculateScore();
    return report;
  }

  /**
   * Validates a JavaScript source file's numeric literals.
   * Uses a regex-based AST-lite extraction strategy to find all number tokens,
   * then classifies each based on surrounding context.
   *
   * @param {string} sourceCode - Full JS source as a string
   * @param {string} filepath   - Source filepath for reporting
   * @returns {PhiAuditReport} Completed audit report
   */
  validateJSSource(sourceCode, filepath) {
    const report = new PhiAuditReport(filepath);
    this._scanJSSource(sourceCode, report, filepath);
    report.recalculateScore();
    return report;
  }

  /**
   * Validates a YAML configuration.
   * Accepts either a pre-parsed object (if you've already loaded yaml) or
   * a YAML string (requires 'js-yaml' to be available; falls back to best-effort
   * line scanning if the package is absent).
   *
   * @param {string|Object} yamlInput - YAML string or pre-parsed object
   * @param {string}        filepath  - Source filepath for reporting
   * @returns {PhiAuditReport} Completed audit report
   */
  validateYAML(yamlInput, filepath) {
    const report = new PhiAuditReport(filepath);

    let parsed = null;
    if (typeof yamlInput === 'object' && yamlInput !== null) {
      parsed = yamlInput;
    } else if (typeof yamlInput === 'string') {
      parsed = this._parseYAMLFallback(yamlInput, report, filepath);
    }

    if (parsed !== null) {
      this._traverseObject(parsed, '', report, filepath);
    }

    report.recalculateScore();
    return report;
  }

  /**
   * Recursively validates all supported files (*.json, *.js, *.yaml, *.yml)
   * in a directory tree, returning an array of PhiAuditReport objects.
   *
   * @param {string} directory - Absolute or relative directory path
   * @returns {PhiAuditReport[]} One report per file processed
   */
  validateAll(directory) {
    const reports = [];
    if (!fs.existsSync(directory)) {
      if (this.verbose) console.warn(`[PhiValidator] Directory not found: ${directory}`);
      return reports;
    }

    const walk = (dir) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        if (this.verbose) console.warn(`[PhiValidator] Cannot read dir: ${dir} — ${e.message}`);
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
          walk(full);
        } else if (entry.isFile()) {
          if (this._isIgnored(full)) continue;
          const ext = path.extname(entry.name).toLowerCase();
          try {
            if (ext === '.json') {
              const raw = fs.readFileSync(full, 'utf8');
              const parsed = JSON.parse(raw);
              reports.push(this.validateJSON(parsed, full));
            } else if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
              const src = fs.readFileSync(full, 'utf8');
              reports.push(this.validateJSSource(src, full));
            } else if (ext === '.yaml' || ext === '.yml') {
              const raw = fs.readFileSync(full, 'utf8');
              reports.push(this.validateYAML(raw, full));
            }
          } catch (e) {
            if (this.verbose) console.warn(`[PhiValidator] Failed to process ${full}: ${e.message}`);
          }
        }
      }
    };

    walk(path.resolve(directory));
    return reports;
  }

  /**
   * Computes the 0-100 compliance score for a given report.
   * This method can also be called on an already-scored report to re-verify.
   *
   * @param {PhiAuditReport} report - The report to score
   * @returns {number} Score in [0, 100]
   */
  score(report) {
    return report.recalculateScore();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — OBJECT TRAVERSAL (JSON / YAML)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Recursively traverses a plain object/array tree, inspecting every numeric value.
   *
   * @param {*}            node    - Current node
   * @param {string}       keyPath - Dot-notation path from root
   * @param {PhiAuditReport} report
   * @param {string}       filepath
   * @private
   */
  _traverseObject(node, keyPath, report, filepath) {
    if (this._isIgnored(keyPath)) return;

    if (Array.isArray(node)) {
      // Special-case: check if the whole array looks like a backoff sequence
      if (node.length >= 2 && node.every(v => typeof v === 'number')) {
        this._checkBackoffArray(node, keyPath, report, filepath);
      }
      node.forEach((item, idx) => this._traverseObject(item, `${keyPath}[${idx}]`, report, filepath));
      return;
    }

    if (node !== null && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        const childPath = keyPath ? `${keyPath}.${key}` : key;
        this._traverseObject(node[key], childPath, report, filepath);
      }
      return;
    }

    if (typeof node === 'number') {
      this._checkNumericValue(node, keyPath, report, filepath);
    }
  }

  /**
   * Inspects a single numeric value from a config object, classifying violations.
   *
   * @param {number}         value    - The numeric value
   * @param {string}         keyPath  - Dot-notation path key
   * @param {PhiAuditReport} report
   * @param {string}         filepath
   * @private
   */
  _checkNumericValue(value, keyPath, report, filepath) {
    if (!Number.isFinite(value)) return;
    if (value === 0 || value === 1) return; // always safe

    const key = keyPath.split('.').pop() || keyPath;

    // ── RETRY COUNT CHECK ────────────────────────────────────────────────────
    if (/\b(retries|maxRetries|retry_count|maxAttempts|attempts)\b/i.test(keyPath)) {
      if (Number.isInteger(value) && !isFibonacci(value)) {
        const { suggested, label } = suggestFibReplacement(value);
        report.addViolation({
          type:           ViolationType.ARBITRARY_RETRY,
          severity:       Severity.HIGH,
          file:           filepath,
          path:           keyPath,
          currentValue:   value,
          suggestedValue: suggested,
          reason:         `Retry count ${value} is not Fibonacci; use ${label}`,
        });
        return;
      }
    }

    // ── TIMEOUT CHECK ────────────────────────────────────────────────────────
    if (BACKOFF_KEY_RE.test(keyPath) && !THRESHOLD_KEY_RE.test(keyPath)) {
      if (Number.isInteger(value) && value > 0 && !this._isPhiTimeout(value)) {
        const suggested = this._nearestPhiTimeout(value);
        report.addViolation({
          type:           ViolationType.HARDCODED_TIMEOUT,
          severity:       Severity.MEDIUM,
          file:           filepath,
          path:           keyPath,
          currentValue:   value,
          suggestedValue: suggested,
          reason:         `Timeout/backoff ${value}ms not in phi sequence (φⁿ×1000); nearest phi timeout: ${suggested}ms`,
        });
        return;
      }
    }

    // ── THRESHOLD CHECK ──────────────────────────────────────────────────────
    if (!Number.isInteger(value) && THRESHOLD_KEY_RE.test(keyPath)) {
      if (value > 0 && value <= 1) {
        const match = NON_PHI_THRESHOLD_MAP.find(e => Math.abs(e.value - value) < 0.02);
        if (match && !isPhiDerived(value, this.tolerance)) {
          report.addViolation({
            type:           ViolationType.NON_PHI_THRESHOLD,
            severity:       Severity.CRITICAL,
            file:           filepath,
            path:           keyPath,
            currentValue:   value,
            suggestedValue: parseFloat(match.suggestion.toFixed(6)),
            reason:         `Threshold ${value} is a common magic number; replace with ${match.label}`,
          });
          return;
        }
      }
    }

    // ── ALLOCATION CHECK ─────────────────────────────────────────────────────
    if (!Number.isInteger(value) && ALLOCATION_KEY_RE.test(keyPath)) {
      if (value > 0 && value <= 1 && !isPhiDerived(value, this.tolerance)) {
        const { suggested, label } = suggestPhiReplacement(value);
        report.addViolation({
          type:           ViolationType.NON_PHI_ALLOCATION,
          severity:       Severity.MEDIUM,
          file:           filepath,
          path:           keyPath,
          currentValue:   value,
          suggestedValue: parseFloat(suggested.toFixed(6)),
          reason:         `Allocation/weight ${value} is not phi-derived; consider ${label}`,
        });
        return;
      }
    }

    // ── SIZE CHECK ───────────────────────────────────────────────────────────
    if (Number.isInteger(value) && value > 1 && SIZE_KEY_RE.test(keyPath)) {
      if (!isFibonacci(value) && COMMON_NON_FIB_SIZES.includes(value)) {
        const { suggested, label } = suggestFibReplacement(value);
        report.addViolation({
          type:           ViolationType.NON_FIBONACCI_SIZE,
          severity:       Severity.HIGH,
          file:           filepath,
          path:           keyPath,
          currentValue:   value,
          suggestedValue: suggested,
          reason:         `Size/capacity ${value} is not Fibonacci; use ${label}`,
        });
        return;
      }
    }

    // ── GENERAL MAGIC NUMBER CHECK ───────────────────────────────────────────
    if (!isPhiDerived(value, this.tolerance)) {
      const isIntViolation = Number.isInteger(value) && (
        this.checkAllIntegers
          ? !isFibonacci(value)
          : COMMON_NON_FIB_SIZES.includes(value)
      );
      const isFloatViolation = !Number.isInteger(value);

      if (isIntViolation || isFloatViolation) {
        const severity = classifySeverity(ViolationType.MAGIC_NUMBER, keyPath);
        let suggestedValue;
        let reason;

        if (Number.isInteger(value)) {
          const { suggested, label } = suggestFibReplacement(value);
          suggestedValue = suggested;
          reason = `Integer ${value} is not Fibonacci; nearest Fibonacci: ${label}`;
        } else {
          const { suggested, label } = suggestPhiReplacement(value);
          suggestedValue = parseFloat(suggested.toFixed(6));
          reason = `Float ${value} is not phi-derived; nearest phi value: ${label}`;
        }

        report.addViolation({
          type:           ViolationType.MAGIC_NUMBER,
          severity,
          file:           filepath,
          path:           keyPath,
          currentValue:   value,
          suggestedValue,
          reason,
        });
      }
    }
  }

  /**
   * Checks whether an array looks like a non-phi backoff sequence.
   *
   * @param {number[]}       arr
   * @param {string}         keyPath
   * @param {PhiAuditReport} report
   * @param {string}         filepath
   * @private
   */
  _checkBackoffArray(arr, keyPath, report, filepath) {
    if (!BACKOFF_KEY_RE.test(keyPath) && !ALLOCATION_KEY_RE.test(keyPath)) return;
    if (arr.length < 2) return;
    if (isPhiBackoff(arr)) return; // already phi-compliant

    // Offer a phi-scaled replacement starting from arr[0]
    const base = arr[0] > 0 ? arr[0] : 1000;
    const suggested = Array.from({ length: arr.length }, (_, n) =>
      Math.round(base * Math.pow(PHI, n))
    );

    report.addViolation({
      type:           ViolationType.NON_PHI_BACKOFF,
      severity:       Severity.HIGH,
      file:           filepath,
      path:           keyPath,
      currentValue:   JSON.stringify(arr),
      suggestedValue: JSON.stringify(suggested),
      reason:         `Backoff sequence ${JSON.stringify(arr)} does not follow φ-scaling; use ${JSON.stringify(suggested)}`,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — JS SOURCE SCANNING
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Scans JavaScript source code for non-phi numeric literals.
   * Strips comments and strings first to avoid false positives, then
   * extracts all numeric tokens with surrounding context.
   *
   * @param {string}         src
   * @param {PhiAuditReport} report
   * @param {string}         filepath
   * @private
   */
  _scanJSSource(src, report, filepath) {
    // Remove block comments /* ... */
    let clean = src.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
    // Remove line comments // ...
    clean = clean.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
    // Remove template literals and string literals (replace contents with spaces to keep offsets)
    clean = clean.replace(/`[^`]*`/g, (m) => '`' + ' '.repeat(m.length - 2) + '`');
    clean = clean.replace(/"(?:[^"\\]|\\.)*"/g, (m) => '"' + ' '.repeat(m.length - 2) + '"');
    clean = clean.replace(/'(?:[^'\\]|\\.)*'/g, (m) => "'" + ' '.repeat(m.length - 2) + "'");

    // Regex: match numeric literals (int, float, hex, scientific)
    // Excludes property access chains (.618 after a dot, which is a member expression)
    const numRe = /(?<![.\w])(-?\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b)/g;

    let match;
    const lines = src.split('\n');

    while ((match = numRe.exec(clean)) !== null) {
      const raw = match[1];
      const numVal = Number(raw);
      if (!Number.isFinite(numVal)) continue;
      if (numVal === 0 || numVal === 1 || numVal === -1) continue;

      // Find line number for this offset
      let offset = 0;
      let lineNum = 1;
      for (let i = 0; i < lines.length; i++) {
        if (offset + lines[i].length >= match.index) {
          lineNum = i + 1;
          break;
        }
        offset += lines[i].length + 1; // +1 for newline
      }

      // Extract surrounding context (the line itself)
      const lineText = lines[lineNum - 1] || '';
      const context  = lineText.trim();

      // Determine classification from context
      const violationType = this._classifyJSNumber(numVal, context, lineText);
      if (!violationType) continue; // phi-compliant

      const severity = classifySeverity(violationType, context);
      let suggestedValue;
      let reason;

      if (violationType === ViolationType.NON_PHI_THRESHOLD) {
        const entry = NON_PHI_THRESHOLD_MAP.find(e => Math.abs(e.value - numVal) < 0.02);
        suggestedValue = entry
          ? parseFloat(entry.suggestion.toFixed(6))
          : parseFloat(suggestPhiReplacement(numVal).suggested.toFixed(6));
        reason = `Threshold ${numVal} should be phi-derived (e.g. CSL_THRESHOLDS.* or phiThreshold())`;
      } else if (violationType === ViolationType.NON_FIBONACCI_SIZE) {
        const { suggested, label } = suggestFibReplacement(numVal);
        suggestedValue = suggested;
        reason = `Size ${numVal} is not Fibonacci; use ${label}`;
      } else if (violationType === ViolationType.HARDCODED_TIMEOUT) {
        suggestedValue = this._nearestPhiTimeout(numVal);
        reason = `Timeout ${numVal}ms not in phi sequence; nearest: ${suggestedValue}ms`;
      } else if (violationType === ViolationType.ARBITRARY_RETRY) {
        const { suggested, label } = suggestFibReplacement(numVal);
        suggestedValue = suggested;
        reason = `Retry count ${numVal} is not Fibonacci; use ${label}`;
      } else if (violationType === ViolationType.NON_PHI_ALLOCATION) {
        const { suggested, label } = suggestPhiReplacement(numVal);
        suggestedValue = parseFloat(suggested.toFixed(6));
        reason = `Allocation ${numVal} not phi-derived; consider ${label}`;
      } else {
        // MAGIC_NUMBER
        if (Number.isInteger(numVal)) {
          const { suggested, label } = suggestFibReplacement(numVal);
          suggestedValue = suggested;
          reason = `Magic integer ${numVal} not Fibonacci; nearest: ${label}`;
        } else {
          const { suggested, label } = suggestPhiReplacement(numVal);
          suggestedValue = parseFloat(suggested.toFixed(6));
          reason = `Magic float ${numVal} not phi-derived; nearest: ${label}`;
        }
      }

      report.addViolation({
        type:           violationType,
        severity,
        file:           filepath,
        path:           `line:${lineNum}`,
        currentValue:   numVal,
        suggestedValue,
        reason,
      });
    }
  }

  /**
   * Given a numeric value and surrounding JS source context, returns the
   * most specific ViolationType, or null if the value is phi-compliant.
   *
   * @param {number} value   - The numeric literal value
   * @param {string} context - Trimmed source line text
   * @param {string} line    - Raw source line
   * @returns {string|null} ViolationType or null
   * @private
   */
  _classifyJSNumber(value, context, line) {
    // First: is it acceptable?
    if (isPhiDerived(value, this.tolerance)) return null;
    if (value === 0 || value === 1 || value === -1) return null;
    if (SAFE_INTEGERS.has(value)) return null;

    // Retry count
    if (/\b(maxRetries|retries|retry_count|maxAttempts)\b/i.test(context)) {
      if (Number.isInteger(value) && !isFibonacci(value)) return ViolationType.ARBITRARY_RETRY;
    }

    // Timeout / backoff (ms values)
    if (BACKOFF_KEY_RE.test(context) && Number.isInteger(value) && value > 0) {
      if (!this._isPhiTimeout(value) && value >= 100) return ViolationType.HARDCODED_TIMEOUT;
    }

    // Threshold
    if (THRESHOLD_KEY_RE.test(context) && !Number.isInteger(value) && value > 0 && value <= 1) {
      const match = NON_PHI_THRESHOLD_MAP.find(e => Math.abs(e.value - value) < 0.02);
      if (match) return ViolationType.NON_PHI_THRESHOLD;
    }

    // Allocation / weight
    if (ALLOCATION_KEY_RE.test(context) && !Number.isInteger(value) && value > 0 && value < 1) {
      return ViolationType.NON_PHI_ALLOCATION;
    }

    // Size
    if (Number.isInteger(value) && SIZE_KEY_RE.test(context)) {
      if (!isFibonacci(value) && COMMON_NON_FIB_SIZES.includes(value)) {
        return ViolationType.NON_FIBONACCI_SIZE;
      }
    }

    // Generic magic number
    const isIntViolation = Number.isInteger(value) && (
      this.checkAllIntegers
        ? !isFibonacci(value)
        : COMMON_NON_FIB_SIZES.includes(Math.abs(value))
    );
    const isFloatViolation = !Number.isInteger(value);

    if (isIntViolation || isFloatViolation) return ViolationType.MAGIC_NUMBER;
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — YAML FALLBACK PARSER
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Best-effort YAML → plain object parser.
   * Tries to require 'js-yaml'; if unavailable, extracts `key: value` pairs
   * via regex to at least surface scalar numeric violations.
   *
   * @param {string}         yamlStr
   * @param {PhiAuditReport} report
   * @param {string}         filepath
   * @returns {Object|null} Parsed object or null on failure
   * @private
   */
  _parseYAMLFallback(yamlStr, report, filepath) {
    // Try js-yaml first
    try {
      // eslint-disable-next-line global-require
      const yaml = require('js-yaml');
      return yaml.load(yamlStr);
    } catch (_ignored) {
      // js-yaml not available — proceed with regex fallback
    }

    // Regex-based scalar extraction (handles simple flat and shallow-nested YAML)
    const result = {};
    const lineRe = /^(\s*)([\w.-]+)\s*:\s*(.+)\s*$/;
    for (const line of yamlStr.split('\n')) {
      const m = line.match(lineRe);
      if (!m) continue;
      const key = m[2].trim();
      const rawVal = m[3].trim();
      const num = parseFloat(rawVal);
      if (Number.isFinite(num) && String(num) === rawVal) {
        result[key] = num;
      } else if (rawVal === 'true')  {
        result[key] = true;
      } else if (rawVal === 'false') {
        result[key] = false;
      } else if (rawVal === 'null' || rawVal === '~') {
        result[key] = null;
      } else {
        result[key] = rawVal;
      }
    }
    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — PHI TIMEOUT HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Checks whether a millisecond value falls within 2% of any φⁿ×1000 value.
   *
   * @param {number} ms - Millisecond value
   * @returns {boolean}
   * @private
   */
  _isPhiTimeout(ms) {
    for (const t of PHI_BACKOFF_SEQUENCE) {
      if (Math.abs(ms - t) / t < 0.02) return true;
    }
    return false;
  }

  /**
   * Returns the nearest phi-sequence timeout to the given millisecond value.
   *
   * @param {number} ms - Millisecond value
   * @returns {number} Nearest phi timeout
   * @private
   */
  _nearestPhiTimeout(ms) {
    let best = PHI_BACKOFF_SEQUENCE[0];
    let bestDist = Math.abs(ms - best);
    for (const t of PHI_BACKOFF_SEQUENCE) {
      const dist = Math.abs(ms - t);
      if (dist < bestDist) { bestDist = dist; best = t; }
    }
    return best;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — PATH IGNORE CHECK
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns true if the given path or key should be skipped per ignoredPaths.
   *
   * @param {string} pathStr
   * @returns {boolean}
   * @private
   */
  _isIgnored(pathStr) {
    if (!pathStr || this.ignoredPaths.length === 0) return false;
    return this.ignoredPaths.some(pattern => {
      // Simple wildcard matching: * matches anything
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp(escaped).test(pathStr);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core classes
  PhiComplianceValidator,
  PhiAuditReport,

  // Violation type & severity enums
  ViolationType,
  Severity,
  SCORE_DEDUCTIONS,

  // Helper functions
  isPhiDerived,
  isFibonacci,
  isPhiBackoff,
  suggestPhiReplacement,
  suggestFibReplacement,

  // Re-exported phi-math aliases used in this module
  nearestFib,
  ceilFib,
  floorFib,

  // Derived constants
  FIBONACCI_POOLS,
  PHI_BACKOFF_SEQUENCE,

  // Phi core constants (convenience re-exports)
  PHI,
  PSI,
  PHI_SQ,
  PHI_CB,
};
