/**
 * POST /api/oidc/[teamSlug]/login
 *
 * Initiates OIDC login flow for a team.
 * Returns an authorization URL that the user should be redirected to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAuthorizationUrl } from '@/lib/oidc/oidc-provider';
import {
  getOIDCConfig,
  createOIDCSession,
  logOIDCEvent,
} from '@/lib/oidc/oidc-service';
import { isOIDCEnabled } from '@/lib/feature-flags';
import { OIDCError, OIDCErrorCode } from '@/lib/oidc/oidc-provider';
import { initializeTables } from '@/lib/db';

export const runtime = 'nodejs';

interface LoginRequestBody {
  returnUrl?: string;
}

interface LoginResponseBody {
  authorizationUrl: string;
  state: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  let teamSlug: string | undefined;

  try {
    await initializeTables();
    const paramsResult = await params;
    teamSlug = paramsResult.teamSlug;
    const origin = new URL(req.url).origin;

    // Parse request body
    let returnUrl = '/dashboard';
    try {
      const body: LoginRequestBody = await req.json();
      returnUrl = body.returnUrl || returnUrl;
    } catch {
      // Body is optional
    }

    // Check if OIDC is globally enabled
    const oidcEnabled = await isOIDCEnabled(teamSlug);
    if (!oidcEnabled) {
      return NextResponse.json(
        {
          error: OIDCErrorCode.OIDC_DISABLED,
          error_description: 'OIDC authentication is currently disabled',
        },
        { status: 400 }
      );
    }

    // Get OIDC configuration for team
    const config = await getOIDCConfig(teamSlug);
    if (!config || !config.enabled) {
      return NextResponse.json(
        {
          error: OIDCErrorCode.OIDC_NOT_CONFIGURED,
          error_description: 'OIDC is not configured for this team',
        },
        { status: 404 }
      );
    }

    // Build redirect URI
    const redirectUri = `${origin}/api/oidc/callback`;

    // Create OIDC session with state/nonce
    const session = await createOIDCSession(teamSlug, returnUrl, {
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // Generate authorization URL
    const { authorizationUrl, state } = await generateAuthorizationUrl(
      config,
      redirectUri,
      {
        state: session.state,
        nonce: session.nonce,
        codeVerifier: session.codeVerifier,
      }
    );

    // Log audit event
    await logOIDCEvent(teamSlug, 'login_initiated', 'success', {
      idpIssuer: config.issuer,
      oidcSessionId: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      metadata: { returnUrl },
    });

    // Return authorization URL
    const response: LoginResponseBody = {
      authorizationUrl,
      state,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('OIDC login error:', error);

    const errorCode =
      error instanceof OIDCError ? error.code : OIDCErrorCode.PROVIDER_UNAVAILABLE;
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to initiate OIDC login';

    // Try to log error if we have teamSlug
    try {
      if (teamSlug) {
        await logOIDCEvent(teamSlug, 'login_initiated', 'failed', {
          idpIssuer: '',
          errorCode,
          errorMessage,
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      {
        error: errorCode,
        error_description: errorMessage,
      },
      { status: 500 }
    );
  }
}
