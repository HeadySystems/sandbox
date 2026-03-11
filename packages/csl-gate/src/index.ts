import { CSL_THRESHOLDS } from '@heady-ai/phi-math-foundation';

export function cosineLike(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, index) => sum + (value * (b[index] ?? 0)), 0);
  const magA = Math.sqrt(a.reduce((sum, value) => sum + (value * value), 0));
  const magB = Math.sqrt(b.reduce((sum, value) => sum + (value * value), 0));
  if (!magA || !magB) return 0;
  return dot / (magA * magB);
}

export function cslGate(value: number, cosineScore: number, threshold = CSL_THRESHOLDS.MEDIUM, temperature = 0.146): number {
  const delta = (cosineScore - threshold) / temperature;
  const sigmoid = 1 / (1 + Math.exp(-delta));
  return value * sigmoid;
}

export function resonanceGate(cosineScore: number): keyof typeof CSL_THRESHOLDS | 'PASS' | 'FAIL' {
  if (cosineScore >= CSL_THRESHOLDS.CRITICAL) return 'PASS';
  if (cosineScore < CSL_THRESHOLDS.LOW) return 'FAIL';
  return 'MEDIUM';
}
