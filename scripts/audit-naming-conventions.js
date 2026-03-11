#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['apps', 'packages', 'python', 'scripts', 'src'];
const CODE_EXTENSIONS = new Set([
    '.cjs', '.css', '.cts', '.html', '.js', '.json', '.jsx',
    '.mjs', '.mts', '.py', '.sh', '.sql', '.ts', '.tsx', '.yaml', '.yml',
]);

const IGNORE_DIRS = new Set([
    '.git', '.next', '.turbo', '__pycache__', 'build', 'coverage', 'dist', 'node_modules',
]);

const ALLOWED_FILE_PATTERNS = [
    /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*\.[a-z0-9]+$/,
    /^__[a-z0-9_]+__\.[a-z0-9]+$/,
];

const ALLOWED_DIR_PATTERNS = [
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
    /^[A-Z][A-Za-z0-9]*$/,
    /^__tests__$/,
];

function isAllowedFileName(name) {
    return ALLOWED_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function isAllowedDirName(name) {
    return ALLOWED_DIR_PATTERNS.some((pattern) => pattern.test(name));
}

function walk(baseDir, relPath, violations) {
    const absPath = path.join(baseDir, relPath);
    let entries;
    try { entries = fs.readdirSync(absPath, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;

        const entryRel = path.join(relPath, entry.name);

        if (entry.isDirectory()) {
            if (!isAllowedDirName(entry.name)) {
                violations.push({ type: 'directory', path: entryRel });
            }
            walk(baseDir, entryRel, violations);
            continue;
        }

        if (!CODE_EXTENSIONS.has(path.extname(entry.name))) continue;

        if (!isAllowedFileName(entry.name)) {
            violations.push({ type: 'file', path: entryRel });
        }
    }
}

function main() {
    const violations = [];

    for (const dir of TARGET_DIRS) {
        const absDir = path.join(ROOT, dir);
        if (fs.existsSync(absDir) && fs.statSync(absDir).isDirectory()) {
            walk(ROOT, dir, violations);
        }
    }

    if (violations.length === 0) {
        process.stdout.write('naming-audit: passed (no violations in source directories)\n');
        process.exit(0);
    }

    process.stdout.write(`naming-audit: found ${violations.length} violation(s)\n`);
    for (const v of violations) {
        process.stdout.write(` - [${v.type}] ${v.path}\n`);
    }
    process.exit(1);
}

if (require.main === module) main();
module.exports = { main };
