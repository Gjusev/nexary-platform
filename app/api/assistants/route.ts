import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';
import { checkApiRateLimit } from '@/lib/middleware/api-rate-limit';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/assistants
 * Fetch assistants based on visibility filter
 */
export async function GET(request: NextRequest) {
    // Rate limiting check
    const rateLimitResponse = checkApiRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const session = await getStackServerUser();

        const { searchParams } = new URL(request.url);
        const visibility = searchParams.get('visibility') || 'community';
        const search = searchParams.get('search');
        const teamSlug = searchParams.get('teamSlug');

        const client = await pool.connect();

        try {
            let query = `
                SELECT 
                    t.*,
                    CASE WHEN f.user_id IS NOT NULL THEN true ELSE false END as is_favorited
                FROM pn_assistant_templates t
                LEFT JOIN pn_user_favorite_templates f 
                    ON t.id = f.template_id AND f.user_id = $1
                WHERE t.visibility = $2
            `;

            const params: (string | null)[] = [session?.user?.id || 'anonymous', visibility];
            let paramCount = 2;

            // Filter by user for private templates
            if (visibility === 'private' && session) {
                query += ` AND t.user_id = $${++paramCount}`;
                (params as (string | null)[]).push(session.user.id);
            }

            // Filter by team for team templates
            if (visibility === 'team' && teamSlug) {
                query += ` AND t.team_slug = $${++paramCount}`;
                (params as (string | null)[]).push(teamSlug);
            }

            // Search filter
            if (search) {
                query += ` AND (t.name ILIKE $${++paramCount} OR t.description ILIKE $${++paramCount})`;
                (params as (string | null)[]).push(`%${search}%`, `%${search}%`);
            }

            query += ` ORDER BY t.is_featured DESC, t.usage_count DESC, t.created_at DESC`;

            const result = await client.query(query, params);

            return NextResponse.json({
                templates: result.rows,
                assistants: result.rows, // Alias for compatibility
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[API] Error fetching assistants:', error);
        return NextResponse.json(
            { error: 'Failed to fetch assistants' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/assistants
 * Create a new assistant template
 */
export async function POST(request: NextRequest) {
    // Rate limiting check
    const rateLimitResponse = checkApiRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const session = await getStackServerUser();

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            name,
            description,
            system_prompt,
            category,
            icon,
            sample_prompts,
            tags,
            visibility,
            teamSlug,
            welcome_message,
            avatar_color,
            preferred_model,
            context_questions,
        } = body;

        if (!name || !system_prompt) {
            return NextResponse.json(
                { error: 'Name and system_prompt are required' },
                { status: 400 }
            );
        }

        const client = await pool.connect();

        try {
            const result = await client.query(
                `INSERT INTO pn_assistant_templates (
                    name,
                    description,
                    system_prompt,
                    category,
                    icon,
                    sample_prompts,
                    tags,
                    visibility,
                    user_id,
                    team_slug,
                    welcome_message,
                    avatar_color,
                    preferred_model,
                    context_questions,
                    usage_count,
                    conversation_count,
                    is_featured
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0, false)
                RETURNING *`,
                [
                    name,
                    description || '',
                    system_prompt,
                    category || 'general',
                    icon || '🤖',
                    JSON.stringify(sample_prompts || []),
                    JSON.stringify(tags || []),
                    visibility || 'private',
                    session.user.id,
                    visibility === 'team' ? teamSlug : null,
                    welcome_message || null,
                    avatar_color || '#6366f1',
                    preferred_model || null,
                    JSON.stringify(context_questions || []),
                ]
            );

            return NextResponse.json({
                template: result.rows[0],
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[API] Error creating assistant:', error);
        return NextResponse.json(
            { error: 'Failed to create assistant' },
            { status: 500 }
        );
    }
}
