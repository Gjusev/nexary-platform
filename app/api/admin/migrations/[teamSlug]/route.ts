/**
 * GET /api/admin/migrations/[teamSlug] - Get migration status and report
 * POST /api/admin/migrations/[teamSlug] - Start migration
 * PUT /api/admin/migrations/[teamSlug] - Update migration mode
 * DELETE /api/admin/migrations/[teamSlug] - Rollback migration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMigrationReport,
  startMigration,
  updateMigrationMode,
  rollbackMigration,
  completeMigration,
} from '@/lib/authentik/migration-tools';

export const runtime = 'nodejs';

/**
 * GET migration report
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    const { teamSlug } = await params;

    const report = await getMigrationReport(teamSlug);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Migration report error:', error);
    return NextResponse.json(
      { error: 'Failed to get migration report' },
      { status: 500 }
    );
  }
}

/**
 * POST start migration
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    const { teamSlug } = await params;

    const body = await req.json();
    const { mode, canaryPercentage, canaryUserEmails } = body;

    if (!mode || !['shadow', 'canary', 'full'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid migration mode. Must be: shadow, canary, or full' },
        { status: 400 }
      );
    }

    const migration = await startMigration(teamSlug, {
      mode,
      canaryPercentage,
      canaryUserEmails,
    });

    return NextResponse.json({
      message: 'Migration started successfully',
      migration,
    });
  } catch (error) {
    console.error('Migration start error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to start migration';

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}

/**
 * PUT update migration mode
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    const { teamSlug } = await params;

    const body = await req.json();
    const { mode, canaryPercentage, canaryUserEmails } = body;

    if (!mode || !['off', 'shadow', 'canary', 'full'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid migration mode' },
        { status: 400 }
      );
    }

    const migration = await updateMigrationMode(teamSlug, mode, {
      canaryPercentage,
      canaryUserEmails,
    });

    // If mode is 'full', complete the migration
    if (mode === 'full') {
      await completeMigration(teamSlug);
    }

    return NextResponse.json({
      message: 'Migration mode updated successfully',
      migration,
    });
  } catch (error) {
    console.error('Migration update error:', error);
    return NextResponse.json(
      { error: 'Failed to update migration mode' },
      { status: 500 }
    );
  }
}

/**
 * DELETE rollback migration
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    const { teamSlug } = await params;

    const body = await req.json().catch(() => ({}));
    const { reason = 'Manual rollback' } = body;

    await rollbackMigration(teamSlug, reason);

    return NextResponse.json({
      message: 'Migration rolled back successfully',
    });
  } catch (error) {
    console.error('Migration rollback error:', error);
    return NextResponse.json(
      { error: 'Failed to rollback migration' },
      { status: 500 }
    );
  }
}
