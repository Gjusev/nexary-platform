import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { isGlobalAdmin } from '@/lib/permissions';
import {
  validateSOC2Controls,
  getSOC2Summary,
  getAvailabilityMetrics,
  validateProcessingIntegrity,
} from '@/lib/compliance/soc2-controls';

/**
 * GET /api/admin/compliance/soc2
 * Get SOC 2 compliance status and controls
 *
 * Query parameters:
 * - summary: Return summary only (default: false)
 * - category: Filter by control category (optional)
 */
export async function GET(req: NextRequest) {
  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is global admin
    const isAdmin = await isGlobalAdmin(user.id);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can access compliance data' },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const summaryOnly = searchParams.get('summary') === 'true';

    if (summaryOnly) {
      // Return summary only
      const summary = await getSOC2Summary();
      return NextResponse.json({ summary });
    }

    // Get date range for availability metrics
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let availabilityData = null;
    if (startDate && endDate) {
      availabilityData = await getAvailabilityMetrics(
        new Date(startDate),
        new Date(endDate)
      );
    }

    // Get all control validations
    const controls = await validateSOC2Controls();
    const summary = await getSOC2Summary();
    const integrity = await validateProcessingIntegrity();

    return NextResponse.json({
      controls,
      summary,
      integrity,
      availability: availabilityData,
    });
  } catch (error) {
    console.error('SOC 2 compliance check error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
