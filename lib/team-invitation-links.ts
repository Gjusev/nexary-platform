import { randomUUID } from 'crypto';
import { query } from '@/lib/db';

export type TeamInvitationLink = {
  id: string;
  teamSlug: string;
  token: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  maxUses: number | null;
  currentUses: number;
  status: 'active' | 'expired' | 'revoked' | 'used_up';
  notes: string | null;
};

// Generate a secure random token for invitation links
function generateInvitationToken(): string {
  return randomUUID().replace(/-/g, '');
}

export async function createInvitationLink(
  teamSlug: string,
  createdBy: string,
  expiresInHours?: number,
  maxUses?: number,
  notes?: string
): Promise<TeamInvitationLink> {
  const id = randomUUID();
  const token = generateInvitationToken();
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null;

  const { rows } = await query<{
    id: string;
    team_slug: string;
    token: string;
    created_by: string;
    created_at: Date;
    expires_at: Date | null;
    max_uses: number | null;
    current_uses: number;
    status: string;
    notes: string | null;
  }>(
    `INSERT INTO team_invitation_links 
     (id, team_slug, token, created_by, expires_at, max_uses, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, teamSlug, token, createdBy, expiresAt, maxUses || null, notes || null]
  );

  const row = rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    token: row.token,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    currentUses: row.current_uses,
    status: row.status as TeamInvitationLink['status'],
    notes: row.notes,
  };
}

export async function getInvitationLinksByTeam(teamSlug: string): Promise<TeamInvitationLink[]> {
  const { rows } = await query<{
    id: string;
    team_slug: string;
    token: string;
    created_by: string;
    created_at: Date;
    expires_at: Date | null;
    max_uses: number | null;
    current_uses: number;
    status: string;
    notes: string | null;
  }>(
    `SELECT * FROM team_invitation_links 
     WHERE team_slug = $1 
     ORDER BY created_at DESC`,
    [teamSlug]
  );

  return rows.map(row => ({
    id: row.id,
    teamSlug: row.team_slug,
    token: row.token,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    currentUses: row.current_uses,
    status: row.status as TeamInvitationLink['status'],
    notes: row.notes,
  }));
}

export async function validateInvitationLink(
  token: string
): Promise<{ success: boolean; teamSlug?: string; error?: string }> {
  try {
    const { rows } = await query<{
      id: string;
      team_slug: string;
      expires_at: Date | null;
      max_uses: number | null;
      current_uses: number;
      status: string;
    }>(
      `SELECT id, team_slug, expires_at, max_uses, current_uses, status
       FROM team_invitation_links 
       WHERE token = $1`,
      [token]
    );

    if (rows.length === 0) {
      return { success: false, error: 'Enlace de invitación no válido' };
    }

    const link = rows[0];

    // Check if link is active
    if (link.status !== 'active') {
      return { success: false, error: 'El enlace de invitación ya no está activo' };
    }

    // Check if link has expired
    if (link.expires_at && new Date() > link.expires_at) {
      // Mark as expired
      await query(
        `UPDATE team_invitation_links SET status = 'expired' WHERE id = $1`,
        [link.id]
      );
      return { success: false, error: 'El enlace de invitación ha expirado' };
    }

    // Check if link has reached max uses
    if (link.max_uses && link.current_uses >= link.max_uses) {
      // Mark as used up
      await query(
        `UPDATE team_invitation_links SET status = 'used_up' WHERE id = $1`,
        [link.id]
      );
      return { success: false, error: 'El enlace de invitación ha alcanzado el límite de usos' };
    }

    return { success: true, teamSlug: link.team_slug };
  } catch (error) {
    console.error('Error validating invitation link:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}

export async function useInvitationLink(
  token: string,
  userEmail: string
): Promise<{ success: boolean; teamSlug?: string; error?: string }> {
  try {
    // First validate the link
    const validation = await validateInvitationLink(token);
    if (!validation.success) {
      return validation;
    }

    // Increment usage count
    await query(
      `UPDATE team_invitation_links 
       SET current_uses = current_uses + 1,
           last_used_at = NOW(),
           last_used_by = $2
       WHERE token = $1`,
      [token, userEmail]
    );

    return { success: true, teamSlug: validation.teamSlug };
  } catch (error) {
    console.error('Error using invitation link:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}

export async function revokeInvitationLink(linkId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { rowCount } = await query(
      `UPDATE team_invitation_links 
       SET status = 'revoked' 
       WHERE id = $1 AND status = 'active'`,
      [linkId]
    );

    if (rowCount === 0) {
      return { success: false, error: 'Enlace no encontrado o ya inactivo' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error revoking invitation link:', error);
    return { success: false, error: 'Error al revocar enlace' };
  }
}