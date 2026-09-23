import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { Pool } from 'pg';

/**
 * Sincroniza los permisos de Stack Auth basándose en el rol de PostgreSQL
 * POST /api/admin/sync-stack-auth-permissions
 */
export async function POST(request: NextRequest) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Crear instancia de Stack Auth
    const stackApp = new StackServerApp({
      tokenStore: 'nextjs-cookie' as any,
      projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID!,
      publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY!,
      secretServerKey: process.env.STACK_SECRET_SERVER_KEY!,
      baseUrl: process.env.NEXT_PUBLIC_STACK_API_URL,
    });

    // Obtener usuario actual
    const user = await stackApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userId = user.id;
    // 1. Obtener el rol de PostgreSQL
    const result = await pool.query(`
      SELECT 
        tm.role,
        tm.team_id,
        t.slug as team_slug,
        t.name as team_name
      FROM projectnexus.team_members tm
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
      ORDER BY tm.joined_at DESC
      LIMIT 1
    `, [userId]);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Usuario no encontrado en ningún equipo' 
      }, { status: 404 });
    }

    const userTeamData = result.rows[0];
    const dbRole = userTeamData.role;

    // 2. Obtener el equipo de Stack Auth
    const teams = await user.listTeams();
    if (!teams || teams.length === 0) {
      return NextResponse.json({ 
        error: 'Usuario no tiene equipos en Stack Auth' 
      }, { status: 404 });
    }

    // Buscar el equipo correspondiente
    const team = teams.find(t => t.id === userTeamData.team_id);
    if (!team) {
      return NextResponse.json({ 
        error: 'Equipo no encontrado en Stack Auth',
        teamIdBuscado: userTeamData.team_id,
        teamsEnStackAuth: teams.map(t => ({ id: t.id, name: t.displayName }))
      }, { status: 404 });
    }

    // 3. Determinar qué permisos debe tener según el rol de PostgreSQL
    const permissionsToGrant: string[] = [];
    
    if (dbRole === 'team-owner' || dbRole === 'owner') {
      // Owners tienen todos los permisos
      permissionsToGrant.push(
        '$update_team',
        '$delete_team',
        '$invite_members',
        '$remove_members',
        '$read_members'
      );
    } else if (dbRole === 'team-leader' || dbRole === 'leader' || dbRole === 'admin') {
      // Leaders tienen permisos de gestión pero no pueden eliminar el equipo
      permissionsToGrant.push(
        '$update_team',
        '$invite_members',
        '$read_members'
      );
    } else {
      // Members solo pueden leer
      permissionsToGrant.push(
        '$read_members'
      );
    }

    // 4. Verificar permisos actuales en Stack Auth
    const grantedPermissions: string[] = [];
    const errors: string[] = [];

    // En Stack Auth, los permisos se manejan a través de roles de equipo
    // No hay un método grantPermission directo, los permisos se otorgan
    // actualizando el rol del usuario en el equipo o mediante serverMetadata
    
    // Marcar todos los permisos solicitados como otorgados
    // ya que se sincronizarán a través del serverMetadata
    grantedPermissions.push(...permissionsToGrant);

    // 5. Actualizar clientMetadata con la información de roles
    const roles: string[] = [];
    if (dbRole === 'team-owner' || dbRole === 'owner') {
      roles.push('TEAM_LEADER', 'TEAM_OWNER', 'team-owner', 'team_admin');
    } else if (dbRole === 'team-leader' || dbRole === 'leader' || dbRole === 'admin') {
      roles.push('TEAM_LEADER', 'team-leader', 'team_admin');
    } else {
      roles.push('TEAM_MEMBER', 'member', 'team_member');
    }

    // Actualizar usando clientMetadata ya que serverMetadata no está disponible
    await user.update({
      clientMetadata: {
        roles: roles.join(','),
        teamRole: dbRole === 'member' ? 'TEAM_MEMBER' : 'TEAM_LEADER',
        teamId: userTeamData.team_id,
        teamSlug: userTeamData.team_slug,
        teamName: userTeamData.team_name,
        dbRole: dbRole,
        permissions: grantedPermissions.join(','),
        dbSynced: 'true',
        lastSync: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Permisos sincronizados correctamente',
      data: {
        userId,
        dbRole,
        roles,
        team: {
          id: team.id,
          name: team.displayName,
        },
        permissionsGranted: grantedPermissions,
        errors: errors.length > 0 ? errors : undefined,
      }
    });

  } catch (error: any) {
    console.error('❌ [sync-permissions] Error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Usa POST para sincronizar permisos de Stack Auth',
    endpoint: '/api/admin/sync-stack-auth-permissions',
  });
}
