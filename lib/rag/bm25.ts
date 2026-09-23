/**
 * BM25 Keyword Search Module
 *
 * Implements BM25 (Best Matching 25) algorithm for keyword-based search.
 * BM25 is a ranking function used by search engines to estimate the relevance
 * of documents to a given search query.
 *
 * Benefits over pure vector search:
 * - Better for exact term matching (names, codes, numbers)
 * - More predictable results for specific queries
 * - Complements semantic search
 *
 * @see https://en.wikipedia.org/wiki/Okapi_BM25
 */

export interface BM25Document {
  /** Unique identifier for the chunk */
  id: string;
  /** Document identifier */
  documentId: string;
  /** Package/collection identifier */
  packageId: string;
  /** Filename or document name */
  filename?: string;
  /** Text content to search */
  text: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface BM25Result {
  id: string;
  documentId: string;
  packageId: string;
  filename?: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface BM25Index {
  /** Indexed documents by ID */
  documents: Map<string, BM25Document>;
  /** Document frequency: term -> number of docs containing term */
  docFreq: Map<string, number>;
  /** Document length for each document */
  docLengths: Map<string, number>;
  /** Average document length */
  avgDocLength: number;
  /** Total number of documents */
  totalDocs: number;
}

/**
 * BM25 Parameters
 */
export interface BM25Params {
  /** k1: Term frequency saturation parameter (default: 1.2) */
  k1: number;
  /** b: Length normalization parameter (default: 0.75) */
  b: number;
  /** Minimum word length to index (default: 2) */
  minWordLength: number;
}

const DEFAULT_PARAMS: BM25Params = {
  k1: 1.2,
  b: 0.75,
  minWordLength: 2,
};

/**
 * Tokenize text into terms
 * - Lowercases
 * - Removes punctuation
 * - Filters by min length
 * - Handles multiple languages (basic)
 */
function tokenize(text: string, minWordLength: number = 2): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Keep only letters, numbers, spaces
    .split(/\s+/)
    .filter(word => word.length >= minWordLength);
}

/**
 * Calculate term frequency in a document
 */
function getTermFrequency(text: string, minWordLength: number): Map<string, number> {
  const tokens = tokenize(text, minWordLength);
  const tf = new Map<string, number>();

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  return tf;
}

/**
 * Build BM25 index from documents
 */
export function buildBM25Index(documents: BM25Document[], params?: Partial<BM25Params>): BM25Index {
  const config = { ...DEFAULT_PARAMS, ...params };

  const index: BM25Index = {
    documents: new Map(),
    docFreq: new Map(),
    docLengths: new Map(),
    avgDocLength: 0,
    totalDocs: documents.length,
  };

  let totalLength = 0;

  // Index each document
  for (const doc of documents) {
    index.documents.set(doc.id, doc);

    const tf = getTermFrequency(doc.text, config.minWordLength);
    const docLength = Array.from(tf.values()).reduce((sum, count) => sum + count, 0);

    index.docLengths.set(doc.id, docLength);
    totalLength += docLength;

    // Update document frequency for each unique term
    for (const [term] of Array.from(tf.entries())) {
      index.docFreq.set(term, (index.docFreq.get(term) || 0) + 1);
    }
  }

  index.avgDocLength = totalLength / index.totalDocs;

  console.debug('[BM25] Index created:', {
    totalDocs: index.totalDocs,
    avgDocLength: index.avgDocLength.toFixed(2),
    uniqueTerms: index.docFreq.size,
    vocabularySample: Array.from(index.docFreq.keys()).slice(0, 10),
  });

  return index;
}

/**
 * Calculate BM25 score for a document given query terms
 */
function calculateBM25Score(
  docText: string,
  queryTerms: string[],
  index: BM25Index,
  docId: string,
  params: BM25Params,
): number {
  const docTF = getTermFrequency(docText, params.minWordLength);
  const docLength = index.docLengths.get(docId) || 0;
  const avgDocLength = index.avgDocLength;

  let score = 0;

  for (const term of queryTerms) {
    const termFreq = docTF.get(term) || 0;

    if (termFreq === 0) continue;

    const docFreq = index.docFreq.get(term) || 0;
    const n = index.totalDocs;

    // IDF (Inverse Document Frequency)
    // Add 1 to avoid division by zero
    const idf = Math.log((n - docFreq + 0.5) / (docFreq + 0.5) + 1);

    // BM25 formula
    // TF component: (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)))
    const tfComponent = (termFreq * (params.k1 + 1)) /
      (termFreq + params.k1 * (1 - params.b + params.b * (docLength / avgDocLength)));

    score += idf * tfComponent;
  }

  return score;
}

/**
 * Search BM25 index
 *
 * @param index - The BM25 index
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 50)
 * @param params - BM25 parameters
 * @returns Array of search results sorted by score
 */
export function searchBM25(
  index: BM25Index,
  query: string,
  limit: number = 50,
  params?: Partial<BM25Params>,
): BM25Result[] {
  const config = { ...DEFAULT_PARAMS, ...params };
  const queryTerms = tokenize(query, config.minWordLength);

  if (queryTerms.length === 0) {
    return [];
  }

  const results: Array<{ doc: BM25Document; score: number }> = [];

  // Score each document
  for (const [docId, doc] of Array.from(index.documents.entries())) {
    const score = calculateBM25Score(doc.text, queryTerms, index, docId, config);

    if (score > 0) {
      results.push({ doc, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  const topResults = results.slice(0, limit);

  console.debug('[BM25] Search results:', {
    query,
    limit,
    totalResults: results.length,
    topResultsCount: topResults.length,
    topResultsSample: topResults.slice(0, 5).map(r => ({
      id: r.doc.id,
      score: r.score,
    })),
  });

  return topResults.map(r => ({
    id: r.doc.id,
    documentId: r.doc.documentId,
    packageId: r.doc.packageId,
    filename: r.doc.filename,
    text: r.doc.text,
    score: r.score,
    metadata: r.doc.metadata,
  }));
}

/**
 * Convert RetrievedChunk to BM25Document
 * Useful for interoperability with the existing RAG pipeline
 */
export function chunkToBM25Document(
  packageId: string,
  chunk: {
    id: string;
    documentId: string;
    filename?: string;
    text?: string;
    metadata?: Record<string, any>;
  }
): BM25Document {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    packageId,
    filename: chunk.filename,
    text: chunk.text || '',
    metadata: chunk.metadata,
  };
}

/**
 * Convert BM25Result to RetrievedChunk
 * Useful for interoperability with the existing RAG pipeline
 */
export function bm25ResultToRetrievedChunk(result: BM25Result): {
  packageId: string;
  documentId: string;
  filename?: string;
  text: string;
  score: number;
} {
  return {
    packageId: result.packageId,
    documentId: result.documentId,
    filename: result.filename,
    text: result.text,
    score: result.score,
  };
}
