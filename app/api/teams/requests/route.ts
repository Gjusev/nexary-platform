import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/options';
import { listJoinRequests, resolveJoinRequest } from '@/lib/teams';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.roles?.includes('team-owner')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const teamSlug = request.nextUrl.searchParams.get('team');
  if (!teamSlug || session.teamSlug !== teamSlug) {
    return NextResponse.json({ success: false, error: 'InvalidTeam' }, { status: 400 });
  }

  const requests = (await listJoinRequests(teamSlug)).map((request) => ({
    id: request.id,
    name: request.name,
    email: request.email,
    createdAt: request.createdAt,
  }));

  return NextResponse.json({ success: true, requests });
}

const resolveSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
});

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.roles?.includes('team-owner') || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { requestId, action } = resolveSchema.parse(await request.json());
    const updated = await resolveJoinRequest({ requestId, action, decisionBy: session.user?.email ?? 'owner' });

    if (updated.teamSlug !== session.teamSlug) {
      return NextResponse.json({ success: false, error: 'InvalidTeam' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      request: {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'ValidationError', details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'ResolveError',
        message: error instanceof Error ? error.message : 'Anfrage konnte nicht aktualisiert werden.',
      },
      { status: 500 }
    );
  }
}

