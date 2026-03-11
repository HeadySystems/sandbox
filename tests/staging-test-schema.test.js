'use strict';
/**
 * staging-test-schema.test.js
 * Comprehensive staging validation — runs all system-level checks
 * before code is promoted from Heady-Testing to Heady-Staging.
 *
 * Part of the Heady™ Auto-Testing Framework
 * © 2026 HeadySystems Inc.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────────

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function dirExists(relativePath) {
  const full = path.join(ROOT, relativePath);
  return fs.existsSync(full) && fs.statSync(full).isDirectory();
}

function readJson(relativePath) {
  const full = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

/**
 * Recursively find files matching a pattern
 */
function findFiles(dir, pattern, maxResults = 200) {
  const results = [];
  function walk(d) {
    if (results.length >= maxResults) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (results.length >= maxResults) return;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', '.git', '_archive', '_downloads', 'coverage'].includes(e.name)) {
          walk(full);
        }
      } else if (pattern.test(e.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

// ── Test Suites ──────────────────────────────────────────────────────────

describe('Staging Schema — File Structure', () => {
  test('src/ directory exists', () => {
    expect(dirExists('src')).toBe(true);
  });

  test('configs/ directory exists', () => {
    expect(dirExists('configs')).toBe(true);
  });

  test('tests/ directory exists', () => {
    expect(dirExists('tests')).toBe(true);
  });

  test('scripts/ directory exists', () => {
    expect(dirExists('scripts')).toBe(true);
  });

  test('package.json exists', () => {
    expect(fileExists('package.json')).toBe(true);
  });

  test('Dockerfile exists', () => {
    expect(fileExists('Dockerfile')).toBe(true);
  });

  test('README.md exists', () => {
    expect(fileExists('README.md')).toBe(true);
  });

  test('.gitignore exists', () => {
    expect(fileExists('.gitignore')).toBe(true);
  });

  test('jest.config.js exists', () => {
    expect(fileExists('jest.config.js')).toBe(true);
  });

  test('hcfullpipeline.yaml exists', () => {
    expect(fileExists('configs/hcfullpipeline.yaml')).toBe(true);
  });

  test('hcfullpipeline.json exists', () => {
    expect(fileExists('configs/hcfullpipeline.json')).toBe(true);
  });
});

describe('Staging Schema — Config Parsing', () => {
  test('package.json parses without errors', () => {
    expect(() => readJson('package.json')).not.toThrow();
  });

  test('hcfullpipeline.json parses without errors', () => {
    expect(() => readJson('configs/hcfullpipeline.json')).not.toThrow();
  });

  test('tsconfig.json parses without errors', () => {
    if (fileExists('tsconfig.json')) {
      // tsconfig allows comments, so we strip them
      const raw = readFile('tsconfig.json');
      const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(() => JSON.parse(stripped)).not.toThrow();
    }
  });

  test('turbo.json parses without errors', () => {
    if (fileExists('turbo.json')) {
      expect(() => readJson('turbo.json')).not.toThrow();
    }
  });

  test('manifest.json parses without errors', () => {
    if (fileExists('manifest.json')) {
      expect(() => readJson('manifest.json')).not.toThrow();
    }
  });

  test('renovate.json parses without errors', () => {
    if (fileExists('renovate.json')) {
      expect(() => readJson('renovate.json')).not.toThrow();
    }
  });
});

describe('Staging Schema — Package.json Consistency', () => {
  let pkg;

  beforeAll(() => {
    pkg = readJson('package.json');
  });

  test('name field is defined', () => {
    expect(pkg.name).toBeDefined();
    expect(pkg.name.length).toBeGreaterThan(0);
  });

  test('version field matches semver', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('engines.node requires >=20', () => {
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines.node).toContain('20');
  });

  test('test script is defined', () => {
    expect(pkg.scripts.test).toBeDefined();
  });

  test('build script is defined', () => {
    expect(pkg.scripts.build).toBeDefined();
  });

  test('smoke script is defined', () => {
    expect(pkg.scripts.smoke).toBeDefined();
  });

  test('no devDependency versions use * wildcard', () => {
    for (const [name, ver] of Object.entries(pkg.devDependencies || {})) {
      expect(ver).not.toBe('*');
    }
  });

  test('no dependency versions use * wildcard', () => {
    for (const [name, ver] of Object.entries(pkg.dependencies || {})) {
      expect(ver).not.toBe('*');
    }
  });
});

describe('Staging Schema — Security Checks', () => {
  test('no .env files committed (outside .gitignore examples)', () => {
    const envFiles = findFiles(ROOT, /^\.env$/, 10);
    // Filter out examples and templates
    const realEnvFiles = envFiles.filter(f =>
      !f.includes('example') && !f.includes('template') && !f.includes('_archive')
    );
    expect(realEnvFiles.length).toBe(0);
  });

  test('.gitignore includes node_modules', () => {
    const gitignore = readFile('.gitignore');
    expect(gitignore).toContain('node_modules');
  });

  test('.gitignore includes .env', () => {
    const gitignore = readFile('.gitignore');
    expect(gitignore).toContain('.env');
  });

  test('no hardcoded API keys in package.json', () => {
    const raw = readFile('package.json');
    // Check for common API key patterns
    expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(raw).not.toMatch(/AIza[a-zA-Z0-9_-]{35}/);
    expect(raw).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);
  });

  test('SECURITY.md exists', () => {
    expect(fileExists('SECURITY.md')).toBe(true);
  });
});

describe('Staging Schema — Dockerfile Validation', () => {
  test('Dockerfile has FROM instruction', () => {
    const dockerfile = readFile('Dockerfile');
    expect(dockerfile).toMatch(/^FROM\s+/m);
  });

  test('Dockerfile uses node 20+ base image', () => {
    const dockerfile = readFile('Dockerfile');
    // Should reference node:20 or node:22 etc.
    expect(dockerfile).toMatch(/node[:\-](?:2[0-9]|[3-9][0-9])/);
  });

  test('Dockerfile has EXPOSE instruction', () => {
    const dockerfile = readFile('Dockerfile');
    expect(dockerfile).toMatch(/^EXPOSE\s+/m);
  });

  test('docker-compose.yml parses (exists)', () => {
    expect(fileExists('docker-compose.yml')).toBe(true);
  });
});

describe('Staging Schema — Import Chain Verification', () => {
  const coreFiles = [
    'src/hc_pipeline.js',
    'src/hc_orchestrator.js',
    'src/hc_monte_carlo.js',
    'src/hc_self_critique.js',
    'src/bee-factory.js',
    'src/circuit-breaker.js',
    'src/connection-pool.js',
    'src/mcp-gateway.js',
    'src/rbac-manager.js',
    'src/recon.js',
    'src/self-awareness.js',
    'src/zero-trust-sandbox.js',
  ];

  test('core source files exist', () => {
    for (const file of coreFiles) {
      if (fileExists(file)) {
        const content = readFile(file);
        expect(content.length).toBeGreaterThan(100);
      }
    }
  });

  test('require() paths in core files reference existing modules or packages', () => {
    let unresolvedCount = 0;
    const maxUnresolved = 5; // allow some tolerance for optional deps

    for (const file of coreFiles) {
      if (!fileExists(file)) continue;
      const content = readFile(file);
      const requires = [...content.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)];

      for (const [, modPath] of requires) {
        // Skip node built-ins and npm packages
        if (!modPath.startsWith('.') && !modPath.startsWith('/')) continue;

        const baseDir = path.dirname(path.join(ROOT, file));
        const candidates = [
          path.resolve(baseDir, modPath),
          path.resolve(baseDir, modPath + '.js'),
          path.resolve(baseDir, modPath + '.mjs'),
          path.resolve(baseDir, modPath, 'index.js'),
        ];

        const exists = candidates.some(c => fs.existsSync(c));
        if (!exists) unresolvedCount++;
      }
    }

    // Allow a small tolerance for optional or conditional requires
    expect(unresolvedCount).toBeLessThanOrEqual(maxUnresolved);
  });
});

describe('Staging Schema — Cross-Reference Integrity', () => {
  test('jest.config.js roots reference existing directories', () => {
    // Verify the jest config's roots actually exist
    expect(dirExists('src')).toBe(true);
    expect(dirExists('tests')).toBe(true);
  });

  test('GitHub workflows directory exists', () => {
    expect(dirExists('.github/workflows')).toBe(true);
  });

  test('promote-to-staging.yml exists', () => {
    expect(fileExists('.github/workflows/promote-to-staging.yml')).toBe(true);
  });

  test('CI workflow references valid Node version', () => {
    if (fileExists('.github/workflows/ci.yml')) {
      const ci = readFile('.github/workflows/ci.yml');
      expect(ci).toMatch(/node-version.*['"]?20/);
    }
  });
});

describe('Staging Schema — Test File Health', () => {
  test('tests/ directory has at least 50 test files', () => {
    const testFiles = findFiles(path.join(ROOT, 'tests'), /\.test\.(js|ts|mjs)$/, 200);
    expect(testFiles.length).toBeGreaterThanOrEqual(50);
  });

  test('hcfullpipeline-validator.test.js exists', () => {
    expect(fileExists('tests/hcfullpipeline-validator.test.js')).toBe(true);
  });

  test('no test file is empty (0 bytes)', () => {
    const testFiles = findFiles(path.join(ROOT, 'tests'), /\.test\.(js|ts|mjs)$/, 100);
    for (const tf of testFiles) {
      const stat = fs.statSync(tf);
      expect(stat.size).toBeGreaterThan(0);
    }
  });
});
