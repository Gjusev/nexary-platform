/**
 * Utility to ensure a team from Stack Auth exists in PostgreSQL database
 * This handles automatic synchronization of teams when they're created in Stack Auth
 * but not yet present in our local database
 */

import { query } from '@/lib/db';

export interface TeamSyncResult {
  teamSlug: string;
  wasCreated: boolean;
}

/**
 * Ensures a team exists in PostgreSQL, creating it if necessary
 * @param teamId - The Stack Auth team ID
 * @param teamName - The display name of the team
 * @param context - Optional context string for logging (e.g., "RAG Packages GET")
 * @returns Object with teamSlug and whether it was just created
 */
export async function ensureTeamExists(
  teamId: string,
  teamName: string,
  context?: string
): Promise<TeamSyncResult> {
  // First try to get from database
  let teamResult = await query<{ slug: string }>(
    'SELECT slug FROM teams WHERE id = $1',
    [teamId]
  );
  
  let wasCreated = false;
  
  // If not found, create it automatically
  if (teamResult.rows.length === 0) {
    const logContext = context ? `[${context}]` : '[ensureTeamExists]';
    // Insert team into database - USE TEAM ID AS SLUG for consistency with Stack Auth
    // This ensures that functions like getTeamMembers() can find the team in Stack Auth
    await query(
      `INSERT INTO teams (id, slug, name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [teamId, teamId, teamName]  // Use teamId as slug, not teamName
    );
    
    wasCreated = true;
    
    // Query again to get the slug
    teamResult = await query<{ slug: string }>(
      'SELECT slug FROM teams WHERE id = $1',
      [teamId]
    );
  } else {
    // Team exists, but check if slug needs to be fixed (should be teamId, not team name)
    const currentSlug = teamResult.rows[0].slug;
    if (currentSlug !== teamId) {
      const logContext = context ? `[${context}]` : '[ensureTeamExists]';
      // Update the slug to match the team ID
      await query(
        `UPDATE teams SET slug = $1, updated_at = NOW() WHERE id = $2`,
        [teamId, teamId]
      );
      
      // Query again to get the updated slug
      teamResult = await query<{ slug: string }>(
        'SELECT slug FROM teams WHERE id = $1',
        [teamId]
      );
    }
  }
  
  if (teamResult.rows.length === 0) {
    throw new Error(`Failed to create or retrieve team ${teamId}`);
  }
  
  return {
    teamSlug: teamResult.rows[0].slug,
    wasCreated,
  };
}
