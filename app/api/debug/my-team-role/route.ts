import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * Debug endpoint to check user's team membership and roles
 * GET /api/debug/my-team-role
 */
export async function GET(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = (user as any).primaryEmail || '';
    const userId = (user as any).id || '';

    // Get teams from Stack Auth
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ 
        error: 'No team found',
        userEmail,
        userId,
        teamsCount: teams.length
      });
    }

    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName;

    // Check Stack Auth permissions
    const hasUpdatePermission = await (user as any).hasPermission?.(selectedTeam, '$update_team') || false;

    // Check PostgreSQL team_members table
    const { rows: memberRows } = await query<{ 
      id: string;
      role: string;
      status: string;
      joined_at: Date;
    }>(
      'SELECT id, role, status, joined_at FROM team_members WHERE team_id = $1 AND email = $2',
      [teamId, userEmail]
    );

    // Check PostgreSQL teams table
    const { rows: teamRows } = await query<{
      id: string;
      slug: string;
      name: string;
    }>(
      'SELECT id, slug, name FROM teams WHERE id = $1',
      [teamId]
    );

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: userEmail,
      },
      stackAuth: {
        teamId,
        teamName,
        hasUpdatePermission,
        teamsCount: teams.length,
      },
      database: {
        teamExists: teamRows.length > 0,
        teamInfo: teamRows[0] || null,
        membershipExists: memberRows.length > 0,
        membership: memberRows[0] || null,
      },
      diagnosis: {
        canCreateRAG: hasUpdatePermission || 
          (memberRows.length > 0 && ['team-leader', 'team-owner', 'owner'].includes(memberRows[0].role)),
        reason: memberRows.length === 0 
          ? 'User not found in team_members table'
          : !hasUpdatePermission && !['team-leader', 'team-owner', 'owner'].includes(memberRows[0]?.role)
          ? `User role is "${memberRows[0]?.role}" which is not sufficient`
          : 'User has sufficient permissions'
      }
    });

  } catch (error) {
    console.error('[Debug My Team Role] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
