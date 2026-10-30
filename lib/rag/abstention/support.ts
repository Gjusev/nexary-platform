/**
 * Conformal abstention — support scoring
 *
 * Reduces "how well does the retrieved evidence actually support this query"
 * to a single deterministic score in [0,1]. The score is the nonconformity
 * measure consumed by the split-conformal calibration (conformal.ts) and the
 * tripartite gate (gate.ts).
 *
 * Three components (all in [0,1]):
 * - top:      best fused retrieval score of the candidate pool.
 * - rank:     rank-decayed mean of the top-k scores — rewards several
 *             independent supporting chunks over one lucky hit.
 * - lexical:  fraction of the query's content terms that appear verbatim in
 *             the top chunks — cheap guard against semantically plausible but
 *             lexically empty hits.
 *
 * The Qdrant/hybrid pipeline already fuses and normalizes scores to [0,1]
 * (see retrieveHybrid / fuseResults), so they can be mixed directly.
 */

export interface SupportInput {
  query: string;
  results: Array<{ score?: number; content?: string; text?: string }>;
}

export interface SupportScore {
  /** Combined support score in [0,1]. */
  score: number;
  top: number;
  rank: number;
  lexical: number;
  /** Number of candidates that contributed. */
  candidates: number;
}

const TOP_WEIGHT = 0.6;
const RANK_WEIGHT = 0.25;
const LEXICAL_WEIGHT = 0.15;

const RANK_DECAY = 0.85;
const TOP_K = 5;
/** Tokens shorter than this are treated as noise. */
const MIN_TOKEN_LENGTH = 3;

/** Small German/English stopword set — enough for a coverage ratio, not a linguistics project. */
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'und', 'oder', 'aber', 'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'wurde', 'wurden',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mir', 'mich', 'dich', 'dir', 'uns', 'euch',
  'mit', 'von', 'vom', 'zu', 'zum', 'zur', 'im', 'in', 'am', 'an', 'auf', 'für', 'aus', 'bei',
  'nach', 'vor', 'über', 'unter', 'wie', 'was', 'wer', 'wann', 'wo', 'warum', 'welche', 'welcher',
  'welches', 'nicht', 'noch', 'auch', 'schon', 'nur', 'sehr', 'bitte', 'danke', 'haben', 'hat',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'has', 'have',
  'you', 'your', 'what', 'when', 'where', 'who', 'why', 'how', 'which', 'not', 'but', 'can',
]);

export function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Deterministic support score for a query against its retrieved candidates.
 * Never throws: an empty or malformed input set scores 0 (fail-closed).
 */
export function computeSupportScore({ query, results }: SupportInput): SupportScore {
  const candidates = Array.isArray(results) ? results : [];
  if (candidates.length === 0) {
    return { score: 0, top: 0, rank: 0, lexical: 0, candidates: 0 };
  }

  const scored = candidates
    .map((r) => clamp01(Number(r?.score ?? 0)))
    .sort((a, b) => b - a);

  const top = scored[0] ?? 0;

  const topK = scored.slice(0, TOP_K);
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < topK.length; i++) {
    const w = Math.pow(RANK_DECAY, i);
    weightedSum += w * topK[i];
    weightTotal += w;
  }
  const rank = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const queryTokens = Array.from(new Set(tokenize(query)));
  let lexical = 0;
  if (queryTokens.length > 0) {
    const haystack = candidates
      .slice(0, TOP_K)
      .map((r) => `${r?.content ?? ''} ${r?.text ?? ''}`)
      .join(' ')
      .toLowerCase();
    const found = queryTokens.filter((t) => haystack.includes(t)).length;
    lexical = found / queryTokens.length;
  }

  const score = clamp01(
    TOP_WEIGHT * top + RANK_WEIGHT * rank + LEXICAL_WEIGHT * lexical,
  );

  return { score, top, rank, lexical, candidates: candidates.length };
}
