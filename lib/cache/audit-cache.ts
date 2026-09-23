/**
 * Audit logs caching layer.
 *
 * Provides caching for audit log queries and aggregations.
 */

import { cacheGet, cacheSet, cacheDeletePattern } from './redis-cache';

const AUDIT_CACHE_PREFIX = 'audit:';

/**
 * Audit log entry.
 */
export interface AuditLogEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  targetType: string | null;
  targetId: string | null;
  teamSlug: string;
  ipAddress: string | null;
  createdAt: string;
}

/**
 * Paginated audit logs result.
 */
export interface PaginatedAuditLogs {
  logs: AuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Audit statistics aggregation.
 */
export interface AuditStatistics {
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByUser: Record<string, number>;
  actionsOverTime: { date: string; count: number }[];
}

/**
 * Get paginated audit logs with caching.
 */
export async function getAuditLogsCached(params: {
  teamSlug: string;
  page: number;
  pageSize: number;
  actionFilter?: string;
  userFilter?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<PaginatedAuditLogs> {
  // Create cache key from params
  const paramsKey = `${params.teamSlug}:${params.page}:${params.pageSize}:${params.actionFilter || 'all'}:${params.userFilter || 'all'}:${params.startDate?.toISOString() || 'all'}:${params.endDate?.toISOString() || 'all'}`;
  const cacheKey = `${AUDIT_CACHE_PREFIX}logs:${Buffer.from(paramsKey).toString('base64').slice(0, 32)}`;

  return cacheGetOrElse<PaginatedAuditLogs>(
    { key: cacheKey, ttl: 300 }, // 5 minutes
    async () => {
      const { query } = await import('../db');

      // Build query conditions
      const conditions: string[] = ["team_slug = $1"];
      const queryParams: any[] = [params.teamSlug];
      let paramIndex = 2;

      if (params.actionFilter) {
        conditions.push(`action = $${paramIndex++}`);
        queryParams.push(params.actionFilter);
      }

      if (params.userFilter) {
        conditions.push(`actor_user_id = $${paramIndex++}`);
        queryParams.push(params.userFilter);
      }

      if (params.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        queryParams.push(params.startDate.toISOString());
      }

      if (params.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        queryParams.push(params.endDate.toISOString());
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const { rows: countRows } = await query(
        `SELECT COUNT(*) as count FROM projectnexus.audit_logs WHERE ${whereClause}`,
        queryParams
      );

      const totalCount = parseInt(countRows[0]?.count || '0');

      // Get paginated logs
      const offset = (params.page - 1) * params.pageSize;
      queryParams.push(params.pageSize, offset);

      const { rows } = await query(
        `SELECT id::text, action, actor_user_id as "actorUserId", actor_display_name as "actorDisplayName",
                target_type as "targetType", target_id as "targetId", team_slug as "teamSlug",
                ip_address as "ipAddress", created_at::text
         FROM projectnexus.audit_logs
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        queryParams
      );

      return {
        logs: rows,
        totalCount,
        page: params.page,
        pageSize: params.pageSize,
      };
    }
  );
}

/**
 * Get audit statistics with caching.
 */
export async function getAuditStatisticsCached(params: {
  teamSlug: string;
  startDate: Date;
  endDate: Date;
}): Promise<AuditStatistics> {
  const paramsKey = `${params.teamSlug}:${params.startDate.toISOString()}:${params.endDate.toISOString()}`;
  const cacheKey = `${AUDIT_CACHE_PREFIX}stats:${Buffer.from(paramsKey).toString('base64').slice(0, 32)}`;

  return cacheGetOrElse<AuditStatistics>(
    { key: cacheKey, ttl: 600 }, // 10 minutes
    async () => {
      const { query } = await import('../db');

      // Get total actions
      const { rows: totalRows } = await query(
        `SELECT COUNT(*) as count
         FROM projectnexus.audit_logs
         WHERE team_slug = $1 AND created_at >= $2 AND created_at <= $3`,
        [params.teamSlug, params.startDate.toISOString(), params.endDate.toISOString()]
      );

      // Get actions by type
      const { rows: byType } = await query(
        `SELECT action, COUNT(*) as count
         FROM projectnexus.audit_logs
         WHERE team_slug = $1 AND created_at >= $2 AND created_at <= $3
         GROUP BY action
         ORDER BY count DESC`,
        [params.teamSlug, params.startDate.toISOString(), params.endDate.toISOString()]
      );

      // Get actions by user
      const { rows: byUser } = await query(
        `SELECT actor_display_name, COUNT(*) as count
         FROM projectnexus.audit_logs
         WHERE team_slug = $1 AND created_at >= $2 AND created_at <= $3
         GROUP BY actor_display_name
         ORDER BY count DESC
         LIMIT 10`,
        [params.teamSlug, params.startDate.toISOString(), params.endDate.toISOString()]
      );

      // Get actions over time (daily)
      const { rows: overTime } = await query(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM projectnexus.audit_logs
         WHERE team_slug = $1 AND created_at >= $2 AND created_at <= $3
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        [params.teamSlug, params.startDate.toISOString(), params.endDate.toISOString()]
      );

      return {
        totalActions: parseInt(totalRows[0]?.count || '0'),
        actionsByType: byType.reduce((acc, row) => ({ ...acc, [row.action]: parseInt(row.count) }), {}),
        actionsByUser: byUser.reduce((acc, row) => ({ ...acc, [row.actor_display_name || 'Unknown']: parseInt(row.count) }), {}),
        actionsOverTime: overTime.map(row => ({ date: row.date, count: parseInt(row.count) })),
      };
    }
  );
}

/**
 * Invalidate audit logs cache for a team.
 */
export async function invalidateAuditLogsCache(teamSlug: string): Promise<void> {
  await cacheDeletePattern(`${AUDIT_CACHE_PREFIX}*:${teamSlug}:*`);
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
