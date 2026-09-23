import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { hasPermission, isGlobalAdmin } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions-config';
import {
  searchEDiscovery,
  exportToJSON,
  exportToCSV,
  logEDiscoveryRequest,
} from '@/lib/ediscovery/ediscovery-service';

/**
 * GET /api/admin/ediscovery
 * Perform eDiscovery search
 *
 * Query parameters:
 * - query: Search term
 * - teamSlug: Filter by team
 * - resourceTypes: Comma-separated list (chat_messages,documents,audit_logs,consents,api_keys)
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - users: Comma-separated user IDs
 * - limit: Results per page (default 100)
 * - offset: Pagination offset (default 0)
 * - export: Export format (json, csv)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const searchParams = req.nextUrl.searchParams;

    const query = searchParams.get('query') || '';
    const teamSlug = searchParams.get('teamSlug') || undefined;
    const resourceTypesParam = searchParams.get('resourceTypes');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const usersParam = searchParams.get('users');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const exportFormat = searchParams.get('export');

    // Parse resource types
    const resourceTypes = resourceTypesParam
      ? resourceTypesParam.split(',') as Array<any>
      : ['chat_messages', 'documents', 'audit_logs'];

    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Parse users
    const users = usersParam ? usersParam.split(',') : undefined;

    // Check permissions
    if (teamSlug) {
      const hasViewPermission = await hasPermission(
        user.id,
        teamSlug,
        PERMISSIONS.SECURITY_VIEW_AUDIT_LOGS
      );

      if (!hasViewPermission && !isAdmin) {
        return NextResponse.json(
          { error: 'You do not have permission to perform eDiscovery search' },
          { status: 403 }
        );
      }
    } else if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can perform global eDiscovery search' },
        { status: 403 }
      );
    }

    // Perform search
    const { results, summary, hasMore } = await searchEDiscovery({
      query,
      teamSlug,
      resourceTypes,
      startDate,
      endDate,
      users,
      limit,
      offset,
    });

    // Log the discovery request
    await logEDiscoveryRequest({
      teamSlug,
      userId: user.id,
      queryParams: { query, teamSlug, resourceTypes, startDate, endDate, users },
      resultsCount: results.length,
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    });

    // Export if requested
    if (exportFormat === 'json' || exportFormat === 'csv') {
      let data: string;
      let contentType: string;
      let filename: string;

      if (exportFormat === 'json') {
        data = await exportToJSON(results);
        contentType = 'application/json';
        filename = `ediscovery-${Date.now()}.json`;
      } else {
        data = await exportToCSV(results);
        contentType = 'text/csv';
        filename = `ediscovery-${Date.now()}.csv`;
      }

      return new NextResponse(data, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Return results
    return NextResponse.json({
      results,
      summary,
      pagination: {
        limit,
        offset,
        hasMore,
        total: summary.totalDocuments,
      },
    });
  } catch (error) {
    console.error('eDiscovery search error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/ediscovery
 * Create and export a discovery package
 *
 * Body: {
 *   query: string,
 *   teamSlug?: string,
 *   resourceTypes?: ResourceType[],
 *   startDate?: string,
 *   endDate?: string,
 *   format: 'json' | 'csv'
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const body = await req.json();
    const {
      query,
      teamSlug,
      resourceTypes = ['chat_messages', 'documents', 'audit_logs'],
      startDate,
      endDate,
      format = 'json',
    } = body;

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    // Check permissions
    if (teamSlug) {
      const hasViewPermission = await hasPermission(
        user.id,
        teamSlug,
        PERMISSIONS.SECURITY_VIEW_AUDIT_LOGS
      );

      if (!hasViewPermission && !isAdmin) {
        return NextResponse.json(
          { error: 'You do not have permission to perform eDiscovery search' },
          { status: 403 }
        );
      }
    } else if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can perform global eDiscovery search' },
        { status: 403 }
      );
    }

    // Perform search
    const { results, summary } = await searchEDiscovery({
      query,
      teamSlug,
      resourceTypes,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: 10000, // Higher limit for exports
    });

    // Log the discovery request
    await logEDiscoveryRequest({
      teamSlug,
      userId: user.id,
      queryParams: { query, teamSlug, resourceTypes, startDate, endDate },
      resultsCount: results.length,
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    });

    // Export
    let data: string;
    let contentType: string;
    let filename: string;

    if (format === 'json') {
      data = await exportToJSON(results);
      contentType = 'application/json';
      filename = `ediscovery-${Date.now()}.json`;
    } else if (format === 'csv') {
      data = await exportToCSV(results);
      contentType = 'text/csv';
      filename = `ediscovery-${Date.now()}.csv`;
    } else {
      return NextResponse.json({ error: 'Invalid format. Use json or csv' }, { status: 400 });
    }

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('eDiscovery export error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
