/**
 * SAML to OIDC Migration Tools
 *
 * This module provides utilities for migrating teams from SAML to OIDC:
 * - Validation and testing tools
 * - Migration orchestration
 * - Rollback support
 */

import { query } from '@/lib/db';
import type { SAMLToOIDCMigration, OIDCConfiguration } from '@/lib/oidc/oidc-types';
import {
  getMigrationStatus,
  setMigrationStatus,
  getOIDCConfig,
} from '@/lib/oidc/oidc-service';
import { setupAuthentikOIDCBroker, testAuthentikConnection } from './client';

// ============================================================================
// VALIDATION
// ============================================================================

export interface MigrationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  canProceed: boolean;
}

/**
 * Validate that a team is ready for OIDC migration
 */
export async function validateMigrationReadiness(
  teamSlug: string
): Promise<MigrationValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check 1: Team must exist
  const teamResult = await query(
    `SELECT slug, sso_type, enterprise_auth_enabled
     FROM projectnexus.teams
     WHERE slug = $1`,
    [teamSlug]
  );

  if (teamResult.rows.length === 0) {
    return {
      valid: false,
      errors: [`Team "${teamSlug}" does not exist`],
      warnings,
      canProceed: false,
    };
  }

  const team = teamResult.rows[0];

  // Check 2: Enterprise auth must be enabled
  if (!team.enterprise_auth_enabled) {
    errors.push('Enterprise authentication is not enabled for this team');
  }

  // Check 3: Must have SAML configured
  const samlResult = await query(
    `SELECT id, idp_entity_id, idp_sso_url, idp_x509_cert
     FROM projectnexus.saml_configurations
     WHERE team_slug = $1`,
    [teamSlug]
  );

  if (samlResult.rows.length === 0) {
    errors.push('SAML is not configured for this team');
  } else {
    const saml = samlResult.rows[0];

    // Validate SAML configuration
    if (!saml.idp_entity_id) {
      errors.push('SAML IdP Entity ID is not configured');
    }
    if (!saml.idp_sso_url) {
      errors.push('SAML IdP SSO URL is not configured');
    }
    if (!saml.idp_x509_cert) {
      errors.push('SAML IdP X.509 certificate is not configured');
    }
  }

  // Check 4: OIDC must be configured
  const oidcResult = await query(
    `SELECT id, enabled, issuer, client_id, client_secret
     FROM projectnexus.oidc_configurations
     WHERE team_slug = $1`,
    [teamSlug]
  );

  if (oidcResult.rows.length === 0) {
    errors.push('OIDC is not configured for this team');
  } else {
    const oidc = oidcResult.rows[0];

    if (!oidc.enabled) {
      errors.push('OIDC is configured but not enabled');
    }
    if (!oidc.issuer) {
      errors.push('OIDC issuer is not configured');
    }
    if (!oidc.client_id) {
      errors.push('OIDC client ID is not configured');
    }
    if (!oidc.client_secret) {
      errors.push('OIDC client secret is not configured');
    }
  }

  // Check 5: Test Authentik connection if configured
  const authentikConnection = await testAuthentikConnection();
  if (!authentikConnection) {
    warnings.push(
      'Cannot connect to Authentik API. Make sure AUTHENTIK_API_TOKEN is set.'
    );
  }

  // Check 6: No active migration in progress
  const currentMigration = await getMigrationStatus(teamSlug);
  if (currentMigration && currentMigration.status === 'in_progress') {
    errors.push('A migration is already in progress for this team');
  }

  const valid = errors.length === 0;
  const canProceed = valid && warnings.length === 0;

  return {
    valid,
    errors,
    warnings,
    canProceed,
  };
}

// ============================================================================
// MIGRATION ORCHESTRATION
// ============================================================================

/**
 * Start SAML to OIDC migration
 */
export async function startMigration(
  teamSlug: string,
  options: {
    mode: 'shadow' | 'canary' | 'full';
    canaryPercentage?: number;
    canaryUserEmails?: string[];
  }
): Promise<SAMLToOIDCMigration> {
  // Validate first
  const validation = await validateMigrationReadiness(teamSlug);
  if (!validation.valid) {
    throw new Error(
      `Cannot start migration:\n${validation.errors.join('\n')}`
    );
  }

  // Set migration status
  const migration = await setMigrationStatus(teamSlug, {
    status: 'in_progress',
    migrationMode: options.mode,
    canaryPercentage: options.canaryPercentage || 0,
    canaryUserEmails: options.canaryUserEmails || [],
  });

  // Update team sso_type
  await query(
    `UPDATE projectnexus.teams
     SET sso_type = 'both', updated_at = NOW()
     WHERE slug = $1`,
    [teamSlug]
  );

  // Update SAML migration_status
  await query(
    `UPDATE projectnexus.saml_configurations
     SET migration_status = 'migrating_to_oidc', updated_at = NOW()
     WHERE team_slug = $1`,
    [teamSlug]
  );

  return migration;
}

/**
 * Complete migration
 */
export async function completeMigration(teamSlug: string): Promise<void> {
  await setMigrationStatus(teamSlug, {
    status: 'completed',
    migrationMode: 'full',
  });

  // Update team to use OIDC
  await query(
    `UPDATE projectnexus.teams
     SET sso_type = 'oidc', updated_at = NOW()
     WHERE slug = $1`,
    [teamSlug]
  );

  // Update SAML migration status
  await query(
    `UPDATE projectnexus.saml_configurations
     SET migration_status = 'oidc_primary', updated_at = NOW()
     WHERE team_slug = $1`,
    [teamSlug]
  );
}

/**
 * Rollback migration to SAML
 */
export async function rollbackMigration(
  teamSlug: string,
  reason: string
): Promise<void> {
  await setMigrationStatus(teamSlug, {
    status: 'rolled_back',
    rollbackToSaml: true,
    rollbackReason: reason,
  });

  // Update team to use SAML
  await query(
    `UPDATE projectnexus.teams
     SET sso_type = 'saml', updated_at = NOW()
     WHERE slug = $1`,
    [teamSlug]
  );

  // Update SAML migration status
  await query(
    `UPDATE projectnexus.saml_configurations
     SET migration_status = 'stable', updated_at = NOW()
     WHERE team_slug = $1`,
    [teamSlug]
  );

  // Disable OIDC
  await query(
    `UPDATE projectnexus.oidc_configurations
     SET enabled = false, updated_at = NOW()
     WHERE team_slug = $1`,
    [teamSlug]
  );
}

/**
 * Update migration mode
 */
export async function updateMigrationMode(
  teamSlug: string,
  mode: 'off' | 'shadow' | 'canary' | 'full',
  options?: {
    canaryPercentage?: number;
    canaryUserEmails?: string[];
  }
): Promise<SAMLToOIDCMigration> {
  return setMigrationStatus(teamSlug, {
    migrationMode: mode,
    canaryPercentage: options?.canaryPercentage,
    canaryUserEmails: options?.canaryUserEmails,
  });
}

// ============================================================================
// TESTING
// ============================================================================

/**
 * Test OIDC configuration by attempting discovery
 */
export async function testOIDCConfiguration(
  teamSlug: string
): Promise<{ success: boolean; error?: string; endpoints?: Record<string, string> }> {
  try {
    const config = await getOIDCConfig(teamSlug);
    if (!config) {
      return {
        success: false,
        error: 'OIDC configuration not found',
      };
    }

    // Test discovery
    const discoveryUrl = config.issuer.endsWith('/.well-known/openid-configuration')
      ? config.issuer
      : `${config.issuer}/.well-known/openid-configuration`;

    const response = await fetch(discoveryUrl);
    if (!response.ok) {
      return {
        success: false,
        error: `Discovery failed: ${response.status} ${response.statusText}`,
      };
    }

    const endpoints = await response.json();

    return {
      success: true,
      endpoints: {
        issuer: endpoints.issuer,
        authorizationEndpoint: endpoints.authorization_endpoint,
        tokenEndpoint: endpoints.token_endpoint,
        userInfoEndpoint: endpoints.userinfo_endpoint,
        jwksUri: endpoints.jwks_uri,
        endSessionEndpoint: endpoints.end_session_endpoint,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get migration report
 */
export async function getMigrationReport(teamSlug: string): Promise<{
  teamSlug: string;
  validation: MigrationValidationResult;
  currentStatus: SAMLToOIDCMigration | null;
  oidcTest: { success: boolean; error?: string; endpoints?: Record<string, string> };
}> {
  const [validation, currentStatus, oidcTest] = await Promise.all([
    validateMigrationReadiness(teamSlug),
    getMigrationStatus(teamSlug),
    testOIDCConfiguration(teamSlug),
  ]);

  return {
    teamSlug,
    validation,
    currentStatus,
    oidcTest,
  };
}
