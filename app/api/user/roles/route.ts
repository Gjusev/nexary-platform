import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';
import {
  getUserRole,
  getGlobalRoles,
  getUserPermissions,
} from '@/lib/permissions';

/**
 * GET /api/user/roles
 *
 * Get the current user's roles from PostgreSQL.
 * Returns both team role and global roles.
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's teams from Stack Auth
    const teams = await user.listTeams();
    const currentTeam = teams?.[0] || null;

    let teamRole = null;
    let teamSlug = null;
    let permissions: string[] = [];

    // Get team role if user has a team
    if (currentTeam) {
      teamSlug = currentTeam.id;
      teamRole = await getUserRole(user.id, currentTeam.id);

      // Get user's permissions for the team
      if (teamRole) {
        permissions = await getUserPermissions(user.id, currentTeam.id);
      }
    }

    // Get global roles
    const globalRoles = await getGlobalRoles(user.id);

    // Combine all roles
    const allRoles = [...globalRoles];
    if (teamRole) {
      allRoles.push(teamRole);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.primaryEmail,
        displayName: user.displayName,
      },
      currentTeam: currentTeam
        ? {
            id: currentTeam.id,
            displayName: currentTeam.displayName,
          }
        : null,
      roles: {
        all: allRoles,
        team: teamRole,
        global: globalRoles,
      },
      teamSlug,
      permissions,
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user roles',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
