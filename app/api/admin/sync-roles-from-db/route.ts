import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { Pool } from 'pg';

/**
 * POST /api/admin/sync-roles-from-db
 * Sincroniza los roles desde la base de datos PostgreSQL a Stack Auth
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
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userEmail = (currentUser as any).primaryEmail;
    
    // Buscar el rol del usuario en nuestra base de datos
    const result = await pool.query(`
      SELECT tm.role, tm.team_id, t.slug as team_slug, t.name as team_name
      FROM projectnexus.team_members tm
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
      LIMIT 1
    `, [currentUser.id]);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no encontrado en ningún equipo en la base de datos' },
        { status: 404 }
      );
    }

    const userTeamData = result.rows[0] as any;
    const dbRole = userTeamData.role; // 'member' o similar
    
    // Mapear rol de la DB a nuestros roles internos
    let internalRole = 'TEAM_MEMBER';
    if (dbRole === 'owner' || dbRole === 'admin') {
      internalRole = 'TEAM_LEADER';
    }

    // Actualizar en Stack Auth
    await (currentUser as any).update({
      serverMetadata: {
        ...(currentUser as any).serverMetadata,
        roles: [internalRole],
        teamId: userTeamData.team_id,
        teamSlug: userTeamData.team_slug,
        teamName: userTeamData.team_name,
        dbRole: dbRole,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Roles sincronizados correctamente desde la base de datos',
      data: {
        email: userEmail,
        dbRole,
        internalRole,
        teamId: userTeamData.team_id,
        teamSlug: userTeamData.team_slug,
        teamName: userTeamData.team_name,
      },
    });
  } catch (error) {
    console.error('Error al sincronizar roles:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar roles', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

/**
 * GET /api/admin/sync-roles-from-db
 * Obtiene información del usuario desde la base de datos
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

    const currentUser = await stackApp.getUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userEmail = (currentUser as any).primaryEmail;
    
    // Buscar el usuario en nuestra base de datos
    const result = await pool.query(`
      SELECT tm.role, tm.team_id, t.slug as team_slug, t.name as team_name
      FROM projectnexus.team_members tm
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
    `, [currentUser.id]);

    return NextResponse.json({
      email: userEmail,
      userId: currentUser.id,
      dbData: result.rows,
      stackAuthData: {
        serverMetadata: (currentUser as any).serverMetadata,
        clientMetadata: (currentUser as any).clientMetadata,
        teams: (currentUser as any).teams,
        selectedTeam: (currentUser as any).selectedTeam,
      },
    });
  } catch (error) {
    console.error('Error al obtener información:', error);
    return NextResponse.json(
      { error: 'Error al obtener información' },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
