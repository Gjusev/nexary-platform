/**
 * Data Source API (Individual)
 *
 * GET    /api/data-sources/[id] - Get data source details
 * PUT    /api/data-sources/[id] - Update data source
 * DELETE /api/data-sources/[id] - Delete data source
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { encryptCredentials, decryptCredentials } from '@/lib/crypto-utils';
import { ConnectorFactory } from '@/lib/connectors/connector-factory';
import { getScheduler } from '@/lib/sync/scheduler';
import { validateConnectorConfig } from '@/lib/connectors/connector-factory';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/data-sources/[id]
 * Get data source details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await context.params;

    const result = await pool.query(
      `SELECT
        id,
        team_slug as "teamSlug",
        name,
        source_type as "sourceType",
        config,
        sync_frequency as "syncFrequency",
        sync_enabled as "syncEnabled",
        last_sync_at as "lastSyncAt",
        next_sync_at as "nextSyncAt",
        status,
        health_status as "healthStatus",
        last_error as "lastError",
        created_at as "createdAt",
        updated_at as "updatedAt",
        archived_at as "archivedAt",
        auto_rag_package_ids as "autoRagPackageIds",
        created_by
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

    const row = result.rows[0];

    // Get metadata for source type
    const metadata = ConnectorFactory.getSourceMetadata(row.sourceType);

    // Don't return encrypted credentials
    const { config, ...safeRow } = row;

    return NextResponse.json({
      ...safeRow,
      metadata,
      hasCredentials: !!(config && config.credentials)
    });
  } catch (error) {
    console.error('[Data Source API] Error getting data source:', error);
    return NextResponse.json(
      { error: 'Failed to get data source' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/data-sources/[id]
 * Update data source
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    // Check if data source exists
    const existingResult = await pool.query(
      'SELECT id, config, sync_frequency, sync_enabled FROM projectnexus.data_sources WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    const existing = existingResult.rows[0];

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name);
    }

    if (body.sync_frequency !== undefined) {
      updates.push(`sync_frequency = $${paramIndex++}`);
      values.push(body.sync_frequency);
    }

    if (body.sync_enabled !== undefined) {
      updates.push(`sync_enabled = $${paramIndex++}`);
      values.push(body.sync_enabled);
    }

    if (body.auto_rag_package_ids !== undefined) {
      updates.push(`auto_rag_package_ids = $${paramIndex++}`);
      values.push(body.auto_rag_package_ids);
    }

    if (body.config !== undefined) {
      // Validate connector config
      const validation = validateConnectorConfig(existing.source_type, body.config);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      // Encrypt new credentials
      const encryptedCredentials = await encryptCredentials(
        body.config.credentials || {}
      );

      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify({ ...body.config, credentials: encryptedCredentials }));
    }

    updates.push(`updated_at = $${paramIndex++}`);

    values.push(id);

    if (updates.length === 1) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update data source
    await pool.query(
      `UPDATE projectnexus.data_sources SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Reschedule if sync settings changed
    if (body.sync_frequency !== undefined || body.sync_enabled !== undefined) {
      const scheduler = getScheduler();

      if (body.sync_enabled === false || body.sync_frequency === 'manual') {
        await scheduler.unscheduleDataSource(id);
      } else {
        const frequency = body.sync_frequency || existing.sync_frequency;
        await scheduler.rescheduleDataSource(id, frequency);
      }
    }

    return NextResponse.json({
      message: 'Data source updated successfully'
    });
  } catch (error) {
    console.error('[Data Source API] Error updating data source:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update data source' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data-sources/[id]
 * Delete (archive) data source
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await context.params;

    // Archive instead of delete
    await pool.query(
      'UPDATE projectnexus.data_sources SET archived_at = NOW(), sync_enabled = FALSE WHERE id = $1',
      [id]
    );

    // Unschedule sync
    const scheduler = getScheduler();
    await scheduler.unscheduleDataSource(id);

    return NextResponse.json({
      message: 'Data source deleted successfully'
    });
  } catch (error) {
    console.error('[Data Source API] Error deleting data source:', error);
    return NextResponse.json(
      { error: 'Failed to delete data source' },
      { status: 500 }
    );
  }
}
