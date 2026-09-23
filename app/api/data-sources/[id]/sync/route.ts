/**
 * Data Source Sync API
 *
 * POST /api/data-sources/[id]/sync - Trigger sync for data source
 * GET  /api/data-sources/[id]/sync/jobs - List sync jobs for data source
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getScheduler } from '@/lib/sync/scheduler';
import { getSyncProcessor } from '@/lib/sync/sync-processor';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/data-sources/[id]/sync
 * Trigger sync for data source
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    const { job_type = 'incremental', user_id } = body;

    // Check if data source exists and is active
    const result = await pool.query(
      `SELECT id, name, status, sync_enabled, archived_at
       FROM projectnexus.data_sources
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    const dataSource = result.rows[0];

    if (dataSource.archived_at) {
      return NextResponse.json(
        { error: 'Data source is archived' },
        { status: 400 }
      );
    }

    if (dataSource.status !== 'active') {
      return NextResponse.json(
        { error: `Data source is not active (status: ${dataSource.status})` },
        { status: 400 }
      );
    }

    if (!dataSource.sync_enabled) {
      return NextResponse.json(
        { error: 'Sync is disabled for this data source' },
        { status: 400 }
      );
    }

    // Trigger sync
    const scheduler = getScheduler();
    const jobId = await scheduler.triggerSync(id, 'manual', job_type, user_id);

    // Optionally process the job synchronously
    const { wait = false } = body;
    if (wait) {
      try {
        const processor = getSyncProcessor();
        await processor.processJob(jobId);
      } catch (error) {
        console.error('[Sync API] Error processing sync job:', error);
      }
    }

    return NextResponse.json({
      jobId,
      message: 'Sync job created successfully'
    });
  } catch (error) {
    console.error('[Sync API] Error triggering sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/data-sources/[id]/sync/jobs
 * List sync jobs for data source
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;

    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    let whereClause = 'WHERE data_source_id = $1';
    const values: any[] = [id];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    const result = await pool.query(
      `SELECT
        id,
        job_type as "jobType",
        trigger_type as "triggerType",
        status,
        started_at as "startedAt",
        completed_at as "completedAt",
        documents_fetched as "documentsFetched",
        documents_created as "documentsCreated",
        documents_updated as "documentsUpdated",
        documents_deleted as "documentsDeleted",
        documents_failed as "documentsFailed",
        error_message as "errorMessage",
        total_items as "totalItems",
        processed_items as "processedItems",
        progress_percentage as "progressPercentage",
        duration,
        created_at as "createdAt"
       FROM projectnexus.sync_jobs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM projectnexus.sync_jobs ${whereClause}`,
      values
    );

    return NextResponse.json({
      jobs: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('[Sync API] Error listing sync jobs:', error);
    return NextResponse.json(
      { error: 'Failed to list sync jobs' },
      { status: 500 }
    );
  }
}
