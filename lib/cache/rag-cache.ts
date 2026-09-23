/**
 * RAG-specific caching layer.
 *
 * Provides caching for RAG packages, documents, and search results.
 */

import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from './redis-cache';

const RAG_CACHE_PREFIX = 'rag:';

/**
 * RAG package with metadata.
 */
export interface RAGPackage {
  id: string;
  name: string;
  description: string;
  teamSlug: string;
  createdAt: string;
  documentCount?: number;
}

/**
 * RAG document metadata.
 */
export interface RAGDocument {
  id: string;
  packageId: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

/**
 * Get RAG package with caching.
 */
export async function getRAGPackage(packageId: string): Promise<RAGPackage | null> {
  const cacheKey = `${RAG_CACHE_PREFIX}package:${packageId}`;

  return cacheGetOrElse<RAGPackage | null>(
    { key: cacheKey, ttl: 3600 },
    async () => {
      const { query } = await import('../db');
      const { rows } = await query(
        `SELECT id::text, name, description, team_slug as "teamSlug", created_at::text
         FROM projectnexus.rag_packages
         WHERE id = $1 AND deleted_at IS NULL`,
        [packageId]
      );

      if (rows.length === 0) return null;

      // Get document count
      const { rows: docCount } = await query(
        `SELECT COUNT(*) as count
         FROM projectnexus.rag_documents
         WHERE package_id = $1 AND deleted_at IS NULL`,
        [packageId]
      );

      return {
        ...rows[0],
        documentCount: parseInt(docCount[0]?.count || '0'),
      };
    }
  );
}

/**
 * Get all RAG packages for a team with caching.
 */
export async function getTeamRAGPackages(teamSlug: string): Promise<RAGPackage[]> {
  const cacheKey = `${RAG_CACHE_PREFIX}packages:${teamSlug}`;

  return cacheGetOrElse<RAGPackage[]>(
    { key: cacheKey, ttl: 600 }, // 10 minutes - list changes more often
    async () => {
      const { query } = await import('../db');
      const { rows } = await query(
        `SELECT id::text, name, description, team_slug as "teamSlug", created_at::text
         FROM projectnexus.rag_packages
         WHERE team_slug = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [teamSlug]
      );

      return rows;
    }
  );
}

/**
 * Get RAG document with caching.
 */
export async function getRAGDocument(documentId: string): Promise<RAGDocument | null> {
  const cacheKey = `${RAG_CACHE_PREFIX}document:${documentId}`;

  return cacheGetOrElse<RAGDocument | null>(
    { key: cacheKey, ttl: 1800 },
    async () => {
      const { query } = await import('../db');
      const { rows } = await query(
        `SELECT id::text, package_id as "packageId", name, size, mime_type as "mimeType", created_at::text
         FROM projectnexus.rag_documents
         WHERE id = $1 AND deleted_at IS NULL`,
        [documentId]
      );

      return rows.length > 0 ? rows[0] : null;
    }
  );
}

/**
 * Cache search results for RAG queries.
 */
export async function cacheRAGSearchResult(
  packageId: string,
  queryHash: string,
  results: unknown[],
  ttl: number = 300 // 5 minutes
): Promise<void> {
  const cacheKey = `${RAG_CACHE_PREFIX}search:${packageId}:${queryHash}`;
  await cacheSet({ key: cacheKey, ttl }, results);
}

/**
 * Get cached RAG search results.
 */
export async function getCachedRAGSearchResult(
  packageId: string,
  queryHash: string
): Promise<unknown[] | null> {
  const cacheKey = `${RAG_CACHE_PREFIX}search:${packageId}:${queryHash}`;
  return cacheGet<unknown[]>({ key: cacheKey, ttl: 300 });
}

/**
 * Invalidate RAG package cache.
 */
export async function invalidateRAGPackageCache(packageId: string): Promise<void> {
  await cacheDelete({ key: `${RAG_CACHE_PREFIX}package:${packageId}` });
  // Also invalidate search results for this package
  await cacheDeletePattern(`${RAG_CACHE_PREFIX}search:${packageId}:*`);
}

/**
 * Invalidate team RAG packages cache.
 */
export async function invalidateTeamRAGCache(teamSlug: string): Promise<void> {
  await cacheDelete({ key: `${RAG_CACHE_PREFIX}packages:${teamSlug}` });
}

/**
 * Invalidate RAG document cache.
 */
export async function invalidateRAGDocumentCache(documentId: string): Promise<void> {
  await cacheDelete({ key: `${RAG_CACHE_PREFIX}document:${documentId}` });
}

/**
 * Helper function for get-or-set pattern.
 */
async function cacheGetOrElse<T>(
  options: { key: string; ttl: number },
  factory: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(options);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  if (value !== null) {
    await cacheSet(options, value);
  }
  return value;
}
