/**
 * GET /api/scim/logs?teamSlug=xyz
 * Get SCIM sync logs for a team
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getStackUser } from '@/lib/stack/get-stack-user';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug is required' },
        { status: 400 }
      );
    }

    // Check if user is team owner or leader
    const memberResult = await query(
      `SELECT role FROM team_members WHERE team_slug = $1 AND user_id = $2`,
      [teamSlug, user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this team' },
        { status: 403 }
      );
    }

    const member = memberResult.rows[0];
    if (member.role !== 'team-owner' && member.role !== 'team-leader') {
      return NextResponse.json(
        { error: 'Only team owners and leaders can view SCIM logs' },
        { status: 403 }
      );
    }

    // Get sync logs
    const logsResult = await query(
      `SELECT id, team_slug, operation, resource_type, resource_id, scim_id,
              status, error_message, created_at
       FROM projectnexus.scim_sync_logs
       WHERE team_slug = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [teamSlug, limit]
    );

    const logs = logsResult.rows.map((row) => ({
      id: row.id,
      teamSlug: row.team_slug,
      operation: row.operation,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      scimId: row.scim_id,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ logs, total: logs.length });
  } catch (error) {
    console.error('SCIM logs GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
