import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

interface Template {
    id: string;
    name: string;
    description: string | null;
    category: string;
    icon: string | null;
    system_prompt: string;
    sample_prompts: string[];
    tags: string[];
    is_featured: boolean;
    usage_count: number;
    created_at: string;
    is_favorited?: boolean;
}

/**
 * GET /api/templates
 * List all templates with optional filtering
 * Query params: category, featured, search, user_id (for favorites)
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get('category');
        const featured = searchParams.get('featured');
        const search = searchParams.get('search');

        // User is optional for public template viewing
        const session = await getStackServerUser();
        const userId = session?.user.id;

        const client = await pool.connect();

        try {
            let query = `
        SELECT 
          t.id,
          t.name,
          t.description,
          t.category,
          t.icon,
          t.system_prompt,
          t.sample_prompts,
          t.tags,
          t.is_featured,
          t.usage_count,
          t.created_at
          ${userId ? `, EXISTS(
            SELECT 1 FROM pn_user_favorite_templates 
            WHERE user_id = $1 AND template_id = t.id
          ) as is_favorited` : ''}
        FROM pn_assistant_templates t
        WHERE t.is_public = TRUE
      `;

            const params: (string | number)[] = userId ? [userId] : [];
            let paramIndex = params.length + 1;

            if (category) {
                query += ` AND t.category = $${paramIndex}`;
                params.push(category);
                paramIndex++;
            }

            if (featured === 'true') {
                query += ` AND t.is_featured = TRUE`;
            }

            if (search) {
                query += ` AND (
          t.name ILIKE $${paramIndex} 
          OR t.description ILIKE $${paramIndex}
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(t.tags) tag
            WHERE tag ILIKE $${paramIndex}
          )
        )`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            query += ` ORDER BY t.is_featured DESC, t.usage_count DESC, t.created_at DESC`;

            const result = await client.query(query, params);

            const templates: Template[] = result.rows.map(row => ({
                ...row,
                is_favorited: row.is_favorited || false,
            }));

            return NextResponse.json({
                templates,
                count: templates.length,
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Templates List] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/templates
 * Create a new custom template (admin/user-created)
 * Body: { name, description, category, icon, system_prompt, sample_prompts, tags, is_public }
 */
export async function POST(request: NextRequest) {
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
            category,
            icon,
            system_prompt,
            sample_prompts = [],
            tags = [],
            is_public = false,
        } = body;

        // Validation
        if (!name || !category || !system_prompt) {
            return NextResponse.json(
                { error: 'Missing required fields: name, category, system_prompt' },
                { status: 400 }
            );
        }

        const client = await pool.connect();

        try {
            const result = await client.query(
                `INSERT INTO pn_assistant_templates (
          name,
          description,
          category,
          icon,
          system_prompt,
          sample_prompts,
          tags,
          is_public,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
                [
                    name,
                    description,
                    category,
                    icon,
                    system_prompt,
                    JSON.stringify(sample_prompts),
                    JSON.stringify(tags),
                    is_public,
                    session.user.id,
                ]
            );

            return NextResponse.json({
                success: true,
                template: result.rows[0],
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Template Create] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
