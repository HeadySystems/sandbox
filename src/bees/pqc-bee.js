'use strict';

/**
 * PQCBee — Post-quantum cryptography key generation and rotation.
 * Implements Kyber-style lattice key schedules with phi-harmonic rotation intervals.
 * Uses Node.js crypto module for actual entropy; PQC algorithm is simulated structurally.
 * © 2026-2026 HeadySystems Inc.
 */

const crypto = require('crypto');

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;
const PHI4 = 6.8541019662;

// Key rotation intervals (ms) — phi-scaled Fibonacci
const ROTATION_INTERVALS = {
  SESSION:   Math.round(PHI3 * 60000),    //  ≈ 4.236 minutes
  DAILY:     Math.round(PHI4 * 3600000),  //  ≈ 24.6 hours
  QUARTERLY: Math.round(PHI2 * 7776000000), // ≈ φ² quarters
};

// Key sizes (bytes) — Fibonacci
const KEY_SIZES = {
  SYMMETRIC:   32,    // 256-bit symmetric (use 32 bytes)
  KYBER_512:   800,   // Kyber-512 public key size (approximate)
  KYBER_768:   1184,  // Kyber-768 public key size
  DILITHIUM2:  1312,  // Dilithium2 signature public key
};

const KEY_STORE_MAX   = 13;   // fib(7) — active key versions
const HEARTBEAT_MS    = Math.round(PHI2 * 1000);    // 2618 ms
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);  // ≈ 0.618

class PQCBee {
  constructor(config = {}) {
    this.id        = config.id ?? `pqc-${Date.now()}`;
    this.algorithm = config.algorithm ?? 'KYBER_768';
    this.rotationPolicy = config.rotationPolicy ?? 'SESSION';

    this._alive        = false;
    this._coherence    = 1.0;
    this._keyStore     = [];      // { id, publicKey, fingerprint, createdAt, expiresAt, active }
    this._activeKeyId  = null;
    this._rotationCount = 0;
    this._heartbeatTimer = null;
    this._rotationTimer  = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._keyStore      = [];
    this._activeKeyId   = null;
    this._rotationCount = 0;
    this._coherence     = 1.0;
    // Generate initial key pair
    const key = await this._generateKeyPair();
    this._keyStore.push(key);
    this._activeKeyId = key.id;
    this._scheduleRotation();
  }

  /**
   * Execute a PQC operation.
   * @param {object} task — { op: 'ROTATE'|'SIGN'|'VERIFY'|'ENCAPSULATE'|'DECAPSULATE'|'GET_PUBLIC', data? }
   */
  async execute(task) {
    if (!this._alive) throw new Error('PQCBee not spawned');
    switch (task.op) {
      case 'ROTATE':       return this._rotate();
      case 'SIGN':         return this._sign(task.data);
      case 'VERIFY':       return this._verify(task.data, task.signature, task.keyId);
      case 'ENCAPSULATE':  return this._encapsulate(task.recipientPublicKey);
      case 'DECAPSULATE':  return this._decapsulate(task.ciphertext);
      case 'GET_PUBLIC':   return this._getPublicKey();
      case 'STATUS':       return this._status();
      default: throw new Error(`Unknown PQC op: ${task.op}`);
    }
  }

  async _generateKeyPair() {
    const keySize = KEY_SIZES[this.algorithm] ?? 1184;
    // In production: call libsodium-wrappers or node-pqclean bindings.
    // Here: generate cryptographically strong random bytes as structural placeholder.
    const publicKey  = crypto.randomBytes(keySize);
    const privateKey = crypto.randomBytes(Math.round(keySize * PSI));  // private key ~ ψ × pubkey size
    const id         = `pqc-${this.algorithm}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const fingerprint = crypto.createHash('sha3-256').update(publicKey).digest('hex').slice(0, 21);
    const expiresAt  = Date.now() + (ROTATION_INTERVALS[this.rotationPolicy] ?? ROTATION_INTERVALS.SESSION);

    return {
      id,
      algorithm: this.algorithm,
      publicKey:  publicKey.toString('base64'),
      privateKeyHash: crypto.createHash('sha3-256').update(privateKey).digest('hex'), // never store raw
      fingerprint,
      createdAt: Date.now(),
      expiresAt,
      active: true,
    };
  }

  async _rotate() {
    // Deactivate current key
    for (const k of this._keyStore) k.active = false;

    const newKey = await this._generateKeyPair();
    this._keyStore.push(newKey);
    this._activeKeyId = newKey.id;
    this._rotationCount++;

    // Prune old key versions beyond KEY_STORE_MAX
    if (this._keyStore.length > KEY_STORE_MAX) {
      this._keyStore = this._keyStore.slice(-KEY_STORE_MAX);
    }

    this._coherence = Math.min(1.0, this._coherence + PSI * 0.05);
    this._scheduleRotation();
    return { rotated: true, newKeyId: newKey.id, fingerprint: newKey.fingerprint, rotationCount: this._rotationCount };
  }

  _sign(data) {
    if (!data) return { error: 'No data to sign' };
    const active = this._keyStore.find(k => k.id === this._activeKeyId);
    if (!active) return { error: 'No active key' };
    // HMAC-SHA3-256 as structural stand-in for Dilithium signature
    const sig = crypto.createHmac('sha256', active.fingerprint)
      .update(typeof data === 'string' ? data : JSON.stringify(data))
      .digest('base64');
    return { signature: sig, keyId: active.id, algorithm: this.algorithm, ts: Date.now() };
  }

  _verify(data, signature, keyId) {
    const key = keyId
      ? this._keyStore.find(k => k.id === keyId)
      : this._keyStore.find(k => k.id === this._activeKeyId);
    if (!key) return { valid: false, reason: 'Key not found' };
    const expected = crypto.createHmac('sha256', key.fingerprint)
      .update(typeof data === 'string' ? data : JSON.stringify(data))
      .digest('base64');
    const valid = crypto.timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(signature, 'base64'));
    return { valid, keyId: key.id };
  }

  _encapsulate(recipientPublicKey) {
    // KEM encapsulation: generate shared secret + ciphertext
    const sharedSecret = crypto.randomBytes(32);
    const ciphertext   = crypto.randomBytes(Math.round(KEY_SIZES[this.algorithm] * (1 - PSI)));
    const encSharedSecret = crypto.createHmac('sha256', recipientPublicKey ?? 'default')
      .update(sharedSecret).digest('base64');
    return { ciphertext: ciphertext.toString('base64'), encSharedSecret, algorithm: this.algorithm };
  }

  _decapsulate(ciphertext) {
    if (!ciphertext) return { error: 'No ciphertext' };
    // Placeholder: derive shared secret deterministically
    const active = this._keyStore.find(k => k.id === this._activeKeyId);
    const sharedSecret = crypto.createHmac('sha256', active?.fingerprint ?? '')
      .update(Buffer.from(ciphertext, 'base64'))
      .digest('base64');
    return { sharedSecret, keyId: this._activeKeyId };
  }

  _getPublicKey() {
    const active = this._keyStore.find(k => k.id === this._activeKeyId);
    return active
      ? { publicKey: active.publicKey, fingerprint: active.fingerprint, algorithm: active.algorithm, expiresAt: active.expiresAt }
      : { error: 'No active key' };
  }

  _status() {
    const active = this._keyStore.find(k => k.id === this._activeKeyId);
    return {
      activeKeyId:    this._activeKeyId,
      fingerprint:    active?.fingerprint,
      expiresAt:      active?.expiresAt,
      rotationCount:  this._rotationCount,
      keyStoreDepth:  this._keyStore.length,
      algorithm:      this.algorithm,
    };
  }

  _scheduleRotation() {
    if (this._rotationTimer) clearTimeout(this._rotationTimer);
    const interval = ROTATION_INTERVALS[this.rotationPolicy];
    this._rotationTimer = setTimeout(() => this._rotate(), interval);
  }

  heartbeat() {
    const active = this._keyStore.find(k => k.id === this._activeKeyId);
    if (active && Date.now() > active.expiresAt) {
      this._rotate();
      this._coherence = Math.max(0, this._coherence - PSI * 0.1);
    } else {
      this._coherence = Math.min(1.0, this._coherence + PSI * 0.005);
    }
  }

  getHealth() {
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence:     parseFloat(this._coherence.toFixed(4)),
      algorithm:     this.algorithm,
      rotationPolicy: this.rotationPolicy,
      rotationCount: this._rotationCount,
      keyStoreDepth: this._keyStore.length,
      activeKeyId:   this._activeKeyId,
      rotationIntervals: ROTATION_INTERVALS,
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    if (this._rotationTimer)  clearTimeout(this._rotationTimer);
    // Zeroize active key references
    this._keyStore = [];
    this._activeKeyId = null;
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = { PQCBee, ROTATION_INTERVALS, KEY_SIZES, KEY_STORE_MAX, COHERENCE_THRESHOLD };
