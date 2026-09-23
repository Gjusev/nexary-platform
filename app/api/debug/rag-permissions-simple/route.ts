import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/debug/rag-permissions-simple?teamSlug=21-3124-uzae
 * Versión simplificada sin autenticación para debugging
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const teamSlug = url.searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json({ 
        error: 'Se requiere parámetro teamSlug',
        example: '/api/debug/rag-permissions-simple?teamSlug=21-3124-uzae'
      }, { status: 400 });
    }

    // Obtener RAG packages
    const packagesResult = await query<{ id: string; name: string; team_slug: string }>(
      'SELECT id, name, team_slug FROM rag_packages WHERE team_slug = $1 AND deleted_at IS NULL',
      [teamSlug]
    );

    // Obtener asignaciones de team
    const teamAssignmentsResult = await query<{ 
      rag_id: string; 
      team_slug: string;
      can_query: boolean;
      can_ingest: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(
      `SELECT rag_id, team_slug, can_query, can_ingest, can_update, can_delete 
       FROM rag_team_assignments 
       WHERE team_slug = $1`,
      [teamSlug]
    );

    // Obtener asignaciones de usuario
    const userAssignmentsResult = await query<{ 
      rag_id: string; 
      user_id: string;
      can_query: boolean;
    }>(
      `SELECT rag_id, user_id, can_query, can_ingest, can_update, can_delete 
       FROM rag_user_assignments 
       WHERE team_slug = $1`,
      [teamSlug]
    );

    const result = {
      teamSlug,
      packages: packagesResult.rows,
      teamAssignments: teamAssignmentsResult.rows,
      userAssignments: userAssignmentsResult.rows,
      summary: {
        totalPackages: packagesResult.rows.length,
        packagesWithTeamAccess: teamAssignmentsResult.rows.length,
        packagesWithUserAccess: userAssignmentsResult.rows.length,
      },
      diagnosis: {
        hasPackages: packagesResult.rows.length > 0,
        hasTeamAssignments: teamAssignmentsResult.rows.length > 0,
        hasUserAssignments: userAssignmentsResult.rows.length > 0,
        problem: packagesResult.rows.length > 0 && teamAssignmentsResult.rows.length === 0 
          ? 'Los packages existen pero no tienen asignaciones de team. Necesitas ejecutar el fix.'
          : null,
      },
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[rag-permissions-simple] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/debug/rag-permissions-simple
 * Asignar permisos RAG sin autenticación (solo para debugging)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamSlug } = body;

    if (!teamSlug) {
      return NextResponse.json({ 
        error: 'Se requiere teamSlug en el body',
        example: { teamSlug: '21-3124-uzae' }
      }, { status: 400 });
    }

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
    console.error('[rag-permissions-simple] Error:', error);
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
