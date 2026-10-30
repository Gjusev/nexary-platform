/**
 * Conformal abstention — decision log
 *
 * Every gate decision (answer, clarify, abstain) is persisted so that:
 * - abstentions are visible and auditable (Behörden requirement),
 * - the (support, verdict) pairs accumulate into a calibration set.
 *
 * Two sinks:
 * 1. projectnexus.audit_logs via the existing audit logger (action:
 *    "RAG_ABSTENTION_GATE")
 * 2. one structured console line, which the SYSLOG export pipeline already
 *    picks up.
 *
 * Logging failures must never break a query — same contract as
 * lib/audit/audit-logger.ts.
 */

import { logAuditEvent } from '@/lib/audit/audit-logger';
import type { GateOutcome } from './gate';
import type { SupportScore } from './support';

export interface AbstentionLogEntry {
  outcome: GateOutcome;
  support: SupportScore;
  decision: 'answer' | 'clarify' | 'abstain';
  enforced: boolean;
  /** Target risk alpha the threshold was calibrated/selected for. */
  alpha?: number;
  teamSlug?: string;
  userId?: string;
  conversationId?: string;
  packageIds?: string[];
  targetLanguageCode?: string;
  /**
   * Why this row exists outside the normal evaluateRagGate path — e.g.
   * 'gate_error' for the fail-closed fallback a chat route persists when the
   * gate itself throws. Lets auditors distinguish fallback abstains from
   * scored ones.
   */
  fallback?: string;
}

export async function logGateDecision(entry: AbstentionLogEntry): Promise<void> {
  // No query text here — not even truncated. audit_logs carries longer
  // retention and broader auditor access than chat content, so raw user
  // queries (personal data) must not land in its metadata (data minimization).
  const metadata = {
    decision: entry.decision,
    enforced: entry.enforced,
    supportScore: round3(entry.support.score),
    supportTop: round3(entry.support.top),
    supportRank: round3(entry.support.rank),
    supportLexical: round3(entry.support.lexical),
    candidates: entry.support.candidates,
    threshold: round3(entry.outcome.threshold),
    thresholdSource: entry.outcome.thresholdSource,
    alpha: entry.alpha !== undefined ? round3(entry.alpha) : undefined,
    clarifyBand: round3(entry.outcome.clarifyBand),
    conversationId: entry.conversationId,
    packageIds: entry.packageIds,
    targetLanguageCode: entry.targetLanguageCode,
    ...(entry.fallback ? { fallback: entry.fallback } : {}),
  };

  // Structured line for the SYSLOG pipeline.
  console.log(
    `[Abstention Gate] ${JSON.stringify({
      action: 'RAG_ABSTENTION_GATE',
      decision: entry.decision,
      enforced: entry.enforced,
      support: round3(entry.support.score),
      threshold: round3(entry.outcome.threshold),
      thresholdSource: entry.outcome.thresholdSource,
      teamSlug: entry.teamSlug,
      conversationId: entry.conversationId,
      ...(entry.fallback ? { fallback: entry.fallback } : {}),
    })}`,
  );

  try {
    await logAuditEvent({
      action: 'RAG_ABSTENTION_GATE',
      userId: entry.userId,
      teamSlug: entry.teamSlug,
      targetType: 'rag_query',
      targetId: entry.conversationId,
      metadata,
    });
  } catch (error) {
    console.error('[Abstention Gate] Failed to persist gate decision:', error);
  }
}

function round3(n: number): number {
  return Math.round(Number(n) * 1000) / 1000;
}
