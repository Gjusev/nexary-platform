
import { randomUUID } from 'crypto';
import { getPackageById } from '@/lib/rag/store';
import { ensureCollection, upsertPoints, deletePointsByFilter } from '@/lib/rag/qdrant';
import { embedTexts } from '@/lib/rag/query-pipeline';
import { smartChunkText } from '@/lib/rag/smart-chunking';
import { updateAssignmentStatus } from '@/lib/rag/master-document-store';
import type { MasterDocument } from '@/lib/rag/types';

/**
 * Processes a RAG assignment by chunking, embedding, and indexing the document text.
 * @param masterDoc The master document to process
 * @param ragPackageId The RAG package ID to assign to
 * @param extractedText The text content of the document
 */
export async function processRagAssignment(
    masterDoc: MasterDocument,
    ragPackageId: string,
    extractedText: string
): Promise<void> {
    try {
        // 1. Update status to processing
        await updateAssignmentStatus(masterDoc.id, ragPackageId, 'processing');

        // 2. Get RAG package for collection name
        const ragPackage = await getPackageById(ragPackageId);
        if (!ragPackage) {
            throw new Error(`RAG package ${ragPackageId} not found`);
        }

        await ensureCollection(ragPackage.collectionName);

        // Cleanup old points for this document to avoid duplicates/ghosts
        await deletePointsByFilter(ragPackage.collectionName, {
            must: [
                { key: 'document_id', match: { value: masterDoc.id } }
            ]
        });

        // 3. Chunk text
        const chunks = await smartChunkText(extractedText);

        if (chunks.length === 0) {
            await updateAssignmentStatus(masterDoc.id, ragPackageId, 'failed', {
                errorMessage: 'No text extracted from document'
            });
            return;
        }

        // 4. Generate embeddings
        const embeddings = await embedTexts(chunks);

        // Validate embeddings
        if (!embeddings || embeddings.length !== chunks.length) {
            console.error('[RAG Processor] Embedding count mismatch', {
                documentId: masterDoc.id,
                expectedChunks: chunks.length,
                receivedEmbeddings: embeddings?.length || 0
            });
            throw new Error(`Embedding mismatch: expected ${chunks.length}, got ${embeddings?.length || 0}`);
        }

        // 5. Create Qdrant points - only include valid embeddings
        const points = [];
        for (let i = 0; i < chunks.length; i++) {
            const embedding = embeddings[i];
            if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                console.warn('[RAG Processor] Invalid embedding at index', {
                    index: i,
                    documentId: masterDoc.id,
                    embeddingType: typeof embedding,
                    embeddingLength: Array.isArray(embedding) ? embedding.length : 'N/A'
                });
                continue;
            }

            points.push({
                id: randomUUID(),
                vector: embedding,
                payload: {
                    chunk_index: i,
                    text: chunks[i],
                    document_id: masterDoc.id,
                    filename: masterDoc.filename,
                    original_filename: masterDoc.originalFilename,
                    created_at: masterDoc.createdAt,
                    // Add metadata from master doc if needed
                    ...(masterDoc.tags ? { tags: masterDoc.tags } : {})
                }
            });
        }

        if (points.length === 0) {
            throw new Error('No valid embeddings generated');
        }

        // 6. Upsert to Qdrant
        await upsertPoints(ragPackage.collectionName, points);

        // 7. Update status to ready
        await updateAssignmentStatus(masterDoc.id, ragPackageId, 'ready', {
            chunkCount: chunks.length,
            pointIds: points.map(p => p.id)
        });

    } catch (error: any) {
        console.error(`Error processing RAG assignment for doc ${masterDoc.id} package ${ragPackageId}:`, error);
        await updateAssignmentStatus(masterDoc.id, ragPackageId, 'failed', {
            errorMessage: error.message || 'Unknown processing error'
        });
    }
}
