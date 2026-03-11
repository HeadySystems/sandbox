/**
 * Ed25519 Receipt Signer — Cryptographic Trust Receipts
 * ======================================================
 * FIX FOR: Finding #7 — Ed25519 receipt signing was not implemented.
 * MASTER_DIRECTIVES Stage 20 (RECEIPT) mandates: "Receipt signed with Ed25519"
 *
 * This module provides:
 *  - Ed25519 keypair generation
 *  - Receipt signing with Ed25519
 *  - Receipt verification
 *  - Key rotation with backward-compatible verification
 *
 * Uses Node.js built-in crypto module (Ed25519 supported since Node 15+).
 *
 * @module src/crypto/ed25519-receipt-signer
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const crypto = require('crypto');
const { fib } = require('../../shared/phi-math');

// ── Key Management ──────────────────────────────────────────────────────────

/**
 * Generate a new Ed25519 keypair for receipt signing.
 * @returns {{ publicKey: string, privateKey: string, keyId: string, createdAt: string }}
 */
function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return {
    publicKey,
    privateKey,
    keyId: `heady-receipt-key-${crypto.randomUUID().substring(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

// ── Receipt Signing ─────────────────────────────────────────────────────────

/**
 * Sign a pipeline receipt with Ed25519.
 *
 * @param {object} receiptData - The receipt to sign (must be serializable)
 * @param {string} privateKeyPem - PEM-encoded Ed25519 private key
 * @param {string} keyId - Key identifier for verification routing
 * @returns {object} Signed receipt with signature and metadata
 */
function signReceipt(receiptData, privateKeyPem, keyId = 'default') {
  if (!receiptData) throw new Error('Receipt data is required');
  if (!privateKeyPem) throw new Error('Private key is required');

  // Canonicalize the receipt data (deterministic JSON serialization)
  const canonical = canonicalize(receiptData);
  const dataBuffer = Buffer.from(canonical, 'utf8');

  // Sign with Ed25519
  const signature = crypto.sign(null, dataBuffer, {
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8',
  });

  const signatureHex = signature.toString('hex');
  const signedAt = new Date().toISOString();

  return {
    // Original receipt data
    receipt: receiptData,
    // Cryptographic proof
    signature: {
      algorithm: 'Ed25519',
      value: signatureHex,
      keyId,
      signedAt,
      canonicalHash: crypto.createHash('sha256').update(dataBuffer).digest('hex'),
    },
    // Verification metadata
    verification: {
      algorithm: 'Ed25519',
      keyId,
      dataEncoding: 'canonical-json-utf8',
      signatureEncoding: 'hex',
    },
  };
}

/**
 * Verify a signed receipt's Ed25519 signature.
 *
 * @param {object} signedReceipt - The full signed receipt object
 * @param {string} publicKeyPem - PEM-encoded Ed25519 public key
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyReceipt(signedReceipt, publicKeyPem) {
  if (!signedReceipt?.receipt || !signedReceipt?.signature?.value) {
    return { valid: false, reason: 'Missing receipt or signature' };
  }
  if (!publicKeyPem) {
    return { valid: false, reason: 'Missing public key' };
  }

  try {
    // Reconstruct canonical data
    const canonical = canonicalize(signedReceipt.receipt);
    const dataBuffer = Buffer.from(canonical, 'utf8');
    const signatureBuffer = Buffer.from(signedReceipt.signature.value, 'hex');

    // Verify hash integrity
    const computedHash = crypto.createHash('sha256').update(dataBuffer).digest('hex');
    if (signedReceipt.signature.canonicalHash &&
        computedHash !== signedReceipt.signature.canonicalHash) {
      return { valid: false, reason: 'Canonical hash mismatch — data tampered' };
    }

    // Verify Ed25519 signature
    const isValid = crypto.verify(null, dataBuffer, {
      key: publicKeyPem,
      format: 'pem',
      type: 'spki',
    }, signatureBuffer);

    return isValid
      ? { valid: true }
      : { valid: false, reason: 'Ed25519 signature verification failed' };
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` };
  }
}

// ── Key Rotation ────────────────────────────────────────────────────────────

/**
 * Key rotation manager — keeps historical public keys for verification.
 */
class KeyRotationManager {
  constructor() {
    this.currentKey = null;
    this.historicalKeys = new Map(); // keyId → publicKey
    this.rotationHistory = [];
    this.maxHistoricalKeys = fib(8); // 21 — keep last 21 keys
  }

  /**
   * Initialize with a new keypair.
   */
  initialize() {
    const keypair = generateKeypair();
    this.currentKey = keypair;
    this.historicalKeys.set(keypair.keyId, keypair.publicKey);
    return keypair;
  }

  /**
   * Rotate to a new keypair. Old key remains for verification.
   */
  rotate() {
    const oldKey = this.currentKey;
    const newKey = generateKeypair();

    this.currentKey = newKey;
    this.historicalKeys.set(newKey.keyId, newKey.publicKey);

    // Prune old keys beyond max
    if (this.historicalKeys.size > this.maxHistoricalKeys) {
      const keys = [...this.historicalKeys.keys()];
      const toRemove = keys.slice(0, keys.length - this.maxHistoricalKeys);
      toRemove.forEach(k => this.historicalKeys.delete(k));
    }

    this.rotationHistory.push({
      oldKeyId: oldKey?.keyId,
      newKeyId: newKey.keyId,
      rotatedAt: new Date().toISOString(),
    });

    return newKey;
  }

  /**
   * Sign a receipt using the current key.
   */
  sign(receiptData) {
    if (!this.currentKey) {
      this.initialize();
    }
    return signReceipt(receiptData, this.currentKey.privateKey, this.currentKey.keyId);
  }

  /**
   * Verify a receipt, auto-selecting the correct public key.
   */
  verify(signedReceipt) {
    const keyId = signedReceipt?.signature?.keyId;
    if (!keyId) return { valid: false, reason: 'No keyId in signature' };

    const publicKey = this.historicalKeys.get(keyId);
    if (!publicKey) return { valid: false, reason: `Unknown keyId: ${keyId}` };

    return verifyReceipt(signedReceipt, publicKey);
  }
}

// ── Canonical JSON ──────────────────────────────────────────────────────────

/**
 * Deterministic JSON serialization (keys sorted, no whitespace variation).
 */
function canonicalize(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

// Deep sort for nested objects
function deepCanonical(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepCanonical);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = deepCanonical(obj[key]);
  }
  return sorted;
}

module.exports = {
  generateKeypair,
  signReceipt,
  verifyReceipt,
  KeyRotationManager,
  canonicalize,
};
