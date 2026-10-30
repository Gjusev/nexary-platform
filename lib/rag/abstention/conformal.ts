/**
 * Conformal abstention — split-conformal calibration
 *
 * Follows the conformal factuality filtering of arXiv 2610.34872 ("Adaptive
 * Retrieval, Selective Answers", split-conformal variant) reduced to our
 * setting: calibration pairs (support score, label) where label = the answer
 * was verifiably supported by the retrieved evidence (human feedback or an
 * evaluation set). The calibrated threshold is the finite-sample conformal
 * quantile of the supported class:
 *
 *   tau = order-statistic_ceil((n+1)(1-alpha)) of {s_i : label_i = supported}
 *
 * Guarantee (under exchangeability): P(answered answer is supported) >= 1-alpha.
 * The price is availability: queries below tau abstain.
 *
 * Edge cases are deliberately conservative:
 * - too few supported calibration points -> null (caller falls back to the
 *   configured prior threshold instead of pretending a guarantee exists)
 * - sample size too small for the requested alpha -> null (the rank exceeds
 *   n; returning the minimum observed score would under-cover)
 * - alpha in (0,1) required
 */

export interface CalibrationExample {
  support: number;
  supported: boolean;
}

export interface CalibrationResult {
  /** Calibrated threshold in [0,1], or null when the calibration set is too weak. */
  threshold: number | null;
  /** Number of supported examples actually used. */
  supportedCount: number;
  /** Total examples considered. */
  totalCount: number;
  /** Why no threshold was produced (when threshold is null). */
  reason?: 'no_supported_examples' | 'insufficient_sample';
}

/**
 * Minimum number of supported examples before a quantile is meaningful.
 * Note: the conformal rank is ceil((n+1)(1-alpha)), so at the default
 * alpha of 0.1 a calibrated threshold needs at least 9 supported examples;
 * below that calibrateThreshold() returns null and callers fall back to
 * the prior threshold.
 */
export const MIN_SUPPORTED_SAMPLES = 8;

/**
 * Finite-sample conformal quantile: the ceil((n+1)(1-alpha))-th smallest
 * supported score. Returns null when there is no calibration data, alpha is
 * out of range, or alpha demands a rank beyond the sample size (no observed
 * order statistic can keep the 1-alpha guarantee then — the caller falls
 * back to the prior threshold instead of under-covering).
 */
export function conformalQuantile(sortedScores: number[], alpha: number): number | null {
  const n = sortedScores.length;
  if (n === 0) return null;
  if (!(alpha > 0 && alpha < 1)) return null;

  const rank = Math.ceil((n + 1) * (1 - alpha));
  if (rank > n) {
    // Alpha too small for this sample size. The minimum observed score would
    // under-cover (below 1-alpha), so the honest answer is no threshold.
    return null;
  }
  return clamp01(sortedScores[rank - 1]);
}

export function calibrateThreshold(
  examples: CalibrationExample[],
  alpha: number,
): CalibrationResult {
  const valid = (Array.isArray(examples) ? examples : []).filter(
    (e) => e && Number.isFinite(Number(e.support)),
  );
  const supported = valid
    .filter((e) => !!e.supported)
    .map((e) => Number(e.support))
    .sort((a, b) => a - b);

  if (supported.length === 0) {
    return { threshold: null, supportedCount: 0, totalCount: valid.length, reason: 'no_supported_examples' };
  }
  if (supported.length < MIN_SUPPORTED_SAMPLES) {
    return { threshold: null, supportedCount: supported.length, totalCount: valid.length, reason: 'insufficient_sample' };
  }

  const threshold = conformalQuantile(supported, alpha);
  if (threshold === null) {
    // Enough rows, but alpha needs a rank beyond the sample size — too few
    // supported points for this alpha to keep its coverage guarantee.
    return { threshold: null, supportedCount: supported.length, totalCount: valid.length, reason: 'insufficient_sample' };
  }
  return {
    threshold: clamp01(threshold),
    supportedCount: supported.length,
    totalCount: valid.length,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
