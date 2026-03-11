'use strict';

/**
 * ComplianceAuditorBee — License, GDPR, patent zone, and policy compliance checks.
 * Uses phi-harmonic risk scoring and Fibonacci rule priority weights.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;

const HEARTBEAT_MS        = Math.round(PHI3 * 1000);   // 4236 ms
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);      // ≈ 0.618
const RISK_CRITICAL       = 1 - Math.pow(PSI, 4);      // ≈ 0.910
const RISK_HIGH           = 1 - Math.pow(PSI, 3);      // ≈ 0.854
const RISK_MEDIUM         = 1 - Math.pow(PSI, 2);      // ≈ 0.764

// Fibonacci-weighted rule priority (higher = more severe)
const RULE_WEIGHTS = {
  GDPR_PERSONAL_DATA:     13,   // fib(7)
  GDPR_CONSENT:           13,
  LICENSE_COMMERCIAL:     8,    // fib(6)
  LICENSE_COPYLEFT:       8,
  PATENT_ZONE:            5,    // fib(5)
  PII_EXPOSURE:           13,
  DATA_RESIDENCY:         8,
  RETENTION_VIOLATION:    5,
  MODEL_OUTPUT_RISK:      8,
  SECURITY_CLASSIFICATION: 13,
};

const AUDIT_LOG_MAX = 233;   // fib(13)

class ComplianceAuditorBee {
  constructor(config = {}) {
    this.id          = config.id ?? `compliance-${Date.now()}`;
    this.region      = config.region ?? 'EU';
    this.strictMode  = config.strictMode ?? true;

    this._alive      = false;
    this._coherence  = 1.0;
    this._auditLog   = [];
    this._violations = 0;
    this._warnings   = 0;
    this._heartbeatTimer = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._auditLog   = [];
    this._violations = 0;
    this._warnings   = 0;
    this._coherence  = 1.0;
    this._activeRules = this._buildRuleSet(this.region);
  }

  _buildRuleSet(region) {
    const base = ['LICENSE_COMMERCIAL', 'LICENSE_COPYLEFT', 'MODEL_OUTPUT_RISK', 'PII_EXPOSURE'];
    const eu   = ['GDPR_PERSONAL_DATA', 'GDPR_CONSENT', 'DATA_RESIDENCY', 'RETENTION_VIOLATION'];
    const us   = ['PATENT_ZONE', 'SECURITY_CLASSIFICATION'];
    const all  = region === 'EU' ? [...base, ...eu] :
                 region === 'US' ? [...base, ...us] :
                 [...base, ...eu, ...us];
    return all.map(r => ({ rule: r, weight: RULE_WEIGHTS[r] ?? 3 }));
  }

  /**
   * Execute compliance audit on content/metadata.
   * @param {object} task — { content: string, metadata: object, requestedOps?: string[] }
   */
  async execute(task) {
    if (!this._alive) throw new Error('ComplianceAuditorBee not spawned');
    const { content = '', metadata = {}, requestedOps = [] } = task;

    const findings = [];
    let totalRisk = 0;

    for (const { rule, weight } of this._activeRules) {
      const check = this._checkRule(rule, content, metadata, requestedOps);
      if (check.triggered) {
        const riskScore = this._calcRisk(weight, check.confidence);
        findings.push({ rule, ...check, riskScore, weight });
        totalRisk = Math.max(totalRisk, riskScore);
        if (riskScore >= RISK_HIGH) this._violations++;
        else this._warnings++;
      }
    }

    const verdict = totalRisk >= RISK_CRITICAL ? 'BLOCKED' :
                    totalRisk >= RISK_HIGH      ? 'VIOLATION' :
                    totalRisk >= RISK_MEDIUM    ? 'WARNING' : 'PASS';

    const record = { ts: Date.now(), verdict, findings, totalRisk, content: content.slice(0, 144) };
    this._pushLog(record);
    this._updateCoherence(findings.length);

    return { verdict, totalRisk: parseFloat(totalRisk.toFixed(4)), findings, coherence: this._coherence };
  }

  _checkRule(rule, content, metadata, ops) {
    const lower = content.toLowerCase();
    switch (rule) {
      case 'GDPR_PERSONAL_DATA':
        return {
          triggered: /\b(email|phone|address|ssn|passport|dob)\b/.test(lower),
          confidence: 0.854, message: 'Personal data indicators detected',
        };
      case 'GDPR_CONSENT':
        return {
          triggered: metadata.hasConsent === false,
          confidence: 0.910, message: 'Missing GDPR consent flag',
        };
      case 'LICENSE_COMMERCIAL':
        return {
          triggered: /\b(gpl|agpl|lgpl|copyleft)\b/.test(lower) && ops.includes('COMMERCIAL_USE'),
          confidence: 0.809, message: 'Copyleft license in commercial context',
        };
      case 'LICENSE_COPYLEFT':
        return {
          triggered: /\b(gpl-3|agpl-3)\b/.test(lower),
          confidence: 0.764, message: 'Strong copyleft license detected',
        };
      case 'PATENT_ZONE':
        return {
          triggered: metadata.patentZone === true,
          confidence: 0.691, message: 'Content in known patent encumbrance zone',
        };
      case 'PII_EXPOSURE':
        return {
          triggered: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/.test(content),   // SSN pattern
          confidence: 0.927, message: 'Potential SSN-pattern PII detected',
        };
      case 'DATA_RESIDENCY':
        return {
          triggered: metadata.dataRegion && metadata.dataRegion !== this.region,
          confidence: 0.809, message: `Data region mismatch: expected ${this.region}`,
        };
      case 'RETENTION_VIOLATION':
        return {
          triggered: metadata.retentionDays && metadata.retentionDays > 377,  // fib(14)
          confidence: 0.691, message: 'Retention period exceeds policy (fib(14)=377 days)',
        };
      case 'MODEL_OUTPUT_RISK':
        return {
          triggered: /\b(weapon|explosive|malware|exfiltrate)\b/.test(lower),
          confidence: 0.972, message: 'High-risk model output content detected',
        };
      case 'SECURITY_CLASSIFICATION':
        return {
          triggered: metadata.classification === 'SECRET' || metadata.classification === 'TOP_SECRET',
          confidence: 0.854, message: `Content classified: ${metadata.classification}`,
        };
      default:
        return { triggered: false, confidence: 0 };
    }
  }

  _calcRisk(weight, confidence) {
    // Phi-harmonic risk: (weight / maxWeight) × confidence × φ, capped at 1.0
    const maxWeight = 13;
    return Math.min(1.0, (weight / maxWeight) * confidence * PHI);
  }

  _updateCoherence(findingCount) {
    // More violations degrade coherence
    const penalty = findingCount * PSI * 0.05;
    this._coherence = Math.max(0, Math.min(1.0, this._coherence - penalty + PSI * 0.01));
  }

  _pushLog(entry) {
    this._auditLog.push(entry);
    if (this._auditLog.length > AUDIT_LOG_MAX) this._auditLog.shift();
  }

  heartbeat() {
    this._coherence = Math.min(1.0, this._coherence + PSI * 0.005);
  }

  getHealth() {
    return {
      id: this.id,
      region: this.region,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence: parseFloat(this._coherence.toFixed(4)),
      violations: this._violations,
      warnings: this._warnings,
      activeRules: this._activeRules?.length ?? 0,
      auditLogDepth: this._auditLog.length,
      riskThresholds: { CRITICAL: RISK_CRITICAL, HIGH: RISK_HIGH, MEDIUM: RISK_MEDIUM },
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = {
  ComplianceAuditorBee, RULE_WEIGHTS, RISK_CRITICAL, RISK_HIGH, RISK_MEDIUM, COHERENCE_THRESHOLD,
};
