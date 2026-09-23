/**
 * Advanced Caching Strategies for RAG
 *
 * Implements intelligent caching with automatic invalidation
 * for RAG search results, embeddings, and queries
 */

import { redis } from '@/lib/redis';

// ============================================================================
// Cache Configuration
// ============================================================================

export interface CacheConfig {
  // TTL in seconds
  ttl: number;
  // Namespace for the cache key
  namespace: string;
  // Maximum number of entries
  maxSize?: number;
  // Whether to use stale-while-revalidate
  staleWhileRevalidate?: boolean;
  // Stale TTL (for stale-while-revalidate)
  staleTtl?: number;
}

export const CacheConfigs = {
  // RAG search results: 15 minutes
  ragSearch: {
    ttl: 900,
    namespace: 'rag:search',
    maxSize: 1000,
    staleWhileRevalidate: true,
    staleTtl: 3600, // 1 hour stale
  },

  // Embeddings: 24 hours (embeddings don't change)
  embeddings: {
    ttl: 86400,
    namespace: 'embeddings',
    maxSize: 10000,
  },

  // Document chunks: 1 hour
  documentChunks: {
    ttl: 3600,
    namespace: 'doc:chunks',
    maxSize: 5000,
  },

  // Query results: 30 minutes
  queryResults: {
    ttl: 1800,
    namespace: 'query:results',
    maxSize: 2000,
    staleWhileRevalidate: true,
    staleTtl: 7200,
  },

  // User sessions: 24 hours
  userSessions: {
    ttl: 86400,
    namespace: 'session',
    maxSize: 10000,
  },

  // Team data: 1 hour
  teamData: {
    ttl: 3600,
    namespace: 'team',
    maxSize: 1000,
  },

  // API rate limit: depends on window
  rateLimit: {
    ttl: 60,
    namespace: 'ratelimit',
    maxSize: 100000,
  },
} as const;

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate cache key with namespace and parameters
 */
export function generateCacheKey(
  namespace: string,
  identifier: string,
  params?: Record<string, unknown>
): string {
  const parts = [namespace, identifier];

  if (params) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    parts.push(paramString);
  }

  return parts.join(':');
}

/**
 * Generate cache key for RAG search
 */
export function generateRAGSearchKey(
  packageId: string,
  query: string,
  options?: {
    method?: string;
    limit?: number;
    alpha?: number;
  }
): string {
  return generateCacheKey(
    CacheConfigs.ragSearch.namespace,
    packageId,
    { query, ...options }
  );
}

/**
 * Generate cache key for embeddings
 */
export function generateEmbeddingKey(text: string): string {
  // Create hash of text for consistent key
  const hash = Buffer.from(text).toString('base64').substring(0, 32);
  return generateCacheKey(CacheConfigs.embeddings.namespace, hash);
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get value from cache with stale-while-revalidate
 */
export async function cacheGet<T>(
  key: string,
  config: CacheConfig
): Promise<T | null> {
  try {
    const value = await redis.get(key);

    if (!value) {
      return null;
    }

    // Check if value is stale
    const parsed = JSON.parse(value);
    if (parsed._stale && config.staleWhileRevalidate) {
      // Return stale value but trigger background refresh
      backgroundRefresh(key, config);
      return parsed.data as T;
    }

    return parsed.data as T;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set value in cache
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  config: CacheConfig
): Promise<void> {
  try {
    const data = {
      data: value,
      timestamp: Date.now(),
    };

    await redis.set(key, JSON.stringify(data), 'PX', config.ttl * 1000);

    // If stale-while-revalidate is enabled, set stale key
    if (config.staleWhileRevalidate && config.staleTtl) {
      const staleKey = `${key}:stale`;
      const staleData = { ...data, _stale: true };
      await redis.set(staleKey, JSON.stringify(staleData), 'PX', config.staleTtl * 1000);
    }
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Delete cache entry
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    await redis.del(key);
    await redis.del(`${key}:stale`);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Invalidate cache by pattern
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidate error:', error);
  }
}

// ============================================================================
// Specialized Cache Functions
// ============================================================================

/**
 * Cache RAG search results with automatic invalidation
 */
export async function cacheRAGSearch(
  packageId: string,
  query: string,
  results: unknown,
  options?: {
    method?: string;
    limit?: number;
    alpha?: number;
  }
): Promise<void> {
  const key = generateRAGSearchKey(packageId, query, options);
  await cacheSet(key, results, CacheConfigs.ragSearch);
}

/**
 * Get cached RAG search results
 */
export async function getCachedRAGSearch(
  packageId: string,
  query: string,
  options?: {
    method?: string;
    limit?: number;
    alpha?: number;
  }
): Promise<unknown | null> {
  const key = generateRAGSearchKey(packageId, query, options);
  return cacheGet(key, CacheConfigs.ragSearch);
}

/**
 * Invalidate RAG cache for a package
 */
export async function invalidateRAGCache(packageId: string): Promise<void> {
  await cacheInvalidate(`${CacheConfigs.ragSearch.namespace}:${packageId}:*`);
  await cacheInvalidate(`${CacheConfigs.documentChunks.namespace}:${packageId}:*`);
}

/**
 * Cache embeddings
 */
export async function cacheEmbedding(
  text: string,
  embedding: number[]
): Promise<void> {
  const key = generateEmbeddingKey(text);
  await cacheSet(key, embedding, CacheConfigs.embeddings);
}

/**
 * Get cached embedding
 */
export async function getCachedEmbedding(
  text: string
): Promise<number[] | null> {
  const key = generateEmbeddingKey(text);
  return cacheGet(key, CacheConfigs.embeddings);
}

/**
 * Batch cache embeddings
 */
export async function cacheBatchEmbeddings(
  items: Array<{ text: string; embedding: number[] }>
): Promise<void> {
  const pipeline = redis.multi();
  const config = CacheConfigs.embeddings;

  for (const item of items) {
    const key = generateEmbeddingKey(item.text);
    const data = JSON.stringify({
      data: item.embedding,
      timestamp: Date.now(),
    });

    pipeline.set(key, data, 'PX', config.ttl * 1000);
  }

  await pipeline.exec();
}

/**
 * Get multiple cached embeddings
 */
export async function getBatchCachedEmbeddings(
  texts: string[]
): Promise<Map<string, number[] | null>> {
  const keys = texts.map(text => generateEmbeddingKey(text));
  const values = await redis.mget(...keys);

  const result = new Map<string, number[] | null>();

  for (let i = 0; i < texts.length; i++) {
    if (values[i]) {
      try {
        const parsed = JSON.parse(values[i] as string);
        result.set(texts[i], parsed.data as number[]);
      } catch {
        result.set(texts[i], null);
      }
    } else {
      result.set(texts[i], null);
    }
  }

  return result;
}

/**
 * Cache query results
 */
export async function cacheQueryResult<T>(
  queryKey: string,
  result: T,
  ttl?: number
): Promise<void> {
  const config = {
    ...CacheConfigs.queryResults,
    ttl: ttl || CacheConfigs.queryResults.ttl,
  };

  const key = generateCacheKey(config.namespace, queryKey);
  await cacheSet(key, result, config);
}

/**
 * Get cached query result
 */
export async function getCachedQueryResult<T>(
  queryKey: string
): Promise<T | null> {
  const config = CacheConfigs.queryResults;
  const key = generateCacheKey(config.namespace, queryKey);
  return cacheGet<T>(key, config);
}

// ============================================================================
// Cache Invalidation Strategies
// ============================================================================

/**
 * Invalidate cache when document is updated
 */
export async function onDocumentUpdate(
  packageId: string,
  documentId: string
): Promise<void> {
  // Invalidate RAG search results for this package
  await invalidateRAGCache(packageId);

  // Invalidate specific document chunks
  await cacheInvalidate(`${CacheConfigs.documentChunks.namespace}:${documentId}:*`);
}

/**
 * Invalidate cache when team is updated
 */
export async function onTeamUpdate(teamSlug: string): Promise<void> {
  await cacheInvalidate(`${CacheConfigs.teamData.namespace}:${teamSlug}:*`);
}

/**
 * Invalidate user cache
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await cacheInvalidate(`${CacheConfigs.userSessions.namespace}:${userId}:*`);
}

// ============================================================================
// Background Refresh (Stale-While-Revalidate)
// ============================================================================

/**
 * Background refresh function for stale-while-revalidate
 */
async function backgroundRefresh(
  key: string,
  config: CacheConfig
): Promise<void> {
  // This would trigger a background refresh of the cache
  // Implementation depends on the use case
  // For now, we just log it
  }

/**
 * Warm up cache with common queries
 */
export async function warmupCache(
  queries: Array<{
    key: string;
    fn: () => Promise<unknown>;
  }>
): Promise<void> {
  const results = await Promise.allSettled(
    queries.map(({ fn }) => fn())
  );

  const failed = results.filter(r => r.status === 'rejected').length;
  }

// ============================================================================
// Cache Statistics
// ============================================================================

/**
 * Get cache statistics
 */
export async function getCacheStats(namespace: string): Promise<{
  size: number;
  keys: string[];
}> {
  const pattern = `${namespace}:*`;
  const keys = await redis.keys(pattern);

  return {
    size: keys.length,
    keys,
  };
}

/**
 * Clear entire cache namespace
 */
export async function clearCacheNamespace(namespace: string): Promise<void> {
  await cacheInvalidate(`${namespace}:*`);
}
