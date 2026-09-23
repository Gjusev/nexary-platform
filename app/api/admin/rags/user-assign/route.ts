import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || (!roles.includes('global-admin') && !roles.includes('global-rag-admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const teamSlug = searchParams.get('teamSlug');
  const ragId = searchParams.get('ragId');
  const clauses: string[] = [];
  const params: any[] = [];
  if (teamSlug) { clauses.push(`team_slug=$${params.length + 1}`); params.push(teamSlug); }
  if (ragId) { clauses.push(`rag_id=$${params.length + 1}`); params.push(ragId); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id::text, rag_id::text as rag_id, team_slug, user_id, can_query, can_ingest, can_update, can_delete, created_at::text
     FROM rag_user_assignments ${where} ORDER BY created_at DESC`,
    params
  );
  return NextResponse.json({ assignments: rows });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || (!roles.includes('global-admin') && !roles.includes('global-rag-admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const { ragId, teamSlug, userId, can_query = true, can_ingest = false, can_update = false, can_delete = false } = body || {};
  if (!ragId || !teamSlug || !userId) {
    return NextResponse.json({ error: 'ragId, teamSlug y userId son requeridos' }, { status: 400 });
  }
  await query(
    `INSERT INTO rag_user_assignments (rag_id, team_slug, user_id, can_query, can_ingest, can_update, can_delete)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (rag_id, team_slug, user_id)
     DO UPDATE SET can_query=EXCLUDED.can_query, can_ingest=EXCLUDED.can_ingest, can_update=EXCLUDED.can_update, can_delete=EXCLUDED.can_delete`,
    [ragId, teamSlug, userId, !!can_query, !!can_ingest, !!can_update, !!can_delete]
  );
  return NextResponse.json({ ok: true });
}

