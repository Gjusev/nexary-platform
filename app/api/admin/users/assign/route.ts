import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';
import { assignGlobalRole, removeGlobalRole, isGlobalAdmin } from '@/lib/permissions';
import { checkAdminRateLimit } from '@/lib/middleware/api-rate-limit';
import { logGlobalRoleAssignment } from '@/lib/middleware/audit';

/**
 * POST /api/admin/users/assign
 *
 * Assign a global role to a user.
 * Only accessible by global admins.
 *
 * Body: { userId: string, role: string }
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['global-admin', 'global-rag-admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Assign role
    await assignGlobalRole(userId, role);

    // Audit: Log the role assignment
    await logGlobalRoleAssignment({
      actorUserId: user.id,
      targetUserId: userId,
      role,
      assigned: true,
    });

    return NextResponse.json({
      success: true,
      message: `Role '${role}' assigned to user '${userId}'`,
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    return NextResponse.json(
      {
        error: 'Failed to assign role',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/assign?userId=X&role=Y
 *
 * Remove a global role from a user.
 * Only accessible by global admins.
 */
export async function DELETE(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required query parameters' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['global-admin', 'global-rag-admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Remove role
    await removeGlobalRole(userId, role);

    // Audit: Log the role removal
    await logGlobalRoleAssignment({
      actorUserId: user.id,
      targetUserId: userId,
      role,
      assigned: false,
    });

    return NextResponse.json({
      success: true,
      message: `Role '${role}' removed from user '${userId}'`,
    });
  } catch (error) {
    console.error('Error removing role:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove role',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users/assign?userId=X
 *
 * Get all global roles assigned to a user.
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get global roles for user
    const { getGlobalRoles } = await import('@/lib/permissions');
    const roles = await getGlobalRoles(userId);

    return NextResponse.json({
      success: true,
      userId,
      roles,
    });
  } catch (error) {
    console.error('Error getting user roles:', error);
    return NextResponse.json(
      {
        error: 'Failed to get user roles',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
