import { query } from '@/lib/db';

type Limits = {
  members: number;
  rags: number;
  docsProcessed: number;
  queries: number;
};

type PlanRow = { id: string; limits: Limits };
type EntitlementRow = { feature_key: string; quantity: number };

export async function getTeamLimits(teamSlug: string): Promise<Limits> {
  // Fetch subscription plan
  const { rows: subRows } = await query<{ plan_id: string }>(
    `SELECT plan_id FROM team_subscriptions WHERE team_slug = $1`,
    [teamSlug]
  );
  const planId = subRows[0]?.plan_id || 'free';

  const { rows: planRows } = await query<PlanRow>(
    `SELECT id, limits FROM plans WHERE id = $1`,
    [planId]
  );
  const base: Limits = planRows[0]?.limits ?? { members: 10, rags: 3, docsProcessed: 20000, queries: 5000 };

  // Add-ons adjust limits
  const { rows: entRows } = await query<EntitlementRow>(
    `SELECT feature_key, quantity FROM entitlements WHERE team_slug = $1`,
    [teamSlug]
  );
  const extraRags = entRows.find(e => e.feature_key === 'extra-rags')?.quantity ?? 0;
  const extraQueries = entRows.find(e => e.feature_key === 'extra-queries')?.quantity ?? 0;
  const extraDocs = entRows.find(e => e.feature_key === 'extra-docs')?.quantity ?? 0;

  return {
    members: base.members,
    rags: base.rags + extraRags,
    docsProcessed: base.docsProcessed + extraDocs,
    queries: base.queries + extraQueries,
  };
}

export async function enforceRagCreationLimit(teamSlug: string): Promise<void> {
  const limits = await getTeamLimits(teamSlug);
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM projectnexus.rag_packages WHERE team_slug = $1`,
    [teamSlug]
  );
  const current = Number(rows[0]?.count ?? '0');
  if (current >= limits.rags) {
    const err = new Error('RAG limit reached');
    (err as any).code = 'limit_rags';
    throw err;
  }
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

export async function checkAndIncrementUsage(teamSlug: string, metric: 'queries'|'docsProcessed', inc = 1): Promise<void> {
  const period = currentPeriod();
  const limits = await getTeamLimits(teamSlug);
  const limit = (limits as any)[metric] as number;

  const { rows } = await query<{ id: string; value: string }>(
    `SELECT id, value::text FROM usage_counters WHERE team_slug=$1 AND metric_key=$2 AND period=$3`,
    [teamSlug, metric, period]
  );
  const id = rows[0]?.id;
  const current = Number(rows[0]?.value ?? '0');
  if (current + inc > limit) {
    const err = new Error(`Limit exceeded for ${metric}`);
    (err as any).code = `limit_${metric}`;
    throw err;
  }
  if (!id) {
    await query(
      `INSERT INTO usage_counters (team_slug, metric_key, period, value) VALUES ($1,$2,$3,$4)`,
      [teamSlug, metric, period, inc]
    );
  } else {
    await query(
      `UPDATE usage_counters SET value = value + $1, updated_at = NOW() WHERE id = $2`,
      [inc, id]
    );
  }
}

export async function recordUsageEvent(teamSlug: string, userId: string | undefined, eventType: string, ragId?: string, details?: Record<string, unknown>) {
  await query(
    `INSERT INTO usage_events (team_slug, user_id, event_type, rag_id, details) VALUES ($1,$2,$3,$4,$5)`,
    [teamSlug, userId ?? null, eventType, ragId ?? null, details ? JSON.stringify(details) : '{}']
  );
}

