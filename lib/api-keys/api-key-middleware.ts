/**
 * API Key Authentication Middleware
 *
 * Provides middleware for authenticating requests using API keys via Bearer token.
 * Compatible with Stack Auth - API keys are separate from user sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, extractApiKeyPrefix, logApiKeyUsage } from './api-key-service';
import type { ApiKey } from './api-key-service';
import type { ApiKeyScope } from '@/lib/permissions-config';

// =====================================================
// TYPES
// =====================================================

export interface ApiKeyAuthSuccess {
  success: true;
  apiKey: ApiKey;
}

export interface ApiKeyAuthError {
  success: false;
  error: string;
  code: 'MISSING_KEY' | 'INVALID_KEY' | 'EXPIRED_KEY' | 'INSUFFICIENT_SCOPES';
}

export type ApiKeyAuthResult = ApiKeyAuthSuccess | ApiKeyAuthError;

// =====================================================
// AUTHENTICATION FUNCTIONS
// =====================================================

/**
 * Extract API key from Authorization header
 * @param authHeader The Authorization header value
 * @returns The API key or null if invalid format
 */
function extractApiKeyFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer nxk_<prefix>_<random>"
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const key = authHeader.substring(7).trim();

  // Basic validation - must start with our prefix
  if (!key.startsWith('nxk_')) {
    return null;
  }

  return key;
}

/**
 * Authenticate a request using API key
 * @param req The Next.js request
 * @returns Authentication result with API key details or error
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuthResult> {
  const authHeader = req.headers.get('authorization');
  const key = extractApiKeyFromHeader(authHeader);

  if (!key) {
    return {
      success: false,
      error: 'Missing or invalid Authorization header. Expected format: Bearer nxk_...',
      code: 'MISSING_KEY',
    };
  }

  const apiKey = await validateApiKey(key);

  if (!apiKey) {
    const prefix = extractApiKeyPrefix(key);
    return {
      success: false,
      error: `Invalid API key (${prefix}). Please check your key and try again.`,
      code: 'INVALID_KEY',
    };
  }

  return {
    success: true,
    apiKey,
  };
}

/**
 * Middleware to protect API routes with API key authentication
 * Returns an error response if authentication fails
 * @param req The Next.js request
 * @param requiredScopes Optional scopes required for this endpoint
 * @returns NextResponse with error if auth fails, null if successful
 */
export async function requireApiKey(
  req: NextRequest,
  requiredScopes?: ApiKeyScope[]
): Promise<{ apiKey: ApiKey } | NextResponse> {
  const authResult = await authenticateApiKey(req);

  if (!authResult.success) {
    return NextResponse.json(
      {
        error: authResult.error,
        code: authResult.code,
      },
      { status: 401 }
    );
  }

  // Check scopes if required
  if (requiredScopes && requiredScopes.length > 0) {
    const { hasAnyScope } = await import('./api-key-service');

    if (!hasAnyScope(authResult.apiKey, requiredScopes)) {
      return NextResponse.json(
        {
          error: `Insufficient permissions. Required scopes: ${requiredScopes.join(', ')}`,
          code: 'INSUFFICIENT_SCOPES',
          requiredScopes,
        },
        { status: 403 }
      );
    }
  }

  return { apiKey: authResult.apiKey };
}

/**
 * Wrapper to log API key usage after request completes
 * Use this in API routes after processing the request
 * @param apiKeyId The API key ID
 * @param req The Next.js request
 * @param statusCode The response status code
 */
export async function logApiKeyRequest(
  apiKeyId: string,
  req: NextRequest,
  statusCode: number
): Promise<void> {
  const endpoint = new URL(req.url).pathname;
  const method = req.method;
  const ipAddress = req.headers.get('x-forwarded-for') ||
                   req.headers.get('x-real-ip') ||
                   undefined;
  const userAgent = req.headers.get('user-agent') || undefined;

  await logApiKeyUsage(apiKeyId, endpoint, method, statusCode, ipAddress, userAgent);
}

// =====================================================
// SCOPE CHECKING MIDDLEWARE HELPERS
// =====================================================

/**
 * Check if authenticated API key has specific scope
 * Returns error response if not
 */
export async function requireApiKeyScope(
  req: NextRequest,
  scope: ApiKeyScope
): Promise<{ apiKey: ApiKey } | NextResponse> {
  return requireApiKey(req, [scope]);
}

/**
 * Check if authenticated API key has any of the specified scopes
 */
export async function requireApiKeyAnyScope(
  req: NextRequest,
  scopes: ApiKeyScope[]
): Promise<{ apiKey: ApiKey } | NextResponse> {
  return requireApiKey(req, scopes);
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get team context from authenticated API key
 * Useful for passing to database queries
 * @param req The Next.js request
 * @returns Team slug or null if not authenticated
 */
export async function getTeamFromApiKey(req: NextRequest): Promise<string | null> {
  const authResult = await authenticateApiKey(req);
  return authResult.success ? authResult.apiKey.teamSlug : null;
}

/**
 * Get user context from authenticated API key
 * Useful for audit logging
 * @param req The Next.js request
 * @returns User ID who created the API key or null
 */
export async function getUserFromApiKey(req: NextRequest): Promise<string | null> {
  const authResult = await authenticateApiKey(req);
  return authResult.success ? authResult.apiKey.userId : null;
}
