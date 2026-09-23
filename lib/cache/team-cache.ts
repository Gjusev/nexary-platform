/**
 * Team-specific caching layer.
 *
 * Provides caching for team-related data like slugs, details, and member counts.
 */

import { cacheGet, cacheSet, cacheDelete } from './redis-cache';
import { query } from '../db';
import { CacheTTL } from '../constants';

const TEAM_CACHE_PREFIX = 'team:';

/**
 * Get team slug by team ID with caching.
 *
 * @param teamId - Team UUID
 * @returns Team slug or null if not found
 */
export async function getTeamSlug(teamId: string): Promise<string | null> {
  const cacheKey = `${TEAM_CACHE_PREFIX}slug:${teamId}`;

  // Try cache first
  const cached = await cacheGet<string>({ key: cacheKey, ttl: CacheTTL.TEAM_SLUG });
  if (cached !== null) {
    return cached;
  }

  // Fetch from database
  const { rows } = await query<{ slug: string }>(
    'SELECT slug FROM projectnexus.teams WHERE id = $1',
    [teamId]
  );

  if (rows.length === 0) {
    return null;
  }

  const slug = rows[0].slug;

  // Cache the result
  await cacheSet({ key: cacheKey, ttl: CacheTTL.TEAM_SLUG }, slug);

  return slug;
}

/**
 * Get team details with caching.
 *
 * @param teamSlug - Team slug
 * @returns Team details or null if not found
 */
export async function getTeamDetails(teamSlug: string): Promise<any | null> {
  const cacheKey = `${TEAM_CACHE_PREFIX}details:${teamSlug}`;

  // Try cache first
  const cached = await cacheGet<any>({ key: cacheKey, ttl: CacheTTL.TEAM_DETAILS });
  if (cached !== null) {
    return cached;
  }

  // Fetch from database
  const { rows } = await query(
    `SELECT id::text, slug, name, description, created_at::text, updated_at::text
     FROM projectnexus.teams WHERE slug = $1`,
    [teamSlug]
  );

  if (rows.length === 0) {
    return null;
  }

  const team = rows[0];

  // Get member count
  const { rows: memberCount } = await query(
    `SELECT COUNT(*) as count
     FROM projectnexus.team_members
     WHERE team_id = $1 AND status = 'active'`,
    [team.id]
  );

  const teamWithMembers = {
    ...team,
    memberCount: parseInt(memberCount[0]?.count || '0'),
  };

  // Cache the result
  await cacheSet({ key: cacheKey, ttl: CacheTTL.TEAM_DETAILS }, teamWithMembers);

  return teamWithMembers;
}

/**
 * Cache team slug for quick lookup.
 *
 * @param teamId - Team UUID
 * @param slug - Team slug
 */
export async function cacheTeamSlug(teamId: string, slug: string): Promise<void> {
  const cacheKey = `${TEAM_CACHE_PREFIX}slug:${teamId}`;
  await cacheSet({ key: cacheKey, ttl: CacheTTL.TEAM_SLUG }, slug);
}

/**
 * Invalidate team cache when team is updated.
 *
 * @param teamId - Team UUID
 * @param teamSlug - Team slug
 */
export async function invalidateTeamCache(teamId: string, teamSlug: string): Promise<void> {
  await Promise.all([
    cacheDelete({ key: `${TEAM_CACHE_PREFIX}slug:${teamId}` }),
    cacheDelete({ key: `${TEAM_CACHE_PREFIX}details:${teamSlug}` }),
  ]);
}
