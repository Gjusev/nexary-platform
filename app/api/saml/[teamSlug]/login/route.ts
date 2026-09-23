import { NextRequest, NextResponse } from 'next/server';
import { initiateSAMLLogin, storeRelayState, generateRelayState } from '@/lib/saml/saml-middleware';

/**
 * POST /api/saml/[teamSlug]/login
 * Initiates SAML SSO flow for a team
 *
 * Request body:
 * {
 *   "returnUrl": "/dashboard"  // Optional: where to redirect after successful auth
 * }
 *
 * Response:
 * {
 *   "redirectUrl": "https://idp.example.com/sso?SAMLRequest=..."
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    const { teamSlug } = await params;
    const body = await req.json().catch(() => ({}));
    const returnUrl = body.returnUrl as string | undefined;

    // Validate team slug
    if (!teamSlug || teamSlug.length < 2) {
      return NextResponse.json(
        { error: 'Invalid team slug' },
        { status: 400 }
      );
    }

    // Initiate SAML login
    const result = await initiateSAMLLogin(req, teamSlug, returnUrl);

    if (!result.success || !result.redirectUrl) {
      return NextResponse.json(
        { error: result.error || 'Failed to initiate SAML login' },
        { status: 400 }
      );
    }

    // Store relay state in cookie for CSRF protection
    const relayState = generateRelayState(teamSlug, returnUrl);
    const response = NextResponse.json({
      redirectUrl: result.redirectUrl,
      relayState,
    });

    return storeRelayState(response, relayState);
  } catch (error) {
    console.error('Error in SAML login endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/saml/[teamSlug]/login
 * Returns the redirect URL (alternative to POST)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    const { teamSlug } = await params;
    const searchParams = req.nextUrl.searchParams;
    const returnUrl = searchParams.get('returnUrl') || undefined;

    // Validate team slug
    if (!teamSlug || teamSlug.length < 2) {
      return NextResponse.json(
        { error: 'Invalid team slug' },
        { status: 400 }
      );
    }

    // Initiate SAML login
    const result = await initiateSAMLLogin(req, teamSlug, returnUrl);

    if (!result.success || !result.redirectUrl) {
      return NextResponse.json(
        { error: result.error || 'Failed to initiate SAML login' },
        { status: 400 }
      );
    }

    // Store relay state and return redirect URL
    const relayState = generateRelayState(teamSlug, returnUrl);
    const response = NextResponse.json({
      redirectUrl: result.redirectUrl,
      relayState,
    });

    return storeRelayState(response, relayState);
  } catch (error) {
    console.error('Error in SAML login endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
