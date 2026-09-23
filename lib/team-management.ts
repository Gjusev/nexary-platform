import { randomUUID } from 'crypto';
import { query } from '@/lib/db';





export type TeamJoinRequest = {
  id: string;
  teamSlug: string;
  requesterEmail: string;
  requesterName: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
};







export async function createJoinRequest(
  teamSlug: string,
  requesterEmail: string,
  requesterName?: string,
  message?: string
): Promise<TeamJoinRequest> {
  const { rows } = await query<{
    id: string;
    team_slug: string;
    requester_email: string;
    requester_name: string | null;
    message: string | null;
    status: string;
    created_at: Date;
    reviewed_by: string | null;
    reviewed_at: Date | null;
  }>(
    `INSERT INTO team_join_requests (team_slug, requester_email, requester_name, message)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (team_slug, requester_email) 
     DO UPDATE SET 
       requester_name = EXCLUDED.requester_name,
       message = EXCLUDED.message,
       status = 'pending',
       created_at = NOW(),
       reviewed_by = NULL,
       reviewed_at = NULL
     RETURNING *`,
    [teamSlug, requesterEmail, requesterName || null, message || null]
  );

  const row = rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    requesterEmail: row.requester_email,
    requesterName: row.requester_name,
    message: row.message,
    status: row.status as TeamJoinRequest['status'],
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  };
}

export async function getTeamJoinRequests(teamSlug: string): Promise<TeamJoinRequest[]> {
  const { rows } = await query<{
    id: string;
    team_slug: string;
    requester_email: string;
    requester_name: string | null;
    message: string | null;
    status: string;
    created_at: Date;
    reviewed_by: string | null;
    reviewed_at: Date | null;
  }>(
    `SELECT * FROM team_join_requests 
     WHERE team_slug = $1 
     ORDER BY created_at DESC`,
    [teamSlug]
  );

  return rows.map(row => ({
    id: row.id,
    teamSlug: row.team_slug,
    requesterEmail: row.requester_email,
    requesterName: row.requester_name,
    message: row.message,
    status: row.status as TeamJoinRequest['status'],
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  }));
}

export async function reviewJoinRequest(
  requestId: string,
  reviewedBy: string,
  action: 'approve' | 'reject'
): Promise<{ success: boolean; error?: string }> {
  const status = action === 'approve' ? 'approved' : 'rejected';

  const { rowCount } = await query(
    `UPDATE team_join_requests 
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3 AND status = 'pending'`,
    [status, reviewedBy, requestId]
  );

  if (rowCount === 0) {
    return { success: false, error: 'Solicitud no encontrada o ya procesada' };
  }

  return { success: true };
}



