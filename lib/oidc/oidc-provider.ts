/**
 * OIDC (OpenID Connect) Provider Implementation
 *
 * This module implements the core OIDC functionality using openid-client v6.
 * Handles discovery, authorization URL generation, token exchange, and ID token validation.
 *
 * @see https://github.com/panva/openid-client
 */

import * as client from 'openid-client';
import type {
  OIDCConfiguration,
  OIDCTokenResponse,
  OIDCClaims,
  OIDCUserProfile,
} from './oidc-types';
import { OIDCErrorCode } from './oidc-types';

export { OIDCErrorCode } from './oidc-types';

export class OIDCError extends Error {
  constructor(
    public code: OIDCErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OIDCError';
  }
}

// ============================================================================
// DISCOVERY
// ============================================================================

/**
 * Discover OIDC configuration from issuer URL
 * Uses openid-client v6 discovery API
 */
export async function discoverOIDCConfiguration(
  issuer: string,
  clientId: string,
  clientSecret: string
): Promise<client.Configuration> {
  try {
    // openid-client v6 uses client.discovery() which returns a Configuration object
    const config = await client.discovery(
      new URL(issuer),
      clientId,
      clientSecret
    );

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new OIDCError(
        OIDCErrorCode.INVALID_ISSUER,
        `Failed to discover OIDC configuration from ${issuer}: ${error.message}`,
        { issuer, originalError: error.message }
      );
    }
    throw new OIDCError(
      OIDCErrorCode.INVALID_ISSUER,
      `Failed to discover OIDC configuration from ${issuer}`,
      { issuer }
    );
  }
}

// ============================================================================
// AUTHORIZATION URL GENERATION
// ============================================================================

/**
 * Generate PKCE code verifier and challenge
 * Uses SHA-256 (S256) method as required
 */
export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}> {
  const codeVerifier = client.randomPKCECodeVerifier();

  return {
    codeVerifier,
    codeChallenge: await client.calculatePKCECodeChallenge(codeVerifier),
    codeChallengeMethod: 'S256',
  };
}

/**
 * Generate random state parameter
 */
export function generateState(): string {
  return client.randomState();
}

/**
 * Generate random nonce
 */
export function generateNonce(): string {
  return client.randomState();
}

/**
 * Generate authorization URL with PKCE
 */
export async function generateAuthorizationUrl(
  config: OIDCConfiguration,
  redirectUri: string,
  options?: {
    state?: string;
    nonce?: string;
    codeVerifier?: string;
    prompt?: 'none' | 'login' | 'consent' | 'select_account';
    maxAge?: number;
  }
): Promise<{ authorizationUrl: string; state: string; nonce: string; codeVerifier: string }> {
  try {
    // Discover configuration
    const oidcConfig = await discoverOIDCConfiguration(
      config.issuer,
      config.clientId,
      config.clientSecret
    );

    // Generate security parameters if not provided
    const state = options?.state || generateState();
    const nonce = options?.nonce || generateNonce();
    const pkce = options?.codeVerifier
      ? {
          codeVerifier: options.codeVerifier,
          codeChallenge: await client.calculatePKCECodeChallenge(options.codeVerifier),
          codeChallengeMethod: 'S256' as const,
        }
      : await generatePKCE();

    // Build authorization parameters
    const parameters: Record<string, string> = {
      redirect_uri: redirectUri,
      scope: config.scope.join(' '),
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod,
      state,
      nonce,
    };

    if (options?.prompt) {
      parameters.prompt = options.prompt;
    }

    if (options?.maxAge !== undefined) {
      parameters.max_age = String(options.maxAge);
    }

    // Generate authorization URL using openid-client v6 API
    const authorizationUrl = client.buildAuthorizationUrl(oidcConfig, parameters);

    return {
      authorizationUrl: authorizationUrl.href,
      state,
      nonce,
      codeVerifier: pkce.codeVerifier,
    };
  } catch (error) {
    if (error instanceof OIDCError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new OIDCError(
        OIDCErrorCode.PROVIDER_UNAVAILABLE,
        `Failed to generate authorization URL: ${error.message}`,
        { originalError: error.message }
      );
    }
    throw new OIDCError(OIDCErrorCode.PROVIDER_UNAVAILABLE, 'Failed to generate authorization URL');
  }
}

// ============================================================================
// TOKEN EXCHANGE
// ============================================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  config: OIDCConfiguration,
  code: string,
  redirectUri: string,
  codeVerifier: string,
  state?: string
): Promise<OIDCTokenResponse> {
  try {
    const oidcConfig = await discoverOIDCConfiguration(
      config.issuer,
      config.clientId,
      config.clientSecret
    );

    // Build current callback URL
    const currentUrl = new URL(redirectUri);
    currentUrl.searchParams.set('code', code);
    if (state) {
      currentUrl.searchParams.set('state', state);
    }

    // Exchange code for tokens using openid-client v6 API
    const tokens = await client.authorizationCodeGrant(
      oidcConfig,
      currentUrl,
      {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
      }
    );

    // Validate that id_token exists (OIDC requires it)
    if (!tokens.id_token) {
      throw new OIDCError(
        OIDCErrorCode.INVALID_ID_TOKEN,
        'ID token not returned from authorization server'
      );
    }

    return {
      access_token: tokens.access_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token,
      scope: tokens.scope,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new OIDCError(
        OIDCErrorCode.TOKEN_EXCHANGE_FAILED,
        `Failed to exchange authorization code: ${error.message}`,
        { originalError: error.message }
      );
    }
    throw new OIDCError(OIDCErrorCode.TOKEN_EXCHANGE_FAILED, 'Failed to exchange authorization code');
  }
}

// ============================================================================
// ID TOKEN VALIDATION
// ============================================================================

/**
 * Validate ID token claims
 * Note: openid-client v6 handles signature verification automatically during token exchange
 */
export function validateIdToken(
  idToken: string,
  config: OIDCConfiguration,
  expectedNonce?: string
): OIDCClaims {
  try {
    // Split JWT into parts
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new OIDCError(OIDCErrorCode.INVALID_ID_TOKEN, 'ID token must have 3 parts');
    }

    // Decode payload (signature already verified by openid-client)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));

    const claims: OIDCClaims = {
      iss: payload.iss,
      sub: payload.sub,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
      nonce: payload.nonce,
      email: payload.email,
      email_verified: payload.email_verified,
      name: payload.name,
      given_name: payload.given_name,
      family_name: payload.family_name,
    };

    // Validate issuer
    if (claims.iss !== config.issuer && !claims.iss.startsWith(config.issuer.replace(/\/$/, ''))) {
      throw new OIDCError(
        OIDCErrorCode.ID_TOKEN_VALIDATION_FAILED,
        `Invalid issuer: expected ${config.issuer}, got ${claims.iss}`,
        { claim: 'iss', received: claims.iss, expected: config.issuer }
      );
    }

    // Validate audience
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(config.clientId)) {
      throw new OIDCError(
        OIDCErrorCode.ID_TOKEN_VALIDATION_FAILED,
        `Invalid audience: client_id ${config.clientId} not in ${audiences.join(', ')}`,
        { claim: 'aud', received: claims.aud, expected: config.clientId }
      );
    }

    // Validate expiration
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp < now) {
      throw new OIDCError(
        OIDCErrorCode.EXPIRED_ID_TOKEN,
        `ID token expired at ${claims.exp}, current time is ${now}`,
        { claim: 'exp', exp: claims.exp, now }
      );
    }

    // Validate nonce if provided
    if (expectedNonce && claims.nonce !== expectedNonce) {
      throw new OIDCError(
        OIDCErrorCode.INVALID_NONCE,
        `Invalid nonce: expected ${expectedNonce}, got ${claims.nonce}`,
        { claim: 'nonce', received: claims.nonce, expected: expectedNonce }
      );
    }

    return claims;
  } catch (error) {
    if (error instanceof OIDCError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new OIDCError(
        OIDCErrorCode.INVALID_ID_TOKEN,
        `Failed to validate ID token: ${error.message}`,
        { originalError: error.message }
      );
    }
    throw new OIDCError(OIDCErrorCode.INVALID_ID_TOKEN, 'Failed to validate ID token');
  }
}

// ============================================================================
// USER INFO
// ============================================================================

/**
 * Fetch user info from userinfo endpoint
 */
export async function getUserInfo(
  config: OIDCConfiguration,
  accessToken: string
): Promise<OIDCUserProfile> {
  try {
    // Fetch user info using native fetch API
    const userInfoEndpoint = config.userInfoEndpoint;
    if (!userInfoEndpoint) {
      throw new OIDCError(
        OIDCErrorCode.NETWORK_ERROR,
        'UserInfo endpoint not configured'
      );
    }

    const response = await fetch(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const userInfo = await response.json();

    return {
      id: userInfo.sub,
      email: userInfo.email || '',
      emailVerified: userInfo.email_verified || false,
      displayName: userInfo.name,
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
      attributes: userInfo,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new OIDCError(
        OIDCErrorCode.NETWORK_ERROR,
        `Failed to fetch user info: ${error.message}`,
        { originalError: error.message }
      );
    }
    throw new OIDCError(OIDCErrorCode.NETWORK_ERROR, 'Failed to fetch user info');
  }
}

// ============================================================================
// PROFILE CONSTRUCTION
// ============================================================================

/**
 * Construct user profile from ID token claims and optional userinfo
 */
export function constructUserProfile(
  idTokenClaims: OIDCClaims,
  userInfo?: OIDCUserProfile
): OIDCUserProfile {
  // Start with ID token claims
  const profile: OIDCUserProfile = {
    id: idTokenClaims.sub,
    email: idTokenClaims.email || userInfo?.email || '',
    emailVerified: idTokenClaims.email_verified || userInfo?.emailVerified || false,
    displayName: idTokenClaims.name || userInfo?.displayName,
    firstName: idTokenClaims.given_name || userInfo?.firstName,
    lastName: idTokenClaims.family_name || userInfo?.lastName,
    attributes: {
      ...idTokenClaims,
      ...userInfo?.attributes,
    },
  };

  return profile;
}

// ============================================================================
// END SESSION (LOGOUT)
// ============================================================================

/**
 * Generate end session URL for logout (if supported)
 * Note: openid-client v6 may not have built-in endSessionUrl support
 */
export async function generateEndSessionUrl(
  config: OIDCConfiguration,
  idTokenHint: string,
  postLogoutRedirectUri?: string
): Promise<string | null> {
  try {
    if (!config.endSessionEndpoint) {
      return null;
    }

    // Build end session URL manually
    const endSessionUrl = new URL(config.endSessionEndpoint);
    endSessionUrl.searchParams.set('id_token_hint', idTokenHint);
    if (postLogoutRedirectUri) {
      endSessionUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
    }

    return endSessionUrl.href;
  } catch (error) {
    // If end session fails, return null (logout is optional)
    return null;
  }
}
