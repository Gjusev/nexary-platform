import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { query } from '@/lib/db';
import { checkAdminRateLimit } from '@/lib/middleware/api-rate-limit';

export async function GET(request: NextRequest) {
  // Security: Rate limiting check
  const rateLimitResponse = checkAdminRateLimit(request as NextRequest);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || !roles.includes('global-admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { rows } = await query<{ id: string; name: string; limits: any; features: any }>(
    `SELECT id, name, limits, features FROM plans ORDER BY id`
  );
  return NextResponse.json({ plans: rows });
}

export async function POST(request: NextRequest) {
  // Security: Rate limiting check
  const rateLimitResponse = checkAdminRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || !roles.includes('global-admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({} as any));
  const { id, name, limits, features } = body || {};
  if (!id || !name || !limits) {
    return NextResponse.json({ error: 'id, name, limits are required' }, { status: 400 });
  }
  await query(
    `INSERT INTO plans (id, name, limits, features)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, limits=EXCLUDED.limits, features=EXCLUDED.features`,
    [id, name, JSON.stringify(limits), JSON.stringify(features ?? {})]
  );
  return NextResponse.json({ ok: true });
}
