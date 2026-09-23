import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * GET /api/user/sync
 * Obtiene la información completa del usuario actual incluyendo equipos y roles
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener usuario autenticado
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener equipos del usuario
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];

    // Obtener roles del equipo actual
    let roles: string[] = [];
    if (selectedTeam) {
      // Stack Auth almacena roles en el equipo
      const teamRole = selectedTeam.role;
      roles = [teamRole];
      
      // Agregar roles adicionales desde serverMetadata si existen
      const serverRoles = (user as any).serverMetadata?.roles;
      if (Array.isArray(serverRoles)) {
        roles = [...roles, ...serverRoles];
      }
    }

    // Normalizar información del usuario
    const userData = {
      id: user.id,
      email: (user as any).primaryEmail || null,
      displayName: (user as any).displayName || null,
      profileImageUrl: (user as any).profileImageUrl || null,
      teams: teams.map((team: any) => ({
        id: team.id,
        displayName: team.displayName,
        role: team.role,
      })),
      currentTeam: selectedTeam ? {
        id: selectedTeam.id,
        displayName: selectedTeam.displayName,
        role: selectedTeam.role,
      } : null,
      roles,
      serverMetadata: (user as any).serverMetadata || {},
      clientMetadata: (user as any).clientMetadata || {},
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error al sincronizar usuario:', error);
    return NextResponse.json(
      { error: 'Error al obtener información del usuario' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/sync
 * Actualiza los metadatos del usuario (roles, equipo, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { roles, teamSlug } = body;

    // Actualizar roles en serverMetadata
    if (roles && Array.isArray(roles)) {
      await (user as any).update?.({
        serverMetadata: {
          ...(user as any).serverMetadata,
          roles,
        },
      });
    }

    // Cambiar equipo seleccionado si se especifica
    if (teamSlug) {
      const teams = await (user as any).listTeams?.() || [];
      const targetTeam = teams.find((t: any) => t.id === teamSlug);
      
      if (targetTeam) {
        await (user as any).setSelectedTeam?.(targetTeam.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json(
      { error: 'Error al actualizar información del usuario' },
      { status: 500 }
    );
  }
}
