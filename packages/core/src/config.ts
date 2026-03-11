import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const BaseServiceConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  PORT: z.coerce.number().default(3000),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0)
});

export type BaseServiceConfig = z.infer<typeof BaseServiceConfigSchema>;

export function loadConfig<T extends z.ZodType>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid configuration:', result.error.format());
    throw new Error('Configuration validation failed');
  }

  return result.data;
}
