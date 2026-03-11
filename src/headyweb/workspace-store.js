const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_FILE_NAME = 'headyweb-workspace.json';

function resolveWorkspacePath(env = process.env) {
    const dataDir = env.HEADY_DATA_DIR || path.resolve(process.cwd(), 'data');
    return path.resolve(dataDir, DEFAULT_FILE_NAME);
}

async function ensureWorkspaceFile(filePath) {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });

    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, JSON.stringify({ sessions: {}, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    }
}

async function readWorkspace(filePath) {
    await ensureWorkspaceFile(filePath);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function writeWorkspace(filePath, workspace) {
    const next = { ...workspace, updatedAt: new Date().toISOString() };
    await fs.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
    return next;
}

async function upsertSession(filePath, sessionId, patch) {
    const workspace = await readWorkspace(filePath);
    const session = workspace.sessions[sessionId] || { sessionId, chat: [], files: [], vectorNotes: [] };
    workspace.sessions[sessionId] = {
        ...session,
        ...patch,
        sessionId,
        modifiedAt: new Date().toISOString()
    };
    return writeWorkspace(filePath, workspace);
}

module.exports = {
    resolveWorkspacePath,
    ensureWorkspaceFile,
    readWorkspace,
    writeWorkspace,
    upsertSession
};
