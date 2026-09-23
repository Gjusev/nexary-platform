import { LRUCache } from 'lru-cache';
import { getRedisClient } from './redis';

type RateLimitOptions = {
  uniqueTokenPerInterval?: number;
  interval?: number;
  limit?: number;
};

export class RateLimiter {
  private tokenCache: LRUCache<string, number[]>;
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = options;
    this.tokenCache = new LRUCache({
      max: options.uniqueTokenPerInterval || 500,
      ttl: options.interval || 60000,
    });
  }

  async check(token: string, limit: number): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const client = getRedisClient();
    const interval = this.options.interval || 60000;

    if (client) {
      try {
        const key = `rate-limit:${token}`;
        const currentUsage = await client.incr(key);

        if (currentUsage === 1) {
          await client.expire(key, Math.ceil(interval / 1000));
        }

        const remaining = Math.max(0, limit - currentUsage);
        const reset = Date.now() + interval;

        return {
          success: currentUsage <= limit,
          limit,
          remaining,
          reset
        };
      } catch (error) {
        console.error('Redis rate limit error, falling back to LRU:', error);
        // Fallback to LRU
      }
    }

    // LRU Fallback
    const tokenCount = (this.tokenCache.get(token) as number[]) || [0];
    const currentTime = Date.now();

    // Reset if expired (LRU ttl handles expiration but we need manual reset/increment logic if we want strict window)
    // Actually LRUCache TTL removes the item. So if it exists, it's valid.

    if (tokenCount[0] === 0) {
      this.tokenCache.set(token, [1]);
      tokenCount[0] = 1;
    } else {
      tokenCount[0] += 1;
      this.tokenCache.set(token, tokenCount);
    }

    const currentUsage = tokenCount[0];
    const remaining = Math.max(0, limit - currentUsage);

    return {
      success: currentUsage <= limit,
      limit,
      remaining,
      reset: currentTime + interval
    };
  }
}

// 100 requests per hour for Chat
export const chatRateLimiter = new RateLimiter({
  uniqueTokenPerInterval: 500,
  interval: 3600000, // 1 hour
});

// 30 requests per minute for Auth
export const authRateLimiter = new RateLimiter({
  uniqueTokenPerInterval: 500,
  interval: 60000, // 1 minute
});

// 50 requests per hour for Registration
export const registrationRateLimiter = new RateLimiter({
  uniqueTokenPerInterval: 500,
  interval: 3600000, // 1 hour
});

// 10 requests per hour for Team Creation
export const teamCreationRateLimiter = new RateLimiter({
  uniqueTokenPerInterval: 100,
  interval: 3600000, // 1 hour
});

// Helper to get client IP
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}
