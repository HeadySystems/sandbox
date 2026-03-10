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
// ║  FILE: apps/hive/src/api.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const Governance = require('./governance');
const HeadyVinci = require('./heady_vinci');
const HeadyRefiner = require('./heady_refiner');
const determinism = require('./determinism');
const { readJsonFile, writeJsonAtomic, updateJsonFile } = require('./state_store');
const gov = new Governance('ORCHESTRATOR');
const app = express();

app.use(cors());
app.use(express.json());

const queuePath = '/shared/state/task_queue.json';
const getQueue = () => {
    const queue = readJsonFile(queuePath, []);
    return Array.isArray(queue) ? queue : [];
};
const updateQueue = (updater) => updateJsonFile(queuePath, [], (current) => {
    const queue = Array.isArray(current) ? current : [];
    const next = updater(queue);
    return Array.isArray(next) ? next : queue;
});

const questionsPath = '/shared/state/questions.json';
const getQuestions = () => {
    const questions = readJsonFile(questionsPath, []);
    return Array.isArray(questions) ? questions : [];
};
const saveQuestions = (q) => writeJsonAtomic(questionsPath, q);

const vinciStatePath = '/shared/state/vinci_state.json';
const getVinciState = () => {
    try { 
        const data = readJsonFile(vinciStatePath, null);
        if (!data || typeof data !== 'object') throw new Error('invalid_vinci_state');
        if (!data.tasks || typeof data.tasks !== 'object') data.tasks = {};
        if (!data.metadata || typeof data.metadata !== 'object') data.metadata = {};
        return data;
    } catch {
        return {
            metadata: { version: '1.0', created_at: new Date().toISOString() },
            tasks: {}
        };
    }
};
const saveVinciState = (state) => writeJsonAtomic(vinciStatePath, state);

const refinerStatePath = '/shared/state/refiner_state.json';
const getRefinerState = () => {
    try {
        const data = readJsonFile(refinerStatePath, null);
        if (!data || typeof data !== 'object') throw new Error('invalid_refiner_state');
        if (!data.tasks || typeof data.tasks !== 'object') data.tasks = {};
        if (!data.metadata || typeof data.metadata !== 'object') data.metadata = {};
        return data;
    } catch {
        return {
            metadata: { version: '1.0', created_at: new Date().toISOString() },
            tasks: {}
        };
    }
};
const saveRefinerState = (state) => writeJsonAtomic(refinerStatePath, state);

const buildsPath = '/shared/state/build_state.json';

function normalizeBuildsState(data) {
    const nowIso = new Date().toISOString();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {
            metadata: { version: '1.0', created_at: nowIso },
            builds: {}
        };
    }
    if (!data.metadata || typeof data.metadata !== 'object' || Array.isArray(data.metadata)) {
        data.metadata = { version: '1.0', created_at: nowIso };
    }
    if (!data.metadata.version) data.metadata.version = '1.0';
    if (!data.metadata.created_at) data.metadata.created_at = nowIso;
    if (!data.builds || typeof data.builds !== 'object' || Array.isArray(data.builds)) data.builds = {};
    return data;
}

function getBuildsState() {
    const data = readJsonFile(buildsPath, null);
    return normalizeBuildsState(data);
}

function updateBuildsState(updater) {
    const nowIso = new Date().toISOString();
    return updateJsonFile(
        buildsPath,
        { metadata: { version: '1.0', created_at: nowIso }, builds: {} },
        (current) => {
            const state = normalizeBuildsState(current);
            const next = updater(state);
            return normalizeBuildsState(next || state);
        }
    );
}

const connectionsPath = '/shared/state/connections.json';

function normalizeConnectionsState(data) {
    const nowIso = new Date().toISOString();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {
            metadata: { version: '1.0', created_at: nowIso },
            connections: []
        };
    }
    if (!data.metadata || typeof data.metadata !== 'object' || Array.isArray(data.metadata)) {
        data.metadata = { version: '1.0', created_at: nowIso };
    }
    if (!data.metadata.version) data.metadata.version = '1.0';
    if (!data.metadata.created_at) data.metadata.created_at = nowIso;
    if (!Array.isArray(data.connections)) data.connections = [];
    return data;
}

function getConnectionsState() {
    const data = readJsonFile(connectionsPath, null);
    return normalizeConnectionsState(data);
}

function updateConnectionsState(updater) {
    const nowIso = new Date().toISOString();
    return updateJsonFile(
        connectionsPath,
        { metadata: { version: '1.0', created_at: nowIso }, connections: [] },
        (current) => {
            const state = normalizeConnectionsState(current);
            const next = updater(state);
            return normalizeConnectionsState(next || state);
        }
    );
}

function findConnection(state, connectionId) {
    return (state?.connections || []).find(c => c && c.id === connectionId) || null;
}

function publicConnection(connection) {
    if (!connection || typeof connection !== 'object' || Array.isArray(connection)) return null;
    const safe = { ...connection };
    if (safe.config && typeof safe.config === 'object' && !Array.isArray(safe.config)) {
        safe.config = { ...safe.config };
        delete safe.config.token;
        delete safe.config.api_key;
        delete safe.config.deploy_hook_url;
    }
    return safe;
}

function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.floor(n);
    return Math.max(min, Math.min(max, i));
}

function truncate(text, maxLen) {
    const s = String(text || '');
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen - 3)}...`;
}

function buildInstructionFromSpec(spec) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null;
    const name = spec.name || spec.app_name || spec.app || null;
    const kind = spec.kind || spec.type || 'app';
    const stack = spec.stack ? JSON.stringify(spec.stack) : null;
    const requirements = spec.requirements ? JSON.stringify(spec.requirements) : JSON.stringify(spec);
    const title = name ? ` named "${name}"` : '';
    const stackText = stack ? ` Stack: ${stack}.` : '';
    return `Automated App Build Request: Build a ${kind}${title}.${stackText} Requirements: ${requirements}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(t);
    }
}

async function requestJson(url, options = {}, timeoutMs = 10000) {
    const res = await fetchWithTimeout(url, options, timeoutMs);
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
}

function getEnvSecret(envKey) {
    const key = String(envKey || '').trim();
    if (!key) return null;
    const value = process.env[key];
    if (!value || !String(value).trim()) return null;
    return String(value).trim();
}

function shouldAutoEnableRefiner(instruction) {
    const lower = String(instruction || '').toLowerCase();
    return (
        lower.includes('refiner') ||
        lower.includes('colab') ||
        lower.includes('cuda') ||
        lower.includes('gpu') ||
        lower.includes('t4') ||
        lower.includes('sentence-transformers') ||
        lower.includes('silicon bridge') ||
        lower.includes('silicon refinery')
    );
}

function normalizeRefinerContext(context) {
    return HeadyRefiner.normalizeContext(context) || 'TOPOLOGY_MAPPING';
}

function buildRefinerConfig(instruction, requested) {
    const autoEnabled = shouldAutoEnableRefiner(instruction);
    const enabled = Boolean((requested && requested.enabled !== undefined) ? requested.enabled : autoEnabled);
    if (!enabled) return null;
    const context = normalizeRefinerContext(requested?.context);
    return { enabled: true, context };
}

function ensureRefinerTask(state, task, refinerConfig) {
    if (!state.tasks || typeof state.tasks !== 'object') state.tasks = {};
    const nowIso = new Date().toISOString();
    const current = state.tasks[task.id] || {};

    const entry = {
        task_id: task.id,
        instruction: task.instruction,
        created_at: current.created_at || nowIso,
        updated_at: nowIso,
        enabled: true,
        context: normalizeRefinerContext(refinerConfig?.context || current.context)
    };

    state.tasks[task.id] = entry;
    return entry;
}

function shouldAutoEnableVinci(instruction) {
    const lower = String(instruction || '').toLowerCase();
    return lower.includes('headyvinci') || lower.includes('vinci') || lower.includes('variation');
}

function normalizeVinciMode(mode) {
    const normalized = String(mode || 'CONSTANT').toUpperCase();
    if (normalized === 'MANUAL') return 'MANUAL';
    return 'CONSTANT';
}

function buildVinciConfig(instruction, requested) {
    const autoEnabled = shouldAutoEnableVinci(instruction);
    const enabled = Boolean((requested && requested.enabled !== undefined) ? requested.enabled : autoEnabled);
    if (!enabled) return null;

    const mode = normalizeVinciMode(requested?.mode);
    const rateMs = clampInt(requested?.rate_ms, 1000, 60000, 10000);
    const maxVariations = clampInt(requested?.max_variations, 1, 500, 25);
    const initialVariations = clampInt(requested?.initial_variations, 0, 20, 3);

    return {
        enabled: true,
        mode,
        rate_ms: rateMs,
        max_variations: maxVariations,
        initial_variations: initialVariations
    };
}

function ensureVinciTask(state, task, vinciConfig) {
    if (!state.tasks || typeof state.tasks !== 'object') state.tasks = {};
    const nowIso = new Date().toISOString();
    const current = state.tasks[task.id] || {};

    const entry = {
        task_id: task.id,
        instruction: task.instruction,
        created_at: current.created_at || nowIso,
        updated_at: nowIso,
        enabled: true,
        mode: vinciConfig.mode,
        rate_ms: vinciConfig.rate_ms,
        max_variations: vinciConfig.max_variations,
        next_generate_at: current.next_generate_at || nowIso,
        generated_total: Number.isFinite(Number(current.generated_total)) ? Number(current.generated_total) : 0,
        variations: Array.isArray(current.variations) ? current.variations : []
    };

    state.tasks[task.id] = entry;
    return entry;
}

function generateVinciVariation(entry) {
    if (!entry || !entry.enabled) return null;
    entry.variations = Array.isArray(entry.variations) ? entry.variations : [];
    const max = clampInt(entry.max_variations, 1, 500, 25);
    const seq = clampInt(entry.generated_total, 0, 1000000000, entry.variations.length);
    const variation = HeadyVinci.nextVariation(entry.instruction, seq);
    entry.generated_total = seq + 1;
    entry.variations.push(variation);
    if (entry.variations.length > max) {
        entry.variations = entry.variations.slice(-max);
    }
    entry.updated_at = new Date().toISOString();
    const rateMs = clampInt(entry.rate_ms, 1000, 60000, 10000);
    entry.next_generate_at = new Date(Date.now() + rateMs).toISOString();
    return variation;
}

function findTask(queue, taskId) {
    return queue.find(t => t.id === taskId);
}

app.post('/api/tasks', (req, res) => {
    const { instruction, priority, vinci, refiner } = req.body;
    const vinciConfig = buildVinciConfig(instruction, vinci);
    const refinerConfig = buildRefinerConfig(instruction, refiner);
    const newTask = {
        id: determinism.nextId('task'),
        instruction,
        priority: priority || 'NORMAL',
        status: 'PENDING',
        created_at: new Date()
    };
    if (vinciConfig) {
        newTask.vinci = {
            enabled: true,
            mode: vinciConfig.mode,
            rate_ms: vinciConfig.rate_ms,
            max_variations: vinciConfig.max_variations
        };
    }
    if (refinerConfig) {
        newTask.refiner = {
            enabled: true,
            context: refinerConfig.context
        };
    }
    updateQueue((queue) => {
        queue.push(newTask);
        return queue;
    });
    gov.log('TASK_QUEUED', `Task: ${instruction}`);

    if (vinciConfig) {
        const state = getVinciState();
        const entry = ensureVinciTask(state, newTask, vinciConfig);
        const seeded = [];
        for (let i = 0; i < vinciConfig.initial_variations; i++) {
            const v = generateVinciVariation(entry);
            if (v) seeded.push(v);
        }
        saveVinciState(state);

        gov.log('CREATIVITY', `HeadyVinci enabled for Task ${newTask.id} (mode=${vinciConfig.mode}, rate_ms=${vinciConfig.rate_ms}, max=${vinciConfig.max_variations}). Seeded ${seeded.length} variation(s).`);
        if (seeded[0]) {
            gov.log('CREATIVITY', `Vinci[${seeded[0].lens}/${seeded[0].mode}] Task ${newTask.id}: ${truncate(seeded[0].text, 240)}`);
        }
    }

    if (refinerConfig) {
        const state = getRefinerState();
        const entry = ensureRefinerTask(state, newTask, refinerConfig);
        saveRefinerState(state);
        gov.log('COMPUTE', `HeadyRefiner enabled for Task ${newTask.id} (context=${entry.context}).`);
    }

    res.json({ success: true, task: newTask });
});

app.get('/api/vinci/lenses', (req, res) => {
    res.json({ lenses: HeadyVinci.lenses() });
});

app.get('/api/tasks/:id/vinci', (req, res) => {
    const taskId = req.params.id;
    const state = getVinciState();
    const entry = state.tasks?.[taskId];
    if (!entry) return res.status(404).json({ success: false, error: 'vinci_task_not_found' });
    res.json({ success: true, vinci: entry });
});

app.get('/api/refiner/contexts', (req, res) => {
    res.json({ contexts: HeadyRefiner.contexts() });
});

app.get('/api/refiner/handshake', (req, res) => {
    res.json({ script: HeadyRefiner.handshakeScript() });
});

app.get('/api/refiner/bootstrap', (req, res) => {
    res.json({ script: HeadyRefiner.bootstrapScript() });
});

app.get('/api/refiner/master_prompt', (req, res) => {
    const context = req.query?.context;
    res.json({ prompt: HeadyRefiner.masterPrompt(context || null) });
});

app.get('/api/refiner/context_script', (req, res) => {
    const context = req.query?.context;
    const normalized = HeadyRefiner.normalizeContext(context);
    if (!normalized) return res.status(400).json({ success: false, error: 'invalid_context' });
    const script = HeadyRefiner.contextScript(normalized);
    res.json({ success: true, context: normalized, script });
});

app.get('/api/tasks/:id/refiner', (req, res) => {
    const taskId = req.params.id;
    const state = getRefinerState();
    const entry = state.tasks?.[taskId];
    if (!entry) return res.status(404).json({ success: false, error: 'refiner_task_not_found' });
    res.json({ success: true, refiner: entry });
});

app.post('/api/tasks/:id/refiner', (req, res) => {
    const taskId = req.params.id;
    const body = req.body || {};

    const enabled = body.enabled !== undefined ? Boolean(body.enabled) : true;
    const state = getRefinerState();
    const nowIso = new Date().toISOString();

    let taskFound = false;
    let updatedTask = null;
    let context = null;

    updateQueue((queue) => {
        const task = findTask(queue, taskId);
        if (!task) return queue;
        taskFound = true;

        if (!enabled) {
            delete task.refiner;
            updatedTask = task;
            return queue;
        }

        context = normalizeRefinerContext(body.context);
        task.refiner = { enabled: true, context };
        updatedTask = task;
        return queue;
    });

    if (!taskFound) return res.status(404).json({ success: false, error: 'task_not_found' });

    if (!enabled) {
        if (state.tasks?.[taskId]) {
            state.tasks[taskId].enabled = false;
            state.tasks[taskId].updated_at = nowIso;
        }
        saveRefinerState(state);
        gov.log('COMPUTE', `HeadyRefiner disabled for Task ${taskId}.`);
        return res.json({ success: true, task: updatedTask, refiner: state.tasks?.[taskId] || null });
    }

    const entry = ensureRefinerTask(state, updatedTask, { enabled: true, context });
    entry.enabled = true;
    entry.context = context;
    entry.updated_at = nowIso;
    entry.last_config_at = nowIso;
    saveRefinerState(state);
    gov.log('COMPUTE', `HeadyRefiner configured for Task ${taskId} (context=${context}).`);
    res.json({ success: true, task: updatedTask, refiner: entry });
});

app.get('/api/tasks/:id/refiner/script', (req, res) => {
    const taskId = req.params.id;
    const queue = getQueue();
    const task = findTask(queue, taskId);
    if (!task) return res.status(404).json({ success: false, error: 'task_not_found' });

    const state = getRefinerState();
    const entry = state.tasks?.[taskId] || ensureRefinerTask(state, task, { enabled: true, context: 'TOPOLOGY_MAPPING' });
    if (!entry.enabled) entry.enabled = true;

    const context = normalizeRefinerContext(req.query?.context || entry.context);
    const script = HeadyRefiner.contextScript(context);
    if (!script) return res.status(400).json({ success: false, error: 'invalid_context' });

    entry.context = context;
    entry.updated_at = new Date().toISOString();
    entry.last_script_generated_at = entry.updated_at;
    saveRefinerState(state);
    gov.log('COMPUTE', `Refiner script generated for Task ${taskId} (context=${context}).`);

    res.json({ success: true, task_id: taskId, context, script });
});

app.post('/api/tasks/:id/vinci/generate', (req, res) => {
    const taskId = req.params.id;
    const state = getVinciState();
    const entry = state.tasks?.[taskId];
    if (!entry) return res.status(404).json({ success: false, error: 'vinci_task_not_found' });

    entry.enabled = true;
    const variation = generateVinciVariation(entry);
    saveVinciState(state);

    if (variation) {
        gov.log('CREATIVITY', `Vinci[${variation.lens}/${variation.mode}] Task ${taskId}: ${truncate(variation.text, 240)}`);
    }

    res.json({ success: true, variation: variation || null, vinci: entry });
});

app.post('/api/questions', (req, res) => {
    const { question, task_id, asked_by, context, pause_task } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ success: false, error: 'question_required' });
    }

    const questions = getQuestions();
    const newQuestion = {
        id: determinism.nextId('question'),
        question: question.trim(),
        task_id: task_id || null,
        asked_by: asked_by || 'ORCHESTRATOR',
        status: 'PENDING',
        created_at: new Date().toISOString(),
        context: context || null
    };

    let updatedTask = null;
    if (task_id) {
        const shouldPauseTask = pause_task !== false;
        if (!shouldPauseTask) {
            const queue = getQueue();
            const task = findTask(queue, task_id);
            if (!task) {
                return res.status(404).json({ success: false, error: 'task_not_found' });
            }
        } else {
            let taskFound = false;
            let alreadyWaitingId = null;

            updateQueue((queue) => {
                const task = findTask(queue, task_id);
                if (!task) return queue;
                taskFound = true;

                if (task.waiting_question_id && task.status === 'WAITING_FOR_ANSWER') {
                    alreadyWaitingId = task.waiting_question_id;
                    return queue;
                }

                task.resume_status = task.status;
                task.status = 'WAITING_FOR_ANSWER';
                task.waiting_question_id = newQuestion.id;
                task.waiting_since = new Date().toISOString();
                updatedTask = task;
                return queue;
            });

            if (!taskFound) {
                return res.status(404).json({ success: false, error: 'task_not_found' });
            }

            if (alreadyWaitingId) {
                return res.status(409).json({
                    success: false,
                    error: 'task_already_waiting',
                    waiting_question_id: alreadyWaitingId
                });
            }
        }
    }

    questions.push(newQuestion);
    saveQuestions(questions);
    gov.log('ADVICE', `QUESTION ${newQuestion.id}: ${newQuestion.question}`);
    res.json({ success: true, question: newQuestion, task: updatedTask });
});

app.get('/api/questions', (req, res) => {
    const { status, task_id } = req.query || {};
    let questions = getQuestions();

    if (status) {
        const normalizedStatus = String(status).toUpperCase();
        questions = questions.filter(q => (q.status || '').toUpperCase() === normalizedStatus);
    }

    if (task_id) {
        questions = questions.filter(q => q.task_id === task_id);
    }

    res.json(questions);
});

app.post('/api/questions/:id/answer', (req, res) => {
    const questionId = req.params.id;
    const { answer, answered_by } = req.body || {};
    if (!answer || typeof answer !== 'string' || !answer.trim()) {
        return res.status(400).json({ success: false, error: 'answer_required' });
    }

    const questions = getQuestions();
    const q = questions.find(x => x.id === questionId);
    if (!q) {
        return res.status(404).json({ success: false, error: 'question_not_found' });
    }

    if (q.status === 'ANSWERED') {
        return res.status(409).json({ success: false, error: 'question_already_answered' });
    }

    q.answer = answer.trim();
    q.answered_by = answered_by || 'USER';
    q.answered_at = new Date().toISOString();
    q.status = 'ANSWERED';
    saveQuestions(questions);

    let updatedTask = null;
    if (q.task_id) {
        updateQueue((queue) => {
            const task = findTask(queue, q.task_id);
            if (!task) return queue;

            if (!Array.isArray(task.qa_history)) task.qa_history = [];
            task.qa_history.push({
                question_id: q.id,
                question: q.question,
                answer: q.answer,
                asked_by: q.asked_by,
                answered_by: q.answered_by,
                answered_at: q.answered_at
            });

            if (task.waiting_question_id === q.id && task.status === 'WAITING_FOR_ANSWER') {
                task.status = task.resume_status || 'PENDING';
                delete task.resume_status;
                delete task.waiting_question_id;
                delete task.waiting_since;
            }

            updatedTask = task;
            return queue;
        });
    }

    gov.log('info', `ANSWER ${q.id}: ${q.answer}`);
    res.json({ success: true, question: q, task: updatedTask });
});

app.get('/api/connections', (req, res) => {
    const state = getConnectionsState();
    res.json({
        metadata: state.metadata,
        connections: (state.connections || []).map(publicConnection).filter(Boolean)
    });
});

app.post('/api/connections', (req, res) => {
    const body = req.body || {};
    const type = String(body.type || '').trim().toLowerCase();
    const name = String(body.name || '').trim() || type.toUpperCase();
    const rawConfig = (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) ? body.config : {};

    const forbidden = ['token', 'api_key', 'deploy_hook_url', 'deploy_hook'];
    for (const key of forbidden) {
        if (rawConfig[key]) {
            return res.status(400).json({ success: false, error: 'secrets_must_be_env', key });
        }
    }

    const nowIso = new Date().toISOString();
    let config = null;
    if (type === 'github') {
        config = {
            api_base: String(rawConfig.api_base || 'https://api.github.com'),
            token_env: String(rawConfig.token_env || 'GITHUB_TOKEN'),
            default_owner: rawConfig.default_owner ? String(rawConfig.default_owner) : null,
            default_repo: rawConfig.default_repo ? String(rawConfig.default_repo) : null
        };
    } else if (type === 'render') {
        let hookMethod = String(rawConfig.hook_method || 'POST').toUpperCase();
        if (hookMethod !== 'GET' && hookMethod !== 'POST') hookMethod = 'POST';
        config = {
            deploy_hook_env: String(rawConfig.deploy_hook_env || 'RENDER_DEPLOY_HOOK_URL'),
            hook_method: hookMethod
        };
    } else {
        return res.status(400).json({ success: false, error: 'invalid_connection_type' });
    }

    const connection = {
        id: determinism.nextId('connection'),
        type,
        name,
        config,
        created_at: nowIso,
        updated_at: nowIso,
        status: {
            last_test_at: null,
            last_test_ok: null,
            last_error: null
        }
    };

    updateConnectionsState((state) => {
        state.connections.push(connection);
        return state;
    });

    gov.log('INTEGRATION', `Connection created: ${type} ${connection.id} (${name})`);
    res.json({ success: true, connection: publicConnection(connection) });
});

app.delete('/api/connections/:id', (req, res) => {
    const connectionId = req.params.id;
    let removed = null;
    updateConnectionsState((state) => {
        const idx = (state.connections || []).findIndex(c => c && c.id === connectionId);
        if (idx === -1) return state;
        removed = state.connections[idx];
        state.connections.splice(idx, 1);
        return state;
    });
    if (!removed) return res.status(404).json({ success: false, error: 'connection_not_found' });
    gov.log('INTEGRATION', `Connection deleted: ${removed.type} ${connectionId} (${removed.name || ''})`);
    res.json({ success: true, deleted: publicConnection(removed) });
});

app.post('/api/connections/:id/test', async (req, res) => {
    const connectionId = req.params.id;
    const state = getConnectionsState();
    const connection = findConnection(state, connectionId);
    if (!connection) return res.status(404).json({ success: false, error: 'connection_not_found' });

    const nowIso = new Date().toISOString();
    let ok = false;
    let error = null;
    let details = null;

    try {
        if (connection.type === 'github') {
            const apiBase = String(connection.config?.api_base || 'https://api.github.com').replace(/\/+$/, '');
            const tokenEnv = String(connection.config?.token_env || 'GITHUB_TOKEN');
            const token = getEnvSecret(tokenEnv);
            if (!token) {
                error = `missing_env:${tokenEnv}`;
            } else {
                const result = await requestJson(`${apiBase}/user`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/vnd.github+json',
                        'User-Agent': 'HeadyHive',
                        'Authorization': `Bearer ${token}`
                    }
                }, 8000);
                ok = Boolean(result.ok);
                if (ok) {
                    details = {
                        login: result.data?.login || null,
                        id: result.data?.id || null
                    };
                } else {
                    error = `github_http_${result.status}`;
                    details = { status: result.status, body: truncate(result.text, 240) };
                }
            }
        } else if (connection.type === 'render') {
            const hookEnv = String(connection.config?.deploy_hook_env || 'RENDER_DEPLOY_HOOK_URL');
            const hookUrl = getEnvSecret(hookEnv);
            if (!hookUrl) {
                error = `missing_env:${hookEnv}`;
            } else {
                ok = true;
                details = { deploy_hook_env: hookEnv };
            }
        } else {
            error = 'unsupported_connection_type';
        }
    } catch (e) {
        ok = false;
        error = e?.message || 'test_failed';
    }

    const updated = updateConnectionsState((s) => {
        const c = findConnection(s, connectionId);
        if (!c) return s;
        c.updated_at = nowIso;
        if (!c.status || typeof c.status !== 'object' || Array.isArray(c.status)) c.status = {};
        c.status.last_test_at = nowIso;
        c.status.last_test_ok = ok;
        c.status.last_error = ok ? null : (error || 'test_failed');
        return s;
    });
    const updatedConn = findConnection(updated, connectionId);

    if (ok) {
        gov.log('INTEGRATION', `Connection test OK: ${connection.type} ${connectionId}`);
    } else {
        gov.log('warning', `Connection test FAILED: ${connection.type} ${connectionId} (${error || 'error'})`);
    }

    res.json({ success: true, ok, error, details, connection: publicConnection(updatedConn || connection) });
});

app.get('/api/apps', (req, res) => {
    res.json({
        apps: [
            { id: 'github_create_repo', type: 'github', endpoint: '/api/apps/github/create_repo' },
            { id: 'github_create_issue', type: 'github', endpoint: '/api/apps/github/create_issue' },
            { id: 'render_deploy', type: 'render', endpoint: '/api/apps/render/deploy' }
        ]
    });
});

app.post('/api/apps/github/create_repo', async (req, res) => {
    const body = req.body || {};
    const connectionId = String(body.connection_id || '').trim();
    const repoName = String(body.repo || body.name || '').trim();
    if (!connectionId) return res.status(400).json({ success: false, error: 'connection_id_required' });
    if (!repoName) return res.status(400).json({ success: false, error: 'repo_required' });

    const state = getConnectionsState();
    const connection = findConnection(state, connectionId);
    if (!connection) return res.status(404).json({ success: false, error: 'connection_not_found' });
    if (connection.type !== 'github') return res.status(400).json({ success: false, error: 'wrong_connection_type' });

    const apiBase = String(connection.config?.api_base || 'https://api.github.com').replace(/\/+$/, '');
    const tokenEnv = String(connection.config?.token_env || 'GITHUB_TOKEN');
    const token = getEnvSecret(tokenEnv);
    if (!token) return res.status(400).json({ success: false, error: 'missing_env', env: tokenEnv });

    const payload = {
        name: repoName,
        description: body.description ? String(body.description) : '',
        private: Boolean(body.private)
    };

    const result = await requestJson(`${apiBase}/user/repos`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'HeadyHive',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }, 12000);

    if (!result.ok) {
        return res.status(502).json({
            success: false,
            error: 'github_create_repo_failed',
            status: result.status,
            body: truncate(result.text, 240)
        });
    }

    gov.log('INTEGRATION', `GitHub repo created: ${result.data?.full_name || repoName}`);
    res.json({ success: true, repo: result.data });
});

app.post('/api/apps/github/create_issue', async (req, res) => {
    const body = req.body || {};
    const connectionId = String(body.connection_id || '').trim();
    const title = String(body.title || '').trim();
    if (!connectionId) return res.status(400).json({ success: false, error: 'connection_id_required' });
    if (!title) return res.status(400).json({ success: false, error: 'title_required' });

    const state = getConnectionsState();
    const connection = findConnection(state, connectionId);
    if (!connection) return res.status(404).json({ success: false, error: 'connection_not_found' });
    if (connection.type !== 'github') return res.status(400).json({ success: false, error: 'wrong_connection_type' });

    const owner = String(body.owner || connection.config?.default_owner || '').trim();
    const repo = String(body.repo || connection.config?.default_repo || '').trim();
    if (!owner || !repo) return res.status(400).json({ success: false, error: 'owner_repo_required' });

    const apiBase = String(connection.config?.api_base || 'https://api.github.com').replace(/\/+$/, '');
    const tokenEnv = String(connection.config?.token_env || 'GITHUB_TOKEN');
    const token = getEnvSecret(tokenEnv);
    if (!token) return res.status(400).json({ success: false, error: 'missing_env', env: tokenEnv });

    const payload = {
        title,
        body: body.body ? String(body.body) : ''
    };

    const result = await requestJson(`${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'HeadyHive',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!result.ok) {
        return res.status(result.status || 500).json({
            success: false,
            error: result.error || 'github_api_error',
            details: result.data
        });
    }

    gov.log('GITHUB_ISSUE_CREATED', `Issue ${result.data.number} created in ${owner}/${repo}`);
    res.json({ success: true, issue: result.data });
});

// Build Phase API with MCP and Hugging Face Integration
app.post('/api/build/execute', async (req, res) => {
    const { phase, dry_run, verbose, skip_validation, use_mcp, use_huggingface, use_perplexity_cli, use_gemini_cli, use_yandex, use_jules, use_filesystem, use_git, use_sequential_thinking, use_postgres } = req.body || {};
    
    try {
        gov.log('BUILD_INITIATED', `Build phase: ${phase || 'all'}, MCP: ${use_mcp}, HF: ${use_huggingface}, Perplexity: ${use_perplexity_cli}, Gemini: ${use_gemini_cli}, Yandex: ${use_yandex}, Jules: ${use_jules}, Filesystem: ${use_filesystem}, Git: ${use_git}, Sequential Thinking: ${use_sequential_thinking}, Postgres: ${use_postgres}`);
        
        // Create build task
        const buildTask = {
            id: determinism.nextId('build'),
            phase: phase || 'all',
            dry_run: Boolean(dry_run),
            verbose: Boolean(verbose),
            skip_validation: Boolean(skip_validation),
            use_mcp: Boolean(use_mcp),
            use_huggingface: Boolean(use_huggingface),
            use_perplexity_cli: Boolean(use_perplexity_cli),
            use_gemini_cli: Boolean(use_gemini_cli),
            use_yandex: Boolean(use_yandex),
            use_jules: Boolean(use_jules),
            use_filesystem: Boolean(use_filesystem),
            use_git: Boolean(use_git),
            use_sequential_thinking: Boolean(use_sequential_thinking),
            use_postgres: Boolean(use_postgres),
            status: 'INITIATED',
            created_at: new Date().toISOString(),
            started_at: new Date().toISOString()
        };
        
        // Execute build phases
        const buildResults = await executeBuildPhases(buildTask);
        
        // Update build task status
        buildTask.status = 'COMPLETED';
        buildTask.completed_at = new Date().toISOString();
        buildTask.results = buildResults;
        
        gov.log('BUILD_COMPLETED', `Build task ${buildTask.id} completed successfully`);
        
        res.json({
            success: true,
            build_task: buildTask,
            results: buildResults
        });
        
    } catch (error) {
        gov.log('BUILD_FAILED', `Build execution failed: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'build_execution_failed',
            message: error.message
        });
    }
});

async function executeBuildPhases(buildTask) {
    const { spawn } = require('child_process');
    const phases = buildTask.phase === 'all' ? 
        ['scaffold', 'policy_injection', 'infrastructure', 'ignition'] : 
        [buildTask.phase];
    
    const results = {};
    
    for (const phase of phases) {
        gov.log('BUILD_PHASE', `Executing phase: ${phase}`);
        
        try {
            // Use AI services for intelligent build optimization
            const optimizations = [];
            
            if (buildTask.use_mcp && buildTask.use_huggingface) {
                const hfOptimization = await getHuggingFaceOptimization(phase);
                optimizations.push(`HF: ${hfOptimization.strategy}`);
            }
            
            if (buildTask.use_perplexity_cli) {
                const perplexityOptimization = await getPerplexityOptimization(phase);
                optimizations.push(`Perplexity: ${perplexityOptimization.strategy}`);
            }
            
            if (buildTask.use_gemini_cli) {
                const geminiOptimization = await getGeminiOptimization(phase);
                optimizations.push(`Gemini: ${geminiOptimization.strategy}`);
            }
            
            if (buildTask.use_yandex) {
                const yandexOptimization = await getYandexOptimization(phase);
                optimizations.push(`Yandex: ${yandexOptimization.strategy}`);
            }
            
            if (buildTask.use_jules) {
                const julesOptimization = await getJulesOptimization(phase);
                optimizations.push(`Jules: ${julesOptimization.strategy}`);
            }
            
            if (buildTask.use_filesystem) {
                optimizations.push('Filesystem: Active');
            }
            
            if (buildTask.use_git) {
                optimizations.push('Git: Version control integration');
            }
            
            if (buildTask.use_sequential_thinking) {
                optimizations.push('Sequential Thinking: Logical reasoning');
            }
            
            if (buildTask.use_postgres) {
                optimizations.push('PostgreSQL: Data persistence');
            }
            
            if (optimizations.length > 0) {
                gov.log('BUILD_OPTIMIZATION', `Phase ${phase} optimized: ${optimizations.join(', ')}`);
            }
            
            // Execute the build phase
            const result = await executeBuildPhase(phase, buildTask);
            results[phase] = result;
            
            gov.log('BUILD_PHASE_SUCCESS', `Phase ${phase} completed: ${result.message}`);
            
        } catch (error) {
            results[phase] = {
                success: false,
                message: error.message,
                phase
            };
            gov.log('BUILD_PHASE_ERROR', `Phase ${phase} failed: ${error.message}`);
            
            // Stop on first failure unless it's a dry run
            if (!buildTask.dry_run) {
                break;
            }
        }
    }
    
    return results;
}

// MCP Service Registry - maps service names to their actual endpoints
const MCP_SERVICE_ENDPOINTS = {
    huggingface: process.env.HF_MCP_URL || null,
    perplexity: process.env.PERPLEXITY_MCP_URL || null,
    gemini: process.env.GEMINI_MCP_URL || null,
    yandex: process.env.YANDEX_MCP_URL || null,
    jules: process.env.JULES_MCP_URL || null
};

// Track which services have already logged unavailability to avoid spam
const mcpServiceWarned = new Set();

async function getHuggingFaceOptimization(phase) {
    const endpoint = MCP_SERVICE_ENDPOINTS.huggingface;
    if (!endpoint) {
        if (!mcpServiceWarned.has('huggingface')) {
            mcpServiceWarned.add('huggingface');
            gov.log('MCP_INFO', 'HuggingFace MCP not configured - using defaults');
        }
        return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
    }
    
    try {
        const huggingfaceResponse = await requestJson(`${endpoint}/inference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: `Optimize build phase "${phase}" for HeadySystems architecture.`,
                model_id: "microsoft/DialoGPT-medium"
            })
        }, 5000);
        
        if (huggingfaceResponse.ok) {
            return {
                strategy: huggingfaceResponse.data?.text || 'HF optimization applied',
                confidence: 0.8,
                source: 'huggingface'
            };
        }
    } catch (error) {
        if (!mcpServiceWarned.has('huggingface_err')) {
            mcpServiceWarned.add('huggingface_err');
            gov.log('MCP_WARNING', `HuggingFace unavailable: ${error.message}`);
        }
    }
    
    return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
}

async function getPerplexityOptimization(phase) {
    const endpoint = MCP_SERVICE_ENDPOINTS.perplexity;
    if (!endpoint) {
        if (!mcpServiceWarned.has('perplexity')) {
            mcpServiceWarned.add('perplexity');
            gov.log('MCP_INFO', 'Perplexity MCP not configured - using defaults');
        }
        return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
    }
    
    try {
        const perplexityResponse = await requestJson(`${endpoint}/api/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'sonar',
                messages: [{ role: 'user', content: `Optimize build phase "${phase}" for HeadySystems.` }]
            })
        }, 5000);
        
        if (perplexityResponse.ok) {
            return {
                strategy: perplexityResponse.data?.choices?.[0]?.message?.content || 'Perplexity optimization applied',
                confidence: 0.85,
                source: 'perplexity'
            };
        }
    } catch (error) {
        if (!mcpServiceWarned.has('perplexity_err')) {
            mcpServiceWarned.add('perplexity_err');
            gov.log('MCP_WARNING', `Perplexity unavailable: ${error.message}`);
        }
    }
    
    return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
}

async function getGeminiOptimization(phase) {
    const endpoint = MCP_SERVICE_ENDPOINTS.gemini;
    if (!endpoint) {
        if (!mcpServiceWarned.has('gemini')) {
            mcpServiceWarned.add('gemini');
            gov.log('MCP_INFO', 'Gemini MCP not configured - using defaults');
        }
        return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
    }
    
    try {
        const geminiResponse = await requestJson(`${endpoint}/api/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-2.0-flash',
                messages: [{ role: 'user', content: `Optimize build phase "${phase}" for HeadySystems.` }]
            })
        }, 5000);
        
        if (geminiResponse.ok) {
            return {
                strategy: geminiResponse.data?.choices?.[0]?.message?.content || 'Gemini optimization applied',
                confidence: 0.9,
                source: 'gemini'
            };
        }
    } catch (error) {
        if (!mcpServiceWarned.has('gemini_err')) {
            mcpServiceWarned.add('gemini_err');
            gov.log('MCP_WARNING', `Gemini unavailable: ${error.message}`);
        }
    }
    
    return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
}

async function getYandexOptimization(phase) {
    const endpoint = MCP_SERVICE_ENDPOINTS.yandex;
    if (!endpoint) {
        if (!mcpServiceWarned.has('yandex')) {
            mcpServiceWarned.add('yandex');
            gov.log('MCP_INFO', 'Yandex MCP not configured - using defaults');
        }
        return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
    }
    
    try {
        const yandexResponse = await requestJson(`${endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'yandexgpt-lite',
                prompt: `Optimize build phase "${phase}" for HeadySystems.`
            })
        }, 5000);
        
        if (yandexResponse.ok) {
            return {
                strategy: yandexResponse.data?.text || 'Yandex optimization applied',
                confidence: 0.8,
                source: 'yandex'
            };
        }
    } catch (error) {
        if (!mcpServiceWarned.has('yandex_err')) {
            mcpServiceWarned.add('yandex_err');
            gov.log('MCP_WARNING', `Yandex unavailable: ${error.message}`);
        }
    }
    
    return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
}

async function getJulesOptimization(phase) {
    const endpoint = MCP_SERVICE_ENDPOINTS.jules;
    if (!endpoint) {
        if (!mcpServiceWarned.has('jules')) {
            mcpServiceWarned.add('jules');
            gov.log('MCP_INFO', 'Jules MCP not configured - using defaults');
        }
        return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
    }
    
    try {
        const julesResponse = await requestJson(`${endpoint}/api/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phase: phase,
                context: 'HeadySystems architecture build optimization'
            })
        }, 5000);
        
        if (julesResponse.ok) {
            return {
                strategy: julesResponse.data?.recommendation || 'Jules optimization applied',
                confidence: 0.75,
                source: 'jules'
            };
        }
    } catch (error) {
        if (!mcpServiceWarned.has('jules_err')) {
            mcpServiceWarned.add('jules_err');
            gov.log('MCP_WARNING', `Jules unavailable: ${error.message}`);
        }
    }
    
    return { strategy: 'Default', confidence: 0.5, source: 'fallback' };
}

async function executeBuildPhase(phase, buildTask) {
    const { spawn, execSync } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    
    // Check if we're in a container without Python
    const isContainer = fs.existsSync('/.dockerenv') || process.env.CONTAINER_ROLE;
    const isWindows = process.platform === 'win32';
    
    // Try to find Python
    let pythonExecutable = null;
    const venvPath = isWindows 
        ? path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe')
        : path.join(__dirname, '..', '..', '.venv', 'bin', 'python');
    
    if (fs.existsSync(venvPath)) {
        pythonExecutable = venvPath;
    } else {
        // Try system python
        try {
            const pythonCmd = isWindows ? 'python' : 'python3';
            execSync(`${pythonCmd} --version`, { stdio: 'ignore' });
            pythonExecutable = pythonCmd;
        } catch {
            pythonExecutable = null;
        }
    }
    
    // If no Python available (e.g., in container), return orchestration-only result
    if (!pythonExecutable) {
        gov.log('BUILD_PHASE', `Phase ${phase}: Python not available in container - orchestration complete, execute locally for full build`);
        return {
            success: true,
            phase,
            message: `Phase ${phase} orchestrated (run 'python build-heady-system.py --phase ${phase}' locally for full execution)`,
            orchestration_only: true,
            duration: 0
        };
    }
    
    return new Promise((resolve, reject) => {
        const buildScript = path.join(__dirname, '..', 'build-heady-system.py');
        const args = ['--phase', phase];
        
        if (buildTask.dry_run) args.push('--dry-run');
        if (buildTask.verbose) args.push('--verbose');
        if (buildTask.skip_validation) args.push('--skip-validation');
        
        const pythonProcess = spawn(pythonExecutable, [buildScript, ...args], {
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve({
                    success: true,
                    phase,
                    message: `Phase ${phase} completed successfully`,
                    stdout: stdout.trim(),
                    duration: Date.now() - new Date(buildTask.started_at).getTime()
                });
            } else {
                reject(new Error(`Phase ${phase} failed with code ${code}: ${stderr}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            reject(new Error(`Failed to execute build phase ${phase}: ${error.message}`));
        });
    });
}

app.post('/api/apps/render/deploy', async (req, res) => {
    const body = req.body || {};
    const connectionId = String(body.connection_id || '').trim();
    if (!connectionId) return res.status(400).json({ success: false, error: 'connection_id_required' });

    const state = getConnectionsState();
    const connection = findConnection(state, connectionId);
    if (!connection) return res.status(404).json({ success: false, error: 'connection_not_found' });
    if (connection.type !== 'render') return res.status(400).json({ success: false, error: 'wrong_connection_type' });

    const hookEnv = String(connection.config?.deploy_hook_env || 'RENDER_DEPLOY_HOOK_URL');
    const hookUrl = getEnvSecret(hookEnv);
    if (!hookUrl) return res.status(400).json({ success: false, error: 'missing_env', env: hookEnv });

    const method = String(connection.config?.hook_method || 'POST').toUpperCase();
    const res2 = await fetchWithTimeout(hookUrl, { method: (method === 'GET' ? 'GET' : 'POST') }, 15000);
    const text = await res2.text();
    const ok = res2.ok;
    if (ok) {
        gov.log('INTEGRATION', `Render deploy hook triggered for ${connectionId}`);
    } else {
        gov.log('warning', `Render deploy hook FAILED for ${connectionId} (HTTP ${res2.status})`);
    }
    res.json({ success: ok, status: res2.status, body: truncate(text, 240) });
});

app.get('/api/tasks', (req, res) => res.json(getQueue()));
app.listen(3000, () => console.log('Orchestrator Online'));

setInterval(() => {
    try {
        const state = getVinciState();
        let changed = false;

        const entries = Object.values(state.tasks || {});
        for (const entry of entries) {
            if (!entry?.enabled) continue;
            if (normalizeVinciMode(entry.mode) !== 'CONSTANT') continue;

            const nextAt = entry.next_generate_at ? Date.parse(entry.next_generate_at) : 0;
            if (Number.isFinite(nextAt) && nextAt > Date.now()) continue;

            const variation = generateVinciVariation(entry);
            if (!variation) {
                changed = true;
                continue;
            }

            changed = true;
            gov.log('CREATIVITY', `Vinci[${variation.lens}/${variation.mode}] Task ${entry.task_id}: ${truncate(variation.text, 240)}`);
        }

        if (changed) {
            saveVinciState(state);
        }
    } catch (e) {
        console.error('[VINCI] Error:', e.message);
    }
}, 1500);
