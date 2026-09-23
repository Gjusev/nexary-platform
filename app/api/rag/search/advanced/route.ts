/**
 * Advanced RAG Search API
 *
 * Combines hybrid search, reranking, and query expansion
 * for improved retrieval accuracy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridSearch, mmrRerank } from '@/lib/rag/hybrid-search';
import { cohereRerank, crossEncoderRerank, ensembleRerank } from '@/lib/rag/reranking';
import { expandQuery, transformQuery, detectQueryType } from '@/lib/rag/query-expansion';
import { adaptiveChunk } from '@/lib/rag/adaptive-chunking';
import { getRAGPackage } from '@/lib/cache/rag-cache';

export interface AdvancedSearchRequest {
  packageId: string;
  query: string;
  options?: {
    method?: 'hybrid' | 'semantic' | 'lexical';
    rerank?: 'cohere' | 'cross-encoder' | 'ensemble' | 'mmr' | 'none';
    expandQuery?: boolean;
    queryVariations?: number;
    limit?: number;
    alpha?: number; // Weight for semantic vs lexical
    diversity?: number; // For MMR (0-1)
    includeMetadata?: boolean;
  };
}

export interface AdvancedSearchResponse {
  results: Array<{
    id: string;
    text: string;
    score: number;
    semanticScore?: number;
    lexicalScore?: number;
    rerankedScore?: number;
    metadata?: Record<string, unknown>;
  }>;
  queryInfo: {
    original: string;
    transformed?: string;
    expanded?: string[];
    type: string;
    method: string;
    rerankingMethod?: string;
  };
  timings?: {
    search: number;
    rerank?: number;
    total: number;
  };
}

/**
 * POST /api/rag/search/advanced - Advanced RAG search
 */
export async function POST(req: NextRequest) {
  try {
    const body: AdvancedSearchRequest = await req.json();
    const { packageId, query, options = {} } = body;

    // Validate inputs
    if (!packageId || !query) {
      return NextResponse.json(
        { error: 'packageId and query are required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Get RAG package to get collection name
    const ragPackage = await getRAGPackage(packageId);
    if (!ragPackage) {
      return NextResponse.json(
        { error: 'RAG package not found' },
        { status: 404 }
      );
    }

    const collectionName = ragPackage.id;

    // Detect query type
    const queryTypeInfo = detectQueryType(query);

    // Transform query
    const transformedQuery = transformQuery(query, {
      removeStopwords: true,
      normalizeCase: true,
      expandAbbreviations: true,
    });

    // Expand query if requested
    let expandedQueries: string[] = [];
    if (options.expandQuery !== false) {
      const expansion = await expandQuery(query, {
        maxVariations: options.queryVariations || 3,
        useEmbeddings: true,
      });
      expandedQueries = expansion.expanded;
    }

    // Perform search
    let searchResults: Awaited<ReturnType<typeof hybridSearch>> = [];
    const searchStart = Date.now();

    if (options.method === 'hybrid' || !options.method) {
      // Hybrid search (semantic + lexical)
      searchResults = await hybridSearch(collectionName, query, {
        limit: (options.limit || 10) * 2, // Get more for reranking
        alpha: options.alpha || 0.5,
        includeMetadata: options.includeMetadata ?? true,
      });
    } else if (options.method === 'lexical') {
      // Lexical only
      searchResults = await hybridSearch(collectionName, query, {
        limit: (options.limit || 10) * 2,
        alpha: 0, // Pure lexical
        includeMetadata: options.includeMetadata ?? true,
      });
    } else {
      // Semantic only
      searchResults = await hybridSearch(collectionName, query, {
        limit: (options.limit || 10) * 2,
        alpha: 1, // Pure semantic
        includeMetadata: options.includeMetadata ?? true,
      });
    }

    const searchTime = Date.now() - searchStart;

    // Rerank if requested
    let rerankedResults = searchResults;
    let rerankTime: number | undefined;

    if (options.rerank && options.rerank !== 'none') {
      const rerankStart = Date.now();

      const documents = searchResults.map(r => ({
        id: r.id,
        text: r.text,
        metadata: r.metadata,
      }));

      switch (options.rerank) {
        case 'cohere':
          const cohereResults = await cohereRerank(query, documents, {
            topK: options.limit || 10,
          });
          rerankedResults = cohereResults.map(r => ({
            id: r.id,
            text: r.text,
            score: r.score,
            semanticScore: searchResults.find(sr => sr.id === r.id)?.semanticScore,
            lexicalScore: searchResults.find(sr => sr.id === r.id)?.lexicalScore,
            rerankedScore: r.score,
            metadata: r.metadata,
          }));
          break;

        case 'cross-encoder':
          const crossEncoderResults = await crossEncoderRerank(query, documents, {
            topK: options.limit || 10,
          });
          rerankedResults = crossEncoderResults.map(r => ({
            id: r.id,
            text: r.text,
            score: r.score,
            semanticScore: searchResults.find(sr => sr.id === r.id)?.semanticScore,
            lexicalScore: searchResults.find(sr => sr.id === r.id)?.lexicalScore,
            rerankedScore: r.score,
            metadata: r.metadata,
          }));
          break;

        case 'ensemble':
          const ensembleResults = await ensembleRerank(query, documents, {
            topK: options.limit || 10,
          });
          rerankedResults = ensembleResults.map(r => ({
            id: r.id,
            text: r.text,
            score: r.score,
            semanticScore: searchResults.find(sr => sr.id === r.id)?.semanticScore,
            lexicalScore: searchResults.find(sr => sr.id === r.id)?.lexicalScore,
            rerankedScore: r.score,
            metadata: r.metadata,
          }));
          break;

        case 'mmr':
          rerankedResults = mmrRerank(searchResults, options.diversity || 0.5, options.limit || 10);
          rerankedResults = rerankedResults.map(r => ({
            id: r.id,
            text: r.text,
            score: r.score,
            semanticScore: (r as any).semanticScore,
            lexicalScore: (r as any).lexicalScore,
            rerankedScore: r.score,
            metadata: (r as any).metadata,
          }));
          break;
      }

      rerankTime = Date.now() - rerankStart;
    }

    // Limit results
    const finalResults = rerankedResults.slice(0, options.limit || 10);

    const totalTime = Date.now() - startTime;

    const response: AdvancedSearchResponse = {
      results: finalResults,
      queryInfo: {
        original: query,
        transformed: transformedQuery !== query ? transformedQuery : undefined,
        expanded: expandedQueries.length > 0 ? expandedQueries : undefined,
        type: queryTypeInfo.type,
        method: options.method || 'hybrid',
        rerankingMethod: options.rerank,
      },
      timings: {
        search: searchTime,
        rerank: rerankTime,
        total: totalTime,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Advanced search error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/search/advanced - Get search capabilities/info
 */
export async function GET() {
  return NextResponse.json({
    capabilities: {
      searchMethods: ['hybrid', 'semantic', 'lexical'],
      rerankingMethods: ['cohere', 'cross-encoder', 'ensemble', 'mmr', 'none'],
      features: [
        'hybrid_search',
        'query_expansion',
        'query_transformation',
        'semantic_reranking',
        'diversity_reranking',
      ],
      options: {
        alpha: {
          description: 'Weight for semantic vs lexical search (0-1)',
          default: 0.5,
          min: 0,
          max: 1,
        },
        diversity: {
          description: 'Diversity parameter for MMR reranking (0-1)',
          default: 0.5,
          min: 0,
          max: 1,
        },
        limit: {
          description: 'Maximum number of results to return',
          default: 10,
          min: 1,
          max: 100,
        },
        queryVariations: {
          description: 'Number of query variations to generate',
          default: 3,
          min: 1,
          max: 10,
        },
      },
    },
  });
}
