import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { isGlobalAdmin } from '@/lib/permissions';
import {
  scheduleRetentionJobs,
  processPendingJobs,
} from '@/lib/retention/retention-scheduler';

/**
 * POST /api/admin/compliance/retention/process
 * Process retention jobs (admin only)
 *
 * Query parameters:
 * - action: 'schedule' | 'process'
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only global admins can process retention jobs
    const isAdmin = await isGlobalAdmin(user.id);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can process retention jobs' },
        { status: 403 }
      );
    }

    const action = req.nextUrl.searchParams.get('action') || 'process';

    if (action === 'schedule') {
      // Schedule new retention jobs
      const jobsCreated = await scheduleRetentionJobs();
      return NextResponse.json({
        success: true,
        jobsCreated,
        message: `${jobsCreated} retention job(s) scheduled`,
      });
    }

    if (action === 'process') {
      // Process pending retention jobs
      const processedJobs = await processPendingJobs();
      return NextResponse.json({
        success: true,
        jobsProcessed: processedJobs.length,
        jobs: processedJobs,
        message: `${processedJobs.length} retention job(s) processed`,
      });
    }

    return NextResponse.json(
      { error: `Invalid action. Must be 'schedule' or 'process'` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Retention process error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
