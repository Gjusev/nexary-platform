/**
 * GET /api/oidc/callback
 *
 * Handles the callback from the OIDC provider.
 * Validates state, exchanges code for tokens, validates ID token,
 * links identity to Stack Auth user, and creates a session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  exchangeCodeForTokens,
  validateIdToken,
  constructUserProfile,
  generateEndSessionUrl,
} from '@/lib/oidc/oidc-provider';
import {
  consumeOIDCSession,
  getOIDCConfig,
  linkUserIdentity,
  findUserIdentity,
  logOIDCEvent,
  updateLastUsed,
} from '@/lib/oidc/oidc-service';
import { initializeTables } from '@/lib/db';
import {
  getOrCreateStackAuthUser,
  createStackAuthSession,
  getSessionCookieValue,
} from '@/lib/auth/stack-auth-adapter';
import { OIDCError, OIDCErrorCode } from '@/lib/oidc/oidc-provider';

export const runtime = 'nodejs'; // Need Node.js runtime for crypto

/**
 * Name of the session cookie
 */
const SESSION_COOKIE_NAME = 'nexary_session';

/**
 * Cookie options
 */
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  };
}

export async function GET(req: NextRequest) {
  try {
    await initializeTables();
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check for errors from IdP
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || 'Authentication failed')}`,
          req.url
        )
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          '/login?error=invalid_request&description=Missing required parameters',
          req.url
        )
      );
    }

    // Consume session (validates state and gets nonce/code_verifier)
    const session = await consumeOIDCSession(state);
    if (!session) {
      return NextResponse.redirect(
        new URL(
          '/login?error=invalid_state&description=Invalid or expired state parameter',
          req.url
        )
      );
    }

    const { teamSlug, nonce, codeVerifier, returnUrl } = session;

    // Validate codeVerifier is present (required for PKCE)
    if (!codeVerifier) {
      throw new OIDCError(
        OIDCErrorCode.INVALID_STATE,
        'Missing code verifier in session'
      );
    }

    // Get OIDC configuration
    const config = await getOIDCConfig(teamSlug);
    if (!config) {
      throw new OIDCError(
        OIDCErrorCode.OIDC_NOT_CONFIGURED,
        'OIDC configuration not found'
      );
    }

    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/api/oidc/callback`;

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(
      config,
      code,
      redirectUri,
      codeVerifier
    );

    // Validate ID token
    const idTokenClaims = validateIdToken(
      tokenResponse.id_token,
      config,
      nonce
    );

    // Construct user profile from ID token
    const userProfile = constructUserProfile(idTokenClaims);

    // Check if identity already exists
    const existingIdentity = await findUserIdentity(
      teamSlug,
      userProfile.email,
      idTokenClaims.sub,
      'oidc'
    );

    let userId: string;
    let identityId: string | undefined;

    if (existingIdentity) {
      userId = existingIdentity.userId;
      identityId = existingIdentity.id;
    } else {
      // Get or create user in Stack Auth
      const stackAuthUser = await getOrCreateStackAuthUser(
        teamSlug,
        userProfile
      );
      userId = stackAuthUser.id;

      // Link identity to user
      const identity = await linkUserIdentity(
        userId,
        teamSlug,
        'oidc',
        idTokenClaims.sub,
        config.issuer,
        userProfile
      );
      identityId = identity.id;
    }

    // Create Stack Auth session
    const stackAuthSession = await createStackAuthSession(userId);

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      getSessionCookieValue(stackAuthSession),
      getCookieOptions()
    );

    // Update last used timestamp
    await updateLastUsed(teamSlug);

    // Log success
    await logOIDCEvent(teamSlug, 'login_success', 'success', {
      idpIssuer: config.issuer,
      userId,
      email: userProfile.email,
      identityId,
      oidcSessionId: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    });

    // Redirect to return URL
    return NextResponse.redirect(new URL(returnUrl, req.url));
  } catch (error) {
    console.error('OIDC callback error:', error);

    const errorCode =
      error instanceof OIDCError ? error.code : OIDCErrorCode.PROVIDER_UNAVAILABLE;
    const errorMessage =
      error instanceof Error ? error.message : 'Authentication failed';

    // Try to log error (may fail if we don't have context)
    try {
      const state = req.nextUrl.searchParams.get('state');
      if (state) {
        const session = await consumeOIDCSession(state);
        if (session) {
          await logOIDCEvent(session.teamSlug, 'login_failed', 'failed', {
            idpIssuer: '',
            errorCode,
            errorMessage,
            oidcSessionId: session.id,
          });
        }
      }
    } catch {
      // Ignore logging errors
    }

    // Redirect to login with error
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(errorCode)}&description=${encodeURIComponent(errorMessage)}`,
        req.url
      )
    );
  }
}
