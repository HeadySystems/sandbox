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
// ║  FILE: apps/hive/src/optimizer.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const Governance = require('./governance');
const socratic = require('./socratic_protocol');
const { selectTask, updateJsonFile } = require('./state_store');
const { fibCeil } = require('./growth');
const gov = new Governance('OPTIMIZER');

const queuePath = '/shared/state/task_queue.json';
const pollIntervalMs = fibCeil(5000);

console.log('[OPTIMIZER] Online. Monitoring Staging Area...');

function monitor() {
    try {
        let decisionLog = null;

        updateJsonFile(queuePath, [], (queueRaw) => {
            const queue = Array.isArray(queueRaw) ? queueRaw : [];
            const task = selectTask(queue, 'STAGED');
            if (!task) return queue;

            const decision = socratic.evaluate(task.instruction, {
                type: task.type || 'STANDARD',
                files_changed: task.files_changed || []
            }) || {};

            const tools = Array.isArray(decision.recommended_tools) ? decision.recommended_tools : [];
            const needsSecurityAudit = tools.includes('snyk');

            task.optimization_strategy = decision.complexity;
            task.required_mcp_tools = tools;
            task.reasoning = decision.reasoning;
            if (needsSecurityAudit) {
                task.security_audit_required = true;
            }

            task.status = 'READY_TO_BUILD';

            decisionLog = {
                task_id: task.id,
                complexity: decision.complexity,
                tools,
                reasoning: decision.reasoning,
                security: needsSecurityAudit
            };

            return queue;
        });

        if (decisionLog) {
            gov.log('ANALYSIS', `Socratic Analysis for Task ${decisionLog.task_id}...`);

            if (decisionLog.security) {
                gov.log('SECURITY', 'High-risk task detected. Enforcing security audit protocols.');
            }

            gov.log('ADVICE', `Strategy: ${decisionLog.complexity}. Allocated Tools: ${decisionLog.tools.join(', ')}`);
            gov.log('REASONING', decisionLog.reasoning);
        }
    } catch (e) {
        console.error('[OPTIMIZER] Error:', e.message);
    }
    setTimeout(monitor, pollIntervalMs);
}
monitor();
