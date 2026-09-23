/**
 * Team API Keys Service
 *
 * Manages API keys for team integrations and automation.
 *
 * Features:
 * - Secure key generation with random 32-byte values
 * - SHA-256 hashing for storage
 * - Prefix-based identification (first 8 chars)
 * - Scope-based access control
 * - Rate limiting per key
 * - Usage tracking and analytics
 */

import { createHash, randomBytes } from 'crypto';
import { query } from '@/lib/db';

export const API_KEY_PREFIX = 'nxak_'; // Nexary API Key
export const API_KEY_LENGTH = 32; // bytes
export const API_KEY_DISPLAY_LENGTH = 8; // characters to show

// Available scopes for API keys
export const AVAILABLE_SCOPES = {
  'read:chat': 'Read chat conversations',
  'write:chat': 'Create and modify chat conversations',
  'read:documents': 'Read documents',
  'write:documents': 'Upload and modify documents',
  'read:teams': 'Read team information',
  'write:teams': 'Modify team settings',
  'admin': 'Full administrative access',
} as const;

export type ApiKeyScope = keyof typeof AVAILABLE_SCOPES;

export interface ApiKey {
  id: string;
  teamSlug: string;
  userId: string;
  name: string;
  keyPrefix: string; // First 8 chars for display
  keyHash: string; // SHA-256 hash
  scopes: ApiKeyScope[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyUsage {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  userEmail?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CreateApiKeyInput {
  teamSlug: string;
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date;
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  metadata?: Record<string, any>;
}

/**
 * Generate a new API key
 * Returns the raw key (only shown once) and stores the hash
 */
export async function generateApiKey(input: CreateApiKeyInput): Promise<{
  key: string; // Raw API key (only shown once)
  apiKey: ApiKey; // Stored record
}> {
  // Generate random 32-byte key
  const rawKey = randomBytes(API_KEY_LENGTH);
  const rawKeyBase64 = rawKey.toString('base64').replace(/[+/=]/g, '').substring(0, API_KEY_LENGTH);

  // Add prefix
  const fullKey = `${API_KEY_PREFIX}${rawKeyBase64}`;

  // Create hash for storage
  const keyHash = createHash('sha256').update(fullKey).digest('hex');

  // Extract prefix for display (first 8 chars after prefix)
  const keyPrefix = `${API_KEY_PREFIX}${rawKeyBase64.substring(0, API_KEY_DISPLAY_LENGTH - API_KEY_PREFIX.length)}`;

  // Insert into database
  const { rows } = await query<{
    id: string;
    team_slug: string;
    user_id: string;
    name: string;
    key_hash: string;
    key_prefix: string;
    scopes: string[];
    is_active: boolean;
    expires_at: Date;
    rate_limit_per_minute: number;
    rate_limit_per_hour: number;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO projectnexus.team_api_keys (
      id, team_slug, user_id, name, key_hash, key_prefix,
      scopes, is_active, expires_at, rate_limit_per_minute,
      rate_limit_per_hour, metadata, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, NOW(), NOW()
    )
    RETURNING *`,
    [
      input.teamSlug,
      input.userId,
      input.name,
      keyHash,
      keyPrefix,
      input.scopes,
      input.expiresAt || null,
      input.rateLimitPerMinute || 60,
      input.rateLimitPerHour || 1000,
      input.metadata || {},
    ]
  );

  const row = rows[0];

  return {
    key: fullKey, // Return raw key (only shown once to user)
    apiKey: {
      id: row.id,
      teamSlug: row.team_slug,
      userId: row.user_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      keyHash: row.key_hash,
      scopes: row.scopes as ApiKeyScope[],
      isActive: row.is_active,
      expiresAt: row.expires_at || undefined,
      rateLimitPerMinute: row.rate_limit_per_minute,
      rateLimitPerHour: row.rate_limit_per_hour,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

/**
 * Validate an API key and return the key info if valid
 */
export async function validateApiKey(apiKey: string): Promise<ApiKey | null> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  // Compute hash
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Query database
  const { rows } = await query<{
    id: string;
    team_slug: string;
    user_id: string;
    name: string;
    key_prefix: string;
    key_hash: string;
    scopes: string[];
    is_active: boolean;
    last_used_at: Date;
    expires_at: Date;
    rate_limit_per_minute: number;
    rate_limit_per_hour: number;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT * FROM projectnexus.team_api_keys
     WHERE key_hash = $1 AND is_active = true
     AND (expires_at IS NULL OR expires_at > NOW())`,
    [keyHash]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  // Update last_used_at
  await query(
    `UPDATE projectnexus.team_api_keys
     SET last_used_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [row.id]
  );

  return {
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    scopes: row.scopes as ApiKeyScope[],
    isActive: row.is_active,
    lastUsedAt: row.last_used_at || undefined,
    expiresAt: row.expires_at || undefined,
    rateLimitPerMinute: row.rate_limit_per_minute,
    rateLimitPerHour: row.rate_limit_per_hour,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Check if an API key has a specific scope
 */
export function hasScope(apiKey: ApiKey, requiredScope: ApiKeyScope): boolean {
  // Admin has all scopes
  if (apiKey.scopes.includes('admin')) {
    return true;
  }

  return apiKey.scopes.includes(requiredScope);
}

/**
 * List API keys for a team
 */
export async function listApiKeys(teamSlug: string): Promise<ApiKey[]> {
  const { rows } = await query<{
    id: string;
    team_slug: string;
    user_id: string;
    name: string;
    key_prefix: string;
    key_hash: string;
    scopes: string[];
    is_active: boolean;
    last_used_at: Date;
    expires_at: Date;
    rate_limit_per_minute: number;
    rate_limit_per_hour: number;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT * FROM projectnexus.team_api_keys
     WHERE team_slug = $1
     ORDER BY created_at DESC`,
    [teamSlug]
  );

  return rows.map(row => ({
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    scopes: row.scopes as ApiKeyScope[],
    isActive: row.is_active,
    lastUsedAt: row.last_used_at || undefined,
    expiresAt: row.expires_at || undefined,
    rateLimitPerMinute: row.rate_limit_per_minute,
    rateLimitPerHour: row.rate_limit_per_hour,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeApiKey(keyId: string, teamSlug: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE projectnexus.team_api_keys
     SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND team_slug = $2`,
    [keyId, teamSlug]
  );

  return (rowCount ?? 0) > 0;
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(keyId: string, teamSlug: string): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM projectnexus.team_api_keys
     WHERE id = $1 AND team_slug = $2`,
    [keyId, teamSlug]
  );

  return (rowCount ?? 0) > 0;
}

/**
 * Log API key usage
 */
export async function logApiKeyUsage(params: {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  userEmail?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await query(
    `INSERT INTO projectnexus.team_api_key_usage (
      id, api_key_id, endpoint, method, status_code,
      response_time_ms, request_size_bytes, response_size_bytes,
      user_email, metadata, created_at
    )
    VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
    )`,
    [
      params.apiKeyId,
      params.endpoint,
      params.method,
      params.statusCode,
      params.responseTimeMs || null,
      params.requestSizeBytes || null,
      params.responseSizeBytes || null,
      params.userEmail || null,
      params.metadata || {},
    ]
  );
}

/**
 * Get usage stats for an API key
 */
export async function getApiKeyUsageStats(
  apiKeyId: string,
  timeRange: 'day' | 'week' | 'month' | 'all' = 'month'
): Promise<{
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  avgResponseTimeMs: number;
  totalBytesIn: number;
  totalBytesOut: number;
}> {
  let timeFilter = '';
  if (timeRange === 'day') {
    timeFilter = `AND created_at >= NOW() - INTERVAL '1 day'`;
  } else if (timeRange === 'week') {
    timeFilter = `AND created_at >= NOW() - INTERVAL '7 days'`;
  } else if (timeRange === 'month') {
    timeFilter = `AND created_at >= NOW() - INTERVAL '30 days'`;
  }

  const { rows } = await query<{
    total: number;
    success: number;
    errors: number;
    avg_response_time: number;
    total_in: number;
    total_out: number;
  }>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status_code < 400) as success,
      COUNT(*) FILTER (WHERE status_code >= 400) as errors,
      COALESCE(AVG(response_time_ms), 0) as avg_response_time,
      COALESCE(SUM(request_size_bytes), 0) as total_in,
      COALESCE(SUM(response_size_bytes), 0) as total_out
    FROM projectnexus.team_api_key_usage
    WHERE api_key_id = $1 ${timeFilter}`,
    [apiKeyId]
  );

  const row = rows[0];
  return {
    totalRequests: row.total,
    successRequests: row.success,
    errorRequests: row.errors,
    avgResponseTimeMs: Math.round(row.avg_response_time || 0),
    totalBytesIn: row.total_in,
    totalBytesOut: row.total_out,
  };
}
