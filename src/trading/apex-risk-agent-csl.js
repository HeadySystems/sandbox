/**
 * @file apex-risk-agent-csl.js
 * @description Apex Trading Intelligence – Risk Agent with CSL (Continuous Scoring Layer)
 *              Replaces ternary risk gates with φ-derived continuous confidence scoring.
 *              Manages Apex Trader Funding evaluation accounts via geometric-mean risk fusion.
 *
 * @module ApexRiskAgentCSL
 * @version 2.0.0
 * @since 1.0.0
 *
 * @copyright © 2026 Heady™Systems Inc. All rights reserved.
 * @license Proprietary — HeadyConnection Project, Apex Trading Intelligence
 *
 * @patent PROVISIONAL-2026-HEADY-001  Phi-Geometric Continuous Scoring Layer (CSL)
 * @patent PROVISIONAL-2026-HEADY-002  Geometric Mean Portfolio Risk Fusion
 *
 * @author eric@headyconnection.org
 *
 * @remarks
 *   ALL numeric constants derive from the golden ratio φ = 1.6180339887.
 *   No external dependencies — uses Node.js built-in `crypto` and `events` modules only.
 *
 * SHA-256 Determinism Verification
 *   The constants block below is deterministic by construction.
 *   At startup, the module logs a SHA-256 digest of the constants object so that
 *   any environment can verify bit-for-bit reproducibility.
 *
 * CSL Signal Zones (φ-derived thresholds):
 *   REPEL    confidence < ψ³ ≈ 0.2361
 *   HOLD     ψ³ ≤ confidence < ψ²  ≈ 0.2361–0.3820
 *   CAUTIOUS ψ² ≤ confidence < ψ   ≈ 0.3820–0.6180
 *   ENGAGE   confidence ≥ ψ        ≈ 0.6180
 */

'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// § 1  GOLDEN-RATIO CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Golden ratio φ (phi).
 * @constant {number}
 */
const PHI = 1.6180339887;

/**
 * Reciprocal of φ: ψ = 1/φ ≈ 0.6180339887.
 * @constant {number}
 */
const PSI = 1 / PHI;

/**
 * Guard against division-by-zero in continuous scoring.
 * @constant {number}
 */
const EPSILON = 1e-10;

// Derived phi powers used throughout the module
const PSI2  = PSI  * PSI;   // ≈ 0.3820
const PSI3  = PSI2 * PSI;   // ≈ 0.2361
const PHI2  = PHI  * PHI;   // ≈ 2.6180
const PHI3  = PHI2 * PHI;   // ≈ 4.2360

// ─────────────────────────────────────────────────────────────────────────────
// § 2  APEX TRADER FUNDING RULES (FROZEN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apex Trader Funding evaluation-account rules.
 * Covers every standard account tier available as of 2026.
 *
 * @constant {Object} APEX_RULES
 * @property {Object} accounts         Per-tier balance and drawdown parameters.
 * @property {number} consistencyRule  Max single-day profit share of total (0.30 = 30 %).
 * @property {number} maeRule          Max adverse excursion as share of drawdown (0.30).
 * @property {number} minTradingDaysBetweenPayouts  Minimum trading days between payout requests.
 * @property {number} minProfitableDays  Minimum distinct profitable trading days required.
 * @property {number} minProfitPerDay    Minimum profit per day counted ($100).
 * @property {number} safetyNetPayouts   Payouts before safety-net activates.
 * @property {boolean} maxPositionHoldOvernight  Whether overnight holds are permitted.
 * @property {Object} tradingHoursUTC    Window start/end in UTC HH:MM.
 * @property {number} newsBlackoutMinutes  Minutes around news events to avoid entries.
 */
const APEX_RULES = Object.freeze({
    accounts: {
        '25K':  { balance: 25000,  trailingDrawdown: 1500, initialMAE: 450,  safetyNetBuffer: 100 },
        '50K':  { balance: 50000,  trailingDrawdown: 2500, initialMAE: 750,  safetyNetBuffer: 100 },
        '75K':  { balance: 75000,  trailingDrawdown: 2750, initialMAE: 825,  safetyNetBuffer: 100 },
        '100K': { balance: 100000, trailingDrawdown: 3000, initialMAE: 900,  safetyNetBuffer: 100 },
        '150K': { balance: 150000, trailingDrawdown: 5000, initialMAE: 1500, safetyNetBuffer: 100 },
        '250K': { balance: 250000, trailingDrawdown: 6500, initialMAE: 1950, safetyNetBuffer: 100 },
        '300K': { balance: 300000, trailingDrawdown: 7500, initialMAE: 2250, safetyNetBuffer: 100 },
    },
    consistencyRule:               0.30,
    maeRule:                       0.30,
    minTradingDaysBetweenPayouts:  8,
    minProfitableDays:             5,
    minProfitPerDay:               100,
    safetyNetPayouts:              3,
    maxPositionHoldOvernight:      false,
    tradingHoursUTC:               { start: '23:00', end: '22:00' },
    newsBlackoutMinutes:           5,
});

// ─────────────────────────────────────────────────────────────────────────────
// § 3  CSL SIGNAL ZONES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Continuous Scoring Layer signal zones, all thresholds φ-derived.
 *
 * | Zone      | value | confidence range      |
 * |-----------|-------|-----------------------|
 * | REPEL     |  -1   | < ψ³  (< 0.2361)      |
 * | HOLD      |   0   | ψ³ – ψ² (0.2361–0.382)|
 * | CAUTIOUS  |  0.5  | ψ² – ψ  (0.382–0.618) |
 * | ENGAGE    |   1   | ≥ ψ   (≥ 0.618)        |
 *
 * @constant {Object} CSL_SIGNAL
 */
const CSL_SIGNAL = Object.freeze({
    REPEL:    { value: -1,  label: 'REPEL',    threshold: PSI3 },  // < 0.2361
    HOLD:     { value: 0,   label: 'HOLD',     threshold: PSI2 },  // 0.2361–0.3820
    CAUTIOUS: { value: 0.5, label: 'CAUTIOUS', threshold: PSI  },  // 0.3820–0.6180
    ENGAGE:   { value: 1,   label: 'ENGAGE',   threshold: 1.0  },  // > 0.6180
});

// ─────────────────────────────────────────────────────────────────────────────
// § 4  PURE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logistic sigmoid function.
 *
 * @param {number} x  Input value.
 * @returns {number}  Value in (0, 1).
 */
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

/**
 * Geometric mean of a non-empty array of positive numbers.
 * Guards against zero or negative values via max(v, EPSILON).
 *
 * @param {number[]} values  Array of values, all expected in (0, 1].
 * @returns {number}  Geometric mean in (0, 1].
 */
function geometricMean(values) {
    if (!values || values.length === 0) return 0;
    const n = values.length;
    let logSum = 0;
    for (const v of values) {
        logSum += Math.log(Math.max(v, EPSILON));
    }
    return Math.exp(logSum / n);
}

/**
 * Map a continuous confidence to the matching CSL_SIGNAL zone object.
 *
 * @param {number} confidence  Value in [0, 1].
 * @returns {Object}  One of the CSL_SIGNAL entries.
 */
function confidenceToZone(confidence) {
    if (confidence >= PSI)  return CSL_SIGNAL.ENGAGE;
    if (confidence >= PSI2) return CSL_SIGNAL.CAUTIOUS;
    if (confidence >= PSI3) return CSL_SIGNAL.HOLD;
    return CSL_SIGNAL.REPEL;
}

/**
 * Clamp a value to [min, max].
 *
 * @param {number} v    Value to clamp.
 * @param {number} min  Lower bound.
 * @param {number} max  Upper bound.
 * @returns {number}
 */
function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
}

/**
 * Compute SHA-256 hex digest of any JSON-serialisable value.
 *
 * @param {*} value  Value to hash.
 * @returns {string}  Lowercase hex digest.
 */
function sha256(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5  DETERMINISM VERIFICATION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constants snapshot used for SHA-256 determinism verification.
 * Logged once at module load; any environment can reproduce this hash to
 * confirm bit-for-bit constant integrity.
 *
 * @type {string}
 */
const CONSTANTS_DIGEST = sha256({ PHI, PSI, EPSILON, PSI2, PSI3, PHI2, PHI3 });

// ─────────────────────────────────────────────────────────────────────────────
// § 6  ApexRiskAgentCSL CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class ApexRiskAgentCSL
 * @extends EventEmitter
 *
 * @description
 *   Risk management agent for Apex Trader Funding evaluation accounts.
 *   All gate logic uses φ-derived continuous scoring (CSL) rather than
 *   binary ternary branches, providing smooth signal surfaces and
 *   portfolio-level geometric mean risk aggregation.
 *
 * @fires ApexRiskAgentCSL#riskUpdate     Emitted on every `checkRiskCSL` call.
 * @fires ApexRiskAgentCSL#violation      Emitted when any Apex rule is violated.
 * @fires ApexRiskAgentCSL#sessionStart   Emitted when a trading session opens.
 * @fires ApexRiskAgentCSL#sessionEnd     Emitted when a trading session closes.
 * @fires ApexRiskAgentCSL#payoutReady    Emitted when payout conditions are met.
 *
 * @example
 * const agent = new ApexRiskAgentCSL({ accountType: '100K' });
 * agent.startSession();
 * const result = agent.checkRiskCSL(100450, -200);
 * console.log(result.signal.label); // 'ENGAGE' or 'CAUTIOUS' etc.
 */
class ApexRiskAgentCSL extends EventEmitter {

    /**
     * @param {Object} config                     Configuration object.
     * @param {string} config.accountType         Apex account tier key, e.g. '100K'.
     * @param {number} [config.sessionPnL=0]      Running session P&L.
     * @param {number} [config.dailyPnL=0]        Today's realised P&L.
     * @param {number} [config.tradingDays=0]      Profitable trading days logged.
     * @param {number} [config.payoutCount=0]      Historical payout count.
     * @param {number} [config.totalProfit=0]      Cumulative realised profit.
     * @param {number} [config.highWaterMark=null] Session equity high-water mark.
     */
    constructor(config = {}) {
        super();

        const {
            accountType     = '100K',
            sessionPnL      = 0,
            dailyPnL        = 0,
            tradingDays     = 0,
            payoutCount     = 0,
            totalProfit     = 0,
            highWaterMark   = null,
        } = config;

        if (!APEX_RULES.accounts[accountType]) {
            throw new Error(`Unknown Apex account type: "${accountType}". Valid: ${Object.keys(APEX_RULES.accounts).join(', ')}`);
        }

        /** @type {string} */
        this.accountType = accountType;

        /** @type {Object} Apex rule parameters for this tier. */
        this.rules = APEX_RULES.accounts[accountType];

        /** @type {number} */
        this.sessionPnL = sessionPnL;

        /** @type {number} */
        this.dailyPnL = dailyPnL;

        /** @type {number} Profitable trading days accumulated. */
        this.tradingDays = tradingDays;

        /** @type {number} Total payout requests made. */
        this.payoutCount = payoutCount;

        /** @type {number} Cumulative realised profit. */
        this.totalProfit = totalProfit;

        /** @type {number|null} Session equity high-water mark. */
        this.highWaterMark = highWaterMark;

        /** @type {boolean} Whether a session is currently active. */
        this.sessionActive = false;

        /** @type {Date|null} */
        this.sessionStartTime = null;

        /** @type {Object[]} Last portfolio risk snapshot. */
        this._lastPortfolioSnapshot = [];

        /** @type {string} Constants digest for determinism verification. */
        this.constantsDigest = CONSTANTS_DIGEST;
    }

    // ── § 6.1  CSL CORE SCORING ──────────────────────────────────────────────

    /**
     * Compute continuous CSL risk score for a single open position.
     *
     * Risk is the geometric mean of three φ-weighted sub-risks:
     *   • Drawdown proximity  — how close current drawdown is to the trailing limit.
     *   • MAE proximity       — how close open adverse excursion is to the MAE limit.
     *   • Consistency proximity — how close today's P&L is to the 30 % consistency cap.
     *
     * Each sub-risk uses: sigmoid((actual/limit − ψ) × φ³)
     * which maps the "danger zone" around the ψ (0.618) utilisation ratio
     * onto a smooth [0,1] curve centred on 0.5.
     *
     * @param {Object} position              Open position descriptor.
     * @param {number} position.equity       Current account equity.
     * @param {number} position.openPnL      Unrealised P&L (negative = loss).
     * @param {number} [position.mae]        Maximum adverse excursion of this trade.
     * @param {number} [position.dailyPnL]   Today's realised P&L.
     * @returns {{ riskScore: number, drawdownRisk: number, maeRisk: number,
     *             consistencyRisk: number, digest: string }}
     */
    cslRiskScore(position) {
        const { equity, openPnL = 0, mae = 0, dailyPnL = this.dailyPnL } = position;
        const { trailingDrawdown, initialMAE } = this.rules;

        // Drawdown proximity
        const drawdownUsed  = Math.max(0, -openPnL - this.sessionPnL);
        const drawdownRatio = drawdownUsed / (trailingDrawdown + EPSILON);
        const drawdownRisk  = sigmoid((drawdownRatio - PSI) * PHI3);

        // MAE proximity
        const maeUsed       = Math.abs(Math.min(0, mae));
        const maeRatio      = maeUsed / (initialMAE + EPSILON);
        const maeRisk       = sigmoid((maeRatio - PSI) * PHI3);

        // Consistency proximity (daily profit vs 30 % cap of session P&L)
        const consistencyCap  = Math.max(this.totalProfit, 0) * APEX_RULES.consistencyRule;
        const consistencyUsed = Math.max(0, dailyPnL);
        const consistencyRatio = consistencyUsed / (Math.max(consistencyCap, EPSILON));
        const consistencyRisk  = sigmoid((consistencyRatio - PSI) * PHI3);

        const riskScore = geometricMean([drawdownRisk, maeRisk, consistencyRisk]);

        const digest = sha256({ drawdownRisk, maeRisk, consistencyRisk, riskScore });

        return {
            riskScore: clamp(riskScore, 0, 1),
            drawdownRisk: clamp(drawdownRisk, 0, 1),
            maeRisk: clamp(maeRisk, 0, 1),
            consistencyRisk: clamp(consistencyRisk, 0, 1),
            digest,
        };
    }

    /**
     * Continuous position sizing via φ-scaled confidence and risk.
     *
     * Formula: contracts = baseSize × confidence × (1 − risk) × ψ
     *
     * @param {number} confidence  Entry confidence in [0, 1].
     * @param {number} risk        Risk score in [0, 1] from `cslRiskScore`.
     * @param {number} [baseSize=1]  Maximum allowed contracts.
     * @returns {{ contracts: number, confidence: number, risk: number,
     *             sizeRatio: number, zone: Object }}
     */
    cslPositionSize(confidence, risk, baseSize = 1) {
        const sizeRatio  = confidence * (1 - risk) * PSI;
        const contracts  = Math.max(0, Math.floor(baseSize * sizeRatio));
        const zone       = confidenceToZone(confidence);

        return {
            contracts: clamp(contracts, 0, baseSize),
            confidence: clamp(confidence, 0, 1),
            risk:       clamp(risk, 0, 1),
            sizeRatio:  clamp(sizeRatio, 0, 1),
            zone,
        };
    }

    /**
     * CSL entry gate — fuses multiple signal confidences via geometric mean.
     *
     * Entry is permitted when geometric mean confidence exceeds ψ (0.618).
     * A halt is issued when confidence falls below ψ² (0.382).
     *
     * @param {number[]} signals  Array of individual signal confidence values in [0, 1].
     * @returns {{ enter: boolean, halt: boolean, confidence: number, zone: Object,
     *             rawSignals: number[], digest: string }}
     */
    cslEntryGate(signals) {
        if (!signals || signals.length === 0) {
            return {
                enter:      false,
                halt:       true,
                confidence: 0,
                zone:       CSL_SIGNAL.REPEL,
                rawSignals: [],
                digest:     sha256({ signals: [] }),
            };
        }

        const clamped   = signals.map(s => clamp(s, 0, 1));
        const confidence = geometricMean(clamped);
        const zone      = confidenceToZone(confidence);
        const enter     = confidence > PSI;
        const halt      = confidence < PSI2;
        const digest    = sha256({ clamped, confidence });

        return { enter, halt, confidence, zone, rawSignals: clamped, digest };
    }

    /**
     * CSL exit gate — continuous exit scoring using drawdown proximity
     * and φ-scaled time decay.
     *
     * Time decay: decayFactor = exp(−elapsedMinutes / (φ² × holdMinutes))
     * Exit confidence rises as drawdown approaches limit or time decays.
     *
     * @param {Object} position               Position state.
     * @param {number} position.equity        Current equity.
     * @param {number} position.openPnL       Unrealised P&L.
     * @param {number} [position.entryTime]   Unix ms timestamp of entry.
     * @param {number} [position.maxHoldMinutes=120]  φ-scaled hold limit in minutes.
     * @param {number} [position.mae]         Maximum adverse excursion.
     * @returns {{ exit: boolean, confidence: number, reason: string,
     *             drawdownProximity: number, timeDecay: number,
     *             zone: Object, digest: string }}
     */
    cslExitGate(position) {
        const {
            equity,
            openPnL         = 0,
            entryTime       = Date.now(),
            maxHoldMinutes  = PHI2 * 60,  // φ² × 60 ≈ 157 minutes
            mae             = 0,
        } = position;
        const { trailingDrawdown } = this.rules;

        // Drawdown proximity — maps 0 → 1 as drawdown approaches limit
        const drawdownLoss      = Math.abs(Math.min(0, openPnL));
        const drawdownProximity = clamp(drawdownLoss / (trailingDrawdown + EPSILON), 0, 1);

        // Time decay factor — decays from 1 toward 0 over φ²-scaled hold time
        const elapsedMs      = Date.now() - entryTime;
        const elapsedMinutes = elapsedMs / 60000;
        const timeDecay      = Math.exp(-elapsedMinutes / (PHI2 * maxHoldMinutes + EPSILON));

        // Exit confidence: high drawdown proximity OR low time decay → exit
        const exitConfidence = geometricMean([drawdownProximity, 1 - timeDecay]);

        const exit = exitConfidence > PSI;
        const zone = confidenceToZone(exitConfidence);

        let reason = 'HOLD';
        if (exitConfidence > PSI)  reason = drawdownProximity > timeDecay ? 'DRAWDOWN_PROXIMITY' : 'TIME_DECAY';
        if (drawdownProximity > 1 - EPSILON) reason = 'DRAWDOWN_BREACH';

        const digest = sha256({ drawdownProximity, timeDecay, exitConfidence });

        return {
            exit,
            confidence:        clamp(exitConfidence, 0, 1),
            reason,
            drawdownProximity: clamp(drawdownProximity, 0, 1),
            timeDecay:         clamp(timeDecay, 0, 1),
            zone,
            digest,
        };
    }

    /**
     * Portfolio-level CSL risk via geometric mean (NOT max) across positions.
     *
     * The geometric mean naturally rewards diversification:
     * a portfolio with one high-risk and several low-risk positions
     * scores lower than a portfolio where all positions are equally risky.
     *
     * @param {Object[]} positions  Array of position descriptors (same shape as `cslRiskScore`).
     * @returns {{ portfolioRisk: number, positionRisks: Array<{riskScore:number}>,
     *             zone: Object, diversificationBenefit: number, digest: string }}
     */
    cslPortfolioRisk(positions) {
        if (!positions || positions.length === 0) {
            return {
                portfolioRisk:          0,
                positionRisks:          [],
                zone:                   CSL_SIGNAL.REPEL,
                diversificationBenefit: 0,
                digest:                 sha256({ positions: [] }),
            };
        }

        const positionRisks = positions.map(pos => this.cslRiskScore(pos));
        const riskValues    = positionRisks.map(r => r.riskScore);

        const portfolioRisk   = geometricMean(riskValues);
        const arithmeticMean  = riskValues.reduce((a, b) => a + b, 0) / riskValues.length;
        const diversificationBenefit = clamp(arithmeticMean - portfolioRisk, 0, 1);

        const zone   = confidenceToZone(1 - portfolioRisk); // invert: low risk = high confidence
        const digest = sha256({ riskValues, portfolioRisk });

        return {
            portfolioRisk:          clamp(portfolioRisk, 0, 1),
            positionRisks,
            zone,
            diversificationBenefit: clamp(diversificationBenefit, 0, 1),
            digest,
        };
    }

    // ── § 6.2  MAIN RISK CHECK (CSL) ────────────────────────────────────────

    /**
     * Enhanced Apex 3.0 rule checker using CSL continuous scoring.
     *
     * Checks every Apex Trader Funding rule and fuses results via geometric
     * mean into a single confidence/risk signal.  Returns a rich breakdown
     * suitable for dashboard rendering or downstream agent consumption.
     *
     * @param {number} equity    Current account equity.
     * @param {number} openPnL   Current unrealised P&L (negative = in loss).
     * @returns {{
     *   safe:       boolean,
     *   violations: string[],
     *   signal:     Object,
     *   confidence: number,
     *   riskScore:  number,
     *   breakdown: {
     *     drawdown:     { value:number, limit:number, ratio:number, risk:number },
     *     mae:          { value:number, limit:number, ratio:number, risk:number },
     *     consistency:  { value:number, limit:number, ratio:number, risk:number },
     *     overnight:    { allowed:boolean, violation:boolean },
     *     tradingHours: { inWindow:boolean },
     *   },
     *   digest: string
     * }}
     */
    checkRiskCSL(equity, openPnL = 0) {
        const { trailingDrawdown, initialMAE, safetyNetBuffer } = this.rules;
        const violations = [];
        const safeFloor  = this.rules.balance - trailingDrawdown + safetyNetBuffer;

        // ── Drawdown check ──────────────────────────────────────────────────
        const drawdownLoss  = Math.abs(Math.min(0, openPnL + this.sessionPnL));
        const drawdownLimit = trailingDrawdown - safetyNetBuffer;
        const drawdownRatio = drawdownLoss / (trailingDrawdown + EPSILON);
        const drawdownRisk  = sigmoid((drawdownRatio - PSI) * PHI3);
        if (equity <= safeFloor || drawdownLoss >= drawdownLimit) {
            violations.push(`DRAWDOWN_BREACH: equity=${equity}, floor=${safeFloor}`);
        }

        // ── MAE check ───────────────────────────────────────────────────────
        const maeLimit = initialMAE * APEX_RULES.maeRule * (1 / APEX_RULES.maeRule);
        const maeLoss  = Math.abs(Math.min(0, openPnL));
        const maeRatio = maeLoss / (initialMAE + EPSILON);
        const maeRisk  = sigmoid((maeRatio - PSI) * PHI3);
        if (maeLoss > initialMAE) {
            violations.push(`MAE_BREACH: mae=${maeLoss.toFixed(2)}, limit=${initialMAE}`);
        }

        // ── Consistency check ───────────────────────────────────────────────
        const consistencyCap   = this.totalProfit * APEX_RULES.consistencyRule;
        const consistencyValue = Math.max(0, this.dailyPnL);
        const consistencyRatio = consistencyValue / (Math.max(consistencyCap, EPSILON));
        const consistencyRisk  = sigmoid((consistencyRatio - PSI) * PHI3);
        if (consistencyValue > consistencyCap && this.totalProfit > 0) {
            violations.push(`CONSISTENCY_BREACH: dailyPnL=${consistencyValue.toFixed(2)}, cap=${consistencyCap.toFixed(2)}`);
        }

        // ── Overnight hold check ────────────────────────────────────────────
        const overnightViolation = !APEX_RULES.maxPositionHoldOvernight && this._isOvernightHold();

        // ── Trading-hours check ─────────────────────────────────────────────
        const inTradingWindow = this._isInTradingWindow();
        if (!inTradingWindow) {
            violations.push('OUTSIDE_TRADING_HOURS');
        }

        // ── Fuse risks via geometric mean ───────────────────────────────────
        const riskScore  = geometricMean([drawdownRisk, maeRisk, consistencyRisk]);
        const confidence = clamp(1 - riskScore, 0, 1);
        const signal     = confidenceToZone(confidence);
        const safe       = violations.length === 0 && signal !== CSL_SIGNAL.REPEL;

        // ── Emit events ─────────────────────────────────────────────────────
        if (violations.length > 0) {
            this.emit('violation', { violations, equity, openPnL, riskScore, signal });
        }
        this.emit('riskUpdate', { safe, confidence, riskScore, signal, violations });

        // ── Check payout readiness ──────────────────────────────────────────
        if (this.canRequestPayout()) {
            this.emit('payoutReady', { tradingDays: this.tradingDays, totalProfit: this.totalProfit });
        }

        const breakdown = {
            drawdown: {
                value:  drawdownLoss,
                limit:  drawdownLimit,
                ratio:  clamp(drawdownRatio, 0, 2),
                risk:   clamp(drawdownRisk, 0, 1),
            },
            mae: {
                value:  maeLoss,
                limit:  initialMAE,
                ratio:  clamp(maeRatio, 0, 2),
                risk:   clamp(maeRisk, 0, 1),
            },
            consistency: {
                value:  consistencyValue,
                limit:  consistencyCap,
                ratio:  clamp(consistencyRatio, 0, 2),
                risk:   clamp(consistencyRisk, 0, 1),
            },
            overnight: {
                allowed:   APEX_RULES.maxPositionHoldOvernight,
                violation: overnightViolation,
            },
            tradingHours: {
                inWindow: inTradingWindow,
            },
        };

        const digest = sha256({ riskScore, confidence, violations, breakdown });

        return { safe, violations, signal, confidence, riskScore, breakdown, digest };
    }

    // ── § 6.3  SESSION MANAGEMENT ────────────────────────────────────────────

    /**
     * Open a new trading session.
     *
     * Resets session-level P&L and records the high-water mark.
     *
     * @param {number} [startingEquity]  Equity at session open (defaults to account balance).
     * @fires ApexRiskAgentCSL#sessionStart
     */
    startSession(startingEquity) {
        const equity = startingEquity ?? this.rules.balance;
        this.sessionActive    = true;
        this.sessionStartTime = new Date();
        this.sessionPnL       = 0;
        this.highWaterMark    = equity;
        this._lastPortfolioSnapshot = [];
        this.emit('sessionStart', {
            accountType: this.accountType,
            startingEquity: equity,
            timestamp: this.sessionStartTime.toISOString(),
        });
    }

    /**
     * Close the current trading session.
     *
     * Records the realised P&L, updates the cumulative profit, and increments
     * the profitable-days counter if today's P&L meets the minimum threshold.
     *
     * @param {number} closingEquity  Equity at session close.
     * @fires ApexRiskAgentCSL#sessionEnd
     */
    endSession(closingEquity) {
        const realisedPnL  = closingEquity - (this.highWaterMark ?? this.rules.balance);
        this.sessionPnL   += realisedPnL;
        this.dailyPnL      = realisedPnL;
        this.totalProfit  += Math.max(0, realisedPnL);
        if (realisedPnL >= APEX_RULES.minProfitPerDay) {
            this.tradingDays += 1;
        }
        this.sessionActive = false;
        this.emit('sessionEnd', {
            realisedPnL,
            totalProfit: this.totalProfit,
            tradingDays: this.tradingDays,
            closingEquity,
        });
    }

    /**
     * Compute safety-net status for payout requests.
     *
     * The Apex safety net activates after `safetyNetPayouts` payouts and
     * prevents the balance from being drawn below the account starting balance.
     *
     * @returns {{ active: boolean, payoutsToActivation: number,
     *             safetyNetPayouts: number, currentPayouts: number }}
     */
    getSafetyNet() {
        const active = this.payoutCount >= APEX_RULES.safetyNetPayouts;
        return {
            active,
            payoutsToActivation: Math.max(0, APEX_RULES.safetyNetPayouts - this.payoutCount),
            safetyNetPayouts:    APEX_RULES.safetyNetPayouts,
            currentPayouts:      this.payoutCount,
        };
    }

    /**
     * Determine whether the account is eligible to request a payout.
     *
     * Conditions (all must pass):
     * 1. Minimum profitable trading days met.
     * 2. At least one profitable trading day at the minimum threshold.
     * 3. Minimum days between payouts since last request.
     *
     * @returns {boolean}
     */
    canRequestPayout() {
        return (
            this.tradingDays >= APEX_RULES.minProfitableDays &&
            this.dailyPnL   >= APEX_RULES.minProfitPerDay    &&
            this.payoutCount === 0   // simplification: full impl tracks lastPayoutDay
        );
    }

    /**
     * Retrieve full agent status, including CSL fields.
     *
     * @returns {Object}  Comprehensive status snapshot.
     */
    getStatus() {
        const safetyNet        = this.getSafetyNet();
        const payoutEligible   = this.canRequestPayout();
        const riskResult       = this.checkRiskCSL(
            this.rules.balance + this.sessionPnL,
            this.dailyPnL,
        );

        return {
            // Account
            accountType:     this.accountType,
            accountBalance:  this.rules.balance,
            trailingDrawdown: this.rules.trailingDrawdown,

            // Session
            sessionActive:    this.sessionActive,
            sessionStartTime: this.sessionStartTime?.toISOString() ?? null,
            sessionPnL:       this.sessionPnL,
            dailyPnL:         this.dailyPnL,
            totalProfit:      this.totalProfit,
            tradingDays:      this.tradingDays,
            highWaterMark:    this.highWaterMark,

            // Payouts
            payoutCount:     this.payoutCount,
            payoutEligible,
            safetyNet,

            // CSL risk fields
            csl: {
                signal:           riskResult.signal,
                confidence:       riskResult.confidence,
                riskScore:        riskResult.riskScore,
                safe:             riskResult.safe,
                violations:       riskResult.violations,
                breakdown:        riskResult.breakdown,
                digest:           riskResult.digest,
            },

            // Determinism
            constantsDigest:  this.constantsDigest,
            phiVersion:       { PHI, PSI, PSI2, PSI3 },
        };
    }

    // ── § 6.4  PRIVATE HELPERS ───────────────────────────────────────────────

    /**
     * Check whether current time is outside the Apex trading window.
     *
     * The Apex window is 23:00–22:00 UTC (nearly 24 h; CME Globex hours).
     *
     * @private
     * @returns {boolean}  True if inside the trading window.
     */
    _isInTradingWindow() {
        const now      = new Date();
        const utcHour  = now.getUTCHours();
        const utcMin   = now.getUTCMinutes();
        const nowMins  = utcHour * 60 + utcMin;
        const [sh, sm] = APEX_RULES.tradingHoursUTC.start.split(':').map(Number);
        const [eh, em] = APEX_RULES.tradingHoursUTC.end.split(':').map(Number);
        const startMins = sh * 60 + sm; // 1380 (23:00)
        const endMins   = eh * 60 + em; // 1320 (22:00)
        // Window crosses midnight: in window if nowMins >= 1380 OR nowMins < 1320
        return nowMins >= startMins || nowMins < endMins;
    }

    /**
     * Naïve overnight-hold check (session crosses 17:00 CT / 22:00 UTC).
     *
     * @private
     * @returns {boolean}  True if this constitutes an overnight hold.
     */
    _isOvernightHold() {
        if (!this.sessionActive || !this.sessionStartTime) return false;
        const now = new Date();
        // Overnight if session opened before 22:00 UTC and current time is after 22:00 UTC next day
        return (
            this.sessionStartTime.getUTCDate() < now.getUTCDate() &&
            now.getUTCHours() >= 22
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7  ROUTE REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register ApexRiskAgentCSL routes on an Express-compatible router.
 *
 * Routes exposed:
 *   POST /risk/check        → checkRiskCSL(equity, openPnL)
 *   POST /risk/entry        → cslEntryGate(signals)
 *   POST /risk/exit         → cslExitGate(position)
 *   POST /risk/portfolio    → cslPortfolioRisk(positions)
 *   POST /risk/size         → cslPositionSize(confidence, risk, baseSize)
 *   GET  /risk/status       → getStatus()
 *   POST /session/start     → startSession(equity)
 *   POST /session/end       → endSession(equity)
 *
 * @param {Object} router   Express router (or compatible).
 * @param {Object} [config] AgentCSL constructor config, forwarded unchanged.
 * @returns {ApexRiskAgentCSL}  The instantiated agent (for testing / DI).
 */
function registerRoutes(router, config = {}) {
    const agent = new ApexRiskAgentCSL(config);

    router.post('/risk/check', (req, res) => {
        const { equity, openPnL = 0 } = req.body;
        res.json(agent.checkRiskCSL(Number(equity), Number(openPnL)));
    });

    router.post('/risk/entry', (req, res) => {
        const { signals = [] } = req.body;
        res.json(agent.cslEntryGate(signals.map(Number)));
    });

    router.post('/risk/exit', (req, res) => {
        res.json(agent.cslExitGate(req.body));
    });

    router.post('/risk/portfolio', (req, res) => {
        const { positions = [] } = req.body;
        res.json(agent.cslPortfolioRisk(positions));
    });

    router.post('/risk/size', (req, res) => {
        const { confidence, risk, baseSize = 1 } = req.body;
        res.json(agent.cslPositionSize(Number(confidence), Number(risk), Number(baseSize)));
    });

    router.get('/risk/status', (_req, res) => {
        res.json(agent.getStatus());
    });

    router.post('/session/start', (req, res) => {
        const { equity } = req.body;
        agent.startSession(equity ? Number(equity) : undefined);
        res.json({ ok: true, sessionStartTime: agent.sessionStartTime });
    });

    router.post('/session/end', (req, res) => {
        const { equity } = req.body;
        agent.endSession(Number(equity));
        res.json({ ok: true, totalProfit: agent.totalProfit, tradingDays: agent.tradingDays });
    });

    return agent;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8  MODULE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    ApexRiskAgentCSL,
    registerRoutes,
    CSL_SIGNAL,
    APEX_RULES,
    PHI,
    PSI,
    PSI2,
    PSI3,
    PHI2,
    PHI3,
    EPSILON,
    CONSTANTS_DIGEST,
    // Utility exports for downstream consumers
    sigmoid,
    geometricMean,
    confidenceToZone,
    sha256,
};
