/**
 * GET /api/user/permissions
 *
 * Get the current user's permissions for a specific team.
 * Returns both team role permissions and global role permissions combined.
 *
 * Query Parameters:
 * - teamSlug: The team slug to get permissions for (required)
 *
 * Returns:
 * - permissions: Array of permission strings
 */
import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';
import { getTeamPermissions } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get teamSlug from query parameters
    const teamSlug = request.nextUrl.searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'teamSlug query parameter is required' },
        { status: 400 }
      );
    }

    // Get permissions for the user in the team (includes global role permissions)
    const permissions = await getTeamPermissions({
      userId: user.id,
      teamSlug,
    });

    return NextResponse.json({
      permissions,
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user permissions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
