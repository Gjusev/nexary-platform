/**
 * Tests for middleware/rate-limit.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit, RateLimits, createRateLimitMiddleware } from '../middleware/rate-limit';

// Mock redis
vi.mock('../lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    pttl: vi.fn(),
    del: vi.fn(),
  },
}));

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rateLimit function', () => {
    it('should allow requests under the limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      const result = await rateLimit(request, RateLimits.api);

      expect(result.success).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should return correct rate limit headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      const result = await rateLimit(request, RateLimits.api);

      expect(result.limit).toBe(100);
      expect(result).toHaveProperty('reset');
    });

    it('should handle different rate limit configurations', async () => {
      const request = new NextRequest('http://localhost:3000/api/test');

      const apiResult = await rateLimit(request, RateLimits.api);
      expect(apiResult.limit).toBe(100);

      const chatResult = await rateLimit(request, RateLimits.chat);
      expect(chatResult.limit).toBe(20);

      const uploadResult = await rateLimit(request, RateLimits.upload);
      expect(uploadResult.limit).toBe(5);
    });
  });

  describe('RateLimits presets', () => {
    it('should have correct API rate limits', () => {
      expect(RateLimits.api.limit).toBe(100);
      expect(RateLimits.api.window).toBe(60);
      expect(RateLimits.api.keyPrefix).toBe('api');
    });

    it('should have correct chat rate limits', () => {
      expect(RateLimits.chat.limit).toBe(20);
      expect(RateLimits.chat.window).toBe(60);
      expect(RateLimits.chat.keyPrefix).toBe('chat');
    });

    it('should have correct upload rate limits', () => {
      expect(RateLimits.upload.limit).toBe(5);
      expect(RateLimits.upload.window).toBe(60);
      expect(RateLimits.upload.keyPrefix).toBe('upload');
    });

    it('should have correct auth rate limits', () => {
      expect(RateLimits.auth.limit).toBe(10);
      expect(RateLimits.auth.window).toBe(300);
      expect(RateLimits.auth.keyPrefix).toBe('auth');
    });
  });

  describe('createRateLimitMiddleware', () => {
    it('should create a middleware function', () => {
      const middleware = createRateLimitMiddleware(RateLimits.api);
      expect(typeof middleware).toBe('function');
    });
  });
});
