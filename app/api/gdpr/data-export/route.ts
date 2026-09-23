import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { exportPortableData } from '@/lib/gdpr/gdpr-service';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

/**
 * GET /api/gdpr/data-export?format=json|csv
 * GDPR Article 20: Right to Data Portability
 *
 * Exports user data in a portable, machine-readable format.
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

    const format = req.nextUrl.searchParams.get('format') || 'json';

    // Export portable data
    const { json, csv } = await exportPortableData(user.id);

    // Log the portability request
    await logAuditEvent({
      action: 'GDPR_DATA_PORTABILITY',
      userId: user.id,
      metadata: {
        format,
        timestamp: new Date().toISOString(),
      },
    });

    // Return based on format
    if (format === 'csv' && csv) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="gdpr-export-${user.id}-${dateStr}.csv"`,
        },
      });
    }

    // Default to JSON
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gdpr-export-${user.id}-${dateStr}.json"`,
      },
    });
  } catch (error) {
    console.error('GDPR data export error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
