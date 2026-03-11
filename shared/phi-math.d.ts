/**
 * Heady™ Phi-Math Foundation — Sacred Geometry Constants & Utilities
 * The single source of truth for ALL scaling constants across the Heady™ ecosystem.
 *
 * NO MAGIC NUMBERS. Every constant derives from φ (golden ratio) or Fibonacci.
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */
export declare const PHI = 1.618033988749895;
export declare const PSI = 0.6180339887498949;
export declare const PHI_SQ = 2.618033988749895;
export declare const PHI_CUBED = 4.23606797749979;
export declare const FIB: readonly [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
export declare function fib(n: number): number;
export declare const PHI_TIMING: {
    readonly PHI_1: number;
    readonly PHI_2: number;
    readonly PHI_3: number;
    readonly PHI_4: number;
    readonly PHI_5: number;
    readonly PHI_6: number;
    readonly PHI_7: number;
    readonly PHI_8: number;
};
export declare function phiThreshold(level: number, spread?: number): number;
export declare const CSL_THRESHOLDS: {
    readonly MINIMUM: number;
    readonly LOW: number;
    readonly MEDIUM: number;
    readonly HIGH: number;
    readonly CRITICAL: number;
    readonly DEFAULT: 0.6180339887498949;
};
export declare function phiBackoff(attempt: number, baseMs?: number, maxMs?: number): number;
export declare const PHI_BACKOFF_SEQUENCE: readonly [1000, 1618, 2618, 4236, 6854, 11090];
export declare function phiFusionWeights(n: number): number[];
export declare const PRESSURE_LEVELS: {
    readonly NOMINAL: {
        readonly min: 0;
        readonly max: number;
    };
    readonly ELEVATED: {
        readonly min: number;
        readonly max: 0.6180339887498949;
    };
    readonly HIGH: {
        readonly min: 0.6180339887498949;
        readonly max: number;
    };
    readonly CRITICAL: {
        readonly min: number;
    };
};
export declare const ALERT_THRESHOLDS: {
    readonly WARNING: 0.6180339887498949;
    readonly CAUTION: number;
    readonly CRITICAL: number;
    readonly EXCEEDED: number;
    readonly HARD_MAX: 1;
};
export declare const AUTO_SUCCESS: {
    readonly CYCLE_MS: number;
    readonly CATEGORIES: number;
    readonly TASKS_TOTAL: number;
    readonly TASKS_PER_CATEGORY: number;
    readonly TASK_TIMEOUT_MS: number;
    readonly MAX_RETRIES_PER_CYCLE: number;
    readonly MAX_RETRIES_TOTAL: number;
};
export declare const PIPELINE: {
    readonly STAGES: number;
    readonly MAX_CONCURRENT: number;
    readonly MAX_RETRIES: number;
    readonly CONTEXT_COMPLETENESS: 0.92;
    readonly RECON_TIMEOUT_MS: number;
    readonly TRIAL_TIMEOUT_MS: number;
    readonly AWARENESS_TIMEOUT_MS: number;
    readonly SEARCH_TIMEOUT_MS: number;
    readonly EVOLUTION_TIMEOUT_MS: number;
};
export declare const BEE_SCALING: {
    readonly PRE_WARM_POOLS: readonly [number, number, number, number];
    readonly SCALE_UP_FACTOR: 1.618033988749895;
    readonly SCALE_DOWN_FACTOR: number;
    readonly STALE_TIMEOUT_S: 60;
    readonly MAX_CONCURRENT: 10000;
};
export declare const RESOURCE_POOLS: {
    readonly HOT: 0.34;
    readonly WARM: 0.21;
    readonly COLD: 0.13;
    readonly RESERVE: 0.08;
    readonly GOVERNANCE: 0.05;
};
export declare const JUDGE_WEIGHTS: {
    readonly CORRECTNESS: 0.34;
    readonly SAFETY: 0.21;
    readonly PERFORMANCE: 0.21;
    readonly QUALITY: 0.13;
    readonly ELEGANCE: 0.11;
};
export declare const COST_WEIGHTS: {
    readonly TIME: 0.382;
    readonly MONEY: 0.382;
    readonly QUALITY: 0.236;
};
export declare const VECTOR: {
    readonly DIMENSIONS: 384;
    readonly PROJECTION_DIMS: 3;
    readonly DRIFT_THRESHOLD: 0.6180339887498949;
    readonly COHERENCE_THRESHOLD: number;
    readonly DEDUP_THRESHOLD: 0.972;
};
declare const _default: {
    PHI: number;
    PSI: number;
    PHI_SQ: number;
    PHI_CUBED: number;
    FIB: readonly [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
    fib: typeof fib;
    PHI_TIMING: {
        readonly PHI_1: number;
        readonly PHI_2: number;
        readonly PHI_3: number;
        readonly PHI_4: number;
        readonly PHI_5: number;
        readonly PHI_6: number;
        readonly PHI_7: number;
        readonly PHI_8: number;
    };
    PHI_BACKOFF_SEQUENCE: readonly [1000, 1618, 2618, 4236, 6854, 11090];
    CSL_THRESHOLDS: {
        readonly MINIMUM: number;
        readonly LOW: number;
        readonly MEDIUM: number;
        readonly HIGH: number;
        readonly CRITICAL: number;
        readonly DEFAULT: 0.6180339887498949;
    };
    phiThreshold: typeof phiThreshold;
    phiBackoff: typeof phiBackoff;
    phiFusionWeights: typeof phiFusionWeights;
    PRESSURE_LEVELS: {
        readonly NOMINAL: {
            readonly min: 0;
            readonly max: number;
        };
        readonly ELEVATED: {
            readonly min: number;
            readonly max: 0.6180339887498949;
        };
        readonly HIGH: {
            readonly min: 0.6180339887498949;
            readonly max: number;
        };
        readonly CRITICAL: {
            readonly min: number;
        };
    };
    ALERT_THRESHOLDS: {
        readonly WARNING: 0.6180339887498949;
        readonly CAUTION: number;
        readonly CRITICAL: number;
        readonly EXCEEDED: number;
        readonly HARD_MAX: 1;
    };
    AUTO_SUCCESS: {
        readonly CYCLE_MS: number;
        readonly CATEGORIES: number;
        readonly TASKS_TOTAL: number;
        readonly TASKS_PER_CATEGORY: number;
        readonly TASK_TIMEOUT_MS: number;
        readonly MAX_RETRIES_PER_CYCLE: number;
        readonly MAX_RETRIES_TOTAL: number;
    };
    PIPELINE: {
        readonly STAGES: number;
        readonly MAX_CONCURRENT: number;
        readonly MAX_RETRIES: number;
        readonly CONTEXT_COMPLETENESS: 0.92;
        readonly RECON_TIMEOUT_MS: number;
        readonly TRIAL_TIMEOUT_MS: number;
        readonly AWARENESS_TIMEOUT_MS: number;
        readonly SEARCH_TIMEOUT_MS: number;
        readonly EVOLUTION_TIMEOUT_MS: number;
    };
    BEE_SCALING: {
        readonly PRE_WARM_POOLS: readonly [number, number, number, number];
        readonly SCALE_UP_FACTOR: 1.618033988749895;
        readonly SCALE_DOWN_FACTOR: number;
        readonly STALE_TIMEOUT_S: 60;
        readonly MAX_CONCURRENT: 10000;
    };
    RESOURCE_POOLS: {
        readonly HOT: 0.34;
        readonly WARM: 0.21;
        readonly COLD: 0.13;
        readonly RESERVE: 0.08;
        readonly GOVERNANCE: 0.05;
    };
    JUDGE_WEIGHTS: {
        readonly CORRECTNESS: 0.34;
        readonly SAFETY: 0.21;
        readonly PERFORMANCE: 0.21;
        readonly QUALITY: 0.13;
        readonly ELEGANCE: 0.11;
    };
    COST_WEIGHTS: {
        readonly TIME: 0.382;
        readonly MONEY: 0.382;
        readonly QUALITY: 0.236;
    };
    VECTOR: {
        readonly DIMENSIONS: 384;
        readonly PROJECTION_DIMS: 3;
        readonly DRIFT_THRESHOLD: 0.6180339887498949;
        readonly COHERENCE_THRESHOLD: number;
        readonly DEDUP_THRESHOLD: 0.972;
    };
};
export default _default;
//# sourceMappingURL=phi-math.d.ts.map