import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { addMessage, getConversation, getConversationBySlug } from '@/lib/chat';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const limitParam = searchParams.get('limit');
  const beforeParam = searchParams.get('before');
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : undefined;

  const options = {
    limit: parsedLimit && !Number.isNaN(parsedLimit) ? parsedLimit : undefined,
    before: beforeParam || undefined,
  } as const;

  const { id } = await params;
  const userEmail = (user as any).primaryEmail || '';

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const conversation = isUUID
      ? await getConversation(id, userEmail, options)
      : await getConversationBySlug(id, userEmail, options);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const messages = (conversation.messages || []).map((message) => ({
      ...message,
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : message.createdAt,
    }));

    return NextResponse.json({
      success: true,
      messages,
      hasMore: conversation.hasMoreMessages ?? false,
    });
  } catch (error) {
    console.error('💥 Error fetching conversation messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const rateLimitResponse = checkChatRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: conversationIdentifier } = await params;
  const userEmail = (user as any).primaryEmail || '';

  try {
    // Verify user owns the conversation - check if it's a UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationIdentifier);
    const conversation = isUUID
      ? await getConversation(conversationIdentifier, userEmail)
      : await getConversationBySlug(conversationIdentifier, userEmail);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { role, content, metadata } = body;

    if (!role || !content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Role and content are required' },
        { status: 400 }
      );
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Use the actual conversation ID from the database, not the slug
    const message = await addMessage({
      conversationId: conversation.id,
      role,
      content,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error adding message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add message' },
      { status: 500 }
    );
  }
}
