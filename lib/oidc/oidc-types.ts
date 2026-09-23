/**
 * OIDC (OpenID Connect) Types for Enterprise Authentication
 *
 * This module contains all TypeScript interfaces and types for OIDC authentication flow.
 * OIDC is used as an alternative to SAML for enterprise SSO, with Authentik as the broker.
 */

/**
 * OIDC Configuration stored per team
 */
export interface OIDCConfiguration {
  id: string;
  teamSlug: string;
  enabled: boolean;

  // Authentik/OIDC Provider Configuration
  issuer: string; // e.g., https://ak.mokka-dev.de/application/o/nexary-enterprise/
  clientId: string;
  clientSecret: string; // Encrypted at rest
  scope: string[]; // Default: ['openid', 'email', 'profile']

  // Endpoints (from discovery or manual config)
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  jwksUri: string;
  endSessionEndpoint?: string;

  // Security
  pkce: boolean; // Always true for our implementation
  tokenSigningAlg: string; // Default: RS256

  // Mapping
  claimsMapping: {
    email: string; // Default: 'email'
    name: string; // Default: 'name'
    firstName?: string;
    lastName?: string;
  };

  // Metadata
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Identity - Links external IdP identities to Stack Auth users
 * Supports multiple IdPs per user (SAML, OIDC, etc.)
 */
export interface UserIdentity {
  id: string;
  userId: string; // Stack Auth user ID
  teamSlug: string;

  // Identity Provider
  idpType: 'saml' | 'oidc';
  idpId: string; // Unique identifier from IdP (e.g., NameID from SAML, 'sub' from OIDC)
  idpIssuer: string; // Issuer URL/entity ID

  // User Info
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  attributes: Record<string, unknown>; // Additional attributes from IdP

  // Metadata
  lastAuthenticatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OIDC Session - Stores state/nonce during OIDC flow
 * Created when initiating login, consumed when processing callback
 */
export interface OIDCSession {
  id: string;
  teamSlug: string;

  // Security Parameters
  state: string; // Random string for CSRF protection
  nonce: string; // Random string for ID token validation
  codeVerifier?: string; // PKCE verifier (stored, never sent to IdP)
  codeChallengeMethod?: string; // 'S256'

  // Flow Control
  returnUrl: string; // Where to redirect after successful auth
  maxAge: number; // Session max age in seconds (default: 600 = 10 min)

  // Context
  ipAddress?: string;
  userAgent?: string;

  // Status
  consumed: boolean; // True if callback was processed
  consumedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * OIDC Audit Log - Tracks all OIDC authentication attempts
 */
export interface OIDCAuditLog {
  id: string;
  teamSlug: string;

  // Event
  eventType: 'login_initiated' | 'login_success' | 'login_failed' | 'logout' | 'token_refresh';
  status: 'success' | 'failed' | 'denied';

  // User
  userId?: string; // Stack Auth user ID (after link)
  email?: string;
  identityId?: string; // user_identities.id

  // OIDC Specific
  oidcSessionId?: string;
  idpIssuer: string;
  errorCode?: string;
  errorMessage?: string;

  // Context
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;

  createdAt: Date;
}

/**
 * SAML to OIDC Migration Record
 */
export interface SAMLToOIDCMigration {
  id: string;
  teamSlug: string;

  // Migration Control
  status: 'pending' | 'in_progress' | 'completed' | 'rolled_back';
  migrationMode: 'off' | 'shadow' | 'canary' | 'full';

  // Canary Configuration
  canaryPercentage: number; // 0-100
  canaryUserEmails: string[]; // Specific emails for canary testing

  // Rollback
  rollbackToSaml: boolean;
  rollbackReason?: string;
  rolledBackAt: Date | null;

  // Timestamps
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team SSO Configuration (extension to teams table)
 */
export interface TeamSSOConfig {
  ssoType: 'none' | 'saml' | 'oidc' | 'both';
  enterpriseAuthEnabled: boolean;
}

/**
 * OIDC Claims from ID Token
 */
export interface OIDCClaims {
  iss: string; // Issuer
  sub: string; // Subject (user ID)
  aud: string | string[]; // Audience
  exp: number; // Expiration
  iat: number; // Issued At
  nonce?: string; // Nonce (for validation)

  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;

  [key: string]: unknown;
}

/**
 * OIDC User Profile (from ID token or userinfo endpoint)
 */
export interface OIDCUserProfile {
  id: string; // 'sub' claim
  email: string;
  emailVerified: boolean;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  attributes: Record<string, unknown>;
}

/**
 * OIDC Token Response
 */
export interface OIDCTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token: string;
  scope?: string;
}

/**
 * OIDC Authorization Request Parameters
 */
export interface OIDCAuthorizationParams {
  response_type: 'code';
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: 'S256';
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  max_age?: number;
  acr_values?: string;
}

/**
 * OIDC Callback Request Parameters
 */
export interface OIDCCallbackParams {
  code: string;
  state: string;
  error?: string;
  error_description?: string;
}

/**
 * Feature Flag Types
 */
export interface FeatureFlag {
  flag: string;
  enabled: boolean;
  teamSlug?: string; // If null, it's a global flag
  value?: string | number | boolean; // Optional typed value
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OIDC Configuration Form Input
 */
export interface OIDCConfigInput {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope?: string[];
  claimsMapping?: {
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * OIDC Error Codes
 */
export enum OIDCErrorCode {
  // State/Nonce Errors
  INVALID_STATE = 'INVALID_STATE',
  EXPIRED_STATE = 'EXPIRED_STATE',
  INVALID_NONCE = 'INVALID_NONCE',

  // Token Errors
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  INVALID_ID_TOKEN = 'INVALID_ID_TOKEN',
  ID_TOKEN_VALIDATION_FAILED = 'ID_TOKEN_VALIDATION_FAILED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  EXPIRED_ID_TOKEN = 'EXPIRED_ID_TOKEN',

  // Configuration Errors
  OIDC_NOT_CONFIGURED = 'OIDC_NOT_CONFIGURED',
  OIDC_DISABLED = 'OIDC_DISABLED',
  INVALID_ISSUER = 'INVALID_ISSUER',

  // User Errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  IDENTITY_LINK_FAILED = 'IDENTITY_LINK_FAILED',

  // Integration Errors
  STACK_AUTH_ERROR = 'STACK_AUTH_ERROR',
  TEAM_NOT_FOUND = 'TEAM_NOT_FOUND',

  // Network/Provider Errors
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * OIDC Error Response
 */
export interface OIDCErrorResponse {
  error: OIDCErrorCode;
  error_description: string;
  state?: string;
}

/**
 * Login Initiation Response
 */
export interface OIDCLoginInitResponse {
  authorizationUrl: string;
  state: string; // Return for debugging (not needed by client)
}

/**
 * Callback Success Response
 */
export interface OIDCCallbackSuccessResponse {
  success: true;
  user: {
    userId: string;
    email: string;
    displayName?: string;
  };
  redirectUrl: string;
}

/**
 * Migration Status Response
 */
export interface OIDCMigrationStatus {
  teamSlug: string;
  status: SAMLToOIDCMigration['status'];
  migrationMode: SAMLToOIDCMigration['migrationMode'];
  canaryPercentage: number;
  canaryUserEmails: string[];
  recommendedAction: 'use_saml' | 'use_oidc' | 'migrate' | 'rollback';
}
