import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createInvitation, listPendingInvitations, initializeTables } from '@/lib/chat-db';
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
    return NextResponse.json({ success: false, error: 'Forbidden - Only team owners can create invitations' }, { status: 403 });
  }

  try {
    await initializeTables();
    
    const { email, role = 'member' } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 });
    }

    if (role !== 'member' && role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Role must be either member or admin' }, { status: 400 });
    }

    const token = await createInvitation(session.teamSlug, email, role);
    const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;

    return NextResponse.json({
      success: true,
      token,
      inviteUrl,
      message: `Invitation created for ${email}`,
    });
  } catch (error) {
    console.error('Failed to create invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.roles?.includes('team-owner') || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Forbidden - Only team owners can view invitations' }, { status: 403 });
  }

  try {
    await initializeTables();
    const invitations = await listPendingInvitations(session.teamSlug);

    return NextResponse.json({
      success: true,
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        inviteUrl: `${process.env.NEXTAUTH_URL}/invite/${inv.token}`,
      })),
    });
  } catch (error) {
    console.error('Failed to list invitations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list invitations' },
      { status: 500 }
    );
  }
}