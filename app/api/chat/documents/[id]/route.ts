import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { checkChatRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

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

  const userEmail = (user as any).primaryEmail || '';
  const { id: documentId } = await params;

  try {
    // Verify ownership
    const { rows } = await query<{ user_email: string }>(
      `SELECT user_email FROM projectnexus.chat_documents WHERE id = $1`,
      [documentId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    if (rows[0].user_email !== userEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete embeddings first (foreign key constraint)
    await query(
      `DELETE FROM projectnexus.chat_embeddings WHERE document_id = $1`,
      [documentId]
    );

    // Delete document
    await query(
      `DELETE FROM projectnexus.chat_documents WHERE id = $1`,
      [documentId]
    );

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete document',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
