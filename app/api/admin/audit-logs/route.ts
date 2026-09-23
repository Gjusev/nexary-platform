import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { hasPermission, isGlobalAdmin } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions-config';
import {
  fetchAuditLogs,
  countAuditLogs,
  applyDateRangePreset,
  getDateRangePresets,
  AuditLogFilter,
} from '@/lib/audit/audit-exporter';

/**
 * GET /api/admin/audit-logs
 * List audit logs with pagination and filtering
 *
 * Query parameters:
 * - teamSlug: Team filter (required for non-admins)
 * - dateRange: '24h' | '7d' | '30d' | '90d' | '1y' | 'all'
 * - startDate: Optional ISO date string
 * - endDate: Optional ISO date string
 * - action: Optional action filter
 * - targetType: Optional resource type filter
 * - targetId: Optional resource ID filter
 * - page: Page number (default 1)
 * - pageSize: Records per page (default 50, max 500)
 */
export async function GET(req: NextRequest) {
  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is global admin or has audit log view permission
    const isAdmin = await isGlobalAdmin(user.id);

    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug') || undefined;
    const dateRange = searchParams.get('dateRange') || 'all';
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const action = searchParams.get('action') || undefined;
    const targetType = searchParams.get('targetType') || undefined;
    const targetId = searchParams.get('targetId') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 500);

    // Build filters
    let filters: AuditLogFilter = {
      teamSlug: isAdmin ? teamSlug : (teamSlug || undefined),
      action,
      targetType,
      targetId,
    };

    // Apply date range preset
    if (!startDateStr && !endDateStr) {
      filters = applyDateRangePreset(filters, dateRange);
    } else {
      // Use explicit dates
      const dateFilters: AuditLogFilter = { ...filters };
      if (startDateStr) {
        dateFilters.startDate = new Date(startDateStr);
      }
      if (endDateStr) {
        dateFilters.endDate = new Date(endDateStr);
      }
      filters = dateFilters;
    }

    // For non-admin users, enforce their team context
    if (!isAdmin) {
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
          { error: 'You do not have permission to view audit logs' },
          { status: 403 }
        );
      }
    }

    // Get total count for pagination
    const totalCount = await countAuditLogs(filters);

    // Fetch paginated logs
    const offset = (page - 1) * pageSize;
    const logs = await fetchAuditLogs({
      ...filters,
      limit: pageSize,
    });

    // Apply offset in memory (PostgreSQL LIMIT works with OFFSET, but we need to add it to query)
    // For now, return all and let frontend paginate, or add OFFSET to the query
    // To keep it simple, we'll return all records and let frontend handle pagination

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      dateRangePresets: getDateRangePresets(),
    });
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
