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
// ║  FILE: apps/hive/src/compliance_gateway.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const fs = require('fs');
const path = require('path');
const Governance = require('./governance');

class ComplianceGateway {
    constructor() {
        this.gov = new Governance('COMPLIANCE_GATEWAY');
        this.configPath = path.join(__dirname, '../config/compliance_config.json');
        this.auditPath = path.join(__dirname, '../infrastructure/compliance_audit.jsonl');
        this.config = this.loadConfig();
        this.pendingApprovals = new Map();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
            }
        } catch (e) {
            console.error('[COMPLIANCE] Failed to load config:', e.message);
        }
        return this.getDefaultConfig();
    }

    getDefaultConfig() {
        return {
            version: '1.0',
            enabled: true,
            strict_mode: true,
            auto_approve_low_risk: true,
            require_human_for_critical: true,
            approval_timeout_seconds: 3600,
            blocked_patterns: [
                'rm -rf /',
                'drop database',
                'delete all',
                'format drive',
                'expose secret'
            ],
            trusted_sources: ['orchestrator', 'conductor', 'governance'],
            audit_retention_days: 90
        };
    }

    verify(context) {
        const reportId = `compliance_${Date.now()}`;
        const timestamp = new Date().toISOString();

        this.gov.log('COMPLIANCE_CHECK', `Verifying task ${context.task_id}`);

        const violations = [];
        const warnings = [];
        const passedChecks = [];

        violations.push(...this.checkSecurity(context));
        violations.push(...this.checkArchitecture(context));
        violations.push(...this.checkGovernance(context));
        violations.push(...this.checkDataHandling(context));

        const { approvalStatus, approvalReason } = this.determineApproval(violations, context);

        const report = {
            report_id: reportId,
            task_id: context.task_id,
            timestamp,
            approved: ['approved', 'auto_approved'].includes(approvalStatus),
            approval_status: approvalStatus,
            violations,
            warnings,
            passed_checks: passedChecks,
            approval_reason: approvalReason,
            requires_human_review: approvalStatus === 'requires_human',
            auto_fix_available: violations.some(v => v.can_auto_fix),
            metadata: { context, config: this.config }
        };

        this.auditVerification(report);

        if (approvalStatus === 'requires_human') {
            this.pendingApprovals.set(reportId, report);
            this.gov.log('COMPLIANCE_PENDING', `Task ${context.task_id} requires human approval`);
        }

        if (report.approved) {
            this.gov.log('COMPLIANCE_APPROVED', `Task ${context.task_id} approved (${approvalStatus})`);
        } else {
            this.gov.log('COMPLIANCE_BLOCKED', `Task ${context.task_id} blocked: ${approvalReason}`);
        }

        return report;
    }

    checkSecurity(context) {
        const violations = [];
        const desc = context.task_description.toLowerCase();

        const secretPattern = /(api[_-]?key|password|secret|token)\s*=\s*['"][^'"]+['"]/i;
        if (secretPattern.test(context.task_description)) {
            violations.push({
                violation_id: `viol_${Date.now()}`,
                rule_id: 'SEC-001',
                level: 'critical',
                violation_type: 'security',
                message: 'Potential hardcoded secret detected',
                detected_at: new Date().toISOString(),
                can_auto_fix: false,
                fix_suggestion: 'Use environment variables or secret management'
            });
        }

        for (const pattern of this.config.blocked_patterns) {
            if (desc.includes(pattern.toLowerCase())) {
                violations.push({
                    violation_id: `viol_${Date.now()}`,
                    rule_id: 'SEC-BLOCKED',
                    level: 'critical',
                    violation_type: 'security',
                    message: `Blocked pattern detected: ${pattern}`,
                    detected_at: new Date().toISOString(),
                    can_auto_fix: false,
                    fix_suggestion: 'Remove dangerous operation'
                });
            }
        }

        return violations;
    }

    checkArchitecture(context) {
        const violations = [];
        const desc = context.task_description.toLowerCase();

        const glassBoxKeywords = ['log', 'audit', 'governance', 'emit'];
        if (!glassBoxKeywords.some(kw => desc.includes(kw))) {
            if (['build', 'deploy', 'modify'].includes(context.task_type)) {
                violations.push({
                    violation_id: `viol_${Date.now()}`,
                    rule_id: 'ARCH-002',
                    level: 'medium',
                    violation_type: 'architecture',
                    message: 'Task should emit governance logs (Glass Box Mandate)',
                    detected_at: new Date().toISOString(),
                    can_auto_fix: true,
                    fix_suggestion: 'Add governance logging to implementation'
                });
            }
        }

        return violations;
    }

    checkGovernance(context) {
        const violations = [];
        const desc = context.task_description.toLowerCase();

        if (desc.includes('headysystems') && desc.includes('headyconnection')) {
            violations.push({
                violation_id: `viol_${Date.now()}`,
                rule_id: 'GOV-002',
                level: 'high',
                violation_type: 'governance',
                message: 'Task affects both HeadySystems and HeadyConnection domains',
                detected_at: new Date().toISOString(),
                can_auto_fix: false,
                fix_suggestion: 'Split into separate domain-specific tasks'
            });
        }

        return violations;
    }

    checkDataHandling(context) {
        const violations = [];

        const piiPatterns = [
            /\b\d{3}-\d{2}-\d{4}\b/,
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
        ];

        for (const pattern of piiPatterns) {
            if (pattern.test(context.task_description)) {
                violations.push({
                    violation_id: `viol_${Date.now()}`,
                    rule_id: 'DATA-002',
                    level: 'critical',
                    violation_type: 'data_handling',
                    message: 'Potential PII detected in task description',
                    detected_at: new Date().toISOString(),
                    can_auto_fix: false,
                    fix_suggestion: 'Remove PII or use data masking'
                });
                break;
            }
        }

        return violations;
    }

    determineApproval(violations, context) {
        const critical = violations.filter(v => v.level === 'critical');
        if (critical.length > 0) {
            return {
                approvalStatus: 'rejected',
                approvalReason: `CRITICAL violations detected: ${critical.length} issues must be resolved`
            };
        }

        const high = violations.filter(v => v.level === 'high');
        if (high.length > 0 && this.config.require_human_for_critical) {
            return {
                approvalStatus: 'requires_human',
                approvalReason: `HIGH severity violations require human review: ${high.length} issues`
            };
        }

        const medium = violations.filter(v => v.level === 'medium');
        if (medium.length > 0) {
            if (this.config.auto_approve_low_risk) {
                return {
                    approvalStatus: 'auto_approved',
                    approvalReason: `AUTO-APPROVED with ${medium.length} medium severity warnings`
                };
            } else {
                return {
                    approvalStatus: 'requires_human',
                    approvalReason: 'Medium violations require review in strict mode'
                };
            }
        }

        return {
            approvalStatus: 'approved',
            approvalReason: 'All compliance checks passed'
        };
    }

    auditVerification(report) {
        try {
            const dir = path.dirname(this.auditPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const auditEntry = {
                timestamp: new Date().toISOString(),
                report_id: report.report_id,
                task_id: report.task_id,
                approved: report.approved,
                approval_status: report.approval_status,
                violation_count: report.violations.length,
                critical_count: report.violations.filter(v => v.level === 'critical').length,
                high_count: report.violations.filter(v => v.level === 'high').length
            };

            fs.appendFileSync(this.auditPath, JSON.stringify(auditEntry) + '\n', 'utf-8');
        } catch (e) {
            console.error('[COMPLIANCE] Failed to audit:', e.message);
        }
    }

    approvePending(reportId, approver, reason) {
        if (!this.pendingApprovals.has(reportId)) {
            return false;
        }

        const report = this.pendingApprovals.get(reportId);
        report.approved = true;
        report.approval_status = 'approved';
        report.approval_reason = `Manually approved by ${approver}: ${reason}`;
        report.metadata.approver = approver;
        report.metadata.approval_timestamp = new Date().toISOString();

        this.auditVerification(report);
        this.pendingApprovals.delete(reportId);

        this.gov.log('COMPLIANCE_MANUAL_APPROVAL', `Report ${reportId} approved by ${approver}`);
        return true;
    }

    rejectPending(reportId, rejector, reason) {
        if (!this.pendingApprovals.has(reportId)) {
            return false;
        }

        const report = this.pendingApprovals.get(reportId);
        report.approved = false;
        report.approval_status = 'rejected';
        report.approval_reason = `Rejected by ${rejector}: ${reason}`;
        report.metadata.rejector = rejector;
        report.metadata.rejection_timestamp = new Date().toISOString();

        this.auditVerification(report);
        this.pendingApprovals.delete(reportId);

        this.gov.log('COMPLIANCE_MANUAL_REJECTION', `Report ${reportId} rejected by ${rejector}`);
        return true;
    }

    getPendingApprovals() {
        return Array.from(this.pendingApprovals.values());
    }

    getStatistics() {
        try {
            if (!fs.existsSync(this.auditPath)) {
                return { total_verifications: 0 };
            }

            const lines = fs.readFileSync(this.auditPath, 'utf-8').split('\n').filter(l => l.trim());
            let total = 0, approved = 0, rejected = 0, autoApproved = 0;

            for (const line of lines) {
                const entry = JSON.parse(line);
                total++;
                if (entry.approval_status === 'approved') approved++;
                else if (entry.approval_status === 'rejected') rejected++;
                else if (entry.approval_status === 'auto_approved') autoApproved++;
            }

            return {
                total_verifications: total,
                approved,
                rejected,
                auto_approved: autoApproved,
                pending: this.pendingApprovals.size,
                approval_rate: total > 0 ? ((approved + autoApproved) / total * 100).toFixed(2) : 0
            };
        } catch (e) {
            console.error('[COMPLIANCE] Failed to get statistics:', e.message);
            return { error: e.message };
        }
    }
}

module.exports = ComplianceGateway;
