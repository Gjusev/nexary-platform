import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';
import { checkAuthRateLimit } from '@/lib/middleware/api-rate-limit';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/onboarding/status
 * Returns the onboarding status for the current user
 */
export async function GET(request: NextRequest) {
    // Rate limiting check
    const rateLimitResponse = checkAuthRateLimit(request);
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

        const userId = session.user.id;
        if (!userId) {
            return NextResponse.json(
                { error: 'User ID not found' },
                { status: 400 }
            );
        }

        const client = await pool.connect();

        try {
            const result = await client.query(
                `SELECT 
          completed,
          current_step,
          completed_steps,
          badges,
          skipped,
          started_at,
          completed_at
        FROM pn_user_onboarding
        WHERE user_id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                // User hasn't started onboarding yet
                return NextResponse.json({
                    completed: false,
                    current_step: 0,
                    completed_steps: [],
                    badges: [],
                    skipped: false,
                    started_at: null,
                    completed_at: null,
                });
            }

            return NextResponse.json(result.rows[0]);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Onboarding Status] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/onboarding/status
 * Updates the onboarding status for the current user
 * Body: { step?, completed?, skipped?, badge? }
 */
export async function POST(request: NextRequest) {
    // Rate limiting check
    const rateLimitResponse = checkAuthRateLimit(request);
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
        const { step, completed, skipped, badge } = body;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Check if user has onboarding record
            const existingResult = await client.query(
                'SELECT * FROM pn_user_onboarding WHERE user_id = $1',
                [session.user.id]
            );

            if (existingResult.rows.length === 0) {
                // Create initial record
                await client.query(
                    `INSERT INTO pn_user_onboarding (user_id, current_step, started_at)
           VALUES ($1, $2, NOW())`,
                    [session.user.id, step || 0]
                );
            }

            // Build update query dynamically
            const updates: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (typeof step === 'number') {
                updates.push(`current_step = $${paramIndex}`);
                values.push(step);
                paramIndex++;

                // Add step to completed_steps if not already there
                updates.push(`completed_steps = (
          SELECT COALESCE(
            array_agg(DISTINCT elem ORDER BY elem)::jsonb,
            '[]'::jsonb
          )
          FROM (
            SELECT jsonb_array_elements_text(COALESCE(completed_steps, '[]'::jsonb))::int AS elem
            UNION SELECT $${paramIndex}
          ) AS all_steps
        )`);
                values.push(step);
                paramIndex++;
            }

            if (typeof completed === 'boolean') {
                updates.push(`completed = $${paramIndex}`);
                values.push(completed);
                paramIndex++;

                if (completed) {
                    updates.push(`completed_at = NOW()`);
                }
            }

            if (typeof skipped === 'boolean') {
                updates.push(`skipped = $${paramIndex}`);
                values.push(skipped);
                paramIndex++;
            }

            if (badge) {
                // Add badge to badges array if not already there
                updates.push(`badges = (
          SELECT COALESCE(
            jsonb_agg(DISTINCT elem),
            '[]'::jsonb
          )
          FROM (
            SELECT jsonb_array_elements_text(COALESCE(badges, '[]'::jsonb)) AS elem
            UNION SELECT $${paramIndex}
          ) AS all_badges
        )`);
                values.push(badge);
                paramIndex++;
            }

            if (updates.length > 0) {
                values.push(session.user.id);
                await client.query(
                    `UPDATE pn_user_onboarding
           SET ${updates.join(', ')}
           WHERE user_id = $${paramIndex}`,
                    values
                );
            }

            await client.query('COMMIT');

            // Return updated status
            const result = await client.query(
                `SELECT 
          completed,
          current_step,
          completed_steps,
          badges,
          skipped,
          started_at,
          completed_at
        FROM pn_user_onboarding
        WHERE user_id = $1`,
                [session.user.id]
            );

            return NextResponse.json(result.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Onboarding Status Update] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
