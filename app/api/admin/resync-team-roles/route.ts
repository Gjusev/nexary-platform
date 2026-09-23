import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * API to resync all team members and fix their roles based on Stack Auth permissions
 * GET /api/admin/resync-team-roles
 */
export async function GET(request: NextRequest) {
  try {
    const adminUser = await stackServerApp.getUser();
    if (!adminUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminEmail = (adminUser as any).primaryEmail || '';
    // Get all teams from database
    const { rows: teams } = await query<{ id: string; slug: string; name: string }>(
      'SELECT id, slug, name FROM teams'
    );

    const results = [];

    for (const team of teams) {
      try {
        // Get team from Stack Auth
        const stackTeam = await stackServerApp.getTeam(team.id);
        if (!stackTeam) {
          continue;
        }

        // Get all members from Stack Auth
        const stackMembers = await (stackTeam as any).listUsers();
        if (!Array.isArray(stackMembers)) {
          continue;
        }

        const updates = [];

        for (const stackUser of stackMembers) {
          try {
            // Check current role in database
            const { rows: memberRows } = await query<{ id: string; role: string; email: string }>(
              'SELECT id, role, email FROM team_members WHERE team_id = $1 AND user_id = $2',
              [team.id, stackUser.id]
            );

            if (memberRows.length === 0) {
              continue;
            }

            const currentRole = memberRows[0].role;
            let newRole = currentRole;

            // Check Stack Auth permissions
            const hasUpdatePermission = await (stackUser as any).hasPermission?.(stackTeam, '$update_team') || false;

            // Determine correct role
            if (hasUpdatePermission) {
              // User has admin permissions in Stack Auth
              if (currentRole === 'member') {
                newRole = 'team-leader';
              }
              // Keep team-owner as is
            }

            // Update if role changed
            if (newRole !== currentRole) {
              await query(
                'UPDATE team_members SET role = $1, updated_at = NOW() WHERE id = $2',
                [newRole, memberRows[0].id]
              );

              updates.push({
                email: stackUser.primaryEmail,
                previousRole: currentRole,
                newRole: newRole
              });
            }

          } catch (userError) {
            console.error(`[Resync Team Roles] Error processing user ${stackUser.primaryEmail}:`, userError);
          }
        }

        results.push({
          teamId: team.id,
          teamName: team.name,
          membersProcessed: stackMembers.length,
          updatesApplied: updates.length,
          updates: updates
        });

      } catch (teamError) {
        console.error(`[Resync Team Roles] Error processing team ${team.id}:`, teamError);
        results.push({
          teamId: team.id,
          teamName: team.name,
          error: teamError instanceof Error ? teamError.message : 'Unknown error'
        });
      }
    }

    const totalUpdates = results.reduce((sum, r) => sum + (r.updatesApplied || 0), 0);

    return NextResponse.json({
      success: true,
      message: `Resync completed. ${totalUpdates} role updates applied across ${teams.length} teams.`,
      totalTeams: teams.length,
      totalUpdates: totalUpdates,
      results: results
    });

  } catch (error) {
    console.error('[Resync Team Roles] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
