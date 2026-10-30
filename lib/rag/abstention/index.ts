/**
 * Conformal abstention — entry point
 *
 * evaluateRagGate() is the single call site for the RAG query API and both
 * chat routes:
 *
 *   const gate = await evaluateRagGate({
 *     query: content,
 *     results,                    // RetrievedChunk[] from the RAG pipeline
 *     teamSlug, userId, conversationId, packageIds, targetLanguageCode,
 *   });
 *
 * It never throws and always returns a decision:
 * - disabled gate          -> { decision: 'answer', gateEnabled: false }
 * - retrieval error / empty-> abstain (fail-closed)
 * - otherwise              -> support score + tripartite decision, logged.
 *
 * Threshold provenance (override > calibration file > prior) travels in the
 * response so operators can see whether the deployment is actually calibrated.
 */

import { readFile } from 'fs/promises';
import { resolveAbstentionConfig, type AbstentionConfig } from './config';
import { calibrateThreshold, type CalibrationExample } from './conformal';
import { gateTemplate, resolveGate, type GateOutcome } from './gate';
import { computeSupportScore, type SupportInput, type SupportScore } from './support';
import { logGateDecision } from './log';

export { resolveAbstentionConfig } from './config';
export { calibrateThreshold, conformalQuantile, MIN_SUPPORTED_SAMPLES } from './conformal';
export type { CalibrationExample, CalibrationResult } from './conformal';
export { computeSupportScore } from './support';
export type { SupportInput, SupportScore } from './support';
export { DEFAULT_PRIOR_THRESHOLD, gateTemplate, resolveGate } from './gate';
export type { GateDecision, GateOutcome, ThresholdSource } from './gate';
export { logGateDecision } from './log';
export type { AbstentionLogEntry } from './log';
export {
  servesInternalChatEnrichment,
  internalEnrichmentHeaders,
  SECRET_HEADER as INTERNAL_ENRICHMENT_SECRET_HEADER,
  type InternalRequestLike,
} from './internal-enrichment';

export interface GateContext {
  query: string;
  results: SupportInput['results'];
  teamSlug?: string;
  userId?: string;
  conversationId?: string;
  packageIds?: string[];
  targetLanguageCode?: string;
  /** Skip audit persistence (used by status/health checks). */
  skipLog?: boolean;
}

export interface GateResult {
  gateEnabled: boolean;
  enforce: boolean;
  decision: 'answer' | 'clarify' | 'abstain';
  support: SupportScore;
  outcome: GateOutcome;
  /** Deterministic template for clarify/abstain (undefined for answer). */
  template?: string;
}

export async function evaluateRagGate(ctx: GateContext): Promise<GateResult> {
  const config: AbstentionConfig = resolveAbstentionConfig();
  const support = computeSupportScore({ query: ctx.query, results: ctx.results });

  if (!config.enabled) {
    // Gate disabled: behave exactly like before — nothing is enforced and
    // nothing is logged. The support score is still computed and returned so
    // callers can annotate their responses without a code change.
    const outcome = resolveGate({ config, support: support.score, calibratedThreshold: null });
    return { gateEnabled: false, enforce: false, decision: 'answer', support, outcome };
  }

  let calibratedThreshold: number | null = null;
  if (config.calibrationFile) {
    try {
      const examples = await loadCalibrationFile(config.calibrationFile);
      const calibration = calibrateThreshold(examples, config.alpha);
      calibratedThreshold = calibration.threshold;
    } catch (error) {
      console.warn('[Abstention Gate] Calibration file unreadable, falling back to prior:', error);
    }
  }

  const outcome = resolveGate({ config, support: support.score, calibratedThreshold });
  const enforce = config.mode === 'enforce';

  let template: string | undefined;
  if (outcome.decision !== 'answer') {
    // Filename may sit at the top level (legacy shapes) or under metadata
    // (/api/rag/query route shape: { score, content, metadata: { filename } }).
    const sources = (ctx.results || []).map((r) => ({
      filename:
        (r as { filename?: string })?.filename ??
        (r as { metadata?: { filename?: string } })?.metadata?.filename,
    }));
    template = gateTemplate({
      decision: outcome.decision,
      query: ctx.query,
      sources,
      targetLanguageCode: ctx.targetLanguageCode,
    });
  }

  if (!ctx.skipLog) {
    await logGateDecision({
      outcome,
      support,
      decision: outcome.decision,
      enforced: enforce && outcome.decision !== 'answer',
      alpha: config.alpha,
      teamSlug: ctx.teamSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      packageIds: ctx.packageIds,
      targetLanguageCode: ctx.targetLanguageCode,
    });
  }

  return { gateEnabled: true, enforce, decision: outcome.decision, support, outcome, template };
}

export async function loadCalibrationFile(path: string): Promise<CalibrationExample[]> {
  const raw = await readFile(path, 'utf8');
  const examples: CalibrationExample[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      examples.push({ support: Number(parsed.support), supported: !!parsed.supported });
    } catch {
      // Skip malformed lines; calibration tolerates partial files.
    }
  }
  return examples;
}
