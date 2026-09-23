/**
 * Script to fix team slugs in the database
 * This script updates all teams to use their team ID as the slug
 * instead of the team name, for consistency with Stack Auth lookups
 */

import { query } from '@/lib/db';

async function fixTeamSlugs() {
  try {
    console.log('🔧 Starting team slug fix...');
    
    // Get all teams
    const { rows: teams } = await query<{ id: string; slug: string; name: string }>(
      'SELECT id, slug, name FROM teams'
    );
    
    console.log(`Found ${teams.length} teams to check`);
    
    let fixedCount = 0;
    
    for (const team of teams) {
      if (team.slug !== team.id) {
        console.log(`Fixing team "${team.name}": slug "${team.slug}" -> "${team.id}"`);
        
        await query(
          'UPDATE teams SET slug = $1, updated_at = NOW() WHERE id = $2',
          [team.id, team.id]
        );
        
        fixedCount++;
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} team slugs`);
    console.log(`✅ ${teams.length - fixedCount} teams already had correct slugs`);
    
  } catch (error) {
    console.error('❌ Error fixing team slugs:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixTeamSlugs()
    .then(() => {
      console.log('✅ Team slug fix complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Team slug fix failed:', error);
      process.exit(1);
    });
}

export { fixTeamSlugs };
