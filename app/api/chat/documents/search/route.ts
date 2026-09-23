import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

// Helper to create embeddings using OpenAI (must match upload-document)
async function createEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ No OpenAI API key found, using mock embeddings');
    return Array.from({ length: 3072 }, () => Math.random());
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: text.substring(0, 8000), // Limit to 8k chars to avoid token limits
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error('Failed to create embedding');
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('❌ Error creating embedding:', error);
    // Fallback to mock if OpenAI fails
    return Array.from({ length: 3072 }, () => Math.random());
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

  const userEmail = (user as any).primaryEmail || '';
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  const queryText = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '5');

  if (!conversationId || !queryText) {
    return NextResponse.json(
      { success: false, error: 'conversationId and query required' },
      { status: 400 }
    );
  }

  try {
    // Create embedding for the query
    const queryEmbedding = await createEmbedding(queryText);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Search for similar chunks using cosine similarity
    const { rows } = await query(
      `SELECT 
        e.id,
        e.chunk_text,
        e.chunk_index,
        d.filename,
        d.id as document_id,
        1 - (e.embedding <=> $1::vector) as similarity
       FROM projectnexus.chat_embeddings e
       JOIN projectnexus.chat_documents d ON d.id = e.document_id
       WHERE e.conversation_id = $2 AND d.user_email = $3
       ORDER BY e.embedding <=> $1::vector
       LIMIT $4`,
      [embeddingStr, conversationId, userEmail, limit]
    );

    return NextResponse.json({
      success: true,
      results: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('💥 Error searching documents:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to search documents',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
