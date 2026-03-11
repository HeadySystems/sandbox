import pino from 'pino';

export const logger = pino({
  name: 'heady-observability-client',
  level: process.env.LOG_LEVEL ?? 'info',
  base: undefined,
});

export function logEvent(event: string, payload: Record<string, unknown>) {
  logger.info({ event, ...payload });
}

export function logError(event: string, error: unknown, payload: Record<string, unknown> = {}) {
  logger.error({ event, error, ...payload });
}
