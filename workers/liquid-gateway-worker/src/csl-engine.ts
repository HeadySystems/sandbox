/**
 * Heady™ CSL Engine — Resolution-Free Continuous Semantic Logic
 *
 * Dynamic system with unbounded precision.
 * Resolution emerges from context, not configuration.
 * Transport-adaptive quantization at boundaries only.
 * Internal evaluation always full float64 (52-bit mantissa).
 *
 * © 2026 HeadySystems Inc. — 60+ Provisional Patents
 */

// ── φ Foundation ────────────────────────────────────────────────────
export const PHI = 1.6180339887498949;
export const PSI = 0.6180339887498949;
export const PHI_SQ = PHI * PHI;
export const PHI_INV_SQ = PSI * PSI;

export const phiPow = (n: number): number => Math.pow(PHI, n);
export const phiMs = (n: number): number => Math.round(phiPow(n) * 1000);

export const PHI_TIMING = {
  TICK: phiMs(0), PULSE: phiMs(1), BEAT: phiMs(2), BREATH: phiMs(3),
  WAVE: phiMs(4), SURGE: phiMs(5), FLOW: phiMs(6), CYCLE: phiMs(7),
  TIDE: phiMs(8), EPOCH: phiMs(9),
} as const;

// ── CSL Continuous Value ────────────────────────────────────────────
// Unbounded precision — float64 internally, quantized only at transport.

export interface CSLValue {
  v: number;
  confidence: number;
  sourceDepth: number;
  t: number;
}

export function csl(v: number, confidence = 1.0): CSLValue {
  return { v: Math.max(0, Math.min(1, v)), confidence, sourceDepth: 64, t: Date.now() };
}

// ── CSL Gates ───────────────────────────────────────────────────────
export const CSLGate = {
  AND: (a: CSLValue, b: CSLValue): CSLValue =>
    csl(Math.min(a.v, b.v), Math.min(a.confidence, b.confidence)),
  OR: (a: CSLValue, b: CSLValue): CSLValue =>
    csl(Math.max(a.v, b.v), Math.min(a.confidence, b.confidence)),
  NOT: (a: CSLValue): CSLValue =>
    csl(1 - a.v, a.confidence),
  IMPLY: (a: CSLValue, b: CSLValue): CSLValue =>
    csl(Math.min(1, 1 - a.v + b.v), Math.min(a.confidence, b.confidence)),
  EQUIV: (a: CSLValue, b: CSLValue): CSLValue =>
    csl(1 - Math.abs(a.v - b.v), Math.min(a.confidence, b.confidence)),
  NAND: (a: CSLValue, b: CSLValue): CSLValue =>
    csl(1 - Math.min(a.v, b.v), Math.min(a.confidence, b.confidence)),
  XOR: (a: CSLValue, b: CSLValue): CSLValue =>
    csl(Math.abs(a.v - b.v), Math.min(a.confidence, b.confidence)),
  PHI_BLEND: (a: CSLValue, b: CSLValue): CSLValue =>
    csl(a.v * PSI + b.v * (1 - PSI), Math.min(a.confidence, b.confidence)),
  RESONATE: (a: CSLValue, b: CSLValue): CSLValue =>
    csl(Math.max(0, 1 - Math.abs(a.v - b.v) * PHI), Math.min(a.confidence, b.confidence)),
  THRESHOLD: (a: CSLValue, threshold = PSI): CSLValue => {
    const sigmoid = 1 / (1 + Math.exp(-PHI * 10 * (a.v - threshold)));
    return csl(sigmoid, a.confidence);
  },
} as const;

// ── CSL Semantic Bands ──────────────────────────────────────────────
export type CSLBand = 'DORMANT' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export function cslBand(v: CSLValue): CSLBand {
  if (v.v < 0.236) return 'DORMANT';
  if (v.v < PHI_INV_SQ) return 'LOW';
  if (v.v < PSI) return 'MODERATE';
  if (v.v < 0.854) return 'HIGH';
  return 'CRITICAL';
}

// ── Site Circuit ────────────────────────────────────────────────────
export interface CSLSiteCircuit {
  domain: string;
  repo: string;
  tier: string;
  gates: {
    domain_resonance: CSLValue;
    auth_gate: CSLValue;
    buddy_activation: CSLValue;
    content_composition: CSLValue;
    cache_affinity: CSLValue;
    compute_pressure: CSLValue;
    onboarding_flow: CSLValue;
    midi_responsiveness: CSLValue;
  };
  cacheTtl: number;
}

export function evaluateSiteCircuit(
  domain: string, repo: string, tier: string,
  ctx: { hostname: string; hasAuth: boolean; isHeadyMe: boolean; systemLoad: number }
): CSLSiteCircuit {
  const match = domain === ctx.hostname || `www.${domain}` === ctx.hostname ? 1.0 : 0.0;
  const auth = ctx.hasAuth ? 1.0 : 0.0;
  const onboard = ctx.isHeadyMe && !ctx.hasAuth;

  const gates = {
    domain_resonance:    csl(match),
    auth_gate:           CSLGate.AND(csl(auth), csl(match)),
    buddy_activation:    CSLGate.THRESHOLD(csl(match), PSI),
    content_composition: CSLGate.PHI_BLEND(csl(match), csl(auth)),
    cache_affinity:      csl(tierCacheAffinity(tier)),
    compute_pressure:    CSLGate.THRESHOLD(csl(ctx.systemLoad), PSI),
    onboarding_flow:     csl(onboard ? 1.0 : 0.0),
    midi_responsiveness: csl(tier === 'compute' ? PHI_INV_SQ : PSI),
  };

  const phiPower = Math.round(gates.cache_affinity.v * 9);
  return { domain, repo, tier, gates, cacheTtl: phiMs(phiPower) };
}

function tierCacheAffinity(tier: string): number {
  const m: Record<string, number> = {
    core: 1.0, product: 0.82, vertical: PSI, integration: 0.5,
    internal: PHI_INV_SQ, compute: 0.1,
  };
  return m[tier] ?? PSI;
}

// ── Transport Quantizer ─────────────────────────────────────────────
export type TransportMode = 'internal' | 'midi' | 'udp' | 'mcp' | 'api';

export function quantize(value: CSLValue, transport: TransportMode): number {
  switch (transport) {
    case 'internal': return value.v;
    case 'midi':     return Math.round(value.v * 127);
    case 'udp':      return value.v;
    case 'mcp':      return value.v;
    case 'api':      return Math.round(value.v * 1e6) / 1e6;
  }
}

export function dequantize(raw: number, transport: TransportMode): CSLValue {
  switch (transport) {
    case 'midi': return csl(raw / 127, 7 / 64);
    case 'api':  return csl(raw, 52 / 64);
    default:     return csl(raw, 1.0);
  }
}

// ── MIDI CC → CSL Bridge ────────────────────────────────────────────
export function midiCCToCSL(ccValue: number, curve: 'linear' | 'phi' | 'log' = 'phi'): CSLValue {
  const n = ccValue / 127;
  switch (curve) {
    case 'linear': return csl(n, 7 / 64);
    case 'phi':    return csl(Math.pow(n, 1 / PHI), 7 / 64);
    case 'log':    return csl(Math.log(1 + n * (Math.E - 1)), 7 / 64);
  }
}

// ── 3D Vector Space ─────────────────────────────────────────────────
export interface Vec3 { x: number; y: number; z: number }

export const TIER_VECTORS: Record<string, Vec3> = {
  core:        { x: 1.0,        y: 0.0,  z: PHI },
  product:     { x: PSI,        y: 0.0,  z: 1.0 },
  vertical:    { x: PSI,        y: 0.5,  z: PSI },
  integration: { x: PHI_INV_SQ, y: PSI,  z: PSI },
  internal:    { x: 0.0,        y: PSI,  z: PHI_INV_SQ },
  compute:     { x: 0.0,        y: PHI,  z: 0.0 },
};

export function vecMagnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

// ── Colab Runtimes ──────────────────────────────────────────────────
export const COLAB_RUNTIMES = [
  { id: 'colab-1', region: 'us-east', endpoint: '', weight: PHI },
  { id: 'colab-2', region: 'us-west', endpoint: '', weight: 1.0 },
  { id: 'colab-3', region: 'eu-west', endpoint: '', weight: PSI },
] as const;

const COLO_MAP: Record<string, string> = {
  EWR: 'us-east', IAD: 'us-east', ORD: 'us-east', ATL: 'us-east',
  JFK: 'us-east', BOS: 'us-east', MIA: 'us-east',
  LAX: 'us-west', SFO: 'us-west', SEA: 'us-west', DFW: 'us-west',
  DEN: 'us-west', SJC: 'us-west',
  LHR: 'eu-west', CDG: 'eu-west', FRA: 'eu-west', AMS: 'eu-west',
};

export function selectColabRuntime(colo: string) {
  const pref = COLO_MAP[colo] || 'us-east';
  return COLAB_RUNTIMES.find(r => r.region === pref) || COLAB_RUNTIMES[0];
}
