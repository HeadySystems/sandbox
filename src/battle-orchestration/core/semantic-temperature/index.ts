/**
 * Dynamic Semantic Logic Gates with Phi-Based Temperature Scaling
 * 
 * Core Concept:
 * - Temperature is not static but flows dynamically based on semantic context
 * - All scaling factors derived from golden ratio (φ = 1.618...)
 * - Logic gates determine temperature adjustments based on task semantics
 * - Creates fractal temperature landscapes across the reasoning space
 * 
 * Phi-Based Temperature Principles:
 * - Base temperature: φ^-3 = 0.236 (high precision)
 * - Creative temperature: φ^-1 = 0.618 (balanced exploration)
 * - Exploratory temperature: φ^0 = 1.0 (maximum creativity)
 * - All intermediate values follow golden ratio scaling
 */

export const PHI = 1.618033988749895;
export const PHI_INVERSE = 0.618033988749895;

/**
 * Semantic Logic Gates
 * Analyze task semantics to determine optimal temperature flow
 */
export enum SemanticGate {
  PRECISION = 'precision',           // Exact, deterministic output needed
  CREATIVITY = 'creativity',          // Novel solutions encouraged
  ANALYSIS = 'analysis',             // Deep reasoning required
  OPTIMIZATION = 'optimization',      // Refinement of existing solution
  EXPLORATION = 'exploration',        // Discovery of new approaches
  VALIDATION = 'validation',          // Strict correctness checking
  SYNTHESIS = 'synthesis',            // Combining multiple sources
  TRANSFORMATION = 'transformation'   // Converting between representations
}

/**
 * Phi-scaled temperature ranges
 */
export const PHI_TEMPERATURE_SCALES = {
  DETERMINISTIC: Math.pow(PHI, -4),      // 0.146
  PRECISION: Math.pow(PHI, -3),          // 0.236
  BALANCED: Math.pow(PHI, -2),           // 0.382
  CREATIVE: Math.pow(PHI, -1),           // 0.618
  EXPLORATORY: Math.pow(PHI, 0),         // 1.0
  FRACTAL: Math.pow(PHI, 1),             // 1.618
} as const;

/**
 * Semantic context for temperature calculation
 */
export interface SemanticContext {
  taskType: string;
  keywords: string[];
  complexity: number;
  uncertainty: number;
  priorAttempts: number;
  codegenPhase: 'planning' | 'implementation' | 'refinement' | 'validation';
  domainKnowledge: number;
}

/**
 * Temperature flow state
 */
export interface TemperatureFlow {
  current: number;
  min: number;
  max: number;
  trajectory: number[];
  gate: SemanticGate;
  phiScale: number;
  reasoning: string;
}

/**
 * Dynamic Semantic Temperature Controller
 */
export class DynamicTemperatureController {
  private currentFlow: TemperatureFlow;

  constructor() {
    this.currentFlow = {
      current: PHI_TEMPERATURE_SCALES.BALANCED,
      min: PHI_TEMPERATURE_SCALES.DETERMINISTIC,
      max: PHI_TEMPERATURE_SCALES.EXPLORATORY,
      trajectory: [],
      gate: SemanticGate.ANALYSIS,
      phiScale: 1.0,
      reasoning: 'Initial balanced state'
    };
  }

  /**
   * Calculate optimal temperature using semantic logic gates
   * All values are phi-scaled
   */
  calculateTemperature(context: SemanticContext): TemperatureFlow {
    const gate = this.selectSemanticGate(context);
    const baseTemp = this.getGateBaseTemperature(gate);
    const modifiedTemp = this.applyPhiModifiers(baseTemp, context);
    const smoothedTemp = this.smoothTemperature(modifiedTemp);

    this.currentFlow = {
      current: smoothedTemp,
      min: this.calculateMinTemp(context),
      max: this.calculateMaxTemp(context),
      trajectory: [...this.currentFlow.trajectory, smoothedTemp].slice(-10),
      gate,
      phiScale: this.calculatePhiScale(context),
      reasoning: this.explainTemperature(gate, smoothedTemp, context)
    };

    return this.currentFlow;
  }

  private selectSemanticGate(context: SemanticContext): SemanticGate {
    const keywords = context.keywords.map(k => k.toLowerCase());

    if (this.matchesPattern(keywords, ['exact', 'precise', 'deterministic', 'calculate'])) {
      return SemanticGate.PRECISION;
    }
    if (this.matchesPattern(keywords, ['validate', 'check', 'verify', 'test'])) {
      return SemanticGate.VALIDATION;
    }
    if (this.matchesPattern(keywords, ['optimize', 'improve', 'refine', 'enhance'])) {
      return SemanticGate.OPTIMIZATION;
    }
    if (this.matchesPattern(keywords, ['creative', 'novel', 'innovative', 'brainstorm'])) {
      return SemanticGate.CREATIVITY;
    }
    if (this.matchesPattern(keywords, ['explore', 'discover', 'search', 'investigate'])) {
      return SemanticGate.EXPLORATION;
    }

    return this.defaultGateForPhase(context.codegenPhase);
  }

  private getGateBaseTemperature(gate: SemanticGate): number {
    const gateTemperatures: Record<SemanticGate, number> = {
      [SemanticGate.PRECISION]: PHI_TEMPERATURE_SCALES.PRECISION,
      [SemanticGate.VALIDATION]: PHI_TEMPERATURE_SCALES.DETERMINISTIC,
      [SemanticGate.OPTIMIZATION]: PHI_TEMPERATURE_SCALES.BALANCED,
      [SemanticGate.CREATIVITY]: PHI_TEMPERATURE_SCALES.CREATIVE,
      [SemanticGate.EXPLORATION]: PHI_TEMPERATURE_SCALES.EXPLORATORY,
      [SemanticGate.ANALYSIS]: PHI_TEMPERATURE_SCALES.BALANCED,
      [SemanticGate.SYNTHESIS]: PHI_TEMPERATURE_SCALES.CREATIVE,
      [SemanticGate.TRANSFORMATION]: PHI_TEMPERATURE_SCALES.BALANCED
    };
    return gateTemperatures[gate];
  }

  private applyPhiModifiers(baseTemp: number, context: SemanticContext): number {
    let temp = baseTemp;

    // Complexity modifier: φ^-n scaling
    temp *= Math.pow(PHI, -context.complexity);

    // Uncertainty modifier: φ^n scaling
    temp *= Math.pow(PHI, context.uncertainty * 0.5);

    // Prior attempts: add φ^-2 per attempt
    if (context.priorAttempts > 0) {
      temp *= (1 + (context.priorAttempts * PHI_TEMPERATURE_SCALES.BALANCED));
    }

    // Domain knowledge: inverse phi scaling
    temp *= (PHI_INVERSE + (context.domainKnowledge * PHI_INVERSE));

    return Math.max(0.0, Math.min(2.0, temp));
  }

  private smoothTemperature(targetTemp: number): number {
    if (this.currentFlow.trajectory.length === 0) return targetTemp;

    const recentAvg = this.currentFlow.trajectory.slice(-3).reduce((a, b) => a + b, 0) / 
                      Math.min(3, this.currentFlow.trajectory.length);

    return (recentAvg * PHI_INVERSE) + (targetTemp * PHI_TEMPERATURE_SCALES.BALANCED);
  }

  private calculateMinTemp(context: SemanticContext): number {
    return context.taskType.includes('code') 
      ? PHI_TEMPERATURE_SCALES.DETERMINISTIC 
      : PHI_TEMPERATURE_SCALES.PRECISION;
  }

  private calculateMaxTemp(context: SemanticContext): number {
    if (context.codegenPhase === 'validation') return PHI_TEMPERATURE_SCALES.BALANCED;
    if (context.codegenPhase === 'planning') return PHI_TEMPERATURE_SCALES.EXPLORATORY;
    return PHI_TEMPERATURE_SCALES.CREATIVE;
  }

  private calculatePhiScale(context: SemanticContext): number {
    const precisionWeight = context.complexity * PHI_INVERSE;
    const creativityWeight = context.uncertainty * PHI_INVERSE;
    return creativityWeight / (precisionWeight + creativityWeight + 0.001);
  }

  private explainTemperature(gate: SemanticGate, temp: number, context: SemanticContext): string {
    return `Gate: ${gate} | Temp: ${temp.toFixed(3)} | Phase: ${context.codegenPhase}`;
  }

  private matchesPattern(keywords: string[], patterns: string[]): boolean {
    return patterns.some(pattern => keywords.includes(pattern));
  }

  private defaultGateForPhase(phase: SemanticContext['codegenPhase']): SemanticGate {
    const phaseMap = {
      'planning': SemanticGate.EXPLORATION,
      'implementation': SemanticGate.PRECISION,
      'refinement': SemanticGate.OPTIMIZATION,
      'validation': SemanticGate.VALIDATION
    };
    return phaseMap[phase];
  }

  getFlow(): TemperatureFlow {
    return this.currentFlow;
  }
}

export default DynamicTemperatureController;
