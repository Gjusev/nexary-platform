/**
 * Cache invalidation by pattern API endpoint.
 *
 * DELETE /api/admin/cache/pattern - Delete cache by pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheService } from '@/lib/cache/cache-service';
import { isGlobalAdmin } from '@/lib/permissions';

/**
 * DELETE /api/admin/cache/pattern - Delete cache by pattern
 */
export async function DELETE(req: NextRequest) {
  try {
    // Check admin permissions
    const userId = req.headers.get('x-user-id');
    if (!userId || !(await isGlobalAdmin(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const pattern = searchParams.get('pattern');

    if (!pattern) {
      return NextResponse.json({ error: 'pattern is required' }, { status: 400 });
    }

    await cacheService.invalidateByPattern(pattern);

    return NextResponse.json({
      success: true,
      message: `Cache deleted for pattern: ${pattern}`,
    });
  } catch (error) {
    console.error('Cache pattern delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete cache by pattern', message: (error as Error).message },
      { status: 500 }
    );
  }
}
