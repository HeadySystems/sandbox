/**
 * Geometric ring topology for the 20 AI nodes.
 * Central → Inner → Middle → Outer → Governance
 */
export const NODE_RINGS: Readonly<{
    CENTRAL: {
        radius: number;
        nodes: string[];
        role: string;
    };
    INNER: {
        radius: number;
        nodes: string[];
        role: string;
    };
    MIDDLE: {
        radius: number;
        nodes: string[];
        role: string;
    };
    OUTER: {
        radius: number;
        nodes: string[];
        role: string;
    };
    GOVERNANCE: {
        radius: number;
        nodes: string[];
        role: string;
    };
}>;
/**
 * All 20 node names in canonical order (center-out).
 */
export const ALL_NODES: readonly string[];
/**
 * Lookup which ring a node belongs to.
 * @param {string} nodeName
 * @returns {string|null} Ring name or null
 */
export function nodeRing(nodeName: string): string | null;
/**
 * Geometric distance between two nodes based on ring positions.
 * Nodes in the same ring have distance = ring angular separation.
 * Nodes in different rings have distance = ring radius difference.
 * @param {string} nodeA
 * @param {string} nodeB
 * @returns {number}
 */
export function nodeDistance(nodeA: string, nodeB: string): number;
export const COHERENCE_THRESHOLDS: Readonly<{
    HEALTHY: number;
    WARNING: number;
    DEGRADED: number;
    CRITICAL: number;
}>;
/**
 * Compute coherence between two node state embeddings.
 * @param {Float64Array|number[]} stateA
 * @param {Float64Array|number[]} stateB
 * @returns {{ score: number, status: string }}
 */
export function coherenceScore(stateA: Float64Array | number[], stateB: Float64Array | number[]): {
    score: number;
    status: string;
};
/**
 * Compute system-wide coherence by averaging all pairwise node scores.
 * @param {Map<string, Float64Array|number[]>} nodeStates - Map of node name → state vector
 * @returns {{ overall: number, status: string, drifted: string[] }}
 */
export function systemCoherence(nodeStates: Map<string, Float64Array | number[]>): {
    overall: number;
    status: string;
    drifted: string[];
};
/**
 * Hot/Warm/Cold pool definitions with Fibonacci resource ratios.
 */
export const POOL_CONFIG: Readonly<{
    HOT: {
        name: string;
        purpose: string;
        resourcePct: number;
        maxConcurrency: number;
        timeoutMs: number;
        priority: number;
    };
    WARM: {
        name: string;
        purpose: string;
        resourcePct: number;
        maxConcurrency: number;
        timeoutMs: number;
        priority: number;
    };
    COLD: {
        name: string;
        purpose: string;
        resourcePct: number;
        maxConcurrency: number;
        timeoutMs: number;
        priority: number;
    };
    RESERVE: {
        name: string;
        purpose: string;
        resourcePct: number;
        maxConcurrency: number;
        timeoutMs: number;
        priority: number;
    };
    GOVERNANCE: {
        name: string;
        purpose: string;
        resourcePct: number;
        maxConcurrency: number;
        timeoutMs: number;
        priority: number;
    };
}>;
/**
 * Assign a task to the appropriate pool based on priority and type.
 * @param {object} task
 * @param {string} task.type - 'user-facing' | 'background' | 'batch' | 'burst' | 'governance'
 * @param {number} [task.urgency=0.5] - 0–1 urgency score
 * @returns {string} Pool name
 */
export function assignPool(task: {
    type: string;
    urgency?: number | undefined;
}): string;
export const UI: Readonly<{
    TYPE_SCALE: {
        xs: number;
        sm: number;
        base: number;
        lg: number;
        xl: number;
        '2xl': number;
    };
    SPACING: number[];
    LAYOUT: {
        primaryWidth: string;
        secondaryWidth: string;
        goldenSection: number;
    };
    GOLDEN_ANGLE: number;
    COLORS: {
        primary: string;
        secondary: string;
        success: string;
        warning: string;
        danger: string;
        background: string;
        surface: string;
        text: string;
        muted: string;
    };
    TIMING: {
        instant: number;
        fast: number;
        normal: number;
        slow: number;
        glacial: number;
    };
}>;
export const BEE_LIMITS: Readonly<{
    maxConcurrentBees: number;
    maxQueueDepth: number;
    beeTimeoutMs: number;
    maxRetries: number;
    healthCheckIntervalMs: number;
    registryCapacity: number;
}>;
export { poolAllocation };
//# sourceMappingURL=sacred-geometry.d.ts.map