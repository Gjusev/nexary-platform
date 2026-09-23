import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || !roles.includes('global-admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { rows } = await query<{ id: string; user_id: string; role: string; created_at: string }>(
    `SELECT id::text, user_id, role, created_at::text FROM role_assignments ORDER BY created_at DESC`
  );
  return NextResponse.json({ assignments: rows });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || !roles.includes('global-admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const { userId, role } = body || {};
  if (!userId || !role) {
    return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
  }
  const { rows } = await query<{ id: string; user_id: string; role: string; created_at: string }>(
    `INSERT INTO role_assignments (user_id, role) VALUES ($1,$2)
     RETURNING id::text, user_id, role, created_at::text`,
    [userId, role]
  );
  return NextResponse.json({ assignment: rows[0] });
}

