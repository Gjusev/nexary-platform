import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createTeamInvitation, listTeamInvitations, revokeInvitation } from '@/lib/invitations';
import { checkTeamRateLimit } from '@/lib/middleware/api-rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.roles?.includes('team-owner') || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { inviteeEmail, expiresInHours } = body;

    if (!inviteeEmail || typeof inviteeEmail !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid invitee email' },
        { status: 400 }
      );
    }

    const invitation = await createTeamInvitation({
      teamSlug: session.teamSlug,
      inviterEmail: session.user?.email ?? '',
      inviteeEmail,
      expiresInHours: expiresInHours && typeof expiresInHours === 'number' ? expiresInHours : 72,
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        inviteeEmail: invitation.inviteeEmail,
        expiresAt: invitation.expiresAt.toISOString(),
        status: invitation.status,
        inviteUrl: `${process.env.NEXTAUTH_URL}/join?token=${invitation.token}`,
      },
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.roles?.includes('team-owner') || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const invitations = await listTeamInvitations(session.teamSlug);

    return NextResponse.json({
      success: true,
      invitations: invitations.map(inv => ({
        id: inv.id,
        inviteeEmail: inv.inviteeEmail,
        expiresAt: inv.expiresAt.toISOString(),
        usedAt: inv.usedAt?.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        status: inv.status,
      })),
    });
  } catch (error) {
    console.error('Error listing invitations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list invitations' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.roles?.includes('team-owner') || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid invitation ID' },
        { status: 400 }
      );
    }

    const revoked = await revokeInvitation(id, session.teamSlug);

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found or already processed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke invitation' },
      { status: 500 }
    );
  }
}