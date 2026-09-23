import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createChat, listUserChats, initializeTables } from '@/lib/chat-db';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initializeTables();
    
    const { title, ragPackageIds = [] } = await request.json();

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid title is required' }, { status: 400 });
    }

    const chat = await createChat(
      session.teamSlug || 'default-team',
      session.user?.email || 'unknown',
      title,
      ragPackageIds
    );

    return NextResponse.json({
      success: true,
      chat: {
        id: chat.id,
        title: chat.title,
        ragPackageIds: chat.ragPackageIds,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create chat' },
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

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initializeTables();
    
    const chats = await listUserChats(
      session.teamSlug || 'default-team',
      session.user?.email || 'unknown'
    );

    return NextResponse.json({
      success: true,
      chats: chats.map(chat => ({
        id: chat.id,
        title: chat.title,
        ragPackageIds: chat.ragPackageIds,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to list chats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list chats' },
      { status: 500 }
    );
  }
}