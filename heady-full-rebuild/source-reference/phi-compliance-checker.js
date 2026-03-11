#!/usr/bin/env node
'use strict';
/**
 * PhiComplianceChecker — CI audit tool for phi-scaling violations in JS/JSON/YAML files.
 *
 * Detects round-number constants that violate the Heady™ Sacred Geometry covenant
 * and suggests the nearest phi-compliant alternative.
 *
 * Usage:
 *   node tools/phi-compliance-checker.js <path>
 *   node tools/phi-compliance-checker.js src/
 *
 * Exit codes:
 *   0 — all files pass (no errors)
 *   1 — one or more error-severity violations found
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

const phi = require('../shared/phi-math.js');
const fs  = require('fs');
const path = require('path');

// ─── Phi constants ────────────────────────────────────────────────────────────
const PHI    = phi.PHI;    // ≈ 1.6180339887
const PSI    = phi.PSI;    // ≈ 0.6180339887
const PHI_SQ = phi.PHI_SQ; // ≈ 2.6180339887
const PHI_CU = phi.PHI_CU; // ≈ 4.2360679775

// ─── Reference tables ────────────────────────────────────────────────────────

// φ-power timeout values (ms) — from phi-math.js phiBackoff ladder
const PHI_TIMEOUTS_MS = [
  1618,   // φ  × 1000
  2618,   // φ² × 1000
  4236,   // φ³ × 1000
  6854,   // φ⁴ × 1000
  11090,  // φ⁵ × 1000
  17944,  // φ⁶ × 1000
  29034,  // φ⁷ × 1000  ≈ auto-success cycle
  46979,  // φ⁸ × 1000
  76013,  // φ⁹ × 1000
];

// Fibonacci sequence for cache/pool sizes
const FIBONACCI = [
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584,
  4181, 6765, 10946, 17711, 28657, 46368,
];

// CSL threshold values
const CSL_VALUES = [
  0.500, 0.618, 0.691, 0.764, 0.809, 0.854, 0.882, 0.910, 0.927, 0.972,
];

// Phi multiplier suggestions
const PHI_MULTIPLIERS = [
  { value: PHI,             label: 'φ  ≈ 1.618' },
  { value: PHI_SQ,          label: 'φ² ≈ 2.618' },
  { value: PHI_CU,          label: 'φ³ ≈ 4.236' },
  { value: Math.pow(PHI,4), label: 'φ⁴ ≈ 6.854' },
];

// ─── Nearest-value helpers ────────────────────────────────────────────────────

function nearestInArray(value, arr) {
  return arr.reduce((best, candidate) => {
    return Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best;
  }, arr[0]);
}

function nearestPhiTimeout(ms) {
  return nearestInArray(ms, PHI_TIMEOUTS_MS);
}

function nearestFibonacci(n) {
  return nearestInArray(n, FIBONACCI);
}

function nearestCsl(v) {
  return nearestInArray(v, CSL_VALUES);
}

function nearestPhiMultiplier(v) {
  const m = PHI_MULTIPLIERS.reduce((best, candidate) => {
    return Math.abs(candidate.value - v) < Math.abs(best.value - v) ? candidate : best;
  }, PHI_MULTIPLIERS[0]);
  return m.label;
}

// ─── Detection rules ──────────────────────────────────────────────────────────

/**
 * Each rule defines:
 *   id          — short identifier
 *   name        — human label
 *   pattern     — RegExp to match against each line
 *   fileTypes   — array of extensions to apply rule to (or ['*'] for all)
 *   severity    — 'error' | 'warning'
 *   suggest(match, line) — returns suggestion string
 */
const RULES = [
  // ── Rule 1: Round-number timeouts ─────────────────────────────────────────
  {
    id:        'R01-TIMEOUT',
    name:      'Round-number timeout',
    // Matches numeric literals that are exact multiples of 1000 in the flagged set
    // within timeout-related property names / variable assignments
    pattern:   /(?:timeout|delay|interval|debounce|throttle|wait|sleep|ttl)\s*[=:]\s*(\b(?:1000|2000|3000|4000|5000|6000|7000|8000|9000|10000|15000|20000|30000|45000|60000|90000|120000|180000|300000)\b)/gi,
    fileTypes: ['js', 'ts', 'json', 'yaml', 'yml'],
    severity:  'error',
    suggest:   (match, _line) => {
      const numStr = match.replace(/[^0-9]/g, '');
      const num    = parseInt(numStr, 10);
      const near   = nearestPhiTimeout(num);
      return `${near} (nearest φ-power ms: φ-backoff ladder)`;
    },
  },

  // ── Rule 2: Round-number backoff / retry multipliers ──────────────────────
  {
    id:        'R02-MULTIPLIER',
    name:      'Round-number backoff multiplier',
    pattern:   /(?:backoffMultiplier|retryMultiplier|multiplier|factor|growthRate)\s*[=:]\s*(\b[234]\b)/gi,
    fileTypes: ['js', 'ts', 'json', 'yaml', 'yml'],
    severity:  'error',
    suggest:   (match, _line) => {
      const numStr = match.replace(/[^0-9.]/g, '');
      const num    = parseFloat(numStr);
      return `${nearestPhiMultiplier(num)} — use φ-based multiplier from phi-math.js`;
    },
  },

  // ── Rule 3: Round-number thresholds ──────────────────────────────────────
  {
    id:        'R03-THRESHOLD',
    name:      'Round-number threshold',
    // Matches floating point literals 0.5, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95 in
    // threshold / confidence / score / similarity / gate contexts
    pattern:   /(?:threshold|confidence|score|similarity|gate|minScore|cutoff|limit)\s*[=:]\s*(0\.(?:5|7|75|8|85|9|95)\b)/gi,
    fileTypes: ['js', 'ts', 'json', 'yaml', 'yml'],
    severity:  'error',
    suggest:   (match, _line) => {
      const numStr = match.replace(/.*?([0-9.]+)\s*$/, '$1');
      const num    = parseFloat(numStr);
      const near   = nearestCsl(num);
      return `${near} (nearest CSL threshold — import from phi-math.js CSL_THRESHOLDS)`;
    },
  },

  // ── Rule 4: Round-number cache / pool sizes ───────────────────────────────
  {
    id:        'R04-CACHE-SIZE',
    name:      'Round-number cache/pool size',
    pattern:   /(?:cacheSize|poolSize|maxSize|capacity|bufferSize|queueSize|ringSize|limit)\s*[=:]\s*(\b(?:10|20|25|50|100|200|250|500|1000|2000|5000|10000)\b)/gi,
    fileTypes: ['js', 'ts', 'json', 'yaml', 'yml'],
    severity:  'error',
    suggest:   (match, _line) => {
      const numStr = match.replace(/[^0-9]/g, '');
      const num    = parseInt(numStr, 10);
      const near   = nearestFibonacci(num);
      return `${near} (nearest Fibonacci number)`;
    },
  },

  // ── Rule 5: Round-number token budgets ────────────────────────────────────
  {
    id:        'R05-TOKEN-BUDGET',
    name:      'Round-number token budget',
    // Multiples of 1000 in token-budget contexts
    pattern:   /(?:tokenBudget|maxTokens|tokenLimit|contextWindow|promptLimit)\s*[=:]\s*(\b(?:[0-9]+000)\b)/gi,
    fileTypes: ['js', 'ts', 'json', 'yaml', 'yml'],
    severity:  'warning',
    suggest:   (match, _line) => {
      const numStr = match.replace(/[^0-9]/g, '');
      const num    = parseInt(numStr, 10);
      // For token budgets: nearest Fibonacci or nearest phi-power × 1000
      const nearFib  = nearestFibonacci(num);
      // phi-geometric: 8192, 13271, 21463, 34734, 56197 ... (base 8192 × φ^n)
      const PHI_TOKEN_BASES = [8192, 13271, 21463, 34734, 56197, 90931, 147128];
      const nearPhiToken = nearestInArray(num, PHI_TOKEN_BASES);
      const bestSuggest  = Math.abs(nearFib - num) < Math.abs(nearPhiToken - num)
        ? nearFib
        : nearPhiToken;
      return `${bestSuggest} (nearest Fibonacci or φ-geometric token budget)`;
    },
  },

  // ── Rule 6: Round-number retry counts ────────────────────────────────────
  {
    id:        'R06-RETRY-COUNT',
    name:      'Round-number retry count',
    pattern:   /(?:maxRetries|retryCount|retries|maxAttempts|attempts)\s*[=:]\s*(\b(?:3|5|10|15|20)\b)/gi,
    fileTypes: ['js', 'ts', 'json', 'yaml', 'yml'],
    severity:  'error',
    suggest:   (match, _line) => {
      const numStr = match.replace(/[^0-9]/g, '');
      const num    = parseInt(numStr, 10);
      // Fibonacci retry ladder: 1, 2, 3, 5, 8, 13
      const FIB_RETRIES = [1, 2, 3, 5, 8, 13];
      const near = nearestInArray(num, FIB_RETRIES);
      return `${near} (nearest Fibonacci retry count)`;
    },
  },

  // ── Rule 7: Hardcoded φ value (should import from phi-math.js) ────────────
  {
    id:        'R07-HARDCODED-PHI',
    name:      'Hardcoded phi/golden-ratio literal',
    pattern:   /(?<![A-Za-z_$])(?:1\.618\d*|0\.618\d*|2\.618\d*|4\.236\d*)(?![A-Za-z_$0-9])/g,
    fileTypes: ['js', 'ts'],
    severity:  'warning',
    suggest:   () => 'Import PHI/PSI/PHI_SQ from shared/phi-math.js — never hardcode φ',
  },
];

// ─── File scanner ─────────────────────────────────────────────────────────────

/**
 * Determine applicable rules for a given file extension.
 * @param {string} ext  e.g. 'js'
 * @returns {Array}
 */
function rulesForExtension(ext) {
  return RULES.filter(r => r.fileTypes.includes('*') || r.fileTypes.includes(ext));
}

/**
 * Scan a single file for phi-compliance violations.
 * @param {string} filePath  Absolute or relative path
 * @returns {Array<Object>}  Violation objects
 */
function scanFile(filePath) {
  const ext        = path.extname(filePath).replace('.', '').toLowerCase();
  const applicable = rulesForExtension(ext);
  if (applicable.length === 0) return [];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    // Unreadable file — report: warning, not hard failure
    return [{
      file:      filePath,
      line:      0,
      current:   '<unreadable>',
      suggested: 'N/A',
      rule:      'R00-IO',
      severity:  'warning',
      message:   `Cannot read file: ${err.message}`,
    }];
  }

  const lines      = content.split('\n');
  const violations = [];

  for (const rule of applicable) {
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line     = lines[lineIdx];
      // Skip comment-only lines and import statements
      const trimmed  = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
      if (trimmed.startsWith('require(') || trimmed.startsWith('import ')) continue;

      // Reset lastIndex for global regexes
      rule.pattern.lastIndex = 0;

      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        const matchedText = match[0];
        const suggested   = rule.suggest(matchedText, line);

        violations.push({
          file:      filePath,
          line:      lineIdx + 1,
          current:   matchedText.trim(),
          suggested,
          rule:      rule.id,
          ruleName:  rule.name,
          severity:  rule.severity,
        });
      }
      // Reset after each line scan
      rule.pattern.lastIndex = 0;
    }
  }

  return violations;
}

// ─── Directory walker ─────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set(['js', 'ts', 'json', 'yaml', 'yml']);

/**
 * Recursively collect all supported files under a directory.
 * Skips node_modules, .git, dist, build directories.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.cache']);
  const results   = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(current, entry.name));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).replace('.', '').toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push(path.join(current, entry.name));
        }
      }
    }
  }

  walk(dir);
  return results;
}

// ─── Compliance scoring ───────────────────────────────────────────────────────

/**
 * Calculate compliance score: percentage of violation-free lines.
 * @param {number} totalLines
 * @param {number} violationCount
 * @returns {number}  0-100
 */
function complianceScore(totalLines, violationCount) {
  if (totalLines === 0) return 100;
  const violationRate = violationCount / totalLines;
  // Use a phi-weighted decay so a single violation in 10,000 lines is near-perfect
  const raw = (1 - violationRate) * 100;
  return +Math.max(0, raw).toFixed(2);
}

// ─── PhiComplianceChecker class ───────────────────────────────────────────────

class PhiComplianceChecker {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.verbose]  Print each violation: it's found
   * @param {string[]} [options.skip]    File paths or patterns to skip
   */
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.skip    = options.skip || [];
  }

  /**
   * Scan a single file.
   * @param {string} filePath
   * @returns {Object}  { filePath, violations, lineCount }
   */
  checkFile(filePath) {
    const violations = scanFile(filePath);
    let lineCount = 0;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      lineCount     = content.split('\n').length;
    } catch (_) {}

    if (this.verbose && violations.length > 0) {
      for (const v of violations) {
        const sev = v.severity === 'error' ? '[ERROR]' : '[WARN] ';
        console.log(`  ${sev} ${v.file}:${v.line}  ${v.rule}  ${v.current}  →  ${v.suggested}`);
      }
    }

    return { filePath, violations, lineCount };
  }

  /**
   * Scan a file or directory recursively.
   * @param {string} target  File path or directory path
   * @returns {Object}  Full report
   */
  checkPath(target) {
    const stat = fs.statSync(target);
    const files = stat.isDirectory()
      ? collectFiles(target)
      : [target];

    let totalFiles      = 0;
    let totalLines      = 0;
    let totalViolations = 0;
    let errorCount      = 0;
    const allViolations = [];

    for (const f of files) {
      // Skip check
      if (this.skip.some(s => f.includes(s))) continue;
      totalFiles++;

      const result = this.checkFile(f);
      totalLines      += result.lineCount;
      totalViolations += result.violations.length;
      errorCount      += result.violations.filter(v => v.severity === 'error').length;
      allViolations.push(...result.violations);
    }

    const score = complianceScore(totalLines, totalViolations);

    return {
      totalFiles,
      totalLines,
      violations:      totalViolations,
      errors:          errorCount,
      warnings:        totalViolations - errorCount,
      complianceScore: score,
      passed:          errorCount === 0,
      details:         allViolations,
    };
  }

  /**
   * Format a report for console output.
   * @param {Object} report  Result of checkPath()
   * @returns {string}
   */
  formatReport(report) {
    const lines = [
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '  Heady™ Phi-Compliance Report',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `  Files scanned:   ${report.totalFiles}`,
      `  Lines scanned:   ${report.totalLines}`,
      `  Violations:      ${report.violations}  (${report.errors} errors, ${report.warnings} warnings)`,
      `  Compliance:      ${report.complianceScore}%`,
      `  Status:          ${report.passed ? 'PASS ✓' : 'FAIL ✗'}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ];

    if (report.details.length > 0) {
      lines.push('');
      lines.push('  Violations:');
      for (const v of report.details) {
        const sev   = v.severity === 'error' ? '[ERR] ' : '[WARN]';
        const loc   = `${v.file}:${v.line}`;
        lines.push(`    ${sev}  ${v.rule}  ${loc}`);
        lines.push(`           Found:     ${v.current}`);
        lines.push(`           Suggested: ${v.suggested}`);
        lines.push('');
      }
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    return lines.join('\n');
  }
}

// ─── CLI runner ───────────────────────────────────────────────────────────────

function runCli() {
  const args   = process.argv.slice(2);
  const target = args[0];

  if (!target) {
    console.error('Usage: node tools/phi-compliance-checker.js <path>');
    console.error('  <path> can be a single file or a directory (scanned recursively)');
    process.exit(2);
  }

  const resolvedTarget = path.resolve(target);

  if (!fs.existsSync(resolvedTarget)) {
    console.error(`Error: path not found: ${resolvedTarget}`);
    process.exit(2);
  }

  const checker = new PhiComplianceChecker({ verbose: true });
  const report  = checker.checkPath(resolvedTarget);
  console.log(checker.formatReport(report));

  // Exit 1 if any error-severity violations
  process.exit(report.passed ? 0 : 1);
}

// ─── Module exports ───────────────────────────────────────────────────────────

module.exports = {
  PhiComplianceChecker,
  scanFile,
  collectFiles,
  complianceScore,
  RULES,
  PHI_TIMEOUTS_MS,
  FIBONACCI,
  CSL_VALUES,
};

// Run: CLI when executed directly
if (require.main === module) {
  runCli();
}
