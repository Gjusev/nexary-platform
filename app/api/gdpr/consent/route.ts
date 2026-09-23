import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import {
  getUserConsents,
  recordConsent,
  withdrawConsent,
  hasConsent,
  type ConsentType,
} from '@/lib/gdpr/gdpr-service';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

/**
 * GET /api/gdpr/consent
 * Get user's current consent status
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

    const consents = await getUserConsents(user.id);

    return NextResponse.json({ consents });
  } catch (error) {
    console.error('GDPR consent GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gdpr/consent
 * Record or update user consent
 *
 * Body: {
 *   consentType: 'marketing' | 'analytics' | 'cookies' | 'third_party_sharing' | 'email_communications',
 *   granted: boolean
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
    const { consentType, granted } = body;

    if (!consentType || typeof granted !== 'boolean') {
      return NextResponse.json(
        { error: 'consentType and granted (boolean) are required' },
        { status: 400 }
      );
    }

    const validConsentTypes: ConsentType[] = [
      'marketing',
      'analytics',
      'cookies',
      'third_party_sharing',
      'email_communications',
    ];

    if (!validConsentTypes.includes(consentType)) {
      return NextResponse.json(
        { error: `Invalid consentType. Must be one of: ${validConsentTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get IP address and user agent
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                      req.headers.get('x-real-ip') ||
                      null;
    const userAgent = req.headers.get('user-agent') || null;

    // Record consent
    await recordConsent({
      userId: user.id,
      consentType,
      granted,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: granted ? 'Consent recorded' : 'Consent refusal recorded',
    });
  } catch (error) {
    console.error('GDPR consent POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/gdpr/consent
 * Withdraw existing consent
 *
 * Body: {
 *   consentType: 'marketing' | 'analytics' | 'cookies' | 'third_party_sharing' | 'email_communications'
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

    const body = await req.json();
    const { consentType } = body;

    if (!consentType) {
      return NextResponse.json(
        { error: 'consentType is required' },
        { status: 400 }
      );
    }

    const validConsentTypes: ConsentType[] = [
      'marketing',
      'analytics',
      'cookies',
      'third_party_sharing',
      'email_communications',
    ];

    if (!validConsentTypes.includes(consentType)) {
      return NextResponse.json(
        { error: `Invalid consentType. Must be one of: ${validConsentTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get IP address
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                      req.headers.get('x-real-ip') ||
                      undefined;

    // Withdraw consent
    await withdrawConsent(user.id, consentType, ipAddress);

    return NextResponse.json({
      success: true,
      message: 'Consent withdrawn',
    });
  } catch (error) {
    console.error('GDPR consent PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
