#!/usr/bin/env node
import { readdirSync, lstatSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.cache'
]);

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_BASENAMES = new Set([
    'README',
    'CHANGELOG',
    'LICENSE',
    'Dockerfile',
    'Makefile',
    'AGENTS',
    '.env',
    '.env.example'
]);

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const linkStats = lstatSync(full);
        if (linkStats.isSymbolicLink()) {
            continue;
        }

        const stats = statSync(full);

        if (stats.isDirectory()) {
            if (!EXCLUDED_DIRS.has(name)) {
                walk(full, out);
            }
            continue;
        }

        out.push(relative(ROOT, full));
    }
    return out;
}

function isNameCompliant(file) {
    const filename = file.split('/').pop() ?? file;
    const [base] = filename.split('.');

    if (filename.startsWith('.')) {
        return true;
    }

    if (ALLOWED_BASENAMES.has(base)) {
        return true;
    }

    return KEBAB_CASE.test(base);
}

const files = walk(ROOT);
const violations = files.filter((file) => !isNameCompliant(file));

const report = {
    scannedFiles: files.length,
    violations: violations.length,
    sampleViolations: violations.slice(0, 100)
};

console.log(JSON.stringify(report, null, 2));

if (process.argv.includes('--strict') && violations.length > 0) {
    process.exitCode = 1;
}
