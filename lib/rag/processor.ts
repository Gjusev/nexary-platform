import { randomUUID } from 'crypto';

import type { RagPackage } from '@/lib/rag/types';
import { generateEmbedding } from '@/lib/rag/embeddings';
import { ensureCollection, upsertPoints, type QdrantPoint } from '@/lib/rag/qdrant';

const MAX_CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE ?? 1200);
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP ?? 200);

export type DocumentProcessingResult = {
  chunkCount: number;
  pointIds: string[];
};

export function cleanText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
}

export function splitText(text: string): string[] {
  const normalized = cleanText(text);
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  const step = Math.max(1, MAX_CHUNK_SIZE - CHUNK_OVERLAP);

  while (start < normalized.length) {
    const end = Math.min(start + MAX_CHUNK_SIZE, normalized.length);
    let chunk = normalized.slice(start, end);

    if (end < normalized.length) {
      const lastNewline = chunk.lastIndexOf('\n');
      if (lastNewline > MAX_CHUNK_SIZE / 2) {
        chunk = chunk.slice(0, lastNewline);
      }
    }

    chunks.push(chunk.trim());
    if (end === normalized.length) {
      break;
    }
    start += step;
  }

  return chunks.filter(Boolean);
}

export async function processDocumentChunks(params: {
  ragPackage: RagPackage;
  documentId: string;
  filename: string;
  teamSlug: string;
  textContent: string;
}): Promise<DocumentProcessingResult> {
  const { ragPackage, documentId, filename, teamSlug, textContent } = params;
  const collectionName = ragPackage.collectionName;

  const chunks = splitText(textContent);
  if (chunks.length === 0) {
    return { chunkCount: 0, pointIds: [] };
  }

  await ensureCollection(collectionName);

  const pointIds: string[] = [];
  const points: QdrantPoint[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const embedding = await generateEmbedding(chunk);
    const pointId = randomUUID();
    pointIds.push(pointId);
    points.push({
      id: pointId,
      vector: embedding,
      payload: {
        packageId: ragPackage.id,
        packageName: ragPackage.name,
        teamSlug,
        documentId,
        documentName: filename,
        chunkIndex: index,
        text: chunk,
      },
    });
  }

  await upsertPoints(collectionName, points);

  return { chunkCount: chunks.length, pointIds };
}
