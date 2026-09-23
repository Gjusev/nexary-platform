import { randomUUID } from 'crypto';

import { query } from '@/lib/db';

type InvitationRow = {
  id: string;
  team_slug: string;
  code: string;
  created_by: string;
  created_at: Date;
  expires_at: Date | null;
  status: string;
  used_by: string | null;
  used_at: Date | null;
  notes: string | null;
};

export type TeamInvitation = {
  id: string;
  teamSlug: string;
  code: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdBy: string;
  createdAt: string;
  expiresAt?: string | null;
  usedBy?: string | null;
  usedAt?: string | null;
  notes?: string | null;
};

export async function listInvitations(teamSlug: string): Promise<TeamInvitation[]> {
  const result = await query<InvitationRow>(
    'SELECT * FROM team_invitations WHERE team_slug = $1 ORDER BY created_at DESC',
    [teamSlug]
  );

  return result.rows.map(mapRowToInvitation);
}

export async function createInvitation(params: {
  teamSlug: string;
  createdBy: string;
  expiresInDays?: number;
  notes?: string;
}): Promise<TeamInvitation> {
  const id = randomUUID();
  const code = generateCode();
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await query(
    `INSERT INTO team_invitations (
      id, team_slug, code, created_by, expires_at, notes
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, params.teamSlug, code, params.createdBy, expiresAt, params.notes ?? null]
  );

  return {
    id,
    teamSlug: params.teamSlug,
    code,
    status: 'pending',
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt?.toISOString() ?? null,
    notes: params.notes ?? null,
  };
}

export async function revokeInvitation(id: string, teamSlug: string): Promise<void> {
  await query(
    "UPDATE team_invitations SET status = 'revoked' WHERE id = $1 AND team_slug = $2",
    [id, teamSlug]
  );
}

export async function consumeInvitation(code: string, email: string): Promise<TeamInvitation | null> {
  const result = await query<InvitationRow>(
    'SELECT * FROM team_invitations WHERE code = $1',
    [code]
  );

  const invitation = result.rows[0];
  if (!invitation) {
    return null;
  }

  if (invitation.status !== 'pending') {
    return null;
  }

  if (invitation.expires_at && invitation.expires_at.getTime() < Date.now()) {
    await query("UPDATE team_invitations SET status = 'revoked' WHERE id = $1", [invitation.id]);
    return null;
  }

  await query(
    "UPDATE team_invitations SET status = 'accepted', used_by = $1, used_at = NOW() WHERE id = $2",
    [email, invitation.id]
  );

  const updated = await query<InvitationRow>(
    'SELECT * FROM team_invitations WHERE id = $1',
    [invitation.id]
  );

  return mapRowToInvitation(updated.rows[0]);
}

function generateCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function mapRowToInvitation(row: InvitationRow): TeamInvitation {
  return {
    id: row.id,
    teamSlug: row.team_slug,
    code: row.code,
    status: row.status as TeamInvitation['status'],
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    usedBy: row.used_by,
    usedAt: row.used_at ? row.used_at.toISOString() : null,
    notes: row.notes,
  };
}
