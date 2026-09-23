/**
 * GET /api/oidc/config - Get OIDC configuration for a team
 * POST /api/oidc/config - Create/update OIDC configuration
 * PUT /api/oidc/config - Update OIDC configuration
 * DELETE /api/oidc/config - Delete OIDC configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOIDCConfig,
  saveOIDCConfig,
  deleteOIDCConfig,
} from '@/lib/oidc/oidc-service';
import { initializeTables } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Get OIDC configuration
 */
export async function GET(req: NextRequest) {
  try {
    await initializeTables();
    const teamSlug = req.nextUrl.searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'Missing teamSlug parameter' },
        { status: 400 }
      );
    }

    const config = await getOIDCConfig(teamSlug);

    if (!config) {
      return NextResponse.json(
        {
          error: 'OIDC_NOT_CONFIGURED',
          error_description: 'OIDC is not configured for this team',
        },
        { status: 404 }
      );
    }

    // Return config without sensitive data
    const safeConfig = {
      enabled: config.enabled,
      issuer: config.issuer,
      clientId: config.clientId,
      // Don't return clientSecret
      scope: config.scope,
      authorizationEndpoint: config.authorizationEndpoint,
      tokenEndpoint: config.tokenEndpoint,
      userInfoEndpoint: config.userInfoEndpoint,
      jwksUri: config.jwksUri,
      endSessionEndpoint: config.endSessionEndpoint,
      pkce: config.pkce,
      tokenSigningAlg: config.tokenSigningAlg,
      claimsMapping: config.claimsMapping,
      lastUsedAt: config.lastUsedAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };

    return NextResponse.json(safeConfig);
  } catch (error) {
    console.error('Error getting OIDC config:', error);
    return NextResponse.json(
      { error: 'Failed to get OIDC configuration' },
      { status: 500 }
    );
  }
}

/**
 * Create OIDC configuration
 */
export async function POST(req: NextRequest) {
  try {
    await initializeTables();
    const body = await req.json();
    const { teamSlug, ...configData } = body;

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'Missing teamSlug' },
        { status: 400 }
      );
    }

    const config = await saveOIDCConfig(teamSlug, configData);

    return NextResponse.json(
      {
        message: 'OIDC configuration created successfully',
        config: {
          enabled: config.enabled,
          issuer: config.issuer,
          clientId: config.clientId,
          scope: config.scope,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating OIDC config:', error);
    return NextResponse.json(
      { error: 'Failed to create OIDC configuration' },
      { status: 500 }
    );
  }
}

/**
 * Update OIDC configuration
 */
export async function PUT(req: NextRequest) {
  try {
    await initializeTables();
    const body = await req.json();
    const { teamSlug, ...configData } = body;

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'Missing teamSlug' },
        { status: 400 }
      );
    }

    const existingConfig = await getOIDCConfig(teamSlug);
    if (!existingConfig) {
      return NextResponse.json(
        {
          error: 'OIDC_NOT_CONFIGURED',
          error_description: 'OIDC is not configured for this team',
        },
        { status: 404 }
      );
    }

    const config = await saveOIDCConfig(teamSlug, configData);

    return NextResponse.json({
      message: 'OIDC configuration updated successfully',
      config: {
        enabled: config.enabled,
        issuer: config.issuer,
        clientId: config.clientId,
        scope: config.scope,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating OIDC config:', error);
    return NextResponse.json(
      { error: 'Failed to update OIDC configuration' },
      { status: 500 }
    );
  }
}

/**
 * Delete OIDC configuration
 */
export async function DELETE(req: NextRequest) {
  try {
    await initializeTables();
    const teamSlug = req.nextUrl.searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'Missing teamSlug parameter' },
        { status: 400 }
      );
    }

    await deleteOIDCConfig(teamSlug);

    return NextResponse.json({
      message: 'OIDC configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting OIDC config:', error);
    return NextResponse.json(
      { error: 'Failed to delete OIDC configuration' },
      { status: 500 }
    );
  }
}
