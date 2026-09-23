/**
 * Readiness Probe API Endpoint
 *
 * Lightweight check to determine if the service is ready to accept traffic.
 * Used by Kubernetes and orchestration systems for startup probes.
 */

import { NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/monitoring/structured-logger';

/**
 * GET /api/health/ready - Readiness check
 */
export async function GET() {
  const logger = structuredLogger.child({ component: 'readiness_check' });

  try {
    // Check critical dependencies
    const isReady = await checkReadiness();

    if (isReady) {
      logger.info('Service is ready');

      return NextResponse.json(
        {
          status: 'ready',
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    logger.warn('Service is not ready');

    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  } catch (error) {
    logger.error('Readiness check failed', error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

/**
 * Check if service is ready
 */
async function checkReadiness(): Promise<boolean> {
  try {
    // Check database connection (most critical)
    const { query } = await import('@/lib/db');
    await query('SELECT 1');

    // Additional readiness checks can be added here
    // For example: check if migrations are run, check config loaded, etc.

    return true;
  } catch {
    return false;
  }
}
