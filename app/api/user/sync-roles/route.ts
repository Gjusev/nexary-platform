import { NextRequest, NextResponse } from 'next/server';
import { stackServerAppForMiddleware } from '@/lib/stack/stack-server';
import { syncUserRolesFromDB } from '@/lib/sync-user-roles';

/**
 * POST /api/user/sync-roles
 * Fuerza la sincronización de roles desde PostgreSQL
 * Se puede llamar manualmente o después de eventos como join team, cambio de rol, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerAppForMiddleware.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const result = await syncUserRolesFromDB((user as any).id);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Roles sincronizados correctamente',
        data: {
          userId: (user as any).id,
          role: result.role,
          teamSlug: result.teamSlug,
        },
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [sync-roles API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}
