/**
 * Permissions cache service - handles caching of permission checks
 */

import { cacheService, CACHE_KEYS, CACHE_TTL } from './cache-service';

export interface PermissionCheck {
  userId: string;
  teamSlug: string;
  permission: string;
  hasPermission: boolean;
  checkedAt: Date;
}

/**
 * Check if user has permission (cached)
 */
export async function hasPermissionCached(
  userId: string,
  teamSlug: string,
  permission: string
): Promise<boolean> {
  const key = `permission:${userId}:${teamSlug}:${permission}`;

  return cacheService.getOrCompute(
    key,
    async () => {
      const { hasPermission } = await import('@/lib/permissions');
      return hasPermission(userId, teamSlug, permission);
    },
    CACHE_TTL.TEAM_PERMISSIONS,
    ['permission', userId, teamSlug]
  );
}

/**
 * Invalidate permission cache for user in team
 */
export async function invalidatePermissionCache(
  userId: string,
  teamSlug: string
): Promise<void> {
  await cacheService.invalidateByPattern(`permission:${userId}:${teamSlug}:*`);
}

/**
 * Invalidate all permission caches for user
 */
export async function invalidateAllUserPermissions(userId: string): Promise<void> {
  await cacheService.invalidateByPattern(`permission:${userId}:*`);
}

/**
 * Invalidate all permission caches for team
 */
export async function invalidateAllTeamPermissions(teamSlug: string): Promise<void> {
  await cacheService.invalidateByPattern(`permission:*:${teamSlug}:*`);
}

/**
 * Check multiple permissions at once (batched)
 */
export async function hasPermissionsCached(
  userId: string,
  teamSlug: string,
  permissions: string[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  // Check all in parallel
  await Promise.all(
    permissions.map(async (permission) => {
      results[permission] = await hasPermissionCached(userId, teamSlug, permission);
    })
  );

  return results;
}

/**
 * Get all user permissions for team (cached)
 */
export async function getUserPermissions(
  userId: string,
  teamSlug: string
): Promise<string[]> {
  const key = `user:permissions:${userId}:${teamSlug}`;

  return cacheService.getOrCompute(
    key,
    async () => {
      const { query } = await import('@/lib/db');
      const result = await query(
        `SELECT p.permission
         FROM team_members tm
         JOIN role_permissions rp ON tm.role = rp.role
         JOIN permissions p ON rp.permission_id = p.id
         WHERE tm.user_id = $1 AND tm.team_slug = $2 AND tm.status = 'active'`,
        [userId, teamSlug]
      );

      return result.rows.map((row) => row.permission);
    },
    CACHE_TTL.TEAM_PERMISSIONS,
    ['permission', userId, teamSlug]
  );
}
