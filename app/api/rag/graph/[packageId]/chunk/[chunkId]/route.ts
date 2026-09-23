import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { getAllPointsFromCollection } from '@/lib/rag/qdrant';

const stackServerApp = new StackServerApp({
    tokenStore: 'nextjs-cookie',
});

type RouteContext = {
    params: Promise<{ packageId: string; chunkId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { packageId, chunkId } = await context.params;

        // Get package details
        const packageResult = await query(
            `SELECT id, name, collection_name, team_slug 
       FROM projectnexus.rag_packages 
       WHERE id = $1 AND deleted_at IS NULL`,
            [packageId]
        );

        if (packageResult.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
        }

        const ragPackage = packageResult.rows[0];

        // Get all points to find the specific chunk and neighbors
        const allPoints = await getAllPointsFromCollection(ragPackage.collection_name);

        const targetPoint = allPoints.find(p => String(p.id) === chunkId);
        if (!targetPoint) {
            return NextResponse.json({ success: false, error: 'Chunk not found' }, { status: 404 });
        }

        const payload = targetPoint.payload || {};
        const documentId = payload.document_id;
        const chunkIndex = payload.chunk_index || 0;

        // Get document info
        const documentResult = await query(
            `SELECT id, filename, chunk_count 
       FROM projectnexus.rag_documents 
       WHERE id = $1 AND deleted_at IS NULL`,
            [documentId]
        );

        const document = documentResult.rows[0] || null;

        // Find neighbor chunks from same document
        const neighbors = allPoints
            .filter(p => {
                const pPayload = p.payload || {};
                return pPayload.document_id === documentId && String(p.id) !== chunkId;
            })
            .map(p => {
                const pPayload = p.payload || {};
                return {
                    id: String(p.id),
                    chunkIndex: pPayload.chunk_index || 0,
                    content: (pPayload.text || '').substring(0, 200) + '...',
                };
            })
            .sort((a, b) => a.chunkIndex - b.chunkIndex);

        // Get previous and next chunks
        const prevChunk = neighbors.find(n => n.chunkIndex === chunkIndex - 1);
        const nextChunk = neighbors.find(n => n.chunkIndex === chunkIndex + 1);

        return NextResponse.json({
            success: true,
            chunk: {
                id: chunkId,
                documentId,
                content: payload.text || '',
                chunkIndex,
                metadata: payload,
            },
            document: document ? {
                id: document.id,
                filename: document.filename,
                totalChunks: document.chunk_count,
            } : null,
            navigation: {
                previous: prevChunk || null,
                next: nextChunk || null,
                allChunks: neighbors,
            },
        });
    } catch (error) {
        console.error('[Mindmap Chunk Detail] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to retrieve chunk details',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
