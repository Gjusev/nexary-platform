import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { StackServerApp } from '@stackframe/stack';

/**
 * POST /api/admin/update-user-role
 * Actualiza el rol de un usuario en PostgreSQL
 */
export async function POST(request: NextRequest) {
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

    const currentUser = await stackApp.getUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { newRole } = body; // 'owner', 'leader', 'admin', 'member'
    
    const userId = (currentUser as any).id;

    // 1. Ver estado actual
    const before = await pool.query(`
      SELECT tm.id, tm.user_id, tm.role, t.slug as team_slug, t.name as team_name
      FROM projectnexus.team_members tm
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
    `, [userId]);

    if (!before.rows || before.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado en team_members',
      }, { status: 404 });
    }

    const beforeData = before.rows[0];

    // 1.5. Verificar qué roles son válidos (leer el CHECK constraint)
    const constraintInfo = await pool.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conname LIKE '%role%'
        AND conrelid = 'projectnexus.team_members'::regclass
    `);

    // 2. Actualizar el rol
    const update = await pool.query(`
      UPDATE projectnexus.team_members
      SET role = $1
      WHERE user_id = $2
      RETURNING *
    `, [newRole, userId]);

    // 3. Ver estado después
    const after = await pool.query(`
      SELECT tm.id, tm.user_id, tm.role, t.slug as team_slug, t.name as team_name
      FROM projectnexus.team_members tm
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
    `, [userId]);

    return NextResponse.json({
      success: true,
      message: `Rol actualizado de "${beforeData.role}" a "${newRole}"`,
      before: beforeData,
      after: after.rows[0],
      sql: `UPDATE projectnexus.team_members SET role = '${newRole}' WHERE user_id = '${userId}'`,
    });

  } catch (error) {
    console.error('❌ [update-role] Error:', error);
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
