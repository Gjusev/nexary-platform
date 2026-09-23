import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { getAllPointsFromCollection } from '@/lib/rag/qdrant';
import { findSimilarChunks, groupChunksByDocument, type ChunkWithEmbedding } from '@/lib/rag/similarity';
import { forceDirectedLayout } from '@/lib/rag/layout';

const stackServerApp = new StackServerApp({
    tokenStore: 'nextjs-cookie',
});

type RouteContext = {
    params: Promise<{ packageId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { packageId } = await context.params;
        const { searchParams } = new URL(request.url);
        const similarityThreshold = parseFloat(searchParams.get('threshold') || '0.7');
        const viewMode = searchParams.get('mode') || 'chunks'; // 'chunks' or 'documents'

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

        // Get all documents for this package
        const documentsResult = await query(
            `SELECT id, filename, chunk_count, point_ids 
       FROM projectnexus.rag_documents 
       WHERE package_id = $1 AND deleted_at IS NULL
       ORDER BY filename`,
            [packageId]
        );

        if (documentsResult.rows.length === 0) {
            return NextResponse.json({
                success: true,
                nodes: [],
                edges: [],
                message: 'No documents found in this package',
            });
        }

        // Get all points from Qdrant collection
        const allPoints = await getAllPointsFromCollection(ragPackage.collection_name);

        // Map points to chunks with document info
        const chunks: ChunkWithEmbedding[] = [];
        const documentMap = new Map(
            documentsResult.rows.map(doc => [doc.id, doc])
        );

        for (const point of allPoints) {
            const payload = point.payload || {};
            // Fix: Qdrant payload uses camelCase 'documentId', not snake_case 'document_id'
            const documentId = payload.documentId as string;
            const document = documentMap.get(documentId);

            if (!document) {
                console.warn(`[Mindmap] Skipping point ${point.id}: document ${documentId} not found in map`);
                continue;
            }

            chunks.push({
                id: String(point.id),
                documentId,
                content: payload.text || '',
                embedding: Array.isArray(point.vector) ? point.vector : [],
                chunkIndex: (payload.chunkIndex as number) || 0,
                filename: document.filename,
                metadata: payload,
            });
        }

        if (chunks.length === 0 && allPoints.length > 0) {
            console.error(`[Mindmap] ERROR: Had ${allPoints.length} points but processed 0 chunks!`);
            console.error(`[Mindmap] This suggests a mismatch between point.payload.document_id and database document IDs`);
        }

        // Build graph based on view mode
        let nodes: any[] = [];
        let edges: any[] = [];

        if (viewMode === 'documents') {
            // Document-level view
            const documents = groupChunksByDocument(chunks);

            // Create document nodes
            nodes = documents.map((doc, index) => ({
                id: doc.id,
                type: 'document',
                data: {
                    label: doc.filename,
                    filename: doc.filename,
                    chunkCount: doc.chunkCount,
                    content: `${doc.filename} (${doc.chunkCount} chunks)`,
                },
                position: { x: 0, y: 0 }, // Will be calculated by layout
            }));

            // Calculate document similarities (simplified: use first chunk similarity)
            const docSimilarities: Array<{ source: string; target: string; similarity: number }> = [];
            for (let i = 0; i < documents.length; i++) {
                for (let j = i + 1; j < documents.length; j++) {
                    const doc1 = documents[i];
                    const doc2 = documents[j];

                    // Compare first chunks of each document
                    if (doc1.chunks.length > 0 && doc2.chunks.length > 0) {
                        const chunk1 = doc1.chunks[0];
                        const chunk2 = doc2.chunks[0];

                        // Calculate cosine similarity
                        let dotProduct = 0;
                        let mag1 = 0;
                        let mag2 = 0;
                        for (let k = 0; k < chunk1.embedding.length; k++) {
                            dotProduct += chunk1.embedding[k] * chunk2.embedding[k];
                            mag1 += chunk1.embedding[k] * chunk1.embedding[k];
                            mag2 += chunk2.embedding[k] * chunk2.embedding[k];
                        }
                        const similarity = dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));

                        if (similarity >= similarityThreshold) {
                            docSimilarities.push({
                                source: doc1.id,
                                target: doc2.id,
                                similarity,
                            });
                        }
                    }
                }
            }

            edges = docSimilarities.map((edge, index) => ({
                id: `edge-${index}`,
                source: edge.source,
                target: edge.target,
                label: edge.similarity.toFixed(2),
                data: { similarity: edge.similarity },
            }));
        } else {
            // Chunk-level view
            nodes = chunks.map((chunk, index) => ({
                id: chunk.id,
                type: 'chunk',
                data: {
                    label: `${chunk.filename} [${chunk.chunkIndex}]`,
                    filename: chunk.filename,
                    content: chunk.content.substring(0, 100) + '...',
                    chunkIndex: chunk.chunkIndex,
                    documentId: chunk.documentId,
                },
                position: { x: 0, y: 0 },
            }));

            // Find similar chunks
            const similarEdges = findSimilarChunks(chunks, similarityThreshold);

            // If we have very few edges due to high threshold, add the top N strongest connections anyway
            const MIN_EDGES_TO_SHOW = 10; // Show at least 10 strongest connections
            if (similarEdges.length < MIN_EDGES_TO_SHOW && chunks.length > 1) {
                // Calculate all possible similarities
                const allSimilarities: Array<{ source: string; target: string; similarity: number }> = [];
                for (let i = 0; i < chunks.length; i++) {
                    for (let j = i + 1; j < chunks.length; j++) {
                        const chunk1 = chunks[i];
                        const chunk2 = chunks[j];

                        // Calculate cosine similarity
                        let dotProduct = 0;
                        let mag1 = 0;
                        let mag2 = 0;
                        for (let k = 0; k < chunk1.embedding.length; k++) {
                            dotProduct += chunk1.embedding[k] * chunk2.embedding[k];
                            mag1 += chunk1.embedding[k] * chunk1.embedding[k];
                            mag2 += chunk2.embedding[k] * chunk2.embedding[k];
                        }
                        const similarity = dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));

                        allSimilarities.push({
                            source: chunk1.id,
                            target: chunk2.id,
                            similarity,
                        });
                    }
                }

                // Sort by similarity and take top MIN_EDGES_TO_SHOW
                const topConnections = allSimilarities
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, MIN_EDGES_TO_SHOW);

                edges = topConnections.slice(0, 500).map((edge, index) => ({
                    id: `edge-${index}`,
                    source: edge.source,
                    target: edge.target,
                    label: edge.similarity.toFixed(2),
                    data: { similarity: edge.similarity },
                }));
            } else {
                edges = similarEdges.slice(0, 500).map((edge, index) => ({
                    id: `edge-${index}`,
                    source: edge.source,
                    target: edge.target,
                    label: edge.similarity.toFixed(2),
                    data: { similarity: edge.similarity },
                }));
            }
        }

        // Calculate layout positions
        if (nodes.length > 0) {
            const layoutNodes = forceDirectedLayout(
                nodes.map(n => ({ id: n.id })),
                edges.map(e => ({ source: e.source, target: e.target })),
                1400,
                900
            );

            // Update node positions
            const positionMap = new Map(layoutNodes.map(n => [n.id, { x: n.x!, y: n.y! }]));
            nodes = nodes.map(n => ({
                ...n,
                position: positionMap.get(n.id) || { x: 0, y: 0 },
            }));
        }

        return NextResponse.json({
            success: true,
            nodes,
            edges,
            metadata: {
                packageId,
                packageName: ragPackage.name,
                totalChunks: chunks.length,
                totalDocuments: documentsResult.rows.length,
                viewMode,
                similarityThreshold,
            },
        });
    } catch (error) {
        console.error('[Mindmap] Error generating mindmap:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to generate mindmap',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
