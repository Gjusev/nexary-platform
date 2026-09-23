import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';
import { runMigrations, getMigrationStatus } from '@/lib/db-migrations';
import { isGlobalAdmin } from '@/lib/permissions';
import { checkAdminRateLimit } from '@/lib/middleware/api-rate-limit';

/**
 * POST /api/admin/migrate-permissions
 *
 * Run the RBAC migrations to populate permissions and normalize roles.
 * Only accessible by global admins.
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
    const body = await request.json().catch(() => ({}));
    const { migration } = body as { migration?: string };

    // Run migrations
    let results;
    if (migration) {
      // Run specific migration
      const { runSingleMigration } = await import('@/lib/db-migrations');
      const result = await runSingleMigration(
        migration as
          | 'migrate_001_populate_permissions'
          | 'migrate_002_normalize_roles'
          | 'migrate_003_create_indexes'
          | 'migrate_004_verify_integrity'
      );
      results = [result];
    } else {
      // Run all migrations
      results = await runMigrations();
    }

    // Check for failures
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Some migrations failed',
          results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'All migrations completed successfully',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate-permissions
 *
 * Get the current migration status without running migrations.
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

    // Get migration status
    const status = await getMigrationStatus();

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get migration status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
