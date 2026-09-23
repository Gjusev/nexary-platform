import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { hasPermission, isGlobalAdmin } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions-config';
import {
  exportAuditLogs,
  AuditLogFilter,
  ExportFormat,
  applyDateRangePreset,
} from '@/lib/audit/audit-exporter';

/**
 * GET /api/admin/audit-logs/export
 * Export audit logs in various formats (CSV, JSON, SYSLOG)
 *
 * Query parameters:
 * - format: 'csv' | 'json' | 'syslog'
 * - teamSlug: Optional team filter (for non-global admins)
 * - dateRange: '24h' | '7d' | '30d' | '90d' | '1y' | 'all'
 * - startDate: ISO date string (overrides dateRange)
 * - endDate: ISO date string (overrides dateRange)
 * - action: Optional action filter
 * - targetType: Optional resource type filter
 * - targetId: Optional resource ID filter
 * - limit: Max records (default 10000)
 */
export async function GET(req: NextRequest) {
  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is global admin or has audit log export permission
    const isAdmin = await isGlobalAdmin(user.id);

    const searchParams = req.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'json') as ExportFormat;
    const teamSlug = searchParams.get('teamSlug') || undefined;
    const dateRange = searchParams.get('dateRange') || 'all';
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const action = searchParams.get('action') || undefined;
    const targetType = searchParams.get('targetType') || undefined;
    const targetId = searchParams.get('targetId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10000', 10);

    // Build filters
    let filters: AuditLogFilter = {
      teamSlug: isAdmin ? teamSlug : (teamSlug || undefined),
      action,
      targetType,
      targetId,
      limit: Math.min(limit, 100000), // Cap at 100k records
    };

    // Apply date range preset
    if (!startDateStr && !endDateStr) {
      filters = applyDateRangePreset(filters, dateRange);
    } else {
      // Use explicit dates
      if (startDateStr) {
        filters.startDate = new Date(startDateStr);
      }
      if (endDateStr) {
        filters.endDate = new Date(endDateStr);
      }
    }

    // For non-admin users, enforce their team context
    if (!isAdmin) {
      // User can only export logs for teams they have access to
      // This is handled by the teamSlug filter being required
      if (!filters.teamSlug) {
        return NextResponse.json(
          { error: 'teamSlug is required for non-admin users' },
          { status: 400 }
        );
      }

      // Check if user has permission to view audit logs for this team
      const hasViewPermission = await hasPermission(
        user.id,
        filters.teamSlug,
        PERMISSIONS.SECURITY_VIEW_AUDIT_LOGS
      );

      if (!hasViewPermission) {
        return NextResponse.json(
          { error: 'You do not have permission to export audit logs' },
          { status: 403 }
        );
      }

      // Check export permission
      const hasExportPermission = await hasPermission(
        user.id,
        filters.teamSlug,
        PERMISSIONS.SECURITY_EXPORT_AUDIT_LOGS
      );

      if (!hasExportPermission) {
        return NextResponse.json(
          { error: 'You do not have permission to export audit logs (requires team owner or leader)' },
          { status: 403 }
        );
      }
    }

    // Validate format
    const validFormats: ExportFormat[] = ['csv', 'json', 'syslog'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Export audit logs
    const result = await exportAuditLogs(format, filters);

    // Return file response
    return new NextResponse(result.data, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Record-Count': result.recordCount.toString(),
      },
    });
  } catch (error) {
    console.error('Audit log export error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
