/**
 * Database management API endpoints.
 *
 * GET /api/admin/database - Get database statistics
 * POST /api/admin/database/analyze - Analyze tables
 * POST /api/admin/database/vacuum - Run VACUUM ANALYZE
 * POST /api/admin/database/refresh-views - Refresh materialized views
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTableStats,
  getIndexUsage,
  getPoolStats,
  analyzeSlowQueries,
  analyzeTables,
  vacuumAnalyze,
  refreshMaterializedViews,
  createOptimizedIndexes,
  createMaterializedViews,
} from '@/lib/db/optimize';
import { isGlobalAdmin } from '@/lib/permissions';

/**
 * GET /api/admin/database - Get database statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin permissions
    const userId = req.headers.get('x-user-id');
    if (!userId || !(await isGlobalAdmin(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'summary';

    if (view === 'tables') {
      const stats = await getTableStats();
      return NextResponse.json({ success: true, stats });
    }

    if (view === 'indexes') {
      const indexes = await getIndexUsage();
      return NextResponse.json({ success: true, indexes });
    }

    if (view === 'slow-queries') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const queries = await analyzeSlowQueries(limit);
      return NextResponse.json({ success: true, queries });
    }

    // Default: summary view
    const [tables, poolStats] = await Promise.all([
      getTableStats(),
      getPoolStats(),
    ]);

    return NextResponse.json({
      success: true,
      summary: {
        totalTables: tables.length,
        totalSize: tables.reduce((sum, t) => sum + parseSize(t.total_size), 0),
        totalRows: tables.reduce((sum, t) => sum + (parseInt(t.row_count) || 0), 0),
        poolConnections: poolStats.totalCount,
        poolIdle: poolStats.idleCount,
        poolWaiting: poolStats.waitingCount,
      },
      tables: tables.slice(0, 10), // Top 10 tables by size
    });
  } catch (error) {
    console.error('Database stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get database statistics', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/database - Perform database maintenance operations
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin permissions
    const userId = req.headers.get('x-user-id');
    if (!userId || !(await isGlobalAdmin(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'analyze':
        await analyzeTables();
        return NextResponse.json({ success: true, message: 'Tables analyzed' });

      case 'vacuum':
        await vacuumAnalyze();
        return NextResponse.json({ success: true, message: 'VACUUM ANALYZE completed' });

      case 'refresh-views':
        await refreshMaterializedViews();
        return NextResponse.json({ success: true, message: 'Materialized views refreshed' });

      case 'create-indexes':
        await createOptimizedIndexes();
        return NextResponse.json({ success: true, message: 'Optimized indexes created' });

      case 'create-views':
        await createMaterializedViews();
        return NextResponse.json({ success: true, message: 'Materialized views created' });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database operation error:', error);
    return NextResponse.json(
      { error: 'Database operation failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Parse size string like "1.5 GB" to bytes
 */
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(\w+)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    bytes: 1,
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}
