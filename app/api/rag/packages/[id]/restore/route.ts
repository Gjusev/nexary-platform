import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { getPackageById } from '@/lib/rag/store';
import { checkRagRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const rateLimitResponse = checkRagRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const pkg = await getPackageById(id, true).catch(() => undefined);
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  // Verificar permisos: $update_team (admin/owner) o team-leader/team-owner en PostgreSQL
  const teams = await (user as any).listTeams?.() || [];
  const selectedTeam = (user as any).selectedTeam || teams[0];
  
  if (!selectedTeam) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  const hasUpdatePermission = await (user as any).hasPermission?.(selectedTeam, '$update_team') || false;
  const userEmail = (user as any).primaryEmail || '';
  const teamId = selectedTeam.id;
  
  const { rows: memberRows } = await query<{ role: string }>(
    'SELECT role FROM team_members WHERE team_id = $1 AND email = $2 AND status = $3',
    [teamId, userEmail, 'active']
  );
  
  const dbRole = memberRows.length > 0 ? memberRows[0].role : null;
  const isTeamLeaderOrOwner = dbRole === 'team-leader' || dbRole === 'team-owner' || dbRole === 'owner';
  
  if (!hasUpdatePermission && !isTeamLeaderOrOwner) {
    return NextResponse.json({ error: 'Forbidden - Team leader or owner access required' }, { status: 403 });
  }

  await query('UPDATE projectnexus.rag_packages SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
