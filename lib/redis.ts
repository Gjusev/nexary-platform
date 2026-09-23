import Redis from 'ioredis';

// Redis client singleton
let redisClient: Redis | null = null;

/**
 * Get Redis client instance (singleton pattern)
 */
export function getRedisClient(): Redis | null {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.warn('⚠️ REDIS_URL not configured, caching disabled');
        return null;
    }

    if (!redisClient) {
        try {
            redisClient = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                retryStrategy(times) {
                    if (times > 3) {
                        console.error('❌ Redis connection failed after 3 retries');
                        return null;
                    }
                    return Math.min(times * 100, 3000);
                },
                lazyConnect: true,
            });

            redisClient.on('error', (err) => {
                console.error('❌ Redis error:', err.message);
            });

            redisClient.on('connect', () => {
                });
        } catch (error) {
            console.error('❌ Failed to create Redis client:', error);
            return null;
        }
    }

    return redisClient;
}

/**
 * Get cached value from Redis
 */
export async function getCached<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
        const value = await client.get(key);
        if (value) {
            return JSON.parse(value) as T;
        }
    } catch (error) {
        console.error('Redis get error:', error);
    }

    return null;
}

/**
 * Set cached value in Redis with TTL
 */
export async function setCached(
    key: string,
    value: unknown,
    ttlSeconds: number = 3600 // Default 1 hour
): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
        await client.setex(key, ttlSeconds, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Redis set error:', error);
        return false;
    }
}

/**
 * Delete cached value from Redis
 */
export async function deleteCached(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
        await client.del(key);
        return true;
    } catch (error) {
        console.error('Redis delete error:', error);
        return false;
    }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
        await client.ping();
        return true;
    } catch {
        return false;
    }
}

/**
 * Default Redis client instance for direct access
 * This provides compatibility with code that expects a `redis` export
 */
export const redis = {
  get: async (key: string) => {
    const client = getRedisClient();
    if (!client) return null;
    return client.get(key);
  },
  set: async (key: string, value: string, mode: 'EX' | 'PX', ttl: number) => {
    const client = getRedisClient();
    if (!client) return;
    if (mode === 'EX') {
      return client.setex(key, ttl, value);
    } else {
      return client.set(key, value, 'PX', ttl);
    }
  },
  del: async (...keys: string[]) => {
    const client = getRedisClient();
    if (!client) return 0;
    return client.del(...keys);
  },
  keys: async (pattern: string) => {
    const client = getRedisClient();
    if (!client) return [];
    return client.keys(pattern);
  },
  mget: async (...keys: string[]) => {
    const client = getRedisClient();
    if (!client) return [];
    return client.mget(...keys);
  },
  incr: async (key: string) => {
    const client = getRedisClient();
    if (!client) return 0;
    return client.incr(key);
  },
  pttl: async (key: string) => {
    const client = getRedisClient();
    if (!client) return -2;
    return client.pttl(key);
  },
  multi: () => {
    const client = getRedisClient();
    if (!client) {
      return {
        set: () => ({} as any),
        exec: async () => []
      } as any;
    }
    return client.multi();
  },
  // Additional methods for session management (§203 StGB)
  setex: async (key: string, seconds: number, value: string) => {
    const client = getRedisClient();
    if (!client) return;
    return client.setex(key, seconds, value);
  },
  smembers: async (key: string) => {
    const client = getRedisClient();
    if (!client) return [];
    return client.smembers(key);
  },
  sadd: async (key: string, ...members: string[]) => {
    const client = getRedisClient();
    if (!client) return 0;
    return client.sadd(key, ...members);
  },
  srem: async (key: string, ...members: string[]) => {
    const client = getRedisClient();
    if (!client) return 0;
    return client.srem(key, ...members);
  },
  expire: async (key: string, seconds: number) => {
    const client = getRedisClient();
    if (!client) return 0;
    return client.expire(key, seconds);
  }
};
