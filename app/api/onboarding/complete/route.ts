import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';
import { checkAuthRateLimit } from '@/lib/middleware/api-rate-limit';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/onboarding/complete
 * Marks the onboarding as completed and awards the "Onboarding Master" badge
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

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update or insert onboarding record
            await client.query(
                `INSERT INTO pn_user_onboarding (
          user_id, 
          completed, 
          current_step, 
          completed_steps,
          badges,
          completed_at
        )
        VALUES ($1, TRUE, 4, '[1,2,3,4]'::jsonb, '["onboarding_master"]'::jsonb, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET
          completed = TRUE,
          completed_at = NOW(),
          current_step = 4,
          completed_steps = '[1,2,3,4]'::jsonb,
          badges = (
            SELECT jsonb_agg(DISTINCT elem)
            FROM (
              SELECT jsonb_array_elements_text(COALESCE(pn_user_onboarding.badges, '[]'::jsonb)) AS elem
              UNION SELECT 'onboarding_master'
            ) AS all_badges
          )`,
                [session.user.id]
            );

            await client.query('COMMIT');

            // Return final status
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

            return NextResponse.json({
                success: true,
                ...result.rows[0],
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Onboarding Complete] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
