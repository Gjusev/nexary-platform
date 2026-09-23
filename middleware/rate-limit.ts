/**
 * Rate Limiting Middleware
 *
 * Implements distributed rate limiting using Redis
 * Protects API endpoints from abuse and DDoS attacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export interface RateLimitConfig {
  // Maximum number of requests allowed
  limit: number;
  // Time window in seconds
  window: number;
  // Unique identifier for the rate limit (e.g., 'api', 'upload')
  keyPrefix: string;
  // Whether to skip rate limiting for certain conditions
  skip?: (req: NextRequest) => boolean | Promise<boolean>;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Rate limit middleware using Redis
 */
export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Check if we should skip rate limiting
  if (config.skip && await config.skip(req)) {
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      reset: Math.ceil(Date.now() / 1000) + config.window,
    };
  }

  // Get identifier (IP address or user ID)
  const identifier = await getIdentifier(req);
  const key = `ratelimit:${config.keyPrefix}:${identifier}`;

  try {
    // Get current count from Redis
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    // Check if limit exceeded
    if (count >= config.limit) {
      // Get TTL for retry-after header
      const ttl = await redis.pttl(key);

      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: Math.ceil(Date.now() / 1000) + (ttl / 1000),
        retryAfter: Math.ceil(ttl / 1000),
      };
    }

    // Increment counter
    const newCount = count + 1;

    if (count === 0) {
      // First request - set with expiration
      await redis.set(key, newCount.toString(), 'PX', config.window * 1000);
    } else {
      // Increment existing counter
      await redis.incr(key);
    }

    // Get remaining TTL
    const ttl = await redis.pttl(key);

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - newCount,
      reset: Math.ceil(Date.now() / 1000) + (ttl / 1000),
    };
  } catch (error) {
    // On Redis error, allow request (fail open)
    console.error('Rate limit error:', error);
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      reset: Math.ceil(Date.now() / 1000) + config.window,
    };
  }
}

/**
 * Get identifier for rate limiting
 * Priority: User ID > IP address
 */
async function getIdentifier(req: NextRequest): Promise<string> {
  // Try to get user ID from session/token
  const token = req.cookies.get('next-auth.session-token')?.value;
  if (token) {
    return `user:${token}`;
  }

  // Fall back to IP address
  const ip = getClientIP(req);
  return `ip:${ip}`;
}

/**
 * Extract client IP from request
 */
function getClientIP(req: NextRequest): string {
  // Check various headers for IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Return unknown if no IP found
  return 'unknown';
}

/**
 * Create rate limit middleware with specific config
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (req: NextRequest) => {
    const result = await rateLimit(req, config);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': (result.retryAfter || 60).toString(),
          },
        }
      );
    }

    // Add rate limit headers to successful response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());

    return response;
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimits = {
  // API endpoints: 100 requests per minute
  api: {
    limit: 100,
    window: 60,
    keyPrefix: 'api',
  },

  // Chat endpoint: 20 requests per minute
  chat: {
    limit: 20,
    window: 60,
    keyPrefix: 'chat',
  },

  // RAG search: 30 requests per minute
  rag: {
    limit: 30,
    window: 60,
    keyPrefix: 'rag',
  },

  // Document upload: 5 requests per minute
  upload: {
    limit: 5,
    window: 60,
    keyPrefix: 'upload',
  },

  // Authentication: 10 requests per 5 minutes
  auth: {
    limit: 10,
    window: 300,
    keyPrefix: 'auth',
  },

  // Public endpoints: 20 requests per minute
  public: {
    limit: 20,
    window: 60,
    keyPrefix: 'public',
  },
} as const;
