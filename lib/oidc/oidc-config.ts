/**
 * OIDC Configuration Module
 *
 * Central configuration for Authentik OIDC integration.
 * This module provides the Authentik configuration that acts as a broker
 * between Nexary and customer Identity Providers.
 */

/**
 * Authentik OIDC Configuration
 * These values are pre-configured for the Authentik instance at https://ak.mokka-dev.de
 */
export const AUTHENTIK_CONFIG = {
  // Authentik issuer URL
  issuer: process.env.AUTHENTIK_ISSUER || 'https://ak.mokka-dev.de/application/o/nexary-enterprise/',

  // OAuth2/OIDC client credentials
  clientId: process.env.AUTHENTIK_CLIENT_ID || 'GvhMzNkAnh9yQFanzCia3PF82MaiUs7FpMvzpH3Y',
  clientSecret: process.env.AUTHENTIK_CLIENT_SECRET || '',

  // Redirect URIs
  redirectUris: [
    process.env.AUTHENTIK_REDIRECT_URI || 'http://localhost:3000/api/oidc/callback',
    process.env.AUTHENTIK_REDIRECT_URI_PROD || 'https://nexus.mokka-dev.de/api/oidc/callback',
  ],

  // Scopes to request
  scopes: ['openid', 'email', 'profile'],

  // PKCE enabled by default
  pkce: true,

  // Response type
  responseType: 'code',

  // Prompt behavior
  prompt: 'login',
} as const;

/**
 * Validate that required Authentik environment variables are set
 */
export function validateAuthentikConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!process.env.AUTHENTIK_ISSUER) {
    missing.push('AUTHENTIK_ISSUER');
  }

  if (!process.env.AUTHENTIK_CLIENT_ID) {
    missing.push('AUTHENTIK_CLIENT_ID');
  }

  if (!process.env.AUTHENTIK_CLIENT_SECRET) {
    missing.push('AUTHENTIK_CLIENT_SECRET');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get the appropriate redirect URI based on environment
 */
export function getRedirectUri(): string {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && process.env.AUTHENTIK_REDIRECT_URI_PROD) {
    return process.env.AUTHENTIK_REDIRECT_URI_PROD;
  }

  return process.env.AUTHENTIK_REDIRECT_URI || 'http://localhost:3000/api/oidc/callback';
}

/**
 * Default claim mappings for OIDC
 * Maps OIDC claims to Nexary user attributes
 */
export const DEFAULT_CLAIM_MAPPINGS: Record<string, string> = {
  email: 'email',
  name: 'name',
  given_name: 'givenName',
  family_name: 'familyName',
  picture: 'picture',
  email_verified: 'emailVerified',
};

/**
 * OIDC session configuration
 */
export const OIDC_SESSION_CONFIG = {
  // Session expiration time (15 minutes)
  expiresIn: 15 * 60 * 1000, // 15 minutes in milliseconds

  // Cleanup interval (every hour)
  cleanupInterval: 60 * 60 * 1000, // 1 hour in milliseconds

  // Maximum sessions per team
  maxSessionsPerTeam: 100,
} as const;

/**
 * OIDC provider configuration templates
 * These are common configurations for popular IdPs
 */
export const OIDC_PROVIDER_TEMPLATES = {
  authentik: {
    name: 'Authentik',
    issuer: '{issuerUrl}/application/o/{applicationSlug}/',
    scopes: ['openid', 'email', 'profile'],
    responseType: 'code',
    pkce: true,
  },
  azure: {
    name: 'Azure AD',
    issuer: 'https://login.microsoftonline.com/{tenantId}/v2.0',
    scopes: ['openid', 'email', 'profile'],
    responseType: 'code',
    pkce: true,
  },
  google: {
    name: 'Google',
    issuer: 'https://accounts.google.com',
    scopes: ['openid', 'email', 'profile'],
    responseType: 'code',
    pkce: true,
  },
  okta: {
    name: 'Okta',
    issuer: '{oktaDomain}/.well-known/openid-configuration',
    scopes: ['openid', 'email', 'profile'],
    responseType: 'code',
    pkce: true,
  },
  keycloak: {
    name: 'Keycloak',
    issuer: '{keycloakUrl}/realms/{realm}',
    scopes: ['openid', 'email', 'profile'],
    responseType: 'code',
    pkce: true,
  },
} as const;

/**
 * Create a team-specific OIDC configuration
 * This combines Authentik as the broker with team-specific settings
 */
export function createTeamOIDCConfig(params: {
  teamSlug: string;
  issuerUrl?: string; // Override default issuer
  clientId?: string; // Override default client ID
  clientSecret?: string; // Override default client secret
  scopes?: string[];
  pkce?: boolean;
}) {
  return {
    teamSlug: params.teamSlug,
    issuerUrl: params.issuerUrl || AUTHENTIK_CONFIG.issuer,
    clientId: params.clientId || AUTHENTIK_CONFIG.clientId,
    clientSecret: params.clientSecret || AUTHENTIK_CONFIG.clientSecret,
    scopes: params.scopes || AUTHENTIK_CONFIG.scopes,
    responseType: AUTHENTIK_CONFIG.responseType,
    prompt: AUTHENTIK_CONFIG.prompt,
    pkce: params.pkce !== undefined ? params.pkce : AUTHENTIK_CONFIG.pkce,
    claimMappings: DEFAULT_CLAIM_MAPPINGS,
  };
}
