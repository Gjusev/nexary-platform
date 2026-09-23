import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { getChatById, addMessage, getChatMessages, deleteChat, updateChat, initializeTables } from '@/lib/chat-db';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: chatId } = await params;

  try {
    await initializeTables();
    
    const chat = await getChatById(chatId);
    if (!chat || chat.teamSlug !== session.teamSlug) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 });
    }

    const messages = await getChatMessages(chatId);

    return NextResponse.json({
      success: true,
      chat: {
        id: chat.id,
        title: chat.title,
        ragPackageIds: chat.ragPackageIds,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
      },
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to get chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chat' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: chatId } = await params;

  try {
    await initializeTables();
    
    const chat = await getChatById(chatId);
    if (!chat || chat.teamSlug !== session.teamSlug) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 });
    }

    const { content, role = 'user' } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid content is required' }, { status: 400 });
    }

    if (role !== 'user' && role !== 'assistant') {
      return NextResponse.json({ success: false, error: 'Role must be either user or assistant' }, { status: 400 });
    }

    const message = await addMessage(chatId, role, content);

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to add message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add message' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: chatId } = await params;

  try {
    await initializeTables();
    
    const chat = await getChatById(chatId);
    if (!chat || chat.teamSlug !== session.teamSlug) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 });
    }

    const { title, ragPackageIds } = await request.json();
    const updates: { title?: string; ragPackageIds?: string[] } = {};

    if (title !== undefined) {
      updates.title = title;
    }

    if (ragPackageIds !== undefined) {
      updates.ragPackageIds = ragPackageIds;
    }

    await updateChat(chatId, updates);

    return NextResponse.json({
      success: true,
      message: 'Chat updated successfully',
    });
  } catch (error) {
    console.error('Failed to update chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update chat' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.teamSlug) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: chatId } = await params;

  try {
    await initializeTables();
    
    const chat = await getChatById(chatId);
    if (!chat || chat.teamSlug !== session.teamSlug) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 });
    }

    await deleteChat(chatId);

    return NextResponse.json({
      success: true,
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}