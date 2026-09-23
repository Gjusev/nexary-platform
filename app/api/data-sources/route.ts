/**
 * Data Sources API
 *
 * GET    /api/data-sources - List data sources
 * POST   /api/data-sources - Create new data source
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { encryptCredentials } from '@/lib/crypto-utils';
import { ConnectorFactory, type SupportedConnectorType } from '@/lib/connectors/connector-factory';
import { getScheduler } from '@/lib/sync/scheduler';
import { validateConnectorConfig } from '@/lib/connectors/connector-factory';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

/**
 * GET /api/data-sources
 * List data sources for a team
 */
export async function GET(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const teamSlug = searchParams.get('team_slug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'team_slug query parameter is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT
        id,
        team_slug as "teamSlug",
        name,
        source_type as "sourceType",
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
        auto_rag_package_ids as "autoRagPackageIds"
       FROM projectnexus.data_sources
       WHERE team_slug = $1
         AND archived_at IS NULL
       ORDER BY created_at DESC`,
      [teamSlug]
    );

    // Get metadata for each source type
    const sources = result.rows.map(row => ({
      ...row,
      metadata: ConnectorFactory.getSourceMetadata(row.sourceType)
    }));

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('[Data Sources API] Error listing data sources:', error);
    return NextResponse.json(
      { error: 'Failed to list data sources' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-sources
 * Create a new data source
 */
export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();

    const {
      team_slug,
      name,
      source_type,
      config,
      sync_frequency = 'manual',
      sync_enabled = true,
      auto_rag_package_ids = []
    } = body;

    // Validate required fields
    if (!team_slug || !name || !source_type || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: team_slug, name, source_type, config' },
        { status: 400 }
      );
    }

    // Validate connector config
    const validation = validateConnectorConfig(source_type, config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Check if source type is supported
    if (!ConnectorFactory.isSupported(source_type)) {
      return NextResponse.json(
        {
          error: `Unsupported source type: ${source_type}`,
          supported_types: ConnectorFactory.getSupportedSources().map(s => s.type)
        },
        { status: 400 }
      );
    }

    // Encrypt credentials
    const encryptedCredentials = await encryptCredentials(config.credentials || {});

    // Insert data source
    const result = await pool.query(
      `INSERT INTO projectnexus.data_sources (
        team_slug,
        name,
        source_type,
        config,
        sync_frequency,
        sync_enabled,
        auto_rag_package_ids,
        status,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
      RETURNING id, created_at as "createdAt"`,
      [
        team_slug,
        name,
        source_type,
        JSON.stringify({ ...config, credentials: encryptedCredentials }),
        sync_frequency,
        sync_enabled,
        auto_rag_package_ids,
        body.created_by || 'api'
      ]
    );

    const dataSourceId = result.rows[0].id;

    // Schedule sync if enabled and not manual
    if (sync_enabled && sync_frequency !== 'manual') {
      const scheduler = getScheduler();
      await scheduler.scheduleDataSource(dataSourceId, sync_frequency);
    }

    return NextResponse.json(
      {
        id: dataSourceId,
        createdAt: result.rows[0].createdAt,
        message: 'Data source created successfully'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Data Sources API] Error creating data source:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create data source' },
      { status: 500 }
    );
  }
}
