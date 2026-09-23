/**
 * Cache management API endpoints.
 *
 * GET /api/admin/cache - Get cache statistics
 * DELETE /api/admin/cache - Clear all cache
 * POST /api/admin/cache/warmup - Warm up cache for a team
 * DELETE /api/admin/cache/pattern - Delete cache by pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheService } from '@/lib/cache/cache-service';
import { warmupCache } from '@/lib/cache/cache-service';
import { isGlobalAdmin } from '@/lib/permissions';

/**
 * GET /api/admin/cache - Get cache statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin permissions
    const userId = req.headers.get('x-user-id');
    if (!userId || !(await isGlobalAdmin(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await cacheService.getStats();

    return NextResponse.json({
      success: true,
      stats: {
        localCacheSize: stats.localCacheSize,
        redisAvailable: stats.redisAvailable,
      },
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache statistics', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cache - Clear all cache (use with caution!)
 */
export async function DELETE(req: NextRequest) {
  try {
    // Check admin permissions
    const userId = req.headers.get('x-user-id');
    if (!userId || !(await isGlobalAdmin(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Require confirmation for safety
    const { searchParams } = new URL(req.url);
    const confirm = searchParams.get('confirm');

    if (confirm !== 'yes-i-am-sure') {
      return NextResponse.json(
        { error: 'Confirmation required. Add ?confirm=yes-i-am-sure to proceed.' },
        { status: 400 }
      );
    }

    await cacheService.clear();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cache/warmup - Warm up cache for a team
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin permissions
    const userId = req.headers.get('x-user-id');
    if (!userId || !(await isGlobalAdmin(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { teamSlug } = body;

    if (!teamSlug) {
      return NextResponse.json({ error: 'teamSlug is required' }, { status: 400 });
    }

    await warmupCache(teamSlug);

    return NextResponse.json({
      success: true,
      message: `Cache warmed up for team: ${teamSlug}`,
    });
  } catch (error) {
    console.error('Cache warmup error:', error);
    return NextResponse.json(
      { error: 'Failed to warm up cache', message: (error as Error).message },
      { status: 500 }
    );
  }
}
