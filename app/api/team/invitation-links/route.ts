import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import {
  createInvitationLink,
  getInvitationLinksByTeam,
  revokeInvitationLink,
  validateInvitationLink
} from '@/lib/team-invitation-links';
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
    const { teamSlug, wasCreated } = await ensureTeamExists(teamId, teamName, 'Invitation Links GET');
    const links = await getInvitationLinksByTeam(teamSlug);

    return NextResponse.json({
      success: true,
      links
    });

  } catch (error) {
    console.error('Error fetching invitation links:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Only team leaders and owners can create invitation links
    const hasUpdatePermission = await (user as any).hasPermission?.(selectedTeam, '$update_team') || false;
    if (!hasUpdatePermission) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    // Obtener el slug del team desde la base de datos (auto-sync si es necesario)
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    const { teamSlug, wasCreated } = await ensureTeamExists(teamId, teamName, 'Invitation Links POST');
    const userEmail = (user as any).primaryEmail || '';

    const body = await request.json();
    const { expiresInHours, maxUses, notes } = body;

    const link = await createInvitationLink(
      teamSlug,
      userEmail,
      expiresInHours,
      maxUses,
      notes
    );

    return NextResponse.json({
      success: true,
      link
    });

  } catch (error) {
    console.error('Error creating invitation link:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    // Only team leaders and owners can revoke invitation links
    const hasUpdatePermission = await (user as any).hasPermission?.(selectedTeam, '$update_team') || false;
    if (!hasUpdatePermission) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');

    if (!linkId) {
      return NextResponse.json({ error: 'linkId requerido' }, { status: 400 });
    }

    const result = await revokeInvitationLink(linkId);

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Enlace revocado exitosamente' : result.error
    });

  } catch (error) {
    console.error('Error revoking invitation link:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}