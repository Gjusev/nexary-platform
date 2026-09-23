import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * GET /api/debug/stack-auth-team-info
 * Obtiene información completa del equipo y permisos del usuario en Stack Auth
 */
export async function GET(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = (user as any).id;
    // Obtener equipos del usuario
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    let teamInfo: any = {
      userId,
      email: (user as any).primaryEmail,
      displayName: (user as any).displayName,
      teamsCount: teams.length,
      selectedTeam: selectedTeam ? {
        id: selectedTeam.id,
        displayName: selectedTeam.displayName,
        createdAt: selectedTeam.createdAt,
      } : null,
    };

    // Si hay un equipo seleccionado, obtener información detallada
    if (selectedTeam) {
      try {
        // Obtener el perfil del usuario en el equipo
        const teamProfile = await (user as any).getTeamProfile?.(selectedTeam) || null;
        
        // Obtener permisos del usuario en el equipo
        const permissions = await (user as any).listPermissions?.(selectedTeam) || [];
        
        // Verificar permisos específicos de admin
        const adminPermissions = ['$update_team', '$delete_team', '$invite_members', '$remove_members'];
        const hasPermissions: any = {};
        
        for (const permission of adminPermissions) {
          try {
            hasPermissions[permission] = await (user as any).hasPermission?.(selectedTeam, permission) || false;
          } catch (error) {
            hasPermissions[permission] = false;
          }
        }

        teamInfo.teamDetails = {
          teamProfile: teamProfile ? {
            displayName: teamProfile.displayName,
            profileImageUrl: teamProfile.profileImageUrl,
          } : null,
          permissions: permissions.map((p: any) => p.id || p),
          hasPermissions,
        };

        // Intentar obtener lista de miembros del equipo
        try {
          const members = await (selectedTeam as any).listUsers?.() || [];
          teamInfo.teamDetails.members = members.map((member: any) => ({
            id: member.id,
            email: member.primaryEmail || member.email,
            displayName: member.displayName,
          }));

          // Buscar quién es el admin del equipo
          const admins = [];
          for (const member of members) {
            try {
              const memberPermissions = await (member as any).listPermissions?.(selectedTeam) || [];
              const hasUpdateTeam = memberPermissions.some((p: any) => 
                (p.id || p) === '$update_team'
              );
              
              if (hasUpdateTeam) {
                admins.push({
                  id: member.id,
                  email: member.primaryEmail || member.email,
                  displayName: member.displayName,
                });
              }
            } catch (error) {
              }
          }

          teamInfo.teamDetails.admins = admins;
          } catch (error) {
          }

      } catch (error) {
        console.error('❌ Error obteniendo detalles del equipo:', error);
        teamInfo.teamDetailsError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Obtener serverMetadata y clientMetadata
    teamInfo.serverMetadata = (user as any).serverMetadata || {};
    teamInfo.clientMetadata = (user as any).clientMetadata || {};

    return NextResponse.json({
      success: true,
      data: teamInfo,
    });

  } catch (error) {
    console.error('❌ [stack-auth-team-info] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}
