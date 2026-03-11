'use strict';

/**
 * @file growth-model.js
 * @description HeadySystems Capacity Planning Calculator
 * @version 3.2.2
 *
 * φ = 1.618033988749895 (Golden Ratio)
 * All growth projections use φ-scaled rates and Fibonacci time horizons.
 *
 * Growth model:
 *   capacity(t) = base × φ^(t/T)
 * where T = characteristic growth period
 *
 * Planning horizons: fib(n) months
 *   fib(4)=3 months, fib(5)=5 months, fib(7)=13 months, fib(9)=34 months
 *
 * Resource types: Cloud Run instances, Redis memory, Postgres storage,
 *                 pgvector dimensions, MCP sessions, agent concurrency
 */

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;
const PHI_INV = 1 / PHI;  // 0.618...

/** Fibonacci sequence (indices 0-16) */
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/**
 * φ-scaled growth rates per month.
 * Conservative: 1/φ × 10% = 6.18% per month
 * Moderate: φ^(1/12) × 10% = varies
 * Aggressive: φ × 10% = 16.18% per month
 */
const GROWTH_RATES = {
  conservative: PHI_INV * 0.10,   // 6.18% per month
  moderate:     0.10,              // 10% per month (base)
  aggressive:   PHI * 0.10,        // 16.18% per month — φ-scaled
  hypergrowth:  PHI ** 2 * 0.10,   // 26.18% per month — φ^2-scaled
};

// ---------------------------------------------------------------------------
// Current baseline (as of v3.2.2)
// ---------------------------------------------------------------------------
const BASELINE = {
  // Service replicas (Kubernetes)
  replicas: {
    'heady-brain':     FIB[3],   // fib(4)=3
    'heady-conductor': FIB[2],   // fib(3)=2
    'heady-mcp':       FIB[3],   // fib(4)=3
    'heady-web':       FIB[4],   // fib(5)=5
  },

  // HPA maximums (Kubernetes)
  hpaMax: {
    'heady-brain':     FIB[6],   // fib(7)=13
    'heady-conductor': FIB[5],   // fib(6)=8
    'heady-mcp':       FIB[6],   // fib(7)=13
    'heady-web':       FIB[7],   // fib(8)=21
  },

  // Cloud Run (GCP)
  cloudRunInstances: {
    'heady-brain':     { min: FIB[2], max: FIB[6] },   // 2/13
    'heady-conductor': { min: FIB[2], max: FIB[6] },
    'heady-mcp':       { min: FIB[2], max: FIB[6] },
    'heady-web':       { min: FIB[3], max: FIB[7] },   // 3/21
  },

  // Memory (MB)
  redisMemoryMb: 1024,   // 1GB = φ^2 × 618... ≈ 1024MB

  // Postgres storage (GB)
  postgresStorageGb: 100,

  // pgvector dimensions: fib(10)=55 standard, fib(12)=144 high-dim
  pgvectorDimensions: FIB[10],  // fib(11)=89 → using 89-dim standard

  // Max concurrent agents: fib(10)=55
  maxAgents: FIB[9],    // fib(10)=55

  // Max MCP sessions: fib(11)=89
  maxMcpSessions: FIB[10],  // fib(11)=89

  // Rate limits (rps)
  rateLimits: {
    pilot:      FIB[10],   // fib(11)=89 rps
    pro:        FIB[11],   // fib(12)=144 rps
    enterprise: FIB[12],   // fib(13)=233 rps
  },

  // Monthly active users (starting point)
  mau: 100,  // pre-revenue baseline

  // Domain count (fixed: 9)
  domains: 9,
};

// ---------------------------------------------------------------------------
// Growth Calculator
// ---------------------------------------------------------------------------

/**
 * Project capacity at t months using φ^(t/T) growth model.
 * @param {number} base       - Current value
 * @param {number} months     - Months in the future
 * @param {string} scenario   - 'conservative' | 'moderate' | 'aggressive' | 'hypergrowth'
 * @param {number} [T=12]     - Characteristic growth period in months
 * @returns {number}
 */
const projectGrowth = (base, months, scenario = 'moderate', T = 12) => {
  const rate = GROWTH_RATES[scenario];
  // φ-scaled compound growth: base × (1 + rate)^months
  // But we also apply φ-scaling to the growth itself:
  // capacity(t) = base × (1 + rate)^(t × φ^(scenario_multiplier))
  return base * Math.pow(1 + rate, months);
};

/**
 * Project to the next Fibonacci milestone.
 * @param {number} current
 * @returns {number} Next Fibonacci number >= current
 */
const nextFibMilestone = (current) => {
  return FIB.find((f) => f >= current * PHI) || FIB[FIB.length - 1];
};

/**
 * Calculate required Cloud Run instances for a target RPS.
 * @param {number} targetRps
 * @param {number} concurrencyPerInstance - fib(11)=89 default
 * @param {string} service
 * @returns {{ min: number, max: number, fibMin: number, fibMax: number }}
 */
const calculateCloudRunInstances = (
  targetRps,
  concurrencyPerInstance = FIB[10],  // fib(11)=89
  service = 'heady-brain',
) => {
  // Assume φ^3=4236ms average request time (brain)
  // Throughput per instance = concurrency / avg_latency_s
  const avgLatencyS = 1000 * PHI ** 3 / 1000;  // φ^3 seconds = 4.236s
  const throughputPerInstance = concurrencyPerInstance / avgLatencyS;

  const rawMin = Math.ceil(targetRps / throughputPerInstance);
  const rawMax = Math.ceil(rawMin * PHI);  // φ× min for max

  // Round up to next Fibonacci
  const fibMin = FIB.find((f) => f >= rawMin) || FIB[FIB.length - 1];
  const fibMax = FIB.find((f) => f >= rawMax) || FIB[FIB.length - 1];

  return { rawMin, rawMax, fibMin, fibMax, throughputPerInstance, targetRps };
};

/**
 * Calculate Redis memory needed for a given MAU.
 * @param {number} mau - Monthly active users
 * @returns {{ memoryMb: number, recommendedMb: number, fibMilestone: string }}
 */
const calculateRedisMemory = (mau) => {
  // Per-user Redis footprint:
  //   - Session data:     fib(8)=21 KB
  //   - Rate limit keys:  fib(4)=3 KB per user (sliding windows)
  //   - Agent cache:      fib(5)=5 KB per active user
  //   - CSL state:        fib(3)=2 KB
  // Total: ~31 KB per active user
  // Assume 38.2% (φ^(-2)) are active at peak (1/φ^2 concurrency ratio)
  const activePct = 1 / PHI ** 2;         // 38.2%
  const activeUsers = Math.ceil(mau * activePct);
  const kbPerUser = FIB[8] + FIB[3] + FIB[4] + FIB[2];  // 21+3+5+2=31 KB
  const totalKb = activeUsers * kbPerUser;
  const memoryMb = Math.ceil(totalKb / 1024);

  // Add φ× overhead buffer
  const recommendedMb = Math.ceil(memoryMb * PHI);

  // Round to φ-friendly sizes (512, 1024, 2048, ...)
  const sizes = [512, 1024, 2048, 4096, 8192];
  const recommendedSize = sizes.find((s) => s >= recommendedMb) || 8192;

  return {
    mau,
    activeUsers,
    kbPerUser,
    totalKb,
    memoryMb,
    withPhiBufferMb: recommendedMb,
    recommendedSizeMb: recommendedSize,
    derivation: `activeUsers=${activeUsers} (MAU×1/φ^2=38.2%), ${kbPerUser}KB/user × φ buffer`,
  };
};

/**
 * Calculate Postgres storage needed.
 * @param {number} mau
 * @param {number} avgSessionsPerUser - Average sessions per user per month
 * @returns {Object}
 */
const calculatePostgresStorage = (mau, avgSessionsPerUser = FIB[4]) => {
  // Per-session storage:
  //   - Agent runs:      fib(9)=34 KB average
  //   - Vector embeddings: fib(10)=55 dimensions × 4 bytes = 220 bytes ≈ 1 KB
  //   - Audit log:       fib(6)=8 KB per session
  //   - Metadata:        fib(3)=2 KB
  // Total: ~45 KB per session
  const kbPerSession = FIB[9] + 1 + FIB[5] + FIB[2];  // 34+1+8+2=45 KB
  const totalSessions = mau * avgSessionsPerUser;
  const totalKb = totalSessions * kbPerSession;
  const totalGb = totalKb / (1024 * 1024);

  // Vector index overhead: φ× storage for pgvector IVFFlat
  const vectorIndexGb = totalGb * (PHI - 1);  // φ-1 = 0.618 overhead

  // WAL + replica overhead: φ^(1/2) ≈ 1.27× multiplier
  const totalWithOverheadGb = totalGb * PHI;

  return {
    mau,
    totalSessions,
    kbPerSession,
    dataGb:             Math.ceil(totalGb),
    vectorIndexGb:      Math.ceil(vectorIndexGb),
    walOverheadGb:      Math.ceil(totalWithOverheadGb - totalGb),
    totalRecommendedGb: Math.ceil(totalWithOverheadGb),
    derivation: `${totalSessions} sessions × ${kbPerSession}KB × φ=${PHI} overhead`,
  };
};

// ---------------------------------------------------------------------------
// Full Capacity Plan Generator
// ---------------------------------------------------------------------------

/**
 * Generate a full capacity plan for Fibonacci time horizons.
 * @param {string} scenario - Growth scenario
 * @returns {Object} Capacity plan
 */
const generateCapacityPlan = (scenario = 'moderate') => {
  // Planning horizons: fib(4)=3, fib(5)=5, fib(7)=13, fib(9)=34 months
  const horizons = [FIB[3], FIB[4], FIB[6], FIB[8]];  // 3, 5, 13, 34

  const plan = {
    generatedAt: new Date().toISOString(),
    phi: PHI,
    scenario,
    growthRatePerMonth: GROWTH_RATES[scenario],
    baseline: BASELINE,
    projections: {},
  };

  for (const months of horizons) {
    const mauProjected   = Math.ceil(projectGrowth(BASELINE.mau, months, scenario));
    const rpsProjected   = Math.ceil(mauProjected * PHI_INV);  // ~61.8% of MAU as peak RPS

    const redis          = calculateRedisMemory(mauProjected);
    const postgres       = calculatePostgresStorage(mauProjected);
    const cloudRunBrain  = calculateCloudRunInstances(rpsProjected, FIB[10], 'heady-brain');
    const cloudRunWeb    = calculateCloudRunInstances(rpsProjected * PHI, FIB[11], 'heady-web');

    plan.projections[`month_${months}`] = {
      horizon: `fib(?)=${months} months`,
      mau: mauProjected,
      peakRps: rpsProjected,
      resources: {
        cloudRun: {
          brain: {
            min:       cloudRunBrain.fibMin,
            max:       cloudRunBrain.fibMax,
            nextFib:   nextFibMilestone(cloudRunBrain.fibMax),
          },
          web: {
            min:       cloudRunWeb.fibMin,
            max:       cloudRunWeb.fibMax,
            nextFib:   nextFibMilestone(cloudRunWeb.fibMax),
          },
        },
        redis: {
          recommendedMb:   redis.recommendedSizeMb,
          activeUsers:     redis.activeUsers,
          nextFibMilestoneGb: Math.ceil(redis.recommendedSizeMb / 1024),
        },
        postgres: {
          totalGb:       postgres.totalRecommendedGb,
          dataGb:        postgres.dataGb,
          vectorIndexGb: postgres.vectorIndexGb,
        },
        agents: {
          maxConcurrent: Math.ceil(projectGrowth(BASELINE.maxAgents, months, scenario)),
          fibMilestone:  FIB.find((f) => f >= Math.ceil(projectGrowth(BASELINE.maxAgents, months, scenario))),
        },
        mcpSessions: {
          max:          Math.ceil(projectGrowth(BASELINE.maxMcpSessions, months, scenario)),
          fibMilestone: FIB.find((f) => f >= Math.ceil(projectGrowth(BASELINE.maxMcpSessions, months, scenario))),
        },
      },
      estimatedMonthlyCostUsd: {
        // Rough GCP cost estimates
        cloudRun:   cloudRunBrain.fibMax * 50 + cloudRunWeb.fibMax * 30,
        cloudSql:   postgres.totalRecommendedGb * 0.17,
        memorystore: redis.recommendedSizeMb / 1024 * 100,
        networking:  rpsProjected * 0.001 * 30 * 24 * 3600 / 1e9,  // CDN egress estimate
      },
    };
  }

  return plan;
};

// ---------------------------------------------------------------------------
// CLI Runner
// ---------------------------------------------------------------------------

if (require.main === module) {
  const scenario = process.argv[2] || 'moderate';
  const plan = generateCapacityPlan(scenario);

  console.log('\n=== HeadySystems Capacity Plan ===');
  console.log(`φ = ${PHI}`);
  console.log(`Scenario: ${scenario} (${(GROWTH_RATES[scenario] * 100).toFixed(2)}%/month)`);
  console.log(`Generated: ${plan.generatedAt}`);
  console.log('\nPlanning Horizons: fib(4)=3, fib(5)=5, fib(7)=13, fib(9)=34 months\n');

  for (const [key, proj] of Object.entries(plan.projections)) {
    const months = parseInt(key.split('_')[1]);
    console.log(`--- ${months} Months (${proj.horizon}) ---`);
    console.log(`  MAU: ${proj.mau.toLocaleString()}`);
    console.log(`  Peak RPS: ${proj.peakRps}`);
    console.log(`  heady-brain instances: ${proj.resources.cloudRun.brain.min}–${proj.resources.cloudRun.brain.max}`);
    console.log(`  heady-web instances:   ${proj.resources.cloudRun.web.min}–${proj.resources.cloudRun.web.max}`);
    console.log(`  Redis memory:          ${proj.resources.redis.recommendedMb}MB`);
    console.log(`  Postgres storage:      ${proj.resources.postgres.totalGb}GB`);
    console.log(`  Max agents:            ${proj.resources.agents.fibMilestone}`);
    console.log(`  Est. monthly cost:     ~$${
      Object.values(proj.estimatedMonthlyCostUsd).reduce((a, b) => a + b, 0).toFixed(0)
    }`);
    console.log();
  }

  // Export as JSON for CI/CD capacity gates
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(plan, null, 2));
  }
}

module.exports = {
  PHI,
  FIB,
  GROWTH_RATES,
  BASELINE,
  generateCapacityPlan,
  projectGrowth,
  calculateRedisMemory,
  calculatePostgresStorage,
  calculateCloudRunInstances,
  nextFibMilestone,
};
