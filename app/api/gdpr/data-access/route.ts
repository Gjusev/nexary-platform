import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { exportUserData } from '@/lib/gdpr/gdpr-service';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

/**
 * GET /api/gdpr/data-access
 * GDPR Article 15: Right of Access
 *
 * Returns all personal data held about the requesting user.
 */
export async function GET(req: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkApiRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Export user data
    const userData = await exportUserData(user.id);

    // Log the access request for audit trail
    await logAuditEvent({
      action: 'GDPR_DATA_ACCESS',
      userId: user.id,
      metadata: {
        requestedBy: user.id,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json(userData);
  } catch (error) {
    console.error('GDPR data access error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
