/**
 * Utility functions for similarity calculations and graph construction
 */

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        mag1 += vec1[i] * vec1[i];
        mag2 += vec2[i] * vec2[i];
    }

    const magnitude1 = Math.sqrt(mag1);
    const magnitude2 = Math.sqrt(mag2);

    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
}

export interface ChunkWithEmbedding {
    id: string;
    documentId: string;
    content: string;
    embedding: number[];
    chunkIndex: number;
    filename: string;
    metadata?: Record<string, any>;
}

export interface SimilarityEdge {
    source: string;
    target: string;
    similarity: number;
}

/**
 * Find similar chunks based on cosine similarity threshold
 */
export function findSimilarChunks(
    chunks: ChunkWithEmbedding[],
    threshold: number = 0.7
): SimilarityEdge[] {
    const edges: SimilarityEdge[] = [];

    for (let i = 0; i < chunks.length; i++) {
        for (let j = i + 1; j < chunks.length; j++) {
            const similarity = cosineSimilarity(
                chunks[i].embedding,
                chunks[j].embedding
            );

            if (similarity >= threshold) {
                edges.push({
                    source: chunks[i].id,
                    target: chunks[j].id,
                    similarity,
                });
            }
        }
    }

    // Sort by similarity descending
    return edges.sort((a, b) => b.similarity - a.similarity);
}

export interface DocumentNode {
    id: string;
    filename: string;
    chunkCount: number;
    chunks: ChunkWithEmbedding[];
}

/**
 * Group chunks by document for hierarchical visualization
 */
export function groupChunksByDocument(
    chunks: ChunkWithEmbedding[]
): DocumentNode[] {
    const documentMap = new Map<string, DocumentNode>();

    for (const chunk of chunks) {
        if (!documentMap.has(chunk.documentId)) {
            documentMap.set(chunk.documentId, {
                id: chunk.documentId,
                filename: chunk.filename,
                chunkCount: 0,
                chunks: [],
            });
        }

        const doc = documentMap.get(chunk.documentId)!;
        doc.chunks.push(chunk);
        doc.chunkCount++;
    }

    return Array.from(documentMap.values());
}

/**
 * Calculate average embedding for a document (useful for document-level similarity)
 */
export function getDocumentEmbedding(chunks: ChunkWithEmbedding[]): number[] {
    if (chunks.length === 0) return [];

    const embeddingSize = chunks[0].embedding.length;
    const avgEmbedding = new Array(embeddingSize).fill(0);

    for (const chunk of chunks) {
        for (let i = 0; i < embeddingSize; i++) {
            avgEmbedding[i] += chunk.embedding[i];
        }
    }

    for (let i = 0; i < embeddingSize; i++) {
        avgEmbedding[i] /= chunks.length;
    }

    return avgEmbedding;
}

/**
 * Find most similar chunks to a given chunk
 */
export function findMostSimilarChunks(
    targetChunk: ChunkWithEmbedding,
    allChunks: ChunkWithEmbedding[],
    topK: number = 5
): Array<{ chunk: ChunkWithEmbedding; similarity: number }> {
    const similarities = allChunks
        .filter(chunk => chunk.id !== targetChunk.id)
        .map(chunk => ({
            chunk,
            similarity: cosineSimilarity(targetChunk.embedding, chunk.embedding),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

    return similarities;
}
