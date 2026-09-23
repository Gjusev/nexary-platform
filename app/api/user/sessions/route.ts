import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';

// GET - List user sessions
export async function GET() {
    try {
        const user = await stackServerApp.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get sessions via Stack Auth REST API
        const apiUrl = process.env.STACK_AUTH_API_URL || process.env.NEXT_PUBLIC_STACK_API_URL;
        const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
        const secretKey = process.env.STACK_SECRET_SERVER_KEY;

        const response = await fetch(
            `${apiUrl}/api/v1/auth/sessions?user_id=${user.id}`,
            {
                headers: {
                    'x-stack-project-id': projectId!,
                    'x-stack-secret-server-key': secretKey!,
                    'x-stack-access-type': 'server',
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Failed to fetch sessions:', error);
            return NextResponse.json({ sessions: [] });
        }

        const data = await response.json();
        return NextResponse.json({ sessions: data.items || data || [] });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return NextResponse.json({ sessions: [] });
    }
}
