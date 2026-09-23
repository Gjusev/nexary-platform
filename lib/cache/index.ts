/**
 * Cache module exports.
 *
 * Centralizes all caching functionality for easy imports.
 */

// Core cache service
export { cacheService, cachedQuery, warmupCache } from './cache-service';
export { CACHE_KEYS, CACHE_TTL } from './cache-service';

// Redis cache layer
export {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheGetOrElse,
  isCacheAvailable,
  closeCache,
} from './redis-cache';
export type { CacheOptions } from './redis-cache';

// User cache
export {
  getUserRolesFromCache,
  getUserTeamRoleFromCache,
  invalidateUserCache,
  invalidateUserRolesCache,
  invalidateUserTeamRoleCache,
} from './user-cache';

// Team cache
export {
  getTeamSlug,
  getTeamDetails,
  cacheTeamSlug,
  invalidateTeamCache,
} from './team-cache';

// Permissions cache (from permissions-cache.ts)
export {
  hasPermissionCached,
  hasPermissionsCached,
  getUserPermissions,
  invalidatePermissionCache,
  invalidateAllUserPermissions,
  invalidateAllTeamPermissions,
} from './permissions-cache';

// RAG cache
export {
  getRAGPackage,
  getTeamRAGPackages,
  getRAGDocument,
  cacheRAGSearchResult,
  getCachedRAGSearchResult,
  invalidateRAGPackageCache,
  invalidateTeamRAGCache,
  invalidateRAGDocumentCache,
} from './rag-cache';
export type { RAGPackage, RAGDocument } from './rag-cache';

// Audit cache
export {
  getAuditLogsCached,
  getAuditStatisticsCached,
  invalidateAuditLogsCache,
} from './audit-cache';
export type { AuditLogEntry, PaginatedAuditLogs, AuditStatistics } from './audit-cache';
