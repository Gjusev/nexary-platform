import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { query } from '@/lib/db';
import { checkAdminRateLimit } from '@/lib/middleware/api-rate-limit';

export async function GET(request: NextRequest) {
  // Security: Rate limiting check
  const rateLimitResponse = checkAdminRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || (!roles.includes('global-admin') && !roles.includes('global-rag-admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const include = url.searchParams.get('include');
  const deletedOnly = include === 'deleted';
  const where = deletedOnly ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL';
  const { rows } = await query<{ id: string; name: string; team_slug: string | null; scope: string | null; collection_name: string }>(
    `SELECT id::text, name, team_slug, scope, collection_name FROM rag_packages WHERE ${where} ORDER BY created_at DESC`
  );
  return NextResponse.json({ rags: rows });
}
