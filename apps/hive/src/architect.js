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
// ║  FILE: apps/hive/src/architect.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const fs = require('fs');
const path = require('path');
const Governance = require('./governance');
const socratic = require('./socratic_protocol');
const { selectTask, updateJsonFile, readJsonFile } = require('./state_store');
const gov = new Governance('ARCHITECT');
const queuePath = '/shared/state/task_queue.json';
const vinciStatePath = '/shared/state/vinci_state.json';

function work() {
    try {
        let staged = null;
        updateJsonFile(queuePath, [], (queueRaw) => {
            const queue = Array.isArray(queueRaw) ? queueRaw : [];
            const task = selectTask(queue, 'PENDING');
            if (!task) return queue;

            const draftPath = `/shared/drafts/build_${task.id}.js`;
            fs.mkdirSync(path.dirname(draftPath), { recursive: true });
            fs.writeFileSync(draftPath, '// Generated via MCP Orchestration');

            task.status = 'STAGED'; 
            task.artifact_path = draftPath;
            staged = { id: task.id, instruction: task.instruction };
            return queue;
        });

        if (staged) {
            gov.log('MCP_CONNECT', `Connecting to MCP Servers for: ${staged.instruction}`);
            const instr = staged.instruction.toLowerCase();
            if (instr.includes('repo') || instr.includes('github')) {
                 gov.log('MCP_ALLOC', 'Allocating @git and @filesystem for Repository Creation.');
            } else if (instr.includes('huggingface') || instr.includes('model') || instr.includes('inference')) {
                 gov.log('MCP_ALLOC', 'Allocating @huggingface and @filesystem for AI model operations.');
            } else if (instr.includes('gemini') || instr.includes('google')) {
                 gov.log('MCP_ALLOC', 'Allocating @google_mcp and @filesystem for Google AI operations.');
            } else {
                 gov.log('MCP_ALLOC', 'Allocating @filesystem for standard file IO.');
            }
        }
    } catch(e) {}
    setTimeout(work, 3000);
}
work();
