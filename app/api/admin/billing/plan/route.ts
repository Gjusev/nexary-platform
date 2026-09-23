import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || !roles.includes('global-admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { teamSlug, planId } = await request.json().catch(() => ({}));
  if (!teamSlug || !planId) return NextResponse.json({ error: 'teamSlug and planId are required' }, { status: 400 });

  // validate plan exists
  const { rows: exists } = await query<{ id: string }>(`SELECT id FROM plans WHERE id=$1`, [planId]);
  if (exists.length === 0) return NextResponse.json({ error: 'Plan not found' }, { status: 400 });

  await query(
    `INSERT INTO team_subscriptions (team_slug, plan_id)
     VALUES ($1,$2)
     ON CONFLICT (team_slug)
     DO UPDATE SET plan_id=EXCLUDED.plan_id, current_period_start=NOW(), current_period_end=(NOW() + interval '30 days')`,
    [teamSlug, planId]
  );
  return NextResponse.json({ ok: true });
}

