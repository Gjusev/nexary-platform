import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import {
  getTeamMembers,
  updateMemberRole,
  removeMemberFromTeam,
  suspendMember,
  reactivateMember
} from '@/lib/team-members';
import { query } from '@/lib/db';
import { ensureTeamExists } from '@/lib/ensure-team-sync';
import { checkTeamRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

export async function GET(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener el equipo del usuario
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json({ error: 'Usuario no pertenece a ningún equipo' }, { status: 400 });
    }

    // Obtener el slug del team desde la base de datos (auto-sync si es necesario)
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    const { teamSlug, wasCreated } = await ensureTeamExists(teamId, teamName, 'Team Members GET');
    const members = await getTeamMembers(teamSlug);

    return NextResponse.json({
      success: true,
      members
    });

  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener el equipo del usuario
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json({ error: 'Usuario no pertenece a ningún equipo' }, { status: 400 });
    }

    // Only team leaders and owners can manage members
    const hasUpdatePermission = await (user as any).hasPermission?.(selectedTeam, '$update_team') || false;
    if (!hasUpdatePermission) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const body = await request.json();
    const { action, memberId, role } = body;

    // Obtener el slug del team desde la base de datos (auto-sync si es necesario)
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    const { teamSlug } = await ensureTeamExists(teamId, teamName, 'Team Members PATCH');
    const userEmail = (user as any).primaryEmail || '';

    let result;
    switch (action) {
      case 'updateRole':
        if (!role || !['member', 'team-leader'].includes(role)) {
          return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
        }
        result = await updateMemberRole(memberId, role, userEmail);
        break;

      case 'suspend':
        result = await suspendMember(memberId, userEmail);
        break;

      case 'reactivate':
        result = await reactivateMember(memberId, userEmail);
        break;

      case 'remove':
        result = await removeMemberFromTeam(memberId, teamSlug, userEmail);
        break;

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Miembro ${action === 'updateRole' ? 'actualizado' : 
                           action === 'suspend' ? 'suspendido' : 
                           action === 'reactivate' ? 'reactivado' : 'removido'} exitosamente`
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error managing team member:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}