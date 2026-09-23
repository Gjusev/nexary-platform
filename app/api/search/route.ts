import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { extractSearchKeywords } from '@/lib/search/keyword-extractor';
import { searchWeb, type WebSearchResult } from '@/lib/search/searxng';

const stackServerApp = new StackServerApp({
    tokenStore: 'nextjs-cookie',
});

export interface SearchAPIResponse {
    success: boolean;
    results: WebSearchResult[];
    keywords: string[];
    searchQuery: string;
    cached: boolean;
    totalFound: number;
    error?: string;
}

/**
 * POST /api/search
 * Performs web search using SearXNG with keyword extraction
 */
export async function POST(request: NextRequest): Promise<NextResponse<SearchAPIResponse>> {
    // Check authentication
    const user = await stackServerApp.getUser();
    if (!user) {
        return NextResponse.json({
            success: false,
            results: [],
            keywords: [],
            searchQuery: '',
            cached: false,
            totalFound: 0,
            error: 'Unauthorized',
        }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { query, language, limit = 5 } = body;

        if (!query || typeof query !== 'string') {
            return NextResponse.json({
                success: false,
                results: [],
                keywords: [],
                searchQuery: '',
                cached: false,
                totalFound: 0,
                error: 'Query is required',
            }, { status: 400 });
        }

        // Check if web search is enabled
        const searchEnabled = process.env.SEARXNG_ENABLED !== 'false';
        if (!searchEnabled) {
            return NextResponse.json({
                success: false,
                results: [],
                keywords: [],
                searchQuery: '',
                cached: false,
                totalFound: 0,
                error: 'Web search is disabled',
            }, { status: 503 });
        }

        // Step 1: Extract keywords using OpenAI
        const { keywords, searchQuery, cached: keywordsCached } = await extractSearchKeywords(query);

        // Step 2: Search using SearXNG
        const searchResponse = await searchWeb(searchQuery, {
            limit: Math.min(limit, 5), // Max 5 results
            language: language || 'auto',
        });

        return NextResponse.json({
            success: true,
            results: searchResponse.results,
            keywords,
            searchQuery,
            cached: searchResponse.cached || keywordsCached,
            totalFound: searchResponse.totalFound,
        });
    } catch (error) {
        console.error('❌ Search API error:', error);

        return NextResponse.json({
            success: false,
            results: [],
            keywords: [],
            searchQuery: '',
            cached: false,
            totalFound: 0,
            error: error instanceof Error ? error.message : 'Search failed',
        }, { status: 500 });
    }
}

/**
 * GET /api/search
 * Quick search endpoint for testing
 */
export async function GET(request: NextRequest): Promise<NextResponse<SearchAPIResponse>> {
    const query = request.nextUrl.searchParams.get('q');

    if (!query) {
        return NextResponse.json({
            success: false,
            results: [],
            keywords: [],
            searchQuery: '',
            cached: false,
            totalFound: 0,
            error: 'Query parameter "q" is required',
        }, { status: 400 });
    }

    // Create a mock POST request
    const mockRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ query }),
    });

    return POST(mockRequest);
}
