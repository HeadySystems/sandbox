#!/usr/bin/env node
/**
 * sync-versions.js — Global Version Sync for the Heady Monorepo
 *
 * Reads the root package.json version (or accepts a CLI override) and
 * synchronizes it across every @heady-ai/* package in the monorepo.
 *
 * Also ensures consistent metadata: publishConfig, license, author,
 * repository, and files whitelist.
 *
 * Usage:
 *   node scripts/sync-versions.js              # Sync to root version
 *   node scripts/sync-versions.js 4.1.0        # Bump all to specific version
 *   node scripts/sync-versions.js --dry-run    # Preview without writing
 *   node scripts/sync-versions.js --report     # Show current version map
 *
 * © 2026 HeadySystems Inc.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

// ─── Config ──────────────────────────────────────────────────────────────────

const METADATA_DEFAULTS = {
    license: 'MIT',
    author: {
        name: 'HeadySystems Inc.',
        email: 'dev@heady.ai',
        url: 'https://heady.ai',
    },
    repository: {
        type: 'git',
        url: 'https://github.com/HeadyMe/Heady.git',
        directory: null, // Set per-package
    },
    publishConfig: {
        access: 'public',
    },
    files: ['dist', 'src', 'lib', 'index.js', 'index.ts', 'README.md', 'LICENSE'],
};

// Directories to scan for @heady-ai packages
const SCAN_DIRS = [
    'packages',
    'services',
    'enterprise',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function findPackages() {
    const results = [];

    // Primary: packages/ directory
    if (fs.existsSync(PACKAGES_DIR)) {
        for (const dir of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
            if (!dir.isDirectory()) continue;
            const pkgPath = path.join(PACKAGES_DIR, dir.name, 'package.json');
            const pkg = readJson(pkgPath);
            if (pkg && pkg.name && pkg.name.startsWith('@heady-ai/')) {
                results.push({ dir: path.join(PACKAGES_DIR, dir.name), pkg, path: pkgPath });
            }
        }
    }

    // Secondary: services/ and enterprise/ (only @heady-ai scoped)
    for (const scanDir of SCAN_DIRS.slice(1)) {
        const fullDir = path.join(ROOT, scanDir);
        if (!fs.existsSync(fullDir)) continue;

        const walk = (dir, depth = 0) => {
            if (depth > 2) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (!entry.isDirectory() || entry.name === 'node_modules') continue;
                const pkgPath = path.join(dir, entry.name, 'package.json');
                const pkg = readJson(pkgPath);
                if (pkg && pkg.name && pkg.name.startsWith('@heady-ai/') && !pkg.private) {
                    results.push({ dir: path.join(dir, entry.name), pkg, path: pkgPath });
                }
                walk(path.join(dir, entry.name), depth + 1);
            }
        };
        walk(fullDir);
    }

    // Deduplicate by package name (prefer packages/ over others)
    const byName = new Map();
    for (const entry of results) {
        const existing = byName.get(entry.pkg.name);
        if (!existing || entry.path.includes('/packages/')) {
            byName.set(entry.pkg.name, entry);
        }
    }

    return [...byName.values()].sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
}

function updateCrossReferences(pkg, targetVersion, allNames) {
    let changed = false;
    for (const depField of ['dependencies', 'devDependencies', 'peerDependencies']) {
        if (!pkg[depField]) continue;
        for (const [name, ver] of Object.entries(pkg[depField])) {
            if (allNames.has(name) && !ver.startsWith('workspace:')) {
                const newVer = `^${targetVersion}`;
                if (pkg[depField][name] !== newVer) {
                    pkg[depField][name] = newVer;
                    changed = true;
                }
            }
        }
    }
    return changed;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const reportOnly = args.includes('--report');
    const versionArg = args.find(a => /^\d+\.\d+\.\d+/.test(a));

    // Read root version
    const rootPkg = readJson(path.join(ROOT, 'package.json'));
    if (!rootPkg) {
        console.error('❌ Cannot read root package.json');
        process.exit(1);
    }

    const targetVersion = versionArg || rootPkg.version;
    const packages = findPackages();

    console.log(`\n  🔄 Heady Version Sync`);
    console.log(`  ─────────────────────`);
    console.log(`  Root version:  ${rootPkg.version}`);
    console.log(`  Target:        ${targetVersion}`);
    console.log(`  Packages:      ${packages.length}`);
    console.log(`  Mode:          ${dryRun ? 'DRY RUN' : reportOnly ? 'REPORT' : 'WRITE'}`);
    console.log('');

    if (reportOnly) {
        // Just show current state
        const versions = {};
        for (const entry of packages) {
            const v = entry.pkg.version;
            if (!versions[v]) versions[v] = [];
            versions[v].push(entry.pkg.name);
        }

        for (const [ver, names] of Object.entries(versions).sort()) {
            const match = ver === targetVersion ? '✅' : '⚠️';
            console.log(`  ${match} v${ver} (${names.length} packages):`);
            for (const n of names) {
                console.log(`     ${n}`);
            }
            console.log('');
        }
        return;
    }

    // Collect all @heady-ai/* names for cross-reference updates
    const allNames = new Set(packages.map(e => e.pkg.name));

    let updated = 0;
    let skipped = 0;
    let metadataFixed = 0;

    for (const entry of packages) {
        const { pkg, dir } = entry;
        const relDir = path.relative(ROOT, dir);
        let changed = false;

        // 1. Sync version
        if (pkg.version !== targetVersion) {
            console.log(`  📦 ${pkg.name}  ${pkg.version} → ${targetVersion}  (${relDir})`);
            pkg.version = targetVersion;
            changed = true;
        }

        // 2. Update cross-references
        if (updateCrossReferences(pkg, targetVersion, allNames)) {
            changed = true;
        }

        // 3. Ensure publish metadata
        if (!pkg.publishConfig || pkg.publishConfig.access !== 'public') {
            pkg.publishConfig = METADATA_DEFAULTS.publishConfig;
            changed = true;
            metadataFixed++;
        }

        if (!pkg.license) {
            pkg.license = METADATA_DEFAULTS.license;
            changed = true;
            metadataFixed++;
        }

        if (!pkg.author || typeof pkg.author === 'string') {
            pkg.author = METADATA_DEFAULTS.author;
            changed = true;
            metadataFixed++;
        }

        if (!pkg.repository) {
            pkg.repository = {
                ...METADATA_DEFAULTS.repository,
                directory: relDir,
            };
            changed = true;
            metadataFixed++;
        }

        if (!pkg.files) {
            // Detect actual file structure
            const hasDistDir = fs.existsSync(path.join(dir, 'dist'));
            const hasSrcDir = fs.existsSync(path.join(dir, 'src'));
            const hasLibDir = fs.existsSync(path.join(dir, 'lib'));
            const files = [];
            if (hasDistDir) files.push('dist');
            if (hasSrcDir) files.push('src');
            if (hasLibDir) files.push('lib');
            if (fs.existsSync(path.join(dir, 'index.js'))) files.push('index.js');
            if (fs.existsSync(path.join(dir, 'index.ts'))) files.push('index.ts');
            files.push('README.md', 'LICENSE');
            pkg.files = files;
            changed = true;
            metadataFixed++;
        }

        if (changed) {
            if (!dryRun) {
                writeJson(entry.path, pkg);
            }
            updated++;
        } else {
            skipped++;
        }
    }

    console.log('');
    console.log(`  ─────────────────────`);
    console.log(`  ✅ Updated:       ${updated}`);
    console.log(`  ⏭  Already synced: ${skipped}`);
    console.log(`  🔧 Metadata fixed: ${metadataFixed}`);
    if (dryRun) {
        console.log(`  ⚠️  DRY RUN — no files written`);
    }
    console.log('');
}

main();
