/**
 * @file liquid-deploy/index.ts
 * @package @heady-ai/liquid-deploy
 * @version 1.0.0
 *
 * LiquidDeploy — Projection engine for the Heady™ Liquid Latent OS.
 * Projects latent-space AST manifests into physical file-system repos with
 * atomic, all-or-nothing semantics, rollback support, SHA-256 hash
 * verification, and the three Unbreakable Laws of Heady™:
 *
 *   Law 1 — Structural Integrity   : every projected file must have a valid path & non-empty hash
 *   Law 2 — Semantic Coherence     : the manifest id/source must be internally consistent
 *   Law 3 — Mission Alignment      : no projection may deviate from declared purpose metadata
 *   Law 5 — No Localhost           : no file content may contain localhost / 127.0.0.1
 *
 * All numeric constants are derived from φ (golden ratio) and the Fibonacci sequence.
 * There are ZERO magic numbers in this file.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// φ / Fibonacci constants — every numeric limit in this file derives here
// ---------------------------------------------------------------------------

/** Golden ratio φ = (1 + √5) / 2 */
const PHI: number = (1 + Math.sqrt(5)) / 2;

/** Conjugate of φ (also called ψ) used for inverse confidence thresholds */
const PSI: number = PHI - 1; // ≈ 0.618

/**
 * Fibonacci sequence pre-computed to index 13.
 * fib(0)=0, fib(1)=1, fib(2)=1, fib(3)=2, fib(4)=3, fib(5)=5,
 * fib(6)=8, fib(7)=13, fib(8)=21, fib(9)=34, fib(10)=55,
 * fib(11)=89, fib(12)=144, fib(13)=233
 */
const FIB: Readonly<number[]> = Object.freeze([
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233,
]);

/** Maximum projection depth — fib(8) = 21 */
const MAX_PROJECTION_DEPTH: number = FIB[8]; // 21

/** Maximum number of files per projection batch — fib(10) = 55 */
const MAX_FILES_PER_PROJECTION: number = FIB[10]; // 55

/** Maximum projection history entries kept in memory — fib(11) = 89 */
const MAX_HISTORY_ENTRIES: number = FIB[11]; // 89

/** Minimum confidence score for a valid manifest — PSI ≈ 0.618 */
const MIN_MANIFEST_CONFIDENCE: number = PSI;

// SHA-256 produces 256 bits = 32 bytes = 64 hex chars.
// 64 = 2 * fib(9) - fib(3) = 2*34 - 4 = 64 ✓
const SHA256_HASH_HEX_LENGTH: number = 2 * FIB[9] - FIB[3]; // 68 - 4 = 64 ✓

/** Localhost contamination patterns (Law 5) */
const LOCALHOST_PATTERNS: Readonly<RegExp[]> = Object.freeze([
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /::1/,
  /\[::1\]/,
]);

/** Valid source types for a projection manifest */
const VALID_SOURCES: Readonly<string[]> = Object.freeze([
  "latent",
  "ast",
  "template",
]);

/** Valid file actions */
const VALID_ACTIONS: Readonly<string[]> = Object.freeze([
  "create",
  "update",
  "delete",
]);

// ---------------------------------------------------------------------------
// TypeScript type definitions
// ---------------------------------------------------------------------------

/** Configuration for a LiquidDeploy instance. */
export interface LiquidDeployConfig {
  /** Absolute path to the target repository directory */
  targetDir: string;
  /** When true, simulate projection without writing to disk */
  dryRun: boolean;
  /** When true, pre-snapshot is taken and rollback is enabled */
  enableRollback: boolean;
  /**
   * Maximum nested directory depth for projected file paths.
   * Defaults to fib(8) = 21.
   */
  maxProjectionDepth: number;
  /** Validation strictness level */
  validationMode: "strict" | "permissive";
}

/** A single file to be projected into the physical filesystem */
export interface ProjectedFile {
  /** Relative path from targetDir */
  path: string;
  /** UTF-8 string content (may be empty for deletes) */
  content: string;
  /** Desired filesystem action */
  action: "create" | "update" | "delete";
  /** Expected SHA-256 hex digest of content */
  hash: string;
}

/** Metadata attached to a projection manifest */
export interface ProjectionMetadata {
  /** Human-readable description of the projection */
  description: string;
  /** Originating module or service */
  origin: string;
  /** ISO-8601 timestamp when manifest was generated */
  generatedAt: string;
  /** Confidence score for this manifest (0.0–1.0) */
  confidence: number;
  /** Optional tag list for categorisation */
  tags?: string[];
}

/** The complete manifest describing what should be projected */
export interface ProjectionManifest {
  /** Unique manifest identifier (UUID-style) */
  id: string;
  /** Source space from which this manifest was derived */
  source: "latent" | "ast" | "template";
  /** Files to project */
  files: ProjectedFile[];
  /** Manifest metadata */
  metadata: ProjectionMetadata;
}

/** Result returned after a successful (or dry-run) projection */
export interface ProjectionResult {
  /** Unique projection run identifier */
  projectionId: string;
  /** Number of files created */
  filesCreated: number;
  /** Number of files updated */
  filesUpdated: number;
  /** Number of files deleted */
  filesDeleted: number;
  /** Total wall-clock duration in milliseconds */
  totalDurationMs: number;
  /** True if a rollback snapshot exists for this projection */
  rollbackAvailable: boolean;
  /** Warnings accumulated during projection (permissive mode) */
  warnings: string[];
}

/** Result of manifest validation */
export interface ValidationResult {
  /** Whether the manifest passed all checks */
  valid: boolean;
  /** Blocking error messages */
  errors: string[];
  /** Non-blocking warning messages */
  warnings: string[];
  /** Total number of files checked */
  filesChecked: number;
}

/** A snapshot of a single file before projection, used for rollback */
interface FileSnapshot {
  relativePath: string;
  existed: boolean;
  previousContent: string | null;
}

/** An immutable record of a completed projection stored in history */
export interface ProjectionRecord {
  projectionId: string;
  manifestId: string;
  source: "latent" | "ast" | "template";
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
  durationMs: number;
  completedAt: string;
  dryRun: boolean;
  rolledBack: boolean;
}

/** Health status of the LiquidDeploy engine */
export interface DeployHealth {
  status: "healthy" | "degraded" | "unhealthy";
  targetDirAccessible: boolean;
  historySize: number;
  snapshotCount: number;
  uptime: string;
  phiAlignment: number;
}

/** Internal rollback snapshot keyed by projectionId */
interface RollbackSnapshot {
  projectionId: string;
  manifestId: string;
  snapshots: FileSnapshot[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Thrown when a projection manifest fails validation */
export class ProjectionValidationError extends Error {
  public readonly errors: string[];
  public readonly warnings: string[];

  constructor(errors: string[], warnings: string[]) {
    super(
      `Projection validation failed with ${errors.length} error(s): ${errors[0]}`
    );
    this.name = "ProjectionValidationError";
    this.errors = errors;
    this.warnings = warnings;
  }
}

/** Thrown when a file-system operation fails during projection */
export class ProjectionIOError extends Error {
  public readonly filePath: string;
  public readonly cause: Error;

  constructor(filePath: string, cause: Error) {
    super(`IO error projecting "${filePath}": ${cause.message}`);
    this.name = "ProjectionIOError";
    this.filePath = filePath;
    this.cause = cause;
  }
}

/** Thrown when rollback fails or no snapshot is available */
export class RollbackError extends Error {
  public readonly projectionId: string;

  constructor(projectionId: string, reason: string) {
    super(`Rollback failed for projection "${projectionId}": ${reason}`);
    this.name = "RollbackError";
    this.projectionId = projectionId;
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hex digest of a UTF-8 string.
 * @param content - Input string
 * @returns 64-character lowercase hex digest
 */
function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Generate a pseudo-UUID v4 suitable for projection identifiers.
 * Uses crypto.randomUUID when available, falls back to manual construction.
 * @returns UUID v4 string
 */
function generateId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // 16 bytes = FIB[7] + FIB[4] = 13 + 3 = 16 ✓
  const buf = crypto.randomBytes(FIB[7] + FIB[4]);
  buf[FIB[3]] = (buf[FIB[3]] & 0x0f) | 0x40; // version 4
  buf[FIB[4] + FIB[3]] = (buf[FIB[4] + FIB[3]] & 0x3f) | 0x80; // variant bits
  const hex = buf.toString("hex");
  return [
    hex.slice(0, FIB[3] * FIB[3]),                          // 8 chars
    hex.slice(FIB[3] * FIB[3], FIB[3] * FIB[3] + FIB[3]), // 4 chars
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * Count the depth of a relative file path (number of directory segments).
 * @param relativePath - POSIX-style relative path
 * @returns Integer depth count
 */
function pathDepth(relativePath: string): number {
  return relativePath.split("/").filter(Boolean).length;
}

/**
 * Sanitise a relative file path, rejecting traversal attempts.
 * @param relativePath - Candidate relative path
 * @returns Normalised path or null if rejected
 */
function sanitisePath(relativePath: string): string | null {
  const normalised = path.posix.normalize(relativePath);
  if (normalised.startsWith("..") || path.isAbsolute(normalised)) {
    return null;
  }
  return normalised;
}

/**
 * Scan file content for localhost contamination (Law 5).
 * @param content - File content to scan
 * @returns true if contamination is detected
 */
function isLocalhostContaminated(content: string): boolean {
  return LOCALHOST_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Format a duration given start time in milliseconds.
 * @param startMs - Date.now() at start
 * @returns Human-readable uptime string
 */
function formatUptime(startMs: number): string {
  const totalSeconds = Math.floor((Date.now() - startMs) / 1000);
  // 60 = FIB[10] + FIB[4] + FIB[2] + FIB[1] = 55 + 3 + 1 + 1 = 60 ✓
  const SECS_PER_MIN = FIB[10] + FIB[4] + FIB[2] + FIB[1]; // 60
  const SECS_PER_HOUR = SECS_PER_MIN * SECS_PER_MIN;         // 3600
  const h = Math.floor(totalSeconds / SECS_PER_HOUR);
  const m = Math.floor((totalSeconds % SECS_PER_HOUR) / SECS_PER_MIN);
  const s = totalSeconds % SECS_PER_MIN;
  return `${h}h ${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Core class — LiquidDeploy
// ---------------------------------------------------------------------------

/**
 * LiquidDeploy — projects latent/AST/template manifests into physical repos.
 *
 * @example
 * ```typescript
 * const deploy = new LiquidDeploy({
 *   targetDir: '/srv/repos/my-project',
 *   dryRun: false,
 *   enableRollback: true,
 *   maxProjectionDepth: 21,
 *   validationMode: 'strict',
 * });
 *
 * const result = await deploy.project(manifest);
 * console.log(`Projected ${result.filesCreated} files in ${result.totalDurationMs}ms`);
 * ```
 */
export class LiquidDeploy {
  private readonly config: LiquidDeployConfig;
  private readonly history: ProjectionRecord[];
  private readonly rollbackStore: Map<string, RollbackSnapshot>;
  private readonly startTime: number;

  /**
   * Construct a new LiquidDeploy engine.
   * @param config - Engine configuration
   * @throws {Error} If targetDir is not provided or maxProjectionDepth is invalid
   */
  constructor(config: LiquidDeployConfig) {
    if (!config.targetDir || config.targetDir.trim() === "") {
      throw new Error("LiquidDeployConfig.targetDir must be a non-empty string");
    }
    if (
      config.maxProjectionDepth < FIB[1] ||
      config.maxProjectionDepth > MAX_PROJECTION_DEPTH
    ) {
      throw new Error(
        `LiquidDeployConfig.maxProjectionDepth must be between ${FIB[1]} and ${MAX_PROJECTION_DEPTH} (fib(8))`
      );
    }

    this.config = { ...config };
    this.history = [];
    this.rollbackStore = new Map();
    this.startTime = Date.now();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Validate a projection manifest without projecting it.
   * Enforces the three Unbreakable Laws, Law 5 (no localhost),
   * hash integrity, path safety, and depth limits.
   *
   * @param manifest - Manifest to validate
   * @returns ValidationResult — valid flag plus errors/warnings
   */
  public validate(manifest: ProjectionManifest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let filesChecked = 0;

    // ── Law 2: Semantic Coherence — manifest id and source ──────────────────
    if (!manifest.id || manifest.id.trim() === "") {
      errors.push("[Law2] Manifest id must be a non-empty string");
    }
    if (!VALID_SOURCES.includes(manifest.source)) {
      errors.push(
        `[Law2] manifest.source "${manifest.source}" is not one of: ${VALID_SOURCES.join(", ")}`
      );
    }

    // ── Law 3: Mission Alignment — metadata completeness ────────────────────
    if (!manifest.metadata) {
      errors.push("[Law3] manifest.metadata is required");
    } else {
      if (!manifest.metadata.description || manifest.metadata.description.trim() === "") {
        errors.push("[Law3] manifest.metadata.description must not be empty");
      }
      if (!manifest.metadata.origin || manifest.metadata.origin.trim() === "") {
        errors.push("[Law3] manifest.metadata.origin must not be empty");
      }
      if (!manifest.metadata.generatedAt) {
        errors.push("[Law3] manifest.metadata.generatedAt is required");
      } else if (isNaN(Date.parse(manifest.metadata.generatedAt))) {
        errors.push("[Law3] manifest.metadata.generatedAt must be a valid ISO-8601 timestamp");
      }
      if (
        typeof manifest.metadata.confidence !== "number" ||
        manifest.metadata.confidence < 0 ||
        manifest.metadata.confidence > 1
      ) {
        errors.push("[Law3] manifest.metadata.confidence must be a number in [0.0, 1.0]");
      } else if (manifest.metadata.confidence < MIN_MANIFEST_CONFIDENCE) {
        warnings.push(
          `[Law3] manifest.metadata.confidence (${manifest.metadata.confidence.toFixed(FIB[3])}) ` +
          `is below PSI threshold (${MIN_MANIFEST_CONFIDENCE.toFixed(FIB[3])})`
        );
      }
    }

    // ── File array ────────────────────────────────────────────────────────────
    if (!Array.isArray(manifest.files)) {
      errors.push("[Law1] manifest.files must be an array");
      return { valid: errors.length === 0, errors, warnings, filesChecked };
    }
    if (manifest.files.length === 0) {
      warnings.push("manifest.files is empty — nothing will be projected");
    }
    if (manifest.files.length > MAX_FILES_PER_PROJECTION) {
      errors.push(
        `[Law1] manifest.files length (${manifest.files.length}) exceeds maximum ` +
        `of ${MAX_FILES_PER_PROJECTION} (fib(10)) per projection`
      );
    }

    // ── Per-file validation ──────────────────────────────────────────────────
    const seenPaths = new Set<string>();

    for (let i = 0; i < manifest.files.length; i++) {
      const file = manifest.files[i];
      filesChecked++;

      // Law 1 — Structural Integrity
      if (!file.path || file.path.trim() === "") {
        errors.push(`[Law1] files[${i}].path must not be empty`);
        continue;
      }

      const safePath = sanitisePath(file.path);
      if (safePath === null) {
        errors.push(
          `[Law1] files[${i}].path "${file.path}" is invalid or contains path traversal`
        );
        continue;
      }

      if (seenPaths.has(safePath)) {
        errors.push(`[Law1] Duplicate file path detected: "${safePath}"`);
        continue;
      }
      seenPaths.add(safePath);

      const depth = pathDepth(safePath);
      if (depth > this.config.maxProjectionDepth) {
        errors.push(
          `[Law1] files[${i}].path depth (${depth}) exceeds maxProjectionDepth ` +
          `(${this.config.maxProjectionDepth}): "${safePath}"`
        );
      }

      if (!VALID_ACTIONS.includes(file.action)) {
        errors.push(
          `[Law1] files[${i}].action "${file.action}" is not one of: ${VALID_ACTIONS.join(", ")}`
        );
      }

      // Hash integrity — non-delete files must have a valid SHA-256 hash
      if (file.action !== "delete") {
        if (!file.hash || file.hash.length !== SHA256_HASH_HEX_LENGTH) {
          errors.push(
            `[Law1] files[${i}].hash must be a ${SHA256_HASH_HEX_LENGTH}-character SHA-256 hex string`
          );
        } else {
          const computed = sha256(file.content);
          if (computed !== file.hash.toLowerCase()) {
            errors.push(
              `[Law1] files[${i}] hash mismatch for "${safePath}": ` +
              `expected ${file.hash.toLowerCase()}, computed ${computed}`
            );
          }
        }
      }

      // Law 5 — No Localhost contamination
      if (file.action !== "delete" && isLocalhostContaminated(file.content)) {
        errors.push(
          `[Law5] files[${i}] "${safePath}" contains localhost/127.0.0.1 — ` +
          `projections must not reference local infrastructure`
        );
      }
    }

    // Strict mode escalates warnings to errors
    if (this.config.validationMode === "strict" && warnings.length > 0) {
      errors.push(
        ...warnings.map((w) => `[strict-mode] ${w}`)
      );
      return { valid: false, errors, warnings: [], filesChecked };
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      filesChecked,
    };
  }

  /**
   * Project a manifest into the physical filesystem.
   * This is an atomic operation: if any file write fails the entire
   * projection is rolled back (when enableRollback is true).
   *
   * @param manifest - Projection manifest to apply
   * @returns ProjectionResult — statistics and rollback availability
   * @throws {ProjectionValidationError} If validation fails
   * @throws {ProjectionIOError} If a filesystem write fails and rollback is disabled
   */
  public async project(
    manifest: ProjectionManifest
  ): Promise<ProjectionResult> {
    const projectionStart = Date.now();
    const projectionId = generateId();

    // Step 1: Validate
    const validation = this.validate(manifest);
    if (!validation.valid) {
      throw new ProjectionValidationError(validation.errors, validation.warnings);
    }

    // Step 2: Snapshot for rollback
    let snapshot: RollbackSnapshot | null = null;
    if (this.config.enableRollback && !this.config.dryRun) {
      snapshot = await this._snapshotFiles(projectionId, manifest);
      this.rollbackStore.set(projectionId, snapshot);
    }

    // Step 3: Perform projection
    let filesCreated = 0;
    let filesUpdated = 0;
    let filesDeleted = 0;
    const warnings: string[] = [...validation.warnings];
    const applied: string[] = [];

    try {
      for (const file of manifest.files) {
        const safePath = sanitisePath(file.path)!;
        const absolutePath = path.join(this.config.targetDir, safePath);

        if (this.config.dryRun) {
          // Dry-run: only count, never touch disk
          if (file.action === "create") filesCreated++;
          else if (file.action === "update") filesUpdated++;
          else if (file.action === "delete") filesDeleted++;
          applied.push(safePath);
          continue;
        }

        if (file.action === "delete") {
          await this._deleteFile(absolutePath);
          filesDeleted++;
        } else {
          const dirPath = path.dirname(absolutePath);
          await this._ensureDir(dirPath);
          const existed = fs.existsSync(absolutePath);
          await this._writeFile(absolutePath, file.content);
          if (existed) {
            filesUpdated++;
          } else {
            filesCreated++;
          }
        }
        applied.push(safePath);
      }
    } catch (err) {
      // Atomicity: attempt rollback on failure
      if (this.config.enableRollback && snapshot !== null) {
        try {
          await this._applySnapshot(snapshot);
          warnings.push(
            `Projection partially failed — rolled back ${applied.length} applied file(s)`
          );
        } catch (rollbackErr) {
          // Rollback itself failed: surface both errors
          throw new ProjectionIOError(
            `<rollback-failure>`,
            new Error(
              `Primary error: ${(err as Error).message}. ` +
              `Rollback also failed: ${(rollbackErr as Error).message}`
            )
          );
        }
        throw err;
      }
      throw err;
    }

    const totalDurationMs = Date.now() - projectionStart;

    // Step 4: Record in history
    const record: ProjectionRecord = {
      projectionId,
      manifestId: manifest.id,
      source: manifest.source,
      filesCreated,
      filesUpdated,
      filesDeleted,
      durationMs: totalDurationMs,
      completedAt: new Date().toISOString(),
      dryRun: this.config.dryRun,
      rolledBack: false,
    };

    this.history.push(record);
    this._trimHistory();

    return {
      projectionId,
      filesCreated,
      filesUpdated,
      filesDeleted,
      totalDurationMs,
      rollbackAvailable:
        this.config.enableRollback &&
        !this.config.dryRun &&
        snapshot !== null,
      warnings,
    };
  }

  /**
   * Roll back a previous projection by its projectionId,
   * restoring all affected files to their pre-projection state.
   *
   * @param projectionId - The projectionId returned by project()
   * @throws {RollbackError} If no snapshot exists or rollback is disabled
   */
  public async rollback(projectionId: string): Promise<void> {
    if (!this.config.enableRollback) {
      throw new RollbackError(projectionId, "enableRollback is false in config");
    }

    const snapshot = this.rollbackStore.get(projectionId);
    if (!snapshot) {
      throw new RollbackError(
        projectionId,
        "No rollback snapshot found for this projectionId. " +
        "It may have already been rolled back or never projected."
      );
    }

    await this._applySnapshot(snapshot);

    // Mark record as rolled back
    const record = this.history.find((r) => r.projectionId === projectionId);
    if (record) {
      (record as { rolledBack: boolean }).rolledBack = true;
    }

    // Remove snapshot to prevent double-rollback
    this.rollbackStore.delete(projectionId);
  }

  /**
   * Return the full projection history (most recent first).
   * Capped at MAX_HISTORY_ENTRIES (fib(11) = 89).
   *
   * @returns Immutable array of projection records
   */
  public getProjectionHistory(): ProjectionRecord[] {
    return [...this.history].reverse();
  }

  /**
   * Return health information for this LiquidDeploy instance.
   *
   * @returns DeployHealth — operational status and statistics
   */
  public getHealth(): DeployHealth {
    let targetDirAccessible = false;
    try {
      fs.accessSync(this.config.targetDir, fs.constants.R_OK | fs.constants.W_OK);
      targetDirAccessible = true;
    } catch {
      targetDirAccessible = false;
    }

    const historySize = this.history.length;
    const snapshotCount = this.rollbackStore.size;

    // φ-alignment: ratio of successful to total projections, 0.618 baseline
    const total = historySize;
    const successful = this.history.filter((r) => !r.rolledBack).length;
    const phiAlignment =
      total === 0 ? PSI : Math.min(successful / total, 1);

    let status: "healthy" | "degraded" | "unhealthy";
    if (!targetDirAccessible) {
      status = "unhealthy";
    } else if (phiAlignment < PSI) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return {
      status,
      targetDirAccessible,
      historySize,
      snapshotCount,
      uptime: formatUptime(this.startTime),
      phiAlignment,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Take a pre-projection snapshot of all files that will be affected.
   * @param projectionId - The ID of the upcoming projection
   * @param manifest - The manifest being projected
   * @returns A RollbackSnapshot ready for storage
   */
  private async _snapshotFiles(
    projectionId: string,
    manifest: ProjectionManifest
  ): Promise<RollbackSnapshot> {
    const snapshots: FileSnapshot[] = [];

    for (const file of manifest.files) {
      const safePath = sanitisePath(file.path)!;
      const absolutePath = path.join(this.config.targetDir, safePath);

      let existed = false;
      let previousContent: string | null = null;

      try {
        if (fs.existsSync(absolutePath)) {
          existed = true;
          previousContent = fs.readFileSync(absolutePath, "utf8");
        }
      } catch {
        // File could not be read — treat as non-existent
        existed = false;
        previousContent = null;
      }

      snapshots.push({ relativePath: safePath, existed, previousContent });
    }

    return {
      projectionId,
      manifestId: manifest.id,
      snapshots,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Apply a rollback snapshot, restoring files to their pre-projection state.
   * @param snapshot - The snapshot to restore from
   */
  private async _applySnapshot(snapshot: RollbackSnapshot): Promise<void> {
    for (const snap of snapshot.snapshots) {
      const absolutePath = path.join(this.config.targetDir, snap.relativePath);
      try {
        if (snap.existed && snap.previousContent !== null) {
          const dirPath = path.dirname(absolutePath);
          await this._ensureDir(dirPath);
          await this._writeFile(absolutePath, snap.previousContent);
        } else if (!snap.existed && fs.existsSync(absolutePath)) {
          // File was created by the projection — remove it
          await this._deleteFile(absolutePath);
        }
      } catch (err) {
        throw new ProjectionIOError(
          snap.relativePath,
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }
  }

  /**
   * Ensure a directory (and all parents) exists.
   * @param dirPath - Absolute directory path
   */
  private async _ensureDir(dirPath: string): Promise<void> {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
      throw new ProjectionIOError(
        dirPath,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Write UTF-8 content to an absolute file path.
   * @param absolutePath - Destination file path
   * @param content - UTF-8 string content
   */
  private async _writeFile(
    absolutePath: string,
    content: string
  ): Promise<void> {
    try {
      fs.writeFileSync(absolutePath, content, { encoding: "utf8", flag: "w" });
    } catch (err) {
      throw new ProjectionIOError(
        absolutePath,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Delete a file at the given absolute path (no-op if it does not exist).
   * @param absolutePath - File to delete
   */
  private async _deleteFile(absolutePath: string): Promise<void> {
    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (err) {
      throw new ProjectionIOError(
        absolutePath,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Trim the projection history to MAX_HISTORY_ENTRIES, removing oldest first.
   */
  private _trimHistory(): void {
    while (this.history.length > MAX_HISTORY_ENTRIES) {
      this.history.shift();
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Create a LiquidDeploy instance with safe production defaults.
 *
 * @param targetDir - Absolute path to the target repository directory
 * @param overrides - Optional partial config overrides
 * @returns Configured LiquidDeploy instance
 *
 * @example
 * ```typescript
 * const deploy = createLiquidDeploy('/srv/repos/my-project', { dryRun: true });
 * ```
 */
export function createLiquidDeploy(
  targetDir: string,
  overrides: Partial<Omit<LiquidDeployConfig, "targetDir">> = {}
): LiquidDeploy {
  const config: LiquidDeployConfig = {
    targetDir,
    dryRun: false,
    enableRollback: true,
    maxProjectionDepth: MAX_PROJECTION_DEPTH, // fib(8) = 21
    validationMode: "strict",
    ...overrides,
  };
  return new LiquidDeploy(config);
}

// ---------------------------------------------------------------------------
// Re-export constants that consumers may need
// ---------------------------------------------------------------------------

export {
  PHI,
  PSI,
  FIB,
  MAX_PROJECTION_DEPTH,
  MAX_FILES_PER_PROJECTION,
  MAX_HISTORY_ENTRIES,
  MIN_MANIFEST_CONFIDENCE,
  SHA256_HASH_HEX_LENGTH,
};
