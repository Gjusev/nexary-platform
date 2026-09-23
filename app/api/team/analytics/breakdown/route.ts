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
    const period = searchParams.get('period') || (() => {
      const d = new Date();
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    })();
    const filterUserId = searchParams.get('userId'); // Filtro opcional por usuario
    const { start, end } = rangeFromPeriod(period);

    // Construir filtro de usuario si se especifica
    const userFilter = filterUserId ? `AND ue.user_id = $4` : '';
    const queryParams = filterUserId ? [teamSlug, start, end, filterUserId] : [teamSlug, start, end];
    
    const topRags = await query<{ rag_id: string; name: string; c: string }>(
      `SELECT ue.rag_id::text AS rag_id, rp.name, COUNT(*)::text AS c
       FROM usage_events ue
       JOIN rag_packages rp ON rp.id = ue.rag_id
       WHERE ue.team_slug=$1 AND ue.event_type='rag.query' AND ue.created_at >= $2 AND ue.created_at < $3 AND ue.rag_id IS NOT NULL
       ${userFilter}
       GROUP BY ue.rag_id, rp.name
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
      queryParams
    );

    const topUsers = await query<{ user_id: string; display: string | null; c: string }>(
      `WITH t AS (SELECT id FROM teams WHERE slug=$1)
       SELECT ue.user_id, COALESCE(tm.name, tm.email) AS display, COUNT(*)::text AS c
       FROM usage_events ue
       LEFT JOIN t ON TRUE
       LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ue.user_id
       WHERE ue.team_slug=$1 AND ue.event_type='rag.query' AND ue.created_at >= $2 AND ue.created_at < $3 AND ue.user_id IS NOT NULL
       ${userFilter}
       GROUP BY ue.user_id, display
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
      queryParams
    );

    return NextResponse.json({
      period,
      filterUserId,
      topRags: topRags.rows.map((r) => ({ ragId: r.rag_id, name: r.name, count: Number(r.c) })),
      topUsers: topUsers.rows.map((r) => ({ userId: r.user_id, display: r.display, count: Number(r.c) })),
    });
  } catch (error) {
    console.error('Error in team analytics breakdown:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

