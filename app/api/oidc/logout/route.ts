/**
 * POST /api/oidc/logout
 *
 * Logs out the user by clearing the session cookie.
 * Optionally returns an end_session_endpoint URL for IdP-initiated logout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOIDCConfig } from '@/lib/oidc/oidc-service';
import { generateEndSessionUrl } from '@/lib/oidc/oidc-provider';
import { logOIDCEvent } from '@/lib/oidc/oidc-service';
import { getUserFromSessionCookie, getClearSessionCookieValue } from '@/lib/auth/stack-auth-adapter';
import { initializeTables } from '@/lib/db';

export const runtime = 'nodejs';

const SESSION_COOKIE_NAME = 'nexary_session';

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0, // Expire immediately
  };
}

interface LogoutRequestBody {
  teamSlug?: string;
  idTokenHint?: string;
  postLogoutRedirectUri?: string;
}

interface LogoutResponseBody {
  success: true;
  endSessionUrl?: string | null;
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    await initializeTables();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    let teamSlug: string | undefined;
    let userId: string | undefined;

    // Extract user info from session if available
    if (sessionCookie) {
      const user = getUserFromSessionCookie(sessionCookie.value);
      if (user) {
        userId = user.id;
      }
    }

    // Parse request body
    let idTokenHint: string | undefined;
    let postLogoutRedirectUri: string | undefined;

    try {
      const body: LogoutRequestBody = await req.json();
      teamSlug = body.teamSlug;
      idTokenHint = body.idTokenHint;
      postLogoutRedirectUri = body.postLogoutRedirectUri;
    } catch {
      // Body is optional
    }

    // Clear session cookie
    cookieStore.set(SESSION_COOKIE_NAME, '', getCookieOptions());

    // Get end session URL if teamSlug and idTokenHint provided
    let endSessionUrl: string | null = null;
    let config = null;

    if (teamSlug && idTokenHint) {
      try {
        config = await getOIDCConfig(teamSlug);
        if (config) {
          endSessionUrl = await generateEndSessionUrl(
            config,
            idTokenHint,
            postLogoutRedirectUri
          );
        }
      } catch {
        // Ignore errors getting end session URL
      }

      // Log logout event
      if (userId) {
        await logOIDCEvent(teamSlug!, 'logout', 'success', {
          idpIssuer: config?.issuer || '',
          userId,
        });
      }
    }

    const response: LogoutResponseBody = {
      success: true,
      endSessionUrl,
      message: endSessionUrl
        ? 'Logged out. Redirect to endSessionUrl for IdP logout.'
        : 'Logged out successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('OIDC logout error:', error);

    // Still clear the cookie even if there's an error
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', getCookieOptions());

    return NextResponse.json(
      {
        success: true,
        message: 'Logged out (some cleanup may have failed)',
      } as LogoutResponseBody,
      { status: 500 }
    );
  }
}
