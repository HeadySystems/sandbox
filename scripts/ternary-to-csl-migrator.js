/**
 * @file ternary-to-csl-migrator.js
 * @description
 *   TernaryToCSLMigrator — Automated migration tool that scans JavaScript source
 *   files for discrete/ternary conditional logic and replaces it with phi-grounded
 *   Continuous Scalar Logic (CSL) equivalents from the Heady™ CSL engine.
 *
 *   Migration types handled:
 *     TYPE_A — String equality routing (if/switch on string literals)
 *              → replaced with SemanticRouter.route() cosine scoring
 *     TYPE_B — Numeric threshold comparisons (if (score > 0.5))
 *              → replaced with cslGate() phi-scaled thresholds
 *     TYPE_C — Guard clauses (if (!x) / if (err)) → PRESERVED, not migrated
 *     TYPE_D — Type checks (instanceof / typeof)  → PRESERVED, not migrated
 *
 * @copyright © 2026 Heady™Systems Inc. All rights reserved.
 *
 * @patent
 *   Protected under 60+ provisional patent applications filed with the USPTO covering
 *   automated ternary-to-CSL migration, phi-grounded threshold replacement, semantic
 *   routing injection, discrete logic audit, and related methods for autonomous
 *   trading, service routing, and decision orchestration systems.
 *
 * @module ternary-to-csl-migrator
 * @version 2.0.0
 * @since 1.0.0
 * @author HeadySystems Engineering
 *
 * @example <caption>Quick start</caption>
 * const { TernaryToCSLMigrator, AuditDiscreteLogic } = require('./ternary-to-csl-migrator');
 *
 * const auditor  = new AuditDiscreteLogic();
 * const report   = auditor.scanFile('/path/to/service.js');
 *
 * const migrator = new TernaryToCSLMigrator({ dryRun: true });
 * const plan     = migrator.generateMigrationPlan(report);
 * console.log(plan);
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ---------------------------------------------------------------------------
// PHI CONSTANTS — derived from φ = 1.6180339887
// ---------------------------------------------------------------------------

/** @constant {number} PHI — Golden ratio φ */
const PHI = 1.6180339887;

/** @constant {number} PSI — Reciprocal 1/φ ≈ 0.6180339887 */
const PSI = 1 / PHI;

/** @constant {number} PSI_SQ — PSI² ≈ 0.3819660113 */
const PSI_SQ = PSI * PSI;

/** @constant {number} PSI_CUBE — PSI³ ≈ 0.2360679775 */
const PSI_CUBE = PSI * PSI * PSI;

/** @constant {number} PHI_SQ — φ² ≈ 2.6180339887 */
const PHI_SQ = PHI + 1;

// ---------------------------------------------------------------------------
// MIGRATION TYPE CONSTANTS
// ---------------------------------------------------------------------------

/**
 * @constant {Readonly<Object>} MIGRATION_TYPES
 * @description Classification labels for detected conditional patterns.
 */
const MIGRATION_TYPES = Object.freeze({
  TYPE_A: 'TYPE_A', // String equality routing
  TYPE_B: 'TYPE_B', // Numeric threshold comparison
  TYPE_C: 'TYPE_C', // Guard clause — DO NOT migrate
  TYPE_D: 'TYPE_D', // Type check   — DO NOT migrate
});

/**
 * @constant {Readonly<Object>} SEVERITY
 * @description Severity levels assigned to migration findings.
 *   CRITICAL = must migrate (tight hard-coded threshold, routing hazard)
 *   HIGH     = should migrate (moderate risk)
 *   MEDIUM   = consider migration
 *   LOW      = informational, guard/type preserved
 */
const SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH:     'HIGH',
  MEDIUM:   'MEDIUM',
  LOW:      'LOW',
  INFO:     'INFO',
});

/**
 * @constant {Readonly<Object>} PRIORITY_WEIGHTS
 * @description Score multipliers used to rank findings in the migration plan.
 *   TYPE_A × 3, TYPE_B × 2, TYPE_C/D × 0 (preserved, not prioritised).
 */
const PRIORITY_WEIGHTS = Object.freeze({
  TYPE_A: 3,
  TYPE_B: 2,
  TYPE_C: 0,
  TYPE_D: 0,
});

// ---------------------------------------------------------------------------
// REGEX PATTERNS
// ---------------------------------------------------------------------------

/**
 * @constant {Readonly<Object>} PATTERNS
 * @description Compiled regex patterns for each migration type.
 *   Each pattern uses named capture groups for structured extraction.
 */
const PATTERNS = Object.freeze({
  // TYPE_A — string equality in if conditions
  // Matches: if (x === 'value') or if (x == 'value') or if ('value' === x)
  TYPE_A_IF: /\bif\s*\(\s*(?<lhs>\w[\w.]*)\s*={2,3}\s*(?<val>'[^']*'|"[^"]*")\s*\)/g,
  TYPE_A_IF_REV: /\bif\s*\(\s*(?<val>'[^']*'|"[^"]*")\s*={2,3}\s*(?<lhs>\w[\w.]*)\s*\)/g,

  // TYPE_A — switch(x) { case 'value': ...
  // Matches: switch (variable) { and extracts string cases
  TYPE_A_SWITCH: /\bswitch\s*\(\s*(?<switchVar>\w[\w.]*)\s*\)\s*\{(?<body>[^}]*(?:\{[^}]*\}[^}]*)*)\}/gs,
  TYPE_A_CASE:   /\bcase\s+(?<caseLit>'[^']*'|"[^"]*")\s*:/g,

  // TYPE_B — numeric threshold comparisons
  // Matches: if (score > 0.5) / if (x >= threshold) / if (value < 0.5)
  TYPE_B_NUMERIC: /\bif\s*\(\s*(?<lhs>\w[\w.]*)\s*(?<op>[<>]=?)\s*(?<rhs>\d+(?:\.\d+)?)\s*\)/g,
  TYPE_B_VAR:     /\bif\s*\(\s*(?<lhs>\w[\w.]*)\s*(?<op>[<>]=?)\s*(?<rhs>\w[\w.]*(?:threshold|score|limit|cutoff|level)\w*)\s*\)/gi,

  // TYPE_C — guard clauses — PRESERVE
  // if (!x) / if (err) / if (null) / if (undefined) / if (!flag) / if (condition) (simple ident)
  TYPE_C_GUARD: /\bif\s*\(\s*!?\s*(?:err(?:or)?|null|undefined|e\b|exception|\w+Error|\w+Flag)\s*\)/g,
  TYPE_C_NEGATION: /\bif\s*\(\s*!\s*\w[\w.]*\s*\)/g,
  TYPE_C_TRUTHY:   /\bif\s*\(\s*(?:err|error|exception)\s*\)/g,

  // TYPE_D — type checks — PRESERVE
  // if (x instanceof Y) / if (typeof x === 'string')
  TYPE_D_INSTANCEOF: /\bif\s*\(\s*\w[\w.]*\s+instanceof\s+\w[\w.]*\s*\)/g,
  TYPE_D_TYPEOF:     /\bif\s*\(\s*typeof\s+\w[\w.]*\s*={2,3}\s*'[a-z]+'\s*\)/g,
  TYPE_D_TYPEOF_NEQ: /\bif\s*\(\s*typeof\s+\w[\w.]*\s*!={1,2}\s*'[a-z]+'\s*\)/g,
});

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 of a string for backup file naming and change detection.
 * @param {string} content
 * @returns {string} 16-char hex prefix
 */
const hashContent = (content) =>
  crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

/**
 * Generate a unified diff (simplified line-by-line) between two strings.
 * Produces standard +/- unified diff format without external dependencies.
 *
 * @param {string} original
 * @param {string} modified
 * @param {string} filename
 * @returns {string} Diff text
 */
function unifiedDiff(original, modified, filename) {
  const origLines = original.split('\n');
  const modLines  = modified.split('\n');
  const header = [
    `--- a/${filename}`,
    `+++ b/${filename}`,
  ];

  const hunks = [];
  const maxLen = Math.max(origLines.length, modLines.length);

  let i = 0;
  while (i < maxLen) {
    const origLine = i < origLines.length ? origLines[i] : null;
    const modLine  = i < modLines.length  ? modLines[i]  : null;

    if (origLine !== modLine) {
      // Find extent of this hunk (up to 3 lines context)
      const hunkStart = Math.max(0, i - 3);
      let hunkEnd = i;
      while (hunkEnd < maxLen) {
        const oL = hunkEnd < origLines.length ? origLines[hunkEnd] : null;
        const mL = hunkEnd < modLines.length  ? modLines[hunkEnd]  : null;
        if (oL === mL) {
          // Count consecutive matching lines
          let same = 0;
          let j = hunkEnd;
          while (j < maxLen &&
            (j < origLines.length ? origLines[j] : null) ===
            (j < modLines.length  ? modLines[j]  : null)
          ) { same++; j++; }
          if (same >= 6) break; // stop hunk after 6 identical lines
        }
        hunkEnd++;
      }
      hunkEnd = Math.min(hunkEnd + 3, maxLen);

      const origCount = Math.min(hunkEnd, origLines.length) - hunkStart;
      const modCount  = Math.min(hunkEnd, modLines.length)  - hunkStart;
      const hunkHeader = `@@ -${hunkStart + 1},${origCount} +${hunkStart + 1},${modCount} @@`;

      const hunkLines = [hunkHeader];
      for (let k = hunkStart; k < hunkEnd; k++) {
        const oLine = k < origLines.length ? origLines[k] : null;
        const mLine = k < modLines.length  ? modLines[k]  : null;
        if (oLine === mLine) {
          hunkLines.push(` ${oLine !== null ? oLine : ''}`);
        } else {
          if (oLine !== null) hunkLines.push(`-${oLine}`);
          if (mLine !== null) hunkLines.push(`+${mLine}`);
        }
      }
      hunks.push(hunkLines.join('\n'));
      i = hunkEnd;
    } else {
      i++;
    }
  }

  if (hunks.length === 0) return `(no changes — ${filename})`;
  return [...header, ...hunks].join('\n');
}

/**
 * Get the line and column number of a match index within a string.
 * @param {string} source
 * @param {number} index
 * @returns {{ line: number, column: number }}
 */
function indexToLineCol(source, index) {
  const before = source.slice(0, index);
  const lines  = before.split('\n');
  return {
    line:   lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * Extract a snippet (single line) from source at the given index.
 * @param {string} source
 * @param {number} index
 * @returns {string}
 */
function snippetAt(source, index) {
  const start = source.lastIndexOf('\n', index) + 1;
  const end   = source.indexOf('\n', index);
  return (end === -1 ? source.slice(start) : source.slice(start, end)).trim();
}

// ---------------------------------------------------------------------------
// CLASS: AuditDiscreteLogic
// ---------------------------------------------------------------------------

/**
 * @class AuditDiscreteLogic
 * @description
 *   Scans JavaScript source files for discrete conditional patterns (hard-coded
 *   string routing, numeric thresholds, guard clauses, type checks) and returns
 *   structured findings with type, location, snippet, and severity.
 *
 * @example
 * const auditor  = new AuditDiscreteLogic();
 * const findings = auditor.scanFile('./services/router.js');
 * console.log(findings.summary);
 */
class AuditDiscreteLogic {
  /**
   * @constructor
   * @param {Object} [options={}]
   * @param {number} [options.maxSnippetLength=120] — Truncate snippets to this length
   * @param {boolean} [options.includePreserved=true] — Include TYPE_C/D in results
   */
  constructor(options = {}) {
    this._maxSnippetLen   = options.maxSnippetLength   !== undefined ? options.maxSnippetLength   : 120;
    this._includePreserved = options.includePreserved  !== undefined ? options.includePreserved   : true;
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------------

  /**
   * Record a finding if the match position is not already covered by a
   * higher-priority preserved pattern.
   * @private
   */
  _mkFinding(source, match, type, severity, suggestion) {
    const { line, column } = indexToLineCol(source, match.index);
    const raw = snippetAt(source, match.index);
    return {
      type,
      severity,
      line,
      column,
      original: raw.length > this._maxSnippetLen
        ? raw.slice(0, this._maxSnippetLen) + '…'
        : raw,
      matchText:  match[0],
      index:      match.index,
      suggestion: suggestion || null,
    };
  }

  /**
   * Collect all non-overlapping match positions for a set of patterns that
   * represent PRESERVED patterns (TYPE_C / TYPE_D). Returns a Set of indices.
   * @private
   */
  _preservedIndices(source) {
    const preserved = new Set();
    const checkPatterns = [
      PATTERNS.TYPE_C_GUARD,
      PATTERNS.TYPE_C_NEGATION,
      PATTERNS.TYPE_C_TRUTHY,
      PATTERNS.TYPE_D_INSTANCEOF,
      PATTERNS.TYPE_D_TYPEOF,
      PATTERNS.TYPE_D_TYPEOF_NEQ,
    ];
    for (const pat of checkPatterns) {
      const cloned = new RegExp(pat.source, pat.flags);
      let m;
      while ((m = cloned.exec(source)) !== null) {
        // Mark every character position in this match as preserved
        for (let i = m.index; i < m.index + m[0].length; i++) {
          preserved.add(i);
        }
      }
    }
    return preserved;
  }

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

  /**
   * @method scanFile
   * @description
   *   Reads a JavaScript file and scans it for all migration-relevant patterns.
   *   Returns a structured audit report.
   *
   * @param {string} filePath — Absolute or relative path to a .js file
   * @returns {AuditReport}
   *
   * @typedef {Object} AuditReport
   * @property {string}    filePath        — Resolved file path
   * @property {string}    fileHash        — SHA-256 (16 hex chars) of original content
   * @property {number}    totalLines
   * @property {Finding[]} findings        — All detected patterns
   * @property {Object}    summary         — Counts by type and severity
   * @property {number}    priorityScore   — Weighted priority (TYPE_A×3 + TYPE_B×2)
   * @property {string}    scannedAt       — ISO timestamp
   *
   * @typedef {Object} Finding
   * @property {string} type        — MIGRATION_TYPES value
   * @property {string} severity    — SEVERITY value
   * @property {number} line        — 1-based line number
   * @property {number} column      — 1-based column number
   * @property {string} original    — Source snippet
   * @property {string} matchText   — Exact regex match
   * @property {number} index       — Character offset in source
   * @property {string} suggestion  — Human-readable migration suggestion
   *
   * @example
   * const report = auditor.scanFile('./src/handler.js');
   * report.findings.filter(f => f.type === 'TYPE_B').forEach(f => {
   *   console.log(`Line ${f.line}: ${f.original}`);
   * });
   */
  scanFile(filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`AuditDiscreteLogic: file not found — ${resolved}`);
    }
    const source     = fs.readFileSync(resolved, 'utf8');
    const findings   = this.scanSource(source, filePath);
    const totalLines = source.split('\n').length;
    const fileHash   = hashContent(source);

    const summary = {
      TYPE_A: 0, TYPE_B: 0, TYPE_C: 0, TYPE_D: 0,
      CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
    };
    for (const f of findings) {
      if (summary[f.type]     !== undefined) summary[f.type]++;
      if (summary[f.severity] !== undefined) summary[f.severity]++;
    }

    const priorityScore =
      summary.TYPE_A * PRIORITY_WEIGHTS.TYPE_A +
      summary.TYPE_B * PRIORITY_WEIGHTS.TYPE_B;

    return {
      filePath:     resolved,
      fileHash,
      totalLines,
      findings,
      summary,
      priorityScore,
      scannedAt: new Date().toISOString(),
    };
  }

  /**
   * @method scanSource
   * @description
   *   Scans a source string (no file I/O). Useful for in-memory analysis
   *   or testing without touching the filesystem.
   *
   * @param {string} source   — JavaScript source text
   * @param {string} [label='<source>'] — Identifier used in findings
   * @returns {Finding[]}
   */
  scanSource(source, label = '<source>') {
    const findings = [];
    const preserved = this._preservedIndices(source);

    // ---- TYPE_C: Guard clauses (collect & optionally report) ----
    const cPatterns = [
      { pat: PATTERNS.TYPE_C_GUARD,    sev: SEVERITY.INFO },
      { pat: PATTERNS.TYPE_C_NEGATION, sev: SEVERITY.INFO },
      { pat: PATTERNS.TYPE_C_TRUTHY,   sev: SEVERITY.INFO },
    ];
    if (this._includePreserved) {
      for (const { pat, sev } of cPatterns) {
        const cloned = new RegExp(pat.source, pat.flags);
        let m;
        while ((m = cloned.exec(source)) !== null) {
          findings.push(this._mkFinding(source, m, MIGRATION_TYPES.TYPE_C, sev,
            'Guard clause — PRESERVED. Do not migrate.'));
        }
      }
    }

    // ---- TYPE_D: Type checks (collect & optionally report) ----
    const dPatterns = [
      PATTERNS.TYPE_D_INSTANCEOF,
      PATTERNS.TYPE_D_TYPEOF,
      PATTERNS.TYPE_D_TYPEOF_NEQ,
    ];
    if (this._includePreserved) {
      for (const pat of dPatterns) {
        const cloned = new RegExp(pat.source, pat.flags);
        let m;
        while ((m = cloned.exec(source)) !== null) {
          findings.push(this._mkFinding(source, m, MIGRATION_TYPES.TYPE_D, SEVERITY.INFO,
            'Type check — PRESERVED. Do not migrate.'));
        }
      }
    }

    // ---- TYPE_A: String equality in if conditions ----
    const typeAPatterns = [
      { pat: PATTERNS.TYPE_A_IF,     labelVar: 'lhs', labelVal: 'val' },
      { pat: PATTERNS.TYPE_A_IF_REV, labelVar: 'lhs', labelVal: 'val' },
    ];
    for (const { pat, labelVar } of typeAPatterns) {
      const cloned = new RegExp(pat.source, pat.flags);
      let m;
      while ((m = cloned.exec(source)) !== null) {
        if (preserved.has(m.index)) continue;
        const varName = m.groups ? m.groups[labelVar] : '?';
        const valStr  = m.groups ? m.groups.val        : '?';
        findings.push(this._mkFinding(source, m, MIGRATION_TYPES.TYPE_A, SEVERITY.HIGH,
          `Replace string equality on '${varName}' with ` +
          `SemanticRouter.route(${varName}) — cosine-scored routing eliminates hard-coded dispatch to ${valStr}`
        ));
      }
    }

    // TYPE_A — switch statements with string cases
    {
      const cloned = new RegExp(PATTERNS.TYPE_A_SWITCH.source, PATTERNS.TYPE_A_SWITCH.flags);
      let m;
      while ((m = cloned.exec(source)) !== null) {
        if (preserved.has(m.index)) continue;
        const switchVar = m.groups ? m.groups.switchVar : '?';
        const body      = m.groups ? m.groups.body       : '';
        // Count string cases
        const caseClone = new RegExp(PATTERNS.TYPE_A_CASE.source, PATTERNS.TYPE_A_CASE.flags);
        let caseMatch;
        let caseCount = 0;
        while ((caseMatch = caseClone.exec(body)) !== null) caseCount++;
        if (caseCount > 0) {
          findings.push(this._mkFinding(source, m, MIGRATION_TYPES.TYPE_A, SEVERITY.CRITICAL,
            `Replace switch(${switchVar}) with ${caseCount} string cases via ` +
            `SemanticRouter.route(${switchVar}) — eliminates brittle string-dispatch`
          ));
        }
      }
    }

    // ---- TYPE_B: Numeric threshold comparisons ----
    {
      const cloned = new RegExp(PATTERNS.TYPE_B_NUMERIC.source, PATTERNS.TYPE_B_NUMERIC.flags);
      let m;
      while ((m = cloned.exec(source)) !== null) {
        if (preserved.has(m.index)) continue;
        const lhs = m.groups ? m.groups.lhs : '?';
        const op  = m.groups ? m.groups.op  : '?';
        const rhs = m.groups ? m.groups.rhs : '?';
        const numericVal = parseFloat(rhs);
        let severity = SEVERITY.MEDIUM;
        // Thresholds near 0.5 are higher-risk hard-codes
        if (!isNaN(numericVal) && numericVal >= 0.3 && numericVal <= 0.7) {
          severity = SEVERITY.HIGH;
        }
        findings.push(this._mkFinding(source, m, MIGRATION_TYPES.TYPE_B, severity,
          `Replace hard threshold '${lhs} ${op} ${rhs}' with ` +
          `cslGate(${lhs}) — phi threshold PSI ≈ 0.618 replaces ${rhs}`
        ));
      }
    }
    {
      const cloned = new RegExp(PATTERNS.TYPE_B_VAR.source, PATTERNS.TYPE_B_VAR.flags);
      let m;
      while ((m = cloned.exec(source)) !== null) {
        if (preserved.has(m.index)) continue;
        const lhs = m.groups ? m.groups.lhs : '?';
        const op  = m.groups ? m.groups.op  : '?';
        const rhs = m.groups ? m.groups.rhs : '?';
        findings.push(this._mkFinding(source, m, MIGRATION_TYPES.TYPE_B, SEVERITY.MEDIUM,
          `Replace variable threshold '${lhs} ${op} ${rhs}' with ` +
          `cslGate(${lhs}) — phi-grounded soft gate`
        ));
      }
    }

    // De-duplicate by index (keep first found per position)
    const seen   = new Set();
    const unique = [];
    for (const f of findings) {
      const key = `${f.type}:${f.index}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(f);
      }
    }

    // Sort by line, then column
    unique.sort((a, b) => a.line !== b.line ? a.line - b.line : a.column - b.column);
    return unique;
  }
}

// ---------------------------------------------------------------------------
// CLASS: TernaryToCSLMigrator
// ---------------------------------------------------------------------------

/**
 * @class TernaryToCSLMigrator
 * @extends EventEmitter
 * @description
 *   Automated migrator that transforms discrete conditional logic in JavaScript
 *   source files into phi-grounded Continuous Scalar Logic (CSL) equivalents.
 *
 *   Workflow:
 *     1. `scanFile(filePath)`         — Detect migration candidates
 *     2. `generateMigrationPlan()`    — Rank files by priority score
 *     3. `migrateFile(filePath, ...)`  — Apply transformations (or dry-run)
 *     4. `generateDiff()`             — Inspect before/after
 *     5. `trackProgress()`            — Monitor completion
 *     6. `rollback(filePath)`         — Restore from backup
 *
 * @example <caption>Dry run on a single file</caption>
 * const migrator = new TernaryToCSLMigrator({ dryRun: true });
 * const auditor  = new AuditDiscreteLogic();
 * const report   = auditor.scanFile('./src/router.js');
 * const result   = migrator.migrateFile('./src/router.js', report.findings);
 * console.log(result.diff);
 *
 * @example <caption>TYPE_A migration before/after</caption>
 * // BEFORE: if (cmd === 'deploy') { doDeployment(); }
 * // AFTER:  // [CSL-MIGRATED] SemanticRouter replaces string equality
 * //         const _result = semanticRouter.route(cmd); // cosine-scored routing
 * //         if (_result.topMatch === 'deploy') { doDeployment(); }
 *
 * @example <caption>TYPE_B migration before/after</caption>
 * // BEFORE: if (score > 0.5) { activateFeature(); }
 * // AFTER:  // [CSL-MIGRATED] soft_gate replaces hard threshold
 * //         const _gate = cslGate(score); // phi threshold ≈ 0.618
 * //         if (_gate.execute) { activateFeature(); }
 */
class TernaryToCSLMigrator extends EventEmitter {
  /**
   * @constructor
   * @param {Object}  [options={}]
   * @param {boolean} [options.dryRun=true]         — If true, no files are written
   * @param {boolean} [options.createBackup=true]   — Create .bak files before writing
   * @param {string}  [options.backupSuffix='.csl-bak'] — Suffix appended to backup files
   * @param {boolean} [options.verbose=false]        — Emit detailed events
   * @param {string}  [options.cslImportPath='../core/csl-engine/csl-engine-enhanced']
   *                  — Import path injected into migrated files
   * @param {string}  [options.routerImportPath='../core/semantic-router/semantic-router']
   *                  — Import path for SemanticRouter injected into migrated files
   */
  constructor(options = {}) {
    super();
    this._dryRun          = options.dryRun          !== undefined ? Boolean(options.dryRun)      : true;
    this._createBackup    = options.createBackup     !== undefined ? Boolean(options.createBackup): true;
    this._backupSuffix    = options.backupSuffix     || '.csl-bak';
    this._verbose         = options.verbose          !== undefined ? Boolean(options.verbose)     : false;
    this._cslImportPath   = options.cslImportPath    || '../core/csl-engine/csl-engine-enhanced';
    this._routerImportPath = options.routerImportPath || '../core/semantic-router/semantic-router';

    /** @type {Map<string, string>} filePath → original content (for rollback) */
    this._backupStore = new Map();

    /** @type {AuditDiscreteLogic} */
    this._auditor = new AuditDiscreteLogic();
  }

  // -------------------------------------------------------------------------
  // PRIVATE
  // -------------------------------------------------------------------------

  /**
   * Emit verbose event if enabled.
   * @private
   */
  _log(event, data) {
    if (this._verbose) this.emit(event, data);
  }

  /**
   * Build the CSL import header lines to inject at the top of migrated files.
   * @private
   * @returns {string}
   */
  _buildImportHeader() {
    return [
      `// [CSL-MIGRATED] Auto-generated imports — HeadySystems CSL Engine`,
      `const { CSLScalarEngine, createCSLEngine, PSI } = require('${this._cslImportPath}');`,
      `const SemanticRouter = require('${this._routerImportPath}');`,
      `const _cslEngine = createCSLEngine();`,
      `const _semanticRouter = new SemanticRouter();`,
      `// PSI (phi-reciprocal) ≈ ${(1 / 1.6180339887).toFixed(10)} — used as default gate threshold`,
    ].join('\n');
  }

  /**
   * Apply TYPE_A replacement: string-equality if → SemanticRouter.route()
   * @private
   */
  _applyTypeAIfTransform(source) {
    let out = source;

    // if (x === 'value') → SemanticRouter routing
    const patA = new RegExp(PATTERNS.TYPE_A_IF.source, PATTERNS.TYPE_A_IF.flags);
    out = out.replace(patA, (full, ...args) => {
      const groups = args[args.length - 1];
      if (!groups) return full;
      const { lhs, val } = groups;
      return (
        `// [CSL-MIGRATED] SemanticRouter replaces string equality\n` +
        `const _result = _semanticRouter.route(${lhs}); // cosine-scored routing\n` +
        `if (_result.topMatch === ${val})`
      );
    });

    // if ('value' === x) — reversed form
    const patAR = new RegExp(PATTERNS.TYPE_A_IF_REV.source, PATTERNS.TYPE_A_IF_REV.flags);
    out = out.replace(patAR, (full, ...args) => {
      const groups = args[args.length - 1];
      if (!groups) return full;
      const { lhs, val } = groups;
      return (
        `// [CSL-MIGRATED] SemanticRouter replaces string equality\n` +
        `const _result = _semanticRouter.route(${lhs}); // cosine-scored routing\n` +
        `if (_result.topMatch === ${val})`
      );
    });

    return out;
  }

  /**
   * Apply TYPE_A replacement for switch statements.
   * @private
   */
  _applyTypeASwitchTransform(source) {
    const cloned = new RegExp(PATTERNS.TYPE_A_SWITCH.source, PATTERNS.TYPE_A_SWITCH.flags);
    return source.replace(cloned, (full, ...args) => {
      const groups = args[args.length - 1];
      if (!groups) return full;
      const { switchVar, body } = groups;

      // Check if body actually has string cases
      const caseClone = new RegExp(PATTERNS.TYPE_A_CASE.source, PATTERNS.TYPE_A_CASE.flags);
      let hasCases = false;
      let cm;
      while ((cm = caseClone.exec(body)) !== null) { hasCases = true; break; }
      if (!hasCases) return full;

      return (
        `// [CSL-MIGRATED] SemanticRouter replaces switch string routing\n` +
        `const _routeResult = _semanticRouter.route(${switchVar}); // cosine-scored routing\n` +
        `switch (_routeResult.topMatch) {${body}}`
      );
    });
  }

  /**
   * Apply TYPE_B replacement: numeric threshold → cslGate()
   * @private
   */
  _applyTypeBTransform(source) {
    let out = source;

    const cloned = new RegExp(PATTERNS.TYPE_B_NUMERIC.source, PATTERNS.TYPE_B_NUMERIC.flags);
    out = out.replace(cloned, (full, ...args) => {
      const groups = args[args.length - 1];
      if (!groups) return full;
      const { lhs, op, rhs } = groups;
      const numericVal = parseFloat(rhs);
      const psiLabel   = isNaN(numericVal) ? 'PSI' : `PSI /* ≈ 0.618, replaces ${rhs} */`;

      // Determine gate condition based on operator direction
      const gateCondition = op.startsWith('>') ? '_gate.execute' : '!_gate.execute';

      return (
        `// [CSL-MIGRATED] soft_gate replaces hard threshold\n` +
        `const _gate = _cslEngine.cslGate(${lhs}); // phi threshold ≈ 0.618\n` +
        `if (${gateCondition})`
      );
    });

    return out;
  }

  /**
   * Inject CSL import header if not already present.
   * @private
   */
  _injectImports(source) {
    if (source.includes('[CSL-MIGRATED] Auto-generated imports')) return source;
    const useStrictMatch = source.match(/^'use strict';\n?/m);
    if (useStrictMatch) {
      const insertAt = useStrictMatch.index + useStrictMatch[0].length;
      return (
        source.slice(0, insertAt) +
        '\n' + this._buildImportHeader() + '\n\n' +
        source.slice(insertAt)
      );
    }
    return this._buildImportHeader() + '\n\n' + source;
  }

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

  /**
   * @method scanFile
   * @description
   *   Convenience wrapper: scans a file via AuditDiscreteLogic and returns
   *   the full audit report.
   *
   * @param {string} filePath
   * @returns {AuditReport}
   *
   * @example
   * const report = migrator.scanFile('./src/service.js');
   * console.log(report.summary);
   */
  scanFile(filePath) {
    return this._auditor.scanFile(filePath);
  }

  /**
   * @method migrateFile
   * @description
   *   Applies CSL transformations to a JavaScript file.
   *   TYPE_A and TYPE_B findings are migrated; TYPE_C and TYPE_D are skipped.
   *
   *   In dryRun mode (default), the file on disk is NOT modified. The return
   *   value includes the fully-transformed content and a unified diff for review.
   *
   *   In non-dry-run mode:
   *     1. A backup is created (if createBackup=true)
   *     2. The transformed content is written to disk
   *     3. The original content is stored for rollback
   *
   * @param {string}    filePath  — Path to the file to migrate
   * @param {Finding[]} [findings] — Pre-computed findings (uses scanFile if omitted)
   * @returns {MigrationResult}
   *
   * @typedef {Object} MigrationResult
   * @property {string}   filePath     — Resolved path
   * @property {boolean}  dryRun       — Whether changes were actually written
   * @property {string}   original     — Original source text
   * @property {string}   migrated     — Transformed source text
   * @property {string}   diff         — Unified diff (--- before / +++ after)
   * @property {number}   changesCount — Number of transformation sites applied
   * @property {string[]} migratedTypes — Which types were transformed
   * @property {string}   backupPath   — Path of backup file (if created)
   * @property {string}   migratedAt   — ISO timestamp
   *
   * @example
   * // BEFORE: if (cmd === 'deploy') { doDeployment(); }
   * // AFTER:  // [CSL-MIGRATED] SemanticRouter replaces string equality
   * //         const _result = semanticRouter.route(cmd); // cosine-scored routing
   * //         if (_result.topMatch === 'deploy') { doDeployment(); }
   *
   * @example
   * // BEFORE: if (score > 0.5) { activateFeature(); }
   * // AFTER:  // [CSL-MIGRATED] soft_gate replaces hard threshold
   * //         const _gate = cslGate(score); // phi threshold ≈ 0.618
   * //         if (_gate.execute) { activateFeature(); }
   */
  migrateFile(filePath, findings) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`TernaryToCSLMigrator: file not found — ${resolved}`);
    }

    const original = fs.readFileSync(resolved, 'utf8');

    // Use provided findings or scan now
    if (!findings) {
      const report = this._auditor.scanFile(resolved);
      findings = report.findings;
    }

    const migratedTypes = [];
    const hasTypeA = findings.some(f => f.type === MIGRATION_TYPES.TYPE_A);
    const hasTypeB = findings.some(f => f.type === MIGRATION_TYPES.TYPE_B);

    let migrated = original;

    // Apply transforms in order: TYPE_A switch before TYPE_A if, then TYPE_B
    if (hasTypeA) {
      migrated = this._applyTypeASwitchTransform(migrated);
      migrated = this._applyTypeAIfTransform(migrated);
      migratedTypes.push(MIGRATION_TYPES.TYPE_A);
    }
    if (hasTypeB) {
      migrated = this._applyTypeBTransform(migrated);
      migratedTypes.push(MIGRATION_TYPES.TYPE_B);
    }

    // Inject imports if anything changed
    if (migrated !== original) {
      migrated = this._injectImports(migrated);
    }

    const diff         = this.generateDiff(original, migrated, path.basename(resolved));
    const changesCount = migratedTypes.length;

    let backupPath = null;
    if (!this._dryRun) {
      if (this._createBackup) {
        backupPath = resolved + this._backupSuffix;
        fs.writeFileSync(backupPath, original, 'utf8');
        this._backupStore.set(resolved, original);
        this._log('backup', { filePath: resolved, backupPath });
      }
      fs.writeFileSync(resolved, migrated, 'utf8');
      this._log('migrated', { filePath: resolved, migratedTypes });
    } else {
      // Dry-run: store original for potential rollback testing
      this._backupStore.set(resolved, original);
      this._log('dryRun', { filePath: resolved, migratedTypes });
    }

    return {
      filePath:     resolved,
      dryRun:       this._dryRun,
      original,
      migrated,
      diff,
      changesCount,
      migratedTypes,
      backupPath,
      migratedAt: new Date().toISOString(),
    };
  }

  /**
   * @method generateDiff
   * @description
   *   Generates a unified diff string between two versions of a file's content.
   *   Uses line-level comparison; no external dependencies.
   *
   * @param {string} original  — Original source text
   * @param {string} migrated  — Transformed source text
   * @param {string} filename  — Display name used in diff header
   * @returns {string} Unified diff text
   *
   * @example
   * const diff = migrator.generateDiff(originalSrc, migratedSrc, 'router.js');
   * console.log(diff);
   * // --- a/router.js
   * // +++ b/router.js
   * // @@ -12,3 +12,5 @@
   * // -if (cmd === 'deploy') {
   * // +// [CSL-MIGRATED] SemanticRouter replaces string equality
   * // +const _result = _semanticRouter.route(cmd); // cosine-scored routing
   * // +if (_result.topMatch === 'deploy') {
   */
  generateDiff(original, migrated, filename) {
    return unifiedDiff(original, migrated, filename || 'file.js');
  }

  /**
   * @method generateMigrationPlan
   * @description
   *   Accepts an array of AuditReport objects (or a single report) and returns
   *   a prioritised migration plan — sorted by priority score (TYPE_A×3 + TYPE_B×2),
   *   highest first.
   *
   * @param {AuditReport|AuditReport[]} auditReports
   * @returns {MigrationPlan}
   *
   * @typedef {Object} MigrationPlan
   * @property {PlanEntry[]} entries          — Ordered list of files to migrate
   * @property {number}      totalFiles
   * @property {number}      totalTypeA       — Sum of TYPE_A findings
   * @property {number}      totalTypeB       — Sum of TYPE_B findings
   * @property {number}      totalPreserved   — Sum of TYPE_C + TYPE_D preserved
   * @property {number}      estimatedEffort  — Rough effort units (priorityScore sum)
   * @property {string}      generatedAt      — ISO timestamp
   *
   * @typedef {Object} PlanEntry
   * @property {string} filePath
   * @property {number} priorityScore
   * @property {number} typeACount
   * @property {number} typeBCount
   * @property {number} preservedCount
   * @property {string} recommendation — 'MIGRATE_NOW' | 'MIGRATE_SOON' | 'REVIEW' | 'SKIP'
   *
   * @example
   * const reports = ['router.js', 'handler.js'].map(f => auditor.scanFile(f));
   * const plan = migrator.generateMigrationPlan(reports);
   * plan.entries.forEach(e => console.log(e.filePath, e.recommendation));
   */
  generateMigrationPlan(auditReports) {
    const reports = Array.isArray(auditReports) ? auditReports : [auditReports];

    const entries = reports.map(r => {
      const typeACount     = r.summary.TYPE_A || 0;
      const typeBCount     = r.summary.TYPE_B || 0;
      const preservedCount = (r.summary.TYPE_C || 0) + (r.summary.TYPE_D || 0);
      const priorityScore  = typeACount * PRIORITY_WEIGHTS.TYPE_A +
                             typeBCount * PRIORITY_WEIGHTS.TYPE_B;

      let recommendation;
      if (priorityScore >= 9)      recommendation = 'MIGRATE_NOW';
      else if (priorityScore >= 4) recommendation = 'MIGRATE_SOON';
      else if (priorityScore > 0)  recommendation = 'REVIEW';
      else                         recommendation = 'SKIP';

      return {
        filePath:     r.filePath,
        priorityScore,
        typeACount,
        typeBCount,
        preservedCount,
        recommendation,
      };
    });

    // Sort descending by priorityScore
    entries.sort((a, b) => b.priorityScore - a.priorityScore);

    const totalTypeA     = entries.reduce((s, e) => s + e.typeACount, 0);
    const totalTypeB     = entries.reduce((s, e) => s + e.typeBCount, 0);
    const totalPreserved = entries.reduce((s, e) => s + e.preservedCount, 0);
    const estimatedEffort = entries.reduce((s, e) => s + e.priorityScore, 0);

    return {
      entries,
      totalFiles:     entries.length,
      totalTypeA,
      totalTypeB,
      totalPreserved,
      estimatedEffort,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * @method trackProgress
   * @description
   *   Given a migration plan (or audit report array) and a list of files
   *   already migrated, returns a progress summary including percentComplete.
   *
   * @param {AuditReport|AuditReport[]} auditReports
   * @param {string[]} completedFiles — Array of resolved file paths already migrated
   * @returns {ProgressReport}
   *
   * @typedef {Object} ProgressReport
   * @property {number}   totalFiles
   * @property {number}   completedFiles
   * @property {number}   pendingFiles
   * @property {number}   percentComplete      — 0–100 (2 decimal places)
   * @property {string[]} completed            — File paths confirmed migrated
   * @property {string[]} pending              — File paths not yet migrated
   * @property {number}   completedPriorityScore
   * @property {number}   totalPriorityScore
   * @property {string}   updatedAt            — ISO timestamp
   *
   * @example
   * const progress = migrator.trackProgress(reports, ['/src/router.js']);
   * console.log(`${progress.percentComplete}% complete`);
   */
  trackProgress(auditReports, completedFiles = []) {
    const reports = Array.isArray(auditReports) ? auditReports : [auditReports];
    const completedSet = new Set(completedFiles.map(f => path.resolve(f)));

    const totalFiles    = reports.length;
    const completed     = reports.filter(r => completedSet.has(r.filePath));
    const pending       = reports.filter(r => !completedSet.has(r.filePath));
    const completedCt   = completed.length;
    const percentComplete = totalFiles > 0
      ? parseFloat(((completedCt / totalFiles) * 100).toFixed(2))
      : 0;

    const completedScore = completed.reduce((s, r) => s + (r.priorityScore || 0), 0);
    const totalScore     = reports.reduce((s, r) => s + (r.priorityScore || 0), 0);

    return {
      totalFiles,
      completedFiles:         completedCt,
      pendingFiles:           pending.length,
      percentComplete,
      completed:              completed.map(r => r.filePath),
      pending:                pending.map(r => r.filePath),
      completedPriorityScore: completedScore,
      totalPriorityScore:     totalScore,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * @method rollback
   * @description
   *   Restores a file to its original content from either the in-memory backup
   *   store or a .csl-bak file on disk (whichever is available).
   *
   *   Rollback will throw if no backup is found for the given path.
   *
   * @param {string} filePath — Path of the file to restore
   * @returns {{ filePath: string, restoredFrom: 'memory'|'disk', rolledBackAt: string }}
   *
   * @throws {Error} If no backup is available for the specified file
   *
   * @example
   * migrator.rollback('./src/router.js');
   * // File restored to pre-migration state
   */
  rollback(filePath) {
    const resolved = path.resolve(filePath);

    // 1. Try in-memory store
    if (this._backupStore.has(resolved)) {
      const original = this._backupStore.get(resolved);
      fs.writeFileSync(resolved, original, 'utf8');
      this._backupStore.delete(resolved);
      this._log('rollback', { filePath: resolved, source: 'memory' });
      return { filePath: resolved, restoredFrom: 'memory', rolledBackAt: new Date().toISOString() };
    }

    // 2. Try .csl-bak file on disk
    const backupPath = resolved + this._backupSuffix;
    if (fs.existsSync(backupPath)) {
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(resolved, backupContent, 'utf8');
      this._log('rollback', { filePath: resolved, source: 'disk', backupPath });
      return { filePath: resolved, restoredFrom: 'disk', rolledBackAt: new Date().toISOString() };
    }

    throw new Error(
      `TernaryToCSLMigrator: no backup found for "${resolved}". ` +
      `Ensure createBackup=true was set and migrateFile() was called first, ` +
      `or that a "${this._backupSuffix}" file exists.`
    );
  }
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

module.exports = {
  // Classes
  TernaryToCSLMigrator,
  AuditDiscreteLogic,
  // Constants
  MIGRATION_TYPES,
  SEVERITY,
  PRIORITY_WEIGHTS,
  PATTERNS,
  // Constants (phi)
  PHI,
  PSI,
  PSI_SQ,
  PSI_CUBE,
  PHI_SQ,
  // Utilities (exported for testing)
  unifiedDiff,
  indexToLineCol,
  snippetAt,
  hashContent,
};
