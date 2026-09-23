import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { getTeamLimits } from '@/lib/billing/limits';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parsePeriod(period: string): { start: string; end: string; isRange: boolean } {
  // Formato: "YYYY-MM" (mes específico)
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-').map((x) => parseInt(x, 10));
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    return { start: start.toISOString(), end: end.toISOString(), isRange: true };
  }
  
  // Formato: "ISO_DATE|ISO_DATE" (rango personalizado)
  if (period.includes('|')) {
    const [start, end] = period.split('|');
    return { start, end, isRange: true };
  }
  
  // Formato: "all" (todo el tiempo)
  if (period === 'all') {
    const start = new Date('2020-01-01T00:00:00Z');
    const end = new Date();
    return { start: start.toISOString(), end: end.toISOString(), isRange: true };
  }
  
  // Fallback: mes actual
  return parsePeriod(currentPeriod());
}

export async function GET(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (user as any).id;
    
    // Verificar si es global admin
    const globalRoleResult = await query<{ role: string }>(
      `SELECT role FROM role_assignments WHERE user_id = $1 AND role = 'global-admin'`,
      [userId]
    );
    
    if (globalRoleResult.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || currentPeriod();
    const { start, end, isRange } = parsePeriod(period);

    const { rows: teamRows } = await query<{ id: string; slug: string; name: string }>(
      `SELECT id::text, slug, name FROM teams ORDER BY name`
    );

    const teams = [] as any[];
    for (const t of teamRows) {
      const limits = await getTeamLimits(t.slug);
      const { rows: sub } = await query<{ plan_id: string }>(
        `SELECT plan_id FROM team_subscriptions WHERE team_slug=$1`,
        [t.slug]
      );
      
      let usage: Record<string, number> = {};
      
      if (isRange) {
        // Calcular desde usage_events para rangos de fechas
        const queriesResult = await query<{ count: string }>(
          `SELECT COUNT(*)::text as count 
           FROM usage_events 
           WHERE team_slug = $1 
           AND event_type = 'rag.query' 
           AND created_at >= $2 
           AND created_at < $3`,
          [t.slug, start, end]
        );
        
        const docsResult = await query<{ count: string }>(
          `SELECT COUNT(*)::text as count 
           FROM usage_events 
           WHERE team_slug = $1 
           AND event_type = 'document.processed' 
           AND created_at >= $2 
           AND created_at < $3`,
          [t.slug, start, end]
        );
        
        usage = {
          queries: Number(queriesResult.rows[0]?.count || '0'),
          docsProcessed: Number(docsResult.rows[0]?.count || '0'),
          rags: 0,
          members: 0,
        };
      } else {
        // Usar usage_counters para períodos mensuales
        const { rows: usageRows } = await query<{ metric_key: string; value: string }>(
          `SELECT metric_key, value::text FROM usage_counters WHERE team_slug=$1 AND period=$2`,
          [t.slug, period]
        );
        for (const u of usageRows) usage[u.metric_key] = Number(u.value || '0');
      }
      
      teams.push({
        teamSlug: t.slug,
        name: t.name,
        planId: sub[0]?.plan_id || 'free',
        limits,
        usage: {
          queries: usage.queries || 0,
          docsProcessed: usage.docsProcessed || 0,
          rags: usage.rags || 0,
          members: usage.members || 0,
        },
      });
    }

    return NextResponse.json({ teams, period, start, end });
  } catch (error) {
    console.error('Error in admin analytics teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

