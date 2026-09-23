/**
 * Reranking Models - Cross-Encoders and Cohere Rerank
 *
 * Improves retrieval quality by reranking initial search results
 * with more sophisticated models.
 */

import { query } from '@/lib/db';

export interface RerankResult {
  id: string;
  text: string;
  score: number;
  originalScore: number;
  index: number;
  metadata?: Record<string, unknown>;
}

export interface RerankOptions {
  topK?: number; // Number of results to return
  model?: string; // Model name for Cohere
  returnDocuments?: boolean; // Return document text
}

// ============================================================================
// Cohere Rerank API
// ============================================================================

const COHERE_API_URL = 'https://api.cohere.ai/v1/rerank';

/**
 * Rerank using Cohere's rerank API
 *
 * @param query - Search query
 * @param documents - Documents to rerank
 * @param options - Reranking options
 * @returns Reranked results
 */
export async function cohereRerank(
  query: string,
  documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>,
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error('COHERE_API_KEY environment variable is not set');
  }

  const { topK = documents.length, model = 'rerank-english-v2.0', returnDocuments = true } = options;

  try {
    const response = await fetch(COHERE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        query,
        documents: documents.map(d => ({ text: d.text })),
        top_n: topK,
        return_documents: returnDocuments,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${error}`);
    }

    const data = await response.json();

    return data.results.map((result: any, index: number) => ({
      id: documents[result.index].id,
      text: returnDocuments ? (result.document?.text || documents[result.index].text) : '',
      score: result.relevance_score,
      originalScore: 0, // Original scores not preserved in Cohere response
      index: result.index,
      metadata: documents[result.index].metadata,
    }));
  } catch (error) {
    console.error('Cohere rerank failed:', error);
    // Fallback to original order
    return documents.map((doc, index) => ({
      id: doc.id,
      text: doc.text,
      score: 1 - (index / documents.length), // Decreasing score
      originalScore: 0,
      index,
      metadata: doc.metadata,
    }));
  }
}

// ============================================================================
// Cross-Encoder Reranking (Local)
// ============================================================================

/**
 * Simple cross-encoder implementation using keyword overlap
 * In production, you would use a proper cross-encoder model like:
 * - sentence-transformers cross-encoder models
 * - BERT-based cross-encoders
 *
 * This is a simplified version for demonstration.
 */
export async function crossEncoderRerank(
  query: string,
  documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>,
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const { topK = documents.length } = options;

  // Tokenize query and documents
  const queryTokens = tokenize(query.toLowerCase());

  const scores = documents.map(doc => {
    const docTokens = tokenize(doc.text.toLowerCase());
    const score = computeCrossEncoderScore(queryTokens, docTokens);
    return {
      id: doc.id,
      text: doc.text,
      score,
      originalScore: 0,
      index: 0,
      metadata: doc.metadata,
    };
  });

  // Sort by score (descending) and return topK
  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, topK).map((result, idx) => ({
    ...result,
    index: idx,
  }));
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2); // Filter very short words
}

/**
 * Compute cross-encoder score using multiple features
 */
function computeCrossEncoderScore(queryTokens: string[], docTokens: string[]): number {
  // Feature 1: Query term overlap (Jaccard similarity)
  const querySet = new Set(queryTokens);
  const docSet = new Set(docTokens);
  const intersection = new Set(Array.from(querySet).filter(x => docSet.has(x)));
  const jaccard = intersection.size / new Set(Array.from([...Array.from(querySet), ...Array.from(docSet)])).size;

  // Feature 2: TF-IDF-like scoring (term frequency)
  let tfScore = 0;
  queryTokens.forEach(token => {
    const count = docTokens.filter(t => t === token).length;
    tfScore += count / docTokens.length;
  });
  const normalizedTf = tfScore / queryTokens.length;

  // Feature 3: Phrase matching (bigram overlap)
  const queryBigrams = createBigrams(queryTokens);
  const docBigrams = createBigrams(docTokens);
  const bigramOverlap = Array.from(queryBigrams).filter(bg => docBigrams.has(bg)).length / Math.max(queryBigrams.size, 1);

  // Feature 4: Position weight (earlier matches are more important)
  let positionScore = 0;
  queryTokens.forEach((token, idx) => {
    const docIndex = docTokens.indexOf(token);
    if (docIndex !== -1) {
      positionScore += 1 / (idx + 1) * (1 - docIndex / docTokens.length);
    }
  });
  const normalizedPosition = positionScore / queryTokens.length;

  // Combine features with learned weights (simplified)
  // In production, these would be learned from data
  const weights = {
    jaccard: 0.3,
    tf: 0.3,
    bigram: 0.2,
    position: 0.2,
  };

  return (
    weights.jaccard * jaccard +
    weights.tf * normalizedTf +
    weights.bigram * bigramOverlap +
    weights.position * normalizedPosition
  );
}

/**
 * Create bigrams from tokens
 */
function createBigrams(tokens: string[]): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bigrams;
}

// ============================================================================
// Learning to Rank (LTR)
// ============================================================================

/**
 * Learning to Rank features for ML models
 * Collects features that can be used with XGBoost, LightGBM, etc.
 */
export interface LTRFeatures {
  bm25Score: number;
  semanticScore: number;
  queryLength: number;
  documentLength: number;
  queryTermOverlap: number;
  queryDocumentRatio: number;
  positionScore: number;
  coverageScore: number;
}

/**
 * Extract features for learning to rank
 */
export function extractLTRFeatures(
  query: string,
  document: string,
  bm25Score: number,
  semanticScore: number
): LTRFeatures {
  const queryTokens = tokenize(query);
  const docTokens = tokenize(document);
  const querySet = new Set(queryTokens);
  const docSet = new Set(docTokens);

  // Query term overlap
  const overlap = Array.from(querySet).filter(t => docSet.has(t));
  const queryTermOverlap = overlap.length / queryTokens.length;

  // Query-document length ratio
  const queryDocumentRatio = queryTokens.length / Math.max(docTokens.length, 1);

  // Position score (average position of query terms in document)
  let totalPosition = 0;
  let foundTerms = 0;
  queryTokens.forEach(token => {
    const index = docTokens.indexOf(token);
    if (index !== -1) {
      totalPosition += index;
      foundTerms++;
    }
  });
  const avgPosition = foundTerms > 0 ? totalPosition / foundTerms : docTokens.length;
  const positionScore = 1 - (avgPosition / docTokens.length);

  // Coverage score (proportion of query terms found)
  const coverageScore = foundTerms / queryTokens.length;

  return {
    bm25Score,
    semanticScore,
    queryLength: queryTokens.length,
    documentLength: docTokens.length,
    queryTermOverlap,
    queryDocumentRatio,
    positionScore,
    coverageScore,
  };
}

// ============================================================================
// Ensemble Reranking
// ============================================================================

/**
 * Ensemble reranking combining multiple reranking methods
 */
export async function ensembleRerank(
  query: string,
  documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>,
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const { topK = documents.length } = options;

  // Get scores from multiple methods
  const [cohereResults, crossEncoderResults] = await Promise.all([
    cohereRerank(query, documents, { ...options, topK: documents.length }).catch(() => []),
    crossEncoderRerank(query, documents, { ...options, topK: documents.length }),
  ]);

  // Normalize scores
  const normalize = (scores: number[]): number[] => {
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    return scores.map(s => (s - min) / (max - min || 1));
  };

  const cohereScores = new Map(
    cohereResults.map(r => [r.id, r.score])
  );

  const crossEncoderScores = new Map(
    crossEncoderResults.map(r => [r.id, r.score])
  );

  // Ensemble with weights
  const weights = {
    cohere: 0.6,
    crossEncoder: 0.4,
  };

  const ensembleScores = documents.map(doc => {
    const cohereScore = cohereScores.get(doc.id) || 0;
    const crossScore = crossEncoderScores.get(doc.id) || 0;

    return {
      id: doc.id,
      text: doc.text,
      score: weights.cohere * cohereScore + weights.crossEncoder * crossScore,
      originalScore: 0,
      index: 0,
      metadata: doc.metadata,
    };
  });

  // Sort and return topK
  ensembleScores.sort((a, b) => b.score - a.score);

  return ensembleScores.slice(0, topK).map((result, idx) => ({
    ...result,
    index: idx,
  }));
}

// ============================================================================
// Query-Document Relevance Scoring
// ============================================================================

/**
 * Compute relevance score using multiple signals
 */
export function computeRelevanceScore(
  query: string,
  document: string,
  initialScore: number
): number {
  const queryTokens = tokenize(query.toLowerCase());
  const docTokens = tokenize(document.toLowerCase());

  // Exact phrase match bonus
  if (document.toLowerCase().includes(query.toLowerCase())) {
    return Math.min(initialScore + 0.3, 1.0);
  }

  // All query terms present bonus
  const querySet = new Set(queryTokens);
  const docSet = new Set(docTokens);
  const allTermsPresent = Array.from(querySet).every(t => docSet.has(t));

  if (allTermsPresent) {
    return Math.min(initialScore + 0.2, 1.0);
  }

  // Most query terms present
  const presentCount = Array.from(querySet).filter(t => docSet.has(t)).length;
  const presentRatio = presentCount / queryTokens.length;

  if (presentRatio > 0.7) {
    return initialScore + 0.1 * presentRatio;
  }

  return initialScore;
}
