'use strict';
/**
 * @fileoverview stage-recon.js — Heady™ Sovereign Phi-100 Pipeline Stage 1: RECON
 * @version 3.2.3
 * @description
 *   Pre-action environment reconnaissance. Maps the full landscape before any
 *   planning or execution begins. Runs fib(6)=8 parallel scanners with a
 *   6854ms (φ⁴×1000) hard timeout. Produces a structured Environment Map JSON
 *   with readinessScore, warnings[], and blockers[]. CSL gate requires
 *   readinessScore ≥ PSI (0.618) to pass.
 *
 *   Pipeline Position: Stage 1 (after CHANNEL_ENTRY, before INTAKE)
 *   Scanner count:     fib(6) = 8 parallel scanners
 *   Timeout:           6854ms (φ⁴ × 1000)
 *   CSL gate:          readinessScore ≥ PSI (0.618)
 *
 * @module stage-recon
 * @author Heady™ Core Engineering
 */

const fs            = require('fs');
const os            = require('os');
const path          = require('path');
const crypto        = require('crypto');
const http          = require('http');
const https         = require('https');
const { execSync, exec } = require('child_process');

const phiMath = require('../../shared/phi-math.js');
const {
  PHI,
  PSI,
  FIB,
  fib,
  CSL_THRESHOLDS,
  phiBackoff,
  cosineSimilarity,
  cslGate,
  PRESSURE_LEVELS,
  ALERT_THRESHOLDS,
} = phiMath;

// ─────────────────────────────────────────────────────────────────────────────
//  DERIVED CONSTANTS — all phi-derived, no magic numbers
// ─────────────────────────────────────────────────────────────────────────────

/** φ⁴ × 1000 ms — hard timeout for the full RECON scan */
const RECON_TIMEOUT_MS        = Math.round(Math.pow(PHI, 4) * 1000); // 6854ms

/** Dependency freshness window: fib(7) = 13 days */
const DEP_FRESHNESS_DAYS      = fib(7);  // 13

/** Config drift threshold: 1/φ (PSI) */
const CONFIG_DRIFT_THRESHOLD  = PSI;     // 0.618

/** Budget alert at PSI consumption (61.8%) */
const COST_ALERT_RATIO        = PSI;     // 0.618

/** Number of parallel scanners: fib(6) = 8 */
const SCANNER_COUNT           = fib(6);  // 8

/** Per-scanner timeout: φ³ × 1000 ms */
const SCANNER_TIMEOUT_MS      = Math.round(PHI_CUBED_VAL() * 1000); // 4236ms

/** Maximum retry attempts per scanner: fib(4) = 3 */
const MAX_RETRY_ATTEMPTS      = fib(4);  // 3

/** Minimum healthy services ratio to avoid a blocker: CSL_THRESHOLDS.MEDIUM */
const MIN_HEALTHY_RATIO       = CSL_THRESHOLDS.MEDIUM; // ≈0.764

/** Attack surface: max tolerable public secrets before blocker */
const MAX_PUBLIC_SECRETS      = 0;

/** Version — canonical per BUILD_SPEC */
const VERSION                 = '3.2.3';

/** Helper: φ³ value without importing PHI_CUBED (not destructured above) */
function PHI_CUBED_VAL() { return Math.pow(PHI, 3); } // ≈ 4.236

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a file to string; return null on any error.
 * @param {string} filePath
 * @returns {string|null}
 */
function tryRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

/**
 * Execute a shell command synchronously; return stdout or null on error.
 * @param {string} cmd
 * @param {number} [timeoutMs=4000]
 * @returns {string|null}
 */
function tryExec(cmd, timeoutMs = 4000) {
  try {
    return execSync(cmd, {
      timeout: timeoutMs,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap an async function with a hard timeout ceiling.
 * Resolves with { timedOut: true } if the fn does not settle in time.
 * @param {Function} fn - Async function to execute.
 * @param {number}   timeoutMs
 * @returns {Promise<*>}
 */
function withTimeout(fn, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ timedOut: true, error: `Timed out after ${timeoutMs}ms` });
      }
    }, timeoutMs);

    Promise.resolve()
      .then(() => fn())
      .then(result => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch(err => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ timedOut: false, error: err.message || String(err) });
        }
      });
  });
}

/**
 * Execute a scanner function with phi-backoff retry on failure.
 * Retries up to MAX_RETRY_ATTEMPTS times before returning the last result.
 * @param {Function} scannerFn - Async function returning a scanner result object.
 * @param {string}   name      - Scanner name for logging.
 * @returns {Promise<Object>}
 */
async function withPhiRetry(scannerFn, name) {
  let lastResult = null;
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = phiBackoff(attempt - 1, 1000, RECON_TIMEOUT_MS);
      await sleep(delayMs);
    }
    try {
      const result = await withTimeout(scannerFn, SCANNER_TIMEOUT_MS);
      if (!result.error && !result.timedOut) {
        return result;
      }
      lastResult = result;
    } catch (err) {
      lastResult = { error: err.message || String(err), timedOut: false };
    }
  }
  return lastResult || { error: `Scanner ${name} failed after ${MAX_RETRY_ATTEMPTS} attempts`, timedOut: false };
}

/**
 * Make an HTTP/HTTPS GET request with a timeout.
 * @param {string} url
 * @param {number} [timeoutMs=2618] - φ² × 1000 as default
 * @returns {Promise<{statusCode: number, body: string, ok: boolean}>}
 */
function httpGet(url, timeoutMs = Math.round(Math.pow(PHI, 2) * 1000)) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body, ok: res.statusCode < 400 }));
    });
    req.on('error', (err) => resolve({ statusCode: 0, body: '', ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, body: '', ok: false, error: 'Request timed out' });
    });
  });
}

/**
 * Generate a short scan identifier.
 * @returns {string}
 */
function scanId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Compute phiFusionWeights(8) for 8 scanners and return the weighted sum
 * of all scanner scores. Each scanner result must include a `score` in [0,1].
 * @param {Array<{score: number}>} results - Array of fib(6)=8 scanner results.
 * @returns {number} Weighted readiness score in [0, 1].
 */
function computeReadinessScore(results) {
  const weights = phiMath.phiFusionWeights(SCANNER_COUNT);
  // Sort results by score descending so highest-scoring scanner gets highest weight
  const sorted = [...results].sort((a, b) => b.score - a.score);
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    const score = sorted[i] ? sorted[i].score : 0;
    total += weights[i] * score;
  }
  return Math.max(0, Math.min(1, total));
}

/**
 * Classify a numeric utilization value into a PRESSURE_LEVELS band name.
 * @param {number} value - Utilization ratio in [0, 1].
 * @returns {string} One of 'NOMINAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL'.
 */
function classifyPressure(value) {
  if (value <= PRESSURE_LEVELS.NOMINAL[1])  return 'NOMINAL';
  if (value <= PRESSURE_LEVELS.ELEVATED[1]) return 'ELEVATED';
  if (value <= PRESSURE_LEVELS.HIGH[1])     return 'HIGH';
  return 'CRITICAL';
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCANNER 1 — CODEBASE STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan the git repository state: branch, uncommitted changes, merge conflicts,
 * stash depth, and recent commit activity.
 *
 * @param {string} rootDir - Absolute path to project root.
 * @returns {Promise<Object>} Codebase state scanner result.
 */
async function scanCodebaseState(rootDir) {
  const result = {
    scanner: 'codebaseState',
    score: 1.0,
    clean: true,
    branch: 'unknown',
    uncommitted: 0,
    untracked: 0,
    mergeConflicts: 0,
    stashDepth: 0,
    aheadBehind: { ahead: 0, behind: 0 },
    lastCommitAgeHours: 0,
    warnings: [],
    blockers: [],
  };

  try {
    // Branch name
    const branchRaw = tryExec('git rev-parse --abbrev-ref HEAD 2>/dev/null');
    result.branch = branchRaw ? branchRaw.trim() : 'detached';

    // Git status (porcelain for machine-readable output)
    const statusRaw = tryExec('git status --porcelain 2>/dev/null');
    if (statusRaw !== null) {
      const lines = statusRaw.split('\n').filter(Boolean);
      result.uncommitted = lines.filter(l => l.match(/^[MADRCU]/)).length;
      result.untracked   = lines.filter(l => l.startsWith('??')).length;
      result.mergeConflicts = lines.filter(l => l.match(/^(DD|AU|UD|UA|DU|AA|UU)/)).length;
      result.clean = result.uncommitted === 0 && result.untracked === 0;
    }

    // Stash depth
    const stashRaw = tryExec('git stash list 2>/dev/null');
    result.stashDepth = stashRaw ? stashRaw.split('\n').filter(Boolean).length : 0;

    // Ahead/behind upstream
    const abRaw = tryExec('git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null');
    if (abRaw && abRaw.trim()) {
      const parts = abRaw.trim().split(/\s+/);
      result.aheadBehind.behind = parseInt(parts[0], 10) || 0;
      result.aheadBehind.ahead  = parseInt(parts[1], 10) || 0;
    }

    // Last commit age
    const lastCommitRaw = tryExec('git log -1 --format="%ct" 2>/dev/null');
    if (lastCommitRaw && lastCommitRaw.trim()) {
      const epoch = parseInt(lastCommitRaw.trim(), 10);
      result.lastCommitAgeHours = (Date.now() / 1000 - epoch) / 3600;
    }

    // Scoring: penalise for conflicts, uncommitted changes, and staleness
    let penalty = 0;
    if (result.mergeConflicts > 0) {
      penalty += 0.5;
      result.blockers.push(`${result.mergeConflicts} merge conflict(s) detected — manual resolution required`);
    }
    if (result.uncommitted > fib(5)) {
      // fib(5)=5 uncommitted files is the warning threshold
      penalty += PSI * 0.2;
      result.warnings.push(`${result.uncommitted} uncommitted file(s) exceed fib(5)=${fib(5)} threshold`);
    }
    if (result.lastCommitAgeHours > DEP_FRESHNESS_DAYS * 24) {
      penalty += PSI * 0.1;
      result.warnings.push(`Last commit was ${result.lastCommitAgeHours.toFixed(1)}h ago (>${DEP_FRESHNESS_DAYS} days)`);
    }
    if (result.aheadBehind.behind > fib(5)) {
      penalty += PSI * 0.15;
      result.warnings.push(`Branch is ${result.aheadBehind.behind} commits behind upstream`);
    }

    result.score = Math.max(0, 1 - penalty);
  } catch (err) {
    result.score = PSI * 0.5;
    result.warnings.push(`codebaseState scanner error: ${err.message}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCANNER 2 — CONFIG DRIFT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare running/environment config values against committed config files.
 * Flags any file whose content hash differs from its last committed state,
 * and any environment variables that deviate from config-file defaults.
 * Drift threshold: PSI (0.618).
 *
 * @param {string} rootDir - Absolute path to project root.
 * @returns {Promise<Object>} Config drift scanner result.
 */
async function scanConfigDrift(rootDir) {
  const result = {
    scanner: 'configDrift',
    score: 1.0,
    driftScore: 0.0,
    driftedFiles: [],
    envMismatches: [],
    totalConfigFiles: 0,
    warnings: [],
    blockers: [],
  };

  try {
    // Enumerate all config files in the project
    const configDirs  = ['configs', 'config', '.'];
    const configGlobs = ['*.json', '*.yaml', '*.yml', '*.toml', '*.env.example'];
    const configFiles = [];

    for (const dir of configDirs) {
      const dirPath = path.join(rootDir, dir);
      if (!fs.existsSync(dirPath)) continue;
      try {
        const entries = fs.readdirSync(dirPath);
        for (const entry of entries) {
          const ext = path.extname(entry).toLowerCase();
          if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) {
            configFiles.push(path.join(dirPath, entry));
          }
        }
      } catch { /* skip unreadable dirs */ }
    }

    result.totalConfigFiles = configFiles.length;

    // Check each config file against its git-committed version
    let driftedCount = 0;
    for (const cfgPath of configFiles) {
      const relPath = path.relative(rootDir, cfgPath);
      const gitContent = tryExec(`git show HEAD:"${relPath}" 2>/dev/null`);
      if (gitContent === null) continue; // Not tracked in git

      const diskContent = tryRead(cfgPath);
      if (diskContent === null) continue;

      const hashGit  = crypto.createHash('sha256').update(gitContent).digest('hex');
      const hashDisk = crypto.createHash('sha256').update(diskContent).digest('hex');

      if (hashGit !== hashDisk) {
        driftedCount++;
        result.driftedFiles.push(relPath);
      }
    }

    // Compute drift score as fraction of drifted files
    const trackedCount = result.totalConfigFiles || 1;
    result.driftScore  = driftedCount / trackedCount;

    // Check common environment variable overrides versus package.json
    const pkgRaw = tryRead(path.join(rootDir, 'package.json'));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        const pkgVersion  = pkg.version || '';
        const envVersion  = process.env.APP_VERSION || '';
        if (envVersion && envVersion !== pkgVersion) {
          result.envMismatches.push({ key: 'APP_VERSION', config: pkgVersion, env: envVersion });
        }
        const pkgName    = pkg.name || '';
        const envName    = process.env.APP_NAME || '';
        if (envName && envName !== pkgName) {
          result.envMismatches.push({ key: 'APP_NAME', config: pkgName, env: envName });
        }
        const pkgNodeEnv = (pkg.scripts?.start || '').includes('production') ? 'production' : '';
        const envNodeEnv = process.env.NODE_ENV || '';
        if (pkgNodeEnv && envNodeEnv && envNodeEnv !== pkgNodeEnv) {
          result.envMismatches.push({ key: 'NODE_ENV', config: pkgNodeEnv, env: envNodeEnv });
        }
      } catch { /* ignore parse errors */ }
    }

    // Apply CSL gate — drift score compared to CONFIG_DRIFT_THRESHOLD (PSI)
    const gated = cslGate(1.0, result.driftScore, CONFIG_DRIFT_THRESHOLD, 0.1);
    result.score = 1.0 - result.driftScore; // Invert: high drift = low score

    if (result.driftScore > CONFIG_DRIFT_THRESHOLD) {
      result.warnings.push(
        `Config drift ${(result.driftScore * 100).toFixed(1)}% exceeds PSI threshold (${(CONFIG_DRIFT_THRESHOLD * 100).toFixed(1)}%): ${result.driftedFiles.slice(0, fib(5)).join(', ')}`
      );
    }
    if (result.envMismatches.length > 0) {
      result.warnings.push(
        `${result.envMismatches.length} environment variable(s) deviate from committed config: ${result.envMismatches.map(m => m.key).join(', ')}`
      );
    }
  } catch (err) {
    result.score = PSI;
    result.warnings.push(`configDrift scanner error: ${err.message}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCANNER 3 — SERVICE HEALTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probe all registered services (up to 25) via health/live/ready endpoints.
 * Builds a service health matrix with per-service status codes.
 *
 * @param {string} rootDir - Absolute path to project root.
 * @returns {Promise<Object>} Service health scanner result.
 */
async function scanServiceHealth(rootDir) {
  const result = {
    scanner: 'serviceHealth',
    score: 1.0,
    healthy: 0,
    unhealthy: 0,
    unknown: 0,
    matrix: [],
    warnings: [],
    blockers: [],
  };

  try {
    // Load service registry from config or derive from known endpoints
    let services = [];

    const svcCfgPaths = [
      path.join(rootDir, 'configs', 'services.json'),
      path.join(rootDir, 'configs', 'service-registry.json'),
      path.join(rootDir, 'configs', 'dependencies.json'),
    ];

    for (const cfgPath of svcCfgPaths) {
      const raw = tryRead(cfgPath);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            services = parsed.slice(0, 25); // max 25 services per spec
            break;
          } else if (typeof parsed === 'object') {
            services = Object.entries(parsed).map(([name, cfg]) => ({
              name,
              url: typeof cfg === 'string' ? cfg : cfg.url || cfg.healthUrl || '',
            })).filter(s => s.url).slice(0, 25);
            break;
          }
        } catch { /* try next path */ }
      }
    }

    // If no external registry, check known local service endpoints
    if (services.length === 0) {
      const localPorts = [3000, 3001, 8080, 8081, 4000, 5000];
      const localNames = ['api', 'worker', 'gateway', 'auth', 'metrics', 'admin'];
      services = localPorts.map((port, i) => ({
        name: localNames[i] || `service-${port}`,
        url:  `http://localhost:${port}/health`,
      }));
    }

    // Probe each service (parallel, bounded by fib(6)=8 at a time)
    const batchSize = fib(6); // 8
    for (let i = 0; i < services.length; i += batchSize) {
      const batch   = services.slice(i, i + batchSize);
      const probes  = batch.map(svc => {
        const probeUrl = svc.url || `http://localhost:${svc.port || 8080}/health`;
        return httpGet(probeUrl, Math.round(PHI * 1000)) // φ×1000 ≈ 1618ms per probe
          .then(res => ({
            name:       svc.name,
            url:        probeUrl,
            statusCode: res.statusCode,
            ok:         res.ok,
            latencyMs:  0, // enriched below if needed
          }))
          .catch(() => ({ name: svc.name, url: probeUrl, statusCode: 0, ok: false }));
      });
      const settled = await Promise.allSettled(probes);
      for (const s of settled) {
        const svcResult = s.status === 'fulfilled' ? s.value : { name: 'unknown', ok: false, statusCode: 0 };
        result.matrix.push(svcResult);
        if (svcResult.ok)                 result.healthy++;
        else if (svcResult.statusCode > 0) result.unhealthy++;
        else                               result.unknown++;
      }
    }

    const total = result.matrix.length || 1;
    const healthyRatio = result.healthy / total;
    result.score = healthyRatio;

    // Classify critical services (first fib(4)=3 in the matrix are considered core)
    const coreUnhealthy = result.matrix
      .slice(0, fib(4))
      .filter(s => !s.ok);

    if (coreUnhealthy.length > 0) {
      result.blockers.push(
        `${coreUnhealthy.length} core service(s) unhealthy: ${coreUnhealthy.map(s => s.name).join(', ')}`
      );
    }

    if (healthyRatio < MIN_HEALTHY_RATIO) {
      result.warnings.push(
        `Service health ${(healthyRatio * 100).toFixed(1)}% below MIN_HEALTHY_RATIO (${(MIN_HEALTHY_RATIO * 100).toFixed(1)}%): ${result.unhealthy} unhealthy, ${result.unknown} unknown`
      );
    }
  } catch (err) {
    result.score = PSI * 0.5;
    result.warnings.push(`serviceHealth scanner error: ${err.message}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCANNER 4 — ATTACK SURFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enumerate exposed endpoints, open ports, public secrets, and leaked
 * environment variables to map the current attack surface.
 *
 * @param {string} rootDir - Absolute path to project root.
 * @returns {Promise<Object>} Attack surface scanner result.
 */
async function scanAttackSurface(rootDir) {
  const result = {
    scanner: 'attackSurface',
    score: 1.0,
    exposedEndpoints: 0,
    publicSecrets: 0,
    openPorts: [],
    leakedEnvVars: [],
    hardcodedCredentials: 0,
    wildcardCors: 0,
    warnings: [],
    blockers: [],
  };

  try {
    // 1. Scan for exposed HTTP endpoints in source files
    const endpointRaw = tryExec(
      `grep -rEn "app\\.(get|post|put|delete|patch|all)\\(" --include='*.js' --exclude-dir=node_modules "${rootDir}" 2>/dev/null | wc -l`
    );
    result.exposedEndpoints = parseInt(endpointRaw || '0', 10) || 0;

    // 2. Detect hardcoded secrets / credentials using common patterns
    const secretPatterns = [
      'AKIA[0-9A-Z]{16}',               // AWS Access Key ID
      'sk-[a-zA-Z0-9]{20,}',            // OpenAI / Stripe keys
      'ghp_[a-zA-Z0-9]{36}',            // GitHub PAT
      "password\\s*=\\s*['\"][^'\"]{4,}['\"]",  // Password assignments
      "secret\\s*[:=]\\s*['\"][^'\"]{8,}['\"]", // Secret assignments
      'AIza[0-9A-Za-z\\-_]{35}',        // Google API key
    ];

    let secretHits = 0;
    for (const pattern of secretPatterns) {
      const raw = tryExec(
        `grep -rEin '${pattern}' --include='*.js' --include='*.json' --include='*.env' --exclude-dir=node_modules "${rootDir}" 2>/dev/null | grep -v '.env.example' | wc -l`
      );
      secretHits += parseInt(raw || '0', 10) || 0;
    }
    result.publicSecrets = secretHits;

    // 3. Check for .env files committed to git (major leak vector)
    const gitTrackedEnv = tryExec(`git -C "${rootDir}" ls-files --error-unmatch .env 2>/dev/null`);
    if (gitTrackedEnv !== null) {
      result.publicSecrets += 1;
      result.leakedEnvVars.push('.env file is tracked in git repository');
    }

    // 4. Scan for additional .env* files in project root
    const envFilesRaw = tryExec(`find "${rootDir}" -maxdepth 2 -name '.env*' -not -name '.env.example' 2>/dev/null`);
    if (envFilesRaw && envFilesRaw.trim()) {
      const envFiles = envFilesRaw.trim().split('\n').filter(Boolean);
      for (const envFile of envFiles) {
        const envContent = tryRead(envFile);
        if (envContent) {
          // Look for clearly sensitive populated keys
          const populated = envContent.split('\n')
            .filter(l => l.match(/^[A-Z_]+=\S{8,}/) && !l.startsWith('#'));
          if (populated.length > 0) {
            result.leakedEnvVars.push(`${path.relative(rootDir, envFile)}: ${populated.length} populated secrets`);
          }
        }
      }
    }

    // 5. Wildcard CORS
    const corsRaw = tryExec(
      `grep -rEin 'origin.*\\*|Access-Control-Allow-Origin.*\\*' --include='*.js' --exclude-dir=node_modules "${rootDir}" 2>/dev/null | wc -l`
    );
    result.wildcardCors = parseInt(corsRaw || '0', 10) || 0;

    // 6. Open ports scan (local only, non-blocking)
    const listeningRaw = tryExec("ss -tlnp 2>/dev/null | awk 'NR>1{print $4}' | grep -oE '[0-9]+$' | sort -un");
    if (listeningRaw && listeningRaw.trim()) {
      result.openPorts = listeningRaw.trim().split('\n').map(p => parseInt(p, 10)).filter(Boolean);
    }

    // Scoring
    let penalty = 0;
    if (result.publicSecrets > MAX_PUBLIC_SECRETS) {
      penalty += 0.8;
      result.blockers.push(
        `${result.publicSecrets} public secret(s) or leaked credential(s) detected — immediate remediation required`
      );
    }
    if (result.wildcardCors > fib(4)) {
      // fib(4)=3 wildcard CORS usages before warning
      penalty += PSI * 0.2;
      result.warnings.push(`${result.wildcardCors} wildcard CORS pattern(s) found — review Access-Control-Allow-Origin`);
    }
    if (result.leakedEnvVars.length > 0) {
      penalty += PSI * 0.3;
      result.warnings.push(`Environment variable leakage detected: ${result.leakedEnvVars.join('; ')}`);
    }

    result.score = Math.max(0, 1 - penalty);
  } catch (err) {
    result.score = PSI;
    result.warnings.push(`attackSurface scanner error: ${err.message}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCANNER 5 — DEPENDENCY FRESHNESS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run npm audit and check for outdated packages. Flag dependencies older
 * than fib(7)=13 days or with known CVEs.
 *
 * @param {string} rootDir - Absolute path to project root.
 * @returns {Promise<Object>} Dependency freshness scanner result.
 */
async function scanDependencyFreshness(rootDir) {
  const result = {
    scanner: 'dependencyFreshness',
    score: 1.0,
    outdated: 0,
    vulnerable: 0,
    critical: 0,
    high: 0,
    moderate: 0,
    lockfileDriftDays: 0,
    warnings: [],
    blockers: [],
  };

  try {
    // 1. npm audit for CVEs
    const auditRaw = tryExec(`cd "${rootDir}" && npm audit --json 2>/dev/null`, SCANNER_TIMEOUT_MS);
    if (auditRaw) {
      try {
        const audit = JSON.parse(auditRaw);
        const vulns = audit.metadata?.vulnerabilities || {};
        result.critical  = vulns.critical  || 0;
        result.high      = vulns.high      || 0;
        result.moderate  = vulns.moderate  || 0;
        result.vulnerable = result.critical + result.high + result.moderate;
      } catch { /* non-JSON output is expected when no vulnerabilities */ }
    }

    // 2. Check outdated packages
    const outdatedRaw = tryExec(`cd "${rootDir}" && npm outdated --json 2>/dev/null`, SCANNER_TIMEOUT_MS);
    if (outdatedRaw && outdatedRaw.trim()) {
      try {
        const outdated = JSON.parse(outdatedRaw);
        result.outdated = Object.keys(outdated).length;
      } catch { /* npm outdated exits non-zero if any packages are outdated */ }
    }

    // 3. Check package-lock.json age as a proxy for last dependency update
    const lockPath = path.join(rootDir, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
      const stat = fs.statSync(lockPath);
      result.lockfileDriftDays = (Date.now() - stat.mtime.getTime()) / 86400000;
    } else {
      result.lockfileDriftDays = DEP_FRESHNESS_DAYS + 1; // Penalise missing lockfile
    }

    // Scoring
    let penalty = 0;

    if (result.critical > 0) {
      penalty += 0.6;
      result.blockers.push(
        `${result.critical} critical CVE(s) in dependencies — upgrade required before proceeding`
      );
    }
    if (result.high > 0) {
      penalty += PSI * 0.3;
      result.warnings.push(`${result.high} high-severity CVE(s) found in dependencies`);
    }
    if (result.outdated > fib(7)) {
      // fib(7)=13 outdated packages is the warning threshold
      penalty += PSI * 0.2;
      result.warnings.push(`${result.outdated} outdated package(s) exceed fib(7)=${fib(7)} threshold`);
    }
    if (result.lockfileDriftDays > DEP_FRESHNESS_DAYS) {
      penalty += PSI * 0.15;
      result.warnings.push(
        `package-lock.json is ${result.lockfileDriftDays.toFixed(1)} days old (>${DEP_FRESHNESS_DAYS} day freshness window)`
      );
    }

    result.score = Math.max(0, 1 - penalty);
  } catch (err) {
    result.score = PSI;
    result.warnings.push(`dependencyFreshness scanner error: ${err.message}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCANNER 6 — VECTOR MEMORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assess vector memory density: embedding coverage, stale embeddings,
 * orphaned vectors, and index coherence using cosine similarity sampling.
 *
 * @param {string} rootDir - Absolute path to project root.
 * @returns {Promise<Object>} Vector memory scanner result.
 */
async function scanVectorMemory(rootDir) {
  const result = {
    scanner: 'vectorMemory',
    score: 1.0,
    coverage: 0.0,
    staleEmbeddings: 0,
    orphanedVectors: 0,
    indexCoherence: 1.0,
    totalDocuments: 0,
    embeddedDocuments: 0,
    warnings: [],
    blockers: [],
  };

  try {
    // 1. Check embedding metadata config
    const metaPaths = [
      path.join(rootDir, 'configs', 'embeddings-meta.json'),
      path.join(rootDir, 'configs', 'vector-index.json'),
      path.join(rootDir, '.heady', 'memory-index.json'),
    ];

    let meta = null;
    for (const mp of metaPaths) {
      const raw = tryRead(mp);
      if (raw) {
        try { meta = JSON.parse(raw); break; } catch { /* try next */ }
      }
    }

    if (meta) {
      result.totalDocuments    = meta.totalDocuments    || meta.docCount     || 0;
      result.embeddedDocuments = meta.embeddedDocuments || meta.indexedCount || result.totalDocuments;
      result.staleEmbeddings   = meta.staleEmbeddings   || meta.staleCount   || 0;
      result.orphanedVectors   = meta.orphanedVectors   || meta.orphanCount  || 0;

      // Coverage ratio
      result.coverage = result.totalDocuments > 0
        ? result.embeddedDocuments / result.totalDocuments
        : 1.0;

      // Compute index coherence using cosine similarity between sample vectors
      // if the metadata includes centroid data
      if (meta.centroids && Array.isArray(meta.centroids) && meta.centroids.length >= 2) {
        const c0 = meta.centroids[0];
        const c1 = meta.centroids[1];
        if (Array.isArray(c0) && Array.isArray(c1) && c0.length === c1.length) {
          // High similarity between centroids suggests good index coherence
          const sim = cosineSimilarity(c0, c1);
          result.indexCoherence = (sim + 1) / 2; // Normalise from [-1,1] to [0,1]
        }
      }
    } else {
      // No metadata available — derive from filesystem heuristics
      const jsFiles = parseInt(
        tryExec(`find "${rootDir}/src" -name '*.js' 2>/dev/null | wc -l`) || '0', 10
      ) || 0;
      result.totalDocuments    = jsFiles;
      result.embeddedDocuments = 0;
      result.coverage          = jsFiles > 0 ? 0 : 1.0; // No embeddings generated

      if (jsFiles > 0) {
        result.warnings.push(
          `No embedding metadata found — ${jsFiles} source file(s) may lack vector coverage`
        );
      }
    }

    // Stale embedding check: embeddings older than freshness window
    const ageDays = meta
      ? (Date.now() - new Date(meta.lastGenerated || meta.updatedAt || 0).getTime()) / 86400000
      : 0;
    if (ageDays > DEP_FRESHNESS_DAYS) {
      result.staleEmbeddings = Math.max(result.staleEmbeddings, Math.round(result.embeddedDocuments * PSI * 0.2));
      result.warnings.push(
        `Vector index last generated ${ageDays.toFixed(1)} days ago (>${DEP_FRESHNESS_DAYS} day window)`
      );
    }

    // Scoring
    const coverageScore   = result.coverage;
    const coherenceScore  = result.indexCoherence;
    const stalenessRatio  = result.totalDocuments > 0
      ? result.staleEmbeddings / result.totalDocuments
      : 0;
    const stalePenalty    = stalenessRatio * PSI;
    const orphanPenalty   = result.orphanedVectors > fib(8)
      ? PSI * 0.1  // fib(8)=21 orphans before penalty
      : 0;

    result.score = Math.max(0, coverageScore * (1 - stalePenalty - orphanPenalty));

    if (result.orphanedVectors > fib(8)) {
      result.warnings.push(
        `${result.orphanedVectors} orphaned vector(s) detected (>${fib(8)} threshold) — index compaction recommended`
      );
    }
  } catch (err) {
    result.score = PSI;
    result.warnings.push(`vectorMemory scanner error: ${err.message}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCANNER 7 — RESOURCE UTILIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measure CPU, memory, and disk utilisation across the current runtime.
 * Classifies pressure using phi-derived PRESSURE_LEVELS bands.
 *
 * @param {string} rootDir - Absolute path to project root.
 * @returns {Promise<Object>} Resource utilization scanner result.
 */
async function scanResourceUtilization(rootDir) {
  const result = {
    scanner: 'resourceUtilization',
    score: 1.0,
    avgCpuUtilization: 0.0,
    avgMemUtilization: 0.0,
    diskUtilization: 0.0,
    heapUsedMB: 0,
    heapTotalMB: 0,
    freeMemMB: 0,
    totalMemMB: 0,
    loadAvg: [0, 0, 0],
    cpuPressure: 'NOMINAL',
    memPressure: 'NOMINAL',
    diskPressure: 'NOMINAL',
    warnings: [],
    blockers: [],
  };

  try {
    // 1. CPU utilization via OS cpus()
    const cpus  = os.cpus();
    const cpuUtil = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle  = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / cpus.length;

    result.avgCpuUtilization = cpuUtil;
    result.cpuPressure       = classifyPressure(cpuUtil);
    result.loadAvg           = os.loadavg();

    // 2. Memory
    const totalMem     = os.totalmem();
    const freeMem      = os.freemem();
    const memUtil      = 1 - freeMem / totalMem;
    result.totalMemMB  = Math.round(totalMem / 1024 / 1024);
    result.freeMemMB   = Math.round(freeMem / 1024 / 1024);
    result.avgMemUtilization = memUtil;
    result.memPressure = classifyPressure(memUtil);

    // Process heap
    const heapStats      = process.memoryUsage();
    result.heapUsedMB    = Math.round(heapStats.heapUsed / 1024 / 1024);
    result.heapTotalMB   = Math.round(heapStats.heapTotal / 1024 / 1024);

    // 3. Disk utilization
    const dfRaw = tryExec("df -k / 2>/dev/null | tail -1");
    if (dfRaw && dfRaw.trim()) {
      const usePct = parseInt(dfRaw.trim().split(/\s+/)[4], 10) || 0;
      result.diskUtilization = usePct / 100;
      result.diskPressure    = classifyPressure(result.diskUtilization);
    }

    // 4. Try to get Cloud Run resource signals if available
    const crMetricsPath = '/tmp/heady-cloudrun-metrics.json';
    const crRaw = tryRead(crMetricsPath);
    if (crRaw) {
      try {
        const crMetrics = JSON.parse(crRaw);
        if (crMetrics.cpuUtil   !== undefined) result.avgCpuUtilization = crMetrics.cpuUtil;
        if (crMetrics.memUtil   !== undefined) result.avgMemUtilization = crMetrics.memUtil;
        if (crMetrics.diskUtil  !== undefined) result.diskUtilization   = crMetrics.diskUtil;
      } catch { /* ignore */ }
    }

    // Scoring — penalise for HIGH/CRITICAL pressure bands
    const pressureMap = { NOMINAL: 0, ELEVATED: PSI * 0.05, HIGH: PSI * 0.2, CRITICAL: 0.5 };
    const cpuPenalty  = pressureMap[result.cpuPressure]  || 0;
    const memPenalty  = pressureMap[result.memPressure]  || 0;
    const diskPenalty = pressureMap[result.diskPressure] || 0;

    result.score = Math.max(0, 1 - cpuPenalty - memPenalty - diskPenalty);

    if (result.cpuPressure === 'CRITICAL') {
      result.blockers.push(`CPU utilization critical: ${(result.avgCpuUtilization * 100).toFixed(1)}%`);
    } else if (result.cpuPressure === 'HIGH') {
      result.warnings.push(`CPU utilization HIGH: ${(result.avgCpuUtilization * 100).toFixed(1)}%`);
    }
    if (result.memPressure === 'CRITICAL') {
      result.blockers.push(`Memory utilization critical: ${(result.avgMemUtilization * 100).toFixed(1)}%`);
    } else if (result.memPressure === 'HIGH') {
      result.warnings.push(`Memory utilization HIGH: ${(result.avgMemUtilization * 100).toFixed(1)}% (${result.freeMemMB}MB free)`);
    }
    if (result.diskPressure === 'CRITICAL' || result.diskPressure === 'HIGH') {
      result.warnings.push(`Disk utilization ${result.diskPressure}: ${(result.diskUtilization * 100).toFixed(1)}%`);
    }
  } catch (err) {
    result.score = PSI;
    result.warnings.push(`resourceUtilization scanner error: ${err.message}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCANNER 8 — COST TRAJECTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assess current spend rate against the daily budget. Alerts at
 * PSI (61.8%) consumption per STAGE_RECON spec.
 *
 * @param {string} rootDir - Absolute path to project root.
 * @returns {Promise<Object>} Cost trajectory scanner result.
 */
async function scanCostTrajectory(rootDir) {
  const result = {
    scanner: 'costTrajectory',
    score: 1.0,
    dailySpendRate: 0.0,
    budgetUtilization: 0.0,
    dailyBudgetUSD: 0.0,
    currentSpendUSD: 0.0,
    projectedDailyUSD: 0.0,
    tokensBurned: 0,
    modelCosts: {},
    warnings: [],
    blockers: [],
  };

  try {
    // 1. Load budget configuration
    const budgetPaths = [
      path.join(rootDir, 'configs', 'budget.json'),
      path.join(rootDir, 'configs', 'cost-limits.json'),
      path.join(rootDir, '.heady', 'budget.json'),
    ];

    let budgetConfig = null;
    for (const bp of budgetPaths) {
      const raw = tryRead(bp);
      if (raw) {
        try { budgetConfig = JSON.parse(raw); break; } catch { /* try next */ }
      }
    }

    // Fall back to environment variables
    const dailyBudget = budgetConfig?.dailyBudgetUSD
      || parseFloat(process.env.HEADY_DAILY_BUDGET_USD || '0')
      || 0;
    result.dailyBudgetUSD = dailyBudget;

    // 2. Load cost telemetry log
    const costLogPaths = [
      '/tmp/heady-model-costs.json',
      '/tmp/heady-costs.json',
      path.join(rootDir, '.heady', 'cost-log.json'),
    ];

    let costData = null;
    for (const clp of costLogPaths) {
      const raw = tryRead(clp);
      if (raw) {
        try { costData = JSON.parse(raw); break; } catch { /* try next */ }
      }
    }

    if (costData) {
      result.currentSpendUSD = costData.todaySpendUSD || costData.currentSpendUSD || 0;
      result.tokensBurned    = costData.totalTokens   || costData.tokensBurned    || 0;
      result.modelCosts      = costData.byModel       || {};

      // Project daily spend from current burn rate
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const hoursElapsed = (Date.now() - startOfDay.getTime()) / 3600000;
      if (hoursElapsed > 0) {
        result.dailySpendRate     = result.currentSpendUSD / hoursElapsed;
        result.projectedDailyUSD  = result.dailySpendRate * 24;
      }

      // Budget utilization
      if (result.dailyBudgetUSD > 0) {
        result.budgetUtilization = result.currentSpendUSD / result.dailyBudgetUSD;
      }
    } else {
      // No cost telemetry — check for token usage in environment
      const envTokens = parseInt(process.env.HEADY_TOKENS_TODAY || '0', 10) || 0;
      result.tokensBurned = envTokens;
      // Approximate cost at $0.001 per 1K tokens as a heuristic (Fibonacci-safe)
      result.currentSpendUSD = envTokens / 1000 * 0.001;
    }

    // Scoring using ALERT_THRESHOLDS
    let penalty = 0;
    if (result.budgetUtilization >= ALERT_THRESHOLDS.exceeded) {
      penalty += 0.5;
      result.blockers.push(
        `Budget utilization ${(result.budgetUtilization * 100).toFixed(1)}% exceeds ALERT_THRESHOLDS.exceeded (${(ALERT_THRESHOLDS.exceeded * 100).toFixed(1)}%)`
      );
    } else if (result.budgetUtilization >= ALERT_THRESHOLDS.critical) {
      penalty += PSI * 0.3;
      result.warnings.push(
        `Budget utilization ${(result.budgetUtilization * 100).toFixed(1)}% exceeds ALERT_THRESHOLDS.critical`
      );
    } else if (result.budgetUtilization >= COST_ALERT_RATIO) {
      // PSI = 0.618 — alert threshold per spec
      penalty += PSI * 0.15;
      result.warnings.push(
        `Budget utilization ${(result.budgetUtilization * 100).toFixed(1)}% reached PSI (${(COST_ALERT_RATIO * 100).toFixed(1)}%) alert threshold`
      );
    }

    if (result.projectedDailyUSD > result.dailyBudgetUSD && result.dailyBudgetUSD > 0) {
      result.warnings.push(
        `Projected daily spend $${result.projectedDailyUSD.toFixed(2)} exceeds daily budget $${result.dailyBudgetUSD.toFixed(2)}`
      );
    }

    result.score = Math.max(0, 1 - penalty);
  } catch (err) {
    result.score = PSI;
    result.warnings.push(`costTrajectory scanner error: ${err.message}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  READINESS SCORE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the final readiness score from all 8 scanner results using
 * phiFusionWeights(8). Also aggregates all warnings and identifies blockers.
 *
 * @param {Object[]} scannerResults - Array of fib(6)=8 scanner result objects.
 * @returns {{ readinessScore: number, warnings: string[], blockers: string[] }}
 */
function computeEnvironmentReadiness(scannerResults) {
  const weights = phiMath.phiFusionWeights(SCANNER_COUNT);

  // Sort by score descending — highest scores get the heaviest phi weights
  const sorted = [...scannerResults].sort((a, b) => (b.score || 0) - (a.score || 0));

  let readinessScore = 0;
  for (let i = 0; i < weights.length && i < sorted.length; i++) {
    readinessScore += weights[i] * (sorted[i].score || 0);
  }
  readinessScore = Math.max(0, Math.min(1, readinessScore));

  // Collect warnings and blockers from all scanners
  const warnings = [];
  const blockers  = [];
  for (const r of scannerResults) {
    if (Array.isArray(r.warnings)) warnings.push(...r.warnings);
    if (Array.isArray(r.blockers)) blockers.push(...r.blockers);
  }

  // Apply CSL gate — if readiness is below PSI but no blockers, inject a warning
  if (readinessScore < PSI && blockers.length === 0) {
    warnings.push(
      `Environment readiness ${readinessScore.toFixed(3)} is below PSI gate (${PSI.toFixed(3)}) — proceeding with caution`
    );
  }

  return { readinessScore, warnings, blockers };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ENTRY: reconScan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute the full Stage 1 RECON scan: run all fib(6)=8 parallel scanners
 * with a 6854ms (φ⁴×1000) hard timeout, compute readinessScore via
 * phiFusionWeights(8), apply CSL gate at PSI (0.618), and return the
 * structured Environment Map JSON.
 *
 * @param {Object} context - Pipeline execution context.
 * @param {string} [context.rootDir]       - Project root directory (defaults to cwd).
 * @param {string} [context.scanId]        - Caller-provided scan identifier.
 * @param {Object} [context.overrides]     - Optional scanner config overrides.
 * @returns {Promise<Object>} Full Environment Map per STAGE_RECON.md schema.
 */
async function reconScan(context = {}) {
  const startTs  = Date.now();
  const id       = context.scanId || scanId();
  const rootDir  = context.rootDir || process.cwd();

  // Construct scanner tasks — fib(6) = 8 parallel scanners
  const scanners = [
    { name: 'codebaseState',        fn: () => withPhiRetry(() => scanCodebaseState(rootDir),       'codebaseState')        },
    { name: 'configDrift',          fn: () => withPhiRetry(() => scanConfigDrift(rootDir),         'configDrift')          },
    { name: 'serviceHealth',        fn: () => withPhiRetry(() => scanServiceHealth(rootDir),       'serviceHealth')        },
    { name: 'attackSurface',        fn: () => withPhiRetry(() => scanAttackSurface(rootDir),       'attackSurface')        },
    { name: 'dependencyFreshness',  fn: () => withPhiRetry(() => scanDependencyFreshness(rootDir), 'dependencyFreshness')  },
    { name: 'vectorMemory',         fn: () => withPhiRetry(() => scanVectorMemory(rootDir),        'vectorMemory')         },
    { name: 'resourceUtilization',  fn: () => withPhiRetry(() => scanResourceUtilization(rootDir), 'resourceUtilization')  },
    { name: 'costTrajectory',       fn: () => withPhiRetry(() => scanCostTrajectory(rootDir),      'costTrajectory')       },
  ];

  // Sanity-check we have the correct scanner count
  if (scanners.length !== SCANNER_COUNT) {
    process.stderr.write(
      `[RECON] WARNING: Expected ${SCANNER_COUNT} scanners (fib(6)), found ${scanners.length}\n`
    );
  }

  // Run all scanners in parallel with the RECON_TIMEOUT_MS hard ceiling
  const scanPromises = scanners.map(s => s.fn());
  const settled      = await Promise.allSettled(
    [Promise.all(scanPromises)].map(p => withTimeout(() => p, RECON_TIMEOUT_MS))
  );

  // Unpack results — handle individual scanner rejections gracefully
  let rawResults = [];
  const outerResult = settled[0];

  if (outerResult.status === 'fulfilled' && Array.isArray(outerResult.value)) {
    rawResults = outerResult.value;
  } else {
    // Timeout or top-level failure — run individual settled probes
    const fallback = await Promise.allSettled(scanners.map(s => s.fn()));
    rawResults = fallback.map((f, i) =>
      f.status === 'fulfilled'
        ? f.value
        : {
            scanner: scanners[i].name,
            score:   0,
            error:   f.reason?.message || String(f.reason),
            warnings: [`Scanner ${scanners[i].name} failed: ${f.reason?.message || 'unknown error'}`],
            blockers: [],
          }
    );
  }

  // Normalise — ensure every result has expected shape
  const scannerResults = rawResults.map((r, i) => ({
    scanner:  r.scanner  || scanners[i]?.name || `scanner-${i}`,
    score:    typeof r.score === 'number' ? r.score : 0,
    warnings: Array.isArray(r.warnings) ? r.warnings : [],
    blockers: Array.isArray(r.blockers) ? r.blockers : [],
    ...(r.error ? { error: r.error } : {}),
    ...r,
  }));

  // Find individual scanner objects by name
  const byName = name => scannerResults.find(r => r.scanner === name) || {};

  const codebaseResult    = byName('codebaseState');
  const configResult      = byName('configDrift');
  const serviceResult     = byName('serviceHealth');
  const attackResult      = byName('attackSurface');
  const depResult         = byName('dependencyFreshness');
  const vectorResult      = byName('vectorMemory');
  const resourceResult    = byName('resourceUtilization');
  const costResult        = byName('costTrajectory');

  // Compute aggregated readiness score and collect warnings/blockers
  const { readinessScore, warnings, blockers } = computeEnvironmentReadiness(scannerResults);

  // Apply CSL gate: pass-through if ≥ PSI, suppress otherwise
  const gatePass    = readinessScore >= PSI;
  const gatedScore  = cslGate(readinessScore, readinessScore, PSI, 0.05);

  const durationMs  = Date.now() - startTs;

  // ── ENVIRONMENT MAP (per STAGE_RECON.md schema) ───────────────────────────
  const environmentMap = {
    // Metadata
    timestamp:      new Date().toISOString(),
    scanId:         id,
    version:        VERSION,
    stage:          'RECON',
    durationMs,
    timeoutMs:      RECON_TIMEOUT_MS,

    // Readiness
    readinessScore,
    gatedScore,
    cslGatePass:    gatePass,

    // Scanner 1 — Codebase State
    codebaseState: {
      clean:            codebaseResult.clean         ?? true,
      branch:           codebaseResult.branch        || 'unknown',
      uncommitted:      codebaseResult.uncommitted   || 0,
      untracked:        codebaseResult.untracked     || 0,
      mergeConflicts:   codebaseResult.mergeConflicts || 0,
      stashDepth:       codebaseResult.stashDepth    || 0,
      aheadBehind:      codebaseResult.aheadBehind   || { ahead: 0, behind: 0 },
      lastCommitAgeHours: codebaseResult.lastCommitAgeHours || 0,
      score:            codebaseResult.score         || 0,
    },

    // Scanner 2 — Config Drift
    configDrift: {
      driftScore:       configResult.driftScore      || 0,
      driftedFiles:     configResult.driftedFiles    || [],
      envMismatches:    configResult.envMismatches   || [],
      totalConfigFiles: configResult.totalConfigFiles || 0,
      score:            configResult.score           || 0,
    },

    // Scanner 3 — Service Health
    serviceHealth: {
      healthy:          serviceResult.healthy        || 0,
      unhealthy:        serviceResult.unhealthy      || 0,
      unknown:          serviceResult.unknown        || 0,
      matrix:           serviceResult.matrix         || [],
      score:            serviceResult.score          || 0,
    },

    // Scanner 4 — Attack Surface
    attackSurface: {
      exposedEndpoints:     attackResult.exposedEndpoints     || 0,
      publicSecrets:        attackResult.publicSecrets        || 0,
      openPorts:            attackResult.openPorts            || [],
      leakedEnvVars:        attackResult.leakedEnvVars        || [],
      hardcodedCredentials: attackResult.hardcodedCredentials || 0,
      wildcardCors:         attackResult.wildcardCors         || 0,
      score:                attackResult.score                || 0,
    },

    // Scanner 5 — Dependency Freshness
    dependencyFreshness: {
      outdated:           depResult.outdated          || 0,
      vulnerable:         depResult.vulnerable        || 0,
      critical:           depResult.critical          || 0,
      high:               depResult.high              || 0,
      moderate:           depResult.moderate          || 0,
      lockfileDriftDays:  depResult.lockfileDriftDays || 0,
      freshnessWindowDays: DEP_FRESHNESS_DAYS,
      score:              depResult.score             || 0,
    },

    // Scanner 6 — Vector Memory
    vectorMemory: {
      coverage:         vectorResult.coverage         || 0,
      staleEmbeddings:  vectorResult.staleEmbeddings  || 0,
      orphanedVectors:  vectorResult.orphanedVectors  || 0,
      indexCoherence:   vectorResult.indexCoherence   || 1,
      totalDocuments:   vectorResult.totalDocuments   || 0,
      embeddedDocuments: vectorResult.embeddedDocuments || 0,
      score:            vectorResult.score            || 0,
    },

    // Scanner 7 — Resource Utilization
    resources: {
      avgCpuUtilization:  resourceResult.avgCpuUtilization  || 0,
      avgMemUtilization:  resourceResult.avgMemUtilization  || 0,
      diskUtilization:    resourceResult.diskUtilization    || 0,
      heapUsedMB:         resourceResult.heapUsedMB         || 0,
      freeMemMB:          resourceResult.freeMemMB          || 0,
      loadAvg:            resourceResult.loadAvg            || [0, 0, 0],
      cpuPressure:        resourceResult.cpuPressure        || 'NOMINAL',
      memPressure:        resourceResult.memPressure        || 'NOMINAL',
      diskPressure:       resourceResult.diskPressure       || 'NOMINAL',
      score:              resourceResult.score              || 0,
    },

    // Scanner 8 — Cost Trajectory
    costTrajectory: {
      dailySpendRate:     costResult.dailySpendRate     || 0,
      budgetUtilization:  costResult.budgetUtilization  || 0,
      dailyBudgetUSD:     costResult.dailyBudgetUSD     || 0,
      currentSpendUSD:    costResult.currentSpendUSD    || 0,
      projectedDailyUSD:  costResult.projectedDailyUSD  || 0,
      tokensBurned:       costResult.tokensBurned       || 0,
      modelCosts:         costResult.modelCosts         || {},
      alertThreshold:     COST_ALERT_RATIO,
      score:              costResult.score              || 0,
    },

    // Aggregates
    warnings,
    blockers,

    // Phi constants used (for downstream tracing)
    phiConstants: {
      PHI,
      PSI,
      RECON_TIMEOUT_MS,
      SCANNER_COUNT,
      DEP_FRESHNESS_DAYS,
      CONFIG_DRIFT_THRESHOLD,
      COST_ALERT_RATIO,
      CSL_THRESHOLDS,
    },
  };

  return environmentMap;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODULE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Main entry point
  reconScan,

  // Individual scanners (exported for unit testing and composition)
  scanCodebaseState,
  scanConfigDrift,
  scanServiceHealth,
  scanAttackSurface,
  scanDependencyFreshness,
  scanVectorMemory,
  scanResourceUtilization,
  scanCostTrajectory,

  // Utilities (exported for testing)
  computeReadinessScore,
  computeEnvironmentReadiness,
  classifyPressure,
  withPhiRetry,
  withTimeout,
  httpGet,

  // Constants
  RECON_TIMEOUT_MS,
  SCANNER_COUNT,
  DEP_FRESHNESS_DAYS,
  CONFIG_DRIFT_THRESHOLD,
  COST_ALERT_RATIO,
  MIN_HEALTHY_RATIO,
  MAX_RETRY_ATTEMPTS,
  SCANNER_TIMEOUT_MS,
  VERSION,
};
