const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const {
    resolveWorkspacePath,
    readWorkspace,
    upsertSession
} = require('./workspace-store');
const {
    resolveIdeRoot,
    listFiles,
    readFile,
    writeFile
} = require('./ide-service');

const PORT = Number(process.env.HEADYWEB_PORT || 3791);
const AUTH_SERVICE_URL = process.env.HEADY_AUTH_URL || 'https://auth.headysystems.com';
const VECTOR_SERVICE_URL = process.env.HEADY_VECTOR_URL || 'https://headyos.com';
const IDE_ROOT = resolveIdeRoot(process.env);
const WORKSPACE_FILE = resolveWorkspacePath(process.env);
const PUBLIC_DIR = path.resolve(__dirname, 'public');

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

async function parseJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStatic(res, pathname) {
    const fileName = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const fullPath = path.resolve(PUBLIC_DIR, fileName);
    if (!fullPath.startsWith(PUBLIC_DIR)) {
        sendJson(res, 403, { ok: false, error: 'forbidden' });
        return;
    }
    const content = await fs.readFile(fullPath, 'utf8');
    const contentType = fullPath.endsWith('.js')
        ? 'application/javascript; charset=utf-8'
        : 'text/html; charset=utf-8';
    res.writeHead(200, { 'content-type': contentType });
    res.end(content);
}

async function handleAuthVerify(req, res) {
    const token = req.headers.authorization || '';
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/verify`, {
        method: 'GET',
        headers: { Authorization: token }
    });
    const payload = await response.json();
    sendJson(res, response.ok ? 200 : 401, payload);
}

async function handleChat(req, res) {
    const body = await parseJsonBody(req);
    const { sessionId = 'default', message = '' } = body;
    const workspace = await readWorkspace(WORKSPACE_FILE);
    const session = workspace.sessions[sessionId] || { sessionId, chat: [], vectorNotes: [], files: [] };
    const answer = `HeadyWeb response: ${message}`;

    session.chat = [...session.chat, { role: 'user', content: message }, { role: 'assistant', content: answer }];
    session.vectorNotes = [...session.vectorNotes, { at: new Date().toISOString(), embeddingSource: message.slice(0, 160) }];
    await upsertSession(WORKSPACE_FILE, sessionId, session);

    sendJson(res, 200, {
        ok: true,
        sessionId,
        answer,
        vectorWorkspace: {
            provider: VECTOR_SERVICE_URL,
            notes: session.vectorNotes.length
        }
    });
}

async function handleWorkspaceGet(req, res, url) {
    const sessionId = url.searchParams.get('sessionId') || 'default';
    const workspace = await readWorkspace(WORKSPACE_FILE);
    const session = workspace.sessions[sessionId] || { sessionId, chat: [], files: [], vectorNotes: [] };
    sendJson(res, 200, { ok: true, session, updatedAt: workspace.updatedAt });
}

async function handleIdeList(req, res, url) {
    const dir = url.searchParams.get('dir') || '.';
    const files = await listFiles(IDE_ROOT, dir);
    sendJson(res, 200, { ok: true, root: IDE_ROOT, dir, files });
}

async function handleIdeRead(req, res, url) {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
        sendJson(res, 400, { ok: false, error: 'path is required' });
        return;
    }
    const content = await readFile(IDE_ROOT, filePath);
    sendJson(res, 200, { ok: true, path: filePath, content });
}

async function handleIdeWrite(req, res) {
    const body = await parseJsonBody(req);
    const { path: filePath, content = '' } = body;
    if (!filePath) {
        sendJson(res, 400, { ok: false, error: 'path is required' });
        return;
    }
    const result = await writeFile(IDE_ROOT, filePath, content);
    sendJson(res, 200, { ok: true, ...result });
}

async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, {
            ok: true,
            service: 'headyweb',
            authService: AUTH_SERVICE_URL,
            vectorService: VECTOR_SERVICE_URL,
            ideRoot: IDE_ROOT
        });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/verify') return handleAuthVerify(req, res);
    if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res);
    if (req.method === 'GET' && url.pathname === '/api/workspace') return handleWorkspaceGet(req, res, url);
    if (req.method === 'GET' && url.pathname === '/api/ide/list') return handleIdeList(req, res, url);
    if (req.method === 'GET' && url.pathname === '/api/ide/read') return handleIdeRead(req, res, url);
    if (req.method === 'POST' && url.pathname === '/api/ide/write') return handleIdeWrite(req, res);

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/app.js')) {
        return serveStatic(res, url.pathname);
    }

    sendJson(res, 404, { ok: false, error: 'not found' });
}

function startServer() {
    const server = http.createServer((req, res) => {
        handleRequest(req, res).catch((error) => {
            sendJson(res, 500, { ok: false, error: error.message });
        });
    });

    server.listen(PORT, () => {
        process.stdout.write(`HeadyWeb listening on ${PORT}\n`);
    });

    return server;
}

if (require.main === module) {
    startServer();
}

module.exports = { startServer };
