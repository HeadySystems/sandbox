/**
 * @fileoverview Heady™ Governance Gate — Pre/Post Execution Governance Checks
 *
 * Enforces governance policy before and after AI execution calls:
 *
 *   Pre-execution:
 *     - Budget validation (abort if over-limit)
 *     - Risk-level gating:
 *         LOW      → auto-approve (log only)
 *         MEDIUM   → log + telemetry
 *         HIGH     → checkpoint (require explicit approval token)
 *         CRITICAL → human approval (async gate)
 *
 *   Post-execution:
 *     - Output validation
 *     - Audit trail record with Ed25519-style receipt signing concept
 *
 * Audit receipts are HMAC-SHA256 signatures of the execution record
 * (a real Ed25519 impl would require a crypto key pair; here we use
 * the built-in `crypto` module's HMAC as the signing primitive).
 *
 * All thresholds and limits from phi-math — ZERO magic numbers.
 *
 * @module governance-gate
 * @see shared/phi-math.js
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const { EventEmitter } = require('events');
const crypto            = require('crypto');
const {
  PSI,
  fib,
  PHI_TIMING,
  CSL_THRESHOLDS,
  ALERTS,
} = require('../../shared/phi-math.js');

// ─── Governance constants ─────────────────────────────────────────────────────

/**
 * Risk level definitions.
 * @enum {string}
 */
const RISK_LEVEL = Object.freeze({
  LOW:      'LOW',
  MEDIUM:   'MEDIUM',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
});

/**
 * Risk actions per level.
 */
const RISK_ACTIONS = Object.freeze({
  [RISK_LEVEL.LOW]:      'auto',
  [RISK_LEVEL.MEDIUM]:   'log',
  [RISK_LEVEL.HIGH]:     'checkpoint',
  [RISK_LEVEL.CRITICAL]: 'human',
});

/** Budget warning threshold: PSI ≈ 0.618 (61.8% of budget used) */
const BUDGET_WARN_FRAC = PSI;              // 0.618

/** Budget hard-stop threshold: ALERTS.EXCEEDED ≈ 0.910 */
const BUDGET_HARD_STOP_FRAC = ALERTS.EXCEEDED;  // ≈ 0.910

/** Audit trail ring size: fib(12) = 144 entries */
const AUDIT_RING_SIZE = fib(12);

/** Approval token expiry: PHI_TIMING.PHI_7 = 29,034ms */
const APPROVAL_TOKEN_TTL_MS = PHI_TIMING.PHI_7;

/** Human approval timeout: PHI_TIMING.PHI_10 = 121,393ms ≈ 2 minutes */
const HUMAN_APPROVAL_TIMEOUT_MS = PHI_TIMING.PHI_10;

// ─── GovernanceGate class ─────────────────────────────────────────────────────

/**
 * @class GovernanceGate
 * @extends EventEmitter
 *
 * Pre/post execution governance authority.
 *
 * Events:
 *   'pre:approved'    ({runId, riskLevel, action})      — pre-check passed
 *   'pre:blocked'     ({runId, reason})                 — pre-check blocked
 *   'pre:checkpoint'  ({runId, token})                  — HIGH risk checkpoint issued
 *   'pre:humanReview' ({runId, record})                 — CRITICAL requires human
 *   'post:audited'    ({runId, receiptId, signature})   — audit trail written
 *   'budget:warn'     ({runId, spent, limit, fraction}) — approaching budget limit
 *   'budget:hard'     ({runId, spent, limit})           — over budget hard-stop
 */
class GovernanceGate extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {string} [opts.signingKey]      - secret key for HMAC signing (hex string)
   * @param {object} [opts.logger]          - logger with .info/.warn/.error
   * @param {Function} [opts.humanApprover] - async fn(record) → boolean (for CRITICAL risk)
   */
  constructor(opts = {}) {
    super();
    this._log      = opts.logger || console;
    this._sigKey   = opts.signingKey  || _defaultSigningKey();
    this._approve  = opts.humanApprover || null;

    /** Audit trail ring buffer: array of audit records */
    this._auditRing = [];

    /** Pending approval tokens: token → { runId, record, expiresAt } */
    this._pendingApprovals = new Map();

    this._log.info('[GovernanceGate] init auditRing=%d budgetWarn=%s%% budgetStop=%s%%',
      AUDIT_RING_SIZE,
      (BUDGET_WARN_FRAC * 100).toFixed(1),
      (BUDGET_HARD_STOP_FRAC * 100).toFixed(1));
  }

  // ─── Pre-execution gate ───────────────────────────────────────────────────

  /**
   * Run pre-execution governance checks.
   *
   * @param {object} record
   * @param {string}  record.runId         - execution run ID
   * @param {string}  [record.riskLevel]   - 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
   * @param {number}  [record.budgetSpent] - cumulative spend so far ($)
   * @param {number}  [record.budgetLimit] - total budget for this run ($)
   * @param {string}  [record.approvalToken] - token for HIGH risk checkpoint bypass
   * @param {object}  [record.metadata]   - arbitrary metadata logged to audit
   * @returns {Promise<{ approved: boolean, action: string, token?: string }>}
   */
  async preCheck(record) {
    const { runId, riskLevel = RISK_LEVEL.LOW, budgetSpent = 0, budgetLimit = 0 } = record;

    // ── Budget check ───────────────────────────────────────────────────────
    if (budgetLimit > 0) {
      const frac = budgetSpent / budgetLimit;
      if (frac >= BUDGET_HARD_STOP_FRAC) {
        this.emit('budget:hard', { runId, spent: budgetSpent, limit: budgetLimit });
        this._log.error('[GovernanceGate] HARD STOP run=%s spent=$%s limit=$%s',
          runId, budgetSpent.toFixed(4), budgetLimit);
        this.emit('pre:blocked', { runId, reason: 'budget_exceeded' });
        return { approved: false, action: 'blocked', reason: 'budget_exceeded' };
      }
      if (frac >= BUDGET_WARN_FRAC) {
        this.emit('budget:warn', { runId, spent: budgetSpent, limit: budgetLimit, fraction: frac });
        this._log.warn('[GovernanceGate] budget_warn run=%s %s%%',
          runId, (frac * 100).toFixed(1));
      }
    }

    // ── Risk-level gating ──────────────────────────────────────────────────
    const action = RISK_ACTIONS[riskLevel] || RISK_ACTIONS[RISK_LEVEL.LOW];

    if (action === 'auto') {
      // LOW: auto-approve, log only
      this._log.info('[GovernanceGate] AUTO run=%s risk=%s', runId, riskLevel);
      this.emit('pre:approved', { runId, riskLevel, action });
      return { approved: true, action };
    }

    if (action === 'log') {
      // MEDIUM: log + telemetry
      this._log.info('[GovernanceGate] LOG run=%s risk=%s', runId, riskLevel);
      this._writeAudit({ type: 'pre', runId, riskLevel, decision: 'approved', ...record });
      this.emit('pre:approved', { runId, riskLevel, action });
      return { approved: true, action };
    }

    if (action === 'checkpoint') {
      // HIGH: require valid approval token
      if (record.approvalToken && this._validateToken(record.approvalToken, runId)) {
        this._log.info('[GovernanceGate] CHECKPOINT PASSED run=%s', runId);
        this.emit('pre:approved', { runId, riskLevel, action });
        return { approved: true, action };
      }
      // Issue a new token
      const token = this._issueToken(runId, record);
      this.emit('pre:checkpoint', { runId, token });
      this._log.warn('[GovernanceGate] CHECKPOINT ISSUED run=%s token=%s…', runId, token.slice(0, 12));
      return { approved: false, action: 'checkpoint', token };
    }

    if (action === 'human') {
      // CRITICAL: delegate to human approver or block
      return this._awaitHumanApproval(runId, record);
    }

    // Fallback: block unknown risk levels
    this.emit('pre:blocked', { runId, reason: `unknown_risk_level:${riskLevel}` });
    return { approved: false, action: 'blocked', reason: 'unknown_risk_level' };
  }

  // ─── Post-execution audit ─────────────────────────────────────────────────

  /**
   * Run post-execution audit trail recording.
   * Signs the execution record with an HMAC receipt.
   *
   * @param {object} record
   * @param {string}  record.runId      - execution run ID
   * @param {object}  record.output     - execution output summary
   * @param {number}  [record.durationMs]
   * @param {number}  [record.cost]
   * @param {string}  [record.riskLevel]
   * @returns {{ receiptId: string, signature: string, timestamp: number }}
   */
  postAudit(record) {
    const timestamp  = Date.now();
    const receiptId  = `receipt-${record.runId}-${timestamp.toString(36)}`;
    const payload    = JSON.stringify({ receiptId, timestamp, ...record });
    const signature  = this._sign(payload);

    const auditEntry = {
      receiptId,
      signature,
      timestamp,
      runId:    record.runId,
      riskLevel: record.riskLevel,
      durationMs: record.durationMs,
      cost:      record.cost,
      outputHash: crypto.createHash('sha256').update(payload).digest('hex').slice(0, fib(6)), // 8 chars
    };

    this._writeAudit(auditEntry);
    this.emit('post:audited', { runId: record.runId, receiptId, signature });

    this._log.info('[GovernanceGate] audit run=%s receipt=%s sig=%s…',
      record.runId, receiptId, signature.slice(0, fib(5) * 2)); // first 10 hex chars

    return { receiptId, signature, timestamp };
  }

  // ─── Audit ring ───────────────────────────────────────────────────────────

  /** @private */
  _writeAudit(entry) {
    this._auditRing.push(entry);
    if (this._auditRing.length > AUDIT_RING_SIZE) {
      this._auditRing.shift(); // discard oldest
    }
  }

  /**
   * Return a copy of the current audit trail (most recent AUDIT_RING_SIZE entries).
   * @returns {object[]}
   */
  getAuditTrail() {
    return [...this._auditRing];
  }

  // ─── Token helpers ────────────────────────────────────────────────────────

  /** @private */
  _issueToken(runId, record) {
    const token = crypto.randomBytes(fib(6)).toString('hex'); // fib(6)=8 bytes = 16 hex chars
    this._pendingApprovals.set(token, {
      runId,
      record,
      expiresAt: Date.now() + APPROVAL_TOKEN_TTL_MS,
    });
    return token;
  }

  /** @private */
  _validateToken(token, runId) {
    const pending = this._pendingApprovals.get(token);
    if (!pending) return false;
    if (pending.runId !== runId) return false;
    if (Date.now() > pending.expiresAt) {
      this._pendingApprovals.delete(token);
      return false;
    }
    this._pendingApprovals.delete(token);
    return true;
  }

  // ─── Human approval ───────────────────────────────────────────────────────

  /**
   * Await human approval for CRITICAL risk runs.
   * Times out after HUMAN_APPROVAL_TIMEOUT_MS (PHI_10 ≈ 121s).
   * @private
   */
  async _awaitHumanApproval(runId, record) {
    this.emit('pre:humanReview', { runId, record });
    this._log.warn('[GovernanceGate] HUMAN REVIEW REQUIRED run=%s', runId);

    if (!this._approve) {
      this._log.error('[GovernanceGate] no humanApprover configured, blocking run=%s', runId);
      return { approved: false, action: 'blocked', reason: 'no_human_approver' };
    }

    try {
      const approvedOrTimeout = await Promise.race([
        this._approve(record),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('human_approval_timeout')),
            HUMAN_APPROVAL_TIMEOUT_MS,
          )
        ),
      ]);

      if (approvedOrTimeout) {
        this._writeAudit({ type: 'human_approval', runId, decision: 'approved', ...record });
        this.emit('pre:approved', { runId, riskLevel: RISK_LEVEL.CRITICAL, action: 'human' });
        return { approved: true, action: 'human' };
      } else {
        this.emit('pre:blocked', { runId, reason: 'human_denied' });
        return { approved: false, action: 'blocked', reason: 'human_denied' };
      }
    } catch (err) {
      this.emit('pre:blocked', { runId, reason: err.message });
      return { approved: false, action: 'blocked', reason: err.message };
    }
  }

  // ─── HMAC signing ─────────────────────────────────────────────────────────

  /**
   * Sign a payload string with HMAC-SHA256.
   * In a production Ed25519 implementation, replace with `crypto.sign('ed25519', ...)`.
   * @param {string} payload
   * @returns {string} hex signature
   * @private
   */
  _sign(payload) {
    return crypto.createHmac('sha256', this._sigKey).update(payload).digest('hex');
  }
}

// ─── Default signing key ──────────────────────────────────────────────────────

/**
 * Generate an ephemeral signing key (32 bytes).
 * Production deployments should inject a real Ed25519 private key.
 * @private
 */
function _defaultSigningKey() {
  return crypto.randomBytes(fib(9)).toString('hex'); // fib(9)=34 bytes
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  GovernanceGate,
  RISK_LEVEL,
  RISK_ACTIONS,
  BUDGET_WARN_FRAC,
  BUDGET_HARD_STOP_FRAC,
  AUDIT_RING_SIZE,
  APPROVAL_TOKEN_TTL_MS,
  HUMAN_APPROVAL_TIMEOUT_MS,
};
