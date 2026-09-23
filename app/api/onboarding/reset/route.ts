import { NextRequest, NextResponse } from 'next/server';
import { getStackServerUser } from '@/lib/stack/server-auth';
import { Pool } from 'pg';
import { checkAuthRateLimit } from '@/lib/middleware/api-rate-limit';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * DELETE /api/onboarding/reset
 * Resets the onboarding status for the current user
 */
export async function DELETE(request: NextRequest) {
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
            await client.query(
                `DELETE FROM pn_user_onboarding WHERE user_id = $1`,
                [session.user.id]
            );

            return NextResponse.json({ success: true, message: 'Onboarding reset successfully' });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Onboarding Reset] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
