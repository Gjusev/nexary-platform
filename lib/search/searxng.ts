/**
 * SearXNG Search Client
 * Queries the self-hosted SearXNG instance for web search results
 */

import { getCached, setCached } from '@/lib/redis';

const SEARXNG_URL = process.env.SEARXNG_URL || 'https://sear.mokka-dev.de';
const CACHE_TTL_SECONDS = 3600; // 1 hour

export interface SearXNGResult {
    url: string;
    title: string;
    content: string;  // Snippet/description
    engine: string;
    parsed_url: string[];
    positions: number[];
    score?: number;
    category?: string;
    thumbnail?: string;
    publishedDate?: string;
}

export interface SearXNGResponse {
    query: string;
    number_of_results: number;
    results: SearXNGResult[];
    infoboxes?: any[];
    suggestions?: string[];
    unresponsive_engines?: string[];
}

export interface WebSearchResult {
    url: string;
    title: string;
    snippet: string;
    source: string;  // Domain name
    publishedDate?: string;
    score?: number;
}

export interface WebSearchResponse {
    results: WebSearchResult[];
    query: string;
    cached: boolean;
    totalFound: number;
}

/**
 * Search the web using SearXNG
 */
export async function searchWeb(
    query: string,
    options: {
        limit?: number;
        language?: string;
        categories?: string;
    } = {}
): Promise<WebSearchResponse> {
    const { limit = 5, language = 'auto', categories = 'general' } = options;

    // Create cache key
    const cacheKey = `search:${Buffer.from(`${query}:${language}:${categories}`.toLowerCase()).toString('base64').slice(0, 64)}`;

    // Check cache first
    const cached = await getCached<WebSearchResponse>(cacheKey);
    if (cached) {
        return { ...cached, cached: true };
    }

    try {
        // Build search URL
        const searchUrl = new URL('/search', SEARXNG_URL);
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('format', 'json');
        searchUrl.searchParams.set('categories', categories);
        if (language !== 'auto') {
            searchUrl.searchParams.set('language', language);
        }

        console.debug('[SearXNG] Searching:', {
            query,
            url: searchUrl.toString(),
            categories,
            language
        });

        const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Nexary-Chat/1.0',
            },
        });

        if (!response.ok) {
            throw new Error(`SearXNG error: ${response.status} ${response.statusText}`);
        }

        const data: SearXNGResponse = await response.json();

        // Transform and limit results
        const results: WebSearchResult[] = (data.results || [])
            .slice(0, limit)
            .map((r, index) => ({
                url: r.url,
                title: r.title,
                snippet: r.content || '',
                source: extractDomain(r.url),
                publishedDate: r.publishedDate,
                score: r.score || (1 - index * 0.1), // Assign decreasing score if not provided
            }));

        const searchResponse: WebSearchResponse = {
            results,
            query: data.query || query,
            cached: false,
            totalFound: data.number_of_results || results.length,
        };

        // Cache the result
        await setCached(cacheKey, searchResponse, CACHE_TTL_SECONDS);

        return searchResponse;
    } catch (error) {
        console.error('❌ SearXNG search error:', error);

        return {
            results: [],
            query,
            cached: false,
            totalFound: 0,
        };
    }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

/**
 * Format search results as context for LLM
 */
export function formatSearchResultsAsContext(results: WebSearchResult[]): string {
    if (!results || results.length === 0) {
        return '';
    }

    return results
        .map((r, i) =>
            `[Web Source ${i + 1}: ${r.title}]
URL: ${r.url}
${r.snippet}`)
        .join('\n\n---\n\n');
}
