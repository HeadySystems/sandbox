#!/usr/bin/env node
/**
 * PHI_TIMING Migration Script
 *
 * Replaces all hardcoded 30000/30_000/29034/29_034 ms values with
 * dynamic PHI_TIMING.CYCLE imports from phi-math.js.
 *
 * Usage: node scripts/phi-timing-migration.js [--dry-run]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const SRC_DIR = path.join(__dirname, '..', 'src');

// Files/patterns to skip
const SKIP_PATTERNS = [
  /phi-math\.js$/,                      // Source of truth
  /\.test\.(js|ts|mjs)$/,               // Test files
  /\.spec\.(js|ts|mjs)$/,               // Test files
  /__tests__\//,                         // Test directories
  /\.md$/,                               // Documentation
  /\.ya?ml$/,                            // YAML configs
  /\.json$/,                             // JSON configs
  /\.d\.ts$/,                            // Type declarations (handle separately)
  /node_modules/,                        // Dependencies
  /\.html$/,                             // HTML files (handle separately)
  /prompts\//,                           // Prompt templates
  /vector-memory-optimizer\.js$/,        // bruteForce count, not ms
  /neon-db\.js$/,                        // PostgreSQL driver setting
];

// Regex patterns for hardcoded 30s-tier values (as code, not strings)
// Matches: 30000, 30_000, 29034, 29_034 as standalone numeric literals
const VALUE_PATTERNS = [
  /(?<!\d)30000(?!\d)/g,
  /(?<!\d)30_000(?!\d)/g,
  /(?<!\d)29034(?!\d)/g,
  /(?<!\d)29_034(?!\d)/g,
];

// Context patterns where we should NOT replace (comments documenting old values, etc.)
const SKIP_LINE_PATTERNS = [
  /\/\/.*(?:replaces?|was|old|formerly|from|→|->)/i,  // comments about migration
  /\*.*(?:replaces?|was|old|formerly|from|→|->)/i,    // block comments about migration
];

// Compute the require path from a file to phi-math.js
function computeRequirePath(filePath) {
  const fileDir = path.dirname(filePath);
  const phiMathPath = path.join(SRC_DIR, 'shared', 'phi-math.js');
  let rel = path.relative(fileDir, phiMathPath);
  if (!rel.startsWith('.')) rel = './' + rel;
  // Normalize to forward slashes
  rel = rel.replace(/\\/g, '/');
  // Remove .js extension for consistency (Node resolves both)
  return rel.replace(/\.js$/, '');
}

// Determine how a file imports phi-math (if at all)
function detectImportPattern(content) {
  // Pattern 1: const { ... } = require('...phi-math...')
  const destructuredMatch = content.match(
    /const\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"][^'"]*phi-math[^'"]*['"]\s*\)/
  );
  if (destructuredMatch) {
    return { type: 'destructured', names: destructuredMatch[1], fullMatch: destructuredMatch[0] };
  }

  // Pattern 2: const phiMath = require('...phi-math...')
  const moduleMatch = content.match(
    /const\s+(\w+)\s*=\s*require\s*\(\s*['"][^'"]*phi-math[^'"]*['"]\s*\)/
  );
  if (moduleMatch) {
    return { type: 'module', varName: moduleMatch[1], fullMatch: moduleMatch[0] };
  }

  // Pattern 3: try/catch wrapper: (function() { try { return require(...phi-math...) } ...})()
  const tryCatchMatch = content.match(
    /const\s*\{([^}]+)\}\s*=\s*\(function\(\)\s*\{\s*try\s*\{\s*return\s+require\s*\(\s*['"][^'"]*phi-math[^'"]*['"]\s*\)/
  );
  if (tryCatchMatch) {
    return { type: 'destructured-trycatch', names: tryCatchMatch[1], fullMatch: tryCatchMatch[0] };
  }

  // Pattern 4: let phiMath = null; try { phiMath = require(...) }
  const letMatch = content.match(
    /let\s+(\w+)\s*=\s*null;\s*try\s*\{\s*\1\s*=\s*require\s*\(\s*['"][^'"]*phi-math[^'"]*['"]\s*\)/
  );
  if (letMatch) {
    return { type: 'module-trycatch', varName: letMatch[1], fullMatch: letMatch[0] };
  }

  // Pattern 5: const phi = require('...phi-math...')
  const phiMatch = content.match(
    /const\s+(phi)\s*=\s*require\s*\(\s*['"][^'"]*phi-math[^'"]*['"]\s*\)/
  );
  if (phiMatch) {
    return { type: 'module', varName: phiMatch[1], fullMatch: phiMatch[0] };
  }

  return { type: 'none' };
}

// Add PHI_TIMING to an existing destructured import
function addToDestructuredImport(content, importInfo) {
  const names = importInfo.names.split(',').map(n => n.trim()).filter(Boolean);
  if (names.includes('PHI_TIMING')) return content; // Already imported

  // Add PHI_TIMING to the destructured list
  const newNames = [...names, 'PHI_TIMING'].join(', ');
  const oldImport = importInfo.fullMatch;
  const newImport = oldImport.replace(/\{[^}]+\}/, `{ ${newNames} }`);
  return content.replace(oldImport, newImport);
}

// Add a new phi-math import line
function addNewImport(content, requirePath) {
  // Find the first require/import or 'use strict' and add after it
  const useStrictMatch = content.match(/['"]use strict['"];?\s*\n/);
  if (useStrictMatch) {
    const insertPos = useStrictMatch.index + useStrictMatch[0].length;
    const importLine = `const { PHI_TIMING } = require('${requirePath}');\n`;
    return content.slice(0, insertPos) + importLine + content.slice(insertPos);
  }

  // Otherwise, find the last require() line and add after it
  const lines = content.split('\n');
  let lastRequireLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('require(')) lastRequireLine = i;
    if (lines[i].match(/^(function|class|const\s+\w+\s*=\s*[^r]|let\s+\w+\s*=\s*[^r]|module\.exports)/)) break;
  }

  if (lastRequireLine >= 0) {
    lines.splice(lastRequireLine + 1, 0, `const { PHI_TIMING } = require('${requirePath}');`);
    return lines.join('\n');
  }

  // Fallback: add at top
  return `const { PHI_TIMING } = require('${requirePath}');\n` + content;
}

// Replace hardcoded values with PHI_TIMING references
function replaceValues(content, importInfo) {
  const lines = content.split('\n');
  let changeCount = 0;

  const replacement = importInfo.type === 'module' || importInfo.type === 'module-trycatch'
    ? `${importInfo.varName}.PHI_TIMING.CYCLE`
    : 'PHI_TIMING.CYCLE';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comment-only lines
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      // But still replace if it's a JSDoc @param default
      if (!line.includes('@param') && !line.includes('@property')) continue;
    }

    // Skip lines with migration documentation
    if (SKIP_LINE_PATTERNS.some(p => p.test(line))) continue;

    // Skip string literals ('30000' or "30000") - env var defaults
    // We handle these specially below

    let newLine = line;

    for (const pattern of VALUE_PATTERNS) {
      // Reset lastIndex
      pattern.lastIndex = 0;

      if (pattern.test(newLine)) {
        // Check if the match is inside a string literal
        pattern.lastIndex = 0;
        let match;
        let segments = [];
        let lastEnd = 0;

        while ((match = pattern.exec(newLine)) !== null) {
          const idx = match.index;
          const before = newLine.slice(0, idx);

          // Count quotes to determine if inside a string
          const singleQuotes = (before.match(/'/g) || []).length;
          const doubleQuotes = (before.match(/"/g) || []).length;
          const backticks = (before.match(/`/g) || []).length;
          const inString = (singleQuotes % 2 !== 0) || (doubleQuotes % 2 !== 0) || (backticks % 2 !== 0);

          if (inString) {
            // Inside a string — replace the string version too for env var defaults
            // e.g., process.env.FOO || '30000' → String(PHI_TIMING.CYCLE)
            // Check if it's a parseInt pattern: parseInt(process.env.X || '30000', 10)
            // or just || '30000'
            const stringPattern = new RegExp(`['"]${match[0]}['"]`);
            const stringMatch = newLine.match(stringPattern);
            if (stringMatch) {
              // Check context: is this inside parseInt?
              if (newLine.includes('parseInt') || newLine.includes('Number(')) {
                newLine = newLine.replace(stringPattern, `String(${replacement})`);
              } else {
                // Leave string values as-is if not in a parseInt context
                continue;
              }
            } else {
              continue;
            }
          } else {
            // Not in a string — direct replacement
            segments.push(newLine.slice(lastEnd, idx));
            segments.push(replacement);
            lastEnd = idx + match[0].length;
          }
        }

        if (segments.length > 0) {
          segments.push(newLine.slice(lastEnd));
          newLine = segments.join('');
        }
      }
    }

    // Also handle Math.round(30_000 / PHI) → PHI_TIMING.FLOW
    // and Math.round(PHI * 30000) → PHI_TIMING.TIDE
    newLine = newLine.replace(
      /Math\.round\s*\(\s*(?:30_?000|29_?034)\s*\/\s*PHI\s*\)/g,
      'PHI_TIMING.FLOW'
    );
    newLine = newLine.replace(
      /Math\.round\s*\(\s*PHI\s*\*\s*(?:30_?000|29_?034)\s*\)/g,
      'PHI_TIMING.TIDE'
    );

    if (newLine !== line) {
      lines[i] = newLine;
      changeCount++;
    }
  }

  return { content: lines.join('\n'), changeCount };
}

// Walk directory recursively
function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.isFile() && /\.(js|ts|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// Main
function main() {
  console.log(`PHI_TIMING Migration ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(60));

  const allFiles = walkDir(SRC_DIR);
  let totalChanged = 0;
  let totalReplacements = 0;
  const report = [];

  for (const filePath of allFiles) {
    const relPath = path.relative(SRC_DIR, filePath);

    // Check skip patterns
    if (SKIP_PATTERNS.some(p => p.test(relPath) || p.test(filePath))) continue;

    let content = fs.readFileSync(filePath, 'utf8');

    // Check if file has any hardcoded values to replace
    const hasValues = VALUE_PATTERNS.some(p => { p.lastIndex = 0; return p.test(content); });
    const hasPHIMultiply = /Math\.round\s*\(\s*(?:30_?000|29_?034)\s*\/\s*PHI\s*\)/.test(content)
      || /Math\.round\s*\(\s*PHI\s*\*\s*(?:30_?000|29_?034)\s*\)/.test(content);

    if (!hasValues && !hasPHIMultiply) continue;

    // Detect current import pattern
    let importInfo = detectImportPattern(content);
    const requirePath = computeRequirePath(filePath);

    // Ensure PHI_TIMING is imported
    if (importInfo.type === 'destructured' || importInfo.type === 'destructured-trycatch') {
      content = addToDestructuredImport(content, importInfo);
      // Re-detect to get updated info
      importInfo = detectImportPattern(content);
    } else if (importInfo.type === 'module' || importInfo.type === 'module-trycatch') {
      // Module-level import — we'll use phiMath.PHI_TIMING.CYCLE
      // No import change needed
    } else {
      // No existing import — add one
      content = addNewImport(content, requirePath);
      importInfo = detectImportPattern(content);
      if (importInfo.type === 'none') {
        importInfo = { type: 'destructured' }; // Fallback
      }
    }

    // Replace values
    const result = replaceValues(content, importInfo);

    if (result.changeCount > 0) {
      totalChanged++;
      totalReplacements += result.changeCount;

      report.push({
        file: relPath,
        changes: result.changeCount,
        importType: importInfo.type,
      });

      if (!DRY_RUN) {
        fs.writeFileSync(filePath, result.content, 'utf8');
      }

      console.log(`  ${DRY_RUN ? '[DRY]' : '[OK]'} ${relPath} (${result.changeCount} replacements, import: ${importInfo.type})`);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`Files modified: ${totalChanged}`);
  console.log(`Total replacements: ${totalReplacements}`);
  console.log();

  if (DRY_RUN) {
    console.log('Re-run without --dry-run to apply changes.');
  }

  return { totalChanged, totalReplacements, report };
}

main();
