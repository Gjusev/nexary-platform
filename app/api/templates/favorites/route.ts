import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/templates/favorites
 * Get user's favorite templates
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getStackServerUser();

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const client = await pool.connect();

        try {
            const result = await client.query(
                `SELECT 
          t.*,
          uf.favorited_at,
          TRUE as is_favorited
        FROM pn_user_favorite_templates uf
        JOIN pn_assistant_templates t ON uf.template_id = t.id
        WHERE uf.user_id = $1 AND t.is_public = TRUE
        ORDER BY uf.favorited_at DESC`,
                [session.user.id]
            );

            return NextResponse.json({
                favorites: result.rows,
                count: result.rows.length,
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Favorites List] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/templates/favorites
 * Add or remove a template from favorites
 * Body: { templateId, action: 'add' | 'remove' }
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
        const { templateId, action } = body;

        if (!templateId || !action) {
            return NextResponse.json(
                { error: 'Missing required fields: templateId, action' },
                { status: 400 }
            );
        }

        if (action !== 'add' && action !== 'remove') {
            return NextResponse.json(
                { error: 'Invalid action. Must be "add" or "remove"' },
                { status: 400 }
            );
        }

        const client = await pool.connect();

        try {
            // Verify template exists and is public
            const templateResult = await client.query(
                'SELECT id FROM pn_assistant_templates WHERE id = $1 AND is_public = TRUE',
                [templateId]
            );

            if (templateResult.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Template not found' },
                    { status: 404 }
                );
            }

            if (action === 'add') {
                // Add to favorites (ignore if already exists)
                await client.query(
                    `INSERT INTO pn_user_favorite_templates (user_id, template_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, template_id) DO NOTHING`,
                    [session.user.id, templateId]
                );

                return NextResponse.json({
                    success: true,
                    action: 'added',
                    templateId,
                });
            } else {
                // Remove from favorites
                await client.query(
                    `DELETE FROM pn_user_favorite_templates
           WHERE user_id = $1 AND template_id = $2`,
                    [session.user.id, templateId]
                );

                return NextResponse.json({
                    success: true,
                    action: 'removed',
                    templateId,
                });
            }
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Favorites Update] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
