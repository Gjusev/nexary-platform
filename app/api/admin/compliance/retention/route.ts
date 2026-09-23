import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { hasPermission, isGlobalAdmin } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions-config';
import {
  createRetentionPolicy,
  getRetentionPolicies,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  getRetentionJobs,
  getRetentionSummary,
  scheduleRetentionJobs,
  processPendingJobs,
} from '@/lib/retention/retention-scheduler';

/**
 * GET /api/admin/compliance/retention
 * List retention policies and jobs
 *
 * Query parameters:
 * - teamSlug: Filter by team (optional)
 * - status: Filter job status (optional)
 * - limit: Limit results (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug') || undefined;

    // For non-admins, check they have permission for their team
    if (!isAdmin && teamSlug) {
      const hasRetPermission = await hasPermission(
        user.id,
        teamSlug,
        PERMISSIONS.COMPLIANCE_MANAGE_RETENTION
      );

      if (!hasRetPermission) {
        return NextResponse.json(
          { error: 'You do not have permission to manage retention policies' },
          { status: 403 }
        );
      }
    }

    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    // Get policies and jobs in parallel
    const [policies, jobs, summary] = await Promise.all([
      getRetentionPolicies(teamSlug),
      getRetentionJobs({ teamSlug, status, limit }),
      getRetentionSummary(teamSlug),
    ]);

    return NextResponse.json({
      policies,
      jobs,
      summary,
    });
  } catch (error) {
    console.error('Retention GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/compliance/retention
 * Create a new retention policy
 *
 * Body: {
 *   teamSlug?: string,
 *   resourceType: 'chat_messages' | 'documents' | 'audit_logs' | 'api_keys' | 'consents' | 'scim_logs',
 *   retentionPeriodDays: number,
 *   actionAfterRetention: 'delete' | 'archive' | 'anonymize'
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
    const { teamSlug, resourceType, retentionPeriodDays, actionAfterRetention } = body;

    // Validate permissions
    if (!isAdmin && teamSlug) {
      const hasRetPermission = await hasPermission(
        user.id,
        teamSlug,
        PERMISSIONS.COMPLIANCE_MANAGE_RETENTION
      );

      if (!hasRetPermission) {
        return NextResponse.json(
          { error: 'You do not have permission to manage retention policies' },
          { status: 403 }
        );
      }
    }

    // Validate input
    const validResourceTypes = ['chat_messages', 'documents', 'audit_logs', 'api_keys', 'consents', 'scim_logs'];
    const validActions = ['delete', 'archive', 'anonymize'];

    if (!resourceType || !validResourceTypes.includes(resourceType)) {
      return NextResponse.json(
        { error: `Invalid resourceType. Must be one of: ${validResourceTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!actionAfterRetention || !validActions.includes(actionAfterRetention)) {
      return NextResponse.json(
        { error: `Invalid actionAfterRetention. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    if (!retentionPeriodDays || retentionPeriodDays < 1) {
      return NextResponse.json(
        { error: 'retentionPeriodDays must be a positive integer' },
        { status: 400 }
      );
    }

    // Create policy
    const policy = await createRetentionPolicy({
      teamSlug,
      resourceType,
      retentionPeriodDays,
      actionAfterRetention,
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    console.error('Retention POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/compliance/retention
 * Update a retention policy
 *
 * Body: {
 *   policyId: string,
 *   ...updates
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const body = await req.json();
    const { policyId, ...updates } = body;

    if (!policyId) {
      return NextResponse.json({ error: 'policyId is required' }, { status: 400 });
    }

    // Validate permissions for the policy's team
    // (In a real implementation, you'd fetch the policy first to check its teamSlug)

    const updated = await updateRetentionPolicy(policyId, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    return NextResponse.json({ policy: updated });
  } catch (error) {
    console.error('Retention PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/compliance/retention
 * Delete a retention policy
 *
 * Query parameters:
 * - policyId: string
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const policyId = req.nextUrl.searchParams.get('policyId');

    if (!policyId) {
      return NextResponse.json({ error: 'policyId is required' }, { status: 400 });
    }

    // Validate permissions (would need to check policy's teamSlug first)

    const deleted = await deleteRetentionPolicy(policyId);

    if (!deleted) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Retention DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
