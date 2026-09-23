import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { StackServerApp } from '@stackframe/stack';

/**
 * GET /api/debug/check-user-in-db
 * Verifica si el usuario actual existe en team_members
 */
export async function GET(request: NextRequest) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Crear instancia con acceso a cookies
    const stackApp = new StackServerApp({
      tokenStore: 'nextjs-cookie' as any,
      projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID!,
      publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY!,
      secretServerKey: process.env.STACK_SECRET_SERVER_KEY!,
      baseUrl: process.env.NEXT_PUBLIC_STACK_API_URL,
    });

    const user = await stackApp.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const stackUserId = (user as any).id;
    const stackEmail = (user as any).primaryEmail;

    // Buscar por user_id (Stack Auth ID)
    const byId = await pool.query(`
      SELECT 
        tm.id,
        tm.user_id,
        tm.role,
        tm.joined_at,
        t.slug as team_slug,
        t.name as team_name
      FROM projectnexus.team_members tm
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
    `, [stackUserId]);

    // Buscar por email (por si el user_id no coincide)
    const byEmail = await pool.query(`
      SELECT 
        tm.id,
        tm.user_id,
        tm.role,
        tm.joined_at,
        t.slug as team_slug,
        t.name as team_name
      FROM projectnexus.team_members tm
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id ILIKE $1 OR tm.user_id ILIKE $2
    `, [`%${stackEmail}%`, `%${stackEmail.split('@')[0]}%`]);

    // Obtener TODOS los user_ids para comparar
    const allUserIds = await pool.query(`
      SELECT DISTINCT user_id 
      FROM projectnexus.team_members
      ORDER BY user_id
    `);

    return NextResponse.json({
      success: true,
      stackAuth: {
        userId: stackUserId,
        email: stackEmail,
      },
      foundById: {
        count: byId.rows.length,
        data: byId.rows,
      },
      foundByEmail: {
        count: byEmail.rows.length,
        data: byEmail.rows,
      },
      allUserIdsInDB: allUserIds.rows.map(r => r.user_id),
      diagnosis: {
        existsInDB: byId.rows.length > 0,
        needsUpdate: byId.rows.length === 0 && byEmail.rows.length > 0,
        needsInsert: byId.rows.length === 0 && byEmail.rows.length === 0,
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
