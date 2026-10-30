/**
 * Conformal abstention — configuration
 *
 * "No answer without recoverable support."
 *
 * The gate is configured through environment variables so a deployment can
 * tune the reliability/availability trade-off without code changes:
 *
 * - RAG_ABSTENTION_ENABLED   master switch (default: "true")
 * - RAG_ABSTENTION_MODE      "enforce" (replace generation with the
 *                            deterministic abstention/clarification template)
 *                            or "annotate" (only annotate + log; default:
 *                            "enforce")
 * - RAG_ABSTENTION_ALPHA     target risk of an unsupported answer slipping
 *                            through the gate, 0 < alpha < 1 (default: "0.1").
 *                            Lower alpha = stricter = more abstentions.
 * - RAG_ABSTENTION_THRESHOLD explicit answer threshold override in [0,1].
 *                            When set, it wins over calibration. Use this to
 *                            pin a reviewed threshold in production.
 * - RAG_ABSTENTION_CLARIFY_BAND width of the "clarify" band below the answer
 *                            threshold (default: "0.08")
 * - RAG_ABSTENTION_CALIBRATION_FILE optional path to a JSONL file with
 *                            {"support": number, "supported": boolean} lines
 *                            used to calibrate the answer threshold at boot.
 */

export type AbstentionMode = 'enforce' | 'annotate';

export interface AbstentionConfig {
  enabled: boolean;
  mode: AbstentionMode;
  /** Target risk alpha: P(unsupported | gate answered) budget. */
  alpha: number;
  /** Explicit threshold override; null when not configured. */
  thresholdOverride: number | null;
  /** Width of the clarify band below the answer threshold. */
  clarifyBand: number;
  /** Optional JSONL calibration file path. */
  calibrationFile: string | null;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  const v = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveAbstentionConfig(env: NodeJS.ProcessEnv = process.env): AbstentionConfig {
  const alphaRaw = parseNumber(env.RAG_ABSTENTION_ALPHA);
  const alpha = alphaRaw !== null && alphaRaw > 0 && alphaRaw < 1 ? alphaRaw : 0.1;

  const thresholdOverrideRaw = parseNumber(env.RAG_ABSTENTION_THRESHOLD);
  const thresholdOverride =
    thresholdOverrideRaw !== null && thresholdOverrideRaw >= 0 && thresholdOverrideRaw <= 1
      ? thresholdOverrideRaw
      : null;

  const clarifyBandRaw = parseNumber(env.RAG_ABSTENTION_CLARIFY_BAND);
  const clarifyBand =
    clarifyBandRaw !== null && clarifyBandRaw >= 0 && clarifyBandRaw <= 1 ? clarifyBandRaw : 0.08;

  const modeRaw = (env.RAG_ABSTENTION_MODE || '').trim().toLowerCase();

  return {
    enabled: parseBool(env.RAG_ABSTENTION_ENABLED, true),
    mode: modeRaw === 'annotate' ? 'annotate' : 'enforce',
    alpha,
    thresholdOverride,
    clarifyBand,
    calibrationFile: env.RAG_ABSTENTION_CALIBRATION_FILE?.trim() || null,
  };
}
