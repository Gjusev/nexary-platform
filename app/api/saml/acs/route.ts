import { NextRequest, NextResponse } from 'next/server';
import {
  validateSAMLResponse,
  clearRelayState,
  clearRequestId,
  createSAMLSession,
  parseRelayState,
} from '@/lib/saml/saml-middleware';
import type { SAMLProfile } from '@/lib/saml/saml-provider';

/**
 * POST /api/saml/acs
 * Assertion Consumer Service (ACS) endpoint
 * Receives SAML response from Identity Provider after user authentication
 *
 * Request body:
 * {
 *   "SAMLResponse": "base64-encoded-saml-response",
 *   "RelayState": "base64-relay-state"  // Optional
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "profile": { ... },
 *   "redirectUrl": "/dashboard"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { SAMLResponse: samlResponse, RelayState: relayState } = body;

    // Validate SAML response is present
    if (!samlResponse) {
      return NextResponse.json(
        { error: 'SAMLResponse is required' },
        { status: 400 }
      );
    }

    // Parse relay state to get team slug
    let teamSlug: string | null = null;
    let returnUrl = '/dashboard';

    if (relayState) {
      const parsedRelay = parseRelayState(relayState);
      if (parsedRelay) {
        teamSlug = parsedRelay.teamSlug;
        returnUrl = parsedRelay.returnUrl;
      }
    }

    // If no team slug from relay state, try to get from query params
    if (!teamSlug) {
      teamSlug = req.nextUrl.searchParams.get('teamSlug');
    }

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'Cannot determine team slug from relay state or request' },
        { status: 400 }
      );
    }

    // Validate SAML response
    const result = await validateSAMLResponse(
      req,
      teamSlug,
      samlResponse,
      relayState
    );

    if (!result.success || !result.profile) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to validate SAML response',
        },
        { status: 401 }
      );
    }

    const profile = result.profile;

    // Find or create user in Stack Auth based on SAML profile
    const user = await findOrCreateUserFromSAML(profile, teamSlug);

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user from SAML profile' },
        { status: 500 }
      );
    }

    // Create SAML session
    const samlSession = {
      userId: user.userId,
      email: user.email,
      teamSlug,
      nameID: profile.nameID,
      sessionIndex: profile.sessionIndex,
      authenticatedAt: Date.now(),
    };

    let response = NextResponse.json({
      success: true,
      profile: {
        email: profile.email,
        displayName: profile.displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
      },
      redirectUrl: returnUrl,
      user: {
        userId: user.userId,
        email: user.email,
        teamSlug,
      },
    }) as NextResponse;

    // Create SAML session cookie
    response = createSAMLSession(response, samlSession) as NextResponse;

    // Clear relay state and request ID cookies
    response = clearRelayState(response) as NextResponse;
    response = clearRequestId(response) as NextResponse;

    return response;
  } catch (error) {
    console.error('Error in SAML ACS endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/saml/acs
 * Alternative method for IdPs that use HTTP-Redirect binding
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const samlResponse = searchParams.get('SAMLResponse');
    const relayState = searchParams.get('RelayState');

    // Validate SAML response is present
    if (!samlResponse) {
      return NextResponse.json(
        { error: 'SAMLResponse is required' },
        { status: 400 }
      );
    }

    // Parse relay state to get team slug
    let teamSlug: string | null = null;
    let returnUrl = '/dashboard';

    if (relayState) {
      const parsedRelay = parseRelayState(relayState);
      if (parsedRelay) {
        teamSlug = parsedRelay.teamSlug;
        returnUrl = parsedRelay.returnUrl;
      }
    }

    // If no team slug from relay state, try to get from query params
    if (!teamSlug) {
      teamSlug = searchParams.get('teamSlug');
    }

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'Cannot determine team slug from relay state or request' },
        { status: 400 }
      );
    }

    // Validate SAML response
    const result = await validateSAMLResponse(
      req,
      teamSlug,
      samlResponse,
      relayState || undefined
    );

    if (!result.success || !result.profile) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to validate SAML response',
        },
        { status: 401 }
      );
    }

    const profile = result.profile;

    // Find or create user in Stack Auth based on SAML profile
    const user = await findOrCreateUserFromSAML(profile, teamSlug);

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user from SAML profile' },
        { status: 500 }
      );
    }

    // Create SAML session
    const samlSession = {
      userId: user.userId,
      email: user.email,
      teamSlug,
      nameID: profile.nameID,
      sessionIndex: profile.sessionIndex,
      authenticatedAt: Date.now(),
    };

    let response = NextResponse.redirect(
      new URL(returnUrl, req.url)
    );

    // Create SAML session cookie
    response = createSAMLSession(response, samlSession);

    // Clear relay state and request ID cookies
    response = clearRelayState(response);
    response = clearRequestId(response);

    return response;
  } catch (error) {
    console.error('Error in SAML ACS endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Find or create user from SAML profile
 * This is where SAML authentication is integrated with Stack Auth
 */
async function findOrCreateUserFromSAML(
  profile: SAMLProfile,
  teamSlug: string
): Promise<{ userId: string; email: string } | null> {
  try {
    // Use existing Stack Server App configuration
    const { stackServerApp } = await import('@/lib/stack/stack-server');

    // Check if user exists by email using query search
    const existingUsers = await stackServerApp.listUsers({
      query: profile.email,
      limit: 10,
    });

    // Find exact match by email
    const existingUser = existingUsers.find(u => u.primaryEmail === profile.email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Update user display name if needed
      const displayName = profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
      if (displayName && displayName !== existingUser.displayName) {
        await existingUser.update({ displayName });
      }
    } else {
      // Create new user in Stack Auth
      const displayName = profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
      const newUser = await stackServerApp.createUser({
        primaryEmail: profile.email,
        password: generateRandomPassword(), // SAML users don't need password
        displayName,
        primaryEmailVerified: true, // Email is verified by IdP
        primaryEmailAuthEnabled: false, // SAML users don't use email/password
      });

      userId = newUser.id;
    }

    // Ensure user is a member of the team
    await ensureTeamMembership(userId, teamSlug, profile.email);

    return {
      userId,
      email: profile.email,
    };
  } catch (error) {
    console.error('Error finding or creating user from SAML:', error);
    return null;
  }
}

/**
 * Ensure user is a member of the team
 */
async function ensureTeamMembership(
  userId: string,
  teamSlug: string,
  email: string
): Promise<void> {
  const { query } = await import('@/lib/db');

  // Check if team exists
  const teamResult = await query(
    `SELECT id FROM teams WHERE slug = $1`,
    [teamSlug]
  );

  if (teamResult.rows.length === 0) {
    throw new Error(`Team ${teamSlug} not found`);
  }

  const teamId = teamResult.rows[0].id;

  // Check if user is already a member
  const memberResult = await query(
    `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId]
  );

  if (memberResult.rows.length > 0) {
    // User is already a member, update last active
    await query(
      `UPDATE team_members SET last_active = NOW() WHERE id = $1`,
      [memberResult.rows[0].id]
    );
  } else {
    // Add user as a team member
    await query(
      `INSERT INTO team_members (team_id, user_id, email, role, status)
       VALUES ($1, $2, $3, 'member', 'active')`,
      [teamId, userId, email]
    );
  }
}

/**
 * Generate a random password for SAML-created users
 * These users will authenticate via SAML, so password is not used
 */
function generateRandomPassword(): string {
  const length = 32;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));

  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  return password;
}
