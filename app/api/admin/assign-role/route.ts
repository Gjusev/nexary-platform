import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';

/**
 * POST /api/admin/assign-role
 * Asigna un rol a un usuario (solo para debugging/setup inicial)
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await stackServerApp.getUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId y role son requeridos' },
        { status: 400 }
      );
    }

    // Por seguridad, solo permitir asignar roles a uno mismo durante testing
    if (userId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Solo puedes asignar roles a tu propio usuario' },
        { status: 403 }
      );
    }

    // Actualizar serverMetadata con el rol
    await (currentUser as any).update({
      serverMetadata: {
        ...(currentUser as any).serverMetadata,
        roles: [role],
      },
    });

    return NextResponse.json({ 
      success: true,
      message: `Rol ${role} asignado correctamente`,
      userId,
    });
  } catch (error) {
    console.error('Error al asignar rol:', error);
    return NextResponse.json(
      { error: 'Error al asignar rol' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/assign-role
 * Obtiene información sobre roles disponibles
 */
export async function GET(request: NextRequest) {
  const availableRoles = [
    { value: 'TEAM_LEADER', label: 'Team Leader (Admin)', description: 'Acceso completo a gestión del equipo y RAGs' },
    { value: 'TEAM_MEMBER', label: 'Team Member', description: 'Acceso solo a chat' },
    { value: 'GLOBAL_ADMIN', label: 'Global Admin', description: 'Acceso completo a toda la plataforma' },
  ];

  return NextResponse.json({ availableRoles });
}
