import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { initializeTables } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Only allow team owners to run migrations
    if (!session?.roles?.includes('team-owner')) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    await initializeTables();
    return NextResponse.json({
      success: true,
      message: 'Migración de base de datos completada exitosamente'
    });

  } catch (error) {
    console.error('Error en migración:', error);
    return NextResponse.json(
      { 
        error: 'Error en la migración', 
        details: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}