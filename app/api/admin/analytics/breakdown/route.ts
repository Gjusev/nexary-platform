import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function rangeFromPeriod(period: string): { start: string; end: string } {
  // Formato: "YYYY-MM" (mes específico)
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-').map((x) => parseInt(x, 10));
    const start = new Date(Date.UTC(y, (m || 1) - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, (m || 1), 1, 0, 0, 0));
    return { start: start.toISOString(), end: end.toISOString() };
  }
  
  // Formato: "ISO_DATE|ISO_DATE" (rango personalizado)
  if (period.includes('|')) {
    const [start, end] = period.split('|');
    return { start, end };
  }
  
  // Formato: "all" (todo el tiempo)
  if (period === 'all') {
    const start = new Date('2020-01-01T00:00:00Z');
    const end = new Date();
    return { start: start.toISOString(), end: end.toISOString() };
  }
  
  // Fallback: mes actual
  return rangeFromPeriod(currentPeriod());
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
    const teamSlug = searchParams.get('teamSlug');
    const { start, end } = rangeFromPeriod(period);

    if (teamSlug) {
      const topRags = await query<{ rag_id: string; name: string; c: string }>(
        `SELECT ue.rag_id::text AS rag_id, rp.name, COUNT(*)::text AS c
         FROM usage_events ue
         JOIN rag_packages rp ON rp.id = ue.rag_id
         WHERE ue.team_slug=$1 AND ue.event_type='rag.query' AND ue.created_at >= $2 AND ue.created_at < $3 AND ue.rag_id IS NOT NULL
         GROUP BY ue.rag_id, rp.name
         ORDER BY COUNT(*) DESC
         LIMIT 10`,
        [teamSlug, start, end]
      );
      const topUsers = await query<{ user_id: string; c: string }>(
        `SELECT ue.user_id, COUNT(*)::text AS c
         FROM usage_events ue
         WHERE ue.team_slug=$1 AND ue.event_type='rag.query' AND ue.created_at >= $2 AND ue.created_at < $3 AND ue.user_id IS NOT NULL
         GROUP BY ue.user_id
         ORDER BY COUNT(*) DESC
         LIMIT 10`,
        [teamSlug, start, end]
      );
      return NextResponse.json({ period, teamSlug, topRags: topRags.rows, topUsers: topUsers.rows });
    }

    const topTeams = await query<{ team_slug: string; c: string }>(
      `SELECT team_slug, COUNT(*)::text AS c
       FROM usage_events
       WHERE event_type='rag.query' AND created_at >= $1 AND created_at < $2
       GROUP BY team_slug
       ORDER BY COUNT(*) DESC
       LIMIT 20`,
      [start, end]
    );

    const topRags = await query<{ rag_id: string; name: string; c: string }>(
      `SELECT ue.rag_id::text AS rag_id, rp.name, COUNT(*)::text AS c
       FROM usage_events ue
       JOIN rag_packages rp ON rp.id = ue.rag_id
       WHERE ue.event_type='rag.query' AND ue.created_at >= $1 AND ue.created_at < $2 AND ue.rag_id IS NOT NULL
       GROUP BY ue.rag_id, rp.name
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
      [start, end]
    );

    return NextResponse.json({ period, topTeams: topTeams.rows, topRags: topRags.rows });
  } catch (error) {
    console.error('Error in admin analytics breakdown:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

