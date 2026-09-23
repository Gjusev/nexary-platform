import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * GET /api/debug/check-team-slug
 * Verifica la relación entre Stack Auth team ID y PostgreSQL team slug
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

    // Obtener equipos del usuario
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json(
        { error: 'No team found' },
        { status: 404 }
      );
    }

    const teamId = selectedTeam.id;
    
    // Obtener el slug del team desde la base de datos
    const teamResult = await query<{ id: string; slug: string; name: string }>(
      'SELECT id, slug, name FROM teams WHERE id = $1',
      [teamId]
    );
    
    if (teamResult.rows.length === 0) {
      return NextResponse.json(
        { 
          error: 'Team not found in database',
          stackAuthTeamId: teamId,
          stackAuthTeamName: selectedTeam.displayName,
        },
        { status: 404 }
      );
    }

    const dbTeam = teamResult.rows[0];
    
    // Buscar RAG packages con ese slug
    const ragResult = await query<{ id: string; name: string; team_slug: string }>(
      'SELECT id, name, team_slug FROM rag_packages WHERE team_slug = $1 AND deleted_at IS NULL',
      [dbTeam.slug]
    );

    return NextResponse.json({
      success: true,
      stackAuth: {
        teamId: selectedTeam.id,
        teamName: selectedTeam.displayName,
      },
      database: {
        teamId: dbTeam.id,
        teamSlug: dbTeam.slug,
        teamName: dbTeam.name,
      },
      ragPackages: ragResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        teamSlug: row.team_slug,
      })),
      ragPackagesCount: ragResult.rows.length,
    });
  } catch (error) {
    console.error('[check-team-slug] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
