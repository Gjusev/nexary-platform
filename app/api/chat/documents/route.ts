import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

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

  const userEmail = (user as any).primaryEmail || '';
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');

  if (!conversationId) {
    return NextResponse.json(
      { success: false, error: 'conversationId required' },
      { status: 400 }
    );
  }

  try {
    const { rows } = await query(
      `SELECT 
        d.id,
        d.filename,
        d.file_size,
        d.content_type,
        d.created_at,
        COUNT(e.id) as chunk_count
       FROM projectnexus.chat_documents d
       LEFT JOIN projectnexus.chat_embeddings e ON e.document_id = d.id
       WHERE d.conversation_id = $1 AND d.user_email = $2
       GROUP BY d.id, d.filename, d.file_size, d.content_type, d.created_at
       ORDER BY d.created_at DESC`,
      [conversationId, userEmail]
    );

    return NextResponse.json({
      success: true,
      documents: rows,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
