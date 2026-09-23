import { NextRequest, NextResponse } from 'next/server';
import { SCIMService } from '@/lib/scim/scim-service';
import {
  requireSCIMAuth,
  validateSCIMContentType,
  scimErrorResponse,
  logSCIMOperation,
} from '@/lib/scim/scim-middleware';
import type { SCIMUser, SCIMPatchOperation } from '@/lib/scim/scim-types';

/**
 * GET /api/scim/v2/Users
 * List users with optional filtering (SCIM 2.0 §3.4.1)
 *
 * Query params:
 * - filter: SCIM filter expression
 * - startIndex: Pagination start index
 * - count: Number of results per page
 *
 * @example
 * GET /api/scim/v2/Users?filter=userName eq "john.doe@example.com"&startIndex=1&count=10
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate SCIM request
    const authResult = await requireSCIMAuth(req);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { teamSlug } = authResult;

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const filter = searchParams.get('filter') || undefined;
    const startIndex = parseInt(searchParams.get('startIndex') || '1', 10);
    const count = parseInt(searchParams.get('count') || '100', 10);

    // List users via SCIM service
    const service = new SCIMService(teamSlug);
    const response = await service.listUsers(filter, startIndex, count);

    return NextResponse.json(response);
  } catch (error) {
    console.error('SCIM Users GET error:', error);
    return scimErrorResponse({
      status: '500',
      scimType: null,
      detail: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * POST /api/scim/v2/Users
 * Create a new user (SCIM 2.0 §3.3)
 *
 * Request body: SCIMUser object
 *
 * @example
 * POST /api/scim/v2/Users
 * {
 *   "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
 *   "userName": "john.doe@example.com",
 *   "name": {
 *     "givenName": "John",
 *     "familyName": "Doe"
 *   },
 *   "displayName": "John Doe",
 *   "active": true
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Validate content type
    if (!validateSCIMContentType(req)) {
      return scimErrorResponse({
        status: '400',
        scimType: 'invalidSyntax',
        detail: 'Content-Type must be application/scim+json or application/json',
      });
    }

    // Authenticate SCIM request
    const authResult = await requireSCIMAuth(req);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { teamSlug } = authResult;

    // Parse request body
    const body: SCIMUser = await req.json();

    // Validate required fields
    if (!body.userName) {
      return scimErrorResponse({
        status: '400',
        scimType: 'invalidSyntax',
        detail: 'userName is required',
      });
    }

    // Create user via SCIM service
    const service = new SCIMService(teamSlug);
    const user = await service.createUser(body);

    // Log successful operation
    await logSCIMOperation({
      teamSlug,
      operation: 'create',
      resourceType: 'User',
      resourceId: user.id,
      scimId: user.userName,
      status: 'success',
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('SCIM Users POST error:', error);

    // Log failed operation
    const teamSlug = req.headers.get('x-team-slug') || 'unknown';
    await logSCIMOperation({
      teamSlug,
      operation: 'create',
      resourceType: 'User',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return scimErrorResponse({
      status: '500',
      scimType: null,
      detail: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
