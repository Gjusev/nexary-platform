import { NextRequest, NextResponse } from 'next/server';
import { SCIMService } from '@/lib/scim/scim-service';

/**
 * GET /api/scim/v2/ServiceProviderConfig
 * Get SCIM Service Provider Configuration (SCIM 2.0 §5)
 *
 * This endpoint returns the SCIM capabilities of the service,
 * including supported operations, authentication schemes, etc.
 *
 * @example
 * GET /api/scim/v2/ServiceProviderConfig
 */
export async function GET(req: NextRequest) {
  try {
    // Extract team slug from query params (for multi-tenant support)
    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug');

    // Get Service Provider Config
    const service = new SCIMService(teamSlug || 'default');
    const config = service.getServiceProviderConfig();

    return NextResponse.json(config);
  } catch (error) {
    console.error('SCIM ServiceProviderConfig GET error:', error);

    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
