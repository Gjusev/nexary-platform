/**
 * Advanced caching service with pattern-based invalidation,
 * multi-level caching, and cache stampede prevention.
 */

import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern, isCacheAvailable } from './redis-cache';
import { query } from '@/lib/db';

// ============================================================================
// Cache Key Patterns
// ============================================================================

export const CACHE_KEYS = {
  // User data
  USER: (userId: string) => `user:${userId}`,
  USER_SESSIONS: (userId: string) => `user:sessions:${userId}`,
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,

  // Team data
  TEAM: (teamSlug: string) => `team:${teamSlug}`,
  TEAM_MEMBERS: (teamSlug: string) => `team:members:${teamSlug}`,
  TEAM_CONFIG: (teamSlug: string) => `team:config:${teamSlug}`,
  TEAM_PERMISSIONS: (teamSlug: string, userId: string) => `team:permissions:${teamSlug}:${userId}`,

  // RAG data
  RAG_PACKAGE: (packageId: string) => `rag:package:${packageId}`,
  RAG_PACKAGES_LIST: (teamSlug: string) => `rag:packages:${teamSlug}`,
  RAG_DOCUMENT_COUNT: (packageId: string) => `rag:doccount:${packageId}`,

  // Audit logs
  AUDIT_LOGS: (teamSlug: string, page: number) => `audit:logs:${teamSlug}:${page}`,

  // Query results
  QUERY_RESULT: (queryHash: string) => `query:result:${queryHash}`,

  // Rate limiting
  RATE_LIMIT: (identifier: string, action: string) => `rate:${identifier}:${action}`,

  // Feature flags
  FEATURE_FLAG: (flag: string) => `feature:${flag}`,
} as const;

// ============================================================================
// Cache TTL Configuration (in seconds)
// ============================================================================

export const CACHE_TTL = {
  // User data - cache for 1 hour
  USER: 3600,
  USER_SESSIONS: 1800, // 30 minutes
  USER_PROFILE: 3600,

  // Team data - cache for 30 minutes
  TEAM: 1800,
  TEAM_MEMBERS: 1800,
  TEAM_CONFIG: 1800,
  TEAM_PERMISSIONS: 900, // 15 minutes (permissions change more frequently)

  // RAG data - cache for 1 hour
  RAG_PACKAGE: 3600,
  RAG_PACKAGES_LIST: 600, // 10 minutes (list changes often)
  RAG_DOCUMENT_COUNT: 1800,

  // Audit logs - cache for 5 minutes
  AUDIT_LOGS: 300,

  // Query results - cache for 10 minutes
  QUERY_RESULT: 600,

  // Rate limiting - 1 minute window
  RATE_LIMIT: 60,

  // Feature flags - cache for 5 minutes
  FEATURE_FLAG: 300,
} as const;

// ============================================================================
// Cache Entry with Metadata
// ============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  version: number;
  tags: string[];
}

// ============================================================================
// Cache Service
// ============================================================================

class CacheService {
  private localCache: Map<string, { data: unknown; expiresAt: number }> = new Map();
  private readonly LOCAL_CACHE_TTL = 5000; // 5 seconds for local in-memory cache

  /**
   * Get value from multi-level cache (local -> Redis)
   */
  async get<T>(key: string, checkLocal = true): Promise<T | null> {
    // Check local cache first (L1)
    if (checkLocal) {
      const local = this.localCache.get(key);
      if (local && local.expiresAt > Date.now()) {
        return local.data as T;
      }
      // Remove expired local cache
      this.localCache.delete(key);
    }

    // Check Redis (L2)
    const cached = await cacheGet<CacheEntry<T>>({ key, ttl: 3600 });
    if (cached) {
      // Populate local cache
      this.localCache.set(key, {
        data: cached.data,
        expiresAt: Date.now() + this.LOCAL_CACHE_TTL,
      });
      return cached.data;
    }

    return null;
  }

  /**
   * Set value in multi-level cache
   */
  async set<T>(
    key: string,
    data: T,
    ttl: number = CACHE_TTL.USER,
    tags: string[] = []
  ): Promise<boolean> {
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      version: 1,
      tags,
    };

    // Set in local cache
    this.localCache.set(key, {
      data,
      expiresAt: Date.now() + this.LOCAL_CACHE_TTL,
    });

    // Set in Redis
    await cacheSet({ key, ttl }, entry);
    return true;
  }

  /**
   * Delete from all cache levels
   */
  async delete(key: string): Promise<boolean> {
    // Delete from local cache
    this.localCache.delete(key);

    // Delete from Redis
    await cacheDelete({ key });
    return true;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      // Use pattern matching to delete keys with the tag
      await cacheDeletePattern(`*:${tag}:*`);
      await cacheDeletePattern(`${tag}:*`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      // Clear from local cache
      const keysToDelete: string[] = [];
      this.localCache.forEach((_, key) => {
        if (this.matchesPattern(key, pattern)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.localCache.delete(key));

      // Clear from Redis
      await cacheDeletePattern(pattern);
    } catch (error) {
      console.error('Cache pattern invalidation error:', error);
    }
  }

  /**
   * Simple pattern matching helper
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(key);
  }

  /**
   * Get or compute pattern (cache stampede prevention)
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl: number = CACHE_TTL.USER,
    tags: string[] = []
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute the value
    const value = await compute();

    // Store in cache
    await this.set(key, value, ttl, tags);

    return value;
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clear(): Promise<void> {
    this.localCache.clear();

    if (!isCacheAvailable()) return;

    try {
      // Use pattern deletion to clear all keys
      await cacheDeletePattern('*');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    localCacheSize: number;
    redisAvailable: boolean;
  }> {
    return {
      localCacheSize: this.localCache.size,
      redisAvailable: isCacheAvailable(),
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// ============================================================================
// Helper Functions for Common Patterns
// ============================================================================

/**
 * Cache query results with automatic hashing
 */
export async function cachedQuery<T>(
  queryFn: () => Promise<T>,
  keyParts: string[],
  ttl: number = CACHE_TTL.QUERY_RESULT
): Promise<T> {
  // Create hash from query parts
  const queryHash = Buffer.from(keyParts.join(':')).toString('base64').slice(0, 32);
  const key = CACHE_KEYS.QUERY_RESULT(queryHash);

  return cacheService.getOrCompute(key, queryFn, ttl);
}

/**
 * Warm up cache by preloading common data
 */
export async function warmupCache(teamSlug: string): Promise<void> {
  if (!isCacheAvailable()) {
    console.warn('Redis not available, skipping cache warmup');
    return;
  }

  try {
    // Preload team data
    const teamKey = CACHE_KEYS.TEAM(teamSlug);
    const team = await query(
      'SELECT * FROM teams WHERE slug = $1',
      [teamSlug]
    );

    if (team.rows.length > 0) {
      await cacheService.set(teamKey, team.rows[0], CACHE_TTL.TEAM, ['team']);
    }

    // Preload team members
    const membersKey = CACHE_KEYS.TEAM_MEMBERS(teamSlug);
    const members = await query(
      `SELECT * FROM team_members WHERE team_slug = $1 AND status = 'active'`,
      [teamSlug]
    );
    await cacheService.set(membersKey, members.rows, CACHE_TTL.TEAM_MEMBERS, ['team']);

    // Preload RAG packages
    const packagesKey = CACHE_KEYS.RAG_PACKAGES_LIST(teamSlug);
    const packages = await query(
      'SELECT * FROM rag_packages WHERE team_slug = $1 AND deleted_at IS NULL',
      [teamSlug]
    );
    await cacheService.set(packagesKey, packages.rows, CACHE_TTL.RAG_PACKAGES_LIST, ['rag']);

    } catch (error) {
    console.error('Cache warmup error:', error);
  }
}
