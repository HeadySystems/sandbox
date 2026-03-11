import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  HEADY_ENV: z.string().default('dev'),
  LOG_LEVEL: z.string().default('info'),
  PORT: z.coerce.number().int().positive(),
});

export const PipelineRunSchema = z.object({
  taskId: z.string(),
  intent: z.string(),
  requiresEvaluation: z.boolean().default(false),
  requiresConfidence: z.boolean().default(false),
});

export const ProviderRequestSchema = z.object({
  model: z.string(),
  prompt: z.string(),
  timeoutMs: z.coerce.number().int().positive().default(4236),
});
