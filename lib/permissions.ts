/**
 * Unified PostgreSQL-based RBAC System
 * Stack Auth is used ONLY for authentication, not permissions
 *
 * This system provides a single source of truth for all authorization
 * checks in the application.
 */

import {
  ROLES,
  type Role,
  PERMISSIONS,
  type Permission,
  ROLE_PERMISSIONS_MAP,
} from './permissions-config';

export { ROLES, type Role, PERMISSIONS, type Permission, ROLE_PERMISSIONS_MAP };

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize permissions in database
 * This populates the role_permissions table with the mapping above
 */
export async function initializePermissions(): Promise<void> {
  const { query } = await import('./db');

  // Clear existing permissions
  await query('DELETE FROM projectnexus.role_permissions');

  // Populate role_permissions table
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS_MAP)) {
    for (const permission of permissions) {
      await query(
        'INSERT INTO projectnexus.role_permissions (role, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [role, permission]
      );
    }
  }
}

// =====================================================
// PERMISSION CHECKING FUNCTIONS
// =====================================================

/**
 * Check if user has a specific permission in a team
 * @param userId - The user ID to check
 * @param teamSlug - The team slug to check permissions in
 * @param permission - The permission to check for
 * @returns true if user has the permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  teamSlug: string,
  permission: string
): Promise<boolean> {
  const { query } = await import('./db');

  const result = await query(
    `SELECT EXISTS(
      SELECT 1
      FROM projectnexus.role_permissions rp
      JOIN projectnexus.team_members tm ON tm.role = rp.role
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
        AND t.slug = $2
        AND tm.status = 'active'
        AND rp.permission = $3
    ) AS has_perm`,
    [userId, teamSlug, permission]
  );

  return result.rows[0]?.has_perm || false;
}

/**
 * Check if user has any of the specified permissions
 * @param userId - The user ID to check
 * @param teamSlug - The team slug to check permissions in
 * @param permissions - Array of permissions to check (OR logic)
 * @returns true if user has any of the permissions, false otherwise
 */
export async function hasAnyPermission(
  userId: string,
  teamSlug: string,
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(userId, teamSlug, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all of the specified permissions
 * @param userId - The user ID to check
 * @param teamSlug - The team slug to check permissions in
 * @param permissions - Array of permissions to check (AND logic)
 * @returns true if user has all permissions, false otherwise
 */
export async function hasAllPermissions(
  userId: string,
  teamSlug: string,
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(userId, teamSlug, permission))) {
      return false;
    }
  }
  return true;
}

/**
 * Get all permissions for a user in a team
 * @param userId - The user ID to get permissions for
 * @param teamSlug - The team slug to get permissions in
 * @returns Array of permission strings
 */
export async function getUserPermissions(
  userId: string,
  teamSlug: string
): Promise<string[]> {
  const { query } = await import('./db');

  const result = await query(
    `SELECT DISTINCT rp.permission
     FROM projectnexus.role_permissions rp
     JOIN projectnexus.team_members tm ON tm.role = rp.role
     JOIN projectnexus.teams t ON tm.team_id = t.id
     WHERE tm.user_id = $1
      AND t.slug = $2
      AND tm.status = 'active'`,
    [userId, teamSlug]
  );

  return result.rows.map((r) => r.permission);
}

/**
 * Get user's role in a team
 * @param userId - The user ID to get the role for
 * @param teamSlug - The team slug to get the role in
 * @returns The role name or null if user is not in the team
 */
export async function getUserRole(
  userId: string,
  teamSlug: string
): Promise<string | null> {
  const { query } = await import('./db');

  const result = await query(
    `SELECT tm.role
     FROM projectnexus.team_members tm
     JOIN projectnexus.teams t ON tm.team_id = t.id
     WHERE tm.user_id = $1
      AND t.slug = $2
      AND tm.status = 'active'`,
    [userId, teamSlug]
  );

  return result.rows[0]?.role || null;
}

/**
 * Check if user has a specific global role
 * @param userId - The user ID to check
 * @param role - The role to check for
 * @returns true if user has the global role, false otherwise
 */
export async function hasGlobalRole(
  userId: string,
  role: string
): Promise<boolean> {
  const { query } = await import('./db');

  const result = await query(
    `SELECT EXISTS(
      SELECT 1
      FROM projectnexus.role_assignments
      WHERE user_id = $1 AND role = $2
    ) AS has_role`,
    [userId, role]
  );

  return result.rows[0]?.has_role || false;
}

/**
 * Get all global roles for a user
 * @param userId - The user ID to get roles for
 * @returns Array of global role names
 */
export async function getGlobalRoles(userId: string): Promise<string[]> {
  const { query } = await import('./db');

  const result = await query(
    `SELECT role FROM projectnexus.role_assignments WHERE user_id = $1`,
    [userId]
  );

  return result.rows.map((r) => r.role);
}

/**
 * Check if user is a team owner or leader
 * @param userId - The user ID to check
 * @param teamSlug - The team slug to check in
 * @returns true if user is team-owner or team-leader, false otherwise
 */
export async function isTeamLeader(
  userId: string,
  teamSlug: string
): Promise<boolean> {
  const role = await getUserRole(userId, teamSlug);
  return role === ROLES.TEAM_OWNER || role === ROLES.TEAM_LEADER;
}

/**
 * Check if user is a global admin
 * @param userId - The user ID to check
 * @returns true if user is global-admin, false otherwise
 */
export async function isGlobalAdmin(userId: string): Promise<boolean> {
  return await hasGlobalRole(userId, ROLES.GLOBAL_ADMIN);
}

/**
 * Assign a global role to a user
 * @param userId - The user ID to assign the role to
 * @param role - The role to assign
 */
export async function assignGlobalRole(
  userId: string,
  role: string
): Promise<void> {
  const { query } = await import('./db');

  await query(
    `INSERT INTO projectnexus.role_assignments (user_id, role) VALUES ($1, $2)
     ON CONFLICT (user_id, role) DO NOTHING`,
    [userId, role]
  );
}

/**
 * Remove a global role from a user
 * @param userId - The user ID to remove the role from
 * @param role - The role to remove
 */
export async function removeGlobalRole(
  userId: string,
  role: string
): Promise<void> {
  const { query } = await import('./db');

  await query(
    `DELETE FROM projectnexus.role_assignments WHERE user_id = $1 AND role = $2`,
    [userId, role]
  );
}

/**
 * Update a team member's role
 * @param userId - The user ID to update
 * @param teamSlug - The team slug
 * @param newRole - The new role to assign
 */
export async function updateTeamMemberRole(
  userId: string,
  teamSlug: string,
  newRole: string
): Promise<void> {
  const { query } = await import('./db');

  await query(
    `UPDATE projectnexus.team_members
     SET role = $1, updated_at = NOW()
     FROM projectnexus.teams t
     WHERE team_members.team_id = t.id
       AND team_members.user_id = $2
       AND t.slug = $3`,
    [newRole, userId, teamSlug]
  );
}

/**
 * Get all users with a specific global role
 * @param role - The role to search for
 * @returns Array of user IDs with the role
 */
export async function getUsersWithGlobalRole(role: string): Promise<string[]> {
  const { query } = await import('./db');

  const result = await query(
    `SELECT user_id FROM projectnexus.role_assignments WHERE role = $1`,
    [role]
  );

  return result.rows.map((r) => r.user_id);
}

/**
 * Get all permissions for a user in a team, including global role permissions.
 * This is useful for UI permission checks where you need the complete permission set.
 *
 * @param options - Configuration for permission lookup
 * @param options.userId - The user ID to get permissions for
 * @param options.teamSlug - The team slug to get permissions in
 * @returns Array of permission strings (deduplicated)
 */
export async function getTeamPermissions({
  userId,
  teamSlug,
}: {
  userId: string;
  teamSlug: string;
}): Promise<Permission[]> {
  // Get team permissions
  const teamPerms = await getUserPermissions(userId, teamSlug);

  // Create a Set to deduplicate permissions
  const allPermissions = new Set<Permission>(teamPerms as Permission[]);

  // Get global roles and add their permissions
  const globalRoles = await getGlobalRoles(userId);
  for (const role of globalRoles) {
    const rolePerms = ROLE_PERMISSIONS_MAP[role] || [];
    rolePerms.forEach((p) => allPermissions.add(p as Permission));
  }

  return Array.from(allPermissions);
}

/**
 * Export the ROLE_PERMISSIONS_MAP for use in UI components
 * that need to check permissions based on roles
 */

