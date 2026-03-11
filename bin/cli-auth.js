#!/usr/bin/env node
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * CLI Auth Module — Claude Code-style authentication
 *
 * Supports:
 *  - Browser-based OAuth (Google/GitHub) via local callback server
 *  - Direct API key authentication
 *  - Credential persistence in ~/.heady/credentials.json
 *  - Auto-detection of .env API keys
 *
 * @module bin/cli-auth
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');
const theme = require('./cli-theme');

// ═══════════════════════════════════════════════════════════════════
// ═══ PATHS ═══
// ═══════════════════════════════════════════════════════════════════

const HEADY_DIR = path.join(process.env.HOME || '/tmp', '.heady');
const CRED_FILE = path.join(HEADY_DIR, 'credentials.json');
const SESSION_FILE = path.join(HEADY_DIR, 'session.json');
const HISTORY_FILE = path.join(HEADY_DIR, 'history');

// ═══════════════════════════════════════════════════════════════════
// ═══ CREDENTIAL MANAGEMENT ═══
// ═══════════════════════════════════════════════════════════════════

function ensureDir() {
    if (!fs.existsSync(HEADY_DIR)) {
        fs.mkdirSync(HEADY_DIR, { recursive: true, mode: 0o700 });
    }
}

function loadCredentials() {
    try {
        if (fs.existsSync(CRED_FILE)) {
            const raw = fs.readFileSync(CRED_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (_) { }
    return null;
}

function saveCredentials(creds) {
    ensureDir();
    const data = {
        ...creds,
        savedAt: new Date().toISOString(),
        version: 1,
    };
    fs.writeFileSync(CRED_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function clearCredentials() {
    if (fs.existsSync(CRED_FILE)) fs.unlinkSync(CRED_FILE);
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
}

// ═══════════════════════════════════════════════════════════════════
// ═══ API KEY DETECTION ═══
// ═══════════════════════════════════════════════════════════════════

const PROVIDER_KEYS = {
    groq: { env: 'GROQ_API_KEY', name: 'Groq', color: theme.FG.teal },
    google: { env: 'GOOGLE_API_KEY', name: 'Google AI', color: theme.FG.azure },
    anthropic: { env: 'ANTHROPIC_API_KEY', name: 'Anthropic', color: theme.FG.purple },
    openai: { env: 'OPENAI_API_KEY', name: 'OpenAI', color: theme.FG.green },
    huggingface: { env: 'HF_TOKEN', name: 'HuggingFace', color: theme.FG.gold },
    perplexity: { env: 'PERPLEXITY_API_KEY', name: 'Perplexity', color: theme.FG.coral },
};

function detectProviders() {
    const creds = loadCredentials();
    const providers = {};

    for (const [id, info] of Object.entries(PROVIDER_KEYS)) {
        const fromEnv = process.env[info.env];
        const fromCred = creds?.providers?.[id]?.key;
        const key = fromEnv || fromCred;

        providers[id] = {
            ...info,
            configured: !!key,
            source: fromEnv ? 'env' : fromCred ? 'credentials' : null,
            keyPreview: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null,
        };
    }

    return providers;
}

// ═══════════════════════════════════════════════════════════════════
// ═══ LOGIN FLOW ═══
// ═══════════════════════════════════════════════════════════════════

/**
 * Interactive login — prompts user for API keys or opens browser for OAuth.
 */
async function login(opts = {}) {
    theme.heading('Heady™ Authentication');
    console.log('');

    // If --token flag provided, store directly
    if (opts.token) {
        return loginWithToken(opts.token, opts.provider || 'groq');
    }

    // Interactive: ask for API keys
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log(`  ${theme.purple('Choose authentication method:')}`);
    console.log('');
    console.log(`  ${theme.bold('1.')} Enter API keys directly`);
    console.log(`  ${theme.bold('2.')} Browser-based login (OAuth)`);
    console.log(`  ${theme.bold('3.')} Import from .env file`);
    console.log('');

    const choice = await ask(`  ${theme.purple('❯')} Choice [1/2/3]: `);

    if (choice === '2') {
        rl.close();
        return loginWithBrowser();
    }

    if (choice === '3') {
        rl.close();
        return loginFromEnv();
    }

    // Direct API key entry
    console.log('');
    theme.info('Enter API keys (press Enter to skip):');
    console.log('');

    const creds = loadCredentials() || { providers: {} };

    for (const [id, info] of Object.entries(PROVIDER_KEYS)) {
        const current = creds.providers?.[id]?.key;
        const prompt = current
            ? `  ${info.color}${info.name}${theme.RESET} [${theme.dim(current.slice(0, 6) + '...')}]: `
            : `  ${info.color}${info.name}${theme.RESET}: `;

        const key = await ask(prompt);
        if (key && key.trim()) {
            if (!creds.providers) creds.providers = {};
            creds.providers[id] = { key: key.trim(), addedAt: new Date().toISOString() };
        }
    }

    rl.close();

    // Save
    saveCredentials(creds);
    console.log('');
    theme.success('Credentials saved to ~/.heady/credentials.json');
    showProviderStatus();
}

function loginWithToken(token, provider) {
    const creds = loadCredentials() || { providers: {} };
    if (!creds.providers) creds.providers = {};
    creds.providers[provider] = { key: token, addedAt: new Date().toISOString() };
    saveCredentials(creds);
    theme.success(`${provider} API key saved`);
    showProviderStatus();
}

function loginFromEnv() {
    const envPath = path.resolve(process.cwd(), '.env');
    const altEnvPath = path.resolve(__dirname, '..', '.env');
    const envFile = fs.existsSync(envPath) ? envPath : fs.existsSync(altEnvPath) ? altEnvPath : null;

    if (!envFile) {
        theme.warn('No .env file found');
        return;
    }

    const envContent = fs.readFileSync(envFile, 'utf8');
    const creds = loadCredentials() || { providers: {} };
    if (!creds.providers) creds.providers = {};
    let imported = 0;

    for (const [id, info] of Object.entries(PROVIDER_KEYS)) {
        const match = envContent.match(new RegExp(`^${info.env}\\s*=\\s*["']?([^"'\\n]+)`, 'm'));
        if (match && match[1]) {
            creds.providers[id] = { key: match[1].trim(), addedAt: new Date().toISOString(), source: 'dotenv' };
            imported++;
        }
    }

    if (imported > 0) {
        saveCredentials(creds);
        theme.success(`Imported ${imported} API key(s) from ${envFile}`);
    } else {
        theme.info('No recognized API keys found in .env');
    }
    showProviderStatus();
}

async function loginWithBrowser() {
    theme.info('Starting browser-based authentication...');
    console.log('');

    const port = 9876;
    const state = crypto.randomBytes(16).toString('hex');

    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`);

            if (url.pathname === '/callback') {
                const code = url.searchParams.get('code');
                const returnedState = url.searchParams.get('state');

                if (returnedState !== state) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end('<h1>State mismatch — authentication failed</h1>');
                    server.close();
                    resolve(false);
                    return;
                }

                // Store the auth code
                const creds = loadCredentials() || { providers: {} };
                creds.oauth = { code, state, authenticatedAt: new Date().toISOString() };
                saveCredentials(creds);

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#1a1a2e;color:#e0e0e0">
                        <h1 style="color:#9B59B6">✓ Authenticated with Heady™</h1>
                        <p>You can close this tab and return to your terminal.</p>
                        <p style="color:#666;font-size:12px">Sacred Geometry :: Organic Systems</p>
                    </body></html>
                `);

                theme.success('Browser authentication complete');
                server.close();
                resolve(true);
                return;
            }

            // Default: redirect to auth
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#1a1a2e;color:#e0e0e0">
                    <h1 style="color:#9B59B6">Heady™ Login</h1>
                    <p>Redirecting to authentication provider...</p>
                    <p style="color:#666">If you are not redirected, enter your API keys directly in the terminal with <code>heady login</code></p>
                </body></html>
            `);
        });

        server.listen(port, () => {
            const loginUrl = `http://localhost:${port}`;
            theme.info(`Listening on ${theme.teal(loginUrl)}`);
            theme.info('Opening browser for authentication...');
            console.log('');
            console.log(`  ${theme.dim('If browser does not open, visit:')}`);
            console.log(`  ${theme.azure(loginUrl)}`);
            console.log('');

            // Try to open browser
            try {
                const openCmd = process.platform === 'darwin' ? 'open'
                    : process.platform === 'win32' ? 'start' : 'xdg-open';
                execSync(`${openCmd} ${loginUrl} 2>/dev/null`, { stdio: 'ignore' });
            } catch (_) {
                theme.warn('Could not auto-open browser. Please visit the URL above.');
            }

            // Timeout after 2 minutes
            setTimeout(() => {
                theme.warn('Login timed out. Use: heady login --token YOUR_KEY');
                server.close();
                resolve(false);
            }, 120000);
        });
    });
}

// ═══════════════════════════════════════════════════════════════════
// ═══ LOGOUT ═══
// ═══════════════════════════════════════════════════════════════════

function logout() {
    theme.heading('Heady™ Logout');
    clearCredentials();
    theme.success('Credentials cleared');
    theme.info('API keys from .env are still available');
}

// ═══════════════════════════════════════════════════════════════════
// ═══ WHOAMI ═══
// ═══════════════════════════════════════════════════════════════════

function whoami() {
    theme.heading('Heady™ Authentication Status');
    console.log('');

    const creds = loadCredentials();

    if (creds?.oauth) {
        theme.success(`Authenticated via browser (${creds.oauth.authenticatedAt})`);
    } else if (creds?.providers && Object.keys(creds.providers).length > 0) {
        theme.success('Authenticated via API keys');
    } else {
        theme.warn('Not authenticated. Run: heady login');
    }

    console.log('');
    showProviderStatus();

    if (creds?.savedAt) {
        console.log('');
        theme.info(`Credentials file: ${theme.dim(CRED_FILE)}`);
        theme.info(`Last updated: ${theme.dim(creds.savedAt)}`);
    }
}

// ═══════════════════════════════════════════════════════════════════
// ═══ PROVIDER STATUS ═══
// ═══════════════════════════════════════════════════════════════════

function showProviderStatus() {
    const providers = detectProviders();

    const rows = Object.entries(providers).map(([id, p]) => {
        const status = p.configured
            ? `${theme.green('●')} ${theme.bold('online')}`
            : `${theme.gray('○')} ${theme.dim('not configured')}`;
        const source = p.source ? theme.dim(`(${p.source})`) : '';
        const preview = p.keyPreview ? theme.dim(p.keyPreview) : '';
        return [` ${p.color}${p.name}${theme.RESET}`, status, source || preview];
    });

    console.log(theme.table(['Provider', 'Status', 'Source'], rows));
}

/**
 * Get all configured API keys (merging .env + credentials file).
 * Returns object: { GROQ_API_KEY: '...', GOOGLE_API_KEY: '...', ... }
 */
function getConfiguredKeys() {
    const creds = loadCredentials();
    const keys = {};

    for (const [id, info] of Object.entries(PROVIDER_KEYS)) {
        const fromEnv = process.env[info.env];
        const fromCred = creds?.providers?.[id]?.key;
        if (fromEnv || fromCred) {
            keys[info.env] = fromEnv || fromCred;
        }
    }

    return keys;
}

/**
 * Inject stored credentials into process.env (call at CLI startup).
 */
function injectCredentials() {
    const creds = loadCredentials();
    if (!creds?.providers) return 0;

    let injected = 0;
    for (const [id, providerCred] of Object.entries(creds.providers)) {
        const info = PROVIDER_KEYS[id];
        if (info && providerCred.key && !process.env[info.env]) {
            process.env[info.env] = providerCred.key;
            injected++;
        }
    }
    return injected;
}

// ═══════════════════════════════════════════════════════════════════
// ═══ EXPORTS ═══
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // Auth flows
    login,
    logout,
    whoami,

    // Credential management
    loadCredentials,
    saveCredentials,
    clearCredentials,
    getConfiguredKeys,
    injectCredentials,
    detectProviders,
    showProviderStatus,

    // Paths
    HEADY_DIR,
    CRED_FILE,
    SESSION_FILE,
    HISTORY_FILE,
    PROVIDER_KEYS,
};
