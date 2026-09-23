import { NextRequest, NextResponse } from 'next/server';
import { SCIMService } from '@/lib/scim/scim-service';
import {
  requireSCIMAuth,
  scimErrorResponse,
} from '@/lib/scim/scim-middleware';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/scim/v2/Groups/{id}
 * Get a specific group (SCIM 2.0 §3.4.1)
 *
 * @example
 * GET /api/scim/v2/Groups/my-team-slug
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

    // Get group via SCIM service
    const service = new SCIMService(teamSlug);
    const group = await service.getGroup(id);

    if (!group) {
      return scimErrorResponse({
        status: '404',
        scimType: 'invalidValue',
        detail: `Group ${id} not found`,
      });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('SCIM Group GET error:', error);
    return scimErrorResponse({
      status: '500',
      scimType: null,
      detail: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
