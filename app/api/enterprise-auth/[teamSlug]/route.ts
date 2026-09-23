/**
 * Unified Auth Router - Determines which auth method to use
 *
 * GET/POST /api/enterprise-auth/[teamSlug]
 *
 * This endpoint acts as a router that determines whether to use SAML or OIDC
 * based on team configuration and feature flags. It supports:
 * - Direct SAML or OIDC mode
 * - Both mode (router decides)
 * - Migration modes (shadow, canary, full)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, initializeTables } from '@/lib/db';
import { getOIDCMigrationMode, isInCanary } from '@/lib/feature-flags';
import type { AuthMethod } from './unified-auth-types';

export const runtime = 'nodejs';

/**
 * Determine authentication method for a team
 */
async function determineAuthMethod(
  teamSlug: string,
  userEmail?: string
): Promise<{
  method: AuthMethod;
  reason: string;
  migrationMode?: string;
}> {
  // Get team SSO configuration
  const teamResult = await query(
    `SELECT sso_type, enterprise_auth_enabled
     FROM projectnexus.teams
     WHERE slug = $1`,
    [teamSlug]
  );

  if (teamResult.rows.length === 0) {
    return {
      method: 'none',
      reason: 'Team not found',
    };
  }

  const team = teamResult.rows[0];

  if (!team.enterprise_auth_enabled) {
    return {
      method: 'none',
      reason: 'Enterprise auth not enabled for team',
    };
  }

  const ssoType = team.sso_type as 'none' | 'saml' | 'oidc' | 'both';

  // Check SAML configuration
  const samlResult = await query(
    `SELECT id FROM projectnexus.saml_configurations WHERE team_slug = $1`,
    [teamSlug]
  );
  const hasSaml = samlResult.rows.length > 0;

  // Check OIDC configuration
  const oidcResult = await query(
    `SELECT id, enabled FROM projectnexus.oidc_configurations WHERE team_slug = $1`,
    [teamSlug]
  );
  const hasOidc = oidcResult.rows.length > 0 && oidcResult.rows[0].enabled;

  // Get migration mode from feature flags
  const migrationMode = await getOIDCMigrationMode(teamSlug);

  // Determine based on sso_type
  switch (ssoType) {
    case 'none':
      return {
        method: 'none',
        reason: 'SSO not configured for team',
      };

    case 'saml':
      if (!hasSaml) {
        return {
          method: 'none',
          reason: 'SAML configured but not found in database',
        };
      }
      return {
        method: 'saml',
        reason: 'Team configured for SAML only',
        migrationMode,
      };

    case 'oidc':
      if (!hasOidc) {
        return {
          method: 'none',
          reason: 'OIDC configured but not found or disabled in database',
        };
      }
      return {
        method: 'oidc',
        reason: 'Team configured for OIDC only',
        migrationMode,
      };

    case 'both':
      // Router decides based on migration mode
      switch (migrationMode) {
        case 'off':
        case 'shadow':
          // Use SAML as primary
          if (!hasSaml) {
            // Fallback to OIDC if SAML not available
            if (hasOidc) {
              return {
                method: 'oidc',
                reason: 'SAML configured but not available, falling back to OIDC',
                migrationMode,
              };
            }
            return {
              method: 'none',
              reason: 'Both configured but neither available',
              migrationMode,
            };
          }
          return {
            method: 'saml',
            reason: 'Migration in shadow/off mode - using SAML',
            migrationMode,
          };

        case 'canary':
          // Use canary percentage to decide
          if (userEmail) {
            const inCanary = await isInCanary(teamSlug, userEmail);
            if (inCanary && hasOidc) {
              return {
                method: 'oidc',
                reason: 'User in canary group - using OIDC',
                migrationMode,
              };
            }
          }
          // Fall back to SAML
          if (hasSaml) {
            return {
              method: 'saml',
              reason: 'User not in canary group - using SAML',
              migrationMode,
            };
          }
          // Fallback to OIDC if SAML not available
          if (hasOidc) {
            return {
              method: 'oidc',
              reason: 'SAML not available, falling back to OIDC',
              migrationMode,
            };
          }
          return {
            method: 'none',
            reason: 'Neither SAML nor OIDC available',
            migrationMode,
          };

        case 'full':
          // Use OIDC as primary
          if (!hasOidc) {
            // Fallback to SAML if OIDC not available
            if (hasSaml) {
              return {
                method: 'saml',
                reason: 'Full OIDC mode but OIDC not available, falling back to SAML',
                migrationMode,
              };
            }
            return {
              method: 'none',
              reason: 'Full OIDC mode but OIDC not available',
              migrationMode,
            };
          }
          return {
            method: 'oidc',
            reason: 'Full OIDC mode - using OIDC',
            migrationMode,
          };

        default:
          // Default to SAML
          if (hasSaml) {
            return {
              method: 'saml',
              reason: 'Defaulting to SAML',
              migrationMode,
            };
          }
          if (hasOidc) {
            return {
              method: 'oidc',
              reason: 'SAML not available, using OIDC',
              migrationMode,
            };
          }
          return {
            method: 'none',
            reason: 'No auth method available',
            migrationMode,
          };
      }

    default:
      return {
        method: 'none',
        reason: `Unknown sso_type: ${ssoType}`,
      };
  }
}

/**
 * GET /api/enterprise-auth/[teamSlug]
 *
 * Returns information about which auth method will be used
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    // Ensure database tables exist
    await initializeTables();

    const { teamSlug } = await params;
    const userEmail = req.nextUrl.searchParams.get('email') || undefined;

    const result = await determineAuthMethod(teamSlug, userEmail);

    return NextResponse.json({
      teamSlug,
      method: result.method,
      reason: result.reason,
      migrationMode: result.migrationMode,
    });
  } catch (error) {
    console.error('Unified auth router error:', error);
    return NextResponse.json(
      {
        error: 'Failed to determine auth method',
        method: 'none',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/enterprise-auth/[teamSlug]
 *
 * Initiates the appropriate auth flow (SAML or OIDC)
 * Returns a redirect URL or authorization URL
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    // Ensure database tables exist
    await initializeTables();

    const { teamSlug } = await params;
    const origin = new URL(req.url).origin;

    // Parse request body
    let returnUrl = '/dashboard';
    let userEmail: string | undefined;

    try {
      const body = await req.json();
      returnUrl = body.returnUrl || returnUrl;
      userEmail = body.email;
    } catch {
      // Body is optional
    }

    // Determine auth method
    const authResult = await determineAuthMethod(teamSlug, userEmail);

    if (authResult.method === 'none') {
      return NextResponse.json(
        {
          error: 'SSO not configured',
          error_description: authResult.reason,
        },
        { status: 400 }
      );
    }

    // Initiate appropriate auth flow
    if (authResult.method === 'saml') {
      // Redirect to SAML login
      const samlUrl = `${origin}/api/saml/${teamSlug}/login`;

      // Call SAML login endpoint
      const samlResponse = await fetch(samlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnUrl }),
      });

      if (!samlResponse.ok) {
        const error = await samlResponse.json();
        return NextResponse.json(
          { error: error.error || 'SAML login failed' },
          { status: samlResponse.status }
        );
      }

      const samlData = await samlResponse.json();
      return NextResponse.json({
        method: 'saml',
        redirectUrl: samlData.redirectUrl || samlUrl,
        reason: authResult.reason,
        migrationMode: authResult.migrationMode,
      });
    } else if (authResult.method === 'oidc') {
      // Redirect to OIDC login
      const oidcUrl = `${origin}/api/oidc/${teamSlug}/login`;

      // Call OIDC login endpoint
      const oidcResponse = await fetch(oidcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnUrl }),
      });

      if (!oidcResponse.ok) {
        const error = await oidcResponse.json();
        return NextResponse.json(
          { error: error.error || 'OIDC login failed' },
          { status: oidcResponse.status }
        );
      }

      const oidcData = await oidcResponse.json();
      return NextResponse.json({
        method: 'oidc',
        authorizationUrl: oidcData.authorizationUrl,
        reason: authResult.reason,
        migrationMode: authResult.migrationMode,
      });
    }

    return NextResponse.json(
      { error: 'Unknown auth method' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Unified auth router error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate auth flow' },
      { status: 500 }
    );
  }
}
