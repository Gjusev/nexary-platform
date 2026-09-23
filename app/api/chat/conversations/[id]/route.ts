import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { getConversation, getConversationBySlug, updateConversation, deleteConversation, addMessage } from '@/lib/chat';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';
import { AIProviderId } from '@/lib/ai/types';

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

  const searchParams = new URL(request.url).searchParams;
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userEmail = (user as { primaryEmail?: string | null }).primaryEmail || '';
  const limitParam = searchParams.get('limit');
  const beforeParam = searchParams.get('before');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const options = {
    limit: limit && !Number.isNaN(limit) ? limit : undefined,
    before: beforeParam || undefined,
  } as const;

  try {
    // Try to get conversation by slug (if it looks like a slug) or by ID (if it looks like a UUID)
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

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('💥 Error getting conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}

async function updateConversationHandler(
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

  const { id } = await params;
  const userEmail = (user as { primaryEmail?: string | null }).primaryEmail || '';

  try {
    const body = await request.json();
    const { title, ragPackageIds, provider, model, useSmartSelector } = body;

    const updates: {
      title?: string;
      ragPackageIds?: string[];
      provider?: AIProviderId;
      model?: string;
      useSmartSelector?: boolean;
    } = {};

    if (title !== undefined) {
      updates.title = title;
    }

    if (ragPackageIds !== undefined) {
      updates.ragPackageIds = Array.isArray(ragPackageIds) ? ragPackageIds : [];
    }

    if (provider !== undefined) {
      updates.provider = provider;
    }

    if (model !== undefined) {
      updates.model = model;
    }

    if (useSmartSelector !== undefined) {
      updates.useSmartSelector = useSmartSelector;
    }

    // Support both UUID and slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let conversationId = id;

    if (!isUUID) {
      // Get conversation by slug to find its UUID
      const conv = await getConversationBySlug(id, userEmail);
      if (!conv) {
        return NextResponse.json(
          { success: false, error: 'Conversation not found' },
          { status: 404 }
        );
      }
      conversationId = conv.id;
    }

    const conversation = await updateConversation(conversationId, userEmail, updates);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateConversationHandler(request, { params });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateConversationHandler(request, { params });
}

export async function DELETE(
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

  const { id } = await params;
  const userEmail = (user as { primaryEmail?: string | null }).primaryEmail || '';

  try {
    // Support both UUID and slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let conversationId = id;

    if (!isUUID) {
      // Get conversation by slug to find its UUID
      const conv = await getConversationBySlug(id, userEmail);
      if (!conv) {
        return NextResponse.json(
          { success: false, error: 'Conversation not found' },
          { status: 404 }
        );
      }
      conversationId = conv.id;
    }

    const deleted = await deleteConversation(conversationId, userEmail);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Failed to delete conversation: ${message}` },
      { status: 500 }
    );
  }
}

