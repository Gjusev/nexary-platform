import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';
import { query } from '@/lib/db';
import { isGlobalAdmin } from '@/lib/permissions';
import { checkAdminRateLimit } from '@/lib/middleware/api-rate-limit';
import type { StackUser } from '@/lib/types/user';

// Extended Stack server app with listUsers method
interface StackServerAppWithListUsers {
  listUsers: () => Promise<ServerUser[]>;
}

interface ServerUser {
  id: string;
  primaryEmail: string | null;
  email?: string | null;
  displayName: string | null;
  createdAt?: string;
  lastActiveAt?: string;
}

/**
 * GET /api/admin/users
 *
 * List all users with their roles and team information.
 * Only accessible by global admins.
 */
export async function GET(request: NextRequest) {
  // Security: Rate limiting check
  const rateLimitResponse = checkAdminRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is global admin
    const isAdmin = await isGlobalAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Requires global-admin role' },
        { status: 403 }
      );
    }

    // Get all users from Stack Auth
    const app = stackServerApp as unknown as StackServerAppWithListUsers;
    const allUsers = await app.listUsers();

    // Enhance with PostgreSQL data (roles and team info)
    const users = await Promise.all(
      (allUsers || []).map(async (stackUser: ServerUser) => {
        // Get team role and info
        const { rows: teamRows } = await query(
          `SELECT tm.role, t.slug as team_slug, t.name as team_name
           FROM projectnexus.team_members tm
           JOIN projectnexus.teams t ON tm.team_id = t.id
           WHERE tm.user_id = $1 AND tm.status = 'active'
           LIMIT 1`,
          [stackUser.id]
        );

        // Get global roles
        const { rows: globalRows } = await query(
          `SELECT role FROM projectnexus.role_assignments WHERE user_id = $1`,
          [stackUser.id]
        );

        // Combine roles
        const teamRole = teamRows[0]?.role || null;
        const globalRoles = globalRows.map((r) => r.role);
        const allRoles = [...globalRoles];
        if (teamRole) {
          allRoles.push(teamRole);
        }

        return {
          id: stackUser.id,
          email: stackUser.primaryEmail || stackUser.email,
          displayName: stackUser.displayName,
          roles: allRoles,
          globalRoles,
          teamRole,
          team: teamRows[0]
            ? {
                slug: teamRows[0].team_slug,
                name: teamRows[0].team_name,
              }
            : null,
          createdAt: stackUser.createdAt,
          lastActiveAt: stackUser.lastActiveAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 *
 * Create a new user (placeholder for future functionality).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Requires global-admin role' },
        { status: 403 }
      );
    }

    // User creation is handled through Stack Auth registration
    return NextResponse.json(
      {
        error: 'User creation is handled through the registration flow',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      {
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
