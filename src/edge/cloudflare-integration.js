/**
 * ∞ Heady™ Cloudflare Integration — Workers, Tunnels, KV, DNS, Zero Trust
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

'use strict';

const EventEmitter = require('events');

// ─────────────────────────────────────────────
// Base API Client
// ─────────────────────────────────────────────

/**
 * Minimal Cloudflare API v4 client.
 * All requests use Bearer token auth.
 */
class CloudflareClient {
  /**
   * @param {object} config
   * @param {string} config.apiToken    Cloudflare API token (scoped)
   * @param {string} [config.accountId] Account ID for account-scoped endpoints
   * @param {string} [config.baseUrl]   Override API base URL
   * @param {number} [config.timeoutMs] Request timeout in ms
   */
  constructor(config) {
    if (!config.apiToken) throw new Error('CloudflareClient: apiToken is required');
    this.apiToken  = config.apiToken;
    this.accountId = config.accountId ?? null;
    this.baseUrl   = config.baseUrl   ?? 'https://api.cloudflare.com/client/v4';
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  /**
   * Execute a Cloudflare API request.
   * @param {string} method
   * @param {string} path
   * @param {object} [body]
   * @returns {Promise<object>} The `result` field of the Cloudflare response
   */
  async request(method, path, body = null) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs);

    const opts = {
      method,
      headers: {
        Authorization:  `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };
    if (body !== null) opts.body = JSON.stringify(body);

    try {
      const res  = await fetch(`${this.baseUrl}${path}`, opts);
      const json = await res.json();
      if (!json.success) {
        const msgs = (json.errors ?? []).map(e => `${e.code}: ${e.message}`).join('; ');
        throw Object.assign(new Error(`Cloudflare API error — ${msgs}`), {
          cfErrors: json.errors,
          status:   res.status,
        });
      }
      return json.result;
    } finally {
      clearTimeout(timer);
    }
  }

  get(path)              { return this.request('GET',    path); }
  post(path, body)       { return this.request('POST',   path, body); }
  put(path, body)        { return this.request('PUT',    path, body); }
  patch(path, body)      { return this.request('PATCH',  path, body); }
  delete(path)           { return this.request('DELETE', path); }
}

// ─────────────────────────────────────────────
// Tunnel Manager
// ─────────────────────────────────────────────

/**
 * Manages Cloudflare Tunnels (Argo/WARP tunnels) for secure ingress.
 * Tunnels expose localhost services to the internet without public IPs.
 */
class TunnelManager extends EventEmitter {
  /**
   * @param {CloudflareClient} client
   */
  constructor(client) {
    super();
    this.client    = client;
    this.accountId = client.accountId;
    /** @type {Map<string, object>} tunnelId → tunnel info */
    this._tunnels  = new Map();
  }

  /**
   * Create a new Cloudflare Tunnel.
   * @param {object} opts
   * @param {string} opts.name          Tunnel name (must be unique per account)
   * @param {string} [opts.secret]      32-byte hex secret (auto-generated if absent)
   * @returns {Promise<object>}  Tunnel record
   */
  async create(opts) {
    const secret = opts.secret ?? _randomHex(32);
    const result = await this.client.post(
      `/accounts/${this.accountId}/cfd_tunnel`,
      { name: opts.name, tunnel_secret: secret }
    );
    this._tunnels.set(result.id, result);
    this.emit('tunnel_created', result);
    return result;
  }

  /**
   * Get or refresh tunnel info by ID.
   * @param {string} tunnelId
   * @returns {Promise<object>}
   */
  async get(tunnelId) {
    const result = await this.client.get(
      `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}`
    );
    this._tunnels.set(result.id, result);
    return result;
  }

  /**
   * List all tunnels for the account.
   * @param {object} [filter]
   * @param {string} [filter.name]    Filter by name substring
   * @param {string} [filter.status]  Filter by status ('healthy' | 'degraded' | 'inactive')
   * @returns {Promise<object[]>}
   */
  async list(filter = {}) {
    const params = new URLSearchParams();
    if (filter.name)   params.set('name',        filter.name);
    if (filter.status) params.set('is_deleted',   'false');
    const qs   = params.toString() ? `?${params}` : '';
    const list = await this.client.get(`/accounts/${this.accountId}/cfd_tunnel${qs}`);
    return Array.isArray(list) ? list : [];
  }

  /**
   * Configure tunnel ingress rules (maps hostnames to local services).
   * @param {string} tunnelId
   * @param {Array<{hostname: string, service: string, originRequest?: object}>} rules
   * @returns {Promise<object>}
   */
  async configure(tunnelId, rules) {
    const config = {
      config: {
        ingress: [
          ...rules,
          { service: 'http_status:404' }, // catch-all
        ],
      },
    };
    const result = await this.client.put(
      `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/configurations`,
      config
    );
    this.emit('tunnel_configured', { tunnelId, rules });
    return result;
  }

  /**
   * Delete a tunnel.
   * @param {string} tunnelId
   */
  async delete(tunnelId) {
    await this.client.delete(`/accounts/${this.accountId}/cfd_tunnel/${tunnelId}`);
    this._tunnels.delete(tunnelId);
    this.emit('tunnel_deleted', { tunnelId });
  }

  /**
   * Health check a specific tunnel.
   * @param {string} tunnelId
   * @returns {Promise<{tunnelId: string, status: string, connections: number}>}
   */
  async health(tunnelId) {
    const info = await this.get(tunnelId);
    return {
      tunnelId,
      status:      info.status ?? 'unknown',
      connections: info.connections?.length ?? 0,
      name:        info.name,
    };
  }

  /** Get token for running cloudflared connector. */
  async getToken(tunnelId) {
    const result = await this.client.get(
      `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/token`
    );
    return result;
  }
}

// ─────────────────────────────────────────────
// KV Store
// ─────────────────────────────────────────────

/**
 * Cloudflare Workers KV Store interface.
 * Provides edge-distributed key-value storage.
 */
class KVStore {
  /**
   * @param {CloudflareClient} client
   * @param {string} namespaceId  KV namespace ID
   */
  constructor(client, namespaceId) {
    this.client      = client;
    this.accountId   = client.accountId;
    this.namespaceId = namespaceId;
  }

  _base() {
    return `/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}`;
  }

  /**
   * Get a value by key.
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  async get(key) {
    try {
      // KV GET returns raw value, not JSON-wrapped
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.client.timeoutMs);
      const res = await fetch(
        `${this.client.baseUrl}${this._base()}/values/${encodeURIComponent(key)}`,
        {
          headers: { Authorization: `Bearer ${this.client.apiToken}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);
      if (res.status === 404) return null;
      return await res.text();
    } catch { return null; }
  }

  /**
   * Set a value.
   * @param {string} key
   * @param {string} value
   * @param {object} [opts]
   * @param {number} [opts.ttlSeconds]  Expiration TTL
   * @param {object} [opts.metadata]    Arbitrary metadata object
   */
  async set(key, value, opts = {}) {
    const formData = new FormData();
    formData.set('value', value);
    if (opts.metadata) formData.set('metadata', JSON.stringify(opts.metadata));

    const path = opts.ttlSeconds
      ? `${this._base()}/values/${encodeURIComponent(key)}?expiration_ttl=${opts.ttlSeconds}`
      : `${this._base()}/values/${encodeURIComponent(key)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.client.timeoutMs);
    try {
      const res  = await fetch(`${this.client.baseUrl}${path}`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${this.client.apiToken}` },
        body:    formData,
        signal:  controller.signal,
      });
      const json = await res.json();
      if (!json.success) throw new Error(`KV set failed: ${JSON.stringify(json.errors)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Delete a key.
   * @param {string} key
   */
  async delete(key) {
    await this.client.delete(`${this._base()}/values/${encodeURIComponent(key)}`);
  }

  /**
   * List keys in the namespace.
   * @param {object} [opts]
   * @param {string} [opts.prefix]  Key prefix filter
   * @param {number} [opts.limit]   Max keys (1–1000)
   * @returns {Promise<Array<{name: string, expiration?: number, metadata?: object}>>}
   */
  async list(opts = {}) {
    const params = new URLSearchParams();
    if (opts.prefix) params.set('prefix', opts.prefix);
    if (opts.limit)  params.set('limit',  String(opts.limit));
    const qs   = params.toString() ? `?${params}` : '';
    const data = await this.client.get(`${this._base()}/keys${qs}`);
    return data?.result ?? [];
  }
}

// ─────────────────────────────────────────────
// DNS Manager
// ─────────────────────────────────────────────

/**
 * Cloudflare DNS record management.
 */
class DNSManager {
  /**
   * @param {CloudflareClient} client
   * @param {string} zoneId  Cloudflare Zone ID
   */
  constructor(client, zoneId) {
    this.client = client;
    this.zoneId = zoneId;
  }

  _base() { return `/zones/${this.zoneId}/dns_records`; }

  /**
   * List DNS records.
   * @param {object} [filter]
   * @param {string} [filter.type]   'A' | 'CNAME' | 'TXT' | ...
   * @param {string} [filter.name]   Record name
   * @returns {Promise<object[]>}
   */
  async list(filter = {}) {
    const params = new URLSearchParams(filter);
    const qs     = params.toString() ? `?${params}` : '';
    return this.client.get(`${this._base()}${qs}`);
  }

  /**
   * Create a DNS record.
   * @param {object} record
   * @param {string} record.type    'A' | 'CNAME' | 'TXT' | 'MX' | 'AAAA'
   * @param {string} record.name    e.g. 'api.headyme.com'
   * @param {string} record.content e.g. '1.2.3.4' or 'target.example.com'
   * @param {number} [record.ttl]   TTL seconds (1 = auto)
   * @param {boolean} [record.proxied] Route through Cloudflare proxy
   * @returns {Promise<object>}
   */
  async create(record) {
    return this.client.post(this._base(), { ttl: 1, proxied: true, ...record });
  }

  /**
   * Update an existing DNS record by ID.
   * @param {string} recordId
   * @param {object} updates
   * @returns {Promise<object>}
   */
  async update(recordId, updates) {
    return this.client.patch(`${this._base()}/${recordId}`, updates);
  }

  /**
   * Delete a DNS record by ID.
   * @param {string} recordId
   */
  async delete(recordId) {
    return this.client.delete(`${this._base()}/${recordId}`);
  }

  /**
   * Upsert a DNS record (create or update by name+type).
   * @param {object} record
   * @returns {Promise<object>}
   */
  async upsert(record) {
    const existing = await this.list({ type: record.type, name: record.name });
    const match    = (existing ?? []).find(r => r.name === record.name && r.type === record.type);
    if (match) return this.update(match.id, record);
    return this.create(record);
  }
}

// ─────────────────────────────────────────────
// Cache Manager
// ─────────────────────────────────────────────

/**
 * Cloudflare edge cache management.
 */
class CacheManager {
  /**
   * @param {CloudflareClient} client
   * @param {string} zoneId
   */
  constructor(client, zoneId) {
    this.client = client;
    this.zoneId = zoneId;
  }

  /**
   * Purge specific URLs from edge cache.
   * @param {string[]} urls
   * @returns {Promise<object>}
   */
  async purgeByUrls(urls) {
    return this.client.post(
      `/zones/${this.zoneId}/purge_cache`,
      { files: urls }
    );
  }

  /**
   * Purge everything in the zone cache.
   * USE WITH CARE — impacts all cached content.
   * @returns {Promise<object>}
   */
  async purgeAll() {
    return this.client.post(
      `/zones/${this.zoneId}/purge_cache`,
      { purge_everything: true }
    );
  }

  /**
   * Purge cache by cache-tag.
   * @param {string[]} tags
   * @returns {Promise<object>}
   */
  async purgeByTags(tags) {
    return this.client.post(
      `/zones/${this.zoneId}/purge_cache`,
      { tags }
    );
  }
}

// ─────────────────────────────────────────────
// Workers Deployment Interface
// ─────────────────────────────────────────────

/**
 * Cloudflare Workers deployment interface.
 * Deploys and manages Worker scripts.
 */
class WorkersManager {
  /**
   * @param {CloudflareClient} client
   */
  constructor(client) {
    this.client    = client;
    this.accountId = client.accountId;
  }

  /**
   * Deploy a Worker script.
   * @param {object} opts
   * @param {string} opts.name       Worker script name
   * @param {string} opts.script     Worker JavaScript source
   * @param {Array}  [opts.bindings] KV, D1, R2 bindings
   * @param {string} [opts.compatibility_date]
   * @returns {Promise<object>}
   */
  async deploy(opts) {
    const formData = new FormData();
    formData.set('worker.js', new Blob([opts.script], { type: 'application/javascript' }), 'worker.js');

    const metadata = {
      main_module:        'worker.js',
      compatibility_date: opts.compatibility_date ?? new Date().toISOString().slice(0, 10),
      bindings:           opts.bindings ?? [],
    };
    formData.set('metadata', JSON.stringify(metadata));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.client.timeoutMs * 3);
    try {
      const res = await fetch(
        `${this.client.baseUrl}/accounts/${this.accountId}/workers/scripts/${opts.name}`,
        {
          method:  'PUT',
          headers: { Authorization: `Bearer ${this.client.apiToken}` },
          body:    formData,
          signal:  controller.signal,
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(`Worker deploy failed: ${JSON.stringify(json.errors)}`);
      return json.result;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get Worker script info.
   * @param {string} scriptName
   * @returns {Promise<object>}
   */
  async get(scriptName) {
    return this.client.get(`/accounts/${this.accountId}/workers/scripts/${scriptName}`);
  }

  /**
   * Delete a Worker script.
   * @param {string} scriptName
   */
  async delete(scriptName) {
    return this.client.delete(`/accounts/${this.accountId}/workers/scripts/${scriptName}`);
  }

  /**
   * List all Worker scripts.
   * @returns {Promise<object[]>}
   */
  async list() {
    return this.client.get(`/accounts/${this.accountId}/workers/scripts`);
  }
}

// ─────────────────────────────────────────────
// Access (Zero Trust) Integration
// ─────────────────────────────────────────────

/**
 * Cloudflare Access / Zero Trust integration.
 * Manages application-level access policies.
 */
class AccessManager {
  /**
   * @param {CloudflareClient} client
   */
  constructor(client) {
    this.client    = client;
    this.accountId = client.accountId;
  }

  /**
   * List Access applications.
   * @returns {Promise<object[]>}
   */
  async listApplications() {
    return this.client.get(`/accounts/${this.accountId}/access/apps`);
  }

  /**
   * Create an Access application (protect a domain).
   * @param {object} opts
   * @param {string} opts.name
   * @param {string} opts.domain       e.g. 'admin.headysystems.com'
   * @param {string} [opts.session_duration]  e.g. '24h'
   * @returns {Promise<object>}
   */
  async createApplication(opts) {
    return this.client.post(
      `/accounts/${this.accountId}/access/apps`,
      {
        name:             opts.name,
        domain:           opts.domain,
        type:             'self_hosted',
        session_duration: opts.session_duration ?? '24h',
      }
    );
  }

  /**
   * Create an Access policy (who can access the app).
   * @param {string} appId
   * @param {object} policy
   * @param {string} policy.name
   * @param {string} policy.decision   'allow' | 'deny' | 'bypass'
   * @param {Array}  policy.include    Include rules (e.g. email/domain)
   * @returns {Promise<object>}
   */
  async createPolicy(appId, policy) {
    return this.client.post(
      `/accounts/${this.accountId}/access/apps/${appId}/policies`,
      policy
    );
  }

  /**
   * Revoke all active sessions for a user.
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async revokeUserSessions(userId) {
    await this.client.post(
      `/accounts/${this.accountId}/access/users/${userId}/active_sessions/revoke`,
      {}
    );
  }
}

// ─────────────────────────────────────────────
// CloudflareIntegration (Facade)
// ─────────────────────────────────────────────

/**
 * @typedef {object} CloudflareConfig
 * @property {string}  apiToken
 * @property {string}  [accountId]
 * @property {string}  [defaultZoneId]  Default DNS zone
 * @property {string}  [defaultKVNamespaceId]
 * @property {number}  [timeoutMs]
 */

/**
 * Unified Cloudflare integration facade.
 * Composes all Cloudflare sub-managers into one convenient entry point.
 *
 * @extends EventEmitter
 *
 * @example
 * const cf = new CloudflareIntegration({ apiToken: process.env.CF_TOKEN, accountId: '...' });
 * await cf.tunnel.create({ name: 'heady-prod' });
 * await cf.dns.upsert({ type: 'CNAME', name: 'api.headyme.com', content: 'uuid.cfargotunnel.com' });
 */
class CloudflareIntegration extends EventEmitter {
  /**
   * @param {CloudflareConfig} config
   */
  constructor(config) {
    super();
    this.config = config;
    this.client = new CloudflareClient(config);

    /** Tunnel management */
    this.tunnel  = new TunnelManager(this.client);

    /** Worker deployment */
    this.workers = new WorkersManager(this.client);

    /** KV store (if namespace ID provided) */
    this.kv      = config.defaultKVNamespaceId
      ? new KVStore(this.client, config.defaultKVNamespaceId)
      : null;

    /** DNS management (if zone ID provided) */
    this.dns     = config.defaultZoneId
      ? new DNSManager(this.client, config.defaultZoneId)
      : null;

    /** Edge cache management */
    this.cache   = config.defaultZoneId
      ? new CacheManager(this.client, config.defaultZoneId)
      : null;

    /** Zero Trust access */
    this.access  = new AccessManager(this.client);

    // Forward sub-manager events
    this.tunnel.on('tunnel_created',    e => this.emit('tunnel_created', e));
    this.tunnel.on('tunnel_configured', e => this.emit('tunnel_configured', e));
    this.tunnel.on('tunnel_deleted',    e => this.emit('tunnel_deleted', e));
  }

  /**
   * Create a KVStore for a specific namespace (outside the default).
   * @param {string} namespaceId
   * @returns {KVStore}
   */
  kvFor(namespaceId) {
    return new KVStore(this.client, namespaceId);
  }

  /**
   * Create a DNSManager for a specific zone.
   * @param {string} zoneId
   * @returns {DNSManager}
   */
  dnsFor(zoneId) {
    return new DNSManager(this.client, zoneId);
  }

  /**
   * Verify that the API token has the expected permissions by listing zones.
   * @returns {Promise<{valid: boolean, accountId?: string, email?: string}>}
   */
  async verifyToken() {
    try {
      const result = await this.client.get('/user/tokens/verify');
      return { valid: true, tokenId: result.id, status: result.status };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function _randomHex(bytes) {
  // Node.js crypto — fallback to Math.random if unavailable
  try {
    return require('crypto').randomBytes(bytes).toString('hex');
  } catch {
    return Array.from({ length: bytes * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

/**
 * Create a CloudflareIntegration instance from environment variables.
 * Expects: CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID, CF_KV_NAMESPACE_ID
 * @param {Partial<CloudflareConfig>} [overrides]
 * @returns {CloudflareIntegration}
 */
function createFromEnv(overrides = {}) {
  return new CloudflareIntegration({
    apiToken:              process.env.CF_API_TOKEN       ?? '',
    accountId:             process.env.CF_ACCOUNT_ID      ?? '',
    defaultZoneId:         process.env.CF_ZONE_ID         ?? null,
    defaultKVNamespaceId:  process.env.CF_KV_NAMESPACE_ID ?? null,
    ...overrides,
  });
}

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

export {

  CloudflareIntegration,
  CloudflareClient,
  TunnelManager,
  WorkersManager,
  KVStore,
  DNSManager,
  CacheManager,
  AccessManager,
  createFromEnv,
};
