import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * API to promote a user to team-leader
 * POST /api/admin/promote-to-leader
 * Body: { userEmail: string, teamId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const adminUser = await stackServerApp.getUser();
    if (!adminUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify admin has permissions
    const teams = await (adminUser as any).listTeams?.() || [];
    const selectedTeam = (adminUser as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json({ error: 'Admin not in any team' }, { status: 400 });
    }

    const hasUpdatePermission = await (adminUser as any).hasPermission?.(selectedTeam, '$update_team') || false;
    const adminEmail = (adminUser as any).primaryEmail || '';
    
    // Check if admin is owner in DB
    const { rows: adminRows } = await query<{ role: string }>(
      'SELECT role FROM team_members WHERE team_id = $1 AND email = $2',
      [selectedTeam.id, adminEmail]
    );
    
    const isAdmin = hasUpdatePermission || 
      (adminRows.length > 0 && ['team-owner', 'owner'].includes(adminRows[0].role));
    
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Forbidden - Only team owners can promote users' 
      }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { userEmail, teamId } = body;

    if (!userEmail) {
      return NextResponse.json({ error: 'userEmail is required' }, { status: 400 });
    }

    const targetTeamId = teamId || selectedTeam.id;

    // Check if user exists in team
    const { rows: userRows } = await query<{ 
      id: string;
      role: string;
      user_id: string;
    }>(
      'SELECT id, role, user_id FROM team_members WHERE team_id = $1 AND email = $2',
      [targetTeamId, userEmail]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ 
        error: 'User not found in team',
        userEmail,
        teamId: targetTeamId
      }, { status: 404 });
    }

    const currentRole = userRows[0].role;

    // Update role to team-leader
    await query(
      `UPDATE team_members 
       SET role = $1, updated_at = NOW()
       WHERE team_id = $2 AND email = $3`,
      ['team-leader', targetTeamId, userEmail]
    );

    // Verify update
    const { rows: updatedRows } = await query<{ role: string }>(
      'SELECT role FROM team_members WHERE team_id = $1 AND email = $2',
      [targetTeamId, userEmail]
    );

    return NextResponse.json({
      success: true,
      message: `User ${userEmail} promoted to team-leader`,
      previousRole: currentRole,
      newRole: updatedRows[0].role,
      teamId: targetTeamId,
      updatedBy: adminEmail
    });

  } catch (error) {
    console.error('[Promote to Leader] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to list all team members and their roles
 */
export async function GET(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json({ error: 'Not in any team' }, { status: 400 });
    }

    const { rows: members } = await query<{
      id: string;
      user_id: string;
      email: string;
      name: string | null;
      role: string;
      status: string;
      joined_at: Date;
    }>(
      `SELECT id, user_id, email, name, role, status, joined_at 
       FROM team_members 
       WHERE team_id = $1 
       ORDER BY joined_at ASC`,
      [selectedTeam.id]
    );

    return NextResponse.json({
      success: true,
      teamId: selectedTeam.id,
      teamName: selectedTeam.displayName,
      members: members.map(m => ({
        id: m.id,
        userId: m.user_id,
        email: m.email,
        name: m.name,
        role: m.role,
        status: m.status,
        joinedAt: m.joined_at
      }))
    });

  } catch (error) {
    console.error('[List Team Members] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
