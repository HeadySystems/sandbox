const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data', 'headyweb');
const VECTOR_STORE_PATH = path.join(DATA_DIR, 'vector-workspace.json');
const AUTH_TTL_MS = 1000 * 60 * 60 * 8;

const authTokens = new Map();

function ensureDataStore() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(VECTOR_STORE_PATH)) {
        const seed = {
            vectors: [
                {
                    id: 'welcome-vector',
                    text: 'HeadyWeb vector workspace initialized and ready for semantic operations.',
                    metadata: { source: 'bootstrap', createdBy: 'system' },
                    createdAt: new Date().toISOString()
                }
            ]
        };
        fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(seed, null, 2));
    }
}

function readVectorStore() {
    ensureDataStore();
    try {
        return JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, 'utf8'));
    } catch {
        return { vectors: [] };
    }
}

function writeVectorStore(store) {
    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(store, null, 2));
}

function cosineSimilarityFromTerms(a, b) {
    const tokenize = (text) =>
        String(text)
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);

    const aTokens = tokenize(a);
    const bTokens = tokenize(b);
    const vocab = new Set([...aTokens, ...bTokens]);

    let dot = 0;
    let aNorm = 0;
    let bNorm = 0;

    for (const term of vocab) {
        const aCount = aTokens.filter((token) => token === term).length;
        const bCount = bTokens.filter((token) => token === term).length;
        dot += aCount * bCount;
        aNorm += aCount * aCount;
        bNorm += bCount * bCount;
    }

    if (!aNorm || !bNorm) {
        return 0;
    }

    return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function getUserFromToken(req) {
    const auth = req.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    if (!token) {
        return null;
    }

    const session = authTokens.get(token);
    if (!session) {
        return null;
    }

    if (Date.now() > session.expiresAt) {
        authTokens.delete(token);
        return null;
    }

    return session;
}

function requireAuth(req, res, next) {
    const session = getUserFromToken(req);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = session;
    return next();
}

function safeRepoPath(relativePath) {
    const candidate = path.resolve(REPO_ROOT, relativePath);
    if (!candidate.startsWith(REPO_ROOT)) {
        throw new Error('Path escapes repository root');
    }
    return candidate;
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/remotes', express.static(path.join(REPO_ROOT, 'remotes')));

app.get('/api/health', (_req, res) => {
    const store = readVectorStore();
    res.json({
        service: 'HeadyWeb',
        status: 'healthy',
        version: '3.3.0',
        uptime: process.uptime(),
        vectors: store.vectors.length,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const expectedEmail = process.env.HEADYWEB_DEV_EMAIL || 'founder@headysystems.com';
    const expectedPassword = process.env.HEADYWEB_DEV_PASSWORD || 'heady-dev-password';

    if (email !== expectedEmail || password !== expectedPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const session = {
        email,
        role: 'founder',
        createdAt: Date.now(),
        expiresAt: Date.now() + AUTH_TTL_MS
    };

    authTokens.set(token, session);
    return res.json({ token, expiresAt: new Date(session.expiresAt).toISOString() });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ email: req.user.email, role: req.user.role, expiresAt: new Date(req.user.expiresAt).toISOString() });
});

app.get('/api/workspace/status', requireAuth, (_req, res) => {
    const store = readVectorStore();
    res.json({
        workspace: 'personal-persistent-vector-workspace',
        vectors: store.vectors.length,
        storePath: path.relative(REPO_ROOT, VECTOR_STORE_PATH)
    });
});

app.get('/api/workspace/vectors', requireAuth, (req, res) => {
    const { query = '' } = req.query;
    const store = readVectorStore();

    const ranked = store.vectors
        .map((entry) => ({ ...entry, score: cosineSimilarityFromTerms(query, entry.text) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 25);

    res.json({ query, results: ranked });
});

app.post('/api/workspace/vectors', requireAuth, (req, res) => {
    const { text, metadata = {} } = req.body || {};
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'text is required' });
    }

    const store = readVectorStore();
    const vector = {
        id: `vec-${Date.now()}`,
        text,
        metadata: { ...metadata, createdBy: req.user.email },
        createdAt: new Date().toISOString()
    };

    store.vectors.push(vector);
    writeVectorStore(store);
    return res.status(201).json(vector);
});

app.post('/api/workspace/files/read', requireAuth, (req, res) => {
    const { filePath } = req.body || {};
    if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ error: 'filePath is required' });
    }

    try {
        const absolute = safeRepoPath(filePath);
        const content = fs.readFileSync(absolute, 'utf8');
        return res.json({ filePath, content });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post('/api/workspace/files/write', requireAuth, (req, res) => {
    const { filePath, content } = req.body || {};
    if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ error: 'filePath is required' });
    }
    if (typeof content !== 'string') {
        return res.status(400).json({ error: 'content must be a string' });
    }

    try {
        const absolute = safeRepoPath(filePath);
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, content);
        return res.json({ filePath, bytesWritten: Buffer.byteLength(content) });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post('/api/workspace/chat', requireAuth, (req, res) => {
    const { message = '' } = req.body || {};
    const trimmed = String(message).trim();

    if (!trimmed) {
        return res.status(400).json({ error: 'message is required' });
    }

    if (trimmed.toUpperCase().startsWith('READ ')) {
        const filePath = trimmed.slice(5).trim();
        try {
            const absolute = safeRepoPath(filePath);
            const content = fs.readFileSync(absolute, 'utf8');
            return res.json({
                mode: 'file-read',
                reply: `Loaded ${filePath}`,
                filePath,
                content
            });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    if (trimmed.toUpperCase().startsWith('WRITE ')) {
        const firstBreak = trimmed.indexOf('\n');
        const header = firstBreak > -1 ? trimmed.slice(0, firstBreak) : trimmed;
        const filePath = header.slice(6).trim();
        const content = firstBreak > -1 ? trimmed.slice(firstBreak + 1) : '';

        if (!filePath) {
            return res.status(400).json({ error: 'WRITE command requires a file path' });
        }

        try {
            const absolute = safeRepoPath(filePath);
            fs.mkdirSync(path.dirname(absolute), { recursive: true });
            fs.writeFileSync(absolute, content);
            return res.json({
                mode: 'file-write',
                reply: `Saved ${filePath} (${Buffer.byteLength(content)} bytes).`
            });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    const store = readVectorStore();
    const bestMatch = store.vectors
        .map((entry) => ({ ...entry, score: cosineSimilarityFromTerms(trimmed, entry.text) }))
        .sort((a, b) => b.score - a.score)[0];

    return res.json({
        mode: 'semantic-assist',
        reply: bestMatch
            ? `Top workspace memory (${bestMatch.score.toFixed(3)}): ${bestMatch.text}`
            : 'Workspace is available. Add vectors to improve semantic answers.',
        topMatch: bestMatch || null
    });
});

app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        process.stdout.write(`HeadyWeb running on port ${PORT}\n`);
    });
}

module.exports = { app };
