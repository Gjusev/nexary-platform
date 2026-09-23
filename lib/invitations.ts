import { randomUUID } from 'crypto';
import { query } from '@/lib/db';

export type TeamInvitation = {
  id: string;
  teamSlug: string;
  inviterEmail: string;
  inviteeEmail: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
};

export type CreateInvitationInput = {
  teamSlug: string;
  inviterEmail: string;
  inviteeEmail: string;
  expiresInHours?: number;
};

export async function createTeamInvitation(input: CreateInvitationInput): Promise<TeamInvitation> {
  const token = randomUUID();
  const expiresInHours = input.expiresInHours ?? 72; // 3 days by default
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const { rows } = await query<{
    id: string;
    team_slug: string;
    inviter_email: string;
    invitee_email: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
    created_at: Date;
    status: string;
  }>(
    `INSERT INTO team_invitations (team_slug, inviter_email, invitee_email, token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, team_slug, inviter_email, invitee_email, token, expires_at, used_at, created_at, status`,
    [input.teamSlug, input.inviterEmail, input.inviteeEmail, token, expiresAt]
  );

  const row = rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    inviterEmail: row.inviter_email,
    inviteeEmail: row.invitee_email,
    token: row.token,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined,
    createdAt: row.created_at,
    status: row.status as TeamInvitation['status'],
  };
}

export async function getInvitationByToken(token: string): Promise<TeamInvitation | null> {
  const { rows } = await query<{
    id: string;
    team_slug: string;
    inviter_email: string;
    invitee_email: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
    created_at: Date;
    status: string;
  }>(
    `SELECT id, team_slug, inviter_email, invitee_email, token, expires_at, used_at, created_at, status
     FROM team_invitations
     WHERE token = $1 AND status = 'pending' AND expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    inviterEmail: row.inviter_email,
    inviteeEmail: row.invitee_email,
    token: row.token,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined,
    createdAt: row.created_at,
    status: row.status as TeamInvitation['status'],
  };
}

export async function acceptInvitation(token: string): Promise<TeamInvitation | null> {
  const { rows } = await query<{
    id: string;
    team_slug: string;
    inviter_email: string;
    invitee_email: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
    created_at: Date;
    status: string;
  }>(
    `UPDATE team_invitations 
     SET status = 'accepted', used_at = NOW()
     WHERE token = $1 AND status = 'pending' AND expires_at > NOW()
     RETURNING id, team_slug, inviter_email, invitee_email, token, expires_at, used_at, created_at, status`,
    [token]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    inviterEmail: row.inviter_email,
    inviteeEmail: row.invitee_email,
    token: row.token,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined,
    createdAt: row.created_at,
    status: row.status as TeamInvitation['status'],
  };
}

export async function listTeamInvitations(teamSlug: string): Promise<TeamInvitation[]> {
  const { rows } = await query<{
    id: string;
    team_slug: string;
    inviter_email: string;
    invitee_email: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
    created_at: Date;
    status: string;
  }>(
    `SELECT id, team_slug, inviter_email, invitee_email, token, expires_at, used_at, created_at, status
     FROM team_invitations
     WHERE team_slug = $1
     ORDER BY created_at DESC`,
    [teamSlug]
  );

  return rows.map((row) => ({
    id: row.id,
    teamSlug: row.team_slug,
    inviterEmail: row.inviter_email,
    inviteeEmail: row.invitee_email,
    token: row.token,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined,
    createdAt: row.created_at,
    status: row.status as TeamInvitation['status'],
  }));
}

export async function revokeInvitation(id: string, teamSlug: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE team_invitations 
     SET status = 'revoked'
     WHERE id = $1 AND team_slug = $2 AND status = 'pending'`,
    [id, teamSlug]
  );

  return (rowCount ?? 0) > 0;
}