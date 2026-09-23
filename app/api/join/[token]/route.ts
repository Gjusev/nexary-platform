import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, createInvitation, initializeTables } from '@/lib/chat-db';
import { checkAuthRateLimit } from '@/lib/middleware/api-rate-limit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Rate limiting check
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { token } = await params;

  try {
    await initializeTables();

    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invitation: {
        teamSlug: invitation.teamSlug,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invitation' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Rate limiting check
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { token } = await params;

  try {
    await initializeTables();

    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    await createInvitation(invitation.teamSlug, invitation.email, invitation.role);

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      teamSlug: invitation.teamSlug,
      role: invitation.role,
    });
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
