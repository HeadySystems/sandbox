/**
 * © 2026 HeadySystems Inc. — φ-Scales Module
 * Exports golden ratio constants and Fibonacci sequences for phi-scaled operations.
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const PHI_SQ = PHI * PHI;
const SQRT5 = Math.sqrt(5);

const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function fibAt(n) {
    if (n < FIB.length) return FIB[n];
    let a = FIB[FIB.length - 2], b = FIB[FIB.length - 1];
    for (let i = FIB.length; i <= n; i++) { [a, b] = [b, a + b]; }
    return b;
}

function phiScale(base, level = 1) {
    return base * Math.pow(PHI, level);
}

function phiDecay(base, level = 1) {
    return base * Math.pow(PSI, level);
}

module.exports = { PHI, PSI, PHI_SQ, SQRT5, FIB, fibAt, phiScale, phiDecay };
