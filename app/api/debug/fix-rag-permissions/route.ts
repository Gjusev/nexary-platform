import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * POST /api/debug/fix-rag-permissions
 * Arregla los permisos RAG asignando automáticamente los packages del team a todos los miembros
 */
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json({ error: 'No team found' }, { status: 400 });
    }

    const hasUpdatePermission = await (user as any).hasPermission?.(selectedTeam, '$update_team') || false;
    if (!hasUpdatePermission) {
      return NextResponse.json({ error: 'Se requieren permisos de admin' }, { status: 403 });
    }

    // Obtener team slug
    const teamId = selectedTeam.id;
    const teamResult = await query<{ slug: string }>(
      'SELECT slug FROM teams WHERE id = $1',
      [teamId]
    );
    
    if (teamResult.rows.length === 0) {
      return NextResponse.json({ error: 'Team not found in database' }, { status: 404 });
    }
    
    const teamSlug = teamResult.rows[0].slug;

    // Obtener todos los RAG packages del team
    const packagesResult = await query<{ id: string; name: string }>(
      'SELECT id, name FROM rag_packages WHERE team_slug = $1 AND deleted_at IS NULL',
      [teamSlug]
    );

    if (packagesResult.rows.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay RAG packages para asignar',
        teamSlug,
      });
    }

    const results = {
      teamSlug,
      packagesFound: packagesResult.rows.length,
      packagesAssigned: [] as any[],
      errors: [] as any[],
    };

    // Asignar cada package al team con permisos completos
    for (const pkg of packagesResult.rows) {
      try {
        // Verificar si ya existe la asignación
        const existingResult = await query(
          'SELECT * FROM rag_team_assignments WHERE rag_id = $1 AND team_slug = $2',
          [pkg.id, teamSlug]
        );

        if (existingResult.rows.length === 0) {
          // Crear nueva asignación
          await query(
            `INSERT INTO rag_team_assignments 
             (rag_id, team_slug, can_query, can_ingest, can_update, can_delete)
             VALUES ($1, $2, true, true, true, true)`,
            [pkg.id, teamSlug]
          );

          results.packagesAssigned.push({
            packageId: pkg.id,
            packageName: pkg.name,
            status: 'created',
          });
        } else {
          // Actualizar asignación existente
          await query(
            `UPDATE rag_team_assignments 
             SET can_query = true, can_ingest = true, can_update = true, can_delete = true
             WHERE rag_id = $1 AND team_slug = $2`,
            [pkg.id, teamSlug]
          );

          results.packagesAssigned.push({
            packageId: pkg.id,
            packageName: pkg.name,
            status: 'updated',
          });
        }
      } catch (error) {
        results.errors.push({
          packageId: pkg.id,
          packageName: pkg.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Permisos RAG actualizados correctamente',
      results,
    });

  } catch (error) {
    console.error('[fix-rag-permissions] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/debug/fix-rag-permissions
 * Muestra el estado actual de los permisos RAG
 */
export async function GET(request: NextRequest) {
  try {
    // Intentar obtener teamSlug del query param (para debugging sin auth)
    const url = new URL(request.url);
    let teamSlug = url.searchParams.get('teamSlug');
    let userId = url.searchParams.get('userId') || 'debug-user';

    // Si no hay teamSlug en el query, intentar autenticación con Stack Auth
    if (!teamSlug) {
      const user = await stackServerApp.getUser();
      if (!user) {
        return NextResponse.json({ 
          error: 'No autorizado. Proporciona ?teamSlug=xxx o autentícate con cookies.',
          example: '/api/debug/fix-rag-permissions?teamSlug=21-3124-uzae'
        }, { status: 401 });
      }

      userId = (user as any).id;
      
      // Obtener team slug desde Stack Auth
      const teams = await (user as any).listTeams?.() || [];
      const selectedTeam = (user as any).selectedTeam || teams[0];
      
      if (!selectedTeam) {
        return NextResponse.json({ error: 'No team found' }, { status: 400 });
      }

      const teamId = selectedTeam.id;
      const teamResult = await query<{ slug: string }>(
        'SELECT slug FROM teams WHERE id = $1',
        [teamId]
      );
      
      if (teamResult.rows.length === 0) {
        return NextResponse.json({ error: 'Team not found in database' }, { status: 404 });
      }
      
      teamSlug = teamResult.rows[0].slug;
    }

    // Obtener RAG packages
    const packagesResult = await query<{ id: string; name: string }>(
      'SELECT id, name FROM rag_packages WHERE team_slug = $1 AND deleted_at IS NULL',
      [teamSlug]
    );

    // Obtener asignaciones de team
    const teamAssignmentsResult = await query(
      `SELECT rag_id, can_query, can_ingest, can_update, can_delete 
       FROM rag_team_assignments 
       WHERE team_slug = $1`,
      [teamSlug]
    );

    // Obtener asignaciones de usuario
    const userAssignmentsResult = await query(
      `SELECT rag_id, can_query, can_ingest, can_update, can_delete 
       FROM rag_user_assignments 
       WHERE team_slug = $1 AND user_id = $2`,
      [teamSlug, userId]
    );

    return NextResponse.json({
      teamSlug,
      userId,
      packages: packagesResult.rows,
      teamAssignments: teamAssignmentsResult.rows,
      userAssignments: userAssignmentsResult.rows,
      summary: {
        totalPackages: packagesResult.rows.length,
        packagesWithTeamAccess: teamAssignmentsResult.rows.length,
        packagesWithUserAccess: userAssignmentsResult.rows.length,
      },
    });

  } catch (error) {
    console.error('[fix-rag-permissions] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
