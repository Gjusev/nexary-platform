import { NextRequest, NextResponse } from 'next/server';
import { loadSAMLConfig, logSAMLAuthEvent } from './saml-provider';
import { SAMLProvider } from './saml-provider';

/**
 * SAML Middleware for Next.js
 * Handles SAML authentication flow and session management
 */

export interface SAMLSession {
  userId: string;
  email: string;
  teamSlug: string;
  nameID: string;
  sessionIndex: string;
  samlRequestId?: string;
  authenticatedAt: number;
}

const SAML_SESSION_COOKIE = 'saml_session';
const SAML_RELAY_STATE_COOKIE = 'saml_relay_state';
const SAML_REQUEST_ID_COOKIE = 'saml_request_id';

/**
 * Check if SAML is configured for a team
 */
export async function isSAMLConfigured(teamSlug: string): Promise<boolean> {
  const config = await loadSAMLConfig(teamSlug);
  return config !== null;
}

/**
 * Validate SAML relay state cookie to prevent CSRF attacks
 */
export function validateRelayState(
  req: NextRequest,
  expectedRelayState?: string
): boolean {
  const cookie = req.cookies.get(SAML_RELAY_STATE_COOKIE);
  if (!cookie) return false;

  const storedRelayState = cookie.value;

  // If expected relay state provided, verify it matches
  if (expectedRelayState && expectedRelayState !== storedRelayState) {
    return false;
  }

  return true;
}

/**
 * Store relay state in cookie for CSRF protection
 */
export function storeRelayState(res: NextResponse, relayState: string): NextResponse {
  res.cookies.set(SAML_RELAY_STATE_COOKIE, relayState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15, // 15 minutes
    path: '/',
  });
  return res;
}

/**
 * Clear relay state cookie
 */
export function clearRelayState(res: NextResponse): NextResponse {
  res.cookies.delete(SAML_RELAY_STATE_COOKIE);
  return res;
}

/**
 * Store SAML request ID for response validation
 */
export function storeRequestId(res: NextResponse, requestId: string): NextResponse {
  res.cookies.set(SAML_REQUEST_ID_COOKIE, requestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15, // 15 minutes
    path: '/',
  });
  return res;
}

/**
 * Get stored SAML request ID
 */
export function getRequestId(req: NextRequest): string | undefined {
  const cookie = req.cookies.get(SAML_REQUEST_ID_COOKIE);
  return cookie?.value;
}

/**
 * Clear request ID cookie
 */
export function clearRequestId(res: NextResponse): NextResponse {
  res.cookies.delete(SAML_REQUEST_ID_COOKIE);
  return res;
}

/**
 * Create SAML session after successful authentication
 */
export function createSAMLSession(res: NextResponse, session: SAMLSession): NextResponse {
  const sessionData = Buffer.from(JSON.stringify(session)).toString('base64');

  res.cookies.set(SAML_SESSION_COOKIE, sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return res;
}

/**
 * Get SAML session from request
 */
export function getSAMLSession(req: NextRequest): SAMLSession | null {
  const cookie = req.cookies.get(SAML_SESSION_COOKIE);
  if (!cookie) return null;

  try {
    const sessionData = Buffer.from(cookie.value, 'base64').toString('utf-8');
    const session = JSON.parse(sessionData) as SAMLSession;

    // Check if session is expired (7 days)
    const sessionAge = Date.now() - session.authenticatedAt;
    const maxAge = 60 * 60 * 24 * 7 * 1000; // 7 days in ms

    if (sessionAge > maxAge) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Clear SAML session
 */
export function clearSAMLSession(res: NextResponse): NextResponse {
  res.cookies.delete(SAML_SESSION_COOKIE);
  return res;
}

/**
 * Generate a secure relay state for SAML requests
 */
export function generateRelayState(teamSlug: string, returnUrl?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const data = JSON.stringify({
    teamSlug,
    returnUrl: returnUrl || '/dashboard',
    timestamp,
  });

  return Buffer.from(data).toString('base64');
}

/**
 * Parse relay state to extract team and return URL
 */
export function parseRelayState(relayState: string): {
  teamSlug: string;
  returnUrl: string;
  timestamp: number;
} | null {
  try {
    const data = Buffer.from(relayState, 'base64').toString('utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Extract client IP address from request
 */
export function getClientIP(req: NextRequest): string {
  // Check various headers for IP address
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');

  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, use the first one
    return forwardedFor.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to connection IP
  return 'unknown';
}

/**
 * Middleware to protect routes requiring SAML authentication
 */
export async function requireSAMLAuth(req: NextRequest, teamSlug: string): Promise<{
  authorized: boolean;
  session?: SAMLSession;
  error?: string;
}> {
  // Check if SAML is configured for this team
  const samlConfigured = await isSAMLConfigured(teamSlug);
  if (!samlConfigured) {
    return {
      authorized: false,
      error: 'SAML is not configured for this team',
    };
  }

  // Check if user has valid SAML session
  const session = getSAMLSession(req);
  if (!session) {
    return {
      authorized: false,
      error: 'No valid SAML session found',
    };
  }

  // Verify session matches the requested team
  if (session.teamSlug !== teamSlug) {
    return {
      authorized: false,
      error: 'Session team mismatch',
    };
  }

  return {
    authorized: true,
    session,
  };
}

/**
 * Initiate SAML SSO flow
 * Returns a URL to redirect the user to the IdP
 */
export async function initiateSAMLLogin(
  req: NextRequest,
  teamSlug: string,
  returnUrl?: string
): Promise<{
  success: boolean;
  redirectUrl?: string;
  error?: string;
}> {
  try {
    // Load SAML configuration
    const config = await loadSAMLConfig(teamSlug);
    if (!config) {
      return {
        success: false,
        error: 'SAML is not configured for this team',
      };
    }

    // Create SAML provider
    const provider = new SAMLProvider(config);

    // Generate relay state
    const relayState = generateRelayState(teamSlug, returnUrl);

    // Generate authorization URL (redirect to IdP)
    const authUrl = await provider.generateAuthorizeRequest(relayState);

    return {
      success: true,
      redirectUrl: authUrl,
    };
  } catch (error) {
    console.error('Error initiating SAML login:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate SAML login',
    };
  }
}

/**
 * Validate SAML response from IdP
 * Called after user authenticates at IdP and is redirected back
 */
export async function validateSAMLResponse(
  req: NextRequest,
  teamSlug: string,
  samlResponse: string,
  relayState?: string
): Promise<{
  success: boolean;
  profile?: Awaited<ReturnType<SAMLProvider['validateResponse']>>;
  error?: string;
}> {
  try {
    // Validate relay state if provided
    if (relayState && !validateRelayState(req, relayState)) {
      await logSAMLAuthEvent({
        teamSlug,
        status: 'denied',
        errorMessage: 'Invalid relay state (CSRF check failed)',
        ipAddress: getClientIP(req),
      });
      return {
        success: false,
        error: 'Invalid relay state',
      };
    }

    // Load SAML configuration
    const config = await loadSAMLConfig(teamSlug);
    if (!config) {
      return {
        success: false,
        error: 'SAML is not configured for this team',
      };
    }

    // Create SAML provider
    const provider = new SAMLProvider(config);

    // Validate SAML response
    const profile = await provider.validateResponse(samlResponse, relayState);

    // Log successful authentication
    await logSAMLAuthEvent({
      teamSlug,
      userId: profile.email, // Will be updated to actual user ID after linking
      samlResponseId: profile.assertionId,
      authnRequestId: getRequestId(req),
      status: 'success',
      ipAddress: getClientIP(req),
    });

    return {
      success: true,
      profile,
    };
  } catch (error) {
    console.error('Error validating SAML response:', error);

    // Log failed authentication
    await logSAMLAuthEvent({
      teamSlug,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      ipAddress: getClientIP(req),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate SAML response',
    };
  }
}

/**
 * Initiate SAML SLO (Single Logout)
 */
export async function initiateSAMLOut(
  req: NextRequest,
  teamSlug: string
): Promise<{
  success: boolean;
  redirectUrl?: string;
  error?: string;
}> {
  try {
    const session = getSAMLSession(req);
    if (!session) {
      return {
        success: false,
        error: 'No SAML session found',
      };
    }

    // Load SAML configuration
    const config = await loadSAMLConfig(teamSlug);
    if (!config) {
      return {
        success: false,
        error: 'SAML is not configured for this team',
      };
    }

    // Create SAML provider
    const provider = new SAMLProvider(config);

    // Generate logout URL
    const logoutUrl = await provider.generateLogoutRequest(
      session.nameID,
      session.sessionIndex
    );

    return {
      success: true,
      redirectUrl: logoutUrl,
    };
  } catch (error) {
    console.error('Error initiating SAML logout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate SAML logout',
    };
  }
}
