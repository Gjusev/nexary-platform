import { query } from '@/lib/db';

export async function allowedRagIds(teamSlug: string, userId: string): Promise<string[]> {
  const { rows: teamRows } = await query<{ rag_id: string }>(
    `SELECT rag_id FROM projectnexus.rag_team_assignments WHERE team_slug = $1 AND can_query = true`,
    [teamSlug]
  );
  const { rows: userRows } = await query<{ rag_id: string }>(
    `SELECT rag_id FROM projectnexus.rag_user_assignments WHERE team_slug = $1 AND user_id = $2 AND can_query = true`,
    [teamSlug, userId]
  );
  const set = new Set<string>([...teamRows.map(r => r.rag_id), ...userRows.map(r => r.rag_id)]);
  return Array.from(set);
}

export function canCreateRag(session: { roles?: string[] } | null | undefined): boolean {
  const roles = session?.roles || [];
  return roles.includes('team-owner') 
    || roles.includes('TEAM_OWNER')
    || roles.includes('team-leader') 
    || roles.includes('TEAM_LEADER')
    || roles.includes('global-rag-admin');
}

