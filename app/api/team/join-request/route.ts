import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createJoinRequest } from '@/lib/team-management';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { teamSlug, message } = await request.json();

    if (!teamSlug) {
      return NextResponse.json({ error: 'teamSlug requerido' }, { status: 400 });
    }

    const joinRequest = await createJoinRequest(
      teamSlug,
      session.user.email,
      session.user.name || undefined,
      message
    );

    return NextResponse.json({
      success: true,
      joinRequest,
      message: 'Solicitud de entrada enviada exitosamente'
    });

  } catch (error) {
    console.error('Error creating join request:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}