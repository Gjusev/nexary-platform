/**
 * Rate limiting middleware to prevent abuse of API endpoints.
 *
 * Uses in-memory storage for rate limits. For production,
 * consider using Redis-based rate limiting with @upstash/ratelimit.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleans up expired entries from the rate limit store.
 * Should be called periodically to prevent memory leaks.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  });
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * Rate limiting options.
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Identifier for the rate limit (e.g., 'admin-api') */
  prefix: string;
}

/**
 * Rate limit result.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp when the limit resets */
  resetTime: number;
}

/**
 * Checks if a request should be rate limited.
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param options - Rate limiting options
 * @returns Rate limit result
 */
export function checkRateLimit(identifier: string, options: RateLimitOptions): RateLimitResult {
  const key = `${options.prefix}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // If no entry exists or window has expired, create a new one
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    rateLimitStore.set(key, entry);
    return {
      success: true,
      remaining: options.limit - 1,
      resetTime: entry.resetTime,
    };
  }

  // Increment counter
  entry.count++;

  if (entry.count > options.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    success: true,
    remaining: options.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Resets the rate limit for a specific identifier.
 * Useful for testing or administrative purposes.
 *
 * @param prefix - Rate limit prefix
 * @param identifier - Identifier to reset
 */
export function resetRateLimit(prefix: string, identifier: string): void {
  const key = `${prefix}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Pre-configured rate limiters for common use cases.
 */
export const RateLimiters = {
  /** Admin API endpoints: 10 requests per hour */
  adminApi: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    prefix: 'admin-api',
  },
  /** Regular API endpoints: 100 requests per minute */
  api: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'api',
  },
  /** Authentication endpoints: 5 requests per minute */
  auth: {
    limit: 5,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'auth',
  },
  /** File upload: 10 requests per 5 minutes */
  upload: {
    limit: 10,
    windowMs: 5 * 60 * 1000, // 5 minutes
    prefix: 'upload',
  },
  /** Chat endpoints: 60 requests per minute (1 per second) */
  chat: {
    limit: 60,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'chat',
  },
  /** RAG endpoints: 30 requests per minute */
  rag: {
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'rag',
  },
  /** Documents endpoints: 40 requests per minute */
  documents: {
    limit: 40,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'documents',
  },
  /** Team endpoints: 20 requests per minute */
  team: {
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'team',
  },
} as const;
