import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/assistants/[id]/duplicate
 * Duplicate an assistant template
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getStackServerUser();

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;

        const client = await pool.connect();

        try {
            // Get original template
            const originalResult = await client.query(
                `SELECT * FROM pn_assistant_templates WHERE id = $1`,
                [id]
            );

            if (originalResult.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Template not found' },
                    { status: 404 }
                );
            }

            const original = originalResult.rows[0];

            // Check if user can duplicate (public templates or own templates)
            if (original.visibility === 'private' && original.user_id !== session.user.id) {
                return NextResponse.json(
                    { error: 'Cannot duplicate private template' },
                    { status: 403 }
                );
            }

            // Create duplicate with new ownership
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
                    welcome_message,
                    avatar_color,
                    preferred_model,
                    context_questions,
                    usage_count,
                    conversation_count,
                    is_featured
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, false)
                RETURNING *`,
                [
                    `${original.name} (Copy)`,
                    original.description,
                    original.system_prompt,
                    original.category,
                    original.icon,
                    original.sample_prompts,
                    original.tags,
                    'private', // Duplicates are always private initially
                    session.user.id,
                    original.welcome_message,
                    original.avatar_color,
                    original.preferred_model,
                    original.context_questions,
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
        console.error('[API] Error duplicating assistant:', error);
        return NextResponse.json(
            { error: 'Failed to duplicate assistant' },
            { status: 500 }
        );
    }
}
