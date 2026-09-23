import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

/**
 * GET /api/admin/check-table-structure
 * Verifica la estructura de team_members y sus constraints
 */
export async function GET(request: NextRequest) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // 1. Ver estructura de la tabla
    const columns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'projectnexus'
        AND table_name = 'team_members'
      ORDER BY ordinal_position
    `);

    // 2. Ver constraints
    const constraints = await pool.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'projectnexus.team_members'::regclass
    `);

    // 3. Ver un registro de ejemplo
    const sample = await pool.query(`
      SELECT * FROM projectnexus.team_members LIMIT 1
    `);

    return NextResponse.json({
      success: true,
      structure: {
        columns: columns.rows,
        constraints: constraints.rows,
        sampleRow: sample.rows[0] || null,
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
