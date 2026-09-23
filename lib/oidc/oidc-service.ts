/**
 * OIDC Service - Business Logic for OIDC Authentication
 *
 * This module handles the business logic for OIDC authentication:
 * - Configuration management
 * - Session management (state/nonce storage)
 * - User identity linking
 * - Audit logging
 */

import { query } from '@/lib/db';
import * as crypto from 'crypto';
import type {
  OIDCConfiguration,
  OIDCSession,
  OIDCAuditLog,
  UserIdentity,
  SAMLToOIDCMigration,
  OIDCConfigInput,
} from './oidc-types';

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Load OIDC configuration for a team
 */
export async function getOIDCConfig(teamSlug: string): Promise<OIDCConfiguration | null> {
  const result = await query(
    `SELECT
      id,
      team_slug as "teamSlug",
      enabled,
      issuer,
      client_id as "clientId",
      client_secret as "clientSecret",
      scope,
      authorization_endpoint as "authorizationEndpoint",
      token_endpoint as "tokenEndpoint",
      userinfo_endpoint as "userInfoEndpoint",
      jwks_uri as "jwksUri",
      end_session_endpoint as "endSessionEndpoint",
      pkce,
      token_signing_alg as "tokenSigningAlg",
      claims_mapping as "claimsMapping",
      last_used_at as "lastUsedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM projectnexus.oidc_configurations
    WHERE team_slug = $1`,
    [teamSlug]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    ...row,
    scope: row.scope || ['openid', 'email', 'profile'],
    claimsMapping: row.claimsMapping || {
      email: 'email',
      name: 'name',
    },
  };
}

/**
 * Save or update OIDC configuration
 */
export async function saveOIDCConfig(
  teamSlug: string,
  input: OIDCConfigInput
): Promise<OIDCConfiguration> {
  const {
    enabled,
    issuer,
    clientId,
    clientSecret,
    scope = ['openid', 'email', 'profile'],
    claimsMapping,
  } = input;

  // Fetch discovery document to get endpoints
  const discoveryUrl = issuer.endsWith('/.well-known/openid-configuration')
    ? issuer
    : `${issuer}/.well-known/openid-configuration`;

  let endpoints: Record<string, string> = {};
  try {
    const response = await fetch(discoveryUrl);
    if (response.ok) {
      endpoints = await response.json();
    }
  } catch {
    // Discovery failed, will use manual configuration
  }

  const result = await query(
    `INSERT INTO projectnexus.oidc_configurations (
      team_slug,
      enabled,
      issuer,
      client_id,
      client_secret,
      scope,
      authorization_endpoint,
      token_endpoint,
      userinfo_endpoint,
      jwks_uri,
      end_session_endpoint,
      claims_mapping
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (team_slug) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      issuer = EXCLUDED.issuer,
      client_id = EXCLUDED.client_id,
      client_secret = EXCLUDED.client_secret,
      scope = EXCLUDED.scope,
      authorization_endpoint = EXCLUDED.authorization_endpoint,
      token_endpoint = EXCLUDED.token_endpoint,
      userinfo_endpoint = EXCLUDED.userinfo_endpoint,
      jwks_uri = EXCLUDED.jwks_uri,
      end_session_endpoint = EXCLUDED.end_session_endpoint,
      claims_mapping = EXCLUDED.claims_mapping,
      updated_at = NOW()
    RETURNING
      id,
      team_slug as "teamSlug",
      enabled,
      issuer,
      client_id as "clientId",
      client_secret as "clientSecret",
      scope,
      authorization_endpoint as "authorizationEndpoint",
      token_endpoint as "tokenEndpoint",
      userinfo_endpoint as "userInfoEndpoint",
      jwks_uri as "jwksUri",
      end_session_endpoint as "endSessionEndpoint",
      pkce,
      token_signing_alg as "tokenSigningAlg",
      claims_mapping as "claimsMapping",
      last_used_at as "lastUsedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"`,
    [
      teamSlug,
      enabled,
      issuer,
      clientId,
      clientSecret,
      scope,
      endpoints.authorization_endpoint,
      endpoints.token_endpoint,
      endpoints.userinfo_endpoint,
      endpoints.jwks_uri,
      endpoints.end_session_endpoint,
      JSON.stringify(claimsMapping || { email: 'email', name: 'name' }),
    ]
  );

  return result.rows[0] as OIDCConfiguration;
}

/**
 * Delete OIDC configuration
 */
export async function deleteOIDCConfig(teamSlug: string): Promise<void> {
  await query(
    `DELETE FROM projectnexus.oidc_configurations WHERE team_slug = $1`,
    [teamSlug]
  );
}

/**
 * Update last used timestamp
 */
export async function updateLastUsed(teamSlug: string): Promise<void> {
  await query(
    `UPDATE projectnexus.oidc_configurations
     SET last_used_at = NOW(), updated_at = NOW()
     WHERE team_slug = $1`,
    [teamSlug]
  );
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create OIDC session with state/nonce
 */
export async function createOIDCSession(
  teamSlug: string,
  returnUrl: string,
  context?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<OIDCSession> {
  const state = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(32).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');

  const result = await query(
    `INSERT INTO projectnexus.oidc_sessions (
      team_slug,
      state,
      nonce,
      code_verifier,
      code_challenge_method,
      return_url,
      ip_address,
      user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      team_slug as "teamSlug",
      state,
      nonce,
      code_verifier as "codeVerifier",
      code_challenge_method as "codeChallengeMethod",
      return_url as "returnUrl",
      max_age as "maxAge",
      ip_address as "ipAddress",
      user_agent as "userAgent",
      consumed,
      consumed_at as "consumedAt",
      created_at as "createdAt",
      expires_at as "expiresAt"`,
    [
      teamSlug,
      state,
      nonce,
      codeVerifier,
      'S256',
      returnUrl,
      context?.ipAddress,
      context?.userAgent,
    ]
  );

  return result.rows[0] as OIDCSession;
}

/**
 * Consume OIDC session (validate and mark as used)
 */
export async function consumeOIDCSession(
  state: string
): Promise<OIDCSession | null> {
  const result = await query(
    `UPDATE projectnexus.oidc_sessions
     SET consumed = true, consumed_at = NOW()
     WHERE state = $1
       AND consumed = false
       AND expires_at > NOW()
    RETURNING
      id,
      team_slug as "teamSlug",
      state,
      nonce,
      code_verifier as "codeVerifier",
      code_challenge_method as "codeChallengeMethod",
      return_url as "returnUrl",
      max_age as "maxAge",
      ip_address as "ipAddress",
      user_agent as "userAgent",
      consumed,
      consumed_at as "consumedAt",
      created_at as "createdAt",
      expires_at as "expiresAt"`,
    [state]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as OIDCSession;
}

/**
 * Clean up expired sessions (call periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query(
    `DELETE FROM projectnexus.oidc_sessions
     WHERE expires_at < NOW() OR (consumed = true AND consumed_at < NOW() - INTERVAL '1 hour')`
  );

  return result.rowCount || 0;
}

// ============================================================================
// USER IDENTITY MANAGEMENT
// ============================================================================

/**
 * Find existing user identity by email or IdP ID
 */
export async function findUserIdentity(
  teamSlug: string,
  email?: string,
  idpId?: string,
  idpType?: 'saml' | 'oidc'
): Promise<UserIdentity | null> {
  if (!email && !idpId) {
    return null;
  }

  let queryText = `
    SELECT
      id,
      user_id as "userId",
      team_slug as "teamSlug",
      idp_type as "idpType",
      idp_id as "idpId",
      idp_issuer as "idpIssuer",
      email,
      display_name as "displayName",
      first_name as "firstName",
      last_name as "lastName",
      attributes,
      last_authenticated_at as "lastAuthenticatedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM projectnexus.user_identities
    WHERE team_slug = $1
  `;
  const params: unknown[] = [teamSlug];

  if (idpId && idpType) {
    queryText += ` AND idp_type = $2 AND idp_id = $3`;
    params.push(idpType, idpId);
  } else if (email) {
    queryText += ` AND email = $2`;
    params.push(email);
  }

  const result = await query(queryText, params);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as UserIdentity;
}

/**
 * Link external identity to user
 */
export async function linkUserIdentity(
  userId: string,
  teamSlug: string,
  idpType: 'saml' | 'oidc',
  idpId: string,
  idpIssuer: string,
  profile: {
    email: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    attributes?: Record<string, unknown>;
  }
): Promise<UserIdentity> {
  const result = await query(
    `INSERT INTO projectnexus.user_identities (
      user_id,
      team_slug,
      idp_type,
      idp_id,
      idp_issuer,
      email,
      display_name,
      first_name,
      last_name,
      attributes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (team_slug, idp_type, idp_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      attributes = EXCLUDED.attributes,
      last_authenticated_at = NOW(),
      updated_at = NOW()
    RETURNING
      id,
      user_id as "userId",
      team_slug as "teamSlug",
      idp_type as "idpType",
      idp_id as "idpId",
      idp_issuer as "idpIssuer",
      email,
      display_name as "displayName",
      first_name as "firstName",
      last_name as "lastName",
      attributes,
      last_authenticated_at as "lastAuthenticatedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"`,
    [
      userId,
      teamSlug,
      idpType,
      idpId,
      idpIssuer,
      profile.email,
      profile.displayName,
      profile.firstName,
      profile.lastName,
      JSON.stringify(profile.attributes || {}),
    ]
  );

  return result.rows[0] as UserIdentity;
}

/**
 * Update last authenticated timestamp
 */
export async function updateIdentityLastAuthenticated(identityId: string): Promise<void> {
  await query(
    `UPDATE projectnexus.user_identities
     SET last_authenticated_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [identityId]
  );
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log OIDC audit event
 */
export async function logOIDCEvent(
  teamSlug: string,
  eventType: OIDCAuditLog['eventType'],
  status: OIDCAuditLog['status'],
  data: {
    idpIssuer: string;
    userId?: string;
    email?: string;
    identityId?: string;
    oidcSessionId?: string;
    errorCode?: string;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await query(
    `INSERT INTO projectnexus.oidc_audit_logs (
      team_slug,
      event_type,
      status,
      user_id,
      email,
      identity_id,
      oidc_session_id,
      idp_issuer,
      error_code,
      error_message,
      ip_address,
      user_agent,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      teamSlug,
      eventType,
      status,
      data.userId,
      data.email,
      data.identityId,
      data.oidcSessionId,
      data.idpIssuer,
      data.errorCode,
      data.errorMessage,
      data.ipAddress,
      data.userAgent,
      JSON.stringify(data.metadata || {}),
    ]
  );
}

/**
 * Get recent audit logs for a team
 */
export async function getOIDCAuditLogs(
  teamSlug: string,
  limit: number = 50
): Promise<OIDCAuditLog[]> {
  const result = await query(
    `SELECT
      id,
      team_slug as "teamSlug",
      event_type as "eventType",
      status,
      user_id as "userId",
      email,
      identity_id as "identityId",
      oidc_session_id as "oidcSessionId",
      idp_issuer as "idpIssuer",
      error_code as "errorCode",
      error_message as "errorMessage",
      ip_address as "ipAddress",
      user_agent as "userAgent",
      metadata,
      created_at as "createdAt"
    FROM projectnexus.oidc_audit_logs
    WHERE team_slug = $1
    ORDER BY created_at DESC
    LIMIT $2`,
    [teamSlug, limit]
  );

  return result.rows as OIDCAuditLog[];
}

// ============================================================================
// MIGRATION MANAGEMENT
// ============================================================================

/**
 * Get migration status for a team
 */
export async function getMigrationStatus(teamSlug: string): Promise<SAMLToOIDCMigration | null> {
  const result = await query(
    `SELECT
      id,
      team_slug as "teamSlug",
      status,
      migration_mode as "migrationMode",
      canary_percentage as "canaryPercentage",
      canary_user_emails as "canaryUserEmails",
      rollback_to_saml as "rollbackToSaml",
      rollback_reason as "rollbackReason",
      rolled_back_at as "rolledBackAt",
      started_at as "startedAt",
      completed_at as "completedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM projectnexus.saml_to_oidc_migrations
    WHERE team_slug = $1`,
    [teamSlug]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as SAMLToOIDCMigration;
}

/**
 * Create or update migration record
 */
export async function setMigrationStatus(
  teamSlug: string,
  data: {
    status?: SAMLToOIDCMigration['status'];
    migrationMode?: SAMLToOIDCMigration['migrationMode'];
    canaryPercentage?: number;
    canaryUserEmails?: string[];
    rollbackToSaml?: boolean;
    rollbackReason?: string;
  }
): Promise<SAMLToOIDCMigration> {
  const result = await query(
    `INSERT INTO projectnexus.saml_to_oidc_migrations (
      team_slug,
      status,
      migration_mode,
      canary_percentage,
      canary_user_emails,
      rollback_to_saml,
      rollback_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (team_slug) DO UPDATE SET
      status = COALESCE(EXCLUDED.status, saml_to_oidc_migrations.status),
      migration_mode = COALESCE(EXCLUDED.migration_mode, saml_to_oidc_migrations.migration_mode),
      canary_percentage = COALESCE(EXCLUDED.canary_percentage, saml_to_oidc_migrations.canary_percentage),
      canary_user_emails = COALESCE(EXCLUDED.canary_user_emails, saml_to_oidc_migrations.canary_user_emails),
      rollback_to_saml = COALESCE(EXCLUDED.rollback_to_saml, saml_to_oidc_migrations.rollback_to_saml),
      rollback_reason = EXCLUDED.rollback_reason,
      updated_at = NOW()
    RETURNING
      id,
      team_slug as "teamSlug",
      status,
      migration_mode as "migrationMode",
      canary_percentage as "canaryPercentage",
      canary_user_emails as "canaryUserEmails",
      rollback_to_saml as "rollbackToSaml",
      rollback_reason as "rollbackReason",
      rolled_back_at as "rolledBackAt",
      started_at as "startedAt",
      completed_at as "completedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"`,
    [
      teamSlug,
      data.status || 'pending',
      data.migrationMode || 'off',
      data.canaryPercentage ?? 0,
      data.canaryUserEmails || [],
      data.rollbackToSaml || false,
      data.rollbackReason,
    ]
  );

  return result.rows[0] as SAMLToOIDCMigration;
}
