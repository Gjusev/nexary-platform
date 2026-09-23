/**
 * Types for Unified Auth Router
 */

export type AuthMethod = 'none' | 'saml' | 'oidc';

export interface AuthDetermination {
  method: AuthMethod;
  reason: string;
  migrationMode?: 'off' | 'shadow' | 'canary' | 'full';
}

export interface AuthInitiationRequest {
  returnUrl?: string;
  email?: string;
}

export interface AuthInitiationResponse {
  method: AuthMethod;
  redirectUrl?: string; // For SAML
  authorizationUrl?: string; // For OIDC
  reason: string;
  migrationMode?: string;
}

export interface AuthStatusResponse {
  teamSlug: string;
  method: AuthMethod;
  reason: string;
  migrationMode?: string;
}
