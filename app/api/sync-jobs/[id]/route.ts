/**
 * Sync Job API
 *
 * GET    /api/sync-jobs/[id] - Get sync job details
 * DELETE /api/sync-jobs/[id] - Cancel sync job
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getScheduler } from '@/lib/sync/scheduler';
import { getSyncProcessor } from '@/lib/sync/sync-processor';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/sync-jobs/[id]
 * Get sync job details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const result = await pool.query(
      `SELECT
        j.id,
        j.data_source_id as "dataSourceId",
        ds.name as "dataSourceName",
        ds.source_type as "sourceType",
        j.job_type as "jobType",
        j.trigger_type as "triggerType",
        j.status,
        j.started_at as "startedAt",
        j.completed_at as "completedAt",
        j.documents_fetched as "documentsFetched",
        j.documents_created as "documentsCreated",
        j.documents_updated as "documentsUpdated",
        j.documents_deleted as "documentsDeleted",
        j.documents_failed as "documentsFailed",
        j.error_message as "errorMessage",
        j.error_count as "errorCount",
        j.total_items as "totalItems",
        j.processed_items as "processedItems",
        j.progress_percentage as "progressPercentage",
        j.duration,
        j.metadata,
        j.created_at as "createdAt"
       FROM projectnexus.sync_jobs j
       JOIN projectnexus.data_sources ds ON ds.id = j.data_source_id
       WHERE j.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Sync job not found' },
        { status: 404 }
      );
    }

    const job = result.rows[0];

    // Calculate duration if not set
    if (!job.duration && job.startedAt) {
      const endTime = job.completedAt ? new Date(job.completedAt) : new Date();
      const startTime = new Date(job.startedAt);
      job.duration = endTime.getTime() - startTime.getTime();
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('[Sync Job API] Error getting sync job:', error);
    return NextResponse.json(
      { error: 'Failed to get sync job' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync-jobs/[id]
 * Cancel sync job
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Check if job can be cancelled
    const result = await pool.query(
      'SELECT status FROM projectnexus.sync_jobs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Sync job not found' },
        { status: 404 }
      );
    }

    const { status } = result.rows[0];

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      return NextResponse.json(
        { error: `Cannot cancel job with status: ${status}` },
        { status: 400 }
      );
    }

    // Cancel the job
    const scheduler = getScheduler();
    const cancelled = await scheduler.cancelSync(id);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Failed to cancel sync job' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Sync job cancelled successfully'
    });
  } catch (error) {
    console.error('[Sync Job API] Error cancelling sync job:', error);
    return NextResponse.json(
      { error: 'Failed to cancel sync job' },
      { status: 500 }
    );
  }
}
