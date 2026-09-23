import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import {
  createGDPRRequest,
  getUserGDPRRequests,
  getGDPRRequest,
  processGDPRRequest,
} from '@/lib/gdpr/gdpr-service';
import { isGlobalAdmin } from '@/lib/permissions';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

/**
 * GET /api/gdpr/requests
 * List user's GDPR requests (or all for admins)
 */
export async function GET(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const requestId = req.nextUrl.searchParams.get('id');

    // If specific request ID is requested
    if (requestId) {
      // Users can only view their own requests
      const request = await getGDPRRequest(requestId);

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (request.userId !== user.id && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json({ request });
    }

    // List requests
    let requests;
    if (isAdmin) {
      // Admins can see all pending requests
      // For simplicity, just return user's own requests for now
      requests = await getUserGDPRRequests(user.id);
    } else {
      requests = await getUserGDPRRequests(user.id);
    }

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('GDPR requests GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gdpr/requests
 * Create a new GDPR data request
 *
 * Body: {
 *   requestType: 'access' | 'erasure' | 'portability'
 * }
 */
export async function POST(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { requestType } = body;

    if (!requestType) {
      return NextResponse.json(
        { error: 'requestType is required' },
        { status: 400 }
      );
    }

    const validTypes = ['access', 'erasure', 'portability'];

    if (!validTypes.includes(requestType)) {
      return NextResponse.json(
        { error: `Invalid requestType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create the request
    const gdprRequest = await createGDPRRequest(user.id, requestType);

    return NextResponse.json({
      request: gdprRequest,
      message: 'GDPR request created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('GDPR requests POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/gdpr/requests
 * Process GDPR request (admin only)
 *
 * Body: {
 *   requestId: string,
 *   status: 'completed' | 'rejected',
 *   rejectionReason?: string
 * }
 */
export async function PATCH(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = await isGlobalAdmin(user.id);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can process GDPR requests' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { requestId, status, rejectionReason } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'requestId and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['completed', 'rejected'];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    if (status === 'rejected' && !rejectionReason) {
      return NextResponse.json(
        { error: 'rejectionReason is required when rejecting a request' },
        { status: 400 }
      );
    }

    // Process the request
    await processGDPRRequest(requestId, status, rejectionReason);

    return NextResponse.json({
      success: true,
      message: `Request ${status} successfully`,
    });
  } catch (error) {
    console.error('GDPR requests PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
