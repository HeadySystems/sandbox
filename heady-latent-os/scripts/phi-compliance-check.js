#!/usr/bin/env node
/**
 * Heady™ φ-Compliance Checker
 * Scans all .js files for hardcoded magic numbers that should use phi-math.js
 * 
 * Usage: node scripts/phi-compliance-check.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAGIC_NUMBERS = [
  { pattern: /[\s=:([]30000\b/g, fix: 'PHI_TIMING.PHI_7 (29034)', severity: 'CRITICAL' },
  { pattern: /[\s=:([]135\b/g, fix: 'fib(12) = 144 (AUTO_SUCCESS.TASKS_TOTAL)', severity: 'CRITICAL' },
  { pattern: /\b0\.7\b/g, fix: 'PSI (0.618) or CSL_THRESHOLDS.LOW (0.691)', severity: 'HIGH' },
  { pattern: /\b0\.75\b/g, fix: 'CSL_THRESHOLDS.MEDIUM (0.809) or PSI', severity: 'HIGH' },
  { pattern: /\b0\.85\b/g, fix: 'CSL_THRESHOLDS.CRITICAL (0.927) or 1-PSI³ (0.854)', severity: 'MEDIUM' },
  { pattern: /\b0\.9[05]\b/g, fix: 'CSL_THRESHOLDS.CRITICAL (0.927) or 1-PSI⁴ (0.910)', severity: 'MEDIUM' },
  { pattern: /[\s=:([]10000\b(?!0)/g, fix: 'BEE.MAX_TOTAL or phi-derived', severity: 'LOW' },
  { pattern: /[\s=:([]5000\b/g, fix: 'PHI_TIMING.PHI_3 (4236) or PHI_TIMING.PHI_4 (6854)', severity: 'MEDIUM' },
  { pattern: /[\s=:([]1000\b(?!0)/g, fix: 'phiBackoff base or PHI_TIMING.PHI_1 (1618)', severity: 'LOW', unitConversion: true },
  { pattern: /[\s=:([]60000\b/g, fix: 'PHI_TIMING.PHI_8 (46979) or BEE.STALE_MS', severity: 'LOW' },
];

const IGNORE_DIRS = ['node_modules', '_archive', 'coverage', '.git', 'dist'];
const IGNORE_FILES = ['phi-math.js', 'phi-math.ts', 'phi-compliance-check.js'];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];

  for (const check of MAGIC_NUMBERS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('/**')) continue;
      const matches = line.match(check.pattern);
      if (matches) {
        // Skip unit conversions: fib(n)*1000, uptime()*1000, /1000, 24*60*60*1000, cost*1000
        if (check.unitConversion && (/\*\s*1000/.test(line) || /\/\s*1000/.test(line) || /60\s*\*\s*1000/.test(line) || /fib\(/.test(line))) continue;
        findings.push({
          file: filePath,
          line: i + 1,
          severity: check.severity,
          match: matches[0].trim(),
          fix: check.fix,
          context: line.trim().substring(0, 80),
        });
      }
    }
  }
  return findings;
}

function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else if (entry.name.endsWith('.js') && !IGNORE_FILES.includes(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// Run
const root = path.resolve(__dirname, '..');
const files = walkDir(path.join(root, 'src'));
let total = 0;
const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Heady™ φ-Compliance Audit                                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

for (const file of files) {
  const findings = scanFile(file);
  if (findings.length > 0) {
    console.log(`\n  ${path.relative(root, file)}`);
    for (const f of findings) {
      console.log(`    L${f.line} [${f.severity}] ${f.match} → ${f.fix}`);
      bySeverity[f.severity]++;
      total++;
    }
  }
}

const score = Math.max(0, 100 - bySeverity.CRITICAL * 10 - bySeverity.HIGH * 5 - bySeverity.MEDIUM * 2 - bySeverity.LOW * 1);
console.log(`\n${'═'.repeat(60)}`);
console.log(`  φ-Compliance Score: ${score}/100`);
console.log(`  Files scanned: ${files.length}`);
console.log(`  Total findings: ${total}`);
console.log(`  CRITICAL: ${bySeverity.CRITICAL} | HIGH: ${bySeverity.HIGH} | MEDIUM: ${bySeverity.MEDIUM} | LOW: ${bySeverity.LOW}`);
console.log(`${'═'.repeat(60)}\n`);

process.exit(total > 0 && bySeverity.CRITICAL > 0 ? 1 : 0);
