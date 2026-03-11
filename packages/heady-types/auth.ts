/**
 * Authentication and Authorization Types
 *
 * Core types for user sessions, authentication tokens, and role-based access control.
 *
 * @module @heady/types
 */

/**
 * User role
 */
export type UserRole = 'admin' | 'user' | 'editor' | 'viewer' | 'guest' | 'service';

/**
 * User permission
 */
export type UserPermission =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'moderate'
  | 'audit';

/**
 * User information
 */
export interface User {
  /**
   * Unique user ID
   */
  id: string;

  /**
   * Email address
   */
  email: string;

  /**
   * Display name
   */
  displayName: string;

  /**
   * Avatar URL
   */
  avatar?: string;

  /**
   * User status
   */
  status: 'active' | 'inactive' | 'suspended' | 'deleted';

  /**
   * User roles
   */
  roles: UserRole[];

  /**
   * User permissions
   */
  permissions?: UserPermission[];

  /**
   * Multi-factor authentication enabled
   */
  mfaEnabled: boolean;

  /**
   * User metadata
   */
  metadata?: {
    lastLogin?: Date;
    loginCount?: number;
    createdAt: Date;
    updatedAt: Date;
  };

  /**
   * Organization/team ID
   */
  organizationId?: string;
}

/**
 * Session information
 */
export interface Session {
  /**
   * Unique session ID (32-char hex)
   */
  id: string;

  /**
   * Associated user
   */
  user: User;

  /**
   * Session status
   */
  status: 'active' | 'expired' | 'revoked';

  /**
   * Session creation time
   */
  createdAt: Date;

  /**
   * Session expiry time
   */
  expiresAt: Date;

  /**
   * Last activity time
   */
  lastActivityAt: Date;

  /**
   * Device fingerprint
   */
  deviceFingerprint?: string;

  /**
   * Session IP address
   */
  ipAddress?: string;

  /**
   * Session user agent
   */
  userAgent?: string;

  /**
   * Session metadata
   */
  metadata?: {
    device?: string;
    location?: string;
    browser?: string;
  };
}

/**
 * Authentication token (JWT)
 */
export interface AuthToken {
  /**
   * Token type (Bearer)
   */
  type: 'Bearer';

  /**
   * JWT token string
   */
  token: string;

  /**
   * Token expiry time
   */
  expiresAt: Date;

  /**
   * Remaining time in seconds
   */
  expiresIn: number;

  /**
   * Token scopes
   */
  scopes?: string[];

  /**
   * Refresh token (if applicable)
   */
  refreshToken?: string;
}

/**
 * JWT claims
 */
export interface JWTClaims {
  /**
   * Subject (user ID)
   */
  sub: string;

  /**
   * User email
   */
  email?: string;

  /**
   * User roles
   */
  roles?: UserRole[];

  /**
   * Session ID
   */
  sessionId?: string;

  /**
   * Issued at
   */
  iat: number;

  /**
   * Expiry time
   */
  exp: number;

  /**
   * Token use (access, refresh, etc.)
   */
  use?: 'access' | 'refresh' | 'id';

  /**
   * Additional claims
   */
  [key: string]: any;
}

/**
 * API key information
 */
export interface ApiKey {
  /**
   * Key ID
   */
  id: string;

  /**
   * Key value (hashed)
   */
  hash: string;

  /**
   * Key name
   */
  name: string;

  /**
   * Associated user/service
   */
  ownerId: string;

  /**
   * Key scopes
   */
  scopes: string[];

  /**
   * Key status
   */
  status: 'active' | 'revoked' | 'expired';

  /**
   * Creation time
   */
  createdAt: Date;

  /**
   * Expiry time
   */
  expiresAt?: Date;

  /**
   * Last used time
   */
  lastUsedAt?: Date;

  /**
   * Usage count
   */
  usageCount: number;
}

/**
 * Credentials
 */
export interface Credentials {
  /**
   * Email or username
   */
  email: string;

  /**
   * Password (plain text, should be sent over HTTPS only)
   */
  password: string;

  /**
   * Optional MFA token
   */
  mfaToken?: string;

  /**
   * Device fingerprint
   */
  deviceFingerprint?: string;

  /**
   * Remember me flag
   */
  rememberMe?: boolean;
}

/**
 * MFA configuration
 */
export interface MFAConfig {
  /**
   * MFA enabled
   */
  enabled: boolean;

  /**
   * MFA methods
   */
  methods: MFAMethod[];

  /**
   * Backup codes generated
   */
  backupCodesGenerated: boolean;

  /**
   * Setup time
   */
  setupAt?: Date;
}

/**
 * MFA method
 */
export type MFAMethod = 'totp' | 'sms' | 'email' | 'webauthn';

/**
 * MFA challenge
 */
export interface MFAChallenge {
  /**
   * Challenge ID
   */
  id: string;

  /**
   * Challenge method
   */
  method: MFAMethod;

  /**
   * Challenge data (encoded)
   */
  data?: string;

  /**
   * Time-based OTP window
   */
  window?: {
    current: number;
    previous: number;
    next: number;
  };

  /**
   * Expiry time
   */
  expiresAt: Date;

  /**
   * Attempts remaining
   */
  attemptsRemaining: number;
}

/**
 * Login attempt
 */
export interface LoginAttempt {
  /**
   * Attempt ID
   */
  id: string;

  /**
   * User email
   */
  email: string;

  /**
   * Attempt status
   */
  status: 'success' | 'failed' | 'mfa_required';

  /**
   * Reason for failure
   */
  failureReason?: string;

  /**
   * IP address
   */
  ipAddress: string;

  /**
   * User agent
   */
  userAgent?: string;

  /**
   * Attempt timestamp
   */
  timestamp: Date;

  /**
   * Session created (if successful)
   */
  sessionId?: string;
}

/**
 * Access control list (ACL)
 */
export interface AccessControlList {
  /**
   * Resource identifier
   */
  resourceId: string;

  /**
   * Resource type
   */
  resourceType: string;

  /**
   * Owner ID
   */
  ownerId: string;

  /**
   * ACL entries
   */
  entries: ACLEntry[];

  /**
   * Public access level
   */
  public?: 'none' | 'read' | 'write';

  /**
   * Last modified
   */
  updatedAt: Date;
}

/**
 * ACL entry
 */
export interface ACLEntry {
  /**
   * Principal ID (user or group)
   */
  principalId: string;

  /**
   * Principal type
   */
  principalType: 'user' | 'group' | 'service';

  /**
   * Granted permissions
   */
  permissions: UserPermission[];

  /**
   * Grant timestamp
   */
  grantedAt: Date;

  /**
   * Granted by user ID
   */
  grantedBy?: string;

  /**
   * Expiry time
   */
  expiresAt?: Date;
}

/**
 * Authorization context
 */
export interface AuthorizationContext {
  /**
   * Principal (user/service)
   */
  principal: {
    id: string;
    type: 'user' | 'service';
    roles: UserRole[];
  };

  /**
   * Resource being accessed
   */
  resource: {
    id: string;
    type: string;
    ownerId: string;
  };

  /**
   * Action being performed
   */
  action: string;

  /**
   * Request context
   */
  context: {
    timestamp: Date;
    ipAddress?: string;
    sessionId?: string;
    requestId?: string;
  };
}

/**
 * Authorization decision
 */
export interface AuthorizationDecision {
  /**
   * Decision result (Allow/Deny)
   */
  result: 'allow' | 'deny';

  /**
   * Reason for decision
   */
  reason: string;

  /**
   * Policy that matched
   */
  policy?: string;

  /**
   * Applicable conditions
   */
  conditions?: Record<string, boolean>;
}
