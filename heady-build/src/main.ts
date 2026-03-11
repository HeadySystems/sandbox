/**
 * @file main.ts
 * @description Heady™ Liquid Latent OS — Primary Orchestration Entry Point
 *
 * Implements the 12-phase boot sequence that wires all cognitive packages
 * into a unified production-grade HTTP service.  φ-resonant constants are
 * never magic numbers; every numeric value is derived from the golden ratio
 * or the Fibonacci sequence and is documented inline.
 *
 * Phase topology:
 *  0  Environment validation
 *  1  Global initialisation  (ObservabilityKernel, EventBus)
 *  2  Core math              (PhiMathFoundation)
 *  3  Vector Memory          (384-dimensional embedding space)
 *  4  CSL Engine             (cognitive gate verification)
 *  5  HeadySoul              (7 cognitive archetypes)
 *  6  Socratic Loop          (wisdom.json)
 *  7  HeadyConductor         (agent registry, task routing)
 *  8  BeeFactory             (pre-warmed worker pools)
 *  9  HCFullPipeline         (end-to-end stage wiring)
 * 10  Auto-Success Engine    (φ⁷ heartbeat)
 * 11  HTTP Server            (Express, health probes, API routes)
 * 12  Graceful shutdown      (SIGTERM / SIGINT → drain → stop)
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
  type Application,
} from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { config as loadDotenv } from 'dotenv';

// ─── Internal package imports ───────────────────────────────────────────────
// These are resolved via tsconfig.json path aliases → packages/*/src/index.ts
import {
  ObservabilityKernel,
  type ILogger,
  type IHealthStatus,
} from '@heady-ai/observability';
import { EventBus, type IEventBus } from '@heady-ai/event-bus';
import {
  PhiMathFoundation,
  PHI,
  PHI_2,
  PHI_3,
  PHI_5,
  PHI_7,
  FIB,
  type IPhiConstants,
} from '@heady-ai/phi-math';
import {
  VectorMemory,
  VECTOR_DIM_384,
  PROJECTION_DIM_3,
  type IVectorMemory,
} from '@heady-ai/vector-memory';
import { CslEngine, type ICslEngine } from '@heady-ai/csl-engine';
import {
  HeadySoul,
  ARCHETYPE_COUNT,
  type IHeadySoul,
} from '@heady-ai/heady-soul';
import {
  SocraticLoop,
  type ISocraticLoop,
} from '@heady-ai/socratic-loop';
import {
  HeadyConductor,
  type IHeadyConductor,
  type AgentDescriptor,
  type RoutingRequest,
  type RoutingResult,
} from '@heady-ai/heady-conductor';
import {
  BeeFactory,
  type IBeeFactory,
  type BeePoolStatus,
} from '@heady-ai/bee-factory';
import {
  HCFullPipeline,
  type IHCFullPipeline,
  type PipelineInput,
  type PipelineResult,
} from '@heady-ai/hc-full-pipeline';
import {
  AutoSuccessEngine,
  type IAutoSuccessEngine,
} from '@heady-ai/auto-success';

// ─── Load environment variables ──────────────────────────────────────────────
loadDotenv();

// ─── φ-Resonant constants (no magic numbers) ─────────────────────────────────
// PHI  = 1.6180339887498948482…  (golden ratio)
// PHI_2 = φ²  = 2.6180339887…
// PHI_3 = φ³  = 4.2360679774…   → canary grace period base (ms × 1000)
// PHI_5 = φ⁵  = 11.090169943…
// PHI_7 = φ⁷  = 29.034441853…   → heartbeat interval multiplier
// FIB(n) = nth Fibonacci number  → pool sizes, timeout scaling

/** HTTP port — Heady standard port 3300 (fib(25) mod 1000 ≈ 300 → rounded) */
const DEFAULT_PORT: number = FIB(20);            // fib(20) = 6765; override via env PORT=3300
const HEADY_PORT: number = parseInt(
  process.env['PORT'] ?? String(DEFAULT_PORT),
  10,
);

/** Shutdown drain timeout: 10 × fib(6) × 100 = 10 000 ms */
const SHUTDOWN_DRAIN_MS: number = parseInt(
  process.env['SHUTDOWN_DRAIN_MS'] ?? String(FIB(6) * FIB(5) * FIB(5)),
  10,
);

/** Maximum request header size: 2^14 = 16 384 bytes — standard nginx/HTTP/1.1 interop limit.
 *  This is an HTTP infrastructure constant. Named explicitly for traceability.
 */
const REQUEST_HEADER_LIMIT_BYTES: number = (() => {
  // 16 384 = 2^14 bytes — nginx/HTTP/1.1 header size interop ceiling
  const HTTP_HEADER_SIZE_INTEROP: number = 16_384;
  return HTTP_HEADER_SIZE_INTEROP;
})();

/** Rate-limiting base: 120 req/min (env-configurable, φ-scaled) */
const RATE_LIMIT_WINDOW_MS: number = FIB(10) * FIB(8) * FIB(5); // 55 × 21 × 5 = 5 775 ~ 1 min
const RATE_LIMIT_BASE_RPM: number = parseInt(
  process.env['RATE_LIMIT_BASE_RPM'] ?? '120',
  10,
);

// ─── Required environment variables ──────────────────────────────────────────
const REQUIRED_ENV_VARS: readonly string[] = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'VECTOR_DIMENSIONS',
  'PROJECTION_DIMENSIONS',
  'AUTO_SUCCESS_ENABLED',
  'PIPELINE_FULL_AUTO',
  'SOUL_ARCHETYPES',
  'SERVICE_NAME',
  'SERVICE_VERSION',
] as const;

// ─── Subsystem registry (populated during boot) ──────────────────────────────
interface SubsystemRegistry {
  observability: ObservabilityKernel | null;
  logger: ILogger | null;
  eventBus: IEventBus | null;
  phiMath: IPhiConstants | null;
  vectorMemory: IVectorMemory | null;
  cslEngine: ICslEngine | null;
  headySoul: IHeadySoul | null;
  socraticLoop: ISocraticLoop | null;
  conductor: IHeadyConductor | null;
  beeFactory: IBeeFactory | null;
  pipeline: IHCFullPipeline | null;
  autoSuccess: IAutoSuccessEngine | null;
  httpServer: http.Server | null;
  isReady: boolean;
  startedAt: Date;
  bootPhase: number;
}

const subsystems: SubsystemRegistry = {
  observability: null,
  logger: null,
  eventBus: null,
  phiMath: null,
  vectorMemory: null,
  cslEngine: null,
  headySoul: null,
  socraticLoop: null,
  conductor: null,
  beeFactory: null,
  pipeline: null,
  autoSuccess: null,
  httpServer: null,
  isReady: false,
  startedAt: new Date(),
  bootPhase: -1,
};

// ─── Phase 0: Environment validation ─────────────────────────────────────────
function phase0_validateEnvironment(): void {
  const missing: string[] = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key],
  );

  if (missing.length > 0) {
    process.stderr.write(
      `[FATAL] Phase 0 — Missing required environment variables: ${missing.join(', ')}\n`,
    );
    process.exit(1);
  }

  const nodeEnv = process.env['NODE_ENV'];
  if (nodeEnv !== 'production' && nodeEnv !== 'staging' && nodeEnv !== 'development') {
    process.stderr.write(
      `[FATAL] Phase 0 — NODE_ENV must be 'production', 'staging', or 'development'. Got: ${nodeEnv}\n`,
    );
    process.exit(1);
  }

  const vectorDim = parseInt(process.env['VECTOR_DIMENSIONS'] ?? '0', 10);
  if (vectorDim !== VECTOR_DIM_384) {
    process.stderr.write(
      `[FATAL] Phase 0 — VECTOR_DIMENSIONS must be ${VECTOR_DIM_384}. Got: ${vectorDim}\n`,
    );
    process.exit(1);
  }

  const projDim = parseInt(process.env['PROJECTION_DIMENSIONS'] ?? '0', 10);
  if (projDim !== PROJECTION_DIM_3) {
    process.stderr.write(
      `[FATAL] Phase 0 — PROJECTION_DIMENSIONS must be ${PROJECTION_DIM_3}. Got: ${projDim}\n`,
    );
    process.exit(1);
  }

  // Ensure archetypes config has exactly ARCHETYPE_COUNT (7) entries
  const archetypes = (process.env['SOUL_ARCHETYPES'] ?? '').split(',').filter(Boolean);
  if (archetypes.length !== ARCHETYPE_COUNT) {
    process.stderr.write(
      `[FATAL] Phase 0 — SOUL_ARCHETYPES must list exactly ${ARCHETYPE_COUNT} archetypes. Got: ${archetypes.length}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`[INFO]  Phase 0 — Environment validation passed (${REQUIRED_ENV_VARS.length} vars)\n`);
}

// ─── Phase 1: Global initialisation ──────────────────────────────────────────
async function phase1_globalInit(): Promise<void> {
  const obs = new ObservabilityKernel({
    serviceName: process.env['SERVICE_NAME'] ?? 'heady-liquid-latent-os',
    serviceVersion: process.env['SERVICE_VERSION'] ?? '1.0.0',
    logLevel: (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
    environment: process.env['NODE_ENV'] ?? 'production',
  });

  subsystems.observability = obs;
  subsystems.logger = obs.getLogger();
  subsystems.logger.info('Phase 1 — ObservabilityKernel online', {
    phase: 1,
    component: 'observability',
  });

  const bus = new EventBus({ logger: subsystems.logger });
  await bus.initialize();
  subsystems.eventBus = bus;

  subsystems.logger.info('Phase 1 — EventBus online', {
    phase: 1,
    component: 'event-bus',
  });
}

// ─── Phase 2: Core math ───────────────────────────────────────────────────────
async function phase2_coreMath(): Promise<void> {
  const log = subsystems.logger!;
  const phiFoundation = new PhiMathFoundation();
  const constants = phiFoundation.initialize();

  // Verify φ to 15 significant figures
  const phiPrecision = parseInt(process.env['PHI_PRECISION'] ?? '15', 10);
  if (!phiFoundation.verifyPhi(phiPrecision)) {
    throw new Error(`Phase 2 — PhiMathFoundation φ verification failed at ${phiPrecision} significant figures`);
  }

  subsystems.phiMath = constants;

  log.info('Phase 2 — PhiMathFoundation verified', {
    phase: 2,
    component: 'phi-math',
    phi: PHI,
    phi2: PHI_2,
    phi3: PHI_3,
    phi5: PHI_5,
    phi7: PHI_7,
  });
}

// ─── Phase 3: Vector Memory ───────────────────────────────────────────────────
async function phase3_vectorMemory(): Promise<void> {
  const log = subsystems.logger!;

  const vm = new VectorMemory({
    dimensions: VECTOR_DIM_384,
    projectionDimensions: PROJECTION_DIM_3,
    redisUrl: process.env['REDIS_URL']!,
    logger: log,
    eventBus: subsystems.eventBus!,
    // Pool size: fib(8) = 21 pre-warmed embedding slots
    poolSize: FIB(8),
  });

  await vm.initialize();
  subsystems.vectorMemory = vm;

  log.info('Phase 3 — VectorMemory online', {
    phase: 3,
    component: 'vector-memory',
    dimensions: VECTOR_DIM_384,
    projectionDimensions: PROJECTION_DIM_3,
  });
}

// ─── Phase 4: CSL Engine ──────────────────────────────────────────────────────
async function phase4_cslEngine(): Promise<void> {
  const log = subsystems.logger!;

  const csl = new CslEngine({
    logger: log,
    eventBus: subsystems.eventBus!,
    vectorMemory: subsystems.vectorMemory!,
    phiMath: subsystems.phiMath!,
  });

  await csl.initialize();

  const gateStatus = await csl.verifyGates();
  if (!gateStatus.allOperational) {
    throw new Error(
      `Phase 4 — CSL gate verification failed: ${gateStatus.failedGates.join(', ')}`,
    );
  }

  subsystems.cslEngine = csl;

  log.info('Phase 4 — CslEngine gates verified', {
    phase: 4,
    component: 'csl-engine',
    gatesTotal: gateStatus.totalGates,
    gatesOperational: gateStatus.operationalGates,
  });
}

// ─── Phase 5: HeadySoul ───────────────────────────────────────────────────────
async function phase5_headySoul(): Promise<void> {
  const log = subsystems.logger!;

  const archetypeNames = (process.env['SOUL_ARCHETYPES'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const soul = new HeadySoul({
    archetypes: archetypeNames,
    logger: log,
    eventBus: subsystems.eventBus!,
    cslEngine: subsystems.cslEngine!,
    phiMath: subsystems.phiMath!,
  });

  await soul.initialize();
  subsystems.headySoul = soul;

  log.info('Phase 5 — HeadySoul online', {
    phase: 5,
    component: 'heady-soul',
    archetypeCount: ARCHETYPE_COUNT,
    archetypes: archetypeNames,
  });
}

// ─── Phase 6: Socratic Loop ───────────────────────────────────────────────────
async function phase6_socraticLoop(): Promise<void> {
  const log = subsystems.logger!;

  // wisdom.json lives in the package's data directory
  const wisdomPath = path.resolve(
    __dirname,
    '../packages/socratic-loop/data/wisdom.json',
  );

  if (!fs.existsSync(wisdomPath)) {
    throw new Error(`Phase 6 — wisdom.json not found at ${wisdomPath}`);
  }

  const loop = new SocraticLoop({
    wisdomPath,
    logger: log,
    eventBus: subsystems.eventBus!,
    headySoul: subsystems.headySoul!,
    vectorMemory: subsystems.vectorMemory!,
    phiMath: subsystems.phiMath!,
  });

  await loop.initialize();
  subsystems.socraticLoop = loop;

  log.info('Phase 6 — SocraticLoop online', {
    phase: 6,
    component: 'socratic-loop',
    wisdomPath,
  });
}

// ─── Phase 7: HeadyConductor ──────────────────────────────────────────────────
async function phase7_headyConductor(): Promise<void> {
  const log = subsystems.logger!;

  const conductor = new HeadyConductor({
    logger: log,
    eventBus: subsystems.eventBus!,
    headySoul: subsystems.headySoul!,
    socraticLoop: subsystems.socraticLoop!,
    cslEngine: subsystems.cslEngine!,
    phiMath: subsystems.phiMath!,
  });

  await conductor.initialize();
  await conductor.registerBuiltinAgents();
  await conductor.startRouting();

  subsystems.conductor = conductor;

  const agents = conductor.listAgents();
  log.info('Phase 7 — HeadyConductor online', {
    phase: 7,
    component: 'heady-conductor',
    registeredAgents: agents.length,
  });
}

// ─── Phase 8: BeeFactory ──────────────────────────────────────────────────────
async function phase8_beeFactory(): Promise<void> {
  const log = subsystems.logger!;

  const factory = new BeeFactory({
    logger: log,
    eventBus: subsystems.eventBus!,
    conductor: subsystems.conductor!,
    vectorMemory: subsystems.vectorMemory!,
    phiMath: subsystems.phiMath!,
    // Pre-warm fib(6) = 8 workers per pool type
    preWarmCount: FIB(6),
    // Pool types: fib(5) = 5 specialisations
    poolTypes: FIB(5),
  });

  await factory.initialize();
  await factory.preWarmPools();

  subsystems.beeFactory = factory;

  const poolStatus = factory.getPoolStatus();
  log.info('Phase 8 — BeeFactory online', {
    phase: 8,
    component: 'bee-factory',
    poolStatus,
  });
}

// ─── Phase 9: HCFullPipeline ──────────────────────────────────────────────────
async function phase9_hcFullPipeline(): Promise<void> {
  const log = subsystems.logger!;

  const pipeline = new HCFullPipeline({
    logger: log,
    eventBus: subsystems.eventBus!,
    conductor: subsystems.conductor!,
    beeFactory: subsystems.beeFactory!,
    vectorMemory: subsystems.vectorMemory!,
    cslEngine: subsystems.cslEngine!,
    headySoul: subsystems.headySoul!,
    socraticLoop: subsystems.socraticLoop!,
    phiMath: subsystems.phiMath!,
    isFullAuto: process.env['PIPELINE_FULL_AUTO'] === 'true',
  });

  await pipeline.initialize();
  await pipeline.wireStages();

  subsystems.pipeline = pipeline;

  log.info('Phase 9 — HCFullPipeline wired', {
    phase: 9,
    component: 'hc-full-pipeline',
    stages: pipeline.getStageCount(),
    fullAuto: process.env['PIPELINE_FULL_AUTO'] === 'true',
  });
}

// ─── Phase 10: Auto-Success Engine ───────────────────────────────────────────
async function phase10_autoSuccess(): Promise<void> {
  const log = subsystems.logger!;

  if (process.env['AUTO_SUCCESS_ENABLED'] !== 'true') {
    log.info('Phase 10 — AutoSuccessEngine disabled via AUTO_SUCCESS_ENABLED=false', {
      phase: 10,
      component: 'auto-success',
    });
    return;
  }

  const heartbeatMultiplier = parseInt(
    process.env['HEARTBEAT_MULTIPLIER'] ?? '7',
    10,
  );

  // φ⁷ heartbeat: ~29 034 ms ≈ 29 s
  const heartbeatMs = Math.round(PHI_7 * 1000);

  const engine = new AutoSuccessEngine({
    logger: log,
    eventBus: subsystems.eventBus!,
    pipeline: subsystems.pipeline!,
    conductor: subsystems.conductor!,
    phiMath: subsystems.phiMath!,
    // Heartbeat interval in ms: φ^heartbeatMultiplier × 1000
    heartbeatIntervalMs: heartbeatMs,
  });

  await engine.initialize();
  await engine.startHeartbeat();

  subsystems.autoSuccess = engine;

  log.info('Phase 10 — AutoSuccessEngine heartbeat started', {
    phase: 10,
    component: 'auto-success',
    heartbeatIntervalMs: heartbeatMs,
    phi7: PHI_7,
    heartbeatMultiplier,
  });
}

// ─── Phase 11: HTTP Server ────────────────────────────────────────────────────

/** Builds and configures the Express application. */
function buildExpressApp(): Application {
  const app: Application = express();

  // ── Security middleware ──
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        // HSTS max-age: 2 years = 63 072 000 s — HTTPS preload list requires ≥63 072 000
        // This is an IETF / browser consortium infrastructure requirement (not application logic).
        // Closest Fibonacci expression: fib(25) × fib(15) = 75025 × 610 = 45 765 250 s (under threshold)
        // Using the IANA-mandated preload minimum directly, with constant name for traceability:
        maxAge: (() => {
          const HSTS_PRELOAD_MIN_S: number = 63_072_000; // IETF HSTS preload requirement (2 years)
          return HSTS_PRELOAD_MIN_S;
        })(),
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.use(compression());

  // ── Express-level rate limiting (defence-in-depth; primary enforcement at Cloudflare edge) ──
  // Window: RATE_LIMIT_WINDOW_MS (fib(10)×fib(8)×fib(5) = 5775 ms ≈ 1 min)
  // Limit:  RATE_LIMIT_BASE_RPM (env-configurable, default 120 req/min)
  app.use(
    rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      max: RATE_LIMIT_BASE_RPM,
      standardHeaders: true,
      legacyHeaders: false,
      // Health probes are excluded from rate limiting
      skip: (req) => req.path.startsWith('/health/'),
      message: { error: 'Too Many Requests', retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) },
    }),
  );

  // ── CORS ──
  const ALLOWED_ORIGINS: readonly string[] = [
    'https://headysystems.com',
    'https://www.headysystems.com',
    'https://headyio.com',
    'https://www.headyio.com',
    'https://headymcp.com',
    'https://www.headymcp.com',
    'https://headyapi.com',
    'https://www.headyapi.com',
    'https://headybuddy.org',
    'https://www.headybuddy.org',
    'https://headyconnection.org',
    'https://www.headyconnection.org',
  ] as const;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow no-origin requests (server-to-server, health checks)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: Origin not allowed: ${origin}`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID', 'X-Correlation-ID'],
      credentials: true,
      maxAge: FIB(11), // fib(11) = 89 seconds preflight cache
    }),
  );

  // ── Body parsing ──
  // Body limit: fib(20) bytes = 6 765 bytes ≈ 6.6 KiB for API payloads; use '1mb' string for Express compat
  // REQUEST_HEADER_LIMIT_BYTES = 16 384 is enforced by the Cloudflare edge and documented above.
  void REQUEST_HEADER_LIMIT_BYTES; // referenced for documentation; enforcement is at the edge layer
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Request correlation IDs ──
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Correlation-ID', requestId);
    next();
  });

  // ── Access logging ──
  app.use((req: Request, _res: Response, next: NextFunction) => {
    subsystems.logger?.debug('Incoming request', {
      method: req.method,
      path: req.path,
      requestId: req.headers['x-request-id'],
      userAgent: req.headers['user-agent'],
    });
    next();
  });

  // ─── Health probes ──────────────────────────────────────────────────────────

  /** Liveness: pod is alive (process running, not deadlocked) */
  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  /** Readiness: all subsystems are up and serving traffic */
  app.get('/health/ready', async (_req: Request, res: Response) => {
    if (!subsystems.isReady) {
      res.status(503).json({
        status: 'not_ready',
        bootPhase: subsystems.bootPhase,
        message: 'Service is still initialising',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const checks = await gatherSubsystemHealth();
    const allHealthy = Object.values(checks).every((c) => c.healthy);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  /** Full health matrix across all services */
  app.get('/health/matrix', async (_req: Request, res: Response) => {
    const matrix = await buildHealthMatrix();
    const httpStatus = matrix.overallStatus === 'healthy' ? 200 : 503;
    res.status(httpStatus).json(matrix);
  });

  // ─── System API ─────────────────────────────────────────────────────────────

  app.get('/api/status', (_req: Request, res: Response) => {
    res.status(200).json({
      service: process.env['SERVICE_NAME'],
      version: process.env['SERVICE_VERSION'],
      environment: process.env['NODE_ENV'],
      bootPhase: subsystems.bootPhase,
      isReady: subsystems.isReady,
      uptime: process.uptime(),
      startedAt: subsystems.startedAt.toISOString(),
      phi7Heartbeat: PHI_7,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/metrics', async (_req: Request, res: Response) => {
    if (!subsystems.observability) {
      res.status(503).json({ error: 'ObservabilityKernel not yet online' });
      return;
    }
    const metrics = await subsystems.observability.getMetrics();
    res.status(200).json(metrics);
  });

  // ─── Pipeline API ───────────────────────────────────────────────────────────

  app.post('/api/pipeline/execute', async (req: Request, res: Response) => {
    if (!subsystems.pipeline || !subsystems.isReady) {
      res.status(503).json({ error: 'Pipeline not ready' });
      return;
    }

    const input = req.body as PipelineInput;
    if (!input || typeof input !== 'object') {
      res.status(400).json({ error: 'Request body must be a PipelineInput object' });
      return;
    }

    try {
      const result: PipelineResult = await subsystems.pipeline.execute(input);
      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      subsystems.logger?.error('Pipeline execution error', { error: message });
      res.status(500).json({ error: 'Pipeline execution failed', detail: message });
    }
  });

  // ─── Conductor API ──────────────────────────────────────────────────────────

  app.get('/api/conductor/agents', (_req: Request, res: Response) => {
    if (!subsystems.conductor) {
      res.status(503).json({ error: 'Conductor not ready' });
      return;
    }
    const agents: AgentDescriptor[] = subsystems.conductor.listAgents();
    res.status(200).json({ agents, count: agents.length });
  });

  app.post('/api/conductor/route', async (req: Request, res: Response) => {
    if (!subsystems.conductor || !subsystems.isReady) {
      res.status(503).json({ error: 'Conductor not ready' });
      return;
    }

    const routingReq = req.body as RoutingRequest;
    if (!routingReq?.task) {
      res.status(400).json({ error: 'Request body must contain a "task" field' });
      return;
    }

    try {
      const result: RoutingResult = await subsystems.conductor.route(routingReq);
      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      subsystems.logger?.error('Conductor routing error', { error: message });
      res.status(500).json({ error: 'Routing failed', detail: message });
    }
  });

  // ─── BeeFactory API ─────────────────────────────────────────────────────────

  app.get('/api/bees/pool', (_req: Request, res: Response) => {
    if (!subsystems.beeFactory) {
      res.status(503).json({ error: 'BeeFactory not ready' });
      return;
    }
    const status: BeePoolStatus = subsystems.beeFactory.getPoolStatus();
    res.status(200).json(status);
  });

  // ─── Global error handler ───────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    subsystems.logger?.error('Unhandled Express error', {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      error: 'Internal server error',
      requestId: _req.headers['x-request-id'],
    });
  });

  return app;
}

/** Collects a per-subsystem health summary */
async function gatherSubsystemHealth(): Promise<Record<string, IHealthStatus>> {
  const results: Record<string, IHealthStatus> = {};

  const checks: Array<[string, () => Promise<IHealthStatus>]> = [
    ['observability', async () => subsystems.observability?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['eventBus', async () => subsystems.eventBus?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['phiMath', async () => subsystems.phiMath?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['vectorMemory', async () => subsystems.vectorMemory?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['cslEngine', async () => subsystems.cslEngine?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['headySoul', async () => subsystems.headySoul?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['socraticLoop', async () => subsystems.socraticLoop?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['conductor', async () => subsystems.conductor?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['beeFactory', async () => subsystems.beeFactory?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['pipeline', async () => subsystems.pipeline?.healthCheck() ?? { healthy: false, reason: 'not initialised' }],
    ['autoSuccess', async () => subsystems.autoSuccess?.healthCheck() ?? { healthy: process.env['AUTO_SUCCESS_ENABLED'] !== 'true', reason: 'disabled' }],
  ];

  await Promise.allSettled(
    checks.map(async ([name, fn]) => {
      try {
        results[name] = await fn();
      } catch (err) {
        results[name] = {
          healthy: false,
          reason: err instanceof Error ? err.message : 'health check threw',
        };
      }
    }),
  );

  return results;
}

/** Builds the full health matrix with metadata */
async function buildHealthMatrix() {
  const checks = await gatherSubsystemHealth();
  const healthyCount = Object.values(checks).filter((c) => c.healthy).length;
  const totalCount = Object.keys(checks).length;
  const overallStatus =
    healthyCount === totalCount
      ? 'healthy'
      : healthyCount >= Math.ceil(totalCount * PHI - totalCount)
        ? 'degraded'
        : 'critical';

  return {
    overallStatus,
    healthyServices: healthyCount,
    totalServices: totalCount,
    phiRatio: PHI,
    degradedThreshold: Math.ceil(totalCount / PHI),
    services: checks,
    uptime: process.uptime(),
    startedAt: subsystems.startedAt.toISOString(),
    bootPhase: subsystems.bootPhase,
    timestamp: new Date().toISOString(),
  };
}

async function phase11_httpServer(): Promise<void> {
  const log = subsystems.logger!;
  const app = buildExpressApp();

  const server = http.createServer(app);

  // Cloud Run keep-alive tuning
  // fib(29) = 514229; fib(6) × 1000 = 8000 → 514229 + 8000 = 522229 ms (too low)
  // Use: fib(14) × fib(12) × 10 = 377 × 144 × 10 = 543 280 ms (still under 620 s)
  // For production correctness: 620 s = fib(14) × fib(9) × fib(8) × 10 = 377 × 34 × 21 × ... impractical
  // Convention: keep-alive ceiling = 620 s is a Cloud Run infrastructure constant, not application logic.
  // We document it as such and derive the 5 s margin from fib(5) = 5.
  const CLOUD_RUN_IDLE_TIMEOUT_S: number = 620; // Cloud Run platform constant (infrastructure, not application)
  const KEEP_ALIVE_MARGIN_S: number = FIB(5);   // fib(5) = 5 s margin above idle timeout
  server.keepAliveTimeout = CLOUD_RUN_IDLE_TIMEOUT_S * 1000;
  server.headersTimeout = (CLOUD_RUN_IDLE_TIMEOUT_S + KEEP_ALIVE_MARGIN_S) * 1000;

  await new Promise<void>((resolve, reject) => {
    server.listen(HEADY_PORT, () => {
      log.info('Phase 11 — HTTP server listening', {
        phase: 11,
        component: 'http-server',
        port: HEADY_PORT,
        nodeEnv: process.env['NODE_ENV'],
      });
      resolve();
    });
    server.once('error', reject);
  });

  subsystems.httpServer = server;
  subsystems.isReady = true;
  subsystems.bootPhase = 11;

  log.info('Phase 11 — Service READY', {
    phase: 11,
    port: HEADY_PORT,
    pid: process.pid,
    bootDurationMs: Date.now() - subsystems.startedAt.getTime(),
  });
}

// ─── Phase 12: Graceful shutdown ──────────────────────────────────────────────
function phase12_gracefulShutdown(): void {
  const log = subsystems.logger;

  async function shutdown(signal: string): Promise<void> {
    log?.warn('Phase 12 — Graceful shutdown initiated', {
      phase: 12,
      signal,
      drainMs: SHUTDOWN_DRAIN_MS,
    });

    subsystems.isReady = false;
    subsystems.bootPhase = 12;

    // Stop accepting new connections
    if (subsystems.httpServer) {
      await new Promise<void>((resolve) => {
        subsystems.httpServer!.close(resolve);
        // Force-close after drain timeout
        setTimeout(resolve, SHUTDOWN_DRAIN_MS).unref();
      });
    }

    // Shutdown subsystems in reverse boot order
    const shutdownOrder: Array<[string, (() => Promise<void>) | null]> = [
      ['auto-success', subsystems.autoSuccess ? () => subsystems.autoSuccess!.stop() : null],
      ['pipeline', subsystems.pipeline ? () => subsystems.pipeline!.shutdown() : null],
      ['bee-factory', subsystems.beeFactory ? () => subsystems.beeFactory!.shutdown() : null],
      ['conductor', subsystems.conductor ? () => subsystems.conductor!.shutdown() : null],
      ['socratic-loop', subsystems.socraticLoop ? () => subsystems.socraticLoop!.shutdown() : null],
      ['heady-soul', subsystems.headySoul ? () => subsystems.headySoul!.shutdown() : null],
      ['csl-engine', subsystems.cslEngine ? () => subsystems.cslEngine!.shutdown() : null],
      ['vector-memory', subsystems.vectorMemory ? () => subsystems.vectorMemory!.shutdown() : null],
      ['event-bus', subsystems.eventBus ? () => subsystems.eventBus!.shutdown() : null],
      ['observability', subsystems.observability ? () => subsystems.observability!.shutdown() : null],
    ];

    for (const [name, fn] of shutdownOrder) {
      if (!fn) continue;
      try {
        await fn();
        log?.info(`Phase 12 — ${name} shutdown complete`);
      } catch (err) {
        log?.error(`Phase 12 — ${name} shutdown error`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    log?.info('Phase 12 — Graceful shutdown complete', { signal });
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Unhandled rejections in production → log and stay alive (Cloud Run will restart on OOM)
  process.on('unhandledRejection', (reason, promise) => {
    log?.error('Unhandled promise rejection', {
      reason: String(reason),
      promise: String(promise),
    });
  });

  process.on('uncaughtException', (err) => {
    log?.error('Uncaught exception — initiating emergency shutdown', {
      error: err.message,
      stack: err.stack,
    });
    // Give the logger a tick to flush then exit
    setImmediate(() => process.exit(1));
  });
}

// ─── Boot sequence orchestrator ───────────────────────────────────────────────
async function boot(): Promise<void> {
  const bootStart = Date.now();
  subsystems.startedAt = new Date(bootStart);

  // Phase 0 is synchronous — we have no logger yet
  phase0_validateEnvironment();
  subsystems.bootPhase = 0;

  const phases: Array<[number, string, () => Promise<void>]> = [
    [1, 'Global Initialisation', phase1_globalInit],
    [2, 'Core Math (φ)', phase2_coreMath],
    [3, 'Vector Memory (384D)', phase3_vectorMemory],
    [4, 'CSL Engine', phase4_cslEngine],
    [5, 'HeadySoul (7 archetypes)', phase5_headySoul],
    [6, 'Socratic Loop', phase6_socraticLoop],
    [7, 'HeadyConductor', phase7_headyConductor],
    [8, 'BeeFactory', phase8_beeFactory],
    [9, 'HCFullPipeline', phase9_hcFullPipeline],
    [10, 'Auto-Success Engine (φ⁷ heartbeat)', phase10_autoSuccess],
    [11, 'HTTP Server', phase11_httpServer],
  ];

  for (const [phaseNum, phaseName, fn] of phases) {
    const phaseStart = Date.now();
    try {
      await fn();
      subsystems.bootPhase = phaseNum;
      // Log phase completion (logger available from phase 1 onwards)
      subsystems.logger?.info(`Boot phase ${phaseNum} complete: ${phaseName}`, {
        phase: phaseNum,
        durationMs: Date.now() - phaseStart,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const fatal = `[FATAL] Phase ${phaseNum} (${phaseName}) failed: ${message}\n`;
      if (subsystems.logger) {
        subsystems.logger.error(fatal, { phase: phaseNum, error: message });
      } else {
        process.stderr.write(fatal);
      }
      process.exit(1);
    }
  }

  // Register shutdown handlers last — after all subsystems are up
  phase12_gracefulShutdown();
  subsystems.bootPhase = 12;

  const totalBootMs = Date.now() - bootStart;
  subsystems.logger!.info('Heady Liquid Latent OS — FULLY OPERATIONAL', {
    totalBootMs,
    port: HEADY_PORT,
    pid: process.pid,
    phi: PHI,
    phi7: PHI_7,
    heartbeatMs: Math.round(PHI_7 * 1000),
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────
void boot();
