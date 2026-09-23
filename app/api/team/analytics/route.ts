import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { getTeamLimits } from '@/lib/billing/limits';
import type { StackUser } from '@/lib/types/user';
import { checkTeamRateLimit } from '@/lib/middleware/api-rate-limit';

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
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Type assertion: Stack SDK's CurrentServerUser to our StackUser type
    const typedUser = user as unknown as StackUser;
    const userId = typedUser.id;
    
    // Obtener el equipo y roles del usuario directamente desde PostgreSQL
    const userTeamResult = await query<{ slug: string; role: string }>(
      `SELECT t.slug, tm.role 
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1
       ORDER BY tm.joined_at DESC
       LIMIT 1`,
      [userId]
    );
    
    if (userTeamResult.rows.length === 0) {
      return NextResponse.json({ error: 'No team found for user' }, { status: 404 });
    }
    
    const teamSlug = userTeamResult.rows[0].slug;
    const dbRole = userTeamResult.rows[0].role;
    
    // Verificar permisos - team owners, leaders, admins y global admins pueden ver analytics
    const hasPermission = dbRole === 'team-owner' || 
                         dbRole === 'team-leader' ||
                         dbRole === 'team-admin' ||
                         dbRole === 'owner' ||
                         dbRole === 'leader' ||
                         dbRole === 'admin';
    
    // También verificar si es global admin desde role_assignments
    if (!hasPermission) {
      const globalRoleResult = await query<{ role: string }>(
        `SELECT role FROM role_assignments WHERE user_id = $1 AND role = 'global-admin'`,
        [userId]
      );
      
      if (globalRoleResult.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || currentPeriod();
    const filterUserId = searchParams.get('userId'); // Filtro opcional por usuario
    const { start, end, isRange } = parsePeriod(period);

    const limits = await getTeamLimits(teamSlug);
    
    // Si es un rango de fechas, calcular desde usage_events
    let usage: Record<string, number> = {};
    
    if (isRange) {
      // Performance: Single aggregated query instead of 4 separate COUNT queries
      // Use conditional aggregation to get all counts in one database roundtrip
      const userFilter = filterUserId ? `AND user_id = $4` : '';
      const queryParams = filterUserId ? [teamSlug, start, end, filterUserId] : [teamSlug, start, end];

      const analyticsResult = await query<{
        rag_queries: string;
        documents_processed: string;
        active_members: string;
      }>(
        `SELECT
           COUNT(CASE WHEN event_type = 'rag.query' THEN 1 END)::text as rag_queries,
           COUNT(CASE WHEN event_type = 'document.processed' THEN 1 END)::text as documents_processed,
           COUNT(DISTINCT user_id)::text as active_members
         FROM projectnexus.usage_events
         WHERE team_slug = $1
         AND created_at >= $2
         AND created_at < $3
         ${userFilter}`,
        queryParams
      );

      // RAGs count needs separate query (different table)
      const ragsResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count
         FROM projectnexus.rag_packages
         WHERE team_slug = $1
         AND created_at >= $2
         AND created_at < $3
         AND deleted_at IS NULL`,
        [teamSlug, start, end]
      );

      usage = {
        queries: Number(analyticsResult.rows[0]?.rag_queries || '0'),
        docsProcessed: Number(analyticsResult.rows[0]?.documents_processed || '0'),
        rags: Number(ragsResult.rows[0]?.count || '0'),
        members: Number(analyticsResult.rows[0]?.active_members || '0'),
      };
    } else {
      // Usar usage_counters para períodos mensuales
      const { rows } = await query<{ metric_key: string; value: string }>(
        `SELECT metric_key, value::text FROM usage_counters WHERE team_slug=$1 AND period=$2`,
        [teamSlug, period]
      );
      for (const r of rows) usage[r.metric_key] = Number(r.value || '0');
    }

    return NextResponse.json({
      period,
      start,
      end,
      limits,
      usage: {
        queries: usage.queries || 0,
        docsProcessed: usage.docsProcessed || 0,
        rags: usage.rags || 0,
        members: usage.members || 0,
      },
    });
  } catch (error) {
    console.error('Error in team analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

