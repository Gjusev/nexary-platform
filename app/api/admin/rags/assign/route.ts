import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || (!roles.includes('global-admin') && !roles.includes('global-rag-admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { ragId, teamSlug, policy = 'read-only', can_query = true, can_ingest = false, can_update = false, can_delete = false } = body || {};
  if (!ragId || !teamSlug) {
    return NextResponse.json({ error: 'ragId and teamSlug are required' }, { status: 400 });
  }

  await query(
    `INSERT INTO rag_team_assignments (rag_id, team_slug, policy, can_query, can_ingest, can_update, can_delete)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (rag_id, team_slug)
     DO UPDATE SET policy=EXCLUDED.policy, can_query=EXCLUDED.can_query, can_ingest=EXCLUDED.can_ingest, can_update=EXCLUDED.can_update, can_delete=EXCLUDED.can_delete`,
    [ragId, teamSlug, policy, !!can_query, !!can_ingest, !!can_update, !!can_delete]
  );

  return NextResponse.json({ ok: true });
}

