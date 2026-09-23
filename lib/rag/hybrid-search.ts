/**
 * Hybrid Search - Combines lexical (BM25) and semantic search
 *
 * Implements RRF (Reciprocal Rank Fusion) to combine results from
 * both full-text search and vector similarity search.
 */

import { searchQdrant, getAllPointsFromCollection } from './qdrant';
import { generateEmbedding } from './embeddings';

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  semanticScore?: number;
  lexicalScore?: number;
  metadata?: Record<string, unknown>;
}

export interface HybridSearchOptions {
  limit?: number;
  alpha?: number; // Weight for semantic search (0-1), default 0.5
  rrfK?: number; // RRF constant, default 60
  filters?: Record<string, unknown>;
  includeMetadata?: boolean;
}

/**
 * Lexical search simulation using Qdrant
 *
 * Since Qdrant stores vectors and we want lexical-like results,
 * we'll use keyword matching on the payload text field.
 * In a real production setup, you would use a dedicated search engine
 * like Elasticsearch or PostgreSQL full-text search.
 */
async function bm25Search(
  collectionName: string,
  queryText: string,
  limit: number = 10
): Promise<Array<{ id: string; score: number; text: string; metadata: Record<string, unknown> }>> {
  try {
    // Extract keywords from query (remove stopwords, get important terms)
    const keywords = extractKeywords(queryText);

    // For now, return empty array - in production this would use:
    // 1. Elasticsearch/OpenSearch for proper BM25
    // 2. PostgreSQL full-text search with rag_chunks table
    // 3. Qdrant's text search capabilities (if available)

    // Fallback: Use Qdrant scroll to get all chunks and filter by keywords
    const allPoints = await getAllPointsFromCollection(collectionName, limit * 5);

    // Score by keyword overlap
    const scored = allPoints
      .map(point => {
        const text = (point.payload?.text as string) || '';
        const score = calculateKeywordOverlap(keywords, text);
        return {
          id: String(point.id),
          text,
          score,
          metadata: point.payload as Record<string, unknown>,
        };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  } catch (error) {
    console.error('Lexical search failed:', error);
    return [];
  }
}

/**
 * Extract keywords from query (remove stopwords, short words)
 */
function extractKeywords(query: string): Set<string> {
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'was', 'are', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopwords.has(word));

  return new Set(words);
}

/**
 * Calculate keyword overlap score (simplified TF-IDF-like scoring)
 */
function calculateKeywordOverlap(keywords: Set<string>, text: string): number {
  const textLower = text.toLowerCase();
  const words = textLower.split(/\s+/);
  const wordSet = new Set(words);

  let score = 0;
  keywords.forEach(keyword => {
    if (wordSet.has(keyword)) {
      // Exact match
      score += 1;

      // Bonus for multiple occurrences
      const count = words.filter(w => w === keyword).length;
      if (count > 1) {
        score += Math.log(count + 1);
      }
    }

    // Partial match bonus
    if (textLower.includes(keyword)) {
      score += 0.3;
    }
  });

  // Normalize by text length (prefer shorter, more relevant chunks)
  const lengthFactor = Math.min(1, 500 / text.length);

  return score * lengthFactor;
}

/**
 * Reciprocal Rank Fusion (RRF) algorithm
 * Combines ranked lists from multiple retrieval methods
 *
 * RRF formula: 1 / (k + rank)
 * where k is a constant (typically 60)
 */
function reciprocalRankFusion(
  semanticResults: Array<{ id: string; score: number }>,
  lexicalResults: Array<{ id: string; score: number }>,
  k: number = 60
): Map<string, number> {
  const fusedScores = new Map<string, number>();

  // Add semantic scores
  semanticResults.forEach((result, index) => {
    const rrfScore = 1 / (k + index + 1);
    fusedScores.set(result.id, (fusedScores.get(result.id) || 0) + rrfScore);
  });

  // Add lexical scores
  lexicalResults.forEach((result, index) => {
    const rrfScore = 1 / (k + index + 1);
    fusedScores.set(result.id, (fusedScores.get(result.id) || 0) + rrfScore);
  });

  return fusedScores;
}

/**
 * Weighted score combination
 * Combines scores using configurable weights
 */
function weightedCombination(
  semanticResults: Map<string, number>,
  lexicalResults: Map<string, number>,
  alpha: number = 0.5
): Map<string, number> {
  const combinedScores = new Map<string, number>();
  const allIds = new Set([
    ...Array.from(semanticResults.keys()),
    ...Array.from(lexicalResults.keys()),
  ]);

  allIds.forEach(id => {
    const semanticScore = semanticResults.get(id) || 0;
    const lexicalScore = lexicalResults.get(id) || 0;
    const combinedScore = alpha * semanticScore + (1 - alpha) * lexicalScore;
    combinedScores.set(id, combinedScore);
  });

  return combinedScores;
}

/**
 * Normalize scores to 0-1 range
 */
function normalizeScores(scores: Map<string, number>): Map<string, number> {
  const scoresArray = Array.from(scores.values());
  const maxScore = Math.max(...scoresArray);
  const minScore = Math.min(...scoresArray);
  const range = maxScore - minScore;

  if (range === 0) {
    return scores; // All scores are the same
  }

  const normalized = new Map<string, number>();
  scores.forEach((score, id) => {
    normalized.set(id, (score - minScore) / range);
  });

  return normalized;
}

/**
 * Hybrid search combining semantic and lexical search
 *
 * @param collectionName - Qdrant collection name
 * @param queryText - User's query text
 * @param options - Search options
 * @returns Combined and ranked results
 */
export async function hybridSearch(
  collectionName: string,
  queryText: string,
  options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 10,
    alpha = 0.5,
    rrfK = 60,
    filters,
    includeMetadata = true,
  } = options;

  // Parallel execution of both searches
  const [semanticSearchResults, lexicalSearchResults] = await Promise.all([
    // Semantic search (vector similarity)
    (async () => {
      const queryVector = await generateEmbedding(queryText);
      const results = await searchQdrant(collectionName, queryVector, limit * 2, filters);

      return results.map(r => ({
        id: String(r.id),
        score: r.score,
        text: (r.payload?.text as string) || '',
        metadata: includeMetadata ? (r.payload as Record<string, unknown>) : undefined,
      }));
    })(),

    // Lexical search (BM25)
    (async () => {
      try {
        return await bm25Search(collectionName, queryText, limit * 2);
      } catch (error) {
        console.error('Lexical search failed, falling back to semantic only:', error);
        return [];
      }
    })(),
  ]);

  // If lexical search failed, return semantic results only
  if (lexicalSearchResults.length === 0) {
    return semanticSearchResults.slice(0, limit).map(result => ({
      id: result.id,
      text: result.text,
      score: result.score,
      semanticScore: result.score,
      metadata: result.metadata,
    }));
  }

  // Normalize scores
  const semanticScores = normalizeScores(
    new Map(semanticSearchResults.map(r => [r.id, r.score]))
  );

  const lexicalScores = normalizeScores(
    new Map(lexicalSearchResults.map(r => [r.id, r.score]))
  );

  // Combine using weighted combination
  const combinedScores = weightedCombination(semanticScores, lexicalScores, alpha);

  // Sort by combined score
  const sortedResults = Array.from(combinedScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Build final results with detailed scores
  const resultMap = new Map<string, SearchResult>();
  semanticSearchResults.forEach(r => resultMap.set(r.id, r));
  lexicalSearchResults.forEach(r => resultMap.set(r.id, r));

  return sortedResults.map(([id, combinedScore]) => {
    const semanticResult = semanticSearchResults.find(r => r.id === id);
    const lexicalResult = lexicalSearchResults.find(r => r.id === id);
    const baseResult = resultMap.get(id);

    return {
      id,
      text: baseResult?.text || '',
      score: combinedScore,
      semanticScore: semanticResult?.score,
      lexicalScore: lexicalResult?.score,
      metadata: baseResult?.metadata,
    };
  });
}

/**
 * Dense passage retrieval (DPR) style search
 * Uses query and passage embeddings for better relevance
 */
export async function densePassageSearch(
  collectionName: string,
  queryText: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const queryVector = await generateEmbedding(queryText);
  const results = await searchQdrant(collectionName, queryVector, limit);

  return results.map(r => ({
    id: String(r.id),
    text: (r.payload?.text as string) || '',
    score: r.score,
    metadata: r.payload as Record<string, unknown>,
  }));
}

/**
 * Multi-vector search using different embedding strategies
 * Combines results from multiple query variations
 */
export async function multiVectorSearch(
  collectionName: string,
  queryText: string,
  queryVariations: string[],
  limit: number = 10
): Promise<SearchResult[]> {
  // Generate embeddings for all query variations
  const embeddings = await Promise.all([
    generateEmbedding(queryText),
    ...queryVariations.map(q => generateEmbedding(q)),
  ]);

  // Search with each embedding
  const allResults = await Promise.all(
    embeddings.map(embedding =>
      searchQdrant(collectionName, embedding, limit * 2)
    )
  );

  // Aggregate scores
  const scoreMap = new Map<string, { totalScore: number; count: number; text: string; metadata: Record<string, unknown> }>();

  allResults.flat().forEach(result => {
    const id = String(result.id);
    const existing = scoreMap.get(id);

    if (existing) {
      existing.totalScore += result.score;
      existing.count += 1;
    } else {
      scoreMap.set(id, {
        totalScore: result.score,
        count: 1,
        text: (result.payload?.text as string) || '',
        metadata: result.payload as Record<string, unknown>,
      });
    }
  });

  // Average scores and sort
  return Array.from(scoreMap.entries())
    .map(([id, data]) => ({
      id,
      text: data.text,
      score: data.totalScore / data.count,
      metadata: data.metadata,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Maximal Marginal Relevance (MMR) reranking
 * Balances relevance and diversity in results
 */
export function mmrRerank(
  results: SearchResult[],
  lambda: number = 0.5, // Balance between relevance and diversity
  limit: number = 10
): SearchResult[] {
  if (results.length === 0) return [];

  const selected: SearchResult[] = [];
  const remaining = [...results];
  const selectedIds = new Set<string>();

  // Select the most relevant result first
  selected.push(remaining.shift()!);
  selectedIds.add(selected[0].id);

  // Iteratively select results
  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    remaining.forEach((result, index) => {
      // Relevance score
      const relevance = result.score;

      // Diversity: minimum similarity to already selected results
      const diversity = selectedIds.size > 0
        ? Math.min(...Array.from(selectedIds).map(selectedId => {
            const selectedResult = results.find(r => r.id === selectedId);
            // Simple cosine distance approximation (1 - cosine_similarity)
            return 1 - (selectedResult?.score || 0) * result.score;
          }))
        : 1;

      // MMR score: lambda * relevance - (1 - lambda) * diversity
      const mmrScore = lambda * relevance + (1 - lambda) * diversity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = index;
      }
    });

    const best = remaining.splice(bestIndex, 1)[0];
    if (best) {
      selected.push(best);
      selectedIds.add(best.id);
    }
  }

  return selected;
}
