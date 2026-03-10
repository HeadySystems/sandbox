// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: apps/hive/src/growth.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

const PHI = (1 + Math.sqrt(5)) / 2;

function fib(n) {
    const i = Math.max(0, Math.floor(Number(n)));
    let a = 0;
    let b = 1;
    for (let k = 0; k < i; k++) {
        const next = a + b;
        a = b;
        b = next;
    }
    return a;
}

function fibFloor(value) {
    const v = Math.max(0, Math.floor(Number(value)));
    if (v <= 1) return v;

    let a = 0;
    let b = 1;
    while (b <= v) {
        const next = a + b;
        a = b;
        b = next;
    }
    return a;
}

function fibCeil(value) {
    const v = Math.max(0, Math.floor(Number(value)));
    if (v <= 1) return v;

    let a = 0;
    let b = 1;
    while (b < v) {
        const next = a + b;
        a = b;
        b = next;
    }
    return b;
}

function fibNearest(value) {
    const v = Math.max(0, Math.floor(Number(value)));
    const lo = fibFloor(v);
    const hi = fibCeil(v);
    if ((v - lo) <= (hi - v)) return lo;
    return hi;
}

function phiScale(value, steps = 1) {
    const v = Number(value);
    const s = Number(steps);
    if (!Number.isFinite(v) || !Number.isFinite(s)) return NaN;
    return v * Math.pow(PHI, s);
}

function phiRound(value, steps = 1) {
    const scaled = phiScale(value, steps);
    if (!Number.isFinite(scaled)) return NaN;
    return Math.round(scaled);
}

module.exports = {
    PHI,
    fib,
    fibFloor,
    fibCeil,
    fibNearest,
    phiScale,
    phiRound,
};
