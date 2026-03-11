'use strict';

/**
 * @file migration-framework.js
 * @description HeadySystems Zero-Downtime Database Migration Framework
 * @version 3.2.2
 *
 * φ = 1.618033988749895 (Golden Ratio)
 * Fibonacci: 1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597
 *
 * Features:
 *   - Forward and backward (rollback) migrations
 *   - Distributed lock management (Redis-based, φ^4=6854ms TTL)
 *   - Zero-downtime: additive-only schema changes in forward pass
 *   - Advisory locks via PostgreSQL pg_advisory_lock
 *   - Migration retry: fib(4)=3 attempts with φ^n backoff
 *   - Automatic rollback on failure
 *   - Audit trail: SHA-256 migration content hashes
 *
 * Usage:
 *   node migration-framework.js up         # Apply all pending migrations
 *   node migration-framework.js down 1     # Roll back last N migrations
 *   node migration-framework.js status     # Show migration status
 *   node migration-framework.js create <name>  # Generate new migration file
 */

const { createHash }   = require('crypto');
const path             = require('path');
const fs               = require('fs');
const { promisify }    = require('util');

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/**
 * φ^n × base_ms timeout schedule
 * φ^0 = 1000ms, φ^1 = 1618ms, φ^2 = 2618ms, φ^3 = 4236ms, φ^4 = 6854ms
 */
const PHI_MS = (n) => Math.round(1000 * PHI ** n);

const MIGRATION_CONFIG = {
  // Lock settings
  // φ^4 = 6854ms advisory lock TTL
  lockTtlMs:         PHI_MS(4),          // 6854ms
  // φ^5 = 11090ms lock acquisition timeout
  lockTimeoutMs:     PHI_MS(5),          // 11090ms
  // fib(4)=3 lock acquisition retries
  lockRetries:       FIB[3],             // 3
  // φ^2 = 2618ms query timeout
  queryTimeoutMs:    PHI_MS(2),          // 2618ms
  // fib(4)=3 migration retries
  migrationRetries:  FIB[3],             // 3
  // φ^3 = 4236ms per-statement timeout
  statementTimeoutMs: PHI_MS(3),         // 4236ms
  // Migrations directory
  migrationsDir:     path.join(__dirname, 'sql'),
  // Migration table name
  table:             'heady_migrations',
  // Redis lock key prefix
  lockPrefix:        'heady:migration:lock',
};

// ---------------------------------------------------------------------------
// Migration Registry — built from ./sql/*.js files
// ---------------------------------------------------------------------------

/**
 * Migration entry structure.
 * @typedef {Object} Migration
 * @property {string}   id          - Unique migration ID (timestamp-name)
 * @property {string}   name        - Human-readable name
 * @property {string}   description - What this migration does
 * @property {Function} up          - Forward migration function(client, PHI)
 * @property {Function} down        - Rollback function(client, PHI)
 * @property {boolean}  reversible  - Whether rollback is possible
 * @property {string}   hash        - SHA-256 hash of migration content
 */

// ---------------------------------------------------------------------------
// Migration Manager
// ---------------------------------------------------------------------------
class MigrationManager {
  /**
   * @param {import('pg').Pool} pg         - PostgreSQL pool
   * @param {import('redis').RedisClientType} redis - Redis client
   */
  constructor(pg, redis) {
    this.pg    = pg;
    this.redis = redis;
    this.log   = (level, msg, meta = {}) => {
      console.log(JSON.stringify({
        level,
        message: msg,
        service: 'migration-framework',
        version: '3.2.2',
        phi:     PHI,
        ...meta,
        timestamp: new Date().toISOString(),
      }));
    };
  }

  // -------------------------------------------------------------------------
  // Distributed Lock Management (Redis)
  // Prevents concurrent migrations across multiple pods
  // -------------------------------------------------------------------------

  /**
   * Acquire a distributed migration lock.
   * φ^4=6854ms TTL prevents lock stranding if process crashes.
   * @returns {Promise<string>} Lock token (nonce)
   */
  async acquireLock() {
    const lockKey = `${MIGRATION_CONFIG.lockPrefix}:${process.env.NODE_ENV || 'production'}`;
    const lockToken = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + MIGRATION_CONFIG.lockTimeoutMs;

    let attempt = 0;
    while (Date.now() < deadline) {
      attempt++;
      // SET NX PX — atomic lock acquire
      const acquired = await this.redis.set(lockKey, lockToken, {
        NX: true,
        PX: MIGRATION_CONFIG.lockTtlMs,  // φ^4=6854ms TTL
      });

      if (acquired) {
        this.log('info', 'Migration lock acquired', {
          lockKey,
          lockToken,
          ttlMs: MIGRATION_CONFIG.lockTtlMs,
          derivation: `TTL=φ^4=${MIGRATION_CONFIG.lockTtlMs}ms`,
          attempt,
        });
        this._lockKey   = lockKey;
        this._lockToken = lockToken;
        return lockToken;
      }

      // φ^n backoff before retry
      const backoffMs = PHI_MS(attempt);  // φ^attempt ms
      this.log('warn', 'Migration lock contention — retrying', {
        attempt,
        maxAttempts: MIGRATION_CONFIG.lockRetries,
        backoffMs,
        derivation: `backoff=φ^${attempt}=${backoffMs}ms`,
      });

      if (attempt >= MIGRATION_CONFIG.lockRetries) {
        throw new Error(
          `Failed to acquire migration lock after fib(4)=${FIB[3]} attempts. ` +
          `Lock held by another process (TTL=φ^4=${MIGRATION_CONFIG.lockTtlMs}ms).`
        );
      }

      await new Promise((r) => setTimeout(r, backoffMs));
    }

    throw new Error(`Migration lock timeout after φ^5=${MIGRATION_CONFIG.lockTimeoutMs}ms`);
  }

  /**
   * Release the distributed migration lock.
   * Uses Lua script for atomic check-and-delete.
   */
  async releaseLock() {
    if (!this._lockKey || !this._lockToken) return;

    // Lua script: only delete if we own the lock
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(luaScript, {
      keys:      [this._lockKey],
      arguments: [this._lockToken],
    });

    this.log('info', result ? 'Migration lock released' : 'Migration lock expired (already released)', {
      lockKey: this._lockKey,
    });

    this._lockKey   = null;
    this._lockToken = null;
  }

  // -------------------------------------------------------------------------
  // Schema Management
  // -------------------------------------------------------------------------

  /**
   * Initialize the migrations table.
   * Uses IF NOT EXISTS for idempotency.
   */
  async initSchema() {
    const client = await this.pg.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATION_CONFIG.table} (
          id           TEXT PRIMARY KEY,
          name         TEXT NOT NULL,
          description  TEXT,
          applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          rolled_back  BOOLEAN NOT NULL DEFAULT FALSE,
          duration_ms  INTEGER,
          content_hash TEXT NOT NULL,
          phi          NUMERIC(20,15) DEFAULT ${PHI},
          applied_by   TEXT DEFAULT current_user,
          environment  TEXT DEFAULT '${process.env.NODE_ENV || 'production'}'
        );

        -- Index by applied_at for chronological queries
        CREATE INDEX IF NOT EXISTS idx_${MIGRATION_CONFIG.table}_applied_at
          ON ${MIGRATION_CONFIG.table}(applied_at DESC);

        -- Index for status checks
        CREATE INDEX IF NOT EXISTS idx_${MIGRATION_CONFIG.table}_rolled_back
          ON ${MIGRATION_CONFIG.table}(rolled_back) WHERE rolled_back = FALSE;
      `);
      this.log('info', 'Migration schema initialized');
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------------------------
  // Migration Discovery
  // -------------------------------------------------------------------------

  /**
   * Load all migration files from the migrations/sql directory.
   * Files must be named: YYYYMMDDHHMMSS-migration-name.js
   * @returns {Migration[]} Sorted by ID (chronological)
   */
  loadMigrations() {
    const dir = MIGRATION_CONFIG.migrationsDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return [];
    }

    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.js') && /^\d{14}-/.test(f))
      .sort()
      .map((file) => {
        const filePath   = path.join(dir, file);
        const content    = fs.readFileSync(filePath, 'utf8');
        const hash       = createHash('sha256').update(content).digest('hex');
        const migration  = require(filePath);
        const id         = file.replace('.js', '');

        return {
          id,
          name:        migration.name         || id,
          description: migration.description  || '',
          up:          migration.up,
          down:        migration.down,
          reversible:  typeof migration.down === 'function',
          hash,
          file:        filePath,
        };
      });
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  /**
   * Get migration status (applied, pending, rolled-back).
   * @returns {Promise<Object>}
   */
  async getStatus() {
    await this.initSchema();
    const client = await this.pg.connect();
    try {
      const result = await client.query(`
        SELECT id, name, applied_at, rolled_back, duration_ms, content_hash
        FROM ${MIGRATION_CONFIG.table}
        ORDER BY applied_at ASC
      `);

      const applied    = result.rows;
      const all        = this.loadMigrations();
      const appliedIds = new Set(applied.filter((r) => !r.rolled_back).map((r) => r.id));
      const pending    = all.filter((m) => !appliedIds.has(m.id));

      return {
        applied:   applied.filter((r) => !r.rolled_back).length,
        pending:   pending.length,
        total:     all.length,
        status:    pending.length === 0 ? 'up_to_date' : 'pending',
        migrations: all.map((m) => ({
          id:       m.id,
          name:     m.name,
          status:   appliedIds.has(m.id) ? 'applied' : 'pending',
          hash:     m.hash,
          reversible: m.reversible,
        })),
        phi: PHI,
      };
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------------------------
  // Forward Migration (up)
  // -------------------------------------------------------------------------

  /**
   * Apply all pending migrations.
   * @returns {Promise<Object>} Results
   */
  async up() {
    await this.initSchema();
    const lockToken = await this.acquireLock();

    try {
      const status = await this.getStatus();
      const pending = this.loadMigrations()
        .filter((m) => {
          const applied = status.migrations.find((s) => s.id === m.id);
          return !applied || applied.status === 'pending';
        });

      if (pending.length === 0) {
        this.log('info', 'No pending migrations');
        return { applied: 0, migrations: [] };
      }

      this.log('info', `Applying ${pending.length} pending migration(s)`, {
        migrations: pending.map((m) => m.id),
        phi: PHI,
      });

      const results = [];

      for (const migration of pending) {
        const result = await this._applyMigration(migration);
        results.push(result);

        if (!result.success) {
          this.log('error', 'Migration failed — stopping', { migration: migration.id, error: result.error });
          break;
        }
      }

      return {
        applied:    results.filter((r) => r.success).length,
        failed:     results.filter((r) => !r.success).length,
        migrations: results,
      };
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Apply a single migration with retry logic.
   * Uses PostgreSQL advisory locks for additional safety.
   * @param {Migration} migration
   * @returns {Promise<Object>}
   */
  async _applyMigration(migration) {
    const startMs = Date.now();
    let attempt = 0;

    while (attempt < MIGRATION_CONFIG.migrationRetries) {
      attempt++;
      const client = await this.pg.connect();

      try {
        // Set statement timeout: φ^3=4236ms per statement
        await client.query(`SET statement_timeout = ${MIGRATION_CONFIG.statementTimeoutMs}`);

        // Acquire PostgreSQL advisory lock (lock ID = hash of migration ID)
        const lockId = parseInt(
          createHash('sha256').update(migration.id).digest('hex').slice(0, 8),
          16
        );
        await client.query(`SELECT pg_advisory_xact_lock(${lockId})`);

        // Run within transaction
        await client.query('BEGIN');

        this.log('info', `Running migration: ${migration.id}`, {
          attempt,
          maxAttempts: MIGRATION_CONFIG.migrationRetries,
        });

        // Execute the migration
        await migration.up(client, PHI, FIB);

        // Record in migrations table
        await client.query(`
          INSERT INTO ${MIGRATION_CONFIG.table}
            (id, name, description, duration_ms, content_hash, phi)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE
            SET applied_at = NOW(),
                rolled_back = FALSE,
                duration_ms = EXCLUDED.duration_ms
        `, [
          migration.id,
          migration.name,
          migration.description,
          Date.now() - startMs,
          migration.hash,
          PHI,
        ]);

        await client.query('COMMIT');

        const durationMs = Date.now() - startMs;
        this.log('info', `Migration applied successfully: ${migration.id}`, {
          durationMs,
          attempt,
        });

        return { success: true, id: migration.id, durationMs, attempt };

      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        client.release();

        this.log('error', `Migration attempt ${attempt} failed: ${migration.id}`, {
          error: err.message,
          attempt,
          maxAttempts: MIGRATION_CONFIG.migrationRetries,
        });

        if (attempt >= MIGRATION_CONFIG.migrationRetries) {
          return { success: false, id: migration.id, error: err.message, attempts: attempt };
        }

        // φ^attempt backoff
        const backoffMs = PHI_MS(attempt);
        this.log('warn', `Retrying migration in φ^${attempt}=${backoffMs}ms`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      } finally {
        try { client.release(); } catch (_) {}
      }
    }
  }

  // -------------------------------------------------------------------------
  // Rollback (down)
  // -------------------------------------------------------------------------

  /**
   * Roll back the last N migrations.
   * @param {number} [count=1] - Number of migrations to roll back (default fib(2)=1)
   * @returns {Promise<Object>}
   */
  async down(count = FIB[1]) {  // fib(2)=1 default
    await this.initSchema();
    const lockToken = await this.acquireLock();

    try {
      const client = await this.pg.connect();
      let rolledBack = [];

      try {
        const result = await client.query(`
          SELECT id, name, content_hash
          FROM ${MIGRATION_CONFIG.table}
          WHERE rolled_back = FALSE
          ORDER BY applied_at DESC
          LIMIT $1
        `, [count]);

        const toRollback = result.rows;

        if (toRollback.length === 0) {
          this.log('info', 'No migrations to roll back');
          return { rolledBack: 0, migrations: [] };
        }

        const allMigrations = this.loadMigrations();

        for (const row of toRollback) {
          const migration = allMigrations.find((m) => m.id === row.id);

          if (!migration) {
            this.log('warn', `Migration file not found for rollback: ${row.id}`);
            continue;
          }

          if (!migration.reversible) {
            this.log('error', `Migration is not reversible: ${row.id}`);
            throw new Error(`Migration ${row.id} has no down() function — cannot roll back`);
          }

          // Verify content hash hasn't changed
          if (migration.hash !== row.content_hash) {
            this.log('warn', `Migration content hash mismatch: ${row.id} — proceeding anyway`);
          }

          const rollbackClient = await this.pg.connect();
          try {
            await rollbackClient.query(`SET statement_timeout = ${MIGRATION_CONFIG.statementTimeoutMs}`);
            await rollbackClient.query('BEGIN');

            this.log('info', `Rolling back migration: ${row.id}`);
            await migration.down(rollbackClient, PHI, FIB);

            await rollbackClient.query(`
              UPDATE ${MIGRATION_CONFIG.table}
              SET rolled_back = TRUE
              WHERE id = $1
            `, [row.id]);

            await rollbackClient.query('COMMIT');

            rolledBack.push({ id: row.id, name: row.name });
            this.log('info', `Migration rolled back: ${row.id}`);

          } catch (err) {
            await rollbackClient.query('ROLLBACK').catch(() => {});
            throw err;
          } finally {
            rollbackClient.release();
          }
        }

      } finally {
        client.release();
      }

      return { rolledBack: rolledBack.length, migrations: rolledBack };

    } finally {
      await this.releaseLock();
    }
  }
}

// ---------------------------------------------------------------------------
// Migration Template Generator
// ---------------------------------------------------------------------------

/**
 * Generate a new migration file.
 * @param {string} name - Migration name (kebab-case)
 */
const createMigration = (name) => {
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const id        = `${timestamp}-${name}`;
  const dir       = MIGRATION_CONFIG.migrationsDir;

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${id}.js`);
  const content  = `'use strict';
/**
 * Migration: ${id}
 * φ = ${PHI}
 *
 * Description: TODO
 *
 * Zero-downtime strategy:
 *   1. Add new column/table (additive — no lock)
 *   2. Deploy new code that writes to both old and new
 *   3. Backfill data in batches of fib(n) rows
 *   4. Deploy code that reads from new only
 *   5. Drop old column/table (this migration's down())
 */

const PHI = ${PHI};
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/** @param {import('pg').Client} client */
exports.up = async (client, phi, fib) => {
  // TODO: Add your forward migration here
  // Use φ-scaled batch sizes: fib(9)=34 or fib(10)=55 rows per batch
  // Example:
  // await client.query(\`ALTER TABLE heady_agents ADD COLUMN IF NOT EXISTS csl_score NUMERIC(5,4)\`);
  throw new Error('Migration not implemented: ${id}');
};

/** @param {import('pg').Client} client */
exports.down = async (client, phi, fib) => {
  // TODO: Add your rollback migration here
  // Must be reversible (zero data loss)
  throw new Error('Rollback not implemented: ${id}');
};

exports.name        = '${name}';
exports.description = 'TODO: describe this migration';
`;

  fs.writeFileSync(filePath, content);
  console.log(`Created migration: ${filePath}`);
  return filePath;
};

// ---------------------------------------------------------------------------
// CLI Interface
// ---------------------------------------------------------------------------

if (require.main === module) {
  const [,, command, ...args] = process.argv;

  const { Pool }         = require('pg');
  const { createClient } = require('redis');

  const pg    = new Pool({ connectionString: process.env.DATABASE_URL });
  const redis = createClient({ url: process.env.REDIS_URL });

  (async () => {
    try {
      await redis.connect();
      const mgr = new MigrationManager(pg, redis);

      switch (command) {
        case 'up': {
          const result = await mgr.up();
          console.log(JSON.stringify(result, null, 2));
          process.exit(result.failed > 0 ? 1 : 0);
          break;
        }
        case 'down': {
          const count = parseInt(args[0] || '1', 10);  // default: fib(2)=1
          const result = await mgr.down(count);
          console.log(JSON.stringify(result, null, 2));
          break;
        }
        case 'status': {
          const status = await mgr.getStatus();
          console.log(JSON.stringify(status, null, 2));
          process.exit(status.pending > 0 ? 1 : 0);
          break;
        }
        case 'create': {
          if (!args[0]) { console.error('Usage: migration-framework create <name>'); process.exit(1); }
          createMigration(args[0]);
          break;
        }
        default:
          console.log('Usage: migration-framework <up|down [n]|status|create <name>>');
          process.exit(1);
      }
    } catch (err) {
      console.error(JSON.stringify({ level: 'error', message: err.message, phi: PHI }));
      process.exit(1);
    } finally {
      await redis.disconnect().catch(() => {});
      await pg.end().catch(() => {});
    }
  })();
}

module.exports = { MigrationManager, createMigration, PHI, FIB, MIGRATION_CONFIG };
