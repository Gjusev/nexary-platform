import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

/**
 * GET /api/admin/check-db
 * Consulta directa a la base de datos para ver teams y miembros
 */
export async function GET(request: NextRequest) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // 1. Ver todos los teams
    const teamsResult = await pool.query(`
      SELECT id, slug, name, description, created_at
      FROM projectnexus.teams
      ORDER BY created_at DESC
    `);
    
    // 2. Ver todos los miembros
    const membersResult = await pool.query(`
      SELECT 
        tm.id,
        tm.user_id,
        tm.team_id,
        tm.role,
        tm.joined_at,
        t.slug as team_slug,
        t.name as team_name
      FROM projectnexus.team_members tm
      JOIN projectnexus.teams t ON tm.team_id = t.id
      ORDER BY tm.joined_at DESC
    `);

    return NextResponse.json({
      success: true,
      data: {
        teams: teamsResult.rows,
        members: membersResult.rows,
        summary: {
          totalTeams: teamsResult.rows.length,
          totalMembers: membersResult.rows.length,
        }
      }
    });

  } catch (error) {
    console.error('❌ Error consultando DB:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido',
        details: error
      },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
