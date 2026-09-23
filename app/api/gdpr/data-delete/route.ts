import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { canEraseUserData, anonymizeUserData } from '@/lib/gdpr/gdpr-service';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

/**
 * DELETE /api/gdpr/data-delete
 * GDPR Article 17: Right to Erasure (Right to be Forgotten)
 *
 * Requests erasure of personal data.
 * Note: Complete deletion may not be possible due to legal requirements.
 */
export async function DELETE(req: NextRequest) {
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

    // Check if data can be erased
    const check = await canEraseUserData(user.id);

    if (!check.canErase) {
      await logAuditEvent({
        action: 'GDPR_ERASURE_DENIED',
        userId: user.id,
        metadata: {
          reasons: check.reasons,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json(
        {
          error: 'Data cannot be erased',
          reasons: check.reasons,
        },
        { status: 400 }
      );
    }

    // Perform erasure
    const result = await anonymizeUserData(user.id, 'user_request');

    // Log the erasure
    await logAuditEvent({
      action: 'GDPR_DATA_ERASURE',
      userId: user.id,
      metadata: {
        deleted: result.deleted,
        anonymized: result.anonymized,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      message: 'Data erasure initiated',
      deleted: result.deleted,
      anonymized: result.anonymized,
      note: 'Some data may be retained for legal or security purposes in anonymized form.',
    });
  } catch (error) {
    console.error('GDPR data deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gdpr/data-delete
 * Check if user data can be erased (pre-flight check)
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

    // Check if data can be erased
    const check = await canEraseUserData(user.id);

    return NextResponse.json({
      canErase: check.canErase,
      reasons: check.reasons,
    });
  } catch (error) {
    console.error('GDPR erasure check error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
