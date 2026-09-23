import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/templates/[id]
 * Get template details by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: templateId } = await params;
        const session = await getStackServerUser();

        const client = await pool.connect();

        try {
            const result = await client.query(
                `SELECT 
          t.*
          ${session ? `, EXISTS(
            SELECT 1 FROM pn_user_favorite_templates 
            WHERE user_id = $2 AND template_id = t.id
          ) as is_favorited` : ''}
        FROM pn_assistant_templates t
        WHERE t.id = $1 AND t.is_public = TRUE`,
                session ? [templateId, session.user.id] : [templateId]
            );

            if (result.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Template not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json(result.rows[0]);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Template Detail] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/templates/[id]/use
 * Increment usage count when template is used
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: templateId } = await params;
        const user = await getStackServerUser(); // Changed to getStackServerUser for consistency

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const client = await pool.connect();

        try {
            const result = await client.query(
                `UPDATE pn_assistant_templates
         SET usage_count = usage_count + 1
         WHERE id = $1 AND is_public = TRUE
         RETURNING *`,
                [templateId]
            );

            if (result.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Template not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                template: result.rows[0],
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Template Use] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
