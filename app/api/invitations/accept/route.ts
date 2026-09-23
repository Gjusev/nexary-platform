import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, acceptInvitation } from '@/lib/invitations';
import { checkAuthRateLimit } from '@/lib/middleware/api-rate-limit';

export async function GET(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Token is required' },
      { status: 400 }
    );
  }

  try {
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
        inviterEmail: invitation.inviterEmail,
        inviteeEmail: invitation.inviteeEmail,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invitation' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const invitation = await acceptInvitation(token);

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      teamSlug: invitation.teamSlug,
      message: 'Invitation accepted successfully',
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}