/**
 * Audit Logs Export Service
 *
 * Provides functionality to export audit logs in various formats
 * for compliance and analysis purposes.
 */

import { query } from '@/lib/db';
import { stringify } from 'csv-stringify/sync';

// =====================================================
// TYPES
// =====================================================

export interface AuditLog {
  id: string;
  teamSlug: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AuditLogFilter {
  teamSlug?: string;
  userId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ExportResult {
  data: string;
  contentType: string;
  filename: string;
  recordCount: number;
}

export type ExportFormat = 'csv' | 'json' | 'syslog';

// =====================================================
// AUDIT LOG RETRIEVAL
// =====================================================

/**
 * Fetch audit logs from database with optional filters
 */
export async function fetchAuditLogs(filters: AuditLogFilter): Promise<AuditLog[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Build WHERE clause
  if (filters.teamSlug) {
    conditions.push(`team_slug = $${paramIndex}`);
    params.push(filters.teamSlug);
    paramIndex++;
  }

  if (filters.userId) {
    conditions.push(`actor_user_id = $${paramIndex}`);
    params.push(filters.userId);
    paramIndex++;
  }

  if (filters.action) {
    conditions.push(`action = $${paramIndex}`);
    params.push(filters.action);
    paramIndex++;
  }

  if (filters.targetType) {
    conditions.push(`target_type = $${paramIndex}`);
    params.push(filters.targetType);
    paramIndex++;
  }

  if (filters.targetId) {
    conditions.push(`target_id = $${paramIndex}`);
    params.push(filters.targetId);
    paramIndex++;
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(filters.startDate.toISOString());
    paramIndex++;
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(filters.endDate.toISOString());
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filters.limit ? `LIMIT ${filters.limit}` : '';
  const orderBy = 'ORDER BY created_at DESC';

  const result = await query(
    `SELECT id, team_slug, actor_user_id, action, target_type, target_id, ip_address, user_agent, metadata, created_at
     FROM projectnexus.audit_logs
     ${whereClause}
     ${orderBy}
     ${limitClause}`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    teamSlug: row.team_slug,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  }));
}

/**
 * Get count of audit logs matching filters
 */
export async function countAuditLogs(filters: AuditLogFilter): Promise<number> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.teamSlug) {
    conditions.push(`team_slug = $${paramIndex}`);
    params.push(filters.teamSlug);
    paramIndex++;
  }

  if (filters.userId) {
    conditions.push(`actor_user_id = $${paramIndex}`);
    params.push(filters.userId);
    paramIndex++;
  }

  if (filters.action) {
    conditions.push(`action = $${paramIndex}`);
    params.push(filters.action);
    paramIndex++;
  }

  if (filters.targetType) {
    conditions.push(`target_type = $${paramIndex}`);
    params.push(filters.targetType);
    paramIndex++;
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(filters.startDate.toISOString());
    paramIndex++;
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(filters.endDate.toISOString());
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT COUNT(*) as count FROM projectnexus.audit_logs ${whereClause}`,
    params
  );

  return parseInt(result.rows[0].count);
}

// =====================================================
// EXPORT FORMATS
// =====================================================

/**
 * Export audit logs as CSV
 */
export async function exportAuditLogsAsCSV(filters: AuditLogFilter): Promise<ExportResult> {
  const logs = await fetchAuditLogs(filters);

  // Flatten metadata for CSV
  const flatLogs = logs.map((log) => ({
    timestamp: log.createdAt,
    user_id: log.actorUserId || '',
    action: log.action,
    resource_type: log.targetType || '',
    resource_id: log.targetId || '',
    ip_address: log.ipAddress || '',
    user_agent: log.userAgent || '',
    metadata: JSON.stringify(log.metadata),
  }));

  const csvData = stringify(flatLogs, {
    header: true,
    columns: [
      'timestamp',
      'user_id',
      'action',
      'resource_type',
      'resource_id',
      'ip_address',
      'user_agent',
      'metadata',
    ],
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dateStr = new Date().toISOString().split('T')[0];

  return {
    data: csvData,
    contentType: 'text/csv',
    filename: `audit-logs-${dateStr}-${timestamp.split('T')[1]}.csv`,
    recordCount: logs.length,
  };
}

/**
 * Export audit logs as JSON
 */
export async function exportAuditLogsAsJSON(filters: AuditLogFilter): Promise<ExportResult> {
  const logs = await fetchAuditLogs(filters);

  const jsonData = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      format: 'audit-logs-json-v1',
      filters: {
        team_slug: filters.teamSlug,
        user_id: filters.userId,
        action: filters.action,
        target_type: filters.targetType,
        start_date: filters.startDate?.toISOString(),
        end_date: filters.endDate?.toISOString(),
      },
      total_records: logs.length,
      logs: logs,
    },
    null,
    2
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dateStr = new Date().toISOString().split('T')[0];

  return {
    data: jsonData,
    contentType: 'application/json',
    filename: `audit-logs-${dateStr}-${timestamp.split('T')[1]}.json`,
    recordCount: logs.length,
  };
}

/**
 * Export audit logs as SYSLOG format (RFC 5424)
 */
export async function exportAuditLogsAsSyslog(filters: AuditLogFilter): Promise<ExportResult> {
  const logs = await fetchAuditLogs(filters);

  // SYSLOG format: <PRI>VERSION ISOTIMESTAMP HOST APP-NAME PROCID MSGID STRUCTURED-DATA MSG
  // Priority = Facility * 8 + Severity
  // Using facility 1 (user-level) and severity 6 (info) = 1*8+6 = 14
  const priority = 14;

  const syslogData = logs
    .map((log) => {
      const timestamp = new Date(log.createdAt).toISOString().replace('Z', '+00:00');
      const structuredData = [
        `action="${log.action}"`,
        log.targetType ? `resource-type="${log.targetType}"` : '',
        log.targetId ? `resource-id="${log.targetId}"` : '',
        log.actorUserId ? `user-id="${log.actorUserId}"` : '',
        log.teamSlug ? `team="${log.teamSlug}"` : '',
        log.ipAddress ? `ip="${log.ipAddress}"` : '',
      ]
        .filter(Boolean)
        .join(' ');

      const msg = `[${log.action}]` +
        (log.targetType ? ` ${log.targetType}` : '') +
        (log.targetId ? `:${log.targetId}` : '') +
        (log.actorUserId ? ` by user ${log.actorUserId}` : '');

      // Format: <PRI>VERSION ISOTIMESTAMP HOST APP PROCID MSG STRUCTURED-DATA
      return `<${priority}>1 ${timestamp} nexary app - - ${structuredData} ${msg}`;
    })
    .join('\n');

  const dateStr = new Date().toISOString().split('T')[0];

  return {
    data: syslogData,
    contentType: 'text/plain',
    filename: `audit-logs-${dateStr}.syslog`,
    recordCount: logs.length,
  };
}

/**
 * Main export function that dispatches to format-specific handlers
 */
export async function exportAuditLogs(
  format: ExportFormat,
  filters: AuditLogFilter
): Promise<ExportResult> {
  switch (format) {
    case 'csv':
      return exportAuditLogsAsCSV(filters);
    case 'json':
      return exportAuditLogsAsJSON(filters);
    case 'syslog':
      return exportAuditLogsAsSyslog(filters);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// =====================================================
// EXPORT HELPERS
// =====================================================

/**
 * Get available export formats with descriptions
 */
export function getExportFormats(): Array<{ value: ExportFormat; label: string; description: string }> {
  return [
    {
      value: 'csv',
      label: 'CSV',
      description: 'Comma-separated values, compatible with Excel and spreadsheet applications',
    },
    {
      value: 'json',
      label: 'JSON',
      description: 'Structured JSON format with metadata, ideal for programmatic processing',
    },
    {
      value: 'syslog',
      label: 'SYSLOG',
      description: 'SYSLOG format (RFC 5424), compatible with log aggregation systems',
    },
  ];
}

/**
 * Get common date range presets
 */
export function getDateRangePresets(): Array<{ value: string; label: string; days: number }> {
  return [
    { value: '24h', label: 'Last 24 Hours', days: 1 },
    { value: '7d', label: 'Last 7 Days', days: 7 },
    { value: '30d', label: 'Last 30 Days', days: 30 },
    { value: '90d', label: 'Last 90 Days', days: 90 },
    { value: '1y', label: 'Last Year', days: 365 },
    { value: 'all', label: 'All Time', days: 0 },
  ];
}

/**
 * Apply date range preset to filters
 */
export function applyDateRangePreset(
  filters: AuditLogFilter,
  preset: string
): AuditLogFilter {
  const presetConfig = getDateRangePresets().find((p) => p.value === preset);

  if (!presetConfig || presetConfig.days === 0) {
    // Return filters without date constraints
    const { startDate, endDate, ...rest } = filters;
    return rest;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - presetConfig.days);

  return {
    ...filters,
    startDate,
    endDate,
  };
}
