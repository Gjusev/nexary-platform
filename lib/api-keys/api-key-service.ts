/**
 * API Key Service
 *
 * Manages API key lifecycle including creation, validation, revocation,
 * and usage tracking. API keys use SHA-256 hashing for secure storage.
 */

import crypto from 'crypto';
import { query } from '@/lib/db';
import type { ApiKeyScope } from '@/lib/permissions-config';
import { API_KEY_SCOPES } from '@/lib/permissions-config';

// =====================================================
// TYPES
// =====================================================

export interface ApiKey {
  id: string;
  teamSlug: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsed: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface ApiKeyCreateInput {
  teamSlug: string;
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresIn?: number; // Days until expiration, undefined = never expires
  createdBy: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  secretKey: string; // Only returned during creation
}

export interface ApiKeyUsageLog {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// =====================================================
// CONSTANTS
// =====================================================

// API Key format: nxk_<prefix>_<random>
// Prefix helps identify keys in logs without exposing them
const KEY_PREFIX_LENGTH = 8;
const KEY_RANDOM_LENGTH = 48; // Total key will be ~64 chars
const KEY_PREFIX = 'nxk';

// =====================================================
// API KEY GENERATION
// =====================================================

/**
 * Generate a secure random API key
 * @returns A new API key (only return this during creation)
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  // Generate random bytes
  const randomBytes = crypto.randomBytes(KEY_RANDOM_LENGTH);

  // Convert to base64 for URL-safe characters
  const randomPart = randomBytes.toString('base64')
    .replace(/\+/g, '') // Replace + with nothing for URL safety
    .replace(/\//g, '') // Replace / with nothing for URL safety
    .replace(/=/g, '')  // Remove padding
    .substring(0, KEY_RANDOM_LENGTH); // Ensure consistent length

  // Create prefix (first 8 chars for identification)
  const prefix = randomPart.substring(0, KEY_PREFIX_LENGTH);

  // Combine: nxk_<prefix>_<rest>
  const key = `${KEY_PREFIX}_${prefix}_${randomPart}`;

  // Create hash for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  return { key, prefix, hash };
}

/**
 * Hash an API key for comparison
 * @param key The API key to hash
 * @returns SHA-256 hash of the key
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Extract the prefix from an API key for logging
 * @param key The API key
 * @returns The key prefix or 'unknown' if invalid format
 */
export function extractApiKeyPrefix(key: string): string {
  const parts = key.split('_');
  if (parts.length >= 2) {
    return `${KEY_PREFIX}_${parts[1]}`;
  }
  return 'unknown';
}

// =====================================================
// API KEY CRUD OPERATIONS
// =====================================================

/**
 * Create a new API key
 * @param input API key creation parameters
 * @returns The created API key with the secret key (only time it's returned)
 */
export async function createApiKey(input: ApiKeyCreateInput): Promise<ApiKeyWithSecret> {
  const { key, prefix, hash } = generateApiKey();

  // Calculate expiration date if provided
  let expiresAt: Date | null = null;
  if (input.expiresIn) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresIn);
  }

  // Insert into database
  const result = await query(
    `INSERT INTO api_keys (team_slug, user_id, name, key_hash, key_prefix, scopes, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, created_at`,
    [
      input.teamSlug,
      input.userId,
      input.name.trim(),
      hash,
      prefix,
      input.scopes,
      expiresAt,
      input.createdBy,
    ]
  );

  return {
    id: result.rows[0].id,
    teamSlug: input.teamSlug,
    userId: input.userId,
    name: input.name.trim(),
    keyPrefix: prefix,
    scopes: input.scopes,
    lastUsed: null,
    expiresAt: expiresAt?.toISOString() || null,
    createdAt: result.rows[0].created_at,
    createdBy: input.createdBy,
    secretKey: key,
  };
}

/**
 * Validate an API key and return its details
 * @param key The API key to validate
 * @returns The API key details if valid, null otherwise
 */
export async function validateApiKey(key: string): Promise<ApiKey | null> {
  const hash = hashApiKey(key);

  const result = await query(
    `SELECT id, team_slug, user_id, name, key_prefix, scopes, last_used, expires_at, created_at, created_by
     FROM api_keys
     WHERE key_hash = $1
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [hash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Update last_used timestamp
  await query(
    `UPDATE api_keys SET last_used = NOW(), updated_at = NOW() WHERE id = $1`,
    [row.id]
  );

  return {
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    lastUsed: row.last_used,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/**
 * List API keys for a team
 * @param teamSlug The team slug
 * @param userId Optional user ID to filter by
 * @returns Array of API keys (without secrets)
 */
export async function listApiKeys(teamSlug: string, userId?: string): Promise<ApiKey[]> {
  const result = await query(
    `SELECT id, team_slug, user_id, name, key_prefix, scopes, last_used, expires_at, created_at, created_by
     FROM api_keys
     WHERE team_slug = $1
       AND ($2::text IS NULL OR user_id = $2)
     ORDER BY created_at DESC`,
    [teamSlug, userId || null]
  );

  return result.rows.map((row) => ({
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    lastUsed: row.last_used,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

/**
 * Get an API key by ID
 * @param keyId The API key ID
 * @param teamSlug The team slug (for authorization)
 * @returns The API key or null if not found
 */
export async function getApiKey(keyId: string, teamSlug: string): Promise<ApiKey | null> {
  const result = await query(
    `SELECT id, team_slug, user_id, name, key_prefix, scopes, last_used, expires_at, created_at, created_by
     FROM api_keys
     WHERE id = $1 AND team_slug = $2`,
    [keyId, teamSlug]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    teamSlug: row.team_slug,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    lastUsed: row.last_used,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/**
 * Revoke (delete) an API key
 * @param keyId The API key ID
 * @param teamSlug The team slug (for authorization)
 * @returns true if deleted, false otherwise
 */
export async function revokeApiKey(keyId: string, teamSlug: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM api_keys WHERE id = $1 AND team_slug = $2`,
    [keyId, teamSlug]
  );

  return (result.rowCount || 0) > 0;
}

/**
 * Update an API key's scopes
 * @param keyId The API key ID
 * @param teamSlug The team slug (for authorization)
 * @param scopes New scopes to assign
 * @returns true if updated, false otherwise
 */
export async function updateApiKeyScopes(
  keyId: string,
  teamSlug: string,
  scopes: ApiKeyScope[]
): Promise<boolean> {
  const result = await query(
    `UPDATE api_keys
     SET scopes = $1, updated_at = NOW()
     WHERE id = $2 AND team_slug = $3`,
    [scopes, keyId, teamSlug]
  );

  return (result.rowCount || 0) > 0;
}

// =====================================================
// USAGE LOGGING
// =====================================================

/**
 * Log an API key usage event
 * @param apiKeyId The API key ID
 * @param endpoint The endpoint accessed
 * @param method The HTTP method
 * @param statusCode The response status code
 * @param ipAddress Optional IP address
 * @param userAgent Optional user agent
 */
export async function logApiKeyUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await query(
    `INSERT INTO api_key_usage_logs (api_key_id, endpoint, method, status_code, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [apiKeyId, endpoint, method, statusCode, ipAddress || null, userAgent || null]
  );
}

/**
 * Get usage logs for an API key
 * @param keyId The API key ID
 * @param teamSlug The team slug (for authorization)
 * @param limit Maximum number of logs to return
 * @returns Array of usage logs
 */
export async function getApiKeyUsageLogs(
  keyId: string,
  teamSlug: string,
  limit: number = 100
): Promise<ApiKeyUsageLog[]> {
  const result = await query(
    `SELECT l.id, l.api_key_id, l.endpoint, l.method, l.status_code, l.ip_address, l.user_agent, l.created_at
     FROM api_key_usage_logs l
     JOIN api_keys k ON l.api_key_id = k.id
     WHERE l.api_key_id = $1 AND k.team_slug = $2
     ORDER BY l.created_at DESC
     LIMIT $3`,
    [keyId, teamSlug, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    apiKeyId: row.api_key_id,
    endpoint: row.endpoint,
    method: row.method,
    statusCode: row.status_code,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}

// =====================================================
// SCOPE VALIDATION
// =====================================================

/**
 * Check if an API key has a specific scope
 * @param apiKey The API key
 * @param requiredScope The scope to check for
 * @returns true if the key has the scope
 */
export function hasScope(apiKey: ApiKey, requiredScope: ApiKeyScope): boolean {
  // admin:all grants all permissions
  if (apiKey.scopes.includes(API_KEY_SCOPES.ADMIN_ALL)) {
    return true;
  }

  return apiKey.scopes.includes(requiredScope);
}

/**
 * Check if an API key has any of the specified scopes
 * @param apiKey The API key
 * @param requiredScopes Array of scopes to check (OR logic)
 * @returns true if the key has any of the scopes
 */
export function hasAnyScope(apiKey: ApiKey, requiredScopes: ApiKeyScope[]): boolean {
  // admin:all grants all permissions
  if (apiKey.scopes.includes(API_KEY_SCOPES.ADMIN_ALL)) {
    return true;
  }

  return requiredScopes.some((scope) => apiKey.scopes.includes(scope));
}

/**
 * Check if an API key has all of the specified scopes
 * @param apiKey The API key
 * @param requiredScopes Array of scopes to check (AND logic)
 * @returns true if the key has all of the scopes
 */
export function hasAllScopes(apiKey: ApiKey, requiredScopes: ApiKeyScope[]): boolean {
  // admin:all grants all permissions
  if (apiKey.scopes.includes(API_KEY_SCOPES.ADMIN_ALL)) {
    return true;
  }

  return requiredScopes.every((scope) => apiKey.scopes.includes(scope));
}
