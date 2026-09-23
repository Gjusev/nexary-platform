import { NextRequest, NextResponse } from 'next/server';
import { SCIMService } from '@/lib/scim/scim-service';
import {
  requireSCIMAuth,
  scimErrorResponse,
} from '@/lib/scim/scim-middleware';
import type { SCIMGroup } from '@/lib/scim/scim-types';

/**
 * GET /api/scim/v2/Groups
 * List groups with optional filtering (SCIM 2.0 §3.4.1)
 *
 * Query params:
 * - filter: SCIM filter expression
 * - startIndex: Pagination start index
 * - count: Number of results per page
 *
 * @example
 * GET /api/scim/v2/Groups?startIndex=1&count=10
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

    // List groups via SCIM service
    const service = new SCIMService(teamSlug);
    const response = await service.listGroups(filter, startIndex, count);

    return NextResponse.json(response);
  } catch (error) {
    console.error('SCIM Groups GET error:', error);
    return scimErrorResponse({
      status: '500',
      scimType: null,
      detail: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
