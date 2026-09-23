import { query, initializeTables } from '@/lib/db';
import { createStackServerApp } from '@/lib/stack/stack-server';
import { findTeamBySlug } from '@/lib/stack/client';
import type { StackTeam, StackUser } from '@/lib/types/user';

export type TeamMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  status: 'active' | 'suspended' | 'removed';
  joinedAt: Date;
  lastActive: Date | null;
  suspendedAt: Date | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
};

// Sync Stack Auth team members with PostgreSQL
async function syncTeamMembersFromStackAuth(teamId: string, teamSlug: string): Promise<void> {
  try {
    const app = createStackServerApp();
    const team = await app.getTeam(teamId);
    if (!team) return;

    // Get team members using listUsers() method
    // Type assertion needed because listUsers is not in public StackTeam interface
    const typedTeam = team as unknown as StackTeam;
    const stackMembers = await typedTeam.listUsers?.() || [];

    if (!Array.isArray(stackMembers)) {
      console.warn('listUsers() did not return an array, skipping sync');
      return;
    }
    
    // Check if any members exist yet - if not, first user should be owner
    const { rows: existingMembers } = await query<{ id: string }>(
      'SELECT id FROM team_members WHERE team_id = $1',
      [teamId]
    );
    const isFirstSync = existingMembers.length === 0;
    
    for (let i = 0; i < stackMembers.length; i++) {
      const teamUser = stackMembers[i];
      
      // Check if user exists in our database
      const { rows: existingRows } = await query<{ id: string }>(
        `SELECT id FROM team_members 
         WHERE user_id = $1 AND team_id = $2`,
        [teamUser.id, teamId]
      );

      if (existingRows.length === 0) {
        // Determine role: first user in first sync becomes owner, others are members
        // Also check if user has $update_team permission in Stack Auth
        let role = 'member';
        
        if (isFirstSync && i === 0) {
          // First user in a new team should be owner
          role = 'team-owner';
        } else {
          // Check Stack Auth permissions
          try {
            const typedTeamUser = teamUser as unknown as StackUser;
            const hasUpdatePermission = await typedTeamUser.hasPermission?.(team, '$update_team') || false;
            if (hasUpdatePermission) {
              role = 'team-leader';
            }
          } catch (err) {
            // If permission check fails, keep as member
          }
        }
        
        // Add new member to our database
        await query(
          `INSERT INTO team_members 
           (team_id, user_id, email, name, role, status, joined_at)
           VALUES ($1, $2, $3, $4, $5, 'active', NOW())
           ON CONFLICT (team_id, user_id) DO NOTHING`,
          [teamId, teamUser.id, teamUser.primaryEmail, teamUser.displayName, role]
        );
      }
    }
  } catch (error) {
    console.error('Error syncing team members from Stack Auth:', error);
  }
}

export async function getTeamMembers(teamSlugOrId: string): Promise<TeamMember[]> {
  // Ensure tables exist
  await initializeTables();
  
  // Get team info from Stack Auth - now accepts both slug and ID
  let team = await findTeamBySlug(teamSlugOrId);
  
  // If not found by slug, try by ID
  if (!team) {
    const { findTeamById } = await import('@/lib/stack/client');
    team = await findTeamById(teamSlugOrId);
  }
  
  if (!team) {
    console.error(`[getTeamMembers] Team not found with slug/id: ${teamSlugOrId}`);
    throw new Error('Team not found');
  }
  
  // Ensure team exists in PostgreSQL - use team ID as slug for consistency
  await ensureTeamInDatabase(team.id, team.id, team.name);

  // Sync members from Stack Auth first - use team ID
  await syncTeamMembersFromStackAuth(team.id, team.id);
  const { rows } = await query<{
    id: string;
    user_id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    joined_at: Date;
    last_active: Date | null;
    suspended_at: Date | null;
    suspended_by: string | null;
    suspension_reason: string | null;
  }>(
    `SELECT 
       tm.id,
       tm.user_id,
       tm.email,
       tm.name,
       tm.role,
       tm.status,
       tm.joined_at,
       tm.last_active,
       tm.suspended_at,
       tm.suspended_by,
       tm.suspension_reason
     FROM team_members tm
     WHERE tm.team_id = $1 
     AND tm.status != 'removed'
     ORDER BY tm.joined_at ASC`,
    [team.id]
  );

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status as TeamMember['status'],
    joinedAt: row.joined_at,
    lastActive: row.last_active,
    suspendedAt: row.suspended_at,
    suspendedBy: row.suspended_by,
    suspensionReason: row.suspension_reason,
  }));
}

// Ensure team exists in PostgreSQL
async function ensureTeamInDatabase(teamId: string, teamSlug: string, teamName: string): Promise<void> {
  try {
    await query(
      `INSERT INTO teams (id, slug, name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug,
         name = EXCLUDED.name,
         updated_at = NOW()`,
      [teamId, teamSlug, teamName]
    );
  } catch (error) {
    console.error('Error ensuring team in database:', error);
  }
}

export async function updateMemberRole(
  memberId: string, 
  newRole: string, 
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { rowCount } = await query(
      `UPDATE team_members 
       SET role = $1, updated_at = NOW(), updated_by = $2
       WHERE id = $3 AND status = 'active'`,
      [newRole, updatedBy, memberId]
    );

    if (rowCount === 0) {
      return { success: false, error: 'Miembro no encontrado o no activo' };
    }

    // Log the role change
    await query(
      `INSERT INTO team_member_logs (member_id, action, details, performed_by, performed_at)
       VALUES ($1, 'role_change', $2, $3, NOW())`,
      [memberId, `Role changed to ${newRole}`, updatedBy]
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating member role:', error);
    return { success: false, error: 'Error al actualizar el rol' };
  }
}

export async function suspendMember(
  memberId: string, 
  suspendedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { rowCount } = await query(
      `UPDATE team_members 
       SET status = 'suspended', 
           suspended_at = NOW(), 
           suspended_by = $1,
           suspension_reason = $2,
           updated_at = NOW()
       WHERE id = $3 AND status = 'active'`,
      [suspendedBy, reason || 'No reason provided', memberId]
    );

    if (rowCount === 0) {
      return { success: false, error: 'Miembro no encontrado o ya suspendido' };
    }

    // Log the suspension
    await query(
      `INSERT INTO team_member_logs (member_id, action, details, performed_by, performed_at)
       VALUES ($1, 'suspended', $2, $3, NOW())`,
      [memberId, reason || 'Member suspended', suspendedBy]
    );

    return { success: true };
  } catch (error) {
    console.error('Error suspending member:', error);
    return { success: false, error: 'Error al suspender miembro' };
  }
}

export async function reactivateMember(
  memberId: string, 
  reactivatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { rowCount } = await query(
      `UPDATE team_members 
       SET status = 'active', 
           suspended_at = NULL, 
           suspended_by = NULL,
           suspension_reason = NULL,
           updated_at = NOW()
       WHERE id = $1 AND status = 'suspended'`,
      [memberId]
    );

    if (rowCount === 0) {
      return { success: false, error: 'Miembro no encontrado o no suspendido' };
    }

    // Log the reactivation
    await query(
      `INSERT INTO team_member_logs (member_id, action, details, performed_by, performed_at)
       VALUES ($1, 'reactivated', 'Member reactivated', $2, NOW())`,
      [memberId, reactivatedBy]
    );

    return { success: true };
  } catch (error) {
    console.error('Error reactivating member:', error);
    return { success: false, error: 'Error al reactivar miembro' };
  }
}

export async function removeMemberFromTeam(
  memberId: string, 
  teamSlug: string, 
  removedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Don't allow removing team owners
    const { rows: memberRows } = await query<{ role: string }>(
      `SELECT tm.role 
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.id = $1 AND t.slug = $2`,
      [memberId, teamSlug]
    );

    if (memberRows.length === 0) {
      return { success: false, error: 'Miembro no encontrado' };
    }

    if (memberRows[0].role === 'team-owner') {
      return { success: false, error: 'Team-Eigentuemer kann nicht entfernt werden' };
    }

    const { rowCount } = await query(
      `UPDATE team_members 
       SET status = 'removed', 
           updated_at = NOW(),
           removed_at = NOW(),
           removed_by = $1
       WHERE id = $2 AND status IN ('active', 'suspended')`,
      [removedBy, memberId]
    );

    if (rowCount === 0) {
      return { success: false, error: 'Miembro no encontrado' };
    }

    // Log the removal
    await query(
      `INSERT INTO team_member_logs (member_id, action, details, performed_by, performed_at)
       VALUES ($1, 'removed', 'Member removed from team', $2, NOW())`,
      [memberId, removedBy]
    );

    return { success: true };
  } catch (error) {
    console.error('Error removing member:', error);
    return { success: false, error: 'Error al remover miembro' };
  }
}

export async function getMemberActivityLogs(
  memberId: string
): Promise<Array<{
  id: string;
  action: string;
  details: string;
  performedBy: string;
  performedAt: Date;
}>> {
  const { rows } = await query<{
    id: string;
    action: string;
    details: string;
    performed_by: string;
    performed_at: Date;
  }>(
    `SELECT id, action, details, performed_by, performed_at
     FROM team_member_logs
     WHERE member_id = $1
     ORDER BY performed_at DESC
     LIMIT 50`,
    [memberId]
  );

  return rows.map(row => ({
    id: row.id,
    action: row.action,
    details: row.details,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
  }));
}
