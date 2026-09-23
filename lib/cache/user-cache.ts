/**
 * User-specific caching layer.
 *
 * Provides caching for user roles and permissions.
 */

import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from './redis-cache';
import { getGlobalRoles, getUserRole } from '../permissions';
import { CacheTTL } from '../constants';

const USER_CACHE_PREFIX = 'user:';

/**
 * Get user roles from PostgreSQL with caching.
 *
 * @param userId - User ID from Stack Auth
 * @returns Array of global roles or empty array if none
 */
export async function getUserRolesFromCache(userId: string): Promise<string[]> {
  const cacheKey = `${USER_CACHE_PREFIX}roles:${userId}`;

  // Try cache first
  const cached = await cacheGet<string[]>({ key: cacheKey, ttl: CacheTTL.USER_ROLES });
  if (cached !== null) {
    return cached;
  }

  // Fetch from database
  const roles = await getGlobalRoles(userId);

  // Cache the result
  await cacheSet({ key: cacheKey, ttl: CacheTTL.USER_ROLES }, roles);

  return roles;
}

/**
 * Get user team role with caching.
 *
 * @param userId - User ID from Stack Auth
 * @param teamSlug - Team slug
 * @returns Team role or null if user has no role
 */
export async function getUserTeamRoleFromCache(userId: string, teamSlug: string): Promise<string | null> {
  const cacheKey = `${USER_CACHE_PREFIX}team_role:${userId}:${teamSlug}`;

  // Try cache first
  const cached = await cacheGet<string>({ key: cacheKey, ttl: CacheTTL.USER_ROLES });
  if (cached !== null) {
    return cached;
  }

  // Fetch from database
  const role = await getUserRole(userId, teamSlug);

  if (role) {
    // Cache the result
    await cacheSet({ key: cacheKey, ttl: CacheTTL.USER_ROLES }, role);
  }

  return role;
}

/**
 * Invalidate all user caches.
 *
 * @param userId - User ID from Stack Auth
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await cacheDeletePattern(`${USER_CACHE_PREFIX}*:${userId}*`);
}

/**
 * Invalidate specific user role cache.
 *
 * @param userId - User ID from Stack Auth
 */
export async function invalidateUserRolesCache(userId: string): Promise<void> {
  await cacheDelete({ key: `${USER_CACHE_PREFIX}roles:${userId}` });
}

/**
 * Invalidate user team role cache.
 *
 * @param userId - User ID from Stack Auth
 * @param teamSlug - Team slug
 */
export async function invalidateUserTeamRoleCache(userId: string, teamSlug: string): Promise<void> {
  await cacheDelete({ key: `${USER_CACHE_PREFIX}team_role:${userId}:${teamSlug}` });
}
