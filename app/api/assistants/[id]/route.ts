import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/assistants/[id]
 * Get a single assistant template by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getStackServerUser();
        const { id } = await params;

        const client = await pool.connect();

        try {
            // First try to find the assistant - allow owner or public/community visibility
            const result = await client.query(
                `SELECT * FROM pn_assistant_templates 
                WHERE id = $1 
                AND (
                    user_id = $2 
                    OR visibility = 'community' 
                    OR visibility = 'team'
                    OR is_public = TRUE
                )`,
                [id, session?.user?.id || '']
            );

            if (result.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Assistant not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                template: result.rows[0],
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Assistant GET] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/assistants/[id]
 * Update an assistant template
 */
export async function PATCH(
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
            welcome_message,
            avatar_color,
            preferred_model,
            context_questions,
        } = body;

        const client = await pool.connect();

        try {
            // Check ownership
            const checkResult = await client.query(
                `SELECT user_id FROM pn_assistant_templates WHERE id =  $1`,
                [id]
            );

            if (checkResult.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Template not found' },
                    { status: 404 }
                );
            }

            if (checkResult.rows[0].user_id !== session.user.id) {
                return NextResponse.json(
                    { error: 'Forbidden' },
                    { status: 403 }
                );
            }

            // Update template
            const result = await client.query(
                `UPDATE pn_assistant_templates 
                SET 
                    name = COALESCE($1, name),
                    description = COALESCE($2, description),
                    system_prompt = COALESCE($3, system_prompt),
                    category = COALESCE($4, category),
                    icon = COALESCE($5, icon),
                    sample_prompts = COALESCE($6, sample_prompts),
                    tags = COALESCE($7, tags),
                    visibility = COALESCE($8, visibility),
                    welcome_message = COALESCE($9, welcome_message),
                    avatar_color = COALESCE($10, avatar_color),
                    preferred_model = COALESCE($11, preferred_model),
                    context_questions = COALESCE($12, context_questions),
                    updated_at = NOW()
                WHERE id = $13
                RETURNING *`,
                [
                    name,
                    description,
                    system_prompt,
                    category,
                    icon,
                    sample_prompts ? JSON.stringify(sample_prompts) : null,
                    tags ? JSON.stringify(tags) : null,
                    visibility,
                    welcome_message,
                    avatar_color,
                    preferred_model,
                    context_questions ? JSON.stringify(context_questions) : null,
                    id,
                ]
            );

            return NextResponse.json({
                template: result.rows[0],
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[API] Error updating assistant:', error);
        return NextResponse.json(
            { error: 'Failed to update assistant' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/assistants/[id]
 * Delete an assistant template
 */
export async function DELETE(
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
            // Check ownership
            const checkResult = await client.query(
                `SELECT user_id FROM pn_assistant_templates WHERE id = $1`,
                [id]
            );

            if (checkResult.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Template not found' },
                    { status: 404 }
                );
            }

            if (checkResult.rows[0].user_id !== session.user.id) {
                return NextResponse.json(
                    { error: 'Forbidden' },
                    { status: 403 }
                );
            }

            // Delete template
            await client.query(
                `DELETE FROM pn_assistant_templates WHERE id = $1`,
                [id]
            );

            return NextResponse.json({ success: true });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[API] Error deleting assistant:', error);
        return NextResponse.json(
            { error: 'Failed to delete assistant' },
            { status: 500 }
        );
    }
}
