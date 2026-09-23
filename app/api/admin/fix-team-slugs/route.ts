import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * API route to fix team slugs in the database
 * This will update all teams to use their team ID as the slug
 * GET /api/admin/fix-team-slugs
 */
export async function GET(request: NextRequest) {
  try {
    // Get all teams
    const { rows: teams } = await query<{ id: string; slug: string; name: string }>(
      'SELECT id, slug, name FROM teams'
    );
    
    const fixes: Array<{ name: string; oldSlug: string; newSlug: string }> = [];
    
    for (const team of teams) {
      if (team.slug !== team.id) {
        fixes.push({
          name: team.name,
          oldSlug: team.slug,
          newSlug: team.id
        });
        
        await query(
          'UPDATE teams SET slug = $1, updated_at = NOW() WHERE id = $2',
          [team.id, team.id]
        );
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixes.length} team slugs`,
      totalTeams: teams.length,
      fixes
    });
    
  } catch (error) {
    console.error('❌ Error fixing team slugs:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error fixing team slugs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
