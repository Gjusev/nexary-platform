/**
 * Centralized Redis caching layer.
 *
 * Provides type-safe caching operations with automatic serialization.
 * Falls back to no-op functions if Redis is not configured.
 */

import { getEnv } from '@/lib/config/env';

// Redis client (lazily initialized)
let redisClient: any | null = null;
let redisAvailable = false;

/**
 * Cache options.
 */
export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Cache key */
  key: string;
}

/**
 * Initialize Redis client.
 */
async function initRedis(): Promise<void> {
  if (redisClient !== null) {
    return; // Already initialized
  }

  try {
    const env = getEnv();

    if (!env.REDIS_URL) {
      console.warn('⚠️ Redis not configured. Caching will be disabled.');
      redisAvailable = false;
      return;
    }

    // Dynamic import to avoid import errors if ioredis is not installed
    const Redis = (await import('ioredis')).default;

    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (err: Error) => {
      console.error('Redis error:', err);
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
    });

    // Test connection
    await redisClient.ping();
    redisAvailable = true;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    redisClient = null;
    redisAvailable = false;
  }
}

/**
 * Ensures Redis is initialized before operations.
 */
async function ensureRedis(): Promise<void> {
  if (redisClient === null) {
    await initRedis();
  }
}

/**
 * Get a value from cache.
 *
 * @param options - Cache options
 * @returns Cached value or null if not found
 *
 * @example
 * ```ts
 * const user = await cacheGet<User>({ key: 'user:123', ttl: 3600 });
 * ```
 */
export async function cacheGet<T>(options: CacheOptions): Promise<T | null> {
  await ensureRedis();

  if (!redisAvailable || !redisClient) {
    return null;
  }

  try {
    const cached = await redisClient.get(options.key);
    if (!cached) {
      return null;
    }
    return JSON.parse(cached) as T;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set a value in cache.
 *
 * @param options - Cache options
 * @param value - Value to cache (will be JSON serialized)
 *
 * @example
 * ```ts
 * await cacheSet({ key: 'user:123', ttl: 3600 }, user);
 * ```
 */
export async function cacheSet<T>(options: CacheOptions, value: T): Promise<void> {
  await ensureRedis();

  if (!redisAvailable || !redisClient) {
    return;
  }

  try {
    const ttl = options.ttl || 3600; // Default 1 hour
    await redisClient.setex(options.key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Delete a value from cache.
 *
 * @param options - Cache options
 *
 * @example
 * ```ts
 * await cacheDelete({ key: 'user:123' });
 * ```
 */
export async function cacheDelete(options: CacheOptions): Promise<void> {
  await ensureRedis();

  if (!redisAvailable || !redisClient) {
    return;
  }

  try {
    await redisClient.del(options.key);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Delete all keys matching a pattern.
 *
 * @param pattern - Key pattern (supports wildcards)
 *
 * @example
 * ```ts
 * await cacheDeletePattern('user:*');
 * ```
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  await ensureRedis();

  if (!redisAvailable || !redisClient) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (error) {
    console.error('Cache delete pattern error:', error);
  }
}

/**
 * Get or set pattern - fetch from cache or compute and store.
 *
 * @param options - Cache options
 * @param factory - Function to compute value if not cached
 * @returns Cached or computed value
 *
 * @example
 * ```ts
 * const user = await cacheGetOrElse(
 *   { key: 'user:123', ttl: 3600 },
 *   () => fetchUserFromDb(123)
 * );
 * ```
 */
export async function cacheGetOrElse<T>(
  options: CacheOptions,
  factory: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(options);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  await cacheSet(options, value);
  return value;
}

/**
 * Check if Redis is available.
 *
 * @returns true if Redis is connected and available
 */
export function isCacheAvailable(): boolean {
  return redisAvailable;
}

/**
 * Close Redis connection.
 * Useful for cleanup during shutdown.
 */
export async function closeCache(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisAvailable = false;
  }
}
