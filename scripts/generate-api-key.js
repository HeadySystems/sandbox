#!/usr/bin/env node
/**
 * Heady™ API Key Generator
 * Generates secure API keys for buddy distribution.
 *
 * Usage:
 *   node scripts/generate-api-key.js [name]
 *   node scripts/generate-api-key.js --list
 *   node scripts/generate-api-key.js --revoke <key-prefix>
 *
 * ⚡ Made with 💜 by Heady™Systems™
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_FILE = path.join(__dirname, '..', 'configs', 'api-keys.json');
const PHI = 1.618033988749895;

// ─── Helpers ──────────────────────────────────────────────────────

function loadKeys() {
    if (!fs.existsSync(KEYS_FILE)) return { keys: [], meta: { created: new Date().toISOString(), version: '1.0.0' } };
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
}

function saveKeys(data) {
    const dir = path.dirname(KEYS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

function generateKey() {
    const prefix = 'hdy';
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_${timestamp}_${random}`;
}

function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

// ─── Commands ─────────────────────────────────────────────────────

function createKey(name = 'buddy') {
    const data = loadKeys();
    const key = generateKey();
    const entry = {
        name,
        prefix: key.slice(0, 12) + '...',
        hash: hashKey(key),
        tier: 'professional',
        permissions: ['chat', 'explain', 'refactor', 'battle', 'swarm', 'audit', 'simulate', 'memory'],
        rateLimit: { requests: 1000, windowMs: 3600000 },
        created: new Date().toISOString(),
        active: true,
    };
    data.keys.push(entry);
    saveKeys(data);

    console.log(`
╔═══════════════════════════════════════════════════════╗
║  🔑 Heady™ API Key Generated                         ║
╚═══════════════════════════════════════════════════════╝

  Name:        ${name}
  Key:         ${key}
  Tier:        Professional
  Rate Limit:  1000 req/hr
  Permissions: ${entry.permissions.join(', ')}

  ⚠️  Save this key — it won't be shown again!
  
  Your buddy configures it in VS Code:
    Settings → Extensions → Heady™ AI → API Key → paste key

  Or in code:
    const client = new HeadyClient('${key}');
`);
    return key;
}

function listKeys() {
    const data = loadKeys();
    if (data.keys.length === 0) {
        console.log('  No API keys found. Run: node scripts/generate-api-key.js <name>');
        return;
    }
    console.log(`\n  🔑 Heady™ API Keys (${data.keys.length} total)\n`);
    console.log('  ' + '─'.repeat(60));
    for (const k of data.keys) {
        const status = k.active ? '✓ active' : '✗ revoked';
        console.log(`  ${k.prefix}  │ ${k.name.padEnd(15)} │ ${k.tier.padEnd(12)} │ ${status}`);
    }
    console.log('  ' + '─'.repeat(60));
}

function revokeKey(prefix) {
    const data = loadKeys();
    const key = data.keys.find(k => k.prefix.startsWith(prefix) || k.hash.startsWith(prefix));
    if (!key) {
        console.log(`  ✗ No key found matching: ${prefix}`);
        return;
    }
    key.active = false;
    key.revokedAt = new Date().toISOString();
    saveKeys(data);
    console.log(`  ✓ Key revoked: ${key.prefix} (${key.name})`);
}

// ─── Entry ────────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

if (cmd === '--list' || cmd === 'list') {
    listKeys();
} else if (cmd === '--revoke' || cmd === 'revoke') {
    revokeKey(args[0] || '');
} else if (cmd === '--help' || cmd === 'help') {
    console.log(`
  Usage:
    node scripts/generate-api-key.js [name]       Generate a key for buddy
    node scripts/generate-api-key.js --list        List all keys
    node scripts/generate-api-key.js --revoke <p>  Revoke a key by prefix
  `);
} else {
    createKey(cmd || 'buddy');
}
