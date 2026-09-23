/**
 * Feature Flags System for Nexary
 *
 * Simple in-memory cache with TTL for feature flags.
 * Falls back to database table if Redis is not available.
 */

import { query } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

export type FeatureFlagName =
  | 'OIDC_ENABLED_GLOBAL' // Enable OIDC globally
  | 'OIDC_CANARY_PERCENT' // Percentage of users in canary (0-100)
  | 'OIDC_FORCE_TEAM' // Force OIDC for specific team (value = teamSlug)
  | 'OIDC_MIGRATION_MODE' // Migration mode: off, shadow, canary, full
  | 'SCIM_ENABLED_GLOBAL' // Enable SCIM globally
  | 'ENTERPRISE_AUTH_ENABLED'; // Enable enterprise auth globally

export type FeatureFlagValue = string | number | boolean | null;

export interface FeatureFlag {
  flag: FeatureFlagName;
  enabled: boolean;
  teamSlug?: string | null; // null = global flag
  value?: FeatureFlagValue;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

interface CachedFlag {
  enabled: boolean;
  value?: FeatureFlagValue;
  expiresAt: number;
}

const flagCache = new Map<string, CachedFlag>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

/**
 * Ensure feature_flags table exists
 */
export async function ensureFeatureFlagsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS projectnexus.feature_flags (
      flag TEXT NOT NULL,
      team_slug TEXT,
      enabled BOOLEAN NOT NULL DEFAULT true,
      value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (flag, team_slug)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_feature_flags_team ON projectnexus.feature_flags(team_slug)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON projectnexus.feature_flags(flag)
  `);

  // Seed default flags
  await query(`
    INSERT INTO projectnexus.feature_flags (flag, team_slug, enabled, value)
    VALUES
      ('OIDC_ENABLED_GLOBAL', NULL, false, 'false'),
      ('OIDC_CANARY_PERCENT', NULL, true, '0'),
      ('OIDC_MIGRATION_MODE', NULL, true, 'off'),
      ('SCIM_ENABLED_GLOBAL', NULL, true, 'true'),
      ('ENTERPRISE_AUTH_ENABLED', NULL, true, 'true')
    ON CONFLICT (flag, team_slug) DO NOTHING
  `);
}

/**
 * Parse value string to appropriate type
 */
function parseValue(value: string | null | undefined): FeatureFlagValue {
  if (value === null || value === undefined) return null;

  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    // If not valid JSON, return as string
    return value;
  }
}

/**
 * Load flag from database
 */
async function loadFlagFromDb(
  flag: FeatureFlagName,
  teamSlug?: string
): Promise<{ enabled: boolean; value?: FeatureFlagValue } | null> {
  const result = await query(
    `SELECT enabled, value FROM projectnexus.feature_flags
     WHERE flag = $1 AND (team_slug = $2 OR team_slug IS NULL)
     ORDER BY team_slug DESC NULLS LAST
     LIMIT 1`,
    [flag, teamSlug || null]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    enabled: row.enabled,
    value: parseValue(row.value),
  };
}

/**
 * Save or update flag in database
 */
async function saveFlagToDb(
  flag: FeatureFlagName,
  enabled: boolean,
  value?: FeatureFlagValue,
  teamSlug?: string
): Promise<void> {
  const valueStr = value !== undefined ? JSON.stringify(value) : null;

  await query(
    `INSERT INTO projectnexus.feature_flags (flag, team_slug, enabled, value, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (flag, team_slug)
     DO UPDATE SET enabled = EXCLUDED.enabled, value = EXCLUDED.value, updated_at = NOW()`,
    [flag, teamSlug || null, enabled, valueStr]
  );
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get cache key for flag
 */
function getCacheKey(flag: FeatureFlagName, teamSlug?: string): string {
  return teamSlug ? `${flag}:${teamSlug}` : flag;
}

/**
 * Check if a feature flag is enabled
 *
 * Priority:
 * 1. Team-specific flag (if teamSlug provided)
 * 2. Global flag
 * 3. Default value (if flag not found)
 */
export async function checkFeatureFlag(
  flag: FeatureFlagName,
  teamSlug?: string
): Promise<boolean> {
  // Check cache first
  const cacheKey = getCacheKey(flag, teamSlug);
  const cached = flagCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.enabled;
  }

  // Load from database
  const fromDb = await loadFlagFromDb(flag, teamSlug);

  if (fromDb) {
    // Cache the result
    flagCache.set(cacheKey, {
      enabled: fromDb.enabled,
      value: fromDb.value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return fromDb.enabled;
  }

  // Default values for unknown flags
  const defaults: Record<FeatureFlagName, boolean> = {
    OIDC_ENABLED_GLOBAL: false,
    OIDC_CANARY_PERCENT: true,
    OIDC_FORCE_TEAM: false,
    OIDC_MIGRATION_MODE: true,
    SCIM_ENABLED_GLOBAL: true,
    ENTERPRISE_AUTH_ENABLED: true,
  };

  return defaults[flag] ?? false;
}

/**
 * Get feature flag value (if any)
 */
export async function getFeatureFlagValue<T = FeatureFlagValue>(
  flag: FeatureFlagName,
  teamSlug?: string
): Promise<T | undefined> {
  // Check cache first
  const cacheKey = getCacheKey(flag, teamSlug);
  const cached = flagCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  // Load from database
  const fromDb = await loadFlagFromDb(flag, teamSlug);

  if (fromDb) {
    // Cache the result
    flagCache.set(cacheKey, {
      enabled: fromDb.enabled,
      value: fromDb.value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return fromDb.value as T;
  }

  return undefined;
}

/**
 * Set or update a feature flag
 */
export async function setFeatureFlag(
  flag: FeatureFlagName,
  enabled: boolean,
  value?: FeatureFlagValue,
  teamSlug?: string
): Promise<void> {
  const cacheKey = getCacheKey(flag, teamSlug);

  // Save to database
  await saveFlagToDb(flag, enabled, value, teamSlug);

  // Update cache
  flagCache.set(cacheKey, {
    enabled,
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Delete a feature flag (resets to default)
 */
export async function deleteFeatureFlag(
  flag: FeatureFlagName,
  teamSlug?: string
): Promise<void> {
  await query(
    `DELETE FROM projectnexus.feature_flags
     WHERE flag = $1 AND (team_slug = $2 OR team_slug IS NULL)`,
    [flag, teamSlug || null]
  );

  // Clear from cache
  const cacheKey = getCacheKey(flag, teamSlug);
  flagCache.delete(cacheKey);
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();

  for (const [key, value] of flagCache.entries()) {
    if (value.expiresAt < now) {
      flagCache.delete(key);
    }
  }
}

/**
 * Clear all cache (useful for testing or force refresh)
 */
export function clearAllCache(): void {
  flagCache.clear();
}

/**
 * Get all flags for a team (including global)
 */
export async function getAllFlags(
  teamSlug?: string
): Promise<FeatureFlag[]> {
  const result = await query(
    `SELECT flag, team_slug, enabled, value, created_at, updated_at
     FROM projectnexus.feature_flags
     WHERE team_slug = $1 OR team_slug IS NULL
     ORDER BY team_slug NULLS LAST, flag`,
    [teamSlug || null]
  );

  return result.rows.map((row) => ({
    flag: row.flag as FeatureFlagName,
    teamSlug: row.team_slug,
    enabled: row.enabled,
    value: parseValue(row.value),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if OIDC is enabled globally or for a specific team
 */
export async function isOIDCEnabled(teamSlug?: string): Promise<boolean> {
  // Check team-specific override first
  if (teamSlug) {
    const teamOverride = await checkFeatureFlag('OIDC_FORCE_TEAM', teamSlug);
    if (teamOverride) return true;
  }

  // Fall back to global flag
  return checkFeatureFlag('OIDC_ENABLED_GLOBAL');
}

/**
 * Get OIDC migration mode
 */
export async function getOIDCMigrationMode(
  teamSlug?: string
): Promise<'off' | 'shadow' | 'canary' | 'full'> {
  const mode = await getFeatureFlagValue<string>('OIDC_MIGRATION_MODE', teamSlug);
  return (mode as 'off' | 'shadow' | 'canary' | 'full') || 'off';
}

/**
 * Check if user is in canary percentage
 */
export async function isInCanary(
  teamSlug: string,
  userEmail: string
): Promise<boolean> {
  const canaryPercent = await getFeatureFlagValue<number>('OIDC_CANARY_PERCENT');
  const percent = canaryPercent ?? 0;

  if (percent <= 0) return false;
  if (percent >= 100) return true;

  // Hash email to get consistent value 0-100
  let hash = 0;
  for (let i = 0; i < userEmail.length; i++) {
    const char = userEmail.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const score = Math.abs(hash) % 100;
  return score < percent;
}

/**
 * Set OIDC migration mode
 */
export async function setOIDCMigrationMode(
  mode: 'off' | 'shadow' | 'canary' | 'full',
  teamSlug?: string
): Promise<void> {
  await setFeatureFlag('OIDC_MIGRATION_MODE', true, mode, teamSlug);
}

/**
 * Enable/disable OIDC globally
 */
export async function setOIDCEnabled(enabled: boolean): Promise<void> {
  await setFeatureFlag('OIDC_ENABLED_GLOBAL', enabled, enabled.toString());
}

/**
 * Set canary percentage
 */
export async function setCanaryPercentage(percent: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, percent));
  await setFeatureFlag('OIDC_CANARY_PERCENT', true, clamped);
}

/**
 * Force OIDC for a specific team
 */
export async function forceOIDCForTeam(teamSlug: string, enabled: boolean): Promise<void> {
  await setFeatureFlag('OIDC_FORCE_TEAM', enabled, enabled.toString(), teamSlug);
}

// Auto-clear expired cache every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(clearExpiredCache, 5 * 60 * 1000);
}
