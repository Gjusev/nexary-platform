import { NextRequest, NextResponse } from 'next/server';
import { SCIMService } from '@/lib/scim/scim-service';
import {
  requireSCIMAuth,
  validateSCIMContentType,
  scimErrorResponse,
  logSCIMOperation,
} from '@/lib/scim/scim-middleware';
import type { SCIMUser, SCIMPatchOperation } from '@/lib/scim/scim-types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/scim/v2/Users/{id}
 * Get a specific user (SCIM 2.0 §3.4.1)
 *
 * @example
 * GET /api/scim/v2/Users/abc123
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Authenticate SCIM request
    const authResult = await requireSCIMAuth(req);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { teamSlug } = authResult;

    // Get user via SCIM service
    const service = new SCIMService(teamSlug);
    const user = await service.getUser(id);

    if (!user) {
      return scimErrorResponse({
        status: '404',
        scimType: 'invalidValue',
        detail: `User ${id} not found`,
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('SCIM User GET error:', error);
    return scimErrorResponse({
      status: '500',
      scimType: null,
      detail: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * PUT /api/scim/v2/Users/{id}
 * Replace a user (SCIM 2.0 §3.5.1)
 *
 * Request body: Complete SCIMUser object
 *
 * @example
 * PUT /api/scim/v2/Users/abc123
 * {
 *   "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
 *   "id": "abc123",
 *   "userName": "john.doe@example.com",
 *   "displayName": "John Doe"
 * }
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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

    // Update user via SCIM service
    const service = new SCIMService(teamSlug);
    const user = await service.updateUser(id, body);

    // Log successful operation
    await logSCIMOperation({
      teamSlug,
      operation: 'update',
      resourceType: 'User',
      resourceId: id,
      scimId: user.userName,
      status: 'success',
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('SCIM User PUT error:', error);

    // Log failed operation
    const teamSlug = req.headers.get('x-team-slug') || 'unknown';
    await logSCIMOperation({
      teamSlug,
      operation: 'update',
      resourceType: 'User',
      resourceId: (await context.params).id,
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

/**
 * PATCH /api/scim/v2/Users/{id}
 * Partially update a user (SCIM 2.0 §3.5.2)
 *
 * Request body: Array of patch operations
 *
 * @example
 * PATCH /api/scim/v2/Users/abc123
 * {
 *   "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
 *   "Operations": [
 *     {
 *       "op": "replace",
 *       "path": "displayName",
 *       "value": "John Updated Doe"
 *     }
 *   ]
 * }
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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
    const body = await req.json();
    const operations: SCIMPatchOperation[] = body.Operations || body.operations || [];

    if (!Array.isArray(operations) || operations.length === 0) {
      return scimErrorResponse({
        status: '400',
        scimType: 'invalidSyntax',
        detail: 'Operations array is required',
      });
    }

    // Apply patch operations via SCIM service
    const service = new SCIMService(teamSlug);
    const user = await service.patchUser(id, operations);

    // Log successful operation
    await logSCIMOperation({
      teamSlug,
      operation: 'patch',
      resourceType: 'User',
      resourceId: id,
      scimId: user.userName,
      status: 'success',
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('SCIM User PATCH error:', error);

    // Log failed operation
    const teamSlug = req.headers.get('x-team-slug') || 'unknown';
    await logSCIMOperation({
      teamSlug,
      operation: 'patch',
      resourceType: 'User',
      resourceId: (await context.params).id,
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

/**
 * DELETE /api/scim/v2/Users/{id}
 * Delete a user (SCIM 2.0 §3.6)
 *
 * Note: This performs a soft delete/deactivation
 *
 * @example
 * DELETE /api/scim/v2/Users/abc123
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Authenticate SCIM request
    const authResult = await requireSCIMAuth(req);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { teamSlug } = authResult;

    // Delete user via SCIM service
    const service = new SCIMService(teamSlug);
    await service.deleteUser(id);

    // Log successful operation
    await logSCIMOperation({
      teamSlug,
      operation: 'delete',
      resourceType: 'User',
      resourceId: id,
      status: 'success',
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('SCIM User DELETE error:', error);

    // Log failed operation
    const teamSlug = req.headers.get('x-team-slug') || 'unknown';
    await logSCIMOperation({
      teamSlug,
      operation: 'delete',
      resourceType: 'User',
      resourceId: (await context.params).id,
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
