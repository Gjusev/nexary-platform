/**
 * Conformal abstention — tripartite gate
 *
 * Decision rule after arXiv 2610.36561 ("Governed Sovereign RAG for Public
 * Administration"): answer / clarify / abstain, with deterministic templates
 * instead of free generation for the non-answer outcomes. Templates state the
 * abstention honestly and point to the nearest recoverable support (document
 * names), never to asserted content.
 *
 * Threshold resolution order:
 * 1. explicit override (RAG_ABSTENTION_THRESHOLD) — reviewed in production
 * 2. calibrated threshold from the JSONL calibration file
 * 3. conservative prior (documented heuristic, flagged as `prior`)
 */

import type { AbstentionConfig } from './config';

export type GateDecision = 'answer' | 'clarify' | 'abstain';

export type ThresholdSource = 'override' | 'calibrated' | 'prior';

export interface GateInput {
  config: AbstentionConfig;
  support: number;
  /** Calibrated threshold from the calibration file, when one exists. */
  calibratedThreshold?: number | null;
}

export interface GateOutcome {
  decision: GateDecision;
  threshold: number;
  thresholdSource: ThresholdSource;
  clarifyBand: number;
}

/** Prior answer threshold used only before any calibration exists. */
export const DEFAULT_PRIOR_THRESHOLD = 0.45;

export function resolveGate({
  config,
  support,
  calibratedThreshold,
}: GateInput): GateOutcome {
  let threshold: number;
  let thresholdSource: ThresholdSource;

  if (config.thresholdOverride !== null) {
    threshold = config.thresholdOverride;
    thresholdSource = 'override';
  } else if (typeof calibratedThreshold === 'number' && Number.isFinite(calibratedThreshold)) {
    threshold = Math.min(1, Math.max(0, calibratedThreshold));
    thresholdSource = 'calibrated';
  } else {
    threshold = DEFAULT_PRIOR_THRESHOLD;
    thresholdSource = 'prior';
  }

  const clarifyBand = config.clarifyBand;
  const clarifyFloor = Math.max(0, threshold - clarifyBand);

  let decision: GateDecision;
  if (support >= threshold) {
    decision = 'answer';
  } else if (support >= clarifyFloor) {
    decision = 'clarify';
  } else {
    decision = 'abstain';
  }

  return { decision, threshold, thresholdSource, clarifyBand };
}

export interface GateTemplateInput {
  decision: Exclude<GateDecision, 'answer'>;
  query: string;
  /** Nearest source filenames — pointers only, never quoted content. */
  sources: Array<{ filename?: string }>;
  targetLanguageCode?: string;
}

/**
 * Deterministic template responses for clarify/abstain. German is the product
 * default; en/es are provided so the streaming chat can honor its
 * targetLanguage contract without free-form generation.
 */
export function gateTemplate({
  decision,
  query,
  sources,
  targetLanguageCode = 'de',
}: GateTemplateInput): string {
  const nearest = (sources || [])
    .map((s) => (s?.filename || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const nearestList = nearest.length > 0 ? nearest.map((f) => `- ${f}`).join('\n') : null;
  const lang = (targetLanguageCode || 'de').toLowerCase();

  if (decision === 'abstain') {
    if (lang === 'en') {
      return [
        `I am not answering this question from the linked documents, because the retrieved evidence does not provide sufficient support.`,
        ``,
        `**Found nearest:**`,
        nearestList || `- (no relevant documents)`,
        ``,
        `Please rephrase the question, or upload a document that covers this topic. I do not generate answers without recoverable support.`,
      ].join('\n');
    }
    if (lang === 'es') {
      return [
        `No respondo a esta pregunta a partir de los documentos vinculados: la evidencia recuperada no aporta soporte suficiente.`,
        ``,
        `**Lo más cercano encontrado:**`,
        nearestList || `- (sin documentos relevantes)`,
        ``,
        `Reformula la pregunta o sube un documento que trate el tema. No genero respuestas sin soporte recuperable.`,
      ].join('\n');
    }
    return [
      `Diese Frage beantworte ich aus den verknüpften Dokumenten nicht: Die gefundenen Belege bieten keine ausreichende Unterstützung.`,
      ``,
      `**Am nächsten gefunden:**`,
      nearestList || `- (keine relevanten Dokumente)`,
      ``,
      `Formuliere die Frage bitte um oder lade ein Dokument zu diesem Thema hoch. Ich generiere keine Antworten ohne belegbare Quellen.`,
    ].join('\n');
  }

  // clarify
  if (lang === 'en') {
    return [
      `**Low confidence notice.** The documents only partially support an answer to this question.`,
      ``,
      `**Possibly relevant:**`,
      nearestList || `- (no relevant documents)`,
      ``,
      `Please check the sources above or narrow your question (e.g. "${truncate(query, 120)}").`,
    ].join('\n');
  }
  if (lang === 'es') {
    return [
      `**Aviso de confianza baja.** Los documentos solo soportan parcialmente una respuesta a esta pregunta.`,
      ``,
      `**Posiblemente relevante:**`,
      nearestList || `- (sin documentos relevantes)`,
      ``,
      `Revisa las fuentes de arriba o concreta tu pregunta (p. ej. "${truncate(query, 120)}").`,
    ].join('\n');
  }
  return [
    `**Hinweis: geringe Konfidenz.** Die Dokumente unterstützen eine Antwort auf diese Frage nur teilweise.`,
    ``,
    `**Möglicherweise relevant:**`,
    nearestList || `- (keine relevanten Dokumente)`,
    ``,
    `Prüfe die obigen Quellen oder grenze die Frage ein (z. B. "${truncate(query, 120)}").`,
  ].join('\n');
}

function truncate(text: string, max: number): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
