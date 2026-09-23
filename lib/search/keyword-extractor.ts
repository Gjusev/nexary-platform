/**
 * Keyword Extractor using OpenAI GPT-4o-mini
 * Extracts search-optimized keywords from user queries
 */

import { getCached, setCached } from '@/lib/redis';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CACHE_TTL_SECONDS = 3600; // 1 hour

export interface KeywordExtractionResult {
    keywords: string[];
    searchQuery: string;
    cached: boolean;
}

/**
 * Extract search keywords from a user query using GPT-4o-mini
 */
export async function extractSearchKeywords(
    userQuery: string
): Promise<KeywordExtractionResult> {
    // Create cache key
    const cacheKey = `keywords:${Buffer.from(userQuery.toLowerCase().trim()).toString('base64').slice(0, 64)}`;

    // Check cache first
    const cached = await getCached<{ keywords: string[]; searchQuery: string }>(cacheKey);
    if (cached) {
        return { ...cached, cached: true };
    }

    if (!OPENAI_API_KEY) {
        // Fallback: just use the original query
        console.warn('⚠️ OPENAI_API_KEY not set, using original query');
        return {
            keywords: userQuery.split(' ').slice(0, 5),
            searchQuery: userQuery,
            cached: false
        };
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a search query optimizer. Given a user's question or statement, extract 3-5 optimal search keywords that would find relevant web results.

Rules:
- Return ONLY the keywords as a JSON array
- Keywords should be specific and relevant
- Remove filler words and questions markers
- Focus on nouns, proper nouns, and key concepts
- If it's a question about a topic, extract the topic keywords

Example input: "¿Cuál es la capital de Francia y cuántos habitantes tiene?"
Example output: ["capital", "Francia", "habitantes", "población"]

Example input: "How does photosynthesis work in plants?"
Example output: ["photosynthesis", "plants", "process", "mechanism"]`
                    },
                    {
                        role: 'user',
                        content: userQuery
                    }
                ],
                temperature: 0.3,
                max_tokens: 100,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse the JSON array from the response
        let keywords: string[] = [];
        try {
            // Try to extract JSON array from the response (using [\s\S]* for dotall compatibility)
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                keywords = JSON.parse(jsonMatch[0]);
            } else {
                // Fallback: split by comma or space
                keywords = content.replace(/[\[\]"']/g, '').split(/[,\s]+/).filter(Boolean);
            }
        } catch {
            keywords = content.replace(/[\[\]"']/g, '').split(/[,\s]+/).filter(Boolean);
        }

        // Take only first 5 keywords
        keywords = keywords.slice(0, 5);

        // Create search query from keywords
        const searchQuery = keywords.join(' ');

        const result = { keywords, searchQuery };

        // Cache the result
        await setCached(cacheKey, result, CACHE_TTL_SECONDS);

        return { ...result, cached: false };
    } catch (error) {
        console.error('❌ Keyword extraction error:', error);

        // Fallback: use original query
        return {
            keywords: userQuery.split(' ').filter(w => w.length > 2).slice(0, 5),
            searchQuery: userQuery,
            cached: false
        };
    }
}
