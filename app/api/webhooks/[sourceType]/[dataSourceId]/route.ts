/**
 * Webhook API
 *
 * POST /api/webhooks/[sourceType]/[dataSourceId] - Handle incoming webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook, handleUrlVerification } from '@/lib/sync/webhook-handler';

type RouteContext = {
  params: Promise<{ sourceType: string; dataSourceId: string }>;
};

/**
 * POST /api/webhooks/[sourceType]/[dataSourceId]
 * Handle incoming webhooks from external sources
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sourceType, dataSourceId } = await context.params;

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get signature from headers
    const signature = request.headers.get('x-signature') ||
                     request.headers.get('x-hub-signature-256') ||
                     request.headers.get('x-hub-signature') ||
                     undefined;

    // Handle URL verification for some sources
    try {
      const payload = JSON.parse(rawBody);
      const verificationToken = handleUrlVerification(sourceType, payload);

      if (verificationToken) {
        return new NextResponse(verificationToken, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    } catch {
      // Not a verification request, continue with webhook handling
    }

    // Handle webhook
    const result = await handleWebhook(
      sourceType,
      dataSourceId,
      rawBody,
      signature
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        syncJobId: result.syncJobId,
        documentProcessed: result.documentProcessed
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Webhook API] Error handling webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to handle webhook' },
      { status: 500 }
    );
  }
}
