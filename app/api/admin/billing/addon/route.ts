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
  const { teamSlug, featureKey, quantity } = await request.json().catch(() => ({}));
  if (!teamSlug || !featureKey) return NextResponse.json({ error: 'teamSlug and featureKey are required' }, { status: 400 });
  const q = Math.max(0, Number(quantity ?? 1));
  await query(
    `INSERT INTO entitlements (team_slug, feature_key, quantity) VALUES ($1,$2,$3)
     ON CONFLICT (team_slug, feature_key)
     DO UPDATE SET quantity=EXCLUDED.quantity, created_at=NOW()`,
    [teamSlug, featureKey, q]
  );
  const { rows } = await query<{ feature_key: string; quantity: number }>(
    `SELECT feature_key, quantity FROM entitlements WHERE team_slug=$1 AND feature_key=$2`,
    [teamSlug, featureKey]
  );
  return NextResponse.json({ entitlement: rows[0] });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || !roles.includes('global-admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const teamSlug = searchParams.get('teamSlug');
  const featureKey = searchParams.get('featureKey');
  if (!teamSlug || !featureKey) return NextResponse.json({ error: 'teamSlug and featureKey are required' }, { status: 400 });
  await query(`DELETE FROM entitlements WHERE team_slug=$1 AND feature_key=$2`, [teamSlug, featureKey]);
  return NextResponse.json({ ok: true });
}
