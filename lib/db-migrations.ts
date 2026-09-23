/**
 * Database migration scripts for the unified RBAC system
 *
 * These scripts handle:
 * 1. Populating the role_permissions table
 * 2. Normalizing role names across the database
 * 3. Creating necessary indexes
 */

import { query } from './db';

// =====================================================
// MIGRATION 001: Populate role_permissions table
// =====================================================

/**
 * Migration: Populate role_permissions table with RBAC mappings
 */
export async function migrate_001_populate_permissions(): Promise<void> {
  const { initializePermissions } = await import('./permissions');
  await initializePermissions();

  // Verify the migration worked
  const result = await query(
    "SELECT COUNT(*) as count FROM projectnexus.role_permissions"
  );

  const count = parseInt(result.rows[0]?.count || '0');
  }

// =====================================================
// MIGRATION 002: Normalize role names in team_members
// =====================================================

/**
 * Migration: Normalize inconsistent role names to standard format
 *
 * Maps old role names to new standard names:
 * - owner, TEAM_OWNER → team-owner
 * - admin, leader, TEAM_LEADER → team-leader
 * - TEAM_MEMBER → member
 */
export async function migrate_002_normalize_roles(): Promise<void> {
  const roleMapping: Record<string, string> = {
    // Map various "owner" aliases to team-owner
    'owner': 'team-owner',
    'TEAM_OWNER': 'team-owner',
    'TEAM-OWNER': 'team-owner',

    // Map various "leader" aliases to team-leader
    'admin': 'team-leader',
    'TEAM_LEADER': 'team-leader',
    'TEAM-LEADER': 'team-leader',
    'leader': 'team-leader',

    // Map various "member" aliases to member
    'TEAM_MEMBER': 'team-member',
    'TEAM-MEMBER': 'team-member',

    // Fix case for member
    'Member': 'member',
  };

  let updatedCount = 0;

  for (const [oldRole, newRole] of Object.entries(roleMapping)) {
    const result = await query(
      `UPDATE projectnexus.team_members
       SET role = $1
       WHERE role = $2`,
      [newRole, oldRole]
    );

    updatedCount += result.rowCount || 0;
  }

  }

// =====================================================
// MIGRATION 003: Create missing indexes
// =====================================================

/**
 * Migration: Create indexes for better permission query performance
 */
export async function migrate_003_create_indexes(): Promise<void> {
  const indexes = [
    // Index for role_permissions lookups
    `CREATE INDEX IF NOT EXISTS idx_role_permissions_role
     ON projectnexus.role_permissions(role)`,

    // Index for team_members user lookups
    `CREATE INDEX IF NOT EXISTS idx_team_members_user_id
     ON projectnexus.team_members(user_id)`,

    // Index for team_members status filter
    `CREATE INDEX IF NOT EXISTS idx_team_members_status
     ON projectnexus.team_members(status)`,

    // Composite index for team member lookups
    `CREATE INDEX IF NOT EXISTS idx_team_members_user_team
     ON projectnexus.team_members(user_id, team_id)`,

    // Index for role_assignments lookups
    `CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id
     ON projectnexus.role_assignments(user_id)`,

    // Index for role_assignments role lookups
    `CREATE INDEX IF NOT EXISTS idx_role_assignments_role
     ON projectnexus.role_assignments(role)`,
  ];

  for (const indexSql of indexes) {
    await query(indexSql);
  }

  }

// =====================================================
// MIGRATION 004: Verify data integrity
// =====================================================

/**
 * Migration: Verify data integrity after migrations
 */
export async function migrate_004_verify_integrity(): Promise<void> {
  // Check role_permissions is populated
  const permResult = await query(
    "SELECT COUNT(*) as count FROM projectnexus.role_permissions"
  );
  const permCount = parseInt(permResult.rows[0]?.count || '0');

  // Check team_members have valid roles
  const memberResult = await query(
    `SELECT COUNT(*) as count
     FROM projectnexus.team_members
     WHERE role NOT IN ('team-owner', 'team-leader', 'member')`
  );
  const invalidMemberCount = parseInt(memberResult.rows[0]?.count || '0');

  // Check for duplicate role_assignments
  const dupResult = await query(
    `SELECT COUNT(*) as count
     FROM (
       SELECT user_id, role, COUNT(*) as cnt
       FROM projectnexus.role_assignments
       GROUP BY user_id, role
       HAVING COUNT(*) > 1
     ) duplicates`
  );
  const dupCount = parseInt(dupResult.rows[0]?.count || '0');

  if (invalidMemberCount > 0) {
    console.warn(`[Migration 004] ⚠️ Warning: Found ${invalidMemberCount} team members with invalid roles`);
  }

  if (dupCount > 0) {
    console.warn(`[Migration 004] ⚠️ Warning: Found ${dupCount} duplicate role assignments`);
  }

  if (permCount === 0) {
    throw new Error('[Migration 004] ❌ Error: role_permissions table is empty!');
  }

  }

// =====================================================
// MIGRATION RUNNER
// =====================================================

export interface MigrationResult {
  migration: string;
  success: boolean;
  error?: string;
}

/**
 * Run all pending migrations
 * @returns Array of migration results
 */
export async function runMigrations(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  // Migration 001
  try {
    await migrate_001_populate_permissions();
    results.push({ migration: 'migrate_001_populate_permissions', success: true });
  } catch (error) {
    results.push({
      migration: 'migrate_001_populate_permissions',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('[Migration 001] ❌ Failed:', error);
    return results; // Stop on critical failure
  }

  // Migration 002
  try {
    await migrate_002_normalize_roles();
    results.push({ migration: 'migrate_002_normalize_roles', success: true });
  } catch (error) {
    results.push({
      migration: 'migrate_002_normalize_roles',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('[Migration 002] ❌ Failed:', error);
  }

  // Migration 003
  try {
    await migrate_003_create_indexes();
    results.push({ migration: 'migrate_003_create_indexes', success: true });
  } catch (error) {
    results.push({
      migration: 'migrate_003_create_indexes',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('[Migration 003] ❌ Failed:', error);
  }

  // Migration 004
  try {
    await migrate_004_verify_integrity();
    results.push({ migration: 'migrate_004_verify_integrity', success: true });
  } catch (error) {
    results.push({
      migration: 'migrate_004_verify_integrity',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('[Migration 004] ❌ Failed:', error);
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return results;
}

/**
 * Run a specific migration by name
 * @param migrationName - The name of the migration to run
 */
export async function runSingleMigration(
  migrationName: 'migrate_001_populate_permissions' |
  'migrate_002_normalize_roles' |
  'migrate_003_create_indexes' |
  'migrate_004_verify_integrity'
): Promise<MigrationResult> {
  try {
    switch (migrationName) {
      case 'migrate_001_populate_permissions':
        await migrate_001_populate_permissions();
        break;
      case 'migrate_002_normalize_roles':
        await migrate_002_normalize_roles();
        break;
      case 'migrate_003_create_indexes':
        await migrate_003_create_indexes();
        break;
      case 'migrate_004_verify_integrity':
        await migrate_004_verify_integrity();
        break;
    }
    return { migration: migrationName, success: true };
  } catch (error) {
    return {
      migration: migrationName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get migration status without running them
 * @returns Object showing which migrations are needed
 */
export async function getMigrationStatus(): Promise<{
  needsMigration: boolean;
  permissionsPopulated: boolean;
  rolesNormalized: boolean;
  indexesCreated: boolean;
}> {
  // Check if permissions are populated
  const permResult = await query(
    "SELECT COUNT(*) as count FROM projectnexus.role_permissions"
  );
  const permissionsPopulated = parseInt(permResult.rows[0]?.count || '0') > 0;

  // Check if roles are normalized
  const roleResult = await query(
    `SELECT COUNT(*) as count
     FROM projectnexus.team_members
     WHERE role NOT IN ('team-owner', 'team-leader', 'member')`
  );
  const rolesNormalized = parseInt(roleResult.rows[0]?.count || '0') === 0;

  // Assume indexes are created if permissions are populated
  const indexesCreated = permissionsPopulated;

  return {
    needsMigration: !permissionsPopulated || !rolesNormalized || !indexesCreated,
    permissionsPopulated,
    rolesNormalized,
    indexesCreated,
  };
}
