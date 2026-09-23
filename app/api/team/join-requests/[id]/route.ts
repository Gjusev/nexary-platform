import { NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';
import { authLogger } from '@/lib/stack/logging';
import { reviewJoinRequest } from '@/lib/team-management';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = getClientIp(request);
  const { id: requestId } = await params;
  
  try {
    const body = await request.json();
    const { action } = body;
    
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Acción inválida' },
        { status: 400 }
      );
    }
    
    // TODO: Get user from session and verify they are team admin
    const reviewedBy = 'admin-user-id'; // This should come from user session
    
    const result = await reviewJoinRequest(
      requestId,
      reviewedBy,
      action
    );
    
    if (result.success) {
      authLogger.info('Join request reviewed', { 
        requestId,
        action,
        reviewedBy,
        ip: clientIp 
      });
      
      return NextResponse.json({ success: true });
    } else {
      authLogger.warn('Failed to review join request', { 
        requestId,
        action,
        error: result.error,
        ip: clientIp 
      });
      
      return NextResponse.json(
        { success: false, error: result.error || 'Anfrage konnte nicht verarbeitet werden' },
        { status: 404 }
      );
    }
  } catch (error) {
    authLogger.error('Error reviewing join request', { 
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: clientIp 
    });
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
