import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import type { SCIMErrorInput } from './scim-types';

/**
 * Result of SCIM authentication
 */
export interface SCIMAuthResult {
  success: boolean;
  teamSlug?: string;
  tokenId?: string;
  error?: string;
}

/**
 * Authenticate SCIM request using Bearer token
 * @param req NextRequest to authenticate
 * @returns SCIMAuthResult with teamSlug if successful
 */
export async function authenticateSCIM(req: NextRequest): Promise<SCIMAuthResult> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return {
      success: false,
      error: 'Authorization header is missing',
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Invalid authorization header format. Expected: Bearer <token>',
    };
  }

  const token = authHeader.substring(7);

  if (!token || token.trim() === '') {
    return {
      success: false,
      error: 'Token is empty',
    };
  }

  // Hash the token to compare with stored hash
  const tokenHash = hashToken(token);

  try {
    // Look up the token in the database
    const result = await query(
      `SELECT id, team_slug, name, expires_at, created_by
       FROM scim_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Invalid token',
      };
    }

    const tokenRecord = result.rows[0];

    // Check if token has expired
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return {
        success: false,
        error: 'Token has expired',
      };
    }

    // Update last_used timestamp
    await query(
      `UPDATE scim_tokens
       SET last_used = NOW()
       WHERE id = $1`,
      [tokenRecord.id]
    );

    return {
      success: true,
      teamSlug: tokenRecord.team_slug,
      tokenId: tokenRecord.id,
    };
  } catch (error) {
    console.error('SCIM authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Middleware to protect SCIM endpoints
 * Returns SCIM error response if authentication fails
 */
export async function requireSCIMAuth(req: NextRequest): Promise<{ teamSlug: string } | NextResponse> {
  const authResult = await authenticateSCIM(req);

  if (!authResult.success) {
    return scimErrorResponse({
      status: '401',
      scimType: null,
      detail: authResult.error || 'Unauthorized',
    });
  }

  return { teamSlug: authResult.teamSlug! };
}

/**
 * Generate a secure random SCIM bearer token
 * @param length Length of token (default 64 characters)
 * @returns Generated token
 */
export function generateSCIMToken(length: number = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(length);

  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[randomBytes[i] % chars.length];
  }

  return token;
}

/**
 * Hash a SCIM token for storage
 * Uses SHA-256 with random salt
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create SCIM error response
 * @param error SCIM error details
 * @returns NextResponse with SCIM error format
 */
export function scimErrorResponse(error: SCIMErrorInput): NextResponse {
  return NextResponse.json(
    {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: error.status,
      scimType: error.scimType,
      detail: error.detail,
    },
    { status: parseInt(error.status) }
  );
}

/**
 * Extract team slug from SCIM request URL
 * Assumes URL format: /api/scim/v2/{resourceType}
 * Team slug is determined from the authenticated token
 */
export function getTeamSlugFromRequest(req: NextRequest): string | null {
  // For SCIM, the team slug comes from the authenticated token
  // not from the URL. This is handled in requireSCIMAuth
  return null;
}

/**
 * Log SCIM operation
 */
export async function logSCIMOperation(params: {
  teamSlug: string;
  operation: 'create' | 'update' | 'delete' | 'patch';
  resourceType: 'User' | 'Group';
  resourceId?: string;
  scimId?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO scim_sync_logs (
        team_slug, operation, resource_type, resource_id, scim_id, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.teamSlug,
        params.operation,
        params.resourceType,
        params.resourceId || null,
        params.scimId || null,
        params.status,
        params.errorMessage || null,
      ]
    );
  } catch (error) {
    console.error('Failed to log SCIM operation:', error);
  }
}

/**
 * Validate SCIM content type
 */
export function validateSCIMContentType(req: NextRequest): boolean {
  const contentType = req.headers.get('content-type');

  if (req.method === 'GET' || req.method === 'DELETE') {
    return true; // Content-Type not required for these methods
  }

  if (!contentType) {
    return false;
  }

  // Accept both application/scim+json and application/json
  return (
    contentType.includes('application/scim+json') ||
    contentType.includes('application/json')
  );
}

/**
 * Parse team slug from various sources
 * Priority: SCIM token > query param > subdomain
 */
export async function resolveTeamSlug(
  req: NextRequest
): Promise<{ teamSlug: string | null; error?: string }> {
  // First, try to get teamSlug from authenticated SCIM token
  const authResult = await authenticateSCIM(req);

  if (authResult.success && authResult.teamSlug) {
    return { teamSlug: authResult.teamSlug };
  }

  // If no valid token, try query parameters (for testing)
  const queryTeamSlug = req.nextUrl.searchParams.get('teamSlug');
  if (queryTeamSlug) {
    return { teamSlug: queryTeamSlug };
  }

  return {
    teamSlug: null,
    error: 'Cannot determine team slug. Please provide valid SCIM bearer token.',
  };
}
