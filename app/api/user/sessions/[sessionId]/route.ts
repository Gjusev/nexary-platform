import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';

// DELETE - Revoke a specific session
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await stackServerApp.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sessionId } = await params;

        // Revoke session via Stack Auth REST API
        const apiUrl = process.env.STACK_AUTH_API_URL || process.env.NEXT_PUBLIC_STACK_API_URL;
        const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
        const secretKey = process.env.STACK_SECRET_SERVER_KEY;

        const response = await fetch(
            `${apiUrl}/api/v1/auth/sessions/${sessionId}?user_id=${user.id}`,
            {
                method: 'DELETE',
                headers: {
                    'x-stack-project-id': projectId!,
                    'x-stack-secret-server-key': secretKey!,
                    'x-stack-access-type': 'server',
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Failed to revoke session:', error);
            return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error revoking session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
