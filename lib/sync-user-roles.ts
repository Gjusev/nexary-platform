import { Pool } from 'pg';
import { stackServerAppForMiddleware } from './stack/stack-server';
import type { StackUser } from './types/user';

/**
 * Sincroniza automáticamente los roles del usuario desde PostgreSQL a Stack Auth
 * Se ejecuta en cada autenticación/request
 */
export async function syncUserRolesFromDB(userId: string): Promise<{
  success: boolean;
  role?: string;
  teamSlug?: string;
  error?: string;
}> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Usar la instancia singleton de Stack Auth
    const stackApp = stackServerAppForMiddleware;

    // 1. Buscar el rol del usuario en PostgreSQL
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

    // Si no tiene equipo en la DB, retornar role por defecto
    if (!result.rows || result.rows.length === 0) {
      // Obtener el usuario actual de Stack Auth
      const user = await stackApp.getUser();
      const typedUser = user as unknown as StackUser | null;
      if (typedUser && typedUser.id === userId) {
        // Asignar rol de miembro por defecto
        await typedUser.update?.({
          serverMetadata: {
            roles: ['TEAM_MEMBER', 'member'],
            teamRole: 'TEAM_MEMBER',
            dbSynced: true,
            lastSync: new Date().toISOString(),
          },
        });
        console.debug('[syncUserRoles] No team found, set default role to TEAM_MEMBER');
      }

      return { 
        success: true, 
        role: 'TEAM_MEMBER',
      };
    }

    const userTeamData = result.rows[0];
    const dbRole = userTeamData.role; // 'member', 'team-owner', 'team-leader', etc.
    
    // 2. Mapear rol de la DB a roles internos para nuestro sistema
    let internalRole = 'TEAM_MEMBER';
    const roles: string[] = [];
    
    if (dbRole === 'team-owner' || dbRole === 'owner') {
      internalRole = 'TEAM_LEADER';
      roles.push('TEAM_LEADER', 'TEAM_OWNER', 'team-owner');
    } else if (dbRole === 'team-leader' || dbRole === 'leader' || dbRole === 'admin') {
      internalRole = 'TEAM_LEADER';
      roles.push('TEAM_LEADER', 'team-leader');
    } else {
      roles.push('TEAM_MEMBER', 'member');
    }

    console.debug(`[syncUserRoles] Mapped DB role to Stack roles:`, {
      dbRole,
      internalRole,
      rolesArray: roles
    });

    // 3. Obtener el usuario actual de Stack Auth
    const user = await stackApp.getUser();
    const typedUser = user as unknown as StackUser | null;

    if (typedUser && typedUser.id === userId) {
      // Actualizar serverMetadata del usuario
      const newMetadata = {
        roles: roles, // Array completo de roles incluyendo aliases
        teamRole: internalRole,
        teamId: userTeamData.team_id,
        teamSlug: userTeamData.team_slug,
        teamName: userTeamData.team_name,
        dbRole: dbRole, // Guardar también el rol original de la DB
        dbSynced: true,
        lastSync: new Date().toISOString(),
      };
      
      await typedUser.update?.({
        serverMetadata: newMetadata,
      });
    } else {
      console.warn(`⚠️ [syncUserRoles] No se pudo obtener el usuario ${userId} de Stack Auth`);
    }

    return {
      success: true,
      role: internalRole,
      teamSlug: userTeamData.team_slug,
    };

  } catch (error) {
    console.error(`❌ [syncUserRoles] Error sincronizando usuario ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await pool.end();
  }
}

/**
 * Verifica si necesita sincronización (si han pasado más de X minutos desde la última sync)
 */
export function needsSync(lastSync?: string, maxAgeMinutes: number = 5): boolean {
  if (!lastSync) return true;
  
  const lastSyncTime = new Date(lastSync).getTime();
  const now = Date.now();
  const diffMinutes = (now - lastSyncTime) / (1000 * 60);
  
  return diffMinutes > maxAgeMinutes;
}
