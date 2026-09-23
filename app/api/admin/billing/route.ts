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
  if (!session || !roles.includes('global-admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const teamSlug = searchParams.get('teamSlug');
  if (!teamSlug) return NextResponse.json({ error: 'teamSlug is required' }, { status: 400 });

  const { rows: subRows } = await query<{ id: string; team_slug: string; plan_id: string; status: string; current_period_start: string; current_period_end: string }>(
    `SELECT id::text, team_slug, plan_id, status, current_period_start::text, current_period_end::text FROM team_subscriptions WHERE team_slug=$1`,
    [teamSlug]
  );
  const { rows: entRows } = await query<{ feature_key: string; quantity: number }>(
    `SELECT feature_key, quantity FROM entitlements WHERE team_slug=$1`,
    [teamSlug]
  );
  return NextResponse.json({ subscription: subRows[0] || null, entitlements: entRows });
}

