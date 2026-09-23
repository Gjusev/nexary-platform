import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { createConversation, listConversations, getConversation, updateConversation, deleteConversation } from '@/lib/chat';
import { query } from '@/lib/db';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';
import type { StackUser } from '@/lib/types/user';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Type assertion: Stack SDK's CurrentServerUser to our StackUser type
  const typedUser = user as unknown as StackUser;

  try {
    const body = await request.json();
    const { title, ragPackageIds, provider, model, useSmartSelector, assistantId } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    // Obtener el equipo del usuario
    const teams = await typedUser.listTeams?.() || [];
    const selectedTeam = typedUser.selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ success: false, error: 'No team found' }, { status: 400 });
    }

    // Obtener el slug del team desde la base de datos
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';

    // Primero intentar obtener desde la base de datos
    let teamResult = await query<{ slug: string }>(
      'SELECT slug FROM teams WHERE id = $1',
      [teamId]
    );

    // Si no existe, crear el team en PostgreSQL automáticamente
    if (teamResult.rows.length === 0) {
      // Insertar el team en la base de datos
      await query(
        `INSERT INTO teams (id, slug, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [teamId, teamName, teamName]
      );

      // Volver a consultar
      teamResult = await query<{ slug: string }>(
        'SELECT slug FROM teams WHERE id = $1',
        [teamId]
      );
    }

    const teamSlug = teamResult.rows[0].slug;
    const userEmail = typedUser.primaryEmail || '';

    const conversation = await createConversation({
      userEmail,
      teamSlug,
      title,
      ragPackageIds: Array.isArray(ragPackageIds) ? ragPackageIds : [],
      provider,
      model,
      useSmartSelector,
      assistantId: assistantId || null,
    });

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Type assertion: Stack SDK's CurrentServerUser to our StackUser type
  const typedUser = user as unknown as StackUser;

  try {
    // Obtener el equipo del usuario
    const teams = await typedUser.listTeams?.() || [];
    const selectedTeam = typedUser.selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ success: false, error: 'No team found' }, { status: 400 });
    }

    // Obtener el slug del team desde la base de datos
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';

    // Primero intentar obtener desde la base de datos
    let teamResult = await query<{ slug: string }>(
      'SELECT slug FROM teams WHERE id = $1',
      [teamId]
    );

    // Si no existe, crear el team en PostgreSQL automáticamente
    if (teamResult.rows.length === 0) {
      // Insertar el team en la base de datos
      await query(
        `INSERT INTO teams (id, slug, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [teamId, teamName, teamName]
      );

      // Volver a consultar
      teamResult = await query<{ slug: string }>(
        'SELECT slug FROM teams WHERE id = $1',
        [teamId]
      );
    }

    const teamSlug = teamResult.rows[0].slug;
    const userEmail = typedUser.primaryEmail || '';

    // listConversations now returns { conversations, hasMore }
    const result = await listConversations(userEmail, teamSlug);

    return NextResponse.json({
      success: true,
      conversations: result.conversations,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}
