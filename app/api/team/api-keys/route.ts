import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { hasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions-config';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKeyScopes,
  getApiKeyUsageLogs,
} from '@/lib/api-keys/api-key-service';
import type { ApiKeyScope } from '@/lib/permissions-config';
import { checkTeamRateLimit } from '@/lib/middleware/api-rate-limit';

/**
 * GET /api/team/api-keys?teamSlug={slug}
 * List all API keys for a team
 */
export async function GET(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug is required' },
        { status: 400 }
      );
    }

    // Check permission
    const hasViewPermission = await hasPermission(
      user.id,
      teamSlug,
      PERMISSIONS.SECURITY_VIEW_API_KEYS
    );

    if (!hasViewPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to view API keys' },
        { status: 403 }
      );
    }

    // Get user ID filter for non-managers
    const hasManagePermission = await hasPermission(
      user.id,
      teamSlug,
      PERMISSIONS.SECURITY_MANAGE_API_KEYS
    );

    const userId = hasManagePermission ? undefined : user.id;

    // List API keys
    const apiKeys = await listApiKeys(teamSlug, userId);

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error('API Keys GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/api-keys
 * Create a new API key
 */
export async function POST(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { teamSlug, name, scopes, expiresIn } = body;

    if (!teamSlug || !name || !scopes) {
      return NextResponse.json(
        { error: 'teamSlug, name, and scopes are required' },
        { status: 400 }
      );
    }

    // Check permission
    const hasManagePermission = await hasPermission(
      user.id,
      teamSlug,
      PERMISSIONS.SECURITY_MANAGE_API_KEYS
    );

    if (!hasManagePermission) {
      return NextResponse.json(
        { error: 'You do not have permission to create API keys' },
        { status: 403 }
      );
    }

    // Validate scopes
    const { API_KEY_SCOPES } = await import('@/lib/permissions-config');
    const validScopes = Object.values(API_KEY_SCOPES);
    const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s as ApiKeyScope));

    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes: ${invalidScopes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create API key
    const apiKey = await createApiKey({
      teamSlug,
      userId: user.id,
      name: name.trim(),
      scopes,
      expiresIn,
      createdBy: user.id,
    });

    return NextResponse.json(apiKey, { status: 201 });
  } catch (error) {
    console.error('API Keys POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/team/api-keys
 * Update an API key's scopes
 */
export async function PATCH(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { teamSlug, keyId, scopes } = body;

    if (!teamSlug || !keyId || !scopes) {
      return NextResponse.json(
        { error: 'teamSlug, keyId, and scopes are required' },
        { status: 400 }
      );
    }

    // Check permission
    const hasManagePermission = await hasPermission(
      user.id,
      teamSlug,
      PERMISSIONS.SECURITY_MANAGE_API_KEYS
    );

    if (!hasManagePermission) {
      return NextResponse.json(
        { error: 'You do not have permission to update API keys' },
        { status: 403 }
      );
    }

    // Validate scopes
    const { API_KEY_SCOPES } = await import('@/lib/permissions-config');
    const validScopes = Object.values(API_KEY_SCOPES);
    const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s as ApiKeyScope));

    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes: ${invalidScopes.join(', ')}` },
        { status: 400 }
      );
    }

    // Update API key scopes
    const updated = await updateApiKeyScopes(keyId, teamSlug, scopes);

    if (!updated) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Keys PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/api-keys?teamSlug={slug}&keyId={id}
 * Revoke an API key
 */
export async function DELETE(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug');
    const keyId = searchParams.get('keyId');

    if (!teamSlug || !keyId) {
      return NextResponse.json(
        { error: 'teamSlug and keyId are required' },
        { status: 400 }
      );
    }

    // Check permission
    const hasManagePermission = await hasPermission(
      user.id,
      teamSlug,
      PERMISSIONS.SECURITY_MANAGE_API_KEYS
    );

    if (!hasManagePermission) {
      return NextResponse.json(
        { error: 'You do not have permission to revoke API keys' },
        { status: 403 }
      );
    }

    // Revoke API key
    const deleted = await revokeApiKey(keyId, teamSlug);

    if (!deleted) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Keys DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
