import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { hasPermission, isGlobalAdmin } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions-config';
import {
  getDataRegions,
  getDataRegion,
  getTeamDataResidency,
  setTeamDataResidency,
  getCrossRegionAccessLogs,
  getDataResidencySummary,
  canAccessCrossRegion,
  migrateTeamData,
} from '@/lib/data-residency/regional-db';

/**
 * GET /api/admin/compliance/data-residency
 * Get data residency settings
 *
 * Query parameters:
 * - teamSlug: Get residency for specific team
 * - summary: Return overall summary
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug');
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      // Get overall summary
      const summaryData = await getDataResidencySummary();
      return NextResponse.json({ summary: summaryData });
    }

    if (teamSlug) {
      // Check permissions for specific team
      const hasViewPermission = await hasPermission(
        user.id,
        teamSlug,
        PERMISSIONS.DATA_VIEW_REGIONS
      );

      if (!hasViewPermission && !isAdmin) {
        return NextResponse.json(
          { error: 'You do not have permission to view data residency settings' },
          { status: 403 }
        );
      }

      // Get team's residency settings
      const [residency, logs] = await Promise.all([
        getTeamDataResidency(teamSlug),
        getCrossRegionAccessLogs(teamSlug, 50),
      ]);

      return NextResponse.json({
        residency,
        crossRegionAccessLogs: logs,
      });
    }

    // Get all regions (for admin)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can view all regions' },
        { status: 403 }
      );
    }

    const [regions, summaryData] = await Promise.all([
      getDataRegions(),
      getDataResidencySummary(),
    ]);

    return NextResponse.json({
      regions,
      summary: summaryData,
    });
  } catch (error) {
    console.error('Data residency GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/compliance/data-residency
 * Set team data residency preference
 *
 * Body: {
 *   teamSlug: string,
 *   preferredRegion: string,
 *   isEnforced?: boolean
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
    const { teamSlug, preferredRegion, isEnforced = false } = body;

    if (!teamSlug || !preferredRegion) {
      return NextResponse.json(
        { error: 'teamSlug and preferredRegion are required' },
        { status: 400 }
      );
    }

    // Check permissions
    const hasManagePermission = await hasPermission(
      user.id,
      teamSlug,
      PERMISSIONS.DATA_MANAGE_RESIDENCY
    );

    if (!hasManagePermission && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to manage data residency settings' },
        { status: 403 }
      );
    }

    // Validate region exists
    const region = await getDataRegion(preferredRegion);

    if (!region) {
      return NextResponse.json(
        { error: `Invalid region: ${preferredRegion}` },
        { status: 400 }
      );
    }

    // Set residency preference
    const residency = await setTeamDataResidency(teamSlug, preferredRegion, isEnforced);

    return NextResponse.json({
      success: true,
      residency,
    }, { status: 201 });
  } catch (error) {
    console.error('Data residency POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/compliance/data-residency
 * Migrate team data to another region (admin only)
 *
 * Body: {
 *   teamSlug: string,
 *   fromRegion: string,
 *   toRegion: string
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can migrate data between regions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { teamSlug, fromRegion, toRegion } = body;

    if (!teamSlug || !fromRegion || !toRegion) {
      return NextResponse.json(
        { error: 'teamSlug, fromRegion, and toRegion are required' },
        { status: 400 }
      );
    }

    // Perform migration
    const result = await migrateTeamData(teamSlug, fromRegion, toRegion);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Migration failed', steps: result.steps },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recordsMigrated: result.recordsMigrated,
      steps: result.steps,
    });
  } catch (error) {
    console.error('Data residency migration error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
