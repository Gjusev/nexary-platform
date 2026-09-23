/**
 * Environment variable validation using Zod.
 *
 * Validates all required and optional environment variables at startup.
 * Throws an error if required variables are missing or invalid.
 */

import { z } from 'zod';

/**
 * Schema for environment variables.
 *
 * Required variables will cause startup failure if missing.
 * Optional variables can be omitted but will be validated if present.
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // Database (Required)
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Redis (Optional)
  REDIS_URL: z.string().url().optional(),

  // Stack Auth (Required)
  NEXT_PUBLIC_STACK_PROJECT_ID: z.string().min(1, 'STACK_PROJECT_ID is required'),
  NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: z.string().min(1, 'STACK_PUBLISHABLE_CLIENT_KEY is required'),
  STACK_SECRET_SERVER_KEY: z.string().min(1, 'STACK_SECRET_SERVER_KEY is required'),
  STACK_INTERNAL_API_URL: z.string().url().default('https://api.stack-auth.com'),

  // Legacy Stack Auth (Optional, deprecated)
  STACK_AUTH_API_URL: z.string().url().optional(),
  STACK_AUTH_PROJECT_ID: z.string().optional(),
  STACK_AUTH_API_KEY: z.string().optional(),

  // AI Providers - At least one required
  OPENAI_API_KEY: z.string().min(1).optional(),
  GOOGLE_API_KEY: z.string().min(1).optional(),
  MISTRAL_API_KEY: z.string().min(1).optional(),

  // Mistral OCR (Optional)
  MISTRAL_OCR_ENDPOINT: z.string().url().optional(),
  MISTRAL_OCR_API_KEY: z.string().optional(),

  // Qdrant Vector Database (Optional - uses in-memory if not provided)
  QDRANT_URL: z.string().url().optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_VECTOR_SIZE: z.coerce.number().int().positive().default(3072),
  QDRANT_DISTANCE: z.enum(['Cosine', 'Euclid', 'Dot']).default('Cosine'),

  // MinIO Object Storage (Optional)
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_BUCKET: z.string().default('projectnexus'),

  // OCR Microservice (Optional)
  OCR_MICROSERVICE_URL: z.string().url().optional(),
  APP_API_KEY: z.string().optional(),

  // CORS (Optional)
  CORS_ORIGIN: z.string().optional(),
}).refine(
  (data) => {
    // At least one AI provider must be configured
    return !!(data.OPENAI_API_KEY || data.GOOGLE_API_KEY || data.MISTRAL_API_KEY);
  },
  {
    message: 'At least one AI provider API key must be configured (OPENAI_API_KEY, GOOGLE_API_KEY, or MISTRAL_API_KEY)',
  }
);

/**
 * Type-safe environment variables.
 */
export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Validates and returns environment variables.
 *
 * This function should be called at application startup to ensure
 * all required environment variables are present and valid.
 *
 * @returns Validated environment variables
 * @throws Error if validation fails
 *
 * @example
 * ```ts
 * import { getEnv } from '@/lib/config/env';
 *
 * // Validate env at startup
 * const env = getEnv();
 *
 * // Use env variables with type safety
 * const dbUrl = env.DATABASE_URL;
 * ```
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    const parsed = envSchema.parse(process.env);
    cachedEnv = parsed;

    // Log warnings for optional but recommended missing variables
    if (!parsed.REDIS_URL) {
      console.warn('⚠️ REDIS_URL not configured. Caching will be disabled.');
    }
    if (!parsed.QDRANT_URL) {
      console.warn('⚠️ QDRANT_URL not configured. Vector search will use in-memory fallback.');
    }

    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => {
        const path = e.path.join('.');
        return `  - ${path}: ${e.message}`;
      }).join('\n');

      throw new Error(
        `❌ Invalid environment variables:\n${missingVars}\n\n` +
        'Please check your .env file configuration.'
      );
    }
    throw error;
  }
}

/**
 * Gets a specific environment variable with type safety.
 *
 * @param key - Environment variable key
 * @returns Environment variable value
 *
 * @example
 * ```ts
 * import { getEnvVar } from '@/lib/config/env';
 *
 * const apiKey = getEnvVar('OPENAI_API_KEY');
 * ```
 */
export function getEnvVar<K extends keyof Env>(key: K): Env[K] {
  const env = getEnv();
  return env[key];
}

/**
 * Checks if all required environment variables are set.
 * Useful for health checks and startup validation.
 *
 * @returns true if all required variables are present
 */
export function validateEnvSilently(): boolean {
  try {
    getEnv();
    return true;
  } catch {
    return false;
  }
}
