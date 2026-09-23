import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
    tokenStore: 'nextjs-cookie',
});

export async function POST(request: NextRequest) {
    // Rate limiting check
    const rateLimitResponse = checkChatRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { messageId, feedback } = body;

        if (!messageId || !['up', 'down'].includes(feedback)) {
            return NextResponse.json(
                { success: false, error: 'Invalid request body' },
                { status: 400 }
            );
        }

        // Store feedback in database (you may need to create a feedback table)
        // For now, we'll just log it and return success
        // Optional: Store in database
        // await pool.query(`
        //   INSERT INTO pn_message_feedback (message_id, user_id, feedback_type, created_at)
        //   VALUES ($1, $2, $3, NOW())
        //   ON CONFLICT (message_id, user_id)
        //   DO UPDATE SET feedback_type = $3, updated_at = NOW()
        // `, [messageId, user.id, feedback]);

        return NextResponse.json({
            success: true,
            message: 'Feedback recorded',
        });
    } catch (error) {
        console.error('Error recording feedback:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
