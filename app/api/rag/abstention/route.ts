import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import {
  calibrateThreshold,
  DEFAULT_PRIOR_THRESHOLD,
  loadCalibrationFile,
  resolveAbstentionConfig,
} from '@/lib/rag/abstention';
import type { CalibrationExample } from '@/lib/rag/abstention';
import { isGlobalAdmin } from '@/lib/permissions';
import { checkAdminRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/** Upper bound for POST dry-run calibration sets (in-memory sort guard). */
const MAX_EXAMPLES = 10_000;

/**
 * Shared guard: rate limit + authentication + global-admin authorization
 * (same convention as app/api/admin/*). Returns the authenticated user or a
 * NextResponse to forward.
 */
async function requireGlobalAdmin(request: NextRequest) {
  const rateLimitResponse = checkAdminRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isGlobalAdmin(user.id))) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Requires global-admin role' },
      { status: 403 },
    );
  }

  return user;
}

/**
 * GET /api/rag/abstention
 *
 * Operator view of the conformal abstention gate: active configuration and
 * where the current answer threshold comes from (override > calibration
 * file > prior). No secrets, read-only, global-admin only.
 */
export async function GET(request: NextRequest) {
  const guard = await requireGlobalAdmin(request);
  if (guard instanceof NextResponse) {
    return guard;
  }

  const config = resolveAbstentionConfig();

  let calibration: { threshold: number | null; supportedCount: number; totalCount: number; reason?: string } | null = null;
  if (config.calibrationFile) {
    try {
      const examples = await loadCalibrationFile(config.calibrationFile);
      calibration = calibrateThreshold(examples, config.alpha);
    } catch (error) {
      // Do not forward filesystem error text to clients — Node fs errors
      // embed the configured server path. Log it, return a stable reason.
      console.warn('[RAG Abstention] Calibration file unreadable:', error);
      calibration = {
        threshold: null,
        supportedCount: 0,
        totalCount: 0,
        reason: 'calibration_file_unreadable',
      };
    }
  }

  const threshold =
    config.thresholdOverride !== null
      ? { value: config.thresholdOverride, source: 'override' as const }
      : calibration?.threshold != null
        ? { value: calibration.threshold, source: 'calibrated' as const }
        : { value: DEFAULT_PRIOR_THRESHOLD, source: 'prior' as const };

  return NextResponse.json({
    success: true,
    abstention: {
      enabled: config.enabled,
      mode: config.mode,
      alpha: config.alpha,
      clarifyBand: config.clarifyBand,
      threshold,
      calibration: calibration
        ? {
            supportedCount: calibration.supportedCount,
            totalCount: calibration.totalCount,
            reason: calibration.reason,
          }
        : null,
    },
  });
}

/**
 * POST /api/rag/abstention
 *
 * Dry-run calibration: computes the conformal threshold for a posted labeled
 * set. Nothing is persisted — the result goes into deployment config via
 * RAG_ABSTENTION_THRESHOLD (override) or RAG_ABSTENTION_CALIBRATION_FILE.
 * Global-admin only, rate limited, examples[] size-capped.
 *
 * Body: { "examples": [{ "support": number, "supported": boolean }, ...] }
 */
export async function POST(request: NextRequest) {
  const guard = await requireGlobalAdmin(request);
  if (guard instanceof NextResponse) {
    return guard;
  }

  let body: { examples?: CalibrationExample[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body?.examples) || body.examples.length === 0) {
    return NextResponse.json(
      { success: false, error: 'examples[] with {support, supported} entries is required' },
      { status: 400 },
    );
  }

  if (body.examples.length > MAX_EXAMPLES) {
    return NextResponse.json(
      { success: false, error: `examples[] exceeds the maximum of ${MAX_EXAMPLES} entries` },
      { status: 413 },
    );
  }

  const alpha = resolveAbstentionConfig().alpha;
  const result = calibrateThreshold(body.examples, alpha);

  return NextResponse.json({
    success: true,
    alpha,
    ...result,
    ...(result.threshold === null
      ? {}
      : {
          hint: 'Pin this value via RAG_ABSTENTION_THRESHOLD or provide it as RAG_ABSTENTION_CALIBRATION_FILE.',
        }),
  });
}
