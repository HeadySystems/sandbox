/**
 * Heady™ Service Endpoint Registry
 * Maps all 50 microservices to their connection endpoints
 */
'use strict';

const { PORTS } = require('./phi-constants');

const BASE_HOST = process.env.HEADY_SERVICE_HOST || 'localhost';
const BASE_URL = process.env.HEADY_SERVICE_BASE_URL || `http://${BASE_HOST}`;

/**
 * Service endpoint configuration
 * Each service has: port, healthPath, basePath, description
 */
const SERVICES = {
  // ═══ Core Intelligence ═══
  'heady-brain': {
    port: PORTS.HEADY_BRAIN,
    url: `${BASE_URL}:${PORTS.HEADY_BRAIN}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Central inference engine — multi-model routing',
  },
  'heady-memory': {
    port: PORTS.HEADY_MEMORY,
    url: `${BASE_URL}:${PORTS.HEADY_MEMORY}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Persistent 3D vector memory — pgvector + HNSW',
  },
  'heady-soul': {
    port: PORTS.HEADY_SOUL,
    url: `${BASE_URL}:${PORTS.HEADY_SOUL}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Values arbiter — coherence, alignment, safety',
  },
  'heady-vinci': {
    port: PORTS.HEADY_VINCI,
    url: `${BASE_URL}:${PORTS.HEADY_VINCI}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Session planner — topology, multi-step reasoning',
  },
  'heady-conductor': {
    port: PORTS.HEADY_CONDUCTOR,
    url: `${BASE_URL}:${PORTS.HEADY_CONDUCTOR}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Orchestration scheduler — task routing',
  },

  // ═══ Execution ═══
  'heady-coder': {
    port: PORTS.HEADY_CODER,
    url: `${BASE_URL}:${PORTS.HEADY_CODER}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Code generation — multi-assistant workflows',
  },
  'heady-battle': {
    port: PORTS.HEADY_BATTLE,
    url: `${BASE_URL}:${PORTS.HEADY_BATTLE}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'AI competition arena — evaluation, leaderboard',
  },
  'heady-buddy': {
    port: PORTS.HEADY_BUDDY,
    url: `${BASE_URL}:${PORTS.HEADY_BUDDY}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Personal AI assistant — multi-provider',
  },

  // ═══ Security & Ops ═══
  'heady-guard': {
    port: PORTS.HEADY_GUARD,
    url: `${BASE_URL}:${PORTS.HEADY_GUARD}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Zero-trust security — RBAC, audit, encryption',
  },
  'heady-maid': {
    port: PORTS.HEADY_MAID,
    url: `${BASE_URL}:${PORTS.HEADY_MAID}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'System cleanup — scheduling, garbage collection',
  },
  'heady-lens': {
    port: PORTS.HEADY_LENS,
    url: `${BASE_URL}:${PORTS.HEADY_LENS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Visual analysis — image processing, detection',
  },

  // ═══ Infrastructure ═══
  'auth-session': {
    port: PORTS.AUTH_SESSION,
    url: `${BASE_URL}:${PORTS.AUTH_SESSION}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Central SSO — cross-domain auth, Firebase',
  },
  'api-gateway': {
    port: PORTS.API_GATEWAY,
    url: `${BASE_URL}:${PORTS.API_GATEWAY}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'API gateway — routing, rate limiting, auth',
  },
  'notification': {
    port: PORTS.NOTIFICATION,
    url: `${BASE_URL}:${PORTS.NOTIFICATION}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'WebSocket + SSE + push notifications',
  },
  'billing': {
    port: PORTS.BILLING,
    url: `${BASE_URL}:${PORTS.BILLING}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Stripe billing — φ-scaled plans',
  },
  'analytics': {
    port: PORTS.ANALYTICS,
    url: `${BASE_URL}:${PORTS.ANALYTICS}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Privacy-first analytics — funnels, timeseries',
  },
  'search': {
    port: PORTS.SEARCH,
    url: `${BASE_URL}:${PORTS.SEARCH}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Hybrid search — vector + full-text',
  },
  'scheduler': {
    port: PORTS.SCHEDULER,
    url: `${BASE_URL}:${PORTS.SCHEDULER}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Fibonacci-interval job scheduler',
  },
  'hcfp': {
    port: PORTS.HCFP,
    url: `${BASE_URL}:${PORTS.HCFP}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Heady Context Flow Processor — auto-success pipeline',
  },
  'edge-ai': {
    port: PORTS.EDGE_AI,
    url: `${BASE_URL}:${PORTS.EDGE_AI}`,
    healthPath: '/health',
    basePath: '/api/v1',
    description: 'Cloudflare edge AI — embeddings, classification',
  },
};

/**
 * Get service endpoint config
 */
function getServiceEndpoint(serviceName) {
  return SERVICES[serviceName] || null;
}

/**
 * Get all registered services
 */
function getAllServiceEndpoints() {
  return { ...SERVICES };
}

/**
 * Build HTTP URL for a service endpoint
 */
function serviceUrl(serviceName, path = '') {
  const svc = SERVICES[serviceName];
  if (!svc) throw new Error(`Unknown service: ${serviceName}`);
  return `${svc.url}${svc.basePath}${path}`;
}

module.exports = { SERVICES, getServiceEndpoint, getAllServiceEndpoints, serviceUrl };
