import path from 'node:path';

export function parseOrigins(raw) {
  if (!raw) return [];
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

export function resolveDataDir(env = process.env) {
  const configured = env.HEADY_DATA_DIR || './data';
  return path.resolve(process.cwd(), configured);
}

export function getConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const defaultOrigins = nodeEnv === 'production'
    ? []
    : ['http://localhost:3400', 'http://127.0.0.1:3400'];
  const origins = parseOrigins(env.CORS_ORIGINS);

  return {
    port: Number(env.PORT || 3400),
    nodeEnv,
    jwtSecret: env.JWT_SECRET || 'change-this-in-production',
    origins: origins.length > 0 ? origins : defaultOrigins,
    databaseUrl: env.DATABASE_URL || '',
    dataDir: resolveDataDir(env),
    autoPromoteFirstUser: String(env.HEADY_OWNER_AUTO_PROMOTE_FIRST_USER || 'true') !== 'false'
  };
}
