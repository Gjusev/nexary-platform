import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';
import { query } from '@/lib/db';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/team/management?teamSlug=X
 *
 * Get team details.
 * Requires team.view permission.
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get teamSlug from query
    const { searchParams } = new URL(request.url);
    const teamSlug = searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug is required' },
        { status: 400 }
      );
    }

    // Check permission
    const canView = await hasPermission(user.id, teamSlug, PERMISSIONS.TEAM_VIEW);
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get team details
    const { rows } = await query(
      `SELECT id::text, slug, name, description, created_at::text, updated_at::text
       FROM projectnexus.teams WHERE slug = $1`,
      [teamSlug]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get member count
    const { rows: memberCount } = await query(
      `SELECT COUNT(*) as count
       FROM projectnexus.team_members
       WHERE team_id = $1 AND status = 'active'`,
      [rows[0].id]
    );

    return NextResponse.json({
      success: true,
      team: {
        ...rows[0],
        memberCount: parseInt(memberCount[0]?.count || '0'),
      },
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch team',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/team/management
 *
 * Update team details (name, description).
 * Requires team.update permission.
 *
 * Body: { teamSlug: string, name?: string, description?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamSlug, name, description } = body;

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug is required' },
        { status: 400 }
      );
    }

    if (!name && !description) {
      return NextResponse.json(
        { error: 'At least name or description must be provided' },
        { status: 400 }
      );
    }

    // Check permission
    const canUpdate = await hasPermission(
      user.id,
      teamSlug,
      PERMISSIONS.TEAM_UPDATE
    );
    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Update team
    const { rows } = await query(
      `UPDATE projectnexus.teams
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           updated_at = NOW()
       WHERE slug = $1
       RETURNING id::text, slug, name, description, updated_at::text`,
      [teamSlug, name, description]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      team: rows[0],
    });
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      {
        error: 'Failed to update team',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/management?teamSlug=X
 *
 * Delete a team.
 * Requires team.delete permission.
 *
 * WARNING: This will cascade delete all team data including members,
 * RAG packages, chat conversations, etc.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get teamSlug from query
    const { searchParams } = new URL(request.url);
    const teamSlug = searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug is required' },
        { status: 400 }
      );
    }

    // Check permission
    const canDelete = await hasPermission(
      user.id,
      teamSlug,
      PERMISSIONS.TEAM_DELETE
    );
    if (!canDelete) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get team ID before deletion
    const { rows: teamRows } = await query(
      `SELECT id::text, name FROM projectnexus.teams WHERE slug = $1`,
      [teamSlug]
    );

    if (teamRows.length === 0) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const teamId = teamRows[0].id;
    const teamName = teamRows[0].name;

    // Delete team (cascades to members, RAG packages, etc.)
    await query(`DELETE FROM projectnexus.teams WHERE slug = $1`, [teamSlug]);

    // Log the deletion
    await query(
      `INSERT INTO projectnexus.audit_logs (team_slug, actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        teamSlug,
        user.id,
        'TEAM_DELETED',
        'team',
        teamId,
        JSON.stringify({ teamName }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Team '${teamName}' has been deleted`,
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete team',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
