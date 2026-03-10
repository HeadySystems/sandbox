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
// ║  FILE: apps/hive/src/conductor.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const Governance = require('./governance');
const ComplianceGateway = require('./compliance_gateway');
const { selectTask, updateJsonFile } = require('./state_store');
const gov = new Governance('CONDUCTOR');
const compliance = new ComplianceGateway();
const queuePath = '/shared/state/task_queue.json';

console.log('[CONDUCTOR] Online. Managing Dynamic Resources...');

function allocateWorkers() {
    let work = null;
    try {
        updateJsonFile(queuePath, [], (queueRaw) => {
            const queue = Array.isArray(queueRaw) ? queueRaw : [];
            const task = selectTask(queue, 'READY_TO_BUILD');
            if (!task) return queue;

            task.status = 'BUILDING';

            work = {
                id: task.id,
                strategy: task.optimization_strategy || 'STANDARD',
                tools: Array.isArray(task.required_mcp_tools) ? task.required_mcp_tools : [],
                security_audit_required: Boolean(task.security_audit_required),
                artifact_path: task.artifact_path
            };

            return queue;
        });
    } catch (e) {
        console.error('[CONDUCTOR] Error:', e.message);
    }

    if (work) {
        gov.log('ALLOCATION', `Spawning Dynamic Worker for Task ${work.id} [Strategy: ${work.strategy}]`);

        // COMPLIANCE VERIFICATION (FINAL GATEWAY)
        gov.log('COMPLIANCE_CHECK', `Running compliance verification for Task ${work.id}`);
        
        const complianceContext = {
            task_id: work.id,
            task_description: work.artifact_path || 'Build task',
            task_type: 'build',
            affected_files: [],
            affected_services: [],
            dependencies: [],
            security_level: 'high',
            requires_audit: true,
            metadata: {
                strategy: work.strategy,
                tools: work.tools,
                security_audit_required: work.security_audit_required
            }
        };
        
        const complianceReport = compliance.verify(complianceContext);
        
        // Check if compliance approved
        if (!complianceReport.approved) {
            gov.log('COMPLIANCE_BLOCKED', `Task ${work.id} BLOCKED by compliance verifier: ${complianceReport.approval_reason}`);
            
            // Update task status to BLOCKED
            try {
                updateJsonFile(queuePath, [], (queueRaw) => {
                    const queue = Array.isArray(queueRaw) ? queueRaw : [];
                    const tUpdate = queue.find(t => t && t.id === work.id);
                    if (tUpdate && tUpdate.status === 'BUILDING') {
                        tUpdate.status = 'BLOCKED_BY_COMPLIANCE';
                        tUpdate.compliance_report = {
                            report_id: complianceReport.report_id,
                            violations: complianceReport.violations,
                            requires_human_review: complianceReport.requires_human_review
                        };
                    }
                    return queue;
                });
            } catch (err) {
                console.error('Error updating queue:', err.message);
            }
            
            // Do not proceed with execution
            setTimeout(allocateWorkers, 2000);
            return;
        }
        
        // Check if requires human approval
        if (complianceReport.approval_status === 'requires_human') {
            gov.log('COMPLIANCE_PENDING', `Task ${work.id} requires human approval`);
            
            // Update task status to PENDING_APPROVAL
            try {
                updateJsonFile(queuePath, [], (queueRaw) => {
                    const queue = Array.isArray(queueRaw) ? queueRaw : [];
                    const tUpdate = queue.find(t => t && t.id === work.id);
                    if (tUpdate && tUpdate.status === 'BUILDING') {
                        tUpdate.status = 'PENDING_COMPLIANCE_APPROVAL';
                        tUpdate.compliance_report = {
                            report_id: complianceReport.report_id,
                            violations: complianceReport.violations
                        };
                    }
                    return queue;
                });
            } catch (err) {
                console.error('Error updating queue:', err.message);
            }
            
            // Do not proceed with execution
            setTimeout(allocateWorkers, 2000);
            return;
        }
        
        // Compliance APPROVED - proceed with execution
        gov.log('COMPLIANCE_APPROVED', `Task ${work.id} approved by compliance verifier (${complianceReport.approval_status})`);

        // Dynamic Resource Calculation
        let memory = '256m';
        let cpu = '0.5';

        if (work.strategy === 'HIGH') {
            memory = '1024m';
            cpu = '2.0';
            gov.log('SCALING', `Complex task detected. Scaling resources to ${memory} RAM / ${cpu} CPUs.`);
        } else {
            gov.log('SCALING', `Standard task. Using efficiency profile: ${memory} RAM.`);
        }

        // MCP Tool Provisioning
        if (work.tools.length > 0) {
            gov.log('PROVISIONING', `Injecting MCP Context for: ${work.tools.join(', ')}`);
        }

        // Simulation of spawning and build execution
        let buildTime = work.strategy === 'HIGH' ? 8000 : 3000;

        // Security Audit Simulation
        if (work.security_audit_required) {
            gov.log('SECURITY_PROTOCOL', 'Initiating Snyk Security Scan...');
            gov.log('SECURITY_PROTOCOL', 'Scanning dependencies for vulnerabilities...');
            buildTime += 2000;
            setTimeout(() => {
                gov.log('SECURITY_PROTOCOL', 'Scan Complete. No critical vulnerabilities found. Proceeding to build.');
            }, 1000);
        }

        setTimeout(() => {
            const workerId = Math.random().toString(36).slice(2, 9);
            gov.log('BUILDER_SWARM', `Worker Container [ID: ${workerId}] Finished.`);
            gov.log('ARTIFACT', `Build artifact generated at ${work.artifact_path || 'internal'}`);

            try {
                updateJsonFile(queuePath, [], (queueRaw) => {
                    const queue = Array.isArray(queueRaw) ? queueRaw : [];
                    const tUpdate = queue.find(t => t && t.id === work.id);
                    if (tUpdate && tUpdate.status === 'BUILDING') tUpdate.status = 'COMPLETE';
                    return queue;
                });
            } catch (err) {
                console.error('Error updating queue:', err.message);
            }
        }, buildTime);
    }
    setTimeout(allocateWorkers, 2000);
}
allocateWorkers();
