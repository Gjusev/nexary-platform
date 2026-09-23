/**
 * Liveness Probe API Endpoint
 *
 * Lightweight check to determine if the service is alive.
 * Used by Kubernetes to detect deadlocks or frozen processes.
 */

import { NextResponse } from 'next/server';

/**
 * GET /api/health/live - Liveness check
 */
export async function GET() {
  // Simple liveness check - if we can respond, we're alive
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 }
  );
}
